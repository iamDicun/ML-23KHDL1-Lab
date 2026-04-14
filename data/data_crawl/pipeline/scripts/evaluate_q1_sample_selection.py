from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
from scipy.stats import chi2_contingency


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
STEP4_DIR = PIPELINE_DIR / "artifacts" / "step4"
EVAL_DIR = PIPELINE_DIR / "artifacts" / "evaluation"

INPUT_HUMAN_FILE = STEP4_DIR / "human_label_v1.csv"
INPUT_REFERENCE_FILE = STEP4_DIR / "relabel_pool_3k_eval_reference.csv"
GROUP_SUMMARY_OUT = EVAL_DIR / "q1_group_error_summary.csv"
PAIRWISE_TEST_OUT = EVAL_DIR / "q1_pairwise_group_tests.csv"
REPORT_OUT = EVAL_DIR / "q1_report.json"

PSEUDO_LABEL_COLUMNS = [
    "vệ sinh_label",
    "đồ ăn thức uống_label",
    "khách sạn_label",
    "vị trí_label",
    "phòng ốc_label",
    "dịch vụ_label",
]

HUMAN_LABEL_COLUMNS = [
    "human_vệ sinh_label",
    "human_đồ ăn thức uống_label",
    "human_khách sạn_label",
    "human_vị trí_label",
    "human_phòng ốc_label",
    "human_dịch vụ_label",
]


def _wilson_interval(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    phat = successes / n
    denom = 1 + z**2 / n
    center = (phat + z**2 / (2 * n)) / denom
    margin = z * math.sqrt((phat * (1 - phat) + z**2 / (4 * n)) / n) / denom
    return (max(0.0, center - margin), min(1.0, center + margin))


def _validate_columns(df: pd.DataFrame) -> None:
    required = set(HUMAN_LABEL_COLUMNS + ["relabel_group", "review_id"])
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")


def _validate_reference_columns(df: pd.DataFrame) -> None:
    required = set(PSEUDO_LABEL_COLUMNS + ["review_id", "relabel_group"])
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns in reference file: {missing}")


def _to_numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for col in columns:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def _build_group_summary(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for group_name, g in df.groupby("relabel_group"):
        sample_errors = int(g["sample_error_flag"].sum())
        sample_n = int(len(g))
        sample_rate = sample_errors / max(sample_n, 1)
        sample_lo, sample_hi = _wilson_interval(sample_errors, sample_n)

        aspect_errors = int(g["aspect_error_count"].sum())
        aspect_n = int(g["aspect_total_count"].sum())
        aspect_rate = aspect_errors / max(aspect_n, 1)
        aspect_lo, aspect_hi = _wilson_interval(aspect_errors, aspect_n)

        rows.append(
            {
                "relabel_group": group_name,
                "sample_count": sample_n,
                "sample_error_count": sample_errors,
                "sample_error_rate": sample_rate,
                "sample_error_rate_ci_low": sample_lo,
                "sample_error_rate_ci_high": sample_hi,
                "aspect_total": aspect_n,
                "aspect_error_count": aspect_errors,
                "aspect_error_rate": aspect_rate,
                "aspect_error_rate_ci_low": aspect_lo,
                "aspect_error_rate_ci_high": aspect_hi,
            }
        )
    return pd.DataFrame(rows).sort_values("sample_error_rate", ascending=False)


def _pairwise_tests(df: pd.DataFrame) -> pd.DataFrame:
    groups = sorted(df["relabel_group"].unique().tolist())
    rows = []

    for i in range(len(groups)):
        for j in range(i + 1, len(groups)):
            g1 = groups[i]
            g2 = groups[j]
            d1 = df[df["relabel_group"] == g1]
            d2 = df[df["relabel_group"] == g2]

            table = [
                [int(d1["sample_error_flag"].sum()), int(len(d1) - d1["sample_error_flag"].sum())],
                [int(d2["sample_error_flag"].sum()), int(len(d2) - d2["sample_error_flag"].sum())],
            ]
            chi2, p_value, _, _ = chi2_contingency(table)

            rows.append(
                {
                    "group_a": g1,
                    "group_b": g2,
                    "chi2": float(chi2),
                    "p_value": float(p_value),
                    "sample_error_rate_a": float(d1["sample_error_flag"].mean()),
                    "sample_error_rate_b": float(d2["sample_error_flag"].mean()),
                }
            )

    return pd.DataFrame(rows).sort_values("p_value")


def main() -> None:
    EVAL_DIR.mkdir(parents=True, exist_ok=True)

    human_df = pd.read_csv(INPUT_HUMAN_FILE)
    ref_df = pd.read_csv(INPUT_REFERENCE_FILE)
    _validate_columns(human_df)
    _validate_reference_columns(ref_df)

    df = human_df.merge(ref_df, on=["review_id", "relabel_group"], how="left")
    df = _to_numeric(df, PSEUDO_LABEL_COLUMNS + HUMAN_LABEL_COLUMNS)

    valid = df.dropna(subset=HUMAN_LABEL_COLUMNS).copy()
    if valid.empty:
        raise ValueError(
            "No human labels found. Fill human_*_label columns in step4 template before running Q1."
        )

    pseudo = valid[PSEUDO_LABEL_COLUMNS].to_numpy()
    human = valid[HUMAN_LABEL_COLUMNS].to_numpy()

    mismatch = pseudo != human
    valid["aspect_error_count"] = mismatch.sum(axis=1)
    valid["aspect_total_count"] = len(PSEUDO_LABEL_COLUMNS)
    valid["sample_error_flag"] = (valid["aspect_error_count"] > 0).astype(int)

    group_summary = _build_group_summary(valid)
    pairwise = _pairwise_tests(valid)

    group_summary.to_csv(GROUP_SUMMARY_OUT, index=False)
    pairwise.to_csv(PAIRWISE_TEST_OUT, index=False)

    report = {
        "input_file": str(INPUT_HUMAN_FILE),
        "reference_file": str(INPUT_REFERENCE_FILE),
        "labeled_rows_used": int(len(valid)),
        "group_error_summary_file": str(GROUP_SUMMARY_OUT),
        "pairwise_test_file": str(PAIRWISE_TEST_OUT),
    }

    with REPORT_OUT.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("Q1 evaluation completed")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
