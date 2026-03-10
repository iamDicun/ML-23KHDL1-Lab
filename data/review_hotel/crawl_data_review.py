from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import csv
import os
import json
import re
import random
import logging
from typing import Optional, Union
from urllib.parse import urlparse

from config import (
    get_chrome_options,
    REVIEW_SELECTORS,
    REVIEWS_OUTPUT_FILE,
    PAGE_LOAD_DELAY
)


# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

if not logger.handlers:
    # Console handler
    _console_handler = logging.StreamHandler()
    _console_handler.setLevel(logging.INFO)
    _console_handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(_console_handler)

    # File handler (for debug details)
    _file_handler = logging.FileHandler('crawl_reviews.log', encoding='utf-8')
    _file_handler.setLevel(logging.DEBUG)
    _file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
    logger.addHandler(_file_handler)


# Helper function to find element by selectors
def find_element_by_selectors(
    driver: Union[WebDriver, WebElement],
    selectors: list[str],
    parent: Optional[WebElement] = None,
    multiple: bool = False
) -> Optional[Union[WebElement, list[WebElement]]]:
    # If have parent, search in parent, else search in driver
    search_context = parent if parent else driver
    
    for selector in selectors:
        try:
            if multiple:
                elements = search_context.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    return elements
            else:
                element = search_context.find_element(By.CSS_SELECTOR, selector)
                if element:
                    return element
        except Exception:
            continue

    # If not found, return None if not multiple, else return empty list
    return None if not multiple else []


