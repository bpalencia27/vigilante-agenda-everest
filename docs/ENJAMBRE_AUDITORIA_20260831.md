# Enjambre de Auditoría Pre-Despliegue — v18.0.3 (2026-08-31)

**Objetivo:** barrer TODO el código de `vigilante_agenda.user.js` (40.6K líneas) con subagentes
en paralelo, en busca de bugs, cuellos de botella, problemas de rendimiento, fallas de diseño,
huecos de seguridad/PHI y huecos de cobertura de tests. Dejar la versión lista para despliegue
estable el 2026-08-31 a las 05:00 (UTC-05:00).

**Veredicto de salida por hallazgo:** `CRÍTICO` (rompe o bloquea la operación), `ALTO`
(afecta a muchos equipos / datos), `MEDIO` (afecta casos puntuales), `BAJO` (cosmético/deuda).
Todo `CRÍTICO` y `ALTO` se corrige antes del despliegue; los `MEDIO`/`BAJO` se registran.

## Protocolo de cada subagente

1. NO editar nada: solo investigar y reportar (modo lectura).
2. El archivo es de 40.6K líneas: usar `Grep -n` para localizar funciones y `Read` con
   ventanas acotadas (nunca leer el archivo completo de una vez).
3. Verificar cada sospecha contra la suite cuando aplique (`tests/suite_*.js`, `node tests/runner.js`).
4. Reportar en español, con: severidad, función, línea aproximada, descripción, impacto y
   evidencia textual corta (máx. 2 líneas citadas). Priorizar los 12 hallazgos más importantes.
5. Distinguir SIEMPRE "hallazgo confirmado" (con evidencia en código/tests) de
   "sospecha a confirmar" (sin evidencia concluyente). PROHIBIDO inventar.

## Misiones (8 subagentes, 2 oleadas)

### Oleada 1

* **A1 — Motor de alertas y canales de aviso.** `colorAndAlert`, `maybeNotify`, `notify`,
  `osNotify`, `bigAlert`, `showToast`, `_dispararAvisoReal`, `_encolarAvisoPendiente`,
  `_flushAvisosPendientes`, siembra silenciosa, candados anti-duplicado (una cita/un color/un
  conteo), `_legendMarcaUnaVez`, `_fraudeCompartido`, `testNotifications`. Buscar: avisos que no
  salen, dobles, que se pierden, canales mal elegidos por visibilidad, cola que nunca se vacía.

* **A2 — Rendimiento y timers.** `_relojCada`, Web Worker, `setInterval`/`setTimeout` sin
  limpiar, sondeo (`apiCadencia`, `CONFIG.POLL_MS`), bucles pesados, fugas de memoria,
  listeners acumulados, `render()` costoso, tamaño de estado compartido en `localStorage`.

* **A3 — Red, telemetría y Apps Script.** `GM_xmlhttpRequest`, cola remota, reintentos,
  `reportar*`, telemetría `ux`, URLs reales (Gist `gistfile1/2.txt`, Apps Script), manejo de
  `onerror`/`ontimeout`, presupuesto de red (`docs/PRESUPUESTO_RED.md`), `TABLERO/Codigo.gs` y
  `TABLERO/VersionCheck.gs`.

* **A4 — Concurrencia multi-pestaña.** Liderazgo, relevo, `_ultimoRelevoVisibilidad`,
  `RELEVO_GRACIA_FRAUDE_MS`, siembra compartida, dead-man, saneo de claves viejas de
  `localStorage`, carreras de escritura.

### Oleada 2

* **A5 — UI/UX/DOM y accesibilidad.** Overlay, sidebar, toasts, `render()`, temas claro/oscuro,
  modales, Redactor IA, HTML inyectado con template strings (riesgo XSS), z-index, responsive,
  contraste, foco y `aria` (revisar `tests/suite_35_interfaz_accesibilidad_medica.js`).

* **A6 — Seguridad y PHI.** Barrera de cédulas (6+ dígitos), `escapeHtml`, telemetría sin PII,
  `@connect` mínimos, claves de `localStorage`, auditoría XSS previa (`docs/AUDITORIA_XSS.md`),
  `tests/suite_31_seguridad_phi_xss.js`.

* **A7 — Cobertura de tests.** Mapear funciones críticas del userscript contra las 69 suites;
  leer `tests/INFORME_MUTACIONES.md` y los 4 mutantes; listar áreas de alto riesgo SIN prueba.

