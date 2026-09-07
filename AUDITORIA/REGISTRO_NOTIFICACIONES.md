# REGISTRO DEL ENJAMBRE DE NOTIFICACIONES (NT)
## Vigilante de Agenda v18.3.x · «Avisar lo necesario, por el canal justo, una sola vez»

> Registro **solo-append** custodiado por SA-ORQ. Filas de hallazgo `NT-###` al final,
> formato `| ID | Perfil | Punto | Criterio afectado | Hallazgo | Evidencia | Severidad |`.
> Catálogo generado en NT-01 (2026-09-06) con grep + lectura sobre la punta vigente
> (~49.000 líneas; ojo: AGENTS.md dice 14.158 — desactualizado, ver incidencias).

---

## 0. ESTADO DE LA EJECUCIÓN

| Tarea | Perfil | Estado |
|---|---|---|
| FASE 0 | SA-ORQ | ✅ Banco `node tests/runner.js` exit 0, todas las suites «ok» (raw en `AUDITORIA/baseline_notif_raw.txt`, truncado por el redirect — re-verificado en NT-90) |
| NT-01 | SA-ORQ | ✅ Catálogo abajo (corregido en NT-20: C05 era código muerto) |
| NT-02 | SA-NOTIF | ✅ matriz técnica completa (§2 evidencia) |
| NT-03 | SA-CUMPL | ✅ dictamen cumple/no cumple/pendiente (§2) |
| NT-04 | SA-USR | ✅ jornada simulada 24 pacientes MEDIDA en arnés (NT-121); hallazgo lateral NT-122 |
| NT-05 | SA-MED | ✅ ranking R por evento + vetos V1-V5 (§2) |
| NT-06 | SA-DEV | ✅ cableado, carreras, perf/oculto/killswitch, costes (§2) |
| NT-07 | SA-UX | ✅ escalamiento, mensajería, telemetría (§2); corrigió C05 |
| NT-08 | SA-UI | ✅ contrastes WCAG calculados (§2); hallazgo NT-110 |
| NT-09 | SA-ACC | ✅ matriz redundancia sensorial (§2); hallazgo NT-108 |
| NT-20 | SA-ORQ | ✅ consolidación: 28 hallazgos (NT-101…128), 6 discrepancias DIS-1…6 resueltas por jerarquía |
| NT-30+ | SA-ORQ | ✅ `AUDITORIA/INFORME_NOTIFICACIONES.md` (rúbrica final + 22 modificaciones M1-M22 + 12 PRs + cola Q1-Q5) |
| NT-90 | SA-ORQ | ✅ Banco verde en verificación aislada (ver incidencia 5) |

**Incidencias de ejecución:**
1. Otro enjambre (SF-##, simulación de flujos) corre EN PARALELO en este repo (terminales
   compartidos, archivos `banco_sf01_*` apareciendo). No toca `vigilante_agenda.user.js`
   a la vez que este enjambre; riesgo de colisión bajo (este enjambre NO modifica código).
2. El redirect del banco quedó truncado a 101 líneas (suites visibles: todas «ok»; exit 0
   dos veces). Re-ejecución completa en NT-90.
3. AGENTS.md desactualizado (14.158 líneas / 976 checks); punta real ~49.000 líneas.
4. El enjambre SF-## paralelo COMMITÓ cambios en `vigilante_agenda.user.js` durante la
   auditoría (deriva de líneas, ver §1.c); `git status` limpio al cierre.
5. **NT-90 — fallos transitorios del banco por interferencia concurrente:** corridas
   completas del runner ejecutadas mientras el enjambre paralelo escribía/compilaba
   dieron fallos intermitentes «no se encontró el cierre del IIFE» en suites DISTINTAS
   por corrida (Suite 14: 6 fallan en corrida 1 → 31 ok en 2/3/4; M1: 3 fallan y M2: 1
   falla en corrida 4). **Verificación aislada posterior: `suite_31` = 54 ok (exit 0) y
   `suite_32` = 45 ok (exit 0)** — el patrón (mismo error de extracción, suites distintas,
   todas verdes aisladas) es lectura parcial del archivo fuente durante escritura
   concurrente, NO una regresión. Evidencia completa: `AUDITORIA/cierre_nt90_raw4.txt`.
   Este enjambre NO modificó código: sus únicos archivos son los de AUDITORIA/.

---

## 1. CATÁLOGO DE PUNTOS DE AVISO (NT-01)

Coste de canal (§3.1): C0 punto/badge/favicon · C1 toast agrupado · C2 banner persistente
· C3 notificación SO · C4 modal · C5 modal+sonido. «Tope» = mecanismo que limita
repetición; «edge» = un disparo por transición; «nivel» = sigue mientras viva la condición.

### Grupo A — Pipeline central (funciones-canal)

