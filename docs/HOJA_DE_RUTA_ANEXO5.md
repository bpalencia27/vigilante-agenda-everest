# Hoja de ruta del Anexo 5 en el código del Vigilante

> Documento de definición estratégica. Lo abre el **comité multidisciplinario** convocado
> para el encargo del 10-sep-2026 (punto 3): *«definición estratégica por equipo
> multidisciplinario… hoja de ruta del Anexo 5 dentro del código fuente del script, con
> especificaciones de lógica de visualización y ubicación definitiva de migración en la
> arquitectura»*.
>
> **Regla del proyecto:** casilla vacía antes que dato inventado. Todo lo que sigue está
> separado en dos bloques: **HECHO** (verificado contra el código el 10-sep-2026, con su
> línea) y **A DECIDIR** (lo que el comité tiene que resolver; aquí NO hay respuestas
> inventadas).

---

## 1. Qué es el Anexo 5 y de dónde sale el dato (HECHO)

El Anexo 5 es el estado del programa de riesgo cardiovascular de un paciente dentro del
libro de prevención (`.xlsx`) que el Vigilante ya lee para PyM. El índice del anexo se
parsea aparte y se instala en `state.pymAnexo5` (un `Map` por cédula) en el mismo punto
donde se instalan `state.pym` y `state.pymAbandono`:

- `state.pymAnexo5 = idx.anexo5 || new Map();` — [vigilante_agenda.user.js:12991](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L12991).
  La carga es manual/automática desde el mismo libro; **sin libro cargado el mapa está
  vacío y el anexo no existe para nadie** (nunca se inventa una entrada).

Las constantes del programa viven en un solo sitio:

| Constante | Valor | Origen declarado en el código |
|---|---|---|
| `A5_MIN_SUMA` | 75 | «mínimo del programa (afirmación del propietario)» — [L15684](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L15684) |
| `A5_DIAS_ABANDONO` | 183 | «más de 6 meses sin control» — regla del libro — [L15685](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L15685) |
| `A5_METAS_LAB` | 6 metas (glicemia, LDL, HDL, triglicéridos, RAC, HbA1c) | [L15686](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L15686) |

## 2. Criterios de aplicación (HECHO)

`a5AlertasDe(docId, estado, hoySerial)` — [L15690](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L15690) — es **la vara única** y es PURA.
Devuelve `null` (el anexo no aplica) cuando:

- no hay cédula normalizable, o
- el paciente no figura en `state.pymAnexo5`.

Cuando el paciente SÍ figura, devuelve:

- `abandono` — si `hoy − último control > 183` días **o** si está en `state.pymAbandono`
  (la hoja regional de abandonados de la base de citas);
- `pendientes` — el EKG sin fecha + cada meta de laboratorio con **puntos y fecha en cero**;
- `remitir` — las consultas marcadas REMITIR (PLANI?, nutrición, psicología, odontología);
- `suma` / `cumpleSuma` — puntaje total contra `A5_MIN_SUMA`;
- `contexto` — TA, circunferencia, HbA1c, LDL, glicemia, TFG, estadio, RAC y fecha del RAC.

> **Nota de honestidad del dato:** `rac` es el **valor real** de la columna (mg/g), no los
> puntos de la meta. Un 0 significa «sin valor indexado» y el tramo no se pinta: rotular los
> puntos como si fueran mg/g fue un defecto ya corregido (v18.11.0).

## 3. Lógica de visualización vigente (HECHO)

El anexo tiene **dos hogares** (v18.14.3: eran tres hasta que el comité retiró el panel de la
historia — ver §4.1), y los dos dicen lo mismo porque las filas salen de un **constructor
único**: `a5FilasHtml(datos)` — [L15741](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L15741).

