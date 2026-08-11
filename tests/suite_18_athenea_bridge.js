// =====================================================================
//  SUITE 18 — Puente completo a Athenea y capa de credenciales (v12.3.3 a v12.3.16)
//  Cubre: los 4 parsers HTML/multipart, el transporte _gmReq, la ofuscación
//  reversible (XOR+base64) y el guardado de credenciales POR MÉDICO, el
//  auto-login opt-in (con la regla "rechazo NO reintenta, red SÍ"), el
//  latido de sesión (keepAlive) y el flujo de 3-4 pasos que resuelve
//  solicitudes/labs de un paciente en Athenea.
//
//  Datos de prueba: SIEMPRE sintéticos ("medico.prueba" / "ClaveFalsaXXX"),
//  nunca credenciales reales — ver instrucciones de la tarea.
//
//  Regla de oro de este banco (la aprendimos hoy con una promesa colgada):
//  todo mock de GM_xmlhttpRequest debe responder onload/onerror/ontimeout
//  para TODAS las URLs que la función bajo prueba pueda visitar, nunca solo
//  la que nos interesa. Cada camino de abajo fue verificado con
//  `node -e` contra el harness real antes de escribirse aquí.
// =====================================================================

const BASE = "https://medicosviva1a.atheneasoluciones.com";

// Credenciales SINTÉTICAS — nunca reales.
const USR = "medico.prueba";
const PWD = "ClaveFalsa123_ñá";

