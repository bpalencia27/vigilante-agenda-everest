/**
 * BANCO LOCAL de la réplica de telemetría (ORDEN #7) — corre SIN red, SIN
 * cuenta Cloudflare: simula D1 con SQLite real en memoria (node:sqlite) y
 * ejercita el contrato completo del worker con fetch() nativo de Node.
 *
 *   node test_replica.mjs          (o: npm test)
 *
 * Salida tipo runner del repo:  nombre — n/m ok, EXIT real (1 si algo falla).
 * Cero PHI: los únicos nombres que aparecen son los moldes de prueba
 * (MEDICO DE PRUEBA / PACIENTE DE PRUEBA), nunca datos reales.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// REPLICA_WORKER permite correr el banco contra un worker MUTADO (disciplina
// de mutación verificada: la mutación debe poner rojo el caso que protege).
const rutaWorker = process.env.REPLICA_WORKER ? path.resolve(process.env.REPLICA_WORKER) : path.join(AQUI, "worker.js");
const { default: worker } = await import(pathToFileURL(rutaWorker));

// ── Adaptador D1 sobre SQLite en memoria ─────────────────────────────────
// Mismo contrato que env.DB de Cloudflare: prepare().bind().run()/.all() y
// batch() (atómico). node:sqlite aplica las restricciones UNIQUE reales.
// El worker construye sus statements con db.prepare(sql).bind(...p), cuyo
// resultado ya trae run()/all() ligados a la conexión; batch() solo los
// ejecuta en orden dentro de una transacción y propaga el fallo.
function crearDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(path.join(AQUI, "schema.sql"), "utf8"));
  // Sin cache de statements: D1 prepara por llamada, y el caso 12 (DROP+CREATE
  // de `uso` a mitad de banco) exige que cada prepare vea el esquema vigente.
  const ejecutar = (sql, p, modo) => {
    const st = sqlite.prepare(sql);
    if (modo === "all") return { results: st.all(...p) };
    const r = st.run(...p);
    return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  };
  return {
    _sqlite: sqlite,
    prepare(sql) {
      // D1 permite .run()/.all() directos cuando no hay placeholders; bind()
      // devuelve un statement con run/all ya ligados a los parámetros.
      const sinP = { run: () => ejecutar(sql, [], "run"), all: () => ejecutar(sql, [], "all") };
      return { ...sinP, bind: (...p) => ({ run: () => ejecutar(sql, p, "run"), all: () => ejecutar(sql, p, "all") }) };
    },
    async batch(lista) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const s of lista) {
          if (s && typeof s.run === "function") s.run();
          else if (s && typeof s.all === "function") s.all();
          else throw new Error("batch: statement sin ejecutor");
        }
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

// ── mini-framework de asserts (EXIT real, sin frameworks) ────────────────
let ok = 0, mal = 0;
const fallos = [];
function t(cond, msg) {
  if (cond) ok++;
  else { mal++; fallos.push(msg); }
}
function igual(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja === jb) ok++;
  else { mal++; fallos.push(`${msg} → esperaba ${jb}, obtuve ${ja}`); }
}

// ── helpers ──────────────────────────────────────────────────────────────
function post(db, body) {
  return worker.fetch(new Request("https://telemetria.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }), { DB: db });
}
const acuse = async (r) => r.text();
const filas = (db, sql, ...p) => db.prepare(sql).bind(...p).all().results;

async function enviaUx(db, lote, acciones, extra = {}) {
  return acuse(await post(db, { token: "vgl-2026", evento: "ux", lote, ts: "2026-09-08T14:00:00", dia: "2026-09-08", equipo: "EQ-PRUEBA", ver: "18.8.10", deDia: "2026-09-08", desde: "morning", n: 99, acciones: JSON.stringify(acciones), ...extra }));
}

// djb2 a 31 bits — réplica de la del worker, para poder pronosticar "version".
function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) & 0x7fffffff;
  return h >>> 0;
}

// ════════════════════════ CASOS ═════════════════════════════════════════
const db = crearDb();

// 1. Acuse feliz + dedup permanente por lote (corazón del contrato).
{
  const a1 = await acuse(await post(db, { token: "vgl-2026", evento: "prueba", lote: "l-1", ts: "2026-09-08T14:00:00", dia: "2026-09-08", equipo: "EQ-PRUEBA", ver: "18.8.10" }));
  igual(a1, "ok", "1. prueba con token bueno responde exactamente 'ok'");
  const a2 = await acuse(await post(db, { token: "vgl-2026", evento: "prueba", lote: "l-1", ts: "…", dia: "…", equipo: "…", ver: "…" }));
  igual(a2, "dup", "1. mismo lote repetido responde exactamente 'dup' (cuenta como entrega buena)");
  igual(filas(db, "SELECT COUNT(*) AS n FROM prueba")[0].n, 1, "1. el lote duplicado NO escribió segunda fila");
  igual(filas(db, "SELECT COUNT(*) AS n FROM lotes WHERE lote='l-1'")[0].n, 1, "1. el lote quedó registrado una sola vez");
}

// 2. Rechazos: token, evento, cuerpo, método.
{
  igual(await acuse(await post(db, { token: "clave-mala", evento: "prueba", lote: "l-2" })), "no", "2. token incorrecto → 'no'");
  igual(await acuse(await post(db, { token: "vgl-2026", evento: "espionaje", lote: "l-2" })), "no", "2. evento fuera de la lista blanca → 'no'");
  igual(await acuse(await post(db, "esto no es json{")), "no", "2. cuerpo ilegible → 'no'");
  const rM = await worker.fetch(new Request("https://telemetria.test/", { method: "DELETE" }), { DB: db });
  igual(await acuse(rM), "no", "2. método no POST/GET → 'no'");
  const rT = await acuse(await post(db, { token: "vgl-2026", evento: "prueba", lote: "" }));
  igual(rT, "ok", "2. sin lote el envío entra igual (sin dedup posible, como en GAS)");
}

// 3. ux: re-saneo server-side idéntico al GAS (claves, PHI, total recalculado).
{
  const res = await enviaUx(db, "l-3", {
    "Clic Grande": 2,                     // mayúscula + espacio → clic_grande
    "clic_123456789012": 1,               // tira de 12 dígitos fuera → clic_
    "": 5,                                // clave vacía fuera
    "no-numerico": "muchos",              // valor no numérico → 0 → fuera (v<=0)
    "dos palabras": 1.6,                  // → dos_palabras (redondeo acumulado)
  });
  igual(res, "ok", "3. ux válido → 'ok'");
  const u = filas(db, "SELECT * FROM uso WHERE lote='l-3'")[0];
  t(!!u, "3. la fila de uso existe");
  // El GAS NO incluye el espacio en la clase permitida → "Clic Grande" se
  // pega a "clicgrande". Réplica exacta, no mejora silenciosa.
  igual(JSON.parse(u.acciones), { clicgrande: 2, clic_: 1, dospalabras: 2 }, "3. claves re-saneadas como el GAS (espacios fuera), PHI fuera, valores acumulados");
  igual(u.n, 5, "3. el total se RECALCULÓ en el servidor (body decía n=99)");
  igual(filas(db, "SELECT COUNT(*) AS n FROM uso_detalle WHERE recibido IS NOT NULL")[0].n >= 3, true, "3. uso_detalle tiene una fila por acción");
  t(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(u.recibido), "3. recibido es ISO (lo pone el worker)");
}

// 4. Dedup no falso: dos lotes distintos → dos filas.
{
  igual(await enviaUx(db, "l-4a", { abrir: 1 }), "ok", "4. lote A → 'ok'");
  igual(await enviaUx(db, "l-4b", { abrir: 1 }), "ok", "4. lote B distinto → 'ok' (no es dup)");
  igual(filas(db, "SELECT COUNT(*) AS n FROM uso WHERE lote IN ('l-4a','l-4b')")[0].n, 2, "4. dos lotes → dos filas");
}

// 5. error: la barrera PHI redacta cédulas y URL en el servidor.
{
  await post(db, { token: "vgl-2026", evento: "error", lote: "l-5", ts: "…", dia: "…", equipo: "…", ver: "…", origen: "motor", msg: "Cédula 1234567890 y 111.222.333 y http://everest.test/detalle/9876543210", donde: "colorAndAlert", migas: "nada" });
  const e = filas(db, "SELECT * FROM error WHERE lote='l-5'")[0];
  t(!/\d{6,}/.test(e.msg), "5. ninguna tira de 6+ dígitos sobrevive en msg");
  t(!e.msg.includes("http"), "5. las URL quedaron como <url> en msg");
  igual(e.msg.includes("<url>"), true, "5. el marcador <url> está presente");
  igual(e.origen, "motor", "5. origen se conserva saneado");
}

// 6. Tipos por evento: fraude (hora texto, min número) y resumen (ultima número).
{
  await post(db, { token: "vgl-2026", evento: "fraude", lote: "l-6", ts: "…", dia: "2026-09-08", equipo: "EQ-PRUEBA", ver: "18.8.10", deDia: "2026-09-08", hora: "07:45", min: "6.2" });
  const f = filas(db, "SELECT * FROM fraude WHERE lote='l-6'")[0];
  igual(f.hora, "07:45", "6. fraude.hora es texto ('07:45', no 7,75)");
  igual(f.min, 6.2, "6. fraude.min se forzó a número (6.2, no '6.2')");
  await post(db, { token: "vgl-2026", evento: "resumen", lote: "l-6b", ts: "…", dia: "2026-09-08", equipo: "EQ-PRUEBA", ver: "18.8.10", deDia: "2026-09-08", fraude: 0, inasistencia: 1, atiempo: 14, ultima: "1725800000" });
  const rs = filas(db, "SELECT * FROM resumen WHERE lote='l-6b'")[0];
  igual(rs.ultima, 1725800000, "6. resumen.ultima es numérico (toNumero, como GAS L284)");
  igual(rs.deDia, "2026-09-08", "6. resumen.deDia es texto");
}

// 7. entorno: TODO texto — ningún navegador puede quedar en 0.
{
  await post(db, { token: "vgl-2026", evento: "entorno", lote: "l-7", ts: "…", dia: "…", equipo: "EQ-PRUEBA", ver: "18.8.10", deDia: "…", nav: "Chrome 128", so: "Windows", zona: "urgencias", pantalla: "agenda", gestor: "tampermonkey" });
  const n = filas(db, "SELECT * FROM entorno WHERE lote='l-7'")[0];
  igual(n.nav, "Chrome 128", "7. entorno.nav conserva el texto (jamás numero())");
  igual(n.zona, "urgencias", "7. entorno.zona conserva el texto");
}

// 8. acceso_uid: identidad de la sesión como dato de personal, sin PHI.
{
  await post(db, { token: "vgl-2026", evento: "acceso", lote: "l-8", ts: "…", dia: "…", equipo: "…", ver: "…", uid: "374", nombre: "MEDICO DE PRUEBA", perfil: "COMPLETO" });
  const a = filas(db, "SELECT * FROM acceso_uid WHERE lote='l-8'")[0];
  igual(a.uid, 374, "8. acceso.uid se fuerza a número");
  igual(a.nombre, "MEDICO DE PRUEBA", "8. el molde de prueba se conserva (cero PHI real en el banco)");
}

// 9. acceso_deneg: re-saneo de cuentas con tope 32 + _recortadas.
// (El JSON se guarda recortado a 400 como en el GAS L344; claves cortas para
// que quepa entero y el tope sea verificable.)
{
  const muchas = {};
  for (let i = 0; i < 40; i++) muchas[`a${i}`] = 1;
  await post(db, { token: "vgl-2026", evento: "acceso_deneg", lote: "l-9", ts: "…", dia: "…", equipo: "…", ver: "…", uid: "374", perfil: "COMPLETO", cuentas: JSON.stringify(muchas) });
  const crudo = filas(db, "SELECT * FROM acceso_deneg WHERE lote='l-9'")[0].cuentas;
  t(crudo.length <= 400, "9. cuentas guardadas recortadas a 400 (como _celda del GAS)");
  const d = JSON.parse(crudo);
  igual(Object.keys(d).length, 33, "9. tope de 32 claves + _recortadas (32+1)");
  igual(d._recortadas, 8, "9. las 8 excedentes se cuentan, no se tiran en silencio");
}

// 10. listaAcceso (GET): perfiles, blocklist, versión estable, uid sintético.
{
  db._sqlite.exec(`
    INSERT INTO acceso (perfil, uid, nombre, estado, motivo, caps) VALUES
      ('COMPLETO', '374', 'MEDICO DE PRUEBA', '', '', 'ver,agenda'),
      ('COMPLETO', '', 'SIN CEDULA', '', '', 'todo'),
      ('LABORATORIOS', '999', 'LAB DE PRUEBA', 'activo', '', 'ver'),
      ('COMPLETO', '777', 'BLOQUEADO DE PRUEBA', 'bloqueado', 'motivo de prueba', ''),
      ('#jefe', '1', 'COMENTARIO', '', '', ''),
      ('raro', '2', 'PERFIL RARO', '', '', '');
  `);
  const g = async () => {
    const r = await worker.fetch(new Request("https://telemetria.test/?accion=listaAcceso&token=vgl-2026"), { DB: db });
    return JSON.parse(await r.text());
  };
  const lista = await g();
  igual(lista.ok, true, "10. listaAcceso responde ok:true");
  igual(lista.perfiles.COMPLETO.length, 2, "10. dos perfiles COMPLETO (el # y el raro se saltan)");
  igual(lista.perfiles.COMPLETO[0].caps, ["ver", "agenda"], "10. caps en minúsculas separadas por coma");
  t(lista.perfiles.COMPLETO.some((p) => p.nombre === "SIN CEDULA" && p.uid >= 900000000 && p.uid <= 999999999), "10. uid vacío → sintético determinista 9xx.xxx.xxx");
  igual(lista.blocklist.length, 1, "10. un bloqueado en la blocklist");
  igual(lista.blocklist[0].motivo, "motivo de prueba", "10. el motivo de bloqueo se conserva");
  const esperado = "v" + djb2(JSON.stringify(lista.perfiles) + "|" + JSON.stringify(lista.blocklist));
  igual(lista.version, esperado, "10. version es v+djb2(perfiles|blocklist), formato GAS");
  const lista2 = await g();
  igual(lista2.version, lista.version, "10. la versión es estable entre llamadas");
  const noToken = await worker.fetch(new Request("https://telemetria.test/?accion=listaAcceso"), { DB: db });
  igual(await noToken.text(), "no", "10. listaAcceso sin token → 'no'");
}

// 11. /vcheck: réplica de VersionCheck.gs.
{
  const v = await (await worker.fetch(new Request("https://telemetria.test/vcheck"), { DB: db })).json();
  igual(v.status, "ok", "11. vcheck responde status ok");
  igual(v.minVersion, "18.0.142", "11. minVersion replicada (misma que VersionCheck.gs)");
  t(/^[0-9a-f]{64}$/.test(v.expectedSha256), "11. expectedSha256 presente (64 hex)");
  t(typeof v.killSwitch.active === "boolean" && typeof v.canary.enabled === "boolean", "11. killSwitch y canary presentes");
}

// 12. "err" SIN quemar el lote (semántica v17.49.0 del GAS) — el caso más fino.
{
  db._sqlite.exec("DROP TABLE uso");
  const r1 = await enviaUx(db, "l-12", { abrir: 1 });
  igual(r1, "err", "12. fallo de escritura → 'err'");
  igual(filas(db, "SELECT COUNT(*) AS n FROM lotes WHERE lote='l-12'")[0].n, 0, "12. el lote NO quedó quemado (compensación)");
  db._sqlite.exec("CREATE TABLE uso (id INTEGER PRIMARY KEY AUTOINCREMENT, recibido TEXT NOT NULL, ts TEXT, dia TEXT, equipo TEXT, ver TEXT, lote TEXT, deDia TEXT, desde TEXT, n REAL, acciones TEXT)");
  const r2 = await enviaUx(db, "l-12", { abrir: 1 });
  igual(r2, "ok", "12. reintento del mismo lote tras el fallo → 'ok'");
  igual(filas(db, "SELECT COUNT(*) AS n FROM uso WHERE lote='l-12'")[0].n, 1, "12. exactamente una fila al final");
}

// 13. El cuerpo del acuse jamás es HTML ni JSON — texto plano exacto.
{
  const r = await post(db, { token: "vgl-2026", evento: "prueba", lote: "l-13", ts: "…", dia: "…", equipo: "…", ver: "…" });
  igual(r.headers.get("Content-Type") || "", "text/plain; charset=utf-8", "13. Content-Type text/plain (el cliente no cuenta HTML como recibido)");
}

// ════════════════════════ CIERRE ════════════════════════════════════════
console.log(`réplica telemetría — ${ok} ok, ${mal} mal, EXIT ${mal ? 1 : 0}`);
if (mal) {
  console.log("FALLOS:");
  for (const f of fallos) console.log("  ✗ " + f);
  process.exit(1);
}
