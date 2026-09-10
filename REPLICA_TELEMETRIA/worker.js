/**
 * VIGILANTE DE AGENDA — Réplica de telemetría en Cloudflare Workers + D1
 * ======================================================================
 * Reemplazo contractual del backend Google Apps Script (TABLERO/Codigo.gs +
 * TABLERO/VersionCheck.gs del checkout principal). Un solo archivo, cero
 * dependencias, ES5-ish (sin build).
 *
 * CONTRATO REPLICADO (el cliente del userscript NO se entera de la diferencia):
 *   POST /            cuerpo JSON { token, evento, lote, ts, dia, equipo, ver,
 *                      + campos por evento } → respuesta TEXTO PLANO:
 *                        "ok"  fila escrita
 *                        "dup" lote ya recibido (cuenta como entrega buena)
 *                        "no"  token malo o evento desconocido
 *                        "err" fallo interno (el lote NO queda quemado)
 *   GET ?accion=listaAcceso&token=…  → texto plano con JSON { ok, version,
 *                      emitida, perfiles:{COMPLETO,LABORATORIOS}, blocklist }
 *   GET /vcheck        → JSON de Versión Mínima (réplica de VersionCheck.gs)
 *
 * DEFENSAS IDÉNTICAS AL GAS: el servidor JAMÁS confía en el emisor — todo
 * texto pasa por _celda()/_sinDigitosLargos() (tiras de 6+ dígitos FUERA:
 * una cédula no puede quedar escrita venga como venga), los valores se
 * fuerzan a número, las "acciones" del evento ux se re-sanean y el total se
 * RECALCULA en el servidor. Cero PHI por construcción.
 *
 * MEJORAS DELIBERADAS (documentadas en README.md):
 *  · Dedup POR SIEMPRE por lote (D1 con UNIQUE) — el GAS deduplicaba solo 6 h
 *    por caché; la duplicación histórica del 54 % (auditoría 07-sep) muere de
 *    raíz. El lote es único por encolado en el cliente, así que un "dup"
 *    permanente nunca puede tragarse una fila legítima.
 *  · La versión se guarda como texto puro (D1 no auto-convierte fechas como
 *    Sheets: adiós al defecto "12.6.9 → 12/06/2009").
 *  · Plan gratuito de Cloudflare, sin cuota diaria de Apps Script.
 *
 * PHI: este archivo no contiene ni un solo dato real — solo el molde falso de
 * pruebas (MEDICO PRUEBA). La tabla `acceso` la llena el DUEÑO a mano,
 * exactamente como la hoja "acceso" del GAS.
 */

// Token compartido — debe coincidir con TABLERO.token del userscript
// ("vgl-2026") y con el TOKEN del Codigo.gs original.
const TOKEN = "vgl-2026";

// Los MISMOS 8 eventos del GAS.
const EVENTOS_VALIDOS = { ux: 1, resumen: 1, fraude: 1, prueba: 1, error: 1, entorno: 1, acceso: 1, acceso_deneg: 1 };

