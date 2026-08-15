// =====================================================================
//  SUITE 43 — CONFORMIDAD CRUZADA con el motor del Copiloto
//
//  QUÉ COMPRUEBA: que cada función del bloque `mtr*` del userscript reproduce
//  EXACTAMENTE lo que devuelve la función Python de la que fue portada.
//
//  CÓMO: `golden_gen.py` ejecuta la función Python REAL sobre miles de vectores
//  sintéticos y graba entrada -> salida en `tests/golden/<funcion>.json`, junto
//  con el SHA-256 del archivo Python de origen. Esta suite los lee y los exige.
//
//  POR QUÉ ASÍ: portar lógica clínica a un segundo lenguaje es exactamente el
//  mecanismo que produjo el `904426` — un CUPS copiado del Copiloto que divergió
//  del que el médico ordena de verdad. Un dígito, dos copias, ningún vigilante
//  de la copia. Aquí la copia SÍ tiene vigilante: el día que la regla cambie en
//  Python y no aquí, estas pruebas caen.
//
//  LAS DOS EXCEPCIONES DECLARADAS — y por qué no son un agujero:
//
//   (A) Donde el Python LANZA, el JS devuelve `null` y no lanza. Es deliberado y
//       uniforme: una excepción a mitad de consulta es peor que una casilla
//       vacía. Se comprueba explícitamente, no se ignora.
//
//   (B) La tabla de festivos DIVERGE hoy entre los dos sistemas. Están listadas
//       una a una en DIVERGENCIAS, con su motivo. Y la lista se vigila a sí
//       misma: si una divergencia declarada deja de divergir, ESTA SUITE FALLA
//       para que alguien la borre. Una lista de excepciones que nadie poda se
//       convierte en el sitio donde se esconden los fallos.
// =====================================================================
const fs = require("fs");
const path = require("path");

const GOLD = path.join(__dirname, "golden");

// Nombre de la función Python -> nombre de la función portada en el userscript.
const MAPA = {
  es_festivo_co: "mtrEsFestivoCO",
  es_dia_no_habil: "mtrEsDiaNoHabil",
  ajustar_fecha_habil: "mtrAjustarFechaHabil",
  _dia_valido_para_control: "mtrDiaValidoParaControl",
  sumar_dias_habiles: "mtrSumarDiasHabiles",
  fecha_control_desde_ftl: "mtrFechaControlDesdeFtl",
  _fecha_iso: "mtrFechaIso",
  programa_rector: "mtrProgramaRector",
  vigencia_dias: "mtrVigenciaDias",
  ventana_anr_dias: "mtrVentanaAnrDias",
  calcular_cnohdl: "mtrCnoHDL",
  calcular_reduccion_ldl_pct: "mtrReduccionLdlPct",
  normalizar_riesgo_cv: "mtrNormalizarRiesgoCv",
  // --- seguridad de dosis renal ---
  _regla_metformina: "mtrReglaMetformina",
  _regla_rosuvastatina: "mtrReglaRosuvastatina",
  _regla_espironolactona: "mtrReglaEspironolactona",
  _regla_fenofibrato: "mtrReglaFenofibrato",
  _regla_betabloqueador_hidrofilico: "mtrReglaBetabloqueadorHidrofilico",
  _regla_tiazida: "mtrReglaTiazida",
  _regla_sulfonilurea: "mtrReglaSulfonilurea",
  _regla_alopurinol: "mtrReglaAlopurinol",
  _regla_colchicina: "mtrReglaColchicina",
  _regla_digoxina: "mtrReglaDigoxina",
  _regla_aines: "mtrReglaAines",
  _regla_nitrofurantoina: "mtrReglaNitrofurantoina",
  _regla_arbieca: "mtrReglaArbIeca",
  _regla_insulina: "mtrReglaInsulina",
  _regla_lmwh: "mtrReglaLmwh",
  _regla_suplemento_k: "mtrReglaSuplementoK",
  _regla_sglt2: "mtrReglaSglt2",
  _regla_dpp4: "mtrReglaDpp4",
  _regla_glp1_ra: "mtrReglaGlp1Ra",
  _regla_gabapentinoide: "mtrReglaGabapentinoide",
  _regla_doac: "mtrReglaDoac",
  detectar_grupos_farmacologicos: "mtrDetectarGruposFarmacologicos",
};

// El orquestador tiene firma distinta en JS a propósito: no acepta
// `indicaciones` ni `dosis_mg` porque esas dos vías NO están portadas y no se
// aparenta que lo estén. Se contrasta aparte, reordenando los argumentos.
const ORQUESTADOR = { py: "evaluar_seguridad_dosis_renal", js: "mtrEvaluarSeguridadDosisRenal" };

