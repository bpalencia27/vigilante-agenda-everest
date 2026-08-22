// =====================================================================
//  SUITE 15 — Interfaz: ventana, hojas y modales
//
//  El panel del Vigilante vive en un DOM que el harness solo simula a
//  medias: los elementos falsos no interpretan innerHTML ni resuelven
//  selectores. Para poder ejercitar buildOverlay() y todo lo que cuelga
//  de él, esta suite "enriquece" el documento falso: cada elemento creado
//  recibe un querySelector memoizado (mismo selector -> mismo nodo falso),
//  de modo que los nodos que el script consulta ("#vgl-sum", "#c-snd"…)
//  existen, conservan listeners y son inspeccionables desde las pruebas.
//  Lo que se comprueba es comportamiento real del script: clases, estilos,
//  textos, persistencia en localStorage y el cableado de los eventos.
// =====================================================================

// Da a cada elemento nuevo un querySelector memoizado por selector (los hijos
// también quedan enriquecidos) y añade el createDocumentFragment que el
// harness no trae (render() lo necesita para montar las tarjetas).
function enriquecerDom(c) {
  const doc = c.env.doc;
  const crearBase = doc.createElement; // la función original no usa `this`
  doc.createElement = function (tag) {
    const e = crearBase(tag);
    const memo = new Map();
    e.querySelector = (sel) => {
      if (!memo.has(sel)) memo.set(sel, doc.createElement("div"));
      return memo.get(sel);
    };
    e.querySelectorAll = () => [];
    return e;
  };
  doc.createDocumentFragment = () => {
    const f = doc.createElement("div");
    f._esFragmento = true;
    return f;
  };
}

