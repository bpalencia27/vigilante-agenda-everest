# Telemetría del 01-sep-2026 — lo que dice el tablero

Análisis del export `REPORTEVIGILANTE.xlsx` que envió el médico el 1-sep. Todo lo de aquí
sale de contar el archivo, no de suponer. **Cero PHI**: el export no trae nombres ni cédulas;
los identificadores de equipo (`eq-…`) son aleatorios y no identifican a nadie.

## Cómo se leen estas columnas (importante, casi me equivoco)

Las claves que terminan en `.total` **NO son conteos: son milisegundos acumulados.**

    uxTrack("api." + etiqueta + ".ok", { n: Date.now() - t0 })   // línea 19092
    if (n) _uxBuf[a + ".total"] = (_uxBuf[a + ".total"] || 0) + n;   // línea 11385

Es decir: `api.citasdisponibles.ok` = número de llamadas; `api.citasdisponibles.ok.total` =
suma de sus latencias. Leerlo al revés convierte 262 llamadas en «787.467 acciones» y hace
ver bucles donde no los hay. La media por llamada es `.total / (sin .total)`.

Además, las filas del `uso` vienen repetidas por reenvío de la cola: hay que **deduplicar por
`lote`** antes de sumar (616 lotes únicos el 1-sep).

---

## 1. El canal de ERRORES está muerto desde la v17.2.0 (lo más grave)

La hoja `error` no recibe una sola fila de ninguna máquina por encima de **17.2.0**:

| versiones que SÍ entregan filas de `error` | 14.x, 15.x, 16.x, **17.2.0 (1 sola fila)** |
|---|---|
| versiones que NUNCA entregaron una | todo 17.6+, todo 18.x |

Y no es que no haya errores. El **27-ago**, seis máquinas distintas en **v18.0.4** emitieron
**81 `error.js` / 81 `error.distintos`** en `uso_detalle` — el contador que `reportarError`
incrementa en su primera línea, **antes** del tope diario y **antes** de `repOn()`:

    eq-nx58dp25sx v18.0.4   (la mayoría)
    eq-656muc9xe2 v18.0.4
    eq-d8i024flme, eq-0gebl3dope, eq-jvi1nb4ydo, eq-li6wd0g0yx  v18.0.4

`reportarError` corrió 81 veces ese día. **Ninguna de las 81 llegó a la hoja `error`.**

### Lo que esto descarta

No es el transporte, ni la cola, ni el token, ni el interruptor: en esas mismas máquinas v18
sí llegan otros eventos que usan exactamente la misma `reportar()` → `repQ` → `repPost`:

| evento | ¿llega desde v18? |
|---|---|
| `entorno` | sí — 18.0.4 (14), 18.0.32 (2), 18.0.5 (1) |
| `fraude` | sí — 18.0.4 |
| `prueba` | sí — 18.0.4 |
| **`error`** | **no — nunca, ninguna versión ≥17.6** |

Queda aislado en las guardas del propio `reportarError` (o en lo que le pasa a `reportar`),
no en la cola ni en la red.

### Por qué importa

Es la **tercera vez** que este canal se queda mudo, y las dos anteriores están documentadas
en el propio archivo: v14.1.6 («EL CAZADOR DE ERRORES LLEVABA UNA SEMANA SIN CAZAR NADA», el
filtro de `ev.filename`) y v17.1.0 #148 (el recorte de la cola por la cabeza, «la mitad de por
qué el tablero llevaba meses sin recibir un solo error con detalle»). El 27-ago hubo un día
claramente patológico —**18.414** llamadas de laboratorio y **2.040** rabietas de clic en una
sola jornada, todo en v18.0.4— y el detalle de sus 81 errores **se perdió**.

**Pendiente:** reproducir con el arnés y arreglar. No lo doy por diagnosticado: leyendo el
código las dos guardas candidatas (`repOn()` y el par `esNueva` / `_errVistos` con tope de 40
huellas) deberían dejar pasar las primeras 40, y no pasan. Hace falta la reproducción, no una
conjetura.

---

## 2. La flota entera está entre 17 y 30 versiones por detrás

Once equipos arrancaron el 1-sep:

| versión | equipos |
|---|---|
| 17.0.2 | 3 |
| 18.0.4 | 5 |
| 18.0.5 | 1 |
| 18.0.32 | 3 |

**Nadie por encima de 18.0.32.** Todo lo entregado desde entonces —el cruce de pacientes en el
Panel y en Agendar, la tensión que se mezclaba, las fechas que el modelo inventaba, el
uroanálisis que faltaba en la nota, el kill-switch mudo con «modo oculto», el timeout del
`fetch`— **no está en ninguna máquina**. Es el problema del Gist (`gistfile1.txt` **y**
`gistfile2.txt`), no un problema del código.

El equipo que aparece como `2` (Excel lo muestra `2.0`) no es un fallo: es el nombre de
consultorio escrito en Ajustes, y sus lotes lo confirman (`2-mtikb6q4-2`).

---

