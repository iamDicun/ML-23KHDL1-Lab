"""Train ViDeBERTa + adapters + multi-pool + MSD; checkpoint by validation macro-F1"""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
from pathlib import Path
import time
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import f1_score
from torch.optim import AdamW
from torch.utils.data import DataLoader
from tqdm import tqdm
from transformers import AutoTokenizer, get_linear_schedule_with_warmup


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

def macro_f1_from_logits(
    logits: torch.Tensor, labels: torch.Tensor, num_classes: int
) -> tuple[float, np.ndarray]:
    """Calculate macro-F1 score from model logits and true labels"""
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

def _unwrap_model(model: nn.Module) -> ViDeBERTaAspectMSD:
    """Get the underlying ViDeBERTaAspectMSD from a DataParallel wrapper (or return as-is)"""
    if isinstance(model, nn.DataParallel):
        return model.module
    return model


def _encoder_block_index(param_name: str) -> int | None:
    """If the parameter name corresponds to an encoder.layer block, return its index as an integer; otherwise return None"""
    prefix = "encoder.layer."
    if not param_name.startswith(prefix):
        return None
    part = param_name[len(prefix) :].split(".", 1)[0]
    return int(part) if part.isdigit() else None


def build_adamw_param_groups(model: ViDeBERTaAspectMSD, cfg: TrainConfig) -> list[dict[str, Any]]:
    """Heads and lower-block adapters use learning_rate; top-N encoder blocks use encoder_learning_rate"""
    backbone = model.backbone
    n_layers = len(backbone.encoder.layer)
    k = min(max(0, cfg.unfreeze_encoder_layers), n_layers)
    top_from = n_layers - k

    # Separate parameters into three groups:
        # backbone lower blocks: adapters and any unfrozen lower encoder blocks
        # backbone top blocks: any unfrozen top encoder blocks
        # aspect heads: all unfrozen parameters in the aspect heads
    backbone_lower: list[nn.Parameter] = []
    backbone_top: list[nn.Parameter] = []
    for name, p in backbone.named_parameters():
        if not p.requires_grad:
            continue
        idx = _encoder_block_index(name)
        if idx is not None and idx >= top_from:
            backbone_top.append(p)
        else:
            backbone_lower.append(p)

    head_params = [p for p in model.aspect_heads.parameters() if p.requires_grad]

    groups: list[dict[str, Any]] = []
    if backbone_lower:
        groups.append(
            {"params": backbone_lower, "lr": cfg.learning_rate, "weight_decay": cfg.weight_decay}
        )
    if backbone_top:
        groups.append(
            {"params": backbone_top, "lr": cfg.encoder_learning_rate, "weight_decay": cfg.weight_decay}
        )
    if head_params:
        groups.append(
            {"params": head_params, "lr": cfg.learning_rate, "weight_decay": cfg.weight_decay}
        )

    if not groups:
        raise RuntimeError("No trainable parameters")
    return groups


def _maybe_wrap_dp(model: ViDeBERTaAspectMSD, cfg: TrainConfig, device: torch.device) -> nn.Module:
    """Wrap model in DataParallel if multiple GPUs are available and enabled.

    DataParallel approach for Kaggle T4 x2:
    - Splits each batch across available GPUs (batch_size / num_gpus per GPU)
    - Each GPU runs a replica of the model on its sub-batch
    - Gradients are aggregated on GPU 0 before optimizer step
    - Effective batch size stays the same from the user's perspective

    Returns the (possibly wrapped) model.
    """
    n_gpus = torch.cuda.device_count()
    if not cfg.use_multi_gpu or device.type != "cuda" or n_gpus < 2:
        if cfg.use_multi_gpu and device.type == "cuda" and n_gpus < 2:
            logger.info(f"Multi-GPU enabled but only {n_gpus} GPU found — using single GPU")
        return model

    logger.info(f"Wrapping model in DataParallel across {n_gpus} GPUs: {[torch.cuda.get_device_name(i) for i in range(n_gpus)]}")
    return nn.DataParallel(model)


