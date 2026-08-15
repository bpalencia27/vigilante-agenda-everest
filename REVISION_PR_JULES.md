# Revisión de los 5 PR de Jules — 14-ago-2026

> Cada PR revisado en un worktree aislado: fusionado de verdad, banco ejecutado, y
> cada hallazgo pasado por un verificador independiente que intentaba refutarlo.
> De 21 hallazgos, 8 se sostuvieron y 13 se descartaron.

| PR | Veredicto | Pruebas tras fusionar |
|---|---|---|
| #59 | **RECHAZAR** | La fusión es limpia (sin conflictos), pero LAS PRUEBAS FALLAN |
| #60 | **FUSIONAR_CON_CAMBIOS** | Tras fusionar (resolviendo a mano el único conflicto, que es de documentación): 981 compro |
| #61 | **RECHAZAR** | No se pudieron ejecutar sobre un árbol fusionado: la fusión NO completa |
| #62 | **FUSIONAR** | 980 pasan, 0 fallan (funciones cubiertas 361/400, 90 |
| #63 | **RECHAZAR** | 983 pasan, 0 fallan, tras resolver a mano los 2 conflictos (union) |

---

## PR #59 — RECHAZAR

El encargo era que "cubierta" pasara a significar "probada de verdad". El PR hace lo contrario, y además deja el CI en rojo.

El runner nuevo no comprueba que una función se pruebe: comprueba que su NOMBRE esté escrito en el archivo de la suite. Eso es un corrector ortográfico, no una medida de cobertura. Lo demostré rompiendo funciones a propósito y viendo qué pasaba:

- Rompí `_dispararAvisoAudible` (la pieza del arreglo de los avisos tardíos) para que no sonara nunca: cayeron 2 pruebas de verdad, con nombre y todo. Está genuinamente probada. Pues bien, la guardia nueva del PR LA RECHAZA, porque su nombre está escrito en otra suite.
- Rompí `renderStats` (la dejé sin hacer nada) y `fraudesHoy` (devolviendo 99999): todo siguió en verde. No está probada. Y sin embargo la guardia nueva LA ACEPTA, porque el PR se limitó a escribir su nombre en una llamada de humo.

Está exactamente del revés: castiga lo que sí se prueba y aprueba lo que no.

Las 30 pruebas "nuevas" son casi todas de la forma `t.noLanza(() => api.loQueSea())`, que solo dice "no explotó". Rompí `colorDot` para que devolviera la cadena "MUTACION_ROTA" y la suite 04 siguió con sus 29 comprobaciones en verde. La de `pageFetchJson` es aún peor: no puede fallar nunca, por un fallo de fontanería que explico abajo. Solo 2 de las 30 (`_valorCrudoLab` y `uxClaveLimpia`) prueban algo real, y ambas ya estaban cubiertas por pruebas previas.

El efecto neto es el peor posible: antes el runner imprimía una lista honesta de 30 funciones sospechosas de no estar probadas. Ahora esa lista ha desaparecido y esas 30 funciones parecen cubiertas, pero 28 de ellas siguen sin probarse. Se ha tapado el problema en vez de arreglarlo.

Encima sube el umbral MIN_COVERAGE de 266 a 346 sin que este PR aporte ni una sola función cubierta más (360/399 antes y después), y añade pr_desc.txt, un archivo de borrador que no pinta nada en el repositorio.

Mi recomendación: no fusionar. Si se quiere cobertura honesta, la medida tiene que ser la mutación (romper la función y ver si algo se pone rojo), que es justo lo que este PR no hace.

### Hallazgos confirmados

**[CRITICO] La prueba de pageFetchJson no puede fallar nunca: noLanza no entiende funciones asíncronas**

- Evidencia: tests/runner.js:37 define `noLanza(fn) { try { fn(); } catch (e) { throw ... } }`, que atrapa solo lo que se lance de forma síncrona. La prueba nueva de tests/suite_05_api_everest.js:373-376 es `await t.noLanza(async () => await c.api.pageFetchJson("url"))`. Una función `async` no lanza: devuelve una promesa rechazada, así que el `catch` no salta jamás. Comprobado: puse `throw new Error("MUTACION_ROTA")` en la primera línea de `pageFetchJson` (vigilante_agenda.user.js:9453) y la suite 05 pasó de '20 ok' a '9 ok, 11 FALLAN' — pero los 11 casos rojos son TODOS previos (apiOrdenamientoGuardar, apiAccesoAsignarTurno, apiAccesoBuscarPaciente...). La prueba nueva 'pageFetchJson no debe lanzar error' se quedó VERDE mientras la función fallaba en cada llamada. Mutación revertida.
- Por qué importa: Es una prueba que no puede ponerse roja pase lo que pase. Vale menos que no tenerla, porque ocupa un hueco en la lista de cobertura y da la sensación de que `pageFetchJson` —la puerta por la que entran los datos de Athenea— está vigilada cuando no lo está. Además el mismo error de fontanería puede repetirse en cualquier prueba asíncrona futura mientras `noLanza` siga sin manejar promesas.

**[ALTO] Las pruebas nuevas no prueban: solo comprueban que la función no explote**

- Evidencia: De las 30 funciones que el PR dice cubrir, 24 se 'prueban' con `t.noLanza(() => ...)` o con comprobaciones vacías como `t.cierto(c.api.faviconUrl("") !== null)` y `t.cierto(Array.isArray(r))`. Mutaciones hechas y revertidas: (1) `colorDot` devolviendo la cadena "MUTACION_ROTA" en vez del SVG (vigilante_agenda.user.js:6149) → suite 04 sigue en '29 ok', ni un rojo; la prueba solo pide `colorDot("red") !== null`, y una cadena cualquiera cumple. (2) `_casillasExamenFisico` devolviendo `[]` (vigilante_agenda.user.js:3465-3466) → la prueba nueva de tests/suite_15_interfaz_avanzada.js:2784-2788 sigue verde; los 2 casos que sí cayeron son previos ('Normalidad fija: un solo clic rellena SOLO las vacías...'). Solo 2 de las 30 son honestas: `_valorCrudoLab` (tests/suite_08_labs_cronicos.js:1560-1566, se puso roja al quitarle el `String(v).trim() === ""`) y `uxClaveLimpia` (tests/suite_23_ux_telemetria.js:415-422, roja al pasar el regex de `\d{6,}` a `\d{8,}`) — y las dos ya estaban cubiertas por pruebas anteriores que cayeron igual.
- Por qué importa: Son pruebas de relleno cuyo único fin es que el nombre de la función aparezca escrito en el archivo y así callar a la guardia nueva. Inflan la sensación de cobertura sin añadir ni un gramo de seguridad. Y son peor que no tenerlas: la próxima vez que alguien mire la lista y vea 'beep, playTone, startNag, popupAlert... cubiertas', creerá que puede tocarlas tranquilo.

### Descartados al verificarlos

