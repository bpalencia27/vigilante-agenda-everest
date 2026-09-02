# Auditoría UI/UX del Vigilante de Agenda — enjambre del 02-sep-2026 (sobre v18.0.116)

Arquitecto_Vanilla (fase 3) sobre los informes de UX_Clinico y UI_Estetico (fases 1-2). Solo lectura del
repositorio: ningún archivo de `/home/user/vigilante-agenda-everest` se tocó. Árbol auditado: `@version 18.0.116`
(HEAD `a2848fc` = v18.0.115 + cambios sin confirmar del «estado único, paso 1»), 45 697 líneas. **Todas las líneas
de este documento son del árbol actual** (los informes de fase 1-2 citaban v18.0.113; el desplazamiento medido es
+10 en las hojas CSS, +12 entre Agendar y Ordenar, +89 en `render()`; cada cita se releyó en el archivo, no se sumó
a ciegas). Cero PHI: todos los ejemplos usan `PACIENTE SINTETICO`, documento `555111`, celular `3001112233`.

Convenciones: ✂️ = quirúrgico (pocas líneas, sin cambiar hábitos del médico); ⚖️ = decisión del médico (cambia un
hábito o una política); «Δ !important» = variación del censo de `tests/suite_25_cascada_css.js` (Regla G, hoy
**656** en la hoja principal, línea 687; 134 en las hojas spliceadas).

---

## Fase 1 — Simulación de recorrido y estrés

### Agente UX_Clinico (recorrido paso a paso)

Resumen fiel de `ux_clinico.md` (26 fricciones), con la evidencia releída en v18.0.116.

**Dock y avisos al abrir una historia.** `tick()` → `createAccionesDockUI()` (L7547) pinta la columna
`#vgl-acciones-dock` con hasta seis botones rotulados por `VGL_ROTULOS` (L7471): Agendar · Ordenar · Laboratorios ·
Panel del paciente (o «📝 Faltan antecedentes», o **nada**) · Redactar · Próximo control. La compuerta del Panel es
`_resumenListoParaGate = !!mtrCacheResumenLeer(docId)` (L7593); mientras `autoCalcularResumenSiNecesario` (L7529)
corre 3-6 s, ni el Panel ni «Faltan» existen (rama L7757 / L7768): el sexto botón aparece de golpe. A los ≤5 s sale
una vez por jornada «Pendientes de este paciente» (`avisoUniversal` L14169), cierra con «Entendido» o clic fuera
(`_vglCerrarConClicFuera`, L14237) y no se puede reabrir desde el dock. Toasts en `#vgl-toasts` (máx. 4, ROJO/MORADO/
ÁMBAR persistentes); con >3 avisos en un flush de 500 ms todo se colapsa en «Alerta Múltiple (N) — X críticas y Y
rutinarias» sin ningún título (`showToast` L14537-14543). El HUD «🛡️ Centinela PyM» (`spToast` L12878) lo disparan
los fallos de AppCita (L20576, 20619, 20659, 20693). ✅ v18.0.113 cerró el duplicado del MISMO aviso entre pestañas
(`_avisoUnaVezPorNavegador`, L14565-14568); no toca el colapso «Alerta Múltiple».

**Agendar — paso 1 «Tipo de Cita»** (`openAgendamientoModal` L25159; plantilla L25215-25252). Tarjetas Control+Labs
(recomendada) / SOLO Control / SOLO Laboratorios; «SOLO Laboratorios» cierra el cuadro y abre `openLabSoloModal(apt,
{libre:true})` (L25528-25530), cuyo «Cancelar» (L27480-27486) no vuelve. ✅ v18.0.115 (C17) cerró «con los valores por
defecto igual hay que pulsar Siguiente»: Agendar recuerda tipo y especialidad y abre en el paso 2 con el chip «Como la
última vez … cambiar» (L25256, L27343-27372). Al abrir corre `_preseleccionarSugerencia()` (L27031/27038) →
`renderDayChips` → `cargarHoras()` (L26412) **y** `_rumTramo("agm.abrir", () => cargarHoras(m, d))` (L27373).

**Paso 2 «Fecha y Turno Inteligente»** (L25255-25300). Numeración interna «2 Plazo…» (L25259) y «3 Horarios…»
(L25291) que no es la del stepper (L25199-25205). Sin turno elegido, «Siguiente: Confirmación ➔» queda apagado y la
frase «Elija un horario para continuar» se escribe en `confirmBtn` — que vive en el paso 3 oculto (L26191-26193).
`_sondearAgendaDeCadaDia` (L26416) hace `btn.remove()` de los chips sin agenda en segundo plano (L26438). «⚡ Primer
cupo» recorre hasta 30 días hábiles sin botón de detener (`_pcCancelar` L26531 solo desde plazo/calendario). «❤️ Ver
riesgo…» (L25280) abre el Panel encima, que puede encadenar reconciliador y llenado (L24381-24418).

**Paso 3 «Confirmación»** (L25303-25371). Programa preseleccionado al primero (L25865-25866). Tarjeta «🧪 Agendar
también la Toma de Muestras» con la hora **plegada** en `#vgl-agm-plan-det.vgl-d-none` (L25348-25361) tras «✎ Cambiar
fecha u hora» (L25347, listener L25562-25566). `cargarHorasLab` (L26197): casilla `_chkPorDefecto` marcada solo en
labs-primero (L26204, L26243), hora siempre «— elija la hora de la toma —» (L26234). **El clic de confirmar (L27078)
no valida `selectedLabTime` cuando `isLabChecked`** (L27177-27178 → L27286-27290): la cita se crea y
`apiLaboratorioAgendarAuto` (L20562) cae por `horaSeleccionada` falsy (L20585) al motivo «el horario de laboratorio
elegido () ya no está disponible» (L20618, `format12hTime("")` = "" L20541) que C4 pinta en toast ámbar, panel y
botón (L27297-27307). El segundo aviso de vencimiento (L27123-27128) llama `_pintarAvisoVencimiento()` (L26820), que
escribe en `#vgl-agm-vencaviso` — **dentro de `#vgl-step-view-2`** (L25278), oculto en el paso 3. El botón de
confirmar es el canal de tres avisos «pulse otra vez» (vuelo ajeno L27099-27104, cita de hoy L27107-27115,
vencimiento L27123-27129), ≥700 ms entre clics (L27085-27088). Éxito: botón «✅ ¡Cita Creada…!» → «⏳ Cita creada ·
agendando la toma…» (L27289) → `mostrarPanelPostCita` (L27259/27320); el cuadro se cierra solo a 2,6 s (L27325);
el post-cita a 5 min (L22265) aunque el médico escriba en `#vgl-postcita-smsto` (L22125). ✅ v18.0.114 añadió «📅
Abrir Agendar de nuevo» al post-cita y el motivo real de la anulación (`_anulacionMotivo`).

**Toma de muestras.** `openLabSoloModal` (L27384) sí exige hora («Seleccione un horario», L27466/27551/27595) y
llama `_agmAgendarLabConCandado(…, undefined, …)` (L27677): **sin celular**, así que el SMS de la toma nunca sale por
esa vía. `EnviarMensajeTextoLaboratorio` (L20709-20724) devuelve `smsEnviado` en el objeto (L20734) que el propio
comentario declara «sin llamador hoy» (L20729-20731): ni Agendar (`extra.lab` L27314-27319) ni LabSolo (L27701-27705)
lo pasan a `bloqueLab` (L22059-22062). Fallo de la toma desde Agendar = cuatro canales: `spToast` 14 s + toast ámbar
persistente + línea roja del post-cita + texto del botón (L27297-27307).

**Redactor IA** (`abrirRedactorTextoLibre` L23358 → `mtrAbrirPanelRedaccion` L42473). Estado «Generando con
gemini-… · intento 2 de 7…» (L42881, 42890) con el nombre técnico del modelo; «Copiar» sin `await` de
`navigator.clipboard.writeText` (L42980-42982) y cuenta adopción aunque la promesa rechace; cierre con borradores =
doble toque en ✕ (L42605-42623). Reconciliador (`_vglModalConfirmarDatos` L24856): botones fijos «Sí tiene / No
tiene» (L24895-24896) y título «🔎 Las fuentes no coinciden» (L24906) también para «¿Repetir antes los exámenes fuera
de meta…?» (L5791), «¿El tratamiento … es el adecuado?» (L5827/5837) y «¿Está tomando su medicamento…?»
(L5828/5838). «Faltan antecedentes» (`vglModalLlenarCampos` L24260): con todo en «No sé» el primario sigue diciendo
«Aceptar y llenar en Everest» (L24287) y escribe 0. Panel: hasta dos cuadros previos en serie (L24381-24399 →
L24409-24418).

**Laboratorios, Exámenes, Próximo control, Ordenar.** Laboratorios (`openLaboratoriosModal` L22715): ✅ v18.0.115
(C11) sirve la precarga y **ahora sí reescribe la chapa** («⚡ Leídos hace N s (precarga)» / «✓ Consultado en vivo
ahora», L22853-22856) — pero cuando `labsArr` es `null` (portal no leído, L22946-22948) la chapa sigue diciendo «✓»:
fricción parcialmente cerrada. Exámenes (`_vglChooserModal`, C20 ✅) bien resuelto; solo pesa el número de toasts por
clic. Próximo control (`openPaquetesModal` L22589): sin resumen dice «Abra la historia un momento … y vuelva a abrir
este módulo» (L22701) estando el médico dentro de la historia (el botón 📦 solo existe ahí, L7806-7815). Ordenar
(`openOrdenamientoModal` L28193): «Generar» hace `window.open("", "_blank")` en el clic (L28574) y enfoca una pestaña
en blanco; el progreso (L28631), el bloque verde y los botones de imprimir quedan detrás; ✕ y «Cancelar» siguen
activos durante el lote (`closeMod` L28214-28221; solo `confirmBtn.disabled` L28577), y `_activarAccesibilidadModal`
(L28540) también cierra con Escape.

### Agente UI_Estetico (recorrido visual)

Resumen fiel de `ui_estetico.md` (22 hallazgos; método en §0: `tests/harness.js` → `buildOverlay()` → `<style>`
real de 269 802 caracteres con los cuatro splices resueltos → Chromium/Playwright a 1366×768 y 1920×1080 sobre un
Everest simulado con el adversario canónico de CLAUDE.md `div,span,p,b,small,label,li,td,th{color:#1f4e79
!important}`; contraste WCAG calculado sobre **728 nodos de texto** con composición real de fondos).

- **Tokens** (`--bg:rgba(7,10,16,.88)` L16001; claro L16097-16098): paleta OLED sin negros puros ✅; pero el vidrio
  se calibró «sobre OLED» y vive sobre un Everest blanco: fondo efectivo `#3c414a`–`#4d3b3e`. **7/80 nodos** del panel
  oscuro bajo AA (badge «En sala» 3,89:1, «Atendido» 4,26:1, «No confirmado» 4,32:1, «+1 más» 4,36:1) —
  `panel_oscuro_1366x768.png`; con `.94` bajan a 1 (`propuesta_panel_oscuro_alpha94_1366x768.png`). Tema claro: 14
  fallas en 4 superficies («Generar» 3,99:1, «Siguiente» 4,39:1, «en 12 min» 3,39:1, «+1 más» 2,69:1) —
  `panel_claro_1366x768.png`, `ia_claro_1366x768.png`, `labs_claro_1366x768.png`; con cyan-800/violet-800/emerald-900
  quedan 6 (`propuesta_panel_claro_tokens_1366x768.png`).
- **Escala tipográfica**: 6 tokens consumidos 148/36/7/7/6/12 veces; **57 `font-size` literales** fuera de la escala
  (12 tamaños distintos: 11px×13, 12.5px×10, 13px×8, 11.5px×6, 10px×5…). Regla G solo prohíbe 12/14/16/15/18/22.
- **Densidad 1366×768** (`#vgl-root` 692×647 px, lista 565 px): **3 de 10 citas completas**; 4 con solo espaciado
  (`propuesta_panel_compacto_1366x768.png`).
- **Colisiones medidas** (`colisiones_1366x768.png`, `colisiones_1920x1080.png`, `esquina_*.png`, `minbar_1366x768.png`):
  `#vgl-root ∩ #vgl-toasts` 384×185 px (1366) / 384×135 (1920) — los toasts tapan cabecera, reloj y badges de la
  1.ª tarjeta; `#vgl-root ∩ #vgl-postcita-panel` 336×160; `#vgl-postcita-panel ∩ #vgl-sp` 334×70 (**tapa «Imprimir
  recordatorio»**); `#vgl-root ∩ #vgl-deshacer-llenado` 176×38; `#vgl-min-bar ∩ #vgl-dock` 142×30 (**esconde la
  pastilla «Centinela»**). Cinco superficies compiten por la esquina inferior derecha.
- **Vidrio y capas**: `backdrop-filter` activos por escena: panel 2 (`#vgl-root` + `#vgl-sidebar` anidado, L16949-16950,
  opacidad combinada 96,4 % → desenfoque invisible), Agendar/Ordenar 2 (velo 10 px L17803 + pie pegajoso L18938/
  L19091). Velo casi negro también en claro (`agendar_claro_1366x768.png`).
- **Modo claro**: `#vgl-sp` nunca recibe `.light` (`applyTheme` L9169-9178) y lleva literales `#0d1119/#f7fafc`
  (L16240) — `sp_toast_claro_1366x768.png`, medido `rgb(13,17,25)`. Interruptor `.vgl-sw` (L17424-17436): riel
  1,25:1, perilla 1,32:1. Stepper (`VGL_UX_CSS` L15862-15863): `#020617` sobre acento claro = 2,84:1 / 2,63:1.
- **Alto contraste `.vgl-hc`** (L16593-16597): fondo sólido + sin vidrio, **ningún token cambia**: en claro deja las
  mismas 6 fallas (`panel_hc_claro_1366x768.png`).