* **A8 — Cadena de despliegue.** Sincronización de versión (4 lugares: `@version`, const
  `VERSION`, `package.json`, `PUBLICACIONES.md`), `@updateURL`/`@downloadURL` contra el Gist
  real, `MIN_VERSION` de `VersionCheck.gs`, runbook/rollback/PRR (`docs/RUNBOOK.md`,
  `docs/ROLLBACK.md`, `docs/PRODUCTION_READINESS_REVIEW.md`), CI (`.github/workflows/tests.yml`).

## Salida del enjambre

Informe consolidado por misión → veredicto de despliegue:

* Correcciones `CRÍTICO`/`ALTO` aplicadas y re-verificadas con suite completa (2323 checks).

* `MEDIO`/`BAJO` registrados en `BACKLOG_MEJORAS.md` o `DEUDA_v14.md` según corresponda.

* Checklist final de despliegue 5 AM actualizado en `RUNBOOK.md`.

***

## Resultados (2026-08-31 03:30Z) — v18.0.4

### Veredicto: LISTA PARA DESPLIEGUE (0 CRÍTICOS en toda la auditoría)

**8 misiones ejecutadas, 2 hallazgos ALTO y 9 MEDIO corregidos antes del despliegue:**

| ID            | Severidad | Hallazgo                                                                                                                                                                  | Fix                                                                                                                  |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A1-H1         | ALTO      | El ROJO de la transición directa "Sin presentarse → Atendido" volvía a SONAR (regresión v16.2.8: maybeNotify ignoraba `a.sound`)                                          | Nuevo flag `callar` en colorAndAlert + filtro en maybeNotify (conteo y auditoría intactos)                           |
| A2-H1 / A4-H1 | ALTO      | `vgl_cosecha` se reescribía COMPLETA en cada tick (2-5 s, todas las pestañas con historia): tirón de CPU + ventana de carrera entre pestañas (pérdida de memoria clínica) | Guarda de escritura por firma (ignora `ts`) + `_vglCosecharFactoresVisibles` conserva el sello si el valor no cambió |
| A1-H2         | MEDIO     | El flush consumía el cartel ROJO sin pintarlo si `muted()` estaba activo                                                                                                  | `!muted()` en la decisión de `puedePintar`; el aviso espera en cola                                                  |
| A2-H2         | MEDIO     | El canal "reloj" de 1 s latía todo el día con el panel oculto (display:none)                                                                                              | `setWinState` detiene/remonta el canal según visibilidad                                                             |
| A4-H2         | MEDIO     | Pestañas NO líderes pintaban fraude VERDE vs ROJO (fusión solo en relevo)                                                                                                 | Fusión periódica con throttle 10 s en no-líderes                                                                     |
| A6-H1         | MEDIO     | Campo `hora` del evento fraude: único campo de telemetría DOM sin barrera de 6+ dígitos                                                                                   | Validación de patrón de hora en `reportarFraude`                                                                     |
| A6-H2         | MEDIO     | Servidor no saneaba cédulas formateadas ("1.111.111.111")                                                                                                                 | Regex de grupos con separadores en `_sinDigitosLargos` (Codigo.gs)                                                   |
| A3/A8         | MEDIO     | Drift `VersionCheck.gs`: repo en 18.0.0, despliegue vivo en 18.0.3                                                                                                        | MIN\_VERSION y CANARY.minVersion → 18.0.4                                                                            |
| A7            | MEDIO     | 2 áreas SIN ninguna prueba: cortacircuitos v17.15.0 y canal reloj v18.0.3 (+ fix flush)                                                                                   | `tests/suite_70_enjambre_pre_despliegue.js` — 8 casos nuevos                                                         |

**Suite:** 2331/2331 en verde (2323 + 8 nuevas). **Hash 18.0.4:** `B4542F80…40A62` (registrado en PUBLICACIONES.md).

**Registrado para post-despliegue (no bloquea):** foco inicial de modales en ✕, contraste de la caja de cifras IA en tema oscuro, toasts sin cierre por teclado, evicción del toast más viejo con tope de 4, `vgl_nosh_hist` sin poda, dos `setInterval` globales fuera de `state.timers`, duplicación toast+cartel fuera de HCHealth (A1-H3), docs de presupuesto/telemetría desactualizados (cola 30→80, errores 5→40, PyM 1.5→14 MB).

**Pendiente operativo del usuario (5 AM):** re-desplegar `VersionCheck.gs` y `Codigo.gs` en Apps Script (sesión de Google) según checklist de RUNBOOK.md; merge del PR #109.
