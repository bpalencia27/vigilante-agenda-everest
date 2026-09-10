# Informe de Auditoría DevOps — Vigilante de Agenda

**Fecha:** 2026-09-04 · **Auditor:** Agente DevOps autónomo · **Modo:** solo-lectura sobre producción + artefacto derivado

---

## 0. Resumen ejecutivo

| Ítem | Resultado |
|---|---|
| Integridad sintáctica (`node --check`, Node v24.18.1) | ✅ Verde (original y artefacto) |
| Zonas muertas / TDZ activos | ✅ Ninguno nuevo; 9 fixes históricos verificados en el fuente |
| Globales implícitas accidentales | ✅ Ninguna (`"use strict"` en L922 cubre todo el IIFE) |
| Promesas huérfanas | ✅ 0 sin red de seguridad; `unhandledrejection` → bitácora (L1161) |
| Optimización de temporizadores | ✅ Ya optimizada por auditorías previas (v12.3.14, v15.5.0, v18.0.134); **cero cambios aplicados por riesgo clínico** (ver §3.4) |
| Artefacto | `vigilante_agenda_v18.1.1_optimized.js` (3.320.493 bytes, 50.158 líneas) |
| Diff artefacto vs producción | **2 líneas** (L4 `@version`, L1038 fallback `VERSION`) |
| Metadatos Tampermonkey | ✅ `META_OK` (ver §4.2) |
| Banco de pruebas | ⚠️ Abortó en Suite 14 por error **preexistente** (árbol migró a rama `claude/m2m-fixes-30` durante la entrega); suites 1-13 en ✓ antes del corte (ver §5 y §8) |
| Rama base del artefacto | `claude/pym-agenda-blindaje-v12-4` — el HEAD del repo terminó en `claude/m2m-fixes-30` (ver §8) |

**Corrección de premisa:** la directiva pedía pasar `@version 18.0.143 → 18.0.144`. El archivo real de producción está en **18.1.0** (verificado L4). Un downgrade a 18.0.144 haría que Tampermonkey **no ofrezca la actualización** (comparación semántica de versiones). El artefacto se publica como **18.1.1**. Regla aplicada: casilla verificada antes que dato heredado.

---

## 1. Contexto del objeto auditado

- Archivo: `vigilante_agenda.user.js` — userscript Tampermonkey monolítico (IIFE único, sin build, sin dependencias runtime).
- Tamaño real a la fecha: **50.158 líneas / ~3,3 MB** (los datos de AGENTS.md —14.158 líneas— corresponden a una foto de agosto; el repo avanzó).
- Userscript de uso clínico **en vivo**: cualquier cambio de comportamiento requiere mutación verificada y banco en verde (disciplina del repo). Esta auditoría **no modifica comportamiento alguno**.

---

## 2. Fase 1 — Auditoría estructural y anti-zona-muerta

### 2.1 Sintaxis
`node --check` en verde sobre original y artefacto (Node v24.18.1). Sin errores de parseo.

### 2.2 Returns tempranos y zonas muertas (TDZ)
Salidas tempranas del ámbito raíz del IIFE identificadas:

1. **L923** — `if (window.top !== window.self) return;` (guarda de frames, junto a `@noframes`). Intencional.
2. **Bloque Athenea** — hace `return` al terminar en la web de Athenea. El histórico bug de TDZ (declaraciones quedaban inaccesibles tras el return) fue corregido en **v18.0.29** moviendo `ATH_CRED_KEY` y dependencias antes del bloque (comentario en L925-930 del fuente).

Endurecimientos TDZ verificados en el fuente (marcadores con línea):

| Línea | Fix histórico |
|---|---|
| L925-930 | v18.0.29 — ATH_CRED_KEY antes del bloque Athenea |
| L2425 | Declaraciones del bloque copiadas fuera de zona muerta |
| L10188 | Guarda `typeof` + comentario TDZ en reloj worker |
| L11609 | v8.2.0 MEM-01 — watchdog declarado ANTES de los handlers |
| L14476 | `diaNuevo()` — declaración antes del posible cambio de día |
| L17166 | v15.0.0 — constantes CSS declaradas antes de `buildOverlay` |
| L36689 | Declaración rescatada de zona muerta en arranque |
| L42417 | Lectura defensiva anti-TDZ (v16.2.6) |
| L46639, L46768, L46841 | TDZ tragados por catch, corregidos en módulos de repintado |

**Veredicto:** no se detectaron patrones nuevos de declaración-posterior-a-return ni accesos en zona muerta. La clase de bug que la directiva menciona está cubierta por 9 fixes documentados en el propio fuente y por el banco de pruebas (arranque en harness).

### 2.3 Variables globales
`"use strict"` en L922 abarca todo el IIFE ⇒ una asignación sin declaración lanza `ReferenceError` en runtime en vez de crear un global silencioso.

