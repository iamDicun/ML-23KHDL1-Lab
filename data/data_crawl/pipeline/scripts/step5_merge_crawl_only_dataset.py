from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
STEP3_DIR = PIPELINE_DIR / "artifacts" / "step3"
STEP4_DIR = PIPELINE_DIR / "artifacts" / "step4"
FINAL_DIR = PIPELINE_DIR / "artifacts" / "final"
DATA_CRAWL_DIR = PIPELINE_DIR.parent

PSEUDO_FILE = STEP3_DIR / "output_results_filtered_step3.csv"
HUMAN_FILE = STEP4_DIR / "human_label_v1.csv"
RAW_OUTPUT_FILE = DATA_CRAWL_DIR / "output_results.csv"

MERGED_OUT = FINAL_DIR / "crawl_only_merged_full.csv"
TRAIN_OUT = FINAL_DIR / "crawl_only_train.csv"
VAL_OUT = FINAL_DIR / "crawl_only_val.csv"
TEST_OUT = FINAL_DIR / "crawl_only_test.csv"
SUMMARY_OUT = FINAL_DIR / "crawl_only_merge_summary.json"

RANDOM_STATE = 42

ASPECTS = [
    "vệ sinh",
    "đồ ăn thức uống",
    "khách sạn",
    "vị trí",
    "phòng ốc",
    "dịch vụ",
]

PSEUDO_LABEL_COLS = [f"{a}_label" for a in ASPECTS]
HUMAN_LABEL_COLS = [f"human_{a}_label" for a in ASPECTS]
FINAL_COLS = ["review_id", "Review", "rating", *PSEUDO_LABEL_COLS]


def _make_strata(df: pd.DataFrame) -> pd.Series:
    sig = df[PSEUDO_LABEL_COLS].astype(str).agg("_".join, axis=1)
    counts = sig.value_counts()
    return sig.where(sig.map(counts) >= 3, "__RARE__")


def _safe_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    strata = _make_strata(df)

    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=RANDOM_STATE,
        shuffle=True,
        stratify=strata,
    )

    temp_strata = _make_strata(temp_df)
    val_df, test_df = train_test_split(
        temp_df,
        test_size=(1.0 / 3.0),
        random_state=RANDOM_STATE,
        shuffle=True,
        stratify=temp_strata,
    )

    return (
        train_df.sort_values("review_id").reset_index(drop=True),
        val_df.sort_values("review_id").reset_index(drop=True),
        test_df.sort_values("review_id").reset_index(drop=True),
    )


def main() -> None:
    FINAL_DIR.mkdir(parents=True, exist_ok=True)

    pseudo = pd.read_csv(PSEUDO_FILE)
    human = pd.read_csv(HUMAN_FILE)
    raw_output = pd.read_csv(RAW_OUTPUT_FILE)

    pseudo["review_id"] = pseudo["review_id"].astype(str)
    human["review_id"] = human["review_id"].astype(str)
    raw_output["review_id"] = raw_output["review_id"].astype(str)

    rating_lookup = (
        raw_output[["review_id", "rating"]]
        .dropna(subset=["rating"])
        .drop_duplicates(subset=["review_id"], keep="first")
        .set_index("review_id")["rating"]
    )

    human = human.drop_duplicates(subset=["review_id"], keep="last").copy()

    # Build a merge frame from human labels renamed to pseudo label columns.
    human_map = human[["review_id", "Review", *HUMAN_LABEL_COLS, "relabel_group"]].copy()
    rename_map = {h: p for h, p in zip(HUMAN_LABEL_COLS, PSEUDO_LABEL_COLS)}
    human_map = human_map.rename(columns=rename_map)

    pseudo_base = pseudo.copy()
    pseudo_base["label_source"] = "pseudo_step3_clean"

    # Override pseudo labels when the same review_id was human-labeled.
    merged = pseudo_base.merge(
        human_map[["review_id", *PSEUDO_LABEL_COLS, "relabel_group"]],
        on="review_id",
        how="left",
        suffixes=("", "_human"),
    )

    for col in PSEUDO_LABEL_COLS:
        human_col = f"{col}_human"
        has_human = merged[human_col].notna()
        merged.loc[has_human, col] = merged.loc[has_human, human_col].astype(int)
        merged = merged.drop(columns=[human_col])

    has_override = merged["relabel_group"].notna()
    merged.loc[has_override, "label_source"] = "human_override"

    # Add human-labeled rows not present in pseudo_step3_clean.
    missing_human = human_map[~human_map["review_id"].isin(merged["review_id"])].copy()
    if not missing_human.empty:
        missing_human["hotel_id"] = pd.NA
        missing_human["rating"] = pd.NA
        for col in [
            "vệ sinh_prob",
            "đồ ăn thức uống_prob",
            "khách sạn_prob",
            "vị trí_prob",
            "phòng ốc_prob",
            "dịch vụ_prob",
            "conf_mean",
            "conf_min",
            "keep_step2",
            "token_count",
            "char_count",
            "rule_full_none",
            "rule_all_same_pos",
            "rule_all_same_neg",
            "rule_text_too_short",
            "noise_rule_hits",
            "keep_step3",
            "step2_source",
        ]:
            if col in merged.columns and col not in missing_human.columns:
                missing_human[col] = pd.NA

        missing_human["label_source"] = "human_only"

        # Align columns before concat.
        for col in merged.columns:
            if col not in missing_human.columns:
                missing_human[col] = pd.NA
        missing_human = missing_human[merged.columns]
        merged = pd.concat([merged, missing_human], ignore_index=True)

    merged = merged.drop_duplicates(subset=["review_id"], keep="last").copy()
    merged = merged[merged[PSEUDO_LABEL_COLS].notna().all(axis=1)].copy()

    # Backfill missing rating (mostly from human_only rows) using original model output.
    merged["rating"] = pd.to_numeric(merged["rating"], errors="coerce")
    missing_rating_mask = merged["rating"].isna()
    if missing_rating_mask.any():
        merged.loc[missing_rating_mask, "rating"] = (
            merged.loc[missing_rating_mask, "review_id"].map(rating_lookup)
        )

    merged[PSEUDO_LABEL_COLS] = merged[PSEUDO_LABEL_COLS].astype(int)

    merged = merged.sort_values("review_id").reset_index(drop=True)

    # Final dataset keeps only id/review/rating/aspect labels as requested.
    merged = merged[FINAL_COLS].copy()
    merged.to_csv(MERGED_OUT, index=False)

    train_df, val_df, test_df = _safe_split(merged)
    train_df.to_csv(TRAIN_OUT, index=False)
    val_df.to_csv(VAL_OUT, index=False)
    test_df.to_csv(TEST_OUT, index=False)

    summary = {
        "input_pseudo": str(PSEUDO_FILE),
        "input_human": str(HUMAN_FILE),
        "output_full": str(MERGED_OUT),
        "output_train": str(TRAIN_OUT),
        "output_val": str(VAL_OUT),
        "output_test": str(TEST_OUT),
        "rows_full": int(len(merged)),
        "rows_train": int(len(train_df)),
        "rows_val": int(len(val_df)),
        "rows_test": int(len(test_df)),
        "ratios": {
            "train": float(len(train_df) / len(merged)),
            "val": float(len(val_df) / len(merged)),
            "test": float(len(test_df) / len(merged)),
        },
        "final_columns": FINAL_COLS,
    }

    with SUMMARY_OUT.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