class AgodaReviewCrawler:
    """
    Crawler class for extracting reviews from hotel pages.
    """
    CHECKPOINT_DIR = "reviews_raw"
    def __init__(self) -> None:
        logger.info("Initializing Chrome WebDriver...")
        self.driver: WebDriver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=get_chrome_options()
        )
        self.seen_reviews: set[str] = set()
    
    # Close browser
    def close(self) -> None:
        if self.driver:
            self.driver.quit()


    # === Checkpoint ===
    # Get checkpoint file path for a hotel
    def _checkpoint_path(self, hotel_id: str) -> str:
        return os.path.join(self.CHECKPOINT_DIR, f"{hotel_id}_checkpoint.json")
    
    # Save partial reviews to checkpoint JSON after each page
    def save_checkpoint(self, hotel_id: str, reviews: list[dict], page_num: int) -> None:
        os.makedirs(self.CHECKPOINT_DIR, exist_ok=True)
        data = {
            "hotel_id": hotel_id,
            "last_page": page_num,
            "reviews": reviews
        }
        with open(self._checkpoint_path(hotel_id), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Load checkpoint if exists
    def load_checkpoint(self, hotel_id: str) -> tuple[list[dict], int]:
        cp_path = self._checkpoint_path(hotel_id)
        if os.path.exists(cp_path):
            try:
                with open(cp_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                reviews = data.get("reviews", [])
                last_page = data.get("last_page", 0)
                logger.info(f"  ↻ Resuming from checkpoint: {len(reviews)} reviews, page {last_page}")
                return reviews, last_page
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"  Failed to load checkpoint for {hotel_id}: {e}")
        return [], 0
    
    # Delete checkpoint file after hotel is fully crawled
    def clear_checkpoint(self, hotel_id: str) -> None:
        cp_path = self._checkpoint_path(hotel_id)
        if os.path.exists(cp_path):
            os.remove(cp_path)
    
    
    # === Review Crawling ===
    # Scroll to reviews section
    def scroll_to_reviews(self) -> bool:
        try:
            # Try to find and scroll to reviews section
            review_section = find_element_by_selectors(
                self.driver, 
                REVIEW_SELECTORS["review_section"]
            )
            # If found, scroll to reviews section
            if review_section:
                self.driver.execute_script(
                    "arguments[0].scrollIntoView({behavior: 'instant', block: 'start'});", 
                    review_section
                )
                return True
        except Exception as e:
            logger.debug(f"  Could not scroll to reviews section: {e}")
        
        # Fallback: scroll to 2/3 of page
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight*2/3);")
        return False
    
    # Wait for review cards to be present in DOM
    def wait_for_reviews(self, timeout: int = 5) -> bool:
        for selector in REVIEW_SELECTORS["review_card"]:
            try:
                WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                return True
            except Exception as e:
                logger.debug(f"  Selector '{selector}' timed out: {e}")
                continue
        return False
    
    # Extract reviews from page currently
    def extract_reviews_from_page(self, hotel_info: dict) -> tuple[list[dict], int]:
        reviews = []
        skipped_response = 0
        skipped_no_text = 0
        skipped_dup = 0
        errors = 0
        
        # Find review cards
        review_cards = find_element_by_selectors(
            self.driver, 
            REVIEW_SELECTORS["review_card"], 
            multiple=True
        )
        
        if not review_cards:
            logger.warning("    No review cards found on this page")
            logger.debug(f"    Current URL: {self.driver.current_url}")
            # Try to see if there are ANY divs with data-review-id
            try:
                alt_cards = self.driver.find_elements(By.CSS_SELECTOR, 'div[data-review-id]')
                logger.debug(f"    Found {len(alt_cards)} divs with data-review-id attribute")
            except Exception as e:
                logger.debug(f"    Could not search for alt cards: {e}")
            return reviews, 0
        
        total_cards = len(review_cards)
        
        # Process each card by index (re-find if stale)
        for i in range(total_cards):
            try:
                # Re-find cards each iteration to avoid stale references
                cards = find_element_by_selectors(
                    self.driver,
                    REVIEW_SELECTORS["review_card"],
                    multiple=True
                )
                if not cards or i >= len(cards):
                    break
                card = cards[i]
                
                # Skip hotel response cards (only want guest reviews)
                comment_type = card.get_attribute("data-review-comment-type") or ""
                if comment_type.lower() == "response":
                    skipped_response += 1
                    continue
                
                # Extract review_id from card attribute
                review_id = card.get_attribute("data-review-id") or ""
                
                # Skip if already seen (dedup by review_id)
                if review_id and review_id in self.seen_reviews:
                    skipped_dup += 1
                    continue
                
                # Check if this review has a translate button (foreign language)
                translate_btn = find_element_by_selectors(
                    self.driver,
                    REVIEW_SELECTORS["translate_button"],
                    parent=card
                )
                
                if translate_btn:
                    # Click translate button and wait for translation
                    try:
                        self.driver.execute_script("arguments[0].click();", translate_btn)
                        time.sleep(1.5)
                        
                        # Re-find the card after translate click (DOM may change)
                        cards = find_element_by_selectors(
                            self.driver,
                            REVIEW_SELECTORS["review_card"],
                            multiple=True
                        )
                        if cards and i < len(cards):
                            card = cards[i]
                    except Exception as e:
                        logger.debug(f"    Failed to click translate for review {review_id}: {e}")
                    
                    # Try to extract translated title/text
                    title_elem = find_element_by_selectors(
                        self.driver,
                        REVIEW_SELECTORS["translated_title"],
                        parent=card
                    )
                    text_elem = find_element_by_selectors(
                        self.driver,
                        REVIEW_SELECTORS["translated_text"],
                        parent=card
                    )
                    
                    # FALLBACK: If translated selectors don't find anything,
                    # the review might already be in Vietnamese - use normal selectors
                    if not title_elem:
                        title_elem = find_element_by_selectors(
                            self.driver,
                            REVIEW_SELECTORS["review_title"],
                            parent=card
                        )
                    if not text_elem:
                        text_elem = find_element_by_selectors(
                            self.driver,
                            REVIEW_SELECTORS["review_text"],
                            parent=card
                        )
                else:
                    # No translate button = already Vietnamese, extract normally
                    title_elem = find_element_by_selectors(
                        self.driver, 
                        REVIEW_SELECTORS["review_title"],
                        parent=card
                    )
                    text_elem = find_element_by_selectors(
                        self.driver, 
                        REVIEW_SELECTORS["review_text"],
                        parent=card
                    )
                
                review_title = title_elem.text.strip() if title_elem else ""
                review_body = text_elem.text.strip() if text_elem else ""
                
                # Combine title + body
                if review_title and review_body:
                    review_text = f"{review_title}: {review_body}"
                else:
                    review_text = review_title or review_body
                
                if not review_text:
                    skipped_no_text += 1
                    logger.debug(f"    No text for review_id={review_id}, translate_btn={translate_btn is not None}")
                    continue
                
                # Mark review_id as seen
                if review_id:
                    self.seen_reviews.add(review_id)
                
                # Extract rating
                rating_elem = find_element_by_selectors(
                    self.driver, 
                    REVIEW_SELECTORS["review_rating"],
                    parent=card
                )
                rating = rating_elem.text.strip() if rating_elem else "N/A"
                
                # Clean rating (convert to number)
                try:
                    match = re.search(r'\d+\.?\d*', rating)
                    rating = float(match.group()) if match else None
                except (ValueError, AttributeError):
                    rating = None
                
                reviews.append({
                    "review_id": review_id,
                    "hotel_id": hotel_info.get("id", ""),
                    "review_text": review_text,
                    "rating": rating
                })
                
            except Exception as e:
                errors += 1
                logger.debug(f"    Error processing card {i}: {e}")
                continue
        
        # Debug log
        if skipped_response > 0 or skipped_no_text > 0 or skipped_dup > 0 or errors > 0:
            logger.info(f"    (Cards: {total_cards} | Response: {skipped_response} | No text: {skipped_no_text} | Dup: {skipped_dup} | Errors: {errors})")
        
        return reviews, skipped_dup
    
    # Check if there's a next page button and it's clickable
    def has_next_page(self) -> Optional[WebElement]:
        try:
            next_btn = find_element_by_selectors(
                self.driver, 
                REVIEW_SELECTORS["next_page_button"]
            )
            if next_btn:
                # Check if button is disabled
                classes = next_btn.get_attribute("class") or ""
                disabled = next_btn.get_attribute("disabled")
                aria_disabled = next_btn.get_attribute("aria-disabled")
                
                if "disabled" in classes.lower() or disabled or aria_disabled == "true":
                    return None
                return next_btn
        except Exception as e:
            logger.debug(f"  Error checking next page: {e}")
        return None
    
    # Get the review_id of the first review card on current page (for detecting page change)
    def _get_first_review_id(self) -> Optional[str]:
        try:
            cards = find_element_by_selectors(
                self.driver,
                REVIEW_SELECTORS["review_card"],
                multiple=True
            )
            if cards:
                return cards[0].get_attribute("data-review-id") or None
        except Exception:
            pass
        return None
    
    # Click the next page button
    def click_next_page(self, next_btn: WebElement) -> bool:
        try:
            # log button info
            btn_text = next_btn.text.strip() if next_btn.text else "(no text)"
            btn_tag = next_btn.tag_name
            btn_class = next_btn.get_attribute("class") or ""
            logger.debug(f"    Clicking next button: <{btn_tag} class='{btn_class}'> text='{btn_text}'")
            
            # Store state before click to verify page actually changed
            url_before = self.driver.current_url
            first_review_before = self._get_first_review_id()
            
            # Click using JavaScript to avoid interception
            self.driver.execute_script("arguments[0].click();", next_btn)
            time.sleep(PAGE_LOAD_DELAY)
            
            # Detect if click caused a full page redirect (wrong button clicked)
            url_after = self.driver.current_url
            if url_before != url_after:
                logger.debug(f"    URL changed after click")
                logger.debug(f"      Before: {url_before}")
                logger.debug(f"      After:  {url_after}")
                
                # Check if the URL changed drastically (page redirect, not AJAX pagination)
                # Review pagination on Agoda is AJAX-based, URL should stay the same or change minimally
                path_before = urlparse(url_before).path
                path_after = urlparse(url_after).path
                
                if path_before != path_after:
                    logger.warning(f"    ⚠️  Page redirected to a different path! Wrong button was clicked.")
                    logger.warning(f"    ⚠️  Going back to previous page...")
                    self.driver.back()
                    time.sleep(PAGE_LOAD_DELAY)
                    return False
            
            # Scroll to reviews section and wait for reviews to load
            self.scroll_to_reviews()
            self.wait_for_reviews()
            
            # Verify that the page actually changed by checking if first review_id is different
            first_review_after = self._get_first_review_id()
            if first_review_before and first_review_after and first_review_before == first_review_after:
                logger.warning(f"    ⚠️  Page did not change after click (same first review: {first_review_before})")
                return False
            
            return True
        except Exception as e:
            logger.error(f"  Error clicking next page: {e}")
            return False
    
    # Crawl all reviews for a single hotel
    def crawl_hotel_reviews(self, hotel_info: dict, max_pages: int = 500) -> list[dict]:
        url = hotel_info.get("url", "")
        hotel_id = hotel_info.get("id", "")
        
        if not url:
            logger.warning(f"  ✗ No URL for hotel: {hotel_info.get('name')}")
            return []
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Crawling: {hotel_info.get('name', 'Unknown')}")
        logger.info(f"URL: {url}")
        logger.info(f"{'='*60}")
        
        # Load checkpoint if exists (resume mid-hotel)
        hotel_reviews, start_page = self.load_checkpoint(hotel_id)
        
        # Rebuild seen_reviews from checkpoint data (using review_id)
        self.seen_reviews.clear()
        for r in hotel_reviews:
            rid = r.get("review_id", "")
            if rid:
                self.seen_reviews.add(rid)
        
        try:
            # Navigate to hotel page
            self.driver.get(url)
            time.sleep(PAGE_LOAD_DELAY)
            
            # Scroll to reviews section
            self.scroll_to_reviews()
            
            # If resuming, navigate to the correct page
            if start_page > 1:
                logger.info(f"  Navigating to page {start_page + 1}...")
                for p in range(1, start_page):
                    next_btn = self.has_next_page()
                    if next_btn:
                        self.click_next_page(next_btn)
            
            page_num = start_page + 1 if start_page > 0 else 1
            empty_page_retries = 0
            cooldown_retries = 0
            MAX_EMPTY_RETRIES = 2    # Quick retries (scroll + reload)
            MAX_COOLDOWN_RETRIES = 2 # Cooldown cycles (wait 5 min each)
            COOLDOWN_WAIT = 300      # 5 minutes
            
            while page_num <= max_pages:
                logger.info(f"\n  Page {page_num}:")
                
                # Only wait/scroll on first page (click_next_page handles it for pages 2+)
                if page_num == 1:
                    self.wait_for_reviews()
                
                # Extract reviews from current page
                page_reviews, dup_count = self.extract_reviews_from_page(hotel_info)
                hotel_reviews.extend(page_reviews)
                logger.info(f"    Found {len(page_reviews)} new reviews (Total: {len(hotel_reviews)})")

                
                # If all cards are duplicates, pagination is stuck ==> stop
                if len(page_reviews) == 0 and dup_count > 0 and page_num > 1:
                    logger.warning(f"    ⚠️  Page {page_num}: all {dup_count} reviews are duplicates — pagination is stuck. Stopping.")
                    break
                
                # No cards found at all — try reload recovery
                if len(page_reviews) == 0 and dup_count == 0:
                    empty_page_retries += 1
                    if empty_page_retries <= MAX_EMPTY_RETRIES:
                        if empty_page_retries == 1:
                            # First retry: scroll + wait
                            logger.warning(f"    ⚠️  Page {page_num} empty - scrolling and waiting...")
                            self.scroll_to_reviews()
                            self.wait_for_reviews(timeout=10)
                        else:
                            # Second retry: full page reload + re-navigate
                            logger.warning(f"    ⚠️  Page {page_num} still empty - reloading page...")
                            self.driver.get(url)
                            time.sleep(PAGE_LOAD_DELAY)
                            self.scroll_to_reviews()
                            self.wait_for_reviews(timeout=10)
                            # Re-navigate to current page
                            for p in range(1, page_num):
                                nb = self.has_next_page()
                                if nb:
                                    self.click_next_page(nb)
                                else:
                                    break
                        continue  # Retry same page
                    else:
                        # Quick retries exhausted — cooldown (possibly blocked/502)
                        cooldown_retries += 1
                        if cooldown_retries <= MAX_COOLDOWN_RETRIES:
                            logger.warning(f"    ⏳ Cooldown {cooldown_retries}/{MAX_COOLDOWN_RETRIES}: waiting {COOLDOWN_WAIT}s ({COOLDOWN_WAIT//60} min) before retrying...")
                            time.sleep(COOLDOWN_WAIT)
                            empty_page_retries = 0  # Reset quick retries for new round
                            
                            # Full reload + re-navigate after cooldown
                            self.driver.get(url)
                            time.sleep(PAGE_LOAD_DELAY)
                            self.scroll_to_reviews()
                            self.wait_for_reviews(timeout=10)
                            for p in range(1, page_num):
                                nb = self.has_next_page()
                                if nb:
                                    self.click_next_page(nb)
                                else:
                                    break
                            continue  # Retry same page after cooldown
                        else:
                            logger.warning(f"    ⚠️  Page {page_num} still empty after {MAX_COOLDOWN_RETRIES} cooldowns — giving up.")
                            break
                else:
                    empty_page_retries = 0  # Reset retry counter on success
                    cooldown_retries = 0    # Reset cooldown counter on success
                
                # Save checkpoint after each page
                self.save_checkpoint(hotel_id, hotel_reviews, page_num)
                
                # Check for next page
                next_btn = self.has_next_page()
                if not next_btn:
                    logger.info("  No more pages")
                    break
                
                # Page-level anti-block delay
                if page_num % 10 == 0:
                    # Every 10 pages: rest 15-30s
                    page_rest = random.uniform(15, 30)
                    logger.info(f"    ⏳ Page batch rest: {page_rest:.0f}s after {page_num} pages...")
                    time.sleep(page_rest)
                elif page_num % 3 == 0:
                    # Every 3 pages: small extra delay 2-5s
                    extra = random.uniform(2, 5)
                    time.sleep(extra)
                
                # Click next page
                if not self.click_next_page(next_btn):
                    break
                
                page_num += 1
            
            logger.info(f"\n  ✓ Total reviews collected: {len(hotel_reviews)}")

        except Exception as e:
            logger.error(f"  ✗ Error crawling hotel: {e}")
            logger.info(f"  Checkpoint saved. Re-run to resume.")
        
        return hotel_reviews
    
    # Save final reviews for a hotel (CSV + JSON) and clear checkpoint
    def save_hotel_reviews(self, reviews: list[dict], hotel_id: str, output_dir: str = "reviews_raw") -> None:
        os.makedirs(output_dir, exist_ok=True)
        
        # Save CSV
        csv_path = os.path.join(output_dir, f"{hotel_id}.csv")
        fieldnames = ["review_id", "hotel_id", "review_text", "rating"]
        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            if reviews:
                writer.writerows(reviews)
        
        # Save JSON
        json_path = os.path.join(output_dir, f"{hotel_id}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(reviews, f, ensure_ascii=False, indent=2)
        
        # Clear checkpoint (hotel is done)
        self.clear_checkpoint(hotel_id)
        
        logger.info(f"  ✓ Saved {len(reviews)} reviews to {csv_path} + {json_path}")


# Get set of hotel IDs already crawled by checking existing files in output folder
def get_crawled_hotel_ids(output_dir: str = "reviews_raw") -> set[str]:
    crawled_ids = set()
    if os.path.exists(output_dir):
        # Iterate over all files in the output directory
        for filename in os.listdir(output_dir):
            if filename.endswith(".csv"):
                hotel_id = filename.replace(".csv", "")
                crawled_ids.add(hotel_id)
    # Return the set of crawled hotel IDs
    return crawled_ids


# Merge all per-hotel CSV files into one final CSV
def merge_all_reviews(output_dir: str = "reviews_raw", output_file: str = REVIEWS_OUTPUT_FILE) -> Optional[list[dict]]:
    all_reviews = []
    failed_files = []
    
    # Check if the output directory exists
    if not os.path.exists(output_dir):
        logger.warning("No reviews folder found")
        return None
    
    # Get all CSV files in the output directory
    csv_files = [f for f in os.listdir(output_dir) if f.endswith(".csv")]
    
    # Merge all CSV files into one
    for filename in csv_files:
        filepath = os.path.join(output_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    all_reviews.append(row)
        except (IOError, csv.Error) as e:
            logger.warning(f"Failed to read {filepath}: {e}")
            failed_files.append(filename)
            continue
    
    if failed_files:
        logger.warning(f"⚠️  Failed to read {len(failed_files)} files: {failed_files}")
    
    # Write all reviews to the output file
    if all_reviews:
        fieldnames = ["review_id", "hotel_id", "review_text", "rating"]
        with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_reviews)
        
        logger.info(f"✓ Merged {len(all_reviews)} reviews from {len(csv_files)} hotels into {output_file}")
    else:
        logger.info("No reviews to merge")
    
    return all_reviews