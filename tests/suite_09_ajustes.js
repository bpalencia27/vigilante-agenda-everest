// =====================================================================
//  SUITE 09 — Ajustes y almacén local
//  Cubre la capa de persistencia (readJSON/writeJSON), los ajustes del
//  usuario (S, saveSettings, applySettings), el registro diario contra
//  duplicados (vgl_proc_today) y el tema visual (darkPreferred/isLight/
//  applyTheme). Todo sobre una instancia fresca: estas pruebas mutan S,
//  CONFIG y localStorage y no deben ensuciar la instancia compartida.
// =====================================================================
module.exports = {
  nombre: "Ajustes y almacén local (Suite 09)",
  cubre: [
    "readJSON", "writeJSON", "saveSettings", "getProcessedToday",
    "isCitaAgendadaHoy", "isOrdenesCreadasHoy", "markCitaAgendadaHoy", "markOrdenesCreadasHoy",
    "isLabAgendadaHoy", "markLabAgendadaHoy", "citaAgendadaFechaHoy",
    "applySettings", "darkPreferred", "isLight", "applyTheme", "restartPolling",
  ],

  pruebas(t, api, env, cargar) {
    const c = cargar({ silencioso: true });
    const A = c.api;
    const S = A.__S;
    const CONFIG = A.__CONFIG;
    const PROC_KEY = "vgl_proc_today";

    // ------------------------------------------------------------------
    //  readJSON / writeJSON — capa de persistencia
    // ------------------------------------------------------------------
    t.caso("writeJSON + readJSON: ciclo completo con un objeto", () => {
      t.igual(A.writeJSON("tst_obj", { a: 1, b: [2, 3] }), true, "writeJSON debe devolver true");
      t.igual(c.env.almacen["tst_obj"], '{"a":1,"b":[2,3]}', "en localStorage debe quedar el JSON serializado");
      t.igual(A.readJSON("tst_obj", null), { a: 1, b: [2, 3] });
    });

    t.caso("readJSON: clave ausente o JSON corrupto devuelven el valor por defecto", () => {
      t.igual(A.readJSON("tst_no_existe", "fabrica"), "fabrica");
      c.env.storage.setItem("tst_corrupto", "{esto no es json");
      t.igual(A.readJSON("tst_corrupto", 42), 42, "el JSON roto no debe lanzar, debe caer al defecto");
    });

    t.caso("writeJSON: devuelve false si el valor no se puede serializar (referencia circular)", () => {
      const circular = {}; circular.yo = circular;
      t.igual(A.writeJSON("tst_circular", circular), false);
      t.igual(c.env.storage.getItem("tst_circular"), null, "no debe dejar basura a medias");
    });

    t.caso("writeJSON: devuelve false si localStorage lanza (cuota llena)", () => {
      const setItemReal = c.env.storage.setItem;
      c.env.storage.setItem = () => { throw new Error("QuotaExceededError"); };
      try {
        t.igual(A.writeJSON("tst_cuota", { x: 1 }), false, "el fallo de cuota no debe propagarse");
      } finally {
        c.env.storage.setItem = setItemReal;
      }
    });

    // ------------------------------------------------------------------
    //  getProcessedToday — registro diario contra duplicados
    // ------------------------------------------------------------------
    t.caso("getProcessedToday: sin registro previo crea el día vacío y lo persiste", () => {
      c.env.storage.removeItem(PROC_KEY);
      const hoy = A.todayStamp();
      const p = A.getProcessedToday();
      t.igual(p, { dia: hoy, citas: [], ordenes: [] });
      t.igual(A.readJSON(PROC_KEY, null), { dia: hoy, citas: [], ordenes: [] }, "debe quedar guardado en localStorage");
    });

    t.caso("getProcessedToday: un registro de otro día se resetea (cambio de medianoche)", () => {
      A.writeJSON(PROC_KEY, { dia: "2020-01-01", citas: ["999"], ordenes: ["888"] });
      const p = A.getProcessedToday();
      t.igual(p.dia, A.todayStamp());
      t.igual(p.citas, [], "las citas de ayer no deben sobrevivir");
      t.igual(p.ordenes, [], "las órdenes de ayer no deben sobrevivir");
    });

    t.caso("getProcessedToday: el registro del mismo día se conserva tal cual", () => {
      A.writeJSON(PROC_KEY, { dia: A.todayStamp(), citas: ["11"], ordenes: ["22"] });
      const p = A.getProcessedToday();
      t.igual(p.citas, ["11"]);
      t.igual(p.ordenes, ["22"]);
    });

    // ------------------------------------------------------------------
    //  isCitaAgendadaHoy / isOrdenesCreadasHoy / mark…
    // ------------------------------------------------------------------
    t.caso("isCitaAgendadaHoy / isOrdenesCreadasHoy: falso sin documento o sin marca", () => {
      c.env.storage.removeItem(PROC_KEY);
      t.falso(A.isCitaAgendadaHoy(null));
      t.falso(A.isCitaAgendadaHoy(""));
      t.falso(A.isOrdenesCreadasHoy(undefined));
      t.falso(A.isCitaAgendadaHoy("123"), "documento nunca marcado");
      t.falso(A.isOrdenesCreadasHoy("123"));
    });

    t.caso("markCitaAgendadaHoy: marca, persiste, invalida la firma del panel y no duplica", () => {
      c.env.storage.removeItem(PROC_KEY);
      A.__state.lastSignature = "firma-sucia";
      A.markCitaAgendadaHoy(123);                     // número a propósito: debe normalizar a texto
      t.cierto(A.isCitaAgendadaHoy("123"), "debe encontrarla como texto");
      t.cierto(A.isCitaAgendadaHoy(123), "y también como número");
      t.falso(A.isOrdenesCreadasHoy("123"), "citas y órdenes son listas independientes");
      t.igual(A.__state.lastSignature, "", "debe invalidar la firma para que el panel se repinte");
      A.markCitaAgendadaHoy("123");                   // segunda vez: no debe duplicar
      t.igual(A.getProcessedToday().citas, ["123"], "sin duplicados en el registro persistido");
    });

    t.caso("markOrdenesCreadasHoy: marca órdenes sin tocar las citas", () => {
      c.env.storage.removeItem(PROC_KEY);
      A.markOrdenesCreadasHoy("456");
      t.cierto(A.isOrdenesCreadasHoy("456"));
      t.falso(A.isCitaAgendadaHoy("456"));
      A.markOrdenesCreadasHoy(456);                   // mismo documento como número: no duplica
      t.igual(A.getProcessedToday().ordenes, ["456"]);
    });

    t.caso("mark…: con documento vacío no escriben nada (ni siquiera crean el registro)", () => {
      c.env.storage.removeItem(PROC_KEY);
      A.markCitaAgendadaHoy("");
      A.markOrdenesCreadasHoy(null);
      t.igual(c.env.storage.getItem(PROC_KEY), null, "el registro diario no debe existir");
    });

    // ------------------------------------------------------------------
    //  v12.3.28 — bloqueo independiente cita de control / toma de muestras
    // ------------------------------------------------------------------
    t.caso("markCitaAgendadaHoy: con fechaIso la recuerda; una marca vieja sin ella no la borra", () => {
      c.env.storage.removeItem(PROC_KEY);
      t.igual(A.citaAgendadaFechaHoy("789"), null, "sin marcar, no hay fecha");
      A.markCitaAgendadaHoy("789", "2026-11-10");
      t.cierto(A.isCitaAgendadaHoy("789"));
      t.igual(A.citaAgendadaFechaHoy("789"), "2026-11-10");
      t.igual(A.citaAgendadaFechaHoy("999999999"), null, "otro paciente no se contamina");
      A.markCitaAgendadaHoy("789");   // llamada vieja, sin segundo argumento
      t.igual(A.citaAgendadaFechaHoy("789"), "2026-11-10", "la fecha previa se conserva");
    });

    t.caso("isLabAgendadaHoy / markLabAgendadaHoy: bloqueo independiente de la cita de control", () => {
      c.env.storage.removeItem(PROC_KEY);
      t.falso(A.isLabAgendadaHoy(null));
      t.falso(A.isLabAgendadaHoy("321"), "documento nunca marcado");
      A.markCitaAgendadaHoy("321", "2026-11-10");
      t.cierto(A.isCitaAgendadaHoy("321"));
      t.falso(A.isLabAgendadaHoy("321"), "marcar la cita de control NO marca el laboratorio");
      A.markLabAgendadaHoy(321);                       // número a propósito: debe normalizar a texto
      t.cierto(A.isLabAgendadaHoy("321"), "debe encontrarla como texto");
      t.cierto(A.isLabAgendadaHoy(321), "y también como número");
      A.markLabAgendadaHoy("321");                      // segunda vez: no debe duplicar
      t.igual(A.getProcessedToday().labs, ["321"], "sin duplicados en el registro persistido");
    });

    t.caso("markLabAgendadaHoy: con documento vacío no escribe nada", () => {
      c.env.storage.removeItem(PROC_KEY);
      A.markLabAgendadaHoy("");
      A.markLabAgendadaHoy(null);
      t.igual(c.env.storage.getItem(PROC_KEY), null, "el registro diario no debe existir");
    });

    t.caso("marcas de ayer no cuentan hoy (el reset diario protege de falsos positivos)", () => {
      A.writeJSON(PROC_KEY, { dia: "2020-01-01", citas: ["777"], ordenes: ["777"], labs: ["777"], citasDetalle: { "777": { fechaIso: "2020-01-05", ts: 1 } } });
      t.falso(A.isCitaAgendadaHoy("777"));
      t.falso(A.isOrdenesCreadasHoy("777"));
      t.falso(A.isLabAgendadaHoy("777"), "el reset diario también protege al bloqueo de laboratorio");
      t.igual(A.citaAgendadaFechaHoy("777"), null, "y a la fecha recordada de la cita de control");
    });

    // ------------------------------------------------------------------
    //  darkPreferred / isLight — preferencia de tema
    //  PAGEWIN es el propio global del vm, así que matchMedia se puede
    //  pisar en caliente desde c.ctx.
    // ------------------------------------------------------------------
    t.caso("darkPreferred: sigue a matchMedia(prefers-color-scheme: dark)", () => {
      c.ctx.matchMedia = () => ({ matches: false });
      t.falso(A.darkPreferred(), "sistema en claro");
      c.ctx.matchMedia = () => ({ matches: true });
      t.cierto(A.darkPreferred(), "sistema en oscuro");
    });

    t.caso("darkPreferred: sin matchMedia o si lanza, se asume oscuro (el tema de fábrica)", () => {
      c.ctx.matchMedia = undefined;
      t.cierto(A.darkPreferred(), "navegador sin matchMedia");
      c.ctx.matchMedia = () => { throw new Error("boom"); };
      t.cierto(A.darkPreferred(), "matchMedia roto tampoco debe lanzar");
      c.ctx.matchMedia = () => ({ matches: false });  // restaurar para los casos siguientes
    });

    t.caso("isLight: 'claro' siempre es claro y 'oscuro' siempre es oscuro", () => {
      S.tema = "claro";
      t.cierto(A.isLight());
      S.tema = "oscuro";
      t.falso(A.isLight());
    });

    t.caso("isLight: 'auto' sigue la preferencia de Windows", () => {
      S.tema = "auto";
      c.ctx.matchMedia = () => ({ matches: false });
      t.cierto(A.isLight(), "auto sin preferencia oscura → claro");
      c.ctx.matchMedia = () => ({ matches: true });
      t.falso(A.isLight(), "auto con Windows en oscuro → oscuro");
      S.tema = "oscuro";                              // restaurar
      c.ctx.matchMedia = () => ({ matches: false });
    });

    // ------------------------------------------------------------------
    //  applyTheme — alterna clases en root / dock / toasts
    // ------------------------------------------------------------------
    t.caso("applyTheme: pone y quita 'light' y 'perf' en root, dock y toasts", () => {
      const nodos = {
        "vgl-root": c.env.doc.createElement("div"),
        "vgl-dock": c.env.doc.createElement("div"),
        "vgl-toasts": c.env.doc.createElement("div"),
      };
      const getElementByIdReal = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => nodos[id] || null;
      try {
        S.tema = "claro"; S.modoRendimiento = true;
        A.applyTheme();
        t.cierto(nodos["vgl-root"].classList.contains("light"));
        t.cierto(nodos["vgl-root"].classList.contains("perf"));
        t.cierto(nodos["vgl-dock"].classList.contains("light"));
        t.cierto(nodos["vgl-dock"].classList.contains("perf"));
        t.cierto(nodos["vgl-toasts"].classList.contains("light"));

        S.tema = "oscuro"; S.modoRendimiento = false;
        A.applyTheme();
        t.falso(nodos["vgl-root"].classList.contains("light"), "volver a oscuro debe quitar la clase");
        t.falso(nodos["vgl-root"].classList.contains("perf"));
        t.falso(nodos["vgl-dock"].classList.contains("light"));
        t.falso(nodos["vgl-toasts"].classList.contains("light"));
      } finally {
        c.env.doc.getElementById = getElementByIdReal;
      }
    });

    t.caso("applyTheme: sin panel en el DOM no lanza", () => {
      // getElementById del harness devuelve null: la función debe tragárselo.
      t.noLanza(() => A.applyTheme());
    });

    // ------------------------------------------------------------------
    //  applySettings — traduce S a CONFIG
    // ------------------------------------------------------------------
    t.caso("applySettings: el refresco se aplica en milisegundos con topes de 2 a 120 s", () => {
      S.refresco = 10; A.applySettings();
      t.igual(CONFIG.POLL_MS, 10000);
      S.refresco = 999; A.applySettings();
      t.igual(CONFIG.POLL_MS, 120000, "por encima del tope se recorta a 120 s");
      S.refresco = 1; A.applySettings();
      t.igual(CONFIG.POLL_MS, 2000, "por debajo del mínimo se sube a 2 s");
      S.refresco = "abc"; A.applySettings();
      t.igual(CONFIG.POLL_MS, 5000, "un valor inválido cae al de fábrica (5 s)");
      S.refresco = 5;
    });

    t.caso("applySettings: la tolerancia es rígida en 6.0 min aunque el ajuste guarde otra cosa", () => {
      S.tolerancia = 99; A.applySettings();
      t.igual(CONFIG.TOLERANCIA_MIN, 6);
      S.tolerancia = 6;
    });

    t.caso("applySettings: la lista de exclusión PyM se normaliza (acentos, mayúsculas, vacíos)", () => {
      S.excluir = " VDRL, Sífilis ,, HepB ";
      A.applySettings();
      t.igual(CONFIG.EXCLUDE_PYM, ["vdrl", "sifilis", "hepb"]);
      S.excluir = "";
      A.applySettings();
      t.igual(CONFIG.EXCLUDE_PYM, [], "cadena vacía = no excluir nada");
    });

    t.caso("applySettings: un respaldoId inválido no toca el respaldo de fábrica", () => {
      S.respaldoId = "esto-no-es-un-guid";
      A.applySettings();
      t.igual(CONFIG.SP.respaldo.id, "809a098b-69d1-44fe-9e51-b01f07290807");
    });

    t.caso("applySettings: un enlace con sourcedoc reemplaza el respaldo por el personalizado", () => {
      S.respaldoId = "https://viva1aips-my.sharepoint.com/:x:/r/personal/x/_layouts/15/Doc.aspx?sourcedoc={2B3C4D5E-1111-2222-3333-444455556666}&action=view";
      A.applySettings();
      t.igual(CONFIG.SP.respaldo.id, "2b3c4d5e-1111-2222-3333-444455556666", "el guid queda en minúsculas");
      t.igual(CONFIG.SP.respaldo.name, "Base PyM (enlace personalizado)");
      S.respaldoId = "";
    });

    // ------------------------------------------------------------------
    //  saveSettings — persistir y reaplicar en un solo paso
    // ------------------------------------------------------------------
    t.caso("saveSettings: persiste S en vgl_cfg y reaplica los ajustes de una vez", () => {
      S.refresco = 7; S.sonido = false;
      A.saveSettings();
      const guardado = A.readJSON("vgl_cfg", null);
      t.igual(guardado.refresco, 7, "el refresco editado debe quedar en el disco");
      t.igual(guardado.sonido, false);
      t.igual(CONFIG.POLL_MS, 7000, "saveSettings debe aplicar sin esperar otro paso");
      S.refresco = 5; S.sonido = true;
      A.saveSettings();
    });

    // ------------------------------------------------------------------
    //  restartPolling — solo la guarda es observable aquí: la rama que
    //  reprograma el intervalo exige el panel construido (el.root, lo
    //  arma buildUI en un DOM real) que en este entorno nunca existe.
    // ------------------------------------------------------------------
    t.caso("restartPolling: sin panel construido no programa ningún intervalo (guarda)", () => {
      let programados = 0;
      const setIntervalReal = c.ctx.setInterval;
      c.ctx.setInterval = () => { programados++; return 1; };
      try {
        t.noLanza(() => A.restartPolling());
        t.igual(programados, 0, "sin el.root no debe arrancar el sondeo");
      } finally {
        c.ctx.setInterval = setIntervalReal;
      }
    });

    // ===================================================================
    // v17.6.27 — AUDITORÍA S+ (barrido total, 24-ago-2026): la migración "estreno"
    // (v14.2.0) solo debe encender motorPortado/iaRedaccion/uxTelemetria/reporte en
    // equipos que YA tenían vgl_cfg guardado — v17.6.8 documenta ese arreglo. Pero
    // `_habiaConfigPrevia` se leía DESPUÉS de que otras cuatro migraciones (v7.3,
    // v14.2-notif, v15.4, v15.0-banner) ya habían escrito vgl_cfg con writeJSON: en
    // TODA instalación limpia, localStorage.getItem("vgl_cfg") ya daba truthy para
    // cuando la migración de estreno lo comprobaba, y las 4 banderas se encendían
    // solas donde no debían. Se corrige capturando la marca ANTES de la primera
    // migración. Nota: el harness pre-siembra vgl_v1420_estreno="1" por defecto
    // (línea ~84 de tests/harness.js) para que el resto del banco no dispare esta
    // migración sin querer — aquí se anula ese preseteo a propósito con
    // `almacen: { vgl_v1420_estreno: null }` para poder observar la migración real.
    // ===================================================================
    t.caso("v17.6.27/v17.58.2: instalación LIMPIA (sin vgl_cfg previo): la migración de estreno NO enciende motorPortado/iaRedaccion; reporte/uso nacen encendidos por política", () => {
      // almacen sin vgl_cfg (instalación limpia) y con vgl_v1420_estreno=null para
      // anular el preseteo por defecto del harness y dejar correr la migración real.
      const fresco = cargar({ silencioso: true, defaultOff: true, almacen: { vgl_v1420_estreno: null } });
      t.igual(fresco.api.__S.motorPortado, false, "de fábrica, no por una migración que no debía correr");
      t.igual(fresco.api.__S.iaRedaccion, false);
      // v17.58.2 — política del dueño: la telemetría nace ENCENDIDA (DEFAULTS + forzado en S),
      // no por la migración de estreno. Las dos banderas que esta prueba vigila (motor/ia)
      // siguen apagadas, que es lo que la v17.6.27 corregía.
      t.igual(fresco.api.__S.uxTelemetria, true, "v17.58.2 — la telemetría nace encendida por política, no por la migración");
      t.igual(fresco.api.__S.reporte, true, "idem");
      t.igual(fresco.env.almacen["vgl_v1420_estreno"], "1", "la migración SÍ se marca como corrida (no vuelve a intentarlo), pero no tocó las banderas");
    });

    t.caso("v17.6.27/v17.58.2: equipo con vgl_cfg PREVIO (la ruta de actualización real) enciende motorPortado/iaRedaccion; la telemetría ya viene encendida", () => {
      const previo = JSON.stringify({ reporte: false, uxTelemetria: false });
      const actualizado = cargar({ silencioso: true, almacen: { vgl_cfg: previo, vgl_v1420_estreno: null } });
      t.igual(actualizado.api.__S.motorPortado, true, "equipo que YA tenía configuración: la migración de estreno SÍ aplica");
      t.igual(actualizado.api.__S.iaRedaccion, true);
      t.igual(actualizado.api.__S.uxTelemetria, true);
      t.igual(actualizado.api.__S.reporte, true);
    });
  },
};
