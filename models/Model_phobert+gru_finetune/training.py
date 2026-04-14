from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer


# ==========================================
# 1. CONFIGURATION
# ==========================================
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "phobert_local"
TRAIN_FILE = BASE_DIR / "data" / "crawl_only_train.csv"
VAL_FILE = BASE_DIR / "data" / "crawl_only_val.csv"
TEST_FILE = BASE_DIR / "data" / "crawl_only_test.csv"
CHECKPOINT_PATH = MODEL_DIR / "best_phobert_gru_ce.pth"

MAX_LEN = 128
BATCH_SIZE = 16
EPOCHS = 5
LEARNING_RATE = 2e-5
GRU_HIDDEN_DIM = 256
MAX_GRAD_NORM = 1.0
SEED = 42
NUM_CLASSES = 3

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
LABEL_COLS = [
    "v\u1ec7 sinh_label",
    "\u0111\u1ed3 \u0103n th\u1ee9c u\u1ed1ng_label",
    "kh\u00e1ch s\u1ea1n_label",
    "v\u1ecb tr\u00ed_label",
    "ph\u00f2ng \u1ed1c_label",
    "d\u1ecbch v\u1ee5_label",
]
NUM_LABELS = len(LABEL_COLS)


def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def validate_csv(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"CSV file not found: {path}")


# ==========================================
# 2. DATASET
# ==========================================
class HotelReviewDataset(Dataset):
    def __init__(self, csv_file: Path, tokenizer, max_len: int):
        validate_csv(csv_file)
        self.data = pd.read_csv(csv_file)

        required_cols = ["Review", *LABEL_COLS]
        missing_cols = [col for col in required_cols if col not in self.data.columns]
        if missing_cols:
            raise ValueError(f"Missing columns in {csv_file}: {missing_cols}")

        self.data = self.data.dropna(subset=required_cols).reset_index(drop=True)
        if len(self.data) == 0:
            raise ValueError(f"No valid rows left after dropping missing values in {csv_file}")

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


# ==========================================
# 3. MODEL
# ==========================================
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


# ==========================================
# 4. TRAINING AND EVALUATION HELPERS
# ==========================================
def compute_loss(logits_list, labels, criterion):
    losses = []
    for head_idx, logits in enumerate(logits_list):
        losses.append(criterion(logits, labels[:, head_idx]))
    return sum(losses) / len(losses)


def predict_classes(logits_list):
    return torch.stack([logits.argmax(dim=-1) for logits in logits_list], dim=1)


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    y_true_flat = y_true.reshape(-1)
    y_pred_flat = y_pred.reshape(-1)

    per_aspect_f1 = []
    for idx in range(NUM_LABELS):
        per_aspect_f1.append(
            f1_score(
                y_true[:, idx],
                y_pred[:, idx],
                average="macro",
                labels=[0, 1, 2],
                zero_division=0,
            )
        )

    return {
        "element_accuracy": float(accuracy_score(y_true_flat, y_pred_flat)),
        "macro_f1": float(
            f1_score(
                y_true_flat,
                y_pred_flat,
                average="macro",
                labels=[0, 1, 2],
                zero_division=0,
            )
        ),
        "mean_aspect_macro_f1": float(np.mean(per_aspect_f1)),
        "exact_match": float(np.all(y_true == y_pred, axis=1).mean()),
        "per_aspect_macro_f1": per_aspect_f1,
    }


def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    total_loss = 0.0

    for batch in tqdm(dataloader, desc="Training"):
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["labels"].to(device)

        optimizer.zero_grad(set_to_none=True)
        logits_list = model(input_ids, attention_mask)
        loss = compute_loss(logits_list, labels, criterion)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), MAX_GRAD_NORM)
        optimizer.step()

        total_loss += loss.item()

    return total_loss / max(len(dataloader), 1)


def eval_model(model, dataloader, criterion, device, mode="Validation"):
    model.eval()
    total_loss = 0.0
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch in tqdm(dataloader, desc=f"Evaluating ({mode})"):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            logits_list = model(input_ids, attention_mask)
            loss = compute_loss(logits_list, labels, criterion)
            total_loss += loss.item()

            preds = predict_classes(logits_list)
            all_preds.append(preds.cpu())
            all_labels.append(labels.cpu())

    y_pred = torch.cat(all_preds, dim=0).numpy()
    y_true = torch.cat(all_labels, dim=0).numpy()
    metrics = compute_metrics(y_true, y_pred)
    avg_loss = total_loss / max(len(dataloader), 1)
    return avg_loss, metrics


