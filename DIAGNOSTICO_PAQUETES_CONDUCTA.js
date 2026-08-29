/* ===========================================================================
   DIAGNÓSTICO — CÓMO AGREGA EVEREST UN PAQUETE EN CONDUCTA > ORDENAMIENTOS
   ---------------------------------------------------------------------------
   PARA QUÉ: el botón nuevo "Ordenar pendientes" crea la orden por el módulo de
   Ordenamientos de Everest (GuardarOrdenamiento) — el mismo camino que ya usan
   las órdenes de PyM. Pero usted reportó que las filas NO aparecen en la tabla
   de Conducta > Ordenamientos como sí aparecen cuando usa "Paquetes" a mano.
   Eso dice que "Paquetes" hace algo MÁS, o ALGO DISTINTO, y adivinarlo sería
   exactamente lo que este proyecto se prohíbe (romper la regla de v15.3.0/
   v15.7.0: nunca escribir en la pantalla de Conducta simulando un gesto sin
   saber primero, con evidencia real, qué gesto es ese).

   Este diagnóstico graba TRES cosas a la vez mientras usted agrega un paquete
   a mano, como siempre lo hace:
     1. Toda petición de red (URL y método) que se dispare en esa ventana.
     2. Los clics en "Paquetes"/"Historial" y en el botón "Agregar +".
     3. Las filas NUEVAS que aparezcan en la tabla de Ordenamientos (Código,
        Nombre, Cantidad, Nota, Fecha de consulta) — SÍ se guarda el texto de
        esas celdas: son código y nombre de examen, dato de la aplicación,
        igual que ya lo trata el resto del proyecto (nunca nombre, cédula ni
        dato del paciente).

   ---------------------------------------------------------------------------
   PRIVACIDAD — LÉALO, ES LO MÁS IMPORTANTE DE ESTE ARCHIVO

   De la RED se anota SOLO método + ruta (sin nada después del "?") — nunca el
   cuerpo de la petición ni de la respuesta.

   De la TABLA de Ordenamientos SÍ se guarda el texto de Código/Nombre/
   Cantidad/Nota (son datos de examen, no del paciente) — la columna "Fecha de
   consulta" y cualquier otra zona de la pantalla NUNCA se lee.

   No se toca ninguna otra pestaña, ni el encabezado del paciente, ni
   Anamnesis, ni ninguna casilla de texto libre.

   SOLO LECTURA: no hace clic en nada, no escribe nada, no cambia ningún
   comportamiento de Everest ni del Vigilante. Se desengancha solo a los 10
   minutos.

   ---------------------------------------------------------------------------
   MODO DE USO (un minuto)

   1. Entre a Conducta de un paciente de prueba (o real, no importa: no se lee
      nada suyo). F12 -> pestaña "Console". Pegue este archivo entero y Enter.
      Verá un aviso azul.
   2. Haga EXACTAMENTE lo que hace siempre: clic en "Paquetes", elija un
      paquete del desplegable, clic en "Agregar +". Espere a que la fila
      aparezca en la tabla.
   3. Escriba en la consola:  __diagPaquetes.descargar()
      Descarga un .json ya listo para mandarme, y lo copia al portapapeles.
   4. Para ver cuánto lleva grabado sin bajar el archivo:  __diagPaquetes.estado()
   =========================================================================== */
