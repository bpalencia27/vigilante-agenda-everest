# Tareas para Jules — Refactorización global del diseño (v14.0.0)

**Cómo se usa:** una tarea por sesión de Jules, **en este orden**. Pega el PREÁMBULO completo
+ **UNA** tarea. Nunca dos. Cuando llegue el PR, no se aprueba sin correr `node tests/runner.js`
sobre su rama y sin la auditoría de Claude.

El brief completo está commiteado en **`SUPERPROMPT_DISENO_V14.md`**: Jules debe leerlo, no hay
que repetirlo en el prompt.

---

## PREÁMBULO (pegar siempre, antes de la tarea)

Trabajas en el repositorio `vigilante-agenda-everest`. Es un **userscript de Tampermonkey**
(`vigilante_agenda.user.js`, un único IIFE de ~11.500 líneas, sin build) que asiste a médicos de
una IPS en Colombia dentro del EHR Everest, con banco de pruebas propio en `tests/` (sin
frameworks: `node tests/runner.js`).

**Antes de escribir una sola línea, lee `SUPERPROMPT_DISENO_V14.md` en la raíz del repo.**
Contiene el contexto inmutable, las anclas ya verificadas del código (con números de línea), las
decisiones de arquitectura D0–D10 y el sistema de diseño v14. **No repitas ese reconocimiento: ya
está hecho y comprobado. No re-litigues esas decisiones.**

### REGLAS INNEGOCIABLES

1. **Rama base `claude/pym-agenda-blindaje-v12-4`**, jamás `main`.
2. **PROHIBIDO REFORMATEAR.** Ni Prettier, ni ESLint `--fix`, ni reordenar, ni cambiar comillas,
   ni normalizar indentación. Un reformateo hace el diff irrevisable y **el PR se descarta entero**.
3. **Sin dependencias, sin build, sin TypeScript, sin bundler.** El archivo se copia tal cual a un
   Gist y Tampermonkey lo ejecuta.
4. **Evidencia o no pasó.** Corre `node tests/runner.js` y pega la salida **COMPLETA** en el PR,
   incluida la línea de resumen final. Si el runner muere sin imprimirla, eso es un fallo tuyo.
5. **Un PR pequeño por tarea.** Nada de «de paso arreglé…».
6. **Cero PHI.** Ningún dato real de paciente, en ningún archivo, nunca.
7. **Casilla vacía antes que dato inventado.** Ningún selector, endpoint ni regla clínica sin
   evidencia citada. Si falta, dilo en el PR y entrega un diagnóstico para capturarla.
8. **Ninguna petición real** a Everest, Athenea ni AppCita. Todo con mocks, como las suites ya existentes.
9. **Prueba nueva + mutación documentada** por cada cambio de comportamiento: rompe tu propio
   arreglo, confirma que la prueba nueva falla, restaura, confirma verde. Transcríbelo en el PR.
10. **El banco nunca baja de 690 comprobaciones.**
11. **Comentarios en español**, explicando el POR QUÉ (el incidente o la restricción), no el qué.
12. **No fusiones nada.** El PR queda en borrador hasta que Claude lo audite y el médico apruebe.

---

# FASE 1 — Desincrustar el estilo inline (sin cambio visual)

> **Por qué primero:** hay 79 bloques `style="…"` generados desde JavaScript. El inline gana por
> especificidad, así que rediseñar la hoja de estilos antes de sacarlos produce un PR que parece
> funcionar y no cambia nada. Ver D1.

## T1 — Migrar a clases el estilo inline de `render()`

**Alcance:** SOLO la función `render()` (**11046**–~11230). Ahí hay **20 bloques `style="…"`**.

Qué hacer:
1. Por cada `style="…"` inline en el HTML de la tarjeta, crea una clase equivalente en el bloque
   CSS (junto a las reglas `.vgl-card*` existentes) y sustituye el inline por la clase.
2. **Excepción legítima e INTOCABLE:** las custom properties que la hoja de estilos **consume pero
   nunca declara** y que solo existen inline — `--tc` y `--trgb` (color de triaje, salen de
   `colorAndAlert`), y en otras zonas `--ac`/`--ac-rgb`/`--kpi-rgb`. Eso no es estilo incrustado,
   es **paso de datos**. Si las renombras o las quitas, las reglas que dependen de ellas se
   invalidan **en silencio**: sin error y sin prueba roja. Ver §1.3-bis(c) del superprompt.