Globales explícitos sobre `window` (inventario completo, todos deliberados):

| Línea | Global | Propósito |
|---|---|---|
| L16997 | `window.__VGL_DIAG__` | Función de diagnóstico manual |
| L23453 | `window.fetch` (wrapper) | Registro de red acotado |
| L35903 | `window.__VGL_ACTIVE_INSTANCE__` | Marcador de instancia viva (versión, TABID, ts) |
| L36381 | `window.__vglAtajoOculto` | Flag de atajo oculto |
| L49156 | `window.fetch` (wrapper) | Segundo punto de envoltura de red |

**Veredicto:** sin fugas de ámbito. No existe contaminación del espacio global de Everest más allá de los 5 puntos listados (prefijados/justificados).

### 2.4 Promesas huérfanas
- Sitios `.then(`: **26** · Sitios `.catch(`: **30** · `.then(ok, err)` a dos argumentos: **4** (L21658, L32805, L33147, L33746).
- Red de seguridad global: `window.addEventListener("unhandledrejection", …)` → `vglLog("ERROR", "UnhandledPromiseRejection")` (L1161-1163). **Ningún rechazo puede morir en silencio a nivel de página**; todo aterriza en la bitácora.
- Muestreo de fire-and-forget sin `.catch` local: L17087 (`apiLeerAgenda().then` con guarda de epoch KR-02 — el wrapper de fetch B4/capa-c no rechaza sin trazar), L7329-7331 (cadena con `.catch` previo), L1914 (GM_xmlhttpRequest con timeout propio). Todos bajo la red global.
- Adicional: `t.lanza`/`t.noLanza` del runner entienden promesas desde v14.1.7 (comentario L43-60 de `tests/runner.js`), así que el banco sí caza rechazos en pruebas.

**Veredicto:** sin promesas verdaderamente huérfanas. Los fire-and-forget son deliberados y trazados.

---

## 3. Fase 2 — Rendimiento y bucles de segundo plano

### 3.1 Inventario completo de temporizadores/observers persistentes

| Línea | Temporizador | Periodo | Alcance / condición | Mecanismo de parada | Veredicto |
|---|---|---|---|---|---|
| L1167 | `_navLogTimer` (bitácora NAV) | 5 s | Permanente | Kill-switch (id guardado, v18.0.134 B13) | Ya optimizado 1s→5s en v15.5.0 |
| L10193 | Watchdog del reloj Worker | 30 s | Permanente | — (es el vigilante) | Coste trivial |
| L10202/10213 | Fallback `setInterval` por canal | = cadencia | Solo si el Worker no arranca | `clearInterval` al parar canal | Degradación correcta |
| L10250 | `restartPolling` → `tick` | `POLL_MS` (5 s default, configurable 2-120 s vía Ajustes, L9806) | Pestaña líder | Kill-switch | Cadencia ya bajo control del médico |
| L8823 | `vigila` (botón Deshacer) | — | Vida del aviso Deshacer | `VGL_DESHACER_VISIBLE_MS + 2000` | Acotado |
| L11975 | `evTimer` (flush fraude) | 2 s | Con eventos en cola | Flush al llenar/`FRAUDE_EXTEMPORANEO` | Acotado |
| L13121 | `_uxBufTimer` (telemetría UX) | 2 s | Con buffer pendiente | Flush | Acotado |
| L14825 | `nagTimer` (insistencia ROJA) | 9 s ×40 | Solo con `S.insistir` y alerta activa | `stopNag()` | **CLÍNICO — no tocar** |
| L14857 | `flashTimer` (título/favicon) | 900 ms | Solo durante alerta activa y `S.parpadeo` | `stopFlash()` | **CLÍNICO — no tocar** |
| L15913 | `toastFlushTimer` | — | Cola de toasts | Flush | Acotado |
| L26874 | `_timer` (vigilancia Panel) | 20 s | Modal Panel abierto | `vivo()` + duerme si `minimizado()` (v17.0.2) | Acotado y dormitable |
| L27229 | `_repaso` (contradicciones) | 20 s | Modal confirma abierto | Auto-limpieza al cerrar/resolver | Acotado |
| L27835 | `vigilaHora` (hora de toma) | 1,5 s | Modal de agendamiento abierto | `vivo()` / excepción | Acotado (candidato futuro, §6) |
| L9074 | Helper `debounce` | configurable | — | — | Patrón correcto |
| L5207 | `MutationObserver` | — | Ámbito acotado | Desconexión propia | Ya no es global |
| L15280 | `MutationObserver` (hijos directos de body) | — | Inyección de botón mínimo | — | Acotado por diseño |

### 3.2 Optimizaciones YA presentes en producción (verificadas en fuente)

