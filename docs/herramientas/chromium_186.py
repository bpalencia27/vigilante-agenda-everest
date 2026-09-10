# -*- coding: utf-8 -*-
# Verificación Chromium del CSS v18.8.6 del widget RCV (CLAUDE.md):
# botón de minimizar «—» y pastilla de reapertura #vgl-rcv-pendientes-pill.
# El color esperado debe sobrevivir a un CSS "Everest" simulado agresivo
# div,span,p,b,small,label,button{color:magenta !important} — la pastilla es
# un <button> SIN clase: su único escudo es la regla por id con !important.
# Re-verifica además TODO el juego de colores v18.8.2 (regresión completa).
import re, sys, pathlib

RAIZ = pathlib.Path(r"E:\CENTINELA\vigilante-agenda-everest\.claude\worktrees\sf-v18.6.1-fix")
TMP = pathlib.Path(r"C:\Users\brand\.claude\jobs\60f8f919\tmp")

fuente = (RAIZ / "vigilante_agenda.user.js").read_text(encoding="utf-8")
ini = fuente.index("#vgl-rcv-pendientes{\n        position:fixed;left:16px;bottom:16px;z-index:var(--z-widget);")
fin_marker = "#vgl-rcv-pendientes-pill:focus-visible{outline:2px solid var(--c-azul);outline-offset:2px}"
fin = fuente.index(fin_marker)
css_widget = fuente[ini:fin + len(fin_marker)]

