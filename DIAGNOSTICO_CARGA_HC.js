/* ===========================================================================
   DIAGNÓSTICO — QUÉ LE CARGA EVEREST A LA PANTALLA AL ABRIR UN PACIENTE
   ---------------------------------------------------------------------------
   PARA QUÉ: hoy el asistente ve las pestañas que usted YA ABRIÓ en la consulta.
   Lo que Everest tiene guardado en pestañas que usted no ha tocado no está en
   la pantalla y no se puede leer de ahí.

   Pero Everest SÍ lo trae: cuando usted abre la historia, el servidor le manda
   todo lo que ya estaba escrito (por eso las casillas aparecen prellenadas).
   Si logro engancharme a ESA respuesta, la IA y todos los módulos tendrán el
   contexto completo desde el primer segundo, sin que usted tenga que pasearse
   por las pestañas.

   Lo que no sé es CÓMO SE LLAMA esa respuesta ni qué forma tiene. Y adivinarlo
   es exactamente lo que este proyecto se prohíbe: en v12.3.30 se supusieron
   cuatro nombres de campo y NINGUNO existía.

   Este diagnóstico es al revés del anterior: aquel escuchaba lo que Everest
   ENVÍA al guardar; este escucha lo que Everest RECIBE al abrir.

   ---------------------------------------------------------------------------
   PRIVACIDAD — LÉALO, ES LO MÁS IMPORTANTE DE ESTE ARCHIVO

   NO guarda ni un solo valor. De cada respuesta anota únicamente:
       · la ruta, sin nada de lo que va después del "?"
       · los nombres de los campos        (p. ej. "antecedentePatologicos")
       · el tipo de cada uno              ("texto", "número", "sí/no", "lista")
       · si venía lleno o vacío, y su tamaño

   NUNCA el contenido. Ni nombres, ni cédula, ni cifras, ni texto que usted
   haya escrito. Es la misma barrera del diagnóstico de guardado, que usted ya
   revisó.

   Aun así, y como siempre: ABRA EL ARCHIVO ANTES DE ENVIARLO.

   NO MODIFICA NADA. Solo escucha las respuestas; no cambia ninguna petición,
   no escribe, no borra. Se desengancha solo a los 10 minutos.

   ---------------------------------------------------------------------------
   MODO DE USO (un minuto)

   1. Quédese en la AGENDA, sin ninguna historia abierta.
   2. F12 -> pestaña "Console". Pegue este archivo entero y pulse Enter.
      Verá un aviso azul.
   3. AHORA abra la historia de un paciente que tenga bastante escrito
      (antecedentes marcados, examen físico, hábitos).
   4. Espere a que cargue del todo y NO toque más pestañas. Se descarga solo
      un .json a los 12 segundos.

   Si no se descarga nada, escriba en la consola:  __diagCarga.descargar()
   =========================================================================== */
