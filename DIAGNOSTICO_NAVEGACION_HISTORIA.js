/* ===========================================================================
   DIAGNÓSTICO — CÓMO NAVEGA EVEREST A LA HISTORIA CLÍNICA (para "Atender" real)
   ---------------------------------------------------------------------------
   PARA QUÉ: hoy el botón "Atender" del panel SOLO registra un timestamp en el
   servidor (guardarHoraApertura) — no abre nada. Para que abra la historia de
   verdad hacen falta DOS cosas, y ninguna se puede adivinar sin evidencia:
     1. ¿Cómo navega Everest cuando usted hace clic en su botón nativo
        "Historias Clínicas"? (cambia la URL / usa el router de Angular por
        dentro sin tocar la URL / abre una pestaña nueva / otra cosa)
     2. ¿Se puede simular un clic sobre ESE MISMO botón nativo de forma
        confiable, o hay que reconstruir la navegación a mano?

   Este script observa las DOS cosas a la vez: cualquier clic que usted haga,
   y cualquier cambio de URL/ruta que ocurra después. No hace falta que use
   ningún comando especial — clic normal, con el script corriendo.

   NO MODIFICA NADA. Solo observa. No guarda, no envía, no toca la historia.

   MODO DE USO (2 minutos)
   1. Esté en la Agenda de Everest, con la fila/tarjeta de un paciente visible
      que tenga su botón nativo de "Historias Clínicas".
   2. F12 -> pestaña "Console". Pegue este archivo entero y Enter.
   3. Verá "GRABANDO". Haga clic en el botón nativo "Historias Clínicas" DE
      EVEREST (no el de mi panel) para ese paciente, como siempre.
   4. Espere a que la historia termine de cargar en pantalla.
   5. Escriba en la consola:   VGL_DIAG_NAV_FIN()
   6. Se descargará un archivo .json. Envíelo por el canal de siempre.

   Si de paso hace clic en algo más mientras tanto (otra pestaña, un botón
   dentro de la historia), no pasa nada — todo queda registrado con su propio
   sello de tiempo, así que puedo distinguir cuál clic fue el que abrió la
   historia.
   =========================================================================== */