panel_html = (TMP / "panel_186.html").read_text(encoding="utf-8")

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
  --z-modal:2147483000;
  --line:rgba(255,255,255,.07);--edge:rgba(255,255,255,.13);
  --font-stack:system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --shadow-float:0 0 0 1px rgba(255,255,255,.08), 0 16px 38px rgba(0,0,0,.40);
  --shadow-panel:0 0 0 1px rgba(255,255,255,.08), 0 2px 6px rgba(0,0,0,.28), 0 16px 38px rgba(0,0,0,.40);
}
"""

EVEREST = """
/* CSS de Everest simulado — adversario agresivo: toda etiqueta de texto en magenta, con !important */
div,span,p,b,small,label,button{color:rgb(255,0,255) !important}
"""

pill_html = (
    '<button type="button" id="vgl-rcv-pendientes-pill" '
    'aria-label="Volver a abrir el panel de próximos exámenes">▣ Próximos exámenes</button>'
)

pagina = f"""<!doctype html><html><head><meta charset="utf-8"><title>Verificacion RCV v18.8.6</title>
<style>
{EVEREST}
{TOKENS}
{css_widget}
</style>
</head><body>
<div id="vgl-rcv-pendientes">{panel_html}</div>
{pill_html}
</body></html>"""

(TMP / "pagina_186.html").write_text(pagina, encoding="utf-8")
print("página escrita:", (TMP / "pagina_186.html").stat().st_size, "bytes")

from playwright.sync_api import sync_playwright

MAGENTA = "rgb(255, 0, 255)"
FG2 = "rgba(226, 232, 240, 0.9)"
FG = "rgb(247, 250, 252)"
BG_SOLID = "rgb(9, 12, 18)"
AZUL = "rgb(167, 139, 250)"     # --c-azul
ROJO = "rgb(255, 129, 119)"     # --c-rojo

ESPERADOS = {
    # Regresión v18.8.2 completa
    "button.vgl-rcvp-cerrar": FG2,
    ".vgl-rcvp-tit": FG,
    ".vgl-rcvp-prog": FG2,
    ".vgl-rcvp-cont": "rgb(45, 212, 191)",            # --c-panel
    ".vgl-rcvp-chip-vencido": ROJO,
    ".vgl-rcvp-chip-proximo": "rgb(255, 196, 107)",   # --c-ambar
    ".vgl-rcvp-chip-pendiente": AZUL,
    ".vgl-rcvp-chip-aldia": "rgb(79, 240, 184)",      # --c-verde
    ".vgl-rcvp-nom": FG,
    ".vgl-rcvp-fechas": FG2,
    ".vgl-rcvp-pie": "rgb(154, 167, 186)",            # --fg3
    # v18.8.6 — botón de minimizar y pastilla
    "button.vgl-rcvp-min": FG2,
    "#vgl-rcv-pendientes-pill": FG,
}

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
    page.goto((TMP / "pagina_186.html").as_uri())
    for sel, esp in ESPERADOS.items():
        verificar(page, sel, esp, sel)

    # v18.8.6 — el minimizar mide 28×28 (mínimo táctil WCAG 2.5.8)
    dims = page.eval_on_selector("button.vgl-rcvp-min", "el => ({w: el.offsetWidth, h: el.offsetHeight})")
    ok = dims["w"] == 28 and dims["h"] == 28
    print(("OK  " if ok else "FALLO ") + "botón «—» 28×28: " + str(dims))
    if not ok:
        fallos.append("dimensiones min: " + str(dims))

    # v18.8.6 — hover del minimizar: AZUL (minimizar no destruye, nunca rojo)
    page.hover("button.vgl-rcvp-min")
    color = page.eval_on_selector("button.vgl-rcvp-min", "el => getComputedStyle(el).color")
    ok = color == AZUL
    print(("OK  " if ok else "FALLO ") + "hover botón «—»: " + color + (" (esperaba azul)" if not ok else ""))
    if not ok:
        fallos.append("hover min: " + color)

    # v18.8.6 — pastilla: fondo sólido del tema (nunca magenta ni transparente),
    # posición fija abajo-izquierda y z-index por ENCIMA de --z-modal
    bg = page.eval_on_selector("#vgl-rcv-pendientes-pill", "el => getComputedStyle(el).backgroundColor")
    ok = bg == BG_SOLID
    print(("OK  " if ok else "FALLO ") + "fondo de la pastilla: " + bg)
    if not ok:
        fallos.append("bg pill: " + bg)
    pos = page.eval_on_selector("#vgl-rcv-pendientes-pill",
        "el => { const s = getComputedStyle(el); return {position: s.position, left: s.left, bottom: s.bottom, z: s.zIndex}; }")
    ok = (pos["position"] == "fixed" and pos["left"] == "14px" and pos["bottom"] == "58px" and pos["z"] == "2147483001")
    print(("OK  " if ok else "FALLO ") + "posición de la pastilla (fixed, left 14, bottom 58, z 2147483001): " + str(pos))
    if not ok:
        fallos.append("pos pill: " + str(pos))

    # v18.8.6 — hover de la pastilla: azul
    page.hover("#vgl-rcv-pendientes-pill")
    color = page.eval_on_selector("#vgl-rcv-pendientes-pill", "el => getComputedStyle(el).color")
    ok = color == AZUL
    print(("OK  " if ok else "FALLO ") + "hover pastilla: " + color + (" (esperaba azul)" if not ok else ""))
    if not ok:
        fallos.append("hover pill: " + color)

    # Foco por teclado en orden de DOM: cierre → «—» → pastilla; outline azul en las tres
    page.mouse.click(0, 0)
    for esperado_clase, etiqueta in [("vgl-rcvp-cerrar", "cierre"), ("vgl-rcvp-min", "«—»"), (None, "pastilla")]:
        page.keyboard.press("Tab")
        foco = page.evaluate("() => { const el = document.activeElement; return el ? {tag: el.tagName, clase: el.className, id: el.id} : null; }")
        ok_foco = (foco and ((esperado_clase and foco.get("clase") == esperado_clase) or (esperado_clase is None and foco.get("id") == "vgl-rcv-pendientes-pill")))
        if ok_foco:
            outline = page.evaluate("() => getComputedStyle(document.activeElement).outlineColor")
            ok = outline == AZUL
            print(("OK  " if ok else "FALLO ") + "focus-visible " + etiqueta + ": " + outline)
            if not ok:
                fallos.append("focus-visible " + etiqueta + ": " + outline)
        else:
            print("FALLO focus-visible " + etiqueta + ": Tab no enfocó el elemento esperado " + str(foco))
            fallos.append("focus-visible " + etiqueta + ": " + str(foco))

    browser.close()

print("\nRESULTADO:", "VERDE — ningún color lo pisó el CSS Everest simulado" if not fallos else "ROJO — " + str(fallos))
sys.exit(1 if fallos else 0)