// ── Réplica de VersionCheck.gs ──────────────────────────────────────────
// Editar AQUÍ (y en TABLERO/VersionCheck.gs si el GAS sigue vivo) cada vez
// que se quiera empujar una actualización real a la flota.
const VCHECK = {
  minVersion: "18.0.142",
  force: false,          // true = todos auto-reload incluso si están al día
  killSwitch: { active: false, reason: "Mantenimiento central preventivo", scope: "all", disabledFeatures: [] },
  canary: { enabled: false, percentage: 0, allowedEquipos: [], minVersion: "18.0.32", enabledFeatures: [] },
  expectedSha256: "a326aab48869d279a3ac328efd1e6fa562023d5f3f80efb21eb493878d9c7bec",
  expectedShaVersion: "18.0.142",
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const db = env.DB;

      // Ruta del chequeo de versión mínima (JSON puro, como VersionCheck.gs).
      if (url.pathname === "/vcheck" && request.method === "GET") {
        return json({ status: "ok", ...VCHECK, timestamp: new Date().toISOString() });
      }

      // Acciones de GET (texto plano con JSON dentro, mismo token):
      //   listaAcceso → padrón de acceso; ultimaFila → frescura del pipeline (T0-4);
      //   volumen      → conteo del día en curso o de una fecha (T0-5, C1).
      // El token se acepta por cabecera `x-vgl-token` O por query (?token=…):
      // la query queda como fallback para el chequeo nocturno, la cabecera evita
      // que el secreto se fugue a logs/proxies cuando el URL se pega en un informe.
      if (request.method === "GET") {
        const okToken = url.searchParams.get("token") === TOKEN || request.headers.get("x-vgl-token") === TOKEN;
        if (!okToken) return txt("no");
        if (url.searchParams.get("accion") === "ultimaFila") return txt(JSON.stringify(await ultimaFila(db)));
        if (url.searchParams.get("accion") === "volumen") return txt(JSON.stringify(await volumenDia(db, url.searchParams.get("dia"))));
        if (url.searchParams.get("accion") !== "listaAcceso") return txt("no");
        return txt(JSON.stringify(await listaAcceso(db)));
      }

      // POST de telemetría.
      if (request.method !== "POST") return txt("no");

      let body;
      try { body = await request.json(); } catch (e) { return txt("no"); }
      if (!body || body.token !== TOKEN) return txt("no");
      const ev = String(body.evento || "");
      if (!EVENTOS_VALIDOS[ev]) return txt("no");

      const lote = String(body.lote || "").slice(0, 60);
      const ahora = new Date().toISOString();
      // Comunes saneados igual que _celda/_celdaVersion del GAS (la versión se
      // guarda SIN apóstrofo: D1 no parsea fechas, el apóstrofo era para Sheets).
      const comunes = (extra) => [
        ahora, celda(body.ts, 30), celda(body.dia, 10), celda(body.equipo, 40),
        celda(body.ver, 20), lote || null, ...extra,
      ];

      try {
        // ── DEDUP POR LOTE (mejora: permanente, no 6 h) ──────────────────
        // INSERT OR IGNORE: si el lote ya existe → 0 cambios → "dup", que para
        // el cliente es entrega buena (deja de reintentar). Si la escritura de
        // la fila falla después, se borra el lote (compensación) y se responde
        // "err" SIN haberlo quemado — la semántica v17.49.0 del GAS.
        const r = await db.prepare(
          "INSERT OR IGNORE INTO lotes (lote, recibido, evento) VALUES (?, ?, ?)"
        ).bind(lote, ahora, ev).run();
        if (r.meta.changes === 0) return txt("dup");

        try {
          if (ev === "ux") await eventoUx(db, comunes, body, ahora);
          else if (ev === "resumen") await filaSimple(db, "resumen", comunes, body, SIMPLE.resumen);
          else if (ev === "fraude") await filaSimple(db, "fraude", comunes, body, SIMPLE.fraude);
          else if (ev === "prueba") await db.prepare(
            "INSERT INTO prueba (recibido, ts, dia, equipo, ver, lote) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(...comunes([])).run();
          else if (ev === "error") await db.prepare(
            `INSERT INTO error (recibido, ts, dia, equipo, ver, lote, origen, msg, donde, migas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(...comunes([]), celda(body.origen, 12), sinDigitosLargos(body.msg, 180),
            sinDigitosLargos(body.donde, 60), sinDigitosLargos(body.migas, 160)).run();
          else if (ev === "entorno") await filaSimple(db, "entorno", comunes, body, SIMPLE.entorno);
          else if (ev === "acceso") await db.prepare(
            `INSERT INTO acceso_uid (recibido, ts, dia, equipo, ver, lote, uid, nombre, perfil)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(...comunes([]), numero(body.uid), sinDigitosLargos(body.nombre, 100), celda(body.perfil, 20)).run();
          else if (ev === "acceso_deneg") await db.prepare(
            `INSERT INTO acceso_deneg (recibido, ts, dia, equipo, ver, lote, uid, perfil, cuentas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(...comunes([]), numero(body.uid), celda(body.perfil, 20),
            celda(JSON.stringify(sanearCuentas(body.cuentas)), 400)).run();
        } catch (errEscritura) {
          // Compensación: la fila no se escribió → el lote no debe quedar quemado.
          await db.prepare("DELETE FROM lotes WHERE lote = ?").bind(lote).run().catch(() => {});
          return txt("err");
        }
        return txt("ok");
      } catch (err) {
        return txt("err");
      }
    } catch (err) {
      return txt("err");
    }
  },
};

// ── Evento ux: re-saneo server-side IDÉNTICO al GAS ─────────────────────
async function eventoUx(db, comunes, body, ahora) {
  let acc = {};
  const crudo = String(body.acciones || "").slice(0, 4000);
  try { acc = JSON.parse(crudo) || {}; } catch (e) { acc = {}; }

  // Re-filtra claves, fuerza valores a número positivo, tope 120 (el resto se
  // cuenta en _recortadas, no se tira en silencio). El total SIEMPRE se
  // recalcula aquí — jamás se confía en el `n` del cliente.
  const limpio = {};
  let aceptadas = 0, omitidas = 0;
  for (const k of Object.keys(acc)) {
    const kk = String(k).toLowerCase().replace(/\d{6,}/g, "").replace(/[^a-z0-9.:_-]/g, "").slice(0, 60);
    const v = numero(acc[k]);
    if (!kk || v <= 0) continue;
    if (!(kk in limpio)) {
      if (aceptadas >= 120) { omitidas++; continue; }
      aceptadas++;
    }
    limpio[kk] = (limpio[kk] || 0) + Math.round(v);
  }
  if (omitidas) limpio._recortadas = omitidas;
  let totalLimpio = 0;
  for (const kt in limpio) if (kt !== "_recortadas") totalLimpio += limpio[kt];

  await db.batch([
    db.prepare(
      `INSERT INTO uso (recibido, ts, dia, equipo, ver, lote, deDia, desde, n, acciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(...comunes([]), celda(body.deDia, 10), celda(body.desde, 30), totalLimpio, celda(JSON.stringify(limpio), 4000)),
    // uso_detalle: una fila por acción, en un solo golpe (como el setValues).
    ...Object.keys(limpio).map((k) => db.prepare(
      `INSERT INTO uso_detalle (recibido, dia, equipo, ver, accion, conteo)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(ahora, celda(body.deDia, 10), celda(body.equipo, 40), celda(body.ver, 20), k, limpio[k])),
  ]);
}

// Eventos de una sola fila con columnas 1:1 contra el cuerpo (resumen, fraude,
// entorno). Saneo VERIFICADO contra Codigo.gs L284-302 del GAS original:
//   resumen → deDia _celda(10); fraude/inasistencia/atiempo/ultima toNumero (la
//             "ultima" de este evento es un reloj numérico, NO una hora en texto)
//   fraude  → deDia _celda(10), hora _celda(20); min toNumero
//   entorno → TODO texto: nav 20, so 20, zona 40, pantalla 20, gestor 20
const SIMPLE = {
  resumen: { texto: { deDia: 10 }, num: ["fraude", "inasistencia", "atiempo", "ultima"] },
  fraude:  { texto: { deDia: 10, hora: 20 }, num: ["min"] },
  entorno: { texto: { deDia: 10, nav: 20, so: 20, zona: 40, pantalla: 20, gestor: 20 }, num: [] },
};

async function filaSimple(db, tabla, comunes, body, def) {
  const cols = [...Object.keys(def.texto), ...def.num];
  const colSql = ["recibido", "ts", "dia", "equipo", "ver", "lote", ...cols].join(", ");
  const q = ["?", "?", "?", "?", "?", "?", ...cols.map(() => "?")].join(", ");
  const vals = cols.map((c) => (c in def.texto ? celda(body[c], def.texto[c]) : numero(body[c])));
  await db.prepare(`INSERT INTO ${tabla} (${colSql}) VALUES (${q})`).bind(...comunes([]), ...vals).run();
}

// ── ultimaFila (GET, T0-4): frescura del pipeline para el chequeo nocturno ──────
// Toda escritura pasa primero por `lotes` (dedup), así que MAX(recibido) ahí dice
// cuándo fue la última vez que LA FLOTA reportó — cualquier evento. El chequeo
// nocturno del repo se pone ROJO si esta fila lleva más de 48 h: sin telemetría
// fresca no hay termómetro para los experimentos A/B. `recibido` es ISO-8601
// UTC (texto): el MAX lexicográfico ES el máximo temporal.
async function ultimaFila(db) {
  const ahora = new Date().toISOString();
  const { results } = await db.prepare(
    "SELECT MAX(recibido) AS ultima, COUNT(*) AS filas FROM lotes"
  ).all();
  const fila = (results && results[0]) || {};
  const ultima = String(fila.ultima || "");
  let horas = null;
  if (ultima) horas = Math.max(0, (new Date(ahora).getTime() - new Date(ultima).getTime()) / 3600000);
  return {
    ok: true, ahora,
    ultima: ultima || null,
    filas: Number(fila.filas) || 0,
    horas: horas === null ? null : Math.round(horas * 10) / 10,
  };
}

// ── volumenDia (GET, T0-5): cuánto reportó la flota en un día calendario ─────
// Cierra la brecha de lectura por ventana: ultimaFila solo dice "cuándo", este
// dice "cuánto y de qué" para un día concreto (UTC, ISO). `dia` es obligatorio
// y se valida con forma estricta YYYY-MM-DD — un día malformado no devuelve un
// conteo ambiguo, devuelve ok:false con el motivo. Solo cuenta `lotes`, la misma
// fuente de verdad del dedup: toda fila legítima pasó primero por ahí.
async function volumenDia(db, dia) {
  const ahora = new Date().toISOString();
  const d = String(dia == null ? "" : dia);
  // Forma estricta + fecha real de calendario: JS normaliza "2026-02-30" a marzo
  // sin dar NaN, así que se compara el ISO de ida y vuelta contra la entrada.
  const invalido = !/^\d{4}-\d{2}-\d{2}$/.test(d)
    || (() => {
      const f = new Date(d + "T00:00:00Z");
      return Number.isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== d;
    })();
  if (invalido) {
    return { ok: false, ahora, error: "dia debe ser YYYY-MM-DD válido (UTC)" };
  }
  const { results } = await db.prepare(
    "SELECT evento, COUNT(*) AS n FROM lotes WHERE substr(recibido, 1, 10) = ? GROUP BY evento ORDER BY evento"
  ).bind(d).all();
  const porEvento = {};
  let filas = 0;
  for (const f of results || []) {
    porEvento[String(f.evento || "?")] = Number(f.n) || 0;
    filas += Number(f.n) || 0;
  }
  return { ok: true, ahora, dia: d, filas, porEvento };
}

// ── listaAcceso (GET): misma semántica que _hojaAcceso + _listaAccesoRespuesta ──
async function listaAcceso(db) {
  const perfiles = { COMPLETO: [], LABORATORIOS: [] };
  const blocklist = [];
  const { results } = await db.prepare(
    "SELECT perfil, uid, nombre, estado, motivo, caps FROM acceso ORDER BY nombre"
  ).all();
  for (const fila of results || []) {
    const perfil = String(fila.perfil == null ? "" : fila.perfil).trim().toUpperCase();
    if (!perfil || perfil.charAt(0) === "#") continue;
    if (perfil !== "COMPLETO" && perfil !== "LABORATORIOS") continue;
    const nombre = String(fila.nombre == null ? "" : fila.nombre).trim();
    if (!nombre) continue; // fila a medias: ni entra ni rompe la lista
    const uidNum = numero(fila.uid);
    const uid = uidNum > 0 ? Math.round(uidNum) : uidSintetico(nombre);
    const estado = String(fila.estado == null ? "" : fila.estado).trim().toLowerCase();
    if (estado === "bloqueado" || estado === "inactivo") {
      blocklist.push({ uid, nombre, motivo: String(fila.motivo || "").trim() });
      continue;
    }
    const caps = String(fila.caps == null ? "" : fila.caps).split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    perfiles[perfil].push({ uid, nombre, caps });
  }
  const version = "v" + djb2(JSON.stringify(perfiles) + "|" + JSON.stringify(blocklist));
  return { ok: true, version, emitida: new Date().toISOString(), perfiles, blocklist };
}

// uid sintético determinista por nombre (djb2 a 31 bits, rango 9xx.xxx.xxx)
// — mismo nombre → mismo uid, siempre. Réplica de _accesoUidSintetico.
function uidSintetico(nombre) {
  return 900000000 + (djb2(String(nombre == null ? "" : nombre)) % 99999999);
}

// djb2 confinado a 31 bits (jamás negativo) — réplica de _djb2 del GAS.
function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) & 0x7fffffff;
  return h >>> 0;
}

// ── Saneos servidor-side (idénticos al GAS: nunca se confía en el emisor) ──
function celda(v, max) {
  const t = String(v == null ? "" : v).slice(0, max || 100);
  return t; // en D1 no hace falta el apóstrofo anti-fórmula de Sheets: no hay fórmulas
}

// Barrera PHI: fuera las URL (pueden llevar identificadores), fuera las
// comillas, fuera toda tira de 6+ dígitos y las cédulas formateadas.
function sinDigitosLargos(v, max) {
  return String(v == null ? "" : v)
    .replace(/https?:\/\/[^\s)]+/g, "<url>")
    .replace(/\d{6,}/g, "")
    .replace(/\d{1,3}(?:[.\s-]\d{3}){1,3}/g, "")
    .replace(/["'`]/g, " ")
    .slice(0, max || 100);
}

function numero(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

// acceso_deneg: re-saneo de cuentas {capacidad: n} — tope 32 claves.
function sanearCuentas(crudo) {
  let cuenta = {};
  if (typeof crudo === "string") { try { cuenta = JSON.parse(crudo) || {}; } catch (e) { cuenta = {}; } }
  else if (crudo && typeof crudo === "object") cuenta = crudo;
  const limpio = {};
  let aceptadas = 0, omitidas = 0;
  for (const k of Object.keys(cuenta)) {
    const kd = String(k).toLowerCase().replace(/\d{6,}/g, "").replace(/[^a-z0-9._-]/g, "").slice(0, 40);
    const vd = numero(cuenta[k]);
    if (!kd || vd <= 0) continue;
    if (!(kd in limpio)) {
      if (aceptadas >= 32) { omitidas++; continue; }
      aceptadas++;
    }
    limpio[kd] = (limpio[kd] || 0) + Math.round(vd);
  }
  if (omitidas) limpio._recortadas = omitidas;
  return limpio;
}

// Respuesta de texto plano — EL contrato de acuse del cliente exige cuerpos
// exactos "ok"/"dup"/"no"/"err" (lista blanca estricta en el userscript).
function txt(s) {
  return new Response(s, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function json(o) {
  return new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
