// Pega esto en la consola (F12) de la pestaña de Athenea (medicosviva1a.atheneasoluciones.com),
// con la página de resultados de un paciente abierta. No toca ni escribe nada en Athenea:
// solo ESCUCHA las peticiones que el propio portal ya hace cuando tú haces clic.
//
// Después de pegarlo: haz clic en "Ver Resumen" de UNA solicitud, espera a que abra,
// y luego haz clic en "Ver Informe" de esa misma solicitud (se abre en pestaña nueva o
// descarga un archivo — está bien, ya habremos capturado la petición antes de que pase).
// Copia TODAS las líneas que empiecen con [VGL-RED] y pégamelas de vuelta.
(function () {
  var orig = window.fetch;
  window.fetch = function () {
    var url = arguments[0], opts = arguments[1] || {};
    var p = orig.apply(this, arguments);
    p.then(function (r) {
      try {
        r.clone().text().then(function (t) {
          console.log("[VGL-RED] fetch", (opts.method || "GET"), String(url), "status=" + r.status, "cuerpo(2000):", t.slice(0, 2000));
        }).catch(function () {});
      } catch (e) {}
    }).catch(function () {});
    return p;
  };
  var OrigXHR = window.XMLHttpRequest;
  var origOpen = OrigXHR.prototype.open;
  var origSend = OrigXHR.prototype.send;
  OrigXHR.prototype.open = function (method, url) { this._vglM = method; this._vglU = url; return origOpen.apply(this, arguments); };
  OrigXHR.prototype.send = function (body) {
    var self = this;
    this.addEventListener("load", function () {
      var ct = "";
      try { ct = self.getResponseHeader("Content-Type") || ""; } catch (e) {}
      var cuerpo = /pdf|octet-stream|application\/vnd/i.test(ct) ? "(binario: " + ct + ", " + (self.response ? self.response.byteLength || self.responseText.length : "?") + " bytes)" : String(self.responseText || "").slice(0, 2000);
      console.log("[VGL-RED] xhr", self._vglM, self._vglU, "status=" + self.status, "tipo=" + ct, "cuerpo(2000):", cuerpo);
    });
    return origSend.apply(this, arguments);
  };
  // También intercepta si "Ver Informe" navega la página entera (form submit normal, sin AJAX).
  document.addEventListener("submit", function (e) {
    try {
      var f = e.target;
      console.log("[VGL-RED] envío de formulario", f.method, f.action, "campos:", [...new FormData(f).keys()]);
    } catch (err) {}
  }, true);
  console.log("[VGL-RED] listo. Ahora: 1) clic en 'Ver Resumen' de una solicitud, 2) clic en 'Ver Informe' de esa misma solicitud. Copia todas las líneas [VGL-RED].");
})();
