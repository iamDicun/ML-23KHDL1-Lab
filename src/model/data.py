"""CSV datasets and DataLoaders for multi-aspect hotel reviews."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset
from transformers import PreTrainedTokenizer

from .config import ASPECT_LABEL_COLUMNS, TEXT_COLUMN

logger = logging.getLogger(__name__)


def _validate_labels(df: pd.DataFrame, aspect_columns: list[str], num_classes: int = 3) -> np.ndarray:
    missing_cols = [c for c in aspect_columns if c not in df.columns]
    if missing_cols:
        raise KeyError(f"Missing label columns: {missing_cols}")

    label_df = df[aspect_columns]
    nan_counts = label_df.isna().sum()
    if int(nan_counts.sum()) > 0:
        bad = {k: int(v) for k, v in nan_counts.items() if int(v) > 0}
        raise ValueError(f"Found NaN labels. Fix preprocessing first. NaN counts: {bad}")

    labels = label_df.astype("int64").to_numpy()
    invalid = (labels < 0) | (labels >= num_classes)
    if invalid.any():
        bad_values = np.unique(labels[invalid]).tolist()
        raise ValueError(f"Label ids must be in [0, {num_classes - 1}], got {bad_values}")

    return labels

# Load the review frame from the CSV file
def load_review_frame(csv_path: str | Path, aspect_columns: list[str] | None = None) -> pd.DataFrame:
    aspect_columns = aspect_columns or ASPECT_LABEL_COLUMNS
    csv_path = Path(csv_path)

    if not csv_path.is_file():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    logger.info(f"Loading reviews from: {csv_path}")
    df = pd.read_csv(csv_path)
    logger.info(f"Loaded {len(df)} reviews")

    missing = [c for c in [TEXT_COLUMN, *aspect_columns] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in {csv_path}: {missing}")

    return df

class AspectReviewDataset(Dataset):
    """Dataset for the review frame"""
    def __init__(
        self,
        df: pd.DataFrame,
        tokenizer: PreTrainedTokenizer,
        max_length: int,
        aspect_columns: list[str] | None = None,
    ):
        self.texts = df[TEXT_COLUMN].astype(str).tolist()
        self.aspect_columns = aspect_columns or ASPECT_LABEL_COLUMNS
        labels = _validate_labels(df, self.aspect_columns, num_classes=3)
        self.labels = torch.tensor(labels, dtype=torch.long)
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.texts)

    # Get an item from the dataset
    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        enc = self.tokenizer(
            self.texts[idx],
            max_length=self.max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {
            "input_ids": enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "labels": self.labels[idx],
        }

# Collate a batch of data
def collate_batch(batch: list[dict[str, torch.Tensor]]) -> dict[str, torch.Tensor]:
    return {
        "input_ids": torch.stack([b["input_ids"] for b in batch], dim=0),
        "attention_mask": torch.stack([b["attention_mask"] for b in batch], dim=0),
        "labels": torch.stack([b["labels"] for b in batch], dim=0),
    }

# Verify the label values
def verify_label_values(train_csv: str | Path, aspect_columns: list[str], expected_num_classes: int) -> None:
    path = Path(train_csv)
    logger.info(f"Verifying label values in: {path}")
    df = pd.read_csv(path)
    _validate_labels(df, aspect_columns, num_classes=expected_num_classes)
    logger.info(f"Label validation passed: all labels are in [0, {expected_num_classes-1}]")

def compute_class_weights(
    df: pd.DataFrame,
    aspect_columns: list[str],
    num_classes: int = 3,
) -> torch.Tensor:
    weights = []
    total = len(df)
    for col in aspect_columns:
        counts = df[col].value_counts().sort_index()
        w = []
        for c in range(num_classes):
            cnt = int(counts.get(c, 1))
            raw_w = total / (num_classes * cnt)
            w.append(raw_w ** 0.5)  # Stronger weight adjustment to handle class imbalance
        weights.append(w)
    return torch.tensor(weights, dtype=torch.float32)