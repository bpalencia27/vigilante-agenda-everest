# Auditoría UI_Estetico — Vigilante de Agenda v18.0.113 (02-sep-2026)

Agente: **UI_Estetico** (diseño de interfaces modernas). Alcance: solo lectura sobre
`vigilante_agenda.user.js` (hoja principal L15974–19328, hojas spliceadas `MTR_RCV_CSS` L15698,
`VGL_UX_CSS` L15811, `MTR_CSS` L45401). Cero PHI: toda la agenda es sintética.

## 0. Método (todo medido, nada deducido)

1. `tests/harness.js` → `cargar({silencioso:true})` → `buildOverlay()` → se extrae el `<style>` REAL
   (269 802 caracteres, con los cuatro splices ya resueltos, igual que `tools/verificar_color_chromium.js`).
2. Cada superficie se abre con la MISMA función que en consulta (`openAgendamientoModal`,
   `openLaboratoriosModal`, `openOrdenamientoModal`, `openPanelPacienteModal`, `openPaquetesModal`,
   `mostrarPanelPostCita`, `_vglChooserModal`, `_acompMostrar`, `mtrAbrirPanelRedaccion`,
   `avisoUniversal`, `bigAlert`, inyectores) y se serializa su HTML. El DOM falso del arnés deja
   `el.list`/`el.sheet` en `null`, así que las tarjetas del panel, los toasts, el dock de acciones,
   la barra de minimizados, el banner PyM y el toast del piloto se montan con la **plantilla literal
   del código** (`render()` L31239–31275, `_renderToast` L14445, `_vglDockRotulo` L7493,
   `vglMinPintarBarra` L13955).
3. Chromium real (Playwright, `/opt/pw-browsers/chromium`) a **1366×768** y **1920×1080**, sobre un
   Everest simulado (SPA clara, cabecera `#1f4e79`, formulario de historia) con el adversario
   canónico de CLAUDE.md (`div,span,p,b,small,label,li,td,th{color:#1f4e79 !important}`).
4. Contraste WCAG 2.x calculado sobre **728 nodos de texto** (oscuro, claro y alto contraste) con
   composición real de fondos: `background-color` + promedio de las paradas del `background-image`
   + opacidad acumulada de los ancestros. Umbral 4,5:1 (3:1 para ≥18,66 px negrita).
5. Además: `prefers-reduced-motion` emulado, animaciones `infinite`, foco de teclado real (Tab),
   capas `backdrop-filter`, rectángulos de todas las superficies flotantes y sus intersecciones,
   y cada propuesta re-medida con el mismo medidor (`variantes.js`).

Archivos en esta carpeta: `render.js`, `variantes.js`, `css_real.css`, `html_vgl-*.html`,
`resultados.json`, `variantes.json`, 38 capturas PNG (`panel_*`, `agendar_*`, `labs_*`, `ia_*`,
`pym_*`, `bigalert_*`, `chooser_*`, `paquete_*`, `banner_*`, `esquina_*`, `colisiones_*`,
`minbar_*`, `burbuja_*`, `sp_toast_claro_*` y las `propuesta_*`).

**Numeración de líneas.** Toda cita `Lnnnn` es de la instantánea **v18.0.113** del árbol de trabajo
a las 12:57 UTC (la que cargó el arnés). Mientras se medía, otro agente del enjambre publicó
v18.0.114/115 (13:05–13:13 UTC, C17 «Agendar recuerda tipo y especialidad»). Desplazamiento
verificado ancla por ancla (`anclas.txt`): **+10 líneas** para todo lo comprendido entre la L4753 y la
L18869 antiguas (todas las hojas CSS citadas), **+12** desde ahí hasta ~L22708 (pie de Agendar/Ordenar,
cabecera del panel L19361 → 19373) y **+89** en `render()` (L31266 → 31355). Cada evidencia lleva
también el selector, que es lo que sobrevive. El censo de la Regla G ya no es 655 sino **656**
(`.vgl-agm-pref-txt`, C17): donde este informe dice «655 → 654» léase «656 → 655». La UI nueva de
C17 (chip «cambiar», `.vgl-agm-pref-txt`) queda fuera de esta auditoría.

Cobertura: 21 superficies medidas. No se pudo abrir en el arnés `#vgl-pes-modal`/`#vgl-labsv-modal`
(sin llamador desde v14.2.0: el aviso universal los reemplaza) ni las hojas Resumen/Ajustes
(`el.sheet` nulo): sus reglas se auditaron solo por lectura.

---

## FASE 1 — Recorrido visual

### 1.1 Tokens y paleta (L15988–16135)
- **OLED-friendly ✅**: `--bg-solid:#090c12`, `--toast:rgba(13,16,24,.94)`, velo `#vgl-modal`
  `rgba(2,4,9,.72)`. No hay `#000` de fondo en ninguna superficie: sin *smearing*.
- **El vidrio del panel se calibró sobre negro, pero vive sobre blanco.** El comentario de L15997
  dice «Triaje neón-pastel — AAA (≥7:1) sobre fondo OLED». El panel es `--bg:rgba(7,10,16,.88)`
  (L15991) y Everest es una SPA clara: el fondo efectivo medido dentro de una tarjeta es
  `#3c414a`–`#4d3b3e`, no `#090c12`. Resultado: 7 de 80 nodos del panel oscuro quedan bajo AA
  (badge «En sala» azul 3,89:1; «Atendido» 4,26:1; «No confirmado» 4,32:1; «+1 más» 4,36:1;
  «➕ CANDIDATO ADICIONAL» 4,30:1; «Cargar prevención» 4,46:1). Con `--bg` a `.94` (re-medido)
  las fallas bajan de **7 → 1** y el vidrio sigue viéndose (`propuesta_panel_oscuro_alpha94_1366x768.png`).
