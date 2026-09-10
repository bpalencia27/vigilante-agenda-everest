// =====================================================================
//  SUITE 97 — v18.7.0 (M1): ACCESO DIRECTO A HC DESDE LA TARJETA
//  Pedido del médico: «acceso directo a historias clínicas en el panel
//  del centinela». El botón .vgl-hc-directo se pinta SOLO en tarjetas
//  «En sala» (momento operativo) y replica el clic del botón NATIVO
//  "Historias Clínicas" de la fila en Citas del día (decisión v14.0.2:
//  nada de botón "Atender" propio). Emparejamiento FAIL-CLOSED: cédula
//  canónica primero, hora+estado de respaldo, cero/varios candidatos →
//  sin clic y aviso ámbar; jamás se clica la fila equivocada.
// =====================================================================
const fs = require("fs");
const path = require("path");
const { instalarDomEnriquecido } = require("./harness");

const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  nombre: "M1: acceso directo a HC desde la tarjeta del panel (v18.7.0)",
  cubre: ["_vglHcDirectoAbrir", "_vglHcDirectoFila", "_vglHcDirectoBoton", "hcRenderChip", "render"],

  async pruebas(t, api, env, cargar) {
    // Monte igual que suite_91: DOM enriquecido + selectores a nivel document
    // con el matcher simple (clase/id/tag), como los usa el navegador real.
    function montar() {
      const c = cargar({ silencioso: true });
      instalarDomEnriquecido(c.env.doc);
      // El harness no trae createDocumentFragment y render() lo necesita para
      // montar las tarjetas (mismo parche de suite_15).
      c.env.doc.createDocumentFragment = () => {
        const f = c.env.doc.createElement("div");
        f._esFragmento = true;
        return f;
      };
      c.ctx.innerWidth = 1200; c.ctx.innerHeight = 800;
      const doc = c.env.doc;
      const matchea = (n, sel) => {
        if (!n || !n._parent || !n.tagName) return false;
        if (sel[0] === ".") return !!(n.classList && n.classList.contains(sel.slice(1)));
        if (sel[0] === "#") return n.id === sel.slice(1);
        return n.tagName === sel.toUpperCase();
      };
      doc.querySelector = (sel) => doc._nodos.find((n) => matchea(n, sel)) || null;
      doc.querySelectorAll = (sel) => doc._nodos.filter((n) => matchea(n, sel));
      return c;
    }
    // Bandeja de toasts real (patrón suite_15): el showToast de producción
    // encola y pinta en "vgl-toasts" — aquí se le da la bandeja falsa.
    function bandejaToasts(c) {
      const bandeja = c.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n._parent = bandeja; };
      const getOrig = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : getOrig(id));
      return bandeja;
    }
    const textoToasts = (bandeja) => bandeja.children.map((n) => String(n.innerHTML || "") + " · " + (n.__vglColor || ""));
    // Telemetría por el mecanismo oficial (patrón suite_23): volcar el buffer
    // y leer la ventana persistida.
    const ventanaUx = (c) => {
      try { c.api._uxVolcarBuffer(); return JSON.parse(c.env.storage.getItem("vgl_ux") || "null"); } catch (e) { return null; }
    };
    const accionUx = (c, accion) => {
      // uxTrack guarda la clave saneada por uxClaveLimpia (minúsculas y sin nada
      // fuera de [a-z0-9.:_-]): hay que leerla en esa forma, no la original.
      const w = ventanaUx(c);
      const k = String(accion).toLowerCase().replace(/[^a-z0-9.:_-]/g, "");
      return (w && w.acciones && w.acciones[k]) || 0;
    };
    // Fila nativa de Citas del día (forma real de Everest: .card > .card-body
    // con hora, estado, botón nativo y cédula — bundle HCHealth, extracción
    // 07-sep-2026).
    function filaNativa(doc, hora, estado, boton) {
      return '<div class="card"><div class="card-body">'
        + '<span class="labelHora">' + hora + '</span>'
        + '<span class="status-label">' + estado + '</span>'
        + (boton === undefined
            ? '<button type="button" class="btn btn-primary-medic"> Historias Clínicas </button>'
            : boton)
        + (doc === undefined ? "" : '<div class="text-muted">C.C. ' + doc + '</div>')
        + "</div></div>";
    }
    function montarEverest(c, filas) {
      const cont = c.env.doc.createElement("div");
      c.env.doc.body.appendChild(cont);
      cont.innerHTML = filas;
      return cont;
    }
    // Pinta el panel con el overlay real y devuelve las tarjetas vivas.
    function pintarPanel(c, citas) {
      c.api.buildOverlay();
      c.api.__state.lastSignature = "";
      c.api.render(citas, "api", new Date());
      const raiz = c.env.doc.body.children.find((n) => n.id === "vgl-root");
      const el0 = raiz.querySelector("#vgl-list");
      const lst = (el0.children.length === 1 && el0.children[0]._esFragmento) ? el0.children[0] : el0;
      return lst.children;
    }
    const CITA_SALA = { key: "a1", doc_id: "1018888777", nombre: "PACIENTE PRUEBA", hora_texto: "09:00 a. m.", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 };
    const nativosHc = (c) => c.env.doc.querySelectorAll("button").filter((b) => c.api._vglEsBotonHC(b));

    // ---------- pintado del botón ----------
    t.caso("la tarjeta «En sala» pinta el acceso directo con cédula y hora canónica; las demás no", () => {
      const c = montar();
      const citas = [
        CITA_SALA,
        { key: "a2", doc_id: "98765432109", nombre: "OTRO PACIENTE", hora_texto: "09:30 a. m.", estado: "Atendido", color: "VERDE", pym: [], elapsed: 0 },
        { key: "a3", doc_id: "", nombre: "SIN DOC", hora_texto: "10:00 a. m.", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 },
        { key: "a4", doc_id: "", nombre: "SIN FORMA", hora_texto: "pronto", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 },
      ];
      const tarjetas = pintarPanel(c, citas);
      const b1 = tarjetas[0].querySelector(".vgl-hc-directo");
      t.cierto(!!b1, "En sala con cédula: botón presente");
      t.igual(b1 && b1.getAttribute("data-vgl-doc"), "1018888777", "la cédula viaja canónica");
      t.igual(b1 && b1.getAttribute("data-vgl-hora"), "m540", "la hora viaja canónica (m540 = 09:00)");
      t.igual(b1 && b1.getAttribute("data-vgl-estado"), "En sala", "el estado viaja para el respaldo");
      t.cierto((b1 && b1.getAttribute("title") || "").indexOf("botón nativo") !== -1, "el título explica que replica el clic nativo");
      t.igual(tarjetas[1].querySelector(".vgl-hc-directo"), null, "«Atendido» no ofrece el atajo");
      t.cierto(!!tarjetas[2].querySelector(".vgl-hc-directo"), "En sala sin cédula pero con hora: botón presente (respaldo por hora)");
      t.igual(tarjetas[2].querySelector(".vgl-hc-directo").getAttribute("data-vgl-doc"), "", "y la cédula va vacía, honesta");
      t.igual(tarjetas[3].querySelector(".vgl-hc-directo"), null, "sin cédula NI hora legible no hay con qué emparejar: no se ofrece");
    });

    // ---------- flujo completo por el listener instalado ----------
    await t.casoAsync("clic → fila única por cédula → clic del botón nativo (el flujo entero, vía listener de captura)", async () => {
      const c = montar();
      const lis = [];
      c.env.doc.addEventListener = (tipo, fn) => { if (tipo === "click") lis.push(fn); };
      const bandeja = bandejaToasts(c);
      const tarjetas = pintarPanel(c, [CITA_SALA]);
      montarEverest(c, filaNativa("1.018.888.777", "09:00 a. m.", "En Sala"));
      c.api.hcRenderChip();
      c.api.hcRenderChip();
      const handler = lis.find((f) => f === c.api._vglHcDirectoAbrir);
      t.cierto(!!handler, "hcRenderChip instaló el listener de captura del atajo");
      t.igual(lis.filter((f) => f === c.api._vglHcDirectoAbrir).length, 1, "y UNA sola vez (dedupe por _vglHcDirectoListenerOk)");
      const nativos = nativosHc(c);
      t.igual(nativos.length, 1, "montaje: un solo botón nativo HC en el fixture");
      let clics = 0;
      nativos[0].click = () => { clics++; };
      handler({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(clics, 1, "el botón NATIVO recibió el clic sintético");
      t.igual(accionUx(c, "hc.accesoDirecto.clic"), 1, "telemetría: clic en el atajo");
      t.igual(accionUx(c, "hc.accesoDirecto.abierto"), 1, "telemetría: apertura lograda");
      t.igual(accionUx(c, "hc.accesoDirecto.sinFila"), 0, "sin fallos intermedios");
      await esperar(600);   // el flush de avisos corre a los 500 ms
      t.igual(bandeja.children.length, 0, "ningún aviso ámbar: el camino feliz es silencioso");
    });

    // ---------- fail-closed ----------
    await t.casoAsync("fail-closed: si hay OTRA fila con la misma cédula, no se clica nada (ambigüedad)", async () => {
      const c = montar();
      const bandeja = bandejaToasts(c);
      const tarjetas = pintarPanel(c, [CITA_SALA]);
      montarEverest(c, filaNativa("1.018.888.777", "09:00 a. m.", "En Sala") + filaNativa("1.018.888.777", "09:30 a. m.", "En Sala"));
      const nativos = nativosHc(c);
      let clics = 0;
      nativos.forEach((b) => { b.click = () => { clics++; }; });
      c.api._vglHcDirectoAbrir({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(clics, 0, "cero clics: dos filas con la misma cédula → no se adivina");
      t.igual(accionUx(c, "hc.accesoDirecto.sinFila"), 1, "telemetría del fallo");
      t.igual(accionUx(c, "hc.accesoDirecto.abierto"), 0, "y jamás se registra apertura");
      await esperar(600);
      const toasts = textoToasts(bandeja);
      t.igual(bandeja.children.length, 1, "un aviso ámbar dice qué hacer");
      t.cierto(bandeja.children[0] && bandeja.children[0].__vglColor === "AMBAR", "en ámbar");
      t.cierto(toasts[0].indexOf("botón nativo") !== -1, "el aviso remite al botón nativo");
    });

    await t.casoAsync("fail-closed: sin fila nativa (agenda refrescada) no se clica nada", async () => {
      const c = montar();
      const bandeja = bandejaToasts(c);
      const tarjetas = pintarPanel(c, [CITA_SALA]);
      // Hay agenda (para que seccionActiva() sea "agenda"), pero ningún paciente
      // de la vista coincide con la tarjeta: ni cédula ni hora+estado.
      montarEverest(c, filaNativa("98.765.432.109", "10:30 a. m.", "En Sala"));
      c.api._vglHcDirectoAbrir({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(accionUx(c, "hc.accesoDirecto.sinFila"), 1, "la fila no está: fallo claro");
      await esperar(600);
      t.igual(bandeja.children.length, 1, "aviso ámbar");
    });

    await t.casoAsync("fail-closed: fuera de Citas del día (sección otra) no se clica y el aviso explica", async () => {
      const c = montar();
      const bandeja = bandejaToasts(c);
      const tarjetas = pintarPanel(c, [CITA_SALA]);
      // Sin .labelHora/.status-label en el DOM → seccionActiva() = "otra".
      c.api._vglHcDirectoAbrir({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(accionUx(c, "hc.accesoDirecto.fueraAgenda"), 1, "telemetría del caso fuera de agenda");
      await esperar(600);
      t.igual(bandeja.children.length, 1, "aviso ámbar");
      t.cierto(textoToasts(bandeja)[0].indexOf("Citas del día") !== -1, "el aviso dice volver a la vista correcta");
    });

    await t.casoAsync("fail-closed: fila correcta pero sin botón nativo HC («Consentimientos» no engaña)", async () => {
      const c = montar();
      const bandeja = bandejaToasts(c);
      const tarjetas = pintarPanel(c, [CITA_SALA]);
      montarEverest(c, filaNativa("1.018.888.777", "09:00 a. m.", "En Sala",
        '<button type="button" class="btn btn-primary-medic"> Consentimientos </button>'));
      c.api._vglHcDirectoAbrir({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(accionUx(c, "hc.accesoDirecto.sinBoton"), 1, "el hermano «Consentimientos» jamás se clica");
      await esperar(600);
      t.igual(bandeja.children.length, 1, "aviso ámbar");
    });

    t.caso("no cruza filas: con dos pacientes a la misma hora, solo se clica el de la cédula exacta", () => {
      const c = montar();
      const tarjetas = pintarPanel(c, [CITA_SALA]);
      montarEverest(c,
        filaNativa("98.765.432.109", "09:00 a. m.", "En Sala") +
        filaNativa("1.018.888.777", "09:00 a. m.", "En Sala"));
      const nativos = nativosHc(c);
      const clics = [0, 0];
      nativos.forEach((b, i) => { b.click = () => { clics[i]++; }; });
      c.api._vglHcDirectoAbrir({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(clics[0], 0, "la fila del OTRO paciente (misma hora) queda intacta");
      t.igual(clics[1], 1, "la fila de la cédula exacta recibe el clic");
      t.igual(accionUx(c, "hc.accesoDirecto.abierto"), 1, "telemetría de apertura");
      // Contrato directo de las piezas (la cédula viaja ya normalizada, la hora
      // como m<min>): la fila correcta y el botón nativo que la abre.
      const fila = c.api._vglHcDirectoFila("1018888777", "m540", "En sala");
      t.cierto(!!fila, "la búsqueda por cédula canónica devuelve UNA fila");
      t.igual(fila.querySelector(".text-muted") && fila.querySelector(".text-muted").innerHTML.indexOf("1.018.888.777") !== -1, true, "y es la fila del paciente pedido");
      const boton = c.api._vglHcDirectoBoton(fila);
      t.cierto(!!boton && c.api._vglEsBotonHC(boton), "de esa fila sale el botón nativo «Historias Clínicas»");
      t.igual(c.api._vglHcDirectoFila("1018888777", "m540", "En sala") === null, false, "sin ambigüedad, la búsqueda no falla en cerrado");
    });

    t.caso("respaldo por hora+estado: sin cédula en la tarjeta empareja la fila de la misma hora y estado", () => {
      const c = montar();
      const citas = [{ key: "b1", doc_id: "", nombre: "SIN DOC", hora_texto: "09:00 a. m.", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 }];
      const tarjetas = pintarPanel(c, citas);
      montarEverest(c, filaNativa("1.018.888.777", "09:00 a. m.", "En Sala"));
      const nativos = nativosHc(c);
      let clics = 0;
      nativos[0].click = () => { clics++; };
      c.api._vglHcDirectoAbrir({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(clics, 1, "hora canónica (m540) + estado coinciden: clic al nativo");
      t.igual(accionUx(c, "hc.accesoDirecto.abierto"), 1, "telemetría de apertura");
    });

    t.caso("respaldo por hora+estado: dos filas a la misma hora y estado → fail-closed", () => {
      const c = montar();
      const citas = [{ key: "b2", doc_id: "", nombre: "SIN DOC", hora_texto: "09:00 a. m.", estado: "En sala", color: "VERDE", pym: [], elapsed: 0 }];
      const tarjetas = pintarPanel(c, citas);
      montarEverest(c,
        filaNativa("1.018.888.777", "09:00 a. m.", "En Sala") +
        filaNativa("98.765.432.109", "09:00 a. m.", "En Sala"));
      const nativos = nativosHc(c);
      let clics = 0;
      nativos.forEach((b) => { b.click = () => { clics++; }; });
      c.api._vglHcDirectoAbrir({ target: tarjetas[0].querySelector(".vgl-hc-directo") });
      t.igual(clics, 0, "ambigüedad en el respaldo: fallar cerrado");
      t.igual(accionUx(c, "hc.accesoDirecto.sinFila"), 1, "telemetría del fallo");
    });

    // ---------- compromisos estructurales ----------
    t.caso("estructura: el bloque M1 no toca la red y el listener cuelga del MISMO tick que el de captura", () => {
      const i = FUENTE.indexOf("ACCESO DIRECTO A HC DESDE LA TARJETA DEL PANEL");
      t.cierto(i > 0, "el bloque M1 existe en el fuente");
      const bloque = FUENTE.slice(i, FUENTE.indexOf("v18.6.2 (F-P2, P1) — línea \"última HC\"", i));
      t.cierto(bloque.indexOf("GM_xmlhttpRequest") === -1, "sin GM_xmlhttpRequest");
      t.cierto(bloque.indexOf("pageFetchJson(") === -1 && bloque.indexOf("_pageFetchJsonCore(") === -1, "sin red directa: el gesto real lo hace el botón nativo");
      t.cierto(bloque.indexOf("boton.click()") !== -1, "el gesto final es el clic del botón nativo");
      t.cierto(bloque.indexOf("_vglEsBotonHC(b)") !== -1, "reutiliza el detector verificado del módulo VGL-HC");
      const j = FUENTE.indexOf("if (!_vglHcListenerOk");
      const k = FUENTE.indexOf("_vglHcDirectoListenerOk");
      t.cierto(j > 0 && k > j && k < j + 400, "el listener del atajo se instala junto al de captura, en hcRenderChip");
    });

    t.caso("estructura: la tarjeta pinta el botón con clase y sin estilos inline (test T1 en pie)", () => {
      const c = montar();
      const tarjetas = pintarPanel(c, [CITA_SALA]);
      const html = tarjetas[0].innerHTML;
      t.cierto(html.indexOf("vgl-hc-directo") !== -1, "la clase está en el HTML pintado");
      const botonHtml = html.slice(html.indexOf("<button class=\"vgl-hc-directo\""));
      t.falso(/<button class="vgl-hc-directo"[^>]*style=/.test(botonHtml), "sin style inline en el botón: todo el color vive en la hoja");
    });
  },
};
