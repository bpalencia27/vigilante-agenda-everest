// =====================================================================
//  SUITE 59 — Burbujas de información (rediseño UX v14.3.0)
//
//  Petición del médico: sus compañeros encuentran las secciones de
//  ordenamiento, agendamiento, IA y laboratorios poco intuitivas y
//  prefieren las pantallas originales de Everest. Este componente
//  (vglTip + el globo #vgl-tip-pop) es la pieza compartida de la
//  respuesta — un botón "?" que explica cada función sin sobrecargar
//  la pantalla. Aquí se prueba el componente en sí (puro y aislado);
//  su presencia dentro de cada modal se prueba junto al resto de cada
//  modal, en la suite 15 (donde ya vive el arnés de red de cada uno).
//
//  Nota de arnés: los nodos del DOM simulado son circulares (hijo._parent
//  -> padre.children -> hijo), así que nunca se comparan con t.igual (que
//  compara por JSON.stringify) — siempre con t.cierto/t.falso sobre "!!".
// =====================================================================

function resumenDemo() {
  return {
    programa: "HTA",
    factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
    erc: { egfr: 52, estadioClinico: "G3a" },
    riesgo: { categoria: "alto" },
    meta: { metas: { ldl: 70 } },
    _docId: "12345678",
    _pacienteIdLabs: null,
    _ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } },
    _hoyIso: "2026-08-17",
  };
}

// Respuesta con la FORMA real de la API de Gemini (mismo formato que suite_57).
function respGemini(texto) {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] }, finishReason: "STOP" }] });
}

// v17.3.0 — copia LOCAL del parche de suite_15 (no se comparte/exporta desde
// harness.js: cada suite que lo necesita lo repite). El arnés real deja
// querySelector/querySelectorAll de cada elemento SIEMPRE en null/[], y
// mtrAbrirPanelRedaccion arma su modal por innerHTML y luego lee sus propios
// controles con modal.querySelector("#vgl-ia-…") — sin este parche esas
// búsquedas nunca encuentran nada y el panel queda inservible para la prueba.
// Cada elemento nuevo recibe un querySelector memoizado por selector (mismo
// selector -> mismo nodo falso), así que el nodo que lee la producción y el
// que inspecciona la prueba son el mismo objeto.
function enriquecerDom(c) {
  const doc = c.env.doc;
  const crearBase = doc.createElement;
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
}

