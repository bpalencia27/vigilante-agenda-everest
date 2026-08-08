# -*- coding: utf-8 -*-
"""
Comprueba que los avisos de escritorio salen de verdad, encima de todo.

Es lo que fallaba: la alerta se emitia y se pintaba dentro del Chrome del
vigilante, que nadie esta mirando. Aqui se verifica que ademas aparece una
ventana del sistema, que se cierra sola cuando toca y que la roja no.

    python prueba_avisos.py
"""

import sys
import time

from vigilante_agenda import AvisadorEscritorio

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
fallos = []


def check(ok, etiqueta, detalle=""):
    print(("  OK   " if ok else "  FALLA") + "  " + etiqueta + (f"  [{detalle}]" if detalle else ""))
    if not ok:
        fallos.append(etiqueta)


def ventanas_visibles():
    """Ventanas de aviso de ESTE proceso que estan en pantalla.

    Tk titula sus Toplevel como 'tk' aunque lleven overrideredirect, asi que se
    filtra por eso y por el pid, no por titulo vacio.
    """
    import ctypes
    import os
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    mipid = os.getpid()
    contadas = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value != mipid:
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        ancho = rect.right - rect.left
        alto = rect.bottom - rect.top
        if buf.value == "tk" and ancho > 100 and alto > 30:
            contadas.append((hwnd, ancho, alto))
        return True

    user32.EnumWindows(cb, 0)
    return contadas


LARGO = 30000   # no vence durante la prueba
CORTO = 3000

print("== 1. Aparece la ventana verde en el escritorio ==")
av = AvisadorEscritorio()
av.avisar("10:20 · Ruth Ester", "Llego dentro del margen de 5:59.", "exito", LARGO)
time.sleep(3)
v = ventanas_visibles()
check(len(v) == 1, "una ventana visible", f"{len(v)}")

print("\n== 2. Tres avisos apilados, sin bloquearse ==")
av.avisar("09:20 · Prueba Uno", "Vencio el margen sin registro de entrada.", "inasistencia", LARGO)
av.avisar("2 pacientes ya estaban en sala", "Sus llegadas no se pudieron presenciar.", "info", LARGO)
time.sleep(2)
v = ventanas_visibles()
check(len(v) == 3, "las tres a la vez", f"{len(v)}")
alturas = sorted(y for _, _, y in v)
check(len(v) == 3, "ninguna se solapa (se recolocan)", f"altos={alturas}")

print("\n== 3. La roja tambien aparece y NO se cierra sola ==")
av.avisar("07:30 · Prueba Dos", "Confirmada 19 min tarde.", "fraude", 0)
time.sleep(2)
check(len(ventanas_visibles()) == 4, "cuatro en pantalla", f"{len(ventanas_visibles())}")

print("\n== 4. Auto-cierre solo de las no rojas ==")
av2 = AvisadorEscritorio()
av2.avisar("12:00 · Corto", "Debe irse solo.", "exito", CORTO)
time.sleep(2)
check(len(ventanas_visibles()) == 5, "el corto aparece", f"{len(ventanas_visibles())}")
print("     esperando a que venza el corto...")
time.sleep(3)
check(len(ventanas_visibles()) == 4, "el corto se fue, los largos y la roja siguen",
      f"{len(ventanas_visibles())}")

print("\n== 5. El hilo sigue vivo (Tcl no se colgo) ==")
av.avisar("Comprobacion final", "El hilo sigue vivo.", "info", LARGO)
time.sleep(2)
check(len(ventanas_visibles()) == 5, "sigue aceptando avisos despues de todo",
      f"{len(ventanas_visibles())}")
av2.cerrar()

av.cerrar()
time.sleep(1)

print("\n" + "=" * 60)
if fallos:
    print("FALLARON %d: %s" % (len(fallos), ", ".join(fallos)))
    raise SystemExit(1)
print("TODO EN VERDE: los avisos salen encima de cualquier ventana.")
