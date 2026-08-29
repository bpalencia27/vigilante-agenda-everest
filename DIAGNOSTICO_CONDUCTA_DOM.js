/* ===========================================================================
   DIAGNÓSTICO — FORMA DEL DOM EN CONDUCTA (agregar medicamento, ordenar) — v1
   ---------------------------------------------------------------------------
   PARA QUÉ: dos widgets pendientes necesitan enganchar en el DOM real de la
   pestaña Conducta sin adivinar selectores:
     1. El widget de análisis farmacológico en vivo (junto al botón de
        recetar) — necesita saber cómo se ve el botón/lista cuando usted
        agrega un medicamento.
     2. Confirmar el widget de exámenes ya existente (#vgl-cw-examenes)
        contra el DOM real de una consulta completa, no solo del arnés.

   "Agregar medicamento" probablemente es Angular puro en el cliente (no se
   guarda hasta el Guardar final) — por eso este diagnóstico mira el DOM, no
   la red. DIAGNOSTICO_CARGA_HC.js (ya en el repo, decisión #20 pendiente) es
   el que mira la red al ABRIR la historia; este es su complemento en Conducta.

   ---------------------------------------------------------------------------
   PRIVACIDAD — LÉALO, ES LO MÁS IMPORTANTE DE ESTE ARCHIVO

   NO guarda ni un carácter de texto real de la página. De cada clic o cambio
   anota SOLO:
     · la etiqueta (button, input, div...) y su id/class/name/type/role
       (eso es estructura del script de Everest, no dato del paciente)
     · el LARGO del texto de cada nodo, nunca el texto ("<12 car.>")
     · la ruta de ancestros (tag+id+class de los padres) para saber EN QUÉ
       zona de la pantalla ocurrió, sin decir qué había escrito ahí

   Atributos que SÍ podrían llevar lo que usted escribió (value, title,
   aria-label, innerText) NUNCA se leen — ni redactados: directamente no se
   tocan.

   La red (por si el buscador de medicamentos consulta mientras usted
   escribe) se captura con la MISMA función "forma" que ya usa
   DIAGNOSTICO_CARGA_HC.js: nombres de campo y tipos, nunca valores.

   SOLO LECTURA: no hace clic en nada, no escribe nada, no cambia ningún
   comportamiento de Everest ni del Vigilante.

   ---------------------------------------------------------------------------
   MODO DE USO

   1. F12 -> pestaña "Console". Pegue este archivo entero y Enter. Verá un
      aviso azul — sigue grabando aunque cambie de pestaña dentro de Everest.
   2. Atienda normal. Cuando llegue a Conducta: agregue al menos un
      medicamento (uno cualquiera, no importa cuál) y use el botón de
      ordenar/paquetes. Eso es lo único que hace falta capturar.
   3. Al terminar la consulta (o varias, si quiere acumular más de una):
        __diagConducta.detener()
      Descarga un .json ya redactado y lo copia al portapapeles. Puede
      pegarme el contenido directo, o mandarme el archivo — ya es seguro,
      no lleva nada suyo ni del paciente.
   4. Para ver cuánto lleva sin detener:  __diagConducta.estado()
   =========================================================================== */
