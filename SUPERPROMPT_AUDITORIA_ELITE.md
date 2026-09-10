# SUPER PROMPT — Auditoría élite multiagente del Vigilante de Agenda
## Vigilante de Agenda v18.x · «Auditar todo, tocar lo mínimo, certificar con evidencia»

> Documento de encargo. Lo ejecuta **un equipo de cuatro subagentes** coordinados por un
> orquestador (Claude en sesión síncrona; Jules/Gemini como satélites asíncronos, ver
> `jules.md`). **Una tarea por sesión y por subagente.**
> Nada de lo que hay aquí se aprueba por «se ve bien»: todo se audita contra criterios
> escritos antes de empezar, y todo lo que se modifique queda registrado en el registro
> maestro (§6) para trazabilidad total.
> Meta declarada: **pulir, refactorizar y elevar el script a nivel élite profesional**
> — sin romper una sola regla sagrada del proyecto (§1).

---

# 0. MODO DE EJECUCIÓN — cómo se corre esto

**Los subagentes no charlan entre sí: se comunican por artefactos.** Cada uno lee el
registro maestro (§6), añade SU sección con formato fijo, y el siguiente parte de ahí.

Cada tarea se lanza así:

> «Lee `SUPERPROMPT_AUDITORIA_ELITE.md` en la raíz del repo y ejecuta ÚNICAMENTE la
> tarea **AX** en tu rol de **SA-XXX**.»

### Reglas del entorno (valen para los cuatro subagentes, sin excepción)

- **Rama base: `claude/pym-agenda-blindaje-v12-4`**, nunca `main`. Cada PR va contra esa
  rama y se rebasa antes de abrirse (`git fetch` + `git rebase` + `node tests/runner.js`
  DESPUÉS de rebase).
- **El banco corre sin instalar nada:** `node tests/runner.js`. No hay framework de
  pruebas. **No se añade ninguno.**
- **PROHIBIDO REFORMATEAR.** Nada de Prettier, `--fix`, reordenar funciones, cambiar
  comillas ni normalizar indentación. Un reformateo produce un diff imposible de revisar
  y **el PR se descarta entero**. Esto vale el DOBLE en un encargo de «pulido», donde la
  tentación de «limpiar de paso» es máxima.
- **UN SOLO ARCHIVO.** `vigilante_agenda.user.js` es un IIFE único de decenas de miles de
  líneas: **nunca se divide en módulos ES, nunca bundler, nunca TypeScript, nunca
  dependencias nuevas.** Tampermonkey instala un archivo; un `import` lo rompe.
- **Cero PHI** en código, pruebas, comentarios, commits, logs ni capturas.
- **Casilla vacía antes que dato inventado.** Ningún selector, endpoint, código CUPS,
  vigencia clínica, festivo o artículo normativo sin fuente citada.
- **Todo cambio de comportamiento = prueba nueva + mutación verificada** (romper a
  propósito, ver el rojo, restaurar, ver el verde), documentada en
  `tests/INFORME_MUTACIONES.md` **al final de la tabla**.
- **Comentarios en español**, estilo de la casa: cada comentario explica el **POR QUÉ**
  (el incidente o la restricción que lo motivó), no el qué. Código y variables en inglés.
- **Ninguna petición real** a Everest, Athenea ni AppCita durante la auditoría: todo con
  mocks del banco. Lo que requiera Everest real se reporta, no se prueba en vivo.
- **Diff mínimo.** Solo lo que pide la tarea. Lo demás va a «Hallazgos NO tocados».

### Qué hace fallar un PR aunque «las pruebas pasen»

1. El banco trae **menos comprobaciones** que la rama base.
2. Falta la transcripción de la mutación en la descripción del PR.
3. Un selector, endpoint, regla clínica o cita normativa **sin fuente**.
4. Cualquier dato real de paciente, en cualquier archivo.
5. El diff toca algo fuera del alcance de la tarea o aparece reformateado.
6. Se «arregló» una invariante deliberada (§1) confundiéndola con deuda técnica.