| Hogar | Cuándo aparece | Dónde vive | Cómo se cierra |
|---|---|---|---|
| Sección del aviso de la jornada | Al abrir la historia, con el resto de los pendientes | `#vgl-pym-modal`, sección «Anexo 5 · …» con **una línea resumen** (`a5ResumenLinea`) | «Entendido» del aviso; una vez por jornada y paciente |
| **Repositorio secundario** | Solo si el médico lo pide | `#vgl-a5-modal`, modal diferenciado (`abrirAnexo5Modal`, [L15798](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L15798)) + pastilla «📋 Anexo 5» del dock ([L8921](file:///e:/CENTINELA/vigilante-agenda-everest-restaurado/vigilante_agenda.user.js#L8921)) | botón «Cerrar» / clic fuera; **no** consume el «ya visto» de la jornada |
| ~~Panel dentro de la HC~~ | **RETIRADO en v18.14.3** (opción B del comité) | vivía en `#vgl-a5-panel`, colgado de `#vgl-root` | — |

Reglas que la visualización **no puede** romper (están probadas):

- Cero escritura: es informativo. El anexo nunca ordena, agenda ni confirma nada.
- Cero PHI en pantalla y en el `aria-live`: la cédula va enmascarada (`_vglHcMascara`).
- Interruptor propio `tog_anexo5`, hijo de `tog_notif`: apagado, no existe en ninguno de los
  tres hogares.
- Casilla vacía antes que dato inventado: sin índice, sin meta o sin valor indexado, el
  tramo no se pinta.

## 4. RESUELTO por el comité el 10-sep-2026

> Acta completa en `docs/REGISTRO_DECISIONES.md` (5 filas del 2026-09-10). Cada punto
> conserva abajo las opciones que estuvieron sobre la mesa, para que la decisión se pueda
> auditar contra lo que se evaluó. **Nada de esta sección quedó abierto**: los cinco puntos
> tienen respuesta del comité y están ejecutados en la v18.14.3, salvo el nivel del
> presupuesto (4.4), que el comité pidió **explicar y dejar como está**.

### 4.1 ¿Cuál es la ubicación definitiva del anexo?

| Opción | Qué implica | Evidencia que falta |
|---|---|---|
| A. Dejarlo en los tres hogares actuales (panel HC + sección del aviso + repositorio) | Nada que migrar; el riesgo es la triple superficie de mantenimiento | Medir si el panel de la HC y la sección del aviso se perciben como duplicado en consulta |
| B. Retirar el panel de la HC y quedarse con la sección del aviso + el repositorio | Un solo punto de entrada automático | Confirmar que el aviso de entrada no se pierde cuando el médico entra por un flujo distinto al de la historia |
| C. Moverlo a un módulo propio del dock (hermano de «Pendientes») | Requiere justificar por qué el anexo no es «un pendiente más» | Decisión clínica: ¿el anexo se consulta en el mismo momento que los pendientes o en otro? |

**Criterio de decisión propuesto:** si el anexo se consulta junto con los pendientes (mismo
momento de la consulta), gana B; si se consulta como informe aparte (p. ej. al preparar la
remisión), gana C. **Esa es una decisión clínica, no técnica.**

> **RESUELTO (10-sep-2026): OPCIÓN B — ejecutada en la v18.14.3.** Se retiró el panel del
> anexo dentro de la historia clínica (`hcAnexo5Render`, `#vgl-a5-panel`, `_vglA5Cerrados`,
> `_vglA5Anunciado`, su barra de Deshacer y su aria-live). El anexo queda con **un punto de
> entrada automático** (la sección del aviso de la jornada, que ya reúne prevención, abandono
> y laboratorios) y **un repositorio a un clic** («📋 Anexo 5» → `#vgl-a5-modal`). La
> retirada no se llevó el dato: `a5AlertasDe` y el constructor único `a5FilasHtml` siguen
> intactos y son los que alimentan los dos hogares que quedan.

### 4.2 ¿La sección del aviso debe llevar el detalle completo?

Hoy el aviso lleva las filas completas y remite al repositorio. La alternativa es un
**resumen de una línea** («Anexo 5 · puntaje 60/75 · 7 estudios pendientes») y dejar todo el
detalle al repositorio. Se decide con el criterio de **anti-fatiga**: el aviso de entrada es
una interrupción; el repositorio es una consulta deliberada.

> **RESUELTO (10-sep-2026): APROBADA la alternativa — ejecutada en la v18.14.3.** Función
> pura nueva `a5ResumenLinea(datos)`: «abandono del programa · puntaje de metas 58/75 — por
> debajo del mínimo · 3 estudios pendientes de ordenar · 2 consultas por remitir», con
> singular/plural correctos y texto ya escapado. El aviso central **deja de pintar las filas**
> del anexo y remite a la pastilla 📋; el detalle completo sigue en `#vgl-a5-modal`, con el
> MISMO constructor único `a5FilasHtml`.

### 4.3 ¿`A5_MIN_SUMA = 75` y `A5_DIAS_ABANDONO = 183` son la regla oficial?

En el código están declarados como **afirmación del propietario** y **regla del libro**,
respectivamente. Si el comité tiene el documento oficial, debe citarse aquí con su fuente y
fecha; si no, siguen como están y **no se cambian de memoria**.

> **RESUELTO (10-sep-2026): SÍ — aprobación marcada como «sí» por el comité.** Los dos
> valores quedan **CONFIRMADOS** como la regla vigente y **no se tocan**: 75 es el mínimo de
> puntaje de metas del programa y 183 días («más de 6 meses sin control») el umbral de
> abandono. Fuente de la confirmación: el acta del comité del 10-sep-2026
> (`docs/REGISTRO_DECISIONES.md`). No se cambió ni una línea de código: la aprobación
> confirma lo que el código ya hacía.

### 4.4 ¿El anexo entra en el presupuesto de interrupciones?

Hoy la sección del anexo **no** está exenta del presupuesto (solo abandono RCV y
`prioridadRcv` son R=3). Decidir si el hallazgo del anexo merece nivel 3 (exento) o nivel 2
(sujeto al tope). Es una decisión de **seguridad clínica**, y el axioma del proyecto reserva
el nivel 3 a los hallazgos que no pueden callarse.

> **RESUELTO (10-sep-2026): se EXPLICA y queda SIN CAMBIO (nivel 2, sujeto al tope).** El
> comité pidió entender el mecanismo antes de decidir y, en una **segunda vuelta, APROBÓ
> formalmente la propuesta**: el anexo sigue sujeto al tope diario y **no se exime**. La
> aprobación quedó registrada como fila nueva en `docs/REGISTRO_DECISIONES.md` (la regla del
> acta es que las filas no se editan: una corrección es una fila nueva) y **candada por
> prueba**: `tests/suite_102_widget_rcv.js` caso «presupuesto (decisión 4.4, aprobada)…»,
> con su mutación verificada (añadir `anexo5` a `exentoR3` → rojo). Cómo funciona, paso a
> paso:
>
> 1. `checkAvisoUniversal()` decide **cuándo** (gracia mientras Athenea responde, «ya se
>    avisó hoy», aviso parcial). El **qué** lo calcula `_pendientesUniversales`.
> 2. `avisoUniversal()` aplica la compuerta: `const exentoR3 = !!(abandono || prioridadRcv)`.
>    El anexo **no** está ahí, así que cae en la rama sujeta al tope.
> 3. Con `esPrueba` (el banco) o con un caso exento, el presupuesto no se consulta siquiera.
> 4. En la rama normal: `obsPresupuestoConsumir()`. Si **no** permite, se registra
>    `aviso.presupuesto.agotado`, se registra `aviso.universal.suprimido` con el desglose por
>    sección y la función **devuelve `false`** — el aviso no se pinta y no se marca visto.
> 5. El tope es `S.obsPresupuestoAvisos`: número ≥ 0; **0 = sin tope**; ausente o inválido =
>    **6 por equipo y día**. `obsPresupuestoEstado()` guarda `{dia, usados}` y **se reinicia
>    solo al cambiar el día** (`st.dia !== todayStamp()`), así que el tope es diario, no por
>    sesión.
> 6. `obsPresupuestoReembolsar()` devuelve el cupo cuando el aviso que lo consumió **no llegó
>    a pintarse** (fallo de render, carrera perdida entre pestañas). Nunca baja de 0.
> 7. Si el almacén falla, `obsPresupuestoConsumir()` devuelve `true` (**fall-open**): un
>    problema de guardado no puede tapar un aviso clínico.
>
> **Por qué queda en nivel 2:** el detalle del anexo está siempre a un clic en el repositorio
> 📋, así que el tope no lo esconde — solo evita que interrumpa. Subirlo a R=3 consumiría el
> nivel reservado a lo que **no puede callarse** (abandono del programa y prioridad
> cardiovascular). **Aprobado así por el comité el 10-sep-2026** (fila nueva en el acta). Si
> algún día se decide eximirlo, es una fila nueva más en el acta y un cambio de una línea en
> `exentoR3`.

### 4.5 ¿Qué pasa cuando el libro cambia a mitad de jornada?

Hoy el índice se instala al cargar el libro. Decidir si el anexo debe re-evaluarse en vivo
con cada recarga del libro o quedarse con el índice de la jornada.

> **RESUELTO (10-sep-2026): VENTANA FIJA — 06:00 y 12:00 de Bogotá (UTC-5), exclusivamente.**
> Ya era el comportamiento; esta entrega lo **canda con pruebas** y lo documenta.
>
> - El índice del anexo **no tiene descarga propia**: es la hoja `ANEXO` del MISMO libro de
>   prevención (`CONFIG.SP.base.sheetAnexo5`), y ese libro se refresca solo en dos ventanas
>   (`CONFIG.SP.base.horasRefresco = [6, 12]`).
> - El reloj es **UTC-5 fijo, sin DST**: `bogotaAhora()` lo calcula desde UTC y no desde el
>   huso del equipo, así que un portátil en otra zona no adelanta ni salta la ventana.
> - `baseVentanaRefresco()` devuelve `{sello, toca}`: `toca=false` antes de las 06:00, y el
>   sello (`dia|0` o `dia|1`) garantiza **una sola revisión por ventana y por día**.
> - `pilotoFreshCheck()` (el único camino automático) pregunta primero el `TimeLastModified`
>   (≈1 KB) y **solo baja el libro si cambió**.
> - Ninguna otra ruta automática instala `state.pymAnexo5`: sus **tres** asignaciones viven
>   en la carga del libro (caché, descarga y adopción).
> - La **carga manual** del libro desde Ajustes se conserva: es una acción explícita del
>   médico y el script no se la niega.
>
> Candado en `tests/suite_102_widget_rcv.js`: bordes exactos 05:59 / 06:00 / 11:59 / 12:00 /
> 23:59 / 00:30 con reloj congelado en hora Bogotá, más el invariante de fuente de las tres
> asignaciones.

## 5. Hoja de ruta propuesta (fases)

| Fase | Contenido | Entregable | Estado |
|---|---|---|---|
| 0 | Cablear el anexo en la vara única y publicarlo en el aviso central + repositorio secundario | v18.14.2 | **HECHO** |
| 1 | Comité multidisciplinario resuelve 4.1–4.5 y deja constancia en `docs/REGISTRO_DECISIONES.md` | Acta (5 filas del 2026-09-10) | **HECHO** |
| 2 | Migración a la ubicación definitiva elegida en 4.1 (retirar los hogares que sobren) | v18.14.3: panel de la HC retirado (opción B) | **HECHO** |
| 3 | Ajuste de la lógica de visualización según 4.2 (línea resumen) y 4.5 (ventana 06:00/12:00) | v18.14.3: `a5ResumenLinea` + candado de la ventana | **HECHO** |

**Regla de secuencia (cumplida):** la fase 2 no se abrió hasta que existió el acta de la fase
1. Migrar sin la decisión escrita habría repetido el defecto que este documento quiere
evitar: mover código por preferencia técnica y no por acuerdo clínico.

**Nada queda abierto.** El **nivel del presupuesto de interrupciones del anexo** (§4.4) fue
el último punto: el comité pidió la explicación y después **aprobó formalmente** que el anexo
siga en nivel 2 (sujeto al tope diario), con la aprobación registrada como fila nueva en
`docs/REGISTRO_DECISIONES.md` y candada por la prueba «presupuesto (decisión 4.4, aprobada)…»
de `tests/suite_102_widget_rcv.js`. Si algún día se decide eximirlo, es una fila nueva en el
acta y un cambio de una línea en `exentoR3` de `avisoUniversal`.

## 6. Trazabilidad

- Vara única y criterios: `a5AlertasDe` (L15694), constantes L15688–L15690.
- Constructor único de filas: `a5FilasHtml` (L15741).
- Línea resumen del aviso (decisión 4.2): `a5ResumenLinea` (L15780).
- **Los DOS hogares** (decisión 4.1, opción B): la sección del aviso de la jornada (L17199)
  y `abrirAnexo5Modal` (L15798) + la pastilla del dock «📋 Anexo 5» (L8921).
- Ventana exclusiva de refresco (decisión 4.5): `bogotaAhora` (L14782) y
  `baseVentanaRefresco` (L14791), con `CONFIG.SP.base.horasRefresco = [6, 12]`.
- Interruptor: `tog_anexo5`, hijo de `tog_notif` (L10123).
- Pruebas que protegen lo anterior: `tests/suite_102_widget_rcv.js` (criterios de aplicación,
  línea resumen del aviso, repositorio, pastilla y ventana 06:00/12:00),
  `tests/suite_88_rcv_pendientes.js` (sección de próximos exámenes dentro del módulo
  «Pendientes»), `tests/suite_91_hc_launch.js` (filas del anexo, RAC real en mg/g y la
  retirada del panel) y `tests/suite_93_toggles_f3.js` (la compuerta del interruptor).
- Mutaciones verificadas: `tests/INFORME_MUTACIONES.md`, secciones «v18.14.2» y «v18.14.3».
