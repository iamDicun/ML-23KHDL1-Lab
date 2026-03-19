import argparse
import json
import os
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup

ASPECT_COLUMNS = [
    "FACILITIES",
    "FOOD&DRINKS",
    "HOTEL",
    "LOCATION",
    "ROOMS",
    "SERVICE",
]


@dataclass
class TrainConfig:
    model_name: str
    train_path: str
    dev_path: str
    output_dir: str
    text_col: str
    max_len: int
    batch_size: int
    epochs: int
    lr: float
    weight_decay: float
    warmup_ratio: float
    num_labels: int
    val_ratio: float
    seed: int
    grad_accum_steps: int
    use_gradient_checkpointing: bool
    freeze_backbone: bool
    adamw_foreach: bool


class ReviewDataset(Dataset):
    def __init__(
        self,
        dataframe: pd.DataFrame,
        tokenizer: AutoTokenizer,
        text_col: str,
        aspect_cols: List[str],
        max_len: int,
    ):
        self.df = dataframe.reset_index(drop=True)
        self.tokenizer = tokenizer
        self.text_col = text_col
        self.aspect_cols = aspect_cols
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        row = self.df.iloc[idx]
        text = str(row[self.text_col])
        encoded = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=self.max_len,
            return_tensors="pt",
        )
        labels = torch.tensor(
            [int(row[col]) for col in self.aspect_cols], dtype=torch.long
        )

        return {
            "input_ids": encoded["input_ids"].squeeze(0),
            "attention_mask": encoded["attention_mask"].squeeze(0),
            "labels": labels,
        }


class PhoBERTMultiTask(nn.Module):
    def __init__(
        self,
        model_name: str,
        num_aspects: int,
        num_labels: int,
        dropout: float,
        use_gradient_checkpointing: bool,
        freeze_backbone: bool,
    ):
        super().__init__()
        self.backbone = AutoModel.from_pretrained(model_name)
        if use_gradient_checkpointing:
            self.backbone.gradient_checkpointing_enable()
        if freeze_backbone:
            for param in self.backbone.parameters():
                param.requires_grad = False
        hidden_size = self.backbone.config.hidden_size
        self.dropout = nn.Dropout(dropout)
        self.heads = nn.ModuleList(
            [nn.Linear(hidden_size, num_labels) for _ in range(num_aspects)]
        )

    def forward(
        self, input_ids: torch.Tensor, attention_mask: torch.Tensor
    ) -> List[torch.Tensor]:
        outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        cls_embed = outputs.last_hidden_state[:, 0, :]
        cls_embed = self.dropout(cls_embed)
        return [head(cls_embed) for head in self.heads]


def parse_args() -> TrainConfig:
    parser = argparse.ArgumentParser("Train Model 1 (teacher) for multi-task aspect labels")
    parser.add_argument(
        "--train-path",
        type=str,
        default="data/dataset/final_processed_1-VLSP2018-SA-Hotel-train.csv",
    )
    parser.add_argument(
        "--dev-path",
        type=str,
        default="data/dataset/final_processed_2-VLSP2018-SA-Hotel-dev.csv",
        help="Optional dev file. If missing, script splits train set into train/val.",
    )
    parser.add_argument("--output-dir", type=str, default="models/model_1_teacher/artifacts")
    parser.add_argument("--model-name", type=str, default="vinai/phobert-base")
    parser.add_argument("--text-col", type=str, default="Review")
    parser.add_argument("--max-len", type=int, default=256)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--warmup-ratio", type=float, default=0.1)
    parser.add_argument("--num-labels", type=int, default=5)
    parser.add_argument("--val-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--grad-accum-steps", type=int, default=1)
    parser.add_argument(
        "--use-gradient-checkpointing",
        action="store_true",
        help="Enable gradient checkpointing to reduce GPU memory usage.",
    )
    parser.add_argument(
        "--freeze-backbone",
        action="store_true",
        help="Freeze PhoBERT backbone and train only task heads (very low VRAM mode).",
    )
    parser.add_argument(
        "--adamw-foreach",
        action="store_true",
        help="Enable foreach implementation in AdamW. Keep disabled on low VRAM GPUs.",
    )

    args = parser.parse_args()
    return TrainConfig(
        model_name=args.model_name,
        train_path=args.train_path,
        dev_path=args.dev_path,
        output_dir=args.output_dir,
        text_col=args.text_col,
        max_len=args.max_len,
        batch_size=args.batch_size,
        epochs=args.epochs,
        lr=args.lr,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        num_labels=args.num_labels,
        val_ratio=args.val_ratio,
        seed=args.seed,
        grad_accum_steps=args.grad_accum_steps,
        use_gradient_checkpointing=args.use_gradient_checkpointing,
        freeze_backbone=args.freeze_backbone,
        adamw_foreach=args.adamw_foreach,
    )


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def read_csv_flexible(path: str) -> pd.DataFrame:
    encodings = ["utf-8-sig", "utf-8", "cp1252", "latin-1"]
    last_error = None

    for enc in encodings:
        try:
            return pd.read_csv(path, encoding=enc, on_bad_lines="skip", engine="python")
        except Exception as err:
            last_error = err

    raise RuntimeError(f"Cannot read CSV file: {path}. Last error: {last_error}")


