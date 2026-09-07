# Instrumentación de Observabilidad (P13 · Fase 1)

**Fecha:** 2026-09-05
**Rama:** `claude/observabilidad-adopcion`
**Prompt:** `07_observabilidad_adopcion.txt` (FASE 1 · Instrumentación total)
**Cifras de contexto:** prompt 07 (medición del dueño 22-ago→4-sep-2026, hoja uso_detalle) — ≈4.020 interrupciones de aviso en 14 días (≈72 por equipo/día), 88,6 % simplemente cerradas, DOS con acción; y 48 ids de equipo distintos en 14 días para tres médicos.

---

## 1. El problema que resuelve

Hasta v18.2 la telemetría sabía **contar ocurrencias** (`uxTrack`) pero no podía
responder ninguna pregunta de negocio:

- Sin identidad estable, "por usuario" era ruido: 48 ids en 14 días para tres
  médicos significa que cualquier métrica por equipo se desangra en pedazos.
- Sin denominador (pacientes **elegibles**), "el módulo Ordenar se usó 300 veces"
  no dice nada si no se sabe si hubo 200 pacientes con órdenes pendientes o 2.000.
- Sin desenlace, un aviso era solo una fila "mostrado": nadie sabe si el médico
  hizo después, por su cuenta, lo que pedía — que es la única medida de si sirve.

El módulo `obs*` (final del IIFE, con hoisting para que `_equipoId()` delegue en
él) añade esas tres piezas. Todo sale por la cola existente
(`reportar` → `vgl_repq` → TABLERO) con el prefijo `obs.` en el evento, **sin
mezclarse con la telemetría v15** ni tocar sus claves.

---

## 2. Identidad (1.1)

### Equipo — prioridad invariable

1. Ajuste manual (`S.equipo`, máx 40 chars).
2. Id persistente en GM (`vgl_obs_equipo`) — GM es del gestor de userscripts,
   no del sitio: **sobrevive la limpieza de datos del sitio**, que era la fuga.
3. Migración del legado `vgl_equipo_id` de localStorage (v12.6.9): se migra,
   no se borra.
4. Recuperación por huella (`vgl_obs_equipo_fp` = mapa `{huella: id}`).
5. Id nuevo `eq-<rand>` → **emite `obs.equipo.nuevo`**.

La huella de respaldo (`obsHuellaEquipo`) es FNV-1a de atributos técnicos
(resolución + idioma + hilos de CPU + zona horaria): une filas, no identifica
a una persona (mismo consultorio = misma huella casi siempre).

El aviso de nacimiento está **diferido un tick** (`setTimeout(...,0)`): en
sincronía re-entraba en `reportar()` mientras la llamada nacía de la evaluación
del literal de otra fila (`equipo: _equipoId()`), invirtiendo el orden de la
cola según quién despertara al id. Y deliberadamente NO usa `uxTrack`: contaminaba
la ventana UX de la media hora en que nazca (regresión cazada por suite_23).

### Médico — `m-<hash>`

Deriva de la identidad que la compuerta de consentimiento (P11) ya valida
(`mtrIdentificadorParaConstancia`: uid de Everest o login de sesión), pasada por
FNV-1a. Anónimo pero **constante**: permite decir "el médico A usa Ordenar y el
B no". Sin identidad validada no se inventa nada (casilla vacía).

---

## 3. Eventos y la pregunta de negocio que responde cada uno

| Evento | Fase/campos | Pregunta de negocio |
|---|---|---|
| `obs.equipo.nuevo` | — | ¿Se nos está fugando la identidad? (los 48 ids/14 días: sin este aviso no se distingue un equipo nuevo de un bug) |
| `obs.consulta.abierta` | — | ¿Cuántos pacientes se atendieron de verdad? (denominador base; dedup: ventana de 5 min) |
| `obs.consulta.cerrada` | `ms`, `ctx.motivo` | ¿Cuánto duró la consulta y por qué se cerró (siguiente paciente / reemplazada)? |
| `obs.consulta.elegible.<modulo>` | — | ¿Cuántos pacientes **calificaban** para ese módulo? (el denominador honesto; dedup por consulta) |
| `obs.modulo.<modulo>` | `fase:"fin"`, `resultado` | ¿Se usó y COMO terminó? (numerador; `resultado` ∈ ok/fallo/cancelado/vacio/timeout) |
| `obs.aviso.mostrado` | `fase:"inicio"`, `ctx` | ¿Qué interrumpió, a quién, con qué carga (pym/labs/ad/pr)? |
| `obs.aviso.desenlace` | `ms`, `ctx.d` | ¿Qué pasó con el aviso y cuánto lo sostuvo en pantalla el médico? |
| `obs.aviso.desenlace` con `d:"posterior"` | — | **Métrica de oro:** el médico cerró sin actuar y DESPUÉS hizo, por su cuenta, lo que pedía |
| `uxTrack("obs.catch.<codigo>")` | — | ¿Dónde están fallando los ~891 `catch` mudos? (contador de rutas, sin mensajes) |

Desenlaces posibles (`OBS_DESENLACES`): `accion` | `cerrado` | `ignorado` |
`expirado` | `silenciado` | `posterior`.

`modulo` se sanea a `[a-z0-9_-]{1,16}`; la acción completa debe casar con
`OBS_ACCION_RE = /^[a-z0-9][a-z0-9._-]{0,59}$/` (enum de código, nada de texto
libre: una acción que no case se cuenta en `obs_perdidos`, no viaja).

