---
name: playwright_windows_automation
description: Use this skill to visually navigate, test, and capture screenshots of web applications when running in a Windows background session (where the standard browser subagent fails).
---

# Windows Session 0 Browser Automation

1. **Recognize the Environment**: If the OS is Windows and you need to perform visual browser tasks, do not use `invoke_subagent` for `/browser` as it will fail due to background session limits.
2. **Install Dependencies**: Run `pip install playwright` and `playwright install chromium` via `run_command`.
3. **Local Server (Optional but Recommended)**: If testing a local HTML file with API calls, start a local server (e.g., `python -m uvicorn ...` or `python -m http.server`) to avoid CORS/file:// issues.
4. **Write the Script**: Create an `asyncio` Python script using `playwright.async_api`. 
5. **Headless Mode**: Ensure `headless=True` is set in `p.chromium.launch()`.
6. **Capture Artifacts**: Use `await page.screenshot(path="<artifacts_dir>/scratch/screenshot.png", full_page=True)` to capture visual proof.
7. **View and Verify**: Execute the script with `run_command`, then read the generated screenshot or terminal output to verify the UI state.
