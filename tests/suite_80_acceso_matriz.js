// =====================================================================
//  SUITE 80 — MATRIZ DE ACCESO PERFIL×CAPACIDAD×CAPA + TELEMETRÍA B6
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que para los 4 perfiles
//  (PÚBLICO, LABORATORIOS, COMPLETO, BLOQUEADO) las 13 capacidades
//  resuelvan IGUAL en la capa a/b (accesoCap: la UI no se construye y
//  el modal no abre) y en la capa c (accesoEscribir: nada sale a la
//  red), y que las denegaciones de ESCRITURA dejen rastro agregado y
//  SIN PHI para el tablero — sin contar las capas a/b, que suenan
//  solas en cada tick y son el estado normal, no un incidente.
//
//  Las 13 capacidades: 2 públicas (psic_odonto, pym — entrevista
//  1C/2B) + 7 de LABORATORIOS + 4 solo-COMPLETO. La matriz completa es
//  4×13 = 52 celdas por capa; aquí se recorre entera dos veces (capa
//  a/b y capa c) más la delegación c→a/b.
//
//  NOTA DE BANCO: cada cargar() ejecuta el IIFE en una VM nueva, así
//  que los contadores en memoria de cada caso viven y mueren con SU
//  instancia — no hace falta (ni sirve) resetear entre casos.
// =====================================================================

"use strict";

const LISTA_OK = {
  version: "2026-09-04.1",
  emitida: "2026-09-04T08:00:00",
  perfiles: {
    COMPLETO: [{ uid: 101, nombre: "Brandon Jesús Palencia Martínez" }],
    LABORATORIOS: [{ uid: 201, nombre: "Maryuris Terán" }],
  },
  blocklist: [{ uid: 999, nombre: "Prueba Bloqueada", motivo: "banco" }],
};

const CAPS_PUBLICAS = ["psic_odonto", "pym"];
const CAPS_LABS = ["centinela", "notificaciones", "agendar_labs", "laboratorios",
  "widget_examen_normal", "widget_examenes_autolabs", "aviso_paciente_nuevo"];
const CAPS_SOLO_COMPLETO = ["agendar_control", "panel_paciente", "redactor_ia", "rcv"];
const LAS_13 = CAPS_PUBLICAS.concat(CAPS_LABS, CAPS_SOLO_COMPLETO);

// uid, nombre y matriz esperada (qué capacidades SÍ tiene cada perfil).
const PERFILES = [
  { uid: 101, nombre: "Brandon Jesús Palencia Martínez", perfil: "COMPLETO",
    si: LAS_13.slice() },
  { uid: 201, nombre: "Maryuris Terán", perfil: "LABORATORIOS",
    si: CAPS_PUBLICAS.concat(CAPS_LABS) },
  { uid: 555, nombre: "Fuera Del Padrón", perfil: "PUBLICO",
    si: CAPS_PUBLICAS.slice() },
  { uid: 999, nombre: "Prueba Bloqueada", perfil: "BLOQUEADO",
    si: [] },
];

function almPadron(extra) {
  const a = { vgl_acceso_lista: JSON.stringify(LISTA_OK) };
  if (extra) Object.assign(a, extra);
  return a;
}

function conDoctor(api, id, name) {
  api.__state.activeDoctor.id = id;
  api.__state.activeDoctor.name = name;
}

function leer(almacen, k) {
  const v = almacen[k];
  return v === undefined ? null : JSON.parse(v);
}

