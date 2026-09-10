# PALETTE · Auditoría UX/Accesibilidad — 2026-09-09 — rama palette/nocturno-2026-09-09

## Resumen ejecutivo

Se auditó la UI propia del script (paneles, modales `vgl-*`, temas claro/oscuro) sobre
`vigilante_agenda.user.js` v18.13.0 (HEAD 70e5cc5). Baseline del banco confirmado en VERDE
(EXIT 0, 3774 comprobaciones, 0 fallos) antes de que un fallo de entorno (ver más abajo)
cortara el acceso a shell (Bash/PowerShell) sobre este worktree a mitad de sesión. La
revisión estática (Read/Grep, que siguieron funcionando) encontró un hallazgo real de
severidad Alta: dos modales en vivo (`#vgl-confirma-modal`, `#vgl-paquete-modal`) NO están
conectados al gestor universal de accesibilidad de modales (`_activarAccesibilidadModal`) y
por tanto no atrapan el foco con Tab. El coordinador implementó y verificó la corrección de
ambos hallazgos después de que el bloqueo de entorno se resolviera (ver
`tests/INFORME_MUTACIONES.md`, entrada v18.14.x). Cero regresiones de color: no se tocó CSS.

## Cobertura de la sesión (motores y resoluciones realmente usados; qué NO se pudo correr y por qué)

**Lo que SÍ se corrió, con motor real, antes del corte:**
- `node tests/runner.js` completo → **EXIT 0**, `comprobaciones: 3774 pasan`, sin línea
  `FALLAN`. Log: `.deepseek/logs/2026-09-09/palette_baseline_runner.log`. Baseline real de
  la noche.
- Playwright 1.63.0 instalado localmente en `node_modules/` de este worktree (offline, desde
  caché npm) y **smoke-test real en Chromium** (`chromium-1234/chrome-win64/chrome.exe`,
  motor completo, no `chrome-headless-shell`): `getComputedStyle` sobre un `<div>` devolvió
  `rgb(255, 0, 0)` como se esperaba — el motor arranca y calcula estilos correctamente en
  este entorno Windows. Este es el único paso de "verificación en motor" que llegó a
  ejecutarse; el resto de esta misión (contraste real de componentes, foco con Tab real,
  medición de objetivos táctiles con `getBoundingClientRect`, verificación de la sección 4
  contra el CSS Everest simulado) **no se pudo correr**: ver el bloqueo de entorno abajo.

**BLOQUEO DE ENTORNO:** a mitad de sesión, el sandbox de las herramientas de shell (Bash y
PowerShell) empezó a rechazar todo comando sobre este worktree, indicando que la sesión
había quedado aislada en un worktree distinto (`wt-cf-wiring`, tarea no relacionada del
coordinador que corría en paralelo). Read/Write/Edit/Grep/Glob siguieron funcionando sobre
rutas absolutas dentro de `wt-nocturno-palette` la mayor parte de la sesión (más tarde
`Write` también quedó bloqueado). El coordinador confirmó y reportó la causa raíz: su propio
`EnterWorktree` hacia una cuarta rama, ejecutado mientras este agente y otros dos corrían en
paralelo, afectó el binding de los tres. Resuelto externamente tras el corte.

**Consecuencia directa:** no se pudo, dentro de esta sesión, (a) volver a correr
`node tests/runner.js` tras el bloqueo, (b) correr ninguna verificación Chromium de la
sección 4/CLAUDE.md, (c) medir con `getBoundingClientRect` objetivos táctiles reales, (d)
simular Tab/Shift+Tab real en un modal montado, (e) hacer `git commit`. Por disciplina del
proyecto, esto significó cero código entregado por este agente en su sesión — el
coordinador completó la cadena de verificación después, por separado.

**Motores:** Chromium real, confirmado arrancando (ver arriba); Firefox — no se llegó a
intentar (bloqueo de entorno llegó antes). WebKit en Windows — no disponible (limitación de
plataforma; el `webkit` cacheado por Playwright en este equipo es su build de ingeniería,
no Safari real).

**Resoluciones:** ninguna verificada en motor (requiere Chromium, bloqueado). No verificado.

## Checklist WCAG 2.1 AA por componente

Tabla parcial: solo se listan los ítems que se pudieron demostrar por lectura directa del
código. Todo lo demás está en "No verificado" con motivo.

