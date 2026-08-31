# Tanda 7 — los satelites, como tareas de Jules

> **Base de TODAS: `claude/v14-continuacion`.** Una rama y un PR por tarea.
> 19 tareas. Todas crean archivos nuevos, asi que corren las 19 a la vez sin conflicto.
> **Aplican las mismas 14 reglas universales de `TANDA_6_JULES_NOCHE.md`** — leelas antes.

Esto sustituye a los satelites S6, S4 y S3 que iban a correr como enjambres de Gemini.
El unico que sigue siendo enjambre es el **tronco** (`SUPERPROMPT_PRODUCCION_V14.md`),
porque modifica el userscript y ahi las compuertas se ganan el coste.

---

# GRUPO G — Apagado y reversion (era S6)

> Ninguno modifica el userscript. Cuando un diseno exija tocarlo, se emite una **orden de
> cambio** en `docs/cambios-pendientes/NNN-<slug>.md` con el diff propuesto, la razon, y
> los criterios de aceptacion en forma de prueba.

### G1 — Interruptor de emergencia
**Archivo:** `docs/operacion/INTERRUPTOR.md`

El script se distribuye por auto-actualizacion desde un Gist: cuando sube `@version`,
Tampermonkey lo aplica **en los ~20 consultorios a la vez**. Hoy no hay forma de apagarlo a
distancia.

Disena dos cosas:

- **Interruptor local, primero.** Un control que el medico active **en su propio equipo, en
  menos de un segundo, sin red y sin ayuda**: atajo de teclado y boton visible. Es el unico
  apagado garantizado cuando algo va mal en mitad de una consulta. Debe persistir tras
  recargar y ser reversible por el propio medico.
- **Interruptor remoto.** Evalua al menos tres vias y justifica la elegida: archivo de
  estado consultado al arrancar (en el Gist o en el Apps Script del tablero, que ya existe
  con `@connect script.google.com`); publicar una version cuyo cuerpo sea un stub inerte; o
  una bandera devuelta por el endpoint de telemetria existente. Para cada una: **latencia
  real hasta el ultimo consultorio**, que pasa si el canal esta caido, y si quien
  comprometiera ese canal podria **encender** algo ademas de apagar.

**La pregunta central, respondela explicitamente:** si la comprobacion del interruptor **no
se puede hacer** (sin red, endpoint caido), que hace el asistente?

- Apagarse entero deja al medico sin una herramienta de la que depende, por un fallo de red
  que no tiene nada que ver con un bug.
- Seguir funcionando entero significa que una version defectuosa sigue escribiendo en
  historias clinicas justo cuando no puedes alcanzarla.
- **Considera seriamente la respuesta intermedia:** sigue vivo para *leer y avisar*, y las
  **superficies de escritura** quedan deshabilitadas hasta que la comprobacion tenga exito.
  Fallo abierto para lo que informa, fallo cerrado para lo que escribe.

Justificalo por **lo que le pasa al paciente en cada caso**, no por elegancia tecnica. Y
**escala la decision al usuario**: presenta las tres opciones con su consecuencia y una
recomendacion; no la cierres tu.

Cubre tambien: **granularidad** (apaga todo, solo las tres superficies de escritura, o una
sola?) y **auto-degradacion** (N fallos de contrato o M excepciones no capturadas en la
misma sesion entran en modo seguro sin que nadie pulse nada; define N y M y justificalos).

⚠️ **Toda afirmacion sobre lo que Tampermonkey puede o no puede hacer necesita fuente.** La
documentacion oficial es la unica valida; lo que tu creas saber no cuenta. Lo no verificable
se marca `SIN VERIFICAR` y se escala.

---

### G2 — Canario y ventana de publicacion
**Archivo:** `docs/operacion/CANAL_DISTRIBUCION.md`

Tampermonkey no tiene despliegue escalonado. Disena el mas simple que funcione, **o
declaralo inviable con la alternativa operativa** — un canario inexistente pero documentado
como inviable vale infinitamente mas que uno inventado que nadie probo.

- Evalua la via de los **dos Gists**: uno "canario" y uno "estable", donde el equipo canario
  instala desde el `@updateURL` del canario. Sin codigo nuevo. Que se rompe?
- Protocolo: cuanto tiempo en canario antes de promover, que se observa, y **que senal
  concreta autoriza la promocion** — no "que no pase nada", sino una lista.
- **Ventana de publicacion:** nunca en horario de consulta; el canario recibe la version al
  menos un dia habil antes.
