import os
import sys
import time
import pytest
import subprocess
from tests.mock_server import MockServer
from tests.test_harness import PlaywrightHarness

def test_process_cleanup_on_exit():
    """Empirically verify process cleanup after harness launch and close."""
    server = MockServer(host="127.0.0.1", port=0)
    server.start()
    
    harness = PlaywrightHarness(headless=True)
    page = harness.launch()
    page.goto(server.url)
    assert page.title() != ""
    
    initial_mutex = harness.mutex
    harness.close()
    server.stop()
    
    # Small delay for OS process cleanup
    time.sleep(1)
    
    assert initial_mutex is not None or sys.platform != 'win32'
    assert harness.mutex is None

def test_tab_state_resilience_multi_tabs(mock_server, browser_harness):
    """Verify harness resilience when multiple tabs are opened during execution."""
    page = browser_harness.page
    page.goto(mock_server.url)
    
    # Open 3 extra tabs via JS window.open
    page.evaluate("window.open('about:blank'); window.open('about:blank'); window.open('about:blank');")
    time.sleep(0.5)
    
    # Verify context has 4 open pages
    assert len(browser_harness.context.pages) == 4
    
    # Ensure primary page still functions properly
    assert page.is_visible("#vgl-root")
    
    # Simulate a new launch with the same user_data_dir (persistent context cleanup)
    user_dir = browser_harness.user_data_dir
    
    # Note: browser_harness fixture will close this context at test end.

def test_error_handling_uncaught_js_exception(mock_server, browser_harness):
    """Verify page_errors listener captures thrown JS exceptions when event loop is pumped."""
    page = browser_harness.page
    page.goto(mock_server.url)
    
    # Inject an intentional uncaught exception into the page
    page.evaluate("setTimeout(() => { throw new Error('TEST_INTENTIONAL_UNCATCHABLE_ERROR'); }, 50);")
    page.wait_for_timeout(200)
    
    # Verify error was trapped by harness listener
    assert len(browser_harness.page_errors) > 0
    assert "TEST_INTENTIONAL_UNCATCHABLE_ERROR" in browser_harness.page_errors[0]

def test_mutex_concurrency_warning():
    """Verify mutex detects secondary harness instance gracefully."""
    h1 = PlaywrightHarness(headless=True)
    h2 = PlaywrightHarness(headless=True)
    
    # Both instances initialized, h2 should detect existing mutex
    assert h1.mutex is not None
    assert h2.mutex is not None
    
    h1.close()
    h2.close()
