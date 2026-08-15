// Pega esto en la consola (F12) de la pestaña de Athenea, ESTANDO YA en la página de
// solicitudes de BERNARDA DE JESUS GONZALEZ ALVAREZ (la de la captura), y luego
// RECARGA la página (F5) — es importante recargar DESPUÉS de pegar el script, para
// que quede escuchando desde el primer instante en que la página pide sus datos.
// No hace falta hacer clic en nada más.
//
// Busca específicamente el número de solicitud "26051503125" (el de la captura) o
// una fecha con pinta de 2026-05-15 / 15-05-2026 / 15/05/2026 en CUALQUIER respuesta
// de red — así sabemos si la fecha viaja en el HTML de la página o en otra llamada
// aparte que el script nunca ha visitado.
(function () {
  const PISTA = /26051503125|2026-05-15|15-05-2026|15\/05\/2026|05\/15\/2026/;
  const orig = window.fetch;
  window.fetch = function () {
    const url = arguments[0], opts = arguments[1] || {};
    const p = orig.apply(this, arguments);
    p.then((r) => {
      r.clone().text().then((t) => {
        if (PISTA.test(t) || PISTA.test(String(url))) {
          console.log("[VGL-FECHA] fetch", (opts.method || "GET"), String(url), "status=" + r.status,
            "· contiene la pista:", PISTA.test(t) ? "SÍ en el cuerpo" : "SÍ en la URL",
            "· cuerpo (3000):", t.slice(0, 3000));
        }
      }).catch(() => {});
    }).catch(() => {});
    return p;
  };
  const OrigXHR = window.XMLHttpRequest, oo = OrigXHR.prototype.open, os = OrigXHR.prototype.send;
  OrigXHR.prototype.open = function (m, u) { this._vm = m; this._vu = u; return oo.apply(this, arguments); };
  OrigXHR.prototype.send = function () {
    const self = this;
    this.addEventListener("load", function () {
      const t = String(self.responseText || "");
      if (PISTA.test(t) || PISTA.test(String(self._vu))) {
        console.log("[VGL-FECHA] xhr", self._vm, self._vu, "status=" + self.status,
          "· contiene la pista:", PISTA.test(t) ? "SÍ en el cuerpo" : "SÍ en la URL",
          "· cuerpo (3000):", t.slice(0, 3000));
      }
    });
    return os.apply(this, arguments);
  };
  console.log("[VGL-FECHA] listo. AHORA RECARGA la página (F5) para capturar la carga inicial de las solicitudes. Si no aparece ninguna línea [VGL-FECHA] tras recargar, la fecha no viaja por fetch/xhr — avísame.");
})();
