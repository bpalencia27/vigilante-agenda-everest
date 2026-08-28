// =====================================================================
//  SUITE 71 — v17.18.0: widget de Conducta "qué ordenar en el próximo control"
//
//  Pedido del médico (28-ago): que la lista de exámenes a ordenar salga en un
//  widget propio, junto al botón nativo de ordenar de Everest en Conducta —
//  sin abrir el Panel del paciente. Reusa mtrTableroClinico (el mismo motor
//  que ya pinta la Sección 3 del Panel), así que las dos vistas nunca divergen.
// =====================================================================

const RESUMEN_ORDENAR = {
  programa: "HTA", factores: { hta: true },
  plan: {
    ordenar: [
      { clave: "creatinina", nombre: "CREATININA", estado: "D", subestado: "vencido", vence: "2026-08-01" },
      { clave: "hemoglobina", nombre: "HEMOGLOBINA", estado: "D", subestado: "pendiente", vence: "2026-09-01" },
    ],
    drivers: [], pasajeros: [],
  },
};
const RESUMEN_AL_DIA = { programa: "HTA", factores: { hta: true }, plan: { ordenar: [], drivers: [], pasajeros: [] } };
const RESUMEN_SIN_PROGRAMA = { plan: { ordenar: [], drivers: [], pasajeros: [] } };

// v17.32.0 — claves REALES de MTR_DRIVERS/MTR_PASAJEROS (mayúsculas), a diferencia de
// RESUMEN_ORDENAR de arriba (que usa "creatinina"/"hemoglobina" en minúscula, inocuo
// para mtrWidgetExamenesDatos porque ese widget nunca toca `.clave` — pero el botón
// "Ordenar pendientes" SÍ, para resolver el CUPS de cada uno, así que necesita el
// formato real que entrega mtrPlanParaclinicos).
const RESUMEN_ORDENAR_BOTON = {
  programa: "HTA", factores: { hta: true },
  plan: {
    ordenar: [
      { clave: "CREATININA", nombre: "Creatinina sérica", estado: "D", subestado: "vencido", vence: "2026-08-01" },
      { clave: "HBA1C", nombre: "Hemoglobina glicosilada", estado: "A", subestado: "pendiente", vence: null },
    ],
    drivers: [], pasajeros: [],
  },
};

// Mismo patrón de tablero-de-pestañas que suite_64: un objeto "doc" mínimo cuyo
// querySelector reconoce el ancla ".active"/aria-selected como si fuera la barra
// real de Everest, más querySelectorAll("button") para el botón "Paquetes" y
// querySelectorAll(".btn-reformular") para el ancla del widget de farmacia (v17.24.0).
function docConducta(botones, botonesReformular) {
  return {
    querySelector(sel) {
      const s = String(sel);
      if (s.indexOf("active") >= 0 || s.indexOf('aria-selected="true"') >= 0) return { id: "conducta", textContent: "Conducta" };
      return null;
    },
    querySelectorAll(sel) {
      if (sel === "button") return botones || [];
      if (sel === ".btn-reformular") return botonesReformular || [];
      return [];
    },
  };
}
function boton(texto, visible) {
  return {
    textContent: texto,
    offsetParent: visible === false ? null : {},
    getBoundingClientRect: () => (visible === false ? { width: 0, height: 0 } : { left: 10, top: 20, width: 80, height: 30, right: 90 }),
  };
}
// v17.34.0 — "Historial" a la izquierda de "Paquetes", MISMO renglón (top:20, igual que
// boton("Paquetes")), pegado (right:90 de Historial = left:90 de Paquetes en boton()). Con
// esto mtrAnclaOrdenarPendientes encuentra el par real y descarta cualquier otro
// "Historial" que no comparta el renglón (p. ej. el de Medicamentos, más abajo).
function botonHistorial(visible) {
  return {
    textContent: "Historial",
    offsetParent: visible === false ? null : {},
    // v17.34.0 — a propósito NO pegado a boton("Paquetes") (left:10): con un hueco de por
    // medio, el punto medio real ((rH.left+rP.right)/2) queda lejos de CUALQUIER borde
    // individual de los dos botones — si una prueba solo comprobara "coincide con
    // rP.left" o "con rH.left", una mutación que centrara sobre el botón equivocado
    // podría colar sin que la prueba lo notara.
    getBoundingClientRect: () => (visible === false ? { width: 0, height: 0 } : { left: -130, top: 20, width: 70, height: 30, right: -60 }),
  };
}
// v17.24.0 — el ancla del widget de farmacia no es texto, es la clase real confirmada
// por la grabación del 28-ago (DIAGNOSTICO_CONDUCTA_DOM.js): el botón "+" de reformular.
function botonReformular(visible) {
  return {
    textContent: "",
    offsetParent: visible === false ? null : {},
    getBoundingClientRect: () => (visible === false ? { width: 0, height: 0 } : { left: 200, top: 60, width: 28, height: 28, right: 228 }),
  };
}

// Cablea el document (env.doc) de una instancia recién cargada para que
// extractPacienteAbierto()/_vglEnPestana("conducta")/mtrBotonOrdenarConducta/
// mtrBotonFarmacoConducta funcionen sobre una historia clínica simulada, sin tocar
// nada más del arnés (getElementById/querySelectorAll caen al comportamiento real
// para cualquier id/selector que esta prueba no necesite, incluidos los propios
// "vgl-cw-examenes"/"vgl-cw-farmaco" que cada widget crea con document.createElement real).
function cablearHistoriaConducta(env, cedula, botonesPaquetes, botonesReformular) {
  const doc = env.doc;
  const getByIdReal = doc.getElementById.bind(doc);
  const qsAllReal = doc.querySelectorAll.bind(doc);
  doc.getElementById = (id) => (id === "anamesis" ? { textContent: "" } : getByIdReal(id));
  doc.querySelector = (sel) => {
    const s = String(sel);
    if (s.indexOf("active") >= 0 || s.indexOf('aria-selected="true"') >= 0) return { id: "conducta", textContent: "Conducta" };
    return null;
  };
  doc.querySelectorAll = (sel) => {
    if (sel === ".text-muted") return [{ textContent: "  C.C.  " + cedula + " ", closest: () => null }];
    if (sel === "button") return botonesPaquetes || [];
    if (sel === ".btn-reformular") return botonesReformular || [];
    return qsAllReal(sel);
  };
}

