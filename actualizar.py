# -*- coding: utf-8 -*-
"""
Instala la ultima version compilada del Vigilante en esta carpeta.

Antes de ejecutarlo hay que CERRAR el vigilante (la ventana negra de consola)
y su ventana de Chrome. El script lo comprueba y avisa si sigue abierto.

    python actualizar.py
"""

import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AQUI = Path(__file__).parent
NUEVO = AQUI / "FUENTE_RECUPERADA" / "dist" / "vigilante_agenda"


def corriendo(nombre):
    try:
        salida = subprocess.run(
            ["tasklist", "/FI", f"IMAGENAME eq {nombre}", "/NH"],
            capture_output=True, text=True, timeout=20,
        ).stdout
    except Exception:
        return False
    return nombre.lower() in salida.lower()


def main():
    if not (NUEVO / "vigilante_agenda.exe").is_file():
        print("No encuentro la version nueva en:", NUEVO)
        return 1

    if corriendo("vigilante_agenda.exe"):
        print("El vigilante SIGUE ABIERTO.")
        print("Cierre su ventana negra de consola (o pulse Ctrl+C en ella) y")
        print("cierre tambien la ventana de Chrome que abrio. Luego repita esto.")
        return 1

    # Chrome puede seguir sujetando archivos del perfil un instante.
    time.sleep(1)

    respaldo = AQUI / "version_anterior"
    if respaldo.exists():
        shutil.rmtree(respaldo, ignore_errors=True)
    respaldo.mkdir(parents=True, exist_ok=True)

    try:
        if (AQUI / "vigilante_agenda.exe").is_file():
            shutil.move(str(AQUI / "vigilante_agenda.exe"),
                        str(respaldo / "vigilante_agenda.exe"))
        if (AQUI / "_internal").is_dir():
            shutil.move(str(AQUI / "_internal"), str(respaldo / "_internal"))

        shutil.copy2(NUEVO / "vigilante_agenda.exe", AQUI / "vigilante_agenda.exe")
        shutil.copytree(NUEVO / "_internal", AQUI / "_internal")
    except PermissionError as exc:
        print("No se pudo reemplazar: hay algo usando los archivos.")
        print("Cierre el vigilante y Chrome por completo.  Detalle:", exc)
        return 1

    version = subprocess.run(
        [str(AQUI / "vigilante_agenda.exe"), "--version"],
        capture_output=True, text=True, timeout=60,
    ).stdout.strip()
    print("Instalado:", version)
    print("Version anterior guardada en:", respaldo)
    print()
    print("Ya puede abrir vigilante_agenda.exe con doble clic.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
