# Tanda 6 — trabajo nocturno para Jules

> **Base de TODAS las tareas: `claude/v14-continuacion` (v14.1.8).**
> No `main` — está en v12.3.37 y le faltan 217 commits.
> **Una rama y un PR por tarea. Jamás dos tareas en un PR.**
> 31 tareas. Casi todas crean un **archivo nuevo**, así que pueden correr las 31 a la vez
> sin conflicto de fusión. Las tres que tocan archivos existentes están marcadas 🔶 y
> conviene lanzarlas primero y solas.

---

## Reglas universales — no negociables

1. **Base correcta.** `git checkout -b <rama> origin/claude/v14-continuacion`. Si tu rama
   no tiene `tests/suite_30_rangos_oficiales.js` ni `tests/suite_31_labs_rango_oficial.js`,
   estás en la base equivocada: para y rehazla.

2. **Alcance.** Cada tarea dice qué archivos puede tocar. **Tocar uno fuera de esa lista es
   un fallo de la tarea, aunque el cambio parezca bueno.** Si encuentras algo que exige
   cambiar otro archivo, la salida es una prueba roja o una nota en el PR — nunca una
   edición. (Ya pasó tres veces: un `patch_*.py` commiteado, tres funciones de producción
   borradas, y dos nombres metidos en `cubre` sin prueba.)

3. **Si la función no existe, no inventes la prueba.** Las líneas y nombres de este
   documento son orientativos: reubica con `grep -n "function nombreExacto"`. **Si no
   aparece, dilo en el PR y no escribas nada.** Una prueba contra una función inexistente
   es peor que ninguna prueba.

4. **Copia la firma real antes de escribir la llamada.** Ya hubo una prueba llamando
   `apiAccesoBuscarPaciente("CC","12345678")` cuando recibe **un solo argumento**.

5. **El mock de red se inyecta al cargar.** El userscript captura `window.fetch` una sola
   vez (`const FETCH0 = …`). Reasignar `c.env.win.fetch` después de `cargar()` **no hace
   nada**. Vía correcta: `cargar({ fetch: miMock })`. Y **nunca** reasignes sobre `c.api.*`
   después de cargar: el script llama a sus funciones por clausura dentro del IIFE, así que
   no interceptas nada y la prueba queda comprobando otra cosa.

6. **Todo `t.casoAsync` y toda llamada async a `t.lanza`/`t.noLanza` va con `await`**, o el
   centinela de la suite 26 tumba el banco.

7. **Mutación obligatoria.** Por cada comportamiento nuevo cubierto: rompe el código de
   producción a propósito, comprueba que una prueba concreta se pone roja **nombrando el
   caso**, restaura, comprueba verde, y anótalo en `tests/INFORME_MUTACIONES.md` con las
   cuatro columnas de siempre, fila **al final**.
   - **Una mutación que sobrevive NO se cierra escribiendo una prueba que compruebe que la
     función existe o que pinta algo.** Eso es una prueba que no puede fallar.
   - Antes de declarar "sobrevivió", comprueba que el archivo cambió de verdad.

8. **`cubre: [...]` solo lleva funciones que tu prueba invoca de verdad.** Un nombre ahí sin
   prueba sube el contador de cobertura sin una sola aserción. **Es el fallo más repetido de
   este proyecto: no lo cometas.**

9. **Nunca datos de pacientes.** Ni en pruebas, ni en fixtures, ni en logs, ni en commits.
   Si hace falta algo realista, invéntalo.

10. **Prohibido validar un CUPS, un umbral clínico o una fórmula contra lo que tú "sepas".**
    Estas tareas prueban **comportamiento y consistencia interna**, no si un código es el
    correcto — eso lo decide el médico con la fuente oficial delante. Si una prueba tuya
    depende de que un valor sea "el bueno", la has escrito mal.

11. **La casilla del médico es sagrada.** Nada se sobrescribe en silencio. **Nunca conviertas
    unidades automáticamente**: se rechaza y se informa.

12. **No commitees andamiaje** (`patch_*.py`, `fix_*.sh`). El PR lleva el cambio, no la
    herramienta.

