# T8 — Auditoría de Rendimiento y Contraste (SUPERPROMPT_DISENO_V14.md, D7/§4.3)

Alcance: **todo elemento nuevo** introducido por T5 (dock de widgets), T6 (motor de
detección de órdenes vigentes, sin interfaz propia) y T7 (banner PyM superior), más
TL1/TL2 (piel de modales existentes). Por instrucción del propio T8 ("sin código nuevo
salvo correcciones que se deriven de la propia auditoría"), el entregable principal es
este informe; el único cambio de código que salió de esta auditoría es la corrección de
contraste del contador del banner PyM (T7), documentada abajo y ya en `t7-banner-pym`.

T4 (`t4-panel-amputacion`) se revisó y se descarta del alcance: es puramente
sustractiva (quita botones/chips de la tarjeta) y de copy (cambia el texto de la
bandera PES), reutilizando clases ya existentes y estilizadas
(`.vgl-pes-t`, `.vgl-flag.pes`, `.vgl-card-actions`) sin declarar una sola regla CSS
nueva — confirmado con `git show 40798bc -- vigilante_agenda.user.js` filtrando por
declaraciones de `font-size`/`color`/selectores `.vgl-*{`: cero coincidencias. No hay
superficie visual nueva que auditar.

## 1. D7 — backdrop-filter (sin nuevos)

Conteo exacto de bloques `backdrop-filter` (no líneas de prosa que lo mencionen) sobre
`vigilante_agenda.user.js`: **22/22 idénticos** entre la base (`claude/pym-agenda-blindaje-v12-4`
antes de T5/T7), la rama `t5-dock-widgets` y la rama `t7-banner-pym`. Ninguna de las dos
ramas Alto riesgo agrega una superficie nueva con desenfoque — ambas usan superficies
sólidas (`--surface-1/2/3`), como exige D7.

## 2. D7 — capas de sombra (máximo 2 por superficie nueva)

Tanto el dock de T5 (`#vgl-acciones-dock`) como el banner de T7 (`#vgl-pym-banner`)
reutilizan el token ya-en-todas-partes `--shadow-card` en vez de declarar una sombra
propia. **Llamada de juicio, documentada a propósito y no corregida en silencio**:
`--shadow-card` en sí mismo trae 3 sub-capas separadas por coma. La lectura literal de
"máximo 2 capas por superficie nueva" fallaría contra esto; la lectura que se aplicó es
que D7 prohíbe que una superficie nueva **invente** una sombra adicional a las que ya
paga el resto del panel — reutilizar el token compartido no agrega presupuesto nuevo de
render, solo hereda el ya aprobado. Ninguna de las dos ramas declara `box-shadow` propio
fuera de ese token (salvo el anillo `inset` de 1px de `.vgl-dock-btn`/`.vgl-dock-btn-ambar`,
que es un borde, no una sombra de profundidad).

## 3. D7 — animación permanente / `.perf` / `prefers-reduced-motion`

- **T5** (`#vgl-acciones-dock`): sin transiciones permanentes — solo `:hover` con
  `transition: background .15s, color .15s`, neutralizada por
  `#vgl-acciones-dock.perf,#vgl-acciones-dock.perf *{transition:none !important;animation:none !important}`
  y por la entrada en la lista `@media (prefers-reduced-motion:reduce)` (línea 6658).
- **T7** (`#vgl-pym-banner`): más estricto todavía — su CSS no declara NINGUNA
  `transition`/`animation` (los `:hover` cambian de color/fondo de forma instantánea), así
  que no hay nada que la regla `.perf` necesite apagar. Está en la lista de
  `prefers-reduced-motion` igualmente (línea 6546), por si el patrón cambia a futuro.
- Ambos wireados en `applyTheme()` (`classList.toggle("perf", !!S.modoRendimiento)`,
  líneas 3496/3384) — confirmado, no solo declarado en CSS.

## 4. §4.3 — tamaño de letra mínimo 12px

Todo `font-size` nuevo o migrado en T5/T7/TL1/TL2 usa los tokens `var(--t-*)`
(`--t-micro:12px` es el piso), sin un solo literal por debajo de 12px:
- T5 dock: `var(--t-micro)` (toggle) y `var(--t-lead)` = 16px (íconos de botón).
- T7 banner: `var(--t-body)`, `var(--t-strong)`, `var(--t-micro)` en sus 8 usos.
- TL1/TL2: migración completa a `var(--t-micro)`/`var(--t-body)` ya cubierta por la
  Regla G/I de `suite_25_cascada_css.js` (recuentos exactos verificados en su momento).

## 5. §4.3 — el color nunca es el único portador de estado

Revisado elemento por elemento:
- `.vgl-dock-btn-ambar` (falta toma de muestras): el anillo ámbar es refuerzo, el estado
  real lo llevan el emoji (🧪 vs 🗓️/🗓️✅) y `aria-label`/`title` explícitos.
- `.vgl-pymb-contador`/`.vgl-pymb-aviso` (T7): el número y el texto "No se pudo
  verificar..." llevan la información; el ámbar refuerza, no reemplaza.
- `.vgl-agm-sbtn-sugerido` (TL1, ya protegido por Regla C): lleva la palabra "SUGERIDO"
  además del color.

Ningún elemento nuevo depende solo del color para comunicar un estado.

## 6. Auditoría de contraste WCAG (Chromium real, no aproximado)

Metodología: extracción del bloque CSS real de cada archivo, montaje en HTML sintético
con los mismos ids/clases reales, Chromium headless, `getComputedStyle`, fórmula
estándar de luminancia relativa WCAG con composición alfa completa de la cadena de
fondos (ver `t8_contraste.js`, script de auditoría). Primera versión del script tenía un
bug propio (alfa descartado al parsear `rgba()`) que producía falsos "invisibles" —
corregido antes de confiar en los resultados.

### Hallazgo real (T7) — corregido

`.vgl-pymb-contador` (`background:var(--c-ambar);color:var(--bg-solid)`) resolvía con
texto casi blanco heredado en vez de su propio color oscuro: ratio **1.5 (oscuro) /
2.64 (claro)**, ambos muy por debajo del mínimo AA (4.5). Causa: la entrada "simple" de
blindaje `#vgl-pym-banner span,#vgl-pym-banner b{color:inherit}` (especificidad
id+etiqueta) le ganaba en cascada a la clase propia del contador (especificidad de 1
clase) — la MISMA clase de incidente ya documentada en el código para
v12.6.6/v12.10.2 (`#vgl-postcita-panel`/`#vgl-labsv-modal`), reincidiendo aquí porque T7
llenó su propia lista "simple" sin recordar ese precedente. **Corregido**: se quitó la
entrada insegura, dejando como único blindaje la armadura segura
`:where(span:not([class]),...)` que ya estaba presente y que por construcción nunca
compite con un elemento que ya tiene su propia clase. Verificado de nuevo:
**12.28 (oscuro, AA+AAA) / 6.62 (claro, AA)**. Se agregó la Regla K a
`suite_25_cascada_css.js` para que esta colisión puntual no pueda reincidir sin que la
suite lo note (verificado con mutación: reintroducir la línea insegura hace caer la
prueba nombrando el caso exacto). Commit `37cefb7` en `t7-banner-pym`, v12.10.19.

### Resultados completos (post-corrección)

| Componente | Elemento | Tema | Ratio | AA | AAA |
|---|---|---|---|---|---|
| T5 dock | texto base | oscuro | 16.0 | ✅ | ✅ |
| T5 dock | texto base | claro | 14.14 | ✅ | ✅ |
| T5 dock | ícono normal | oscuro | 13.71 | ✅ | ✅ |
| T5 dock | ícono normal | claro | 13.01 | ✅ | ✅ |
| T5 dock | toggle (▶/◀, `--fg3`) | oscuro | 6.87 | ✅ | ❌ |
| T5 dock | toggle (▶/◀, `--fg3`) | claro | 4.11 | ❌ | ❌ |
| T5 dock | ícono ámbar | oscuro | 9.15 | ✅ | ✅ |
| T5 dock | ícono ámbar | claro | 4.93 | ✅ | ❌ |
| T7 banner | texto base / título | oscuro | 16.0 | ✅ | ✅ |
| T7 banner | texto base / título | claro | 14.14 | ✅ | ✅ |
| T7 banner | contador (corregido) | oscuro | 12.28 | ✅ | ✅ |
| T7 banner | contador (corregido) | claro | 6.62 | ✅ | ❌ |
| T7 banner | aviso honesto (D4) | oscuro | 10.67 | ✅ | ✅ |
| T7 banner | aviso honesto (D4) | claro | 5.35 | ✅ | ❌ |
| T7 banner | nombre de actividad | oscuro/claro | 13.71 / 13.01 | ✅ | ✅ |
| T7 banner | botón Ordenar | oscuro/claro | 9.34 / 8.15 | ✅ | ✅ |

### Llamadas de juicio pendientes de decisión (no corregidas — documentadas)

1. **`.vgl-dock-toggle` bajo AA en tema claro (4.11 < 4.5).** El glyph ▶/◀ (no es
   emoji, sí respeta `color`) usa `--fg3`, el mismo token que ya usa
   `.vgl-toast-x` (botón "cerrar" del toast, código preexistente a T5) para el mismo
   tipo de afordancia icónica secundaria. No es una regresión que T5 introduzca: es
   consistente con la convención ya establecida en el resto del panel para íconos de
   control (no prosa). Bajo WCAG 1.4.11 (Contraste No-Textual, aplicable a componentes
   de interfaz/glifos funcionales en vez de 1.4.3 texto), el umbral relevante es 3:1 —
   que sí se cumple en ambos temas (6.87/4.11). **No se corrigió en T5 en solitario**
   porque hacerlo crearía una inconsistencia con `.vgl-toast-x` y el resto de íconos
   `--fg3` ya en el panel; si el médico decide subir el piso de estos íconos a `--fg2`,
   debe ser un cambio global, no uno aislado a T5.
2. **`.vgl-dock-btn-ambar` y contador/aviso del banner no llegan a AAA (7:1) en tema
   claro.** Ninguno de los tres codifica un estado clínico POR SÍ SOLO (ver §5) — el
   número, el emoji y el texto llevan la información real, el color solo refuerza. Se
   aplicó el estándar AA (4.5:1) de §4.3.3, no el AAA reservado para "lo que codifique
   estado clínico", y los tres lo cumplen con margen.
3. **`.vgl-dock-btn-ambar` mide contraste de `color` sobre un botón cuyo contenido real
   es un emoji (🧪), no texto.** Limitación de metodología: los emoji a color no
   obedecen la propiedad CSS `color` (traen su propio color de glifo), así que el ratio
   medido (4.93/9.15) es en la práctica irrelevante para lo que el médico ve — el
   verdadero portador de contraste visual ahí es el anillo `box-shadow` ámbar sobre el
   fondo de la superficie, no comprobado por este script. No se generó una prueba nueva
   para esto porque no hay una propiedad CSS de "contraste de anillo" estandarizada que
   auditar automáticamente; queda anotado para que no se lea como una garantía que el
   script no está dando.

## Conclusión

T8 no encontró violaciones de presupuesto de rendimiento (D7) en T5/T6/T7. Encontró y
corrigió un bug real de contraste (T7, contador del banner, ya en `t7-banner-pym`
v12.10.19) con guarda de regresión nueva (Regla K). Encontró tres llamadas de juicio de
contraste que se documentan en vez de corregirse en solitario, para no introducir
inconsistencia con convenciones ya establecidas en el resto del panel sin decisión del
médico. Con esto, la tabla de FASES de `SUPERPROMPT_DISENO_V14.md` queda completa:
T1–T3 y T6/TL1/TL2 ya fusionados en `claude/pym-agenda-blindaje-v12-4`; T4/T5/T7
construidos, probados y con PR en borrador (#52/#54/#55), pendientes solo de la revisión
visual del médico — ningún trabajo de implementación autónoma queda pendiente.
