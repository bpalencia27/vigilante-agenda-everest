# Informe de Auditoría Integral — Vigilante de Agenda v18.4.1
**Fecha:** 2026-09-06 · **Objeto:** `vigilante_agenda.user.js` (userscript Tampermonkey sobre Everest/EverHealth, `neps.everestintelligent.com`) · **Método:** análisis estático completo del código (~51.000 líneas), grounding real de la página (fixtures DOM, 22 esquemas de API, CSS real), banco de pruebas propio (runner, 30+ suites) y verificación cruzada contra las auditorías previas (2026-08-25, 2026-08-29, 2026-09-03).

> La página de Everest es una SPA Angular cuyo contenido autenticado no es auditable sin sesión clínica; la auditoría se basó en el grounding real capturado en consultorio (agosto-septiembre 2026), que es la fuente de verdad del proyecto (jerarquía de evidencia de `CLAUDE.md`).

---

## 1. Resumen ejecutivo

| # | Hallazgo | Área | Prioridad | Estado |
|---|---|---|---|---|
| H1 | `_vglFeedbackBoton` escribía el aviso del botón con `innerHTML` sin escapar (sumidero XSS latente) | Seguridad | P1 | **Cerrado en v18.4.1** (escapeHtml en el punto) |
| H2 | `onclick=` inline en el botón Cerrar del modal de Laboratorios — único del archivo, violaba la Invariante 3 de `AUDITORIA_XSS.md` y competía con `closeMod` (saltándose telemetría y limpieza) | Seguridad/UX | P1 | **Cerrado en v18.4.1** (ruta única `closeMod`) |
| H3 | 3 reglas CSS duplicadas exactas desde la fusión de hojas v12.3.13 (2 × `.vgl-fld` + 1 × `@media prefers-reduced-motion` con 2 `!important` muertos) | Rendimiento/mantenibilidad | P2 | **Cerrado en v18.4.1** |
| H4 | Versión desincronizada entre `@version`, `const VERSION` y `package.json` | Proceso | P1 | **Cerrado en v18.4.1** (triple 18.4.1) |
| H5 | PHI en claro en `vgl_cosecha` / `vgl_pym` / `vgl_nosh_hist` (decisión documentada, sin cifrar) | Seguridad | P1 | Abierto (propuesta N2) |
| H6 | Robot de Conducta: `querySelectorAll("button")` de documento completo 4-5× por examen agregado + sondeo de tablas cada 150 ms | Rendimiento | P1 | Abierto (plan §4) |
| H7 | Lectura de casillas por rótulo potencialmente cuadrática (resuelve `label[for]` por cada campo) | Rendimiento | P2 | Abierto (plan §4) |
| H8 | `AUDITORIA_XSS.md` desfasada (73 sumideros documentados vs 146 reales; líneas ya no corresponden) | Documentación | P2 | Abierto |
| H9 | SEC-01: rotación de contraseña Athenea en servidor pendiente; SEC-05: token `vgl-2026` de baja entropía (rotación pactada dic-2026) | Seguridad | P1 | Abierto (dueño/Tablero) |
| H10 | Referencia muerta a `unsafeWindow` (L9064) — sin `@grant`, siempre cae a `window` | Higiene | P3 | Abierto (limpieza cosmética) |

**Ya resueltos por work previo (verificado en código, no de memoria):** A1 (huella SHA-256 de integridad publicada, v18.0.134), A2 (purga de `vgl_piloto`, v18.0.134), A3/M3 (compuerta de suciedad DOM + tope 15 s pestaña oculta), M1 (validación de mensajes BroadcastChannel, v18.0.134), B10 (`disconnect` de observers), B13 (limpieza de timers), cero `eval`/`new Function`, barrera de cero identificables hacia IA (suite 31 verde), escrituras clínicas sin reintento (0 duplicaciones).

**Falsos positivos descartados:** `extractPacienteAbierto` barre todos los `.text-muted` ~4×/tick a propósito — la memoización se probó y se revirtió por seguridad clínica (guard anti-cruce de pacientes); no es deuda.

---

## 2. Lo que se cambió en esta entrega (v18.4.1)

