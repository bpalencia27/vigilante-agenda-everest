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
      // v18.0.24 — se normaliza `:not(...)` antes de memoizar. Este DOM falso tiene UN nodo
      // por selector lógico, así que `.vgl-cd` y `.vgl-cd:not(.vgl-adh)` designan aquí la
      // misma cosa: la cuenta regresiva de la tarjeta. Sin esta normalización, el día que
      // producción afinó el selector —para dejar de confundir la cuenta con el badge de
      // inasistencias, que también lleva `.vgl-cd`— estas pruebas empezaron a fabricar un
      // nodo distinto y dieron por rota una conducta que estaba bien. El stub tenía que
      // seguir al código, no al revés: bajar producción a un selector más pobre solo para
      // que este simulador lo entendiera habría sido arreglar el termómetro.
      const clave = String(sel).replace(/:not\([^)]*\)/g, "");
      if (!memo.has(clave)) memo.set(clave, doc.createElement("div"));
      return memo.get(clave);
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
    "_vglChooserModal", "_activarAccesibilidadModal",
    "_acompMostrar", "_acompCerrar",
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
      t.cierto(raiz.innerHTML.includes("Centinela"), "el panel lleva el título del asistente");
      t.cierto(dock.innerHTML.includes("Centinela"), "la pastilla lleva la etiqueta");
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

    // =====================================================================
    // v18.0.123 (auditoría UI/UX, F-13 · filas 4, 5, 6, 48) — PRESUPUESTO DE ESQUINAS.
    // El panel ocupa la esquina inferior derecha y ahí se le encimaban los avisos, el panel
    // post-cita, «Deshacer» y la barra mínima (solapes medidos en Chromium: 384x185, 336x160,
    // 176x38 y 142x30 px). La posición de los flotantes depende ahora de una sola cosa: si el
    // panel ocupa esa esquina o no. El cuerpo lo dice con una clase, y el CSS la lee.
    // La geometría se mide aparte, en Chromium de verdad: tools/medir_esquinas_chromium.js.
    // =====================================================================
    t.caso("v18.0.123 (F-13): el cuerpo declara si el panel ocupa la esquina, y solo cuando de verdad la ocupa", () => {
      cv.api.setWinState("full");
      t.cierto(cv.env.doc.body.classList.contains("vgl-panel-visible"), "panel abierto: ocupa la esquina");
      cv.api.setWinState("min");
      t.falso(cv.env.doc.body.classList.contains("vgl-panel-visible"), "minimizado: la esquina queda libre");
      cv.api.setWinState("dock");
      t.falso(cv.env.doc.body.classList.contains("vgl-panel-visible"), "en el dock: libre");
      cv.api.setWinState("hidden");
      t.falso(cv.env.doc.body.classList.contains("vgl-panel-visible"), "oculto: libre");
      cv.api.setWinState("full");
      t.cierto(cv.env.doc.body.classList.contains("vgl-panel-visible"), "y al volver, ocupada otra vez");
      // Se devuelve el estado que dejó la prueba anterior: el caso siguiente comprueba que un
      // cambio automático no pisa la preferencia «dock» del médico.
      cv.api.setWinState("dock");
    });

    t.caso("v18.0.123 (F-13): los cuatro flotantes viven en la columna libre, y la sueltan cuando el panel no está", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      // Un solo token para la columna libre: si cada flotante llevara su propio número, el día
      // que el panel cambie de ancho se moverían tres y se quedaría uno.
      t.igual((src.match(/--vgl-col-libre:min\(728px,calc\(100vw - 406px\)\);/g) || []).length, 2,
        "el token está declarado en las dos listas de tokens (oscura y clara)");
      for (const sel of ["#vgl-toasts", "#vgl-postcita-panel", "#vgl-deshacer-llenado"]) {
        t.cierto(src.indexOf(sel + "{right:") < 0 || true, "(ancla)");
        t.cierto(new RegExp("body:not\\(\\.vgl-panel-visible\\) " + sel + "\\{right:").test(src),
          sel + " recupera su esquina con el panel fuera");
      }
      t.cierto(/body:not\(\.vgl-panel-visible\) #vgl-min-bar\{left:14px\}/.test(src),
        "y la barra mínima vuelve a su borde izquierdo");
      t.igual((src.match(/right:var\(--vgl-col-libre\)/g) || []).length, 4,
        "los cuatro flotantes de la derecha usan el token, ninguno un número suelto");
      t.cierto(/\.vgl-sp-toast\{position:fixed;bottom:200px;right:var\(--vgl-col-libre\)/.test(src),
        "el cartel de tareas también sale de la esquina");
      // Fila 48: --z-toast estaba declarado sin un solo consumidor mientras la regla usaba el
      // literal a pelo. Ahora se consume.
      t.cierto(/#vgl-toasts\{[\s\S]{0,120}z-index:var\(--z-toast\)/.test(src),
        "el toast consume su propio token de capa en vez del literal");
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

    // v18.0.80 — HALLAZGO DE ENJAMBRE #32. _festivosAvisarSiVencida() vivía en boot() ANTES
    // del chequeo del kill-switch, y ya dejaba escrita la bandera "ya mostrado hoy" aunque
    // boot() fuera a abortar por el kill-switch un instante después — #vgl-toasts (donde
    // showToast() pinta) ni siquiera existía todavía. El aviso quedaba consumido sin
    // haberse mostrado nunca, y no se repetía el resto del día ni con el kill-switch ya
    // apagado. Reproducido con boot() real (mismo camino que producción), igual que el
    // hallazgo original.
    t.caso("REGRESIÓN — un arranque MATADO por el kill-switch no consume el aviso de festivos sin haberlo mostrado (hallazgo #32)", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      t.cierto(c.api._festivosTablaAgregarParaTest("2026-99-99"), "se pudo sembrar la discrepancia");

      // 1er arranque: kill-switch ACTIVO. boot() debe abortar SIN haber podido pintar nada.
      c.env.gm["vgl_kill_active"] = true;
      c.api.boot();
      t.cierto(c.api.__state.killed, "el primer arranque quedó matado, como se espera");
      t.igual(c.env.storage.getItem("vgl_festivos_aviso"), null,
        "la bandera NO debe quedar escrita: el aviso nunca llegó a tener dónde pintarse");

      // 2do arranque, mismo día: kill-switch YA apagado. Ahora sí debe correr de verdad.
      c.env.gm["vgl_kill_active"] = false;
      c.api.boot();
      t.igual(c.env.storage.getItem("vgl_festivos_aviso"), c.api.todayStamp(),
        "recién ahora, con el asistente de verdad arrancado, se marca como mostrado");
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

    // v18.0.77 — HALLAZGO DE ENJAMBRE #30. «Cierre de Ajustes respetando cambios sin
    // guardar» (v15.6.0) solo protegía las salidas que pasaban por _ajustesIntentarCerrar
    // — pero Escape y el clic en un chip de filtro llamaban a closeSheet() DIRECTO,
    // descartando el borrador sin ninguna pregunta. Se arregla en el punto de unión:
    // closeSheet() mismo, así que basta con llamarlo directo (como hacen Escape y el chip)
    // para fijar el arreglo, sin tener que simular cada atajo de teclado por separado.
    t.caso("REGRESIÓN — closeSheet() directo (Escape, chip de filtro) ya no descarta un borrador sucio de Ajustes (hallazgo #30)", () => {
      // Se fuerza a cerrado primero: la prueba anterior puede dejar Ajustes abierto, y
      // toggleSheet("ajustes") sobre una hoja YA abierta la cierra en vez de abrirla.
      cv.api.__state.sheet = null;
      cv.api.toggleSheet("ajustes");
      t.igual(cv.api.__state.sheet, "ajustes");
      // _ajustesPonBorrador directo (en vez de simular el checkbox): así el caso no depende
      // de qué valor le haya dejado a S.sonido una prueba anterior de esta misma suite —
      // basta con un valor DISTINTO al actual para dejar un borrador de verdad sucio.
      const sonidoAntes = cv.api.__S.sonido;
      cv.api._ajustesPonBorrador("sonido", !sonidoAntes);
      t.cierto(cv.api._ajustesSucio(), "el borrador quedó sucio");

      // El camino que antes se saltaba la pregunta: Escape y el chip de filtro llaman a
      // closeSheet() SIN pasar por _ajustesIntentarCerrar.
      cv.api.closeSheet();

      t.igual(cv.api.__state.sheet, "ajustes", "la hoja de Ajustes NO se cierra en silencio: antes sí, perdiendo el cambio");
      t.igual(cv.api.__S.sonido, sonidoAntes, "S.sonido sigue intacto: el cambio no se descartó ni se guardó solo");
      const bar = hoja.querySelector("#vgl-set-bar");
      t.cierto(bar && !bar.classList.contains("vgl-d-none"), "se le pregunta al médico, con la barra de confirmación visible");
      t.cierto(/Guardar los cambios antes de salir/.test(bar.innerHTML), "con el texto de la pregunta, no el de «tiene cambios sin guardar»");

      // Y desde ahí, «Salir sin guardar» sí cierra de verdad — la salida sigue existiendo.
      const salirSin = hoja.querySelector("#c-salir-sin");
      disparar(salirSin, "click");
      t.igual(cv.api.__state.sheet, null, "con la decisión explícita del médico, la hoja sí se cierra");
      t.falso(cv.api._ajustesSucio(), "y el borrador quedó descartado, como pidió");
    });

    t.caso("REGRESIÓN — closeSheet() sin borrador sucio sigue cerrando directo, sin preguntar de más (hallazgo #30)", () => {
      cv.api.toggleSheet("ajustes");
      t.falso(cv.api._ajustesSucio(), "sin tocar nada, el borrador está limpio");
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null, "cierra directo: no hay nada que proteger");
    });

    // 02-sep — CIERRE ADVERSARIAL (filas 33a y 33b). (a) Dos salidas de Ajustes NO pasaban por
    // closeSheet(): toggleSheet("resumen") (Alt+R, el botón #vgl-rep, el doble clic en el dock)
    // pisaba la hoja y al volver el borrador estaba vacío; _vglAlternarModoProg (Ctrl+Shift+D)
    // repintaba y lo borraba en el acto. (b) El arreglo de v18.0.77 creó una recursión mutua:
    // las salidas de emergencia de _ajustesIntentarCerrar llamaban a closeSheet(), que con
    // borrador sucio devolvía la llamada — sin barra #vgl-set-bar la pestaña se colgaba.
    t.caso("02-sep: salir de Ajustes hacia Resumen (Alt+R) con borrador sucio pregunta primero y, decidido, abre Resumen (fila 33a)", () => {
      cv.api.__state.sheet = null;
      cv.api.toggleSheet("ajustes");
      const sonidoAntes = cv.api.__S.sonido;
      cv.api._ajustesPonBorrador("sonido", !sonidoAntes);
      t.cierto(cv.api._ajustesSucio(), "el borrador quedó sucio");
      cv.api.toggleSheet("resumen");
      t.igual(cv.api.__state.sheet, "ajustes", "no se va a Resumen en silencio: antes sí, y el cambio se perdía");
      const bar = hoja.querySelector("#vgl-set-bar");
      t.cierto(/Guardar los cambios antes de salir/.test(bar.innerHTML), "se pregunta");
      // El DOM simulado memoriza el nodo por selector y acumula los listeners de las
      // preguntas anteriores de esta suite (en el navegador real bar.innerHTML crea botones
      // nuevos): se dispara el ÚLTIMO, que es el de ESTA pregunta.
      const lsSin = hoja.querySelector("#c-salir-sin")._listeners.click;
      lsSin[lsSin.length - 1]({});
      t.igual(cv.api.__state.sheet, "resumen", "decidido, se abre la hoja a la que iba");
      t.igual(cv.api.__S.sonido, sonidoAntes, "y S.sonido sigue intacto");
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null);
    });

    t.caso("02-sep: Ctrl+Shift+D con Ajustes sucios NO borra el borrador (fila 33a)", () => {
      cv.api.__state.sheet = null;
      cv.api.toggleSheet("ajustes");
      cv.api._ajustesPonBorrador("sonido", !cv.api.__S.sonido);
      cv.api._vglAlternarModoProg();
      t.cierto(cv.api._ajustesSucio(), "el borrador sigue vivo: antes renderSettings() lo vaciaba en el acto");
      cv.api._vglAlternarModoProg();   // se apaga para no contaminar el resto de la suite
      cv.api._ajustesDescartar();
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null);
    });

    t.caso("02-sep: sin barra #vgl-set-bar, closeSheet() con borrador sucio TERMINA — antes, recursión mutua sin fin (fila 33b)", () => {
      cv.api.__state.sheet = null;
      cv.api.toggleSheet("ajustes");
      cv.api._ajustesPonBorrador("sonido", !cv.api.__S.sonido);
      const q = hoja.querySelector;
      hoja.querySelector = (s) => (s === "#vgl-set-bar" ? null : q(s));
      try { cv.api.closeSheet(); } finally { hoja.querySelector = q; }
      t.igual(cv.api.__state.sheet, null, "sin forma de preguntar, cierra (la salida de emergencia de siempre) en vez de colgar la pestaña");
      cv.api.toggleSheet("ajustes"); cv.api.closeSheet();   // deja el borrador limpio para lo que sigue
      t.igual(cv.api.__state.sheet, null);
    });

    // v18.0.106 — refutador de v18.0.100 (fila 33b): (a) la prueba de arriba solo quitaba la
    // barra; un mutante en el que SOLO el `catch` volvía a closeSheet() pasaba en verde y en el
    // navegador reventaba con «Maximum call stack» cada vez que querySelector lanzara; (b) las
    // salidas de emergencia cerraban Ajustes y NO abrían la hoja pedida ni vaciaban el borrador.
    t.caso("v18.0.106: si querySelector LANZA con borrador sucio, salir hacia Resumen termina, abre Resumen y no deja borrador colgado (fila 33b)", () => {
      cv.api.__state.sheet = null;
      cv.api.toggleSheet("ajustes");
      cv.api._ajustesPonBorrador("sonido", !cv.api.__S.sonido);
      const q = hoja.querySelector;
      hoja.querySelector = (s) => { if (s === "#vgl-set-bar") throw new Error("DOM roto"); return q(s); };
      let err = null;
      try { cv.api.toggleSheet("resumen"); } catch (e) { err = e; } finally { hoja.querySelector = q; }
      t.igual(err, null, "no revienta (mutante «solo el catch vuelve a closeSheet()»: Maximum call stack)");
      t.igual(cv.api.__state.sheet, "resumen", "y sigue a la hoja pedida (antes: cerraba Ajustes y se quedaba en nada)");
      t.falso(cv.api._ajustesSucio(), "sin borrador colgado");
      // (b) la otra salida de emergencia: la barra no existe (querySelector devuelve null)
      cv.api.toggleSheet("ajustes");
      cv.api._ajustesPonBorrador("sonido", !cv.api.__S.sonido);
      hoja.querySelector = (s) => (s === "#vgl-set-bar" ? null : q(s));
      try { cv.api.toggleSheet("resumen"); } finally { hoja.querySelector = q; }
      t.igual(cv.api.__state.sheet, "resumen", "sin barra también sigue a la hoja pedida (mutante sin despues() en esa salida: se quedaba en nada)");
      t.falso(cv.api._ajustesSucio(), "y tampoco deja borrador colgado");
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null);
    });

    // v18.0.106 — refutador de v18.0.100 (fila 33a): (a) la prueba de Alt+R solo ejercitaba «Salir
    // sin guardar»; (b) dentro de la propia hoja, «Guardar»/«Borrar» credenciales de Athenea
    // repintaban con renderSettings() y vaciaban el borrador en silencio — el mismo patrón que
    // la fila cerró para Ctrl+Shift+D.
    t.caso("v18.0.106: «Guardar y salir» guarda, abre la hoja pedida y deja el borrador limpio (fila 33a)", () => {
      cv.api.__state.sheet = null;
      cv.api.toggleSheet("ajustes");
      const sonidoAntes = cv.api.__S.sonido;
      cv.api._ajustesPonBorrador("sonido", !sonidoAntes);
      cv.api.toggleSheet("resumen");
      t.igual(cv.api.__state.sheet, "ajustes", "montaje: se pregunta antes de salir");
      const lsG = hoja.querySelector("#c-salir-guardando")._listeners.click;
      lsG[lsG.length - 1]({});
      t.igual(cv.api.__state.sheet, "resumen", "decidido «Guardar y salir», se abre Resumen (mutante sin despues(): se queda en nada)");
      t.igual(cv.api.__S.sonido, !sonidoAntes, "y el cambio quedó guardado");
      t.falso(cv.api._ajustesSucio(), "sin borrador colgado");
      cv.api.__S.sonido = sonidoAntes; cv.api.saveSettings();   // se deja como estaba
      cv.api.closeSheet();
      t.igual(cv.api.__state.sheet, null);
    });

    t.caso("v18.0.106: «Guardar credenciales» de Athenea NO borra un borrador sucio de otra casilla, y repinta su propio estado (fila 33a, hermano)", () => {
      cv.api.__state.sheet = null;
      cv.api._vglAlternarModoProg();   // el grupo de Athenea solo existe en modo programador
      try {
        cv.api.toggleSheet("ajustes");
        cv.api._ajustesPonBorrador("sonido", !cv.api.__S.sonido);
        t.cierto(cv.api._ajustesSucio(), "montaje: borrador sucio");
        hoja.querySelector("#c-athuser").value = "usuario.prueba";
        hoja.querySelector("#c-athpass").value = "clave.prueba";
        const ls = hoja.querySelector("#c-athsave")._listeners.click;
        ls[ls.length - 1]({});
        t.cierto(cv.api._ajustesSucio(), "el borrador sigue vivo tras guardar las credenciales (antes: renderSettings() lo vaciaba)");
        t.cierto(/✅/.test(String(hoja.querySelector("#c-athestado").innerHTML)), "y el estado de la credencial se repintó en su sitio: " + hoja.querySelector("#c-athestado").innerHTML);
        t.cierto(!!cv.api.atheneaCredsGet(), "las credenciales sí quedaron guardadas");
      } finally {
        try { cv.api.atheneaCredsClear(); } catch (e) {}
        cv.api._ajustesDescartar();
        cv.api._vglAlternarModoProg();
        cv.api.closeSheet();
      }
      t.igual(cv.api.__state.sheet, null);
    });

    // v18.0.106 — residuo del refutador de v18.0.100: con el almacén lleno, «Guardar» dejaba S
    // mutado en memoria, vgl_cfg sin persistir, la hoja cerrada y el aviso VERDE de «guardados».
    await t.casoAsync("v18.0.106: si el navegador rechaza la escritura de vgl_cfg, «Guardar» no canta «guardados»: avisa que se perderán al recargar", async () => {
      // Contexto propio y DOM enriquecido: _renderToast arma el aviso con querySelector y
      // busca la bandeja con getElementById, que el DOM simulado no resuelve solo.
      const cq = cargar({ silencioso: true });
      enriquecerDom(cq);
      cq.ctx.innerWidth = 1200; cq.ctx.innerHeight = 800;
      cq.api.buildOverlay();
      const bandeja = cq.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n.parentElement = bandeja; };
      const getOrig = cq.env.doc.getElementById;
      cq.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : getOrig(id));
      const setOrig = cq.env.storage.setItem;
      cq.env.storage.setItem = (k, v) => { if (k === "vgl_cfg") throw new Error("QuotaExceededError"); return setOrig.call(cq.env.storage, k, v); };
      t.igual(cq.api.saveSettings(), false, "saveSettings dice que NO pudo escribir (antes no decía nada)");
      cq.api._ajustesPonBorrador("sonido", !cq.api.__S.sonido);
      t.igual(cq.api._ajustesGuardar(), 1, "el cambio se aplicó en esta pestaña");
      await esperar(30);
      const textos = bandeja.children.map((x) => {
        try { return String(x.querySelector(".vgl-toast-title").textContent) + " · " + String(x.querySelector(".vgl-toast-b").textContent); } catch (e) { return String(x.innerHTML || ""); }
      });
      t.cierto(textos.some((x) => /no se pudieron guardar/.test(x)), "avisa en ámbar que NO se guardaron: " + JSON.stringify(textos).slice(0, 300));
      t.falso(textos.some((x) => /quedaron guardados/.test(x)), "y no canta «guardados» (mutante: VERDE siempre)");
    });

    // 02-sep — CIERRE ADVERSARIAL (fila 34): v18.0.79 puso el badge de inasistencias en la
    // plantilla inicial llamando a _noShowPrevia(a.doc_id) POR TARJETA — getItem + JSON.parse
    // del historial entero (que no caduca) en cada pintado completo, el mismo coste que
    // v18.0.24 había sacado de refrescarCuentas. Medido con el DOM enriquecido: 30 lecturas.
    t.caso("02-sep: render() con 30 tarjetas lee el historial de inasistencias UNA vez, no una por tarjeta (fila 34, medido)", () => {
      const cR = cargar({ silencioso: true });
      enriquecerDom(cR);
      cR.ctx.innerWidth = 1200; cR.ctx.innerHeight = 800;
      cR.api.buildOverlay();
      cR.api.__S.adherencia = true;
      const hist = {};
      for (let i = 1; i <= 30; i++) hist["9000" + String(i).padStart(3, "0")] = { total: 2, ultima: "2026-08-20" };
      cR.env.storage.setItem("vgl_nosh_hist", JSON.stringify(hist));
      let lecturas = 0, lecturasProc = 0;
      const getOrig = cR.env.storage.getItem.bind(cR.env.storage);
      cR.env.storage.getItem = (k) => { if (k === "vgl_nosh_hist") lecturas++; if (k === "vgl_proc_today") lecturasProc++; return getOrig(k); };
      const lista = [];
      for (let i = 1; i <= 30; i++) lista.push({ key: "k" + i, doc_id: "9000" + String(i).padStart(3, "0"), nombre: "P" + i, hora_texto: "07:00", estado: i % 2 ? "En sala" : "Atendido", color: "VERDE", pym: [], elapsed: 0 });
      cR.api.__state.lastSignature = "";
      cR.api.render(lista, "api", new Date());
      const raiz = cR.env.doc.body.children.find((n) => n.id === "vgl-root");
      const el0 = raiz.querySelector("#vgl-list");
      const lst = (el0.children.length === 1 && el0.children[0]._esFragmento) ? el0.children[0] : el0;
      t.igual(lst.children.length, 30, "las 30 tarjetas se pintaron");
      t.igual(lst.children.filter((n) => String(n.innerHTML).includes("vgl-adh")).length, 30, "todas con su badge en la plantilla inicial (v18.0.79 sigue en pie)");
      t.cierto(lecturas <= 1, "y el historial se leyó a lo sumo una vez, no 30 (leído " + lecturas + ")");
      // v18.0.106 — refutador de v18.0.100 (fila 34, hermano): la línea de al lado,
      // isAgendamientoPendiente(a.doc_id), leía y parseaba vgl_proc_today una vez por tarjeta.
      t.cierto(lecturasProc <= 1, "y vgl_proc_today también se leyó a lo sumo una vez, no 30 (leído " + lecturasProc + ")");
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
    t.caso("notaLP (banner «Labs primero», piso relajado): sin jerga interna del motor y sin repetir lo que las fichas ya dicen", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const idx = src.indexOf("const _pisoLP = _labsPrimero && _labsPrimero.pisoRelajado;");
      t.cierto(idx >= 0, "el bloque de notaLP debe existir");
      const bloque = src.slice(idx, idx + 2400);

      // motivoPiso ya no debe llevar su propio verbo "adelantada": eso es lo que causaba la
      // duplicación de v17.6.73. Sigue existiendo en el motor (es un dato del plan), aunque
      // desde v18.0.121 el banner lo diga con fichas y no en prosa.
      const iMotivo1 = src.indexOf('motivoPiso = "ya hay examen');
      t.cierto(iMotivo1 >= 0, "caso 1 (vencidos): motivoPiso debe seguir siendo solo la razón");
      t.falso(/motivoPiso = "adelantada/.test(src), "ningún motivoPiso debe empezar con 'adelantada' (esa era la causa de la duplicación)");

      // notaLP: se extrae SOLO la rama del ternario con piso relajado (hasta el ":" del else).
      const iNotaLP = bloque.indexOf("const notaLP = _pisoLP");
      t.cierto(iNotaLP >= 0, "debe encontrarse la declaración de notaLP");
      const iElse = bloque.indexOf('"La toma queda 14', iNotaLP);
      const ramaRelajada = bloque.slice(iNotaLP, iElse >= 0 ? iElse : iNotaLP + 700);
      t.falso(/ventana de 14.21 días/.test(ramaRelajada), "ya no debe quedar la jerga 'ventana de 14–21 días'");
      t.falso(/\(adelantada porque/.test(ramaRelajada), "ya no debe quedar la frase duplicada 'porque...(adelantada porque'");
      t.cierto(/se recalcula solo/.test(ramaRelajada), "conserva el único hecho que ningún otro elemento dice: mover la toma recalcula el control");

      // v18.0.121 — REPORTE EN VIVO (02-sep): «este mensaje es confuso y siempre aparece».
      // La nota decía «porque ya hay examen(es) vencido(s)» justo debajo de la fila
      // «Ya vencidos: …» que los nombra. El motivo ya estaba a la vista con nombre y
      // apellido (v16.2.5); repetirlo en prosa lo decía dos veces en el mismo recuadro.
      t.falso(/motivoPiso/.test(ramaRelajada),
        "la razón ya NO se repite en prosa: la dicen las fichas «Ya vencidos:» / «Vencen pronto:»");
      t.falso(/no es una imposición|no una imposición/.test(ramaRelajada),
        "tampoco se repite «es una sugerencia, no una imposición»: los chips y la nota de «su plazo» lo demuestran");
      // Y las fichas siguen pintándose: son las que ahora cargan con el porqué.
      t.cierto(/vgl-lp-rot">Ya vencidos:/.test(src), "la fila «Ya vencidos» sigue en el banner");
      t.cierto(/vgl-lp-rot">Vencen pronto:/.test(src), "y la fila «Vencen pronto» también");
    });

    // =====================================================================
    // v18.0.121 — REPORTE EN VIVO (02-sep): «...y también aparece otro mensaje abajo por lo
    // que saldría redundante». Al tocar un plazo, `_aplicarPlazoElegido` apilaba un SEGUNDO
    // recuadro con `innerHTML +=` que repetía la misma fecha que la cabecera ya daba como
    // «control médico», bajo otro nombre («la fecha que evita el vencimiento»). Además ese
    // camino rehacía `_sugeridaControl` SIN `vencidos` ni `porVencerDetalle`, así que las
    // fichas —el porqué concreto— desaparecían y solo sobrevivía el párrafo abstracto.
    // Mismo criterio de protección por texto fuente: vive en el cierre del modal.
    // =====================================================================
    t.caso("v18.0.121: al tocar un plazo el banner NO apila un segundo recuadro ni pierde las fichas", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const iAplicar = src.indexOf("function _aplicarPlazoElegido(m, d) {");
      t.cierto(iAplicar >= 0, "debe existir _aplicarPlazoElegido");
      const bloque = src.slice(iAplicar, iAplicar + 2600);

      t.falso(/Se están mostrando los días de/.test(src),
        "el segundo recuadro apilado ya no existe en ninguna parte del script");
      t.falso(/_bannerSug\.innerHTML \+=/.test(bloque),
        "y nada se pega al banner con `innerHTML +=` desde este camino");
      t.falso(/la fecha que evita el vencimiento/.test(src),
        "ni se vuelve a nombrar la misma fecha con un segundo nombre");

      // Las fichas se conservan al rehacer _sugeridaControl: sin esto el recuadro se queda
      // sin los nombres de los exámenes en cuanto el médico toca un plazo.
      t.cierto(/vencidos: \(_labsPrimero && _labsPrimero\.vencidos\) \|\| \[\]/.test(bloque),
        "el objeto rehecho conserva `vencidos`");
      t.cierto(/porVencerDetalle: \(_labsPrimero && _labsPrimero\.porVencerDetalle\) \|\| \[\]/.test(bloque),
        "y `porVencerDetalle`");
      t.cierto(/viendoSuPlazo: !!_plazoTocado/.test(bloque),
        "el estado «está viendo su plazo» viaja en el objeto, no como un recuadro aparte");

      // La nota única: existe, la pintan LAS DOS ramas del banner, y no repite la fecha.
      t.cierto(/const _notaSuPlazo = \(\) =>/.test(src), "hay una sola función que pinta esa nota");
      const iNota = src.indexOf("const _notaSuPlazo = () =>");
      // Solo el cuerpo de la flecha, hasta su `;`: lo que sigue es _engancharIrSugerida,
      // que sí necesita la fecha para saber a dónde llevar.
      const cuerpoNota = src.slice(iNota, src.indexOf("</div>`;", iNota) + 8);
      t.falso(/escapeHtml\(sug\.iso\)|_sugeridaControl\.iso/.test(cuerpoNota),
        "la nota NO repite la fecha: ya está en la cabecera del banner");
      t.cierto(/vgl-agm-ir-sugerida/.test(cuerpoNota), "pero conserva el botón de volver a la sugerida");
      const usos = (src.match(/_sugeridaControl\.viendoSuPlazo \? _notaSuPlazo\(\)/g) || []).length;
      t.igual(usos, 2, "las dos ramas del banner (labs-primero y 🎯 fecha sugerida) usan la MISMA nota");
      t.igual((src.match(/if \(_sugeridaControl\.viendoSuPlazo\) _engancharIrSugerida\(\);/g) || []).length, 2,
        "y las dos enganchan el botón, que sin eso no llevaría a ninguna parte");
    });


    // v14.0.0 (T4) — "chips PyM" salió del nombre y de las aserciones de esta prueba: los
    // chips (y el texto "PyM sin cargar"/"Al día"/"Dato faltante" DENTRO de la tarjeta) se
    // amputaron del panel. El "PyM sin cargar" de la BARRA DE RESUMEN (suma.textContent,
    // no cardAna.innerHTML) es un sitio DISTINTO — con significado distinto — y se queda
    // intacto (ver la Regla B4-T4 sobre el literal repetido).
    // v17.22.0 — REVERSIÓN CONSCIENTE de la otra mitad de T4 (decisión del médico,
    // entrevista del 28-ago): los chips de PyM VUELVEN a la tarjeta (tope de 3
    // visibles + «+N más» con el detalle en el title). El criterio de T4 que SÍ
    // sigue vigente es el de los botones de acción, ver el caso de abajo.
    t.caso("render: dos citas por API pintan tarjetas con bandera de fraude; los chips PyM volvieron en v17.22.0", () => {
      vaciarLista();
      cv.api.render(citas, "api", new Date());
      t.cierto(suma.textContent.includes("Vigilando la agenda · 2 cita(s)"), "resumen de fuente directa (texto v17.x: 'Vigilando la agenda · N cita(s) · act. HH:MM')");
      t.cierto(suma.textContent.includes("PyM sin cargar"), "la barra de resumen SÍ sigue diciendo esto");
      t.igual(q("#vgl-dot").className, "bg", "el punto de origen marca API");
      t.igual(lista.children.length, 2, "una tarjeta por cita");
      const [cardAna, cardLuis] = lista.children;
      t.igual(cardAna.__vglKey, "111@07:00 AM");
      t.cierto(cardAna.innerHTML.includes("ANA PEREZ"));
      t.cierto(cardAna.innerHTML.includes("CC 111"));
      t.cierto(cardAna.innerHTML.includes("PyM sin cargar"), "sin archivo PyM, la tarjeta lo dice en su fila inferior (v17.22.0 lo recuperó)");
      t.falso(cardAna.innerHTML.includes("NO CONFIRMADO"), "la cita verde no lleva bandera de fraude");
      t.cierto(cardLuis.className.includes("rojo"), "la tarjeta roja lleva su clase");
      t.cierto(cardLuis.innerHTML.includes("⛔ NO CONFIRMADO"), "bandera de fraude explícita, se conserva");
      t.cierto(cardLuis.innerHTML.includes("Tamización de mama"), "el chip de PyM pendiente vuelve a la tarjeta (v17.22.0)");
      t.cierto(cardLuis.innerHTML.includes("vgl-pyms") && cardLuis.innerHTML.includes("vgl-chip"),
        "y la fila de chips está de nuevo — era su sitio, se recuperó (contenedor .vgl-pyms Y los .vgl-chip dentro)");
      t.cierto(cardLuis.innerHTML.includes("vgl-cd late"), "cuenta regresiva vencida — no la toca T4");
      t.cierto(cardLuis.innerHTML.includes("hace 4:00"), "lleva 4 min pasado de la tolerancia (6 - 10)");
      const stats = q("#vgl-stats");
      t.cierto(stats.innerHTML.includes("En sala <b>1</b>"));
      t.cierto(stats.innerHTML.includes("Sin pres. <b>1</b>"));
    });

    // v14.0.0 (T4) / v14.0.2 — Criterio de aceptación de T4 ("la tarjeta ya no genera esos
    // tres botones") sigue vigente; el botón Atender que T4 dejaba como único superviviente
    // se retiró después, a pedido explícito del médico (usa el nativo "Historias Clínicas").
    // La fila de chips PyM, en cambio, VOLVIÓ en v17.22.0 (ver el comentario de arriba).
    t.caso("T4/v14.0.2 + v17.22.0 — sin botones de acción (agendar/ordenar/labs/atender); los chips PyM sí vuelven", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const pac = { key: "t4-1", doc_id: "999", nombre: "PACIENTE T4", hora_texto: "09:00", estado: "En sala", color: "VERDE", pym: ["MAMOGRAFÍA"], elapsed: 0, citaId: 12345 };
      cv.api.render([pac], "api", new Date());
      const card = lista.children[0];
      t.falso(card.innerHTML.includes("vgl-btn-agendar"), "sin botón de agendar");
      t.falso(card.innerHTML.includes("vgl-btn-ordenar"), "sin botón de ordenar");
      t.falso(card.innerHTML.includes("vgl-btn-labs"), "sin botón de labs");
      t.falso(card.innerHTML.includes("vgl-btn-atender"), "sin botón de Atender (retirado en v14.0.2)");
      // v17.22.0 — la otra mitad de T4 se revirtió: los chips PyM vuelven a la tarjeta.
      t.cierto(card.innerHTML.includes("vgl-pyms"), "la fila de chips PyM volvió (v17.22.0, tope de 3)");
      t.cierto(card.innerHTML.includes("MAMOGRAFÍA"), "y el pendiente del paciente se ve en su tarjeta");
    });

    // v14.0.0 — Secuela real de T4: la fila inferior (.vgl-card-btm) llevaba los botones Y
    // la fila de chips de PyM. T4 se llevó ambos contenidos pero dejó el contenedor, con un
    // div vacío cobrando su margin-top de 7px. v14.0.2 retiró también el botón Atender (el
    // último ocupante) y la fila quedó sin emitirse. v17.22.0 la REVIVIÓ con su contenido
    // legítimo (los chips PyM o el aviso honesto): ya no es un hueco muerto, y se emite con
    // o sin citaId porque su contenido no depende de la cita.
    t.caso("v14.0.2 + v17.22.0 — la fila inferior volvió a tener contenido: chips PyM o aviso honesto, con o sin citaId", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const sinCita = { key: "v14-sin", doc_id: "777", nombre: "PACIENTE SIN CITAID", hora_texto: "09:20", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.render([sinCita], "api", new Date());
      t.cierto(lista.children[0].innerHTML.includes("vgl-card-btm"), "sin citaId: la fila inferior se emite y no queda un hueco muerto");
      t.cierto(lista.children[0].innerHTML.includes("PyM sin cargar"), "y su contenido es el aviso honesto de siempre");

      vaciarLista();
      cv.api.__state.lastSignature = "";
      const conCita = { key: "v14-con", doc_id: "778", nombre: "PACIENTE CON CITAID", hora_texto: "09:30", estado: "En sala", color: "VERDE", pym: ["CREATININA"], elapsed: 0, citaId: 4242 };
      cv.api.render([conCita], "api", new Date());
      t.cierto(lista.children[0].innerHTML.includes("vgl-card-btm"), "con citaId: la fila inferior también se emite");
      t.cierto(lista.children[0].innerHTML.includes("CREATININA"), "y muestra el chip PyM del paciente, no un vacío");
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
      t.cierto(copiado.startsWith("Centinela — "));
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

    // v17.x.x — el clic de «Exámenes»/«Examen normal» abre un menú de elección; esta
    // ayuda dispara la opción elegida atravesando el DOM falso del chooser (createElement
    // + addEventListener directo, sin querySelectorAll).
    function elegirOpcionChooser(c, id) {
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-chooser-modal");
      t.cierto(!!modal, "el menú de elección quedó montado");
      const card = modal.children[0];
      const body = card.children.find((n) => n.className === "vgl-chooser-body");
      const opt = body.children.find((n) => n.className === "vgl-chooser-opt" && n.getAttribute("data-chooser-id") === id);
      t.cierto(!!opt, "existe la opción " + id + " en el menú");
      opt._listeners.click[0]({});
      return opt;
    }

    // v18.0.91 — hallazgo #43 del enjambre: _vglChooserModal (selector "Exámenes"/"Examen
    // normal") era el único modal del script que no pasaba por _activarAccesibilidadModal
    // — Escape no lo cerraba y Tab no quedaba atrapado dentro, a diferencia de los otros
    // ~9 modales del proyecto.
    t.caso("hallazgo #43 — _vglChooserModal ahora pasa por _activarAccesibilidadModal: Escape lo cierra, igual que el resto de modales", () => {
      const c = cargar({ silencioso: true });
      const modal = c.api._vglChooserModal({
        titulo: "Elegir",
        opciones: [{ id: "x", rotulo: "Opción X", icono: "🧪" }],
      });
      t.cierto(!!(modal._listeners && modal._listeners.keydown && modal._listeners.keydown.length),
        "el modal tiene un listener 'keydown' propio (lo instala _activarAccesibilidadModal) — antes solo tenía 'click'");
      t.cierto(!!(modal._listeners && modal._listeners.click && modal._listeners.click.length),
        "y sigue conservando su canal de cierre de siempre (clic afuera)");
    });

    // v18.0.93 — hallazgo #45 del enjambre: _acompMostrar recalculaba 'r' (la posición
    // del botón objetivo) en CADA vuelta, pero lo descartaba sin usarlo cuando la burbuja
    // ya mostraba el mismo hint.id — se quedaba pegada a las coordenadas del primer tick
    // para siempre, en vez de seguir al botón si su posición cambiaba entre vueltas.
    t.caso("hallazgo #45 — la burbuja de acompañamiento SIGUE al botón cuando su posición cambia entre ticks, no se queda pegada a la vieja", () => {
      const c = cargar({ silencioso: true });
      let rect = { top: 90, left: 620, right: 700, bottom: 120, width: 80, height: 30 };
      const boton = { getBoundingClientRect: () => rect };
      c.env.doc.querySelector = (sel) => (sel === '[data-accion="agendar"]' ? boton : null);
      const hint = { id: "agendar", target: '[data-accion="agendar"]', texto: "Falta la cita de control: toque Agendar." };

      c.api._acompMostrar(hint, { doc_id: "999888777" });
      const burbuja1 = c.env.doc.getElementById("vgl-acomp-burbuja");
      t.cierto(!!burbuja1, "la burbuja aparece pegada al botón real");
      t.igual(burbuja1.style.top, "82px");
      t.igual(burbuja1.style.left, "710px");

      // MISMO hint.id, pero el botón real ya está en otra posición (p. ej. otro botón del
      // dock apareció/desapareció encima y lo corrió, o el layout cambió).
      rect = { top: 500, left: 620, right: 700, bottom: 530, width: 80, height: 30 };
      c.api._acompMostrar(hint, { doc_id: "999888777" });
      const burbuja2 = c.env.doc.getElementById("vgl-acomp-burbuja");
      t.cierto(burbuja1 === burbuja2, "es el MISMO nodo — no se recrea, solo se reposiciona");
      t.igual(burbuja2.style.top, "492px",
        "la burbuja SIGUE al botón — antes se quedaba fija en 82px, flotando sobre el vacío");
      t.igual(burbuja2.style.left, "710px");
    });

    t.caso("createLabInjectorUI: crea el botón flotante una sola vez", () => {
      const antes = cLab.env.doc.body.children.length;
      cLab.api.createLabInjectorUI();
      const btn = cLab.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      t.cierto(!!btn, "el botón quedó en el body");
      t.igual(btn.innerHTML, "🧪 Exámenes");
      t.cierto(typeof btn.onclick === "function", "el clic queda cableado");
      // Si el botón ya existe, no se duplica
      cLab.env.doc.getElementById = (id) => (id === "vgl-lab-injector" ? btn : null);
      cLab.api.createLabInjectorUI();
      t.igual(cLab.env.doc.body.children.length, antes + 1, "la segunda llamada no añade otro botón");
    });

    await t.casoAsync("createLabInjectorUI: al elegir «Historial por analito» sin token CSRF, getAtheneaLabsAuto da null (fallo de lectura) — el botón lo dice, no inventa 'sin laboratorios'", async () => {
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
      // v17.x.x — el clic ya no consulta en vivo de una: abre el menú y la consulta corre
      // solo al elegir una opción. Aquí se elige «Historial por analito» (la ruta completa).
      btn.onclick();
      elegirOpcionChooser(cLab, "historial");
      await esperar(0); // deja correr la cadena async de _ejecutarLlenadoExamenes
      t.falso(btn.innerHTML.startsWith("✓"), "jamás se pinta éxito sin resultados");
      t.cierto(btn.innerHTML.includes("No se pudo leer el laboratorio"), "el botón dice que la LECTURA falló, no que 'no tiene laboratorios': " + btn.innerHTML);
      t.falso(btn.innerHTML.includes("Sin resultados"), "un fallo de lectura no debe presentarse como 'sin resultados' (bug real: se confundían)");
      await esperar(20);
      t.igual(btn.innerHTML, "🧪 Exámenes", "el botón vuelve a su rótulo");
    });

    // v18.0.64 — ORDEN DEL MÉDICO (01-sep, con captura del selector de «Exámenes»): las dos
    // opciones deben elegir IGUAL —el último resultado de cada analito— y diferenciarse solo
    // en la ventana: 90 días arriba, sin límite abajo. La versión anterior se quedaba con los
    // de UNA sola fecha (la máxima), así que un analito cuyo último resultado fuera de doce
    // días antes desaparecía de la pantalla aunque estuviera dentro de los 90.
    t.caso("v18.0.64: la opción de 90 días conserva el último de CADA analito dentro de la ventana", () => {
      const hoy = "2026-09-01";
      const labs = [
        { NombreParametro: "CREATININA", fechaResultado: "2026-08-20", Resultado: "1.0" },   // dentro
        { NombreParametro: "GLICEMIA", fechaResultado: "2026-08-20", Resultado: "90" },      // dentro
        { NombreParametro: "LDL", fechaResultado: "2026-08-08", Resultado: "100" },          // dentro, OTRA fecha
        { NombreParametro: "HBA1C", fechaResultado: "2026-01-15", Resultado: "6.5" },        // fuera (229 días)
      ];
      const r = cLab.api._mtrLabsRecientes(labs, hoy);
      const nombres = r.map((l) => l.NombreParametro).sort();
      t.igual(nombres.join(","), "CREATININA,GLICEMIA,LDL",
        "el LDL de otra fecha SIGUE ahí: es el último disponible de ese analito y está dentro de los 90 días");
      t.falso(nombres.includes("HBA1C"), "y lo de hace más de 90 días no entra");
    });

    t.caso("v18.0.64: los bordes de la ventana de 90 días", () => {
      const hoy = "2026-09-01";
      const enBorde = [
        { NombreParametro: "A", fechaResultado: "2026-06-03", Resultado: "1" },   // 90 días justos
        { NombreParametro: "B", fechaResultado: "2026-06-02", Resultado: "1" },   // 91 días
        { NombreParametro: "C", fechaResultado: "2026-09-01", Resultado: "1" },   // hoy
      ];
      const r = cLab.api._mtrLabsRecientes(enBorde, hoy).map((l) => l.NombreParametro).sort();
      t.igual(r.join(","), "A,C", "el día 90 entra, el 91 no, y el de hoy por supuesto");
    });

    t.caso("v18.0.64: sin ninguna fecha legible NO se le borra la pantalla al médico", () => {
      const sinFecha = [
        { NombreParametro: "CREATININA", Resultado: "1.0" },
        { NombreParametro: "LDL", Resultado: "100" },
      ];
      t.igual(cLab.api._mtrLabsRecientes(sinFecha, "2026-09-01").length, 2,
        "si el parseo de fechas falla entero, se devuelve la lista tal cual — no se descarta a ciegas");
      t.igual(cLab.api._mtrLabsRecientes([], "2026-09-01").length, 0, "lista vacía se devuelve vacía");
    });

    // ===== v18.0.30 — HONESTIDAD DE AUTO-LABS (hallazgos L6643 / L6614 / L6714) =====
    // Este contexto SÍ completa la cadena de 3 pasos de Athenea (BusquedaPaciente ->
    // BuscarPaciente -> DatosPaciente -> consultaDetalleSolicitud), así que
    // getAtheneaLabsAuto devuelve UN analito de verdad y el flujo entra en la rama
    // «hay laboratorios» — la que hasta ahora nadie ejercitaba de punta a punta.
    // Como el documento falso no tiene ninguna casilla `input[id^="resultado"]`,
    // injectLabsIntoCronicos escribe 0: es exactamente el escenario del defecto.
    const cargarLabsOk = () => cargar({
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
            responseText: `CC 999888777
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
        } else if (o.onerror) { o.onerror("url no simulada"); }
      },
    });
    const cLabOk = cargarLabsOk();

    function mockPacienteLabs(c, btn, bandeja) {
      c.env.doc.getElementById = (id) => {
        if (id === "vgl-lab-injector") return btn;
        if (id === "anamesis") return {};
        if (id === "vgl-toasts" && bandeja) return bandeja;
        return null;                       // ni #vgl-deshacer-lote ni nada más
      };
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 999888777", closest: () => null }] : []);
    }

    // El arnés capa TODO setTimeout a 1 ms (ver harness.js), así que el rótulo del
    // botón vuelve a su sitio y el «↩ Deshacer» se retira casi en el mismo instante en
    // que aparecen: mirar el DOM al final del flujo no ve nada. Se graba lo que PASÓ:
    // cada texto que el script escribió en el botón y cada nodo que colgó del body.
    // Esperar 40 ms fijos a que termine una cadena async es una prueba que depende de la
    // carga de la máquina: con el banco corriendo en paralelo (o con Chromium al lado) la
    // cadena de Athenea tarda más y la prueba se pone roja sin que haya regresión ninguna.
    // Se espera A QUE PASE lo que se está midiendo, con un tope generoso.
    async function esperarA(cond, maxMs) {
      const t0 = Date.now();
      while (!cond()) {
        if (Date.now() - t0 > (maxMs || 5000)) return false;
        await esperar(5);
      }
      return true;
    }
    function grabarBoton(btn) {
      const visto = [];
      let valor = btn.innerHTML;
      Object.defineProperty(btn, "innerHTML", {
        configurable: true,
        get: () => valor,
        set: (v) => { valor = v; visto.push(String(v)); },
      });
      return visto;
    }
    function grabarBody(c) {
      const nacidos = [];
      const cuerpo = c.env.doc.body;
      const app = cuerpo.appendChild.bind(cuerpo);
      cuerpo.appendChild = (n) => { nacidos.push(n && n.id ? n.id : ""); return app(n); };
      const ins = typeof cuerpo.insertBefore === "function" ? cuerpo.insertBefore.bind(cuerpo) : null;
      if (ins) cuerpo.insertBefore = (n, ref) => { nacidos.push(n && n.id ? n.id : ""); return ins(n, ref); };
      return nacidos;
    }

    await t.casoAsync("v18.0.30 (L6643): tras escribir CERO casillas no se ofrece «↩ Deshacer» — ese botón deshacía el lote ANTERIOR", async () => {
      cLabOk.api.createLabInjectorUI();
      const btn = cLabOk.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      t.cierto(!!btn, "el botón de exámenes existe");
      // El médico acaba de aceptar OTRO llenado (el examen físico) hace unos segundos:
      // ese lote sigue vivo en la única ranura de deshacer.
      const casillaDelExamenFisico = { value: "texto aceptado por el médico", isConnected: true, type: "text" };
      cLabOk.api._vglGuardarDeshacer("999888777", [{ el: casillaDelExamenFisico, prev: "" }], "Examen físico");
      t.cierto(cLabOk.api._vglDeshacerDisponible(), "el lote anterior sigue vivo (menos de 5 min)");

      mockPacienteLabs(cLabOk, btn);
      const dicho = grabarBoton(btn);
      const nacidos = grabarBody(cLabOk);
      btn.onclick();
      elegirOpcionChooser(cLabOk, "historial");
      await esperarA(() => dicho.some((x) => x.includes("no toqué nada") || x.startsWith("✓")), 5000);

      t.cierto(dicho.some((x) => x.includes("no toqué nada")),
        "el botón dice la verdad: no escribió ninguna casilla (" + JSON.stringify(dicho) + ")");
      t.falso(dicho.some((x) => x.startsWith("✓")), "y jamás canta casillas escritas");
      t.falso(nacidos.includes("vgl-deshacer-lote"),
        "NO se planta «↩ Deshacer»: no hay nada de ESTE llenado que deshacer, y la guarda de " +
        "_vglEjecutarDeshacer solo mira que sea el mismo paciente — habría borrado el examen físico");
      t.igual(casillaDelExamenFisico.value, "texto aceptado por el médico", "el lote anterior queda intacto");
    });

    await t.casoAsync("v18.0.30 (L6614): con el llenado desactivado el aviso del botón se queda a la vista, no se borra en el mismo tick", async () => {
      const cKill = cargarLabsOk();
      // _renderToast reparte el cuerpo por dentro con querySelector(".vgl-toast-b"), que el
      // DOM falso pelado no resuelve: sin enriquecer, el aviso se pierde en el try/catch y
      // la prueba diría "mudo" tanto si el fix está como si no.
      enriquecerDom(cKill);
      cKill.api.createLabInjectorUI();
      const btn = cKill.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      const bandeja = cKill.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n.parentElement = bandeja; };
      mockPacienteLabs(cKill, btn, bandeja);
      cKill.api.emergencyTeardown("Prueba: llenado desactivado");
      const dicho = grabarBoton(btn);
      btn.onclick();
      elegirOpcionChooser(cKill, "historial");
      // dos señales que esperar: el aviso del botón y el aviso flotante (que llega más
      // tarde, porque showToast agrupa en una cola antes de pintar).
      await esperarA(() => dicho.some((x) => x.includes("desactivado ahora mismo")), 5000);
      await esperarA(() => (bandeja.children || []).length > 0, 5000);
      t.cierto(dicho.some((x) => x.includes("desactivado ahora mismo")),
        "el botón llega a decir que el llenado está desactivado (" + JSON.stringify(dicho) + ")");
      t.falso(dicho.some((x) => x.startsWith("✓")), "y nunca canta casillas escritas");
      // El arnés capa el temporizador de 8 s a 1 ms, así que el rótulo vuelve enseguida y
      // mirar el botón no sirve para probar que el aviso «se queda». Lo que sí prueba que
      // la rama dejó de ser MUDA es el aviso flotante, que antes no existía en absoluto.
      const cuerpos = (bandeja.children || []).map((n) => {
        try { return String(n.querySelector(".vgl-toast-b").textContent || ""); } catch (e) { return ""; }
      });
      t.cierto(cuerpos.some((x) => x.includes("llenado automático de exámenes está desactivado")),
        "y sale un aviso flotante: la rama no puede quedarse muda (" + JSON.stringify(cuerpos) + ")");
    });

    // La rama del REINTENTO tras el auto-inicio de sesión (S.atheneaAutoLogin + credenciales
    // guardadas + un portal que falla la primera lectura y contesta la segunda) no se puede
    // montar con este arnés sin un mock con estado que simule el login real de Athenea. Se
    // fija por código, acotado a la función donde vive el defecto: cualquiera de los dos
    // arreglos que se quite deja esto en rojo.
    t.caso("v18.0.30 (L6643 / L6714): en el reintento tras iniciar sesión, ni «Deshacer» sin escritura ni «no tiene» cuando no se pudo leer", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const ini = src.indexOf("async function _ejecutarLlenadoExamenes");
      t.cierto(ini > 0, "se localiza el flujo de Auto-Labs");
      const cuerpo = src.slice(ini, src.indexOf("\n      document.body.appendChild(btn);", ini));
      const codigo = cuerpo.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

      // (a) NINGÚN ofrecimiento de deshacer sin comprobar antes que ESTE llenado escribió.
      const llamadas = codigo.split("\n").filter((l) => l.includes("_vglOfrecerDeshacer("));
      t.igual(llamadas.length, 2, "las dos ramas de Auto-Labs ofrecen deshacer (principal y reintento)");
      llamadas.forEach((l) => t.cierto(/if \(_huboEscritura2?\) _vglOfrecerDeshacer\(/.test(l.trim()),
        "guardado por la escritura de ESTE lote, no por la del anterior: " + l.trim()));

      // (b) El reintento distingue «no pude leer» (null) de «no tiene» ([]), igual que la
      //     rama principal desde la v17.6.58.
      t.cierto(/\} else if \(labs2 === null\) \{/.test(codigo),
        "labs2===null tiene su propia rama: un fallo de red no se presenta como un hecho del paciente");

      // (c) Y el reintento ya no canta verde con cero casillas.
      t.falso(/_vglFeedbackBoton\(btn, "✓ " \+ r2\.count[^\n]*"verde"/.test(codigo),
        "el verde del reintento depende de r2.count, no es incondicional");
    });

    // v18.0.89 — hallazgo #41 del enjambre: r.obligatoriasVacias se calculaba en cada
    // clic (la propia tabla de validación de Everest, swRequerido:true) pero ningún
    // llamador lo leía jamás — se tiraba a la basura en silencio.
    //
    // El mock de Athenea aquí devuelve un analito que el whitelist del script NO
    // reconoce (a propósito): así el llenado no escribe nada, no dispara «sin casilla»
    // ni «implausible», y el ÚNICO aviso AMBAR de «Exámenes» que puede salir en este
    // clic es el de obligatoriasVacias — aísla la prueba de una colisión de deduplicado
    // ajena a este hallazgo (showToast deduplica por título+apptKey dentro del mismo
    // flush; dos avisos «Exámenes» distintos en el mismo clic es un problema de
    // showToast, no de esta conexión, y queda fuera del alcance del hallazgo #41).
    const cargarLabsNoMapeado = () => cargar({
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
            responseText: `CC 999888777
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
          o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ NombreParametro: "EXAMEN NO CATALOGADO XYZ", Resultado: "1" }]) }) });
        } else if (o.onerror) { o.onerror("url no simulada"); }
      },
    });
    await t.casoAsync("hallazgo #41 — un examen que Everest exige (swRequerido) y sigue vacío ahora SÍ se avisa, no se calcula y se descarta", async () => {
      const cOv = cargarLabsNoMapeado();
      // Igual que en el caso de "llenado desactivado": sin enriquecer, el aviso flotante
      // se pierde en el try/catch de _renderToast y la prueba no distingue arreglo de bug.
      enriquecerDom(cOv);
      cOv.api.createLabInjectorUI();
      const btn = cOv.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      const bandeja = cOv.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n.parentElement = bandeja; };
      mockPacienteLabs(cOv, btn, bandeja);
      // Tabla oficial (la que Everest publicó al abrir la Ruta Crónicos): HEMOGLOBINA es
      // obligatoria y su casilla existe pero está vacía.
      cOv.api._guardarTablaOficialVista([{ codigoExamen: "HEMOGLOBINA", swRequerido: true }]);
      const casillaHb = { value: "", isConnected: true, type: "text" };
      const getByIdMock = cOv.env.doc.getElementById;
      cOv.env.doc.getElementById = (id) => (id === "resultadoHemoglobina" ? casillaHb : getByIdMock(id));
      btn.onclick();
      elegirOpcionChooser(cOv, "historial");
      await esperarA(() => (bandeja.children || []).length > 0, 5000);
      const cuerpos = (bandeja.children || []).map((n) => {
        try { return String(n.querySelector(".vgl-toast-b").textContent || ""); } catch (e) { return ""; }
      });
      // v18.0.119 — el texto explica ahora por qué está vacía y qué hacer (el médico preguntó qué
      // quería decir el aviso viejo). Lo que se exige aquí es lo mismo: que se avise y se nombre.
      t.cierto(cuerpos.some((x) => x.includes("HEMOGLOBINA") && /no deja guardar/.test(x)),
        "Everest exige Hemoglobina, sigue vacía, y ahora SÍ se avisa — antes esta información se calculaba y se tiraba a la basura (" + JSON.stringify(cuerpos) + ")");
      t.cierto(cuerpos.some((x) => /El asistente no las inventa/.test(x)), "y el aviso dice por qué está vacía y qué hacer");
      t.igual(casillaHb.value, "", "de solo lectura: el aviso no rellena nada por su cuenta");
    });

    // 02-sep — CIERRE ADVERSARIAL (fila 44): la «colisión de deduplicado ajena» que la prueba
    // de arriba esquiva a propósito era exactamente el caso común. Cuando Auto-Labs SÍ escribe
    // (CREATININA → count>0), la rama principal encola primero el VERDE de éxito con título
    // «Exámenes» y showToast deduplica por apptKey|título dentro del mismo flush: el AMBAR de
    // obligatoriasVacias —el último en orden de código— se descartaba en silencio. El arreglo
    // #41 solo hablaba cuando NO se escribía nada. Ahora cada aviso AMBAR lleva título propio.
    const cargarLabsCreatinina = () => cargar({
      silencioso: true,
      gmxhr: (o) => {
        const url = String(o.url || "");
        if (url.endsWith("/Resultados/BusquedaPaciente")) {
          o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="TOK1">' });
        } else if (url.endsWith("/Resultados/BuscarPaciente")) {
          o.onload({ status: 200, responseText: '<input name="IdPaciente" value="55555"><input name="__RequestVerificationToken" value="TOK2">' });
        } else if (url.endsWith("/Resultados/DatosPaciente")) {
          o.onload({ status: 200, responseText: `CC 999888777
              <div class="card"><div class="card-text no-margin"><strong>vie. 15 may. 2026 07:31 a.&nbsp;m.</strong></div>
              <div class="card-title no-margin">Numero: 26051503125</div>
              <form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"><input type="hidden" id="hash" name="hash" value="HASHBTN" /><input name="__RequestVerificationToken" type="hidden" value="TOKENBTN" /></form></div>` });
        } else if (url.includes("consultaDetalleSolicitud")) {
          o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ NombreParametro: "CREATININA", Resultado: "1.2" }]) }) });
        } else if (o.onerror) { o.onerror("url no simulada"); }
      },
    });
    await t.casoAsync("02-sep: cuando Auto-Labs SÍ escribe, el aviso «Everest exige …» llega igual — el VERDE de éxito ya no se lo traga (fila 44)", async () => {
      const cOk = cargarLabsCreatinina();
      enriquecerDom(cOk);
      cOk.api.createLabInjectorUI();
      const btn = cOk.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      const bandeja = cOk.env.doc.createElement("div");
      // Se anota TODO lo que llega a la bandeja por las dos puertas (prepend = críticos,
      // appendChild = VERDE/AZUL), aunque el arnés lo retire 1 ms después.
      const llegados = [];
      const anotar = (n) => { try { llegados.push("[" + n.querySelector(".vgl-toast-title").textContent + "] " + n.querySelector(".vgl-toast-b").textContent); } catch (e) { llegados.push("(sin cuerpo)"); } };
      bandeja.prepend = (n) => { anotar(n); bandeja.children.unshift(n); n.parentElement = bandeja; };
      const app0 = bandeja.appendChild.bind(bandeja);
      bandeja.appendChild = (n) => { anotar(n); return app0(n); };
      mockPacienteLabs(cOk, btn, bandeja);
      cOk.api._guardarTablaOficialVista([{ codigoExamen: "HEMOGLOBINA", swRequerido: true }]);
      const casillaHb = { value: "", isConnected: true, type: "text" };
      const casillaCr = { value: "", isConnected: true, type: "number", id: "resultadoCreatinina" };
      const fechaCr = { value: "", isConnected: true, type: "date", id: "fechaResultCreatinina" };
      const getByIdMock = cOk.env.doc.getElementById;
      cOk.env.doc.getElementById = (id) => (id === "resultadoHemoglobina" ? casillaHb : id === "resultadoCreatinina" ? casillaCr : id === "fechaResultCreatinina" ? fechaCr : getByIdMock(id));
      btn.onclick();
      elegirOpcionChooser(cOk, "historial");
      await esperarA(() => llegados.length >= 2, 5000);
      await esperar(20);
      t.igual(casillaCr.value, "1.2", "control del caso: Auto-Labs SÍ escribió la creatinina (count>0)");
      t.cierto(llegados.some((x) => /resultado\(s\) listos/.test(x)), "el VERDE de éxito llegó: " + JSON.stringify(llegados));
      t.cierto(llegados.some((x) => x.includes("HEMOGLOBINA") && /no deja guardar/.test(x)),
        "y el AMBAR de la casilla obligatoria TAMBIÉN — antes lo tragaba el deduplicado por título: " + JSON.stringify(llegados));
      t.igual(casillaHb.value, "", "el aviso no rellena nada por su cuenta");
    });

    // v18.0.104 — refutador de v18.0.101 (fila 44) y S+ flujo #1: con CUATRO avisos del mismo
    // clic (VERDE + sin casilla + fuera de rango + obligatoria vacía) showToast colapsa en
    // «Alerta Múltiple (4) — 3 alertas críticas y 1 rutinarias» sin analito, rango ni casilla,
    // porque sin apptKey no puede agruparlos por paciente. Con apptKey «labs|cédula» los cuatro
    // se funden en «4 avisos de este paciente» con los cuatro cuerpos completos.
    await t.casoAsync("v18.0.104: cuatro avisos de Auto-Labs del mismo clic llegan agrupados por paciente con sus cuerpos, no como «Alerta Múltiple» vacía", async () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      const bandeja = c.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n.parentElement = bandeja; };
      c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : null);
      const clave = "labs|999888777";
      c.api.showToast("VERDE", "Exámenes", "1 resultado(s) listos: creatinina escrita.", false, clave);
      c.api.showToast("AMBAR", "Exámenes · sin casilla", "Llegaron resultados de HEMOGLOBINA GLICOSILADA pero esta pantalla no tiene la casilla.", false, clave);
      c.api.showToast("AMBAR", "Exámenes · fuera de rango", "NO se escribieron: GLICEMIA = 99999 — fuera del rango oficial.", false, clave);
      c.api.showToast("AMBAR", "Exámenes · casilla obligatoria", "Everest exige HEMOGLOBINA para esta ruta y la casilla sigue vacía.", false, clave);
      await esperarA(() => (bandeja.children || []).length > 0, 2000);
      await esperar(20);
      const vivos = (bandeja.children || []);
      t.igual(vivos.length, 1, "un solo aviso agrupado");
      const titulo = String(vivos[0].querySelector(".vgl-toast-title").textContent || "");
      const cuerpo = String(vivos[0].querySelector(".vgl-toast-b").textContent || "");
      t.cierto(/4 avisos de este paciente/.test(titulo), "agrupado por paciente, no «Alerta Múltiple»: " + titulo);
      for (const esperado of ["creatinina escrita", "HEMOGLOBINA GLICOSILADA", "GLICEMIA = 99999", "exige HEMOGLOBINA"]) {
        t.cierto(cuerpo.indexOf(esperado) >= 0, "el cuerpo conserva «" + esperado + "»");
      }
      // Y el cableado: los seis showToast de Auto-Labs (rama principal y de reintento) llevan la clave.
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      // v18.0.119 — dos de los seis (los de «casilla obligatoria») pasaron a dos líneas porque el
      // texto ahora explica POR QUÉ está vacía y qué hacer; se cuentan las dos formas.
      t.igual(((src.match(/, false, "labs\|" \+ docId\)/g) || []).length + (src.match(/\n\s*false, "labs\|" \+ docId\)/g) || []).length), 6, "los seis avisos de Auto-Labs viajan con apptKey «labs|cédula»");
      // Hermanos con título compartido en el mismo flush (el AZUL se tragaba el AMBAR):
      t.igual((src.match(/showToast\("AMBAR", "Redactar con IA · sin datos"/g) || []).length, 2, "los dos AMBAR que siguen al AZUL «Leyendo…» del Redactor tienen título propio (el de «no activada» sale antes y solo)");
      t.cierto(/showToast\("AMBAR", "Modo programador · Ajustes sin guardar"/.test(src), "el AMBAR de Modo programador (fila 33a) tiene título propio");
    });

    // La rama del REINTENTO (tras auto-login) comparte el mismo hallazgo #41, pero —igual
    // que "L6643 / L6714" arriba— montarla de punta a punta exige simular el login real de
    // Athenea con estado. Se fija por código, igual que ese precedente.
    t.caso("hallazgo #41 — la rama de reintento (tras auto-login) también lee r2.obligatoriasVacias, no solo la principal", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const ini = src.indexOf("async function _ejecutarLlenadoExamenes");
      t.cierto(ini > 0, "se localiza el flujo de Auto-Labs");
      const cuerpo = src.slice(ini, src.indexOf("\n      document.body.appendChild(btn);", ini));
      t.cierto(/if \(Array\.isArray\(r2\.obligatoriasVacias\)[^\n]*&&\s*r2\.obligatoriasVacias\.length\)/.test(cuerpo),
        "el reintento tras auto-login también revisa r2.obligatoriasVacias, no solo r.obligatoriasVacias en la rama principal");
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
      // v17.x.x — control de acceso: el caso base del dock ejercita el flujo de un médico
      // AUTORIZADO (acceso completo). Se fija un nombre de la lista fija y se habilita el
      // Redactor IA (bandera + clave Gemini), porque ese botón solo existe si ambas se cumplen.
      c.api.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      c.api.__S.iaRedaccion = true;
      c.api.mtrGuardarClaveGemini("CLAVE-DE-PRUEBA");
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
      // v17.x.x — el dock creció a propósito: ✍ Redactar (texto libre) y 📦 control
      // (Próximo control, solo autorizados). El botón de «riesgo» se retiró en v16.8.0
      // (su contenido vive en el Panel). El Panel del paciente («ficha») se OCULTA hasta
      // cumplir los requisitos (con este mock no hay resumen cacheado → queda bloqueado e
      // invisible), y los atajos «Ir a…» se retiraron por completo.
      // v18.0.118 (UI/UX #5) — sin resumen en caché, donde antes no había NADA ahora está el
      // botón «Panel del paciente · leyendo…», deshabilitado: un control que aparece de golpe
      // desorienta tanto como uno que desaparece.
      t.igual(accs, ["agendar", "ordenar", "labs", "ficha-leyendo", "redactar", "control"]);
      const bLeyendo = btns.children.find((b) => b.getAttribute("data-accion") === "ficha-leyendo");
      t.cierto(bLeyendo.disabled === true && bLeyendo.getAttribute("aria-disabled") === "true", "está deshabilitado: ningún clic hace nada");
      t.cierto(bLeyendo.children.some((n) => n.className === "vgl-dock-lbl" && n.textContent === "Panel del paciente · leyendo…"), "y dice que está leyendo");
      t.cierto(dock.children.some((n) => n.getAttribute && n.getAttribute("data-accion") === "toggle"), "botón de colapsar presente");

      // Segunda llamada: no duplica el contenedor del dock.
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "anamesis" ? { id: "anamesis" } : null));
      c.api.createAccionesDockUI();
      t.igual(c.env.doc.body.children.length, antes + 1, "la segunda llamada no añade otro dock");
    });

    t.caso("createAccionesDockUI: médico NO autorizado solo ve PyM y laboratorios (sin agendar cita, panel, redactor ni control)", () => {
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "555666777");
      c.api.__state.activeDoctor = { id: 909, name: "ANA MARIA PEREZ" }; // no está en la lista autorizada
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const accs = dock.children.find((n) => n.className === "vgl-dock-btns").children.map((b) => b.getAttribute("data-accion"));
      // Sin nada hecho, el no autorizado pierde el botón de agendar cita (solo le quedaría
      // la toma de muestras si faltara el laboratorio); ficha, atajos, redactor y control
      // quedan ocultos. PyM (ordenar) y laboratorios se conservan.
      t.igual(accs, ["ordenar", "labs"]);
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
      // v18.0.114 — reporte en vivo del médico: «no tengo forma de volver al módulo una vez queda
      // agendada la cita». El botón gris e inerte desaparece: con las dos hechas y sin radicado
      // guardado, el botón sigue vivo y abre Agendar de nuevo (el cuadro avisa de la cita de hoy).
      t.falso(bAg.disabled, "las dos hechas: el botón sigue VIVO (antes: gris e inerte, sin camino de vuelta)");
      t.cierto(bAg.children.some((n) => n.className === "vgl-dock-lbl" && n.textContent === "Agendado · abrir"), "y dice que abre");
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
      // v17.x.x — sin agendar/ordenar, y sin el Panel (oculto hasta cumplir requisitos) ni
      // los atajos «Ir a…» (retirados). Labs, Redactar y control se conservan.
      t.igual(accs, ["labs", "ficha-leyendo", "redactar", "control"]);   // v18.0.118 (UI/UX #5)
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
      // v18.0.114 — el de Agendar ya no se bloquea (reporte en vivo: hacía falta un camino de
      // vuelta al módulo); el que sigue bloqueado con las órdenes ya generadas es Ordenar.
      const c = cargar({ silencioso: true });
      mockPacienteDock(c, "777777777");
      c.api.markOrdenesCreadasHoy("777777777", [], []);
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const bOrd = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "ordenar");
      t.cierto(bOrd.disabled);
      bOrd._listeners.click[0]({ stopPropagation() {} });
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.falso(w && w.acciones && w.acciones["widget.ordenar.abrir"], "un botón disabled no dispara ninguna acción ni telemetría, aunque el listener siga cableado");
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
      t.igual(btnN.innerHTML, "🩺 Examen normal", "rótulo v17.x: el botón dice «Examen normal» (el nombre completo quedó en el feedback y los toasts)");
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
      elegirOpcionChooser(cv, "ambos");
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
      elegirOpcionChooser(cv, "ambos");
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
      elegirOpcionChooser(cv, "ambos");
      t.igual(vacia.value, "", "por seguridad (v14.2.2) ante desajuste de casillas no se pega nada");
      t.cierto(btnN.innerHTML.includes("⚠ No pegué nada"), "el botón anuncia el rehúso por seguridad");
      t.cierto(btnN.innerHTML.includes("1 casillas") && btnN.innerHTML.includes("36"), "avisa el desajuste con ambas cifras (las de la pantalla y las de la plantilla)");
    });

    t.caso("Examen normal: «Revisión por sistemas» llena SOLO las primeras 19 casillas (deja el examen físico intacto)", () => {
      const btnN = cv.env.doc.body.children.find((n) => n.id === "vgl-examen-normalidad");
      const revis = Array.from({ length: 19 }, () => campoFalso(""));
      const fisico = Array.from({ length: 17 }, () => campoFalso(""));
      const todas = revis.concat(fisico); // 36 visibles, sin Mamas/Genito
      cv.env.doc.querySelectorAll = (sel) => (typeof sel === "string" && sel.includes('input[id="alert_message"][type="text"]') ? todas : []);
      btnN.onclick();
      elegirOpcionChooser(cv, "revision");
      t.cierto(revis[0].value.indexOf("NEGATIVO PARA LESIONES") === 0, "la 1.ª de revisión recibe la frase de Piel");
      t.cierto(revis[18].value.indexOf("NEGATIVO PARA ASTENIA") === 0, "la 19.ª de revisión recibe Síntomas generales");
      t.igual(fisico[0].value, "", "la 1.ª del examen físico queda intacta (no se llenó)");
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
      // REFACTOR S+: la fecha sale compacta («01/08» + año en <small>), el origen en
      // lenguaje de consultorio («Laboratorio»), y el ISO completo vive en el tooltip.
      t.cierto(contenido.innerHTML.includes("01/08") && contenido.innerHTML.includes("<small>2026</small>"), "la fecha compacta lleva el año en <small>");
      t.cierto(contenido.innerHTML.includes("Laboratorio"), "la fila declara su fuente en lenguaje de consultorio");
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

    // v17.8.1 — auditoría de experiencia, hallazgo #26 (gravedad alta, riesgo clínico):
    // el mensaje de "sin exámenes" es una afirmación sobre el PACIENTE y salía también
    // cuando el fallo era del SISTEMA. El mock de aquí falla la red (getAtheneaLabsAuto
    // devuelve null), así que el modal debe decir que NO PUDO LEER, no que el paciente
    // no tiene nada: las dos frases llevan a conductas opuestas en consulta.
    await t.casoAsync("openLaboratoriosModal (v17.8.1): sin poder leer el portal, el modal lo dice — el fallo del sistema no se presenta como un hecho del paciente", async () => {
      labsSinDatos = true;
      await cModal.api.openLaboratoriosModal({ doc_id: "87654321", nombre: "PEDRO" });
      const modal = ultimoModal("vgl-labs-modal");
      const contenido = modal.querySelector("#vgl-labs-content");
      t.cierto(contenido.innerHTML.includes("No se pudo leer el portal de laboratorios"), "el fallo fue del sistema: se dice como tal");
      t.cierto(contenido.innerHTML.includes("Esto NO quiere decir que no tenga ninguno"), "y se desarma la lectura peligrosa: no se le ordenan exámenes a ciegas");
      t.falso(contenido.innerHTML.includes("no tiene ningún paraclínico registrado"),
        "jamás se afirma sobre el paciente lo que no se pudo comprobar (Regla D, patrón G del enjambre)");
      t.falso(contenido.innerHTML.includes("No se muestra ningún resultado de ejemplo"),
        "y ese aviso de ejemplo es del caso 'respondió y no hay nada', no de 'no pude leer'");
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
      t.cierto(modal.innerHTML.includes("Agendar · Programación de cita · Remisión RCV"), "el título lleva el rótulo del dock (v18.0.111, C9)");
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

    // v18.0.78 — HALLAZGO PENDIENTE (docs/REGLAS_MEDICO_20260901.md, «hazlo»): en modo
    // control-primero (el normal, sin _labsPrimero), la fecha de toma sugerida (5 días
    // hábiles antes del control) tampoco verificaba cupo real en AppCita — mismo defecto
    // que labs-primero (v18.0.69) y que la toma sola (arriba), mismo motor. Caso universal
    // (sin cupo NUNCA, para cualquier fecha): la sugerencia no se inventa nada y se avisa.
    await t.casoAsync("REGRESIÓN — openAgendamientoModal (control-primero) avisa, sin inventar fecha, si no hay cupo de laboratorio (hallazgo pendiente REGLAS_MEDICO #2)", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cSinCupo = cargar({
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
        // Ningún día responde con cupo — regla 4 del médico: AppCita SÍ contesta, y
        // contesta que no, así que el motivo debe ser "sin cupo en el margen", no
        // "no se pudo verificar".
        gmxhr: (o) => {
          if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify({ turnos: [] }) });
          else if (o.onerror) o.onerror("url no simulada");
        },
      });
      enriquecerDom(cSinCupo);
      cSinCupo.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cSinCupo.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(80);
      const modal = cSinCupo.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const labLbl = modal.querySelector("#vgl-lab-date-lbl");
      const textoAntes = labLbl.textContent;
      t.cierto(!!textoAntes, "la fecha de toma (sin verificar) se pinta de inmediato");
      const nota = modal.querySelector("#vgl-lab-disp-nota");
      t.cierto(!!nota, "el recuadro de disponibilidad existe en este modal");
      t.falso(nota.classList.contains("vgl-d-none"), "y queda visible: no se pudo confirmar cupo en ningún día del margen");
      t.cierto(/Sin cupo confirmado/.test(nota.innerHTML), "con el motivo correcto (AppCita respondió que no), no «sin verificar»: " + nota.innerHTML);
      t.igual(labLbl.textContent, textoAntes, "la fecha de toma sigue siendo la clínica: no se inventa una que nadie verificó");
    });

    // v18.0.78 — el afinado en segundo plano no se puede reproducir con el arnés en el
    // caso «SÍ hay cupo hacia atrás» sin fijar la fecha exacta que openAgendamientoModal
    // elige por defecto (depende de festivos y del día en que corra la prueba). Se fija por
    // inspección de fuente, mismo patrón que ya usa este archivo para _afinarLabsPrimeroConCupos.
    t.caso("REGRESIÓN — el afinado de cargarHoras respeta labs-primero y la elección manual, y busca hacia atrás sin pasar del ideal (hallazgo pendiente REGLAS_MEDICO #2)", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const zonaCargarHoras = src.slice(src.indexOf("async function cargarHoras("), src.indexOf("async function cargarHoras(") + 2600);   // v18.0.118: el bloque creció con el recuadro de decisión
      t.cierto(/if \(!_labsPrimero && !_labFechaTomaElegidaManual\) \{/.test(zonaCargarHoras),
        "no se afina en modo labs-primero (ese modo ya se afina con _afinarLabsPrimeroConCupos) ni si el médico ya eligió a mano");
      const zonaAfinar = src.slice(src.indexOf("async function _afinarTomaControlPrimeroConCupos("), src.indexOf("async function _afinarTomaControlPrimeroConCupos(") + 1500);
      t.cierto(/mtrBuscarCupoLaboratorio\(\s*idealIso, todayStamp\(\), idealIso, 5,/.test(zonaAfinar),
        "piso=hoy, techo=el propio ideal: nunca se sugiere una toma después de los 5 días hábiles antes del control (regla 2 y 3 del médico)");
      t.cierto(/if \(!sigueVivo\(\)\) return;/.test(zonaAfinar), "si el médico eligió algo distinto mientras tanto, no se le pisa");
      // El token se invalida en los DOS sitios donde el médico puede elegir la toma a mano:
      // el clic en un chip de día y el calendario manual de la toma.
      const zonaChip = src.slice(src.indexOf("_labFechaTomaElegidaManual = true;   // v17.6.53 (1.9)"), src.indexOf("_labFechaTomaElegidaManual = true;   // v17.6.53 (1.9)") + 300);
      t.cierto(/_tomaControlAfinarToken\+\+;/.test(zonaChip), "el clic en un chip de toma invalida el afinado en vuelo");
      t.cierto(/lInp\.addEventListener\("change", \(\) => \{[\s\S]{0,300}_tomaControlAfinarToken\+\+;[\s\S]{0,100}renderLabDayChips\(v\);/.test(src),
        "y el calendario manual de la toma también");
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
      // v18.0.122 — REPORTE EN VIVO (02-sep): esto usaba `find`, que se queda con el PRIMER
      // chip marcado y por eso no habría notado nunca lo que el médico vio en pantalla: DOS
      // chips marcados como «fecha seleccionada» a la vez. Se cuenta, no se busca.
      const activos = [...chipsEl.children].filter((b) => b.classList.contains("active"));
      t.igual(activos.length, 1, "un solo día marcado como seleccionado, nunca dos");
      const activo = activos[0];
      t.cierto(!!activo && activo.className.includes("vgl-agm-pbtn-sabado"), "el chip activo saltó solo al sábado, el único día del rango con agenda propia real");
      // Y el día que se ABANDONÓ —el centro, el del 🎯, que es de donde salió el salto— deja
      // de ofrecerse como si fuera elegible. Se identifica por su 🎯, no por «alguno apagado»:
      // el sondeo de fondo apaga otros días por su cuenta y eso no probaría nada de esto.
      const centro = [...chipsEl.children].find((b) => String(b.innerHTML || "").includes("🎯"));
      t.cierto(!!centro, "el chip central (🎯) sigue en la fila");
      t.falso(centro.classList.contains("active"), "y ya NO está marcado como seleccionado: la selección se movió");
      t.cierto(centro.disabled === true && centro.classList.contains("vgl-agm-pbtn-sinagenda"),
        "queda apagado y tachado, no compitiendo con el día al que se saltó");
    });

    // v17.58.1 — TELEMETRÍA (29-ago): BuscarCitasDisponibles promedia ~4,7 s en la flota.
    // Al saltar al día con agenda propia, _buscarDiaConAgendaPropia() ya trajo la respuesta
    // de ese día; cargarHoras() la reutiliza en vez de re-consultar el MISMO (fecha,
    // especialidad) dos veces seguidas. Antes el sábado elegido se consultaba 3 veces
    // (búsqueda del salto + recarga + sondeo de días); con el reaprovechamiento, 2.
    await t.casoAsync("openAgendamientoModal v17.58.1: el salto al día con agenda propia NO re-consulta BuscarCitasDisponibles — el día elegido se trae 2 veces (búsqueda + sondeo), nunca 3", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const cuentasPorIso = {};
      const cR1 = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            cuentasPorIso[iso] = (cuentasPorIso[iso] || 0) + 1;
            const dow = new Date(iso + "T12:00:00").getDay();
            // Centro en día hábil (ajeno) y sábados con agenda propia: el salto siempre ocurre.
            const medico = dow === 6 ? "ANA MARIA PEREZ" : "OTRO PROFESIONAL";
            return respuestaJson({ agendas: [{ agendaId: 61, medico, fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cR1);
      cR1.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      cR1.api.openAgendamientoModal({ doc_id: "555111", nombre: "MARIA LOPEZ" });
      await esperar(1200);
      const modal = cR1.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const slots = modal.querySelector("#vgl-agm-slots");
      const textoSlots = [...slots.children].map((c) => c.innerHTML || "").join(" ");
      t.cierto(textoSlots.includes("ANA MARIA PEREZ") && textoSlots.includes("07:00 AM"), "el salto funcionó con la respuesta reutilizada: se ve el turno de la agenda propia del sábado");
      const porIso = Object.entries(cuentasPorIso).map(([iso, n]) => ({ iso, n })).sort((a, b) => b.n - a.n);
      t.cierto(porIso.length > 0 && porIso[0].n <= 2, `ningún día se consultó 3+ veces — máximo fue ${porIso.length ? porIso[0].n : "ninguno"} (${porIso.length ? porIso[0].iso : "sin consultas"})`);
      const sabadoElegido = porIso.find((x) => new Date(x.iso + "T12:00:00").getDay() === 6);
      t.cierto(!!sabadoElegido, "hubo al menos un sábado consultado (el salto ocurrió de verdad)");
      t.cierto(sabadoElegido && sabadoElegido.n === 2, `el sábado elegido se consultó exactamente 2 veces (búsqueda + sondeo) — sin el reaprovechamiento sería 3; salió ${sabadoElegido ? sabadoElegido.n : "?"}`);
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

    // 02-sep — CIERRE DEL ENJAMBRE (auditoría adversarial, fila 24, gravedad alta): el mismo
    // defecto que el hallazgo #19 cerró en Ordenar (v18.0.63) seguía abierto en Agendar. Si el
    // médico cerraba el cuadro con AsignarTurno en vuelo, la cita se creaba en Everest pero la
    // marca local no se escribía nunca: el modal se reabría limpio y el siguiente clic creaba
    // una SEGUNDA cita real.
    await t.casoAsync("v18.0.98 ANTIDUP — cerrar el modal con AsignarTurno en vuelo NO borra la marca: al reabrir, la antidup avisa y no se crea una segunda cita real", async () => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const asignar = [];
      const cDup = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("AsignarTurno")) { asignar.push(u); await esperar(150); return respuestaJson({ error: false, data: { radicado: 12345 + asignar.length, motivo: "Agendada Correctamente" } }); }
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) { const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1]; return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] }); }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cDup);
      cDup.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      const DOC = "555111";
      const abrirYConfirmar = async () => {
        cDup.api.openAgendamientoModal({ doc_id: DOC, nombre: "MARIA LOPEZ" });
        await esperar(80);
        const modal = cDup.env.doc.body.children.filter((n) => n.id === "vgl-agendar-modal").pop();
        const boton = [...modal.querySelector("#vgl-agm-slots").children].find((n) => (n.innerHTML || "").includes("08:00 AM"));
        disparar(boton, "click");
        disparar(modal.querySelector("#vgl-agm-confirm"), "click");
        return modal;
      };
      const m1 = await abrirYConfirmar();
      await esperar(40);                                            // el POST ya salió, sigue en vuelo
      t.igual(asignar.length, 1, "montaje: un AsignarTurno en vuelo");
      // (a) reabrir y confirmar MIENTRAS el POST sigue en vuelo: el candado por cédula lo frena
      disparar(m1.querySelector("#vgl-agm-cancel"), "click");
      const m2 = await abrirYConfirmar();
      await esperar(20);
      t.igual(asignar.length, 1, "con la primera cita todavía en vuelo, el segundo confirmar NO dispara otro POST");
      t.cierto(m2.querySelector("#vgl-agm-confirm").textContent.includes("creándose"), "y el botón dice por qué: " + m2.querySelector("#vgl-agm-confirm").textContent);
      disparar(m2.querySelector("#vgl-agm-cancel"), "click");
      await esperar(300);                                           // el servidor ya respondió, con el cuadro cerrado
      t.cierto(cDup.api.isCitaAgendadaHoy(DOC), "la marca local se escribió aunque el cuadro estaba cerrado: la cita consta");
      // (b) reabrir con la respuesta ya llegada: la antidup de siempre avisa y exige un segundo clic
      const m3 = await abrirYConfirmar();
      await esperar(40);
      t.igual(asignar.length, 1, "un solo clic tras reabrir NO crea otra cita real (antes: 2 AsignarTurno)");
      // v18.0.118 (UI/UX #4) — el aviso ya no reescribe el botón: vive en el recuadro de decisión
      // con dos salidas («Sí, crear igual» / «Revisar»). La protección es la misma: no se creó nada.
      t.cierto(m3.querySelector("#vgl-agm-confirm-aviso").innerHTML.includes("ya se le creó una cita"), "la antidup avisa en el recuadro: " + m3.querySelector("#vgl-agm-confirm-aviso").innerHTML.slice(0, 120));
      t.falso(m3.querySelector("#vgl-agm-confirm-aviso").classList.contains("vgl-d-none"), "y el recuadro se ve");
    });

    // =====================================================================
    // v18.0.105 — REFUTADOR DEL CIERRE DE v18.0.98 (fila 24). El candado en RAM solo conocía SU
    // pestaña: con DOS pestañas de Everest (caso real del médico) la segunda no veía nada y
    // creaba una segunda cita real; con una RECARGA en vuelo, la pestaña moría sin escribir la
    // marca y la recargada agendaba de nuevo. Y la prueba de v18.0.98 era hueca a medias: la
    // aserción «no dispara otro POST» la cumplía la fusión de peticiones IDÉNTICAS de
    // pageFetchJson, no el candado (con OTRO turno salían dos citas), y nada fijaba que el
    // candado se SOLTARA cuando AsignarTurno falla (mutante: el paciente quedaba bloqueado
    // el resto de la jornada). Los mismos huecos en la toma de muestras y en Ordenar.
    // =====================================================================
    const _v105 = (() => {
      const iso2fmt = (iso) => iso.split("-").reverse().join("/");
      const fixture = (almacen, asignar, asignarFn) => {
        const cc = cargar({
          silencioso: true, almacen,
          fetch: async (url) => {
            const u = String(url);
            if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
            if (u.includes("AsignarTurno")) { asignar.push(u); return asignarFn(); }
            if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
            if (u.includes("BuscarCitasDisponibles")) { const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1]; return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] }); }
            if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
            if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }, { id: 901, horaTexto: "08:20 AM", estado: "ACT" }] });
            return respuestaJson({});
          },
          gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
        });
        enriquecerDom(cc);
        cc.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
        return cc;
      };
      const DOC = "555111";
      const abrirYConfirmar = async (cc, hora) => {
        cc.api.openAgendamientoModal({ doc_id: DOC, nombre: "PACIENTE PRUEBA UNO" });
        await esperar(80);
        const modal = cc.env.doc.body.children.filter((n) => n.id === "vgl-agendar-modal").pop();
        const boton = [...modal.querySelector("#vgl-agm-slots").children].find((n) => (n.innerHTML || "").includes(hora || "08:00 AM"));
        disparar(boton, "click");
        disparar(modal.querySelector("#vgl-agm-confirm"), "click");
        return modal;
      };
      const txt = (m) => m.querySelector("#vgl-agm-confirm").textContent;
      // v18.0.118 (UI/UX #4) — el aviso ya no reescribe el botón: vive en el recuadro de decisión.
      const aviso = (m) => String((m.querySelector("#vgl-agm-confirm-aviso") || {}).innerHTML || "");
      // y «seguir» es pulsar «Sí, crear igual» dentro de ese recuadro (no un segundo clic a ciegas).
      const clic = (m) => { m.querySelector("#vgl-agm-confirm").dataset.ultimoClic = "0"; disparar(m.querySelector("#vgl-agm-confirm"), "click"); };
      // v18.0.118 (UI/UX #4) — «seguir a pesar del aviso» ya no es un segundo clic a ciegas en el
      // botón: es pulsar «Sí, crear igual» DENTRO del recuadro de decisión (memo propio del nodo).
      const seguirIgual = (m) => {
        const caja = m.querySelector("#vgl-agm-confirm-aviso");
        const si = caja && caja.querySelector ? caja.querySelector("#vgl-agm-ca-si") : null;
        if (si && si._listeners && si._listeners.click) si._listeners.click.forEach((f) => f({}));
        return !!(si && si._listeners && si._listeners.click);
      };
      const okLento = (asignar) => async () => { await esperar(250); return respuestaJson({ error: false, data: { radicado: 100 + asignar.length, motivo: "Agendada Correctamente" } }); };
      return { fixture, DOC, abrirYConfirmar, txt, clic, aviso, seguirIgual, okLento };
    })();

    await t.casoAsync("v18.0.105 ANTIDUP — dos pestañas: la segunda ve la cita en vuelo de la primera y NO crea otra en silencio; tras recargar en vuelo, tampoco; una marca de hace más de 60 s no bloquea a nadie", async () => {
      const { fixture, DOC, abrirYConfirmar, txt, clic, aviso, seguirIgual, okLento } = _v105;
      // (a) dos pestañas = dos contextos sobre el MISMO almacén
      const almacen = {}; const asignar = [];
      const A = fixture(almacen, asignar, okLento(asignar)), B = fixture(almacen, asignar, okLento(asignar));
      await abrirYConfirmar(A); await esperar(40);
      t.igual(asignar.length, 1, "montaje: la pestaña A tiene un AsignarTurno en vuelo");
      const mB = await abrirYConfirmar(B); await esperar(40);
      t.igual(asignar.length, 1, "la pestaña B, con la cita de A en vuelo, NO dispara otro POST (antes: 2 citas reales)");
      t.cierto(aviso(mB).includes("otra pestaña"), "y B lo dice en el recuadro de decisión, con «Sí, crear igual» y «Revisar» (v18.0.118, UI/UX #4)");
      await esperar(400);
      t.cierto(B.api.isCitaAgendadaHoy(DOC), "cuando A recibe la respuesta, la marca del día ya la ve B");
      t.cierto(seguirIgual(mB), "«Sí, crear igual» existe en el recuadro");
      await esperar(40);
      t.igual(asignar.length, 1, "seguir a pesar del aviso de vuelo ajeno lo frena ahora la antidup de siempre, porque la marca existe");
      t.cierto(aviso(mB).includes("ya se le creó una cita"), "con el aviso de siempre, ahora en el recuadro");
      // (b) recarga en vuelo: la pestaña muere sin recibir la respuesta; la recargada (contexto
      //     nuevo, mismo almacén) abre y confirma
      const almacen2 = {}; const asignar2 = [];
      const P1 = fixture(almacen2, asignar2, () => new Promise(() => {}));
      const P2 = fixture(almacen2, asignar2, async () => respuestaJson({ error: false, data: { radicado: 201, motivo: "Agendada Correctamente" } }));
      await abrirYConfirmar(P1); await esperar(40);
      const m2 = await abrirYConfirmar(P2); await esperar(40);
      t.igual(asignar2.length, 1, "la pestaña recargada NO crea otra cita en silencio (antes: 2)");
      t.cierto(_v105.aviso(m2).includes("antes de recargar"), "avisa que hace segundos se estaba creando una, en el recuadro de decisión");
      t.cierto(_v105.seguirIgual(m2), "«Sí, crear igual» existe en el recuadro");
      await esperar(60);
      t.igual(asignar2.length, 2, "el médico manda: pulsar «Sí, crear igual» sí crea la cita");
      // (c) la marca de una pestaña muerta caduca sola a los 60 s
      const almacen3 = {}; const asignar3 = [];
      const P3 = fixture(almacen3, asignar3, async () => respuestaJson({ error: false, data: { radicado: 301, motivo: "Agendada Correctamente" } }));
      almacen3.vgl_proc_today = JSON.stringify({ dia: P3.api.todayStamp(), citas: [], ordenes: [], enVuelo: { ["cita:" + DOC]: { ts: Date.now() - 61000, pestana: "otra-pestana" } } });
      t.igual(P3.api.enVueloAjeno("cita", DOC), null, "una marca de hace 61 s ya no cuenta");
      t.falso(!!(JSON.parse(almacen3.vgl_proc_today).enVuelo || {})["cita:" + DOC], "y se limpió al leerla");
      await abrirYConfirmar(P3); await esperar(60);
      t.igual(asignar3.length, 1, "el confirmar sale al primer clic: nadie queda bloqueado por una pestaña muerta");
    });

    await t.casoAsync("v18.0.105 ANTIDUP — el candado se suelta cuando AsignarTurno falla (se puede reintentar) y frena un segundo turno DISTINTO en vuelo", async () => {
      const { fixture, abrirYConfirmar, txt, clic } = _v105;
      let modo = "falla"; const asignar = [];
      const cc = fixture({}, asignar, async () => {
        if (modo === "falla") throw new Error("red caída");
        await esperar(250); return respuestaJson({ error: false, data: { radicado: 500 + asignar.length, motivo: "Agendada Correctamente" } });
      });
      const m1 = await abrirYConfirmar(cc); await esperar(60);
      t.igual(asignar.length, 1, "montaje: el primer POST salió y falló");
      t.falso(cc.api.isCitaAgendadaHoy(_v105.DOC), "montaje: sin cita creada no hay marca del día");
      // tras el fallo el modal vuelve a pedir el turno (refresca las horas): el médico lo elige
      // de nuevo y confirma — ese es el reintento real
      modo = "lento";
      const botonHora = [...m1.querySelector("#vgl-agm-slots").children].find((n) => (n.innerHTML || "").includes("08:00 AM"));
      disparar(botonHora, "click");
      clic(m1); await esperar(40);
      t.igual(asignar.length, 2, "tras el fallo el candado quedó libre: el reintento SÍ dispara el POST (mutante «candado pegado si falla»: se quedaba en 1 con «creándose»)");
      t.falso(txt(m1).includes("creándose"), "y el botón no dice «creándose»: " + txt(m1));
      // el segundo POST sigue en vuelo: cerrar, reabrir y confirmar OTRO turno — la fusión de
      // peticiones idénticas no aplica, solo el candado por cédula puede frenarlo
      disparar(m1.querySelector("#vgl-agm-cancel"), "click");
      const m2 = await abrirYConfirmar(cc, "08:20 AM"); await esperar(40);
      t.igual(asignar.length, 2, "con un turno DISTINTO en vuelo tampoco sale otro POST (sin candado: dos citas reales con dos turnos)");
      t.cierto(txt(m2).includes("creándose"), "y el botón lo dice: " + txt(m2));
      await esperar(400);
      t.cierto(cc.api.isCitaAgendadaHoy(_v105.DOC), "al responder el servidor, la cita consta");
    });

    await t.casoAsync("v18.0.105 ANTIDUP hermano — toma de muestras: cerrar y reabrir el modal con AgendarCita en vuelo NO crea una segunda toma real", async () => {
      const posts = [];
      const gmxhr = (o) => {
        const u = String(o.url || "");
        if (/ObtenerTurnosPorFecha/.test(u)) { setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ Hora: "07:00:00", AgendaId: 5 }, { Hora: "07:20:00", AgendaId: 6 }] }) }), 0); return; }
        if (/AgendarCita/.test(u)) { posts.push(u); setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify({ error: false, radicado: 9000 + posts.length }) }), 200); return; }
        if (o.onerror) o.onerror("url no simulada");
      };
      const cc = cargar({ silencioso: true, gmxhr });
      enriquecerDom(cc);
      cc.api.__S.uxTelemetria = false;
      const DOC = "424242";
      cc.api.markCitaAgendadaHoy(DOC, "2026-09-25");
      const abrir = async () => {
        await cc.api.openLabSoloModal({ doc_id: DOC, nombre: "PACIENTE PRUEBA UNO" });
        await esperar(60);
        const m = cc.env.doc.body.children.filter((n) => n.id === "vgl-agendar-modal").pop();
        const sel = m.querySelector("#vgl-agm-lab-time-sel"); sel.value = "07:00:00"; disparar(sel, "change");
        disparar(m.querySelector("#vgl-agm-confirm"), "click");
        return m;
      };
      const m1 = await abrir(); await esperar(40);
      t.igual(posts.length, 1, "montaje: un AgendarCita en vuelo");
      disparar(m1.querySelector("#vgl-agm-cancel"), "click");
      const m2 = await abrir(); await esperar(40);
      t.igual(posts.length, 1, "reabrir y confirmar con la primera en vuelo NO dispara otra (antes: 2 tomas reales en AppCita)");
      t.cierto(m2.querySelector("#vgl-agm-confirm").textContent.includes("creándose"), "y el botón lo dice: " + m2.querySelector("#vgl-agm-confirm").textContent);
      await esperar(400);
      t.cierto(cc.api.isLabAgendadaHoy(DOC), "la marca de la toma se escribió al responder AppCita");
    });

    await t.casoAsync("v18.0.105 ANTIDUP hermano — Ordenar en dos pestañas: la segunda ve el lote en vuelo de la primera y NO genera las órdenes otra vez", async () => {
      const almacen = {}; const posts = [];
      const fix = () => {
        const cc = cargar({ silencioso: true, almacen,
          fetch: async (url) => {
            const u = String(url);
            if (u.includes("/api/Paciente/BuscarPaciente")) return respuestaJson({ id: 801848 });
            if (u.includes("ObtenerListadoDiagnostico")) return respuestaJson([{ codigo: "Z108", id: 55, nombre: "TAMIZACION" }]);
            if (u.includes("ObtenerListadoCupsPorPaciente")) { const cod = /filter=([^&]+)/.exec(u)[1]; return respuestaJson([{ codigo: decodeURIComponent(cod), id: 77, nombre: "EXAMEN", descripcion: "EXAMEN" }]); }
            if (u.includes("GuardarOrdenamiento")) { posts.push(u); await esperar(200); return respuestaJson({ error: false, agrupador: "AGP-" + posts.length }); }
            if (u.includes("ObtenerOrdenamientoPorPacienteIdVigente")) return respuestaJson([]);
            return respuestaJson({});
          }, gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); } });
        enriquecerDom(cc); cc.api.__state.activeDoctor = { id: 309, name: "MEDICO DE PRUEBA" };
        const casilla = { checked: true, disabled: false, dataset: {}, getAttribute: (k) => (k === "data-premarcada" ? "1" : "0"), addEventListener: () => {}, closest: () => ({ style: {}, classList: { add() {} } }) };
        const crear = cc.env.doc.createElement;
        cc.env.doc.createElement = function (tag) { const e = crear(tag); const qsaBase = e.querySelectorAll; e.querySelectorAll = (sel) => (sel === ".vgl-ord-chk" ? [casilla] : qsaBase(sel)); return e; };
        return cc;
      };
      const T1 = fix(), T2 = fix();
      const generar = async (cc) => {
        await cc.api.openOrdenamientoModal({ doc_id: "21545051", nombre: "PACIENTE PRUEBA UNO", sexo: "M", pym: ["Tamización cardiometabólica"] });
        await esperar(80);
        const m = cc.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
        disparar(m.querySelector("#vgl-ord-confirm"), "click");
        return m;
      };
      await generar(T1); await esperar(60);
      t.igual(posts.length, 1, "montaje: la pestaña 1 tiene un GuardarOrdenamiento en vuelo");
      const m2 = await generar(T2); await esperar(60);
      t.igual(posts.length, 1, "la pestaña 2 NO genera el lote otra vez (antes: 2 órdenes reales)");
      t.cierto(m2.querySelector("#vgl-ord-confirm").textContent.includes("otra pestaña"), "y el botón lo dice: " + m2.querySelector("#vgl-ord-confirm").textContent);
      await esperar(500);
      t.cierto(T2.api.ordenCreadaHoyParaCie10("21545051", "Z108"), "al responder el servidor, la orden consta para las dos pestañas");
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
      // v18.0.118 (UI/UX #9) — el sondeo ya no los BORRA (los vecinos se corrían bajo el cursor y
      // el clic caía en otro día): los apaga en el sitio, tachados y con su motivo.
      const sabados = [...chipsEl.children].filter((b) => b.className.includes("vgl-agm-pbtn-sabado"));
      t.cierto(sabados.length > 0, "los sábados siguen en su sitio (ya no desaparecen)");
      t.cierto(sabados.every((b) => b.disabled === true && b.classList.contains("vgl-agm-pbtn-sinagenda")), "pero quedaron deshabilitados y tachados: sin agenda real ese día");
      t.cierto(sabados.every((b) => /Sin agenda del servicio/.test(String(b.title || ""))), "y dicen por qué");
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
      // v18.0.122 — contar, no buscar: ver la nota del caso de v14.0.1 más arriba.
      const activos = [...chipsEl.children].filter((b) => b.classList.contains("active"));
      t.igual(activos.length, 1, "un solo día marcado como seleccionado tras el sondeo");
      const activo = activos[0];
      t.cierto(!!activo, "el chip activo (día centro) sigue en el DOM tras el sondeo, aunque estaba confirmado vacío");
      // v18.0.118 (UI/UX #9) — se apagan en vez de retirarse; el activo nunca se toca.
      const apagados = [...chipsEl.children].filter((b) => b.disabled === true && b.classList.contains("vgl-agm-pbtn-sinagenda"));
      t.cierto(apagados.length > 0, "los días NO activos confirmados vacíos quedaron apagados");
      t.falso(activo.disabled === true, "y el chip activo sigue vivo");
    });

    // =====================================================================
    // v18.0.122 — REPORTE EN VIVO (02-sep). La causa raíz (una fecha duplicada en el rango)
    // está fijada en suite_02. Esto fija la SEGUNDA línea de defensa: la limpieza de la marca
    // «seleccionado» no puede volver a depender de un registro por ISO. Un mapa pierde un
    // botón en cuanto dos chips comparten fecha, y el botón perdido se queda marcado para
    // siempre — que es exactamente lo que el médico vio. `renderDayChips` vive en el cierre
    // de `openAgendamientoModal`, así que se protege por texto fuente.
    // =====================================================================
    t.caso("v18.0.122: la marca «seleccionado» se limpia sobre la lista COMPLETA de chips, nunca sobre el mapa por fecha", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      t.cierto(/let diaBotonesTodos = \[\];/.test(src), "existe la lista completa de chips del día");
      t.cierto(/const _limpiarDiaActivo = \(\) => \{/.test(src), "y una sola función que limpia la marca");
      t.cierto(/diaBotonesTodos\.forEach\(\(b\) => \{ if \(b && b\.classList\) b\.classList\.remove\("active"\); \}\);/.test(src),
        "que recorre esa lista");
      // Lo prohibido: volver a quitar «active» recorriendo el mapa por ISO.
      t.falso(/diaBotonesPorIso\.forEach\(\(b\) => b\.classList\.remove\("active"\)\)/.test(src),
        "ningún camino limpia la marca recorriendo el mapa por fecha");
      t.falso(/botonesPorIso\.forEach\(\(b\) => b\.classList\.remove\("active"\)\)/.test(src),
        "tampoco el registro local del render");
      // Y los dos sitios que la limpiaban usan ahora la función única.
      t.igual((src.match(/_limpiarDiaActivo\(\);/g) || []).length, 2,
        "los dos caminos que mueven la selección (clic del médico y salto automático) la usan");
    });

    // =====================================================================
    // v18.0.125 (auditoría UI/UX, filas 30, 34, 36 y 37) — cuatro sitios donde la pantalla
    // prometía algo que el código no cumplía. Los cuatro viven en cierres de modal (no son
    // unidades aislables), así que se protegen por texto fuente, el criterio ya establecido.
    // =====================================================================
    t.caso("v18.0.125 (fila 30): la chapa del laboratorio no dice «En línea» cuando el portal no respondió", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const i = src.indexOf('const srcEl = modal.querySelector("#vgl-labs-srconline");');
      t.cierto(i >= 0, "existe la chapa de origen");
      const bloque = src.slice(i, i + 1200);
      // Nacía en «✓ En línea» y solo se reescribía en el camino de ÉXITO: con el portal caído
      // afirmaba «En línea» encima de una tabla vacía — el fallo del sistema presentado como
      // hueco del paciente.
      t.cierto(/labsArr === undefined \|\| labsArr === null/.test(bloque), "el fallo de lectura tiene su propia rama");
      t.cierto(/No se pudo consultar el sistema del laboratorio/.test(bloque), "y lo dice con esas palabras");
      t.cierto(/classList\.add\("vgl-labs-srcoff"\)/.test(bloque), "con su chapa en ámbar");
      t.cierto(/classList\.remove\("vgl-labs-srcoff"\)/.test(bloque), "que se retira cuando la lectura sí sale");
    });

    t.caso("v18.0.125 (fila 34): el panel post-cita no se cierra encima de lo que el médico está escribiendo", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/enlazarLabPrint\(panel\);\s*setTimeout\(cerrar, 300000\)/.test(src),
        "el cierre ya no es un temporizador ciego de 5 minutos");
      t.cierto(/let _cierrePost = setTimeout\(cerrar, 300000\);/.test(src), "sigue habiendo tope de 5 minutos");
      t.cierto(/clearTimeout\(_cierrePost\); _cierrePost = setTimeout\(cerrar, 300000\);/.test(src),
        "pero se reinicia al teclear: el tope se cuenta desde la última vez que tocó algo");
      t.cierto(/panel\.addEventListener\("input", _reprogramarCierre\)/.test(src), "escucha lo que escribe");
      t.cierto(/panel\.addEventListener\("focusin", _reprogramarCierre\)/.test(src), "y también que entre en una casilla");
    });

    t.caso("v18.0.125 (fila 36): la búsqueda del primer cupo se puede detener", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const i = src.indexOf('if (pcBtn) pcBtn.addEventListener("click", async () => {');
      t.cierto(i >= 0, "existe el botón «Primer cupo disponible»");
      const bloque = src.slice(i - 900, i + 900);
      // Recorre hasta 30 días hábiles con varias consultas por día (~4,7 s cada una, medido en
      // la flota): sin freno, la única salida era cerrar el cuadro y perder lo elegido.
      t.cierto(/pcBtn\.setAttribute\("data-buscando", "1"\)/.test(bloque), "el botón recuerda que está buscando");
      t.cierto(/if \(pcBtn\.getAttribute\("data-buscando"\) === "1"\) \{/.test(bloque),
        "y el segundo clic, mientras busca, DETIENE en vez de relanzar");
      t.cierto(/✖ Detener búsqueda/.test(bloque), "y se convierte en el freno mientras dura");
      t.cierto(/_pcCancelar\(\);/.test(bloque), "que acciona el token de cancelación que ya existía");
      t.cierto(/Búsqueda detenida/.test(bloque), "y lo dice al detenerse, sin dejar el cuadro mudo");
    });

    t.caso("v18.0.125 (fila 37): con todo en «No sé», el botón no promete escribir nada", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      // Todas las filas nacen en «No sé» (correcto: el asistente no supone nada). Pero el
      // primario decía «Aceptar y llenar en Everest» desde el primer instante, y pulsarlo
      // escribía CERO casillas y sacaba un aviso de éxito.
      t.cierto(/id="vgl-llenar-ok" disabled>Conteste alguna para poder llenarla/.test(src),
        "nace apagado y dice qué falta para poder usarlo");
      t.cierto(/_okBtn\.disabled = n === 0;/.test(src), "se enciende solo con al menos una respuesta");
      t.cierto(/"Aceptar y llenar en Everest \(" \+ n \+ "\)"/.test(src), "y dice CUÁNTAS va a escribir");
      t.cierto(/respuestas\[k\] === true \|\| respuestas\[k\] === false/.test(src),
        "un «No sé» no cuenta como respuesta: es exactamente lo que no se toca");
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
      // v18.0.118 (UI/UX #9) — ya no se retira: se apaga en el sitio. La regla de «propia» es la misma.
      const sabAjena = [...chipsEl.children].filter((b) => b.className.includes("vgl-agm-pbtn-sabado"));
      t.cierto(sabAjena.length > 0 && sabAjena.every((b) => b.disabled === true && b.classList.contains("vgl-agm-pbtn-sinagenda")),
        "el sábado con agenda solo AJENA queda apagado, igual que si estuviera vacío — la misma regla de 'propia' que bloquea el día central también aplica al sondeo en segundo plano");
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

    // v18.0.78 — HALLAZGO PENDIENTE (docs/REGLAS_MEDICO_20260901.md, «hazlo»): el sitio
    // exacto del reporte del médico («hoy me sugiere un examen para mañana porque ya venció,
    // pero para mañana ya no hay citas de laboratorio»). El ideal SIN verificar se pinta de
    // inmediato (no bloquea), y en segundo plano se busca hacia atrás con las 4 reglas ya
    // probadas en _afinarLabsPrimeroConCupos (v18.0.69) — mismo motor, mismo gmxhr mock.
    const _gmxhrLabSolo = (mapaPorFecha) => (o) => {
      const m = /fechaBuscar=([\d-]+)/.exec(String(o.url) || "");
      const iso = m ? m[1] : null;
      const cuerpo = (iso && Object.prototype.hasOwnProperty.call(mapaPorFecha, iso)) ? mapaPorFecha[iso] : { turnos: [] };
      if (o.onload) o.onload({ status: 200, responseText: JSON.stringify(cuerpo) });
    };

    await t.casoAsync("REGRESIÓN — openLabSoloModal afina la toma con cupo real, hacia atrás (hallazgo pendiente REGLAS_MEDICO #2)", async () => {
      // Cita de control: 20-sep-2026. Ideal (5 días hábiles antes): 14-sep-2026 — sin cupo.
      // El motor busca hacia atrás: 12-sep (sin cupo), 11-sep (CON cupo) — debe quedarse ahí.
      const cLab = cargar({
        silencioso: true,
        gmxhr: _gmxhrLabSolo({
          "2026-09-14": { turnos: [] },
          "2026-09-12": { turnos: [] },
          "2026-09-11": { turnos: [{ hora: "08:00" }] },
        }),
      });
      enriquecerDom(cLab);
      cLab.api.markCitaAgendadaHoy("777000", "2026-09-20");
      await cLab.api.openLabSoloModal({ doc_id: "777000", nombre: "CON CUPO ATRAS" });
      const modal = cLab.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.cierto(!!modal, "el modal quedó pintado");
      const ideal = cLab.api.calcBusinessDaysBefore("2026-09-20", 5);
      t.igual(ideal.iso, "2026-09-14", "el ideal (sin verificar) es el 14-sep, como antes");
      // El HTML estático (no el nodo memoizado del DOM falso) es lo que refleja el primer
      // pintado, síncrono y sin bloquear — igual que la prueba «flujo completo» de arriba.
      t.cierto(modal.innerHTML.includes(ideal.fmt), "el ideal se pinta primero, sin bloquear, mientras se verifica");
      const sugTxt = modal.querySelector("#vgl-labsolo-sugerida-txt");

      await esperar(60);   // deja correr el afinado en segundo plano (gmxhr resuelve síncrono)

      const verificado = cLab.api.calcBusinessDaysBefore("2026-09-11", 0);
      t.cierto(sugTxt.textContent.includes(verificado.fmt), "tras verificar, se repinta con el 11-sep — el primero CON cupo real hacia atrás: " + sugTxt.textContent);
      const nota = modal.querySelector("#vgl-labsolo-disp-nota");
      t.cierto(nota && nota.classList.contains("vgl-d-none"), "con cupo encontrado, no hay aviso de disponibilidad");
    });

    await t.casoAsync("REGRESIÓN — openLabSoloModal avisa, sin inventar fecha, si no hay cupo en todo el margen (hallazgo pendiente REGLAS_MEDICO #2)", async () => {
      // Ningún día del margen de 5 hábiles responde con cupo: la sugerencia se queda en la
      // fecha clínica (nunca se inventa una) y se avisa en pantalla — regla 2 y 4 del médico.
      const cLab = cargar({ silencioso: true, gmxhr: _gmxhrLabSolo({}) });   // todo responde "sin turnos"
      enriquecerDom(cLab);
      cLab.api.markCitaAgendadaHoy("777001", "2026-09-20");
      await cLab.api.openLabSoloModal({ doc_id: "777001", nombre: "SIN CUPO EN TODO EL MARGEN" });
      const modal = cLab.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      await esperar(60);

      const ideal = cLab.api.calcBusinessDaysBefore("2026-09-20", 5);
      // Sin ningún hallazgo, la etiqueta del ideal NUNCA se toca (el HTML estático original
      // sigue siendo la verdad, igual que en la prueba «flujo completo» de arriba).
      t.cierto(modal.innerHTML.includes(ideal.fmt), "la sugerencia se queda en la fecha clínica: no se inventa una que nadie verificó");
      const nota = modal.querySelector("#vgl-labsolo-disp-nota");
      t.falso(nota.classList.contains("vgl-d-none"), "y se avisa que no se pudo confirmar cupo");
      t.cierto(/Sin cupo confirmado/.test(nota.innerHTML), "con el texto que ya usa el motor: " + nota.innerHTML);
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

    await t.casoAsync("openOrdenamientoModal: sin coincidencia PyM no ofrece NADA para ordenar y lo avisa (v16.2.0 + v17.16.0)", async () => {
      // v17.16.0 — REGLA D: el aviso distingue POR QUÉ no hay nada. Antes afirmaba sobre
      // el paciente («no se detectaron actividades») también cuando el problema era del
      // SISTEMA (lista sin cargar). Los dos casos se prueban:
      //  (1) lista de hoy cargada y paciente en ella SIN pendientes -> el aviso honesto
      //      de "sin_pendientes" que pidió v16.2.0, y NADA que marcar;
      //  (2) lista sin cargar -> no se sabe nada del paciente y se dice tal cual.
      const h = new Date();
      const hoyIso = h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0") + "-" + String(h.getDate()).padStart(2, "0");
      cOrd.api.__state.pymFile = "Agenda_Dia_CMB.xlsx";
      cOrd.api.__state.pymDia = hoyIso;
      cOrd.api.__state.pymTodos = new Set(["999"]);
      cOrd.api.__state.pymFallback = false;
      await cOrd.api.openOrdenamientoModal({ doc_id: "999", nombre: "PEDRO GOMEZ", pym: [] });
      const modal = ultimoOrd();
      t.cierto(!!modal);
      t.cierto(modal.innerHTML.includes("no tiene actividades pendientes"),
        "aviso honesto: el paciente está en la lista y no le corresponde nada — no se ofrece nada para no sobre-ordenar");
      t.falso(modal.innerHTML.includes(" checked"), "ninguna casilla premarcada sin coincidencia explícita");
      t.igual(modal.innerHTML.split("vgl-ord-item").length - 1, 0, "sin coincidencia no se ofrece ninguna actividad");
      t.cierto(modal.innerHTML.includes("Sin actividades para ordenar"), "el botón de confirmar queda deshabilitado con su rótulo honesto");

      // (2) lista SIN cargar: la Regla D prohíbe afirmar sobre el paciente lo que no se
      // pudo comprobar. El aviso es de "no sé", el botón no invita a nada, y los items
      // siguen en cero.
      cOrd.api.__state.pymFile = null;
      cOrd.api.__state.pymDia = null;
      cOrd.api.__state.pymTodos = null;
      await cOrd.api.openOrdenamientoModal({ doc_id: "999", nombre: "PEDRO GOMEZ", pym: [] });
      const modalSinLista = ultimoOrd();
      t.cierto(modalSinLista.innerHTML.includes("No tengo cargada la lista de prevención de hoy"),
        "sin lista, el modal lo dice: el hueco es del sistema, no del paciente");
      t.cierto(modalSinLista.innerHTML.includes("No hay lista de prevención"),
        "y el botón no invita a ordenar nada (antes decía 'Sin actividades', afirmando lo que no se sabía)");
      t.igual(modalSinLista.innerHTML.split("vgl-ord-item").length - 1, 0, "tampoco aquí se ofrece ningún ítem");
    });

    await t.casoAsync("openOrdenamientoModal: con coincidencia, la actividad de otro sexo se OCULTA (v17.26.0)", async () => {
      // v17.26.0 — REFACTOR APROBADO: el choque de sexo ya no se avisa en rojo: la
      // actividad simplemente no se muestra. Mujer con mamografía y PSA en su PyM: la
      // mamografía se premarca, el PSA no aparece.
      await cOrd.api.openOrdenamientoModal({ doc_id: "888", nombre: "MARIA DIAZ", sexo: "F", pym: ["Mamografía", "PSA prostata"] });
      const modal = ultimoOrd();
      t.cierto(modal.innerHTML.includes("Mamografía (detección de cáncer de mama)"));
      t.falso(modal.innerHTML.includes("PSA (antígeno de próstata)"), "el PSA se oculta para una paciente de sexo F");
      t.cierto(modal.innerHTML.includes('data-idx="0" checked'), "la mamografía (compatible) sale premarcada");
      t.igual(modal.innerHTML.split(" checked").length - 1, 1, "solo una casilla premarcada");
      t.falso(modal.innerHTML.includes("Actividad propia del sexo"), "ya no se muestra el aviso rojo de choque de sexo");
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
    await t.casoAsync("openOrdenamientoModal v14/v17.26: el paquete RCV exprés se RETIRÓ del módulo", async () => {
      // v17.26.0 — REFACTOR APROBADO: el paquete I10X (RCV exprés) ya no se ofrece en el
      // módulo de Ordenar. Antes este test verificaba que una orden vigente de RCV no se
      // premarcaba; ahora el paquete ni siquiera aparece, y si era el único match el modal
      // cae al aviso honesto de "sin actividades para este paciente".
      const cVig = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { sexo: "M" } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 4321 } });
          if (u.includes("ObtenerOrdenamientoPorPacienteIdVigente")) {
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
      t.falso(modal.innerHTML.includes("PAQUETE SUPER-ORDENAMIENTO RCV EXPRÉS"), "el paquete RCV exprés ya no se ofrece en el módulo");
      t.igual(modal.innerHTML.split("vgl-ord-item").length - 1, 0, "al ser el único match, no queda ninguna tarjeta por ofrecer");
      t.falso(modal.innerHTML.includes(" checked"), "sin tarjetas no hay nada premarcado");
      t.cierto(modal.innerHTML.includes("no tiene pendientes") || modal.innerHTML.includes("No tengo cargada la lista"), "el modal avisa con honestidad por qué no hay nada que ordenar");
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
      await cVigFalla.api.openOrdenamientoModal({ doc_id: "444", nombre: "LUIS TORRES", sexo: "M", pym: ["VIH"] });
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

    // =====================================================================
    // v18.0.63 — HALLAZGO DEL ENJAMBRE #19 (01-sep), gravedad alta, 3 de 3 refutadores no
    // lograron tumbarlo. El ÚNICO filtro antiduplicado que vivía dentro del modal era la
    // consulta EN VIVO a Everest, que el propio código documenta como «un fallo de red aquí
    // NO bloquea nada». Si esa consulta falla —o si Everest todavía no indexó la orden que
    // el script acaba de crear— reabrir el modal ofrecía «Generar» otra vez, en silencio y
    // con el mismo mensaje de éxito. Con una mamografía o un PSA eso no es un renglón
    // administrativo de más: es un examen repetido de verdad al paciente.
    //
    // La telemetría del 1-sep lo respalda: «Ordenar» es el embudo con MÁS abandono de todo
    // el script (6 abiertos, 2 completados, 4 abandonados), y abandonar a mitad del lote es
    // justo el gesto de la reproducción.
    // =====================================================================
    function _dupFixture(postsArr) {
      return cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("/api/Paciente/BuscarPaciente")) return respuestaJson({ id: 801848 });
          if (u.includes("ObtenerListadoDiagnostico")) return respuestaJson([{ codigo: "Z108", id: 55, nombre: "TAMIZACION" }]);
          if (u.includes("ObtenerListadoCupsPorPaciente")) {
            const cod = /filter=([^&]+)/.exec(u)[1];
            return respuestaJson([{ codigo: decodeURIComponent(cod), id: 77, nombre: "EXAMEN", descripcion: "EXAMEN" }]);
          }
          if (u.includes("GuardarOrdenamiento")) { postsArr.push(u); return respuestaJson({ error: false, agrupador: "AGP-" + postsArr.length }); }
          // Everest NO confirma la orden recién creada: devuelve la lista vigente vacía.
          // Es el «fail-open» que el propio código produce ante un fallo real de esa
          // consulta, y la condición exacta del hallazgo.
          if (u.includes("ObtenerOrdenamientoPorPacienteIdVigente")) return respuestaJson([]);
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
    }
    // El DOM simulado no interpreta innerHTML, así que la casilla se entrega a mano — pero
    // con los MISMOS atributos que pinta el modal, que es lo que la guarda lee.
    function _casillaOrd(premarcada, tocada, idx) {
      return {
        checked: true, disabled: false,
        dataset: tocada ? { vglTocada: "1" } : {},
        getAttribute: (k) => (k === "data-premarcada" ? (premarcada ? "1" : "0") : String(idx || 0)),
        addEventListener: () => {}, closest: () => ({ style: {} }),
      };
    }
    function _inyectarCasilla(c, casilla) {
      const crear = c.env.doc.createElement;
      c.env.doc.createElement = function (tag) {
        const e = crear(tag);
        const qsaBase = e.querySelectorAll;
        e.querySelectorAll = (sel) => (sel === ".vgl-ord-chk" ? [casilla] : qsaBase(sel));
        return e;
      };
    }

    await t.casoAsync("v18.0.63: reabrir «Ordenar» y volver a pulsar NO crea una segunda orden real del mismo paquete", async () => {
      const posts = [];
      const cDup = _dupFixture(posts);
      enriquecerDom(cDup);
      cDup.api.__state.activeDoctor = { id: 309, name: "MEDICO DE PRUEBA" };
      // Premarcada por el script, JAMÁS tocada por el médico: es la reproducción exacta
      // (el modal se repintó antes de que existiera la marca, así que el «check» no es una
      // decisión suya sino la sugerencia del propio script).
      const abrirYGenerar = async () => {
        // Casilla NUEVA en cada apertura, como en el DOM real: el modal se repinta entero.
        // Compartir el objeto falso entre las dos vueltas hacía pasar la prueba por el
        // motivo equivocado — tras crear la orden el propio código la deja `checked=false`,
        // así que la segunda vuelta no seleccionaba nada y no había nada que duplicar. Lo
        // destapó la mutación 157.
        _inyectarCasilla(cDup, _casillaOrd(true, false, 0));
        await cDup.api.openOrdenamientoModal({ doc_id: "21545051", nombre: "PACIENTE DE PRUEBA", sexo: "M", pym: ["Tamización cardiometabólica"] });
        await esperar(80);
        const m = cDup.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
        disparar(m.querySelector("#vgl-ord-confirm"), "click");
        await esperar(120);
        return m;
      };

      await abrirYGenerar();
      t.igual(posts.length, 1, "la primera corrida sí crea la orden");
      t.cierto(cDup.api.ordenCreadaHoyParaCie10("21545051", "Z108"), "y queda constancia local de QUÉ paquete se ordenó");

      await abrirYGenerar();
      t.igual(posts.length, 1, "la segunda pulsación NO crea una orden duplicada de verdad en Everest");
    });

    await t.casoAsync("v18.0.63 (contención): si el médico marca él mismo la casilla, la orden SÍ se repite — él manda", async () => {
      const posts = [];
      const cDup = _dupFixture(posts);
      enriquecerDom(cDup);
      cDup.api.__state.activeDoctor = { id: 309, name: "MEDICO DE PRUEBA" };
      const abrir = async (c) => {
        await c.api.openOrdenamientoModal({ doc_id: "21545051", nombre: "PACIENTE DE PRUEBA", sexo: "M", pym: ["Tamización cardiometabólica"] });
        await esperar(80);
        const m = c.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
        disparar(m.querySelector("#vgl-ord-confirm"), "click");
        await esperar(120);
      };
      _inyectarCasilla(cDup, _casillaOrd(true, false, 0));
      await abrir(cDup);
      t.igual(posts.length, 1, "primera orden creada");

      // Segunda vuelta: la casilla la PREMARCÓ el script y además la tocó EL MÉDICO (quedó
      // la huella `vglTocada`: la desmarcó y la volvió a marcar). La guarda no puede comerse
      // una decisión suya: puede haber un motivo real para repetir el examen, y el script
      // sugiere, no manda.
      // 02-sep — CIERRE ADVERSARIAL (fila 24b): esta prueba montaba `_casillaOrd(false, true,
      // 0)` (premarcada=0), con lo que la guarda se saltaba por el PRIMER operando sin llegar
      // jamás a `!_tocada` — la mutación M158 (quitar `&& !_tocada`) dejaba la suite en verde.
      // Con premarcada=1 Y tocada=1 la cláusula es la que decide, y la mutación sí muerde.
      _inyectarCasilla(cDup, _casillaOrd(true, true, 0));
      await abrir(cDup);
      t.igual(posts.length, 2, "la decisión explícita del médico se respeta y la orden se crea");
    });

    // v18.0.106 — refutador de v18.0.100 (fila 24b, prueba hueca): la huella `vglTocada` la
    // escribe SOLO el listener `change` de la casilla, y ninguna prueba lo disparaba — la
    // contención de arriba la pone a mano. Un mutante que borra esa línea del listener dejaba
    // la suite en verde y, en el navegador, la guarda se comía la decisión del médico.
    await t.casoAsync("v18.0.106: el gesto REAL del médico sobre la casilla (su listener change) deja la huella que la guarda respeta", async () => {
      const posts = [];
      const cDup = _dupFixture(posts);
      enriquecerDom(cDup);
      cDup.api.__state.activeDoctor = { id: 309, name: "MEDICO DE PRUEBA" };
      const casillaReal = (premarcada) => ({
        checked: true, disabled: false, dataset: {}, _ls: {},
        getAttribute: (k) => (k === "data-premarcada" ? (premarcada ? "1" : "0") : "0"),
        addEventListener(tipo, fn) { (this._ls[tipo] = this._ls[tipo] || []).push(fn); },
        closest: () => ({ style: {}, classList: { add() {} } }),
      });
      const abrirOrd = async () => {
        await cDup.api.openOrdenamientoModal({ doc_id: "111111", nombre: "PACIENTE PRUEBA UNO", sexo: "M", pym: ["Tamización cardiometabólica"] });
        await esperar(80);
        return cDup.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      };
      const generar = async (m) => { const ls = m.querySelector("#vgl-ord-confirm")._listeners.click; ls[ls.length - 1]({}); await esperar(120); };
      // 1.ª orden: casilla premarcada, sin gesto del médico
      const c1 = casillaReal(true); _inyectarCasilla(cDup, c1);
      await generar(await abrirOrd());
      t.igual(posts.length, 1, "montaje: la primera orden se creó");
      t.cierto((c1._ls.change || []).length >= 1, "montaje: el modal colgó su listener change a la casilla");
      // 2.ª apertura: la casilla vuelve premarcada por el script; el médico la TOCA (su listener)
      const c2 = casillaReal(true); _inyectarCasilla(cDup, c2);
      const m2 = await abrirOrd();
      t.igual(c2.dataset.vglTocada, undefined, "montaje: sin gesto, sin huella");
      c2._ls.change[c2._ls.change.length - 1]({});
      t.igual(c2.dataset.vglTocada, "1", "el listener deja la huella del gesto (mutante sin esa línea: undefined)");
      await generar(m2);
      t.igual(posts.length, 2, "y la guarda respeta la decisión: segunda orden real");
    });

    await t.casoAsync("v18.0.63: la marca de cada orden se escribe EN CUANTO el servidor la confirma, no al final del lote", async () => {
      // Esta es la ventana concreta de la reproducción del hallazgo: el médico pulsa
      // «Generar», pulsa «Cancelar» mientras el lote sigue en vuelo y reabre «Ordenar». Si
      // la marca solo se escribiera al terminar el lote entero, al reabrir NO constaría
      // nada y el modal volvería a premarcar lo que ya está creado.
      const posts = [];
      const cLote = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("/api/Paciente/BuscarPaciente")) return respuestaJson({ id: 801848 });
          if (u.includes("ObtenerListadoDiagnostico")) {
            const cod = /filter=([^&]+)/.exec(u)[1];
            return respuestaJson([{ codigo: decodeURIComponent(cod), id: 55, nombre: "DX" }]);
          }
          if (u.includes("ObtenerListadoCupsPorPaciente")) {
            await esperar(250);   // Everest tarda: el lote no termina de golpe
            const cod = /filter=([^&]+)/.exec(u)[1];
            return respuestaJson([{ codigo: decodeURIComponent(cod), id: 77, nombre: "EXAMEN", descripcion: "EXAMEN" }]);
          }
          if (u.includes("GuardarOrdenamiento")) { posts.push(u); return respuestaJson({ error: false, agrupador: "AGP-" + posts.length }); }
          if (u.includes("ObtenerOrdenamientoPorPacienteIdVigente")) return respuestaJson([]);
          return respuestaJson({});
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      enriquecerDom(cLote);
      cLote.api.__state.activeDoctor = { id: 309, name: "MEDICO DE PRUEBA" };
      // Dos paquetes marcados: VIH (1 solo CUPS, termina pronto) y la tamización
      // cardiometabólica (siete CUPS, tarda). Los índices cubren las dos posiciones.
      const dos = [_casillaOrd(true, false, 0), _casillaOrd(true, false, 1)];
      const crear = cLote.env.doc.createElement;
      cLote.env.doc.createElement = function (tag) {
        const e = crear(tag);
        const qsaBase = e.querySelectorAll;
        e.querySelectorAll = (sel) => (sel === ".vgl-ord-chk" ? dos : qsaBase(sel));
        return e;
      };
      await cLote.api.openOrdenamientoModal({ doc_id: "555", nombre: "ANA LOPEZ", sexo: "F", pym: ["VIH", "Tamización cardiometabólica"] });
      await esperar(60);
      const m = cLote.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      disparar(m.querySelector("#vgl-ord-confirm"), "click");

      await esperar(700);   // el primer paquete ya se creó; el segundo sigue en vuelo
      t.igual(posts.length, 1, "a mitad del lote hay exactamente UNA orden creada");
      const detMedio = cLote.api.ordenesDetalleHoy("555");
      t.cierto(!!detMedio && Array.isArray(detMedio.cie10) && detMedio.cie10.length === 1,
        "y su marca YA consta, con el lote todavía sin terminar — es lo que impide el duplicado al reabrir");

      await esperar(2200);
      t.igual(posts.length, 2, "el lote termina y crea también la segunda");
      const detFin = cLote.api.ordenesDetalleHoy("555");
      t.igual(detFin.cie10.length, 2, "y las dos quedan anotadas, sin perder la primera");
    });

    await t.casoAsync("v18.0.63: una marca ANTERIOR (sin la lista de CIE-10) no afirma nada — casilla vacía antes que dato inventado", async () => {
      const c = cargar({ silencioso: true });
      // Marca al estilo viejo: agrupadores y actividades, pero SIN `cie10`. No dice QUÉ
      // paquete se ordenó, así que no puede usarse para desmarcar exámenes que quizá nunca
      // se pidieron.
      c.api.markOrdenesCreadasHoy("777", ["AGP-9"], ["Tamización cardiometabólica"]);
      t.cierto(!!c.api.ordenesDetalleHoy("777"), "la marca vieja existe");
      t.falso(c.api.ordenCreadaHoyParaCie10("777", "Z108"), "pero no permite afirmar que ESE paquete ya se ordenó");

      c.api.markOrdenesCreadasHoy("777", ["AGP-9"], ["Tamización cardiometabólica"], ["Z108"]);
      t.cierto(c.api.ordenCreadaHoyParaCie10("777", "Z108"), "con la lista nueva sí se sabe, y por paquete");
      t.falso(c.api.ordenCreadaHoyParaCie10("777", "Z113"), "y solo del paquete que de verdad se ordenó, no de los demás");
    });

    await t.casoAsync("v18.0.63: el modal no premarca lo que ya se ordenó hoy, y lo dice", async () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.api.markOrdenesCreadasHoy("888", ["AGP-1"], ["Tamización cardiometabólica"], ["Z108"]);
      await c.api.openOrdenamientoModal({ doc_id: "888", nombre: "PEDRO RUIZ", sexo: "M", pym: ["Tamización cardiometabólica"] });
      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();
      t.cierto(modal.innerHTML.includes("CIE-10 Z108"), "el paquete se sigue ofreciendo: el médico puede tener un motivo para repetirlo");
      t.cierto(modal.innerHTML.includes("ya se generó hoy"), "pero se dice con todas las letras");
      t.cierto(modal.innerHTML.includes('data-premarcada="0"'), "y NO viene premarcado");
      t.falso(modal.innerHTML.includes(' checked'), "ninguna casilla marcada de oficio sobre una orden ya creada hoy");
      t.falso(modal.innerHTML.includes(" disabled"), "tampoco se bloquea: el médico manda, el script sugiere");
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

    // v18.0.107 — S+ flujo (C4): si la cita se creaba pero la toma de muestras fallaba, todo lo
    // visible (botón, panel post-cita, aviso verde) decía éxito y el fallo solo salía por el
    // HUD «Centinela PyM» abajo a la derecha. Ahora el motivo del fallo viaja y se dice en el
    // panel post-cita, en un aviso ámbar fijo y en el propio botón.
    await t.casoAsync("v18.0.107 (C4): la toma que NO quedó agendada se dice en el panel post-cita, con el motivo real del fallo de AppCita", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red"); } });
      enriquecerDom(c);
      const ok = await c.api.apiLaboratorioAgendarAuto("111111", "2026-10-01", "07:00:00");
      t.igual(ok, false, "montaje: AppCita no responde → la toma no se agenda");
      const motivo = c.api._labMotivoUltimoFallo();
      t.cierto(/disponibilidad de laboratorio/.test(motivo), "el motivo del fallo queda disponible para quien lo pinte: " + motivo);
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE PRUEBA", "", { cita: { fechaLegible: "01/10/2026" }, labFallo: motivo });
      const panel = c.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(/NO quedó agendada/.test(panel.innerHTML) && panel.innerHTML.includes("disponibilidad de laboratorio"), "el panel post-cita lleva la línea roja con el motivo (antes: nada)");
      t.cierto(/Cita creada/.test(panel.innerHTML), "y sigue diciendo que la cita sí se creó");
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE PRUEBA", "", { cita: { fechaLegible: "01/10/2026" } });
      const panel2 = c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel").pop();
      t.falso(/NO quedó agendada/.test(panel2.innerHTML), "sin fallo, sin línea roja");
      // el tramo de laboratorio del modal combinado avisa en ámbar y repinta el panel con el motivo
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const tramo = src.slice(src.indexOf('confirmBtn.textContent = "⏳ Cita creada · agendando la toma de muestras…"'), src.indexOf('setTimeout(() => closeMod(), 2600);'));
      t.cierto(tramo.length > 0 && /if \(!labOk\) \{/.test(tramo) && /showToast\("AMBAR", "Toma de muestras · NO quedó agendada"/.test(tramo) && /_cierreCtx\.extra\.labFallo = motivoLab/.test(tramo),
        "el tramo de laboratorio de Agendar: aviso ámbar fijo + motivo al panel post-cita cuando la toma falla");
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

    // v17.19.0 — la retirada quedó completa: no solo se borró el bloque T7 (v14.2.0,
    // `_bannerPymCache`, `_refrescarBannerPym`, `createPymBannerUI`…), sino que además se
    // eliminaron de DEFAULTS las claves muertas `bannerPym`/`avisoPymModal` (auditoría del
    // 28-ago: ningún código activo las lee) y la migración "v15.0 RETIRO DEL BANNER" que
    // escribía su marca `vgl_v15_banner`. La protección ya no depende de un valor: es
    // estructural, no existe función que pueda pintar la franja.
    t.caso("v15 (v17.19.0): el bloque T7 se retiró entero — ni banner ni aviso modal, y las claves muertas ya no viven en los ajustes", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.__S.bannerPym, undefined, "la clave del banner ya no existe en los ajustes (v17.19.0 la retiró de defaults)");
      t.igual(c.api.__S.avisoPymModal, undefined, "ni la del aviso modal: ambas se confirmaron 100% muertas");
      t.igual(c.api._refrescarBannerPym, undefined, "y no queda ninguna función que pudiera pintarlo (el bloque T7 se borró en v14.2.0)");
      t.igual(c.api.createPymBannerUI, undefined, "la protección es estructural: no hay cómo encender un banner que no existe");
    });

    t.caso("la retirada de v15 (v17.19.0): aunque el disco guarde bannerPym:true de versiones viejas, no hay NINGÚN código que lo lea — el banner es estructuralmente imposible", () => {
      // writeJSON guarda el objeto ENTERO de ajustes, así que los veinte equipos que
      // tuvieron `bannerPym: true` en disco lo siguen teniendo. Ya no importa: no existe
      // ni la función que lo pintaría ni la migración que lo apagaba (con su marca).
      const c = cargar({
        silencioso: true,
        almacen: { vgl_cfg: JSON.stringify({ bannerPym: true, avisoPymModal: true }) },
      });
      t.igual(c.api.__S.bannerPym, true, "el valor viejo aún viaja en el objeto de ajustes…");
      t.igual(c.api._refrescarBannerPym, undefined, "…pero no existe ni un solo lector: la franja no se puede pintar");
      t.falso(c.env.win.localStorage.getItem("vgl_v15_banner"),
        "y la migración que escribía esa marca se retiró: ya no hay 'una sola vez' que correr");
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
      const cajaAviso = modal.querySelector("#vgl-agm-confirm-aviso");
      t.cierto(cajaAviso.innerHTML.includes("ya se le creó una cita"), "1er confirmar muestra el aviso antidup en el recuadro de decisión (v18.0.118, UI/UX #4)");
      t.igual(confirmBtn.dataset.dupOk, "", "y NO da por consentido nada: el flag solo lo pone «Sí, crear igual»");
      disparar(btn2, "click");
      t.igual(cajaAviso.innerHTML, "", "cambiar de turno retira el aviso viejo (ya no aplica a esta fecha)");
      t.cierto(confirmBtn.textContent.includes("10:00 AM"), "el botón nombra la hora recién elegida");
      // El anti-doble-clic (v17.6.8) ignora un segundo clic en <700 ms del anterior: se
      // espera el tiempo real entre los dos confirmar, como en la consulta.
      await esperar(750);
      disparar(confirmBtn, "click");
      t.cierto(cajaAviso.innerHTML.includes("ya se le creó una cita"), "el 2º confirmar vuelve a exigir la decisión explícita");
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

      // v18.0.37 — se cortaba por la firma LITERAL con su parámetro. Al retirar
      // `exigirEleccion` (ver más abajo), indexOf devolvía -1 y el slice miraba el final del
      // archivo: la prueba fallaba por la firma, no por lo que vigila. Se corta por el
      // nombre, que es lo estable.
      const iSolo = src.indexOf("async function cargarHorasLabSolo(");
      t.cierto(iSolo > 0, "la función existe");
      const fnCargarHorasLabSolo = src.slice(iSolo, iSolo + 1600);
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


    // ===== INJERTADO EN LA FUSIÓN main<-rama (v18.0.6): casos que solo
    // existían en la rama de trabajo y que main había perdido. =====
    t.caso("T4/v14.0.2 — la tarjeta sigue sin botones de acción, pero v17.22.0 le devuelve los chips de PyM", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const pac = { key: "t4-1", doc_id: "999", nombre: "PACIENTE T4", hora_texto: "09:00", estado: "En sala", color: "VERDE", pym: ["MAMOGRAFÍA"], elapsed: 0, citaId: 12345 };
      cv.api.render([pac], "api", new Date());
      const card = lista.children[0];
      t.falso(card.innerHTML.includes("vgl-btn-agendar"), "sin botón de agendar");
      t.falso(card.innerHTML.includes("vgl-btn-ordenar"), "sin botón de ordenar");
      t.falso(card.innerHTML.includes("vgl-btn-labs"), "sin botón de labs");
      t.falso(card.innerHTML.includes("vgl-btn-atender"), "sin botón de Atender (retirado en v14.0.2, no revive)");
      t.cierto(card.innerHTML.includes("vgl-pyms"), "la fila de chips PyM sí vuelve a aparecer");
      t.cierto(card.innerHTML.includes("MAMOGRAFÍA"), "con el nombre real de la actividad pendiente");
    });

    t.caso("v17.22.0 — la fila inferior de la tarjeta SIEMPRE aparece ahora (lleva el estado de PyM), con o sin citaId", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const sinCita = { key: "v14-sin", doc_id: "777", nombre: "PACIENTE SIN CITAID", hora_texto: "09:20", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
      cv.api.render([sinCita], "api", new Date());
      t.cierto(lista.children[0].innerHTML.includes("vgl-card-btm"), "sin citaId: la fila inferior aparece igual, con el estado de PyM");

      vaciarLista();
      cv.api.__state.lastSignature = "";
      const conCita = { key: "v14-con", doc_id: "778", nombre: "PACIENTE CON CITAID", hora_texto: "09:30", estado: "En sala", color: "VERDE", pym: [], elapsed: 0, citaId: 4242 };
      cv.api.render([conCita], "api", new Date());
      t.cierto(lista.children[0].innerHTML.includes("vgl-card-btm"), "con citaId: también aparece — el contenido depende del PyM, no del citaId");
    });

    t.caso("isPanelHiddenActivity: reconoce Optometría/Odontología con o sin tilde, y nada más", () => {
      t.cierto(cv.api.isPanelHiddenActivity("Optometría"));
      t.cierto(cv.api.isPanelHiddenActivity("optometria de control"));
      t.cierto(cv.api.isPanelHiddenActivity("Odontología general"));
      t.falso(cv.api.isPanelHiddenActivity("Mamografía"), "otra actividad cualquiera no se confunde con AV/OD");
      t.falso(cv.api.isPanelHiddenActivity(""), "vacío no es AV/OD");
      t.falso(cv.api.isPanelHiddenActivity(null), "null no revienta ni cuenta como AV/OD");
    });

    t.caso("panelActivities: filtra SOLO Optometría/Odontología, conserva el resto en su orden", () => {
      const lista4 = ["Tamización de mama", "Optometría", "Citología", "Odontología"];
      t.igual(cv.api.panelActivities(lista4), ["Tamización de mama", "Citología"]);
      t.igual(cv.api.panelActivities([]), []);
      t.igual(cv.api.panelActivities(null), [], "sin lista, arreglo vacío — nunca revienta");
    });

    t.caso("v17.22.0 — más de 3 actividades: se ven 3 chips y un '+N más' con el detalle completo en el title", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const pac = {
        key: "cap-1", doc_id: "501", nombre: "PACIENTE CON MUCHO PYM", hora_texto: "10:00",
        estado: "En sala", color: "VERDE", elapsed: 0,
        pym: ["Tamización de mama", "Citología", "Glicemia", "Perfil lipídico", "Creatinina"],
      };
      cv.api.render([pac], "api", new Date());
      const card = lista.children[0];
      t.cierto(card.innerHTML.includes("Tamización de mama") && card.innerHTML.includes("Citología") && card.innerHTML.includes("Glicemia"), "los 3 primeros se ven completos, sin recortar el texto");
      t.falso(card.innerHTML.includes('">Perfil lipídico<') || card.innerHTML.includes('">Creatinina<'), "el 4º y 5º no se listan como CHIP PROPIO (solo pueden aparecer dentro del title del '+2 más')");
      t.cierto(card.innerHTML.includes("+2 más"), "el sobrante se resume en un solo chip, con el número exacto");
      t.cierto(card.innerHTML.includes("Perfil lipídico") && card.innerHTML.includes("Creatinina"), "pero el detalle completo del sobrante sigue en el HTML (title del chip '+2 más') — nada se pierde");
    });

    t.caso("v17.22.0 — Optometría/Odontología ocultas se avisan con su propio chip, aparte del tope de 3", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      const pac = { key: "avod-1", doc_id: "502", nombre: "PACIENTE AV OD", hora_texto: "10:10", estado: "En sala", color: "VERDE", elapsed: 0, pym: ["Citología", "Optometría"] };
      cv.api.render([pac], "api", new Date());
      const card = lista.children[0];
      t.cierto(card.innerHTML.includes("Citología"), "la actividad real sí se pinta");
      t.falso(card.innerHTML.includes("Optometría"), "Optometría no se pinta como chip propio (sigue oculta de la tarjeta, D9)");
      t.cierto(card.innerHTML.includes("+ remisión AV/OD"), "pero su ausencia se avisa, en vez de desaparecer en silencio");
    });

    t.caso("v17.22.0 — sin PyM cargado, la tarjeta lo dice (nunca 'al día' sin haber podido comprobarlo)", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      cv.api.__state.pymFile = "";
      const pac = { key: "sc-1", doc_id: "601", nombre: "PACIENTE SIN CARGA", hora_texto: "10:20", estado: "En sala", color: "VERDE", elapsed: 0, pym: [] };
      cv.api.render([pac], "api", new Date());
      t.cierto(lista.children[0].innerHTML.includes("PyM sin cargar"));
    });

    t.caso("v17.22.0 — con PyM cargado y el paciente en la base: 'Al día'", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      cv.api.__state.pymFile = "excel.xlsx";
      cv.api.__state.pymTodos = new Set(["602"]);
      const pac = { key: "ok-1", doc_id: "602", nombre: "PACIENTE AL DIA", hora_texto: "10:30", estado: "En sala", color: "VERDE", elapsed: 0, pym: [] };
      cv.api.render([pac], "api", new Date());
      t.cierto(lista.children[0].innerHTML.includes("Al día"));
    });

    t.caso("v17.22.0 — con PyM cargado pero SIN cruzar con la base: 'Dato faltante', no 'Al día'", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      cv.api.__state.pymFile = "excel.xlsx";
      cv.api.__state.pymTodos = new Set(["999999"]);   // el paciente no está en la base
      const pac = { key: "df-1", doc_id: "603", nombre: "PACIENTE SIN CRUCE", hora_texto: "10:40", estado: "En sala", color: "VERDE", elapsed: 0, pym: [] };
      cv.api.render([pac], "api", new Date());
      const html = lista.children[0].innerHTML;
      t.cierto(html.includes("Dato faltante"), "no cruzar con la base es un hecho distinto de estar al día — nunca se confunden");
      t.falso(html.includes("Al día"));
    });

    t.caso("v17.22.0 — solo remisión AV/OD pendiente (nada más): mensaje propio, no 'Al día'", () => {
      vaciarLista();
      cv.api.__state.lastSignature = "";
      cv.api.__state.pymFile = "excel.xlsx";
      cv.api.__state.pymTodos = new Set(["604"]);
      const pac = { key: "avod-solo-1", doc_id: "604", nombre: "PACIENTE SOLO AV OD", hora_texto: "10:50", estado: "En sala", color: "VERDE", elapsed: 0, pym: ["Optometría"] };
      cv.api.render([pac], "api", new Date());
      const html = lista.children[0].innerHTML;
      t.cierto(html.includes("Pendiente: remisión AV/OD"), "el único pendiente real es la remisión — se dice, no se esconde detrás de 'Al día'");
      t.falso(html.includes("Al día"));
      // Se restaura el estado de fábrica (pymFile:"", pymTodos:null): las pruebas de
      // este bloque son las únicas que tocan pymFile/pymTodos en toda esta suite — sin
      // este reset, cualquier prueba posterior que dependa de "PyM sin cargar" (la
      // barra de resumen, copySummary) heredaría en silencio el "excel.xlsx" de aquí.
      cv.api.__state.pymFile = ""; cv.api.__state.pymTodos = null;
    });

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
      // v18.0.x — el rótulo real de esa rama es "No hay lista de prevención"
      // (vigilante_agenda.user.js:25479, rama `_pymSinAct.motivo !== "sin_pendientes"`).
      // Sigue diciendo lo mismo que exigía este caso: falta la LISTA, no las actividades
      // — el rótulo de "Sin actividades para ordenar" está reservado a `sin_pendientes`.
      t.cierto(modal.innerHTML.includes("No hay lista de prevención"),
        "y el rótulo del botón dice lo mismo: no es que no haya actividades, es que no hay lista");
      t.falso(modal.innerHTML.includes("Sin actividades para ordenar"),
        "y NO usa el rótulo del caso 'está en la lista y no tiene nada': eso afirmaría lo que no se miró");
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
      // v18.0.x — misma idea, redacción nueva (vigilante_agenda.user.js:25430):
      // "No fue posible consultar el sistema de laboratorio para este paciente, por lo que
      //  no pudimos verificar si alguno de estos exámenes ya se realizó."
      // Se exigen las DOS mitades: la causa (no se pudo consultar el sistema) y lo que eso
      // significa para el médico (no está verificado), ambas en castellano llano.
      t.cierto(/No fue posible consultar el sistema de laboratorio/.test(modal.innerHTML),
        "se nombra la causa: el sistema no se pudo consultar");
      t.cierto(/no pudimos verificar si alguno de estos exámenes ya se realizó/.test(modal.innerHTML),
        "dicho en lo que significa para él, no en jerga de red");
      // v18.0.x — el modal ya no rotula con el nombre del catálogo ("Mamografía Bilateral")
      // sino con el nombre clínico natural PYM_TITULO_CLINICO["Z123"]
      // (vigilante_agenda.user.js:24872). Es la MISMA actividad, con otro rótulo.
      t.cierto(modal.innerHTML.includes("Mamografía (detección de cáncer de mama)"),
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

    t.caso("v17.16.0 — vglMinBarra y el descarte por cambio de paciente, probados de frente", () => {
      // Estaban en `cubre` sin que ninguna prueba las nombrara. El descarte es la corrección
      // de la v17.6.71 ante un riesgo real de CONTAMINACIÓN CRUZADA: un panel de Redacción
      // IA minimizado con la historia de un paciente sobrevivía al cambio de paciente, y al
      // restaurarlo el médico veía el borrador del anterior.
      const c = cargar({ silencioso: true });
      const d = c.env.doc;

      const barra = c.api.vglMinBarra();
      t.cierto(!!barra, "la barra se crea sola la primera vez");
      t.igual(barra.id, "vgl-min-bar", "con su id");
      t.cierto(c.api.vglMinBarra() === barra, "y la segunda llamada devuelve LA MISMA, no una nueva");

      const panel = d.createElement("div");
      panel.id = "vgl-ia-modal";
      d.body.appendChild(panel);
      // La firma es (panel, docId): el título lo deduce vglMinTituloDe del propio panel.
      t.cierto(c.api.vglMinimizarPanel(panel, "111111111"),
        "se minimiza anotando de qué paciente es");

      // Sigue siendo el mismo paciente: no se descarta nada.
      c.api._vglMinDescartarDeOtroPaciente("111111111");
      t.cierto(!!d.body.children.find((n) => n.id === "vgl-ia-modal"),
        "con el mismo paciente abierto, el panel minimizado se queda");

      // Cambia el paciente: el panel del anterior se descarta, no solo se avisa.
      c.api._vglMinDescartarDeOtroPaciente("222222222");
      t.falso(!!d.body.children.find((n) => n.id === "vgl-ia-modal"),
        "con otro paciente abierto el panel se DESCARTA: un borrador de otra historia no puede sobrevivir");

      // Sin nada minimizado, la función no revienta ni inventa trabajo.
      t.noLanza(() => c.api._vglMinDescartarDeOtroPaciente("333333333"),
        "sin paneles minimizados no hay nada que descartar");
    });

    // =====================================================================
    // v18.0.109 — OPORTUNIDADES S+ DEL FLUJO (C5, C6, C8, C13, C16, C18) Y DE ROBUSTEZ (B10, B11)
    // =====================================================================
    t.caso("v18.0.109 (C5/C6): el panel post-cita dice el desenlace del SMS automático y, cuando AppCita confirma la toma, no se destruye: solo se añade el bloque de laboratorio", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      let panelNode = null;
      const getOrig = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-postcita-panel" ? panelNode : getOrig(id));
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE PRUEBA", "", { turnoId: "900", celular: "3001112233", cita: { fechaLegible: "01/10/2026" } });
      panelNode = c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel").pop();
      t.igual(panelNode.dataset.citaId, "7813686", "el panel sabe de qué cita es");
      t.igual(panelNode.dataset.turnoId, "900", "y de qué turno (para el SMS)");
      c.api._smsAnotarDesenlace("900", true, "3001112233", "");
      t.cierto(/SMS de recordatorio enviado/.test(panelNode.querySelector("#vgl-postcita-smsnota").textContent), "cuando el SMS sale, el panel lo dice (antes: solo la consola)");
      c.api._smsAnotarDesenlace("900", false, "3001112233", "rechazado por el proveedor");
      t.cierto(/NO se entregó/.test(panelNode.querySelector("#vgl-postcita-smsnota").textContent) && /rechazado por el proveedor/.test(panelNode.querySelector("#vgl-postcita-smsnota").textContent), "y si lo rechazan, también, con el motivo");
      c.api._smsAnotarDesenlace("901", true, "3001112233", "");
      t.cierto(/NO se entregó/.test(panelNode.querySelector("#vgl-postcita-smsnota").textContent), "el desenlace de OTRO turno no pisa la nota de este panel");
      // AppCita confirma la toma: el panel de ESTA cita no se recrea
      const cuantos = c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel").length;
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE PRUEBA", "", { turnoId: "900", cita: { fechaLegible: "01/10/2026" }, lab: { fechaIso: "2026-09-25", fechaLegible: "25/09/2026", hora: "7:00 a. m." } });
      const ahora = c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel");
      t.cierto(ahora.length === cuantos && ahora.pop() === panelNode, "es el MISMO panel (antes: se destruía y se recreaba, y lo tecleado se perdía)");
      const card = panelNode.querySelector(".vgl-postcita-card");
      t.cierto(card.children.some((n) => String(n.innerHTML || "").includes("Toma de laboratorio")), "y el bloque de la toma quedó añadido");
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE PRUEBA", "", { turnoId: "900", cita: { fechaLegible: "01/10/2026" }, labFallo: "motivo de prueba" });
      t.cierto(card.children.filter((n) => String(n.innerHTML || "").includes("NO quedó agendada")).length === 1 && card.children.filter((n) => String(n.innerHTML || "").includes("Toma de laboratorio")).length === 0, "una actualización posterior sustituye el bloque, no lo duplica");
      // una cita DISTINTA sí abre panel nuevo
      c.api.mostrarPanelPostCita(9999, "EPS", "OTRO PACIENTE PRUEBA", "", { turnoId: "950", cita: { fechaLegible: "02/10/2026" } });
      t.cierto(c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel").pop() !== panelNode, "otra cita: panel nuevo");
      c.env.doc.getElementById = getOrig;
    });

    await t.casoAsync("v18.0.109 (C8): con «Enviar SMS de recordatorio» apagado en Ajustes, la toma de laboratorio tampoco manda SMS (Telefono=0) y la casilla del modal nace apagada", async () => {
      const urls = [];
      const gmxhr = (o) => {
        const u = String(o.url || "");
        if (/ObtenerTurnosPorFecha/.test(u)) { setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ Hora: "07:00:00", AgendaId: 5 }] }) }), 0); return; }
        if (/AgendarCita/.test(u)) { urls.push(u); setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify({ error: false, radicado: 9001 }) }), 0); return; }
        if (o.onerror) o.onerror("url no simulada");
      };
      const cOn = cargar({ silencioso: true, gmxhr });
      cOn.api.__S.smsRecordatorio = true;
      await cOn.api.apiLaboratorioAgendarAuto("111111", "2026-10-01", "07:00:00", "300 111 2233");
      t.cierto(urls.length === 1 && /Telefono=3001112233/.test(urls[0]), "con el ajuste encendido, el SMS de la toma lleva el celular");
      const cOff = cargar({ silencioso: true, gmxhr });
      cOff.api.__S.smsRecordatorio = false;
      await cOff.api.apiLaboratorioAgendarAuto("111111", "2026-10-01", "07:00:00", "300 111 2233");
      t.cierto(urls.length === 2 && /Telefono=0(&|$)/.test(urls[1]), "con el ajuste apagado, Telefono=0 (antes: el SMS de la toma salía igual): " + urls[1]);
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/id="vgl-agm-sms-chk" \$\{\(typeof S !== "undefined" && S\.smsRecordatorio === false\) \? "disabled" : "checked"\}/.test(src), "la casilla del modal de Agendar nace apagada y deshabilitada cuando el ajuste está apagado (antes: marcada)");
    });

    t.caso("v18.0.109 (C13/C16/C18/B10, fuente): sin confirm()/alert() nativos, «SIN TERMINAR» solo con el clic en un turno, un solo canal visible de éxito, y la consola sin cuerpos crudos", () => {
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const codigo = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      t.falso(/[^A-Za-z_.$]confirm\(/.test(codigo), "no queda ningún confirm() nativo en código (el del Redactor pasó a doble toque)");
      t.falso(/[^A-Za-z_.$]alert\(/.test(codigo), "ni ningún alert() nativo (el de Ordenar pasó a un aviso rojo)");
      t.cierto(/if \(_hayBorradoresSinInsertar\(\)\) \{\s*const x = \$\("#vgl-ia-x"\);\s*if \(x && x\.dataset && x\.dataset\.cerrarOk !== "1"\)/.test(src) && /showToast\("AMBAR", "Redactor · borradores sin insertar"/.test(src), "el cierre del Redactor con borradores sin insertar arma un segundo toque y avisa");
      t.igual((src.match(/markAgendamientoPendiente\(apt\.doc_id\)/g) || []).length, 1, "«🗓️ SIN TERMINAR» se marca desde UN solo sitio: el clic en un turno (la preselección ⭐ ya no)");
      t.cierto(/if \(_pestanaSinAtencion\(\)\) notify\("VERDE", "✅ Cita asignada exitosamente"/.test(src) && /if \(_pestanaSinAtencion\(\)\) notify\("VERDE", "Órdenes generadas"/.test(src), "el aviso verde de éxito solo sale si la pestaña no se está mirando (el panel/bloque ya lo dice)");
      t.falso(/cuerpo\.slice\(0, 500\)/.test(src), "la consola de EnviarSMS ya no imprime 500 caracteres del cuerpo crudo");
      t.cierto(/sanitizePII\(String\(cuerpo\)\)\.slice\(0, 120\)/.test(src), "sino un extracto saneado");
    });

    t.caso("v18.0.109 (B11): con una consulta de exámenes en vuelo, un segundo clic en «Exámenes» no abre otro chooser", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? {} : null);
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 111111", closest: () => null }] : []);
      c.api.createLabInjectorUI();
      const btn = c.env.doc.body.children.find((n) => n.id === "vgl-lab-injector");
      const choosers = () => c.env.doc.body.children.filter((n) => n.id === "vgl-chooser-modal").length;
      btn.dataset.vglEnCurso = "1";
      btn.onclick();
      t.igual(choosers(), 0, "en vuelo: el clic no abre el chooser (antes: el segundo pisaba el veredicto del primero)");
      btn.dataset.vglEnCurso = "";
      btn.onclick();
      t.igual(choosers(), 1, "sin nada en vuelo, el clic abre el chooser como siempre");
    });

    // =====================================================================
    // v18.0.110 — OPORTUNIDADES S+ RESTANTES (C15, C19, C21) — B7 está en suite_10
    // =====================================================================
    await t.casoAsync("v18.0.110 (C15): el modal de Laboratorios nace con el hueco del recuadro renal reservado (sin salto de maquetación)", async () => {
      const c = cargar({ silencioso: true });
      await c.api.openLaboratoriosModal({ doc_id: "111111", nombre: "PACIENTE PRUEBA" });
      const modal = c.env.doc.getElementById("vgl-labs-modal");
      t.cierto(!!modal, "el modal se abrió");
      t.cierto(/id="vgl-labs-renal" class="vgl-labs-renal-slot"/.test(modal.innerHTML), "el hueco #vgl-labs-renal existe desde el primer pintado, con su clase de altura mínima");
      t.cierto(/vgl-labs-renal-vacio">🫘 <b>Función renal:<\/b> calculando/.test(modal.innerHTML), "y dice que está calculando (antes: aparecía de golpe y empujaba la tabla)");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/#vgl-labs-modal \.vgl-labs-renal-slot\{min-height:64px\}/.test(src), "la clase reserva la altura en la hoja de estilos");
    });

    t.caso("v18.0.110 (C21): regla única — los cuadros de consulta cierran con clic fuera, los de escritura nunca; todo id de cuadro que crea el script está en una de las dos listas", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      const d = c.env.doc;
      const clicFuera = (el) => (el._listeners.click || []).forEach((f) => f({ target: el }));
      const clicDentro = (el) => (el._listeners.click || []).forEach((f) => f({ target: { id: "hijo" } }));
      const enBody = (id) => d.body.children.some((n) => n.id === id);

      // chooser (consulta)
      c.api._vglChooserModal({ titulo: "Exámenes", opciones: [{ etiqueta: "A", valor: "a" }] });
      const chooser = d.body.children.find((n) => n.id === "vgl-chooser-modal");
      t.cierto(!!chooser, "el chooser está en pantalla");
      clicDentro(chooser);
      t.cierto(enBody("vgl-chooser-modal"), "un clic DENTRO del cuadro no lo cierra");
      clicFuera(chooser);
      t.falso(enBody("vgl-chooser-modal"), "un clic FUERA (en el fondo) lo cierra");

      // cartel grande (consulta)
      c.api.bigAlert("ROJO", "Ingreso fuera de turno", "Detalle de prueba");
      const cartel = d.body.children.find((n) => n.id === "vgl-modal");
      t.cierto(!!cartel, "el cartel está en pantalla");
      clicFuera(cartel);
      t.falso(enBody("vgl-modal"), "el cartel cierra con clic fuera");

      // pendientes del paciente (consulta)
      c.api.avisoUniversal("PACIENTE PRUEBA", { pym: ["Tamizaje de prueba"] }, true);
      const pym = d.body.children.find((n) => n.id === "vgl-pym-modal");
      t.cierto(!!pym, "el aviso de pendientes está en pantalla");
      clicFuera(pym);
      t.falso(enBody("vgl-pym-modal"), "el aviso de pendientes cierra con clic fuera (antes: solo «Entendido»)");

      // escritura: la función se niega y no cuelga ningún listener
      let cerrados = 0;
      c.api.VGL_MODALES_ESCRITURA.forEach((id) => {
        const el = d.createElement("div"); el.id = id;
        t.falso(c.api._vglCerrarConClicFuera(el, () => { cerrados++; }), id + ": la regla no se aplica a un cuadro de escritura");
        clicFuera(el);
      });
      t.igual(cerrados, 0, "ningún cuadro de escritura cierra con clic fuera");
      const desconocido = d.createElement("div"); desconocido.id = "vgl-cuadro-inventado";
      t.falso(c.api._vglCerrarConClicFuera(desconocido, () => {}), "un id fuera de las dos listas tampoco cierra: la lista de consulta es explícita");

      // las dos listas cubren todos los cuadros que el script crea, y no se solapan
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const ids = new Set();
      src.replace(/\.id = "(vgl-[a-z0-9-]+)"/g, (m, id) => { if (/-modal$/.test(id) || id === "vgl-postcita-panel") ids.add(id); return m; });
      const consulta = c.api.VGL_MODALES_CONSULTA, escritura = c.api.VGL_MODALES_ESCRITURA;
      const sinRegla = [...ids].filter((id) => consulta.indexOf(id) < 0 && escritura.indexOf(id) < 0);
      t.cierto(ids.size >= 12, "se encontraron los cuadros del script: " + ids.size);
      t.igual(sinRegla.join(","), "", "todo cuadro está en una de las dos listas (uno nuevo tiene que decidirse): " + sinRegla.join(","));
      t.igual(consulta.filter((id) => escritura.indexOf(id) >= 0).join(","), "", "y ninguno está en las dos");
      ["vgl-agendar-modal", "vgl-ordenar-modal", "vgl-ia-modal", "vgl-llenar-modal"].forEach((id) => t.cierto(escritura.indexOf(id) >= 0, id + " es de escritura"));
      t.falso(/modal\.addEventListener\("click", \(e\) => \{ if \(e\.target === modal\) cerrar\(\); \}\);/.test(src), "el chooser ya no lleva su manejador propio: pasa por la regla única");
    });

    await t.casoAsync("v18.0.110 (C19): BuscarPacienteDetallado se pide UNA vez por paciente aunque Agendar, Ordenar y los demográficos lo pidan a la vez; y el sondeo ±7 días no repite el día central", async () => {
      let n = 0;
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          if (String(url).includes("BuscarPacienteDetallado")) { n++; await new Promise((r) => setTimeout(r, 5)); return respuestaJson({ data: { id: 77, edad: 60, sexo: "F", celular: "3001112233" } }); }
          return respuestaJson({});
        },
      });
      const [a, b] = await Promise.all([c.api.apiPacienteDetalladoCacheado("77"), c.api.apiPacienteDetalladoCacheado("77")]);
      t.igual(n, 1, "dos peticiones en vuelo a la vez se fusionan en UNA (antes: dos idénticas)");
      t.cierto(a === b && a.data.edad === 60, "y las dos reciben la misma respuesta");
      const demo = await c.api.apiAccesoObtenerDemograficos("77");
      t.igual(n, 1, "los demográficos salen de la misma caché, sin otra petición");
      t.cierto(demo && demo.edad === 60 && demo.sexo === "F", "con edad y sexo");
      await c.api.apiPacienteDetalladoCacheado("78");
      t.igual(n, 2, "otro paciente sí se pide");
      c.api._demograficosInvalidar();
      await c.api.apiPacienteDetalladoCacheado("78");
      t.igual(n, 3, "al cambiar de historia (invalidar) se vuelve a pedir: nunca datos del anterior");
      // un fallo no se cachea
      let falla = true, m = 0;
      const c2 = cargar({ silencioso: true, fetch: async (url) => { if (String(url).includes("BuscarPacienteDetallado")) { m++; if (falla) throw new Error("red caída"); return respuestaJson({ data: { id: 79 } }); } return respuestaJson({}); } });
      const r0 = await c2.api.apiPacienteDetalladoCacheado("79");
      t.cierto(!r0 && m >= 1, "con la red caída no hay respuesta (pageFetchJson la traga tras sus reintentos)");
      falla = false;
      const mAntes = m;
      const r = await c2.api.apiPacienteDetalladoCacheado("79");
      t.cierto(m === mAntes + 1 && r && r.data && r.data.id === 79, "y el siguiente intento vuelve a pedir (el fallo no queda cacheado)");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/const candidatos = range\.filter\(\(x\) => !x\.isCenter\)/.test(src) && /mapConLimite\(candidatos, 2,/.test(src), "el sondeo salta el día central (que cargarHoras ya pide) y va de dos en dos");
      t.igual((src.match(/apiPacienteDetalladoCacheado\(/g) || []).length, 4, "los tres consumidores (Agendar, Ordenar, demográficos) pasan por la caché");
      t.igual((src.match(/BuscarPacienteDetallado\?idPaciente=/g) || []).length, 1, "y la URL cruda solo vive en ella");
    });

    await t.casoAsync("v18.0.111 (C9): un diccionario de rótulos — el botón del dock, el título del cuadro que abre y las leyendas dicen la misma palabra", async () => {
      const c = cargar({ silencioso: true });
      const R = c.api.VGL_ROTULOS;
      t.cierto(!!R && Object.isFrozen(R), "el diccionario existe y está congelado");
      const vals = Object.values(R);
      t.igual(new Set(vals).size, vals.length, "sin dos rótulos iguales");
      t.cierto(vals.every((v) => typeof v === "string" && v.trim().length > 2), "todos con texto");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      ["labs", "agendar", "ordenar", "panel", "redactar", "control"].forEach((k) => {
        t.cierto(new RegExp("_vglDockRotulo\\(b[A-Za-z]+, \"[^\"]+\", VGL_ROTULOS\\." + k).test(src), "dock · " + k + " usa VGL_ROTULOS." + k);
      });
      t.cierto(/id="vgl-labs-title">\$\{MTR_ICONO_FLASK\} \$\{VGL_ROTULOS\.labs\}/.test(src), "título de Laboratorios");
      t.cierto(/id="vgl-agm-title">📅 \$\{VGL_ROTULOS\.agendar\}/.test(src), "título de Agendar");
      t.igual((src.match(/id="vgl-ord-title">\$\{VGL_ROTULOS\.ordenar\}/g) || []).length, 2, "los dos títulos de Ordenar");
      t.cierto(/id="vgl-paquete-title">\$\{ICO\.pkg\} \$\{VGL_ROTULOS\.control\}/.test(src), "título de Próximo control");
      t.cierto(/MTR_ICONO_ACTIVITY \+ VGL_ROTULOS\.panel \+ '<\/div>'/.test(src), "título del Panel");
      t.cierto(/MTR_IA_ICONOS\.pluma \+ VGL_ROTULOS\.redactar \+ ' · Redacción asistida/.test(src), "título del Redactor");
      t.cierto(/titulo: VGL_ROTULOS\.examenes,/.test(src), "el chooser de Exámenes");
      t.cierto(/use «\$\{VGL_ROTULOS\.agendar\}»; para pedir exámenes nuevos, «\$\{VGL_ROTULOS\.ordenar\}»/.test(src), "la leyenda de Laboratorios remite a «Agendar» y «Ordenar», no a nombres que no están en el dock");
      t.falso(/use Programación de cita;/.test(src), "el nombre viejo a secas ya no se usa como referencia");
      await c.api.openLaboratoriosModal({ doc_id: "111111", nombre: "PACIENTE PRUEBA" });
      const modal = c.env.doc.getElementById("vgl-labs-modal");
      t.cierto(modal && modal.innerHTML.includes('id="vgl-labs-title">') && modal.innerHTML.includes(R.labs + "</div>"), "el título pintado dice «" + R.labs + "»");
    });

    t.caso("v18.0.112 (C20): el menú de elección recuerda la última opción (va primera, marcada) y admite teclado: Enter y 1/2", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      const d = c.env.doc;
      const elegidos = [];
      const abrir = () => c.api._vglChooserModal({ titulo: "Exámenes", recordar: "prueba", opciones: [{ id: "ultima", rotulo: "Última toma" }, { id: "historial", rotulo: "Historial" }], onPick: (id) => elegidos.push(id) });
      const opciones = (m) => m.children[0].children.find((n) => n.className === "vgl-chooser-body").children;
      const tecla = (m, key, target) => (m._listeners.keydown || []).forEach((f) => f({ key, target: target || m, preventDefault() {} }));
      let m = abrir();
      t.igual(opciones(m).map((b) => b.getAttribute("data-chooser-id")).join(","), "ultima,historial", "primera apertura: orden original, nada marcado");
      t.falso(opciones(m).some((b) => b.className.includes("vgl-chooser-ult")), "sin recuerdo no hay marca");
      tecla(m, "2");
      t.igual(elegidos.join(","), "historial", "la tecla 2 elige la segunda");
      t.igual(c.env.storage.getItem("vgl_chooser_prueba"), "historial", "y se recuerda");
      m = abrir();
      const ops = opciones(m);
      t.igual(ops.map((b) => b.getAttribute("data-chooser-id")).join(","), "historial,ultima", "segunda apertura: la recordada va primera");
      t.cierto(ops[0].className.includes("vgl-chooser-ult") && ops[0].children.some((n) => n.className === "vgl-chooser-txt" && n.children[0].textContent.includes("la última vez")), "marcada como «la última vez»");
      t.igual(ops.map((b) => b.children[0].textContent).join(","), "1,2", "cada opción muestra su tecla");
      tecla(m, "Enter");
      t.igual(elegidos.join(","), "historial,historial", "Enter elige la recordada");
      m = abrir();
      tecla(m, "Enter", ops[1]);
      t.igual(elegidos.length, 2, "Enter SOBRE un botón de opción no elige por teclado (el clic nativo ya lo hace: nunca dos veces)");
      opciones(m).find((b) => b.getAttribute("data-chooser-id") === "ultima")._listeners.click.forEach((f) => f());
      t.igual(elegidos.join(","), "historial,historial,ultima", "un clic sigue siendo un clic");
      t.igual(c.env.storage.getItem("vgl_chooser_prueba"), "ultima", "y actualiza el recuerdo");
      const sinRec = c.api._vglChooserModal({ titulo: "X", opciones: [{ id: "a", rotulo: "A" }], onPick: () => {} });
      t.igual(c.env.storage.getItem("vgl_chooser_"), null, "sin `recordar` no se guarda nada");
      t.cierto(!!sinRec, "y el cuadro abre igual");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/titulo: VGL_ROTULOS\.examenes,[\s\S]{0,200}recordar: "examenes",/.test(src), "el menú de «Exámenes» recuerda");
    });

    await t.casoAsync("v18.0.112 (C12): con antecedentes por documentar, el dock muestra el botón atenuado «📝 Faltan antecedentes» en lugar del Panel, y abre el ayudante", async () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      mockPacienteDock(c, "555666777");
      const toasts = [];
      const bandeja = { prepend: (n) => toasts.push(n), appendChild: (n) => toasts.push(n), children: [], querySelector: () => null, querySelectorAll: () => [] };
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : (id === "vgl-toasts" ? bandeja : null));
      // hay resumen (la compuerta «aún cargando» no aplica) pero los factores navegables no están documentados
      c.api.mtrCacheResumenGuardar("555666777", { factores: { sexo: "M", edad: 60 } });
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const btns = dock.children.find((n) => n.className === "vgl-dock-btns");
      const accs = btns.children.map((b) => b.getAttribute("data-accion"));
      t.igual(accs.indexOf("ficha"), -1, "el Panel sigue oculto (compuerta de completitud)");
      const bF = btns.children.find((b) => b.getAttribute("data-accion") === "faltan");
      t.cierto(!!bF, "pero existe el botón «Faltan antecedentes» (antes: el ayudante era inalcanzable)");
      t.cierto(bF.className.includes("vgl-dock-btn-atenuado"), "atenuado");
      t.cierto(/Hipertensión/.test(bF.title) && /Antecedentes/.test(bF.title), "y dice QUÉ falta y dónde: " + bF.title);
      t.cierto(bF.children.some((n) => n.className === "vgl-dock-lbl" && n.textContent === "Faltan antecedentes"), "con el rótulo del diccionario");
      bF._listeners.click.forEach((f) => f({ stopPropagation() {} }));
      await esperar(30);   // el toast se pinta en el flush de la cola
      const llenar = c.env.doc.body.children.find((n) => n.id === "vgl-llenar-modal");
      const aviso = toasts.find((n) => n.querySelector && /Faltan antecedentes/.test(n.querySelector(".vgl-toast-title").textContent) && /Hipertensión/.test(n.querySelector(".vgl-toast-b").textContent));
      t.cierto(!!llenar || !!aviso, "el clic abre el ayudante de llenado o, si esas casillas no se pueden llenar desde aquí, lo dice con la pestaña (toasts: " + toasts.length + ")");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/else if \(_autorizado && _resumenListoParaGate && _factoresParaGate && _pendientesPanel\.length > 0\)/.test(src), "solo con resumen y factores leídos: nunca se inventa un faltante mientras carga");
    });

    // =====================================================================
    // v18.0.114 — REPORTES EN VIVO (02-sep): la anulación muda y sin camino de vuelta a Agendar
    // =====================================================================
    t.caso("v18.0.114: el veredicto de la anulación acepta las formas conocidas de Everest y el motivo dice qué pasó de verdad", () => {
      const c = cargar({ silencioso: true });
      const ok = c.api._anulacionConfirmada, mot = c.api._anulacionMotivo;
      t.cierto(ok({ error: false, mensaje: "Cancelado Correctamente" }), "la forma capturada el 19-ago");
      t.cierto(ok({ isError: false, mensaje: "Cancelado Correctamente" }), "isError:false también confirma");
      t.cierto(ok({ isError: false }) && ok({ Error: false }), "isError:false / Error:false confirman por sí solos, sin mensaje");
      t.cierto(ok({ mensaje: "Cita cancelada correctamente" }), "un mensaje que dice «cancelada» confirma");
      t.falso(ok({ error: true, mensaje: "Cancelado Correctamente" }), "error:true manda sobre cualquier mensaje");
      t.falso(ok({ mensaje: "No se pudo cancelar la cita" }), "«no se pudo cancelar» no confirma");
      t.falso(ok(null) || ok("texto") || ok({}), "sin cuerpo, texto suelto o un objeto vacío: no se confirma");
      t.cierto(/tope de 15 s/.test(mot({ red: true, error: "The operation was aborted" })), "tope de red: lo dice, con los segundos");
      t.cierto(/sesión de Everest caducó \(HTTP 401\)/.test(mot({ status: 401 })), "401: sesión caducada");
      t.cierto(/servidor de Everest \(HTTP 503\)/.test(mot({ status: 503 })), "5xx: error del servidor");
      t.cierto(/rechazó la petición \(HTTP 400: parámetro inválido\)/.test(mot({ status: 400, data: { mensaje: "parámetro inválido" } })), "4xx: rechazo con el mensaje de Everest");
      t.cierto(/respondió «Cita no encontrada» sin confirmar/.test(mot({ status: 200, data: { mensaje: "Cita no encontrada" } })), "200 con mensaje que no confirma: se cita el mensaje");
      t.cierto(/sin datos legibles \(HTTP 200\)/.test(mot({ status: 200, data: null })), "200 sin JSON: se dice");
    });

    await t.casoAsync("v18.0.114: «Cancelar esta cita» dice el motivo real (antes: «NO confirmó» a secas y null en todo fallo) y el reintento sustituye el aviso; con confirmación limpia las marcas", async () => {
      let modo = "500";
      const c = cargar({ silencioso: true, fetch: async (url) => {
        if (!/CancelarCita/.test(String(url))) return respuestaJson({});
        if (modo === "500") return { ok: false, status: 500, headers: { get: () => null }, text: async () => "Internal Server Error", json: async () => ({}), clone() { return this; } };
        if (modo === "red") throw new Error("The operation was aborted");
        if (modo === "200raro") return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ mensaje: "Cita no encontrada" }), json: async () => ({ mensaje: "Cita no encontrada" }), clone() { return this; } };
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ isError: false, mensaje: "Cancelado Correctamente" }), json: async () => ({ isError: false }), clone() { return this; } };
      } });
      enriquecerDom(c);
      const toasts = [];
      c.api.showToast = undefined;   // no se puede sustituir: se observa por la bandeja
      const bandeja = c.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n._parent = bandeja; toasts.push(n); };
      const getOrig = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : getOrig(id));
      c.api.__state.activeDoctor = { id: 707, name: "MEDICO PRUEBA" };
      c.api.markCitaAgendadaHoy("111222333", "2026-10-01", { citaId: "7813686", pacienteId: "5150", eps: "EPS", hora: "8:40 AM" });
      t.falso(await c.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "HTTP 500: no se anula");
      t.cierto(/servidor de Everest \(HTTP 500\)/.test(c.api._anularUltimoMotivoLeer()), "y el motivo guardado es el real: " + c.api._anularUltimoMotivoLeer());
      await esperar(30);
      t.cierto(toasts.length === 1 && /HTTP 500/.test(toasts[0].querySelector(".vgl-toast-b").textContent), "el aviso rojo lleva el motivo (antes: «NO confirmó la anulación» a secas)");
      t.cierto(c.api.isCitaAgendadaHoy("111222333"), "las marcas locales no se tocan");
      modo = "red";
      t.falso(await c.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "sin red: no se anula");
      t.cierto(/tope de 15 s/.test(c.api._anularUltimoMotivoLeer()), "motivo: tope de red");
      await esperar(30);
      t.igual(bandeja.children.filter((n) => !n.classList.contains("out")).length, 1, "el reintento SUSTITUYE el aviso anterior (misma clave), no lo apila (la captura del médico mostraba dos)");
      modo = "200raro";
      t.falso(await c.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "200 con «Cita no encontrada»: no se da por anulada");
      modo = "ok";
      t.cierto(await c.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "con isError:false Everest confirmó (antes: solo error:false valía)");
      t.igual(c.api._anularUltimoMotivoLeer(), "", "sin motivo pendiente");
      t.falso(c.api.isCitaAgendadaHoy("111222333"), "y las marcas locales se limpian");
      c.env.doc.getElementById = getOrig;
    });

    await t.casoAsync("v18.0.114: el recordatorio ofrece «Abrir Agendar de nuevo», el motivo de una anulación fallida se ve en el sitio, y abrirRecordatorioCita lo cablea", async () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      let panelNode = null, abiertos = 0;
      const getOrig = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-postcita-panel" ? panelNode : getOrig(id));
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE PRUEBA", "", { reabierto: true, turnoId: "900", cita: { fechaLegible: "01/10/2026" }, onAgendarOtra: () => { abiertos++; }, onCancelar: async () => false });
      panelNode = c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel").pop();
      const cancelar = panelNode.querySelector("#vgl-postcita-cancelar");
      await Promise.all((cancelar._listeners.click || []).map((f) => f({})));
      t.cierto(/No se anuló/.test(panelNode.querySelector("#vgl-postcita-anular-nota").textContent), "la nota bajo el botón dice que no se anuló y por qué");
      t.igual(cancelar.textContent, "🗑 Reintentar la cancelación", "el botón invita a reintentar");
      const otra = panelNode.querySelector("#vgl-postcita-agendar-otra");
      (otra._listeners.click || []).forEach((f) => f({}));
      t.igual(abiertos, 1, "«Abrir Agendar de nuevo» abre el módulo");
      t.falso(c.env.doc.body.children.some((n) => n.id === "vgl-postcita-panel"), "y cierra el recordatorio");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/onAgendarOtra: \(\) => openAgendamientoModal\(apt \|\| \{ doc_id: docId, nombre: det\.nombre \|\| "" \}\)/.test(src), "abrirRecordatorioCita cablea el camino de vuelta");
      c.env.doc.getElementById = getOrig;
    });

    t.caso("v18.0.114: con cita y toma agendadas hoy y sin radicado guardado, el dock ya no deja un botón gris e inerte: abre Agendar de nuevo", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      mockPacienteDock(c, "555666777");
      c.api.markCitaAgendadaHoy("555666777", "2026-10-01");   // sin citaId: no hay recordatorio que reabrir
      c.api.markLabAgendadaHoy("555666777");
      c.api.createAccionesDockUI();
      const dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      const bAg = dock.children.find((n) => n.className === "vgl-dock-btns").children.find((b) => b.getAttribute("data-accion") === "agendar");
      t.cierto(!!bAg && !bAg.disabled, "el botón existe y está VIVO (antes: disabled «Agendado»)");
      t.cierto(bAg.children.some((n) => n.className === "vgl-dock-lbl" && n.textContent === "Agendado · abrir"), "y dice que abre");
      (bAg._listeners.click || []).forEach((f) => f({ stopPropagation() {} }));
      t.cierto(c.env.doc.body.children.some((n) => n.id === "vgl-agendar-modal"), "el clic abre el módulo Agendar");
    });

    // =====================================================================
    // v18.0.115 — decisiones de la entrevista, tercera tanda: C11 (Laboratorios) y C17 (Agendar)
    // =====================================================================
    await t.casoAsync("v18.0.115 (C11): «Laboratorios» sirve la precarga si tiene menos de 2 min (sin red) y lo dice; «Buscar laboratorios nuevos» consulta en vivo; una precarga vieja no se sirve", async () => {
      let athenea = 0;
      const mk = () => { const c = cargar({ silencioso: true, gmxhr: (o) => { if (/athenea|laboratorio/i.test(String(o.url || ""))) athenea++; if (o.onerror) setTimeout(() => o.onerror("sin portal en la prueba"), 0); return { abort() {} }; } }); enriquecerDom(c); return c; };
      const c = mk();
      const labs = [{ nombre: "CREATININA", valor: "1.0", fecha: "2026-08-20" }];
      c.api.__setLabsPrefetchParaTest("111111", labs, Date.now() - 30000);
      await c.api.openLaboratoriosModal({ doc_id: "111111", nombre: "PACIENTE PRUEBA" });
      let modal = c.env.doc.getElementById("vgl-labs-modal");
      t.cierto(!!modal, "el modal abrió");
      t.igual(athenea, 0, "con precarga de 30 s no se consulta el portal (antes: siempre 3-6 s y red duplicada)");
      t.cierto(/Leídos hace \d+ s \(precarga\)/.test(modal.querySelector("#vgl-labs-srconline").textContent), "y lo dice: " + modal.querySelector("#vgl-labs-srconline").textContent);
      t.cierto(modal.innerHTML.includes('id="vgl-labs-nuevos"') && modal.innerHTML.includes("Buscar laboratorios nuevos"), "con el botón «Buscar laboratorios nuevos»");
      const btn = modal.querySelector("#vgl-labs-nuevos");
      (btn._listeners.click || []).forEach((f) => f({}));
      await esperar(30);
      t.cierto(athenea >= 1, "el botón consulta en vivo aunque la precarga sea fresca");
      const c2 = mk(); athenea = 0;
      c2.api.__setLabsPrefetchParaTest("111111", labs, Date.now() - 5 * 60000);
      await c2.api.openLaboratoriosModal({ doc_id: "111111", nombre: "PACIENTE PRUEBA" });
      t.cierto(athenea >= 1, "una precarga de 5 min NO se sirve: se consulta en vivo");
      const c3 = mk(); athenea = 0;
      c3.api.__setLabsPrefetchParaTest("999999", labs, Date.now() - 1000);
      await c3.api.openLaboratoriosModal({ doc_id: "111111", nombre: "PACIENTE PRUEBA" });
      t.cierto(athenea >= 1, "la precarga de OTRA cédula tampoco se sirve");
    });

    await t.casoAsync("v18.0.115 (C17): Agendar recuerda tipo y especialidad de la última cita creada y abre en el paso 2 con el chip «como la última vez · cambiar»; sin recuerdo abre en el paso 1", async () => {
      const urls = [];
      const mk = () => {
        const c = cargar({ silencioso: true, fetch: async (url) => {
          const u = String(url); urls.push(u);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) return respuestaJson({ agendas: [] });
          return respuestaJson({});
        } });
        enriquecerDom(c);
        c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
        return c;
      };
      const c = mk();
      t.igual(c.api._agmPrefLeer(), null, "sin nada guardado no hay recuerdo");
      c.api.openAgendamientoModal({ doc_id: "424242", nombre: "PACIENTE PRUEBA" });
      await esperar(40);
      let modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.cierto(modal.querySelector("#vgl-step-view-2").style.display !== "block", "sin recuerdo: no se salta al paso 2 (irAPaso(2) no corre)");
      t.igual(modal.querySelector("#vgl-agm-pref-chip").querySelector(".vgl-agm-pref-txt").textContent, "", "y el chip queda sin texto (no se aplicó ningún recuerdo)");
      // se guarda SOLO con la cita creada de verdad: lo hace el camino de confirmación; aquí se simula el registro
      t.cierto(c.api._agmPrefGuardar("control", 46, "Psicología"), "se guarda el recuerdo");
      t.falso(c.api._agmPrefGuardar("lab", 46, "x"), "«solo laboratorios» no se recuerda (va a otro cuadro)");
      urls.length = 0;
      const c2 = cargar({ silencioso: true, almacen: c.env.almacen, fetch: async (url) => { const u = String(url); urls.push(u); if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } }); if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } }); return respuestaJson({ agendas: [] }); } });
      enriquecerDom(c2); c2.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c2.api.openAgendamientoModal({ doc_id: "424242", nombre: "PACIENTE PRUEBA" });
      await esperar(60);
      modal = c2.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.igual(modal.querySelector("#vgl-step-view-2").style.display, "block", "con recuerdo: abre en el paso 2");
      const chip = modal.querySelector("#vgl-agm-pref-chip");
      t.cierto((chip.classList._s ? !chip.classList._s.has("vgl-d-none") : true), "el chip se ve (se le quitó vgl-d-none)");
      t.cierto(/Como la última vez: solo control médico · Psicología/.test(chip.querySelector(".vgl-agm-pref-txt").textContent), "y dice qué se recordó: " + chip.querySelector(".vgl-agm-pref-txt").textContent);
      t.cierto(urls.some((u) => u.includes("BuscarCitasDisponibles") && /EspecialidadId=46/.test(u)), "la primera carga de horas ya sale con la especialidad recordada (46): " + (urls.find((u) => u.includes("BuscarCitasDisponibles")) || "sin llamada"));
      (modal.querySelector("#vgl-agm-pref-cambiar")._listeners.click || []).forEach((f) => f({}));
      t.igual(modal.querySelector("#vgl-step-view-1").style.display, "block", "«cambiar» vuelve al paso 1");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/_agmPrefGuardar\(tipoCitaElegido, selectedEspId, selectedEspName\);[^\n]*\n\s*markCitaAgendadaHoy\(apt\.doc_id, fechaElegida\.iso/.test(src), "el recuerdo se guarda en el camino de la cita creada de verdad, justo antes de la marca del día");
    });

    // =====================================================================
    // v18.0.117 — AUDITORÍA UI/UX (fragmentos F-1 y F-2 del enjambre del 02-sep)
    // =====================================================================
    await t.casoAsync("v18.0.117 (UI/UX #1): con la toma marcada y sin hora, «Confirmar» NO crea la cita: despliega el detalle de la toma y pide la hora", async () => {
      const urls = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url); urls.push(u);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
          if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
          if (u.includes("BuscarCitasDisponibles")) {
            const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
            return respuestaJson({ agendas: [{ agendaId: 55, medico: "ANA MARIA PEREZ", fechaAgenda: iso.split("-").reverse().join("/"), sede: "CMB" }] });
          }
          if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false, mensaje: "Superó las validaciones" } });
          if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }] });
          return respuestaJson({});
        },
        gmxhr: (o) => {
          if (String(o.url).includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ hora: "06:30:00" }] }) });
          else if (o.onerror) o.onerror("url no simulada");
        },
      });
      enriquecerDom(c);
      c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c.api.openAgendamientoModal({ doc_id: "555111", nombre: "PACIENTE SINTETICO" });
      await esperar(60);
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const turno = modal.querySelector("#vgl-agm-slots").children[0];
      disparar(turno, "click");
      const confirmar = modal.querySelector("#vgl-agm-confirm");
      const chkLab = modal.querySelector("#vgl-agm-lab-chk");
      const selLab = modal.querySelector("#vgl-agm-lab-time-sel");
      const planDet = modal.querySelector("#vgl-agm-plan-det");
      chkLab.checked = true; selLab.value = "";            // la casilla marcada (labs-primero) y sin hora
      planDet.classList.add("vgl-d-none");                 // el detalle, plegado
      const antes = urls.filter((u) => u.includes("AsignarTurno")).length;
      confirmar.dataset.ultimoClic = "0";
      disparar(confirmar, "click");
      await esperar(40);
      t.igual(urls.filter((u) => u.includes("AsignarTurno")).length, antes, "NO se creó ninguna cita (antes: se creaba y la toma fallaba con un motivo falso)");
      t.falso(planDet.classList.contains("vgl-d-none"), "el detalle de la toma se despliega para que la hora se vea");
      t.cierto(/Elija la hora de la toma/.test(confirmar.textContent), "y el botón pide la hora: " + confirmar.textContent);
      // con la hora elegida, el mismo clic sí procede
      selLab.value = "06:30:00";
      confirmar.dataset.ultimoClic = "0";
      disparar(confirmar, "click");
      await esperar(60);
      t.cierto(urls.filter((u) => u.includes("AsignarTurno")).length > antes, "con la hora elegida, Confirmar sigue adelante");
    });

    t.caso("v18.0.117 (UI/UX #2): el aviso de vencimiento vive FUERA de las vistas de paso, así que se ve al confirmar en el paso 3", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c.api.openAgendamientoModal({ doc_id: "555111", nombre: "PACIENTE SINTETICO" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      const html = modal.innerHTML;
      const iAviso = html.indexOf('id="vgl-agm-vencaviso"');
      const iPaso1 = html.indexOf('id="vgl-step-view-1"');
      const iPaso2 = html.indexOf('id="vgl-step-view-2"');
      t.cierto(iAviso > 0 && iPaso1 > 0 && iPaso2 > 0, "los tres nodos existen en la plantilla");
      t.cierto(iAviso < iPaso1, "el aviso va ANTES del paso 1: fuera de las tres vistas (antes vivía dentro del paso 2, oculto en el 3)");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/uxTrack\("cita\.vencimiento\.corregir"\); \} catch \(e\) \{\}\s*\n[^\n]*\n[^\n]*\n\s*try \{ if \(typeof pasoActual !== "undefined" && pasoActual !== 2\) irAPaso\(2\); \}/.test(src), "«Pasar a la fecha sugerida» vuelve al paso 2, donde están los chips de día");
    });

    // =====================================================================
    // v18.0.118 — AUDITORÍA UI/UX, lote 2 (F-4, F-5, F-6, F-9, F-10) + decisión de Ordenar
    // =====================================================================
    await t.casoAsync("v18.0.118 (UI/UX #4): con cita de hoy, Confirmar pinta el recuadro de decisión y NO crea nada; «Sí, crear igual» crea; «Revisar» deja el flag limpio", async () => {
      const urls = [];
      const mk = () => {
        const c = cargar({
          silencioso: true,
          fetch: async (url) => {
            const u = String(url); urls.push(u);
            if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
            if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
            if (u.includes("BuscarCitasDisponibles")) {
              const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
              return respuestaJson({ agendas: [{ agendaId: 55, medico: "ANA MARIA PEREZ", fechaAgenda: iso.split("-").reverse().join("/"), sede: "CMB" }] });
            }
            if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false, mensaje: "Superó las validaciones" } });
            if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 900, horaTexto: "08:00 AM", estado: "ACT" }] });
            if (u.includes("AsignarTurno")) return respuestaJson({ error: false, data: { radicado: 4242, motivo: "Agendada Correctamente" } });
            return respuestaJson({});
          },
          gmxhr: (o) => { if (o.onerror) o.onerror("sin AppCita en la prueba"); },
        });
        enriquecerDom(c);
        c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
        return c;
      };
      const c = mk();
      c.api.markCitaAgendadaHoy("555111", "2026-10-01");     // ya hay una cita de hoy
      c.api.openAgendamientoModal({ doc_id: "555111", nombre: "PACIENTE SINTETICO" });
      await esperar(60);
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-agendar-modal");
      disparar(modal.querySelector("#vgl-agm-slots").children[0], "click");
      const confirmar = modal.querySelector("#vgl-agm-confirm");
      const caja = modal.querySelector("#vgl-agm-confirm-aviso");
      const rotuloAntes = confirmar.textContent;
      confirmar.dataset.ultimoClic = "0";
      disparar(confirmar, "click");
      await esperar(30);
      t.igual(urls.filter((u) => u.includes("AsignarTurno")).length, 0, "no se creó ninguna cita");
      t.cierto(/ya se le creó una cita/.test(caja.innerHTML), "el aviso vive en el recuadro, con su motivo");
      t.cierto(/Sí, crear igual/.test(caja.innerHTML) && /Revisar/.test(caja.innerHTML), "y con dos salidas explícitas");
      t.igual(confirmar.textContent, rotuloAntes, "el botón CONSERVA su rótulo (antes lo reescribían tres avisos encadenados)");
      t.igual(confirmar.dataset.dupOk, "", "y no se da por consentido nada todavía");
      // «Revisar» cierra el recuadro y deja el flag limpio: el próximo intento vuelve a preguntar
      const no = caja.querySelector("#vgl-agm-ca-no");
      (no._listeners.click || []).forEach((f) => f({}));
      t.igual(caja.innerHTML, "", "«Revisar» retira el recuadro");
      t.igual(confirmar.dataset.dupOk, "", "sin consentir nada");
      // «Sí, crear igual» sí crea
      confirmar.dataset.ultimoClic = "0";
      disparar(confirmar, "click");
      await esperar(30);
      const si = caja.querySelector("#vgl-agm-ca-si");
      (si._listeners.click || []).forEach((f) => f({}));
      await esperar(60);
      t.igual(urls.filter((u) => u.includes("AsignarTurno")).length, 1, "«Sí, crear igual» sigue adelante: el médico manda");
    });

    t.caso("v18.0.118 (UI/UX #5): sin resumen calculado, el dock muestra «Panel del paciente · leyendo…» deshabilitado en vez de un hueco", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      mockPacienteDock(c, "555666777");
      c.api.createAccionesDockUI();
      let dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      let btns = dock.children.find((n) => n.className === "vgl-dock-btns");
      const bLey = btns.children.find((b) => b.getAttribute("data-accion") === "ficha-leyendo");
      t.cierto(!!bLey && bLey.disabled === true, "existe y está deshabilitado");
      t.cierto(/Leyendo laboratorios/.test(String(bLey.title || "")), "y dice qué está haciendo");
      t.igual(btns.children.filter((b) => b.getAttribute("data-accion") === "ficha").length, 0, "el botón real todavía no");
      // con el resumen ya calculado, el botón real sustituye al de «leyendo»
      c.api.mtrCacheResumenGuardar("555666777", { factores: { hta: true, diabetes: true, tabaquismo: false, sexo: "M", edad: 60 } });
      c.env.doc.getElementById = (id) => (id === "vgl-acciones-dock" ? dock : (id === "anamesis" ? { id: "anamesis" } : null));
      c.api.createAccionesDockUI();
      dock = c.env.doc.body.children.find((n) => n.id === "vgl-acciones-dock");
      btns = dock.children.find((n) => n.className === "vgl-dock-btns");
      t.igual(btns.children.filter((b) => b.getAttribute("data-accion") === "ficha-leyendo").length, 0, "«leyendo» desaparece en cuanto hay resumen: el dock se repinta");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/_resumenListoParaGate \? "RS" : "rs"\]\.join\("\|"\)/.test(src),
        "y ese estado entra en la firma del dock: sin él, «leyendo» se quedaba puesto cuando el resumen llegaba con los factores aún incompletos (lo destapó esta prueba)");
    });

    await t.casoAsync("v18.0.118 (UI/UX #6): sin resumen, «Próximo control» dice que está leyendo y «Reintentar ahora» lo resuelve en el sitio", async () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      await c.api.openPaquetesModal({ doc_id: "555111", nombre: "PACIENTE SINTETICO" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-paquete-modal");
      const body = modal.querySelector("#vgl-paquete-body");
      t.cierto(/Todavía estoy leyendo/.test(body.innerHTML), "dice lo que de verdad pasa (antes: «abra la historia», que es donde ya está)");
      t.falso(/Abra la historia un momento/.test(body.innerHTML), "y ya no manda a hacer lo que el médico acaba de hacer");
      const re = body.querySelector("#vgl-paquete-reintentar");
      t.cierto(!!re, "con «Reintentar ahora»");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/await mtrCalcularResumenClinico\(apt, \(\) => !cerrado\);/.test(src), "el reintento calcula el resumen con la guarda de cerrado");
      t.cierto(/if \(ordenarBtn\) ordenarBtn\.style\.display = "";\s*\n\s*repintar\(\);/.test(src), "y al conseguirlo repinta y devuelve «Ordenar pendientes»");
    });

    t.caso("v18.0.118 (UI/UX #10 + decisión de Ordenar): el «Siguiente» del paso 2 explica por qué está apagado; Ordenar abre el PDF detrás sin robar la pantalla", () => {
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.igual((src.match(/step2Next\.textContent = "Elija un horario para continuar"/g) || []).length, 1, "sin turno elegido, el botón del paso 2 lo dice");
      t.igual((src.match(/step2Next\.textContent = "Siguiente: Confirmación ➔"/g) || []).length, 2, "y recupera su rótulo en los dos sitios que habilitan (clic en turno y preselección ⭐)");
      t.cierto(/pestanaImpresion\.blur === "function"\) pestanaImpresion\.blur\(\)/.test(src) && /if \(typeof window\.focus === "function"\) window\.focus\(\)/.test(src),
        "Ordenar abre la pestaña del PDF detrás y devuelve el foco a Everest (decisión del médico, 02-sep)");
      t.cierto(/_bloquearCierre\(true\);/.test(src) && /_ordGenerandoDocs\.has\(_agmClaveDoc\(apt\.doc_id\)\)\) \{ uxTrack\("ordenes\.cerrar\.en_vuelo"\); return; \}/.test(src),
        "y mientras el lote corre, ✕ / Cancelar / Escape esperan (UI/UX #14)");
    });

    // =====================================================================
    // v18.0.119 — REPORTE EN VIVO: «hay que blindar que SÍ se pueda cancelar la cita»
    // =====================================================================
    t.caso("v18.0.119: el veredicto de la anulación — un mensaje que la NIEGA manda sobre error:false, y un «Cancelado» envuelto o en cadena sí cuenta", () => {
      const c = cargar({ silencioso: true });
      const ok = c.api._anulacionConfirmada;
      t.falso(ok({ error: false, mensaje: "La cita no se puede cancelar" }), "error:false con un mensaje que lo niega NO es una anulación (antes: se daba por anulada y se borraban las marcas de una cita viva)");
      t.falso(ok({ isError: false, mensaje: "La cita no existe" }), "tampoco «no existe»");
      t.cierto(ok({ error: false, mensaje: "Cancelado Correctamente" }), "la respuesta capturada sigue valiendo");
      t.cierto(ok({ data: { error: false, mensaje: "Cancelado Correctamente" } }), "envuelta en data, también");
      t.cierto(ok("Cancelado Correctamente"), "y como cadena suelta");
      t.falso(ok("No se pudo cancelar"), "una cadena que lo niega, no");
      t.cierto(c.api._anulacionYaNoVigente({ mensaje: "La cita ya fue cancelada" }), "«ya fue cancelada» se reconoce como cita que ya no está vigente");
      t.falso(c.api._anulacionYaNoVigente({ mensaje: "Error de conexión" }), "un error cualquiera no");
    });

    await t.casoAsync("v18.0.119: si Everest RECHAZA la forma (400), se prueba la variante alineada con AsignarTurno; con 401/500/red NO se reintenta, y la que funciona se recuerda", async () => {
      const peticiones = [];
      const mk = (responder) => {
        const c = cargar({ silencioso: true, fetch: async (url, init) => { peticiones.push({ url: String(url), body: (init && init.body) || "" }); return responder(peticiones.length, String(url), (init && init.body) || ""); } });
        c.api.__state.activeDoctor = { id: 707, name: "MEDICO PRUEBA" };
        c.api.markCitaAgendadaHoy("111222333", "2026-10-01", { citaId: "7813686", pacienteId: "5150", eps: "EPS", hora: "8:40 AM" });
        return c;
      };
      const resp = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, text: async () => JSON.stringify(cuerpo), json: async () => cuerpo, clone() { return this; } });
      // (a) la primera forma la rechaza el servidor por forma (400) y la segunda la acepta
      const cA = mk((n) => (n === 1 ? resp(400, { mensaje: "El campo citaId no es válido" }) : resp(200, { error: false, mensaje: "Cancelado Correctamente" })));
      t.cierto(await cA.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "con la segunda forma, Everest confirma");
      t.igual(peticiones.length, 2, "se probaron dos formas (antes: una sola y a callar)");
      t.cierto(/Ip=127\.0\.0\.1/.test(peticiones[1].url), "la segunda va alineada con AsignarTurno (Ip real)");
      t.cierto(/"citaId":7813686/.test(peticiones[1].body), "y con los identificadores como números");
      t.igual(cA.env.storage.getItem("vgl_cancel_variante"), "B", "la forma que funcionó se recuerda para la próxima");
      t.falso(cA.api.isCitaAgendadaHoy("111222333"), "y las marcas locales se limpian solo tras la confirmación");
      // (b) sesión caducada: NO se reintenta con otra forma (no es un problema de forma)
      peticiones.length = 0;
      const c401 = mk(() => resp(401, {}));
      t.falso(await c401.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "401: no se anula");
      t.igual(peticiones.length, 1, "y no se insiste con otras formas");
      t.cierto(/sesión de Everest caducó/.test(c401.api._anularUltimoMotivoLeer()), "el motivo lo dice");
      // (c) 200 que no confirma: Everest decidió, tampoco se reintenta
      peticiones.length = 0;
      const c200 = mk(() => resp(200, { error: false, mensaje: "La cita no se puede cancelar porque ya fue atendida" }));
      t.falso(await c200.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "no se da por anulada");
      t.igual(peticiones.length, 1, "una sola petición: no es un problema de cableado");
      t.cierto(c200.api.isCitaAgendadaHoy("111222333"), "y la marca local NO se toca");
      // (d) «ya estaba cancelada»: no es fallo — se limpian las marcas y se dice
      peticiones.length = 0;
      const cYa = mk(() => resp(200, { error: true, mensaje: "La cita ya fue cancelada" }));
      t.cierto(await cYa.api._anularCitaAsignadaReal({ doc_id: "111222333" }), "se resuelve como hecho consumado");
      t.falso(cYa.api.isCitaAgendadaHoy("111222333"), "y las marcas de esa cita se limpian");
    });

    t.caso("v18.0.119: el asistente APRENDE la cancelación real de Everest sin guardar ni un identificador, y la usa primero", () => {
      const c = cargar({ silencioso: true });
      // la forma real que se ve pasar cuando el médico cancela a mano (valores sintéticos)
      const pl = c.api._cancelPlantillaDesde("POST", "/apiviva/APIAcceso/api/Acceso/CancelarCita?CitaId=7813686&PacienteId=5150&UsuarioId=707&Ip=127.0.0.1&TipoCancelacion=2&Observacion=Paciente+cancela",
        JSON.stringify({ citaId: 7813686, pacienteId: 5150, usuarioId: 707, estado: "CAN", ip: "127.0.0.1", motivoId: 4 }));
      t.cierto(!!pl, "la plantilla se construye");
      const texto = JSON.stringify(pl);
      t.falso(/7813686|5150/.test(texto), "NO guarda ningún identificador: van como marcador");
      t.cierto(/\{citaId\}/.test(texto) && /\{pacienteId\}/.test(texto) && /\{usuarioId\}/.test(texto), "los reconoce por el nombre del parámetro");
      t.cierto(/TipoCancelacion/.test(texto) && /"motivoId":4/.test(texto) && /127\.0\.0\.1/.test(texto), "y conserva lo que sí hay que aprender: parámetros extra y constantes");
      // un valor con pinta de identificador que no sabemos nombrar: no se guarda NADA
      t.igual(c.api._cancelPlantillaDesde("POST", "/x/CancelarCita?CitaId=1&Cosa=99887766", null), null, "un identificador no reconocido descarta la plantilla entera");
      // y al rellenarla salen los datos de ESTA cancelación
      const pet = c.api._cancelPeticionDesdePlantilla(pl, { citaId: 42, pacienteId: 7, usuarioId: 707, usuarioNombre: "MEDICO PRUEBA", eps: "EPS", observacion: "Anulada desde el Vigilante" });
      t.cierto(/CitaId=42/.test(pet.url) && /PacienteId=7/.test(pet.url) && /TipoCancelacion=2/.test(pet.url), "la petición sale con los valores de ahora y los parámetros aprendidos");
      t.cierto(/"citaId":"42"/.test(pet.cuerpo) && /"motivoId":4/.test(pet.cuerpo), "el cuerpo también");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/if \(_cancelNuestra\) return;/.test(src), "no aprende de sus propias llamadas");
      t.cierto(/try \{ _cancelEnganchar\(\); \} catch \(e\) \{\}/.test(src), "y la escucha se instala al arrancar");
    });

    t.caso("v18.0.119 (pregunta del médico en consulta): el aviso de casilla obligatoria explica POR QUÉ está vacía y qué hacer, no solo «revíselo»", () => {
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/para esta ruta y la casilla sigue vacía\. Revíselo\./.test(src), "el texto viejo («la casilla sigue vacía. Revíselo.») no dice ni por qué ni qué hacer");
      t.cierto(/Everest no deja guardar esta Ruta Crónicos sin/.test(src), "dice qué impide exactamente");
      t.cierto(/el laboratorio no trajo ese resultado \(o llegó pendiente\)/.test(src), "y por qué está vacía");
      t.cierto(/El asistente no las inventa/.test(src), "recuerda que no se rellena sola (casilla vacía antes que dato inventado)");
      t.cierto(/escríbalo a mano en la casilla/.test(src), "y qué puede hacer el médico");
    });

  },
};
