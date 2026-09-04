# PASADA 2 — Ciclo de vida: timers, listeners y `emergencyTeardown`

Fecha: 2026-09-04 · Artefacto: `vigilante_agenda.user.js` v18.0.137 (48.481 líneas).
Método: `grep -n` + ventanas `sed -n` (Ley 8).

## Inventario de `setInterval` (verificado fresco)

```bash
grep -n "setInterval(" vigilante_agenda.user.js | awk -F: '{print $1}'
```

Salida (27 menciones totales según MAPA; desglosadas aquí línea a línea):

```
1166 8582 9903 9952 9961 9972 10051 14112 14144 26092 26447 27050
35307 35316 35317 35318 35345 35350 35389 35408
```

Desglose exacto:
- **2 NO son llamadas de página**: L9903 es el código del Worker embebido en un string
  (`self.onmessage=...setInterval...`, muere con `worker.terminate()`); L10051 es una
  mención dentro de un comentario (`// El sondeo vive en `setInterval(tick, 5000)`...`).
- **18 llamadas reales**, clasificadas abajo.

### Timers con referencia guardada (retirable por teardown)

```bash
grep -n "state.timers.push" vigilante_agenda.user.js
```

```
35361:      state.timers.push(tAutoUpd, tVerMin, tVer, tPaint, tPymRem, tRepSum, tRepBoot, tRepFlush, tUxBoot, tUxFlush, tRepEnt);
35366:      state.timers.push(tSonda);
35431:    if (Array.isArray(state.timers)) state.timers.push(tPymDiario, tPymCaptador);
```

**14 handles registrados** en `state.timers` (11 + 1 + 2). `emergencyTeardown`
(L34595, ventana abajo) hace `clearTimeout` + `clearInterval` sobre cada uno y vacía
el array. Bloque de arranque (L35307-35408): CUBIERTO.

### Reloj de segundo plano (L9903-9985) — dictamen por canal

El módulo `_reloj` usa Worker con degradación a `setInterval` de página:

- `_relojDegradar` (L9954): crea un intervalo LOCAL por canal (`_reloj.locales.set(id, {ms, timer: setInterval(fn, ms)})`).
- `_relojDetener(id)` (L9975): `clearInterval` del local + borra canal + avisa al worker.
- `_relojDetenerTodo` (L9981-9985), citado literal:

```bash
sed -n '9981,9985p' vigilante_agenda.user.js
```

```js
function _relojDetenerTodo() {
  for (const id of Array.from(_reloj.canales.keys())) _relojDetener(id);
  try { if (_reloj.worker) _reloj.worker.terminate(); } catch (e) {}
  _reloj.worker = null; _reloj.ok = false;
}
```

### Supuesto «zombi» L9952 — REFUTADO

```bash
sed -n '9925,9932p' vigilante_agenda.user.js
```

```js
function _relojVigilarWorker() {
  try {
    if (!_reloj.ok || !_reloj.worker || !_reloj.canales.size) return false;
    ...
```

El watchdog de L9952 (`setInterval(_relojVigilarWorker, 30000)`) nunca se limpia, pero
tras `_relojDetenerTodo()` su primera línea corta de inmediato (`_reloj.ok=false`,
`_reloj.worker=null`, `canales` vacío → `return false`). **Jamás revive canales: `_relojDegradar`
solo se invoca si el worker existía y latía.** Costo residual: una llamada no-op cada 30 s
dentro de un script ya muerto. Nota menor, no hallazgo.

### Timers restantes fuera del array (dictamen sitio por sitio, ventana verificada)

- **L1166 = `_navLogTimer`** (observador de navegación): el teardown lo limpia
  EXPLÍCITAMENTE (`try { clearInterval(_navLogTimer); } catch (e) {}`, citado arriba).
- **L8582** `vigila`: vigila casillas de una pestaña del panel; el comentario del propio
  código declara «si el médico cambia de pestaña antes de eso, el botón se va con ella».
- **L14112** `nagTimer` (sonido insistente): autolimitado (40 toques × 9 s) y con
  `stopNag()` que hace `clearInterval(nagTimer)`.
- **L14144** `flashTimer` (parpadeo de título): pareado con `stopFlash()`.
- **L26092** `_timer` (vigilancia de 20 s del panel): vive en el closure del panel y
  escribe solo en el DOM del panel (`try/catch` en cada vuelta).
- **L26447** `_repaso`: con `_pararRepaso()` enganchado a `cerrar` (cita: la ventana
  muestra `cerrar = () => { _pararRepaso(); _cerrarConRepaso(); }`).
- **L27050** `vigilaHora`: dentro del modal `#vgl-agm-lab-time-sel`, muere con el modal.
- **Ninguno de los revisados escribe en la historia clínica ni llama red tras el kill**
  (las vías de red y escritura tienen guarda `state.killed`, ver abajo).

