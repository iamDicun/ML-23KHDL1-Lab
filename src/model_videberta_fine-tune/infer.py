"""Single-review or batch inference (eval mode: no MSD branches, dropout off)."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader, TensorDataset
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


def _load_model(ckpt_path: Path):
    """Load checkpoint, rebuild model, return (model, tokenizer, cfg, device)"""
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

    load_result = model.load_state_dict(state_dict, strict=False)
    if load_result.missing_keys:
        logger.warning(f"Missing keys in checkpoint: {load_result.missing_keys}")
    if load_result.unexpected_keys:
        logger.warning(f"Unexpected keys in checkpoint: {load_result.unexpected_keys}")

    model.eval()
    return model, tokenizer, cfg, device


def _predict_single(model, tokenizer, cfg, device, text: str) -> dict:
    """Run inference on a single review text"""
    enc = tokenizer(
        text,
        max_length=cfg.max_length,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )
    enc = {k: v.to(device) for k, v in enc.items() if k in ("input_ids", "attention_mask")}
    with torch.no_grad():
        out = model(input_ids=enc["input_ids"], attention_mask=enc["attention_mask"])

    logits = out["logits"].squeeze(0)  # [num_aspects, C]
    pred = logits.argmax(dim=-1).cpu().tolist()
    probs = torch.softmax(logits, dim=-1).cpu().numpy()

    result = {}
    for i, name in enumerate(ASPECT_NAMES_EN):
        confidence = float(probs[i].max())
        result[name] = {
            "prediction": int(pred[i]),
            "confidence": round(confidence, 4)
        }
    return result


def _predict_batch(model, tokenizer, cfg, device, texts: list[str], batch_size: int) -> list[dict]:
    """Run inference on a list of review texts using batched DataLoader."""
    encodings = tokenizer(
        texts,
        max_length=cfg.max_length,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )
    dataset = TensorDataset(encodings["input_ids"], encodings["attention_mask"])
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

    all_logits = []
    with torch.no_grad():
        for input_ids, attention_mask in loader:
            input_ids = input_ids.to(device)
            attention_mask = attention_mask.to(device)
            out = model(input_ids=input_ids, attention_mask=attention_mask)
            all_logits.append(out["logits"].cpu())

    logits = torch.cat(all_logits, dim=0)    # [N, num_aspects, C]
    preds = logits.argmax(dim=-1).numpy()     # [N, num_aspects]
    probs = torch.softmax(logits, dim=-1).numpy()  # [N, num_aspects, C]

    results = []
    for n in range(len(texts)):
        result = {}
        for i, name in enumerate(ASPECT_NAMES_EN):
            confidence = float(probs[n, i].max())
            result[name] = {
                "prediction": int(preds[n, i]),
                "confidence": round(confidence, 4)
            }
        results.append(result)
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--text", type=str, help="Single review text")
    group.add_argument("--input-file", type=str, help="Path to text file (one review per line) or CSV with 'Review' column")
    parser.add_argument("--checkpoint", type=str, default=None)
    parser.add_argument("--json", action="store_true", help="Print JSON output only")
    parser.add_argument("--output-file", type=str, default=None, help="Write results to file (default: stdout)")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for batch inference")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[2]
    ckpt_path = Path(args.checkpoint) if args.checkpoint else repo / "models" / "best.pt"

    model, tokenizer, cfg, device = _load_model(ckpt_path)

    # ── Single review inference ──
    if args.text:
        result = _predict_single(model, tokenizer, cfg, device, args.text)
        _output_results([result], [args.text], args.json, args.output_file, single=True)
        return

    # ── Batch inference from file ──
    input_path = Path(args.input_file)
    if not input_path.is_file():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if input_path.suffix.lower() == ".csv":
        import pandas as pd
        df = pd.read_csv(input_path)
        if "Review" not in df.columns:
            raise ValueError(f"CSV must have a 'Review' column, got: {list(df.columns)}")
        texts = df["Review"].astype(str).tolist()
    else:
        texts = [line.strip() for line in input_path.read_text(encoding="utf-8").splitlines() if line.strip()]

    logger.info(f"Loaded {len(texts)} reviews from {input_path}")
    results = _predict_batch(model, tokenizer, cfg, device, texts, args.batch_size)
    _output_results(results, texts, args.json, args.output_file, single=False)


def _output_results(results: list[dict], texts: list[str], as_json: bool, output_file: str | None, single: bool) -> None:
    """Format and write results to stdout or file."""
    lines = []

    if as_json:
        if single:
            lines.append(json.dumps(results[0], ensure_ascii=False))
        else:
            for i, (text, result) in enumerate(zip(texts, results)):
                entry = {"index": i, "text": text[:100], "aspects": result}
                lines.append(json.dumps(entry, ensure_ascii=False))
    else:
        for i, (text, result) in enumerate(zip(texts, results)):
            if not single:
                lines.append(f"--- Review {i+1}: {text[:80]}{'...' if len(text) > 80 else ''} ---")
            for name, scores in result.items():
                lines.append(f"  {name}: class={scores['prediction']} (confidence={scores['confidence']:.4f})")
            if not single:
                lines.append("")

    output = "\n".join(lines)

    if output_file:
        Path(output_file).write_text(output, encoding="utf-8")
        logger.info(f"Results written to {output_file}")
    else:
        if as_json:
            print(output)
        else:
            for line in lines:
                logger.info(line)


if __name__ == "__main__":
    main()