(function () {
  "use strict";

  if (window.__VGL_DIAG_NAV__) { console.warn("[Diag Nav] Ya estaba corriendo. Escriba VGL_DIAG_NAV_FIN() para terminar."); return; }

  // Mismo saneo anti-PHI que los demás diagnósticos de esta sesión: se conserva
  // la ESTRUCTURA (selector, atributos, jerarquía) y se redacta cualquier VALOR
  // que huela a identidad de paciente.
  const PHI = /nombre|apellido|identificac|document|cedula|c[ée]dula|telefono|tel[ée]fono|celular|correo|email|direccion|direcci[óo]n|nacimiento|acudiente|responsable/i;
  const NUM_LARGO = /\b\d{6,}\b/g;

  function limpiarTexto(s) {
    if (s == null) return s;
    s = String(s);
    if (PHI.test(s)) return "[REDACTADO]";
    s = s.replace(NUM_LARGO, "[NUM]");
    return s.length > 200 ? s.slice(0, 200) + "…[recortado]" : s;
  }

  function limpiarJson(v, prof) {
    prof = prof || 0;
    if (prof > 8) return "[…profundo…]";
    if (v === null || v === undefined) return v;
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "string") return limpiarTexto(v);
    if (Array.isArray(v)) return v.slice(0, 20).map((x) => limpiarJson(x, prof + 1));
    if (typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v)) out[k] = PHI.test(k) ? "[REDACTADO]" : limpiarJson(v[k], prof + 1);
      return out;
    }
    return String(v);
  }

  // Describe un elemento del DOM SIN su texto/atributos identificables: tag,
  // id, clases, y su cadena de ancestros hasta 5 niveles — suficiente para
  // reconstruir un selector CSS estable, sin PHI.
  function describirElemento(el) {
    if (!el || el.nodeType !== 1) return null;
    const cadena = [];
    let n = el, nivel = 0;
    while (n && n.nodeType === 1 && nivel < 6) {
      let pieza = n.tagName.toLowerCase();
      if (n.id) pieza += "#" + n.id;
      if (n.className && typeof n.className === "string" && n.className.trim()) {
        pieza += "." + n.className.trim().split(/\s+/).slice(0, 4).join(".");
      }
      cadena.push(pieza);
      n = n.parentElement;
      nivel++;
    }
    const attrsInteres = {};
    for (const a of ["title", "aria-label", "role", "type", "routerlink", "href", "ng-reflect-router-link"]) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) attrsInteres[a] = limpiarTexto(v);
    }
    return {
      selectorDeAbajoHaciaArriba: cadena,
      atributosDeInteres: attrsInteres,
      textoVisible: limpiarTexto((el.textContent || "").trim().slice(0, 60)),
    };
  }

  const cap = {
    inicio: new Date().toISOString(),
    urlInicial: location.href,
    clics: [],
    cambiosDeUrl: [],
    peticionesDeRed: [],
  };

  // ---- 1. Cualquier clic, en fase de captura (antes de que Angular lo pare) ----
  document.addEventListener("click", (e) => {
    try {
      cap.clics.push({
        t: new Date().toISOString(),
        urlEnEseMomento: location.href,
        elemento: describirElemento(e.target),
      });
      console.log("[Diag Nav] clic registrado en:", (e.target.tagName || "").toLowerCase() + (e.target.id ? "#" + e.target.id : ""));
    } catch (err) {}
  }, true);

  // ---- 2. Cambios de URL/ruta: pushState, replaceState y popstate ----
  const psOrig = history.pushState, rsOrig = history.replaceState;
  function anotarCambioUrl(metodo, args) {
    try {
      cap.cambiosDeUrl.push({ t: new Date().toISOString(), metodo, urlResultante: location.href, estado: limpiarJson(args && args[0]) });
      console.log("[Diag Nav] " + metodo + " -> " + location.href);
    } catch (e) {}
  }
  history.pushState = function (...args) { const r = psOrig.apply(this, args); anotarCambioUrl("pushState", args); return r; };
  history.replaceState = function (...args) { const r = rsOrig.apply(this, args); anotarCambioUrl("replaceState", args); return r; };
  window.addEventListener("popstate", () => anotarCambioUrl("popstate", []));

  // ---- 3. Peticiones de red (fetch + XHR), igual patrón que los otros diagnósticos ----
  const F0 = window.fetch;
  window.fetch = function () {
    const args = arguments;
    const url = args[0] && args[0].url ? args[0].url : args[0];
    return F0.apply(this, args).then((r) => {
      try {
        cap.peticionesDeRed.push({ t: new Date().toISOString(), metodo: "fetch", url: limpiarTexto(String(url || "").split("?")[0]), status: r.status });
      } catch (e) {}
      return r;
    });
  };
  const XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    this.__vglM = m; this.__vglU = u;
    this.addEventListener("load", () => {
      try { cap.peticionesDeRed.push({ t: new Date().toISOString(), metodo: this.__vglM || "XHR", url: limpiarTexto(String(this.__vglU || "").split("?")[0]), status: this.status }); } catch (e) {}
    });
    return XO.apply(this, arguments);
  };

  window.VGL_DIAG_NAV_FIN = function () {
    try {
      window.fetch = F0;
      XMLHttpRequest.prototype.open = XO;
      history.pushState = psOrig;
      history.replaceState = rsOrig;
    } catch (e) {}
    cap.fin = new Date().toISOString();
    cap.urlFinal = location.href;
    cap.tieneAnamesisEnPantalla = !!document.getElementById("anamesis"); // el ancla real que ya usa el script

    const txt = JSON.stringify(cap, null, 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    a.download = "diag_navegacion_historia_" + Date.now() + ".json";
    document.body.appendChild(a); a.click(); a.remove();

    console.log("%c[Diag Nav] LISTO — " + cap.clics.length + " clic(s), " + cap.cambiosDeUrl.length + " cambio(s) de URL, " + cap.peticionesDeRed.length + " petición(es). Archivo descargado.",
      "background:#065f46;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    if (cap.urlInicial === cap.urlFinal && cap.cambiosDeUrl.length === 0) {
      console.warn("[Diag Nav] La URL nunca cambió. Es señal de que Everest navega SIN tocar la URL (todo por dentro del componente Angular) — igual sirve, mirando qué se clicó y qué peticiones salieron.");
    }
    delete window.__VGL_DIAG_NAV__;
    return "Descargado. Revise el archivo y envíelo.";
  };

  window.__VGL_DIAG_NAV__ = true;
  console.log("%c[Diag Nav] GRABANDO. Haga clic en el botón NATIVO \"Historias Clínicas\" de Everest para el paciente, espere a que cargue, y luego escriba:  VGL_DIAG_NAV_FIN()",
    "background:#7c2d12;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
})();