13. **Dos limitaciones del entorno simulado:** `DecompressionStream` no existe (construye
    ZIP de prueba con entradas *stored*, `method = 0`), y `document.getElementById` devuelve
    `null` siempre (sustitúyelo por un mapa controlado).

14. **No toques** `docs/seguridad/`, `docs/clinica/`, `docs/operacion/`, `docs/RAMAS.md`,
    `AGENTS.md`, `CLAUDE.md` ni `jules.md`. Son de otros equipos.

---

# OLA A — lo que está en vuelo 🔶

> Estas tres tocan archivos existentes. Lánzalas **primero y solas**, en ese orden.

### A1 🔶 — Cerrar el PR #69
**Archivos:** `tests/suite_27_funcion_renal.js`, `tests/suite_29_estadio_renal_r1b.js`

Dos correcciones sobre lo ya entregado:
1. **Quita de `cubre` los dos nombres que ninguna prueba invoca:** `_signosVitalesInvalidar`
   y `estadioRenalDelPaciente`. Ninguna estaba en la lista de J3, y a la primera la
   clasificaste tú mismo como *deuda muerta* en el informe de J4. Si quieres cubrirlas,
   escribe la prueba; si no, fuera del array.
2. **Rebasa sobre `claude/v14-continuacion`** y vuelve a correr `node tests/runner.js`. Tu
   rama estaba sobre `be6d75a` (v14.1.6): el runner que usaste tiene 3 `await` en vez de 6 y
   las suites 30 y 31 no existen ahí. Confirma verde después de rebasar.

**Lo demás del PR está bien** — alcance respetado, los seis `casoAsync` con `await`,
aserciones reales, y las cinco funciones de J3 ejercitadas de verdad. No lo rehagas.

---

### A2 🔶 — Reemplazo del PR #66 (el arreglo clínico de `esDM2`)
**Archivos:** `vigilante_agenda.user.js` (solo `_evaluarAccionesRenales`),
`tests/suite_08_labs_cronicos.js`, `tests/INFORME_MUTACIONES.md`, `BACKLOG_MEJORAS.md`

Rama nueva desde `claude/v14-continuacion`. Porta las ~127 líneas de
`_evaluarAccionesRenales` del commit `44c9ced` y **arréglalas ahí**. El PR #66 se cierra: su
base es v14.1.5 y le faltan 12 commits, incluido el arreglo de `t.lanza`/`t.noLanza` — no se
puede validar una mutación en una rama donde las aserciones no pueden fallar.

**El defecto:** `vigenciaPorEstadio("ERC", r.estadio, a.tabla, { esDM2: true })` fija DM2
para todo el mundo, anulando la guarda `if (analito === "hba1c" && opts.esDM2 !== true)
return null`. Consecuencia: a un hipertenso sin diabetes le sale la HbA1c vencida y un botón
**"➕ Agregar HbA1c"**, a un clic de quedar ordenado.

**Qué hacer:**
- **No pases `esDM2`.** La fuente real está pendiente de que la decida el médico; **no la
  elijas tú**. Sin ella, `vigenciaPorEstadio` devuelve `null` para hba1c y ese analito no se
  juzga. Callar es correcto; inventar no.
- Quita el `|| false` de `if (!r || !r.estadio || false) return;` — residuo de mutación.
- No commitees `patch_script16.py`.
- La prueba del #66 **nunca existió en el código**: solo se añadió `"_evaluarAccionesRenales"`
  al array `cubre`. Escríbela de verdad.

**Declara en el PR y en `BACKLOG_MEJORAS.md`:** con este arreglo **a nadie** se le juzga la
HbA1c, tampoco a los diabéticos. Es una omisión deliberada y temporal, y es la dirección
segura del error. **No inventes un aviso en la interfaz para compensarlo.**

**Pruebas de aceptación (las dos, o se devuelve):**
- **El no diabético:** sin DM2 confirmado, no hay botón de HbA1c ni se marca vencida.
- **El estadio manda:** mismo analito, misma fecha, G4 vs G1, resultados distintos, vía
  `_evaluarAccionesRenales`. **Usa creatinina, no HbA1c**, para que no dependa de la decisión
  pendiente.

