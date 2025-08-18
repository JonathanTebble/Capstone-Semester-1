from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time
import google.generativeai as genai
import os
import json
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import undetected_chromedriver as uc
import random

GEMINI_API_KEY = "AIzaSyBCM-WY7SxEACI95A3g34bGVVLEhJYmVJw"  # Replace with env var for production
CONTEXT_JSON_PATH = os.path.join(os.path.dirname(__file__), "context.json")

SOURCES = [
    {
        "name": "abs_retirement_stats",
        "url": "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/retirement-and-retirement-intentions-australia/latest-release",
        "selector_type": By.ID,
        "selector_value": "page-content",
    },
    {
        "name": "superconsumers_death_benefit",
        "url": "https://superconsumers.com.au/research/superannuation-death-benefit-delays-you-dont-get-paid-faster-if-you-pay-higher-fees/",
        "selector_type": By.CLASS_NAME,
        "selector_value": "single-content",
    },
    {
        "name": "superconsumers_pulse_spotlight",
        "url": "https://superconsumers.com.au/research/pulse-spotlight/",
        "selector_type": By.CLASS_NAME,
        "selector_value": "col-md-10",  # Selenium's By.CLASS_NAME only accepts a single class
    },
    {
        "name": "superconsumers_retirement_targets_methodology",
        "url": "https://superconsumers.com.au/research/update-to-super-consumers-australia-retirement-savings-targets-methodology/",
        "selector_type": By.CLASS_NAME,
        "selector_value": "col-md-10",  # Only the first class is used
    },
    {
        "name": "moneysmart_asfa_retirement_standard",
        "url": "https://moneysmart.gov.au/glossary/asfa-retirement-standard",
        "selector_type": By.ID,
        "selector_value": "content",
    },
    {
        "name": "moneysmart_tax_and_super",
        "url": "https://moneysmart.gov.au/how-super-works/tax-and-super",
        "selector_type": By.ID,
        "selector_value": "content",
    },
    {
        "name": "ato_planning_to_retire_before_you_retire",
        "url": "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/leaving-the-workforce/planning-to-retire",
        "custom_heading_id": "ato-Beforeyouretire"
    },
    {
        "name": "ato_transition_to_retirement_rules",
        "url": "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/leaving-the-workforce/transition-to-retirement",
        "custom_heading_id": "ato-Transitiontoretirementrules"
    },
    {
        "name": "ato_accessing_super_when_you_can_access",
        "url": "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/leaving-the-workforce/accessing-your-super-to-retire",
        "custom_heading_id": "ato-Whenyoucanaccessyoursuper"
    },
    {
        "name": "ato_approved_early_retirement_schemes",
        "url": "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/leaving-the-workforce/approved-early-retirement-schemes",
        "custom_heading_id": "ato-Whatisanapprovedearlyretirementscheme"
    }
    # Add more sources here as needed
]