| ID | Punto (función:línea) | Evento que lo dispara | Canal(es) | ¿Edge o nivel? | ¿Tope de frecuencia? | ¿Silenciable? (muteFor/oculto/perf) | Texto: ¿PHI posible? |
|---|---|---|---|---|---|---|---|
| A01 | `notify:15902` | llamadores varios (PyM, órdenes, citas, arranque) | elige 1: toast (visible+HCHealth) o SO | n/a (despachador) | sí: `_avisoUnaVezPorNavegador("notify\|uid")` por jornada; uid = pasado o hash del texto | pasa por `showToast`/`_notificarSistema` | según llamador |
| A02 | `showToast:15862` | todos los avisos de página | C1 (cola 500 ms, agrupación, máx 4 vivos) | n/a | sí: dedup mismo título+apptKey en el flush; máx 4 vivos (recorta el más viejo no crítico); AZUL/VERDE autocierran a 9 s | gate `_enModuloHCHealth()` (no pinta fuera del módulo clínico); `body.vgl-modo-oculto` oculta `#vgl-toasts` (CSS 17759) | según llamador |
| A03 | `_renderToast:15767` | flush de la cola | C1 | n/a | reemplaza el toast viejo del mismo apptKey | — | según llamador |
| A04 | `_agruparToasts:15842` | flush con >1 aviso del mismo paciente | C1 agrupado («N avisos de este paciente», color = el más grave) | n/a | sí: agrupa por apptKey | — | concatena títulos+cuerpos (PHI acumulada) |
| A05 | `osNotify:15714` | respaldo A01/A09 y llamadas directas (35439, 16632) | C3 (Notification API) | n/a | sí: `avisoYaVisto(uid)` por día + `crossTabDup("os\|…")` 12 s; auto-close 20 s (3 min si persist); escalada a toast a 1,6 s si el SO suprime | requiere permiso del sitio; `requireInteraction` SOLO persist | título/cuerpo tal cual se pasen — filtrado de cédulas SOLO si viene por A07 |
| A06 | `_gmNotify:15923` | fallback cuando Notification no está concedido | C3 (GM_notification, escritorio) | n/a | sí: `crossTabDup("gm\|…")` 12 s + `avisoYaVisto("gm\|uid")` por día | silent:true (tono lo pone el script) | llega ya filtrado por A08 (vía A07) |
| A07 | `_notificarSistema:16064` | A01/A09 | C3 (A05 o A06, una de dos) | n/a | hereda los de A05/A06 | — | aplica `_vglSinCedulas` a título y cuerpo ANTES de salir |
| A08 | `_vglSinCedulas:16061` | defensa PHI del canal SO | — | — | — | — | enmascara `\d{6,12}` → `●●●`+últimos 3. NO cubre nombres ni apellidos |
| A09 | `_dispararAvisoAudible:16072` | `maybeNotify` (avisos de agenda) | tono + 1 canal visible | n/a | sí: `crossTabDup("full\|uid")` 12 s + `_avisoUnaVezPorNavegador("aviso\|uid")` por jornada | `muted()` calla SOLO el tono (return true: sigue contando y encolando cartel); fuera HCHealth → SO; respaldo toast solo en HCHealth | cuerpo completo con nombre+cédula (página) |
| A10 | `_dispararAvisoCartel:16109` | A11 y flush A21 | C4 (bigAlert) | n/a | solo ROJO + S.cartel + pestaña visible + !muted | respeta `muted()` y S.cartel | cuerpo completo |
| A11 | `_dispararAvisoReal:16116` | `maybeNotify` en HCHealth | C4 (ROJO) o C1 | n/a | cartel SOLO para ROJO; `sinToastPorCartel` evita duplicar | — | cuerpo completo |
| A12 | `bigAlert:15261` | A10, usos directos | C4 | n/a | quita el modal previo (`#vgl-modal`) | — | escapeHtml, texto tal cual |
| A13 | `avisoUniversal:15341` | `checkAvisoUniversal` + dock «🩺 Pendientes» + prueba | C4 (modal `#vgl-pym-modal`, SIN sonido) | nivel (hasta «Entendido»/clic fuera) | sí: presupuesto `obsPresupuestoConsumir` — default **6/jornada** (S.obsPresupuestoAvisos, 0=sin tope), fall-open; dedup por paciente/jornada lo pone el llamador (A14) | «siempre activo, sin interruptor» (v14.2.0); presupuesto agotado = return silencioso + `uxTrack("aviso.presupuesto.agotado")` | nombre del paciente en el título (solo página; no va a SO) |
| A14 | `checkAvisoUniversal:15542` | tick, al abrir historia | C4 vía A13 | edge: 1 aviso por paciente/jornada (`avisouniv\|key`) + gracia 5 s esperando labs | re-aviso «parcial/A12» 1 sola vez (`avisounivlab\|key`) si llegaron labs nuevos con firma distinta | dedup en `vgl_vistos` compartido por navegador | nombre del paciente (página) |
| A15 | `startNag:14783` | A09 si color ROJO | sonido repetido (C5 acompaña al modal) | **nivel**: repique cada 9 s hasta 40 veces (≈6 min) o `acknowledge()` | tope duro: 40 repiques; solo si S.insistir (si no, 1 tono) | `muted()`/S.sonido callan el tono (beep respeta); «Reconocer» (acknowledge) lo apaga | sin texto |
| A16 | `playTone:14778` / `beep:14765` | A09 (MORADO), prueba, volumen | sonido 2 notas | edge | 1 por disparo | respeta `muted()` y S.sonido (según política v15.4.0) | sin texto |
| A17 | `startFlash:14810` | A09 si crítico y SO no pudo | C0 (título+favicon parpadean) | nivel hasta focus | — | solo críticos (ROJO/MORADO/AMBAR) | `flashText` con estado+hora (sin nombre) |
| A18 | `setFavicon:14793` | A17, disco | C0 | — | — | — | no |
| A19 | `muteFor:14769` / `muted:14768` | botón «Silenciar 15 min» | — | nivel 15 min | — | calla tono y cartel; **NO** calla toast ni SO (decisión del médico 28-ago, v17.19.0) | setSummary visible |
| A20 | `_encolarAvisoPendiente:15978` | maybeNotify fuera de HCHealth / páginas excluidas | cola localStorage (cruza pestañas) | — | tope defensivo 50; dedup por uid | — | guarda el payload completo (con PHI) en localStorage `vgl_avisos_pendientes` |
| A21 | `_flushAvisosPendientes:15992` | tick en HCHealth | C4 (solo carteles ROJO) | — | caducidad 10 min (`AVISO_CARTEL_CADUCA_MS`); no-pintado se queda en cola (v16.7.0) | respeta `muted()` y S.cartel | pinta el payload viejo completo |
| A22 | `crossTabDup:15678` | A05/A06/A09 | — | — | ventana 12 s; limpia marcas >24 h | — | no |
| A23 | `avisoYaVisto:15697` / `avisoMarcarVisto:15705` | todos los uid | registro por día (`vgl_vistos`) | — | sí, por jornada, compartido entre pestañas | — | no |
| A24 | `_avisoUnaVezPorNavegador:15660` | A01/A09 | — | — | sí (jornada) | — | no |
| A25 | `_avisoUidDeTexto:15668` | A01 sin uid | — | — | hash djb2 de título+cuerpo | — | no |
| A26 | `obsPresupuestoConsumir:51420` (+`obsPresupuestoLimite:51407`) | A13 | — | — | **tope global del aviso universal: default 6/día por equipo** (medido el origen: ≈4.020 interrupciones/14 días ≈ 72/equipo/día antes del tope, prompt 07) | ajustable S.obsPresupuestoAvisos (0=sin tope); fall-open | no |
| A27 | `obsAvisoMostrar:51290` / `obsAvisoDesenlace:51299` | A13 | telemetría desenlace | — | — | — | id local, sin PHI en el id |
| A28 | `uxTrack:13135` | varios | telemetría | — | — | claves hoy: `aviso.universal.mostrado/entendido`, `aviso.presupuesto.agotado`, `modal.foco.respetado` | payload sin PHI (contadores) |
| A29 | `spToast:14016` | arranque/PyM (13930-13972) | C1 splash (`#vgl-sp`) | n/a | sustituye al anterior (1 visible) | modo oculto lo apaga (CSS 17759) | no |
| A30 | `helloOncePerDay` (llamada :35472) | primer tick con agenda en HCHealth | saludo/estado inicial | edge | `vgl_hello` 1/día | — | no |
| A31 | `_onboardingColores` (:35472) | idem | leyenda de colores (toast persist=true) | edge | 1/día junto al saludo | — | no |

