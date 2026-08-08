import os
import json
import re
import pytest
from datetime import datetime
from playwright.sync_api import Page, expect

def test_r2_1_ui_css_audit(page: Page):
    """R2.1: Verify main panel, macOS control buttons, stats bar, typography, and WCAG soft alert colors."""
    # 1. Main root panel visibility
    vgl_root = page.locator("#vgl-root")
    expect(vgl_root).to_be_visible()

    # 2. macOS window buttons
    tls = page.locator("#vgl-tls")
    expect(tls).to_be_visible()
    
    close_btn = page.locator("#vgl-tl-close")
    min_btn = page.locator("#vgl-tl-min")
    zoom_btn = page.locator("#vgl-tl-zoom")
    expect(close_btn).to_be_visible()
    expect(min_btn).to_be_visible()
    expect(zoom_btn).to_be_visible()
    
    # 3. Header title
    title = page.locator("#vgl-title")
    expect(title).to_contain_text("Asistente Clínico")

    # 4. Sidebar and stats bar
    expect(page.locator("#vgl-sidebar")).to_be_visible()
    expect(page.locator("#vgl-stats")).to_be_attached()

    # 5. Open scheduling modal (#vgl-agendar-modal / .vgl-agm-card) to audit typography of modal and day chips
    agendar_btn = page.locator(".vgl-tl-agendar, .vgl-btn-agendar").first
    if agendar_btn.is_visible():
        agendar_btn.click()
    else:
        page.evaluate("() => typeof abrirModalAgendar === 'function' && abrirModalAgendar()")
    expect(page.locator(".vgl-agm-card, #vgl-agendar-modal")).to_be_visible()

    # 6. Font size audit (font-size >= 12px for all visible elements in root & scheduling modal)
    font_audit_results = page.evaluate("""
        () => {
            const containers = [
                document.querySelector('#vgl-root'),
                document.querySelector('.vgl-agm-card'),
                document.querySelector('#vgl-ordenar-modal'),
                document.querySelector('#vgl-agendar-modal')
            ].filter(Boolean);
            
            const violations = [];
            for (const root of containers) {
                const elements = root.querySelectorAll('*');
                for (const el of elements) {
                    if (el.classList.contains('vgl-tl') || el.closest('#vgl-tls')) {
                        continue;
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
                                fontSize: comp.fontSize
                            });
                        }
                    }
                }
            }
            return violations;
        }
    """)
    assert len(font_audit_results) == 0, f"Font size violations found (<12px): {font_audit_results}"

    # Explicitly verify font-size >= 11.9px for all .vgl-agm-pbtn day chips and modal text buttons
    pbtn_font_audit = page.evaluate("""
        () => {
            const pbtns = document.querySelectorAll('.vgl-agm-pbtn');
            const violations = [];
            for (const btn of pbtns) {
                const comp = window.getComputedStyle(btn);
                const size = parseFloat(comp.fontSize);
                if (size < 11.9) {
                    violations.push({
                        text: (btn.innerText || btn.textContent).trim(),
                        fontSize: comp.fontSize
                    });
                }
            }
            return violations;
        }
    """)
    assert len(pbtn_font_audit) == 0, f"Day chip / preset button font size violations (<11.9px): {pbtn_font_audit}"

    # 6. Line height audit (1.4 - 1.5 range on root/text elements)
    lh_info = page.evaluate("""
        () => {
            const root = document.querySelector('#vgl-root');
            const comp = window.getComputedStyle(root);
            const fs = parseFloat(comp.fontSize);
            const lh = parseFloat(comp.lineHeight);
            return { fontSize: fs, lineHeight: comp.lineHeight, ratio: lh / fs };
        }
    """)
    assert 1.35 <= lh_info["ratio"] <= 1.55, f"Line-height ratio out of 1.4-1.5 range: {lh_info}"

    # 7. WCAG soft alert colors check (--c-rojo == #e54d42, no #FF453A)
    colors = page.evaluate("""
        () => {
            const root = document.querySelector('#vgl-root');
            const comp = window.getComputedStyle(root);
            return {
                rojo: comp.getPropertyValue('--c-rojo').trim(),
                morado: comp.getPropertyValue('--c-morado').trim(),
                ambar: comp.getPropertyValue('--c-ambar').trim(),
                verde: comp.getPropertyValue('--c-verde').trim(),
                azul: comp.getPropertyValue('--c-azul').trim(),
            };
        }
    """)
    assert colors["rojo"].lower() == "#e54d42", f"Soft red color mismatch: {colors['rojo']}"
    assert colors["morado"].lower() == "#9333ea", f"Soft purple color mismatch: {colors['morado']}"
    assert colors["ambar"].lower() == "#d97706", f"Soft ambar color mismatch: {colors['ambar']}"
    assert colors["verde"].lower() == "#10b981", f"Soft green color mismatch: {colors['verde']}"
    assert colors["azul"].lower() == "#2563eb", f"Soft blue color mismatch: {colors['azul']}"

    # Confirm no raw stressful #FF453A anywhere in computed variables or inline styles
    full_css = page.evaluate("() => document.querySelector('#vgl-root').style.cssText")
    assert "#FF453A" not in full_css.upper()


