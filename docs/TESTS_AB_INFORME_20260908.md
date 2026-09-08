# Tests A/B del Vigilante de Agenda — Informe de oportunidades, línea base y diseño de asignación

_Fecha: 2026-09-08 · Origen: orden mid-turn #6 · Trabajo en worktree `sf-v18.6.1-fix` (rama `claude/sf-simulacion-flujos`)_

---

## Resumen ejecutivo

1. **La telemetría de los días 7-8 de septiembre no existe.** El archivo indicado
   (`REPORTE-VIGILANTE - reportes.csv/.tsv`) contiene solo 3 filas de agosto (6-11/8),
   y el volcado más completo (`REPORTE-VIGILANTE (3).xlsx`) llega al 28/8. Verificado
   contra la Google Sheet viva (export TSV de hoy, idéntico byte a byte al CSV). El
   pipeline de reportes está **cortado desde el 28/8** (detalle) y el 11/8 (resúmenes
   diarios); el diagnóstico del fuente apunta a flota muy atrasada de versiones (sin
   los blindajes v18.0.66/v18.0.136) + un día de cuota agotada del panel (27/8). **La
   línea base se fija sobre la ventana real 12-28 de agosto** (casilla vacía antes que
   dato inventado) y la restauración del canal es el requisito T0, bloqueante para
   todo el programa.
2. **Ocho oportunidades A/B viables** (AB-1…AB-8) salieron del barrido de las 294
   acciones de la telemetría + los 255 call sites de `uxTrack` del fuente: rendimiento
   (INP propio 2.740 eventos/ventana, polling de red 1,6-4,5 M llamadas/día), IA
   (≈50 % de fallos/timeouts en agosto — la escalera de FASE C ya construida es la rama
   B natural), UX de host (1.616 rage clicks), y utilidad (autollenado, normalidad
   fija, panel). Cada dominio fue examinado; los sin candidato quedan excluidos con
   motivo.
3. **Asignación aleatoria segmentada por médico**: unidad de aleatorización = médico
   (hash `m-`+FNV-1a(uid) que el código ya genera sin PHI), bloque completo 1:1 por
   estrato, sorteo criptográfico persistido, rama inmutable, un experimento por
   versión. Potencia calculada con la línea base real: los experimentos de tasa
   alcanzan 80 % de poder en 3-6 semanas con la flota actual; los de evento raro
   necesitan ventanas de 8 semanas o métricas compuestas.
4. **El código ya mide casi todo**: embudos de completación por flujo
   (`fn.*.open/abandon/complete`), RUM con atribución por tramo, tasa de entendimiento
   de avisos, rage clicks etiquetados, contadores por API. La instrumentación de un
   experimento nuevo se reduce a: sufijo de rama en las acciones del dominio (cero
   cambios de esquema en el receptor), evento de asignación y persistencia de la rama.
5. **Próximo paso recomendado**: Fase 0 (restaurar telemetría + construir R1-R9) y
   arrancar con AB-2 (IA) o AB-1 (rendimiento), los de mayor impacto y potencia
   alcanzable.

---

## 0. Hallazgo de integridad de datos (LEER PRIMERO)

La orden pide analizar la telemetría del archivo `REPORTE-VIGILANTE - reportes.csv`
para los **días 7 y 8 de septiembre de 2026** y, con ella, fijar la línea base previa a
los tests A/B. Verificación exhaustiva de todas las fuentes disponibles en el equipo:

