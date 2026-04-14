from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, f1_score


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
EVAL_DIR = PIPELINE_DIR / "artifacts" / "evaluation"

ASPECT_NAME_MAP = {
    "vệ sinh": "cleanliness",
    "đồ ăn thức uống": "food_drinks",
    "khách sạn": "hotel",
    "vị trí": "location",
    "phòng ốc": "rooms",
    "dịch vụ": "service",
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate Q2/Q3 using files that include review_id and per-aspect *_true/*_pred columns. "
            "Supports single-system audit mode and baseline-vs-enhanced comparison mode."
        )
    )

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--input",
        help="Path to single-system prediction CSV (audit mode)",
    )
    mode.add_argument(
        "--baseline",
        help="Path to baseline prediction CSV (comparison mode; requires --enhanced)",
    )

    parser.add_argument(
        "--enhanced",
        help="Path to enhanced prediction CSV (comparison mode; requires --baseline)",
    )
    parser.add_argument("--output-prefix", default="q2q3", help="Output file prefix")
    return parser.parse_args()


def _infer_aspects(df: pd.DataFrame) -> list[str]:
    aspects = []
    for col in df.columns:
        if col.endswith("_true"):
            base = col[: -len("_true")]
            pred_col = f"{base}_pred"
            if pred_col in df.columns:
                aspects.append(base)
    return sorted(aspects)


def _validate_schema(df: pd.DataFrame, name: str) -> None:
    if "review_id" not in df.columns:
        raise ValueError(f"{name} missing required column: review_id")
    aspects = _infer_aspects(df)
    if not aspects:
        raise ValueError(
            f"{name} has no *_true/*_pred aspect pairs. Expected columns like 'vệ sinh_true', 'vệ sinh_pred'."
        )


def _prepare(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    aspects = _infer_aspects(df)
    numeric_cols = [c for a in aspects for c in (f"{a}_true", f"{a}_pred")]
    out = df.copy()
    for col in numeric_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    out = out.dropna(subset=numeric_cols).copy()
    for col in numeric_cols:
        out[col] = out[col].astype(int)
    return out, aspects


def _flatten_metrics(df: pd.DataFrame, aspects: list[str]) -> dict:
    y_true = np.concatenate([df[f"{a}_true"].to_numpy() for a in aspects])
    y_pred = np.concatenate([df[f"{a}_pred"].to_numpy() for a in aspects])
    return {
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "micro_f1": float(f1_score(y_true, y_pred, average="micro", zero_division=0)),
    }


def _aspect_metrics(df: pd.DataFrame, aspects: list[str]) -> pd.DataFrame:
    rows = []
    for a in aspects:
        y_true = df[f"{a}_true"].to_numpy()
        y_pred = df[f"{a}_pred"].to_numpy()
        rows.append(
            {
                "aspect": a,
                "aspect_slug": ASPECT_NAME_MAP.get(a, a),
                "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
                "micro_f1": float(f1_score(y_true, y_pred, average="micro", zero_division=0)),
            }
        )
    return pd.DataFrame(rows)


def _none_bias_table(df: pd.DataFrame, aspects: list[str]) -> pd.DataFrame:
    rows = []
    for a in aspects:
        y_true = df[f"{a}_true"].to_numpy()
        y_pred = df[f"{a}_pred"].to_numpy()

        true_none = int((y_true == 0).sum())
        pred_none = int((y_pred == 0).sum())
        ratio = pred_none / max(true_none, 1)

        report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
        none_report = report.get("0", {"precision": 0.0, "recall": 0.0, "f1-score": 0.0})

        rows.append(
            {
                "aspect": a,
                "aspect_slug": ASPECT_NAME_MAP.get(a, a),
                "true_none_count": true_none,
                "pred_none_count": pred_none,
                "none_overprediction_ratio": float(ratio),
                "none_precision": float(none_report["precision"]),
                "none_recall": float(none_report["recall"]),
                "none_f1": float(none_report["f1-score"]),
            }
        )
    return pd.DataFrame(rows)


def _compare_tables(base_df: pd.DataFrame, enh_df: pd.DataFrame, key: str, metric_cols: list[str]) -> pd.DataFrame:
    merged = base_df.merge(enh_df, on=key, suffixes=("_baseline", "_enhanced"))
    for metric in metric_cols:
        merged[f"delta_{metric}"] = merged[f"{metric}_enhanced"] - merged[f"{metric}_baseline"]
    return merged


def main() -> None:
    args = _parse_args()
    EVAL_DIR.mkdir(parents=True, exist_ok=True)

    if args.input:
        raw = pd.read_csv(args.input)
        _validate_schema(raw, "input")

        df, aspects = _prepare(raw)
        flat = _flatten_metrics(df, aspects)
        aspect_tbl = _aspect_metrics(df, aspects)
        none_tbl = _none_bias_table(df, aspects)

        prefix = args.output_prefix
        aspect_out = EVAL_DIR / f"{prefix}_q2_aspect_metrics.csv"
        none_out = EVAL_DIR / f"{prefix}_q3_none_bias.csv"
        report_out = EVAL_DIR / f"{prefix}_q2q3_report.json"

        aspect_tbl.to_csv(aspect_out, index=False)
        none_tbl.to_csv(none_out, index=False)

        summary = {
            "mode": "single_system_audit",
            "input_file": str(Path(args.input).resolve()),
            "reviews_used": int(len(df)),
            "q2_overall": {
                "macro_f1": flat["macro_f1"],
                "micro_f1": flat["micro_f1"],
            },
            "q2_aspect_table": str(aspect_out),
            "q3_none_bias_table": str(none_out),
        }

        with report_out.open("w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        print("Q2/Q3 evaluation completed (single-system audit mode)")
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return

    if not args.baseline or not args.enhanced:
        raise ValueError("Comparison mode requires both --baseline and --enhanced")

    base_raw = pd.read_csv(args.baseline)
    enh_raw = pd.read_csv(args.enhanced)
    _validate_schema(base_raw, "baseline")
    _validate_schema(enh_raw, "enhanced")

    base_df, base_aspects = _prepare(base_raw)
    enh_df, enh_aspects = _prepare(enh_raw)
    if set(base_aspects) != set(enh_aspects):
        raise ValueError("Baseline and enhanced have different aspect columns.")

    aspects = sorted(base_aspects)

    common_ids = set(base_df["review_id"]).intersection(set(enh_df["review_id"]))
    base_df = base_df[base_df["review_id"].isin(common_ids)].copy()
    enh_df = enh_df[enh_df["review_id"].isin(common_ids)].copy()

    base_flat = _flatten_metrics(base_df, aspects)
    enh_flat = _flatten_metrics(enh_df, aspects)

    base_aspect = _aspect_metrics(base_df, aspects)
    enh_aspect = _aspect_metrics(enh_df, aspects)
    aspect_cmp = _compare_tables(base_aspect, enh_aspect, "aspect", ["macro_f1", "micro_f1"])

    base_none = _none_bias_table(base_df, aspects)
    enh_none = _none_bias_table(enh_df, aspects)
    none_cmp = _compare_tables(
        base_none,
        enh_none,
        "aspect",
        ["none_overprediction_ratio", "none_precision", "none_recall", "none_f1"],
    )

    prefix = args.output_prefix
    aspect_out = EVAL_DIR / f"{prefix}_q2_aspect_comparison.csv"
    none_out = EVAL_DIR / f"{prefix}_q3_none_bias_comparison.csv"
    report_out = EVAL_DIR / f"{prefix}_q2q3_report.json"

    aspect_cmp.to_csv(aspect_out, index=False)
    none_cmp.to_csv(none_out, index=False)

    summary = {
        "mode": "baseline_vs_enhanced",
        "baseline_file": str(Path(args.baseline).resolve()),
        "enhanced_file": str(Path(args.enhanced).resolve()),
        "common_reviews_used": int(len(common_ids)),
        "q2_overall": {
            "baseline_macro_f1": base_flat["macro_f1"],
            "enhanced_macro_f1": enh_flat["macro_f1"],
            "delta_macro_f1": enh_flat["macro_f1"] - base_flat["macro_f1"],
            "baseline_micro_f1": base_flat["micro_f1"],
            "enhanced_micro_f1": enh_flat["micro_f1"],
            "delta_micro_f1": enh_flat["micro_f1"] - base_flat["micro_f1"],
        },
        "q2_aspect_table": str(aspect_out),
        "q3_none_bias_table": str(none_out),
    }

    with report_out.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("Q2/Q3 evaluation completed (baseline-vs-enhanced mode)")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
