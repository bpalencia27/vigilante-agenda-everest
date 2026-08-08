# -*- coding: utf-8 -*-
"""
Detecta y corrige los falsos REGISTRO EXTEMPORANEO del Vigilante de Agenda.

El bug
------
Si el vigilante arranca despues del limite de gracia de una cita que YA estaba
confirmada, no observo la llegada: no puede saber a que hora llego el paciente.
Aun asi la declara REGISTRO_EXTEMPORANEO con confianza PLENA, y el "retraso"
que reporta es en realidad la distancia entre la hora de la cita y la hora de
arranque del programa.

La huella del artefacto queda en los propios datos:

    ultimo_visto_pendiente == ""   -> el vigilante NUNCA vio la fila pendiente

Un extemporaneo legitimo siempre tiene ese campo poblado y posterior al limite,
porque el vigilante vio la fila pendiente despues de vencida la ventana. Por eso
la deteccion no debilita los hallazgos reales.

Uso
---
    python corregir_reporte.py --revisar      # solo diagnostica, no toca nada
    python corregir_reporte.py                # aplica la correccion (con backup)
    python corregir_reporte.py --fecha 2026-07-28
"""

import argparse
import csv
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SALIDA_POR_DEFECTO = Path(r"C:\Users\viva1a\Desktop\Reportes_Vigilante_Copiloto")
PREFIJOS_FORMULA = ("=", "+", "-", "@")

COL = {"paciente": 4, "resultado": 8, "confianza": 9,
       "minutos": 11, "observacion": 12, "evidencia": 13}

ETIQUETAS_RESUMEN = {
    "Citas en regla": "EN_REGLA",
    "Inasistencias": "INASISTENCIA",
    # Se aceptan los dos nombres: los reportes anteriores a la 2.4.0 usan el
    # primero, y este script tiene que poder corregirlos igual.
    "Registros extemporaneos": "REGISTRO_EXTEMPORANEO",
    "Confirmaciones tardias": "REGISTRO_EXTEMPORANEO",
    "Confirmaciones tardías": "REGISTRO_EXTEMPORANEO",
    "Canceladas o reagendadas": "EXCLUIDA",
    "En curso al cierre": "PENDIENTE",
}

PLANTILLA_NOTA = (
    "Correccion automatica {stamp}: el vigilante nunca observo esta fila "
    "pendiente (primera lectura {primera}, ya confirmada). El retraso que se "
    "habia reportado era artefacto de la hora de arranque del programa, no del "
    "paciente. Confianza PARCIAL: la hora de llegada no es certificable por "
    "observacion propia."
)


def sanear(valor):
    """Mismo blindaje anti inyeccion de formulas que usa el vigilante."""
    texto = "" if valor is None else str(valor)
    return "'" + texto if texto.startswith(PREFIJOS_FORMULA) else texto


def vigilante_vivo():
    try:
        salida = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq vigilante_agenda.exe", "/NH"],
            capture_output=True, text=True, timeout=20,
        ).stdout
    except Exception:
        return False
    return "vigilante_agenda.exe" in salida


def es_artefacto(cita):
    """Extemporaneo que el vigilante no pudo observar: nunca la vio pendiente."""
    return (cita.get("resultado") == "REGISTRO_EXTEMPORANEO"
            and not cita.get("ultimo_visto_pendiente"))


