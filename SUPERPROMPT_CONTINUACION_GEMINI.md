# Superprompt de continuación — Vigilante de Agenda Everest

> Pégale esto entero a Gemini (o a cualquier modelo que continúe). Está escrito para que
> alguien sin ningún contexto previo pueda seguir sin romper nada.

---

## 0. Lo primero, porque cambia todo lo demás

Esto **no** es un proyecto de software normal. Es un userscript de Tampermonkey que un
**médico usa EN VIVO durante consultas reales**, en el sistema de historia clínica Everest de
una IPS colombiana. Lo usan también sus compañeros.

El script **escribe en historias clínicas de pacientes reales**. Un número mal puesto no es
un bug: es un dato clínico firmado que puede cambiar una decisión médica.

De ahí salen todas las reglas que vienen. No son preferencias de estilo. Cada una está
escrita porque **algo ya salió mal**.

---

## 1. Las reglas que no se negocian

### 1.1 Ante la duda, la regla NO se aplica
Aplicar una regla que quizá no corresponde es **peor** que no aplicar ninguna: convierte un
valor legítimo en una alarma falsa, y a la tercera alarma falsa el médico deja de mirarlas.

Ejemplo real: un PR fijaba `esDM2: true` para todos los pacientes, para que la regla de HbA1c
"aplicara si corresponde". Consecuencia: a un hipertenso **sin diabetes** le salía la HbA1c
marcada como vencida y un botón "➕ Agregar HbA1c" — un examen que no le corresponde, a un
clic de quedar ordenado. Lo correcto era no pasar el dato y que el analito **no se juzgue**.

### 1.2 La casilla del médico es sagrada
Nada se sobrescribe en silencio. Nunca. Si una casilla ya tiene valor, se respeta entera,
incluida su fecha.

Hay un caso torcido que conviene conocer: **Everest borra sola la casilla de la RAC** al
re-renderizar cuando el médico edita la creatinina a mano. Por eso existe `checkRacGuardia`,
que la restaura. Pero el médico **también** la borra a veces a propósito. La guarda distingue
los dos borrados por *cuándo y cuántas veces*: vive 20 s y tiene cupo de 2 restauraciones.
Pasado cualquiera de los dos límites se apaga para siempre en ese paciente. **El médico gana
el desempate.**

### 1.3 Prohibido validar un CUPS, un umbral o una fórmula contra lo que "sepas"
Solo valen cuatro fuentes, en este orden:

| Nivel | Qué es |
|---|---|
| 1 | Una orden **ya guardada** en Everest (`ObtenerOrdenamientoPorPacienteIdVigente`) |
| 2 | Una respuesta **capturada** del servidor |
| 3 | Un clic **observado**, con el texto literal del `<li>` |
| 4 | El catálogo del propio script, con su comentario de origen |

Si no tienes evidencia de uno de esos cuatro niveles, **pregunta al médico**. No supongas.

Esto no es teórico: el CUPS `903866` estuvo asignado a *triglicéridos* en un repositorio y a
*microalbuminuria* en otro. En realidad es **TGP/ALT** (transaminasa). Un código que suena
plausible ordena el examen equivocado a un paciente real.

### 1.4 Nunca convertir unidades automáticamente
Se rechaza y se informa. La sospecha de unidad es una **sospecha**, no un hecho, y el número
"corregido" acabaría escrito en una historia clínica sin que nadie lo comprobara en el
laboratorio.

Hay una prueba que exige que el aviso al médico **no contenga** el valor convertido.

### 1.5 Cero datos de pacientes, en ningún sitio
Ni en pruebas, ni en fixtures, ni en logs, ni en commits, ni en informes. Si hace falta algo
realista, **se inventa**.

Este proyecto ya tuvo PHI real en el historial de git durante ocho días. Y al preparar el
corpus de grounding se descubrió que cuatro archivos que iban a copiarse a modelos de
terceros contenían **45 apariciones de tres pacientes** por su nombre completo. Ningún patrón
de dígitos lo habría cazado: un nombre no lleva ninguno.

---

## 2. La disciplina de mutación (obligatoria en cada cambio)

Por cada cambio de comportamiento:

