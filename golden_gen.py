#!/usr/bin/env python3
"""Generador de VECTORES DORADOS.

Ejecuta las funciones REALES del Copiloto sobre vectores sinteticos y graba
entrada -> salida en tests/golden/<funcion>.json, con el SHA-256 del archivo
Python de origen.

La suite JS lee esos archivos y exige que la funcion portada reproduzca cada
salida. Si manana cambia la regla en Python, cambia el hash y la suite cae.

NUNCA se usan datos de pacientes: todos los vectores son sinteticos.
"""
import datetime
import hashlib
import importlib.util
import itertools
import json
import os
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))

# El Python del Copiloto NO se copia a este repositorio: se lee de su propio
# clon. Vendorizarlo seria crear una tercera copia de la logica clinica, que es
# justo el problema que este arnes existe para vigilar. Lo que SI se versiona
# aqui es el SHA-256 de cada archivo de origen, dentro de cada dorado: con eso
# se detecta que la regla cambio alla aunque el clon no este a mano.
#
#   VA_COPILOTO=/ruta/al/clon  python3 golden_gen.py
MOTOR = os.environ.get("VA_COPILOTO") or os.path.join(os.path.dirname(RAIZ), "VA_copiloto")
if not os.path.isdir(MOTOR):
    sys.exit(
        "No encuentro el clon del Copiloto en '%s'.\n"
        "Los vectores dorados se generan ejecutando su Python REAL.\n"
        "  git clone https://github.com/bpalencia27/everest-rcv-copiloto.git E:/VA_copiloto\n"
        "  VA_COPILOTO=E:/VA_copiloto python3 golden_gen.py" % MOTOR)
SALIDA = os.path.join(RAIZ, "tests", "golden")
os.makedirs(SALIDA, exist_ok=True)


def cargar(nombre):
    ruta = os.path.join(MOTOR, nombre + ".py")
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[nombre] = mod
    spec.loader.exec_module(mod)
    return mod


def sha(nombre):
    with open(os.path.join(MOTOR, nombre + ".py"), "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def jsonable(v):
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, (list, tuple)):
        return [jsonable(x) for x in v]
    if isinstance(v, set):
        return sorted(jsonable(x) for x in v)
    if isinstance(v, dict):
        return {str(k): jsonable(x) for k, x in v.items()}
    if hasattr(v, "model_dump"):
        return jsonable(v.model_dump())
    if hasattr(v, "__dict__") and not isinstance(v, (str, int, float, bool, type(None))):
        return jsonable(vars(v))
    return v


def d(s):
    return datetime.date.fromisoformat(s)


# --------------------------------------------------------------------------
#  Vectores. Cada entrada: (modulo, funcion, [args...], nota opcional)
#  Cubren: caso normal, bordes, nulos, basura y limites clinicos.
# --------------------------------------------------------------------------
def vectores_fechas():
    fechas = []
    # un anio entero de 2026 y 2027 dia por dia: cubre TODOS los festivos y domingos
    for anio in (2026, 2027):
        f = datetime.date(anio, 1, 1)
        while f.year == anio:
            fechas.append(f)
            f += datetime.timedelta(days=1)
    # y un anio fuera de tabla, para el caso "sin dato -> no se infiere"
    fechas += [d("2025-12-25"), d("2028-01-01"), d("2024-01-01")]

    v = []
    for f in fechas:
        v.append(("motor_deterministic", "es_festivo_co", [f]))
        v.append(("motor_deterministic", "es_dia_no_habil", [f]))
        v.append(("motor_deterministic", "ajustar_fecha_habil", [f]))
        v.append(("motor_deterministic", "_dia_valido_para_control", [f]))

    # sumar_dias_habiles: base x desplazamiento
    bases = [d("2026-01-01"), d("2026-06-28"), d("2026-07-11"), d("2026-12-24"),
             d("2027-01-01"), d("2026-08-15"), d("2026-05-17")]
    for b, n in itertools.product(bases, [0, 1, 2, 7, 8, 14, 21, 30, 60, 90, 180, 365]):
        v.append(("motor_deterministic", "sumar_dias_habiles", [b, n]))

    # fecha_control_desde_ftl: los dos modos
    for b, tarde in itertools.product(bases, [False, True]):
        v.append(("motor_deterministic", "fecha_control_desde_ftl", [b, tarde]))

    # _fecha_iso: tolerancia a basura
    for s in ["2026-08-15", "2026-08-15T10:30:00", "2026-08-15 10:30", "", None, 0,
              "no-es-fecha", "15/08/2026", "2026-13-45", "2026-02-30", 12345,
              "2026-08-15T10:30:00.123Z", "  2026-08-15  "]:
        v.append(("motor_deterministic", "_fecha_iso", [s]))
    return v