### Grupo B — Eventos de agenda (`colorAndAlert:14481` → `maybeNotify:16506`)

| ID | Punto | Evento | Canal(es) | Edge/nivel | Tope | Silenciable | ¿PHI? |
|---|---|---|---|---|---|---|---|
| B01 | `maybeNotify:16506` VERDE | llegada «En Sala» a tiempo observada EN VIVO | C1 o C3 según visibilidad | edge (transición + `arrival`) | leyenda 1/paciente/día (`_legendMarcaUnaVez`); conteo 1/cita/día (`bumpStatCita`) | muted calla tono (VERDE no suena, v15.4.0) | sí: nombre + cédula en body |
| B02 | idem MORADO razón «tiempo» | última llamada (~1 min de gracia) | C1/C3 + tono MORADO | edge | leyenda 1/paciente/día; `state.notified` por color+reason | tono sí (muted) | sí |
| B03 | idem MORADO razón «3+ PyM» | paciente con 3+ actividades | SOLO COLOR en agenda (maybeNotify return :16512) | edge | — | — | — |
| B04 | idem AMBAR | «Sin presentarse» tras gracia | C1/C3, persist=true (v17.0.3) | edge terminal | `contadas` 1/cita/día; parpadeo no re-avisa (v17.6.52) | muted calla tono (AMBAR no suena) | sí |
| B05 | idem ROJO | confirmación extemporánea (fraudWatch→En Sala) | **C5**: tono startNag + cartel C4 (si S.cartel) o toast/SO, persist | edge (`alertedFraud` 1/cita, AXIOMA §1.2) | 1 por cita; nag máx 6 min | muted calla tono+cartel (no el registro); S.cartel | sí: nombre+cédula |
| B06 | `colorAndAlert:14642-14659` salto sin-presentarse→atendido | hueco de lectura del script | SIN aviso (`callar`), registra `HUECO_DE_LECTURA` | — | marca `saltosinsala@key` 1/cita | — | auditoría |
| B07 | siembra silenciosa :16522 + :35454 | primer snapshot del día | SIN aviso | — | 1/día/navegador | — | — |

### Grupo C — Prevención y estado del paciente