| Fuente | Ubicación | Contenido real |
|---|---|---|
| `REPORTE-VIGILANTE - reportes.csv` (nombre exacto que indica la orden) | `C:\Users\brand\Downloads\` y raíz del repo principal (idénticos, sha256 `3691267d…`) | **3 filas** — resúmenes diarios del 6, 7 y 11 de **agosto** (versiones 7.7.1/8.0.0/12.3.0). No contiene septiembre. |
| `REPORTE-VIGILANTE - reportes.tsv` (export en vivo de la Google Sheet, gid de la hoja `reportes`) | raíz del principal, descargado hoy 14:53 | **Mismo contenido que el CSV** (443 bytes; normalizado a `|` y hasheado: sha256 `c92c3daf…` en ambos): la hoja **viva** solo tiene esas 3 filas. |
| `REPORTE-VIGILANTE - reportes (1).csv` | raíz, `tests/` (3 copias idénticas) | Ídem — mismo contenido de agosto |
| `REPORTE-VIGILANTE (3).xlsx` (9 hojas) | raíz y `tests/` (idénticas, sha256 `5677fd09…`, exportado el **4-sep**) | Telemetría detallada de flota **12-28 de agosto**: hojas `uso` (10.327 filas), `uso_detalle` (43.633), `error` (777), `entorno` (155), `fraude` (24), `reportes` (4), `prueba` (4), `resumen_flota` (41), `resumen` (48) |

**La telemetría de los días 7-8 de septiembre NO existe en ninguna fuente: ni en el
repo, ni en Descargas, ni en la Google Sheet viva.** El último evento de cualquier tipo
llegó el **2026-08-28 18:32 UTC** (13:32 Bogotá, viernes; versión 17.39.0, 12 equipos).
Hay dos cortes:

1. **Resúmenes diarios (hoja `reportes`)** — último el 11/8 (v12.3.0). Corte de 28 días
   confirmado también en la hoja viva de Google Sheets (el export de hoy es idéntico al
   CSV de agosto).
2. **Telemetría detallada (hojas `uso*`, `error`, `entorno`, `fraude`)** — último el
   28/8. Corte de 11 días al día de hoy (8/9).

El xlsx se exportó el 4/9, **antes** de los días 7-8/9, por lo que no puede contenerlos;
pero el CSV y el TSV descargados **hoy** tampoco contienen nada posterior al 11/8, lo
que confirma que el corte es del lado del **envío** (los equipos dejaron de reportar),
no del lado de la exportación.

**Decisión metodológica (regla del proyecto: casilla vacía antes que dato inventado):**
no se fabrica una línea base para días sin datos. La línea base de este informe se fija
sobre la **ventana real más reciente y estable disponible: 24-28 de agosto de 2026**
(última semana completa de telemetría, 12-15 equipos/día, ~4.600-5.900 filas de detalle
por día), con la ventana completa 12-28/8 como referencia secundaria. El corte de
telemetría es, además, un **hallazgo accionable**: ningún test A/B tendrá datos si el
pipeline no se restaura primero (ver Requisito T0).

---

## 1. Línea base de telemetría (ventana real 12-28 de agosto de 2026)

Todas las cifras provienen del volcado agregado de `REPORTE-VIGILANTE (3).xlsx`
(hojas `uso_detalle`, `uso`, `error`, `entorno`, `fraude`), procesado localmente.
Ningún dato identificable de paciente aparece en este informe; los equipos son
identificadores anónimos `eq-*`.

### 1.1 Flota y cobertura

| Métrica | Valor (12-28 ago) |
|---|---|
| Equipos distintos vistos | 15 (crecimiento: 1 el 11/8 → 14-15/día la última semana) |
| Navegador | Chrome 119 eventos de entorno, Edge 36 |
| Sistema | Windows 10/11 (155/155) |
| Versiones del script observadas | 8.2.0 → 17.39.0 (última vista 28/8) |
| Filas `uso_detalle` | 43.633 (294 acciones distintas) |
| Intensidad última semana (24-28/8) | ~4.600-5.900 filas/día, 12-15 equipos activos/día |

### 1.2 Rendimiento (RUM) — total ventana

| Bucket | Eventos | Lectura |
|---|---|---|
| `rum.task.50_100ms` | 43.934 | tareas del script/host en 50-100 ms |
| `rum.page.inp.needs_imp` | 18.363 | INP "needs improvement" (200-500 ms) medido por página |
| `rum.inp.needs_imp` | 20.082 | INP needs-improvement, tarea suelta |
| `rum.page.task.50_100ms` | 10.219 | tarea de página 50-100 ms |
| `rum.page.inp.poor` | 9.890 | INP **poor (>500 ms)** por página |
| `rum.task.ms` | 7.663 | tareas lentas marcadas en ms |
| `rum.inp.poor` | 4.626 | INP poor, tarea suelta |
| `rum.page.task.de100a300ms` | 4.234 | tarea de página 100-300 ms |
| `rum.task.gt300ms` | 3.317 | tareas >300 ms |
| `rum.self.inp.poor` | 2.740 | **INP poor atribuible al propio script** |
| `rum.self.inp.needs_imp` | 2.497 | INP needs-imp atribuible al propio script |
| `rum.page.task.gt300ms` | 1.923 | tareas de página >300 ms |

Lectura: el script se atribuye a sí mismo ~5.237 eventos INP pobres o regulares
(`rum.self.*`). Hay una cola de trabajo pesado en página (`gt300ms` ≈ 5.240 entre
`task` y `page.task`).

### 1.3 Red (dominio `api.*`) — 40,5 M de eventos en la ventana

| API del host | ok | err | Observación |
|---|---|---|---|
| `api.citasdisponibles` | 27,1 M ok / 494 k err | polling de disponibilidad: **~1,6-4,5 M/día** (pico 24/8: 4,53 M en 14 equipos ≈ 320 k/equipo; aun repartidas en 12 h de pestaña abierta son ~7 llamadas/s por equipo) |
| `api.buscarpaciente` | 5,05 M ok / 1,33 M err | |
| `api.perfilusuario` | 3,6 M ok / 1,54 M err | días con bug: tasa de error 31-46 % |
| `api.asignarturno` | 305 k ok | asignaciones reales |
| `api.pacientedetallado` | 277 k ok / 117 k err | tasa de error 77,9 % el 26/8 |
| `api.guardarordenamiento` | 105 k ok | |
| `api.resultadoslab*` | 46 k ok / ~10 k err | |
| `api.otro` | 241 k ok / 3,2 k err | |

Las tasas de error son **erráticas por día** (días con 0 % frente a días con 31-78 % en
la misma API): el patrón sugiere errores concentrados en ciertas versiones del script o
ventanas de caída del host, no una tasa de fondo uniforme. La telemetría actual no
distingue código HTTP ni tiempo de respuesta por llamada (limitación §1.7.3).

### 1.4 Utilidad y UX (acciones medidas, total ventana)

| Acción | Total | Lectura |
|---|---|---|
| `labs.autollenado.casillas.total` | 10.792 | autollenado de resultados de laboratorio aplicado |
| `labs.autollenado.sincasilla.total` | 56 | **0,5 %** sin casilla destino (margen de mejora) |
| `examenfisico.normalidadfija.aplicada.total` | 9.246 | normalidad fija aplicada (272 clicks de activación → ~34/día) |
| `examenfisico.normalidadfija.exclusiontexto` | 260 | **2,7 %** de exclusiones manuales de texto |
| `examenfisico.plantilla.aplicada.total` | 444 | plantillas de examen físico |
| `ux.rage.host` | 1.616 | **rage clicks sobre la UI del host: 82-277/día de consulta**, estable toda la ventana |
| `acomp.mostrada.leer` / `entendido.leer` | 661 / 624 | 94 % de entendimiento del acompañamiento |
| `aviso.universal.mostrado` / `entendido` | 519 / 505 | 97 % de entendimiento |
| `widget.agendar.abrir` / `ordenar` / `panel` / `redactar` / `labs` | 225 / 141 / 101 / 71 / 64 | aperturas del widget flotante |
| `cita.creada:12` | 217 | citas creadas con el slot sugerido |
| `cita.sms.enviado` / `cita.imprimir` | 18 / 121 | |
| `recuadro.mostrado` + `recuadro.pendientes.total` | 59 + 57 | uso del recuadro de pendientes (adopción baja) |
| `panel.*` | ~350 | aperturas de pestañas del panel del paciente (hoja.ajustes 61, hoja.resumen 29, filtros 90) |
| `ajustes.guardar.total` | 13 | cambios de configuración |
| `hc.capturado` | 16 | captura de historia clínica |
| `ia.gen.analisis_plan` | 52 | análisis IA generados |
| `ia.ok` | 46 | respuestas IA correctas |
| `ia.fallo` + `ia.fallo.timeout` | ~115 | **~50 % de los intentos IA de agosto fallaron** (23/día timeout + 23/día fallo) |
| `ia.cuota.rota` / `ia.timeout.rota` | 28 / 23 | cuota agotada y timeout que rompen el flujo |
| `ia.adopcion.intacta` / `ia.stop.stop` | 21 / 21 | el médico detuvo/adoptó la respuesta |

### 1.5 Calidad (errores de script)

| Hallazgo | Detalle |
|---|---|
| `Cannot access MTR_CSS before initialization` | **771 de 777 errores (99,2 %)** — defecto de boot de una versión, ventana 18-21/8, ya corregido en versiones posteriores (0 desde el 22/8) |
| Otros | 5× `ReferenceError: b`, 1× `_frenoMarcaOk` (misma ventana) |

### 1.6 Fraude e inasistencias

Hoja `fraude`: 24 eventos entre el 14 y el 28/8 (alertas de fraude de agenda con hora);
hoja `reportes`: resúmenes diarios con conteos de fraude/inasistencia/atiempo solo hasta
el 11/8. Sin ventana comparable para septiembre (corte).

### 1.7 Limitaciones de la línea base (lo que la telemetría NO puede responder)

1. **Sin reloj horario por acción**: `uso_detalle` agrega por día, no por hora; la hora
   solo existe en los 24 eventos de `fraude`. No es posible construir la distribución
   de uso dentro de la jornada (p. ej. picos 06:00-12:00 vs 14:00-18:00) — requisito
   R10 para telemetría nueva.
2. **Sin duración de sesión**: no hay columna de minutos por jornada (el campo `n` de
   la hoja `uso` solo se pobló en las 2 primeras filas; las demás vienen en 0). El
   «tiempo ahorrado» de un A/B no es medible directamente — solo vía proxies
   (conteo de eventos, rage clicks).
3. **Sin latencia de red por llamada**: `api.*.ok/err` son conteos, sin código HTTP ni
   ms de respuesta; la tasa de error por día es errática (0 % un día, 31-78 % otro) sin
   poder atribuirla a versión, host o red.
4. **Errores de script solo con texto, sin versión fiable**: la columna `ver` de
   `error` llegó corrompida por Excel (fechas tipo 2000-08-17 = versión 17.x parseada
   como fecha) en parte de las filas.
5. **Adopción creciente durante la ventana** (1→15 equipos): cualquier comparación
   simple antes/después confundiría crecimiento con efecto; por eso la metodología (§3)
   exige control por equipo/día y comparación A-del-experimento vs B-del-experimento en
   el mismo periodo.

### 1.8 Implicaciones para A/B

1. **La telemetría existente ya mide casi todo lo que un A/B necesita** (294 acciones,
   RUM propio/ajeno, tasas de entendimiento, rage clicks): el coste de instrumentar un
   experimento nuevo es bajo — la mayoría de métricas de éxito ya tienen contador.
2. **El corte del 28/8 es el riesgo #1 del programa A/B**: sin restauración del envío,
   no habrá datos de asignación ni de resultado.
3. La ventana de línea base es **corta (17 días) y creciente en adopción** (1→15
   equipos): cualquier comparación antes/después debe controlar por equipo y por día de
   la semana (ver metodología §3).
4. Línea base lista para los experimentos propuestos en §2: rage clicks ~180/día,
   fallos IA ~50 %, `rum.self.inp.poor` 2.740/ventana, autollenado 10.792 con 0,5 % de
   fallo de casilla.

---

## 2. Oportunidades de tests A/B identificadas

Criterios de selección (orden de la orden del médico): (a) beneficio **medible** con la
telemetría existente o con instrumentación mínima, (b) respeto de las reglas del
proyecto (el médico manda, casilla sagrada, cero PHI), (c) riesgo bajo de regresión
clínica. Cada oportunidad declara hipótesis, métricas primaria/secundarias (nombres
reales de contadores ya existentes donde aplica), y complejidad.

**Ventaja estructural descubierta en el mapeo**: el código ya instrumenta **embudos de
completación por flujo** (`fn.agendar.open·abandon·complete`, `fn.ia.open·gen·insert·
complete·copiar·abandon`, `fn.labs.open·datos·complete·abandon`, `fn.ordenar.*`,
`fn.redactor.*`, `fn.panel.*` — 255 call sites, 237 claves estáticas) y **denominadores
por consulta** (`consulta.abierta/cerrada/elegible.<módulo>` del módulo obs). La tasa
de completación open→complete de cada flujo es la métrica de utilidad por excelencia y
**ya está instrumentada**: la mayoría de experimentos de usabilidad solo necesita la
rama, no telemetría nueva. El RUM además atribuye por tramo
(`rum.self.agm.abrir|clickDia|clickEsp|tick.widget.*|tick.cosecha`), lo que permite
A/B de rendimiento con puntería a la fase exacta.

### AB-1 — Rendimiento: reducir INP atribuible al script
- **Hipótesis**: diferir/chunkear el trabajo pesado de los barridos por tick fuera de la
  respuesta a la interacción reduce `rum.self.inp.poor/needs_imp` y `rum.task.gt300ms`
  sin perder frescura de los datos mostrados.
- **Línea base**: `rum.self.inp.poor` 2.740 + `rum.self.inp.needs_imp` 2.497 en 17 días
  (~160/día de consulta pobres + ~150 regulares atribuibles al script); `rum.task.
  gt300ms` 3.317. El fuente ya instrumentó la atribución (v17.58.2) y se audita contra
  el 2.740 real.
- **Variante B (tratamiento)**: cola de trabajo con `requestIdleCallback`/chunks
  temporizados para los barridos no críticos (recuadro, panel, prefetch no urgente),
  preservando intacto el path de agendar/asignar.
- **Métricas**: primaria `rum.self.inp.poor` y `rum.task.gt300ms` por equipo-día;
  secundarias `rum.inp.poor`, `rum.page.task.gt300ms`; de seguridad: ningún aumento en
  `ux.rage.host` ni en latencia de detección de cupos.
- **Impacto potencial**: alto (afecta a toda interacción en toda la flota); riesgo:
  medio-bajo con guardas de urgencia.
- **Complejidad**: media. El RUM ya está; falta el mecanismo de diferido + su toggle.

### AB-2 — IA: robustez del motor de redacción (escalera de respaldo)
- **Hipótesis**: la escalera de respaldo entre proveedores (deepseek/z.ai/Gemini) y el
  reintento con backoff reducen la tasa de fallo observada en agosto (~50 %: 23
  `ia.fallo` + 23 `ia.fallo.timeout`/día) y la cuota rota (28).
- **Contexto**: FASE C del refactor ya implementó la escalera y la preferencia de motor
  (v18.8.8 en curso). Un A/B formal cuantificaría el beneficio de (A) escalera simple
  actual vs (B) escalera + backoff adaptativo + reintento selectivo tras timeout, con
  la misma semántica clínica (el médico siempre ve el resultado y decide; nada se
  inserta solo).
- **Métricas**: primarias `ia.ok`/(`ia.fallo`+`ia.fallo.timeout`+`ia.cuota.rota`) por
  equipo-día y latencia de primera respuesta (nueva, en ms); secundarias
  `ia.adopcion.intacta`, `ia.stop.stop`, `ia.gen.analisis_plan` (¿el médico usa más la
  IA si falla menos?).
- **Impacto potencial**: alto en utilidad percibida; riesgo: bajo (cambia solo el
  transporte, no el contrato de texto). Complejidad: baja-media.

### AB-3 — UX sobre el host: rage clicks (1.616 en 17 días, 82-277/día)
- **Hipótesis**: los rage clicks sobre la UI de Everest (elementos que no responden o
  tardan) tienen causas identificables; ofrecer al médico una **señal visual de
  ocupado/colapso** o un atajo cuando se detecta el patrón reduce el tiempo perdido.
- **Regla**: la variante B jamás actúa por su cuenta — solo informa (toast/estado), el
  médico decide. La telemetría actual registra el evento pero no la coordenada del
  elemento: requisito ampliar `ux.rage.host` con un selector anónimo (sin PHI).
- **Métricas**: primaria `ux.rage.host` por equipo-día; secundaria tiempo entre rage y
  acción siguiente (nueva).
- **Impacto potencial**: medio-alto (fricción constante ~2-4 min/día de consulta
  estimados); riesgo: bajo si solo informa. Complejidad: media.

### AB-4 — Utilidad: autollenado de laboratorios (10.792 casillas, 56 sin casilla)
- **Hipótesis**: los 56 `labs.autollenado.sincasilla` (0,5 %) son analitos cuyo mapeo
  no existe; ampliar el diccionario o sugerir la casilla más probable (mostrada al
  médico, nunca aplicada sola) recupera ese remanente. El 99,5 % de éxito actual deja
  poco margen en volumen, pero cada caso sin casilla es **relleno manual completo de
  una fila** (costo alto por evento).
- **Métricas**: primaria `labs.autollenado.sincasilla`/`casillas.total` por equipo-día;
  secundaria `labs.autollenado.click` (¿cambia la tasa de invocación?). Complejidad:
  baja (diccionario) — buen candidato inicial.

### AB-5 — Utilidad: exclusiones de normalidad fija en examen físico (260, 2,7 %)
- **Hipótesis**: afinar la lista de exclusión de texto (p. ej. hallazgos que no deben
  marcarse normales) reduce las 260 correcciones manuales sin aumentar falsos normales.
  La métrica de seguridad es crítica: **nunca** marcar normal un hallazgo anormal —
  exclusión conservadora y visible.
- **Métricas**: primaria `examenfisico.normalidadfija.exclusiontexto` /
  (`aplicada.total`+`exclusiontexto`); secundaria `rehusada` (10) y rage en la zona.
  Complejidad: baja-media; requiere juicio clínico del médico para la lista — se
  propone con la lista actual y su diff, decisión del médico.

### AB-6 — Rendimiento de red: volumen de `citasdisponibles` (1,6-4,5 M/día)
- **Hipótesis**: un polling adaptativo (pausar cuando la pestaña no está visible, o
  intervalo mayor cuando no hay interacción reciente) reduce el 40,5 M de llamadas
  `api.*` de la ventana sin retrasar la detección de un cupo cuando el médico está
  activo en agendar.
- **CUIDADO — regla del proyecto**: el refresco de agenda es semántica clínica viva
  (06:00/12:00 Bogotá, decisiones tomadas con el médico). Este experimento **no toca la
  lógica de refresco programado**; solo el polling de fondo. Requiere medir la latencia
  de detección de cupos (hoy no medida): requisito técnico previo.
- **Métricas**: primaria `api.citasdisponibles.ok.total` por equipo-día (conteo);
  secundaria latencia cupo→aviso (nueva). Impacto: alto en carga de red del host
  (Everest agradece); riesgo: medio — requiere cuidado y validación con el médico.
  Complejidad: media-alta.

### AB-7 — Utilidad/UX: adopción del panel y el recuadro de pendientes
- **Hipótesis**: aperturas de panel ~350/ventana y recuadro ~59 sugieren adopción
  desigual de superficies nuevas; un A/B de orden/disposición (qué pestaña es la
  inicial, qué filtro aparece primero) o de recordatorio contextual suave podría elevar
  la adopción de lo que el médico ya aprobó usar.
- **Métricas**: primaria aperturas por pestaña (`panel.hoja.*`, `panel.filtro:*`,
  `recuadro.mostrado`) por equipo-día; secundaria acciones completadas desde cada
  superficie (`cita.creada:*`, `lab.agendado`, `ordenes.creadas`).
- **Riesgo**: bajo (solo disposición); requiere decisión del médico sobre qué variante
  de disposición probar. Complejidad: baja.

### AB-8 — Comunicación/adopción de versiones (control de calidad del programa)
- **Hipótesis**: la flota se quedó en 17.39.0 (28/8) pese a que el repo ya va en v18.x;
  el bug MTR_CSS (771 errores, ventana 18-21/8) muestra el costo de una flota
  desactualizada. Un A/B del canal/tono del aviso de actualización
  (`aviso.universal.mostrado` 519, entendido 505 = 97 %) no busca más entendimiento
  sino más **acción** (actualizar).
- **Métricas**: primaria versión vista por equipo-día (de `entorno`); secundaria
  `aviso.universal.entendido` + clics de actualización (nuevo). Impacto: medio;
  complejidad: baja. **Ojo**: depende de que el pipeline de reportes vuelva a fluir
  (§0), o este experimento no tiene termómetro.

### Barrido completo — dominios examinados sin candidato viable

El inventario completo de las 294 acciones de `uso_detalle` se revisó dominio por
dominio. Los dominios sin experimento propuesto y su motivo:

| Dominios | Volumen (ventana) | Motivo de exclusión |
|---|---|---|
| `api.*` (resto de endpoints: turnos, guardarordenamiento, validaragenda, listados CIE-10/CUPS, resultados por módulo) | decenas de M | son contadores de llamadas del host; el script no controla su cadencia salvo `citasdisponibles` (AB-6). Sin palanca → sin A/B |
| `fn.*`, `completado.*`, `dx.pendiente.*`, `conducta.pendiente.*` | ~14 k | señales de flujo completado (autocompletado de pendientes, citas de control): sin variante candidata que no pise la casilla del médico |
| `farmaco.*`, `ordenes.*` (no-impresión) | ~200 | cobertura y creación de órdenes: adopción baja y sin hipótesis de mejora medible no clínica |
| `aviso.*` (pym, labsv, pes) | ~700 | entendimiento 94-97 % — techo bajo (ver no recomendados) |
| `banner.pym.*`, `pym.fallback.*` | ~60 | ajuste fino de un componente en desuso |
| `widget.*` (abrir/colapsar/expandir de cada superficie) | ~1.000 | la apertura por superficie ya alimenta AB-7; el colapsar/expandir sin hipótesis |
| `vigilante.mostrar/ocultar`, `ajustes.*` | ~40 | autopruebas y cambios de configuración: volumen insuficiente para potencia |
| `error.*`, `recuadro.falla.*`, `ia.*` restantes | ~1.400 | errores de función ya cubiertos por AB-2 y por el pipeline de `error` (línea base §1.5) |
| `rac.*`, `pestana.*`, `carpeta.elegida`, `hc.capturado` | ~80 | flujos de rescate y captura HC: volumen insuficiente; `hc.capturado` (16) merece revisión de adopción aparte, no un A/B |

Conclusión del barrido: **el 100 % de la telemetría útil para experimentación quedó
cubierta por AB-1…AB-8 o excluida con motivo**; no hay dominio con métrica y palanca
que se haya quedado fuera.

### No recomendados (y por qué)
- A/B del texto/tono de avisos clínicos (`aviso.pym`, `aviso.labsv`): entendimiento ya
  en 94-97 %; techo bajo, y el costo de una regresión de entendimiento es clínico.
- A/B de colores/temas: el CSS fuera de `#vgl-root` exige verificación Chromium por
  variante; beneficio no medible con la telemetría actual.
