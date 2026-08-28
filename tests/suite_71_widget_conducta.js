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
  ],

  pruebas(t, api, env, cargar) {
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
    t.caso("REGRESIÓN: los dos widgets de Conducta están enganchados de verdad al tick() de la sección «historia»", () => {
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
    });
  },
};
