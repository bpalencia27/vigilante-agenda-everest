import pytest

def test_mock_server_http_status(mock_server):
    """Verify that local mock server runs and returns status 200."""
    import urllib.request
    resp = urllib.request.urlopen(mock_server.url)
    assert resp.status == 200
    html = resp.read().decode("utf-8")
    assert "Everest Intelligent - Portal Clínico" in html

def test_synthetic_patient_dom_elements(page):
    """Verify synthetic clinical DOM elements required by Vigilante exist."""
    # Check patient name & ID
    patient_text = page.inner_text("#app-index-container")
    assert "BRANDON JESUS PALENCIA MARTINEZ" in patient_text
    assert "1143142498" in patient_text
    
    # Check required calendar selectors (.labelHora, .status-label)
    assert page.is_visible(".labelHora")
    assert page.is_visible(".status-label")

def test_userscript_injection_and_ui_rendering(page, browser_harness):
    """Verify Userscript injects, creates #vgl-root, and renders primary UI panels."""
    # Verify main root overlay
    vgl_root = page.locator("#vgl-root")
    assert vgl_root.is_visible() or vgl_root.count() > 0
    
    # Verify macOS titlebar window controls
    assert page.locator("#vgl-tls").count() > 0
    
    # Verify Dock pill
    assert page.locator("#vgl-dock").count() > 0
    
    # Verify Sidebar container
    assert page.locator("#vgl-sidebar").count() > 0
    
    # Verify Statistics widget
    assert page.locator("#vgl-stats").count() > 0
    
    # Verify zero uncaught JS errors
    assert len(browser_harness.page_errors) == 0, f"Uncaught JS errors: {browser_harness.page_errors}"
