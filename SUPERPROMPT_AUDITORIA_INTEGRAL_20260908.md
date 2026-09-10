# SUPER PROMPT — Orquestador de la AUDITORÍA INTEGRAL POST-DESARROLLO
## Vigilante de Agenda · Orden del 08-sep-2026 · Partida verificada: working tree v18.8.7+ (código FASE A/B v18.8.8 ya en el árbol, flush L5334+) · banco 3682/3682 EXIT=0 real

> Documento de encargo. Lo ejecuta un **enjambre de subagentes en modo teamwork
> preview** coordinado por un orquestador (SA-ORQ): **una tarea por fase, un agente
> por tarea**, cada fase termina con entrega verificable (suite verde + mutación
> cuando cambia comportamiento) y el orquestador corre el banco completo entre fases.
> Texto de la orden: dictado EN VIVO por el médico el 08-sep-2026 (transcrito en §1).
> Insumos de cartografía ya disponibles: 3 informes de agentes de reconocimiento del
> 08-sep (rutas y contenido en §5). Reglas del proyecto: `CLAUDE.md` (raíz).
> Patrón de encargo hermano: `SUPERPROMPT_ORQUESTADOR_REFACTOR_INTEGRAL_20260908.md`.

---

# 0. ESTADO REAL VERIFICADO (inventario previo — NO re-mapear)

Tres agentes de reconocimiento ya cartografiaron el 08-sep (configuración/toggles,
notificaciones/UI, flujos y funciones muertas — ver §5) y el refactor integral
posterior ya entregó sincronización de escritura y unicidad de notificaciones.
**Antes de proponer, leer esto: mucho de lo que la orden pide YA EXISTE y no debe
rehacerse ni romperse.**

## 0.1 Cláusulas «YA EXISTE» — pedidos de la orden ya resueltos (verificar con su suite, cerrar sin rehacer)

| Pedido de la orden | Estado real verificado |
|---|---|
| (Parte 1) Un solo registro de aviso por evento, sin repeticiones entre ventanas/instancias | **YA**: suite_103 (v18.8.7) fija `logEvent`/`_auditMarcaUnica` con candado compartido `vgl_audit_unico` (patrón `vgl_fraude_dia2`), control por (evento, cita, día) en CUALQUIER instancia, y los candados de AVISO por pestaña. Lo único compartido entre pestañas es el candado anti-duplicado. La parte 1 de la orden queda acotada a lo que suite_103 NO cubre: **código duplicado** y **un mismo hecho anunciado por piezas de UI distintas** (badge + banner + chip + modal) — ver FASE A.3. |
| (Parte 2) Escritura del médico reflejada sin esperar el tick | **YA**: FASE A del refactor (v18.8.8, `FLUSH DE ESCRITURA` L5334+): input/change distinguidos de click (L5411) y flush con debounce de 700 ms; suite_104 la fija. La auditoría NO rehace sync: solo no-regresión. |
| (Parte 2) Toggles por médico con pintado automático | **YA (mecánica)**: `VGL_TOGGLES` L10154 (k/label/desc/sub/defecto), persistencia por doctor `vgl_tog_<uid>` (uid = `state.activeDoctor.id`, L10170), `togActiva(k)` L10168 fail-open documentado con «el padre manda» (`def.sub`), compuertas v18.6.1-F3 comentadas en los puntos de entrada (L16870, L17097, L26909, L28714, L29707), auto-pintado en Ajustes L36259 y L36473. Default-off reales: `tog_agendar_labs`, `tog_perf_cache`, `tog_perf_informe`. **Lo que la orden pide de NUEVO es la capa de promesas/textos** (guía, hints, recorrido) que no consulta `togActiva` — ver FASE B. |
| (Parte 2) Revocación por médico × función | **YA**: suite_101 (v18.8.1) «PERMISOS POR MÉDICO × FUNCIÓN»: padrón remoto hoja «acceso» + ajustes locales (`on` local tapa `off` remoto), uid por delante del nombre EXACTO normalizado, «centinela» no revocable, guarda D5 (el médico en sesión no se desactiva a sí mismo), capa b/c cortan ejecución y escritura, capa a mantiene VISIBILIDAD (decisión explícita del médico). El hueco de la orden está en los TEXTOS que prometen operación sin contemplar la revocación. |
| (Parte 4) Protocolo para funciones sin consumidor | **YA (protocolo)**: P12 institucionalizado en `docs/SANEAMIENTO.md` (v18.3, 05-sep): veredictos SE QUEDA / ES UN DEFECTO / CUARENTENA / BORRAR; cuarentena = primera línea `uxTrack("zombi.<nombre>")` + ventana de telemetría ≈ 2 semanas antes de borrar; suite_84 fija estructuralmente los marcadores (A-D). Ya hay 3 en cuarentena: `mtrIaClickDelegado`, `mtrIrAPestanaPorNombre`, `_mtrPrimerCampoNumerico` (ver §0.2). La FASE D lo reutiliza sin reinventarlo. |
| (Parte 3) Blindaje de colores y verificación Chromium | **YA (reglas vivas)**: CLAUDE.md §CSS — `!important` en toda regla de color fuera de `#vgl-root`, patrón `:where(...:not([class]))`, verificación contra CSS Everest simulado con harness (`tests/harness.js` + extraer `<style>` real + regla agresiva `div,span,p,b,small,label{color:X !important}`), suite_25 para colisiones internas. La FASE C extiende la cobertura (reglas viejas sin blindar, quietud por defecto) sin duplicar el método. |

