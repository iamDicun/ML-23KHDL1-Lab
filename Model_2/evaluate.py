"""Evaluate the 6-head PhoBERT + BiGRU checkpoint on the test split."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, classification_report, f1_score
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModel, AutoTokenizer


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "phobert_local"
DEFAULT_TEST_FILE = BASE_DIR / "data" / "crawl_only_test.csv"
DEFAULT_CHECKPOINT = BASE_DIR / "phobert_local" / "best_phobert_gru_ce.pth"

MAX_LEN = 128
BATCH_SIZE = 16
GRU_HIDDEN_DIM = 256
NUM_CLASSES = 3

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

        self.data = self.data.dropna(subset=required_cols).reset_index(drop=True)
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.data)

    def __getitem__(self, idx: int):
        row = self.data.iloc[idx]
        review_text = str(row["Review"])
        labels = torch.tensor(row[LABEL_COLS].astype(int).values, dtype=torch.long)

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
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": labels,
        }


class PhoBERTMultiHeadGRU(nn.Module):
    def __init__(self, phobert_path: Path, gru_hidden_dim: int, num_labels: int, num_classes: int):
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
        self.heads = nn.ModuleList(
            [nn.Linear(gru_hidden_dim * 2, num_classes) for _ in range(num_labels)]
        )

    @staticmethod
    def masked_mean_pool(sequence_output: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        mask = attention_mask.unsqueeze(-1).type_as(sequence_output)
        masked_sum = (sequence_output * mask).sum(dim=1)
        token_count = mask.sum(dim=1).clamp(min=1.0)
        return masked_sum / token_count

    def forward(self, input_ids, attention_mask):
        phobert_outputs = self.phobert(input_ids=input_ids, attention_mask=attention_mask)
        sequence_output = phobert_outputs.last_hidden_state

        lengths = attention_mask.sum(dim=1).to(dtype=torch.long).cpu()
        packed = nn.utils.rnn.pack_padded_sequence(
            sequence_output,
            lengths,
            batch_first=True,
            enforce_sorted=False,
        )
        packed_output, _ = self.gru(packed)
        gru_output, _ = nn.utils.rnn.pad_packed_sequence(
            packed_output,
            batch_first=True,
            total_length=sequence_output.size(1),
        )

        pooled_output = self.masked_mean_pool(gru_output, attention_mask)
        return [head(pooled_output) for head in self.heads]


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate the 6-head checkpoint on the test split.")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=str(DEFAULT_CHECKPOINT),
        help="Path to best_phobert_gru_ce.pth",
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


def predict_classes(logits_list):
    return torch.stack([logits.argmax(dim=-1) for logits in logits_list], dim=1)


def evaluate(model, dataloader, device):
    model.eval()
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            logits_list = model(input_ids=input_ids, attention_mask=attention_mask)
            preds = predict_classes(logits_list)

            all_preds.append(preds.cpu())
            all_labels.append(labels.cpu())

    y_pred = torch.cat(all_preds, dim=0).numpy()
    y_true = torch.cat(all_labels, dim=0).numpy()
    return y_true, y_pred


def load_checkpoint(path: Path, model: nn.Module, device: torch.device):
    checkpoint = torch.load(path, map_location=device)
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
        return checkpoint

    model.load_state_dict(checkpoint)
    return {"model_state_dict": checkpoint}


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

    model = PhoBERTMultiHeadGRU(MODEL_PATH, GRU_HIDDEN_DIM, NUM_LABELS, NUM_CLASSES).to(device)
    checkpoint = load_checkpoint(checkpoint_path, model, device)
    if isinstance(checkpoint, dict) and "epoch" in checkpoint:
        print(
            f"Loaded checkpoint from epoch {checkpoint['epoch']} "
            f"(val mean-aspect F1: {checkpoint.get('val_metrics', {}).get('mean_aspect_macro_f1', float('nan')):.4f})"
        )

    y_true, y_pred = evaluate(model, test_loader, device)

    print(f"Test samples: {len(test_dataset)}")
    flat_acc = accuracy_score(y_true.reshape(-1), y_pred.reshape(-1))
    exact_match = float(np.all(y_true == y_pred, axis=1).mean())
    print(f"Overall accuracy: {flat_acc:.4f}")
    print(f"Exact-match ratio: {exact_match:.4f}")
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
