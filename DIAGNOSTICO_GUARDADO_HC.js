/* ===========================================================================
   DIAGNÓSTICO — LA FORMA DEL GUARDADO DE LA HISTORIA CLÍNICA
   ---------------------------------------------------------------------------
   PARA QUÉ: usted pidió que la IA se alimente de TODO lo que se registra en
   Everest, no solo de la lista corta que hoy le llega. Para eso hay que
   engancharse a lo que Everest envía al servidor cuando usted pulsa Guardar en
   la historia clínica — ahí va, en un solo paquete, todo lo que escribió.

   POR QUÉ NO SE PUEDE ADIVINAR: en el repositorio no hay ni una sola captura de
   ese guardado. Hay capturas de agendamiento y de ordenamiento, pero ninguna de
   la historia. Sin saber el nombre real del endpoint y los nombres reales de los
   campos, cualquier código que escriba sería una conjetura — y este proyecto ya
   se llevó ese susto: en v12.3.30 se supusieron cuatro nombres distintos para la
   fecha de un resultado de Athenea y NINGUNO de los cuatro existía.

   ---------------------------------------------------------------------------
   PRIVACIDAD — LÉALO, ES LO MÁS IMPORTANTE DE ESTE ARCHIVO

   Este diagnóstico NO guarda ni un solo valor del paciente. De cada campo anota
   únicamente:
       · el nombre del campo               (p. ej. "enfermedadActual")
       · su tipo                           ("texto", "número", "sí/no", "lista")
       · si venía lleno o vacío            (un sí/no)
       · para los textos, cuántos caracteres tenía   (un número, no el texto)
       · para las listas, cuántos elementos tenía

   NUNCA el contenido. No se anota lo que usted escribió, ni cifras del paciente,
   ni nombres, ni la cédula. De la dirección web se guarda solo la ruta: todo lo
   que va después del "?" se descarta, porque ahí es justamente donde Everest
   mete la cédula y el teléfono.

   Aun así, y como siempre: ABRA EL ARCHIVO ANTES DE ENVIARLO. Son dos minutos y
   es su firma la que está detrás.

   NO MODIFICA NADA de la historia. Solo escucha. No escribe, no borra, no envía
   nada a ningún sitio: el archivo se descarga a su propio computador.

   Se desengancha solo a los 15 minutos, y también si usted recarga la página.

   ---------------------------------------------------------------------------
   MODO DE USO (un minuto)

   1. Abra la historia clínica de un paciente CUALQUIERA — mejor uno que ya tenga
      bastante escrito, para que se vea el mayor número de campos posible.
   2. Pulse F12 -> pestaña "Console". Pegue este archivo entero y pulse Enter.
      Verá un aviso azul que dice que está escuchando.
   3. Vuelva a la historia y pulse GUARDAR como haría normalmente. Puede guardar
      sin cambiar nada; lo que importa es que Everest envíe el paquete.
   4. En cuanto lo capture, se descarga un .json solo. Envíelo por el canal de
      siempre.

   Si no se descarga nada, escriba en la consola:  __diagHC.descargar()
   y mándeme lo que salga, aunque esté vacío: saber que NO se capturó nada
   también es información (querría decir que Everest guarda por otra vía).
   =========================================================================== */