def recontar(datos):
    conteo = {}
    for cita in datos["citas"]:
        conteo[cita["resultado"]] = conteo.get(cita["resultado"], 0) + 1
    for clave in datos["resumen"]:
        datos["resumen"][clave] = conteo.get(clave, 0)
    return datos["resumen"]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fecha", default=dt.date.today().isoformat(),
                    help="Fecha del turno a revisar (YYYY-MM-DD). Hoy por defecto.")
    ap.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO,
                    help="Carpeta de reportes del vigilante.")
    ap.add_argument("--revisar", action="store_true",
                    help="Solo diagnostica: no modifica ningun archivo.")
    args = ap.parse_args()

    salida, fecha = args.salida, args.fecha
    estado = salida / f"estado_vigilante_{fecha}.json"
    reporte_json = salida / f"auditoria_agenda_{fecha}.json"
    reporte_csv = salida / f"auditoria_agenda_{fecha}.csv"
    evidencias = salida / "evidencias"

    if not estado.is_file():
        print("No encuentro", estado)
        return 1

    datos = json.loads(estado.read_text(encoding="utf-8"))
    sospechosas = [c for c in datos["citas"] if es_artefacto(c)]
    legitimas = [c for c in datos["citas"]
                 if c.get("resultado") == "REGISTRO_EXTEMPORANEO" and not es_artefacto(c)]

    print(f"Turno {fecha}: {len(datos['citas'])} citas")
    print(f"  Extemporaneos legitimos (vistos pendientes tras el limite): {len(legitimas)}")
    for c in legitimas:
        print(f"    OK  {c['hora']}  {c['nombre']}  pendiente hasta {c['ultimo_visto_pendiente'][11:19]}")
    print(f"  Extemporaneos NO certificables (artefacto de arranque): {len(sospechosas)}")
    for c in sospechosas:
        print(f"    XX  {c['hora']}  {c['nombre']}  1a lectura {c['primer_visto'][11:19]} ya confirmada")

    if not sospechosas:
        print("\nNada que corregir.")
        return 0
    if args.revisar:
        print("\n(--revisar: no se modifico nada)")
        return 0

    # Solo estorba si tocamos la carpeta real: sobre una copia no hay conflicto.
    if salida.resolve() == SALIDA_POR_DEFECTO.resolve() and vigilante_vivo():
        print("\nABORTADO: vigilante_agenda.exe sigue corriendo y reescribiria el")
        print("reporte. Cierralo (Ctrl+C en su consola) y vuelve a ejecutar esto.")
        return 1

    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    claves = {c["clave"] for c in sospechosas}
    nombres = {c["nombre"] for c in sospechosas}

    backup = salida / ("_backup_" + dt.datetime.now().strftime("%Y%m%d_%H%M%S"))
    backup.mkdir(parents=True, exist_ok=True)
    for p in (estado, reporte_json, reporte_csv):
        if p.is_file():
            shutil.copy2(p, backup / p.name)
    print("\nCopia de seguridad en:", backup)

    # ---------- JSON: estado reanudable + reporte ----------
    for ruta in (estado, reporte_json):
        if not ruta.is_file():
            continue
        d = json.loads(ruta.read_text(encoding="utf-8"))
        for cita in d["citas"]:
            if cita["clave"] in claves:
                cita["resultado"] = "EN_REGLA"
                cita["confianza"] = "PARCIAL"
                cita["nota"] = PLANTILLA_NOTA.format(
                    stamp=stamp, primera=cita["primer_visto"][11:19])
                cita["alertas_emitidas"] = []
                cita["evidencias"] = []
        resumen = recontar(d)
        ruta.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
        print("  corregido:", ruta.name, "|", resumen)

    # ---------- CSV ----------
    if reporte_csv.is_file():
        with reporte_csv.open(encoding="utf-8-sig", newline="") as fh:
            filas = list(csv.reader(fh, delimiter=";"))
        resumen = json.loads(estado.read_text(encoding="utf-8"))["resumen"]
        for fila in filas:
            if len(fila) > COL["evidencia"] and fila[COL["paciente"]] in nombres:
                fila[COL["resultado"]] = "En regla"
                fila[COL["confianza"]] = "Parcial"
                fila[COL["minutos"]] = ""
                fila[COL["observacion"]] = sanear(PLANTILLA_NOTA.format(
                    stamp=stamp, primera="ver JSON"))
                fila[COL["evidencia"]] = ""
            elif len(fila) == 2 and fila[0] in ETIQUETAS_RESUMEN:
                fila[1] = str(resumen.get(ETIQUETAS_RESUMEN[fila[0]], fila[1]))
        tmp = reporte_csv.with_suffix(".csv.tmp")
        with tmp.open("w", encoding="utf-8-sig", newline="") as fh:
            csv.writer(fh, delimiter=";", quoting=csv.QUOTE_MINIMAL).writerows(filas)
        tmp.replace(reporte_csv)
        print("  corregido:", reporte_csv.name)

    # ---------- Evidencias falsas ----------
    if evidencias.is_dir():
        descartadas = evidencias / "descartadas_correccion"
        for cita in sospechosas:
            patron = f"{cita['fecha']}_{cita['hora'].replace(':', '_')}_REGISTRO_EXTEMPORANEO.png"
            png = evidencias / patron
            if png.is_file():
                descartadas.mkdir(parents=True, exist_ok=True)
                shutil.move(str(png), str(descartadas / png.name))
                print("  apartada:", png.name)

    print("\nListo. Al relanzar el vigilante debe decir "
          f"'Turno reanudado: {len(datos['citas'])} citas ya auditadas hoy'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
