from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent

STEP1_BEST = PIPELINE_DIR / "artifacts" / "step1" / "step1_best_threshold.json"
STEP2_SCORED = PIPELINE_DIR / "artifacts" / "step2" / "output_results_scored_step2.csv"
STEP2_FILTERED = PIPELINE_DIR / "artifacts" / "step2" / "output_results_filtered_step2.csv"
STEP2_REMOVED = PIPELINE_DIR / "artifacts" / "step2" / "output_results_removed_step2.csv"

ARTIFACT_DIR = PIPELINE_DIR / "artifacts" / "step3"
STEP3_SCORED = ARTIFACT_DIR / "output_results_scored_step3.csv"
STEP3_FILTERED = ARTIFACT_DIR / "output_results_filtered_step3.csv"
STEP3_REMOVED = ARTIFACT_DIR / "output_results_removed_step3.csv"
STEP3_SUMMARY = ARTIFACT_DIR / "step3_filter_summary.json"
RELABEL_POOL_OUT = ARTIFACT_DIR / "relabel_pool_3k_step3.csv"
RELABEL_SUMMARY_OUT = ARTIFACT_DIR / "relabel_pool_3k_summary.json"

TEXT_COLUMN = "Review"

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

RANDOM_STATE = 42
TARGET_RELABEL_SIZE = 3000

HARD_RATIO = 0.70
MEDIUM_RATIO = 0.20
RANDOM_RATIO = 0.10

HARD_CONF_MEAN_LOW = 0.75
HARD_CONF_MEAN_HIGH = 0.80
MEDIUM_CONF_MEAN_LOW = 0.80
MEDIUM_CONF_MEAN_HIGH = 0.90
LOW_CONF_MIN_CUTOFF = 0.60

MIN_TOKEN_COUNT = 4
MIN_CHAR_COUNT = 15


def _read_threshold() -> float:
    with STEP1_BEST.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    return float(payload["selected_threshold"])


def _to_numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for col in columns:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def _sample_rows(df: pd.DataFrame, n: int, seed_offset: int) -> pd.DataFrame:
    if n <= 0 or df.empty:
        return df.iloc[0:0].copy()
    if len(df) <= n:
        return df.copy()
    return df.sample(n=n, random_state=RANDOM_STATE + seed_offset)


def _allocate_counts(total: int) -> tuple[int, int, int]:
    hard_target = int(total * HARD_RATIO)
    medium_target = int(total * MEDIUM_RATIO)
    random_target = total - hard_target - medium_target
    return hard_target, medium_target, random_target


