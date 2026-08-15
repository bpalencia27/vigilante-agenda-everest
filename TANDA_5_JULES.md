# Tanda 5 — tareas para Jules

Base: rama `claude/v14-continuacion` (v14.1.8, banco en 1032 comprobaciones verdes).
Una rama y un PR por tarea. **No mezclar dos tareas en un PR.**

**Corren en paralelo con el enjambre que está trabajando ahora mismo.** Por eso J1 cambió de
forma respecto a lo que iba a pedirte: el enjambre ya tocó ese código y ahora la tarea es
arreglar lo suyo, no escribirlo de cero. Y en J3 hay dos funciones que ya están cubiertas en
PR abiertos y no debes repetir.

## Reglas que aplican a todas (no negociables)

1. **Mutación obligatoria.** Por cada cambio de comportamiento: romper el código a
   propósito, comprobar que una prueba concreta se pone roja **nombrando el caso**,
   restaurar, comprobar verde, y anotarlo en `tests/INFORME_MUTACIONES.md` con las cuatro
   columnas de siempre (`| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante |`),
   fila **al final** del archivo.
   - Si una mutación **sobrevive**, no siempre falta una aserción. A veces significa que
     ese código no es alcanzable desde el banco (entonces se mueve el código), y a veces
     que el código no hace nada (entonces se borra). Hay ejemplos de los tres desenlaces
     en el informe; léelos antes de decidir.
   - Antes de declarar "sobrevivió", **comprobar que el archivo cambió de verdad**. Un
     `replace` que no casa parece una mutación superviviente y no lo es.
   - **Una mutación que sobrevive NO se cierra escribiendo una prueba que compruebe que la
     función existe o que pinta algo.** Eso es una prueba que no puede fallar. La prueba
     tiene que caer con la mutación puesta; si no cae, no sirve.
2. **Nunca datos de pacientes.** Ni en pruebas, ni en fixtures, ni en logs, ni en commits.
   Si hace falta algo realista, se inventa.
3. **Prohibido validar un CUPS, un umbral o una fórmula contra lo que tú "sepas".** Solo
   valen: una captura real del consultorio, el catálogo del propio script, o una decisión
   escrita del médico. Si no tienes evidencia, **pregunta**, no supongas.
4. **La casilla del médico es sagrada.** Nada se sobrescribe en silencio, nunca.
5. **Nunca convertir unidades automáticamente.** Se rechaza y se informa.
6. **No commitees scripts de andamiaje** (`patch_*.py`, `fix_*.sh` y parecidos). El PR
   lleva el cambio, no la herramienta con que lo hiciste.
7. `tests/harness.js`: `textContent` es una propiedad **estática** que nunca se deriva de
   `innerHTML` — lee siempre `.innerHTML`. Los mocks entran por `cargar({ fetch: ... })`,
   nunca reasignando funciones sobre el objeto `api` después de cargar: **el script llama a
   sus funciones por clausura dentro del IIFE, así que reasignar `c.api.loQueSea` NO
   intercepta la llamada interna** y la prueba queda comprobando otra cosa. Todo
   `t.casoAsync` y toda llamada async a `t.lanza`/`t.noLanza` va con `await`, o el centinela
   de la suite 26 tumba el banco.

---

## J1 — Arreglar el enganche de vigencias por estadio del PR #66 (**la más importante**)

**Contexto:** `vigenciaPorEstadio` llevaba desde que se escribió sin un solo llamador de
producción — 101 referencias, todas en pruebas, y la suite 28 se llama literalmente
"Vigencias por estadio renal (R2, sombra)". Las tablas oficiales 39/43/50, que el médico
pidió que se respetaran al 100 % de forma determinista, se respetaban **solo en el banco**.

El PR **#66** (`feat/boton-conducta-...`, "Sentinel: add action buttons for expired renal
labs") ya la engancha desde `_evaluarAccionesRenales`. Es el primer llamador real. Tu tarea
**no** es reescribirlo: es arreglarlo.

### El defecto clínico que hay que corregir

```js
const vigenciaDias = vigenciaPorEstadio("ERC", r.estadio, a.tabla, { esDM2: true });
// comentario del propio PR: "Asumimos DM2 true para que hba1c aplique si corresponde"
```

`vigenciaPorEstadio` tiene esta línea, puesta a propósito:

```js
if (analito === "hba1c" && opts.esDM2 !== true) return null;
```

