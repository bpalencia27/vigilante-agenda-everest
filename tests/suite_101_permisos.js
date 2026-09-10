// =====================================================================
//  SUITE 101 — PERMISOS POR MÉDICO × FUNCIÓN (v18.8.1)
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que la revocación granular
//  corte la EJECUCIÓN y la ESCRITURA de una función (capas b y c) sin
//  tocar jamás la VISIBILIDAD (capa a: todos los médicos siguen viendo
//  que la función existe), con default ON para médicos existentes y
//  nuevos, dos fuentes de verdad en la misma forma {uid?, nombre?,
//  off:[caps], on:[caps]} (el padrón remoto hoja «acceso» y los
//  ajustes locales del equipo, donde `on` local TAPA un off remoto y
//  `off` local fuerza la revocada), uid por delante del nombre EXACTO
//  normalizado (jamás subcadena), «centinela» no revocable, el menú de
//  Ajustes con sus data-attrs y la guarda D5 (el médico en sesión no
//  puede desactivarse funciones a sí mismo), y la auditoría de cada
//  cambio: fila local {ts, quien, medico, funcion, estado} podada a
//  200 + evento remoto «permiso_cambio».
//
//  Los NOMBRES del padrón no viven en el userscript: esta suite los
//  siembra en `vgl_acceso_lista` (patrón 7A), con los mismos
//  fixtures simulados de las suites 78/80 (cero PHI).
// =====================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

const NOMBRE_101 = "Brandon Jesús Palencia Martínez";
const NOMBRE_201 = "Maryuris Terán";

const CAPS_101 = ["psic_odonto", "pym", "notificaciones", "agendar_labs", "laboratorios",
  "widget_examen_normal", "widget_examenes_autolabs", "aviso_paciente_nuevo",
  "agendar_control", "panel_paciente", "redactor_ia", "rcv"];

const LISTA_101 = {
  version: "2026-09-08.1",
  emitida: "2026-09-08T08:00:00",
  perfiles: {
    COMPLETO: [{ uid: 101, nombre: NOMBRE_101 }],
    LABORATORIOS: [{ uid: 201, nombre: NOMBRE_201, off: ["rcv", "redactor_ia"] }],
  },
  blocklist: [{ uid: 999, nombre: "Prueba Bloqueada Uno", motivo: "banco" }],
};

function alm101(extra) {
  const a = { vgl_acceso_lista: JSON.stringify(LISTA_101) };
  if (extra) Object.assign(a, extra);
  return a;
}

function conDoctor(api, id, name) {
  api.__state.activeDoctor = { id: id, name: name };
}

function leer(almacen, k) {
  const v = almacen[k];
  return v === undefined ? null : JSON.parse(v);
}

// Copia LOCAL del parche DOM de suite_15 (norma de la casa: cada suite
// repite el suyo) con la normalización de `:not()` de v18.0.24.
function enriquecerDom101(c) {
  const doc = c.env.doc;
  const crearBase = doc.createElement;
  doc.createElement = function (tag) {
    const e = crearBase(tag);
    const memo = new Map();
    e.querySelector = (sel) => {
      const clave = String(sel).replace(/:not\([^)]*\)/g, "");
      if (!memo.has(clave)) memo.set(clave, doc.createElement("div"));
      return memo.get(clave);
    };
    e.querySelectorAll = () => [];
    return e;
  };
  doc.createDocumentFragment = () => {
    const f = doc.createElement("div");
    f._esFragmento = true;
    return f;
  };
}

// Dispara el ÚLTIMO listener registrado de un tipo en un nodo falso
// (los repintados acumulan listeners en el mismo nodo memoizado).
function disparar(nodo, tipo, evento) {
  const ls = nodo._listeners && nodo._listeners[tipo];
  if (!ls || !ls.length) throw new Error("no hay listener '" + tipo + "' registrado");
  return ls[ls.length - 1](evento || {});
}

const montado = (c, id) => Array.prototype.some.call(c.env.doc.body.children, (e) => e.id === id);

const uxClaves = (c) => {
  try {
    c.api._uxVolcarBuffer();
    const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
    return (w && w.acciones) ? Object.keys(w.acciones) : [];
  } catch (e) { return []; }
};