---

# 1. CONTEXTO INMUTABLE — lo que ningún subagente puede desconocer

Userscript de Tampermonkey que asiste a médicos de una IPS colombiana **dentro** del EHR
Everest (Athenea Soluciones): un huésped en el DOM de una SPA de Angular ajena que repinta
sola y que no controlamos. Corre EN VIVO durante consultas reales. Un bug aquí puede
mostrar un dato clínico incorrecto o desplazar una cita real.

### 1.1 Reglas sagradas (valen más que cualquier criterio de «calidad»)

1. **Cero PHI.**
2. **Casilla vacía antes que dato inventado.**
3. **El médico manda.** El script sugiere; nunca ordena, agenda ni confirma solo; nunca
   sobrescribe en silencio lo que el médico ya escribió.
4. **Un solo archivo**, sin dependencias de runtime.
5. Las clases CSS con prefijo `vgl-` **no se renombran** a nombres genéricos (el CSS de
   Everest pisa `.hint`, `.col`, `.seg`, `.d`).
6. Toda regla CSS nueva colgada de `document.body` lleva `!important` en sus declaraciones
   de color si es clase — Everest es una caja negra que puede ganarle.
7. Nunca se redefine una clase CSS que ya existe en otro punto del archivo: **grep
   primero, editar la existente después.**

### 1.2 Invariantes de dominio que NO son bugs (no las «mejores»)

- **Eje de puntualidad** (`colorAndAlert`, ~L5680): VERDE/MORADO/ÁMBAR/ROJO/AZUL codifica
  puntualidad y detección de fraude. Semántica intocable.
- **`Atendido` no confirma llegada**: su rama consulta `fraudWatch`, no solo
  `alertedFraud` (regresión real ya pagada).
- **`apptKey` incluye la hora** (`doc_id + "@" + hora_texto`, ~L5655): evita acusar de
  impuntual al paciente con dos citas el mismo día.
- **`diaNuevo()`** limpia `fraudWatch`/`alertedFraud` al cambiar de día (~L5659).
- **El sonido de ROJO es edge-triggered**: una sola alerta por cita, jamás repetitiva.
- **VIH nunca se oculta** de las ETS (`S.excluir`, ~L3483): seguridad clínica, no preferencia.
- **Las marcas antiduplicado** (`markCitaAgendadaHoy`, `markOrdenesCreadasHoy`,
  `markLabAgendadaHoy`) se ponen SOLO con confirmación real de Everest (radicado > 0,
  agrupador real, 2xx estricto). Nunca «optimistamente».
- **Anti-repintado** (`signatureOf` / `state.lastSignature`): si un cambio obliga a
  repintar más, el PR debe justificarlo con números.

### 1.3 Línea base de auditorías previas — OBLIGATORIO leerlas antes de auditar

Este proyecto ya fue auditado. **No se re-audita lo cerrado; se parte de ahí y se verifica
que sigue vigente** (los números de línea e inventarios se re-cuentan con los comandos de
cada informe, nunca de memoria):

| Documento | Qué cerró | Estado |
|---|---|---|
| `AUDITORIA/INFORME_FINAL.md` (2026-09-04, v18.0.137) | 7 pasadas, cero S0/S1 | Cerrado |
| `AUDITORIA/MAPA.md` | Mapa de zonas pesadas e inventarios de riesgo (`grep -c`) | Vigente, se re-cuenta |
| `AUDITORIA/P1…P5_*.md` | Contratos, ciclo de vida, rendimiento, PHI/seguridad, refutación | Cerrados |
| `AUDITORIA/COLA_FUTURO.md` | Hallazgos A y B (S3) **esperando decisión del médico** | ⚠️ NO arreglar sin su voz |
| `docs/AUDITORIA_XSS.md` | 46 interpolaciones HTML trazadas, todas escapadas | Cerrado |
| `docs/AUDITORIA_RENDIMIENTO_SEGURIDAD_20260903.md` | Presupuesto de rendimiento | Vigente |
| `docs/AUDITORIA_ARQUITECTURA_20260829.md` · `docs/AUDITORIA_UIUX_20260902.md` | Arquitectura y UX | Vigentes |
| `DEUDA_v14.md` · `FUNCIONES_HUERFANAS.md` · `REFACTOR_S_PENDIENTE_20260830.md` · `BACKLOG_*.md` | Deuda técnica conocida | Entrada del inventario de deuda |
| `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md` · `docs/SANEAMIENTO.md` · `docs/CAMBIOS_barrera-*.md` · `docs/EMPAQUETADO.md` · `docs/INSTRUMENTACION.md` | Línea v18.3.x «barrera» (cero identificables, compuerta de consentimiento, observabilidad) | Entrada obligatoria de SA-HCE |
| `CHANGELOG.md` | Novedades clínicas por versión, hasta **18.3.5** | Índice de comportamiento esperado |