ESTADIOS = [None, "", "G1", "G2", "G3a", "G3b", "G4", "G5", "g1", " G2 ", "XX"]


def vectores_vigencias():
    v = []
    # programa_rector(tiene_erc, estadio, tiene_dm2, tiene_hta)
    for erc, est, dm2, hta in itertools.product([True, False], ESTADIOS, [True, False], [True, False]):
        v.append(("motor_vigencias", "programa_rector", [erc, est, dm2, hta]))

    # vigencia_dias(programa, analito, estadio, es_dm2, edad, rac)
    analitos = ["creatinina", "ldl", "hba1c", "pth", "rac", "glicemia", "uroanalisis",
                "ekg", "hemograma", "potasio", "", "NO_EXISTE", "  LDL  "]
    for prog, ana in itertools.product(["ERC", "DM2", "HTA", "erc", "", "OTRO"], analitos):
        for est in [None, "G1", "G3a", "G4", "G5"]:
            v.append(("motor_vigencias", "vigencia_dias", [prog, ana, est, False, None, None]))
    # el eje de es_dm2 / edad / rac, sobre los analitos donde manda
    for ana, dm2, edad, rac in itertools.product(
            ["hba1c", "ekg", "rac"], [True, False], [None, 30, 44, 45, 46, 80], [None, 0, 29, 30, 31, 300]):
        v.append(("motor_vigencias", "vigencia_dias", ["ERC", ana, "G3a", dm2, edad, rac]))
        v.append(("motor_vigencias", "vigencia_dias", ["DM2", ana, None, dm2, edad, rac]))

    # ventana_anr_dias(estadio, categoria_riesgo, vigilancia_estrecha)
    riesgos = [None, "", "muy alto", "alto", "moderado", "bajo", "MUY_ALTO", "Alto",
               "intermedio", "desconocido", "  muy alto  "]
    for est, cat, vig in itertools.product(ESTADIOS, riesgos, [True, False]):
        v.append(("motor_vigencias", "ventana_anr_dias", [est, cat, vig]))
    return v


def vectores_lipidos():
    v = []
    # calcular_cnohdl(colesterol_total, hdl)
    tot = [None, 0, 120, 150, 180, 200, 240, 300, 400, -5, "abc"]
    hdl = [None, 0, 25, 35, 40, 45, 60, 90, -1, "abc"]
    for a, b in itertools.product(tot, hdl):
        v.append(("motor_deterministic", "calcular_cnohdl", [a, b]))
    # calcular_reduccion_ldl_pct(basal, actual)
    for a, b in itertools.product([None, 0, 70, 100, 130, 160, 190], [None, 0, 55, 70, 100, 130, 190]):
        v.append(("motor_deterministic", "calcular_reduccion_ldl_pct", [a, b]))
    # _meta_hba(edad)  y normalizar_riesgo_cv(texto)
    for r in ["alto", "ALTO", "muy alto", "Muy Alto", "moderado", "bajo", "intermedio",
              "", None, "desconocido", "  alto  ", "ALTO RIESGO"]:
        v.append(("motor_deterministic", "normalizar_riesgo_cv", [r]))
    return v


