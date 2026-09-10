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
    "vglSerialAFecha", "vglSerialHoy", "a5AlertasDe", "a5FilasHtml", "a5ResumenLinea",
    "abrirAnexo5Modal", "avisoUniversal", "_pendientesUniversales",
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
      t.igual(r.contexto.rac, 0, "sin valor real de RAC indexado (v[6] ausente) → 0 (v18.11.0: los puntos de la meta jamás se rotulan como mg/g)");
      // v18.11.0 (ORDEN #8) — el tramo RAC del contexto es el VALOR real (v[6]), nunca los puntos.
      const recRacReal = Object.assign({}, REC_A5, { v: REC_A5.v.concat(6.93) });
      t.igual(api.a5AlertasDe("1018888777", EST_A5(recRacReal), HOY_S).contexto.rac, 6.93,
        "con valor real indexado (v[6]=6.93) el contexto lleva 6.93 mg/g, no los puntos");
      const recRacPuntos = Object.assign({}, REC_A5, { m: REC_A5.m.map((p) => p.slice()), v: REC_A5.v.slice() });
      recRacPuntos.m[4] = [25, HOY_S - 10];   // meta cumplida: 25 PUNTOS, con fecha, SIN valor real
      t.igual(api.a5AlertasDe("1018888777", EST_A5(recRacPuntos), HOY_S).contexto.rac, 0,
        "meta con 25 puntos y SIN valor real → 0: el defecto v18.6.1 leía «RAC 25» como si fuera mg/g");
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

    // =====================================================================
    //  v18.14.3 (Fase 2 del comité, decisión 4.1 OPCIÓN B) — EL PANEL DEL ANEXO 5
    //  DENTRO DE LA HC SE RETIRÓ. Estos casos protegían ese panel (`#vgl-a5-panel`,
    //  su cierre por turno y su barra de Deshacer). Se re-apuntan a lo que SÍ vive:
    //  el aviso de la jornada (con la línea de la decisión 4.2) y el repositorio
    //  `#vgl-a5-modal`, que es donde el detalle completo se consulta ahora.
    // =====================================================================

    t.caso("F2 (v18.14.3, opción B): el panel del anexo dentro de la HC se retiró, y el anexo sigue llegando por el aviso y el repositorio", () => {
      // El censo mira CÓDIGO, no prosa: las notas de la retirada nombran a propósito lo
      // que se fue (el censo de texto crudo las contaría como si siguieran vivas).
      const codigo = FUENTE.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      for (const muerto of ["hcAnexo5Render", "vgl-a5-panel", "vgl-a5-deshacer", "vgl-a5-live", "_vglA5Cerrados", "_vglA5Anunciado"]) {
        t.falso(codigo.indexOf(muerto) >= 0, "sin rastro en el código del panel retirado: " + muerto);
      }
      t.falso(codigo.indexOf("try { hcAnexo5Render(); }") >= 0, "el tick ya no llama al panel del anexo");
      // La retirada NO se llevó el dato: el anexo sigue resolviéndose y sigue llegando.
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1.018.888.777</div></app-index>');
      c.api.__state.pymAnexo5 = EST_A5().pymAnexo5;
      c.api.__state.pymAbandono = EST_A5().pymAbandono;
      const d = c.api.a5AlertasDe("1.018.888.777", c.api.__state, HOY_S);
      t.cierto(!!d, "el anexo del paciente sigue resolviéndose igual que antes");
      // El punto de entrada automático es ahora el aviso de la jornada, con su accesibilidad.
      const pintó = c.api.avisoUniversal("PACIENTE DE PRUEBA", { anexo5: d }, true);
      t.cierto(pintó, "el aviso de la jornada se pintó con la sección del anexo");
      const ov = c.env.doc.getElementById("vgl-pym-modal");
      t.cierto(!!ov && ov.getAttribute("role") === "alertdialog", "el anexo viaja en un cuadro anunciable (su accesibilidad ya no es una región propia)");
      t.cierto(ov.innerHTML.indexOf("Anexo 5 · HTA+DM") >= 0, "con el programa del paciente");
      // El detalle completo, a un clic, en el repositorio — con la cédula enmascarada.
      t.cierto(c.api.abrirAnexo5Modal(d) === true, "el repositorio se abre");
      const modal = c.env.doc.getElementById("vgl-a5-modal");
      t.cierto(!!modal && modal.innerHTML.indexOf("···8777") >= 0, "la cédula va enmascarada ···+4");
      t.falso(!!modal && modal.innerHTML.indexOf("1.018.888.777") >= 0, "la cédula completa jamás");
      t.cierto(!!modal && modal.innerHTML.indexOf("ABANDONO DEL PROGRAMA") >= 0, "y el detalle completo sí está ahí (alerta (a))");
    });

    t.caso("F2/a5FilasHtml (v18.8.4 T1): las filas del anexo usan variables de tema, sin colores duros", () => {
      const html = api.a5FilasHtml(api.a5AlertasDe("1.018.888.777", EST_A5(), HOY_S));
      // Colores duros de la v18.8.3: en tema oscuro quedaban ilegibles (T1 los migra).
      const duros = ["#0F172A", "#B45309", "#1D4ED8", "#15803D", "#334155", "#64748B",
        "rgba(15,23,42,.03)", "rgba(15,23,42,.15)", "font-size:12px"];
      for (const h of duros) {
        t.falso(html.indexOf(h) >= 0, "sin el color duro " + h + " en las filas");
      }
      const vars = ["var(--c-rojo)", "var(--c-ambar)", "var(--c-azul)",
        "var(--fg2)", "var(--fg3)"];
      for (const v of vars) {
        t.cierto(html.indexOf(v) >= 0, "las filas consumen " + v);
      }
      // La rama VERDE solo sale con metas cumplidas (58/75 no cumple): se fuerza con otro
      // registro del MISMO paciente y se comprueba que también consume su token.
      const recCumple = Object.assign({}, REC_A5, { ctrl: HOY_S - 10, suma: 80 });
      const html2 = api.a5FilasHtml(api.a5AlertasDe("1018888777", EST_A5(recCumple), HOY_S));
      t.cierto(html2.indexOf("var(--c-verde)") >= 0, "la rama de metas cumplidas consume var(--c-verde)");
      t.falso(html2.indexOf("#15803D") >= 0, "y ya no pinta el verde duro");
      // Regla R: los !important literales inline se conservan exactamente. Son 7 para este
      // registro: abandono 1 + estudios 2 (contenedor + su <span>) + remisiones 2 + puntaje
      // 1 + línea de contexto 1. (El panel retirado sumaba 3 más de su propio envoltorio.)
      t.igual((html.match(/!important/g) || []).length, 7, "los 7 !important inline siguen literales");
    });

    t.caso("F2/a5FilasHtml (v18.11.0 ORDEN #8): el tramo RAC es el valor real en mg/g — nunca los puntos de la meta", () => {
      const recRacReal = Object.assign({}, REC_A5, { v: REC_A5.v.concat(6.93) });
      const html = api.a5FilasHtml(api.a5AlertasDe("1018888777", EST_A5(recRacReal), HOY_S));
      t.cierto(html.indexOf("RAC 6.93") >= 0,
        "la línea de contexto muestra el RAC real de la columna del libro (6.93 mg/g)");
      // Meta cumplida (25 puntos) pero SIN valor real: el tramo se calla. Rotular «RAC 25»
      // era el defecto v18.6.1 — un cumplimiento de 25 puntos se leía como 25 mg/g.
      const recRacPuntos = Object.assign({}, REC_A5, { m: REC_A5.m.map((p) => p.slice()), v: REC_A5.v.slice() });
      recRacPuntos.m[4] = [25, HOY_S - 10];
      const html2 = api.a5FilasHtml(api.a5AlertasDe("1018888777", EST_A5(recRacPuntos), HOY_S));
      t.falso(html2.indexOf("RAC ") >= 0,
        "sin valor real indexado no aparece «RAC 25» ni tramo alguno: casilla vacía");
    });

    t.caso("F2/a5ResumenLinea (v18.14.3, decisión 4.2): el aviso dice el hecho en UNA línea, con singular y plural correctos", () => {
      const d = api.a5AlertasDe("1.018.888.777", EST_A5(), HOY_S);
      const linea = api.a5ResumenLinea(d);
      t.cierto(linea.indexOf("abandono del programa") >= 0, "nombra el abandono");
      t.cierto(linea.indexOf("puntaje de metas 58/75 — por debajo del mínimo") >= 0, "y el puntaje contra el mínimo");
      t.cierto(linea.indexOf("3 estudios pendientes de ordenar") >= 0, "y los estudios pendientes en plural (son 3)");
      t.cierto(linea.indexOf("2 consultas por remitir") >= 0, "y las remisiones en plural (son 2)");
      t.falso(linea.indexOf("1018888777") >= 0, "cero PHI en la línea");
      t.falso(/[<>]/.test(linea), "texto escapado: ni un ángulo crudo");
      // Singular: una sola remisión y un solo estudio pendiente (el EKG sin hacer).
      const unico = Object.assign({}, REC_A5, {
        ctrl: HOY_S - 10, suma: 80,
        rem: ["Nutrición"],
        m: REC_A5.m.map((p) => p.slice()),
      });
      unico.m[0] = [10, HOY_S - 10];   // glicemia cumplida
      unico.m[5] = [10, HOY_S - 10];   // HbA1c cumplida
      const l2 = api.a5ResumenLinea(api.a5AlertasDe("1018888777", EST_A5(unico), HOY_S));
      t.falso(l2.indexOf("abandono") >= 0, "control reciente: sin abandono en la línea");
      t.cierto(l2.indexOf("— cumple") >= 0, "80/75 se rotula «cumple»");
      t.cierto(l2.indexOf("1 consulta por remitir") >= 0, "una remisión se dice en singular");
      t.cierto(l2.indexOf("1 estudio pendiente de ordenar") >= 0, "y un estudio, en singular");
      // Sin datos no hay línea (casilla vacía antes que dato inventado).
      t.igual(api.a5ResumenLinea(null), "");
    });

    t.caso("F2: sin paciente abierto no hay anexo — la compuerta que sobrevive a la retirada del panel", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 98.765.432.109</div></app-index>');
      c.api.__state.pymAnexo5 = EST_A5().pymAnexo5;             // el dato es de OTRO paciente
      t.igual(c.api.a5AlertasDe("98765432109", c.api.__state, HOY_S), null,
        "paciente sin registro en el Anexo 5: sin anexo, sin mentira");
      t.igual(c.api._pendientesUniversales("").anexo5, null, "sin paciente abierto la vara no trae anexo");
      t.igual(c.api._pendientesUniversales("1018888777").anexo5 !== null, true,
        "y con el paciente del índice SÍ lo trae (la retirada del panel no se llevó el dato)");
    });
  },
};
