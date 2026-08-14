// =====================================================================
//  Envío de órdenes por correo al paciente (v12.3.17) — extractAgrupador,
//  apiOrdenamientoGenerarLinks, apiEnviarOrdenPorCorreo, ordenesDetalleHoy.
//
//  Contrato de red confirmado con telemetría REAL de consultorio (8 ago
//  2026, VIGILANTE_AGENDA_RESCATE/everest_telemetry_PRO_*.json), no
//  adivinado: cada URL se verifica byte a byte contra lo capturado.
// =====================================================================
module.exports = {
  nombre: "Correo de órdenes al paciente (Suite 20)",
  cubre: ["extractAgrupador", "apiOrdenamientoGenerarLinks", "apiEnviarOrdenPorCorreo", "ordenesDetalleHoy"],
  async pruebas(t, api, env, cargar) {

    // ---------- extractAgrupador ----------
    t.caso("extractAgrupador: directo, anidado en .data, ausente, número y arreglo", () => {
      t.igual(api.extractAgrupador({ agrupador: "1226083463" }), "1226083463");
      t.igual(api.extractAgrupador({ Agrupador: "1226083463" }), "1226083463");
      t.igual(api.extractAgrupador({ data: { agrupador: "1226083470" } }), "1226083470");
      t.igual(api.extractAgrupador({ data: { Grupo: "999" } }), "999");
      t.igual(api.extractAgrupador({ foo: 1, bar: "sin nada util" }), null);
      t.igual(api.extractAgrupador(null), null);
      t.igual(api.extractAgrupador(1226083463), "1226083463");
      t.igual(api.extractAgrupador([{ agrupador: "1226083470" }]), "1226083470");
    });

    // ---------- apiOrdenamientoGenerarLinks (best-effort) ----------
    await t.casoAsync("apiOrdenamientoGenerarLinks: llama la URL real y nunca lanza aunque falle", async () => {
      let vista = null;
      const c = cargar({ silencioso: true, fetch: async (url) => { vista = url; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "{}", clone() { return this; } }; } });
      await c.api.apiOrdenamientoGenerarLinks(540174, "1226083463");
      t.cierto(vista.includes("/apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos"));
      t.cierto(vista.includes("PacienteId=540174"));
      t.cierto(vista.includes("Agrupador=1226083463"));

      // best-effort real: si la red falla, la función NO debe lanzar — si lanzara, el
      // await de abajo propagaría el error y t.casoAsync marcaría esta prueba como
      // fallida sola, sin necesitar un try/catch propio aquí. pageFetchJson tiene un
      // FALLBACK a GM_xmlhttpRequest cuando fetch falla: hay que darle también un gmxhr
      // que rechace (onerror), o el no-op por defecto del arnés deja la promesa colgada
      // para siempre — la misma familia de bug cazada en toda la sesión, esta vez en la
      // propia prueba.
      const c2 = cargar({ silencioso: true, fetch: async () => { throw new Error("caída de red"); }, gmxhr: (o) => o.onerror(new Error("sin red tampoco por GM")) });
      await c2.api.apiOrdenamientoGenerarLinks(1, "2");
    });

    // ---------- apiEnviarOrdenPorCorreo ----------
    await t.casoAsync("apiEnviarOrdenPorCorreo: URL exacta confirmada por telemetría real, con el correo codificado", async () => {
      let vista = null;
      const c = cargar({ silencioso: true, fetch: async (url) => { vista = url; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "", clone() { return this; } }; } });
      const ok = await c.api.apiEnviarOrdenPorCorreo("1226083463", "paciente@ejemplo.com", 515);
      t.cierto(ok, "HTTP 200/ok debe reportar éxito");
      t.igual(vista, "https://neps.everestintelligent.com/apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento?Grupo=1226083463&Correo=paciente%40ejemplo.com&UsuarioId=515");
    });

    await t.casoAsync("apiEnviarOrdenPorCorreo: HTTP de error reporta false, sin lanzar", async () => {
      const c = cargar({ silencioso: true, fetch: async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}), text: async () => "error interno", clone() { return this; } }) });
      const ok = await c.api.apiEnviarOrdenPorCorreo("1226083463", "x@y.com", 515);
      t.falso(ok);
    });

    await t.casoAsync("apiEnviarOrdenPorCorreo: fallo de red reporta false, sin lanzar", async () => {
      const c = cargar({ silencioso: true, fetch: async () => { throw new Error("sin conexión"); } });
      const ok = await c.api.apiEnviarOrdenPorCorreo("1226083463", "x@y.com", 515);
      t.falso(ok);
    });

    // ---------- ordenesDetalleHoy ----------
    t.caso("ordenesDetalleHoy: null sin marcar; guarda y deduplica los agrupadores tras marcar", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.ordenesDetalleHoy("123456789"), null);

      c.api.markOrdenesCreadasHoy("123456789", ["1226083463", "1226083463", "1226083470"]);
      const det = c.api.ordenesDetalleHoy("123456789");
      t.cierto(!!det, "debe existir detalle tras marcar con agrupadores");
      t.igual(det.agrupadores, ["1226083463", "1226083470"], "el agrupador repetido se deduplica");
      t.cierto(typeof det.ts === "number" && det.ts > 0);

      // otro paciente no se contamina
      t.igual(c.api.ordenesDetalleHoy("999999999"), null);

      // una segunda marca el mismo día ACUMULA agrupadores nuevos sin perder los previos
      c.api.markOrdenesCreadasHoy("123456789", ["555"]);
      const det2 = c.api.ordenesDetalleHoy("123456789");
      t.igual(det2.agrupadores, ["1226083463", "1226083470", "555"]);
    });

    t.caso("ordenesDetalleHoy: marcar SIN agrupadores no rompe el detalle ya guardado", () => {
      const c = cargar({ silencioso: true });
      c.api.markOrdenesCreadasHoy("123456789", ["1226083463"]);
      c.api.markOrdenesCreadasHoy("123456789");   // llamada vieja, sin segundo argumento
      const det = c.api.ordenesDetalleHoy("123456789");
      t.igual(det.agrupadores, ["1226083463"], "el detalle previo se conserva intacto");
      t.cierto(c.api.isOrdenesCreadasHoy("123456789"));
    });
  },
};