module.exports = {
  nombre: "Matriz de acceso 4×13×3 (B6): perfiles × capacidades × capas a/b/c + telemetría de denegación sin PHI",

  cubre: ["accesoPerfil", "accesoCap", "accesoEscribir",
    "_accesoDenegAnota", "_accesoDenegDia", "_accesoDenegFlush", "_accesoDenegReset"],

  async pruebas(t, api, env, cargar) {

    t.caso("B6: el módulo de telemetría de denegación existe", () => {
      for (const f of ["_accesoDenegAnota", "_accesoDenegDia", "_accesoDenegFlush", "_accesoDenegReset"]) {
        t.cierto(typeof api[f] === "function", "falta " + f);
      }
    });

    t.caso("B6 matriz capa a/b (accesoCap): 4 perfiles × 13 capacidades = 52 celdas exactas", () => {
      for (const p of PERFILES) {
        const almacen = almPadron();
        const c = cargar({ silencioso: true, almacen: almacen });
        conDoctor(c.api, p.uid, p.nombre);
        t.igual(c.api.accesoPerfil(), p.perfil, p.perfil + " resuelto por uid");
        for (const cap of LAS_13) {
          const esperado = p.si.indexOf(cap) !== -1;
          if (esperado) t.cierto(c.api.accesoCap(cap), p.perfil + " DEBE tener " + cap);
          else t.falso(c.api.accesoCap(cap), p.perfil + " NO debe tener " + cap);
        }
      }
    });

    t.caso("B6 matriz capa c (accesoEscribir): mismas 52 celdas, delegación idéntica a la capa a/b", () => {
      for (const p of PERFILES) {
        const almacen = almPadron();
        const c = cargar({ silencioso: true, almacen: almacen });
        conDoctor(c.api, p.uid, p.nombre);
        for (const cap of LAS_13) {
          const esperado = p.si.indexOf(cap) !== -1;
          t.igual(c.api.accesoEscribir(cap), esperado,
            "capa c para " + p.perfil + "·" + cap + " debe delegar en accesoCap sin sorpresas");
        }
      }
    });

    t.caso("B6: BLOQUEADO no escribe NADA — ni siquiera las capacidades públicas", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 999, "Prueba Bloqueada");
      for (const cap of CAPS_PUBLICAS) {
        t.falso(c.api.accesoEscribir(cap), "BLOQUEADO sin escritura de la pública " + cap);
      }
      const r = c.api._accesoDenegDia();
      t.cierto(!!r && !!r.cuentas.psic_odonto, "la intención de escribir bloqueada quedó contada (psic_odonto)");
      t.cierto(!!r.cuentas.pym, "la intención de escribir bloqueada quedó contada (pym)");
    });

    t.caso("B6: capacidad desconocida → false en todos menos COMPLETO (COMPLETO es «todo», por diseño)", () => {
      for (const p of PERFILES) {
        const almacen = almPadron();
        const c = cargar({ silencioso: true, almacen: almacen });
        conDoctor(c.api, p.uid, p.nombre);
        const esperado = p.perfil === "COMPLETO";
        t.igual(c.api.accesoCap("cap_fantasma_b6"), esperado, "capa a/b·" + p.perfil);
        t.igual(c.api.accesoEscribir("cap_fantasma_b6"), esperado, "capa c·" + p.perfil);
      }
    });

    t.caso("B6 telemetría: la denegación de capa c se cuenta en memoria y baja a disco agregada", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 555, "Fuera Del Padrón");   // PÚBLICO
      c.api.accesoEscribir("laboratorios");        // denegada ×3
      c.api.accesoEscribir("laboratorios");
      c.api.accesoEscribir("laboratorios");
      const r = c.api._accesoDenegDia();
      t.cierto(!!r, "el volcado devuelve el día");
      t.igual(r.cuentas.laboratorios, 3, "tres intentos, tres cuentas");
      t.igual(Object.keys(r.cuentas).length, 1, "solo la capacidad denegada, nada más");
      const hoy = c.api.todayStamp();
      t.cierto(("vgl_acceso_deneg_" + hoy) in almacen, "la clave datada quedó en disco");
      // Un segundo volcado sin nuevos intentos conserva el acumulado (memoria ya vacía).
      const r2 = c.api._accesoDenegDia();
      t.igual(r2.cuentas.laboratorios, 3, "el acumulado del día no se pierde entre barridos");
    });

    t.caso("B6 telemetría: la capa a/b NO se cuenta — es el estado normal, no un incidente", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 555, "Fuera Del Padrón");   // PÚBLICO
      for (let i = 0; i < 5; i++) c.api.accesoCap("laboratorios"); // denegada ×5 en capa a/b
      const r = c.api._accesoDenegDia();
      t.igual(Object.keys(r.cuentas).length, 0, "cinco ticks de UI recortada no generan ni una cuenta");
    });

    t.caso("B6 telemetría: sin PHI — las claves del acumulado son solo nombres de capacidad", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");     // LABORATORIOS
      c.api.accesoEscribir("rcv");                 // denegada (solo COMPLETO)
      c.api.accesoEscribir("panel_paciente");      // denegada
      const r = c.api._accesoDenegDia();
      for (const k of Object.keys(r.cuentas)) {
        t.cierto(LAS_13.indexOf(k) !== -1, "la clave «" + k + "» debe ser una capacidad conocida, jamás dato libre");
      }
      t.cierto(typeof r.cuentas.rcv === "number" && r.cuentas.rcv > 0, "rcv contada como número");
      const enDisco = leer(almacen, "vgl_acceso_deneg_" + c.api.todayStamp());
      t.igual(Object.keys(enDisco).sort().join(","), "panel_paciente,rcv", "en disco solo vive el agregado por capacidad");
    });

    await t.casoAsync("B6 telemetría: flush reporta acceso_deneg SIN PHI, con candado diario, y poda días viejos", async () => {
      const red = { posts: [], status: 200, cuerpo: "ok", finalUrl: "" };
      red.gmxhr = (o) => { red.posts.push(o); o.onload({ status: red.status, responseText: red.cuerpo, finalUrl: red.finalUrl }); };
      const almacen = almPadron({ "vgl_acceso_deneg_2000-01-01": JSON.stringify({ pym: 40 }) });
      const c = cargar({ silencioso: true, almacen: almacen, gmxhr: red.gmxhr });
      conDoctor(c.api, 555, "Fuera Del Padrón");
      c.api.accesoEscribir("redactor_ia");         // denegada en PÚBLICO
      c.api._accesoDenegFlush();
      await new Promise((res) => setTimeout(res, 30));
      t.falso(("vgl_acceso_deneg_2000-01-01" in almacen), "la clave del día viejo se fue");
      t.cierto(("vgl_acceso_deneg_" + c.api.todayStamp()) in almacen, "la del día de hoy quedó");
      t.cierto(red.posts.length === 1, "un solo POST");
      const cuerpo = JSON.parse(red.posts[0].data);
      t.igual(cuerpo.evento, "acceso_deneg", "evento acceso_deneg");
      t.igual(cuerpo.uid, 555, "uid del médico (dato de personal)");
      t.igual(cuerpo.perfil, "PUBLICO", "perfil resuelto");
      t.igual(cuerpo.cuentas.redactor_ia, 1, "cuenta agregada por capacidad");
      t.cierto(String(red.posts[0].data).indexOf("Fuera") === -1, "sin nombre del médico en el POST");
      t.igual(almacen["vgl_rep_acceso_deneg"], c.api.todayStamp(), "candado diario escrito");
      c.api._accesoDenegFlush();                    // segundo barrido el mismo día
      await new Promise((res) => setTimeout(res, 30));
      t.igual(red.posts.length, 1, "el candado diario impide el segundo envío");
    });

  },
};
