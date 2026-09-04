// =====================================================================
//  SUITE 13 — Lectura directa del API de agenda
//  Cubre el camino v7.0 (aprender la URL de ObtenerConsultas, leerla,
//  entender los campos, la cadencia adaptativa) y las interfaces con
//  APIAcceso / AppCita / Digiturno que hablan con el servidor real.
// =====================================================================
module.exports = {
  nombre: "Lectura directa del API de agenda",
  cubre: [
    "apiRecordar", "apiSniffPerf", "apiObservar", "apiLista", "apiCampos",
    "apiParse", "leerConTope", "apiLeerAgenda", "apiCadencia", "tickApi",
    "apiUtil", "apiSano", "apiEspera",
    "apiAccesoBuscarCitasDisponibles", "apiLaboratorioAgendarAuto", "normalizeHora",
    "apiDigiturnoFinalizarTicket", "apiAccesoObtenerLaboratoriosAnnar",
    "apiAccesoObtenerLaboratoriosCiti", "apiAccesoAgdValidarAgenda",
    "apiAccesoObtenerTurnos", "apiHcObtenerOrdenamientosVigentes", "actualizarRelojCabecera"
  ],

  async pruebas(t, api, env, cargar) {
    // v18.1.0 — B4 (Misión B, capa c): apiLaboratorioAgendarAuto ESCRIBE en
    // AppCita (AgendarCita → agendar_labs) y la capa c re-comprueba el perfil
    // justo antes de salir a la red; un contexto sin padrón resuelve a PÚBLICO
    // y la cita no se crea. Estas pruebas agendan «como el dueño del perfil»:
    // se siembra en TODOS los contextos la lista `vgl_acceso_lista` (uid 707 en
    // COMPLETO, como la dejaría el fetch de B2) y una identidad por defecto; un
    // caso que fije SU doctor después de cargar sigue mandando.
    const _cargarAccesoBase = cargar;
    cargar = (opciones) => {
      const opts = Object.assign({}, opciones || {});
      if (!opts.almacen) opts.almacen = {};
      if (!("vgl_acceso_lista" in opts.almacen)) {
        opts.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-13.acceso-b4",
          perfiles: {
            COMPLETO: [{ uid: 707, nombre: "Brandon Jesús Palencia Martínez" }],
            LABORATORIOS: [],
          },
          blocklist: [],
        });
      }
      const c = _cargarAccesoBase(opts);
      if (c && c.api && c.api.__state && !c.api.__state.activeDoctor.id) {
        c.api.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      }
      return c;
    };
    const URL_AGENDA = "/apiviva/APIMedicoHealth/api/Medico/ObtenerConsultas?especialidadId=1&profesionalId=2";
    const ABS_AGENDA = "https://neps.everestintelligent.com" + URL_AGENDA;

    // Filas con la pinta real de la respuesta de Everest (hora + estado + doc + nombre)
    const FILAS = [
      { horaCita: "07:00", estado: "EN SALA", numeroDocumento: "12345678", nombrePaciente: "JUAN", apellidoPaciente: "PEREZ" },
      { horaCita: "07:20", estado: "SIN PRESENTAR", numeroDocumento: "87654321", nombrePaciente: "MARIA", apellidoPaciente: "GOMEZ" },
    ];

    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    async function rechazo(p) { try { await p; return null; } catch (e) { return e; } }

    // Entorno con fetch intercambiable + registro de llamadas (fetch y GM_xmlhttpRequest)
    function entornoApi() {
      const reg = { fetches: [], gm: [] };
      let responderFetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "" });
      let responderGm = null;
      const c = cargar({
        silencioso: true,
        fetch: (url, opt) => { reg.fetches.push({ url, opt }); return responderFetch(url, opt); },
        gmxhr: (o) => { reg.gm.push(o); if (responderGm) responderGm(o); },
      });
      return {
        c, reg,
        setFetch: (f) => { responderFetch = f; },
        setGm: (f) => { responderGm = f; },
      };
    }
    const respuestaJson = (obj) => async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => obj, text: async () => JSON.stringify(obj) });
    const respuestaError = (status) => async () => ({ ok: false, status, headers: { get: () => null }, json: async () => null, text: async () => "" });
    // ¿Algún nodo del DOM falso contiene este texto? (así se verifica el toast de PyM)
    const hayTexto = (c, frag) => c.env.doc._nodos.some((n) => typeof n.textContent === "string" && n.textContent.includes(frag));

    // ---------- apiRecordar ----------
    // v17.6.14 — H4: la URL aprendida se persiste OFUSCADA en localStorage (antes en
    // claro). Estas pruebas comparan contra la URL recuperada (desofuscada).
    const urlPersistida = (c) => c.api._vglDesofusca(c.env.almacen["vgl_api_url"]);
    t.caso("apiRecordar: ignora URLs que no son la llamada de la agenda", () => {
      const c = cargar({ silencioso: true });
      c.api.apiRecordar("/apiviva/otro/Endpoint?x=1");
      c.api.apiRecordar("");
      t.igual(c.env.almacen["vgl_api_url"], undefined, "no debe persistir nada");
      t.falso(c.api.apiUtil(), "sin URL aprendida el API no es utilizable");
    });

    t.caso("apiRecordar: aprende la URL relativa, la vuelve absoluta y la persiste", () => {
      const c = cargar({ silencioso: true });
      c.api.apiRecordar(URL_AGENDA);
      t.igual(urlPersistida(c), ABS_AGENDA);
      t.cierto(c.api.apiUtil(), "con URL aprendida el API ya es utilizable");
    });

    t.caso("apiRecordar: una URL absoluta se guarda tal cual", () => {
      const c = cargar({ silencioso: true });
      const abs = "https://neps.everestintelligent.com/apiviva/X/ObtenerConsultas?a=9";
      c.api.apiRecordar(abs);
      t.igual(urlPersistida(c), abs);
    });

    // ---------- apiSniffPerf ----------
    t.caso("apiSniffPerf: rescata del registro de rendimiento la llamada MÁS RECIENTE", () => {
      const c = cargar({ silencioso: true });
      const winFalso = {
        performance: {
          getEntriesByType: (tipo) => tipo === "resource" ? [
            { name: ABS_AGENDA + "&vieja=1" },
            { name: "https://neps.everestintelligent.com/apiviva/otra/cosa" },
            { name: ABS_AGENDA + "&nueva=2" },
          ] : [],
        },
      };
      c.api.apiSniffPerf(winFalso);
      t.igual(urlPersistida(c), ABS_AGENDA + "&nueva=2", "recorre desde el final: gana la última");
    });

    t.caso("apiSniffPerf: sin registro o sin coincidencias no aprende nada ni lanza", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.apiSniffPerf({}));
      t.noLanza(() => c.api.apiSniffPerf({ performance: { getEntriesByType: () => [{ name: "https://x/y" }] } }));
      t.igual(c.env.almacen["vgl_api_url"], undefined);
    });

    // ---------- apiObservar ----------
    t.caso("apiObservar: instala el observador (resource + buffered) y aprende al llegar la entrada", () => {
      const c = cargar({ silencioso: true });
      let cb = null, construcciones = 0;
      const observados = [];
      const winFalso = {
        PerformanceObserver: class {
          constructor(f) { construcciones++; cb = f; }
          observe(o) { observados.push(o); }
        },
      };
      c.api.apiObservar(winFalso);
      t.igual(construcciones, 1);
      t.igual(observados, [{ type: "resource", buffered: true }]);
      t.cierto(!!winFalso.__vglPO, "deja la marca para no duplicarse");
      // La aplicación hace la llamada: el observador la ve y la aprende
      cb({ getEntries: () => [{ name: ABS_AGENDA }] });
      t.igual(urlPersistida(c), ABS_AGENDA);
      // Segunda instalación: no crea otro observador
      c.api.apiObservar(winFalso);
      t.igual(construcciones, 1, "con __vglPO presente no vuelve a instalarse");
    });

    t.caso("apiObservar: un navegador sin PerformanceObserver no rompe nada", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.apiObservar({}));
    });

    // ---------- apiLista ----------
    t.caso("apiLista: desenvuelve el arreglo venga como venga", () => {
      const arr = [{ a: 1 }];
      t.igual(api.apiLista(arr), arr, "un arreglo directo se devuelve igual");
      t.igual(api.apiLista({ data: arr }), arr);
      t.igual(api.apiLista({ Consultas: arr }), arr);
      t.igual(api.apiLista({ x: [] }), [], "un arreglo vacío es dato válido");
    });

    t.caso("apiLista: rechaza lo que no contiene un arreglo de objetos", () => {
      t.igual(api.apiLista(null), null);
      t.igual(api.apiLista(42), null);
      t.igual(api.apiLista("texto"), null);
      t.igual(api.apiLista({ x: ["a", "b"] }), null, "un arreglo de strings no es una agenda");
    });

    // ---------- apiCampos ----------
    t.caso("apiCampos: detecta hora, estado, documento y nombres mirando los VALORES", () => {
      const campos = api.apiCampos(FILAS);
      t.igual(campos, { hora: "horaCita", estado: "estado", doc: "numeroDocumento", nombres: ["nombrePaciente", "apellidoPaciente"] });
    });

    // v13.0.0 — citaId (para el botón "Atender") se detecta por COINCIDENCIA EXACTA del
    // nombre del campo, tal como aparece de verdad en /ObtenerConsultas (captura real de
    // consultorio) — no por heurística, para no adivinar cuál columna es cuál id.
    t.caso("apiCampos: detecta citaId por coincidencia EXACTA del nombre del campo", () => {
      const filas = [{ horaCita: "07:00", estado: "EN SALA", citaId: 4334823 }, { horaCita: "07:20", estado: "ATENDIDO", citaId: 4334837 }];
      t.igual(api.apiCampos(filas).citaIdKey, "citaId");
      t.igual(api.apiCampos(FILAS).citaIdKey, undefined, "sin ese campo real, no hay a qué apuntar");
    });

    t.caso("apiParse: cuando la fila trae citaId, lo propaga como número al objeto de la cita", () => {
      const c2 = cargar({ silencioso: true });
      const filas = [{ horaCita: "07:00", estado: "EN SALA", numeroDocumento: "1", nombrePaciente: "A", citaId: 4334823 }];
      const citas = c2.api.apiParse(filas);
      t.igual(citas[0].citaId, 4334823);
    });

    // v17.48.0 (D2) — La cédula que sale del API indexa TODA la memoria local. Si Everest
    // la entrega rellenada de ceros, el mismo paciente quedaría archivado bajo dos claves
    // y el script parecería "olvidar" lo aprendido entre controles.
    t.caso("v17.48.0 — apiParse entrega la cédula canónica, sin los ceros de relleno", () => {
      const c2 = cargar({ silencioso: true });
      const filas = [
        { horaCita: "07:00", estado: "EN SALA", numeroDocumento: "0005150076", nombrePaciente: "A" },
        { horaCita: "07:20", estado: "PENDIENTE", numeroDocumento: "8396613", nombrePaciente: "B" },
      ];
      const citas = c2.api.apiParse(filas);
      t.igual(citas[0].doc_id, "5150076", "una sola clave por paciente, venga como venga");
      t.igual(citas[1].doc_id, "8396613", "y la que ya venía limpia no se toca");
    });

    t.caso("apiCampos: penaliza las columnas de hora de FIN aunque también parezcan horas", () => {
      const filas = [
        { horaCita: "07:00", horaFinal: "07:20", estado: "ATENDIDO" },
        { horaCita: "07:20", horaFinal: "07:40", estado: "PENDIENTE" },
      ];
      const campos = api.apiCampos(filas);
      t.igual(campos.hora, "horaCita", "horaFinal parece hora pero no es la de la cita");
    });

    t.caso("apiCampos: excluye al médico y a la especialidad de los campos de nombre", () => {
      const filas = [
        { horaCita: "07:00", estado: "ATENDIDO", nombrePaciente: "JUAN", nombreMedico: "DR HOUSE", especialidadNombre: "MEDICINA INTERNA" },
        { horaCita: "07:20", estado: "PENDIENTE", nombrePaciente: "MARIA", nombreMedico: "DR HOUSE", especialidadNombre: "MEDICINA INTERNA" },
      ];
      const campos = api.apiCampos(filas);
      t.igual(campos.nombres, ["nombrePaciente"], "ni nombreMedico ni especialidadNombre son el paciente");
    });

    t.caso("apiCampos: sin hora o sin estados reconocibles devuelve null", () => {
      t.igual(api.apiCampos([]), null, "sin filas objeto");
      t.igual(api.apiCampos([{ horaCita: "07:00", estado: "ZZZ" }, { horaCita: "07:20", estado: "ZZZ" }]), null, "estados fuera del vocabulario");
      t.igual(api.apiCampos([{ estado: "EN SALA" }, { estado: "ATENDIDO" }]), null, "sin ninguna columna de hora");
    });

    // ---------- apiParse (con instancia propia: cachea API.campos) ----------
    const cParse = cargar({ silencioso: true });

    t.caso("apiParse: entradas triviales — no-arreglo es fallo, arreglo vacío es agenda vacía", () => {
      t.igual(cParse.api.apiParse(null), null);
      t.igual(cParse.api.apiParse({ data: [] }), null, "un objeto no es la lista");
      t.igual(cParse.api.apiParse([]), []);
    });

    t.caso("apiParse: convierte las filas crudas en citas normalizadas", () => {
      const citas = cParse.api.apiParse(FILAS);
      t.cierto(Array.isArray(citas));
      t.igual(citas.length, 2);
      t.igual(citas[0].hora_texto, "7:00 a. m.");
      t.igual(citas[0].doc_id, "12345678");
      t.igual(citas[0].nombre, "JUAN PEREZ");
      t.igual(citas[0].estado, "EN SALA");
      t.igual(citas[0].index, 0);
      t.igual(citas[1].estado, "SIN PRESENTAR");
      t.igual(citas[0].citaId, undefined, "FILAS no trae citaId real: casilla vacía, nunca un id inventado");
    });

    t.caso("apiParse: GUARDA — si los estados dejan de reconocerse, no se usa el API", () => {
      // Los campos ya quedaron cacheados por el caso anterior; ahora Everest "cambia" sus estados.
      const raras = FILAS.map((f) => Object.assign({}, f, { estado: "XKQZ" }));
      t.igual(cParse.api.apiParse(raras), null);
    });

    t.caso("apiParse: GUARDA — si la mayoría de horas son ilegibles, no se usa el API", () => {
      const rotas = FILAS.map((f) => Object.assign({}, f, { horaCita: "sin hora" }));
      t.igual(cParse.api.apiParse(rotas), null);
    });

    // ---------- leerConTope ----------
    const cTope = cargar({ silencioso: true });
    cTope.ctx.TextDecoder = TextDecoder;   // el vm no trae TextDecoder de serie; se inyecta el de Node

    await t.casoAsync("leerConTope: content-length dentro del tope -> se lee con text() directamente", async () => {
      const r = { headers: { get: () => "5" }, text: async () => "hola!", body: { getReader: () => { throw new Error("no debía usar el reader"); } } };
      t.igual(await cTope.api.leerConTope(r, 1000), "hola!");
    });

    await t.casoAsync("leerConTope: content-length por encima del tope -> rechaza y cancela el cuerpo", async () => {
      let cancelado = false;
      const r = { headers: { get: () => String(9 * 1048576) }, body: { cancel: () => { cancelado = true; } }, text: async () => "no debía" };
      const e = await rechazo(cTope.api.leerConTope(r, 8 * 1048576));
      t.cierto(!!e, "debía rechazar");
      t.cierto(/demasiado grande/.test(e.message));
      t.cierto(cancelado, "debe cancelar el cuerpo para no descargarlo");
    });

    await t.casoAsync("leerConTope: sin content-length y sin reader -> cae a text()", async () => {
      const r = { headers: { get: () => null }, text: async () => '{"ok":1}' };
      t.igual(await cTope.api.leerConTope(r, 1000), '{"ok":1}');
    });

    await t.casoAsync("leerConTope: respuesta troceada -> junta los trozos y decodifica UTF-8", async () => {
      const enc = new TextEncoder();
      const trozos = [enc.encode('{"citas":'), enc.encode('[1,2]}')];
      let i = 0, liberado = false;
      const r = {
        headers: { get: () => null },
        body: { getReader: () => ({
          read: async () => (i < trozos.length ? { done: false, value: trozos[i++] } : { done: true, value: undefined }),
          cancel: () => {}, releaseLock: () => { liberado = true; },
        }) },
      };
      t.igual(await cTope.api.leerConTope(r, 1000), '{"citas":[1,2]}');
      t.cierto(liberado, "debe soltar el lock del reader");
    });

    await t.casoAsync("leerConTope: respuesta troceada que excede el tope -> cancela el reader y rechaza", async () => {
      const enc = new TextEncoder();
      let cancelado = false, entregados = 0;
      const r = {
        headers: { get: () => null },
        body: { getReader: () => ({
          read: async () => { entregados++; return { done: false, value: enc.encode("x".repeat(64)) }; },
          cancel: () => { cancelado = true; }, releaseLock: () => {},
        }) },
      };
      const e = await rechazo(cTope.api.leerConTope(r, 100));
      t.cierto(!!e && /demasiado grande/.test(e.message));
      t.cierto(cancelado);
      t.igual(entregados, 2, "debe cortar en cuanto se pasa, no seguir leyendo");
    });

    // ---------- apiLeerAgenda ----------
    await t.casoAsync("apiLeerAgenda: sin URL aprendida no consulta nada", async () => {
      const e = entornoApi();
      t.igual(await e.c.api.apiLeerAgenda(), null);
      t.igual(e.reg.fetches.length, 0);
    });

    await t.casoAsync("apiLeerAgenda: éxito — repite la llamada de Everest con las cookies de sesión", async () => {
      const e = entornoApi();
      e.c.api.apiRecordar(URL_AGENDA);
      e.setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(FILAS) }));
      const citas = await e.c.api.apiLeerAgenda();
      t.igual(citas.length, 2);
      t.igual(citas[0].nombre, "JUAN PEREZ");
      t.igual(e.reg.fetches.length, 1);
      t.igual(e.reg.fetches[0].url, ABS_AGENDA);
      t.igual(e.reg.fetches[0].opt.credentials, "include", "va autenticada solo con cookies");
      t.igual(e.reg.fetches[0].opt.cache, "no-store");
      t.cierto(e.c.api.apiSano(), "con un éxito y cero fallos ya se puede confiar");
    });

    await t.casoAsync("apiLeerAgenda: cuerpo vacío es agenda vacía (no un fallo) y resetea los fallos", async () => {
      const e = entornoApi();
      e.c.api.apiRecordar(URL_AGENDA);
      e.setFetch(respuestaError(500));
      t.igual(await e.c.api.apiLeerAgenda(), null, "HTTP 500 cuenta como fallo");
      t.igual(e.c.api.apiEspera(0), 10000, "1 fallo -> espera de 10 s");
      e.setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => "" }));
      t.igual(await e.c.api.apiLeerAgenda(), []);
      t.igual(e.c.api.apiEspera(0), 4000, "el cuerpo vacío limpió el contador de fallos");
    });

    await t.casoAsync("apiLeerAgenda: una respuesta ininteligible (JSON sin lista de citas) devuelve null", async () => {
      const e = entornoApi();
      e.c.api.apiRecordar(URL_AGENDA);
      e.setFetch(respuestaJson({ foo: "bar" }));
      t.igual(await e.c.api.apiLeerAgenda(), null);
    });

    // ---------- apiUtil / apiSano / apiEspera (ciclo de vida completo) ----------
    t.caso("apiUtil/apiSano/apiEspera: estado inicial — sin URL, sin confianza, ritmo base con suelo de 4 s", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api.apiUtil());
      t.falso(c.api.apiSano());
      t.igual(c.api.apiEspera(1000), 4000, "nunca más rápido que 4 s");
      t.igual(c.api.apiEspera(60000), 60000, "la base manda cuando es mayor");
    });

    // v17.6.16 — REDISEÑÓ este ciclo otra vez: el purgado a los 3 fallos de v12.3.7 exigía
    // que el médico volviera a Citas del día para que Everest "reenseñara" la URL — que es
    // justo lo que el reporte de campo pide evitar. Ahora los fallos NUNCA purgan por sí
    // solos: la URL aprendida sobrevive a una racha larga de fallos (p. ej. sesión de
    // Athenea caída, que el propio script revive sola) y sigue reintentándose, cada vez
    // más espaciado, hasta el tope de apiUtil()/apiEspera() (>=5 fallos → 5 min de
    // descanso, contra la MISMA url — ya no es código vestigial).
    await t.casoAsync("apiEspera/apiUtil: una racha larga de fallos NO purga la URL — solo se enfría (v17.6.16)", async () => {
      const e = entornoApi();
      e.c.api.apiRecordar(URL_AGENDA);
      e.setFetch(respuestaError(500));
      // Fallo 1: la espera crece contenida, sin frenado eterno
      await e.c.api.apiLeerAgenda();
      t.igual(e.c.api.apiEspera(0), 10000, "1 fallo -> 10 s");
      t.cierto(e.c.api.apiUtil(), "con 1 fallo todavía se intenta");
      // Fallo 2
      await e.c.api.apiLeerAgenda();
      t.igual(e.c.api.apiEspera(0), 15000, "2 fallos -> 15 s");
      t.cierto(e.c.api.apiUtil(), "con 2 fallos todavía se intenta");
      // Fallo 3: ya NO purga — antes (v12.3.7) aquí se olvidaba la URL entera
      await e.c.api.apiLeerAgenda();
      t.cierto(e.c.api.apiUtil(), "3 fallos: la URL SIGUE aprendida, no hizo falta volver a Citas del día");
      t.falso(e.c.api.apiSano(), "todavía no hay éxito reciente");
      // Fallos 4 y 5: entra al enfriamiento largo de apiUtil(), pero la URL sigue viva
      await e.c.api.apiLeerAgenda();
      await e.c.api.apiLeerAgenda();
      // v18.0.9 — el descanso baja de 5 min a 1. Encargo del médico (31-ago): «hay que
      // blindar que el Centinela siempre tenga acceso a la API de citas del día». Con 5 min,
      // y sin respaldo posible dentro de una historia clínica (el raspado del DOM solo vive
      // en «Citas del día»), cada reintento costaba hasta cinco minutos de ceguera. Lo que
      // esta prueba protege NO es el número: es que la URL sobreviva a la racha y se siga
      // reintentando contra la MISMA url, que es lo que evitó v17.6.16.
      t.igual(e.c.api.apiEspera(0), 60000, "5 fallos: descanso de 1 min, contra la MISMA url");
      t.cierto(e.c.api.apiUtil(), "aún con 5 fallos, apiUtil() deja reintentar tras el enfriamiento (no purgó)");
      // Y si el servidor responde bien esta vez (p. ej. la sesión de Athenea se restauró
      // sola), vuelve la confianza SIN que nadie haya vuelto a Citas del día
      e.setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(FILAS) }));
      const citas = await e.c.api.apiLeerAgenda();
      t.igual(citas.length, 2);
      t.cierto(e.c.api.apiSano());
      t.igual(e.c.api.apiEspera(0), 4000, "fallos a cero tras el éxito");
    });

    // v12.3.8 REDISEÑÓ los umbrales de esta función (el propio código lo documenta): pasó de
    // un esquema ±2.5/±10 SIMÉTRICO alrededor del cruce a uno ASIMÉTRICO — el riesgo real
    // (que alguien tape una llegada tardía pasando a "En Sala"/"Atendido") ocurre DESPUÉS
    // del cruce, no antes, así que la cadencia se endurece más tras cruzar la tolerancia que
    // antes de cruzarla. Cada valor de este test se verificó llamando apiCadencia() de
    // verdad, no calculado a mano.
    t.caso("apiCadencia: ritmo adaptativo y ASIMÉTRICO según lo cerca que esté una cita de la tolerancia", () => {
      const c = cargar({ silencioso: true });
      const TOL = c.api.__CONFIG.TOLERANCIA_MIN;
      const st = c.api.__state;
      st.lastSnapshot = null;
      t.igual(c.api.apiCadencia(), 30000, "sin agenda: reposo de 30 s (v14.2.11)");
      st.lastSnapshot = { list: [{ estado: "Atendido", elapsed: 0 }, { estado: "En Sala", elapsed: 99 }] };
      t.igual(c.api.apiCadencia(), 30000, "todas resueltas: nada que vigilar de cerca");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL }] };
      t.igual(c.api.apiCadencia(), 5000, "en el cruce exacto (ventana crítica): 5 s");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL - 8 }] };
      t.igual(c.api.apiCadencia(), 10000, "8 min ANTES del cruce: 10 s (bisagra de aproximación)");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL + 8 }] };
      t.igual(c.api.apiCadencia(), 8000, "8 min DESPUÉS del cruce: 8 s — MÁS agresivo que antes, por diseño (asimetría v12.3.8)");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL - 30 }] };
      t.igual(c.api.apiCadencia(), 20000, "lejos de la tolerancia, antes del cruce: 20 s");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL + 60 }] };
      t.igual(c.api.apiCadencia(), 10000, "muy pasada (60 min tras el cruce, aún dentro de la ventana de abandono de 60 min): 10 s");
    });

    // v17.21.0 — decisión del médico: el "Refresco" ya no es un control manual, pero
    // el reloj de cabecera debe decir qué cadencia real está usando apiCadencia() en
    // cada momento — sin eso, "automático" es indistinguible de "no sé qué está haciendo".
    t.caso("actualizarRelojCabecera: el tooltip dice la cadencia de sondeo real, no un número fijo", () => {
      const c = cargar({ silencioso: true });
      const clock = c.env.doc.createElement("span");
      clock.id = "vgl-clock";
      c.env.doc.body.appendChild(clock);
      const TOL = c.api.__CONFIG.TOLERANCIA_MIN;

      c.api.__state.lastSnapshot = null;
      c.api.actualizarRelojCabecera();
      t.cierto(clock.title.indexOf("cada 30 s") >= 0, "sin nada pendiente: reposo de 30 s, tal como devuelve apiCadencia()");

      c.api.__state.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL }] };
      c.api.actualizarRelojCabecera();
      t.cierto(clock.title.indexOf("cada 5 s") >= 0, "en la ventana crítica, el tooltip refleja los 5 s reales — no el mismo texto de antes");
    });

    // ---------- tickApi ----------
    await t.casoAsync("tickApi: sin URL aprendida no dispara ninguna consulta", async () => {
      const e = entornoApi();
      e.c.api.tickApi();
      await espera(20);
      t.igual(e.reg.fetches.length, 0);
    });

    await t.casoAsync("tickApi: consulta, publica en state.apiCitas y respeta la cadencia", async () => {
      const e = entornoApi();
      e.c.api.apiRecordar(URL_AGENDA);
      e.setFetch(async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(FILAS) }));
      e.c.api.tickApi();
      await espera(30);
      t.igual(e.reg.fetches.length, 1);
      t.cierto(Array.isArray(e.c.api.__state.apiCitas));
      t.igual(e.c.api.__state.apiCitas.length, 2);
      t.cierto(e.c.api.__state.apiEn > 0);
      // Segundo tick inmediato: la cadencia (60 s sin pendientes) lo frena
      e.c.api.tickApi();
      await espera(30);
      t.igual(e.reg.fetches.length, 1, "no debe consultar otra vez tan pronto");
    });

    await t.casoAsync("tickApi: KR-02 — si cambió la época de sesión, el resultado en vuelo se descarta", async () => {
      const e = entornoApi();
      e.c.api.apiRecordar(URL_AGENDA);
      let liberar = null;
      e.setFetch(() => new Promise((res) => {
        liberar = () => res({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(FILAS) });
      }));
      e.c.api.__state.sessionEpoch = 111;
      e.c.api.tickApi();
      await espera(10);
      t.cierto(!!liberar, "la consulta debía estar en vuelo");
      e.c.api.__state.sessionEpoch = 222;   // diaNuevo() en medio de la consulta
      liberar();
      await espera(30);
      t.igual(e.c.api.__state.apiCitas, null, "los datos de ayer no se publican");
    });

    // ---------- apiAccesoBuscarCitasDisponibles ----------
    await t.casoAsync("apiAccesoBuscarCitasDisponibles: con agendas en la sede 12 no toca la segunda ruta", async () => {
      const e = entornoApi();
      const res = { data: { dtCitasDisponibles: [{ id: 1 }] } };
      e.setFetch((url) => respuestaJson(res)());
      const r = await e.c.api.apiAccesoBuscarCitasDisponibles(77, "2026-08-14");
      t.igual(r, res);
      t.igual(e.reg.fetches.length, 1);
      const u = e.reg.fetches[0];
      t.cierto(u.url.includes("/APIAcceso/api/Acceso/BuscarCitasDisponibles"));
      t.cierto(u.url.includes("PacienteId=77"));
      t.cierto(u.url.includes("EspecialidadId=12"), "sin especialidad explícita usa la 12");
      t.cierto(u.url.includes("FechaDeseada=2026-08-14"));
      t.cierto(u.url.includes("PuntoAtencionId=12"));
      t.igual(u.opt.method, "POST");
    });

    await t.casoAsync("apiAccesoBuscarCitasDisponibles: si la sede 12 viene vacía, cae a PuntoAtencionId=0 y respeta la especialidad pedida", async () => {
      const e = entornoApi();
      const res2 = { agendas: [{ id: 9 }] };
      e.setFetch((url) => url.includes("PuntoAtencionId=12")
        ? respuestaJson({ data: { dtCitasDisponibles: [] } })()
        : respuestaJson(res2)());
      const r = await e.c.api.apiAccesoBuscarCitasDisponibles(77, "2026-08-15", 5);
      t.igual(r, res2);
      t.igual(e.reg.fetches.length, 2);
      t.cierto(e.reg.fetches[0].url.includes("EspecialidadId=5"));
      t.cierto(e.reg.fetches[1].url.includes("PuntoAtencionId=0"));
    });

    await t.casoAsync("apiAccesoBuscarCitasDisponibles: si nada responde, devuelve la marca de no-respuesta sin lanzar (v16.7.0)", async () => {
      const e = entornoApi();
      e.setFetch(respuestaError(404));
      // v16.7.0 — auditoría #11: «no hay cupos» y «no se pudo preguntar» son cosas
      // distintas; la no-respuesta queda MARCADA (__sinRespuesta) para que el modal no
      // anuncie un hecho que nadie comprobó. extractAgendasList sigue dando [] con la marca.
      const r = await e.c.api.apiAccesoBuscarCitasDisponibles(77, "2026-08-16");
      t.igual(r && r.__sinRespuesta, true, "la respuesta viene marcada como sin-respuesta");
      t.igual(e.reg.fetches.length, 2, "un 4xx no se reintenta: una llamada por ruta");
    });

    // ---------- apiLaboratorioAgendarAuto ----------
    const TURNOS_LAB = { turnos: [{ hora: "07:00", agendaId: 555 }, { hora: "08:00", agendaId: 556 }] };

    await t.casoAsync("apiLaboratorioAgendarAuto: sin el horario elegido NO agenda en silencio (Incidente v11.0.1)", async () => {
      const e = entornoApi();
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(TURNOS_LAB) });
        else o.onload({ status: 200, responseText: "{}" });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "09:00");
      t.falso(ok);
      t.igual(e.reg.gm.length, 1, "solo consultó los turnos: jamás llamó a AgendarCita");
      t.cierto(hayTexto(e.c, "NO se agendó"), "avisa al médico para que lo haga a mano");
    });

    await t.casoAsync("apiLaboratorioAgendarAuto: agenda el turno EXACTO elegido y solo canta éxito si el servidor acepta (respuesta real: error:false + radicado, plano)", async () => {
      const e = entornoApi();
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(TURNOS_LAB) });
        else if (o.url.includes("AgendarCita")) o.onload({ status: 200, responseText: '{"error":false,"radicado":13525848}' });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "07:00");
      t.cierto(ok);
      t.igual(e.reg.gm.length, 2, "sin celular no se llama al SMS: se queda en las 2 llamadas de siempre");
      const urlBook = e.reg.gm[1].url;
      t.cierto(urlBook.indexOf("https://appcita.viva1a.com.co:8051/") === 0, "va por GM al dominio de AppCita");
      t.cierto(urlBook.includes("AgendaId=555"), "usa el agendaId del turno real, no uno cableado");
      t.cierto(urlBook.includes("Hora=07%3A00"));
      t.cierto(urlBook.includes("Identificacion=123456"));
      t.cierto(urlBook.includes("FechaCita=2026-08-14"));
      t.cierto(urlBook.includes("Telefono=0"), "sin teléfono cableado: manda 0 como la app oficial");
      t.cierto(urlBook.includes("NombrePaciente=%20"), "espacio CODIFICADO, igual que la captura real del front (Incidente v12.3.31)");
      // v17.28.0 — el toast de confirmación se retiró (encargo del médico, 28-ago: "elimina
      // esa notificación... es cuando se asignan citas de laboratorio"); el agendamiento y
      // su resultado real se siguen verificando sobre el valor de retorno, y se fija en
      // rojo que el aviso NO vuelva a aparecer sin que sea una decisión explícita.
      t.igual(ok.smsEnviado, false, "sin celular conocido, no hubo SMS que enviar");
      t.falso(hayTexto(e.c, "Cita de Laboratorio agendada"), "el toast que el médico pidió retirar no debe volver por accidente");
    });

    t.caso("normalizeHora: iguala '6:40:00', '06:40:00' y '06:40' al mismo turno (Incidente v12.3.32 — captura real: la hora rechazada aparecía como libre)", () => {
      const e = entornoApi();
      t.igual(e.c.api.normalizeHora("6:40:00"), "06:40");
      t.igual(e.c.api.normalizeHora("06:40:00"), "06:40");
      t.igual(e.c.api.normalizeHora("06:40"), "06:40");
      t.igual(e.c.api.normalizeHora("14:05:30"), "14:05");
      t.igual(e.c.api.normalizeHora(""), "", "sin hora no inventa nada");
      t.igual(e.c.api.normalizeHora("sin-hora"), "sin-hora", "lo que no parece hora se devuelve tal cual para que la comparación falle honestamente");
    });

    await t.casoAsync("apiLaboratorioAgendarAuto: agenda aunque la hora venga en formato distinto ('6:40:00' del servidor vs '06:40:00' elegida) (Incidente v12.3.32)", async () => {
      const e = entornoApi();
      const turnosFormatoRaro = { turnos: [{ Hora: "6:40:00", AgendaId: 777 }] };
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(turnosFormatoRaro) });
        else if (o.url.includes("AgendarCita")) o.onload({ status: 200, responseText: '{"error":false,"radicado":222}' });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "06:40:00");
      t.cierto(ok, "mismo turno, distinto formato: debe agendar, no rechazar");
      t.cierto(e.reg.gm[1].url.includes("AgendaId=777"));
      // v12.3.33 — hallado en revisión adversarial: la hora enviada debe ser LA DEL TURNO
      // recién consultado (Hora="6:40:00", tal cual, como hace el front oficial), no el
      // string viejo del modal ("06:40:00") con un formato que ese turno nunca tuvo.
      t.cierto(e.reg.gm[1].url.includes("Hora=6%3A40%3A00"), "manda la hora del turno real, no la del modal");
    });

    await t.casoAsync("apiLaboratorioAgendarAuto: si el servicio de SMS responde error, NO se anuncia 'Se envió SMS' (Incidente v12.3.33)", async () => {
      const e = entornoApi();
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(TURNOS_LAB) });
        else if (o.url.includes("AgendarCita")) o.onload({ status: 200, responseText: '{"error":false,"radicado":333}' });
        else if (o.url.includes("EnviarMensajeTextoLaboratorio")) o.onload({ status: 500, responseText: "gateway caido" });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "07:00", "3000000000");
      t.cierto(ok, "la cita SÍ quedó creada — el fallo es solo del SMS");
      // v17.28.0 — el toast que anunciaba esto se retiró (encargo del médico, 28-ago); el
      // incidente real que este caso protege (nunca declarar enviado un SMS que el
      // servicio rechazó) se sigue fijando sobre el valor de retorno, que es lo que
      // consume el resto del script (p. ej. el panel de cierre de cita).
      t.igual(ok.smsEnviado, false, "jamás declarar enviado un SMS que el servicio rechazó (Incidente v12.3.33)");
    });

    await t.casoAsync("apiLaboratorioAgendarAuto: usa AgendaId (mayúsculas) del turno — el nombre real confirmado contra el front de AppCita (Incidente v12.3.31)", async () => {
      const e = entornoApi();
      const turnosMayus = { turnos: [{ Hora: "10:00", AgendaId: 999 }] };
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(turnosMayus) });
        else if (o.url.includes("AgendarCita")) o.onload({ status: 200, responseText: '{"error":false,"radicado":111}' });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "10:00");
      t.cierto(ok);
      t.cierto(e.reg.gm[1].url.includes("AgendaId=999"), "toma el AgendaId real, no un id inventado ni undefined");
    });

    await t.casoAsync("apiLaboratorioAgendarAuto: HTTP 200 con error:true en el cuerpo NO se da por agendada (éxito estricto, Incidente v12.3.31)", async () => {
      const e = entornoApi();
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(TURNOS_LAB) });
        else if (o.url.includes("AgendarCita")) o.onload({ status: 200, responseText: '{"error":true,"mensaje":"cupo ocupado"}' });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "07:00");
      t.falso(ok, "un HTTP 200 que trae error:true en el cuerpo no debe contarse como éxito");
      t.cierto(hayTexto(e.c, "No se pudo confirmar"), "el médico se entera de que debe agendar a mano");
    });

    await t.casoAsync("apiLaboratorioAgendarAuto: si el servidor rechaza la cita (fallo de transporte), NO se da por agendada", async () => {
      const e = entornoApi();
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(TURNOS_LAB) });
        else if (o.url.includes("AgendarCita")) o.onload({ status: 500, responseText: "error interno" });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "07:00");
      t.falso(ok);
      t.cierto(hayTexto(e.c, "No se pudo confirmar"), "el médico se entera de que debe agendar a mano");
    });

    await t.casoAsync("apiLaboratorioAgendarAuto: con celular conocido, envía el SMS con codigoCita=radicado (no AgendaId) (Incidente v12.3.31)", async () => {
      const e = entornoApi();
      e.setGm((o) => {
        if (o.url.includes("ObtenerTurnosPorFecha")) o.onload({ status: 200, responseText: JSON.stringify(TURNOS_LAB) });
        else if (o.url.includes("AgendarCita")) o.onload({ status: 200, responseText: '{"error":false,"radicado":13525848}' });
        else if (o.url.includes("EnviarMensajeTextoLaboratorio")) o.onload({ status: 200, responseText: "{}" });
      });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "07:00", "300 000-0000");
      t.cierto(ok);
      t.igual(e.reg.gm.length, 3, "esta vez sí llama al SMS además de las 2 de siempre");
      const urlSms = e.reg.gm[2].url;
      t.cierto(urlSms.startsWith("https://appcita.viva1a.com.co:8051/API/EnviarMensajeTextoLaboratorio"));
      t.cierto(urlSms.includes("Celular=3000000000"), "el celular se limpia de espacios y guiones antes de mandarlo");
      t.cierto(urlSms.includes("codigoCita=13525848"), "usa el radicado de AgendarCita como codigoCita, NUNCA el AgendaId");
      // v17.15.0 — la prueba pedía el literal «378», así que protegía el cableado en vez de
      // la regla: si alguien cambiaba la sede en mtrSedeIdLab(), esta línea seguía exigiendo
      // el número viejo y el rojo señalaba al arreglo, no al defecto. La v17.6.3 sacó el 378
      // de CINCO URLs a esa función y dejó fuera justo esta — la del mensaje que llega al
      // CELULAR DEL PACIENTE diciéndole a qué laboratorio ir. Ahora se exige la función.
      t.cierto(urlSms.includes("codigoSede=" + e.c.api.mtrSedeIdLab()),
        "la sede del SMS sale de mtrSedeIdLab(), no de un literal: un colega de otra sede mandaría a sus pacientes al laboratorio equivocado, por escrito");
      t.falso(/codigoSede=378\b/.test(urlSms) && e.c.api.mtrSedeIdLab() !== 378,
        "y si la sede cambia, el SMS cambia con ella");
      // v17.28.0 — el toast se retiró (encargo del médico); el resultado real se sigue
      // fijando sobre el valor de retorno.
      t.igual(ok.smsEnviado, true, "con celular conocido y el servicio aceptando, el SMS sí se envió");
    });

    // ---------- apiDigiturnoFinalizarTicket ----------
    await t.casoAsync("apiDigiturnoFinalizarTicket: manda el id de la cita en base64 como EverestId", async () => {
      const e = entornoApi();
      e.setFetch(respuestaJson({ ok: 1 }));
      await e.c.api.apiDigiturnoFinalizarTicket(987);
      t.igual(e.reg.fetches.length, 1);
      const u = e.reg.fetches[0].url;
      t.cierto(u.includes("/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket"));
      t.cierto(u.includes("EverestId=" + encodeURIComponent(Buffer.from("987", "binary").toString("base64"))));
    });

    await t.casoAsync("apiDigiturnoFinalizarTicket: sin citaId no llama a nada", async () => {
      const e = entornoApi();
      await e.c.api.apiDigiturnoFinalizarTicket(null);
      await e.c.api.apiDigiturnoFinalizarTicket(0);
      t.igual(e.reg.fetches.length, 0);
    });

    await t.casoAsync("apiDigiturnoFinalizarTicket: captura errores de red sin lanzar (MUT-AGD-044)", async () => {
      const e = entornoApi();
      e.c.api.__state.activeDoctor = { id: 888 };
      e.c.ctx.Date = class extends Date { static now() { throw new Error("Digiturno crash"); } };
      await t.noLanza(async () => {
        await e.c.api.apiDigiturnoFinalizarTicket(1234);
      }, "Digiturno no debe lanzar excepción al fallar el transporte");
    });

    // ---------- apiAccesoObtenerLaboratoriosAnnar / Citi ----------
    await t.casoAsync("apiAccesoObtenerLaboratoriosAnnar/Citi: cada uno pega a su endpoint con el pacienteId", async () => {
      const e = entornoApi();
      e.setFetch((url) => url.includes("Annar") ? respuestaJson({ lab: "annar" })() : respuestaJson({ lab: "citi" })());
      t.igual(await e.c.api.apiAccesoObtenerLaboratoriosAnnar(55), { lab: "annar" });
      t.igual(await e.c.api.apiAccesoObtenerLaboratoriosCiti(55), { lab: "citi" });
      t.cierto(e.reg.fetches[0].url.includes("ObtenerResultadosLaboratorioAnnar?pacienteId=55"));
      t.cierto(e.reg.fetches[1].url.includes("ObtenerResultadosLaboratorioCiti?pacienteId=55"));
    });

    await t.casoAsync("apiAccesoObtenerLaboratoriosAnnar: un 404 devuelve null sin lanzar", async () => {
      const e = entornoApi();
      e.setFetch(respuestaError(404));
      t.igual(await e.c.api.apiAccesoObtenerLaboratoriosAnnar(55), null);
    });

    await t.casoAsync("apiAccesoObtenerLaboratoriosAnnar: con el fetch caído (500), la lectura se rescata por GM_xmlhttpRequest", async () => {
      const e = entornoApi();
      e.setFetch(respuestaError(500));
      e.setGm((o) => o.onload({ status: 200, responseText: '{"lab":"annar-gm"}' }));
      t.igual(await e.c.api.apiAccesoObtenerLaboratoriosAnnar(55), { lab: "annar-gm" });
      t.cierto(e.reg.gm.length >= 1, "la segunda vía sí se usó");
      t.cierto(e.reg.gm[0].url.includes("ObtenerResultadosLaboratorioAnnar?pacienteId=55"));
    });

    // ---------- apiHcObtenerOrdenamientosVigentes (T6) ----------
    await t.casoAsync("apiHcObtenerOrdenamientosVigentes: pega al endpoint correcto y devuelve el arreglo tal cual", async () => {
      const e = entornoApi();
      const ordenes = [{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: "2026-08-01" }];
      e.setFetch(respuestaJson(ordenes));
      t.igual(await e.c.api.apiHcObtenerOrdenamientosVigentes(999), ordenes);
      t.cierto(e.reg.fetches[0].url.includes("ObtenerOrdenamientoPorPacienteIdVigente?pacienteid=999"));
    });

    await t.casoAsync("apiHcObtenerOrdenamientosVigentes: sin pacienteId no consulta nada", async () => {
      const e = entornoApi();
      e.setFetch(respuestaJson([]));
      t.igual(await e.c.api.apiHcObtenerOrdenamientosVigentes(""), null);
      t.igual(e.reg.fetches.length, 0);
    });

    await t.casoAsync("apiHcObtenerOrdenamientosVigentes: fallo de red (404, sin rescate GM) devuelve null sin lanzar", async () => {
      const e = entornoApi();
      e.setFetch(respuestaError(404));
      t.igual(await e.c.api.apiHcObtenerOrdenamientosVigentes(999), null);
    });

    await t.casoAsync("apiHcObtenerOrdenamientosVigentes: respuesta malformada (no es un arreglo) devuelve null, no la respuesta cruda", async () => {
      const e = entornoApi();
      e.setFetch(respuestaJson({ inesperado: true }));
      t.igual(await e.c.api.apiHcObtenerOrdenamientosVigentes(999), null);
    });

    await t.casoAsync("apiHcObtenerOrdenamientosVigentes: cachea por paciente (una sola consulta real por paciente), incluido un arreglo vacío", async () => {
      const e = entornoApi();
      e.setFetch(respuestaJson([]));
      t.igual(await e.c.api.apiHcObtenerOrdenamientosVigentes(111), [], "arreglo vacío: paciente sin órdenes vigentes, no es un fallo");
      t.igual(await e.c.api.apiHcObtenerOrdenamientosVigentes(111), [], "segunda llamada, mismo paciente");
      t.igual(e.reg.fetches.length, 1, "la segunda llamada se sirvió de la caché, no repitió la consulta pesada");

      e.setFetch(respuestaJson([{ cup: { codigo: "1" }, fechaCreacion: "2026-01-01" }]));
      await e.c.api.apiHcObtenerOrdenamientosVigentes(222);
      t.igual(e.reg.fetches.length, 2, "un paciente DISTINTO sí dispara una consulta nueva");
    });

    // ---------- apiAccesoAgdValidarAgenda ----------
    await t.casoAsync("apiAccesoAgdValidarAgenda: devuelve el veredicto del servidor en vez de descartarlo", async () => {
      const e = entornoApi();
      const veredicto = { isError: false, mensaje: "Superó las validaciones" };
      e.setFetch(respuestaJson(veredicto));
      t.igual(await e.c.api.apiAccesoAgdValidarAgenda(10, 20), veredicto);
      t.cierto(e.reg.fetches[0].url.includes("AgdValidarAgenda?agendaId=10&pacienteId=20"));
    });

    await t.casoAsync("apiAccesoAgdValidarAgenda: fallo o excepción en la red retorna null (MUT-AGD-048)", async () => {
      const e = entornoApi();
      e.c.ctx.Date = class extends Date { static now() { throw new Error("AgdValidarAgenda crash"); } };
      const r = await e.c.api.apiAccesoAgdValidarAgenda(10, 20);
      t.igual(r, null, "debe retornar strictly null ante fallo");
    });

    // ---------- apiAccesoObtenerTurnos ----------
    await t.casoAsync("apiAccesoObtenerTurnos: pide las horas libres con la fecha dd/MM/yyyy codificada", async () => {
      const e = entornoApi();
      const res = { turnos: [{ id: 1, hora: "07:00" }] };
      e.setFetch(respuestaJson(res));
      t.igual(await e.c.api.apiAccesoObtenerTurnos(30, "14/08/2026", 40), res);
      const u = e.reg.fetches[0].url;
      t.cierto(u.includes("/APIAcceso/api/Acceso/ObtenerTurnos"));
      t.cierto(u.includes("agendaid=30"));
      t.cierto(u.includes("fecha=14%2F08%2F2026"), "la fecha viaja URL-encoded");
      t.cierto(u.includes("pacienteId=40"));
    });
    // =====================================================================
    // v18.0.117 (UI/UX #1) — la toma sin hora: motivo honesto, no un horario inventado
    // =====================================================================
    await t.casoAsync("v18.0.117 (UI/UX #1): sin hora elegida, apiLaboratorioAgendarAuto no consulta ni agenda, y el motivo dice la verdad (antes: «el horario elegido () ya no está disponible»)", async () => {
      const e = entornoApi();
      e.setGm((o) => { o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ hora: "07:00", agendaId: 555 }] }) }); });
      const ok = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "");
      t.falso(ok, "sin hora: no se agenda");
      t.igual(e.c.api._labMotivoUltimoFallo(), "no se eligió la hora de la toma", "el motivo es el real, no un horario vacío entre paréntesis");
      t.cierto(hayTexto(e.c, "No se eligió la hora de la toma"), "y se le dice al médico dónde elegirla");
      const ok2 = await e.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", null);
      t.falso(ok2, "null también");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/if \(!horaSeleccionada\) \{[\s\S]{0,240}_labUltimoFallo = "no se eligió la hora de la toma";/.test(src), "la guarda vive antes de buscar el turno");
    });

    await t.casoAsync("v18.0.118 (UI/UX #7): con {silencioso:true} el fallo de la toma NO abre el HUD «Centinela» (el modal ya lo dice por tres canales); sin la opción, sí", async () => {
      const sinTurnos = (o) => { o.onload({ status: 200, responseText: JSON.stringify({ turnos: [] }) }); };
      const e1 = entornoApi(); e1.setGm(sinTurnos);
      const ok1 = await e1.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "07:00", "", { silencioso: true });
      t.falso(ok1, "no se agenda");
      t.falso(hayTexto(e1.c, "NO se agendó"), "y el HUD no sale: el llamador ya avisa por toast, panel y botón");
      t.cierto(!!e1.c.api._labMotivoUltimoFallo(), "pero el motivo se guarda igual, para el panel post-cita: " + e1.c.api._labMotivoUltimoFallo());
      const e2 = entornoApi(); e2.setGm(sinTurnos);
      const ok2 = await e2.c.api.apiLaboratorioAgendarAuto("123456", "2026-08-14", "07:00", "");
      t.falso(ok2, "sin la opción tampoco se agenda");
      t.cierto(hayTexto(e2.c, "NO se agendó"), "y ahí el HUD sí sale (la toma sola es el único canal de ese cuadro)");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/_agmAgendarLabConCandado\(apt\.doc_id, labFecha\.iso, selectedLabTime, celularSms, false, \{ silencioso: true \}\)/.test(src), "Agendar es quien pide silencio");
      const zona = src.slice(src.indexOf("async function apiLaboratorioAgendarAuto("), src.indexOf("async function apiLaboratorioAgendarAuto(") + 9000);
      t.igual((zona.match(/\n\s*spToast\(/g) || []).length, 0, "dentro de la función ya no queda ningún spToast directo: todos pasan por _hud");
    });

  }
};
