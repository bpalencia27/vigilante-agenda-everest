# Informe de mutaciones verificadas

> Cada fila es una prueba que se **rompió a propósito** y se comprobó que una prueba
> concreta se pone roja, se restauró, y se confirmó que el banco vuelve a verde.
> La disciplina está en `CLAUDE.md`: *todo cambio de comportamiento requiere mutación
> verificada*. Una prueba que no cae cuando el código se rompe no está probando nada — y
> este proyecto ya se llevó nueve sustos con pruebas que reportaban verde sin ejecutar.

## v17.6.1 — 22-ago-2026 (remediación tras la auditoría de producción de v17.6.0)

Banco antes (cierre de v17.6.0): 2.266 comprobaciones · después: **2.272** (6 pruebas
nuevas), cobertura **100 % (846/846)**.

Esta versión no es trabajo nuevo pedido por usted — es la respuesta a una auditoría de
producción con varios agentes independientes (más una verificación adversarial de cada
hallazgo) que se le pidió a este mismo repositorio recién entregado v17.6.0, con la
instrucción de dejarlo listo para producción de verdad. De 16 hallazgos confirmados, uno
era un defecto clínico real (ver CHANGELOG.md) y el resto, en su mayoría, filtraciones de
datos reales hacia el código y las pruebas — el detalle completo, con la magnitud real de
lo encontrado, está en CHANGELOG.md. Aquí solo van las **cinco mutaciones verificadas**
sobre el único cambio de comportamiento clínico de esta versión y sobre las pruebas
nuevas que la auditoría dejó como tarea.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **defecto clínico** | `mtrPanelMetasHtml`: se vuelve a `const h = d && d.hba1c;` (se quita el `d.esDm2 &&`) | `suite_68` | *con HbA1c medida pero SIN diabetes, la fila NO se muestra (v17.6.1)* (esperaba que la fila no apareciera, obtuvo `true`) |
| **narrativa del ítem 2** | `MTR_HECHOS_FACTORES` recupera las cuatro claves viejas (`dislipidemia`, `ecvEstablecida`, `antecedenteFamiliarPrematuro`, `ercPrevia`) | `suite_56` | *las claves viejas retiradas… NUNCA salen, aunque vengan encendidas* (esperaba `undefined`, obtuvo `true` en las cuatro) |
| **meta de HbA1c — bordes** | `openPanelPacienteModal`: la guarda del guardado pasa de `v >= 5 && v <= 12` (inclusive) a `v > 5 && v < 12` (exclusive) | `suite_67` | *los bordes EXACTOS 5 % y 12 % se aceptan…* (5 % y 12 % exactos empiezan a rechazarse) |
| **meta de HbA1c — reapertura** | `openPanelPacienteModal`: el campo del formulario deja de leer `_resumen.hba1c.meta` y siempre arranca en `MTR_HBA1C_META_DM2` | `suite_67` | *para un paciente que YA tiene una meta individual guardada, el editor arranca en ESE valor…* (esperaba `value="9.5"`, obtuvo `false`) |
| **meta de HbA1c — payload** | `openPanelPacienteModal`: el mensaje de error de un valor inválido pasa de un texto fijo a repetir `inp.value` sin escapar | `suite_67` | *un payload con forma de XSS se rechaza… y nunca queda reflejado en el DOM* (esperaba que el mensaje fuera el genérico, obtuvo el payload repetido) |

Las cinco se aplicaron una a una sobre el archivo de producción, se corrió la suite
señalada, se confirmó el rojo con el mensaje esperado, y se restauró antes de seguir con
la siguiente. El banco completo volvió a 2.272/2.272 tras la restauración final.

### Una sexta cosa que se blindó, y que a propósito NO tiene mutación

La misma auditoría señaló que `x.estado` era el único campo de la fila de "Metas
terapéuticas" en `mtrPanelMetasHtml` sin pasar por `escapeHtml(...)`, mientras sus cinco
vecinos (rótulo, meta, actual, extra, editable) sí. Se corrigió por consistencia y
defensa en profundidad — pero, a diferencia de las cinco de arriba, **esta no tiene una
mutación verificada**, y vale explicar por qué en vez de fingir que sí la tiene: `x.estado`
lo fijan dos funciones más arriba en el mismo archivo, siempre a uno de tres literales
fijos ("nd"/"ok"/"falla") — no hay hoy ningún punto de entrada público por el que una
prueba (ni un atacante) pueda hacer que ese campo cargue otra cosa. Revertir el
`escapeHtml` no pone roja ninguna prueba posible, porque `escapeHtml("ok")` y `"ok"` son
el mismo string: no hay nada que mutar de forma honesta. Se deja constancia de esto en
vez de escribir una prueba que solo aparentara probar algo.

## v17.6.0 — 22-ago-2026 (todas las mejoras aprobadas el 22-ago, excepto la sede del laboratorio)

Banco antes (cierre de v17.5.0): 2.253 comprobaciones · después: **2.266** (13 pruebas
nuevas), cobertura **100 % (846/846)** — 1 función nueva (`mtrEducacionFlagsTexto`),
cubierta.

Usted respondió "PROCEDE CON TODAS LAS MEJORAS EXCEPTO LA 4" sobre
`docs/MEJORAS_PENDIENTES_20260822.md`: van los ítems 1, 3, 5 y 6 (el 2 se investigó y
NO se tocó — ver `CHANGELOG.md` — y el 4, la sede del laboratorio, queda fuera por su
instrucción). Doce mutaciones deliberadas en total, cada una restaurada antes de seguir
con la siguiente — el ítem 3 se llevó seis, porque al cablear el campo editable
aparecieron dos eslabones rotos más abajo en la misma cadena (ver `CHANGELOG.md`).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **ítem 1** | `mtrHojaDeHechos`: `educacion` vuelve a leer `Array.isArray(r.educationFlags)` (el defecto original) en vez de `mtrEducacionFlagsTexto(...)` | `suite_56` | *«Educación indicada» ahora sí llega a la hoja…* (esperaba 2 ítems, obtuvo 0) |
| **ítem 1** | `mtrJsonV68DesdeResumen`: `ef` vuelve a construirse con el `Array.isArray` viejo en vez de leer el objeto directo | `suite_57` | *education_flags.dieta/.actividad ahora sí reflejan el programa…* (dieta encendida en el resumen, obtuvo `false`) |
| **ítem 5** | `MTR_COSECHA_MARGEN_PROP` vuelve a 0.25 (el corte viejo) | `suite_46` | *el corte de cosecha en 33% adelanta un examen que con el corte viejo (25%) se habría diferido* (27,8 % de margen, obtuvo `false`) |
| **ítem 6** | `MTR_MEDS_TTL_MS` vuelve a `5 * 60 * 1000` | `suite_39` | *el TTL de medicamentos subió de 5 a 10 min: a los 7 min…* (obtuvo `false`) |
| **ítem 6** | `MTR_CACHE_TTL_MS` vuelve a `20 * 60000` | `suite_50` y `suite_57` | *el TTL del resumen bajó de 20 a 10 min…* (esperaba `null`, obtuvo el resumen cacheado) y *caché del resumen: edad en minutos…* (esperaba `null` a los 10 min y 1 s, obtuvo `10`) |
| **ítem 6** | `TABLA_OFICIAL_TTL_MS` vuelve a `1800000` | `suite_31` | *el TTL de la tabla oficial bajó de 30 a 10 min…* (esperaba `null`, obtuvo la tabla) |
| **ítem 3** | `mtrResumenDesdeModalLabs`: se quita `hba1c: val("HBA1C")` del ctx (primer eslabón que faltaba — nunca mandaba el valor crudo) | `suite_47` | 2 pruebas: *el adaptador ahora SÍ manda el valor real de HbA1c…* y *sin meta individual guardada, el Panel muestra la meta general…* |
| **ítem 3** | `mtrResumenClinico`: se quita la línea `resumen.hba1c = (c.hba1c != null) ? {...} : null` (segundo eslabón — el ctx ya llegaba bien, pero nunca se copiaba a un campo propio del resumen) | `suite_47` | las mismas 2 pruebas de arriba, mismo síntoma por una causa distinta |
| **ítem 3** | `mtrPanelMetasHtml`: se quita `editable: "hba1c"` del objeto de la fila | `suite_68` | *la fila de HbA1c trae el botón para fijar una meta individual…* (esperaba el id fijo de la fila, obtuvo `false`) |
| **ítem 3** | `openPanelPacienteModal`: el rango válido del campo se amplía de 5-12 a 5-25 (la guarda deja de rechazar el caso de prueba) | `suite_67` | *fijar la meta individual de HbA1c…* (esperaba el mensaje de error para 20 %, obtuvo `false`) |
| **ítem 3** | `openPanelPacienteModal`: se quita la llamada a `_vglCosechaGuardar(...)` en el clic de Guardar | `suite_67` | la misma prueba — sin el guardado, la lectura posterior de la cosecha lanza (`Cannot read properties of null`) |
| **ítem 3** | `mtrRecalcularConFactores`: se quitan los campos `hba1c`/`metaHba1c` del ctx (tercer eslabón — la reclasificación EN VIVO, la que corre CADA VEZ que se abre el Panel con caché tibia o cada 20 s, reconstruía el resumen sin ellos) | `suite_67` | la misma prueba — el botón de editar ya ni aparece al abrir (*con HbA1c medida y diabetes, el Panel muestra el botón…*, obtuvo `false`) |

Las doce mutaciones se aplicaron una a una sobre el archivo de producción, se corrió la
suite señalada, se confirmó el rojo con el mensaje esperado, y se restauró antes de
seguir con la siguiente. Ninguna quedó sin cazar. El banco completo volvió a
2.266/2.266 tras la restauración final.

### Los tres eslabones del ítem 3, y por qué son tres mutaciones distintas y no una

La meta de HbA1c individual (el campo editable en el Panel) es lo único que el médico
pidió, pero verificar el dato al que esa meta se compara —el valor REAL de HbA1c—
destapó que la fila entera de "Metas terapéuticas" para HbA1c llevaba **apagada desde
que se escribió (v17.0.0)**, por tres motivos independientes y sucesivos en la misma
cadena de datos:

1. `mtrResumenDesdeModalLabs` (el adaptador que arma el resumen con lo que Athenea ya
   trajo) nunca leía el valor crudo de HbA1c del laboratorio — sí RAC, colesterol y LDL,
   dos líneas más arriba en el mismo objeto.
2. Aunque lo leyera, `mtrResumenClinico` nunca copiaba ese valor a un campo propio del
   resumen (`resumen.hba1c`) — solo viajaba, ya envuelto en `{actual,meta}`, hacia
   ADENTRO de `mtrPlanFallas` (la alerta de "fuera de meta"), nunca hacia afuera, que es
   por donde lo lee `mtrTableroClinico` para la fila del Panel.
