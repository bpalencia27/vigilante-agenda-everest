# Vigilante de Agenda — Copiloto Everest PyM

Userscript de Tampermonkey (`vigilante_agenda.user.js`, IIFE único, sin build, sin
dependencias) que un médico usa EN VIVO durante consultas reales en el EHR "Everest"
(Athenea Soluciones). Un error aquí desplaza citas o hace perder tiempo de consulta real.

## Reglas del proyecto (no se negocian)

- **Casilla vacía antes que dato inventado.** Si no hay evidencia real, se deja vacío —
  nunca se rellena con un valor supuesto.
- **La casilla del médico es sagrada.** Ningún botón sobrescribe en silencio algo que el
  médico ya escribió a mano. Siempre: solo casillas vacías, nunca pisar texto existente.
- **El médico manda, el script sugiere.** El script no actúa por su cuenta sin un clic
  explícito del médico (con la excepción puntual de botones que el propio médico pidió
  que actúen sin cuadro de confirmación — eso se documenta caso por caso, ver v12.10.4).
- **Cero PHI.** Nunca nombres, cédulas ni datos de paciente reales en código, tests,
  comentarios, commits ni descripciones de PR. Los scripts de diagnóstico que corre el
  médico en consola (`DIAGNOSTICO_*.js`) redactan cualquier dato identificable antes de
  guardar o descargar nada.

## CSS: nunca dejar que se mezcle con el de Everest

Este script inyecta su UI directamente sobre el DOM de Everest (Angular, con su propio
CSS global). Dos formas DISTINTAS en que el CSS de Everest se ha colado, ambas reales,
ambas reportadas por el médico en vivo — cualquier regla de color nueva debe defenderse
de las dos:

1. **Nuestra propia regla vieja gana por especificidad a nuestra propia regla nueva**
   (bug del botón ámbar T1, bug de `#vgl-postcita-panel`/`#vgl-labsv-modal` v12.10.2):
   una regla `id div,span,b{color:inherit}` (especificidad tipo id+tipo) le ganaba a
   una clase de acento nuestra (`.vgl-postcita-title{color:var(--c-verde)}`). Fix
   establecido: el "blindaje tipográfico" `:where(...:not([class]))` (v12.3.15) —
   especificidad CERO, y `:not([class])` para que solo alcance a elementos sin clase
   propia, nunca para competir con una clase de acento.
2. **Una clase nuestra sin `!important` pierde contra el CSS de Everest** (bug de
   `.vgl-labsv-lead`/`.vgl-labsv-foot` v12.10.5): una clase con `color:var(--fg2)`
   (especificidad 10, sin `!important`) puede perder contra cualquier regla de Everest
   de especificidad ≥10, o contra cualquier regla con `!important` sea cual sea su
   especificidad — y Everest es una SPA de Angular ajena, su CSS real es una caja negra
   que puede cambiar. El estilo inline (`style="color:..."`) SÍ es inmune a esto (gana a
   cualquier regla no-`!important`), por eso `.vgl-labsv-t`/`.vgl-labsv-n` (inline) no se
   vieron afectados mientras `.vgl-labsv-lead`/`.vgl-labsv-foot` (solo clase) sí.

**Regla práctica para toda regla de color nueva en un panel/modal que se pega
directamente a `document.body`** (fuera de `#vgl-root`: `#vgl-pym-modal`, `#vgl-pes-modal`,
`#vgl-labs-modal`, `#vgl-labsv-modal`, `#vgl-postcita-panel`, `#vgl-agendar-modal`,
`#vgl-ordenar-modal`) — estos NO heredan ninguna protección de un ancestro propio:

- Si el elemento tiene una clase propia con `color:var(--x)`: ese `color` lleva
  **`!important`**. Sin excepción. (Ejemplo correcto: `.vgl-labsv-lead{color:var(--fg2)
  !important}`.)
- Si el elemento es un `<b>/<span>/<i>/...` SIN clase propia (texto suelto dentro de un
  párrafo): usar el patrón `:where(selector-del-panel :not([class])){color:inherit}` ya
  establecido — nunca `selector-del-panel b,span,div{color:inherit}` a pelo (eso reintroduce
  el bug #1).
- Antes de dar por buena una regla de color nueva, **verificar con Chromium contra el CSS
  REAL** (no una copia recortada a mano): cargar el userscript con `tests/harness.js`,
  llamar `buildOverlay()` (o la función que genera el HTML del modal en cuestión), extraer
  el `<style>` real generado, y montarlo en una página de prueba con un CSS "Everest"
  simulado que incluya al menos una regla `div,span,p,b,small,label{color:X !important}`
  — si el color esperado sobrevive a esa simulación agresiva, sobrevive a cualquier cosa
  menos agresiva que la vida real le tire encima.

`tests/suite_25_cascada_css.js` (Regla A: colisión de especificidad idéntica entre
clases que conviven; Regla B: `!important` nuestro contra `.style` de JS nuestro) protege
contra bugs *internos* de nuestra propia hoja de estilos. **No protege contra el CSS de
Everest** — eso es un adversario externo cuya especificidad no podemos conocer de
antemano, y la única defensa robusta es `!important` en toda regla de color que viva
fuera de `#vgl-root`.

## Flujo de trabajo con Jules

Jules (agente de jules.google.com) recibe tareas acotadas por prompt (`PROMPT_JULES_*.md`)
para trabajo de bajo riesgo — tests, lógica pura, refactors mecánicos bien delimitados.
El trabajo de CSS/DOM/producción-crítica en vivo lo hace Claude directamente, sin pasar
por Jules, porque necesita verificación empírica inmediata (Chromium) mientras el médico
está en consulta.

- Jules está en "modo reactivo": solo actúa en comentarios de PR que lo mencionen
  explícitamente con `@jules`.
- **Nunca fusionar un PR de Jules solo por su resumen de chat.** Siempre: pull del diff
  real vía API de GitHub, correr `node tests/runner.js` uno mismo, y si el PR toca CSS,
  verificar en Chromium — el resumen de un PR puede describir un cambio distinto al que
  el diff realmente contiene.
- Antes de fusionar, verificar que la base del PR esté al día con la rama base actual
  (`git log` del PR vs. `origin/<rama-base>`); si está desactualizado, rebasar/mergear uno
  mismo en un worktree en vez de pedirle a Jules que lo repita.

## Disciplina de pruebas

- `node tests/runner.js` — banco de pruebas propio, sin frameworks externos.
- Todo cambio de comportamiento (propio o de Jules) requiere **mutación verificada**:
  romper el cambio a propósito, confirmar que una prueba específica se pone roja,
  restaurar, confirmar que vuelve a verde, y añadir una fila a
  `tests/INFORME_MUTACIONES.md`.
- Bump de `@version` (encabezado del userscript) y del `const VERSION` en cada entrega.
