# Instrucciones para agentes de código

> Lo lee **Jules** automáticamente desde la raíz. Aplica igual a cualquier otro agente
> que trabaje este repo: Claude Code, Gemini 3.7 Flash, Codex, Copilot, Cursor.
> **Un prompt explícito del usuario tiene prioridad sobre cualquier regla de aquí.**
> Manual operativo de los agentes externos: `jules.md`.

Este repo es un userscript de Tampermonkey (`vigilante_agenda.user.js`, IIFE único,
sin build) que un médico usa EN VIVO durante consultas reales en un EHR ajeno
("Everest"/Athenea Soluciones). Un bug aquí puede mostrar un dato clínico incorrecto
o desplazar una cita real. Lee también `CLAUDE.md` en la raíz — tiene las reglas
completas del proyecto y el historial de bugs de CSS ya encontrados hoy.

## Datos duros del repo (verificados 14-ago-2026 — no los cites de memoria)

| Dato | Valor real |
|---|---|
| Archivo de producción | `vigilante_agenda.user.js`, **~885 KB** (14.158 líneas), un solo archivo |
| Banco de pruebas | `node tests/runner.js` (= `npm test`), **976 comprobaciones en verde** |
| Suites | `tests/suite_01…suite_29` (30 suites) — ya NO existe `PARA_JULES/`, se migró |
| Python | **No hay** `pytest` en este repo (eso es el repo hermano del Copiloto) |
| CI | `.github/workflows/tests.yml` |
| Rama de trabajo | `claude/pym-agenda-blindaje-v12-4` |

## Alcance de la tarea

Trabaja SOLO lo que el prompt pide. Si al hacerlo notas algo más que parece roto,
anótalo en la sección "Hallazgos NO tocados" de tu PR — no lo arregles sin que te
lo pidan aparte.

## Verificación — no basta con que las pruebas pasen

