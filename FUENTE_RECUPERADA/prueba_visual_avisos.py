# -*- coding: utf-8 -*-
"""Muestra un aviso de cada tipo y guarda una captura para revisarlos."""

import sys
import time
from pathlib import Path

from PIL import ImageGrab

from vigilante_agenda import AvisadorEscritorio, Config

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DESTINO = Path(sys.argv[1] if len(sys.argv) > 1 else "avisos_muestra.png")

print("duracion_toast_ms por defecto:", Config().duracion_toast_ms,
      "(0 = se cierran solo con la X)")

av = AvisadorEscritorio()
av.avisar("10:20 · Ruth Ester", "Llego dentro del margen de 5:59.",
          "exito", Config().duracion_toast_ms)
av.avisar("11:00 · Prueba Uno", "Vencio el margen de 5:59 sin registro de entrada.",
          "inasistencia", Config().duracion_toast_ms)
av.avisar("11:00 · Prueba Uno", "Confirmada 15 min tarde, con el margen ya vencido.",
          "fraude", Config().duracion_toast_ms)
av.avisar("2 pacientes ya estaban en sala", "Sus llegadas no se pudieron presenciar.",
          "info", Config().duracion_toast_ms)

time.sleep(4)
img = ImageGrab.grab()
ancho, alto = img.size
img.crop((ancho - 480, 40, ancho, 480)).save(DESTINO)
print("captura:", DESTINO.resolve(), img.size)


def ventanas_visibles():
    """Toplevels de Tk de este proceso que estan en pantalla."""
    import ctypes
    import os
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    mipid = os.getpid()
    vistas = []

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
        if buf.value == "tk" and rect.right - rect.left > 100:
            vistas.append(hwnd)
        return True

    user32.EnumWindows(cb, 0)
    return vistas


# Siguen abiertos: prueba de que NO se cierran solos.
time.sleep(6)
n = len(ventanas_visibles())
print("tras 10 s siguen abiertos:", n, "de 4")
if n != 4:
    raise SystemExit("FALLA: alguno se cerro solo")
print("OK: ninguno se cierra solo, hay que pulsar la X")