| ID | Punto | Evento | Canal(es) | Edge/nivel | Tope | Silenciable | ¿PHI? |
|---|---|---|---|---|---|---|---|
| C01 | `avisoUniversal` vía A14 | abrir historia con pendientes (abandono RCV / PyM / labs vencidos / adelantables / prioridadRcv) | C4 | nivel hasta cerrar | 1/paciente/jornada + presupuesto global 6/día (A26) | sin interruptor propio; presupuesto configurable | sí (nombre, solo página) |
| C02 | `checkAvisoUniversal:15599` | labs llegaron tarde con claves nuevas | C4 | edge | 1/paciente/jornada (`avisounivlab\|key`) + presupuesto | — | sí |
| C03 | `avisoPacEval:10876` (tope `AVISO_PAC_TOASTS_HORA=3` :10834) | pacientes NUEVOS de hoy entran a agenda | toast (+¿conteo?) | edge por cita | **sí: máx 3 toasts/hora corrida** (precedente interno a extender), dedup por cita, cross-tab | — | sí |
| C04 | `notify:5075` | resultados de laboratorio encontrados (VERDE) | C1/C3 | edge | dedup por texto (uid hash) | — | posible |
| C05 | banner PyM `#vgl-pym-banner` (pinta :35363/:35894, CSS :18991) | pacientes de la lista PyM en la agenda | C2 persistente (franja propia, minimizable) | nivel mientras viva la condición (D5) | — | `.perf` (9828, 19073) y `body.vgl-modo-oculto` (17759) lo degradan/ocultan | sí (nombres en la lista) |
| C06 | pastilla dock «🩺 Pendientes» (v18.0.127) | clic → reabre el mismo cálculo | C0 → C4 bajo demanda | — | — | — | sí |
| C07 | `vglDiscoBannerPintar:33426` (modos en 33390/33396/33482/33484/33497) | carpeta local caída / migración / elegir | C2 banner | nivel | — | modo oculto lo apaga; AE-017-A: timers fuera del teardown | no |
| C08 | `_mostrarAvisoPausaClinica:35904` (llamadas 35901, 36528) | killswitch / pausa de seguridad | C4 (modal pausa) | nivel hasta resolución | — | es el apagado mismo; debe seguir visible | motivo interno |

### Grupo D — Estado e infraestructura

| ID | Punto | Evento | Canal | Edge/nivel | Tope | Silenciable | ¿PHI? |
|---|---|---|---|---|---|---|---|
| D01 | `notify:35008` / `notify:35023` | arranque (estado inicial, centinela activo) | C1/C3 | edge | 1/día (`vgl_hello`) | — | no |
| D02 | `osNotify:35439` | sin lectura de agenda (líder ciego) | C3 directo | edge | uid `vgl-sin-datos-agenda` 1/día; solo con intento previo de API (v18.0.8) | — | no |
| D03 | PyM: `notify:35691` (falta, `rem\|día`), `:13906` (cargado), `:13689` (base piloto `pilotoupd\|franja`), `:13767` (usando piloto), `:13851` (sesión vencida `sesionvencida\|día`), `:13869` (xls viejo `xlsviejo\|día`), `:36747` (real llegó `pymreal\|día`), `spToast:13930/13958/13966/13971/13972` | ciclo de vida del PyM | C1/C3 | edge | uids por día/franja — la mayoría con tope 1/día | — | no |
| D04 | `notify:35706/35728/35799` | versión/actualización | C1/C3 | edge | `verupd\|VERSION`, recordatorio (frecuencia por ventana) | — | no |
| D05 | `showToast:10250` | Chrome pausó la pestaña | C1 | edge | — (¿repite por ciclo?) | — | no |
| D06 | `showToast:36093` | deadman del servidor del asistente | C1 | nivel por estado | `mtrDeadmanMensaje` | — | no |
| D07 | prueba de avisos `16615/16632/16634/16636/16644` | botón «Probar avisos» | C1/C3+tono | manual | uid `prueba\|t` | — | no |
| D08 | `showToast:1146/1147` | bitácora descargada | C1 | manual | — | — | no |
| D09 | `showToast:6602` | contexto faltante riesgo | C1 | manual | — | — | no |
| D10 | `showToast:14757` (cierre consulta), `:15161` (otro paciente) | flujo de consulta | C1 | edge | dedup flush | — | sí (14757 lleva nombre+msg) |
| D11 | `showToast:5454/5464` (memoria paciente), `:9544` (memoria día ROJO) | fallo de guardado | C1 | edge | — | — | posible |
| D12 | disco: `33270/33282/33311/33357/33494/33646/33653` | carpeta local | C1 | edge | — | — | no |
| D13 | ajustes: `33757/33758/33798/33803` | guardar ajustes / modo programador | C1 | manual | — | — | no |
| D14 | `showToast:36420` (centinela visible), `:36496` (festivos discrepancia AMBAR) | UI global | C1 | edge/manual | — | — | no |
| D15 | `:36595` (config reiniciada), `:36283` (guía dominada), `:34035/34036` (guía on/off) | onboarding | C1 | edge/manual | — | — | no |
| D16 | `:34053-34070` credenciales Athenea | guardado/borrado | C1 | manual | — | — | usuario/contraseña NO en texto |
| D17 | `:49227` (carpeta historias), `:32308` (productividad), `:23335` (cancelación aprendida) | varios | C1 | edge | — | — | posible |
| D18 | `:2558` (comentario) | aviso 1 vez/día con notify() | C1/C3 | edge | por día | — | — |

### Grupo E — Confirmaciones de acción del usuario (toast C1, disparo manual, edge, sin tope — dedup solo dentro del flush)

