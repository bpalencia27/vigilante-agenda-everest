# Reparto de tareas — Jules · Gemini 3.7 Flash · Claude

> Generado el 14-ago-2026, con el estado del proyecto **verificado contra el código**
> (no contra los .md, que se habían quedado atrás). Rama `claude/pym-agenda-blindaje-v12-4`,
> v14.1.1, banco en 952 comprobaciones verdes, CI verde en Node 18/20/22.

---

## 🔴 PASO 0 — ANTES DE DAR EL REPO A NADIE (solo tú puedes hacerlo)

**Rota la contraseña de Athenea en el sistema de Athenea.**

Estaba escrita en claro en `vigilante_agenda.user.js:896`. Ya la retiré del código
(v14.1.1) — pero **retirarla no la desactiva**: sigue siendo válida, y sigue en el
historial de git, que es exactamente lo que Jules clona.

Después de rotarla, fíjala en cada equipo desde la consola de Tampermonkey:

```js
GM_setValue("vgl_ath_user", "USUARIO_NUEVO");
GM_setValue("vgl_ath_pass", "CLAVE_NUEVA");
```

Mientras no la rotes: **Gemini sí** (le pasas archivos que tú eliges), **Jules no**
(clona el historial completo en una VM con internet).

---

## Cómo repartí, y por qué

| | Jules | Gemini 3.7 Flash | Claude |
|---|---|---|---|
| **Su ventaja real** | 15 VMs en paralelo, escribe en ramas | **1M de contexto: el archivo de 853 KB le cabe ENTERO** | Conoce las regresiones y el historial |
| **Le doy** | Trabajo mecánico, acotado, verificable por el banco | Análisis de solo lectura que exige ver todo el archivo a la vez | Lo clínico y lo que puede dañar al paciente |
| **NO le doy** | Nada clínico ni de PHI | Nada que escriba en el repo | — |

El criterio que mandó: **lo que puede dañar a un paciente no se delega.** Hoy mismo un
catálogo externo perfectamente razonable metió un CUPS equivocado y solo se cazó
cruzándolo contra una orden real tuya.

---

# 🟦 JULES — Tarea 1: la regla de medir está rota

> Pégalo en jules.google → nueva tarea sobre `vigilante-agenda-everest`,
> rama base `claude/pym-agenda-blindaje-v12-4`.

```
[OBJETIVO]
El runner de pruebas acepta que una suite DECLARE cubrir funciones que nunca nombra en su
cuerpo, así que el porcentaje de cobertura que imprime está inflado. Al terminar, el runner
debe fallar cuando una suite declare en `cubre` un nombre que no aparece en su propio código.

[CONTEXTO]
- `tests/runner.js` valida que cada nombre del array `cubre` EXISTA en el API (línea ~70),
  pero NO valida que la suite lo ejercite. `cubre` es un autoinforme.
- Caso concreto: `tests/suite_04_agenda_alertas.js` declara 38 funciones en `cubre` y no
  nombra ~15 en el cuerpo.
- Efecto: el runner dice 351/384 funciones cubiertas cuando la cifra real ronda 325.
- `.github/workflows/tests.yml` tiene `MIN_COVERAGE: 266`, un umbral obsoleto que da ~85
  funciones de holgura: hoy se podrían borrar decenas de pruebas sin que el CI se queje.

[RESTRICCIONES]
- NO toques `vigilante_agenda.user.js`. Cero cambios de producción.
- NO borres entradas de `cubre` para hacer pasar la validación. Si una suite declara algo
  que no prueba, el arreglo correcto es ESCRIBIR la prueba que falta o, si de verdad no
  corresponde a esa suite, quitar la entrada Y decirlo explícitamente en el PR, una por una,
  con su motivo. Quiero saber cuáles eran huecos reales.
- La detección debe ser textual sobre el código de la suite (que el nombre aparezca), no una
  instrumentación en tiempo de ejecución: mantenlo simple y sin dependencias.

[VERIFICACIÓN]
- `node tests/runner.js` termina en verde y ahora imprime la cobertura REAL.
- Rompe una suite a propósito (agrega a su `cubre` un nombre de función real que esa suite
  no use) y demuestra en el PR que el runner FALLA nombrando la suite y el símbolo. Restaura.
- Sube `MIN_COVERAGE` en `.github/workflows/tests.yml` al número real menos 5 de margen.

[ENTREGA]
Rama `test/cobertura-honesta`, abre PR. En la descripción: la cifra antes, la cifra después,
y la lista de qué suites declaraban de más con qué símbolos.
```

---

# 🟦 JULES — Tarea 2: terminar T2 (estilos incrustados)

