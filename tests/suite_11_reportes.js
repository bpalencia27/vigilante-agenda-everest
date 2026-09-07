// =====================================================================
//  SUITE 11 — Cola de reportes al remoto (TABLERO vía Apps Script)
//
//  Cubre el circuito completo: repUrl/repOn (interruptores), repPost
//  (el POST real vía GM_xmlhttpRequest con validación anti-login de
//  Google), repQLoad/repQSave (la cola persistida en GM, máx. 30),
//  repFlush (entrega en orden, tope 10 por tanda, conserva ante fallo),
//  reportar (arma la fila), repDailySummary (candado diario) y
//  reportarFraude (tope 20/día con reinicio por fecha).
//
//  Cada caso que muta estado (cola en memoria, contadores de fraude,
//  candados) usa un cargar() fresco: repQ, repFrN y repFrDia viven en el
//  closure del IIFE y NO se reinician entre casos.
// =====================================================================
module.exports = {
  nombre: "Cola de reportes al remoto (Suite 11)",
  cubre: [
    "repUrl", "repOn", "repPost", "repQLoad", "repQSave",
    "repFlush", "reportar", "repDailySummary", "reportarFraude",
  ],

  async pruebas(t, api, env, cargar) {
    const URL_FABRICA = /^https:\/\/script\.google\.com\/macros\//;
    const tick = (ms) => new Promise((r) => setTimeout(r, ms === undefined ? 15 : ms));

    // Red simulada: registra cada GM_xmlhttpRequest y contesta según "modo".
    function crearRed() {
      const red = { posts: [], modo: "ok", status: 200, cuerpo: '{"ok":true}', finalUrl: "" };
      red.gmxhr = (o) => {
        red.posts.push(o);
        if (red.modo === "lanza") throw new Error("GM roto");
        if (red.modo === "error") { o.onerror && o.onerror(new Error("sin red")); return; }
        o.onload({ status: red.status, responseText: red.cuerpo, finalUrl: red.finalUrl });
      };
      red.cuerpos = () => red.posts.map((p) => JSON.parse(p.data));
      return red;
    }

    // Fecha congelada dentro del vm (patrón de la suite 02); mockIso es mutable.
    function congelarFecha(c, isoInicial) {
      const OriginalDate = c.ctx.Date || Date;
      const caja = { iso: isoInicial };
      const FakeDate = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) super(caja.iso);
          else super(...args);
        }
      };
      FakeDate.now = () => new OriginalDate(caja.iso).getTime();
      c.ctx.Date = FakeDate;
      return caja;
    }

    // ---------- repUrl ----------
    t.caso("repUrl: sin URL personalizada devuelve la del tablero de fábrica", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.__S.reporteUrl, "", "el ajuste de fábrica viene vacío");
      t.cierto(URL_FABRICA.test(c.api.repUrl()), "debe caer a la Web App de fábrica");
    });

    t.caso("repUrl: la personalizada válida gana (con recorte); la inválida cae a fábrica", () => {
      const c = cargar({ silencioso: true });
      // válida con espacio al FINAL: pasa el /^https?:/ y luego se recorta
      c.api.__S.reporteUrl = "https://mi.servidor/hoja ";
      t.igual(c.api.repUrl(), "https://mi.servidor/hoja");
      // esquema no http(s): se ignora
      c.api.__S.reporteUrl = "ftp://mi.servidor/hoja";
      t.cierto(URL_FABRICA.test(c.api.repUrl()));
      // detalle real: con espacio al INICIO el regex ^https falla ANTES del trim,
      // así que también cae a la de fábrica
      c.api.__S.reporteUrl = " https://mi.servidor/hoja";
      t.cierto(URL_FABRICA.test(c.api.repUrl()));
    });

    // ---------- repOn ----------
    t.caso("repOn: nace ENCENDIDO (política del dueño v17.58.2); el guard del canal sigue siendo real", () => {
      const c = cargar({ silencioso: true, defaultOff: true });
      t.cierto(c.api.repOn(), "de fábrica S.reporte=true: desde v17.58.2 la telemetría es obligatoria (no hay interruptor en Ajustes)");
      c.api.__S.reporte = false;
      t.falso(c.api.repOn(), "con el ajuste apagado (estado imposible por UI desde v17.58.2, pero la guarda sigue cortando el 100% de la red)");
      c.api.__S.reporte = true;
      t.cierto(c.api.repOn(), "con el ajuste encendido reporta");
      c.ctx.GM_xmlhttpRequest = undefined; // sin el permiso de Tampermonkey no hay canal
      t.falso(c.api.repOn());
    });

    // ---------- repPost ----------
    await t.casoAsync("repPost: manda POST con el JSON y Content-Type text/plain, y acepta la respuesta buena", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      const ok = await c.api.repPost({ evento: "prueba", n: 7 });
      t.cierto(ok, "una respuesta 200 con JSON cuenta como recibida");
      t.igual(red.posts.length, 1);
      t.igual(red.posts[0].method, "POST");
      t.cierto(URL_FABRICA.test(red.posts[0].url), "sin ajuste va a la URL de fábrica");
      t.igual(JSON.parse(red.posts[0].data), { evento: "prueba", n: 7 });
      // text/plain evita el preflight CORS contra Apps Script
      t.cierto(String(red.posts[0].headers["Content-Type"]).indexOf("text/plain") === 0);
    });

    await t.casoAsync("repPost: rechaza 500, redirección al login de Google, HTML y errores de red", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      red.status = 500;
      t.falso(await c.api.repPost({ a: 1 }), "500 no cuenta");
      red.status = 200; red.finalUrl = "https://accounts.google.com/ServiceLogin?x=1";
      t.falso(await c.api.repPost({ a: 2 }), "aterrizar en el login de Google no cuenta");
      red.finalUrl = ""; red.cuerpo = "  <html><body>Error</body></html>";
      t.falso(await c.api.repPost({ a: 3 }), "una página HTML no es la Hoja recibiendo");
      red.cuerpo = '{"ok":true}'; red.modo = "error";
      t.falso(await c.api.repPost({ a: 4 }), "onerror resuelve false");
      red.modo = "lanza";
      t.falso(await c.api.repPost({ a: 5 }), "si GM lanza, el catch resuelve false");
    });

    // v17.49.0 (D4) — El receptor envuelve todo su trabajo en un try/catch que responde
    // el cuerpo "err" con HTTP 200: significa "recibi la fila pero no pude guardarla".
    // Hasta hoy eso pasaba por entrega buena — la fila salia de la cola sin haberse
    // escrito, y el sello «ultimo envio confirmado» se ponia verde.
    await t.casoAsync("v17.49.0: la respuesta 'err' del panel NO cuenta como entrega (recibida no es guardada)", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      red.cuerpo = "err";
      t.falso(await c.api.repPost({ evento: "fraude" }), "no pudo guardarla: la fila tiene que quedarse para reintentar");
      const err = JSON.parse(c.env.almacen["vgl_rep_last_err"] || "null");
      t.cierto(!!err && String(err.detalle).indexOf("no pudo guardarla") >= 0, "y queda dicho por que, sin fingir un exito");
      t.igual(c.env.almacen["vgl_rep_last_ok"], undefined, "el sello de «confirmado» NO se pone verde con un fallo del panel");
    });

    await t.casoAsync("v17.49.0: 'dup' y 'ok' siguen contando como entrega (la fila ya esta en la Hoja)", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      red.cuerpo = "dup";
      t.cierto(await c.api.repPost({ evento: "resumen" }), "el servidor la descarto por duplicada: ya habia llegado");
      red.cuerpo = "ok";
      t.cierto(await c.api.repPost({ evento: "resumen" }), "y el acuse normal");
    });

    // v17.49.0 (D4) — La evidencia ya no sale por beacon al cerrar, asi que el arranque
    // tiene que drenarla de verdad. Antes de esta version la primera oportunidad era el
    // intervalo de 10 minutos (o un evento nuevo que disparara reportar()).
    await t.casoAsync("v17.49.0: al arrancar se vacia la cola por el camino que confirma acuse", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.__S.reporte = true;
      c.api.__S.reporteUrl = "https://script.google.com/macros/s/DEMO/exec";
      c.env.gm["vgl_repq"] = JSON.stringify([{ evento: "fraude", lote: "L1" }, { evento: "resumen", lote: "L2" }]);
      red.cuerpo = "ok";
      await c.api._repVaciadoDeArranque();
      await new Promise((r) => setTimeout(r, 5));
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, 0, "la evidencia de ayer sale ya, no dentro de diez minutos");
      t.igual(red.posts.length, 2, "y sale por GM_xmlhttpRequest, que si lee el acuse del panel");
    });

    await t.casoAsync("v17.49.0: si el panel no confirma, el arranque NO pierde la evidencia", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.__S.reporte = true;
      c.api.__S.reporteUrl = "https://script.google.com/macros/s/DEMO/exec";
      c.env.gm["vgl_repq"] = JSON.stringify([{ evento: "fraude", lote: "L1" }, { evento: "resumen", lote: "L2" }]);
      red.cuerpo = "err";
      await c.api._repVaciadoDeArranque();
      await new Promise((r) => setTimeout(r, 5));
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, 2, "las dos siguen en la cola: recibida no es guardada");
    });

    // v17.51.0 — La prueba de acuse es una LISTA NEGRA: da por buena toda respuesta que no
    // reconozca como mala. Lo correcto seria una lista blanca ("ok"/"dup" y nada mas), pero
    // no se puede verificar desde aqui que contesta el receptor DESPLEGADO —su cabecera dice
    // que es anterior a todo el historial del repositorio— y equivocarse apaga la telemetria
    // entera en silencio. En vez de adivinar, se guarda la respuesta real y se le enseña al
    // medico: con una pulsacion suya de «Probar conexion» la pregunta queda contestada.
    await t.casoAsync("v17.51.0: se guarda LITERALMENTE lo que contesta el panel, sea lo que sea", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      red.cuerpo = "ok";
      await c.api.repPost({ evento: "prueba" });
      t.igual(c.env.almacen["vgl_rep_last_body"], "ok", "la respuesta buena se guarda tal cual");
      red.cuerpo = "Error 502: Bad Gateway del proxy";
      await c.api.repPost({ evento: "prueba" });
      t.igual(c.env.almacen["vgl_rep_last_body"], "Error 502: Bad Gateway del proxy", "y la inesperada tambien, sin interpretarla");
    });

    await t.casoAsync("v17.51.0: el diagnostico enseña esa respuesta y avisa si NO es del panel", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.__S.reporte = true;
      const linea = () => (c.api.repDiagnostico() || []).filter((g) => g.paso === "Lo que contesta el panel")[0];
      t.cierto(!!linea(), "el diagnostico tiene su renglon");
      t.cierto(/todavía no ha contestado/.test(linea().detalle), "sin dato, lo dice en vez de fingir que todo va bien");
      red.cuerpo = "dup";
      await c.api.repPost({ evento: "prueba" });
      t.cierto(linea().ok, "«dup» es una respuesta esperada del panel");
      t.cierto(/respuesta esperada/.test(linea().detalle));
      red.cuerpo = "<algo raro que no es del panel>".replace(/[<>]/g, "");
      await c.api.repPost({ evento: "prueba" });
      t.falso(linea().ok, "una respuesta que el panel nunca da se marca en rojo");
      t.cierto(/NO lo dice el panel/.test(linea().detalle), "y se dice por que, sin acusar al panel de algo que quiza no hizo");
    });

    await t.casoAsync("v17.51.0: la respuesta guardada pasa por el saneador de PHI", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      red.cuerpo = "rechazado para el documento 1234567890";
      await c.api.repPost({ evento: "prueba" });
      const b = String(c.env.almacen["vgl_rep_last_body"] || "");
      t.igual(b.indexOf("1234567890"), -1, "ni siquiera lo que contesta un servidor entra sin sanear");
      t.cierto(b.indexOf("CENSURADO") >= 0, "queda constancia de que habia algo y se tacho");
    });

    await t.casoAsync("repPost: respeta la URL personalizada de S.reporteUrl", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.__S.reporteUrl = "https://mi.servidor/hoja";
      t.cierto(await c.api.repPost({ evento: "x" }));
      t.igual(red.posts[0].url, "https://mi.servidor/hoja");
    });


    await t.casoAsync("v17.15.0 — el «no» del panel NO cuenta como entregado, y deja causa legible", async () => {
      // El defecto que esto fija se corrigió en la v16.4.0 y se quedó SIN PRUEBA: la de
      // arriba cubre 500, login de Google, HTML y caída de red, pero ninguna fija el «no».
      // Es el peor de los cinco porque es el silencioso: el receptor responde 200 con el
      // cuerpo «no» al rechazar el token, y contarlo como entregado producía una hoja vacía
      // con el sello en verde — exactamente los 9 días de mudez que nadie notó en agosto.
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      red.status = 200; red.finalUrl = ""; red.cuerpo = "no";
      t.falso(await c.api.repPost({ a: 9 }), "un «no» del panel no es una entrega");
      let err = null;
      try { err = JSON.parse(c.env.win.localStorage.getItem("vgl_rep_last_err") || "null"); } catch (e) {}
      t.cierto(!!err && /token/i.test(err.detalle || ""),
        "y la causa dice qué revisar, no un «respuesta 200» que no ayuda a nadie");
      // «dup» SÍ es éxito: la fila ya había llegado y el servidor la descartó por duplicada.
      // Sin esta mitad, alguien podría «arreglar» el «no» rechazando cualquier respuesta corta.
      red.cuerpo = "dup";
      t.cierto(await c.api.repPost({ a: 10 }), "«dup» sigue siendo entrega: la fila ya estaba");
    });

    // ---------- repQLoad / repQSave ----------
    t.caso("repQLoad: sin nada guardado arranca vacía; carga lo guardado; corrupto o 'null' no revienta", () => {
      // sin nada en GM
      const c1 = cargar({ silencioso: true });
      c1.api.repQLoad(); c1.api.repQSave();
      t.igual(c1.env.gm["vgl_repq"], "[]");
      // con cola guardada de una sesión anterior
      const c2 = cargar({ silencioso: true });
      c2.env.gm["vgl_repq"] = '[{"evento":"guardado"}]';
      c2.api.repQLoad(); c2.api.repQSave();
      t.igual(JSON.parse(c2.env.gm["vgl_repq"]), [{ evento: "guardado" }]);
      // JSON roto: cola vacía, sin excepción
      const c3 = cargar({ silencioso: true });
      c3.env.gm["vgl_repq"] = "{{{ni de broma";
      t.noLanza(() => { c3.api.repQLoad(); c3.api.repQSave(); });
      t.igual(c3.env.gm["vgl_repq"], "[]");
      // "null" parsea a null y el || [] lo rescata
      const c4 = cargar({ silencioso: true });
      c4.env.gm["vgl_repq"] = "null";
      c4.api.repQLoad(); c4.api.repQSave();
      t.igual(c4.env.gm["vgl_repq"], "[]");
    });

    t.caso("repQLoad v12.5.1: SIEMPRE relee el almacén — una pestaña con cola vieja ya no pisa lo de otra", () => {
      // Contrato invertido a propósito (revisión adversarial v12.5.1): la caché en
      // memoria hacía que la cola vieja de una pestaña sobreescribiera filas recién
      // encoladas por otra al compartir GM. Ahora la verdad vive en el almacén.
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_repq"] = '[{"evento":"primero"}]';
      c.api.repQLoad();
      // otra pestaña actualiza GM por fuera: la relectura la respeta
      c.env.gm["vgl_repq"] = '[{"evento":"primero"},{"evento":"segundo"}]';
      c.api.repQLoad(); c.api.repQSave();
      t.igual(JSON.parse(c.env.gm["vgl_repq"]), [{ evento: "primero" }, { evento: "segundo" }]);
    });

    t.caso("repQSave: recorta la cola al tope de 80 filas (v17.1.0), descartando las MÁS VIEJAS", () => {
      const c = cargar({ silencioso: true });
      const noventacinco = Array.from({ length: 95 }, (_, i) => ({ evento: "e" + i }));
      c.env.gm["vgl_repq"] = JSON.stringify(noventacinco);
      c.api.repQLoad(); c.api.repQSave();
      const guardada = JSON.parse(c.env.gm["vgl_repq"]);
      // v17.1.0 (#148) — el tope subió de 30 a 80 y el recorte por cabeza salta las filas
      // de error (las más viejas se sacrifican solo si no queda otra).
      t.igual(guardada.length, 80, "la cola persistida no pasa de 80 (TOPE_COLA v17.1.0)");
      t.igual(guardada[0].evento, "e15", "se descartan las MÁS VIEJAS");
      t.igual(guardada[79].evento, "e94");
    });

    // ---------- repFlush ----------
    await t.casoAsync("repFlush: entrega en orden y deja la cola vacía cuando el servidor acepta", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.env.gm["vgl_repq"] = JSON.stringify([{ evento: "uno" }, { evento: "dos" }, { evento: "tres" }]);
      await c.api.repFlush();
      t.igual(red.cuerpos().map((p) => p.evento), ["uno", "dos", "tres"], "FIFO: primero en entrar, primero en salir");
      t.igual(c.env.gm["vgl_repq"], "[]");
    });

    await t.casoAsync("repFlush: si el servidor falla se detiene y la cola queda intacta", async () => {
      const red = crearRed();
      red.modo = "error";
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.env.gm["vgl_repq"] = JSON.stringify([{ evento: "uno" }, { evento: "dos" }, { evento: "tres" }]);
      await c.api.repFlush();
      t.igual(red.posts.length, 1, "tras el primer fallo corta la tanda");
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, 3, "no se pierde nada");
    });

    await t.casoAsync("repFlush: tope de 10 envíos por tanda; el resto espera el siguiente intento", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.env.gm["vgl_repq"] = JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ evento: "e" + i })));
      await c.api.repFlush();
      t.igual(red.posts.length, 10);
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, 5, "quedan 5 para la próxima tanda");
      await c.api.repFlush();
      t.igual(red.posts.length, 15, "la segunda tanda termina de vaciar");
      t.igual(c.env.gm["vgl_repq"], "[]");
    });

    await t.casoAsync("repFlush: con el reporte apagado no toca la red ni la cola", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.env.gm["vgl_repq"] = '[{"evento":"uno"}]';
      c.api.__S.reporte = false;
      await c.api.repFlush();
      t.igual(red.posts.length, 0);
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, 1);
    });

    // ---------- reportar ----------
    await t.casoAsync("reportar: arma la fila con token, equipo (máx. 40), versión y día, y la despacha", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.__S.equipo = "E".repeat(50); // se recorta a 40 para que la Hoja no engorde
      c.api.reportar("prueba_banco", { extra1: 7 });
      await tick(); // reportar dispara repFlush sin esperar: dejamos correr los microtasks
      t.igual(red.posts.length, 1);
      const fila = JSON.parse(red.posts[0].data);
      t.igual(fila.token, "vgl-2026", "el token debe coincidir con el del Apps Script");
      t.igual(fila.equipo.length, 40);
      t.igual(fila.evento, "prueba_banco");
      t.igual(fila.extra1, 7, "lo extra viaja fusionado en la misma fila");
      t.cierto(/^\d{4}-\d{2}-\d{2}$/.test(fila.dia), "dia en formato YYYY-MM-DD");
      t.cierto(typeof fila.ver === "string" && fila.ver.length > 0, "lleva la versión del script");
      t.cierto(/^\d{4}-\d{2}-\d{2}T/.test(fila.ts), "ts es un ISO completo");
      t.igual(c.env.gm["vgl_repq"], "[]", "entregada: no queda en cola");
    });

    await t.casoAsync("reportar: sin red la fila queda encolada en GM y el reintento posterior la entrega", async () => {
      const red = crearRed();
      red.modo = "error";
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.reportar("sin_red");
      await tick();
      // v18.3 (P13) — nacer el id de equipo emite «obs.equipo.nuevo» diferido un
      // tick; sin red, ese aviso también queda encolado. Esta prueba mide la
      // supervivencia de la fila «sin_red»: filtrar la cola por su evento.
      const enCola = JSON.parse(c.env.gm["vgl_repq"]).filter((f) => f.evento === "sin_red");
      t.igual(enCola.length, 1, "el fallo no borra la fila");
      // vuelve la red: el reintento (en producción, cada 10 min) la entrega
      red.modo = "ok";
      await c.api.repFlush();
      t.igual(red.cuerpos().filter((p) => p.evento === "sin_red").length >= 1, true);
      t.igual(c.env.gm["vgl_repq"], "[]");
    });

    t.caso("reportar: con el reporte apagado no encola ni envía nada", () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.__S.reporte = false;
      c.api.reportar("fantasma");
      t.igual(red.posts.length, 0);
      t.igual(c.env.gm["vgl_repq"], undefined, "ni siquiera se creó la cola en GM");
    });

    // ---------- repDailySummary ----------
    await t.casoAsync("repDailySummary: envía el resumen de AYER una sola vez (candado por fecha)", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      congelarFecha(c, "2026-03-05T12:00:00");
      c.env.almacen["vgl_stats"] = JSON.stringify({
        "2026-03-04": { fraude: 2, inasistencia: 1, atiempo: 7, ultima: 3 },
      });
      c.api.repDailySummary();
      await tick();
      // v18.3 (P13) — el arranque de un navegador limpio emite además
      // «obs.equipo.nuevo» (diferido un tick) al nacer el id de equipo. Esta
      // prueba mide el canal «resumen»: contar SOLO sus POST.
      t.igual(red.cuerpos().filter((p) => p.evento === "resumen").length, 1);
      const fila = red.cuerpos().find((p) => p.evento === "resumen");
      t.igual(fila.evento, "resumen");
      t.igual(fila.deDia, "2026-03-04", "el resumen es del día ANTERIOR");
      t.igual(fila.fraude, 2);
      t.igual(fila.inasistencia, 1);
      t.igual(fila.atiempo, 7);
      t.igual(fila.ultima, 3);
      t.igual(c.env.almacen["vgl_rep_sum"], "2026-03-04", "candado puesto");
      // segunda llamada el mismo día: el candado la corta
      c.api.repDailySummary();
      await tick();
      t.igual(red.cuerpos().filter((p) => p.evento === "resumen").length, 1, "no se repite la fila");
    });

    await t.casoAsync("repDailySummary: sin actividad ayer no manda fila NI candado; con stats sí", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      congelarFecha(c, "2026-03-05T12:00:00");
      c.api.repDailySummary(); // no hay vgl_stats de ayer
      await tick();
      t.igual(red.posts.length, 0, "sin actividad ese día: ni fila");
      t.igual(c.env.almacen["vgl_rep_sum"], undefined, "ni candado: se reintenta en el próximo arranque");
      // las stats aparecen después (actividad tardía del día): la fila sale igual
      c.env.almacen["vgl_stats"] = JSON.stringify({
        "2026-03-04": { fraude: 1, inasistencia: 2, atiempo: 3, ultima: 99 },
      });
      c.api.repDailySummary();
      await tick();
      // v18.3 (P13) — nacer el id emite «obs.equipo.nuevo» diferido: contar SOLO
      // los POST de «resumen» que esta prueba mide.
      t.igual(red.cuerpos().filter((p) => p.evento === "resumen").length, 1, "ahora sí sale el resumen de ayer");
      const fila = red.cuerpos().find((p) => p.evento === "resumen");
      t.igual(fila.evento, "resumen");
      t.igual(fila.deDia, "2026-03-04");
      t.igual(c.env.almacen["vgl_rep_sum"], "2026-03-04", "candado puesto solo cuando hubo fila");
      // tercera llamada: el candado la corta
      c.api.repDailySummary();
      await tick();
      t.igual(red.cuerpos().filter((p) => p.evento === "resumen").length, 1, "no se repite la fila");
    });

    // ---------- reportarFraude ----------
    await t.casoAsync("reportarFraude: manda hora y minutos redondeados a 1 decimal, SIN datos del paciente", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      c.api.reportarFraude("07:10 AM", 12.34);
      await tick();
      // v18.3 (P13) — nacer el id emite «obs.equipo.nuevo» diferido: contar SOLO
      // los POST de «fraude» que esta prueba mide.
      t.igual(red.cuerpos().filter((p) => p.evento === "fraude").length, 1);
      const fila = red.cuerpos().find((p) => p.evento === "fraude");
      t.igual(fila.evento, "fraude");
      t.igual(fila.hora, "07:10 AM");
      t.igual(fila.min, 12.3, "redondeo a un decimal");
      t.falso("doc" in fila, "sin cédula");
      t.falso("nombre" in fila, "sin nombre");
      // sin datos: hora vacía y 0 minutos, nada de NaN
      c.api.reportarFraude(null, null);
      await tick();
      const fila2 = red.cuerpos().filter((p) => p.evento === "fraude").pop();
      t.igual(fila2.hora, "");
      t.igual(fila2.min, 0);
    });

    t.caso("reportarFraude: tope de 20 filas por día", () => {
      const red = crearRed();
      red.modo = "error"; // sin red: todo queda en cola y se puede contar
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      for (let i = 0; i < 25; i++) c.api.reportarFraude("08:00 AM", i);
      const cola = JSON.parse(c.env.gm["vgl_repq"]);
      t.igual(cola.length, 20, "de 25 intentos solo entran 20");
      t.cierto(cola.every((f) => f.evento === "fraude"));
    });

    t.caso("reportarFraude: el contador se reinicia al cambiar el día", () => {
      const red = crearRed();
      red.modo = "error";
      const c = cargar({ silencioso: true, gmxhr: red.gmxhr });
      const caja = congelarFecha(c, "2026-03-05T09:00:00");
      for (let i = 0; i < 21; i++) c.api.reportarFraude("08:00 AM", i);
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, 20, "día 1: tope alcanzado");
      caja.iso = "2026-03-06T09:00:00"; // amanece
      c.api.reportarFraude("07:30 AM", 4);
      c.api.reportarFraude("07:45 AM", 6);
      const cola = JSON.parse(c.env.gm["vgl_repq"]);
      t.igual(cola.length, 22, "el día nuevo abre otro cupo de 20");
      t.igual(cola[20].dia, "2026-03-06", "las nuevas filas llevan la fecha nueva");
    });
  },
};