module.exports = {
  nombre: "Widget de Conducta: exámenes a ordenar en el próximo control",
  cubre: [
    "mtrBotonOrdenarConducta", "mtrWidgetExamenesDatos", "mtrWidgetConductaTick", "_cwEstadoParaTest", "_cwResetParaTest",
    "mtrBotonFarmacoConducta", "mtrWidgetFarmacoDatos", "mtrWidgetFarmacoTick", "_cwfEstadoParaTest", "_cwfResetParaTest",
    "mtrItemsOrdenarConducta", "mtrOrdenarLabsConductaAhora", "isOrdenLabsConductaHoy", "markOrdenLabsConductaHoy",
    "mtrWidgetOrdenarConductaTick", "_cwoEstadoParaTest", "_cwoResetParaTest",
    "mtrAnclaOrdenarPendientes", "mtrPosicionPanelJuntoA",
  ],

  async pruebas(t, api, env, cargar) {
    // ---------- mtrBotonOrdenarConducta ----------
    t.caso("mtrBotonOrdenarConducta: encuentra el botón 'Paquetes' visible dentro de Conducta", () => {
      const d = docConducta([boton("Cancelar"), boton("Paquetes")]);
      const b = api.mtrBotonOrdenarConducta(d);
      t.cierto(!!b, "debe encontrar el botón");
      t.igual(b.textContent, "Paquetes");
    });

    t.caso("mtrBotonOrdenarConducta: fuera de Conducta, null aunque el botón exista en el DOM", () => {
      const d = { querySelector: () => ({ id: "anamesis", textContent: "Anamnesis" }), querySelectorAll: (s) => (s === "button" ? [boton("Paquetes")] : []) };
      t.igual(api.mtrBotonOrdenarConducta(d), null, "_vglEnPestana debe devolver false para anamnesis, nunca se llega a buscar el botón");
    });

    t.caso("mtrBotonOrdenarConducta: en Conducta pero sin botón 'Paquetes', null — nunca se ancla a ciegas", () => {
      const d = docConducta([boton("Cancelar"), boton("Guardar")]);
      t.igual(api.mtrBotonOrdenarConducta(d), null);
    });

    t.caso("mtrBotonOrdenarConducta: un botón 'Paquetes' oculto (offsetParent null) no cuenta como visible de verdad", () => {
      const d = docConducta([boton("Paquetes", false)]);
      t.igual(api.mtrBotonOrdenarConducta(d), null, "Everest puede tener el botón montado pero tapado — no es lo mismo que visible");
    });

    t.caso("mtrBotonOrdenarConducta: doc ilegible no revienta, devuelve null", () => {
      t.noLanza(() => api.mtrBotonOrdenarConducta({ querySelector: () => null }));
    });

    // ---------- mtrWidgetExamenesDatos (pura) ----------
    t.caso("mtrWidgetExamenesDatos: con exámenes pendientes, arma una fila por cada uno y cuenta bien", () => {
      const d = api.mtrTableroClinico(RESUMEN_ORDENAR);
      const r = api.mtrWidgetExamenesDatos(RESUMEN_ORDENAR);
      t.igual(r.n, d.ordenar.length, "el conteo debe salir del mismo mtrTableroClinico que usa el Panel — nunca puede divergir");
      t.falso(r.sinJuicio);
      t.cierto(r.html.indexOf("CREATININA") >= 0);
      t.cierto(r.html.indexOf("vgl-cw-venc") >= 0, "el vencido lleva su propia clase");
      t.cierto(r.html.indexOf("vgl-cw-pedir") >= 0, "el pendiente-no-vencido lleva la suya");
    });

    t.caso("mtrWidgetExamenesDatos: al día con el programa (ordenar vacío, programa identificado) — mensaje con evidencia", () => {
      const r = api.mtrWidgetExamenesDatos(RESUMEN_AL_DIA);
      t.igual(r.n, 0);
      t.falso(r.sinJuicio, "sí se evaluó: el programa se identificó y no hay pendientes");
      t.cierto(r.html.indexOf("Al día") >= 0);
    });

    t.caso("mtrWidgetExamenesDatos: sin programa identificado — nunca dice 'al día', dice que no se evaluó (Regla D)", () => {
      const r = api.mtrWidgetExamenesDatos(RESUMEN_SIN_PROGRAMA);
      t.igual(r.n, 0);
      t.cierto(r.sinJuicio, "sin programa no hay juicio posible");
      t.falso(r.html.toLowerCase().indexOf("al día") >= 0, "un hueco no puede rellenarse con una frase tranquilizadora");
    });

    t.caso("mtrWidgetExamenesDatos: resumen null/ilegible no revienta, marca sinJuicio", () => {
      const r = api.mtrWidgetExamenesDatos(null);
      t.cierto(r.sinJuicio);
      t.igual(r.n, 0);
    });

    // ---------- mtrWidgetConductaTick (integración) ----------
    t.caso("mtrWidgetConductaTick: apagado por S.conductaWidgets=false, no pinta ni deja el widget visible", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [boton("Paquetes")]);
      c.api.__S.conductaWidgets = false;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR);
      c.api.mtrWidgetConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-examenes");
      t.falso(el && el.style.display !== "none", "sin el interruptor encendido, el widget no debe quedar visible");
    });

    t.caso("mtrWidgetConductaTick: encendido, con paciente/resumen/botón — crea el widget anclado y con el conteo correcto", () => {
      const c = cargar({ silencioso: true });
      const btnPaquetes = boton("Paquetes");
      cablearHistoriaConducta(c.env, "1098765432", [btnPaquetes]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR);
      c.api.mtrWidgetConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-examenes");
      t.cierto(!!el, "el widget debe existir en el DOM");
      t.falso(el.style.display === "none", "debe quedar visible");
      t.cierto(el.innerHTML.indexOf("2") >= 0, "dos exámenes pendientes: el badge debe mostrar el conteo");
      t.igual(el.style.left, Math.round(btnPaquetes.getBoundingClientRect().right + 10) + "px", "se ancla a la derecha del botón real, no a una posición inventada");
    });

    t.caso("mtrWidgetConductaTick: sin botón 'Paquetes' visible (otra sub-pantalla de Conducta), el widget se oculta", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", []);   // Conducta activa, pero sin el botón
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR);
      c.api.mtrWidgetConductaTick();
      c.api.mtrWidgetConductaTick();   // segunda vuelta: debe seguir oculto, no quedar a medio crear
      const el = c.env.doc.getElementById("vgl-cw-examenes");
      t.falso(el && el.style.display !== "none", "sin ancla visible nunca se muestra — nunca flota a ciegas");
    });

    t.caso("mtrWidgetConductaTick: anti-parpadeo — un segundo tick sin cambios no reescribe el contenido", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR);
      c.api.mtrWidgetConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-examenes");
      el.innerHTML = "__marca_de_esta_prueba__";   // si el segundo tick repinta, esta marca desaparece
      c.api.mtrWidgetConductaTick();
      t.igual(el.innerHTML, "__marca_de_esta_prueba__", "misma firma que el tick anterior: no debía tocar el contenido");
    });

    t.caso("mtrWidgetConductaTick: cambiar de paciente reinicia el estado — nunca arrastra el juicio del anterior", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR);
      c.api.mtrWidgetConductaTick();
      t.igual(c.api._cwEstadoParaTest().docPrevio, "1098765432");

      // Nuevo paciente: distinta cédula, sin resumen cacheado todavía para él.
      cablearHistoriaConducta(c.env, "5551234567", [boton("Paquetes")]);
      c.api.mtrWidgetConductaTick();
      const st = c.api._cwEstadoParaTest();
      t.igual(st.docPrevio, "5551234567", "el paciente activo cambió de verdad");
      t.igual(st.firma, "", "sin resumen cacheado para el nuevo paciente, el estado vuelve a cero — no hereda la firma del anterior");
      const el = c.env.doc.getElementById("vgl-cw-examenes");
      t.falso(el && el.style.display !== "none", "sin resumen del paciente nuevo, el widget se oculta en vez de seguir mostrando el juicio del anterior");
    });

    t.caso("_cwResetParaTest: deja el estado interno exactamente en cero", () => {
      api._cwResetParaTest();
      const st = api._cwEstadoParaTest();
      t.igual(st.docPrevio, null);
      t.igual(st.firma, "");
      t.igual(st.nPrevio, 0);
    });

    // =====================================================================
    //  v17.24.0 — WIDGET DE FARMACIA (Fase 2 del rediseño del Panel del paciente)
    //  ---------------------------------------------------------------------
    //  Ancla real confirmada por grabación de consulta (28-ago,
    //  DIAGNOSTICO_CONDUCTA_DOM.js, sin datos de paciente): el botón "+" de
    //  reformular (.btn-reformular). El contenido reusa mtrAvisosFarmacologicos/
    //  mtrDuplicidadesTerapeuticas — el mismo motor que hasta la Fase 1 pintaba la
    //  extinta pestaña Medicamentos del Panel — para que nunca puedan divergir.
    // =====================================================================
    const RESUMEN_FARMACO_DUP = { medicamentos: ["LOSARTAN 50MG", "VALSARTAN 80MG", "METFORMINA 850MG"], erc: {} };
    const RESUMEN_FARMACO_LIMPIO = { medicamentos: ["METFORMINA 850MG"], erc: { egfr: 90, crcl: 90 } };
    const RESUMEN_FARMACO_SIN_LISTA = { medicamentos: null, erc: {} };

    // ---------- mtrBotonFarmacoConducta ----------
    t.caso("mtrBotonFarmacoConducta: encuentra el botón .btn-reformular visible dentro de Conducta", () => {
      const d = docConducta([], [botonReformular()]);
      const b = api.mtrBotonFarmacoConducta(d);
      t.cierto(!!b, "debe encontrar el botón");
    });

    t.caso("mtrBotonFarmacoConducta: fuera de Conducta, null aunque el botón exista en el DOM", () => {
      const d = { querySelector: () => ({ id: "anamesis", textContent: "Anamnesis" }), querySelectorAll: (s) => (s === ".btn-reformular" ? [botonReformular()] : []) };
      t.igual(api.mtrBotonFarmacoConducta(d), null, "_vglEnPestana debe devolver false para anamnesis");
    });

    t.caso("mtrBotonFarmacoConducta: en Conducta pero sin ningún .btn-reformular (paciente sin medicamentos activos), null", () => {
      const d = docConducta([], []);
      t.igual(api.mtrBotonFarmacoConducta(d), null, "sin medicamentos que reformular, el widget no se ancla a ciegas");
    });

    t.caso("mtrBotonFarmacoConducta: un .btn-reformular oculto no cuenta como visible de verdad", () => {
      const d = docConducta([], [botonReformular(false)]);
      t.igual(api.mtrBotonFarmacoConducta(d), null);
    });

    t.caso("mtrBotonFarmacoConducta: doc ilegible no revienta, devuelve null", () => {
      t.noLanza(() => api.mtrBotonFarmacoConducta({ querySelector: () => null }));
    });

    // ---------- mtrWidgetFarmacoDatos (pura) ----------
    t.caso("mtrWidgetFarmacoDatos: motor apagado (fábrica) — aviso NEUTRO, nunca oculto ni 'sin hallazgos' (decisión del médico, 28-ago)", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.motorPortado = false;
      const r = c.api.mtrWidgetFarmacoDatos(RESUMEN_FARMACO_LIMPIO);
      t.igual(r.n, 0);
      t.cierto(r.sinJuicio, "con el motor apagado y sin duplicidad, no hay juicio posible");
      t.cierto(r.html.indexOf("Motor de avisos apagado") >= 0, "dice la causa, no un genérico 'sin datos'");
    });

    t.caso("mtrWidgetFarmacoDatos: motor apagado PERO con duplicidad — la duplicidad no depende del motor, se ve igual", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.motorPortado = false;
      const r = c.api.mtrWidgetFarmacoDatos(RESUMEN_FARMACO_DUP);
      t.igual(r.n, 1, "una duplicidad (LOSARTAN + VALSARTAN, mismo grupo ARA-II)");
      t.falso(r.sinJuicio, "sí hay algo que revisar, aunque el motor de avisos esté apagado");
      t.cierto(r.html.indexOf("vgl-dup-bloque") >= 0);
    });

    t.caso("mtrWidgetFarmacoDatos: motor encendido, con duplicidad — cuenta y pinta la duplicidad", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.motorPortado = true;
      const r = c.api.mtrWidgetFarmacoDatos(RESUMEN_FARMACO_DUP);
      t.cierto(r.n >= 1, "al menos la duplicidad");
      t.falso(r.sinJuicio);
      t.cierto(r.html.indexOf("vgl-dup-bloque") >= 0);
    });

    t.caso("mtrWidgetFarmacoDatos: motor encendido, medicamentos limpios y función renal normal — sin avisos, sin sinJuicio", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.motorPortado = true;
      const r = c.api.mtrWidgetFarmacoDatos(RESUMEN_FARMACO_LIMPIO);
      t.igual(r.n, 0);
      t.falso(r.sinJuicio, "un solo medicamento limpio SÍ se evaluó — no es lo mismo que no poder evaluar");
    });

    t.caso("mtrWidgetFarmacoDatos: sin lista de medicamentos (no se pudo leer) — sinJuicio, nunca 'al día'", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.motorPortado = true;
      const r = c.api.mtrWidgetFarmacoDatos(RESUMEN_FARMACO_SIN_LISTA);
      t.cierto(r.sinJuicio);
      t.cierto(r.html.indexOf("No se pudo leer") >= 0);
    });

    t.caso("mtrWidgetFarmacoDatos: resumen null no revienta, marca sinJuicio", () => {
      const r = api.mtrWidgetFarmacoDatos(null);
      t.cierto(r.sinJuicio);
      t.igual(r.n, 0);
    });

    // ---------- mtrWidgetFarmacoTick (integración) ----------
    t.caso("mtrWidgetFarmacoTick: apagado por S.conductaWidgets=false, no pinta ni deja el widget visible", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [], [botonReformular()]);
      c.api.__S.conductaWidgets = false;
      c.api.__S.motorPortado = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_FARMACO_DUP);
      c.api.mtrWidgetFarmacoTick();
      const el = c.env.doc.getElementById("vgl-cw-farmaco");
      t.falso(el && el.style.display !== "none", "sin el interruptor encendido, el widget no debe quedar visible");
    });

    t.caso("mtrWidgetFarmacoTick: encendido, con paciente/resumen/ancla — crea el widget anclado con el conteo correcto", () => {
      const c = cargar({ silencioso: true });
      const btnReform = botonReformular();
      cablearHistoriaConducta(c.env, "1098765432", [], [btnReform]);
      c.api.__S.conductaWidgets = true;
      c.api.__S.motorPortado = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_FARMACO_DUP);
      c.api.mtrWidgetFarmacoTick();
      const el = c.env.doc.getElementById("vgl-cw-farmaco");
      t.cierto(!!el, "el widget debe existir en el DOM");
      t.falso(el.style.display === "none", "debe quedar visible");
      t.igual(el.style.left, Math.round(btnReform.getBoundingClientRect().right + 10) + "px", "se ancla al botón real de reformular, no a una posición inventada");
    });

    t.caso("mtrWidgetFarmacoTick: sin .btn-reformular visible (paciente sin medicamentos activos), el widget se oculta", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [], []);
      c.api.__S.conductaWidgets = true;
      c.api.__S.motorPortado = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_FARMACO_DUP);
      c.api.mtrWidgetFarmacoTick();
      c.api.mtrWidgetFarmacoTick();
      const el = c.env.doc.getElementById("vgl-cw-farmaco");
      t.falso(el && el.style.display !== "none", "sin ancla visible nunca se muestra");
    });

    t.caso("mtrWidgetFarmacoTick: anti-parpadeo — un segundo tick sin cambios no reescribe el contenido", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [], [botonReformular()]);
      c.api.__S.conductaWidgets = true;
      c.api.__S.motorPortado = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_FARMACO_DUP);
      c.api.mtrWidgetFarmacoTick();
      const el = c.env.doc.getElementById("vgl-cw-farmaco");
      el.innerHTML = "__marca_de_esta_prueba__";
      c.api.mtrWidgetFarmacoTick();
      t.igual(el.innerHTML, "__marca_de_esta_prueba__", "misma firma: no debía tocar el contenido");
    });

    t.caso("mtrWidgetFarmacoTick: cambiar de paciente reinicia el estado — nunca arrastra el juicio del anterior", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [], [botonReformular()]);
      c.api.__S.conductaWidgets = true;
      c.api.__S.motorPortado = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_FARMACO_DUP);
      c.api.mtrWidgetFarmacoTick();
      t.igual(c.api._cwfEstadoParaTest().docPrevio, "1098765432");

      cablearHistoriaConducta(c.env, "5551234567", [], [botonReformular()]);
      c.api.mtrWidgetFarmacoTick();
      const st = c.api._cwfEstadoParaTest();
      t.igual(st.docPrevio, "5551234567");
      t.igual(st.firma, "", "sin resumen cacheado para el nuevo paciente, el estado vuelve a cero");
    });

    t.caso("_cwfResetParaTest: deja el estado interno exactamente en cero", () => {
      api._cwfResetParaTest();
      const st = api._cwfEstadoParaTest();
      t.igual(st.docPrevio, null);
      t.igual(st.firma, "");
      t.igual(st.nPrevio, 0);
    });

    // =====================================================================
    //  v17.32.0 — BOTÓN "ORDENAR PENDIENTES" (encargo del médico, 28-ago): un solo
    //  clic, sin pantalla de confirmación intermedia ("tal cual como lo haría el botón
    //  de Paquetes que ya trae Everest"), genera la orden de todo lo que
    //  mtrPlanParaclinicos diga que toca ahora — reusando el MISMO camino de red que
    //  openOrdenamientoModal (apiOrdenamientoBuscarPaciente/ObtenerDx/ObtenerCup/Guardar).
    // =====================================================================

    // ---------- mtrItemsOrdenarConducta (pura) ----------
    t.caso("mtrItemsOrdenarConducta: traduce el ordenar crudo a {clave,nombre,codigos}, ignorando claves sin CUPS conocido", () => {
      const items = api.mtrItemsOrdenarConducta([
        { clave: "CREATININA", nombre: "Creatinina sérica" },
        { clave: "ALGO_QUE_NO_EXISTE", nombre: "Rareza" },
        { clave: "RAC", nombre: "RAC" },
      ]);
      t.igual(items.length, 2, "la clave desconocida se ignora, nunca revienta");
      t.cierto(items.some((x) => x.clave === "CREATININA" && x.codigos.join(",") === "903895"));
      const rac = items.find((x) => x.clave === "RAC");
      t.cierto(!!rac, "RAC sí se reconoce");
      t.igual(rac.codigos.length, 2, "RAC lleva sus dos códigos — creatinina en orina + microalbuminuria");
    });
    t.caso("mtrItemsOrdenarConducta: dedup por clave, y sin `ordenar` (null/no-array) no revienta", () => {
      const items = api.mtrItemsOrdenarConducta([
        { clave: "GLUCOSA", nombre: "Glicemia" },
        { clave: "GLUCOSA", nombre: "Glicemia (repetida)" },
      ]);
      t.igual(items.length, 1, "una sola entrada por clave");
      t.igual(api.mtrItemsOrdenarConducta(null).length, 0);
      t.igual(api.mtrItemsOrdenarConducta(undefined).length, 0);
    });

    // ---------- mtrOrdenarLabsConductaAhora (red) ----------
    // Mismo patrón de mock que suite_05/suite_15: una URL por endpoint, con banderas
    // para simular cada punto de fallo por separado. Se construye ANTES de cargar():
    // _pageFetchJsonCore captura `window.fetch` en una constante propia (FETCH0) al
    // ejecutar el script — reasignar c.env.win.fetch DESPUÉS de cargar() no sirve de
    // nada, el mismo escollo que ya documenta suite_05.
    function crearFetchOrdenar(opts) {
      const o = opts || {};
      const llamadas = [];
      const fetch = async (url) => {
        const u = String(url);
        llamadas.push(u);
        // v17.32.0 — un retraso real (no solo microtasks) para que dos clics superpuestos
        // en la prueba de reentrancia se comporten como dos peticiones de red genuinas en
        // vuelo a la vez — sin esto, la cadena entera de un clic se resuelve en microtasks
        // antes de que el segundo clic alcance a llamar a la red, y la prueba no distingue
        // "el guardarraíl funcionó" de "no hubo carrera real que probar".
        if (o.delayMs) await new Promise((res) => setTimeout(res, o.delayMs));
        const json = (data) => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => data, text: async () => JSON.stringify(data), clone() { return this; } });
        if (u.indexOf("/api/Paciente/BuscarPaciente") >= 0) {
          return o.sinPaciente ? json(null) : json({ id: 801848 });
        }
        if (u.indexOf("ObtenerListadoDiagnostico") >= 0) {
          return o.sinDx ? json([]) : json([{ codigo: "I10X", id: 55, nombre: "RCV EXPRÉS" }]);
        }
        if (u.indexOf("ObtenerListadoCupsPorPaciente") >= 0) {
          const m = /filter=([^&]+)/.exec(u);
          const cod = m ? decodeURIComponent(m[1]) : "";
          if (o.cupsFallidos && o.cupsFallidos.indexOf(cod) >= 0) return json([]);
          return json([{ id: "cup_" + cod, codigo: cod, descripcion: "EXAMEN " + cod, nivel: 1 }]);
        }
        if (u.indexOf("GuardarOrdenamiento") >= 0) {
          return o.guardarFalla ? json({ error: true }) : json({ error: false, agrupador: "1226099999" });
        }
        return json({});
      };
      return { fetch, llamadas };
    }
    // Carga una instancia lista para ordenar: fetch mockeado desde el arranque y
    // médico en sesión (apiOrdenamientoGuardar exige uId, ver v12.0.0).
    function cargarParaOrdenar(opts) {
      const mock = crearFetchOrdenar(opts);
      const c = cargar({ silencioso: true, fetch: mock.fetch });
      c.api.__state.activeDoctor = { id: 309, name: "MÉDICO DE PRUEBA" };
      return Object.assign(c, { llamadas: mock.llamadas });
    }

    await t.casoAsync("mtrOrdenarLabsConductaAhora: camino feliz — todos los CUPS resuelven, se crea la orden", async () => {
      const c = cargarParaOrdenar();
      const items = c.api.mtrItemsOrdenarConducta([{ clave: "CREATININA", nombre: "Creatinina" }, { clave: "HBA1C", nombre: "HbA1c" }]);
      const r = await c.api.mtrOrdenarLabsConductaAhora("1098765432", items);
      t.cierto(r.ok, "la orden se confirma");
      t.igual(r.creadas.length, 2);
      t.igual(r.fallidas.length, 0);
      t.igual(r.agrupador, "1226099999");
    });

    await t.casoAsync("mtrOrdenarLabsConductaAhora: RAC exige SUS DOS códigos — si falta uno, RAC entero queda fallida (no se pide media RAC)", async () => {
      const c = cargarParaOrdenar({ cupsFallidos: ["903026"] });   // solo falla la microalbuminuria
      const items = c.api.mtrItemsOrdenarConducta([{ clave: "RAC", nombre: "RAC" }, { clave: "CREATININA", nombre: "Creatinina" }]);
      const r = await c.api.mtrOrdenarLabsConductaAhora("1098765432", items);
      t.cierto(r.ok, "la creatinina sí se ordena aunque RAC falle");
      t.igual(r.creadas.length, 1);
      t.cierto(r.creadas.indexOf("RAC") < 0, "RAC no cuenta como creada");
      t.cierto(r.fallidas.some((f) => f.clave === "RAC" && f.motivo === "cups"), "RAC queda registrada como fallida, con motivo");
    });

    await t.casoAsync("mtrOrdenarLabsConductaAhora: sin paciente en el sistema de órdenes, falla completa y visible", async () => {
      const c = cargarParaOrdenar({ sinPaciente: true });
      const items = c.api.mtrItemsOrdenarConducta([{ clave: "GLUCOSA", nombre: "Glicemia" }]);
      const r = await c.api.mtrOrdenarLabsConductaAhora("1098765432", items);
      t.falso(r.ok);
      t.igual(r.creadas.length, 0);
      t.cierto(r.motivo.indexOf("paciente") >= 0 || r.motivo.length > 0, "el motivo se explica, nunca queda mudo");
    });

    await t.casoAsync("mtrOrdenarLabsConductaAhora: sin diagnóstico resuelto (I10X no aparece), falla completa", async () => {
      const c = cargarParaOrdenar({ sinDx: true });
      const items = c.api.mtrItemsOrdenarConducta([{ clave: "GLUCOSA", nombre: "Glicemia" }]);
      const r = await c.api.mtrOrdenarLabsConductaAhora("1098765432", items);
      t.falso(r.ok);
      t.igual(r.creadas.length, 0);
    });

    await t.casoAsync("mtrOrdenarLabsConductaAhora: el servidor no confirma la orden (GuardarOrdenamiento falla) — nada queda marcado como creado", async () => {
      const c = cargarParaOrdenar({ guardarFalla: true });
      const items = c.api.mtrItemsOrdenarConducta([{ clave: "GLUCOSA", nombre: "Glicemia" }]);
      const r = await c.api.mtrOrdenarLabsConductaAhora("1098765432", items);
      t.falso(r.ok);
      t.igual(r.creadas.length, 0, "sin confirmación del servidor, nada cuenta como ordenado — evita marcar 'hecho' algo que no se sabe si quedó");
    });

    await t.casoAsync("mtrOrdenarLabsConductaAhora: sin items pendientes, no sale ni una petición a la red", async () => {
      const c = cargarParaOrdenar();
      const r = await c.api.mtrOrdenarLabsConductaAhora("1098765432", []);
      t.falso(r.ok);
      t.igual(c.llamadas.length, 0, "nada pendiente: cero peticiones, no hay motivo para tocar la red");
    });

    await t.casoAsync("mtrOrdenarLabsConductaAhora: sin docId, falla sin tocar la red", async () => {
      const c = cargarParaOrdenar();
      const r = await c.api.mtrOrdenarLabsConductaAhora("", [{ clave: "GLUCOSA", nombre: "Glicemia", codigos: ["903841"] }]);
      t.falso(r.ok);
      t.igual(c.llamadas.length, 0);
    });

    // ---------- isOrdenLabsConductaHoy / markOrdenLabsConductaHoy ----------
    t.caso("isOrdenLabsConductaHoy/markOrdenLabsConductaHoy: namespace propio, NUNCA comparte almacén con isOrdenesCreadasHoy (el de PyM)", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api.isOrdenLabsConductaHoy("1098765432"));
      c.api.markOrdenLabsConductaHoy("1098765432", ["CREATININA", "HBA1C"]);
      t.cierto(c.api.isOrdenLabsConductaHoy("1098765432"), "queda marcado en su propio almacén");
      t.falso(c.api.isOrdenesCreadasHoy("1098765432"),
        "marcar el botón de labs de Conducta NO debe apagar el botón «Ordenar» (PyM) del dock con un mensaje que ya no sería cierto");
      // Y a la inversa.
      c.api.markOrdenesCreadasHoy("5551234567", ["AGP1"], ["VIH"]);
      t.falso(c.api.isOrdenLabsConductaHoy("5551234567"), "y viceversa: una orden PyM tampoco marca el botón de labs de Conducta");
    });
    t.caso("isOrdenLabsConductaHoy: sin docId, false — nunca revienta", () => {
      t.falso(api.isOrdenLabsConductaHoy(""));
      t.falso(api.isOrdenLabsConductaHoy(null));
    });

    // ---------- mtrAnclaOrdenarPendientes ----------
    t.caso("mtrAnclaOrdenarPendientes: encuentra el par Historial+Paquetes del MISMO renglón, no cualquiera", () => {
      const historialCorrecto = { textContent: "Historial", offsetParent: {}, getBoundingClientRect: () => ({ left: -70, top: 20, width: 70, height: 30, right: 0 }) };
      const historialDeMedicamentos = { textContent: "Historial", offsetParent: {}, getBoundingClientRect: () => ({ left: 10, top: 500, width: 70, height: 30, right: 80 }) };
      const d = docConducta([historialDeMedicamentos, historialCorrecto, boton("Paquetes")]);
      const ancla = api.mtrAnclaOrdenarPendientes(d);
      t.cierto(!!ancla, "encuentra el ancla");
      t.igual(ancla.historial, historialCorrecto, "elige el Historial del mismo renglón que Paquetes, no el de Medicamentos");
    });
    t.caso("mtrAnclaOrdenarPendientes: sin 'Paquetes' visible, null", () => {
      const d = docConducta([botonHistorial()]);
      t.igual(api.mtrAnclaOrdenarPendientes(d), null);
    });
    t.caso("mtrAnclaOrdenarPendientes: 'Paquetes' visible pero sin ningún 'Historial' en el mismo renglón, null", () => {
      const historialLejano = { textContent: "Historial", offsetParent: {}, getBoundingClientRect: () => ({ left: 10, top: 500, width: 70, height: 30, right: 80 }) };
      const d = docConducta([historialLejano, boton("Paquetes")]);
      t.igual(api.mtrAnclaOrdenarPendientes(d), null);
    });
    t.caso("mtrAnclaOrdenarPendientes: fuera de Conducta, null aunque los botones existan", () => {
      const d = { querySelector: () => null, querySelectorAll: (sel) => (sel === "button" ? [botonHistorial(), boton("Paquetes")] : []) };
      t.igual(api.mtrAnclaOrdenarPendientes(d), null);
    });
    t.caso("mtrAnclaOrdenarPendientes: doc ilegible no revienta, devuelve null", () => {
      t.noLanza(() => api.mtrAnclaOrdenarPendientes({ querySelector() { throw new Error("boom"); } }));
    });

    // ---------- mtrPosicionPanelJuntoA ----------
    t.caso("mtrPosicionPanelJuntoA: con espacio de sobra, se abre a la DERECHA del ancla", () => {
      const c = cargar({ silencioso: true });
      c.env.win.innerWidth = 1024;
      const left = c.api.mtrPosicionPanelJuntoA({ left: 10, right: 90, top: 20 }, 280);
      t.igual(left, 100, "right(90) + 10, con espacio de sobra hasta 1024");
    });
    t.caso("mtrPosicionPanelJuntoA: reportado en consultorio — sin espacio a la derecha, se abre a la IZQUIERDA en vez de encogerse", () => {
      const c = cargar({ silencioso: true });
      c.env.win.innerWidth = 400;   // "Paquetes" cerca del borde derecho de una ventana angosta
      const rect = { left: 300, right: 380, top: 20 };
      const left = c.api.mtrPosicionPanelJuntoA(rect, 280);
      // A la derecha no cabe (380+10+280=670 > 400-8): se abre a la izquierda del ancla.
      t.igual(left, 300 - 280 - 10, "left(300) - anchoPanel(280) - 10, nunca deja que el navegador lo encoja");
    });
    t.caso("mtrPosicionPanelJuntoA: cae a la izquierda del ancla, pero AÚN ASÍ se sale por la derecha — el segundo recorte lo trae de vuelta", () => {
      const c = cargar({ silencioso: true });
      c.env.win.innerWidth = 295;
      // No cabe a la derecha (320+10+280=610 > 287), así que cae a la izquierda del ancla
      // (300-280-10=10) — un valor ya positivo, que el primer recorte (contra el borde
      // izquierdo) no toca. Pero 10+280=290 SÍ se sale del borde derecho (295-8=287): hace
      // falta el SEGUNDO recorte para traerlo de vuelta a 8. Vector elegido a propósito
      // para que ningún recorte por sí solo explique el resultado.
      const left = c.api.mtrPosicionPanelJuntoA({ left: 300, right: 320, top: 20 }, 280);
      t.igual(left, 8, "el recorte contra el borde derecho debe ganar, aunque la izquierda ya diera un valor positivo");
    });
    t.caso("mtrPosicionPanelJuntoA: si el panel es más ancho que toda la ventana, prioriza no salirse por la izquierda (caso degenerado, sin solución perfecta)", () => {
      const c = cargar({ silencioso: true });
      c.env.win.innerWidth = 200;   // más angosto que el panel mismo: no hay dónde quepa completo
      const left = c.api.mtrPosicionPanelJuntoA({ left: 50, right: 130, top: 20 }, 280);
      t.igual(left, 8, "se ancla al margen izquierdo — el panel se saldrá por la derecha, pero nunca por la izquierda");
    });
    t.caso("mtrPosicionPanelJuntoA: sin window.innerWidth disponible, usa un ancho de reserva sensato (1024) sin reventar", () => {
      t.noLanza(() => api.mtrPosicionPanelJuntoA({ left: 10, right: 90, top: 20 }, 280));
    });

    // ---------- mtrWidgetOrdenarConductaTick ----------
    t.caso("mtrWidgetOrdenarConductaTick: apagado por S.conductaWidgets=false, no pinta ni deja el botón visible", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = false;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el && el.style.display !== "none", "sin el toggle encendido, no debe quedar visible");
    });

    // v17.34.0 — encargo del médico: "literal en medio del botón de Historial y Paquetes,
    // justo debajo". El punto medio va del borde izquierdo de Historial al borde derecho
    // de Paquetes; el botón se centra ahí con `transform:translateX(-50%)` (ver CSS), así
    // que `left` en el estilo ES el punto medio, no el borde izquierdo del botón.
    t.caso("mtrWidgetOrdenarConductaTick: encendido, con pendientes — botón visible, CENTRADO entre Historial y Paquetes, debajo de los dos", () => {
      const c = cargar({ silencioso: true });
      const btnHistorial = botonHistorial();
      const btnPaquetes = boton("Paquetes");
      cablearHistoriaConducta(c.env, "1098765432", [btnHistorial, btnPaquetes]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.cierto(!!el, "el botón debe existir en el DOM");
      t.falso(el.style.display === "none", "debe quedar visible");
      const rH = btnHistorial.getBoundingClientRect();
      const rP = btnPaquetes.getBoundingClientRect();
      const centroEsperado = Math.round((rH.left + rP.right) / 2);
      const topEsperado = Math.round(Math.max(rH.bottom, rP.bottom) + 8);
      t.igual(el.style.left, centroEsperado + "px", "el punto medio entre Historial y Paquetes, no el borde de uno solo");
      t.igual(el.style.top, topEsperado + "px", "queda DEBAJO de los dos, no a su lado");
      t.cierto(el.textContent.indexOf("2") >= 0, "el rótulo cuenta los pendientes");
      t.falso(el.disabled, "clicable: todavía no se ha ordenado hoy");
    });

    t.caso("mtrWidgetOrdenarConductaTick: sin nada pendiente, el botón se oculta (no invita a ordenar la nada)", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_AL_DIA);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el && el.style.display !== "none");
    });

    t.caso("mtrWidgetOrdenarConductaTick: sin botón 'Paquetes' visible, el botón nuevo también se oculta — mismo ancla, misma regla", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial()]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el && el.style.display !== "none");
    });

    // v17.34.0 — el ancla ahora exige LOS DOS botones: si falta "Historial" (o si el único
    // "Historial" visible es el de otra sección, como Medicamentos, en otro renglón), el
    // botón se oculta en vez de adivinar dónde ponerse.
    t.caso("mtrWidgetOrdenarConductaTick: 'Paquetes' sin su 'Historial' en el mismo renglón, se oculta — nunca ancla a un botón de otra sección", () => {
      const c = cargar({ silencioso: true });
      const historialDeOtroRenglon = { textContent: "Historial", offsetParent: {}, getBoundingClientRect: () => ({ left: 10, top: 500, width: 70, height: 30, right: 80 }) };
      cablearHistoriaConducta(c.env, "1098765432", [historialDeOtroRenglon, boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el && el.style.display !== "none");
    });

    t.caso("mtrWidgetOrdenarConductaTick: ya ordenado hoy — botón deshabilitado, dice «Ordenado hoy», sigue visible (no desaparece sin más)", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.markOrdenLabsConductaHoy("1098765432", ["CREATININA"]);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.cierto(!!el && el.style.display !== "none", "sigue visible — confirma que el clic surtió efecto, en vez de desaparecer sin decir nada (Regla D)");
      t.cierto(el.disabled, "ya no se puede volver a ordenar hoy");
      t.cierto(el.textContent.indexOf("Ordenado") >= 0);
    });

    t.caso("mtrWidgetOrdenarConductaTick: cambiar de paciente reinicia el estado interno", () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      t.igual(c.api._cwoEstadoParaTest().docPrevio, "1098765432");
      cablearHistoriaConducta(c.env, "5551234567", [botonHistorial(), boton("Paquetes")]);
      c.api.mtrWidgetOrdenarConductaTick();
      t.igual(c.api._cwoEstadoParaTest().docPrevio, "5551234567");
    });

    t.caso("_cwoResetParaTest: deja el estado interno exactamente en cero", () => {
      api._cwoResetParaTest();
      const st = api._cwoEstadoParaTest();
      t.igual(st.docPrevio, null);
      t.igual(st.enCurso, false);
    });

    // ---------- integración de punta a punta: el clic real ----------
    await t.casoAsync("Integración: un clic en el botón ordena de verdad y lo deja marcado — sin pantalla intermedia, como pidió el médico", async () => {
      const c = cargarParaOrdenar();
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el.disabled, "antes del clic, clicable");

      const clicListo = el.onclick({ stopPropagation() {} });
      await clicListo;   // _cwoClic es async; el propio onclick devuelve su promesa

      t.cierto(c.api.isOrdenLabsConductaHoy("1098765432"), "el clic de verdad generó la orden y quedó marcado");
      t.falso(el.disabled === false, "tras el repintado que dispara el propio clic, ya no se puede volver a hacer clic");
      t.cierto(el.textContent.indexOf("Ordenado") >= 0);
    });

    // v17.32.0 — dos clics rápidos (doble-clic real, o un dedo lento sobre un trackpad)
    // antes de que la primera petición termine NO deben generar DOS órdenes del mismo
    // examen: es exactamente el tipo de duplicado que el guardarraíl de "ya ordenado hoy"
    // existe para evitar, pero ese solo actúa DESPUÉS de que la primera termine — mientras
    // está en vuelo, el guardarraíl es `_cwoEnCurso`.
    await t.casoAsync("Integración: dos clics antes de que termine el primero solo generan UNA petición de guardado", async () => {
      const c = cargarParaOrdenar({ delayMs: 15 });   // simula latencia real de red
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      const p1 = el.onclick({ stopPropagation() {} });
      // El primer clic ya está en vuelo (su primera petición salió y está esperando el
      // delay simulado) cuando llega el segundo — la misma ventana en la que un médico
      // real podría volver a pulsar mientras la red tarda.
      await new Promise((res) => setTimeout(res, 5));
      const p2 = el.onclick({ stopPropagation() {} });
      await Promise.all([p1, p2]);
      const guardados = c.llamadas.filter((u) => u.indexOf("GuardarOrdenamiento") >= 0);
      t.igual(guardados.length, 1, "el segundo clic, mientras el primero seguía en vuelo, no debía tocar la red otra vez");
    });

    await t.casoAsync("Integración: si la orden falla, el botón queda disponible para reintentar — nunca bloqueado por un fallo", async () => {
      const c = cargarParaOrdenar({ sinPaciente: true });
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      await el.onclick({ stopPropagation() {} });
      t.falso(c.api.isOrdenLabsConductaHoy("1098765432"), "un fallo total no se marca como hecho");
      t.falso(el.disabled, "queda disponible para que el médico reintente");
    });

    // =====================================================================
    //  REGRESIÓN — el hallazgo real de esta versión: un widget puede pasar
    //  todas las pruebas de arriba (su lógica pura y su función de tick están
    //  perfectamente probadas) y NUNCA HABERSE LLAMADO desde el reloj real del
    //  script. Es exactamente lo que le pasó a mtrWidgetConductaTick desde
    //  v17.18.0: la función se escribió y se probó de frente, pero jamás se
    //  enganchó al tick() de producción — el widget de exámenes nunca se pintó
    //  en ninguna consulta real hasta que esta versión lo enganchó. "Probar la
    //  pieza no es probar que la pieza está conectada" (lección ya escrita en
    //  tests/INFORME_MUTACIONES.md, v17.12.0) — esta prueba existe para que esa
    //  lección no se vuelva a aprender por las malas.
    // =====================================================================
    t.caso("REGRESIÓN: los tres widgets de Conducta están enganchados de verdad al tick() de la sección «historia»", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const iHistoria = src.indexOf('if (secc === "historia")');
      t.cierto(iHistoria >= 0, "debe existir la rama de la sección historia en tick()");
      const bloque = src.slice(iHistoria, iHistoria + 1200);
      t.cierto(bloque.indexOf("mtrWidgetConductaTick()") >= 0,
        "mtrWidgetConductaTick() debe llamarse dentro de la rama de historia — si esto falla, el widget de exámenes volvió a quedar sin pintar en consulta real");
      t.cierto(bloque.indexOf("mtrWidgetFarmacoTick()") >= 0,
        "mtrWidgetFarmacoTick() debe llamarse dentro de la rama de historia — el widget de farmacia, igual que su hermano, no sirve de nada si solo vive en el banco de pruebas");
      // v17.32.0 — el mismo defecto, una tercera vez, es el que esta prueba existe para
      // evitar: el botón "Ordenar pendientes" no sirve de nada si solo vive en el banco.
      t.cierto(bloque.indexOf("mtrWidgetOrdenarConductaTick()") >= 0,
        "mtrWidgetOrdenarConductaTick() debe llamarse dentro de la rama de historia — si esto falla, el botón de ordenar nunca se pinta en consulta real");
    });
  },
};