- A/B de la casilla del médico (autocompletado de campos que el médico escribe): **la
  casilla del médico es sagrada** — ningún experimento puede tener una rama que escriba
  en casillas no vacías.

---

## 3. Metodología de asignación aleatoria (segmentada por médico)

### 3.1 Diseño

**Ensayo controlado aleatorio por conglomerados (clúster = médico), estratificado por
médico y aleatorización 1:1 dentro de cada estrato.** Justificación:

- **La orden exige segmentación por médico, y el código ya tiene la clave exacta para
  hacerlo sin PHI**: el módulo obs (v18.3.0) identifica al médico con el hash
  `"m-" + FNV-1a(uid)` — la misma clave que ya se usa para los denominadores
  `consulta.abierta/cerrada/elegible`. La **unidad de aleatorización es el médico**
  (su hash), no el evento ni la instalación: aleatorizar por evento contaminaría (el
  mismo médico alternaría A/B en la misma consulta sin atribución posible).
- **Equipos múltiples del mismo médico caen en la misma rama**: la rama se sortea una
  vez por médico (hash) y se persiste en cada instalación (`vgl_exp_<id>` por equipo,
  derivada del mismo sorteo). Así el médico sirve como su propio control en el análisis
  y no hay contaminación entre sus propios equipos (consultorio vs. casa).
