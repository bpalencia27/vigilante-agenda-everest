// =====================================================================
//  SUITE 38 — El corpus de grounding no puede filtrar datos de paciente
//
//  `grounding/` existe para dárselo a OTROS MODELOS. Es decir: es material destinado a
//  salir de aquí. Cualquier dato de paciente que se cuele ahí no se queda en el
//  repositorio — se copia a un sistema de terceros y ya no vuelve.
//
//  Esa es la diferencia con el resto del repositorio y la razón de que esta suite exista
//  aparte: el generador ya sanea, pero un generador se puede editar, y alguien puede
//  añadir un archivo a mano sin pasar por él. Esta prueba mira el RESULTADO, no el
//  proceso.
//
//  El proyecto ya tuvo PHI real en el historial de git durante ocho días. No se repite
//  el mismo agujero por la puerta de al lado.
// =====================================================================
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const DIR = path.join(RAIZ, "grounding");

function archivos(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(p));
    else out.push(p);
  }
  return out;
}

module.exports = {
  nombre: "El grounding no filtra PHI",
  cubre: [],

  async pruebas(t) {
    const lista = archivos(DIR);

    t.caso("el corpus existe y tiene contenido — si no, esta guarda quedaría pasando en el vacío", () => {
      t.cierto(lista.length >= 5, "se esperaban al menos 5 archivos en grounding/, hay " + lista.length);
      t.cierto(fs.existsSync(path.join(DIR, "README.md")), "falta el índice: sin él, otro modelo usa los datos sin las advertencias");
    });

    t.caso("ni una cédula, ni un teléfono, ni un correo en todo el corpus", () => {
      // Los tres patrones que de verdad identifican a alguien en este contexto. La cédula
      // se busca por longitud (7-11 dígitos) y el teléfono por el prefijo 3 de Colombia.
      const RE_ID = /\b[1-9]\d{6,10}\b/g;
      const RE_TEL = /(?:\+57\s*)?\b3\d{9}\b/g;
      const RE_MAIL = /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
      // Los ids internos de Everest que SÍ pueden aparecer: no identifican a una persona
      // por sí solos y son necesarios para entender las respuestas.
      const PERMITIDOS = new Set(["12260710549", "1221974"]);
      const hallazgos = [];
      for (const f of lista) {
        const txt = fs.readFileSync(f, "utf8");
        const rel = path.relative(RAIZ, f);
        const ids = [...new Set(txt.match(RE_ID) || [])].filter((x) => !PERMITIDOS.has(x));
        const tel = [...new Set(txt.match(RE_TEL) || [])];
        const mail = [...new Set(txt.match(RE_MAIL) || [])];
        // No se vuelcan los valores en el mensaje: se dice el archivo y cuántos.
        if (ids.length) hallazgos.push(rel + ": " + ids.length + " cadena(s) con forma de identificador");
        if (tel.length) hallazgos.push(rel + ": " + tel.length + " con forma de celular");
        if (mail.length) hallazgos.push(rel + ": " + mail.length + " con forma de correo");
      }
      t.igual(hallazgos, [], "el corpus de grounding está pensado para salir a modelos de terceros: lo que se cuele ahí no vuelve");
    });

    t.caso("los campos de persona salen marcados como ocultos, nunca con su valor", () => {
      // El generador sustituye el valor por su forma y añade [OCULTO]. Si un esquema
      // trajera un campo de persona SIN esa marca, es que alguien lo escribió a mano o
      // cambió el generador.
      const PERSONA = /"(identificacion|nombre|nombreCompleto|primer_?Apellido|segundo_?Apellido|celular|telefono|correo|direccion|fecha_?Nacimiento)"\s*:\s*("(?!.*\[OCULTO\])[^"]*"|\{)/i;
      const malos = [];
      for (const f of lista.filter((x) => x.endsWith(".json"))) {
        const txt = fs.readFileSync(f, "utf8");
        for (const linea of txt.split("\n")) {
          if (PERSONA.test(linea) && linea.indexOf("[OCULTO]") === -1) {
            malos.push(path.relative(RAIZ, f) + ": " + linea.trim().split(":")[0]);
          }
        }
      }
      t.igual(malos, [], "campo de persona sin la marca [OCULTO]");
    });

    t.caso("los mapas no traen nombres de persona — la rendija por la que se colaron tres pacientes", () => {
      // Los mapas prometían "solo NOMBRES", pero ahí "nombre" era *nombre de campo*. El
      // capturador guardaba en `botones[].seccion` el título de la sección que contiene
      // cada botón, y en la historia clínica ese título ES LA CABECERA DEL PACIENTE. En
      // los cuatro mapas del 14-ago había 45 apariciones de tres pacientes distintos.
      //
      // Se detectó auditándolos antes de publicarlos como grounding, o sea a un paso de
      // copiarlos a modelos de terceros. Los patrones de dígitos no habrían servido: un
      // nombre no lleva ninguno.
      //
      // La regla se IMPORTA de la herramienta que sanea, no se reimplementa. El primer
      // intento la copió aquí y las dos copias divergieron enseguida: la prueba empezó a
      // marcar "OBESIDAD CLASE III" como si fuera una persona. Una prueba con falsos
      // positivos termina relajada, y entonces ya no protege de nada.
      //
      // Y se recorren los VALORES del JSON, que es la misma unidad que evalúa la
      // herramienta. Buscar fragmentos en mayúsculas dentro del texto crudo era el otro
      // error del primer intento: partía etiquetas largas y las juzgaba a trozos.
      const { pareceNombreDePersona } = require(path.join(RAIZ, "tools", "sanear_mapa.js"));
      const sospechosas = [];
      for (const f of lista.filter((x) => /mapas[/\\].*\.json$/.test(x))) {
        const d = JSON.parse(fs.readFileSync(f, "utf8"));
        const rel = path.relative(RAIZ, f);
        (function rec(o) {
          if (typeof o === "string") {
            // No se vuelca la cadena en el mensaje: se dice dónde y de qué tamaño.
            if (pareceNombreDePersona(o)) sospechosas.push(rel + ": un valor de " + o.split(/\s+/).length + " palabras que la regla de saneo clasifica como persona");
          } else if (Array.isArray(o)) o.forEach(rec);
          else if (o && typeof o === "object") Object.keys(o).forEach((k) => rec(o[k]));
        })(d);
      }
      t.igual(sospechosas, [], "sobre los 853 valores reales de los mapas crudos esta regla marcaba EXACTAMENTE los 3 nombres y nada más: si vuelve a marcar algo, míralo antes de tocar la regla");
    });

    t.caso("cada mapa deja constancia de que se saneó y de cuánto se quitó", () => {
      // Un mapa sin ese sello es un mapa que llegó por otro camino, sin pasar por
      // `tools/sanear_mapa.js`. Es la señal de que alguien lo copió a mano.
      const mapas = lista.filter((x) => /mapas[/\\].*\.json$/.test(x));
      t.cierto(mapas.length >= 1, "no hay mapas que auditar");
      const sinSello = [];
      for (const f of mapas) {
        const d = JSON.parse(fs.readFileSync(f, "utf8"));
        if (!d._saneado || !d._saneado.sustituciones) sinSello.push(path.relative(RAIZ, f));
      }
      t.igual(sinSello, [], "mapa sin el sello de saneado: entró sin pasar por tools/sanear_mapa.js");
    });

    t.caso("la tabla de exámenes conserva la advertencia de que sus rangos NO son de normalidad", () => {
      // Es el artefacto que más se va a copiar de aquí, porque es el más útil. Si alguien
      // se lleva las 28 filas sin esta advertencia, lo natural es leer "dentro del rango"
      // como "normal" — y la IPS declara la hemoglobina plausible desde 3 g/dL, que es una
      // urgencia transfusional. La advertencia viaja DENTRO del archivo, no solo en el
      // índice, justamente porque los archivos se copian sueltos.
      const p = path.join(DIR, "catalogos", "tabla_validacion_examenes_cronicos.json");
      t.cierto(fs.existsSync(p), "falta la tabla de validación de exámenes");
      const d = JSON.parse(fs.readFileSync(p, "utf8"));
      t.cierto(String(d._advertencia_critica || "").indexOf("PLAUSIBILIDAD") !== -1,
        "la advertencia de plausibilidad-vs-normalidad tiene que viajar dentro del archivo");
      t.cierto(String(d._advertencia_critica || "").indexOf("3 y 30") !== -1,
        "y con el caso concreto de la hemoglobina, que es lo que lo hace entender");
      t.igual(Array.isArray(d.filas), true);
      t.igual(d.filas.length, 28, "la captura real trae 28 filas");
    });
  },
};