| ID | Funcionalidad | Líneas (showToast) | ¿PHI? |
|---|---|---|---|
| E01 | Exámenes/Auto-Labs (17 avisos: éxito, fuera de rango, obligatoria, sesión, fallos de red) | 7634, 7653, 7701, 7721, 7733, 7744, 7771, 7794, 7800, 7814, 7823, 7826, 7852, 7869, 7873, 7877, 7882 | cédula en varios (7814, 7852) |
| E02 | Ordenar pendientes → Conducta (14) | 7020, 7033, 7035, 7042, 7044, 7047, 24621, 24628, 24642, 24644, 24647, 24649, 24654, 24662 | no |
| E03 | Deshacer (4) | 8722, 8748, 8759, 8802 | etiqueta escrita |
| E04 | Examen normal / plantillas (4) | 8979, 9001, 9005, 26415 | no |
| E05 | Anular cita (5) | 23532, 23538, 23588, 23594, 23601 | no |
| E06 | Agendar / toma de muestras (6) | 27351, 29703, 29748, 29772, 29811, 29881 | 29703 nombre+cédula |
| E07 | Órdenes (7) | 30487, 30493, 31124, 31378, 31381, 31399, 31408 | nombre (31378/31381) |
| E08 | Informe del portal (5) | 27286, 27301, 27314, 27317, 27318 | no |
| E09 | Redactor IA (6) | 25442, 25450, 25472, 25480, 47623, 47947 | no |
| E10 | Ajustes/Athenea/disco varios (9) | 32728, 33270, 33282, 33311, 33357, 33646, 33653, 33757, 33758 | no |
| E11 | Otros (recordatorio 23166, muestras 23208, fuentes 27231, IA cerrar 47623, indicaciones largas 47947, historias 49227) | ver líneas | posible |

**Resumen del catálogo:** ~60 familias de punto de aviso · ~182 llamadas directas a
funciones de canal · 3 modales C4 (bigAlert, avisoUniversal, pausa clínica) · 1 C5 (ROJO
con startNag) · 2 banners C2 (PyM, disco) · SO = osNotify/GM_notification · tope global
existente SOLO en aviso universal (6/día) y en pacientes nuevos (3 toasts/hora).

---

## 1.b CORRECCIONES AL CATÁLOGO (NT-20, tras evidencia del enjambre)

- **C05 (banner PyM `#vgl-pym-banner`) es CÓDIGO MUERTO desde v14.2.0**: retirado por
  orden del médico («ese banner lo mandé a eliminar»); hoy solo se *barre* en cada tick
  (35398-35405). El rol persistente de PyM lo cumple la pastilla «🩺 Pendientes» (C06,
  C0→C4 bajo demanda). La fila C05 queda como CSS muerto pendiente de limpieza (NT-114).
  Evidencia: SA-UX (NT-07) y SA-ACC (NT-09), coincidentes.
- **C exceso del catálogo**: no existe banner PyM vivo; D5 se cumple vía pastilla dock.

## 1.c INCIDENCIA DE DERIVA (drift) — registrada en NT-20

El archivo `vigilante_agenda.user.js` fue MODIFICADO por el enjambre paralelo SF-##
DURANTE esta auditoría: funciones desplazadas ~44 líneas entre la primera tanda
(SA-NOTIF/CUMPL/DEV/MED leyeron `avisoUniversal`:15341, `_agruparToasts`:15842,
`NOTIFY`:15954) y la segunda (SA-UX/ACC leyeron :15385/:15886/:15998). Las líneas de
este registro son las de la PUNTA LEÍDA POR CADA PERFIL; la referencia estable es el
NOMBRE de función. Rebasar antes de cualquier PR del plan NT-30.

---

## 2. FILAS DE HALLAZGO NT-### (solo append)

