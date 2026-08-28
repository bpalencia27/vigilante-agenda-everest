# Backlog pendiente — 28-ago-2026

Este documento existe por una lección concreta: el 27-ago se perdió la lista completa de 178
hallazgos de un enjambre porque nunca se versionó. Esta vez cada petición abierta del médico
queda escrita aquí, con fecha y contexto, ANTES de seguir acumulando trabajo nuevo encima. Se
actualiza (no se reescribe desde cero) según se cierre cada punto.

Estado de cada ítem: `[ABIERTO]` · `[EN DISEÑO]` · `[EN CURSO]` · `[CERRADO — versión]`.

---

## 1. [EN CURSO] Falso positivo en el vigilante de agenda (bug en vivo, máxima prioridad)

Petición original (27-ago): el encargado de vigilar los cambios de leyenda en Citas del día
avisa tarde o avisa **erróneamente** que activaron a un paciente tarde cuando no fue así — un
falso positivo, no solo una demora. Se pidió:

- Que sea prácticamente en tiempo real, con poco impacto en red/rendimiento.
- Que quede documentada la hora exacta de cada cambio de leyenda.
- Que **nada** impida que el script corra en varias pestañas de Everest a la vez — el médico
  (y los demás médicos) abren varias pestañas de Citas del día de por rutina.
- Que el panel se actualice en tiempo real sin parpadear al repintar.

**Dato nuevo (28-ago), corrige el alcance de la hipótesis:** cada médico tiene su propio usuario
en Everest y ve solo su propia agenda — así que la interferencia NO es entre médicos distintos
viendo al mismo paciente. El mecanismo más probable es una condición de carrera **entre varias
pestañas del MISMO médico**, coordinadas hoy solo por `localStorage` (relevo de liderazgo
`LEADER_KEY`, siembra compartida `SIEMBRA_KEY`, fraude compartido `FRAUDE_COMPARTIDO_KEY`) —
per-perfil-de-navegador, no cross-máquina.

Ya confirmado por lectura de código (no implica aún causa raíz):
- `_detectarInstanciaDuplicada()` (línea ~25655) es por-pestaña, no bloquea multi-pestaña — el
  requisito de "no debe haber nada que lo impida" ya se cumple, salvo que la investigación
  encuentre lo contrario.