**Mutación 1:** `vigenciaPorEstadio` devuelve siempre `null` → cae la prueba del estadio.
**Mutación 2:** volver a poner `{ esDM2: true }` → cae la del no diabético.

**NO toques `_analitosRcvVencidos`.** Es otra tarea y está en espera.

---

### A3 🔶 — La reja de `cubre` (lo más importante de la noche)
**Archivos:** `tests/runner.js`, `tests/suite_26_banco_sano.js`, `tests/INFORME_MUTACIONES.md`

`cubre: [...]` es una declaración propia, y la compuerta del CI (`MIN_COVERAGE`) cuenta
"funciones cubiertas". **Añadir un nombre al array sube el contador sin una sola aserción.**
Ya pasó tres veces en dos días: PR #66 (`_evaluarAccionesRenales`), PR #69
(`_signosVitalesInvalidar`, `estadioRenalDelPaciente`). El runner valida que el nombre
exista en la API — comprueba que sea real, no que se ejecute.

**Qué hacer:** envuelve el objeto `api` que recibe cada suite en un `Proxy` que registre qué
funciones se invocan de verdad durante la corrida. Al terminar cada suite, **si un nombre de
su `cubre` nunca fue tocado, la suite falla** nombrando el nombre huérfano.

**Cuidado con dos cosas:**
- El `Proxy` no debe cambiar el comportamiento de ninguna función ni su `this`.
- Registra el acceso a la propiedad, no solo la llamada: una función pasada como referencia
  (`arr.map(api.f)`) también cuenta.

**Prueba centinela en la suite 26:** una suite de mentira que declare en `cubre` un nombre
real que no invoca **tiene que hacer fallar el banco**.

**Mutación:** desactiva la comprobación → tiene que caer el centinela.

**Aviso:** al activar esto es probable que el banco se ponga rojo, porque puede haber más
`cubre` huecos de los tres conocidos. **Eso no es un fallo tuyo: es el hallazgo.** Reporta
la lista completa en el PR y **no la arregles metiendo pruebas de relleno** — quitar el
nombre es una respuesta legítima.

---

# OLA B — infraestructura (archivos nuevos, paralelo seguro)

### B1 — Auditoría: cuántos `cubre` están huecos
**Archivo:** `docs/AUDITORIA_CUBRE.md` *(solo lectura sobre el resto)*

Antes de que A3 ponga el banco rojo, dimensiona el daño. Para cada una de las ~31 suites,
cruza su array `cubre` contra las funciones que sus pruebas invocan de verdad. Entrega una
tabla: suite · nombres declarados · nombres realmente ejercitados · **huecos**.

Al final, la cifra que importa: **cuántas de las funciones que hoy cuentan como cubiertas no
lo están.** La cobertura publicada es 355/395; di cuánto de eso es real.

**No modifiques ninguna suite.** Es un informe.

---

### B2 — Reja de archivos prohibidos en CI
**Archivos:** `.github/workflows/` (uno nuevo o el existente), `.gitignore`

En el disco del autor hay archivos `.har` de hasta 34 MB que capturan tráfico HTTP completo
del portal clínico — cookies, tokens y cuerpos de respuesta con datos de pacientes. Un
`git add .` distraído los sube, y ya llegó PHI real al repositorio antes.

**Qué hacer:**
- Un paso de CI que **falle el build** si el commit introduce `*.har`, `*.xlsx`, `*.xls`,
  `*.zip`, `*.csv` o `captura_*.json`.
- Y un segundo paso que falle si un archivo de texto añadido contiene un patrón de
  identificación colombiana (secuencias de 6–12 dígitos con y sin puntos, con prefijos
  `CC`/`TI`/`CE`/`RC`/`PA`) o un teléfono (`3xx`, `+57`).
- Blindar el `.gitignore` con las mismas extensiones.

**Que el mensaje de error diga qué hacer**, no solo que falló.
**No borres nada** de lo que ya esté versionado: solo la reja. Si detectas algo ya dentro,
repórtalo en el PR sin copiar el dato.

---

### B3 — Fuente única de versión
**Archivos:** `.github/workflows/` (paso nuevo), `docs/AUDITORIA_VERSION.md`

