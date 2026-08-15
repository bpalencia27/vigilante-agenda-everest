# Tanda 5 — tareas para Jules

Base: rama `claude/v14-continuacion` (v14.1.8, banco en 1032 comprobaciones verdes).
Una rama y un PR por tarea. **No mezclar dos tareas en un PR.**

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
2. **Nunca datos de pacientes.** Ni en pruebas, ni en fixtures, ni en logs, ni en commits.
   Si hace falta algo realista, se inventa.
3. **Prohibido validar un CUPS, un umbral o una fórmula contra lo que tú "sepas".** Solo
   valen: una captura real del consultorio, el catálogo del propio script, o una decisión
   escrita del médico. Si no tienes evidencia, **pregunta**, no supongas.
4. **La casilla del médico es sagrada.** Nada se sobrescribe en silencio, nunca.
5. **Nunca convertir unidades automáticamente.** Se rechaza y se informa.
6. `tests/harness.js`: `textContent` es una propiedad **estática** que nunca se deriva de
   `innerHTML` — lee siempre `.innerHTML`. Los mocks entran por `cargar({ fetch: ... })`,
   nunca reasignando `c.env.win.fetch` después (el script captura `const FETCH0` una vez).
   Todo `t.casoAsync` y toda llamada async a `t.lanza`/`t.noLanza` va con `await`.

---

## J1 — Enganchar las vigencias por estadio (**la más importante de la tanda**)

**El problema, en un dato:** `vigenciaPorEstadio` aparece **4 veces** en
`vigilante_agenda.user.js` — la declaración y tres menciones en comentarios — y **101 veces
en las pruebas**. Tiene **cero llamadores de producción**. La suite 28 se llama literalmente
"Vigencias por estadio renal (R2, sombra)".

Es decir: las tablas oficiales 39/43/50, que el médico pidió que se respetaran al 100 % de
forma determinista, **se respetan solo en el banco de pruebas**. En producción, lo que
decide si un analito está vencido es `_analitosRcvVencidos` (línea ~3331), que aplica un
plazo plano de `RCV_VIGENCIA_DIAS` para todo, con la única excepción de la RAC
(`_vigenciaDiasParaAnalito` la parte por la mitad si hay albuminuria ≥ 30).

Un paciente en G4 y uno en G1 reciben hoy exactamente el mismo criterio de vencimiento.

**Qué hay que hacer:**

1. Hacer que `_analitosRcvVencidos` consulte `vigenciaPorEstadio(programa, estadio, analito, opciones)`
   y use ese plazo cuando exista, cayendo al plazo plano actual cuando devuelva `null`.
2. Para eso necesita programa (`ERC`/`HTA`/`DM2`…) y estadio. El estadio ya se calcula:
   `calcularEstadioRenal(pacienteId, labsArray)` (línea ~10426) devuelve siempre un objeto.
   `_analitosRcvVencidos` es síncrona hoy; el contexto tendrá que entrar por parámetro,
   igual que se hizo en v14.1.8 con `injectLabsIntoCronicos(labs, docId, opts)`.
3. **Compatibilidad hacia atrás obligatoria:** sin contexto de estadio, el comportamiento
   tiene que ser **idéntico** al de hoy. Prueba explícita de eso.

**Lo que decide si esta tarea está bien hecha** (y lo que voy a mirar primero al revisar):
una prueba que tome un paciente concreto en G4 y otro en G1, con la MISMA fecha de la MISMA
creatinina, y compruebe que a uno se le marca vencida y al otro no. Si esa prueba no está,
el PR se devuelve.

**Mutación mínima exigida:** hacer que `vigenciaPorEstadio` devuelva siempre `null` (es
decir, deshacer el enganche). Tiene que caer la prueba G4-vs-G1. Si el banco sigue verde,
el enganche no existe de verdad y estamos donde estábamos.

**Pregunta que sí debes hacerme antes de empezar** (no la resuelvas tú): cuando
`calcularEstadioRenal` no puede determinar el estadio —sin creatinina, sin edad—, ¿el
analito se juzga con el plazo plano, o se deja sin juzgar? Yo tengo una opinión, pero es
una decisión clínica y la firma el médico.

---

## J2 — Avisar de las casillas OBLIGATORIAS que quedan vacías

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
  mirar y decir "falta" sin poder comprobarlo sería una alarma que el médico no puede
  atender. Prueba de eso.
- Solo cuenta como vacía la casilla que **existe y está vacía**. Si el campo no está en esta
  vista, eso ya se reporta por otro camino (`sinCasilla`) y no se duplica.
- **No** se marca nada, **no** se rellena nada. Es un aviso y nada más.

**Mutación mínima:** invertir `swRequerido` (reportar los opcionales en vez de los
obligatorios). Tiene que caer una prueba que nombre un examen obligatorio concreto.

---

## J3 — Pruebas para las nueve funciones sin cubrir

El runner las lista al final de cada corrida. Hoy son nueve:

```
_esSexoFemenino, _ordenesVigentesInvalidar, _demograficosInvalidar,
apiAccesoObtenerDemograficos, _creatininaDeLabs, calcularEstadioRenal,
_renderEstadioRenalHtml, _bannerPymInvalidar, _pymYaOrdenadoHoyDesdeElScript
```

**Ojo con la trampa:** tres de ellas (`_ordenesVigentesInvalidar`, `_demograficosInvalidar`,
`_bannerPymInvalidar`) son invalidadores de caché. Antes de escribirles una prueba,
**comprueba si alguien las llama en producción**. Si no las llama nadie, la respuesta
correcta **no** es escribir una prueba: es reportarlo en el PR para que se decida si se
enganchan o se borran. En v14.1.8 borré una función así antes de subirla, y `_bannerPymInvalidar`
vivió versiones enteras sin un solo llamador (ver v14.0.0 en el informe). Escribirle una
prueba a código muerto lo entierra más hondo.

Para las que sí están vivas, prueba de comportamiento real. `_esSexoFemenino` y
`_creatininaDeLabs` son puras y fáciles; `calcularEstadioRenal` es async y ya tiene el
patrón hecho en la suite 29.

---

## J4 — Auditoría de código sin llamador (informe, **no** borrado)

Lista de todas las funciones declaradas en `vigilante_agenda.user.js` que **no tienen ni un
llamador de producción** (llamadas desde pruebas no cuentan; menciones en comentarios
tampoco). Entrégalo como un `.md` en el PR, con tres columnas: función, línea, y qué crees
que iba a hacer.

**No borres nada en este PR.** Algunas estarán a medio enganchar y otras serán deuda real;
la decisión de cuál es cuál la tomamos con la lista delante. Este proyecto ha metido código
en modo sombra al menos cinco veces y quiero saber cuánto queda.

---

## Lo que NO debes tocar en esta tanda

- `apiHcValidacionExamenCronicos`, `_plausibilidadOficial`, `_objecionOficialAlValor`,
  `_instalarOyenteTablaOficial` y el resto de v14.1.8: acaban de aterrizar con 27
  mutaciones y quiero un par de días de uso real antes de que nadie los mueva.
- Todo lo que esté por debajo de `be6d75a` (v14.1.6): esa base está congelada mientras
  corre otro trabajo en paralelo.
- `RECOMENDACIONESMEDICAS` y cualquier textarea del médico. Sigue valiendo lo que te dije
  en la tanda 4: no existe "casilla de Conducta"; lo que hay es una FILA que
  `_conductaBuscarYAgregarExamen` añade a la tabla `@*FarmacologicoTabla*@`. El único
  textarea es `RecomendacionesMedicas` y no se toca **en absoluto**.