```
[OBJETIVO]
Migrar a clases CSS los bloques `style="..."` estáticos que quedaron incrustados en el HTML
de los modales, sin ningún cambio visual.

[CONTEXTO]
- La fase T2 del rediseño v14 se declaró terminada (PR #33, commit 5df7871) pero dejó vivos
  ~40 atributos `style=` en el archivo, la mayoría por debajo de la línea 9000, todos en
  modales. Verifica tú mismo el inventario con grep antes de empezar; no confíes en mi número.
- Entre ellos hay al menos tres `font-size:12px` a pelo, que la fase T3 debía convertir en
  tokens (`--t-micro` = 12px). Esos son los más claros: cámbialos por el token.
- El CSS del proyecto vive TODO dentro de un template literal en `buildOverlay()`. Las clases
  nuevas van ahí, junto a las de su modal.

[RESTRICCIONES]
- **Excepción legítima que NO se migra:** los `style=` que pasan un VALOR CALCULADO en
  JavaScript (colores por estado, `--tc`/`--trgb`). Esos se quedan. En `render()` hay tres
  así y son correctos. Solo migras los ESTÁTICOS.
- Cero cambio visual. Si al migrar algo cambiaría de aspecto, NO lo migres: anótalo en el PR
  con su línea y por qué.
- **Un backtick suelto dentro del bloque CSS cierra el template literal y tumba el archivo
  entero.** Ya pasó dos veces. `node -c vigilante_agenda.user.js` después de cada tanda.
- Prefijo `vgl-` obligatorio en toda clase nueva. No redefinas una clase que ya exista:
  hazle grep antes.

[VERIFICACIÓN]
- `node -c vigilante_agenda.user.js` y `node tests/runner.js` en verde.
- La suite `tests/suite_25_cascada_css.js` tiene reglas que vigilan la cascada; deben seguir
  pasando y NO debes relajarlas.
- En el PR, la cuenta de `style=` antes y después, y la lista de los que dejaste con su motivo.

[ENTREGA]
Rama `refactor/t2-estilos-modales`, abre PR. Si son muchos, parte en dos PRs por zonas del
archivo antes que hacer uno gigante.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 1: el archivo entero, de una sola vez

> En Google AI Studio, modelo `gemini-3.7-flash`, **thinking: high**.
> Adjunta `vigilante_agenda.user.js` completo (853 KB — le cabe: su ventana es de 1M tokens).
> **Antes de subirlo, confirma que ya tienes la v14.1.1**, la que ya no lleva la credencial.

```
Eres un auditor de código. Te adjunto UN archivo: un userscript de Tampermonkey de ~853 KB
y ~13.700 líneas que un médico colombiano usa EN VIVO durante consultas reales, sobre el
EHR "Everest". Es un solo archivo por diseño (Tampermonkey instala un archivo único); no
propongas dividirlo ni meter dependencias.

Tu ventaja sobre los demás revisores es que puedes tener el archivo ENTERO en contexto a la
vez. Úsala: busca lo que solo se ve mirando puntos DISTANTES del archivo al mismo tiempo.

Quiero CUATRO cosas, en este orden:

1. CONTRADICCIONES ENTRE DATOS CLÍNICOS DUPLICADOS.
   El archivo tiene catálogos de códigos CUPS (exámenes de laboratorio) en varios sitios:
   WHITELIST_13_LABS, PYM_CATALOG, CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO,
   CONDUCTA_LI_TEXTO_POR_ANALITO, y tablas de vigencias. Ya se detectó UN caso real donde el
   mismo examen (hemoglobina glicosilada) tenía dos códigos distintos en dos sitios.
   Encuentra TODOS los demás: mismo analito con código distinto, mismo código con nombre
   distinto, o un código presente en un catálogo y ausente donde debería estar.
   Para cada hallazgo: el analito, los dos sitios con su número de línea, los dos valores, y
   cuál parece correcto SEGÚN LOS COMENTARIOS DEL PROPIO ARCHIVO (que documentan de dónde
   salió cada código). No decidas tú cuál es el bueno: dime qué dice la evidencia interna.

2. LÓGICA DUPLICADA.
   Bloques que hacen lo mismo en sitios distintos y que, si alguien arregla uno, dejan el otro
   roto. Priorízalos por daño: primero los que tocan datos clínicos, después UI, después
   utilidades. Para cada uno: las líneas, qué comparten, y qué pasaría si divergen.

