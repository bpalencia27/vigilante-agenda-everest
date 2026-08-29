# Auditoría de arquitectura, código muerto y rendimiento

**Archivo:** `vigilante_agenda.user.js` · **38.715 líneas** · v17.41.0
**Fecha:** 29-ago-2026 · **Banco al momento de auditar:** 2.580 comprobaciones en verde (`TZ=America/Bogota`)

Auditoría de solo lectura, pedida por el médico. Tres frentes: mapa de arquitectura,
código muerto y rendimiento. Toda afirmación lleva `archivo:línea`; lo que no se pudo
verificar se dice, no se supone.

---

## 1 · Arquitectura

**939 funciones de nivel superior** (853 `function` + 86 `async function`), un solo IIFE,
sin build ni dependencias. El archivo trae **su propio índice** en `:45–65` — es la mejor
guía interna que existe y conviene mantenerla al día.

### Reparto por secciones

| Tramo | Sección |
|---|---|
| `:1–33` | Encabezado Tampermonkey: 6 `@match`, 13 `@connect`, `@run-at document-start`, `@noframes`, 4 `@grant`, auto-actualización desde un Gist |
| `:1013–1163` | Bitácora "caja negra" (`vglLog`, tope circular 500, manejo de cuota) + interceptores de error |
| `:1164–4600` | **Laboratorios y Athenea** — `fetchAtheneaLabs` (`:1763`), puente por cédula (`:1842`), auto-login (`:2213`), **`injectLabsIntoCronicos` (`:3215`)**, vigencias RCV (`:3705`), tabla KDIGO (`:4202`) |
| `:4613–5472` | **Cosecha / reconciliador** de la historia (`vgl_cosecha`, `:4625`) |
| `:5473–6300` | **Widgets de Conducta** — `mtrWidgetConductaTick` (`:5615`), `…Ordenar…` (`:5743`), `…Farmaco…` (`:5897`) |
| `:6783–8330` | Deshacer, ajustes (`SETTINGS_KEY`, `:7223`), **reloj en Web Worker** (`:7906`), liderazgo entre pestañas (`:8029`) |
| `:8332–9950` | Excel/PyM, contadores, reportes (`repPost` `:9079`), **RUM** (`:9415`), telemetría UX (`:9739`) |
| `:10528–12200` | Avisos, sección activa, minimizar módulos |
| `:12199–16800` | **Red** — `_pageFetchJsonCore` (`:16408`), `pageFetchJson` (`:16553`) |
| `:12884–15985` | **`buildOverlay()`** y el literal de CSS (`:12886–15940`, ~3.050 líneas) |
| `:16070–23150` | **Agendamiento** — `calcBusinessTargetDate` (`:16327`), `openAgendamientoModal` (`:20861`), `openLabSoloModal` (`:22876`) |
| `:23147–24500` | Órdenes PyM y "Ordenar lo pendiente" (`:24159`) |
| `:18743–20740` | Modales de paciente — `#vgl-panel-modal` (`:20262`) |
| `:27690–33100` | **Motor farmacológico / RCV** portado — interacciones (`:30151`), duplicidades (`:30360`), reglas renales (`:30633`), `mtrClasificarRiesgoCv` (`:31769`), sábados (`:32482`) |
| `:33557–38715` | IA y redactor (Gemini), tendencias, uroanálisis, escucha del tráfico de Everest |

### Los dos linajes fusionados

El banner de `:27691` lo dice sin rodeos: *"MOTOR PORTADO — cálculo puro traído del
Copiloto RCV"*. Conviven dos proyectos, y se nota:

1. **Tres convenciones de nombre a la vez:** `mtr*` (316 funciones, el motor portado),
   `_vgl*`/`vgl*` (83, el Vigilante) y **~540 sin prefijo** (`boot`, `tick`, `reportar`,
   `pageFetchJson`).
2. **Cinco envoltorios de red distintos para lo mismo.** `pageFetchJson` /
   `_pageFetchJsonCore` (`:16553`/`:16408`) es el bueno: coalescencia por clave, RUM,
   backoff, prohibición de reintentar escrituras (`:16419`), fallback a GM. Junto a él
   sobreviven `_gmReq` (`:1879`), `gmJson` (`:10020`), `gmGet` (`:10068`), `gmPostJson`
   (`:16739`) y `gmPostJsonEx` (`:16761`) — **cada uno con su propio timeout (15 s / 12 s /
   60 s / 120 s) y su propio manejo de error.** `gmPostJson` y `gmPostJsonEx` son casi
   idénticas: una devuelve `null` al fallar, la otra `{ok,status,data}`.