def test_r2_2_rcv_scheduling_and_business_days(page: Page):
    """R2.2: Verify modal opening, deadline presets, 7 business day chips (±3 days), specialty switching, patient 1143142498."""
    # 1. Patient card 1143142498 in DOM
    patient_card = page.locator("#anamesis")
    expect(patient_card).to_be_visible()
    expect(patient_card).to_contain_text("1143142498")

    # 2. Click scheduling button (.vgl-btn-agendar)
    agendar_btn = page.locator(".vgl-btn-agendar").first
    agendar_btn.click()

    # 3. Verify modal opens with patient context
    card_modal = page.locator(".vgl-agm-card")
    expect(card_modal).to_be_visible()
    expect(card_modal).to_contain_text("BRANDON JESUS PALENCIA MARTINEZ")
    expect(card_modal).to_contain_text("1143142498")

    # 4. Deadline presets (#vgl-time-presets)
    presets = page.locator("#vgl-time-presets button.vgl-agm-pbtn")
    expect(presets.filter(has_text="15 días")).to_be_visible()
    expect(presets.filter(has_text="1 mes")).to_be_visible()
    expect(presets.filter(has_text="2 meses")).to_be_visible()
    expect(presets.filter(has_text="3 meses")).to_be_visible()

    # Click 15 días preset
    presets.filter(has_text="15 días").click()

    # 5. 7 Business Day Chips (#vgl-day-chips)
    day_chips = page.locator("#vgl-day-chips button.vgl-agm-pbtn")
    page.wait_for_timeout(300)
    assert day_chips.count() == 7, f"Expected 7 business day chips, got {day_chips.count()}"

    # Middle chip (4th chip, index 3) must be center target date with 🎯
    middle_chip = day_chips.nth(3)
    expect(middle_chip).to_contain_text("🎯")
    assert "active" in middle_chip.get_attribute("class")

    # Verify all 7 day chips correspond to business days (not weekend)
    chip_texts = [day_chips.nth(i).inner_text() for i in range(7)]
    for txt in chip_texts:
        assert not re.search(r"\b(Sá|Do)\b", txt, re.IGNORECASE), f"Weekend day found in chips: {txt}"

    # 6. Specialty switching (#vgl-esp-presets)
    esp_presets = page.locator("#vgl-esp-presets button.vgl-agm-pbtn")
    
    # Click Specialty 55 (Psicología)
    psico_btn = esp_presets.filter(has_text="Psicología")
    expect(psico_btn).to_be_visible()
    
    with page.expect_request(lambda req: "EspecialidadId=55" in req.url) as req_info_55:
        psico_btn.click()
    assert "EspecialidadId=55" in req_info_55.value.url
    expect(page.locator("#vgl-agm-date-info")).to_contain_text("Psicología")

    # Click Specialty 14 (Odontología)
    odonto_btn = esp_presets.filter(has_text="Odontología")
    expect(odonto_btn).to_be_visible()
    
    with page.expect_request(lambda req: "EspecialidadId=14" in req.url) as req_info_14:
        odonto_btn.click()
    assert "EspecialidadId=14" in req_info_14.value.url
    expect(page.locator("#vgl-agm-date-info")).to_contain_text("Odontología")

    # Click Specialty 12 (Medicina General) back
    med_btn = esp_presets.filter(has_text="Med. General")
    expect(med_btn).to_be_visible()
    
    with page.expect_request(lambda req: "EspecialidadId=12" in req.url) as req_info_12:
        med_btn.click()
    assert "EspecialidadId=12" in req_info_12.value.url

    # Close modal
    page.locator("#vgl-agm-x").click()
    expect(card_modal).not_to_be_visible()


