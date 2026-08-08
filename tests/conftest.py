import os
import pytest
from tests.mock_server import MockServer
from tests.test_harness import PlaywrightHarness

@pytest.fixture(scope="session")
def mock_server():
    server = MockServer(host="127.0.0.1", port=0)
    server.start()
    yield server
    server.stop()

@pytest.fixture(scope="function")
def browser_harness(request):
    # Headless mode can be overridden via HEADLESS environment variable (default: False / 0)
    headless_env = os.environ.get("HEADLESS", "0").lower() in ("1", "true", "yes")
    harness = PlaywrightHarness(headless=headless_env)
    try:
        harness.launch()
        yield harness
    finally:
        # Auto-capture screenshot on test failure
        if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
            test_name = request.node.name
            try:
                harness.take_screenshot(f"failure_{test_name}")
            except Exception:
                pass
        harness.close()

@pytest.fixture(scope="function")
def page(browser_harness, mock_server):
    page_obj = browser_harness.page
    page_obj.goto(mock_server.url)
    
    # Wait for Userscript to auto-inject and render #vgl-root
    page_obj.wait_for_selector("#vgl-root", state="attached", timeout=10000)
    return page_obj

@pytest.hookimpl(hookwrapper=True, trylast=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)