3. **Tres generadores de chips de fecha** casi iguales: `renderDayChips` (`:21970`),
   `renderLabDayChips` (`:21892`), `renderLabDayChipsSolo` (`:23052`). Y
   `openAgendamientoModal` (`:20861`) y `openLabSoloModal` (`:22876`) repiten su preámbulo
   casi verbatim.
4. **Pares "original portado" + "ampliado local":** `mtrEvaluarInteracciones` (`:30151`)
   junto a `mtrEvaluarInteraccionesAmpliadas` (`:30415`).
5. **CSS de un linaje que sobrevive al JS del otro:** `#vgl-riesgo-modal` tiene reglas
   (`:12722`) pero **el elemento no se crea nunca** desde que se retiró `openRiesgoModal`
   en v17.6.29 (documentado en `:61`).

---

## 2 · Código muerto

### 2.1 El hallazgo más grave es de proceso, no de código

`FUNCIONES_HUERFANAS.md` (15-ago) etiquetaba como **"Deuda muerta"** tres funciones que
hoy tienen llamador real de producción:

| Función | Llamador |
|---|---|
| `_conductaBuscarYAgregarExamen` (`:24409`) | `:24476` — es el gesto DOM del botón "Ordenar pendientes" |
| `analitoTablaDesdeClaveRcv` (`:4334`) | `:4042` |
| `panelActivities` (`:8217`) | `:26186` — reconectada en v17.22.0 |

