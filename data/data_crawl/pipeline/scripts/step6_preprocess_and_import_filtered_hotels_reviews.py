from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pandas as pd
from tqdm import tqdm

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError as exc:
    raise SystemExit(
        "Missing dependency: psycopg2-binary. Install with `pip install psycopg2-binary`."
    ) from exc


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
STEP4_DIR = PIPELINE_DIR / "artifacts" / "step4"
DATA_CRAWL_DIR = PIPELINE_DIR.parent
REPO_ROOT = DATA_CRAWL_DIR.parent.parent

PROCESSOR_DIR = REPO_ROOT / "src" / "Model_gan_nhan" / "processors"
if str(PROCESSOR_DIR) not in sys.path:
    sys.path.insert(0, str(PROCESSOR_DIR))

from vietnamese_processor import VietnameseTextPreprocessor  # noqa: E402


HOTELS_INPUT_CANDIDATES = [
    DATA_CRAWL_DIR / "hotels_all_reviews_filtered_out_step2_top10.csv",
    STEP4_DIR / "hotels_all_reviews_filtered_out_step2_top10.csv",
]

REVIEWS_INPUT_CANDIDATES = [
    DATA_CRAWL_DIR / "reviews_all_filtered_out_step2_top10_no_labels.csv",
    STEP4_DIR / "reviews_all_filtered_out_step2_top10_no_labels.csv",
]

SUMMARY_OUT = STEP4_DIR / "import_ai_reuse_summary.json"

REQUIRED_HOTEL_COLUMNS = [
    "hotel_id",
    "hotel_name",
    "total_reviews_in_output_results",
    "removed_reviews_in_step2",
    "kept_reviews_in_step2",
]

REQUIRED_REVIEW_COLUMNS = ["review_id", "hotel_id", "hotel_name", "Review", "rating"]

EXTRA_TEENCODES = {
    "khách sạn": ["ks", "ksan", "ksạn", "hotel"],
    "nhà hàng": ["nhahang", "nh"],
    "nhân viên": ["nv", "nvien", "staff"],
    "phục vụ": ["pv", "service"],
    "cửa hàng": ["store", "sop", "shopE", "shop", "shp"],
    "phòng": ["phong", "room", "p"],
    "tiền": ["xèng", "xu", "cành"],
    "đặt phòng": ["booking", "book"],
    "nhận phòng": ["checkin"],
    "trả phòng": ["checkout"],
    "đánh giá": ["review", "rv", "rate", "rating"],
}

PREPROCESSING_VERSION = "run_process_hygiene_3class"


def thuan_hoa_vs(text: str) -> str:
    if not isinstance(text, str):
        return ""

    text = re.sub(
        r"\b(nhà|dọn|làm|giữ|mất|kém|phòng)\s+vs\b",
        r"\1 vệ sinh",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\bvs\s+(sạch|dơ|kém|phòng|sẽ|an toàn)\b",
        r"vệ sinh \1",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\bvs\b", "với", text, flags=re.IGNORECASE)
    return text


def _resolve_input_file(candidates: list[Path], label: str) -> Path:
    for candidate in candidates:
        if candidate.exists():
            return candidate
    joined = "\n".join(str(path) for path in candidates)
    raise FileNotFoundError(f"Could not find {label} file. Checked:\n{joined}")


def _validate_columns(df: pd.DataFrame, required_cols: list[str], label: str) -> None:
    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in {label}: {missing}")


def _load_backend_env() -> None:
    env_path = REPO_ROOT / "application" / "backend" / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _connect_db():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)

    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")

    missing = [
        key
        for key, value in {
            "DB_HOST": host,
            "DB_PORT": port,
            "DB_NAME": name,
            "DB_USER": user,
            "DB_PASSWORD": password,
        }.items()
        if not value
    ]
    if missing:
        raise ValueError(
            "Missing DB connection variables and DATABASE_URL is empty: " + ", ".join(missing)
        )

    sslmode = os.getenv("DB_SSLMODE")
    if not sslmode:
        sslmode = "disable" if host in {"localhost", "127.0.0.1"} else "require"

    return psycopg2.connect(
        host=host,
        port=port,
        dbname=name,
        user=user,
        password=password,
        sslmode=sslmode,
    )


def _prepare_hotels(hotels_df: pd.DataFrame) -> pd.DataFrame:
    hotels = hotels_df.copy()
    _validate_columns(hotels, REQUIRED_HOTEL_COLUMNS, "hotels")

    hotels = hotels[REQUIRED_HOTEL_COLUMNS].drop_duplicates(subset=["hotel_id"], keep="first")
    hotels["hotel_id"] = pd.to_numeric(hotels["hotel_id"], errors="coerce")
    hotels = hotels.dropna(subset=["hotel_id"]).copy()
    hotels["hotel_id"] = hotels["hotel_id"].astype("int64")

    for col in [
        "total_reviews_in_output_results",
        "removed_reviews_in_step2",
        "kept_reviews_in_step2",
    ]:
        hotels[col] = pd.to_numeric(hotels[col], errors="coerce").fillna(0).astype("int64")

    hotels["hotel_name"] = hotels["hotel_name"].fillna("Unknown hotel").astype(str)

    bad_rows = hotels[hotels["kept_reviews_in_step2"] != 0]
    if not bad_rows.empty:
        raise ValueError(
            "Input hotel list violates strict condition (kept_reviews_in_step2 must be 0)."
        )

    return hotels.reset_index(drop=True)