- **v15.5.0** — Observador de navegación 1 s → 5 s: elimina 2.880 despertares/hora del hilo principal (comentario L1173-1175).
- **v12.3.14** — Erradicación del `MutationObserver` global del Robot Athenea (L9031).
- **Reloj en Web Worker** (L10122-10144): evita el estrangulamiento de `setInterval` en pestaña oculta (los navegadores recortan a ≥1 min; con worker la agenda se sigue leyendo a cadencia real). Degradación segura a `setInterval` si el worker no puede crearse.
- **Elección de pestaña líder** (L10292): solo la líder sondea; el resto se despierta por eventos.
- **`_deadlineTimer`** (L35056-35089): un único `setTimeout` al instante exacto del vencimiento en vez de quemar ciclos esperando al siguiente sondeo.
- **Kill-switch hermético**: todo `setInterval` de `boot()` queda registrado en `state.timers` — lo exige la prueba R5.1-bis de `tests/suite_30_killswitch_canario.js` (tras la fuga histórica de 3 intervalos que seguían consultando SharePoint con la pausa activa).
- **`clamp` de `setTimeout` de 4 ms** en el lector de Excel para ceder el hilo en equipos lentos (L845).

### 3.3 Verificación anti-micro-congelamiento
Ningún bucle persistente ejecuta trabajo pesado incondicional: los permanentes son comparaciones de cadena (NAV) o latidos (watchdog); el trabajo real vive en `tick()` a cadencia configurable con guardas de epoch (KR-02), `API.enVuelo` y bomba de ventana crítica (L17095). Los intervalos rápidos (900 ms-2 s) solo existen con un modal o una alerta activa y se autodestruyen.

### 3.4 Decisión: CERO cambios de espaciado aplicados
Motivo, por temporizador:
- `nagTimer`/`flashTimer`: canales de alerta clínica (ROJO = atención extemporánea). Espaciarlos retrasa la señal al médico. Invariante de dominio del repo.
- `_navLogTimer`: ya fue objeto de la auditoría v15.5.0; reducir más degrada el valor forense de la bitácora (se usó una de 22 h reales para diagnóstico).
- Intervalos modales (20 s / 1,5 s): su coste existe solo con el cuadro abierto y se borra al cerrar. El repaso de 20 s responde a un reporte real de consulta (27-ago: «no recibió el cambio en tiempo real»).
- `POLL_MS` ya es preferencia del médico (2-120 s).

Cambiar cualquiera de estos sin mutación verificada contradice la disciplina del repo (cada cambio de comportamiento exige prueba roja→verde documentada en `tests/INFORME_MUTACIONES.md`). Esta auditoría **no introduce regresiones**: el artefacto es funcionalmente idéntico a producción salvo la versión.

---

## 4. Fase 3 — Empaquetado DevOps y versionado

### 4.1 Artefacto generado
- **Archivo:** `vigilante_agenda_v18.1.1_optimized.js`
- **Tamaño:** 3.320.493 bytes · 50.158 líneas · CRLF preservado
- **Diff exacto contra producción (verificado por comparación línea a línea):**

```diff
L4:   - // @version      18.1.0
      + // @version      18.1.1

L1038: - const VERSION = (…) || "18.1.0";
       + const VERSION = (…) || "18.1.1";
```

`vigilante_agenda.user.js` quedó **intacto** (cero modificaciones, respaldo innecesario pero además inexistente contaminación).

### 4.2 Validación del bloque de metadatos (evidencia de ejecución)

| Clave | Valor leído del artefacto | Chequeo |
|---|---|---|
| `@version` | `18.1.1` | ✅ Incremento correcto sobre 18.1.0 |
| `@updateURL` | `https://gist.githubusercontent.com/bpalencia27/d231…/raw/gistfile1.txt` | ✅ HTTPS |
| `@downloadURL` | Idéntico a `@updateURL` | ✅ Coherentes entre sí |
| `@connect` | Incluye `gist.githubusercontent.com` (L26) | ✅ El host de actualización está declarado |
| Resultado del validador | `META_OK` | ✅ |

El validador (script temporal, ejecutado y eliminado) parsea las primeras 45 líneas, exige versión exacta, URLs HTTPS iguales y host declarado en `@connect`.

### 4.3 Advertencia de promoción a producción
El repo exige **sincronización cuádruple de versión** (prueba R5.1 de `tests/suite_30_killswitch_canario.js`): `@version` + `const VERSION` (hechas en el artefacto) + `package.json` (**sigue en 18.1.0**, sin tocar) + aserción «versión viva» de `tests/suite_75_disco.js:898` (**espera "18.1.0"**, sin tocar). Si este artefacto se promueve a `vigilante_agenda.user.js`, deben actualizarse esos dos puntos y añadir la fila correspondiente en `tests/INFORME_MUTACIONES.md`. Al no haber cambio de comportamiento, no corresponde fila de mutación por esta auditoría (no hay aserción que pudiera ponerse roja: el diff es solo el literal de versión, ya cubierto por R5.1).