def vectores_farmaco():
    """Seguridad de dosis renal: el orquestador y cada regla por separado.

    Los nombres de fármaco son los del vademécum del propio Copiloto, escritos
    como los escribe un EHR (texto libre, mayúsculas, con dosis pegada). Cero
    datos de pacientes: son nombres de moléculas.
    """
    md = cargar("motor_deterministic")
    v = []

    # TFG en los dos lados de cada umbral que usan las reglas
    TFGS = [5, 10, 14, 15, 16, 20, 25, 29, 30, 31, 44, 45, 46, 50, 59, 60, 61, 89, 90, 120]
    POTASIOS = [None, 3.0, 4.0, 5.0, 5.1, 5.5, 6.0]

    # una regla a la vez, con su fármaco y con un señuelo que NO debe dispararla
    REGLAS = [
        ("_regla_metformina", ["METFORMINA 850 MG", "metformina", "LOSARTAN 50MG"]),
        ("_regla_rosuvastatina", ["ROSUVASTATINA 20 MG", "simvastatina 40", "ATORVASTATINA 40"]),
        ("_regla_espironolactona", ["ESPIRONOLACTONA 25 MG", "eplerenona", "FUROSEMIDA 40"]),
        ("_regla_fenofibrato", ["FENOFIBRATO 145 MG", "gemfibrozilo 600"]),
        ("_regla_betabloqueador_hidrofilico", ["ATENOLOL 50 MG", "nadolol", "CARVEDILOL 6.25"]),
        ("_regla_tiazida", ["HIDROCLOROTIAZIDA 25 MG", "clortalidona 50", "indapamida"]),
        ("_regla_sulfonilurea", ["GLIBENCLAMIDA 5 MG", "glimepirida 2", "gliclazida MR 60"]),
        ("_regla_alopurinol", ["ALOPURINOL 300 MG", "colchicina 0.5"]),
        ("_regla_colchicina", ["COLCHICINA 0.5 MG", "alopurinol"]),
        ("_regla_digoxina", ["DIGOXINA 0.25 MG", "metformina"]),
        ("_regla_aines", ["IBUPROFENO 400 MG", "naproxeno 500", "DICLOFENACO", "acetaminofen 500"]),
        ("_regla_nitrofurantoina", ["NITROFURANTOINA 100 MG", "amoxicilina"]),
        ("_regla_arbieca", ["LOSARTAN 50 MG", "enalapril 10", "TELMISARTAN 40", "amlodipino 5"]),
        ("_regla_insulina", ["INSULINA GLARGINA 20 UI", "insulina NPH", "lispro"]),
        ("_regla_suplemento_k", ["CLORURO DE POTASIO", "KCL 600 MG", "potasio oral", "metformina"]),
    ]
    for fn, meds in REGLAS:
        for med, tfg, k in itertools.product(meds, TFGS, POTASIOS):
            v.append(("motor_deterministic", fn, [med, float(tfg), k]))

    # SGLT2 lleva un cuarto argumento (HbA1c) que cambia la conducta
    for med, tfg, hba in itertools.product(
            ["EMPAGLIFLOZINA 25 MG", "empagliflozina 10", "DAPAGLIFLOZINA 10 MG",
             "canagliflozina 100", "ertugliflozina", "metformina"],
            TFGS, [None, 6.5, 8.0, 8.1, 9.5, 12.0]):
        v.append(("motor_deterministic", "_regla_sglt2", [med, float(tfg), None, hba]))

    for fn, meds in [("_regla_dpp4", ["SITAGLIPTINA 100 MG", "vildagliptina 50", "LINAGLIPTINA 5 MG", "saxagliptina"]),
                     ("_regla_glp1_ra", ["EXENATIDA 10 MCG", "liraglutida 1.2", "SEMAGLUTIDA 1 MG"])]:
        for med, tfg, k in itertools.product(meds, TFGS, POTASIOS):
            v.append(("motor_deterministic", fn, [med, float(tfg), k]))

    # las que llevan aclaramiento (Cockcroft-Gault) en vez de eGFR
    for fn, meds in [("_regla_gabapentinoide", ["GABAPENTINA 300 MG", "pregabalina 75", "amitriptilina"]),
                     ("_regla_lmwh", ["ENOXAPARINA 40 MG", "clexane", "warfarina"]),
                     ("_regla_doac", ["RIVAROXABAN 20 MG", "apixaban 5", "dabigatran 150", "warfarina 5"])]:
        for med, tfg, k in itertools.product(meds, TFGS, POTASIOS):
            v.append(("motor_deterministic", fn, [med, float(tfg), k]))

    # timing de insulinas: (med, indicacion)
    for med in ["INSULINA GLARGINA", "insulina NPH", "insulina lispro", "INSULINA ASPART", "metformina"]:
        for ind in [None, "", "basal", "prandial", "antes de cada comida", "en la noche",
                    "cada 8 horas", "SOS", "correccion", "texto raro"]:
            v.append(("motor_deterministic", "_regla_insulina_timing", [med, ind]))

    # el orquestador: listas reales de un paciente crónico
    LISTAS = [
        [],
        ["METFORMINA 850 MG"],
        ["METFORMINA 850 MG", "LOSARTAN 50 MG", "ATORVASTATINA 40 MG"],
        ["METFORMINA 1000 MG", "ESPIRONOLACTONA 25 MG", "IBUPROFENO 400 MG"],
        ["ENOXAPARINA 40 MG", "RIVAROXABAN 20 MG", "GABAPENTINA 300 MG"],
        ["HIDROCLOROTIAZIDA 25 MG", "ATENOLOL 50 MG", "ALOPURINOL 300 MG"],
        ["GLIBENCLAMIDA 5 MG", "NITROFURANTOINA 100 MG", "DIGOXINA 0.25 MG"],
        ["INSULINA GLARGINA 20 UI", "INSULINA LISPRO", "CLORURO DE POTASIO"],
        ["acetaminofen 500 mg", "omeprazol 20 mg"],
        ["EMPAGLIFLOZINA 10 MG", "FUROSEMIDA 40 MG", "COLCHICINA 0.5 MG"],
    ]
    for meds, tfg in itertools.product(LISTAS, [10, 25, 35, 45, 55, 70, 95]):
        for k in [None, 5.5]:
            v.append(("motor_deterministic", "evaluar_seguridad_dosis_renal",
                      [meds, float(tfg), float(tfg) * 1.05, k, None, None, None, None]))

    # detección de grupos e interacciones
    for meds in LISTAS:
        v.append(("motor_deterministic", "detectar_grupos_farmacologicos", [meds]))
        v.append(("motor_deterministic", "evaluar_interacciones_farmacologicas", [meds]))
    return v