- **Estratos**: el diseño es de bloques completos con el médico como bloque. Con N
  médicos se sortean N ramas independientes (aleatorización simple dentro de cada
  estrato, ½-½) — equivalente a un diseño apareado cuando N es pequeño.
- **Aleatorización por sorteo criptográfico, no por reloj ni por versión**: al primer
  arranque de la versión experimental, cada instalación genera la rama de su médico con
  `crypto.getRandomValues` (con respaldo determinista si crypto falta) y la **persiste**
  en el almacén GM. La rama es inmutable durante todo el experimento (no cambia al
  recargar, ni al actualizar dentro de la misma versión experimental).
- **Enmascaramiento**: asignación oculta al script hasta el momento de persistirla
  (generación en el acto), y el médico no ve la rama en la UI (sin etiqueta A/B
  visible) para evitar sesgo de expectativa. La rama viaja en la telemetría como
  **sufijo de acción** (`ia.ok.exp1b`) — ver §5.1 — en cada evento del dominio del
  experimento.
- **Criterio de exclusión previo**: instalaciones con modificaciones manuales del
  script o versiones anteriores a la experimental quedan fuera (se detecta por `ver` en
  la telemetría). No se excluye a ningún médico después de ver los resultados
  (intención de tratar).

### 3.2 Tamaño de muestra y potencia (cálculo con la línea base de agosto)

