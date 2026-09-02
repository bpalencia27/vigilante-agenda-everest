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
  cubre: ["extractAgrupador", "apiOrdenamientoGenerarLinks", "_urlImpresionOrdenPyM", "apiEnviarOrdenPorCorreo", "ordenesDetalleHoy"],
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
    await t.casoAsync("apiOrdenamientoGenerarLinks: llama la URL real y devuelve el cuerpo TEXTO PLANO capturado (la URL de impresión)", async () => {
      let vista = null;
      // v12.6.5 — El cuerpo real capturado en consultorio NO es JSON: es la URL, en texto
      // plano. Por eso el mock ya no devuelve un objeto por json(): resp.json() lanzaba,
      // pageFetchJson lo tomaba por caída de red y terminaba devolviendo null — la URL
      // buena se perdía y se abría la reconstruida a mano, que daba 404.
      const urlReal = "https://neps.everestintelligent.com/apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=1226083463&idPaciente=540174";
      let vistaOpts = null;
      const c = cargar({ silencioso: true, fetch: async (url, opts) => { vista = url; vistaOpts = opts; return { ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new Error("no es JSON"); }, text: async () => urlReal, clone() { return this; } }; } });
      const res = await c.api.apiOrdenamientoGenerarLinks(540174, "1226083463");
      t.cierto(vista.includes("/apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos"));
      t.cierto(vista.includes("PacienteId=540174"));
      t.cierto(vista.includes("Agrupador=1226083463"));
      t.cierto(!!vistaOpts && !!vistaOpts.headers && vistaOpts.headers["Accept"] === "application/json", "debe solicitar Accept: application/json");
      t.igual(res, urlReal, "la URL del servidor llega intacta a quien la llama (imprimirOrdenPyM)");
      t.igual(c.api._urlImpresionOrdenPyM(res), urlReal, "y es la que se abre, sin reconstruir nada");

      // Si Everest algún día la envuelve en JSON, también se entiende.
      const c3 = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ url: urlReal }), clone() { return this; } }) });
      t.igual(c3.api._urlImpresionOrdenPyM(await c3.api.apiOrdenamientoGenerarLinks(1, "2")), urlReal);

      // best-effort real: si la red falla, la función NO debe lanzar — si lanzara, el
      // await de abajo propagaría el error y t.casoAsync marcaría esta prueba como
      // fallida sola, sin necesitar un try/catch propio aquí. Devuelve null, y entonces
      // imprimirOrdenPyM cae a su URL de respaldo en vez de quedarse sin nada que abrir.
      const c2 = cargar({ silencioso: true, fetch: async () => { throw new Error("caída de red"); } });
      t.igual(await c2.api.apiOrdenamientoGenerarLinks(1, "2"), null);
    });

    // ---------- apiEnviarOrdenPorCorreo ----------
    // v12.6.6 — El tercer argumento es el id del PACIENTE, no el del médico. En la grabación
    // real del consultorio, Everest manda EnviarEmailOrdenamiento?...&UsuarioId=801848 en la
    // misma corrida en que GenerarLinksImpresionOrdenamientos va con PacienteId=801848,
    // siendo 309 el médico. Aquí se fija el contrato byte a byte con ese id de paciente.
    await t.casoAsync("apiEnviarOrdenPorCorreo: URL exacta confirmada por telemetría real (UsuarioId = id del PACIENTE)", async () => {
      let vista = null;
      const c = cargar({ silencioso: true, fetch: async (url) => { vista = url; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "", clone() { return this; } }; } });
      const ok = await c.api.apiEnviarOrdenPorCorreo("1226083463", "paciente@ejemplo.com", 801848);
      t.cierto(ok, "HTTP 200/ok debe reportar éxito");
      t.igual(vista, "https://neps.everestintelligent.com/apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento?Grupo=1226083463&Correo=paciente%40ejemplo.com&UsuarioId=801848");
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

    // v18.0.108 — S+ robustez (B6): «Enviar órdenes al correo» daba por enviado con solo resp.ok;
    // un 200 con error:true se anunciaba como enviado (el mismo defecto que v17.6.2 corrigió
    // para el SMS). Sin captura del cuerpo real, la cautela es la de v17.0.3: solo se rechaza lo
    // que el cuerpo declara rechazado.
    await t.casoAsync("v18.0.108 (S+ B6): el correo de las órdenes no se da por enviado con un 200 que trae error:true; un cuerpo vacío o no JSON no cambia el veredicto", async () => {
      const mk = (body, ok) => cargar({ silencioso: true, fetch: async () => ({ ok: ok !== false, status: ok === false ? 500 : 200, headers: { get: () => null }, json: async () => { if (body === null) throw new Error("no JSON"); return body; }, text: async () => (body === null ? "ok" : JSON.stringify(body)), clone() { return this; } }) });
      t.igual(await mk({ error: true, mensaje: "rechazado" }).api.apiEnviarOrdenPorCorreo("AGP-1", "correo@prueba.co", 1), false, "200 con error:true → NO enviado (antes: enviado)");
      t.igual(await mk({ error: false }).api.apiEnviarOrdenPorCorreo("AGP-1", "correo@prueba.co", 1), true, "200 con error:false → enviado");
      t.igual(await mk(null).api.apiEnviarOrdenPorCorreo("AGP-1", "correo@prueba.co", 1), true, "200 sin JSON → enviado (solo se rechaza lo declarado)");
      t.igual(await mk({}, false).api.apiEnviarOrdenPorCorreo("AGP-1", "correo@prueba.co", 1), false, "500 → no enviado");
    });

  },
};