1. Romper el código a propósito.
2. Comprobar que una prueba concreta se pone **roja nombrando el caso**.
3. Restaurar. Comprobar verde.
4. Anotarlo en `tests/INFORME_MUTACIONES.md`, fila **al final**, con las cuatro columnas:
   `| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante |`

**Antes de declarar que una mutación "sobrevivió", comprueba dos cosas:**
- que el archivo **cambió de verdad** (un `replace` que no casa parece una mutación
  superviviente y no lo es), y
- que **el medidor funciona**. En esta sesión tres mutaciones dieron "sobrevive" y era
  mentira: el código de salida del banco estaba roto.

**Una mutación que sobrevive no siempre pide una prueba.** Hay tres desenlaces posibles y los
tres han ocurrido aquí:

| Lo que significa | Lo que hay que hacer |
|---|---|
| Falta una aserción | Escribir la prueba |
| Ese código no es alcanzable desde el banco | **Mover el código**, no forzar la prueba |
| Ese código no hace nada | **Borrarlo** |

**Y nunca se cierra una mutación con una prueba que compruebe que la función existe o que
pinta algo.** Eso es una prueba que no puede fallar.

---

## 3. Estado exacto al momento del traspaso

**Repositorio:** `bpalencia27/vigilante-agenda-everest`

| Cosa | Valor |
|---|---|
| `main` | `673b3fc` — **v14.1.9** |
| Banco | **1202 comprobaciones, cero fallos**, 92,4 % de cobertura |
| Suites | 41 |
| Userscript | ~15.150 líneas, un solo archivo |
| Comando | `node tests/runner.js` (código 0 = verde) |

**Fusionar a `main` NO despliega.** El despliegue a los consultorios es manual: pegar el
archivo completo en un Gist secreto y subir `@version`. Ninguna máquina se actualiza sola
hasta que el médico haga eso.

### PR abiertos

| PR | Qué es | Estado |
|---|---|---|
| **#74** | Corpus de grounding (`grounding/`) | **Listo.** Rama `claude/grounding-everest` → `main` |
| **#70** | Arregla el HbA1c del no diabético | **Bueno.** Hizo lo pedido: quitó `esDM2`, añadió la prueba, documentó la mutación |
| #69 | Pruebas renales (Jules) | Sin revisar |
| #68 | Auditoría de funciones huérfanas (Jules, J4) | Sin revisar |
| #66 | Botones de exámenes vencidos | **Superado por el #70** — revisar si aún aporta algo |
| #65, #64, #62 | De Jules/enjambre, sobre bases anteriores | Sin revisar, hay que rebasar |
| #13, #10, #3, #2, #1 | **De v7.x/v8.x** | ⛔ **NO FUSIONAR.** Serían una regresión de años |

---

## 4. Lo que hay que hacer, por orden

### T1 — Fusionar el #74 (grounding)
Está verde y verificado. Solo falta aprobarlo y fusionarlo.

### T2 — Revisar #68 y #69 (Jules)
Son J3 (cobertura) y J4 (auditoría de código sin llamador). Método: fusión real en local,
correr el banco, mutación, y verificación adversarial de cada afirmación del PR.

**Ojo con J4:** su entregable es un **informe**, no un borrado. Algunas funciones estarán a
medio enganchar y otras serán deuda real; la decisión de cuál es cuál se toma con la lista
delante. Este proyecto ha metido código en modo sombra al menos cinco veces.

### T3 — Enganchar las vigencias por estadio en `_analitosRcvVencidos`
El #70 engancha `vigenciaPorEstadio` en el modal renal, pero **`_analitosRcvVencidos`
(línea ~3331) sigue aplicando un plazo plano** `RCV_VIGENCIA_DIAS` para todos, con la única
excepción de la RAC.

Hoy **un paciente en G4 y uno en G1 reciben exactamente el mismo criterio de vencimiento.**
Las tablas oficiales 39/43/50 que el médico pidió que se respetaran al 100 % de forma
determinista se respetan solo a medias.

- El estadio ya se calcula: `calcularEstadioRenal(pacienteId, labsArray)` (línea ~10426).
- `_analitosRcvVencidos` es síncrona; el contexto entra por parámetro, igual que se hizo con
  `injectLabsIntoCronicos(labs, docId, opts)`.
