"""CSV datasets and DataLoaders for multi-aspect hotel reviews"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset
from transformers import PreTrainedTokenizer

from .config import ASPECT_LABEL_COLUMNS, TEXT_COLUMN

logger = logging.getLogger(__name__)


def _validate_labels(df: pd.DataFrame, aspect_columns: list[str], num_classes: int = 3) -> np.ndarray:
    """Validate that the aspect label columns exist, contain no NaNs, and have valid class ids"""
    # Check that all aspect label columns are present
    missing_cols = [c for c in aspect_columns if c not in df.columns]
    if missing_cols:
        raise KeyError(f"Missing label columns: {missing_cols}")

    # Check for NaN values in label columns
    label_df = df[aspect_columns]
    nan_counts = label_df.isna().sum()
    if int(nan_counts.sum()) > 0:
        bad = {k: int(v) for k, v in nan_counts.items() if int(v) > 0}
        raise ValueError(f"Found NaN labels. Fix preprocessing first. NaN counts: {bad}")

    # Check that all label values are integers in the valid range [0, num_classes-1]
    labels = label_df.astype("int64").to_numpy()
    invalid = (labels < 0) | (labels >= num_classes)
    if invalid.any():
        bad_values = np.unique(labels[invalid]).tolist()
        raise ValueError(f"Label ids must be in [0, {num_classes - 1}], got {bad_values}")

    return labels

def load_review_frame(csv_path: str | Path, aspect_columns: list[str] | None = None) -> pd.DataFrame:
    """Load the review frame from the CSV file"""
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
    """PyTorch Dataset for hotel reviews with aspect labels"""
    def __init__(
        self,
        df: pd.DataFrame,
        tokenizer: PreTrainedTokenizer,
        max_length: int,
        aspect_columns: list[str] | None = None,
    ):
        self.aspect_columns = aspect_columns or ASPECT_LABEL_COLUMNS
        texts = df[TEXT_COLUMN].astype(str).tolist()

        # Validate labels
        labels = _validate_labels(df, self.aspect_columns, num_classes=3)

        self.labels = torch.tensor(labels, dtype=torch.long)

        # Set time the tokenization step since it can be a bottleneck, especially on large datasets
        t0 = time.time()
        encodings = tokenizer(
            texts,
            max_length=max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        self.input_ids = encodings["input_ids"]            # [N, L]
        self.attention_mask = encodings["attention_mask"]   # [N, L]
        elapsed = time.time() - t0

        logger.info(f"Pre-tokenized {len(texts)} samples in {elapsed:.2f}s")

    def __len__(self) -> int:
        return self.input_ids.size(0)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        """Get an item from the dataset (no tokenization — just tensor indexing)"""
        return {
            "input_ids": self.input_ids[idx],
            "attention_mask": self.attention_mask[idx],
            "labels": self.labels[idx],
        }

def collate_batch(batch: list[dict[str, torch.Tensor]]) -> dict[str, torch.Tensor]:
    """Collate function to combine a list of samples into a batch for the DataLoader"""
    return {
        "input_ids": torch.stack([b["input_ids"] for b in batch], dim=0),
        "attention_mask": torch.stack([b["attention_mask"] for b in batch], dim=0),
        "labels": torch.stack([b["labels"] for b in batch], dim=0),
    }

def verify_label_values(train_csv: str | Path, aspect_columns: list[str], expected_num_classes: int) -> None:
    """Verify that the aspect label columns in the CSV file contain valid class ids"""
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
    """Compute class weights for each aspect to handle class imbalance"""
    weights = []
    total = len(df)
    for col in aspect_columns:
        counts = df[col].value_counts().sort_index()
        w = []
        for c in range(num_classes):
            cnt = int(counts.get(c, 1))
            raw_w = total / (num_classes * cnt)
            w.append(raw_w ** 0.5)
        weights.append(w)
    return torch.tensor(weights, dtype=torch.float32)