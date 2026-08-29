// =====================================================================
//  SUITE 65 — Minimizar módulos (v16.7.0)
//
//  Orden del médico (20-ago): «que los módulos no solamente tengan botón
//  para cerrar sino también para MINIMIZAR el módulo y NO PERDER lo que
//  ya habías llenado».
//
//  Lo que hay que defender aquí es exactamente esa frase: minimizar NO
//  puede destruir el nodo (si lo destruye, se perdió lo escrito), y la
//  pastilla tiene que devolver el MISMO nodo, no uno nuevo. Por eso casi
//  todos los casos comprueban identidad de objeto (===), no contenido.
//
//  Nota de arnés: los nodos del DOM simulado traen querySelector() que
//  siempre devuelve null, así que los paneles de estas pruebas se arman
//  con un querySelector propio que busca de verdad entre sus hijos. Se
//  prueba la lógica del Vigilante, no la del navegador.
// =====================================================================

// Panel de mentira con la anatomía real de un módulo:
//   <div id=...><div class="vgl-agm-head"><div class="vgl-agm-title">…</div>
//                <button class="vgl-agm-close">✕</button></div></div>
function panelFalso(doc, id, titulo) {
  const panel = doc.createElement("div");
  panel.id = id;
  panel.nodeType = 1;
  const head = doc.createElement("div");
  head.className = "vgl-agm-head";
  const tit = doc.createElement("div");
  tit.className = "vgl-agm-title";
  tit.textContent = titulo == null ? "" : titulo;
  const cerrar = doc.createElement("button");
  cerrar.className = "vgl-agm-close";
  cerrar.textContent = "✕";
  head.appendChild(tit);
  head.appendChild(cerrar);
  panel.appendChild(head);
  // El DOM del arnés no modela parentNode ni el segundo argumento de
  // insertBefore, y el helper usa los dos (API estándar). Se completan
  // aquí para que la prueba mida el orden real de la cabecera.
  head.insertBefore = (nuevo, ref) => {
    const i = head.children.indexOf(ref);
    head.children.splice(i < 0 ? head.children.length : i, 0, nuevo);
    nuevo._parent = head;
    nuevo.parentNode = head;
    return nuevo;
  };
  tit.parentNode = head; cerrar.parentNode = head; head.parentNode = panel;
  // querySelector de verdad, limitado a las clases que usa el helper
  panel.querySelector = (sel) => {
    const clase = String(sel || "").replace(/^\./, "");
    const busca = (nodo) => {
      for (const h of nodo.children || []) {
        const cls = String(h.className || "").split(/\s+/);
        if (cls.indexOf(clase) >= 0) return h;
        const dentro = busca(h);
        if (dentro) return dentro;
      }
      return null;
    };
    return busca(panel);
  };
  panel._head = head;
  panel._cerrar = cerrar;
  return panel;
}

// El body simulado no trae contains(): sin él, vglMinPintarBarra no puede
// enterrar las pastillas huérfanas. Se lo prestamos durante la prueba.
function conContains(doc, fn) {
  const antes = doc.body.contains;
  doc.body.contains = (n) => {
    const busca = (nodo) => (nodo.children || []).some((h) => h === n || busca(h));
    return busca(doc.body);
  };
  try { return fn(); } finally { doc.body.contains = antes; }
}

function limpiar(doc, api) {
  ["vgl-ia-modal", "vgl-riesgo-modal", "vgl-ficha-modal", "vgl-min-bar"].forEach((id) => {
    const n = doc.getElementById(id);
    if (n) n.remove();
  });
  // el mapa de minimizados es privado: se vacía restaurando/descartando
  ["vgl-ia-modal", "vgl-riesgo-modal", "vgl-ficha-modal"].forEach((id) => { try { api.vglMinDescartar(id); } catch (e) {} });
  const bar = doc.getElementById("vgl-min-bar");
  if (bar) bar.remove();
}