3. Aunque los dos anteriores estuvieran bien, `mtrRecalcularConFactores` —la
   reclasificación EN VIVO que corre cada vez que el Panel abre con una caché tibia, y
   cada 20 segundos mientras sigue abierto— reconstruye el resumen sin pasar por los
   dos primeros pasos, y tampoco llevaba `hba1c`/`metaHba1c`: el mismo patrón que la
   auditoría de v17.0.1/v17.0.2 ya había encontrado con `grupoSabado`, `uroHallazgos` y
   `embarazo`, ahora en un campo nuevo.

Los tres se encontraron leyendo el código de punta a punta antes de confiar en una sola
prueba — el segundo y el tercero no aparecen en ningún grep razonable (`resumen.hba1c =`
no calza con "propiedad dentro de un objeto literal que se pasa a otra función", que es
la forma real de la trampa) y solo salieron al abrir el Panel de verdad, con datos de
verdad, en una prueba `casoAsync` completa. Quedan documentados aquí en detalle porque
son exactamente la clase de error que este proyecto más le importa cazar: una señal
clínica que existe en el código pero nunca llega a la pantalla.

## v17.5.0 — 22-ago-2026 (compuerta de completitud del Panel del paciente, y el mismo aviso extendido al agendamiento)

Banco antes (cierre de v17.4.0): 2.242 comprobaciones · después: **2.253** (11 pruebas
nuevas: 8 de la compuerta del dock/funciones puras + disparo automático en
`suite_15_interfaz_avanzada.js`, 3 del aviso en el banner de agendamiento en
`suite_61_v158_ux.js`), cobertura **100 % (845/845)** — 3 funciones nuevas
(`autoCalcularResumenSiNecesario`, `mtrFactoresPendientesNavegables`,
`mtrIrAPestanaPorNombre`), las tres cubiertas.

Orden explícita del médico: el botón «Panel del paciente» debe quedar DESHABILITADO —no
solo con aviso— hasta que el script recopile lo mínimo necesario, con una lista de
faltantes navegable por pestaña; y el mismo aviso, ya no bloqueante, extendido a la
sugerencia de fecha del agendamiento. Cuatro mutaciones deliberadas sobre el núcleo de la
lógica nueva, cada una restaurada antes de seguir con la siguiente:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **v17.5.0** | `mtrFactoresPendientesNavegables`: se invierte la condición de "pendiente" (`v !== null` → `v === null`), de modo que documentado pasa a leerse como faltante y viceversa | `suite_15` | 6 pruebas: las 2 de unidad de la propia función, las 2 de la compuerta del dock («aún cargando» y «un solo atajo»), y 2 más que dependen de una lista de pendientes correcta |
| **v17.5.0** | `createAccionesDockUI`: `_panelBloqueado` se fija en `false` sin condición | `suite_15` | 2 pruebas: «Panel bloqueado mientras el resumen automático no termine» y «Panel bloqueado y con un solo atajo» |
| **v17.5.0** | `_agmAvisarSiFaltaDocumentar` (agendamiento): la condición `_pendAgm.length > 0` se reemplaza por `true`, así que el aviso ⚠️ aparece siempre, incluso con los factores completos | `suite_61` | «con los factores completos, la misma sugerencia NO lleva el aviso de completitud» |
| **v17.5.0** | `autoCalcularResumenSiNecesario`: se elimina la guarda `if (mtrCacheResumenLeer(docId)) return;`, así que un resumen ya cacheado no evita una consulta nueva | `suite_15` | «con un resumen ya fresco en caché, abrir la historia no dispara ninguna consulta nueva» (pasa de 0 a ≥1 consultas contadas) |

Las cuatro mutaciones se aplicaron una a una sobre el archivo de producción (con
`sed` dirigido a la línea exacta, nunca a mano sobre el original), se confirmó cada
prueba en rojo con el fallo esperado, y se restauró el archivo — verificado con `diff`
contra una copia intacta — antes de pasar a la siguiente. Ninguna quedó sin cazar. El
banco completo volvió a 2.253/2.253 tras la restauración final.

No se tocó la lógica de `_pintarBannerSugerida` en sí (las cuatro ramas de la sugerencia
—labs-primero, fecha sugerida, y las dos de "sin sugerencia"— ya tenían cobertura previa
en `suite_15`/`suite_61`; lo nuevo es únicamente el aviso que se les suma).

## v17.3.1 — 22-ago-2026 (el mismo reporte de CSS, una capa más abajo — el médico insistió y tenía razón)

Banco antes (cierre de v17.3.0): 2.242 comprobaciones · después: **2.242** (sin blocks de
prueba nuevos — el fallo lo cazan dos pruebas YA existentes, Regla E y Regla G de
`suite_25_cascada_css.js`, ajustadas a los nuevos totales), cobertura **100 % (842/842)**.

El médico volvió a reportar «el azul de Everest se sigue colando» con el MISMO pantallazo
del modal de confirmación de agendamiento («PROGRAMA AL QUE SE CARGA LA CITA:», el aviso
de RCV/Prevención, «↩ Modificar / Atrás»), horas después de recibir v17.3.0 — el parche que
en teoría ya cubría exactamente esas tres cosas. Antes de asumir que simplemente no había
instalado el archivo nuevo (la consola sí mostraba `userscript v17.2.0 activo`, lo cual era
cierto y explica la mayoría de lo reportado ese día), se volvió a montar el trío completo
en Chromium real contra el `<style>` YA con v17.3.0 puesto, para no dar una respuesta a
ciegas. El rótulo, el kicker, la tarjeta, el paciente, el subtítulo, cerrar, el aviso fijo
y los dos botones — 7 de los 9 campos — SÍ sobrevivían. Pero el `<span>` suelto dentro de
`.vgl-agm-check-lbl` («¿Es cita para actividades del programa RCV / Prevención?») seguía
midiendo `rgb(31, 78, 121)` en los dos temas, CON el parche de v17.3.0 puesto. El reporte
del médico tenía razón en algo que mi propia verificación de ayer no había medido a ese
nivel de detalle: v17.3.0 blindó la ETIQUETA (`.vgl-agm-check-lbl{color:var(--fg)
!important}`), no el texto que vive DENTRO de ella.

**Causa raíz**: es el bug #2 del `CLAUDE.md`, en una variante que el propio documento no
nombra explícitamente. La "armadura tipográfica" general (`:where(selector:not([class]))
{color:inherit}`, v12.3.15, extendida a este trío en v17.0.3) es CORRECTA para pelear
contra nuestras propias reglas viejas (bug #1: especificidad), pero no lleva `!important` —
nunca lo necesitó para el bug #1, porque ahí compite contra OTRA regla nuestra sin
`!important` tampoco. Contra Everest, que sí usa `!important`, una declaración normal
pierde SIEMPRE sin importar la especificidad — y el `<span>` de `.vgl-agm-check-lbl` es
precisamente un elemento sin clase propia que depende de esa armadura. El color heredado
del `<label>` (ya blindado) nunca entra a competir: Everest tiene una regla que apunta al
`<span>` DIRECTAMENTE, y un valor heredado no compite cuando existe una regla que ataca al
elemento en persona.

**Alcance real, mayor de lo reportado**: al confirmar el mecanismo, se revisó cada uso real
de `.vgl-agm-check-lbl` en el archivo (4 sitios: RCV/Prevención, SMS y Toma de Muestras en
Agendar; «Mi estilo» en el modal de Redacción IA). Los cuatro comparten el mismo defecto.
El caso de «Mi estilo» es notable: es el reporte de campo del 20-ago que motivó el parche
de v16.7.0/v17.0.3 — y NUNCA quedó resuelto del todo. Se verificó en Chromium con el
marcado real de `#vgl-ia-modal`: seguía en azul de Everest en los dos temas. Y la tarjeta
de plan unificado de Agendar («🧪 Agendar también la Toma de Muestras») tiene un `<b>`
suelto con el mismo problema, sin haber sido reportado todavía — se corrigió junto con los
`<span>`, no se dejó para el próximo pantallazo.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl span` del trío (agendar/ordenar/labs) | `suite_25` | *Regla E* (74→77, el trío SÍ está en su lista de paneles) **y** *Regla G* (279→278) — doble captura, igual que el `.vgl-agm-btn span` de v17.3.0 |
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl b` del trío | `suite_25` | *Regla E* (74→77) **y** *Regla G* (279→278) — doble captura |
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl span` de los 7 hermanos (ia-modal y compañía) | `suite_25` | *Regla G* únicamente (279→278) — Regla E no ve estos 7 paneles, no están en su lista `paneles` (a propósito: esa lista es de los 7 paneles con censo exhaustivo, no de todos los que exigen `!important`) |
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl b` de los 7 hermanos | `suite_25` | *Regla G* únicamente (279→278) |

Las cuatro mutaciones se aplicaron una a una sobre el archivo de producción, se confirmó
cada prueba en rojo con el mensaje exacto esperado (`salió 278`, y `Salieron 77` cuando
correspondía), y se restauró antes de seguir con la siguiente. Ninguna quedó sin cazar.

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color nueva)

Se repitió el mismo montaje de ayer (hoja `<style>` real extraída de `buildOverlay()`,
estructura real tomada línea por línea de `openAgendamientoModal`, CSS agresivo de Everest
cargado antes) — esta vez con el archivo YA con las 4 reglas nuevas puestas:

- **Las 9 mediciones del trío de agendamiento vuelven a pasar, ahora incluyendo el `<span>`
  que ayer no se había medido por separado**: 9 campos × 2 temas = 18 mediciones, 0 fugas
  (ayer: 8/9 pasaban sin el `<span>` aislado; con él aislado y ANTES de este parche, medía
  `rgb(31, 78, 121)` en los dos temas — la prueba que faltaba).
- **`#vgl-ia-modal` — «Mi estilo» (el caso real que motivó v16.7.0/v17.0.3)**: antes de
  este parche, `rgb(31, 78, 121)` en los dos temas. Después, `rgb(247, 250, 252)` oscuro /
  `rgb(11, 18, 32)` claro — los tokens `--fg` reales, igual que el resto de la etiqueta.
- **El `<b>` suelto de «🧪 Agendar también la Toma de Muestras»** (no reportado, hallado al
  auditar el alcance): antes, mismo azul; después, `rgb(247, 250, 252)` oscuro /
  `rgb(11, 18, 32)` claro.

### Nota para la próxima auditoría de este tipo

La verificación de v17.3.0 midió 9 campos por módulo, pero `.vgl-agm-check-lbl` como
CAMPO (la etiqueta) y `.vgl-agm-check-lbl span` como campo (el texto de adentro) son dos
elementos DISTINTOS con reglas de cascada independientes — medir uno no confirma el otro.
La lección concreta: cuando un contenedor mezcla texto directo y `<span>`/`<b>` anidados,
cada nivel de anidamiento necesita su propia medición, no solo la del contenedor. Se deja
anotado aquí porque es la misma clase de trampa que ya mordió al censo de `!important` en
v15.2.0 y al muestreo de contraste de #114: la verificación pasó, pero no había medido lo
que hacía falta medir.

