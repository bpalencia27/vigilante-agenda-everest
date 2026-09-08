# Informe de rendimiento — BASELINE v0 (F-P1)

**Fecha:** 2026-09-07 · **Commit base:** `691d8dc` (v18.6.2 en curso, UI de toggles F3)
**Entorno:** Node.js v24.18.1 · Windows 11 · banco secuencial (`node tests/runner.js`)
**Estado del código:** SIN optimizar. Regla de la delegación cumplida: PROHIBIDO
optimizar antes del baseline — ninguna línea de `vigilante_agenda.user.js` se tocó
por rendimiento para producir estas cifras.

## Método

`tests/suite_94_rendimiento.js` (suite nueva, 11/11 verde). Tres partes:

- **A — Micro-bench p50/p95**: `process.hrtime.bigint()` (reloj monótono de
  proceso, inmune al reloj de pared), 20 iteraciones de calentamiento + 300
  medidas por función. Anti-flaky: la suite NO aserta umbrales de rendimiento;
  aserta solo el resultado correcto y una cota de seguridad de 100 ms por
  llamada (caza bucles infinitos/cuadráticos; imposible de disparar en CI sana).
  Los percentiles se imprimen con `[PERF-94]` y viven en este informe.
- **B — Conteo de red por flujo**: mock de `fetch` con la forma real de
  `_pageFetchJsonCore`, contando peticiones por flujo.
- **C — Reloj congelado**: el contexto vm tiene su propio `Date`; se congela
  DESDE DENTRO con `runInContext("Date.now = …")` (cada `cargar()` fabrica su
  propio contexto: cero contaminación cruzada). Los TTL se verifican sin esperar
  tiempo real.

## A — Micro-bench (p50/p95 en µs, 300 iteraciones)

| Función | p50 | p95 | Nota |
|---|---|---|---|
| `togActiva("tog_agendar")` | 0.8 | 1.3 | lectura de toggle por médico |
| `mtrNormalizarNombre` | 1.2 | 2.0 | normalización pura (acentos, mayúsculas) |
| `readJSON("vgl_tog_707")` | 0.6 | 0.7 | lectura del almacén GM |
| `extractPacienteAbierto` | 8.8 | 18.9 | barrido `.text-muted` con HC abierta (la llamada del tick) |
| `accesoCap("agendar_control")` | 4.3 | 4.8 | decisión de capacidad (perfil COMPLETO) |

## B — Contratos de red (conteo de peticiones por flujo)

| Flujo | Peticiones hoy | Contrato vivo en la suite |
|---|---|---|
| `apiAccesoBuscarPaciente`, peor caso (sin paciente en ninguna ruta) | **2** | intenta las 2 rutas de la cascada; 1ª lleva `TipoDocumento=CC` |
| `apiAccesoBuscarPaciente`, acierto | **1** | acierto a la 1ª ruta + caché de 10 min (2ª lectura: 0 red) |
| Cadena HC (clic → prefetch) | **2** | 1 búsqueda de paciente + 1 órdenes vigentes, nada más |

## C — TTL verificados con reloj congelado

| Mecanismo | TTL | Verificación |
|---|---|---|
| Hint HC (contexto del clic) | 15 s | 0 s → vivo; 16 s → null (sin paciente fantasma) |
| Caché cédula → id interno | 10 min | reloj quieto → 0 red extra; +600 001 ms → refetch |
| Caché de órdenes vigentes | 10 min | reloj quieto → 0 red extra; +600 001 ms → refetch |

## Métricas M1–M6 (seguirán en el informe antes/después de F-P5)

- **M1** p95 `extractPacienteAbierto` (µs) — hoy **18.9**
- **M2** p95 `togActiva` (µs) — hoy **1.3**
- **M3** peor caso de la cascada de `apiAccesoBuscarPaciente` (peticiones) — hoy **2**
- **M4** cadena HC por clic (peticiones) — hoy **2**
- **M5** acierto + caché (peticiones en 2 lecturas) — hoy **1**
- **M6** TTLs (hint 15 s · cachés 10 min) — hoy **verificados**

## Qué rompe la suite cuando lleguen las optimizaciones (y por qué es la mutación)

La aserción de **M3 = 2** fija el peor caso ACTUAL de la cascada. Cuando F-P2
retire la ruta de respaldo sin `TipoDocumento`, esa misma aserción se pondrá
ROJA — esa es la mutación verificada del cambio — y se actualizará a **1** con
su fila en `tests/INFORME_MUTACIONES.md`. Ninguna otra aserción de la suite
depende del hardware: un banco lento no la pone roja.

---

## F-P2 APLICADO (v18.6.2) — quick wins sobre el baseline

| Pieza | Qué se hizo | Mutación verificada (suite_94) | Estado de M |
|---|---|---|---|
| P1 (cascada) | Retirada la ruta de respaldo SIN `TipoDocumento` de `apiAccesoBuscarPaciente`: el HAR de producción la muestra devolviendo 400 3/3 (INFORME_EVIDENCIA_HAR §9.4.1). El peor caso baja de 2 peticiones a 1 — y deja de gastarse una petición FALLIDA por búsqueda (incluido el prefetch de HC) | aserción M3 era 2 → roja al retirar → actualizada a 1 | **M3: 2 → 1** |
| P2 (memo tick) | La cédula del paciente se lee UNA vez por tick (`state._docTick`) y la consumen SOLO los llamadores síncronos del propio tick (`_vglDocDelTick`: widget de conducta, rcvPendientesTick 1ª lectura, hcPacienteContexto ×3, checkAvisoUniversal). La vía diferida —guard anti-cruce `_pacienteSigueAbierto`, callbacks 300/900 ms, re-verificaciones post-red— sigue leyendo `extractPacienteAbierto()` fresca: es exactamente la optimización segura que la NOTA v14.2.0 dejó pendiente (el memo temporal de 1 s se revirtió por riesgo de cruce de pacientes) | Parte D: foto del tick consumida con 0 barridos; mutante volvió a barrer el DOM → rojo | **M1 (contexto): 4 barridos/tick → 1** |
| P3 (chip última HC) | El chip del lanzador pinta «última HC: dd/mm/aaaa · clasificación · riesgo cardiovascular» con el contrato REAL de `ObtenerUltimaHCPes` (fechaCreacion, clasificacion, riesgoCardiovascular). 1 consulta por paciente (caché 10 min + dedup en vuelo), la cédula JAMÁS viaja al endpoint (primero se resuelve el id interno), fallo = chip base intacto | Parte E: línea pintada con 1 consulta; mutante (clave ajena al contrato) → 2 rojos | M4/M5: cadena del clic INTACTA (2); la última HC es +1 solo la 1ª vez por paciente, luego de caché |
| P4 (prefetch) | **YA ALINEADO POR PREEXISTENCIA** (v18.5.2-hc2): el clic ya precalienta la cadena exacta de órdenes vigentes con 1 intento especulativo, dedup en vuelo y cortocircuitos; el baseline B/cadena HC (2 peticiones) lo verifica como contrato vivo. Nada que cambiar — documentado, no tocado | — (preexistente; cubierto por B/cadena HC) | M4: 2 (sin cambios) |

Todas las filas en `tests/INFORME_MUTACIONES.md` (sección v18.6.2).
