import os
import json
import re
import pytest
from datetime import datetime
from playwright.sync_api import Page, expect

def test_challenger_font_size_boundary(page: Page):
    """Challenger Boundary Test 1: Comprehensive font size audit across all UI components and modals."""
    # Open Scheduling modal to ensure modal elements are in DOM
    page.locator(".vgl-btn-agendar").first.click()
    expect(page.locator(".vgl-agm-card")).to_be_visible()

    # Audit font size across root, modals, toasts, dock, and sheets
    violations = page.evaluate("""
        () => {
            const containers = [
                document.querySelector('#vgl-root'),
                document.querySelector('#vgl-dock'),
                document.querySelector('#vgl-toasts'),
                document.querySelector('#vgl-agendar-modal'),
                document.querySelector('#vgl-ordenar-modal')
            ].filter(Boolean);

            const violations = [];
            for (const root of containers) {
                const elements = root.querySelectorAll('*');
                for (const el of elements) {
                    if (el.classList.contains('vgl-tl') || el.closest('#vgl-tls')) {
                        continue; // Traffic light window control dots (12px circular shapes)
                    }
                    const text = el.innerText || el.textContent;
                    if (el.children.length === 0 && text && text.trim().length > 0) {
                        const comp = window.getComputedStyle(el);
                        const size = parseFloat(comp.fontSize);
                        if (size < 11.9) {
                            violations.push({
                                tag: el.tagName,
                                class: el.className,
                                id: el.id,
                                text: text.trim().slice(0, 30),
                                fontSize: comp.fontSize,
                                parent: el.parentElement ? el.parentElement.className : ''
                            });
                        }
                    }
                }
            }
            return violations;
        }
    """)
    assert len(violations) == 0, f"Empirical Challenger found font size violations (<12px): {violations}"

    # Close modal
    page.locator("#vgl-agm-x").click()


def test_challenger_line_height_boundary(page: Page):
    """Challenger Boundary Test 2: Line height ratio check across text containers."""
    lh_metrics = page.evaluate("""
        () => {
            const targets = [
                { name: 'root', el: document.querySelector('#vgl-root') },
                { name: 'summary', el: document.querySelector('#vgl-sum') },
                { name: 'empty_msg', el: document.querySelector('#vgl-empty') }
            ];

            const results = {};
            for (const t of targets) {
                if (t.el) {
                    const comp = window.getComputedStyle(t.el);
                    const fs = parseFloat(comp.fontSize);
                    const lh = parseFloat(comp.lineHeight);
                    results[t.name] = { fontSize: fs, lineHeight: comp.lineHeight, ratio: lh / fs };
                }
            }
            return results;
        }
    """)
    for name, data in lh_metrics.items():
        assert 1.35 <= data["ratio"] <= 1.55, f"Line height ratio out of [1.35, 1.55] bounds for {name}: {data}"


def test_challenger_7_business_days_boundary(page: Page):
    """Challenger Boundary Test 3: Verify 7 business day chips (±3 business days) & weekend exclusion across all presets."""
    page.locator(".vgl-btn-agendar").first.click()
    expect(page.locator(".vgl-agm-card")).to_be_visible()

    presets_to_test = ["15 días", "1 mes", "2 meses", "3 meses"]
    for ptext in presets_to_test:
        page.locator("#vgl-time-presets button.vgl-agm-pbtn").filter(has_text=ptext).click()
        page.wait_for_timeout(200)

        day_chips = page.locator("#vgl-day-chips button.vgl-agm-pbtn")
        count = day_chips.count()
        assert count == 7, f"Preset '{ptext}' did not render exactly 7 chips, found {count}"

        # 4th chip (index 3) must be center target date with 🎯 marker
        center_chip = day_chips.nth(3)
        expect(center_chip).to_contain_text("🎯")
        assert "active" in center_chip.get_attribute("class"), f"Center chip in preset '{ptext}' is not active"

        # Verify no chip falls on weekend (Saturday / Sunday)
        for i in range(7):
            txt = day_chips.nth(i).inner_text()
            assert not re.search(r"\b(Sá|Do)\b", txt, re.IGNORECASE), f"Weekend day found in preset '{ptext}' chip {i}: {txt}"

    page.locator("#vgl-agm-x").click()


def test_challenger_csv_export_creation(page: Page, tmp_path):
    """Challenger Boundary Test 4: CSV export file creation, structure, UTF-8 BOM, and content integrity."""
    page.locator("#vgl-rep").click()
    sheet = page.locator("#vgl-sheet")
    expect(sheet).to_be_visible()

    exp_btn = page.locator("#vgl-exp")
    expect(exp_btn).to_be_visible()

    with page.expect_download() as download_info:
        exp_btn.click()

    download = download_info.value
    suggested_fn = download.suggested_filename
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    assert suggested_fn == f"auditoria_vigilante_{today_str}.csv", f"Unexpected CSV filename: {suggested_fn}"

    file_path = os.path.join(tmp_path, suggested_fn)
    download.save_as(file_path)

    assert os.path.exists(file_path), "Downloaded CSV file does not exist on disk"
    assert os.path.getsize(file_path) > 0, "Downloaded CSV file is empty"

    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read()

    assert "REPORTE CLINICO DE ATENCION - VIGILANTE DE AGENDA" in content
    assert "Confirmaciones extemporáneas;" in content
    assert "Inasistencias registradas;" in content
    assert "Ingresos a tiempo;" in content

    # Close sheet
    sheet.locator("button[data-x='1']").click()


def test_challenger_theme_persistence_and_reload(page: Page, mock_server):
    """Challenger Boundary Test 5: Theme switching, root class toggle, localStorage persistence and page reload survival."""
    root = page.locator("#vgl-root")
    
    # 1. Switch to light theme
    page.locator("#vgl-cfg").click()
    sheet = page.locator("#vgl-sheet")
    expect(sheet).to_be_visible()

    theme_select = page.locator("#c-tema")
    theme_select.select_option("claro")
    expect(root).to_have_class(re.compile(r"\blight\b"))

    # Verify localStorage state
    cfg1 = json.loads(page.evaluate("() => localStorage.getItem('vgl_cfg')"))
    assert cfg1.get("tema") == "claro"

    # Close settings sheet
    sheet.locator("button[data-x='1']").click()

    # 2. Reload page to verify persistence across reloads
    page.reload()
    page.wait_for_selector("#vgl-root", state="attached", timeout=10000)
    root_reloaded = page.locator("#vgl-root")
    expect(root_reloaded).to_have_class(re.compile(r"\blight\b"))

    # 3. Switch back to dark theme
    page.locator("#vgl-cfg").click()
    sheet = page.locator("#vgl-sheet")
    expect(sheet).to_be_visible()

    theme_select = page.locator("#c-tema")
    theme_select.select_option("oscuro")
    expect(root_reloaded).not_to_have_class(re.compile(r"\blight\b"))

    cfg2 = json.loads(page.evaluate("() => localStorage.getItem('vgl_cfg')"))
    assert cfg2.get("tema") == "oscuro"

    sheet.locator("button[data-x='1']").click()