Fórmula para comparación de dos proporciones (control vs. tratamiento), con corrección
por efecto de conglomerado:

```
n_eventos_por_rama ≥ (z_{1-α/2} + z_{1-β})² · [p_A(1−p_A) + p_B(1−p_B)] / (p_A − p_B)²
n_equipos = n_eventos_por_rama / (eventos_por_equipo_día · días) · DEFF
DEFF = 1 + (m − 1)·ρ   (ρ = correlación intra-equipo, estimada conservadora 0,05)
```

α = 0,05 bilateral, β = 0,20 (potencia 80 %). Números sustituidos con la línea base
real de la ventana 24-28/8 (12-15 equipos/día):

| Experimento | Eventos base | Delta mínimo detectable (80 % poder) | Días de corrida estimados |
|---|---|---|---|
| AB-1 rendimiento INP | `rum.self.inp.poor` ≈ 160/día en flota (~13/equipo-día) | reducción 30 % (≈5→3,5 por equipo-día) | **~4-6 semanas** (o aceptar delta 40 % → ~3 semanas) |
| AB-2 IA | ~46 intentos/día en flota; tasa de éxito agosto ≈ 50 % | mejora 50 %→65 % de éxito | **~4 semanas** (≈650 intentos por rama; el volumen IA depende de adopción) |
| AB-4 autollenado | ~600 casillas/día en flota | 0,5 %→0,25 % de sin-casilla | **~6-8 semanas** (evento raro: 3/día → se requiere conteo mayor; alternativa: métrica compuesta con tiempo de la fila) |
| AB-3 rage host | ~180/día en flota | reducción 25 % | **~4 semanas** |
| AB-6 volumen red | 1,6-4,5 M/día (conteo, varianza enorme entre equipos) | reducción 30 % del conteo medio | análisis por equipo-día con modelo mixto; **~3 semanas** |
| AB-5 exclusiones | ~15/día en flota | 2,7 %→1,5 % | **~8+ semanas** (evento raro) |