| ID | Perfil | Punto | Criterio afectado | Hallazgo | Evidencia | Severidad |
|---|---|---|---|---|---|---|
| NT-101 | SA-MED, SA-UX, SA-DEV | `obsPresupuestoConsumir:51420` llamado en `avisoUniversal:15357` | R (relevancia) | El presupuesto 6/día se consulta ANTES de discriminar contenido: puede silenciar el abandono RCV / prioridadRcv (R=3, prioridad máxima del médico) en el paciente 7+ de la jornada, tragado por avisos R≤2 previos. Veto clínico V1 de SA-MED. | Código: `if (!esPrueba && !obsPresupuestoConsumir()) return;` antes de construir secciones; sin discriminación de abandono. Tensión con axioma §1.1 | Alta |
| NT-102 | SA-DEV, SA-NOTIF | `avisoUniversal` catch mudo `:15445`; marca-visto `:15627-28/15641-42` | Consistencia de estado | La mitigación v17.6.8 (pintar→marcar) queda anulada: si el render falla, el catch traga el error, `avisoMarcarVisto` corre igual → aviso perdido toda la jornada Y presupuesto consumido. Además race A14: dos pestañas pueden pintar el mismo modal en el mismo tick (marca va tras pintar). | Lectura SA-DEV (NT-06 fuga b) + SA-NOTIF (NT-02 race 1) | Alta |
| NT-103 | SA-DEV | `avisoUniversal` con `body.vgl-modo-oculto` | Modo oculto / presupuesto | En modo oculto el modal es display:none pero se marca visto y consume presupuesto INVISIBLEMENTE. | CSS 17764 + flujo 15357 | Media |
| NT-104 | SA-NOTIF | `osNotify:15716/15718` + gate `showToast:15872` | Consistencia de estado | osNotify marca visto ANTES de saber si algún canal pintó; si el SO suprime y el fallback toast es bloqueado por el gate HCHealth (pestaña fuera del módulo clínico), el aviso queda contado y nunca visto. | SA-NOTIF (NT-02 hueco A05) | Alta |
| NT-105 | SA-DEV | escalada `fb` 1,6 s `osNotify:15731` vs `onshow` | 1 aviso = 1 canal | Si Windows demora >1,6 s en disparar `onshow`, el fallback pinta el toast y LUEGO llega la notificación del SO: doble canal para el mismo aviso. | SA-DEV (NT-06 carrera a) | Media |
| NT-106 | SA-CUMPL | `_notificarSistema:16064`/`_vglSinCedulas:16061` (B01/B02/B04/B05) | Normativa / PHI | El canal SO (Centro de actividades de Windows, PC compartido) recibe el NOMBRE del paciente en claro (la máscara solo cubre cédulas 6-12 dígitos). Ley 1581/2012 art. 3-4. Colisiona con la decisión previa del médico (v18.0.109 «el nombre basta») → RESUELTO: a la cola del médico (DIS-2). | SA-CUMPL (NT-03) | Alta |
| NT-107 | SA-CUMPL | `_encolarAvisoPendiente:15978` (`vgl_avisos_pendientes`) | Normativa / PHI | La cola guarda el payload COMPLETO (nombre+cédula) en texto plano en localStorage; los ROJO no pintados persisten indefinidamente si no se abre HCHealth (la caducidad de 10 min solo corre en el flush). | SA-CUMPL (NT-03 d) | Alta |
| NT-108 | SA-ACC, SA-MED | `maybeNotify` return MORADO-pym `:16512`; tinte de tarjeta `:34785` | Axioma §1.5 (color nunca único portador) | B03 (3+ PyM) es COLOR-ONLY: sin badge de texto, sin icono, sin aviso. Un daltónico no la distingue de una AZUL. Además es un silencio: el médico esperaría oírlo (SA-MED silencio nº 2). | SA-ACC (NT-09 hallazgo 1) + SA-MED (NT-05) | Alta |
| NT-109 | SA-NOTIF, SA-ACC, SA-MED | `muteFor:14769`/`muted:14768` (memoria de pestaña) | Silenciable / seguridad clínica | (a) `state.muteUntil` no se comparte entre pestañas: el silencio de una no calla el flush de cola ni el tono de otra; (b) muteFor calla tono Y cartel: como el ROJO es edge una-sola-vez, un fraude dentro de la ventana de mute pierde su ÚNICO aviso sonoro (queda toast, fácil de perder escribiendo la HC). | SA-NOTIF (NT-02 A19) + SA-ACC (NT-09 h.3) + SA-MED (NT-05 silencio 3). Parte (b) → cola del médico (DIS-5) | Alta |
| NT-110 | SA-UI | `_mostrarAvisoPausaClinica:35904` CSS `:35959` | UI / accesibilidad / seguridad | El banner del killswitch resuelve #ff8177 sobre #f7fafc = **2,31:1** en ambos temas: FALLA AA y AAA. El aviso del apagado de seguridad (C4, R=3) es ilegible. Los fallbacks del propio literal (#991b1b/#ffffff darían 8,31 AAA) no se aplican por estar en la lista de tokens sin `.light`. | SA-UI (NT-08 hallazgo 1, ratio calculado WCAG) | Alta |
| NT-111 | SA-MED, SA-UX | `osNotify:35439` (D02) | O / canal | Líder ciego avisa 1/día: si la lectura cae a media jornada, toda la vigilancia queda muda sin nuevo aviso (SA-MED silencio 4). Además sale por C3 (SO) incluso con pestaña visible (R=2). | SA-MED (NT-05) + SA-UX (NT-07 tabla D02) | Media-Alta |
| NT-112 | SA-UX | `avisoUniversal` sección 🎯 adelantables | Canal vs R (regla de oro) | Un modal C4 (persistente, bloqueante) para un contenido R=1 («puede adelantarlos… Usted decide») nace demasiado alto: 4 > 1. | SA-UX (NT-07 escalamiento) | Media |
| NT-113 | SA-UX | `checkAvisoUniversal:15599` (C02 re-aviso labs) | Canal vs R | El re-aviso de labs tardíos es C4 modal para R=2; interrumpe al paciente siguiente. | SA-UX (NT-07) | Media |
| NT-114 | SA-UX, SA-ACC | CSS `#vgl-pym-banner` (muerto) | Higiene | CSS y sweep de un banner retirado en v14.2.0 siguen en el archivo (~80 líneas CSS + listas de contenedores). Limpieza S2 sin cambio de comportamiento. | NT-07/NT-09 + corrección 1.b | Baja |
| NT-115 | SA-ACC | `#vgl-toasts` `aria-live=polite:21029`; `.vgl-toast` sin tabindex | Accesibilidad | Los toasts CRÍTICOS (ROJO/MORADO/AMBAR, nunca autocierran) anuncian por `polite` (piden `assertive`) y no son cerrables con teclado (solo clic); la «×» es decorativa. | SA-ACC (NT-09 hallazgo 2) | Media |
| NT-116 | SA-ACC, SA-UI | `.vgl-pym-t` 11,5px / `.vgl-pym-lead` 11px / `--t-nano` 10px | Tamaño legible | Texto del modal de pendientes bajo el mínimo de 12px (regla §1.5); 10px en labs-modal. | SA-ACC (NT-09 h.7) + SA-UI (NT-08 h.5) | Media |
| NT-117 | SA-UI | z-index literales: 17293, 17728, 17814, 33454, 35959, 36018, 37330, 37409, 48166 | Tokens UI | 9 z-index fuera de tokens `--z-*`; disco-banner usa el valor de `--z-panel`; toast (z máx) pinta sobre modales C4/C5. | SA-UI (NT-08 h.4) | Baja |
| NT-118 | SA-NOTIF | `notify:13906` (D03 PyM cargado) sin uid; D11 `:5454/5464/9544` | Tope/frecuencia | «PyM cargado/actualizado» sin uid explícito → hash de texto: cada re-subida con contador distinto = aviso nuevo, sin tope. D11 (fallos de guardado) repite con cada intento fallido, sin dedup persistente. | SA-NOTIF (NT-02 puntos sin tope) | Media |
| NT-119 | SA-DEV | `.then` de `tickApi:17057` → `avisoPacEval` | Fuga post-kill | La promesa no mira `state.killed`: una respuesta en vuelo tras el teardown consume presupuesto de toasts y marca vistos sin pintar nada. | SA-DEV (NT-06 fuga d) | Media |
| NT-120 | SA-NOTIF | `_encolarAvisoPendiente:15983` tope 50; caducidad `:16020` | Telemetría/fuga | El desborde del tope 50 descarta en silencio; los carteles caducados solo dejan console.log: hoy invisibles para toda métrica. | SA-NOTIF (NT-02 pérdida 5) | Baja |
| NT-121 | SA-USR | jornada completa (medición) | Carga (C) | **Medido en arnés (24 pacientes, 08:00-12:00, config de fábrica): 55 avisos/jornada (13,3/h; pico 15/h a las 11:00), 44% autodescartables (VERDE/AZUL), 13 avisos durante 43 min de escritura en HC (8 toasts, 4 tonos, 1 modal), hasta 4 críticos persistentes acumulados sin cerrar. Por la rúbrica §3.2 → C=3 (>40/jornada).** C3(SO)=0 en jornada atendida (1 canal = 1 aviso se cumple). Presupuesto suprimió 2 avisos universales de 8 candidatos. | SA-USR (NT-04, corrida reproducible con arnés) | Dato |
| NT-122 | SA-USR | `repFlush:12283/12293` (`enviadas++`, `fallo = true`) | HALLAZGO NO TOCADO (fuera de alcance) | Variables no declaradas → ReferenceError en modo estricto al flushear la cola de telemetría (reproducido 2 veces en arnés). No es del sistema de avisos; se reporta y NO se toca (regla AGENTS.md). | SA-USR (NT-04 hallazgo lateral) | Alta (telemetría) |
| NT-123 | SA-CUMPL | `avisoPacHistPodar:10848` | Retención | Poda SOLO por conteo (2000→1500), sin límite temporal: cédulas persisten indefinidamente en localStorage; sin salida desde el panel. | SA-CUMPL (NT-03) | Media |
| NT-124 | SA-CUMPL | `TERMINOS_TEXTO:36811` (v1.2) | Consentimiento/avisos | El aviso de privacidad no declara: (1) SO con nombre, (2) `vgl_avisos_pendientes` en claro, (3) `vgl_aviso_hist` con cédulas, (4) bitácora `vgl_ev_*` con nombre. Decreto 1377/2013 (contenido del aviso). | SA-CUMPL (NT-03 f) | Media |
| NT-125 | SA-MED | `_flushAvisosPendientes:15991` caducidad 10 min | Silencio / evidencia | Un ROJO ocurrido con el médico fuera del módulo puede quedarse sin reflejo visual persistente (caduca a 10 min). Choca con el diseño v14.1.5 (el médico pidió NO recordar tarde) → RESUELTO: a la cola del médico (DIS-3). | SA-MED (NT-05 silencio 5) | A decidir |
| NT-126 | SA-ACC | `startFlash:14810` (timer 900 ms) | prefers-reduced-motion | El parpadeo de título/favicon solo respeta `S.parpadeo`, no la preferencia del SO. | SA-ACC (NT-09 h.6) | Baja |
| NT-127 | SA-NOTIF, SA-UX | `startFlash:16097` solo ROJO/MORADO/AMBAR | Redundancia sensorial | VERDE/AZUL por SO suprimido no tienen respaldo visual (sin flash): aviso perdido sin señal. (Se mitiga si M13 baja el VERDE oculto a C0.) | SA-NOTIF (NT-02 A17) | Baja |
| NT-128 | SA-NOTIF | `bigAlert:15263` reemplazo sin `acknowledge` | Consistencia | El modal reemplazado muere sin acknowledge(): su nag sigue vivo y su contenido se pierde sin registro del desenlace. | SA-NOTIF (NT-02 pérdida 5) | Media |

