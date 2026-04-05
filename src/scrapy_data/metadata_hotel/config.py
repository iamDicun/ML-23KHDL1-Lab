import random

# =============================================================================
# OUTPUT SETTINGS (anchored to repo root via ../paths.py)
# =============================================================================
import sys
from pathlib import Path

_SCRAPY_ROOT = Path(__file__).resolve().parent.parent
if str(_SCRAPY_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRAPY_ROOT))

from paths import HOTEL_URLS_JSON

# JSON is the canonical output from crawl_hotel_urls.py (CSV is written next to it).
HOTEL_URLS_FILE = HOTEL_URLS_JSON

# =============================================================================
# DELAY SETTINGS (Anti-bot)
# =============================================================================
MIN_DELAY = 2  # seconds
MAX_DELAY = 5  # seconds
PAGE_LOAD_DELAY = 3  # seconds after clicking next page

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

# Selectors for hotel list page (search results)
HOTEL_LIST_SELECTORS = {
    "hotel_card": [
        'li[data-selenium="hotel-item"]',  # Main hotel card container
        'div[data-selenium="hotel-item"]',
    ],
    # Hotel name - use data-selenium="hotel-name" link (works for all cards)
    "hotel_name": [
        'a[data-selenium="hotel-name"]',  # Primary - the hotel name link
        'a[data-testid="property-name-link"]',
        'header[data-element-name="property-info-header"] a[href*="/hotel/"]',
    ],
    "hotel_link": [
        'a[data-selenium="hotel-name"]',
        'header[data-element-name="property-info-header"] a[href*="/hotel/"]',
        'a[class*="PropertyCard__Link"]',
        'a[href*="/hotel/"]',
    ],
    # Address - inside button[data-selenium="area-city-text"] > span with label
    "hotel_address": [
        'button[data-selenium="area-city-text"] span[label]',  # Most specific
        'button[data-selenium="area-city-text"]',
    ],
    # Hotel ID attribute
    "hotel_id_attr": "data-hotelid",
    
    # Rating score (e.g., 8.5)
    "rating_score": [
        'div[data-element-name="property-card-review"] p[aria-hidden="true"]',  # Score display
        'div[class*="property-card-location-score-inline"] p[aria-hidden="true"]',
        'p[class*="TypographyStyled"][aria-hidden="true"]',  # Fallback
    ],
    
    # Review count (e.g., "3.140 bài đánh giá")
    "review_count": [
        'div[data-element-name="property-card-review"] span[class*="ScreenReaderOnly"]',
        'div[class*="ReviewWithDemographic"] span[class*="ScreenReaderOnly"]',
    ],
    
    # Pagination selectors (not used for infinite scroll)
    "next_page": [
        'button[aria-label="Next"]',
        'button[data-selenium="pagination-next"]',
    ],
}

# Selectors for review page
REVIEW_SELECTORS = {
    "review_section": [
        'div[data-selenium="hotel-review-container"]',
        '[class*="ReviewSection"]',
        '#reviewSection',
    ],
    "review_card": [
        'div[data-selenium="review-item"]',
        'div[data-testid="review-card"]',
        '[class*="Review-comment"]',
        '[class*="review-card"]',
        'div[class*="ReviewComment"]',
    ],
    "review_text": [
        'p[data-selenium="review-body"]',
        'p[data-testid="review-comments"]',
        '[class*="Review-comment-bodyText"]',
        '[class*="review-body"]',
        'p[class*="comment"]',
    ],
    "review_rating": [
        'div[data-selenium="review-score"]',
        'div[data-testid="review-rating"]',
        '[class*="Review-comment-score"]',
        '[class*="review-score"]',
    ],
    "next_page_button": [
        'button[aria-label="Next page"]',
        'button[data-selenium="pagination-next"]',
        'span[class*="pagination-next"]',
        '[class*="Pagination"] button:last-child',
        'button:has(svg[class*="next"])',
    ],
    "pagination_info": [
        'span[data-selenium="pagination-text"]',
        '[class*="Pagination__PageInfo"]',
    ],
}

# =============================================================================
# AGODA URLs
# =============================================================================
DANANG_SEARCH_URL = "https://www.agoda.com/vi-vn/search?city=16440&checkIn=2026-06-01&los=6&rooms=1&adults=2&children=0&cid=1908612&locale=vi-vn&ckuid=9be452c5-7835-437a-9ad5-75dc284b3efe&prid=0&currency=VND&correlationId=ea48ea07-8593-45a6-9da1-4ada5a74c565&analyticsSessionId=2867189042248278416&pageTypeId=1&realLanguageId=24&languageId=24&origin=VN&stateCode=33&userId=9be452c5-7835-437a-9ad5-75dc284b3efe&whitelabelid=1&loginLvl=0&storefrontId=3&currencyId=78&currencyCode=VND&htmlLanguage=vi-vn&cultureInfoName=vi-vn&machineName=hk-pc-2g-acm-web-user-5ffd465757-twwmd&trafficGroupId=4&trafficSubGroupId=849&aid=296180&useFullPageLogin=true&cttp=4&isRealUser=true&mode=production&browserFamily=Chrome&cdnDomain=agoda.net&checkOut=2026-06-07&priceCur=VND&textToSearch=%C4%90%C3%A0+N%E1%BA%B5ng&productType=-1&travellerType=1&familyMode=off&ds=hD6XkH4UL8y5f7U5"

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