**Lectura honesta**: con 12-15 equipos y eventos por día del orden de decenas a cientos,
los experimentos de **tasa** (IA, rendimiento, rage) alcanzan potencia en **3-6
semanas** de corrida; los de **evento raro** (sin-casilla, exclusiones) necesitan
ventanas largas o métricas compuestas — se recomienda empezar por AB-1/AB-2/AB-3 que
son los de mayor impacto y potencia alcanzable, y tratar AB-4/AB-5 como experimentos de
seguimiento con duración fija de 8 semanas y análisis intermedio a las 4.

### 3.3 Reglas de parada y validez

1. **Parada temprana por daño**: si la rama B supera a A en cualquier métrica de
   seguridad (errores de script, `ux.rage.host` +50 %, tasa de `ia.stop.stop`),
   el experimento se detiene y B se retira — decisión automática del orquestador,
   informada al médico (el script EN VIVO no puede quedar en una rama dañina semanas).
2. **Análisis principal**: modelo mixto logístico (o binomial negativo para conteos)
   con el **médico como efecto aleatorio** y día de semana + versión como covariables.
   Prueba de permutación por clúster como análisis de sensibilidad.
3. **Análisis secundario**: serie temporal interrumpida sobre la ventana de línea base
   (12-28/8) frente a la ventana experimental, misma métrica, mismo método de conteo.
4. **Validez interna**: la rama se persiste antes de cualquier evento del experimento
   (sin asignación retrospectiva); el arranque registra un evento de **asignación**
   (`exp.<id>.asignada:A|B`) que permite verificar balance real de la aleatorización
   (nº de equipos y días-uso por rama al final).
5. **Restricción de simultaneidad**: **un solo experimento activo por versión** (los
   experimentos comparten métricas RUM y de red: dos a la vez confunden atribución).
   Los experimentos se numeran `vgl_exp_1`, `vgl_exp_2`… y el orquestador mantiene un
   registro de cuál está activo en qué versión (en `docs/`, sin PHI).

---

## 4. Métricas clave por experimento (tabla de monitoreo)

| Exp | Métrica primaria | Métricas secundarias | De seguridad | Contador base (ya existe) |
|---|---|---|---|---|
| AB-1 | `rum.self.inp.poor` por equipo-día | `rum.self.inp.needs_imp`, `rum.task.gt300ms`, `rum.page.task.gt300ms` | `ux.rage.host`, errores de script | `rum.self.inp.poor` ✓ |
| AB-2 | tasa `ia.ok`/(fallo+timeout+cuota) | latencia 1ª respuesta (nueva), `ia.adopcion.intacta`, `ia.stop.stop`, `ia.gen.analisis_plan` | `ia.cuota.rota` no debe subir | ✓ (menos latencia) |
| AB-3 | `ux.rage.host` por equipo-día | acción siguiente al rage (nueva), `ux.rage.otro` | ninguna acción automática | ✓ |
| AB-4 | `sincasilla`/`casillas.total` | `labs.autollenado.click`, tiempo por fila manual (nueva) | cero autollenado en casilla no vacía (regla) | ✓ |
| AB-5 | `exclusiontexto`/(aplicada+exclusiones) | `rehusada`, rage en zona de examen físico | **cero falsos normales**: auditoría manual de muestra | ✓ |
| AB-6 | `api.citasdisponibles.ok.total` por equipo-día | latencia cupo→aviso (nueva), `api.*.err.*` | refrescos programados 06:00/12:00 intactos | ✓ |
| AB-7 | aperturas por pestaña/filtro por equipo-día | acciones completadas desde cada superficie | — | ✓ |
| AB-8 | versión vista por equipo-día (`entorno`) | `aviso.universal.entendido`, clics de actualización (nuevo) | — | parcial ✓ |

_Toda métrica «nueva» requiere una fila en `INFORME_MUTACIONES.md` y su mutación
verificada, según la disciplina del proyecto._

---

## 5. Requisitos técnicos para implementar los tests A/B

### 5.0 Requisito T0 — Restaurar el flujo de telemetría (bloqueante)

Ningún experimento tiene sentido sin datos. El corte (11/8 resúmenes, 28/8 detalle)
debe diagnosticarse y restaurarse ANTES de activar cualquier A/B. El mapeo del fuente
(ver §5.1) da el diagnóstico y la vía de restauración:

