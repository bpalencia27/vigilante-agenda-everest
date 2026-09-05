"use strict";
// ══════════════════════════════════════════════════════════════════════
// Suite 83 — v18.3 (P13) · Observabilidad de adopción (módulo obs*).
// El tablero cuenta eventos pero no tiene DENOMINADOR ni identidad de
// médico: esta suite fija las piezas de FASE 1 del prompt 07:
//   1.1 identidad de equipo (GM + migración + huella) e identidad de
//       médico hasheada ("m-"+FNV-1a del uid/login validado)
//   1.2 denominador: consulta.abierta/cerrada/elegible (id hasheado)
//   1.3 evento genérico con desenlace {fase, resultado, codigo, ms, n, ctx}
//   1.4 desenlace de avisos (accion|cerrado|…|posterior)
//   1.6 lista blanca ESTRUCTURAL anti-PHI: la prosa y la cédula no caben
//   1.7 contador de perdidos
//   4.4 presupuesto de interrupciones (esPrueba exento, fall-open)
// Todo lo que sale va por la cola existente (vgl_repq) con evento "obs.*"
// y JAMÁS repite las claves del sobre (token/equipo/ver/ts/dia/lote).
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

function redContada() {
  const c = { fetch: 0, gmxhr: 0 };
  return {
    contadores: c,
    fetch: async () => { c.fetch++; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "{}", clone() { return this; } }; },
    gmxhr: (o) => { c.gmxhr++; try { if (o && typeof o.onerror === "function") o.onerror(new Error("red vetada por la prueba")); } catch (e) {} },
  };
}
// La cola viaja en GM como JSON string (repQSave la stringuifica): tolerar
// string u objeto por si el arnés la guarda ya parseada.
function colaObs(env) {
  const r = env.gm["vgl_repq"];
  let q = [];
  try { q = (typeof r === "string") ? JSON.parse(r) : (Array.isArray(r) ? r.slice() : []); } catch (e) { q = []; }
  return (q || []).filter((f) => f && typeof f.evento === "string" && f.evento.indexOf("obs.") === 0);
}
function sembrarMedico(env) {
  env.almacen["vgl_acceso_lista"] = JSON.stringify({ version: "t1", perfiles: { COMPLETO: [{ uid: 101, nombre: "Prueba Uno" }], LABORATORIOS: [] }, blocklist: [] });
  env.almacen["user"] = JSON.stringify({ username: "bpalencia", userIdentity: "x" });
  env.gm["vgl_identidad_medico_cache"] = { bpalencia: { id: 101, name: "Prueba Uno", ts: Date.now() } };
}

