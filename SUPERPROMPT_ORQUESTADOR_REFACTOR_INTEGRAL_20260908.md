# SUPER PROMPT — Orquestador del refactor integral, PANEL DEL PACIENTE y motor de IA
## Vigilante de Agenda · Orden del 08-sep-2026 · Base verificada: v18.8.7 (3673/3673, EXIT=0)

> Documento de encargo. Lo ejecuta un **enjambre de subagentes** coordinado por un
> orquestador (SA-ORQ): **una tarea por fase, un agente por tarea**, cada fase
> termina con entrega verificable (suite verde + mutación cuando cambia
> comportamiento) y el orquestador corre el banco completo entre fases.
> Texto fuente de la orden: `tmp/orden_refactor_integral.txt` (íntegro).
> Especificación clínica que rige el contenido: `PROMPTWARE.md` (raíz del repo).

---

# 0. ESTADO REAL VERIFICADO (inventario previo — NO re-mapear)

Dos agentes de reconocimiento ya cartografiaron el userscript (v18.8.7, 54.331
líneas) y las auditorías de 2026-09-07. **Antes de proponer, leer esto: mucho de
lo que la orden pide YA EXISTE y no debe rehacerse ni romperse.**

## 0.1 Lo que la orden pide y YA está implementado

| Pedido de la orden | Estado real verificado |
|---|---|
| DeepSeek como modelo por defecto | **YA**: `deepseek-v4-flash` es PRIMARIO desde v18.8.0 (`MTR_PROVEEDORES_IA` L48768-48784; escalera deepseek > z.ai > Gemini en `mtrGeminiRedactar` L48916-48924). Suite `tests/suite_99_ia_deepseek.js` lo fija byte a byte. |
| Gemini solo con API key del usuario | **YA**: no hay clave embebida; el gate `mtrHayClaveIA()` L47492 y la escalera exigen clave presente para cada proveedor. Claves ofuscadas en GM (`vgl_gemini_key` L47432, `vgl_zai_key` L47467, `vgl_deepseek_key` L47481). |
| Claves configurables en Ajustes / modo desarrollador | **YA**: campos `#c-deepseek-key`, `#c-zai-key`, `#c-ia-key` en la sección técnica de Ajustes L36185-36188 (oculta salvo modo programador Ctrl+Shift+D `_vglProgOn` L36006); enmascaradas y binding L36426-36449. |
| Grounding | **YA**: hoja de hechos `mtrHojaDeHechos` L47159 / `mtrHojaDeHechosTexto` L47325, saneo anti-PHI `mtrSanearTextoLibreAI` L48006, barrera `mtrBarreraIdentificables` L48799 (6 detectores), sello R-Grounding (suite 96). El **JSON v68 del motor viaja como bloque de grounding** L48254. |
| Cosecha de datos | **YA**: memoria clínica `vgl_cosecha` cifrada AES-GCM (v18.4.3+), 80 pacientes/120 días, cosecha del DOM de la HC (`_vglCosecharDePantalla` L5687) con compuerta de DOM sucio (`_vglDomEstaSucia` L5361), captura de red de Everest (`mtrHcEnganchar` L52881, parchea XHR/fetch), acumulación de casillas en vivo `mtrHcAcumularDelDom` L53108. |
| Manejo de información sensible | **YA**: `scrubPII` L9766, cifrado AES-GCM en reposo (suites 89, 31), nombre del paciente solo en RAM (`_mtrNombreRam` L52840), capa anti-nombres hacia la IA L41943-42060, XSS cero (auditoría 20260903: 146 sumideros mapeados, categoría E = 0). |
| Motor que cumple PROMPTWARE.MD | **YA**: el spec del motor RCV v68 (PROMPTWARE.md) está implementado como lógica JS (`SYS_MOTOR_RCV`, JSON v68 `mtrJsonV68DesdeResumen` L49541, campos `programa_activo` L49575, `ftl_date`/`control_date`/`order_list`). |
| Programa del paciente en el panel | **YA (parcial)**: `d.programa.rector/rotulo` se pinta en Exámenes L28047-28048 y en el bento `tieneProg` L27743. |
| Próximos exámenes a ordenar | **YA (parcial)**: sección Exámenes del panel con «Toma sugerida / Control» L28066; `order_list` en motor v68 L49919 y en widget de Conducta. |

## 0.2 Lo que la orden pide y NO existe / está pendiente (trabajo real)

