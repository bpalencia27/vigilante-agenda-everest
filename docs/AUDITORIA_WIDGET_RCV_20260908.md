# Auditoría integral del widget «Próximos exámenes · Riesgo cardiovascular»

Fecha: 2026-09-08 · Versión objetivo: v18.8.3 · Ámbito: panel `#vgl-rcv-pendientes`
(v18.4.2) + badge de exámenes `#vgl-cw-examenes` (v17.x), ambos en `document.body`.

Encargo del médico (pasos 1-6 del pedido): auditoría completa → clasificación por
criticidad → correcciones → validación de datos + actualización automática 24 h →
pruebas exhaustivas en 3 navegadores → documentación trazable. Este documento es la
pieza 6; las piezas 1-5 se resumen abajo con evidencia.

## 1. Clasificación por criticidad

| Nivel | Id | Error | Estado |
|---|---|---|---|
| BLOQUEANTE | — | Ninguno encontrado: el widget cargaba, navegaba y no exponía datos de otros pacientes (guarda anti-cruce verificada) | — |
| GRAVE | G1 | El panel del badge de exámenes se abría CORTADO por el borde en pantallas angostas (móvil/tablet): el clampeo existente solo cubría paneles laterales de ancho fijo; el badge es centrado y no puede «abrirse al otro lado» | CORREGIDO |
| GRAVE | G2 | Listado con riesgo de mostrar datos de AYER sin decirlo: el caché de órdenes vigentes (TTL 10 min) no se invalidaba al cambiar el día calendario (pestaña dormida toda la noche) y el pie no mostraba cuándo se leyó Everest | CORREGIDO |
| LEVE | L1 | Botón de cierre por debajo del mínimo táctil (WCAG 2.5.8 = 24 px) | CORREGIDO |
| LEVE | L2 | Jerga técnica cruda (códigos CUPS «903815») incomprensible para un paciente sin formación médica | CORREGIDO |
| LEVE | L3 | Responsividad: sin `box-sizing:border-box`, el `max-width:calc(100vw - 32px)` limitaba solo el contenido y la caja real sumaba padding+borde — borde derecho cortado en pantallas angostas | CORREGIDO |
| LEVE | L4 | `todayStamp()` interpreta el día calendario en hora local del equipo; el resto del flujo usa Bogotá | DOCUMENTADO, sin corregir (ver §4) |

## 2. Causa raíz, corrección y evidencia por error

### G1 — clampeo del panel del badge (grave)

- **Causa raíz**: `mtrPosicionPanelJuntoA()` (L6990) clampa paneles que se abren a UN
  LADO de su ancla con ancho fijo. El badge de exámenes, por encargo del médico
  (v17.41.0), está CENTRADO entre «Historial» y «Paquetes» con `translateX(-50%)`:
  no tiene «otro lado» al que abrirse, así que su defensa era inexistente.
- **Corrección**: `_cwClamparPanelAbierto(widget)` — al ABRIR (clic) y en cada tick
  con el panel abierto, corrige `left` lo justo para que el div completo quepa con
  margen de 8 px, midiendo el ancho REAL ya desplegado (shrink-to-fit, nunca un
  ancho asumido). Con `translateX(-50%)` el centro visual coincide con `style.left`,
  así que mover `left` mueve el div en bloque. Al cerrar, el tick restaura el
  centrado exacto.
- **Evidencia**: 5 casos nuevos en suite_71 (puros + hostil + integrado con clic
  real); mutaciones M1 (clampeo quitado del handler) y M2 (quitado del tick) — ambas
  ROJAS con el aserto exacto y restauradas; y medición en navegador real con la
  función REAL extraída del userscript (ver §3).

### G2 — estampa de frescura + actualización automática 24 h (grave)

- **Causa raíz**: `_ordenesVigentesCache` (TTL 10 min) mantenía el listado fresco
  mientras el tick vivía, pero una pestaña dormida toda la noche (timers
  ralentizados) podía cruzar la medianoche DENTRO del TTL y mostrar el listado de
  ayer sin señal alguna — y el pie no decía cuándo se leyó.
- **Corrección** (dos piezas):
  1. **Sello diario**: `_rcvpDiaUltimoRefresco` — el primer tick de un día
     calendario nuevo invalida el caché UNA vez; el resto del día lo mantiene el
     TTL. El listado de exámenes se actualiza automáticamente cada 24 h de
     calendario sin intervención del médico.
  2. **Estampa de frescura**: el pie dice «leído de Everest hoy HH:MM» (o «DD-MM
     HH:MM» si es de otro día) cuando hay consulta exitosa, y «se actualiza solo»
     cuando aún no la hubo — **nunca se finge una hora** («casilla vacía antes que
     dato inventado»).
- **Evidencia**: casos puros del pie y del HTML en suite_88; caso de frescura (estampa
  vacía → «hoy HH:MM» → «DD-MM HH:MM»); caso de medianoche (tick 23:58 → 00:02 del
  día nuevo con el TTL aún vigente → re-consulta). Mutaciones M3 (estampa siempre
  vacía) y M4 (sello quitado) — ambas ROJAS con el aserto exacto y restauradas.

### L1 — cierre táctil 28×28

- **Causa raíz**: el botón «✕» no alcanzaba el mínimo táctil.
- **Corrección**: `width:28px;height:28px` (WCAG 2.5.8 pide ≥24 px).
- **Evidencia**: aserto CSS en suite_88; mutación M6 (28→22) ROJA y restaurada;
  medición real del rect 28×28 en los 3 motores (ver §3).

