"""Train ViDeBERTa + adapters + multi-pool + MSD; checkpoint by validation macro-F1."""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
from pathlib import Path
import time

import numpy as np
import torch
from torch.optim import AdamW
from torch.utils.data import DataLoader
from tqdm import tqdm
from transformers import AutoTokenizer, get_linear_schedule_with_warmup
import torch.nn.functional as F


_SRC_ROOT = Path(__file__).resolve().parents[1]
if str(_SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(_SRC_ROOT))

from model.config import ASPECT_LABEL_COLUMNS, ASPECT_NAMES_EN, TrainConfig, train_config_to_saved_dict
from model.data import AspectReviewDataset, collate_batch, load_review_frame, verify_label_values, compute_class_weights
from model.videberta_msd import ViDeBERTaAspectMSD

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Set random seeds for reproducibility
def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

# Assign macro f1 to avoid imbalance between aspects
def macro_f1_from_logits(
    logits: torch.Tensor, labels: torch.Tensor, num_classes: int
) -> tuple[float, np.ndarray]:
    from sklearn.metrics import f1_score

    # Get predicted class with highest logit for each aspect
    preds = logits.argmax(dim=-1).cpu().numpy()
    # Convert labels to numpy array
    y = labels.cpu().numpy()
    f1s = []

    for a in range(labels.shape[1]):
        f1s.append(
            f1_score(y[:, a], preds[:, a], average="macro", labels=list(range(num_classes)), zero_division=0)
        )
    
    return float(np.mean(f1s)), np.array(f1s, dtype=np.float64)


@torch.no_grad()
def evaluate_epoch(model: ViDeBERTaAspectMSD, loader: DataLoader, device: torch.device, num_classes: int):
    model.eval()
    total_loss = 0.0
    n_batches = 0
    all_logits = []
    all_labels = []

    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        # Tách labels ra, chỉ truyền input để lấy logits
        labels_batch = batch["labels"]
        out = model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
        )
        # Tính unweighted loss thủ công
        logits = out["logits"]  # [B, 6, C]
        b, a, c = logits.shape
        loss = F.cross_entropy(
            logits.reshape(b * a, c),
            labels_batch.reshape(b * a).long()
        )
        total_loss += loss.item()
        n_batches += 1
        all_logits.append(logits)
        all_labels.append(labels_batch)
    
    logits = torch.cat(all_logits, dim=0)
    labels = torch.cat(all_labels, dim=0)

    macro, per_aspect = macro_f1_from_logits(logits, labels, num_classes)
    avg_loss = total_loss / max(n_batches, 1)

    return avg_loss, macro, per_aspect