1. **Sincronización «inmediata» de lo que ingresa el médico** (énfasis prioritario de
   la orden): hoy el MutationObserver (`_vglInstalarVigilanciaDom` L5333) solo marca
   DOM sucio; la cosecha corre en el tick de 5 s (`tick()` L37549 → L37707), el panel
   repinta con watchdog de **20 s** (L28999-29040). Auditoría 20260903 (A3): barrido
   completo cada 5 s sin usar la bandera sucia (L33036/33047). **No hay reacción
   sub-segundo** a la escritura del médico.
2. **Selector/prioridad de proveedor IA visible**: la escalera es por clave disponible,
   no por preferencia del médico. La orden pide DeepSeek V4 Flash como «predeterminado
   del sistema» — es el primario de facto, pero sin selector no hay garantía visible.
3. **Optimización de prompts para DeepSeek V4 Flash**: `mtrRedaccionPrompt` L48195
   (system L48223+, bloques L48252+) se escribió para Gemini/z.ai; DeepSeek usa
   `role:"system"` propio (L48774). Verificar formato/temperatura/longitud óptimos.
4. **PANEL DEL PACIENTE — hallazgos sin aplicar de la auditoría 20260907**: U1 (hasta 2
   diálogos previos: botón «Ahora no»), R4 (refresco sin barra de progreso), R5
   (`pintar()` reconstruye todo el innerHTML aunque nada cambió), A3 (sin `aria-live`),
   S5 (sin mascarado del documento: patrón `_mtrCelularMascarado`), U5 (esquinas).
5. **PANEL DEL PACIENTE — pedidos nuevos de la orden**: identificación del programa
   como elemento propio (no solo en Exámenes/bento), gestión de próximos exámenes a
   ordenar (acción desde el panel, no solo lectura), **módulo integrado de sugerencias
   para asignación de citas desde el panel** (hoy vive aparte en `openAgendamientoModal`
   L29533 con sugerencia `#vgl-agm-sugerida` L29674); rediseño de UI.
6. **Fallos de seguridad/rendimiento conocidos** (auditoría 20260903): A1 (SHA-256
   calculado pero `VersionCheck.gs` nunca envía `expectedSha256` — control inerte),
   M1 (BroadcastChannel acepta mensajes sin validar L9808/L10015), M5/B1/B2 (console.log
   con PHI residual: L28441, L29967, L2597), A2 (`vgl_piloto` hasta 12 MB sin purga
   L12718), M2/M3/M7/M8.

## 0.3 Arquitectura a respetar (inamovible)

- Un solo archivo IIFE (54.331 líneas): sin módulos, bundlers ni reformateo. PROHIBIDO
  REFORMATEAR el archivo — PR descartado entero.
- Harness `tests/harness.js`: `cargar({gmxhr, almacen, silencioso})`; el API publica
  TODAS las funciones declaradas. Suite 99 mockea `gmxhr`, NO fetch.
- Banco: `node tests/runner.js` ≥ 3673 verdes, EXIT=0 real (`> log 2>&1; echo EXIT=$?`).
- Mutación verificada + fila en `tests/INFORME_MUTACIONES.md` por TODO cambio de
  comportamiento. Bump `@version` + `const VERSION` + package.json + suite_75 por
  entrega. Acta en `docs/REGISTRO_DECISIONES.md`. CHANGELOG. Gist + GitHub por entrega.
- Cero PHI en código, tests, comentarios, commits y PRs (solo IDs anonimizados).
- CSS fuera de `#vgl-root` con `!important` en colores; verificación Chromium contra
  Everest simulado (`docs/herramientas/chromium_102.py` / `chromium_186.py`).
- PROMPTWARE.md es la especificación clínica: el motor RCV v68 **no se reescribe**;
  solo se optimiza cómo se le presentan los datos y cómo se formula el prompt de IA.

---

# 1. FASES DEL ENCARGO

## FASE A — Sincronización en tiempo real de la escritura del médico (prioridad 1)
**Agente**: SA-A (perfil: kernel/observadores).
**Objetivo**: reducir la latencia entre lo que el médico escribe en Everest y la
reacción del sistema (cosecha/panel/avisos) de 5-20 s a **sub-segundo con debounce
razonable**, sin degradar rendimiento (A3).
**Alcance**:
- A.1 Medir el camino actual: observer L5333-5360 (marca sucio) → `tick()` L37549
  (5 s) → cosecha L37707; watchdog del panel L28999-29040 (20 s).