- **Movimiento**: la lista `prefers-reduced-motion` (L16216-16226) no incluye `#vgl-ia-modal`, `#vgl-panel-modal`,
  `#vgl-ficha-modal`, `#vgl-tablero-modal`, `#vgl-confirma-modal`, `#vgl-llenar-modal`, `#vgl-riesgo-modal`,
  `#vgl-min-bar`, `#vgl-acomp-burbuja`, `#vgl-tip-pop`, `#vgl-examen-normalidad`, `.vgl-ia-inj`; medido con
  `reducedMotion:"reduce"`: `vglSpringIn .3s` vivo + 14 transiciones en el Redactor. `#vgl-dot.bg` late `infinite`
  en el estado SANO (L16577).
- **Foco y objetivo**: `.vgl-tl{outline:none !important}` (L16542) gana a la regla `:focus-visible` (L16510-16516):
  medido con Tab real `outline: none 0px`; `.vgl-dock-btn` no está en la lista (anillo del navegador). Semáforos
  12×12 px con separación 8 px (L16531): centros a 20 px, bajo el mínimo de WCAG 2.5.8.
- **Consistencia**: emoji `🔔 Alertas`/`🔉 Silenciar` (L19373-19374) junto a Lucide; opacidad apilada sobre `--fg3`
  (`.vgl-labs-date small` `.72` L18618 = **3,30:1 en claro**, el año de un resultado; `.vgl-bento-pie` `.75` L15944;
  `.vgl-prod-cap` `.7` L15891; `#vgl-title small` `.60` L16564; `.vgl-chip-mas` `.75` L17249 = 2,69:1).
- **Lo que ya está bien**: 728 nodos y **ninguno** toma el color del adversario (Reglas P/S funcionan); jerarquía
  «el paciente es el título» en modales; `.perf`, modo oculto y `prefers-reduced-motion` correctos en panel, docks,
  toasts y modales de flujo; aviso universal 0 fallas AA en los dos temas (`pym_claro_1366x768.png`).

---

## Fase 2 — Diagnóstico de fricción

### Tabla consolidada

Ordenada por gravedad. «Origen» conserva el número del informe de fase (UX-n / UI-n) para trazar. Verificación
contra el árbol actual en cada fila; las ya cerradas llevan «✅ ya cerrado (vX)».

