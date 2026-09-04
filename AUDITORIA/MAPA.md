# MAPA — Vigilante de Agenda v18.0.137 (arranque PASADA 0; cerrado en PASADA 6)

Método: solo `grep -n` + ventanas `sed -n` (Ley 8). Este archivo se ENRIQUECE, no se reescribe.
Desplazamiento: todo rango > L32009 suma +29 respecto al mapa de las reglas (v18.0.136).

## Zonas pesadas (inicio por grep; fin VERIFICADO = línea anterior a la siguiente declaración de nivel módulo)

| Función | Inicio (grep L-nº) | Fin verificado | Tamaño real | Nota |
|---|---|---|---|---|
| `injectLabsIntoCronicos` | 3402 | 3952 | ~550 | sig. decl.: `_labNumerico` L3953; sin cambio vs 136 |
| `buildOverlay` | 16724 | 20369 | ~3.645 | sig. decl.: `captureDoctorInfo` L20370; sin cambio vs 136 |
| `openAgendamientoModal` | 26626 | 29089 | ~2.463 | sig. decl.: `openLabSoloModal` L29090 (ayudantes anidados a indent 4, p.ej. `irAPaso` L26949, NO marcan fin); sin cambio vs 136 |
| `openOrdenamientoModal` | 29912 | 30764 | ~850 | sig. decl.: `mtrItemsOrdenarConducta` L30765; sin cambio vs 136 |
| **bloque disco v18.0.136-137** | 32197 | 32345 | — | desglosado abajo, función por función |
| `mtrRecalcularConFactores` | 36014 | 36160 | ~147 | sig. decl.: `mtrPanelFactoresDePantalla` L36161; Ley 2: 4 pérdidas de campos históricas |
| `mtrReglasRenalesAmpliadas` | 38678 | 39234 | ~556 | sig. decl.: `mtrGruposCatalogoRcv` L39235; 136: 38649-39205 (+29) |
| `mtrAbrirPanelRedaccion` | 45100 | 45828 | ~728 | sig. decl.: `mtrChipResumenTexto` L45829; 136: 45071-45799 (+29) |

Comando de arranque:
```bash
grep -n "function buildOverlay\|function openAgendamientoModal\|function openOrdenamientoModal\|function mtrAbrirPanelRedaccion\|function mtrReglasRenalesAmpliadas\|function injectLabsIntoCronicos\|function mtrRecalcularConFactores" vigilante_agenda.user.js
```

Verificación de finales (cierre, PASADA 6): `grep -nE '^[[:space:]]*(async[[:space:]]+)?function[[:space:]]+[A-Za-z_$]' vigilante_agenda.user.js` → **1.175 declaraciones, ninguna en columna 0**; el nivel módulo es indent 2. Cada «fin verificado» de la tabla es la declaración indent-2 siguiente menos 1 (ventana confirmada, no estimación heredada).

## Inventarios de riesgo (v18.0.137, contados por grep -c)

| Inventario | Reglas (136) | Hoy (137) | Comando |
|---|---|---|---|
| `catch (e) {}` mudos | 749 | **749** | `grep -c "catch (e) {}"` |
| `innerHTML` | 140 | **140** | `grep -c "innerHTML"` |
| `addEventListener` | 225 | **237** (+12) | `grep -c "addEventListener"` |
| `removeEventListener` | 14 | **14** | `grep -c "removeEventListener"` |
| `setInterval` | 20 | **27** (+7) | `grep -c "setInterval"` |
| `setTimeout` | 67 | **74** (+7) | `grep -c "setTimeout"` |
| `GM_xmlhttpRequest` | 43 | **40** (−3) | `grep -c "GM_xmlhttpRequest"` |

Alerta de deriva: `addEventListener` y `setInterval` crecieron desde el mapa de las reglas
(+12 y +7); `removeEventListener` sigue en 14. PASADA 2 debe dictaminar si los nuevos listeners
y timers del módulo de disco (136/137) tienen referencia guardada y retiro en `emergencyTeardown`.

**Dictamen (PASADA 2, cerrada):** las 27 coincidencias de `setInterval` se reducen a **18 llamadas
reales de página** (L1166 es `_navLogTimer`, que SÍ se retira; L10051 es comentario; L9903 es el
string-blob del Worker). El bloque de arranque L35307-35408 queda registrado vía `state.timers.push`
(L35361/35366/35431) y `emergencyTeardown` (L34595) lo barre. **Excepción confirmada:** el debounce
del disco vive en `_vglDiscoTimers` (Map L32211), ajeno a `state.timers` y al kill-switch → hallazgo
A de P5. Detalle en P2_CICLO_VIDA.md y P5_REFUTACION.md.

