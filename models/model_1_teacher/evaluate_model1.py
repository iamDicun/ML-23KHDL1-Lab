import argparse
import json
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

from train_model1 import (
    ASPECT_COLUMNS,
    PhoBERTMultiTask,
    ReviewDataset,
    evaluate,
    read_csv_flexible,
    validate_dataframe,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser("Evaluate Model 1 checkpoint on test set")
    parser.add_argument(
        "--checkpoint-path",
        type=str,
        default="models/model_1_teacher/artifacts/best_model.pt",
    )
    parser.add_argument(
        "--test-path",
        type=str,
        default="data/dataset/final_processed_3-VLSP2018-SA-Hotel-test.csv",
    )
    parser.add_argument(
        "--tokenizer-path",
        type=str,
        default="models/model_1_teacher/artifacts/tokenizer",
        help="Tokenizer directory saved after training. Falls back to model_name in checkpoint.",
    )
    parser.add_argument("--text-col", type=str, default="Review")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--max-len", type=int, default=256)
    parser.add_argument(
        "--output-json",
        type=str,
        default="models/model_1_teacher/artifacts/test_metrics.json",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    checkpoint_path = Path(args.checkpoint_path)
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    train_cfg = checkpoint.get("config", {})
    model_name = train_cfg.get("model_name", "vinai/phobert-base")
    num_labels = int(train_cfg.get("num_labels", 5))

    tokenizer_path = Path(args.tokenizer_path)
    if tokenizer_path.exists():
        tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_path))
    else:
        tokenizer = AutoTokenizer.from_pretrained(model_name)

    test_df = validate_dataframe(read_csv_flexible(args.test_path), args.text_col)
    test_dataset = ReviewDataset(
        dataframe=test_df,
        tokenizer=tokenizer,
        text_col=args.text_col,
        aspect_cols=ASPECT_COLUMNS,
        max_len=args.max_len,
    )
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = PhoBERTMultiTask(
        model_name=model_name,
        num_aspects=len(ASPECT_COLUMNS),
        num_labels=num_labels,
        dropout=0.2,
        use_gradient_checkpointing=False,
        freeze_backbone=False,
    ).to(device)
    model.load_state_dict(checkpoint["state_dict"])

    criterion = nn.CrossEntropyLoss()
    metrics = evaluate(model, test_loader, device, ASPECT_COLUMNS, criterion)

    # Keep naming explicit for test-set reporting.
    if "val_loss" in metrics:
        metrics["test_loss"] = metrics.pop("val_loss")

    output_path = Path(args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    print("Test evaluation completed.")
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    print(f"Saved metrics to: {output_path}")


if __name__ == "__main__":
    main()
