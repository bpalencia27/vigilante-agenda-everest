# TAREA R1 — TFG (Cockcroft-Gault + CKD-EPI 2021), estadio KDIGO y discordancia

> **Cómo se usa:** copia este archivo ENTERO y pégalo como única instrucción en Jules.
> Es autocontenido: no hace falta pegar nada más. Requiere que **R0 (festivos) ya esté
> fusionado** en la rama base — si no lo está, detente y dilo, no la reinventes.

---

## 0. TU PAPEL Y EL LÍMITE DE TU TRABAJO

Eres un ingeniero que hace **una sola tarea acotada** en un repositorio ajeno de producción
clínica. No eres el arquitecto de este proyecto: las decisiones ya están tomadas y **no se
re-litigan**. Tu éxito no se mide por cuánto mejoras el repositorio, sino por **cuán exactamente
haces lo pedido y nada más**.

Esta tarea **calcula y registra en consola** dos fórmulas de función renal y su estadio KDIGO.
**No crea ningún widget visual nuevo, no toca `render()` ni la hoja de estilos.** La superficie
visual definitiva de este cálculo vive en el banner de la Fase T7 (rediseño v14), que es otra
tarea, todavía no encargada. Adelantarte a diseñar esa UI aquí es ampliar el alcance.

---

## 1. CONTEXTO DEL REPOSITORIO

- Repositorio: `vigilante-agenda-everest`.
- Archivo principal: **`vigilante_agenda.user.js`** — un **userscript de Tampermonkey**, **un único
  IIFE de ~11.700 líneas**, sin build, sin dependencias, sin `npm install`.
- Pruebas: `tests/`, sin frameworks. Se corren con **`node tests/runner.js`**.
- **Rama base: `claude/pym-agenda-blindaje-v12-4`**. NUNCA `main`.
- El banco parte de **691 o más** (depende de cuántas sumó R0; corre el runner al empezar y usa
  esa cifra como tu propia línea base — tu PR debe terminar por encima de ella).
- Antes de empezar: `git fetch origin claude/pym-agenda-blindaje-v12-4` y trabaja desde ahí.

Este script lo usan médicos reales en consulta. Un error aquí puede hacer que el médico vea un
estadio renal equivocado.

---

## 2. EL PROBLEMA (por qué existe esta tarea)

El script hoy avisa "laboratorio vencido a los 180 días" para todos los analitos por igual, sin
saber en qué estadio de función renal está el paciente. El proyecto hermano de este mismo
programa clínico (Copiloto RCV, `everest-rcv-copiloto`) ya implementó y **verificó en producción**
las dos fórmulas de TFG y la estadificación KDIGO que hacen falta. Esta tarea **porta esa lógica
ya probada**, no inventa una nueva.

Las dos fórmulas tienen roles distintos, y la distinción es una decisión clínica ya tomada, no
negociable en esta tarea:

- **Cockcroft-Gault (CrCl)** = **estadio ADMINISTRATIVO**. Es la fórmula contra la que están
  escritas las vigencias de laboratorio, los bloqueos KDIGO y la lógica administrativa del
  programa. Usa el **peso REAL del paciente siempre**, aunque en obesidad sobreestime el
  aclaramiento — decisión médica explícita del 2026-08-02 en el proyecto hermano, que aplica
  igual aquí porque es el mismo programa clínico y las mismas reglas administrativas de la EPS.
- **CKD-EPI 2021** = **estadio CLÍNICO**. Es la referencia fisiológica para razonar función
  renal; no usa peso.

Esta tarea **solo calcula y muestra ambas cifras y sus estadios**. No cambia `RCV_VIGENCIA_DIAS`,
no cambia ninguna vigencia, no bloquea ni exige ningún laboratorio. Eso es trabajo de R2/R3, que
vienen después y dependen de esta.

---

## 3. QUÉ HAY QUE HACER, EXACTAMENTE

### 3.1 Las fórmulas — cópialas TAL CUAL, verificadas en el proyecto hermano

Fuente: `everest-rcv-copiloto/servidor_rcv.py` líneas 4763-4794 (Cockcroft-Gault) y
`everest-rcv-copiloto/motor_deterministic.py` líneas 1555-1620 (CKD-EPI 2021 y estadificación),
ya cubiertas por su propio banco de pruebas (`test_formulas_renales.py`,
`test_cockcroft_obesidad.py`). Traduce la aritmética a JavaScript, funciones **puras** (sin DOM,
sin red, sin estado global):

