// =====================================================================
//  SUITE 05 — Llamadas a Everest y clínicas
//
//  CÓMO SE SIMULA LA RED AQUÍ (importante, ya se rompió una vez):
//  _pageFetchJsonCore resuelve el transporte con `const f = FETCH0 || window.fetch`,
//  y FETCH0 se captura UNA vez al cargar el script (justo para que el JS de Everest
//  no pueda cambiárselo a mitad de sesión). Por eso reasignar `c.env.win.fetch`
//  DESPUÉS de cargar() no intercepta nada: FETCH0 ya guarda el original. El mock
//  tiene que entrar POR cargar({ fetch }), que es lo que el arnés instala antes de
//  ejecutar el script.
//
//  Estas 8 pruebas vivieron rotas y en silencio: `pruebas()` no era async y los
//  t.casoAsync se llamaban sin await, así que sus aserciones resolvían DESPUÉS de
//  que el runner ya había cerrado la cuenta de la suite. El banco mostraba
//  "Llamadas a Everest y clínicas — 1 ok" con 8 casos, 6 de ellos fallando. Es la
//  suite que cubre las llamadas que CREAN citas (apiAccesoAsignarTurno) y órdenes
//  clínicas (apiOrdenamientoGuardar): la cobertura falsa era peor que no tenerla.
// =====================================================================

// Respuesta con la forma completa que espera _pageFetchJsonCore (headers/text/clone
// incluidos: el núcleo los consulta para decidir si la respuesta es JSON utilizable).
const respuesta = (data) => ({
  ok: true, status: 200,
  headers: { get: () => "application/json" },
  json: async () => data,
  text: async () => JSON.stringify(data),
  clone() { return this; },
});