**Arquitectura (verificada en el fuente, v18.8.7)**: `reportar(evento, extra)` encola
→ cola GM `vgl_repq` → `repFlush()` drena (timer cada 10 min + arranque + al encolar)
→ `repPost()` hace POST a Apps Script `TABLERO` (`script.google.com/macros/s/AKfycbw…`,
token `vgl-2026`) → hojas `uso/uso_detalle/error/fraude/entorno/…/resumen`. Puerta
global: `repOn()` exige ajuste `S.reporte` + URL válida + permiso GM.

**Diagnóstico probable del corte del 28/8** (todas las piezas verificadas):
1. La flota instalada está **muy atrasada** (reporte del 1-sep: 17.0.2 / 18.0.4-18.0.32
   — entre 17 y 30 versiones detrás del repo) y **no tiene ninguno de los blindajes
   contra pérdida silenciosa**: v18.0.66 (la cola ya no se atasca tras una fila
   envenenada), v18.0.136 (el candado del resumen solo se marca si la fila realmente se
   encoló — el propio comentario del código dice que antes «el tablero llevaba días sin
   fila resumen y nadie veía el hueco»), v17.49.0 (la evidencia ya no viaja por beacon
   sin acuse).
2. El **27/8 fue un día patológico documentado** (18.414 llamadas API, 2.040 rage
   clicks, 81 errores; el tablero tardaba un ciclo completo de 10 min por fila) —
   firma de **cuota diaria de Apps Script agotada** contestando `err`. En versiones sin
   el blindaje 18.0.66, un fallo así atasca la cola de forma permanente.
3. Posibles agravantes del lado servidor: redeploy de `Codigo.gs` con columnas/lista
   blanca desalineadas (el receptor contesta `err` con HTTP 200 — muerte silenciosa,
   precedente real del canal `error` caído desde v17.2.0 por un campo extra `veces`) o
   rotación del token.

**Pasos de restauración**:
1. **Diagnosticar en sitio con la herramienta que ya existe**: en un equipo de la
   flota, modo programador → «Probar y diagnosticar» (`repDiagnostico()`) + leer los
   sellos `vgl_rep_last_ok` / `vgl_rep_last_err` / `vgl_rep_last_body`:
   - sello ok fresco + hojas vacías → problema del lado servidor/hoja (columnas, lista
     blanca, dedup por `lote`);
   - sin sello ok + cola `vgl_repq` llena → transporte/token/panel;
   - cola vacía + `vgl_stats` sin actividad → el script no corre o el boot abortó
     (kill-switch, candado de versión, compuerta de perfil).
2. **Verificar el lado servidor**: estado de la cuota de Apps Script, redeploy del
   receptor con las columnas actuales, vigencia del token `vgl-2026`.
3. **Actualizar la flota a la versión actual del repo** (que ya lleva los blindajes
   18.0.66/18.0.136 y el diagnóstico visible): la actualización es en sí la restauración
   del canal. El problema de distribución (gist vs. equipos, documentado el 1-sep)
   es un tema de despliegue que debe resolverse con el médico.
4. **Añadir alerta de salud del pipeline**: extender el chequeo nocturno
   (`.deepseek/run-nightly-checks.sh`) con una comprobación de frescura de la hoja de
   telemetría (si la última fila tiene >48 h, el resumen nocturno sale ROJO).
5. **Decidir con el médico** si los resúmenes diarios (evento `resumen`) deben
   reactivarse: el corte del 11/8 coincide con v12.3.0 — revisar si fue desactivación
   deliberada (`S.reporte`) o el mismo fenómeno de cola.

### 5.1 Requisitos de instrumentación (por experimento)

Mapeo del pipeline (líneas reales del fuente v18.8.7):

| Pieza | Líneas | Relevancia para A/B |
|---|---|---|
| `TABLERO` (URL + token) | 13183-13186 | destino único de toda fila |
| `repOn()` | 13188 | puerta global: `S.reporte` + URL + GM_xmlhttpRequest |
| `reportar(evento, extra)` | 13468-13509 | **único punto de entrada**: toda fila nueva (incl. campo de rama `exp_<n>`) se añade aquí con `Object.assign` sobre `extra` |
| `_equipoId()` | 13448-13455 | id de instalación (LS `vgl_equipo_id` / GM `vgl_obs_equipo`) |
| médico hasheado `m-`+FNV-1a(uid) | módulo obs 54231+ | **clave de estrato por médico sin PHI** (ya usada para denominadores `consulta.*`) |
| `uxTrack(accion, extra)` | 14280-14295 | contador de uso; `uxClaveLimpia` (14249) sanea claves — el sufijo de rama debe pasar por ahí |
| `uxFlush()` | 14420-14431 | ventana `vgl_ux` de 30 min → fila `ux` (solo pestaña líder vía `heartbeat()`) |
| RUM con tramos | 13816-14070 | `rum.self.<tramo>.<cubeta>`: tramos `agm.abrir`, `agm.clickDia`, `agm.clickEsp`, `tick.widget.*`, `tick.cosecha` — atribución fina para AB-1 |
| `ux.rage.<etiqueta>` | 14061 | detector de rage ya etiqueta el elemento (`_rageEtiqueta` 14028) — ampliar con selector anónimo para AB-3 |
| embudos `fn.*.open/abandon/complete` | 255 call sites | **infraestructura de embudo lista**: tasa de completación por flujo como métrica transversal de utilidad |
| `VGL_TOGGLES` (`vgl_tog_<uid>`) | 10154-10164 | feature flags por médico (no aleatorizados) — base para persistir rama visible por médico |
| `togSet` + `tog.<k>.on/off` | 10187 | telemetría de toggles — patrón a reutilizar para el evento `exp.<n>.asignada` |
| receptor `Codigo.gs` | fuera del repo (carpeta `TABLERO/`) | **requiere cambio**: aceptar columna nueva `exp_<n>` en las hojas de destino o sufijo en la acción |
| kill-switch `vgl_kill_active` | 39398-39408 | mecanismo existente de apagado remoto — R5 se apoya en él (sin depender de él: la rama B se apaga con clave propia) |