- Riesgo del propio Gist: quien puede escribirlo, que pasa si se compromete la cuenta, si un
  atacante con acceso podria ejecutar codigo arbitrario en los equipos de los medicos.

---

### G3 — Plan de reversion
**Archivo:** `docs/operacion/ROLLBACK.md`

**Una pagina. Ejecutable por alguien sin formacion tecnica.**

- Como se vuelve a la version anterior en todos los equipos, y **cuanto tarda en llegar al
  ultimo consultorio**.
- **Prohibido instruir "pegar el codigo".** Pegar crea una copia duplicada en Tampermonkey:
  dos asistentes vivos escribiendo los mismos 13 laboratorios y peleandose el liderazgo
  entre pestanas. La instruccion es siempre **"Importar desde archivo"**, desinstalando
  antes la anterior.
- Cada paso, una accion fisica observable, con su resultado esperado escrito.
- **Que NO revierte el rollback:** las escrituras que ya se hicieron en la historia clinica.
  Enlaza `RECALL_CLINICO.md` como paso obligatorio, no opcional.

**Compuerta de legibilidad — es requisito, no consejo:** cero jerga (`API`, `JSON`, `DOM`,
`endpoint`, `commit`, `hash`, `token`, `cache`, `Gist`, nombres de funcion). Si un concepto
tecnico es inevitable, se explica en la misma frase. Y **tiene que caber en una pagina
impresa**: si no cabe, no sirve — nadie lee dos paginas con la consulta llena.

---

### G4 — Recall clinico
**Archivo:** `docs/operacion/RECALL_CLINICO.md`

El rollback devuelve el codigo; **no deshace lo que ya se escribio en la historia clinica.**
Si una version cruza dos analitos durante tres dias en 20 consultorios, hoy no existe forma
de responder *"a que pacientes?"* — ni clinicamente, ni ante la IPS.

Disena la bitacora local de escrituras efectivas: marca de tiempo **local y de servidor**,
version del script, usuario de Everest en sesion, consultorio, superficie (labs / CUPS /
turno), **identificador de caso seudonimizado** (hash con sal local, **nunca** el documento
en claro), campo destino, valor escrito, y origen del valor.

- La bitacora **no sale del equipo**. Tope de tamano y caducidad definidos.
- Exportacion con un boton, ya filtrada, con advertencia visible de que el archivo puede
  contener datos sensibles.
- La sal se guarda aparte y **el medico puede resolver el hash en su propio equipo**: saber
  "hubo 41 escrituras afectadas" sin poder identificar los casos no sirve de nada — hay que
  poder llamar a esos pacientes.
- El procedimiento en una pagina: *"la version X escribio mal entre el dia A y el dia B, a
  que pacientes y en que campos?"*, con el comando o boton exacto, quien avisa a quien, y en
  cuanto tiempo.

Emite la **orden de cambio** con el diseno y sus criterios de aceptacion en forma de prueba:
simular una jornada, provocar tres escrituras, verificar que la bitacora las reconstruye
completas y que la exportacion **no deja pasar el documento en claro**.

---

### G5 — Runbook
**Archivo:** `docs/operacion/RUNBOOK.md`

Los **10 fallos mas probables en consulta**, como se ven **desde el lado del medico** (no
desde el log), y que hacer.

Saca los candidatos de la evidencia real que ya esta en el repositorio: el historial de
commits de arreglos, `BACKLOG_MEJORAS.md`, los informes de auditoria, y los incidentes
documentados en el propio codigo — bloqueo del navegador por el iframe clon, avisos
repetidos de PyM, panel tapando controles nativos de Everest, sesion de SharePoint vencida
devolviendo la pagina de login con estado 200.

Cada ficha: **que ve el medico** → **que significa** → **que hacer ahora** → **cuando
llamar**. Misma compuerta de legibilidad que G3.

---

### G6 — Verificacion en consulta
**Archivo:** `docs/operacion/VERIFICACION_EN_CONSULTA.md`

Nadie puede probar contra el Everest real — no hay credenciales ni debe haberlas. La
verificacion final la hace el medico, en su equipo, y es el ultimo paso antes de publicar.

Una lista de **15 minutos**, en orden, que cubra al menos: que el panel carga y muestra la
version correcta; que el PyM del dia se lee; que los estados y colores de la agenda
responden; que **los 13 laboratorios caen en la casilla correcta con un caso conocido**; que
una orden CUPS sale bien; que un agendamiento se crea en la agenda correcta; que el
interruptor local apaga; y que el asistente no tapa ningun control de Everest.

Cada punto con **el resultado esperado escrito**, para poder marcar si o no sin interpretar.

