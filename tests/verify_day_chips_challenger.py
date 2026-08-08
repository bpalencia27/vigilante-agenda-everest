import os
import sys
import tempfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from tests.mock_server import MockServer
from playwright.sync_api import sync_playwright

def verify():
    server = MockServer(host="127.0.0.1", port=0)
    server.start()
    print(f"Mock server started at: {server.url}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(server.url)
            page.wait_for_selector("#vgl-root", timeout=10000)

            # Open scheduling modal
            agendar_btn = page.locator(".vgl-btn-agendar").first
            agendar_btn.click()
            page.wait_for_selector(".vgl-agm-card", state="visible", timeout=5000)

            # Click 15 días preset to generate day chips
            presets = page.locator("#vgl-time-presets button.vgl-agm-pbtn")
            presets.filter(has_text="15 días").click()
            page.wait_for_timeout(300)

            # Evaluate computed styles of all day chips (.vgl-agm-pbtn) inside #vgl-agendar-modal or .vgl-agm-card
            chips_styles = page.evaluate("""
                () => {
                    const modal = document.querySelector('#vgl-agendar-modal') || document.querySelector('.vgl-agm-card');
                    const chips = modal.querySelectorAll('.vgl-agm-pbtn');
                    return Array.from(chips).map((chip, i) => {
                        const cs = window.getComputedStyle(chip);
                        return {
                            index: i,
                            text: (chip.innerText || chip.textContent).trim(),
                            fontSize: cs.fontSize,
                            fontSizePx: parseFloat(cs.fontSize)
                        };
                    });
                }
            """)

            print(f"Total buttons/chips found inside modal: {len(chips_styles)}")
            violations = []
            for c in chips_styles:
                safe_text = c['text'].encode('ascii', errors='replace').decode('ascii')
                print(f"  Chip [{c['index']}]: text='{safe_text}', fontSize='{c['fontSize']}' ({c['fontSizePx']}px)")
                if c["fontSizePx"] < 11.9:
                    violations.append(c)

            if violations:
                print(f"FAIL: {len(violations)} day chip(s) have font-size < 12px: {violations}")
                sys.exit(1)
            else:
                print("SUCCESS: All day chips and preset buttons inside scheduling modal have computed font-size >= 12px!")

    finally:
        server.stop()

if __name__ == "__main__":
    verify()