| # | Origen (UX/UI) | Módulo/Superficie | Fricción o hallazgo | Evidencia | Gravedad | Tipo |
|---|---|---|---|---|---|---|
| 1 | UX-1 | Agendar · toma | Casilla de toma marcada (labs-primero o a mano) sin hora (select plegado tras «✎ Cambiar fecha u hora»); Confirmar no lo valida: la cita se crea y la toma falla con el motivo falso «el horario de laboratorio elegido () ya no está disponible» en toast, panel y botón | `cargarHorasLab` L26197/26204/26234/26243; plantilla L25341-25361; clic L27078, `isLabChecked`/`selectedLabTime` L27177-27178 → L27286-27290; `apiLaboratorioAgendarAuto` L20585/20618; `format12hTime("")` L20541 | **alta** | ✂️ |
| 2 | UX-2 | Agendar · vencimiento | El segundo aviso «esta fecha deja vencer un examen» se pinta en `#vgl-agm-vencaviso`, que vive dentro de `#vgl-step-view-2` (oculto en el paso 3); el botón «🎯 Pasar a la fecha sugerida» no se ve | plantilla L25255/L25278; `_pintarAvisoVencimiento` L26820-26879; llamada L27126 | **alta** | ✂️ |
| 3 | UX-3 | Toma · SMS | El SMS de la toma devuelve `smsEnviado` y nadie lo lee: el post-cita muestra «Toma de laboratorio dd/mm · hh:mm» sin decir si el paciente recibió el mensaje (C5 solo cubrió el SMS de la cita); LabSolo ni siquiera pasa celular | L20708-20734 (comentario «sin llamador hoy» L20729-20731); `extra.lab` L27314-27319; LabSolo L27677/27701-27705; `bloqueLab` L22059-22062 | **alta** | ✂️ |
| 4 | UI-1 | `#vgl-toasts` sobre `#vgl-root` | Los avisos tapan cabecera, reloj, semáforos y badges de la 1.ª cita en ambas resoluciones | `#vgl-toasts{top:16px;right:16px}` L17586 vs `#vgl-root{bottom:22px;right:22px}` L16149 · solape 384×185 / 384×135 · `colisiones_*.png` | **alta** | ✂️ |
| 5 | UI-2 | Esquina inferior derecha | Cinco superficies compiten: post-cita tapa el panel; el HUD del piloto tapa «Imprimir recordatorio»; Deshacer tapa post-cita | L18367, L16240, L18001, L16326 · solapes 336×160, 334×70, 176×38 · `esquina_*.png` | **alta** | ✂️ |
| 6 | UI-3 | `#vgl-min-bar` sobre `#vgl-dock` | Con el panel plegado y un módulo minimizado, la barra esconde la pastilla «Centinela» | L17853 (`left:14px;bottom:14px`) vs L17559 (`left:12px;bottom:16px`) · 142×30 · `minbar_1366x768.png` | **alta** | ✂️ |
| 7 | UX-4 | Agendar · confirmar | El botón de confirmar es el canal de tres avisos encadenados (~100 caracteres cada uno, otro clic ≥700 ms cada uno): el médico puede pulsar cuatro veces sin ver un cuadro de decisión | L27085-27129 | media | ✂️ |
| 8 | UX-5 | Dock | Mientras el resumen automático no termina, no hay Panel ni «Faltan antecedentes» ni sustituto: el sexto botón aparece de golpe 3-6 s después | L7593, L7598, L7757-7781; `autoCalcularResumenSiNecesario` L7529 | media | ✂️ |
| 9 | UX-6 | Próximo control | Sin resumen: «Abra la historia un momento … y vuelva a abrir este módulo», estando el médico dentro de la historia (el botón solo existe ahí) | `openPaquetesModal` L22700-22703; dock L7806-7815 | media | ✂️ |
| 10 | UX-7 | Toma · avisos | Toma fallida = cuatro canales: `spToast` 14 s abajo-derecha + toast ÁMBAR persistente + línea roja del post-cita + texto del botón | `spToast` L20576/20619/20659/20693; C4 L27297-27307 | media | ✂️ |
| 11 | UX-8 | Toasts | >3 avisos en 500 ms → «Alerta Múltiple (N) — 3 alertas críticas y 1 rutinarias» sin ningún título: no se sabe de qué ni de quién | `showToast` L14537-14543 (cf. `_agruparToasts` L14521) | media | ✂️ |
| 12 | UX-9 | Agendar · chips | `_sondearAgendaDeCadaDia` borra chips de día sin agenda en segundo plano: los chips se corren bajo el cursor y el clic cae en otro día | L26436-26439 | media | ✂️ |
| 13 | UX-10 | Agendar · paso 2 | «Siguiente: Confirmación ➔» apagado sin explicación; «Elija un horario para continuar» se escribe en el botón del paso 3, invisible | L26188-26194; `step2Next` L25540 | media | ✂️ |
| 14 | UX-11 | Reconciliador | Botones fijos «Sí tiene / No tiene» y título «Las fuentes no coinciden» también para las preguntas de la escalera (repetir, adecuación, adherencia) | L24895-24896, L24906; preguntas L5791, L5947, L5960 | media | ✂️ |
| 15 | UX-12 | Panel | Hasta dos cuadros previos en serie (reconciliador → «Faltan antecedentes») antes del Panel, cada uno con su propia salida | `openPanelPacienteModal` L24381-24418 | media | ⚖️ |
| 16 | UX-13 | Ordenar | «Generar» abre y enfoca una pestaña en blanco en el clic; el progreso, el bloque verde y «Imprimir orden de…» quedan detrás | L28574, L28631 | media | ⚖️ |
| 17 | UX-14 | Ordenar | ✕, «Cancelar» y Escape siguen activos durante el lote; cerrar a mitad pierde los botones de imprimir y el correo de las órdenes ya creadas | `closeMod` L28214-28221; L28577; `_activarAccesibilidadModal` L28540; `finally` L28671-28673 | media | ✂️ |
| 18 | UX-15 | Aviso universal | «Pendientes de este paciente» es de un solo uso por jornada, cierra con clic fuera y no se puede volver a ver | `avisoUniversal` L14169-14243; `checkAvisoUniversal` L14244 | media | ⚖️ |
| 19 | UX-16 | Agendar · apertura | `cargarHoras` corre dos veces al abrir (vía `renderDayChips` y en `_rumTramo("agm.abrir")`) | L26412, L27038, L27373 · **medido hoy con el arnés** (`medir_doble_cargarHoras.js`): 1 `BuscarPaciente`, 18 `BuscarCitasDisponibles` **sin ninguna fecha repetida**, 1 `ObtenerTurnos` — la segunda llamada la invalida el token y la fusión de peticiones de C19 | media | ✅ ya cerrado (v18.0.110, C19) |
| 20 | UI-4 | Panel oscuro (tarjetas) | Acentos calibrados «sobre OLED» medidos sobre vidrio al 88 % encima de un Everest blanco: 7/80 nodos bajo AA | `--bg:rgba(7,10,16,.88)` L16001 · «En sala» 3,89:1, «Atendido» 4,26:1 · `panel_oscuro_1366x768.png` | media | ✂️ |
| 21 | UI-5 | Tema claro (todas) | `--c-morado/--c-azul/--c-verde` claros insuficientes sobre sus tintes: 14 fallas en 4 superficies, incluidos los CTA «Generar», «Siguiente», «Cerrar» | L16097-16098 · «Generar» 3,99:1, «Siguiente» 4,39:1, «+1 más» 2,69:1 · `panel_claro_*`, `ia_claro_*`, `labs_claro_*` | media | ✂️ |
| 22 | UI-6 | Agendar claro (stepper) | Números de paso casi invisibles: `#020617` sobre acento claro | `VGL_UX_CSS` L15862-15863 · 2,84:1 y 2,63:1 | media | ✂️ |
| 23 | UI-7 | `.vgl-tip-btn` / `.vgl-btn-undo` | Blanco literal sobre acento pastel al pulsar/expandir: `#fff` sobre `#a78bfa` = 2,72:1 | L15831-15834, L15925 | media | ✂️ |
| 24 | UI-8 | Labs, Panel, Resumen | Opacidad apilada sobre `--fg3` deja datos clínicos bajo AA (año del resultado 3,30:1 claro; pie del bento 3,51:1; «+N más» 2,69:1) | L18618 (.72), L15944 (.75), L15891 (.7), L16564 (.60), L17249 (.75) | media | ✂️ |
| 25 | UI-9 | Ajustes, claro | Interruptor iOS invisible en reposo (riel 1,25:1, perilla 1,32:1; WCAG 1.4.11 pide 3:1) | L17424-17436 | media | ✂️ |
| 26 | UI-10 | `.vgl-hc` | «Alto contraste» no sube ningún contraste: en claro deja las mismas 6 fallas | L16593-16597 · `panel_hc_claro_1366x768.png` | media | ✂️ |
| 27 | UI-11 | Modales Panel/IA/Ficha/Tablero/Confirma/Llenar/Riesgo, min-bar, burbuja | Fuera de la lista `prefers-reduced-motion`: siguen animando (`vglSpringIn .3s` + 14 transiciones medidas) | L16216-16226 | media | ✂️ |
| 28 | UI-12 | Semáforos `.vgl-tl` | Sin foco de teclado visible (`outline:none !important` gana a `:focus-visible`); objetivos 12×12 px a 20 px de centro | L16542 vs L16510-16516; L16531 `gap:8px` | media | ✂️ |
| 29 | UI-14 | `#vgl-sidebar` | `backdrop-filter` anidado dentro de otro: invisible (96,4 % opaco) y una pasada de blur extra por cuadro en cada arrastre | L16949-16950 | media (rendimiento 1366) | ✂️ |
| 30 | UX-17 | Laboratorios | Chapa «✓ En línea» estática aunque el portal no responda | L22767; L22853-22856 (solo reescribe con lectura exitosa); L22946-22948 | baja | ✂️ · ⚠ parcial (v18.0.115 C11 ya la reescribe en éxito; en fallo sigue «✓») |
| 31 | UX-18 | Agendar · rótulos | Numeración doble (stepper vs «2 Plazo…»/«3 Horarios…»); la leyenda promete «Confirmar y asignar cita», rótulo que el botón ya no lleva cuando se puede pulsar | L25199-25205 vs L25259/25291; L25213 vs L25710/26167/26182 | baja | ✂️ |
| 32 | UX-19 | Redactor | «Copiar» anuncia «Copiado al portapapeles.» sin esperar la promesa y cuenta adopción | L42978-42990 | baja | ✂️ |
| 33 | UX-20 | Redactor | Estado «Generando con gemini-…» con el nombre técnico del modelo en la línea principal | L42881, L42890 | baja | ✂️ |
| 34 | UX-21 | Post-cita | El panel se cierra solo a los 5 min aunque el médico esté escribiendo el celular del reenvío | L22265 | baja | ✂️ |
| 35 | UX-22 | Agendar · programa | «Programa al que se carga la cita» preselecciona el primero de la lista sin aviso cuando hay varios | L25865-25866 | baja | ⚖️ |
| 36 | UX-23 | Agendar · primer cupo | «⚡ Primer cupo disponible» recorre hasta 30 días sin botón para detenerlo | L26531-26545 | baja | ✂️ |
| 37 | UX-24 | Faltan antecedentes | Con todas las filas en «No sé» el primario sigue diciendo «Aceptar y llenar en Everest»; escribe 0 | L24286-24287, L24308-24311 | baja | ✂️ |
| 38 | UX-25 | Agendar → LabSolo | «SOLO Laboratorios» abre otro cuadro sin stepper; su «Cancelar» no vuelve al paso 1 | L25528-25530; L27480-27486 | baja | ⚖️ |
| 39 | UX-26 | Agendar → Panel | «❤️ Ver riesgo…» puede encadenar reconciliador y llenado encima del Agendar: tres capas | L25280; L24381-24418 | baja | ⚖️ |
| 40 | UI-13 | `.vgl-dock-btn` | Sin anillo de foco del sistema (cae al del navegador) | L16510-16516 no lo lista | baja | ✂️ (va con #28) |
| 41 | UI-15 | Agendar/Ordenar/Labs | Velo casi negro también en tema claro + blur 10 px sobre toda la historia | L17797-17803 · `agendar_claro_1366x768.png` | baja | ✂️ |
| 42 | UI-16 | Pie pegajoso Agendar/Ordenar | Vidrio que desenfoca las losetas/CUPS que pasan por debajo; una capa GPU por modal | L18933-18943, L19086-19096 | baja | ✂️ |
| 43 | UI-17 | `#vgl-dot.bg` | Pulso infinito en el estado SANO: movimiento periférico 8 h al día | L16577 | baja | ✂️ |
| 44 | UI-18 | `.vgl-sp-toast` | Colores literales, sin `.light` por JS, z-index literal | L16240, L16242; `applyTheme` L9169-9178 · `sp_toast_claro_1366x768.png` | baja | ✂️ |
| 45 | UI-19 | Panel 1366×768 | 3 citas visibles de 10; 4 con espaciado compacto | L17081-17106 · `propuesta_panel_compacto_1366x768.png` | baja | ⚖️ |
| 46 | UI-20 | Hoja de estilos | 57 `font-size` literales fuera de la escala (12 tamaños) | censo L15698-19328 + L45401-45427 | baja | ✂️ (Jules) |
| 47 | UI-21 | Sidebar del panel | Emoji y Lucide mezclados en la misma columna de botones | L19373-19374 vs vecinos SVG | baja | ✂️ |
| 48 | UI-22 | `#vgl-toasts` | `--z-toast` declarado (L16057) sin consumidor; el toast usa literal `2147483646` | L17586 | baja | ✂️ (va con #4) |

Cierres verificados que NO estaban en las tablas de fase 1-2 y se descuentan del recorrido: C17 «Siguiente con
valores por defecto» (v18.0.115), C11 «consulta en vivo cada apertura» (v18.0.115), «no hay camino de vuelta a
Agendar» y motivo de la anulación (v18.0.114), un hecho = un aviso por navegador (v18.0.113).

---

## Fase 3 — Refactorización y entrega (Arquitecto_Vanilla)

### Principios aplicados

- **macOS-clean y Bento Box**: cada superficie conserva su celda; no se añade ningún panel nuevo, se reubican los
  flotantes en un «presupuesto de esquinas» (una superficie por esquina) y los avisos de decisión viven dentro del
  cuadro que los provoca (recuadro `#vgl-agm-confirm-aviso` con el mismo dibujo que el aviso de vencimiento).
- **Glassmorphism sutil, nunca sobre texto clínico**: se retiran **tres** `backdrop-filter` (sidebar anidado y los
  dos pies pegajosos) y no se añade ninguno; el velo de los modales de flujo se conserva (tapar es su función).
- **Paleta oscura OLED-friendly**: ningún negro puro (`--bg-solid:#090c12` se mantiene); el vidrio del panel sube a
  `.94` para que los acentos pastel se midan sobre lo que de verdad hay debajo (un Everest blanco).
- **Contraste ≥ 4,5:1 medido**, no deducido: cada valor nuevo (`--c-*` claros, `--bg-solid` sobre acento, riel del
  interruptor `#7f899b`) viene re-medido en `variantes.js` sobre el CSS real; el alto contraste pasa a mover tokens.
- **`prefers-reduced-motion` completo**: los 13 contenedores que faltaban entran en la misma regla (mismos dos
  `!important` ya contados).
- **DOM eficiente**: ninguna escritura por tick nueva (el dock sigue con su firma `_sigDock`, que ya incluye
  `PB/pb`); los chips se apagan con `disabled` + clase en vez de `remove()` (sin reflow ni salto bajo el cursor);
  la barra de decisión reutiliza un nodo fijo (`innerHTML` una vez por aviso).
- **Asíncrono sin bloquear**: «Reintentar» de Próximo control espera `mtrCalcularResumenClinico` con guardas
  `cerrado`; el candado de Ordenar solo apaga botones y se suelta en el `finally` existente.
- **Reglas del proyecto**: casilla vacía antes que dato inventado (la línea «SMS de la toma» solo se pinta si hay
  desenlace); la casilla del médico es sagrada (nada escribe en Everest); el médico manda (ningún fragmento actúa sin
  clic — desplegar el detalle de la hora es mostrar, no actuar); cero PHI; toda regla de color nueva fuera de
  `#vgl-root` lleva `!important` (aquí no se crea ninguna: se reutilizan selectores ya blindados); `font-size`
  siempre `var(--t-*)`; sin `alert/confirm`; los cuadros de escritura siguen sin cerrar con clic fuera.

### Fragmentos de código

Numeración: **F-n** = fragmento; entre paréntesis, la fila de la tabla y el origen. Los bloques «Antes» están
copiados del árbol actual; «Después» es código completo, sintácticamente válido, sobre funciones que existen
(verificadas con grep). Versión de destino: **v18.0.117** (bump de `@version` L4 y `const VERSION` L1037).

---

#### F-1 (fila 1, UX-1) — La toma marcada sin hora no pasa; motivo honesto en la API

**Dónde (a):** `openAgendamientoModal` → listener `confirmBtn.addEventListener("click", …)`, justo antes de
`confirmBtn.disabled = true;` (L27131). `_planDet`/`_planCambiar` (L25560-25561) y `tipoCitaElegido` están en el
mismo ámbito.

**Antes (L27130-27132):**
```js
      }
      confirmBtn.disabled = true;
      confirmBtn.textContent = "⏳ Asignando cita...";
```

**Después:**
```js
      }
      // v18.0.117 (UI/UX #1) — la toma marcada SIN hora no pasa: el select vivía plegado tras
      // «✎ Cambiar fecha u hora», la cita se creaba y la toma fallaba con un motivo falso
      // («el horario elegido () ya no está disponible»). Se despliega, se enfoca y se pide la
      // hora. Ningún dato se inventa: la hora la elige el médico o desmarca la casilla.
      {
        const _chkLab = modal.querySelector("#vgl-agm-lab-chk");
        const _selLab = modal.querySelector("#vgl-agm-lab-time-sel");
        if (tipoCitaElegido === "control_lab" && _chkLab && _chkLab.checked && _selLab && !_selLab.value) {
          if (_planDet && _planDet.classList) _planDet.classList.remove("vgl-d-none");
          if (_planCambiar) _planCambiar.textContent = "▲ Ocultar ajustes";
          try { _selLab.focus(); } catch (e) {}
          confirmBtn.textContent = "Elija la hora de la toma (o desmarque «Agendar también la Toma de Muestras»)";
          try { uxTrack("cita.toma.sin_hora"); } catch (e) {}
          return;
        }
      }
      confirmBtn.disabled = true;
      confirmBtn.textContent = "⏳ Asignando cita...";
```

**Dónde (b):** `cargarHorasLab` (L26197), tras `labChk.checked = …` (L26243).

**Antes (L26239-26243):**
```js
            if (labChk) { labChk.disabled = false;
        // v17.6.53 (1.8) — si el médico ya eligió a mano (en CUALQUIER recarga anterior),
        // esa elección manda siempre, por encima del default de labs-primero. Sin
        // elección previa, se comporta como antes: marcado si labs-primero, si no vacío.
        labChk.checked = _labChkEditadoManual ? _labChkValorManual : _chkPorDefecto;
```

**Después:**
```js
            if (labChk) { labChk.disabled = false;
        // v17.6.53 (1.8) — si el médico ya eligió a mano (en CUALQUIER recarga anterior),
        // esa elección manda siempre, por encima del default de labs-primero. Sin
        // elección previa, se comporta como antes: marcado si labs-primero, si no vacío.
        labChk.checked = _labChkEditadoManual ? _labChkValorManual : _chkPorDefecto;
        // v18.0.117 (UI/UX #1) — si la casilla queda MARCADA (labs-primero) y la hora sigue
        // sin elegir, la hora no puede vivir plegada: se muestra el detalle (solo mostrar).
        if (labChk.checked && labTimeSel && !labTimeSel.value
            && _planDet && _planDet.classList && _planDet.classList.contains("vgl-d-none")) {
          _planDet.classList.remove("vgl-d-none");
          if (_planCambiar) _planCambiar.textContent = "▲ Ocultar ajustes";
        }
```

**Dónde (c):** `apiLaboratorioAgendarAuto` (L20562), antes de `if (turnos && turnos.length && horaSeleccionada)`
(L20585). Segunda red: el motivo dice lo que pasó.

**Antes (L20584-20585):**
```js
      let turnoElegido = null;
      if (turnos && turnos.length && horaSeleccionada) {
```

**Después:**
```js
      let turnoElegido = null;
      // v18.0.117 (UI/UX #1) — sin hora elegida no existe «horario que ya no está disponible»:
      // el motivo dice la verdad (el modal ya lo impide antes de crear la cita; esta es la red).
      if (!horaSeleccionada) {
        _labUltimoFallo = "no se eligió la hora de la toma";
        spToast("⚠ No se eligió la hora de la toma de muestras: NO se agendó. Elíjala desde «Agendar labs» en la tarjeta del paciente.", 12000);
        return false;
      }
      if (turnos && turnos.length && horaSeleccionada) {
```

**Verificación:** `tests/suite_15_interfaz_avanzada.js` — caso nuevo «v18.0.117 (UI/UX #1): con la toma marcada y
sin hora, Confirmar no crea la cita, despliega `#vgl-agm-plan-det` y pide la hora» (mock como el de L2618:
`labChk.checked = true`, `disparar(confirmBtn, "click")`, `await esperar(60)`; asertar 0 peticiones `AsignarTurno`,
`_planDet` sin `vgl-d-none`, `confirmBtn.textContent` contiene «Elija la hora»). Mutación: quitar el `return` →
`AsignarTurno` se pide (rojo). `tests/suite_13_api_agenda.js` — caso nuevo: `apiLaboratorioAgendarAuto("555111",
iso, "", "")` devuelve `false` y `_labMotivoUltimoFallo()` = «no se eligió la hora de la toma»; mutación: quitar la
guarda → motivo «… elegido () ya no está disponible» (rojo). Δ !important: **0**.

---

#### F-2 (fila 2, UX-2) — El aviso de vencimiento se ve también en «3 Confirmación»

**Dónde (a):** plantilla de `openAgendamientoModal`: sacar `#vgl-agm-vencaviso` de `#vgl-step-view-2` (L25278) y
ponerlo después de la leyenda `#vgl-agm-caption` (L25213), fuera de las tres vistas. Su CSS es por id
(L16925-16931) y no depende del ancestro.

**Antes (L25277-25278, dentro de `#vgl-step-view-2`):**
```html
              <div id="vgl-agm-sugerida" class="vgl-agm-sugerida" aria-live="polite"></div>
              <div id="vgl-agm-vencaviso" class="vgl-d-none" aria-live="polite"></div>
```

**Después (L25278 se borra; se inserta tras L25213):**
```html
        <div class="vgl-ux-caption" id="vgl-agm-caption">Agenda la cita directamente en Everest, … Laboratorios.</div>
        <!-- v18.0.117 (UI/UX #2) — fuera de las vistas de paso: el segundo aviso de vencimiento
             (al pulsar Confirmar) se pintaba aquí dentro del paso 2 oculto; ahora se ve en el 3. -->
        <div id="vgl-agm-vencaviso" class="vgl-d-none" aria-live="polite"></div>
```

**Dónde (b):** `_pintarAvisoVencimiento` (L26820), listener del botón «🎯 Pasar a la fecha sugerida» (L26859).

**Antes (L26859-26861):**
```js
      if (fix) fix.addEventListener("click", () => {
        try { uxTrack("cita.vencimiento.corregir"); } catch (e) {}
        _vencAceptado = false;
```

**Después:**
```js
      if (fix) fix.addEventListener("click", () => {
        try { uxTrack("cita.vencimiento.corregir"); } catch (e) {}
        // v18.0.117 (UI/UX #2) — desde «3 Confirmación» el arreglo vive en el paso 2: se vuelve ahí.
        if (pasoActual !== 2) irAPaso(2);
        _vencAceptado = false;
```

**Verificación:** `suite_15` caso «v17.6.13: accesibilidad del modal — aria-live en los 4 estados» (L4553-4558)
sigue en 4; caso nuevo «v18.0.117 (UI/UX #2): el aviso de vencimiento no vive dentro del paso 2» — sobre
`modal.innerHTML`, `indexOf('id="vgl-agm-vencaviso"') < indexOf('id="vgl-step-view-1"')`. Mutación: devolver el
`<div>` al paso 2 → rojo. Δ !important: **0**.

---

#### F-3 (fila 3, UX-3) — El post-cita dice el desenlace del SMS de la toma

**Dónde (a):** clic de confirmar de Agendar, `_cierreCtx.extra.lab = {…}` (L27314-27319).

**Antes (L27314-27319):**
```js
              _cierreCtx.extra.lab = {
                fechaIso: labFecha.iso, fechaLegible: labFecha.fmt || labFecha.iso,
                hora: selectedLabTime ? format12hTime(selectedLabTime) : "",
                radicado: (labOk && labOk.radicado) || "",
                sede: S.sedeLabNombre || "",
              };
```

**Después:**
```js
              _cierreCtx.extra.lab = {
                fechaIso: labFecha.iso, fechaLegible: labFecha.fmt || labFecha.iso,
                hora: selectedLabTime ? format12hTime(selectedLabTime) : "",
                radicado: (labOk && labOk.radicado) || "",
                sede: S.sedeLabNombre || "",
                // v18.0.117 (UI/UX #3) — el desenlace del SMS de la TOMA, que la API ya devolvía
                // (smsEnviado, v12.3.31) y nadie leía: el panel lo dice como dice el de la cita (C5).
                sms: (labOk && labOk.smsEnviado)
                  ? "enviado al " + String(celularSms || "").replace(/\D/g, "")
                  : (celularSms ? "AppCita no confirmó el envío" : "sin celular: no se envió"),
              };
```

**Dónde (b):** `openLabSoloModal`, `mostrarPanelPostCita(… { lab: {…} })` (L27701-27705). Este cuadro llama a
`_agmAgendarLabConCandado(…, undefined, …)` (L27677): no maneja celular, y se dice tal cual.

**Antes (L27701-27705):**
```js
              lab: {
                fechaIso: selectedLabDateInfo.iso, fechaLegible: selectedLabDateInfo.fmt,
                hora: format12hTime(selectedLabTime), radicado: (ok && ok.radicado) || "",
                sede: S.sedeLabNombre || "",
              },
```

**Después:**
```js
              lab: {
                fechaIso: selectedLabDateInfo.iso, fechaLegible: selectedLabDateInfo.fmt,
                hora: format12hTime(selectedLabTime), radicado: (ok && ok.radicado) || "",
                sede: S.sedeLabNombre || "",
                sms: "no se envió: este cuadro no maneja celular",   // v18.0.117 (UI/UX #3): honesto, ver L27677
              },
```

**Dónde (c):** `mostrarPanelPostCita`, `bloqueLab` (L22059-22062). Se reutiliza `.vgl-postcita-lab`, que ya lleva
`color:var(--fg2) !important` (L18432).

**Antes (L22059-22062):**
```js
      const bloqueLab = !lab ? "" : `
          ${ex.soloLab ? "" : `<div class="vgl-postcita-sep vgl-postcita-labsep"></div>`}
          <div class="vgl-postcita-lab"><b>Toma de laboratorio</b> ${escapeHtml([lab.fechaLegible || lab.fechaIso || "", lab.hora ? "· " + lab.hora : ""].filter(Boolean).join(" "))}</div>
          <button class="vgl-agm-btn sec" id="vgl-postcita-labprint">Imprimir recordatorio de la toma</button>`;
```

**Después:**
```js
      const bloqueLab = !lab ? "" : `
          ${ex.soloLab ? "" : `<div class="vgl-postcita-sep vgl-postcita-labsep"></div>`}
          <div class="vgl-postcita-lab"><b>Toma de laboratorio</b> ${escapeHtml([lab.fechaLegible || lab.fechaIso || "", lab.hora ? "· " + lab.hora : ""].filter(Boolean).join(" "))}</div>
          ${lab.sms ? `<div class="vgl-postcita-lab">📱 SMS de la toma: ${escapeHtml(String(lab.sms))}</div>` : ""}
          <button class="vgl-agm-btn sec" id="vgl-postcita-labprint">Imprimir recordatorio de la toma</button>`;
```
(«casilla vacía antes que dato inventado»: sin `lab.sms` no se pinta ninguna línea.)

**Verificación:** `tests/suite_62_cierre_cita.js` — caso nuevo «v18.0.117 (UI/UX #3): el post-cita dice el
desenlace del SMS de la toma y calla si no lo sabe»: `mostrarPanelPostCita("1", "", "PACIENTE SINTETICO", "", {lab:
{fechaIso:"2026-09-10", hora:"06:20 AM", sms:"enviado al 3001112233"}})` → el HTML contiene «SMS de la toma:
enviado al 3001112233»; sin `sms` → no contiene «SMS de la toma». Mutación: quitar el `${lab.sms ? …}` → rojo.
`suite_13` L547/590/652 (`smsEnviado`) siguen igual. Δ !important: **0**.

---

#### F-4 (fila 7, UX-4) — Un recuadro de decisión en vez de tres reescrituras del botón

**Dónde:** (a) plantilla del paso 3, antes del pie (L25367); (b) helper nuevo junto a `_pintarAvisoVencimiento`
(L26820); (c) las tres ramas del clic (L27099-27104, L27107-27115, L27123-27129); (d) CSS L16925-16931
(se extienden los selectores existentes: **ninguna declaración de color nueva**).

**Antes (a, L25367-25370):**
```html
          <div class="vgl-agm-foot" style="margin-top:18px">
            <button type="button" id="vgl-step-3-back" class="vgl-agm-btn sec">↩ Modificar / Atrás</button>
            <button type="button" id="vgl-agm-confirm" class="vgl-agm-btn pri" disabled>✓ Confirmar y asignar cita</button>
          </div>
```

**Después (a):**
```html
          <!-- v18.0.117 (UI/UX #4) — aquí aterrizan los avisos «pulse otra vez» con dos salidas -->
          <div id="vgl-agm-confirm-aviso" class="vgl-d-none" role="alert"></div>
          <div class="vgl-agm-foot" style="margin-top:18px">
            <button type="button" id="vgl-step-3-back" class="vgl-agm-btn sec">↩ Modificar / Atrás</button>
            <button type="button" id="vgl-agm-confirm" class="vgl-agm-btn pri" disabled>✓ Confirmar y asignar cita</button>
          </div>
```

**Después (b) — helper nuevo, antes de `function _pintarAvisoVencimiento()` (L26820):**
```js
    // v18.0.117 (UI/UX #4) — LOS AVISOS DE CONFIRMACIÓN SE LEEN, NO SE ADIVINAN. Antes el botón
    // de confirmar era el canal de tres avisos encadenados («vuelo ajeno», «ya hay cita hoy»,
    // «llegaría vencido»), cada uno de ~100 caracteres y cada uno exigiendo otro clic: el médico
    // podía pulsar cuatro veces sin ver un solo cuadro de decisión. Misma doble confirmación
    // consciente, en un recuadro con dos salidas explícitas; el botón conserva su rótulo.
    function _agmAvisoConfirmar(texto, onSeguir, onRevisar) {
      const caja = modal.querySelector("#vgl-agm-confirm-aviso");
      if (!caja) { confirmBtn.textContent = "⚠ " + texto + " — pulse otra vez para continuar"; return; }
      caja.innerHTML = `<b>⚠ Antes de crear la cita.</b> ${escapeHtml(texto)}<div>`
        + `<button type="button" class="vgl-agm-pbtn" id="vgl-agm-ca-si">Sí, crear igual</button>`
        + `<button type="button" class="vgl-agm-pbtn" id="vgl-agm-ca-no">Revisar</button></div>`;
      if (caja.classList) caja.classList.remove("vgl-d-none");
      const ocultar = () => { if (caja.classList) caja.classList.add("vgl-d-none"); caja.innerHTML = ""; };
      const si = caja.querySelector("#vgl-agm-ca-si"), no = caja.querySelector("#vgl-agm-ca-no");
      if (si) si.addEventListener("click", () => { ocultar(); onSeguir(); });
      if (no) no.addEventListener("click", () => { ocultar(); if (onRevisar) onRevisar(); });
    }
```

**Antes (c, rama «cita de hoy», L27107-27115; las otras dos siguen el mismo patrón):**
```js
      const dupCita = citaAgendadaFechaHoy(apt.doc_id);
      if (dupCita && confirmBtn.dataset.dupOk !== "1") {
        confirmBtn.dataset.dupOk = "1";
        const pf = String(dupCita).split("-");
        const dupFmt = pf.length === 3 ? pf[2] + "/" + pf[1] + "/" + pf[0] : String(dupCita);
        confirmBtn.textContent = "⚠ Hoy ya se le creó una cita (" + dupFmt + ") — pulse otra vez SOLO si quiere crear OTRA";
        uxTrack("cita.antidup.aviso");
        return;
      }
```

**Después (c) — las tres ramas:**
```js
      // v18.0.117 (UI/UX #4) — el flag «Ok» se escribe SOLO al pulsar «Sí, crear igual»; ese botón
      // vuelve a disparar el clic (ultimoClic=0 salta la guarda de 700 ms). «Revisar» limpia el flag.
      const _reclic = (flag) => { confirmBtn.dataset[flag] = "1"; confirmBtn.dataset.ultimoClic = "0"; confirmBtn.click(); };
      {
        let _ajeno = null;
        try { _ajeno = enVueloAjeno("cita", apt.doc_id); } catch (e) { _ajeno = null; }
        if (_ajeno && confirmBtn.dataset.vueloOk !== "1") {
          _agmAvisoConfirmar("Hace " + _ajeno.edadS + " s se empezó a crear una cita para este paciente en otra pestaña o antes de recargar. Verifique en Everest y siga SOLO si no existe.",
            () => _reclic("vueloOk"), () => { confirmBtn.dataset.vueloOk = ""; });
          try { uxTrack("cita.antidup.vuelo_ajeno"); } catch (e) {}
          return;
        }
      }
      const dupCita = citaAgendadaFechaHoy(apt.doc_id);
      if (dupCita && confirmBtn.dataset.dupOk !== "1") {
        const pf = String(dupCita).split("-");
        const dupFmt = pf.length === 3 ? pf[2] + "/" + pf[1] + "/" + pf[0] : String(dupCita);
        _agmAvisoConfirmar("Hoy ya se le creó una cita (" + dupFmt + "). Siga SOLO si quiere crear OTRA (p. ej. otra especialidad).",
          () => _reclic("dupOk"), () => { confirmBtn.dataset.dupOk = ""; });
        uxTrack("cita.antidup.aviso");
        return;
      }
      {
        let avConf = null;
        try { avConf = _avisoVencimientoActual(); } catch (e) { avConf = null; }
        if (avConf && confirmBtn.dataset.vencOk !== "1") {
          try { _vencAceptado = false; _pintarAvisoVencimiento(); } catch (e) {}   // con F-2 el 🎯 ya se ve aquí
          _agmAvisoConfirmar("Con esta fecha, " + avConf.analito + " llegaría vencido. Arriba tiene «🎯 Pasar a la fecha sugerida».",
            () => _reclic("vencOk"), () => { confirmBtn.dataset.vencOk = ""; irAPaso(2); });
          try { uxTrack("cita.vencimiento.aviso_confirmar"); } catch (e) {}
          return;
        }
      }
```

**Antes (d, L16925-16931):**
```css
      #vgl-agm-vencaviso{
        margin-top:8px;padding:10px 12px;border-radius:var(--r-card);
        background:rgba(var(--rgb-ambar),.10);border:1px solid rgba(var(--rgb-ambar),.45);
        font-size:var(--t-micro);color:var(--fg2) !important;line-height:1.5
      }
      #vgl-agm-vencaviso b{color:var(--c-ambar) !important}
      #vgl-agm-vencaviso .vgl-agm-pbtn{margin:8px 6px 0 0}
```

**Después (d):**
```css
      /* v18.0.117 (UI/UX #4) — el recuadro de decision de Confirmar comparte el dibujo del aviso
         de vencimiento: mismas tres reglas, un selector mas, cero declaraciones de color nuevas */
      #vgl-agm-vencaviso,#vgl-agm-confirm-aviso{
        margin-top:8px;padding:10px 12px;border-radius:var(--r-card);
        background:rgba(var(--rgb-ambar),.10);border:1px solid rgba(var(--rgb-ambar),.45);
        font-size:var(--t-micro);color:var(--fg2) !important;line-height:1.5
      }
      #vgl-agm-vencaviso b,#vgl-agm-confirm-aviso b{color:var(--c-ambar) !important}
      #vgl-agm-vencaviso .vgl-agm-pbtn,#vgl-agm-confirm-aviso .vgl-agm-pbtn{margin:8px 6px 0 0}
```

**Verificación:** `suite_15` — caso nuevo «v18.0.117 (UI/UX #4): con cita de hoy, Confirmar pinta el recuadro y no
crea nada; «Sí, crear igual» sí crea; «Revisar» deja el flag limpio» (con `markCitaAgendadaHoy` previo y
`disparar(si, "click")` — en el DOM falso `confirmBtn.click()` es un no-op, así que la prueba dispara el listener a
mano tras comprobar `dataset.dupOk === "1"`). Mutación: dejar `confirmBtn.dataset.dupOk = "1"` antes del recuadro →
el segundo clic directo crea la cita sin decisión (rojo). suite_25 Regla A/P/S: sin cambios (mismas declaraciones);
Chromium: `verificar_color_chromium.js` sobre `#vgl-agm-confirm-aviso b` → ámbar sobrevive al adversario.
Δ !important: **0**.

---

#### F-5 (fila 8, UX-5) — El sexto botón del dock existe mientras «lee»

**Dónde:** `createAccionesDockUI` (L7547), tras la rama `else if (_autorizado && _resumenListoParaGate && … )`
(L7768-7781). `_sigDock` ya incluye `PB/pb` (L7618): el dock se repinta solo cuando el resumen llega.

**Antes (L7768-7772 y cierre L7781):**
```js
    } else if (_autorizado && _resumenListoParaGate && _factoresParaGate && _pendientesPanel.length > 0) {
      // v18.0.112 (S+ flujo, C12; decisión del médico, 02-sep) — con antecedentes por documentar
      // el botón «Panel» no existía y el ayudante «Faltan antecedentes» (que los llena con
      // Deshacer) quedaba inalcanzable. Un botón atenuado dice QUÉ falta y abre el ayudante.
      const _etq = _pendientesPanel.map((x) => x.etiqueta).join("; ");
      …
    }
```

**Después (se añade una rama al final del `else if`):**
```js
    } else if (_autorizado && _resumenListoParaGate && _factoresParaGate && _pendientesPanel.length > 0) {
      …   (rama C12 intacta)
    } else if (_autorizado && !_resumenListoParaGate) {
      // v18.0.117 (UI/UX #5) — mientras el resumen automático corre (3-6 s, más si Athenea va
      // lenta) el sexto botón «aparecía de golpe»: un control que aparece solo desorienta tanto
      // como uno que desaparece (C3). Existe, atenuado y deshabilitado, y dice que está leyendo.
      // Ningún clic hace nada; .vgl-dock-btn:disabled (L16404) ya lo dibuja apagado.
      const bLeyendo = document.createElement("button");
      bLeyendo.className = "vgl-dock-btn vgl-dock-btn-atenuado";
      bLeyendo.setAttribute("data-accion", "ficha-leyendo");
      bLeyendo.disabled = true;
      bLeyendo.setAttribute("aria-disabled", "true");
      bLeyendo.setAttribute("aria-label", "Panel del paciente: leyendo la historia, disponible en unos segundos");
      bLeyendo.title = "🧾 Leyendo laboratorios, medicamentos e historia (unos segundos). Se activa solo al terminar.";
      _vglDockRotulo(bLeyendo, "🧾", VGL_ROTULOS.panel + " · leyendo…");
      btns.appendChild(bLeyendo);
    }
```

**Verificación:** `suite_15` — caso nuevo «v18.0.117 (UI/UX #5): sin resumen en caché el dock muestra
«🧾 Panel del paciente · leyendo…» deshabilitado; con resumen, el botón real» (patrón del caso C12, L5212).
Mutación: quitar la rama → rojo. Revisar con grep los casos de `suite_15` que cuentan botones del dock sin resumen
(`vgl-dock-btn`), que pasan de N a N+1. El caso C9 (L5181-5183) sigue casando (`_vglDockRotulo\(b[A-Za-z]+,
"[^"]+", VGL_ROTULOS\.panel`). Δ !important: **0**.

---

#### F-6 (fila 9, UX-6) — Próximo control: «todavía estoy leyendo» + Reintentar

**Dónde:** `openPaquetesModal` (L22589), bloque `if (!resumen)` (L22700-22704). `body`, `ordenarBtn`, `repintar`,
`d` (L22643), `resumen` (L22644) y `cerrado` (L22634) están en el ámbito.

**Antes (L22699-22704):**
```js
      try { resumen = mtrCacheResumenLeer(apt.doc_id); } catch (e) { resumen = null; }
      if (!resumen) {
        if (body) body.innerHTML = '<div class="vgl-agm-err">No se pudo leer el resumen del paciente. Abra la historia un momento (ahí se carga solo) y vuelva a abrir este módulo.</div>';
        if (ordenarBtn) ordenarBtn.style.display = "none";
        return;
      }
```

**Después:**
```js
      try { resumen = mtrCacheResumenLeer(apt.doc_id); } catch (e) { resumen = null; }
      if (!resumen) {
        // v18.0.117 (UI/UX #6) — el botón 📦 solo existe con la historia abierta: pedirle al médico
        // «abra la historia» era pedirle lo que ya hizo. Lo que pasa es que el cálculo automático
        // aún no terminó: se dice eso y se ofrece reintentar aquí mismo (calcula y repinta).
        if (body) body.innerHTML = '<div class="vgl-agm-err">⏳ Todavía estoy leyendo los exámenes y medicamentos de este paciente (unos segundos). '
          + '<button type="button" class="vgl-agm-pbtn vgl-sm" id="vgl-paquete-reintentar">Reintentar ahora</button></div>';
        if (ordenarBtn) ordenarBtn.style.display = "none";
        const _re = (body && body.querySelector) ? body.querySelector("#vgl-paquete-reintentar") : null;
        if (_re) _re.addEventListener("click", async () => {
          _re.disabled = true; _re.textContent = "⏳ Leyendo…";
          try { uxTrack("fn.paquete.reintentar"); } catch (e) {}
          try { await mtrCalcularResumenClinico(apt, () => !cerrado); } catch (e) {}
          if (cerrado) return;
          try { resumen = mtrCacheResumenLeer(apt.doc_id); } catch (e) { resumen = null; }
          if (!resumen) { _re.disabled = false; _re.textContent = "Reintentar ahora"; return; }
          try { d = mtrTableroClinico(resumen); } catch (e) { d = null; }
          if (ordenarBtn) ordenarBtn.style.display = "";
          repintar();
          _fnCompletado = true;
          try { uxTrack("fn.paquete.complete"); } catch (e) {}
        });
        return;
      }
```

**Verificación:** `suite_15` — caso nuevo «v18.0.117 (UI/UX #6): sin resumen, Próximo control dice que está leyendo y
«Reintentar ahora» repinta cuando el resumen llega» (stub `mtrCalcularResumenClinico` que escribe la caché).
Mutación: quitar el listener → tras el clic el cuerpo sigue diciendo «Todavía estoy leyendo» (rojo).
Δ !important: **0** (clases `.vgl-agm-err` y `.vgl-agm-pbtn` ya blindadas).

---

#### F-7 (fila 10, UX-7) — El HUD «Centinela» calla cuando el modal ya lo dice

**Dónde:** `apiLaboratorioAgendarAuto(docId, fechaIso, horaSeleccionada, celular)` (L20562) gana `opts`;
`_agmAgendarLabConCandado(docId, fechaIso, hora, celular, forzar)` (L25116) lo pasa; el clic de Agendar (L27290)
manda `{silencioso:true}` (ya tiene toast ámbar, panel y botón). LabSolo (L27677) NO lo manda: allí el HUD es el único
canal del fallo (L27709-27718 solo recarga las horas).

**Antes (L20562-20564 y la primera de las cuatro llamadas, L20576):**
```js
  async function apiLaboratorioAgendarAuto(docId, fechaIso, horaSeleccionada, celular) {
    _labUltimoFallo = "";
    try {
      …
        spToast(`⚠ No se pudo consultar la disponibilidad de laboratorio en AppCita (…). NO se agendó …`, 14000);
```

**Después:**
```js
  async function apiLaboratorioAgendarAuto(docId, fechaIso, horaSeleccionada, celular, opts) {
    _labUltimoFallo = "";
    // v18.0.117 (UI/UX #7) — con {silencioso:true} el HUD «🛡️ Centinela PyM» no se dispara: el
    // llamador (Agendar) ya dice el fallo en toast ámbar, panel post-cita y botón (C4). Cuatro
    // canales para un hecho eran ruido. El motivo (_labUltimoFallo) se sigue guardando igual.
    const _hud = (msg, ms) => { if (!(opts && opts.silencioso)) spToast(msg, ms); };
    try {
      …
        _hud(`⚠ No se pudo consultar la disponibilidad de laboratorio en AppCita (…). NO se agendó …`, 14000);
```
(las otras tres llamadas `spToast(` de la función — L20619, L20659, L20693 — y la nueva de F-1(c) pasan a `_hud(`.)

```js
  // L25116
  async function _agmAgendarLabConCandado(docId, fechaIso, hora, celular, forzar, opts) {
    …
      return await apiLaboratorioAgendarAuto(docId, fechaIso, hora, celular, opts);   // v18.0.117 (UI/UX #7)
```
```js
  // L27290 (Agendar)
          const labOk = await _agmAgendarLabConCandado(apt.doc_id, labFecha.iso, selectedLabTime, celularSms, false, { silencioso: true });   // v18.0.117 (UI/UX #7)
```

**Verificación:** `suite_13` — caso nuevo «v18.0.117 (UI/UX #7): con {silencioso:true} el fallo de la toma no crea
`#vgl-sp`; sin la opción sí» (`gmxhr` que devuelve turnos vacíos; asertar `doc.getElementById("vgl-sp") === null`
y `_labMotivoUltimoFallo()` no vacío). Mutación: cambiar `_hud` por `spToast` en la rama «no disponible» → rojo.
Los casos existentes de `suite_13` (4 argumentos) no cambian. Δ !important: **0**.

---

#### F-8 (fila 11, UX-8) — «Alerta Múltiple» dice de qué son los avisos

**Dónde:** `showToast` (L14527), rama `agrupados.length > 3` (L14541-14543).

**Antes (L14541-14543):**
```js
          _renderToast(mtrColorMasGrave(agrupados.map((t) => t && t.color)),
            `Alerta Múltiple (${agrupados.length})`,
            `${criticos} alertas críticas y ${agrupados.length - criticos} rutinarias recibidas.`, true);
```

**Después:**
```js
          // v18.0.117 (UI/UX #8) — el cuerpo dice DE QUÉ son los avisos (mismo formato «• título»
          // que _agruparToasts, L14521), no solo cuántos: con «3 críticas y 1 rutinarias» a secas el
          // médico no sabía de qué se trataba ni de quién.
          _renderToast(mtrColorMasGrave(agrupados.map((t) => t && t.color)),
            `Alerta Múltiple (${agrupados.length})`,
            `${criticos} críticas · ${agrupados.length - criticos} rutinarias — `
              + agrupados.map((t) => "• " + String((t && t.title) || "")).join("  |  "), true);
```

**Verificación:** `tests/suite_42_canales_de_aviso.js` — caso nuevo «v18.0.117 (UI/UX #8): cuatro avisos de cuatro
pacientes en el mismo flush salen como Alerta Múltiple CON sus títulos» (cuatro `showToast` con `apptKey`
distintos, `await esperar(600)`, el cuerpo contiene los cuatro títulos). Mutación: volver al cuerpo viejo → rojo.
El caso `suite_15` L1432 (agrupación por paciente) no cambia. Δ !important: **0**.

---

#### F-9 (fila 12, UX-9) — Los chips sin agenda se apagan, no desaparecen

**Dónde:** `_sondearAgendaDeCadaDia` (L26416), bloque `if (!hayAgenda)` (L26436-26439); CSS nuevo junto a
`.vgl-agm-pbtn.vgl-sm` (L18174).

**Antes (L26436-26439):**
```js
        if (!hayAgenda) {
          const btn = botonesPorIso.get(item.iso);
          if (btn && !btn.classList.contains("active")) btn.remove();
        }
```

**Después:**
```js
        if (!hayAgenda) {
          const btn = botonesPorIso.get(item.iso);
          // v18.0.117 (UI/UX #9) — sin agenda ese día el chip NO desaparece bajo el cursor (los
          // vecinos se corrían y el clic caía en otro día): se apaga, tachado, y dice por qué.
          if (btn && !btn.classList.contains("active")) {
            btn.disabled = true;
            btn.classList.add("vgl-agm-pbtn-sinagenda");
            btn.title = "Sin agenda del servicio ese día";
            btn.setAttribute("aria-disabled", "true");
          }
        }
```
```css
      /* v18.0.117 (UI/UX #9) — chip de dia sin agenda: apagado en el sitio, sin saltos de layout.
         Especificidad 1,1,0: no compite con .vgl-agm-pbtn:hover (0,2,0) ni con .active (0,2,0). */
      #vgl-day-chips .vgl-agm-pbtn-sinagenda{opacity:.45;text-decoration:line-through;cursor:not-allowed;transform:none}
```

**Verificación:** `suite_15` — caso nuevo «v18.0.117 (UI/UX #9): un día sin agenda queda deshabilitado y tachado,
no desaparece» (mock `BuscarCitasDisponibles` que devuelve `agendas: []` para una fecha del rango; tras
`esperar(120)` el chip sigue en `#vgl-day-chips` con `disabled === true`). Mutación: volver a `btn.remove()` →
rojo. suite_25 Regla A: sin colisión (id + clase). Δ !important: **0** (sin declaración de color: el chip conserva
`.vgl-agm-pbtn{color:var(--fg) !important}`).

---

#### F-10 (fila 13, UX-10) — «Siguiente» del paso 2 explica por qué está apagado

**Dónde:** `cargarHoras` (L25704): rama sin preselección (L26188-26194) y las dos que habilitan (L26166-26168,
L26181-26183). `step2Next` = L25540.

**Antes (L26188-26194):**
```js
      } else {
        // v17.6.13 — sin sugerencia, el botón explica por qué sigue apagado en vez de
        // dejar un "Sí, Crear Cita" muerto: la hora se elige, nunca viene puesta.
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Elija un horario para continuar";
        if (step2Next) step2Next.disabled = true;
      }
```

**Después:**
```js
      } else {
        // v17.6.13 — sin sugerencia, el botón explica por qué sigue apagado en vez de
        // dejar un "Sí, Crear Cita" muerto: la hora se elige, nunca viene puesta.
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Elija un horario para continuar";
        // v18.0.117 (UI/UX #10) — la explicación vivía en el botón del paso 3 (oculto desde el
        // paso 2): el «Siguiente» del paso 2 también la dice, y recupera su rótulo al elegir turno.
        if (step2Next) { step2Next.disabled = true; step2Next.textContent = "Elija un horario para continuar"; step2Next.title = "Elija una hora en la lista de arriba"; }
      }
```
```js
      // L26166-26168 (clic en un turno) y L26181-26183 (preselección ⭐): en los dos sitios
          confirmBtn.disabled = false;
          confirmBtn.textContent = `✓ Sí, Crear Cita en ${selectedEspName} (${horaTxt})`;
          if (step2Next) { step2Next.disabled = false; step2Next.textContent = "Siguiente: Confirmación ➔"; step2Next.title = ""; }   // v18.0.117 (UI/UX #10)
```

**Verificación:** ampliar `suite_15` caso «v17.6.13: sin sugerencia clínica, NINGÚN turno nace activo y el botón
explica por qué» (L4486-4496) con `t.cierto(step2Next.textContent.includes("Elija un horario"))`, y el caso
L4498 (con ⭐) con `step2Next.textContent === "Siguiente: Confirmación ➔"`. Mutación: quitar el `textContent` de
la rama vacía → rojo. Δ !important: **0**.

---

#### F-11 (fila 14, UX-11) — El reconciliador pregunta con los rótulos de cada pregunta

**Dónde:** `mtrPreguntaFueraMeta` (L5788-5796), `mtrPreguntaAdecuacionEje` (L5942-5952),
`mtrPreguntaAdherenciaEje` (L5955-5967); `_vglModalConfirmarDatos` botones (L24895-24896) y título (L24906).

**Antes (L24894-24897 y L24906):**
```js
            <div class="vgl-conf-btns">
              <button class="vgl-agm-btn pri" id="vgl-conf-si-${escapeHtml(d.clave)}">Sí tiene</button>
              <button class="vgl-agm-btn sec" id="vgl-conf-no-${escapeHtml(d.clave)}">No tiene</button>
              <span class="vgl-conf-hecho" id="vgl-conf-ok-${escapeHtml(d.clave)}"></span>
…
              <div class="vgl-agm-title">🔎 Las fuentes no coinciden</div>
```

**Después (preguntas):**
```js
      // mtrPreguntaFueraMeta (L5788): dentro del objeto devuelto
      etiqueta: "¿Repetir antes los exámenes fuera de meta de este paciente?",
      rotuloSi: "Sí, repetirlos antes", rotuloNo: "No, en su vigencia normal",   // v18.0.117 (UI/UX #11)
      // mtrPreguntaAdecuacionEje (L5942)
      etiqueta: cfg.preguntaAdecuado,
      rotuloSi: "Sí, es adecuado", rotuloNo: "No, hay que ajustarlo",             // v18.0.117 (UI/UX #11)
      // mtrPreguntaAdherenciaEje (L5955)
      etiqueta: cfg.preguntaAdherencia,
      rotuloSi: "Sí lo toma", rotuloNo: "No lo toma",                              // v18.0.117 (UI/UX #11)
```

**Después (modal):**
```js
      // v18.0.117 (UI/UX #11) — «Las fuentes no coinciden» solo cuando hay fuentes a favor Y en
      // contra de un dato del paciente; si solo hay preguntas de la escalera, el título lo dice.
      // Los botones toman el rótulo de cada pregunta; los factores de riesgo conservan «Sí/No tiene».
      const _hayContradiccion = discrepancias.some((d) => !d.rotuloSi && (d.afirman || []).length > 0 && (d.niegan || []).length > 0);
      const _titulo = _hayContradiccion ? "🔎 Las fuentes no coinciden" : "🔎 Antes de calcular, unas preguntas";
      const filas = discrepancias.map((d) => {
        return `
          …
            <div class="vgl-conf-btns">
              <button class="vgl-agm-btn pri" id="vgl-conf-si-${escapeHtml(d.clave)}">${escapeHtml(d.rotuloSi || "Sí tiene")}</button>
              <button class="vgl-agm-btn sec" id="vgl-conf-no-${escapeHtml(d.clave)}">${escapeHtml(d.rotuloNo || "No tiene")}</button>
          …
              <div class="vgl-agm-title">${_titulo}</div>
```

**Verificación:** `tests/suite_63_tablero_riesgo.js` — el caso L509 («Sí tiene» existe) sigue verde (pregunta de
factor sin `rotuloSi`); caso nuevo «v18.0.117 (UI/UX #11): la pregunta de adherencia sale con «Sí lo toma / No lo
toma» y el título no habla de fuentes» (`mtrPreguntaAdherenciaEje("ldl")` → `rotuloSi`; modal con solo esa
pregunta → título contiene «unas preguntas»). Mutación: quitar `d.rotuloSi ||` → rojo. Δ !important: **0**.

---

#### F-12 (fila 17, UX-14) — Ordenar: cerrar espera a que termine el lote

**Dónde:** `openOrdenamientoModal` (L28193): `closeMod` (L28214-28221); clic de «Generar» tras `_soltarOrd`
(L28567) y `confirmBtn.disabled = true` (L28577). `xBtn`/`cancelBtn` (L28507-28508) y `_ordGenerandoDocs` (L28192)
están en el ámbito; Escape pasa por `closeMod` vía `_activarAccesibilidadModal` (L28540).

**Antes (L28214-28221):**
```js
    const closeMod = () => {
      cerrado = true;
      try { if (!_fnCompletado) uxTrack("fn.ordenar.abandon"); } catch (e) {}
      xBtn?.removeEventListener("click", closeMod);
      cancelBtn?.removeEventListener("click", closeMod);
      modal.innerHTML = "";
      modal.remove();
    };
```

**Después:**
```js
    const closeMod = () => {
      // v18.0.117 (UI/UX #14) — con el lote en vuelo («Generando N de M») cerrar perdía los botones
      // de imprimir y el correo de las órdenes YA creadas (las marcas sí se guardan, v18.0.63).
      // Mientras _ordGenerandoDocs tenga esta cédula, ✕, «Cancelar» y Escape esperan (2,5-4 s/orden).
      if (_ordGenerandoDocs.has(_agmClaveDoc(apt.doc_id))) {
        try { uxTrack("ordenes.cerrar.en_vuelo"); } catch (e) {}
        return;
      }
      cerrado = true;
      try { if (!_fnCompletado) uxTrack("fn.ordenar.abandon"); } catch (e) {}
      xBtn?.removeEventListener("click", closeMod);
      cancelBtn?.removeEventListener("click", closeMod);
      modal.innerHTML = "";
      modal.remove();
    };
```

**Antes (L28565-28567):**
```js
      _ordGenerandoDocs.add(_kOrd);
      marcarEnVuelo("orden", apt.doc_id, {});
      const _soltarOrd = () => { _ordGenerandoDocs.delete(_kOrd); soltarEnVuelo("orden", apt.doc_id); };
```

**Después:**
```js
      _ordGenerandoDocs.add(_kOrd);
      marcarEnVuelo("orden", apt.doc_id, {});
      // v18.0.117 (UI/UX #14) — los dos cierres se apagan A LA VISTA mientras dure el lote y se
      // reactivan en el mismo sitio donde se suelta el candado (éxito, fallo o paciente no hallado).
      const _bloquearCierre = (on) => { [xBtn, cancelBtn].forEach((b) => { if (!b) return; b.disabled = !!on; b.title = on ? "Espere: se están generando las órdenes" : ""; }); };
      const _soltarOrd = () => { _ordGenerandoDocs.delete(_kOrd); soltarEnVuelo("orden", apt.doc_id); _bloquearCierre(false); };
      _bloquearCierre(true);
```

**Verificación:** `tests/suite_33_robustez_concurrencia_red.js` — caso nuevo «v18.0.117 (UI/UX #14): durante el
lote de Ordenar ✕ y Cancelar quedan deshabilitados y Escape no cierra; al terminar se reactivan» (fetch de
`CrearOrden` con `esperar(50)`; en medio, `xBtn.disabled === true` y `closeMod()` deja `modal.isConnected`;
después, `false`). Mutación: quitar la guarda de `closeMod` → rojo. Δ !important: **0**.

---

#### F-13 (filas 4, 5, 6, 48 · UI-1, UI-2, UI-3, UI-22) — Presupuesto de esquinas

**Dónde:** token nuevo en AMBAS listas (junto a `--z-toast`, L16057 y L16123; Regla D exige declaración);
`#vgl-toasts` (L17585-17591); `#vgl-postcita-panel` (L18366-18370); `.vgl-sp-toast` (L16240, solo `bottom`/`right`);
`#vgl-deshacer-llenado` (L18000-18006); `#vgl-min-bar` (L17852-17858); `setWinState` (L15690-15694). Todos los
ids están en las dos listas de tokens (verificado en L15998/L16090), así que `var(--vgl-col-libre)` resuelve.

**Antes (L17585-17591, L18366-18370, L17852-17853, L18000-18001, `.vgl-sp-toast` recortado):**
```css
      #vgl-toasts{
        position:fixed;top:16px;right:16px;z-index:2147483646;
        display:flex;flex-direction:column;gap:10px;
        max-width:390px;
        font-family:var(--font-stack);
        pointer-events:none
      }
      #vgl-postcita-panel{
        position:fixed;bottom:18px;right:18px;z-index:2147483646;
        font-family:var(--font-stack);
        animation:vglToastIn .34s var(--spring)
      }
      #vgl-min-bar{
        position:fixed;left:14px;bottom:14px;
      #vgl-deshacer-llenado{
        position:fixed;right:22px;bottom:22px;
      .vgl-sp-toast{position:fixed;bottom:24px;right:24px;z-index:2147483647; …resto igual… }
```

**Después:**
```css
        /* en las DOS listas de tokens, en la linea de --z-toast (L16057 y L16123) */
        --vgl-col-libre:min(728px,calc(100vw - 406px));   /* 22 + 690 + 16: la columna libre a la izquierda del panel */

      /* v18.0.117 (UI/UX UI#1-3, UI#22) — PRESUPUESTO DE ESQUINAS: solo el panel vive abajo a la
         derecha. Toasts, post-cita, HUD del piloto y Deshacer van a la columna libre a su izquierda,
         a alturas escalonadas; cuando el panel esta plegado (body sin .vgl-panel-visible) vuelven a
         su esquina de siempre. Medido: solapes 384x185, 336x160, 334x70, 176x38 y 142x30 px -> 0. */
      #vgl-toasts{
        position:fixed;top:16px;right:var(--vgl-col-libre);z-index:var(--z-toast);
        display:flex;flex-direction:column;gap:10px;
        max-width:390px;
        font-family:var(--font-stack);
        pointer-events:none
      }
      #vgl-postcita-panel{
        position:fixed;bottom:18px;right:var(--vgl-col-libre);z-index:calc(var(--z-alerta) - 1);
        font-family:var(--font-stack);
        animation:vglToastIn .34s var(--spring)
      }
      #vgl-min-bar{
        position:fixed;left:164px;bottom:14px;
      #vgl-deshacer-llenado{
        position:fixed;right:var(--vgl-col-libre);bottom:22px;
      .vgl-sp-toast{position:fixed;bottom:200px;right:var(--vgl-col-libre);z-index:2147483647; …resto igual… }
      body:not(.vgl-panel-visible) #vgl-toasts{right:16px}
      body:not(.vgl-panel-visible) #vgl-postcita-panel,body:not(.vgl-panel-visible) #vgl-deshacer-llenado{right:22px}
      body:not(.vgl-panel-visible) .vgl-sp-toast{right:24px;bottom:24px}
```
```js
  // setWinState (L15693), tras la linea que fija el display del panel
    el.root.style.display = (s === "dock" || s === "hidden") ? "none" : "flex";
    // v18.0.117 (UI/UX UI#1-3) — el cuerpo sabe si el panel ocupa la esquina inferior derecha:
    // con el panel plegado (min), en dock u oculto, los flotantes vuelven a su esquina.
    try { document.body.classList.toggle("vgl-panel-visible", !(s === "dock" || s === "hidden" || s === "min")); } catch (e) {}
```
Notas: `#vgl-postcita-panel` pasa de `2147483646` a `--z-alerta − 1` (2147483599): **sigue por encima de los
modales de flujo** (hoy se muestra mientras Agendar aún está abierto 2,6 s) y **por debajo de las alertas y los
toasts**, que es lo que D6 exige — el borrador de la fase UI lo bajaba a `--z-panel + 1`, lo que lo habría
escondido bajo el velo de Agendar durante esos 2,6 s. Regla J: `z-index:var(--z-panel)` sigue en 2 sitios y
`z-index:var(--z-alerta)` en 4 (el `calc(...)` no casa con sus regex); el literal `2147483647` sigue siendo 1
(`.vgl-sp-toast`).

**Verificación:** Chromium — `variantes.js` (sección colisiones) a 1366×768 y 1920×1080: `#vgl-root∩#vgl-toasts`,
`#vgl-root∩#vgl-postcita-panel`, `#vgl-postcita-panel∩#vgl-sp`, `#vgl-root∩#vgl-deshacer-llenado` y
`#vgl-min-bar∩#vgl-dock` = 0 px²; con `setWinState("dock")` los toasts vuelven a `right:16px`. suite_25: Regla D
(token declarado en las dos listas), Regla F (paridad), Regla J (conteos intactos). Δ !important: **0**.

---

#### F-14 (fila 20, UI-4) — El vidrio del panel un punto más opaco

**Dónde:** lista oscura de tokens, L16001.

**Antes (L16001):**
```css
        --bg:rgba(7,10,16,.88);
```

**Después:**
```css
        /* v18.0.117 (UI/UX UI#4) — el vidrio se calibro «sobre OLED» y vive sobre un Everest
           blanco (fondo efectivo medido #3c414a-#4d3b3e): a .94 los acentos pastel vuelven a AA */
        --bg:rgba(7,10,16,.94);
```

**Verificación:** `render.js` (panel oscuro, 80 nodos): fallas AA 7 → 1 (queda «Cargar prevención», que cierra
F-16). Regla F: el regex `--bg:rgba\([^)]+\);` sigue casando. Captura de referencia
`propuesta_panel_oscuro_alpha94_1366x768.png`. Δ !important: **0**.

---

#### F-15 (fila 21, UI-5) — Acentos claros un paso más oscuros; tintes al 10 %

**Dónde:** tokens claros L16097-16098 (y sus `--rgb-*` en la misma lista); reglas `.light .vgl-cd` L17234 y
L17236; `render()` L31355 (`badgeRgba`). `.vgl-adh` (L17237-17238) NO se toca: su base ya lleva `background` con
la marca de prioridad y sobreescribirla en claro costaría +1 sin fallo medida que lo justifique.

**Antes (L16097-16098; L17234/L17236; L31355):**
```css
        --c-rojo:#991b1b;--c-morado:#0e7490;--c-ambar:#92400e;
        --c-verde:#065f46;--c-azul:#6d28d9;--c-recordatorio:#115e59;
      #vgl-root.light .vgl-cd.warn{color:var(--c-morado) !important}
      #vgl-root.light .vgl-cd.late{color:var(--c-ambar) !important}
```
```js
            <span class="vgl-badge vgl-badge-t1" style="background:${badgeRgba(".16")};color:${badgeCol} !important;box-shadow:inset 0 0 0 1px ${badgeRgba(".32")}">${escapeHtml(a.estado)}</span>
```

**Después:**
```css
        /* v18.0.117 (UI/UX UI#5) — cyan-800 / violet-800 / emerald-900: sobre sus tintes al
           16-30 % los antiguos daban 3,4-4,4:1 en «Generar», «Siguiente», «en 12 min», «+1 mas» */
        --c-rojo:#991b1b;--c-morado:#155e75;--c-ambar:#92400e;
        --c-verde:#064e3b;--c-azul:#5b21b6;--c-recordatorio:#115e59;
        /* y en la misma lista, sus --rgb-*: */
        --rgb-morado:21,94,117;--rgb-azul:91,33,182;--rgb-verde:6,78,59;
      #vgl-root.light .vgl-cd.warn{color:var(--c-morado) !important;background:rgba(var(--rgb-morado),.10)}
      #vgl-root.light .vgl-cd.late{color:var(--c-ambar) !important;background:rgba(var(--rgb-ambar),.10)}
```
```js
            // v18.0.117 (UI/UX UI#5) — tinte del badge al 10 % en claro (el .16 dejaba «Confirmada» en 3,48:1)
            <span class="vgl-badge vgl-badge-t1" style="background:${badgeRgba(isLight() ? ".10" : ".16")};color:${badgeCol} !important;box-shadow:inset 0 0 0 1px ${badgeRgba(isLight() ? ".26" : ".32")}">${escapeHtml(a.estado)}</span>
```

**Verificación:** `render.js` tema claro: panel 9 → 5 (con los tintes, → 0 en cuenta regresiva y badge), Agendar
1 → 0, IA 2 → 0, Labs 2 → 1 (la restante es el texto de carga con pulso de opacidad, fuera de alcance). suite_25
Regla F (cada clave de `COLORS` conserva `--c-*` y `--rgb-*`), Regla O (`--fg3` no cambia), Regla B (el badge ya
pintaba `background` en línea; solo cambia el alfa). Captura de referencia
`propuesta_panel_claro_tokens_1366x768.png`. Δ !important: **0**.

---

#### F-16 (filas 22, 23 · UI-6, UI-7) — Texto sobre acento: nunca un literal

**Dónde:** `VGL_UX_CSS` L15862-15863 (stepper), L15831-15834 (`.vgl-tip-btn`), L15925 (`.vgl-btn-undo:hover`).

**Antes:**
```css
        .vgl-stepper-step.active .vgl-step-num{background:var(--c-azul);color:#020617 !important}
        .vgl-stepper-step.completed .vgl-step-num{background:var(--c-verde);color:#020617 !important}
        .vgl-tip-btn:hover,.vgl-tip-btn:focus-visible{
          background:var(--c-azul) !important;color:#fff !important;outline:none
        }
        .vgl-tip-btn[aria-expanded="true"]{background:var(--c-azul) !important;color:#fff !important}
        .vgl-btn-undo:hover{background:var(--c-rojo);color:#fff !important}
```

**Después:**
```css
        /* v18.0.117 (UI/UX UI#6, UI#7) — texto sobre acento con --bg-solid: oscuro sobre pastel
           en tema oscuro, claro sobre profundo en tema claro. Medido 7,4:1 / 7,1:1 sobre --c-azul */
        .vgl-stepper-step.active .vgl-step-num{background:var(--c-azul);color:var(--bg-solid) !important}
        .vgl-stepper-step.completed .vgl-step-num{background:var(--c-verde);color:var(--bg-solid) !important}
        .vgl-tip-btn:hover,.vgl-tip-btn:focus-visible{
          background:var(--c-azul) !important;color:var(--bg-solid) !important;outline:none
        }
        .vgl-tip-btn[aria-expanded="true"]{background:var(--c-azul) !important;color:var(--bg-solid) !important}
        .vgl-btn-undo:hover{background:var(--c-rojo);color:var(--bg-solid) !important}
```

**Verificación:** `variantes.js` (stepper claro «1» y «2»: 2,84/2,63 → ≥7:1; `.vgl-tip-btn` oscuro 2,72 → ≥7:1);
`tools/verificar_color_chromium.js` con el adversario canónico sobre `#vgl-agendar-modal` (tema claro) — el número
del paso conserva `--bg-solid`. Censo de la Regla G sin cambio (mismas declaraciones, distinto valor).
Δ !important: **0**.

---

#### F-17 (fila 24, UI-8) — Sin opacidad apilada sobre texto muteado (+ 3 tokens de escala)

**Dónde:** tokens de escala en AMBAS listas (L16047 y L16120, **después** de `--t-hero:22px;` para que las Reglas
H e I sigan casando su secuencia exacta); L18618, L15944, L15890-15891, L17249, L16563-16565.

**Antes:**
```css
        --t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;
      #vgl-labs-modal .vgl-labs-date small{display:block;font-size:10px;color:var(--fg3) !important;opacity:.72;font-variant-numeric:tabular-nums}
        .vgl-bento-pie{font-size:11px;opacity:.75;color:var(--fg3) !important}
        .vgl-prod .vgl-prod-cap,
        .vgl-prod-cap{font-size:10px;font-weight:700;opacity:.7;color:var(--fg3) !important}
      .vgl-chip-mas { opacity:.75; cursor:help; }
      #vgl-title small{
        opacity:.60;font-weight:500;margin-left:6px;font-size:var(--t-micro) /* Mínimo 12px */
      }
```

**Después:**
```css
        /* v18.0.117 (UI/UX UI#8, primer paso de UI#20) — tres tokens mas, DESPUES de --t-hero */
        --t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;--t-nano:10px;--t-mini:11px;--t-small:13px;
      /* v18.0.117 (UI/UX UI#8) — el token --fg3 ya es «muteado»: apilarle opacidad dejaba el ano del
         resultado en 3,30:1 (claro) y el pie del bento en 3,51:1. Sin opacity; tamaño por token. */
      #vgl-labs-modal .vgl-labs-date small{display:block;font-size:var(--t-nano);color:var(--fg3) !important;font-variant-numeric:tabular-nums}
        .vgl-bento-pie{font-size:var(--t-mini);color:var(--fg3) !important}
        .vgl-prod .vgl-prod-cap,
        .vgl-prod-cap{font-size:var(--t-nano);font-weight:700;color:var(--fg3) !important}
      .vgl-chip-mas { cursor:help; }
      #vgl-title small{
        opacity:.8;font-weight:500;margin-left:6px;font-size:var(--t-micro)
      }
```

**Verificación:** `render.js` claro: `.vgl-labs-date small` 3,30 → ≥5:1; `.vgl-chip-mas` 2,69 → ≥4,5:1;
`.vgl-bento-pie` 3,51 → ≥4,5:1. suite_25: Regla D (los tres tokens quedan declarados), Regla H/I (secuencias
intactas, 2 usos cada una), Regla G (`var(--t-micro…)` ≥ 48 se mantiene). Δ !important: **0**.

---

#### F-18 (fila 25, UI-9) — Interruptor visible en tema claro

**Dónde:** `.vgl-sw i` / `.vgl-sw i:after` (L17424-17433); regla nueva justo después (especificidad 1,2,1 > 0,1,1:
sin empate para la Regla A).

**Antes (L17424-17433):**
```css
      .vgl-sw i{
        position:absolute;inset:0;border-radius:var(--r-pill);
        background:var(--bg4);transition:background .2s var(--ease-out),box-shadow .2s;
        box-shadow:inset 0 1px 3px rgba(0,0,0,.22)
      }
      .vgl-sw i:after{
        content:"";position:absolute;top:2px;left:2px;
        width:22px;height:22px;border-radius:50%;
        background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);
        transition:transform .24s var(--spring)
      }
```

**Después:**
```css
      .vgl-sw i{
        position:absolute;inset:0;border-radius:var(--r-pill);
        background:var(--bg4);transition:background .2s var(--ease-out),box-shadow .2s;
        box-shadow:inset 0 1px 3px rgba(0,0,0,.22)
      }
      .vgl-sw i:after{
        content:"";position:absolute;top:2px;left:2px;
        width:22px;height:22px;border-radius:50%;
        background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35),0 0 0 1px rgba(15,23,42,.25);
        transition:transform .24s var(--spring)
      }
      /* v18.0.117 (UI/UX UI#9) — en claro el riel apagado era 1,25:1 y la perilla 1,32:1
         (WCAG 1.4.11 pide 3:1 en componentes): riel #7f899b + anillo en la perilla -> >=3:1 */
      #vgl-root.light .vgl-sw i{background:#7f899b;box-shadow:inset 0 0 0 1px rgba(15,23,42,.35)}
```

**Verificación:** `variantes.js` (riel/perilla en claro ≥ 3:1; en oscuro la perilla sigue 10:1). suite_25 Regla A
sin empate; Regla P no aplica (sin `color`). Δ !important: **0**.

---

#### F-19 (fila 26, UI-10) — «Alto contraste» que contraste

**Dónde:** tras `#vgl-root.vgl-hc::before{display:none !important}` (L16597). Solo tokens (no toca `--t-*`,
Regla H); Regla O lee el bloque base, no este; los valores nuevos son más contrastados que los base, así que
`--fg > --fg2 > --fg3` se conserva.

**Antes (L16593-16597):**
```css
      #vgl-root.vgl-hc,#vgl-dock.vgl-hc,#vgl-acciones-dock.vgl-hc,#vgl-toasts.vgl-hc,#vgl-pym-banner.vgl-hc{
        background:var(--bg-solid) !important;
        -webkit-backdrop-filter:none !important;backdrop-filter:none !important;
      }
      #vgl-root.vgl-hc::before{display:none !important}
```

**Después:**
```css
      #vgl-root.vgl-hc,#vgl-dock.vgl-hc,#vgl-acciones-dock.vgl-hc,#vgl-toasts.vgl-hc,#vgl-pym-banner.vgl-hc{
        background:var(--bg-solid) !important;
        -webkit-backdrop-filter:none !important;backdrop-filter:none !important;
      }
      #vgl-root.vgl-hc::before{display:none !important}
      /* v18.0.117 (UI/UX UI#10) — el boton prometia «Alto contraste» y en claro dejaba las mismas
         6 fallas: ahora mueve los tokens secundarios (texto, bordes, lineas) en los dos temas */
      #vgl-root.vgl-hc:not(.light),#vgl-dock.vgl-hc:not(.light),#vgl-acciones-dock.vgl-hc:not(.light),#vgl-toasts.vgl-hc:not(.light){
        --fg2:#e5ebf3;--fg3:#b8c2d0;--edge:rgba(255,255,255,.34);--line:rgba(255,255,255,.18);--bg2:rgba(255,255,255,.07);--bg3:rgba(255,255,255,.12)
      }
      #vgl-root.vgl-hc.light,#vgl-dock.vgl-hc.light,#vgl-acciones-dock.vgl-hc.light,#vgl-toasts.vgl-hc.light{
        --fg2:#111827;--fg3:#334155;--edge:rgba(15,23,42,.40);--line:rgba(15,23,42,.20)
      }
```

**Verificación:** `render.js` (`panel_hc_claro`): fallas 6 → 0; `panel_hc` oscuro 1 → 0. suite_25 Regla O intacta
(lee la lista base). Captura `propuesta_panel_hc_tokens_1366x768.png`. Δ !important: **0**.

---

#### F-20 (fila 27, UI-11) — `prefers-reduced-motion` completo

**Dónde:** lista de L16217-16222 (misma regla, mismos dos `!important` ya contados). Los 13 ids/clases existen
(verificado con grep: `#vgl-ia-modal` ×22, `#vgl-panel-modal` ×109, `#vgl-ficha-modal` ×25, `#vgl-tablero-modal`
×42, `#vgl-confirma-modal` ×14, `#vgl-llenar-modal` ×16, `#vgl-riesgo-modal` ×28, `#vgl-min-bar`, `#vgl-acomp-burbuja`
×9, `#vgl-tip-pop` ×11, `#vgl-examen-normalidad` ×7, `.vgl-ia-inj` ×3, `#vgl-deshacer-llenado` ×7).

**Antes (L16216-16226):**
```css
      @media (prefers-reduced-motion:reduce){
        #vgl-root,#vgl-root *,#vgl-root *::before,#vgl-root *::after,
        #vgl-dock,#vgl-lab-injector,#vgl-examen-guardar,#vgl-examen-aplicar,#vgl-sp,#vgl-dock *,#vgl-acciones-dock,#vgl-acciones-dock *,#vgl-pym-banner,#vgl-pym-banner *,#vgl-toasts *,
        #vgl-modal,#vgl-modal *,#vgl-pym-modal,#vgl-pym-modal *,
        #vgl-pes-modal,#vgl-pes-modal *,#vgl-agendar-modal,#vgl-agendar-modal *,
        #vgl-ordenar-modal,#vgl-ordenar-modal *,#vgl-labs-modal,#vgl-labs-modal *,
        #vgl-labsv-modal,#vgl-labsv-modal *,#vgl-postcita-panel,#vgl-postcita-panel *,
        #vgl-cw-examenes,#vgl-cw-examenes *,#vgl-cw-farmaco,#vgl-cw-farmaco *,#vgl-cw-ordenar-btn{
          animation:none !important;transition:none !important;
        }
      }
```

**Después:**
```css
      @media (prefers-reduced-motion:reduce){
        #vgl-root,#vgl-root *,#vgl-root *::before,#vgl-root *::after,
        #vgl-dock,#vgl-lab-injector,#vgl-examen-guardar,#vgl-examen-aplicar,#vgl-sp,#vgl-dock *,#vgl-acciones-dock,#vgl-acciones-dock *,#vgl-pym-banner,#vgl-pym-banner *,#vgl-toasts *,
        #vgl-modal,#vgl-modal *,#vgl-pym-modal,#vgl-pym-modal *,
        #vgl-pes-modal,#vgl-pes-modal *,#vgl-agendar-modal,#vgl-agendar-modal *,
        #vgl-ordenar-modal,#vgl-ordenar-modal *,#vgl-labs-modal,#vgl-labs-modal *,
        #vgl-labsv-modal,#vgl-labsv-modal *,#vgl-postcita-panel,#vgl-postcita-panel *,
        #vgl-cw-examenes,#vgl-cw-examenes *,#vgl-cw-farmaco,#vgl-cw-farmaco *,#vgl-cw-ordenar-btn,
        /* v18.0.117 (UI/UX UI#11) — los modales de flujo de v15.6.0 y los flotantes que faltaban */
        #vgl-ia-modal,#vgl-ia-modal *,#vgl-panel-modal,#vgl-panel-modal *,#vgl-ficha-modal,#vgl-ficha-modal *,
        #vgl-tablero-modal,#vgl-tablero-modal *,#vgl-confirma-modal,#vgl-confirma-modal *,#vgl-llenar-modal,#vgl-llenar-modal *,
        #vgl-riesgo-modal,#vgl-riesgo-modal *,#vgl-min-bar,#vgl-min-bar *,#vgl-acomp-burbuja,#vgl-acomp-burbuja *,
        #vgl-tip-pop,#vgl-examen-normalidad,.vgl-ia-inj,#vgl-deshacer-llenado{
          animation:none !important;transition:none !important;
        }
      }
```

**Verificación:** `render.js` sección 3 (`reducedMotion:"reduce"`): `animaciones: []` en `#vgl-panel-modal` y
`#vgl-ia-modal` (hoy `vglSpringIn .3s` + 14 transiciones). suite_25 censo: los dos `!important` son los mismos
(la regla no se duplica). Δ !important: **0**.

---

#### F-21 (filas 28, 40 · UI-12, UI-13) — Foco de teclado en semáforos y dock; objetivos alcanzables

**Dónde:** `.vgl-tl` (L16532-16545): borrar la línea `outline:none !important;` (L16542); regla nueva sin marca
debajo; sumar selectores a la lista `:focus-visible` (L16510-16516); `#vgl-tls` `gap:8px` → `12px` (L16531). Regla
B: ningún JS escribe `.style.outline` en `.vgl-tl` (grep). Todas las clases añadidas existen (grep: `.vgl-dock-btn`
×9, `.vgl-dock-toggle` ×4, `.vgl-chooser-opt` ×4, `.vgl-panel-tab` ×4, `.vgl-paq-chip` ×2, `.vgl-labs-pdf` ×5,
`.vgl-min-abrir` ×2, `.vgl-min-x` ×2, `.vgl-type-card` ×7, `.vgl-labs-uro-btn` ×6, `.vgl-agm-lnk` ×2,
`.vgl-acomp-nomas` ×1).

**Antes (L16510-16516, L16531, L16542):**
```css
      .vgl-btn:focus-visible,.vgl-fchip:focus-visible,.vgl-tl:focus-visible,
      .vgl-btn-action:focus-visible,.vgl-agm-btn:focus-visible,.vgl-agm-pbtn:focus-visible,
      .vgl-agm-sbtn:focus-visible,.vgl-agm-input:focus-visible,.vgl-agm-close:focus-visible,
      .vgl-sb-btn:focus-visible,.vgl-dock:focus-visible,#vgl-dock:focus-visible,
      .vgl-pymb-toggle:focus-visible,.vgl-postcita-x:focus-visible{
        outline:2px solid var(--c-azul);outline-offset:2px;box-shadow:0 0 0 4px rgba(var(--rgb-azul),.25)
      }
      #vgl-tls{display:flex !important;align-items:center !important;gap:8px !important;margin-right:8px !important;flex-shrink:0 !important}
        outline:none !important;
```

**Después:**
```css
      /* v18.0.117 (UI/UX UI#12, UI#13) — el anillo llega a los semaforos (antes lo apagaba una
         regla con marca de prioridad en .vgl-tl: medido con Tab real «outline: none 0px») y a los
         botones del dock, el menu de eleccion, las pestañas del Panel y los demas sin anillo propio */
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
      /* UI#12: 12 px de separacion -> centros a 24 px, excepcion de separacion de WCAG 2.5.8 */
      #vgl-tls{display:flex !important;align-items:center !important;gap:12px !important;margin-right:8px !important;flex-shrink:0 !important}
      /* en .vgl-tl se BORRA la linea «outline:none» con marca de prioridad; solo el clic con raton
         apaga el anillo: */
      .vgl-tl:focus:not(:focus-visible){outline:none}
```

**Verificación:** `variantes.js` (`foco_tl` con Tab real → `outline: solid 2px`; `.vgl-dock-btn` deja de caer al
`auto 1px` del navegador). `tests/suite_35_interfaz_accesibilidad_medica.js` R6.3 (L69-71) sigue verde.
**suite_25 Regla G, L687: `importantTotal === 656` → `655`**, anotando en el mensaje y en el comentario de arriba:
«v18.0.117 (UI/UX UI#12) — 656 -> 655: `.vgl-tl` deja de apagar el anillo de foco con la marca de prioridad».
Mutación: dejar la línea `outline:none` con marca → el censo da 656 (rojo) y `foco_tl` vuelve a `none`.
Δ !important: **−1**.

---

#### F-22 (fila 29, UI-14) — Un solo vidrio en el panel

**Dónde:** `#vgl-sidebar` (L16942-16952): borrar las dos líneas de `backdrop-filter` (L16949-16950). El
`#vgl-root.perf #vgl-sidebar{background:var(--bg-solid)}` (L16209) queda igual.

**Antes (L16942-16952):**
```css
      #vgl-sidebar{
        width:208px;flex-shrink:0; /* [S+] 195->208: más aire lateral, sin invadir el área principal */
        display:flex;flex-direction:column;gap:0;
        border-right:1px solid var(--edge-side);
        background:linear-gradient(180deg,rgba(var(--rgb-azul),.05),rgba(0,0,0,0) 42%),var(--bg-sidebar);
        overflow-y:auto;overflow-x:hidden;
        padding:14px 12px 16px;
        -webkit-backdrop-filter:var(--glass);
        backdrop-filter:var(--glass);
      }
```

**Después:**
```css
      #vgl-sidebar{
        width:208px;flex-shrink:0; /* [S+] 195->208: más aire lateral, sin invadir el área principal */
        display:flex;flex-direction:column;gap:0;
        border-right:1px solid var(--edge-side);
        background:linear-gradient(180deg,rgba(var(--rgb-azul),.05),rgba(0,0,0,0) 42%),var(--bg-sidebar);
        overflow-y:auto;overflow-x:hidden;
        padding:14px 12px 16px;
        /* v18.0.117 (UI/UX UI#14) — sin desenfoque propio: apilado sobre el del panel (.88 + .70 =
           96,4 % opaco) era invisible y costaba una pasada de blur extra en cada arrastre/scroll */
      }
```

**Verificación:** `render.js` (capas `backdrop-filter` por escena: panel 2 → 1); captura `panel_oscuro_1366x768.png`
antes/después con diferencia visual nula (comparar con `tools/medir_arrastre_lejano.js` el coste de arrastre a
1366). Δ !important: **0**.

---

**Balance de los 22 fragmentos:** 12 de flujo (F-1…F-12) + 10 visuales (F-13…F-22). Δ !important neto **−1**
(656 → **655** en `suite_25` L687; el censo spliceado sigue en 134). Ningún fragmento actúa sin clic del médico,
ninguno escribe en una casilla con texto, ninguno usa `alert/confirm`, y ningún cuadro de escritura pasa a cerrar
con clic fuera. Cada uno lleva su fila para `tests/INFORME_MUTACIONES.md` (mutación → rojo → restaurar → verde).

### Lo que NO se toca y por qué

**⚖️ Decisiones del médico — pregunta cerrada (sí/no) que se le haría:**

- **Fila 15 (UX-12) Panel con dos cuadros previos.** «¿Prefiere UN solo cuadro con dos secciones ("Confirme" /
  "Complete") y una única salida "Abrir el Panel sin responder", en vez del reconciliador y luego "Faltan
  antecedentes"?» — cambia el orden que él fijó en v17.0.0 (contradicción antes que dato faltante).
- **Fila 16 (UX-13) Ordenar abre y enfoca una pestaña en blanco.** «¿Quiere que al pulsar "Generar" la pantalla se
  quede en Everest (la pestaña del PDF se abre detrás) y abrir el PDF solo desde "Imprimir orden de…"?» — v15.7.0 lo
  hizo «como Everest» por pedido suyo; el `window.open` debe seguir en el clic (bloqueo de ventanas).
- **Fila 18 (UX-15) Pendientes de este paciente, de un solo uso.** «¿Quiere una pastilla "🩺 Pendientes (N)" en el
  dock, de solo lectura, que reabra el aviso durante la jornada?» — v17.6.18 lo dejó informativo y único a
  propósito.
- **Fila 35 (UX-22) Programa preseleccionado.** «Cuando el paciente tiene VARIOS programas, ¿prefiere que el
  desplegable arranque en "— elija el programa —" y Confirmar lo exija?» — hoy toma el primero; con uno solo se
  seguiría preseleccionando.
- **Fila 38 (UX-25) "SOLO Laboratorios" sin camino de vuelta.** «¿Quiere un "↩ Atrás" en el cuadro de la toma que
  reabra Agendar en el paso 1?» — hoy son dos cuadros distintos por diseño (v14.2.0, modo libre).
- **Fila 39 (UX-26) "❤️ Ver riesgo…" encadena tres capas.** «Desde Agendar, ¿abrir el Panel sin reconciliador ni
  llenado (con la nota "abierto desde Agendar: sin preguntas previas")?» — cambia la garantía de que el Panel
  siempre pregunta antes de calcular.
- **Fila 45 (UI-19) Densidad a 1366×768.** «¿Acepta 4-5 px menos de aire en cada tarjeta para ver 4 citas en vez
  de 3 en el monitor del consultorio?» — solo espaciado (`propuesta_panel_compacto_1366x768.png`), pero es su
  pantalla de todo el día.

**Bajas que no compensan ahora (o van por otro canal):**

- **Fila 30 (UX-17)** chapa de Laboratorios: v18.0.115 ya la reescribe en éxito; el caso de fallo es una línea
  (`srcEl.textContent = "⚠ Sin respuesta del laboratorio"` en L22946) que conviene meter en el próximo toque de
  ese módulo, no en esta entrega.
- **Fila 31 (UX-18)** rótulos dobles del stepper y «Confirmar y asignar cita» de la leyenda: el rótulo del botón
  cambia por diseño en cinco estados y el diccionario de C9 (`VGL_ROTULOS`, prueba L5181) vigila los del dock, no
  este; unificarlo toca ≥6 pruebas de `suite_15` por una ganancia de lectura menor.
- **Filas 32, 33, 34, 36, 37 (UX-19, 20, 21, 23, 24)** son de una a tres líneas cada una (`await` del
  portapapeles, «Generando el borrador… (intento 2 de 7)», reprogramar los 5 min si `#vgl-postcita-smsto` tiene
  foco, «✖ Detener búsqueda» sobre `_pcCancelar`, rótulo «Abrir el Panel sin llenar» cuando `respuestas` no tiene
  ningún `true/false`): quick wins para la misma entrega si sobra tiempo, sin fragmento porque no cambian el
  comportamiento clínico.
- **Fila 41 (UI-15)** velo claro `rgba(15,23,42,.42)` y blur 10 → 4 px y **fila 42 (UI-16)** pie pegajoso sólido:
  cero riesgo, pero son estética pura; se dejan para una entrega visual con captura del médico delante.
- **Fila 43 (UI-17)** `#vgl-dot.bg` a 3 ciclos: el latido es su señal de «vigilante vivo» desde v15.8; preguntar
  antes de quitárselo.
- **Fila 44 (UI-18)** `.vgl-sp-toast` con tokens y `.light`: correcto, pero F-7 reduce cuándo se ve el HUD; medir
  primero cuánto queda en pantalla tras F-7.
- **Fila 46 (UI-20)** migración de 57 `font-size` literales: mecánica, sin riesgo clínico → prompt para Jules
  (`PROMPT_JULES_*.md`) con mutación verificada; F-17 deja declarados los tres tokens que necesita. Los tamaños de
  la tabla de laboratorios (10/10,5/11/11,5) quedan como pregunta al médico (TL2).
- **Fila 47 (UI-21)** dos SVG Lucide por `🔔`/`🔉`: HTML puro, sin impacto; se hace junto con la próxima entrega del
  sidebar.

---

## Anexo — Reproducibilidad

- **CSS real, no una copia recortada:** `tests/harness.js` → `cargar({silencioso:true})` → `buildOverlay()` (L15982)
  → `<style>` completo (269 802 caracteres con `MTR_RCV_CSS` L15713, `VGL_UX_CSS` L15821 y `MTR_CSS` L45411 ya
  spliceados), guardado en `scratchpad/uiux/css_real.css`; `css_src.txt` es el texto crudo.
- **Superficies:** cada una abierta con la misma función que en consulta (`openAgendamientoModal`,
  `openLaboratoriosModal`, `openOrdenamientoModal`, `openPanelPacienteModal`, `openPaquetesModal`,
  `mostrarPanelPostCita`, `_vglChooserModal`, `_acompMostrar`, `mtrAbrirPanelRedaccion`, `avisoUniversal`,
  `bigAlert`, inyectores) y serializada a `html_vgl-*.html` (21 archivos). Las que el DOM falso no puede montar
  (`el.list`/`el.sheet` nulos) usan la plantilla literal del código (`render()` L31174-31360, `_renderToast` L14432,
  `_vglDockRotulo` L7498, `vglMinPintarBarra`).
- **Chromium:** Playwright con `/opt/pw-browsers/chromium`, a 1366×768 y 1920×1080, sobre un Everest simulado (SPA
  clara, cabecera `#1f4e79`) con el adversario canónico de CLAUDE.md `div,span,p,b,small,label,li,td,th{color:#1f4e79
  !important}`. Contraste WCAG 2.x sobre 728 nodos con fondo compuesto (`background-color` + paradas del
  `background-image` + opacidad acumulada). `prefers-reduced-motion` emulado, Tab real para el foco, rectángulos
  de todas las superficies flotantes y sus intersecciones.
  ```
  cd /home/user/vigilante-agenda-everest
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node <scratchpad>/uiux/render.js      # 38 capturas + resultados.json
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node <scratchpad>/uiux/variantes.js   # propuestas re-medidas + colisiones (variantes.json)
  node <scratchpad>/uiux/medir_doble_cargarHoras.js                                # fila 19: peticiones al abrir Agendar
  ```
  con `<scratchpad>` = `/tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad`.
- **Capturas** (misma carpeta): `panel_{oscuro,claro,hc,hc_claro}_1366x768.png`, `panel_oscuro_1920x1080.png`,
  `agendar_{oscuro,claro}_1366x768.png`, `agendar_oscuro_1920x1080.png`, `labs_*`, `ia_*`, `pym_*`, `bigalert_*`,
  `chooser_oscuro_1366x768.png`, `paquete_oscuro_1366x768.png`, `ordenar_oscuro_1366x768.png`, `banner_*`,
  `esquina_{1366x768,1920x1080}.png`, `colisiones_{1366x768,1920x1080}.png`, `minbar_1366x768.png`,
  `burbuja_1366x768.png`, `sp_toast_claro_1366x768.png` y las cinco `propuesta_*.png`.
- **Verificación de color obligatoria antes de dar por buena cualquier regla nueva** (CLAUDE.md):
  `node tools/verificar_color_chromium.js` (y `tools/auditar_html_real_chromium.js` para el HTML real de cada
  superficie) con el CSS del árbol modificado; y `node tests/runner.js` completo (3 044 comprobaciones hoy), con la
  aserción de `suite_25` L687 ajustada a **655** al aplicar F-21.
- **Numeración:** las líneas de los informes de fase 1-2 eran de v18.0.113 (`anclas.txt` registra el desplazamiento
  +10 / +12 / +89); todas las de este documento se releyeron en v18.0.116 el 02-sep-2026.