- **Tema claro: tres acentos quedan cortos** (`--c-morado:#0e7490`, `--c-azul:#6d28d9`,
  `--c-verde:#065f46`, L16087–16088) cuando van sobre sus propios tintes al 16–30 %: 9 fallas en el
  panel claro (cuenta regresiva «en 12 min» 3,39:1; «+1 más» 2,69:1; badge «Confirmada» 3,48:1),
  1 en Agendar («Siguiente: Elegir Fecha y Turno» 4,39:1), 2 en Redactor IA («Generar» 3,99:1;
  chip activo 4,26:1), 2 en Laboratorios («Cerrar» 4,11:1). Con cyan-800/violet-800/emerald-900
  (re-medido): panel 9 → 5, Agendar 1 → 0, IA 2 → 0, Labs 2 → 1 (la única que queda es el texto de
  carga con pulso de opacidad).
- Los rellenos literales `rgba(255,255,255,.04–.05)` (`.vgl-chip` L17308, `.vgl-complex-pill`
  L15909, `.vgl-bento-badge.nd` L15941, `#vgl-head` L16514) no tienen gemelo claro: en tema claro
  son un no-op y el chip solo lo delimita su borde al 7 %.

### 1.2 Escala tipográfica (Regla G)
- Tokens: `--t-micro/body/lead/strong/title/hero` = 12/14/16/15/18/22 px, consumidos 148/36/7/7/6/12
  veces. Bien cableado en lo grande.
- **57 declaraciones literales fuera de la escala** en las hojas CSS: `11px`×13, `12.5px`×10,
  `13px`×8, `11.5px`×6, `10px`×5, `10.5px`×4, `13.5px`×3, `21px`×2, `20px`×2, `19px`×2, `17px`,
  `15.5px`. Doce tamaños distintos donde el sistema declara seis. La Regla G solo prohíbe
  12/14/16/15/18/22 literales, así que el banco no lo ve.
- Jerarquía de la tarjeta (hora 22 px/900 > nombre 18 px/800 > chips 11,5 px/750 mayúsculas) es
  clara y responde a decisiones del médico; no se toca.

### 1.3 Radios, sombras, espaciado
- Radios: 5 tokens (`--r-chip 14 / card 18 / surface 22 / field 14 / pill`), consistentes; 13 radios
  literales sueltos (12px ×4, 6px ×2, 5px ×2, 4px, 2px, 1px, 16px, 13px de Everest por diseño).
- Sombras: `--shadow-panel` de 5 capas, `.vgl-modal-card` 5 capas; **19 elementos con ≥3 capas de
  sombra** en el panel abierto. D7 fijó «máximo 2 capas» para los widgets nuevos; el panel las
  supera pero es la única superficie con `will-change`. Aceptable en 1920, a vigilar en 1366 con
  arrastre (ver 1.6).
- Espaciado: escala `--s1..--s6` declarada pero casi no consumida (solo banner PyM); el resto usa
  literales 6/8/10/12/14/16 px coherentes.

### 1.4 Jerarquía y densidad en pantalla de consultorio
- **1366×768**: `#vgl-root` mide 692×647 px (84 vh); la lista de citas 565 px; tarjetas de
  123–165 px (la de 4 chips envuelve a dos filas). **Solo 3 de 10 citas caben completas**; a
  1920×1080 caben 5. Una variante SOLO de espaciado (sin tocar tipografía) sube a 4
  (`propuesta_panel_compacto_1366x768.png`).
- Sidebar 208 px / principal 482 px: la barra de estado `#vgl-sum` (12,5 px, `--fg3`) se corta con
  elipsis; correcto para estado normal.

### 1.5 Colisiones entre superficies flotantes (medidas, `colisiones_1366x768.png`)
Todas ancladas a esquinas, así que se pisan **igual a 1366 y a 1920**:

| Par | Solape | Quién queda encima |
|---|---|---|
| `#vgl-root` ∩ `#vgl-toasts` | 384×185 px (1366) / 384×135 (1920) | toasts: tapan cabecera, reloj y badges de la 1.ª tarjeta |
| `#vgl-root` ∩ `#vgl-postcita-panel` | 336×160 px | post-cita: tapa la esquina inferior derecha del panel |
| `#vgl-root` ∩ `#vgl-sp` (toast del piloto) | 460×70 px | toast |
| `#vgl-postcita-panel` ∩ `#vgl-sp` | 334×70 px | toast: **tapa el botón «Imprimir recordatorio»** |
| `#vgl-root` ∩ `#vgl-deshacer-llenado` | 176×38 px | Deshacer |
| `#vgl-min-bar` ∩ `#vgl-dock` | 142×30 px | barra de minimizados: **esconde la pastilla «Centinela»** |
| `#vgl-visib-pill` con root/post-cita/sp | 12–18 px | pastilla |

Cinco cosas compiten por la esquina inferior derecha (`#vgl-root` 22/22, `#vgl-postcita-panel`
18/18, `.vgl-sp-toast` 24/24, `#vgl-deshacer-llenado` 22/22, `#vgl-visib-pill` 10/10) y dos por
la inferior izquierda (`#vgl-dock` 16/12, `#vgl-min-bar` 14/14).

### 1.6 Vidrio, capas y rendimiento
- `backdrop-filter` activos por escena: panel **2** (`#vgl-root` blur 22 px + `#vgl-sidebar` blur
  18 px ANIDADO, L16939); Agendar/Ordenar **2** (velo blur 10 px + pie pegajoso blur 18 px);
  Labs 1; `#vgl-modal` 14 px; `#vgl-pym-modal` 12 px. El sidebar apila `rgba(4,6,10,.70)` sobre el
  `.88` del panel → opacidad combinada 96,4 %: su desenfoque es invisible y cuesta una pasada
  completa de blur extra en cada arrastre/scroll.
