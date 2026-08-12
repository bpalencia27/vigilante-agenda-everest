/* ===========================================================================
   DIAGNÓSTICO — ¿DÓNDE GUARDA EVEREST LOS FACTORES DE RIESGO CARDIOVASCULAR?
   ---------------------------------------------------------------------------
   PARA QUÉ: el motor RCV necesita saber si el paciente fuma, es sedentario, si
   tiene ECV establecida, hipercolesterolemia familiar, etc. El médico confirma
   que Everest SÍ tiene esos datos, repartidos en varias pestañas de la historia
   clínica. Este script averigua EN QUÉ CAMPO EXACTO viven, para no adivinarlos.

   POR QUÉ ASÍ Y NO A OJO: este proyecto ya pagó el precio de adivinar nombres de
   campo. En v12.3.30 se habían supuesto 4 nombres distintos para la fecha de un
   resultado de Athenea y NINGUNO existía en el objeto real. Regla de la casa:
   casilla vacía antes que dato inventado.

   PRIVACIDAD — LEA ESTO: el volcado se REDACTA antes de guardarse. Los campos de
   identidad (nombre, cédula, teléfono, dirección, correo, fecha de nacimiento) se
   sustituyen por una marca. Se conservan los NOMBRES DE CAMPO y los valores
   clínicos, que es lo único que hace falta. Aun así, revise el archivo antes de
   enviarlo.

   ---------------------------------------------------------------------------
   MODO DE USO (2 minutos)

   1. Abra Everest e ingrese a la HISTORIA CLÍNICA de un paciente del programa
      de riesgo cardiovascular que tenga antecedentes ya registrados.
   2. Pulse F12 -> pestaña "Console". Pegue este archivo entero y pulse Enter.
   3. Verá "GRABANDO". Ahora RECORRA LAS PESTAÑAS de la historia clínica, con
      calma, haciendo clic en cada una:
         Anamnesis · Antecedentes · Hábitos y Gestión de Riesgo ·
         Revisión por sistema y Examen físico · Ruta Crónicos ·
         Impresión Diagnóstica · Paraclínicos
      No hace falta escribir ni guardar nada. Solo mirar.
   4. Cuando haya pasado por todas, escriba en la consola:   VGL_DIAG_FIN()
   5. Se descargará un archivo .json. Envíelo por el canal de siempre.

   NO MODIFICA NADA. Solo observa. No guarda, no envía, no toca la historia.
   =========================================================================== */

