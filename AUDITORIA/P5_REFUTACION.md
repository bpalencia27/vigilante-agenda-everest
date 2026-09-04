# PASADA 5 — Refutación adversarial de cada hallazgo (intento activo de REFUTAR)

Fecha: 2026-09-04 · Artefacto: `vigilante_agenda.user.js` v18.0.137.
Método: para cada hallazgo se buscó activamente la guarda, el call-site o el comentario
que lo neutralizara. Un hallazgo solo queda CONFIRMADO si todos los intentos de
refutación fallan, con cita. Veredictos: CONFIRMADO / PLAUSIBLE / REFUTADO.

---

## Hallazgo (a) — `emergencyTeardown` no limpia los debounces del módulo disco

**Afirmación:** tras el kill-switch remoto, un debounce pendiente (≤4 s) puede ejecutar
UNA escritura al disco local.

### Intentos de refutación (todos fallaron)

1. **«¿El teardown recorre el Map?»** NO. Ventana L34595-34620 (citada completa en
   `P2_CICLO_VIDA.md`): limpia `_relojDetenerTodo()`, `vglMinInstalar._obs`,
   `_navLogTimer`, el array `state.timers` y el DOM. El Map `_vglDiscoTimers`
   (L32211) no aparece:

```bash
grep -n "_vglDiscoTimers" vigilante_agenda.user.js
```

```
32211:  const _vglDiscoTimers = new Map();
32214:      const previo = _vglDiscoTimers.get(clave);
32217:        try { _vglDiscoTimers.delete(clave); } catch (e) {}
32220:      _vglDiscoTimers.set(clave, t);
```

   Solo se limpia al reprogramar la misma clave (L32214) o al disparar (L32217).
   Nadie más lo toca en todo el archivo.

2. **«¿La acción del debounce revisa `state.killed`?»** NO:

```bash
sed -n '32223,32234p' vigilante_agenda.user.js
```

```js
function vglDiscoMemoriaProgramar() {
  _vglDiscoProgramar("memoria", () => {
    if (!vglCarpetaElegida()) return;
    _vglDiscoMemoriaEscribirAhora().catch(() => {});
  });
}
function vglDiscoHistoriaProgramar(docId) {
  const clave = "hist|" + String(docId || "");
  if (clave === "hist|") return;
  _vglDiscoProgramar(clave, () => {
    if (!vglCarpetaElegida()) return;
    _vglDiscoEscribirMdAhora(docId, null).catch(() => {});
  });
}
```

   La única guarda es `vglCarpetaElegida()`, que pregunta por el handle de la carpeta,
   no por el kill. Y el módulo disco completo no conoce el kill:

```bash
sed -n '31950,32500p' vigilante_agenda.user.js | grep -c "state.killed"   # → 0
```

3. **«¿El escritor interno revisa el kill?»** NO. `_vglDiscoEscribirArchivo` (L32162)
   reintenta `VGL_DISCO_REINTENTOS` veces contra la carpeta local; cero referencias a
   `state.killed` en el módulo.

4. **«¿El debounce es tan raro que nunca estará pendiente al matar?»** No es raro:
   `VGL_DISCO_DEBOUNCE_MS = 4000` (L32009) y se programa en cada cambio de cosecha —
   exactamente el tráfico que existe durante una consulta activa, que es cuando un
   kill-switch remoto sería disparado.

### Veredicto: **CONFIRMADO — S3**

Impacto acotado: la escritura es al DISCO LOCAL (File System Access API, carpeta
elegida por el médico), sin red; el contenido es el espejo que el script ya estaba
autorizado a escribir; ocurre a lo sumo UNA vez y dentro de los 4 s posteriores al
kill; el kill persiste (`vgl_kill_active`) y el arranque siguiente no revive nada
(L35253). Es un hueco de SEMÁNTICA del apagado («el asistente dejó de vigilar» pero
espeja una última vez), no una fuga. → COLA_FUTURO (opciones A-D).

---

## Hallazgo (b) — `_vglDiscoMemoriaRestaurar` confía en el disco sin tope y por `ts` forjable

**Afirmación:** el `vgl_cosecha.json` leído del disco entra a memoria sin tope de
registros y un `ts` manipulado gana la fusión para siempre.

### Intentos de refutación

1. **«¿Hay validación de tamaño/estructura?»** Solo de forma: `JSON.parse` + check de
   que `cosecha` sea objeto no-array. El bucle itera TODAS las claves sin tope:

```bash
sed -n '32276,32284p' vigilante_agenda.user.js
```