- Los tres modales de flujo desenfocan **toda la historia clínica** (blur 10 px) mientras el
  médico agenda/ordena/consulta labs; el velo `.74` ya la oculta. En tema claro el velo sigue
  siendo casi negro (`rgba(2,4,9,.74)`, L17789): tarjeta blanca sobre pantalla negra, un flash
  cada vez que se abre un módulo (`agendar_claro_1366x768.png`).
- El pie pegajoso de Agendar/Ordenar (L18921, L19074) desenfoca el contenido del propio modal
  (losetas de horarios, lista de CUPS) que pasa por debajo.

### 1.7 Modo claro `.light`
- Aplicado por JS a 9 ids (L9161–9166) y al crear cada modal. **`#vgl-sp` (toast del piloto)
  nunca recibe `.light`** y además lleva colores literales (`#0d1119`, `#f7fafc`, `#4ff0b8`,
  L16230): en tema claro sigue siendo una tarjeta negra (`sp_toast_claro_1366x768.png`, medido
  `rgb(13,17,25)`).
- Interruptor iOS `.vgl-sw` (L17412–17426): perilla blanca sobre riel `--bg4` claro = **1,32:1**;
  riel apagado contra el fondo = **1,25:1** (WCAG 1.4.11 pide 3:1 para componentes). En oscuro
  la perilla va bien (10:1) pero el riel apagado también es 1,51:1.
- Stepper de Agendar (`VGL_UX_CSS` L15852–15853): número «1» `#020617` sobre `--c-azul` claro
  `#6d28d9` = **2,84:1**; «2» completado sobre `--c-verde` claro = **2,63:1**.

### 1.8 Alto contraste `.vgl-hc` (L16583–16587, L29197–29218)
- Hoy hace dos cosas: fondo sólido y sin vidrio (+ zoom 1,12). **No cambia ningún token**: en
  oscuro reduce las fallas del panel de 7 a 1 (por el fondo sólido), en claro deja las mismas 6.
  El título del botón promete «Alto contraste» y en claro no contrasta más.

### 1.9 Animaciones y fatiga (`prefers-reduced-motion`)
- La lista de L16206–16216 no incluye `#vgl-ia-modal`, `#vgl-panel-modal`, `#vgl-ficha-modal`,
  `#vgl-tablero-modal`, `#vgl-confirma-modal`, `#vgl-llenar-modal`, `#vgl-riesgo-modal`,
  `#vgl-min-bar`, `#vgl-acomp-burbuja`, `#vgl-tip-pop`, `#vgl-examen-normalidad` ni `.vgl-ia-inj`.
  Medido con `reducedMotion:"reduce"`: `#vgl-panel-modal .vgl-agm-card` y `#vgl-ia-modal .vgl-agm-card`
  siguen animando `vglSpringIn .3s`, y el Redactor IA conserva 14 transiciones.
- Animaciones `infinite` en estado NORMAL: `#vgl-dot.bg` (L16567) late cada 2,4 s durante toda la
  jornada — «bg» es el estado sano del vigilante, no una alarma. Las demás (beacon de `#vgl-modal`,
  latido de `.vgl-pes-ic`, pulso de carga de labs, badge `.vgl-cw-atencion`) sí señalan algo.
- Resplandores (`text-shadow`) sobre nombres de paciente (`.vgl-agm-patient`, `.vgl-labs-patient`)
  y sobre el valor de laboratorio en alerta (L18738): halo de 16–30 px alrededor de texto que se
  lee decenas de veces al día; borde menos nítido = más esfuerzo de acomodación.

### 1.10 Foco de teclado y tamaño de objetivo
- `.vgl-tl` (semáforos de la cabecera) lleva `outline:none !important` (L16532); la regla
  `:focus-visible` de L16500–16506 no lleva la marca → **medido con Tab real: `outline: none 0px`**.
  Los cuatro botones (ocultar/minimizar/restaurar/alto contraste) no muestran foco de teclado.
- `.vgl-dock-btn` (los 7 botones del dock) no está en esa lista → anillo del navegador
  (`auto 1px rgb(16,16,16)`), distinto al resto del sistema (`.vgl-fchip` sí: `solid 2px`).
- `.vgl-tl` mide 12×12 px con separación 8 px: por debajo del mínimo 24×24 de WCAG 2.5.8 y sin
  cumplir la excepción de separación (centros a 20 px).

### 1.11 Consistencia macOS-clean
- Iconografía mezclada en el mismo sidebar: `🔔 Alertas` y `🔉 Silenciar` (emoji, L19361–19362)
  junto a cuatro botones con Lucide SVG (L19360, 19363, 19364). El dock de acciones es todo emoji
  (`_vglDockRotulo`), los toasts todo SVG (`TOAST_ICONO_SVG`).
- Opacidad apilada sobre `--fg3` para «atenuar aún más»: `.vgl-labs-date small` (`opacity:.72`,
  L18608) = 4,42:1 oscuro / **3,30:1 claro** (¡el año de un resultado de laboratorio a 10 px!);
  `.vgl-bento-pie` (.75, L15934) 3,51:1 claro; `.vgl-prod-cap` (.7, L15881); `#vgl-title small`
  (.60, L16554) 4,46:1 claro; `.vgl-chip-mas` (.75, L17239) 2,69:1 claro.

---

## FASE 2 — Tabla de hallazgos