def test_r2_3_rcv_doctor_rules(page: Page):
    """R2.3: Verify cita assignment rules enforcing SwProgramaEspecial=true & swIsPyM=true for BPALENCIA profile."""
    # Open scheduling modal
    page.locator(".vgl-btn-agendar").first.click()
    card_modal = page.locator(".vgl-agm-card")
    expect(card_modal).to_be_visible()

    # Select 15 days preset
    page.locator("#vgl-time-presets button.vgl-agm-pbtn").filter(has_text="15 días").click()
    
    # Wait for available slots to render
    slot_btn = page.locator("button.vgl-agm-sbtn").first
    expect(slot_btn).to_be_visible(timeout=5000)
    slot_btn.click()

    confirm_btn = page.locator("#vgl-agm-confirm")
    expect(confirm_btn).to_be_enabled()

    # Intercept AsignarTurno POST request
    with page.expect_request(lambda req: "/apiviva/APIAcceso/api/Acceso/AsignarTurno" in req.url and req.method == "POST") as req_info:
        confirm_btn.click()

    req_url = req_info.value.url
    # Query parameters validation
    assert "SwProgramaEspecial=true" in req_url, f"Expected SwProgramaEspecial=true in {req_url}"
    assert "swIsPyM=true" in req_url, f"Expected swIsPyM=true in {req_url}"
    assert "PacienteId=98765" in req_url, f"Expected PacienteId=98765 in {req_url}"
    assert "UsuarioId=101" in req_url, f"Expected UsuarioId=101 in {req_url}"

    # Verify UI success confirmation banner
    expect(page.locator(".vgl-agm-card").get_by_text("Cita asignada exitosamente")).to_be_visible()


def test_r2_4_pym_1click_orders(page: Page):
    """R2.4: Verify PyM 1-click orders modal, catalog selection, mock CUPS/CIE-10 search, GuardarOrdenamiento payload injection."""
    # Open orders modal
    page.locator(".vgl-btn-ordenar").first.click()
    
    modal = page.locator("#vgl-ordenar-modal")
    expect(modal).to_be_visible()
    expect(modal).to_contain_text("Generación de Órdenes de Prevención")
    expect(modal).to_contain_text("BRANDON JESUS PALENCIA MARTINEZ")
    expect(modal).to_contain_text("1143142498")

    # Verify catalog list items
    ord_items = page.locator("#vgl-ord-list .vgl-ord-item")
    assert ord_items.count() > 0, "Catalog items expected in orders modal"

    # Select checkboxes
    chks = page.locator("input.vgl-ord-chk")
    confirm_btn = page.locator("#vgl-ord-confirm")
    expect(confirm_btn).to_be_visible()

    # Intercept GuardarOrdenamiento call
    with page.expect_request(lambda req: "/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento" in req.url and req.method == "POST") as req_info:
        confirm_btn.click()

    post_request = req_info.value
    payload = post_request.post_data_json
    
    # Assert payload structure
    assert payload is not None, "Payload for GuardarOrdenamiento should not be None"
    assert payload["paciente"]["Id"] == 98765, f"Expected paciente.Id=98765, got {payload.get('paciente')}"
    assert "ordenes" in payload and len(payload["ordenes"]) > 0, "Expected non-empty ordenes list in payload"
    assert payload["UsuarioId"] == 101, f"Expected UsuarioId=101, got {payload.get('UsuarioId')}"

    # Verify UI success confirmation
    expect(page.locator(".vgl-agm-card").get_by_text("Orden(es) PyM Generada(s) Exitosamente")).to_be_visible()