- Si tu cambio toca CSS o el color/tamaño/visibilidad computado de un elemento:
  verifica con Playwright (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
  `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) usando `getComputedStyle(...)` sobre
  el HTML+CSS REAL extraído de `tests/harness.js` + `buildOverlay()` — nunca sobre
  una copia recortada a mano. Una prueba que solo hace
  `innerHTML.includes('class="...")` NO demuestra que el color/estilo renderizado
  sea correcto — ya causó bugs reales que llegaron a producción.
- Si agregas o usas una variable CSS custom property (`var(--algo)`), confirma con
  `grep` que esa variable está REALMENTE definida en algún `:root`/selector de
  tokens del archivo. Una variable sin definir no es un error visible — el
  navegador la trata como inválida y el elemento hereda el color del ancestro (en
  este proyecto, eso casi siempre termina siendo el azul de Everest).
- Si tu tarea usa datos de referencia del mundo real (festivos, fórmulas médicas,
  códigos CUPS/ICD, tasas, etc.): cita la fuente exacta en el PR. No inventes ni
  "completes de memoria" una fecha o un valor — la regla del proyecto es "casilla
  vacía antes que dato inventado", y ya se coló una vez una tabla de festivos con
  fechas que no existen.

## Higiene del repositorio

- No commitees NUNCA tus propios archivos de trabajo: scripts de Python que uses
  para aplicar cambios, borradores de descripción del PR, logs de salida del
  runner, etc. Si los creaste para tu propio flujo, bórralos antes de terminar.
  `git status` antes de tu commit final debe mostrar SOLO los archivos del
  producto (`vigilante_agenda.user.js`, `tests/*.js`, `tests/INFORME_MUTACIONES.md`)
  y ningún `.py`/`.txt` suelto en la raíz.
- El mensaje de commit y la descripción del PR deben describir el diff REAL.
  Antes de escribirlos, corre `git diff` y verifica cada frase contra lo que
  realmente cambió — no describas una acción que no hiciste (ej. "limpié
  archivos" cuando el diff los agrega, o "restauré un valor" cuando el cambio
  fue un no-op).

## Invariantes de dominio — el "por qué" detrás del código que parece raro

Si algo de aquí te parece un bug, **no lo es**. Está así a propósito, casi siempre porque
ya falló una vez en consulta real. Verificado contra el código el 14-ago-2026.

### Colores y detección de fraude (`colorAndAlert`, ~línea 5680)

| Color | Significado | Regla |
|---|---|---|
| 🟢 VERDE | A tiempo | Llegada dentro de tolerancia |
| 🟣 MORADO | Pre-alerta | Retraso ≥ pre-alerta pero < gracia, o 3+ actividades de PyM |
| 🟠 ÁMBAR | Sin presentarse | Retraso ≥ gracia → además entra en `fraudWatch` |
| 🔴 ROJO | Atención extemporánea | Estaba en `fraudWatch` y reaparece. Sonido **una sola vez** |
| 🔵 AZUL | Normal | — |

- **`Atendido` NO cuenta como confirmación de llegada.** La rama de `Atendido` consulta
  `fraudWatch`, **no solo** `alertedFraud`: si la agenda salta de `Sin presentarse` directo
  a `Atendido`, sin eso el caso se pintaba VERDE. *(Regresión real.)*
- **`apptKey` incluye la hora**, no solo la cédula
  (`doc_id + "@" + hora_texto`, línea 5655). Un paciente con dos citas el mismo día
  compartía estado y se le acusaba al llegar puntual a la segunda. *(Regresión real.)*
- **`diaNuevo()` limpia `fraudWatch`/`alertedFraud` al cambiar de día** (línea 5659). Sin
  esto, una pestaña abierta toda la noche acusa hoy a quien estuvo en la lista ayer.
  *(Regresión real.)*
- El sonido de ROJO es **edge-triggered**: `alertedFraud` garantiza una sola alerta por
  cita. No lo conviertas en un aviso repetido.

### Reglas de negocio de PyM

- Entre las ETS **solo se conserva VIH**. VDRL/sífilis/hepatitis B y C se ocultan (meta ya
  cumplida en la IPS). La lista es `S.excluir` (línea 3483) y es configurable, pero
  **VIH nunca se oculta** — es seguridad clínica, no preferencia.
- Hepatitis aparece en la base como `HVC`/`VHC`/`HBV`/`VHB`: por eso la lista trae las
  cuatro grafías.
- La exclusión **no afecta** cérvix, mama, colon, próstata, citas ni valoración.

### Evidencia clínica: nunca inventes un código

Los CUPS, las vigencias y los festivos **solo se añaden con fuente citada**. La jerarquía
de confianza, de mayor a menor, es:

1. Una **orden real ya guardada** en Everest (`ObtenerOrdenamientoPorPacienteIdVigente`).
2. Un **clic capturado** en consultorio (`captura_*.json` + el texto literal del `<li>`).
3. Un catálogo de otro repo del proyecto.

Ya ocurrió que (3) contradijo a (1) y se coló un código equivocado — **gana siempre el de
más arriba**. Y ya se coló una vez una tabla de festivos con fechas que no existen.

## Reglas del proyecto (no negociables — ver CLAUDE.md para el detalle completo)

- Casilla vacía antes que dato inventado.
- La casilla del médico es sagrada: nunca sobrescribir en silencio algo que el
  médico ya escribió.
- **El script sugiere, el médico decide.** Nada se ordena, agenda ni confirma solo.
- **Un solo archivo.** Nunca dividas `vigilante_agenda.user.js` en módulos ES ni
  introduzcas un bundler: Tampermonkey instala un archivo único y cualquier `import`
  lo rompe. Sin dependencias externas en runtime (el lector de `.xlsx` está escrito a
  mano con `DecompressionStream` + regex justo para no depender de librerías; no lo
  "mejores" metiendo SheetJS).
- Si añades un dominio de red, decláralo en `@connect` de la cabecera del userscript.
- No renombres las clases CSS con prefijo `vgl-` a nombres genéricos: se prefijaron a
  propósito porque el CSS de Everest pisaba `.hint`, `.col`, `.seg`, `.d`.
- Cero PHI en código, tests, comentarios ni commits.
- Toda regla CSS nueva que viva fuera de `#vgl-root` (cualquier modal/aviso que
  cuelga directo de `document.body`) necesita `!important` en sus declaraciones
  de `color` si son clase (no estilo inline) — el CSS de Everest es una caja
  negra que puede ganarle a una regla sin `!important`.
- Nunca redefinas una clase CSS que ya existe en otro punto del archivo — grep
  el nombre de la clase primero; si ya existe, edita esa definición, no agregues
  una segunda.

## Antes de enviar: parte de la punta actual

Esta rama se mueve rápido (hoy se fusionaron 6 PRs en una tarde). Antes de abrir el PR,
trae la rama base y rebasa tu trabajo encima:

```
git fetch origin claude/pym-agenda-blindaje-v12-4
git rebase origin/claude/pym-agenda-blindaje-v12-4
node tests/runner.js     # debe seguir verde DESPUÉS de rebasar, no solo antes
```

Dos PRs de hoy llegaron 39 y 8 commits por detrás de la punta: uno de ellos, al rebasarlo,
resultó tener conflictos reales en tres archivos. Rebasar tú mismo es más barato que
descubrirlo en la revisión.

`tests/INFORME_MUTACIONES.md` es una tabla que solo crece: agrega tu fila **al final**.
Si dos tareas paralelas agregan filas, el conflicto es trivial — resuélvelo conservando
AMBAS filas, nunca descartando la ajena.

## Pruebas y mutación

- `node tests/runner.js` debe terminar en verde antes de abrir el PR.
- Un `t.caso` nuevo va como caso HERMANO del anterior, no anidado dentro de su callback.
  Pasó hoy: faltó un `});` y el caso nuevo quedó dentro del anterior — el banco seguía en
  verde (JS permite la llamada anidada), pero la prueba nueva dependía en silencio de que
  la anterior no lanzara antes de esa línea. Comprueba las dos cosas antes de enviar:
  `node -c tests/<tu_suite>.js` y que el contador de esa suite en la salida del runner
  subió exactamente en el número de casos que agregaste.
- Todo cambio de comportamiento requiere mutación verificada: rompe el cambio a
  propósito, confirma que una prueba específica se pone roja, restaura, confirma
  que vuelve a verde. Documenta cada mutación en `tests/INFORME_MUTACIONES.md`
  con el MISMO formato de las filas existentes: `| Línea | Mutación Aplicada |
  ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |`. No cambies el orden de las
  columnas ni pongas el nombre del test donde va la línea.
- **Restaura CADA mutación antes de pasar a la siguiente**, sin excepción. Ya pasó que
  una mutación quedó sin restaurar durante una interrupción y luego se depuró durante
  un buen rato un fallo que era la propia mutación olvidada.
- **Ninguna rama de una prueba puede saltarse en silencio.** Si envuelves una
  comprobación en `if (algo_se_pudo_leer)`, esa mitad puede no ejecutarse nunca y dar
  verde sin haber medido nada — pasó con una guarda de contraste cuyo selector dejó de
  casar. Asegura primero que el dato se leyó (`t.cierto(!!dato, …)`) y comprueba después.
- Cuidado con el arnés: `textContent` en `tests/harness.js` es una propiedad estática
  que NO se deriva de `innerHTML` ni de `appendChild`. Para leer lo que pintó el
  código, usa `.innerHTML`, como el resto de las suites.
- `t.casoAsync` **siempre** con `await` delante. Sin él, las pruebas corren en carrera
  contra el mock compartido de la suite y dan resultados falsos; hay una prueba
  centinela que lo caza y nombra las líneas exactas.
