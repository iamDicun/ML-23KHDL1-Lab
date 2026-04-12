"""Training and model configuration (paths, hyperparameters, ablation flags)"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
import os

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_CLEANED_DIR = Path(os.getenv("DATA_DIR", REPO_ROOT / "data/cleaned"))
MODEL_DIR = Path(os.getenv("MODEL_DIR", REPO_ROOT / "models"))

# Hugging Face checkpoint: ViDeBERTa v3 (DeBERTa-v2 architecture).
DEFAULT_MODEL_NAME = "Fsoft-AIC/videberta-base"

TEXT_COLUMN = "Review"

# Aspect definitions: (Vietnamese name, English name, label column)
# Single source of truth to prevent mismatch
ASPECTS = [
    ("vệ sinh", "hygiene", "vệ sinh_label"),
    ("đồ ăn thức uống", "food", "đồ ăn thức uống_label"),
    ("khách sạn", "hotel", "khách sạn_label"),
    ("vị trí", "location", "vị trí_label"),
    ("phòng ốc", "room", "phòng ốc_label"),
    ("dịch vụ", "service", "dịch vụ_label"),
]

# Derived from ASPECTS for backwards compatibility
ASPECT_LABEL_COLUMNS = [a[2] for a in ASPECTS]
ASPECT_NAMES_EN = [a[1] for a in ASPECTS]
ASPECT_NAMES_VI = [a[0] for a in ASPECTS]

# Multi-rate MSD dropout probabilities (training only).
MSD_DROPOUT_RATES = (0.05, 0.1, 0.15, 0.2, 0.25)

@dataclass
class TrainConfig:
    """Configuration for training the model"""
    model_name: str = DEFAULT_MODEL_NAME
    train_csv: Path = field(default_factory=lambda: DATA_CLEANED_DIR / "crawl_only_train.csv")
    val_csv: Path = field(default_factory=lambda: DATA_CLEANED_DIR / "crawl_only_val.csv")
    test_csv: Path = field(default_factory=lambda: DATA_CLEANED_DIR / "crawl_only_test.csv")
    model_dir: Path = field(default_factory=lambda: MODEL_DIR)
    max_length: int = 256
    batch_size: int = 32
    num_workers: int = 0
    num_epochs: int = 20
    learning_rate: float = 2e-4
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    max_grad_norm: float = 1.0
    seed: int = 42
    num_classes_per_aspect: int = 3
    adapter_bottleneck_dim: int = 64
    # Fully unfreeze the last N encoder blocks (attention + FFN + adapters there).
    # 0 = adapter + encoder LayerNorm only (previous behavior).
    unfreeze_encoder_layers: int = 0
    # AdamW LR for parameters inside those top-N blocks (discriminative fine-tuning).
    encoder_learning_rate: float = 5e-5

    use_multipool: bool = True
    use_msd: bool = True
    # If use_msd and msd_single_p is not None, repeat this single p five times instead of multi-rate.
    msd_single_p: float | None = None

    # Early stopping: stop training if val macro-F1 does not improve for this many epochs.
    early_stopping_patience: int = 3
    # Mixed precision training (torch.cuda.amp). Only effective on CUDA devices.
    use_amp: bool = False
    # Multi-GPU training via DataParallel. Auto-detected: only activates when >1 GPU available.
    use_multi_gpu: bool = True

    def __post_init__(self) -> None:
        if self.msd_single_p is not None and not (0.0 <= self.msd_single_p < 1.0):
            raise ValueError(f"msd_single_p must be in [0, 1), got {self.msd_single_p}")
        if self.num_workers < 0:
            raise ValueError(f"num_workers must be >= 0, got {self.num_workers}")
        if self.early_stopping_patience < 1:
            raise ValueError(f"early_stopping_patience must be >= 1, got {self.early_stopping_patience}")
        if self.unfreeze_encoder_layers < 0:
            raise ValueError(f"unfreeze_encoder_layers must be >= 0, got {self.unfreeze_encoder_layers}")
        if self.encoder_learning_rate <= 0:
            raise ValueError(f"encoder_learning_rate must be > 0, got {self.encoder_learning_rate}")

    def msd_rates(self) -> tuple[float, ...]:
        if not self.use_msd:
            return (0.0,)
        if self.msd_single_p is not None:
            return (self.msd_single_p,) * len(MSD_DROPOUT_RATES)
        return tuple(MSD_DROPOUT_RATES)


def train_config_to_saved_dict(cfg: TrainConfig, save_dir: Path | None = None) -> dict[str, Any]:
    data = asdict(cfg)
    path_keys = ("train_csv", "val_csv", "test_csv", "model_dir")
    root = save_dir.resolve() if save_dir is not None else None
    path_meta: dict[str, str] = {}

    for path_key in path_keys:
        val = data.get(path_key)
        if not isinstance(val, Path):
            continue

        resolved = val.resolve()
        if root is not None:
            try:
                rel = resolved.relative_to(root)
                data[path_key] = rel.as_posix()
                path_meta[path_key] = "relative"
                continue
            except ValueError:
                pass

        data[path_key] = resolved.as_posix()
        path_meta[path_key] = "absolute"

    if path_meta:
        data["_path_meta"] = path_meta
    return data

# Rebuild TrainConfig from checkpoint JSON / pickled dict (paths may be strings)
def train_config_from_saved_dict(raw: dict[str, Any], load_dir: Path | None = None) -> TrainConfig:
    base = asdict(TrainConfig())
    base.update(raw)
    path_meta = raw.get("_path_meta", {}) if isinstance(raw, dict) else {}
    root = load_dir.resolve() if load_dir is not None else Path.cwd().resolve()

    for path_key in ("train_csv", "val_csv", "test_csv", "model_dir"):
        if not isinstance(base.get(path_key), str):
            continue

        p = Path(base[path_key])
        mode = path_meta.get(path_key)
        if mode == "relative" and not p.is_absolute():
            p = (root / p).resolve()
        base[path_key] = p

    fields = set(TrainConfig.__dataclass_fields__)
    return TrainConfig(**{k: base[k] for k in fields if k in base})