```js
const remota = (disco && disco.cosecha && typeof disco.cosecha === "object" && !Array.isArray(disco.cosecha)) ? disco.cosecha : null;
if (!remota) return false;
const mezcla = Object.assign({}, _vglCosechaTodo());
let fusiono = false;
for (const k of Object.keys(remota)) {
  const r = remota[k];
```

2. **«¿El tope de 80 se aplica en alguna parte de la restauración?»** NO. El tope
   `VGL_COSECHA_MAX_PACIENTES = 80` (L5002) solo vive en la migración:

```bash
grep -n "VGL_COSECHA_MAX_PACIENTES" vigilante_agenda.user.js
# → 5002 (definición) · 32326 (vglDiscoMigrar: Object.keys(todo||{}).slice(0, 80))
```

3. **«¿La fusión protege la memoria fresca?»** NO contra un `ts` mayor: la regla es
   «gana el sello más reciente de cada lado» — un registro editado a mano con `ts`
   futuro derrota SIEMPRE al navegador:

```bash
sed -n '32285,32289p' vigilante_agenda.user.js
```

```js
const a = mezcla[k];
if (!a || typeof a !== "object") { mezcla[k] = r; fusiono = true; continue; }
if ((r.ts || 0) > (a.ts || 0)) { mezcla[k] = r; fusiono = true; }
```

   Y la mezcla ganadora se PERSISTE en el navegador (`safeWriteJSON(VGL_COSECHA_KEY, mezcla)`),
   es decir, el disco manipulado se convierte en la memoria oficial.

### Veredicto: **CONFIRMADO — S3** (hardening)

Requisito: manipulación o corrupción LOCAL de `vgl_cosecha.json` (quien la hace ya
posee el disco del consultorio). Consecuencias: (1) archivo gigante → reventar la
cuota de localStorage, el exacto modo de falla que este módulo existe para combatir;
(2) `ts` forjado → memoria clínica falsa/atrasada que gana y persiste silenciosamente.
No es explotable remoto, no es S0/S1/S2. → COLA_FUTURO (opciones A-D).

---

## Hallazgo (c) — `vglDiscoMigrar` escribe `.md` secuenciales con `await` en bucle

### Intento de refutación (_exitoso_)

```bash
sed -n '32320,32329p' vigilante_agenda.user.js
```

```js
// MIGRACIÓN DE UNA SOLA VEZ: vuelca TODA la cosecha del navegador a la carpeta (una
// historia .md por paciente + el respaldo maquinable completo). El candado se marca
// ANTES de escribir para que un cierre a mitad no la repita en cada arranque; repetir
// la escritura es idempotente (los .md se reescriben con el mismo contenido).
async function vglDiscoMigrar() {
  try {
    if (!vglCarpetaElegida()) return false;
    if (localStorage.getItem(VGL_DISCO_MIGRADO_KEY) === "1") return false;
    try { localStorage.setItem(VGL_DISCO_MIGRADO_KEY, "1"); } catch (e0) {}
```

   Corre UNA vez por vida del navegador (candado marcado antes del primer byte),
   tope 80 pacientes, fuera de toda ruta periódica. El `await` serializado evita
   saturar la API de archivos. Es diseño declarado, no defecto.

### Veredicto: **REFUTADO** — by design, idempotente, una sola vez. Descartado.

---

## Hallazgo (d) — L28285 usa `innerHTML +=` (vivo)

### Intento de refutación (_exitoso_)

Cita literal en `P4_PHI_SEGURIDAD.md` §3: la interpolación pasa por `escapeHtml`,
el bloque es condicional (`_pendAgm.length > 0`), corre fuera de bucle y una vez por
render del banner de sugerencias. Los otros cuatro `innerHTML +=` del archivo son
comentarios de bugs ya corregidos.

### Veredicto: **REFUTADO como riesgo** — queda nota de estilo en COLA_FUTURO
(costo menor del re-parseo del banner; opción de refactor, sin urgencia clínica).

---

## Tabla resumen de PASADA 5

| Hallazgo | Veredicto | Severidad | Destino |
|---|---|---|---|
| (a) teardown no limpia debounces de disco | CONFIRMADO | S3 | COLA_FUTURO (opciones) |
| (b) restauración sin tope + `ts` forjable | CONFIRMADO | S3 | COLA_FUTURO (opciones) |
| (c) `await` serial en migración | REFUTADO (by design) | — | descartado |
| (d) `innerHTML +=` L28285 | REFUTADO como riesgo | nota | COLA_FUTURO (estilo) |

**Conclusión para PASADA 6: CERO hallazgos S0/S1 confirmados → el userscript NO se
toca.** Sin bump de versión, sin Gist. Solo queda documentar, verificar el banco y
publicar la auditoría.

Estado: **COMPLETO.**
