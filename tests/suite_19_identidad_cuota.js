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
    "resolverMedicoPorPerfil", "_identidadMedicoCacheLeer", "_identidadMedicoCacheGuardar",
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
    //  resolverMedicoPorPerfil + caché de identidad — v17.6.81: REPORTE EN VIVO
    //  (26-ago) "no aparece mi nombre donde dice Médico, y por eso no me salen las
    //  agendas". GetUsuarioPerfil (la única puerta que da id+nombre, hasta para el
    //  login leído de localStorage) llevaba TODA la sesión devolviendo 503. Con la
    //  caché por LOGIN exacto, un login ya validado antes por el backend se fija de
    //  inmediato aunque la red esté caída — sin abrir la puerta que v12.3.2 cerró a
    //  propósito (un equipo compartido no puede firmar solo con lo que quedó local).
    // =====================================================================

    await t.casoAsync("resolverMedicoPorPerfil: sin caché y GetUsuarioPerfil cae (503) -> activeDoctor sigue en 0, no revienta", async () => {
      const { c, fetches, setFetch } = entorno();
      setFetch(async () => ({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({}), text: async () => "" }));
      t.noLanza(() => c.api.resolverMedicoPorPerfil("bpalencia"));
      await espera(30);
      t.cierto(fetches.length >= 1, "sí lo intentó por red (pageFetchJson reintenta internamente sobre 503, cuenta > 1)");
      t.igual(c.api.__state.activeDoctor.id, 0, "sin caché y sin red, sigue sin identificar — como antes de esta versión");
    });

    await t.casoAsync("resolverMedicoPorPerfil: CON caché para ESE login, fija id+nombre de inmediato aunque GetUsuarioPerfil siga caído", async () => {
      const { c, fetches, setFetch } = entorno();
      c.env.gm["vgl_identidad_medico_cache"] = { bpalencia: { id: 515, name: "Dr. Brandon Palencia", ts: Date.now() } };
      setFetch(async () => ({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({}), text: async () => "" }));
      c.api.resolverMedicoPorPerfil("bpalencia");
      // Se fija SÍNCRONO, antes de que la red siquiera responda — el médico no espera nada.
      t.igual(c.api.__state.activeDoctor.id, 515, "de caché, de inmediato");
      t.igual(c.api.__state.activeDoctor.name, "Dr. Brandon Palencia");
      await espera(30);
      t.cierto(fetches.length >= 1, "aun con caché, SIGUE intentando confirmar por red en segundo plano");
      t.igual(c.api.__state.activeDoctor.id, 515, "la red cayó, pero lo de la caché no se deshace");
    });

    await t.casoAsync("resolverMedicoPorPerfil: caché de OTRO login (equipo compartido) NO se usa — exige red para ese login nuevo", async () => {
      const { c, fetches, setFetch } = entorno();
      c.env.gm["vgl_identidad_medico_cache"] = { drmartinez: { id: 99, name: "Dra. Martínez", ts: Date.now() } };
      setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: { id: 515, nombreCompleto: "Dr. Brandon Palencia" } }), text: async () => "{}" }));
      c.api.resolverMedicoPorPerfil("bpalencia");
      t.falso(c.api.__state.activeDoctor.id === 99, "NUNCA hereda la identidad de otro login cacheado — la garantía de v12.3.2 sigue intacta");
      await espera(30);
      t.igual(fetches.length, 1, "sí exigió validación fresca de backend para el login nuevo");
      t.igual(c.api.__state.activeDoctor.id, 515, "y terminó identificado por la vía normal");
    });

    await t.casoAsync("resolverMedicoPorPerfil: entrada de caché vencida (>12h) se ignora, igual que si no existiera", async () => {
      const { c, fetches, setFetch } = entorno();
      c.env.gm["vgl_identidad_medico_cache"] = { bpalencia: { id: 515, name: "Dr. Brandon Palencia", ts: Date.now() - 13 * 60 * 60 * 1000 } };
      setFetch(async () => ({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({}), text: async () => "" }));
      c.api.resolverMedicoPorPerfil("bpalencia");
      t.igual(c.api.__state.activeDoctor.id, 0, "caché de más de 12h no cuenta: se trata como ausente");
      await espera(30);
      t.cierto(fetches.length >= 1);
    });

    await t.casoAsync("resolverMedicoPorPerfil: al validar por red con éxito, guarda en caché para la próxima carga de página", async () => {
      const { c, setFetch } = entorno();
      setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: { id: 515, nombreCompleto: "Dr. Brandon Palencia" } }), text: async () => "{}" }));
      c.api.resolverMedicoPorPerfil("bpalencia");
      await espera(30);
      t.igual(c.api.__state.activeDoctor.id, 515);
      const guardado = c.env.gm["vgl_identidad_medico_cache"];
      t.cierto(!!(guardado && guardado.bpalencia), "quedó una entrada de caché para ese login");
      t.igual(guardado.bpalencia.id, 515);
      t.igual(guardado.bpalencia.name, "Dr. Brandon Palencia");
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
    t.caso("v17.16.0 — la caché de identidad del médico, probada de frente", () => {
      // Estaban en `cubre` sin que ninguna prueba las nombrara. Existen (v17.6.82) para que
      // un 503 de GetUsuarioPerfil no deje «Médico:» vacío toda la sesión, y su TTL de 12 h
      // está elegido para cubrir un turno largo pero vencer entre días.
      const c = cargar({ silencioso: true });
      t.igual(c.api._identidadMedicoCacheLeer("dr.prueba"), null, "sin nada guardado, null");
      t.igual(c.api._identidadMedicoCacheLeer(""), null, "sin login tampoco se inventa nada");

      c.api._identidadMedicoCacheGuardar("Dr.Prueba", 594, "MEDICO DE PRUEBA UNO");
      t.igual(c.api._identidadMedicoCacheLeer("dr.prueba"),
        { id: 594, name: "MEDICO DE PRUEBA UNO" },
        "se lee sin importar mayúsculas: el login llega de sitios distintos con distinta caja");

      // Lo que NO se guarda, que es lo que impide firmar una sesión con basura.
      c.api._identidadMedicoCacheGuardar("otro", 0, "SIN ID");
      t.igual(c.api._identidadMedicoCacheLeer("otro"), null, "un id 0 no es una identidad");
      c.api._identidadMedicoCacheGuardar("otro2", 7, "");
      t.igual(c.api._identidadMedicoCacheLeer("otro2"), null, "un nombre vacío tampoco");

      // El TTL: una entrada rancia no puede firmar la sesión de hoy.
      // `env.gm` es el almacén plano de GM_setValue en el arnés: se toca directamente
      // para envejecer la entrada, que es lo único que no se puede provocar esperando.
      c.env.gm["vgl_identidad_medico_cache"]["dr.prueba"].ts = Date.now() - (13 * 60 * 60 * 1000);
      t.igual(c.api._identidadMedicoCacheLeer("dr.prueba"), null,
        "pasadas 12 h la caché caduca: entre días, la identidad se vuelve a confirmar con Everest");
    });


    // v18.0.108 — S+ robustez (B3): si el navegador rechazaba la escritura de vgl_proc_today (cuota
    // llena), markOrdenesCreadasHoy/markCitaAgendadaHoy seguían como si nada: el candado «ya
    // ordenado / ya agendado hoy» no existía, el dock volvía a ofrecer Ordenar/Agendar y nadie
    // avisaba. Ahora la copia en memoria de la pestaña manda, se avisa en rojo una vez, y la
    // clave viaja al espejo GM.
    await t.casoAsync("v18.0.108 (S+ B3): con el almacén lleno, el candado «ya ordenado/agendado hoy» sigue en pie en esta pestaña, se avisa en rojo y vgl_proc_today va al espejo GM", async () => {
      const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
      const _dom = (c) => { const doc = c.env.doc; const crearBase = doc.createElement; doc.createElement = function (tag) { const e = crearBase(tag); const memo = new Map(); e.querySelector = (sel) => { const k = String(sel).replace(/:not\([^)]*\)/g, ""); if (!memo.has(k)) memo.set(k, doc.createElement("div")); return memo.get(k); }; e.querySelectorAll = () => []; return e; }; };
      const c = cargar({ silencioso: true });
      _dom(c);
      const bandeja = c.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n.parentElement = bandeja; };
      const getOrig = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : getOrig(id));
      const DOC = "1122334455";
      const setOrig = c.env.storage.setItem;
      c.env.storage.setItem = (k, v) => { if (k === "vgl_proc_today") { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } return setOrig.call(c.env.storage, k, v); };
      delete c.env.almacen.vgl_proc_today;
      c.api.markOrdenesCreadasHoy(DOC, ["AGRUP-SINT-1"], ["Tamizaje sintético"], ["Z000"]);
      t.cierto(c.api.isOrdenesCreadasHoy(DOC), "con la cuota llena, la orden REAL creada sigue marcada (antes: el candado no existía)");
      t.cierto(!!c.api.ordenesDetalleHoy(DOC), "con su detalle");
      t.cierto(c.api._procEscrituraFallida(), "y el script sabe que no pudo escribir");
      c.api.markCitaAgendadaHoy(DOC, "2026-09-10", { citaId: "CITA-SINT-1", pacienteId: 777 });
      t.cierto(c.api.isCitaAgendadaHoy(DOC) && !!c.api.citaDetalleHoy(DOC), "la cita también sigue marcada");
      await esperar(30);
      const textos = bandeja.children.map((x) => { try { return String(x.querySelector(".vgl-toast-title").textContent) + " · " + String(x.querySelector(".vgl-toast-b").textContent); } catch (e) { return String(x.innerHTML || ""); } });
      t.cierto(textos.some((x) => /no se pudo guardar/.test(x) && /otras pestañas/.test(x)), "se avisa en rojo, y dice que otras pestañas no lo verán: " + JSON.stringify(textos).slice(0, 200));
      // el almacén vuelve a aceptar: lo acumulado en memoria se escribe y la bandera se limpia
      c.env.storage.setItem = setOrig;
      c.api.markLabAgendadaHoy(DOC);
      t.falso(c.api._procEscrituraFallida(), "cuando el almacén vuelve, la bandera se limpia");
      const guardado = JSON.parse(c.env.almacen.vgl_proc_today);
      t.cierto(guardado.ordenes.includes(DOC) && guardado.citas.includes(DOC) && guardado.labs.includes(DOC), "y lo acumulado en memoria quedó escrito entero");
      t.cierto("espejo_vgl_proc_today" in c.env.gm, "vgl_proc_today está en el espejo GM (antes no)");
      c.env.doc.getElementById = getOrig;
    });

  },
};
