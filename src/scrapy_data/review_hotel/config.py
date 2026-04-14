import random

# =============================================================================
# OUTPUT SETTINGS (anchored to repo root via ../paths.py)
# =============================================================================
import sys
from pathlib import Path

_SCRAPY_ROOT = Path(__file__).resolve().parent.parent
if str(_SCRAPY_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRAPY_ROOT))

import os

from paths import HOTEL_URLS_CSV_CLEANED, HOTEL_URLS_CSV_RAW, REVIEWS_OUTPUT_CSV, REVIEWS_RAW_DIR

# Prefer filtered list from EDA; otherwise URLs from metadata crawl (raw CSV).
HOTEL_URLS_FILE = (
    HOTEL_URLS_CSV_CLEANED if os.path.isfile(HOTEL_URLS_CSV_CLEANED) else HOTEL_URLS_CSV_RAW
)
REVIEWS_OUTPUT_FILE = REVIEWS_OUTPUT_CSV
REVIEWS_CHECKPOINT_DIR = REVIEWS_RAW_DIR

# =============================================================================
# DELAY SETTINGS (Anti-bot)
# =============================================================================
MIN_DELAY = 3  # seconds
MAX_DELAY = 7  # seconds
PAGE_LOAD_DELAY = 4  # seconds after clicking next page

def get_random_delay():
    """Get a random delay between MIN_DELAY and MAX_DELAY"""
    return random.uniform(MIN_DELAY, MAX_DELAY)

# =============================================================================
# USER AGENTS (Rotate to avoid detection)
# =============================================================================
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

def get_random_user_agent():
    """Get a random User-Agent string"""
    return random.choice(USER_AGENTS)

# =============================================================================
# CSS SELECTORS (Fallback strategy - try multiple selectors)
# =============================================================================

# Selectors for review page (based on actual Agoda HTML as of 2026-02)
REVIEW_SELECTORS = {
    "review_section": [
        '#reviewSectionComments',
        'ol[data-element-name="review-comments"]',
        'div[data-element-name="review-section"]',
    ],
    "review_card": [
        'div[data-element-name="review-comment"]',
        'div.Review-comment[data-review-id]',
        'div[class*="Review-comment"][role="group"]',
    ],
    "review_title": [
        'p[data-testid="review-title"]',
        'h3[data-testid="review-title"]',
    ],
    "review_text": [
        'p[data-testid="review-comment"]',
        'p[data-selenium="comment"]',
        'p[data-type="comment"]',
    ],
    "review_rating": [
        'div.Review-comment-leftScore',
        'div[class*="Review-comment-leftScore"]',
    ],
    "next_page_button": [
        'button[data-element-name="review-paginator-next"]',
        '#reviewSectionComments button[data-element-name="review-paginator-next"]',
        'nav[data-element-name="review-paginator-top"] button:last-of-type:not([disabled])',
        'div[data-element-name="review-section"] nav button:last-of-type:not([disabled])',
    ],
    "pagination_info": [
        'nav[data-element-name="review-paginator-top"]',
        'div.Review-paginator',
    ],
    "translate_button": [
        'button.Review-statusBar-translateButton',
        'button[data-selenium="translation-section"]',
    ],
    "translated_title": [
        'div.Review-comment-body--translation p[data-testid="review-title"]',
        'div[data-selenium="translation-section"] p[data-testid="review-title"]',
    ],
    "translated_text": [
        'div.Review-comment-body--translation p[data-testid="review-comment"]',
        'div[data-selenium="translation-section"] p[data-testid="review-comment"]',
        'div.Review-comment-body--translation p[data-type="comment"]',
    ],
    "total_review_count": [
        'span.Review_SummaryContainer_Text',
        'span[class*="Review_SummaryContainer"] span',
        'div.Review-filterSection span[data-selenium="review-sort-select"]',
    ],
}
# =============================================================================
# CHROME OPTIONS
# =============================================================================
# Set to False to show browser window for debugging
HEADLESS_MODE = False  # Change to True for production

def get_chrome_options():
    """Get Chrome options with anti-detection settings"""
    from selenium.webdriver.chrome.options import Options
    
    options = Options()
    
    if HEADLESS_MODE:
        options.add_argument("--headless=new")  # Headless mode
    
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-agent={get_random_user_agent()}")
    
    # Anti-detection
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    
    # Language
    options.add_argument("--lang=vi-VN")
    
    return options