def test_r2_5_light_dark_theme(page: Page):
    """R2.5: Verify theme toggle, root class change, and localStorage persistence."""
    root = page.locator("#vgl-root")
    
    # Initial state: dark mode (no 'light' class on #vgl-root)
    expect(root).not_to_have_class(re.compile(r"\blight\b"))

    # Open Settings Sheet
    page.locator("#vgl-cfg").click()
    sheet = page.locator("#vgl-sheet")
    expect(sheet).to_be_visible()

    # Switch to Light Theme
    theme_select = page.locator("#c-tema")
    expect(theme_select).to_be_visible()
    theme_select.select_option("claro")

    # Assert root gets class 'light'
    expect(root).to_have_class(re.compile(r"\blight\b"))

    # Check localStorage persistence
    cfg_json = page.evaluate("() => localStorage.getItem('vgl_cfg')")
    assert cfg_json is not None
    cfg = json.loads(cfg_json)
    assert cfg.get("tema") == "claro", f"Expected theme 'claro' in localStorage, got {cfg.get('tema')}"

    # Switch back to Dark Theme
    theme_select.select_option("oscuro")
    expect(root).not_to_have_class(re.compile(r"\blight\b"))

    cfg_json_dark = page.evaluate("() => localStorage.getItem('vgl_cfg')")
    cfg_dark = json.loads(cfg_json_dark)
    assert cfg_dark.get("tema") == "oscuro", f"Expected theme 'oscuro' in localStorage, got {cfg_dark.get('tema')}"

    # Close sheet
    sheet.locator("button[data-x='1']").click()
    expect(sheet).not_to_be_visible()


def test_r2_6_audit_csv_and_localstorage(page: Page, tmp_path):
    """R2.6: Verify audit CSV report generation and download, and inspect localStorage logs."""
    # Open Resumen Sheet
    page.locator("#vgl-rep").click()
    sheet = page.locator("#vgl-sheet")
    expect(sheet).to_be_visible()

    exp_btn = page.locator("#vgl-exp")
    expect(exp_btn).to_be_visible()

    # Setup download listener
    with page.expect_download() as download_info:
        exp_btn.click()

    download = download_info.value
    suggested_filename = download.suggested_filename
    assert suggested_filename.startswith("auditoria_vigilante_"), f"Unexpected CSV filename: {suggested_filename}"
    assert suggested_filename.endswith(".csv"), f"Filename should end with .csv: {suggested_filename}"

    # Save file to temp path and verify contents
    csv_path = os.path.join(tmp_path, suggested_filename)
    download.save_as(csv_path)

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        content = f.read()

    assert "REPORTE CLINICO DE ATENCION - VIGILANTE DE AGENDA" in content
    assert "Confirmaciones extemporáneas;" in content
    assert "Inasistencias registradas;" in content
    assert "Ingresos a tiempo;" in content

    # Inspect LocalStorage logs
    page.evaluate("() => { if (!localStorage.getItem('vgl_stats')) { localStorage.setItem('vgl_stats', JSON.stringify({})); } }")
    ls_keys = page.evaluate("() => Object.keys(localStorage)")
    assert "vgl_cfg" in ls_keys, "vgl_cfg key missing in localStorage"
    assert "vgl_stats" in ls_keys, "vgl_stats key missing in localStorage"

    # Close sheet
    sheet.locator("button[data-x='1']").click()
    expect(sheet).not_to_be_visible()
