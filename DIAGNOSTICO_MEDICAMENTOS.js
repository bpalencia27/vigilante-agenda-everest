/* ===========================================================================
   DIAGNÓSTICO — FORMA REAL DEL ENDPOINT DE MEDICAMENTOS (para R6)
   ---------------------------------------------------------------------------
   PARA QUÉ: R6 (avisos ámbar de dosis renal — metformina, rosuvastatina, etc.)
   necesita leer los medicamentos ACTUALES del paciente. Hay un endpoint
   candidato, MedicamentoPorPaciente, visto de pasada en una captura anterior,
   pero nunca se capturó su respuesta real: ni los nombres de los campos, ni si
   el nombre del fármaco viene como texto libre o como código, ni si trae la
   dosis. Sin eso no se puede escribir la regla de alerta sin inventar la forma
   del dato — exactamente lo que este proyecto prohíbe.

   NO MODIFICA NADA. Solo observa. No guarda, no envía, no toca la historia.

   MODO DE USO (1 minuto)
   1. Abra la historia clínica de un paciente que tenga medicamentos formulados
      actualmente (mientras más fármacos, mejor evidencia).
   2. F12 -> pestaña "Console". Pegue este archivo entero y Enter.
   3. Verá "GRABANDO". Abra la pestaña/sección donde se ven los medicamentos del
      paciente (o donde se formulan) — con que Angular dispare la petición basta,
      no hace falta escribir nada.
   4. Escriba en la consola:   VGL_DIAG_MEDS_FIN()
   5. Se descargará un archivo .json. Envíelo por el canal de siempre.
   =========================================================================== */
(function () {
  "use strict";

  if (window.__VGL_DIAG_MEDS__) { console.warn("[Diag Meds] Ya estaba corriendo. Escriba VGL_DIAG_MEDS_FIN() para terminar."); return; }

  // Candidatos por nombre de endpoint: el confirmado de pasada, más variantes
  // razonables del mismo patrón que usa Everest en otras APIs. Si ninguno
  // aparece, este mismo script lo dice — no se adivina un tercero.
  const INTERES = ["MedicamentoPorPaciente", "Medicamento", "Formulacion", "Prescripcion", "Farmaco"];

  // Igual que en los otros diagnósticos de esta sesión: se redacta el VALOR de
  // cualquier clave que huela a identidad, se conserva el nombre del campo.
  const PHI = /nombre|apellido|identificac|document|cedula|c[ée]dula|telefono|tel[ée]fono|celular|correo|email|direccion|direcci[óo]n|nacimiento|acudiente|responsable|medico|profesional/i;

  const cap = { inicio: new Date().toISOString(), url0: location.href, red: [] };

  function limpiar(v, k, prof) {
    prof = prof || 0;
    if (prof > 8) return "[…profundo…]";
    if (v === null || v === undefined) return v;
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "string") {
      if (/^\d{6,}$/.test(v.trim())) return "[NUM-REDACTADO]";
      return v.length > 300 ? v.slice(0, 300) + "…[recortado]" : v;
    }
    if (Array.isArray(v)) return v.slice(0, 30).map((x) => limpiar(x, k, prof + 1));
    if (typeof v === "object") {
      const out = {};
      for (const kk of Object.keys(v)) out[kk] = PHI.test(kk) ? "[REDACTADO]" : limpiar(v[kk], kk, prof + 1);
      return out;
    }
    return String(v);
  }

  function anotar(metodo, url, cuerpo) {
    try {
      const u = String(url || "");
      if (!INTERES.some((f) => u.toLowerCase().indexOf(f.toLowerCase()) >= 0)) return;
      let datos = null;
      try { datos = typeof cuerpo === "string" ? JSON.parse(cuerpo) : cuerpo; }
      catch (e) { datos = { __noEsJson: String(cuerpo || "").slice(0, 400) }; }
      cap.red.push({
        t: new Date().toISOString(),
        metodo,
        url: u.replace(/(\d{6,})/g, "[NUM]"),
        respuesta: limpiar(datos),
      });
      console.log("[Diag Meds] capturado:", u.split("?")[0].split("/").slice(-1)[0]);
    } catch (e) {}
  }

  const F0 = window.fetch;
  window.fetch = function () {
    const args = arguments;
    return F0.apply(this, args).then((r) => {
      try { r.clone().text().then((t) => anotar("fetch", args[0] && args[0].url ? args[0].url : args[0], t)).catch(() => {}); } catch (e) {}
      return r;
    });
  };

  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__vglM = m; this.__vglU = u; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    const self = this;
    self.addEventListener("load", function () { try { anotar(self.__vglM || "XHR", self.__vglU, self.responseText); } catch (e) {} });
    return XS.apply(this, arguments);
  };

  window.VGL_DIAG_MEDS_FIN = function () {
    try { window.fetch = F0; XMLHttpRequest.prototype.open = XO; XMLHttpRequest.prototype.send = XS; } catch (e) {}
    cap.fin = new Date().toISOString();
    const txt = JSON.stringify(cap, null, 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    a.download = "diag_medicamentos_" + Date.now() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    console.log("%c[Diag Meds] LISTO — " + cap.red.length + " respuesta(s) capturadas. Archivo descargado.",
      "background:#065f46;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    if (!cap.red.length) {
      console.warn("[Diag Meds] Ninguna de las URLs vistas coincidió con " + INTERES.join("/") + ". Puede que el nombre real del endpoint sea otro — revise la pestaña Network a mano y avise cuál es.");
    }
    delete window.__VGL_DIAG_MEDS__;
    return "Descargado. Revise el archivo y envíelo.";
  };

  window.__VGL_DIAG_MEDS__ = true;
  console.log("%c[Diag Meds] GRABANDO. Abra la sección de medicamentos del paciente y luego escriba:  VGL_DIAG_MEDS_FIN()",
    "background:#7c2d12;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
})();
