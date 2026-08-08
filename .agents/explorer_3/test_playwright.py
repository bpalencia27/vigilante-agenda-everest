import asyncio
import sys
from playwright.async_api import async_playwright

async def main():
    print("Testing Playwright chromium headless launch...")
    try:
        async with async_playwright() as p:
            print("Launching Chromium (headless=True)...")
            browser = await p.chromium.launch(headless=True)
            print("Browser launched successfully.")
            context = await browser.new_context()
            page = await context.new_page()
            
            # Use local data URL to test rendering & JS execution without external network
            test_html = "<html><body><h1 id='title'>Playwright Test Success</h1></body></html>"
            await page.goto(f"data:text/html,{test_html}")
            
            heading = await page.inner_text("#title")
            eval_result = await page.evaluate("() => 40 + 2")
            print(f"Page heading content: '{heading}'")
            print(f"Page JS evaluation result: {eval_result}")
            
            await browser.close()
            print("Browser closed successfully. Headless test passed!")
            return True
    except Exception as e:
        print(f"Playwright launch failed with error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    if not success:
        sys.exit(1)
