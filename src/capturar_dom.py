"""
Utilidad de captura para el equipo de la empresa (uso una sola vez, con sesión ya iniciada).

Qué hace:
  1. Se adjunta al Chrome que ya está abierto en modo depuración (puerto 9222).
  2. Busca la pestaña que muestre 'Citas del día' (o cualquiera de Everest).
  3. Guarda en Escritorio\\Reportes_Vigilante_Copiloto\\captura_dom_<fecha>.txt:
       - URL de la pestaña
       - conteo de cada selector que usa el Vigilante (.labelHora, .status-label, ...)
       - el resultado del extractor oficial (JSON de citas)
       - los elementos clicables con su texto (para hallar el menú 'Citas del día')
       - el HTML de la primera tarjeta de cita (para verificar/ajustar selectores)

Con ese archivo se afinan los selectores y la auto-navegación de la pestaña-clon.

Uso (en el equipo de la empresa, con Everest abierto en 'Citas del día'):
    vigilante_capturar_dom.exe        (o)   python src/capturar_dom.py
"""

import os
import json
from datetime import datetime

from playwright.sync_api import sync_playwright
from agenda_monitor import JS_EXTRAER_AGENDA, JS_ES_AGENDA  # reutiliza el script oficial

CDP_PORT = 9222

JS_SELECTOR_COUNTS = """
() => {
  const sels = ['.labelHora','.status-label','.card','.card-body','.text-muted',
                '.text-uppercase','.fw-bold.mb-0','.fecha','.text-uppercase.fw-bold'];
  const out = {};
  for (const s of sels) { try { out[s] = document.querySelectorAll(s).length; } catch(e){ out[s] = 'err'; } }
  return out;
}
"""

JS_CLICKABLES = """
() => {
  const els = Array.from(document.querySelectorAll('a, button, [role="button"], [routerlink], .nav-link, li, span'));
  const seen = new Set();
  const out = [];
  for (const e of els) {
    const text = (e.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text || text.length > 60) continue;
    const key = e.tagName + '|' + text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      tag: e.tagName,
      text: text,
      routerlink: (e.getAttribute && e.getAttribute('routerlink')) || '',
      classes: (e.className && e.className.toString) ? e.className.toString().slice(0, 100) : ''
    });
    if (out.length >= 300) break;
  }
  return out;
}
"""

JS_FIRST_CARD = """
() => {
  const h = document.querySelector('.labelHora');
  if (!h) return '';
  const c = h.closest('.card-body') || h.closest('.card') || h.parentElement;
  return c ? c.outerHTML.slice(0, 5000) : '';
}
"""


def _report_dir():
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    root = desktop if os.path.isdir(desktop) else os.path.expanduser("~")
    d = os.path.join(root, "Reportes_Vigilante_Copiloto")
    os.makedirs(d, exist_ok=True)
    return d


def capturar():
    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{CDP_PORT}")
        except Exception as e:
            print(f"No se pudo adjuntar a Chrome en el puerto {CDP_PORT}.")
            print("Abra Chrome con 'Iniciar_Vigilante.bat' (deja el puerto de depuración activo)")
            print(f"e inicie sesión en Everest antes de ejecutar esta captura. Detalle: {e}")
            return

        context = browser.contexts[0] if browser.contexts else None
        if context is None:
            print("Chrome no tiene contextos abiertos.")
            return

        # Elegir la pestaña con la agenda; si no hay, la primera de Everest.
        target = None
        everest = None
        for page in context.pages:
            url = ""
            try:
                url = page.url or ""
            except Exception:
                pass
            if "everestintelligent.com" in url or "HCHealth" in url:
                everest = everest or page
                try:
                    if page.evaluate(JS_ES_AGENDA):
                        target = page
                        break
                except Exception:
                    pass
        target = target or everest
        if target is None:
            print("No se encontró ninguna pestaña de Everest abierta.")
            return

        def safe_eval(js, default):
            try:
                return target.evaluate(js)
            except Exception as ex:
                return f"[error evaluando: {ex}]" if isinstance(default, str) else default

        url = ""
        try:
            url = target.url
        except Exception:
            pass

        counts = safe_eval(JS_SELECTOR_COUNTS, {})
        agenda = safe_eval(JS_EXTRAER_AGENDA, {})   # el extractor toma 1 arg opcional; sin arg funciona
        clickables = safe_eval(JS_CLICKABLES, [])
        first_card = safe_eval(JS_FIRST_CARD, "")

        stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        out_path = os.path.join(_report_dir(), f"captura_dom_{stamp}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("===== CAPTURA DOM — VIGILANTE DE AGENDA =====\n")
            f.write(f"Fecha: {stamp}\nURL: {url}\n\n")
            f.write("----- CONTEO DE SELECTORES -----\n")
            f.write(json.dumps(counts, ensure_ascii=False, indent=2) + "\n\n")
            f.write("----- EXTRACTOR OFICIAL (JS_EXTRAER_AGENDA) -----\n")
            f.write(json.dumps(agenda, ensure_ascii=False, indent=2, default=str) + "\n\n")
            f.write("----- ELEMENTOS CLICABLES (para hallar 'Citas del día') -----\n")
            f.write(json.dumps(clickables, ensure_ascii=False, indent=2) + "\n\n")
            f.write("----- HTML DE LA PRIMERA TARJETA DE CITA -----\n")
            f.write(str(first_card) + "\n")

        print(f"Captura guardada en:\n  {out_path}")
        print("Envíe ese archivo para afinar selectores y la auto-navegación de la pestaña-clon.")


if __name__ == "__main__":
    capturar()