def validate_dataframe(df: pd.DataFrame, text_col: str) -> pd.DataFrame:
    required = [text_col] + ASPECT_COLUMNS
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    out = df[required].copy()
    out[text_col] = out[text_col].astype(str).str.strip()
    out = out[out[text_col].str.len() > 0]

    for col in ASPECT_COLUMNS:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out.dropna(subset=ASPECT_COLUMNS)

    for col in ASPECT_COLUMNS:
        out[col] = out[col].astype(int)

    return out.reset_index(drop=True)


def load_train_dev(config: TrainConfig) -> Tuple[pd.DataFrame, pd.DataFrame]:
    train_df = validate_dataframe(read_csv_flexible(config.train_path), config.text_col)

    if config.dev_path and os.path.exists(config.dev_path):
        dev_df = validate_dataframe(read_csv_flexible(config.dev_path), config.text_col)
        return train_df, dev_df

    # Fallback split if no dev set is provided.
    val_size = max(1, int(len(train_df) * config.val_ratio))
    shuffled = train_df.sample(frac=1.0, random_state=config.seed).reset_index(drop=True)
    dev_df = shuffled.iloc[:val_size].copy()
    train_df = shuffled.iloc[val_size:].copy()

    return train_df, dev_df


def compute_loss(
    logits_list: List[torch.Tensor], labels: torch.Tensor, criterion: nn.Module
) -> torch.Tensor:
    total_loss = 0.0
    for i, logits in enumerate(logits_list):
        total_loss = total_loss + criterion(logits, labels[:, i])
    return total_loss


def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    device: torch.device,
    aspect_cols: List[str],
    criterion: nn.Module,
) -> Dict[str, float]:
    model.eval()
    losses = []
    preds_all: List[List[int]] = [[] for _ in aspect_cols]
    labels_all: List[List[int]] = [[] for _ in aspect_cols]

    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            logits_list = model(input_ids=input_ids, attention_mask=attention_mask)
            loss = compute_loss(logits_list, labels, criterion)
            losses.append(loss.item())

            for i, logits in enumerate(logits_list):
                preds = torch.argmax(logits, dim=-1).cpu().tolist()
                gold = labels[:, i].cpu().tolist()
                preds_all[i].extend(preds)
                labels_all[i].extend(gold)

    metrics: Dict[str, float] = {
        "val_loss": float(np.mean(losses)) if losses else 0.0,
    }

    macro_f1s = []
    for i, aspect in enumerate(aspect_cols):
        aspect_f1 = f1_score(labels_all[i], preds_all[i], average="macro", zero_division=0)
        aspect_acc = accuracy_score(labels_all[i], preds_all[i])
        metrics[f"{aspect}_macro_f1"] = float(aspect_f1)
        metrics[f"{aspect}_acc"] = float(aspect_acc)
        macro_f1s.append(aspect_f1)

    metrics["mean_macro_f1"] = float(np.mean(macro_f1s)) if macro_f1s else 0.0
    return metrics