La versión vive en `@version` de la cabecera, en `package.json` y en constantes del código.
**Ya se desincronizó**: el commit `5660426` dice *"sube a 14.1.0 — seis tandas de trabajo
salieron etiquetadas 14.0.0"*. Seis versiones distintas publicadas con el mismo número.

**Qué hacer:** inventaría en el `.md` todos los sitios donde aparece la versión, y añade un
paso de CI que **falle si divergen**. No cambies el esquema de versionado: solo detecta.

---

# OLA C — suites clínicas (archivo nuevo cada una, paralelo total)

> Cada una crea `tests/suite_NN_<nombre>.js`. Elige el siguiente número libre y **declara en
> el PR cuál usaste**, para que no choquen entre sí; si dos coinciden, se renumera al fusionar.

### C1 — Los 13 laboratorios: la matriz completa
Construye la matriz de decisión de `_matchLabInWhitelist()` × `WHITELIST_13_LABS`
(`api.__WHITELIST`). Por **cada** entrada: casación por código, por nombre, exclusiones,
alternativas (`altIds`/`altDateIds`), y ausencia de casilla.

**Diez casos obligatorios de no-regresión — cada uno es un incidente real ya ocurrido:**
1. **El código manda sobre el nombre** *(v11.0.1: dependía del orden de recorrido)*.
2. **Exclusiones respetadas al casar por nombre:** `"CREATININA EN ORINA"`, `"CREATINURIA"` y
   `"DEPURACION DE CREATININA 24 H"` **no** caen en creatinina sérica. Los tres.
3. **Triglicéridos y RAC no comparten código** *(v12.0.5: estaban cruzados)*.
4. **RAC** casa por `resultId: "resultadoRelacionAlbuminaCreatinina"`, con `resultadoRAC` solo
   como alternativa; **nunca** `resultadoMicroAlbuminuriaCreatinuria`.
5. **Lab desconocido → `null`.** Solo los 13 autorizados.
6. **No se escriben pendientes:** `idEstado === 1` o `Resultado === "PENDIENTE"` cuenta en
   `pendientes` y no se escribe *(v11.0.1: se escribía "PENDIENTE" como resultado)*.
7. **Primer valor gana en colisión.**
8. **Sin fecha real, la casilla de fecha queda vacía** — nunca la de hoy.
9. **`sinCasilla` acumula** los válidos sin campo en esa vista.
10. **Un paquete solo cuenta como cubierto si están todos sus exámenes.**

> Prueba **comportamiento**, no si un código concreto es el correcto. Si el catálogo cambia
> un código, tu prueba no debe romperse por eso — debe romperse si la lógica de casación
> cambia.

**Mutación:** invierte la precedencia (nombre antes que código) → cae el caso 1.

---

### C2 — `injectLabsIntoCronicos`: qué se escribe y qué no
Sustituye `c.env.doc.getElementById` por un mapa controlado y **afirma qué casilla recibió
qué valor**. Cubre: pendientes no se escriben, primer valor gana, fecha vacía sin fecha real,
`sinCasilla` acumula, y **no se sobrescribe una casilla que ya tenía contenido puesto por el
médico**.

**Mutación:** permite escribir pendientes → cae el caso correspondiente.

---

### C3 — Motor renal: guarda de unidades
La creatinina en mg/dL y en µmol/L difieren en dos órdenes de magnitud. Ya hubo un fallo aquí
(`3b024ef`). Prueba que un valor en unidad implausible **se rechaza y se informa**, y que
**nunca se convierte automáticamente**.

**Mutación:** quita la guarda → cae la prueba del valor implausible.

---

### C4 — Motor renal: bordes de estadio
Cada frontera de estadio probada **por ambos lados y en el valor exacto**. Si el corte es
`X`, prueba `X-ε`, `X` y `X+ε`.

**No inventes los cortes**: léelos del propio código y prueba que el comportamiento en la
frontera es consistente y determinista. Si el código no define un corte claramente, dilo en
el PR en vez de elegir uno.

**Mutación:** cambia un `<` por `<=` → cae la prueba del valor exacto.

---

