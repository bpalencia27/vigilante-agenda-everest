// =====================================================================
//  SUITE 89 — Medidas del enjambre de notificaciones (NT-101…NT-128)
//
//  POR QUÉ EXISTE: la auditoría de notificaciones (AUDITORIA/REGISTRO_
//  NOTIFICACIONES.md) dejó 28 hallazgos y un plan M1-M22. Cada medida
//  de comportamiento que se aplicó el 07-sep-2026 tiene aquí el caso
//  que la caza — nacido del hallazgo que la motivó, no de la imaginación.
//  Regla del proyecto: un cambio sin prueba que lo cace es un cambio
//  que ya se perdió.
// =====================================================================
const esperar89 = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

module.exports = {
  nombre: "Medidas del enjambre NT (M1-M22)",
  cubre: [
    "avisoUniversal", "obsPresupuestoReembolsar", "avisoOlvidar", "osNotify",
    "_notificarSistema", "_encolarAvisoPendiente", "_dispararAvisoAudible",
    "_vglTopeHora", "maybeNotify", "avisoPacHistPodar", "muted", "_renderToast",
  ],

  async pruebas(t, api, env, cargar) {
    function conAudio(c) {
      const tonos = [];
      c.env.win.AudioContext = function () {
        this.state = "running"; this.currentTime = 0; this.destination = {};
        this.createOscillator = () => ({ connect() {}, frequency: {}, start() { tonos.push(this.frequency.value); }, stop() {} });
        this.createGain = () => ({ connect() {}, gain: { setValueAtTime() {} } });
        this.resume = () => {};
      };
      return tonos;
    }
    function montarBandeja(c) {
      const doc = c.env.doc;
      const crearBase = doc.createElement;
      doc.createElement = function (tag) {
        const e = crearBase.call(doc, tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc.createElement("div")); return memo.get(sel); };
        e.prepend = (h) => e.insertBefore(h);
        return e;
      };
      const wrap = doc.createElement("div");
      wrap.id = "vgl-toasts";
      doc.body.appendChild(wrap);
      return wrap;
    }

    // ── M1 (NT-101): el presupuesto NUNCA calla lo R=3 ─────────────────
    t.caso("M1/NT-101: presupuesto agotado calla PyM (R≤2) pero NUNCA al abandono RCV (R=3)", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.obsPresupuestoAvisos = 1;   // cupo para UN aviso en el día
      const r1 = c.api.avisoUniversal("PAC SIM A", { pym: ["Citología"] }, false, "avisouniv|a");
      t.cierto(r1 === true, "el primer aviso (R=2) consume el único cupo y se muestra");
      const r2 = c.api.avisoUniversal("PAC SIM B", { pym: ["Mamografía"] }, false, "avisouniv|b");
      t.cierto(r2 === false, "presupuesto agotado: el segundo R=2 no sale (tope cumpliendo su función)");
      const r3 = c.api.avisoUniversal("PAC SIM C", { abandono: true }, false, "avisouniv|c");
      t.cierto(r3 === true, "pero el ABANDONO RCV (R=3, axioma §1.1) pasa SIEMPRE: el presupuesto no puede silenciar la prioridad máxima del médico");
    });

    // ── M2 (NT-102): solo se marca visto si se pintó; carrera de 2 pestañas ──
    t.caso("M2/NT-102: el modal que pierde la carrera de pestañas no pinta ni gasta cupo", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.obsPresupuestoAvisos = 1;
      const uid = "avisouniv|carrera";
      c.api.avisoMarcarVisto(uid);   // la OTRA pestaña se adelantó
      const res = c.api.avisoUniversal("PAC SIM", { pym: ["Colon"] }, false, uid);
      t.cierto(res === false, "la carrera perdida devuelve false: el llamador NO marcará visto doble");
      t.cierto(c.env.win.document._nodos.filter((n) => n._parent && n.id === "vgl-pym-modal").length === 0, "y no pintó ningún modal en el DOM (solo lo creó en memoria, sin colgarlo)");
    });

    // ── M3 (NT-104/105): osNotify no quema el aviso sin canal ──────────
    await t.casoAsync("M3/NT-104: SO suprimido + fallback bloqueado → la marca se REVIERTE (no queda contado y nunca visto)", async () => {
      const c = cargar({ silencioso: true });
      const capturadas = [];
      function N(t2, o) { capturadas.push(o); this.close = () => {}; this.onclick = null; }   // NUNCA dispara onshow
      N.permission = "granted";
      c.env.win.Notification = N;
      c.env.win.location.pathname = "/viva/OtraPantalla/";   // fuera de HCHealth: el fallback toast está vetado
      c.env.doc.visibilityState = "hidden";
      c.api.osNotify("AMBAR", "t", "b", false, "revert-1");
      await esperar89(30);   // la escalada de 1,6 s corre acelerada en el arnés
      t.cierto(c.api.avisoYaVisto("revert-1") === false, "la marca de visto se revirtió: el aviso puede volver a dispararse (antes quedaba quemado el resto de la jornada)");
    });

    t.caso("M3/NT-104: sin permiso del sitio y fuera de HCHealth, NO se marca visto", () => {
      const c = cargar({ silencioso: true });
      c.env.win.Notification = undefined;
      c.env.win.location.pathname = "/viva/OtraPantalla/";
      c.api.osNotify("AMBAR", "t", "b", false, "noperm-1");
      t.cierto(c.api.avisoYaVisto("noperm-1") === false, "no gastó el aviso del día en un canal que no podía pintar");
    });

    // ── M9 (NT-106): el canal del SO sale SIN nombre del paciente ──────
    t.caso("M9/NT-106: el cuerpo del SO identifica por HORA, sin nombre ni cédula (Ley 1581 art. 3-4)", () => {
      const c = cargar({ silencioso: true });
      const capturadas = [];
      c.ctx.Notification = class { constructor(t2, o) { capturadas.push([t2, (o && o.body) || ""]); } static get permission() { return "granted"; } close() {} };
      c.env.doc.visibilityState = "hidden";
      c.api._dispararAvisoAudible({ uid: "so-phi-1", color: "AMBAR", title: "⚠ 8:20 a. m. · Sin presentarse", body: "PAC SIM CUATRO (1122334455)\nVenció el tiempo", persist: true, soBody: "Paciente de la cita de las 8:20 a. m..\nVenció el tiempo de confirmación", flashText: "f", hora: "8:20 a. m.", estado: "Sin presentarse" });
      t.cierto(capturadas.length === 1, "montaje: salió por el sistema");
      t.falso(/PAC SIM/.test(capturadas[0][1]), "el cuerpo que ve Windows NO lleva el nombre: " + capturadas[0][1]);
      t.falso(/1122334455/.test(capturadas[0][1]), "ni la cédula");
      t.cierto(/Paciente de la cita de las 8:20/.test(capturadas[0][1]), "la cita se identifica por su hora");
      delete c.ctx.Notification;
    });

    // ── M10+Q3 (NT-107/NT-125): cola sin PHI, purga por tiempo, ROJO 30 min ──
    t.caso("M10/NT-107: la cola localStorage guarda SIN nombre ni cédula, y purga lo vencido al escribir", () => {
      const almacen = {};
      const c = cargar({ silencioso: true, almacen });
      const hace31min = Date.now() - 31 * 60 * 1000;
      almacen["vgl_avisos_pendientes"] = JSON.stringify([{ color: "ROJO", title: "viejo", uid: "viejo|1", ts: hace31min }]);
      c.api._encolarAvisoPendiente({ color: "ROJO", title: "⛔ 9:00 · Extemporánea", body: "PAC SIM (998877)\nDetalle", hora: "9:00", estado: "En Sala", uid: "nuevo|1", persist: true, apptKey: "998877@9:00", flashText: "f", ts: Date.now() });
      const cola = JSON.parse(almacen["vgl_avisos_pendientes"]);
      t.cierto(cola.length === 1, "el ROJO de hace 31 min caducó (Q3: 30 min) y salió al escribir");
      t.cierto(cola[0].uid === "nuevo|1", "el nuevo quedó");
      t.falso("body" in cola[0], "la cola NO guarda el cuerpo con PHI");
      t.falso(/PAC SIM/.test(almacen["vgl_avisos_pendientes"]) || /9988776/.test(almacen["vgl_avisos_pendientes"]), "ni nombre ni cédula en el JSON persistido");
      t.cierto(cola[0].hora === "9:00" && cola[0].estado === "En Sala", "hora y estado viajan aparte para reconstruir el cartel");
    });

    // ── M13 (regla de oro, AJUSTADA al invariante v14.1.5 del banco) ──
    t.caso("M13: un VERDE no gasta el SO con la pestaña VISIBLE fuera de HCHealth; desatendida, el SO es su único canal", () => {
      const c = cargar({ silencioso: true });
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.win.location.pathname = "/viva/OtraPantalla/";
      const res = c.api._dispararAvisoAudible({ uid: "verde-vis-1", color: "VERDE", title: "t", body: "b", flashText: "f", persist: false });
      t.cierto(res === true, "visible y fuera del módulo clínico, el aviso se cuenta como disparado (la fila verde es su C0)");
      t.igual(os, 0, "cero notificaciones de Windows con la pestaña visible: el SO queda para lo que de verdad alcanza al médico");
      c.env.doc.visibilityState = "hidden";
      const res2 = c.api._dispararAvisoAudible({ uid: "verde-oculto-1", color: "VERDE", title: "t", body: "b", flashText: "f", persist: false });
      t.cierto(res2 === true, "y desatendida también se cuenta como disparado");
      t.igual(os, 1, "con la pestaña desatendida el VERDE SÍ sale al SO: es su único canal (invariante v14.1.5 — no se calla el canal restante)");
    });

    // ── M4+Q2 (NT-109): silencio compartido; el tono del ROJO exento ───
    t.caso("M4/NT-109a: el silencio de una pestaña lo ve la otra (localStorage compartido)", () => {
      const almacen = {};
      const A = cargar({ silencioso: true, almacen });
      A.api.muteFor(15);
      t.cierto(/vgl_mute_hasta/.test(Object.keys(almacen).join(",")), "el sello quedó en localStorage");
      const B = cargar({ silencioso: true, almacen });
      t.cierto(B.api.muted() === true, "la pestaña B nace silenciada por el sello de A (antes: cada una con su reloj)");
    });

    t.caso("Q2/NT-109b: el tono del ROJO suena DENTRO del silencio temporal (forzar, edge único por cita)", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = false;                          // incluso con el sonido apagado...
      c.api.__S.insistir = false;
      c.api.__state.muteUntil = Date.now() + 60000;      // ...y silencio activo
      c.api._dispararAvisoAudible({ uid: "rojo-mute-1", color: "ROJO", title: "t", body: "b", flashText: "f", persist: true });
      t.cierto(tonos.length >= 2, "el ROJO sonó igual: su única oportunidad no se pierde en un «Silenciar 15 min»");
      const tonos2 = conAudio(c); tonos2.length = 0;
      c.api._dispararAvisoAudible({ uid: "morado-mute-1", color: "MORADO", title: "t", body: "b", flashText: "f", persist: false });
      t.igual(tonos2.length, 0, "y el MORADO sigue respetando el silencio, como siempre");
    });

    // ── M5 (NT-108): el «3+ PyM» avisado con tope y sin tono ───────────
    t.caso("M5/NT-108: 3+ PyM avisa UNA vez por cita (silencioso), con tope 3/hora", () => {
      const c = cargar({ silencioso: true });
      conAudio(c);
      const wrap = montarBandeja(c);
      c.api.__S.sonido = true; c.api.__S.insistir = true;
      c.api.__state.muteUntil = 0;
      const mk = (key, doc) => ({ color: "MORADO", reason: "pym", key, apptKey: key, hora_texto: "8:00 a. m.", estado: "Agendada", nombre: "PAC SIM", doc_id: doc, arrival: false, sound: false });
      // siembra: la primera observación (prev indefinido) no avisa
      c.api.maybeNotify(mk("111@8:00", "111"));
      t.cierto(c.api.avisoYaVisto("pym3|111@8:00") === false, "el primer avistamiento no gasta el aviso (siembra silenciosa)");
      // transición real: AZUL → MORADO-pym
      c.api.__state.notified.set("111@8:00", "AZUL");
      c.api.maybeNotify(mk("111@8:00", "111"));
      t.cierto(c.api.avisoYaVisto("pym3|111@8:00") === true, "la transición real marca el aviso (una vez por cita y jornada)");
      // la misma cita no vuelve a avisar
      c.api.__state.notified.set("111@8:00", "AZUL");
      c.api.maybeNotify(mk("111@8:00", "111"));
      // tope: 3/hora entre citas distintas
      let avisados = 1;   // el 111 ya avisó
      for (const doc of ["222", "333", "444", "555"]) {
        const key = doc + "@8:00";
        c.api.__state.notified.set(key, "AZUL");
        c.api.__state.notified.delete(key);
        c.api.__state.notified.set(key, "AZUL");
        const antes = c.api.avisoYaVisto("pym3|" + key);
        c.api.maybeNotify(mk(key, doc));
        if (c.api.avisoYaVisto("pym3|" + key) && !antes) avisados++;
      }
      t.cierto(avisados === 3, "el tope de 3/hora contuvo la ráfaga (avisados: " + avisados + ")");
    });

    // ── M15 (NT-115): toasts accesibles ────────────────────────────────
    t.caso("M15/NT-115: el toast crítico anuncia por role=alert y se cierra con teclado", () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandeja(c);
      c.api._renderToast("AMBAR", "Inasistencia", "b", true, "999@9:00");
      const nodo = wrap.children[0];
      t.cierto(!!nodo, "montaje: el toast se pintó");
      t.cierto(nodo.getAttribute("role") === "alert", "lo crítico anuncia por alert (assertive), no polite");
      t.cierto(nodo.tabIndex === 0, "es enfocable con Tab");
      t.cierto(!!(nodo._listeners && nodo._listeners.keydown && nodo._listeners.keydown.length), "y escucha el teclado (Esc/Enter cierran)");
      c.api._renderToast("AZUL", "Rutinario", "b", false);
      t.cierto(wrap.children[1] && wrap.children[1].getAttribute("role") === "status", "lo rutinario sigue siendo status (polite)");
    });

    // ── M21 (NT-123): purga temporal del histórico ─────────────────────
    t.caso("M21/NT-123: el histórico de pacientes nuevos purga los ts de hace más de 90 días, aunque no esté lleno", () => {
      const c = cargar({ silencioso: true });
      const hoy = Date.now();
      const docs = { viejo: hoy - 91 * 24 * 3600 * 1000, fresco1: hoy - 3600000, fresco2: hoy - 7200000 };
      const out = c.api.avisoPacHistPodar(docs);
      t.cierto(!!out && !("viejo" in out), "el registro de hace 91 días salió (antes vivía para siempre si el conteo no llegaba a 2000)");
      t.cierto("fresco1" in out && "fresco2" in out, "los recientes se conservan");
    });

    // ── M16 (NT-110): contraste AAA del aviso del kill-switch ──────────
    t.caso("M16/NT-110: la pausa clínica usa el par fijo #991b1b/#ffffff (8,31:1) y role=alert", () => {
      const i = FUENTE.indexOf('id = "vgl-pausa-clinica"');
      t.cierto(i > 0, "existe el aviso de pausa clínica");
      const bloque = FUENTE.slice(i, i + 1600);
      t.cierto(/background:#991b1b/.test(bloque), "fondo #991b1b fijo: ya no depende de tokens que resolvían 2,31:1");
      t.cierto(/color:#ffffff !important/.test(bloque), "texto #ffffff fijo (8,31:1 — AAA)");
      t.cierto(/setAttribute\("role", "alert"\)/.test(bloque), "y anuncia por role=alert");
    });

    // ── M17 (NT-116/117/126): tokens, 12px, reduced-motion ────────────
    t.caso("M17/NT-117: los z-index de avisos ya no son literales sueltos", () => {
      // Se descuenta el contenido de comentarios /* */ y // (el archivo documenta
      // valores viejos en prosa): lo que se audita es CSS/JS vivo, no su historia.
      const vivos = [];
      let enBloque = false;
      for (const l of FUENTE.split("\n")) {
        const sinBloques = [];
        let resto = l;
        while (resto.length) {
          if (enBloque) {
            const fin = resto.indexOf("*/");
            if (fin < 0) { resto = ""; break; }
            enBloque = false; resto = resto.slice(fin + 2);
          } else {
            const ini = resto.indexOf("/*");
            const lin = resto.indexOf("//");
            const corte = (ini >= 0 && (lin < 0 || ini < lin)) ? ini : lin;
            if (corte >= 0) {
              sinBloques.push(resto.slice(0, corte));
              if (corte === ini) { enBloque = true; resto = resto.slice(ini + 2); } else break;
            } else { sinBloques.push(resto); break; }
          }
        }
        const vivo = sinBloques.join("");
        if (/z-index:\s*2\d{9}/.test(vivo)) vivos.push(vivo.trim().slice(0, 60));
      }
      // .vgl-sp-toast conserva su literal a propósito (Regla J de suite_25: fuera del
      // alcance de D6) — es el ÚNICO literal 2xxxxxxxx permitido en la hoja.
      const vivosSp = vivos.filter((l) => !/vgl-sp-toast/.test(l));
      t.igual(vivos.length, 1, "un único z-index literal 2xxxxxxxx en código vivo (.vgl-sp-toast, permitido por la Regla J): " + JSON.stringify(vivos));
      t.igual(vivosSp.length, 0, "todo lo demás del sistema de avisos va por tokens --z-*");
    });
    t.caso("M17/NT-116: los textos informativos de PyM suben a 12px por token, sin literales", () => {
      t.cierto(/--t-nano:10px/.test(FUENTE), "la escala v18.0.124 se respeta: --t-nano sigue siendo 10px (token de densidad, no de lectura)");
      t.cierto(!/\.vgl-pym-t\{font-size:1[01](\.5)?px/.test(FUENTE), ".vgl-pym-t ya no es 10/11/11,5px");
      t.cierto(/\.vgl-pym-t\{font-size:var\(--t-micro\)/.test(FUENTE), "sube a var(--t-micro) (12px) por token, sin literal");
      t.cierto(/\.vgl-pym-lead\{font-size:var\(--t-micro\)/.test(FUENTE), ".vgl-pym-lead también a var(--t-micro)");
    });
    t.caso("M17/NT-126: el parpadeo respeta prefers-reduced-motion (salvo el ROJO, que es señal)", () => {
      const i = FUENTE.indexOf("function startFlash");
      const bloque = FUENTE.slice(i, i + 900);
      t.cierto(/prefers-reduced-motion/.test(bloque), "startFlash consulta la preferencia del sistema");
      t.cierto(/color !== "ROJO"/.test(bloque), "y el ROJO la conserva: es su única señal fuera de la pestaña");
    });

    // ── M22 (NT-124): los términos declaran el pipeline de avisos ─────
    t.caso("M22/NT-124: TERMINOS v1.3 declara los avisos/notificaciones (T-47)", () => {
      const i = FUENTE.indexOf("### T-47");
      t.cierto(i > 0, "existe la cláusula T-47 · Avisos y notificaciones");
      const bloque = FUENTE.slice(i, i + 1200);
      t.cierto(/NO llevan nombre ni documento/.test(bloque), "declara que el SO no lleva identificación del paciente");
      t.cierto(/90 días/.test(bloque), "declara la purga temporal del histórico local");
      t.cierto(/vgl_avisos_pendientes|cola temporal/.test(bloque), "declara la cola pendiente sin PHI");
      t.cierto(/bitácora local/.test(bloque), "y declara el alcance de la bitácora local");
    });

    // ── NT-122 (verificación externa): repFlush con variables declaradas ──
    t.caso("NT-122: repFlush declara sus contadores (ReferenceError corregido)", () => {
      const i = FUENTE.indexOf("async function repFlush");
      const bloque = FUENTE.slice(i, i + 1400);
      t.cierto(/let enviadas = 0, fallo = false/.test(bloque), "enviadas/fallo están declaradas con let (el hallazgo NT-122 quedó cerrado)");
    });

    // ── M7 (NT-119): guard post-teardown en el .then del API ───────────
    t.caso("M7/NT-119: la respuesta en vuelo del API muere con el teardown", () => {
      const i = FUENTE.indexOf("apiLeerAgenda().then");
      const bloque = FUENTE.slice(i, i + 260);
      t.cierto(/state\.killed/.test(bloque), "el .then mira state.killed antes de tocar avisos o presupuesto");
    });

    // ── M19 (NT-118): uid explícito del PyM actualizado ────────────────
    t.caso("M19/NT-118: el aviso «PyM del día cargado/actualizado» lleva uid explícito por día y tipo", () => {
      const i = FUENTE.indexOf('"pymupd|" + todayStamp()');
      t.cierto(i > 0, "el uid ya no depende del hash del texto (contador cambiante = aviso nuevo sin tope)");
    });
  },
};