## 0.2 Hallazgos anticipados de la cartografía del 08-sep (verificar contra el fuente ANTES de actuar; las líneas son del árbol del 08-sep, 54.511 líneas — si corren, re-grep)

1. **Botón pintado sin listener** — `#vgl-ia-redactar` (L50359) se pinta condicionado a
   `S.iaRedaccion === true && r && r._docId`, pero su manejador `mtrIaClickDelegado`
   (L50368) está en cuarentena P12: `uxTrack("zombi.mtrIaClickDelegado")` con comentario
   «listener sin registro desde v18.0.x — ver docs/SANEAMIENTO.md». Grep del 08-sep: el id
   solo aparece en la pintura y dentro del manejador; **ningún registro de listener lo
   referencia** → botón visible que no hace nada. Decisión esperada D2.
2. **Doble cosecha por tick** — dentro de `tick()` (L37729) hay DOS llamadas a
   `_vglCosecharDePantalla`: L37887 (incondicional, `docId`) y L37907 (`docId2`, solo
   compuertada por `_vglDomEstaSucia`). Mismo DOM barrido por dos caminos en el mismo
   tick (y ahora también por el flush v18.8.8): consolidar en UNA ruta gated por la
   bandera de DOM sucio + el flush — sin duplicar el trabajo de la FASE A del refactor.
3. **Inventario de flujos 1a–1j y grupos de funciones muertas A–D** — según el informe
   del cartógrafo-3 (§5): flujos con líneas exactas, grupos de muertas, pasos
   redundantes y botones pintados sin listener. Si el `.output` llega vacío a la
   ejecución, regenerar (regla R9) — jamás actuar sobre líneas no verificadas.

## 0.3 Arquitectura a respetar (inamovible)

- Un solo archivo IIFE (~54.500 líneas al 08-sep): sin módulos, bundlers ni
  reformateo. PROHIBIDO REFORMATEAR — PR descartado entero.
- Harness `tests/harness.js`: `cargar({gmxhr, almacen, silencioso})`; el API publica
  TODAS las funciones declaradas. Banco: `node tests/runner.js` ≥ 3682 verdes,
  EXIT=0 real (`> log 2>&1; echo EXIT=$?`). El orquestador registra el conteo exacto
  de baseline al arrancar.
- Mutación verificada (romper a propósito → suite roja → restaurar → verde) + fila en
  `tests/INFORME_MUTACIONES.md` por TODO cambio de comportamiento. Bump `@version` +
  `const VERSION` por entrega (localizar TODOS los pares con grep `@version|const VERSION`
  y cualquier suite que fije versión). Acta en `docs/REGISTRO_DECISIONES.md`. CHANGELOG.
- Cero PHI en código, tests, informes, comentarios, commits y PRs. En pruebas, solo
  pacientes ficticios evidentes («PACIENTE DE PRUEBA», cédula `0000000000`). Informes
  redactados antes de adjuntar (regla DIAGNOSTICO).
- CSS fuera de `#vgl-root` con `!important` en colores; verificación Chromium contra
  Everest simulado (CLAUDE.md §CSS, `docs/herramientas/chromium_*.py`).
- No tocar WIP del checkout principal (`_*.txt`, `_pw_profile*/`, `.har`, archivos
  `_audit_*`). Trabajar solo en el worktree ya aislado.

---

# 1. PROPÓSITO Y ALCANCE

## 1.1 La orden del médico (dictado en vivo, 08-sep-2026) — texto íntegro

1. **Deduplicación de código y UI + notificaciones consolidadas**: un solo aviso por
   hecho, sin repeticiones entre piezas.
2. **Adaptación a módulos habilitados por usuario**: que la guía del usuario no
   prometa funciones que su perfil no tiene; alinear la UI a lo que cada médico
   realmente puede usar.
3. **UX cálida no intrusiva**: reducir la fatiga visual del médico en consulta sin
   perder los avisos críticos — jerarquía visual, quietud por defecto, lo crítico
   destaca.
4. **Flujos con criticidad + corrección de corruptos + eliminar inútiles**: inventariar
   flujos, clasificarlos por criticidad clínica, reparar los que estén rotos, eliminar
   los que no aportan.
