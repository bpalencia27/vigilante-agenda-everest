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
    "openLaboratoriosModal", "abrirInformeAthenea", "openAgendamientoModal", "openLabSoloModal", "openOrdenamientoModal", "esMedicoRCVActivo",
    "candidatoAdicional",
    "savePos", "restorePos", "closeSheet", "toggleSheet", "sheetHeader",
    "wireClose", "renderResumen", "copySummary", "renderSettings",
    "paintMute", "repaint", "makeDraggable", "setSummary", "render",
    "refrescarCuentas", "imprimirRecordatorioCita", "imprimirOrdenPyM", "_urlImpresionOrdenPyM",
    "_agruparUroanalisisParaTabla", "mostrarPanelPostCita", "createAccionesDockUI",
    "pymPaquetesDelPaciente", "_mtrCelularMascarado", "mtrHallazgosUroDesdeLabs",
    "vglMinimizarPanel", "vglMinBarra", "_vglMinDescartarDeOtroPaciente",
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
      t.cierto(hoja.innerHTML.includes('vgl-d-none'), "sin el modo programador (_vglProgOn) la sección técnica va oculta — la clave opcionesTecnicas se retiró en v17.6.10");
      t.igual(hoja.querySelector("#c-tema").value, "oscuro", "el selector de tema refleja S.tema");
    });

    // v15.5.0 — La tabla FESTIVOS salió de Ajustes (barrido); v16.9.0 — los festivos se
    // CALCULAN (Ley Emiliani) y el aviso de respaldo ya no mira "hasta qué año está la
    // tabla": compara el algoritmo contra la tabla escrita en los años que ambos cubren.
    // Estos dos casos fijan el contrato nuevo (el aviso con el día exacto, una vez al día);
    // la tabla de Ajustes ya no existe, así que ya no hay HTML que verificar.
    t.caso("festivos v16.9.0: el aviso compara el cálculo contra la tabla; con discrepancia avisa una vez al día", () => {
      const c = cargar({ silencioso: true });
      // Sin tocar la tabla real: agregar un "festivo" inexistente garantiza la discrepancia
      // sin depender de si el año de hoy coincide o no con la tabla escrita a mano.
      t.cierto(c.api._festivosTablaAgregarParaTest("2026-99-99"), "se pudo ensuciar la tabla de prueba");
      t.cierto(c.api._festivosAvisarSiVencida(2026), "discrepancia detectada → el aviso se dispara");
      t.igual(c.env.storage.getItem("vgl_festivos_aviso"), c.api.todayStamp(), "el aviso deja su marca diaria (una vez al día, sin reaviso)");
      t.cierto(c.api._festivosAvisarSiVencida(2026), "marca ya puesta el mismo día: devuelve true sin volver a pintar");
    });

    t.caso("festivos v16.9.0: el mensaje de discrepancia nombra los días exactos de ambos lados", () => {
      const msg = cargar({ silencioso: true }).api._festivosMensajeDiscrepancia(2026, ["2026-01-06"], ["2026-03-19"]);
      t.cierto(msg.includes("2026"), "dice el año de la discrepancia");
      t.cierto(msg.includes("2026-01-06"), "nombra el día que solo tiene la tabla");
      t.cierto(msg.includes("2026-03-19"), "nombra el día que solo calcula el algoritmo");
      t.cierto(msg.includes("confirme cuál es el correcto"), "remite a confirmar antes de agendar en esos días");
    });

    t.caso("renderSettings: cambiar un interruptor va al borrador y solo al Guardar toca S y localStorage", () => {
      const chk = hoja.querySelector("#c-snd");
      chk.checked = false;
      disparar(chk, "change");
      // v15.6.0 — el interruptor no aplica en el acto: pone el borrador («Tiene cambios sin
      // guardar»); S sigue intacto hasta que el médico pulsa Guardar.
      t.igual(cv.api.__S.sonido, true, "S.sonido NO cambia hasta Guardar (flujo de borrador)");
      const n = cv.api._ajustesGuardar();
      t.cierto(n >= 1, "el borrador tenía cambios y Guardar los aplicó");
      t.igual(cv.api.__S.sonido, false, "al guardar, S.sonido quedó apagado");
      const cfg = JSON.parse(cv.env.almacen.vgl_cfg);
      t.igual(cfg.sonido, false, "saveSettings persistió el cambio");
    });

    t.caso("renderSettings: la sección técnica se repinta mostrando el modo programador (v15.6.0)", () => {
      cv.api.closeSheet();
      cv.api.toggleSheet("ajustes");
      t.cierto(hoja.innerHTML.includes("vgl-grp-tec vgl-d-none"), "sin modo programador, la sección técnica va oculta");
      cv.api._vglAlternarModoProg(); // Ctrl+Shift+D: no se persiste, vive solo en la pestaña
      cv.api.renderSettings();
      t.falso(hoja.innerHTML.includes("vgl-grp-tec vgl-d-none"), "con el modo programador activo, la sección ya no va oculta");
      t.cierto(hoja.innerHTML.includes("Probar avisos"), "los controles técnicos están pintados");
      cv.api._vglAlternarModoProg(); // se apaga para no contaminar el resto de la suite
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null);
    });

    // [auditoría 25-ago, sección 7] "#c-repgo" (Probar conexión, en Ajustes) mandaba
    // equipo:(S.equipo||"").slice(0,40) en vez de _equipoId() — el mismo respaldo de id
    // anónimo que reportar() SIEMPRE usa. Sin nombre manual, el botón mandaba equipo:"" y
    // caía en el balde "sin equipo" del tablero, distinto del equipo real del consultorio.
    await t.casoAsync("c-repgo (Probar conexión): manda el mismo _equipoId() que usan los reportes reales, nunca vacío", async () => {
      const posts = [];
      const cRep = cargar({
        silencioso: true,
        gmxhr: (o) => { posts.push(o); o.onload({ status: 200, responseText: '{"ok":true}' }); },
      });
      enriquecerDom(cRep);
      cRep.api.buildOverlay();
      cRep.api.toggleSheet("ajustes");
      cRep.api.renderSettings();
      const hojaRep = cRep.env.doc.body.children.find((n) => n.id === "vgl-root").querySelector("#vgl-sheet");
      const btn = hojaRep.querySelector("#c-repgo");
      t.cierto(!!btn, "el botón 'Probar y diagnosticar' debe existir en Ajustes");
      await disparar(btn, "click");
      t.igual(posts.length, 1, "se hizo la petición de prueba");
      const enviado = JSON.parse(posts[0].data);
      t.cierto(!!enviado.equipo, "el equipo enviado nunca debe quedar vacío (bug real: se enviaba \"\")");
      t.igual(enviado.equipo, cRep.api._equipoId(), "debe ser EXACTAMENTE el mismo id que usan los reportes reales");
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

    // =====================================================================
    // v17.6.73 — [reportado en consultorio, 26-ago-2026: "ni él ni sus compañeros lo
    // entienden bien"] La nota del banner «🧪 Labs primero» (rama con el piso relajado)
    // embebía `motivoPiso` —que YA empezaba con "adelantada porque..."— dentro de otra
    // frase que también empezaba con "se adelanta... porque", así que el texto final
    // decía literalmente "porque... (adelantada porque..." — duplicado, más jerga interna
    // del motor ("ventana de 14–21 días", "piso", "cupo hábil") ilegible para el médico en
    // consulta rápida. `_pintarBannerSugerida` vive en el cierre de `openAgendamientoModal`
    // (no es una unidad aislable) — se protege por texto fuente, mismo criterio ya
    // establecido en el banco (ver suite 57).
    // =====================================================================
    t.caso("notaLP (banner «Labs primero», piso relajado): sin la frase duplicada 'porque...(adelantada porque' ni jerga interna del motor", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const idx = src.indexOf("const _pisoLP = _labsPrimero && _labsPrimero.pisoRelajado;");
      t.cierto(idx >= 0, "el bloque de notaLP debe existir");
      const bloque = src.slice(idx, idx + 1200);

      // motivoPiso (línea ~25915/25927) ya no debe llevar su propio verbo "adelantada":
      // eso es justo lo que causaba la duplicación al embeberse en notaLP.
      const iMotivo1 = src.indexOf('motivoPiso = "ya hay examen');
      t.cierto(iMotivo1 >= 0, "caso 1 (vencidos): motivoPiso debe ser solo la razón");
      t.falso(/motivoPiso = "adelantada/.test(src), "ningún motivoPiso debe seguir empezando con 'adelantada' (esa era la causa de la duplicación)");

      // notaLP: se extrae SOLO la rama del ternario con piso relajado (hasta el ":" del
      // else), para no confundir con la rama sin relajar (que no se tocó).
      const iNotaLP = bloque.indexOf("const notaLP = _pisoLP");
      t.cierto(iNotaLP >= 0, "debe encontrarse la declaración de notaLP");
      const iElse = bloque.indexOf('"La toma queda 14', iNotaLP);
      const ramaRelajada = bloque.slice(iNotaLP, iElse >= 0 ? iElse : iNotaLP + 700);
      t.falso(/ventana de 14.21 días/.test(ramaRelajada), "ya no debe quedar la jerga 'ventana de 14–21 días'");
      t.falso(/\(adelantada porque/.test(ramaRelajada), "ya no debe quedar la frase duplicada 'porque...(adelantada porque'");
      t.cierto(/porque " \+ escapeHtml\(_labsPrimero\.motivoPiso/.test(ramaRelajada), "debe seguir embebiendo el motivo real (motivoPiso), no un texto genérico fijo");
      t.cierto(/se recalcula solo/.test(ramaRelajada), "conserva la aclaración de que es una sugerencia, no una imposición");
      t.cierto(/Se adelanta la toma al primer cupo disponible porque/.test(ramaRelajada), "arranca con la frase nueva, sin duplicar 'adelanta...porque' más adelante");
    });


    // v14.0.0 (T4) — "chips PyM" salió del nombre y de las aserciones de esta prueba: los
    // chips (y el texto "PyM sin cargar"/"Al día"/"Dato faltante" DENTRO de la tarjeta) se
    // amputaron del panel. El "PyM sin cargar" de la BARRA DE RESUMEN (suma.textContent,
    // no cardAna.innerHTML) es un sitio DISTINTO — con significado distinto — y se queda
    // intacto (ver la Regla B4-T4 sobre el literal repetido).
    t.caso("render: dos citas por API pintan tarjetas con bandera de fraude (sin chips PyM, amputados en T4)", () => {
      vaciarLista();
      cv.api.render(citas, "api", new Date());
      t.cierto(suma.textContent.includes("Vigilando la agenda · 2 cita(s)"), "resumen de fuente directa (texto v17.x: 'Vigilando la agenda · N cita(s) · act. HH:MM')");
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

    await t.casoAsync("createLabInjectorUI: sin token CSRF, getAtheneaLabsAuto da null (fallo de lectura) — el botón lo dice, no inventa 'sin laboratorios'", async () => {
      const btn = cLab.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      // El paciente SÍ se resuelve en la historia clínica (#anamesis + cédula en un
      // .text-muted, el mismo patrón que usa extractPacienteAbierto), pero Athenea no
      // devuelve token CSRF en el paso 1: getAtheneaSolicitudesAuto corta ahí y
      // getAtheneaLabsAuto da NULL (fallo de lectura, contrato v16.2.8 — verificado con el
      // harness, no []). Antes de v17.6.58 (1.20) esto caía en la rama final y mostraba
      // "Athenea no tiene laboratorios registrados", afirmando ausencia de datos cuando en
      // realidad la lectura falló.
      cLab.env.doc.getElementById = (id) => {
        if (id === "vgl-lab-injector") return btn;
        if (id === "anamesis") return {};
        return null;
      };
      cLab.env.doc.querySelector = () => null;
      cLab.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 999888777", closest: () => null }] : []);
      // v15.6.0 — sin alert() del navegador: el resultado se cuenta EN el botón y el
      // detalle va al toast. Lo observable aquí es el rótulo del botón y su restauración.
      await btn.onclick();
      t.falso(btn.innerHTML.startsWith("✓"), "jamás se pinta éxito sin resultados");
      t.cierto(btn.innerHTML.includes("No se pudo leer Athenea"), "el botón dice que la LECTURA falló, no que 'no tiene laboratorios': " + btn.innerHTML);
      t.falso(btn.innerHTML.includes("Sin resultados"), "un fallo de lectura no debe presentarse como 'sin resultados' (bug real: se confundían)");
      await esperar(20);
      t.igual(btn.innerHTML, "🧬 Auto-Labs (Athenea)", "el botón vuelve a su rótulo");
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
      const antes = c.env.doc.body.children.length;
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      t.cierto(!!dock, "el dock quedó en el body");
      t.cierto(dock.className.includes("vgl-acciones-dock"));
      const btns = dock.children.find((n) => n.className === "vgl-dock-btns");
      t.cierto(!!btns, "existe el contenedor de botones");
      const accs = btns.children.map((b) => b.getAttribute("data-accion"));
      // v16.8.0+ — el dock creció a propósito: 🧾 Panel del paciente (ficha), atajos
      // «Ir a [pestaña]» (uno por pestaña con algo pendiente por documentar — con el
      // mock de esta suite son 2: Antecedentes y Hábitos) y ✍ Redactar (texto libre).
      // El botón de «riesgo» se retiró en v16.8.0 (su contenido vive en el Panel).
      t.igual(accs, ["agendar", "ordenar", "labs", "ficha", "ir-pestana", "ir-pestana", "redactar"]);
      t.cierto(dock.children.some((n) => n.getAttribute && n.getAttribute("data-accion") === "toggle"), "botón de colapsar presente");

      // Segunda llamada: no duplica el contenedor del dock.
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "anamesis" ? { id: "anamesis" } : null));
      c.api.createAccionesDockUI();
      t.igual(c.env.doc.body.children.length, antes + 1, "la segunda llamada no añade otro dock");
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

    // v17.6.71 — [reportado en consultorio, 26-ago-2026] BLINDAJE CONTRA CRUCE DE
    // PACIENTES: integración completa a través del punto real de enganche
    // (createAccionesDockUI, que corre en cada tick). Antes, un módulo minimizado con
    // datos del paciente A sobrevivía sin ningún descarte automático al abrir la
    // historia de otro paciente — ver la cobertura unitaria de _vglMinDescartarDeOtroPaciente
    // en tests/suite_65_minimizar_modulos.js para el detalle función-por-función; esta
    // prueba confirma que el DOCK REAL de verdad la invoca en cada repintado.
    t.caso("createAccionesDockUI: al repintar para OTRO paciente, descarta el panel minimizado del paciente anterior (bug real reportado en consultorio)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "101010101");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      t.cierto(!!dock, "el dock se creó para el paciente A");

      const panelIA = c.env.doc.createElement("div");
      panelIA.id = "vgl-ia-modal";
      let removido = false;
      panelIA.remove = () => { removido = true; };
      t.cierto(c.api.vglMinimizarPanel(panelIA, "101010101"), "se minimiza el redactor IA del paciente A");
      // Se toma la barra REAL ya pintada por vglMinimizarPanel (por body.children, igual
      // que el dock arriba) — llamar a vglMinBarra() de nuevo aquí, sin que
      // doc.getElementById resuelva "vgl-min-bar", crearía un nodo DISTINTO al pintado.
      const bar = c.env.doc.body.children.find((n) => n.id === "vgl-min-bar");
      t.cierto(!!bar, "la barra de minimizados se creó");
      t.igual(bar.style.display, "flex", "la pastilla de A está en la barra");

      // El médico cierra la historia de A y abre la de B: mismo repintado real del dock.
      // getElementById debe seguir resolviendo el dock Y la barra ya creados (si no, el
      // código de producción crearía nodos nuevos en vez de actualizar los reales).
      mockPacienteDock(c, "202020202");
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "vgl-min-bar" ? bar : (id === "anamesis" ? { id: "anamesis" } : null)));
      c.api.createAccionesDockUI();

      t.cierto(removido, "el panel minimizado del paciente A se DESCARTA del DOM al repintar para B");
      t.igual(bar.style.display, "none", "y su pastilla desaparece de la barra");
    });

    t.caso("createAccionesDockUI: al repintar para el MISMO paciente, el panel minimizado sobrevive (no se descarta lo propio)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "101010101");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");

      const panelIA = c.env.doc.createElement("div");
      panelIA.id = "vgl-ia-modal";
      let removido = false;
      panelIA.remove = () => { removido = true; };
      c.api.vglMinimizarPanel(panelIA, "101010101");
      const bar = c.env.doc.body.children.find((n) => n.id === "vgl-min-bar");
      t.cierto(!!bar, "la barra de minimizados se creó");

      // Repintado normal (p. ej. el tick periódico) con el MISMO paciente todavía abierto.
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "vgl-min-bar" ? bar : (id === "anamesis" ? { id: "anamesis" } : null)));
      c.api.createAccionesDockUI();

      t.falso(removido, "el panel del propio paciente A no se toca mientras A sigue siendo el abierto");
      t.igual(bar.style.display, "flex", "su pastilla sigue disponible");
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
      c.api.__S.agendamientoRapido = false;
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const accs = dock.children.find((n) => n.className === "vgl-dock-btns").children.map((b) => b.getAttribute("data-accion"));
      // v16.8.0+ — sin el botón de «riesgo» (retirado); el resto del dock se conserva completo.
      t.igual(accs, ["labs", "ficha", "ir-pestana", "ir-pestana", "redactar"]);
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
      c.api._uxVolcarBuffer(); // v15.6.0: uxTrack acumula en memoria y vuelca en tandas de 2 s
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
      c.api._uxVolcarBuffer(); // v15.6.0: uxTrack acumula en memoria y vuelca en tandas de 2 s
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
      c.api._uxVolcarBuffer(); // v15.6.0: uxTrack acumula en memoria y vuelca en tandas de 2 s
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
      t.igual(btnN.innerHTML, "🩺 Normalidad", "rótulo v17.x: el botón dice «Normalidad» (el nombre completo «Normalidad fija» quedó en el feedback y los toasts)");
      t.cierto(typeof btnN.onclick === "function", "el clic queda cableado");
      cv.env.doc.getElementById = (id) => (id === "vgl-examen-normalidad" ? btnN : null);
      cv.api.createExamenFisicoInjectorUI();
      t.igual(cv.env.doc.body.children.length, antes + 1, "la segunda llamada no añade botones duplicados");
    });

    // ================= "Normalidad fija" (v12.10.3, plantilla incluida en el script) =================
    // v12.10.4 — a pedido directo del médico, este botón es el ÚNICO de la pestaña, pega de
    // un solo clic (SIN cuadro de confirmación) — pero jamás pisa una casilla con texto.
    t.caso("Normalidad fija: sin casillas en pantalla, el botón lo dice y no revienta", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      cv.env.doc.querySelectorAll = () => [];
      // v15.6.0 — sin alert() del navegador: el aviso queda EN el botón (feedback) y en el toast.
      t.noLanza(() => btnN.onclick());
      t.cierto(btnN.innerHTML.includes("Aquí no hay casillas de examen físico"), "el botón explica que en esta pantalla no están las casillas");
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

    t.caso("Normalidad fija: si el número de casillas de hoy no coincide con las 36 de la plantilla fija, el botón avisa el desajuste y se rehúsa por seguridad (v14.2.2)", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      const vacia = campoFalso("");
      cv.env.doc.querySelectorAll = (sel) => (typeof sel === "string" && sel.includes('input[id="alert_message"][type="text"]') ? [vacia] : []);
      // v15.6.0 — sin alert() del navegador: el desajuste se cuenta EN el botón.
      btnN.onclick();
      t.igual(vacia.value, "", "por seguridad (v14.2.2) ante desajuste de casillas no se pega nada");
      t.cierto(btnN.innerHTML.includes("⚠ No pegué nada"), "el botón anuncia el rehúso por seguridad");
      t.cierto(btnN.innerHTML.includes("1 casillas") && btnN.innerHTML.includes("36"), "avisa el desajuste con ambas cifras (las de la pantalla y las de la plantilla)");
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

    // v17.6.68 — [informe de laboratorio real y captura de pantalla reales, aportados en
    // consultorio, 26-ago-2026] BUG REAL: "QUIMICA URINARIA" (creatinina en orina
    // espontánea, microalbuminuria, relación microalbuminuria/creatinina — el estudio
    // CUANTITATIVO de la RAC) matcheaba el patrón amplio de _esAnalitoDeOrina (contiene
    // "URINARIA") y se colaba en el bloque "Uroanálisis" JUNTO con los componentes reales
    // del parcial, de OTRA fecha. Como el bloque toma la fecha del componente más
    // reciente, el resultado era un bloque fechado el día de la Química Urinaria (que ni
    // siquiera es un uroanálisis) pero con el TEXTO de un uroanálisis real más viejo.
    t.caso("_agruparUroanalisisParaTabla: QUIMICA URINARIA (más reciente) queda FUERA del bloque Uroanálisis; el bloque conserva la fecha y el contenido del uroanálisis REAL, aunque sea más viejo (bug real reportado en consultorio)", () => {
      const c = cargar();
      const labs = [
        // uroanálisis real, componentes del parcial, viejo (enero)
        { NombreParametro: "HEMATIES", NombreParametroPadre: "UROANALISIS", Resultado: "4.20", Fecha: "2026-01-10" },
        { NombreParametro: "LEUCOCITOS", NombreParametroPadre: "UROANALISIS", Resultado: "3.90", Fecha: "2026-01-10" },
        // Química Urinaria, del día de la consulta (agosto) — NO es un uroanálisis.
        { NombreParametro: "CREATININA EN ORINA ESPONTANEA", NombreParametroPadre: "QUIMICA URINARIA", Resultado: "85", Fecha: "2026-08-21" },
        { NombreParametro: "MICROALBUMINURIA", NombreParametroPadre: "QUIMICA URINARIA", Resultado: "18", Fecha: "2026-08-21" },
        { NombreParametro: "RELACION MICROALBUMINURIA CREATININA", NombreParametroPadre: "QUIMICA URINARIA", Resultado: "21.2", Fecha: "2026-08-21" },
      ];
      const agrupado = c.api._agruparUroanalisisParaTabla(labs);
      t.igual(agrupado.length, 4, "2 componentes reales se funden en 1 bloque; las 3 filas de Química Urinaria quedan cada una independiente (1+3=4)");
      const bloque = agrupado.find((l) => Array.isArray(l.__vglGrupoUroComponentes));
      t.cierto(!!bloque, "sigue habiendo un bloque Uroanálisis, armado SOLO con los componentes reales");
      t.igual(bloque.__vglGrupoUroComponentes.length, 2, "el bloque trae únicamente HEMATIES y LEUCOCITOS, nunca las filas de Química Urinaria");
      t.igual(bloque.Fecha, "2026-01-10", "la fecha del bloque es la del uroanálisis REAL (enero), no la de Química Urinaria (agosto) — antes del fix, agosto ganaba y mostraba un examen que no se hizo ese día");
      const quimUri = agrupado.filter((l) => l.NombreParametroPadre === "QUIMICA URINARIA");
      t.igual(quimUri.length, 3, "las 3 filas de Química Urinaria se conservan tal cual, sin agrupar y sin desaparecer");
      t.cierto(quimUri.every((l) => l.NombreParametro !== "Uroanálisis"), "ninguna se disfraza de 'Uroanálisis'");
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

    // v17.6.43 — AUDITORÍA S+ (barrido total, 24-ago-2026): mismo bug de 0-falsy que
    // _hayComponenteUroReal ya corrigió (Hematíes=0, Leucocitos=0 son resultados REALES
    // y frecuentes) — este bloque seguía encadenando con ||, así que un 0 real se volvía
    // "—" (sin dato) dentro del bloque agrupado de Uroanálisis.
    t.caso("v17.6.43: _agruparUroanalisisParaTabla conserva un resultado real de 0 (no lo vuelve '—')", () => {
      const c = cargar();
      const labs = [
        { NombreParametro: "HEMATIES", NombreParametroPadre: "UROANALISIS", Resultado: 0, Fecha: "2026-08-03" },
        { NombreParametro: "LEUCOCITOS", NombreParametroPadre: "UROANALISIS", Resultado: 0, Fecha: "2026-08-03" },
      ];
      const bloque = c.api._agruparUroanalisisParaTabla(labs)[0];
      const hem = bloque.__vglGrupoUroComponentes.find((x) => x.nombre === "HEMATIES");
      const leu = bloque.__vglGrupoUroComponentes.find((x) => x.nombre === "LEUCOCITOS");
      t.igual(hem.resultado, 0, "Hematíes=0 debe sobrevivir como 0, no como '—'");
      t.igual(leu.resultado, 0, "Leucocitos=0 debe sobrevivir como 0, no como '—'");
    });

    // v17.6.43 — AUDITORÍA S+ (barrido total, 24-ago-2026): mismo bug, esta vez con
    // consecuencia clínica: `lab.Resultado || lab.resultado || lab.valor` volvía el 0
    // real en `undefined` (0 es falsy), y esValorReal(lab, val) —que exige v != null—
    // rechazaba el hallazgo por completo: un resultado negativo/normal real (SANGRE=0,
    // BACTERIAS=0) se perdía en silencio en vez de registrarse como hallazgo negativo.
    t.caso("v17.6.43: mtrHallazgosUroDesdeLabs no pierde un resultado real de 0", () => {
      const c = cargar();
      const labs = [
        { NombreParametro: "SANGRE EN ORINA", NombreParametroPadre: "UROANALISIS", Resultado: 0 },
        { NombreParametro: "BACTERIAS EN ORINA", Resultado: 0 },
      ];
      const h = c.api.mtrHallazgosUroDesdeLabs(labs);
      t.cierto(!!h, "debe reconocer hallazgos reales, aunque los dos sean 0");
      t.igual(h.sangre, 0, "SANGRE=0 debe registrarse, no perderse");
      t.igual(h.bacteriuria, 0, "BACTERIAS=0 debe registrarse, no perderse");
    });

    // v17.6.43 — AUDITORÍA S+ (barrido total, 24-ago-2026): mismo bug, esta vez en la
    // columna "Resultado" de la tabla GENERAL de laboratorios (openLaboratoriosModal,
    // TODOS los analitos, no solo uroanálisis) — un 0 real se mostraba como "—". Vive
    // dentro de un cierre profundo (no es una unidad aislable) — se protege por texto
    // fuente, mismo criterio ya establecido en el banco.
    t.caso("v17.6.43: la tabla general del modal de Laboratorios conserva un resultado real de 0", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/const resultado = lab\.Resultado \|\| lab\.resultado \|\| lab\.valor \|\| lab\.Valor \|\| "—";/.test(src), "ya no debe quedar el encadenado || crudo");
      t.cierto(/const resultado = lab\.Resultado != null \? lab\.Resultado : \(lab\.resultado != null \? lab\.resultado : \(lab\.valor != null \? lab\.valor : \(lab\.Valor != null \? lab\.Valor : "—"\)\)\);/.test(src), "debe comparar explícitamente contra null, igual que _hayComponenteUroReal");
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

    await t.casoAsync("openLaboratoriosModal: un fallo del portal NO se presenta como un hecho del paciente", async () => {
      // v17.8.1 — AUDITORÍA DE EXPERIENCIA, hallazgo #26. Esta prueba FIJABA EL DEFECTO:
      // `labsSinDatos = true` dispara `onerror("sin red")`, o sea el portal NO contestó, y
      // la prueba exigía que la pantalla dijera «No se encontraron paraclínicos recientes
      // PARA ESTE PACIENTE» — una afirmación sobre el paciente cuando el fallo fue del
      // sistema. En consulta las dos frases llevan a conductas opuestas: «no tiene
      // exámenes» hace que se los vuelva a ordenar; «no pude leer» hace que se reintente.
      //
      // `getAtheneaLabsAuto` ya distinguía los dos casos a propósito (null vs []); lo que
      // faltaba era que la pantalla lo dijera. Lo que la prueba protege de verdad —que no
      // se inventen resultados de ejemplo— sigue exigido abajo.
      labsSinDatos = true;
      await cModal.api.openLaboratoriosModal({ doc_id: "87654321", nombre: "PEDRO" });
      const modal = ultimoModal("vgl-labs-modal");
      const contenido = modal.querySelector("#vgl-labs-content");
      t.cierto(contenido.innerHTML.includes("No pude leer el portal"),
        "con el portal caído se dice que el fallo fue del sistema");
      t.cierto(contenido.innerHTML.includes("NO quiere decir que no tenga ninguno"),
        "y se dice explícitamente lo que el médico NO puede concluir de esto");
      t.falso(contenido.innerHTML.includes("no tiene ningún paraclínico registrado"),
        "jamás se afirma nada sobre el paciente cuando no se pudo mirar");
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
      cRcv.api.__state.activeDoctor.name = "BRANDON PALENCIA";
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

    t.caso("esMedicoRCVActivo: invocación directa — coincide por token completo, sin distinguir mayúsculas ni tildes", () => {
      const cH = cargar({ silencioso: true });
      cH.api.__state.activeDoctor.name = "dr. ánGEL estrada";
      t.cierto(cH.api.esMedicoRCVActivo(), "ESTRADA está en RCV_DOCTORS, sin importar tilde/caja");
      cH.api.__state.activeDoctor.name = "ANA MARIA PEREZ";
      t.falso(cH.api.esMedicoRCVActivo(), "PEREZ no está en la lista");
    });

    // [auditoría 25-ago, hallazgo 1.2] "PINO" es sub-cadena de "OSPINO" y de "ESPINOSA" —
    // con match por sub-cadena estos dos médicos, ajenos al programa RCV, quedaban forzados
    // a swIsPyM/swProgramaEspecial=true en el POST real de Athenea. Debe comparar por token.
    t.caso("esMedicoRCVActivo: un apellido que CONTIENE a un médico RCV como sub-cadena no debe activar el forzado", () => {
      const cSub = cargar({ silencioso: true });
      cSub.api.__state.activeDoctor.name = "JORGE OSPINO";
      t.falso(cSub.api.esMedicoRCVActivo(), "OSPINO contiene 'PINO' como sub-cadena, pero no es un médico de la lista");
      cSub.api.__state.activeDoctor.name = "LAURA ESPINOSA";
      t.falso(cSub.api.esMedicoRCVActivo(), "ESPINOSA contiene 'PINO' como sub-cadena, pero no es un médico de la lista");
      cSub.api.__state.activeDoctor.name = "DR. PINO";
      t.cierto(cSub.api.esMedicoRCVActivo(), "PINO como apellido propio (token exacto) sí debe seguir activando el forzado");
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

    // [auditoría 25-ago, hallazgo 1.8] cargarHorasLab() desmarcaba el interruptor "Agendar
    // también la Toma de Muestras" al INICIO de cada recarga, y solo lo volvía a marcar si
    // era el default de labs-primero (no aplica aquí) Y el médico nunca lo había tocado. Si
    // el médico lo marcaba a mano, la siguiente recarga (cambiar de chip de día) lo apagaba
    // y no lo volvía a marcar — al confirmar se creaba solo la cita de control, sin la toma.
    await t.casoAsync("openAgendamientoModal: el interruptor de Toma de Muestras marcado A MANO sobrevive a un cambio de día de laboratorio", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cLab = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 55, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        // Cualquier fecha de toma tiene el mismo turno disponible, para que el cambio de
        // chip de día siga dejando el interruptor HABILITADO (turnosConHora.length > 0) —
        // lo único que debe cambiar es si queda marcado o no.
        gmxhr: (o) => {
          if (o.url.includes("ObtenerTurnosPorFecha")) {
            o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ hora: "06:30:00" }] }) });
          } else if (o.onerror) { o.onerror("url no simulada"); }
        },
      });
      enriquecerDom(cLab);
      cLab.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cLab.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(60);
      const modal = cLab.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const labChk = modal.querySelector("#vgl-agm-lab-chk");
      t.igual(labChk.disabled, false, "con turnos disponibles, el interruptor queda habilitado");
      t.igual(labChk.checked, false, "modo normal (no labs-primero): nace desmarcado");
      // El médico lo marca A MANO.
      labChk.checked = true;
      disparar(labChk, "change");
      // Cambia el chip de día de laboratorio (dispara renderLabDayChips -> cargarHorasLab,
      // la misma recarga que antes lo desmarcaba sin piedad).
      const chipsCont = modal.querySelector("#vgl-lab-day-chips");
      const otroChip = [...chipsCont.children].find((b) => !b.className.includes("active"));
      t.cierto(!!otroChip, "debe haber al menos otro día de laboratorio para elegir");
      disparar(otroChip, "click");
      await esperar(60);
      t.cierto(labChk.checked, "tras la recarga, la elección MANUAL del médico debe sobrevivir (bug real: se apagaba)");
      t.igual(labChk.disabled, false, "y sigue habilitado (el nuevo día también tiene turnos)");
    });

    // [auditoría 25-ago, hallazgo 1.9] renderLabDayChips reasignaba el centro (y con él
    // selectedLabDateInfo) al ítem central de la sugerencia SIN comprobar si el médico ya
    // había elegido otra fecha de toma con un clic. cargarHoras() —que corre en cada
    // cambio de fecha de CONTROL— vuelve a llamar a renderLabDayChips con una sugerencia
    // recién calculada, descartando en silencio la elección manual de la toma.
    await t.casoAsync("openAgendamientoModal: la fecha de TOMA elegida a mano sobrevive a un cambio de fecha de control", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cLab2 = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 55, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => {
          if (o.url.includes("ObtenerTurnosPorFecha")) {
            o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ hora: "06:30:00" }] }) });
          } else if (o.onerror) { o.onerror("url no simulada"); }
        },
      });
      enriquecerDom(cLab2);
      cLab2.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cLab2.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(60);
      const modal = cLab2.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const labLbl = modal.querySelector("#vgl-lab-date-lbl");
      // El médico elige a mano una fecha de toma DISTINTA a la sugerida (el chip central).
      const labChipsCont = modal.querySelector("#vgl-lab-day-chips");
      const chipManual = [...labChipsCont.children].find((b) => !b.className.includes("active"));
      t.cierto(!!chipManual, "debe haber al menos otro día de laboratorio para elegir a mano");
      disparar(chipManual, "click");
      await esperar(30);
      const fechaElegidaTexto = labLbl.textContent;
      t.cierto(!!fechaElegidaTexto, "la etiqueta de fecha de toma se actualizó con la elección manual");
      // Ahora el médico cambia la fecha de CONTROL (dispara cargarHoras -> renderLabDayChips
      // con una sugerencia de toma RECALCULADA — el momento exacto en que antes se perdía).
      const dayChipsCont = modal.querySelector("#vgl-day-chips");
      const otroDiaControl = [...dayChipsCont.children].find((b) => !b.className.includes("active"));
      t.cierto(!!otroDiaControl, "debe haber al menos otro día de control para elegir");
      disparar(otroDiaControl, "click");
      await esperar(60);
      t.igual(labLbl.textContent, fechaElegidaTexto,
        "tras cambiar la fecha de control, la fecha de TOMA elegida a mano no debe cambiar (bug real: se recalculaba)");
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
      const slots = modal.querySelector("#vgl-agm-slots");
      const botonTurno = [...slots.children].find((n) => (n.innerHTML || "").includes("08:00 AM"));
      disparar(botonTurno, "click");
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
      enriquecerDom(cLab);
      const avisos = [];
      cLab.ctx.Notification = class {
        constructor(title, opts) {
          avisos.push({ title, body: (opts||{}).body || "", tag: (opts||{}).tag || "", icon: (opts||{}).icon || "" });
        }
        close() {}
        static get permission() { return "granted"; }
      };

      // v15.4.0 — política de un solo canal: con la pestaña VISIBLE el aviso va al toast y
      // nada al sistema. Para ejercitar la rama de la notificación de Windows hace falta
      // pestaña oculta (la rama real que sí usa Notification).
      cLab.env.doc.visibilityState = "hidden";

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

    await t.casoAsync("openOrdenamientoModal: sin coincidencia PyM no ofrece NADA para ordenar y lo avisa (v16.2.0)", async () => {
      await cOrd.api.openOrdenamientoModal({ doc_id: "999", nombre: "PEDRO GOMEZ", pym: [] });
      const modal = ultimoOrd();
      t.cierto(!!modal);
      // v17.16.0 — esta línea llamaba «aviso honesto» a la frase MENOS honesta del modal.
      // «No se detectaron actividades de prevención pendientes PARA ESTE PACIENTE» es una
      // afirmación sobre el paciente, y en este mismo vector no se ha cargado ninguna lista
      // de PyM: no se miró nada. La prueba fijaba el defecto, no la regla — la misma clase
      // de error que ya se documentó siete veces en INFORME_MUTACIONES.md.
      t.cierto(modal.innerHTML.includes("No tengo cargada la lista de prevención de hoy"),
        "sin lista cargada se dice ESO, no que el paciente no tenga nada");
      t.cierto(modal.innerHTML.includes("no lo sé"),
        "y se dice explícitamente que es ignorancia, no un hallazgo");
      t.falso(/pendientes[^<]{0,40}para este paciente/i.test(modal.innerHTML),
        "nunca se afirma nada sobre el paciente sin haber mirado una lista");
      t.falso(modal.innerHTML.includes(" checked"), "ninguna casilla premarcada sin coincidencia explícita");
      // v16.2.0 — orden del médico: sin coincidencia NO se ofrece el catálogo entero para
      // marcar a mano (era el riesgo de sobre-ordenar); no se pinta ni un ítem.
      t.igual(modal.innerHTML.split("vgl-ord-item").length - 1, 0, "sin coincidencia no se ofrece ninguna actividad");
      t.cierto(modal.innerHTML.includes("No hay lista que consultar"),
        "y el rótulo del botón dice lo mismo: no es que no haya actividades, es que no hay lista");
    });


    await t.casoAsync("v17.16.0 — si no se pudo consultar Athenea, el modal lo DICE en vez de callarlo", async () => {
      // REGLA D. El cruce antiduplicado contra Athenea se caía «en silencio al
      // comportamiento de siempre» (así lo decía su propio comentario). La conducta era la
      // correcta —ante la duda se ofrece el examen, nunca se esconde— pero el médico veía
      // la lista premarcada igual que siempre, sin forma de saber que la comprobación no se
      // hizo. El síntoma que le queda es exactamente el que él reportó en la v17.6.99:
      // «me sale que hay que enviarle el antígeno de próstata pero ya se lo realizó».
      //
      // `null` = no se pudo preguntar. `[]` = se preguntó y no había nada. getAtheneaLabsAuto
      // las distingue a propósito, y hasta hoy el modal las trataba igual.
      const cCaido = cargar({
        silencioso: true,
        fetch: async () => { throw new Error("portal caído"); },
        gmxhr: (o) => { setTimeout(() => { try { o.onerror(new Error("NetErr")); } catch (e) {} }, 0); },
      });
      enriquecerDom(cCaido);
      await cCaido.api.openOrdenamientoModal({ doc_id: "888", nombre: "MARIA DIAZ", sexo: "F", pym: ["Mamografía"] });
      const modal = cCaido.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      t.cierto(!!modal, "el modal se abre igual: un fallo de red no puede dejar al médico sin la lista");
      t.cierto(modal.innerHTML.includes("vgl-ord-nocruce"), "y trae el aviso de que no se pudo cruzar");
      t.cierto(/no comprobé si alguno de estos exámenes ya se lo hicieron/.test(modal.innerHTML),
        "dicho en lo que significa para él, no en jerga de red");
      t.cierto(modal.innerHTML.includes("Mamografía (Mamografía Bilateral)"),
        "la actividad se sigue ofreciendo: ante la duda se ofrece, nunca se esconde");
    });


    await t.casoAsync("v17.16.0 — si Athenea SÍ responde (aunque sin nada), el aviso NO sale", async () => {
      // La otra mitad, y la que de verdad prueba la distinción: `[]` («pregunté y no hay»)
      // NO puede disparar el aviso de `null` («no pude preguntar»). Un aviso que aparece
      // siempre no avisa de nada — y la mitad de los defectos de este proyecto nacen de
      // tratar esos dos valores como el mismo.
      const cVacio = cargar({
        silencioso: true,
        gmxhr: (o) => {
          const url = String(o.url || "");
          // El portal responde bien en cada puerta, pero este paciente no tiene NINGUNA
          // solicitud de laboratorio: `DatosPaciente` no trae ni un formulario.
          if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
          else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
          else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: "CC: 888 — sin solicitudes" });
          else o.onload({ status: 200, responseText: "" });
        },
      });
      enriquecerDom(cVacio);
      const vacio = await cVacio.api.getAtheneaLabsAuto("888");
      t.igual(vacio, [], "el vector tiene que dar [] y no null, o esta prueba no distingue nada");
      await cVacio.api.openOrdenamientoModal({ doc_id: "888", nombre: "MARIA DIAZ", sexo: "F", pym: ["Mamografía"] });
      const modal = cVacio.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      t.cierto(!!modal, "el modal se abre");
      t.falso(modal.innerHTML.includes("vgl-ord-nocruce"),
        "se preguntó y se obtuvo respuesta: no hay nada que advertir");
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
      // v16.2.0 — imprimirRecordatorioCita abre la pestaña VACÍA (anti-bloqueador) y navega
      // por pestana.location.href apenas decide la URL final; el mock captura esa navegación
      // como una llamada con su URL (imprimirOrdenPyM sigue abriendo window.open(url) directo).
      c.env.win.open = (url, target) => {
        const pestana = { closed: false };
        let href = "";
        Object.defineProperty(pestana, "location", {
          configurable: true,
          get() { return { set href(v) { href = String(v); if (v) llamadas.push({ url: String(v), target }); }, get href() { return href; } }; },
        });
        if (url) llamadas.push({ url, target });
        return pestana;
      };
      return llamadas;
    }

    await t.casoAsync("imprimirRecordatorioCita: reproduce la URL real capturada (CitaId=radicado, Eps y nombreCompleto codificados)", async () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      c.api.imprimirRecordatorioCita(7813686, "NUEVA EPS ", "MARIA LUZMILA CARMONA CARMONA");
      await esperar(20); // el fetch del arnés no trae blob(): cae al respaldo y navega a la URL real
      t.igual(llamadas.length, 1, "abre exactamente una pestaña");
      t.igual(llamadas[0].target, "_blank");
      const u = new URL(llamadas[0].url);
      t.cierto(u.pathname.endsWith("/apiviva/APIImpresionV2/api/Impresion/ImprimirRecordatorioCita"), "misma ruta que capturó el grabador");
      t.igual(u.searchParams.get("CitaId"), "7813686", "CitaId es el radicado de ESTA cita, no 'la última en pantalla'");
      t.igual(u.searchParams.get("Eps"), "NUEVA EPS ");
      t.igual(u.searchParams.get("nombreCompleto"), "MARIA LUZMILA CARMONA CARMONA");
      t.igual(u.searchParams.get("swVirtual"), "false", "este flujo solo crea citas PRESENCIAL");
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
      const c = cargar();
      enriquecerDom(c);
      const llamadas = mockOpen(c);
      c.api.mostrarPanelPostCita(7813686, "NUEVA EPS", "MARIA LUZMILA CARMONA CARMONA", "fallback");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      const printBtn = panel.querySelector("#vgl-postcita-print");
      disparar(printBtn, "click");
      await esperar(20); // misma cadena async de imprimirRecordatorioCita (v16.2.0)
      t.igual(llamadas.length, 1);
      const u = new URL(llamadas[0].url);
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
      // v17.6.10 — la clave `recordatorioPym` se retiró: nada en producción la leía
      // (el canal del recordatorio lo decide hoy avisoPymModal + el chip del dock).
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
    // v17.6.13 — AUDITORÍA S+ DEL AGENDAMIENTO (5 hallazgos)
    //  1. Sin sugerencia clínica NINGÚN turno nace activo (antes, el primero cronológico
    //     quedaba preseleccionado y un clic a ciegas confirmaba una madrugada).
    //  2. Los avisos de doble confirmación (antidup/vencimiento) se reinician al cambiar
    //     de turno o de día (antes, el segundo Confirmar se los saltaba con datos nuevos).
    //  3. El celular dice la verdad si no se pudo verificar (antes: "cargando…" colgado
    //     con el SMS tildado, cita creada con celular vacío sin avisar).
    //  4. Accesibilidad: aria-live en los estados que mutan + aria-current en el stepper.
    //  5. El cupo desaconsejado se ve usable (opacidad .85) y explica su razón en la
    //     loseta, no solo en el tooltip.
    // =====================================================================

    const _mockAgendaComun = (extraFetch) => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const urlsVistas = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          urlsVistas.push(u);
          const extra = extraFetch && extraFetch(u);
          if (extra) return extra;
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [
            { id: 701, horaTexto: "07:00 AM", estado: "ACT" },
            { id: 702, horaTexto: "10:00 AM", estado: "ACT" },
          ] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(c);
      c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      return { c, urlsVistas };
    };

    await t.casoAsync("v17.6.13: sin sugerencia clínica, NINGÚN turno nace activo y el botón explica por qué (v16.9.0)", async () => {
      const { c } = _mockAgendaComun();
      await esperar(80);
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const confirmBtn = modal.querySelector("#vgl-agm-confirm");
      const activos = [...slots.children].filter((b) => b.className.includes("active"));
      t.igual(activos.length, 0, "sin perfil que recomiende, no hay preselección de madrugada");
      t.igual(confirmBtn.disabled, true, "el botón sigue apagado hasta que el médico elija");
      t.cierto(confirmBtn.textContent.includes("Elija un horario"), "el botón dice POR QUÉ está apagado");
    });

    await t.casoAsync("v17.6.13: con turno clínico recomendado, el sugerido SÍ nace activo y listo para confirmar", async () => {
      const { c } = _mockAgendaComun((u) => {
        if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [
          { id: 4, descripcion: "Diabetes", swProgramaEspecial: false },
        ] } });
        return null;
      });
      await esperar(80);
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const confirmBtn = modal.querySelector("#vgl-agm-confirm");
      const btnSugerido = [...slots.children].find((b) => (b.innerHTML || "").includes("⭐ SUGERIDO"));
      t.cierto(!!btnSugerido && btnSugerido.classList.contains("active"), "el sugerido queda preseleccionado");
      t.igual(confirmBtn.disabled, false, "con sugerencia, el botón ya está listo");
      t.cierto(confirmBtn.textContent.includes("07:00 AM"), "el botón nombra la hora sugerida");
    });

    await t.casoAsync("v17.6.13: cambiar de turno reinicia la doble confirmación (el aviso antidup no se puede saltar con datos nuevos)", async () => {
      const { c, urlsVistas } = _mockAgendaComun();
      c.api.markCitaAgendadaHoy("555111", "2026-08-23");
      await esperar(80);
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const confirmBtn = modal.querySelector("#vgl-agm-confirm");
      const btn1 = [...slots.children].find((b) => (b.innerHTML || "").includes("07:00 AM"));
      const btn2 = [...slots.children].find((b) => (b.innerHTML || "").includes("10:00 AM"));
      disparar(btn1, "click");
      disparar(confirmBtn, "click");
      t.cierto(confirmBtn.textContent.includes("pulse otra vez"), "1er confirmar muestra el aviso antidup");
      t.igual(confirmBtn.dataset.dupOk, "1", "y lo marca en el dataset");
      disparar(btn2, "click");
      t.igual(confirmBtn.dataset.dupOk, "", "cambiar de turno reinicia la marca");
      t.cierto(confirmBtn.textContent.includes("10:00 AM"), "el botón nombra la hora recién elegida");
      // El anti-doble-clic (v17.6.8) ignora un segundo clic en <700 ms del anterior: se
      // espera el tiempo real entre los dos confirmar, como en la consulta.
      await esperar(750);
      disparar(confirmBtn, "click");
      t.cierto(confirmBtn.textContent.includes("pulse otra vez"), "el 2º confirmar vuelve a exigir la doble confirmación");
      t.falso(urlsVistas.some((u) => u.includes("AsignarTurno")), "no se creó ninguna cita por el clic a ciegas");
    });

    await t.casoAsync("v17.6.13: si Everest no devuelve los datos del paciente, el celular no queda colgado en «cargando…»", async () => {
      const { c } = _mockAgendaComun((u) => {
        if (u.includes("BuscarPacienteDetallado")) return respuestaJson(null);   // red caída -> pageFetchJson devuelve null
        return null;
      });
      await esperar(80);
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const inpTel = modal.querySelector("#vgl-agm-sms-tel");
      const chkSms = modal.querySelector("#vgl-agm-sms-chk");
      const notaSms = modal.querySelector("#vgl-agm-sms-nota");
      t.cierto(inpTel.placeholder.includes("escríbalo a mano"), "el campo pide el celular a mano en vez de mentir con «cargando…»");
      t.igual(chkSms.checked, false, "el SMS se desmarca: no se puede enviar un número que no se verificó");
      t.cierto(notaSms.textContent.includes("no se pudo verificar"), "la nota dice qué pasó");
    });

    t.caso("v17.6.13: accesibilidad del modal — aria-live en los 4 estados que mutan y aria-current en el stepper", () => {
      const { c } = _mockAgendaComun();
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const vivas = (modal.innerHTML.match(/aria-live="polite"/g) || []).length;
      t.igual(vivas, 4, "pc-est, sugerida, vencaviso y date-info anuncian sus cambios");
      t.cierto(modal.innerHTML.includes('id="vgl-step-ind-1" role="listitem" aria-current="step"'), "el paso 1 arranca marcado como paso en curso");
      const ind2 = modal.querySelector("#vgl-step-ind-2");
      t.noLanza(() => disparar(modal.querySelector("#vgl-step-1-next"), "click"));
      t.igual(ind2.getAttribute && ind2.getAttribute("aria-current"), "step", "al avanzar, aria-current salta al paso 2");
      t.igual(modal.querySelector("#vgl-step-ind-1").getAttribute("aria-current"), null, "y el paso 1 deja de ser el actual");
    });

    await t.casoAsync("v17.6.13: el cupo desaconsejado se ve usable (opacidad .85) y la razón es visible en la loseta", async () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/\.vgl-agm-sbtn-adic-no\{opacity:\.85\}/.test(src), "opacidad .85: usable, no parece botón muerto");
      const { c } = _mockAgendaComun((u) => {
        if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [
          { id: 4, descripcion: "Diabetes", swProgramaEspecial: false },
        ] } });
        if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [
          { id: 701, horaTexto: "07:00 AM", estado: "ACT" },
          { id: 703, horaTexto: "09:30 AM", estado: "ACT" },   // 09:30 = hora ADICIONAL (lista del médico)
        ] });
        return null;
      });
      await esperar(80);
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const btnNoRecomendado = [...slots.children].find((b) => b.className.includes("vgl-agm-sbtn-adic-no"));
      t.cierto(!!btnNoRecomendado, "el cupo adicional para un diabético lleva la clase de desaconsejado");
      t.cierto((btnNoRecomendado.innerHTML || "").includes("SOLO SI NO HAY OTRA CITA"), "la razón va visible en la loseta, no solo en el tooltip");
    });

    // =================================================================
    // v17.6.28 — AUDITORÍA S+ (barrido total, 24-ago-2026): cargarHorasLab y
    // cargarHorasLabSolo usaban gmPostJson, que no distingue "AppCita contestó: sin
    // turnos" de "no contestó" (timeout/red caída/500) — ambos casos se presentaban al
    // médico como el HECHO verificado "No hay turnos de laboratorio disponibles", y en
    // cargarHorasLab además desmarcaba/deshabilitaba el interruptor de la toma. Misma
    // clase de bug que ya corrigió la AUDITORÍA #11 en apiLaboratorioAgendarAuto
    // (gmPostJsonEx, ~15326) y en las agendas (resAgendas.__sinRespuesta, ~19473). No hay
    // unidad aislable sin reconstruir el modal completo de agendamiento (>2000 líneas de
    // closures) — se protege por texto fuente, mismo criterio ya establecido en el banco.
    t.caso("v17.6.28: cargarHorasLab y cargarHorasLabSolo usan gmPostJsonEx (distinguen sin-respuesta de sin-turnos)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const fnCargarHorasLab = src.slice(src.indexOf("async function cargarHorasLab() {"), src.indexOf("async function cargarHorasLab() {") + 2200);
      t.cierto(/await gmPostJsonEx\(urlTurnos/.test(fnCargarHorasLab), "cargarHorasLab consulta con gmPostJsonEx, no gmPostJson");
      t.cierto(/if \(!resAgEx \|\| !resAgEx\.ok\)/.test(fnCargarHorasLab), "y distingue el caso 'no hubo respuesta' antes de mirar la lista de turnos");

      const fnCargarHorasLabSolo = src.slice(src.indexOf("async function cargarHorasLabSolo(exigirEleccion) {"), src.indexOf("async function cargarHorasLabSolo(exigirEleccion) {") + 1600);
      t.cierto(/await gmPostJsonEx\(urlTurnos/.test(fnCargarHorasLabSolo), "cargarHorasLabSolo también consulta con gmPostJsonEx");
      t.cierto(/if \(!resAgEx \|\| !resAgEx\.ok\)/.test(fnCargarHorasLabSolo), "y también distingue sin-respuesta de sin-turnos");
    });

    // =================================================================
    // v17.6.28 — AUDITORÍA S+ (barrido total, 24-ago-2026): `ultimoSmsEnviado` se fija en
    // cuanto se DISPARA el fetch de EnviarSMS (fire-and-forget, sin esperar el .then()) y
    // la notificación de "Cita asignada" que lo muestra es SÍNCRONA justo después — así
    // que un rechazo del proveedor de SMS o un fallo de red se anunciaba igual como
    // "SMS de recordatorio enviado al X", una afirmación que en ese momento nadie había
    // confirmado. Se corrige el verbo a lo único que ahí se sabe con certeza: que la
    // petición se envió, no que llegó. No hay unidad aislable (vive dentro del cierre
    // async de creación de cita, con turnoId/celularSms de closure) — se protege por
    // texto fuente, mismo criterio ya establecido en el banco.
    t.caso("v17.6.28: la notificación de cita creada ya NO afirma que el SMS se entregó, solo que se solicitó", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/SMS de recordatorio enviado al \$\{ultimoSmsEnviado\}/.test(src), "ya no debe quedar la afirmación de entrega confirmada");
      t.cierto(/Se solicitó el envío del SMS de recordatorio al \$\{ultimoSmsEnviado\}/.test(src), "el texto ahora dice lo que de verdad se sabe: que se solicitó");
    });

    // =================================================================
    // v17.6.32 — AUDITORÍA S+ (barrido total, 24-ago-2026): 10 textos visibles al médico
    // usaban tuteo (tú) mientras el resto de la interfaz — y el propio proyecto — trata al
    // médico de usted de forma consistente ("Pulse", "Verifique", "Escriba"). Mezclar
    // ambos tratos dentro del mismo flujo (a veces en la misma notificación) lee como
    // descuido. Se protegen por texto fuente: son cambios de redacción sin lógica que
    // mutar, mismo criterio que la prueba de SMS de arriba.
    t.caso("v17.6.32: los avisos de actualización, SharePoint y accesibilidad tratan al médico de usted, no de tú", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const tuteos = [
        /Ya tienes la última versión/,
        /Llevas \$\{dias\} días/,
        /Repórtalo\./,
        /Ábrelo una vez con tu usuario/,
        /Navegador sin soporte \.xlsx; usa \.csv/,
        /\(\.xlsx\) \(" \+ err\.message \+ "\)\. Prueba \.csv/,
        /Notificaciones BLOQUEADAS:.*recarga\./,
        /Actívalo en el candado/,
        /sin que tengas que buscarlos/,
        /por si necesitas el reporte completo/,
        /cuando cierres la historia clínica/,
        /Actualízala desde el Menú de Tampermonkey/,
      ];
      tuteos.forEach((re) => t.falso(re.test(src), `no debe quedar tuteo: ${re}`));
      const ustedes = [
        /Ya tiene la última versión/,
        /Lleva \$\{dias\} días/,
        /Repórtelo\./,
        /Ábralo una vez con su usuario/,
        /Navegador sin soporte \.xlsx; use \.csv/,
        /\(\.xlsx\) \(" \+ err\.message \+ "\)\. Pruebe \.csv/,
        /Notificaciones BLOQUEADAS:.*recargue\./,
        /Actívelo en el candado/,
        /sin que tenga que buscarlos/,
        /por si necesita el reporte completo/,
        /cuando cierre la historia clínica/,
        /Actualícela desde el Menú de Tampermonkey/,
      ];
      ustedes.forEach((re) => t.cierto(re.test(src), `debe quedar en usted: ${re}`));
    });

    // =================================================================
    // v17.6.33 — AUDITORÍA S+ (barrido total, 24-ago-2026): el celular del paciente
    // (PII) se registraba COMPLETO en la consola del navegador en 3 sitios del flujo de
    // SMS. El propósito diagnóstico declarado (comparar contra lo que el médico cree
    // haber escrito) solo necesita los últimos dígitos.
    t.caso("v17.6.33: _mtrCelularMascarado conserva solo los últimos 2 dígitos del celular", () => {
      t.igual(api._mtrCelularMascarado("3001234567"), "300****67", "número real: prefijo + máscara + últimos 2");
      t.igual(api._mtrCelularMascarado(""), "", "vacío: no revienta");
      t.igual(api._mtrCelularMascarado(null), "", "null: no revienta");
      t.igual(api._mtrCelularMascarado("12"), "12", "número de 2 dígitos o menos: se deja igual, no hay nada que enmascarar");
    });

    t.caso("v17.6.33: los 3 registros de consola del flujo de SMS ya no exponen el celular completo", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/celular usado:", cel\)/.test(src), "ya no debe quedar el celular crudo en el console.log de éxito");
      t.falso(/celular usado:", cel,/.test(src), "ya no debe quedar el celular crudo en los otros 2 registros");
      const ocurrencias = (src.match(/celular usado:", _mtrCelularMascarado\(cel\)/g) || []).length;
      t.igual(ocurrencias, 3, "los 3 sitios (envío automático éxito/fallo y reenvío manual) deben usar la máscara");
    });

    // v17.6.40 — AUDITORÍA S+ (barrido total, 24-ago-2026): el "modo oculto" (pensado
    // para ocultar TODO el Vigilante de un vistazo, ej. si alguien más mira la
    // pantalla) no incluía 7 elementos que cuelgan de document.body y se agregaron
    // después de escribirse esta lista: #vgl-confirma-modal, #vgl-llenar-modal,
    // #vgl-min-bar, #vgl-deshacer-llenado, #vgl-deshacer-lote, #vgl-ia-inj-ea,
    // #vgl-ia-inj-an quedaban visibles con el modo oculto activo.
    t.caso("v17.6.40: el modo oculto (privacidad de pantalla) esconde los 7 elementos que faltaban", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const idx = src.indexOf("body.vgl-modo-oculto #vgl-root");
      const regla = src.slice(idx, src.indexOf("{display:none !important}", idx));
      ["vgl-confirma-modal", "vgl-llenar-modal", "vgl-min-bar", "vgl-deshacer-llenado", "vgl-deshacer-lote", "vgl-ia-inj-ea", "vgl-ia-inj-an"].forEach((id) => {
        t.cierto(regla.includes("body.vgl-modo-oculto #" + id), "#" + id + " debe esconderse en modo oculto");
      });
    });

  },
};