Ese `return null` existe para que a un paciente **no diabético** no se le juzgue la HbA1c
con la regla de DM2. Fijar `esDM2: true` para todo el mundo lo anula. Consecuencia
concreta: a un hipertenso sin diabetes le sale la HbA1c marcada como vencida y un botón
**"➕ Agregar HbA1c"** — un examen que no le corresponde, a un clic de quedar ordenado.

Es el mismo patrón por el que se rechazó el PR #63: aplicar una regla que quizá no
corresponde. Ante la duda, la regla NO se aplica.

### Lo que hay que hacer

1. **`esDM2` sale del paciente, no de una constante.** ⚠️ **La fuente exacta está pendiente
   de que la decida el médico. NO la elijas tú.** Mientras no haya respuesta, el
   comportamiento correcto es **no pasar `esDM2`**, con lo que `vigenciaPorEstadio` devuelve
   `null` para hba1c y ese analito simplemente no se juzga. Callar es correcto; inventar no.
2. Arreglar lo demás del #66 que no pasa el listón:
   - `if (!r || !r.estadio || false) return;` — el `|| false` es residuo de una mutación sin
     limpiar. Fuera.
   - `patch_script16.py` no va en el repo.
   - El `t.casoAsync` de la prueba nueva va **sin `await`**: el centinela de la suite 26 lo
     detecta y tumba el banco.
   - La prueba mockea con `c.api.apiHcObtenerOrdenamientosVigentes = ...`. Eso **no
     intercepta** la llamada interna (ver regla 7). Hay que rehacer el mock por
     `cargar({ fetch: ... })`.
   - La fila que ese PR añadió al informe de mutaciones dice "¿Sobrevivió? **Sí**" y la
     cierra con una prueba que comprueba que los botones se crean. Esa prueba no puede
     fallar. Rehacer la mutación y cerrarla de verdad.
3. Extender el enganche a `_analitosRcvVencidos` (línea ~3331), que es el otro sitio donde
   hoy se decide si un analito venció y sigue aplicando un plazo plano de
   `RCV_VIGENCIA_DIAS` para todos (con la única excepción de la RAC, que
   `_vigenciaDiasParaAnalito` parte por la mitad si hay albuminuria ≥ 30). Hoy un paciente
   en G4 y uno en G1 reciben exactamente el mismo criterio.
   - El estadio ya se calcula: `calcularEstadioRenal(pacienteId, labsArray)` (línea ~10426)
     devuelve siempre un objeto.
   - `_analitosRcvVencidos` es síncrona; el contexto entra por parámetro, igual que se hizo
     en v14.1.8 con `injectLabsIntoCronicos(labs, docId, opts)`.
   - **Compatibilidad hacia atrás obligatoria:** sin contexto de estadio, el comportamiento
     tiene que ser **idéntico** al de hoy, con prueba explícita.

### Lo que decide si esta tarea está bien hecha

Dos pruebas. Si falta cualquiera de las dos, el PR se devuelve:

- **G4 vs G1:** dos pacientes con la MISMA fecha de la MISMA creatinina, uno en G4 y otro en
  G1, y se comprueba que a uno se le marca vencida y al otro no.
- **El no diabético:** un paciente sin DM2 confirmado **no** recibe botón de HbA1c ni la ve
  marcada como vencida.

**Mutación mínima exigida:** hacer que `vigenciaPorEstadio` devuelva siempre `null`. Tiene
que caer la prueba G4-vs-G1. Si el banco sigue verde, el enganche no existe de verdad.

**Segunda mutación exigida:** volver a poner `{ esDM2: true }`. Tiene que caer la prueba del
no diabético.

---

## J2 — Avisar de las casillas OBLIGATORIAS que quedan vacías

*(Esta no choca con nadie. Puedes empezarla ya.)*

La tabla oficial que v14.1.8 ya lee (`GetValidacionExamenCronicos`) trae un campo que
todavía no se usa: **`swRequerido`**. En la captura real del 12-08-2026 son **9 de los 28**:
HEMOGLOBINA, HBA1C, CREATINURIA, CREATININA, FOSFORO_SERICO, ALBUMINA_SERICA,
CALCIO_SERICO, POTASIO_SERICO y ACIDO_URICO.

Fíjate en que **CREATINURIA y ACIDO_URICO no están mapeados** en
`LAB_KEY_A_EXAMEN_EVEREST` (no están en `WHITELIST_13_LABS`). Ese es justo el caso del
punto siguiente, y no es teórico.