- A.2 Implementar flush temprano: al marcar DOM sucio, programar un flush con
  debounce (300-800 ms) que adelante `_vglCosecharDePantalla` y el repintado del
  panel si está abierto — SIN duplicar trabajo del tick (bandera/cola única).
- A.3 El panel abierto y visible se refresca con la escritura (firma delta real:
  resolver R5 con firma corta del resumen, no innerHTML completo).
- A.4 Pruebas con reloj inyectable (patrón suite 60): escribir en una casilla
  simulada → el panel/cosecha reacciona en < 1 s sin esperar el tick; nada cambia
  si el DOM no se movió. Mutación: quitar el flush temprano → la prueba cae.
**Puerta**: suite nueva ≥ 5 casos + mutación + banco completo verde.

## FASE B — PANEL DEL PACIENTE: cierre de hallazgos + pedidos de la orden
**Agente**: SA-B (perfil: UI/DOM/accesibilidad).
**Objetivo**: el modal `#vgl-panel-modal` (`openPanelPacienteModal` L28607) aplica la
auditoría 20260907 y suma: programa del paciente, exámenes gestionables y citas.
**Alcance**:
- B.1 Cerrar U1 («Ahora no» en el llenado de campos, L28492/L28671), A3 (`aria-live`
  en `#vgl-panel-cuerpo`), R4 (feedback de progreso en «Buscar laboratorios nuevos»,
  L28969-29010), S5 (mascarado del documento `···111` con revelado por clic, patrón
  `_mtrCelularMascarado`).
- B.2 **Programa**: cabecera/bloque propio con `d.programa.rector` + vigencia, visible
  en TODAS las pestañas (hoy solo Exámenes/bento) — dato en RAM, cero PHI persistida.
- B.3 **Exámenes a ordenar gestionables**: fila por examen con estado (debido /
  vigente / vencido / bloqueado según motor v68), acción «Ordenar» que prepara la
  orden (reusar canal de Conducta/`Ordenar pendientes`, L36177) sin sobrescribir
  nada del médico; `denied_list` explicada.
- B.4 **Sugerencia de asignación de cita integrada**: bloque «Cita sugerida» con
  `ftl_date`/`control_date` del motor y horario sugerido del agendador
  (`mtrItemSugeridoEnRango` L53977); botón que abre `openAgendamientoModal` L29533
  con esos datos PRE-CARGADOS (nunca agenda por su cuenta: el médico manda).
- B.5 Rediseño de UI coherente con tokens (`--surface-2`, `--line`, `--t-*`), las 5
  pestañas intactas, sin romper las suites 15/63/67/88.
**Puerta**: suite_67 ampliada + casos hermanos en suite_15/63 + verificación CSS
Chromium de lo nuevo + mutación ≥ 2 + banco verde.

## FASE C — Motor de IA: default DeepSeek V4 Flash, Gemini condicional, prompts optimizados
**Agente**: SA-C (perfil: IA/redacción, pruebas con gmxhr mockeado).
**Objetivo**: hacer explícito y verificable el contrato que la orden pide, sin romper
la escalera ni la suite 99.
**Alcance**:
- C.1 Selector de proveedor preferido en Ajustes (sección técnica): «Motor de IA
  preferido» (DeepSeek · z.ai · Gemini · automático) que fija el orden de la escalera
  L48916-48924; DeepSeek V4 Flash es el default del sistema. Persistencia
  `vgl_ia_pref` (sin PHI). La sección técnica ya existe (modo programador).
- C.2 Gemini: verificar que SIN clave configurada no hay llamada posible (gate
  existente) y que con clave solo aparece en Ajustes modo desarrollador — cerrar
  cualquier ruta que muestre el campo fuera de ese modo.
- C.3 Optimizar `mtrRedaccionPrompt` para DeepSeek V4 Flash: system conciso +
  JSON v68 como bloque estructurado (no recalcular), temperatura 0.2 ya fijada,
  `max_tokens` adecuado; validar parseo con `mtrRespuestaZai` (OpenAI-compatible).
  Guardar el prompt resultante solo para diagnóstico redactado.
- C.4 Probar con gmxhr mockeado: llamada ÚNICA al proveedor preferido, cero llamadas
  a Gemini sin clave, payload byte-exacto, fallo 429/400 rota (no-regresión DS·4).
**Puerta**: suite_99 ampliada (selector + default + gate Gemini) + suite_57 intacta +
mutación ≥ 2 + banco verde.

