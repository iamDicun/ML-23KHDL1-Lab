import sys
import io

if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import json
import os
import time
import re

from config import (
    get_chrome_options,
    get_random_delay,
    HOTEL_LIST_SELECTORS,
    HOTEL_URLS_FILE,
    DANANG_SEARCH_URL,
    PAGE_LOAD_DELAY
)

SCROLL_STEP = 1500
MAX_WAIT_TIME = 10
MAX_SCROLL_ATTEMPTS = 50

class CheckpointManager:
    """
    Manages checkpoint saving and progress tracking for hotel crawling.
    Saves hotels incrementally to avoid data loss.
    """
    def __init__(self, output_file, checkpoint_file=None):
        self.output_file = output_file # File save final result
        self.checkpoint_file = checkpoint_file or output_file.replace('.json', '_checkpoint.json') # File save checkpoint
        self.hotels = [] # List to store hotels
        self.seen_ids = set() # Set to store seen hotel IDs to avoid duplicates
        self.start_time = None # Start time
        self.last_save_count = 0 # Last save count
        self.save_every = 10  # Save checkpoint every 10 hotels
    
    # Add hotel to list and save checkpoint if needed
    def add_hotel(self, hotel):
        # Check duplicate hotel by ID
        hotel_id = hotel.get('id')
        if hotel_id and hotel_id not in self.seen_ids:
            self.hotels.append(hotel)
            self.seen_ids.add(hotel_id)
            
            # Auto-save checkpoint every 10 hotels
            if len(self.hotels) - self.last_save_count >= self.save_every:
                self.save_checkpoint()
                self.last_save_count = len(self.hotels)
    
    # Save checkpoint
    def save_checkpoint(self):
        try:
            data = {
                "metadata": {
                    "total_crawled": len(self.hotels),
                    "city": "Đà Nẵng",
                    "is_checkpoint": True,
                    "checkpoint_time": time.strftime("%Y-%m-%d %H:%M:%S")
                },
                "hotels": self.hotels
            }
            
            with open(self.checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            pass  # Silent fail for checkpoint
    
    # Save final results (JSON + CSV)
    def save_final(self):
        import csv
        elapsed = time.time() - self.start_time if self.start_time else 0
        
        data = {
            "metadata": {
                "total_crawled": len(self.hotels),
                "city": "Đà Nẵng",
                "crawl_date": time.strftime("%Y-%m-%d %H:%M:%S"),
                "crawl_duration_minutes": round(elapsed / 60, 1)
            },
            "hotels": self.hotels
        }
        
        # Save JSON
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # Save CSV
        csv_file = self.output_file.replace('.json', '.csv')
        if self.hotels:
            fieldnames = self.hotels[0].keys()
            with open(csv_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(self.hotels)
            print(f"    ✓ Also saved to {csv_file}")
        
        return data
    
    # Load checkpoint if exists
    def load_checkpoint(self):
        try:
            import os
            if os.path.exists(self.checkpoint_file):
                with open(self.checkpoint_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if 'hotels' in data:
                        for hotel in data['hotels']:
                            hotel_id = hotel.get('id')
                            if hotel_id and hotel_id not in self.seen_ids:
                                self.hotels.append(hotel)
                                self.seen_ids.add(hotel_id)
                        return len(self.hotels) # Return number of hotels
        except:
            pass
        return 0


# Extract hotel name from URL as fallback
def extract_name_from_url(url):
    if not url:
        return None
    
    # Pattern: /vi-vn/hotel-name/hotel/city.html
    match = re.search(r'/vi-vn/([^/]+)/hotel/', url)

    if match:
        name = match.group(1)
        # Convert hyphens to spaces and capitalize
        name = name.replace('-', ' ').title()
        return name
    
    return None


# Extract data from a single hotel card
def extract_single_hotel(card, seen_ids, driver=None):
    try:
        # IMPORTANT: Scroll card into view to trigger lazy loading of rating info
        if driver:
            try:
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
                time.sleep(0.3)  # Brief wait for lazy content to load
            except:
                pass
        
        # Extract hotel ID and check duplicate
        hotel_id = card.get_attribute("data-hotelid")
        if hotel_id and hotel_id in seen_ids:
            return None
        

        # Extract URL (can be None)
        url = None
        link_elem = None
        
        # Method 1: Try selectors from config
        for selector in HOTEL_LIST_SELECTORS["hotel_link"]:
            try:
                link_elem = card.find_element(By.CSS_SELECTOR, selector)
                if link_elem:
                    break
            except:
                continue
        
        # Method 2: Fallback - try generic hotel link
        if not link_elem:
            try:
                link_elem = card.find_element(By.CSS_SELECTOR, 'a[href*="/hotel/"]')
            except:
                pass
        
        # Method 3: Fallback - try any anchor tag
        if not link_elem:
            try:
                link_elem = card.find_element(By.TAG_NAME, "a")
            except:
                pass
        
        if link_elem:
            url = link_elem.get_attribute("href")
        

        # Extract name
        name = None
        
        # Method 1: Try to get name from hotel card directly
        for selector in HOTEL_LIST_SELECTORS["hotel_name"]:
            try:
                name_elem = card.find_element(By.CSS_SELECTOR, selector)
                if name_elem:
                    # Try getting text directly
                    elem_text = name_elem.text.strip()
                    if elem_text and len(elem_text) > 3:
                        name = elem_text
                        break
                    
                    # Try span with label attribute
                    try:
                        span_with_label = name_elem.find_element(By.CSS_SELECTOR, 'span[label]')
                        label = span_with_label.get_attribute("label")
                        if label and len(label) > 3:
                            name = label.strip()
                            break
                    except:
                        pass
            except:
                continue
        
        # Method 2: Try finding any h3 or title element in card
        if not name:
            try:
                h3_elem = card.find_element(By.CSS_SELECTOR, 'h3')
                if h3_elem and h3_elem.text.strip():
                    name = h3_elem.text.strip()
            except:
                pass
        
        # Method 3: Fallback to URL-based name
        if not name:
            name = extract_name_from_url(url)
        
        # Final fallback
        if not name:
            name = "Unknown Hotel"
        

        # Extract rating and review count
        rating_score = None
        review_count = None
        
        try:
            # Method 1: Find ScreenReaderOnly span in review section
            review_selectors = [
                'div[data-element-name="property-card-review"] span[class*="ScreenReaderOnly"]',
                'div[class*="ReviewWithDemographic"] span[class*="ScreenReaderOnly"]',
                'span[class*="ScreenReaderOnly"]',
            ]
            
            for selector in review_selectors:
                try:
                    spans = card.find_elements(By.CSS_SELECTOR, selector)
                    for span in spans:
                        text = span.text.strip()
                        if not text:
                            continue
                        
                        # Extract rating: pattern "X,X/10" or "X/10"
                        if not rating_score:
                            rating_match = re.search(r'(\d+[,.]?\d*)/10', text)
                            if rating_match:
                                rating_score = float(rating_match.group(1).replace(',', '.'))
                        
                        # Extract review count: pattern "X.XXX bài đánh giá"
                        if not review_count:
                            review_match = re.search(r'(\d[\d.]*)\s*bài đánh giá', text)
                            if review_match:
                                count_str = review_match.group(1).replace('.', '')
                                review_count = int(count_str)
                        
                        if rating_score and review_count:
                            break
                    
                    if rating_score and review_count:
                        break
                except:
                    continue
            
            # Method 2: Fallback - try p[aria-hidden="true"] for review count
            if not review_count:
                try:
                    p_elems = card.find_elements(By.CSS_SELECTOR, 'p[aria-hidden="true"]')
                    for p_elem in p_elems:
                        text = p_elem.text.strip()
                        review_match = re.search(r'(\d[\d.]*)\s*bài đánh giá', text)
                        if review_match:
                            count_str = review_match.group(1).replace('.', '')
                            review_count = int(count_str)
                            break
                except:
                    pass
        except:
            pass
        
        
        # Extract address/location (district/area name)
        address = None
        try:
            # Use JavaScript to find span with label attribute containing district name
            # The label attribute on span contains "Phước Mỹ, Đà Nẵng - cách trung tâm 0,8 km"
            if driver:
                try:
                    # ONLY look inside area-city button for span with label
                    js_code = """
                        var card = arguments[0];
                        // Method 1: Find span with label ONLY inside area-city button
                        var areaBtn = card.querySelector('button[data-selenium="area-city"]');
                        if (areaBtn) {
                            var spans = areaBtn.querySelectorAll('span[label]');
                            for (var i = 0; i < spans.length; i++) {
                                var lbl = spans[i].getAttribute('label');
                                if (lbl && lbl.trim()) {
                                    return lbl;
                                }
                            }
                            // Fallback: get text content of button
                            var txt = areaBtn.textContent;
                            if (txt && txt.trim()) {
                                return txt.trim();
                            }
                        }
                        // Method 2: Try popular-landmarks section
                        var landmarks = card.querySelector('[data-element-name*="popular-landmarks"]');
                        if (landmarks) {
                            var span = landmarks.querySelector('span[label]');
                            if (span) {
                                var lbl = span.getAttribute('label');
                                if (lbl && lbl.trim()) return lbl;
                            }
                        }
                        return null;
                    """
                    result = driver.execute_script(js_code, card)
                    if result and result.strip():
                        address = result.strip()
                except Exception as e:
                    pass
        except:
            pass
        
        return {
            "name": name,
            "url": url,
            "id": hotel_id or "unknown",
            "rating_score": rating_score,
            "review_count": review_count,
            "address": address
        }
        
    except Exception as e:
        return None



# Scroll to load all content on current page and return hotel cards
def scroll_and_wait_for_content(driver, scroll_step=600, max_wait_time=10, max_scroll_attempts=50):
    """
    Agoda uses pagination (not infinite scroll).
    Each page loads ~30 hotels at once, but we still need to scroll 
    to ensure all cards are rendered in the DOM.
    """
    scroll_attempts = 0
    last_card_count = 0
    
    # Get initial card count
    try:
        hotel_cards = driver.find_elements(By.CSS_SELECTOR, 'li[data-selenium="hotel-item"]')
        last_card_count = len(hotel_cards)
    except:
        pass
    
    print(f"    Starting scroll... (initial: {last_card_count} cards)")
    
    # Scroll down the page to load all content
    while scroll_attempts < max_scroll_attempts:
        current_scroll = driver.execute_script("return window.pageYOffset;")
        page_height = driver.execute_script("return document.body.scrollHeight;")
        viewport_height = driver.execute_script("return window.innerHeight;")
        
        # Check if we reached bottom of page
        if current_scroll + viewport_height >= page_height - 100:
            # At bottom, check for new cards one more time
            time.sleep(1)
            current_cards = driver.find_elements(By.CSS_SELECTOR, 'li[data-selenium="hotel-item"]')
            if len(current_cards) > last_card_count:
                print(f"    +{len(current_cards) - last_card_count} more cards at bottom (total: {len(current_cards)})")
                last_card_count = len(current_cards)
            print(f"    ✓ Reached bottom of page ({last_card_count} cards)")
            break
        
        # Scroll down
        new_scroll_position = current_scroll + scroll_step
        driver.execute_script(f"window.scrollTo(0, {new_scroll_position});")
        time.sleep(0.3)  # Brief pause for rendering
        
        # Check if new cards appeared
        try:
            current_cards = driver.find_elements(By.CSS_SELECTOR, 'li[data-selenium="hotel-item"]')
            current_card_count = len(current_cards)
            
            if current_card_count > last_card_count:
                print(f"    Scroll {scroll_attempts + 1}: +{current_card_count - last_card_count} cards (total: {current_card_count})")
                last_card_count = current_card_count
        except:
            pass
        
        scroll_attempts += 1
    
    # Get final cards and scroll back to top
    hotel_cards = driver.find_elements(By.CSS_SELECTOR, 'li[data-selenium="hotel-item"]')
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(0.5)
    
    return hotel_cards


def crawl_hotel_urls(resume_from_checkpoint=False):
    print("=" * 60)
    print("AGODA HOTEL URL CRAWLER - ĐÀ NẴNG")
    print("=" * 60)

    os.makedirs(os.path.dirname(os.path.abspath(HOTEL_URLS_FILE)), exist_ok=True)

    # Initialize checkpoint manager
    checkpoint = CheckpointManager(HOTEL_URLS_FILE)
    checkpoint.start_time = time.time()
    
    # Try to resume from checkpoint if requested
    if resume_from_checkpoint:
        loaded = checkpoint.load_checkpoint()
        if loaded > 0:
            print(f"\n[*] Resumed from checkpoint: {loaded} hotels already crawled")
    
    # Setup driver
    print("\n[1] Initializing Chrome WebDriver...")
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=get_chrome_options()
    )

    try:
        # Navigate to search page
        print(f"\n[2] Navigating to search page...")
        driver.get(DANANG_SEARCH_URL)
        time.sleep(PAGE_LOAD_DELAY + 2)
        
        # Wait for page to load
        print("\n[3] Waiting for page to load...")
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Close popups
        try:
            # Find all close buttons
            close_buttons = driver.find_elements(By.CSS_SELECTOR, '[class*="close"], [aria-label="Close"], button[class*="Close"]')
            for btn in close_buttons[:3]:
                try:
                    btn.click()
                    time.sleep(0.5)
                except:
                    pass
        except:
            pass
        
        # PAGINATION-BASED CRAWLING
        # Agoda uses pagination (30 pages), not infinite scroll
        print("\n[4] Crawling hotels page by page...")
        print("    Progress saved automatically after each page.\n")
        
        # Initialize current page and max pages
        current_page = 1
        max_pages = 50
        
        while current_page <= max_pages:
            print(f"\n    --- Page {current_page} ---")
            
            # Use dynamic scrolling - returns hotel cards directly
            hotel_cards = scroll_and_wait_for_content(driver, SCROLL_STEP, MAX_WAIT_TIME, MAX_SCROLL_ATTEMPTS)
            print(f"    Found {len(hotel_cards)} hotels on page {current_page}")

            
            # Extract hotels from current page
            page_hotels = 0
            for card in hotel_cards:
                hotel = extract_single_hotel(card, checkpoint.seen_ids, driver)
                if hotel:
                    checkpoint.add_hotel(hotel)
                    page_hotels += 1
            
            print(f"    Extracted {page_hotels} new hotels (Total: {len(checkpoint.hotels)})")
            
            # Force save checkpoint after each page
            checkpoint.save_checkpoint()
            print(f"    ✓ Checkpoint saved")
            
            # Try to click "Next Page" button
            try:
                # Close any popups that might be blocking
                try:
                    close_selectors = [
                        '[class*="close"]', '[aria-label="Close"]', 'button[class*="Close"]',
                        '[class*="popup"] button', '[class*="modal"] button'
                    ]
                    for sel in close_selectors:
                        try:
                            close_btns = driver.find_elements(By.CSS_SELECTOR, sel)
                            for btn in close_btns[:2]:
                                if btn.is_displayed():
                                    driver.execute_script("arguments[0].click();", btn)
                                    time.sleep(0.3)
                        except:
                            pass
                except:
                    pass
                
                # Scroll to bottom of page where pagination is
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1)
                
                # Look for next page button
                next_button = None

                css_selectors = [
                    '#paginationNext',                        # ID selector
                    '[data-selenium="pagination-next.btn"]',  # data-selenium attribute
                ]
                for sel in css_selectors:
                    try:
                        elem = driver.find_element(By.CSS_SELECTOR, sel)
                        if elem.is_displayed():
                            next_button = elem
                            break
                    except:
                        continue
                # Fallback: XPath if CSS doesn't find it
                if not next_button:
                    xpaths = [
                        "//button[@id='paginationNext']",
                        "//*[contains(text(), 'Trang kế')]",
                    ]
                    for xpath in xpaths:
                        try:
                            elements = driver.find_elements(By.XPATH, xpath)
                            for elem in elements:
                                if elem.is_displayed():
                                    next_button = elem
                                    break
                            if next_button:
                                break
                        except:
                            continue
                
                if next_button:
                    # Use JavaScript to click the button to bypass any overlays
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_button)
                    time.sleep(0.5)
                    driver.execute_script("arguments[0].click();", next_button)
                    current_page += 1
                    
                    print(f"    → Navigating to page {current_page}...")
                    WebDriverWait(driver, 10).until(
                        lambda d: d.execute_script("return document.readyState") == "complete"
                    )
                else:
                    print(f"\n    ⚠ No 'Next Page' button found. Reached last page.")
                    break      
            except Exception as e:
                print(f"\n    ⚠ Could not navigate to next page: {str(e)[:50]}")
                break
        
        print(f"\n    ✓ Finished crawling {current_page} pages - {len(checkpoint.hotels)} hotels extracted")

        
        # Final save
        print(f"\n[5] Saving final results to {HOTEL_URLS_FILE}...")
        data = checkpoint.save_final()
                
        print(f"\n  ✓ Saved {len(checkpoint.hotels)} hotels to {HOTEL_URLS_FILE}")
        
        elapsed = time.time() - checkpoint.start_time
        print(f"  ✓ Crawl duration: {elapsed/60:.1f} minutes")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print(f"  Saving checkpoint with {len(checkpoint.hotels)} hotels...")
        checkpoint.save_checkpoint()
        import traceback
        traceback.print_exc()
        
    finally:
        print("\n[6] Closing browser...")
        driver.quit()
        print("Done!")
    
    return checkpoint.hotels