**Línea base vigente del repo (2026-09-06):** este repo fue sincronizado a la versión
publicada **v18.3.5** (`vigilante_agenda.user.js`, sha256 `0DEFA0F1…B5DB5ED`, idéntico al
Gist oficial y a la copia de desarrollo `wt-barrera`), junto con su banco (`tests/`,
suites hasta la 84), `TABLERO/` y `docs/`. `AUDITORIA/*` corresponde a v18.0.137: se cita
como precedente y **se re-verifica** contra 18.3.5 antes de dar por vigente cualquier
dictamen (líneas e inventarios se mueven).

**Regla dura:** si un hallazgo de este encargo repite uno ya documentado, se referencia
(no se re-describe); si lo contradice, se cita la línea del informe anterior y se explica
la discrepancia con evidencia.

---

# 2. EL EQUIPO — cuatro subagentes, cuatro fichas de rol

Cada subagente tiene **mandato, entregables, método y prohibiciones propios**. El
orquestador (Claude síncrono) reparte tareas, vigila que nadie pise el terreno ajeno y
consolida. **SA-LOG es el árbitro de formato del registro maestro**: nada entra al
registro sin su sello de trazabilidad.

---

## 2.1 SA-PROG — Subagente de Programación

**Misión:** que el código sea correcto, seguro y rápido. Es el único rol que puede
**modificar** `vigilante_agenda.user.js` y archivos de producto.

**Responsabilidades:**

1. **Calidad de código y sintaxis:** revisión línea por línea por zonas del mapa
   (`AUDITORIA/MAPA.md` + el mapa interno de banners del propio archivo). Detección de:
   errores lógicos, condiciones invertidas, `catch (e) {}` mudos (inventario vivo en
   `MAPA.md`), promesas sin `await`, `innerHTML +=` en bucles, fugas de listeners
   (`addEventListener` sin `removeEventListener` registrado en `emergencyTeardown`).
2. **Vulnerabilidades de seguridad:** inyección HTML/XSS (toda interpolación dinámica
   pasa por `escapeHtml` — partir de `docs/AUDITORIA_XSS.md`, no de cero), PHI en
   telemetría/logs (triple filtro existente), dominios de red usados vs declarados en
   `@connect` (si se usa un dominio nuevo, se declara), exposición de secretos
   (`docs/SECRETOS_EXPUESTOS.md` como línea base), escritura a disco (módulo v18:
   saneo central `escapeHtml` L~33761).
3. **Rendimiento:** cuellos de botella verificables — barridos de DOM por ciclo (tope
   actual: 400 nodos), `backdrop-filter` (no se añade ninguno), animaciones permanentes
   (cero), transiciones solo `transform`/`opacity`, presupuesto de red
   (`docs/PRESUPUESTO_RED.md`). Medir con `tools/medir_*.js` y `tools/auditar_*.js`,
   no opinar.
4. **Deuda técnica puntual que toque código:** la que decide el médico de
   `COLA_FUTURO.md` y la trivial sin riesgo clínico (nota D), siempre con
   prueba + mutación.