module.exports = {
  nombre: "Permisos por médico × función (v18.8.1): revocación granular b/c sin tocar visibilidad, menú, D5 y auditoría",

  cubre: ["permisosLocalesLeer", "permisosLocalesEscribir", "permisosCapRevocada",
    "permisosLocalSet", "permisosLocalQuitar", "permisosAuditLeer", "permisosAuditAnotar",
    "permisosAvisoRevocado", "_permisoCorte", "permisosEntradaEfectiva",
    "permisosEntradasVisibles", "permisosListaHtml",
    "openLaboratoriosModal", "openAgendamientoModal", "openLabSoloModal",
    "openPanelPacienteModal", "abrirRedactorTextoLibre", "mtrAbrirPanelRedaccion",
    "esMedicoRCVActivo", "mtrIdentificadorParaConstancia"],

  async pruebas(t, api, env, cargar) {

    t.caso("P101·U1: el módulo de permisos existe completo (12 funciones públicas)", () => {
      for (const f of ["permisosLocalesLeer", "permisosLocalesEscribir", "permisosCapRevocada",
        "permisosLocalSet", "permisosLocalQuitar", "permisosAuditLeer", "permisosAuditAnotar",
        "permisosAvisoRevocado", "_permisoCorte", "permisosEntradaEfectiva",
        "permisosEntradasVisibles", "permisosListaHtml"]) {
        t.cierto(typeof api[f] === "function", "falta " + f);
      }
      if (api.PERMISOS_CAPS_REVOCABLES !== undefined) {
        t.cierto(Array.isArray(api.PERMISOS_CAPS_REVOCABLES) && api.PERMISOS_CAPS_REVOCABLES.length === 12,
          "las 12 capacidades revocables registradas");
        t.falso(api.PERMISOS_CAPS_REVOCABLES.indexOf("centinela") !== -1, "centinela no se puede revocar");
      }
    });

    t.caso("P101·U2 (default ON): tras el despliegue, médicos existentes y nuevos tienen las 12 funciones encendidas", () => {
      const limpia = JSON.parse(JSON.stringify(LISTA_101));
      delete limpia.perfiles.LABORATORIOS[0].off;
      const almacen = { vgl_acceso_lista: JSON.stringify(limpia) };
      // Existente del padrón (COMPLETO).
      const c1 = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c1.api, 101, NOMBRE_101);
      for (const cap of CAPS_101) {
        t.falso(c1.api.permisosCapRevocada(cap), "COMPLETO existente: nada revocado (" + cap + ")");
      }
      // Existente del padrón (LABORATORIOS): default ON de la revocación es
      // INDEPENDIENTE del perfil — su rcv sigue negada por perfil, no por
      // revocación, y su agendar_labs sigue abierta por perfil.
      const c2 = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c2.api, 201, NOMBRE_201);
      for (const cap of CAPS_101) {
        t.falso(c2.api.permisosCapRevocada(cap), "LABORATORIOS existente: sin off en el padrón, nada revocado (" + cap + ")");
      }
      t.falso(c2.api.accesoCap("rcv"), "pero su perfil sigue mandando: rcv negada por LABORATORIOS");
      t.cierto(c2.api.accesoCap("agendar_labs"), "y agendar_labs abierta por LABORATORIOS");
      // Nuevo: fuera del padrón (fail-open COMPLETO).
      const c3 = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c3.api, 555, "Médico Nuevo del Hospital");
      for (const cap of CAPS_101) {
        t.falso(c3.api.permisosCapRevocada(cap), "médico nuevo: default ON (" + cap + ")");
      }
      t.cierto(c3.api.accesoCap("rcv"), "el nuevo ejecuta rcv (fail-open)");
      // Nuevo sin identidad alguna.
      const c4 = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c4.api, 0, "");
      for (const cap of CAPS_101) {
        t.falso(c4.api.permisosCapRevocada(cap), "sin identidad: default ON (" + cap + ")");
      }
    });

    t.caso("P101·U3 (off remoto): la columna off del padrón revoca las capas b y c, y solo al médico de esa fila", () => {
      const lista = JSON.parse(JSON.stringify(LISTA_101));
      lista.perfiles.LABORATORIOS[0].off = ["rcv", "redactor_ia", "agendar_labs"];
      const almacen = { vgl_acceso_lista: JSON.stringify(lista) };
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, NOMBRE_201);
      t.cierto(c.api.permisosCapRevocada("rcv"), "rcv revocada por el padrón");
      t.cierto(c.api.permisosCapRevocada("redactor_ia"), "redactor_ia revocada por el padrón");
      t.cierto(c.api.permisosCapRevocada("agendar_labs"), "agendar_labs revocada por el padrón");
      t.falso(c.api.permisosCapRevocada("panel_paciente"), "lo no listado sigue ON");
      // La clave: agendar_labs es capacidad DEL perfil LABORATORIOS y aun así
      // queda cortada en la capa b y en la c — la revocación gana al perfil.
      t.falso(c.api.accesoCap("agendar_labs"), "capa b cortada pese a que el perfil la da");
      t.falso(c.api.accesoEscribir("agendar_labs"), "capa c cortada");
      // El off de la fila 201 no le toca al 101.
      const c2 = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c2.api, 101, NOMBRE_101);
      t.falso(c2.api.permisosCapRevocada("agendar_labs"), "off de OTRA fila no revoca al 101");
      t.cierto(c2.api.accesoCap("agendar_labs"), "el 101 conserva la función");
    });

    t.caso("P101·U4 (uid manda, nombre EXACTO): normalizado, jamás subcadena, y la entrada por uid no toca a otros", () => {
      const c = cargar({ silencioso: true, almacen: alm101() });
      c.api.permisosLocalSet(0, "  maryuris   teran  ", { off: ["rcv"] });
      conDoctor(c.api, 201, "Maryuris Teran");
      t.cierto(c.api.permisosCapRevocada("rcv"), "por nombre normalizado exacto: revocada");
      conDoctor(c.api, 202, "Maryuris Teran Dos");
      t.falso(c.api.permisosCapRevocada("rcv"), "super-cadena NO revoca: el nombre es exacto");
      conDoctor(c.api, 0, "MARYURIS TERAN");
      t.cierto(c.api.permisosCapRevocada("rcv"), "mayúsculas y espacios no rompen la comparación");
      // La entrada por uid manda sobre cualquier nombre del médico.
      c.api.permisosLocalSet(201, "", { off: ["pym"] });
      conDoctor(c.api, 201, "Otro Nombre Totalmente");
      t.cierto(c.api.permisosCapRevocada("pym"), "uid manda: revocada aunque el nombre no calce");
      // …y NO se derrama a otro médico que comparta nombre.
      conDoctor(c.api, 101, "Otro Nombre Totalmente");
      t.falso(c.api.permisosCapRevocada("pym"), "la entrada por uid 201 no revoca al 101");
    });

    t.caso("P101·U5: permisosLocalSet no duplica la misma clave y normaliza; permisosLocalQuitar devuelve la quitada", () => {
      const c = cargar({ silencioso: true, almacen: alm101() });
      const e1 = c.api.permisosLocalSet(201, "", { off: ["rcv"] });
      t.cierto(!!e1 && e1.uid === 201, "set devuelve la entrada por uid");
      t.igual(e1.off.join(","), "rcv", "off copiado");
      const e2 = c.api.permisosLocalSet(201, "", { on: ["rcv"] });
      t.cierto(Array.isArray(e2.off) && e2.off.join(",") === "rcv", "mut sin off CONSERVA el off previo (omitir un arreglo lo deja como estaba)");
      t.igual(c.api.permisosLocalesLeer().length, 1, "re-set por la misma clave NO duplica");
      t.igual(c.api.permisosLocalesLeer()[0].on.join(","), "rcv", "el on reemplaza, no se suma");
      c.api.permisosLocalSet(0, "  Zulma   Pinto  ", { off: [] });
      t.igual(c.api.permisosLocalesLeer().length, 2, "entrada por nombre: segunda fila");
      const porNombre = c.api.permisosLocalesLeer().find((e) => !e.uid);
      t.igual(porNombre.nombre, api.mtrNormalizarNombre("  Zulma   Pinto  "), "nombre guardado normalizado, sin uid");
      const quitada = c.api.permisosLocalQuitar(201, "");
      t.cierto(!!quitada && quitada.uid === 201, "quitar devuelve la entrada retirada");
      t.igual(c.api.permisosLocalesLeer().length, 1, "y la saca del almacén");
      t.igual(c.api.permisosLocalQuitar(999, ""), null, "quitar algo que no está devuelve null");
    });

    t.caso("P101·U6: on local TAPA un off remoto; off local fuerza; formas rotas no revocan; centinela es inmune", () => {
      const c = cargar({ silencioso: true, almacen: alm101() });
      // El padrón trae off remoto rcv+redactor_ia para 201. El on local tapa rcv.
      c.api.permisosLocalSet(201, "", { on: ["rcv"] });
      conDoctor(c.api, 201, NOMBRE_201);
      t.falso(c.api.permisosCapRevocada("rcv"), "on local TAPA el off remoto");
      t.cierto(c.api.permisosCapRevocada("redactor_ia"), "la otra sigue revocada");
      // El off local fuerza la revocada aunque el padrón no la toque.
      c.api.permisosLocalSet(101, "", { off: ["pym"] });
      conDoctor(c.api, 101, NOMBRE_101);
      t.cierto(c.api.permisosCapRevocada("pym"), "off local fuerza (el padrón no decía nada)");
      t.falso(c.api.accesoCap("pym"), "capa b cortada por el off local");
      t.falso(c.api.accesoEscribir("pym"), "capa c cortada por el off local");
      // Formas rotas: string, número, casi-igual — ninguna revoca.
      c.api.permisosLocalSet(0, "Basura Rota", { off: "rcv" });
      c.api.permisosLocalSet(0, "Basura Numero", { off: [123] });
      c.api.permisosLocalSet(0, "Basura Casi", { off: ["R C V"] });
      conDoctor(c.api, 0, "Basura Rota");
      t.falso(c.api.permisosCapRevocada("rcv"), "off como string no revoca");
      conDoctor(c.api, 0, "Basura Numero");
      t.falso(c.api.permisosCapRevocada("rcv"), "off numérico no revoca");
      conDoctor(c.api, 0, "Basura Casi");
      t.falso(c.api.permisosCapRevocada("rcv"), "coincidencia parcial no revoca (solo la cap exacta)");
      // Centinela: ni intentándolo se revoca.
      c.api.permisosLocalSet(101, "", { off: ["centinela", "rcv"] });
      conDoctor(c.api, 101, NOMBRE_101);
      t.falso(c.api.permisosCapRevocada("centinela"), "centinela es inmune en la unidad");
      t.cierto(c.api.accesoCap("centinela"), "y sigue abierto en la capa b");
      t.cierto(c.api.accesoEscribir("centinela"), "y en la c");
      t.cierto(c.api.permisosCapRevocada("rcv"), "pero la cap normal de la misma fila sí aplica");
      t.falso(c.api.permisosCapRevocada(null), "cap nula nunca revoca");
      t.falso(c.api.permisosCapRevocada(""), "cap vacía nunca revoca");
    });

    t.caso("P101·U7: permisosEntradaEfectiva resuelve las 4 ramas (local on → local off → remoto off → ON)", () => {
      const lista = JSON.parse(JSON.stringify(LISTA_101));
      lista.perfiles.COMPLETO[0].off = ["rcv"];   // off remoto para el 101
      const c = cargar({ silencioso: true, almacen: { vgl_acceso_lista: JSON.stringify(lista) } });
      c.api.permisosLocalSet(101, "", { on: ["rcv"], off: ["pym"] });
      const ef101 = c.api.permisosEntradaEfectiva(101, "");
      t.cierto(ef101.local, "101 tiene fila local");
      t.igual(ef101.capsOff.join(","), "pym", "solo el off local queda negado");
      t.cierto(ef101.capsOn.indexOf("rcv") !== -1, "el on local tapó el off remoto de rcv");
      t.igual(ef101.capsOn.length, 11, "11 de las 12 encendidas");
      const ef201 = c.api.permisosEntradaEfectiva(201, NOMBRE_201);
      t.falso(ef201.local, "201 no tiene fila local");
      t.igual(ef201.capsOff.sort().join(","), "rcv,redactor_ia", "su off sale del padrón");
      t.igual(ef201.capsOn.length, 10, "10 encendidas");
      const efNuevo = c.api.permisosEntradaEfectiva(555, "");
      t.falso(efNuevo.local, "555 no tiene fila local");
      t.igual(efNuevo.capsOff.length, 0, "fuera del padrón: default ON, cero negadas");
      t.igual(efNuevo.capsOn.length, 12, "las 12 encendidas");
      const efSinId = c.api.permisosEntradaEfectiva(0, "");
      t.igual(efSinId.capsOn.length, 12, "sin identidad: default ON, las 12");
    });

    t.caso("P101·U8: permisosEntradasVisibles deduplica (uid y nombre) y mezcla locales + padrón", () => {
      const c = cargar({ silencioso: true, almacen: alm101() });
      c.api.permisosLocalSet(101, "", { on: ["rcv"] });                 // duplicado del padrón
      c.api.permisosLocalSet(0, "Zulma Local Sin Padron", { off: ["rcv"] }); // solo local
      const vistas = c.api.permisosEntradasVisibles();
      t.igual(vistas.length, 3, "101 (una sola vez) + zulma + 201");
      const v101 = vistas.filter((v) => v.uid === 101);
      t.igual(v101.length, 1, "la fila local de 101 tapa su fila del padrón: aparece UNA vez");
      t.cierto(vistas.some((v) => v.uid === 201), "la fila del padrón 201 está");
      t.cierto(vistas.some((v) => v.nombre === api.mtrNormalizarNombre("Zulma Local Sin Padron")), "la fila solo-local está");
      // Orden: locales primero (en orden de escritura), padrón después.
      t.igual(vistas[0].uid, 101, "la fila local del 101 abre la lista");
      t.igual(vistas[2].uid, 201, "la fila del padrón cierra la lista");
    });

    t.caso("P101·U9: permisosListaHtml pinta data-attrs, checked = estado efectivo y Quitar solo en filas locales", () => {
      const c = cargar({ silencioso: true, almacen: alm101() });
      c.api.permisosLocalSet(101, "", { on: ["rcv"] });                 // tapa el default: rcv ON
      c.api.permisosLocalSet(0, "Zulma Local Sin Padron", { off: ["rcv"] });
      const html = c.api.permisosListaHtml();
      // data-perm-cap + data-perm-quien por fila; checked refleja la efectiva.
      t.cierto(/<input type="checkbox" data-perm-cap="rcv" data-perm-quien="uid-101" checked>/.test(html),
        "rcv del 101: marcada (on local)");
      t.cierto(/<input type="checkbox" data-perm-cap="rcv" data-perm-quien="uid-201">/.test(html),
        "rcv del 201: casilla presente (la función se VE)…");
      t.igual(html.indexOf('<input type="checkbox" data-perm-cap="rcv" data-perm-quien="uid-201" checked>'), -1,
        "…pero desmarcada (off remoto del padrón)");
      const quienZulma = "nom-" + encodeURIComponent(api.mtrNormalizarNombre("Zulma Local Sin Padron"));
      t.cierto(/<input type="checkbox" data-perm-cap="rcv" data-perm-quien="nom-ZULMA%20LOCAL%20SIN%20PADRON">/.test(html),
        "rcv de zulma: casilla presente y desmarcada (off local)");
      t.cierto(html.indexOf('data-perm-quitar="uid-101"') > 0, "botón Quitar en la fila local de 101");
      t.cierto(html.indexOf('data-perm-quitar="' + quienZulma + '"') > 0, "botón Quitar en la fila solo-local");
      t.igual(html.indexOf('data-perm-quitar="uid-201"'), -1, "SIN Quitar en la fila del padrón (se ancla, no se borra)");
      t.cierto(html.indexOf("Marcado = función activada (ON)") > 0, "la leyenda ON explica las casillas");
      // Las 12 casillas por fila: 3 filas × 12 = 36 data-perm-cap.
      t.igual((html.match(/data-perm-cap="/g) || []).length, 36, "12 casillas por cada una de las 3 filas");
      // Sin entradas: aviso de lista vacía.
      const vacio = cargar({ silencioso: true, almacen: { vgl_acceso_lista: JSON.stringify({ version: "2026-09-08.2", perfiles: { COMPLETO: [], LABORATORIOS: [] }, blocklist: [] }) } });
      t.cierto(vacio.api.permisosListaHtml().indexOf("Todavía no hay médicos en la lista") > 0, "lista vacía avisa");
    });

    t.caso("P101·U10 (auditoría): fila exacta {ts, quien, medico, funcion, estado}, GM persistente y poda a 200", () => {
      // (a) fila exacta con identidad sembrada (quien = uid:NN) y persistencia en GM.
      // GM vive en env.gm (crudo, sin JSON): la siembra va ahí, igual que la lectura.
      const c = cargar({ silencioso: true, almacen: alm101() });
      conDoctor(c.api, 101, NOMBRE_101);
      c.env.storage.setItem("user", JSON.stringify({ username: "bpalencia", userIdIdentity: "101" }));
      c.env.gm["vgl_identidad_medico_cache"] = { bpalencia: { id: 101, name: NOMBRE_101, ts: Date.now() } };
      const fila = c.api.permisosAuditAnotar({ medico: "uid:201", funcion: "rcv", estado: "off" });
      t.igual(Object.keys(fila).sort().join(","), "estado,funcion,medico,quien,ts", "la fila tiene EXACTAMENTE esas 5 claves");
      t.cierto(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fila.ts), "ts ISO con fecha y hora");
      t.igual(fila.quien, "uid:101", "quien identifica al autor por uid");
      t.igual(fila.medico, "uid:201", "medico afectado");
      t.igual(fila.funcion, "rcv", "función modificada");
      t.igual(fila.estado, "off", "estado del cambio");
      const enGm = c.env.gm["vgl_permisos_audit"];
      t.cierto(Array.isArray(enGm) && enGm.length === 1, "la fila quedó en GM");
      t.igual(c.api.permisosAuditLeer()[0].funcion, "rcv", "permisosAuditLeer devuelve lo guardado");
      // (b) poda: con 200 filas previas, la nueva entra y la más vieja sale.
      const c2 = cargar({ silencioso: true, almacen: alm101() });
      c2.env.gm["vgl_permisos_audit"] = Array.from({ length: 200 }, (_, i) => ({ ts: "fila-" + i }));
      c2.api.permisosAuditAnotar({ medico: "uid:201", funcion: "pym", estado: "on" });
      const filas = c2.api.permisosAuditLeer();
      t.igual(filas.length, 200, "la auditoría no crece más allá de 200 filas");
      t.falso(filas.some((f) => f.ts === "fila-0"), "la más vieja salió");
      t.igual(filas[199].funcion, "pym", "la más nueva entró al final");
      // (c) sin identidad: quien queda vacío, la fila se anota igual.
      const c3 = cargar({ silencioso: true, almacen: alm101() });
      conDoctor(c3.api, 0, "");
      const fila3 = c3.api.permisosAuditAnotar({ medico: "uid:201", funcion: "rcv", estado: "off" });
      t.igual(fila3.quien, "", "sin identidad, el autor se deja en blanco (casilla vacía antes que dato inventado)");
    });

    await t.casoAsync("P101·U11 (auditoría remota): cada cambio emite el evento «permiso_cambio» con el detalle exacto", async () => {
      const red = { posts: [], status: 200, cuerpo: "ok", finalUrl: "" };
      red.gmxhr = (o) => { red.posts.push(o); o.onload({ status: red.status, responseText: red.cuerpo, finalUrl: red.finalUrl }); };
      const c = cargar({ silencioso: true, almacen: alm101(), gmxhr: red.gmxhr });
      conDoctor(c.api, 101, NOMBRE_101);
      c.env.storage.setItem("user", JSON.stringify({ username: "bpalencia", userIdIdentity: "101" }));
      c.env.gm["vgl_identidad_medico_cache"] = { bpalencia: { id: 101, name: NOMBRE_101, ts: Date.now() } };
      c.api.permisosAuditAnotar({ medico: "uid:201", funcion: "rcv", estado: "off" });
      await new Promise((res) => setTimeout(res, 30));
      const posts = red.posts.filter((p) => { try { return JSON.parse(p.data).evento === "permiso_cambio"; } catch (e) { return false; } });
      t.cierto(posts.length === 1, "un solo POST de permiso_cambio");
      const cuerpo = JSON.parse(posts[0].data);
      t.igual(cuerpo.quien, "uid:101", "autor del cambio");
      t.igual(cuerpo.medico, "uid:201", "médico afectado");
      t.igual(cuerpo.funcion, "rcv", "función modificada");
      t.igual(cuerpo.estado, "off", "estado del cambio");
    });

    t.caso("P101·U12 (aviso): permisosAvisoRevocado y _permisoCorte marcan la función desactivada en el embudo", () => {
      const c = cargar({ silencioso: true, almacen: alm101() });
      c.api.permisosLocalSet(101, "", { off: ["rcv"] });
      conDoctor(c.api, 101, NOMBRE_101);
      const cuerpo = c.api.permisosAvisoRevocado("rcv");
      t.cierto(typeof cuerpo === "string" && cuerpo.length > 0, "el aviso devuelve su texto");
      t.cierto(uxClaves(c).indexOf("permiso.revocado") !== -1, "el aviso queda en el embudo (permiso.revocado)");
      // _permisoCorte con una cap NO revocada: silencio total.
      const c2 = cargar({ silencioso: true, almacen: alm101() });
      conDoctor(c2.api, 101, NOMBRE_101);
      c2.api._permisoCorte("rcv");
      t.falso(uxClaves(c2).indexOf("permiso.revocado") !== -1, "sin revocación, el corte no suena");
    });

    // ================= corte de EJECUCIÓN en la capa b (los 6 puntos) =================
    const APT101 = { doc_id: "5150076", nombre: "PACIENTE PRUEBA" };
    const IDS_101 = ["vgl-agendar-modal", "vgl-labs-modal", "vgl-panel-modal", "vgl-ia-modal"];
    function RESUMEN_101() {
      return {
        programa: "HTA",
        factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
        erc: { egfr: 52, estadioClinico: "G3a" },
        riesgo: { categoria: "alto" },
        meta: { metas: { ldl: 70 } },
        _docId: "5150076",
        _pacienteIdLabs: null,
        _ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } },
        _hoyIso: new Date().toISOString().slice(0, 10),
      };
    }
    const ctxB3_101 = () => {
      const c = cargar({ silencioso: true, almacen: alm101(), gmxhr: (o) => o.onerror(new Error("sin red")) });
      conDoctor(c.api, 101, NOMBRE_101);
      enriquecerDom101(c);
      try { c.api.__S.iaRedaccion = true; } catch (e) {}
      try { c.api.mtrGuardarClaveGemini("CLAVE-DE-PRUEBA"); } catch (e) {}
      try { c.api._vglCosechaGuardar("5150076", { factores: { hta: { v: true, ts: 1 }, tabaquismo: { v: false, ts: 1 } } }); } catch (e) {}
      try { c.api.mtrCacheResumenGuardar("5150076", RESUMEN_101()); } catch (e) {}
      return c;
    };
    const ejercerPrivados101 = async (c) => {
      c.api.openAgendamientoModal(APT101);
      await c.api.openLaboratoriosModal(APT101);
      await c.api.openLabSoloModal(APT101, { libre: true });
      await c.api.openPanelPacienteModal(APT101);
      await c.api.abrirRedactorTextoLibre(APT101, { modo: "enfermedad_actual" });
      c.api.mtrAbrirPanelRedaccion(RESUMEN_101(), { modo: "enfermedad_actual" });
    };

    await t.casoAsync("P101·I1 (capa b): médico revocado no EJECUTA ninguno de los seis puntos — avisa y no abre, y al restituir vuelve a abrir", async () => {
      const c = ctxB3_101();
      c.api.permisosLocalSet(101, "", {
        off: ["agendar_control", "laboratorios", "agendar_labs", "panel_paciente", "redactor_ia", "rcv"],
      });
      t.cierto(c.api.accesoPerfil() === "COMPLETO", "precondición: el perfil del médico NO cambió");
      t.falso(c.api.esMedicoRCVActivo(), "rcv revocada apaga el panel contextual RCV");
      await ejercerPrivados101(c);
      for (const id of IDS_101) t.falso(montado(c, id), "no debe montarse " + id);
      const vistas = uxClaves(c);
      t.cierto(vistas.indexOf("permiso.revocado") !== -1, "cada corte avisó (permiso.revocado)");
      for (const k of ["fn.agendar.open", "fn.labs.open", "fn.panel.open", "fn.redactor.complete", "fn.ia.open"]) {
        t.falso(vistas.indexOf(k) !== -1, "el embudo NO cuenta '" + k + "' como apertura efectiva");
      }
      // Restitución: quitar la fila local devuelve la ejecución al instante.
      c.api.permisosLocalQuitar(101, "");
      await c.api.openLaboratoriosModal(APT101);
      t.cierto(montado(c, "vgl-labs-modal"), "sin la fila local, el modal vuelve a abrir");
    });

    await t.casoAsync("P101·I2 (menú Ajustes): Añadir ancla por uid y por nombre con auditoría; vacío no ancla; Quitar retira", async () => {
      const c = cargar({ silencioso: true, almacen: alm101() });
      conDoctor(c.api, 101, NOMBRE_101);
      enriquecerDom101(c);
      c.api.buildOverlay();
      const raiz = c.env.doc.body.children.find((n) => n.id === "vgl-root");
      c.api.toggleSheet("ajustes");
      const hoja = raiz.querySelector("#vgl-sheet");
      t.cierto(String(hoja.innerHTML).indexOf("No puede desactivarse funciones a sí mismo") > 0,
        "el menú de permisos se pinta en Ajustes para el perfil COMPLETO");
      const addBtn = hoja.querySelector("#c-perm-add");
      const inp = hoja.querySelector("#c-perm-medico");
      const lista = hoja.querySelector("#c-perm-lista");
      t.cierto(!!addBtn && !!inp && !!lista, "los tres nodos del menú existen");
      t.cierto(!!addBtn._listeners && !!addBtn._listeners.click, "Añadir quedó cableado");
      t.cierto(!!lista._listeners && !!lista._listeners.change, "el listener delegado de casillas quedó cableado");

      // Añadir por cédula: ancla con uid y audita.
      inp.value = "55555";
      disparar(addBtn, "click");
      t.cierto(c.api.permisosLocalesLeer().some((e) => e.uid === 55555), "la cédula ancló una fila por uid");
      t.igual(inp.value, "", "el campo se limpió");
      let filas = c.api.permisosAuditLeer();
      t.cierto(filas.some((f) => f.medico === "uid:55555" && f.funcion === "*" && f.estado === "entrada-anadida"),
        "la entrada por cédula quedó auditada");

      // Añadir por nombre completo: ancla por nombre normalizado y audita.
      inp.value = "  zulma   pinto  ";
      disparar(addBtn, "click");
      const nomZulma = api.mtrNormalizarNombre("  zulma   pinto  ");
      t.cierto(c.api.permisosLocalesLeer().some((e) => !e.uid && e.nombre === nomZulma), "el nombre ancló una fila normalizada");
      filas = c.api.permisosAuditLeer();
      t.cierto(filas.some((f) => f.medico === "nombre:" + nomZulma && f.estado === "entrada-anadida"),
        "la entrada por nombre quedó auditada");

      // Campo vacío: no ancla nada ni audita nada.
      const antes = c.api.permisosLocalesLeer().length;
      const antesA = c.api.permisosAuditLeer().length;
      inp.value = "   ";
      disparar(addBtn, "click");
      t.igual(c.api.permisosLocalesLeer().length, antes, "vacío no ancla filas");
      t.igual(c.api.permisosAuditLeer().length, antesA, "vacío no escribe auditoría");

      // D5: el médico en sesión NO puede desmarcarse una función a sí mismo.
      const cbPropio = { type: "checkbox", dataset: { permCap: "rcv", permQuien: "uid-101" }, checked: false };
      disparar(lista, "change", { target: cbPropio });
      t.cierto(cbPropio.checked === true, "el desmarque propio se deshace en el acto");
      t.falso(c.api.permisosAuditLeer().some((f) => f.medico === "uid:101" && f.estado === "off"),
        "y NO se audita una revocación propia");
      t.falso(c.api.permisosLocalesLeer().some((e) => e.uid === 101 && Array.isArray(e.off) && e.off.indexOf("rcv") !== -1),
        "y NO se escribe un off propio");

      // Cambio para OTRO médico: sí aplica y se audita.
      // (El DOM simulado no tiene casillas hijas, así que la recolección ve el
      // conjunto vacío y escribe las 12 como off; aquí se aserta SOLO el
      // contrato auditable: la cap tocada y la fila del médico afectado.)
      const cbOtro = { type: "checkbox", dataset: { permCap: "rcv", permQuien: "uid-201" }, checked: false };
      disparar(lista, "change", { target: cbOtro });
      filas = c.api.permisosAuditLeer();
      t.cierto(filas.some((f) => f.medico === "uid:201" && f.funcion === "rcv" && f.estado === "off"),
        "el cambio sobre otro médico se audita con médico, función y estado");
      const entrada201 = c.api.permisosLocalesLeer().find((e) => e.uid === 201);
      t.cierto(!!entrada201 && Array.isArray(entrada201.off) && entrada201.off.indexOf("rcv") !== -1,
        "y ancla la fila local del médico afectado");

      // Quitar: la fila local se retira y el retiro se audita.
      disparar(lista, "click", { target: { dataset: { permQuitar: "uid-55555" } } });
      t.falso(c.api.permisosLocalesLeer().some((e) => e.uid === 55555), "la fila por cédula se retiró");
      t.cierto(c.api.permisosAuditLeer().some((f) => f.medico === "uid:55555" && f.estado === "entrada-eliminada"),
        "el retiro quedó auditado");
    });

    // ================= regresión de fuente (patrón P11·10 de suite_82) =================
    t.caso("P101·F1 (fuente): los contratos del menú y la auditoría siguen cableados en el archivo", () => {
      t.cierto(FUENTE.indexOf("if (!cap || cap === \"centinela\") return false") > 0, "centinela inmune en el núcleo");
      t.cierto(FUENTE.indexOf("PERMISOS_AUDIT_MAX = 200") > 0, "poda de auditoría a 200 filas");
      t.cierto(FUENTE.indexOf('estado: "entrada-anadida"') > 0, "auditoría de entrada añadida");
      t.cierto(FUENTE.indexOf('estado: "entrada-eliminada"') > 0, "auditoría de entrada eliminada");
      t.cierto(FUENTE.indexOf('estado: cb.checked ? "on" : "off"') > 0, "auditoría del cambio de casilla");
      t.cierto(FUENTE.indexOf("cb.checked = true;   // D5: deshacer el desmarque en el acto") > 0, "D5 cableado");
      t.cierto(FUENTE.indexOf('reportar("permiso_cambio"') > 0, "evento remoto permiso_cambio emitido");
      t.cierto(FUENTE.indexOf('id="c-perm-lista"') > 0 && FUENTE.indexOf('id="c-perm-add"') > 0 && FUENTE.indexOf('id="c-perm-medico"') > 0,
        "los tres nodos del menú existen en el archivo");
    });

  },
};