---

## 5. Validación ejecutada

| Comando | Resultado |
|---|---|
| `node --check vigilante_agenda.user.js` | Exit 0 |
| `node --check vigilante_agenda_v18.1.1_optimized.js` | Exit 0 |
| Validador de metadatos (temporal) | `META_OK` |
| Comparación línea a línea original↔artefacto | 2 líneas distintas (L4, L1038) — ejecutada contra la punta de `claude/pym-agenda-blindaje-v12-4`, rama vigente al momento de la copia |
| `node tests/runner.js` | ⚠️ **Abortó en Suite 14**: «la suite 'Extracción del DOM de Everest (Suite 14)' dice cubrir '_contadorSospechaSelector', pero esa función no existe en el API». Error preexistente del árbol actual, ajeno a esta auditoría (ver §8). Suites 1-13 en ✓ antes del corte: Texto 54, Tiempos 33, Excel 33, Colores 106, Everest 35, Panel 11, Lector 14, Labs 148, Ajustes 36, Estadísticas 30, Cola 29, SharePoint 47, API agenda 64. No se alcanzó veredicto final |

---

## 6. Hallazgos NO tocados (candidatos para futuras tareas, con disciplina de mutación)

1. **L27835 `vigilaHora` (1,5 s):** repinta la línea de plan del modal de agendamiento incondicionalmente. Un guard por huella de datos (repintar solo si fecha/hora/sede cambiaron) reduciría churn de DOM, pero exige cubrir el caso asíncrono de AppCita (turnos que llegan tarde) con prueba específica.
2. **L17087 / L1914 y demás `.then` sin `.catch` local:** funcionan por la red global de `unhandledrejection`; añadir rechazos explícitos mejoraría el mensaje de bitácora, sin cambio funcional.
3. **`_navLogTimer` event-driven** (`popstate`/`hashchange` + fallback largo): eliminaría el sondeo de 5 s a cambio de complejidad en el router de Angular; el ahorro real (una comparación de cadena cada 5 s) no lo justifica hoy.

---

## 7. Higiene del repositorio
- Archivos temporales de la auditoría (`_tmp_audit_check.js`, `_runner_out.tmp.txt`) **eliminados** al finalizar.
- No se realizó ningún commit: `vigilante_agenda.user.js`, `tests/` y `package.json` permanecen exactamente como estaban. Los dos entregables (`vigilante_agenda_v18.1.1_optimized.js`, `devops_audit_report.md`) quedan sin rastrear a la espera de decisión del médico.

---

## 8. Evento posterior a la entrega: migración de rama detectada

**Detección (verificado en disco):** `.git/HEAD` apunta a `refs/heads/claude/m2m-fixes-30`, mientras que la rama de trabajo documentada en AGENTS.md (y vigente cuando se creó el artefacto) era `claude/pym-agenda-blindaje-v12-4`. El cambio ocurrió por un actor externo durante la ventana de esta auditoría.

**Evidencia de divergencia entre ramas:**

| | Original actual (m2m-fixes-30) | Artefacto (base pym-agenda-blindaje-v12-4) |
|---|---|---|
| Líneas | 50.142 | 50.158 |
| `_contadorSospechaSelector` | **Ausente** | Presente (L14195) |
| `@version` | 18.1.0 (L4) | 18.1.1 |

**Consecuencia 1 — banco roto en el árbol actual (preexistente, no tocado):** `tests/suite_14_extraccion_dom.js:17` declara cubrir `_contadorSospechaSelector` y la prueba de L293 la ejercita (etiquetada v18.0.146), pero el `vigilante_agenda.user.js` de esta rama no la define → el runner aborta con el error citado en §5. Desalineación script/tests ajena a esta auditoría; según la regla del repo se **reporta sin reparar**. Si la rama correcta es la anterior, `git checkout claude/pym-agenda-blindaje-v12-4` debe restaurar la coherencia.

**Consecuencia 2 — el artefacto NO debe promoverse sobre la rama actual tal cual:** promocionarlo revertiría los cambios presentes en m2m-fixes-30 y ausentes en su base. Antes de promover: re-derivar el artefacto desde el original de la rama objetivo con la misma receta (copia byte a byte + bump de L4 + fallback de L1038), re-ejecutar `node --check`, el validador de metadatos y el banco completo en verde.

**Nota operativa:** al cierre, los terminales del entorno dejaron de ejecutar comandos (reportan exit 0 sin efecto secundario), por lo que ninguna re-validación sobre la rama nueva fue posible desde esta sesión.