def load_context():
    if os.path.exists(CONTEXT_JSON_PATH):
        with open(CONTEXT_JSON_PATH, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception:
                # If the file is not valid JSON, return empty dict
                return {}
    return {}

def save_context(context):
    with open(CONTEXT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(context, f, indent=2, ensure_ascii=False)

def was_source_scraped(context, source_name):
    scraped_sources = context.get("scraped_sources", {})
    return scraped_sources.get(source_name, False)

def set_source_scraped(context, source_name):
    if "scraped_sources" not in context:
        context["scraped_sources"] = {}
    context["scraped_sources"][source_name] = True

class WebScraper:
    def __init__(self):
        print("Initializing WebScraper...")
        user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/119.0.0.0 Safari/537.36"
        )
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Remove this line if you want to see the browser
        chrome_options.add_argument(f"user-agent={user_agent}")
        # Additional options to reduce detection
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        self.driver = uc.Chrome(options=chrome_options)

    def random_delay(self, min_sec=2, max_sec=5):
        delay = random.uniform(min_sec, max_sec)
        print(f"Sleeping for {delay:.2f} seconds to mimic human behavior...")
        time.sleep(delay)

    def navigate_to_page(self, url):
        print(f"Navigating to {url} ...")
        self.driver.get(url)
        self.random_delay()
        print("Page loaded.")

    def remove_menu_overlay(self):
        print("Attempting to remove menu overlay if present...")
        try:
            self.driver.execute_script("""
                var overlay = document.getElementById('menu-overlay');
                if (overlay) { overlay.style.display = 'none'; overlay.remove(); }
            """)
            print("Overlay removed (if it existed).")
        except Exception as e:
            print(f"Could not remove overlay: {e}")

    def debug_print_page_source_and_ids(self, target_id=None):
        print("\n--- DEBUG: Printing driver.page_source (truncated to 5000 chars) ---")
        page_source = self.driver.page_source
        print(page_source[:5000] + ("\n...[truncated]..." if len(page_source) > 5000 else ""))
        if target_id:
            found = target_id in page_source
            print(f"DEBUG: ID '{target_id}' {'FOUND' if found else 'NOT FOUND'} in page_source.")
        # List all IDs on the page
        all_elements_with_id = self.driver.find_elements(By.XPATH, '//*[@id]')
        all_ids = [el.get_attribute('id') for el in all_elements_with_id]
        print(f"DEBUG: All IDs found on page ({len(all_ids)}): {all_ids}")
        if target_id:
            if target_id in all_ids:
                print(f"DEBUG: ID '{target_id}' is present in the list of IDs on the page.")
            else:
                print(f"DEBUG: ID '{target_id}' is NOT present in the list of IDs on the page.")

    def extract_visible_text(self, selector_type, selector_value):
        self.random_delay()
        print(f"Extracting text from element ({selector_type}, {selector_value}) ...")
        # If selector_type is By.CLASS_NAME and multiple classes are needed, use CSS_SELECTOR instead
        if selector_type == By.CLASS_NAME and " " in selector_value:
            selector_type = By.CSS_SELECTOR
            selector_value = "." + ".".join(selector_value.split())
        element = self.driver.find_element(selector_type, selector_value)
        text = element.text
        print(f"Extracted {len(text)} characters.")
        return text

    def extract_heading_parent_div(self, heading_id):
        self.random_delay()
        print(f"Custom extraction: Finding h2#{heading_id} and its parent div...")
        self.debug_print_page_source_and_ids(heading_id)
        try:
            wait = WebDriverWait(self.driver, 10)
            h2 = wait.until(EC.presence_of_element_located((By.ID, heading_id)))
            parent_div = h2.find_element(By.XPATH, "./..")
            text = parent_div.text
            print(f"Extracted {len(text)} characters from parent div of h2#{heading_id}.")
            return text
        except (NoSuchElementException, TimeoutException):
            print(f"ERROR: Could not find h2#{heading_id} on the page.")
            return ""

    def close(self):
        print("Closing browser...")
        self.driver.quit()

def send_to_gemini(text):
    print("Sending extracted text to Gemini for JSON conversion...")
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = (
        "Please take all the important information in this text and output it as a json file with relevant fields and headers.\n\n"
        f"Text:\n{text}"
    )
    response = model.generate_content(prompt)
    print("Received response from Gemini.")
    return response.text

def clean_markdown_code_block(text):
    # Remove Markdown code block markers if present
    if text.strip().startswith("```"):
        lines = text.strip().splitlines()
        # Remove the first line (```json or ```)
        lines = lines[1:]
        # Remove the last line if it's ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return text

def process_source(scraper, context, source):
    source_name = source["name"]
    url = source["url"]

    if was_source_scraped(context, source_name):
        print(f"Data from '{url}' ({source_name}) has already been scraped and stored in context.json. Skipping Gemini query.")
        return

    scraper.navigate_to_page(url)

    # Remove overlay for ATO sources (those with custom_heading_id)
    if "custom_heading_id" in source:
        scraper.remove_menu_overlay()
        page_content_text = scraper.extract_heading_parent_div(source["custom_heading_id"])
        if not page_content_text.strip():
            print(f"[ERROR] Could not extract content for '{source_name}' (custom_heading_id: {source['custom_heading_id']}) on {url}. Skipping Gemini query and not marking as scraped.")
            return
    else:
        selector_type = source["selector_type"]
        selector_value = source["selector_value"]
        try:
            page_content_text = scraper.extract_visible_text(selector_type, selector_value)
            if not page_content_text.strip():
                print(f"[ERROR] Could not extract content for '{source_name}' (selector: {selector_type}, value: {selector_value}) on {url}. Skipping Gemini query and not marking as scraped.")
                return
        except Exception as e:
            print(f"[ERROR] Exception while extracting content for '{source_name}' (selector: {selector_type}, value: {selector_value}) on {url}: {e}")
            print("Skipping Gemini query and not marking as scraped.")
            return

    print("Text extraction complete. Sending to Gemini...")
    gemini_output = send_to_gemini(page_content_text)
    print("Gemini JSON output:")
    print(gemini_output)
    cleaned_output = clean_markdown_code_block(gemini_output)
    print(f"Saving Gemini output and scrape flag for '{source_name}' to {CONTEXT_JSON_PATH} ...")
    if "data" not in context:
        context["data"] = {}
    if source_name not in context["data"]:
        context["data"][source_name] = []
    try:
        parsed = json.loads(cleaned_output)
    except Exception:
        parsed = {"raw_output": cleaned_output}
    context["data"][source_name].append(parsed)
    set_source_scraped(context, source_name)
    save_context(context)
    print("Saved successfully.")

if __name__ == "__main__":
    context = load_context()
    scraper = WebScraper()
    try:
        for source in SOURCES:
            print(f"\n--- Processing source: {source['name']} ---")
            process_source(scraper, context, source)
    finally:
        scraper.close()