5. **Informe final + pruebas multi-configuración**: los mismos tests en distintas
   configuraciones de módulos/perfiles.

## 1.2 Alcance

- **Es una auditoría POST-DESARROLLO**: corre sobre el estado actual del worktree
  (refactor v18.8.8 ya aplicado en el árbol), NO rehace sincronización de escritura,
  unicidad de eventos ni permiso-por-médico (ver §0.1) — verifica no-regresión y
  cubre los huecos que esos entregables dejaron.
- Correspondencia orden → fase: parte 1 → FASE A; parte 2 → FASE B; parte 3 → FASE C;
  parte 4 → FASE D; parte 5 → FASE E. Cada fase cierra con su puerta; no se avanza a
  la siguiente sin puerta abierta.
- **Fuera de alcance**: el motor clínico (reglas de riesgo/RCV/orden), el backend de
  VersionCheck.gs (ajeno), PROMPTWARE.md, cambios de arquitectura, y cualquier
  decisión clínica nueva que el médico no haya ordenado (se documenta como pendiente
  en el informe final, sección «decisiones para el médico», sin ejecutarla).

---

# 2. REGLAS DE ORQUESTACIÓN Y PERFILES DE SUBAGENTE

## 2.1 Perfiles del enjambre

| Perfil | Sigla | Rol | Regla de entregable |
|---|---|---|---|
| Orquestador | SA-ORQ | Ejecuta fases EN ORDEN (A→E), serializa conflictos de edición, corre el banco entre fases, decide defaults de la tabla §7 cuando el médico no está. | Log de fases con comando+salida de cada puerta. |
| Cartógrafo | SA-CART | Solo lectura: mapas de código/UI con líneas exactas; regenera insumos perdidos (R9). | Informe con ruta, función, Línea(s) y grep de verificación. |
| Evaluador de criticidad | SA-CRIT | Clasifica flujos/hallazgos con el glosario §6 (severidad clínica). | Tabla hallazgo × severidad × justificación. |
| Deduplicador | SA-DED | Elimina duplicados de código/UI/notificaciones (FASE A). | Por duplicado: par de líneas, veredicto P12, suite que lo fija. |
| UX | SA-UX | Jerarquía visual, quietud por defecto, blindaje CSS (FASE C). | Regla CSS nueva con verificación Chromium adjunta. |
| Corrector | SA-FIX | Repara flujos corruptos y elimina inútiles con protocolo P12 (FASE D). | Por flujo: estado, líneas, mutación ejecutada (rojo→verde). |
| Verificador independiente | SA-V | Re-corre banco y diffs sin haber tocado código; busca PHI y no-regresiones (FASE E). | Acta con comandos exactos; ninguna afirmación sin salida. |

## 2.2 Reglas transversales

- R1 **Una tarea por fase, un agente por tarea.** Los agentes solo-lectura (SA-CART,
  SA-CRIT, SA-V) pueden correr en paralelo entre sí; los que editan (SA-DED, SA-UX,
  SA-FIX) NUNCA en paralelo sobre el mismo archivo — SA-ORQ serializa.
- R2 **Ninguna afirmación de «verificado» sin el comando y su salida adjuntos.**
  NINGUNA línea se cita de memoria: todo hallazgo se re-verifica con grep sobre
  `vigilante_agenda.user.js` al momento de actuar (los números de línea corren).
- R3 **Nunca tocar producción sin prueba**: todo cambio de comportamiento lleva
  suite que lo fija + mutación verificada (rojo → restaurar → verde) + fila en
  `tests/INFORME_MUTACIONES.md`. El orquestador corre `node tests/runner.js` tras
  CADA fase; si cae algo ajeno a la fase, lo reporta y no avanza.
- R4 **El médico manda, el script sugiere**: nada se elimina, se oculta ni se
  reordena porque «se ve mejor» — solo por hallazgo verificado (duplicado real,
  zombie con ventana de telemetría, defecto con prueba). La casilla del médico es
  sagrada: ninguna fase toca escritura de campos del médico.
- R5 **Cero PHI**: en código, tests, informes, commits y PRs. Ejemplos ficticios
  evidentes («PACIENTE DE PRUEBA»). Informes que adjunten trazas: redactar antes.
- R6 **La UI no se mezcla con Everest** (CLAUDE.md §CSS): regla de color nueva fuera
  de `#vgl-root` lleva `!important`; texto suelto con el patrón `:where(...:not([class]))`;
  verificación Chromium contra CSS Everest simulado en toda regla de color nueva.