### C5 — Motor renal: "no calculable"
Peso, edad o sexo ausentes, cero, negativos, no numéricos, `NaN`, `Infinity`. El motor
**no puede devolver un número plausible**: devuelve "no calculable". Y `estadioKDIGO`
**no degrada a G5** por un dato faltante *(fallo real, `3b024ef`)*.

**Mutación:** haz que un dato faltante se trate como cero → cae la prueba de G5.

---

### C6 — Días hábiles
`calcBusinessDaysBefore(iso, daysBefore=5)`: cruces de fin de semana, de mes y de año.
Es la fecha de la toma de muestras: si se equivoca, el paciente va al laboratorio el día que
no es.

**Mutación:** cuenta sábados como hábiles → cae un cruce de fin de semana.

---

### C7 — Festivos vencidos
La tabla de festivos está codificada a mano por años. **Prueba qué pasa cuando vence.**
Tiene que fallar **ruidosamente**, no calcular mal en silencio.

Cubre también el aviso visible de vencimiento (`1407e30`) y que se calcule del propio
contenido de `FESTIVOS`, nunca de un año fijo aparte.

**Mutación:** fuerza `vencida = false` → cae la prueba del aviso.

---

### C8 — El ciclo `horaBonita` ↔ `parseHoraMin`
**El más importante de la ola C.** En producción se guarda `hora_texto = horaBonita(min)`
(`"7:00 a. m."`, con puntos y espacios) y se relee con `parseHoraMin`. **Si esto se rompe,
todas las citas quedan con 0 minutos transcurridos y no salta ni una alerta de fraude, en
silencio.**

Fija `t.igual(api.parseHoraMin(api.horaBonita(420)), 420)` y el caso `"2:30 p. m."`. Recorre
el ciclo completo para todos los minutos de una jornada (6:00 a 20:00, cada 5 min).

Cubre también `format12hTime`: `"00:30"→"12:30 AM"`, `"12:05"→"12:05 PM"`, `"7"→"07:00 AM"`,
y entrada no numérica devuelta tal cual.

**Mutación:** cambia el separador de `horaBonita` → cae el ciclo.

---

### C9 — La máquina de estados de la agenda
Los seis invariantes, uno por prueba:
1. `Atendido` **no** cuenta como llegada; solo `En Sala`.
2. La rama `Atendido` consulta `fraudWatch`, no solo `alertedFraud` *(sin esto, el fraude se
   pintaba VERDE)*.
3. `apptKey` incluye la hora, no solo el documento *(dos citas el mismo día compartían
   estado)*.
4. `diaNuevo()` limpia el estado a medianoche *(una pestaña abierta acusaba al día
   siguiente)*.
5. Solo la pestaña líder registra en bitácora *(filas duplicadas en el reporte)*.
6. Agenda ajena se bloquea.

**Mutación:** haz que `apptKey` use solo el documento → cae el caso 3.

---

### C10 — Zona horaria
Ejecuta el banco con `TZ=UTC`, `TZ=America/Bogota` y `TZ=Asia/Tokyo`. `calcBusinessDaysBefore`,
`apptKey`, `diaNuevo()`, la tabla de festivos y `horaBonita`/`parseHoraMin` deben dar
**resultados idénticos en los tres**.

Busca además todo `new Date("YYYY-MM-DD")` del código: se interpreta en **UTC**, y en Colombia
(UTC−5) puede caer el día anterior. **No lo arregles** — lista cada aparición en el PR y
escribe la prueba que lo demuestra.

---

# OLA D — robustez (archivo nuevo cada una)

### D1 — Excel: `colToIdx` y `findDocIdx`
`colToIdx`: `"A1"→0`, `"B2"→1`, `"Z9"→25`, `"AA1"→26`, `"AB1"→27`, `"ZZ1"`, basura → `-1`.
**Un error aquí desplaza todas las columnas.**
`findDocIdx`: encuentra la columna del documento del paciente. **Si se equivoca, todo el
cruce paciente↔actividades queda corrido.** Prueba encabezados con tildes, mayúsculas,
espacios, columnas duplicadas y encabezado ausente.

**Mutación:** desplaza `colToIdx` en 1 → cae la tabla.

---