Gravedad: **Alta** = el médico pierde información o un control en consulta; **Media** = contraste/
accesibilidad por debajo del mínimo o coste de rendimiento medible; **Baja** = consistencia/pulido.

| # | Superficie | Hallazgo | Evidencia (selector/línea · medida) | Gravedad | Propuesta |
|---|---|---|---|---|---|
| 1 | `#vgl-toasts` sobre `#vgl-root` | Los avisos tapan la cabecera (reloj, semáforos) y los badges de la primera cita, en ambas resoluciones | `#vgl-toasts{top:16px;right:16px}` L17576 vs `#vgl-root{bottom:22px;right:22px;max-height:84vh}` L16139 · solape 384×185 px (1366), 384×135 (1920) · `colisiones_*.png` | **Alta** | Toasts a la columna libre a la izquierda del panel: `right:min(728px,calc(100vw - 406px))` (P1) |
| 2 | Esquina inferior derecha | Cinco superficies compiten por la misma esquina: post-cita tapa el panel; el toast del piloto tapa «Imprimir recordatorio»; Deshacer tapa post-cita | L18357, L16230, L17991, L16316 · solapes 336×160, 334×70, 176×38 px | **Alta** | Presupuesto de esquinas: solo el panel a la derecha; post-cita/sp/deshacer a `right:728px` con alturas escalonadas; post-cita por debajo de alertas (`calc(var(--z-panel) + 1)`) (P1) |
| 3 | `#vgl-min-bar` sobre `#vgl-dock` | Con el panel plegado y un módulo minimizado, la barra esconde la pastilla «Centinela» | L17843 (`left:14px;bottom:14px`) vs L17549 (`left:12px;bottom:16px`) · 142×30 px, z minbar > z dock | **Alta** | `#vgl-min-bar{left:164px}` (P1) |
| 4 | Panel oscuro (tarjetas) | Acentos pastel calibrados «sobre OLED» se miden sobre un vidrio al 88 % encima de un Everest blanco: 7/80 nodos bajo AA | `--bg:rgba(7,10,16,.88)` L15991 · badge «En sala» 3,89:1, «Atendido» 4,26:1, «No confirmado» 4,32:1 | Media | `--bg:rgba(7,10,16,.94)` → 7 → 1 fallas (P2) |
| 5 | Tema claro (todas) | `--c-morado/--c-azul/--c-verde` claros insuficientes sobre sus tintes: 14 fallas en 4 superficies, incluidos los CTA «Generar», «Siguiente», «Cerrar» | L16087–16088 · «Generar» 3,99:1, «Siguiente» 4,39:1, «en 12 min» 3,39:1, «+1 más» 2,69:1 | Media | cyan-800 / violet-800 / emerald-900 + tinte .10 en claro para `.vgl-cd` y badge → 14 → 6 (P3, P4) |
| 6 | Agendar claro (stepper) | Números de paso casi invisibles: `#020617` sobre acento claro | `VGL_UX_CSS` L15852–15853 · 2,84:1 y 2,63:1 | Media | `color:var(--bg-solid) !important` (P5) |
| 7 | `.vgl-tip-btn` / `.vgl-btn-undo` (oscuro) | Blanco literal sobre acento pastel al pulsar/expandir | L15822, L15824, L15915 · `#fff` sobre `#a78bfa` = 2,72:1 | Media | `var(--bg-solid)` en vez de `#fff` (P5) |
| 8 | Labs, Panel, Resumen | Opacidad apilada sobre `--fg3` deja datos clínicos bajo AA (año del resultado, pie del bento, «+N más») | L18608 (.72) 3,30:1 claro; L15934 (.75) 3,51:1; L17239 (.75) 2,69:1; L15881 (.7); L16554 (.60) | Media | Quitar la opacidad: el token ya es «muteado» (P6) |
| 9 | Ajustes, claro | Interruptor iOS invisible en reposo (riel 1,25:1, perilla 1,32:1) | L17414–17423 | Media | Riel `#7f899b` + anillo en la perilla → ≈3:1 (P7) |
| 10 | `.vgl-hc` | «Alto contraste» no sube ningún contraste: en claro deja las mismas 6 fallas | L16583–16587 · panel claro HC = 6 fallas, igual que sin HC | Media | Tokens propios en `.vgl-hc` (`--fg2/--fg3/--edge/--line`) (P8) |
| 11 | Modales Panel/IA/Ficha/Tablero/Confirma/Llenar/Riesgo, min-bar, burbuja | Fuera de la lista `prefers-reduced-motion`: siguen animando | L16206–16216 · medido: `vglSpringIn .3s` vivo en `#vgl-panel-modal` y `#vgl-ia-modal` (+14 transiciones) | Media | Añadirlos a la lista existente (P9) |
| 12 | Semáforos `.vgl-tl` | Sin foco de teclado visible; objetivos 12×12 px a 20 px de centro | L16532 `outline:none !important` gana a L16505 · medido `outline:none 0px` con Tab | Media | Quitar el `outline:none` de prioridad, anillo en `:focus-visible`, `gap:12px` (P10, P11) |
| 13 | `.vgl-dock-btn` | Sin anillo de foco del sistema (cae al del navegador) | L16500–16506 no lo lista · medido `auto 1px` | Baja | Sumarlo a la lista (P10) |
| 14 | `#vgl-sidebar` | `backdrop-filter` anidado dentro de otro `backdrop-filter`: invisible (opacidad combinada 96,4 %) y una pasada de blur extra por cuadro | L16939–16940 · 2 capas medidas en el panel | Media (rendimiento 1366) | Eliminar el blur del sidebar (P12) |
| 15 | Agendar/Ordenar/Labs | Velo casi negro también en tema claro + blur 10 px sobre toda la historia | L17787–17793 · `rgba(2,4,9,.74)` sin gemelo `.light` · `agendar_claro_1366x768.png` | Baja | Velo claro `rgba(15,23,42,.42)`; blur 10 → 4 px (P13) |
| 16 | Agendar/Ordenar pie pegajoso | Vidrio que desenfoca las losetas/CUPS que pasan por debajo; una capa GPU por modal | L18921–18931, L19074–19084 | Baja | Pie sólido `var(--bg-solid)` (el `@supports` ya lo hace de reserva) (P14) |
| 17 | `#vgl-dot.bg` | Pulso infinito en el estado SANO del vigilante: movimiento periférico 8 h al día | L16567 · `animationIterationCount: infinite` medido | Baja (fatiga) | 3 ciclos y quieto; `.salud-warn` sigue infinito (P15) |
| 18 | `.vgl-sp-toast` | Colores literales, sin `.light` por JS, `z-index` literal máximo | L16230; L9161–9166 no lo alterna · medido `rgb(13,17,25)` en claro | Baja | Tokens con reserva + `toggle("light")` en `applyTheme` (P16) |
| 19 | Panel 1366×768 | 3 citas visibles de 10; 4 con espaciado compacto | L17081–17085, L17106 · lista 565 px, tarjetas 123–165 px | Baja | `@media (max-height:800px)` solo espaciado (P17) |
| 20 | Hoja de estilos | 57 `font-size` literales fuera de la escala (12 tamaños distintos) | censo sobre L15698–19328 + L45401–45427 | Baja | Dos tokens nuevos `--t-mini:11px`, `--t-small:13px` y migración mecánica (Jules) (P18) |
| 21 | Sidebar del panel | Emoji y Lucide mezclados en la misma columna de botones | L19361–19362 vs L19360/19363/19364 | Baja | Dos SVG Lucide (`bell`, `volume-x`) (P19) |
| 22 | `#vgl-toasts` | `--z-toast` declarado (L16047) sin consumidor; el toast usa literal `2147483646` | L17576 | Baja | `z-index:var(--z-toast)` (P1) |