---

### G7 — Changelog
**Archivo:** `CHANGELOG.md`

De v12.3.19 (lo que hay en `main`) al estado actual, agrupado por **impacto clinico /
seguridad / rendimiento / interfaz**, en lenguaje que un medico entienda. *"Corrige el codigo
del examen de hemoglobina glicosilada"*, no *"fix(cups): 903426"*.

---

# GRUPO H — Verificacion clinica documental (era S4)

> ⚠️ **Estas cuatro no escriben codigo. Ni una prueba, ni un fixture, ni una linea del
> userscript.** Sus hallazgos viajan como **datos** (`.json`), y otra tarea genera las
> pruebas a partir de ellos.
>
> **La regla que gobierna el grupo entero:** esta **prohibido** validar un codigo CUPS, un
> umbral clinico o una formula contra tu propio conocimiento. Solo cuenta lo contrastado
> contra un archivo presente en `docs/fuentes/`, citando **pagina, seccion y renglon**. Todo
> lo demas se marca `SIN VERIFICAR` **aunque estes seguro**.
>
> "Estar seguro" es precisamente el estado mental que produce un codigo equivocado: este
> proyecto ya tuvo un CUPS mal por un digito (`904426` en vez de `903426`) que nadie detecto
> leyendo el codigo. Se detecto contrastandolo contra la fuente.

### H1 — Extraccion: que dice el codigo hoy
**Archivos:** `docs/clinica/ESPECIFICACION_ACTUAL.json`, `docs/clinica/ESPECIFICACION_ACTUAL.md`

**Fija el commit del que extraes:** registra `git rev-parse HEAD` y el hash del userscript en
la cabecera del JSON. Todos tus numeros de linea se refieren a ese commit.

Extrae **todas** las constantes con consecuencia clinica, cada una con archivo y linea:

- **Los 13 laboratorios** (`WHITELIST_13_LABS`, expuesta como `api.__WHITELIST`): por cada
  entrada, `key`, `names`, `codes`, `resultId`, `dateId`, y las opcionales `excluye`,
  `altIds`, `altDateIds`.
- **Todos los codigos CUPS** que aparezcan en cualquier constante, incluidas las
  agrupaciones de escritura renal y los paquetes de examenes.
- **Motor renal:** coeficientes de la formula implementada, cortes de estadio, y **las
  unidades que espera cada entrada**.
- **Vigencias ERC** por estadio.
- **Festivos:** la tabla y su fecha de vencimiento declarada.
- **Umbrales de decision:** cualquier valor numerico que cambie lo que se le muestra o se le
  ordena al paciente.
- **Reglas de PyM:** que se excluye y por que (`EXCLUDE_PYM`).

Por cada elemento registra ademas **quien lo usa** y **que pasa si esta mal**, en una frase:
cual de las tres superficies de escritura se ve afectada.

---

### H2 — Verificacion contra fuente
**Archivos:** `docs/clinica/CUPS_VERIFICADOS.md`, `docs/clinica/DISCREPANCIAS.json`, `docs/clinica/FUENTES.md`, `docs/clinica/FUENTES_REQUERIDAS.md`

Inventaria `docs/fuentes/`: por cada archivo, nombre, **SHA-256**, tipo de documento,
identificador oficial, fecha de expedicion y vigencia.

**Si `docs/fuentes/` esta vacio o incompleto, no bloquees el trabajo:** marca todo lo que
corresponda `SIN VERIFICAR` y produce `FUENTES_REQUERIDAS.md` — la lista **exacta y
especifica** de que documento hace falta para verificar que elemento. No pidas "la normativa
de CUPS": pide el documento concreto, con su nombre, para que se resuelva en una tarde.

**Prohibido descargar fuentes de internet e incorporarlas por tu cuenta.** Una fuente la
aporta el usuario, que es quien responde clinicamente por ella.

Por cada elemento de H1, un veredicto de estos tres y nada mas:

| Veredicto | Requiere |
|---|---|
| **VERIFICADO** | Archivo de `docs/fuentes/` + su SHA-256 + **cita exacta**: pagina, seccion, tabla, renglon |
| **DISCREPANTE** | Lo mismo, mas el valor de la fuente frente al del codigo |
| **SIN VERIFICAR** | No hay fuente que lo cubra. Declara que documento haria falta |

**Un VERIFICADO sin cita hasta el renglon no es un VERIFICADO.**
**Nunca rellenes un valor que falte.** Si el codigo no tiene un CUPS y la fuente si, eso es
un hallazgo, no una oportunidad de completar.