---

## 4. Esquema de la fila

El sobre lo pone `reportar()` (token/equipo/ver/evento/ts/dia/lote). El módulo
añade SOLO campos de lista blanca (`obsSerializar`):

```json
{
  "evento": "obs.aviso.desenlace",
  "medico": "m-1a2b3c4d",
  "consulta": "9f8e7d6c",
  "fase": "fin",
  "resultado": "",
  "codigo": "",
  "ms": 4200,
  "n": 0,
  "ctx": "d:accion,pym:3,labs:0"
}
```

- `consulta` es el **hash** de la clave del paciente (la cédula no sale jamás
  del equipo).
- `ms` en todo lo que el médico espera mirando la pantalla (tope 24 h).
- `n` conteos (tope 10⁶).
- `ctx` viaja como cadena compacta `k:v,...` (máx 64 chars, 6 pares).

---

## 5. Barrera cero-PHI (1.6) — lista blanca, no lista negra

- El serializador **declara** los campos y descarta el resto: lo que no está
  en la lista no existe para la red.
- Solo números, booleanos y códigos de enum. Nunca texto libre.
- Valores `ctx`: charset cerrado SIN espacios (`OBS_CTX_VALOR_RE`, máx 24) y,
  si no trae letras, **4 chars o menos** — una cédula o un celular son "solo
  números" y quedan fuera aunque no tengan espacios.
- Lo rechazado se **cuenta, no se pierde en silencio**: `obsPerdidosSumar`
  acumula en `vgl_obs_perdidos` con su motivo (`ctx_rechazado`,
  `accion_invalida`) y el total viaja como `obs_perdidos` en la fila de entorno
  diaria (sanity check: si sube, el código está mandando algo que la lista
  blanca no admite).
- **Prueba canario** (suite_83): inyecta nombre, cédula y texto de historia en
  cada punto de emisión; FALLA si algo aparece en el payload.
- Se recoge MÁS registrando forma y resultado, no contenido: "cerró el aviso
  tras 4,2 s con 3 PyM pendientes" vale más que cualquier texto y no es dato
  de paciente.

---

## 6. Entrega sin pérdidas (1.7)

La cola persistente ya existía y ya estaba blindada contra el fallo real de
"despachar sin desencolar" (P11, suite_11). El módulo la reusa tal cual: cada
`obs.*` es una fila más de `vgl_repq`, con reintentos y dedup heredados. Lo
nuevo es el contador de perdidos (§5). La corrección de reentrancia de esta
versión: la fila se construye ANTES de `repQLoad(); repQ.push(fila);` para que
el receiver del push no quede atado al array viejo que la recursión reasigna.

---

## 7. Presupuesto de interrupciones (4.4)

Medido (prompt 07): ≈72 interrupciones por equipo/día. Tope por equipo y día
para el aviso universal: **6** por defecto (`S.obsPresupuestoAvisos`, número ≥ 0;
0 = sin tope). `esPrueba` lo exime (el banco pinta el modal decenas de veces).
Al agotarse: `uxTrack("aviso.presupuesto.agotado")` — el aviso se calla, no
falla. Fall-open: si el almacenaje falla, el aviso se muestra (el presupuesto
no puede tapar la señal clínica por un fallo técnico). No toca colores, tonos
ni reglas clínicas: solo decide cuántas veces al día este aviso puede
interrumpir.

---

## 8. Puntos de integración (v18.3)

| Línea | Qué |
|---|---|
| L5031 | `obsConsultaAbrir(docId)` — cada paciente abierto en Historia Clínica cuenta UNA consulta (dentro de `autoFetchAtheneaLabsForActivePatient`) |
| L12331 | `reportar()` — Fix de reentrancia + `equipo: _equipoId()` |
| L12368 | `obs_perdidos: obsPerdidosLeer().n` — fila de entorno diaria |
| L15413-15414 | `obsAvisoMostrar(...)` / `obsAvisoDesenlace(avisoObsId, "accion")` — aviso universal, con guard `!esPrueba` |
| L34087 | `repPost` de "Probar conexión" usa `_equipoId()` (que delega en `obsIdentidadEquipo`) |
| L50745-51054 | Módulo `obs*` completo |

GM keys nuevas: `vgl_obs_equipo`, `vgl_equipo_id` (legado, migración),
`vgl_obs_equipo_fp`, `vgl_obs_perdidos`, `vgl_obs_presupuesto`.

---

## 9. Qué NO se puede calcular todavía

Hasta que esta versión esté en producción, ninguna métrica de las Fases 2-4 es
computable: adherencia, tasa de finalización, desenlaces de aviso, métrica de
oro. Después del despliegue se necesitan **14 días** de datos para que las
cifras por equipo signifiquen algo (el ciclo semanal completo de la agenda,
incluyendo los sábados de urgencias), y las comparaciones contra la línea base
del prompt 07 (22-ago→4-sep-2026) requieren ventana equivalente.

**Lo que quedó sin verificar:** los desenlaces `cerrado`/`ignorado`/`expirado`/
`silenciado` y la métrica de oro `posterior` tienen las funciones listas
(`obsAvisoDesenlace`/`obsAvisoCumplido`) pero SOLO el desenlace `accion` está
cableado al aviso universal; los demás esperan el inventario de la Fase 4 para
decidir qué aviso emite qué. La migración de los ~891 `catch` existentes a
`obsCatch` es incremental: solo los del módulo lo usan hoy.