// ---------------------------------------------------------------------
//  DIVERGENCIAS DECLARADAS
//
//  Clave: "<funcion>|<JSON de la entrada>".  Valor: el motivo.
//  Todas las de esta tanda salen de UNA sola causa: las dos tablas de festivos
//  no coinciden. Ninguna viene de la lógica portada.
// ---------------------------------------------------------------------
const DIV_FESTIVO_EXTRA_PY =
  "El Copiloto tiene este día como festivo y el Vigilante no. Sin fuente oficial " +
  "no se elige un lado: mueve la fecha de una toma de laboratorio. Ver docs/MOTOR_PORTADO.md.";
const DIV_ANIO_FUERA_TABLA_PY =
  "La tabla del Copiloto solo cubre 2026-2027; la del Vigilante cubre 2024-2027. " +
  "Fuera del rango del Copiloto, Python devuelve 'no festivo' por diseño (sin dato no se infiere).";

const DIVERGENCIAS = {};
for (const f of ["es_festivo_co", "es_dia_no_habil", "_dia_valido_para_control", "ajustar_fecha_habil"]) {
  for (const dia of ["2026-07-13", "2027-07-12"]) DIVERGENCIAS[f + '|["' + dia + '"]'] = DIV_FESTIVO_EXTRA_PY;
  for (const dia of ["2025-12-25", "2024-01-01"]) DIVERGENCIAS[f + '|["' + dia + '"]'] = DIV_ANIO_FUERA_TABLA_PY;
}
// el día anterior al festivo discutido también cambia, porque el ajuste lo salta
DIVERGENCIAS['ajustar_fecha_habil|["2026-07-12"]'] = DIV_FESTIVO_EXTRA_PY;
DIVERGENCIAS['ajustar_fecha_habil|["2027-07-11"]'] = DIV_FESTIVO_EXTRA_PY;
for (const v of [['"2026-06-28"', 14], ['"2026-07-11"', 1], ['"2026-07-11"', 2], ['"2026-07-11"', 365]]) {
  DIVERGENCIAS["sumar_dias_habiles|[" + v[0] + "," + v[1] + "]"] = DIV_FESTIVO_EXTRA_PY;
}

const norm = (v) => JSON.stringify(v === undefined ? null : v);

