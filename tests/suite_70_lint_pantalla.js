// =====================================================================
//  SUITE 70 — TANDA 0 DE LA AUDITORÍA DE EXPERIENCIA (27-ago-2026)
//
//  Tres reglas que el proyecto YA tiene escritas —dos en CLAUDE.md, una en un
//  comentario del propio código— y que hasta hoy dependían de que alguien se
//  acordara. Aquí se vuelven mecánicas.
//
//  Nacen ROJAS a propósito: definen el trabajo de las tandas 1 y 2 de la
//  auditoría, y al ponerse verdes lo blindan para siempre. Un lint que nace
//  verde no estaba haciendo falta.
//
//  Por qué lint y no revisión a ojo: las tres son de la clase de defecto que
//  no se ve en el diff (una clase CSS que no existe, un !important que falta,
//  una clave interna que se cuela al papel del paciente) y que solo aparece
//  en la pantalla del médico, en consulta, con el paciente delante.
// =====================================================================

const fs = require("fs");
const path = require("path");

const RUTA = path.join(__dirname, "..", "vigilante_agenda.user.js");

// Un identificador de programador: MAYÚSCULAS con guion bajo (COLESTEROL_LDL,
// URO_NITRITOS, SIN_ID). Ninguno de estos debe llegar a un ojo humano.
const RE_ID_CRUDO = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g;

