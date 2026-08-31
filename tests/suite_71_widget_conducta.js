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
// v17.37.0 — CREATININA (antes aquí) se retiró del fixture: desde que el botón dejó de
// disparar "Paquetes → HTA" (retirado por completo — agregaba siempre un hemograma no
// permitido), CREATININA ya no tiene forma de agregarse desde este botón y simplemente cae
// fuera de {paquete, individuales}. Se usa PTH en su lugar: otro individual real, para que
// este fixture siga representando "dos pendientes" sin depender de un mecanismo retirado.
const RESUMEN_ORDENAR_BOTON = {
  programa: "HTA", factores: { hta: true },
  plan: {
    ordenar: [
      { clave: "PTH", nombre: "Hormona paratiroidea", estado: "D", subestado: "vencido", vence: "2026-08-01" },
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
    getBoundingClientRect: () => (visible === false ? { width: 0, height: 0 } : { left: 10, top: 20, width: 80, height: 30, right: 90, bottom: 50 }),
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
    getBoundingClientRect: () => (visible === false ? { width: 0, height: 0 } : { left: -130, top: 20, width: 70, height: 30, right: -60, bottom: 50 }),
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
// v17.35.0 — `extra.tabla`/`extra.lis` son opcionales: solo los usan las pruebas de
// integración de punta a punta, que necesitan que el MISMO `document` sirva tanto al
// ancla (botón "Paquetes") como al gesto real (tabla de Ordenamientos, <li> del
// buscador) — `botonesPaquetes` debe ser el mismo array MUTABLE que la prueba sigue
// empujando (HTA/Agregar aparecen ahí), no una copia.
function cablearHistoriaConducta(env, cedula, botonesPaquetes, botonesReformular, extra) {
  const doc = env.doc;
  const ex = extra || {};
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
    if (sel === "table") return ex.tabla ? [ex.tabla] : [];
    if (sel === "li") return ex.lis || [];
    return qsAllReal(sel);
  };
}

module.exports = {
  nombre: "Widget de Conducta: exámenes a ordenar en el próximo control",
  cubre: [
    "mtrBotonOrdenarConducta", "mtrWidgetExamenesDatos", "mtrWidgetConductaTick", "_cwEstadoParaTest", "_cwResetParaTest",
    "mtrBotonFarmacoConducta", "mtrWidgetFarmacoDatos", "mtrWidgetFarmacoTick", "_cwfEstadoParaTest", "_cwfResetParaTest",
    "mtrItemsOrdenarConducta", "isOrdenLabsConductaHoy", "markOrdenLabsConductaHoy",
    "mtrWidgetOrdenarConductaTick", "mtrOcultarBotonOrdenarPendientes", "_cwoEstadoParaTest", "_cwoResetParaTest",
    "mtrAnclaOrdenarPendientes", "mtrPosicionPanelJuntoA",
    "_conductaBuscarYAgregarExamen", "mtrConductaAgregarPendientes",
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

    // v17.41.0 — encargo del médico: el widget ahora se ancla igual que "Ordenar
    // pendientes" (Historial+Paquetes, centrado, en una SEGUNDA fila justo debajo), en vez
    // de solo a la derecha de "Paquetes".
    t.caso("mtrWidgetConductaTick: encendido, con paciente/resumen/ancla — crea el widget centrado en una segunda fila, con el conteo correcto", () => {
      const c = cargar({ silencioso: true });
      const btnHistorial = botonHistorial();
      const btnPaquetes = boton("Paquetes");
      cablearHistoriaConducta(c.env, "1098765432", [btnHistorial, btnPaquetes]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR);
      c.api.mtrWidgetConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-examenes");
      t.cierto(!!el, "el widget debe existir en el DOM");
      t.falso(el.style.display === "none", "debe quedar visible");
      t.cierto(el.innerHTML.indexOf("2") >= 0, "dos exámenes pendientes: el badge debe mostrar el conteo");
      const rH = btnHistorial.getBoundingClientRect();
      const rP = btnPaquetes.getBoundingClientRect();
      const centroEsperado = Math.round((rH.left + rP.right) / 2);
      const topEsperado = Math.round(Math.max(rH.bottom, rP.bottom) + 8 + 36 + 8);
      t.igual(el.style.left, centroEsperado + "px", "centrado sobre el mismo punto medio que 'Ordenar pendientes', no a la derecha de Paquetes");
      t.igual(el.style.top, topEsperado + "px", "en una segunda fila, debajo de donde iría 'Ordenar pendientes'");
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
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
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
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR);
      c.api.mtrWidgetConductaTick();
      t.igual(c.api._cwEstadoParaTest().docPrevio, "1098765432");

      // Nuevo paciente: distinta cédula, sin resumen cacheado todavía para él.
      cablearHistoriaConducta(c.env, "5551234567", [botonHistorial(), boton("Paquetes")]);
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
    // v17.37.0 — corrección del médico, misma tarde que v17.36.0: "Paquetes → HTA" agregaba
    // SIEMPRE un hemograma no permitido, así que el disparo del paquete se retiró por
    // completo (MTR_ANALITOS_PAQUETE_CONDUCTA quedó vacía). CREATININA (y el resto de los
    // siete que antes vivían ahí) ya NO tiene ninguna forma de agregarse desde este botón:
    // cae fuera de {paquete, individuales} por completo — `items.paquete` queda SIEMPRE
    // vacío, para cualquier entrada.
    t.caso("mtrItemsOrdenarConducta: {paquete} queda SIEMPRE vacío (el disparo de Paquetes→HTA se retiró) — la RAC solo se busca individual (sus DOS componentes)", () => {
      const items = api.mtrItemsOrdenarConducta([
        { clave: "CREATININA", nombre: "Creatinina sérica" },
        { clave: "ALGO_QUE_NO_EXISTE", nombre: "Rareza" },
        { clave: "RAC", nombre: "RAC" },
        { clave: "PTH", nombre: "PTH" },
      ]);
      t.igual(items.paquete.length, 0, "CREATININA no tiene forma de agregarse desde este botón: el paquete quedó retirado");
      t.igual(items.individuales.length, 2, "RAC y PTH se buscan una por una");
      const racInd = items.individuales.find((x) => x.clave === "RAC");
      t.cierto(!!racInd, "RAC aparece en individuales");
      t.igual(racInd.liTextos.length, 2, "la RAC necesita DOS búsquedas: microalbuminuria y creatinina en orina");
      t.cierto(racInd.liTextos.indexOf("MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL") >= 0);
      t.cierto(racInd.liTextos.indexOf("CREATININA EN ORINA PARCIAL") >= 0);
      const pth = items.individuales.find((x) => x.clave === "PTH");
      t.igual(pth.liTextos.length, 1);
      t.igual(pth.liTextos[0], "HORMONA PARATIROIDEA MOLECULA INTACTA");
    });
    t.caso("mtrItemsOrdenarConducta: si la RAC es lo ÚNICO pendiente, no queda nada en `paquete` — nunca se arrastra el resto de la HTA", () => {
      const items = api.mtrItemsOrdenarConducta([{ clave: "RAC", nombre: "RAC" }]);
      t.igual(items.paquete.length, 0, "con la RAC sola, el paquete completo (8-10 analitos ajenos) nunca se dispara");
      t.igual(items.individuales.length, 1);
      t.igual(items.individuales[0].liTextos.length, 2);
    });
    t.caso("mtrItemsOrdenarConducta: dedup por clave, y sin `ordenar` (null/no-array) no revienta", () => {
      const items = api.mtrItemsOrdenarConducta([
        { clave: "HBA1C", nombre: "Hemoglobina glicosilada" },
        { clave: "HBA1C", nombre: "Hemoglobina glicosilada (repetida)" },
      ]);
      t.igual(items.individuales.length, 1, "una sola entrada por clave");
      const vacio = api.mtrItemsOrdenarConducta(null);
      t.igual(vacio.paquete.length, 0); t.igual(vacio.individuales.length, 0);
      const vacio2 = api.mtrItemsOrdenarConducta(undefined);
      t.igual(vacio2.paquete.length, 0); t.igual(vacio2.individuales.length, 0);
    });

    // ---------- el gesto real: mocks de DOM mínimos, por función ----------
    // No se usa el DOM de bolsillo del arnés (no convierte innerHTML en hijos reales, ver
    // nota de suite_42): se construyen objetos mínimos que implementan justo lo que cada
    // función lee (querySelectorAll("table"/"button"/"li"), textContent, click(),
    // disabled) — mismo patrón que docConducta()/boton() de esta misma suite.
    // o.rect: opcional — para el par de pruebas de integración que necesitan que el MISMO
    // botón "Paquetes" sirva a la vez de ancla (mtrAnclaOrdenarPendientes, que sí lee
    // getBoundingClientRect) y de gesto clicable (_conductaClicPaqueteHTA).
    function mockBoton(texto, opts) {
      const o = opts || {};
      let clics = 0;
      const b = {
        textContent: texto,
        offsetParent: o.visible === false ? null : {},
        disabled: !!o.disabled,
        click() { clics++; if (o.alClick) o.alClick(); },
        get _clicado() { return clics > 0; },
        get _clics() { return clics; },
      };
      if (o.rect) b.getBoundingClientRect = () => o.rect;
      return b;
    }
    function mockLi(texto, alClick) {
      let clics = 0;
      return { textContent: texto, click() { clics++; if (alClick) alClick(); }, get _clicado() { return clics > 0; }, get _clics() { return clics; } };
    }
    function mockFila(codigo) {
      return { querySelector: (sel) => (sel === "td" ? { textContent: codigo } : null) };
    }
    function mockTabla(codigosIniciales) {
      const filas = (codigosIniciales || []).map(mockFila);
      return {
        textContent: "Código Nombre Cantidad Nota Fecha de consulta Acción",
        querySelectorAll: (sel) => (sel === "tr" ? filas.slice() : []),
        _agregarFila(codigo) { filas.push(mockFila(codigo)); },
      };
    }
    // El doc mock delega a listas MUTABLES (arrays que las pruebas pueden seguir
    // empujando) para que un click() disparado por la propia prueba pueda, con un
    // setTimeout real, hacer aparecer un botón/fila nueva — igual que Angular monta el
    // botón "Agregar" un instante después del clic en el <li> real.
    function mockDocConducta(o) {
      const opts = o || {};
      const tabla = opts.tabla || mockTabla([]);
      let botones = opts.botonesIniciales ? opts.botonesIniciales.slice() : [];
      let lis = opts.lis ? opts.lis.slice() : [];
      return {
        _tabla: tabla,
        _agregarBoton(b) { botones.push(b); },
        _quitarBoton(b) { botones = botones.filter((x) => x !== b); },
        querySelectorAll(sel) {
          if (sel === "table") return opts.sinTabla ? [] : [tabla];
          if (sel === "button") return botones.slice();
          if (sel === "li") return lis.slice();
          return [];
        },
      };
    }

    // ---------- _conductaClicPaqueteHTA ----------
    await t.casoAsync("_conductaClicPaqueteHTA: camino feliz — clic en Paquetes, luego en HTA (Angular monta HTA 400ms después)", async () => {
      const d = mockDocConducta({});
      const bPaquetes = mockBoton("Paquetes", {
        alClick: () => setTimeout(() => d._agregarBoton(mockBoton("HTA", {})), 0),
      });
      d._agregarBoton(bPaquetes);
      const ok = await api._conductaClicPaqueteHTA(d);
      t.cierto(ok, "encontró y clickeó los dos botones");
      t.cierto(bPaquetes._clicado, "Paquetes se clickeó");
    });
    await t.casoAsync("_conductaClicPaqueteHTA: sin 'Paquetes' visible, false, sin tocar nada más", async () => {
      const d = mockDocConducta({ botonesIniciales: [mockBoton("Paquetes", { visible: false })] });
      const ok = await api._conductaClicPaqueteHTA(d);
      t.falso(ok);
    });
    await t.casoAsync("_conductaClicPaqueteHTA: 'Paquetes' existe pero 'HTA' nunca aparece, false", async () => {
      const d = mockDocConducta({ botonesIniciales: [mockBoton("Paquetes", {})] });
      const ok = await api._conductaClicPaqueteHTA(d);
      t.falso(ok, "sin HTA tras el clic, no hay nada más que hacer");
    });

    // ---------- _conductaBuscarYAgregarExamen ----------
    await t.casoAsync("_conductaBuscarYAgregarExamen: camino feliz — <li> exacto, luego 'Agregar' (Angular lo monta 700ms después)", async () => {
      const d = mockDocConducta({});
      const li = mockLi("HORMONA PARATIROIDEA MOLÉCULA INTACTA", () => {   // con tilde real, como en la captura
        setTimeout(() => d._agregarBoton(mockBoton("Agregar", {})), 0);
      });
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const ok = await api._conductaBuscarYAgregarExamen("HORMONA PARATIROIDEA MOLECULA INTACTA", d);
      t.cierto(ok, "coincide sin tilde por _canonTexto, y encuentra Agregar");
      t.cierto(li._clicado);
    });
    await t.casoAsync("_conductaBuscarYAgregarExamen: coincidencia EXACTA, nunca por substring — examen parecido no se clickea (en ninguna de las dos direcciones)", async () => {
      // El catálogo real de Everest podría traer una entrada más CORTA (le falta
      // "AUTOMATIZADA": prefijo del buscado) o una MÁS LARGA (con un calificador extra:
      // el buscado es prefijo de ella) — ninguna de las dos es el mismo examen, y un
      // `indexOf` en cualquiera de los dos sentidos las clickearía por error.
      const liMasCorto = mockLi("HEMOGLOBINA GLICOSILADA");
      const liMasLargo = mockLi("HEMOGLOBINA GLICOSILADA AUTOMATIZADA FRACCIONADA");
      const d = mockDocConducta({ lis: [liMasCorto, liMasLargo] });
      const ok = await api._conductaBuscarYAgregarExamen("HEMOGLOBINA GLICOSILADA AUTOMATIZADA", d);
      t.falso(ok);
      t.falso(liMasCorto._clicado, "un match parcial (más corto que lo buscado) podría ordenar el examen equivocado");
      t.falso(liMasLargo._clicado, "un match parcial (más largo, con calificador extra) también podría ordenar el examen equivocado");
    });
    await t.casoAsync("_conductaBuscarYAgregarExamen: el <li> no está en pantalla, false sin clickear nada", async () => {
      const d = mockDocConducta({});
      const ok = await api._conductaBuscarYAgregarExamen("ALBUMINA EN SUERO U OTROS FLUIDOS", d);
      t.falso(ok);
    });
    await t.casoAsync("_conductaBuscarYAgregarExamen: 'Agregar' nunca aparece (o queda deshabilitado), false", async () => {
      const d = mockDocConducta({});
      const li = mockLi("HEMOGLOBINA", () => d._agregarBoton(mockBoton("Agregar", { disabled: true })));
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const ok = await api._conductaBuscarYAgregarExamen("HEMOGLOBINA", d);
      t.falso(ok, "un Agregar deshabilitado no cuenta como disponible");
    });
    await t.casoAsync("_conductaBuscarYAgregarExamen: el cuadro opcional Repetirlo→Confirmar se reconoce y se cierra", async () => {
      const d = mockDocConducta({});
      const btnConfirmar = mockBoton("Confirmar", {});
      const btnRepetir = mockBoton("Repetirlo", { alClick: () => d._agregarBoton(btnConfirmar) });
      const btnAgregar = mockBoton("Agregar", { alClick: () => d._agregarBoton(btnRepetir) });
      const li = mockLi("MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL", () => d._agregarBoton(btnAgregar));
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const ok = await api._conductaBuscarYAgregarExamen("MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL", d);
      t.cierto(ok);
      t.cierto(btnRepetir._clicado && btnConfirmar._clicado, "el cuadro de confirmación, visto en la captura real, se cierra solo");
    });
    await t.casoAsync("_conductaBuscarYAgregarExamen: el cuadro opcional 'Entendido' (sin Repetirlo) también se reconoce", async () => {
      const d = mockDocConducta({});
      const btnEntendido = mockBoton("Entendido", {});
      const btnAgregar = mockBoton("Agregar", { alClick: () => d._agregarBoton(btnEntendido) });
      const li = mockLi("FOSFORO EN SUERO U OTROS FLUIDOS", () => d._agregarBoton(btnAgregar));
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const ok = await api._conductaBuscarYAgregarExamen("FOSFORO EN SUERO U OTROS FLUIDOS", d);
      t.cierto(ok);
      t.cierto(btnEntendido._clicado);
    });
    await t.casoAsync("_conductaBuscarYAgregarExamen: sin ningún cuadro opcional, sigue de largo sin esperarlo a la fuerza", async () => {
      const d = mockDocConducta({});
      const btnAgregar = mockBoton("Agregar", {});
      const li = mockLi("HEMOGLOBINA", () => d._agregarBoton(btnAgregar));
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const ok = await api._conductaBuscarYAgregarExamen("HEMOGLOBINA", d);
      t.cierto(ok, "el gesto se completa igual, sin cuadro de por medio");
    });

    // ---------- v17.42.0 — CRUCE DE PACIENTES en el gesto de ordenar ----------
    // Hallazgo de auditoría adversarial (29-ago). Esta era la ÚNICA cadena de escritura
    // clínica del script sin guarda `_pacienteSigueAbierto` — y es la que hace clics
    // reales sobre el DOM de Everest, con esperas fijas de 700+400(+300) ms entre el
    // clic en el <li> y el clic en "Agregar". En ese hueco el médico puede cerrar la
    // historia y abrir otra: Angular remonta la pantalla, y el segundo
    // `querySelectorAll("button")` —que es de DOCUMENTO COMPLETO— encontraría el
    // "Agregar" del paciente NUEVO y le ordenaría los exámenes del ANTERIOR.
    // El propio código ya llamaba a esto "el riesgo clínico más alto que ha tenido este
    // script" (ver el comentario de _pacienteSigueAbierto) — pero la guarda que se creó
    // para eso nunca se cableó a esta ruta, que nació después (v17.35.0).
    await t.casoAsync("_conductaBuscarYAgregarExamen: si el paciente cambia entre el <li> y 'Agregar', NO clickea Agregar", async () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", []);
      const d = mockDocConducta({});
      const btnAgregar = mockBoton("Agregar", {});
      const li = mockLi("HEMOGLOBINA", () => {
        // Angular monta "Agregar"… y a la vez el médico ya abrió otra historia.
        setTimeout(() => {
          d._agregarBoton(btnAgregar);
          cablearHistoriaConducta(c.env, "5551234567", []);   // ← otro paciente en pantalla
        }, 0);
      });
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const ok = await c.api._conductaBuscarYAgregarExamen("HEMOGLOBINA", d, "1098765432");
      t.falso(ok, "debe abortar: el paciente que pidió la orden ya no está en pantalla");
      t.falso(btnAgregar._clicado, "NUNCA debe clickear 'Agregar' sobre la historia de otro paciente");
    });

    await t.casoAsync("_conductaBuscarYAgregarExamen: sin docId esperado se comporta como siempre (retrocompatible)", async () => {
      const d = mockDocConducta({});
      const li = mockLi("HEMOGLOBINA", () => { setTimeout(() => d._agregarBoton(mockBoton("Agregar", {})), 0); });
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const ok = await api._conductaBuscarYAgregarExamen("HEMOGLOBINA", d);
      t.cierto(ok, "los llamadores que no pasan docId siguen funcionando igual que antes");
    });

    await t.casoAsync("mtrConductaAgregarPendientes: propaga el docId a cada búsqueda — el cruce se corta en el orquestador", async () => {
      const c = cargar({ silencioso: true });
      cablearHistoriaConducta(c.env, "1098765432", []);
      const tabla = mockTabla([]);
      const d = mockDocConducta({ tabla });
      const btnAgregar = mockBoton("Agregar", {});
      const li = mockLi("HEMOGLOBINA", () => {
        setTimeout(() => { d._agregarBoton(btnAgregar); cablearHistoriaConducta(c.env, "5551234567", []); }, 0);
      });
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);
      const r = await c.api.mtrConductaAgregarPendientes(
        { paquete: [], individuales: [{ clave: "HB", nombre: "Hemoglobina", liTextos: ["HEMOGLOBINA"] }] },
        d, "1098765432"
      );
      t.igual(r.agregados.length, 0, "nada se da por agregado si el paciente cambió a mitad del gesto");
      t.falso(btnAgregar._clicado, "y no se clickeó nada en la historia del paciente nuevo");
    });

    // ---------- mtrConductaAgregarPendientes (orquestador) ----------
    await t.casoAsync("mtrConductaAgregarPendientes: nada pendiente, no toca el DOM en absoluto", async () => {
      const d = { querySelectorAll() { throw new Error("no debía llamarse"); } };
      const r = await api.mtrConductaAgregarPendientes({ paquete: [], individuales: [] }, d);
      t.igual(r.agregados.length, 0); t.igual(r.fallidos.length, 0);
    });
    await t.casoAsync("mtrConductaAgregarPendientes: paquete + individual juntos, verificado leyendo la tabla — no por asumir que el clic funcionó", async () => {
      const tabla = mockTabla([]);
      const d = mockDocConducta({ tabla });
      const bPaquetes = mockBoton("Paquetes", {
        alClick: () => setTimeout(() => {
          d._agregarBoton(mockBoton("HTA", {
            alClick: () => setTimeout(() => { tabla._agregarFila("903818"); tabla._agregarFila("903895"); }, 0),
          }));
        }, 0),
      });
      d._agregarBoton(bPaquetes);
      const btnAgregar = mockBoton("Agregar", { alClick: () => setTimeout(() => tabla._agregarFila("903890"), 0) });
      const li = mockLi("HORMONA PARATIROIDEA MOLECULA INTACTA", () => d._agregarBoton(btnAgregar));
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);

      const items = { paquete: [{ clave: "CREATININA", nombre: "Creatinina" }], individuales: [{ clave: "PTH", nombre: "PTH", liTextos: ["HORMONA PARATIROIDEA MOLECULA INTACTA"] }] };
      const r = await api.mtrConductaAgregarPendientes(items, d);
      t.cierto(r.agregados.indexOf("CREATININA") >= 0, "el paquete se disparó y se vieron filas nuevas");
      t.cierto(r.agregados.indexOf("PTH") >= 0, "el individual se agregó y se verificó en la tabla");
      t.igual(r.fallidos.length, 0);
    });
    await t.casoAsync("mtrConductaAgregarPendientes: si el paquete no logra disparar (sin 'Paquetes'), esas claves quedan fallidas — pero los individuales siguen su propio camino", async () => {
      const tabla = mockTabla([]);
      const d = mockDocConducta({ tabla });   // sin botón "Paquetes"
      const btnAgregar = mockBoton("Agregar", { alClick: () => setTimeout(() => tabla._agregarFila("902213"), 0) });
      const li = mockLi("HEMOGLOBINA", () => d._agregarBoton(btnAgregar));
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);

      const items = { paquete: [{ clave: "GLUCOSA", nombre: "Glicemia" }], individuales: [{ clave: "HEMOGLOBINA", nombre: "Hemoglobina", liTextos: ["HEMOGLOBINA"] }] };
      const r = await api.mtrConductaAgregarPendientes(items, d);
      t.cierto(r.fallidos.some((f) => f.clave === "GLUCOSA"), "sin Paquetes, el grupo del paquete no se puede confirmar");
      t.cierto(r.agregados.indexOf("HEMOGLOBINA") >= 0, "el individual no depende del paquete");
    });
    await t.casoAsync("mtrConductaAgregarPendientes: un individual que no se encuentra en pantalla queda fallido, sin detener a los demás", async () => {
      const tabla = mockTabla([]);
      const d = mockDocConducta({ tabla, lis: [] });   // ningún <li> disponible
      const items = { paquete: [], individuales: [
        { clave: "ALBUMINA", nombre: "Albúmina", liTextos: ["ALBUMINA EN SUERO U OTROS FLUIDOS"] },
        { clave: "FOSFORO", nombre: "Fósforo", liTextos: ["FOSFORO EN SUERO U OTROS FLUIDOS"] },
      ] };
      const r = await api.mtrConductaAgregarPendientes(items, d);
      t.igual(r.agregados.length, 0);
      t.igual(r.fallidos.length, 2, "los dos quedan fallidos, cada uno registrado — ninguno bloquea al otro");
    });

    // Distinto del caso de arriba: aquí el <li> SÍ existe y el clic SÍ se dispara, pero la
    // fila nunca aparece en la tabla — nunca se debe dar por agregado un clic que no se
    // verificó de verdad.
    await t.casoAsync("mtrConductaAgregarPendientes: el clic se dispara pero ninguna fila nueva aparece — queda fallido, nunca se asume que sirvió", async () => {
      const tabla = mockTabla([]);
      const d = mockDocConducta({ tabla });
      const btnAgregar = mockBoton("Agregar", {});   // clic real, pero no toca la tabla
      const li = mockLi("HEMOGLOBINA", () => d._agregarBoton(btnAgregar));
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [li] : base(sel)))(d.querySelectorAll);

      const items = { paquete: [], individuales: [{ clave: "HEMOGLOBINA", nombre: "Hemoglobina", liTextos: ["HEMOGLOBINA"] }] };
      const r = await api.mtrConductaAgregarPendientes(items, d);
      t.cierto(li._clicado && btnAgregar._clicado, "el gesto sí se disparó de punta a punta");
      t.igual(r.agregados.length, 0, "pero sin fila nueva en la tabla, no cuenta como agregado");
      t.cierto(r.fallidos.some((f) => f.clave === "HEMOGLOBINA"));
    });

    // v17.36.0 — la RAC exige sus DOS búsquedas: si una tiene éxito y la otra no, la clave
    // entera queda fallida ("no se pide media RAC") — nunca se cuenta como agregada con
    // solo un componente en la tabla.
    await t.casoAsync("mtrConductaAgregarPendientes: RAC con sus DOS búsquedas exitosas cuenta como agregada — nunca dispara el paquete", async () => {
      const tabla = mockTabla([]);
      const d = mockDocConducta({ tabla });   // sin botón "Paquetes": si algo lo necesitara, fallaría
      // Cada "Agregar" se deshabilita a sí mismo tras su propio clic: sin esto, la segunda
      // búsqueda encontraría el "Agregar" ya usado de la primera (mismo `document`, mismo
      // botón nunca se quita) en vez del suyo propio — igual que un botón real deshabilitado
      // tras usarse una vez.
      const liMicro = mockLi("MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL", () => {
        let btn; btn = mockBoton("Agregar", { alClick: () => { btn.disabled = true; setTimeout(() => tabla._agregarFila("903026"), 0); } });
        d._agregarBoton(btn);
      });
      const liCreatOrina = mockLi("CREATININA EN ORINA PARCIAL", () => {
        let btn; btn = mockBoton("Agregar", { alClick: () => { btn.disabled = true; setTimeout(() => tabla._agregarFila("903876"), 0); } });
        d._agregarBoton(btn);
      });
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [liMicro, liCreatOrina] : base(sel)))(d.querySelectorAll);

      const items = { paquete: [], individuales: [{ clave: "RAC", nombre: "RAC", liTextos: ["MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL", "CREATININA EN ORINA PARCIAL"] }] };
      const r = await api.mtrConductaAgregarPendientes(items, d);
      t.cierto(r.agregados.indexOf("RAC") >= 0, "las dos búsquedas se vieron en la tabla");
      t.igual(r.fallidos.length, 0);
    });
    await t.casoAsync("mtrConductaAgregarPendientes: RAC con solo UNA de sus dos búsquedas exitosas queda fallida entera — no se pide media RAC", async () => {
      const tabla = mockTabla([]);
      const d = mockDocConducta({ tabla });
      const liMicro = mockLi("MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL", () => {
        d._agregarBoton(mockBoton("Agregar", { alClick: () => setTimeout(() => tabla._agregarFila("903026"), 0) }));
      });
      // "CREATININA EN ORINA PARCIAL" no está en pantalla: su búsqueda falla.
      d.querySelectorAll = ((base) => (sel) => (sel === "li" ? [liMicro] : base(sel)))(d.querySelectorAll);

      const items = { paquete: [], individuales: [{ clave: "RAC", nombre: "RAC", liTextos: ["MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL", "CREATININA EN ORINA PARCIAL"] }] };
      const r = await api.mtrConductaAgregarPendientes(items, d);
      t.igual(r.agregados.length, 0, "una sola de las dos búsquedas no basta");
      t.cierto(r.fallidos.some((f) => f.clave === "RAC"));
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
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
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
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
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
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_AL_DIA);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el && el.style.display !== "none");
    });

    t.caso("mtrWidgetOrdenarConductaTick: sin botón 'Paquetes' visible, el botón nuevo también se oculta — mismo ancla, misma regla", () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
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
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
      const historialDeOtroRenglon = { textContent: "Historial", offsetParent: {}, getBoundingClientRect: () => ({ left: 10, top: 500, width: 70, height: 30, right: 80 }) };
      cablearHistoriaConducta(c.env, "1098765432", [historialDeOtroRenglon, boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el && el.style.display !== "none");
    });

    t.caso("mtrWidgetOrdenarConductaTick: ya ordenado hoy — botón deshabilitado, dice «Agregado hoy», sigue visible (no desaparece sin más)", () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.markOrdenLabsConductaHoy("1098765432", ["CREATININA"]);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.cierto(!!el && el.style.display !== "none", "sigue visible — confirma que el clic surtió efecto, en vez de desaparecer sin decir nada (Regla D)");
      t.cierto(el.disabled, "ya no se puede volver a ordenar hoy");
      t.cierto(el.textContent.indexOf("Agregado") >= 0);
    });

    t.caso("mtrWidgetOrdenarConductaTick: cambiar de paciente reinicia el estado interno", () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
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
    // v17.37.0 — desde que "Paquetes → HTA" se retiró por completo (agregaba siempre un
    // hemograma no permitido), RESUMEN_ORDENAR_BOTON solo trae analitos individuales (PTH +
    // HBA1C): el botón "Paquetes" del ancla ya NUNCA se clickea, solo sirve para que
    // mtrAnclaOrdenarPendientes calcule dónde centrar el botón nuevo — de ahí que baste con
    // el `boton()` normal de esta suite (sin `rect`/`alClick` especiales).
    await t.casoAsync("Integración: un clic en el botón agrega de verdad en la tabla de Conducta y lo deja marcado — solo búsquedas individuales, nunca dispara Paquetes", async () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
      const tabla = mockTabla([]);
      const botones = [botonHistorial(), boton("Paquetes")];
      const liPth = mockLi("HORMONA PARATIROIDEA MOLECULA INTACTA", () => {
        botones.push(mockBoton("Agregar", { alClick: () => setTimeout(() => tabla._agregarFila("903840"), 0) }));
      });
      const liHba1c = mockLi("HEMOGLOBINA GLICOSILADA AUTOMATIZADA", () => {
        botones.push(mockBoton("Agregar", { alClick: () => setTimeout(() => tabla._agregarFila("903890"), 0) }));
      });
      cablearHistoriaConducta(c.env, "1098765432", botones, [], { tabla, lis: [liPth, liHba1c] });
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.falso(el.disabled, "antes del clic, clicable");

      const clicListo = el.onclick({ stopPropagation() {} });
      await clicListo;   // _cwoClic es async; el propio onclick devuelve su promesa

      t.cierto(liPth._clicado && liHba1c._clicado, "de verdad buscó y clickeó los dos exámenes individuales");
      t.cierto(c.api.isOrdenLabsConductaHoy("1098765432"), "las filas nuevas se vieron en la tabla y quedó marcado");
      t.falso(el.disabled === false, "tras el repintado que dispara el propio clic, ya no se puede volver a hacer clic");
      t.cierto(el.textContent.indexOf("Agregado") >= 0);
    });

    // v17.35.0 — dos clics rápidos (doble-clic real, o un dedo lento sobre un trackpad)
    // antes de que termine el primero NO deben disparar DOS veces el gesto real sobre el
    // mismo <li>/botón — eso agregaría el mismo examen dos veces. `_cwoEnCurso` es la
    // única barrera (ver comentario junto a su declaración): el segundo clic debe
    // devolver sin tocar nada mientras el primero sigue en vuelo.
    await t.casoAsync("Integración: dos clics antes de que termine el primero solo disparan UNA vez la búsqueda real", async () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
      const tabla = mockTabla([]);
      const botones = [botonHistorial(), boton("Paquetes")];
      const liPth = mockLi("HORMONA PARATIROIDEA MOLECULA INTACTA", () => {
        botones.push(mockBoton("Agregar", { alClick: () => setTimeout(() => tabla._agregarFila("903840"), 0) }));
      });
      const liHba1c = mockLi("HEMOGLOBINA GLICOSILADA AUTOMATIZADA", () => {
        botones.push(mockBoton("Agregar", { alClick: () => setTimeout(() => tabla._agregarFila("903890"), 0) }));
      });
      cablearHistoriaConducta(c.env, "1098765432", botones, [], { tabla, lis: [liPth, liHba1c] });
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      const p1 = el.onclick({ stopPropagation() {} });
      // El primer clic ya está en vuelo (el <li> de PTH ya se clickeó, esperando a que
      // Angular monte "Agregar") cuando llega el segundo — la misma ventana en la que un
      // médico real podría volver a pulsar mientras la pantalla tarda en reaccionar.
      const p2 = el.onclick({ stopPropagation() {} });
      await Promise.all([p1, p2]);
      t.igual(liPth._clics, 1, "el segundo clic, mientras el primero seguía en vuelo, no debía repetir el gesto");
    });

    await t.casoAsync("Integración: si no se encuentra nada que clickear, el botón queda disponible para reintentar — nunca bloqueado por un fallo", async () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
      // Sin ningún <li> de los exámenes individuales: el gesto real no encuentra nada que
      // hacer, tal como pasaría si Everest cambiara su pantalla.
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")], [], { tabla: mockTabla([]), lis: [] });
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      await el.onclick({ stopPropagation() {} });
      t.falso(c.api.isOrdenLabsConductaHoy("1098765432"), "un fallo total no se marca como hecho");
      t.falso(el.disabled, "queda disponible para que el médico reintente");
      t.cierto(el.textContent.indexOf("pendientes") >= 0, "vuelve a invitar a ordenar, no se queda en «Agregando...»");
    });

    // =====================================================================
    //  v17.38.0 — CORRECCIÓN DEL MÉDICO sobre v17.37.0: "no te pedí que siguiera el
    //  scroll, te pedí que sea un botón estático". Se retiró el reposicionado por JS
    //  (_cwReposicionarEnScroll/_cwInstalarEscuchaScroll) y se cambió `position:fixed`
    //  (coordenadas de ventana) por `position:absolute` (coordenadas de página): el
    //  navegador mueve el widget solo con el scroll normal, sin ningún JS de por medio.
    //  Esta prueba fija que el desplazamiento de scroll SÍ se suma a la posición.
    // =====================================================================
    t.caso("mtrWidgetOrdenarConductaTick: con la página desplazada, la posición usa coordenadas absolutas — no solo lo visible", () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();   // v18.0.7 — el botón «Ordenar pendientes» quedó oculto al usuario final (encargo del médico, 31-ago): vive tras el modo programador.
      c.env.win.pageXOffset = 50;
      c.env.win.pageYOffset = 300;
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.igual(el.style.position, "absolute", "coordenadas de página, no de ventana — así el navegador lo mueve solo con el scroll");
      const rH = botonHistorial().getBoundingClientRect();
      const rP = boton("Paquetes").getBoundingClientRect();
      const centroEsperado = Math.round((rH.left + rP.right) / 2 + 50);
      const topEsperado = Math.round(Math.max(rH.bottom, rP.bottom) + 8 + 300);
      t.igual(el.style.left, centroEsperado + "px", "el desplazamiento horizontal de la página se suma a la posición");
      t.igual(el.style.top, topEsperado + "px", "el desplazamiento vertical de la página se suma a la posición");
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
      const bloque = src.slice(iHistoria, iHistoria + 1800);
      // v17.43.0 — los tres pasaron de `mtrWidgetXTick()` a
      // `_rumTramo("tick.widget.x", mtrWidgetXTick)` para poder cronometrarlos. La
      // INTENCIÓN de esta prueba no cambia ni un ápice —el defecto que existe para evitar
      // es que un widget se escriba, se pruebe y NUNCA se enganche al tick, que ya pasó
      // tres veces— así que se comprueba que el nombre aparezca en la rama, envuelto o no.
      // Se busca el nombre SIN paréntesis a propósito: pasarlo como referencia a _rumTramo
      // es una forma tan válida de engancharlo como llamarlo directamente, y atarse a la
      // sintaxis exacta haría que esta prueba se rompiera en cada refactor inocente.
      const enganchado = (nombre) =>
        bloque.indexOf(nombre + "()") >= 0 || bloque.indexOf(", " + nombre + ")") >= 0;
      t.cierto(enganchado("mtrWidgetConductaTick"),
        "mtrWidgetConductaTick debe engancharse dentro de la rama de historia — si esto falla, el widget de exámenes volvió a quedar sin pintar en consulta real");
      t.cierto(enganchado("mtrWidgetFarmacoTick"),
        "mtrWidgetFarmacoTick debe engancharse dentro de la rama de historia — el widget de farmacia, igual que su hermano, no sirve de nada si solo vive en el banco de pruebas");
      // v17.32.0 — el mismo defecto, una tercera vez, es el que esta prueba existe para
      // evitar: el botón "Ordenar pendientes" no sirve de nada si solo vive en el banco.
      t.cierto(enganchado("mtrWidgetOrdenarConductaTick"),
        "mtrWidgetOrdenarConductaTick debe engancharse dentro de la rama de historia — si esto falla, el botón de ordenar nunca se pinta en consulta real");
    });

    // =====================================================================
    //  v18.0.7 — EL BOTÓN «ORDENAR PENDIENTES» SE COLABA EN «CITAS DEL DÍA»
    //
    //  REPORTE EN VIVO (31-ago, captura): el botón aparecía flotando sobre la lista de
    //  citas del día, debajo de «Consentimientos», con las coordenadas de la pantalla
    //  anterior. Causa: se pinta en document.body con position:absolute y coordenadas de
    //  PÁGINA, y el ÚNICO que lo escondía era su propio tick — que solo corre en la pestaña
    //  Conducta. Al navegar la SPA fuera de la historia, nadie lo retiraba.
    //
    //  Encargo del médico, textual: «oculta ese botón para el usuario final mientras
    //  logramos hacerlo funcionar». No se borra: queda tras el modo programador, que es el
    //  mecanismo que este proyecto ya usa para lo que no debe verse en consulta pero sí
    //  tiene que poder probarse. Y su regla de alcance, también textual: «el Centinela solo
    //  vive en HCHealth y en las historias abiertas de los pacientes, nada más».
    // =====================================================================
    t.caso("v18.0.7: con el modo programador APAGADO el botón no se pinta — es lo que ve el médico en consulta", () => {
      const c = cargar({ silencioso: true });
      // Sin _vglAlternarModoProg(): así arranca toda pestaña real.
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.cierto(!el || el.style.display === "none",
        "ni existe ni queda visible: el usuario final no lo ve hasta que el médico diga otra cosa");
    });

    t.caso("v18.0.7: aunque el modo programador esté encendido, FUERA de una historia abierta el botón se esconde", () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.cierto(!!el && el.style.display !== "none", "dentro de la historia sí está (control del caso)");
      // Ahora la SPA navega a «Citas del día»: ya no hay #anamesis.
      const getByIdConAnamesis = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "anamesis" ? null : getByIdConAnamesis(id));
      c.api.mtrWidgetOrdenarConductaTick();
      t.igual(el.style.display, "none", "al salir de la historia, el candado de ruta lo retira");
    });

    t.caso("v18.0.7: mtrOcultarBotonOrdenarPendientes retira el botón desde CUALQUIER pantalla", () => {
      const c = cargar({ silencioso: true });
      c.api._vglAlternarModoProg();
      cablearHistoriaConducta(c.env, "1098765432", [botonHistorial(), boton("Paquetes")]);
      c.api.__S.conductaWidgets = true;
      c.api.mtrCacheResumenGuardar("1098765432", RESUMEN_ORDENAR_BOTON);
      c.api.mtrWidgetOrdenarConductaTick();
      const el = c.env.doc.getElementById("vgl-cw-ordenar-btn");
      t.cierto(!!el && el.style.display !== "none", "está pintado (control del caso)");
      // Esta es la mitad que faltaba: el tick GENERAL puede retirarlo sin saber nada del
      // widget ni de la pestaña Conducta. Sin ella el botón quedaba huérfano en pantalla.
      c.api.mtrOcultarBotonOrdenarPendientes();
      t.igual(el.style.display, "none", "retirado sin depender del tick del widget");
      t.noLanza(() => { c.env.doc.getElementById("vgl-cw-ordenar-btn").remove(); c.api.mtrOcultarBotonOrdenarPendientes(); },
        "y no revienta si el botón ni siquiera existe");
    });
  },
};
