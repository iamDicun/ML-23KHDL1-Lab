from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
DATA_DIR = PIPELINE_DIR.parent

INPUT_RESULTS = DATA_DIR / "output_results.csv"
BEST_THRESHOLD_FILE = PIPELINE_DIR / "artifacts" / "step1" / "step1_best_threshold.json"

ARTIFACT_DIR = PIPELINE_DIR / "artifacts" / "step2"
SCORED_OUT = ARTIFACT_DIR / "output_results_scored_step2.csv"
FILTERED_OUT = ARTIFACT_DIR / "output_results_filtered_step2.csv"
REMOVED_OUT = ARTIFACT_DIR / "output_results_removed_step2.csv"
SUMMARY_OUT = ARTIFACT_DIR / "step2_filter_summary.json"
LABEL_SHIFT_OUT = ARTIFACT_DIR / "step2_label_shift.csv"

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

CONF_MIN_FLOOR = 0.50


def _validate_columns(df: pd.DataFrame) -> None:
    required = set(PRED_COLUMNS + PROB_COLUMNS)
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")


def _to_numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    converted = df.copy()
    for col in columns:
        converted[col] = pd.to_numeric(converted[col], errors="coerce")
    return converted


def _read_threshold() -> float:
    with BEST_THRESHOLD_FILE.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    return float(payload["selected_threshold"])


def _build_label_shift_table(before_df: pd.DataFrame, after_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for col in PRED_COLUMNS:
        for label_value in sorted(before_df[col].dropna().astype(int).unique().tolist()):
            before_count = int((before_df[col] == label_value).sum())
            after_count = int((after_df[col] == label_value).sum())
            before_ratio = before_count / max(len(before_df), 1)
            after_ratio = after_count / max(len(after_df), 1)
            rows.append(
                {
                    "aspect_label_column": col,
                    "label": label_value,
                    "before_count": before_count,
                    "after_count": after_count,
                    "before_ratio": before_ratio,
                    "after_ratio": after_ratio,
                    "ratio_delta": after_ratio - before_ratio,
                }
            )
    return pd.DataFrame(rows)


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    threshold = _read_threshold()
    raw_df = pd.read_csv(INPUT_RESULTS)
    _validate_columns(raw_df)

    work = _to_numeric(raw_df, PRED_COLUMNS + PROB_COLUMNS)
    work = work.dropna(subset=PROB_COLUMNS)

    work["conf_mean"] = work[PROB_COLUMNS].mean(axis=1)
    work["conf_min"] = work[PROB_COLUMNS].min(axis=1)
    work["keep_step2"] = (work["conf_mean"] >= threshold) & (work["conf_min"] >= CONF_MIN_FLOOR)

    filtered = work[work["keep_step2"]].copy()
    removed = work[~work["keep_step2"]].copy()
    scored = work.copy()

    scored.to_csv(SCORED_OUT, index=False)
    filtered.to_csv(FILTERED_OUT, index=False)
    removed.to_csv(REMOVED_OUT, index=False)

    label_shift = _build_label_shift_table(scored, filtered)
    label_shift.to_csv(LABEL_SHIFT_OUT, index=False)

    summary = {
        "input_file": str(INPUT_RESULTS),
        "threshold_from_step1": threshold,
        "conf_min_floor": CONF_MIN_FLOOR,
        "before_rows": int(len(scored)),
        "after_rows": int(len(filtered)),
        "removed_rows": int(len(scored) - len(filtered)),
        "retention_ratio": float(len(filtered) / max(len(scored), 1)),
        "conf_mean_before": {
            "mean": float(scored["conf_mean"].mean()),
            "median": float(scored["conf_mean"].median()),
            "p25": float(scored["conf_mean"].quantile(0.25)),
            "p75": float(scored["conf_mean"].quantile(0.75)),
        },
        "conf_mean_after": {
            "mean": float(filtered["conf_mean"].mean()),
            "median": float(filtered["conf_mean"].median()),
            "p25": float(filtered["conf_mean"].quantile(0.25)),
            "p75": float(filtered["conf_mean"].quantile(0.75)),
        },
        "conf_min_before": {
            "mean": float(scored["conf_min"].mean()),
            "median": float(scored["conf_min"].median()),
            "p25": float(scored["conf_min"].quantile(0.25)),
            "p75": float(scored["conf_min"].quantile(0.75)),
        },
        "conf_min_after": {
            "mean": float(filtered["conf_min"].mean()),
            "median": float(filtered["conf_min"].median()),
            "p25": float(filtered["conf_min"].quantile(0.25)),
            "p75": float(filtered["conf_min"].quantile(0.75)),
        },
    }

    with SUMMARY_OUT.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("Step 2 completed")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