module.exports = {
  nombre: "Tanda 0 — lint de pantalla (banderas y jerga)",
  cubre: ["mtrHojaEducativaHtml", "mtrNombreLegibleAnalito"],

  pruebas(t, api) {
    const src = fs.readFileSync(RUTA, "utf8");

    // =================================================================
    //  REGLA A — toda bandera emitida declara su propio fondo
    //
    //  HALLAZGO #1 de la auditoría, gravedad alta. `.vgl-flag.agpend` y
    //  `.vgl-flag.adic` NO EXISTEN en la hoja de estilos, así que las dos
    //  heredan el fondo ROJO de `.vgl-flag` — y las dos son avisos
    //  meramente informativos («agendamiento pendiente», «candidato
    //  adicional»). El comentario del propio código ya decidió que van en
    //  ámbar; la regla nunca se escribió.
    //
    //  El rojo en esta pantalla significa alarma clínica. Gastarlo en algo
    //  que no lo es no solo confunde ese aviso: devalúa todos los demás.
    // =================================================================
    t.caso("REGLA A — ninguna bandera se pinta con un fondo que nadie declaró", () => {
      const emitidas = new Set();
      // `class="vgl-flag agpend"` en cualquiera de sus formas de plantilla.
      let m;
      const reEmit = /vgl-flag\s+([a-z][a-z0-9-]*)/g;
      while ((m = reEmit.exec(src)) !== null) emitidas.add(m[1]);

      const declaradas = new Set();
      const reDecl = /\.vgl-flag\.([a-z][a-z0-9-]*)/g;
      while ((m = reDecl.exec(src)) !== null) declaradas.add(m[1]);

      t.cierto(emitidas.size > 0, "el barrido tiene que encontrar banderas, o no está mirando el sitio correcto");
      const huerfanas = [...emitidas].filter((v) => !declaradas.has(v)).sort();
      t.igual(huerfanas.join(", "), "",
        "cada variante .vgl-flag emitida necesita su propia regla de fondo; sin ella hereda el ROJO de alarma");
    });

    // =================================================================
    //  REGLA B — vive en suite_25, no aquí
    //
    //  La escribí en esta suite y era MÁS DÉBIL que una prueba que ya existía:
    //  `suite_25` (Regla E) parsea el CSS de verdad, no líneas sueltas, y por eso
    //  veía 74 infracciones donde mi barrido por líneas solo encontraba 25.
    //
    //  Lo que hacía falta no era una prueba nueva: era que la vieja dejara de
    //  llevar la cuenta de la deuda —comprobaba que la lista de infractoras
    //  siguiera siendo EXACTAMENTE la misma de 74— y pasara a exigir cero. Eso
    //  se hizo allí, y de paso se le añadieron los tres emergentes que nacieron
    //  después de escribirla. Duplicarla aquí solo habría creado dos sitios donde
    //  mantener la misma regla.
    // =================================================================

    // =================================================================
    //  EL TRADUCTOR ÚNICO — precedencia fija, y ningún destrozo por el camino
    //
    //  Patrón C de la auditoría: «cuatro traductores de nombre de analito
    //  distintos conviviendo con precedencias distintas». Este los sustituye,
    //  así que su orden tiene que estar fijado por prueba: si alguien lo
    //  invierte, vuelve el papel con «COLESTEROL_LDL».
    // =================================================================
    t.caso("el traductor de analitos: precedencia fija y siglas intactas", () => {
      const n = api.mtrNombreLegibleAnalito;
      t.igual(n("COLESTEROL_LDL"), "Colesterol LDL", "la clave del catálogo se traduce");
      t.igual(n("UROANALISIS"), "Uroanálisis (parcial de orina)", "y con la redacción clínica, no la de catálogo");

      // Un item de plan trae las dos cosas. Manda el nombre legible, SIEMPRE.
      t.igual(n({ clave: "COLESTEROL_LDL", nombre: "Colesterol LDL" }), "Colesterol LDL",
        "con clave y nombre a la vez manda el nombre: invertir esto es exactamente el defecto #61");
      // Y si el «nombre» que viene es en realidad otra clave cruda, no se cuela.
      t.igual(n({ clave: "CREATININA", nombre: "CREATININA_SERICA" }), "Creatinina sérica",
        "un nombre que en realidad es una clave cruda no pasa: se traduce por la clave");
      // Una clave que ningún catálogo conoce sale legible, no en mayúscula pelada.
      t.igual(n({ clave: "FERRITINA_SERICA" }), "Ferritina serica",
        "una clave nueva que nadie tradujo sale legible en vez de gritada");
      // Y si ESA clave desconocida viene acompañada de un nombre escrito a mano, manda el
      // nombre. Es el único caso donde la precedencia decide de verdad —con las claves del
      // catálogo el resultado sale igual por los dos caminos— y por eso hay que fijarlo
      // aquí: sin este caso, invertir la precedencia no rompe ninguna prueba.
      t.igual(n({ clave: "FERRITINA_SERICA", nombre: "Ferritina sérica" }), "Ferritina sérica",
        "el nombre escrito a mano gana al respaldo automático, tildes incluidas");

      // Las siglas clínicas NO se tocan: el médico las usa a diario.
      t.igual(n("LDL"), "LDL", "una sigla sin guion bajo se respeta tal cual");
      t.igual(n("PTH"), "PTH intacta", "salvo que el catálogo tenga algo mejor que decir");
      t.igual(n(null), "", "sin dato, cadena vacía — nunca un «undefined» en pantalla");
      t.igual(n({}), "", "ni con un objeto sin nada dentro");
    });

    // =================================================================
    //  REGLA C — lo que lee un humano no lleva identificadores de programador
    //
    //  HALLAZGO #61, gravedad alta: la hoja educativa que el médico imprime y
    //  ENTREGA EN LA MANO al paciente lista «COLESTEROL_LDL», «UROANALISIS»,
    //  «HBA1C». Verificado ejecutando la función, no leyendo el código.
    //
    //  Se comprueba sobre el HTML REALMENTE GENERADO, no sobre el fuente: en
    //  el fuente esos nombres son constantes legítimas, y un lint de texto
    //  daría falsos positivos por todas partes. Lo que importa es qué sale.
    // =================================================================
    t.caso("REGLA C — la hoja que se le entrega al paciente no imprime claves internas", () => {
      const f = (d) => new Date(Date.UTC(2026, 7, 16) - d * 86400000).toISOString().slice(0, 10);
      const resumen = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 68, sexo: "F", pesoKg: 62, creatinina: 1.6, rac: 45,
        ct: 230, hdl: 42, ldl: 148, paSistolica: 148, paDiastolica: 88,
        factores: { hta: true, diabetes: true },
        ultimos: {
          CREATININA: { fecha: f(107), valor: 1.6 },
          COLESTEROL_TOTAL: { fecha: f(107), valor: 230 },
        },
      });
      const html = String(api.mtrHojaEducativaHtml(resumen, {}) || "");
      t.cierto(html.length > 200, "la hoja tiene que generarse, o esta prueba no mira nada");

      // Solo el texto visible: los nombres de clase CSS y los ids no los lee el paciente.
      const visible = html
        .replace(/<style[\s\S]*?<\/style>/g, " ")
        .replace(/<[^>]+>/g, " ");
      const crudos = [...new Set(visible.match(RE_ID_CRUDO) || [])].sort();
      t.igual(crudos.join(", "), "",
        "el paciente no puede leer claves del catálogo en el papel que se lleva a su casa");
    });
  },
};
