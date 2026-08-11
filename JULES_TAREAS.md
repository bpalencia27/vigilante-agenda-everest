# Prompts para delegar a Jules (jules.google.com)

Instrucciones de uso: en Jules, crea UNA tarea por cada bloque "TAREA". Pega siempre
el PREÁMBULO completo + el bloque de UNA sola tarea. No le des dos tareas en la misma
sesión. Cuando llegue el PR, NO se aprueba sin correr `node tests/runner.js`
localmente sobre su rama (regla dura de este proyecto).

---

## PREÁMBULO (pegar siempre, antes de la tarea)

Trabajas en el repositorio `vigilante_agenda`. Es un userscript de Tampermonkey
(`vigilante_agenda.user.js`, un único IIFE) que asiste a médicos de una IPS en
Colombia, con un banco de pruebas propio en `tests/` (sin frameworks: se corre con
`node tests/runner.js`).

REGLAS INNEGOCIABLES:

1. **PROHIBIDO modificar `vigilante_agenda.user.js`.** Ese archivo lo edita en
   paralelo el agente principal del proyecto (varias versiones por día); cualquier
   edición tuya generará conflictos y se descartará. Tu tarea está diseñada para NO
   necesitar tocarlo. Si crees que tu tarea lo exige, DETENTE y explica por qué en
   el PR, sin editar nada.
2. **Evidencia o no pasó.** Antes de abrir el PR, corre `node tests/runner.js` y pega
   la salida COMPLETA en la descripción del PR, incluyendo el resumen final
   ("comprobaciones : N pasan"). Si el runner muere sin imprimir ese resumen final,
   eso es un FALLO tuyo que debes arreglar antes de abrir el PR — no un detalle.
   Nunca afirmes que algo funciona sin mostrar la evidencia.
3. **Un PR pequeño por tarea.** Nada de "de paso arreglé...". Solo lo pedido.
4. Comentarios de código en español, siguiendo el estilo del repo: cada comentario
   explica el POR QUÉ (el incidente o la restricción), no el qué.
5. No inventes datos clínicos ni hagas peticiones de red a los sistemas de la
   clínica (Everest, Athenea, AppCita). Todo se prueba con mocks, como ya hacen las
   suites existentes.

---

## TAREA A — CI: detectar la "muerte silenciosa" del runner

Problema real ya ocurrido: `node tests/runner.js` puede morir a mitad de camino sin
código de salida distinto de cero y sin imprimir el resumen final — y el CI lo daba
por verde. Eso permitió una vez reportar como hecho un trabajo que no corría.

Qué hacer:
1. Revisa el workflow de GitHub Actions existente (en `.github/workflows/`).
2. Modifícalo para que el paso de pruebas capture la salida del runner y FALLE si:
   a) el código de salida no es 0, O
   b) la salida NO contiene la línea de resumen final (el patrón
      `comprobaciones :` seguido de `pasan`), O
   c) la salida contiene `fallan` con un número mayor que cero.
3. Añade un caso de demostración en la descripción del PR: muestra (con la salida
   pegada) que un runner que muere a mitad SÍ pone el CI en rojo. Puedes simularlo
   temporalmente en una rama con un `process.exit(0)` a mitad del runner — pero ese
   cambio de simulación NO va en el PR final.

Criterio de aceptación: workflow modificado + salida completa del runner local
pegada + captura o log del CI en verde con el banco real y en rojo con la simulación.

---

## TAREA B — Herramienta: comparador de fuentes (repo vs. Gist desplegado)

Contexto: el script desplegado vive en un Gist secreto que se actualiza a mano, y se
detectó que divergió del repositorio (el Gist tendría ~2.000 líneas que el repo no
tiene). Necesitamos una herramienta para auditar esa divergencia SIN adivinar.

Qué hacer:
1. Crea `tools/comparar_fuentes.js` (archivo NUEVO, Node puro, sin dependencias
   externas). Recibe dos rutas de archivo:
   `node tools/comparar_fuentes.js <archivoA.user.js> <archivoB.user.js>`
2. Para cada archivo extrae: la `@version` de la cabecera, el número de líneas, y la
   lista de funciones de nivel superior (declaraciones `function NOMBRE` y
   `const/let NOMBRE = ... =>` — reutiliza la lógica de detección que ya existe en
   `tests/harness.js`, cópiala o impórtala, NO la reinventes distinta).
3. Imprime un informe legible: versión y líneas de cada uno; funciones que están
   SOLO en A; funciones que están SOLO en B; y cuántas funciones comparten.
4. Añade pruebas para la herramienta en un archivo nuevo de `tests/` (mira cómo el
   runner descubre las suites y regístrala igual), usando dos archivos de juguete
   generados por la propia prueba en un directorio temporal.

Criterio de aceptación: herramienta + pruebas nuevas pasando + salida completa del
runner pegada en el PR + ejemplo de ejecución real de la herramienta comparando dos
copias del propio repo (por ejemplo `main` vs. un commit anterior).

---

## TAREA C — Documentar las convenciones de la casa (CONTRIBUTING.md)

El repo acumula reglas duras aprendidas por incidentes reales, pero viven dispersas
en comentarios del código. Un agente o humano nuevo las viola sin saberlo.

Qué hacer: crea `CONTRIBUTING.md` (archivo NUEVO) que documente, citando los
comentarios del código fuente donde constan (lee el archivo, no inventes):
1. La regla de versión: `@version` de la cabecera y `const VERSION` suben SIEMPRE
   juntas, en cada cambio.
2. El flujo de despliegue real: Tampermonkey lee de un Gist secreto actualizado a
   MANO; subir a `main` NO despliega nada.
3. Cómo funciona el banco de pruebas: `node tests/runner.js`, el harness que
   auto-publica funciones de nivel superior, y las trampas conocidas del DOM falso
   (querySelector memoizado que devuelve señuelos desconectados; los innerHTML
   parciales no son observables por las pruebas — solo las asignaciones completas).
4. La filosofía "evidencia o no pasó": nunca dar algo por funcionando sin runner
   verde o evidencia real de campo; nunca adivinar nombres de campos de APIs — se
   capturan de respuestas reales.
5. La regla de datos clínicos: jamás inventar valores, fechas ni resultados; ante la
   duda, casilla vacía y aviso al médico (citar los incidentes v11.0.1 en los
   comentarios como fuente).

Criterio de aceptación: documento fiel a lo que dicen los comentarios del código
(con referencias a las versiones citadas, p. ej. "v11.0.1", "v12.0.4"), sin tocar
ningún otro archivo, y salida del runner pegada demostrando que nada se rompió.

---

## TAREA D — Suite nueva de pruebas para utilidades puras sin cobertura

Qué hacer:
1. Mira el resumen del runner: lista las funciones "sin cubrir". Elige SOLO las que
   sean lógica pura (sin DOM): por ejemplo funciones de fechas/calendario y de
   limpieza de texto que aparezcan sin cubrir en `main`.
2. Crea UNA suite nueva en `tests/` (archivo nuevo, registrado como las demás) con
   casos de borde reales: cambios de mes y año, fines de semana en los cálculos de
   días hábiles, cadenas vacías o malformadas en las de texto.
3. PROHIBIDO modificar suites existentes (también tienen cambios locales en vuelo) y
   PROHIBIDO tocar el userscript. Si una función "sin cubrir" resulta imposible de
   probar sin DOM, decláralo en el PR y déjala fuera — no la fuerces.

Criterio de aceptación: suite nueva con todos los casos pasando, cobertura de
funciones estrictamente mayor que antes (pega el antes y el después del resumen del
runner), cero archivos existentes modificados.