Y una cuarta, `vigenciaPorEstadio` (`:4304`), no tiene llamador **pero el propio código
prohíbe borrarla por escrito** (`:4037`: *"NO se borra: es la transcripcion de la Tabla
50"*), con **104 referencias** en `suite_28`.

**Actuar sobre ese documento habría borrado código clínico vivo.** Ya está corregido y
encabezado con la advertencia. El error de fondo era la etiqueta binaria: hacen falta tres
estados —muerta confirmada / sin llamador pero viva / sospechosa— y no dos.

### 2.2 Muerto confirmado: 5 elementos, ~61 líneas

Cero referencias en todo el repo (script, `tests/`, `tools/`, `docs/`), verificadas con los
comentarios eliminados y descartando acceso dinámico:

| Elemento | Línea | Líneas | Por qué quedó |
|---|---|---|---|
| `MTR_REDACCION_SYS` | `:34399` | **43** | El comentario de `:34594` explica que lo sustituyeron y no lo retiraron |
| `mtrIaClickDelegado` | `:36046` | **13** | El `CHANGELOG:1338` afirma haber retirado *"el listener global que `boot()` seguía registrando"* — se borró el registro, **no la función** |
| `MTR_CORRECCIONES_NORMA` | `:32862` | 3 | Documentación ejecutable que nadie lee |
| `PYM_SIN_ACT_MOTIVOS` | `:8797` | 1 | Duplica como array los literales que `pymMotivoSinActividades` (`:8798`) devuelve en línea |
| `MTR_SEVERIDAD_RIESGO` | `:31458` | 1 | Su comentario (`:31456`) justifica un "trinquete" que acabó implementándose sin ella |

### 2.3 Lo que NO se toca

- **25 costuras `*ParaTest`** — deliberadas, para que el banco lea o inyecte estado interno.
- **`mtrRenderResumenClinicoHtml`** (`:35964`, 81 líneas) — sin llamador, pero forma cadena
  con la beta de IA (botón `#vgl-ia-redactar` → `mtrIaClickDelegado`). ~94 líneas en total.
  **Requiere que el médico decida antes si esa vía se reconecta.**
- **Cero ajustes muertos**: los 33 campos de `DEFAULTS` (`:7224–7272`) se leen todos.
- **Cero claves de almacenamiento muertas** (68 claves `vgl_*` revisadas).

### 2.4 CSS: 10 clases que el JS aplica y que no existen en la hoja

Mismo patrón del bug real que ya tuvieron con `.vgl-flag.agpend` / `.adic`:

`vgl-au-prio` · `vgl-meta-input` · `vgl-agm-plan-linea` · `vgl-rcv-examenes` ·
`vgl-rcv-orden` · `vgl-dock-btn-disabled` · `vgl-agm-pbtn-sabado-mio` · `vgl-cw-ord-btn` ·
`vgl-ord-printbox` · `vgl-ord-mailbox`

Dos son **modificadores de estado que hoy no pintan nada**: `vgl-dock-btn-disabled` (un
botón deshabilitado que no se ve deshabilitado) y `vgl-agm-pbtn-sabado-mio` —
**renombrado a medias** de `.vgl-agm-pbtn-sabado-suyo`, que sí tiene regla.

Y una clase declarada que nadie genera: `.vgl-ux-seccion-tit`.

### 2.5 Hallazgo colateral: ajustes sin control en la interfaz

Ocho campos de `DEFAULTS` se leen en el código pero **no aparecen nunca como cadena literal
en `renderSettings`** — el médico no puede alternarlos desde Ajustes: `abandonoPES`,
`parpadeo`, `preconsulta`, `refresco`, `insistir`, `cartel`, `medicoNombre`, `medicoId`.
No es código muerto; es interfaz incompleta.

---

## 3 · Rendimiento

### 3.1 Inventario de temporizadores

**≈12 concurrentes en reposo.** El corazón es el `tick()`, cada **5 s** (`CONFIG.POLL_MS`,
`:7714`; configurable por el médico entre 2 y 120 s vía `S.refresco`, `:7649`), montado
sobre un **Web Worker que Chrome no estrangula con la pestaña oculta** — por diseño
(`:7906–7975`).

Permanentes: URL watcher 5 s (`:1122`) · latido + `tickApi` 5 s (`:12616`) · watchdog del
worker 30 s (`:7948`) · `paintMute` 15 s (`:27554`) · `pymReminderCheck` 60 s (`:27555`) ·
captador PyM 60 s (`:27636`) · `checkVersionMinimum` 300 s (`:27553`) · `mtrSondaPestanias`,
`repFlush` y PyM diario 600 s (`:27544`, `:27573`, `:27617`) · `uxFlush` 30 min (`:27578`).

### 3.2 Los tres peores cuellos de botella

#### ① La cosecha del DOM, cada 5 s — `_vglCosecharDePantalla` (`:4743`)

Con la historia abierta, en cada vuelta:

- Un `querySelectorAll` de **documento completo** (`:38077`) y, **por cada grupo de
  radios**, `mtrLeerRadioSiNo` (`:31993`) hace **hasta 2 barridos completos más**. Una
  pestaña de Antecedentes/Hábitos tiene decenas de grupos → **N+1 con N≈30-40**.
- `_vglCosecharFactoresVisibles` (`:4816`) repite el patrón sobre los **29 campos** de
  `MTR_CAMPOS_FACTORES` (`:31958`) → hasta 58 barridos más.
- Persistencia **síncrona**: `JSON.parse` + `Object.assign` + poda + `stringify` +
  `setItem` (`:4658–4678`) sobre un almacén de **hasta 80 pacientes** (`:4643`). Contados
  en el flujo: **≈8-9 `parse` y 3-4 `stringify`+`setItem` del almacén completo, cada 5 s**.

**Y se encarece a lo largo de la jornada**, porque el almacén se va llenando.

*Síntoma esperado:* micro-congelaciones cada 5 s mientras el médico escribe en la historia
— teclas que se pierden, cursor a saltos.

#### ② Los tres widgets de Conducta — 3 reflows forzados por tick (`:26409–26411`)

- `mtrAnclaOrdenarPendientes` (`:5519`) hace `querySelectorAll("button")` de **todo el
  documento** y luego, por botón, `_vglVisibleDeVerdad` (`:5460`), que lee `offsetParent`
  **y** `getBoundingClientRect`. Se invoca **dos veces por tick**; `mtrBotonFarmacoConducta`
  (`:5839`) añade una tercera pasada.
- **Layout thrashing real:** `mtrWidgetConductaTick` escribe `style.position/left/top`
  (`:5661–5664`) → invalida el layout; acto seguido `mtrWidgetOrdenarConductaTick` vuelve a
  leer geometría → **reflow sincrónico forzado**; y `mtrWidgetFarmacoTick` lo repite
  (`:5927`). **3 recálculos completos de layout por tick, 36 por minuto.**
- La "firma barata" que evita repintar (`:5668`, `:5935`) se calcula **después** de correr
  `mtrTableroClinico` (`:28074`) y `mtrAvisosFarmacologicos` + `mtrDuplicidadesTerapeuticas`
  (`:5852–5890`). **El motor clínico entero y su HTML se recalculan cada 5 s aunque nada
  haya cambiado**; la firma solo ahorra el `innerHTML`.

*Síntoma esperado:* en la pestaña Conducta —justo donde se ordenan exámenes— scroll
pegajoso y clics lentos en los botones nativos de Everest.

#### ③ El mismo barrido se paga tres veces — `mtrLeerRadioSiNo` (`:31993`)

`_tableroFirmaDom` (`:20556`, cada **20 s** desde `:20511`) existe *para evitar*
recalcular, pero para calcular la firma hace `mtrLeerFactoresRcvDelDom` +
`mtrLeerTensionDelDom` + `mtrLeerPesoDelDom` + `mtrLeerCinturaDelDom` ≈ **60-70
`querySelectorAll` de documento completo**, más otro `JSON.parse` del almacén. **La
optimización cuesta casi lo que evita.**

### 3.3 Corrección a un hallazgo del análisis automático

El análisis afirmó que la cosecha se llama **dos veces por tick** (`:26418` y `:26438`).
**Es falso, verificado a mano:** están en ramas **excluyentes** (`secc === "historia"` vs.
`secc !== "historia" && _enModuloHCHealth()`). Solo corre una. El problema es el coste de
**una** pasada, no una duplicación. Se deja escrito para que nadie planee un arreglo sobre
un defecto inexistente.

### 3.4 Hallazgos menores

1. `extractPacienteAbierto()` (`:10613`) recorre `.text-muted` con `closest()` por nodo y se
   llama **≥6 veces por tick**, sin memoización.
2. Prefetch por hover (`:24503`): el debounce de 300 ms está bien, pero recorrer 40 tarjetas
   puede costar **≈200 peticiones**; lo mitiga la caché por cédula (`:16600`), no un límite de tasa.
3. `GHOST.promises` del hover se limpia con `setTimeout` de **5 min** por cédula (`:24548`)
   → hasta 40 temporizadores pendientes tras barrer la agenda.
4. `_pageFetchJsonCore` (`:16408`): un GET fallido cuesta **hasta 8 envíos** (4 intentos ×
   fetch + GM) con backoff 300→600→1200 ms; sin cortacircuitos para lo no-especulativo.
5. Los 5 envoltorios de red duplicados (ver §1) multiplican las políticas de timeout.

### 3.5 Lo que está bien y no se toca

- La **cesión de hilo** por `MessageChannel` (`:7191–7212`) **sí se usa** en Excel/PyM
  (`:8577`, `:10057`, `:10097`) y el parseo XLSX tiene su propio Web Worker (`:8629`). Ese
  frente está resuelto. *Pero no se usa en ninguna ruta del `tick()`.*
- El **único `MutationObserver`** (`:11259`) es `{childList:true}` **sin `subtree`** —
  barato y correcto. El observador global que se erradicó en v12.3.14 no ha vuelto.
- `_preconTick` (`:4484`) está bien acotado (1 paciente / 15 s, con guarda de vuelo) y
  `render()` (`:26080`) usa firma + `DocumentFragment`.
- `injectLabsIntoCronicos` (`:3215`) intercala lecturas y escrituras, pero son ~13
  iteraciones y solo por clic: coste real bajo.

---

## 4 · El medidor que ya existe y está apagado

`_iniciarRumObserver` (`:9478`) usa **LoAF** (Long Animation Frames) y ya sabe atribuir si
una tarea larga fue **nuestra o de Everest** (`_rumEsNuestro` `:9455`, `_rumNodoEsNuestro`
`:9463`). Es un instrumento bueno, y tiene dos problemas:

1. **Viene apagado de fábrica** (`uxTelemetria: false`, `:7255`).
2. **Solo cuenta baldes** (`rum.self.task.gt300ms` vía `uxTrack`) — pierde el contexto, así
   que aunque estuviera encendido **no podría responder "¿cuándo pasó?"**.

El médico reporta lentitud real pero **no sabe cuándo se dispara**. Por eso el primer paso
del trabajo no es optimizar: es **encender el medidor y darle memoria de contexto**, para
que la próxima congelación quede grabada con nombre y apellido. Medir antes de arreglar es
además la regla del proyecto — la misma que en la v17.15.0 convirtió "la consola está llena
de errores" en "un hover costaba 16 peticiones y 8 líneas; después, 4 y 0".

---

## 5 · Qué se hará, y qué no

**Sí, por orden:** ① encender y extender el medidor · ② arreglar la cosecha · ③ los tres
widgets en un solo reflow · ④ retirar las ~61 líneas muertas y regenerar el inventario con
`tools/inventario.js`.

**No, y por qué:**
- **Unificar los cinco envoltorios de red** y los tres generadores de chips: es la deuda
  estructural más real del archivo, pero tocar la capa de red de un script que escribe
  historias clínicas no es "limpieza segura".
- **La cadena de la beta de IA** (~94 líneas): la decide el médico.
- **Partir el archivo en módulos**: incompatible con un userscript de un solo archivo sin build.
