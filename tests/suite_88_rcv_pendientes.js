// =====================================================================
//  SUITE 88 — v18.4.2: panel «Próximos exámenes RCV» del paciente abierto
//
//  Encargo del equipo de riesgo cardiovascular (06-sep-2026). Esta suite
//  protege, en una frase: que el panel SOLO se pinte dentro de la historia
//  clínica de un paciente abierto y SOLO para el equipo autorizado (la
//  capacidad «rcv» del padrón de acceso — nadie más), que cada fila muestre
//  Última→Vence con el estado correcto contra la UNA tabla de vigencias del
//  paquete I10X (RCV_VIGENCIA_DIAS), que un fallo de red nunca oculte un
//  pendiente (D4), y que el refresco en vivo refleje una orden nueva sin
//  recargar la interfaz.
//
//  Los NOMBRES del padrón no viven en el userscript (7A): la suite los
//  siembra en `vgl_acceso_lista` como lo haría la lista remota (patrón de
//  suite_78). Los cuatro del perfil COMPLETO SON el equipo de RCV.
// =====================================================================

"use strict";

const fs = require("fs");
const path = require("path");

const LISTA_RCV = {
  version: "2026-09-06.1",
  perfiles: {
    COMPLETO: [
      { uid: 101, nombre: "Brandon Jesús Palencia Martínez" },
      { uid: 102, nombre: "Eliseth Estrada" },
      { uid: 103, nombre: "María Edineth Pino" },
      { uid: 104, nombre: "Sinaí Mijares" },
    ],
    LABORATORIOS: [{ uid: 201, nombre: "Maryuris Terán" }],
  },
  blocklist: [{ uid: 999, nombre: "Prueba Bloqueada Uno" }],
};

