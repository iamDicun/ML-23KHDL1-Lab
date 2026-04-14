from __future__ import annotations

from pathlib import Path

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
STEP3_DIR = PIPELINE_DIR / "artifacts" / "step3"
STEP4_DIR = PIPELINE_DIR / "artifacts" / "step4"

RELABEL_POOL_IN = STEP3_DIR / "relabel_pool_3k_step3.csv"
HUMAN_TEMPLATE_MIN_OUT = STEP4_DIR / "relabel_pool_3k_human_template_minimal.csv"
EVAL_REFERENCE_OUT = STEP4_DIR / "relabel_pool_3k_eval_reference.csv"

ASPECTS = [
    "vệ sinh",
    "đồ ăn thức uống",
    "khách sạn",
    "vị trí",
    "phòng ốc",
    "dịch vụ",
]


def main() -> None:
    STEP4_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(RELABEL_POOL_IN)

    human_df = df[["review_id", "Review", "relabel_group"]].copy()
    for aspect in ASPECTS:
        human_df[f"human_{aspect}_label"] = pd.NA
    human_df["annotator_id"] = ""
    human_df["annotation_note"] = ""

    ref_cols = [
        "review_id",
        "relabel_group",
        "conf_mean",
        "conf_min",
        "vệ sinh_label",
        "đồ ăn thức uống_label",
        "khách sạn_label",
        "vị trí_label",
        "phòng ốc_label",
        "dịch vụ_label",
    ]
    eval_ref_df = df[ref_cols].copy()

    human_df.to_csv(HUMAN_TEMPLATE_MIN_OUT, index=False)
    eval_ref_df.to_csv(EVAL_REFERENCE_OUT, index=False)

    print("Step 4 template completed")
    print(f"Rows: {len(human_df)}")
    print(f"Minimal template: {HUMAN_TEMPLATE_MIN_OUT}")
    print(f"Evaluation reference: {EVAL_REFERENCE_OUT}")


if __name__ == "__main__":
    main()