## 3. DISCREPANCIAS Y RESOLUCIÓN (NT-20, jerarquía §5.2)

| DIS | Posición A | Posición B | Árbitro | Resolución (por jerarquía: seguridad clínica → voluntad del médico → normativa → consistencia → UX → UI) |
|---|---|---|---|---|
| DIS-1 | SA-NOTIF: extender tope 3/hora a MORADO/AMBAR (fatiga) | SA-MED: B02 MORADO=R3, B04 AMBAR=R2-3; veto a topear lo que cambia acción clínica (asimetría D4) | SA-ORQ | **Gana SA-MED** (seguridad clínica). La fatiga de B02/B04 se ataca por telemetría (M18) + agrupación, no por tope. Ningún tope a eventos R≥2 sin datos medidos que lo justifiquen. |
| DIS-2 | SA-CUMPL: nombre en canal SO = no cumple (Ley 1581/2012) | Decisión previa del médico v18.0.109: «el nombre basta» (voluntad explícita) | SA-ORQ | **Voluntad del médico > normativa**, PERO el propio encargo (§6 eje canales) fija «SO sin PHI en el texto» como política objetivo → **a la cola del médico** con opciones (M9/Q1). No la decide el enjambre. |
| DIS-3 | SA-MED: el cartel ROJO encolado no debería caducar (evidencia de fraude) | Diseño v14.1.5: el médico pidió explícitamente no recordar llegadas ya pasadas | SA-ORQ | **Voluntad previa del médico documentada gana** → **a la cola del médico** con opciones (Q3). |
| DIS-4 | SA-UX: VERDE con pestaña oculta debería bajar de C3 a C0 | SA-MED: R=1, sin pérdida clínica real («cierra la espera») | SA-ORQ | **Compatibles**: propuesta M13 aprobada como hipótesis medible S1 (regla de oro: canal ≤ R). Sin veto clínico. |
| DIS-5 | SA-ACC/SA-MED: muteFor no debería callar el único sonido del ROJO | Diseño v17.19.0: el médico pidió silencio «minimalista» que calla sonido+cartel | SA-ORQ | **Voluntad del médico gana** → **a la cola del médico** (Q2). La parte NO visible (compartir muteUntil entre pestañas, M4) sí va al plan S1. |
| DIS-6 | SA-UX: presupuesto 6/día debe eximir abandono (R3) | Presupuesto P13·4.4 = decisión del médico (medida 72/día de ruido) | SA-ORQ | El axioma §1.1 (nivel 3 reservado a abandono/fraude) es JERÁRQUICAMENTE superior al presupuesto → M1 al plan S0, y por cambiar qué ve el médico también **a la cola** (Q4) como confirmación. |