## v17.3.0 — 22-ago-2026 (cuatro reportes del mismo día: consola, CSS, rotación de Gemini y auditoría de prompt)

Banco antes (cierre de v17.2.0): 2.236 comprobaciones · después: **2.242**, cobertura **100 %
(842/842)** — la única función pública nueva es `mtrEsModeloNoDisponible` (841→842); los otros
tres arreglos no agregan funciones (uno retira una llamada muerta, otro reescribe un prompt ya
existente, el otro es CSS puro).

Los cuatro salieron del mismo reporte de campo del 21-ago (consola real + dos pantallazos + una
lectura directa de un borrador real de Enfermedad Actual):

1. **Choque en consola**: `Uncaught (in promise) ReferenceError: _frenoMarcaOk is not defined`
   en CADA generación exitosa del panel de Redacción IA, en los tres modos. La función nunca
   existió en el archivo — se retiró la llamada muerta.
2. **El azul de Everest se cuela**: en el modal de confirmación de la cita («RESUMEN DE LA CITA
   A ASIGNAR») el rótulo del resumen y el aviso de RCV salían en el azul marino de Everest — el
   trío agendar/ordenar/labs nunca había recibido el barrido de Regla E que sí tuvieron
   Ficha/Tablero/Panel (v16.1.0) e IA/Datos-IA/Riesgo/Confirma+Llenar (v16.7.0).
3. **Rotación de Gemini atascada**: `gemini-2.5-flash` (404, modelo retirado) y
   `gemini-3.7-flash` (400/503 intermitente en consola real) no eran reconocidos como "hay que
   rotar" — el conector se quedaba pegado al mismo modelo caído en vez de probar el siguiente.
4. **Auditoría del propio médico**: un borrador real de Enfermedad Actual traía una cifra de
   función renal y una clasificación de riesgo cardiovascular — datos que, por convención propia
   de su historia clínica, van en Análisis y Plan, no ahí.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`_frenoMarcaOk`** | se reintrodujo la llamada muerta `_frenoMarcaOk();` en el mismo punto donde vivía antes del arreglo (justo tras `habilitarPost(textoFinal)`) | `suite_59` | *v17.3.0 — Generar (éxito): ya NO revienta con '_frenoMarcaOk is not defined'…* — clic real sobre el botón «Generar», con Gemini simulado en 200; antes de restaurar, la prueba capturó textualmente `_frenoMarcaOk is not defined` |
| **Regla E, trío de agendamiento** | se le quitó el `!important` a UNA sola declaración del bloque nuevo (`.vgl-agm-btn span{color:inherit}`, sin tocar el valor) | `suite_25` | *Regla G - escala tipográfica / censo de !important* (275→274) — y de regalo, también cayó *Regla E - color con selector de PANEL fuera de #vgl-root lleva !important* (el censo exacto de cadenas sin !important subió de 74 a 77: la declaración mutada, al perder el !important, pasó a contarse ahí) |
| **Rotación ante modelo no disponible** | `mtrEsModeloNoDisponible` se neutralizó a `return false` siempre | `suite_57` | 4 rojas: *mtrEsModeloNoDisponible reconoce 400/404/500/502/504…*, *el conector ROTA de modelo ante 404…*, *el conector también ROTA ante 400…*, *si TODOS los modelos configurados están 404/400, informa 'no disponible'…* |
| **Auditoría de Enfermedad Actual** | la regla 6 volvió a admitir cifras sin acotar a HOY (se quitó "DE HOY" y la exclusión de labs) y se retiraron las dos líneas nuevas de PROHIBIDO (labs/paraclínicos; clasificación de riesgo/metas terapéuticas) | `suite_57` | *Enfermedad Actual ya NO admite labs/paraclínicos ni clasificación de riesgo — eso vive en Análisis y Plan* |

Las cuatro mutaciones se aplicaron una a una sobre el archivo de producción, corriendo solo la
suite correspondiente, restaurando entre cada una. **Ninguna quedó sin cazar** — la del trío de
agendamiento, de hecho, cazó por partida doble (Regla E Y Regla G) sin proponérselo.

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color nueva)

El trío de agendamiento es la única regla de color nueva de v17.3.0 (los otros tres arreglos no
tocan CSS). Se montó la hoja `<style>` REAL extraída de `buildOverlay()` (vía el propio arnés de
pruebas — con las constantes ya interpoladas, no una copia recortada a mano) sobre la estructura
real de los tres modales (tags exactos tomados de `openAgendamientoModal`,
`openOrdenamientoModal` y `openLaboratoriosModal`), con el CSS agresivo de Everest que exige el
proyecto (`div,span,p,b,small,label{color:#1f4e79 !important}`) cargado ANTES, en los dos temas:

- **Ningún azul de Everest se coló**: 9 campos (kicker, tarjeta, paciente, subtítulo, cerrar,
  rótulo, dato, checkbox, botón) × 3 módulos × 2 temas = 54 mediciones — ninguna dio
  `rgb(31, 78, 121)`.
- **La identidad de color por módulo sobrevivió**: kicker y rótulo salieron en tres colores
  DISTINTOS (azul/morado/verde) tanto en oscuro (`rgb(124,184,255)` / `rgb(201,162,255)` /
  `rgb(79,240,184)`) como en claro (`rgb(30,64,175)` / `rgb(91,33,182)` / `rgb(6,95,70)`) — la
  razón misma por la que este parche usa tres reglas separadas en vez de una combinada.
- **Hallazgo de regalo**: el rótulo (`.vgl-agm-lbl`) de Ordenar en tema CLARO tenía un defecto
  previo, ajeno por completo al azul de Everest — `#vgl-agendar-modal.light .vgl-agm-lbl,
  #vgl-ordenar-modal.light .vgl-agm-lbl,#vgl-labs-modal.light .vgl-agm-lbl{color:var(--c-azul)}`
  (línea ~12669) empata en especificidad con la regla morada propia de Ordenar
  (`#vgl-ordenar-modal .vgl-agm-lbl`, línea ~13444, que no tiene variante `.light`) y la de
  arriba lleva DOS clases (`.light` cuenta como clase) contra una sola de la de abajo — así que
  en tema claro el rótulo de Ordenar salía azul en vez de morado, sin que Everest tuviera nada
  que ver. Labs no tenía este defecto porque sí cuenta con su propia variante `.light` (línea
  13093). El `!important` de v17.3.0, al no distinguir tema, corrige esto de regalo: no era su
  objetivo, pero es la misma declaración que ya se estaba blindando.

## v17.2.0 — 21-ago-2026 (#114 — la frecuencia real de los medicamentos)

Banco antes (cierre de #151, v17.1.1): 2.216 · después: **2.236**, cobertura **100 %
(841/841)** — las 6 funciones públicas nuevas (`mtrFrecuenciaTexto`,
`mtrMapaFrecuenciasPorCodigo`, `mtrMapaFrecuenciasPorNombre`,
`mtrPedirHistoricoMedicamentos`, `mtrLeerFrecuenciasMedicamento`,
`mtrEnriquecerAvisosConFrecuencia`) explican las 835→841.

`#114` llevaba mucho tiempo bloqueado: `CargarMedicamentosPaciente` (el endpoint que ya
se usaba) nunca trajo frecuencia, en ningún campo. La grabación del 21-ago (GRABADOR
v3.4.0, tras corregir el defecto de `resBody` en null) encontró el dato real en otro
sitio: `HistoricoMedicamentoHCM?PacienteId=…` trae `frecuenciaNumero` +
`frecuenciaUnidad` estructurados por cada renglón histórico. El médico pidió la
frecuencia en las tres superficies (Ficha/Medicamentos, avisos de seguridad renal e
interacciones, y la redacción con IA) y las tres quedaron construidas — con una
excepción deliberada, ver abajo.

**Decisión de alcance, no negociada con silencio**: los avisos de INTERACCIÓN (Triple
Whammy, doble bloqueo SRAA, gemfibrozilo+estatina…) citan un PAR DE CLASES en
`par_farmacos` — «IECA + ARA-II», no «LOSARTAN 50 MG» —, nunca un fármaco literal del
paciente. Colgarles una frecuencia real exigiría ADIVINAR cuál de los dos (o tres)
fármacos del par la disparó, y una frecuencia mal atribuida en una alerta de seguridad
es peor que no mostrar ninguna — es la misma lógica de "casilla vacía antes que dato
inventado" aplicada a un caso donde el dato SÍ existe pero no hay dónde colgarlo sin
inferir. Por eso `mtrEnriquecerAvisosConFrecuencia` solo actúa sobre avisos con
`medicamento_detectado` (el campo que solo traen los avisos de DOSIS renal, que sí citan
un fármaco puntual) y dejó fuera, a propósito, los avisos de interacción. La mutación
que prueba exactamente este límite es la de alcance, en la tabla de abajo.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **#114** | `mtrFrecuenciaTexto` invierte singular/plural (`n===1` pasa a llevar la "s") | `suite_39` | *arma la frase, sin inventar plural que no toca* (4 rojas) |
| **#114** | `mtrMapaFrecuenciasPorCodigo` prefiere el renglón MÁS VIEJO en vez del más reciente | `suite_39` | *del histórico completo, el renglón MÁS RECIENTE por código* (2 rojas) |
| **#114** | `mtrMapaFrecuenciasPorNombre` cruza por `codigo` en vez de por `descripcion` (rompe el puente código→nombre) | `suite_39` y `suite_57` | *cruza el histórico (por código) con la formulación vigente* (2 rojas) y *(#114): la frecuencia real llega hasta el texto que ve la IA* (1 roja) |
| **#114 (alcance clínico)** | `mtrEnriquecerAvisosConFrecuencia` cae a `par_farmacos[0]` cuando falta `medicamento_detectado` — justo la fuga que la decisión de alcance prohíbe | `suite_39` | *(#114, alcance): un aviso de INTERACCIÓN (par de clases, sin fármaco literal) NUNCA se enriquece* |
| **#114** | `mtrPanelMedicamentosHtml` pinta `.vgl-tab-frec` SIEMPRE, aunque `frecuenciaTexto` esté vacío | `suite_67` | *(#114): la frecuencia sale junto al nombre SOLO cuando el histórico la trajo* |
| **#114** | `mtrMedicamentosRcv` busca la frecuencia por el nombre CRUDO (`frec.get(nombre)`) en vez de la clave normalizada (`frec.get(clave)`) — rompe mayúsculas/tildes | `suite_39` | *con el mapa de frecuencias, el texto la incluye; sin él, sale IDÉNTICO a como salía antes de #114* |
| **#114** | `mtrAvisosDosisRenal` deja de llamar a `mtrEnriquecerAvisosConFrecuencia` (la costura se calcula pero no se usa) | `suite_39` | *con medicamentosFrecuencia explícito, el aviso sale con la frecuencia puesta* |
| **#114** | `mtrFichaVivaFilas` deja de pasar `r.medicamentosFrecuencia` a `mtrMedicamentosRcv` (el typo que ninguna prueba anterior cazaba) | `suite_15` | *(#114): la frecuencia real llega hasta la fila del medicamento en la Ficha* |
| **#114** | `mtrHojaDesdeResumen` deja de pasar `medicamentosFrecuencia` a `mtrHojaDeHechos` (rompe la tercera pata: redacción con IA) | `suite_57` | *(#114): la frecuencia real llega hasta el texto que ve la IA* |

Dos de las nueve mutaciones (la del puente código→nombre y la del alcance clínico) se
verificaron sobre DOS suites a la vez a propósito: son los dos puntos donde una prueba
unitaria sola no basta — hace falta la costura completa (unitaria + integración) para
que un typo o un descuido de alcance no se cuele en silencio por un solo nivel.

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color)