def train(config: TrainConfig) -> None:
    seed_everything(config.seed)

    output_dir = Path(config.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    tokenizer_dir = output_dir / "tokenizer"

    train_df, dev_df = load_train_dev(config)

    tokenizer = AutoTokenizer.from_pretrained(config.model_name)
    train_dataset = ReviewDataset(
        train_df, tokenizer, config.text_col, ASPECT_COLUMNS, config.max_len
    )
    dev_dataset = ReviewDataset(
        dev_df, tokenizer, config.text_col, ASPECT_COLUMNS, config.max_len
    )

    train_loader = DataLoader(train_dataset, batch_size=config.batch_size, shuffle=True)
    dev_loader = DataLoader(dev_dataset, batch_size=config.batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = PhoBERTMultiTask(
        model_name=config.model_name,
        num_aspects=len(ASPECT_COLUMNS),
        num_labels=config.num_labels,
        dropout=0.2,
        use_gradient_checkpointing=config.use_gradient_checkpointing,
        freeze_backbone=config.freeze_backbone,
    ).to(device)

    optimizer = AdamW(
        model.parameters(),
        lr=config.lr,
        weight_decay=config.weight_decay,
        foreach=config.adamw_foreach,
    )
    criterion = nn.CrossEntropyLoss()

    total_steps = len(train_loader) * config.epochs
    warmup_steps = int(total_steps * config.warmup_ratio)
    scheduler = get_linear_schedule_with_warmup(
        optimizer=optimizer,
        num_warmup_steps=warmup_steps,
        num_training_steps=total_steps,
    )

    use_amp = device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best_score = -1.0
    log_path = output_dir / "train_log.jsonl"

    print("Training config:")
    print(json.dumps(asdict(config), indent=2))
    print(f"Device: {device}")
    print(f"Train size: {len(train_dataset)}, Dev size: {len(dev_dataset)}")

    for epoch in range(1, config.epochs + 1):
        model.train()
        epoch_losses = []
        optimizer.zero_grad(set_to_none=True)

        progress = tqdm(train_loader, desc=f"Epoch {epoch}/{config.epochs}")
        total_batches = len(train_loader)

        for step, batch in enumerate(progress, start=1):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            with torch.autocast(device_type=device.type, enabled=use_amp):
                logits_list = model(input_ids=input_ids, attention_mask=attention_mask)
                raw_loss = compute_loss(logits_list, labels, criterion)
                loss = raw_loss / max(config.grad_accum_steps, 1)

            scaler.scale(loss).backward()

            if step % config.grad_accum_steps == 0 or step == total_batches:
                scaler.step(optimizer)
                scaler.update()
                scheduler.step()
                optimizer.zero_grad(set_to_none=True)

            epoch_losses.append(raw_loss.item())
            progress.set_postfix(loss=f"{raw_loss.item():.4f}")

        train_loss = float(np.mean(epoch_losses)) if epoch_losses else 0.0
        val_metrics = evaluate(model, dev_loader, device, ASPECT_COLUMNS, criterion)

        row = {
            "epoch": epoch,
            "train_loss": train_loss,
            **val_metrics,
        }

        with log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

        print(json.dumps(row, ensure_ascii=False, indent=2))

        if val_metrics["mean_macro_f1"] > best_score:
            best_score = val_metrics["mean_macro_f1"]
            checkpoint = {
                "state_dict": model.state_dict(),
                "config": asdict(config),
                "aspects": ASPECT_COLUMNS,
                "best_metrics": val_metrics,
            }
            torch.save(checkpoint, output_dir / "best_model.pt")
            tokenizer.save_pretrained(tokenizer_dir)
            with (output_dir / "best_metrics.json").open("w", encoding="utf-8") as f:
                json.dump(val_metrics, f, ensure_ascii=False, indent=2)

            print(f"Saved new best checkpoint (mean_macro_f1={best_score:.4f})")

    print("Training completed.")
    print(f"Best mean_macro_f1: {best_score:.4f}")
    print(f"Artifacts stored in: {output_dir}")


if __name__ == "__main__":
    cfg = parse_args()
    train(cfg)