- R7 **Conflicto de fases sobre el mismo rango**: FASE A (dedupe de código) y FASE D
  (eliminar inútiles) solapan en funciones muertas — A inventaría y deduplica pares
  paralelos; D consume el inventario de A y ejecuta eliminaciones con protocolo P12
  (D no elimina nada que A haya marcado «en uso»). FASE B (textos/promesas) y FASE C
  (UX) conviven: **C no cambia copia prometedora; B no cambia estilos ni jerarquía**.
  FASE E no edita código salvo el bump de cierre.
- R8 **«YA EXISTE»**: si un hallazgo de la orden ya está resuelto (§0.1), se verifica
  con su suite, se documenta «YA EXISTE (§0.1)» en el informe final y NO se duplica
  trabajo. Si está resuelto SOLO EN PARTE, la fase cubre exactamente el hueco.
- R9 **Insumo faltante**: si un informe de cartografía (§5) está vacío o ausente al
  ejecutar (ocurrió con los `.output` del 08-sep), el agente que lo consume lo
  regenera con un barrido de solo lectura (≤ 15 min) ANTES de proponer, y anota la
  regeneración en el informe de fase. Nunca se actúa sobre líneas no verificadas.
- R10 **Entrega de cada subagente**: informe estructurado (ruta de archivo, función,
  líneas exactas, veredicto, acción, suite que lo fija, mutación con comandos) —
  nunca un resumen libre sin líneas. Cero PHI en el informe.
- R11 **Duda con el médico fuera**: aplicar el default conservador de la tabla §7,
  anotar la decisión como «a confirmar por el médico» en el informe final y NO
  avanzar sobre zonas que el default no cubra.
- R12 **Trabajo en el worktree ya aislado**: sin git add/commit/push por parte de los
  subagentes (lo hace el orquestador al cerrar cada fase, con mensajes que citan
  fase y hallazgos). No tocar WIP del checkout principal.

---

# 3. FASES CON PUERTAS

## FASE A — Deduplicación de código y UI + notificaciones consolidadas (parte 1 de la orden)
**Agentes**: SA-CART (inventario) + SA-DED (aplicación). SA-ORQ serializa con D.
**Objetivo**: un solo aviso por hecho, una sola implementación por servicio, cero
elementos de UI sin efecto.
**Alcance**:
- A.1 **Código duplicado**: con el informe del cartógrafo-3 (§5) y grep propio,
  inventariar pares de funciones/constantes que implementan lo mismo (precedente
  real P12: `PYM_SIN_ACT_MOTIVOS` duplicaba literales que la función devuelve en
  línea — se borró con comentario re-hospedado). Consolidar la **doble cosecha por
  tick** (L37887 incondicional + L37907 compuertada en `tick()` L37729) en UNA ruta
  gated por `_vglDomEstaSucia()` + flush v18.8.8, sin duplicar el trabajo de la
  suite_104. Veredictos P12 para cada candidato (SE QUEDA / ES UN DEFECTO /
  CUARENTENA / BORRAR) con la evidencia del grep.
- A.2 **UI duplicada o muerta**: elementos pintados cuyo listener no existe
  (`#vgl-ia-redactar` L50359 → decisión D2), ids duplicados en el DOM inyectado,
  dos piezas que pintan el mismo dato (docId/tensión/programa) en el mismo
  contenedor, funciones que re-pintan innerHTML completo sin firma de cambio.
- A.3 **Notificaciones consolidadas**: suite_103 ya fija el canal de EVENTOS
  (una fila de auditoría por (evento, cita, día), aislamiento entre pestañas).
  Esta fase fija el canal de PRESENTACIÓN: mapa canónico tipo-de-hecho → UNA
  pieza primaria (p. ej. banner de conducta) y las demás callan o enlazan; un
  hecho crítico puede tener refuerzo SOLO si es el mismo hecho (misma severidad,
  mismo origen) y el refuerzo no repite el texto completo. Prohibido debilitar
  los candados de suite_103.
- A.4 Entregable: tabla duplicado × líneas × veredicto × suite que lo fija.
**Puerta**: suite nueva `tests/suite_105_dedupe.js` ≥ 6 casos (un caso por
duplicado consolidado + mapa canónico de presentación) + mutación ≥ 2 + suites
84/103/104 intactas + banco completo EXIT=0 real.

## FASE B — Adaptación a módulos habilitados por usuario (parte 2 de la orden)
**Agentes**: SA-CART + SA-FIX (perfil configuración/permisos).
**Objetivo**: nada en la UI promete una función que el perfil del médico no tiene;
toda puerta real (toggle/permiso) tiene su compuerta en los puntos de entrada.
**Alcance**:
- B.1 **Matriz módulo × estado**: para cada módulo de `VGL_TOGGLES` (L10154: agendar,
  agendar_labs, pacientes, laboratorios, notif, anexo5, hc_chip, perf_cache,
  perf_informe) y cada función revocable de suite_101: toggle (default), permiso
  (caps), compuerta de entrada (línea), y textos que prometen la función. Los dos
  mecanismos conviven y NO se fusionan: el toggle decide si el módulo EXISTE para
  el doctor; el permiso decide si una función revocada se ejecuta (la visibilidad
  se mantiene por decisión del médico — suite_101 capa a).