module.exports = {
  nombre: "Llamadas a Everest y clínicas",
  cubre: ["apiOrdenamientoGuardar", "apiAccesoAsignarTurno", "_pageFetchJsonCore", "pageFetchJson", "extractPatientId", "apiAccesoBuscarPaciente", "apiOrdenamientoObtenerDx", "apiOrdenamientoObtenerCup", "apiOrdenamientoBuscarPaciente", "fetchAtheneaLabs"],
  async pruebas(t, api, env, cargar) {
    await t.casoAsync("apiOrdenamientoGuardar construye payload correctamente y llama al endpoint", async () => {
      let fetchUrl, fetchOpts;
      const c = cargar({
        silencioso: true,
        fetch: async (url, opts) => { fetchUrl = url; fetchOpts = opts; return respuesta({ id: "ok" }); },
      });
      c.api.__state.activeDoctor = { id: 777, name: "TEST DOCTOR" };

      const res = await c.api.apiOrdenamientoGuardar("pac123", "dx456", [{ Id: "cup1", Descripcion: "desc1" }]);
      t.cierto(res !== null);
      t.cierto(!!fetchUrl && fetchUrl.includes("/GuardarOrdenamiento"), "la orden va al endpoint de GuardarOrdenamiento");

      const payload = JSON.parse(fetchOpts.body);
      t.igual(payload.UsuarioId, 777, "la orden se crea a nombre del médico en turno");
      t.igual(payload.DiagnosticoId, "dx456");
      t.igual(payload.paciente.Id, "pac123");
      t.igual(payload.ordenes[0].cup.Id, "cup1");
      // v11.0.1 — una ESCRITURA no se reintenta: ocho POST serían ocho órdenes reales.
      t.igual(String(fetchOpts.method).toUpperCase(), "POST");
    });

    await t.casoAsync("apiAccesoAsignarTurno aborta si no hay ID de médico (v12.0.0)", async () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor = { id: 0, name: "" };
      c.api.__S.medicoId = 0;

      const res = await c.api.apiAccesoAsignarTurno("turno", "pac123", "2026-08-10", "obs");
      t.cierto(res.error);
      t.cierto(res.mensaje.includes("NO se creó la cita"));
    });

    await t.casoAsync("apiAccesoAsignarTurno evalúa swPyM y SwProgramaEspecial basandose en el nombre del medico", async () => {
      let fetchUrl;
      const c = cargar({
        silencioso: true,
        fetch: async (url) => { fetchUrl = url; return respuesta({ id: "ok" }); },
      });
      c.api.__state.activeDoctor = { id: 777, name: "BRANDON PALENCIA" }; // médico de RCV

      await c.api.apiAccesoAsignarTurno("turnoId", "pac123", "2026-08-10", "obs");
      t.cierto(!!fetchUrl, "la cita sí sale a la red cuando hay médico identificado");
      t.cierto(fetchUrl.includes("swIsPyM=true"));
      t.cierto(fetchUrl.includes("SwProgramaEspecial=true"));
    });

    t.caso("extractPatientId extrae el ID interno de Everest desde cualquier respuesta de la API", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.extractPatientId(123), 123);
      t.igual(c.api.extractPatientId("456"), 456);
      t.igual(c.api.extractPatientId([{ idPaciente: 789 }]), 789);
      t.igual(c.api.extractPatientId({ data: { pacienteId: 1011 } }), 1011);

      // Debe ignorar keys en la lista negra
      const trampa = {
        eps: { id: 2 },
        sedes: { Id: 12 },
        data: { paciente_id: 555 }
      };
      t.igual(c.api.extractPatientId(trampa), 555);
    });

    await t.casoAsync("apiAccesoBuscarPaciente busca la data usando documento y extrae ID", async () => {
      // Firma real: UN solo argumento (docId). La versión vieja de esta prueba pasaba
      // ("CC", "12345678"), así que docId valía "CC", se quedaba sin dígitos al limpiarlo
      // y la función salía por `if (!cleanDoc) return null` sin tocar la red — no probaba
      // absolutamente nada. El parámetro de la URL es `identificacion`, no
      // `NumeroIdentificacion`.
      let fetchUrl;
      const c = cargar({
        silencioso: true,
        fetch: async (url) => { fetchUrl = url; return respuesta([{ pacienteId: 999 }]); },
      });

      const res = await c.api.apiAccesoBuscarPaciente("12345678");
      t.cierto(!!fetchUrl && fetchUrl.includes("identificacion=12345678"), "el documento viaja en la URL");
      t.igual(res, 999);
    });

    await t.casoAsync("apiAccesoBuscarPaciente: un documento sin dígitos no llega a la red (jamás una búsqueda a ciegas)", async () => {
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { llamadas++; return respuesta([{ pacienteId: 999 }]); },
      });

      t.igual(await c.api.apiAccesoBuscarPaciente("CC"), null, "'CC' no tiene dígitos: no es un documento");
      t.igual(await c.api.apiAccesoBuscarPaciente(""), null);
      t.igual(await c.api.apiAccesoBuscarPaciente(null), null);
      t.igual(llamadas, 0, "ninguna de las tres sale a la red");
    });

    await t.casoAsync("apiOrdenamientoObtenerDx busca diagnóstico en la API y lo cachea", async () => {
      let fetchCount = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { fetchCount++; return respuesta([{ Codigo: "I10X", Id: "dx999" }]); },
      });

      const dxId = await c.api.apiOrdenamientoObtenerDx("I10X");
      t.igual(dxId, "dx999");
      t.igual(fetchCount, 1);

      // Siguiente llamada debería usar la caché
      const dxId2 = await c.api.apiOrdenamientoObtenerDx("I10X");
      t.igual(dxId2, "dx999");
      t.igual(fetchCount, 1, "No debería llamar a fetch de nuevo");
    });

    await t.casoAsync("apiOrdenamientoObtenerCup busca un CUPS para un paciente en la API y lo cachea", async () => {
      let fetchCount = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { fetchCount++; return respuesta([{ Codigo: "902207", Id: "cup999", Descripcion: "Prueba" }]); },
      });

      const cup = await c.api.apiOrdenamientoObtenerCup("pac1", "902207");
      t.cierto(!!cup, "el CUPS se resuelve");
      t.igual(cup.Id, "cup999");
      t.igual(cup.Descripcion, "Prueba");
      t.igual(fetchCount, 1);

      // Cache
      const cup2 = await c.api.apiOrdenamientoObtenerCup("pac1", "902207");
      t.igual(cup2.Id, "cup999");
      t.igual(fetchCount, 1);
    });

    await t.casoAsync("apiOrdenamientoBuscarPaciente busca paciente por doc y extrae Id", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => respuesta({ Id: 111 }),
      });

      const pacId = await c.api.apiOrdenamientoBuscarPaciente("CC 123456");
      t.igual(pacId, 111);
    });

    // v12.3.3 — getAtheneaIdSolicitudAuto (bridge a localhost:5050) fue REEMPLAZADA por el
    // puente real getAtheneaSolicitudesAuto/getAtheneaLabsAuto (ver suite_18_athenea_sesion.js):
    // ese servidor nunca existió en el repo, era código muerto en todos los equipos.

    await t.casoAsync("fetchAtheneaLabs intenta multiples anos si no se especifica", async () => {
      let fetchCalls = [];
      const c = cargar({
        silencioso: true,
        gmxhr: (opts) => {
          const payload = JSON.parse(opts.data);
          fetchCalls.push(payload.ano);
          opts.onload({ status: 200, responseText: JSON.stringify({ dataObject: [] }) }); // vacío: dispara el reintento del siguiente año
        },
      });

      try {
        await c.api.fetchAtheneaLabs(5555);
      } catch (e) {
        // se espera que rechace si ningún año trae datos
      }

      t.igual(fetchCalls.length, 3);
      t.cierto(fetchCalls.includes(new Date().getFullYear()));
    });

    // --- Pruebas de guardas de SMS (TAREA B1) ---
    // Montaje común para (a)-(d): mock de fetch que registra URLs
    await t.casoAsync("apiAccesoAsignarTurno dispara SMS correctamente al paciente (caso base)", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, fetch: async (url) => {
        urls.push(String(url));
        return respuesta({ error: false, data: { radicado: 123 } });
      } });
      c.api.__state.activeDoctor = { id: 777, name: "MEDICO PRUEBA" };
      c.api.__S.smsRecordatorio = true;
      c.env.doc.querySelector = () => ({ getAttribute: () => "tok" });

      await c.api.apiAccesoAsignarTurno("T1", "P1", "2026-09-15", "obs", false, "NA", null, "3001234567");

      const smsSent = urls.some(u => u.includes("/api/SMS/EnviarSMS") && u.includes("Telefono=3001234567") && u.includes("AgendaTurnoId=T1"));
      t.cierto(smsSent, "se dispara la URL de EnviarSMS con el teléfono y turno correctos");
    });

    await t.casoAsync("apiAccesoAsignarTurno NO dispara SMS si smsRecordatorio está apagado", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, fetch: async (url) => {
        urls.push(String(url));
        return respuesta({ error: false, data: { radicado: 123 } });
      } });
      c.api.__state.activeDoctor = { id: 777, name: "MEDICO PRUEBA" };
      c.api.__S.smsRecordatorio = false; // APAGADO
      c.env.doc.querySelector = () => ({ getAttribute: () => "tok" });

      await c.api.apiAccesoAsignarTurno("T1", "P1", "2026-09-15", "obs", false, "NA", null, "3001234567");

      const smsSent = urls.some(u => u.includes("/api/SMS/EnviarSMS"));
      t.cierto(!smsSent, "NO sale mensaje a la red");
    });

    await t.casoAsync("apiAccesoAsignarTurno NO dispara SMS si el celular tiene menos de 7 digitos", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, fetch: async (url) => {
        urls.push(String(url));
        return respuesta({ error: false, data: { radicado: 123 } });
      } });
      c.api.__state.activeDoctor = { id: 777, name: "MEDICO PRUEBA" };
      c.api.__S.smsRecordatorio = true;
      c.env.doc.querySelector = () => ({ getAttribute: () => "tok" });

      await c.api.apiAccesoAsignarTurno("T1", "P1", "2026-09-15", "obs", false, "NA", null, "12345"); // 5 digitos

      const smsSent = urls.some(u => u.includes("/api/SMS/EnviarSMS"));
      t.cierto(!smsSent, "NO sale SMS si el celular es muy corto");
    });

    await t.casoAsync("apiAccesoAsignarTurno NO dispara SMS si la cita NO fue creada en el backend", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, fetch: async (url) => {
        urls.push(String(url));
        return respuesta({ error: true }); // Error al crear cita
      } });
      c.api.__state.activeDoctor = { id: 777, name: "MEDICO PRUEBA" };
      c.api.__S.smsRecordatorio = true;
      c.env.doc.querySelector = () => ({ getAttribute: () => "tok" });

      await c.api.apiAccesoAsignarTurno("T1", "P1", "2026-09-15", "obs", false, "NA", null, "3001234567");

      // Otro caso: radicado = 0
      const c2 = cargar({ silencioso: true, fetch: async (url) => {
        urls.push(String(url));
        return respuesta({ error: false, data: { radicado: 0 } }); // No creada realmente
      } });
      c2.api.__state.activeDoctor = { id: 777, name: "MEDICO PRUEBA" };
      c2.api.__S.smsRecordatorio = true;
      c2.env.doc.querySelector = () => ({ getAttribute: () => "tok" });

      await c2.api.apiAccesoAsignarTurno("T2", "P2", "2026-09-15", "obs", false, "NA", null, "3001234567");

      const smsSent = urls.some(u => u.includes("/api/SMS/EnviarSMS"));
      t.cierto(!smsSent, "NO sale SMS si error es true o radicado es 0");
    });

    await t.casoAsync("apiAccesoAsignarTurno no silencia el fallo al enviar el SMS", async () => {
      const urls = [];
      const warns = [];
      const c = cargar({ silencioso: true, fetch: async (url) => {
        const urlStr = String(url);
        urls.push(urlStr);
        if (urlStr.includes("EnviarSMS")) {
          throw new Error("red caida"); // el fetch falla
        }
        return respuesta({ error: false, data: { radicado: 123 } });
      } });
      c.api.__state.activeDoctor = { id: 777, name: "MEDICO PRUEBA" };
      c.api.__S.smsRecordatorio = true;
      c.env.doc.querySelector = () => ({ getAttribute: () => "tok" });

      // Espiamos console.warn en el contexto VM
      const warnOrig = c.ctx.console.warn;
      c.ctx.console.warn = (...args) => {
        warns.push(args.join(" "));
        warnOrig.apply(c.ctx.console, args);
      };

      await c.api.apiAccesoAsignarTurno("T1", "P1", "2026-09-15", "obs", false, "NA", null, "3001234567");

      // el .catch en viglilante no es awaitable en apiAccesoAsignarTurno, así que esperamos un pelín
      await new Promise(r => setTimeout(r, 45));

      const validWarns = warns.filter(w => w.startsWith("[Vigilante] falló el envío del SMS:"));
      t.igual(validWarns.length, 1, "hay exactamente 1 warn indicando el fallo de envío");
    });

    // ---------------------------------------------------------------
    // v11.0.1 — _pageFetchJsonCore NUNCA reintenta una ESCRITURA. Antes de esta
    // guardia el núcleo reintentaba hasta 4 veces y, en cada vuelta, repetía la
    // petición por una segunda vía (GM_xmlhttpRequest): hasta OCHO envíos del
    // mismo POST (ocho citas o ocho órdenes clínicas repetidas). Montaje común
    // con contador doble (fetch/gm) y un gmxhr que LIQUIDA la promesa (si no,
    // el runner queda colgado esperando para siempre).
    // ---------------------------------------------------------------

    await t.casoAsync("_pageFetchJsonCore: escritura (POST) con 500 NO reintenta y NO se reenvía por GM", async () => {
      const cont = { fetch: 0, gm: 0 };
      const c = cargar({
        silencioso: true,
        fetch: async () => { cont.fetch++; return { ok: false, status: 500, json: async () => ({}) }; },
        gmxhr: (o) => { cont.gm++; o.onerror(new Error("red")); },
      });

      const r = await c.api._pageFetchJsonCore("/x", { method: "POST", body: "{}" });

      t.igual(r, null, "devuelve null");
      t.igual(cont.fetch, 1, "una sola llamada por fetch, no reintenta");
      t.igual(cont.gm, 0, "no se reenvía por la segunda vía (GM)");
    });

    await t.casoAsync("_pageFetchJsonCore: lectura (GET) con 500 sí reintenta 3 veces y se reenvía por GM", async () => {
      const cont = { fetch: 0, gm: 0 };
      const c = cargar({
        silencioso: true,
        fetch: async () => { cont.fetch++; return { ok: false, status: 500, json: async () => ({}) }; },
        gmxhr: (o) => { cont.gm++; o.onerror(new Error("red")); },
      });

      const r = await c.api._pageFetchJsonCore("/x", { method: "GET" });

      t.igual(r, null, "devuelve null tras agotar reintentos");
      t.igual(cont.fetch, 4, "1 intento inicial + 3 reintentos");
      t.igual(cont.gm, 4, "se reenvía por GM en cada intento fallido");
    });

    await t.casoAsync("_pageFetchJsonCore: lectura (GET) con 404 NO reintenta (error 4xx)", async () => {
      const cont = { fetch: 0, gm: 0 };
      const c = cargar({
        silencioso: true,
        fetch: async () => { cont.fetch++; return { ok: false, status: 404, json: async () => ({}) }; },
        gmxhr: (o) => { cont.gm++; o.onerror(new Error("red")); },
      });

      const r = await c.api._pageFetchJsonCore("/x", { method: "GET" });

      t.igual(r, null, "devuelve null");
      t.igual(cont.fetch, 1, "un 4xx no reintenta");
      t.igual(cont.gm, 0, "un 4xx tampoco se reenvía por GM");
    });

    await t.casoAsync("_pageFetchJsonCore: POST con __idempotent:true SÍ reintenta (excepción explícita)", async () => {
      const cont = { fetch: 0, gm: 0 };
      const c = cargar({
        silencioso: true,
        fetch: async () => { cont.fetch++; return { ok: false, status: 500, json: async () => ({}) }; },
        gmxhr: (o) => { cont.gm++; o.onerror(new Error("red")); },
      });

      const r = await c.api._pageFetchJsonCore("/x", { method: "POST", body: "{}", __idempotent: true });

      t.igual(r, null, "devuelve null tras agotar reintentos");
      t.igual(cont.fetch, 4, "1 intento inicial + 3 reintentos, pese a ser POST");
      t.igual(cont.gm, 4, "__idempotent:true habilita el reenvío por GM");
    });
  }
};
