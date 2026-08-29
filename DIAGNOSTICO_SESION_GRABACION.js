// =====================================================================
//  DIAGNÓSTICO — GRABACIÓN DE SESIÓN EN VIVO — v1 (2026-08-25)
//
//  Para qué: capturar, mientras usted atiende un par de pacientes o más,
//  todo lo que sirva para ver dónde el script se queda corto — sin
//  necesidad de que usted reporte cada bug por separado en caliente.
//  Graba TRES cosas mientras esté activo:
//   1. Todo lo que el script (y Everest) escriben en la consola.
//   2. Cada llamada de red (SharePoint, Athenea, Annar, Citi, Gemini):
//      solo método, ruta SIN datos, código de respuesta y cuánto tardó.
//      NUNCA el cuerpo de la petición ni de la respuesta.
//   3. Errores no atrapados (JS y promesas rechazadas), con su stack.
//
//  Dónde: en la pestaña de EVEREST (medicosviva1a / everestintelligent),
//  con el Vigilante ya cargado. F12 -> Consola -> pegar todo -> Enter.
//  Queda corriendo en segundo plano — siga trabajando normal.
//
//  Cuando termine con los pacientes que quería grabar:
//    vglGrabar.detener()      -> imprime el informe y lo copia al portapapeles
//  Para dejar una nota suya en el momento exacto (sin escribir datos de
//  paciente, solo texto libre suyo):
//    vglGrabar.marcar("aquí el botón de Antecedentes no hizo nada")
//  Para ver cuánto lleva acumulado sin detener la grabación:
//    vglGrabar.estado()
//
//  SOLO LECTURA hacia Everest: no hace clic en nada, no escribe nada, no
//  cambia ningún comportamiento del script. Redacta antes de guardar CUALQUIER
//  cosa: toda tira de 6+ dígitos (cédulas, teléfonos, números de solicitud) se
//  recorta, y las rutas de red solo se guardan sin su query string.
// =====================================================================
(function () {
  if (window.__vglGrabacion && window.__vglGrabacion._activa) {
    console.log("%c[Grabación] Ya hay una grabación en curso desde " + window.__vglGrabacion._desde, "color:#d97706");
    return;
  }

  const MAX_EVENTOS = 4000; // techo duro: no crecer sin límite en una jornada larga
  const buffer = [];
  const inicio = Date.now();
  const desdeIso = new Date(inicio).toISOString();

  // ---------- Redacción: la MISMA disciplina que ya usa Codigo.gs (_sinDigitosLargos) ----------
  function redactar(v) {
    return String(v == null ? "" : v)
      .replace(/https?:\/\/[^\s)]+/g, (u) => { try { return "<url:" + new URL(u).pathname.split("?")[0] + ">"; } catch (e) { return "<url>"; } })
      .replace(/\d{6,}/g, "######")
      .replace(/["'`]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
  }

  // v2 (25-ago, lección de la 1ª grabación real): Everest escupe el MISMO log miles de
  // veces por segundo (isRequired(...) => false llenó 3.870 de los 4.000 eventos y se
  // comió el buffer). Los mensajes idénticos CONSECUTIVOS se colapsan en un contador.
  function empujar(tipo, datos) {
    const ult = buffer[buffer.length - 1];
    if (ult && ult.tipo === tipo && ult.msg !== undefined && datos.msg !== undefined && ult.msg === datos.msg) {
      ult.repetido = (ult.repetido || 1) + 1;
      ult.tUlt = Date.now() - inicio;
      return;
    }
    if (buffer.length >= MAX_EVENTOS) buffer.shift(); // rolling: se conserva lo más reciente
    buffer.push({ t: Date.now() - inicio, tipo, ...datos });
  }

  // ---------- 1. Consola: se envuelve, NUNCA se reemplaza en silencio ----------
  // v3 (25-ago, lección de la 2ª grabación real): Everest escupe el MISMO puñado de logs
  // MILES de veces por segundo (isRequired, "Objeto a validar"), y redactarlos uno a uno
  // convertía la grabación en un devorador de CPU — el médico reportó que apenas podía
  // mover el mouse. Dos defensas ANTES de pagar la redacción:
  //  (a) SPAM CONOCIDO: patrones que se descartan con un indexOf barato y solo se cuentan;
  //  (b) TOPE POR SEGUNDO: pasado el tope, el resto del segundo solo se cuenta.
  const SPAM_PATRONES = ["isRequired(", "Objeto a validar", " Cantidad", "[] errores", "init-scroll:"];
  const spamContadores = {};
  let segActual = 0, capturadosEsteSeg = 0;
  const MAX_POR_SEG = 40;
  const origConsole = {};
  ["log", "warn", "error", "info"].forEach((metodo) => {
    origConsole[metodo] = console[metodo].bind(console);
    console[metodo] = function (...args) {
      try {
        // (a) spam conocido: ni se redacta ni se guarda — solo se cuenta.
        const crudo0 = typeof args[0] === "string" ? args[0] : "";
        for (let i = 0; i < SPAM_PATRONES.length; i++) {
          if (crudo0.indexOf(SPAM_PATRONES[i]) >= 0) {
            spamContadores[SPAM_PATRONES[i]] = (spamContadores[SPAM_PATRONES[i]] || 0) + 1;
            return origConsole[metodo](...args);
          }
        }
        // (b) tope por segundo (los error SIEMPRE pasan: son lo que venimos a cazar).
        const seg = (Date.now() / 1000) | 0;
        if (seg !== segActual) { segActual = seg; capturadosEsteSeg = 0; }
        if (metodo !== "error" && ++capturadosEsteSeg > MAX_POR_SEG) {
          spamContadores["(tope/seg)"] = (spamContadores["(tope/seg)"] || 0) + 1;
          return origConsole[metodo](...args);
        }
        const txt = args.map((a) => {
          if (a instanceof Error) return redactar(a.message) + (a.stack ? " | " + redactar(a.stack) : "");
          if (typeof a === "object") { try { return redactar(JSON.stringify(a)); } catch (e) { return "[objeto]"; } }
          return redactar(a);
        }).join(" ");
        empujar("consola." + metodo, { msg: txt });
      } catch (e) {}
      return origConsole[metodo](...args);
    };
  });

  // ---------- 2. Red: fetch y XMLHttpRequest, solo metadatos ----------
  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const metodo = (init && init.method) || (input && input.method) || "GET";
      const t0 = Date.now();
      let ruta = url;
      try { ruta = new URL(url, location.href).pathname; } catch (e) {}
      return origFetch(input, init).then((r) => {
        empujar("red.fetch", { metodo, ruta: redactar(ruta), status: r.status, ms: Date.now() - t0, ok: r.ok });
        return r;
      }).catch((e) => {
        empujar("red.fetch", { metodo, ruta: redactar(ruta), status: 0, ms: Date.now() - t0, ok: false, err: redactar((e && e.message) || e) });
        throw e;
      });
    };
  }
  const OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    window.XMLHttpRequest = function () {
      const xhr = new OrigXHR();
      let metodo = "GET", ruta = "", t0 = 0;
      // v2 (25-ago, lección de la 1ª grabación real): las 108 llamadas salieron con
      // status 0 aunque la página funcionaba — Angular llama xhr.abort() al desmontar la
      // suscripción DESPUÉS de completar, y eso resetea el estado antes de que dispare
      // loadend. El status se captura en readystatechange (readyState 4, ANTES del
      // teardown de Angular) y loadend solo reporta lo ya capturado.
      let statusCapturado = 0;
      const origOpen = xhr.open;
      xhr.open = function (m, u, ...resto) {
        metodo = m; try { ruta = new URL(u, location.href).pathname; } catch (e) { ruta = String(u || ""); }
        return origOpen.call(xhr, m, u, ...resto);
      };
      xhr.addEventListener("loadstart", () => { t0 = Date.now(); });
      xhr.addEventListener("readystatechange", () => {
        try { if (xhr.readyState === 4 && xhr.status) statusCapturado = xhr.status; } catch (e) {}
      });
      xhr.addEventListener("loadend", () => {
        empujar("red.xhr", { metodo, ruta: redactar(ruta), status: statusCapturado, ms: Date.now() - t0, ok: statusCapturado >= 200 && statusCapturado < 300 });
      });
      return xhr;
    };
    window.XMLHttpRequest.prototype = OrigXHR.prototype;
  }

  // ---------- 3. Errores no atrapados ----------
  const onError = (e) => {
    empujar("error.js", { msg: redactar((e && e.message) || ""), archivo: redactar((e && e.filename) || ""), linea: (e && e.lineno) || 0 });
  };
  const onRejection = (e) => {
    const r = e && e.reason;
    empujar("error.promesa", { msg: redactar((r && r.message) || r) });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  // ---------- Panel de control ----------
  window.__vglGrabacion = {
    _activa: true,
    _desde: desdeIso,
    marcar(nota) {
      empujar("nota.medico", { msg: redactar(nota) });
      origConsole.log("%c[Grabación] nota guardada", "color:#10b981");
    },
    estado() {
      origConsole.log("[Grabación] activa desde " + desdeIso + " · " + buffer.length + " evento(s) acumulado(s) de " + MAX_EVENTOS + " máx.");
      return buffer.length;
    },
    detener() {
      if (!this._activa) { origConsole.log("[Grabación] ya estaba detenida."); return; }
      this._activa = false;
      // Desinstala TODO, en el mismo orden inverso — nunca deja el navegador en un
      // estado distinto al que tenía antes de pegar el script.
      ["log", "warn", "error", "info"].forEach((m) => { console[m] = origConsole[m]; });
      if (origFetch) window.fetch = origFetch;
      if (OrigXHR) window.XMLHttpRequest = OrigXHR;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);

      const resumen = {};
      buffer.forEach((ev) => { resumen[ev.tipo] = (resumen[ev.tipo] || 0) + 1; });

      const out = [];
      out.push("======= GRABACIÓN DE SESIÓN · " + desdeIso + " a " + new Date().toISOString() + " =======");
      out.push("Duración: " + Math.round((Date.now() - inicio) / 1000) + " s · " + buffer.length + " evento(s)");
      out.push("\n--- RESUMEN POR TIPO ---");
      Object.keys(resumen).sort().forEach((k) => out.push("  " + k + ": " + resumen[k]));
      out.push("\n--- SPAM DE EVEREST DESCARTADO (solo conteo, no consumió buffer ni CPU) ---");
      Object.keys(spamContadores).forEach((k) => out.push("  " + k + " : " + spamContadores[k] + " veces"));

      const redNoOk = buffer.filter((e) => e.tipo.startsWith("red.") && e.ok === false);
      out.push("\n--- LLAMADAS DE RED CON ERROR (" + redNoOk.length + ") ---");
      redNoOk.forEach((e) => out.push("  [" + e.t + "ms] " + e.metodo + " " + e.ruta + " -> status " + e.status + (e.err ? " (" + e.err + ")" : "")));

      const errores = buffer.filter((e) => e.tipo === "error.js" || e.tipo === "error.promesa" || e.tipo === "consola.error");
      out.push("\n--- ERRORES (" + errores.length + ") ---");
      errores.forEach((e) => out.push("  [" + e.t + "ms] " + e.tipo + ": " + e.msg));

      const notas = buffer.filter((e) => e.tipo === "nota.medico");
      out.push("\n--- NOTAS DEL MÉDICO (" + notas.length + ") ---");
      notas.forEach((e) => out.push("  [" + e.t + "ms] " + e.msg));

      out.push("\n--- CRONOLOGÍA COMPLETA (todo, en orden; xN = mensaje idéntico repetido) ---");
      buffer.forEach((e) => {
        const extra = Object.keys(e).filter((k) => !["t", "tipo", "repetido", "tUlt"].includes(k)).map((k) => k + "=" + e[k]).join(" ");
        out.push("  [" + e.t + "ms] " + e.tipo + (e.repetido ? " x" + e.repetido : "") + " " + extra);
      });

      out.push("\n======= FIN =======");
      const informe = out.join("\n");
      origConsole.log(informe);
      try { copy(informe); origConsole.log("%c(informe copiado al portapapeles)", "color:#4a4"); }
      catch (e) { origConsole.log("(seleccione y copie el texto de arriba)"); }
      return informe;
    },
  };

  console.log("%c[Grabación] iniciada — siga atendiendo normal. Cuando termine: vglGrabar.detener()", "color:#2563eb;font-weight:700");
  console.log("Atajo: window.vglGrabar === window.__vglGrabacion");
  window.vglGrabar = window.__vglGrabacion;
})();