Hoy el médico se entera de que le faltaba una casilla obligatoria cuando Everest se lo dice
al guardar, con la consulta ya terminada.

**Qué hay que hacer:** tras un Auto-Labs, listar las casillas que la IPS marca como
obligatorias y **siguen vacías** en el DOM, y decírselo en el mismo aviso que ya sale.

**Detalles que no son opcionales:**

- Se usa el puente `LAB_KEY_A_EXAMEN_EVEREST` que ya existe (v14.1.8). Un examen obligatorio
  que **no** esté mapeado a una clave del script **no se reporta**: no tenemos casilla que
  mirar, y decir "falta" sin poder comprobarlo sería una alarma que el médico no puede
  atender. Prueba de eso.
- Solo cuenta como vacía la casilla que **existe y está vacía**. Si el campo no está en esta
  vista, eso ya se reporta por otro camino (`sinCasilla`) y no se duplica.
- **No** se marca nada, **no** se rellena nada. Es un aviso y nada más.

**Mutación mínima:** invertir `swRequerido` (reportar los opcionales en vez de los
obligatorios). Tiene que caer una prueba que nombre un examen obligatorio concreto.

---

## J3 — Pruebas para las funciones sin cubrir

*(Puedes empezarla ya, con las exclusiones de abajo.)*

El runner las lista al final de cada corrida. Hoy son nueve:

```
_esSexoFemenino, _ordenesVigentesInvalidar, _demograficosInvalidar,
apiAccesoObtenerDemograficos, _creatininaDeLabs, calcularEstadioRenal,
_renderEstadioRenalHtml, _bannerPymInvalidar, _pymYaOrdenadoHoyDesdeElScript
```

**Dos exclusiones, porque ya hay PR abiertos:**

- `_pymYaOrdenadoHoyDesdeElScript` — ya la cubre el **PR #60**. No la toques.
- No metas mano en `panelActivities` / `isPanelHiddenActivity` — el **PR #62** las borra.

**Ojo con la trampa de los invalidadores:** tres de las que quedan
(`_ordenesVigentesInvalidar`, `_demograficosInvalidar`, `_bannerPymInvalidar`) son
invalidadores de caché. Antes de escribirles una prueba, **comprueba si alguien las llama en
producción**. Si no las llama nadie, la respuesta correcta **no** es escribir una prueba: es
reportarlo en el PR para que se decida si se enganchan o se borran. En v14.1.8 se borró una
función así antes de subirla, y `_bannerPymInvalidar` vivió versiones enteras sin un solo
llamador (ver v14.0.0 en el informe). Escribirle una prueba a código muerto lo entierra más
hondo.

Para las que sí están vivas, prueba de comportamiento real. `_esSexoFemenino` y
`_creatininaDeLabs` son puras y fáciles; `calcularEstadioRenal` es async y ya tiene el
patrón hecho en la suite 29.

---

## J4 — Auditoría de código sin llamador (informe, **no** borrado)

*(Puedes empezarla ya. Solo produce un `.md`, no toca código.)*

Lista de todas las funciones declaradas en `vigilante_agenda.user.js` que **no tienen ni un
llamador de producción** (llamadas desde pruebas no cuentan; menciones en comentarios
tampoco). Entrégalo como un `.md` en el PR, con tres columnas: función, línea, y qué crees
que iba a hacer.

**No borres nada en este PR.** Algunas estarán a medio enganchar y otras serán deuda real;
la decisión de cuál es cuál se toma con la lista delante. Este proyecto ha metido código en
modo sombra al menos cinco veces y queremos saber cuánto queda.

---

## Lo que NO debes tocar en esta tanda

- `apiHcValidacionExamenCronicos`, `_plausibilidadOficial`, `_objecionOficialAlValor`,
  `_instalarOyenteTablaOficial` y el resto de v14.1.8: acaban de aterrizar con 27
  mutaciones y necesitan un par de días de uso real antes de que nadie los mueva.
- Todo lo que esté por debajo de `be6d75a` (v14.1.6): esa base está congelada mientras corre
  el trabajo en paralelo.
- `RecomendacionesMedicas` y cualquier textarea del médico. Sigue valiendo lo que se te dijo
  en la tanda 4: **no existe "casilla de Conducta"**; lo que hay es una FILA que
  `_conductaBuscarYAgregarExamen` añade a la tabla `@*FarmacologicoTabla*@`. El único
  textarea es `RecomendacionesMedicas` y no se toca **en absoluto**.