- B.2 **Guía y promesas**: inventariar TODO texto que afirme disponibilidad
  incondicional: recorrido/onboarding de primera vez («leyenda de colores», L37591+),
  hints y labels de Ajustes (L36259+), textos de botones del dock y del panel,
  README/empaquetado si prometen funciones. Toda promesa consulta `togActiva(k)`
  (y el estado de permiso) antes de mostrarse: módulo apagado → la promesa no se
  muestra; función revocada → se ve (capa a) pero su copia dice «Bloqueada por la
  configuración de su equipo», nunca promete operación.
- B.3 **Huecos de compuerta**: vías de entrada que evaden la compuerta del punto
  principal (atajos de teclado, menús contextuales, reintentos del tick, flujos
  encadenados que llaman a un módulo apagado — p. ej. agendar → solo-labs
  `openLabSoloModal` L29708): la misma `togActiva` del punto de entrada gobierna
  todas sus vías. Sin cambiar defaults ni inventar toggles nuevos (regla memoria:
  todo toggle nuevo se registra en `VGL_TOGGLES` y se pinta solo — y su default es
  conservador).
- B.4 **Perfiles de prueba**: definir 3 perfiles simulados (TODO activo / defaults
  de fábrica con default-off / revocado con permiso de suite_101 + toggle padre
  apagado) que la FASE E reutiliza para multi-configuración.
**Puerta**: suite_101 ampliada o suite nueva ≥ 6 casos sobre la matriz
(visible/ejecuta/guía por perfil simulado, sin pisar capa a) + mutación ≥ 2 +
banco completo EXIT=0 real.

## FASE C — UX cálida no intrusiva (parte 3 de la orden)
**Agentes**: SA-UX + SA-V (verificación Chromium).
**Objetivo**: menos fatiga visual en consulta; quietud por defecto; lo crítico
destaca; cero regresiones de color contra Everest.
**Alcance**:
- C.1 **Inventario de estímulos**: animaciones, parpadeos, badges que titilan,
  cambios de color periódicos, leyenda de colores del onboarding (L37591+),
  repintados completos — clasificados con el glosario §6. Lo NO crítico nace
  quieto (estado reposo: sin animación, sin destello, sin cambio de color
  periódico). Lo crítico (severidad clínica CRÍTICA/ALTA de §6) es la ÚNICA
  categoría que puede romper la quietud — y por el canal primario de A.3.
- C.2 **Jerarquía visual**: un solo nivel de urgencia visual por hecho (sin
  dobles refuerzos de color/texto en piezas distintas); contraste AA sobre las
  superficies reales; `prefers-reduced-motion` respetado en lo animado que
  sobreviva.
- C.3 **Blindaje CSS (regla CLAUDE.md)**: auditar reglas de color EXISTENTES en
  paneles pegados a `document.body` (`#vgl-pym-modal`, `#vgl-pes-modal`,
  `#vgl-labs-modal`, `#vgl-labsv-modal`, `#vgl-postcita-panel`, `#vgl-agendar-modal`,
  `#vgl-ordenar-modal`) que hoy dependen solo de clase sin `!important` → blindar.
  Toda regla de color NUEVA lleva `!important` y verificación Chromium contra CSS
  Everest simulado (harness → extraer `<style>` real → montar con regla agresiva
  `div,span,p,b,small,label{color:X !important}` → el color esperado sobrevive).
- C.4 Cuidado de frontera: C no cambia textos de promesa (eso es FASE B) ni
  elimina flujos (FASE D).
**Puerta**: suite_107_ux ≥ 5 casos (quietud por defecto: lo crítico no nace
quieto y lo demás sí; canal primario único; reglas nuevas con `!important`) +
verificación Chromium de cada regla nueva con salida adjunta + mutación ≥ 1 +
banco completo EXIT=0 real.

## FASE D — Flujos: criticidad + corrección de corruptos + eliminación de inútiles (parte 4 de la orden)
**Agentes**: SA-CRIT (clasificación) + SA-FIX (corrección/eliminación). Consume el
inventario de A.
**Objetivo**: inventario de flujos clasificado por criticidad clínica; los rotos
reparados en orden de criticidad; los inútiles eliminados por protocolo.
**Alcance**:
- D.1 **Inventario y criticidad**: flujos 1a–1j del informe del cartógrafo-3 (§5),
  re-verificados contra el fuente, con estado (sano / roto / inútil) y las suites
  que los ejercitan. Clasificación clínica según §6 (CRÍTICO: altera cita, orden,
  riesgo o seguridad del paciente; ALTO: pierde trabajo del médico o corrompe lo
  escrito; MEDIO: degradado con vía alternativa; BAJO: cosmético; INÚTIL: sin
  consumidor real). «Corrupto» = promete una cosa y hace otra (no solo estético).