## 3. Everest, hoy vs ayer: el timeout de la v18.0.47 tiene su prueba

**01-sep** — latencia media por llamada:

| endpoint | llamadas | ms/llamada |
|---|---|---|
| `citasdisponibles.ok` | 262 | **2.826** |
| `asignarturno.ok` | 8 | 2.142 |
| `buscarpaciente.ok` | 155 | **1.651** |
| `perfilusuario.ok` | 189 | 122 |
| `resultadoslabannar.ok` | 346 | 64 |
| resto | — | < 165 |

Hoy Everest se portó. **El 31-ago no:**

| endpoint | llamadas | ms/llamada |
|---|---|---|
| `perfilusuario.err` | 75 | **98.004** (98 segundos) |
| `buscarpaciente.err` | 2.692 | **18.787** |
| `perfilusuario.ok` | 3.869 | 9.722 |
| `buscarpaciente.ok` | 6.823 | 2.904 |

Setenta y cinco llamadas colgadas **98 segundos de media**. Eso es exactamente el defecto que
cerró la **v18.0.47** (`PAGE_FETCH_TIMEOUT_MS = 15000` con `AbortController`): el `fetch` del
núcleo no tenía timeout. La telemetría del médico es la prueba empírica de que ese arreglo
hacía falta — y ninguna máquina lo tiene todavía.

Los dos endpoints lentos de hoy (`CitasDisponibles` 2,8 s y `BuscarPaciente` 1,65 s) son justo
los que espera el modal de Agendar.

---

## 4. `resultadoslabciti`: 100 % de fallos, y está bien así

`api.resultadoslabciti` no ha tenido **ni un solo `.ok`** en todo el archivo. No es un defecto
nuevo: la **v17.1.0 (#150)** ya documentó que Citi devuelve 404 en el 100 % de las llamadas de
esta IPS y le puso un cortacircuitos que lo apaga al primer 404 de cada sesión. Los números
confirman que el cortacircuitos funciona: **8 fallos** hoy (uno por pestaña abierta), no 800,
en un día con 346 llamadas exitosas a Annar.

---

## 5. Embudos del 1-sep — «Ordenar» es el que peor está

| módulo | abiertos | completados | abandonados |
|---|---|---|---|
| **ordenar** | 6 | **2** | **4** |
| agendar | 9 | 8 | 1 |
| ia | 10 | 11 | 2 |
| redactor | 10 | 10 | 0 |
| labs | 4 | 4 | 0 |
| panel | 16 | 9 | 0 |

**67 % de abandono en Ordenar**, el peor con diferencia — y es justo el módulo del hallazgo
#19 del enjambre, cuya reproducción es literalmente «generar, cancelar a mitad, reabrir». Ese
abandono es el gesto que creaba la orden duplicada. Arreglado en **v18.0.63**.

## 6. La IA se adopta casi sin tocarla

- 12 generaciones, 11 inserciones en la historia.
- **9 «intacta» + 2 «edición leve»**: el médico inserta la nota tal cual el ~82 % de las veces.
- Latencia: 8 de 12 en el tramo 5–10 s, 4 en 2–5 s. Todas en `gemini-3.5-flash-lite`.

Esto sube el listón de todo lo que toque la nota: una fecha inventada o un uroanálisis anormal
omitido entra en la historia casi sin filtro humano. No es un reproche al médico —es lo que
significa que la herramienta funcione— es la razón de que esos defectos fueran prioritarios.

## 7. Resto del día, sin sorpresas

- 8 citas creadas, 8 impresas; 5 laboratorios agendados, 6 impresos; 2 órdenes generadas.
- «Examen normal»: 27 clics, 27 aplicaciones — 100 % de acierto.
- Auto-llenado de laboratorios: 37 clics, 635 casillas (≈17 por clic).
- 34 historias capturadas, 34 enviadas.
- 41 avisos universales mostrados, 41 entendidos.

## 8. Rabietas de clic: 113, y no sabemos dónde

`ux.rage.host` = **113** hoy (60 en `eq-udm0okzgmy` v17.0.2, 41 en el consultorio `2`), y **0**
en cualquier otra etiqueta. Todos los días es igual: `host` se lleva el 97 %.

Parte es real (el médico peleando con Everest, que no es nuestro), pero parte no: el **hallazgo
#27** del enjambre demuestra que `_rageEtiqueta` manda a `host` **nuestros propios íconos SVG**,
porque `String(t.className)` en un `<svg>` da `"[object SVGAnimatedString]"`. Se ve en el propio
export de hoy: `rum.self.inp.detalle.host.needs_imp` = 7 — interacciones de NUESTRA interfaz
(`rum.self.*`) atribuidas a Everest. Arreglado en **v18.0.63**.

Lentitud de interfaz hoy: `rum.page.inp.poor` 116, `needs_imp` 551; en lo nuestro,
`rum.self.inp.poor` 14 y `needs_imp` 22 — con `visib-pill`, `head`, `btn`, `dock-btn` y
`examen-normalidad` entre los señalados.