module.exports = {
  nombre: "Suite 83 · v18.3 (P13): observabilidad de adopción (obs*)",
  cubre: ["obsIdentidadEquipo", "obsIdentidadMedico", "obsConsultaAbrir", "obsSerializar", "obsEvento", "obsAvisoMostrar", "obsPresupuestoEstado", "obsCatch", "obsPerdidosLeer"],
  async pruebas(t, api, env, cargar) {
    t.cierto(typeof api.obsIdentidadEquipo === "function" && typeof api.obsSerializar === "function" && typeof api.obsEvento === "function", "el módulo obs queda expuesto al arnés (declaraciones function de nivel superior)");
    t.cierto(typeof api.obsFnv1a === "function" && api.obsFnv1a("uid:101").length === 8, "obsFnv1a es determinista y de 8 hex");

    // ── 0 ── el módulo responde y la fila NO pisa el sobre ────────────
    await t.casoAsync("P13·0 — el módulo obs responde directo y la fila NO pisa el sobre", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      const s = c.api.obsSerializar({ fase: "inicio", n: 1, ctx: { k: "v" } });
      ["token", "equipo", "ver", "evento", "ts", "dia", "lote"].forEach((k) => {
        t.cierto(!(k in s), "la fila obs no declara '" + k + "' (reportar la pisa con Object.assign)");
      });
      const ok = c.api.obsEvento("prueba.suite83", { fase: "inicio", n: 1, ctx: { k: "v" } });
      t.cierto(ok === true, "obsEvento encola (reportar devolvió true)");
      const filas = colaObs(c.env).filter((f) => f.evento === "obs.prueba.suite83");
      t.cierto(filas.length === 1, "la fila obs.prueba.suite83 está en la cola (hay " + filas.length + ")");
      const f = filas[0];
      t.cierto(f.fase === "inicio" && f.n === 1 && f.ctx === "k:v", "la fila trae fase/n y ctx como cadena compacta k:v");
      t.cierto(/^m-[0-9a-f]{8}$/.test(f.medico), "la fila lleva la identidad de médico hasheada");
      t.cierto(typeof f.ts === "string" && typeof f.lote === "string" && typeof f.token === "string" && f.token.length > 0, "el sobre (token/ts/lote) lo puso reportar, intacto");
    });

    // ── 1 ── identidad de EQUIPO ──────────────────────────────────────
    await t.casoAsync("P13·1 — identidad de equipo: nace eq-*, persiste en GM y avisa", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      const id = c.api.obsIdentidadEquipo();
      t.cierto(/^eq-[a-z0-9]{6,12}$/.test(id), "sin siembra nace un id eq-* corto (llegó '" + id + "')");
      t.cierto(c.env.gm["vgl_obs_equipo"] === id, "el id persiste en GM (vgl_obs_equipo): sobrevive limpiar los datos del sitio");
      t.cierto(c.api.obsIdentidadEquipo() === id, "la segunda llamada devuelve el mismo id (caché)");
      // v18.3 (P13·R1) — el aviso de nacimiento se DIFIERE un tick (no reentra en
      // reportar mientras otra fila se construye): esperar antes de ver la cola.
      await new Promise((r) => setTimeout(r, 20));
      t.cierto(colaObs(c.env).some((f) => f.evento === "obs.equipo.nuevo"), "nacer un id emite obs.equipo.nuevo (distingue equipo nuevo de bug: el dato que faltaba tras los 48 ids/14 días)");
    });
    await t.casoAsync("P13·1b — el ajuste manual (S.equipo) sigue mandando", async () => {
      // S se lee de localStorage["vgl_cfg"] al evaluar el IIFE: la semilla va
      // en la opción `almacen` de cargar(), ANTES de que el script corra.
      const c = await cargar({ silencioso: true, almacen: { "vgl_cfg": JSON.stringify({ equipo: "consultorio-3", reporte: true, uxTelemetria: true }) } });
      t.cierto(c.api.obsIdentidadEquipo() === "consultorio-3", "S.equipo (Ajustes) tiene prioridad sobre todo (llegó '" + c.api.obsIdentidadEquipo() + "')");
      t.cierto(c.api._equipoId() === "consultorio-3", "_equipoId delega en obsIdentidadEquipo: la telemetría v15 y la obs comparten identidad");
    });
    await t.casoAsync("P13·1c — migración del legado localStorage y recuperación por huella", async () => {
      const a = await cargar({ silencioso: true });
      a.env.almacen["vgl_equipo_id"] = "eq-legacy99";   // v12.6.9: id viejo en localStorage
      const id = a.api.obsIdentidadEquipo();
      t.cierto(id === "eq-legacy99", "el id legado de localStorage se MIGRA (no se genera otro): llegó '" + id + "'");
      t.cierto(a.env.gm["vgl_obs_equipo"] === "eq-legacy99", "y queda persistido en GM");
      t.cierto(/^[0-9a-f]{8}$/.test(a.api.obsHuellaEquipo()), "la huella de equipo es un FNV de 8 hex");
      const b = await cargar({ silencioso: true });
      const fp = b.api.obsHuellaEquipo();
      b.env.gm["vgl_obs_equipo_fp"] = {}; b.env.gm["vgl_obs_equipo_fp"][fp] = "eq-recuperado";
      t.cierto(b.api.obsIdentidadEquipo() === "eq-recuperado", "sin id persistente, la huella recupera el id (mismo consultorio, mismo equipo)");
    });

    // ── 2 ── identidad de MÉDICO: hasheada, nunca el crudo ────────────
    await t.casoAsync("P13·2 — identidad de médico viaja SOLO como hash m-xxxxxxxx", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      const m = c.api.obsIdentidadMedico();
      t.cierto(/^m-[0-9a-f]{8}$/.test(m), "identidad de médico con formato m-<hash8> (llegó '" + m + "')");
      t.cierto(m === "m-" + c.api.obsFnv1a("uid:101"), "es el FNV-1a del identificador validado (uid:101), determinista");
      const c2 = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      t.cierto(c2.api.obsIdentidadMedico() === "", "sin identidad validada no se inventa nada (casilla vacía)");
    });

    // ── 3 ── DENOMINADOR: la consulta ─────────────────────────────────
    await t.casoAsync("P13·3 — consulta.abierta: id hasheado, dedup 5 min, reemplazo cierra", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      const CEDULA = "1020304050";
      const id1 = c.api.obsConsultaAbrir(CEDULA);
      t.cierto(/^[0-9a-f]{8}$/.test(id1) && id1 !== CEDULA, "el id de consulta es el HASH de la clave (la cédula no sale)");
      t.cierto(colaObs(c.env).filter((f) => f.evento === "obs.consulta.abierta").length === 1, "abrir la primera consulta emite UNA fila consulta.abierta");
      const id2 = c.api.obsConsultaAbrir(CEDULA);
      t.cierto(id2 === id1, "re-leer el mismo paciente dentro de la ventana NO crea consulta nueva");
      t.cierto(colaObs(c.env).filter((f) => f.evento === "obs.consulta.abierta").length === 1, "y sigue habiendo una sola fila abierta");
      const id3 = c.api.obsConsultaAbrir("9876543210");
      t.cierto(id3 !== id1, "un paciente distinto abre OTRA consulta");
      t.cierto(colaObs(c.env).some((f) => f.evento === "obs.consulta.cerrada" && f.ctx === "motivo:reemplazada"), "abrir la nueva cierra la anterior (motivo:reemplazada)");
      t.cierto(colaObs(c.env).every((f) => JSON.stringify(f).indexOf(CEDULA) < 0), "la cédula cruda no aparece en NINGUNA fila de la cola");
      t.cierto(c.api.obsConsultaCerrar("manual") === true, "cerrar a mano devuelve true");
      t.cierto(c.api.obsConsultaCerrar("manual") === false, "cerrar dos veces devuelve false (ya estaba cerrada)");
    });
    await t.casoAsync("P13·3b — elegible por módulo: una sola vez, y el uso marca fase fin", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      c.api.obsConsultaAbrir("1020304050");
      t.cierto(c.api.obsConsultaElegible("Pym") === true, "el paciente elegible de PyM se marca (mayúsculas indiferentes)");
      t.cierto(c.api.obsConsultaElegible("pym") === false, "marcarlo dos veces no duplica el denominador");
      t.cierto(colaObs(c.env).filter((f) => f.evento === "obs.consulta.elegible.pym").length === 1, "una sola fila consulta.elegible.pym");
      t.cierto(c.api.obsConsultaMarcarModulo("pym", "ok", { n: 3 }) === true, "marcar el uso del módulo encola");
      const fila = colaObs(c.env).filter((f) => f.evento === "obs.modulo.pym").pop();
      t.cierto(!!fila && fila.fase === "fin" && fila.resultado === "ok" && fila.n === 3, "la fila modulo.pym trae fase:fin, resultado:ok y n:3");
      const sinConsulta = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      t.cierto(sinConsulta.api.obsConsultaElegible("pym") === false, "sin consulta abierta no hay denominador que marcar");
    });

    // ── 4 ── enums, ms, n y acción inválida ───────────────────────────
    await t.casoAsync("P13·4 — la lista blanca descarta lo que no conoce y cuenta los perdidos", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      t.cierto(c.api.obsEvento("accion invalida", {}) === false, "una acción con espacio se rechaza (return false)");
      t.cierto(c.api.obsEvento("ok", { resultado: "rarísimo", ms: 1500, n: 2, fase: "INICIO" }) === true, "la acción válida pasa aunque el resultado no se conozca");
      const f = colaObs(c.env).filter((x) => x.evento === "obs.ok").pop();
      t.cierto(!!f && f.resultado === "" && f.ms === 1500 && f.n === 2 && f.fase === "inicio", "resultado desconocido descartado; ms/n/fase sí viajan");
      const s = c.api.obsSerializar({ ms: -5, n: 1e12, codigo: "cup.2020" });
      t.cierto(s.ms === 0 && s.n === 1000000 && s.codigo === "cup.2020", "ms negativo se aplana a 0, n desbordado se recorta al tope y el código corto pasa");
      const p = c.api.obsPerdidosLeer();
      t.cierto(p.dia === api.todayStamp() && p.n >= 1 && p.motivos.accion_invalida >= 1, "el rechazo quedó contado como perdido del día con su motivo");
    });

    // ── 5 ── avisos: mostrar → desenlace ──────────────────────────────
    await t.casoAsync("P13·5 — desenlace de avisos: id local, ms y enums cerrados", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      const id = c.api.obsAvisoMostrar({ ab: 1, pym: 2, labs: 0, ad: 0, pr: 1 });
      t.cierto(/^a\d+$/.test(id), "obsAvisoMostrar devuelve un id local a<N>");
      const mo = colaObs(c.env).filter((f) => f.evento === "obs.aviso.mostrado").pop();
      t.cierto(!!mo && mo.fase === "inicio" && mo.ctx.indexOf("ab:1") >= 0 && mo.ctx.indexOf("pym:2") >= 0, "la fila aviso.mostrado trae fase inicio y el resumen del aviso");
      t.cierto(c.api.obsAvisoDesenlace(id, "accion") === true, "cerrar con Entendido encola el desenlace");
      const d = colaObs(c.env).filter((f) => f.evento === "obs.aviso.desenlace").pop();
      t.cierto(!!d && d.ctx === "d:accion" && typeof d.ms === "number" && d.ms >= 0, "desenlace accion con su tiempo de reacción");
      t.cierto(c.api.obsAvisoDesenlace("a999", "chisme") === false, "un desenlace fuera del enum se ignora (false, sin fila)");
      const id2 = c.api.obsAvisoMostrar({});
      t.cierto(c.api.obsAvisoCumplido(id2) === true, "obsAvisoCumplido registra 'posterior' (la métrica de oro: el médico hizo después por su cuenta)");
      t.cierto(colaObs(c.env).filter((f) => f.evento === "obs.aviso.desenlace" && f.ctx === "d:posterior").length === 1, "y la fila dice d:posterior");
    });

    // ── 6 ── CANARIO PHI ESTRUCTURAL ──────────────────────────────────
    await t.casoAsync("P13·6 — canario PHI: ni nombre, ni cédula, ni nota clínica salen del equipo", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      c.api.obsEvento("prueba.canario", { ctx: { nombre: "María Fernanda", doc: "1.020.304.050", nota: "refiere dolor torácico", tel: "3104567890", estado: "ok", nivel: 2 } });
      const bruto = JSON.stringify(colaObs(c.env).filter((f) => f.evento === "obs.prueba.canario"));
      t.cierto(bruto.indexOf("María") < 0 && bruto.indexOf("Fernanda") < 0, "un nombre con espacio NO cabe en ctx (prosa fuera)");
      t.cierto(bruto.indexOf("1.020.304.050") < 0 && bruto.indexOf("1020304050") < 0, "la cédula (con o sin puntos) NO cabe: solo-números largos fuera");
      t.cierto(bruto.indexOf("3104567890") < 0, "un celular NO cabe");
      t.cierto(bruto.indexOf("torácico") < 0 && bruto.indexOf("dolor") < 0, "la nota clínica NO cabe");
      t.cierto(bruto.indexOf("estado:ok") >= 0 && bruto.indexOf("nivel:2") >= 0, "lo legítimo (enum corto, número) SÍ pasa");
      t.cierto(c.api.obsPerdidosLeer().n >= 4, "cada campo bloqueado quedó contado como perdido (visibilidad, no silencio)");
    });

    // ── 7 ── presupuesto de interrupciones ────────────────────────────
    await t.casoAsync("P13·7 — presupuesto: tope por equipo y día, cambia el día cambia el tope", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      const est0 = c.api.obsPresupuestoEstado();
      t.cierto(est0.limite === 6 && est0.usados === 0 && est0.permite === true, "por defecto el tope es 6 por equipo y día (medido: ≈72/día reales)");
      let huboFalse = false;
      for (let i = 0; i < 6; i++) { if (!c.api.obsPresupuestoConsumir()) huboFalse = true; }
      t.cierto(!huboFalse && c.api.obsPresupuestoEstado().usados === 6, "seis avisos se sirven sin protestar");
      t.cierto(c.api.obsPresupuestoConsumir() === false, "el séptimo del día ya no interrumpe");
      const c2 = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      c2.env.gm["vgl_obs_presupuesto"] = { dia: api.todayStamp(), usados: 99 };
      t.cierto(c2.api.obsPresupuestoEstado().permite === false && c2.api.obsPresupuestoConsumir() === false, "sembrado agotado para HOY: no permite");
      const c3 = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      c3.env.gm["vgl_obs_presupuesto"] = { dia: "2000-01-01", usados: 99 };
      t.cierto(c3.api.obsPresupuestoEstado().permite === true && c3.api.obsPresupuestoConsumir() === true, "el consumo de AYER no cuenta: cambia el día, cambia el presupuesto");
    });

    // ── 8 ── obsCatch no revienta y el cableado está en la fuente ─────
    await t.casoAsync("P13·8 — obsCatch con código fijo y cableado por fuente", async () => {
      const c = await cargar({ silencioso: true });
      t.cierto(c.api.obsCatch("codigo raro!!", new Error("mensaje con PHI del paciente")) === true, "obsCatch sanea el código y nunca deja pasar el mensaje");
      t.cierto(typeof api.obsConsultaCerrar === "function" && typeof api.obsConsultaElegible === "function" && typeof api.obsAvisoDesenlace === "function" && typeof api.obsAvisoCumplido === "function" && typeof api.obsConsultaMarcarModulo === "function" && typeof api.obsPerdidosSumar === "function" && typeof api.obsPresupuestoConsumir === "function" && typeof api.obsHuellaEquipo === "function" && typeof api.obsModuloLimpio === "function" && typeof api.obsGmLeer === "function" && typeof api.obsGmGuardar === "function" && typeof api.obsConsultaActiva === "function", "el resto del módulo obs está expuesto y es invocable");
      t.cierto(FUENTE.indexOf("obsConsultaAbrir(docId)") >= 0, "el denominador cuelga del auto-fetch del paciente abierto (autoFetchAtheneaLabs)");
      t.cierto(FUENTE.indexOf("if (!esPrueba && !obsPresupuestoConsumir()) return;") >= 0, "el presupuesto vela la puerta del aviso universal y exime a las pruebas");
      t.cierto(FUENTE.indexOf('obsAvisoDesenlace(avisoObsId, "accion")') >= 0 && FUENTE.indexOf("obsAvisoMostrar({ ab:") >= 0, "el aviso universal emite mostrado y desenlace");
      t.cierto(/function _equipoId\(\) \{[\s\S]{0,600}obsIdentidadEquipo\(\)/.test(FUENTE), "_equipoId delega en obsIdentidadEquipo (misma identidad en telemetría v15 y obs)");
      t.cierto(FUENTE.indexOf("obs_perdidos") >= 0, "el entorno diario reporta el contador de perdidos");
    });
  }
};