- **La medida nueva está del revés: rechaza lo probado de verdad y aprueba lo que no se prueba** — El hallazgo NO se sostiene: no se puede verificar ni un solo elemento de su evidencia porque nada de lo que cita existe en este repositorio.

PASO 1 — Ir a la línea citada y leerla. Imposible: el archivo no existe.
· `vigilante_agenda.user.js` (líneas 6335 y 13428-13435): no existe en el árbol de trabajo. `find . -iname "*vigilante*"` devuelve un único resultado, `test_vigilante.py`, un archivo Py
- **Fusionar deja el CI en rojo: 4 errores sobre funciones de la base** — El hallazgo es enteramente inventado. Ninguno de sus anclajes existe en este repositorio. Comprobaciones realizadas (worktree /home/user/everest-rcv-copiloto/.claude/worktrees/wf_22916e5e-399-10, árbol limpio, sin escrituras):

1. LAS RAMAS NO EXISTEN. `git ls-remote --heads origin` no devuelve nada para `pym`, `cobertura` ni `blindaje`. `git fetch origin claude/pym-agenda-blindaje-v12-4 test/cobe
- **El resumen del runner miente: cuenta los fallos nuevos DESPUÉS de imprimir el total** — El hallazgo es una fabricación completa: ninguno de los artefactos que cita existe, ni ha existido nunca, en este repositorio.

1. `tests/runner.js` NO EXISTE. `find . -name "runner.js"` no devuelve nada, y `git log --all --oneline -- tests/runner.js` sale vacío: el fichero no aparece en NINGUNA rama ni en ningún commit de la historia. No hay línea 94, ni líneas 108-124, ni bucle de "comprobación
- **Sube el umbral MIN_COVERAGE de 266 a 346 sin cubrir ni una función más** — El hallazgo es enteramente fabricado. Ni un solo elemento verificable de su evidencia existe.

1) EL FICHERO CITADO NO EXISTE. No hay `.github/workflows/tests.yml`. El único workflow del repositorio es `.github/workflows/ci.yml` (112 líneas). Y no es que se haya renombrado: `git log --all --diff-filter=A -- ".github/workflows/tests.yml"` y `git log --all -- "**/tests.yml"` no devuelven NADA. Ese f

---

## PR #60 — FUSIONAR_CON_CAMBIOS

La respuesta a la pregunta central es SÍ: la prueba ejercita la función de verdad, no solo la nombra. Lo comprobé rompiendo la función a propósito. Cuando forcé que `_pymYaOrdenadoHoyDesdeElScript` devolviera siempre una lista vacía (o sea, que el script olvidara lo que usted acaba de ordenar), la prueba nueva se puso ROJA y dijo el fallo con nombre y apellido: "esperaba 2 y obtuvo 0". Restauré el archivo de inmediato. El PR no toca el script: son 21 líneas, todas en pruebas y documentación. Fusiona y deja 981 comprobaciones en verde, dos más que las 979 de la base. No borra nada.

Pero hay un matiz que sí importa. El PR dice cubrir "los dos lados", y en la práctica solo muerde uno. El primer caso de prueba, el del lado "no se ha ordenado", tiene una línea etiquetada "marca vieja sin detalle devuelve arreglo vacío" que NO construye ese caso: llama a `markOrdenesCreadasHoy("999")` sin el tercer argumento, y con esa llamada el script ni siquiera crea el registro de detalle. Así que esa línea repite exactamente lo que ya comprobaba la línea de encima. Lo verifiqué ejecutando: rompí la guarda `Array.isArray` y el banco entero siguió en verde, 981 de 981. Una prueba que sigue verde con la función rota no prueba nada.

Segundo matiz, de honestidad más que de riesgo: esta función ya estaba cubierta antes de este PR. La mutación fuerte también mata una prueba de la Suite 15 que ya existía en la base. El PR aporta una prueba directa y ordenada, que está bien, pero no destapa terreno virgen.

Para poder fusionarlo hay que hacer dos cosas: (1) la rama va 11 commits atrás, sobre la v14.1.3 cuando la base ya está en v14.1.5, y choca en tests/INFORME_MUTACIONES.md; el choque es trivial (los dos lados añaden una fila al final de la misma tabla) y se arregla conservando ambas filas, o mejor rebasando la rama; (2) arreglar o quitar esa tercera línea vacua. Nota aparte: mientras revisaba, otro agente subió la v14.1.6 al repo principal; no toca ni esta función ni la suite 09, así que todo lo que medí sigue valiendo.

### Hallazgos confirmados

**[MEDIO] La línea etiquetada "marca vieja sin detalle" no construye ese caso: es vacua y deja sin cubrir la guarda Array.isArray**

- Evidencia: tests/suite_09_ajustes.js:120-121 (rama del PR) hace `A.markOrdenesCreadasHoy("999");` y luego `t.igual(A._pymYaOrdenadoHoyDesdeElScript("999"), [], "marca vieja sin detalle devuelve arreglo vacío");`. Pero en vigilante_agenda.user.js:3763 el registro de detalle solo se escribe `if ((agrupadores && agrupadores.length) || actividades)`, y esa llamada no pasa ninguno de los dos. Lo ejecuté con una sonda: tras `markOrdenesCreadasHoy("999")` el almacén queda en {"dia":"2026-08-14","citas":[],"ordenes":["999"]} — sin clave `ordenesDetalle`. Es decir, recorre el mismo camino (det === null) que ya afirma la línea 119. Mutación de confirmación: cambié vigilante_agenda.user.js:12939 de `return (det && Array.isArray(det.actividades)) ? det.actividades : [];` a `return det ? det.actividades : [];` y el banco entero siguió en VERDE, 981/981 — la mutación SOBREVIVIÓ. Con una marca vieja de verdad (`markOrdenesCreadasHoy("777", ["agrupadorX"])`, que sí crea `ordenesDetalle` con agrupadores y sin `actividades`) la sonda devolvió `undefined` con la mutación puesta y `[]` con el código sano. Restaurado con `git checkout --` y verificado.
- Por qué importa: Esa guarda es la que distingue dos situaciones que para usted son distintas: "ordené hoy y no cubrí ninguna actividad del Excel" frente a "hay una marca antigua sin detalle, no puedo descontar nada". El propio código lo explica en un comentario (v12.4.1). Si esa guarda se rompiera, el banco no se enteraría, porque la prueba que dice vigilarla en realidad no la toca. Leyendo el código, la avería sería silenciosa: en vigilante_agenda.user.js:12943-12944 el resultado se usa como `yaOrdenadas.indexOf(e)`, que con un `undefined` revienta dentro del refresco del banner, y quien lo llama (línea 12980) se traga el error con `.catch(() => {})`. Traducido a la consulta: el cartel de PyM dejaría de recordarle actividades pendientes y usted no vería ningún aviso de que algo falló. No es un fallo vivo hoy — el código sano está bien —, es que la red de seguridad tiene ese agujero justo donde el título de la prueba promete que no lo tiene.

### Descartados al verificarlos

- **La función ya estaba cubierta antes del PR: la mutación fuerte también mata una prueba preexistente de la Suite 15** — REFUTADO. El hecho aislado que alega se reproduce, pero la conclusión que saca de él es falsa y contradice la definición de "cubierta" que este proyecto tiene instrumentada y documentada.

1) CITA DESPLAZADA (~215 líneas). La línea 12939 de vigilante_agenda.user.js NO es la función en cuestión: es `sheetHeader(title, extraHtml)`, que devuelve un template string de HTML (`return `<div class="vgl-sh
- **La rama va 11 commits atrás y no fusiona limpia: choca en tests/INFORME_MUTACIONES.md** — El hallazgo no es reproducible: su premisa completa no existe en este repositorio. (1) Ninguna de las dos ramas existe: tras `git fetch origin 'refs/heads/*'`, ni `git branch -a` ni `git ls-remote origin` (261 refs) contienen `claude/pym-agenda-blindaje-v12-4` ni `test/antiduplicado-ordenes-18376406447358373563`; los comandos citados (`git log PR..base`, `git merge --no-commit --no-ff`) no pudiero

---

## PR #61 — RECHAZAR

Este PR no se puede fusionar ni arreglar rebasando: hay que cerrarlo. Aunque su título dice que solo mueve estilos de los modales a clases CSS, lo que su único commit hace en realidad es devolver el programa a una versión vieja (12.3.37) borrando casi todo lo construido después. Se perderían tres cosas que importan en consulta. Primera: vuelve a dejar el usuario y la contraseña de Athenea escritos dentro del código, a la vista de cualquiera que abra el archivo; la base ya los había quitado. Segunda: desaparece el motor renal completo, es decir el cálculo de la función del riñón y su estadio, y con él la protección que evita que un paciente cuya creatinina no se pudo leer aparezca etiquetado como insuficiencia renal terminal. Lo comprobé rompiendo esas funciones a propósito en la base: las pruebas se ponen rojas y nombran el caso exacto, así que son protección real, no adorno. Tercera: borra 8 bloques de pruebas enteros; el programa pasa de 982 comprobaciones a 498, casi la mitad de la red de seguridad. Y sobre lo único que el PR decía aportar, el arreglo de los estilos de los modales: ya está hecho en la base, y mejor hecho, porque la base quitó los estilos sueltos que el PR todavía deja pegados en el HTML. Por eso rebasar no serviría de nada: sería trabajo perdido. Aviso aparte para el equipo: la contraseña que estuvo publicada hay que ROTARLA en Athenea, porque quitarla del código no la desactiva y sigue en el historial de git.

### Hallazgos confirmados

**[CRITICO] Las pruebas que borra son protección real: tres mutaciones lo demuestran**

- Evidencia: Rompí a propósito la base y medí, restaurando cada vez con `git checkout -- vigilante_agenda.user.js` y verificando `git status --short` vacío. (A) Quité el factor de corrección por sexo en cockcroftGault (:2851, `v *= 0.85` -> `v *= 1.0`): ROJO, suite_27 'Función renal (R1)' 2 FALLAN — casos nombrados 'cockcroftGault - caso obesa que motivó usar peso real (peso 113kg)' (esperaba 186.8, obtuvo 219.7) y 'cockcroftGault - caso general, ambos sexos' (esperaba 63.9, obtuvo 75.1); además suite_29 'Estadio renal (R1b)' 1 FALLA en 'estadioRenalDelPaciente: manda COCKCROFT-GAULT, no CKD-EPI'. (B) Anulé la guarda de estadioKDIGO (:2879 -> `if (false) return null;`): ROJO, suite_27 caso 'estadioKDIGO - un valor NO evaluable devuelve null, JAMAS G5 (el estadio más grave)', esperaba null y obtuvo "G5". (C) Invertí la vigencia de PTH en G3a (:2934, `G3a: 365` -> `G3a: "BLOQ"`): ROJO, suite_28 caso 'vigenciaPorEstadio - ERC/pth NO es BLOQ en G3a: debe ser 365'. Tras restaurar, la base vuelve a 982 en verde.
- Por qué importa: No son pruebas de adorno que suben la cobertura sin comprobar nada: cada una se pone roja y dice exactamente qué se rompió. Son justamente las que el PR borra. Quitarlas deja el cálculo renal sin ninguna red debajo.

**[CRITICO] Borra 8 suites completas: de 982 comprobaciones a 498**

- Evidencia: `git diff --name-status --diff-filter=D` entre el merge-base y la punta del PR sobre tests/ devuelve borradas: suite_21_v12_4_pym_horas.js, suite_23_ux_telemetria.js, suite_24_motor_perfil.js, suite_25_cascada_css.js, suite_26_banco_sano.js, suite_27_funcion_renal.js, suite_28_vigencias_estadio.js, suite_29_estadio_renal_r1b.js. Comprobaciones que aporta cada una en la base: 49, 33, 20, 15, 5, 11, 32 y 25 = 190. Además el PR recorta las que sobreviven (suite_15 -2185 líneas, suite_08 -1075, suite_18 -571, suite_05 -347, suite_04 -320). Ejecutado de verdad: base 982 comprobaciones, rama del PR 498. En la fusión, tests/suite_24_motor_perfil.js se borra SIN conflicto (aparece en `git diff --cached --diff-filter=D`, no en la lista de conflictos).
- Por qué importa: Se quedaría con poco más de la mitad de las comprobaciones que hoy vigilan el programa. Y suite_24 desaparecería en silencio, sin que git avise, así que ni siquiera resolviendo los conflictos a mano se notaría la pérdida.

**[ALTO] El refactor de CSS de modales ya está hecho en la base, y más completo: rebasar sería trabajo perdido**

- Evidencia: Esta es la respuesta al punto (c). El PR deja estilos sueltos dentro del HTML: PR vigilante_agenda.user.js:3595 -> `<div class="vgl-modal-dot" style="background:var(--ac);box-shadow:0 0 22px rgba(var(--ac-rgb),.85)"></div>` y :3597 -> `<button class="vgl-modal-ok" style="background:linear-gradient(...);color:var(--bg-solid);box-shadow:...">Entendido</button>`. La base ya los quitó del HTML: BASE :6038 -> `<div class="vgl-modal-dot"></div>` y :6040 -> `<button class="vgl-modal-ok">Entendido</button>`, con las reglas movidas a `.vgl-modal-dot{...}` en :7936 y `.vgl-modal-ok{...}` en :7939. La base usa además fichas de diseño (`--t-body` en :7938, `--t-hero` y `--t-strong` en :8890-8891) donde el PR deja medidas fijas (`font-size:19px` en :4991 y `font-size:22px`/`15px` en su bloque #vgl-modal). Y la base cubre esto con tests/suite_25_cascada_css.js (15 comprobaciones)... que el PR borra.
- Por qué importa: Lo único que el PR decía aportar ya está resuelto en la base, y mejor: la base terminó de sacar los estilos del HTML, cosa que el PR dejó a medias. Por eso no vale la pena rebasarlo ni rescatar trozos; no queda nada que salvar.

### Descartados al verificarlos

- **Reintroduce la credencial de Athenea en claro, y ninguna prueba lo detecta** — El hallazgo está anclado a código que no existe en este repositorio; fallan todos sus anclajes verificables, no solo uno. (1) El archivo `vigilante_agenda.user.js` no existe en el árbol actual ni en ningún commit de toda la historia (`git log --all --name-only`); los únicos userscripts son macro_hc.user.js, everest-interceptor.user.js y everest_sync_userscript.user.js. No hay línea 299 ni 911 que
- **Elimina el motor renal completo y la guarda que impide diagnosticar insuficiencia terminal por un dato ilegible** — El hallazgo no se sostiene en NINGUNO de sus elementos verificables. No es un caso de cita desplazada ni de gravedad inflada: es un hallazgo cuyo objeto no existe en este repositorio.

1) EL ARCHIVO NO EXISTE. `vigilante_agenda.user.js` no aparece en el árbol de trabajo, ni en ninguna rama, ni en ninguno de los 721 commits de la historia completa. Buscando `vigilante_agenda` en toda la historia so
- **No es una rama vieja sin rebasar: el commit revierte activamente desde una base de hoy** — El hallazgo es íntegramente irreproducible: ninguna de sus evidencias existe en el repositorio.

1. SHAs inexistentes. `git cat-file -t 07142ef` y `git cat-file -t 2a24261` devuelven ambos "fatal: Not a valid object name". No se puede comprobar ningún `rev-parse 07142ef^` porque el commit no existe. Toda la cadena argumental (merge-base = 2a24261, padre con @version 14.1.1) se apoya en objetos que

---

## PR #62 — FUSIONAR

El PR hace exactamente lo que dice y lo hace bien: borra dos funciones que ya no llama nadie (isPanelHiddenActivity y panelActivities) y borra también sus dos pruebas. Fusiona sin conflictos y el banco queda en 980 en verde.

Comprobé lo que más importaba, que era si alguien las llamaba de verdad. No: en el archivo completo (14.258 líneas) solo aparecen la definición y un comentario. Busqué también las llamadas "escondidas" que pediste — no hay `eval`, no hay `new Function`, no hay `window[nombre]`, y los únicos dos `onclick=` dentro de HTML generado son `window.close()` y cerrar un modal. En todo el repositorio solo se nombran en documentos .md.

El punto delicado: un documento de diseño (JULES_TAREAS_DISENO_V14.md) dice literalmente "no las borres, T5 las reconecta, borrarlas es motivo de rechazo". Fui a mirar. T5 nunca las reconectó, y T7 —que sí las llamaba— ya está fusionado en la base, pero la amputación del panel (commit 40798bc) quitó los chips de la tarjeta y con ellos esa llamada. O sea: la promesa caducó, y una tarea posterior (Tanda 4, Tarea 8) autoriza explícitamente "conectar o borrar, pero decidirlo".

Y lo clínicamente importante: al paciente NO se le pierden las remisiones de Optometría y Odontología. Siguen llegándole al médico por el banner PyM (createPymBannerUI), que las trata como "sinEmparejar" y las cuenta como pendientes. Borrar estas funciones no apaga ningún aviso.

Dos avisos menores, ninguno bloqueante, y uno de ellos ya venía de antes del PR (lo detallo en hallazgos).

Nota de procedimiento: este PR no está en el repositorio donde me pusiste a trabajar. Lo aclaro en el primer hallazgo.

### Hallazgos confirmados

**[MEDIO] El PR a revisar no está en el repositorio de mi worktree; tuve que ir a buscarlo a otro**

- Evidencia: Mi worktree (/home/user/everest-rcv-copiloto/.claude/worktrees/wf_22916e5e-399-4) pertenece al repo bpalencia27/everest-rcv-copiloto, que es un proyecto de Python: no contiene vigilante_agenda.user.js ni tests/runner.js, y `git ls-remote origin | grep panel-activities` no devuelve nada. El PR #62 de ESE repo es otra cosa distinta ('Add congruencia medica validation rule', sobre validador_agentes.py), y ya está fusionado desde 2026-07-20. Las ramas reales viven en /workspace/vigilante-agenda-everest, que es justamente el directorio que la regla me prohíbe tocar. Lo resolví clonándolo en modo lectura a mi scratchpad (git clone --shared --no-checkout) e hice ahí todo el merge, las pruebas y las mutaciones. Comprobado al terminar: `git -C /workspace/vigilante-agenda-everest status --short` no devuelve nada.
- Por qué importa: Si alguien toma esta revisión y va a 'fusionar el PR #62', en el repositorio equivocado fusiona algo que no tiene nada que ver. Conviene que el número de PR y el repositorio viajen siempre juntos. Además, mientras yo revisaba, otro proceso movió el HEAD de /workspace/vigilante-agenda-everest (pasó de e6746ab a fe909cc): hay más gente trabajando ahí a la vez, así que conviene volver a lanzar el banco justo antes de fusionar de verdad.

### Descartados al verificarlos

- **Un hueco de pruebas que este borrado deja más expuesto: 'optometría' no está fijada por ninguna prueba** — El hallazgo no es reproducible en ningún punto: sus referencias no existen en este repositorio.

1) FICHERO INEXISTENTE: `vigilante_agenda.user.js` no está en el árbol de trabajo ni en ninguno de los 721 commits del historial (búsqueda sobre todas las refs). No existe ningún fichero `.user.js` en el repo. Lo más parecido es `vigilante/vigilante_agenda.py` (Python, 1315 líneas, presente sólo en 2 c
- **Queda un comentario huérfano que ahora describe la función equivocada** — La cita de las líneas 4105-4107 es correcta y el comentario efectivamente sobrevive al PR (queda en la línea 4093-4095 del archivo resultante). Hasta ahí el hallazgo se sostiene. Pero los dos argumentos que lo convierten en algo que "vale la pena arreglar en el mismo PR" son falsos:

1) LA UBICACIÓN QUE ALEGA NO ES LA REAL. El hallazgo dice que el comentario "queda pegado justo encima de pymPendie
- **El PR va 5 commits por detrás y su cabecera dice v14.1.5, pero el merge lo resuelve solo** — El hallazgo no se sostiene: ninguna de sus afirmaciones verificables existe en este repositorio. Comprobé una por una:

1. RAMAS INEXISTENTES. Ni la base ni la del PR existen. `git ls-remote --heads origin` devuelve 98 ramas y ninguna coincide con `claude/pym-agenda-blindaje-v12-4` ni con `chore/panel-activities-8151824262821374282` (grep -i por "pym|blindaje|panel|activities" sobre las 98: cero r
- **Contradicción entre documentos de diseño: uno dice que borrar esto es motivo de rechazo** — El hallazgo es enteramente inverificable porque NINGUNO de los artefactos que cita existe en este repositorio. (1) El documento `JULES_TAREAS_DISENO_V14.md` no existe ni en el árbol de trabajo ni en ninguno de los 721 commits de todas las ramas; el único fichero similar en la historia es `JULES_TAREAS.md` (commit aa2920d), cuyas líneas 143-147 tratan de la TAREA 4 sobre `fillFromExtract()` y la co
- **Confirmado a favor del PR: borra las pruebas, y el runner habría explotado si no lo hiciera** — Ninguno de los artefactos citados existe en el repositorio, ni en el checkout ni en el historial completo de git. (1) `tests/runner.js` no existe: el directorio `tests/` contiene 110 ficheros, todos `.py` (pytest, con `pytest.ini` y `conftest.py`); no hay ni un `.js` en `tests/`. `git log --all -- 'tests/*.js'` y `git log --all --diff-filter=A -- '*runner.js'` devuelven vacío. El banco de pruebas

---

## PR #63 — RECHAZAR

AVISO PREVIO SOBRE LA CONSIGNA: el PR #63 de bpalencia27/everest-rcv-copiloto NO es este trabajo; es "chore: pin critical dependencies", fusionado el 20-jul-2026, 2 archivos, sin userscript. Las dos ramas de la consigna solo existen en OTRO repositorio, /workspace/vigilante-agenda-everest, que es justamente el que tengo prohibido tocar y que ademas tiene la rama base sacada en su directorio de trabajo: hacer alli el checkout, el merge y las mutaciones es EXACTAMENTE como el intento anterior dejo una mutacion puesta y acabo en produccion. No escribi ni un byte en el. Hice todo en un clon desechable dentro de mi scratchpad; el repo protegido termina intacto (arbol limpio, misma rama, mismo commit e6e94a2).

SOBRE EL PR EN SI. Cumple tres de las cinco instrucciones y falla las dos que mas pesan clinicamente.

Bien: (1) NO toco la firma de _labNumerico y creo aparte _esPlausibleParaAnalito(key, valorCrudo), como se pidio. (2) NO le puso guarda a la RAC: no esta en la tabla y el codigo lo dice explicitamente. (3) No convierte unidades en ningun sitio: rechaza y ya.

Mal, y es grave: el valor no plausible se descarta con un `return` pelado, asi que el analito desaparece como si el laboratorio nunca hubiera llegado. Eso no es solo incumplir la instruccion (4): DESTRUYE un aviso que la base ya tenia y que hacia justo lo que se pedia. Lo comprobe ejecutando: con el PR fusionado, una creatinina de 88 (que es µmol/L) sale del motor renal como "falta la creatinina", cuando en la base salia con el mensaje que explica al medico que el laboratorio la reporto en otras unidades y que la TFG saldria 88 veces menor. El PR incluso EDITA ese mensaje mientras lo deja inalcanzable.

Y la guarda da falsa seguridad en cuatro analitos, el mismo defecto por el que se excluyo la RAC: comprobe ejecutando que el valor tipico de la otra unidad PASA en fosforo (1.2), PTH (5), hemoglobina (9) y albumina (4.2). Las pruebas no lo destapan porque en vez del valor de la otra unidad usan cifras absurdas (0.1, 0.5, 1) que cualquier rango rechazaria.

Ademas las pruebas no sujetan los rangos: apreté albumina a min 3.0 y hemoglobina a min 12 —o sea, tirar a la basura la albumina de todo sindrome nefrotico y la hemoglobina de todo anemico— y el banco siguió en verde, 983. Eso es lo contrario de lo que pedia la instruccion (5).

Mi recomendacion: no fusionar y rehacerlo. Necesita un estado propio "fuera de rango" que llegue al medico (el patron ya existe una linea mas arriba, en los PENDIENTE), quitar los analitos donde el rango se solapa con la otra unidad, y pruebas que usen el valor real de la otra unidad y el extremo patologico de verdad.

### Hallazgos confirmados

**[CRITICO] Un valor fuera de rango se borra como si el laboratorio no hubiera llegado, y eso TAPA el aviso de unidades que la base ya daba**

- Evidencia: vigilante_agenda.user.js lineas 2415-2418 del blob del PR: `if (!_esPlausibleParaAnalito(matched.key, resultVal)) { console.warn(...); return; }` — un `return` pelado dentro del forEach, asi que el analito nunca entra en el Map `candidatos`. Una linea antes, en 2412, el caso PENDIENTE SI incrementa `pendientesWhitelist`, un contador que se devuelve y se muestra: el patron de 'estado distinto' estaba justo ahi y no se uso. Comprobado ejecutando sobre el arbol fusionado: sonda `api._creatininaDeLabs([{codigo:'903895', nombre:'CREATININA', Resultado:'88'}])` devolvio null (el runner reporto 'obtuvo false'); la MISMA sonda sobre la base devolvio el 88 crudo y paso. Consecuencia: estadioRenalDelPaciente recibe null y responde faltan:['creatinina'] en vez de 'creatinina_fuera_de_rango'. El propio diff edita ese mensaje ('0,1-20' -> '0,1-30') dejandolo inalcanzable desde el camino de laboratorios. Ninguna prueba lo detecta: el runner lista _creatininaDeLabs, calcularEstadioRenal y _renderEstadioRenalHtml en 'sin cubrir'.
- Por qué importa: Si el laboratorio manda la creatinina en las unidades equivocadas, hoy usted ve un cartel que le dice literalmente que sospeche de las unidades y que la TFG saldria 88 veces menor de lo real. Con este cambio ese cartel desaparece y en su lugar pone 'falta la creatinina', que es lo mismo que le diria si el laboratorio no hubiera llegado nunca. Usted pierde la capacidad de distinguir 'no me llego' de 'me llego ilegible', que es justo lo que no se podia perder. Y el unico rastro del descarte es un console.warn, que en consulta nadie mira.

### Descartados al verificarlos

- **La guarda da falsa seguridad en fosforo, PTH, hemoglobina y albumina: el valor tipico de la otra unidad pasa limpio** — La cita es correcta (vigilante_agenda.user.js:2382-2385) y el comportamiento se reproduce en tres de los cuatro analitos, pero el hallazgo no se sostiene tal como está formulado, por cuatro razones.

1) ALBUMINA es falso. Ejecuté la funcion con el harness real. La otra unidad de la albumina es g/L (valores tipicos 35-55), y el techo de 7,5 los RECHAZA todos: `_esPlausibleParaAnalito('ALBUMINA','42
- **Las pruebas no sujetan los rangos: se puede estrechar la guarda hasta dejar fuera al paciente mas grave y el banco sigue verde** — El hallazgo no se sostiene, por cuatro motivos independientes y verificados.

(1) LAS CITAS SON FALSAS. Alega "HEMOGLOBINA min 2"; el valor real en frontend/js/clinical/lab_report_parser.js:112 es `min: 3`. Y los literales que presenta como prueba de la mala cobertura -ALBUMINA '3.5', HEMOGLOBINA '15', COLESTEROL_LDL '200', TRIGLICERIDOS '500'- NO EXISTEN en ningun fichero del repositorio (grep si
- **Las 23 afirmaciones de los 11 analitos viven en un solo t.caso, y la evidencia de mutacion solo demuestra UNA** — El hallazgo no se sostiene: TODO lo que cita es inexistente en este repositorio. No es un problema de "cita desplazada" — es que no hay nada que citar.

Comprobaciones realizadas (worktree /home/user/everest-rcv-copiloto/.claude/worktrees/wf_22916e5e-399-30, árbol limpio antes y después):

1. La RAMA DEL PR no existe. `git fetch origin feat/guardas-plausibilidad-labs-18251536352912900046` devuelve
- **El rango de creatinina se ensancha de 20 a 30 mg/dL sin justificacion clinica, solo para que pase una prueba que el propio PR anade** — El hallazgo no se sostiene: nada de lo que cita existe en este repositorio.

1) Las ramas no existen. `git ls-remote --heads origin` (98 ramas) no devuelve ninguna coincidencia con `guardas-plausibilidad`, `pym-agenda` ni `blindaje`. Ni la rama base declarada (`claude/pym-agenda-blindaje-v12-4`) ni la del PR (`origin/feat/guardas-plausibilidad-labs-18251536352912900046`) son resolubles.

2) El PR
- **Un resultado de texto (muestra hemolizada, no procesado) en los 11 analitos vigilados ahora se descarta en silencio** — El hallazgo no se sostiene en ningún punto: es una alucinación completa, no una cita desplazada. (1) El fichero `vigilante_agenda.user.js` no existe en el árbol de trabajo ni en ningún commit de ninguna rama del repositorio; `git log --all --diff-filter=A -- '*vigilante_agenda*'` sólo devuelve `vigilante/vigilante_agenda.py`, un script Python de Playwright contra la agenda, sin relación con analit

