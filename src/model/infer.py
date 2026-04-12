"""Single-review inference (eval mode: no MSD branches, dropout off)."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import torch
from transformers import AutoTokenizer

_SRC_ROOT = Path(__file__).resolve().parents[1]
if str(_SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(_SRC_ROOT))

from model.config import ASPECT_NAMES_EN, train_config_from_saved_dict
from model.videberta_msd import ViDeBERTaAspectMSD

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", type=str, required=True, help="Review text")
    parser.add_argument("--checkpoint", type=str, default=None)
    parser.add_argument("--json", action="store_true", help="Print JSON line only")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[2]
    ckpt_path = Path(args.checkpoint) if args.checkpoint else repo / "models" / "best.pt"

    # Load checkpoint with validation
    if not ckpt_path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    try:
        payload = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    except TypeError:
        payload = torch.load(ckpt_path, map_location="cpu")

    # Validate required keys
    required_keys = ["model_state_dict", "train_config", "tokenizer_name"]
    missing_keys = [k for k in required_keys if k not in payload]
    if missing_keys:
        raise ValueError(f"Checkpoint missing required keys: {missing_keys}")

    cfg = train_config_from_saved_dict(payload["train_config"], load_dir=ckpt_path.parent)
    tokenizer = AutoTokenizer.from_pretrained(payload.get("tokenizer_name", cfg.model_name))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load class_weights and filter old checkpoint format
    class_weights = payload.get("class_weights")
    model = ViDeBERTaAspectMSD(cfg, class_weights=class_weights).to(device)

    # Filter out "class_weights" from state_dict if it exists (backwards compatibility)
    state_dict = payload["model_state_dict"]
    if "class_weights" in state_dict:
        state_dict = {k: v for k, v in state_dict.items() if k != "class_weights"}

    model.load_state_dict(state_dict, strict=False)
    model.eval()

    enc = tokenizer(
        args.text,
        max_length=cfg.max_length,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )
    enc = {k: v.to(device) for k, v in enc.items()}
    with torch.no_grad():
        out = model(input_ids=enc["input_ids"], attention_mask=enc["attention_mask"])

    logits = out["logits"].squeeze(0)  # [6, 3]
    pred = logits.argmax(dim=-1).cpu().tolist()
    probs = torch.softmax(logits, dim=-1).cpu().numpy()  # [6, 3]

    # Build result with predictions and confidence scores
    result = {}
    for i, name in enumerate(ASPECT_NAMES_EN):
        confidence = float(probs[i].max())
        result[name] = {
            "prediction": int(pred[i]),
            "confidence": round(confidence, 4)
        }

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        logger.info("Inference Results:")
        for name, scores in result.items():
            logger.info(f"  {name}: class={scores['prediction']} (confidence={scores['confidence']:.4f})")


if __name__ == "__main__":
    main()