## Módulo de disco (nuevo desde 136; AUDITADO en esta sesión — ver P2/P4/P5)

- Suite 75 (48 casos): memoria en disco, migración, cuota llena.
- Suite 76 (15 casos): disco hostil (doble pestaña, permiso revocado, carpeta borrada, bloqueo OneDrive, paciente reabierto).
- Desglose verificado por declaración (indent 2):
  - `_vglDiscoEscribirMdAhora` L32197 (sig. decl. L32212; el Map `_vglDiscoTimers` vive en L32211, entre ambas).
  - `_vglDiscoProgramar` L32212 (clearTimeout L32214, delete L32217, set L32220 — nadie más toca el Map).
  - `_vglDiscoMemoriaRestaurar` L32268-32314 (sig. decl. L32315).
  - `vglDiscoMigrar` L32315-32345 (sig. decl. `_vglCarpetaRecuperarCrudo` L32346); candado `VGL_DISCO_MIGRADO_KEY` marcado antes de escribir.
- Dictamen de la auditoría específica (era «propuesto al médico, en espera de decisión»):
  - Escritura de `.md`/`vgl_cosecha.json`: revisada dentro del barrido de saneo de P4 (`escapeHtml` L33761 como saneador central); sin hallazgo S0/S1.
  - Validación de lo LEÍDO del disco: **hallazgo B confirmado (S3)** — `_vglDiscoMemoriaRestaurar` itera todas las claves sin tope (`VGL_COSECHA_MAX_PACIENTES=80` L5002 solo se aplica en `vglDiscoMigrar` L32326) y la fusión por `ts` deja ganar a un `ts` forjado, que se persiste vía `safeWriteJSON`.
  - Opciones de arreglo A-D para ambos hallazgos en COLA_FUTURO.md, decisión pendiente del médico.

## Pendiente del mapa (cerrado al final de PASADA 6)

- [x] Rango exacto de fin de cada zona pesada — verificado por «siguiente declaración indent-2»: tabla superior (los finales estimados de 136 resultaron exactos; `mtrRecalcularConFactores` mide real ~147 líneas, L36014-36160).
- [x] Inventario `innerHTML` y escape (PASADA 4) — 140 coincidencias totales; saneador central `escapeHtml` L33761; `bigAlert` L14590 sanea en L14599; `mtrSanearTextoLibreAI` L43134 para texto libre de IA; L28285 `innerHTML +=` es escapado/condicional/sin bucle (refutado como riesgo, queda nota de estilo). Detalle en P4_PHI_SEGURIDAD.md.
- [x] Timers con/sin referencia guardada (PASADA 2) — 18 llamadas reales de `setInterval`; bloque de arranque L35307-35408 registrado vía `state.timers.push`; excepción del disco documentada como hallazgo A. Detalle en P2_CICLO_VIDA.md.
- [x] Destinos `@connect` vs saneadores (PASADA 4) — lista completa L6-L27 (atheneasoluciones, appcita.viva1a.com.co, viva1a.com.co, sharepoint, microsoftonline, login.live.com, svc.ms, script.google.com + usercontent, gist.githubusercontent.com, generativelanguage.googleapis.com); 10 call sites directos de `GM_xmlhttpRequest` (L2017, L11517, L12887, L20843, L21131, L21153, L26529, L34540, L34835, L43780), todos hacia dominios declarados. Detalle en P4_PHI_SEGURIDAD.md.
- [x] Funciones que devuelven objeto literal + sus consumidores (PASADA 1) — caso emblemático `mtrRecalcularConFactores` (L36014-36160): consumidor A L26124 (`if (!factores) return;` / `if (!nuevo) return;`), consumidor B `mtrPanelResumenAlAbrir` L36195 (try/catch + `recalculado || resumenCacheado`). Detalle en P1_CONTRATOS.md.

Estado: **COMPLETO** (pasadas 0-6 ejecutadas; banco final 3.226 pasan / 0 fallan, idéntico al baseline; userscript intacto — sin cambios de código publicados en esta auditoría).