def _preprocess_reviews(reviews_df: pd.DataFrame) -> pd.DataFrame:
    reviews = reviews_df.copy()
    _validate_columns(reviews, REQUIRED_REVIEW_COLUMNS, "reviews")

    conf_cols = [col for col in ["conf_mean", "conf_min"] if col in reviews.columns]
    if conf_cols:
        reviews = reviews.drop(columns=conf_cols)

    reviews = reviews[REQUIRED_REVIEW_COLUMNS].drop_duplicates(subset=["review_id"], keep="first")
    reviews["review_id"] = pd.to_numeric(reviews["review_id"], errors="coerce")
    reviews["hotel_id"] = pd.to_numeric(reviews["hotel_id"], errors="coerce")
    reviews["rating"] = pd.to_numeric(reviews["rating"], errors="coerce")
    reviews = reviews.dropna(subset=["review_id", "hotel_id"]).copy()
    reviews["review_id"] = reviews["review_id"].astype("int64")
    reviews["hotel_id"] = reviews["hotel_id"].astype("int64")
    reviews["hotel_name"] = reviews["hotel_name"].fillna("Unknown hotel").astype(str)

    raw_reviews = reviews["Review"].fillna("").astype(str).tolist()
    normalized_reviews = [thuan_hoa_vs(text) for text in raw_reviews]

    preprocessor = VietnameseTextPreprocessor(
        vncorenlp_dir=str(PROCESSOR_DIR / "VnCoreNLP"),
        extra_teencodes=EXTRA_TEENCODES,
        max_correction_length=512,
    )

    processed_reviews: list[str] = []
    batch_size = 32
    try:
        for start in tqdm(range(0, len(normalized_reviews), batch_size), desc="Preprocessing"):
            chunk = normalized_reviews[start : start + batch_size]
            processed_chunk = preprocessor.process_batch(chunk, correct_errors=True)
            processed_reviews.extend(processed_chunk)
    finally:
        preprocessor.close_vncorenlp()

    reviews["review_text_raw"] = raw_reviews
    reviews["review_text_processed"] = processed_reviews

    return reviews[[
        "review_id",
        "hotel_id",
        "hotel_name",
        "rating",
        "review_text_raw",
        "review_text_processed",
    ]].reset_index(drop=True)


def _upsert_hotels(cur, hotels: pd.DataFrame) -> None:
    sql = """
        INSERT INTO ai_reuse_hotels (
            source_hotel_id,
            hotel_name,
            total_reviews_in_output_results,
            removed_reviews_in_step2,
            kept_reviews_in_step2
        )
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (source_hotel_id) DO UPDATE SET
            hotel_name = EXCLUDED.hotel_name,
            total_reviews_in_output_results = EXCLUDED.total_reviews_in_output_results,
            removed_reviews_in_step2 = EXCLUDED.removed_reviews_in_step2,
            kept_reviews_in_step2 = EXCLUDED.kept_reviews_in_step2,
            updated_at = NOW()
    """

    records = [
        (
            int(row.hotel_id),
            str(row.hotel_name),
            int(row.total_reviews_in_output_results),
            int(row.removed_reviews_in_step2),
            int(row.kept_reviews_in_step2),
        )
        for row in hotels.itertuples(index=False)
    ]
    execute_batch(cur, sql, records, page_size=100)


def _upsert_reviews(cur, reviews: pd.DataFrame) -> None:
    sql = """
        INSERT INTO ai_reuse_reviews (
            source_review_id,
            source_hotel_id,
            hotel_name,
            rating,
            review_text_raw,
            review_text_processed,
            preprocessing_version
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (source_review_id) DO UPDATE SET
            source_hotel_id = EXCLUDED.source_hotel_id,
            hotel_name = EXCLUDED.hotel_name,
            rating = EXCLUDED.rating,
            review_text_raw = EXCLUDED.review_text_raw,
            review_text_processed = EXCLUDED.review_text_processed,
            preprocessing_version = EXCLUDED.preprocessing_version,
            updated_at = NOW()
    """

    records = [
        (
            int(row.review_id),
            int(row.hotel_id),
            str(row.hotel_name),
            None if pd.isna(row.rating) else float(row.rating),
            str(row.review_text_raw),
            str(row.review_text_processed),
            PREPROCESSING_VERSION,
        )
        for row in reviews.itertuples(index=False)
    ]
    execute_batch(cur, sql, records, page_size=200)


def main() -> None:
    STEP4_DIR.mkdir(parents=True, exist_ok=True)

    hotels_path = _resolve_input_file(HOTELS_INPUT_CANDIDATES, "hotels")
    reviews_path = _resolve_input_file(REVIEWS_INPUT_CANDIDATES, "reviews")

    hotels_df = pd.read_csv(hotels_path)
    reviews_df = pd.read_csv(reviews_path)

    hotels = _prepare_hotels(hotels_df)
    reviews = _preprocess_reviews(reviews_df)

    reviews = reviews[reviews["hotel_id"].isin(set(hotels["hotel_id"]))].copy()

    _load_backend_env()
    conn = _connect_db()
    try:
        with conn:
            with conn.cursor() as cur:
                _upsert_hotels(cur, hotels)
                _upsert_reviews(cur, reviews)
    finally:
        conn.close()

    summary = {
        "hotels_file": str(hotels_path),
        "reviews_file": str(reviews_path),
        "rows_hotels_upserted": int(len(hotels)),
        "rows_reviews_upserted": int(len(reviews)),
        "preprocessing_version": PREPROCESSING_VERSION,
        "db_tables": ["ai_reuse_hotels", "ai_reuse_reviews"],
        "notes": [
            "conf_mean and conf_min are dropped before import",
            "reviews are preprocessed with thuan_hoa_vs + VietnameseTextPreprocessor.process_batch(correct_errors=True)",
        ],
    }

    with SUMMARY_OUT.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()