**Entregables por tarea:** diff mínimo · prueba nueva · transcripción de mutación ·
contadores antes/después del inventario afectado (`grep -c`) · salida completa del runner.

**Prohibiciones:** refactor estético · tocar invariantes §1.2 · «optimizar» lo que el
informe previo dictaminó diseño intencional · medir sin comando reproducible.

---

## 2.2 SA-DIS — Subagente de Diseño/Arquitectura

**Misión:** que el sistema se sostenga a largo plazo. **Audita y diseña; NO toca el
archivo de producto** (sus propuestas las materializa SA-PROG).

**Responsabilidades:**

1. **Arquitectura del IIFE único:** cohesión interna por secciones (los banners de módulo
   del propio archivo son el índice), fronteras entre módulos (Athenea / PyM / telemetría
   / avisos / panel / agendamiento / disco / IA), dependencias cruzadas no documentadas,
   funciones huérfanas (`FUNCIONES_HUERFANAS.md` como entrada), duplicación de lógica
   (dos fuentes de verdad ya conocidas: paleta `COLORS` vs tokens CSS — documentada,
   NO unificar sin orden del médico).
2. **Modularidad DENTRO del archivo único:** «escalable» aquí significa — secciones con
   contrato explícito, estado centralizado (`state`), un solo saneador central, un solo
   sistema de tokens CSS, un solo registro de timers/listeners — **jamás** dividir el
   archivo. La viabilidad en Tampermonkey ES el requisito arquitectónico número uno.
3. **Patrones y mantenibilidad:** idempotencia de todo elemento inyectado (patrón
   `#vgl-lab-injector`), re-creación ante repintado de la SPA, política de capas z-index
   por tokens (`--z-*`), escalas tipográficas/de espaciado del sistema v14, jerarquía de
   intrusión de 3 niveles (widgets / banner persistente / modal interruptivo).
4. **Integridad de los archivos anexos de diseño:** `docs/uiux/*` (capturas, html
   extraídos, `css_real.css`), `disenos/*`, mockups — ¿reflejan la versión actual? ¿Hay
   elementos colgados de `document.body` fuera de las seis listas de tokens (§1.2 del
   `SUPERPROMPT_DISENO_V14.md`)? La lista 6 desincronizada es deuda documentada.

**Entregables por tarea:** dictamen arquitectónico con líneas citadas · mapa actualizado
de zonas pesadas · propuestas de refactor con riesgo estimado (bajo/medio/alto) para cola
del médico — nunca aplicadas por su mano.

**Prohibiciones:** proponer división en módulos/bundler/TypeScript · recolorear el eje de
puntualidad · proponer unificaciones de fuentes de verdad ya vetadas.

---

## 2.3 SA-LOG — Subagente de Logística

**Misión:** que el trabajo fluya, quede registrado y sea trazable de punta a punta. Es el
**dueño del registro maestro** (§6) y el árbitro de formatos. No modifica producto.

**Responsabilidades:**

1. **Coordinación del flujo:** mantener la tabla de tareas (quién, qué tarea, estado
   pendiente/en-curso/bloqueado/cerrado, contra qué PR), impedir que dos subagentes
   trabajen la misma zona a la vez, y hacer respetar el orden de fases (§3).
2. **Registro de hallazgos:** todo hallazgo entra al registro maestro con severity (§3.4),
   archivo:línea, evidencia (comando o cita), subagente que lo reportó, estado
   (reportado/aceptado/en-cola/arreglado/descartado-con-motivo). **Nada se pierde, nada
   se arregla en silencio, nada se descarta sin motivo escrito.**
3. **Trazabilidad de modificaciones:** cada cambio de código enlaza hallazgo → tarea →
   PR → prueba → mutación → verificación post-rebase. La cadena debe poder reconstruirse
   leyendo solo el registro.
4. **Gestión de la cola del médico:** los hallazgos que requieren SU decisión (todo lo
   S3+ que toca comportamiento clínico, incluidos los A y B de `COLA_FUTURO.md`) se
   preparan **con opciones y riesgo**, nunca decididos por el equipo.