module.exports = {
  nombre: "Burbujas de información (rediseño UX de los 4 módulos)",
  cubre: ["vglTip", "_vglTipAbrir", "_vglTipCerrar", "_vglTipTeclado", "_vglTipInstalar", "mtrAbrirPanelRedaccion"],

  async pruebas(t, api, env, cargar) {
    t.caso("vglTip: genera un botón '?' con el texto en data-vgl-tip, escapado", () => {
      const html = api.vglTip('Ojo con < > & " esto');
      t.cierto(html.includes('class="vgl-tip-btn"'), "lleva la clase compartida");
      t.cierto(html.includes("&lt; &gt; &amp;"), "escapa &lt;/&gt;/&amp; en el atributo");
      t.cierto(html.includes("&quot;"), "escapa comillas dobles");
      t.cierto(html.includes('aria-haspopup="true"') && html.includes('aria-expanded="false"'), "accesible desde el arranque");
      t.cierto(html.includes('type="button"'), "nunca envía el formulario que lo rodee");
    });

    t.caso("vglTip: texto vacío no rompe nada (sigue siendo un botón válido)", () => {
      t.noLanza(() => api.vglTip(""));
      t.noLanza(() => api.vglTip(null));
    });

    t.caso("_vglTipAbrir + _vglTipCerrar: abre el globo con el texto del botón y lo retira al cerrar", () => {
      const doc = env.doc;
      const btn = doc.createElement("button");
      btn.setAttribute("data-vgl-tip", "Texto de la burbuja");
      doc.body.appendChild(btn);

      t.falso(!!doc.getElementById("vgl-tip-pop"), "arranca sin ningún globo abierto");
      api._vglTipAbrir(btn);
      const pop = doc.getElementById("vgl-tip-pop");
      t.cierto(!!pop, "el globo quedó en el body");
      t.igual(pop.textContent, "Texto de la burbuja", "usa el texto del botón, no HTML inyectado");
      t.igual(pop.getAttribute("role"), "tooltip");
      t.igual(btn.getAttribute("aria-expanded"), "true", "el botón dueño queda marcado expandido");

      api._vglTipCerrar();
      t.falso(!!doc.getElementById("vgl-tip-pop"), "se retira del body al cerrar");
      t.igual(btn.getAttribute("aria-expanded"), "false", "y el botón vuelve a 'no expandido'");
    });

    t.caso("_vglTipAbrir: un botón sin data-vgl-tip no abre ningún globo", () => {
      const doc = env.doc;
      const btn = doc.createElement("button");
      doc.body.appendChild(btn);
      api._vglTipAbrir(btn);
      t.falso(!!doc.getElementById("vgl-tip-pop"), "sin texto, no hay nada que mostrar");
    });

    t.caso("_vglTipCerrar: cerrar sin nada abierto no lanza", () => {
      t.noLanza(() => api._vglTipCerrar());
      t.noLanza(() => api._vglTipCerrar());
    });

    t.caso("_vglTipTeclado: Escape cierra el globo abierto y detiene la propagación (no cierra también el modal de debajo)", () => {
      const doc = env.doc;
      const btn = doc.createElement("button");
      btn.setAttribute("data-vgl-tip", "algo");
      doc.body.appendChild(btn);
      api._vglTipAbrir(btn);

      let detenido = false;
      api._vglTipTeclado({ key: "Escape", stopPropagation: () => { detenido = true; } });
      t.falso(!!doc.getElementById("vgl-tip-pop"), "Escape cerró el globo");
      t.cierto(detenido, "y no dejó pasar el Escape al modal de debajo");
    });

    t.caso("_vglTipTeclado: Escape sin ningún globo abierto no detiene nada (el modal de debajo sí se cierra)", () => {
      const doc = env.doc;
      t.falso(!!doc.getElementById("vgl-tip-pop"), "punto de partida: nada abierto (lo deja limpio el caso anterior)");
      let detenido = false;
      api._vglTipTeclado({ key: "Escape", stopPropagation: () => { detenido = true; } });
      t.falso(detenido, "no había nada que cerrar aquí, así que el Escape sigue su curso normal");
    });

    t.caso("_vglTipInstalar: es idempotente (llamar dos veces no lanza ni vuelve a registrar el delegado)", () => {
      t.noLanza(() => api._vglTipInstalar());
      t.cierto(api._vglTipInstalar._listo === true, "queda marcado como ya instalado tras la primera vez");
      t.noLanza(() => api._vglTipInstalar());   // segunda vez: debe volver de inmediato, sin re-registrar
    });

    // ---------------------------------------------------------------
    // Presencia real dentro del panel de IA — el propio médico pidió
    // "burbujas de información para conocer más a fondo cómo funciona
    // cada funcionalidad": los 4 modos de redacción son justo el caso
    // donde el nombre del botón (p. ej. "Briefing") no dice por sí solo
    // qué produce ni si se puede insertar en la historia o no.
    // ---------------------------------------------------------------
    // v15.6.0 — el panel se reorganizó en DOS filas (casillas de la historia / otros):
    // cada fila lleva su burbuja, y 'Mi estilo' conserva la suya.
    t.caso("mtrAbrirPanelRedaccion: las filas de casillas y 'otros' llevan su burbuja explicando qué hace cada uno", () => {
      const doc = env.doc;
      api.mtrAbrirPanelRedaccion(resumenDemo());
      const modal = doc.getElementById("vgl-ia-modal");
      t.cierto(!!modal, "el panel se abrió");
      const html = modal.innerHTML;
      const nBurbujas = (html.match(/vgl-tip-btn/g) || []).length;
      // v17.6.26 — REPORTE DE CAMPO: se retiró el botón manual "💾 Guardar mi estilo" (el
      // aprendizaje de estilo pasó a ser automático, ver mtrEstiloGuardar): ya no hay una
      // burbuja aparte para él, solo la de las filas de modos.
      t.cierto(nBurbujas >= 2, "al menos una burbuja por fila de modos (encontradas: " + nBurbujas + ")");
      t.cierto(/data-vgl-tip="[^"]*casilla que quiere redactar/.test(html), "la burbuja de casillas explica que el borrador va a ESA casilla y que no se pisa texto");
      // v16.5.0 — la fila «otros» quedó reducida a Preguntar, claramente opcional (decisión del médico).
      t.cierto(/data-vgl-tip="[^"]*duda puntual/.test(html), "la burbuja de Preguntar explica qué hace y que es opcional");
      // v16.5.0 — Motivo salió del módulo (decisión del médico). v16.7.0 — y Ruta
      // Crónicos también («el de ruta crónicos elíminalo», 20-ago): quedan las TRES
      // casillas reales de la historia, y Preguntar como botón aparte (ya verificado).
      ["enfermedad_actual", "analisis_plan", "recomendaciones"].forEach((m) => {
        t.cierto(html.indexOf('data-modo="' + m + '"') >= 0, "botón de casilla presente: " + m);
      });
      t.falso(html.indexOf('data-modo="motivo_consulta"') >= 0, "Motivo ya no está: se eliminó del módulo");
      t.falso(html.indexOf('data-modo="comentarios_cronicos"') >= 0, "Ruta Crónicos ya no está: orden del médico del 20-ago");
      // v17.34.0 — "Generar todo" se retiró (encargo del médico: "casi ni lo uso, más
      // bien estorba"); queda un solo botón de generación.
      t.falso(html.indexOf("Generar todo") >= 0, "el botón de cadena ya no existe");
      // Y el campo de indicaciones del médico existe
      t.cierto(html.indexOf("vgl-ia-indicaciones") >= 0, "el campo 'Indicaciones para este borrador' está en el panel");
    });

    // v17.6.71 — [reportado en consultorio, 26-ago-2026] BUG REAL: este panel nunca
    // anotaba de quién era (a diferencia de #vgl-panel-modal), así que al minimizarlo
    // quedaba con docId=null — invisible para el blindaje contra cruce de pacientes
    // (el aviso al restaurar de v17.0.2 y el descarte automático nuevo de
    // _vglMinDescartarDeOtroPaciente, ver suite 65). Un borrador de Enfermedad
    // Actual/Análisis y Plan minimizado con datos de un paciente podía sobrevivir,
    // sin ninguna protección, mientras el médico ya atendía al siguiente.
    t.caso("mtrAbrirPanelRedaccion: el panel queda marcado con el docId del paciente (resumen._docId), para que el blindaje de minimizado lo reconozca", () => {
      const doc = env.doc;
      api.mtrAbrirPanelRedaccion(resumenDemo());
      const modal = doc.getElementById("vgl-ia-modal");
      t.cierto(!!modal, "el panel se abrió");
      t.igual(modal.dataset.vglDoc, "12345678", "el docId del resumen (resumenDemo()._docId) queda anotado en el panel");
    });

    // ---------------------------------------------------------------
    // v17.3.0 — regresión del choque real de consola (21-ago): "Uncaught (in
    // promise) ReferenceError: _frenoMarcaOk is not defined" en CADA generación
    // exitosa, en los tres modos. La llamada muerta vivía justo DESPUÉS de que
    // el borrador ya había quedado en la salida (salida.value, estado.textContent,
    // habilitarPost ya habían corrido) — así que el médico sí veía el texto, pero
    // la consola quedaba con una promesa rechazada sin capturar en cada clic de
    // "Generar". Esta prueba clickea el botón real (no llama a mtrGeminiRedactar
    // directo) para pasar por la MISMA rama que reventaba, con una respuesta de
    // Gemini simulada en status 200; t.noLanza es la guardia que antes del
    // arreglo habría quedado roja.
    // ---------------------------------------------------------------
    await t.casoAsync("v17.3.0 — Generar (éxito): ya NO revienta con '_frenoMarcaOk is not defined'; el borrador queda en la salida y el estado avisa que está listo", async () => {
      const c = cargar({
        silencioso: true,
        gmxhr: (opts) => { setTimeout(() => opts.onload({ status: 200, responseText: respGemini("Paciente en control, evoluciona satisfactoriamente.") }), 0); },
      });
      enriquecerDom(c);
      // v18.0.131 (barrido por recorridos, hallazgo 2) — Generar ahora exige que el paciente
      // en pantalla siga siendo el dueño del cuadro (_pacienteSigueAbierto, vía
      // extractPacienteAbierto). Mismo mock que ya usa suite_57 para las pruebas de éxito de
      // mtrInsertarEnCasillaModo: sin esto, extractPacienteAbierto() no puede leer ninguna
      // cédula del DOM falso y la guarda nueva (correctamente) se negaría a generar.
      const _getByIdOrig = c.env.doc.getElementById.bind(c.env.doc);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? {} : _getByIdOrig(id));
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 12345678", closest: () => null }] : []);
      c.api.mtrGuardarClaveGemini("X");
      c.api.mtrAbrirPanelRedaccion(resumenDemo());
      const modal = c.env.doc.getElementById("vgl-ia-modal");
      t.cierto(!!modal, "el panel se abrió");
      const btnGen = modal.querySelector("#vgl-ia-generar");
      const salida = modal.querySelector("#vgl-ia-salida");
      const estado = modal.querySelector("#vgl-ia-estado");

      await t.noLanza(async () => { await btnGen._listeners.click[0](); }, "el clic en Generar no debe lanzar (antes del arreglo, la ReferenceError salía sin capturar justo después de insertar el borrador)");

      t.cierto(/satisfactoriamente/.test(salida.value), "el borrador que devolvió Gemini quedó en la salida");
      t.cierto(/Borrador listo/.test(estado.textContent), "y el estado avisa que el borrador está listo para revisar");
    });

    // =====================================================================
    // v18.0.131 (barrido por recorridos, hallazgo 2) — REPORTE DEL BARRIDO: el Redactor IA
    // abierto sobrevive al cambio de paciente; «Generar» leía el documento VIVO (ya el de
    // OTRO paciente) sin comprobar si el paciente en pantalla seguía siendo el dueño del
    // cuadro. Reproducido pulsando el botón real: el cuadro es de 12345678 (resumenDemo),
    // pero en pantalla hay otra historia (999999) cuando se pulsa Generar.
    // =====================================================================
    await t.casoAsync("v18.0.131 (hallazgo 2): Generar se niega si el paciente en pantalla ya no es el dueño del cuadro, sin tocar la red", async () => {
      let redLlamada = false;
      const c = cargar({
        silencioso: true,
        gmxhr: (opts) => { redLlamada = true; setTimeout(() => opts.onload({ status: 200, responseText: respGemini("NO DEBERÍA LLEGAR") }), 0); },
      });
      enriquecerDom(c);
      const _getByIdOrig = c.env.doc.getElementById.bind(c.env.doc);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? {} : _getByIdOrig(id));
      // El cuadro se abre con el paciente 12345678 en pantalla (mismo dueño: resumenDemo()._docId).
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 12345678", closest: () => null }] : []);
      c.api.mtrGuardarClaveGemini("X");
      c.api.mtrAbrirPanelRedaccion(resumenDemo());
      const modal = c.env.doc.getElementById("vgl-ia-modal");
      const btnGen = modal.querySelector("#vgl-ia-generar");
      const estado = modal.querySelector("#vgl-ia-estado");

      // Sin cerrar el cuadro, el médico abre la historia de OTRO paciente.
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 999999", closest: () => null }] : []);

      await t.noLanza(async () => { await btnGen._listeners.click[0](); }, "el clic no debe lanzar");
      t.falso(redLlamada, "no se llamó a Gemini: se frenó antes de tocar la red");
      t.cierto(/otro paciente/.test(estado.textContent), "el estado dice que el cuadro es de otro paciente: " + estado.textContent);
    });
  },
};