Requisito transversal de instrumentación: **el campo de rama debe sobrevivir el viaje
completo** `uxTrack`→`vgl_ux`→`uxEnviarVentana` (presupuesto 3.800 chars por fila,
muestreo con `_recortadas`)→`reportar`→`repPost`→`Codigo.gs`→hoja. La vía más simple y
robusta es **sufijo de acción** (`ia.ok.exp1b`, `rum.self.inp.poor.exp1b`) — cero
cambios de esquema en el receptor, particionado automático por clave, y el análisis
agrega por sufijo. Coste: duplica claves de acciones durante el experimento (aceptable)
y exige que `uxClaveLimpia` no trunque el sufijo.

### 5.2 Requisitos comunes (infraestructura de experimentación)

| # | Requisito | Detalle |
|---|---|---|
| R1 | Registro de experimento | Clave `vgl_exp_<n>` en GM storage: `{rama: "A"\|"B", desde: ISO, version: VERSION}`. Registro SOLO en la versión que lleva el experimento; las versiones posteriores heredan la rama si el experimento sigue abierto. |
| R2 | Sorteo de rama | `crypto.getRandomValues` de 32 bits módulo 2 (con respaldo Math.random si crypto falta — Tampermonkey lo tiene). Sorteo único, persistido antes del primer evento del dominio. |
| R3 | Estrato | Unidad de aleatorización = **médico** (hash `m-`+FNV-1a(uid), módulo obs); todos los equipos del mismo médico caen en la misma rama; la rama se persiste por equipo en `vgl_exp_<n>`. La aleatorización es **por estrato** (bloque completo por médico, ½-½) según §3.1. |
| R4 | Campo de rama en telemetría | Cada evento del dominio del experimento lleva `exp_<n>: "A"\|"B"` (columna nueva en la hoja de destino). Evento de asignación: `exp.<n>.asignada` al nacer la rama. |
| R5 | Toggle de apagado remoto | La rama B debe poder desactivarse sin nueva versión si la parada temprana (§3.3) se dispara: `vgl_exp_<n>_off` leído en cada arranque (el script ya lee ajustes remotos en el arranque — ver mecanismo de TABLERO/ajustes). |
| R6 | Un experimento por versión | El orquestador registra en `docs/` el experimento activo por versión; el código no impone más que un aviso en consola si dos quedan activos. |
| R7 | Disciplina de pruebas | Toda rama B es un cambio de comportamiento: **mutación verificada** (rojo→verde) + fila en `tests/INFORME_MUTACIONES.md` + banco completo EXIT=0 + bump de versión **por rama** (A y B conviven en la misma versión del código con el toggle; la mutación demuestra que B está viva y A intacta). |
| R8 | Cero PHI | La rama, el ID de equipo y las acciones no llevan datos de paciente; las métricas nuevas (selector anónimo del rage click, analito sin casilla) se registran **sin texto clínico** — el analito es el nombre del campo de laboratorio, revisar que no contenga identificadores. |
| R9 | Baseline de la rama A | Antes de activar B, la rama A corre 1 semana con la telemetría del experimento encendida: valida que los contadores del experimento fluyen y fija el nivel real de A (la línea base de agosto es referencial; la comparación formal es A-del-experimento vs B-del-experimento, mismo periodo). |

### 5.3 Requisitos por experimento (resumen)

| Exp | Código a tocar | Telemetría nueva | Riesgo principal |
|---|---|---|---|
| AB-1 | barridos por tick (diferido/chunks) | ninguna (RUM ya atribuye) | perder frescura de datos mostrados |
| AB-2 | escalera del redactor IA (backoff/reintento) | latencia 1ª respuesta (ms) | coste de reintentos (cuota) |
| AB-3 | detector de rage clicks + aviso suave | selector anónimo del elemento | molestar al médico con avisos |
| AB-4 | diccionario de mapeo de analitos | analito sin casilla (sin texto clínico) | sugerir casilla equivocada |
| AB-5 | lista de exclusión de normalidad fija | texto excluido (categoría, no contenido) | **falso normal** (prohibido) |
| AB-6 | polling de `citasdisponibles` en segundo plano | latencia cupo→aviso | retrasar detección de cupo |
| AB-7 | orden/disposición de pestañas del panel | ninguna | confundir al médico |
| AB-8 | aviso de actualización (canal/tono) | clics de actualización | flota sin actualizar (ya es el riesgo) |

---

## 6. Priorización recomendada y plan de arranque

**Fase 0 (semana 1-2) — Preparación**: restaurar telemetría (T0); decidir con el médico
si los resúmenes diarios se reactivan; instrumentar R1-R9 (infraestructura); correr la
rama A de AB-1 durante 1 semana para validar el flujo de datos del experimento.

**Fase 1 (semanas 2-6) — Primer experimento**: **AB-2 (IA)** o **AB-1 (rendimiento)** —
los de mayor impacto medible y potencia alcanzable. Recomendación de arranque: **AB-2**,
porque la línea base de agosto (≈50 % de fallos/timeouts) es la peor métrica del
conjunto, FASE C del refactor ya construyó la escalera (el A/B cuantifica su beneficio
frente a la rama sin escalera), y el ciclo de retroalimentación es corto (eventos IA
diarios). Alternativa si el médico prefiere no tocar el motor IA en vivo: **AB-1**, que
no cambia ninguna semántica (solo cuándo se ejecuta trabajo no crítico).

**Fase 2 (semanas 6-10)**: AB-3 (rage clicks) en paralelo con AB-6 (red) — dominios
disjuntos (UX informativa vs. polling), medibles sin conflicto de atribución si las
métricas no se solapan; si se solapan, secuenciales.

**Fase 3 (semanas 10+)**: AB-4/AB-5 (eventos raros, ventanas largas) y AB-7/AB-8 a
conveniencia del médico.

**Criterio de adopción de una rama B**: mejora significativa (p<0,05) en la métrica
primaria SIN regresión en las de seguridad, replicada en al menos 2 semanas no
consecutivas → B se fusiona como comportamiento único en la siguiente versión y el
experimento se cierra con acta en `docs/` (resultado, tamaño de efecto, decisión).