- `LEADER_KEY="vgl_leader_beat"`, `LEADER_TTL_MS=20000` (línea ~7456).
- `SIEMBRA_KEY="vgl_siembra_dia2"` / `FRAUDE_COMPARTIDO_KEY="vgl_fraude_dia2"` (líneas ~11218-11284).
- `apiCadencia()` es de sondeo adaptativo (5 niveles, 5-30s), no dirigido por eventos — hay un
  piso de latencia inherente que puede o no ser la causa de "avisa tarde" (distinto del "avisa
  erróneamente", que es el síntoma más grave).

No hay evidencia CSV del incidente concreto (no se guardó ese día). Pendiente: causa raíz
verificada + arreglo mínimo, sin tocar fechas/cálculos de otros módulos.

---

## 2. [ABIERTO] Refactorización S+ del "Panel del paciente" (`#vgl-panel-modal`)

Petición del 27-ago, ampliada el 28-ago: refactorización total — diseño, código y
funcionalidad — a nivel "top tier S+ insuperable". Incluye:

- Modernizar visualmente los paneles.
- Eliminar notificaciones molestas y ajustes muertos o que no deben ser visibles al público
  general (candidatos ya identificados en la auditoría del 28-ago,
  `AUDITORIA_EXPERIENCIA_20260828.md`).
- Reintroducir las actividades de PyM en cada tarjeta de paciente del panel visual del
  asistente clínico, como antes de T4 — lista completa, no compacta (decisión ya tomada en la
  entrevista del 28-ago) — sin desbordar el diseño con hasta ~21 pacientes/día.
- Asegurar que todo el DOM y todos los datos de la historia clínica de Everest lleguen al
  script y a la IA al momento de redactar (o al menos lo necesario para cada redacción).
- Interconectar todos los módulos en tiempo real — ejemplo explícito del médico: el
  agendamiento debe depender de la clasificación de RCV, pluripatología, polifarmacia, etc. —
  y todos los módulos conectados en tiempo real con el panel visual del asistente clínico.

**Ampliación del 28-ago:** sacar la sección farmacológica del Panel del paciente y llevarla a
un widget en la pestaña de Conducta de Everest (ver punto 3) — el Panel del paciente queda sin
esa sección tras la refactorización.

Requiere primero (tarea en curso): mapear la arquitectura completa actual del panel (secciones,
líneas, CSS, pruebas) antes de tocar nada — mismo principio de "no romper lo que no se mapeó"
usado en cada refactorización de este proyecto.

---

## 3. [EN DISEÑO] Widget de análisis farmacológico en vivo, en la pestaña Conducta

Petición original (27-ago): activar las alertas de seguridad farmacológica desde ya, al menos
con los medicamentos del programa de RCV, basadas en TFG y en contraindicaciones por
comorbilidad o combinación peligrosa — bien estructuradas, tolerables visualmente pero difíciles
de ignorar.

**Refactorización pedida el 28-ago** (reemplaza la idea original de mostrarlo solo dentro del
Panel del paciente): que el análisis salga en un **widget aparte**, dentro de la sección de
Conducta de Everest, justo al lado de donde el médico empieza a formular — y que:

- Se actualice en tiempo real **mientras el médico está recetando** (a medida que va agregando
  medicamentos a la fórmula, no solo al abrir el panel).
- Se repinte "llamando la atención" del médico (sin ser molesto) cuando hay un resultado nuevo
  que revisar, para que lo abra.
- La decisión de detección/veredicto (qué es peligroso, qué contraindica qué) sea por
  **código puro** — el motor RCV ya existente, determinista y con banco de pruebas — no por IA.
  La IA (Gemini flash-lite) se reserva, como en el resto del proyecto, solo para pulir la
  REDACCIÓN de un texto ya decidido por código, nunca para decidir la alerta de seguridad. Este
  documento dejará constancia de la decisión una vez el médico la confirme explícitamente;
  mientras tanto se está diseñando bajo ese supuesto por ser el que ya sigue el resto del
  proyecto (MOTOR RCV v68 existe precisamente para sacar esta clase de juicio de la IA).

Grounding ya reunido (28-ago):
- `extractPacienteAbierto()` (línea ~9998) ya detecta, leyendo el DOM, qué paciente tiene la
  historia abierta ahora mismo — sin necesitar abrir ningún modal. Es el candidato natural para
  saber "el médico está en la historia de este paciente ahora".
- `MTR_CASILLAS_REDACTOR.recomendaciones` (línea ~33714) ya ancla `textarea[name=
  "RecomendacionesMedicas"]` como la casilla real de la pestaña Conducta — el único anclaje
  verificado contra una captura real hasta ahora. No hay captura real todavía del área
  específica donde se buscan/agregan medicamentos (la "Fórmula" puede ser una subsección propia
  dentro de Conducta, no necesariamente la misma zona que `RecomendacionesMedicas`).
- `CargarMedicamentosPaciente` (endpoint ya integrado, `mtrRefrescarMedicamentos`) devuelve
  formulaciones con `estado="PENDIENTE"` — compatible con la hipótesis de que Everest persiste
  cada medicamento agregado a la fórmula del lado del servidor apenas se agrega (antes de
  guardar toda la nota), lo que permitiría lograr "tiempo real" sondeando esa API en vez de
  leer el DOM vivo de Everest — evitando el riesgo ya conocido (v15.3.0) de pelear con el
  re-render de Angular dentro de Conducta. **Sin confirmar con una captura real de un
  agregado en curso** — queda como hipótesis de diseño hasta verificarla.
- v15.3.0 retiró por decisión del médico toda escritura directa dentro del DOM de Conducta
  (causaba un bucle reportado en consultorio) — cualquier diseño nuevo que toque esa zona debe
  evitar el mismo error: no reescribir el DOM de Everest, solo LEER (vía API o vía lectura
  pasiva del DOM) y pintar un widget propio, fijo, que seguimos nosotros mismos.

---

## 4. [ABIERTO] Preguntas de la entrevista S+ aún sin responder

Del artefacto `mapa-panel-s-plus` (28-ago): 22 de 26 preguntas siguen abiertas — 4 de
notificaciones, 6 de ajustes muertos, 4 de farmacología (más allá del estado del interruptor,
ya respondido), 5 de sincronización. Más una pregunta técnica mía sin responder: si el
Glassmorphism/`backdrop-filter` del rediseño visual es aceptable en computadores de consultorio
lentos, dado que MODO LIGERO existe precisamente por ese problema documentado.

---

## 5. [ABIERTO — pendiente del médico, no mío] Otros

- Encender GitHub Actions (Settings → Actions → General del repo) — los PR reportan cero
  ejecuciones; corregido el `TZ` en el workflow (v17.15.0), falta que el médico lo active.
- Qué hacer con el canal de distribución por Gist — los otros dos computadores actualizan desde
  ahí y van muy por detrás de lo que el médico instala a mano.

---

## 6. [CERRADO — sin acción, ya se decidió] Sábado con tres reglas

Medido con `tools/medir_sabados.js` (v17.15.0). Pendiente: volver a preguntar con los números en
mano una vez el médico lo pida — no se mueve ninguna fecha hasta entonces.