@torch.no_grad()
def evaluate_epoch(model: nn.Module, loader: DataLoader, device: torch.device, num_classes: int):
    """Evaluate the model on the validation set and compute average loss and macro-F1 score across all aspects"""
    model.eval()
    total_loss = 0.0
    n_batches = 0
    all_logits = []
    all_labels = []

    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        # Reuse the model's eval loss so val loss matches training objective.
        labels_batch = batch["labels"]
        out = model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
        )
        logits = out["logits"]  # [B, 6, C]
        b, a, c = logits.shape
        loss = F.cross_entropy(
            logits.reshape(b * a, c),
            labels_batch.reshape(b * a).long()
        )
        if loss is None:
            raise RuntimeError("Expected validation loss when labels are provided")
        # DataParallel returns per-replica losses; average them.
        if loss.dim() > 0:
            loss = loss.mean()
        total_loss += loss.item()
        n_batches += 1
        all_logits.append(logits.cpu())
        all_labels.append(labels_batch.cpu())
    
    logits = torch.cat(all_logits, dim=0)
    labels = torch.cat(all_labels, dim=0)

    macro, per_aspect = macro_f1_from_logits(logits, labels, num_classes)
    avg_loss = total_loss / max(n_batches, 1)

    return avg_loss, macro, per_aspect