- D.2 **Corrección por criticidad** (CRÍTICO y ALTO primero, nunca en paralelo con
  A sobre el mismo rango): p. ej. doble cosecha por tick consolidada (si A no la
  cerró), defectos tipo `_cancelPlantillaBorrar` (veredicto P12: «ES UN DEFECTO —
  la limpieza nunca se ejecuta»), pasos redundantes del inventario 1a–1j. Cada
  corrección con mutación verificada y fila en INFORME_MUTACIONES.
- D.3 **Eliminación de inútiles con protocolo P12**: marcado `uxTrack("zombi.*")`
  + ventana de telemetría ≈ 2 semanas → borrado con marca estructural y suite_84
  actualizada. Prohibido borrar lo que una suite ejercita sin migrar la suite
  (veredicto SE QUEDA). Los zombies ya marcados (P12: `mtrIaClickDelegado`,
  `mtrIrAPestanaPorNombre`, `_mtrPrimerCampoNumerico`) entran en la ventana de
  decisión de esta fase.
- D.4 Entregable: tabla flujo × criticidad × estado × acción final × suite que lo
  fija; los flujos INÚTILES «decisión del médico» (duda real sobre si aporta en
  su práctica) NO se borran: se listan en el informe final con default
  conservador (D5).
**Puerta**: cada flujo CRÍTICO/ALTO tocado con suite + mutación; eliminaciones
con acta de cuarentena; ninguna suite preexistente enrojeció; banco completo
EXIT=0 real.

## FASE E — Informe final + pruebas multi-configuración + verificación independiente (parte 5 de la orden)
**Agentes**: SA-ORQ + SA-V.
**Objetivo**: los MISMOS tests en distintas configuraciones de módulos/perfiles;
informe final trazable; entrega con acta.
**Alcance**:
- E.1 **Matriz multi-configuración**: los 3 perfiles simulados de B.4 × variantes
  (con/sin `iaRedaccion`, sub-toggles default-off, `tog_notif` apagado, modo
  silencioso) ejecutando las MISMAS suites. Mecánica: precarga de almacén/estado
  por configuración (mapas `vgl_tog_<uid>` + padrón «acceso» mockeado) con
  re-carga del harness por configuración (patrón `cargar()` ya usado por suites que
  re-cargan). Si el runner necesita soporte (p. ej. `--config`), acotar el cambio
  al mínimo; alternativa aceptable: suite dedicada que recarga el harness N veces.
  Toda suite que asuma un módulo encendido pasa a ser config-aware (skip
  DOCUMENTADO cuando el módulo está apagado en esa configuración — nunca ocultar
  un rojo real). El banco default (sin configuración) debe seguir EXIT=0.
- E.2 **Informe final** `AUDITORIA/INFORME_AUDITORIA_POSTDESARROLLO_20260908.md`:
  por hallazgo → severidad (§6), líneas exactas, acción, suite, mutación; sección
  «YA EXISTE (§0.1)»; sección «decisiones para el médico» (todo lo que quedó con
  default conservador, sin ejecutar); sección deuda con severidad.
- E.3 **SA-V independiente**: re-corre el banco completo y la matriz de E.1; revisa
  el diff contra el alcance de cada fase; barrido de PHI (patrones de cédula/
  nombre real en código nuevo, informes, commits); confirma que ninguna suite
  preexistente enrojeció (baseline registrado al arrancar).
- E.4 **Entrega**: bump final `@version` + `const VERSION` (tercer componente +1
  sobre el encabezado real al momento de cerrar; localizar con grep TODOS los
  pares y suites que fijan versión), filas de INFORME_MUTACIONES, acta en
  `docs/REGISTRO_DECISIONES.md`, CHANGELOG, commit de cierre. Publicación de gist
  SOLO si la entrega de la auditoría incluye distribución (decisión D11).
**Puerta**: banco final EXIT=0 real + matriz multi-configuración con salidas
adjuntas + informe final entregado + checklist §4 completo + acta en REGISTRO.

---

# 4. CHECKLIST DE CIERRE (SA-ORQ marca al terminar)

- [ ] §0.1 verificado: los «YA EXISTE» se cerraron con su suite, sin rehacer.
- [ ] FASE A: tabla de duplicados con líneas + suite_105 verde + mutaciones ≥ 2.
- [ ] FASE B: matriz módulo × toggle × permiso × guía; ninguna promesa incondicional
      (grep de textos de promesa con perfil simulado apagado).
- [ ] FASE C: inventario de estímulos; quietud por defecto; reglas nuevas con
      `!important` + salida Chromium adjunta.
