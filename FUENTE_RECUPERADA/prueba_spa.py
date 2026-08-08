# -*- coding: utf-8 -*-
"""
Reproduce el escenario real de Everest: SPA Angular, dos pestanas, y el medico
abriendo una historia clinica.

Comprueba que el vigilante:
  1. Elige la pestana donde la agenda esta pintada, no la primera que cuadre.
  2. Sigue trabajando si el medico navega OTRA pestana a una historia.
  3. Se da cuenta cuando la agenda desaparece de la pestana que vigilaba.
  4. La reencuentra sola cuando vuelve a estar visible en otra pestana.

    python prueba_spa.py
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from vigilante_agenda import Config, leer_agenda, localizar_pagina

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SIM = (Path(__file__).parent / "simulador_agenda_ips.html").resolve().as_uri()
fallos = []


def check(ok, etiqueta, detalle=""):
    print(("  OK   " if ok else "  FALLA") + "  " + etiqueta + (f"  [{detalle}]" if detalle else ""))
    if not ok:
        fallos.append(etiqueta)


# El patron acepta el simulador; simulamos el SPA vaciando/repintando el DOM.
cfg = Config()

with sync_playwright() as p:
    nav = p.chromium.launch(headless=True)
    ctx = nav.new_context()

    # Pestana A: la que el medico usa para trabajar (misma URL, es un SPA).
    trabajo = ctx.new_page()
    trabajo.goto(SIM, wait_until="commit")
    trabajo.wait_for_selector(".labelHora", timeout=15000)

    # Pestana B: la que queda con la agenda.
    agenda = ctx.new_page()
    agenda.goto(SIM, wait_until="commit")
    agenda.wait_for_selector(".labelHora", timeout=15000)

    print("== 1. Dos pestanas de Everest, ambas con agenda ==")
    elegida = localizar_pagina(ctx, cfg, abrir_si_falta=False)
    check(elegida is not None, "encuentra una pestana")

    print("\n== 2. El medico abre una historia en la pestana de trabajo ==")
    # Asi se comporta el SPA: reemplaza la vista, misma URL, sin .labelHora.
    trabajo.evaluate(
        "() => { document.body.innerHTML = "
        "'<div class=\"historia\">HISTORIA CLINICA DEL PACIENTE</div>'; }"
    )
    check(trabajo.evaluate("() => document.querySelectorAll('.labelHora').length") == 0,
          "la pestana de trabajo ya no tiene agenda")
    elegida = localizar_pagina(ctx, cfg, abrir_si_falta=False)
    check(elegida is agenda, "el vigilante elige la pestana que SI tiene la agenda")
    visible, _, citas = leer_agenda(elegida, "vglspa")
    check(visible and len(citas) > 0, "sigue leyendo las citas", f"{len(citas)} citas")

    print("\n== 3. Ahora la agenda desaparece tambien de la pestana vigilada ==")
    agenda.evaluate("() => { document.body.innerHTML = '<div>OTRA VISTA</div>'; }")
    visible, _, _ = leer_agenda(agenda, "vglspa")
    check(visible is False, "leer_agenda avisa que no ve nada (no revienta)")

    print("\n== 4. El medico vuelve a la agenda en la pestana de trabajo ==")
    trabajo.goto(SIM, wait_until="commit")
    trabajo.wait_for_selector(".labelHora", timeout=15000)
    elegida = localizar_pagina(ctx, cfg, abrir_si_falta=False)
    check(elegida is trabajo, "el vigilante se cambia solo a la pestana buena")
    visible, _, citas = leer_agenda(elegida, "vglspa")
    check(visible and len(citas) > 0, "vuelve a auditar sin reiniciar", f"{len(citas)} citas")

    print("\n== 5. Ninguna pestana con agenda ==")
    trabajo.evaluate("() => { document.body.innerHTML = '<div>HISTORIA</div>'; }")
    elegida = localizar_pagina(ctx, cfg, abrir_si_falta=False)
    check(elegida is not None, "conserva una pestana para reintentar (no la pierde)")
    visible, _, _ = leer_agenda(elegida, "vglspa")
    check(visible is False, "y reporta que esta ciego")

    nav.close()

print("\n" + "=" * 60)
if fallos:
    print("FALLARON %d: %s" % (len(fallos), ", ".join(fallos)))
    raise SystemExit(1)
print("TODO EN VERDE: el vigilante sobrevive al SPA y a las dos pestanas.")