### D2 — Excel: `zipIndex` y `zipRead`
Escribe un helper que arme un ZIP mínimo válido **en memoria** con entradas *stored*
(`method = 0`): cabecera local `0x04034b50`, datos crudos, central directory `0x02014b50`,
EOCD `0x06054b50`. Con eso pruebas de verdad sin navegador.

`zipIndex` con un buffer que no es ZIP **debe lanzar** con el mensaje de "formato Excel
(.xlsx) válido". `zipRead` con nombre inexistente devuelve `null` y respeta `maxBytes`.
Prueba también ZIP64 y un ZIP con varias entradas.

---

### D3 — Excel: el parser de filas
`unescXml`, `parseSharedStringsStream`, `parseRowBody`, `scanSheetRows`, `sheetOrder`,
`scoreSheet`.

- `unescXml(null)` lanza `TypeError`: **documenta el contrato real con `t.lanza`, no lo
  "arregles"**.
- `parseSharedStringsStream`: el caso `<si>` con varios `<r><t>` (texto con formato partido
  en trozos — si no los concatena, los nombres salen cortados).
- **El caso crítico:** las hojas reales **dejan huecos en los arreglos** (celdas salteadas) y
  `.map()` los ignora. Ya provocó una caída silenciosa a la hoja equivocada. Prueba que la
  defensa sigue viva.

**Mutación:** quita la defensa de huecos → cae la prueba.

---

### D4 — Fuzzing de funciones puras
`colToIdx`, `unescXml`, `parseHoraMin`, `format12hTime`, `calcBusinessDaysBefore`,
`_matchLabInWhitelist` y el motor renal, con entradas aleatorias y degeneradas: vacío,
`null`, `undefined`, `NaN`, `Infinity`, negativos, strings enormes, unicode, emojis,
inyección, números en notación científica.

**Ninguna puede lanzar una excepción no controlada ni devolver un valor plausible-pero-falso.**
**Documenta las semillas** para que sea reproducible.

---

### D5 — Red degradada
Para cada `GM_xmlhttpRequest` y `fetch` alcanzable: timeout, reintento con backoff, sesión
vencida, y **HTTP 200 devolviendo la página de login** (SharePoint lo hace). La validación
por bytes mágicos `PK` existe justo por eso — verifica que se aplica en **todas** las
descargas, no solo en una.

**Mutación:** acepta cualquier 200 como válido → cae la prueba del login.

---

### D6 — Idempotencia de las escrituras clínicas
`AsignarTurno`, `GuardarOrdenamiento` y la escritura de labs deben ser seguras ante doble
ejecución: doble clic, reintento tras timeout, dos pestañas abiertas, usuario que vuelve
atrás.

**Prueba explícitamente el escenario "la petición sí llegó pero la respuesta se perdió".**
Ya existe cruce antiduplicado contra órdenes vigentes (`1f9bb52`) — verifica que cubre estos
casos.

**Mutación:** quita el candado antiduplicado → cae la prueba del doble clic.

---

### D7 — Identidad de paciente y de médico
Ninguna escritura puede ocurrir sin verificar que el paciente en pantalla es el del payload,
y que la agenda es del médico en sesión. Existen la guarda contra firmar citas con id ajeno
y el switch `SwProgramaEspecial` para médicos de RCV.

**Prueba el intento de evasión, no solo el camino feliz:** cambia el paciente a mitad de la
operación, usa un id de médico ajeno, deja el id vacío.

**Mutación:** quita la guarda de identidad → cae la prueba de evasión.

---

# OLA E — auditorías de solo lectura (un `.md` cada una)

> Ninguna modifica código. Cada una produce su propio archivo bajo `docs/`, así que no
> chocan entre sí ni con nada.

### E1 — `docs/AUDITORIA_CATCH.md`
Hay ~254 `catch`. Clasifica cada uno alcanzable desde las tres superficies de escritura
(los 13 labs, órdenes/CUPS, agendamiento): **(a) recupera de verdad · (b) registra y sigue ·
(c) traga el error en silencio.** Marca los de tipo (c) en rutas de riesgo clínico alto.

**Un fallo silencioso en una ruta que escribe en la historia clínica es peor que uno ruidoso.**

---