```
cockcroftGault(edadAnios, pesoKg, creatininaSerica, sexo):
  si edad<=0 o peso<=0 o creatinina<=0 o edad>=140 -> devuelve 0 (centinela "no evaluable")
  v = ((140 - edad) * peso) / (72 * creatinina)
  si sexo es femenino -> v *= 0.85
  redondear a 1 decimal

ckdEpi2021(edadAnios, creatininaSerica, sexo):
  si edad<=0 o creatinina<=0 -> devuelve 0
  k = 0.7 si femenino, 0.9 si no
  a = -0.241 si femenino, -0.302 si no
  R = creatinina / k
  F = R^a si R<=1, si no R^-1.200
  e = 142 * F * (0.9938^edad)
  si femenino -> e *= 1.012
  redondear a 1 decimal

estadioKDIGO(tfg):
  tfg>=90 -> "G1"; tfg>=60 -> "G2"; tfg>=45 -> "G3a"; tfg>=30 -> "G3b";
  tfg>=15 -> "G4"; si no -> "G5"

evaluarDiscordanciaTFG(tfgCG, tfgCKD):
  si cualquiera es 0/null -> null (no evaluable)
  compara estadioKDIGO(tfgCG) vs estadioKDIGO(tfgCKD) en la escala G1=1..G5=6
  si la diferencia de posiciones > 2 -> devuelve un objeto con
    { alerta:true, estadioCG, estadioCKD, diferenciaEstadios, mensaje }
  si no -> null
```

Reconocer "femenino" con el mismo criterio que ya usa el archivo para sexo (busca cómo
`BuscarPacienteDetallado` reporta `sexo` hoy — verificado real: cadena `"F"` / `"M"`, ver §3.2).
**No inventes un criterio distinto** al que ya existe en el archivo para otras banderas de sexo.

### 3.2 De dónde salen los datos — evidencia real, verificada

**Edad y sexo — NO hace falta ninguna llamada nueva.** El endpoint
`BuscarPacienteDetallado?idPaciente=<id>` **ya está integrado** en el archivo (dos llamadas
existentes: busca `BuscarPacienteDetallado` en el archivo) y su respuesta real capturada en
consultorio (`captura_agendamiento_oficial_20260810.json` del repo, ya redactada de PHI pero con
la forma intacta) contiene, confirmado:

```json
{ "data": { "edad": 82, "edadAnos": 82, "fecha_Nacimiento": "0001-01-01T00:00:00", "sexo": "F", ... } }
```

`fecha_Nacimiento` puede venir sin dato real (fecha centinela `0001-01-01`) — usa `edad` o
`edadAnos` como fuente principal (son el mismo valor en la captura), y trátalos como ausentes si
son `0`, `null` o no numéricos. **No calcules edad a partir de `fecha_Nacimiento` si trae esa
fecha centinela: sería inventar un dato que el propio endpoint ya está diciendo que no tiene.**

Añade la lectura de `edad`/`edadAnos`/`sexo` en el punto donde el archivo YA llama a
`BuscarPacienteDetallado` (no dupliques la llamada de red; reutiliza la respuesta que ya se
obtiene ahí, o factoriza mínimamente si hace falta compartirla con el punto donde vayas a
calcular la TFG).

**Peso y talla — SÍ requiere una llamada nueva**, porque hoy el archivo no la hace. Evidencia real
capturada en consultorio hoy mismo (12-08-2026), en vivo, con sesión real de Everest:

```
GET /apiviva/APIHCHealth/api/Historicos/ObtenerHistoricoSignosVitales?PacienteId=<id>
```

respuesta real observada (un array, el más reciente primero):

```json
[{"fechaRegistro":"2026-08-12T18:56:06.535-05:00","presionSistolica":120,"presionDiastolica":80,
  "frecuenciaCardiaca":89,"frecuenciaRespiratoria":16,"temperatura":36.0,"saturacionOxigeno":96.0,
  "peso":65.0,"talla":152.0,"imc":28.13}]
```

Usa el **primer elemento del array** (el más reciente) como el registro vigente. Si el array
viene vacío, `peso`/`talla` quedan ausentes — **no inventes un valor por defecto**.

El `PacienteId` que necesita esta llamada es el mismo identificador numérico que ya usa el
archivo en las llamadas a `BuscarPacienteDetallado` — reutilízalo, no derives uno nuevo.