`.vgl-tab-frec` (el paréntesis con la frecuencia, junto al nombre del medicamento en
«Lo que está tomando») es la única regla de color nueva de #114. Se montó la hoja `<style>`
REAL extraída de `buildOverlay()` (vía el propio arnés de pruebas, no una copia recortada
a mano — 203.219 caracteres, con las cuatro constantes interpoladas incluidas) sobre la
estructura real `#vgl-panel-modal > .vgl-agm-card > .vgl-tab-lista > .vgl-tab-fila >
.vgl-tab-ex > .vgl-tab-frec`, con el CSS agresivo de Everest que exige el proyecto
(`div,span,p,b,small,label{color:#1f4e79 !important}`) cargado antes, en los dos temas:

- **Ningún azul de Everest se coló**: `.vgl-tab-frec` midió `rgb(154,167,186)` en oscuro
  y `rgb(74,90,110)` en claro — los tokens `--fg3` reales, nunca `#1f4e79`.
- **Jerarquía visual correcta**: `.vgl-tab-frec` sale en `font-weight:400` contra los
  `700` de `.vgl-tab-ex` (el nombre), y con un color distinto — se lee como dato
  secundario, no compite con el nombre del fármaco.
- **Contraste, contra el PÍXEL RENDERIZADO** (no el valor declarado — `.vgl-tab-fila`
  usa `background:var(--bg2)`, translúcido, compuesto sobre `.vgl-agm-card`; se
  fotografió la página real con Playwright y se muestreó el píxel de fondo con `sharp`,
  igual que la verificación de #123): **6,31–6,43:1 en tema oscuro** y **5,46–5,49:1 en
  claro** — ambos por encima del 4,5:1 que exige la Regla O.
- **Aviso para la próxima verificación de este tipo**: la primera pasada de este mismo
  muestreo dio un falso rojo (2,0–2,96:1 en claro) porque la foto se tomó ANTES de que
  terminara `vglSpringIn` (la animación de entrada de `.vgl-agm-card`, 0,30 s, que arranca
  en `opacity:0`) — el píxel muestreado era la tarjeta a medio aparecer sobre el fondo de
  la página, no el color final. Se corrigió esperando 600 ms antes de fotografiar. Queda
  anotado aquí porque es la misma clase de trampa que ya mordió al censo de `!important`
  en v15.2.0 (medir algo que parece la señal pero es un artefacto de CUÁNDO se mide).

## v17.1.1 — 21-ago-2026 (en caliente, reportado en pleno consultorio)

Banco antes: 2.210 comprobaciones · después: **2.216**, cobertura **100 % (835/835)**.

Reporte con pantallazos: en «Revisión por sistema y Examen físico» salían «Enfermedad
actual» Y «Auto-Labs» (de otras pestañas); al pasar a «Ruta Crónicos» salía «Normalidad
fija» (de Examen físico) y Auto-Labs — el que SÍ correspondía ahí — no salía. Causa:
`_vglPestanaActiva` buscaba `.active[role="tab"]` sin acotar a ninguna barra, y Ruta
Crónicos trae un segundo tabset suelto (los programas Síndrome Metabólico/Hipertensión/
Diabetes/ERC) con su propia `.active`; cuál ganaba dependía del orden del DOM, no de la
pestaña real. Los conteos de respaldo (cuando la barra no se podía leer) tenían el mismo
defecto por otra vía: contaban ids repetidos en varias pestañas sin mirar si Everest los
había dejado montados-pero-tapados.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **#151** | `_vglPestanaActiva` vuelve a buscar `.active[role="tab"]` sin ancla, documento entero | `suite_64` | *#151 no se confunde con un tabset SUELTO que también trae su propia .active* (toma "decoy" en vez de "pes") |
| **#151** | `hayCasillas`/`nRapido` (Auto-Labs y Normalidad) vuelven a contar por id sin mirar visibilidad real | `suite_15` | *createLabInjectorUI (#151): la misma casilla, pero VISIBLE, sí enciende el botón* |

Verificación: cada mutación se aplicó sobre el archivo de producción, se confirmó la
prueba en rojo, y se restauró antes de seguir — ninguna quedó sin cazar.

### De regalo, mientras se investigaba: el hallazgo real de #114

No es una mutación (no hay comportamiento de producción que tocar todavía — ver
`CHANGELOG.md`), pero queda anotado aquí porque salió de la MISMA sesión de grabación:
`HistoricoMedicamentoHCM?PacienteId=…` (GET, confirmado con cuerpo real tras corregir el
GRABADOR a v3.4.0) trae `frecuenciaNumero` + `frecuenciaUnidad` estructurados por cada
renglón de medicamento — el dato que `CargarMedicamentosPaciente` nunca tuvo. Pendiente
de acordar el alcance antes de tocar el motor de medicamentos.

## v17.1.0 — 21-ago-2026

Banco antes: 2.154 comprobaciones · después: **2.210**, cobertura **100 % (833/833)**.
Las 17 mutaciones se aplicaron una a una sobre el archivo de producción, corriendo solo la
suite correspondiente, restaurando entre cada una. **Ninguna quedó sin cazar.**

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **#146** | `bumpStatCita(...)` → `bumpStat(...)`: se vuelve a contar cada transición en vez de cada cita | `suite_04` | *#146: una cita que oscila de estado se cuenta UNA vez — no una por transición* (2 rojas) |
| **#72** | `apptKey` deja de canonizar la hora a minutos y vuelve al texto crudo | `suite_02` | *apptKey: arma la clave de la cita, con la hora canonizada a minutos* (2 rojas) |
| **#112** | `mtrDuplicidadesTerapeuticas` deja de deduplicar antes de contar | `suite_68` | *el mismo renglón repetido NO es duplicidad — son fórmulas postfechadas* (2 rojas) |
| **#113** | La pestaña Medicamentos vuelve a pintar la lista cruda | `suite_68` | *la pestaña Medicamentos y el «(N)» del Resumen cuentan LO MISMO* |
| **#123** | El rojo por SALTO (≥25 %) se apaga | `suite_67` | *#123 rojo por SALTO: empeorar 25 % o más en un solo control es grave* |
| **#123** | El rojo por VALOR (fuera de meta grave) se apaga | `suite_67` | *#123 rojo por VALOR: fuera de meta grave, aunque no se haya movido* (4 rojas) |
| **#137** | El piso de 14 días deja de ceder ante un examen ya vencido | `suite_24` | *mtrPlanLabsPrimero: con un examen YA VENCIDO el piso de 14 días cede (#137)* |
| **#148** | El campo «dónde» vuelve a pasar por el saneador de mensajes (que se come el nº de línea) | `suite_23` | *reportarError: el número de línea SOBREVIVE al saneado* |
| **#148** | El tope vuelve a gastarse por error en vez de por huella | `suite_23` | *reportarError: el MISMO fallo repetido nueve veces manda UNA sola fila* (2 rojas) |
| **#150** | Annar y Citi vuelven a compartir etiqueta de telemetría | `suite_23` | *_rumEndpointLabel: Annar y Citi NO pueden compartir etiqueta* |
| **#116** | Se invierte la condición del conmutador del acordeón de uroanálisis | `suite_48` | *_uroToggleAcordeon: el primer clic ABRE el panel…* (4 rojas) |
| **#149** | Se quita otra vez el punto y coma de `transition:none !important` | `suite_25` | *Regla P - ninguna declaración !important queda pegada a la siguiente* |
| **#115** | Se quita el `!important` del pie `.vgl-rcv-pie` | `suite_25` | *Regla G - escala tipográfica / censo de !important* |
| **#71** | La fecha vuelve a depender de que exista la casilla de resultado | `suite_08` | *injectLabsIntoCronicos (#71): sin casilla de RESULTADO, la FECHA se escribe igual* |
| **#147** | `citaDetalleHoy` deja de devolver el detalle guardado | `suite_62` | *citaDetalleHoy: devuelve el detalle solo si hay radicado guardado* |
| **#73** | El botón de redacción se pinta siempre, haya casilla o no | `suite_64` | *createIaInjectorUI: no pinta ningún botón si la casilla no está en pantalla* |
| **#126** | Se quita la sincronización del relevo del tick (vuelve a depender de que haya agenda) | `suite_17` | *tick (#126): al RECUPERAR el mando se sincroniza aunque este tick no traiga ni una cita* (2 rojas) |

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color)

Las reglas de color nuevas de **#115** y **#123** se midieron con `getComputedStyle` en
Chromium sobre el `<style>` REAL extraído de `buildOverlay()` — no una copia recortada a
mano —, montado con un CSS «Everest» simulado en cuatro niveles de agresividad y en los
dos temas. Resultados:

- **#115**: `.vgl-ord-vigwarn` y los dos `.vgl-rcv-pie` sobreviven al nivel que exige el
  proyecto (`div,span,p,b,small,label{color:#1f4e79 !important}`) y al siguiente. Ya no
  sale `rgb(31,78,121)` en ninguno.
- **#123**: el rojo de la fila grave, su flecha y su motivo salen en `--c-rojo` en los dos
  temas. Contraste WCAG del motivo contra el fondo REAL de la fila (píxel renderizado, no
  el valor declarado): **6,75:1 en tema oscuro** y **6,24:1 en claro** — por encima del
  4,5:1 que exige la Regla O.
- **Regresión**: `.mejora` y `.empeora` idénticas a la v16.8.0 e invariantes. De 64 filas
  generadas, **0** llevan dos clases de color a la vez (la Regla A del banco lo prohíbe).
- **Un defecto propio cazado en esta misma verificación**: el `<b>En rojo</b>` que añadí en
  #123 es un `<b>` SUELTO dentro de `.vgl-rcv-pie`, y el blindaje tipográfico
  `:where(b:not([class])){color:inherit}` no lleva `!important`. Medido: quedaba a **2,21:1**
  en tema oscuro. Es el bug #2 del CLAUDE.md, otra vez. Corregido con una regla propia y
  vuelto a medir: **7,85:1**.

### Nota sobre el censo de `!important`