- [ ] FASE D: tabla flujo × criticidad × acción; corruptos CRÍTICO/ALTO reparados
      con mutación; eliminaciones con acta P12.
- [ ] FASE E: matriz multi-configuración con salidas; informe final en
      `AUDITORIA/INFORME_AUDITORIA_POSTDESARROLLO_20260908.md`; verificación
      independiente (SA-V) firmada.
- [ ] Mutaciones totales ≥ 8, todas transcritas en `tests/INFORME_MUTACIONES.md`
      (rojo → restaurar → verde).
- [ ] Ninguna suite preexistente enrojeció (comparar contra baseline ≥ 3682).
- [ ] Cero PHI (barrido de patrones en código nuevo, informes y commits).
- [ ] Bump de versión por entrega y final; acta en `docs/REGISTRO_DECISIONES.md`;
      CHANGELOG al día.
- [ ] Sección «decisiones para el médico» del informe: cada ítem con su default
      conservador aplicado y la pregunta exacta que el médico debe responder.

---

# 5. REFERENCIAS E INSUMOS

## 5.1 Informes de cartografía del 08-sep (consumir como insumo — citar por ruta en informes de fase)

| Ruta | Cartógrafo | Qué aporta | Lo consume |
|---|---|---|---|
| `C:\Users\brand\AppData\Local\Temp\claude\E--CENTINELA-vigilante-agenda-everest\60f8f919-92e4-4991-8e1f-ff047fa85386\tasks\aa9426807c072d4ac.output` | Cartógrafo 1 | Configuración/toggles del script: `VGL_TOGGLES`, mapas `vgl_tog_<uid>`, `vgl_cfg`, permisos/padrón «acceso», flags por doctor (`iaRedaccion` y análogos). | §0, FASE B |
| `C:\Users\brand\AppData\Local\Temp\claude\E--CENTINELA-vigilante-agenda-everest\60f8f919-92e4-4991-8e1f-ff047fa85386\tasks\ab30332e07e5571cf.output` | Cartógrafo 2 | Notificaciones/UI: canales de aviso, piezas de UI que anuncian hechos, textos de promesa/guía, onboarding. | FASE A.3, FASE B.2, FASE C.1 |
| `C:\Users\brand\AppData\Local\Temp\claude\E--CENTINELA-vigilante-agenda-everest\60f8f919-92e4-4991-8e1f-ff047fa85386\tasks\aef8eec575ba2eb46.output` | Cartógrafo 3 | Flujos y funciones muertas: inventario de flujos 1a–1j con líneas, grupos de funciones muertas (A–D), pasos redundantes, botones pintados sin listener, doble cosecha por tick. | FASE A.1/A.2, FASE D.1 |

Regla R9: si al ejecutar un `.output` está vacío o ausente (los del 08-sep llegaron
vacíos al entorno de redacción de este documento), el agente que lo consume lo
regenera con un barrido de solo lectura ANTES de proponer y anota la regeneración.
Ningún hallazgo se da por cierto por estar escrito: todo se re-verifica contra el
fuente con grep al momento de actuar.

## 5.2 Documentos del repo

- `CLAUDE.md` — reglas no negociables (casilla vacía, médico manda, cero PHI, CSS,
  disciplina de pruebas).
- `docs/SANEAMIENTO.md` — protocolo P12 y veredictos (SE QUEDA / ES UN DEFECTO /
  CUARENTENA / BORRAR) con el precedente de las 24 funciones.
- `tests/suite_103_unicidad_notificaciones.js` y `tests/suite_104_sync_escritura.js`
  — fijan lo ya entregado del refactor (no rehacer; no-regresión).
- `tests/suite_101_permisos.js` — permisos por médico × función (capas a/b/c, D5).
- `tests/suite_84_saneamiento.js` — fija estructuralmente los marcadores de
  saneamiento A–D.
- `SUPERPROMPT_ORQUESTADOR_REFACTOR_INTEGRAL_20260908.md` — encargo hermano del que
  esta auditoría es la fase post-desarrollo.

---

# 6. GLOSARIO DE SEVERIDADES

| Severidad | Definición | Regla de trato |
|---|---|---|
| CRÍTICA (clínica) | Afecta cita, orden, riesgo o seguridad del paciente si falla o se omite | Única categoría que rompe la quietud por defecto (FASE C); se repara primero (FASE D); mutación obligatoria. |
| ALTA | Pierde trabajo del médico o corrompe lo que escribió a mano (nunca pisar casilla llena) | Se repara en el mismo lote que CRÍTICA; prohibido tocar escritura de campos del médico. |
| MEDIA | Función degradada con vía alternativa usable | Se repara si el alcance lo permite; si no, deuda documentada con severidad. |
| BAJA | Cosmética, rendimiento menor, texto confuso sin impacto clínico | Se documenta; se aplica solo si la fase ya está abierta en esa zona. |
| INÚTIL / zombie | Sin consumidor real o listener nunca registrado | Protocolo P12: cuarentena `uxTrack("zombi.*")` → ventana de telemetría ≈ 2 semanas → borrado con marca estructural. |
| DEFECTO | Promete una cosa y hace otra (p. ej. limpieza que nunca corre) | Se repara con prueba que falle antes y pase después (mutación). |
| PHI / privacidad | Fuga potencial de nombre, cédula o dato identificable | Cero tolerancia: se redacta o elimina en el acto, mutación + informe sin PHI. |