BLOQUES = {
    "fechas": vectores_fechas,
    "vigencias": vectores_vigencias,
    "lipidos": vectores_lipidos,
    "farmaco": vectores_farmaco,
}


def main(bloques=None):
    modulos = {}
    for n in ("motor_vigencias", "motor_deterministic", "motor_riesgo_cv"):
        modulos[n] = cargar(n)

    total_v, total_f, errores = 0, 0, []
    for nombre_bloque, gen in BLOQUES.items():
        if bloques and nombre_bloque not in bloques:
            continue
        por_funcion = {}
        for modn, fn, args in gen():
            mod = modulos[modn]
            f = getattr(mod, fn, None)
            if f is None:
                errores.append(f"{modn}.{fn} NO EXISTE")
                continue
            clave = f"{modn}::{fn}"
            reg = por_funcion.setdefault(clave, {
                "funcion": fn, "modulo": modn + ".py", "sha256_origen": sha(modn),
                "bloque": nombre_bloque, "vectores": [],
            })
            try:
                out = f(*args)
                reg["vectores"].append({"entrada": jsonable(list(args)), "salida": jsonable(out)})
            except Exception as e:
                reg["vectores"].append({
                    "entrada": jsonable(list(args)),
                    "lanza": type(e).__name__,
                })
        for clave, reg in por_funcion.items():
            fn = reg["funcion"]
            ruta = os.path.join(SALIDA, f"{fn}.json")
            with open(ruta, "w", encoding="utf-8") as fh:
                json.dump(reg, fh, ensure_ascii=False, indent=1)
            total_f += 1
            total_v += len(reg["vectores"])
            print(f"  {fn:28} {len(reg['vectores']):5} vectores")

    print(f"\n{total_f} funciones, {total_v} vectores dorados en tests/golden/")
    if errores:
        print("ERRORES:")
        for e in errores:
            print("  ", e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or None))