module.exports = {
  nombre: "Conformidad cruzada con el Copiloto",
  cubre: [
    "mtrEsFestivoCO", "mtrEsDiaNoHabil", "mtrAjustarFechaHabil",
    "mtrDiaValidoParaControl", "mtrSumarDiasHabiles", "mtrFechaControlDesdeFtl",
    "mtrFechaIso", "mtrProgramaRector", "mtrVigenciaDias", "mtrVentanaAnrDias",
    "mtrCnoHDL", "mtrReduccionLdlPct", "mtrNormalizarRiesgoCv",
    "mtrReglaMetformina", "mtrReglaRosuvastatina", "mtrReglaEspironolactona",
    "mtrReglaFenofibrato", "mtrReglaBetabloqueadorHidrofilico", "mtrReglaTiazida",
    "mtrReglaSulfonilurea", "mtrReglaAlopurinol", "mtrReglaColchicina",
    "mtrReglaDigoxina", "mtrReglaAines", "mtrReglaNitrofurantoina",
    "mtrReglaArbIeca", "mtrReglaInsulina", "mtrReglaLmwh", "mtrReglaSuplementoK",
    "mtrReglaSglt2", "mtrReglaDpp4", "mtrReglaGlp1Ra", "mtrReglaGabapentinoide",
    "mtrReglaDoac", "mtrDetectarGruposFarmacologicos", "mtrEvaluarSeguridadDosisRenal",
  ],

  pruebas(t, api) {
    // ---- el banco de dorados tiene que existir y no estar vacío ----
    t.caso("hay vectores dorados y ninguno está vacío", () => {
      const archivos = fs.existsSync(GOLD) ? fs.readdirSync(GOLD).filter((x) => x.endsWith(".json")) : [];
      t.cierto(archivos.length >= 35, "se esperaban al menos 35 archivos de vectores, hay " + archivos.length);
      for (const a of archivos) {
        const g = JSON.parse(fs.readFileSync(path.join(GOLD, a), "utf8"));
        t.cierto(Array.isArray(g.vectores) && g.vectores.length > 0, a + " no tiene vectores");
        t.cierto(/^[0-9a-f]{64}$/.test(String(g.sha256_origen || "")),
          a + " no lleva el SHA-256 del Python de origen — sin eso no se detecta que la regla cambió allá");
      }
    });

    // ---- toda función mapeada tiene que existir en el userscript ----
    t.caso("cada función portada existe y es invocable", () => {
      for (const py of Object.keys(MAPA)) {
        t.igual(typeof api[MAPA[py]], "function", MAPA[py] + " (port de " + py + ")");
      }
    });

    // ---- el contraste, vector a vector ----
    const usadas = new Set();
    let comparados = 0, comoLanza = 0;

    for (const archivo of fs.readdirSync(GOLD).filter((x) => x.endsWith(".json"))) {
      const g = JSON.parse(fs.readFileSync(path.join(GOLD, archivo), "utf8"));
      const jsName = MAPA[g.funcion];
      if (!jsName) continue;

      t.caso(`${g.funcion} -> ${jsName}: ${g.vectores.length} vectores contra ${g.modulo}`, () => {
        const fn = api[jsName];
        for (const v of g.vectores) {
          const clave = g.funcion + "|" + JSON.stringify(v.entrada);
          let obtenido, lanzo = false;
          try { obtenido = fn.apply(null, v.entrada); }
          catch (e) { lanzo = true; obtenido = "LANZÓ: " + e.message; }

          if (v.lanza !== undefined) {
            // Excepción (A): donde Python lanza, aquí null y sin lanzar.
            comoLanza++;
            t.falso(lanzo, `${jsName}(${JSON.stringify(v.entrada)}) lanzó; debía devolver null (Python lanza ${v.lanza})`);
            t.igual(obtenido === undefined ? null : obtenido, null,
              `${jsName}(${JSON.stringify(v.entrada)}) donde Python lanza ${v.lanza}`);
            continue;
          }

          if (DIVERGENCIAS[clave] !== undefined) {
            // Excepción (B): divergencia declarada. Se exige que SIGA divergiendo.
            usadas.add(clave);
            t.cierto(norm(obtenido) !== norm(v.salida),
              `DIVERGENCIA DECLARADA QUE YA NO DIVERGE: ${clave}. Ahora los dos dan ` +
              `${norm(v.salida)}. Bórrala de la lista — una excepción que sobra es donde se esconde el próximo fallo.`);
            continue;
          }

          comparados++;
          t.igual(norm(obtenido), norm(v.salida),
            `${jsName}(${JSON.stringify(v.entrada)}) difiere del Copiloto`);
        }
      });
    }

    // ---- el orquestador, con su firma reducida ----
    t.caso("el orquestador de seguridad renal reproduce al Copiloto", () => {
      const g = JSON.parse(fs.readFileSync(path.join(GOLD, ORQUESTADOR.py + ".json"), "utf8"));
      const fn = api[ORQUESTADOR.js];
      t.igual(typeof fn, "function", ORQUESTADOR.js);
      let n = 0;
      for (const v of g.vectores) {
        // Python: (meds, ckdepi, cg, potasio, hba1c, indicaciones, dosis_mg, rac)
        // JS:     (meds, ckdepi, cg, potasio, hba1c, rac)   <- sin las dos no portadas
        const e = v.entrada;
        t.cierto(e[5] === null && e[6] === null,
          "este vector usa indicaciones/dosis_mg, que NO están portadas: no debe contrastarse como si lo estuvieran");
        const obtenido = fn(e[0], e[1], e[2], e[3], e[4], e[7]);
        t.igual(norm(obtenido), norm(v.salida), ORQUESTADOR.js + "(" + JSON.stringify(e.slice(0, 3)) + ")");
        n++;
      }
      t.cierto(n >= 140, "solo se contrastaron " + n + " listas de medicamentos");
    });

    t.caso("lo que NO está portado no aparenta estarlo", () => {
      // La firma del orquestador portado tiene 6 parámetros, no 8. Si alguien
      // añade `indicaciones` o `dosis_mg` sin portar las reglas que las usan,
      // esta prueba cae y obliga a portarlas de verdad.
      t.igual(api[ORQUESTADOR.js].length, 6,
        "la firma cambió: si se añadieron indicaciones/dosis_mg, hay que portar GAP #6 y GAP #8 con sus dorados");
    });

    // ---- la lista de excepciones se poda sola ----
    t.caso("no sobra ninguna divergencia declarada", () => {
      const sobran = Object.keys(DIVERGENCIAS).filter((k) => !usadas.has(k));
      t.igual(sobran, [], "divergencias declaradas que ningún vector ejercita (quedaron huérfanas)");
    });

    t.caso("el contraste cubrió un volumen que sirve de algo", () => {
      t.cierto(comparados > 4000, "solo se compararon " + comparados + " vectores; se esperaban más de 4000");
      t.cierto(comoLanza > 0, "ningún vector ejercitó el caso 'Python lanza -> JS null'");
    });
  },
};
