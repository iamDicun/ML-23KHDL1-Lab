"""Evaluate the trained PhoBERT + BiGRU checkpoint on the test split.

The model in `training.py` is trained with `MSELoss`, so its outputs are
continuous values. For F1 evaluation, we convert each output to the nearest
class in {0, 1, 2} by rounding and clamping.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import classification_report, f1_score
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModel, AutoTokenizer


BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

MODEL_PATH = BASE_DIR / "phobert_local"
DEFAULT_TEST_FILE = BASE_DIR / "data" / "crawl_only_test.csv"
DEFAULT_CHECKPOINT = REPO_ROOT / "Model_2" / "phobert_local" / "best_phobert_gru.pth"

MAX_LEN = 128
BATCH_SIZE = 16
GRU_HIDDEN_DIM = 256

LABEL_COLS = [
    "v\u1ec7 sinh_label",
    "\u0111\u1ed3 \u0103n th\u1ee9c u\u1ed1ng_label",
    "kh\u00e1ch s\u1ea1n_label",
    "v\u1ecb tr\u00ed_label",
    "ph\u00f2ng \u1ed1c_label",
    "d\u1ecbch v\u1ee5_label",
]
CLASS_VALUES = [0, 1, 2]
NUM_LABELS = len(LABEL_COLS)


class HotelReviewDataset(Dataset):
    def __init__(self, csv_file: Path, tokenizer, max_len: int):
        self.data = pd.read_csv(csv_file)
        required_cols = ["Review", *LABEL_COLS]
        missing_cols = [col for col in required_cols if col not in self.data.columns]
        if missing_cols:
            raise ValueError(f"Missing columns in {csv_file}: {missing_cols}")

        self.data = self.data.dropna(subset=required_cols)
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.data)

    def __getitem__(self, idx: int):
        row = self.data.iloc[idx]
        review_text = str(row["Review"])
        labels = torch.tensor(row[LABEL_COLS].values.astype(float), dtype=torch.float)

        encoding = self.tokenizer(
            review_text,
            add_special_tokens=True,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_attention_mask=True,
            return_tensors="pt",
        )

        return {
            "input_ids": encoding["input_ids"].flatten(),
            "attention_mask": encoding["attention_mask"].flatten(),
            "labels": labels,
        }


class PhoBERT_GRU_Model(nn.Module):
    def __init__(self, phobert_path, gru_hidden_dim: int, num_labels: int):
        super().__init__()

        self.phobert = AutoModel.from_pretrained(phobert_path)
        phobert_hidden_size = self.phobert.config.hidden_size

        self.gru = nn.GRU(
            input_size=phobert_hidden_size,
            hidden_size=gru_hidden_dim,
            num_layers=1,
            batch_first=True,
            bidirectional=True,
        )
        self.classifier = nn.Linear(gru_hidden_dim * 2, num_labels)

    def forward(self, input_ids, attention_mask):
        phobert_outputs = self.phobert(input_ids=input_ids, attention_mask=attention_mask)
        sequence_output = phobert_outputs.last_hidden_state
        gru_output, _ = self.gru(sequence_output)

        # The training script uses plain mean pooling. We keep the same behavior
        # here so evaluation matches the trained checkpoint exactly.
        pooled_output = torch.mean(gru_output, dim=1)
        logits = self.classifier(pooled_output)
        return logits


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate the best checkpoint on the test split.")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=str(DEFAULT_CHECKPOINT),
        help="Path to best_phobert_gru.pth",
    )
    parser.add_argument(
        "--test-csv",
        type=str,
        default=str(DEFAULT_TEST_FILE),
        help="Path to the held-out test CSV",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=BATCH_SIZE,
        help="Evaluation batch size",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print classification report for each aspect",
    )
    return parser.parse_args()


def evaluate(model, dataloader, device):
    model.eval()
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            preds = torch.round(outputs).clamp(min=0, max=2).long()

            all_preds.append(preds.cpu())
            all_labels.append(labels.cpu().long())

    y_pred = torch.cat(all_preds, dim=0).numpy()
    y_true = torch.cat(all_labels, dim=0).numpy()
    return y_true, y_pred


def main():
    args = parse_args()

    checkpoint_path = Path(args.checkpoint)
    test_csv_path = Path(args.test_csv)

    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
    if not test_csv_path.is_file():
        raise FileNotFoundError(f"Test CSV not found: {test_csv_path}")
    if not MODEL_PATH.is_dir():
        raise FileNotFoundError(f"PhoBERT folder not found: {MODEL_PATH}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    test_dataset = HotelReviewDataset(test_csv_path, tokenizer, MAX_LEN)
    test_loader = DataLoader(
        test_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        pin_memory=torch.cuda.is_available(),
    )

    model = PhoBERT_GRU_Model(MODEL_PATH, GRU_HIDDEN_DIM, NUM_LABELS).to(device)
    state_dict = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(state_dict)

    y_true, y_pred = evaluate(model, test_loader, device)

    print(f"Test samples: {len(test_dataset)}")
    print("\nPer-aspect macro-F1:")
    f1_scores = []
    for idx, label_name in enumerate(LABEL_COLS):
        f1 = f1_score(
            y_true[:, idx],
            y_pred[:, idx],
            average="macro",
            labels=CLASS_VALUES,
            zero_division=0,
        )
        f1_scores.append(f1)
        print(f"- {label_name}: {f1:.4f}")

        if args.verbose:
            print(
                classification_report(
                    y_true[:, idx],
                    y_pred[:, idx],
                    labels=CLASS_VALUES,
                    zero_division=0,
                )
            )

    mean_f1 = float(np.mean(f1_scores))
    print(f"\nMean macro-F1 across 6 aspects: {mean_f1:.4f}")


if __name__ == "__main__":
    main()