3. **Ojo con el CSS que ya está muerto:** la regla `.vgl-btn-action,…{width:30px;height:30px;
   font-size:14px}` (6514–6524) **no la aplica nadie** — `render()` la pisa con inline de 40px/18px.
   Al desincrustar, la clase pasa a mandar de verdad: **conserva los 40px/18px reales**, no los
   30px/14px de la hoja, o los botones encogerán. Ver §1.3-bis(a).
4. **CERO cambio visual.** Mismos tamaños, colores, pesos y espaciados exactos — los que se ven
   hoy en pantalla, no los que dice una regla que nadie aplica.

Criterio de aceptación:
- El HTML resultante de la tarjeta no lleva `style=` salvo las variables `--tc`/`--trgb`.
- **Las pruebas existentes de `render()` siguen pasando sin modificarlas.** Si una prueba se cae
  porque afirmaba sobre una cadena de estilo inline, **repárala de verdad** (que afirme sobre la
  clase) y explícalo; no la borres ni la debilites.
- Prueba nueva: la tarjeta lleva las clases esperadas y **no** lleva `style=` de aspecto.
- En el PR: la lista de los 20 inline con su clase nueva, en tabla.

**Trampa conocida:** el DOM falso de las pruebas solo observa **asignaciones completas** de
`innerHTML`, no fragmentos parciales. Y `enriquecerDom()` (en `tests/suite_15_interfaz_avanzada.js`)
es el patrón obligatorio para ejercitar `render()`.

---

## T2 — Migrar a clases el estilo inline de modales y avisos

**Alcance:** los **59 bloques restantes** fuera de `render()` (modales de agendar/ordenar/labs,
`pymAlert`, `abandonoPESAlert`, `labsVencidosAlert`, toasts) **y** las 29 asignaciones `.style.X =`.

Mismas reglas que T1: clases equivalentes, cero cambio visual, valores dinámicos siguen inline.

**Incluye** migrar `#vgl-lab-injector` (línea **2671**), hoy con `cssText` inline, color `#8b5cf6` a
pelo y `z-index:9999999` — pasa a clase y a tokens.

Criterio de aceptación: igual que T1 + capturas antes/después de cada modal demostrando que **no
cambió nada**.

---

# FASE 2 — Sistema de diseño

## T3 — Tokens v14 (tipografía, espaciado, superficies, capas)

**Alcance:** solo el bloque de declaración de tokens. **No rediseñes nada todavía.**

Qué hacer:
1. Añade los tokens de §4.2 del superprompt: `--t-*` (tipografía), `--s*` (espaciado),
   `--surface-*`, `--z-*` (capas de D6).
