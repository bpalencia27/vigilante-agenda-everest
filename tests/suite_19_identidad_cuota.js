// =====================================================================
//  SUITE 19 — Identidad de la URL de API por médico y blindaje de cuota
//  Cubre v12.3.1 a v12.3.13, sin test todavía:
//    · identidadDesdeCliente     (v12.3.2 — identidad desde el almacenamiento del cliente)
//    · invalidarApiSiCambioMedico / purgarApiUrl (v12.3.6/v12.3.7 — fuga de identidad
//      entre médicos en un equipo COMPARTIDO)
//    · hayVentanaCritica / vivoElapsed           (v12.3.8 — cadencia adaptativa)
//    · purgaPorCuota                             (v12.3.13 — purga de emergencia por cuota)
// =====================================================================
module.exports = {
  nombre: "Identidad de API por médico y blindaje de cuota",
  cubre: [
    "identidadDesdeCliente", "invalidarApiSiCambioMedico", "purgarApiUrl",
    "hayVentanaCritica", "vivoElapsed", "purgaPorCuota",
  ],

  async pruebas(t, api, env, cargar) {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));

    const URL_AGENDA = "/apiviva/APIMedicoHealth/api/Medico/ObtenerConsultas?especialidadId=1&profesionalId=2";
    const ABS_AGENDA = "https://neps.everestintelligent.com" + URL_AGENDA;
    const FILAS = [
      { horaCita: "07:00", estado: "EN SALA", numeroDocumento: "12345678", nombrePaciente: "JUAN" },
      { horaCita: "07:20", estado: "SIN PRESENTAR", numeroDocumento: "87654321", nombrePaciente: "MARIA" },
    ];

    // Entorno con fetch intercambiable + registro de llamadas. El mock de GM_xmlhttpRequest
    // llama SIEMPRE a onerror (nunca lo dejamos sin respuesta): así, si algún caso dispara sin
    // querer la segunda vía de _pageFetchJsonCore (fetch con 5xx o excepción), la promesa
    // rechaza en vez de quedar colgada para siempre y tragarse el resto del banco.
    function entorno() {
      const fetches = [];
      let responderFetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "" });
      const c = cargar({
        silencioso: true,
        fetch: (url, opt) => { fetches.push({ url, opt }); return responderFetch(url, opt); },
        gmxhr: (o) => { if (o.onerror) o.onerror(new Error("GM no configurado en esta prueba")); },
      });
      return { c, fetches, setFetch: (f) => { responderFetch = f; } };
    }

    // Fecha real congelada, siguiendo el patrón ya usado en el resto del banco
    // (suite_02/03/04): se pisa Date en el contexto vm, no en el proceso de Node.
    function conFechaFija(iso, fn) {
      const c = cargar({ silencioso: true });
      const OriginalDate = c.ctx.Date || Date;
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(iso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(iso).getTime();
      c.ctx.Date = FakeDate;
      c.env.win.Date = FakeDate;
      fn(c);
    }

    function fakeJwt(sub) {
      const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64");
      const payload = Buffer.from(JSON.stringify({ sub: String(sub) })).toString("base64");
      return header + "." + payload + ".sig";
    }

    // =====================================================================
    //  identidadDesdeCliente — v12.3.2: localStorage "user"/"jwt" + cookie
    //  UsuarioMedico, con la coherencia jwt.sub === user.userIdIdentity antes
    //  de confiar en el username de un almacenamiento rancio de OTRO médico.
    // =====================================================================

    t.caso("identidadDesdeCliente: si ya hay médico identificado (guard de arriba), no toca nada ni consulta red", () => {
      const { c, fetches } = entorno();
      c.api.__state.activeDoctor.id = 42;
      c.api.identidadDesdeCliente();
      t.igual(fetches.length, 0, "con activeDoctor.id ya resuelto, ni siquiera mira localStorage/cookie");
    });

    await t.casoAsync("identidadDesdeCliente: sin 'user', sin 'jwt' y sin cookie, no encuentra login y NO LANZA", async () => {
      const { c, fetches } = entorno();
      t.noLanza(() => c.api.identidadDesdeCliente(), "globales ausentes: no debe lanzar");
      await espera(20);
      t.igual(fetches.length, 0, "sin login no hay nada que resolver");
      t.igual(c.api.__state.activeDoctor.id, 0);
    });

    await t.casoAsync("identidadDesdeCliente: 'user' con username + userIdIdentity == sub del jwt -> resuelve por GetUsuarioPerfil", async () => {
      const { c, fetches, setFetch } = entorno();
      setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: { id: 515, nombreCompleto: "Dr. J Moreno", perfilCodigo: "PROFESIONAL" } }), text: async () => "{}" }));
      c.env.almacen["user"] = JSON.stringify({ username: "jmoreno", userIdIdentity: "515" });
      c.env.almacen["jwt"] = fakeJwt("515");
      c.api.identidadDesdeCliente();
      await espera(30);
      t.igual(fetches.length, 1);
      t.cierto(fetches[0].url.includes("GetUsuarioPerfil/jmoreno"), "consulta la puerta autoritativa con el login del cliente");
      t.igual(c.api.__state.activeDoctor.id, 515);
      t.igual(c.api.__state.activeDoctor.name, "Dr. J Moreno");
    });

    await t.casoAsync("identidadDesdeCliente: sin jwt en absoluto, se acepta 'user'.username directamente (coherencia solo aplica si hay jwt)", async () => {
      const { c, fetches, setFetch } = entorno();
      setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: { id: 88, nombreCompleto: "Dr. Sin JWT" } }), text: async () => "{}" }));
      c.env.almacen["user"] = JSON.stringify({ username: "sinjwt", userIdIdentity: "88" });
      // sin c.env.almacen["jwt"]
      c.api.identidadDesdeCliente();
      await espera(30);
      t.igual(fetches.length, 1);
      t.cierto(fetches[0].url.includes("GetUsuarioPerfil/sinjwt"));
      t.igual(c.api.__state.activeDoctor.id, 88);
    });

    await t.casoAsync("identidadDesdeCliente: userIdIdentity NO coincide con el sub del jwt -> descarta el username (almacenamiento rancio de otro médico) y sin cookie no hay login", async () => {
      const { c, fetches, setFetch } = entorno();
      setFetch(async (url) => { throw new Error("NO debía consultarse: " + url); });
      c.env.almacen["user"] = JSON.stringify({ username: "otromedico", userIdIdentity: "999" });
      c.env.almacen["jwt"] = fakeJwt("515"); // sub distinto de userIdIdentity
      t.noLanza(() => c.api.identidadDesdeCliente());
      await espera(20);
      t.igual(fetches.length, 0, "la incoherencia jwt.sub vs userIdIdentity veta el username rancio");
      t.igual(c.api.__state.activeDoctor.id, 0);
    });

    await t.casoAsync("identidadDesdeCliente: sin 'user' pero con cookie UsuarioMedico, usa el login de la cookie", async () => {
      const { c, fetches, setFetch } = entorno();
      setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: { id: 77, nombreCompleto: "Dra. Cookie" } }), text: async () => "{}" }));
      c.env.doc.cookie = "UsuarioMedico=jmoreno2; otraCookie=1";
      c.api.identidadDesdeCliente();
      await espera(30);
      t.igual(fetches.length, 1);
      t.cierto(fetches[0].url.includes("GetUsuarioPerfil/jmoreno2"));
      t.igual(c.api.__state.activeDoctor.id, 77);
    });

    t.caso("identidadDesdeCliente: 'user'/'jwt' corruptos (JSON inválido) NO LANZAN", () => {
      const { c } = entorno();
      c.env.almacen["user"] = "{esto no es json";
      c.env.almacen["jwt"] = "no-es-un-jwt-valido";
      t.noLanza(() => c.api.identidadDesdeCliente());
    });

    // =====================================================================
    //  invalidarApiSiCambioMedico / purgarApiUrl — v12.3.6/v12.3.7: en un
    //  equipo COMPARTIDO, la URL aprendida ("vgl_api_url") lleva el
    //  profesionalId de quien la enseñó; si cambia el médico en sesión debe
    //  olvidarse para no reintentar con la sesión de otro médico.
    // =====================================================================

    t.caso("invalidarApiSiCambioMedico: nuevoId <= 0 no hace nada (ni purga ni etiqueta)", () => {
      const { c } = entorno();
      c.api.invalidarApiSiCambioMedico(0);
      c.api.invalidarApiSiCambioMedico(-5);
      t.igual(c.env.almacen["vgl_api_medico"], undefined, "sin id válido, ni siquiera se toca la etiqueta");
    });

    // v17.6.14 — H4: la URL aprendida se persiste OFUSCADA en localStorage (antes en
    // claro, legible para cualquier script de la página de Athenea, mismo origen).
    const asertarUrlOfuscada = (c, t, tag) => {
      const persistida = c.env.almacen["vgl_api_url"];
      t.falso(String(persistida || "").includes("ObtenerConsultas"), "v17.6.14 (" + tag + "): la URL no viaja en claro por localStorage");
      t.igual(c.api._vglDesofusca(persistida), ABS_AGENDA, "v17.6.14 (" + tag + "): se recupera idéntica al desofuscar");
    };

    t.caso("invalidarApiSiCambioMedico: MISMO médico -> no purga la URL aprendida (pero re-etiqueta igual)", () => {
      const { c } = entorno();
      c.api.__state.activeDoctor.id = 100;
      c.api.apiRecordar(URL_AGENDA);
      asertarUrlOfuscada(c, t, "aprendida");
      t.igual(c.env.almacen["vgl_api_medico"], "100");
      c.api.__state.apiCitas = [{ x: 1 }];
      c.api.__state.apiEn = 12345;
      c.api.invalidarApiSiCambioMedico(100);
      asertarUrlOfuscada(c, t, "misma sesión");
      t.cierto(c.api.apiUtil(), "el API sigue utilizable");
      t.igual(c.api.__state.apiCitas, [{ x: 1 }], "no se tocan las citas ya cargadas");
      t.igual(c.api.__state.apiEn, 12345);
      t.igual(c.env.almacen["vgl_api_medico"], "100");
    });

    t.caso("invalidarApiSiCambioMedico: URL aprendida ANTES de resolver identidad (medicoId=0) no se purga (0 no es > 0), pero queda etiquetada de aquí en más", () => {
      const { c } = entorno();
      // activeDoctor.id sigue en 0: apiRecordar la etiqueta con medicoId=0 por no saberlo aún
      c.api.apiRecordar(URL_AGENDA);
      t.igual(c.env.almacen["vgl_api_medico"], "0");
      c.api.invalidarApiSiCambioMedico(300); // primera identidad que se resuelve
      asertarUrlOfuscada(c, t, "medicoId=0");
      t.igual(c.env.almacen["vgl_api_medico"], "300", "de aquí en más ya queda protegida frente al próximo cambio");
    });

    await t.casoAsync("v17.6.14: la URL vieja en claro y la nueva ofuscada se cargan y sirven para leer la agenda (migración)", async () => {
      const sembradas = [
        { valor: ABS_AGENDA, tag: "en claro (versión vieja)" },
        { valor: cargar({ silencioso: true }).api._vglOfusca(ABS_AGENDA), tag: "ofuscada (v17.6.14+)" },
      ];
      for (const s of sembradas) {
        const llamadas = [];
        const c = cargar({
          silencioso: true,
          almacen: { vgl_api_url: s.valor, vgl_api_medico: "100" },
          fetch: (url) => { llamadas.push(String(url)); return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => JSON.stringify([{ horaCita: "07:00", estado: "EN SALA" }]) }); },
          gmxhr: (o) => { if (o.onerror) o.onerror(new Error("GM no configurado")); },
        });
        const citas = await c.api.apiLeerAgenda();
        t.cierto(Array.isArray(citas) && citas.length === 1, "con la URL " + s.tag + ": se lee la agenda");
        t.igual(llamadas[0], ABS_AGENDA, "y la llamada usa la URL completa recuperada");
      }
    });

    await t.casoAsync("invalidarApiSiCambioMedico: médico DISTINTO -> purga URL/fallos/ok/medicoId al estado inicial y re-etiqueta con el nuevo id", async () => {
      const { c, setFetch } = entorno();
      c.api.__state.activeDoctor.id = 100;
      c.api.apiRecordar(URL_AGENDA);
      setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(FILAS) }));
      const citas = await c.api.apiLeerAgenda();
      t.igual(citas.length, 2);
      t.cierto(c.api.apiSano(), "un éxito real deja ok>0 y fallos<2 (precondición del caso)");
      c.api.__state.apiCitas = citas;
      c.api.__state.apiEn = Date.now();

      c.api.invalidarApiSiCambioMedico(200); // entra la Dra. B en la misma máquina

      t.igual(c.env.almacen["vgl_api_url"], undefined, "la URL de A se olvida por completo");
      t.falso(c.api.apiUtil(), "sin URL, nada que intentar hasta que Everest la vuelva a enseñar");
      t.falso(c.api.apiSano(), "ok vuelve a 0: ya no se confía en los datos del médico anterior");
      t.igual(c.api.apiEspera(0), 4000, "fallos vuelve a 0: ritmo base, no el creciente");
      t.igual(c.env.almacen["vgl_api_medico"], "200", "re-etiquetada con el médico nuevo");
      t.igual(c.api.__state.apiCitas, null, "las citas de A no se le muestran a B");
      t.igual(c.api.__state.apiEn, 0);
    });

    await t.casoAsync("purgarApiUrl: borra ambas claves de localStorage, resetea fallos/ok, y jamás toca otras claves", async () => {
      const { c, setFetch } = entorno();
      c.api.__state.activeDoctor.id = 7;
      c.api.apiRecordar(URL_AGENDA);
      c.env.almacen["foo"] = "bar";
      c.env.almacen["vgl_cfg"] = "{}";
      setFetch(async () => ({ ok: false, status: 500, headers: { get: () => null }, text: async () => "" }));
      await c.api.apiLeerAgenda();
      await c.api.apiLeerAgenda();
      t.igual(c.api.apiEspera(0), 15000, "precondición: 2 fallos seguidos ya acumulados");

      c.api.purgarApiUrl("prueba directa");

      t.igual(c.env.almacen["vgl_api_url"], undefined);
      t.igual(c.env.almacen["vgl_api_medico"], undefined);
      t.falso(c.api.apiUtil());
      t.falso(c.api.apiSano());
      t.igual(c.api.apiEspera(0), 4000, "fallos vuelto a 0");
      t.igual(c.env.almacen["foo"], "bar", "clave ajena intacta");
      t.igual(c.env.almacen["vgl_cfg"], "{}", "otra clave vgl_* que no es la de la URL/medico queda intacta");
    });

    // =====================================================================
    //  vivoElapsed / hayVentanaCritica — v12.3.8: cadencia adaptativa. El
    //  "elapsed" se recalcula EN VIVO desde hora_texto (no el congelado del
    //  snapshot); hayVentanaCritica es verdadero solo en la franja estrecha
    //  [-2, 1] alrededor del cruce de tolerancia (mismos umbrales que usa
    //  apiCadencia() para su tramo CRITICA).
    // =====================================================================

    t.caso("vivoElapsed: sin hora_texto, cae al elapsed congelado del snapshot (o a 0 si no hay nada)", () => {
      t.igual(api.vivoElapsed({ elapsed: 42 }), 42);
      t.igual(api.vivoElapsed({ elapsed: 0 }), 0);
      t.igual(api.vivoElapsed({}), 0, "sin elapsed tampoco: 0");
      t.igual(api.vivoElapsed(null), 0, "sin objeto: no lanza y cae a 0");
    });

    t.caso("vivoElapsed: CON hora_texto, recalcula EN VIVO con Date.now() e ignora el elapsed congelado", () => {
      conFechaFija("2026-08-10T07:10:00", (c) => {
        t.igual(c.api.vivoElapsed({ hora_texto: "7:00 a. m.", elapsed: 999 }), 10, "10 min reales desde las 7:00, no los 999 del snapshot viejo");
      });
    });

    t.caso("hayVentanaCritica: sin snapshot, o con todo resuelto (Atendido/En Sala), es falso", () => {
      const { c } = entorno();
      c.api.__state.lastSnapshot = null;
      t.falso(c.api.hayVentanaCritica());
      const TOL = c.api.__CONFIG.TOLERANCIA_MIN;
      c.api.__state.lastSnapshot = { list: [{ estado: "Atendido", elapsed: TOL }, { estado: "En Sala", elapsed: TOL - 1 }] };
      t.falso(c.api.hayVentanaCritica(), "resueltas: no cuentan aunque su elapsed caiga en la franja crítica");
    });

    t.caso("hayVentanaCritica: franja estrecha [-2, 1] alrededor del cruce de tolerancia (bordes inclusive)", () => {
      const { c } = entorno();
      const TOL = c.api.__CONFIG.TOLERANCIA_MIN;
      const set = (elapsed) => { c.api.__state.lastSnapshot = { list: [{ estado: "Pendiente", elapsed }] }; };
      set(TOL - 2);   t.falso(c.api.hayVentanaCritica(), "resta=2: justo antes de la franja, todavía fuera");
      set(TOL - 1);   t.cierto(c.api.hayVentanaCritica(), "resta=1: borde de entrada, dentro (minuto 5 de gracia)");
      set(TOL);       t.cierto(c.api.hayVentanaCritica(), "resta=0: en el cruce exacto");
      set(TOL + 2);   t.cierto(c.api.hayVentanaCritica(), "resta=-2: borde de salida, todavía dentro");
      set(TOL + 2.1); t.falso(c.api.hayVentanaCritica(), "resta=-2.1: ya fuera de la franja");
    });

    t.caso("hayVentanaCritica: recorre la lista entera; basta UNA cita en ventana entre varias que no aportan", () => {
      const { c } = entorno();
      const TOL = c.api.__CONFIG.TOLERANCIA_MIN;
      c.api.__state.lastSnapshot = {
        list: [
          { estado: "En Sala", elapsed: TOL },          // resuelta: se ignora aunque caiga en la franja
          { estado: "Pendiente", elapsed: TOL - 30 },    // lejos: no aporta
          { estado: "Sin presentar", elapsed: TOL - 1 }, // ÉSTA sí entra en la ventana crítica
        ],
      };
      t.cierto(c.api.hayVentanaCritica());
    });

    t.caso("hayVentanaCritica: CON hora_texto, usa vivoElapsed EN VIVO y no el elapsed congelado (aunque el snapshot mienta)", () => {
      conFechaFija("2026-08-10T07:05:00", (c) => {
        // vivo desde 7:00 -> 5 min transcurridos -> resta = TOL(6)-5 = 1 -> DENTRO
        c.api.__state.lastSnapshot = { list: [{ estado: "Pendiente", hora_texto: "7:00 a. m.", elapsed: 999 }] };
        t.cierto(c.api.hayVentanaCritica(), "el elapsed congelado (999) diría que no; el recalculado en vivo (5 min) sí entra");
      });
      conFechaFija("2026-08-10T07:30:00", (c) => {
        // vivo desde 7:00 -> 30 min transcurridos -> resta = TOL(6)-30 = -24 -> FUERA
        c.api.__state.lastSnapshot = { list: [{ estado: "Pendiente", hora_texto: "7:00 a. m.", elapsed: 6 }] };
        t.falso(c.api.hayVentanaCritica(), "el elapsed congelado (6, el cruce exacto) diría que sí; el en vivo (30 min) ya está muy fuera");
      });
    });

    // =====================================================================
    //  purgaPorCuota — v12.3.13: purga de emergencia cuando localStorage se
    //  llena (QuotaExceededError). Reutiliza purgeOld/purgeEventDays con
    //  ventana de 18 días (KEEP_DAYS*0.6) y jamás toca claves ajenas a "vgl_*".
    // =====================================================================

    t.caso("purgaPorCuota: purga vgl_stats y vgl_ev_* con ventana de 18 días, y JAMÁS toca claves ajenas a vgl_*", () => {
      conFechaFija("2026-08-10T12:00:00", (c) => {
        // vgl_stats: un día de hace 31 días (fuera de 18) y uno de ayer (dentro)
        c.env.almacen["vgl_stats"] = JSON.stringify({
          "2026-07-10": { fraude: 1, inasistencia: 0, atiempo: 0, ultima: 0 },
          "2026-08-09": { fraude: 2, inasistencia: 0, atiempo: 0, ultima: 0 },
        });
        // bitácoras diarias (vgl_ev_*), mismo criterio de ventana
        c.env.almacen["vgl_ev_2026-07-10"] = JSON.stringify([{ ev: "x" }]);
        c.env.almacen["vgl_ev_2026-08-09"] = JSON.stringify([{ ev: "y" }]);
        // marcas anti-duplicado entre pestañas: ventana propia de 24 h (no la de 18 días)
        c.env.almacen["vgl_n_old"] = String(new Date("2026-08-08T00:00:00").getTime()); // > 24h
        c.env.almacen["vgl_n_new"] = String(new Date("2026-08-10T11:00:00").getTime()); // < 24h
        // formato antiguo de un solo blob: siempre se descarta
        c.env.almacen["vgl_events"] = "[]";
        // claves AJENAS: no deben tocarse jamás
        c.env.almacen["foo"] = "bar";
        c.env.almacen["vgl_cfg"] = '{"tema":"auto"}';

        c.api.purgaPorCuota();

        const stats = JSON.parse(c.env.almacen["vgl_stats"]);
        t.cierto(!("2026-07-10" in stats), "el día de hace 31 días se purga (fuera de la ventana de 18)");
        t.cierto("2026-08-09" in stats, "el día de ayer se conserva");

        t.igual(c.env.almacen["vgl_ev_2026-07-10"], undefined, "bitácora vieja purgada");
        t.cierto(c.env.almacen["vgl_ev_2026-08-09"] !== undefined, "bitácora reciente conservada");

        t.igual(c.env.almacen["vgl_n_old"], undefined, "marca anti-duplicado vieja (>24h) purgada");
        t.cierto(c.env.almacen["vgl_n_new"] !== undefined, "marca reciente conservada");

        t.igual(c.env.almacen["vgl_events"], undefined, "el formato antiguo de un solo blob siempre se descarta");

        t.igual(c.env.almacen["foo"], "bar", "clave totalmente ajena (ni vgl_*) intacta");
        t.igual(c.env.almacen["vgl_cfg"], '{"tema":"auto"}', "otra clave vgl_* que no es stats/ev/n queda intacta");
      });
    });

    t.caso("purgaPorCuota: nunca lanza, ni con localStorage vacío ni con vgl_stats corrupto", () => {
      const { c } = entorno();
      t.noLanza(() => c.api.purgaPorCuota(), "localStorage vacío");
      c.env.almacen["vgl_stats"] = "esto no es json{{{";
      t.noLanza(() => c.api.purgaPorCuota(), "vgl_stats corrupto");
    });

    t.caso("purgaPorCuota: writeJSON la dispara automáticamente al recibir QuotaExceededError, y el reintento único tiene éxito", () => {
      const { c } = entorno();
      let primerIntento = true;
      const original = c.env.storage.setItem;
      c.env.storage.setItem = (k, v) => {
        if (k === "vgl_algo" && primerIntento) {
          primerIntento = false;
          const e = new Error("cuota llena"); e.name = "QuotaExceededError";
          throw e;
        }
        return original(k, v);
      };
      const ok = c.api.writeJSON("vgl_algo", { x: 1 });
      t.cierto(ok, "tras la purga de emergencia, el reintento de escribir vgl_algo tiene éxito");
      t.igual(JSON.parse(c.env.almacen["vgl_algo"]).x, 1);
      t.cierto(c.env.almacen["vgl_stats"] !== undefined, "la purga de emergencia escribió (al menos) un vgl_stats purgado/vacío");
    });
  },
};