module.exports = {
  nombre: "Minimizar módulos sin perder lo llenado (v16.7.0)",
  cubre: [
    "vglMinExcluido", "vglMinTituloDe", "vglMinBarra", "vglMinClic", "vglMinPintarBarra",
    "vglMinimizarPanel", "vglRestaurarPanel", "vglMinDescartar", "vglMinInyectarBoton", "vglMinInstalar",
    "_vglMinDescartarDeOtroPaciente",
  ],

  pruebas(t, api, env) {
    const doc = env.doc;

    // ---------------------------------------------------------------
    // Quién puede minimizarse
    // ---------------------------------------------------------------
    t.caso("vglMinExcluido: solo los paneles del Vigilante, y nunca las alertas de un clic", () => {
      t.falso(api.vglMinExcluido("vgl-ia-modal"), "el panel de Redacción IA sí");
      t.falso(api.vglMinExcluido("vgl-riesgo-modal"), "el de Riesgo también");
      t.falso(api.vglMinExcluido("vgl-agendar-modal"), "y el de Agendar, que es el que más se llena");
      t.cierto(api.vglMinExcluido("vgl-modal"), "bigAlert NO: es una alerta de un clic, no hay nada llenado que perder");
      t.cierto(api.vglMinExcluido("vgl-confirma-modal"), "el reconciliador tampoco: esconder una decisión pendiente es peor que cerrarla");
      t.cierto(api.vglMinExcluido("mat-dialog-0"), "nada de Everest: solo tocamos lo nuestro");
      t.cierto(api.vglMinExcluido(""), "sin id no hay a qué volver");
      t.cierto(api.vglMinExcluido(null), "null no lanza y queda excluido");
      t.cierto(api.vglMinExcluido(undefined), "undefined tampoco lanza");
    });

    // ---------------------------------------------------------------
    // El texto de la pastilla
    // ---------------------------------------------------------------
    t.caso("vglMinTituloDe: la pastilla se llama como el módulo, para reconocerlo sin abrirlo", () => {
      const p = panelFalso(doc, "vgl-ia-modal", "  ✍ Redacción   asistida (IA) ");
      t.igual(api.vglMinTituloDe(p), "✍ Redacción asistida (IA)", "recorta y colapsa espacios");
    });

    t.caso("vglMinTituloDe: títulos larguísimos se cortan con puntos suspensivos (la barra no puede crecer sin fin)", () => {
      const largo = "Panel del paciente con nombre interminable de programa crónico y más cosas";
      const p = panelFalso(doc, "vgl-ficha-modal", largo);
      const r = api.vglMinTituloDe(p);
      t.cierto(r.length <= 40, "no pasa de 40 caracteres (salió " + r.length + ")");
      t.cierto(r.endsWith("…"), "y avisa que está cortado");
    });

    t.caso("vglMinTituloDe: sin título usable cae en un genérico, nunca en 'undefined'", () => {
      const p = panelFalso(doc, "vgl-riesgo-modal", "   ");
      t.igual(api.vglMinTituloDe(p), "Módulo del Vigilante", "título en blanco → genérico");
      t.igual(api.vglMinTituloDe(null), "Módulo del Vigilante", "sin panel tampoco lanza");
      t.igual(api.vglMinTituloDe({}), "Módulo del Vigilante", "un objeto sin querySelector tampoco");
    });

    // ---------------------------------------------------------------
    // La barra
    // ---------------------------------------------------------------
    t.caso("vglMinBarra: crea la barra una sola vez y la reutiliza", () => {
      limpiar(doc, api);
      const b1 = api.vglMinBarra();
      t.cierto(!!b1, "se creó");
      t.igual(b1.id, "vgl-min-bar");
      t.igual(b1.getAttribute("role"), "toolbar", "es una barra de herramientas para lectores de pantalla");
      const b2 = api.vglMinBarra();
      t.cierto(b1 === b2, "la segunda llamada devuelve LA MISMA barra, no una nueva");
      limpiar(doc, api);
    });

    // ---------------------------------------------------------------
    // El corazón: minimizar NO destruye
    // ---------------------------------------------------------------
    t.caso("vglMinimizarPanel: esconde el módulo pero lo deja VIVO en el DOM (lo llenado sigue ahí)", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ia-modal", "✍ Redacción asistida (IA)");
      doc.body.appendChild(p);
      // el médico ya escribió algo
      const area = doc.createElement("textarea");
      area.value = "Paciente con adherencia parcial, refiere tos seca desde hace 3 días.";
      p.appendChild(area);

      t.cierto(api.vglMinimizarPanel(p), "se pudo minimizar");
      t.igual(p.style.display, "none", "el panel se esconde");
      t.igual(p.getAttribute("aria-hidden"), "true", "y sale del árbol de accesibilidad mientras está guardado");
      t.cierto(!!doc.getElementById("vgl-ia-modal"), "PERO SIGUE EN EL DOM: minimizar no es cerrar");
      t.igual(area.value, "Paciente con adherencia parcial, refiere tos seca desde hace 3 días.", "y el texto escrito no se tocó");
      t.igual(p.dataset.vglMin, "1", "queda marcado como minimizado");

      const bar = doc.getElementById("vgl-min-bar");
      t.cierto(!!bar, "apareció la barra");
      t.cierto(bar.innerHTML.indexOf("Redacción asistida") >= 0, "con la pastilla del módulo");
      t.cierto(bar.innerHTML.indexOf('data-min-id="vgl-ia-modal"') >= 0, "y la pastilla sabe a qué panel vuelve");
      t.igual(bar.style.display, "flex", "la barra se muestra cuando hay algo guardado");
      limpiar(doc, api);
    });

    t.caso("vglMinimizarPanel: se niega con los excluidos y con basura", () => {
      limpiar(doc, api);
      const alerta = panelFalso(doc, "vgl-modal", "Aviso");
      doc.body.appendChild(alerta);
      t.falso(api.vglMinimizarPanel(alerta), "una alerta de un clic no se minimiza");
      t.falso(api.vglMinimizarPanel(null), "null no lanza");
      t.falso(api.vglMinimizarPanel({}), "sin id tampoco");
      limpiar(doc, api);
    });

    t.caso("vglRestaurarPanel: devuelve EL MISMO nodo, con todo lo que tenía escrito", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ia-modal", "✍ Redacción asistida (IA)");
      doc.body.appendChild(p);
      const area = doc.createElement("textarea");
      area.value = "borrador a medio revisar";
      p.appendChild(area);

      api.vglMinimizarPanel(p);
      t.cierto(api.vglRestaurarPanel("vgl-ia-modal"), "la pastilla restauró");
      t.cierto(doc.getElementById("vgl-ia-modal") === p, "es EL MISMO objeto, no un panel nuevo");
      t.igual(area.value, "borrador a medio revisar", "y el borrador sigue intacto: esto es lo que pidió el médico");
      t.igual(p.style.display, "", "vuelve al display de su hoja de estilos");
      t.igual(p.getAttribute("aria-hidden"), null, "y vuelve al árbol de accesibilidad");

      const bar = doc.getElementById("vgl-min-bar");
      t.igual(bar.style.display, "none", "sin nada guardado, la barra se esconde sola");
      limpiar(doc, api);
    });

    t.caso("vglRestaurarPanel: conserva un display propio si el módulo tenía uno inline", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-riesgo-modal", "Riesgo");
      p.style.display = "block";
      doc.body.appendChild(p);
      api.vglMinimizarPanel(p);
      t.igual(p.style.display, "none", "mientras está guardado, oculto");
      api.vglRestaurarPanel("vgl-riesgo-modal");
      t.igual(p.style.display, "block", "al volver recupera SU display, no el del CSS");
      limpiar(doc, api);
    });

    t.caso("vglRestaurarPanel: una pastilla huérfana no lanza ni promete lo que no puede cumplir", () => {
      limpiar(doc, api);
      t.falso(api.vglRestaurarPanel("vgl-ia-modal"), "no había nada guardado con ese id");
      t.falso(api.vglRestaurarPanel(null), "null no lanza");
      limpiar(doc, api);
    });

    t.caso("vglRestaurarPanel: si el módulo se reabrió y destruyó el nodo viejo, la pastilla se entierra en vez de abrir la nada", () => {
      limpiar(doc, api);
      conContains(doc, () => {
        const p = panelFalso(doc, "vgl-ia-modal", "✍ Redacción asistida (IA)");
        doc.body.appendChild(p);
        api.vglMinimizarPanel(p);
        p.remove();                                   // esto hace mtrAbrirPanelRedaccion al reabrir
        t.falso(api.vglRestaurarPanel("vgl-ia-modal"), "no restaura un fantasma");
        const bar = doc.getElementById("vgl-min-bar");
        t.igual(bar.style.display, "none", "y la pastilla desaparece: una que no abre nada es peor que ninguna");
      });
      limpiar(doc, api);
    });

    t.caso("vglMinPintarBarra: entierra las pastillas cuyo panel ya no existe", () => {
      limpiar(doc, api);
      conContains(doc, () => {
        const a = panelFalso(doc, "vgl-ia-modal", "Redacción");
        const b = panelFalso(doc, "vgl-riesgo-modal", "Riesgo y exámenes");
        doc.body.appendChild(a); doc.body.appendChild(b);
        api.vglMinimizarPanel(a); api.vglMinimizarPanel(b);
        let bar = doc.getElementById("vgl-min-bar");
        t.igual((bar.innerHTML.match(/vgl-min-pill/g) || []).length, 2, "dos módulos guardados, dos pastillas");
        a.remove();
        bar = api.vglMinPintarBarra();
        t.igual((bar.innerHTML.match(/vgl-min-pill/g) || []).length, 1, "muerto el panel, muerta su pastilla");
        t.cierto(bar.innerHTML.indexOf("Riesgo y exámenes") >= 0, "y la que sí sigue viva se queda");
      });
      limpiar(doc, api);
    });

    t.caso("vglMinPintarBarra: el título va escapado (un título con < > no puede inyectar HTML en la barra)", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ficha-modal", '<img src=x onerror=alert(1)>');
      doc.body.appendChild(p);
      api.vglMinimizarPanel(p);
      const bar = doc.getElementById("vgl-min-bar");
      t.falso(bar.innerHTML.indexOf("<img") >= 0, "no entra la etiqueta cruda");
      t.cierto(bar.innerHTML.indexOf("&lt;img") >= 0, "entra escapada");
      limpiar(doc, api);
    });

    // ---------------------------------------------------------------
    // Descartar de verdad
    // ---------------------------------------------------------------
    t.caso("vglMinDescartar: la ✕ de la pastilla sí destruye el módulo guardado", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ia-modal", "Redacción");
      doc.body.appendChild(p);
      api.vglMinimizarPanel(p);
      t.cierto(api.vglMinDescartar("vgl-ia-modal"), "descartó");
      t.falso(!!doc.getElementById("vgl-ia-modal"), "el panel se fue del DOM");
      const bar = doc.getElementById("vgl-min-bar");
      t.igual(bar.style.display, "none", "y la barra se vacía");
      t.cierto(api.vglMinDescartar("vgl-ia-modal"), "descartar dos veces no lanza");
      t.cierto(api.vglMinDescartar(null), "ni con null");
      limpiar(doc, api);
    });

    // ---------------------------------------------------------------
    // v17.6.71 — [reportado en consultorio, 26-ago-2026] BLINDAJE CONTRA CRUCE DE
    // PACIENTES: un panel minimizado con datos de UN paciente (el redactor IA, con un
    // borrador de Enfermedad Actual/Análisis y Plan) sobrevivía aunque el médico cerrara
    // esa historia o abriera la de otro paciente. Ahora se DESCARTA (no solo se oculta)
    // en cuanto el paciente abierto deja de ser el dueño del panel.
    // ---------------------------------------------------------------
    t.caso("_vglMinDescartarDeOtroPaciente: al cambiar de paciente, descarta (borra del DOM) el panel minimizado del paciente ANTERIOR", () => {
      limpiar(doc, api);
      conContains(doc, () => {
        const p = panelFalso(doc, "vgl-ia-modal", "✍ Redacción asistida (IA)");
        doc.body.appendChild(p);
        api.vglMinimizarPanel(p, "PACIENTE-A");
        t.cierto(!!doc.getElementById("vgl-ia-modal"), "minimizado, sigue en el DOM");

        api._vglMinDescartarDeOtroPaciente("PACIENTE-B");   // el médico abrió otra historia

        t.falso(!!doc.getElementById("vgl-ia-modal"), "el panel del paciente A se DESCARTA del DOM, no solo se esconde");
        const bar = doc.getElementById("vgl-min-bar");
        t.igual(bar.style.display, "none", "y su pastilla desaparece de la barra");
      });
      limpiar(doc, api);
    });

    t.caso("_vglMinDescartarDeOtroPaciente: si el médico cierra la historia (ningún paciente abierto), también descarta", () => {
      limpiar(doc, api);
      conContains(doc, () => {
        const p = panelFalso(doc, "vgl-ia-modal", "✍ Redacción asistida (IA)");
        doc.body.appendChild(p);
        api.vglMinimizarPanel(p, "PACIENTE-A");

        api._vglMinDescartarDeOtroPaciente("");   // navegó a "Citas del día": extractPacienteAbierto() da ""

        t.falso(!!doc.getElementById("vgl-ia-modal"), "sin paciente abierto, el panel de A ya no puede quedarse");
      });
      limpiar(doc, api);
    });

    t.caso("_vglMinDescartarDeOtroPaciente: si vuelve a abrirse el MISMO paciente dueño del panel, NO se descarta (sigue disponible su borrador)", () => {
      limpiar(doc, api);
      conContains(doc, () => {
        const p = panelFalso(doc, "vgl-ia-modal", "✍ Redacción asistida (IA)");
        doc.body.appendChild(p);
        api.vglMinimizarPanel(p, "PACIENTE-A");

        api._vglMinDescartarDeOtroPaciente("PACIENTE-A");   // sigue siendo el mismo paciente

        t.cierto(!!doc.getElementById("vgl-ia-modal"), "el panel del propio dueño sobrevive: el médico puede seguir su borrador");
        t.cierto(api.vglRestaurarPanel("vgl-ia-modal"), "y todavía se puede restaurar con normalidad");
      });
      limpiar(doc, api);
    });

    t.caso("_vglMinDescartarDeOtroPaciente: un panel SIN docId propio (dueño desconocido) nunca se descarta por esta vía — solo se borra lo que se sabe con certeza que es de otro paciente", () => {
      limpiar(doc, api);
      conContains(doc, () => {
        const p = panelFalso(doc, "vgl-ia-modal", "✍ Redacción asistida (IA)");
        doc.body.appendChild(p);
        api.vglMinimizarPanel(p);   // sin segundo argumento: docId desconocido

        api._vglMinDescartarDeOtroPaciente("PACIENTE-B");

        t.cierto(!!doc.getElementById("vgl-ia-modal"), "sin dueño confirmado, no se toca (evita falsos positivos)");
      });
      limpiar(doc, api);
    });

    t.caso("_vglMinDescartarDeOtroPaciente: con dos paneles minimizados de pacientes distintos, solo se descarta el que NO es el actual", () => {
      limpiar(doc, api);
      conContains(doc, () => {
        const pA = panelFalso(doc, "vgl-ia-modal", "Redacción");
        const pB = panelFalso(doc, "vgl-riesgo-modal", "Riesgo y exámenes");
        doc.body.appendChild(pA); doc.body.appendChild(pB);
        api.vglMinimizarPanel(pA, "PACIENTE-A");
        api.vglMinimizarPanel(pB, "PACIENTE-B");

        api._vglMinDescartarDeOtroPaciente("PACIENTE-B");   // el médico está viendo a B ahora

        t.falso(!!doc.getElementById("vgl-ia-modal"), "el de A (ya no es el paciente en pantalla) se descarta");
        t.cierto(!!doc.getElementById("vgl-riesgo-modal"), "el de B (el paciente actual) se queda");
      });
      limpiar(doc, api);
    });

    t.caso("_vglMinDescartarDeOtroPaciente: sin nada minimizado, o con argumentos raros, nunca lanza", () => {
      limpiar(doc, api);
      t.noLanza(() => api._vglMinDescartarDeOtroPaciente(), "sin argumento");
      t.noLanza(() => api._vglMinDescartarDeOtroPaciente(null), "null");
      t.noLanza(() => api._vglMinDescartarDeOtroPaciente(""), "cadena vacía sin nada minimizado");
      limpiar(doc, api);
    });

    // ---------------------------------------------------------------
    // El delegado de clics de la barra
    // ---------------------------------------------------------------
    t.caso("vglMinClic: el cuerpo de la pastilla restaura y la ✕ descarta (y no se confunden)", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ia-modal", "Redacción");
      doc.body.appendChild(p);
      api.vglMinimizarPanel(p);

      const evento = (attr, valor) => {
        let parado = false;
        const target = {
          closest: (sel) => (sel === "[" + attr + "]" ? { getAttribute: () => valor } : null),
        };
        return { e: { target, preventDefault() {}, stopPropagation() { parado = true; } }, parado: () => parado };
      };

      const ev1 = evento("data-min-id", "vgl-ia-modal");
      api.vglMinClic(ev1.e);
      t.igual(p.style.display, "", "clic en el cuerpo → el módulo vuelve");
      t.cierto(ev1.parado(), "y el clic no sigue hacia Everest");

      api.vglMinimizarPanel(p);
      const ev2 = evento("data-min-cerrar", "vgl-ia-modal");
      api.vglMinClic(ev2.e);
      t.falso(!!doc.getElementById("vgl-ia-modal"), "clic en la ✕ → se descarta de verdad");

      t.noLanza(() => api.vglMinClic(null), "sin evento no lanza");
      t.noLanza(() => api.vglMinClic({ target: {} }), "un target sin closest tampoco");
      limpiar(doc, api);
    });

    // ---------------------------------------------------------------
    // La inyección del botón «—»
    // ---------------------------------------------------------------
    t.caso("vglMinInyectarBoton: mete el «—» ANTES de la ✕ en la cabecera del módulo", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ia-modal", "Redacción");
      doc.body.appendChild(p);
      t.cierto(api.vglMinInyectarBoton(p), "inyectó");
      const min = p.querySelector(".vgl-agm-min");
      t.cierto(!!min, "el botón existe");
      t.igual(min.textContent, "—", "es un guion, no una ✕ más");
      t.cierto(String(min.className).indexOf("vgl-agm-close") >= 0, "reusa la clase de cerrar para heredar tamaño de toque");
      t.cierto(String(min.getAttribute("aria-label")).indexOf("perder") >= 0, "y dice qué hace: minimizar sin perder");
      t.cierto(p._head.children.indexOf(min) < p._head.children.indexOf(p._cerrar), "va a la IZQUIERDA de la ✕: cerrar sigue siendo el último");
      limpiar(doc, api);
    });

    t.caso("vglMinInyectarBoton: nunca duplica el botón aunque el observer vea el panel dos veces", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ia-modal", "Redacción");
      doc.body.appendChild(p);
      api.vglMinInyectarBoton(p);
      t.falso(api.vglMinInyectarBoton(p), "la segunda vez se abstiene");
      t.igual((p._head.children || []).filter((h) => String(h.className).indexOf("vgl-agm-min") >= 0).length, 1, "hay exactamente un «—»");
      limpiar(doc, api);
    });

    t.caso("vglMinInyectarBoton: se abstiene con lo ajeno, lo excluido y lo que no tiene cabecera", () => {
      limpiar(doc, api);
      const ajeno = panelFalso(doc, "mat-dialog-3", "Diálogo de Everest");
      t.falso(api.vglMinInyectarBoton(ajeno), "nada de Everest");
      const alerta = panelFalso(doc, "vgl-modal", "Aviso");
      t.falso(api.vglMinInyectarBoton(alerta), "ni las alertas de un clic");
      const sinCabeza = doc.createElement("div");
      sinCabeza.id = "vgl-ia-modal"; sinCabeza.nodeType = 1;
      t.falso(api.vglMinInyectarBoton(sinCabeza), "sin .vgl-agm-close no hay dónde ponerlo");
      t.falso(api.vglMinInyectarBoton(null), "null no lanza");
      t.falso(api.vglMinInyectarBoton({ nodeType: 3 }), "un nodo de texto tampoco");
      limpiar(doc, api);
    });

    t.caso("el botón «—» minimiza de verdad al pulsarlo (el cableado completo)", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-ia-modal", "Redacción");
      doc.body.appendChild(p);
      api.vglMinInyectarBoton(p);
      const min = p.querySelector(".vgl-agm-min");
      let parado = false;
      (min._listeners.click || []).forEach((f) => f({ preventDefault() {}, stopPropagation() { parado = true; } }));
      t.igual(p.style.display, "none", "el módulo se guardó");
      t.cierto(parado, "y el clic no llegó al fondo oscurecido, que cierra el modal");
      t.cierto(!!doc.getElementById("vgl-ia-modal"), "sigue vivo, que de eso se trata");
      limpiar(doc, api);
    });

    // ---------------------------------------------------------------
    // Instalación
    // ---------------------------------------------------------------
    t.caso("vglMinInstalar: es idempotente y le pone el «—» a los módulos que ya estaban abiertos", () => {
      limpiar(doc, api);
      const p = panelFalso(doc, "vgl-riesgo-modal", "Riesgo y exámenes");
      doc.body.appendChild(p);
      t.cierto(api.vglMinInstalar(), "primera instalación");
      t.cierto(!!p.querySelector(".vgl-agm-min"), "el módulo ya abierto también recibe su botón");
      t.falso(api.vglMinInstalar(), "la segunda vez vuelve de inmediato, sin re-registrar el observer");
      limpiar(doc, api);
    });
  },
};