2. **En las SEIS listas de selectores** (**5991** oscuro · **6059–6060** claro · **6169**/**6177** reset · **6186–6188** blindaje `color:inherit`). Ver §1.2:
   más la lista 6 en **7730–7738**. Omitir una es el incidente v12.6.6, que ya ocurrió y salió caro.
   **Extiende la prueba que ya vigila esto** (`tests/suite_06_interfaz.js`, líneas 44–96) y
   verifica a mano que caza tu elemento: mételo mal a propósito y comprueba que se pone roja.
3. Sustituye los `font-size` numéricos sueltos por los tokens **cuando el valor coincida exactamente**
   con la escala. Si un valor no encaja (11px, 15.5px, 21px…), **déjalo y anótalo en el PR** — no
   fuerces la escala cambiando tamaños, eso sería un cambio visual y esta tarea no lo es.
4. Migra todo `z-index` numérico suelto a los tokens `--z-*`.

Criterio de aceptación: **cero cambio visual**; lista en el PR de los valores que no encajaron en
la escala y por qué; verificado en modo claro y oscuro.

---

# FASE 3 — Amputación del panel

## T4 — El panel se queda solo con la agenda + etiqueta PES

**Alcance:** `render()`, el CSS de la tarjeta, y los tres textos de la etiqueta PES.

Qué hacer:
1. **Saca de la tarjeta** `agendarBtn` (11131), `ordenarBtn` y `labsBtn` (11156). **Deja
   `atenderBtn` 🩺** (11164).
2. **Saca los chips PyM** y sus textos alternativos («Al día · sin PyM pendiente», «PyM sin
   cargar», «Dato faltante…»).
3. **NO borres** `openAgendamientoModal`, `openOrdenamientoModal`, `openLaboratoriosModal`,
   `panelActivities`, `pymPendientesRestantes` ni sus pruebas: se siguen usando desde los widgets
   (T5). Borrarlas es motivo de rechazo (D3).
4. **NO borres** la telemetría `uxTrack` asociada; se reconectará en T5.
5. **NO borres** `isCitaAgendadaHoy` (2940), `isLabAgendadaHoy` (2958), `isOrdenesCreadasHoy` (2945),
   `panelActivities` (3315) ni `isPanelHiddenActivity` (3314). Se quedan sin llamador **dentro del
   script** al sacar los botones, pero siguen vivas y probadas, y T5 las reconecta. Las tres
   primeras son **bloqueos antiduplicado de seguridad clínica**, no comodidad.
6. **Cuidado con el literal repetido:** «PyM sin cargar» aparece DOS veces con significados
   distintos — en **11052** (barra de resumen `#vgl-sum`, **se queda**) y en **11111** (chip de la
   tarjeta, **se amputa**). Borrar el equivocado deja al médico sin saber que la base no cargó.
7. Con la tarjeta más simple, **rediseña su jerarquía** bajo el sistema v14: la hora y el estado
   mandan, el nombre es secundario, las banderas (fraude, PES) siguen siendo lo más llamativo.
8. **Etiqueta PES (D9), exactamente tres sitios:**
   - línea **11119** → `❤ ABANDONO PROGRAMA RCV`
   - línea **5233** → «Abandono Programa RCV — priorice el control de riesgo cardiovascular **sobre
     cualquier otra actividad de esta consulta**»
   - línea **10759** (Ajustes) → «Alerta de Abandono Programa RCV»

Criterio de aceptación:
- El panel **no** tiene botones de agendar/ordenar/labs ni chips PyM; **sí** tiene 🩺.
- El eje de color de puntualidad **intacto** (D0): demuéstralo con el diff de `colorAndAlert`
  (debe estar vacío) y con las pruebas de la suite 04 en verde.
- Prueba nueva: la tarjeta ya no genera esos tres botones, y **sí** sigue generando la bandera PES
  con el texto nuevo.
- **Mutación obligatoria** sobre la condición de la bandera PES.

---

# FASE 4 — Reubicación sobre la Historia Clínica

> Las tres tareas de esta fase son **de riesgo alto**: inyectan interfaz nueva en el DOM de una SPA
> ajena. Lee D5, D6, D7 y D8 antes de empezar.

## T5 — Dock de widgets sobre la Historia Clínica

**Alcance:** archivo nuevo de UI dentro del mismo IIFE (no hay módulos): una función
`createAccionesDockUI()` calcada en mecánica de `createLabInjectorUI()` (línea **2671**).

Qué hacer:
1. Un dock **colapsable** anclado al borde derecho, centrado vertical, con los tres botones
   (🗓️ agendar · 📋 ordenar PyM · 🧪 labs), que llama a las **mismas funciones de siempre**.
2. Solo aparece dentro del módulo clínico: usa `_enModuloHCHealth()` (línea **4908**).
3. El paciente se resuelve con `extractPacienteAbierto()` (ya existe, lo usa el inyector de labs).
   **Si no hay paciente identificable, el dock no aparece** — jamás un botón que actúe sobre un
   paciente equivocado.
4. Idempotente por id, re-creable cuando Angular repinte, sin duplicarse ni parpadear (D8).
5. Estado colapsado/expandido **recordado** en el almacén local.
6. `z-index: var(--z-widget)` (D6). Nivel de intrusión 1 (D5): **nunca tapa contenido de Everest**.
7. Reconecta la telemetría: `uxTrack("widget.agendar.abrir")`, etc. Documenta el renombrado.
8. **Replica los bloqueos antiduplicado** que hoy viven en la tarjeta: `isCitaAgendadaHoy`,
   `isLabAgendadaHoy` (los tres estados del botón de agendar, incluido «solo falta el laboratorio»)
   y `isOrdenesCreadasHoy`. Sin ellos se reabre el riesgo de crear dos citas o dos órdenes con un
   doble clic — un riesgo que este proyecto ya cerró una vez.
9. **Respeta `S.agendamientoRapido`** (2881, interruptor en Ajustes 10761): hoy gobierna los botones
   de agendar y ordenar. Si el widget lo ignora, el interruptor del médico queda decorativo.

Criterio de aceptación:
- Fuera del módulo clínico **no existe** en el DOM.
- Angular repinta → el dock vuelve, **sin duplicarse** (pruébalo simulando el borrado del nodo).
- Sin paciente identificable → no aparece.
- Presupuesto D7: `backdrop-filter` añadidos **0**, animaciones permanentes **0**.
- Pruebas nuevas para: aparición condicionada, idempotencia, re-creación, y que cada botón llama a
  la función correcta con el paciente correcto.

---

## T6 — Detección de órdenes ya vigentes (la verdad de Everest)

**Alcance:** una función de interfaz de API nueva + su cruce con `PYM_CATALOG`. **Sin interfaz
visual** — esta tarea es solo el motor que consume T7.

**Evidencia real capturada** (ver §1.6 del superprompt; no la busques, ya está):

```
GET /apiviva/APIHCHealth/api/Historicos/ObtenerOrdenamientoPorPacienteIdVigente?pacienteid=<id>
→ 200 · array de órdenes vigentes
  cada elemento: { cup:{codigo, descripcion}, agrupador, estado, tipo,
                   fechaCreacion, fechaVencimiento, dx:{codigo}, usuario:{id} }
```

Qué hacer:
1. `apiHcObtenerOrdenamientosVigentes(pacienteId)` siguiendo el patrón de las otras interfaces
   (`pageFetchJson`, try/catch, devolver `null` ante fallo — **nunca** lanzar).
2. `pymCubiertoPorOrdenVigente(actividades, ordenes, hoy)`: cruza los CUPS de
   `PYM_CATALOG[].cups[].codigo` contra `orden.cup.codigo`.
3. **Ventana temporal configurable (D4).** Por defecto conservador: una orden solo «tapa» una
   actividad si su `fechaCreacion` cae **dentro del año calendario en curso**. Ajuste visible en
   Ajustes. **Márcalo como pregunta abierta al médico en el PR.**
4. **No interpretes `estado`.** Los valores `PEN` y `PRO` aparecen en la captura pero **su
   significado no está confirmado**. Trátalos como opacos y **déjalo escrito**. Si el médico
   confirma después qué significan, se afina.
5. **Fallo = no cubierto.** Si la consulta falla, tarda o devuelve algo inesperado → la actividad
   cuenta como **pendiente** (D4: ante la duda, el banner se muestra).
6. Una consulta **por paciente**, con caché y deduplicación (`GHOST.promises` ya existe). Ojo: la
   respuesta real superó los 20.000 caracteres y venía truncada por el grabador — **es pesada**.

Criterio de aceptación:
- Pruebas con mocks para: cruce que cubre, cruce que no cubre, orden fuera de la ventana temporal,
  respuesta vacía, respuesta malformada, y **fallo de red → todo pendiente**.
- **Mutación obligatoria** sobre la dirección del fallo (invierte «fallo = no cubierto» a
  «fallo = cubierto» y demuestra que una prueba lo caza). Esta es **la mutación más importante del
  encargo**: es la que impide que se pierdan actividades de prevención en silencio.
- Cero peticiones reales.

---

## T7 — Banner PyM en la parte superior de la Historia Clínica

**Alcance:** el banner nuevo + apagar el aviso modal de PyM que hoy hace `pymAlert` (línea **5185**).

Qué hacer:
1. Banner de **nivel 2 · persistente** (D5): ocupa su franja arriba y **empuja** el contenido de
   Everest —no lo tapa flotando—; **no se puede cerrar** mientras haya actividades pendientes; sí
   se puede **minimizar a una barra fina** con el contador.
2. Contenido: las actividades PyM pendientes del paciente abierto, con los nombres de la tabla
   oficial de CUPS que ya usa el script, y un acceso directo a ordenarlas (reutiliza
   `openOrdenamientoModal`).
3. **Se apaga solo** cuando T6 dice que todas están cubiertas. Si T6 no pudo verificar → **el
   banner se muestra** y dice con honestidad que no pudo comprobarlo (D4).
4. `z-index: var(--z-banner)`. Se cuelga de `document.body` → **añádelo a las 4 listas de tokens**
   (§1.2) o saldrá sin fondo ni tarjeta, exactamente como el incidente v12.6.6.
5. Idempotente y re-creable ante los repintados de Angular (D8).
6. **El abandono del Programa RCV NO se convierte en banner.** Sigue siendo alerta de nivel 3
   (modal + sonido). D5 es explícito: no se degrada.
7. No consultes la red en cada repintado: una vez por paciente, cacheado (D7).

Criterio de aceptación:
- Con actividades pendientes → banner visible, no cerrable, minimizable.
- Con todas cubiertas (T6) → no aparece.
- Con la verificación caída → **aparece**, con el texto honesto.
- Angular repinta → sigue ahí, sin duplicarse.
- Modo claro y oscuro; `perf` lo simplifica; `prefers-reduced-motion` respetado.
- Pruebas nuevas para los tres estados + la re-creación. **Mutación obligatoria** sobre la
  condición de apagado.

---

# FASE 5 — Piel de los modales

## TL1 — Modales de agendar y ordenar bajo el sistema v14

**Alcance:** solo **piel** (tokens, tipografía, densidad, jerarquía). **Cero cambios de lógica.**

⚠️ El rediseño **funcional** del modal de agendamiento (ventana de días, realce de la cita
sugerida, perfil del paciente) está delegado aparte en **`SUPERPROMPT_AGENDA_V13.md`**.
**No lo dupliques ni te adelantes.** Si tu cambio de piel choca con esa tarea, detente y dilo.

## TL2 — Rediseño del modal de laboratorios

**Ya corregido en v12.8.1 el desastre de legibilidad** (D2): no lo rehagas ni lo reviertas.
Lee el commit antes de tocar nada.

Qué queda:
1. Que un **panel multiparamétrico** (uroanálisis, ~30 parámetros) se lea como un panel: agrupado,
   con jerarquía, y con lo alterado destacado sobre lo normal.
2. Densidad clínica: más información por pantalla, sin scroll innecesario (§4.3.4).
3. **Regla grabada a fuego:** en esta tabla, `overflow-wrap:anywhere` y `table-layout:auto` **no se
   vuelven a juntar nunca** — esa combinación fue la causa raíz.

**Hueco de evidencia detectado, para el PR:** la columna **Ref./Rango** sale vacía a menudo porque
el nombre real del campo de valores de referencia en el payload de Athenea **no está confirmado**
(el código prueba `referencia`, `ValoresReferencia`, `Estado`). **No adivines uno nuevo:** entrega
un script de diagnóstico que vuelque las claves reales de un analito, para capturarlo en
consultorio. Ya pasó antes con los campos de fecha (v12.3.30): los 4 nombres que se habían
adivinado no existían.

---

# FASE 6 — Auditoría

## T8 — Rendimiento, contraste y accesibilidad

Qué entregar:
1. Medición contra el presupuesto de D7: `backdrop-filter` totales (antes/después), capas de
   sombra máximas, animaciones permanentes (debe ser **0**), y el efecto sobre el mecanismo
   anti-repintado.
2. Tabla de **pares de contraste reales** de todo elemento nuevo, en claro y oscuro, contra AA
   (4.5:1) y AAA (7:1) para lo que codifique estado clínico.
3. Verificación de que **ningún estado crítico depende solo del color** (§4.3.2).
4. Verificación de que **ningún tamaño de letra baja de 12px** (compromiso `[COPY-UX]` existente).
5. Confirmación de que el modo `perf` apaga todo lo nuevo.

Sin código nuevo salvo correcciones que se deriven de la propia auditoría.