5. **Higiene del repositorio:** `git status` limpio de archivos de trabajo antes de cada
   commit; el registro maestro y `tests/INFORME_MUTACIONES.md` crecen por append
   (conflicto entre paralelos = conservar AMBAS filas).

**Entregables por tarea:** registro maestro actualizado · tabla de estado de tareas ·
acta de decisiones de la sesión.

**Prohibiciones:** cerrar un hallazgo sin evidencia · decidir por el médico · dejar una
mutación sin restaurar (regla dura del proyecto: una mutación olvidada ya costó horas de
depuración de un falso fallo).

---

## 2.4 SA-HCE — Subagente de Ingeniería de Software de Historias Clínicas

**Misión:** que el script sea defendible ante auditoría externa de salud. Audita y
certifica; solo toca código si la corrección es de compliance y SA-PROG no está
disponible en esa sesión (siempre con prueba + mutación).

**Responsabilidades:**

1. **Normativa aplicable, con fuente citada SIEMPRE** (regla dura: citar ley/resolución
   y artículo; lo que no se pueda citar, queda «pendiente de verificar», nunca de
   memoria — la regla «casilla vacía» aplica también a la ley):
   - **Colombia (territorio del despliegue):** Ley 23 de 1981 (ética médica) ·
     Resolución 1995 de 1999 (historia clínica: integridad, no alteración de lo escrito
     por el médico) · Ley 1581 de 2012 + Decreto 1377 de 2013 (habeas data personal) ·
     normativa de habilitación de servicios de salud vigente.
   - **Referentes internacionales pedidos por el propietario:** HIPAA (EE. UU.) ·
     RGPD (UE, arts. 9 y 32 como referente) · LGPD (Brasil) — aplican como *benchmark*
     de protección de datos de salud, no como ley territorial.
   - **Interoperabilidad:** HL7 v2 / FHIR R4 como referencia conceptual de los
     mapeos Everest (los esquemas reales en `grounding/esquemas/` mandan sobre cualquier
     idealización del estándar: **el contrato capturado gana siempre**).
   - **Gestión de seguridad de la información sanitaria:** ISO 27799/27001 como marco de
     referencia para controles.
2. **Confidencialidad y PHI:** re-verificar el dictamen de `AUDITORIA/P4_PHI_SEGURIDAD.md`
   (cero PHI en repo, 159 coincidencias enmascaradas revisadas una a una) contra la
   versión actual; telemetría con triple filtro; prompts de IA saneados; Gist solo
   lectura; SharePoint solo descarga. **Cero PHI en repos, commits, capturas ni prompts
   a modelos externos** (regla de `jules.md`: a Gemini nunca se le pasa una pantalla real).
3. **Integridad de la historia clínica:** el script no escribe jamás sin acción explícita
   del médico; el «Deshacer» no borra lo escrito por el médico; la carpeta cifrada v18 y
   el consentimiento (`suite_82_consentimiento.js`) cumplen su contrato.
4. **Derechos del paciente y minimización:** la cosecha local por paciente (módulo disco)
   se limita a lo necesario; recuperación ante disco hostil (`suite_76_disco_hostil.js`).

**Entregables por tarea:** dictamen de conformidad por marco (cumple/no
cumple/no aplica/pendiente de fuente), con línea de código o comando como evidencia, y
matriz normativa en el registro maestro.

**Prohibiciones:** citar un artículo normativo sin fuente verificable · certificar
cumplimiento de lo que no puede verificar en el código · proponer enviar PHI a un
tercero «para cumplir» un estándar.

---

# 3. PROTOCOLO DE AUDITORÍA — paso a paso, por fases y pasadas

Orden obligatorio. **Fase 1-3 son de solo lectura; en Fase 1 nadie toca nada.** Cada
fase produce entradas en el registro maestro antes de pasar a la siguiente.

### 3.1 FASE 0 — Preparación (SA-LOG)