(function () {
  "use strict";

  if (window.__diagHC && window.__diagHC.activo) {
    console.log("%c[Diag HC] Ya estaba escuchando. No se enganchó dos veces.",
      "background:#b45309;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    return;
  }

  var MAX_MIN = 15;
  var capturas = [];
  var descartadas = 0;

  // --------------------------------------------------------------------
  //  LA FORMA, NUNCA EL CONTENIDO
  // --------------------------------------------------------------------
  // De cada valor se devuelve una descripción: qué tipo es y cuánto ocupa.
  // Jamás el valor. Un texto de 300 caracteres se anota como
  // {tipo:"texto", vacio:false, largo:300} — nunca los 300 caracteres.
  function forma(v, profundidad) {
    profundidad = profundidad || 0;
    if (profundidad > 6) return { tipo: "(demasiado anidado)" };
    if (v === null) return { tipo: "nulo", vacio: true };
    if (v === undefined) return { tipo: "ausente", vacio: true };
    if (typeof v === "boolean") return { tipo: "sí/no", vacio: false };
    if (typeof v === "number") return { tipo: "número", vacio: false };
    if (typeof v === "string") {
      var s = v.trim();
      var d = { tipo: "texto", vacio: s.length === 0, largo: s.length };
      // Pistas ÚTILES que no revelan nada: si parece una fecha o un identificador.
      // Se anota el PATRÓN, nunca el valor.
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) d.pinta = "fecha ISO";
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) d.pinta = "fecha dd/mm/aaaa";
      else if (/^\d+$/.test(s)) d.pinta = "solo dígitos (" + s.length + ")";
      else if (s.length > 120) d.pinta = "texto libre largo";
      return d;
    }
    if (Array.isArray(v)) {
      return {
        tipo: "lista", vacio: v.length === 0, elementos: v.length,
        // Solo la forma del PRIMER elemento: basta para saber qué hay dentro.
        primero: v.length ? forma(v[0], profundidad + 1) : null,
      };
    }
    if (typeof v === "object") {
      var campos = {};
      var claves = Object.keys(v);
      for (var i = 0; i < claves.length && i < 300; i++) {
        campos[claves[i]] = forma(v[claves[i]], profundidad + 1);
      }
      return { tipo: "objeto", campos: campos, totalCampos: claves.length };
    }
    return { tipo: typeof v };
  }

  // Ruta sin la parte de después del "?": ahí es donde Everest mete la cédula.
  function rutaLimpia(url) {
    try {
      var u = String(url || "");
      var sinQuery = u.split("?")[0];
      // Y por si acaso, se tachan tramos que sean solo dígitos largos (ids).
      return sinQuery.replace(/\/\d{5,}/g, "/[ID]");
    } catch (e) { return "(no se pudo leer la dirección)"; }
  }

  // ¿Este envío tiene pinta de ser el guardado de la historia?
  function pareceGuardado(metodo, url, cuerpo) {
    var m = String(metodo || "").toUpperCase();
    if (m !== "POST" && m !== "PUT") return false;
    if (!cuerpo || typeof cuerpo !== "string") return false;
    if (cuerpo.length < 40) return false;                 // demasiado corto para una historia
    var u = String(url || "").toLowerCase();
    // No se filtra por nombre de endpoint a propósito: no lo conocemos, y filtrar
    // por una conjetura es justo lo que este diagnóstico existe para evitar. Se
    // capturan TODOS los envíos con cuerpo JSON y luego se mira cuál es cuál.
    if (u.indexOf("google") >= 0 || u.indexOf("gemini") >= 0) return false;
    return true;
  }

  function anotar(metodo, url, cuerpo) {
    var datos = null;
    try { datos = JSON.parse(cuerpo); } catch (e) { datos = null; }
    if (datos === null) { descartadas++; return; }        // no era JSON: no interesa
    if (typeof datos !== "object") { descartadas++; return; }
    capturas.push({
      t: new Date().toISOString(),
      metodo: String(metodo || "").toUpperCase(),
      ruta: rutaLimpia(url),
      tamanoDelCuerpo: cuerpo.length,
      forma: forma(datos, 0),
    });
    console.log("%c[Diag HC] Capturado un envío: " + rutaLimpia(url) +
      "  (" + cuerpo.length + " caracteres, " +
      (datos && typeof datos === "object" ? Object.keys(datos).length : 0) + " campos en la raíz)",
      "color:#16a34a;font-weight:bold");
    if (capturas.length === 1) {
      setTimeout(descargar, 2500);   // deja llegar a los envíos hermanos del mismo Guardar
    }
  }

  // --------------------------------------------------------------------
  //  ENGANCHE (se guarda el original para devolverlo intacto)
  // --------------------------------------------------------------------
  var XHRopen = XMLHttpRequest.prototype.open;
  var XHRsend = XMLHttpRequest.prototype.send;
  var fetchOriginal = window.fetch;

  XMLHttpRequest.prototype.open = function (metodo, url) {
    try { this.__diagMetodo = metodo; this.__diagUrl = url; } catch (e) {}
    return XHRopen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (cuerpo) {
    try {
      if (pareceGuardado(this.__diagMetodo, this.__diagUrl, cuerpo)) {
        anotar(this.__diagMetodo, this.__diagUrl, cuerpo);
      }
    } catch (e) {}
    return XHRsend.apply(this, arguments);
  };

  window.fetch = function (entrada, opciones) {
    try {
      var url = (typeof entrada === "string") ? entrada : (entrada && entrada.url);
      var o = opciones || {};
      if (pareceGuardado(o.method, url, o.body)) anotar(o.method, url, o.body);
    } catch (e) {}
    return fetchOriginal.apply(this, arguments);
  };

  function desenganchar() {
    try {
      XMLHttpRequest.prototype.open = XHRopen;
      XMLHttpRequest.prototype.send = XHRsend;
      window.fetch = fetchOriginal;
      window.__diagHC.activo = false;
      console.log("%c[Diag HC] Desenganchado. Everest quedó como estaba.",
        "background:#64748b;color:#fff;padding:4px 8px;border-radius:4px");
    } catch (e) {}
  }

  function descargar() {
    var salida = {
      t: new Date().toISOString(),
      ruta: rutaLimpia(location.href),
      enviosCapturados: capturas.length,
      enviosDescartadosPorNoSerJson: descartadas,
      nota: "Solo la FORMA de cada envío: nombres de campo, tipos y tamaños. Ningún valor del paciente.",
      capturas: capturas,
    };
    try {
      var blob = new Blob([JSON.stringify(salida, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "diag_guardado_hc_" + Date.now() + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { try { a.remove(); URL.revokeObjectURL(a.href); } catch (e) {} }, 1000);
      console.log("%c[Diag HC] Descargado con " + capturas.length + " envío(s). Ábralo antes de mandarlo.",
        "background:#16a34a;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    } catch (e) {
      console.log("%c[Diag HC] No se pudo descargar. Copie lo de abajo a mano:", "color:#b45309;font-weight:bold");
      console.log(JSON.stringify(salida, null, 2));
    }
    return salida;
  }

  window.__diagHC = { activo: true, descargar: descargar, desenganchar: desenganchar, capturas: capturas };
  setTimeout(desenganchar, MAX_MIN * 60 * 1000);

  console.log("%c[Diag HC] Escuchando. Ahora vaya a la historia y pulse GUARDAR.",
    "background:#1e3a5f;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
  console.log("%cSe descarga solo en cuanto capture algo. Si no pasa nada, escriba:  __diagHC.descargar()",
    "color:#475569");
  console.log("%cNo se guarda NINGÚN valor del paciente: solo nombres de campo, tipos y tamaños.",
    "color:#16a34a;font-weight:bold");
})();