`suite_25` cuenta los `!important` leyendo el **fuente** entre las líneas del literal de
`buildOverlay`, así que no ve los que aportan las cuatro constantes interpoladas
(`MTR_CSS`, `MTR_RCV_CSS`, `MTR_RCV_CSS_TODOS_LOS_MODALES`, `VGL_UX_CSS`). En la hoja real
son **370**, no 259. El 259 es correcto para lo que la prueba mide, pero **un `!important`
añadido dentro de esas constantes no dispara el contador**. Queda anotado como deuda: el
censo debería correr sobre la hoja generada, no sobre el recorte del fuente.

## v17.6.2 — 22-ago-2026 (desenganches reales + PyM↔Athenea antiduplicado + SMS real)

Banco antes (cierre de v17.6.1): 2.272 comprobaciones · después: **2.297** (25 pruebas
nuevas), cobertura **100 % (849/849)**.

Este es el trabajo pedido en la tanda de hoy: cerrar desenganches donde un módulo no
consumía lo que otro ya produjo (Panel que abría sin laboratorios pese a la pre-carga,
aviso de agendamiento que decía "falta documentar" lo ya documentado, SMS que se cantaba
enviado cuando el proveedor lo rechazaba), el cruce antiduplicado PyM↔Athenea para los
Excel desactualizados (VIH 365 días, SOMF 730 días, Resolución 3280/2018 + decisión del
médico), el CUPS 898015 de citología, el sniffer de UsuarioId en ConfirmarTicket/
FinalizarTicket, la fecha de la HbA1c que quedaba en blanco, y el doble conteo de la
productividad (10→20). Siete mutaciones verificadas, cada una aplicada sobre el archivo
de producción, corrida la suite señalada, confirmado el rojo esperado y restaurada antes
de pasar a la siguiente:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **desenganche Panel** | `mtrCalcularResumenClinico`: la condición de la pre-carga pasa de `!o.fresco &&` a `false &&` (ya nunca sirve `_labsPrefetch`) | `suite_15` | *v17.6.2 — si la pre-carga ya trajo labs frescos de ESTE paciente, los usa SIN volver a golpear Athenea* (esperaba la creatinina de la pre-carga, obtuvo `false`) |
| **aviso agendamiento** | `mtrFactoresConMemoria`: `const mem = (f._leidos…)` se deja en `null` (nunca fusiona el resumen) | `suite_64` | *un factor ya documentado en el resumen cacheado deja de aparecer como faltante* (esperaba `true`, obtuvo `null`) y *el aviso completo del agendamiento queda coherente* (esperaba 0 pendientes, obtuvo 2) |
| **SMS real** | `reenviarSmsRecordatorio` y el envío automático: `if (j && j.error === true)` pasa a `if (false && …)` (el 200 con `error:true` ya no se rechaza) | `suite_62` | *reenviar el mensaje: un 200 con error:true en el cuerpo NO se canta como enviado* (esperaba `false`, obtuvo `true`) |
| **PyM↔Athenea** | `pymPaqueteCubiertoPorAthenea`: `return dias <= pkg.vigenciaDias` pasa a `return false` (nunca da por cubierto) | `suite_08` | *VIH hecho hace 15 días: Athenea manda sobre el Excel desactualizado, no se duplica* (esperaba `true`, obtuvo `false`) y *SOMF hecha hace 2 años exactos: el límite es inclusivo* (esperaba `true`, obtuvo `false`) |
| **sniffer UsuarioId** | `ORIGEN_FIABLE`: `(?:ConfirmarTicket\|FinalizarTicket)` pasa a `(?:ConfirmarTicket\|FinalizarTicketSIN)` (FinalizarTicket ya no es fiable) | `suite_14` | *FinalizarTicket fija el id desde cero* (esperaba `515`, obtuvo `0`) |
| **antiduplicado productividad** | `mtrProdRegistrar`: la fusión `porNombreHora` pasa a `if (nh && false)` (la misma cita con/sin documento ya no se cuelga al mismo hueco) | `suite_68` | *la misma cita vista por API (con doc) y por DOM (sin doc) NO cuenta dos veces* (esperaba 2, obtuvo 4 — el doble conteo 10→20 del reporte) |
| **fecha HbA1c** | `injectLabsIntoCronicos`: se quita el respaldo `\|\| _findLabField(matched.dateId, matched.altDateIds)` de la ruta HBA1C | `suite_08` | *v17.6.2 — HbA1c: con la fecha NO hermana en el .input-group pero SÍ el id-por-convención, la fecha se escribe igual* (esperaba `"2026-08-01"`, obtuvo `""`) |

Todas restauradas; el banco completo volvió a 2.297/2.297 tras la restauración final.
La corrección del banner de "Labs primero" (nota que ahora explica el piso relajado) se
verificó con el motor real (hoy sábado 22-ago → toma lunes 24 → control lunes 31) y no
tiene mutación propia: el texto exacto no está anclado por ninguna prueba existente y la
nueva rama se cubre con la misma prueba de `pisoRelajado` de `suite_24`/`suite_62`.

## v17.6.3 — 22-ago-2026 (la IA dejó de inventar la presión arterial en «Enfermedad actual»)

Banco antes (cierre de v17.6.2): 2.297 comprobaciones · después: **2.298** (1 prueba
nueva), cobertura **100 % (849/849)**.

Reporte del médico en consultorio: la Enfermedad Actual venía con una PA inventada
(p. ej. «PA 110/70»). Raíz: las reglas 5 y 6 de `MTR_EA_SYS` (el system prompt del modo
`enfermedad_actual`) pedían la presión arterial como contenido OBLIGATORIO
incondicional; cuando la TA no está documentada o no se leyó del DOM (`#taSistolicaAcostado`
/ `#taDiastolicaAcostado` vacíos), la hoja de hechos queda sin PA (`mtrHojaDeHechosTexto`
omite la línea) pero el modelo «rellenaba» el vacío con una cifra típica — violando la
regla del proyecto (casilla vacía antes que dato inventado). Se condicionan las reglas 5
y 6 a que el dato ESTÉ en los bloques entregados y PROHIBIDO gana una línea que nombra
explícitamente que inventar cifras de signos vitales no se hace (mismo patrón positivo +
negativo que la corrección de labs/riesgo de v17.3.0). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **PA alucinada** | `MTR_EA_SYS` regla 6: se elimina la cláusula «Si una cifra no está en NINGÚN bloque (p. ej. la presión arterial), NO la escribas — el texto queda sin esa cifra» (la cifra ausente vuelve a quedar sin condición) | `suite_57` | *Enfermedad Actual ya NO exige la PA cuando no viene en los hechos: se omite, no se inventa* (esperaba la condición «si la cifra no está…», obtuvo `false`) |

Restaurada; el banco completo volvió a 2.298/2.298 tras la restauración.

## v17.6.3 — 22-ago-2026 (la nota de «Análisis y plan» sale limpia de markdown basura)

Banco antes (tras la PA alucinada): 2.298 comprobaciones · después: **2.301** (3 pruebas
nuevas), cobertura **100 % (850/850)**.

Reporte del médico: la nota de «Análisis y plan» llegaba con basura markdown del modelo
(p. ej. «====** COCKCROFT-»): negritas `**`, `=` sueltos y cabeceras malformadas, pese a
la regla de texto plano del prompt. Raíz: `MTR_NOTA_SYS` autoriza las cabeceras
`===== SECCIÓN: X =====` y los `::` de ítem, y los modelos flash-lite generalizan de más
(negritas alrededor de las etiquetas, decoración `=` suelta, cabeceras truncadas); el
texto de la respuesta entraba SIN saneamiento a la casilla de la historia clínica. Se
corrige en dos capas: (1) el prompt ahora declara por nombre cuál es la ÚNICA decoración
permitida y prohíbe asteriscos/negritas/backticks (positivo + negativo); (2) defensa en
profundidad: nueva función pura `mtrLimpiarNotaIA` (normaliza cabeceras a la forma
sancionada, elimina `**`/`__`/backticks/enlaces y corridas de `=` basura; nunca inventa ni
borra contenido clínico; el marcador `#PACIENTE_[ID]_#RCV_CONTROL_[AÑO_MES]` sobrevive),
aplicada en el conector `mtrGeminiRedactar` para `analisis_plan` (todos los caminos:
Generar y Generar todo). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **markdown sucio** | `mtrLimpiarNotaIA`: la limpieza de corridas de `=` (`return l.replace(/={2,}/g, "")`) pasa a `return l` (la decoración `=` vuelve a pasar) | `suite_57` | *mtrLimpiarNotaIA: el borrador de la nota sale limpio de markdown (el reporte «====** COCKCROFT-» no puede volver a pasar)* (esperaba sin `=` fuera de cabeceras, obtuvo la línea sucia) |

Restaurada; el banco completo volvió a 2.301/2.301 tras la restauración.

## v17.6.3 — 22-ago-2026 (la lista «toma quedó» del agendamiento deja de duplicarse y desordenarse)

Banco antes (tras el markdown sucio): 2.301 comprobaciones · después: **2.303** (2 pruebas
nuevas), cobertura **100 % (852/852)**.

Reporte del médico: en el agendamiento, la lista «toma quedó» del banner aparecía
duplicada o en desorden. Raíz: el clic en un chip de día de toma hacía
`_bannerSug.innerHTML += …` (línea 19470) SIN quitar la nota anterior — el segundo clic
apilaba otra nota (y el tercero, otra), y las notas quedaban en orden de clic, no de
fecha; el banner sí se repintaba fresco en el otro camino (`_pintarBannerSugerida`), pero
esta rama (control ya elegido a mano) solo acumulaba. Se corrige con la nota bajo un id
FIJO y una función pura `mtrPegarNotaTomaQuedo` que REEMPLAZA la nota anterior a nivel de
cadena (una sola «toma quedó», siempre la del último clic); el handler del chip pasa de
`+=` a esa función. El arnés no simula el DOM del modal, así que el contrato (id estable
+ reemplazo) se prueba en las funciones puras. Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **toma quedó duplicada** | `mtrPegarNotaTomaQuedo`: el reemplazo por id (`bannerHtml.replace(re, "") + nota`) pasa a `bannerHtml + nota` (vuelve a acumular como el `innerHTML +=` viejo) | `suite_62` | *v17.6.3 — la nota «toma quedó» se reemplaza, nunca se acumula (un clic por chip = una sola nota)* (esperaba 1 aparición, obtuvo 2 — el duplicado) |

Restaurada; el banco completo volvió a 2.303/2.303 tras la restauración.

## v17.6.3 — 22-ago-2026 (lote aprobado por el médico: A1 sede única, C2 motivo fijo, meta general de HbA1c)

Banco antes (tras «toma quedó»): 2.303 comprobaciones · después: **2.306** (3 pruebas
nuevas: 1 en `suite_62`, 1 en `suite_57`, 1 en `suite_67`).

Tres decisiones del médico del 22-ago, implementadas con su fuente única y su
mutación verificada:

1. **A1 — sede del laboratorio**: la sede 378 vivía escrita a mano en 5 URLs de AppCita.
   Ahora `mtrSedeIdLab()` es la única fuente (378 de fábrica) y las 5 URLs la usan.
2. **C2 — motivo de consulta**: lo que ve la IA es SIEMPRE «CONTROL DE RIESGO
   CARDIOVASCULAR», aunque la casilla de Everest traiga otra cosa (o PHI). Solo contexto
   del redactor; la casilla del médico jamás se toca.
3. **Meta general de HbA1c (flujo Ajustes → Ficha)**: nueva `mtrMetaHba1cGeneral()`
   lee `S.metaHba1cGeneral` (campo nuevo en Ajustes, 5–12 %); ausente o fuera de rango
   cae a 7,0 (la regla de siempre). La meta individual del paciente (✏️ del Panel,
   `metaHba1cManual`) gana sobre la general.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **sede equivocada** | `mtrSedeIdLab()` pasa de `return 378` a `return 379` (el número deja de ser el de instalación) | `suite_62` | *v17.6.3 — la sede del laboratorio tiene UNA sola fuente (mtrSedeIdLab, 378 de fábrica)* (esperaba 378 y obtuvo 379) |
| **motivo de Everest** | `mtrLeerTextoLibreHistoria`: la asignación `out.motivo = "CONTROL DE RIESGO CARDIOVASCULAR"` se sustituye por la lectura de la casilla `alert_message` de Everest (vuelve el motivo variable/PHI) | `suite_57` | *mtrLeerTextoLibreHistoria: el motivo es SIEMPRE «CONTROL DE RIESGO CARDIOVASCULAR» (decisión C2)…* (esperaba «CONTROL DE RIESGO CARDIOVASCULAR» y obtuvo «») |
| **meta ignorada** | `mtrMetaHba1cGeneral()` pierde la lectura de `S.metaHba1cGeneral` y devuelve fijo `MTR_HBA1C_META_DM2` (la config de Ajustes deja de mandar) | `suite_67` | *v17.6.3 — mtrMetaHba1cGeneral: 7,0 de fábrica; la de Ajustes (5–12) la reemplaza; fuera de rango vuelve a 7,0* (esperaba 7.5 y obtuvo 7) |

Restauradas una a una; `suite_57` (70), `suite_62` (43) y `suite_67` (30) en verde tras
cada restauración.

## v17.6.3 — 22-ago-2026 (lote aprobado 2/2: A2 anti-alucinación, B2 chips, B5 hoja educativa, D1 telemetría, D2 export)

Banco antes (tras el lote 1/2): 2.305 comprobaciones · después: **2.318** (13 pruebas
nuevas: 3 en `suite_57`, 3 en `suite_04`, 2 en `suite_67`, 2 en `suite_68`, 3 en `suite_23`).

Cinco decisiones del médico del 22-ago, cada una con su mutación verificada:

- **A2 — verificador de cifras de la IA**: `mtrVerificarCifrasIA` marca en rojo toda cifra
  de medida del borrador sin respaldo en los hechos entregados (el «PA 110/70» inventado ya
  no pasa callado). Caja roja en el modal, re-evaluada al editar.
- **B2 — aviso único con chips accionables**: cada chip de lab/PyM y el botón «Agendar
  control» abren el panel de órdenes / el agendamiento (`mtrAvisoAccionDe`); sin paciente
  identificado el aviso informa pero no inventa botones muertos.
- **B5 — hoja educativa imprimible**: `mtrHojaEducativaHtml` arma el documento con las
  secciones que el resumen real justifica (alarmas, dieta, actividad, pendientes, meta
  HbA1c, riesgo) y cero datos inventados.
- **D1 — tablero local de telemetría**: `mtrTableroTelemetria` lee la ventana UX local y
  calcula el ABANDONO DEL EMBUDO DE AGENDAMIENTO (abiertos `fn.agendar.open` vs creadas
  `cita.creada.*`); se pinta en el Resumen del turno.
- **D2 — export semanal de productividad**: `mtrProductividadCsvSemana` baja la semana en
  curso a CSV con la misma regla de la vista (un día sin atendidas no cuenta meta en contra).

Verificado como YA implementado (sin cambio de código): A3 (cosecha ya en 33 %,
`MTR_COSECHA_MARGEN_PROP = 0.33`) y A4 (relojes ya unificados a 10 min con la pre-consulta
deliberada a 6 h).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **verificador ciego** | `mtrVerificarCifrasIA`: se retira `if (conocidas.has(r)) return;` (toda cifra de medida se marca, aun las que SÍ estaban en los hechos) | `suite_57` | *mtrVerificarCifrasIA: una PA inventada…* y *…un lab que la IA cambió se marca; el que copió bien no* (esperaba 0 y obtuvo 2 — PA 120/80 y LDL 118 marcadas) |
| **chips muertos** | `mtrAvisoAccionDe()` devuelve fijo `null` (ningún clic dispara acción) | `suite_04` | *mtrAvisoAccionDe: encuentra la acción en el chip y en sus contenedores, y nada fuera* (esperaba «ordenar» y obtuvo null) |
| **alarmas a todos** | `mtrHojaEducativaHtml`: `if (flags.alarmas)` pasa a `if (true)` (la sección de alarmas sale para cualquier paciente) | `suite_67` | *v17.6.3 — mtrHojaEducativaHtml: sin riesgo ni pendientes sigue siendo un documento imprimible (no inventa secciones)* (la sección de alarmas no debía salir) |
| **embudo roto** | `mtrTableroTelemetria`: `cita.creada.*` pasa a la clave exacta `cita.creada` (las creadas dejan de contarse) | `suite_23` | *mtrTableroTelemetria: embudo de agendamiento…* (esperaba 7 creadas y obtuvo 0; abandono 100) |
| **meta en días sin trabajo** | `mtrProductividadCsvSemana`: `if (at > 0)` pasa a `if (true)` (el día sin atendidas mete meta en contra) | `suite_68` | *mtrProductividadCsvSemana: una fila por día + total…* (el martes sin trabajo salía con meta 18) |
| **cuenta atrás en mayúsculas** | `countdownParts`: el texto de la cuenta pasa de `"en "` a `"EN "` | `suite_06` | *countdown calcula tiempo faltante* (esperaba `en 16:00` y obtuvo `EN 16:00`) |
| **latido nunca escrito** | `heartbeat`: la condición del write-condicional pasa a `if (false && …)` (LEADER_KEY jamás se escribe) | `suite_17` | *heartbeat: liderazgo por latido con RELEVO…* — «y deja su latido escrito» (obtuvo false) + otros 6 casos de heartbeat |
| **timer escalonado sin registrar** | `boot()`: se omite `tVerMin` del push a `state.timers` (el chequeo de versión diferido 4 s quedaría fuera del alcance de emergencyTeardown) | — | **Sobrevivió** — `suite_17` verifica solo el intervalo de 5 min y `suite_30` pone `state.timers = [999]` antes del teardown; ninguna prueba comprueba que TODOS los timers de boot queden registrados |

Restauradas una a una; el banco completo volvió a verde tras cada restauración.

## v17.6.3 — 22-ago-2026 (la guardia de ruta acepta la URL real de producción /viva/EverHealth/HCHealth)

Banco de ESTE repositorio antes: 1.894 comprobaciones · después: **1.895** (1 prueba nueva en
`suite_14`). El harness pasa a cargar por defecto con la URL REAL donde el médico ejecuta el
script — `https://neps.everestintelligent.com/viva/EverHealth/HCHealth` — en lugar de la
`/viva/HCHealth/` de la captura original, así que el banco entero valida contra la página
real.

El médico confirmó que la página de trabajo es `.../viva/EverHealth/HCHealth` (con el
segmento `EverHealth/` entre `/viva/` y `HCHealth`). `_enModuloHCHealth()` solo aceptaba
`/\/viva\/HCHealth(\/|$)/`, así que en la página real devolvía `false` y `tick()` ocultaba el
panel por completo (v16.2.2 lo esconde fuera del módulo): el Vigilante no aparecía donde el
médico trabaja. El regex ahora acepta las DOS formas (`/\/viva\/(?:EverHealth\/)?HCHealth(\/|$)/`),
porque el segmento final `HCHealth` identifica el módulo clínico (Citas del día, Historia
Clínica, Órdenes y RCV viven bajo él). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **URL real** | `_enModuloHCHealth`: el regex vuelve a `/\/viva\/HCHealth(\/|$)/` (sin el segmento `EverHealth/` opcional — la forma que rompía en la página real) | `suite_14` | *_enModuloHCHealth: true con la URL real /viva/EverHealth/HCHealth (y sus subrutas)* (esperaba `true` en la Historia Clínica real, obtuvo `false`) |

Aplicada sobre el archivo de producción, corrida `suite_14`, confirmado el rojo con el
mensaje esperado, y restaurada antes de seguir. El banco completo volvió a 1.895/1.895 tras
la restauración.

## v17.6.3 — 22-ago-2026 (el hueco «timer escalonado sin registrar» queda cerrado)

La tabla de v17.6.3 (lote 2/2) documentó una mutación SOBREVIVIENTE: `boot()` omitía
`tVerMin` del push a `state.timers` y ninguna prueba la cazaba — `suite_17` solo verificaba
dos intervalos puntuales por su función y `suite_30` ponía `state.timers = [999]` a mano
antes del teardown. `state.timers` es la lista EXACTA que `emergencyTeardown()` cancela con
el kill-switch; un timer que no esté en ella sigue consultando la red con la interfaz
retirada. Se agrega un caso hermano en `suite_17` (39→40 comprobaciones en la suite) que
exige el registro completo: tras `boot()`, `state.timers` sube en 13 (los diez del push
principal + tSonda + tPymDiario + tPymCaptador) y el handle del chequeo de versión
escalonado (setTimeout 4 s → `checkVersionMinimum`) está entre ellos, por identidad de
objeto. La mutación ahora cae:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **timer escalonado (revisado)** | `boot()`: `state.timers.push(tAutoUpd, tVerMin, …)` vuelve a omitir `tVerMin` (el push baja a 12 handles) | `suite_17` | *boot: TODOS los timers quedan registrados en state.timers (tVerMin incluido)…* (esperaba 13, obtuvo 12) |

Aplicada sobre el archivo de producción, corrida `suite_17`, confirmado el rojo con el
mensaje exacto, y restaurada antes de seguir. El banco completo volvió a 1.896/1.896 tras
la restauración.

## v17.6.3 — 22-ago-2026 (blindaje CSS verificado en Chromium real con el DOM real: kicker/sub del modal IA, botones .sec/.pri y #vgl-head)

Se montó el E2E visual con el DOM REAL (protocolo T8, pero el userscript entero inyectado
en Chromium sobre un fixture de Everest con el CSS hostil por delante; los modales los
construye el propio código vía `__VGL__`). El CSSOM confirmó tres huecos de blindaje sin
regla ganadora frente al hostil (`div,span,p,…{color:#1f4e79 !important}`):