1. Verificar punta: `git fetch origin claude/pym-agenda-blindaje-v12-4` y estado limpio.
2. Congelar línea base: versión `@version`, `wc -l -c vigilante_agenda.user.js`, sha256,
   salida completa de `node tests/runner.js` (comprobaciones en verde = la meta mínima a
   no retroceder), contadores de los inventarios de `AUDITORIA/MAPA.md`.
3. Publicar en el registro: tabla de tareas inicial, roles, baseline congelada.

### 3.2 FASE 1 — Inventario y verificación de integridad de anexos (SA-LOG + SA-DIS)

1. **Inventario del universo auditable** (nada se audita «de oídas»):
   - Producto: `vigilante_agenda.user.js` (+ variantes `v18.1.x_optimized.js`: verificar
     si están sincronizadas con la principal o son artefactos desechables → hallazgo).
   - Tablero Apps Script: `TABLERO/Codigo.gs`, `TABLERO/VersionCheck.gs`,
     `TABLERO/simulacion_local.js` (¿coincide la versión que publica el tablero con
     `@version` y `@updateURL`?).
   - Banco: `tests/runner.js`, `harness.js`, 82+ suites, `golden/`, `mutantes/`,
     `fixtures/` (¿algún fixture con apariencia de PHI? → S1 inmediato).
   - Herramientas: `tools/*.js`, `e2e/runner_visual.js`, `src/*.py`.
   - Evidencia: `grounding/` (catálogos, esquemas, mapas — ¿los esquemas corresponden a
     endpoints aún usados?).
   - CI: `.github/workflows/tests.yml` (¿corre el mismo comando del banco?).
   - Docs operativas: `CLAUDE.md`, `AGENTS.md`, `jules.md`, `RUNBOOK.md`, `ROLLBACK.md`,
     `POLITICA_ERRORES.md`, `CANAL_DISTRIBUCION.md`, `SECRETOS_EXPUESTOS.md`,
     `TELEMETRIA*.md`, `docs/uiux/*`.
2. **Integridad:** cada anexo se abre y se contrasta contra el archivo principal
   (versiones, selectores citados, endpoints). Documento que describe una versión vieja
   = hallazgo de deuda documental (S3), no motivo de reescritura silenciosa.
3. **Coherencia de distribución:** `@match`/`@connect` vs dominios realmente usados en
   código (grep de hosts); `@updateURL`/`@downloadURL` vs canal declarado.

### 3.3 FASE 2 — Revisión línea por línea del script principal (SA-PROG, satélites)

1. **Partir del mapa, no de cero:** `AUDITORIA/MAPA.md` para zonas pesadas; los banners
   internos de módulo como índice; `grep -nE '^[[:space:]]*(async )?function ' ` para
   recuentos. **Re-verificar rangos antes de auditar una zona** (el archivo se mueve).
2. **Barrido por franjas asignadas por SA-LOG** (p. ej. de 2.000 en 2.000 líneas), cada
   franja entregando: defectos con línea, `catch` mudos nuevos, interpolaciones HTML
   nuevas desde la última auditoría XSS, listeners/timers nuevos sin registro en
   `state.timers`/`emergencyTeardown`, promesas sin `await`, `t.casoAsync` sin `await`
   en las suites.
3. **Verificación de contratos internos** (método P1 previo): cada función con historia
   de incidente (`mtrRecalcularConFactores`, `colorAndAlert`, marcas antiduplicado,
   migración de disco) se comprueba en sus DOS vías de consumo.
4. **Rendimiento:** re-medir con `tools/` los presupuestos vigentes; comparar contra
   `docs/AUDITORIA_RENDIMIENTO_SEGURIDAD_20260903.md` y reportar deriva con números.

### 3.4 FASE 3 — Deuda técnica y oportunidades de optimización (SA-DIS + SA-PROG + SA-HCE)