### E2 — `docs/AUDITORIA_ESTADO_PERSISTIDO.md`
Inventario de **todas** las claves `localStorage` (~57) y `GM_setValue` (~23), prefijo `vgl_`:
forma del dato, quién escribe, quién lee, ciclo de vida, si caduca, y si está ligada al
usuario en sesión.

Señala en particular: qué pasaría si una versión nueva lee una forma vieja, y si en un equipo
compartido el segundo médico puede heredar agenda o `fraudWatch` del primero.

---

### E3 — `docs/AUDITORIA_FUGAS.md`
~41 `setTimeout`, ~12 `setInterval`, ~94 `addEventListener`. Lista los que se registran sin
desregistrarse, los intervalos que pueden duplicarse al re-renderizar, y las estructuras en
memoria sin tope (bitácora, caché, estado).

Estima qué crece en una jornada de 8 horas. **No arregles nada.**

---

### E4 — `docs/AUDITORIA_XSS.md`
Cada `innerHTML`, `insertAdjacentHTML` y `outerHTML` alcanzable desde las superficies de
escritura, uno por uno. Por cada sitio: ¿el contenido incluye algo que venga del DOM de
Everest, de la API, del Excel, de SharePoint, de Athenea o de los ajustes del usuario? Si sí,
¿está escapado o construido con `textContent`/`createElement`?

`escapeHtml` aparece muchas veces, pero **eso no prueba correspondencia 1:1**. Ya hubo un
hallazgo real (PR #58). Tabla con veredicto por sitio.

---

### E5 — `docs/AUDITORIA_CONECT.md`
Cada `@connect` de la cabecera contra su uso real en el código. `localhost` y `127.0.0.1`
son resto de un puente muerto a `http://localhost:5050`. **Un `@connect` de más es superficie
de ataque regalada.** Propón cuáles retirar; no los retires.

---

### E6 — `docs/AUDITORIA_CODIGO_MUERTO_ESCRITURA.md`
Del informe de funciones huérfanas, **filtra las que tienen capacidad de escritura** sobre
el sistema clínico o sobre la red. Empieza por `apiDigiturnoFinalizarTicket` (línea ~10230),
que llama a `FinalizarTicket` codificando el ID de cita en Base64.

Código muerto con capacidad de escritura es un arma cargada: basta que alguien lo enganche
por error. Por cada una: qué escribiría, dónde, y qué pasaría si se llamara hoy.

---

### E7 — `docs/AUDITORIA_SCRUBPII.md` + suite nueva
**La única de la ola E que sí escribe pruebas**, en su propio archivo de suite.

Intenta romper `scrubPII` con formatos colombianos: puntos de miles, guiones, espacios,
prefijos `CC`/`TI`/`CE`/`RC`/`PA`/`MS`/`AS`, dígitos partidos entre dos nodos de texto,
notación científica, números dentro de URLs, y un identificador seguido de letra sin espacio.

**Cada evasión encontrada = una prueba que falla**, en `tests/rojas/` o marcada claramente en
el PR. **No arregles `scrubPII`** — es ruta sensible y se toca con revisión humana.

⚠️ **Usa identificadores inventados. Ninguno real, ni siquiera parcial.**

---

### E8 — `docs/MAPA_SUBSISTEMAS.md`
Inventario de **todas** las funciones del userscript agrupadas por subsistema (DOM de
Everest, parseo de Excel, SharePoint, notificaciones, liderazgo entre pestañas, telemetría,
motor renal, agendamiento, órdenes, interfaz, persistencia), con línea de inicio, una frase
de propósito, y una columna **Riesgo clínico: ALTO / MEDIO / BAJO**.

**ALTO** = puede escribir un dato equivocado en la historia clínica, ordenar el examen
equivocado, crear una cita equivocada, filtrar datos de pacientes o tumbar Everest.

Genéralo con un script (AST, como hiciste en J4) y **declara el método**. No lo cuentes a
mano.

---

## Al terminar cada tarea

En el mensaje del commit, di **qué mutaciones probaste y que restauraste el código**. Si algo
resultó inviable de probar en el entorno simulado, **dilo explícitamente** en vez de escribir
una prueba que pase sin ejercitar nada.

Y si tu tarea encontró algo fuera de su alcance: **nota en el PR, nunca una edición.**