**Creatinina sérica — ya existe.** Es el valor que el script ya extrae de Athenea bajo la clave
`CREATININA` de `RCV_VIGENCIA_KEYS` (línea ~2567). Reutilízalo tal cual: no it vuelvas a pedir.

### 3.3 Cuándo se calcula y qué se hace con el resultado

Sigue el patrón de disparo "una vez por paciente por día" que ya usan `checkLabsVencidos` /
`checkAbandonoPES` (busca ese patrón y el flag `_enModuloHCHealth()` — no lo reinventes).

Si **falta cualquiera** de los datos requeridos por una fórmula (edad, sexo, peso para C-G;
edad, sexo, creatinina para CKD-EPI), esa fórmula concreta **no se calcula** — se registra en
consola qué dato falta, sin adivinar. Esto es exactamente la regla del motor original:
`datos_completos:false → no calcules`.

Cuando SÍ hay datos, registra en consola (con `console.log`, formato legible, un solo bloque, el
mismo estilo de log ya usado en el archivo para otros diagnósticos) algo equivalente a:

```
[Vigilante RCV] TFG — Cockcroft-Gault: 65.2 mL/min (G2, administrativo) ·
CKD-EPI 2021: 58.7 mL/min/1.73m² (G3a, clínico)
```

y si `evaluarDiscordanciaTFG` devuelve alerta, un segundo `console.warn` con el mensaje completo.

**No muestres nada en el DOM, no crees ningún elemento visual, no dispares ningún `alert()`.**
Es deliberado: esto es la capa de cálculo que consumirá T7 más adelante.

---

## 4. LO QUE NO DEBES HACER (leer entero antes de escribir código)

1. **NO toques `RCV_VIGENCIA_DIAS`, `_vigenciaDiasParaAnalito` ni ninguna regla de vigencia
   existente.** Esta tarea no cambia qué se marca como vencido. Eso es R2/R3.
2. **NO crees ningún elemento visual nuevo** (badge, banner, modal, tooltip). Ni un `alert()`.
   Solo `console.log`/`console.warn`.
3. **NO reformatees NADA.** Ni Prettier, ni ESLint `--fix`, ni reordenar funciones, ni cambiar
   comillas, ni normalizar indentación.
4. **NO añadas dependencias**, ni build, ni TypeScript.
5. **NO dupliques la llamada a `BuscarPacienteDetallado`** si el archivo ya la hace en el punto
   donde vas a necesitar edad/sexo — reutiliza esa respuesta.
6. **NO calcules edad a partir de `fecha_Nacimiento`** cuando venga la fecha centinela
   `0001-01-01` — trátala como dato ausente.
7. **NO inventes el campo/endpoint** si `BuscarPacienteDetallado` en tu verificación real no
   trae `edad`/`edadAnos`/`sexo` tal como se documenta en §3.2 — DETENTE y repórtalo en el PR con
   la respuesta real que sí obtuviste, no fuerces el campo documentado.
8. **NO toques ningún otro archivo** salvo `vigilante_agenda.user.js`, el archivo de pruebas
   donde añadas casos, y `tests/INFORME_MUTACIONES.md`.
9. **NO borres ni debilites ninguna prueba existente.**
10. **NO hagas ninguna petición de red real** en las pruebas — usa mocks, como las suites
    existentes (mira `suite_15_interfaz_avanzada.js` para el patrón de mock de
    `BuscarPacienteDetallado`).
11. **NO incluyas ningún dato real de paciente** en código, pruebas, comentarios ni descripción
    del PR. Usa datos inventados evidentes (p. ej. edad 55, peso 70, creatinina 1.1).
12. **NO amplíes el alcance.** Alertas de dosis renal, remisión a nefrología, metas LDL: no son
    esta tarea (son R4/R6). Si ves la tentación de "ya que estoy aquí", no lo hagas.

---

## 5. PRUEBAS (obligatorio, no es opcional)

Crea una suite nueva o extiende una existente de lógica pura (revisa `tests/` y sigue el patrón
de registro de suites ya usado, como en R0). Casos mínimos, con **vectores conocidos** (no
inventados: son los mismos que ya verificó el proyecto hermano):

1. `cockcroftGault(65, 113, 0.55, "F")` — hombre... **verifica el signo del vector real**: mujer
   63 años, 113 kg, creatinina 0.55 → el proyecto hermano documentó **186.8 mL/min** con peso
   real (cítalo como el caso "paciente obesa" — es el que motivó la decisión de usar peso real
   documentada en §2). Usa esos números exactos como caso de prueba.
