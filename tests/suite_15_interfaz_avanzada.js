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
    "openLaboratoriosModal", "abrirInformeAthenea", "openAgendamientoModal", "openLabSoloModal", "openOrdenamientoModal",
    "savePos", "restorePos", "closeSheet", "toggleSheet", "sheetHeader",
    "wireClose", "renderResumen", "copySummary", "renderSettings",
    "paintMute", "repaint", "makeDraggable", "setSummary", "render",
    "refrescarCuentas", "imprimirRecordatorioCita", "imprimirOrdenPyM", "_urlImpresionOrdenPyM",
    "_agruparUroanalisisParaTabla", "mostrarPanelPostCita", "createAccionesDockUI",
    "createPymBannerUI", "_refrescarBannerPym", "pymPaquetesDelPaciente",
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

    t.caso("renderSettings: cambiar un interruptor guarda el ajuste en S y en localStorage", () => {
      const chk = hoja.querySelector("#c-snd");
      chk.checked = false;
      disparar(chk, "change");
      t.igual(cv.api.__S.sonido, false, "S.sonido quedó apagado");
      const cfg = JSON.parse(cv.env.almacen.vgl_cfg);
      t.igual(cfg.sonido, false, "saveSettings persistió el cambio");
    });

    t.caso("renderSettings: el interruptor de opciones técnicas repinta mostrando la sección", () => {
      const tec = hoja.querySelector("#c-tecnicas");
      tec.checked = true;
      disparar(tec, "change");
      t.igual(cv.api.__S.opcionesTecnicas, true);
      t.falso(hoja.innerHTML.includes('class="vgl-d-none"'), "la sección técnica ya no va oculta");
      t.cierto(hoja.innerHTML.includes("Probar avisos"), "los controles técnicos están pintados");
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null);
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

    // ================= botón "Atender" (v13.0.0) =================
    t.caso('botón Atender: solo aparece cuando la cita trae citaId real (API) — nunca por scraping de DOM', () => {
      vaciarLista();
      const conCitaId = { key: "atc1", doc_id: "1", nombre: "A", hora_texto: "07:00", estado: "En sala", color: "VERDE", pym: [], elapsed: 0, citaId: 4334823 };
      const sinCitaId = { key: "atc2", doc_id: "2", nombre: "B", hora_texto: "07:20", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.__state.lastSignature = "";
      cv.api.render([conCitaId, sinCitaId], "api", new Date());
      const hCon = lista.children[0].innerHTML, hSin = lista.children[1].innerHTML;
      t.cierto(hCon.includes('aria-label="Registrar inicio de atención de'), "con citaId real y sin marcar, el botón está habilitado");
      t.falso(hSin.includes("vgl-btn-atender"), "sin citaId (p. ej. el camino de respaldo por scraping de DOM) no hay botón: nunca se inventa el id");
    });

    t.caso("botón Atender: se deshabilita si Everest ya marca Atendido, o si ya se abrió hoy desde el panel", () => {
      vaciarLista();
      cv.env.storage.removeItem("vgl_proc_today");
      const yaAtendido = { key: "atc3", doc_id: "3", nombre: "C", hora_texto: "07:00", estado: "Atendido", color: "VERDE", pym: [], elapsed: 0, citaId: 111 };
      const abiertoHoy = { key: "atc4", doc_id: "4", nombre: "D", hora_texto: "07:20", estado: "En sala", color: "VERDE", pym: [], elapsed: 0, citaId: 222 };
      cv.api.markAtencionAbiertaHoy(222);
      cv.api.__state.lastSignature = "";
      cv.api.render([yaAtendido, abiertoHoy], "api", new Date());
      const hAtendido = lista.children[0].innerHTML, hAbierto = lista.children[1].innerHTML;
      t.cierto(hAtendido.includes('aria-label="Inicio de atención ya registrado para'), "ya Atendido en Everest: botón visible pero bloqueado");
      t.cierto(hAbierto.includes('aria-label="Inicio de atención ya registrado para'), "ya se pulsó hoy desde el panel: bloqueado para no repetir la escritura");
    });

    await t.casoAsync("botón Atender: al pulsarlo llama a apiMedicoAbrirHistoria; si no hay éxito, avisa y se reactiva", async () => {
      vaciarLista();
      cv.env.storage.removeItem("vgl_proc_today");
      const cita = { key: "atc5", doc_id: "5", nombre: "E", hora_texto: "07:00", estado: "En sala", color: "VERDE", pym: [], elapsed: 0, citaId: 333 };
      cv.api.__state.lastSignature = "";
      cv.api.render([cita], "api", new Date());
      const card = lista.children[0];
      const bAt = card.querySelector(".vgl-btn-atender");
      await disparar(bAt, "click", { stopPropagation() {} });
      // El fetch por defecto del harness responde `{}` (no `true`): guardarHoraApertura
      // se cuenta como fallo, así que NO debe marcarse como abierta ni quedar bloqueado.
      t.falso(cv.api.isAtencionAbiertaHoy(333), "sin `true` real del servidor, no se marca como abierta");
      t.falso(bAt.disabled, "al fallar, el botón se reactiva — no queda bloqueado para siempre por un error de red");
    });

    // v12.10.1 — Incidente real en consultorio: el botón decía "abre la Historia Clínica" y
    // el aviso de éxito decía "Historia clínica abierta", pero apiMedicoAbrirHistoria() NUNCA
    // navega ni pinta nada — solo registra un timestamp en el servidor de Everest. El médico
    // pulsó, vio el mensaje de éxito, y la historia nunca se abrió: creyó (por el propio texto
    // del script) que había revisado al paciente sin haberlo hecho. Esta prueba impide que
    // vuelva a redactarse un texto que prometa "abrir"/"abierta" mientras la función solo
    // registra un timestamp — si en el futuro SÍ se implementa la navegación real, hay que
    // actualizar esta prueba a la vez que el código, no antes.
    t.caso("botón Atender: ningún texto visible promete abrir/mostrar la historia clínica (solo registra, no navega)", () => {
      vaciarLista();
      cv.env.storage.removeItem("vgl_proc_today");
      const habilitado = { key: "atc6", doc_id: "6", nombre: "F", hora_texto: "07:00", estado: "En sala", color: "VERDE", pym: [], elapsed: 0, citaId: 444 };
      const bloqueado = { key: "atc7", doc_id: "7", nombre: "G", hora_texto: "07:20", estado: "Atendido", color: "VERDE", pym: [], elapsed: 0, citaId: 555 };
      cv.api.__state.lastSignature = "";
      cv.api.render([habilitado, bloqueado], "api", new Date());
      const hHab = lista.children[0].innerHTML, hBloq = lista.children[1].innerHTML;

      // Frases textuales del incidente real (v13.0.0 original) que NUNCA deben reaparecer —
      // no se usa una heurística amplia porque el texto honesto ACTUAL dice a propósito
      // "NO abre la historia clínica", que una heurística ingenua marcaría como falso positivo.
      const FRASES_FALSAS = [
        "abrir Historia Clínica de",
        "abre la Historia Clínica de",
        "Historia clínica abierta",
        "Historia clínica ya abierta",
      ];
      for (const frase of FRASES_FALSAS) {
        t.falso(hHab.includes(frase), `el botón habilitado no debe contener "${frase}"`);
        t.falso(hBloq.includes(frase), `el botón bloqueado no debe contener "${frase}"`);
      }
    });




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


    // v14.0.0 (T4) — "chips PyM" salió del nombre y de las aserciones de esta prueba: los
    // chips (y el texto "PyM sin cargar"/"Al día"/"Dato faltante" DENTRO de la tarjeta) se
    // amputaron del panel. El "PyM sin cargar" de la BARRA DE RESUMEN (suma.textContent,
    // no cardAna.innerHTML) es un sitio DISTINTO — con significado distinto — y se queda
    // intacto (ver la Regla B4-T4 sobre el literal repetido).
    t.caso("render: dos citas por API pintan tarjetas con bandera de fraude (sin chips PyM, amputados en T4)", () => {
      vaciarLista();
      cv.api.render(citas, "api", new Date());
      t.cierto(suma.textContent.includes("Vigilando (directo) · 2 cita(s)"), "resumen de fuente directa");
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

    // v14.0.0 (T4) — Criterio de aceptación explícito: "la tarjeta ya no genera esos tres
    // botones, y sí sigue generando la bandera PES con el texto nuevo".
    t.caso("T4 — la tarjeta ya NO genera los botones de agendar/ordenar/labs, solo Atender", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const pac = { key: "t4-1", doc_id: "999", nombre: "PACIENTE T4", hora_texto: "09:00", estado: "En sala", color: "VERDE", pym: ["MAMOGRAFÍA"], elapsed: 0, citaId: 12345 };
      cv.api.render([pac], "api", new Date());
      const card = lista.children[0];
      t.falso(card.innerHTML.includes("vgl-btn-agendar"), "sin botón de agendar");
      t.falso(card.innerHTML.includes("vgl-btn-ordenar"), "sin botón de ordenar");
      t.falso(card.innerHTML.includes("vgl-btn-labs"), "sin botón de labs");
      t.cierto(card.innerHTML.includes("vgl-btn-atender"), "el botón Atender SÍ se sigue generando");
      t.falso(card.innerHTML.includes("vgl-pyms"), "sin fila de chips PyM");
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
      t.igual(alertas.length, 1);
      t.cierto(alertas[0].includes("No se encontraron laboratorios para el paciente abierto (cédula 999888777) en Athenea"), "explica que no encontró laboratorios para el paciente resuelto");
      t.cierto(alertas[0].includes("No se diligenció ninguna casilla"));
      t.igual(btn.innerHTML, "🧬 Auto-Labs (Athenea)", "el botón vuelve a su rótulo");
    });

    // v12.10.15 — Bug real de auditoría nocturna, mismo patrón que autoFetch: el clic
    // manual del botón también dejaba SIN cachear un resultado vacío, así que
    // checkLabsVencidos seguía sin poder revisar a ese paciente ni tras el clic explícito
    // del médico.
    await t.casoAsync("createLabInjectorUI (clic manual): SIN laboratorios encontrados también actualiza _labsPrefetch — checkLabsVencidos ya no queda mudo (bug real de auditoría)", async () => {
      const btn = cLab.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      cLab.env.doc.getElementById = (id) => {
        if (id === "vgl-lab-injector") return btn;
        if (id === "anamesis") return {};
        return null;
      };
      cLab.env.doc.querySelector = () => null;
      cLab.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 999888777", closest: () => null }] : []);
      cLab.ctx.alert = () => {};
      const uid = "labsv|" + cLab.api.normalizeKey("999888777");
      t.falso(cLab.api.avisoYaVisto(uid));
      await btn.onclick();
      cLab.api.checkLabsVencidos();
      t.cierto(cLab.api.avisoYaVisto(uid), "bug real de auditoría: antes, un clic manual sin resultados tampoco cacheaba, y checkLabsVencidos seguía mudo");
    });

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
      t.igual(accs, ["agendar", "ordenar", "labs"]);
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
      t.igual(accs, ["labs"]);
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
      t.igual(btnN.innerHTML, "🩺 Normalidad fija");
      t.cierto(typeof btnN.onclick === "function", "el clic queda cableado");
      cv.env.doc.getElementById = (id) => (id === "vgl-examen-normalidad" ? btnN : null);
      cv.api.createExamenFisicoInjectorUI();
      t.igual(cv.env.doc.body.children.length, antes + 1, "la segunda llamada no añade botones duplicados");
    });

    // ================= "Normalidad fija" (v12.10.3, plantilla incluida en el script) =================
    // v12.10.4 — a pedido directo del médico, este botón es el ÚNICO de la pestaña, pega de
    // un solo clic (SIN cuadro de confirmación) — pero jamás pisa una casilla con texto.
    t.caso("Normalidad fija: sin casillas en pantalla, avisa y no revienta", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      cv.env.doc.querySelectorAll = () => [];
      const alertas = [];
      cv.ctx.alert = (m) => alertas.push(String(m));
      btnN.onclick();
      t.igual(alertas.length, 1);
      t.cierto(alertas[0].includes("No se encontraron casillas"), "explica que no halló casillas de esta pestaña");
    });

    t.caso("Normalidad fija: un solo clic rellena SOLO las vacías, sin pedir confirmación, respeta las que ya tienen texto", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      const yaEscrita = campoFalso("El médico ya escribió esto y NUNCA se toca");
      const vacia1 = campoFalso("");
      const vacia2 = campoFalso("   "); // solo espacios: cuenta como vacía
      const oculta = campoFalso("", { oculto: true });
      cv.env.doc.querySelectorAll = (sel) => (sel === 'input[id="alert_message"][type="text"]' ? [yaEscrita, vacia1, vacia2, oculta] : []);
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

    t.caso("Normalidad fija: si el número de casillas de hoy no coincide con las 36 de la plantilla fija, avisa el desajuste sin dejar de aplicar", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      const vacia = campoFalso("");
      cv.env.doc.querySelectorAll = (sel) => (sel === 'input[id="alert_message"][type="text"]' ? [vacia] : []);
      const alertas = [];
      cv.ctx.alert = (m) => alertas.push(String(m));
      btnN.onclick();
      t.igual(vacia.value, "NEGATIVO PARA LESIONES, PRURITO O CAMBIOS DE COLORACIÓN.", "aun con desajuste, sí aplica lo que puede (posición 0)");
      t.cierto(alertas.some((a) => a.includes("⚠️") && a.includes("1 casilla(s)") && a.includes("36")), "avisa el desajuste con ambas cifras");
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

    await t.casoAsync("openAgendamientoModal: flujo completo — turnos reales, aviso de agenda ajena y confirmación habilitada", async () => {
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
            return respuestaJson({ agendas: [{ agendaId: 55, medico: "OTRO PROFESIONAL", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
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
      cFull.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(60);
      const modal = cFull.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      t.igual(slots.children.length, 2, "un aviso + un turno");
      t.cierto(slots.children[0].textContent.includes("No se identificó su agenda propia"), "sin nombre de médico se advierte que la agenda puede ser ajena");
      const botonTurno = slots.children[1];
      t.cierto(botonTurno.innerHTML.includes("08:00 AM"));
      t.cierto(botonTurno.innerHTML.includes("OTRO PROFESIONAL"), "el profesional se muestra SIEMPRE");
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

    await t.casoAsync("openOrdenamientoModal: sin coincidencia PyM todo sale DESMARCADO con aviso", async () => {
      await cOrd.api.openOrdenamientoModal({ doc_id: "999", nombre: "PEDRO GOMEZ", pym: [] });
      const modal = ultimoOrd();
      t.cierto(!!modal);
      t.cierto(modal.innerHTML.includes("No se detectaron actividades pendientes"));
      t.cierto(modal.innerHTML.includes("sin marcar"));
      t.falso(modal.innerHTML.includes(" checked"), "ninguna casilla premarcada sin coincidencia explícita");
      const items = modal.innerHTML.split("vgl-ord-item").length - 1;
      t.igual(items, cOrd.api.__PYM_CATALOG.length, "se ofrecen todas las actividades del catálogo");
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

    t.caso("imprimirRecordatorioCita: reproduce la URL real capturada (CitaId=radicado, Eps y nombreCompleto codificados)", () => {
      const c = cargar();
      const llamadas = mockOpen(c);
      c.api.imprimirRecordatorioCita(7813686, "NUEVA EPS ", "MARIA LUZMILA CARMONA CARMONA");
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

    t.caso("mostrarPanelPostCita: el botón de imprimir dispara imprimirRecordatorioCita con los datos de ESTA cita", () => {
      const c = cargar();
      enriquecerDom(c);
      const llamadas = mockOpen(c);
      c.api.mostrarPanelPostCita(7813686, "NUEVA EPS", "MARIA LUZMILA CARMONA CARMONA", "fallback");
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      const printBtn = panel.querySelector("#vgl-postcita-print");
      disparar(printBtn, "click");
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

    // ================= createPymBannerUI / _refrescarBannerPym (T7) =================
    // v14.0.0 — Banner PyM superior, nivel 2 · persistente (D5). Reemplaza el aviso modal
    // de checkRecordatorioPym/pymAlert. D4: si la verificación contra Everest (T6) falla,
    // se muestra TODO como pendiente con un aviso honesto — nunca se apaga por una duda.
    function mockPacienteBanner(c, doc) {
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC " + doc, closest: () => null }] : []);
    }
    // Responde BuscarPaciente (resuelve pacienteId=777) y, según `ordenesResp`, el endpoint
    // de T6: una función (para simular fallo/malformado) o un valor JSON directo (éxito).
    function planBanner(ordenesResp) {
      return (url) => {
        if (String(url).includes("BuscarPaciente")) return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id: 777 }), text: async () => '{"id":777}' });
        if (String(url).includes("ObtenerOrdenamientoPorPacienteIdVigente")) {
          if (typeof ordenesResp === "function") return ordenesResp();
          return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ordenesResp, text: async () => JSON.stringify(ordenesResp) });
        }
        return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "{}" });
      };
    }
    const FALLO_RED = () => Promise.resolve({ ok: false, status: 500, headers: { get: () => null }, json: async () => null, text: async () => "" });

    t.caso("createPymBannerUI: fuera del módulo HCHealth no crea el banner", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/Acceso/";
      c.api.createPymBannerUI();
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner"));
    });

    t.caso("createPymBannerUI: en HCHealth pero sin paciente abierto no crea el banner", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/CitasDelDia";
      c.env.doc.getElementById = () => null;
      c.api.createPymBannerUI();
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner"));
    });

    t.caso("createPymBannerUI: paciente sin ninguna actividad PyM indexada no crea el banner (nada que reportar)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteBanner(c, "100000001");
      c.api.__state.pym = new Map();
      c.api.createPymBannerUI();
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner"));
    });

    await t.casoAsync("createPymBannerUI: todas las actividades ya cubiertas por una orden vigente reciente -> NO aparece el banner", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([{ cup: { codigo: "876802" }, estado: "PEN", fechaCreacion: "2026-08-01" }]) });
      mockPacienteBanner(c, "100000002");
      c.api.__state.pym = new Map([["100000002", ["Mamografía"]]]);
      // Z123 (mamografía) no tiene vigenciaDias confirmado -> SIEMPRE pendiente (D4), así
      // que para esta prueba se le fija una vigencia de prueba y se restaura después,
      // exactamente igual que la prueba de pymCubiertoPorOrdenVigente en suite_21.
      const z123 = c.api.__PYM_CATALOG.find((p) => p.cie10 === "Z123");
      z123.vigenciaDias = 365;
      try {
        await c.api._refrescarBannerPym("100000002");
        c.api.createPymBannerUI();
        t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner"), "mamografía cubierta por una orden reciente: nada pendiente, sin banner");
      } finally { delete z123.vigenciaDias; }
    });

    await t.casoAsync("createPymBannerUI: con actividades pendientes, el banner aparece con el contador y el botón Ordenar", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      mockPacienteBanner(c, "100000003");
      c.api.__state.pym = new Map([["100000003", ["VIH"]]]);
      // Simula que Everest (app-root de Angular) ya tiene contenido propio en el body ANTES
      // de que el banner se cree — D5: el banner debe EMPUJAR ese contenido (insertarse
      // ANTES, en flujo normal), nunca aparecer flotando encima ni después.
      const appRootEverest = c.env.doc.createElement("div");
      appRootEverest.id = "app-root-simulado-de-everest";
      c.env.doc.body.appendChild(appRootEverest);
      await c.api._refrescarBannerPym("100000003");
      c.api.createPymBannerUI();
      const banner = c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner");
      t.cierto(!!banner, "el banner quedó en el body");
      t.igual(banner, c.env.doc.body.children[0], "se inserta como PRIMER hijo del body, ANTES del contenido de Everest: lo empuja, no lo tapa (D5)");
      t.igual(c.env.doc.body.children[1], appRootEverest, "el contenido de Everest queda DESPUÉS del banner, no reemplazado ni cubierto");
      const contador = banner.children.find((n) => n.className === "vgl-pymb-barra").children.find((n) => n.className === "vgl-pymb-contador");
      t.igual(contador.textContent, "1");
      const item = banner.children.find((n) => n.className === "vgl-pymb-lista").children[0];
      t.cierto(item.children.some((n) => n.className === "vgl-pymb-item-btn" && n.textContent === "Ordenar"));
    });

    await t.casoAsync("createPymBannerUI (D4, LA MUTACIÓN OBLIGATORIA — condición de apagado): con la verificación CAÍDA, el banner se muestra con TODO pendiente y el aviso honesto", async () => {
      // fetch caído SÍ dispara el respaldo por GM_xmlhttpRequest dentro de pageFetchJson: se
      // mockea también para que falle rápido (si no, el arnés usa un no-op silencioso que
      // nunca resuelve la promesa — cuelga la prueba, no la hace fallar).
      const c = cargar({ silencioso: true, fetch: planBanner(FALLO_RED), gmxhr: (o) => o.onerror(new Error("fallo simulado (T7, prueba de la mutación obligatoria)")) });
      mockPacienteBanner(c, "100000004");
      c.api.__state.pym = new Map([["100000004", ["VIH"]]]);
      await c.api._refrescarBannerPym("100000004");
      c.api.createPymBannerUI();
      const banner = c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner");
      t.cierto(!!banner, "D4: ante la duda (verificación caída), el banner SE MUESTRA, nunca se apaga en silencio");
      const aviso = banner.children.find((n) => n.className === "vgl-pymb-aviso");
      t.cierto(!!aviso, "debe aparecer el texto honesto de que no se pudo verificar");
      t.cierto(aviso.textContent.includes("No se pudo verificar"));
    });

    await t.casoAsync("createPymBannerUI: etiquetas SIN paquete conocido en PYM_CATALOG (Optometría/Odontología) también cuentan como pendientes", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      mockPacienteBanner(c, "100000005");
      c.api.__state.pym = new Map([["100000005", ["Remisión a Optometría"]]]);
      await c.api._refrescarBannerPym("100000005");
      c.api.createPymBannerUI();
      const banner = c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner");
      t.cierto(!!banner);
      const item = banner.children.find((n) => n.className === "vgl-pymb-lista").children[0];
      t.cierto(item.className.includes("vgl-pymb-item-libre"));
      t.falso(item.children.some((n) => n.className === "vgl-pymb-item-btn"), "sin paquete conocido no hay CUPS que ordenar: sin botón");
    });

    t.caso("createPymBannerUI: primer tick de un paciente sin caché todavía — no pinta nada hasta que el refresco resuelva", () => {
      const c = cargar({ silencioso: true });
      mockPacienteBanner(c, "100000006");
      c.api.__state.pym = new Map([["100000006", ["VIH"]]]);
      // Sin refrescar la caché real (sin red mockeada): se inyecta directamente para
      // aislar esta prueba del ciclo async y probar solo la idempotencia del render.
      c.api.createPymBannerUI(); // dispara el refresco en vuelo, sin pintar todavía (paciente nuevo en caché)
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner"), "primer tick: la caché aún no tiene datos de este paciente, no pinta con datos viejos/ajenos");
    });

    await t.casoAsync("createPymBannerUI: al abrir un paciente DISTINTO, no reutiliza por error los pendientes del paciente ANTERIOR mientras se refresca el nuevo", async () => {
      // Paciente B necesita una etiqueta que SÍ empareje con PYM_CATALOG (dispara la rama
      // de _refrescarBannerPym que de verdad consulta la red vía apiAccesoBuscarPaciente):
      // solo esa rama tiene un await real que deja una ventana de "caché todavía vieja"
      // para observar — las otras dos ramas (sin etiquetas / sin paquete conocido)
      // resuelven de forma síncrona y no reproducen el bug real.
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      // Paciente A: etiqueta SIN paquete conocido -> _refrescarBannerPym resuelve sin red
      // (rama "nada que cruzar con T6"), así que puede quedar realmente en caché sin mocks.
      mockPacienteBanner(c, "100000009");
      c.api.__state.pym = new Map([
        ["100000009", ["Actividad exclusiva del paciente A, nunca debe verse para B"]],
        ["100000010", ["VIH"]],
      ]);
      await c.api._refrescarBannerPym("100000009");
      c.api.createPymBannerUI();
      const bannerA = c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner");
      t.cierto(!!bannerA, "el banner de A se pintó primero, con su propio pendiente");
      // Espía la reconstrucción de contenido (el bucle "while(...) removeChild(...)" que
      // createPymBannerUI usa para repintar): el DOM falso del arnés no borra de verdad con
      // remove()/removeChild() (ya documentado en otras pruebas de esta suite), así que
      // comprobar body.children después no distingue "se devolvió temprano, sin tocar nada"
      // de "se repintó con datos ajenos" — ambos casos dejan el mismo nodo en el mismo
      // lugar. Lo que SÍ distingue una rama de la otra es si el código LLEGÓ a reconstruir.
      let seReconstruyo = false;
      const removeChildOriginal = bannerA.removeChild.bind(bannerA);
      bannerA.removeChild = (n) => { seReconstruyo = true; return removeChildOriginal(n); };

      // Cambia de paciente (misma pestaña, el médico pasó al siguiente): la caché sigue
      // teniendo los datos de A todavía, porque el refresco de B aún no corrió.
      mockPacienteBanner(c, "100000010");
      c.env.doc.getElementById = (id) => (id === "vgl-pym-banner" ? bannerA : (id === "anamesis" ? { id: "anamesis" } : null));
      c.api.createPymBannerUI(); // SIN await: exactamente lo que pasa en un tick real
      t.falso(seReconstruyo, "bug real que esto previene: con B recién abierto y su refresco aún en vuelo, NO debe repintar el banner reutilizando los datos EN CACHÉ de A");
    });

    await t.casoAsync("createPymBannerUI: clic en minimizar colapsa el banner y persiste la preferencia (GM_setValue)", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      mockPacienteBanner(c, "100000007");
      c.api.__state.pym = new Map([["100000007", ["VIH"]]]);
      await c.api._refrescarBannerPym("100000007");
      c.api.createPymBannerUI();
      const banner = c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner");
      const toggle = banner.children.find((n) => n.className === "vgl-pymb-barra").children.find((n) => n.className === "vgl-pymb-toggle");
      t.falso(banner.className.includes("minimizado"));
      toggle._listeners.click[0]({ stopPropagation() {} });
      t.cierto(banner.classList.contains("minimizado"));
      t.igual(c.env.gm["vgl_banner_pym_minimizado"], "1");
      toggle._listeners.click[0]({ stopPropagation() {} });
      t.falso(banner.classList.contains("minimizado"));
      t.igual(c.env.gm["vgl_banner_pym_minimizado"], "");
    });

    await t.casoAsync("createPymBannerUI: se autolimpia al salir del módulo HCHealth", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      mockPacienteBanner(c, "100000008");
      c.api.__state.pym = new Map([["100000008", ["VIH"]]]);
      await c.api._refrescarBannerPym("100000008");
      c.api.createPymBannerUI();
      const banner = c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner");
      t.cierto(!!banner);
      let removido = false;
      banner.remove = () => { removido = true; };
      c.env.doc.getElementById = (id) => (id === "vgl-pym-banner" ? banner : null);
      c.env.win.location.pathname = "/viva/Acceso/";
      c.api.createPymBannerUI();
      t.cierto(removido, "el banner se quita del body al salir de HCHealth");
    });

    // ============ v14.0.0 — RED DE SEGURIDAD DEL BANNER (interruptor + fallback) ============
    // El invariante que estas 4 pruebas defienden es UNO solo y es clínico, no cosmético:
    // el médico NUNCA puede quedarse sin ninguna de las dos alertas de PyM. T7 apaga el
    // aviso modal (checkRecordatorioPym) y lo reemplaza por el banner; si el banner no
    // llega a pintarse en la página real de Everest — la suposición sobre el contenedor
    // raíz de Angular que nunca se pudo verificar sin abrir la página — el médico perdería
    // la alerta EN SILENCIO. Por eso tick() vuelve al aviso modal cuando el banner está
    // apagado por el interruptor de Ajustes, y también cuando createPymBannerUI() LANZA.
    //
    // El observable es directo y no depende de pintar el modal: checkRecordatorioPym marca
    // avisoMarcarVisto("pymrem|" + key) justo antes de llamar a pymAlert. Si esa marca
    // aparece, el aviso modal corrió; si no aparece, no corrió.
    function mockTickPymPendiente(c, doc) {
      // Paciente abierto en la Historia Clínica, con una actividad PyM pendiente real y
      // sin órdenes que la cubran — el escenario en el que el médico DEBE ver algo.
      mockPacienteBanner(c, doc);
      c.api.__state.pym = new Map([[doc, ["Tamización de VIH"]]]);
      return "pymrem|" + c.api.normalizeKey(doc);
    }

    await t.casoAsync("tick (banner ENCENDIDO): pinta el banner y NO dispara el aviso modal — el banner lo reemplaza, no se duplican", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      const uid = mockTickPymPendiente(c, "100000010");
      c.api.__S.bannerPym = true;
      await c.api._refrescarBannerPym("100000010");
      c.api.tick();
      t.cierto(!!c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner"), "el banner quedó pintado");
      t.falso(c.api.avisoYaVisto(uid), "con el banner encendido, el aviso modal NO corre: si corriera, el médico vería la franja Y el modal a la vez");
    });

    await t.casoAsync("tick (banner APAGADO por el interruptor): quita el banner y DEVUELVE el aviso modal — nunca se queda sin ninguno", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      const uid = mockTickPymPendiente(c, "100000011");
      // Primero con el banner encendido, para que exista de verdad en el DOM.
      c.api.__S.bannerPym = true;
      await c.api._refrescarBannerPym("100000011");
      c.api.createPymBannerUI();
      const banner = c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner");
      t.cierto(!!banner, "precondición: el banner existe antes de apagar el interruptor");
      // El DOM falso del arnés no borra de verdad con remove(): se espía la llamada, mismo
      // hallazgo ya documentado varias veces en esta suite.
      let removido = false;
      banner.remove = () => { removido = true; };
      c.env.doc.getElementById = (id) => (id === "vgl-pym-banner" ? banner : (id === "anamesis" ? { id: "anamesis" } : null));

      c.api.__S.bannerPym = false;
      c.api.tick();
      t.cierto(removido, "al apagar el interruptor, el banner se quita en el acto");
      t.cierto(c.api.avisoYaVisto(uid), "y el aviso modal de siempre VUELVE en el mismo tick — el médico no se queda sin alerta de PyM");
    });

    await t.casoAsync("tick (el banner LANZA): se atrapa y cae al aviso modal en el MISMO tick — la alerta clínica no se pierde en silencio", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      const uid = mockTickPymPendiente(c, "100000012");
      c.api.__S.bannerPym = true;
      await c.api._refrescarBannerPym("100000012");
      // Simula el riesgo REAL que no se pudo verificar sin abrir Everest: la inserción del
      // banner en document.body falla. Da igual la causa (contenedor raíz hostil, DOM
      // intervenido por Angular): lo que importa es que la alerta no desaparezca.
      c.env.doc.body.insertBefore = () => { throw new Error("insertBefore rechazado por el contenedor raíz"); };
      t.noLanza(() => c.api.tick(), "tick NO puede propagar la excepción: rompería el resto del latido (agenda, fraude, labs)");
      t.cierto(c.api.avisoYaVisto(uid), "con el banner roto, el aviso modal cubre el hueco en el mismo tick");
    });

    t.caso("S.bannerPym viene ENCENDIDO de fábrica, y solo un false explícito lo apaga (undefined = encendido)", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.__S.bannerPym, true, "de fábrica el banner está encendido: el rediseño es el comportamiento por defecto");
    });

    // La guarda de tick() es `S.bannerPym !== false`, no `!S.bannerPym`, y la diferencia
    // importa de verdad: CUALQUIER instalación anterior a v14 tiene ajustes guardados SIN
    // esta clave, así que S.bannerPym llega `undefined`. Con `!S.bannerPym` esos médicos
    // se quedarían en el aviso modal y el rediseño no se estrenaría nunca; con
    // `!== false` estrenan el banner, y solo un apagado EXPLÍCITO desde Ajustes lo revierte.
    await t.casoAsync("tick: ajustes viejos SIN la clave bannerPym (undefined) estrenan el banner, no se quedan en el aviso modal", async () => {
      const c = cargar({ silencioso: true, fetch: planBanner([]) });
      const uid = mockTickPymPendiente(c, "100000013");
      delete c.api.__S.bannerPym;   // exactamente lo que trae una instalación previa a v14
      await c.api._refrescarBannerPym("100000013");
      c.api.tick();
      t.cierto(!!c.env.doc.body.children.find((n) => n.id === "vgl-pym-banner"), "sin la clave guardada, el banner igual se pinta");
      t.falso(c.api.avisoYaVisto(uid), "y no cae al aviso modal: undefined no es un apagado explícito");
    });

  },
};