(function () {
  "use strict";

  if (window.__diagCarga && window.__diagCarga.activo) {
    console.log("%c[Diag Carga] Ya estaba escuchando. No se enganchó dos veces.",
      "background:#b45309;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    return;
  }

  var MAX_MIN = 10;
  var capturas = [];
  var vistos = {};          // ruta -> cuántas veces, para no repetir la misma forma
  var descartadas = 0;

  // Las secciones que ya conocemos del guardado (MAPA_GUARDADO_HC.md). Si una
  // respuesta trae alguna de estas, es CANDIDATA y se anota con prioridad.
  var SECCIONES_CONOCIDAS = [
    "antecedentePatologicos", "antecedenteFamiliar", "habitosGestionRiesgo",
    "examenFisico", "revisionSistema", "antecedenteGinecoObstetrico",
    "ultimaEnfermedad", "analisisYplan", "diagnosticos", "farmacologicos"
  ];

  // --------------------------------------------------------------------
  //  LA FORMA, NUNCA EL CONTENIDO  (misma función del diagnóstico de guardado)
  // --------------------------------------------------------------------
  function forma(v, profundidad) {
    profundidad = profundidad || 0;
    if (profundidad > 5) return { tipo: "(demasiado anidado)" };
    if (v === null) return { tipo: "nulo", vacio: true };
    if (v === undefined) return { tipo: "ausente", vacio: true };
    if (typeof v === "boolean") return { tipo: "sí/no", vacio: false };
    if (typeof v === "number") return { tipo: "número", vacio: false };
    if (typeof v === "string") {
      var s = v.trim();
      var d = { tipo: "texto", vacio: s.length === 0, largo: s.length };
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) d.pinta = "fecha ISO";
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) d.pinta = "fecha dd/mm/aaaa";
      else if (/^\d+$/.test(s)) d.pinta = "solo dígitos (" + s.length + ")";
      else if (s.length > 120) d.pinta = "texto libre largo";
      return d;
    }
    if (Array.isArray(v)) {
      return { tipo: "lista", vacio: v.length === 0, elementos: v.length,
               primero: v.length ? forma(v[0], profundidad + 1) : null };
    }
    if (typeof v === "object") {
      var campos = {}, claves = Object.keys(v);
      for (var i = 0; i < claves.length && i < 250; i++) campos[claves[i]] = forma(v[claves[i]], profundidad + 1);
      return { tipo: "objeto", campos: campos, totalCampos: claves.length };
    }
    return { tipo: typeof v };
  }

  function rutaLimpia(url) {
    try {
      var sinQuery = String(url || "").split("?")[0];
      return sinQuery.replace(/\/\d{5,}/g, "/[ID]");
    } catch (e) { return "(no se pudo leer la dirección)"; }
  }

  function anotar(metodo, url, texto) {
    try {
      if (!texto || typeof texto !== "string" || texto.length < 80) return;
      var ruta = rutaLimpia(url);
      // La misma ruta no se anota más de dos veces: la forma ya la tenemos.
      vistos[ruta] = (vistos[ruta] || 0) + 1;
      if (vistos[ruta] > 2) return;

      var datos = null;
      try { datos = JSON.parse(texto); } catch (e) { descartadas++; return; }
      if (!datos || typeof datos !== "object") { descartadas++; return; }

      // ¿Trae alguna sección de las que ya conocemos? Se mira en el texto crudo,
      // que es barato y no depende de dónde esté anidada.
      var encontradas = [];
      for (var i = 0; i < SECCIONES_CONOCIDAS.length; i++) {
        if (texto.indexOf('"' + SECCIONES_CONOCIDAS[i] + '"') >= 0) encontradas.push(SECCIONES_CONOCIDAS[i]);
      }

      capturas.push({
        t: new Date().toISOString(),
        metodo: String(metodo || "").toUpperCase(),
        ruta: ruta,
        tamanoRespuesta: texto.length,
        seccionesConocidasQueTrae: encontradas,
        esCandidataFuerte: encontradas.length >= 2,
        forma: forma(datos, 0),
      });

      if (encontradas.length >= 2) {
        console.log("%c[Diag Carga] ¡CANDIDATA! " + ruta + " trae: " + encontradas.join(", "),
          "background:#16a34a;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
      }
    } catch (e) {}
  }

  // --------------------------------------------------------------------
  //  ENGANCHE A LAS RESPUESTAS (se guarda el original para devolverlo intacto)
  // --------------------------------------------------------------------
  var XHRopen = XMLHttpRequest.prototype.open;
  var XHRsend = XMLHttpRequest.prototype.send;
  var fetchOriginal = window.fetch;

  XMLHttpRequest.prototype.open = function (metodo, url) {
    try { this.__dcMetodo = metodo; this.__dcUrl = url; } catch (e) {}
    return XHRopen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    try {
      var xhr = this;
      xhr.addEventListener("load", function () {
        try {
          // responseType vacío o "text" son los únicos que dejan leer responseText
          // sin romper nada. Si Everest pide otro tipo, se ignora esa respuesta.
          if (xhr.responseType && xhr.responseType !== "text") return;
          anotar(xhr.__dcMetodo, xhr.__dcUrl, xhr.responseText);
        } catch (e) {}
      });
    } catch (e) {}
    return XHRsend.apply(this, arguments);
  };

  window.fetch = function (entrada, opciones) {
    var url = (typeof entrada === "string") ? entrada : (entrada && entrada.url);
    var metodo = (opciones && opciones.method) || (entrada && entrada.method) || "GET";
    return fetchOriginal.apply(this, arguments).then(function (resp) {
      try {
        // SE CLONA: leer el cuerpo original dejaría a Everest sin poder leerlo.
        // Esto es lo único que impide que este diagnóstico rompa la aplicación.
        resp.clone().text().then(function (txt) { anotar(metodo, url, txt); }).catch(function () {});
      } catch (e) {}
      return resp;
    });
  };

  function desenganchar() {
    try {
      XMLHttpRequest.prototype.open = XHRopen;
      XMLHttpRequest.prototype.send = XHRsend;
      window.fetch = fetchOriginal;
      window.__diagCarga.activo = false;
      console.log("%c[Diag Carga] Desenganchado. Everest quedó como estaba.",
        "background:#64748b;color:#fff;padding:4px 8px;border-radius:4px");
    } catch (e) {}
  }

  function descargar() {
    // Las candidatas primero: son las que resuelven la pregunta.
    var ordenadas = capturas.slice().sort(function (a, b) {
      return (b.seccionesConocidasQueTrae.length - a.seccionesConocidasQueTrae.length) ||
             (b.tamanoRespuesta - a.tamanoRespuesta);
    });
    var salida = {
      t: new Date().toISOString(),
      nota: "Solo la FORMA de cada respuesta: rutas, nombres de campo, tipos y tamaños. Ningún valor del paciente.",
      respuestasAnotadas: capturas.length,
      descartadasPorNoSerJson: descartadas,
      candidatasFuertes: ordenadas.filter(function (c) { return c.esCandidataFuerte; }).length,
      capturas: ordenadas.slice(0, 40),
    };
    try {
      var blob = new Blob([JSON.stringify(salida, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "diag_carga_hc_" + Date.now() + ".json";
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { a.remove(); URL.revokeObjectURL(a.href); } catch (e) {} }, 1000);
      console.log("%c[Diag Carga] Descargado. " + salida.candidatasFuertes + " candidata(s) fuerte(s) de " +
        capturas.length + " respuestas. Ábralo antes de mandarlo.",
        "background:#16a34a;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
    } catch (e) {
      console.log("%c[Diag Carga] No se pudo descargar. Copie lo de abajo:", "color:#b45309;font-weight:bold");
      console.log(JSON.stringify(salida, null, 2));
    }
    return salida;
  }

  window.__diagCarga = { activo: true, descargar: descargar, desenganchar: desenganchar, capturas: capturas };
  setTimeout(desenganchar, MAX_MIN * 60 * 1000);
  setTimeout(function () { if (capturas.length) descargar(); }, 12000);

  console.log("%c[Diag Carga] Escuchando. AHORA abra la historia de un paciente con bastante escrito.",
    "background:#1e3a5f;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
  console.log("%cSe descarga solo a los 12 segundos. No se guarda NINGÚN valor: solo nombres de campo, tipos y tamaños.",
    "color:#16a34a;font-weight:bold");
})();
