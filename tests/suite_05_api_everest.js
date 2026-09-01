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
  cubre: ["apiOrdenamientoGuardar", "apiAccesoAsignarTurno", "_pageFetchJsonCore", "pageFetchJson", "extractPatientId", "apiAccesoBuscarPaciente", "_apiCorteEstadoParaTest", "_apiCorteResetParaTest", "_apiCorteAbierto", "_apiMarcarResultado", "_saludEstado", "_saludMarca", "_saludRegParaTest", "apiOrdenamientoObtenerDx", "apiOrdenamientoObtenerCup", "apiOrdenamientoBuscarPaciente", "fetchAtheneaLabs"],
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
      t.igual(payload.SwHc, false, "SwHc debe ser false en GuardarOrdenamiento (MUT-ORD-029)");
      // v11.0.1 — una ESCRITURA no se reintenta: ocho POST serían ocho órdenes reales.
      t.igual(String(fetchOpts.method).toUpperCase(), "POST");
    });

    await t.casoAsync("apiOrdenamientoGuardar aborta y avisa bajo Kill-Switch (MUT-ORD-026)", async () => {
      let fetchCount = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { fetchCount++; return respuesta({ id: "ok" }); }
      });
      c.api.__state.activeDoctor = { id: 777, name: "DR. TEST" };
      c.api.__state.killed = true;

      const res = await c.api.apiOrdenamientoGuardar("pac123", "dx456", [{ Id: "cup1", Descripcion: "desc1" }]);
      t.igual(res, null, "debe retornar null bajo kill-switch");
      t.igual(fetchCount, 0, "no debe emitir peticiones a la red");
    });

    await t.casoAsync("apiAccesoAsignarTurno aborta bajo Kill-Switch activo (MUT-AGD-056)", async () => {
      let fetchCount = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { fetchCount++; return respuesta({ id: "ok" }); }
      });
      c.api.__state.activeDoctor = { id: 777, name: "JUAN MORENO" };
      c.api.__state.killed = true;

      const res = await c.api.apiAccesoAsignarTurno("turno", "pac123", "2026-08-10", "obs");
      t.cierto(res.error);
      t.cierto(res.mensaje.includes("Kill-Switch activo"));
      t.igual(fetchCount, 0, "no debe emitir peticiones a la red");
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
      c.api.__state.activeDoctor = { id: 777, name: "CARLOS PALENCIA" }; // médico de RCV

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
        fetch: async () => { fetchCount++; return respuesta([{ Codigo: "Z000", Id: "dx000" }, { Codigo: "I10X", Id: "dx999" }]); },
      });

      const dxId = await c.api.apiOrdenamientoObtenerDx("I10X");
      t.igual(dxId, "dx999", "debe seleccionar I10X ignorando el primer item Z000 (MUT-ORD-018)");
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
        fetch: async () => { fetchCount++; return respuesta([{ Codigo: "903841", Id: "cup000", Descripcion: "Glucosa" }, { Codigo: "902207", Id: "cup999", Descripcion: "Prueba" }]); },
      });

      const cup = await c.api.apiOrdenamientoObtenerCup("pac1", "902207");
      t.cierto(!!cup, "el CUPS se resuelve");
      t.igual(cup.Id, "cup999", "debe seleccionar 902207 ignorando primer item 903841 (MUT-ORD-023)");
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

      // Entradas vacías o sin dígitos retornan strictly null (MUT-ORD-012)
      t.igual(await c.api.apiOrdenamientoBuscarPaciente(""), null, "doc vacío retorna null (MUT-ORD-012)");
      t.igual(await c.api.apiOrdenamientoBuscarPaciente(null), null, "doc null retorna null (MUT-ORD-012)");
      t.igual(await c.api.apiOrdenamientoBuscarPaciente("CC"), null, "doc sin dígitos retorna null (MUT-ORD-012)");
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

    // =================================================================
    //  v18.0.47 — DOS HALLAZGOS DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta, los
    //  dos en esta misma función.
    // =================================================================

    await t.casoAsync("_pageFetchJsonCore: una conexión colgada NO deja esperando para siempre", async () => {
      // La segunda vía (GM_xmlhttpRequest) lleva `timeout: 15000` desde siempre; la
      // primera —la que se usa en el 100 % de los casos normales— no tenía ninguno. Una
      // conexión que acepta y no responde no da error: se queda abierta, y como todo aquí
      // se hace con `await`, la acción REAL del médico que la disparó (Agendar, Guardar
      // orden, Buscar paciente) se cuelga con ella. Sin error, sin aviso, sin vuelta.
      let señalRecibida = null;
      const c = cargar({
        silencioso: true,
        // Un fetch que NO resuelve nunca — exactamente la conexión colgada. Solo termina
        // si alguien aborta su señal, que es lo que esta prueba comprueba que ocurre.
        fetch: (u, init) => new Promise((_, reject) => {
          señalRecibida = init && init.signal;
          if (señalRecibida && señalRecibida.addEventListener) {
            señalRecibida.addEventListener("abort", () => reject(Object.assign(new Error("abortada"), { name: "AbortError" })));
          }
        }),
        gmxhr: (o) => o.onerror(new Error("red")),
      });
      // AbortController no existe en el DOM simulado: se inyecta el real, igual que
      // suite_16 inyecta Blob/Response/DecompressionStream para probar el inflado.
      c.ctx.AbortController = AbortController;

      const t0 = Date.now();
      const r = await c.api._pageFetchJsonCore("/x", { method: "POST", body: "{}", __timeoutMs: 40 });
      const tardo = Date.now() - t0;

      t.igual(r, null, "la llamada TERMINA (en null), no se queda colgada");
      t.cierto(!!señalRecibida, "al fetch se le pasó una señal de aborto");
      t.cierto(tardo < 5000, "y terminó por su propio tope, no por el del banco (tardó " + tardo + " ms)");
    });

    await t.casoAsync("_pageFetchJsonCore: un 401 (sesión caducada) SÍ cuenta como fallo; un 404 no", async () => {
      // Un 401 caía en el mismo `return null` que un 404 y nunca llamaba a
      // `_apiMarcarResultado(false)`: no contaba como fallo, no abría el cortacircuitos y
      // no ponía en rojo el panel de salud. El asistente se quedaba ciego —sin fuente de
      // agenda, sin avisos de llegada— y por dentro seguía creyéndose sano.
      const c401 = cargar({ silencioso: true, fetch: async () => ({ ok: false, status: 401, json: async () => ({}) }), gmxhr: (o) => o.onerror(new Error("red")) });
      c401.api._apiCorteResetParaTest();
      const r1 = await c401.api._pageFetchJsonCore("/x", { method: "GET" });
      t.igual(r1, null, "sigue devolviendo null: un 401 no se reintenta, reintentarlo no lo arregla");
      t.igual(c401.api._apiCorteEstadoParaTest().fallos, 1, "pero AHORA cuenta como fallo del API");
      t.cierto(c401.api._saludRegParaTest().everest.falloDesde > 0, "y el panel de salud lo registra como caída de Everest");

      const c403 = cargar({ silencioso: true, fetch: async () => ({ ok: false, status: 403, json: async () => ({}) }), gmxhr: (o) => o.onerror(new Error("red")) });
      c403.api._apiCorteResetParaTest();
      await c403.api._pageFetchJsonCore("/x", { method: "GET" });
      t.igual(c403.api._apiCorteEstadoParaTest().fallos, 1, "el 403 igual: también es la sesión, no el recurso");

      // La contención: un 404 o un 400 son respuestas LEGÍTIMAS («no existe», «mal
      // pedido»), no un API caído. Contarlas abriría el cortacircuitos por nada.
      const c404 = cargar({ silencioso: true, fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }), gmxhr: (o) => o.onerror(new Error("red")) });
      c404.api._apiCorteResetParaTest();
      await c404.api._pageFetchJsonCore("/x", { method: "GET" });
      t.igual(c404.api._apiCorteEstadoParaTest().fallos, 0, "un 404 NO es un fallo del API");
      const c400 = cargar({ silencioso: true, fetch: async () => ({ ok: false, status: 400, json: async () => ({}) }), gmxhr: (o) => o.onerror(new Error("red")) });
      c400.api._apiCorteResetParaTest();
      await c400.api._pageFetchJsonCore("/x", { method: "GET" });
      t.igual(c400.api._apiCorteEstadoParaTest().fallos, 0, "ni un 400");
    });

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

    await t.casoAsync("pageFetchJson delega en el transporte core y devuelve el JSON", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => respuesta({ salud: "ok" }),
      });
      const data = await c.api.pageFetchJson("/apiviva/salud");
      t.igual(data.salud, "ok");
    });
    // =================================================================
    //  v17.15.0 — LA CONSOLA DEL 27-ago Y LA TORMENTA QUE LA CAUSABA
    //
    //  El médico pegó su consola en vivo: una pared de «GM fallback también
    //  falló en intento N», cada una con su traza, sobre BuscarPaciente y
    //  GetUsuarioPerfil, con los servicios de Everest devolviendo 500.
    //
    //  Medido con este mismo arnés ANTES de tocar nada: UNA búsqueda de
    //  paciente disparaba 16 peticiones y 8 líneas de consola. Y no la pedía
    //  nadie — la disparaba el preparador por hover, cuyo fallo se descarta
    //  con un catch vacío. Después: 4 peticiones y 0 líneas.
    // =================================================================

    // Cuenta peticiones (fetch + GM_xmlhttpRequest) y líneas de consola de una llamada.
    // console.warn se cuenta sobre el objeto REAL de Node porque es el mismo que el arnés
    // inyecta en el vm cuando no se pide `silencioso`.
    const _medirCaida = async (opts) => {
      let peticiones = 0, avisos = 0;
      const c = cargar({
        fetch: async () => { peticiones++; return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}), text: async () => "", clone() { return this; } }; },
        gmxhr: (o) => { peticiones++; setTimeout(() => { try { o.onload({ status: 500, responseText: "" }); } catch (e) {} }, 0); },
      });
      const real = console.warn;
      console.warn = () => { avisos++; };
      try { await c.api.apiAccesoBuscarPaciente("40123456", opts); }
      finally { console.warn = real; }
      return { peticiones, avisos, c };
    };

    await t.casoAsync("v17.15.0 — una llamada especulativa no insiste ni narra su fallo", async () => {
      const r = await _medirCaida({ especulativo: true });
      t.igual(r.avisos, 0, "cero líneas de consola: su fallo no tiene consecuencia y no puede tapar los diagnósticos");
      t.cierto(r.peticiones <= 4, "un intento por ruta, sin los cuatro reintentos (fueron " + r.peticiones + ")");
    });

    await t.casoAsync("v17.15.0 — lo que el médico está esperando NO cambió: sigue insistiendo y avisando", async () => {
      // La otra mitad de la regla. Un arreglo que calle también las peticiones que alguien
      // espera sería peor que el defecto: ahí el silencio sí esconde algo.
      const r = await _medirCaida(undefined);
      t.cierto(r.avisos >= 4, "sigue narrando cada intento fallido (fueron " + r.avisos + ")");
      t.cierto(r.peticiones >= 8, "y sigue reintentando con espera exponencial (fueron " + r.peticiones + ")");
    });

    await t.casoAsync("v17.15.0 — el cortacircuitos frena lo especulativo y JAMÁS lo que el médico pidió", async () => {
      let peticiones = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { peticiones++; return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}), text: async () => "", clone() { return this; } }; },
        gmxhr: (o) => { peticiones++; setTimeout(() => { try { o.onload({ status: 500, responseText: "" }); } catch (e) {} }, 0); },
      });
      c.api._apiCorteResetParaTest();
      // v17.16.0 — el estado del corte se consulta por su propia función, no solo de refilón
      // a través de pageFetchJson: estaba entre las «sin cubrir» del informe del banco.
      t.falso(c.api._apiCorteAbierto(), "de arranque el corte está cerrado: nada se frena porque sí");
      // Tres fallos seguidos abren el corte.
      for (let i = 0; i < 3; i++) await c.api.apiAccesoBuscarPaciente("4012345" + i, { especulativo: true });
      t.cierto(c.api._apiCorteEstadoParaTest().hasta > 0, "tras 3 fallos seguidos, el corte queda abierto");
      t.cierto(c.api._apiCorteAbierto(), "y _apiCorteAbierto lo dice");

      const antes = peticiones;
      await c.api.apiAccesoBuscarPaciente("40129999", { especulativo: true });
      t.igual(peticiones - antes, 0, "una especulativa ya no sale a la red");

      const antes2 = peticiones;
      await c.api.apiAccesoBuscarPaciente("40128888");
      t.cierto(peticiones - antes2 > 0,
        "pero lo que el médico pide con un clic se intenta igual: el asistente no puede negarse a hacer lo que le mandaron");
      // Y una respuesta buena lo cierra: si no, un parpadeo dejaría el asistente a medias
      // durante cinco minutos aunque Everest ya estuviera contestando. Va AL FINAL a
      // propósito: cerrar el corte a mitad del caso invalidaría las comprobaciones de
      // arriba, que es justo lo que pasó al escribirlo.
      c.api._apiMarcarResultado(true);
      t.falso(c.api._apiCorteAbierto(), "una lectura buena cierra el corte en el acto");
      t.igual(c.api._apiCorteEstadoParaTest().fallos, 0, "y borra la cuenta de fallos seguidos");
      c.api._apiCorteResetParaTest();
    });

    await t.casoAsync("v17.15.0 — «Servicios de Everest» aparece en el panel de salud y refleja la caída", async () => {
      // Los otros cuatro módulos se marcan desde la lectura de la PANTALLA, que sigue
      // funcionando con la API caída: el panel podía decir «✓ leyendo bien» en los cuatro
      // mientras agendar y buscar paciente estaban rotos. Este mira lo que de verdad decide.
      const c = cargar({
        silencioso: true,
        fetch: async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}), text: async () => "", clone() { return this; } }),
        gmxhr: (o) => { setTimeout(() => { try { o.onload({ status: 500, responseText: "" }); } catch (e) {} }, 0); },
      });
      c.api._apiCorteResetParaTest();
      const reg = c.api._saludRegParaTest ? c.api._saludRegParaTest() : null;
      t.cierto(!!c.api._saludEstado, "el semáforo de salud está publicado");
      await c.api.apiAccesoBuscarPaciente("40123456");
      const m = reg ? reg.everest : null;
      t.cierto(!!m && m.falloDesde > 0, "el fallo quedó anotado en el módulo everest");
      // El umbral de 3 minutos es del semáforo, no de esta prueba: se simula el paso del
      // tiempo en vez de esperarlo, que es lo que hace el resto del banco.
      t.igual(c.api._saludEstado(m, m.falloDesde + 3 * 60 * 1000 + 1), "alerta",
        "y tras 3 minutos de fallo sostenido el panel lo pinta en alerta");
      // Con una respuesta buena vuelve a verde: no se queda pegado en rojo.
      const c2 = cargar({ silencioso: true, fetch: async () => respuesta({ data: { id: 5 } }) });
      c2.api._apiCorteResetParaTest();
      await c2.api.apiAccesoBuscarPaciente("40123456");
      const reg2 = c2.api._saludRegParaTest ? c2.api._saludRegParaTest() : null;
      t.igual(c2.api._saludEstado(reg2.everest, Date.now()), "ok", "una respuesta buena lo devuelve a verde");
    });

    t.caso("v17.16.0 — _saludMarca, probada de frente: el semáforo no se queda pegado", () => {
      // Estaba en `cubre` sin que ninguna prueba la nombrara. Es la pieza que decide si el
      // médico ve «✓ leyendo bien» o «⚠ no se está pudiendo leer», y su regla menos obvia
      // es que una lectura BUENA borra el historial de fallos: si no, un parpadeo de
      // Everest dejaría el panel en alerta el resto de la jornada.
      const c = cargar({ silencioso: true });
      const reg = c.api._saludRegParaTest();
      const ahora = Date.now();

      t.igual(c.api._saludEstado(reg.everest, ahora), "nd", "sin actividad todavía: «nd», ni bien ni mal");

      c.api._saludMarca("everest", false);
      t.cierto(reg.everest.falloDesde > 0, "el primer fallo abre la ventana");
      t.igual(c.api._saludEstado(reg.everest, ahora), "ok",
        "pero un fallo suelto NO alarma: los parpadeos de Everest no pueden gritar");
      t.igual(c.api._saludEstado(reg.everest, reg.everest.falloDesde + 3 * 60 * 1000 + 1), "alerta",
        "a los 3 minutos de fallo sostenido, sí");

      const abierta = reg.everest.falloDesde;
      c.api._saludMarca("everest", false);
      t.igual(reg.everest.falloDesde, abierta,
        "un segundo fallo NO reinicia el reloj: si no, un fallo cada 2 min nunca llegaría a alertar");

      c.api._saludMarca("everest", true);
      t.igual(reg.everest.falloDesde, 0, "una lectura buena borra la ventana de fallo");
      t.igual(c.api._saludEstado(reg.everest, Date.now()), "ok", "y el semáforo vuelve a verde");

      c.api._saludMarca("modulo_que_no_existe", false);
      t.igual(c.api._saludEstado(null, ahora), "nd", "un módulo desconocido no crea entradas fantasma");
    });

  }
};