- `#vgl-ia-modal .vgl-agm-kicker` y `.vgl-agm-sub`: el modal IA no estaba en las listas
  ficha/tablero/panel → el título del modal salía en azul Everest.
- `.vgl-agm-btn.sec` y `.vgl-agm-btn.pri`: las reglas base no llevaban la marca → los
  botones salían en azul Everest (el `.pri`, verde sobre fondo, quedaba ilegible).
- `#vgl-head`: no declaraba color → el título del panel salía en azul Everest.

Corregido editando las listas existentes (nunca duplicando selectores): kicker/sub del IA
entran a las listas que ya llevaban la marca (no cambian el censo) y `.sec`/`.pri`/`#vgl-head`
ganan su propia marca (censo 307 → 310; suite_25 actualizada). Re-medido en Chromium real:
modal IA 9/9 campos OK en claro (7.18–17.49:1) y el trío con sus identidades de color por
módulo (azul/morado/verde). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **botón pri sin marca** | `.vgl-agm-btn.pri`: `color:var(--c-verde) !important` vuelve a `color:var(--c-verde)` (el botón queda expuesto al hostil) | `suite_25` | *Regla G - escala tipográfica / censo de !important* (esperado 310, salió 309) |
| **count del resumen sin marca** | `#vgl-root #vgl-sheet .vgl-count`: `color:var(--fg) !important` vuelve a `color:var(--fg)` (el conteo queda expuesto al hostil de Everest) | `suite_25` | *Regla G - escala tipográfica / censo de !important* (esperado 333, salió 332) |
| **ámbar del reloj apagado** | `actualizarRelojCabecera()`: `c.classList.toggle("vgl-stale", !fresco)` vuelve a `toggle(..., false)` (el reloj nunca avisa que los datos están viejos) | `suite_31` | *el reloj se pone ámbar cuando la última lectura pasa de 30 s* ("debe ponerse ámbar (obtuvo false)") |
| **cronómetro siempre nulo** | `cronometroDe(a)`: se antepone `if (true) return null` (el cronómetro nunca aparece aunque el paciente esté en sala) | `suite_31` | *cronómetro: solo cuenta al paciente en sala* ("debe pintar ⏱ Nm; devolvió null") |

Aplicada sobre el archivo de producción, corrida `suite_25`, confirmado el rojo con el
mensaje exacto, y restaurada antes de seguir. El banco completo volvió a verde tras la
restauración.
| **no-show no suma (v17.6.7)** | _noShowRegistrar: e.total = (e.total || 0) + 1 mutado a + 0 (el historial de inasistencias nunca crece) | suite_31 | *v17.6.7: adherencia registra el no-show sin duplicar* ("el primer no-show queda con total 1: esperaba 1 y obtuvo 0") |
| **festivos sin delegación (v17.6.8)** | esFestivo: eturn mtrEsFestivoCO(...) mutado a eturn false para años fuera de la tabla (2028 queda ciego y el agendamiento citaría en festivo) | suite_69 | *v17.6.8: esFestivo delega al motor calculado* ("1-ene-2028 debe ser festivo (obtuvo false)") |
| **toasts sin agrupar (v17.6.9)** | _agruparToasts: se antepone eturn (lista||[]).slice() (los avisos del mismo paciente vuelven a apilarse) | suite_42 | *v17.6.9: _agruparToasts combina avisos del mismo paciente* ("debe quedar en una sola tarjeta") |

## v17.6.10 — 23-ago-2026 (limpieza final: dead code y claves de Ajustes muertas)

La tarea fue de REMOCIÓN (código sin llamador en producción). La mutación que corresponde
a una remoción es re-agregar lo eliminado y comprobar que ninguna prueba cae: si cayera,
el código no estaba muerto. Que la mutación SOBREVIVA es el resultado esperado y queda
documentado aquí como evidencia de que nada depende de ese código.

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~30966 (v17.6.10) | Se re-agregó `mtrPartirNota` (retirada en esta versión por no tener llamador; suite_57 dejó de probarla) | SÍ (esperado) | Ninguna: suite_57 quedó en 72/72 con la función de vuelta. Confirma que era código muerto y que retirar su prueba era correcto. |

Se restauró de inmediato (borrada otra vez) y suite_57 volvió a verde antes de cerrar la
versión. El banco completo al cierre: **1.908 comprobaciones, 0 en rojo** (1919 en 17.6.9;
−11 casos de prueba retirados junto con el código muerto que probaban).

## v17.6.11 — 23-ago-2026 (Redacción IA S+: contador de palabras)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~32024 (v17.6.11) | `mtrContarPalabrasTexto` mutada a `return 0` (el contador del borrador nunca reporta palabras) | NO | Ninguna: la prueba *v17.6.11: el contador de palabras del borrador nunca miente ni revienta* (suite_57) cayó a rojo como se esperaba. Restaurada de inmediato; suite_57 volvió a 73/73. |

Mutación aplicada sobre el archivo de producción, corrida suite_57, confirmado el rojo con la
aserción esperada, y restaurada antes de cerrar la versión. El banco completo quedó en verde
con las suites presentes en este equipo (44 suites, 1.408 comprobaciones).

## v17.6.12 — 23-ago-2026 (Redacción IA, 2ª tanda S+: poda de memoria del texto previo)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~31322 (v17.6.12) | `_vglTextoPrevioPodar` mutada a `const sobra = 0` (la poda nunca recorta: el mapa de textos previos crecería sin límite en sesiones largas) | NO | Ninguna: la prueba *v17.6.12: _vglTextoPrevioPodar recorta a tope y conserva los más recientes* (suite_57) cayó a rojo como se esperaba. Restaurada de inmediato; suite_57 volvió a 75/75. |

Mutación aplicada sobre el archivo de producción, corrida suite_57 (74 ok + 1 rojo con la
aserción esperada), restaurada y confirmado el verde antes de cerrar la versión. El banco
completo quedó en verde con las suites presentes en este equipo (44 suites, **1.410
comprobaciones**, +2 por los casos nuevos de la poda).

## v17.6.13 — 23-ago-2026 (Auditoría S+ del Agendamiento: 5 hallazgos, 5 mutaciones)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~19672 (v17.6.13) | `if (esSugerida)` vuelto a `if (esSugerida \|\| (!_preseleccion && idx === 0))` (la preselección de madrugada sin sugerencia reaparece) | NO | Ninguna: *v17.6.13: sin sugerencia clínica, NINGÚN turno nace activo* (suite_15) cayó a rojo. Restaurada; suite_15 volvió a 144/144. |
| ~19683 (v17.6.13) | Quitado el reset `confirmBtn.dataset.dupOk/vencOk` del clic de turno (cambiar de turno conservaba la marca del aviso visto) | NO | Ninguna: *v17.6.13: cambiar de turno reinicia la doble confirmación* (suite_15) cayó a rojo. Restaurada de inmediato. |
| ~19358 (v17.6.13) | Quitado `_vglCelularSinDatos()` de la rama de datos incompletos (el celular vuelve a quedarse en "cargando…" con SMS tildado) | NO | Ninguna: *v17.6.13: si Everest no devuelve los datos del paciente...* (suite_15) cayó a rojo. Restaurada de inmediato. |
| ~18824 (v17.6.13) | Quitado `aria-current="step"` del indicador inicial del stepper | NO | Ninguna: *v17.6.13: accesibilidad del modal — aria-live... y aria-current* (suite_15) cayó a rojo. Restaurada de inmediato. |
| ~19618 (v17.6.13) | `marcaNoRecomendado` forzado a `""` (la razón del cupo desaconsejado vuelve a vivir solo en el tooltip) | NO | Ninguna: *v17.6.13: el cupo desaconsejado se ve usable...* (suite_15) cayó a rojo. Restaurada de inmediato. |

Las 5 mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada
una antes de la siguiente), cada corrida dejó suite_15 en 143 ok + 1 rojo con la aserción
esperada, y se confirmó el verde (144/144) al restaurar. El banco completo al cierre:
**1.416 comprobaciones, 0 en rojo** (44 suites presentes, +6 casos nuevos en suite_15).

## v17.6.14 — 23-ago-2026 (Telemetría S+: beacon con acuse, memoria acotada, backoff y URL ofuscada)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~8001 (v17.6.14) | Quitado el backoff de `reportar()` (vuelve el flush inmediato: cada evento reintenta contra un panel caído, hasta 20 s de timeout por intento) | NO | Ninguna: *v17.6.14: reportar con el panel caído hace backoff* (suite_23) cayó a rojo. Restaurada; suite_23 volvió a verde. |
| ~8430 (v17.6.14) | Quitada la guarda de acuse fresco de `_vaciarTelemetriaAlSalir` (el beacon vuelve a retirar evidencia sin acuse: panel caído/token rotado = fila perdida en silencio) | NO | Ninguna: *v17.6.14: _vaciarTelemetriaAlSalir SIN acuse fresco NO retira evidencia* (suite_23) cayó a rojo. Restaurada de inmediato. |
| ~8109 (v17.6.14) | `_errVistos.add(huella)` incondicional (el Set vuelve a crecer sin tope: la memoria ya no está acotada a 40 huellas) | NO | Ninguna: *v17.6.14: reportarError no deja crecer la memoria de huellas por encima del techo* (suite_23) cayó a rojo, y también la prueba vieja del techo por huella (ahora 41 filas). Restaurada de inmediato. |
| ~10800 (v17.6.14) | `localStorage.setItem("vgl_api_url", abs)` (la URL con el profesionalId vuelve a dormir en claro, legible para scripts del host) | NO | Ninguna: las aserciones de ofuscación de suite_19 (2 casos) cayeron a rojo. Restaurada de inmediato. |

Las 4 mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada
una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se confirmó el
verde al restaurar. El banco completo al cierre: **1.424 comprobaciones, 0 en rojo** (44
suites presentes; +7 casos en suite_23, +1 en suite_19, y suites 13/19 ajustadas a la URL
ofuscada).

## v17.6.15 — 24-ago-2026 (Agenda S+: aviso honesto de lectura ciega fuera de Citas del día)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~24073 (v17.6.15) | Guarda del aviso forzada a `if (false && leader && ...)` (el Vigilante vuelve a quedar ciego en silencio, sin avisar que no tiene lectura de la agenda) | NO | Ninguna: *tick: sin API sano y fuera de agenda/historia (pero dentro de HCHealth), avisa UNA vez que está ciego* (suite_17) cayó a rojo. Restaurada de inmediato; suite_17 volvió a 41/41. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. Una prueba preexistente de suite_17
("...sin volver a notificar") se ajustó (filtro por título en vez de contador global) porque
el mismo escenario que prueba ahora dispara, LEGÍTIMAMENTE, el nuevo aviso honesto —
ver CHANGELOG.md v17.6.15. El banco completo al cierre: **1.425 comprobaciones, 0 en
rojo** (44 suites presentes; +1 caso nuevo en suite_17).