---

## FASE 3 — Borrador CSS para el arquitecto

Reglas del banco aplicadas a cada fragmento: toda declaración `color` lleva `!important` (Regla P/E);
ningún `font-size` literal (Regla G); ningún `*/` ni acento grave dentro de comentarios de la hoja
(Reglas Q y N); la palabra de prioridad no puede aparecer en comentarios de la hoja (el censo de la
Regla G cuenta texto crudo). **Δ !important total de todo el borrador: −1** (hoy 655 en la hoja
principal, 134 en las spliceadas; solo P10 lo mueve y hay que anotarlo en el mensaje de la Regla G).

### P1 — Presupuesto de esquinas (hallazgos 1, 2, 3, 22) · Δ !important: 0
Inserción: editar en sitio `#vgl-toasts` (L17575), `#vgl-postcita-panel` (L18356),
`.vgl-sp-toast` (L16230), `#vgl-deshacer-llenado` (L17990), `#vgl-min-bar` (L17842). Nuevo token
`--vgl-col-libre` en AMBAS listas de tokens (L16049 y L16115; Regla D exige que esté declarado).

```css
/* en las dos listas de tokens, junto a --line/--edge */
--vgl-col-libre:min(728px,calc(100vw - 406px)); /* 22 + 690 + 16: a la izquierda del panel */

#vgl-toasts{
  position:fixed;top:16px;right:var(--vgl-col-libre);z-index:var(--z-toast);
  display:flex;flex-direction:column;gap:10px;max-width:390px;
  font-family:var(--font-stack);pointer-events:none
}
#vgl-postcita-panel{
  position:fixed;bottom:18px;right:var(--vgl-col-libre);z-index:calc(var(--z-panel) + 1);
  font-family:var(--font-stack);animation:vglToastIn .34s var(--spring)
}
/* .vgl-sp-toast: solo cambian bottom y right; conserva su z-index literal (Regla J exige 1) */
.vgl-sp-toast{bottom:200px;right:var(--vgl-col-libre); /* resto igual */ }
#vgl-deshacer-llenado{position:fixed;right:var(--vgl-col-libre);bottom:22px;z-index:calc(var(--z-modal) + 2);font-family:var(--font-stack);color:var(--fg) !important;box-shadow:var(--shadow-panel)}
#vgl-min-bar{position:fixed;left:164px;bottom:14px; /* resto igual */ }
```
Notas: `#vgl-toasts` pasa de `2147483646` a `var(--z-toast)` (2147483647): sigue por encima de las
alertas, como hoy. `#vgl-postcita-panel` baja a `--z-panel + 1`: por debajo de modales y alertas
(política D6). Regla J: los contadores `var(--z-panel)` (2), `var(--z-alerta)` (4) no cambian porque se
usa `calc(...)`, que el regex no cuenta. Si el estado de ventana se refleja en una clase (`setWinState`
L19412), conviene `body.vgl-panel-dock #vgl-toasts{right:16px}` para volver a la esquina cuando el
panel está plegado. Verificar en Chromium a 1366 y 1920 (`colisiones_*.png` es la línea base).

### P2 — Vidrio del panel un punto más opaco (hallazgo 4) · Δ: 0
Editar en sitio L15991:
```css
--bg:rgba(7,10,16,.94);
```
Re-medido: fallas AA del panel oscuro 7 → 1 (queda «Cargar prevención» 4,43:1, ver P5).
Regla F sigue casando (`--bg:rgba(...)` tras el comentario). Regla O no lee `--bg`.