- **Compatibilidad hacia atrás obligatoria:** sin contexto de estadio, el comportamiento tiene
  que ser **idéntico** al de hoy, con prueba explícita.

**La prueba que decide si está bien hecho:** dos pacientes con la MISMA fecha de la MISMA
creatinina, uno en G4 y otro en G1, y se comprueba que a uno se le marca vencida y al otro no.
Sin esa prueba, el enganche no existe.

### T4 — Avisar de las casillas OBLIGATORIAS vacías
La tabla oficial que el script ya lee trae `swRequerido`. En la captura real son **9 de 28**:
HEMOGLOBINA, HBA1C, CREATINURIA, CREATININA, FOSFORO_SERICO, ALBUMINA_SERICA, CALCIO_SERICO,
POTASIO_SERICO y ACIDO_URICO.

Hoy el médico se entera de que le faltaba una casilla obligatoria cuando Everest se lo dice al
guardar, con la consulta ya terminada.

Reglas: se usa el puente `LAB_KEY_A_EXAMEN_EVEREST`; un examen obligatorio **no mapeado no se
reporta** (no hay casilla que mirar, y avisar de algo que no se puede comprobar es una alarma
que el médico no puede atender — CREATINURIA y ACIDO_URICO están en ese caso); solo cuenta la
casilla que **existe y está vacía**; y **no se marca ni se rellena nada**, es solo un aviso.

### T5 — Rebasar o cerrar #62, #64, #65
Apuntan a bases muy anteriores. Decidir uno por uno si aún aportan.

---

## 5. Decisiones que solo puede tomar el médico

**Ninguna de estas la resuelvas tú.** Pregúntale.

1. **¿De dónde sale que un paciente es DM2?** Programa de inscripción, diagnóstico en la
   historia, o preguntárselo en el momento. Mientras no haya respuesta, la HbA1c **no se
   juzga** — el #70 ya lo dejó así, y es lo correcto.
2. **Remediación del historial de git.** Hubo PHI real durante ocho días (commit `206458e7`,
   15 archivos de telemetría). Los tres commits `fix(phi)` **no borraron nada**: un commit de
   redacción añade una versión limpia encima, los blobs viejos siguen accesibles por SHA.
   Reescribir el historial rompería todas las ramas abiertas.
   Atenuante verificado: **el repositorio es privado**.
3. **Publicar la v14.1.9** en el Gist. Ninguna máquina tiene v14.1.5+ todavía.
4. **Capturar la Ruta de Crónicos de un paciente de diabetes y de uno de ERC.** El formulario
   cambia por programa, igual que cambia por sexo (111 campos en hombre, **160 en mujer**), y
   solo hay capturas del programa general.

---

## 6. Las trampas de este repositorio

Cada una costó horas. Léelas antes de escribir una prueba.

### 6.1 El arnés
- `textContent` es una propiedad **estática** que nunca se deriva de `innerHTML`. Lee siempre
  `.innerHTML`.
- Los mocks entran por `cargar({ fetch: ... })`. **Reasignar `c.api.loQueSea` NO intercepta**
  la llamada interna: el script llama a sus funciones por clausura dentro del IIFE. Una prueba
  que mockea así está comprobando otra cosa.
- Todo `t.casoAsync` y toda llamada async a `t.lanza`/`t.noLanza` va con `await`. Hay
  centinelas en la suite 26 que lo exigen.

### 6.2 `Number()` a secas sobre datos de la API
`Number(null)`, `Number("")` y `Number(false)` valen **0**, no NaN. Una sola línea con esto
fabricó **tres alarmas falsas a la vez**: "no acoto por edad" se leyó como "acoto desde los 0
años", el rango `[null,null]` se volvió `[0,0]` (que declara ALTO cualquier valor positivo), y
un resultado vacío del laboratorio salió marcado BAJO. Usa `_numeroEstricto`.

### 6.3 El banco puede mentir de dos maneras distintas
Las dos ya ocurrieron:
- **Salida verde al final aunque hubiera fallos** (arreglado en agosto).
- **Salida verde sin haber terminado**: una promesa que no resuelve deja el bucle de eventos
  vacío y Node **sale solo con código 0**, sin imprimir el resumen y sin correr las suites
  siguientes. Ahora `runner.js` nace en rojo (`process.exitCode = 1`) y solo el final legítimo
  lo pone en verde. **No quites eso.**