def save_checkpoint(path: Path, model: nn.Module, epoch: int, val_loss: float, val_metrics: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "epoch": epoch,
            "val_loss": val_loss,
            "val_metrics": val_metrics,
            "model_config": {
                "model_dir": str(MODEL_DIR),
                "max_len": MAX_LEN,
                "gru_hidden_dim": GRU_HIDDEN_DIM,
                "num_labels": NUM_LABELS,
                "num_classes": NUM_CLASSES,
                "label_cols": LABEL_COLS,
            },
            "model_state_dict": model.state_dict(),
        },
        path,
    )


def load_checkpoint(path: Path, model: nn.Module, map_location: torch.device):
    checkpoint = torch.load(path, map_location=map_location)
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
        return checkpoint

    model.load_state_dict(checkpoint)
    return {"model_state_dict": checkpoint}


# ==========================================
# 5. MAIN
# ==========================================
def main():
    set_seed()

    if not MODEL_DIR.is_dir():
        raise FileNotFoundError(f"PhoBERT folder not found: {MODEL_DIR}")

    print("1. Loading tokenizer and datasets...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)

    train_dataset = HotelReviewDataset(TRAIN_FILE, tokenizer, MAX_LEN)
    val_dataset = HotelReviewDataset(VAL_FILE, tokenizer, MAX_LEN)
    test_dataset = HotelReviewDataset(TEST_FILE, tokenizer, MAX_LEN)

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        pin_memory=torch.cuda.is_available(),
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        pin_memory=torch.cuda.is_available(),
    )

    print("2. Building PhoBERT + BiGRU 6-head model...")
    model = PhoBERTMultiHeadGRU(MODEL_DIR, GRU_HIDDEN_DIM, NUM_LABELS, NUM_CLASSES).to(DEVICE)

    criterion = nn.CrossEntropyLoss()
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE)

    print(f"Training on device: {DEVICE}")
    best_val_score = float("-inf")

    for epoch in range(EPOCHS):
        print(f"\n--- Epoch {epoch + 1}/{EPOCHS} ---")

        train_loss = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
        print(f"Train Loss: {train_loss:.4f}")

        val_loss, val_metrics = eval_model(model, val_loader, criterion, DEVICE, mode="Validation")
        print(
            "Val Loss: "
            f"{val_loss:.4f} | "
            f"Val Acc: {val_metrics['element_accuracy']:.4f} | "
            f"Val Macro-F1: {val_metrics['macro_f1']:.4f} | "
            f"Val Mean-aspect F1: {val_metrics['mean_aspect_macro_f1']:.4f} | "
            f"Val Exact-match: {val_metrics['exact_match']:.4f}"
        )

        if val_metrics["mean_aspect_macro_f1"] > best_val_score:
            best_val_score = val_metrics["mean_aspect_macro_f1"]
            save_checkpoint(CHECKPOINT_PATH, model, epoch + 1, val_loss, val_metrics)
            print(f">> Saved best checkpoint to {CHECKPOINT_PATH}")

    print("\n3. Final evaluation on test split...")
    if not CHECKPOINT_PATH.is_file():
        raise FileNotFoundError(f"Best checkpoint was not saved: {CHECKPOINT_PATH}")

    checkpoint = load_checkpoint(CHECKPOINT_PATH, model, DEVICE)
    if isinstance(checkpoint, dict) and "epoch" in checkpoint:
        print(
            f"Loaded checkpoint from epoch {checkpoint['epoch']} "
            f"(val mean-aspect F1: {checkpoint.get('val_metrics', {}).get('mean_aspect_macro_f1', float('nan')):.4f})"
        )

    test_loss, test_metrics = eval_model(model, test_loader, criterion, DEVICE, mode="Test")
    print(
        "Test Loss: "
        f"{test_loss:.4f} | "
        f"Test Acc: {test_metrics['element_accuracy']:.4f} | "
        f"Test Macro-F1: {test_metrics['macro_f1']:.4f} | "
        f"Test Mean-aspect F1: {test_metrics['mean_aspect_macro_f1']:.4f} | "
        f"Test Exact-match: {test_metrics['exact_match']:.4f}"
    )

    print("\nPer-aspect macro-F1 on test:")
    for label_name, score in zip(LABEL_COLS, test_metrics["per_aspect_macro_f1"]):
        print(f"- {label_name}: {score:.4f}")

    print("Done.")


if __name__ == "__main__":
    main()