| Cambio | Línea | Prueba que lo fija |
|---|---|---|
| `btn.innerHTML = escapeHtml(texto)` y `escapeHtml(rotuloOriginal)` en `_vglFeedbackBoton` | ~8842-8844 | suite_31 «escapa el aviso: un payload HTML se VE, no se ejecuta» |
| Botón Cerrar sin `onclick` inline; cierre único por `closeMod` (addEventListener ya existente) | plantilla modal Labs | suite_31 «cierra SOLO por closeMod: cero onclick inline» |
| Deduplicación de las 3 reglas CSS exactas | hoja maestra `buildOverlay()` | suite_25 «la fusión de hojas de v12.3.13 no dejó reglas duplicadas exactas» + Regla G recalibrada 656→654 |
| `@version` / `const VERSION` / `package.json` alineados en 18.4.1 | 4 / 1038 / package.json | suite_23 + suite_30 (cuádruple sincronización) |

Mutaciones verificadas: ver filas nuevas al final de `tests/INFORME_MUTACIONES.md`.

---

## 3. Diagnóstico por dominio (síntesis de la auditoría)

**Red/APIs.** 58 llamadas a 14 destinos; timeouts por canal (5-120 s), reintentos solo en lecturas (3 × backoff 300 ms×2 + jitter), cortacircuitos, deduplicación en vuelo, presupuesto de red documentado y probado (suite_33). `ObtenerConsultas` se aprende observando a Everest (PerformanceObserver) — no está en `grounding/API_EVEREST.md`: se recomienda añadir su esquema al grounding. Autenticación solo por cookies de sesión (Everest), CSRF raspado (Athenea), cookie anónima "primada" (SharePoint), token fijo (Tablero).

**Seguridad.** 146 sumideros HTML, todos con escape verificado línea a línea (los 2 excepcionales se cierran en esta entrega). Almacenamiento: credenciales Athenea y claves IA ofuscadas (reversible, documentado); PHI local en claro (H5). El script lee el JWT/`user` de Everest solo localmente, nunca lo exfiltra. Sin `eval`, sin WebSocket, sin `unsafeWindow` efectivo.

**Rendimiento.** Reloj en Web Worker anti-throttling con watchdog; tick adaptativo (2 s crítico / 5 s normal / ≥15 s oculto); 2 MutationObservers baratos; repintado de agenda por firma; cosecha HC amortiguada por compuerta de suciedad. Deuda puntual: H6 y H7.

**CSS/UX.** Hoja maestra única (~3.500 líneas) inyectada una vez; blindaje `!important` auditado por conteo (Regla G) y por elemento (Regla S); verificación Chromium disponible (`tools/verificar_color_chromium.js`, `e2e/runner_visual.js`).

---

## 4. Plan de implementación (hallazgos abiertos, por prioridad)

| Prioridad | Hallazgo | Pasos | Pruebas/mutación exigidas | Riesgo |
|---|---|---|---|---|
| P1 | H5 cifrado de almacenes PHI | Reutilizar la clave de equipo HMAC/AES ya existente (v18.0.144) para AES-GCM sobre `vgl_cosecha`/`vgl_pym`/`vgl_nosh_hist`; migración lectura-compatible (leer claro viejo → reescribir cifrado); purga intacta | suite nueva o extensión de suite_69/75; mutación: quitar cifrado → rojo | Medio — tocar almacenamiento vivo; hacer en rama + validación en consultorio |
| P1 | H6 scope del robot de Conducta | Anclar la búsqueda al contenedor del modal de ordenes (fixture `dom_everest_ordenes.html` como evidencia) en vez de `document`; mantener sondeo 150 ms solo mientras esperan filas nuevas | suite_71/73; mutación: devolver búsqueda global → medir conteo de `querySelectorAll` | Medio — el selector debe casar con el DOM real; nunca sin fixture |
| P1 | H9 secretos | (Dueño) rotar contraseña Athenea en servidor y token del Tablero; actualizar `SECRETOS_EXPUESTOS.md` | n/a (operación, no código) | Bajo |
| P2 | H7 índice de rótulos | Indexar `label[for]` una vez por llenado (Map) y resolver en O(1) por campo | suite_47; mutación: quitar índice → sigue verde (sin regresión) pero medir con `tools/inventario.js` | Bajo |
| P2 | H8 regenerar `AUDITORIA_XSS.md` | Reejecutar el barrido de sumideros sobre el archivo actual con líneas nuevas; actualizar invariantes | n/a (doc) | Bajo |
| P2 | Esquema de `ObtenerConsultas` al grounding | Añadir esquema desde captura real (jerarquía de evidencia n.º 2) | suite_44 (grounding sin PHI) | Bajo |
| P3 | H10 `unsafeWindow` muerto | Eliminar la referencia | suite_17 | Bajo |

