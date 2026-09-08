# -*- coding: utf-8 -*-
# Verificación Chromium del CSS v18.8.2 del widget RCV (CLAUDE.md):
# el color esperado debe sobrevivir a un CSS "Everest" simulado agresivo
# div,span,p,b,small,label,button{color:magenta !important}.
import re, sys, pathlib

RAIZ = pathlib.Path(r"E:\CENTINELA\vigilante-agenda-everest\.claude\worktrees\sf-v18.6.1-fix")
TMP = pathlib.Path(r"C:\Users\brand\.claude\jobs\60f8f919\tmp")

fuente = (RAIZ / "vigilante_agenda.user.js").read_text(encoding="utf-8")
ini = fuente.index("#vgl-rcv-pendientes{\n        position:fixed;left:16px;bottom:16px;z-index:var(--z-widget);")
fin = fuente.index("#vgl-rcv-pendientes .vgl-rcvp-cerrar:focus-visible{outline:2px solid var(--c-azul);outline-offset:1px}")
css_widget = fuente[ini:fin + len("#vgl-rcv-pendientes .vgl-rcvp-cerrar:focus-visible{outline:2px solid var(--c-azul);outline-offset:1px}")]

panel_html = (TMP / "panel_102.html").read_text(encoding="utf-8")

TOKENS = """
:root{
  --bg-solid:#090c12;
  --fg:#f7fafc;--fg2:rgba(226,232,240,.90);--fg3:#9aa7ba;
  --c-rojo:#ff8177;--rgb-rojo:255,129,119;
  --c-ambar:#ffc46b;--rgb-ambar:255,196,107;
  --c-verde:#4ff0b8;--rgb-verde:79,240,184;
  --c-azul:#a78bfa;--rgb-azul:167,139,250;
  --c-panel:#2dd4bf;
  --r-chip:14px;--r-card:18px;--r-surface:22px;--r-field:14px;--r-pill:999px;
  --t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;--t-nano:10px;--t-mini:11px;--t-small:13px;
  --z-widget:2147480000;
  --line:rgba(255,255,255,.07);--edge:rgba(255,255,255,.13);
  --font-stack:system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --shadow-float:0 0 0 1px rgba(255,255,255,.08), 0 16px 38px rgba(0,0,0,.40);
}
"""

EVEREST = """
/* CSS de Everest simulado — adversario agresivo: toda etiqueta de texto en magenta, con !important */
div,span,p,b,small,label,button{color:rgb(255,0,255) !important}
"""

pagina = f"""<!doctype html><html><head><meta charset="utf-8"><title>Verificacion RCV v18.8.2</title>
<style>
{EVEREST}
{TOKENS}
{css_widget}
</style>
</head><body>
<div id="vgl-rcv-pendientes">{panel_html}</div>
</body></html>"""

(TMP / "pagina_102.html").write_text(pagina, encoding="utf-8")
print("página escrita:", (TMP / "pagina_102.html").stat().st_size, "bytes")

from playwright.sync_api import sync_playwright

MAGENTA = "rgb(255, 0, 255)"
ESPERADOS = {
    "button.vgl-rcvp-cerrar": "rgba(226, 232, 240, 0.9)",   # --fg2
    ".vgl-rcvp-tit": "rgb(247, 250, 252)",                  # --fg
    ".vgl-rcvp-prog": "rgba(226, 232, 240, 0.9)",           # --fg2
    ".vgl-rcvp-cont": "rgb(45, 212, 191)",                  # --c-panel
    ".vgl-rcvp-chip-vencido": "rgb(255, 129, 119)",         # --c-rojo
    ".vgl-rcvp-chip-proximo": "rgb(255, 196, 107)",         # --c-ambar
    ".vgl-rcvp-chip-pendiente": "rgb(167, 139, 250)",       # --c-azul
    ".vgl-rcvp-chip-aldia": "rgb(79, 240, 184)",            # --c-verde
    ".vgl-rcvp-nom": "rgb(247, 250, 252)",                  # --fg
    ".vgl-rcvp-fechas": "rgba(226, 232, 240, 0.9)",         # --fg2
    ".vgl-rcvp-pie": "rgb(154, 167, 186)",                  # --fg3
}
ROJO_HOVER = "rgb(255, 129, 119)"                            # --c-rojo
AZUL_FOCUS = "rgb(167, 139, 250)"                            # --c-azul

fallos = []

def verificar(page, selector, esperado, etiqueta):
    color = page.eval_on_selector(selector, "el => getComputedStyle(el).color")
    ok = color == esperado and color != MAGENTA
    print(("OK  " if ok else "FALLO ") + etiqueta + ": " + color + (" (esperaba " + esperado + ")" if not ok else ""))
    if not ok:
        fallos.append(etiqueta + ": " + color)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    page.goto((TMP / "pagina_102.html").as_uri())
    for sel, esp in ESPERADOS.items():
        verificar(page, sel, esp, sel)

    # hover real sobre el botón de cierre → --c-rojo
    page.hover("button.vgl-rcvp-cerrar")
    color = page.eval_on_selector("button.vgl-rcvp-cerrar", "el => getComputedStyle(el).color")
    ok = color == ROJO_HOVER
    print(("OK  " if ok else "FALLO ") + "hover botón cierre: " + color)
    if not ok:
        fallos.append("hover: " + color)

    # focus por teclado → outline azul del focus-visible
    page.mouse.click(0, 0)
    page.keyboard.press("Tab")
    foco = page.evaluate("() => { const el = document.activeElement; return el ? {tag: el.tagName, clase: el.className} : null; }")
    print("elemento enfocado:", foco)
    if foco and foco.get("clase") == "vgl-rcvp-cerrar":
        outline = page.eval_on_selector("button.vgl-rcvp-cerrar", "el => getComputedStyle(el).outlineColor")
        ok = outline == AZUL_FOCUS
        print(("OK  " if ok else "FALLO ") + "focus-visible outline: " + outline)
        if not ok:
            fallos.append("focus-visible: " + outline)
    else:
        print("FALLO focus-visible: el Tab no enfocó el botón de cierre")
        fallos.append("focus-visible: Tab no enfocó el botón")

    browser.close()

print("\nRESULTADO:", "VERDE — ningún color lo pisó el CSS Everest simulado" if not fallos else "ROJO — " + str(fallos))
sys.exit(1 if fallos else 0)