(function () {
  "use strict";

  if (window.__diagConducta && window.__diagConducta.activo) {
    console.log("%c[Diag Conducta] Ya estaba grabando. Escriba __diagConducta.detener() para terminar.", "background:#b45309;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
    return;
  }

  var MAX_EVENTOS = 2000;
  var inicio = Date.now();
  var desdeIso = new Date(inicio).toISOString();
  var eventos = [];

  function empujar(tipo, datos) {
    if (eventos.length >= MAX_EVENTOS) eventos.shift();
    var e = { t: Date.now() - inicio, tipo: tipo };
    for (var k in datos) e[k] = datos[k];
    eventos.push(e);
  }

  // -------- misma función "forma" que DIAGNOSTICO_CARGA_HC.js, para la red --------
  function forma(v, profundidad) {
    profundidad = profundidad || 0;
    if (profundidad > 6) return { tipo: "(demasiado anidado)" };
    if (v === null) return { tipo: "nulo", vacio: true };
    if (v === undefined) return { tipo: "ausente", vacio: true };
    if (typeof v === "boolean") return { tipo: "sí/no", vacio: false };
    if (typeof v === "number") return { tipo: "número", vacio: false };
    if (typeof v === "string") {
      var s = v.trim();
      return { tipo: "texto", vacio: s.length === 0, largo: s.length };
    }
    if (Array.isArray(v)) {
      return { tipo: "lista", vacio: v.length === 0, elementos: v.length, primero: v.length ? forma(v[0], profundidad + 1) : null };
    }
    if (typeof v === "object") {
      var campos = {}, claves = Object.keys(v);
      for (var i = 0; i < claves.length && i < 200; i++) campos[claves[i]] = forma(v[claves[i]], profundidad + 1);
      return { tipo: "objeto", campos: campos };
    }
    return { tipo: "?" };
  }

  function rutaDe(url) {
    var r = url;
    try { r = new URL(url, location.href).pathname; } catch (e) {}
    return String(r || "").replace(/\d{6,}/g, "######");
  }

  // -------- forma de un elemento: SOLO estructura, nunca texto ni value/title --------
  var ATRIBUTOS_SEGUROS = ["id", "class", "name", "type", "role", "data-accion"];
  function formaNodo(el, profundidad) {
    if (!el) return "";
    if (profundidad > 4) return "<...>";
    if (el.nodeType === 3) {
      var n = (el.textContent || "").trim().length;
      return n ? "<texto:" + n + ">" : "";
    }
    if (el.nodeType !== 1) return "";
    var tag = el.tagName.toLowerCase();
    var atrs = "";
    for (var i = 0; i < ATRIBUTOS_SEGUROS.length; i++) {
      var a = ATRIBUTOS_SEGUROS[i];
      if (el.hasAttribute && el.hasAttribute(a)) atrs += " " + a + '="' + el.getAttribute(a) + '"';
    }
    var hijos = "";
    var nodos = el.childNodes || [];
    for (var j = 0; j < nodos.length && j < 20; j++) hijos += formaNodo(nodos[j], profundidad + 1);
    return "<" + tag + atrs + ">" + hijos + "</" + tag + ">";
  }

  // -------- ruta de ancestros: dónde ocurrió, sin decir qué había --------
  function rutaAncestros(el) {
    var partes = [];
    var n = el, tope = 8;
    while (n && n.nodeType === 1 && tope-- > 0) {
      var d = n.tagName.toLowerCase();
      if (n.id) d += "#" + n.id;
      if (n.className && typeof n.className === "string" && n.className.trim()) d += "." + n.className.trim().split(/\s+/).slice(0, 4).join(".");
      partes.unshift(d);
      n = n.parentElement;
    }
    return partes.join(" > ");
  }

  // ---------- red: solo forma, mismo patrón que DIAGNOSTICO_CARGA_HC.js ----------
  var LIM = 20000;
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var metodo = (init && init.method) || (input && input.method) || "GET";
      var ruta = rutaDe(url);
      var t0 = Date.now();
      return origFetch(input, init).then(function (r) {
        r.clone().text().then(function (txt) {
          var f;
          try { f = forma(JSON.parse(txt.length > LIM ? txt.slice(0, LIM) : txt), 0); }
          catch (e) { f = { tipo: "no-json", largo: txt.length }; }
          empujar("red", { metodo: metodo, ruta: ruta, status: r.status, ms: Date.now() - t0, forma: f });
        }).catch(function () {});
        return r;
      }).catch(function (e) {
        empujar("red", { metodo: metodo, ruta: ruta, status: 0, ms: Date.now() - t0, err: String((e && e.message) || e) });
        throw e;
      });
    };
  }
  var OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    window.XMLHttpRequest = function () {
      var xhr = new OrigXHR();
      var metodo = "GET", ruta = "", t0 = 0;
      var origOpen = xhr.open;
      xhr.open = function (m, u) { metodo = m; ruta = rutaDe(u); return origOpen.apply(xhr, arguments); };
      xhr.addEventListener("loadstart", function () { t0 = Date.now(); });
      xhr.addEventListener("loadend", function () {
        var f;
        try { f = forma(JSON.parse((xhr.responseText || "").slice(0, LIM)), 0); }
        catch (e) { f = { tipo: "no-json", largo: (xhr.responseText || "").length }; }
        empujar("red", { metodo: metodo, ruta: ruta, status: xhr.status, ms: Date.now() - t0, forma: f });
      });
      return xhr;
    };
    window.XMLHttpRequest.prototype = OrigXHR.prototype;
  }

  // ---------- clics y cambios: en TODA la página (no se adivina la zona), solo forma ----------
  function onClick(e) {
    try {
      var el = (e.target.closest && e.target.closest("button,a,input,select,textarea,.btn,[role=button],li,td")) || e.target;
      empujar("clic", { donde: rutaAncestros(el), estructura: formaNodo(el, 0).slice(0, 3000) });
    } catch (x) {}
  }
  function onCambio(e) {
    try {
      var el = e.target;
      if (!(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"))) return;
      empujar("cambio", { donde: rutaAncestros(el), estructura: formaNodo(el, 0).slice(0, 1500) });
    } catch (x) {}
  }
  document.addEventListener("click", onClick, true);
  document.addEventListener("input", onCambio, true);
  document.addEventListener("change", onCambio, true);

  function descargar() {
    var T = { inicio: desdeIso, fin: new Date().toISOString(), eventos: eventos };
    var texto = JSON.stringify(T, null, 1);
    try {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
      var d = new Date(), p = function (x) { return String(x).padStart(2, "0"); };
      a.download = "diag_conducta_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.warn("[Diag Conducta] no se pudo descargar solo:", e); }
    try { copy(texto); console.log("%c(también copiado al portapapeles)", "color:#4a4"); } catch (e) {}
    return T;
  }

  window.__diagConducta = {
    activo: true,
    marcar: function (nota) { empujar("nota", { msg: String(nota || "").slice(0, 300) }); console.log("%c[Diag Conducta] nota guardada", "color:#10b981"); },
    estado: function () { console.log("[Diag Conducta] activo desde " + desdeIso + " · " + eventos.length + " evento(s)."); return eventos.length; },
    detener: function () {
      if (!this.activo) { console.log("[Diag Conducta] ya estaba detenido."); return; }
      this.activo = false;
      if (origFetch) window.fetch = origFetch;
      if (OrigXHR) window.XMLHttpRequest = OrigXHR;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onCambio, true);
      document.removeEventListener("change", onCambio, true);
      var T = descargar();
      console.log("%c[Diag Conducta] detenido — " + eventos.length + " evento(s). Archivo descargado y copiado; ya es seguro pegármelo o enviármelo.", "color:#2563eb;font-weight:700");
      return T;
    },
  };

  console.log("%c[Diag Conducta] grabando SOLO estructura (nunca texto ni datos de paciente) — atienda normal. Al terminar: __diagConducta.detener()", "color:#2563eb;font-weight:700");
  console.log("Nota opcional en el momento exacto: __diagConducta.marcar(\"aquí agregué el medicamento\")");
})();