## v17.6.16 — 24-ago-2026 (Agenda S+: la URL de agenda ya no se abandona por fallos pasajeros)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~11026 (v17.6.16) | Reintroducido `if (API.fallos >= 3) purgarApiUrl(...)` en la rama catch de `apiLeerAgenda` (la URL vuelve a olvidarse tras 3 fallos seguidos) | NO | Ninguna: *apiEspera/apiUtil: una racha larga de fallos NO purga la URL — solo se enfría (v17.6.16)* (suite_13) cayó a rojo. Restaurada de inmediato; suite_13 volvió a 60/60. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. La prueba preexistente que verificaba el
purgado a los 3 fallos (v12.3.7) se reescribió para verificar el comportamiento nuevo
(sobrevive una racha larga, entra al enfriamiento de 5 min de `apiUtil()`, y se recupera
sola sin volver a "Citas del día") — ver CHANGELOG.md v17.6.16. El banco completo al
cierre: **1.425 comprobaciones, 0 en rojo** (44 suites presentes).

## v17.6.18 — 24-ago-2026 (Panel del paciente S+: el aviso al abrir la historia vuelve a ser solo informativo)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~10028 (v17.6.18) | Reinsertado el botón `📅 Agendar control` en `avisoUniversal` (el aviso vuelve a mostrar acciones) | NO | Ninguna: *avisoUniversal: los chips son informativos (spans), sin botones de acción (v17.6.18)* (suite_04) cayó a rojo. Restaurada de inmediato; suite_04 volvió a 192/192. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. Se retiraron, sin dejar rastro: los dos
botones de acción del aviso, la conversión de los chips en botones (`data-aviso-accion`),
la delegación de clics asociada, el helper puro `mtrAvisoAccionDe` (ya sin llamador) y su
prueba dedicada, y el parámetro `apt`/`_aptAviso` que solo existía para esas acciones —
ver CHANGELOG.md v17.6.18. El banco completo al cierre: **1.423 comprobaciones, 0 en
rojo** (44 suites presentes; -2 casos consolidados en 1 en suite_04, -1 prueba de la
función eliminada).

## v17.6.19 — 24-ago-2026 (Bienestar/Turno: se retiran 4 funciones sin uso real en consultorio)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~12368 (v17.6.19) | Reinsertadas las 2 reglas CSS `.vgl-cd.vgl-cron` (3 `!important`) que el cronómetro dejó al retirarse | NO | Ninguna: *Regla G - escala tipográfica...* (suite_25, censo de `!important`) cayó a rojo (esperaba 347, salió 350). Restaurada de inmediato; suite_25 volvió a 15/15. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. Los otros 3 retiros (Regla 20-20-20,
Sugerir fecha de control, Botón de fin de turno) no tenían prueba dedicada que los
protegiera (los cuatro estaban APAGADOS por defecto, sin cobertura propia) — se verificó
su retiro completo por lectura: sin llamadores huérfanos, sin referencias a `S.ojos`/
`S.ojosMin`/`S.seguimiento`/`S.resumenFin` en el resto del archivo ni en tests/. El banco
completo al cierre: **1.423 comprobaciones, 0 en rojo** (44 suites presentes; censo de
suite_25 ajustado de 350 a 347 y su comentario actualizado).

## v17.6.20 — 24-ago-2026 (Telemetria corregida + se retiran Espera prolongada y Pausa activa)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~19049 (v17.6.20) | Quitado `if (!_fnCompletado) uxTrack("fn.agendar.abandon")` del closeMod real de `openAgendamientoModal` (el embudo vuelve a quedarse sin su propio abandono) | NO | Ninguna: *embudo de Agendamiento: cerrar sin crear cita cuenta como abandono de SU PROPIO embudo* (suite_23, nueva) Y la prueba genérica *embudo: todo modal con fn.X.open tiene tambien su fn.X.complete y su fn.X.abandon* cayeron a rojo. Restaurada de inmediato; suite_23 volvió a 91/91. |
| ~12368 — revisado, no reaplicado (ver v17.6.19) | (mutación de la limpieza de Espera prolongada/Pausa activa) | — | Sin prueba dedicada que proteja estos dos retiros (estaban APAGADOS de fábrica, sin cobertura propia, igual que los 3 de v17.6.19) — se verificó el retiro completo por lectura: cero referencias a `S.pausas`/`S.escalada`/`state.pacienteDesde`/`state.escaladoAvisados`/`state.pausaProx`/`state.ojosProx` en el resto del archivo ni en tests/. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. El banco completo al cierre: **1.424
comprobaciones, 0 en rojo** (44 suites presentes; +2 casos en suite_23: la contaminación
cruzada de embudos y el embudo propio de Agendamiento).

## v17.6.21 — 24-ago-2026 (Agenda S+: debounce contra el parpadeo de estado entre fuentes)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~9450 (v17.6.21) | Quitado el bloque de debounce completo en `colorAndAlert` (`stRaw`/`st` vuelven a ser siempre la lectura cruda, sin confirmación de dos ticks) | NO | Ninguna: *un solo parpadeo... queda absorbido* Y *la MISMA lectura repetida dos veces seguidas SÍ se confirma* (suite_04, ambas nuevas) cayeron a rojo. Restaurada de inmediato; suite_04 volvió a 194/194. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con las dos
aserciones esperadas, y se confirmó el verde al restaurar. Diagnosticado a partir de un
CSV real de auditoría que el médico adjuntó (sin PHI copiado a este repositorio ni a
código/pruebas: el patrón se verificó leyendo el CSV, nunca se persistió nombre ni
documento de paciente). El banco completo al cierre: **1.426 comprobaciones, 0 en rojo**
(44 suites presentes; +2 casos nuevos en suite_04).

## v17.6.22 — 24-ago-2026 (Redactor IA: borradores incompletos avisados, contexto ya no queda obsoleto)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~30900 (v17.6.22) | `mtrEstadoBorrador` devuelto a un único mensaje fijo, sin distinguir MAX_TOKENS | NO | Ninguna: *mtrEstadoBorrador: MAX_TOKENS avisa honestamente...* (suite_57) cayó a rojo. Restaurada; suite_57 volvió a 78/78. |
| ~32031 (v17.6.22) | `libreAhora` vuelto a envolver una foto única (`const libre = mtrLeerTextoLibreHistoria(); libreAhora = () => libre`) — reintroduce la foto vieja por una vía indirecta | NO | Ninguna: *el panel de redacción ya NO congela el texto libre...* (suite_57, aserción por texto fuente) cayó a rojo. Restaurada de inmediato. |
| ~32395 (v17.6.22) | Uno de los DOS disparadores de generación (botón «Generar») vuelto a `contextoLibre: ""` — regresión PARCIAL, solo un sitio | NO | Ninguna: la misma aserción de conteo (`usos === 2`) cayó a rojo al bajar a 1. Restaurada de inmediato. |

Tres mutaciones aplicadas sobre el archivo de producción, UNA A LA VEZ (restaurando cada
una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. Se refactorizó `_estadoBorrador` (cierre interno del
modal, sin llamador aislable) a `mtrEstadoBorrador` (función pura de nivel superior) para
poder protegerla con una prueba directa, sin reconstruir el modal completo — mismo
criterio de diseño testeable que ya usa el resto del módulo. El fix del contexto obsoleto
se protege por aserción de texto fuente (mismo patrón ya establecido en este archivo para
"uxTrack no arrastra texto clínico"): no hay una unidad aislable para probar "se lee en el
momento del clic" sin reconstruir el modal completo de 600 líneas. El banco completo al
cierre: **1.429 comprobaciones, 0 en rojo** (44 suites presentes; +3 casos nuevos en
suite_57).

## v17.6.23 — 24-ago-2026 (Redactor IA: se ataca la causa raiz del truncamiento, no solo el aviso)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~31106-31107 (v17.6.23) | `maxOutputTokens` devuelto de 8192 a 2048 en ambas ramas de `cuerpoPara` | NO | Ninguna: dos pruebas de suite_57 ("tope de salida 8192..." y "el tope de salida NO se recorta... v17.6.23") cayeron a rojo. Restaurada de inmediato; suite_57 volvió a 78/78. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con ambas
aserciones esperadas, y se confirmó el verde al restaurar. Corrección directa sobre
v17.6.22 (mismo día): el médico aceptó el aviso honesto pero pidió la causa raíz —
se conservan AMBOS (el aviso como red de seguridad, el tope subido como arreglo real). El
banco completo al cierre: **1.429 comprobaciones, 0 en rojo** (44 suites presentes; 0
casos nuevos, 2 aserciones existentes actualizadas al nuevo valor).

## v17.6.24-25 — 24-ago-2026 (Redactor IA — Bloque A de la auditoría S+ de 20 bugs: botón «Preguntar» y datos que se perdían)

Primer bloque de una auditoría multi-agente de 20 hallazgos confirmados sobre la
Redacción Asistida (IA), pedida por el médico tras revisarlos ("hay botones de más").
Se implementa **por bloques, con pausa de revisión entre cada uno** (pedido explícito del
médico) — este es el Bloque A, correcciones aisladas sin dependencias.

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~13400 (v17.6.24) | Borrada la regla CSS `.vgl-agm-btn.sec.active` completa | NO | Ninguna: *v17.6.24: el botón «Preguntar» tiene una regla CSS .active* (suite_57) Y *Regla G — censo de `!important`* (suite_25, esperaba 349, salió 347) cayeron a rojo. Restaurada de inmediato; ambas suites volvieron a verde. |
| ~32016 (v17.6.25) | `const datos = Object.assign({}, mtrDatosExtraLeer(docId) \|\| {});` vuelto a `const datos = {};` (el Guardar de «➕ Datos del paciente» vuelve a reemplazar el almacén en vez de fusionar) | NO | Ninguna: *v17.6.25: «Datos del paciente» fusiona con lo ya guardado, no lo reemplaza* (suite_57) cayó a rojo. Restaurada de inmediato; suite_57 volvió a verde. |

Las dos mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando
cada una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. El bug de v17.6.24 no tiene una unidad aislable (el toggle
de `.active` vive dentro del handler delegado de clic del modal de 600 líneas) — se
protege por texto fuente, mismo criterio ya establecido en este archivo para "uxTrack no
arrastra texto clínico" y el contexto obsoleto de v17.6.22. El de v17.6.25 igual: el
handler de Guardar vive dentro de `mtrAbrirDatosAdicionales`, que construye un modal real
con `document.createElement`/`querySelector` sobre subárboles que el DOM de prueba de
este arnés no soporta (`elem.querySelector()` siempre devuelve `null`, ver
`tests/harness.js`) — reconstruir el modal completo para aislar el clic no es viable, así
que se protege igual por texto fuente. El banco completo al cierre: **1.431
comprobaciones, 0 en rojo** (44 suites presentes; +2 casos nuevos en suite_57, censo de
suite_25 ajustado de 347 a 349).
