# Instrucciones para Jules

Este repo es un userscript de Tampermonkey (`vigilante_agenda.user.js`, IIFE único,
sin build) que un médico usa EN VIVO durante consultas reales en un EHR ajeno
("Everest"/Athenea Soluciones). Un bug aquí puede mostrar un dato clínico incorrecto
o desplazar una cita real. Lee también `CLAUDE.md` en la raíz — tiene las reglas
completas del proyecto y el historial de bugs de CSS ya encontrados hoy.

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

## Reglas del proyecto (no negociables — ver CLAUDE.md para el detalle completo)

- Casilla vacía antes que dato inventado.
- La casilla del médico es sagrada: nunca sobrescribir en silencio algo que el
  médico ya escribió.
- Cero PHI en código, tests, comentarios ni commits.
- Toda regla CSS nueva que viva fuera de `#vgl-root` (cualquier modal/aviso que
  cuelga directo de `document.body`) necesita `!important` en sus declaraciones
  de `color` si son clase (no estilo inline) — el CSS de Everest es una caja
  negra que puede ganarle a una regla sin `!important`.
- Nunca redefinas una clase CSS que ya existe en otro punto del archivo — grep
  el nombre de la clase primero; si ya existe, edita esa definición, no agregues
  una segunda.

## Pruebas y mutación

- `node tests/runner.js` debe terminar en verde antes de abrir el PR.
- Todo cambio de comportamiento requiere mutación verificada: rompe el cambio a
  propósito, confirma que una prueba específica se pone roja, restaura, confirma
  que vuelve a verde. Documenta cada mutación en `tests/INFORME_MUTACIONES.md`
  con el MISMO formato de las filas existentes: `| Línea | Mutación Aplicada |
  ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |`. No cambies el orden de las
  columnas ni pongas el nombre del test donde va la línea.
