# Backlog pendiente — 28-ago-2026

## Resumen de la noche (autorización explícita del médico, hasta 7h sin su presencia)

Trabajo seguro agotado — todo lo que quedaba en la cola sin necesitar el criterio del
médico en tiempo real está cerrado. Seis versiones, todas con prueba/mutación/CHANGELOG:

- **v17.17.0** — falso positivo de fraude en la agenda (causa raíz confirmada por dos
  revisores independientes; el primer arreglo propuesto se descartó por insuficiente).
- **v17.18.0** — widget "qué ordenar en el próximo control" en Conducta.
- **v17.19.0** — "Silenciar 15 min" ahora silencia tono+toast+Windows+cartel de verdad.
- **v17.20.0** — 4 ajustes muertos retirados, etiqueta "(en pruebas)" retirada del motor.
- **v17.21.0** — reloj de cabecera con la cadencia de sondeo visible.
- **v17.22.0** — chips de PyM de vuelta en la tarjeta (reversión consciente de T4).

Banco: **2.497/2.497**, cobertura 91,6 %. PR #101 actualizado con el resumen completo.

**Lo que NO se tocó, a propósito — necesita al médico despierto:**
- El toggle de abandono PES (la naturaleza real ya se verificó en código — Programa de
  riesgo cardiovascular vía SharePoint, no sala de espera — pero la decisión del toggle
  sigue sin responder).
- Comorbilidades del motor farmacológico (NYHA, insuficiencia hepática) y los dos gaps de
  insulinas/furosemida — necesitan verificar contra Everest qué campos existen de verdad.
- Extender la reconciliación de Agendar a comorbilidades/medicamentos, y el "reloj más
  corto" de frescura — decidido en dirección, pero sin el número exacto.