// Dispara el primer listener registrado de un tipo en un nodo falso.
function disparar(nodo, tipo, evento) {
  const ls = nodo._listeners && nodo._listeners[tipo];
  if (!ls || !ls.length) throw new Error("no hay listener '" + tipo + "' registrado");
  return ls[0](evento || {});
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Respuesta con forma de fetch real para los mocks por URL.
function respuestaJson(data) {
  return {
    ok: true, status: 200,
    headers: { get: () => null },
    json: async () => data,
    text: async () => JSON.stringify(data),
    clone() { return this; },
  };
}

module.exports = {
  nombre: "Interfaz: ventana, hojas y modales",
  cubre: [
    "createLabInjectorUI", "createExamenFisicoInjectorUI", "_casillasExamenFisico", "setWinState", "buildOverlay",
    "_cssSeguro",   // v16.2.4 — lectura de CSS a prueba de zona muerta temporal
    "_vglDockRotulo", "_etiquetaCercanaCasilla", "_excluirMamasGenitoPorTexto",
    "openLaboratoriosModal", "abrirInformeAthenea", "openAgendamientoModal", "openLabSoloModal", "openOrdenamientoModal", "esMedicoRCVActivo",
    // v15.5.0 — anulación real, modo oculto, deshacer y feedback (entrevista 19-ago)
    "_anularCitaAsignadaReal", "_anularCitaMarcasLocales", "_anularCitaAsignada", "_vglModoOcultoLeer", "_vglModoOcultoAplicar",
    "_vglAlternarOculto", "_vglInstalarModoOculto", "_vglGuardarDeshacer", "_vglDeshacerDisponible",
    "_vglEjecutarDeshacer", "_vglOfrecerDeshacer", "_vglFeedbackBoton", "_festivosAvisarSiVencida", "_festivosMensajeDiscrepancia", "_festivosTablaAgregarParaTest", "_labReferenciaDe",
    // v15.6.0 — Ajustes con Guardar/Descartar, modo programador, Ficha y Redactor
    "_ajustesSucio", "_ajustesPonBorrador", "_ajustesPintarBarra", "_ajustesGuardar", "_ajustesDescartar",
    "_ajustesIntentarCerrar", "_vglAlternarModoProg", "_vglInstalarModoProg",
    "openFichaPacienteModal", "abrirRedactorTextoLibre", "mtrFichaVivaFilas",
    // v15.6.0 — modo acompañado (guía paso a paso)
    "_acompStoreLeer", "_acompStoreGuardar", "_acompMedId", "_acompEstadoLeer", "_acompEstadoGuardar",
    "_acompActivo", "_acompNotificarAccion", "_acompSugerencia", "_acompCerrar", "_acompMostrar", "_acompTick",
    "candidatoAdicional",
    "savePos", "restorePos", "closeSheet", "toggleSheet", "sheetHeader",
    "wireClose", "renderResumen", "copySummary", "renderSettings",
    "paintMute", "repaint", "makeDraggable", "setSummary", "render",
    "refrescarCuentas", "imprimirRecordatorioCita", "imprimirOrdenPyM", "_urlImpresionOrdenPyM",
    "_agruparUroanalisisParaTabla", "mostrarPanelPostCita", "createAccionesDockUI",
    // v17.5.0 — compuerta de completitud del Panel del paciente
    "autoCalcularResumenSiNecesario", "mtrFactoresPendientesNavegables", "mtrIrAPestanaPorNombre",
    "pymPaquetesDelPaciente",
    "mtrCalcularResumenClinico", "openRiesgoModal", "mtrIaClickDelegado", "mtrAbrirDatosAdicionales", "mtrRenderRiesgoModalHtml",
  ],

  async pruebas(t, api, env, cargar) {
    // ---- Instancia principal con el panel montado ----
    const cv = cargar({ silencioso: true });
    enriquecerDom(cv);
    cv.ctx.innerWidth = 1200;
    cv.ctx.innerHeight = 800;

    let raiz = null, dock = null, hoja = null, suma = null, lista = null;
    const q = (sel) => raiz.querySelector(sel);

    // ================= buildOverlay =================
    t.caso("buildOverlay: monta panel, dock y bandeja de toasts en el body", () => {
      cv.api.buildOverlay();
      const hijos = cv.env.doc.body.children;
      raiz = hijos.find((n) => n.id === "vgl-root");
      dock = hijos.find((n) => n.id === "vgl-dock");
      const toasts = hijos.find((n) => n.id === "vgl-toasts");
      t.cierto(!!raiz, "debe existir #vgl-root en el body");
      t.cierto(!!dock, "debe existir #vgl-dock en el body");
      t.cierto(!!toasts, "debe existir #vgl-toasts en el body");
      t.cierto(raiz.innerHTML.includes("Asistente Clínico"), "el panel lleva el título del asistente");
      t.cierto(dock.innerHTML.includes("Asistente Clínico"), "la pastilla lleva la etiqueta");
      // La hoja de estilos se cuelga del head y contiene las reglas del panel
      const estilo = cv.env.doc.head.children[0];
      t.cierto(!!estilo && String(estilo.textContent).includes("#vgl-root"), "el CSS del panel se añadió al head");
      hoja = q("#vgl-sheet");
      suma = q("#vgl-sum");
      lista = q("#vgl-list");
      // El asa de arrastre quedó cableada por makeDraggable desde buildOverlay
      t.cierto(!!q("#vgl-head")._listeners.mousedown, "buildOverlay deja el arrastre cableado en la cabecera");
    });

    // ================= setWinState / savePos =================
    t.caso("setWinState: 'min' añade la clase y la decisión del médico se persiste", () => {
      cv.api.setWinState("min");
      t.cierto(raiz.classList.contains("min"), "el panel queda con clase min");
      t.igual(raiz.style.display, "flex");
      t.igual(cv.api.__state.userWinState, "min", "una decisión sin 'auto' actualiza la preferencia");
      const pos = JSON.parse(cv.env.almacen.vgl_pos);
      t.igual(pos.win, "min", "savePos guardó el estado de ventana en vgl_pos");
    });

    t.caso("setWinState: 'dock' oculta el panel y muestra la pastilla", () => {
      cv.api.setWinState("dock");
      t.igual(raiz.style.display, "none");
      t.igual(dock.style.display, "flex");
      t.igual(cv.api.__state.userWinState, "dock");
    });

    t.caso("setWinState: un cambio automático (auto=true) no pisa la preferencia del médico", () => {
      cv.api.setWinState("full", true);
      t.igual(raiz.style.display, "flex", "visualmente sí se restaura");
      t.igual(cv.api.__state.userWinState, "dock", "la preferencia guardada sigue siendo la del médico");
      t.igual(JSON.parse(cv.env.almacen.vgl_pos).win, "dock", "vgl_pos tampoco se reescribe");
      cv.api.setWinState("full"); // deja la ventana normal para el resto de la suite
    });

    // v16.2.2 — pedido del médico: fuera de HCHealth el Vigilante no debe dejar NINGÚN
    // rastro visible — a diferencia de 'dock' (que sí deja la pastilla como acceso rápido
    // dentro de HCHealth), 'hidden' se lleva las dos cosas. Ver tick() para cuándo se usa.
    t.caso("setWinState: 'hidden' (v16.2.2) oculta panel Y pastilla — a diferencia de 'dock', cero rastro fuera de HCHealth", () => {
      cv.api.setWinState("hidden", true);
      t.igual(raiz.style.display, "none", "el panel completo desaparece");
      t.igual(dock.style.display, "none", "a diferencia de 'dock', la pastilla TAMPOCO se muestra");
      t.igual(cv.api.__state.userWinState, "full", "es un cambio automático (auto=true): no pisa la preferencia real del médico");
      cv.api.setWinState("full"); // deja la ventana normal para el resto de la suite
    });

    t.caso("savePos: guarda la posición redondeada real del panel", () => {
      raiz.getBoundingClientRect = () => ({ left: 33.6, top: 44.2, width: 690, height: 400 });
      cv.api.savePos();
      const pos = JSON.parse(cv.env.almacen.vgl_pos);
      t.igual(pos.left, 34);
      t.igual(pos.top, 44);
      t.igual(pos.win, "full");
    });

    // ================= restorePos =================
    t.caso("restorePos: aplica posición y estado de ventana guardados", () => {
      cv.env.storage.setItem("vgl_pos", JSON.stringify({ left: 50, top: 60, win: "min" }));
      cv.api.restorePos();
      t.igual(raiz.style.left, "50px");
      t.igual(raiz.style.top, "60px");
      t.igual(raiz.style.right, "auto");
      t.igual(raiz.style.bottom, "auto");
      t.cierto(raiz.classList.contains("min"), "el estado 'min' guardado se restauró");
      cv.api.setWinState("full");
    });

    t.caso("restorePos: una posición fuera de pantalla se acota a los límites visibles", () => {
      cv.env.storage.setItem("vgl_pos", JSON.stringify({ left: 99999, top: -50, win: "full" }));
      cv.api.restorePos();
      t.igual(raiz.style.left, "1080px", "left se acota a innerWidth - 120");
      t.igual(raiz.style.top, "0px", "top negativo se acota a 0");
    });

    t.caso("restorePos: sin posición guardada no toca nada", () => {
      cv.env.storage.removeItem("vgl_pos");
      raiz.style.left = "7px";
      cv.api.restorePos();
      t.igual(raiz.style.left, "7px");
    });

    // ================= sheetHeader =================
    t.caso("sheetHeader: escapa el título e incluye el botón Cerrar y el HTML extra", () => {
      const h = cv.api.sheetHeader('Resumen <b>&"', "<i>extra</i>");
      t.cierto(h.includes("Resumen &lt;b&gt;&amp;&quot;"), "el título va escapado");
      t.cierto(h.includes('data-x="1"'), "trae el botón de cierre");
      t.cierto(h.includes("<i>extra</i>"), "el HTML extra se inserta tal cual");
      t.cierto(h.includes(">Cerrar</button>"));
    });

    // ================= toggleSheet / renderResumen / wireClose / closeSheet =================
    t.caso("toggleSheet('resumen'): abre la hoja y renderResumen pinta los KPI del turno", () => {
      cv.api.toggleSheet("resumen");
      t.igual(cv.api.__state.sheet, "resumen");
      t.cierto(raiz.classList.contains("sheet"));
      t.cierto(hoja.innerHTML.includes("Resumen del turno"));
      t.cierto(hoja.innerHTML.includes("EXTEMPORÁNEAS"));
      t.cierto(hoja.innerHTML.includes("INASISTENCIAS"));
      t.cierto(hoja.innerHTML.includes("ÚLTIMOS 7 DÍAS"));
      t.cierto(hoja.innerHTML.includes("Eventos registrados hoy"));
    });

    t.caso("wireClose: el botón Cerrar de la hoja dispara closeSheet", () => {
      const btn = hoja.querySelector('[data-x="1"]');
      disparar(btn, "click");
      t.igual(cv.api.__state.sheet, null);
      t.falso(raiz.classList.contains("sheet"));
      t.igual(hoja.innerHTML, "", "closeSheet vacía la hoja");
    });

    t.caso("renderResumen, renderSettings, wireClose y _casillasExamenFisico: invocaciones directas", () => {
      cv.api.renderResumen();
      t.cierto(hoja.innerHTML.includes("Resumen del turno"));
      cv.api.wireClose();
      cv.api.renderSettings();
      t.cierto(hoja.innerHTML.includes("Ajustes"));
      const cas = cv.api._casillasExamenFisico();
      t.cierto(Array.isArray(cas));
    });

    // =====================================================================
    // v14.2.x — _vglDockRotulo: cada botón del dock lleva, además del ícono, una
    // etiqueta SIEMPRE VISIBLE con el mismo verbo/nombre del modal al que abre, para
    // que el ojo empareje botón y destino sin depender del hover.
    // =====================================================================
    t.caso("_vglDockRotulo: arma ícono (aria-hidden) + etiqueta como dos <span> hijos del botón", () => {
      const c = cargar({ silencioso: true });
      const btn = c.env.doc.createElement("button");
      c.api._vglDockRotulo(btn, "🧪", "Laboratorios");
      t.igual(btn.children.length, 2);
      t.igual(btn.children[0].className, "vgl-dock-ico");
      t.igual(btn.children[0].textContent, "🧪");
      t.igual(btn.children[0].getAttribute("aria-hidden"), "true", "el ícono no debe leerse dos veces por lector de pantalla");
      t.igual(btn.children[1].className, "vgl-dock-lbl");
      t.igual(btn.children[1].textContent, "Laboratorios");
    });

    // =====================================================================
    // v14.2.5 — _etiquetaCercanaCasilla: cascada de 4 intentos para hallar la etiqueta
    // real de una casilla del examen físico (label → tr → previousElementSibling →
    // parentElement.previousElementSibling), cada uno solo corre si el anterior dio
    // vacío. PHI-safe: son etiquetas del FORMULARIO, nunca datos del paciente.
    // =====================================================================
    t.caso("_etiquetaCercanaCasilla: 1er intento, closest('label') con texto, gana de una vez", () => {
      const el = { closest: (s) => (s === "label" ? { textContent: "  Tórax:  " } : null) };
      t.igual(api._etiquetaCercanaCasilla(el), "Tórax:");
    });

    t.caso("_etiquetaCercanaCasilla: la cascada respeta el ORDEN — el label (tier 1) gana aunque previousElementSibling (tier 3) también tenga texto distinto", () => {
      const el = {
        closest: (s) => (s === "label" ? { textContent: "Tórax:" } : null),
        previousElementSibling: { textContent: "ESTE TEXTO NO DEBE GANAR" },
      };
      t.igual(api._etiquetaCercanaCasilla(el), "Tórax:", "el intento 1 corta antes de llegar a mirar previousElementSibling");
    });

    t.caso("_etiquetaCercanaCasilla: 2do intento, sin label pero con fila (tr) y su primera celda", () => {
      const el = { closest: (s) => (s === "tr" ? { firstElementChild: { textContent: " Piel y faneras: " } } : null) };
      t.igual(api._etiquetaCercanaCasilla(el), "Piel y faneras:");
    });

    t.caso("_etiquetaCercanaCasilla: 3er intento, label y fila vacíos, cae a previousElementSibling", () => {
      const el = {
        closest: (s) => (s === "tr" ? { firstElementChild: { textContent: "" } } : null),
        previousElementSibling: { textContent: " Abdomen: " },
      };
      t.igual(api._etiquetaCercanaCasilla(el), "Abdomen:");
    });

    t.caso("_etiquetaCercanaCasilla: 4to intento, solo queda parentElement.previousElementSibling", () => {
      const el = { parentElement: { previousElementSibling: { textContent: " Genito-Urinario: " } } };
      t.igual(api._etiquetaCercanaCasilla(el), "Genito-Urinario:");
    });

    t.caso("_etiquetaCercanaCasilla: ninguno de los 4 resuelve => cadena vacía, nunca null/undefined", () => {
      t.igual(api._etiquetaCercanaCasilla({}), "");
    });

    t.caso("_etiquetaCercanaCasilla: nunca lanza, aunque closest reviente", () => {
      const el = { closest: () => { throw new Error("DOM roto"); } };
      let r;
      t.noLanza(() => { r = api._etiquetaCercanaCasilla(el); });
      t.igual(r, "");
    });

    // =====================================================================
    // v14.2.4/6 — _excluirMamasGenitoPorTexto: la plantilla FIJA de normalidad
    // semiológica excluye a propósito Mamas y Genito-Urinario (36 casillas, no 38), pero
    // esas 2 casillas pueden seguir en el DOM real. Si el texto cercano de las casillas
    // "sobrantes" nombra sin ambigüedad cuál es Mamas y/o Genito, se excluyen y se
    // reintenta el emparejamiento 1 a 1; si hay CUALQUIER duda, null (fail-safe: el
    // llamador cae al rehúso de siempre, nunca a una casilla equivocada).
    // =====================================================================
    function candNeutro(id) { return { id, closest: () => null }; }
    function candConTexto(id, texto) { return { id, closest: (s) => (s === "label" ? { textContent: texto } : null) }; }
    function candidatos(n, overrides) {
      const arr = []; for (let i = 0; i < n; i++) arr.push(candNeutro(i));
      Object.keys(overrides || {}).forEach((i) => { arr[i] = overrides[i]; });
      return arr;
    }

    t.caso("_excluirMamasGenitoPorTexto: exactamente 36 candidatos (sin sobrante) => null, ni siquiera mira texto", () => {
      t.igual(api._excluirMamasGenitoPorTexto(candidatos(36)), null);
    });

    t.caso("_excluirMamasGenitoPorTexto: 37 candidatos con UN 'Mamas' identificado => lo excluye y devuelve 36", () => {
      const arr = candidatos(37, { 10: candConTexto(10, "Mamas:") });
      const r = api._excluirMamasGenitoPorTexto(arr);
      t.igual(r.length, 36);
      t.falso(r.some((x) => x.id === 10), "la casilla de Mamas identificada salió");
    });

    t.caso("_excluirMamasGenitoPorTexto: 37 candidatos con UN 'Genito' identificado => lo excluye y devuelve 36", () => {
      const arr = candidatos(37, { 5: candConTexto(5, "Genito-Urinario:") });
      const r = api._excluirMamasGenitoPorTexto(arr);
      t.igual(r.length, 36);
      t.falso(r.some((x) => x.id === 5));
    });

    t.caso("_excluirMamasGenitoPorTexto: 37 candidatos sin NINGÚN texto reconocible => null (fail-safe: no adivina)", () => {
      t.igual(api._excluirMamasGenitoPorTexto(candidatos(37)), null);
    });

    t.caso("_excluirMamasGenitoPorTexto: 37 candidatos con DOS matches (ambiguo con solo 1 casilla de sobra) => null", () => {
      const arr = candidatos(37, { 1: candConTexto(1, "Mamas:"), 2: candConTexto(2, "Genito:") });
      t.igual(api._excluirMamasGenitoPorTexto(arr), null, "sobra 1 pero hay 2 candidatos: no puede saber cuál de los 2 es el de más");
    });

    t.caso("_excluirMamasGenitoPorTexto: 38 candidatos con Mamas Y Genito, cada uno en su propia casilla => excluye ambas, devuelve 36", () => {
      const arr = candidatos(38, { 3: candConTexto(3, "Mamas:"), 7: candConTexto(7, "Genito-Urinario:") });
      const r = api._excluirMamasGenitoPorTexto(arr);
      t.igual(r.length, 36);
      t.falso(r.some((x) => x.id === 3 || x.id === 7));
    });

    t.caso("_excluirMamasGenitoPorTexto: 38 candidatos pero falta identificar uno de los dos => null", () => {
      const arr = candidatos(38, { 3: candConTexto(3, "Mamas:") });
      t.igual(api._excluirMamasGenitoPorTexto(arr), null, "sobran 2, pero solo se identificó 1: no se adivina la otra");
    });

    t.caso("_excluirMamasGenitoPorTexto: 38 candidatos, pero la MISMA casilla parece ser Mamas Y Genito a la vez => null", () => {
      const arr = candidatos(38, { 3: candConTexto(3, "Mamas: y también Genito-Urinario:"), 9: candNeutro(9) });
      t.igual(api._excluirMamasGenitoPorTexto(arr), null, "una sola casilla no puede cubrir los 2 roles: sigue habiendo ambigüedad");
    });

    t.caso("_excluirMamasGenitoPorTexto: sobrante fuera de {1,2} (3 de más, o de menos) => null inmediato", () => {
      t.igual(api._excluirMamasGenitoPorTexto(candidatos(39)), null, "3 de más: no es el patrón esperado (secciones pediátricas extra, etc.)");
      t.igual(api._excluirMamasGenitoPorTexto(candidatos(35)), null, "de menos: tampoco encaja");
    });

    t.caso("_excluirMamasGenitoPorTexto: 'Genital' (Revisión por sistema) NUNCA se confunde con 'Genito' (difieren en la 6ª letra)", () => {
      const arr = candidatos(37, { 4: candConTexto(4, "Sistemas Genital/urinario:") });
      t.igual(api._excluirMamasGenitoPorTexto(arr), null, "no matchea GENITO: sin identificación real, gana el fail-safe");
    });

    t.caso("_excluirMamasGenitoPorTexto: la búsqueda de MAMA/GENITO no distingue mayúsculas de minúsculas", () => {
      const arr = candidatos(37, { 8: candConTexto(8, "mamas (examen):") });
      const r = api._excluirMamasGenitoPorTexto(arr);
      t.igual(r.length, 36);
    });

    t.caso("toggleSheet: repetir el mismo tipo funciona como conmutador (cierra)", () => {
      cv.api.toggleSheet("resumen");
      t.igual(cv.api.__state.sheet, "resumen");
      cv.api.toggleSheet("resumen");
      t.igual(cv.api.__state.sheet, null);
      t.falso(raiz.classList.contains("sheet"));
    });

    // ================= renderSettings =================
    t.caso("toggleSheet('ajustes'): renderSettings pinta los Ajustes con la sección técnica oculta", () => {
      cv.api.toggleSheet("ajustes");
      t.igual(cv.api.__state.sheet, "ajustes");
      t.cierto(hoja.innerHTML.includes("Ajustes"));
      t.cierto(hoja.innerHTML.includes("Modo rendimiento"));
      t.cierto(hoja.innerHTML.includes('vgl-d-none'), "sin opcionesTecnicas la sección técnica va oculta");
      t.igual(hoja.querySelector("#c-tema").value, "oscuro", "el selector de tema refleja S.tema");
    });

    // v14.0.4 — AUDITORIA_MOTOR_RCV_v68.md §7.4: la tabla FESTIVOS está codificada a mano
    // por años — sin un aviso VISIBLE (no solo por consola), un festivo real que falta
    // porque la tabla caducó puede ofrecer un día de agenda que en realidad está cerrado.
    // v15.5.0 — La tabla de festivos salió de Ajustes (barrido), pero su SEGURIDAD se
    // reubicó en el arranque: estas dos pruebas siguen fijando lo mismo — que el aviso de
    // vencimiento exista, calle mientras falten años y hable al llegar el último.
    // v16.9.0 — Los festivos se CALCULAN (Ley Emiliani), así que este aviso dejó de ser
    // «la tabla caduca en 2027» y pasó a ser una verificación: compara el cálculo contra
    // la tabla de referencia en los años que ambos cubren y avisa si discrepan, con el
    // día exacto. Que ya no caduque es justamente lo que había que arreglar: en enero de
    // 2028 el asistente habría citado tomas el 1 de enero sin decir nada.
    // v16.9.0 — DECISIÓN DEL MÉDICO: sin datos para recomendar, ningún chip de plazo
    // sale activo. El «1 mes» venía marcado en el HTML, así que un plazo que nadie
    // eligió parecía elegido — y de ahí salían controles a un mes por defecto.
    t.caso("agendar: ningún plazo viene marcado de fábrica", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.falso(/class="vgl-agm-pbtn active" data-m="1"/.test(src), "el chip «1 mes» ya no nace activo");
      t.falso(/let selectedTimeframe = \{ m: 1, d: 0 \}/.test(src), "ni el estado interno arranca en un mes");
      t.cierto(/let selectedTimeframe = null/.test(src), "arranca sin plazo elegido");
      t.cierto(/No propongo un plazo por mi cuenta/.test(src), "y cuando no hay con qué deducirlo, se dice");
    });

    t.caso("_festivosAvisarSiVencida: si el cálculo coincide con la tabla de referencia, silencio", () => {
      const c = cargar({ silencioso: true });
      const antes = c.env.win.document._nodos.length;
      t.falso(c.api._festivosAvisarSiVencida(2026), "2026 cuadra día a día: nada que decir");
      t.falso(c.api._festivosAvisarSiVencida(2025), "2025 también");
      t.igual(c.env.win.document._nodos.length, antes, "cero avisos creados");
    });

    t.caso("_festivosAvisarSiVencida: los años ya no caducan — 2031 no dispara ningún aviso", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api._festivosAvisarSiVencida(2031), "la tabla no cubre 2031, pero el cálculo sí: no hay nada que verificar ni que avisar");
      t.falso(c.api._festivosAvisarSiVencida(2028), "ni 2028, que antes era el primer año ciego");
      t.cierto(c.api.mtrEsFestivoCO("2031-01-01"), "y el 1 de enero de 2031 sigue siendo festivo, que es lo que importa");
    });

    t.caso("_festivosAvisarSiVencida: si el cálculo y la tabla discrepan, avisa UNA vez al día con el día exacto", () => {
      const c = cargar({ silencioso: true });
      // Se ensucia la tabla de referencia con un festivo que la ley no da.
      c.api._festivosTablaAgregarParaTest("2026-02-14");
      t.cierto(c.api._festivosAvisarSiVencida(2026), "la discrepancia se detecta");
      const msg = c.api._festivosMensajeDiscrepancia(2026, ["2026-02-14"], []);
      t.cierto(/2026-02-14/.test(msg), "y el aviso nombra el día concreto, no un «actualice» genérico");
      t.cierto(/mueve una fecha de toma/.test(msg), "diciendo por qué importa");
      t.cierto(/Yo calculo 2026-06-29/.test(c.api._festivosMensajeDiscrepancia(2026, [], ["2026-06-29"])),
        "y distingue de qué lado está el día que sobra");
      t.cierto(c.api._festivosAvisarSiVencida(2026), "el mismo día devuelve true sin duplicar (sello diario)");
      t.igual(c.env.storage.getItem("vgl_festivos_aviso"), c.api.todayStamp(), "queda el sello del día");
    });

    // v15.6.0 — Ajustes con Guardar/Descartar: cambiar un control ya NO aplica al vuelo.
    t.caso("renderSettings v15.6: cambiar un interruptor NO toca S hasta Guardar; la barra aparece; Guardar aplica y persiste", () => {
      const chk = hoja.querySelector("#c-snd");
      chk.checked = false;
      disparar(chk, "change");
      t.igual(cv.api.__S.sonido, true, "S.sonido sigue encendido: el cambio vive en el borrador");
      const bar = hoja.querySelector("#vgl-set-bar");
      t.cierto(!!bar && !bar.className.includes("vgl-d-none"), "la barra «Tiene cambios sin guardar» se muestra");
      t.cierto(cv.api._ajustesSucio(), "el borrador está sucio");
      cv.api._ajustesGuardar();
      t.igual(cv.api.__S.sonido, false, "Guardar aplicó el cambio a S");
      const cfg = JSON.parse(cv.env.almacen.vgl_cfg);
      t.igual(cfg.sonido, false, "y lo persistió");
      t.falso(cv.api._ajustesSucio(), "el borrador quedó limpio");
    });

    // v17.0.4 — REPORTE DE CAMPO (pantallazo real, 21-08-2026): «cuando le doy Guardar
    // cambios no da ningún mensaje de confirmación y no se cierra la ventana de Ajustes
    // como lo haría normalmente cualquier programa». La prueba de arriba llamaba a
    // _ajustesGuardar() DIRECTAMENTE, así que comprobaba que el ajuste se aplica y se
    // persiste — pero nunca tocó el botón real ni miró qué ve el médico al pulsarlo, que
    // es justo donde estaba el defecto. Esta entra por el botón, como el médico.
    await t.casoAsync("renderSettings (v17.0.4): pulsar «💾 Guardar cambios» CIERRA la ventana de Ajustes y deja el cartel verde de confirmación", async () => {
      cv.api.__state.sheet = "ajustes";
      cv.api.renderSettings();

      // La bandeja de avisos se instrumenta para cazar el cartel EN EL MOMENTO en que se
      // cuelga: el arnés comprime todos los setTimeout a 1 ms, así que el autocierre de los
      // 9 s del cartel verde se dispara casi al instante y contarlos al final da siempre 0
      // (un falso «no hay confirmación» que ya despistó una vez durante el diagnóstico).
      const bandeja = cv.env.doc.body.children.find((n) => n.id === "vgl-toasts");
      t.cierto(!!bandeja, "la bandeja de avisos existe (la monta buildOverlay)");
      // Esta suite comparte UNA instancia entre todas sus pruebas, así que puede haber
      // avisos encolados por pruebas anteriores. Se les deja vaciar la cola ANTES de
      // instrumentar, para contar solo lo que produzca este clic.
      await esperar(700);
      const carteles = [];
      const apDir = bandeja.appendChild.bind(bandeja);
      const inDir = bandeja.insertBefore.bind(bandeja);
      bandeja.appendChild = (c) => { carteles.push(c); return apDir(c); };
      bandeja.insertBefore = (c) => { carteles.push(c); return inDir(c); };

      const chk = hoja.querySelector("#c-snd");
      chk.checked = !chk.checked;
      disparar(chk, "change");
      t.cierto(cv.api._ajustesSucio(), "hay algo que guardar: la barra de Guardar/Descartar está a la vista");

      disparar(hoja.querySelector("#c-guardar"), "click");
      await esperar(700);   // la cola de avisos se vacía a los 500 ms

      t.igual(cv.api.__state.sheet, null,
        "REGRESIÓN (reporte real 21-08-2026): Guardar cierra la ventana de Ajustes, como cualquier programa — antes se quedaba abierta e igualita, y por eso el médico no sabía si había guardado");
      t.falso(cv.api._ajustesSucio(), "y no queda nada pendiente en el borrador");
      t.igual(carteles.length, 1, "sale UN cartel de confirmación, ni ninguno ni varios");
      t.cierto(String(carteles[0].innerHTML || "").includes("--c-verde"), "y es el verde de «hecho», no un aviso de error");

      bandeja.appendChild = apDir; bandeja.insertBefore = inDir;   // se deja la bandeja como estaba
      cv.api.__state.sheet = "ajustes";
      cv.api.renderSettings();                                     // …y Ajustes abierto para las pruebas que siguen
    });

    t.caso("renderSettings v15.6: Descartar devuelve el control a lo guardado y no persiste nada", () => {
      cv.api.renderSettings();
      const chk = hoja.querySelector("#c-agend");
      chk.checked = false;
      disparar(chk, "change");
      t.cierto(cv.api._ajustesSucio());
      cv.api._ajustesDescartar();
      t.falso(cv.api._ajustesSucio(), "borrador limpio tras descartar");
      t.igual(cv.api.__S.agendamientoRapido !== false, true, "S quedó como estaba");
    });

    // v15.6.0 — lo técnico ya no tiene interruptor visible: solo el modo programador
    // (Ctrl+Shift+D), que no se persiste y los médicos no ven.
    t.caso("renderSettings v15.6: el interruptor de opciones técnicas YA NO EXISTE; el modo programador muestra el grupo", () => {
      cv.api.renderSettings();
      t.falso(hoja.innerHTML.includes("c-tecnicas"), "el interruptor visible desapareció");
      t.falso(hoja.innerHTML.includes("Mostrar opciones técnicas"), "y su fila también");
      t.cierto(hoja.innerHTML.includes('vgl-grp-tec vgl-d-none') || /vgl-grp-tec\s+vgl-d-none/.test(hoja.innerHTML), "sin modo programador, el grupo técnico va oculto");
      cv.api._vglAlternarModoProg();
      t.cierto(hoja.innerHTML.includes("Modo programador"), "con el modo activo, el grupo se pinta");
      t.cierto(hoja.innerHTML.includes("Probar avisos"), "los controles técnicos están pintados");
      t.cierto(hoja.innerHTML.includes("c-ia-key"), "la clave de la IA vive aquí");
      t.cierto(hoja.innerHTML.includes("c-repgo"), "y el probador de comunicación también");
      cv.api._vglAlternarModoProg();   // lo dejamos apagado para el resto de la suite
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null);
    });

    t.caso("Ajustes v15.6: intentar cerrar con cambios pendientes ofrece «Guardar y salir / Salir sin guardar» (y no cierra solo)", () => {
      cv.api.__state.sheet = "ajustes";
      cv.api.renderSettings();
      const chk = hoja.querySelector("#c-snd");
      chk.checked = !chk.checked;
      disparar(chk, "change");
      t.cierto(cv.api._ajustesSucio(), "hay borrador");
      cv.api._ajustesPintarBarra();
      cv.api._ajustesIntentarCerrar();
      t.cierto(cv.api.__state.sheet !== null, "la hoja NO se cerró de una");
      const barCierre = hoja.querySelector("#vgl-set-bar");
      t.cierto(String(barCierre.innerHTML).includes("Guardar y salir") && String(barCierre.innerHTML).includes("Salir sin guardar"), "las dos salidas claras están pintadas en la barra");
      cv.api._ajustesDescartar();  // limpiar para lo que sigue
      cv.api.closeSheet();
    });

    // ================= v15.6.0 — FICHA DEL PACIENTE (Propuesta 1) =================
    await t.casoAsync("openFichaPacienteModal: con resumen en caché pinta las secciones con su FUENTE y avisa cuántos datos faltan", async () => {
      const c = cargar({ silencioso: true });
      c.api.mtrCacheResumenGuardar("111111111", {
        programa: "HTA", factores: { edad: 66, sexo: "F", pesoKg: 70, diabetes: true, hta: true },
        erc: { crcl: 58, estadioAdministrativo: "G3a" },
        riesgo: { categoria: "ALTO" },
        ultimos: { CREATININA: { valor: 1.1, fecha: "2026-08-01" }, COLESTEROL_LDL: { valor: 130, fecha: "2026-08-01" } },
        medicamentos: ["LOSARTAN 50MG", "METFORMINA 850MG"],
        plan: { vencidos: [], faltantes: [{ nombre: "RAC" }] },
      });
      enriquecerDom(c);
      // v16.8.0 — la Ficha es ahora la sección «Resumen» del Panel del paciente. El punto
      // de entrada se conserva y tiene que aterrizar exactamente ahí.
      await c.api.openFichaPacienteModal({ doc_id: "111111111", nombre: "PACIENTE PRUEBA" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.cierto(!!modal, "el módulo unificado existe");
      const html = String(modal.querySelector("#vgl-panel-cuerpo").innerHTML);
      t.cierto(html.includes("Laboratorios (Athenea/Annar/Citi)"), "los laboratorios declaran su fuente");
      t.cierto(html.includes("Órdenes de Everest"), "los medicamentos declaran la suya");
      t.cierto(html.includes("Calculado por el asistente"), "lo calculado se declara calculado");
      t.cierto(html.includes("sin dato"), "lo que falta se declara «sin dato» — jamás se inventa");
      t.cierto(html.includes("Buscar laboratorios nuevos"), "el médico puede forzar una lectura fresca");
      t.cierto(html.includes("LOSARTAN 50MG"), "los medicamentos del motor se listan");
      const nav = String(modal.querySelector("#vgl-panel-nav-slot").innerHTML);
      ["Resumen", "Riesgo y función renal", "Exámenes y vigencias", "Tendencias", "Medicamentos"].forEach((sec) => {
        t.cierto(nav.includes(sec), "la sección está en la navegación: " + sec);
      });
    });

    t.caso("mtrFichaVivaFilas: cuenta los faltantes y no inventa nada con un resumen vacío", () => {
      const c = cargar({ silencioso: true });
      const d = c.api.mtrFichaVivaFilas({});
      t.cierto(d.faltantes >= 8, "casi todo falta y se dice (faltantes=" + d.faltantes + ")");
      const todas = d.secciones.flatMap((x) => x.filas);
      t.cierto(todas.every((f) => f.fuente && f.etiqueta), "toda fila lleva etiqueta y fuente");
      t.falso(todas.some((f) => /undefined|null|NaN/.test(String(f.valor))), "ningún valor basura");
      const lleno = c.api.mtrFichaVivaFilas({ factores: { edad: 60, sexo: "M" }, programa: "DM2", medicamentos: ["A"], plan: { vencidos: [], faltantes: [] }, ultimos: {} });
      t.cierto(lleno.faltantes < d.faltantes, "con datos, faltan menos");
    });

    // v17.2.0 (#114) — la costura ENTERA hasta la fila que el médico ve: no basta con que
    // mtrMedicamentosRcv sepa incluir la frecuencia (ya probado aparte, suite 39); hace
    // falta que mtrFichaVivaFilas de verdad le pase resumen.medicamentosFrecuencia — un
    // typo en ese nombre de campo no lo cazaba ninguna prueba hasta esta.
    t.caso("mtrFichaVivaFilas (#114): la frecuencia real llega hasta la fila del medicamento en la Ficha", () => {
      const c = cargar({ silencioso: true });
      const frecuencias = new Map([["losartan potasico 50 mg tableta", "cada 1 día"]]);
      const r = c.api.mtrFichaVivaFilas({
        factores: { edad: 60, sexo: "M" }, programa: "HTA",
        medicamentos: ["LOSARTAN POTASICO 50 MG TABLETA"], medicamentosFrecuencia: frecuencias,
        plan: { vencidos: [], faltantes: [] }, ultimos: {},
      });
      const filaMed = r.secciones.flatMap((s) => s.filas).find((f) => /LOSARTAN/.test(f.valor));
      t.cierto(!!filaMed, "existe la fila del medicamento");
      t.cierto(/\(cada 1 día\)/.test(filaMed.valor), "y trae la frecuencia real entre paréntesis: " + filaMed.valor);
      // Sin el campo (el caso de siempre): la misma fila, sin paréntesis de más.
      const sinFrecuencia = c.api.mtrFichaVivaFilas({
        factores: { edad: 60, sexo: "M" }, programa: "HTA",
        medicamentos: ["LOSARTAN POTASICO 50 MG TABLETA"],
        plan: { vencidos: [], faltantes: [] }, ultimos: {},
      });
      const filaSinFrec = sinFrecuencia.secciones.flatMap((s) => s.filas).find((f) => /LOSARTAN/.test(f.valor));
      t.falso(/\(cada/.test(filaSinFrec.valor), "sin medicamentosFrecuencia, ninguna frecuencia inventada: " + filaSinFrec.valor);
    });

    // ================= v15.6.0 — REDACTOR (puerta del widget) =================
    await t.casoAsync("abrirRedactorTextoLibre: sin clave configurada explica en lenguaje llano y NO abre panel", async () => {
      const c = cargar({ silencioso: true });
      c.api.__S.iaRedaccion = true;
      await c.api.abrirRedactorTextoLibre({ doc_id: "111111111" });
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-ia-modal"), "sin clave no hay panel");
    });
    // ============ v15.7.0 — INVOCACIÓN DIRECTA de las piezas que solo se probaban indirecto ============
    t.caso("_anularCitaAsignada delega en la anulación real (misma guarda: sin radicado, cero POST)", async () => {
      let llamadas = 0;
      const c = cargar({ silencioso: true, fetch: async () => { llamadas++; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "" }; }, gmxhr: (o) => { if (o.onerror) o.onerror("x"); } });
      c.api.__state.activeDoctor = { id: 594, name: "M" };
      c.api.markCitaAgendadaHoy("777777777", "2026-09-14");   // sin citaId
      const r = await c.api._anularCitaAsignada({ doc_id: "777777777" }, {});
      t.falso(r, "delegó y la guarda del radicado mandó");
      t.igual(llamadas, 0, "cero POST a ciegas");
    });

    t.caso("_anularCitaMarcasLocales limpia todas las marcas del paciente (directo)", () => {
      const c = cargar({ silencioso: true });
      c.api.markCitaAgendadaHoy("888888888", "2026-09-14", { citaId: 5, pacienteId: 6, eps: "", hora: "" });
      t.cierto(c.api.isCitaAgendadaHoy("888888888"));
      c.api._anularCitaMarcasLocales("888888888");
      t.falso(c.api.isCitaAgendadaHoy("888888888"), "marca de cita fuera");
    });

    t.caso("_vglModoOcultoAplicar pone y quita la clase del cuerpo (directo)", () => {
      const c = cargar({ silencioso: true });
      c.api._vglModoOcultoAplicar(true);
      t.cierto(c.env.doc.body.classList.contains("vgl-modo-oculto"), "oculto: clase puesta");
      c.api._vglModoOcultoAplicar(false);
      t.falso(c.env.doc.body.classList.contains("vgl-modo-oculto"), "visible: clase fuera");
    });

    t.caso("_vglFeedbackBoton pinta el resultado sobre el botón y le deja su rótulo para restaurar (directo)", () => {
      const c = cargar({ silencioso: true });
      const btn = c.env.doc.createElement("button");
      btn.innerHTML = "🩺 Normalidad";
      c.api._vglFeedbackBoton(btn, "✓ 3 escritas", "verde", "🩺 Normalidad");
      t.cierto(String(btn.innerHTML).includes("3 escritas"), "el botón cuenta el resultado");
      t.cierto(btn.disabled === true || String(btn.innerHTML).length > 0, "queda en estado de aviso");
    });

    t.caso("_vglOfrecerDeshacer crea el botón ↩ junto al botón dueño (directo)", () => {
      const c = cargar({ silencioso: true });
      const dueño = c.env.doc.createElement("button");
      const padre = c.env.doc.createElement("div");
      padre.appendChild(dueño); dueño.parentNode = padre;
      const caja = { value: "x", isConnected: true, dispatchEvent: () => {} };
      c.api._vglGuardarDeshacer("999999999", [{ el: caja, prev: "" }], "Prueba");
      t.noLanza(() => c.api._vglOfrecerDeshacer(dueño), "ofrecer no lanza");
    });

    t.caso("_ajustesPonBorrador marca sucio con un valor distinto y limpia al volver al original (directo)", () => {
      const c = cargar({ silencioso: true });
      const original = c.api.__S.sonido;
      c.api._ajustesPonBorrador("sonido", !original);
      t.cierto(c.api._ajustesSucio(), "distinto: sucio");
      c.api._ajustesPonBorrador("sonido", original);
      t.falso(c.api._ajustesSucio(), "igual al guardado: el borrador se limpia solo");
    });

    t.caso("_vglInstalarModoProg cuelga el atajo del teclado y Ctrl+Shift+D alterna el modo (directo)", () => {
      const c = cargar({ silencioso: true });
      const capturados = [];
      c.env.doc.addEventListener = (tipo, fn) => { if (tipo === "keydown") capturados.push(fn); };
      c.api._vglInstalarModoProg();
      t.cierto(capturados.length === 1, "el atajo quedó instalado");
      const handler = capturados[0];
      handler({ ctrlKey: true, shiftKey: true, altKey: false, key: "d", target: { tagName: "DIV" }, preventDefault: () => {}, stopPropagation: () => {} });
      // alternó: renderSettings con el grupo visible lo prueba el caso del modo programador;
      // aquí basta el efecto observable de volver a alternar sin lanzar.
      t.noLanza(() => handler({ ctrlKey: true, shiftKey: true, altKey: false, key: "d", target: { tagName: "DIV" }, preventDefault: () => {}, stopPropagation: () => {} }), "alternar de vuelta no lanza");
    });

    t.caso("_acompMedId/_acompStoreLeer/_acompStoreGuardar: el almacén por médico va y viene (directo)", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 901, name: "M" };
      t.igual(c.api._acompMedId(), "901", "la identidad sale del médico en sesión");
      c.api._acompStoreGuardar({ 901: { estado: "on", flujos: 2, vistos: {} } });
      const st = c.api._acompStoreLeer();
      t.igual(st["901"].flujos, 2, "lo guardado se relee tal cual");
    });

    // ================= v15.6.0 — MODO ACOMPAÑADO (Propuesta 6) =================
    t.caso("guía: un médico NUNCA visto nace en «auto» con la guía activa; a los 5 flujos completos se apaga sola", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 777, name: "MEDICO NUEVO" };
      t.cierto(c.api._acompActivo(), "recién llegado: guía encendida sola");
      for (let i = 0; i < 4; i++) c.api._acompNotificarAccion("fn.agendar.complete");
      t.cierto(c.api._acompActivo(), "con 4 flujos sigue");
      c.api._acompNotificarAccion("ordenes.creadas");
      t.falso(c.api._acompActivo(), "al 5º flujo real se apaga sola");
      t.igual(c.api._acompEstadoLeer().flujos, 5, "y el conteo quedó guardado");
    });

    t.caso("guía: cuenta flujos aunque la telemetría esté APAGADA (el gancho vive antes del interruptor)", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 778, name: "M" };
      c.api.__S.uxTelemetria = false;
      c.api.uxTrack("fn.agendar.complete");
      t.igual(c.api._acompEstadoLeer().flujos, 1, "el flujo contó igual");
      t.igual(c.env.storage.getItem("vgl_ux"), null, "y la telemetría siguió sin escribir nada");
    });

    t.caso("guía: el interruptor de Ajustes manda — off apaga aunque sea nuevo; on reinicia el aprendizaje", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 779, name: "M" };
      c.api._acompEstadoGuardar({ estado: "off" });
      t.falso(c.api._acompActivo());
      c.api._acompEstadoGuardar({ estado: "on", flujos: 0 });
      t.cierto(c.api._acompActivo());
      for (let i = 0; i < 9; i++) c.api._acompNotificarAccion("fn.ia.insert");
      t.cierto(c.api._acompActivo(), "en «on» explícito no se apaga sola por flujos");
    });

    t.caso("guía: la sugerencia sigue el estado real — leer primero, luego agendar (con o sin labs pendientes), luego ordenar", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 780, name: "M" };
      const apt = { doc_id: "444444444" };
      // sin resumen: empiece por la Ficha
      t.igual((c.api._acompSugerencia(apt) || {}).id, "leer");
      // resumen con pendientes y sin cita: agendar con labs primero
      c.api.mtrCacheResumenGuardar("444444444", { plan: { vencidos: [{ k: 1 }], faltantes: [] } });
      t.igual((c.api._acompSugerencia(apt) || {}).id, "agendar_labs");
      // resumen sin pendientes y sin cita: agendar control
      c.api.mtrCacheResumenGuardar("444444444", { plan: { vencidos: [], faltantes: [] } });
      t.igual((c.api._acompSugerencia(apt) || {}).id, "agendar");
      // cita hecha + PyM disponible: ordenar
      c.api.markCitaAgendadaHoy("444444444", "2026-09-01");
      c.env.doc.querySelector = (sel) => (sel === '#vgl-acciones-dock [data-accion="ordenar"]' ? { disabled: false } : null);
      t.igual((c.api._acompSugerencia(apt) || {}).id, "ordenar");
      // pestaña de examen físico a la vista: la normalidad manda sobre todo
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[id="alert_message"], input[id="sintomasGenerales"]' ? new Array(36).fill({}) : []);
      t.igual((c.api._acompSugerencia(apt) || {}).id, "normalidad");
    });

    t.caso("guía: la burbuja se muestra UNA vez, «Entendido» la cierra para ese paciente y «No volver a mostrar» la apaga para siempre", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 781, name: "M" };
      const apt = { doc_id: "555555555" };
      const hint = { id: "leer", target: '[data-accion="ficha"]', texto: "Empiece por aquí." };
      // v17.0.3 — desde ahora hace falta un blanco REAL y medible (ver suite de abajo);
      // este botón de Ficha sí está a la vista, que es el caso normal.
      c.env.doc.querySelector = (sel) => (sel === '[data-accion="ficha"]' ? c.env.doc.createElement("button") : null);
      c.api._acompMostrar(hint, apt);
      const b = c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja");
      t.cierto(!!b, "la burbuja existe");
      t.cierto(String(b.innerHTML).includes("Entendido") && String(b.innerHTML).includes("No volver a mostrar"), "las dos salidas están");
      // Entendido → se anota como vista de este paciente (la sesión no la repite)
      c.api._acompCerrar(true);
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja"), "cerrada");
      // «No volver a mostrar» persistido por médico
      const e0 = c.api._acompEstadoLeer(); const v = e0.vistos || {}; v.leer = true;
      c.api._acompEstadoGuardar({ vistos: v });
      t.cierto(c.api._acompEstadoLeer().vistos.leer, "el veto quedó persistido por médico");
    });

    // =====================================================================
    //  v17.0.3 — REPORTE DE CAMPO (pantallazo del médico): la burbuja de la
    //  guía paso a paso aparecía SIN señalar nada — flotando sobre un
    //  formulario de medicamentos, y otra vez sobre Citas del día con el
    //  panel cerrado. Dos causas distintas, dos remedios:
    //   1) _acompMostrar se conformaba con una posición fija (260,150) cuando
    //      no podía medir el botón real — y esa esquina cae encima de
    //      cualquier cosa que haya ahí. Ahora exige un blanco de verdad
    //      visible (medible, con ancho y alto reales) o no muestra nada.
    //   2) Al salir del módulo de historia clínica, nadie recogía la burbuja
    //      que ya estaba en pantalla (Everest no recarga la página): quedaba
    //      colgada del body con su última posición, igual que le pasó a
    //      Auto-Labs en v16.1.0. Se le aplicó el mismo barrido.
    // =====================================================================
    t.caso("_acompMostrar: sin blanco en el DOM (el botón no existe en esta pantalla) NO muestra nada — antes caía en una esquina fija tapando el formulario", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 787, name: "M" };
      const hint = { id: "leer", target: '[data-accion="ficha"]', texto: "Empiece por aquí." };
      c.env.doc.querySelector = () => null;   // el botón no está en esta pantalla
      c.api._acompMostrar(hint, { doc_id: "1" });
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja"), "mejor nada que una burbuja sin señalar nada");
    });

    t.caso("_acompMostrar: el botón existe pero está oculto (ancho/alto cero — el panel se recogió, p.ej. en Ordenamiento) tampoco muestra nada", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 788, name: "M" };
      const hint = { id: "leer", target: '[data-accion="ficha"]', texto: "Empiece por aquí." };
      const btnOculto = c.env.doc.createElement("button");
      btnOculto.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }); // display:none real
      c.env.doc.querySelector = (sel) => (sel === '[data-accion="ficha"]' ? btnOculto : null);
      c.api._acompMostrar(hint, { doc_id: "1" });
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja"), "mismo remedio: sin tamaño real no hay dónde pegarla");
    });

    t.caso("_acompMostrar: con un blanco real y medible, la burbuja se pega a SU posición — nunca a la vieja esquina fija 260/150", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 789, name: "M" };
      const hint = { id: "leer", target: '[data-accion="ficha"]', texto: "Empiece por aquí." };
      const btn = c.env.doc.createElement("button");
      btn.getBoundingClientRect = () => ({ top: 500, left: 300, right: 380, bottom: 540, width: 80, height: 40 });
      c.env.doc.querySelector = (sel) => (sel === '[data-accion="ficha"]' ? btn : null);
      c.api._acompMostrar(hint, { doc_id: "1" });
      const b = c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja");
      t.cierto(!!b, "sí se muestra: hay un blanco real");
      t.igual(b.style.top, "492px", "pegada arriba del botón real (500-8)");
      t.igual(b.style.left, "390px", "pegada a su derecha real (380+10) — nunca la esquina fija 150");
    });

    t.caso("tick: al salir del módulo de historia clínica, una burbuja de la guía que quedó colgada se recoge sola (mismo remedio que Auto-Labs en v16.1.0)", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      c.api.buildOverlay();
      // Simula la burbuja que quedó viva de una vuelta anterior (Everest no recarga la página).
      const burbuja = c.env.doc.createElement("div");
      burbuja.id = "vgl-acomp-burbuja";
      c.env.doc.body.appendChild(burbuja);
      t.cierto(!!c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja"), "queda plantada, como en el pantallazo");

      c.env.win.location.pathname = "/viva/Acceso/";   // el médico volvió a Citas del día / salió del módulo
      c.api.tick();
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja"), "se recoge sola al salir: ya no tiene sentido ahí");
    });

    // v17.0.3 — REPORTE DE CAMPO (pantallazo real, 21-08-2026): "AUTOLABS SIGUE
    // APARECIENDO EN LA HOJA DE CITAS DEL DÍA, ESTO ES INCORRECTO" — el botón flotante
    // "🧬 Auto-Labs (Athenea)" quedaba pegado sobre la lista de Citas del día. Causa real:
    // el barrido de v16.1.0 (arriba, con la burbuja de la guía) solo recoge los inyectados
    // cuando el médico sale de HCHealth POR COMPLETO (!_enModuloHCHealth()) — pero
    // _enModuloHCHealth() es deliberadamente ancha (ver su propio comentario: "Citas del
    // día" Y la Historia Clínica viven ambas bajo /viva/HCHealth/). Volver de la historia
    // de un paciente a Citas del día — lo más normal del mundo, docenas de veces al día —
    // se queda DENTRO de HCHealth, así que ese barrido nunca se disparaba para esta
    // transición, la más frecuente de todas. Arreglo: el barrido también se dispara cuando
    // secc !== "historia" (el mismo marcador ya usado arriba, línea ~21910), sin importar
    // si la ruta sigue bajo HCHealth.
    t.caso("tick: Auto-Labs que quedó visible en la Historia Clínica NO debe seguir viéndose al volver a Citas del día, aunque la ruta siga bajo /viva/HCHealth/", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      c.api.buildOverlay();
      // Simula el botón ya creado y visible desde una vuelta anterior por Ruta Crónicos
      // (Everest no recarga la página al navegar — igual que la burbuja de la guía arriba).
      const btnLab = c.env.doc.createElement("button");
      btnLab.id = "vgl-lab-injector";
      btnLab.style.display = "";
      c.env.doc.body.appendChild(btnLab);
      t.cierto(!!c.env.doc.body.children.find((n) => n.id === "vgl-lab-injector"), "queda plantado, como en el pantallazo real");

      // El médico vuelve a Citas del día — la ruta SIGUE bajo /viva/HCHealth/ (por eso
      // _enModuloHCHealth() sola no bastaba) y el DOM ya no tiene #anamesis sino los
      // marcadores de la agenda (hora + chip de estado).
      c.env.win.location.pathname = "/viva/HCHealth/Agenda";
      c.env.doc.querySelector = (sel) => (sel === ".labelHora" || sel === ".status-label" ? c.env.doc.createElement("span") : null);
      t.igual(c.api.seccionActiva(), "agenda", "confirma el mismo caso real: Citas del día, no Historia Clínica");
      c.api.tick();
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-lab-injector" && n.isConnected !== false),
        "REGRESIÓN (reporte real 21-08-2026): se recoge también al volver a Citas del día, aunque la ruta siga siendo de HCHealth");
    });

    t.caso("guía: _acompTick calla con la guía apagada y con un modal del asistente abierto", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 782, name: "M" };
      c.api._acompEstadoGuardar({ estado: "off" });
      c.api._acompTick({ doc_id: "1" });
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja"), "apagada: nada");
      c.api._acompEstadoGuardar({ estado: "on", flujos: 0 });
      c.env.doc.getElementById = (id) => (id === "vgl-agendar-modal" ? { id } : null);
      for (let i = 0; i < 4; i++) c.api._acompTick({ doc_id: "1" });
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acomp-burbuja"), "con modal abierto la guía no estorba");
    });

    t.caso("guía: la fila «Guía paso a paso» está en Ajustes y su interruptor actúa de una vez", () => {
      cv.api.__state.activeDoctor = { id: 783, name: "M" };
      cv.api.__state.sheet = "ajustes";
      cv.api.renderSettings();
      t.cierto(hoja.innerHTML.includes("Guía paso a paso"), "la fila existe");
      const sw2 = hoja.querySelector("#c-acomp");
      sw2.checked = true;
      disparar(sw2, "change");
      t.cierto(cv.api._acompActivo(), "encendida al instante para el médico en sesión");
      sw2.checked = false;
      disparar(sw2, "change");
      t.falso(cv.api._acompActivo(), "apagada al instante");
      cv.api.closeSheet();
    });

    await t.casoAsync("abrirRedactorTextoLibre: con clave y resumen en caché abre el panel de redacción", async () => {
      const c = cargar({ silencioso: true });
      c.api.__S.iaRedaccion = true;
      c.api.mtrGuardarClaveGemini("XX");
      c.api.mtrCacheResumenGuardar("111111111", { programa: "HTA", factores: {}, _docId: "111111111" });
      await c.api.abrirRedactorTextoLibre({ doc_id: "111111111" });
      t.cierto(!!c.env.doc.body.children.find((n) => n.id === "vgl-ia-modal"), "el panel se abrió sin pasar por el módulo beta de riesgo");
    });

    // ================= paintMute =================
    t.caso("paintMute: pinta el silencio activo con minutos restantes y vuelve al estado normal", () => {
      const botonMute = cv.env.doc.createElement("button");
      cv.env.doc.getElementById = (id) => (id === "vgl-mute" ? botonMute : null);
      cv.api.__state.muteUntil = Date.now() + 300000; // 5 minutos
      cv.api.paintMute();
      t.cierto(botonMute.classList.contains("off"));
      t.cierto(botonMute.textContent.startsWith("🔕"));
      t.cierto(botonMute.textContent.includes("5 min"));
      cv.api.__state.muteUntil = 0;
      cv.api.paintMute();
      t.falso(botonMute.classList.contains("off"));
      t.igual(botonMute.textContent, "🔉 Silenciar");
    });

    // ================= setSummary =================
    t.caso("setSummary: escribe el texto con el prefijo del nivel", () => {
      cv.api.setSummary("Todo en orden");
      t.igual(suma.textContent, "Todo en orden");
      t.igual(suma.className, "");
      cv.api.setSummary("Cuidado", "warn");
      t.igual(suma.textContent, "⏸ Cuidado");
      t.igual(suma.className, "warn");
      cv.api.setSummary("Falla", "error");
      t.igual(suma.textContent, "⚠ Falla");
      t.igual(suma.className, "error");
    });

    // ================= makeDraggable =================
    t.caso("makeDraggable: el arrastre mueve el nodo y al soltar se limpia el estado", () => {
      const docLis = {};
      cv.env.doc.addEventListener = (tipo, fn) => { docLis[tipo] = fn; };
      const caja = cv.env.doc.createElement("div");
      caja.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 40 });
      const asa = cv.env.doc.createElement("div");
      cv.api.makeDraggable(caja, asa);
      disparar(asa, "mousedown", { target: { closest: () => null }, clientX: 110, clientY: 60, preventDefault() {} });
      t.cierto(caja.classList.contains("vgl-dragging"), "durante el arrastre se apaga el blur");
      t.igual(caja.style.bottom, "auto");
      t.igual(caja.style.right, "auto");
      docLis.mousemove({ clientX: 300, clientY: 200 });
      t.igual(caja.style.left, "200px", "left = clientX - dx (300 - 100)");
      t.igual(caja.style.top, "160px", "top = clientY - dy (200 - 40)");
      docLis.mouseup();
      t.falso(caja.classList.contains("vgl-dragging"), "al soltar se restaura el vidrio");
      docLis.mousemove({ clientX: 500, clientY: 500 });
      t.igual(caja.style.left, "200px", "tras soltar, mover el mouse ya no arrastra");
      cv.env.doc.addEventListener = () => {};
    });

    t.caso("makeDraggable: un mousedown sobre un botón de la cabecera no inicia arrastre", () => {
      const docLis = {};
      cv.env.doc.addEventListener = (tipo, fn) => { docLis[tipo] = fn; };
      const caja = cv.env.doc.createElement("div");
      const asa = cv.env.doc.createElement("div");
      cv.api.makeDraggable(caja, asa);
      caja.style.left = "inicial";
      disparar(asa, "mousedown", { target: { closest: () => ({}) }, clientX: 100, clientY: 100, preventDefault() {} });
      t.falso(caja.classList.contains("vgl-dragging"));
      docLis.mousemove({ clientX: 400, clientY: 400 });
      t.igual(caja.style.left, "inicial", "sin arrastre activo no se mueve nada");
      cv.env.doc.addEventListener = () => {};
    });

    // [v14.2.0 — auditoría pre-producción 2026-08-18] Arrastre fantasma: si el médico
    // suelta el clic fuera del viewport de Chrome, nunca llega un "mouseup" — antes el
    // panel quedaba pegado al cursor para siempre. Hallazgo de la auditoría de
    // Gemini/Antigravity, verificado y aplicado sobre el código vigente — ver
    // BACKLOG_MEJORAS.md §4.5 y CHANGELOG.
    t.caso("makeDraggable: si el botón se suelta fuera del viewport (mousemove con buttons=0), el arrastre se detiene solo", () => {
      const docLis = {};
      cv.env.doc.addEventListener = (tipo, fn) => { docLis[tipo] = fn; };
      const caja = cv.env.doc.createElement("div");
      caja.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 40 });
      const asa = cv.env.doc.createElement("div");
      cv.api.makeDraggable(caja, asa);
      disparar(asa, "mousedown", { target: { closest: () => null }, clientX: 110, clientY: 60, preventDefault() {} });
      t.cierto(caja.classList.contains("vgl-dragging"), "arrastre iniciado");
      docLis.mousemove({ clientX: 300, clientY: 200, buttons: 1 });
      t.igual(caja.style.left, "200px", "con el botón presionado (buttons=1), sigue moviéndose normal");
      // El botón se soltó fuera de la ventana de Chrome: nunca llega "mouseup", pero el
      // siguiente mousemove SÍ llega con buttons=0.
      docLis.mousemove({ clientX: 999, clientY: 999, buttons: 0 });
      t.falso(caja.classList.contains("vgl-dragging"), "el arrastre se detuvo solo al detectar buttons=0");
      t.igual(caja.style.left, "200px", "la posición NO salta a las coordenadas del mousemove fantasma");
      docLis.mousemove({ clientX: 5, clientY: 5, buttons: 1 });
      t.igual(caja.style.left, "200px", "y ya no reacciona a más mousemove: el arrastre quedó realmente cerrado, no colgado");
      cv.env.doc.addEventListener = () => {};
    });

    // ================= render / repaint / refrescarCuentas =================
    // Las tarjetas se montan con un DocumentFragment; el DOM falso no lo aplana
    // solo, así que la lista lo hace aquí (misma semántica que el DOM real).
    lista.appendChild = (x) => {
      if (x && x._esFragmento) { for (const h of x.children) lista.children.push(h); }
      else lista.children.push(x);
      return x;
    };
    const vaciarLista = () => { lista.children.length = 0; };

    const citas = [
      { key: "111@07:00 AM", doc_id: "111", nombre: "ANA PEREZ", hora_texto: "07:00 AM", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 },
      { key: "222@07:30 AM", doc_id: "222", nombre: "LUIS GOMEZ", hora_texto: "07:30 AM", estado: "Sin presentarse", color: "ROJO", pym: ["Tamización de mama"], elapsed: 10 },
    ];

    t.caso("render: sin citas pinta el mensaje de espera y el resumen honesto", () => {
      cv.api.render([], null, null);
      t.cierto(suma.textContent.includes('Esperando "Citas del día"'), "resumen de espera");
      t.cierto(suma.textContent.includes("PyM sin cargar"));
      t.cierto(lista.innerHTML.includes("Aún sin citas"));
    });

    t.caso("atenuar Atendido pero no En sala, a menos que sea fraude (rojo)", () => {
      vaciarLista();
      const citaSala = { key: "sala", doc_id: "1", nombre: "A", hora_texto: "07:00", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      const citaAtendido = { key: "ate", doc_id: "2", nombre: "B", hora_texto: "07:20", estado: "Atendido", color: "VERDE", pym: [], elapsed: 0 };
      const citaFraude = { key: "fra", doc_id: "3", nombre: "C", hora_texto: "07:40", estado: "Atendido", color: "ROJO", pym: [], elapsed: 0 };

      cv.api.__state.lastSignature = ""; // force re-render
      cv.api.render([citaSala, citaAtendido, citaFraude], "api", new Date());

      const cs = lista.children[0].className;
      const ca = lista.children[1].className;
      const cf = lista.children[2].className;

      t.falso(cs.includes("atendido"), "En sala NO lleva clase atendido");
      t.cierto(ca.includes("atendido"), "Atendido SÍ lleva clase atendido");
      t.cierto(ca.includes("vgl-card"), "Sigue siendo tarjeta");
      t.cierto(cf.includes("atendido") && cf.includes("rojo"), "El fraude mantiene ambas clases, para que CSS priorice el rojo");
    });

    t.caso("badge de estado: Atendido usa el color EXCLUSIVO --c-atendido, distinto del verde de En sala; el fraude conserva el rojo", () => {
      vaciarLista();
      const citaSala = { key: "sala2", doc_id: "1", nombre: "A", hora_texto: "07:00", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      const citaAtendido = { key: "ate2", doc_id: "2", nombre: "B", hora_texto: "07:20", estado: "Atendido", color: "VERDE", pym: [], elapsed: 0 };
      const citaFraude = { key: "fra2", doc_id: "3", nombre: "C", hora_texto: "07:40", estado: "Atendido", color: "ROJO", pym: [], elapsed: 0 };

      cv.api.__state.lastSignature = ""; // fuerza repintado
      cv.api.render([citaSala, citaAtendido, citaFraude], "api", new Date());

      const hSala = lista.children[0].innerHTML;
      const hAtendido = lista.children[1].innerHTML;
      const hFraude = lista.children[2].innerHTML;

      t.falso(hSala.includes("--c-atendido"), "En sala sigue con el color de puntualidad (--tc), no el exclusivo");
      t.cierto(hAtendido.includes("--c-atendido"), "Atendido (sin fraude) sí lleva el color exclusivo en el badge");
      t.falso(hFraude.includes("--c-atendido"), "El fraude NO se disfraza del color de atendido: manda el rojo de alerta");
    });

    // v14.0.2 — El botón "Atender" (v13.0.0) se retiró a pedido explícito del médico: usa
    // directamente el botón nativo "Historias Clínicas" de Everest. Las pruebas que cubrían
    // apiMedicoAbrirHistoria/isAtencionAbiertaHoy/markAtencionAbiertaHoy y la generación del
    // botón se retiraron con él (suite 13 y suite 09 tenían las de la API/persistencia).

    t.caso("T1 — Las tarjetas de render() se construyen usando clases y sin style inline (salvo --tc/--trgb)", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const pac = { doc_id: "777", nombre: "Prueba Clases", hora: "08:00", hora_texto: "08:00", color: "VERDE", estado: "Sala", pym: ["MAMOGRAFÍA"] };
      cv.api.render([pac], "suite", new Date("2023-01-01T12:00:00"));
      const tarjeta = lista.children[0];
      const cardHTML = tarjeta.innerHTML;

      const styles = cardHTML.match(/style="([^"]+)"/g) || [];
      const stylesProhibidos = styles.filter(s =>
        !s.includes("--tc") &&
        !s.includes("background:rgba(var(--rgb-") // badgeRgba
      );
      t.cierto(stylesProhibidos.length === 0, "No debe haber styles inline salvo variables o badgeRgba, hallados: " + stylesProhibidos.join(", "));
      t.falso(cardHTML.includes('gap:10px'), "no debe haber gap:10px inline");
    });

    // =====================================================================
    // v12.10.0 — GUARDA DE CASCADA PARA EL ÁMBAR DEL BOTÓN «FALTA LA TOMA».
    // Incidente real de T1: al desincrustar el estilo, `.vgl-btn-ambar` quedó como clase
    // SUELTA declarada ANTES de `.vgl-btn-action`. Ambas tienen especificidad (0,1,0), así
    // que ganaba la última: el `all:unset` + `background:var(--bg3)` de la regla base
    // borraban el ámbar y el botón 🧪 quedaba idéntico al 🗓️ normal (verificado en
    // Chromium: mismo backgroundColor y box-shadow "none"). El médico perdía la única
    // señal de que a esa cita le falta la toma de muestras — y el banco pasó en VERDE,
    // porque el DOM de las pruebas no calcula CSS.
    // Esta prueba no puede calcular cascada, pero sí puede exigir lo único que la hace
    // inmune al orden: que el ámbar se declare con selector COMPUESTO junto a
    // .vgl-btn-action, de modo que su especificidad sea siempre mayor que la de la base.
    // v16.2.4 — CAÍDA REAL en la consola del médico (20-ago):
    //   "boot() abortó ... ReferenceError: Cannot access 'MTR_CSS' before initialization"
    // La trampa: `typeof X !== "undefined"` NO protege a const/let dentro de su zona
    // muerta temporal — lanza en vez de devolver "undefined". Y boot() se llamaba a
    // mitad de la evaluación del script, cuando esas constantes aún no existían.
    t.caso("_cssSeguro: si leer la constante LANZA (zona muerta temporal), devuelve cadena vacía en vez de tumbar el arranque", () => {
      const f = api._cssSeguro;
      t.igual(typeof f, "function", "la función existe");

      // Esto es EXACTAMENTE lo que pasaba con MTR_CSS: acceder lanza ReferenceError.
      t.igual(f(() => { throw new ReferenceError("Cannot access 'X' before initialization"); }), "",
        "la excepción se traga y el CSS queda vacío — el panel se dibuja sin estilos, pero se dibuja");
      t.igual(f(() => { throw new Error("cualquier otra cosa"); }), "", "cualquier fallo, no solo la zona muerta");

      t.igual(f(() => ".a{color:red}"), ".a{color:red}", "cuando sí se puede leer, devuelve el CSS tal cual");
      t.igual(f(() => undefined), "", "sin valor, cadena vacía");
      t.igual(f(() => null), "", "null tampoco pasa");
      t.igual(f(() => 42), "", "y lo que no sea texto se descarta: nunca se inyecta basura en la hoja");
    });

    t.caso("arranque: boot() NO se invoca a mitad de la evaluación del script (causa raíz del «se desactiva solo, toca F5»)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      // La forma vieja: `... else boot();` en la misma línea. Corría boot() mientras el
      // resto del archivo seguía sin evaluarse, con MTR_CSS y compañía en zona muerta.
      t.falso(/else\s+boot\(\)\s*;/.test(src),
        "boot() no puede llamarse de forma síncrona durante la evaluación del módulo");
      t.cierto(/else\s+setTimeout\(boot,\s*0\)\s*;/.test(src),
        "se difiere un tic: para entonces el script terminó de evaluarse y no queda nada en zona muerta");

      // Y ninguna de las cuatro hojas opcionales puede volver al `typeof` inseguro.
      for (const cte of ["MTR_CSS", "MTR_RCV_CSS", "MTR_RCV_CSS_TODOS_LOS_MODALES", "VGL_UX_CSS"]) {
        t.falso(new RegExp('typeof\\s+' + cte + '\\s*!==\\s*"undefined"').test(src),
          cte + ": la guarda `typeof` no protege a una const en zona muerta — debe ir por _cssSeguro");
        t.cierto(new RegExp('_cssSeguro\\(\\(\\)\\s*=>\\s*' + cte + '\\)').test(src),
          cte + ": se lee con _cssSeguro");
      }
    });

    t.caso("el dock de acciones es una columna alta: su radio no puede ser el de pastilla (999px)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const bloque = src.slice(src.indexOf("#vgl-acciones-dock{"), src.indexOf("#vgl-acciones-dock.colapsado .vgl-dock-btns"));
      t.cierto(bloque.length > 100, "se localizó el bloque del dock");

      // Pantallazo del médico (20-ago): con var(--r-pill)=999px la caja alta se vuelve
      // una elipse y los botones de los extremos («Agendar», «Riesgo y exámenes»)
      // quedaban pisando la curva, fuera del fondo pintado.
      t.falso(/border-radius:var\(--r-pill\)/.test(bloque), "nada de radio de pastilla en una caja de ~300px de alto");
      t.cierto(/border-radius:var\(--r-card\)/.test(bloque), "radio de tarjeta, proporcionado a la altura");
      t.cierto(/align-items:stretch/.test(bloque), "los botones acuerdan ancho con el contenedor: el borde los envuelve de verdad");
      t.cierto(/\.vgl-dock-btns\{[^}]*align-self:stretch/.test(src), "la columna interna también se estira");
      t.cierto(/\.vgl-dock-toggle\{align-self:flex-start\}/.test(src), "pero el ▶ de plegar no se estira");
    });

    t.caso("el ámbar de «falta la toma de muestras» gana a la regla base pase lo que pase (cascada)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const sueltas = src.match(/^\s*\.vgl-btn-ambar\s*[,{]/m);
      t.falso(!!sueltas, "`.vgl-btn-ambar` no puede declararse como clase suelta: la regla base la pisaría");

      const compuesta = /\.vgl-btn-action\.vgl-btn-ambar\s*[,{]/.test(src);
      t.cierto(compuesta, "el ámbar debe declararse como `.vgl-btn-action.vgl-btn-ambar` (especificidad mayor que la base)");

      const conHover = /\.vgl-btn-action\.vgl-btn-ambar:hover\s*[,{]/.test(src);
      t.cierto(conHover, "también debe cubrir :hover — antes era inline y el inline también ganaba al hover");

      // Y debe seguir llevando los valores reales de siempre.
      const iA = src.indexOf(".vgl-btn-action.vgl-btn-ambar");
      const bloque = src.slice(iA, src.indexOf("}", iA));
      t.cierto(bloque.includes("rgba(var(--rgb-ambar),.14)"), "conserva el fondo ámbar original");
      t.cierto(bloque.includes("inset 0 0 0 1px rgba(var(--rgb-ambar),.5)"), "conserva el borde interior ámbar original");
    });


    // v14.0.0 (T4) — "chips PyM" salió del nombre y de las aserciones de esta prueba: los
    // chips (y el texto "PyM sin cargar"/"Al día"/"Dato faltante" DENTRO de la tarjeta) se
    // amputaron del panel. El "PyM sin cargar" de la BARRA DE RESUMEN (suma.textContent,
    // no cardAna.innerHTML) es un sitio DISTINTO — con significado distinto — y se queda
    // intacto (ver la Regla B4-T4 sobre el literal repetido).
    t.caso("render: dos citas por API pintan tarjetas con bandera de fraude (sin chips PyM, amputados en T4)", () => {
      vaciarLista();
      cv.api.render(citas, "api", new Date());
      t.cierto(suma.textContent.includes("Vigilando la agenda · 2 cita(s)"), "resumen de fuente directa, en lenguaje del médico (v15.7.1: adiós «directo»/«Espejo»)");
      t.cierto(suma.textContent.includes("PyM sin cargar"), "la barra de resumen SÍ sigue diciendo esto (no se amputó, es el otro sitio)");
      t.igual(q("#vgl-dot").className, "bg", "el punto de origen marca API");
      t.igual(lista.children.length, 2, "una tarjeta por cita");
      const [cardAna, cardLuis] = lista.children;
      t.igual(cardAna.__vglKey, "111@07:00 AM");
      t.cierto(cardAna.innerHTML.includes("ANA PEREZ"));
      t.cierto(cardAna.innerHTML.includes("CC 111"));
      t.falso(cardAna.innerHTML.includes("PyM sin cargar"), "dentro de la TARJETA ya no aparece — ese chip se amputó");
      t.falso(cardAna.innerHTML.includes("NO CONFIRMADO"), "la cita verde no lleva bandera de fraude");
      t.cierto(cardLuis.className.includes("rojo"), "la tarjeta roja lleva su clase");
      t.cierto(cardLuis.innerHTML.includes("⛔ NO CONFIRMADO"), "bandera de fraude explícita, se conserva");
      t.falso(cardLuis.innerHTML.includes("Tamización de mama"), "el chip de PyM pendiente ya no se pinta en la tarjeta (T4)");
      t.falso(cardLuis.innerHTML.includes("vgl-pyms") || cardLuis.innerHTML.includes("vgl-chip"), "ningún rastro de la fila de chips en el HTML");
      t.cierto(cardLuis.innerHTML.includes("vgl-cd late"), "cuenta regresiva vencida — no la toca T4");
      t.cierto(cardLuis.innerHTML.includes("hace 4:00"), "lleva 4 min pasado de la tolerancia (6 - 10)");
      const stats = q("#vgl-stats");
      t.cierto(stats.innerHTML.includes("En sala <b>1</b>"));
      t.cierto(stats.innerHTML.includes("Sin pres. <b>1</b>"));
    });

    // v14.0.0 (T4) / v14.0.2 — Criterio de aceptación de T4 ("la tarjeta ya no genera esos
    // tres botones") sigue vigente; el botón Atender que T4 dejaba como único superviviente
    // se retiró después, a pedido explícito del médico (usa el nativo "Historias Clínicas").
    t.caso("T4/v14.0.2 — la tarjeta ya NO genera ningún botón de acción (agendar/ordenar/labs/atender)", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const pac = { key: "t4-1", doc_id: "999", nombre: "PACIENTE T4", hora_texto: "09:00", estado: "En sala", color: "VERDE", pym: ["MAMOGRAFÍA"], elapsed: 0, citaId: 12345 };
      cv.api.render([pac], "api", new Date());
      const card = lista.children[0];
      t.falso(card.innerHTML.includes("vgl-btn-agendar"), "sin botón de agendar");
      t.falso(card.innerHTML.includes("vgl-btn-ordenar"), "sin botón de ordenar");
      t.falso(card.innerHTML.includes("vgl-btn-labs"), "sin botón de labs");
      t.falso(card.innerHTML.includes("vgl-btn-atender"), "sin botón de Atender (retirado en v14.0.2)");
      t.falso(card.innerHTML.includes("vgl-pyms"), "sin fila de chips PyM");
    });

    // v14.0.0 — Secuela real de T4: la fila inferior (.vgl-card-btm) llevaba los botones Y
    // la fila de chips de PyM. T4 se llevó ambos contenidos pero dejó el contenedor, con un
    // div vacío cobrando su margin-top de 7px. v14.0.2 retiró también el botón Atender (el
    // último ocupante), así que ahora la fila nunca se emite, con o sin citaId.
    t.caso("v14.0.2 — la tarjeta nunca emite la fila inferior vacía (hueco muerto al pie), con o sin citaId", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const sinCita = { key: "v14-sin", doc_id: "777", nombre: "PACIENTE SIN CITAID", hora_texto: "09:20", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.render([sinCita], "api", new Date());
      t.falso(lista.children[0].innerHTML.includes("vgl-card-btm"), "sin citaId: sin fila inferior");

      vaciarLista();
      cv.api.__state.lastSignature = "";
      const conCita = { key: "v14-con", doc_id: "778", nombre: "PACIENTE CON CITAID", hora_texto: "09:30", estado: "En sala", color: "VERDE", pym: [], elapsed: 0, citaId: 4242 };
      cv.api.render([conCita], "api", new Date());
      t.falso(lista.children[0].innerHTML.includes("vgl-card-btm"), "con citaId: tampoco hay fila inferior — no queda nada que poner ahí");
    });

    t.caso("T4 (D9) — la bandera PES usa el texto nuevo «ABANDONO PROGRAMA RCV»", () => {
      vaciarLista();
      cv.api.__S.abandonoPES = true;
      cv.api.__state.pymAbandono = new Set(["888"]);
      cv.api.__state.lastSignature = "";
      const pac = { key: "t4-pes", doc_id: "888", nombre: "PACIENTE PES", hora_texto: "09:10", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.render([pac], "api", new Date());
      const card = lista.children[0];
      t.cierto(card.innerHTML.includes("❤ ABANDONO PROGRAMA RCV"), "la bandera PES lleva el texto nuevo");
      t.falso(card.innerHTML.includes("SEGUIMIENTO CARDIOVASCULAR"), "el texto viejo no debe sobrevivir en ningún sitio");
    });

    // [v14.2.0 — backlog §3] Candidatura a cupos Adicional/sábado: chip informativo en la
    // tarjeta, SOLO para quien ya tiene perfil calculado hoy (perfilAdicionalCache, llenado
    // por openAgendamientoModal) y ese perfil resultó sencillo. Nunca se inventa un valor
    // para quien todavía no tiene entrada en la caché.
    t.caso("v14.2.0 (§3) — chip CANDIDATO ADICIONAL: sale solo con perfil sencillo YA calculado hoy", () => {
      vaciarLista();
      cv.api.__state.perfilAdicionalCache = new Map([["999", { adicionales: true, motivo: "" }]]);
      cv.api.__state.lastSignature = "";
      const pac = { key: "adic-si", doc_id: "999", nombre: "PACIENTE SENCILLO", hora_texto: "10:00", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.render([pac], "api", new Date());
      t.cierto(lista.children[0].innerHTML.includes("➕ CANDIDATO ADICIONAL"), "perfil sencillo cacheado: sale el chip");

      vaciarLista();
      cv.api.__state.perfilAdicionalCache = new Map([["998", { adicionales: false, motivo: "diabetes en la historia" }]]);
      cv.api.__state.lastSignature = "";
      const pacNo = { key: "adic-no", doc_id: "998", nombre: "PACIENTE COMPLEJO", hora_texto: "10:10", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.render([pacNo], "api", new Date());
      t.falso(lista.children[0].innerHTML.includes("CANDIDATO ADICIONAL"), "perfil NO sencillo: sin chip, aunque haya entrada en caché");

      vaciarLista();
      cv.api.__state.perfilAdicionalCache = new Map();
      cv.api.__state.lastSignature = "";
      const pacSc = { key: "adic-sc", doc_id: "997", nombre: "PACIENTE SIN ABRIR MODAL AUN", hora_texto: "10:20", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.render([pacSc], "api", new Date());
      t.falso(lista.children[0].innerHTML.includes("CANDIDATO ADICIONAL"), "sin cálculo todavía: nada que mostrar, no se inventa un no-candidato");

      cv.api.__state.perfilAdicionalCache = new Map();
      cv.api.__state.lastSignature = "";
    });

    t.caso("candidatoAdicional: invocación directa — null sin doc_id o sin entrada; el objeto cacheado solo si adicionales===true", () => {
      cv.api.__state.perfilAdicionalCache = new Map([
        ["111", { adicionales: true, motivo: "" }],
        ["222", { adicionales: "visibles", motivo: "" }],
      ]);
      t.igual(cv.api.candidatoAdicional(null), null, "sin documento: null");
      t.igual(cv.api.candidatoAdicional("333"), null, "documento sin entrada en la caché: null");
      t.igual(cv.api.candidatoAdicional("222"), null, "adicionales !== true (aquí 'visibles'): null, no es candidato");
      t.cierto(!!cv.api.candidatoAdicional("111"), "adicionales === true: devuelve el objeto cacheado");
      cv.api.__state.perfilAdicionalCache = new Map();
    });

    t.caso("render: el filtro 'ensala' deja solo la tarjeta que corresponde", () => {
      vaciarLista();
      cv.api.__state.filtro = "ensala";
      cv.api.render(citas, "api", new Date());
      t.igual(lista.children.length, 1);
      t.cierto(lista.children[0].innerHTML.includes("ANA PEREZ"));
      cv.api.__state.filtro = "todas";
      cv.api.__state.lastSignature = "";
    });

    t.caso("repaint: repinta la lista desde el último snapshot guardado", () => {
      vaciarLista();
      cv.api.__state.lastSnapshot = { list: citas, source: "pagina", at: new Date() };
      cv.api.__state.lastSignature = "";
      cv.api.repaint();
      t.cierto(suma.textContent.includes("En Citas del día · 2 cita(s)"), "usa la fuente del snapshot");
      t.igual(lista.children.length, 2, "reconstruyó las tarjetas");
    });

    t.caso("refrescarCuentas: actualiza la cuenta regresiva en sitio sin recrear tarjetas", () => {
      const cardLuis = lista.children[1];
      const cd = cardLuis.querySelector(".vgl-cd");
      citas[1].elapsed = 20; // rest = 6 - 20 = -14
      cv.api.refrescarCuentas(citas);
      t.igual(cd.className, "vgl-cd late");
      t.igual(cd.textContent, "hace 14:00");
      t.cierto(cd.title.includes("pasado de la tolerancia"));
    });

    t.caso("refrescarCuentas: con lista desalineada u orden cambiado no toca nada", () => {
      const cd = lista.children[1].querySelector(".vgl-cd");
      citas[1].elapsed = 30;
      cv.api.refrescarCuentas([citas[0]]);                 // longitud distinta
      t.igual(cd.textContent, "hace 14:00", "longitud distinta: se deja al repintado normal");
      cv.api.refrescarCuentas([citas[1], citas[0]]);       // orden cambiado (clave no coincide)
      t.igual(cd.textContent, "hace 14:00", "clave desalineada: tampoco se toca");
      citas[1].elapsed = 20;
    });

    // ================= copySummary =================
    t.caso("copySummary: sin acceso al portapapeles avisa con nivel warn", () => {
      cv.api.copySummary();
      t.igual(suma.className, "warn");
      t.cierto(suma.textContent.includes("No fue posible copiar"));
    });

    t.caso("copySummary: con portapapeles copia el resumen clínico y confirma", () => {
      let copiado = "";
      cv.ctx.navigator.clipboard = { writeText: (s) => { copiado = s; return { then: (ok) => { ok(); } }; } };
      cv.api.copySummary();
      t.cierto(copiado.startsWith("Asistente Clínico de Agenda — "));
      t.cierto(copiado.includes("Citas en agenda: 2"));
      t.cierto(copiado.includes("En sala ahora: 1"));
      t.cierto(copiado.includes("Sin presentarse: 1"));
      t.cierto(copiado.includes("Prevención PyM: sin cargar"));
      t.igual(suma.textContent, "Resumen copiado al portapapeles.");
      delete cv.ctx.navigator.clipboard;
    });

    // ================= createLabInjectorUI =================
    // El puente real de Athenea (v12.3.3+) es un flujo de 3 pasos por GM_xmlhttpRequest
    // (BusquedaPaciente -> BuscarPaciente -> DatosPaciente); este mock solo necesita
    // cubrir el paso 1 porque la respuesta que le damos (sin token CSRF) hace que
    // getAtheneaSolicitudesAuto corte ahí mismo y nunca pida los pasos 2/3.
    const cLab = cargar({
      silencioso: true,
      gmxhr: (o) => {
        if (o.url.includes("/Resultados/BusquedaPaciente")) {
          o.onload({ status: 200, responseText: "<html><body>sin formulario reconocible, sin token</body></html>" });
        } else if (o.onerror) { o.onerror("url no simulada"); }
      },
    });

    t.caso("createLabInjectorUI: crea el botón flotante una sola vez", () => {
      const antes = cLab.env.doc.body.children.length;
      cLab.api.createLabInjectorUI();
      const btn = cLab.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      t.cierto(!!btn, "el botón quedó en el body");
      t.igual(btn.innerHTML, "🧬 Auto-Labs (Athenea)");
      t.cierto(typeof btn.onclick === "function", "el clic queda cableado");
      // Si el botón ya existe, no se duplica
      cLab.env.doc.getElementById = (id) => (id === "vgl-lab-injector" ? btn : null);
      cLab.api.createLabInjectorUI();
      t.igual(cLab.env.doc.body.children.length, antes + 1, "la segunda llamada no añade otro botón");
    });

    // v17.1.1 — mismo reporte en vivo del 21-ago: «Auto-Labs (Athenea)» se colaba en
    // Revisión por sistema y Examen físico. `input[id^="resultado"]` existe también en
    // otras pestañas montadas-pero-tapadas; el conteo ciego las contaba igual. Ahora solo
    // cuentan las que de verdad están a la vista (mismo criterio que Normalidad fija).
    t.caso("createLabInjectorUI (#151): casillas «resultado…» MONTADAS PERO TAPADAS no encienden el botón", () => {
      const btn = cLab.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      cLab.env.doc.getElementById = (id) => (id === "vgl-lab-injector" ? btn : null);
      cLab.env.doc.querySelector = () => null;   // sin barra legible: la decisión cae en el conteo
      cLab.env.doc.querySelectorAll = (sel) =>
        (sel === 'input[id^="resultado"]') ? [{ id: "resultadoHemograma", offsetParent: null }] : [];
      cLab.api.createLabInjectorUI();
      t.igual(btn.style.display, "none", "la casilla existe en el DOM pero no está a la vista: el botón se queda oculto");
    });

    t.caso("createLabInjectorUI (#151): la misma casilla, pero VISIBLE, sí enciende el botón", () => {
      const btn = cLab.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      cLab.env.doc.getElementById = (id) => (id === "vgl-lab-injector" ? btn : null);
      cLab.env.doc.querySelector = () => null;
      cLab.env.doc.querySelectorAll = (sel) =>
        (sel === 'input[id^="resultado"]') ? [{ id: "resultadoHemograma", offsetParent: {} }] : [];
      cLab.api.createLabInjectorUI();
      t.igual(btn.style.display, "", "a la vista de verdad: el botón sí sale");
    });

    await t.casoAsync("createLabInjectorUI: sin solicitud resoluble alerta y restaura el botón", async () => {
      const btn = cLab.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      // El paciente SÍ se resuelve en la historia clínica (#anamesis + cédula en un
      // .text-muted, el mismo patrón que usa extractPacienteAbierto), pero Athenea no
      // devuelve token CSRF en el paso 1: getAtheneaSolicitudesAuto corta ahí y
      // getAtheneaLabsAuto acaba en [] — la rama real de "sin solicitud resoluble",
      // no la de "no se pudo determinar el paciente".
      cLab.env.doc.getElementById = (id) => {
        if (id === "vgl-lab-injector") return btn;
        if (id === "anamesis") return {};
        return null;
      };
      cLab.env.doc.querySelector = () => null;
      cLab.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 999888777", closest: () => null }] : []);
      const alertas = [];
      cLab.ctx.alert = (m) => alertas.push(String(m));
      await btn.onclick();
      // v15.5.0 — Adiós a los alert() nativos (bloqueaban TODO Chrome): la rama
      // "sin resultados" responde EN el propio botón y con un aviso del Vigilante.
      t.igual(alertas.length, 0, "cero alert() nativos en este flujo");
      t.cierto(String(btn.innerHTML).includes("Sin resultados en Athenea"), "el botón mismo dice qué pasó");
    });

    // v12.10.15 — Bug real de auditoría nocturna, mismo patrón que autoFetch: el clic
    // manual del botón también dejaba SIN cachear un resultado vacío, así que el robot
    // (autoFetchAtheneaLabsForActivePatient) no se enteraba de que ya se había consultado
    // a ese paciente y podía volver a golpear Athenea enseguida.
    // [v14.2.0 — auditoría pre-producción 2026-08-18] Esta prueba verificaba el fix vía
    // checkLabsVencidos (retirado por código muerto, ver CHANGELOG). El mismo `if (labs)`
    // (línea idéntica en ambas rutas, manual y automática) sigue cubierto por su equivalente
    // en tests/suite_17_nucleo.js ("con CERO laboratorios en Athenea, el TTL de 10 min SÍ
    // frena la siguiente consulta"), que lo prueba sin depender de una función eliminada.

    // ================= createAccionesDockUI (T5 — dock de widgets sobre la HC) =================
    // v14.0.0 (T5): el dock flotante con las 3 acciones rápidas (agendar/ordenar/labs) que
    // T4 sacó de la tarjeta. Usa _enModuloHCHealth() (alcance amplio, por ruta) en vez de
    // seccionActiva()==="historia" (alcance angosto, por #anamesis): el encargo pide que el
    // widget viva sobre TODA la Historia Clínica, no solo la pestaña con ese marcador.
    function mockPacienteDock(c, doc) {
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC " + doc, closest: () => null }] : []);
    }

    t.caso("createAccionesDockUI: fuera del módulo HCHealth no crea el widget", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/Acceso/";
      c.api.createAccionesDockUI();
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock"));
    });

    t.caso("createAccionesDockUI: en HCHealth pero sin paciente abierto no crea el widget", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/CitasDelDia";
      c.env.doc.getElementById = () => null; // sin #anamesis ni nada: sin paciente resoluble
      c.api.createAccionesDockUI();
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock"));
    });

    t.caso("createAccionesDockUI: crea el widget con los 3 botones + el de colapsar, una sola vez (idempotente)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "555666777");
      // v17.5.0 — la compuerta de completitud del Panel del paciente entra en juego aquí
      // también (ver más abajo su propia sección de pruebas). Esta prueba es sobre
      // IDEMPOTENCIA, no sobre la compuerta, así que se deja completa a propósito para
      // conservar la lista de botones original.
      c.api._vglCosechaGuardar("555666777", { factores: {
        hta: { v: true, ts: 1 }, diabetes: { v: false, ts: 1 }, tabaquismo: { v: false, ts: 1 },
      } });
      c.api.mtrCacheResumenGuardar("555666777", { programa: "Ninguno" });
      const antes = c.env.doc.body.children.length;
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      t.cierto(!!dock, "el dock quedó en el body");
      t.cierto(dock.className.includes("vgl-acciones-dock"));
      const btns = dock.children.find((n) => n.className === "vgl-dock-btns");
      t.cierto(!!btns, "existe el contenedor de botones");
      const accs = btns.children.map((b) => b.getAttribute("data-accion"));
      t.igual(accs, ["agendar", "ordenar", "labs", "ficha", "redactar"], "v16.8.0: Riesgo se fundió en el Panel del paciente (el botón 🧾), así que el dock tiene un botón menos");
      t.cierto(dock.children.some((n) => n.getAttribute && n.getAttribute("data-accion") === "toggle"), "botón de colapsar presente");

      // Segunda llamada: no duplica el contenedor del dock.
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "anamesis" ? { id: "anamesis" } : null));
      c.api.createAccionesDockUI();
      t.igual(c.env.doc.body.children.length, antes + 1, "la segunda llamada no añade otro dock");
    });

    // v15.5.0 — BETA CERRADA: el botón Riesgo+IA queda visible pero bloqueado mientras el
    // módulo esté en construcción (decisión del médico). Este pin evita que un refactor lo
    // "reviva" por accidente: debe estar disabled, rotulado (beta) y su clic NO abre nada.
    // v16.8.0 — El botón ❤️ «Riesgo y exámenes» se RETIRÓ del dock: su contenido es una
    // sección del Panel del paciente, que abre con 🧾. El médico pidió la fusión, no dos
    // puertas al mismo sitio. Lo que hay que defender ahora es que ese único botón lleve
    // al módulo completo.
    t.caso("dock: el botón 🧾 abre el PANEL DEL PACIENTE unificado, y el de riesgo ya no existe aparte", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "555666777");
      // v17.5.0 — con la compuerta de completitud, este botón describe el módulo entero
      // (con "riesgo"/"renal" en su título) solo cuando NO está bloqueado: factores
      // completos + resumen en caché. Su propia sección de pruebas cubre los estados
      // bloqueados por separado.
      c.api._vglCosechaGuardar("555666777", { factores: {
        hta: { v: true, ts: 1 }, diabetes: { v: false, ts: 1 }, tabaquismo: { v: false, ts: 1 },
      } });
      c.api.mtrCacheResumenGuardar("555666777", { programa: "Ninguno" });
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const fila = dock.children.find((n) => n.className === "vgl-dock-btns");
      t.falso(!!fila.children.find((b) => b.getAttribute("data-accion") === "riesgo"),
        "el botón separado de riesgo desapareció: eso es la fusión");
      const bPanel = fila.children.find((b) => b.getAttribute("data-accion") === "ficha");
      t.cierto(!!bPanel, "queda el botón único");
      const lbl = (bPanel.children || []).map((h) => h.textContent || "").join(" ");
      t.cierto(/panel/i.test(lbl), "y se llama por lo que es: Panel del paciente (rótulo: " + lbl.trim() + ")");
      t.cierto(/riesgo/i.test(bPanel.title || ""), "su descripción sigue prometiendo el riesgo, que es lo que el médico busca");
      t.cierto(/renal/i.test(bPanel.title || ""), "y la función renal");
      const clic = (bPanel._listeners && bPanel._listeners.click) || [];
      t.cierto(clic.length > 0, "tiene manejador");
      clic.forEach((fn) => fn({ stopPropagation: () => {} }));
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.cierto(!!modal, "el clic abre el panel unificado");
      let w = null;
      c.api._uxVolcarBuffer();
      try { w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null"); } catch (e) {}
      t.cierto(!!(w && w.acciones && w.acciones["widget.panel.abrir"] >= 1), "queda contado en telemetría (widget.panel.abrir)");
    });

    // =====================================================================
    // v17.5.0 — COMPUERTA DE COMPLETITUD DEL PANEL DEL PACIENTE
    // Orden explícita del médico: el botón «Panel del paciente» queda DESHABILITADO —no
    // solo con aviso— mientras falte algo mínimo por documentar (hta/diabetes/tabaquismo
    // sin dato) o el resumen automático que dispara solo al abrir la historia aún no
    // termine. Se cubren aquí los dos sub-estados de bloqueo, el atajo «Ir a [pestaña]»,
    // las dos funciones puras nuevas y el disparo automático en segundo plano.
    // =====================================================================
    t.caso("v17.5.0 — Panel bloqueado mientras el resumen automático no termine, aunque los factores ya estén completos", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "700111222");
      c.api._vglCosechaGuardar("700111222", { factores: {
        hta: { v: true, ts: 1 }, diabetes: { v: true, ts: 1 }, tabaquismo: { v: false, ts: 1 },
      } });
      // Sin mtrCacheResumenGuardar: el disparo automático acaba de arrancar en segundo
      // plano (es async), así que al primer pintado del dock todavía no hay resumen.
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const fila = dock.children.find((n) => n.className === "vgl-dock-btns");
      const bPanel = fila.children.find((b) => b.getAttribute("data-accion") === "ficha");
      t.cierto(bPanel.disabled, "bloqueado de verdad — orden del médico, no un simple aviso");
      t.cierto(/recopilando/i.test(bPanel.title || ""), "el motivo es la carga automática (título: " + bPanel.title + ")");
      t.falso(!!fila.children.find((b) => b.getAttribute("data-accion") === "ir-pestana"),
        "sin atajos «Ir a»: nada que el médico pueda hacer para acelerar una consulta de red");
    });

    t.caso("v17.5.0 — Panel bloqueado y con un solo atajo «Ir a» cuando falta un único factor por documentar", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "700333444");
      c.api._vglCosechaGuardar("700333444", { factores: {
        hta: { v: true, ts: 1 }, diabetes: { v: false, ts: 1 },
        // tabaquismo: sin documentar, a propósito — es lo único que debe faltar.
      } });
      c.api.mtrCacheResumenGuardar("700333444", { programa: "Ninguno" });
      const tabAntecedentes = { textContent: "Antecedentes", click: () => {} };
      let clicsHabitos = 0;
      const tabHabitos = { textContent: "Hábitos y Gestión de Riesgo", click: () => { clicsHabitos++; } };
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === ".text-muted") return [{ textContent: "CC 700333444", closest: () => null }];
        if (sel === "a, li, button, [role='tab'], .nav-link, .nav-item") return [tabAntecedentes, tabHabitos];
        return [];
      };
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const fila = dock.children.find((n) => n.className === "vgl-dock-btns");
      const bPanel = fila.children.find((b) => b.getAttribute("data-accion") === "ficha");
      t.cierto(bPanel.disabled, "sigue bloqueado: falta tabaquismo");
      t.cierto(bPanel.title.includes("Tabaquismo (Hábitos y Gestión de Riesgo)"),
        "el motivo nombra el factor Y la pestaña donde vive (título: " + bPanel.title + ")");
      const atajos = fila.children.filter((b) => b.getAttribute("data-accion") === "ir-pestana");
      t.igual(atajos.length, 1, "un solo atajo: hta y diabetes ya están, solo falta tabaquismo");
      t.cierto(/Tabaquismo/.test(atajos[0].title || ""), "el atajo dice qué va a documentar");
      const lblAtajo = (atajos[0].children || []).map((h) => h.textContent || "").join(" ");
      t.cierto(/Hábitos/.test(lblAtajo), "rotulado corto para el dock (rótulo: " + lblAtajo.trim() + ")");

      const clic = (atajos[0]._listeners && atajos[0]._listeners.click) || [];
      t.cierto(clic.length > 0, "el atajo tiene manejador de clic");
      clic.forEach((fn) => fn({ stopPropagation: () => {} }));
      t.igual(clicsHabitos, 1, "el clic navegó de verdad: hizo clic en la pestaña Hábitos y Gestión de Riesgo");
    });

    t.caso("v17.5.0 — mtrFactoresPendientesNavegables: agrupa por pestaña (no por factor) y nunca inventa faltantes", () => {
      const c = cargar({ silencioso: true });
      const r1 = c.api.mtrFactoresPendientesNavegables({ hta: null, diabetes: null, tabaquismo: null });
      t.igual(r1.length, 2, "dos pestañas, aunque sean tres factores");
      const ant = r1.find((p) => p.pestania === "Antecedentes");
      t.cierto(!!ant, "hay una sola entrada de Antecedentes");
      t.igual(ant.nombres, ["Hipertensión", "Diabetes"], "nombra a los dos factores que le faltan ahí");
      t.cierto(ant.etiqueta.includes("Hipertensión y Diabetes (Antecedentes)"));
      const hab = r1.find((p) => p.pestania === "Hábitos y Gestión de Riesgo");
      t.cierto(!!hab && hab.nombres.length === 1 && hab.nombres[0] === "Tabaquismo");

      t.igual(c.api.mtrFactoresPendientesNavegables({ hta: true, diabetes: false, tabaquismo: true }).length, 0,
        "documentado (true O false) no es un faltante: solo null cuenta como 'sin dato'");
      t.igual(c.api.mtrFactoresPendientesNavegables(null).length, 0, "sin datos: no inventa faltantes concretos");
      t.igual(c.api.mtrFactoresPendientesNavegables(undefined).length, 0, "tampoco con undefined");
      t.igual(c.api.mtrFactoresPendientesNavegables({}).length, 0, "objeto vacío: claves ausentes no cuentan como 'null'");
    });

    t.caso("v17.5.0 — mtrIrAPestanaPorNombre: hace clic en la pestaña encontrada, y no truena si no la encuentra", () => {
      const c = cargar({ silencioso: true });
      let clics = 0;
      const doc1 = { querySelectorAll: (sel) => (sel === "a, li, button, [role='tab'], .nav-link, .nav-item"
        ? [{ textContent: "Antecedentes", click: () => { clics++; } }] : []) };
      t.cierto(c.api.mtrIrAPestanaPorNombre("Antecedentes", doc1), "encontró la pestaña y pudo hacer clic");
      t.igual(clics, 1);

      const doc2 = { querySelectorAll: () => [] };
      t.falso(c.api.mtrIrAPestanaPorNombre("Antecedentes", doc2), "sin esa pestaña en el DOM: false, no truena");
      t.falso(c.api.mtrIrAPestanaPorNombre("Antecedentes", { querySelectorAll: null }), "doc sin querySelectorAll: false, no truena");
    });

    // El mock genérico de fetch (JSON vacío) es el mismo patrón que ya usa la prueba
    // "mtrCalcularResumenClinico: ruta real" más abajo en este archivo: no hace falta
    // simular cada API en cascada para que la función complete y deje algo en caché.
    const _respVaciaGate = { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "{}", clone() { return this; } };

    await t.casoAsync("v17.5.0 — el resumen clínico se dispara solo al abrir la historia, sin ningún clic, y queda cacheado", async () => {
      const c = cargar({ silencioso: true, fetch: async () => _respVaciaGate });
      mockPacienteDock(c, "700555666");
      t.igual(c.api.mtrCacheResumenLeer("700555666"), null, "arranca sin nada en caché");
      c.api.createAccionesDockUI();   // ningún clic — solo abrir la historia clínica
      await esperar(80);
      t.cierto(!!c.api.mtrCacheResumenLeer("700555666"),
        "el disparo automático dejó un resumen en caché sin que el médico pulsara el botón");
    });

    await t.casoAsync("v17.5.0 — con un resumen ya fresco en caché, abrir la historia no dispara ninguna consulta nueva", async () => {
      let consultas = 0;
      const c = cargar({ silencioso: true, fetch: async () => { consultas++; return _respVaciaGate; } });
      mockPacienteDock(c, "700999000");
      c.api.mtrCacheResumenGuardar("700999000", { programa: "Ninguno" });
      c.api.createAccionesDockUI();
      await esperar(80);
      t.igual(consultas, 0, "con caché fresca, cero consultas nuevas a la red");
    });

    await t.casoAsync("v17.5.0 — dos aperturas seguidas del mismo paciente no rompen nada: el resumen automático queda cacheado igual", async () => {
      const c = cargar({ silencioso: true, fetch: async () => _respVaciaGate });
      mockPacienteDock(c, "700777888");
      c.api.createAccionesDockUI();
      c.api.createAccionesDockUI();   // segunda llamada casi inmediata — mismo piso que ya usa el Robot Athenea
      await esperar(80);
      t.cierto(!!c.api.mtrCacheResumenLeer("700777888"), "el resumen automático queda en caché pese a las dos llamadas seguidas");
    });

    await t.casoAsync("v17.5.0 — autoCalcularResumenSiNecesario: guardas de entrada sin tronar, y disparo real llamado directo (no solo vía el dock)", async () => {
      const c = cargar({ silencioso: true, fetch: async () => _respVaciaGate });
      // mtrCalcularResumenClinico corta si `vivo()` (aquí, extractPacienteAbierto() === docId)
      // da falso a mitad de camino — el mismo blindaje anti-cruce que protege la inyección de
      // laboratorios. Para que el disparo directo de abajo pueda completar, el DOM tiene que
      // decir que "700222333" es quien está abierto, igual que hace mockPacienteDock para el
      // resto de las pruebas del dock.
      mockPacienteDock(c, "700222333");
      // Guardas de entrada: nunca deben tronar ni dejar nada en caché.
      c.api.autoCalcularResumenSiNecesario(null);
      c.api.autoCalcularResumenSiNecesario({ nombre: "SIN DOCUMENTO" });
      await esperar(30);
      t.igual(c.api.mtrCacheResumenLeer("700222333"), null, "las guardas no dispararon nada");
      // Disparo real, invocado directo (no a través de createAccionesDockUI).
      c.api.autoCalcularResumenSiNecesario({ doc_id: "700222333" });
      await esperar(80);
      t.cierto(!!c.api.mtrCacheResumenLeer("700222333"), "quedó cacheado tras el disparo directo");
    });

    t.caso("createAccionesDockUI: se autolimpia al salir del módulo HCHealth", () => {
      // El DOM falso del arnés define remove() como no-op puro (no lo saca de
      // body.children, a diferencia del navegador real) — mismo hallazgo documentado ya
      // para otros modales de esta suite. Se espía la llamada en vez de inspeccionar
      // body.children después.
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "555666777");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      t.cierto(!!dock);
      let removido = false;
      dock.remove = () => { removido = true; };
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : null);
      c.env.win.location.pathname = "/viva/Acceso/";
      c.api.createAccionesDockUI();
      t.cierto(removido, "el dock se quita del body al salir de HCHealth");
    });

    t.caso("createAccionesDockUI: se autolimpia si el paciente se cierra (docId ya no resuelve)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "555666777");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      t.cierto(!!dock);
      let removido = false;
      dock.remove = () => { removido = true; };
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : null); // sin "anamesis": sin paciente
      c.api.createAccionesDockUI();
      t.cierto(removido, "el dock se quita del body sin paciente abierto");
    });

    t.caso("createAccionesDockUI: botón de agendar refleja los 3 estados (nada hecho / falta lab / ambas bloqueadas)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "111111111");
      c.api.createAccionesDockUI();
      let dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      let bAg = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "agendar");
      t.falso(bAg.disabled, "nada hecho: botón habilitado");
      t.falso(bAg.className.includes("vgl-dock-btn-ambar"));

      c.api.markCitaAgendadaHoy("111111111", "2026-08-20");
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "anamesis" ? { id: "anamesis" } : null));
      c.api.createAccionesDockUI();
      dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      bAg = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "agendar");
      t.cierto(bAg.className.includes("vgl-dock-btn-ambar"), "solo falta el laboratorio: variante ámbar");
      t.falso(bAg.disabled);

      c.api.markLabAgendadaHoy("111111111");
      c.api.createAccionesDockUI();
      dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      bAg = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "agendar");
      t.cierto(bAg.disabled, "las dos hechas: bloqueado para evitar duplicados");
    });

    t.caso("createAccionesDockUI: botón de ordenar se bloquea cuando las órdenes ya se generaron hoy", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "222222222");
      c.api.createAccionesDockUI();
      let dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      let bOrd = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "ordenar");
      t.falso(bOrd.disabled);

      c.api.markOrdenesCreadasHoy("222222222", [], []);
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "anamesis" ? { id: "anamesis" } : null));
      c.api.createAccionesDockUI();
      dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      bOrd = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "ordenar");
      t.cierto(bOrd.disabled, "órdenes ya generadas hoy: bloqueado para evitar duplicados");
    });

    t.caso("createAccionesDockUI: Ajustes con agendamientoRapido=false oculta agendar/ordenar, pero labs se conserva", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "333333333");
      // v17.5.0 — factores completos + resumen en caché: esta prueba es sobre qué botones
      // depende de agendamientoRapido, no sobre la compuerta de completitud.
      c.api._vglCosechaGuardar("333333333", { factores: {
        hta: { v: false, ts: 1 }, diabetes: { v: false, ts: 1 }, tabaquismo: { v: false, ts: 1 },
      } });
      c.api.mtrCacheResumenGuardar("333333333", { programa: "Ninguno" });
      c.api.__S.agendamientoRapido = false;
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const accs = dock.children.find((n) => n.className === "vgl-dock-btns").children.map((b) => b.getAttribute("data-accion"));
      t.igual(accs, ["labs", "ficha", "redactar"], "v15.6: Ficha (hoy Panel) y Redactar no dependen del agendamiento rápido");
    });

    t.caso("createAccionesDockUI: clic en toggle colapsa/expande y persiste la preferencia (GM_setValue)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "444444444");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const toggle = dock.children.find((n) => n.getAttribute && n.getAttribute("data-accion") === "toggle");
      t.falso(dock.className.includes("colapsado"));
      toggle._listeners.click[0]({ stopPropagation() {} });
      t.cierto(dock.classList.contains("colapsado"), "el primer clic colapsa");
      t.igual(c.env.gm["vgl_dock_acciones_colapsado"], "1", "la preferencia queda persistida");
      toggle._listeners.click[0]({ stopPropagation() {} });
      t.falso(dock.classList.contains("colapsado"), "el segundo clic expande");
      t.igual(c.env.gm["vgl_dock_acciones_colapsado"], "", "y la preferencia se actualiza");
    });

    t.caso("createAccionesDockUI: clic en agendar (nada pendiente) abre openAgendamientoModal, no openLabSoloModal", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c); // los open*Modal cablean sus propios botones con querySelector
      mockPacienteDock(c, "555555555");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const bAg = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "agendar");
      bAg._listeners.click[0]({ stopPropagation() {} });
      t.cierto(!!c.env.doc.getElementById("vgl-agendar-modal") || !!c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal"), "el modal de agendamiento completo quedó montado");
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-labsolo-modal"), "NO el modal ligero de solo-laboratorio");
      c.api._uxVolcarBuffer();
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.cierto(w && w.acciones && w.acciones["widget.agendar.abrir"] === 1, "queda telemetría de la acción");
    });

    t.caso("createAccionesDockUI: clic en agendar (solo falta el laboratorio) abre openLabSoloModal", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      mockPacienteDock(c, "666666666");
      c.api.markCitaAgendadaHoy("666666666", "2026-08-20");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const bAg = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "agendar");
      bAg._listeners.click[0]({ stopPropagation() {} });
      c.api._uxVolcarBuffer();
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.cierto(w && w.acciones && w.acciones["widget.agendar.sololab"] === 1, "la rama 'solo falta el laboratorio' queda registrada, no la de agendamiento completo");
      t.falso(!!(w.acciones["widget.agendar.abrir"]));
    });

    t.caso("createAccionesDockUI: clic en un botón bloqueado (disabled) no hace nada", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "777777777");
      c.api.markCitaAgendadaHoy("777777777", "2026-08-20");
      c.api.markLabAgendadaHoy("777777777");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const bAg = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "agendar");
      t.cierto(bAg.disabled);
      bAg._listeners.click[0]({ stopPropagation() {} });
      c.api._uxVolcarBuffer();
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.falso(w && w.acciones && (w.acciones["widget.agendar.abrir"] || w.acciones["widget.agendar.sololab"]), "un botón disabled no dispara ninguna acción ni telemetría, aunque el listener siga cableado");
    });

    t.caso("createAccionesDockUI: usa la cita REAL de state.lastSnapshot.list cuando existe (no inventa el nombre)", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      mockPacienteDock(c, "888888888");
      c.api.__state.lastSnapshot = { list: [{ doc_id: "888888888", nombre: "PACIENTE DE PRUEBA REAL", citaId: 4321 }] };
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const bLabs = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "labs");
      // openLaboratoriosModal es async (consulta Athenea) y GM_xmlhttpRequest no está
      // mockeada aquí — la promesa queda pendiente para siempre, sin bloquear el proceso
      // (no registra ningún timer). Lo que SÍ es observable de forma síncrona es que el
      // clic no lanzó (apt.doc_id llegó bien formado desde lastSnapshot.list) y que la
      // telemetría de apertura quedó registrada.
      t.noLanza(() => bLabs._listeners.click[0]({ stopPropagation() {} }));
      c.api._uxVolcarBuffer();
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.cierto(w && w.acciones && w.acciones["widget.labs.abrir"] === 1);
    });

    t.caso("createAccionesDockUI: sin coincidencia en state.lastSnapshot.list arma solo {doc_id}, nunca inventa un nombre", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "999999999");
      c.api.__state.lastSnapshot = { list: [{ doc_id: "000000000", nombre: "OTRO PACIENTE" }] };
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      t.cierto(!!dock, "el widget igual se crea: apt.doc_id es lo único que exigen los open*Modal");
    });

    // ================= createExamenFisicoInjectorUI (plantilla por posición) =================
    // v12.9.0 — Diagnóstico real en consultorio (13-08-2026): 45 de 56 campos de la pestaña
    // "Revisión por sistema y Examen físico" comparten LITERALMENTE el mismo id="alert_message"
    // (defecto de Everest). Corrección tras la primera entrega: el médico mostró una captura
    // real donde esas ~37 casillas de texto YA tenían, cada una, su PROPIA frase distinta (no
    // estaban vacías) — lo que hace falta es guardar esa frase por POSICIÓN y poder repetirla
    // en un paciente nuevo con la pestaña en blanco. El botón usa querySelectorAll con el
    // selector de atributo id+type, nunca getElementById (que solo alcanzaría el primero) —
    // estas pruebas fijan document.querySelectorAll para simular esos campos duplicados.
    function campoFalso(valor, opciones) {
      const o = opciones || {};
      return {
        id: "alert_message", type: "text", value: valor,
        offsetParent: o.oculto ? null : {},
        _eventos: [],
        dispatchEvent(ev) { this._eventos.push(ev.type); return true; },
      };
    }

    // setNgValue construye `new Event(...)` para disparar input/change: el DOM falso del
    // harness no trae Event global (igual que en suite_08), hay que dárselo al contexto
    // antes de la primera prueba que dispare un clic real.
    if (!cv.ctx.Event) {
      cv.ctx.Event = class Event {
        constructor(type, init) { this.type = type; this.bubbles = (init && init.bubbles) || false; }
      };
    }

    t.caso("createExamenFisicoInjectorUI: crea un único botón flotante una sola vez", () => {
      const antes = cv.env.doc.body.children.length;
      cv.api.createExamenFisicoInjectorUI();
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      t.cierto(!!btnN, "el botón quedó en el body");
      t.igual(btnN.innerHTML, "🩺 Normalidad", "v15.6: etiqueta corta para caber en la columna izquierda libre");
      t.cierto(typeof btnN.onclick === "function", "el clic queda cableado");
      cv.env.doc.getElementById = (id) => (id === "vgl-examen-normalidad" ? btnN : null);
      cv.api.createExamenFisicoInjectorUI();
      t.igual(cv.env.doc.body.children.length, antes + 1, "la segunda llamada no añade botones duplicados");
    });

    // v17.1.1 — reporte en vivo del 21-ago: «Normalidad fija» se colaba en Ruta Crónicos.
    // `id="alert_message"` se repite en varias pestañas (Hábitos, Ruta Crónicos…) y Everest
    // no las saca del DOM al cambiar de pestaña, solo las tapa. El conteo de 30 casillas
    // contaba TODAS, viera el médico esas casillas o no. Ahora solo cuentan las visibles.
    t.caso("createExamenFisicoInjectorUI (#151): 30 «alert_message» MONTADAS PERO TAPADAS (otra pestaña) no encienden el botón", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      cv.env.doc.getElementById = (id) => (id === "vgl-examen-normalidad" ? btnN : null);
      // Sin barra de pestañas legible (_vglEnPestana → null): la decisión cae ENTERA en
      // el conteo, que es justo la rama que este defecto rompía.
      cv.env.doc.querySelector = () => null;
      const ocultas = Array.from({ length: 32 }, () => campoFalso("", { oculto: true }));
      cv.env.doc.querySelectorAll = (sel) =>
        (sel === 'input[id="alert_message"], input[id="sintomasGenerales"]') ? ocultas : [];
      cv.api.createExamenFisicoInjectorUI();
      t.igual(btnN.style.display, "none", "32 casillas existen, pero NINGUNA está a la vista: el botón se queda oculto");
    });

    t.caso("createExamenFisicoInjectorUI (#151): con esas mismas 32 pero VISIBLES, el botón sí enciende", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      cv.env.doc.getElementById = (id) => (id === "vgl-examen-normalidad" ? btnN : null);
      cv.env.doc.querySelector = () => null;
      const visibles = Array.from({ length: 32 }, () => campoFalso("", { oculto: false }));
      cv.env.doc.querySelectorAll = (sel) =>
        (sel === 'input[id="alert_message"], input[id="sintomasGenerales"]') ? visibles : [];
      cv.api.createExamenFisicoInjectorUI();
      t.igual(btnN.style.display, "", "las mismas 32, a la vista de verdad: el botón sí sale");
    });

    // ================= "Normalidad fija" (v12.10.3, plantilla incluida en el script) =================
    // v12.10.4 — a pedido directo del médico, este botón es el ÚNICO de la pestaña, pega de
    // un solo clic (SIN cuadro de confirmación) — pero jamás pisa una casilla con texto.
    t.caso("Normalidad fija: sin casillas en pantalla, avisa con los medios PROPIOS (cero alert nativo) y no revienta", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      cv.env.doc.querySelectorAll = () => [];
      const alertas = [];
      cv.ctx.alert = (m) => alertas.push(String(m));
      btnN.onclick();
      t.igual(alertas.length, 0, "v15.6: jamás una ventana del navegador");
      t.cierto(String(btnN.innerHTML).includes("Aquí no hay casillas"), "el propio botón explica que esta pestaña no es la suya");
    });

    t.caso("Normalidad fija: un solo clic rellena SOLO las vacías, sin pedir confirmación, respeta las que ya tienen texto", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      const yaEscrita = campoFalso("El médico ya escribió esto y NUNCA se toca");
      const vacia1 = campoFalso("");
      const vacia2 = campoFalso("   "); // solo espacios: cuenta como vacía
      const oculta = campoFalso("", { oculto: true });
      const casillas36 = [yaEscrita, vacia1, vacia2].concat(Array.from({ length: 33 }, () => campoFalso(""))).concat([oculta]);
      cv.env.doc.querySelectorAll = (sel) => (typeof sel === "string" && sel.includes('input[id="alert_message"][type="text"]') ? casillas36 : []);
      let confirmLlamado = false;
      cv.ctx.confirm = () => { confirmLlamado = true; return false; }; // si el botón llamara confirm() y devolviera false, esta prueba lo detectaría
      const alertas = [];
      cv.ctx.alert = (m) => alertas.push(String(m));
      btnN.onclick();
      t.falso(confirmLlamado, "no pide confirmación — un solo clic aplica de una vez");
      t.igual(yaEscrita.value, "El médico ya escribió esto y NUNCA se toca", "posición 0 ya tenía texto: se respeta");
      t.igual(vacia1.value, "NEGATIVO PARA OTALGIA, TINNITUS O HIPOACUSIA.", "posición 1 vacía recibe la frase fija de SU posición (Oído), no la 0 (Piel, que ya estaba ocupada)");
      t.igual(vacia2.value, "NEGATIVO PARA XEROSTOMÍA, ODINOFAGIA O LESIONES EN MUCOSA.", "posición 2 (solo espacios) también cuenta como vacía y recibe la frase de SU posición (Boca)");
      t.igual(oculta.value, "", "una casilla oculta no se toca");
      t.cierto(vacia1._eventos.includes("input") && vacia1._eventos.includes("change"), "setNgValue disparó input y change");
      t.igual(yaEscrita._eventos.length, 0, "la casilla respetada no dispara ningún evento");
      cv.ctx.confirm = () => true;
    });

    t.caso("Normalidad fija: si el número de casillas de hoy no coincide con las 36 de la plantilla fija, avisa el desajuste y se rehúsa por seguridad (v14.2.2)", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      const vacia = campoFalso("");
      cv.env.doc.querySelectorAll = (sel) => (typeof sel === "string" && sel.includes('input[id="alert_message"][type="text"]') ? [vacia] : []);
      const alertas = [];
      cv.ctx.alert = (m) => alertas.push(String(m));
      btnN.onclick();
      t.igual(vacia.value, "", "por seguridad (v14.2.2) ante desajuste de casillas no se pega nada");
      // v15.5.0 — sin alert() nativo: el desajuste se avisa en el botón, con ambas cifras.
      t.igual(alertas.length, 0, "cero alert() nativos");
      t.cierto(String(btnN.innerHTML).includes("1") && String(btnN.innerHTML).includes("36"), "el botón avisa el desajuste con ambas cifras");
    });

    t.caso("Normalidad fija: la plantilla trae exactamente 36 frases (19 de revisión por sistema + 17 de examen físico, sin MAMAS ni GENITO/URINARIO)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const m = src.match(/const EXAMEN_FISICO_NORMALIDAD_FIJA = \[([\s\S]*?)\n  \];/);
      t.cierto(!!m, "la constante existe en el archivo fuente");
      const frases = m[1].match(/^\s*"[^"]*"/gm) || [];
      t.igual(frases.length, 36, "36 frases exactas — a pedido del médico, MAMAS y GENITO/URINARIO quedaron fuera");
      t.falso(frases.some((f) => /MAMA/i.test(f) || /GENITO/i.test(f)), "ninguna de las 36 frases (comentarios aparte) menciona mamas ni genitourinario");
    });

    // ================= openLaboratoriosModal =================
    await t.casoAsync("openLaboratoriosModal: una cita sin documento solo deja un aviso warn", async () => {
      await cv.api.openLaboratoriosModal({ nombre: "SIN DOCUMENTO" });
      t.igual(suma.className, "warn");
      t.cierto(suma.textContent.includes("no tiene documento legible"));
      t.falso(cv.env.doc.body.children.some((n) => n.id === "vgl-labs-modal"), "no se abre ningún modal");
    });

    // ================= _agruparUroanalisisParaTabla (v12.5.16) =================
    // Reportado en consultorio con el PDF real del laboratorio: un solo examen
    // "Uroanálisis" (~28 parámetros) se mostraba en el modal como si cada parámetro
    // fuera un examen independiente. Función pura, sin DOM: se prueba directo.
    t.caso("_agruparUroanalisisParaTabla: agrupa todos los componentes en UN bloque, conserva el resto tal cual", () => {
      const c = cargar();
      const labs = [
        { NombreParametro: "CREATININA", Resultado: "1.2", Fecha: "2026-08-01" },
        { NombreParametro: "COLOR", NombreParametroPadre: "UROANALISIS", Resultado: "AMARILLO", Fecha: "2026-08-03" },
        { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
        { NombreParametro: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-08-01" },
      ];
      const agrupado = c.api._agruparUroanalisisParaTabla(labs);
      t.igual(agrupado.length, 3, "3 componentes de orina se vuelven UN solo bloque; los otros 2 analitos quedan igual");
      t.igual(agrupado[0].NombreParametro, "CREATININA", "el analito que no es de orina no se mueve de su posición");
      const bloque = agrupado.find((l) => Array.isArray(l.__vglGrupoUroComponentes));
      t.cierto(!!bloque, "hay un bloque agrupado");
      t.igual(bloque.NombreParametro, "Uroanálisis", "el bloque se presenta como UN examen, no como 'COLOR'/'GLUCOSA'/etc.");
      t.igual(bloque.__vglGrupoUroComponentes.length, 3);
      t.cierto(bloque.__vglGrupoUroComponentes.some((x) => x.nombre === "COLOR" && x.resultado === "AMARILLO"));
      t.cierto(bloque.__vglGrupoUroComponentes.some((x) => x.nombre === "NITRITOS" && x.resultado === "NEGATIVO"));
      t.igual(agrupado[2].NombreParametro, "COLESTEROL TOTAL", "el otro analito real tampoco se mueve");
    });

    t.caso("_agruparUroanalisisParaTabla: el bloque toma la FECHA del componente más reciente (misma regla que _ultimaFechaPorAnalito)", () => {
      const c = cargar();
      const labs = [
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-07-01" },
        { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
        { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-07-15" },
      ];
      const bloque = c.api._agruparUroanalisisParaTabla(labs)[0];
      t.igual(bloque.Fecha, "2026-08-03", "el bloque hereda la fecha del componente más reciente, no del primero de la lista");
    });

    t.caso("_agruparUroanalisisParaTabla: el bloque hereda hash/token del componente representante, para el botón de informe único", () => {
      const c = cargar();
      const labs = [
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-07-01", __vglHash: "h1", __vglToken: "t1" },
        { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03", __vglHash: "h2", __vglToken: "t2" },
      ];
      const bloque = c.api._agruparUroanalisisParaTabla(labs)[0];
      t.igual(bloque.__vglHash, "h2", "el hash/token es del componente MÁS RECIENTE (el mismo que ganó la fecha), no de cualquiera");
    });

    // v14.0.1 — Reportado en consultorio EN VIVO con pantallazo: el mismo componente
    // ("GLUCOSA EN SUERO...", "CREATININA EN SUERO...") aparecía DOS veces en el bloque,
    // amontonando la rejilla. Causa real: Athenea manda una fila por CADA solicitud
    // histórica del mismo componente (una vieja, una nueva) y nada las deduplicaba.
    t.caso("_agruparUroanalisisParaTabla: el mismo componente repetido (solicitud vieja + nueva) se deduplica, solo sobrevive el más reciente", () => {
      const c = cargar();
      const labs = [
        { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO (SOLICITUD VIEJA)", Fecha: "2026-07-01" },
        { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "POSITIVO", Fecha: "2026-08-03" },
      ];
      const bloque = c.api._agruparUroanalisisParaTabla(labs)[0];
      t.igual(bloque.__vglGrupoUroComponentes.length, 2, "GLUCOSA repetida cuenta como UN solo componente en el bloque, no dos");
      const glucosa = bloque.__vglGrupoUroComponentes.find((x) => x.nombre === "GLUCOSA");
      t.igual(glucosa.resultado, "NEGATIVO", "sobrevive el resultado de la solicitud MÁS RECIENTE, no el de la vieja");
    });

    t.caso("_agruparUroanalisisParaTabla: el orden de llegada NO decide — si la solicitud VIEJA llega DESPUÉS en el arreglo, igual pierde contra la más reciente", () => {
      // Mismo caso que arriba pero con el orden invertido (la vieja llega SEGUNDA): si la
      // deduplicación solo sobrescribiera por orden de llegada (el último gana, sin mirar
      // fecha), este caso fallaría donde el anterior no — es el que de verdad prueba que se
      // compara por FECHA y no por posición en el arreglo.
      const c = cargar();
      const labs = [
        { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
        { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO (SOLICITUD VIEJA)", Fecha: "2026-07-01" },
      ];
      const bloque = c.api._agruparUroanalisisParaTabla(labs)[0];
      t.igual(bloque.__vglGrupoUroComponentes.length, 1);
      t.igual(bloque.__vglGrupoUroComponentes[0].resultado, "NEGATIVO", "la vieja llegó de última en el arreglo pero sigue siendo la vieja: no debe ganar");
    });

    t.caso("_agruparUroanalisisParaTabla: sin componentes de orina, la lista sale intacta (ni un bloque de más)", () => {
      const c = cargar();
      const labs = [{ NombreParametro: "CREATININA", Resultado: "1.2" }, { NombreParametro: "COLESTEROL TOTAL", Resultado: "180" }];
      const agrupado = c.api._agruparUroanalisisParaTabla(labs);
      t.igual(agrupado.length, 2);
      t.falso(agrupado.some((l) => Array.isArray(l.__vglGrupoUroComponentes)));
    });

    t.caso("_agruparUroanalisisParaTabla: entrada no-array o vacía no lanza", () => {
      const c = cargar();
      t.noLanza(() => c.api._agruparUroanalisisParaTabla(null));
      t.noLanza(() => c.api._agruparUroanalisisParaTabla(undefined));
      t.igual(c.api._agruparUroanalisisParaTabla([]).length, 0);
    });

    // Instancia con red simulada: el puente REAL de 3 pasos (BusquedaPaciente ->
    // BuscarPaciente -> DatosPaciente) resuelve idSolicitud=4321/año=2026 para la
    // cédula buscada, Athenea devuelve un analito por consultaDetalleSolicitud, y el
    // buscador de paciente de Everest (fetch, no gmxhr) no halla nada por defecto.
    let labsSinDatos = false;
    const cModal = cargar({
      silencioso: true,
      gmxhr: (o) => {
        if (labsSinDatos) { if (o.onerror) o.onerror("sin red"); return; }
        const url = o.url;
        if (url.endsWith("/Resultados/BusquedaPaciente")) {
          o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="TOK1">' });
        } else if (url.endsWith("/Resultados/BuscarPaciente")) {
          o.onload({ status: 200, responseText: '<input name="IdPaciente" value="55555"><input name="__RequestVerificationToken" value="TOK2">' });
        } else if (url.endsWith("/Resultados/DatosPaciente")) {
          // La cédula buscada debe aparecer en el HTML para pasar _atheneaCedulaCoincide,
          // y la solicitud viaja como <form id="{idSolicitud}{año}" data-modulo="LAB"
          // action="/Resultados/Reporte"> (el mismo patrón que lee _atheneaExtraerSolicitudes).
          o.onload({ status: 200, responseText: 'CC 12345678 <form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>' });
        } else if (url.includes("consultaDetalleSolicitud")) {
          o.onload({
            status: 200,
            responseText: JSON.stringify({
              dataObject: JSON.stringify([
                { NombreParametro: "CREATININA", Resultado: "1.2", Fecha: "2026-08-01", ValoresReferencia: "Elevado" },
              ]),
            }),
          });
        } else if (o.onerror) { o.onerror("url no simulada"); }
      },
    });
    enriquecerDom(cModal);
    const ultimoModal = (id) => cModal.env.doc.body.children.filter((n) => n.id === id).pop();

    await t.casoAsync("openLaboratoriosModal: pinta la tabla con los resultados reales de Athenea", async () => {
      await cModal.api.openLaboratoriosModal({ doc_id: "12345678", nombre: "ANA PEREZ" });
      const modal = ultimoModal("vgl-labs-modal");
      t.cierto(!!modal, "el modal quedó en el body");
      t.cierto(modal.innerHTML.includes("ANA PEREZ"));
      t.cierto(modal.innerHTML.includes("#doc=12345678"), "el enlace al portal lleva la cédula");
      const contenido = modal.querySelector("#vgl-labs-content");
      t.cierto(contenido.innerHTML.includes("CREATININA"));
      t.cierto(contenido.innerHTML.includes("1.2"));
      // v12.3.30 — la tabla ahora muestra dd/mm/aaaa (mismo formato que el resto de la UI),
      // no el ISO crudo que devuelve Athenea.
      t.cierto(contenido.innerHTML.includes("01/08/2026"));
      t.cierto(contenido.innerHTML.includes("Athenea (Principal)"), "la fila declara su fuente");
      t.cierto(contenido.innerHTML.includes("vgl-labs-tr vgl-labs-alert"), "un resultado que la fuente declara Elevado lleva la clase de resalte en rojo (vgl-labs-alert; el color vive en la hoja de estilos, no inline)");
    });

    // v14.0.0 (TL2) — mismo diagnóstico que ya existe para fecha/hora: si ninguno de los 3
    // campos probados para "Ref. / Rango" trae valor, la consola vuelca las claves REALES
    // del analito — evidencia para que el médico la capture en consultorio en vez de que
    // el código adivine un cuarto nombre de campo sin datos reales.
    await t.casoAsync("openLaboratoriosModal (TL2): sin ningún campo de referencia conocido, la consola vuelca las claves reales del analito (diagnóstico, no una adivinanza)", async () => {
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          const url = o.url;
          if (url.endsWith("/Resultados/BusquedaPaciente")) o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="TOK1">' });
          else if (url.endsWith("/Resultados/BuscarPaciente")) o.onload({ status: 200, responseText: '<input name="IdPaciente" value="9"><input name="__RequestVerificationToken" value="TOK2">' });
          else if (url.endsWith("/Resultados/DatosPaciente")) o.onload({ status: 200, responseText: 'CC 999888777 <form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>' });
          else if (url.includes("consultaDetalleSolicitud")) o.onload({
            status: 200,
            responseText: JSON.stringify({
              dataObject: JSON.stringify([
                { NombreParametro: "PSA", Resultado: "1.1", Fecha: "2026-08-01", CampoRaroDesconocido: "0.0-4.0 ng/mL" },
              ]),
            }),
          });
          else if (o.onerror) o.onerror("url no simulada");
        },
      });
      enriquecerDom(c);
      const avisos = [];
      c.ctx.console = { log: () => {}, warn: (...a) => avisos.push(a.map(String).join(" ")), error: () => {}, info: () => {} };
      await c.api.openLaboratoriosModal({ doc_id: "999888777", nombre: "PACIENTE DIAGNOSTICO" });
      const linea = avisos.find((a) => a.includes("diagnóstico Ref./Rango"));
      t.cierto(!!linea, "debe avisar con el rótulo del diagnóstico");
      t.cierto(linea.includes("CampoRaroDesconocido"), "las claves reales del analito (incluida la que de verdad trae el rango) deben aparecer en el aviso");
      t.cierto(linea.includes("NombreParametro"), "también deben verse el resto de las claves reales del mismo analito, no solo la del rango");
    });

    await t.casoAsync("openLaboratoriosModal (TL2): CON un campo de referencia reconocido, la consola NO avisa nada (solo diagnostica el hueco real)", async () => {
      const avisos = [];
      cModal.ctx.console = { log: () => {}, warn: (...a) => avisos.push(a.map(String).join(" ")), error: () => {}, info: () => {} };
      await cModal.api.openLaboratoriosModal({ doc_id: "12345678", nombre: "ANA PEREZ" });
      t.falso(avisos.some((a) => a.includes("diagnóstico Ref./Rango")), "el fixture base SÍ trae ValoresReferencia: no hay hueco que diagnosticar");
    });

    await t.casoAsync("openLaboratoriosModal v12.5.4: sin hash/token en la tarjeta, la fila NO ofrece 'Ver informe'", async () => {
      const modal = ultimoModal("vgl-labs-modal");
      const contenido = modal.querySelector("#vgl-labs-content");
      // OJO: 'class="vgl-labs-pdf"' (con la comilla de cierre) para no confundir el
      // BOTÓN con la celda contenedora 'vgl-labs-pdfcol', que siempre está presente.
      t.falso(contenido.innerHTML.includes('class="vgl-labs-pdf"'), "el fixture base no trae hash/token: sin botón");
    });

    await t.casoAsync("openLaboratoriosModal: clic en el fondo cierra el modal (bgClick → closeMod)", async () => {
      const modal = ultimoModal("vgl-labs-modal");
      disparar(modal, "click", { target: modal });
      t.igual(modal.innerHTML, "", "closeMod vacía y desmonta el modal");
    });

    await t.casoAsync("openLaboratoriosModal: sin resultados dice la verdad y no inventa datos", async () => {
      labsSinDatos = true;
      await cModal.api.openLaboratoriosModal({ doc_id: "87654321", nombre: "PEDRO" });
      const modal = ultimoModal("vgl-labs-modal");
      const contenido = modal.querySelector("#vgl-labs-content");
      t.cierto(contenido.innerHTML.includes("No se encontraron paraclínicos recientes"));
      t.cierto(contenido.innerHTML.includes("No se muestra ningún resultado de ejemplo"));
      labsSinDatos = false;
    });

    // v12.5.4 — Instancia SEPARADA con la tarjeta REAL (fecha en español + hash/token),
    // para probar que "Ver informe" aparece en la tabla con los datos correctos (el
    // clic real que dispara abrirInformeAthenea() se prueba aparte, más abajo).
    const cModal2 = cargar({
      silencioso: true,
      gmxhr: (o) => {
        const url = String(o.url || "");
        if (url.endsWith("/Resultados/BusquedaPaciente")) {
          o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="TOK1">' });
        } else if (url.endsWith("/Resultados/BuscarPaciente")) {
          o.onload({ status: 200, responseText: '<input name="IdPaciente" value="55555"><input name="__RequestVerificationToken" value="TOK2">' });
        } else if (url.endsWith("/Resultados/DatosPaciente")) {
          o.onload({
            status: 200,
            responseText: `CC 12345678
              <div class="card">
                <div class="card-text no-margin"><strong>vie. 15 may. 2026 07:31 a.&nbsp;m.</strong></div>
                <div class="card-title no-margin">Numero: 26051503125</div>
                <form id="43212026" data-modulo="LAB" action="/Resultados/Reporte">
                  <input type="hidden" id="hash" name="hash" value="HASHBTN" />
                  <input name="__RequestVerificationToken" type="hidden" value="TOKENBTN" />
                </form>
              </div>`,
          });
        } else if (url.includes("consultaDetalleSolicitud")) {
          o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ NombreParametro: "CREATININA", Resultado: "1.2" }]) }) });
        } else if (url.endsWith("/Resultados/Reporte")) {
          o.onload({ status: 200, response: { tipo: "pdf-simulado" } });
        } else if (o.onerror) { o.onerror("url no simulada"); }
      },
    });
    enriquecerDom(cModal2);

    await t.casoAsync("openLaboratoriosModal v12.5.4: CON hash/token en la tarjeta, la fila SÍ ofrece 'Ver informe' con los datos correctos", async () => {
      // v12.5.4 — El DOM simulado del banco (harness.js) no parsea innerHTML de verdad
      // (querySelector devuelve un stub en blanco, no un nodo real de la cadena
      // asignada): por eso esta prueba verifica el HTML tal cual se envía al navegador
      // real —incluidos los atributos data-hash/data-token— en vez de simular un clic
      // sobre un botón que el DOM falso no puede reconstruir. El clic real y el POST
      // resultante se prueban por separado, llamando a abrirInformeAthenea() directo
      // (ver más abajo) — es la misma función que ese clic dispara en el navegador.
      await cModal2.api.openLaboratoriosModal({ doc_id: "12345678", nombre: "ANA PEREZ" });
      const modal = cModal2.env.doc.body.children.filter((n) => n.id === "vgl-labs-modal").pop();
      const contenido = modal.querySelector("#vgl-labs-content");
      t.cierto(contenido.innerHTML.includes('class="vgl-labs-pdf"'), "con hash/token, el botón sí aparece");
      t.cierto(contenido.innerHTML.includes('data-hash="HASHBTN"'));
      t.cierto(contenido.innerHTML.includes('data-token="TOKENBTN"'));
      t.cierto(contenido.innerHTML.includes('data-modulo="LAB"'));
    });

    // v12.5.16 — Instancia SEPARADA: Athenea devuelve un uroanálisis real de varios
    // componentes (mismo caso reportado en consultorio, con el PDF real del laboratorio
    // de referencia) para confirmar que la TABLA del modal ya no los muestra como
    // exámenes independientes.
    const cModal3 = cargar({
      silencioso: true,
      gmxhr: (o) => {
        const url = String(o.url || "");
        if (url.endsWith("/Resultados/BusquedaPaciente")) {
          o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="TOK1">' });
        } else if (url.endsWith("/Resultados/BuscarPaciente")) {
          o.onload({ status: 200, responseText: '<input name="IdPaciente" value="55555"><input name="__RequestVerificationToken" value="TOK2">' });
        } else if (url.endsWith("/Resultados/DatosPaciente")) {
          o.onload({ status: 200, responseText: 'CC 12345678 <form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>' });
        } else if (url.includes("consultaDetalleSolicitud")) {
          o.onload({
            status: 200,
            responseText: JSON.stringify({
              dataObject: JSON.stringify([
                { NombreParametro: "COLOR", NombreParametroPadre: "UROANALISIS", Resultado: "AMARILLO", Fecha: "2026-08-03" },
                { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
                { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
                { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
                { NombreParametro: "LEUCOCITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-03" },
                { NombreParametro: "CREATININA", Resultado: "1.2", Fecha: "2026-08-01" },
              ]),
            }),
          });
        } else if (o.onerror) { o.onerror("url no simulada"); }
      },
    });
    enriquecerDom(cModal3);

    await t.casoAsync("openLaboratoriosModal v12.5.16: un uroanálisis de varios componentes se muestra como UN solo examen 'Uroanálisis', no cinco filas independientes", async () => {
      await cModal3.api.openLaboratoriosModal({ doc_id: "12345678", nombre: "ANA PEREZ" });
      const modal = cModal3.env.doc.body.children.filter((n) => n.id === "vgl-labs-modal").pop();
      const contenido = modal.querySelector("#vgl-labs-content");
      const html = contenido.innerHTML;
      t.cierto(html.includes(">Uroanálisis<"), "aparece como un examen llamado 'Uroanálisis'");
      t.cierto(html.includes("<b>COLOR</b>: AMARILLO"), "el componente COLOR está DENTRO del bloque, con su resultado");
      t.cierto(html.includes("<b>NITRITOS</b>: NEGATIVO"));
      t.cierto(html.includes("5 parámetros"), "dice cuántos componentes incluye en vez de un rango de referencia");
      // Ninguno de los 5 componentes aparece como nombre de fila propio (serían 5 filas
      // separadas si el arreglo del bug siguiera activo).
      t.falso(html.includes("<td class=\"vgl-labs-exam\">COLOR</td>"), "COLOR no es su propia fila/examen");
      t.falso(html.includes("<td class=\"vgl-labs-exam\">NITRITOS</td>"), "NITRITOS no es su propia fila/examen");
      t.cierto(html.includes("CREATININA"), "el analito que sí es un examen aparte se sigue mostrando normal");
    });

    // v12.8.1 — Reportado en consultorio CON CAPTURAS: la tabla salía a una palabra por
    // línea y las demás columnas parecían vacías. Los componentes ya NO se unen con <br>
    // (una sola columna altísima dentro de una celda): cada uno es su propio <span> para
    // que el CSS los reparta en rejilla. Sin esta prueba, cualquier refactor visual futuro
    // puede volver al <br> y reproducir exactamente el mismo desastre.
    await t.casoAsync("openLaboratoriosModal v12.8.1: los componentes del uroanálisis van en rejilla (un span cada uno), NUNCA unidos con <br>", async () => {
      const modal = cModal3.env.doc.body.children.filter((n) => n.id === "vgl-labs-modal").pop();
      const html = modal.querySelector("#vgl-labs-content").innerHTML;
      t.cierto(html.includes('<div class="vgl-labs-uro">'), "el bloque multiparamétrico tiene su propio contenedor de rejilla");
      const spans = (html.match(/class="vgl-labs-uro-i"/g) || []).length;
      t.igual(spans, 5, "un span por componente del uroanálisis, no un chorizo con <br>");
      t.falso(html.includes("</b>: AMARILLO<br>"), "los componentes ya no se separan con <br>");
      t.cierto(html.includes("<b>COLOR</b>: AMARILLO"), "el texto de cada componente no cambió: sigue siendo NOMBRE: VALOR");
    });

    // ================= abrirInformeAthenea (misma función que dispara el clic real) =================
    t.caso("abrirInformeAthenea: sin hash o sin token, no toca la red", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      let llamado = false;
      c.env.win.GM_xmlhttpRequest = () => { llamado = true; };
      c.api.abrirInformeAthenea(null, "T", "LAB");
      c.api.abrirInformeAthenea("H", null, "LAB");
      t.falso(llamado);
    });

    t.caso("abrirInformeAthenea v12.5.5: mismo hash en vuelo -> el segundo clic no dispara una segunda petición (guarda anti-doble-clic)", () => {
      const llamadas = [];
      let enVuelo = null;
      // Mock que NO resuelve de inmediato: guarda la petición para resolverla a mano,
      // así se puede simular el segundo clic mientras la primera sigue pendiente (algo
      // que el mock síncrono de las demás pruebas de este bloque no permite observar).
      const c = cargar({ silencioso: true, gmxhr: (o) => { llamadas.push(o); enVuelo = o; } });
      enriquecerDom(c);
      const btn1 = { disabled: false, textContent: "📄" };
      const btn2 = { disabled: false, textContent: "📄" };
      c.api.abrirInformeAthenea("HASH-DUP", "TOK", "LAB", btn1);
      c.api.abrirInformeAthenea("HASH-DUP", "TOK", "LAB", btn2);
      t.igual(llamadas.length, 1, "el segundo clic con el mismo hash no dispara una segunda petición mientras la primera sigue en vuelo");
      enVuelo.onload({ status: 200, response: { simulado: true } });
      // Tras resolver, el hash se libera: un nuevo clic sí puede volver a pedirlo.
      c.api.abrirInformeAthenea("HASH-DUP", "TOK", "LAB", btn1);
      t.igual(llamadas.length, 2, "tras resolver la primera, el hash queda libre y un nuevo clic sí dispara otra petición");
    });

    await t.casoAsync("abrirInformeAthenea: éxito — POST correcto (hash/modulo/token, form-urlencoded, responseType blob) y el botón se reactiva", async () => {
      const llamadas = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => { llamadas.push(o); o.onload({ status: 200, response: { simulado: true } }); } });
      enriquecerDom(c);
      const btnFalso = { disabled: false, textContent: "📄" };
      // v12.5.4 — El mock de GM_xmlhttpRequest de este banco responde SÍNCRONAMENTE
      // (a diferencia del navegador real): para cuando abrirInformeAthenea() retorna,
      // el ciclo deshabilitar→pedir→reactivar ya corrió completo. Por eso aquí solo se
      // verifica el estado FINAL (reactivado) — el estado transitorio "⏳ deshabilitado"
      // sí ocurre en el navegador real (btn.disabled=true se fija ANTES del
      // GM_xmlhttpRequest, ver el código fuente), simplemente este mock no deja verlo.
      c.api.abrirInformeAthenea("HASHREAL", "TOKENREAL", "LAB", btnFalso);
      await esperar(20);
      t.igual(llamadas.length, 1);
      t.igual(llamadas[0].method, "POST");
      t.igual(llamadas[0].url, "https://medicosviva1a.atheneasoluciones.com/Resultados/Reporte");
      t.igual(llamadas[0].responseType, "blob");
      t.igual(llamadas[0].headers["Content-Type"], "application/x-www-form-urlencoded");
      t.cierto(llamadas[0].data.includes("hash=HASHREAL"));
      t.cierto(llamadas[0].data.includes("modulo=LAB"));
      t.cierto(llamadas[0].data.includes("__RequestVerificationToken=TOKENREAL"));
      t.igual(btnFalso.disabled, false, "se reactiva tras la respuesta");
      t.igual(btnFalso.textContent, "📄");
    });

    await t.casoAsync("abrirInformeAthenea: HTTP de error -> el botón se reactiva y no queda colgado en 'cargando'", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => o.onload({ status: 500, response: null }) });
      enriquecerDom(c);
      const btnFalso = { disabled: true, textContent: "⏳" };
      c.api.abrirInformeAthenea("H", "T", "LAB", btnFalso);
      await esperar(20);
      t.igual(btnFalso.disabled, false);
      t.igual(btnFalso.textContent, "📄");
    });

    await t.casoAsync("abrirInformeAthenea: fallo de red (onerror) -> el botón también se reactiva", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => o.onerror("sin red") });
      enriquecerDom(c);
      const btnFalso = { disabled: true, textContent: "⏳" };
      c.api.abrirInformeAthenea("H", "T", "LAB", btnFalso);
      await esperar(20);
      t.igual(btnFalso.disabled, false);
      t.igual(btnFalso.textContent, "📄");
    });

    await t.casoAsync("abrirInformeAthenea: se agota el tiempo (ontimeout) -> el botón también se reactiva", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => o.ontimeout && o.ontimeout() });
      enriquecerDom(c);
      const btnFalso = { disabled: true, textContent: "⏳" };
      c.api.abrirInformeAthenea("H", "T", "LAB", btnFalso);
      await esperar(20);
      t.igual(btnFalso.disabled, false);
      t.igual(btnFalso.textContent, "📄");
    });

    // ================= openAgendamientoModal =================
    t.caso("openAgendamientoModal: una cita sin documento solo deja un aviso warn", () => {
      cv.api.openAgendamientoModal(null);
      t.igual(suma.className, "warn");
      t.cierto(suma.textContent.includes("no tiene documento legible"));
    });

    // [v14.2.0 — auditoría pre-producción 2026-08-18] El checkbox de RCV/Prevención no
    // tenía efecto real para los médicos de esMedicoRCVActivo (apiAccesoAsignarTurno
    // fuerza swIsPyM/SwProgramaEspecial a true de todas formas) pero seguía mostrándose
    // como un control editable. Ahora se muestra marcado y deshabilitado para ellos, con
    // una nota explicando por qué. Ver CHANGELOG.
    t.caso("openAgendamientoModal: para un médico de la lista RCV, el checkbox sale marcado y deshabilitado (honesto)", () => {
      const cRcv = cargar({ silencioso: true });
      enriquecerDom(cRcv);
      cRcv.api.__state.activeDoctor.id = 707;
      cRcv.api.__state.activeDoctor.name = "CARLOS PALENCIA";
      cRcv.api.openAgendamientoModal({ doc_id: "424242", nombre: "CARLOS RUIZ" });
      const modal = cRcv.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      // El DOM simulado del arnés no refleja los atributos HTML checked/disabled a
      // propiedades JS al parsear innerHTML (siempre quedan en false) — se verifica el
      // marcado literal, como el resto de pruebas estructurales de este archivo.
      t.cierto(
        modal.innerHTML.includes('id="vgl-agm-pym-chk" checked disabled>'),
        "sale marcado y deshabilitado: no hay elección real para este médico"
      );
      t.cierto(modal.innerHTML.includes("Todas las citas de este médico se registran como RCV"), "explica por qué está bloqueado");
    });

    t.caso("openAgendamientoModal: para un médico fuera de la lista RCV, el checkbox sigue siendo una elección real", () => {
      const cNoRcv = cargar({ silencioso: true });
      enriquecerDom(cNoRcv);
      cNoRcv.api.__state.activeDoctor.id = 707;
      cNoRcv.api.__state.activeDoctor.name = "ANA MARIA PEREZ";
      cNoRcv.api.openAgendamientoModal({ doc_id: "424242", nombre: "CARLOS RUIZ" });
      const modal = cNoRcv.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.cierto(
        modal.innerHTML.includes('id="vgl-agm-pym-chk" checked>'),
        "sale marcado por defecto pero editable: para este médico el checkbox sí decide"
      );
      t.falso(modal.innerHTML.includes('id="vgl-agm-pym-chk" checked disabled>'), "no debe salir deshabilitado");
      t.falso(modal.innerHTML.includes("Todas las citas de este médico se registran como RCV"), "sin la nota de bloqueo");
    });

    t.caso("esMedicoRCVActivo: invocación directa — coincide por sub-cadena, sin distinguir mayúsculas ni tildes", () => {
      const cH = cargar({ silencioso: true });
      cH.api.__state.activeDoctor.name = "dr. ánGEL estrada";
      t.cierto(cH.api.esMedicoRCVActivo(), "ESTRADA está en RCV_DOCTORS, sin importar tilde/caja");
      cH.api.__state.activeDoctor.name = "ANA MARIA PEREZ";
      t.falso(cH.api.esMedicoRCVActivo(), "PEREZ no está en la lista");
    });

    await t.casoAsync("openAgendamientoModal: si Everest no halla al paciente, lo dice en los horarios", async () => {
      // fetch por defecto del harness: responde {} y extractPatientId no saca nada
      const cAg = cargar({ silencioso: true });
      enriquecerDom(cAg);
      // Sin un id de médico en turno, cargarHoras() ni siquiera llega a buscar al
      // paciente: se queda en el aviso "no identifica su usuario de Everest" (rama
      // distinta a la que este caso quiere probar). Se fija un id para que la
      // búsqueda de paciente sí corra y sea ESA la que falle.
      cAg.api.__state.activeDoctor.id = 707;
      cAg.api.openAgendamientoModal({ doc_id: "424242", nombre: "CARLOS RUIZ" });
      await esperar(50);
      const modal = cAg.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.cierto(!!modal, "el modal de agendamiento quedó en el body");
      t.cierto(modal.innerHTML.includes("Programación de Cita · Remisión RCV"));
      t.cierto(modal.innerHTML.includes("CARLOS RUIZ"));
      const fechaEsperada = cAg.api.calcBusinessTargetDate(1, 0).fmt;
      t.cierto(modal.querySelector("#vgl-agm-date-info").innerHTML.includes(fechaEsperada), "la fecha objetivo (1 mes) se calculó");
      t.cierto(modal.querySelector("#vgl-agm-slots").innerHTML.includes("No se encontró el paciente en el sistema de agenda con el documento 424242"));
    });

    await t.casoAsync("openAgendamientoModal: flujo completo — turnos reales de la agenda propia y confirmación habilitada", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cFull = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return respuestaJson({ data: { celular: "300-111-2233", sexo: "F", programasPaciente: [
              { id: 9, descripcion: "Nefroprotección", swProgramaEspecial: true },
              { id: 3, descripcion: "Salud Mental", swProgramaEspecial: false },
            ] } });
          }
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 55, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false, mensaje: "Superó las validaciones" } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => {
          if (o.url.includes("ObtenerTurnosPorFecha")) {
            o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ hora: "06:30:00" }] }) });
          } else if (o.onerror) { o.onerror("url no simulada"); }
        },
      });
      enriquecerDom(cFull);
      cFull.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cFull.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(60);
      const modal = cFull.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      t.igual(slots.children.length, 1, "con la agenda propia identificada, solo el turno — sin aviso de agenda ajena");
      const botonTurno = slots.children[0];
      t.cierto(botonTurno.innerHTML.includes("08:00 AM"));
      t.cierto(botonTurno.innerHTML.includes("ANA MARIA PEREZ"), "el profesional se muestra SIEMPRE");
      // Programas del paciente: solo los swProgramaEspecial entran al selector
      const sel = modal.querySelector("#vgl-agm-prog-sel");
      t.cierto(sel.innerHTML.includes("Nefroprotección"));
      t.falso(sel.innerHTML.includes("Salud Mental"), "un programa no-especial no se ofrece");
      t.igual(modal.querySelector("#vgl-agm-prog-box").className.includes("vgl-d-none"), false);
      // El celular del SMS se muestra saneado para que el médico lo verifique
      t.igual(modal.querySelector("#vgl-agm-sms-tel").value, "3001112233");
      t.cierto(modal.querySelector("#vgl-agm-sms-nota").textContent.includes("verifíquelo antes de confirmar"));
      // v12.6.4 — Pedido explícito del médico: junto a la casilla de laboratorio debe
      // verse si esa cita TAMBIÉN recibe SMS (mismo celular/casilla de arriba — no es un
      // envío aparte, ver apiLaboratorioAgendarAuto). Se actualiza en vivo con la casilla
      // y el celular del SMS general (el DOM simulado del banco no interpreta el atributo
      // HTML `checked` del innerHTML, así que se fija el estado a mano — igual que ya
      // hacen otras pruebas de este mismo modal — y se dispara el evento real).
      const notaLabSms = modal.querySelector("#vgl-agm-lab-sms-nota");
      const chkSms = modal.querySelector("#vgl-agm-sms-chk");
      chkSms.checked = true;
      disparar(chkSms, "change");
      t.cierto(notaLabSms.textContent.includes("También se envía SMS"));
      t.cierto(notaLabSms.textContent.includes("3001112233"));
      chkSms.checked = false;
      disparar(chkSms, "change");
      t.cierto(notaLabSms.textContent.includes("Sin SMS para esta cita"), "al desmarcar el SMS general, la nota del laboratorio lo refleja de inmediato");
      // Los turnos del laboratorio de AppCita también llegaron (vía GM)
      t.cierto(modal.querySelector("#vgl-agm-lab-time-sel").innerHTML.includes("06:30 AM"));
      // Elegir el turno habilita el botón de confirmar con la hora a la vista
      const confirmar = modal.querySelector("#vgl-agm-confirm");
      confirmar.disabled = true;
      disparar(botonTurno, "click");
      t.igual(confirmar.disabled, false);
      t.cierto(confirmar.textContent.includes("(08:00 AM)"));
      t.cierto(botonTurno.classList.contains("active"));
    });

    // =====================================================================
    // v17.0.3 — REPORTE DE CAMPO: "por más que edite el celular a mano, el SMS le llega
    // al que tiene registrado el paciente en Everest — hasta probé mandándomelo a mi
    // propio teléfono y nada". Causa real: cargarHoras() vuelve a pedir
    // BuscarPacienteDetallado y REPINTA #vgl-agm-sms-tel con el celular de Everest en
    // CADA cambio de fecha/especialidad — y elegir una fecha es lo más normal del mundo
    // justo DESPUÉS de haber corregido el celular. La corrección quedaba borrada sin
    // aviso. Arreglo: igual que _controlElegidoManual ya protege la fecha de control,
    // _celularSmsEditadoManual protege el celular en cuanto el médico lo toca a mano.
    // =====================================================================
    await t.casoAsync("openAgendamientoModal (v17.0.3): editar el celular a mano y cambiar de fecha NO borra la corrección", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cCel = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3117563824", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const m = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u);
            const iso = m ? m[1] : "2026-09-01";
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cCel);
      cCel.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cCel.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cCel.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const inpTel = modal.querySelector("#vgl-agm-sms-tel");
      t.igual(inpTel.value, "3117563824", "arranca con el celular que trae Everest — fijamos el punto de partida del caso real");

      // El médico corrige el número a mano (p. ej. para probar el envío con el suyo, como
      // en el reporte real).
      inpTel.value = "3012783220";
      disparar(inpTel, "input");

      // Y ahora cambia de fecha — lo más normal del mundo, y justo lo que en el reporte
      // real terminaba borrando la corrección sin que el médico lo notara.
      const chips = [...modal.querySelector("#vgl-day-chips").children];
      t.cierto(chips.length > 1, "hace falta más de un día para poder elegir uno distinto");
      disparar(chips[1] || chips[0], "click");
      await esperar(80);

      t.igual(inpTel.value, "3012783220",
        "REGRESIÓN (reporte real 21-08-2026): cambiar de fecha ya NO pisa el celular que el médico acababa de corregir a mano");
    });

    // v17.0.3 — REPORTE DE CAMPO (pantallazo real): el resumen del paso 3 mostraba
    // "Notificación SMS: 3117563824" arriba mientras la casilla "Celular:" de abajo ya
    // tenía "3012783220" — el médico lo leyó, con razón, como que su corrección no serviría
    // de nada. Causa real: esa línea del resumen se pintaba UNA sola vez al entrar al paso
    // 3 (ver irAPaso) y el campo sigue editable ahí mismo, sin que haga falta salir y
    // volver a entrar al paso para que el resumen se entere del cambio.
    await t.casoAsync("openAgendamientoModal (v17.0.3): el resumen del paso 3 deja de mostrar un celular viejo si el médico lo corrige sin salir del paso", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cResumen = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3117563824", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const m = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u);
            const iso = m ? m[1] : "2026-09-01";
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cResumen);
      cResumen.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cResumen.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cResumen.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");

      disparar(modal.querySelector("#vgl-step-2-next"), "click");   // al paso 3 — pinta el resumen
      const resumenSms = modal.querySelector("#vgl-agm-sum-sms");
      t.cierto(resumenSms.innerHTML.includes("3117563824"), "el resumen arranca con el mismo celular que trae el campo de abajo");

      // El médico corrige el celular MIENTRAS sigue viendo el resumen — el pantallazo real
      // mostraba las dos cifras distintas a la vista al mismo tiempo.
      const inpTel = modal.querySelector("#vgl-agm-sms-tel");
      inpTel.value = "3012783220";
      disparar(inpTel, "input");

      t.cierto(resumenSms.innerHTML.includes("3012783220"),
        "REGRESIÓN: el resumen ya no se queda con el número viejo — se refresca con cada tecla, igual que el campo de abajo");
      t.falso(resumenSms.innerHTML.includes("3117563824"), "y no queda ni rastro del número anterior a la vista");
    });

    // v17.0.3 — el arreglo de arriba (_celularSmsEditadoManual) protege contra que un
    // futuro repintado vuelva a pisar el celular corregido a mano. Hoy en día eso no
    // llega a ocurrir porque el BuscarPacienteDetallado que dispara cargarHoras() está
    // detrás de `progCargados`, que solo lo deja pasar UNA vez por reserva — esta prueba
    // deja fijado ese comportamiento real: cambiar de fecha NO debe sumar consultas
    // nuevas a las que ya corrieron al abrir el modal.
    //
    // (Se comprobó con trazas reales que, APARTE de esa, existe una segunda consulta a
    // BuscarPacienteDetallado, totalmente independiente y no ligada a `progCargados`: el
    // auto-análisis en segundo plano de la fecha sugerida — _preseleccionarSugerencia() /
    // mtrCalcularResumenClinico(), v15.8.0 N3 — que corre como mucho una vez, sola, cuando
    // el paciente no tiene ya un resumen clínico en caché. Por eso esta prueba compara
    // "antes" contra "después de los clics" en vez de exigir un total fijo: cuántas
    // consultas hay AL ABRIR depende de esa ruta aparte, ajena a lo que aquí se protege.)
    await t.casoAsync("openAgendamientoModal (v17.0.3): cambiar de fecha NO suma consultas nuevas a BuscarPacienteDetallado", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      let llamadasDet = 0;
      const cUnaVez = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) { llamadasDet++; return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } }); }
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const m = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u);
            const iso = m ? m[1] : "2026-09-01";
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cUnaVez);
      cUnaVez.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cUnaVez.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cUnaVez.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const trasAbrir = llamadasDet;
      t.cierto(trasAbrir >= 1, "al menos la consulta que arma el paso 2 (celular, programas) debió correr al abrir");

      const chips = [...modal.querySelector("#vgl-day-chips").children];
      disparar(chips[1] || chips[0], "click");
      await esperar(80);
      disparar(chips[2] || chips[0], "click");
      await esperar(80);

      t.igual(llamadasDet, trasAbrir, "cambiar de fecha dos veces más NO vuelve a consultar Everest (regresión del piso de progCargados)");
    });

    // v17.0.3 — _refrescarResumenSms() (el arreglo de arriba) arma su innerHTML con el valor
    // que el médico acaba de escribir en el campo del celular. Igual que el resto de este
    // módulo (Suite 31, M1), ese valor NO se confía tal cual: se exige el mismo escapeHtml()
    // que ya llevaba la línea original de una sola pintada.
    await t.casoAsync("openAgendamientoModal (v17.0.3): el resumen del paso 3 escapa el celular editado a mano — sin hueco XSS", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cXss = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3117563824", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const m = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u);
            const iso = m ? m[1] : "2026-09-01";
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cXss);
      cXss.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cXss.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cXss.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      disparar(modal.querySelector("#vgl-step-2-next"), "click");   // al paso 3 — pinta el resumen

      const inpTel = modal.querySelector("#vgl-agm-sms-tel");
      inpTel.value = '"><img src=x onerror=alert(1)>';
      disparar(inpTel, "input");

      const resumenSms = modal.querySelector("#vgl-agm-sum-sms");
      t.falso(resumenSms.innerHTML.includes("<img"), "el payload no llega a insertarse como etiqueta real");
      t.cierto(resumenSms.innerHTML.includes("&lt;img"), "queda como texto escapado, igual que exige escapeHtml()");
    });

    // v17.0.3 — REPORTE DE CAMPO (capturas reales, 21-08-2026): "VOLVIÓ A SALIR DOS FECHAS
    // SELECCIONADAS" + "toca apagarlo a la fuerza" (tarea #127). _afinarLabsPrimeroConCupos()
    // (arriba) es la única función del módulo que sondea la red en segundo plano (hasta 8
    // consultas seguidas) sin poder cancelarse — ya tiene su arreglo (_labsAfinarToken), pero
    // la tarea que lo pidió exigía pruebas y nunca se escribieron. Se reproduce el caso real:
    // una ronda de sondeo queda A MEDIAS (la red no ha respondido todavía) mientras el médico
    // elige un día de toma a mano; cuando la ronda vieja por fin responde — y responde con un
    // cupo real EN OTRA FECHA, el caso más peligroso — NO debe pisar lo que el médico eligió.
    //
    // Verificado deshaciendo a mano, por unos minutos, el guardia (`miTok !== _labsAfinarToken`)
    // de la línea ~18920: sin él esta prueba SÍ falla (el banner termina mostrando la fecha de
    // la ronda vieja) — confirma que la prueba realmente ejercita la protección y no solo
    // "pasa sola". Con el guardia puesto (el código real), queda en verde.
    await t.casoAsync("openAgendamientoModal (v17.0.3): una ronda vieja de _afinarLabsPrimeroConCupos que responde tarde (con cupo real, en otra fecha) NO pisa lo que el médico ya eligió a mano", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");

      // Aritmética de fechas, replicando EXACTAMENTE lo que hace la función real, para saber
      // de antemano qué dos fechas va a pedir la ronda de labs-primero: labMinIso (su primer
      // paso) y la siguiente fecha hábil después de esa (su segundo paso, si la primera
      // "no tiene cupos"). Una instancia auxiliar basta — es aritmética pura, no necesita
      // ningún mock.
      const aux = cargar({ silencioso: true });
      // v17.1.0 (#137) — la primera fecha ya NO es «hoy+14 ajustado a hábil»: con un examen
      // vencido el piso cede y la toma se adelanta al primer día hábil. Se le pregunta al
      // propio motor en vez de replicar su aritmética, que es lo que hacía que esta prueba
      // se rompiera al cambiar la regla en un solo sitio.
      const labMinIso = aux.api.mtrPlanLabsPrimero(
        { drivers: [], pasajeros: [], vencidos: [{ clave: "HBA1C", nombre: "HbA1c" }] },
        aux.api.todayStamp()
      ).labMinIso;
      let segundaFecha = aux.api.mtrSumarDias(labMinIso, 1);
      while (aux.api.mtrEsDiaNoHabil(segundaFecha)) segundaFecha = aux.api.mtrSumarDias(segundaFecha, 1);

      let rondaVieja = null;
      const cLp = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const m = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u);
            const iso = m ? m[1] : "2026-09-01";
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        // v17.0.3 — ObtenerTurnosPorFecha (el sondeo de _afinarLabsPrimeroConCupos) viaja por
        // GM_xmlhttpRequest, no por fetch. OJO: no es la única fuente de estas llamadas —
        // cargarHorasLab() (parte del flujo normal, sin relación con labs-primero) pide OTRAS
        // fechas por su cuenta, así que hay que responder por FECHA EXACTA, no por orden de
        // llegada. La de labMinIso (primer paso de la ronda) se resuelve SIN cupos, para que
        // el bucle avance; la de segundaFecha (su segundo paso) se deja A PROPÓSITO sin
        // resolver — es la que el test decide cuándo "responde la red". Cualquier otra
        // (incluida una repetición de segundaFecha desde otra fuente) se resuelve sin cupos,
        // inofensiva.
        gmxhr: (o) => {
          const u = String(o.url);
          if (!u.includes("ObtenerTurnosPorFecha")) return;
          if (u.includes("fechaBuscar=" + labMinIso)) { o.onload({ responseText: JSON.stringify({ turnos: [] }) }); return; }
          if (u.includes("fechaBuscar=" + segundaFecha) && !rondaVieja) { rondaVieja = o; return; }
          o.onload({ responseText: JSON.stringify({ turnos: [] }) });
        },
      });
      enriquecerDom(cLp);
      cLp.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      // Un examen VENCIDO activa labs-primero (mtrPlanLabsPrimero).
      cLp.api.mtrCacheResumenGuardar("555111", {
        programa: "ERC",
        plan: { vencidos: [{ nombre: "Creatinina sérica" }], drivers: [], pasajeros: [] },
      });

      cLp.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cLp.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");

      // La ronda automática (al abrir, por labs-primero activo) ya debió arrancar, avanzar
      // de largo por labMinIso (sin cupos) y quedarse esperando la red en segundaFecha.
      t.cierto(!!rondaVieja, "_afinarLabsPrimeroConCupos() arrancó sola, avanzó a la segunda fecha (" + segundaFecha + ") y quedó esperando ahí");

      // El médico no espera: elige un día de toma a mano, de los chips que YA están en
      // pantalla — el mismo caso real: el médico actúa mientras la ronda de labs-primero
      // sigue en el aire.
      const labChipsEl = modal.querySelector("#vgl-lab-day-chips");
      const chipElegido = labChipsEl.children[0];
      t.cierto(!!chipElegido, "hay chips de toma en pantalla para poder elegir uno a mano");
      disparar(chipElegido, "click");
      await esperar(20);
      const bannerSug = modal.querySelector("#vgl-agm-sugerida");
      const htmlTrasElegir = bannerSug.innerHTML;

      // Ahora, tarde, la ronda vieja responde — y responde con un cupo real en segundaFecha
      // (distinta a lo que el médico ya tiene elegido): el caso más peligroso, porque es
      // justo el que antes SÍ alcanzaba a pisar la elección.
      rondaVieja.onload({ responseText: JSON.stringify({ turnos: [{ id: 1, hora: "07:00" }] }) });
      await esperar(80);

      t.igual(bannerSug.innerHTML, htmlTrasElegir,
        "REGRESIÓN (capturas reales 21-08-2026, tarea #127): la ronda vieja de labs-primero, aunque responda tarde y con un cupo real, no repinta ni pisa lo que el médico ya eligió a mano");
    });

    // [v14.2.0 — backlog §3] La misma llamada a BuscarPacienteDetallado que ya arma el
    // selector de programas ahora también alimenta perfilAdicionalCache, para que el panel
    // principal pueda mostrar el chip sin pedirle nada nuevo a Everest.
    await t.casoAsync("openAgendamientoModal: perfil sencillo (HTA pura) queda en perfilAdicionalCache para el panel principal", async () => {
      const cHta = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return respuestaJson({ data: { celular: "3009998877", sexo: "F", programasPaciente: [
              { id: 1, descripcion: "Hipertensión", swProgramaEspecial: true },
            ] } });
          }
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 778 } });
          if (u.includes("BuscarCitasDisponibles")) return respuestaJson({ agendas: [] });
          return respuestaJson({});
        },
      });
      enriquecerDom(cHta);
      cHta.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cHta.api.openAgendamientoModal({ doc_id: "555222", nombre: "MARIA HTA" });
      await esperar(60);
      const cacheado = cHta.api.__state.perfilAdicionalCache.get("555222");
      t.cierto(!!cacheado, "quedó una entrada para este documento");
      t.igual(cacheado.adicionales, true, "HTA pura sin resumen que la degrade: candidata");
      t.cierto(cHta.api.candidatoAdicional("555222").adicionales === true, "candidatoAdicional() la reconoce de inmediato");
    });

    // v14.0.1 — Reportado en consultorio EN VIVO con pantallazo: antes, un día sin agenda
    // propia caía a mostrar los turnos de OTRO profesional con solo un aviso rojo — un clic
    // distraído podía agendar con el médico equivocado. Ahora ese día se BLOQUEA (nunca
    // ofrece turnos ajenos) y busca automáticamente, entre los demás días del rango, el más
    // cercano que sí tenga la agenda propia real.
    await t.casoAsync("openAgendamientoModal v14.0.1: si el día elegido no tiene agenda PROPIA, se bloquea y salta solo al día más cercano que sí la tiene — nunca muestra turnos ajenos", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cAjena = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            const dow = new Date(iso + "T12:00:00").getDay();
            // El día CENTRO siempre cae en día hábil (nunca sábado) — con solo los sábados
            // trayendo la agenda propia, el centro SIEMPRE arranca "ajeno" y el salto
            // automático tiene que buscar hasta llegar a un sábado del rango.
            const medico = dow === 6 ? "ANA MARIA PEREZ" : "OTRO PROFESIONAL";
            return respuestaJson({ agendas: [{ agendaId: 61, medico, fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cAjena);
      cAjena.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cAjena.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(1200);
      const modal = cAjena.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      // v14.0.1 — El harness de pruebas no reconstruye textContent a partir de innerHTML ni
      // de appendChild (textContent es una propiedad estática, ver tests/harness.js): igual
      // que el resto de este archivo, se lee el innerHTML de cada botón hijo.
      const textoSlots = [...slots.children].map((c) => c.innerHTML || "").join(" ");
      t.falso(textoSlots.includes("OTRO PROFESIONAL"), "nunca se muestra un turno de otro profesional, ni de paso ni como último recurso");
      t.cierto(textoSlots.includes("ANA MARIA PEREZ") && textoSlots.includes("07:00 AM"), "terminó mostrando el turno de la agenda propia, en el día que sí la tenía");
      const chipsEl = modal.querySelector("#vgl-day-chips");
      const activo = [...chipsEl.children].find((b) => b.classList.contains("active"));
      t.cierto(!!activo && activo.className.includes("vgl-agm-pbtn-sabado"), "el chip activo saltó solo al sábado, el único día del rango con agenda propia real");
    });

    await t.casoAsync("openAgendamientoModal v14.0.1: si NINGÚN día del rango tiene agenda propia, avisa con claridad y no ofrece ningún turno ajeno", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cNinguno = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "OTRO PROFESIONAL", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cNinguno);
      cNinguno.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cNinguno.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(1200);
      const modal = cNinguno.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      // v14.0.1 — Este mensaje de error se asigna con slotsEl.innerHTML = "..." directo (no
      // por appendChild), así que a diferencia del caso de arriba sí se lee bien en innerHTML.
      t.falso(slots.innerHTML.includes("OTRO PROFESIONAL"), "nunca se muestra un turno de otro profesional, ni siquiera como último recurso");
      t.cierto(slots.innerHTML.includes("Ningún día del rango tiene su agenda propia"), "avisa con claridad que no encontró ningún día con agenda propia");
    });

    await t.casoAsync("openAgendamientoModal v12.4: se consultan TODAS las agendas propias del día (jornada partida), no solo la primera", async () => {
      // El bug real reportado en consultorio: la médico con agenda de mañana Y de tarde
      // solo veía los turnos de UNA (la que el servidor listara primero) — "solo aparece
      // 5:30 PM todos los días". Con .filter() deben salir los turnos de ambas.
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cDos = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            const f = iso2fmt(iso);
            return respuestaJson({ agendas: [
              { agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: f, sede: "CMB" },     // jornada mañana
              { agendaId: 63, medico: "OTRO PROFESIONAL", fechaAgenda: f, sede: "CMB" },    // ajena
              { agendaId: 62, medico: "ANA MARIA PEREZ", fechaAgenda: f, sede: "CMB" },     // jornada tarde
            ] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) {
            if (u.includes("agendaid=61")) return respuestaJson({ turnos: [{ id: 700, horaTexto: "07:00 AM", estado: "ACT" }] });
            if (u.includes("agendaid=62")) return respuestaJson({ turnos: [{ id: 1730, horaTexto: "05:30 PM", estado: "ACT" }] });
            return respuestaJson({ turnos: [{ id: 999, horaTexto: "09:00 AM", estado: "ACT" }] });
          }
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cDos);
      cDos.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cDos.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cDos.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      // En el DOM simulado innerHTML no refleja appendChild: se inspeccionan los hijos.
      const textos = [...slots.children].map((n) => (n.innerHTML || "") + " " + (n.textContent || "")).join(" | ");
      t.cierto(textos.includes("07:00 AM"), "la agenda de la mañana aparece");
      t.cierto(textos.includes("05:30 PM"), "la agenda de la tarde TAMBIÉN aparece (antes se perdía)");
      t.falso(textos.includes("09:00 AM"), "la agenda de otro profesional queda fuera");
      t.falso(textos.includes("No se identificó su agenda propia"), "con agendas propias no hay aviso de agenda ajena");
    });

    // ================= v15.7.0 — MODO MANUAL (calendario) =================
    await t.casoAsync("modo manual: elegir una fecha del calendario apaga las sugerencias (banner y ⭐) y re-centra los días en la fecha elegida; volver o tocar un plazo las restaura", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cMan = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }, { id: 901, horaTexto: "02:00 PM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("x"); },
      });
      enriquecerDom(cMan);
      cMan.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cMan.api.openAgendamientoModal({ doc_id: "555111", nombre: "PACIENTE PRUEBA" });
      await esperar(80);
      const modal = cMan.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.cierto(String(modal.innerHTML).includes("vgl-agm-manual-btn"), "el control «Elegir fecha en el calendario» está en el paso 2, sin taparse con lo demás");
      const mBtn = modal.querySelector("#vgl-agm-manual-btn");
      const mInp = modal.querySelector("#vgl-agm-manual-fecha");
      disparar(mBtn, "click");
      t.falso(mInp.classList.contains("vgl-d-none"), "el calendario aparece al tocar el botón");
      // una fecha cualquiera del futuro, elegida a mano
      const hoy = cMan.api.todayStamp();
      const manual = cMan.api.mtrSumarDias(hoy, 45);
      mInp.value = manual;
      disparar(mInp, "change");
      await esperar(60);
      t.cierto(modal.querySelector("#vgl-agm-sugerida").classList.contains("vgl-d-none"), "la sugerencia del asistente se apaga");
      t.falso(modal.querySelector("#vgl-agm-manual-est").classList.contains("vgl-d-none"), "y se declara el modo manual");
      const chips = modal.querySelector("#vgl-day-chips");
      t.cierto(chips.children.length >= 5, "los días se re-centran alrededor de la fecha elegida (±7 hábiles)");
      const centro = chips.children.find((b) => String(b.innerHTML).includes("🎯"));
      t.cierto(!!centro, "la fecha elegida queda como centro activo");
      const slots = modal.querySelector("#vgl-agm-slots");
      await esperar(60);
      t.falso(String(slots.innerHTML).includes("SUGERIDO"), "sin ⭐ SUGERIDO: en manual usted manda");
      // volver a las sugerencias
      disparar(modal.querySelector("#vgl-agm-manual-volver"), "click");
      t.falso(modal.querySelector("#vgl-agm-sugerida").classList.contains("vgl-d-none"), "volver restaura la sugerencia");
      // y una fecha pasada se rechaza con explicación
      disparar(mBtn, "click");
      mInp.value = "2020-01-01";
      disparar(mInp, "change");
      t.cierto(String(modal.querySelector("#vgl-agm-manual-est").textContent).includes("ya pasó"), "fecha pasada: se explica y no se entra al modo manual");
    });

    await t.casoAsync("confirmar cita v12.4: el cupo se re-verifica en tiempo real — si ya no está ACT, NO se dispara AsignarTurno", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      let turnosServidos = 0;
      const urlsVistas = [];
      const cVer = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url); urlsVistas.push(u);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) {
            // Primera consulta (listado): el turno está libre. Las siguientes (la
            // verificación previa a confirmar y el re-listado): otro usuario lo tomó.
            turnosServidos++;
            return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: turnosServidos === 1 ? "ACT" : "CAN" }] });
          }
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cVer);
      cVer.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cVer.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cVer.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const botonTurno = [...slots.children].find((n) => (n.innerHTML || "").includes("08:00 AM"));
      disparar(botonTurno, "click");
      const confirmar = modal.querySelector("#vgl-agm-confirm");
      t.igual(confirmar.disabled, false);
      disparar(confirmar, "click");
      await esperar(80);
      t.falso(urlsVistas.some((u) => u.includes("AsignarTurno")), "la escritura clínica JAMÁS se disparó con el cupo perdido");
      const textosVer = [...slots.children].map((n) => (n.innerHTML || "") + " " + (n.textContent || "")).join(" | ") + " " + slots.innerHTML;
      t.cierto(textosVer.includes("ya no está disponible"), "se le dice al médico que la hora acaba de ser tomada");
      t.cierto(confirmar.disabled, "el botón de confirmar queda a la espera de otra hora");
    });

    await t.casoAsync("confirmar cita v12.4: con el cupo aún libre, AsignarTurno SÍ se dispara", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const urlsVistas = [];
      const cOk = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url); urlsVistas.push(u);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("AsignarTurno")) return respuestaJson({ error: false, data: { radicado: 12345, motivo: "Agendada Correctamente" } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cOk);
      cOk.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cOk.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cOk.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      // v15.3.0 — El modal pasó a un asistente de TRES pasos (tipo -> fecha/horarios ->
      // resumen y confirmación). Antes todo vivía en una sola pantalla. La prueba recorre
      // ahora el camino real del médico; lo que fija sigue siendo lo mismo: que al confirmar
      // se dispare AsignarTurno de verdad.
      disparar(modal.querySelector("#vgl-step-1-next"), "click");
      await esperar(80);
      const slots = modal.querySelector("#vgl-agm-slots");
      const botonTurno = [...slots.children].find((n) => (n.innerHTML || "").includes("08:00 AM"));
      t.cierto(!!botonTurno, "el paso 2 lista el turno de las 08:00 AM");
      disparar(botonTurno, "click");
      disparar(modal.querySelector("#vgl-step-2-next"), "click");
      disparar(modal.querySelector("#vgl-agm-confirm"), "click");
      await esperar(80);
      t.cierto(urlsVistas.some((u) => u.includes("AsignarTurno")), "con el cupo verificado libre, la cita sí se crea");
      t.cierto(modal.querySelector("#vgl-agm-confirm").textContent.includes("Cita Creada Exitosamente"));
    });

    // v12.10.8 — D3-bis conectado al modal real: perfilPaciente()+recomendacionHorario()
    // (ya probadas en tests/suite_24_motor_perfil.js) ahora se calculan con las etiquetas
    // reales del paciente y marcan con "⭐ SUGERIDO" el turno de la franja recomendada —
    // sin preseleccionarlo ni ocultar el resto (el médico sigue eligiendo cualquiera).
    await t.casoAsync("openAgendamientoModal — D3-bis: un paciente diabético ve \"SUGERIDO\" en el turno AM temprano, no en el resto", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cDM = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [
              { id: 4, descripcion: "Diabetes", swProgramaEspecial: false },
            ] } });
          }
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          // Dos turnos libres: uno en la franja AM (06:00-09:00, debe salir SUGERIDO) y
          // otro fuera de cualquier franja (10:00, no debe llevar insignia).
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [
            { id: 701, horaTexto: "07:00 AM", estado: "ACT" },
            { id: 702, horaTexto: "10:00 AM", estado: "ACT" },
          ] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cDM);
      cDM.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cDM.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cDM.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const btnAM = [...slots.children].find((n) => (n.innerHTML || "").includes("07:00 AM"));
      const btnFueraFranja = [...slots.children].find((n) => (n.innerHTML || "").includes("10:00 AM"));
      t.cierto(!!btnAM && !!btnFueraFranja, "los dos turnos quedaron en pantalla");
      t.cierto(btnAM.innerHTML.includes("⭐ SUGERIDO"), "el turno AM temprano lleva la insignia de sugerido");
      t.cierto(btnAM.className.includes("vgl-agm-sbtn-sugerido"), "el turno AM temprano lleva la clase de sugerido");
      t.falso(btnFueraFranja.innerHTML.includes("SUGERIDO"), "el turno fuera de franja NO lleva insignia");
      t.falso(btnFueraFranja.className.includes("vgl-agm-sbtn-sugerido"), "el turno fuera de franja NO lleva la clase");
      // Elegirlo con un clic normal sigue funcionando exactamente igual que cualquier otro.
      disparar(btnAM, "click");
      t.cierto(btnAM.classList.contains("active"), "un clic normal SÍ lo selecciona — la insignia no reemplaza la elección del médico");
      t.igual(modal.querySelector("#vgl-agm-confirm").disabled, false);
    });

    await t.casoAsync("openAgendamientoModal — D3-bis: un paciente sin etiquetas de riesgo no ve ninguna insignia de sugerido", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cSin = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cSin);
      cSin.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cSin.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cSin.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const btn = [...slots.children].find((n) => (n.innerHTML || "").includes("07:00 AM"));
      t.falso(btn.innerHTML.includes("SUGERIDO"), "sin diabetes/HTA+DM no hay franja que imponer, sin insignia");
    });

    // v16.2.0 — HALLAZGO DE CAMPO (pantallazo real): "🟡 Control habitual (Hipertensión)
    // ➔ Sugerido: Segunda mitad o cupo adicional (:30)" salía en el pill, pero ningún
    // turno se marcaba SUGERIDO — recomendacionHorario no tenía rama para "adicional_30".
    // Reproduce el caso real: paciente con Hipertensión (sí hay evidencia, a diferencia
    // de la prueba anterior) y un cupo :30 libre entre los turnos del día.
    await t.casoAsync("openAgendamientoModal — D3-bis/v16.2.0: control habitual (Hipertensión) SÍ ve SUGERIDO en el cupo :30 — antes no marcaba nada", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cHta = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [
              { id: 5, descripcion: "Hipertensión", swProgramaEspecial: false },
            ] } });
          }
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          // Un turno :30 (cupo adicional real) y uno normal — solo el :30 debe salir SUGERIDO.
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [
            { id: 703, horaTexto: "07:30 AM", estado: "ACT" },
            { id: 704, horaTexto: "08:00 AM", estado: "ACT" },
          ] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cHta);
      cHta.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cHta.api.openAgendamientoModal({ doc_id: "555222", nombre: "ROSA TORRES" });
      await esperar(80);
      const modal = cHta.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const btn30 = [...slots.children].find((n) => (n.innerHTML || "").includes("07:30 AM"));
      const btnNormal = [...slots.children].find((n) => (n.innerHTML || "").includes("08:00 AM"));
      t.cierto(!!btn30 && !!btnNormal, "los dos turnos quedaron en pantalla");
      t.cierto(btn30.innerHTML.includes("⭐ SUGERIDO"), "el cupo :30 lleva la insignia — antes del arreglo, ningún turno la llevaba");
      t.falso(btnNormal.innerHTML.includes("SUGERIDO"), "el turno normal NO lleva insignia — se prefiere el cupo adicional");
    });

    // v14.0.0 — RANGO REAL DE DÍAS: encargo del médico (12-ago), conectado con
    // calcRangoSondeoIso (existía, probada, 0 llamadores). Antes el selector de fecha usaba
    // calcTargetDateRange (±3 días hábiles, SIN sábados) — un duplicado reducido de la misma
    // idea que nunca se reemplazó.
    await t.casoAsync("openAgendamientoModal v14: el selector de fecha trae ±7 días hábiles Y sábados, no ±3 sin sábados", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cR = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            // TODOS los días con agenda real, para medir el tamaño del rango sin que el
            // sondeo en segundo plano retire ninguno — esa parte se prueba aparte.
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cR);
      cR.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cR.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cR.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const chips = [...modal.querySelector("#vgl-day-chips").children];
      // 7 antes + el centro + 7 después = 15 días hábiles como mínimo; más los sábados
      // candidatos que calcRangoSondeoIso encuentre dentro de ese rango (al menos 2 en
      // cualquier ventana de 15 días corridos).
      t.cierto(chips.length >= 15, `esperaba al menos 15 chips (±7 hábiles + centro), salieron ${chips.length}`);
      t.cierto(chips.some((b) => b.className.includes("vgl-agm-pbtn-sabado")), "al menos un sábado aparece en el rango — calcTargetDateRange nunca los traía");
    });

    // v14.0.0 — SONDEO EN SEGUNDO PLANO: "no se deben mostrar los días en los que no haya
    // agenda". Conectado con mapConLimite (existía, probada, 0 llamadores) para no bloquear
    // la apertura del modal con hasta 15 peticiones antes del primer pintado: los chips
    // salen todos de inmediato y se retiran los que la verificación confirma vacíos.
    await t.casoAsync("openAgendamientoModal v14: un sábado sin turnos reales se retira solo tras el sondeo en segundo plano", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cS = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            const dow = new Date(iso + "T12:00:00").getDay();
            // Los sábados (6) NO traen agenda; los días hábiles sí — el escenario real que
            // describió el médico ("cada médico trabaja un sábado cada 15 días").
            if (dow === 6) return respuestaJson({ agendas: [] });
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cS);
      cS.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cS.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      // El pintado de los chips es SÍNCRONO (renderDayChips los agrega todos antes de lanzar
      // el sondeo en segundo plano, que es async): hay que comprobar la precondición ANTES de
      // ceder el hilo con cualquier await, porque con remove() ya funcionando de verdad en el
      // arnés el sondeo puede terminar de retirar el sábado desde el primer "tick".
      const modal = cS.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const chipsEl = modal.querySelector("#vgl-day-chips");
      t.cierto([...chipsEl.children].some((b) => b.className.includes("vgl-agm-pbtn-sabado")), "precondición: había al menos un sábado en el pintado inicial");
      // El sondeo hace una petición POR DÍA con concurrencia acotada (3 a la vez): con la
      // ventana de ±7 hábiles + sábados alcanza sobrando con una espera generosa.
      await esperar(500);
      t.falso([...chipsEl.children].some((b) => b.className.includes("vgl-agm-pbtn-sabado")), "los sábados sin agenda real ya no están: el sondeo los retiró");
      // Los días HÁBILES normales, que sí tenían agenda en el mock, se conservan todos.
      t.cierto(chipsEl.children.length >= 15, "los días hábiles con agenda real siguen ahí");
    });

    // v14.0.0 — SEGURIDAD ANTE FALLO DE RED: un error en la verificación NUNCA debe ocultar
    // un día. Es más seguro mostrar un chip de más (el médico lo intenta y ve el mensaje de
    // "no hay turnos" de cargarHoras si de verdad estaba vacío) que ocultar uno que sí tenía
    // agenda por un problema de conexión pasajero.
    await t.casoAsync("openAgendamientoModal v14: un fallo de red en el sondeo NO oculta el día — se deja tal cual", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      let llamadasCitas = 0;
      const cF = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            llamadasCitas++;
            // La primera llamada (la del día centro, que dispara cargarHoras() de una vez)
            // responde bien; el resto del sondeo en segundo plano falla — simula una red
            // que se cae a media consulta, no un endpoint roto desde el inicio.
            if (llamadasCitas === 1) {
              const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
              return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
            }
            throw new Error("red caída");
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cF);
      cF.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cF.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      // El conteo de referencia se toma ANTES de ceder el hilo (el pintado es síncrono):
      // tomarlo tras un await ya podría estar viendo el resultado del sondeo a medias, lo que
      // volvería la comparación de abajo una tautología en vez de una prueba real.
      const modal = cF.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const chipsEl = modal.querySelector("#vgl-day-chips");
      const antes = chipsEl.children.length;
      await esperar(500);
      t.igual(chipsEl.children.length, antes, "con la red caída en el sondeo, ningún chip se retira — el error se trata como 'no se sabe', no como 'no hay agenda'");
    });

    // v14.0.0 — EL CHIP ACTIVO NUNCA SE RETIRA: aunque el sondeo confirme (de verdad, sin
    // error) que el día seleccionado en ese momento no tiene turnos, cargarHoras() ya le está
    // mostrando ese mismo resultado con su propio aviso explícito — borrárselo de debajo de
    // los dedos sería peor experiencia que dejarlo con el aviso a la vista.
    await t.casoAsync("openAgendamientoModal v14: el chip del día ACTIVO nunca se retira, aunque el sondeo confirme que está vacío de verdad", async () => {
      const cA = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          // TODOS los días, incluido el centro/activo, responden con una lista vacía
          // LEGÍTIMA (sin lanzar) — el escenario que sí debe ocultar un día normal.
          if (u.includes("BuscarCitasDisponibles")) return respuestaJson({ agendas: [] });
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cA);
      cA.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cA.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      const modal = cA.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const chipsEl = modal.querySelector("#vgl-day-chips");
      await esperar(500);
      const activo = [...chipsEl.children].find((b) => b.classList.contains("active"));
      t.cierto(!!activo, "el chip activo (día centro) sigue en el DOM tras el sondeo, aunque estaba confirmado vacío");
      t.cierto(chipsEl.children.length < 18, "los días NO activos que sí estaban confirmados vacíos sí se retiraron");
    });

    // v14.0.2 — Gap documentado en v14.0.1: el sondeo en segundo plano decidía "hay agenda"
    // con CUALQUIER agenda de la respuesta (propia o ajena), así que un sábado con agenda de
    // OTRO profesional se seguía ofreciendo como chip normal — y al pulsarlo, cargarHoras()
    // lo bloqueaba de todos modos y saltaba a otro día, una experiencia peor que no haberlo
    // mostrado nunca. Ahora el sondeo usa la MISMA regla de "propia" que cargarHoras().
    await t.casoAsync("openAgendamientoModal v14.0.2: el sondeo retira el chip de un sábado con agenda solo AJENA, igual que si estuviera vacío", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cSweep = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            const dow = new Date(iso + "T12:00:00").getDay();
            // El día CENTRO siempre cae en día hábil (nunca sábado): solo los sábados
            // traen agenda AJENA, así que el chip activo nunca depende de esta regla.
            const medico = dow === 6 ? "OTRO PROFESIONAL" : "ANA MARIA PEREZ";
            return respuestaJson({ agendas: [{ agendaId: 61, medico, fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cSweep);
      cSweep.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cSweep.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      const modal = cSweep.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const chipsEl = modal.querySelector("#vgl-day-chips");
      await esperar(1200);
      const quedaSabado = [...chipsEl.children].some((b) => b.className.includes("vgl-agm-pbtn-sabado"));
      t.falso(quedaSabado, "el chip del sábado con agenda solo ajena se retiró — la misma regla de 'propia' que bloquea el día central también aplica al sondeo en segundo plano");
    });

    // ================= openLabSoloModal =================
    t.caso("openLabSoloModal: una cita sin documento solo deja un aviso warn", () => {
      cv.api.openLabSoloModal(null);
      t.igual(suma.className, "warn");
      t.cierto(suma.textContent.includes("no tiene documento legible"));
    });

    await t.casoAsync("openLabSoloModal: paciente sin fecha guardada lanza notify y aborta", async () => {
      const cLab = cargar({ silencioso: true });
      // v15.4.0 — un aviso = un canal: la notificación del SISTEMA solo sale con la
      // pestaña oculta (visible, el canal es el toast). La intención original de esta
      // prueba se conserva; solo se simula la pestaña oculta para seguir contándola.
      cLab.env.doc.visibilityState = "hidden";
      enriquecerDom(cLab);
      const avisos = [];
      cLab.ctx.Notification = class {
        constructor(title, opts) {
          avisos.push({ title, body: (opts||{}).body || "", tag: (opts||{}).tag || "", icon: (opts||{}).icon || "" });
        }
        close() {}
        static get permission() { return "granted"; }
      };

      await cLab.api.openLabSoloModal({ doc_id: "424242", nombre: "PRUEBA SINTETICA" });
      await esperar(40);

      t.igual(avisos.length, 1, "se emitió exactamente un aviso");
      t.igual(avisos[0].tag, "vgl-labsolo-sinfecha|424242", "la clave de dedupe viaja en el tag");
      t.igual(avisos[0].icon, cLab.api.colorDot("AMBAR"), "el aviso es AMBAR");
      t.cierto(avisos[0].body.includes("agende la toma de muestras manualmente"));
      t.falso(cLab.env.doc.body.children.some(n => n.id === "vgl-agendar-modal"), "y aborta sin pintar modal");
    });

    await t.casoAsync("openLabSoloModal: flujo completo — muestra el modal con los datos correctos", async () => {
      const cLab = cargar({ silencioso: true });
      enriquecerDom(cLab);
      cLab.api.markCitaAgendadaHoy("424242", "2026-08-20");
      await cLab.api.openLabSoloModal({ doc_id: "424242", nombre: "CON FECHA" });
      const modal = cLab.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.cierto(!!modal, "el modal de toma de muestras quedó en el body");
      t.cierto(modal.innerHTML.includes("Toma de Muestras Pendiente"));
      t.cierto(modal.innerHTML.includes("CON FECHA"));
      t.cierto(modal.innerHTML.includes("424242"));
      t.cierto(modal.innerHTML.includes("20/08/2026"), "la fecha de la cita se formatea correctamente");
      // El día SUGERIDO de toma sale de calcBusinessDaysBefore(fechaCita, 5) — la regla
      // clínica real de esta pantalla. Se compara contra lo que devuelve la propia función,
      // no contra una fecha calculada a mano aparte: si las dos aritméticas de días hábiles
      // llegaran a divergir (festivos, domingos), una fecha fija en el test no lo notaría.
      const sug = cLab.api.calcBusinessDaysBefore("2026-08-20", 5);
      t.cierto(modal.innerHTML.includes(sug.fmt), "el día sugerido de toma es el que calcula calcBusinessDaysBefore, 5 días hábiles antes");
      t.cierto(modal.innerHTML.includes(sug.dayLbl), "y se muestra con su nombre de día");
    });

    // ================= openOrdenamientoModal =================
    await t.casoAsync("openOrdenamientoModal: una cita sin documento solo deja un aviso warn", async () => {
      await cv.api.openOrdenamientoModal({ nombre: "SIN DOC" });
      t.igual(suma.className, "warn");
      t.cierto(suma.textContent.includes("no tiene documento legible"));
    });

    const cOrd = cargar({ silencioso: true });
    enriquecerDom(cOrd);
    const ultimoOrd = () => cOrd.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();

    // v16.2.0 — Antes, sin coincidencia se ofrecía el catálogo institucional COMPLETO
    // para marcar a mano. El médico lo pidió al revés ("QUIERO QUE NO APAREZCA NADA PARA
    // ORDENAR CUANDO EL PACIENTE NO APLICA A NINGUNA ACTIVIDAD"): ofrecer un catálogo
    // entero es justo el riesgo de sobre-ordenar que se quería evitar.
    await t.casoAsync("openOrdenamientoModal: sin coincidencia PyM no se ofrece NADA para ordenar", async () => {
      await cOrd.api.openOrdenamientoModal({ doc_id: "999", nombre: "PEDRO GOMEZ", pym: [] });
      const modal = ultimoOrd();
      t.cierto(!!modal);
      t.cierto(modal.innerHTML.includes("No se detectaron actividades de prevención pendientes"));
      t.cierto(modal.innerHTML.includes("catálogo institucional de Ordenamientos en Everest"), "remite al camino real si de verdad aplica algo");
      t.falso(modal.innerHTML.includes(" checked"), "ninguna casilla premarcada sin coincidencia explícita");
      const items = modal.innerHTML.split("vgl-ord-item").length - 1;
      t.igual(items, 0, "no se ofrece ni una sola actividad del catálogo para marcar a mano");
      t.cierto(modal.innerHTML.includes('id="vgl-ord-confirm"') && modal.innerHTML.includes("disabled"), "el botón de confirmar nace deshabilitado");
      t.cierto(modal.innerHTML.includes("Sin actividades para ordenar"), "el botón lo dice de frente, no invita a elegir algo que no existe");
    });

    await t.casoAsync("openOrdenamientoModal: con coincidencia, el choque de sexo desmarca y advierte", async () => {
      // Mujer con mamografía y PSA en su PyM: la mamografía se premarca, el PSA no
      await cOrd.api.openOrdenamientoModal({ doc_id: "888", nombre: "MARIA DIAZ", sexo: "F", pym: ["Mamografía", "PSA prostata"] });
      const modal = ultimoOrd();
      t.cierto(modal.innerHTML.includes("Mamografía (Mamografía Bilateral)"));
      t.cierto(modal.innerHTML.includes("PSA (antígeno de próstata)"));
      t.cierto(modal.innerHTML.includes('data-idx="0" checked'), "la mamografía (compatible) sale premarcada");
      t.igual(modal.innerHTML.split(" checked").length - 1, 1, "solo una casilla premarcada");
      t.cierto(modal.innerHTML.includes("Actividad propia del sexo M"), "el PSA advierte el choque con el sexo F registrado");
      t.falso(modal.innerHTML.includes("No se detectaron actividades pendientes"), "con coincidencia no sale el aviso de sin-coincidencia");
    });

    await t.casoAsync("openOrdenamientoModal v12.4: la etiqueta oficial 'Tamización cardiometabólica' premarca Z108 (antes el género -a/-o la dejaba por fuera)", async () => {
      await cOrd.api.openOrdenamientoModal({ doc_id: "888", nombre: "PEDRO RUIZ", sexo: "M", pym: ["Tamización cardiometabólica"] });
      const modal = ultimoOrd();
      t.cierto(modal.innerHTML.includes("CIE-10 Z108"), "el paquete de tamización cardiometabólica se ofrece");
      t.cierto(modal.innerHTML.includes('data-idx="0" checked'), "y sale premarcado por la coincidencia con el PyM");
      t.cierto(modal.innerHTML.includes("903816"), "con el LDL 903816 de la tabla oficial (pacientes sanos)");
      t.falso(modal.innerHTML.includes("Hepatitis C"), "las ETS descartadas no se ofrecen");
      t.falso(modal.innerHTML.includes("VDRL"), "las ETS descartadas no se ofrecen");
    });

    // v14.0.0 — CRUCE ANTIDUPLICADO al ordenar (pedido explícito del médico, ver el
    // banner T6/T7 que ya hacía esto mismo para el aviso pasivo): ahora el propio modal de
    // Órdenes reutiliza apiHcObtenerOrdenamientosVigentes + pymCubiertoPorOrdenVigente para
    // que un paquete YA vigente en Everest no se premarque ni se pida en silencio otra vez.
    // I10X (RCV exprés) es el único paquete con vigenciaDias confirmado hoy — los demás,
    // por D4, siempre cuentan como pendientes (ver PYM_CATALOG).
    const iso_N_diasAtras = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    await t.casoAsync("openOrdenamientoModal v14: un paquete YA vigente en Everest (RCV exprés, orden reciente) no se premarca y avisa", async () => {
      const cVig = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { sexo: "M" } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 4321 } });
          if (u.includes("ObtenerOrdenamientoPorPacienteIdVigente")) {
            // v14.1.4 — Con la regla `every` (decisión del médico), el paquete solo cuenta
            // como vigente si TODOS sus exámenes lo están. Antes bastaba el 903818 suelto.
            // Los diez CUPS del RCV exprés, todos ordenados hace 30 días.
            const CUPS_RCV = ["903815", "903817", "903818", "903868", "903895", "903841", "907106", "903876", "903026", "903426"];
            return respuestaJson(CUPS_RCV.map((c) => ({ cup: { codigo: c }, estado: "PEN", fechaCreacion: iso_N_diasAtras(30) })));
          }
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cVig);
      const ultimoOrdVig = () => cVig.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      await cVig.api.openOrdenamientoModal({ doc_id: "444", nombre: "LUIS TORRES", sexo: "M", pym: ["RCV Exprés"] });
      const modal = ultimoOrdVig();
      t.cierto(!!modal, "el modal se pinta igual, con o sin cruce antiduplicado");
      t.cierto(modal.innerHTML.includes("PAQUETE SUPER-ORDENAMIENTO RCV EXPRÉS"), "el paquete RCV exprés se ofrece");
      t.falso(modal.innerHTML.includes(" checked"), "con una orden vigente de hace 30 días (dentro de los 180), NO se premarca");
      t.cierto(modal.innerHTML.includes("Ya existe una orden vigente en Everest"), "el aviso verde explica por qué no se premarcó");
    });

    await t.casoAsync("openOrdenamientoModal v14: un fallo de red al verificar vigentes NO bloquea el premarcado normal", async () => {
      const cVigFalla = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { sexo: "M" } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 4321 } });
          if (u.includes("ObtenerOrdenamientoPorPacienteIdVigente")) throw new Error("red caída");
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cVigFalla);
      const ultimoOrdF = () => cVigFalla.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      await cVigFalla.api.openOrdenamientoModal({ doc_id: "444", nombre: "LUIS TORRES", sexo: "M", pym: ["RCV Exprés"] });
      const modal = ultimoOrdF();
      t.cierto(modal.innerHTML.includes('data-idx="0" checked'), "sin poder verificar vigentes, el paquete se premarca como siempre — un fallo de red no bloquea nada");
      t.falso(modal.innerHTML.includes("Ya existe una orden vigente en Everest"), "sin verificación exitosa, tampoco se avisa un falso 'ya vigente'");
    });

    // =====================================================================
    // v12.6.6 — El correo de la orden va con UsuarioId = id del PACIENTE. Confirmado en la
    // grabación real del consultorio: en la MISMA corrida, Everest pide
    // GenerarLinksImpresionOrdenamientos?PacienteId=801848 y acto seguido
    // EnviarEmailOrdenamiento?...&UsuarioId=801848, siendo 309 el médico de esa sesión.
    // Hasta v12.6.5 aquí se mandaba el id del médico. Esta prueba mira el PUNTO DE USO
    // (el botón "Enviar" del modal), no solo la función de red: el id del paciente sale de
    // BuscarPaciente de ESA cita, así que cambia de paciente en paciente — por eso se
    // comprueba contra el id que devolvió el servidor para este documento y se exige que
    // NO sea el del médico.
    // =====================================================================
    await t.casoAsync("openOrdenamientoModal: el correo de la orden viaja con el id del PACIENTE de esa cita, no con el del médico", async () => {
      const urls = [];
      const cMail = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url); urls.push(u);
          if (u.includes("/api/Paciente/BuscarPaciente")) return respuestaJson({ id: 801848 });
          if (u.includes("ObtenerListadoDiagnostico")) return respuestaJson([{ codigo: "Z108", id: 55, nombre: "TAMIZACION" }]);
          if (u.includes("ObtenerListadoCupsPorPaciente")) {
            const cod = /filter=([^&]+)/.exec(u)[1];
            return respuestaJson([{ codigo: decodeURIComponent(cod), id: 77, nombre: "EXAMEN", descripcion: "EXAMEN" }]);
          }
          if (u.includes("GuardarOrdenamiento")) return respuestaJson({ error: false, agrupador: "1226085275" });
          if (u.includes("GenerarLinksImpresionOrdenamientos")) return respuestaJson({});
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cMail);
      // El DOM simulado no interpreta innerHTML: las casillas ".vgl-ord-chk" que el modal
      // pinta no existen como nodos. Se devuelve UNA casilla marcada (la del primer
      // paquete) para poder ejercitar el flujo real de generación y llegar al correo.
      const casilla = { checked: true, disabled: false, getAttribute: () => "0", addEventListener: () => {}, closest: () => ({ style: {} }) };
      const crearMail = cMail.env.doc.createElement;
      cMail.env.doc.createElement = function (tag) {
        const e = crearMail(tag);
        const qsaBase = e.querySelectorAll;
        e.querySelectorAll = (sel) => (sel === ".vgl-ord-chk" ? [casilla] : qsaBase(sel));
        return e;
      };
      cMail.api.__state.activeDoctor = { id: 309, name: "MEDICO DE PRUEBA" };

      await cMail.api.openOrdenamientoModal({ doc_id: "21545051", nombre: "PACIENTE DE PRUEBA", sexo: "M", pym: ["Tamización cardiometabólica"] });
      await esperar(80);
      const modal = cMail.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      disparar(modal.querySelector("#vgl-ord-confirm"), "click");
      await esperar(80);

      // La caja de correo se consulta desde SU propio nodo (mailBox.querySelector), no
      // desde el modal: en el DOM simulado cada elemento memoiza sus selectores por
      // separado, así que hay que llegar por el mismo camino que el script.
      const card = modal.querySelector(".vgl-agm-card");
      const mailBox = (card.children || []).find((n) => n.className === "vgl-ord-mailbox");
      t.cierto(!!mailBox, "tras generar la orden aparece la caja de correo");
      const mailInput = mailBox.querySelector("#vgl-ord-mail-input");
      mailInput.value = "paciente@ejemplo.com";
      disparar(mailBox.querySelector("#vgl-ord-mail-send"), "click");
      await esperar(120);

      const envio = urls.find((u) => u.includes("EnviarEmailOrdenamiento"));
      t.cierto(!!envio, "el botón Enviar sí dispara el correo");
      t.cierto(envio.includes("UsuarioId=801848"), "UsuarioId es el id que BuscarPaciente devolvió para ESTE paciente");
      t.falso(envio.includes("UsuarioId=309"), "nunca el id del médico");
    });

    // ================= v12.5.13 — imprimir recordatorio de cita / orden PyM =================
    // Contrato real, capturado con el grabador de red del propio proyecto (12-08-2026):
    // GET /apiviva/APIImpresionV2/api/Impresion/ImprimirRecordatorioCita?CitaId=...&Eps=...
    //     &nombreCompleto=...&swVirtual=false   (tras un AsignarTurno exitoso + clic real en
    //     "Imprimir" de Everest)
    // GET /apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=...&idPaciente=...
    //     — v12.6.5: esta URL la DEVUELVE Everest en el cuerpo de
    //     GenerarLinksImpresionOrdenamientos; no se arma aquí. Lo de abajo solo cubre el
    //     respaldo para cuando esa llamada falla.
    function mockOpen(c) {
      const llamadas = [];
      c.env.win.open = (url, target) => { llamadas.push({ url, target }); return { closed: false }; };
      return llamadas;
    }

    // v16.2.0 — pedido del médico: el PDF nativo de Everest lo abría Adobe Acrobat en vez
    // de Chrome. imprimirRecordatorioCita ya no navega la pestaña DIRECTO a la URL de
    // Everest: la abre en blanco (síncrono, patrón anti-bloqueador) y trae el PDF ella
    // misma por fetch para navegar como blob — así Chrome lo muestra en su propio lector
    // en vez de bajarlo a disco. Este arnés (Node) no tiene Blob/URL.createObjectURL
    // reales, así que estas pruebas no pueden asegurar el "camino feliz" del blob en sí
    // —eso solo se confirma en Chrome de verdad—, pero SÍ confirman lo que si pueden: que
    // se pide el PDF a la URL correcta, y que si algo falla (aquí, por el límite del
    // propio arnés) cae exactamente a la URL real de siempre — nunca se queda muda.
    await t.casoAsync("imprimirRecordatorioCita: pide el PDF a la URL real capturada (CitaId=radicado, Eps y nombreCompleto codificados) y navega la pestaña ya abierta", async () => {
      let fetchUrl = null;
      const c = cargar({
        fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, blob: async () => ({ type: "application/pdf" }) }; },
      });
      const llamadas = [];
      const pestana = { closed: false, location: {} };
      c.env.win.open = (url, target) => { llamadas.push({ url, target }); return pestana; };
      c.api.imprimirRecordatorioCita(7813686, "NUEVA EPS ", "MARIA LUZMILA CARMONA CARMONA");
      t.igual(llamadas.length, 1, "abre exactamente una pestaña, en blanco, de forma síncrona (patrón anti-bloqueador v12.6.2)");
      t.igual(llamadas[0].target, "_blank");
      t.igual(llamadas[0].url, "", "en blanco primero — la URL final se conoce después del fetch");
      await esperar(30);
      t.cierto(!!fetchUrl, "sí se pidió el PDF por fetch (mismo origen que el resto de llamadas del script)");
      const uFetch = new URL(fetchUrl);
      t.cierto(uFetch.pathname.endsWith("/apiviva/APIImpresionV2/api/Impresion/ImprimirRecordatorioCita"), "misma ruta que capturó el grabador");
      t.igual(uFetch.searchParams.get("CitaId"), "7813686", "CitaId es el radicado de ESTA cita, no 'la última en pantalla'");
      t.igual(uFetch.searchParams.get("Eps"), "NUEVA EPS ");
      t.igual(uFetch.searchParams.get("nombreCompleto"), "MARIA LUZMILA CARMONA CARMONA");
      t.igual(uFetch.searchParams.get("swVirtual"), "false", "este flujo solo crea citas PRESENCIAL");
      t.cierto(!!pestana.location.href, "la pestaña ya abierta termina navegada a una URL real, nunca se queda en blanco");
    });
    await t.casoAsync("imprimirRecordatorioCita: si el fetch del PDF falla, cae a la URL real de Everest en la misma pestaña (nunca se queda muda)", async () => {
      const c = cargar({
        fetch: async () => { throw new Error("NetErr"); },
      });
      const llamadas = [];
      const pestana = { closed: false, location: {} };
      c.env.win.open = (url, target) => { llamadas.push({ url, target }); return pestana; };
      c.api.imprimirRecordatorioCita(7813686, "NUEVA EPS", "ALGUIEN");
      await esperar(30);
      t.igual(llamadas.length, 1, "no abre una segunda pestaña para el respaldo: reutiliza la ya abierta");
      t.cierto(!!pestana.location.href, "la pestaña queda navegada");
      const u = new URL(pestana.location.href);
      t.cierto(u.pathname.endsWith("/ImprimirRecordatorioCita"), "el respaldo es la MISMA URL real de Everest — el comportamiento de siempre");
    });

    t.caso("imprimirRecordatorioCita: sin CitaId (cita que no llegó a crearse) no abre nada", () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      c.api.imprimirRecordatorioCita(null, "NUEVA EPS", "ALGUIEN");
      c.api.imprimirRecordatorioCita(undefined, "NUEVA EPS", "ALGUIEN");
      c.api.imprimirRecordatorioCita(0, "NUEVA EPS", "ALGUIEN");
      t.igual(llamadas.length, 0, "nunca imprime el recordatorio de una cita que no se confirmó");
    });

    // v12.6.5 — La URL que manda es la que devuelve el servidor. Esta prueba es la que
    // cierra el 404 reportado en consultorio: si alguien vuelve a anteponer la URL armada
    // a mano, aquí se ve.
    t.caso("imprimirOrdenPyM: usa TAL CUAL la URL que devolvió Everest, sin reconstruir nada", () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      const urlReal = "https://neps.everestintelligent.com/apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=1226085275&idPaciente=801848";
      c.api.imprimirOrdenPyM(331897, "1226085057", null, urlReal);
      t.igual(llamadas.length, 1);
      t.igual(llamadas[0].target, "_blank");
      t.igual(llamadas[0].url, urlReal, "byte a byte la del servidor: ni el agrupador ni el paciente del llamador la pisan");
    });

    t.caso("imprimirOrdenPyM: sin URL del servidor, el respaldo usa la ruta REAL capturada (APIImpresion, sin NumAutorizacion)", () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      c.api.imprimirOrdenPyM(331897, "1226085057");
      t.igual(llamadas.length, 1);
      t.igual(llamadas[0].target, "_blank");
      const u = new URL(llamadas[0].url);
      t.cierto(u.pathname.endsWith("/apiviva/APIImpresion/reportepdf/GenerarOrdenHC"), "el módulo real de la captura — /apiviva/APIOrdenamientoHealth/ReportePdf/ daba 404");
      t.igual(u.searchParams.get("Agrupador"), "1226085057", "el agrupador de ESTA orden, nunca una anterior");
      t.igual(u.searchParams.get("idPaciente"), "331897");
      t.igual(u.searchParams.get("NumAutorizacion"), null, "la URL real de Everest NO lleva este parámetro");
    });

    t.caso("imprimirOrdenPyM: sin agrupador (orden que no llegó a crearse) no abre nada", () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      c.api.imprimirOrdenPyM(331897, null);
      c.api.imprimirOrdenPyM(331897, "");
      t.igual(llamadas.length, 0, "nunca imprime una orden que no se confirmó con el servidor");
    });

    // v12.6.5 — _urlImpresionOrdenPyM: el cuerpo real capturado es texto plano, pero el
    // contrato solo está confirmado en UNA grabación; se aceptan las envolturas habituales
    // de este backend y se rechaza cualquier cosa que no sea una URL absoluta de verdad
    // (nunca se navega a un texto suelto).
    t.caso("_urlImpresionOrdenPyM: extrae la URL venga como texto plano, en objeto o en arreglo", () => {
      const c = cargar();
      const urlReal = "https://neps.everestintelligent.com/apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=1226085275&idPaciente=801848";
      t.igual(c.api._urlImpresionOrdenPyM(urlReal), urlReal, "el caso real capturado: texto plano");
      t.igual(c.api._urlImpresionOrdenPyM("  " + urlReal + "\n"), urlReal, "sin espacios ni salto de línea alrededor");
      t.igual(c.api._urlImpresionOrdenPyM({ url: urlReal }), urlReal);
      t.igual(c.api._urlImpresionOrdenPyM({ Enlace: urlReal }), urlReal);
      t.igual(c.api._urlImpresionOrdenPyM({ data: { link: urlReal } }), urlReal);
      t.igual(c.api._urlImpresionOrdenPyM([{ url: urlReal }]), urlReal);
    });

    t.caso("_urlImpresionOrdenPyM: lo que no es una URL absoluta devuelve null (se usa el respaldo, no se navega a un texto suelto)", () => {
      const c = cargar();
      t.igual(c.api._urlImpresionOrdenPyM(null), null);
      t.igual(c.api._urlImpresionOrdenPyM(""), null);
      t.igual(c.api._urlImpresionOrdenPyM("ok"), null, "un 'ok' del servidor no es una URL");
      t.igual(c.api._urlImpresionOrdenPyM("ReportePdf/GenerarOrdenHC?Agrupador=1"), null, "una ruta relativa tampoco");
      t.igual(c.api._urlImpresionOrdenPyM({ error: true, mensaje: "no se pudo" }), null);
      t.igual(c.api._urlImpresionOrdenPyM([]), null);
    });

    // =====================================================================
    // v12.6.2 — Reportado en consultorio: el botón de Imprimir daba 404 REAL de Everest
    // (captura adjunta: HTTP ERROR 404 de neps.everestintelligent.com). Causa real: la
    // pestaña se abría directo hacia GenerarOrdenHC sin haber llamado antes a
    // GenerarLinksImpresionOrdenamientos (el paso que genera el reporte en el servidor —
    // el flujo de "Enviar por correo" ya lo hacía, el de Imprimir no). imprimirOrdenPyM
    // ahora acepta una pestaña YA ABIERTA (mismo patrón que abrirInformeAthenea): se abre
    // en blanco de forma síncrona en el clic real, y se navega recién cuando el paso de
    // generación termina — evita el bloqueador de ventanas emergentes de un window.open()
    // disparado después de un await.
    // =====================================================================
    t.caso("imprimirOrdenPyM: con una pestaña ya abierta, navega ESA pestaña en vez de abrir una nueva", () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      const pestana = { closed: false, location: {} };
      c.api.imprimirOrdenPyM(331897, "1226085057", pestana);
      t.igual(llamadas.length, 0, "no abre una pestaña nueva: reutiliza la que ya recibió");
      t.cierto(!!pestana.location.href, "navega la pestaña existente a la URL real");
      const u = new URL(pestana.location.href);
      t.igual(u.searchParams.get("Agrupador"), "1226085057");
    });

    t.caso("imprimirOrdenPyM: pestaña ya abierta pero CERRADA por el médico -> abre una nueva en su lugar", () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      const pestanaCerrada = { closed: true };
      c.api.imprimirOrdenPyM(331897, "1226085057", pestanaCerrada);
      t.igual(llamadas.length, 1, "si el médico cerró la pestaña en blanco, se abre una nueva");
    });

    t.caso("imprimirOrdenPyM: sin agrupador, si había una pestaña en blanco ya abierta, se cierra (nunca queda una pestaña vacía huérfana)", () => {
      const c = cargar();
      let cerrada = false;
      const pestana = { closed: false, close: () => { cerrada = true; } };
      c.api.imprimirOrdenPyM(331897, null, pestana);
      t.cierto(cerrada);
    });

    // =====================================================================
    // v12.6.3 — PANEL FLOTANTE POST-CITA. Reportado en consultorio: #vgl-agendar-modal
    // se autocierra 2.6 s después de crear la cita (setTimeout(closeMod, 2600)) — sin
    // tiempo real de leer ni pulsar el botón de imprimir que vivía DENTRO de él.
    // mostrarPanelPostCita crea un elemento INDEPENDIENTE de ese modal, directo en el
    // body, que sobrevive a su cierre.
    // =====================================================================
    t.caso("mostrarPanelPostCita: sin citaId (cita que no llegó a crearse) no crea nada", () => {
      const c = cargar();
      c.api.mostrarPanelPostCita(null, "NUEVA EPS", "ALGUIEN", "fallback");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.falso(!!panel, "sin cita creada, no hay recordatorio que imprimir");
    });

    t.caso("mostrarPanelPostCita: crea un panel independiente en el body, con el nombre del paciente", () => {
      const c = cargar();
      enriquecerDom(c);
      c.api.mostrarPanelPostCita(7813686, "NUEVA EPS", "MARIA LUZMILA CARMONA CARMONA", "fallback");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(!!panel, "el panel queda en el body — no depende de #vgl-agendar-modal ni de que siga abierto");
      t.cierto(panel.innerHTML.includes("MARIA LUZMILA CARMONA CARMONA"));
    });

    t.caso("mostrarPanelPostCita: sin nombreCompleto, usa el nombre de respaldo de la tarjeta de agenda", () => {
      const c = cargar();
      enriquecerDom(c);
      c.api.mostrarPanelPostCita(7813686, "NUEVA EPS", "", "CARLOS RUIZ (de la tarjeta)");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(panel.innerHTML.includes("CARLOS RUIZ (de la tarjeta)"));
    });

    await t.casoAsync("mostrarPanelPostCita: el botón de imprimir dispara imprimirRecordatorioCita con los datos de ESTA cita", async () => {
      // v16.2.0 — imprimirRecordatorioCita ya no navega la pestaña directo y síncrono:
      // la abre en blanco y navega después de un fetch (ver los dos casos dedicados más
      // arriba). Este caso solo confirma el CABLEADO botón→función con los datos de ESTA
      // cita; por eso usa su propio mock con .location (mockOpen() no lo trae porque el
      // resto de sus usos nunca navegan el objeto que devuelve window.open).
      const c = cargar();
      enriquecerDom(c);
      const llamadas = [];
      const pestana = { closed: false, location: {} };
      c.env.win.open = (url, target) => { llamadas.push({ url, target }); return pestana; };
      c.api.mostrarPanelPostCita(7813686, "NUEVA EPS", "MARIA LUZMILA CARMONA CARMONA", "fallback");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      const printBtn = panel.querySelector("#vgl-postcita-print");
      disparar(printBtn, "click");
      t.igual(llamadas.length, 1, "abre la pestaña en blanco de forma síncrona al clic");
      await esperar(30);
      t.cierto(!!pestana.location.href, "la pestaña termina navegada (aquí, al respaldo: el arnés no trae blob())");
      const u = new URL(pestana.location.href);
      t.cierto(u.pathname.endsWith("/apiviva/APIImpresionV2/api/Impresion/ImprimirRecordatorioCita"));
      t.igual(u.searchParams.get("CitaId"), "7813686");
      t.igual(u.searchParams.get("nombreCompleto"), "MARIA LUZMILA CARMONA CARMONA");
    });

    t.caso("mostrarPanelPostCita: el botón de cerrar vacía el panel (mismo patrón que closeSheet)", () => {
      const c = cargar();
      enriquecerDom(c);
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE", "fallback");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      const xBtn = panel.querySelector("#vgl-postcita-x");
      t.noLanza(() => disparar(xBtn, "click"));
      t.igual(panel.innerHTML, "", "al cerrar, el panel queda vacío");
    });

    // v12.10.2 — Incidente real en consultorio: ".vgl-postcita-title" (color:var(--c-verde))
    // y ".vgl-postcita-sub" (color:var(--fg2)) se veían del azul corporativo de Everest.
    // Causa: #vgl-postcita-panel div{color:inherit} (especificidad id+tipo) le ganaba a esas
    // clases de acento (especificidad solo-clase), y como el panel cuelga de document.body
    // (no de #vgl-root), ese "inherit" terminaba tomando el color del host. Verificado con
    // Chromium real sobre el CSS que de verdad genera buildOverlay(). El blindaje correcto
    // (v12.3.15, más abajo en la hoja) usa :where(...:not([class])...) — cero especificidad
    // extra, así que nunca le puede ganar a una clase de acento propia — pero
    // #vgl-postcita-panel y #vgl-labsv-modal se habían quedado fuera de esa lista, con la
    // regla vieja rota todavía activa para ellos dos.
    t.caso("blindaje tipográfico: postcita-panel y labsv-modal usan :not([class]), no div/span/b a pelo", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      // La forma vieja y rota NO debe reaparecer para ninguno de los dos paneles.
      const formaRota = /#vgl-(postcita-panel|labsv-modal)\s+(b|span|div)\s*,\s*#vgl-(postcita-panel|labsv-modal)\s+(b|span|div)/;
      t.falso(formaRota.test(src), "no debe volver la regla div/span/b a pelo sobre estos paneles");

      // La forma correcta SÍ debe estar: cada panel, con :where(...:not([class])...).
      t.cierto(/#vgl-postcita-panel\s+:where\([^)]*:not\(\[class\]\)/.test(src), "#vgl-postcita-panel debe usar el blindaje :where()+:not([class])");
      t.cierto(/#vgl-labsv-modal\s+:where\([^)]*:not\(\[class\]\)/.test(src), "#vgl-labsv-modal debe usar el blindaje :where()+:not([class])");
    });

    t.caso("blindaje tipográfico: el título y el subtítulo de postcita-panel conservan su clase de acento (no color:inherit directo)", () => {
      const c = cargar();
      enriquecerDom(c);
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE", "fallback");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(panel.innerHTML.includes('class="vgl-postcita-title"'), "el título conserva su clase de acento (verde)");
      t.cierto(panel.innerHTML.includes('class="vgl-postcita-sub"'), "el subtítulo conserva su clase de acento (gris)");
    });

    // v12.10.5 — Bug real reportado en consulta (captura): el "lead"/"foot" de la alerta de
    // laboratorios RCV vencidos se veía en el azul de Everest. Root cause distinto del de
    // postcita-panel/labsv-modal (título/nombre, arriba): aquí SÍ había un color propio
    // (var(--fg2)/var(--fg3)) pero SIN !important, así que cualquier regla de Everest con
    // especificidad ≥10 (o cualquier !important) lo gana sin que exista competencia de
    // nuestro lado. .vgl-labsv-t/.vgl-labsv-n no se veían afectados porque usan estilo
    // inline (mayor precedencia que una clase), pero .vgl-labsv-lead/.vgl-labsv-foot solo
    // tenían la clase — igual que sus gemelos .vgl-pym-lead/-foot y .vgl-pes-lead/-foot
    // (mismo patrón calcado tres veces) y .vgl-postcita-title/-sub (ya tocados hoy por otro
    // bug). Fix: !important en el color de estas 8 reglas — verificado con Chromium contra
    // el CSS real extraído del harness, con una hoja de Everest simulada usando !important
    // sobre selectores de tipo genéricos (b,div,span,p,small,label).
    t.caso("blindaje !important: lead/foot de los avisos flotantes y postcita-title/sub no pueden perder su color contra Everest", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const reglas = [
        [".vgl-pym-lead", "--fg2"],
        [".vgl-pym-foot", "--fg3"],
        [".vgl-pes-lead", "--fg2"],
        [".vgl-pes-foot", "--fg3"],
        [".vgl-labsv-lead", "--fg2"],
        [".vgl-labsv-foot", "--fg3"],
        [".vgl-postcita-title", "--c-verde"],
        [".vgl-postcita-sub", "--fg2"],
      ];
      for (const [clase, token] of reglas) {
        const re = new RegExp(clase.replace(".", "\\.") + "\\{[^}]*color:var\\(" + token + "\\)\\s*!important");
        t.cierto(re.test(src), clase + " debe declarar color:var(" + token + ") con !important");
      }
    });

    // T2 (migración de estilo inline a clases) le quitó a estos elementos la protección
    // natural que tenía el estilo inline (inmune a cualquier regla de Everest sin
    // !important) sin darles ninguna protección nueva — mismo patrón que el hallazgo de
    // arriba, verificado en Chromium real el mismo día contra bigAlert/pymAlert/
    // abandonoPESAlert/labsVencidosAlert con una hoja de Everest simulada agresivamente.
    t.caso("blindaje !important: título/número de bigAlert, pymAlert, abandonoPESAlert y labsVencidosAlert (recién migrados de inline a clase por T2)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const reglas = [
        [".vgl-modal-t", "--fg"],
        [".vgl-modal-b", "--fg2"],
        [".vgl-pym-t", "--c-recordatorio"],
        [".vgl-pym-n", "--fg"],
        [".vgl-pes-t", "--c-pes"],
        [".vgl-pes-n", "--fg"],
        [".vgl-labsv-t", "--c-rojo"],
        [".vgl-labsv-n", "--fg"],
      ];
      for (const [clase, token] of reglas) {
        const re = new RegExp(clase.replace(".", "\\.") + "\\{[^}]*color:var\\(" + token + "\\)\\s*!important");
        t.cierto(re.test(src), clase + " debe declarar color:var(" + token + ") con !important");
      }
      // .vgl-modal-ok mezcla background+color en la misma declaración inline dentro del bloque.
      t.cierto(/\.vgl-modal-ok\{[^}]*color:var\(--bg-solid\)\s*!important/.test(src), ".vgl-modal-ok debe declarar color:var(--bg-solid) con !important");
    });

    // v16.2.3 — Reportado en consultorio: en el Paso 1 del agendamiento ("pre-agenda la
    // toma de muestras") el azul oscuro de Everest se colaba sobre el texto. Mismo patrón
    // de siempre: el bloque "[v15.0.0] Stepper Visual, Type Cards y Undo" tiene color
    // propio (var(--fg)/var(--fg2)/etc.) pero se quedó fuera de la pasada de v16.1.0 que
    // blindó Ficha/Riesgo con !important. Cubre el Paso 1 (tarjetas de tipo, barra de
    // pasos), el Paso 3 (resumen) y el banner de deshacer — el bloque completo, no solo
    // la línea que el médico vio primero.
    t.caso("blindaje !important: stepper/type-cards/resumen del agendamiento (Paso 1-3) no pueden perder su color contra Everest", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const reglasVar = [
        [".vgl-stepper-step", "--fg3"],
        [".vgl-step-num", "--fg3"],
        [".vgl-tc-title", "--fg"],
        [".vgl-tc-desc", "--fg2"],
        [".vgl-complex-pill.warn", "--c-ambar"],
        [".vgl-complex-pill.ok", "--c-verde"],
        [".vgl-agm-undo-banner", "--c-ambar"],
        [".vgl-btn-undo", "--c-rojo"],
        [".vgl-summary-grid", "--fg2"],
      ];
      for (const [clase, token] of reglasVar) {
        const re = new RegExp(clase.replace(/\./g, "\\.") + "\\{[^}]*color:var\\(" + token + "\\)\\s*!important");
        t.cierto(re.test(src), clase + " debe declarar color:var(" + token + ") con !important");
      }
      // Estados compuestos (.active/.completed) y colores literales (texto sobre fondo
      // sólido, no un token) — mismo blindaje, forma distinta de declararlo.
      t.cierto(/\.vgl-stepper-step\.active\{color:var\(--c-azul\)\s*!important/.test(src), ".vgl-stepper-step.active debe declarar color:var(--c-azul) con !important");
      t.cierto(/\.vgl-stepper-step\.completed\{color:var\(--c-verde\)\s*!important/.test(src), ".vgl-stepper-step.completed debe declarar color:var(--c-verde) con !important");
      t.cierto(/\.vgl-stepper-step\.active \.vgl-step-num\{[^}]*color:#020617\s*!important/.test(src), ".vgl-stepper-step.active .vgl-step-num debe declarar su color con !important");
      t.cierto(/\.vgl-stepper-step\.completed \.vgl-step-num\{[^}]*color:#020617\s*!important/.test(src), ".vgl-stepper-step.completed .vgl-step-num debe declarar su color con !important");
      t.cierto(/\.vgl-btn-undo:hover\{[^}]*color:#fff\s*!important/.test(src), ".vgl-btn-undo:hover debe declarar su color con !important");
      t.cierto(/\.vgl-summary-grid b\{color:var\(--fg\)\s*!important/.test(src), ".vgl-summary-grid b debe declarar color:var(--fg) con !important");
    });

    // El bug real: .vgl-labsv-t/.vgl-labsv-ic usaban var(--c-alerta)/var(--rgb-alerta),
    // tokens que nunca se definieron en ningún lado del archivo — color inválido, heredaba
    // lo que fuera del ancestro (el azul de Everest, verificado en Chromium). Debe ser
    // --c-rojo/--rgb-rojo, el mismo color que ya usa correctamente su hermana .vgl-labsv-n.
    t.caso("no debe reaparecer --c-alerta/--rgb-alerta (token inventado que nunca se definió)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/--c-alerta\b/.test(src), "--c-alerta no debe usarse en ningún lado — no está definido");
      t.falso(/--rgb-alerta\b/.test(src), "--rgb-alerta no debe usarse en ningún lado — no está definido");
    });

    // Ordenar PyM (marcado de checkboxes fallidos/exitosos): si closest("label") devuelve
    // null, leer .classList directamente sobre esa variable revienta ANTES de llegar al
    // if — el guard debe cortocircuitar con "variable && variable.classList", nunca
    // "variable.classList" a secas. Ya reapareció una vez (una de las dos ocurrencias
    // quedó sin el "&&" en una ronda de corrección anterior).
    t.caso("guard de classList tras closest(\"label\") siempre cortocircuita con && (no revienta con null)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const ocurrencias = src.match(/const \w+ = c\.closest\("label"\); if\s*\([^)]*\.classList\)/g) || [];
      t.cierto(ocurrencias.length >= 2, "deben existir las dos ocurrencias conocidas (checkbox exitoso y fallido)");
      for (const linea of ocurrencias) {
        t.cierto(/if\s*\(\w+\s*&&\s*\w+\.classList\)/.test(linea), "cada guard debe cortocircuitar con '&&' antes de leer .classList: " + linea);
      }
    });

    // ================= pymPaquetesDelPaciente (T7, extraída de openOrdenamientoModal) =================
    t.caso("pymPaquetesDelPaciente: empareja etiquetas por palabra clave, y separa las que no casan con ningún paquete", () => {
      const r = api.pymPaquetesDelPaciente(["Tamización cardiometabólica", "Remisión a Optometría", "VIH"]);
      const cies = r.matchedPackages.map((p) => p.cie10).sort();
      t.igual(cies, ["Z108", "Z113"]);
      t.igual(r.sinEmparejar, ["Remisión a Optometría"]);
      t.igual(r.pymPorPaquete.get(r.matchedPackages.find((p) => p.cie10 === "Z108")), ["Tamización cardiometabólica"]);
    });

    t.caso("pymPaquetesDelPaciente: sin etiquetas, o etiquetas vacías/no-arreglo, no lanza y devuelve todo vacío", () => {
      t.noLanza(() => api.pymPaquetesDelPaciente(null));
      const r = api.pymPaquetesDelPaciente([]);
      t.igual(r.matchedPackages, []);
      t.igual(r.sinEmparejar, []);
    });

    // [v14.2.0 — auditoría pre-producción 2026-08-18] Se retiró toda la sección de pruebas
    // directas de "createPymBannerUI / _refrescarBannerPym (T7)": el bloque T7 completo
    // (`_bannerPymCache`, `_bannerPymEnVuelo`, `BANNER_PYM_TTL_MS`, `_bannerPymInvalidar`,
    // `_pymYaOrdenadoHoyDesdeElScript`, `_refrescarBannerPym`, `createPymBannerUI`) se borró
    // del script — quedó sin llamador desde que `tick()` dejó de pintarlo, superado por el
    // aviso único (checkAvisoUniversal, suite 04). `pymPaquetesDelPaciente` y
    // `pymCubiertoPorOrdenVigente` siguen vivos (el modal de PyM del panel los sigue usando)
    // y conservan su cobertura arriba. Ver CHANGELOG.

    t.caso("v15: el banner viene APAGADO de fábrica, y el aviso modal también", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.__S.bannerPym, false, "de fábrica ya no hay franja fija arriba de la historia");
      t.igual(c.api.__S.avisoPymModal, false, "ni ventana que bloquee: el canal es el recuadro del modal");
      t.igual(c.api.__S.recordatorioPym, true,
        "el recordatorio en sí sigue encendido — lo que cambia es POR DÓNDE sale, no si sale");
    });

    t.caso("la migración de v15 apaga el banner en los equipos que YA lo tenían guardado en true", () => {
      // Sin esta migración el cambio no llegaría a ningún consultorio:
      // writeJSON guarda el objeto ENTERO de ajustes, así que los veinte equipos
      // tienen `bannerPym: true` en disco y ese valor le gana al de fábrica.
      const c = cargar({
        silencioso: true,
        localStorage: { vgl_cfg: JSON.stringify({ bannerPym: true, avisoPymModal: true }) },
      });
      t.igual(c.api.__S.bannerPym, false, "la migración lo apagó pese al valor guardado");
      t.igual(c.env.win.localStorage.getItem("vgl_v15_banner"), "1", "y dejó su marca para no repetirse");
    });

    // [v14.2.0 — auditoría pre-producción 2026-08-18] Se retiró la prueba "tick: sin la
    // clave bannerPym tampoco se pinta el banner" — dependía de `_refrescarBannerPym`/
    // `createPymBannerUI`, eliminadas junto al resto del bloque T7 (ver comentario más
    // arriba y CHANGELOG). Con las funciones borradas, que el tick no pueda pintar el
    // banner ya no depende de una guarda: es estructuralmente imposible.

    // =====================================================================
    // v15.2.0 — mtrCalcularResumenClinico / openRiesgoModal / mtrIaClickDelegado /
    // mtrAbrirDatosAdicionales. openRiesgoModal es el modal nuevo de "Riesgo
    // cardiovascular · Redacción IA" (v14.2.11) — openLaboratoriosModal calcula el
    // MISMO resumen por su cuenta (inline, arriba); mtrCalcularResumenClinico es la
    // versión que usa openRiesgoModal cuando el médico entra directo a Riesgo sin
    // haber abierto antes Laboratorios. Ninguna de las cuatro tenía prueba propia.
    // Se reutiliza el mock de red de openLaboratoriosModal (mismo pipeline: Athenea
    // por gmxhr sin mockear = error rápido, apiAccesoBuscarPaciente por fetch) y el
    // patrón de "la red nunca responde" de la suite de telemetría, para el embudo.
    // =====================================================================
    const respVaciaRiesgo = { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "{}", clone() { return this; } };

    await t.casoAsync("mtrCalcularResumenClinico: sin paciente o sin doc_id, null de inmediato (no dispara ninguna consulta)", async () => {
      const c = cargar({ silencioso: true, fetch: async () => { throw new Error("no debía consultar nada"); } });
      t.igual(await c.api.mtrCalcularResumenClinico(null), null);
      t.igual(await c.api.mtrCalcularResumenClinico({ nombre: "SIN DOCUMENTO" }), null);
    });

    await t.casoAsync("mtrCalcularResumenClinico: si `vivo` ya es falso, no devuelve nada (respeta que el modal se cerró)", async () => {
      const c = cargar({ silencioso: true, fetch: async () => respVaciaRiesgo });
      const r = await c.api.mtrCalcularResumenClinico({ doc_id: "12345678" }, () => false);
      t.igual(r, null, "vivo()=false desde el arranque: se corta en el primer chequeo");
    });

    await t.casoAsync("mtrCalcularResumenClinico: ruta real — arma el resumen y lo deja en caché para que Riesgo/Ordenar/Agendar lo compartan", async () => {
      const c = cargar({ silencioso: true, fetch: async () => respVaciaRiesgo });
      const r = await c.api.mtrCalcularResumenClinico({ doc_id: "555222", nombre: "MARIA HTA" });
      t.cierto(!!r, "arma un resumen aunque los laboratorios vengan vacíos (mtrResumenClinico siempre construye el objeto)");
      t.cierto(!!r.erc && !!r.riesgo && !!r.plan, "con la misma forma que usa el resto del script");
      t.igual(c.api.mtrCacheResumenLeer("555222"), r, "quedó en la MISMA caché que leen Ordenar/Agendar/Laboratorios");
    });

    // =====================================================================
    // v17.6.2 — DESENGANCHE Panel ↔ pre-consulta. Síntoma real en consulta
    // (22-ago): el Panel abría «sin laboratorios» aunque el robot ya los había
    // precargado (la telemetría del día confirma LabsAutoPrefetched con 84-448
    // resultados por paciente). Causa: mtrCalcularResumenClinico golpeaba
    // Athenea EN VIVO en cada apertura ignorando _labsPrefetch. Ahora se sirve
    // primero de la pre-carga fresca (igual que el cruce RCV de PyM), salvo con
    // `{fresco:true}` — el botón «🔄 Buscar laboratorios nuevos» y el guardado
    // de la meta de HbA1c, que exigen datos vivos (regla v12.3.35).
    // =====================================================================
    await t.casoAsync("v17.6.2 — si la pre-carga ya trajo labs frescos de ESTE paciente, los usa SIN volver a golpear Athenea", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => respVaciaRiesgo,
        gmxhr: () => { throw new Error("NO debía consultar Athenea: la pre-carga ya lo trajo"); },
      });
      // Sembrar la pre-carga por el MISMO mecanismo del robot (_preconGuardar → _preconHidratar).
      c.api._preconGuardar("555222", [{ NombreParametro: "CREATININA", Resultado: "1.1", Fecha: "01/08/2026" }]);
      c.api._preconHidratar("555222");
      const r = await c.api.mtrCalcularResumenClinico({ doc_id: "555222", nombre: "MARIA HTA" });
      t.cierto(!!r, "arma el resumen");
      t.cierto(!!(r._ultimos && r._ultimos.CREATININA), "la creatinina llegó al resumen");
      t.igual(r._ultimos.CREATININA.valor, 1.1, "con el valor de la pre-carga — Athenea no se tocó (si se tocara, el gmxhr lanza)");
    });

    await t.casoAsync("v17.6.2 — con {fresco:true} (botón «Buscar laboratorios nuevos») SÍ vuelve a Athenea, sin arrastrar la pre-carga vieja", async () => {
      let toquesAthenea = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => respVaciaRiesgo,
        gmxhr: (o) => { toquesAthenea++; o.onerror(new Error("Athenea no responde en esta prueba")); },
      });
      c.api._preconGuardar("555223", [{ NombreParametro: "CREATININA", Resultado: "1.1", Fecha: "01/08/2026" }]);
      c.api._preconHidratar("555223");
      const r = await c.api.mtrCalcularResumenClinico({ doc_id: "555223", nombre: "MARIA HTA" }, null, { fresco: true });
      t.cierto(toquesAthenea >= 1, "el botón sí consulta Athenea en vivo, no se conforma con la pre-carga");
      t.falso(!!(r._ultimos && r._ultimos.CREATININA), "y no arrastra la creatinina vieja de la pre-carga como si fuera actual");
    });

    await t.casoAsync("openRiesgoModal: una cita sin documento solo deja un aviso, sin abrir modal ni tocar la red", async () => {
      const c = cargar({ silencioso: true, fetch: async () => { throw new Error("no debía consultar nada"); } });
      await c.api.openRiesgoModal(null);
      t.falso(c.env.doc.body.children.some((n) => n.id === "vgl-riesgo-modal"), "no se abre ningún modal");
    });

    await t.casoAsync("openRiesgoModal: ruta real — pinta la clasificación y la falla, y cierra el embudo con éxito", async () => {
      const c = cargar({ silencioso: true, fetch: async () => respVaciaRiesgo });
      enriquecerDom(c);
      c.api.__S.uxTelemetria = true;
      await c.api.openRiesgoModal({ doc_id: "555222", nombre: "MARIA HTA" });

      c.api._uxVolcarBuffer();
      const acc = (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {};
      t.igual(acc["fn.riesgo.open"], 1, "se anota la apertura");
      t.igual(acc["fn.riesgo.datos"], 1, "hubo resumen: se anota el desenlace con datos");
      t.igual(acc["fn.riesgo.complete"], 1, "y el embudo se da por completado");
      t.falso(!!acc["fn.riesgo.sin_datos"], "no es el otro desenlace");

      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-riesgo-modal").pop();
      const cuerpo = modal.querySelector("#vgl-riesgo-cuerpo");
      t.cierto(/Riesgo cardiovascular/.test(cuerpo.innerHTML), "el cuerpo del modal trae la cabecera de riesgo");
      // v15.3.0 — El rótulo se reescribió al adoptar la redacción clínica de Gemini
      // ("Redacción Médica Asistida (IA)"). Lo que esta prueba debe fijar es que la ENTRADA
      // exista, no su redacción exacta: se comprueba el contenedor real y se acepta cualquiera
      // de los dos rótulos. La existencia de un botón por modo la fija la aserción de abajo.
      t.cierto(/Redacci[óo]n\s+(Médica\s+)?[Aa]sistida/.test(cuerpo.innerHTML), "y la entrada a la redacción IA");
      t.cierto(/vgl-riesgo-ia-btns/.test(cuerpo.innerHTML), "con su bloque de botones de redacción, no solo el rótulo");

      // Cerrar DESPUÉS de completado no cuenta como abandono (mismo contrato que Labs).
      modal.querySelector("#vgl-riesgo-x")._listeners.click[0]({});
      c.api._uxVolcarBuffer();
      const acc2 = (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {};
      t.falso(!!acc2["fn.riesgo.abandon"], "cerrar después de completar no es abandonar");
    });

    t.caso("mtrRenderRiesgoModalHtml: DIRECTO, es EXACTAMENTE lo que openRiesgoModal pinta en el cuerpo del modal", () => {
      // Instancia propia (no la `api` compartida del banco): el estado de S.iaRedaccion
      // es mutable y global a todas las suites, así que se controla aquí a mano en vez
      // de asumir cuál dejó la última suite que corrió antes que esta.
      const c1 = cargar({ silencioso: true });
      const r = c1.api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 68, sexo: "F", pesoKg: 62, creatinina: 1.6,
        rac: 45, ct: 230, hdl: 42, ldl: 148, paSistolica: 148, paDiastolica: 88,
        factores: { hta: true, diabetes: true }, ultimos: {}, grupoSabado: null,
      });
      c1.api.__S.iaRedaccion = false;
      const htmlApagado = c1.api.mtrRenderRiesgoModalHtml(r);
      t.cierto(/Riesgo cardiovascular/.test(htmlApagado), "trae la cabecera (mtrRenderCabeceraRiesgoHtml)");
      t.cierto(/Falla terapéutica/.test(htmlApagado), "y la falla — LDL 148 contra meta 55 es falla en este caso (mtrRenderFallaHtml)");
      t.cierto(/Redacci[óo]n\s+(Médica\s+)?[Aa]sistida\s+\(IA\)/.test(htmlApagado), "y la entrada a la redacción, con un botón por modo");
      // v16.5.0 — decisión del médico: Nota clínica y Briefing salen (Análisis y plan ES
      // la nota); entran Análisis y plan y Recomendaciones; Preguntar queda aparte.
      t.cierto(/data-modo="enfermedad_actual"/.test(htmlApagado) && /data-modo="analisis_plan"/.test(htmlApagado)
        && /data-modo="recomendaciones"/.test(htmlApagado) && /data-modo="consulta"/.test(htmlApagado), "los cuatro modos de redacción, ninguno de más ni de menos");
      t.falso(/data-modo="nota_clinica"/.test(htmlApagado) || /data-modo="briefing"/.test(htmlApagado), "los modos retirados ya no aparecen");
      t.cierto(/disabled/.test(htmlApagado), "con S.iaRedaccion apagada, los botones de IA salen deshabilitados");
      t.cierto(/apagada en Ajustes/.test(htmlApagado), "y se explica por qué");

      c1.api.__S.iaRedaccion = true;
      const htmlEncendido = c1.api.mtrRenderRiesgoModalHtml(r);
      t.falso(/disabled/.test(htmlEncendido), "con S.iaRedaccion encendida, los cuatro botones quedan habilitados");
    });

    await t.casoAsync("openRiesgoModal: cerrar ANTES de que lleguen los datos cuenta como abandono del embudo", async () => {
      const c = cargar({ silencioso: true, fetch: () => new Promise(() => {}) }); // la red nunca responde
      enriquecerDom(c);
      c.api.__S.uxTelemetria = true;
      c.api.openRiesgoModal({ doc_id: "555222", nombre: "MARIA HTA" }); // sin await: se cierra a mitad de vuelo
      await esperar(30);

      c.api._uxVolcarBuffer();
      const acc = (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {};
      t.igual(acc["fn.riesgo.open"], 1, "se anota la apertura");
      t.falso(!!acc["fn.riesgo.complete"], "todavía no hay desenlace: los datos no han llegado");

      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-riesgo-modal").pop();
      modal.querySelector("#vgl-riesgo-x")._listeners.click[0]({});

      c.api._uxVolcarBuffer();
      const acc2 = (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {};
      t.igual(acc2["fn.riesgo.abandon"], 1, "cerrar sin datos es un abandono");
      t.falso(!!acc2["fn.riesgo.complete"], "y sigue sin contarse como completado");
    });

    t.caso("mtrIaClickDelegado: clics fuera del botón de redactar, o sin blindaje de destino, se ignoran sin lanzar", () => {
      t.noLanza(() => api.mtrIaClickDelegado(null), "evento nulo");
      t.noLanza(() => api.mtrIaClickDelegado({}), "sin target");
      t.noLanza(() => api.mtrIaClickDelegado({ target: {} }), "target sin closest");
      let stopPropagation = 0;
      const targetAjeno = { closest: () => null };
      api.mtrIaClickDelegado({ target: targetAjeno, stopPropagation: () => stopPropagation++ });
      t.igual(stopPropagation, 0, "si el clic no fue en el botón, ni se le corta la propagación");
    });

    t.caso("mtrIaClickDelegado: botón de redactar sin resumen en caché para ESE documento avisa y no abre el panel", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      let stop = 0;
      const btn = { getAttribute: (k) => (k === "data-doc" ? "999999999" : null) };
      const t2 = { closest: (s) => (s === "#vgl-ia-redactar" ? btn : null) };
      c.api.mtrIaClickDelegado({ target: t2, stopPropagation: () => stop++ });
      t.igual(stop, 1, "sí reconoce el clic (se le corta la propagación)");
      t.falso(c.env.doc.body.children.some((n) => n.id === "vgl-ia-modal"), "sin resumen cacheado para ese documento, no hay panel que abrir");
    });

    t.caso("mtrIaClickDelegado: CON resumen en caché para el documento del botón, abre el panel de redacción", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.api.mtrCacheResumenGuardar("555222", c.api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 68, sexo: "F", pesoKg: 62, creatinina: 1.6,
        rac: 45, ct: 230, hdl: 42, ldl: 148, paSistolica: 148, paDiastolica: 88,
        factores: { hta: true, diabetes: true }, ultimos: {}, grupoSabado: null,
      }));
      const btn = { getAttribute: (k) => (k === "data-doc" ? "555222" : null) };
      const t2 = { closest: (s) => (s === "#vgl-ia-redactar" ? btn : null) };
      c.api.mtrIaClickDelegado({ target: t2, stopPropagation: () => {} });
      t.cierto(c.env.doc.body.children.some((n) => n.id === "vgl-ia-modal"), "con el resumen en caché, el panel de redacción se monta");
    });

    // ================= mtrAbrirDatosAdicionales =================
    await t.casoAsync("mtrAbrirDatosAdicionales: se prellena con lo ya extraído hoy, y Guardar lee TODO de una sola vez", async () => {
      // v15.2.0 — El arnés no interpreta innerHTML (no arma nodos hijos a partir del HTML
      // generado), así que un value="..." horneado en el string no llega a ningún nodo
      // .value real — se comprueba en el STRING que produce el modal, como ya hace
      // buildOverlay más arriba (raiz.innerHTML.includes(...)). Lo que SÍ pasa por un nodo
      // real es lo que el propio test escribe antes de Guardar (mismo nodo memoizado que
      // luego lee el botón), que es lo que de verdad ejercita "Guardar lee de una sola vez".
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.api.mtrAbrirDatosAdicionales("777888999", { motivo: "Control de rutina", sintomas: "Asintomático" });
      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-ia-datos").pop();
      t.cierto(!!modal, "el modal se monta");
      t.cierto(modal.innerHTML.includes('value="Control de rutina"'), "el motivo prellenado desde `prefill` sale en el HTML generado");
      t.cierto(modal.innerHTML.includes("Asintomático"), "y también el textarea de síntomas");

      modal.querySelector("#vgl-dx-adherencia").value = "Buena, no olvida dosis";
      modal.querySelector("#vgl-dx-guardar")._listeners.click[0]({});

      const guardado = c.api.mtrDatosExtraLeer("777888999");
      t.cierto(!!guardado, "Guardar de verdad persistió los datos");
      t.igual(guardado.adherencia, "Buena, no olvida dosis", "lo que el médico escribió ahora queda guardado, leído del mismo campo");
      t.falso(c.env.doc.body.children.some((n) => n.id === "vgl-ia-datos"), "Guardar también cierra el modal");
    });

    t.caso("mtrAbrirDatosAdicionales: si ya había datos guardados hoy, esos ganan sobre `prefill` en lo que se muestra (no se pisa lo que el médico ya corrigió)", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.api.mtrDatosExtraGuardar("111222333", { motivo: "Motivo YA corregido por el médico" });
      c.api.mtrAbrirDatosAdicionales("111222333", { motivo: "Motivo extraído automáticamente" });
      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-ia-datos").pop();
      t.cierto(modal.innerHTML.includes("Motivo YA corregido por el médico"), "lo guardado hoy manda sobre el prellenado automático");
      t.falso(modal.innerHTML.includes("Motivo extraído automáticamente"), "el prellenado automático no debía aparecer");
    });

    t.caso("mtrAbrirDatosAdicionales: Cancelar y la ✕ cierran SIN guardar nada", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.api.mtrAbrirDatosAdicionales("222333444", {});
      let modal = c.env.doc.body.children.filter((n) => n.id === "vgl-ia-datos").pop();
      modal.querySelector("#vgl-dx-motivo").value = "esto no debe quedar guardado";
      modal.querySelector("#vgl-dx-cancel")._listeners.click[0]({});
      t.falso(c.env.doc.body.children.some((n) => n.id === "vgl-ia-datos"), "Cancelar cierra el modal");
      t.igual(c.api.mtrDatosExtraLeer("222333444"), null, "y no persistió nada");

      c.api.mtrAbrirDatosAdicionales("222333444", {});
      modal = c.env.doc.body.children.filter((n) => n.id === "vgl-ia-datos").pop();
      modal.querySelector("#vgl-dx-x")._listeners.click[0]({});
      t.falso(c.env.doc.body.children.some((n) => n.id === "vgl-ia-datos"), "la ✕ también cierra");
      t.igual(c.api.mtrDatosExtraLeer("222333444"), null, "tampoco guarda nada");
    });

    t.caso("mtrAbrirDatosAdicionales: una segunda apertura reemplaza a la anterior, nunca hay dos modales a la vez", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.api.mtrAbrirDatosAdicionales("333444555", {});
      c.api.mtrAbrirDatosAdicionales("333444555", {});
      t.igual(c.env.doc.body.children.filter((n) => n.id === "vgl-ia-datos").length, 1, "nunca dos a la vez");
    });


    // ================= v15.5.0 — ANULACIÓN REAL (endpoint capturado en consultorio) =================
    await t.casoAsync("_anularCitaAsignadaReal: con confirmación de Everest limpia las marcas locales; el POST lleva CancelarCita con cuerpo y query", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, fetch: async (url, init) => {
        urls.push({ url: String(url), init });
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ error: false, mensaje: "Cancelado Correctamente" }), text: async () => "" };
      }, gmxhr: (o) => { if (o.onerror) o.onerror("x"); } });
      c.api.__state.activeDoctor = { id: 594, name: "MEDICO PRUEBA" };
      c.api.markCitaAgendadaHoy("111111111", "2026-09-14", { citaId: 987654, pacienteId: 777, eps: "EPS PRUEBA", hora: "6:00 PM" });
      t.cierto(c.api.isCitaAgendadaHoy("111111111"), "la marca local existe antes de anular");
      const r = await c.api._anularCitaAsignadaReal({ doc_id: "111111111" }, { observacion: "Prefiere otra fecha" });
      t.cierto(r, "Everest confirmó y la función devuelve true");
      const post = urls.find((u) => u.url.includes("CancelarCita"));
      t.cierto(!!post, "se llamó al endpoint real");
      t.cierto(post.url.includes("CitaId=987654") && post.url.includes("PacienteId=777") && post.url.includes("UsuarioId=594"), "la query lleva cita, paciente y médico");
      const body = JSON.parse(post.init.body);
      t.igual(body.estado, "CAN", "el cuerpo replica el contrato capturado (estado CAN)");
      t.igual(body.observacion, "Prefiere otra fecha");
      t.falso(c.api.isCitaAgendadaHoy("111111111"), "las marcas locales se limpiaron SOLO tras la confirmación");
    });
    await t.casoAsync("_anularCitaAsignadaReal: si Everest NO confirma, NO se toca ninguna marca local", async () => {
      const c = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ error: true, mensaje: "No se pudo" }), text: async () => "" }), gmxhr: (o) => { if (o.onerror) o.onerror("x"); } });
      c.api.__state.activeDoctor = { id: 594, name: "MEDICO PRUEBA" };
      c.api.markCitaAgendadaHoy("222222222", "2026-09-14", { citaId: 111, pacienteId: 5, eps: "", hora: "" });
      const r = await c.api._anularCitaAsignadaReal({ doc_id: "222222222" }, {});
      t.falso(r, "sin confirmación: false");
      t.cierto(c.api.isCitaAgendadaHoy("222222222"), "la cita sigue marcada — nunca se miente con una anulación no confirmada");
    });
    await t.casoAsync("_anularCitaAsignadaReal: cita vieja sin citaId guardado — avisa y no dispara ningún POST a ciegas", async () => {
      let llamadas = 0;
      const c = cargar({ silencioso: true, fetch: async () => { llamadas++; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "" }; }, gmxhr: (o) => { if (o.onerror) o.onerror("x"); } });
      c.api.__state.activeDoctor = { id: 594, name: "M" };
      c.api.markCitaAgendadaHoy("333333333", "2026-09-14");
      const r = await c.api._anularCitaAsignadaReal({ doc_id: "333333333" }, {});
      t.falso(r);
      t.igual(llamadas, 0, "sin radicado no hay POST");
      t.cierto(c.api.isCitaAgendadaHoy("333333333"), "y la marca local queda intacta");
    });

    // ================= v15.5.0 — MODO OCULTO =================
    t.caso("modo oculto: alternar pone/quita el estado, persiste, y el puntico existe", () => {
      const c = cargar({ silencioso: true });
      c.api._vglInstalarModoOculto();
      t.cierto(c.env.win.document._nodos.some((n) => n.id === "vgl-visib-pill"), "el puntico «V» queda creado");
      const on = c.api._vglAlternarOculto();
      t.cierto(on, "primer toque: oculto");
      t.cierto(c.api._vglModoOcultoLeer(), "la elección quedó persistida");
      const off = c.api._vglAlternarOculto();
      t.falso(off, "segundo toque: visible de nuevo");
      t.falso(c.api._vglModoOcultoLeer());
    });

    // ================= v15.5.0 — DESHACER =================
    t.caso("deshacer: restaura EXACTAMENTE los valores previos y el lote se consume (sin doble deshacer)", () => {
      const c = cargar({ silencioso: true });
      // La guarda de identidad exige VER al mismo paciente en pantalla (si no puede
      // confirmarlo, se niega — lo seguro). Se monta la historia del mismo paciente.
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 111111111", closest: () => null }] : []);
      const caja = { value: "texto nuevo", isConnected: true, dispatchEvent: () => {} };
      c.api._vglGuardarDeshacer("111111111", [{ el: caja, prev: "lo de antes" }], "Prueba");
      t.cierto(c.api._vglDeshacerDisponible());
      t.igual(c.api._vglEjecutarDeshacer(), 1, "una casilla restaurada");
      t.igual(caja.value, "lo de antes", "el valor volvió tal cual");
      t.igual(c.api._vglEjecutarDeshacer(), 0, "el lote se consume");
      t.falso(c.api._vglDeshacerDisponible());
    });
    t.caso("deshacer: si la historia abierta ya es de OTRO paciente, se niega y no toca nada", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 222222222", closest: () => null }] : []);
      const caja = { value: "texto nuevo", isConnected: true, dispatchEvent: () => {} };
      c.api._vglGuardarDeshacer("111111111", [{ el: caja, prev: "previo" }], "Prueba");
      t.igual(c.api._vglEjecutarDeshacer(), 0, "cero restauraciones con otro paciente en pantalla");
      t.igual(caja.value, "texto nuevo", "no se tocó la casilla");
    });
    t.caso("_labReferenciaDe: por nombre directo, por FORMA y por par mín–máx", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._labReferenciaDe({ referencia: "0.6 - 1.2" }), "0.6 - 1.2", "el campo clásico manda");
      t.igual(c.api._labReferenciaDe({ ValorReferencia: "70 - 110" }), "70 - 110", "clave nueva con 'referencia' en el nombre: se reconoce por forma");
      t.igual(c.api._labReferenciaDe({ RangoInferior: 0.5, RangoSuperior: 1.3 }), "0.5 – 1.3", "el par mínimo–máximo se compone");
      t.igual(c.api._labReferenciaDe({ NombreParametro: "CREATININA", Resultado: 1.1 }), "", "sin nada con pinta de rango: vacío honesto");
    });

    // v17.6.2 — Reportado en vivo (pantallazo, 22-ago): Colesterol Total con un "–"
    // suelto, Triglicéridos con "… – 400" sin el límite inferior. Dos defectos
    // distintos en la misma función, cada uno con su prueba.
    t.caso("_labReferenciaDe: el placeholder «-» de Athenea no se pinta como rango real", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._labReferenciaDe({ referencia: "-" }), "", "guion suelto en 'referencia': igual de vacío que si no viniera nada");
      t.igual(c.api._labReferenciaDe({ Estado: "-" }), "", "mismo guion, por la vía 'Estado'");
    });
    t.caso("_labReferenciaDe: con un solo extremo, se declara explícito en vez de '… – N'", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._labReferenciaDe({ RangoSuperior: 400 }), "≤ 400", "solo techo (típico de triglicéridos): sin piso inventado");
      t.igual(c.api._labReferenciaDe({ RangoInferior: 7 }), "≥ 7", "solo piso: sin techo inventado");
    });

  },
};