Cada discrepancia va a `DISCREPANCIAS.json` con `severidad` asignada **por consecuencia**:
ALTA si puede escribir un dato equivocado en la historia clinica, ordenar el examen
equivocado o crear una cita equivocada; MEDIA si degrada lo que ve el medico sin escribir
nada; BAJA en cualquier otro caso. **Toda discrepancia ALTA se reporta en el PR de forma
destacada**, no enterrada en una tabla.

---

### H3 — La especificacion firmable
**Archivos:** `docs/clinica/ESPECIFICACION_CLINICA.md`, `docs/clinica/ESPECIFICACION_CLINICA.json`

Una tabla de **una pagina** con: los 13 laboratorios y sus CUPS, los cortes de estadio
renal, la formula con sus coeficientes y unidades, las vigencias ERC, la regla de exclusion
de PyM, y los umbrales de decision. Cada fila con su estado de verificacion y su fuente.

Encabezado con **version del script, fecha y espacio para la firma del medico responsable.**

A partir de que esa tabla se firme, **la fuente de verdad deja de ser el codigo y pasa a ser
la especificacion.** Es la diferencia entre un asistente clinico y un script.

**Verificacion de coherencia metodologica que debes hacer y documentar:** comprueba si la
formula implementada y el sistema de estadificacion que se le aplica encima corresponden a
la misma magnitud. Cockcroft-Gault estima *aclaramiento de creatinina*; la estadificacion
KDIGO esta definida sobre *tasa de filtracion glomerular estimada*, que habitualmente se
calcula con otra ecuacion. No son la misma cifra.

**No es tu trabajo decidir cual debe usarse, ni "corregirlo".** El medico eligio la formula
deliberadamente. Tu trabajo es que esa decision **quede escrita y firmada con la salvedad
declarada**, en vez de vivir implicita en el codigo.

Al principio, tres cifras: **cuantos elementos verificados, cuantos discrepantes, cuantos sin
verificar.** Si el tercero es grande, esa es la noticia — y es buena, porque hasta hoy nadie
lo sabia.

---

### H4 — Contrato para generar pruebas de conformidad
**Archivo:** `docs/clinica/CONTRATO_PRUEBAS.md`

Como se convierten los dos JSON de H2 y H3 en pruebas:

- Por cada elemento **VERIFICADO**, una prueba de conformidad que afirme que el codigo sigue
  teniendo ese valor. **Es la red que impide que una futura edicion vuelva a meter un CUPS
  equivocado.**
- Por cada **DISCREPANTE**, una prueba roja que falle hoy y pase cuando se corrija.
- Por cada **SIN VERIFICAR**, **ninguna prueba** — no se puede afirmar lo que no se sabe.
- Declara como se detecta que la especificacion y el codigo divergieron despues: que falla, y
  con que mensaje.

---

# GRUPO I — Frontera con la pagina real (era S3)

> El punto ciego que anula el valor de casi todas las pruebas: todas usan un
> `getElementById` simulado. El dia que Everest renombre un `id`, las suites siguen verdes y
> la escritura falla en consulta.

### I1 — El contrato de pagina
**Archivo:** `CONTRATO_DOM.json` + `docs/CONTRATO_DOM.md`

Extrae a una tabla unica **todos** los selectores e ids de los que dependen las tres
superficies de escritura: las 13 casillas de resultado y sus casillas de fecha, los
selectores de tarjeta de la agenda, y los campos de ordenamiento/CUPS.

Formato **legible por maquina**, porque otras tareas lo consumen. Por cada entrada: para que
sirve, que superficie depende de ella, y que pasaria si desapareciera o dejara de ser unica.

**No modifiques el userscript.** Es extraccion.

---

### I2 — Comprobacion previa y modo seguro (orden de cambio)
**Archivo:** `docs/cambios-pendientes/contrato-dom.md`

Disena, **sin implementarlo en el userscript**, la comprobacion previa que deben ejecutar
`injectLabsIntoCronicos()` y el ordenamiento antes de cada tanda:

- Existencia del contenedor, existencia y **unicidad** de cada casilla objetivo, y que sea
  editable (no `readonly`, no `disabled`).
