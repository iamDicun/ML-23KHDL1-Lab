from __future__ import annotations

from pathlib import Path

# This file: src/scrapy_data/paths.py → parents[2] = repository root
REPO_ROOT: Path = Path(__file__).resolve().parents[2]
DATA_DIR: Path = REPO_ROOT / "data"
DATA_RAW: Path = DATA_DIR / "raw"
DATA_CLEANED: Path = DATA_DIR / "cleaned"

HOTEL_URLS_JSON: str = str(DATA_RAW / "hotel_urls.json")
# Written by metadata crawl (alongside JSON) and optional EDA input
HOTEL_URLS_CSV_RAW: str = str(DATA_RAW / "hotel_urls.csv")
# Written by metadata EDA notebook after filtering (preferred input for review crawler if present)
HOTEL_URLS_CSV_CLEANED: str = str(DATA_CLEANED / "hotel_urls.csv")
REVIEWS_OUTPUT_CSV: str = str(DATA_RAW / "reviews_output.csv")
REVIEWS_RAW_DIR: str = str(DATA_RAW / "reviews_raw")