## FASE D — Seguridad y rendimiento del refactor
**Agente**: SA-D (perfil: seguridad/rendimiento; revisa, propone y aplica SOLO lo
acotado, documentando el resto como deuda con severidad).
**Alcance**:
- D.1 Cerrar M5/B1/B2 (console.log con PHI: L28441, L29967, L2597) — redactar o
  quitar; mutación verificada.
- D.2 M1: validar mensajes de BroadcastChannel (firma/token) — sin romper el
  relevo de liderazgo (suite 60) ni el arriendo del aviso (v18.8.5).
- D.3 A1: documentar y proponer el envío de `expectedSha256` (requiere cambio del
  lado de VersionCheck.gs — dejar instructivo, NO tocar el backend ajeno).
- D.4 Rendimiento A3: usar la bandera sucia para saltar el barrido completo cuando
  nada cambió (con FASE A si se solapan, A gana; D cubre el resto del ciclo).
- D.5 Re-correr la auditoría de sumideros XSS y cifrado en reposo sobre el diff.
**Puerta**: suite_31 ampliada o casos nuevos + mutación + banco verde.

## FASE E — Verificación integral y entrega
**Agente**: SA-ORQ (orquestador) con SA-V (verificador independiente).
**Alcance**:
- E.1 Pruebas de sincronización en tiempo real (lo de FASE A en el banco con reloj
  inyectable y, si hay entorno, verificación de usabilidad).
- E.2 Pruebas de usabilidad de la UI actualizada (recorridos del panel: abrir →
  programa → exámenes → cita sugerida → agendar, con y sin datos).
- E.3 Validación de las APIs de IA con gmxhr mockeado (nunca llamadas reales).
- E.4 Seguridad de datos sensibles sobre el diff (cero PHI nueva, cifrado intacto).
- E.5 Rendimiento: banco completo EXIT=0 y, si es medible, sin regresión de ticks.
- E.6 Bump a v18.8.8 (cuádruple: @version, const VERSION, package.json, suite_75),
  CHANGELOG, INFORME_MUTACIONES, REGISTRO_DECISIONES, banco final, **gist
  d231aab6f54de51a5c472b392aac1b91 verificado byte a byte** (`docs/herramientas/
  armar_payload_gist.js` — actualizar description) + push.
**Puerta**: banco final completo EXIT=0 real + gist byte a byte + acta.

---

# 2. REGLAS DE ORQUESTACIÓN

- SA-ORQ ejecuta las fases EN ORDEN (A → B → C → D → E) salvo conflicto de edición
  en las mismas líneas (A y D solapan en el ciclo de cosecha: A primero, D se limita
  a lo que A no cubra). Si dos fases tocan el mismo rango, el orquestador serializa.
- Cada agente entrega: diff acotado + suite(s) nueva(s)/ampliada(s) verdes + fila(s)
  de INFORME_MUTACIONES con la mutación ejecutada (rojo → restaurar → verde) +
  comandos exactos y salidas adjuntas. NINGUNA afirmación de «verificado» sin el
  comando y su salida.
- El orquestador corre `node tests/runner.js` tras CADA fase; si cae algo que no es
  de la fase, lo reporta y no avanza.
- Trabajo en la rama `claude/sf-v18.6.1-fix` del worktree actual (ya aislado); no
  tocar WIP del checkout principal (`_*.txt`, `_pw_profile*/`, `.har`).
- Cero PHI en todo lo anterior. Los nombres de paciente de pruebas son seudónimos.
- Si una fase descubre que un pedido de la orden ya está cumplido, se documenta
  «YA EXISTE (ver §0.1)» y no se toca — se verifica con su suite y se cierra.

# 3. CRITERIOS DE ACEPTACIÓN GLOBALES (marcar al cerrar)

- [ ] FASE A: la escritura del médico mueve panel/cosecha en < 1 s (reloj inyectable).
- [ ] FASE B: programa visible, exámenes gestionables, cita sugerida pre-cargada.
- [ ] FASE C: DeepSeek V4 Flash default verificable; Gemini cero llamadas sin clave.
- [ ] FASE D: sin PHI en consola; BroadcastChannel validado; deuda A1/A2 documentada.
- [ ] FASE E: banco completo EXIT=0 real, gist byte a byte, acta en REGISTRO.
- [ ] Mutaciones ≥ 7 totales, todas transcritas en INFORME_MUTACIONES.
- [ ] Ninguna suite preexistente enrojeció (comparar contra 3673).
