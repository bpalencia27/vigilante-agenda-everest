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
    "createLabInjectorUI", "setWinState", "buildOverlay",
    "openLaboratoriosModal", "openAgendamientoModal", "openOrdenamientoModal",
    "savePos", "restorePos", "closeSheet", "toggleSheet", "sheetHeader",
    "wireClose", "renderResumen", "copySummary", "renderSettings",
    "paintMute", "repaint", "makeDraggable", "setSummary", "render",
    "refrescarCuentas",
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
      t.cierto(hoja.innerHTML.includes('style="display:none;"'), "sin opcionesTecnicas la sección técnica va oculta");
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
      t.falso(hoja.innerHTML.includes('style="display:none;"'), "la sección técnica ya no va oculta");
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

    t.caso("render: dos citas por API pintan tarjetas con bandera de fraude y chips PyM", () => {
      vaciarLista();
      cv.api.render(citas, "api", new Date());
      t.cierto(suma.textContent.includes("Vigilando (directo) · 2 cita(s)"), "resumen de fuente directa");
      t.igual(q("#vgl-dot").className, "bg", "el punto de origen marca API");
      t.igual(lista.children.length, 2, "una tarjeta por cita");
      const [cardAna, cardLuis] = lista.children;
      t.igual(cardAna.__vglKey, "111@07:00 AM");
      t.cierto(cardAna.innerHTML.includes("ANA PEREZ"));
      t.cierto(cardAna.innerHTML.includes("CC 111"));
      t.cierto(cardAna.innerHTML.includes("PyM sin cargar"), "sin base cargada no se miente con 'Al día'");
      t.falso(cardAna.innerHTML.includes("NO CONFIRMADO"), "la cita verde no lleva bandera de fraude");
      t.cierto(cardLuis.className.includes("rojo"), "la tarjeta roja lleva su clase");
      t.cierto(cardLuis.innerHTML.includes("⛔ NO CONFIRMADO"), "bandera de fraude explícita");
      t.cierto(cardLuis.innerHTML.includes("Tamización de mama"), "chip de PyM pendiente");
      t.cierto(cardLuis.innerHTML.includes("vgl-cd late"), "cuenta regresiva vencida");
      t.cierto(cardLuis.innerHTML.includes("hace 4:00"), "lleva 4 min pasado de la tolerancia (6 - 10)");
      const stats = q("#vgl-stats");
      t.cierto(stats.innerHTML.includes("En sala <b>1</b>"));
      t.cierto(stats.innerHTML.includes("Sin pres. <b>1</b>"));
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

    // ================= openLaboratoriosModal =================
    await t.casoAsync("openLaboratoriosModal: una cita sin documento solo deja un aviso warn", async () => {
      await cv.api.openLaboratoriosModal({ nombre: "SIN DOCUMENTO" });
      t.igual(suma.className, "warn");
      t.cierto(suma.textContent.includes("no tiene documento legible"));
      t.falso(cv.env.doc.body.children.some((n) => n.id === "vgl-labs-modal"), "no se abre ningún modal");
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
      t.igual(modal.querySelector("#vgl-agm-prog-box").style.display, "block");
      // El celular del SMS se muestra saneado para que el médico lo verifique
      t.igual(modal.querySelector("#vgl-agm-sms-tel").value, "3001112233");
      t.cierto(modal.querySelector("#vgl-agm-sms-nota").textContent.includes("verifíquelo antes de confirmar"));
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
  },
};