3. FUNCIONES SIN LLAMADOR ("modo sombra").
   Es el pecado recurrente de este proyecto: funciones escritas, probadas y documentadas como
   terminadas que nadie invoca en el flujo real. Lista TODA función definida en el archivo
   cuyo nombre no aparezca en ningún otro punto del mismo archivo. Distingue tres casos:
   (a) es un punto de entrada del navegador o de un evento, (b) está en sombra de verdad,
   (c) es una utilidad exportada solo para pruebas. Ya conozco estas y NO hace falta que las
   repitas: estadioRenalDelPaciente, apiHcObtenerSignosVitales, _pesoDeSignosVitales,
   vigenciaPorEstadio, analitoTablaDesdeClaveRcv, _conductaBuscarYAgregarExamen,
   panelActivities. Quiero las que NO están en esa lista.

4. ENTRADAS SIN VALIDAR EN CAMINOS CLÍNICOS.
   Sitios donde un valor que viene de la red o del DOM entra a un cálculo clínico sin
   comprobarse. El patrón peligroso concreto: los laboratorios llegan como texto y a veces
   con desigualdad ("> 300", "< 0,3"); Number() de eso da NaN, y un NaN que llega a una
   fórmula puede salir convertido en el resultado MÁS GRAVE en vez de en "no evaluable".

FORMATO: para cada hallazgo, una tabla con línea(s), qué encontraste, por qué importa, y qué
tan seguro estás. Ordena todo por riesgo clínico, no por orden de aparición en el archivo.

NO propongas parches ni reescribas código: solo el informe. Y NO inventes números de línea:
si no estás seguro de una, dilo.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 2: el banco de pruebas, entero

> Misma configuración. Adjunta **todos** los archivos de `tests/` (33 archivos) y también
> `vigilante_agenda.user.js`. Es mucho, y por eso es para él.

```
Te adjunto el banco de pruebas completo (33 archivos) y el código de producción de un
userscript clínico. El banco dice tener 952 comprobaciones en verde. Quiero saber si esa
cifra significa algo.

1. PRUEBAS QUE NO PUEDEN FALLAR. Encuentra las que pasarían aunque el código estuviera roto:
   asertan sobre el mock y no sobre el resultado, comprueban que una cadena existe en el HTML
   sin comprobar el comportamiento, o repiten la misma lógica del código en la aserción.
2. RAMAS QUE SE SALTAN EN SILENCIO. Aserciones dentro de un `if` que puede no ejecutarse
   nunca: la prueba da verde sin haber medido nada. Ya pasó con una guarda de contraste cuyo
   selector dejó de casar. Busca el patrón en todo el banco.
3. QUÉ COMPORTAMIENTO CLÍNICO NO TIENE NINGUNA PRUEBA. Cruza el código contra el banco y dime
   qué caminos que tocan datos de paciente (laboratorios, CUPS, fechas de vigencia, cálculo
   renal, detección de inasistencia) no están cubiertos por ninguna prueba real.
4. Las 5 pruebas que MÁS VALOR aportan y las 5 que menos, argumentado.

Ordena por riesgo clínico. Solo informe, no escribas código.
```

---

# ⬛ LO QUE ME QUEDO YO (Claude)

Por qué estas y no otras: **todas tocan al paciente o dependen de contexto que un agente sin
historia del proyecto no tiene.**

1. **Conectar el motor renal.** Está todo escrito y probado, pero `estadioRenalDelPaciente`
   no la llama nadie. Falta pasarle las entradas y decidir dónde se muestra. Es clínico: un
   estadio mal calculado cambia qué exámenes se le piden a una persona.
2. **El botón de auto-agregar a Conducta** con el cruce antiduplicado propio, como decidiste.
   Toca el ordenamiento real.
3. **`panelActivities`** — el filtro de optometría/odontología que T4 prometió que T5
   reconectaría y nunca se reconectó. Hay que decidir con criterio si se conecta o se borra.
4. **La fusión de los 191 commits a `main`.** Tres tandas están marcadas
   `[NO FUSIONAR SIN APROBACIÓN DEL MÉDICO]` (T4, T5, T7) y necesitan tu visto bueno visual.
5. **Revisar los PR de Jules** antes de que entren.

---

# 🟡 LO QUE SIGUE BLOQUEADO EN TI

Ninguna de estas la puede resolver un agente. Son cinco, y **tres se cierran en una sola
sesión de consultorio**:

| Qué | Por qué te toca a ti |
|---|---|
| **Rotar la contraseña de Athenea** | Acción en el sistema de Athenea |
| **Los 7 `vigenciaDias` de PyM** | Periodicidad clínica; el banner hoy pide de más |
| **Claves reales de labs de Athenea** (TL2) | Abrir un paciente real y pegar las claves que devuelve |
| **Visto bueno de R3** | ¿Se activa la tabla por estadio aunque genere más avisos en G3b/G4? |
| **La lista curada real de CUPS** | Qué quitas del paquete HTA y qué añades — hay nombres capturados, no códigos |