### P3 — Acentos claros un paso más oscuros (hallazgo 5) · Δ: 0
Editar en sitio L16087–16094 (tema claro):
```css
--c-morado:#155e75;   /* cyan-800   (era #0e7490) */
--c-azul:#5b21b6;     /* violet-800 (era #6d28d9) */
--c-verde:#064e3b;    /* emerald-900 (era #065f46) */
--rgb-morado:21,94,117;--rgb-azul:91,33,182;--rgb-verde:6,78,59;
```
Regla F: cada clave de `COLORS` conserva su `--c-*` y `--rgb-*`. Re-medido: Agendar 1 → 0,
IA 2 → 0, Labs 2 → 1, panel 9 → 5 (las 5 restantes las cierra P4).

### P4 — Tintes al 10 % en claro para cuenta regresiva y badge (hallazgo 5) · Δ: 0
Las reglas `.light` de L17224/17226/17229 YA existen con `color`; se les añade `background`
(mismo selector → sin colisión Regla A):
```css
#vgl-root.light .vgl-cd.warn{color:var(--c-morado) !important;background:rgba(var(--rgb-morado),.10)}
#vgl-root.light .vgl-cd.late{color:var(--c-ambar) !important;background:rgba(var(--rgb-ambar),.10)}
#vgl-root.light .vgl-cd.vgl-adh{color:var(--c-ambar) !important;background:rgba(var(--rgb-ambar),.10) !important}
```
(la tercera ya lleva la marca en `background` desde v17.6.7, L17228: se conserva). El badge de
estado pinta su tinte EN LÍNEA (`render()` L31266: `badgeRgba(".16")`), así que la Regla B prohíbe
pisarlo desde la hoja: cambiar en JS `badgeRgba(isLight() ? ".10" : ".16")` y `badgeRgba(isLight() ?
".26" : ".32")` para el anillo.

### P5 — Texto sobre acento: nunca un literal (hallazgos 6, 7, 4) · Δ: 0
Editar en sitio `VGL_UX_CSS` L15852–15853, L15822, L15824, L15915 y L17041:
```css
.vgl-stepper-step.active .vgl-step-num{background:var(--c-azul);color:var(--bg-solid) !important}
.vgl-stepper-step.completed .vgl-step-num{background:var(--c-verde);color:var(--bg-solid) !important}
.vgl-tip-btn:hover,.vgl-tip-btn:focus-visible{background:var(--c-azul) !important;color:var(--bg-solid) !important;outline:none}
.vgl-tip-btn[aria-expanded="true"]{background:var(--c-azul) !important;color:var(--bg-solid) !important}
.vgl-btn-undo:hover{background:var(--c-rojo);color:var(--bg-solid) !important}
/* CTA del sidebar: el extremo del degradado al .74 oscurecia el fondo bajo el texto */
.vgl-sb-btn.primary{background:linear-gradient(165deg,var(--c-azul),rgba(var(--rgb-azul),.88));color:var(--bg-solid) !important;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.20),0 6px 16px rgba(var(--rgb-azul),.30)}
```
Medido: `--bg-solid` sobre `--c-azul` = 7,4:1 oscuro / 7,1:1 claro; sobre `--c-rojo` ≈ 8:1.

### P6 — Sin opacidad apilada sobre texto muteado (hallazgo 8) · Δ: 0
Editar en sitio:
```css
#vgl-labs-modal .vgl-labs-date small{display:block;font-size:var(--t-nano,10px);color:var(--fg3) !important;font-variant-numeric:tabular-nums}   /* L18608, sin opacity */
.vgl-bento-pie{font-size:var(--t-mini,11px);color:var(--fg3) !important}            /* L15934, sin opacity */
.vgl-prod .vgl-prod-cap,.vgl-prod-cap{font-size:var(--t-nano,10px);font-weight:700;color:var(--fg3) !important}   /* L15881 */
.vgl-chip-mas{cursor:help}                                                           /* L17239, sin opacity */
#vgl-title small{opacity:.8;font-weight:500;margin-left:6px;font-size:var(--t-micro)}   /* L16553 */
```
(Los tokens `--t-nano/--t-mini` son los de P18; hasta que existan, mantener el literal actual y usar
la reserva). El año del laboratorio pasa de 3,30:1 a ≥5:1 en claro.

### P7 — Interruptor visible en claro (hallazgo 9) · Δ: 0
Regla nueva junto a L17426 (especificidad 1,2,1 > 0,1,1 de `.vgl-sw i`, sin empate Regla A):
```css
#vgl-root.light .vgl-sw i{background:#7f899b;box-shadow:inset 0 0 0 1px rgba(15,23,42,.35)}
.vgl-sw i:after{content:"";position:absolute;top:2px;left:2px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35),0 0 0 1px rgba(15,23,42,.25);transition:transform .24s var(--spring)}
```
Re-medido con `#8a94a6`: riel 2,9:1, perilla 3,06:1 → con `#7f899b` ≥3:1 los dos.

### P8 — Alto contraste que contraste (hallazgo 10) · Δ: 0
Regla nueva justo debajo de L16587 (solo tokens; no toca `--t-*`, Regla H):
```css
#vgl-root.vgl-hc:not(.light){--fg2:#e5ebf3;--fg3:#b8c2d0;--edge:rgba(255,255,255,.34);--line:rgba(255,255,255,.18);--bg2:rgba(255,255,255,.07);--bg3:rgba(255,255,255,.12)}
#vgl-root.vgl-hc.light{--fg2:#111827;--fg3:#334155;--edge:rgba(15,23,42,.40);--line:rgba(15,23,42,.20)}
```
Regla O (piso de `--fg3` sobre el dock) lee el bloque de tokens base, no este; ambos valores nuevos
son MÁS contrastados que el base, así que la jerarquía `--fg > --fg2 > --fg3` se conserva. Los
docks/toasts reciben `.vgl-hc` desde JS (L29212): se puede extender la regla a `#vgl-acciones-dock.vgl-hc`.