### L2 — rótulos amables

- **Causa raíz**: la fila mostraba solo la descripción técnica del CUPS; un paciente
  sin formación médica no entiende «903815».
- **Corrección**: `RCV_ROTULOS_AMABLES` (10 códigos): rótulo amable arriba
  («Colesterol bueno (HDL)»), desc técnica debajo (fuente de verdad del CUPS). Sin
  rótulo confirmado, solo la desc — nunca un rótulo supuesto.
- **Evidencia**: caso puro en suite_88 (rótulo<desc, CUPS desconocido sin desc);
  mutación M5 (entrada «903815» quitada) ROJA y restaurada.

### L3 — box-sizing del panel (hallado POR la verificación en navegador)

- **Causa raíz**: `#vgl-rcv-pendientes` no tenía `box-sizing:border-box`; con
  `width:330px` + `max-width:calc(100vw - 32px)` + `padding:12px 14px` + borde, en un
  móvil de 360 px la caja real medía 358 px y el borde derecho quedaba cortado e
  inalcanzable (position:fixed no genera scroll). En escritorio se disimulaba
  (330+30 < 1366). Hallado midiendo el rect real en Chromium 360×640.
- **Corrección**: `box-sizing:border-box` en la regla raíz — la caja total respeta
  el tope; en escritorio no cambia nada.
- **Evidencia**: aserto CSS (b3) en suite_88; mutación M7 ROJA y restaurada;
  medición real «panel dentro de la ventana» en 3 motores × 3 viewports.

### L4 — hora local de todayStamp (documentado, sin corregir)

- **Observación**: `todayStamp()` usa la hora local del equipo para el día
  calendario; el resto de la lógica de la base única se apoya en Bogotá. No se
  corrigió en esta entrega: no hay evidencia de un daño real medible (el equipo del
  médico opera en Colombia) y cambiarlo toca flujos fuera del widget — **decisión
  del médico pendiente**. Se registra para trazabilidad.

## 3. Verificación empírica post-corrección (paso 5 del encargo)

Página de prueba montada con el **CSS REAL extraído del userscript** (los tres
bloques de la hoja inyectada, sin recortes a mano) + HTML con la estructura real de
`rcvPendientesHtml` + **CSS «Everest» simulado agresivo**
`div,span,p,b,small,label,button{color:magenta !important}` (CLAUDE.md).

| Navegador | 360×640 móvil | 768×1024 tablet | 1366×768 escritorio |
|---|---|---|---|
| Chromium | VERDE | VERDE | VERDE |
| Firefox | VERDE | VERDE | VERDE |
| WebKit (motor de Safari) | VERDE | VERDE | VERDE |

Verificado en cada combinación (9 de 9):
- **Colores**: 17 selectores (títulos, chips de estado, rótulos amables, desc
  técnica, pie, badge y su panel) sobreviven al magenta con `!important` de Everest.
- **Cierre**: rect real de 28×28 px.
- **Responsividad**: panel dentro de la ventana, sin desborde horizontal interno ni
  de página (incluido el móvil de 360 px — el caso que delató L3).
- **Clampeo G1**: con la **función real** `_cwClamparPanelAbierto` extraída por
  balanceo de llaves (inmune a los line endings mixtos del archivo) y ejecutada en
  la página: badge re-centrado en 380 px con ventana de 360 → clampeado dentro,
  página sin scroll horizontal.
- **Centrado**: el centro visual del badge coincide con `style.left`
  (`translateX(-50%)`), la invariante del encargo v17.41.0.
- **Interacción** (escritorio): hover del cierre → rojo; Tab → `:focus-visible`
  con outline azul.

La verificación se **re-corrió contra el fuente final** (`@version 18.8.3` ya
bumpeada) al cierre de la entrega: 9 de 9 VERDE otra vez (el CSS y el clampeo no
cambiaron con el bump; la evidencia corresponde al byte que se publica).

**Safari real**: no existe en Windows; WebKit es el motor de cascada y composición
de Safari — lo que sobrevive en WebKit sobrevive en Safari. Documentado
honestamente como validación estática equivalente; la prueba de fuego final será el
primer uso en vivo del médico en macOS/iPadOS si algún día consulta desde allí.

**Recordatorios y conflictos**: el widget no emite notificaciones propias; los
avisos/toasts del módulo de conducta asociados pasan la regresión (suite_71, 90
casos). Conflictos con otros componentes: contrato CSS de la Regla G actualizado a
669 menciones con su justificación (la nueva regla de color `.vgl-rcvp-desc` fuera
de `#vgl-root` — la Regla E exige `!important` sin excepción) y banco completo en
verde.

## 4. Validación de datos (paso 4 del encargo)

- Solo se cachean **arrays de respuestas exitosas**; ante error de red, el pie dice
  «se actualiza solo» (honestidad, nunca una hora fingida).
- Estampa vacía hasta la primera consulta exitosa.
- **Actualización automática cada 24 h**: sello diario (invalidación única al
  primer tick del día nuevo) + TTL de 10 min mientras el tick vive — combinados
  cubren tanto la pestaña dormida como la consulta en vivo.
- Guarda anti-cruce intacta: si el médico cambió de paciente mientras salía la
  consulta, nada del anterior se pinta en la historia del nuevo (verificada por la
  suite_88 existente).
- «Casilla vacía antes que dato inventado»: sin rótulo confirmado, solo la desc
  técnica; sin órdenes consultables, todo queda PENDIENTE y se avisa con la nota
  del panel.
