from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from sklearn.metrics import f1_score


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
DATA_DIR = PIPELINE_DIR.parent
ARTIFACT_DIR = PIPELINE_DIR / "artifacts" / "step1"

INPUT_DEV = DATA_DIR / "output_dev.csv"
SCAN_OUT = ARTIFACT_DIR / "step1_threshold_scan.csv"
BEST_OUT = ARTIFACT_DIR / "step1_best_threshold.json"

TRUE_COLUMNS = [
    "CLEANLINESS",
    "FOOD&DRINKS",
    "HOTEL",
    "LOCATION",
    "ROOMS",
    "SERVICE",
]

PRED_COLUMNS = [
    "vệ sinh_label",
    "đồ ăn thức uống_label",
    "khách sạn_label",
    "vị trí_label",
    "phòng ốc_label",
    "dịch vụ_label",
]

PROB_COLUMNS = [
    "vệ sinh_prob",
    "đồ ăn thức uống_prob",
    "khách sạn_prob",
    "vị trí_prob",
    "phòng ốc_prob",
    "dịch vụ_prob",
]

THRESHOLDS = [0.70, 0.75, 0.80, 0.85]


def _validate_columns(df: pd.DataFrame) -> None:
    required = set(TRUE_COLUMNS + PRED_COLUMNS + PROB_COLUMNS)
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")


def _to_numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    converted = df.copy()
    for col in columns:
        converted[col] = pd.to_numeric(converted[col], errors="coerce")
    return converted


def _evaluate_thresholds(df: pd.DataFrame) -> pd.DataFrame:
    all_metric_columns = TRUE_COLUMNS + PRED_COLUMNS + PROB_COLUMNS
    work = _to_numeric(df, all_metric_columns).dropna(subset=all_metric_columns)

    work["conf_mean"] = work[PROB_COLUMNS].mean(axis=1)
    work["conf_min"] = work[PROB_COLUMNS].min(axis=1)

    rows = []
    total_rows = len(work)

    for threshold in THRESHOLDS:
        subset = work[work["conf_mean"] >= threshold]
        kept = len(subset)

        if kept == 0:
            rows.append(
                {
                    "threshold": threshold,
                    "kept_rows": 0,
                    "kept_ratio": 0.0,
                    "f1_macro": 0.0,
                    "f1_micro": 0.0,
                }
            )
            continue

        y_true = subset[TRUE_COLUMNS].to_numpy().reshape(-1)
        y_pred = subset[PRED_COLUMNS].to_numpy().reshape(-1)

        rows.append(
            {
                "threshold": threshold,
                "kept_rows": kept,
                "kept_ratio": kept / total_rows,
                "f1_macro": f1_score(y_true, y_pred, average="macro", zero_division=0),
                "f1_micro": f1_score(y_true, y_pred, average="micro", zero_division=0),
            }
        )

    return pd.DataFrame(rows)


def _pick_best(scan_df: pd.DataFrame) -> dict:
    ranked = scan_df.sort_values(by=["f1_macro", "threshold"], ascending=[True, True])
    best = ranked.iloc[-1].to_dict()

    return {
        "selected_threshold": float(best["threshold"]),
        "selection_rule": "max f1_macro; if tie choose higher threshold",
        "f1_macro": float(best["f1_macro"]),
        "f1_micro": float(best["f1_micro"]),
        "kept_rows": int(best["kept_rows"]),
        "kept_ratio": float(best["kept_ratio"]),
        "threshold_candidates": THRESHOLDS,
        "input_file": str(INPUT_DEV),
    }


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    dev_df = pd.read_csv(INPUT_DEV)
    _validate_columns(dev_df)

    scan_df = _evaluate_thresholds(dev_df)
    scan_df.to_csv(SCAN_OUT, index=False)

    best = _pick_best(scan_df)
    with BEST_OUT.open("w", encoding="utf-8") as f:
        json.dump(best, f, ensure_ascii=False, indent=2)

    print("Step 1 completed")
    print(scan_df.to_string(index=False))
    print(f"Selected threshold: {best['selected_threshold']}")


if __name__ == "__main__":
    main()