### P9 — `prefers-reduced-motion` completo (hallazgo 11) · Δ: 0
Añadir a la lista de L16207–16213 (misma declaración, mismos dos `!important` ya contados):
```css
#vgl-ia-modal,#vgl-ia-modal *,#vgl-panel-modal,#vgl-panel-modal *,#vgl-ficha-modal,#vgl-ficha-modal *,
#vgl-tablero-modal,#vgl-tablero-modal *,#vgl-confirma-modal,#vgl-confirma-modal *,#vgl-llenar-modal,#vgl-llenar-modal *,
#vgl-riesgo-modal,#vgl-riesgo-modal *,#vgl-min-bar,#vgl-min-bar *,#vgl-acomp-burbuja,#vgl-acomp-burbuja *,
#vgl-tip-pop,#vgl-examen-normalidad,.vgl-ia-inj,#vgl-deshacer-llenado
```
Verificación: `render.js` sección 3 (`reducedMotion:"reduce"`) debe devolver `animaciones: []` en
`vgl-panel-modal` y `vgl-ia-modal`.

### P10 — Foco de teclado (hallazgos 12, 13) · Δ: **−1**
Causa raíz: L16532 `outline:none !important`. Sustituir por una regla sin la marca que solo apague
el anillo del clic con ratón, y sumar `.vgl-tl`/`.vgl-dock-btn` y los botones sin anillo a la lista:
```css
/* en .vgl-tl (L16522-16534): borrar la linea outline:none con la marca */
.vgl-tl:focus:not(:focus-visible){outline:none}
.vgl-btn:focus-visible,.vgl-fchip:focus-visible,.vgl-tl:focus-visible,
.vgl-btn-action:focus-visible,.vgl-agm-btn:focus-visible,.vgl-agm-pbtn:focus-visible,
.vgl-agm-sbtn:focus-visible,.vgl-agm-input:focus-visible,.vgl-agm-close:focus-visible,
.vgl-sb-btn:focus-visible,.vgl-dock:focus-visible,#vgl-dock:focus-visible,
.vgl-pymb-toggle:focus-visible,.vgl-postcita-x:focus-visible,
.vgl-dock-btn:focus-visible,.vgl-dock-toggle:focus-visible,.vgl-chooser-opt:focus-visible,
.vgl-panel-tab:focus-visible,.vgl-paq-chip:focus-visible,.vgl-labs-pdf:focus-visible,
.vgl-min-abrir:focus-visible,.vgl-min-x:focus-visible,.vgl-type-card:focus-visible,
.vgl-labs-uro-btn:focus-visible,.vgl-agm-lnk:focus-visible,.vgl-acomp-nomas:focus-visible{
  outline:2px solid var(--c-azul);outline-offset:2px;box-shadow:0 0 0 4px rgba(var(--rgb-azul),.25)
}
```
El censo de la Regla G baja 655 → 654: anotarlo en el mensaje de la aserción con este motivo.
Regla B: `.vgl-tl` no recibe estilo en línea ni `.style.outline` desde JS (comprobado por grep).
Verificar con `variantes.js` (`foco_tl` debe dar `outline: solid 2px`).

### P11 — Semáforos alcanzables (hallazgo 12) · Δ: 0
Editar en sitio L16521: `gap:8px !important` → `gap:12px !important`. Con 12 px de separación los
centros quedan a 24 px y los objetivos de 12×12 cumplen la excepción de separación de WCAG 2.5.8 sin
tocar el dibujo. (Alternativa de más alcance: círculos de 16 px con caja de 24 px vía
`radial-gradient`; exige reescribir las 4 variantes `.close/.min/.zoom/.hc` y el anillo `.vgl-hc-on`;
Δ estimado −6; no se recomienda sin captura del médico.)

### P12 — Un solo vidrio en el panel (hallazgo 14) · Δ: 0
Borrar L16939–16940 (`-webkit-backdrop-filter:var(--glass);backdrop-filter:var(--glass);` de
`#vgl-sidebar`). El `#vgl-root.perf #vgl-sidebar{background:var(--bg-solid)}` de L16199 queda igual.
Prueba visual: capturar `panel_oscuro_1366x768.png` antes/después; la diferencia esperada es nula.

### P13 — Velo de los modales de flujo (hallazgo 15) · Δ: 0
Editar L17792 y añadir tras L17793:
```css
#vgl-agendar-modal,#vgl-ordenar-modal,#vgl-labs-modal{ /* resto igual */ backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#vgl-agendar-modal.light,#vgl-ordenar-modal.light,#vgl-labs-modal.light{background:rgba(15,23,42,.42)}
```
`#vgl-root.perf~#vgl-agendar-modal{background:rgba(2,4,9,.86)}` (2,1,0) sigue ganando en modo
rendimiento. Captura de referencia: `propuesta_agendar_claro_1366x768.png`. Los cuadros de ALERTA
(`#vgl-modal`, `#vgl-pym-modal`) conservan su blur 12–14 px: ahí tapar es el objetivo.

### P14 — Pie pegajoso sólido (hallazgo 16) · Δ: 0
Editar L18924–18926 y L19077–19079: `background:var(--bg-solid)` y borrar las dos líneas de
`backdrop-filter`; el bloque `@supports not (...)` de L18929–18931 / L19082–19084 queda sin objeto y
se elimina. Una capa GPU menos por modal y las losetas de horario dejan de verse difuminadas al
desplazarse bajo el pie.