(function () {
  "use strict";

  if (window.__VGL_DIAG_RCV__) { console.warn("[Diag RCV] Ya estaba corriendo. Escriba VGL_DIAG_FIN() para terminar."); return; }

  // Endpoints candidatos. Se eligieron por lo que Everest llama de verdad al abrir
  // la historia (visto en grabación real de consultorio), no por su nombre bonito.
  // Si alguno no aparece en el resultado, es que esa pantalla no lo dispara — y eso
  // TAMBIÉN es un dato útil.
  const INTERES = [
    "CargarAntecedentes",              // el candidato más fuerte: antecedentes del paciente
    "GestionDeRiesgo",                 // "Hábitos y Gestión de Riesgo"
    "PreguntasRiesgoDiabetes",
    "ObtenerHcDataPrevRenal",
    "SignosVitales",
    "Pes",                             // programa especial / ruta crónicos
    "Habito", "Antecedente", "Riesgo", "Tamiz", "Morbilidad",
    "CargarDatosPaciente",
  ];

  // Claves cuyo VALOR se borra siempre. El nombre de la clave se conserva: es
  // justo lo que necesitamos ver. Nunca al revés.
  const PHI = /nombre|apellido|identificac|document|cedula|c[ée]dula|telefono|tel[ée]fono|celular|correo|email|direccion|direcci[óo]n|nacimiento|acudiente|responsable|barrio|firma/i;

  const cap = { inicio: new Date().toISOString(), url0: location.href, red: [], pestanas: [], notas: [] };

  // Redacción recursiva. Conserva forma, tipo y claves; borra identidad.
  function limpiar(v, prof) {
    prof = prof || 0;
    if (prof > 8) return "[…profundo…]";
    if (v === null || v === undefined) return v;
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "string") {
      // Una cadena de 6+ dígitos seguidos en un campo cualquiera puede ser una
      // cédula colada donde no la esperábamos.
      if (/^\d{6,}$/.test(v.trim())) return "[NUM-REDACTADO]";
      return v.length > 300 ? v.slice(0, 300) + "…[recortado]" : v;
    }
    if (Array.isArray(v)) return v.slice(0, 25).map(function (x) { return limpiar(x, prof + 1); });
    if (typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v)) {
        out[k] = PHI.test(k) ? "[REDACTADO]" : limpiar(v[k], prof + 1);
      }
      return out;
    }
    return String(v);
  }

  function anotar(metodo, url, cuerpo) {
    try {
      const u = String(url || "");
      if (!INTERES.some(function (f) { return u.toLowerCase().indexOf(f.toLowerCase()) >= 0; })) return;
      let datos = null;
      try { datos = typeof cuerpo === "string" ? JSON.parse(cuerpo) : cuerpo; }
      catch (e) { datos = { __noEsJson: String(cuerpo || "").slice(0, 400) }; }
      cap.red.push({
        t: new Date().toISOString(),
        metodo: metodo,
        // La URL se limpia de identificadores por si llevara la cédula en la query.
        url: u.replace(/(\d{6,})/g, "[NUM]"),
        respuesta: limpiar(datos),
      });
      console.log("[Diag RCV] capturado:", u.split("?")[0].split("/").slice(-1)[0]);
    } catch (e) { /* nunca romper la pantalla del médico por un diagnóstico */ }
  }

  // --- Enganche de fetch (no lo reemplaza: lo envuelve y deja pasar todo igual) ---
  const F0 = window.fetch;
  window.fetch = function () {
    const args = arguments;
    return F0.apply(this, args).then(function (r) {
      try {
        r.clone().text().then(function (t) { anotar("fetch", args[0] && args[0].url ? args[0].url : args[0], t); }).catch(function () {});
      } catch (e) {}
      return r;
    });
  };

  // --- Enganche de XMLHttpRequest (Angular usa esta vía en varias pantallas) ---
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__vglM = m; this.__vglU = u; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    const self = this;
    self.addEventListener("load", function () {
      try { anotar(self.__vglM || "XHR", self.__vglU, self.responseText); } catch (e) {}
    });
    return XS.apply(this, arguments);
  };

  // --- Inventario de las pestañas de la historia clínica ---
  // Necesitamos saber qué pestañas EXISTEN y con qué id, porque el motor tendrá que
  // leer de varias. Se re-escanea en cada clic: Angular monta pestañas tarde.
  function escanearPestanas() {
    try {
      const vistos = new Set(cap.pestanas.map(function (p) { return p.id + "|" + p.texto; }));
      document.querySelectorAll('a[id], [role="tab"], .nav-link').forEach(function (el) {
        const id = el.id || "", texto = (el.textContent || "").trim().slice(0, 60);
        if (!texto) return;
        const k = id + "|" + texto;
        if (vistos.has(k)) return;
        vistos.add(k);
        cap.pestanas.push({ id: id, texto: texto, clase: (el.className || "").slice(0, 80) });
      });
    } catch (e) {}
  }

  // Al hacer clic en una pestaña, se anota QUÉ campos de formulario hay dentro.
  // Solo etiqueta + tipo + id/name: nunca el valor escrito, que podría ser PHI.
  document.addEventListener("click", function (ev) {
    setTimeout(function () {
      escanearPestanas();
      try {
        const t = ev.target, etiqueta = (t.textContent || t.value || "").trim().slice(0, 60);
        const campos = [];
        document.querySelectorAll("input,select,textarea").forEach(function (c) {
          if (campos.length >= 120) return;
          if (c.type === "hidden") return;
          let lbl = "";
          try {
            const l = (c.id && document.querySelector('label[for="' + CSS.escape(c.id) + '"]')) || c.closest("label");
            lbl = l ? (l.textContent || "").trim().slice(0, 70) : "";
          } catch (e) {}
          campos.push({
            id: c.id || "", name: c.name || "", tipo: c.type || c.tagName.toLowerCase(),
            etiqueta: lbl,
            // Para casillas y selectores el ESTADO sí importa (es el factor de riesgo);
            // para texto libre no se guarda nada.
            estado: (c.type === "checkbox" || c.type === "radio") ? !!c.checked
                  : (c.tagName === "SELECT" ? (c.options[c.selectedIndex] || {}).text || "" : "[no-capturado]"),
          });
        });
        cap.notas.push({ t: new Date().toISOString(), clicEn: etiqueta, camposVisibles: campos });
      } catch (e) {}
    }, 900); // Angular tarda en montar la pestaña; sin espera se captura la anterior.
  }, true);

  escanearPestanas();

  window.VGL_DIAG_FIN = function () {
    try {
      window.fetch = F0;
      XMLHttpRequest.prototype.open = XO;
      XMLHttpRequest.prototype.send = XS;
    } catch (e) {}
    cap.fin = new Date().toISOString();
    const txt = JSON.stringify(cap, null, 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    a.download = "diag_factores_rcv_" + Date.now() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    console.log("%c[Diag RCV] LISTO — " + cap.red.length + " respuestas y " + cap.pestanas.length + " pestañas. Archivo descargado.",
      "background:#065f46;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    delete window.__VGL_DIAG_RCV__;
    return "Descargado. Revise el archivo y envíelo.";
  };

  window.__VGL_DIAG_RCV__ = true;
  console.log("%c[Diag RCV] GRABANDO. Recorra las pestañas de la historia clínica y luego escriba:  VGL_DIAG_FIN()",
    "background:#7c2d12;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
})();