def train() -> None:
    # Configure training 
    parser = argparse.ArgumentParser()
    parser.add_argument("--train-csv", type=str, default=None)
    parser.add_argument("--val-csv", type=str, default=None)
    parser.add_argument("--model-dir", type=str, default=None)
    parser.add_argument("--model-name", type=str, default=None)
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--lr", type=float, default=None)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--num-workers", type=int, default=None, help="DataLoader workers")
    parser.add_argument("--no-multipool", action="store_true", help="CLS only (ablation A)")
    parser.add_argument("--no-msd", action="store_true", help="Disable MSD branches")
    parser.add_argument("--msd-single-p", type=float, default=None, help="Use one dropout rate x5")
    args = parser.parse_args()

    cfg = TrainConfig()
    if args.train_csv is not None:
        cfg.train_csv = Path(args.train_csv)
    if args.val_csv is not None:
        cfg.val_csv = Path(args.val_csv)
    if args.model_dir is not None:
        cfg.model_dir = Path(args.model_dir)
    if args.model_name:
        cfg.model_name = args.model_name
    if args.epochs is not None:
        cfg.num_epochs = args.epochs
    if args.batch_size is not None:
        cfg.batch_size = args.batch_size
    if args.lr is not None:
        cfg.learning_rate = args.lr
    if args.seed is not None:
        cfg.seed = args.seed
    if args.num_workers is not None:
        cfg.num_workers = args.num_workers
    if args.no_multipool:
        cfg.use_multipool = False
    if args.no_msd:
        cfg.use_msd = False
    if args.msd_single_p is not None:
        cfg.msd_single_p = args.msd_single_p

    # Set random seeds and device
    set_seed(cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Check label values in training data
    verify_label_values(cfg.train_csv, ASPECT_LABEL_COLUMNS, cfg.num_classes_per_aspect)

    # Load tokenizer, datasets, and dataloaders
    tokenizer = AutoTokenizer.from_pretrained(cfg.model_name)
    train_df = load_review_frame(cfg.train_csv)
    val_df = load_review_frame(cfg.val_csv)

    # Covert DataFrames to Datasets that PyTorch can use, with tokenization and label tensorization
    train_ds = AspectReviewDataset(train_df, tokenizer, cfg.max_length)
    val_ds = AspectReviewDataset(val_df, tokenizer, cfg.max_length)

    # Create DataLoaders for batching and shuffling the data during training and validation
    loader_kwargs = {
        "collate_fn": collate_batch,
        "num_workers": cfg.num_workers,
        "pin_memory": torch.cuda.is_available(),
    }
    if cfg.num_workers > 0:
        loader_kwargs["persistent_workers"] = True

    train_loader = DataLoader(
        train_ds,
        batch_size=cfg.batch_size,
        shuffle=True,
        **loader_kwargs,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=cfg.batch_size,
        shuffle=False,
        **loader_kwargs,
    )

    class_weights = compute_class_weights(train_df, ASPECT_LABEL_COLUMNS, cfg.num_classes_per_aspect)
    logger.info("Class weights:")
    for name, w in zip(ASPECT_NAMES_EN, class_weights):
        logger.info(f"  {name}: {[f'{x:.3f}' for x in w.tolist()]}")

    # Initialize the model and setup device
    model = ViDeBERTaAspectMSD(cfg, class_weights=class_weights).to(device)

    # Get trainable parameters
    trainable = [p for p in model.parameters() if p.requires_grad]

    # Setup optimizer
    opt = AdamW(trainable, lr=cfg.learning_rate, weight_decay=cfg.weight_decay)

    # Calculate total training steps
    total_steps = len(train_loader) * cfg.num_epochs

    # Calculate warmup steps for learning rate scheduler
    warmup_steps = int(total_steps * cfg.warmup_ratio)

    # Create scheduler to linearly warm up learning rate from 0 to cfg.learning_rate over warmup_steps, then linearly decay to 0 over the rest of training
    sched = get_linear_schedule_with_warmup(opt, warmup_steps, total_steps)

    # Create directory for saving model checkpoints, and initialize variables for tracking best validation macro-F1 score
    cfg.model_dir.mkdir(parents=True, exist_ok=True)
    best_path = cfg.model_dir / "best.pt"
    best_macro = -1.0

    # Main training loop over epochs
    for epoch in range(cfg.num_epochs):
        # Set model to training mode
        model.train()
        pbar = tqdm(train_loader, desc=f"epoch {epoch + 1}/{cfg.num_epochs}")
        running = 0.0
        n_steps = 0
        epoch_start = time.time()

        # Iterate over batches in the training DataLoader
        for batch in pbar:
            # Move batch tensors to the configured device
            batch = {k: v.to(device) for k, v in batch.items()}

            # Set gradients to zero before backpropagation
            opt.zero_grad()
            # Forward pass through the model to get output logits and loss
            out = model(**batch)
            # Extract loss from the model output; if loss is not None, perform backpropagation and optimization step
            loss = out["loss"]
            loss.backward()

            # Clip gradients to prevent exploding gradients; this modifies the gradients in-place
            torch.nn.utils.clip_grad_norm_(trainable, cfg.max_grad_norm)

            # Perform optimization step to update model parameters, and step the learning rate scheduler
            opt.step()
            sched.step()
            # Update running loss and number of steps for progress bar display
            running += loss.item()
            n_steps += 1

            pbar.set_postfix(loss=f"{running / n_steps:.4f}")
        
        epoch_time = time.time() - epoch_start
        logger.info(f"epoch {epoch+1} training time: {epoch_time:.1f}s ({epoch_time/60:.1f}min)")

        # After each epoch, evaluate the model on the validation set and calculate macro-F1 score
        val_loss, macro, per_f1 = evaluate_epoch(model, val_loader, device, cfg.num_classes_per_aspect)
        logger.info(f"val loss={val_loss:.4f} macro-F1={macro:.4f}")
        for name, f1 in zip(ASPECT_NAMES_EN, per_f1):
            logger.info(f"  {name}: {f1:.4f}")

        # If the validation macro-F1 score is the best seen so far, save a checkpoint of the model state and training configuration
        if macro > best_macro:
            best_macro = macro
            payload = {
                "model_state_dict": model.state_dict(),
                "class_weights": class_weights,
                "train_config": train_config_to_saved_dict(cfg, save_dir=cfg.model_dir),
                "tokenizer_name": cfg.model_name,
            }
            torch.save(payload, best_path)
            with open(cfg.model_dir / "train_config.json", "w", encoding="utf-8") as f:
                json.dump(payload["train_config"], f, indent=2, ensure_ascii=False)
            logger.info(f"saved checkpoint macro-F1={macro:.4f} -> {best_path}")

    logger.info(f"done. best macro-F1={best_macro:.4f}")


if __name__ == "__main__":
    train()
