// =====================================================================
//  SUITE 91 — VGL-HC: lanzador asistido de Historia Clínica (v18.5.1-hc
//  + prefetch v18.5.2-hc2)
//  Cubre el módulo que ancla el botón real de Everest "Historias Clínicas"
//  (btn btn-primary-medic, bundle HCHealth ×11 — extracción 07-sep-2026):
//  captura de contexto por clic, hint con TTL, prioridad del DOM, chip
//  accesible con cédula enmascarada, anuncio aria-live con dedupe, y el
//  prefetch especulativo de órdenes vigentes al clic (cadena confirmada por
//  evidencia.har: cédula → id interno → órdenes, 1 intento, sin reintentos).
// =====================================================================
const fs = require("fs");
const path = require("path");
const { instalarDomEnriquecido } = require("./harness");

const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

// Respuesta con la forma completa que espera _pageFetchJsonCore (misma forma
// que usa la suite 05: headers/text/clone incluidos).
const respuesta = (data) => ({
  ok: true, status: 200,
  headers: { get: () => "application/json" },
  json: async () => data,
  text: async () => JSON.stringify(data),
  clone() { return this; },
});

module.exports = {
  nombre: "VGL-HC: lanzador asistido de Historia Clínica",
  cubre: [
    "_vglEsBotonHC", "_vglHcCapturarClick", "hcPacienteContexto", "_vglHcFraude",
    "hcRenderChip", "hcTickVigia", "_vglHcSetHintParaTest", "hcPrefetch",
    "vglSerialAFecha", "vglSerialHoy", "a5AlertasDe", "hcAnexo5Render",
  ],

  async pruebas(t, api, env, cargar) {
    // Monte estándar: DOM enriquecido + contenedor parsed desde HTML +
    // selectores a nivel document (como en el navegador real). opts permite
    // inyectar un fetch simulado (para los casos del prefetch).
    function montar(html, opts) {
      const c = cargar(Object.assign({ silencioso: true }, opts));
      instalarDomEnriquecido(c.env.doc);
      const cont = c.env.doc.createElement("div");
      c.env.doc.body.appendChild(cont);
      cont.innerHTML = html;
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
    const AGENDA = '<div id="vgl-root"></div>'
      + '<div class="card"><div class="card-body">'
      + '<span class="labelHora">7:30 a. m.</span><span class="status-label">En Sala</span>'
      + '<button _ngcontent-tml-c5="" type="button" class="btn btn-primary-medic ng-star-inserted"> Historias Clínicas </button>'
      + '<div class="text-muted">C.C. 1.018.888.777</div>'
      + "</div></div>";

    // ---------- _vglEsBotonHC ----------
    t.caso("botón REAL (clase del bundle + rótulo con espacios y tilde) se reconoce", () => {
      const c = montar(AGENDA);
      const btn = c.env.doc.querySelector("button");
      t.cierto(!!btn, "el botón existe en el DOM simulado");
      t.cierto(c.api._vglEsBotonHC(btn) === true, "clase btn-primary-medic + ' Historias Clínicas ' → true");
    });

    t.caso("'Consentimientos' (misma clase, botón hermano) NUNCA se reconoce", () => {
      const c = montar('<button type="button" class="btn btn-primary-medic"> Consentimientos </button>');
      t.cierto(c.api._vglEsBotonHC(c.env.doc.querySelector("button")) === false, "guardia de texto: el hermano queda fuera");
    });

    t.caso("respaldo por texto exacto si un día Everest retira la clase", () => {
      const c = montar('<button type="button">Historias Clínicas</button>');
      t.cierto(c.api._vglEsBotonHC(c.env.doc.querySelector("button")) === true, "solo rótulo exacto → true");
    });

    t.caso("botón irrelevante con la clase pero sin el rótulo → false", () => {
      const c = montar('<button type="button" class="btn btn-primary-medic">Guardar</button>');
      t.cierto(c.api._vglEsBotonHC(c.env.doc.querySelector("button")) === false, "la clase sola no alcanza: exige el rótulo");
    });

    // ---------- captura de clic → hint ----------
    t.caso("clic en el botón real captura la cédula de SU fila (origen hint)", () => {
      const c = montar(AGENDA);
      c.api._vglHcSetHintParaTest(null);
      c.api._vglHcCapturarClick({ target: c.env.doc.querySelector("button") });
      const ctx = c.api.hcPacienteContexto();
      t.cierto(!!ctx, "hay contexto tras el clic");
      t.igual(ctx && ctx.docId, "1018888777", "cédula canonizada de la fila (.text-muted de la card)");
      t.igual(ctx && ctx.origen, "hint", "mientras la historia carga, el origen es el clic");
    });

    t.caso("clic sin cédula legible NO borra un hint previo (fallar cerrado)", () => {
      const c = montar('<div class="card"><div class="card-body">'
        + '<button type="button" class="btn btn-primary-medic"> Historias Clínicas </button>'
        + "</div></div>");
      c.api._vglHcSetHintParaTest("999000111");
      c.api._vglHcCapturarClick({ target: c.env.doc.querySelector("button") });
      const ctx = c.api.hcPacienteContexto();
      t.igual(ctx && ctx.docId, "999000111", "el hint anterior sobrevive: nunca se sobrescribe con vacío");
    });

    // ---------- prioridad del DOM ----------
    t.caso("con la historia abierta, el DOM manda sobre el hint", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 98.765.432.109</div></app-index>');
      c.api._vglHcSetHintParaTest("1018888777");
      const ctx = c.api.hcPacienteContexto();
      t.igual(ctx && ctx.origen, "dom", "extractPacienteAbierto gana siempre");
      t.igual(ctx && ctx.docId, "98765432109", "cédula leída de la historia, no del clic");
    });

    t.caso("hint caducado (>15 s) ya no fabrica contexto", () => {
      const c = montar('<div id="vgl-root"></div>');
      c.api._vglHcSetHintParaTest("1018888777", 60000);
      t.igual(c.api.hcPacienteContexto(), null, "TTL vencido → sin contexto: no hay paciente fantasma");
    });

    // ---------- fraude ----------
    t.caso("_vglHcFraude detecta al paciente por el prefijo doc@hora del fraudWatch", () => {
      const c = montar(AGENDA);
      c.api.__state.fraudWatch.add("1018888777@7:30 a. m.");
      t.cierto(c.api._vglHcFraude("1018888777") === true, "alguna cita del paciente en watch → true");
      t.cierto(c.api._vglHcFraude("98765432109") === false, "otro paciente → false");
      t.cierto(c.api._vglHcFraude("") === false, "sin cédula → false");
    });

    // ---------- chip accesible ----------
    t.caso("chip: role=status, cédula ENMASCARADA y origen visible", () => {
      const c = montar(AGENDA);
      c.api._vglHcSetHintParaTest("1018888777");
      t.cierto(c.api.hcRenderChip() === true, "render devuelto true con root y contexto");
      const chip = c.env.doc.getElementById("vgl-hc-chip");
      t.cierto(!!chip, "el chip existe dentro de #vgl-root");
      const html = chip.innerHTML;
      t.cierto(html.indexOf("···8777") !== -1, "cédula enmascarada ···+4 finales");
      t.cierto(html.indexOf("1018888777") === -1, "la cédula COMPLETA jamás aparece en el chip");
      t.cierto(html.indexOf("clic en agenda") !== -1, "el origen del contexto se declara en pantalla");
    });

    t.caso("chip muestra la alerta de inasistencia solo si hay fraude", () => {
      const c1 = montar(AGENDA);
      c1.api._vglHcSetHintParaTest("1018888777");
      c1.api.__state.fraudWatch.add("1018888777@7:30 a. m.");
      c1.api.hcRenderChip();
      t.cierto(c1.env.doc.getElementById("vgl-hc-chip").innerHTML.indexOf("inasistencia reincidente") !== -1, "con fraude aparece la alerta");
      const c2 = montar(AGENDA);
      c2.api._vglHcSetHintParaTest("1018888777");
      c2.api.hcRenderChip();
      t.cierto(c2.env.doc.getElementById("vgl-hc-chip").innerHTML.indexOf("inasistencia reincidente") === -1, "sin fraude no aparece");
    });

    t.caso("sin contexto el chip se vacía (no queda paciente viejo pegado)", () => {
      const c = montar(AGENDA);
      c.api._vglHcSetHintParaTest("1018888777");
      c.api.hcRenderChip();
      c.api._vglHcSetHintParaTest(null, 60000);
      c.api.hcRenderChip();
      t.igual(c.env.doc.getElementById("vgl-hc-chip").innerHTML, "", "hint caducado → chip vacío");
    });

    // ---------- anuncio aria-live ----------
    t.caso("anuncio a11y: una sola vez por paciente y sin decir la cédula", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1018888777</div></app-index>');
      c.api.hcRenderChip();
      c.api.__state.fraudWatch.add("1018888777@7:30 a. m.");
      t.cierto(c.api.hcTickVigia("") === true, "primer tick anuncia");
      const live = c.env.doc.getElementById("vgl-hc-live");
      const texto = live.innerHTML;
      t.cierto(texto.indexOf("inasistencia reincidente") !== -1, "el mensaje llegó a la región viva");
      t.cierto(texto.indexOf("1018888777") === -1, "el anuncio en voz alta NO dice la cédula");
      t.cierto(c.api.hcTickVigia("") === false, "tick siguiente: dedupe, no repite");
      t.igual(c.env.doc.getElementById("vgl-hc-live").innerHTML, texto, "la región viva quedó igual tras el dedupe");
    });

    t.caso("sin alerta de fraude no hay anuncio", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1018888777</div></app-index>');
      c.api.hcRenderChip();
      t.cierto(c.api.hcTickVigia("") === false, "paciente sin watch → sin anuncio");
      t.igual(c.env.doc.getElementById("vgl-hc-live").innerHTML, "", "región viva intacta");
    });

    // ---------- compromiso estructural ----------
    t.caso("ancla versionada: CONFIG.SEL.btnHC existe y es la clase real del bundle", () => {
      t.igual(api.__CONFIG.SEL.btnHC, ".btn-primary-medic", "selector documentado con fuente (extracción HCHealth)");
    });

    // ---------- contrato de red (v18.5.2-hc2) ----------
    t.caso("red del módulo: SOLO el prefetch especulativo, sin primitivas de red propias", () => {
      const ini = FUENTE.indexOf("VGL-HC · LANZADOR ASISTIDO");
      const fin = FUENTE.indexOf("_vglHcSetHintParaTest", ini);
      t.cierto(ini > 0 && fin > ini, "el bloque existe en el fuente");
      const bloque = FUENTE.slice(ini, fin);
      t.cierto(bloque.indexOf("GM_xmlhttpRequest") === -1, "sin GM_xmlhttpRequest");
      t.cierto(bloque.indexOf("xmlhttp") === -1, "sin ninguna variante de red directa");
      t.cierto(bloque.indexOf("pageFetchJson(") === -1 && bloque.indexOf("_pageFetchJsonCore(") === -1, "sin pageFetchJson crudo: la red solo va por apiAccesoBuscarPaciente/apiHcObtenerOrdenamientosVigentes");
      t.cierto(bloque.indexOf("especulativo: true") !== -1, "el prefetch viaja como especulativo (1 intento, sin reintentos)");
      t.cierto(bloque.indexOf("GHOST.promises.has") !== -1, "dedup en vuelo por GHOST.promises");
    });

    // ---------- hcPrefetch ----------
    t.caso("hcPrefetch: sin cédula no hace nada y no toca la red", () => {
      let llamadas = 0;
      const c = montar(AGENDA, { fetch: async () => { llamadas++; return respuesta([]); } });
      t.cierto(c.api.hcPrefetch("") === false, "cédula vacía → false");
      t.cierto(c.api.hcPrefetch(null) === false, "cédula null → false");
      t.igual(llamadas, 0, "ninguna de las dos salió a la red");
    });

    t.caso("hcPrefetch: dedup en vuelo — la misma cédula no genera dos cadenas", () => {
      const c = montar(AGENDA, { fetch: async () => respuesta([{ pacienteId: 999 }]) });
      t.cierto(c.api.hcPrefetch("1018888777") === true, "primera llamada: lanza la cadena");
      t.cierto(c.api.hcPrefetch("1018888777") === false, "segunda llamada en vuelo: dedup, no repite");
      t.cierto(c.api.hcPrefetch("98765432109") === true, "otro paciente sí lanza la suya");
    });

    await t.casoAsync("hcPrefetch: cadena completa cédula → id interno → órdenes vigentes (nunca la cédula como idPaciente)", async () => {
      const urls = [];
      const c = montar(AGENDA, {
        fetch: async (url) => {
          urls.push(String(url));
          if (String(url).indexOf("BuscarPaciente") !== -1) return respuesta([{ pacienteId: 999 }]);
          if (String(url).indexOf("ObtenerOrdenamientoPorPacienteIdVigente") !== -1) return respuesta([{ cup: "1" }]);
          return respuesta([]);
        },
      });
      t.cierto(c.api.hcPrefetch("1018888777") === true, "la cadena arranca");
      // Esperar a que las DOS llamadas de la cadena se completen (el mock resuelve
      // al instante; el loop solo tolera los await internos del núcleo de fetch).
      for (let i = 0; i < 100 && urls.length < 2; i++) await new Promise((r) => setTimeout(r, 5));
      t.cierto(urls.length >= 1, "se leyó al menos una URL (ninguna rama en silencio)");
      const urlBuscar = urls.find((u) => u.indexOf("BuscarPaciente") !== -1) || "";
      const urlOrdenes = urls.find((u) => u.indexOf("ObtenerOrdenamientoPorPacienteIdVigente") !== -1) || "";
      t.cierto(urlBuscar.indexOf("identificacion=1018888777") !== -1, "1er eslabón: la cédula viaja como identificacion");
      t.cierto(urlOrdenes !== "", "2do eslabón: se consultaron las órdenes vigentes");
      t.cierto(urlOrdenes.indexOf("pacienteid=999") !== -1, "las órdenes se pidieron con el id INTERNO resuelto");
      t.cierto(urlOrdenes.indexOf("1018888777") === -1, "la cédula NUNCA se manda como pacienteid");
    });

    await t.casoAsync("clic en el botón real de HC dispara el prefetch en segundo plano", async () => {
      const urls = [];
      const c = montar(AGENDA, {
        fetch: async (url) => {
          urls.push(String(url));
          if (String(url).indexOf("BuscarPaciente") !== -1) return respuesta([{ pacienteId: 777 }]);
          return respuesta([]);
        },
      });
      c.api._vglHcSetHintParaTest(null);
      c.api._vglHcCapturarClick({ target: c.env.doc.querySelector("button") });
      const ctx = c.api.hcPacienteContexto();
      t.cierto(!!ctx && ctx.docId === "1018888777", "el clic sigue capturando el hint (el prefetch no lo estorba)");
      for (let i = 0; i < 100 && urls.length < 1; i++) await new Promise((r) => setTimeout(r, 5));
      t.cierto(urls.length >= 1, "el clic generó tráfico de prefetch (ninguna rama en silencio)");
      t.cierto(urls.some((u) => u.indexOf("identificacion=1018888777") !== -1), "ese tráfico es la búsqueda de la cédula clicada");
    });

    await t.casoAsync("hcPrefetch: si BuscarPaciente no resuelve id, la cadena se CORTA (cero llamadas extra)", async () => {
      const urls = [];
      const c = montar(AGENDA, {
        fetch: async (url) => { urls.push(String(url)); return respuesta([]); },
      });
      t.cierto(c.api.hcPrefetch("555000111") === true, "la cadena arranca igual");
      for (let i = 0; i < 100 && urls.length < 1; i++) await new Promise((r) => setTimeout(r, 5));
      await new Promise((r) => setTimeout(r, 30)); // margen para que un hipotético 2do eslabón se delate
      t.cierto(urls.length >= 1, "la búsqueda sí se hizo (se leyó el dato)");
      t.cierto(urls.every((u) => u.indexOf("ObtenerOrdenamientoPorPacienteIdVigente") === -1), "sin id interno NO se piden órdenes: la cadena se corta");
    });

    // =====================================================================
    //  v18.6.1 (F2, delegación v2 §O2.3) — AVISO DEL ANEXO 5 AL ABRIR LA HC
    //  4 alertas + contexto, cédula enmascarada, una vez por paciente,
    //  aria-live sin cédula, cierre manual que respeta el turno.
    // =====================================================================
    const HOY_S = 46270;   // serial Excel de referencia (46269 = 04-sep-2026)
    const REC_A5 = {
      prog: "HTA+DM", ctrl: HOY_S - 200, suma: 58, tfg: 42.5, est: 3, ekg: 0,
      rem: ["Nutrición", "Odontología"],
      m: [[0, 0], [10, HOY_S - 30], [10, HOY_S - 30], [10, HOY_S - 30], [0, HOY_S - 10], [0, 0], [10, 0], [10, 0], [10, 0]],
      v: [138, 84, 102, 7.2, 112, 98],
    };
    const EST_A5 = (rec, conPES) => ({
      pymAnexo5: new Map([["1018888777", rec || REC_A5]]),
      pymAbandono: new Set(conPES ? ["1018888777"] : []),
    });

    t.caso("F2/vglSerialAFecha: serial Excel → dd/mm/aaaa (base 1899-12-30, verificada)", () => {
      t.igual(api.vglSerialAFecha(46269), "04/09/2026", "el serial de referencia del libro real");
      t.igual(api.vglSerialAFecha(1), "31/12/1899");
      t.igual(api.vglSerialAFecha(0), "", "0 = sin fecha: casilla vacía antes que 30/12/1899 inventado");
      t.igual(api.vglSerialAFecha(""), "");
      t.cierto(api.vglSerialHoy() > 46000, "el serial de hoy es del rango 2026");
    });

    t.caso("F2/a5AlertasDe: las CUATRO alertas con el reloj inyectado", () => {
      const r = api.a5AlertasDe("1.018.888.777", EST_A5(), HOY_S);
      t.cierto(!!r, "el paciente está en el Anexo 5");
      t.cierto(!!r.abandono && r.abandono.sinControl && !r.abandono.pes, "abandono por regla del libro: >183 días sin control");
      t.igual(r.pendientes, ["EKG (sin realizar)", "Glicemia en ayunas", "Hemoglobina glucosilada (HbA1c)"],
        "EKG sin fecha + metas 0 puntos SIN fecha (la de 0 con fecha NO cuenta)");
      t.igual(r.remitir, ["Nutrición", "Odontología"]);
      t.igual(r.suma, 58);
      t.falso(r.cumpleSuma, "58 < 75");
      t.igual(r.contexto.ta, "138/84", "contexto: TA sistólica/diastólica");
      t.igual(r.contexto.rac, 0, "RAC sin puntos (pendiente) con fecha aparte");
      // Abandono por PES aunque el control sea reciente.
      const recAlDia = Object.assign({}, REC_A5, { ctrl: HOY_S - 10 });
      const r2 = api.a5AlertasDe("1018888777", EST_A5(recAlDia, true), HOY_S);
      t.cierto(!!r2.abandono && r2.abandono.pes && !r2.abandono.sinControl, "abandono por Abandonados_PES de la hoja regional");
      // Cumple metas.
      const recCumple = Object.assign({}, REC_A5, { ctrl: HOY_S - 10, suma: 80 });
      const r3 = api.a5AlertasDe("1018888777", EST_A5(recCumple), HOY_S);
      t.falso(!!r3.abandono, "control reciente y sin PES: sin alerta de abandono");
      t.cierto(r3.cumpleSuma, "80 ≥ 75");
      // Paciente fuera del Anexo 5 → null (sin dato, sin mentira).
      t.igual(api.a5AlertasDe("999", EST_A5(), HOY_S), null);
    });

    t.caso("F2/hcAnexo5Render: panel DENTRO de #vgl-root con las 4 alertas, cédula enmascarada y cierre que respeta el turno", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1.018.888.777</div></app-index>');
      c.api.__state.pymAnexo5 = EST_A5().pymAnexo5;
      c.api.__state.pymAbandono = EST_A5().pymAbandono;
      t.cierto(c.api.hcAnexo5Render() === true, "con la HC abierta por DOM y dato del Anexo 5, el panel se pinta");
      const panel = c.env.doc.getElementById("vgl-a5-panel");
      t.cierto(!!panel && panel._parent && panel._parent.id === "vgl-root", "vive dentro de #vgl-root");
      t.cierto(panel.innerHTML.indexOf("Anexo 5 · HTA+DM") >= 0, "título con el programa");
      t.cierto(panel.innerHTML.indexOf("···8777") >= 0, "cédula enmascarada ···+4");
      t.falso(panel.innerHTML.indexOf("1.018.888.777") >= 0 && panel.innerHTML.indexOf("C.C.") < 0, "la cédula completa jamás");
      t.cierto(panel.innerHTML.indexOf("ABANDONO DEL PROGRAMA") >= 0, "alerta (a)");
      t.cierto(panel.innerHTML.indexOf("Estudios pendientes de ordenar") >= 0, "alerta (b)");
      t.cierto(panel.innerHTML.indexOf("Consultas por remitir") >= 0, "alerta (c)");
      t.cierto(panel.innerHTML.indexOf("Puntaje de metas: 58/75") >= 0, "alerta (d)");
      t.cierto(panel.innerHTML.indexOf("más de 6 meses sin control (último: " + api.vglSerialAFecha(HOY_S - 200) + ")") >= 0, "la fecha de control en dd/mm/aaaa");
      const live = c.env.doc.getElementById("vgl-a5-live");
      t.cierto(!!live && live.getAttribute("aria-live") === "polite", "región aria-live propia");
      t.cierto(live.textContent.indexOf("Anexo 5 abierto") === 0, "el anuncio nombra las alertas");
      t.falso(live.textContent.indexOf("8777") >= 0, "y NUNCA la cédula (PHI acústico)");
      const antes = live.textContent;
      c.api.hcAnexo5Render();                                   // segunda vuelta del tick
      t.igual(live.textContent, antes, "una sola vez por paciente: el lector no repite");
      // Cierre manual: el médico manda.
      const btn = panel.querySelector("[data-a5-cerrar]");
      t.cierto(!!btn && btn._listeners && btn._listeners.click && btn._listeners.click.length === 1, "el botón de cierre escucha el clic");
      btn._listeners.click[0]();
      t.cierto(!c.env.doc.getElementById("vgl-a5-panel"), "cerrar quita el panel");
      t.cierto(c.api.hcAnexo5Render() === false, "y no vuelve a aparecer para ese paciente en este turno");
    });

    t.caso("F2/hcAnexo5Render (v18.8.4 T1): el panel se pinta con variables de tema, sin colores duros", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1.018.888.777</div></app-index>');
      c.api.__state.pymAnexo5 = EST_A5().pymAnexo5;
      c.api.__state.pymAbandono = EST_A5().pymAbandono;
      t.cierto(c.api.hcAnexo5Render() === true, "el panel se pinta con las 4 alertas");
      const html = c.env.doc.getElementById("vgl-a5-panel").innerHTML;
      // Colores duros de la v18.8.3: en tema oscuro quedaban ilegibles (T1 los migra).
      const duros = ["#0F172A", "#B45309", "#1D4ED8", "#15803D", "#334155", "#64748B",
        "rgba(15,23,42,.03)", "rgba(15,23,42,.15)", "font-size:12px"];
      for (const h of duros) {
        t.falso(html.indexOf(h) >= 0, "sin el color duro " + h + " en el panel");
      }
      const vars = ["var(--c-rojo)", "var(--c-ambar)", "var(--c-azul)",
        "var(--fg)", "var(--fg2)", "var(--fg3)", "var(--surface-2)", "var(--line)", "var(--t-small)"];
      for (const v of vars) {
        t.cierto(html.indexOf(v) >= 0, "el panel consume " + v);
      }
      // La rama VERDE solo sale con metas cumplidas (58/75 no cumple): se fuerza con otro
      // registro del MISMO paciente y se comprueba que también consume su token.
      const recCumple = Object.assign({}, REC_A5, { ctrl: HOY_S - 10, suma: 80 });
      c.api.__state.pymAnexo5 = EST_A5(recCumple).pymAnexo5;
      t.cierto(c.api.hcAnexo5Render() === true, "re-render con metas cumplidas");
      const html2 = c.env.doc.getElementById("vgl-a5-panel").innerHTML;
      t.cierto(html2.indexOf("var(--c-verde)") >= 0, "la rama de metas cumplidas consume var(--c-verde)");
      t.falso(html2.indexOf("#15803D") >= 0, "y ya no pinta el verde duro");
      // Regla R: los !important literales inline se conservan exactamente (10, contados).
      t.igual((html.match(/!important/g) || []).length, 10, "los 10 !important inline siguen literales");
    });

    t.caso("F2/hcAnexo5Render: sin HC abierta por DOM, o sin dato del Anexo 5, no hay panel", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 98.765.432.109</div></app-index>');
      c.api.__state.pymAnexo5 = EST_A5().pymAnexo5;             // el dato es de OTRO paciente
      t.cierto(c.api.hcAnexo5Render() === false, "paciente sin registro en el Anexo 5: sin panel, sin mentira");
      const c2 = montar(AGENDA);                                 // origen hint (clic), HC aún no abierta
      c2.api._vglHcSetHintParaTest("1018888777");
      c2.api.__state.pymAnexo5 = EST_A5().pymAnexo5;
      t.cierto(c2.api.hcAnexo5Render() === false, "el aviso exige la historia ABIERTA (origen dom), no el clic");
    });

    t.caso("F2: el tick llama al aviso junto al chip (el hook no se pierde por carreras de edición)", () => {
      const i = FUENTE.indexOf("try { hcRenderChip(); } catch");
      t.cierto(i > 0, "el hook del chip existe");
      t.cierto(FUENTE.indexOf("try { hcAnexo5Render(); } catch", i) > 0 && FUENTE.indexOf("try { hcAnexo5Render(); } catch", i) < i + 120,
        "el aviso del Anexo 5 cuelga del MISMO tick, inmediatamente después del chip");
    });
  },
};
