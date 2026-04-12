"""Evaluate a saved checkpoint on the held-out test CSV."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
import time

import numpy as np
import torch
from sklearn.metrics import accuracy_score, classification_report, f1_score
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

_SRC_ROOT = Path(__file__).resolve().parents[1]
if str(_SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(_SRC_ROOT))

from model.config import ASPECT_NAMES_EN, train_config_from_saved_dict
from model.data import AspectReviewDataset, collate_batch, load_review_frame
from model.videberta_msd import ViDeBERTaAspectMSD

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main() -> None:
    # Parse command-line arguments for checkpoint path, test CSV path, and verbosity
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=str, default=None, help="Path to best.pt")
    parser.add_argument("--test-csv", type=str, default=None)
    parser.add_argument("--num-workers", type=int, default=None, help="Override DataLoader workers")
    parser.add_argument("--verbose", action="store_true", help="Print sklearn classification_report per aspect")
    args = parser.parse_args()

    # Determine and check the checkpoint path
    repo = Path(__file__).resolve().parents[2]
    ckpt_path = Path(args.checkpoint) if args.checkpoint else repo / "models" / "best.pt"
    if not ckpt_path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    # Load the checkpoint payload, which includes the model state dict and training configuration
    try:
        payload = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    except TypeError:
        payload = torch.load(ckpt_path, map_location="cpu")
    cfg = train_config_from_saved_dict(payload["train_config"], load_dir=ckpt_path.parent)

    # If a test CSV path is provided via command-line argument, override the one in the loaded training configuration
    if args.test_csv:
        cfg.test_csv = Path(args.test_csv)
    if args.num_workers is not None:
        if args.num_workers < 0:
            raise ValueError(f"--num-workers must be >= 0, got {args.num_workers}")
        cfg.num_workers = args.num_workers

    # Load the tokenizer, test dataset, and create a DataLoader for the test set
    tokenizer = AutoTokenizer.from_pretrained(payload.get("tokenizer_name", cfg.model_name))
    test_df = load_review_frame(cfg.test_csv)
    test_ds = AspectReviewDataset(test_df, tokenizer, cfg.max_length)
    test_loader = DataLoader(
        test_ds,
        batch_size=cfg.batch_size,
        shuffle=False,
        collate_fn=collate_batch,
        num_workers=cfg.num_workers,
        pin_memory=torch.cuda.is_available(),
        persistent_workers=cfg.num_workers > 0,
    )

    # Initialize the model architecture, load the saved model state dict from the checkpoint, and set the model to evaluation mode
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    class_weights = payload.get("class_weights")
    model = ViDeBERTaAspectMSD(cfg, class_weights=class_weights).to(device)

    # Filter out "class_weights" if it exists in old checkpoints (for backwards compatibility)
    state_dict = payload["model_state_dict"]
    if "class_weights" in state_dict:
        state_dict = {k: v for k, v in state_dict.items() if k != "class_weights"}

    model.load_state_dict(state_dict, strict=False)

    # Set the model to evaluation mode
    model.eval()

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    frozen_params = total_params - trainable_params

    logger.info(f"\n--- Model Complexity ---")
    logger.info(f"Total parameters:     {total_params:>12,}")
    logger.info(f"Trainable parameters: {trainable_params:>12,}  ({trainable_params/total_params*100:.1f}%)")
    logger.info(f"Frozen parameters:    {frozen_params:>12,}  ({frozen_params/total_params*100:.1f}%)")
    logger.info(f"Model size (est.):    {total_params*4/1024/1024:.1f} MB (float32)")

    all_logits = []
    all_labels = []

    # Iterate over batches in the test DataLoader, move batch tensors to the configured device, and perform a forward pass through the model to get output logits. Collect all logits and labels for evaluation after processing all batches.
    infer_start = time.time()
    with torch.no_grad():
        for batch in test_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            out = model(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"])
            all_logits.append(out["logits"].cpu())
            all_labels.append(batch["labels"].cpu())
    infer_time = time.time() - infer_start
    n_samples = len(test_ds)
    logger.info(f"\nInference time total: {infer_time:.2f}s")
    logger.info(f"Inference time per sample: {infer_time/n_samples*1000:.2f}ms")

    logits = torch.cat(all_logits, dim=0)
    labels = torch.cat(all_labels, dim=0)
    preds = logits.argmax(dim=-1).numpy()
    y = labels.numpy()
    labels_range = list(range(cfg.num_classes_per_aspect))

    # Calculate and print the macro-F1 score and accuracy for each aspect, as well as the mean macro-F1 score across all aspects. If verbosity is enabled, also print the classification report for each aspect.
    logger.info("Per-aspect macro-F1 and accuracy:")
    f1_macros = []
    for a, name in enumerate(ASPECT_NAMES_EN):
        f1m = f1_score(y[:, a], preds[:, a], average="macro", labels=labels_range, zero_division=0)
        acc = accuracy_score(y[:, a], preds[:, a])
        f1_macros.append(f1m)
        logger.info(f"  {name}: macro-F1={f1m:.4f} acc={acc:.4f}")
        if args.verbose:
            logger.info(f"\n{name} classification report:\n{classification_report(y[:, a], preds[:, a], labels=labels_range, zero_division=0)}")
    logger.info(f"Mean macro-F1 (over aspects): {float(np.mean(f1_macros)):.4f}")


if __name__ == "__main__":
    main()