- Alergias/quirúrgicos/traumáticos/transfusiones al grounding de la IA: los NOMBRES reales
  de los campos SÍ están documentados (`MAPA_GUARDADO_HC.md`: `quirurgicos`, `traumaticos`,
  `transfusiones`, `alergicos`), pero su documento propio advierte explícitamente que la
  FORMA interna de cada lista no se conoce todavía ("no se sabe qué valores admite cada
  campo... suponerlo sería repetir v12.3.30") — hace falta una captura de valores real,
  desidentificada, antes de tocar el código.
- Correr el diagnóstico de "carga" de v17.12.0 en una consulta real (solo el médico puede).
- El widget de fármacos en Conducta (diseñado, bloqueado en la lectura en vivo por falta
  de una captura del GRABADOR sobre el gesto de agregar un medicamento).
- Los bugs de Laboratorios sin especificar, y toda decisión de diseño visual S+.

---


Este documento existe por una lección concreta: el 27-ago se perdió la lista completa de 178
hallazgos de un enjambre porque nunca se versionó. Esta vez cada petición abierta del médico
queda escrita aquí, con fecha y contexto, ANTES de seguir acumulando trabajo nuevo encima. Se
actualiza (no se reescribe desde cero) según se cierre cada punto.

Estado de cada ítem: `[ABIERTO]` · `[EN DISEÑO]` · `[EN CURSO]` · `[CERRADO — versión]`.

---

## 1. [CERRADO — v17.17.0] Falso positivo en el vigilante de agenda (bug en vivo, máxima prioridad)

Causa raíz confirmada con dos revisores independientes intentando refutarla sin lograrlo:
una pestaña que recupera el liderazgo tras estar oculta (`relevoPorVisibilidad`) podía
originar una marca de fraude con su primera lectura, potencialmente estancada. Se descartó
el primer arreglo propuesto (habría suprimido detecciones legítimas de arranque tardío o
perdido evidencia de fraude real) y se implementó uno calibrado sobre la señal correcta
(`_ultimoRelevoVisibilidad`, que solo se activa en un relevo real, nunca en un arranque
normal). Detalle completo, con las tres mutaciones verificadas, en
`tests/INFORME_MUTACIONES.md` (sección v17.17.0) y `CHANGELOG.md`.

Sección original del reporte, conservada como referencia:

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

## 2. [MAPEADO, listo para diseño visual] Refactorización S+ del "Panel del paciente" (`#vgl-panel-modal`)

Mapeo completo hecho (28-ago): función real `openPanelPacienteModal` (líneas 19316-19640,
NO `openFichaPacienteModal` — ese nombre solo sobrevive como comentario desactualizado),
sus 5 secciones con rangos de línea/CSS/pruebas, y 8 acoplamientos peligrosos documentados
— el más importante: la sección "Resumen" (`mtrFichaVivaFilas`) TAMBIÉN muestra un listado
de medicamentos por separado, así que sacar la pestaña "Medicamentos" no basta para que la
farmacología desaparezca del panel; hay que decidirlo a propósito. También hay una prueba
frágil (`suite_63_tablero_riesgo.js` ~línea 380) que delimita un recorte de código buscando
una función que ya no existe — hay que arreglarla ANTES de reordenar nada, no después de que
algo se rompa por debajo. Detalle completo pedido a quien retome este punto.

Petición original:

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

## 3. [DISEÑADO, BLOQUEADO en un punto — necesita al médico] Widget de análisis farmacológico en vivo, en la pestaña Conducta

Diseño técnico completo hecho (28-ago): anclaje fijo fuera del árbol de Angular (mismo
patrón ya endurecido de `_acompMostrar`), fuente de datos = lectura del DOM en vivo (la API
`CargarMedicamentosPaciente` NO sirve para tiempo real — solo se dispara una vez al cargar
la pantalla, evidencia en `captura_ordenamiento_nativo_20260810.json`), sondeo enganchado al
`tick()` ya existente sin timers nuevos, diseño anti-parpadeo de dos firmas (fina/gruesa) y
señal de atención con ventana acotada (reutilizando `vglPulse`, con las guardas `.perf` y
`prefers-reduced-motion` obligatorias desde el día uno).

**Bloqueo real, no se puede resolver sin el médico:** no existe ninguna captura real del
gesto de buscar/agregar un medicamento dentro de Conducta — sin eso no hay selector DOM
verificado para leer "qué se acaba de agregar" (violaría la regla de "casilla vacía antes
que dato inventado"). Se necesita correr el GRABADOR del proyecto (mismo método que produjo
`captura_ordenamiento_paquete_HTA_20260812.json`) sobre ese gesto concreto, redactando
cualquier dato identificable, antes de escribir el código de lectura del widget. El resto
del diseño (anclaje, sondeo, anti-parpadeo, atención) no depende de esta captura y puede
implementarse ya.

Preguntas abiertas menores para el médico, sin bloquear lo demás: si baja la severidad debe
reflejarse de inmediato o con un pequeño margen para no "parpadear"; si el widget debe verse
(colapsado) también en Anamnesis/Impresión Diagnóstica o solo en Conducta como pidió; y si
el motor farmacológico (hoy apagado por defecto) debe encenderse de fábrica para este widget
en particular.

Petición original:

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

## 8. [ABIERTO] Widget de "qué ordenar en el próximo control", en Conducta

Ampliación (28-ago) del widget de Conducta: además del de farmacología, un segundo widget
con la lista de exámenes que se deben ordenar en el próximo control (ya calculada por
`mtrPanelExamenesHtml`, Sección 3 del Panel del paciente), anclado junto al botón nativo de
Everest para ordenar dentro de Conducta.

Grounding mejor que el del widget de fármacos: `captura_ordenamiento_paquete_HTA_20260812.json`
YA registra el gesto real completo — clic en "Conducta" → clic en "Paquetes" → clic en el
programa (ej. "HTA") → por cada examen: clic en el `<li>` → clic en "Agregar" → al final
"Confirmar". Solo 3 XHR en toda la secuencia, ninguno atado a un "Agregar" individual — el
patrón confirma lo mismo que el widget de fármacos: Everest no persiste nada hasta
"Confirmar". A diferencia del widget de fármacos, el contenido CORE de este widget no
necesita leer NADA del DOM en vivo — sale entero de datos que el script ya calcula sin
tocar Conducta. Leer el DOM (los `<li>` bajo el paquete abierto) sería solo un extra:
tachar en nuestro widget lo que el médico ya agregó al carrito de Everest antes de
Confirmar, para que no se vea como pendiente algo que ya está en curso.

Idea S+ (respuesta a "cómo mejorarías esto"): no construir dos widgets independientes —
un solo mecanismo de "widgets de Conducta" (anclaje, sondeo, anti-parpadeo, aviso) del que
cuelgan dos tarjetas (💊 Farmacología, 🧪 Exámenes a ordenar). Y un segundo salto: que un
clic en un examen del widget abra nuestro propio modal de Ordenamiento (ya automatizado y
probado, ver `openOrdenamientoModal`) en vez de obligar al médico a repetir a mano el gesto
"Paquetes → buscar → Agregar → Confirmar" dentro de Conducta — convierte este widget en la
puerta de entrada al módulo que hoy los colegas no usan (ver punto 7 de adopción).

## 9. [ABIERTO] Bugs actuales del módulo de Laboratorios — sin especificar aún

El médico reporta (28-ago) que el módulo de Laboratorios "tiene varios bugs actualmente" y
pide que funcione lo más parecido a Athenea posible, a un clic. Sin evidencia concreta en
el repo de cuáles son los bugs vigentes — se le pidió el detalle (capturas/consola) antes de
tocar código, siguiendo la disciplina de "reproducir antes de arreglar" de todo este
proyecto.

## 10. [ABIERTO] Nueva dirección para la adopción de Agendamiento

Las ideas de UI de la ronda anterior (beneficio visible en el botón, un clic para el caso
común, reforzar el acompañante) no convencieron al médico. Nueva dirección propuesta
(28-ago), pendiente de validar con él: (a) interceptar el punto de entrada NATIVO de
Everest para agendar con una micro-sugerencia in-situ, en vez de competir con un botón
nuestro en otro lugar de la pantalla; (b) adopción social — mostrarle a los colegas sus
propios números reales de ahorro de tiempo, sacados del Tablero de Telemetría de cada uno,
en vez de solo cambios de interfaz.

## 11. [ABIERTO] Extender la cosecha por paciente para servir de grounding en la MISMA visita

Hallazgo importante (28-ago): el mecanismo que el médico pidió ("guardar esos datos en el
pc para futuras consultas con el mismo paciente... mejor grounding") **ya existe** —
`_vglCosechaGuardar`/`_vglCosechaLeer` (`VGL_COSECHA_KEY="vgl_cosecha"`, ~línea 4623) más
`mtrHcGuardar`/`mtrHcLeer`/`mtrHcAcumularDelDom` (~línea 36597-36803): captura los hechos
del payload que Everest manda al GUARDAR la historia, los desidentifica ANTES de
almacenarlos (no después de enviarlos), y los persiste en `localStorage` por paciente
(cédula), sobreviviendo entre visitas — exactamente lo pedido.

Limitación ya documentada en el propio código: como Everest manda ese payload al final de
la consulta (al pulsar Guardar), lo capturado sirve de grounding para la visita SIGUIENTE,
no para la actual — salvo que el médico guarde a mitad de consulta. Para que sirva también
en la visita de HOY hace falta capturar (con el GRABADOR) el endpoint que Everest usa para
CARGAR los datos del paciente al abrir su historia — ese endpoint todavía no está
capturado, y el propio comentario del código ya anticipa que el día que se capture, el
mecanismo lo reconocerá "sin tocar una línea". Es la extensión natural de este punto, no
una construcción nueva.

## 7. [ABIERTO] Adopción de Agendamiento y Laboratorios entre colegas novatos

Petición del 28-ago: los compañeros del médico (poco duchos en tecnología) no usan estos dos
módulos — prefieren el agendamiento nativo de Everest y consultar directamente en Athenea.
El médico quiere que usen TODOS los módulos del script. Grounding ya reunido:

- Ya existe telemetría local real (`uxTrack`, `UX_KEY`, `mtrTableroTelemetria` ~línea 9182) que
  mide exactamente el embudo de agendamiento (`fn.agendar.open` vs `cita.creada.*`, con
  `abandono` en %) y el conteo de `widget.labs.abrir` / `widget.agendar.abrir` — antes de
  rediseñar a ciegas, medir en las instalaciones de los compañeros (si tienen `S.uxTelemetria`
  encendida) para saber si el problema es que NUNCA abren el botón (descubrimiento) o que lo
  abren y abandonan (confianza/fricción del flujo).
- Ya existe un "acompañante" (`ACOMP_KEY`, ~línea 25946) que celebra flujos completados
  (`fn.agendar.complete`, `labs.autollenado.casillas`, etc.) hasta que el usuario "aprende"
  (`ACOMP_FLUJOS_META=5`) — es infraestructura de onboarding ya construida, candidata a
  reforzar en vez de inventar algo nuevo.
- Hipótesis de diseño (sin implementar): en Laboratorios, la queja "se van directo a Athenea a
  consultarlo" sugiere que solo quieren MIRAR, no actuar — mismo principio que la reintroducción
  de chips de PyM en la tarjeta (punto 2): mostrar el estado de labs (al día / cuántos
  pendientes) directamente en la tarjeta, sin clic, y reservar el modal para lo que Athenea no
  ofrece (auto-llenado de casillas, vigencias por estadio). En Agendamiento, reducir a un clic
  el caso más común y hacer visible el beneficio concreto (menos clics, evita duplicar cita) en
  vez de pedir un acto de fe.

Depende de: qué tan encendida está la telemetría en las instalaciones de los compañeros (esto
sí lo puede verificar el médico).

## 6. [CERRADO — sin acción, ya se decidió] Sábado con tres reglas

Medido con `tools/medir_sabados.js` (v17.15.0). Pendiente: volver a preguntar con los números en
mano una vez el médico lo pida — no se mueve ninguna fecha hasta entonces.