def _compose_relabel_pool(
    removed_step2: pd.DataFrame,
    removed_step3: pd.DataFrame,
    kept_step3: pd.DataFrame,
    target_size: int,
) -> tuple[pd.DataFrame, dict]:
    removed_union = pd.concat([removed_step2, removed_step3], ignore_index=True)

    hard_pool = removed_union[
        (
            (removed_union["conf_mean"] >= HARD_CONF_MEAN_LOW)
            & (removed_union["conf_mean"] < HARD_CONF_MEAN_HIGH)
        )
        | (removed_union["conf_min"] < LOW_CONF_MIN_CUTOFF)
    ].copy()
    hard_pool["relabel_group"] = "hard"

    medium_pool = removed_union[
        (removed_union["conf_mean"] >= MEDIUM_CONF_MEAN_LOW)
        & (removed_union["conf_mean"] < MEDIUM_CONF_MEAN_HIGH)
    ].copy()
    medium_pool["relabel_group"] = "medium"

    boundary_removed = removed_union[
        (removed_union["conf_mean"] >= HARD_CONF_MEAN_LOW)
        & (removed_union["conf_mean"] < MEDIUM_CONF_MEAN_HIGH)
    ].copy()
    random_pool = pd.concat([boundary_removed, kept_step3], ignore_index=True)
    random_pool["relabel_group"] = "random"

    available_total = len(pd.concat([hard_pool, medium_pool, random_pool], ignore_index=True))
    final_target = min(target_size, available_total)
    hard_target, medium_target, random_target = _allocate_counts(final_target)

    hard_pick = _sample_rows(hard_pool, hard_target, seed_offset=1)
    medium_pick = _sample_rows(medium_pool, medium_target, seed_offset=2)
    random_pick = _sample_rows(random_pool, random_target, seed_offset=3)

    relabel_pool = pd.concat([hard_pick, medium_pick, random_pick], ignore_index=True)
    relabel_pool = relabel_pool.drop_duplicates(subset=["review_id", TEXT_COLUMN], keep="first")

    if len(relabel_pool) < final_target:
        deficit = final_target - len(relabel_pool)
        fallback = pd.concat([removed_union, kept_step3], ignore_index=True)
        fallback = fallback.drop_duplicates(subset=["review_id", TEXT_COLUMN], keep="first")
        fallback = fallback.merge(
            relabel_pool[["review_id", TEXT_COLUMN]],
            on=["review_id", TEXT_COLUMN],
            how="left",
            indicator=True,
        )
        fallback = fallback[fallback["_merge"] == "left_only"].drop(columns=["_merge"])
        fallback["relabel_group"] = "fallback"
        fallback_pick = _sample_rows(fallback, deficit, seed_offset=4)
        relabel_pool = pd.concat([relabel_pool, fallback_pick], ignore_index=True)

    relabel_pool = relabel_pool.sample(frac=1.0, random_state=RANDOM_STATE + 5).reset_index(drop=True)

    group_counts = relabel_pool["relabel_group"].value_counts().to_dict()
    summary = {
        "target_size": target_size,
        "actual_size": int(len(relabel_pool)),
        "hard_target_ratio": HARD_RATIO,
        "medium_target_ratio": MEDIUM_RATIO,
        "random_target_ratio": RANDOM_RATIO,
        "hard_definition": {
            "conf_mean_range": [HARD_CONF_MEAN_LOW, HARD_CONF_MEAN_HIGH],
            "or_conf_min_below": LOW_CONF_MIN_CUTOFF,
        },
        "medium_definition": {"conf_mean_range": [MEDIUM_CONF_MEAN_LOW, MEDIUM_CONF_MEAN_HIGH]},
        "random_definition": "random from boundary removed samples and kept samples",
        "group_counts": {k: int(v) for k, v in group_counts.items()},
    }
    return relabel_pool, summary


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    threshold = _read_threshold()
    step2_scored = pd.read_csv(STEP2_SCORED)
    step2_filtered = pd.read_csv(STEP2_FILTERED)
    step2_removed = pd.read_csv(STEP2_REMOVED)

    step2_filtered = _to_numeric(step2_filtered, PRED_COLUMNS + PROB_COLUMNS)
    step2_filtered = step2_filtered.dropna(subset=PRED_COLUMNS + PROB_COLUMNS)

    rule_df = step2_filtered.copy()
    rule_df["token_count"] = (
        rule_df[TEXT_COLUMN].fillna("").astype(str).str.strip().str.split().str.len()
    )
    rule_df["char_count"] = rule_df[TEXT_COLUMN].fillna("").astype(str).str.strip().str.len()

    rule_df["rule_full_none"] = (rule_df[PRED_COLUMNS] == 0).all(axis=1)
    rule_df["rule_all_same_pos"] = (rule_df[PRED_COLUMNS] == 1).all(axis=1)
    rule_df["rule_all_same_neg"] = (rule_df[PRED_COLUMNS] == 2).all(axis=1)
    rule_df["rule_text_too_short"] = (rule_df["token_count"] < MIN_TOKEN_COUNT) | (
        rule_df["char_count"] < MIN_CHAR_COUNT
    )

    noise_flag_cols = [
        "rule_full_none",
        "rule_all_same_pos",
        "rule_all_same_neg",
        "rule_text_too_short",
    ]
    rule_df["noise_rule_hits"] = rule_df[noise_flag_cols].sum(axis=1)
    rule_df["keep_step3"] = rule_df["noise_rule_hits"] == 0

    kept_step3 = rule_df[rule_df["keep_step3"]].copy()
    removed_step3 = rule_df[~rule_df["keep_step3"]].copy()

    source_lookup = step2_scored[["review_id", TEXT_COLUMN, "conf_mean", "conf_min", "keep_step2"]].copy()
    source_lookup["step2_source"] = source_lookup["keep_step2"].map(
        {True: "step2_kept", False: "step2_removed"}
    )

    kept_step3 = kept_step3.merge(
        source_lookup[["review_id", TEXT_COLUMN, "step2_source"]],
        on=["review_id", TEXT_COLUMN],
        how="left",
    )
    removed_step3 = removed_step3.merge(
        source_lookup[["review_id", TEXT_COLUMN, "step2_source"]],
        on=["review_id", TEXT_COLUMN],
        how="left",
    )
    step2_removed = step2_removed.merge(
        source_lookup[["review_id", TEXT_COLUMN, "step2_source"]],
        on=["review_id", TEXT_COLUMN],
        how="left",
    )

    rule_df.to_csv(STEP3_SCORED, index=False)
    kept_step3.to_csv(STEP3_FILTERED, index=False)
    removed_step3.to_csv(STEP3_REMOVED, index=False)

    relabel_pool, relabel_summary = _compose_relabel_pool(step2_removed, removed_step3, kept_step3, TARGET_RELABEL_SIZE)
    relabel_pool.to_csv(RELABEL_POOL_OUT, index=False)
    with RELABEL_SUMMARY_OUT.open("w", encoding="utf-8") as f:
        json.dump(relabel_summary, f, ensure_ascii=False, indent=2)

    summary = {
        "threshold_reference": threshold,
        "step2_input_rows": int(len(step2_filtered)),
        "step3_kept_rows": int(len(kept_step3)),
        "step3_removed_rows": int(len(removed_step3)),
        "step3_retention_ratio": float(len(kept_step3) / max(len(step2_filtered), 1)),
        "noise_rule_counts": {
            "rule_full_none": int(rule_df["rule_full_none"].sum()),
            "rule_all_same_pos": int(rule_df["rule_all_same_pos"].sum()),
            "rule_all_same_neg": int(rule_df["rule_all_same_neg"].sum()),
            "rule_text_too_short": int(rule_df["rule_text_too_short"].sum()),
        },
        "conf_stats_before": {
            "conf_mean_mean": float(step2_filtered["conf_mean"].mean()),
            "conf_min_mean": float(step2_filtered["conf_min"].mean()),
        },
        "conf_stats_after": {
            "conf_mean_mean": float(kept_step3["conf_mean"].mean()),
            "conf_min_mean": float(kept_step3["conf_min"].mean()),
        },
        "relabel_pool_file": str(RELABEL_POOL_OUT),
        "relabel_summary_file": str(RELABEL_SUMMARY_OUT),
        "removed_step2_rows_preserved": int(len(step2_removed)),
        "removed_step3_rows_preserved": int(len(removed_step3)),
    }

    with STEP3_SUMMARY.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("Step 3 completed")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("Relabel pool summary")
    print(json.dumps(relabel_summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
