// =====================================================================
//  SUITE 72 — TANDA 0 DE LA AUDITORÍA DE EXPERIENCIA (27-ago-2026)
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
    "_agruparToasts", "mtrColorMasGrave", "pymMotivoSinActividades"],

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

    // =================================================================
    //  REGLA E — renombrada desde «REGLA D» de la v17.14.0
    //
    //  Convivían dos reglas D con significados distintos: la del enjambre
    //  («un mensaje tranquilizador exige evidencia») y la que se añadió en
    //  v17.14.0 («un aviso no puede estar donde no se lee»). Dos reglas con
    //  el mismo nombre es una invitación a citar la equivocada. Las de arriba
    //  conservan sus rótulos D1/D2 por estar ya citadas en el informe de
    //  mutaciones; lo que sigue es la D del enjambre, extendida.
    // =================================================================

    t.caso("REGLA D (#Tanda 4) — «no tiene actividades pendientes» exige haber mirado una lista", () => {
      // El modal de Órdenes daba la MISMA frase —una afirmación sobre el paciente— en tres
      // situaciones distintas: lista cargada y sin pendientes (cierta), paciente que no
      // figura en la lista (no se sabe), y lista sin cargar (no se miró nada). Patrón G.
      const sinLista = api.pymMotivoSinActividades({ listaCargada: false });
      t.igual(sinLista.motivo, "sin_lista", "sin lista, el motivo es la lista");
      t.falso(/para este paciente|no tiene/i.test(sinLista.texto),
        "y el texto NO afirma nada sobre el paciente");
      t.cierto(/no lo sé/.test(sinLista.texto), "dice que es ignorancia, con esas palabras");

      // La base piloto y la lista de otro día son el mismo caso: no es la de hoy.
      t.igual(api.pymMotivoSinActividades({ listaCargada: true, esBasePiloto: true }).motivo, "sin_lista",
        "la base de respaldo no es la lista de la sede");
      t.igual(api.pymMotivoSinActividades({ listaCargada: true, diaDistinto: true }).motivo, "sin_lista",
        "la lista de ayer no responde por hoy");

      const noEsta = api.pymMotivoSinActividades({ listaCargada: true, pacienteEnLista: false });
      t.igual(noEsta.motivo, "no_esta_en_lista", "está la lista, pero él no figura en ella");
      t.cierto(/NO aparece en la lista/.test(noEsta.texto), "y se dice cuál es la duda");

      const ok = api.pymMotivoSinActividades({ listaCargada: true, pacienteEnLista: true });
      t.igual(ok.motivo, "sin_pendientes", "solo aquí se puede afirmar que no tiene pendientes");
      t.cierto(/está en la lista/.test(ok.texto), "y la afirmación viene con su evidencia");

      // `pacienteEnLista: null` = todavía no se ha indexado ninguna base. No se puede
      // afirmar que el paciente no esté: manda el primer motivo.
      t.igual(api.pymMotivoSinActividades({ listaCargada: true, pacienteEnLista: null }).motivo,
        "sin_pendientes", "sin poder comprobar la pertenencia no se inventa una exclusión");
    });

    t.caso("REGLA D (#Tanda 4) — el reloj no dice «datos al día» antes de haber leído nada", () => {
      // Eran dos estados para tres situaciones: con ultimaLectura en 0 el reloj afirmaba
      // «Datos al día» sobre datos que no existen. No alarmar al arrancar está bien; decir
      // que están al día es rellenar un hueco con una frase tranquilizadora.
      const i = src.indexOf("const _hubo = !!state.ultimaLectura;");
      t.cierto(i > 0, "el tercer estado existe");
      const bloque = src.slice(i, i + 900);
      t.cierto(/Todavía no he leído la agenda/.test(bloque),
        "sin lectura se dice que no se ha leído, no que esté al día");
      t.cierto(/no sé si los datos están al día/.test(bloque),
        "y se nombra la ignorancia en vez de taparla");
      t.cierto(/_hubo && \(Date\.now\(\) - state\.ultimaLectura\)/.test(bloque),
        "«fresco» exige que HAYA habido una lectura");
      t.cierto(/toggle\("vgl-stale", _hubo && !fresco\)/.test(bloque),
        "y el arranque sigue sin pintarse en alarma: no se cambia una mentira por un susto");
    });


    // =================================================================
    //  REGLA H — NINGÚN COMENTARIO `//` DENTRO DE UNA PLANTILLA DE TEXTO
    //
    //  BUG REAL, reportado por el médico el 31-ago sobre la build 18.0.5 que tenía
    //  instalada: en «Resumen del turno», encima del botón Diag, aparecían impresas seis
    //  líneas que empezaban por `//`. No era un fallo de CSS ni de datos: alguien escribió
    //  un comentario de JavaScript ENTRE el ` de apertura de una plantilla y el HTML que
    //  la plantilla construye. Ahí `//` no comenta nada — es texto, y el navegador lo pinta.
    //
    //  Es una frontera que se cruza en silencio: el archivo sigue siendo JavaScript válido,
    //  no hay error en consola, ninguna prueba de conducta se entera, y el médico se lo
    //  encuentra en pantalla en consulta. Por eso la guarda es un lint del código fuente y
    //  no una prueba de comportamiento: hay que cazarlo ANTES de que se pinte.
    //
    //  El recorrido de abajo es un analizador de verdad (comillas, comentarios, plantillas y
    //  su anidamiento con ${...}), no una expresión regular: una regex no puede saber si un
    //  `//` está dentro de una plantilla o dentro de una URL.
    // =================================================================
    t.caso("REGLA H — ninguna línea `//` vive DENTRO de una plantilla de texto (bug del botón Diag, 31-ago)", () => {
      const sospechosas = [];
      let i = 0, linea = 1;
      const pilaPlantilla = [];          // profundidad de ${} por plantilla abierta
      let enLinea = false, enBloque = false, enCad = null;
      let inicioDeLinea = true;
      while (i < src.length) {
        const ch = src[i], sig = src[i + 1];
        if (ch === "\n") { linea++; enLinea = false; inicioDeLinea = true; i++; continue; }
        const enTextoDePlantilla = pilaPlantilla.length > 0 && pilaPlantilla[pilaPlantilla.length - 1] === 0;

        if (enLinea || enBloque) {
          if (enBloque && ch === "*" && sig === "/") { enBloque = false; i += 2; continue; }
          i++; continue;
        }
        if (enCad) {
          if (ch === "\\") { i += 2; continue; }
          if (ch === enCad) enCad = null;
          i++; continue;
        }
        if (enTextoDePlantilla) {
          if (ch === "\\") { i += 2; continue; }
          if (ch === "`") { pilaPlantilla.pop(); i++; continue; }
          if (ch === "$" && sig === "{") { pilaPlantilla[pilaPlantilla.length - 1] = 1; i += 2; continue; }
          // AQUÍ está la caza: principio de línea (solo espacios delante) y luego `//`
          if (inicioDeLinea && ch === "/" && sig === "/") {
            sospechosas.push(linea + ": " + src.slice(i, src.indexOf("\n", i) < 0 ? undefined : src.indexOf("\n", i)).trim().slice(0, 90));
          }
          if (!/\s/.test(ch)) inicioDeLinea = false;
          i++; continue;
        }
        // ---- código normal (incluye el interior de un ${...}) ----
        if (ch === "/" && sig === "/") { enLinea = true; i += 2; continue; }
        if (ch === "/" && sig === "*") { enBloque = true; i += 2; continue; }
        if (ch === '"' || ch === "'") { enCad = ch; i++; continue; }
        if (ch === "`") { pilaPlantilla.push(0); i++; continue; }
        if (pilaPlantilla.length) {
          if (ch === "{") pilaPlantilla[pilaPlantilla.length - 1]++;
          else if (ch === "}") {
            pilaPlantilla[pilaPlantilla.length - 1]--;
            if (pilaPlantilla[pilaPlantilla.length - 1] <= 0) pilaPlantilla[pilaPlantilla.length - 1] = 0;
          }
        }
        if (!/\s/.test(ch)) inicioDeLinea = false;
        i++;
      }
      t.igual(sospechosas.length, 0,
        "un `//` dentro de una plantilla NO comenta: se imprime en pantalla. Líneas: " + sospechosas.slice(0, 8).join("  ·  "));
    });

    // =================================================================
    //  REGLA I — EL TEXTO QUE VA A escapeHtml() NO LLEVA ADORNO NI MARCADO
    //
    //  Mismo incidente del 31-ago, la otra mitad. `motivoTexto` (la píldora de complejidad
    //  del modal de Agendamiento) mezclaba DATO y PRESENTACIÓN: traía el punto de color
    //  pegado delante. Consecuencias reales, las dos vistas en pantalla:
    //    · quien lo pinta le anteponía OTRO punto -> "🔴 🔴 Paciente complejo…", y en la
    //      franja amarilla además contradictorio, "🟢 🟡 Control habitual…", porque quien
    //      pintaba solo miraba `esComplejo` (dos estados) y aquí hay TRES;
    //    · al sustituir el emoji por un <span> con el punto, escapeHtml() —que existe para
    //      que nada de aquí se interprete como HTML— lo imprimió crudo en la pantalla.
    //
    //  La regla: este texto es dato. El adorno lo pone quien pinta.
    // =================================================================
    t.caso("REGLA I — motivoTexto es TEXTO: sin emoji, sin marcado, sin adorno (bug de la píldora, 31-ago)", () => {
      // Los tres estados reales del triaje v2, con entradas que de verdad los alcanzan
      // (mismos vectores que suite_24): sin cubrir las tres, esta regla no probaría nada.
      const casos = [
        { factores: {}, fallas: { hayGrave: true }, medicamentos: [] },                              // 🔴 primera_mitad
        { factores: { diabetes: true }, riesgo: { categoria: "moderado" },
          medicamentos: ["Metformina 850mg", "Losartán 50mg"] },                                     // 🟢 final_jornada
        { factores: {}, riesgo: { categoria: "muy alto" }, medicamentos: ["Losartán 50mg"] },        // 🟡 adicional_30
      ];
      const vistos = new Set();
      casos.forEach((c) => {
        const r = api._evaluarComplejidadPaciente({}, c, []);
        vistos.add(r.franjaSugerida);
        t.falso(/[<>&]/.test(r.motivoTexto), "sin marcado: " + r.motivoTexto.slice(0, 70));
        t.falso(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(r.motivoTexto.replace(/➔/g, "")),
          "sin emoji pegado al dato: " + r.motivoTexto.slice(0, 70));
        t.cierto(/^[A-ZÁÉÍÓÚÑ]/.test(r.motivoTexto), "empieza por la frase, no por un adorno: " + r.motivoTexto.slice(0, 40));
        t.cierto(["primera_mitad", "final_jornada", "adicional_30"].indexOf(r.franjaSugerida) >= 0,
          "la franja es una de tres claves cerradas, que es de donde sale el punto");
      });
      t.igual(vistos.size, 3, "los casos tocan las TRES franjas: " + [...vistos].join(", "));
    });

    t.caso("REGLA I — quien pinta la píldora elige el punto por la FRANJA (tres estados), no por esComplejo (dos)", () => {
      const idx = src.indexOf('querySelector("#vgl-complexity-pill")');
      t.cierto(idx > 0, "sigue existiendo la píldora de complejidad");
      const bloque = src.slice(idx, idx + 1400);
      t.cierto(/PUNTO\s*=\s*\{\s*primera_mitad:/.test(bloque),
        "el punto sale de un mapa cerrado por franja: las tres, no dos");
      t.cierto(/escapeHtml\(\s*compEval\.motivoTexto\s*\)/.test(bloque),
        "y el texto sigue entrando por escapeHtml: nada que venga del dato puede volverse HTML");
      t.falso(/\(compEval\.esComplejo \? "🔴 " : "🟢 "\)\s*\+/.test(bloque),
        "ya no se antepone un punto por esComplejo sobre un texto que traía el suyo");
    });

    // =====================================================================
    // v18.0.28 — REGLA J: UNA INTERPOLACIÓN VIVA DENTRO DE UN COMENTARIO SE EJECUTA IGUAL
    //
    // Tercer miembro de la misma familia de frontera JS/plantilla:
    //   · Regla H (v18.0.6) — un `//` escrito dentro de una plantilla no comenta: se PINTA.
    //   · Regla Q (v18.0.14) — un `*/` dentro de un comentario CSS lo cierra antes de
    //     tiempo y el analizador se come la regla siguiente.
    //   · Regla J (esta)     — un `${…}` dentro de un comentario de bloque SÍ se evalúa:
    //     al motor de JavaScript el comentario CSS no le dice nada, la plantilla es una
    //     plantilla y la interpolación corre.
    //
    // El caso real: dentro de `MTR_RCV_CSS` se escribió el nombre de la expresión que
    // inserta ese CSS como si fuera una interpolación. Al inicializar la constante, la
    // flecha leía `MTR_RCV_CSS` todavía en su ZONA MUERTA TEMPORAL, lanzaba ReferenceError,
    // y `_cssSeguro` se lo tragaba devolviendo "": el comentario entregado al navegador
    // quedaba como «…splicea (, invisible…».
    //
    // Y el filo que hace que esto no sea cosmético: solo NO tumba el arranque porque
    // `_cssSeguro` es una declaración de tipo function, que está hoisted. El día que alguien
    // la convierta en const o en arrow declarada más abajo, el archivo ENTERO deja de
    // evaluarse en la carga — comprobado en aislamiento. Un userscript que no evalúa es un
    // Centinela que no existe, en mitad de una consulta.
    //
    // Nota honesta: al escribir el arreglo cometí este mismo defecto DENTRO del comentario
    // que lo explica —puse el ejemplo con su dólar y sus llaves— y el `node --check` lo
    // cazó al instante. Por eso la regla mira el archivo entero y no solo el sitio conocido.
    // =====================================================================
    t.caso("Regla J - ningún comentario de bloque contiene una interpolación viva", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const malos = [];
      const re = /\/\*[\s\S]*?\*\//g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const bloque = m.group === undefined ? m[0] : m[0];
        if (bloque.indexOf("${") < 0) continue;
        const linea = src.slice(0, m.index).split("\n").length;
        const frag = (/\$\{[^}\n]{0,50}/.exec(bloque) || [""])[0];
        malos.push(`L${linea}: ${frag}`);
      }

      t.igual(malos.length, 0,
        `un \${...} dentro de un comentario de bloque se EJECUTA igual —el comentario es para CSS, no para JavaScript—, y si lee algo en su zona muerta temporal el archivo entero puede dejar de evaluarse. Para nombrar una expresión, escribirla sin el dólar. Casos: ${malos.slice(0, 5).join(" | ")}`);
    });

  },
};