- Si algo falla: **no se escribe nada**, aviso en lenguaje claro (*"Everest cambio la
  pantalla; el asistente no va a escribir para no equivocarse"*), y **modo seguro** — solo
  lectura y avisos — hasta recargar.
- **Prohibido escribir en una casilla no vacia** cuyo contenido no haya puesto el propio
  script en esa sesion: se muestra el valor propuesto y se pide confirmacion. **Nunca se
  sobrescribe lo que escribio el medico.**
- **Todo o nada por paciente:** si el contrato deja de cumplirse a mitad de los 13
  laboratorios, se revierte lo escrito en esa tanda y se informa.

Entrega el diseno con sus **criterios de aceptacion en forma de prueba**.

---

### I3 — Pruebas de rotura de contrato
**Archivo:** `tests/suite_NN_contrato_dom.js` (elige el siguiente numero libre y dilo en el PR)

Por **cada** selector de `CONTRATO_DOM.json`, una prueba que lo renombre, lo duplique o lo
deshabilite y verifique que **no se escribe nada** y que aparece el aviso.

**Un selector sin esa prueba no cuenta como cubierto.**

Como el modo seguro de I2 aun no esta implementado, escribe las pruebas **rojas**, en
`tests/rojas/`, documentando en el PR que fallan a proposito y que linea de produccion las
pondra verdes.

---

### I4 — Arnes de navegador y linea base visual
**Archivos:** `e2e/**`

`tests/` sigue en **Node puro** y es lo unico que compuerta el CI. El estres, el contraste y
el solapamiento viven en **`e2e/` con Playwright, fuera de `npm test`**, ejecutados sobre
`simulador_completo_vigilante.html` — **usalo, no inventes otro arnes**.

- ≥50 iteraciones continuas de interaccion rapida (clics en rafaga, apertura y cierre masivo
  de modales, cambio acelerado de fechas y de especialidad, alternancia de tema) con **0
  excepciones no capturadas**, monitoreado con `page.on("console")` y `page.on("pageerror")`.
- **Linea base de imagen versionada en `e2e/baseline/`** y comparacion por diff. Es lo unico
  capaz de detectar una regresion visual como la del panel tapando el riel de iconos nativo
  de Everest.
- Adjunta la evidencia: salida de consola verbatim y capturas.

---

# GRUPO V — Verificacion adversarial

> Una tarea de Jules es **un** agente, no un enjambre con dos revisores y dos retadores. Estas
> cuatro recuperan parte de esa disciplina: **auditan el trabajo de otras tareas, de forma
> independiente y sin haberlo escrito.**

### V1 — Auditar los PR de la ola A de la tanda 6
**Archivo:** `docs/auditorias/AUDITORIA_OLA_A.md`

Revisa los PR de A1, A2 y A3. Por cada uno comprueba, **ejecutandolo tu mismo**:

- Base correcta (`claude/v14-continuacion`, no una anterior).
- Alcance respetado: `git diff --name-only` contra la base solo lista archivos de su columna.
- **`cubre` honesto**: cada nombre declarado lo invoca alguna prueba de verdad.
- **Las mutaciones son reales**: aplica tu mismo la mutación que dice haber probado y
  confirma que cae la prueba que nombra. Si el banco sigue verde, la mutacion no vale.
- Que no haya "mejorado" nada que nadie pidio.

**No arregles nada.** Veredicto por PR y evidencia con comando y salida verbatim.

---

### V2 — Auditar las suites clinicas (ola C)
**Archivo:** `docs/auditorias/AUDITORIA_OLA_C.md`

Igual que V1 sobre los PR de C1 a C10, con un enfasis anadido: **busca pruebas que pasen sin
ejercitar nada.** Este proyecto acumula nueve casos del mismo fallo — pruebas sin `await`,
aserciones sobre arrays vacios, `t.noLanza` ciegos, guardas que buscan un nombre como texto,
nombres en `cubre` sin prueba.

Por cada suite nueva: cuantas aserciones tiene, cuantas caerian si rompieras la funcion bajo
prueba, y **cuantas pasarian igual**. Esa ultima cifra es el hallazgo.

---

### V3 — Auditar las suites de robustez (ola D)
**Archivo:** `docs/auditorias/AUDITORIA_OLA_D.md`

Igual que V2 sobre D1 a D7.

---

### V4 — Contrastar los informes de la ola E contra el codigo
**Archivo:** `docs/auditorias/AUDITORIA_OLA_E.md`

Los ocho informes de la ola E son afirmaciones sobre el codigo. **Verifica una muestra de
cada uno contra el archivo real** — al menos cinco afirmaciones por informe, elegidas al
azar, con el comando y la salida.

Este proyecto ya tuvo un informe entero fabricado: citaba archivos que no existian en
ninguno de los 721 commits del repositorio. **Un informe que no se contrasta no vale nada.**

Reporta por informe: afirmaciones comprobadas, cuantas resistieron, y cualquiera que no.