---

# 7. TABLA DE DECISIONES ESPERADAS (pregunta corta → decisión con default conservador cuando el médico esté fuera)

| # | Pregunta | Decisión esperada (default conservador en negrita) |
|---|---|---|
| D1 | ¿Función muerta sin llamador y sin telemetría? | **Cuarentena P12 `uxTrack("zombi.*")` + ventana ≈ 2 semanas**; borrado solo tras ventana con telemetría cero y suite estructural actualizada. |
| D2 | ¿Botón pintado sin listener (`#vgl-ia-redactar` L50359 / `mtrIaClickDelegado` P12)? | Si la función destino existe y está probada (`mtrAbrirPanelRedaccion`, `mtrCacheResumenLeer` vivos): **registrar el listener + suite que lo fija** (y retirar la marca zombie). Si la función ya no existe: quitar el botón. NUNCA dejar un botón visible sin efecto. |
| D3 | ¿Dos piezas de UI anuncian el mismo hecho? | **Una sola vía canónica por tipo de hecho** (mapa canónico de A.3): se conserva la pieza de mayor jerarquía visual; las demás callan o enlazan sin repetir texto. |
| D4 | ¿Dos implementaciones del mismo servicio (p. ej. doble cosecha por tick L37887/L37907)? | **Consolidar en una sola ruta** gated por la bandera de DOM sucio + flush v18.8.8, con mutación que rompa la prueba si se reintroduce la segunda ruta. |
| D5 | ¿Flujo sin aporte claro pero con duda de práctica clínica? | **No se borra**: se lista en «decisiones para el médico» del informe final con su criticidad, líneas y costo de mantener. |
| D6 | ¿Función prometida por la guía pero módulo apagado en ese perfil? | **La promesa consulta `togActiva(k)`** y no se muestra si el módulo no existe para ese doctor (la guía se pliega a la realidad del perfil). |
| D7 | ¿Función revocada por permiso (suite_101, capa b/c)? | **Se mantiene visible (capa a, decisión del médico) con copia «Bloqueada por la configuración de su equipo»**; nunca promete operación. |
| D8 | ¿Toggle nuevo necesario? | **Registrarse en `VGL_TOGGLES`** (auto-pintado en Ajustes L36259/L36473) con `defecto` conservador (apagado si duda) — jamás toggle invisible o hardcodeado fuera del registro. |
| D9 | ¿Regla de color nueva fuera de `#vgl-root`? | **`!important` + verificación Chromium contra CSS Everest simulado** (CLAUDE.md §CSS); regla vieja sin blindar en esa zona → blindarla en FASE C. |
| D10 | ¿Duda sobre el comportamiento deseado por el médico? | **No actuar**: casilla vacía antes que dato inventado; documentar la pregunta exacta en «decisiones para el médico». |
| D11 | ¿Publicar gist de la entrega? | **Solo si la entrega de la auditoría incluye distribución** (flujo de publicación vigente según memoria/`docs/EMPAQUETADO.md`); si publica: verificado byte a byte (SHA-256) y acta. Default: commit + acta local. |
| D12 | ¿Hallazgo que ya está resuelto? | **«YA EXISTE (§0.1)»**: verificar con su suite y cerrar — nunca duplicar trabajo ni tocar lo fijado. |
| D13 | ¿Insumo de cartografía vacío o ausente al ejecutar? | **Regenerarlo con barrido de solo lectura (≤ 15 min) y anotarlo en el informe de fase** (R9) — nunca actuar sobre líneas no verificadas. |

---

# 8. CIERRE DE HALLAZGOS «YA EXISTE»

Un hallazgo que la orden anticipa pero el estado real ya resuelve se cierra así:

1. Citar la fila de §0.1 que corresponde (o añadirla si el hallazgo es nuevo y se
   verificó resuelto con suite existente).
2. Correr la suite que lo fija y adjuntar la salida.
3. Registrar en el informe final: «YA EXISTE — verificado con suite_NN, sin
   cambios» (una línea por hallazgo, con severidad si aplica).
4. NO rehacer, NO «mejorar», NO tocar. Si la suite no existe, entonces NO es
   «YA EXISTE»: es un hueco real y pertenece a su fase.