const HOY = "2026-09-06";
const DAY_MS = 86400000;
const msDe = (iso) => new Date(iso + "T00:00:00").getTime();
const isoDe = (ms) => {
  const d = new Date(ms);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
// fecha ISO a N días de HOY (fixture congelado: la suite pura no depende del reloj real)
const desdeHoy = (dias) => isoDe(msDe(HOY) + dias * DAY_MS);

const PKG_88 = {
  cie10: "I10X", vigenciaDias: 180,
  cups: [
    { codigo: "903815", desc: "Exámen Vencido <con>" },   // se usa también para el escape HTML
    { codigo: "903817", desc: "Exámen Al Día" },
    { codigo: "903895", desc: "Exámen Próximo" },
    { codigo: "903841", desc: "Exámen Sin Registro" },
  ],
};

function ordenDe(codigo, fechaIso) {
  return { cup: { codigo: codigo }, fechaCreacion: fechaIso + "T08:15:00-05:00" };
}

module.exports = {
  nombre: "Panel Próximos exámenes RCV (v18.4.2): permiso, contexto HC, fechas y refresco",

  cubre: ["rcvPendientesCalcular", "rcvPendientesDebeVerse", "rcvPendientesHtml",
    "rcvPendientesRotuloPrograma", "rcvPendientesTick"],

  async pruebas(t, api, env, cargar) {
    // ============================ PURAS ============================
    t.caso("calcular: vencido/próximo/al día/pendiente con Última y Vence correctos (vigencia 180)", () => {
      const ordenes = [
        ordenDe("903815", desdeHoy(-200)),   // vence hace 20 d → VENCIDO
        ordenDe("903817", desdeHoy(-179)),   // vence en 1 d → PRÓXIMO (borde interior)
        ordenDe("903895", desdeHoy(-180)),   // vence HOY → PRÓXIMO (vencer hoy aún no es vencido)
      ];
      const r = api.rcvPendientesCalcular(PKG_88, ordenes, HOY);
      t.igual(r.vigenciaDias, 180);
      t.falso(r.sinDatosOrdenes, "había órdenes");
      const porCodigo = {};
      for (const f of r.filas) porCodigo[f.codigo] = f;
      const v = porCodigo["903815"];
      t.igual(v.estado, "vencido");
      t.igual(v.ultima, desdeHoy(-200));
      t.igual(v.vence, desdeHoy(-20));
      t.igual(v.dias, -20);
      t.igual(porCodigo["903817"].estado, "proximo", "vence mañana: aún no vencido");
      t.igual(porCodigo["903895"].estado, "proximo", "vence HOY: próximo, no vencido");
      t.igual(porCodigo["903895"].dias, 0);
      const p = porCodigo["903841"];
      t.igual(p.estado, "pendiente");
      t.igual(p.ultima, null, "sin registro de orden");
      t.igual(p.vence, null, "no se inventa vencimiento");
    });

    t.caso("calcular: bordes exactos del umbral visual — vence en 30 d es PRÓXIMO, en 31 d es AL DÍA", () => {
      const r = api.rcvPendientesCalcular(PKG_88, [
        ordenDe("903815", desdeHoy(-150)),   // vence en 30 d
        ordenDe("903817", desdeHoy(-149)),   // vence en 31 d
      ], HOY);
      const porCodigo = {};
      for (const f of r.filas) porCodigo[f.codigo] = f;
      t.igual(porCodigo["903815"].estado, "proximo", "30 d = dentro del umbral");
      t.igual(porCodigo["903815"].dias, 30);
      t.igual(porCodigo["903817"].estado, "aldia", "31 d = fuera del umbral");
    });

    t.caso("calcular: de varias órdenes del mismo CUPS manda la MÁS RECIENTE; la fecha futura se descarta", () => {
      const r = api.rcvPendientesCalcular(PKG_88, [
        ordenDe("903815", desdeHoy(-100)),
        ordenDe("903815", desdeHoy(-40)),    // más reciente: vence en 140 d → AL DÍA
        ordenDe("903817", desdeHoy(5)),      // futura: absurda, no cuenta → PENDIENTE
      ], HOY);
      const porCodigo = {};
      for (const f of r.filas) porCodigo[f.codigo] = f;
      t.igual(porCodigo["903815"].ultima, desdeHoy(-40), "manda la repetición más nueva");
      t.igual(porCodigo["903815"].estado, "aldia");
      t.igual(porCodigo["903817"].estado, "pendiente", "la orden con fecha futura no cubre nada");
    });

    t.caso("calcular (D4): sin órdenes consultables TODO queda pendiente y se declara sinDatosOrdenes", () => {
      for (const vacio of [null, undefined, [], "basura"]) {
        const r = api.rcvPendientesCalcular(PKG_88, vacio, HOY);
        t.cierto(r.sinDatosOrdenes, "marca la falta de datos con " + JSON.stringify(vacio));
        t.cierto(r.filas.every((f) => f.estado === "pendiente"), "nada se da por cubierto sin datos");
        t.igual(r.nPendientes, PKG_88.cups.length);
      }
      const sinVigencia = api.rcvPendientesCalcular({ cups: PKG_88.cups }, [ordenDe("903815", HOY)], HOY);
      t.cierto(sinVigencia.filas.every((f) => f.estado === "pendiente"),
        "paquete sin vigencia confirmada: siempre pendiente (misma D4 de pymCubiertoPorOrdenVigente)");
    });

    t.caso("debeVerse: las CUATRO condiciones a la vez — cualquiera que falte apaga el panel", () => {
      const todo = { autorizado: true, enHCHealth: true, seccion: "historia", docId: "5150076" };
      t.cierto(api.rcvPendientesDebeVerse(todo), "el contexto completo sí lo muestra");
      t.falso(api.rcvPendientesDebeVerse({ autorizado: false, enHCHealth: true, seccion: "historia", docId: "5150076" }), "sin permiso");
      t.falso(api.rcvPendientesDebeVerse({ autorizado: true, enHCHealth: false, seccion: "historia", docId: "5150076" }), "ruta fuera de HCHealth");
      t.falso(api.rcvPendientesDebeVerse({ autorizado: true, enHCHealth: true, seccion: "agenda", docId: "5150076" }), "en la agenda del día");
      t.falso(api.rcvPendientesDebeVerse({ autorizado: true, enHCHealth: true, seccion: "historia", docId: "" }), "sin paciente abierto");
      t.falso(api.rcvPendientesDebeVerse(null), "sin contexto");
    });

    t.caso("rotuloPrograma: string, bloque rector y plan.programa — siempre un rótulo legible", () => {
      t.igual(api.rcvPendientesRotuloPrograma({ programa: "HTA" }), "Hipertensión arterial");
      t.igual(api.rcvPendientesRotuloPrograma({ programa: { rector: "DM2" } }), "Diabetes tipo 2");
      t.igual(api.rcvPendientesRotuloPrograma({ plan: { programa: "ERC" } }), "Enfermedad renal crónica");
      t.igual(api.rcvPendientesRotuloPrograma({ programa: "XYZ" }), "XYZ", "programa desconocido: se muestra tal cual, sin inventar");
      t.igual(api.rcvPendientesRotuloPrograma(null), "");
    });

    t.caso("html: chip de estado, par Última→Vence en cada fila, orden por urgencia y escape", () => {
      const r = api.rcvPendientesCalcular(PKG_88, [
        ordenDe("903815", desdeHoy(-200)),
        ordenDe("903817", desdeHoy(-179)),
      ], HOY);
      const html = api.rcvPendientesHtml(r, "Hipertensión arterial");
      t.cierto(html.indexOf("Próximos exámenes · Riesgo cardiovascular") >= 0, "título");
      t.cierto(html.indexOf("Programa: Hipertensión arterial") >= 0, "programa del paciente");
      t.cierto(html.indexOf("VENCIDO") >= 0 && html.indexOf("PRÓXIMO") >= 0 && html.indexOf("PENDIENTE") >= 0, "chips de estado");
      t.cierto(html.indexOf("Última: " + desdeHoy(-200)) >= 0 && html.indexOf("Vence: " + desdeHoy(-20)) >= 0, "fechas de la fila vencida");
      t.cierto(html.indexOf("Última: sin registro") >= 0, "la fila sin orden lo dice, no inventa");
      t.falso(html.indexOf("<con>") >= 0, "el desc con < > llega escapado");
      t.falso(/AL DÍA/.test(html) === false && r.filas.some((f) => f.estado === "aldia"), "si hay al día, se ve");
      t.cierto(html.indexOf("vgl-rcvp-chip-vencido") < html.indexOf("vgl-rcvp-chip-pendiente"), "vencido se pinta arriba de pendiente");
      const d4 = api.rcvPendientesHtml({ filas: [], nPendientes: 0, sinDatosOrdenes: true, vigenciaDias: null }, "");
      t.cierto(d4.indexOf("Sin órdenes vigentes consultables") >= 0, "la nota D4 aparece cuando no hay datos");
    });

    // ======================= INTEGRACIÓN: PERMISO =======================
    function cablearHistoria(c, cedula, conAnamesis) {
      const doc = c.env.doc;
      const getByIdReal = doc.getElementById.bind(doc);
      const qsAllReal = doc.querySelectorAll.bind(doc);
      doc.getElementById = (id) => (id === "anamesis" && conAnamesis !== false ? { textContent: "" } : getByIdReal(id));
      doc.querySelectorAll = (sel) => {
        if (sel === ".text-muted") return cedula ? [{ textContent: "  C.C.  " + cedula + " ", closest: () => null }] : [];
        return qsAllReal(sel);
      };
    }

    function resumen88(pid) {
      return {
        programa: "HTA", factores: { hta: true },
        erc: { egfr: 80 }, riesgo: { categoria: "bajo" },
        _docId: "5150076", _pacienteIdLabs: pid || null,
      };
    }

    function crearRed(fetchPropio) {
      const red = { cuerpo: [ordenDe("903815", desdeHoy(-200)), ordenDe("903817", desdeHoy(-179))], fetches: 0 };
      const respuesta = () => ({
        ok: true, status: 200, headers: { get: () => "application/json" },
        json: () => Promise.resolve(red.cuerpo),
        text: () => Promise.resolve("[]"),
      });
      // El userscript captura la referencia de fetch al cargar: el mock debe
      // entrar POR cargar({fetch}), nunca reemplazando win.fetch después.
      red.fetch = fetchPropio
        ? (url) => { red.fetches++; return fetchPropio(url, () => respuesta()); }
        : (url) => { red.fetches++; return Promise.resolve(respuesta()); };
      return red;
    }

    const ctx88 = (uid, nombre, extra) => {
      const ex = extra || {};
      const red = ex.red || crearRed();
      const c = cargar({
        silencioso: true,
        almacen: { vgl_acceso_lista: JSON.stringify(LISTA_RCV) },
        fetch: red.fetch,
        gmxhr: (o) => o.onerror(new Error("sin red")),
      });
      c.api.__state.activeDoctor.id = uid;
      c.api.__state.activeDoctor.name = nombre;
      cablearHistoria(c, "5150076", ex.anamesis !== false);
      try { c.api.mtrCacheResumenGuardar("5150076", resumen88(ex.pid === undefined ? 777 : ex.pid)); } catch (e) {}
      return { c: c, red: red };
    };

    const montado88 = (c) => Array.prototype.some.call(c.env.doc.body.children, (e) => e.id === "vgl-rcv-pendientes");
    const widget88 = (c) => Array.prototype.find.call(c.env.doc.body.children, (e) => e.id === "vgl-rcv-pendientes") || null;

    await t.casoAsync("permiso: el equipo RCV (COMPLETO del padrón) ve el panel dentro de la historia", async () => {
      const { c } = ctx88(102, "Eliseth Estrada");
      t.cierto(c.api.esMedicoRCVActivo(), "precondición: la capacidad rcv del padrón");
      await c.api.rcvPendientesTick();
      t.cierto(montado88(c), "el panel se montó");
      const w = widget88(c);
      t.cierto(!!w && w.innerHTML.indexOf("Programa: Hipertensión arterial") >= 0, "alineado al programa del paciente");
      t.cierto(!!w && w.innerHTML.indexOf("Última: " + desdeHoy(-200)) >= 0, "muestra la última fecha real de la orden");
      t.cierto(!!w && w.innerHTML.indexOf("Vence: " + desdeHoy(-20)) >= 0, "y su vencimiento");
      t.cierto(!!w && w.style.display === "", "visible");
    });

    await t.casoAsync("permiso: PÚBLICO, LABORATORIOS, BLOQUEADO y sin identidad NO ven el panel", async () => {
      for (const [uid, nombre] of [[555, "Médico Nuevosur del Hospital"], [201, "Maryuris Terán"], [999, "Prueba Bloqueada Uno"], [0, ""]]) {
        const { c } = ctx88(uid, nombre);
        t.falso(c.api.esMedicoRCVActivo(), "precondición sin rcv: " + nombre);
        await c.api.rcvPendientesTick();
        t.falso(montado88(c), "no se monta para uid " + uid);
      }
    });

    // ==================== INTEGRACIÓN: CONTEXTO/RUTA ====================
    await t.casoAsync("contexto: fuera de la ruta /viva/HCHealth no se pinta, aunque todo lo demás esté a favor", async () => {
      for (const ruta of ["/viva/EverHealth/HCHealth/", "/viva/Acceso/", "/viva/EverHealth/OrdenamientoHealth"]) {
        const { c } = ctx88(103, "María Edineth Pino");
        c.env.win.location.pathname = ruta;
        await c.api.rcvPendientesTick();
        t.falso(montado88(c), "no se monta en " + ruta);
      }
    });

    await t.casoAsync("contexto: en la agenda del día (sin #anamesis) tampoco se pinta", async () => {
      const { c } = ctx88(103, "María Edineth Pino");
      // marcadores de agenda presentes, marcador de historia ausente: seccionActiva === "agenda"
      const qsReal = c.env.doc.querySelector.bind(c.env.doc);
      c.env.doc.querySelector = (sel) => {
        const s = String(sel);
        if (s === c.api.__CONFIG.SEL.hora || s === c.api.__CONFIG.SEL.estado) return { textContent: "7:30 a. m." };
        return qsReal(sel);
      };
      c.env.doc.getElementById = () => null;   // sin #anamesis
      await c.api.rcvPendientesTick();
      t.falso(montado88(c), "en Citas del día el panel de la historia no existe");
    });

    await t.casoAsync("contexto: sin paciente abierto o sin resumen del motor, el panel no se pinta", async () => {
      const sinPac = ctx88(104, "Sinaí Mijares");
      cablearHistoria(sinPac.c, "", true);
      await sinPac.c.api.rcvPendientesTick();
      t.falso(montado88(sinPac.c), "sin cédula en pantalla no hay a quién mostrarle exámenes");

      const sinResumen = ctx88(104, "Sinaí Mijares");
      try { sinResumen.c.api.mtrCacheResumenGuardar("0000000", resumen88(777)); } catch (e) {}   // caché de OTRO paciente
      await sinResumen.c.api.rcvPendientesTick();
      t.falso(montado88(sinResumen.c), "sin resumen del paciente abierto no hay programa al que alinear");
    });

    // ==================== INTEGRACIÓN: DATOS Y REFRESCO ====================
    await t.casoAsync("D4 en vivo: la red caída no oculta pendientes — todo PENDIENTE con la nota honesta", async () => {
      const { c } = ctx88(102, "Eliseth Estrada", { red: crearRed(() => Promise.reject(new Error("red caída"))) });
      await c.api.rcvPendientesTick();
      const w = widget88(c);
      t.cierto(!!w, "el panel sigue montado");
      t.cierto(w.innerHTML.indexOf("Sin órdenes vigentes consultables") >= 0, "la nota lo explica");
      t.falso(w.innerHTML.indexOf("AL DÍA") >= 0, "nada se da por cubierto");
    });

    await t.casoAsync("refresco en vivo: una orden NUEVA cambia la fila sin recargar nada", async () => {
      const { c, red } = ctx88(101, "Brandon Jesús Palencia Martínez");
      await c.api.rcvPendientesTick();
      t.cierto(widget88(c).innerHTML.indexOf("vgl-rcvp-chip-vencido") >= 0, "precondición: había un examen vencido");
      // El médico guarda una orden nueva (marcarOrdenGenerada invalida la caché de T6)
      red.cuerpo = [ordenDe("903815", desdeHoy(-5)), ordenDe("903817", desdeHoy(-179))];
      c.api._ordenesVigentesInvalidar();
      await c.api.rcvPendientesTick();
      const w = widget88(c);
      t.falso(w.innerHTML.indexOf("vgl-rcvp-chip-vencido") >= 0, "ya no está vencido tras la orden nueva");
      t.cierto(w.innerHTML.indexOf("Vence: " + desdeHoy(175)) >= 0, "el vencimiento recalculado aparece");
    });

    await t.casoAsync("sin parpadeo: la firma evita repintar cuando nada cambió, y cambia de paciente limpia el estado", async () => {
      const { c } = ctx88(102, "Eliseth Estrada");
      await c.api.rcvPendientesTick();
      const w = widget88(c);
      w.innerHTML = "MARCA-MANUAL";
      await c.api.rcvPendientesTick();
      t.igual(widget88(c).innerHTML, "MARCA-MANUAL", "el segundo tick con los mismos datos no tocó el DOM");
      // Otro paciente: el panel del anterior no puede quedarse en pantalla
      cablearHistoria(c, "10101010", true);
      try { c.api.mtrCacheResumenGuardar("10101010", resumen88(888)); } catch (e) {}
      await c.api.rcvPendientesTick();
      t.cierto(widget88(c).innerHTML !== "MARCA-MANUAL", "al cambiar de paciente el contenido se renueva");
      t.cierto(widget88(c).style.display === "", "y queda visible para el nuevo paciente");
    });

    await t.casoAsync("anti-cruce: si el paciente cambió mientras salía la consulta, no se pinta nada del anterior", async () => {
      // El vuelo de red resuelve DESPUÉS de que la historia ya cambió de paciente
      const { c } = ctx88(102, "Eliseth Estrada", { red: crearRed((url, responder) => new Promise((res) => setTimeout(() => res(responder()), 25))) });
      const p = c.api.rcvPendientesTick();
      cablearHistoria(c, "20202020", true);   // cambio de paciente a mitad del vuelo
      try { c.api.mtrCacheResumenGuardar("20202020", resumen88(999)); } catch (e) {}
      await p;
      t.falso(montado88(c) === true && widget88(c).innerHTML.indexOf("5150076") >= 0, "nada del paciente anterior en pantalla");
      t.cierto(widget88(c) === null || widget88(c).style.display === "none", "el panel quedó oculto tras el cruce");
    });

    // ============ NAVEGACIÓN DINÁMICA: enganche en tick() y retiro ============
    await t.casoAsync("enganche real: tick() (la ruta de producción) pinta el panel sin llamarlo a mano", async () => {
      const { c } = ctx88(104, "Sinaí Mijares");
      try { c.api.__state.killed = false; } catch (e) {}
      c.api.tick();
      await new Promise((res) => setTimeout(res, 40));
      t.cierto(montado88(c), "el tick de la agenda montó el panel (el hook _rumTramo vive)");
    });

    await t.casoAsync("navegación dinámica: al volver a Citas del día, tick() RETIRA el panel del DOM", async () => {
      const { c } = ctx88(104, "Sinaí Mijares");
      await c.api.rcvPendientesTick();
      t.cierto(montado88(c), "precondición: montado en la historia");
      // El médico vuelve a la agenda: sin #anamesis (el resto de ids SÍ se
      // resuelven — el retiro de tick() consulta getElementById de verdad),
      // marcadores de agenda presentes.
      const getByIdReal = c.env.doc.getElementById.bind(c.env.doc);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? null : getByIdReal(id));
      const qsReal = c.env.doc.querySelector.bind(c.env.doc);
      c.env.doc.querySelector = (sel) => {
        const s = String(sel);
        if (s === c.api.__CONFIG.SEL.hora || s === c.api.__CONFIG.SEL.estado) return { textContent: "8:00 a. m." };
        return qsReal(sel);
      };
      c.api.tick();
      t.falso(montado88(c), "tick() retiró el panel al salir de la historia (no queda flotando sobre Citas del día)");
    });

    // ============================ CSS / REGISTROS ============================
    t.caso("CSS: el panel está registrado en tokens oscuro+claro, modo oculto y zoom — y sus colores llevan !important", () => {
      const code = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8").replace(/\r\n/g, "\n");
      // bloque de hoja que inyecta buildOverlay (mismo corte que suite_25)
      let css = "", inCss = false;
      for (const line of code.split("\n")) {
        if (line.includes("style.textContent = `")) { inCss = true; continue; }
        if (inCss && line.includes("`;")) { inCss = false; break; }
        if (inCss) css += line + "\n";
      }
      t.cierto(css.length > 0, "se extrajo la hoja de buildOverlay");
      const i0 = css.indexOf("\n      #vgl-rcv-pendientes{");
      t.cierto(i0 >= 0, "existe la regla raíz del panel (anclada a línea propia, no a la lista de tokens)");
      const bloque = css.slice(i0, css.indexOf("#vgl-cw-ordenar-btn", i0) > 0 ? css.indexOf("#vgl-cw-ordenar-btn", i0) : i0 + 4000);
      // (a) todo color del bloque lleva !important (CLAUDE.md: vive fuera de #vgl-root)
      const sinMarca = [];
      for (const m of bloque.match(/[^{]+\{[^}]*\}/g) || []) {
        if (/color\s*:/.test(m) && !/color\s*:[^;]*!important/.test(m)) sinMarca.push(m.split("{")[0].trim());
      }
      t.igual(sinMarca.join(", "), "", "ninguna regla de color sin !important");
      // (b) cero animaciones: anti-fatiga, nada parpadea en la periferia
      t.falso(/animation/.test(bloque), "el panel no anima nada");
      // (c) registro en las DOS listas de tokens (oscura y clara) — sin la clara, el tema claro hereda Everest
      t.cierto(/#vgl-chooser-modal,#vgl-rcv-pendientes\{/.test(css), "registrado en la lista de tokens oscura");
      t.cierto(/#vgl-chooser-modal\.light,#vgl-rcv-pendientes\.light\{/.test(css), "y en la clara");
      // (d) modo oculto y zoom de letra también lo cubren
      t.cierto(/body\.vgl-modo-oculto[^{]*#vgl-rcv-pendientes\{display:none !important\}/.test(css), "el modo oculto lo esconde");
      t.cierto(code.indexOf('"#vgl-rcv-pendientes"') > 0, "escala con el tamaño de letra (VGL_FZ_OBJETIVOS)");
      // (e) cada var() que consume el bloque está declarada en la lista de tokens
      const iDark = css.indexOf("#vgl-paquete-modal,#vgl-chooser-modal,#vgl-rcv-pendientes{");
      const tokensDark = css.slice(iDark, css.indexOf("}", css.indexOf("--font-stack", iDark)));
      const varsUsadas = new Set((bloque.match(/var\(--[\w-]+/g) || []).map((s) => s.slice(4).replace(/,.*/, "")));
      const faltantes = [...varsUsadas].filter((v) => tokensDark.indexOf(v + ":") < 0);
      t.igual(faltantes.join(", "), "", "toda variable consumida está declarada (Regla D)");
    });
  },
};