def train() -> None:
    """Main training loop for ViDeBERTaAspectMSD with adapters, multi-pool, and MSD branches"""
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
    parser.add_argument("--patience", type=int, default=None, help="Early stopping patience (epochs)")
    parser.add_argument("--amp", action="store_true", help="Enable mixed precision training (CUDA only)")
    parser.add_argument("--no-multi-gpu", action="store_true", help="Disable DataParallel multi-GPU")
    parser.add_argument(
        "--unfreeze-layers",
        type=int,
        default=None,
        help="Unfreeze last N encoder blocks fully (0 = adapters+LayerNorm only)",
    )
    parser.add_argument(
        "--encoder-lr",
        type=float,
        default=None,
        help="AdamW LR for params in unfrozen encoder blocks (discriminative fine-tuning)",
    )
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
    if args.patience is not None:
        cfg.early_stopping_patience = args.patience
    if args.amp:
        cfg.use_amp = True
    if args.no_multi_gpu:
        cfg.use_multi_gpu = False
    if args.unfreeze_layers is not None:
        cfg.unfreeze_encoder_layers = args.unfreeze_layers
    if args.encoder_lr is not None:
        cfg.encoder_learning_rate = args.encoder_lr

    # Set random seeds and device
    set_seed(cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # AMP setup: only effective on CUDA devices
    use_amp = cfg.use_amp and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    if cfg.use_amp and not use_amp:
        logger.warning("AMP requested but no CUDA device available — falling back to FP32")
    if use_amp:
        logger.info("Mixed precision training (AMP) enabled")

    # Check label values in training data
    verify_label_values(cfg.train_csv, ASPECT_LABEL_COLUMNS, cfg.num_classes_per_aspect)

    # Load tokenizer, datasets, and dataloaders
    tokenizer = AutoTokenizer.from_pretrained(cfg.model_name)
    train_df = load_review_frame(cfg.train_csv)
    val_df = load_review_frame(cfg.val_csv)

    # Convert DataFrames to Datasets that PyTorch can use, with tokenization and label tensorization
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

    # Compute class weights for each aspect to address class imbalance, and log them
    class_weights = compute_class_weights(train_df, ASPECT_LABEL_COLUMNS, cfg.num_classes_per_aspect)
    logger.info("Class weights:")
    for name, w in zip(ASPECT_NAMES_EN, class_weights):
        logger.info(f"  {name}: {[f'{x:.3f}' for x in w.tolist()]}")

    # Initialize the model and setup device
    base_model = ViDeBERTaAspectMSD(cfg, class_weights=class_weights).to(device)

    # Wrap in DataParallel if multiple GPUs available
    model = _maybe_wrap_dp(base_model, cfg, device)

    # Build AdamW optimizer with separate parameter groups for backbone and heads, and log the number of trainable parameters and learning rates
    param_groups = build_adamw_param_groups(base_model, cfg)
    opt = AdamW(param_groups)
    trainable: list[nn.Parameter] = []
    for g in param_groups:
        trainable.extend(g["params"])

    # Log the number of trainable parameters and learning rates for different groups
    n_trainable = sum(p.numel() for p in trainable)
    logger.info(f"Trainable parameters: {n_trainable:,}")
    if cfg.unfreeze_encoder_layers > 0:
        n_bl = len(base_model.backbone.encoder.layer)
        logger.info(
            f"Last {min(cfg.unfreeze_encoder_layers, n_bl)} encoder block(s) use lr={cfg.encoder_learning_rate}; "
            f"heads/adapters/lower blocks use lr={cfg.learning_rate}"
        )

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
    patience_counter = 0

    logger.info(f"Early stopping patience: {cfg.early_stopping_patience} epochs")

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

            # Set gradients to zero before backpropagation (set_to_none=True saves memory)
            opt.zero_grad(set_to_none=True)

            # Forward pass with optional AMP autocast
            with torch.amp.autocast("cuda", enabled=use_amp):
                out = model(**batch)
                loss = out["loss"]

            # DataParallel returns per-replica losses; average them to get a single scalar
            if loss.dim() > 0:
                loss = loss.mean()

            # Backward pass with GradScaler (no-op if AMP is disabled)
            scaler.scale(loss).backward()

            # Clip gradients to prevent exploding gradients (unscale first for AMP)
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(trainable, cfg.max_grad_norm)

            # Perform optimization step to update model parameters, and step the learning rate scheduler
            scaler.step(opt)
            scaler.update()
            sched.step()
            # Update running loss and number of steps for progress bar display
            running += loss.item()
            n_steps += 1

            pbar.set_postfix(loss=f"{running / n_steps:.4f}")
        
        # End of epoch: calculate average training loss and time taken, and log them
        epoch_time = time.time() - epoch_start
        avg_train_loss = running / max(n_steps, 1)
        logger.info(f"epoch {epoch+1} train_loss={avg_train_loss:.4f} time={epoch_time:.1f}s ({epoch_time/60:.1f}min)")

        val_loss, macro, per_f1 = evaluate_epoch(model, val_loader, device, cfg.num_classes_per_aspect)
        logger.info(f"val loss={val_loss:.4f} macro-F1={macro:.4f}")
        for name, f1 in zip(ASPECT_NAMES_EN, per_f1):
            logger.info(f"  {name}: {f1:.4f}")

        # If the validation macro-F1 score is the best seen so far, save a checkpoint of the model state and training configuration
        # Always save the unwrapped (base) model state dict so checkpoints are DataParallel-agnostic
        if macro > best_macro:
            best_macro = macro
            patience_counter = 0
            payload = {
                "model_state_dict": _unwrap_model(model).state_dict(),
                "class_weights": class_weights,
                "train_config": train_config_to_saved_dict(cfg, save_dir=cfg.model_dir),
                "tokenizer_name": cfg.model_name,
            }
            torch.save(payload, best_path)
            with open(cfg.model_dir / "train_config.json", "w", encoding="utf-8") as f:
                json.dump(payload["train_config"], f, indent=2, ensure_ascii=False)
            logger.info(f"saved checkpoint macro-F1={macro:.4f} -> {best_path}")
        else:
            patience_counter += 1
            logger.info(f"no improvement ({patience_counter}/{cfg.early_stopping_patience})")
            if patience_counter >= cfg.early_stopping_patience:
                logger.warning(
                    f"Early stopping triggered at epoch {epoch+1}: "
                    f"no improvement for {cfg.early_stopping_patience} epochs. "
                    f"Best macro-F1={best_macro:.4f}"
                )
                break

    logger.info(f"done. best macro-F1={best_macro:.4f}")


if __name__ == "__main__":
    train()
