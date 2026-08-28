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
// real de Everest, más querySelectorAll("button") para el botón "Paquetes".
function docConducta(botones) {
  return {
    querySelector(sel) {
      const s = String(sel);
      if (s.indexOf("active") >= 0 || s.indexOf('aria-selected="true"') >= 0) return { id: "conducta", textContent: "Conducta" };
      return null;
    },
    querySelectorAll(sel) {
      if (sel === "button") return botones || [];
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

// Cablea el document (env.doc) de una instancia recién cargada para que
// extractPacienteAbierto()/_vglEnPestana("conducta")/mtrBotonOrdenarConducta
// funcionen sobre una historia clínica simulada, sin tocar nada más del
// arnés (getElementById/querySelectorAll caen al comportamiento real para
// cualquier id/selector que esta prueba no necesite, incluido el propio
// "vgl-cw-examenes" que el widget crea con document.createElement real).
function cablearHistoriaConducta(env, cedula, botonesPaquetes) {
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
    return qsAllReal(sel);
  };
}

module.exports = {
  nombre: "Widget de Conducta: exámenes a ordenar en el próximo control",
  cubre: ["mtrBotonOrdenarConducta", "mtrWidgetExamenesDatos", "mtrWidgetConductaTick", "_cwEstadoParaTest", "_cwResetParaTest"],

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
  },
};