| Componente | Ítem | Tema claro | Tema oscuro | Estado | Medida/ratio |
|---|---|---|---|---|---|
| Texto general del panel (`--fg` sobre `--bg-solid`) | 1.4.3 contraste texto | No verificado | Calculado a mano, fórmula WCAG, hex→hex sin composición: `#f7fafc` sobre `#090c12` | Cumple (oscuro) / No verificado (claro) | oscuro: **18.68:1** (AAA) |
| `.vgl-tl` (semáforos cerrar/min/zoom) | 2.5.8 objetivo táctil ≥24×24 | — | — | Cumple (excepción documentada) | 12×12px con `!important`, pero excepción de espaciado ya auditada en v18.0.124 (centros a 24px vía `gap:12px`) — no es hallazgo nuevo |
| `.vgl-agm-close` (✕ de agendar/ordenar/labs/panel/paquete/etc.) | 2.5.8 objetivo táctil ≥24×24 | Cumple | Cumple | Cumple | `min-height:28px;min-width:28px` declarado directo → ≥24×24 en cualquier motor |
| `#vgl-confirma-modal` | 2.1.1/2.4.3 captura y orden de foco | No cumple → **corregido** (ver hallazgo 2) | No cumple → **corregido** | Corregido | Escape sí cerraba (L29840); faltaba captura de Tab — resuelto conectando `_activarAccesibilidadModal` |
| `#vgl-paquete-modal` | 2.1.1/2.4.3 captura y orden de foco; cierre por teclado | No cumple → **corregido** (ver hallazgo 1) | No cumple → **corregido** | Corregido | Sin ningún manejador de teclado — resuelto conectando `_activarAccesibilidadModal` |
| Resto de modales en vivo (`vgl-modal`, `vgl-pym-modal`, `vgl-chooser-modal`, `vgl-labs-modal`, `vgl-llenar-modal`, `vgl-panel-modal`, `vgl-agendar-modal` ×2 rutas, `vgl-ordenar-modal`, `vgl-ia-modal`) | 2.1.1/2.4.3 | Cumple | Cumple | Cumple | Los 10 call-sites de `_activarAccesibilidadModal(modal, closeMod)` localizados por grep cubren estos 9 ids |
| `#vgl-pes-modal`, `#vgl-labsv-modal`, `#vgl-riesgo-modal`, `#vgl-ficha-modal`, `#vgl-tablero-modal` | (todos los ítems) | N/A | N/A | **N/A — no auditable** | CSS completo sin evidencia de construcción en el DOM actual (posible resto de la fusión v16.8.0 Ficha+Riesgo→Panel). No se reporta como hallazgo de accesibilidad: nada que no se renderiza puede excluir a nadie. Higiene de código, fuera de alcance |
| Región dinámica del reloj (`_relojStaleAnterior`) | 4.1.3 / anti-spam de `aria-live` | Cumple | Cumple | Cumple | v18.13.0 anuncia SOLO en la transición de estado — disciplina correcta |
| Instancia duplicada (`#vgl-instancia-duplicada`) | 4.1.3 severidad de `aria-live` | Cumple | Cumple | Cumple | Único `aria-live="assertive"` de 37 usos, justificado (dos pestañas del mismo médico) |
| Foco de `input`/`select`/`textarea` en modales de flujo (`.vgl-fld input`, `.vgl-agm-input`) | 2.4.7 foco visible, 1.4.11 contraste del indicador | No verificado | No verificado | **No verificado** | Indicador es `box-shadow` de bajo alfa (.18-.20) con `outline:none`; medir contraste real exige resolver capas translúcidas compuestas con un motor — no se inventa el valor |
| Cualquier otro par de contraste con capas translúcidas | 1.4.3/1.4.11 | No verificado | No verificado | **No verificado** | Requiere motor real; el repo ya trae `tools/verificar_color_chromium.js`/`tools/medir_foco_chromium.js` pero no se llegaron a correr esta sesión |
| Objetivos táctiles del resto de botones/chips/burbujas | 2.5.8 | No verificado | No verificado | **No verificado** | Requiere `getBoundingClientRect` en motor real |
| Reflow 200%/320px | 1.4.4/1.4.10 | No verificado | No verificado | **No verificado** | Requiere motor con viewport real |