1. **Inventario consolidado de deuda:** fusionar `DEUDA_v14.md`,
   `FUNCIONES_HUERFANAS.md`, `REFACTOR_S_PENDIENTE_20260830.md`, `BACKLOG_*.md`,
   hallazgos A/B de `COLA_FUTURO.md` y lo nuevo de Fases 1-2 en UNA tabla viva del
   registro maestro, con: severidad, esfuerzo, riesgo clínico, decisión pendiente.
2. **Escalas de severidad (heredadas de `AUDITORIA/`):**
   - **S0** — riesgo clínico inmediato o PHI expuesta → se arregla YA, con voz del
     médico informada de inmediato.
   - **S1** — defecto funcional que rompe un contrato interno → arreglar en este encargo.
   - **S2** — seguridad/perf sin riesgo clínico directo → arreglar con prueba.
   - **S3** — deuda que requiere decisión del médico → cola con opciones.
   - **S4** — estilo/documentación → se anota, no se toca.
3. **Oportunidades de optimización:** solo las medibles (grep count, ms, bytes, nodos).
   Toda propuesta declara: qué mide hoy, qué mediría después, con qué comando.

### 3.5 FASE 4 — Pulido y refactorización controlada (SA-PROG ejecuta; SA-DIS diseña)

1. **Una tarea = un PR.** Orden: S0 → S1 → S2. Nada de S3 sin decisión del médico.
2. Cada PR incluye: diff mínimo · prueba nueva que falla sin el cambio · mutación
   transcrita · contador del banco ≥ baseline · rebase verificado.
3. El «nivel élite» se persigue SOLO por estos medios: defectos cerrados, deuda S1/S2
   saldada, documentación de anexos veraz, pruebas que no puedan saltarse en silencio,
   comentarios POR QUÉ en cada arreglada. **Nunca** por reformateo o reescritura
   cosmética.

---

# 4. CRITERIOS DE CALIDAD ÉLITE — la definición de «terminado»

El script alcanza nivel élite profesional cuando TODOS estos criterios están verificados
(y no «asumidos») en la versión final:

| # | Criterio | Verificación objetiva |
|---|---|---|
| 1 | Banco 100% verde, **≥ baseline** de comprobaciones, post-rebase | Salida del runner pegada |
| 2 | Cero defectos S0/S1 abiertos en el registro maestro | Tabla del registro |
| 3 | Toda interpolación HTML dinámica nueva trazada a `escapeHtml` o literal | Grep + tabla de trazas (método `AUDITORIA_XSS.md`) |
| 4 | Cero PHI en repo (re-barrido de patrones sensibles, método P4, sin imprimir valores) | Conteo y dictamen SA-HCE |
| 5 | Listeners/timers: todo lo nuevo registrado y barrido por `emergencyTeardown` | Diff de inventarios vs `MAPA.md` |
| 6 | Dominios de red usados ⊆ `@connect` declarados | Grep de hosts vs cabecera |
| 7 | Arquitectura: sin funciones huérfanas nuevas, sin segundas fuentes de verdad nuevas, secciones con contrato documentado | Dictamen SA-DIS con líneas |
| 8 | CSS: sin clase redefinida, sin `z-index`/color/`font-size` suelto nuevo, elementos de `body` en las listas de tokens | Grep + suites de interfaz |
| 9 | Presupuesto de rendimiento respetado (0 `backdrop-filter` nuevo, 0 animación permanente, transiciones compositables) | Medición `tools/` |
| 10 | Comentarios POR QUÉ en cada comportamiento no obvio añadido/corregido | Revisión del diff |
| 11 | Mutaciones: cada cambio de comportamiento con su fila en `tests/INFORME_MUTACIONES.md` | Tabla, formato intacto |
| 12 | Matriz normativa completa (cumple/no cumple/no aplica/pendiente de fuente) sin casillas inventadas | Matriz SA-HCE en el registro |
| 13 | Documentación de anexos veraz respecto a la versión final | Contraste Fase 1 |
| 14 | Cola del médico (S3) documentada con opciones y riesgo — cero decisión ajena | Tabla de cola |

---

# 5. REVISIÓN CRUZADA — nadie se certifica a sí mismo

Después de Fase 4 y ANTES del informe final:

1. **SA-PROG re-audita los cambios de SA-HCE** (si tocó código) y **SA-DIS re-audita los
   diffs de SA-PROG**: ¿el arreglo rompe una invariante §1.2? ¿introduce segunda fuente
   de verdad? ¿está probado con mutación?
2. **SA-HCE re-audita los diffs de SA-PROG y SA-DIS**: ¿algún cambio filtra PHI, envía
   red a un dominio no declarado o escribe en la HC sin acción explícita del médico?
3. **SA-LOG verifica trazabilidad de punta a punta**: por cada PR, la cadena
   hallazgo→tarea→PR→prueba→mutación→runner se reconstruye leyendo solo el registro.
   Cadena rota = el PR vuelve.
4. **Segunda opinión externa opcional:** para diffs de riesgo ALTO, un agente satélite
   (Jules) revisa el PR en modo solo-lectura con esta checklist. Su salida entra al
   registro como comentario de revisión, no como decisión.
5. Toda discrepancia entre revisores se resuelve por la jerarquía del §7.2, y queda
   escrita en el registro — también si se resuelve en segundos.

---

# 6. REGISTRO MAESTRO Y REPORTE FINAL

### 6.1 Registro maestro (lo crea/actualiza SA-LOG en `AUDITORIA/REGISTRO_ELITE.md`)

Formato fijo de entrada de hallazgo:

```
| ID | Fecha | Subagente | Severidad | Archivo:Línea | Hallazgo | Evidencia (comando/cita) | Estado | PR |
```

Reglas: solo append · ID único (AE-###) · estado con vocabulario cerrado
(reportado/aceptado/en-cola/arreglado/descartado-con-motivo) · toda fila de otro
subagente se conserva íntegra en conflictos.

### 6.2 Informe final (SA-LOG redacta; los cuatro firman su sección)

Estructura obligatoria — el formato hereda de `AUDITORIA/INFORME_FINAL.md`:

1. **Alcance y baseline** (versión, sha256, comprobaciones del banco antes/después).
2. **Hallazgos por severidad**, con tabla completa referida al registro maestro.
3. **Modificaciones realizadas**: PR por PR, con su mutación y su contador del banco.
4. **Pruebas de validación ejecutadas**: runner completo, suites nuevas, herramientas de
   medición usadas con su salida.
5. **Matriz normativa** de SA-HCE (por marco: HIPAA / RGPD / LGPD / Colombia /
   interoperabilidad, con la fuente citada en cada fila o «pendiente de fuente»).
6. **Dictamen de arquitectura** de SA-DIS (deuda restante y su porqué).
7. **Revisión cruzada**: cada revisor, su veredicto y las discrepancias resueltas.
8. **Cola del médico**: decisiones S3 pendientes, cada una con opciones y riesgo.
9. **Certificación**: los cuatro subagentes certifican —bajo su rol— que el script cumple
   los 14 criterios de §4, o declaran exactamente cuáles no se cumplen y por qué.
   **La certificación es condicionada o total, jamás optimista.** La palabra final de
   despliegue es del médico, siempre.

---

# 7. PROTOCOLO ANTE LA DUDA

1. **¿Falta evidencia?** No se inventa: casilla vacía, «pendiente de fuente», y si hace
   falta, se entrega un script de diagnóstico para capturarla en consultorio.
2. **¿Dos instrucciones chocan?** Gana la seguridad clínica, después la voluntad del
   médico, después la norma, después la estética/estilo.
3. **¿El cambio obliga a tocar una invariante (§1.2)?** Se detiene el trabajo y se
   explica en el registro, sin tocarla.
4. **¿La prueba no pasa y no se sabe por qué?** Jamás se «ajusta» la prueba hasta que
   pase. Una prueba debilitada para que un PR entre es la peor manera de romper este
   script. Se reporta y se depura.
5. **¿Un hallazgo repite o contradice una auditoría previa?** Se referencia (§1.3);
   contradicción = cita + evidencia, nunca silencio.