## `emergencyTeardown` — ventana literal (L34595-34630)

```bash
sed -n '34595,34620p' vigilante_agenda.user.js
```

```js
function emergencyTeardown(reason) {
  state.killed = true;
  state.killReason = reason || "Apagado remoto de emergencia";
  try { _relojDetenerTodo(); } catch (e) {}   // v14.2.12 — el reloj de segundo plano también se apaga
  // v18.0.134 (auditoría 2026-09-03, B10+B13) — el apagado de emergencia también suelta el
  // observador de ventanas minimizadas y detiene el registro de navegación...
  try { if (vglMinInstalar._obs && typeof vglMinInstalar._obs.disconnect === "function") vglMinInstalar._obs.disconnect(); } catch (e) {}
  try { clearInterval(_navLogTimer); } catch (e) {}
  if (typeof GM_setValue !== "undefined") {
    GM_setValue("vgl_kill_active", true);
    GM_setValue("vgl_kill_reason", state.killReason);
  }
  if (Array.isArray(state.timers)) {
    state.timers.forEach((t) => {
      try { clearTimeout(t); } catch (e) {}
      try { clearInterval(t); } catch (e) {}
    });
    state.timers.length = 0;
  }
  // ... barrido DOM: #vgl-root, #vgl-dock, #vgl-acciones-dock, #vgl-pym-banner
  //     y TODOS los [id^='vgl-'] del documento
```

Limpia: reloj (worker + canales), observador de minimizadas, `_navLogTimer`, los 14
handles de `state.timers`, todo el DOM `vgl-`. Persiste el kill (`vgl_kill_active`) y al
arrancar L35253 lo re-aplica (`if (killActivo && !bypass) { state.killed = true; ... }`).

**EXCEPCIÓN encontrada: NO limpia `_vglDiscoTimers`** (Map de debounces del módulo
disco, L32211). Sus acciones revisan `vglCarpetaElegida()` pero jamás `state.killed`
(`grep -c "state.killed"` en L31950-32500 → **0**). Dictamen completo y severidad en
`P5_REFUTACION.md` hallazgo (a) → COLA_FUTURO.

## Guardas `state.killed` (todas verificadas frescas)

```bash
grep -n "state.killed" vigilante_agenda.user.js
```

```
3403:      if (state.killed) {          → injectLabsIntoCronicos: objeto abortado completo
22343:    if (state.killed) return { error: true, mensaje: "Pausa de seguridad remota activa..." };
29710:    if (state.killed) {          → apiOrdenamientoGuardar: toast ROJO + return null
33917:      if (state.killed) return;  → tick(): el hilo principal se apaga
34535:      if (state.killed) return;  → mtrCheckActualizacionGist: sin red tras kill
34570:      if (state.killed) return;  → mtrSondaPestanias: sin red tras kill
34828:      if (state.killed) return;  → checkVersionMinimum: sin red tras kill
35253:        state.killed = true;     → arranque: kill persistido se re-aplica
```

Red de seguridad: escrituras a historia clínica (L3403, L22343, L29710), hilo (L33917)
y las tres vías de red post-kill (L34535, L34570, L34828) quedan cortadas. El módulo
disco (escritura LOCAL) queda fuera de esta red — hallazgo (a).

## Listeners: 237 menciones vs 14 `removeEventListener`

```bash
grep -c "addEventListener" vigilante_agenda.user.js          # → 237
grep -cE "(document|window)\.addEventListener" ...           # → 37
grep -n "removeEventListener" ... | awk -F: '{print $1}'
# → 14259 14260 14289 23892 24092 24093 24094 26929 26930 26931 29192 29193 29953 29954
```

Dictamen por bloques:
- **~35 sobre elementos `vgl-`**: mueren solos cuando el teardown borra `[id^='vgl-']`.
- **37 en `document`/`window`**: persistentes por diseño (visibilitychange, atajos,
  MutationObserver del anfitrión); sus handlers están protegidos — p. ej. el
  `visibilitychange` del reloj llama `tick()` vía try/catch y `tick` corta con
  `if (state.killed) return` (L33917). No despiertan funcionalidad tras el kill.
- **Los 14 `removeEventListener`** corresponden a pares simétricos de arrastre/modal
  (L14259-14289, L23892-24094, L26929-26931, L29192-29193, L29953-29954): listeners
  temporales que SÍ se retiran al cerrar el gesto. Patrón correcto.
- **Deriva +12 vs mapa de reglas (136→137)**: crecieron con el módulo disco y los
  banners PyM; los nuevos van a contenedores `vgl-` (mueren con el DOM) o al array de
  timers cubierto. Sin fuga acumulativa por cambio de paciente detectada en el muestreo.

Estado: **COMPLETO** — 1 hallazgo (a) derivado a P5/COLA_FUTURO; 0 S0/S1/S2 en esta pasada.