### 6.4 Nunca `git add -A` con agentes corriendo
Un agente de verificación sin aislamiento invirtió una condición en el repo compartido y un
`git add -A` la subió a un commit ajeno. De las 11 compuertas de un enjambre grande, **cuatro
fallaron por mutaciones que sus propios agentes dejaron sin restaurar**.

Por eso existe `tests/suite_37_invariantes_criticos.js`: lee el código fuente y exige que las
decisiones que costaron un incidente sigan escritas. **Si falla, no la relajes** — actualiza
la tabla y explica el porqué en el informe de mutaciones.

### 6.5 Los informes de agentes externos se verifican SIEMPRE
Patrón observado en varias tandas: **aciertan en lo estructural y sobrestiman en lo puntual**.
Ejemplos reales de esta sesión: un XSS reportado que **no era explotable** (el `doc_id` pasa
por `extractDoc`, que devuelve solo `\d{5,15}`); un riesgo "ALTO" de caché entre pacientes que
ya estaba cubierto por la clave. Verifica contra el código **y sus comentarios** antes de
actuar.

---

## 7. Dónde está el conocimiento del sistema real

`grounding/` (PR #74) — **léelo antes de tocar nada que hable con Everest.**

- `grounding/README.md` — el índice y la jerarquía de evidencia.
- `grounding/API_EVEREST.md` — los 23 endpoints observados.
- `grounding/esquemas/` — el esquema de petición y respuesta de cada uno.
- `grounding/catalogos/tabla_validacion_examenes_cronicos.json` — las 28 filas oficiales.
- `grounding/mapas/` — inventario de DOM y red por pantalla.

Dos cosas de ahí que hay que tener siempre presentes:

> ⚠️ **Los rangos de la IPS son de PLAUSIBILIDAD, no de normalidad clínica.** La hemoglobina
> se declara plausible entre **3 y 30 g/dL**: un 3,2 cae "dentro" y es una urgencia
> transfusional. Contestan *"¿este número puede ser un resultado de verdad, o es un dedazo o
> una unidad equivocada?"*, nunca *"¿este paciente está bien?"*. **Jamás pintes "dentro" como
> "normal".**

> **La IPS declara la RAC en `mg/g`.** No en mg/mmol. Contestado por la captura real, no por
> suposición.

Y el `citaId` de `GetValidacionExamenCronicos` va en **base64 sin relleno**
(`btoa("1221974")` sin los `=`). En claro, el servidor no encuentra la cita.

---

## 8. Cómo trabajar

1. **Una rama y un PR por tarea.** No mezcles dos tareas en un PR.
2. **Corre el banco antes y después.** `node tests/runner.js`. Código 0 = verde.
3. **Mutación obligatoria**, con su fila en el informe.
4. **No commitees scripts de andamiaje** (`patch_*.py`, `fix_*.sh`). El PR lleva el cambio, no
   la herramienta con que lo hiciste.
5. **Si encuentras algo que contradice este documento, créele al código** y dilo. Este
   documento se escribió en un momento concreto; el repositorio es la verdad.

---

## 9. Lo que NO debes tocar

- Los PR **#1, #2, #3, #10, #13**: son de v7.x/v8.x.
- `RecomendacionesMedicas` y cualquier textarea del médico. **No existe una "casilla de
  Conducta"**: lo que hay es una FILA que `_conductaBuscarYAgregarExamen` añade a la tabla
  `@*FarmacologicoTabla*@`. El único textarea es `RecomendacionesMedicas` y **no se toca en
  absoluto**.
- Las guardas listadas en `tests/suite_37_invariantes_criticos.js`, salvo que sepas
  exactamente qué estás cambiando y lo documentes.

---

## 10. Tu primer paso

```bash
git clone <repo> && cd vigilante-agenda-everest
node tests/runner.js        # tiene que dar 1202 en verde, código 0
cat grounding/README.md     # el sistema real
cat tests/INFORME_MUTACIONES.md | tail -40   # las últimas lecciones aprendidas
```

Si el banco no da verde antes de que toques nada, **para y averigua por qué**. No empieces a
construir sobre un banco que ya está roto.