module.exports = {
  nombre: "Puente Athenea y credenciales (Suite 18)",
  cubre: [
    "_atheneaToken", "_atheneaIdPaciente", "_atheneaCedulaCoincide",
    "_atheneaExtraerSolicitudes", "_atheneaMultipart", "_atheneaPareceLogin",
    "_gmReq", "getAtheneaSolicitudesAuto", "getAtheneaLabsAuto",
    "atheneaKeepAlive", "atheneaAutoLogin",
    "atheneaCredsAll", "atheneaCredsGet", "atheneaCredsSet", "atheneaCredsClear",
    "_vglXor", "_vglOfusca", "_vglDesofusca",
  ],

  async pruebas(t, api, env, cargar) {
    // Entorno con GM_xmlhttpRequest intercambiable + registro de llamadas.
    function entornoAthenea() {
      const llamadas = [];
      let plan = (o) => o.onload({ status: 200, responseText: "" });
      const c = cargar({ silencioso: true, gmxhr: (o) => { llamadas.push(o); plan(o); } });
      return { c, llamadas, setPlan: (f) => { plan = f; } };
    }
    // Instala un espía de consola sobre el contexto YA cargado (silencioso:true deja un
    // stub no-op; lo reemplazamos para poder verificar mensajes de diagnóstico).
    function espiarConsola(c) {
      const logs = [];
      c.ctx.console = {
        log: (...a) => logs.push(a.join(" ")),
        warn: (...a) => logs.push("WARN:" + a.join(" ")),
        error: (...a) => logs.push("ERROR:" + a.join(" ")),
        info: (...a) => logs.push(a.join(" ")),
      };
      return logs;
    }

    // =====================================================================
    // _atheneaMultipart
    // =====================================================================
    t.caso("_atheneaMultipart: arma el cuerpo con boundary, un bloque por campo y cierre final", () => {
      const mp = api._atheneaMultipart({ tipoId: "0", numId: "123456789", vacio: null });
      t.cierto(typeof mp.boundary === "string" && mp.boundary.indexOf("----VglAthenea") === 0);
      t.cierto(mp.body.indexOf(`--${mp.boundary}\r\nContent-Disposition: form-data; name="tipoId"\r\n\r\n0\r\n`) >= 0);
      t.cierto(mp.body.indexOf(`name="numId"\r\n\r\n123456789\r\n`) >= 0, "el valor del campo va tal cual");
      t.cierto(mp.body.indexOf(`name="vacio"\r\n\r\n\r\n`) >= 0, "null se serializa como cadena vacía, no la palabra null");
      t.cierto(mp.body.lastIndexOf(`--${mp.boundary}--\r\n`) === mp.body.length - (`--${mp.boundary}--\r\n`).length, "cierra con el boundary final");
    });

    t.caso("_atheneaMultipart: cada llamada genera un boundary distinto (no se reutiliza al azar)", () => {
      const a = api._atheneaMultipart({ x: "1" });
      const b = api._atheneaMultipart({ x: "1" });
      t.cierto(a.boundary !== b.boundary);
    });

    // =====================================================================
    // _atheneaToken
    // =====================================================================
    t.caso("_atheneaToken: lo encuentra con name antes de value (orden real del formulario de Athenea)", () => {
      const html = `<input name="__RequestVerificationToken" type="hidden" value="TOK-ABC123" />`;
      t.igual(api._atheneaToken(html), "TOK-ABC123");
    });

    t.caso("_atheneaToken: también lo encuentra con value antes de name (segunda respuesta del flujo, orden distinto)", () => {
      const html = `<input value="TOK-XYZ789" type="hidden" name="__RequestVerificationToken" />`;
      t.igual(api._atheneaToken(html), "TOK-XYZ789");
    });

    t.caso("_atheneaToken: sin el campo en el HTML, cadena vacía (nunca null ni excepción)", () => {
      t.igual(api._atheneaToken("<div>página sin formulario</div>"), "");
      t.noLanza(() => api._atheneaToken(""));
    });

    // =====================================================================
    // _atheneaIdPaciente
    // =====================================================================
    t.caso("_atheneaIdPaciente: lee el value del <input name=\"IdPaciente\">", () => {
      const html = `<input type="hidden" id="IdPaciente" name="IdPaciente" value="4567" />`;
      t.igual(api._atheneaIdPaciente(html), "4567");
    });

    t.caso("_atheneaIdPaciente: input presente pero value vacío -> cadena vacía (no un paciente)", () => {
      const html = `<input type="hidden" name="IdPaciente" value="" />`;
      t.igual(api._atheneaIdPaciente(html), "");
    });

    t.caso("_atheneaIdPaciente: sin el input en el HTML -> cadena vacía", () => {
      t.igual(api._atheneaIdPaciente("<div>sin coincidencia única</div>"), "");
    });

    // =====================================================================
    // _atheneaCedulaCoincide
    // =====================================================================
    t.caso("_atheneaCedulaCoincide: prefijo de tipo de documento (CC/TI/...) seguido de la misma cédula -> true", () => {
      t.cierto(api._atheneaCedulaCoincide("<div>CC: 123456789</div>", "123456789"));
      t.cierto(api._atheneaCedulaCoincide("<span>TI - 55667788</span>", "55667788"));
    });

    t.caso("_atheneaCedulaCoincide: prefijo presente pero con OTRA cédula -> false (no confía a medias)", () => {
      t.falso(api._atheneaCedulaCoincide("<div>CC: 987654321</div>", "123456789"));
    });

    t.caso("_atheneaCedulaCoincide: sin prefijo reconocible, cae al respaldo de coincidencia por palabra completa", () => {
      t.cierto(api._atheneaCedulaCoincide("<div>Documento 123456789 registrado</div>", "123456789"));
    });

    t.caso("_atheneaCedulaCoincide: el respaldo NO casa un número más largo que solo contiene la cédula como substring", () => {
      t.falso(api._atheneaCedulaCoincide("<div>1234567890</div>", "123456789"), "123456789 embebido en 1234567890 no es la misma cédula");
    });

    t.caso("_atheneaCedulaCoincide: sin cédula a comparar, siempre false (nunca confía por defecto)", () => {
      t.falso(api._atheneaCedulaCoincide("<div>CC: 123456789</div>", ""));
      t.falso(api._atheneaCedulaCoincide("<div>CC: 123456789</div>", null));
    });

    // =====================================================================
    // _atheneaExtraerSolicitudes
    // =====================================================================
    t.caso("_atheneaExtraerSolicitudes: lee varias tarjetas, separa idSolicitud del año final y respeta data-modulo", () => {
      const html = `
        <form id="1112025" data-modulo="LAB" action="/Resultados/Reporte" method="post"></form>
        <form id="2222024" data-modulo="PAT" action="/Resultados/Reporte" method="post"></form>
      `;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out, [
        { idSolicitud: 111, ano: 2025, modulo: "LAB" },
        { idSolicitud: 222, ano: 2024, modulo: "PAT" },
      ]);
    });

    t.caso("_atheneaExtraerSolicitudes: sin data-modulo, asume LAB por defecto", () => {
      const html = `<form id="3332026" action="/Resultados/Reporte"></form>`;
      t.igual(api._atheneaExtraerSolicitudes(html), [{ idSolicitud: 333, ano: 2026, modulo: "LAB" }]);
    });

    t.caso("_atheneaExtraerSolicitudes: ignora formularios que no apuntan a /Resultados/Reporte", () => {
      const html = `<form id="4442026" action="/Resultados/Otro"></form>`;
      t.igual(api._atheneaExtraerSolicitudes(html), []);
    });

    t.caso("_atheneaExtraerSolicitudes: HTML vacío o sin formularios -> arreglo vacío, nunca lanza", () => {
      t.igual(api._atheneaExtraerSolicitudes(""), []);
      t.noLanza(() => api._atheneaExtraerSolicitudes("<div>nada</div>"));
    });

    // =====================================================================
    // _atheneaPareceLogin
    // =====================================================================
    t.caso("_atheneaPareceLogin: un input type=password lo delata como pantalla de login", () => {
      t.cierto(api._atheneaPareceLogin(`<input type="password" name="Password" />`));
    });

    t.caso("_atheneaPareceLogin: el texto \"Iniciar sesión\" (con o sin tilde) también lo delata", () => {
      t.cierto(api._atheneaPareceLogin("<h1>Iniciar sesión</h1>"));
      t.cierto(api._atheneaPareceLogin("<h1>Iniciar Sesion</h1>"));
    });

    t.caso("_atheneaPareceLogin: una página normal de resultados no lo dispara", () => {
      t.falso(api._atheneaPareceLogin("<div>Resultados del paciente Juan Pérez — Solicitud #111</div>"));
      t.falso(api._atheneaPareceLogin(""));
    });

    // =====================================================================
    // _gmReq
    // =====================================================================
    await t.casoAsync("_gmReq: por defecto timeout=15000 y resuelve con la respuesta cruda de GM_xmlhttpRequest", async () => {
      let visto = null;
      const c = cargar({ silencioso: true, gmxhr: (o) => { visto = o; o.onload({ status: 200, responseText: "ok" }); } });
      const r = await c.api._gmReq({ method: "GET", url: "https://x/y" });
      t.igual(visto.timeout, 15000);
      t.igual(visto.method, "GET");
      t.igual(visto.url, "https://x/y");
      t.igual(r.status, 200);
      t.igual(r.responseText, "ok");
    });

    await t.casoAsync("_gmReq: un timeout explícito pisa el valor por defecto", async () => {
      let visto = null;
      const c = cargar({ silencioso: true, gmxhr: (o) => { visto = o; o.onload({ status: 200, responseText: "" }); } });
      await c.api._gmReq({ method: "GET", url: "https://x/y", timeout: 5000 });
      t.igual(visto.timeout, 5000);
    });

    await t.casoAsync("_gmReq: onerror y ontimeout rechazan con mensajes distintos (NetErr vs Timeout)", async () => {
      const c1 = cargar({ silencioso: true, gmxhr: (o) => o.onerror() });
      let m1 = "";
      try { await c1.api._gmReq({ method: "GET", url: "https://x" }); } catch (e) { m1 = e.message; }
      t.igual(m1, "NetErr");
      const c2 = cargar({ silencioso: true, gmxhr: (o) => o.ontimeout() });
      let m2 = "";
      try { await c2.api._gmReq({ method: "GET", url: "https://x" }); } catch (e) { m2 = e.message; }
      t.igual(m2, "Timeout");
    });

    // =====================================================================
    // _vglXor / _vglOfusca / _vglDesofusca
    // =====================================================================
    t.caso("_vglXor: aplicado dos veces devuelve el original (es su propio inverso)", () => {
      const casos = ["", "a", "medico.prueba", "Clave#Falsa-123_ñáéíóú", "🩺emoji"];
      for (const s of casos) t.igual(api._vglXor(api._vglXor(s)), s, "xor(xor(s)) === s para: " + s);
    });

    t.caso("_vglOfusca/_vglDesofusca: viaje de ida y vuelta exacto, incluida tildes/símbolos/unicode", () => {
      const casos = [USR, PWD, "áéíóúÁÉÍÓÚñÑ", "s3guridad!@#$%^&*()", "日本語テスト"];
      for (const s of casos) {
        const ofuscado = api._vglOfusca(s);
        t.igual(api._vglDesofusca(ofuscado), s, "round-trip para: " + s);
        t.cierto(ofuscado !== s, "el resultado ofuscado no debe ser el texto plano: " + s);
      }
    });

    t.caso("_vglOfusca: cadena vacía no rompe el cifrado ni el descifrado", () => {
      const o = api._vglOfusca("");
      t.noLanza(() => api._vglDesofusca(o));
    });

    // =====================================================================
    // atheneaCredsAll / atheneaCredsGet / atheneaCredsSet / atheneaCredsClear
    // =====================================================================
    t.caso("atheneaCredsAll: almacén vacío al arrancar", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.atheneaCredsAll(), {});
    });

    t.caso("atheneaCredsSet/Get: viaje de ida y vuelta EXACTO de usuario+contraseña, con tildes y símbolos", () => {
      const c = cargar({ silencioso: true });
      const ok = c.api.atheneaCredsSet(11, USR, PWD);
      t.cierto(ok);
      const leido = c.api.atheneaCredsGet(11);
      t.igual(leido, { u: USR, p: PWD }, "debe leerse exactamente lo guardado, sin recortes ni mojibake");
    });

    t.caso("atheneaCredsSet: en el almacén crudo (GM_setValue) NUNCA queda el texto plano de la contraseña", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet(11, USR, PWD);
      const crudo = JSON.stringify(c.env.gm["vgl_ath_creds"]);
      t.falso(crudo.includes(PWD), "la contraseña en claro no debe aparecer en lo persistido");
      t.falso(crudo.includes(USR), "tampoco el usuario en claro (ofuscado también)");
    });

    t.caso("atheneaCredsSet/Get: AISLAMIENTO POR MÉDICO — lo guardado para un docId no aparece bajo otro", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet(11, "medico.uno", "ClaveUno_1");
      c.api.atheneaCredsSet(22, "medico.dos", "ClaveDos_2");
      t.igual(c.api.atheneaCredsGet(11), { u: "medico.uno", p: "ClaveUno_1" });
      t.igual(c.api.atheneaCredsGet(22), { u: "medico.dos", p: "ClaveDos_2" });
      t.igual(c.api.atheneaCredsGet(33), null, "un tercer médico sin credenciales propias no hereda nada");
      const all = c.api.atheneaCredsAll();
      t.igual(Object.keys(all).sort(), ["11", "22"]);
    });

    t.caso("atheneaCredsSet: sin docId, sin usuario o sin contraseña -> false, y no toca el almacén", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api.atheneaCredsSet(null, USR, PWD));
      t.falso(c.api.atheneaCredsSet(11, "", PWD));
      t.falso(c.api.atheneaCredsSet(11, USR, ""));
      t.igual(c.api.atheneaCredsAll(), {});
    });

    t.caso("atheneaCredsGet: docId ausente o sin credenciales guardadas -> null (nunca lanza)", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.atheneaCredsGet(null), null);
      t.igual(c.api.atheneaCredsGet(0), null);
      t.igual(c.api.atheneaCredsGet(999), null);
    });

    t.caso("atheneaCredsClear: borrar UN docId deja intactas las credenciales de los demás", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet(11, "medico.uno", "ClaveUno_1");
      c.api.atheneaCredsSet(22, "medico.dos", "ClaveDos_2");
      c.api.atheneaCredsClear(11);
      t.igual(c.api.atheneaCredsGet(11), null);
      t.igual(c.api.atheneaCredsGet(22), { u: "medico.dos", p: "ClaveDos_2" }, "el otro médico no se ve afectado");
      t.igual(Object.keys(c.api.atheneaCredsAll()), ["22"]);
    });

    t.caso("atheneaCredsClear: sin docId, borra TODO el almacén de credenciales", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet(11, "medico.uno", "ClaveUno_1");
      c.api.atheneaCredsSet(22, "medico.dos", "ClaveDos_2");
      c.api.atheneaCredsClear();
      t.igual(c.api.atheneaCredsAll(), {});
    });

    // =====================================================================
    // atheneaAutoLogin
    // =====================================================================
    t.caso("atheneaAutoLogin: (a) con S.atheneaAutoLogin en false (por defecto) no hace NADA aunque haya credenciales", async () => {
      const e = entornoAthenea();
      e.c.api.__state.activeDoctor = { id: 42, name: "DRA PRUEBA" };
      e.c.api.atheneaCredsSet(42, USR, PWD);
      t.falso(e.c.api.__S.atheneaAutoLogin, "el interruptor debe venir apagado de fábrica");
      const r = await e.c.api.atheneaAutoLogin();
      t.falso(r);
      t.igual(e.llamadas.length, 0, "no debe tocar la red mientras el interruptor esté apagado");
    });

    t.caso("atheneaAutoLogin: (b) con el interruptor encendido pero SIN médico en sesión (id=0), tampoco hace nada", async () => {
      const e = entornoAthenea();
      e.c.api.__S.atheneaAutoLogin = true;
      e.c.api.__state.activeDoctor = { id: 0, name: "" };
      e.c.api.atheneaCredsSet(999, USR, PWD);   // credenciales de OTRO id no cuentan sin sesión activa
      const r = await e.c.api.atheneaAutoLogin();
      t.falso(r);
      t.igual(e.llamadas.length, 0);
    });

    t.caso("atheneaAutoLogin: interruptor encendido, médico en sesión, pero sin credenciales guardadas -> nada", async () => {
      const e = entornoAthenea();
      e.c.api.__S.atheneaAutoLogin = true;
      e.c.api.__state.activeDoctor = { id: 55, name: "DR X" };
      const r = await e.c.api.atheneaAutoLogin();
      t.falso(r);
      t.igual(e.llamadas.length, 0);
    });

    await t.casoAsync("atheneaAutoLogin: (c) éxito — GET trae el token, POST con Usuario/Password/token y una respuesta sin login = sesión iniciada", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        if (o.url === BASE + "/Account/Login" && o.method === "GET") {
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-LOGIN" /></form>` });
        } else if (o.url === BASE + "/Account/Login" && o.method === "POST") {
          o.onload({ status: 302, responseText: "" });   // éxito real observado en el HAR: 302 a /Resultados
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      e.c.api.__S.atheneaAutoLogin = true;
      e.c.api.__state.activeDoctor = { id: 42, name: "DRA PRUEBA" };
      e.c.api.atheneaCredsSet(42, USR, PWD);
      const r = await e.c.api.atheneaAutoLogin();
      t.cierto(r);
      t.igual(e.llamadas.length, 2, "un GET (token) y un POST (credenciales), nada más");
      t.igual(e.llamadas[0].method, "GET");
      t.igual(e.llamadas[0].url, BASE + "/Account/Login");
      t.igual(e.llamadas[1].method, "POST");
      t.igual(e.llamadas[1].headers["Content-Type"], "application/x-www-form-urlencoded");
      t.cierto(e.llamadas[1].data.indexOf("Usuario=" + encodeURIComponent(USR)) >= 0);
      t.cierto(e.llamadas[1].data.indexOf("Password=" + encodeURIComponent(PWD)) >= 0);
      t.cierto(e.llamadas[1].data.indexOf("__RequestVerificationToken=TOK-LOGIN") >= 0);
    });

    await t.casoAsync("atheneaAutoLogin: (d) rechazo de credenciales — se marca y NO reintenta en una segunda llamada inmediata", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        if (o.url === BASE + "/Account/Login" && o.method === "GET") {
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-LOGIN" /></form>` });
        } else if (o.url === BASE + "/Account/Login" && o.method === "POST") {
          // credenciales rechazadas: Athenea vuelve a servir la pantalla de login
          o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión — credenciales inválidas` });
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      e.c.api.__S.atheneaAutoLogin = true;
      e.c.api.__state.activeDoctor = { id: 42, name: "DRA PRUEBA" };
      e.c.api.atheneaCredsSet(42, USR, "ClaveIncorrecta_000");
      const r1 = await e.c.api.atheneaAutoLogin();
      t.falso(r1);
      const llamadasTrasPrimerIntento = e.llamadas.length;
      t.igual(llamadasTrasPrimerIntento, 2, "un intento completo: GET + POST");
      // Segunda llamada INMEDIATA: no debe volver a tocar la red en absoluto.
      const r2 = await e.c.api.atheneaAutoLogin();
      t.falso(r2);
      t.igual(e.llamadas.length, llamadasTrasPrimerIntento, "cero llamadas nuevas: el bloqueo evita reintentar solo");
    });

    await t.casoAsync("atheneaAutoLogin: (e) fallo de RED (no de credenciales) no bloquea — la siguiente llamada SÍ reintenta", async () => {
      const e = entornoAthenea();
      let fallaRed = true;
      e.setPlan((o) => {
        if (o.url === BASE + "/Account/Login" && o.method === "GET") {
          if (fallaRed) { o.onerror(); return; }
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-2" /></form>` });
        } else if (o.url === BASE + "/Account/Login" && o.method === "POST") {
          o.onload({ status: 302, responseText: "" });
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      e.c.api.__S.atheneaAutoLogin = true;
      e.c.api.__state.activeDoctor = { id: 77, name: "DR RED" };
      e.c.api.atheneaCredsSet(77, USR, PWD);
      const r1 = await e.c.api.atheneaAutoLogin();
      t.falso(r1, "el GET falló por red: no hay sesión");
      t.igual(e.llamadas.length, 1, "solo el GET que falló; nunca llegó a intentar el POST");
      fallaRed = false;   // la red se recupera
      const r2 = await e.c.api.atheneaAutoLogin();
      t.cierto(r2, "sin bloqueo permanente, el siguiente intento sí puede tener éxito");
      t.igual(e.llamadas.length, 3, "GET fallido + GET ok + POST ok");
    });

    // =====================================================================
    // atheneaKeepAlive
    // =====================================================================
    await t.casoAsync("atheneaKeepAlive: sesión viva — un solo GET liviano a BusquedaPaciente, sin marcar caída", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => o.onload({ status: 200, responseText: "<html>Bienvenido, resultados de laboratorio</html>" }));
      const logs = espiarConsola(e.c);
      await e.c.api.atheneaKeepAlive();
      t.igual(e.llamadas.length, 1);
      t.igual(e.llamadas[0].url, BASE + "/Resultados/BusquedaPaciente");
      t.cierto(logs.some((l) => l.includes("sesión ACTIVA")), "debe registrar que la sesión sigue activa");
    });

    await t.casoAsync("atheneaKeepAlive: sesión caída (paso 1 devuelve pantalla de login) y con auto-login apagado, se queda caída", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` }));
      const logs = espiarConsola(e.c);
      // S.atheneaAutoLogin en false por defecto: atheneaKeepAlive no debe intentar loguear.
      await e.c.api.atheneaKeepAlive();
      t.igual(e.llamadas.length, 1, "sin auto-login no hay llamadas extra de /Account/Login");
      t.cierto(logs.some((l) => l.includes("sesión NO activa") || l.includes("NO activa")));
    });

    await t.casoAsync("atheneaKeepAlive: al REVIVIR la sesión (estaba caída y ahora responde bien), resetea el estado para que el robot reintente", async () => {
      const e = entornoAthenea();
      let viva = false;
      e.setPlan((o) => {
        if (viva) o.onload({ status: 200, responseText: "<html>Resultados</html>" });
        else o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` });
      });
      const logs = espiarConsola(e.c);
      await e.c.api.atheneaKeepAlive();
      t.cierto(logs.some((l) => l.includes("NO activa")), "primer latido: cae");
      viva = true;
      logs.length = 0;
      await e.c.api.atheneaKeepAlive();
      t.cierto(logs.some((l) => l.includes("sesión ACTIVA")), "segundo latido: revive");
      t.cierto(logs.some((l) => l.includes("sesión restaurada") && l.includes("reintentará")),
        "el mensaje que acompaña el reseteo de lastAutoFetchedDoc debe aparecer SOLO al pasar de caída a viva");
    });

    await t.casoAsync("atheneaKeepAlive: sesión caída + auto-login encendido con credenciales válidas -> intenta loguear DENTRO del mismo latido y queda viva", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) {
          o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` });   // el chequeo del latido ve la sesión caída
        } else if (url.includes("/Account/Login") && o.method === "GET") {
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="T" /></form>` });
        } else if (url.includes("/Account/Login") && o.method === "POST") {
          o.onload({ status: 302, responseText: "" });
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      e.c.api.__S.atheneaAutoLogin = true;
      e.c.api.__state.activeDoctor = { id: 88, name: "DR AUTO" };
      e.c.api.atheneaCredsSet(88, USR, PWD);
      const logs = espiarConsola(e.c);
      await e.c.api.atheneaKeepAlive();
      t.igual(e.llamadas.length, 3, "GET BusquedaPaciente (caída) + GET/POST de Account/Login (auto-login)");
      t.cierto(logs.some((l) => l.includes("sesión iniciada automáticamente")), "el auto-login debió correr dentro del latido");
      t.cierto(logs.some((l) => l.includes("sesión ACTIVA")), "el latido termina reportando la sesión como viva, no caída");
    });

    // =====================================================================
    // getAtheneaSolicitudesAuto / getAtheneaLabsAuto
    // =====================================================================
    const DOC = "111222333";

    function planFeliz(o) {
      const url = String(o.url || "");
      if (url.includes("BusquedaPaciente")) {
        o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
      } else if (url.includes("BuscarPaciente")) {
        o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
      } else if (url.includes("DatosPaciente")) {
        o.onload({
          status: 200,
          responseText: `CC: ${DOC} <form id="5552026" data-modulo="LAB" action="/Resultados/Reporte"></form>`,
        });
      } else if (url.includes("consultaDetalleSolicitud")) {
        o.onload({
          status: 200,
          responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO" }]) }),
        });
      } else {
        o.onload({ status: 200, responseText: "" });
      }
    }

    await t.casoAsync("getAtheneaSolicitudesAuto: camino feliz completo — 3 pasos (GET+2 POST multipart) y devuelve idPaciente+solicitudes", async () => {
      const e = entornoAthenea();
      e.setPlan(planFeliz);
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, { idPaciente: "999", solicitudes: [{ idSolicitud: 555, ano: 2026, modulo: "LAB" }] });
      t.igual(e.llamadas.length, 3);
      t.igual(e.llamadas[0].method, "GET");
      t.cierto(e.llamadas[0].url.includes("/Resultados/BusquedaPaciente"));
      t.igual(e.llamadas[1].method, "POST");
      t.cierto(e.llamadas[1].url.includes("/Resultados/BuscarPaciente"));
      t.cierto(e.llamadas[1].headers["Content-Type"].indexOf("multipart/form-data; boundary=") === 0);
      t.cierto(e.llamadas[1].data.includes(`name="numId"\r\n\r\n${DOC}`), "manda la cédula en numId");
      t.cierto(e.llamadas[1].data.includes(`name="tipoId"\r\n\r\n0`), "tipoId=0 es Cédula de Ciudadanía");
      t.igual(e.llamadas[2].method, "POST");
      t.cierto(e.llamadas[2].url.includes("/Resultados/DatosPaciente"));
      t.cierto(e.llamadas[2].data.includes(`name="IdPaciente"\r\n\r\n999`), "usa el IdPaciente devuelto por el paso 2, no uno inventado");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sesión caída — paso 1 devuelve pantalla de login -> null, una sola llamada", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` }));
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null);
      t.igual(e.llamadas.length, 1, "se detiene en el primer paso, no sigue adivinando");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sesión caduca A MITAD de la búsqueda (paso 2 con login) -> null, dos llamadas", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` });
        else o.onload({ status: 200, responseText: "" });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null);
      t.igual(e.llamadas.length, 2);
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sin IdPaciente único en el paso 2 (0 o varios resultados) -> null, no adivina", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<div>0 resultados</div>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null);
      t.igual(e.llamadas.length, 2, "sin idPaciente ni token no continúa al paso 3");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: la cédula de la respuesta NO coincide con la buscada -> null por seguridad", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="777" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: 000000000 <form id="1112025" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null, "la cédula 000000000 de la respuesta no es la buscada (" + DOC + ")");
      t.igual(e.llamadas.length, 3, "llegó hasta el paso 3, pero se descarta ahí");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sin docId (vacío o null) no toca la red y devuelve null", async () => {
      const e = entornoAthenea();
      t.igual(await e.c.api.getAtheneaSolicitudesAuto(""), null);
      t.igual(await e.c.api.getAtheneaSolicitudesAuto(null), null);
      t.igual(e.llamadas.length, 0);
    });

    await t.casoAsync("getAtheneaLabsAuto: camino feliz completo — 3 pasos de resolución + 1 consulta de detalle por solicitud LAB", async () => {
      const e = entornoAthenea();
      e.setPlan(planFeliz);
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs, [{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO" }]);
      t.igual(e.llamadas.length, 4, "3 de la resolución + 1 de consultaDetalleSolicitud");
      t.cierto(e.llamadas[3].url.includes("consultaDetalleSolicitud"));
      const cuerpo = JSON.parse(e.llamadas[3].data);
      t.igual(cuerpo, { idSolicitud: 555, ano: 2026, modulo: "LAB" });
    });

    await t.casoAsync("getAtheneaLabsAuto: sesión caída (paso 1 con login) -> [] sin llegar nunca a pedir detalle", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` }));
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs, []);
      t.falso(e.llamadas.some((o) => String(o.url).includes("consultaDetalleSolicitud")));
    });

    await t.casoAsync("getAtheneaLabsAuto: solicitudes existen pero ninguna es del módulo LAB -> [] sin consultar detalle", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="777" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC} <form id="1112025" data-modulo="PAT" action="/Resultados/Reporte"></form>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs, []);
      t.igual(e.llamadas.length, 3, "las 3 de resolver + ninguna de detalle, porque no hay solicitudes LAB");
    });
  },
};