2. `ckdEpi2021` con un caso hombre y un caso mujer, valores de ejemplo razonables, verifica que
   el resultado cambia con el factor 0.9938^edad y con el multiplicador femenino.
3. `estadioKDIGO`: un valor en cada frontera exacta (90, 89.9, 60, 59.9, 45, 44.9, 30, 29.9, 15,
   14.9) — las fronteras son las que más se rompen por error de "mayor o igual" vs "mayor".
4. `evaluarDiscordanciaTFG`: un caso con diferencia de 2 estadios (no alerta) y uno con diferencia
   de 3 (sí alerta) — el borde exacto es el que hay que probar, no un caso "obviamente distinto".
5. Falta de datos: sin edad → ninguna fórmula se calcula, se registra qué falta, nada revienta.
6. `fecha_Nacimiento` con la fecha centinela `0001-01-01` → no se usa para derivar edad.
7. `ObtenerHistoricoSignosVitales` con array vacío → peso/talla ausentes, sin inventar.

### Prueba de mutación (obligatoria, se verifica en la revisión)

Después de tener todo en verde:
1. Rompe tu propio cambio a propósito (por ejemplo, invierte el operador de una frontera KDIGO,
   o quita el multiplicador femenino).
2. Corre el banco y **comprueba que alguna prueba TUYA se pone roja**.
3. Restaura el código y confirma que vuelve a estar verde.
4. Añade una fila a `tests/INFORME_MUTACIONES.md` siguiendo el formato ya existente.

---

## 6. QUÉ DEBE CONTENER TU PR (formato obligatorio)

Usa **exactamente** estos seis encabezados, en este orden:

```markdown
## 1. Qué cambié
(lista de funciones nuevas y tocadas, con su línea)

## 2. Salida COMPLETA del runner
(pega la salida entera de `node tests/runner.js`, incluida la línea final)

## 3. Pruebas nuevas
(nombre de cada caso añadido y qué comprueba)

## 4. Mutación aplicada
(qué línea rompiste, qué prueba lo detectó, y confirmación de que restauraste)

## 5. Verificación de alcance
(pega `git diff --stat` contra la rama base; confirma que no se tocó ninguna regla de vigencia
 ni se creó ningún elemento visual)

## 6. Hallazgos NO tocados
(cualquier otro problema visto y dejado en paz, o "ninguno" — incluye aquí explícitamente si
 `BuscarPacienteDetallado` NO trajo edad/sexo como documenta §3.2, con la respuesta real que sí
 obtuviste)
```

---

## 7. AUTOVERIFICACIÓN ANTES DE ABRIR EL PR

1. ¿El banco está en verde y por encima de tu línea base de inicio?
2. ¿`git diff --stat` muestra **solo** `vigilante_agenda.user.js`, un archivo de `tests/` y
   `tests/INFORME_MUTACIONES.md`?
3. ¿Creé algún elemento visual, `alert()` o toqué `render()`/CSS? (Debe ser **no**.)
4. ¿Toqué `RCV_VIGENCIA_DIAS` o cualquier regla de vigencia existente? (Debe ser **no**.)
5. ¿Dupliqué la llamada a `BuscarPacienteDetallado` en vez de reutilizar la existente?
   (Debe ser **no**.)
6. ¿Rompí mi cambio y vi una prueba **mía** en rojo?
7. ¿Hay algún dato de paciente real en algún sitio? (Debe ser **no**.)
8. ¿Usé `fecha_Nacimiento` con la fecha centinela para derivar edad? (Debe ser **no**.)

---

## 8. SI TE ATASCAS

- **¿`BuscarPacienteDetallado` no trae `edad`/`edadAnos`/`sexo` como dice §3.2 en tu propia
  verificación?** Párate, repórtalo en la sección 6 del PR con la respuesta real, no inventes
  el campo.
- **¿No encuentras el patrón "una vez por paciente por día"?** Búscalo en `checkAbandonoPES` o
  `checkLabsVencidos` y sigue exactamente ese patrón, no crees uno nuevo.
- **¿Una prueba existente falla y no entiendes por qué?** Párate. Descríbelo en el PR y **no
  modifiques la prueba**.

**Regla final:** ante cualquier duda, el cambio más pequeño que cumple lo pedido es el correcto.