(function () {
  "use strict";

  if (window.__diagPaquetes && window.__diagPaquetes.activo) {
    console.log("%c[Diag Paquetes] Ya estaba grabando. Escriba __diagPaquetes.descargar() para terminar.",
      "background:#b45309;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    return;
  }

  var MAX_MIN = 10;
  var red = [];
  var clics = [];
  var filasNuevas = [];

  function rutaLimpia(url) {
    try {
      var sinQuery = String(url || "").split("?")[0];
      return sinQuery.replace(/\/\d{5,}/g, "/[ID]");
    } catch (e) { return "(no se pudo leer la dirección)"; }
  }

  function anotarRed(metodo, url) {
    try {
      red.push({ t: new Date().toISOString(), metodo: String(metodo || "").toUpperCase(), ruta: rutaLimpia(url) });
      console.log("%c[Diag Paquetes] red: " + String(metodo || "").toUpperCase() + " " + rutaLimpia(url),
        "color:#2563eb");
    } catch (e) {}
  }

  // --------------------------------------------------------------------
  //  RED — mismo enganche no destructivo que ya usan los otros diagnósticos
  // --------------------------------------------------------------------
  var XHRopen = XMLHttpRequest.prototype.open;
  var fetchOriginal = window.fetch;
  XMLHttpRequest.prototype.open = function (metodo, url) {
    try { anotarRed(metodo, url); } catch (e) {}
    return XHRopen.apply(this, arguments);
  };
  window.fetch = function (entrada, opciones) {
    try {
      var url = (typeof entrada === "string") ? entrada : (entrada && entrada.url);
      var metodo = (opciones && opciones.method) || (entrada && entrada.method) || "GET";
      anotarRed(metodo, url);
    } catch (e) {}
    return fetchOriginal.apply(this, arguments);
  };

  // --------------------------------------------------------------------
  //  CLICS — solo en "Paquetes"/"Historial"/"Agregar +", por texto del botón
  //  (mismo patrón defensivo que ya usa el propio Vigilante: sin id/clase
  //  estable, se reconoce por el texto visible, nunca se adivina otra cosa).
  // --------------------------------------------------------------------
  function normalizar(s) {
    return String(s || "").trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  document.addEventListener("click", function (e) {
    try {
      var btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      var texto = normalizar(btn.textContent);
      if (texto.indexOf("paquetes") >= 0 || texto.indexOf("historial") >= 0 || texto.indexOf("agregar") >= 0) {
        clics.push({ t: new Date().toISOString(), boton: btn.textContent.trim().replace(/\s+/g, " ") });
        console.log("%c[Diag Paquetes] clic: " + btn.textContent.trim(), "color:#16a34a;font-weight:bold");
      }
    } catch (err) {}
  }, true);

  // --------------------------------------------------------------------
  //  TABLA DE ORDENAMIENTOS — filas nuevas. Se busca la tabla por su
  //  encabezado ("Código"/"Nombre"/"Cantidad"), no por id/clase (no hay
  //  evidencia de que sean estables). Solo se lee DENTRO de esa tabla.
  // --------------------------------------------------------------------
  function encontrarTablaOrdenamientos() {
    var tablas = Array.from(document.querySelectorAll("table"));
    for (var i = 0; i < tablas.length; i++) {
      var encabezado = normalizar(tablas[i].textContent).slice(0, 400);
      if (encabezado.indexOf("codigo") >= 0 && encabezado.indexOf("cantidad") >= 0) return tablas[i];
    }
    return null;
  }

  function anotarFila(tr) {
    try {
      var celdas = Array.from(tr.querySelectorAll("td")).map(function (td) {
        return td.textContent.trim().replace(/\s+/g, " ");
      });
      if (!celdas.length || celdas.every(function (c) { return !c; })) return;
      filasNuevas.push({ t: new Date().toISOString(), celdas: celdas });
      console.log("%c[Diag Paquetes] fila nueva en Ordenamientos: " + celdas.join(" | "),
        "background:#16a34a;color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold");
    } catch (e) {}
  }

  var observador = null;
  function engancharObservador() {
    var tabla = encontrarTablaOrdenamientos();
    if (!tabla) return false;
    if (observador) observador.disconnect();
    observador = new MutationObserver(function (mutaciones) {
      mutaciones.forEach(function (m) {
        Array.from(m.addedNodes).forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === "TR") anotarFila(n);
          else Array.from(n.querySelectorAll ? n.querySelectorAll("tr") : []).forEach(anotarFila);
        });
      });
    });
    observador.observe(tabla, { childList: true, subtree: true });
    console.log("%c[Diag Paquetes] tabla de Ordenamientos encontrada y vigilada.", "color:#2563eb");
    return true;
  }

  // La tabla puede no existir todavía al pegar el script (si aún no entró a
  // Conducta). Se reintenta cada 2 s hasta encontrarla, sin tocar nada más.
  var intentoTabla = setInterval(function () {
    if (engancharObservador()) clearInterval(intentoTabla);
  }, 2000);

  function desenganchar() {
    try {
      XMLHttpRequest.prototype.open = XHRopen;
      window.fetch = fetchOriginal;
      if (observador) observador.disconnect();
      clearInterval(intentoTabla);
      window.__diagPaquetes.activo = false;
      console.log("%c[Diag Paquetes] Desenganchado. Everest quedó como estaba.",
        "background:#64748b;color:#fff;padding:4px 8px;border-radius:4px");
    } catch (e) {}
  }

  function estado() {
    var s = { peticionesDeRed: red.length, clics: clics.length, filasNuevasVistas: filasNuevas.length };
    console.log("[Diag Paquetes] estado:", s);
    return s;
  }

  function descargar() {
    var salida = {
      t: new Date().toISOString(),
      nota: "Red: solo método+ruta. Clics: solo el texto del botón. Filas: código/nombre/cantidad/nota de Ordenamientos (dato de examen, no del paciente). Nada más se leyó.",
      red: red,
      clics: clics,
      filasNuevas: filasNuevas,
    };
    var texto = JSON.stringify(salida, null, 2);
    try {
      var blob = new Blob([texto], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "diag_paquetes_conducta_" + Date.now() + ".json";
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { a.remove(); URL.revokeObjectURL(a.href); } catch (e) {} }, 1000);
      console.log("%c[Diag Paquetes] Descargado. " + red.length + " peticiones, " + clics.length +
        " clics, " + filasNuevas.length + " fila(s) nueva(s). Ábralo antes de mandarlo.",
        "background:#16a34a;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
    } catch (e) {
      console.log("%c[Diag Paquetes] No se pudo descargar. Copie lo de abajo:", "color:#b45309;font-weight:bold");
      console.log(texto);
    }
    try { navigator.clipboard.writeText(texto); console.log("%c[Diag Paquetes] También quedó copiado al portapapeles.", "color:#16a34a"); } catch (e) {}
    return salida;
  }

  window.__diagPaquetes = { activo: true, descargar: descargar, desenganchar: desenganchar, estado: estado };
  setTimeout(desenganchar, MAX_MIN * 60 * 1000);

  console.log("%c[Diag Paquetes] Grabando. Haga clic en \"Paquetes\", elija un paquete, clic en \"Agregar +\".",
    "background:#1e3a5f;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
  console.log("%cCuando la fila aparezca en la tabla, escriba: __diagPaquetes.descargar()", "color:#16a34a;font-weight:bold");
})();