## Hallazgos con severidad

1. **[Alta] — CORREGIDO.** `#vgl-paquete-modal` (líneas ~27089-27230) no estaba conectado a
   `_activarAccesibilidadModal`: no atrapaba el foco (Tab podía salir hacia Everest con el
   modal aún visible), sin auto-foco al abrir, sin retorno de foco al disparador, y sin
   ningún manejador de teclado — ni siquiera Escape. Confirmado por ausencia de código
   (grep de `_activarAccesibilidadModal(` — 10 resultados en todo el archivo, ninguno en
   esta función). Este id ya pertenecía a `VGL_MODALES_CONSULTA` (política de cierre) pero
   no a la lista de accesibilidad — inconsistencia, no decisión deliberada.

2. **[Alta] — CORREGIDO.** `#vgl-confirma-modal` (líneas ~29657-29840): cerraba con Escape
   pero tampoco llamaba a `_activarAccesibilidadModal` — sin captura de Tab, el foco podía
   salir del modal hacia Everest mientras el cuadro de "confirmar datos antes de calcular"
   seguía tapando la pantalla. Mismo patrón de hallazgo 1.

3. **[Informativa] — sin corregir.** El foco de `input`/`select`/`textarea` en los modales
   de flujo depende solo de un anillo `box-shadow` de bajo alfa (.18-.20) con
   `outline:none`; no se pudo medir su contraste real esta sesión. No se reporta como "No
   cumple" porque no hay medición — se dice qué falta medir y por qué. Candidato para
   próxima sesión con Chromium disponible desde el inicio.

4. **[Informativa] — sin corregir.** `#vgl-pes-modal`/`#vgl-labsv-modal`/`#vgl-riesgo-modal`/
   `#vgl-ficha-modal`/`#vgl-tablero-modal` tienen CSS completo sin evidencia de construcción
   en el DOM actual — no es hallazgo de accesibilidad, posible CSS muerto; fuera de alcance.

## Correcciones entregadas

**2 de 2 hallazgos Alta, entregadas por el coordinador** tras resolverse el bloqueo de
entorno (mismo cambio de una línea en cada función: conectar `_activarAccesibilidadModal`,
igual que los otros 9 modales ya lo hacen). Mutación verificada y fila en
`tests/INFORME_MUTACIONES.md`; banco completo en verde; bump de versión. Ver el commit de
esta rama para el diff exacto.

Los hallazgos 3 y 4 (Informativa) no se corrigieron: el 3 requiere medición en motor que
esta sesión no pudo completar; el 4 no es un hallazgo de accesibilidad.

## Hallazgos que requieren decisión del médico

Ninguno. Los dos hallazgos Alta eran puramente de accesibilidad de teclado (conectar un
gestor ya existente y probado a dos modales que quedaron fuera) — no cambian color,
disposición ni nada que el médico vea o haga distinto a como lo hace hoy.

## No verificado (lista honesta con motivo)

- **Verificación Chromium de la sección 4** (CSS real contra "Everest agresivo" simulado)
  — no se corrió esta sesión (bloqueo de entorno); no aplica a la corrección entregada
  porque no toca ninguna regla de color.
- **Foco visible con Tab real en Chromium** para los semáforos, dock, chips y demás
  controles fuera de los dos modales corregidos — no verificado.
- **Objetivos táctiles ≥24×24px** medidos con `getBoundingClientRect` para todo lo que no
  sea `.vgl-tl`/`.vgl-agm-close` — no verificado.
- **Contraste real de pares con capas translúcidas compuestas** (chips/badges, anillo de
  foco de inputs, texto sobre el vidrio del panel) — no verificado, requiere motor real.
- **Reflow a 200%/320px y las dos resoluciones de referencia** (1366×768, 1920×1080) — no
  verificado.
- **Firefox/Gecko** como verificación cruzada — no se intentó.
- **WebKit/Safari** — no disponible en Windows (limitación de plataforma).
- **Lector de pantalla en vivo** (NVDA/Narrator) — no se intentó instalar/usar; revisión
  estática de roles/nombres vía lectura de código únicamente (37 usos de `aria-label`,
  ninguna violación evidente de 2.5.3 en el muestreo — no exhaustivo).