### P15 — El punto de estado deja de latir en reposo (hallazgo 17) · Δ: 0
Editar L16567:
```css
#vgl-dot.bg{animation:vglPulse 2.4s ease-out 3}
```
`#vgl-dot.salud-warn` (L16571) conserva `infinite`: ahí el latido es una advertencia.

### P16 — Toast del piloto con tema (hallazgo 18) · Δ: 0
Editar L16230 (los literales pasan a tokens con reserva; `#vgl-sp` está en las dos listas de tokens
L15988/L16080, así que resuelven) y JS L9166:
```css
.vgl-sp-toast{ /* ... */ background:linear-gradient(165deg,rgba(255,255,255,.06),rgba(255,255,255,0) 55%),var(--bg-solid,#0d1119);color:var(--fg,#f7fafc) !important;border:1px solid var(--edge,rgba(255,255,255,.16));border-left:5px solid var(--c-verde,#4ff0b8);border-radius:var(--r-card,16px);font-family:var(--font-stack,system-ui,sans-serif);font-size:var(--t-body);box-shadow:var(--shadow-float),0 0 20px rgba(var(--rgb-verde),.15),inset 0 1px 0 rgba(255,255,255,.10); /* ... */ }
.vgl-sp-x{ /* ... */ color:var(--fg3,#9aa7ba) !important; /* ... */ }
```
```js
// applyTheme, junto a L9166
const sp = document.getElementById("vgl-sp"); if (sp) sp.classList.toggle("light", isLight());
```
El `font-size:13.5px` literal desaparece (Regla G no lo prohíbe hoy, pero es uno de los 57).

### P17 — Densidad en 1366×768 (hallazgo 19) · Δ: 0
Regla nueva al final de la sección de tarjetas (tras L17335). Solo espaciado, cero cambios de letra:
```css
@media (max-height:800px){
  #vgl-root #vgl-list{gap:6px;padding:8px 10px 10px}
  #vgl-root .vgl-card{padding:9px 12px 8px}
  #vgl-root .vgl-card-mid.vgl-card-mid-t1{margin-top:5px}
  #vgl-root .vgl-card-btm.vgl-card-btm-t1{margin-top:4px}
  #vgl-root .vgl-pyms{margin-top:5px;gap:4px}
  #vgl-root .vgl-chip{padding:3px 8px}
}
```
Medido: 3 → 4 tarjetas completas (alturas 165/135/123/135 → 143/116/109/116). Especificidades con
id (1,x,0) frente a las base (0,x,0): sin empates para la Regla A.

### P18 — Dos tokens tipográficos más (hallazgo 20) · Δ: 0 · candidato a Jules
Añadir en AMBAS listas, en la misma línea, DESPUÉS de `--t-hero:22px;` (los regex de las Reglas H e I
buscan las secuencias exactas `--t-micro:12px;--t-body:14px;--t-lead:16px;` y
`--t-strong:15px;--t-title:18px;--t-hero:22px;` y siguen casando):
```css
--t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;--t-nano:10px;--t-mini:11px;--t-small:13px;
```
Migración mecánica (prompt para Jules, con mutación verificada): `10px/10.5px → var(--t-nano)`,
`11px/11.5px → var(--t-mini)`, `12.5px/13px/13.5px → var(--t-small)` (12,5 → 13 y 13,5 → 13 son ±0,5 px,
el mismo criterio que TL1 aplicó en v14.0.0), `15.5px → var(--t-strong)`, `17px → var(--t-title)`,
`19px/20px/21px → var(--t-hero)`. Excluir los cuatro sitios que copian a Everest a propósito
(`button#vgl-cw-ordenar-btn`, L16649–16668). Los tamaños de la tabla de laboratorios (10/10,5/11/11,5)
quedan como pregunta abierta al médico, igual que anotó TL2.

### P19 — Iconos homogéneos (hallazgo 21) · Δ: 0 · HTML
L19361–19362: sustituir `🔔`/`🔉` por `<svg class="vgl-ico" ...>` Lucide `bell` y `volume-x` con
`aria-hidden="true"`, mismo `width="13" height="13"` que los vecinos. `.vgl-ico` ya hereda
`currentColor`, blindado por `.vgl-sb-btn{color:... !important}`.

---

## Lo que ya está bien (no repetir trabajo)
- Paleta OLED sin negros puros; velos y sombras con alfa, no con gris plano.
- Blindaje de color: 728 nodos medidos bajo el Everest hostil y **ninguno** toma el color del
  adversario (la Regla P/S funciona; las fallas de arriba son de nuestra propia paleta, no de Everest).
- Jerarquía «el paciente es el título» en los modales; kicker por módulo (azul/morado/índigo/celeste)
  reconocible de un vistazo.
- Modo rendimiento `.perf` y modo oculto completos; `prefers-reduced-motion` correcto en panel,
  docks, toasts, Agendar/Ordenar/Labs, chooser, paquete y alertas.
- Aviso universal (`#vgl-pym-modal`) en claro y oscuro: 0 fallas AA, buena separación por tarjetas.

## Restricciones respetadas
- Ninguna propuesta oculta ni reordena información clínica; P17 solo comprime espacio en blanco.
- Ningún `backdrop-filter` nuevo; se retiran tres (sidebar, dos pies pegajosos) y se atenúa el de los
  modales de flujo. Ninguno queda sobre el texto de la historia salvo el velo de los propios modales.
- Cero PHI en capturas, HTML serializado y resultados (`PACIENTE SINTETICO n`, `SYN-…`).

## Cómo reproducir
```
cd /home/user/vigilante-agenda-everest
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node <scratchpad>/uiux/render.js      # capturas + resultados.json
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node <scratchpad>/uiux/variantes.js   # propuestas re-medidas + colisiones
```
