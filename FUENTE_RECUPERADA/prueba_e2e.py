# -*- coding: utf-8 -*-
"""
Prueba end-to-end contra el simulador, con navegador real y headless.

Cubre lo que los tests unitarios no pueden: que el JS de extraccion lea de
verdad el DOM, que el toast verde se pinte, que el refresco pulse 'Consultar'
y que el latido aparezca. No toca Everest ni el vigilante que este corriendo.

    python prueba_e2e.py
"""

import datetime as dt
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from vigilante_agenda import (
    CONFIANZA_PARCIAL, CONFIANZA_PLENA, EN_REGLA, TZ_BOGOTA,
    Config, MotorAuditoria, leer_agenda, mostrar_alerta, mostrar_latido,
    refrescar_agenda,
)

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SIM = (Path(__file__).parent / "simulador_agenda_ips.html").resolve().as_uri()
fallos = []


def check(ok, etiqueta, detalle=""):
    print(("  OK   " if ok else "  FALLA") + "  " + etiqueta + (f"  [{detalle}]" if detalle else ""))
    if not ok:
        fallos.append(etiqueta)


with sync_playwright() as p:
    nav = p.chromium.launch(headless=True)
    pagina = nav.new_page()
    pagina.goto(SIM, wait_until="commit")
    pagina.wait_for_selector(".labelHora", timeout=15000)

    print("== 1. Extraccion del DOM ==")
    visible, fecha_texto, citas = leer_agenda(pagina, "vglprueba")
    check(visible, "la agenda se ve")
    check(len(citas) > 0, "se leyeron filas", f"{len(citas)} citas")
    check(all(c.hora is not None for c in citas), "todas las filas tienen hora legible")
    con_doc = sum(1 for c in citas if c.documento)
    check(con_doc == len(citas), "todas traen documento", f"{con_doc}/{len(citas)}")
    con_nombre = sum(1 for c in citas if c.nombre)
    check(con_nombre == len(citas), "todas traen nombre", f"{con_nombre}/{len(citas)}")
    print("     estados leidos:", sorted({c.estado_dom for c in citas}))

    print("\n== 2. Motor: verde al ver la llegada ==")
    hoy = dt.date.today()
    motor = MotorAuditoria(Config(), hoy)
    ref = citas[0]
    h, mi = ref.hora

    def instante(desplaz_min):
        base = dt.datetime.combine(hoy, dt.time(h, mi), tzinfo=TZ_BOGOTA)
        return base + dt.timedelta(minutes=desplaz_min)

    from vigilante_agenda import CitaObservada

    def fila(estado):
        return CitaObservada(
            hora_texto=ref.hora_texto, documento=ref.documento, nombre=ref.nombre,
            edad=ref.edad, modalidad=ref.modalidad, estado_dom=estado,
            indice=ref.indice, marca_dom=ref.marca_dom,
        )

    motor.procesar([fila("Sin presentarse")], instante(1))
    eventos = motor.procesar([fila("En Sala")], instante(3))
    check(len(eventos) == 1, "se emite un evento al llegar dentro de la gracia")
    check(eventos and eventos[0].tipo == EN_REGLA, "el evento es EN_REGLA (verde)")
    check(eventos and "A TIEMPO" in eventos[0].mensaje, "el mensaje dice A TIEMPO",
          eventos[0].mensaje if eventos else "")
    reg = next(iter(motor.registros.values()))
    check(reg.confianza == CONFIANZA_PLENA, "confianza PLENA: vio la transicion")

    print("\n== 3. Motor: arranque tardio no acusa (regresion) ==")
    tardio = MotorAuditoria(Config(), hoy)
    eventos = tardio.procesar([fila("En Sala")], instante(120))
    reg = next(iter(tardio.registros.values()))
    check(eventos == [], "no emite ninguna alerta")
    check(reg.resultado == EN_REGLA, "queda EN_REGLA, no extemporaneo", reg.resultado)
    check(reg.confianza == CONFIANZA_PARCIAL, "confianza PARCIAL")
    check("no se puede certificar" in reg.nota, "la nota declara la duda")

    print("\n== 4. Toast verde pintado en la pagina ==")
    mostrar_alerta(pagina, "A TIEMPO - 06:00 Prueba ya se encuentra En Sala.", "exito", 9000)
    pagina.wait_for_timeout(400)
    fondo = pagina.evaluate(
        "() => { const s = document.getElementById('vgl-toast-stack');"
        " if (!s || !s.lastElementChild) return null;"
        " return getComputedStyle(s.lastElementChild).backgroundColor; }"
    )
    check(fondo == "rgb(27, 107, 58)", "el toast es verde #1b6b3a", str(fondo))

    print("\n== 5. Toast rojo sigue funcionando ==")
    mostrar_alerta(pagina, "REGISTRO EXTEMPORANEO - prueba", "fraude", 0)
    pagina.wait_for_timeout(400)
    fondo = pagina.evaluate(
        "() => getComputedStyle(document.getElementById('vgl-toast-stack')"
        ".lastElementChild).backgroundColor"
    )
    check(fondo == "rgb(179, 38, 30)", "el toast es rojo #b3261e", str(fondo))

    print("\n== 6. Refresco: pulsa 'Consultar' ==")
    check(refrescar_agenda(pagina) is True, "el boton Consultar se pulso")
    pagina.wait_for_timeout(500)
    visible2, _, citas2 = leer_agenda(pagina, "vglprueba2")
    check(visible2 and len(citas2) == len(citas), "la agenda sigue legible tras refrescar",
          f"{len(citas2)} citas")

    print("\n== 7. Latido ==")
    mostrar_latido(pagina, "Vigilante activo - prueba", True)
    pagina.wait_for_timeout(300)
    texto = pagina.evaluate(
        "() => { const e = document.getElementById('vgl-latido-texto');"
        " return e ? e.textContent : null; }"
    )
    check(texto == "Vigilante activo - prueba", "la pastilla de latido se pinta", str(texto))

    nav.close()

print("\n" + "=" * 60)
if fallos:
    print("FALLARON %d comprobacion(es): %s" % (len(fallos), ", ".join(fallos)))
    raise SystemExit(1)
print("TODO EN VERDE: el flujo completo funciona contra el simulador.")