---

## 4. CIERRE DE IMPLEMENTACIÓN (2026-09-07, SA-DEV/SA-ORQ)

> Ejecución del encargo de implementación de medidas correctivas/preventivas/de mejora
> sobre los hallazgos NT-101…128. Plan detallado, responsables y plazos en
> `AUDITORIA/SEGUIMIENTO_NOTIFICACIONES.md` (A01-A23). Informe final en
> `AUDITORIA/INFORME_CIERRE_NOTIFICACIONES.md`.

### 4.a Estado por hallazgo (resumen)

- **Cerrados con código + prueba** (suite_89 «Medidas del enjambre NT (M1-M22)», 20 casos;
  mutaciones verificadas en `tests/INFORME_MUTACIONES.md`, 10 filas nuevas):
  NT-101 (M1), NT-102 (M2), NT-104/105 (M3), NT-106 (M9/Q1-b), NT-107 (M10),
  NT-108 (M5/Q5), NT-109 (M4/Q2), NT-110 (M16), NT-111 (M6/M14 ajustada),
  NT-113 (M12), NT-115 (M15), NT-116/117/126 (M17 acotada), NT-118 (M19),
  NT-119 (M7), NT-120 (M18), NT-123 (M21), NT-124 (M22), NT-103, NT-125 (Q3),
  NT-127 (M13 ajustada), NT-128 (M8).
- **Desestimados con causa**: NT-112 en su rama «solo-adelantables → toast» (M11):
  contradecía el contrato v18.0.120 — el LDL fuera de metas vigente sale como aviso de
  entrada completo (prueba punta a punta suite_04). La mitad que SÍ cerró (re-aviso de
  labs → C1, M12) se mantiene.
- **Verificado corregido externamente**: NT-122 (`repFlush` ya declara
  `let enviadas = 0, fallo = false;` — corrección del enjambre paralelo, caso en suite_89).
- **Aplazado**: NT-113b/NT-114 limpieza de CSS muerto del banner PyM (A21): colisión de
  escritura activa con el enjambre SF-## en las mismas zonas CSS.
- **Pendientes de ratificación del médico** (👤): Q1-b (SO sin nombre), Q2 (ROJO exento
  de mute), Q3 (caducidad ROJO 30 min), Q4 (exención R3 del presupuesto), Q5 (aviso 3+
  PyM con tope 3/h). Todas reversibles en un solo bloque.

### 4.b Incidencias de la implementación

6. **El enjambre paralelo SF-## pisó ediciones de este enjambre NT al menos 3 veces**
   (write-back de copias stale del archivo): M11/D02/pym-t/sp-toast reaparecieron en su
   versión vieja minutos después de corregidos. Mitigación: verificación de anclas antes
   y después de cada corrida del banco; banco re-lanzado hasta capturar una versión
   íntegra. La corrida final re-verificó las 7 anclas tras terminar.
7. Banco interrumpido una vez a mitad de corrida (proceso hijo muerto por interferencia
   del entorno — igual que la incidencia 5 de la auditoría).
