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
  cubre: ["mtrHojaEducativaHtml", "mtrNombreLegibleAnalito",
    "mtrPanelExamenesHtml", "mtrPriorityFocus", "_evaluarComplejidadPaciente",
    "_tableroQueCambio", "mtrTextoDestinoTelemetria",
    "_agruparToasts", "mtrColorMasGrave"],

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

    // =================================================================
    //  REGLA D — un mensaje tranquilizador exige evidencia de que se evaluó algo
    //
    //  TANDA 1 de la auditoría. Las nueve mentiras que corrige v17.8.1 son la MISMA
    //  clase de defecto: afirmar sin haber mirado. El informe lo llama patrón G —«el
    //  fallo del sistema se presenta como un hecho del paciente»— y aparece en los
    //  seis módulos.
    //
    //  Arreglarlas una a una no basta: la décima nacerá igual. Esta regla fija el
    //  invariante en el sitio donde más caro sale — el Panel, que es lo que el médico
    //  mira antes de decidir qué ordenar.
    // =================================================================
    t.caso("REGLA D — «al día con su programa» solo si HUBO un programa que evaluar", () => {
      // Sin programa no se evaluó nada, y decir «está al día» es rellenar un hueco con
      // una frase tranquilizadora: exactamente lo que la regla de la casa prohíbe.
      const sinPrograma = api.mtrTableroClinico(api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 60, sexo: "M", factores: {}, ultimos: {},
      }));
      // `programa` es un OBJETO con `rector` dentro; comprobar el objeto a secas da
      // siempre verdadero, que es justo el error que tenía la primera versión del arreglo.
      t.igual(sinPrograma.programa && sinPrograma.programa.rector, null,
        "el vector tiene que salir sin programa rector, o no prueba nada");
      const html = String(api.mtrPanelExamenesHtml(sinPrograma));
      t.falso(/al día con/.test(html),
        "sin programa NO se puede afirmar que el paciente esté al día: no se miró nada");
      t.cierto(/no evalué qué exámenes le tocan/.test(html),
        "y hay que decir por qué la lista está vacía, no dejarlo a la interpretación");
      t.cierto(/no quiere decir que esté al día/i.test(html),
        "explicando lo que el médico NO puede concluir de una lista vacía");

      // Y con programa, el mensaje tranquilizador SÍ vale: es una conclusión, no un hueco.
      const conPrograma = api.mtrTableroClinico(api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 60, sexo: "M", pesoKg: 80, creatinina: 1.0,
        ct: 180, hdl: 50, ldl: 90, paSistolica: 120, paDiastolica: 75,
        factores: { hta: true },
        ultimos: {
          CREATININA: { fecha: "2026-08-10", valor: 1.0 }, COLESTEROL_LDL: { fecha: "2026-08-10", valor: 90 },
          COLESTEROL_TOTAL: { fecha: "2026-08-10", valor: 180 }, COLESTEROL_HDL: { fecha: "2026-08-10", valor: 50 },
          TRIGLICERIDOS: { fecha: "2026-08-10", valor: 120 }, GLUCOSA: { fecha: "2026-08-10", valor: 90 },
          UROANALISIS: { fecha: "2026-08-10", valor: 1 }, RAC: { fecha: "2026-08-10", valor: 10 },
          HEMOGLOBINA: { fecha: "2026-08-10", valor: 14 },
        },
      }));
      t.cierto(!!(conPrograma.programa && conPrograma.programa.rector), "este vector sí tiene programa rector");
      const html2 = String(api.mtrPanelExamenesHtml(conPrograma));
      t.falso(/no evalué qué exámenes le tocan/.test(html2),
        "con programa no se pide marcar nada: la evaluación sí corrió");
    });

    t.caso("v17.8.1 — el foco de la consulta no se inventa cuando no hay con qué decidir", () => {
      // Hallazgo #96. Un foco inventado viaja al JSON que lee la IA y al chip del Panel:
      // le dice al médico y al modelo que la consulta va de lípidos cuando lo que pasa es
      // que no hay datos.
      t.igual(api.mtrPriorityFocus({ riesgo: {}, plan: {} }), null,
        "sin programa y sin ejes en falla, el foco es null — no «lipídico» por descarte");
      t.igual(api.mtrPriorityFocus({ riesgo: {}, plan: {}, programa: "ERC" }), "renal",
        "con programa rector sí hay con qué decidir");
      t.igual(api.mtrPriorityFocus({ riesgo: {}, plan: {}, programa: "DM2" }), "metabólico", "ídem DM2");
      t.igual(api.mtrPriorityFocus({ riesgo: {}, plan: {}, programa: "HTA" }), "lipídico",
        "y el programa de hipertensión conserva su foco lipídico: eso NO era una invención");
    });

    t.caso("v17.8.1 — nunca una cifra imposible ni una palabra de programador en la píldora", () => {
      // Hallazgo #87, reproducido literal antes de tocarlo: «PA Descontrolada (165/NaN)».
      const badges = (f) => api._evaluarComplejidadPaciente({}, { factores: Object.assign({ hta: true }, f) }).badges.join(" | ");
      const soloSist = badges({ paSistolica: 165 });
      t.falso(/NaN/.test(soloSist), "«NaN» es una palabra de programador: nunca en pantalla");
      t.cierto(/sistólica 165/.test(soloSist), "se nombra la cifra que SÍ se pudo leer");
      const diastCero = badges({ paSistolica: 165, paDiastolica: 0 });
      t.falso(/165\/0/.test(diastCero), "«165/0» es una tensión imposible: hace dudar de la cifra real");
      t.cierto(/165\/100/.test(badges({ paSistolica: 165, paDiastolica: 100 })),
        "con las dos cifras reales se imprimen las dos, como siempre");
    });

    t.caso("v17.8.1 — el aviso de cambios habla en idioma de consultorio, no en claves", () => {
      // Hallazgo #14: el aviso terminaba diciendo «(_documentados, dislipidemiaDocumentada)».
      const c = api._tableroQueCambio("_documentados=3|hta=false|L.hta=false|_total=25",
                                      "_documentados=4|hta=true|L.hta=true|_total=25");
      t.cierto(c.indexOf("hipertensión") >= 0, "lo que cambió se nombra como lo nombra el médico");
      t.falso(c.some((x) => String(x).charAt(0) === "_" || String(x).indexOf("L.") === 0),
        "los contadores internos y el tri-estado NO se le enseñan a nadie");
    });

    t.caso("v17.8.1 — la telemetría dice a dónde va de verdad, según el interruptor", () => {
      // Hallazgo #156: dos pantallas del mismo programa afirmaban lo contrario. Una promesa
      // sobre a dónde van sus datos no puede depender de que alguien actualice dos textos.
      const apagado = api.mtrTextoDestinoTelemetria(false);
      const encendido = api.mtrTextoDestinoTelemetria(true);
      t.cierto(/no salen de este computador/.test(apagado), "apagado: se promete que no sale");
      t.falso(/no salen de este computador/.test(encendido),
        "encendido: NO se puede seguir prometiendo que no sale");
      t.cierto(/se envían/.test(encendido) && /Ajustes/.test(encendido),
        "se dice que sale y dónde apagarlo, que es lo accionable");
      t.cierto(/no salen de este computador/.test(api.mtrTextoDestinoTelemetria(undefined)),
        "sin dato se asume lo conservador: no afirmar un envío que no consta");
    });


    // =================================================================
    //  TANDA 2 de la auditoría — COLOR CON SIGNIFICADO
    //
    //  Patrón A del informe: «el ámbar señala diez cosas sin relación entre sí; el rojo es
    //  a la vez alarma clínica, "no hay cupos ese día", "este paciente no necesita nada" y
    //  el botón de cerrar ventana. Con esa dispersión el color deja de comunicar y pasa a
    //  ser decoración».
    //
    //  Las dos de aquí son las que cambian una conducta: una rebaja una alarma y la otra
    //  disfraza un fallo de éxito.
    // =================================================================
    t.caso("v17.11.0 — agrupar avisos NUNCA puede rebajar la alarma", () => {
      // Hallazgo #63, gravedad alta. Reproducido: un aviso ROJO —la confirmación
      // extemporánea, que este proyecto trata como evidencia para una reclamación—
      // agrupado con un AZUL rutinario del mismo paciente salía en ÁMBAR. El rojo
      // desaparecía por el solo hecho de que hubiera otro aviso al lado.
      const grupo = (colores) => api._agruparToasts(
        colores.map((c, i) => ({ color: c, title: "aviso " + i, body: "x", apptKey: "P1" }))
      )[0];
      t.igual(grupo(["ROJO", "AZUL"]).color, "ROJO",
        "un ROJO agrupado sigue siendo ROJO: es el aviso que sostiene una reclamación");
      t.igual(grupo(["AZUL", "ROJO"]).color, "ROJO", "el orden de llegada no lo cambia");
      t.igual(grupo(["MORADO", "AZUL"]).color, "MORADO", "ni el morado se rebaja");
      t.igual(grupo(["AMBAR", "AZUL"]).color, "AMBAR", "ni el ámbar");
      t.igual(grupo(["VERDE", "AZUL"]).color, "VERDE", "y lo rutinario tampoco se agrava de más");

      // El orden de gravedad, fijado aparte: es lo que hace que la regla se sostenga.
      t.igual(api.mtrColorMasGrave(["AZUL", "VERDE", "AMBAR", "MORADO", "ROJO"]), "ROJO");
      t.igual(api.mtrColorMasGrave(["AZUL", "VERDE"]), "VERDE");
      t.igual(api.mtrColorMasGrave([]), "AZUL", "sin avisos, lo más rutinario");
      t.igual(api.mtrColorMasGrave(["COLOR_QUE_NADIE_DECLARO"]), "ROJO",
        "un color desconocido se trata como lo MÁS grave: callar una alarma por no saber "
        + "clasificarla es el peor error posible aquí");
    });

    t.caso("v17.11.0 — una corrida de órdenes a medias no puede parecerse a una que salió bien", () => {
      // Hallazgo #44, gravedad alta. El aviso del parcial usaba .vgl-ord-vigwarn, que en
      // ESE modal es VERDE y significa «esto ya está cubierto»: de un vistazo, una corrida
      // en la que parte de las órdenes NO se crearon decía «todo bien».
      const fs = require("fs"), path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/successMsg\.className = parcial \? "vgl-ord-parcial"/.test(src),
        "el parcial usa su clase propia, no la del verde de «ya cubierto»");
      t.falso(/successMsg\.className = parcial \? "vgl-ord-vigwarn"/.test(src),
        "y no puede volver a la clase verde por la puerta de atrás");
      // La clase existe y es ámbar con !important (el modal cuelga de document.body).
      const bloque = /#vgl-ordenar-modal \.vgl-ord-parcial\{[^}]*\}/.exec(src);
      t.cierto(!!bloque, "la clase .vgl-ord-parcial está declarada");
      t.cierto(/--c-ambar/.test(bloque[0]), "en ámbar, que es el color de «ojo con esto»");
      t.cierto(/!important/.test(bloque[0]),
        "y blindada: este modal cuelga de document.body, fuera de #vgl-root");
    });

    // =================================================================
    //  REGLA D — un aviso de seguridad no puede quedar donde no se lee
    //
    //  HALLAZGOS #53 y #2 de la auditoría. Los dos son la misma clase de
    //  defecto: el aviso existe, está bien redactado, y aun así el médico no
    //  lo ve — uno por quedar debajo del pliegue, el otro por quedar cortado
    //  por una elipsis. Un aviso que no se lee no es un aviso.
    // =================================================================

    t.caso("REGLA D1 (#53) — el aviso de cifras inventadas va ARRIBA del borrador, no debajo", () => {
      // Una nota de Análisis y Plan ocupa varias pantallas. Con la caja insertada después
      // del área de texto, el médico podía leer el borrador entero y firmarlo sin haber
      // visto nunca que la IA pudo INVENTAR una de esas cifras.
      const i = src.indexOf('caja.id = "vgl-ia-cifras"');
      t.cierto(i > 0, "la caja de cifras sin respaldo existe");
      const bloque = src.slice(i, i + 1400);
      t.cierto(/insertBefore\(caja, salida\)/.test(bloque),
        "se monta ANTES del área de texto: es el aviso más grave del módulo");
      t.falso(/insertBefore\(caja, salida\.nextSibling\)/.test(bloque),
        "y no después, donde quedaba por debajo del pliegue");
    });

    t.caso("REGLA D2 (#2) — una advertencia de la barra de estado no puede quedar truncada", () => {
      // #vgl-sum es una línea única con text-overflow:ellipsis, y por ahí salen avisos que
      // llevan la instrucción DENTRO del texto («…clic en el candado → Notificaciones →
      // Permitir, y recargue»): justo la parte que la elipsis se comía.
      const base = src.match(/#vgl-sum\{[^}]*\}/);
      t.cierto(!!base && /text-overflow:ellipsis/.test(base[0]),
        "en estado normal sigue siendo una línea: la barra no puede crecer con cada resumen");
      const warn = src.match(/#vgl-sum\.warn,#vgl-sum\.error\{[^}]*\}/);
      t.cierto(!!warn, "pero .warn/.error tienen su propia regla");
      t.cierto(/white-space:normal/.test(warn[0]), "que permite envolver el texto");
      t.cierto(/line-clamp:3/.test(warn[0]), "con un tope de renglones, para no tapar la lista");
      // Y la prueba de que hace falta: hay avisos cuya instrucción vive al final.
      t.cierto(/Notificaciones BLOQUEADAS/.test(src) && /y recargue/.test(src),
        "existen avisos con el qué-hacer al final de la frase");
    });

  },
};