**Regla transversal del proyecto:** todo cambio de comportamiento exige mutación verificada y fila en `tests/INFORME_MUTACIONES.md`; todo cambio de color exige verificación Chromium contra el CSS real (`tests/harness.js` + `buildOverlay()`), nunca copias recortadas.

---

## 5. Propuesta de nuevas funcionalidades (valor clínico/operativo)

| # | Funcionalidad | Justificación clínica | Justificación operativa | Complejidad |
|---|---|---|---|---|
| N1 | **Canario de deriva de selectores** — sonda diaria (patrón ya existente en `mtrSondaPestanias`) que verifica en vivo `.labelHora`, `.status-label`, `input#alert_message`, tabla de ordenamientos; si Everest actualiza y algo desaparece, avisa al médico y lo reporta al Tablero ANTES de que falle en consulta | Un selector roto = alertas de fraude/PyM silenciosamente muertas durante días | Detección proactiva; el EHR es caja negra y ya cambió sin aviso | Media |
| N2 | **Cifrado AES-GCM de la memoria clínica local** (H5) | Reduce exposición de PHI en equipos compartidos de la IPS | Reutiliza infraestructura existente (clave de equipo v18.0.144) | Media |
| N3 | **Precarga del índice PyM en Worker al arranque** | El primer «Abrir PyM» de la mañana pasa de ~2-3 s a instantáneo | Ya existe el Worker de desempaquetado con watchdog de 90 s | Baja |
| N4 | **Panel de "salud del script"** en Ajustes (estado del worker del reloj, cortacircuitos abiertos, cola de telemetría, última lectura de agenda) | El médico distingue "sin alertas porque todo está bien" de "sin alertas porque estoy ciego" | Observabilidad; alimenta al Tablero con 1 fila `entorno` | Baja |
| N5 | **Aviso pasivo de vigencias al abrir historia** — usar `ObtenerOrdenamientoPorPacienteIdVigente` (ya integrado, evidencia n.º 1) para un chip "exámenes vencidos" en el Panel del paciente | Recordatorio en el momento de la consulta, no de memoria | Sin nuevas llamadas: el endpoint ya se consume | Baja-Media |

---

## 6. Estimaciones de tiempo y recursos

Recursos: 1 desarrollador + el médico para validación en consultorio (indispensable en H5/H6/N1/N5); entorno Chromium/Playwright para verificación visual; rama propia + rebase sobre `claude/pym-agenda-blindaje-v12-4` (o la punta vigente) antes de cada PR.

| Ítem | Esfuerzo estimado | Validación clínica |
|---|---|---|
| H5 (cifrado PHI) | 2-3 jornadas + 1 día de pilotaje | Sí — obligatoria |
| H6 (scope Conducta) | 1-2 jornadas | Sí |
| H7 (índice de rótulos) | 0,5 jornada | Opcional |
| H8 (regenerar doc XSS) | 0,5 jornada | No |
| H10 / grounding ObtenerConsultas | 0,5 jornada | No |
| N1 (canario DOM) | 1-2 jornadas | Sí |
| N3 (precarga PyM) | 0,5-1 jornada | Opcional |
| N4 (salud del script) | 1 jornada | Opcional |
| N5 (chip de vigencias) | 1 jornada | Sí |

**Estándares aplicados (salud digital):** mínimo necesario (PHI solo local, lista blanca de secciones hacia IA), trazabilidad (telemetría agregada + bitácora sanitizada), revocación (kill-switch remoto ya existente), integridad (huella SHA-256 publicada), y la regla fundacional del proyecto: *el script sugiere, el médico decide* — nada se ordena, agenda ni confirma solo.

---

## 7. Nota de entorno (transparencia)

Durante esta auditoría, otra sesión de agente editaba simultáneamente `vigilante_agenda.user.js` en el mismo checkout (campaña de publicación v18.4.x). Se observaron varios episodios de escritura concurrente sobre las mismas regiones; la resolución final preservó AMBOS conjuntos de cambios (regla de `AGENTS.md` para tareas paralelas).

**Cierre verificado:** `node tests/runner.js` sobre el estado final consolidado — **3415 comprobaciones en verde, 0 fallos** (incluye las 3 pruebas nuevas de esta auditoría y las mutaciones restauradas).