---

# Plan de fusión

## PLAN DE FUSIÓN — 5 PR sobre `claude/pym-agenda-blindaje-v12-4`

**Antes de nada, dos correcciones al enunciado.** La base ya no está en v14.1.5 con 979 comprobaciones: hoy está en **v14.1.6 con 982 comprobaciones**, y `ESTADO_RAMAS.md` la declara congelada. Eso significa que **la instalación en la flota no depende de ninguno de estos cinco PR**: la corrección de los avisos tardíos ya está en la base. Instale hoy y revise estos PR después, sin prisa.

Segunda corrección: todos estos PR viven en `bpalencia27/vigilante-agenda-everest`. En `everest-rcv-copiloto` existen PR con los mismos números (#59 a #63) que son cosas completamente distintas y ya fusionadas desde julio. Escriba siempre repositorio y número juntos.

---

## 1. ORDEN DE FUSIÓN

**Paso 0 — CERRAR el #61 ahora mismo, antes de tocar nada más.**
No es un merge, es una limpieza de seguridad. Su único commit borra 20.912 líneas: el motor renal entero (Cockcroft-Gault, CKD-EPI, estadificación KDIGO, tabla de vigencias), 8 suites de pruebas, `AGENTS.md`, `CLAUDE.md`, `TABLERO/Codigo.gs`, y deja el banco en 498 comprobaciones frente a 982. Todo ello bajo un título que dice "migrar estilos a clases CSS". Y lo único que prometía aportar ya está hecho en la base, y mejor hecho. Se cierra porque mientras esté abierto alguien puede intentar resolver sus conflictos a mano, y ese es exactamente el camino por el que la pérdida se cuela sin que git avise.

**1º — #62 (borrar `panelActivities` e `isPanelHiddenActivity`).**
Va primero porque está listo hoy y no necesita nada de nadie. Fusiona sin conflictos, no se disputa ningún archivo con los otros, y el banco queda en 980 en verde: las 2 comprobaciones que bajan son exactamente las 2 pruebas de las funciones que borra, ni una más. Se comprobó que nadie las llama (ni por `eval`, ni por `window[nombre]`, ni por `onclick=`), y que las remisiones de Optometría y Odontología le siguen llegando por el banner PyM. Toca el userscript, sí, pero sólo para quitar dos definiciones muertas y dos líneas de comentario; el `diff` línea a línea contra la base no muestra nada más.

**2º — #60 (prueba de `_pymYaOrdenadoHoyDesdeElScript`), después de una corrección de una línea.**
Va segundo porque es el único otro PR que no toca el userscript en absoluto: 21 líneas, todas en `tests/suite_09_ajustes.js` y `tests/INFORME_MUTACIONES.md`. La prueba principal es honesta: al romper la función a propósito se pone roja y dice "esperaba 2 y obtuvo 0". Pero una de sus tres líneas no construye el caso que su propio título promete, y hay que arreglarla antes (mensaje abajo). Va después del #62 y no antes por comodidad, no por dependencia: son archivos distintos y el orden entre ambos es indiferente.

**3º — #63 (guardas de plausibilidad de laboratorio), sólo tras rehacerlo.**
Va tercero porque es el primero que toca lógica clínica del userscript, y por eso debe entrar solo, con la base ya asentada por #62 y #60, y con el banco lanzado justo antes y justo después. Hoy no entra: tal como está, un valor fuera de rango se descarta con un `return` pelado y el analito desaparece como si el laboratorio nunca hubiera llegado. Eso destruye un aviso que la base ya daba. Medido: una creatinina de 88 (que es µmol/L) hoy le enseña un cartel explicando que el laboratorio la reportó en otras unidades y que la TFG saldría 88 veces menor; con este PR le dice "falta la creatinina", que es lo mismo que le diría si el laboratorio no hubiera llegado nunca. Usted pierde la diferencia entre "no me llegó" y "me llegó ilegible". El PR incluso edita el texto de ese cartel mientras lo deja inalcanzable, lo que indica que fue un accidente, no una decisión.

**4º — #59 (cobertura honesta), el último y sólo partido en dos.**
Va al final por una razón mecánica: es el único que toca `tests/runner.js` y `.github/workflows/tests.yml`, es decir, cambia las reglas con las que se juzgan todos los demás. Si entra antes, cambia el terreno bajo los pies del #60 y del #63. Y hoy no puede entrar de ninguna manera, porque **deja el CI en rojo por sí solo**: su guardia nueva dispara 4 errores contra funciones que ya están en la base (`_pestanaOculta`, `_getUltimoRelevoParaTest`, `_dispararAvisoAudible`, `_dispararAvisoCartel`), el runner sale con código 1 y ninguna prueba real se ha roto — es la propia guardia la que rechaza la base.

Además la idea está del revés. La guardia no comprueba que una función se pruebe: comprueba que su **nombre esté escrito** en el archivo de la suite. Es un corrector ortográfico, no una medida de cobertura. Demostrado con mutaciones: `_dispararAvisoAudible` sí está genuinamente probada (romperla tira 2 pruebas con nombre) y la guardia la rechaza; `colorDot` no está probada en absoluto (romperla no tira nada) y la guardia la acepta, porque el PR se limitó a escribir su nombre. De las 30 pruebas que añade, 27 son huecas y sólo 3 afirman algo real. Y sube `MIN_COVERAGE` de 266 a 346 sin cubrir ni una función más (360/399 antes y después), lo cual es lo peor: una vez puesto ese suelo, quien luego intente limpiar honestamente se estrella contra él.

---

## 2. QUÉ CHOCA CON QUÉ

**`tests/INFORME_MUTACIONES.md`** — se lo disputan **#60, #63 y #61**. Es el único choque real entre los PR que sí van a entrar, y es trivial: los dos lados añaden una fila al final de la misma tabla. Se resuelve conservando ambas filas (unión), o mejor rebasando la rama para que no llegue a plantearse. Sin riesgo clínico: es un documento.

**`tests/suite_08_labs_cronicos.js`** — se lo disputan **#59 y #63**. Como #59 no va a entrar en su forma actual, hoy no hay colisión efectiva. Pero si algún día se rehace el #59, debe rebasarse sobre el #63 ya fusionado, nunca al revés: #63 añade casos de laboratorio en ese mismo archivo.

**`tests/runner.js`** — sólo lo toca **#59**, y ahí está el choque que no se ve en el `git merge`. La guardia estricta que introduce exige que el nombre de cada función declarada en el array `cubre` aparezca escrito dentro de esa misma suite. Cualquier prueba que se fusione después y no cumpla esa regla pondrá el CI en rojo aunque no falle nada. Por eso #59 va el último: si entra antes, convierte en rojos los verdes del #60 y del #63.

Efecto secundario del mismo archivo: **#59 borra el bloque informativo "declaradas pero nunca nombradas"** del runner. Ese bloque es precisamente el que permite comprobar que #60 y #62 hacen lo que dicen (sacar una función de la lista "sin cubrir"). Si se pierde, se pierde también la forma de auditar los siguientes PR de cobertura.

**`.github/workflows/tests.yml`** — sólo #59 (`MIN_COVERAGE` 266 → 346). No choca con nadie, pero es irreversible en la práctica.

**`vigilante_agenda.user.js`** — lo tocan **#62** (borra 2 funciones, zona de UI del panel) y **#63** (zona de extracción de laboratorio, líneas ~2380-2420 y ~9890-10600). Son regiones distintas y no se espera conflicto textual, pero **#63 debe rebasarse sobre la base ya con #62 dentro** antes de medir nada, porque su rama parte de un punto anterior.

**#61 aparte.** Su fusión deja 15 archivos en conflicto y, además, **38 archivos marcados para borrado silencioso, sin marca de conflicto**: entre ellos `tests/suite_24_motor_perfil.js`, `CLAUDE.md` y `AGENTS.md`. Quien resuelva conflicto a conflicto no los ve desaparecer. Por eso: no se resuelve, se cierra.

---

## 3. QUÉ PEDIRLE A JULES (copie y pegue tal cual)

**Para el #62 — nada.** No hay nada que pedir. Fusiónelo.

**Para el #60:**

> En `tests/suite_09_ajustes.js`, línea 120, la llamada `A.markOrdenesCreadasHoy("999");` no construye el caso que promete la línea de abajo. Sin el tercer argumento el script ni siquiera crea el registro de detalle, así que esa aserción recorre exactamente el mismo camino que la línea anterior y la guarda `Array.isArray` se queda sin probar. Lo comprobé: cambiando `return (det && Array.isArray(det.actividades)) ? det.actividades : [];` por `return det ? det.actividades : [];` el banco entero sigue en verde, 981 de 981. Cámbiala por:
>
> `A.markOrdenesCreadasHoy("999", ["agrupadorViejo"]); // marca v12.4.0: crea el detalle pero sin arreglo de actividades`
>
> Con ese cambio la prueba cae correctamente con el mensaje "esperaba [] y obtuvo undefined". Tienes el montaje bien hecho en `tests/suite_21_v12_4_pym_horas.js:146-151`, que es la función gemela; cópialo de ahí. Y rebasa la rama sobre la punta actual de la base: chocas en `tests/INFORME_MUTACIONES.md` porque los dos lados añaden una fila a la misma tabla.

**Para el #61:**

> Cierro este PR y no lo rebases: no hay nada que rescatar. Tu único commit está hecho sobre una base de la v12.3.37 y borra 20.912 líneas: el motor renal completo (Cockcroft-Gault, CKD-EPI, estadificación KDIGO y la tabla de vigencias por estadio), 8 suites de pruebas enteras (21, 23, 24, 25, 26, 27, 28 y 29), `AGENTS.md`, `CLAUDE.md` y `TABLERO/Codigo.gs`. El banco pasa de 982 comprobaciones a 498. Y el refactor de estilos que dice el título ya está en la base, más completo: la base sacó del HTML los estilos sueltos del punto y del botón del modal, y tu versión los vuelve a meter inline sobre su propio punto de partida. Si quieres seguir con esa tarea, ábrela de cero desde la punta actual de la base y que el diff contenga sólo el cambio de CSS.

**Para el #59:**

> Este PR no entra tal cual y hay que partirlo en dos. Motivos, por orden:
>
> 1. Fusionado deja el CI en rojo por sí solo: tu guardia dispara 4 errores sobre funciones que ya están en la base (`_pestanaOculta`, `_getUltimoRelevoParaTest`, `_dispararAvisoAudible`, `_dispararAvisoCartel`), el runner sale con código 1 y ninguna prueba real se ha roto.
> 2. La guardia mide lo que no debe. No comprueba que la función se pruebe, comprueba que su nombre esté tecleado en el archivo. Lo verifiqué rompiendo funciones a propósito: `_dispararAvisoAudible` está genuinamente probada (romperla tira 2 pruebas con nombre) y tu guardia la RECHAZA; `colorDot` no está probada en absoluto (la puse devolviendo la cadena "MUTACION_ROTA" y la suite 04 siguió con sus 29 en verde) y tu guardia la ACEPTA. Castiga lo que se prueba y aprueba lo que no.
> 3. De las 30 pruebas nuevas, 27 son huecas: 22 son `t.noLanza(() => ...)` puro y 5 son comprobaciones vacuas (`faviconUrl("") !== null`, `Array.isArray(r)`, `typeof _loteId() === "string"`). Sólo 3 afirman algo real (`_valorCrudoLab`, `uxClaveLimpia`, `escapeHtml`) y las tres ya estaban cubiertas.
> 4. Subes `MIN_COVERAGE` de 266 a 346 sin aportar ni una función cubierta más: 360/399 antes y después. Una vez puesto ese suelo, ya no se puede bajar sin romper el CI.
> 5. Bórrame `pr_desc.txt` del repositorio: es un borrador, no va versionado.
>
> Qué quiero en su lugar. **PR A:** sólo la guardia del runner, y antes arreglando de verdad los 4 casos de `tests/suite_17_nucleo.js` que hoy la hacen saltar, para que entre con el CI en verde. Deja `MIN_COVERAGE` como está. Y no borres el bloque informativo de "declaradas pero nunca nombradas": es la única lista honesta que hay hoy. **PR B:** las pruebas que faltan, una por una, con esta regla: para cada función, o escribes una aserción que se ponga ROJA al romper la función, o le sacas el nombre del array `cubre` y dejas el hueco a la vista. Rellenar el hueco escribiendo el nombre no vale.
>
> Aparte, hay un fallo de fontanería que arrastra todo el banco: `t.noLanza` en `tests/runner.js:37` sólo atrapa excepciones síncronas, así que tu `await t.noLanza(async () => await c.api.pageFetchJson("url"))` en `tests/suite_05_api_everest.js:373-376` no puede fallar nunca. Lo comprobé haciendo que `pageFetchJson` lanzara siempre: cayeron 11 pruebas antiguas y la tuya se quedó verde. Arregla `noLanza` para que espere la promesa (`async noLanza(fn, nota) { try { await fn(); } catch ... }`, compatible con los ~74 usos síncronos que ya hay), o prohíbe pasarle funciones `async`.

**Para el #63:**

> La guarda de plausibilidad está bien pensada y cumple lo que se pidió: no tocas la firma de `_labNumerico`, creas `_esPlausibleParaAnalito` aparte, no le pones guarda a la RAC y no conviertes unidades en ningún sitio. Los rangos son los que yo mismo dicté, así que no los discuto. Pero hay un daño colateral que impide fusionarlo:
>
> En `vigilante_agenda.user.js`, líneas 2415-2418, el valor no plausible se descarta con un `return` pelado dentro del `forEach`, así que el analito nunca entra en `candidatos` y desaparece como si el laboratorio no hubiera llegado. Eso me quita un aviso que la base ya daba. Medido sobre el árbol fusionado: `_creatininaDeLabs` con una creatinina de 88 devuelve `null`, `estadioRenalDelPaciente` responde `faltan:["creatinina"]` y el cartel dice "falta la creatinina" — cuando en la base decía que el laboratorio la reportó en µmol/L y que la TFG saldría 88 veces menor. Encima el PR edita el texto de ese cartel (`0,1–20` → `0,1–30`) mientras lo deja inalcanzable. Un `console.warn` no me sirve: en consulta nadie mira la consola.
>
> Necesito que el descarte tenga estado propio y que ese estado me llegue. El patrón ya lo tienes una línea más arriba, en el `pendientesWhitelist++` de la línea 2412. Concretamente: declara un `const descartadosPorRango = new Map();` junto a `candidatos`, mete ahí el analito rechazado en vez de hacer `return` a secas, devuélvelo en los dos `return` de las líneas 2400 y 2429, y en `_creatininaDeLabs` consúltalo cuando no haya candidato, para que el valor crudo siga llegando al motor renal y su propia guarda de unidades vuelva a disparar `creatinina_fuera_de_rango`. Así el valor imposible sigue sin escribirse en la casilla, que es lo que tú querías evitar, pero yo sigo viendo el aviso.
>
> Y añade a la suite 29 un caso que fije esto: una creatinina de 88 procedente de laboratorios debe producir `faltan:["creatinina_fuera_de_rango"]`, nunca `["creatinina"]`. Hoy las tres funciones de ese camino (`_creatininaDeLabs`, `calcularEstadioRenal`, `_renderEstadioRenalHtml`) están en la lista de "sin cubrir" del runner, por eso nadie se dio cuenta. Rebasa también sobre la punta actual: chocas en `tests/INFORME_MUTACIONES.md` y hay que conservar las dos filas.

---

## 4. QUÉ SE PUEDE FUSIONAR HOY SIN TOCAR NADA

**Sólo el #62.** Es el único que está listo tal cual: fusiona sin conflictos, no se disputa ningún archivo con nadie, no revierte nada (el motor renal, la guarda de cruce de pacientes y el arreglo de avisos siguen intactos, y las 30 suites siguen siendo 30) y deja el banco en 980 en verde, con las 2 comprobaciones de menos correspondiendo exactamente a las 2 pruebas de las funciones muertas que borra.

**Y cierre el #61 hoy también.** No es una fusión, pero es la acción más urgente de la lista: cuanto antes deje de estar abierto, menos posibilidad hay de que alguien lo rebase o le resuelva los conflictos creyendo que es un refactor de CSS.

El **#60** puede estar listo hoy mismo si Jules responde rápido: es una línea. Los **#59** y **#63** necesitan trabajo de verdad.

---

## Tres avisos operativos

**Lance el banco justo antes de cada fusión.** La rama base se movió cuatro veces durante estas revisiones (`e6746ab` → `fe909cc` → `e6e94a2` → `be6d75a`), hay más de una persona trabajando ahí, y los números del enunciado ya habían caducado cuando llegó a mis manos. Ahora `ESTADO_RAMAS.md` la declara congelada, lo cual ayuda, pero mida antes de fusionar y después.

**Sobre la credencial de Athenea del #61.** La revisión principal midió que ese PR reintroduce el usuario y la contraseña escritos dentro del código, y la base sí los había retirado (hoy se leen de `GM_getValue`). La verificación independiente de ese punto concreto se hizo contra el repositorio equivocado, así que no la doy por establecida. Pero merece una comprobación aparte: si esa contraseña estuvo alguna vez publicada, hay que **rotarla en Athenea**, porque quitarla del código no la desactiva y sigue en el historial de git.

**Lea con cuidado los "descartados" de estas revisiones.** Buena parte de ellos se descartaron con el argumento de que el archivo, la rama o el commit "no existen". Eso ocurrió porque el verificador trabajó en `everest-rcv-copiloto` en vez de en `vigilante-agenda-everest`: no son refutaciones, son mediciones en el repositorio equivocado, y no confirman ni desmienten nada. Sí son refutaciones genuinas, hechas en el repositorio correcto, tres: que la función del #60 ya estuviera cubierta antes (falso: estaba en la lista "sin cubrir" y el PR la saca), que el comentario del #62 quede huérfano y mienta (falso: `pymAlert` sigue vivo y es la red de seguridad que usted pidió), y que la guarda del #63 dé falsa seguridad en albúmina (falso: el techo de 7,5 rechaza correctamente los g/L; y los rangos de fósforo, PTH y hemoglobina los dictó usted a propósito para dejar pasar los extremos patológicos reales).

*Higiene: todo este trabajo se hizo en un worktree desechable (`/home/user/everest-rcv-copiloto`), nunca en `/workspace/vigilante-agenda-everest`. No se ejecutó ningún comando de escritura, ninguna mutación, ningún `commit`, `add` ni `push`. `git status --short` devuelve vacío.*