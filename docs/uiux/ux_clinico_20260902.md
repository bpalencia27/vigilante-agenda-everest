# UX_Clinico — Auditoría de ergonomía y carga cognitiva (v18.0.113)

Auditor: agente UX_Clinico (enjambre UI/UX, 02-sep-2026). Solo lectura sobre
`vigilante_agenda.user.js` @ `268cda4` (v18.0.113). Datos sintéticos en todos los ejemplos;
ninguna cédula ni nombre real. No se repite nada marcado ✅ en
`docs/OPORTUNIDADES_SPLUS_20260902.md`; C11 y C17 (🗳️ «en curso») se mencionan solo como
contexto y no se cuentan como hallazgo.

Convenciones: **líneas ≈** del archivo; ⚖️ = cambia un hábito del médico (decisión suya);
✂️ = quirúrgica (pocas líneas). Nada de lo propuesto actúa sin clic ni pisa texto del médico;
los cuadros de ESCRITURA siguen sin cerrar con clic fuera.

---

## FASE 1 — Recorrido simulado, leído del código

### (a) Abrir una historia: dock, avisos, toasts

**Qué aparece, en qué orden, por qué canal**

1. `tick()` → `createAccionesDockUI()` (≈7542). Columna fija `#vgl-acciones-dock`
   (`left:8px; top:200px`, ≈16333) con toggle «▶/◀» y, para médico autorizado, hasta seis
   botones con rótulo visible (`VGL_ROTULOS`, ≈7466):
   `📅 Agendar` | `📋 Ordenar` | `🧪 Laboratorios` | `🧾 Panel del paciente` (solo si la
   compuerta abre) o `📝 Faltan antecedentes` (atenuado) o **nada** | `✍ Redactar` |
   `📦 Próximo control`. Estados alternos: `🧪 Agendar labs` (ámbar), `🖨 Recordatorio`,
   `📅 Agendado` (gris, deshabilitado), `📋 Ordenado` (gris).
2. En paralelo, sin clic: `autoCalcularResumenSiNecesario` (≈7524) lanza
   `mtrCalcularResumenClinico` (Athenea + Annar/Citi + renal + medicamentos, 3-6 s) y el robot
   Auto-Labs precarga `_labsPrefetch`.
3. Botones flotantes abajo-izquierda según pestaña (≈16248-16270): `🧪 Exámenes`
   (Ruta Crónicos, `bottom:70px`), `🩺 Examen normal` (Examen físico, `116px`),
   `✍ Enfermedad actual` / `✍ Análisis y plan` (Anamnesis / Impresión, `162px`).
   Barra de minimizados `#vgl-min-bar` en `left:14px; bottom:14px` (≈17842).
4. A los ≤5 s de gracia (`MTR_AVISO_GRACIA_MS`, ≈14156) sale UNA vez por jornada el cuadro
   `#vgl-pym-modal` «**Pendientes de este paciente**» (`avisoUniversal`, ≈14159) con secciones
   «Abandono Programa RCV», «Actividades preventivas por solicitar» (chips) y «Laboratorios RCV
   sin resultado vigente» (chips); pie: «*Este aviso no volverá a mostrarse durante la jornada
   para este paciente.*»; botón «Entendido»; cierra también con clic fuera (C21). Es solo
   informativo (v17.6.18) y **no existe forma de reabrirlo** desde el dock (≈7626-7805).
5. Avisos de página: `#vgl-toasts` arriba-derecha (≈17575), máx. 4 visibles; ROJO/MORADO/ÁMBAR
   nunca se autodescartan (≈14453); VERDE/AZUL 9 s salvo `persist`. Si en un flush de 500 ms
   entran >3 avisos agrupados, todo se colapsa en «**Alerta Múltiple (N)** — X alertas críticas y
   Y rutinarias recibidas.» sin ningún título ni cuerpo (≈14527-14533).
6. HUD «Centinela PyM»: `spToast` (≈12868) abajo-derecha, prefijo literal «🛡️ Centinela PyM · »;
   lo disparan los fallos de AppCita (≈20564, 20607, 20647, 20681).
7. `bigAlert` (≈14090): cartel `alertdialog` «Entendido» para fraude; no interviene en la
   consulta normal.

**Qué puede confundir**

- Mientras `_resumenListoParaGate` es falso (los primeros 3-6 s, o más si Athenea está lenta) el
  dock no muestra **ni** «Panel del paciente» **ni** «Faltan antecedentes» (≈7593, 7747-7771):
  el médico ve cinco botones y no sabe que hay un sexto en camino. La firma del dock incluye
  «PB/pb» así que el botón *aparece* de golpe: un control que aparece solo es tan
  desorientador como uno que desaparece (C3 ya trató el caso inverso).
- «Pendientes de este paciente» exige leer y memorizar: el médico cierra con «Entendido» o con
  un clic fuera y la información se va para toda la jornada. Parte se recupera en Ordenar
  (PyM) y en el Panel (exámenes), pero no la sección «Abandono».

### (b) Agendar (openAgendamientoModal ≈25039)

**Paso 1 — «Tipo de Cita»** (≈25096-25132). Tarjetas «Control Médico + Toma de Labs
(Recomendado)» (activa), «SOLO Control Médico», «SOLO Laboratorios»; chips de especialidad
(Med. General activa, Psicología, Odontología); pie «Cancelar» / «Siguiente: Elegir Fecha y
Turno ➔». Con los valores por defecto igual hay que pulsar «Siguiente» (C17 🗳️ en curso).
«SOLO Laboratorios» cierra este cuadro y abre `openLabSoloModal(apt,{libre:true})` (≈25407):
el stepper de 3 pasos que acaba de ver no aplica y «Cancelar» del nuevo cuadro no vuelve aquí.

Al abrir, sin esperar al paso 2, ya corre la red: `_preseleccionarSugerencia()` (≈26917) →
`renderDayChips` → `cargarHoras()` (≈26291) **y además** `_rumTramo("agm.abrir", () =>
cargarHoras(...))` (≈27219) vuelve a llamarla: el token invalida la primera, pero
`apiAccesoBuscarPaciente` (≈25621, `pacienteIdAcceso` aún null en las dos) y
`BuscarCitasDisponibles` se piden dos veces y «Buscando agendas de…» se repinta.

**Paso 2 — «Fecha y Turno Inteligente»** (≈25135-25179). Qué ve: rótulo interno
«**2** Plazo y fecha objetivo (±7 días hábiles + sábados)» con chips «15 días … 6 meses»,
«⚡ Primer cupo disponible», «📅 Elegir fecha en el calendario…»; banner de sugerencia
(labs-primero con fichas «Ya vencidos:»/«Vencen pronto:» o «🎯 Fecha de control sugerida…» o
uno de cuatro textos «💡 Sin sugerencia por ahora…»); enlace «❤️ Ver riesgo cardiovascular y
vigencias de exámenes»; chips de día `Mar 15/09 🎯`; línea «Servicio: … · Fecha deseada: …»;
píldora «Analizando historia clínica del paciente…» → «🔴/🟡/🟢 motivo»; rótulo interno
«**3** Horarios disponibles en la agenda del servicio ?»; losetas «⭐ SUGERIDO · 07:00 —
Profesional (15/09/2026)», «● 07:20 …», «✓ 08:00 …», «+ ADICIONAL», «⚠ SOLO SI NO HAY OTRA
CITA»; pie «↩ Atrás» / «Siguiente: Confirmación ➔» (deshabilitado hasta elegir turno).

Fricciones observadas:
- Los números «2» y «3» dentro del paso 2 no son los del stepper («2 Fecha y Turno», «3
  Confirmación»): dos numeraciones distintas en la misma pantalla (≈25080-25084 vs 25138/25170).
- Sin sugerencia, «Siguiente: Confirmación» queda apagado y **la explicación** («Elija un
  horario para continuar») se escribe en `confirmBtn`, que vive en el paso 3 oculto
  (≈26070-26072). En el paso 2 no hay ninguna frase que lo diga.
- `_sondearAgendaDeCadaDia` (≈26295-26320) hace `btn.remove()` de los chips sin agenda **en
  segundo plano**: los chips se corren hacia la izquierda mientras el médico apunta con el
  ratón (dos en vuelo, ~4,7 s por consulta según la telemetría citada en ≈25788).
- «⚡ Primer cupo disponible» recorre hasta 30 días hábiles en serie (≈26430-26469); la nota
  cambia día a día pero no hay botón «Detener»: solo se cancela tocando un plazo o el
  calendario (`_pcCancelar`).
- «❤️ Ver riesgo…» abre `openTableroModal` → `openPanelPacienteModal` (≈26481-26485), que
  puede encadenar el reconciliador (`#vgl-confirma-modal`) y el llenado
  (`#vgl-llenar-modal`) **encima** del Agendar: tres capas para una consulta rápida.

**Paso 3 — «Confirmación»** (≈25182-25250). Qué ve: «Resumen de la Cita a Asignar» (Servicio,
Médico, Fecha del Control, Horario Asignado, Notificación SMS); «Programa al que se carga la
cita» (select, **primer programa preseleccionado** ≈25745) ; «¿Es cita para actividades del
programa RCV / Prevención?» (marcado); «📱 Enviar SMS de recordatorio al paciente» (marcado) +
«Celular:» + «— verifíquelo antes de confirmar»; tarjeta «🧪 Agendar también la Toma de
Muestras — toma **10/09/2026** → control **17/09/2026**» con checkbox, nota de SMS y botón
«✎ Cambiar fecha u hora» (la hora está **plegada** en `#vgl-agm-plan-det.vgl-d-none`,
≈25227); «Observaciones»; pie «↩ Modificar / Atrás» / botón de confirmar.

El botón de confirmar cambia de rótulo cinco veces: nace «✓ Confirmar y asignar cita»
(≈25248), pasa a «✓ Sí, Crear Cita» (≈25589), a «Elija un horario para continuar» (≈26071),
a «✓ Sí, Crear Cita en Medicina General (Control) (07:00)» (≈26046) y, al pulsarlo, a hasta
tres avisos consecutivos de «pulse otra vez» (≈26978-27008):
«⚠ Hace N s se empezó a crear una cita … pulse otra vez SOLO si no existe», «⚠ Hoy ya se le
creó una cita (…) — pulse otra vez SOLO si quiere crear OTRA», «⚠ Con esta fecha, Glicemia
llegaría vencido — pulse otra vez para continuar igual». La leyenda de cabecera (≈25093)
sigue diciendo «nada se confirma hasta que pulse "Confirmar y asignar cita"», un rótulo que
el botón ya no lleva cuando de verdad se puede pulsar.

**La toma de muestras dentro de «Control + Labs» — el punto donde el flujo se rompe**

- Modo normal: `cargarHorasLab` deja el checkbox **desmarcado** (`_chkPorDefecto=false`,
  ≈26083, 26122) y la hora oculta. Para que la toma exista el médico debe: (1) pulsar
  «✎ Cambiar fecha u hora», (2) elegir hora en el select, (3) marcar la casilla. La tarjeta de
  tipo prometía «pre-agenda la toma de muestras 5 días hábiles antes. (Recomendado)» (≈25103).
- Modo labs-primero: la casilla nace **MARCADA** (≈26122) pero la hora sigue en
  «— elija la hora de la toma —» (≈26113) **y plegada**. La línea visible dice «— toma
  10/09/2026 → control 17/09/2026» sin hora (`_pintarPlanHora` no escribe nada si no hay
  valor, ≈26462).
- Confirmar **no valida** `selectedLabTime` cuando `isLabChecked` (≈27056-27057, 27164-27168).
  Con hora vacía, `apiLaboratorioAgendarAuto` no encuentra turno (≈27573 `horaSeleccionada`
  falsy) y falla con el motivo «el horario de laboratorio elegido (**vacío**) ya no está
  disponible» (≈20606-20607, `format12hTime("")` devuelve ""), que luego se muestra como
  motivo real en el toast ámbar, el panel post-cita y el botón (C4). El médico lee que «su»
  hora se ocupó cuando nunca eligió ninguna; la cita de control ya quedó creada.

**Aviso de vencimiento en el segundo momento**: al confirmar, si la toma deja vencer un
examen, se llama `_pintarAvisoVencimiento()` (≈27005) que escribe en `#vgl-agm-vencaviso` —
un contenedor que vive **dentro de `#vgl-step-view-2`** (≈25157), oculto en el paso 3. El
botón «🎯 Pasar a la fecha sugerida» existe pero no se ve; lo único visible es el texto del
botón de confirmar.

**Éxito**: botón «✅ ¡Cita Creada Exitosamente!» → «⏳ Cita creada · agendando la toma de
muestras…» → panel `#vgl-postcita-panel` «✅ Cita creada» (nombre · fecha · hora · servicio;
«🖨️ Imprimir recordatorio de cita»; «📱 Reenviar el recordatorio al celular» con campo y
«Enviar mensaje»; bloque «Toma de laboratorio 10/09/2026 · 06:20 AM» + «Imprimir recordatorio
de la toma»). El Agendar se cierra solo a los 2,6 s (≈27203); el post-cita **se cierra solo a
los 5 min** (≈22192) aunque el médico esté escribiendo el celular de reenvío.
Fallo de la toma: ámbar persistente arriba-derecha (≈27177) + línea roja en el panel
(≈22005) + texto del botón (≈27185) **+** el `spToast` «🛡️ Centinela PyM · ⚠ …» 14 s
abajo-derecha (≈20607): cuatro canales para un hecho.

**Recorrido de clics (camino feliz, «Control + Labs» con sugerencia y ⭐ preseleccionado)**:
dock (1) → Siguiente (2) → Siguiente: Confirmación (3) → Cambiar fecha u hora (4) → hora (5)
→ marcar toma (6) → Confirmar (7) [+1 a +3 «pulse otra vez»]. Sin sugerencia: +plazo +turno.

### (c) Toma de muestras (apiLaboratorioAgendarAuto ≈20550, openLabSoloModal ≈27230)

- `openLabSoloModal`: «🧪 Toma de Muestras Pendiente» (o «🧪 Agendar Toma de Muestras» en
  libre) · «Cita de control ya agendada para el 17/09/2026» · «Elija el día de toma de
  muestras (sugerido: 10/09/2026 — miércoles)» · chips ±3 · «📅 Elegir fecha en el
  calendario…» · «Hora del Laboratorio:» select «— elija la hora de la toma —» · «Cancelar» /
  «Seleccione un horario» → «✓ Agendar Toma de Muestras». Aquí sí se exige hora (≈27494):
  el contrato es correcto y distinto del del Agendar.
- SMS de la toma: `EnviarMensajeTextoLaboratorio` (≈20699-20711) devuelve `smsEnviado` en el
  objeto de retorno, pero el propio comentario lo declara «informativo, sin llamador hoy»
  (≈20717): ni el Agendar (≈27192-27197) ni el LabSolo (≈27543-27552) lo pasan al panel
  post-cita. C5 cerró el desenlace del SMS de la **cita** (`_smsTextoDesenlace(ex.turnoId)`,
  ≈22057); el de la **toma** sigue sin decirse en pantalla. El médico no sabe si el paciente
  recibió la hora de la toma.
- Fallos: `spToast` con texto largo (hasta 8 horas libres listadas + «véalos en el panel») de
  14 s abajo-derecha; ese «panel» ya se cerró (2,6 s) cuando viene del Agendar — el propio
  comentario v12.3.33 lo reconoce (≈20600-20604).

### (d) Redacción IA (abrirRedactorTextoLibre ≈23258 → mtrAbrirPanelRedaccion ≈42318)

- Entrada: dock «✍ Redactar» o botones flotantes por casilla. Sin resumen en caché: toast AZUL
  «Leyendo los datos del paciente (laboratorios, medicamentos, historia)… el panel se abre en
  unos segundos.» (≈23269), 3-6 s; guarda de cambio de paciente (≈23283).
- Cuadro `#vgl-ia-modal`: «Redactar · Redacción asistida (IA)» · «Borrador desde los datos de
  la historia. Usted lo revisa, edita y firma.» · fila «Casilla de la historia» con chips
  «Enfermedad actual» «Análisis y plan» «Recomendaciones» + «?» · botón «Preguntar sobre este
  paciente (opcional)» · caja de pregunta (oculta) · «📎 La Enfermedad Actual se anclará en su
  control del …» (si hay carpeta) · textarea de indicaciones · botones «Generar» · «✕ Cancelar»
  (solo durante la generación) · «Copiar» · «Insertar en Enfermedad actual» · línea de estado ·
  textarea del borrador · «N palabras · N caracteres · modelo: …» · caja roja «⚠ Cifras sin
  respaldo…» (antes del texto) · pie de privacidad.
- Generar: estado «Generando con gemini-… · intento 2 de 7…» (≈42726, 42735): nombre técnico
  del modelo en la línea que el médico mira. Chips congelados durante la llamada.
- Análisis y plan sin categoría de riesgo: caja «Antes de la nota, faltan datos que la
  invalidarían» con select obligatorio (≈42564-42591) — decisión del médico, no fricción.
- Insertar: si la casilla no está a la vista, el cuadro se convierte en pastilla
  «⏳ Abriendo la pestaña Anamnesis…» abajo-derecha (≈42871, misma esquina que el `spToast`)
  y espera hasta 8 s (≈41395); casilla ocupada → «Reemplazar (queda Deshacer)» / «Dejarla como
  está» (≈42957-42959); éxito → «✓ Insertado en … Revise y guarde la historia usted. ↩ Deshacer
  → Siguiente: Análisis y plan.» y salta de chip solo.
- Copiar: `navigator.clipboard.writeText` sin `await` (≈42825) → «Copiado al portapapeles.» se
  imprime aunque la promesa rechace (documento sin foco), y se cuenta como adopción.
- Cerrar con borradores sin insertar: doble toque en ✕ en 8 s + toast ámbar (≈42455-42463).
  Escape hace lo mismo (pasa por `closeMod`), aunque el toast solo habla de ✕.
- Reconciliador (`mtrReconciliarAhora` ≈6007 → `_vglModalConfirmarDatos` ≈24756): cuadro
  «🔎 Las fuentes no coinciden» · «Antes de calcular nada con estos datos, confírmelos una
  sola vez…» · por ítem: etiqueta, «⚠ Usted ya respondió esto antes…», «A favor: …», «En
  contra: …», «Importa porque …», botones **«Sí tiene» / «No tiene»** (≈24795-24796) · ✕
  «Decidir luego». Los mismos botones se usan para «¿Repetir antes los exámenes fuera de meta
  de este paciente?» (≈5786), «¿El tratamiento para el colesterol es el adecuado (tipo y
  dosis)?» (≈5822) y «¿Está tomando su medicamento … como se le indicó?» (≈5823): «No tiene»
  no responde a esas preguntas, y el título habla de fuentes que no coinciden cuando solo hay
  preguntas de la escalera. Se refresca cada 20 s (≈24891).
- «Faltan antecedentes» (`vglModalLlenarCampos` ≈24160): «📝 Faltan antecedentes por
  documentar» · filas «Hipertensión arterial» «Diabetes mellitus» … con «Sí / No / **No sé**
  (activo)» · «Solo se llenan casillas vacías, y queda ↩ Deshacer.» · «Ahora no» / «Aceptar y
  llenar en Everest». Con todo en «No sé» el botón primario sigue diciendo «Aceptar y llenar
  en Everest», escribe 0 y avisa AZUL «No había ninguna casilla…» (≈24208-24211).
- Panel del paciente (≈24257): hasta **dos** cuadros previos en serie (reconciliador → llenar)
  antes de ver el Panel (≈24282-24319), cada uno con su salida propia.

### (e) Laboratorios, Exámenes, Próximo control, Ordenar

**Laboratorios** (`openLaboratoriosModal` ≈22642): «🧪 Laboratorios» · «Documento: … · Últimos
365 días» · leyenda · barra «Origen: consulta automática al sistema del laboratorio… ?» y la
chapa «**✓ En línea**» (≈22692) — HTML estático que **nunca cambia**, también cuando Athenea no
respondió y la tabla dice «⚠ No se pudo leer el portal de laboratorios» (≈22848). Recuadro
renal «calculando…» (C15 ✅). Tabla Fecha/Examen/Resultado/Rango/Fuente/Informe; uroanálisis
plegable «🔍 Ver N analitos». Pie «Abrir el portal oficial del laboratorio» / «Cerrar». Consulta
en vivo cada apertura (C11 🗳️ en curso).

**Exámenes** (`createLabInjectorUI` ≈7125 → `_vglChooserModal` ≈6971 →
`_ejecutarLlenadoExamenes` ≈7173): chooser «Exámenes» · «¿Qué resultados traigo a la historia?
(Enter: la de la última vez · 1/2: por número)» · «1 🧪 Última toma completa · la última vez»
/ «2 🗂 Historial por analito» (C20 ✅). Botón: «⏳ Buscando resultados de laboratorio…» →
«✓ 5 casillas escritas · 2 respetadas» (8 s, `_vglFeedbackBoton`) + «↩ Deshacer» al lado
(20 s visible, lote 5 min) + hasta cuatro toasts distintos por clic («Exámenes», «Exámenes ·
sin casilla», «Exámenes · fuera de rango», «Exámenes · casilla obligatoria», ≈7268-7313),
agrupados por paciente en el flush. Rutas de error honestas (null vs []). Bien resuelto; la
única carga es el número de avisos simultáneos cuando Athenea trae mucho.

**Próximo control** (`openPaquetesModal` ≈22516): «📦 Próximo control · Ordenamiento de
exámenes» · leyenda · chips «● Hipertensión / Diabetes / Renal» · «Para el próximo control»
(filas con «Vencido/Vence/Sin tomas/Sin fecha») · «Sigue vigente» · «📋 Ordenar pendientes» /
«Cerrar». Sin resumen en caché muestra «**No se pudo leer el resumen del paciente. Abra la
historia un momento (ahí se carga solo) y vuelva a abrir este módulo.**» (≈22628) — pero el
botón `📦` solo existe con la historia abierta (`_enModuloHCHealth` + `docId`, ≈7550-7551):
el médico ya está ahí; lo que pasa es que el cálculo automático aún no terminó. «Ordenar
pendientes» simula los clics de Conducta (`mtrConductaAgregarPendientes` ≈29030, esperas de
2,5-4 s por analito) con el modal encima: el médico ve «⏳ Agregando…» y nada más hasta el
toast final.

**Ordenar** (`openOrdenamientoModal` ≈28039): fase de carga «Verificando datos del paciente
antes de sugerir actividades… ⏳» con solo «Cancelar» (sexo + órdenes vigentes + Athenea en
vivo si no hay precarga); lista «N Actividades de prevención para este paciente» con casillas
premarcadas/bloqueadas y notas verdes («Ya existe una orden vigente…», «Este examen ya se
realizó…», «Esta orden ya se generó hoy desde aquí…»), aviso «No fue posible consultar el
sistema de laboratorio…» cuando Athenea no responde (regla D), botón «Generar N órdenes» /
«Seleccione al menos una actividad» / «Sin actividades para ordenar».
Al pulsar «Generar»: `window.open("", "_blank")` **en el clic** (≈28420) abre y enfoca una
pestaña en blanco; el botón pasa por «Consultando la información del paciente…» → «Generando
VIH… (1 de 2)» en la pestaña de atrás; al terminar navega la pestaña en blanco al PDF de la
primera orden. El bloque verde «2 órdenes generadas correctamente · Número de la orden: …»,
los botones «Imprimir orden de VIH» y el envío por correo quedan en la pestaña de Everest,
detrás. Durante el lote, ✕ y «Cancelar» siguen activos (≈28060-28067, 28423 solo deshabilita
`confirmBtn`): cerrar a mitad conserva las marcas (v18.0.63) pero **pierde** los botones de
imprimir y el correo de las órdenes ya creadas.

---

## FASE 2 — Tabla consolidada de fricciones

| # | Módulo | Fricción (qué ve / qué pasa) | Evidencia (función, línea ≈) | Gravedad | Propuesta concreta |
|---|---|---|---|---|---|
| 1 | Agendar · toma | «Control + Labs» con la casilla de toma marcada (labs-primero) o marcada a mano, **sin hora** (el select vive plegado tras «✎ Cambiar fecha u hora»). Confirmar no lo valida: la cita se crea y la toma falla con el motivo falso «el horario de laboratorio elegido () ya no está disponible» en toast, panel y botón | `cargarHorasLab` 26083/26113/26122; plantilla 25220-25240; `confirmBtn` 27056-27057, 27164-27168; `apiLaboratorioAgendarAuto` 20573-20607; `format12hTime("")` 20530 | **alta** | ✂️ En el clic de confirmar: `if (isLabChecked && !selectedLabTime)` → desplegar `#vgl-agm-plan-det`, `focus()` al select y botón «Elija la hora de la toma (o desmarque la casilla)»; y en `cargarHorasLab`, si `_chkPorDefecto` deja la casilla marcada, desplegar el detalle automáticamente. En `apiLaboratorioAgendarAuto`, con `horaSeleccionada` vacía, motivo propio: «no se eligió hora de la toma» |
| 2 | Agendar · vencimiento | Al pulsar Confirmar en el paso 3, el segundo aviso «esta fecha deja vencer un examen» se pinta en `#vgl-agm-vencaviso`, que está **dentro del paso 2 oculto**; el botón «🎯 Pasar a la fecha sugerida» no se ve; solo queda el texto del botón «pulse otra vez para continuar igual» | plantilla 25157 (dentro de `#vgl-step-view-2`); `_pintarAvisoVencimiento` 26699-26758; llamada 27005 | **alta** | ✂️ Mover `#vgl-agm-vencaviso` fuera de las vistas (debajo del stepper) o, en 27005, clonar su HTML en `#vgl-summary-box` con los dos botones cableados; alternativa mínima: `irAPaso(2)` antes de pintarlo |
| 3 | Toma · SMS | El SMS de la **toma** (`EnviarMensajeTextoLaboratorio`) devuelve `smsEnviado` pero nadie lo lee: el panel post-cita muestra «Toma de laboratorio 10/09/2026 · 06:20 AM» sin decir si el paciente recibió el mensaje. C5 solo cubrió el SMS de la cita | `apiLaboratorioAgendarAuto` 20696-20722 (comentario «sin llamador hoy» 20717); `_cierreCtx.extra.lab` 27192-27197; LabSolo 27543-27552; `mostrarPanelPostCita` 22001-22004 | **alta** | ✂️ Añadir `sms: labOk.smsEnviado ? "enviado" : (celular ? "no confirmado" : "sin celular")` a `extra.lab` en los dos llamadores y una línea «📱 SMS de la toma: …» en `bloqueLab` |
| 4 | Agendar · confirmar | El botón de confirmar es el canal de tres avisos encadenados («vuelo ajeno», «ya se le creó una cita hoy», «llegaría vencido»), cada uno de ~100 caracteres y cada uno exigiendo otro clic (≥700 ms); el médico puede pulsar hasta cuatro veces sin ver un solo cuadro de decisión | 26964-27008; guarda 26967 | media | ✂️ Un recuadro `#vgl-agm-confirm-aviso` encima del pie con el texto y dos botones («Sí, crear igual» / «Revisar»); el botón conserva el rótulo. Misma doble confirmación consciente, pero legible y con salida explícita |
| 5 | Dock | Mientras el resumen automático no termina, el dock no muestra Panel ni «Faltan antecedentes» ni un sustituto: el sexto botón aparece de golpe 3-6 s (o más) después | `createAccionesDockUI` 7593, 7747-7771; `autoCalcularResumenSiNecesario` 7524 | media | ✂️ Rama `else if (_autorizado && !_resumenListoParaGate)`: botón `disabled` «🧾 Panel · leyendo…» (mismo patrón de «· actualizando…» de C3) |
| 6 | Próximo control | Sin resumen: «Abra la historia un momento (ahí se carga solo) y vuelva a abrir este módulo», estando el médico dentro de la historia (el botón solo existe ahí) | `openPaquetesModal` 22628; dock 7550-7551, 7796-7805 | media | ✂️ Texto «Todavía estoy leyendo los exámenes de este paciente (unos segundos)» + botón «Reintentar» que llama `mtrCalcularResumenClinico(apt, vivo)` y repinta; o esperar en el propio modal con `⏳` hasta que `mtrCacheResumenLeer` devuelva |
| 7 | Toma · avisos | Toma fallida = cuatro canales a la vez: `spToast` «🛡️ Centinela PyM · ⚠ …» (14 s, abajo-derecha) + toast ÁMBAR persistente (arriba-derecha) + línea roja del post-cita + texto del botón | `spToast` 20564, 20607, 20647, 20681; C4 27177-27185 | media | ✂️ Parámetro `opts.silencioso` en `apiLaboratorioAgendarAuto` (true desde `_agmAgendarLabConCandado` cuando hay modal vivo) que omite el `spToast`; el HUD queda para el robot |
| 8 | Toasts | >3 avisos en 500 ms → «Alerta Múltiple (N) — 3 alertas críticas y 1 rutinarias recibidas.» sin ningún título: el médico no sabe de qué se trata ni de quién | `showToast` 14527-14533 | media | ✂️ Cuerpo = `agrupados.map(t => "• " + t.title).join("  |  ")` (mismo formato que `_agruparToasts`, 14511) |
| 9 | Agendar · chips | `_sondearAgendaDeCadaDia` borra chips de día sin agenda en segundo plano: los chips se corren bajo el cursor y el clic cae en otro día | 26315-26318 | media | ✂️ `btn.disabled = true; btn.title = "Sin agenda ese día"; btn.classList.add("vgl-agm-pbtn-sinagenda")` en vez de `remove()` |
| 10 | Agendar · paso 2 | «Siguiente: Confirmación ➔» apagado sin explicación; la frase «Elija un horario para continuar» se escribe en el botón del paso 3, invisible | 26070-26072, 25596 | media | ✂️ Espejar en `step2Next`: `textContent = "Elija un horario para continuar"` / `title`, y restaurar «Siguiente: Confirmación ➔» al elegir turno (26047) |
| 11 | Reconciliador | Botones fijos «Sí tiene / No tiene» y título «🔎 Las fuentes no coinciden» también para «¿Repetir antes los exámenes fuera de meta…?», «¿El tratamiento … es el adecuado?», «¿Está tomando su medicamento…?» | `_vglModalConfirmarDatos` 24795-24796, 24806; preguntas 5786, 5822-5823, 5833 | media | ✂️ Campos opcionales `rotuloSi/rotuloNo` en cada pregunta («Sí, repetir / No, esperar», «Sí, adecuado / No», «Sí lo toma / No lo toma»); título «🔎 Antes de calcular, unas preguntas» cuando ninguna discrepancia tiene `afirman` y `niegan` de fuentes reales |
| 12 | Panel | Hasta dos cuadros previos en serie (reconciliador → «Faltan antecedentes») antes del Panel, cada uno con su propia salida («Decidir luego», «Ahora no») | `openPanelPacienteModal` 24282-24319 | media | ⚖️ Un solo cuadro con dos secciones («Confirme» / «Complete») y un único «Abrir el Panel sin responder»; o indicador «1 de 2» en cada cuadro |
| 13 | Ordenar | «Generar» abre y **enfoca** una pestaña en blanco en el clic; el progreso («Generando VIH… (1 de 2)»), el bloque verde, «Imprimir orden de…» y el correo quedan en la pestaña de atrás | 28420, 28578-28586 | media | ⚖️ (decisión «como Everest») Alternativas: `window.open(...)` con `noopener` y `blur()`+`window.focus()` inmediato para volver a Everest; o abrir el PDF solo desde el botón «Imprimir orden de…» (ya existe) y anunciarlo en el bloque verde |
| 14 | Ordenar | ✕ y «Cancelar» siguen activos durante el lote; cerrar a mitad pierde los botones de imprimir y el correo de las órdenes ya creadas (las marcas sí se guardan) | `closeMod` 28060-28067; 28423 solo `confirmBtn.disabled` | media | ✂️ `xBtn.disabled = cancelBtn.disabled = true` con `title="Espere: generando órdenes"` mientras `_ordGenerandoDocs.has(_kOrd)`; rehabilitar en el `finally` (28517) |
| 15 | Aviso universal | «Pendientes de este paciente» es de un solo uso por jornada, cierra con clic fuera y no hay forma de volver a verlo desde el dock | `avisoUniversal` 14219; `checkAvisoUniversal` 14279-14288; dock 7626-7805 | media | ⚖️ Guardar los `datos` del aviso por paciente en RAM y añadir al dock una pastilla «🩺 Pendientes (3)» de solo lectura que lo reabre |
| 16 | Agendar · apertura | `cargarHoras` corre dos veces al abrir (vía `renderDayChips` y de nuevo en `_rumTramo("agm.abrir")`): «Buscando agendas…» se reinicia, `BuscarPaciente`/`BuscarCitasDisponibles` se piden dos veces. C19 lo daba por cerrado: verificar con el arnés | 26291, 26917, 27219, 25620-25621 | media | ✂️ Quitar la llamada de 27219 o condicionarla a `!selectedDateInfo`; medir con `tests/harness.js` cuántos `BuscarCitasDisponibles` salen al abrir |
| 17 | Laboratorios | Chapa «✓ En línea» estática aunque Athenea no haya respondido y la tabla diga «No se pudo leer el portal» | 22692 vs 22846-22848 | baja | ✂️ Tras la lectura: `srconline.textContent = _noSePudoLeer ? "⚠ Sin respuesta del laboratorio" : "✓ En línea"` con clase de color `!important` (regla CSS de CLAUDE.md) |
| 18 | Agendar · rótulos | Numeración doble: stepper «1 Tipo · 2 Fecha y Turno · 3 Confirmación» y dentro del paso 2 «2 Plazo…» y «3 Horarios…»; la leyenda promete el botón «Confirmar y asignar cita», que ya se llama «✓ Sí, Crear Cita en … (07:00)» | 25080-25084 vs 25138/25170; 25093 vs 25589/26046/26061 | baja | ✂️ Quitar los `<span class="vgl-agm-step">` internos (o «2a/2b»); un solo rótulo de confirmar «✓ Confirmar y asignar cita · 07:00» y añadirlo a `VGL_ROTULOS` para que la prueba de C9 lo vigile |
| 19 | Redactor | «Copiar» anuncia «Copiado al portapapeles.» sin esperar la promesa; si el documento no tiene foco el texto no se copia y además se cuenta como adopción | 42823-42836 | baja | ✂️ `await navigator.clipboard.writeText(...)` dentro del `try`; el `catch` ya existe |
| 20 | Redactor | Estado «Generando con gemini-2.5-… · intento 2 de 7…»: nombre técnico del modelo en la línea principal | 42726, 42735 | baja | ✂️ Estado «Generando el borrador… (intento 2 de 7)»; el modelo solo en `#vgl-ia-meta` (ya se pinta ahí) |
| 21 | Post-cita | El panel se cierra solo a los 5 min aunque el médico esté escribiendo el celular de reenvío (cuadro de ESCRITURA que no cierra con clic fuera pero sí por reloj) | 22192 | baja | ✂️ Antes de cerrar: si `#vgl-postcita-smsto` tiene foco o cambió respecto a `ex.celular`, reprogramar 5 min más |
| 22 | Agendar · programa | «Programa al que se carga la cita» preselecciona el primero de la lista sin aviso cuando el paciente tiene varios | 25742-25747 | baja | ⚖️ Con `progs.length > 1`, opción inicial «— elija el programa —» y validar en confirmar; con uno solo, preseleccionar (regla «casilla vacía antes que dato supuesto») |
| 23 | Agendar · primer cupo | «⚡ Primer cupo disponible» recorre hasta 30 días hábiles en serie (3 llamadas por día) sin botón para detenerlo | 26421-26475; `_pcCancelar` solo desde plazo/calendario | baja | ✂️ Mientras busca, el mismo botón pasa a «✖ Detener búsqueda» y llama `_pcCancelar()` |
| 24 | Faltan antecedentes | Con todas las filas en «No sé» el botón primario sigue diciendo «Aceptar y llenar en Everest»; escribe 0 y abre el Panel | 24173-24187, 24208-24211 | baja | ✂️ Si `respuestas` no tiene ningún true/false, rotular «Abrir el Panel sin llenar» |
| 25 | Agendar → LabSolo | «SOLO Laboratorios» cierra el Agendar y abre otro cuadro sin stepper; su «Cancelar» no vuelve al paso 1 | 25407-25409; 27311 | baja | ⚖️ Tratar «SOLO Laboratorios» como paso 2 alternativo dentro del mismo cuadro, o «↩ Atrás» en LabSolo que reabra `openAgendamientoModal(apt)` |
| 26 | Agendar → Panel | «❤️ Ver riesgo…» abre el Panel encima del Agendar y este puede encadenar reconciliador y llenado: tres capas para una consulta rápida | 26481-26485; 24282-24319 | baja | ⚖️ Desde el Agendar abrir con `{saltarReconciliar:true, saltarLlenado:true}` y una nota en el Panel «Abierto desde Agendar: sin preguntas previas» |

---

## Observaciones que NO son fricción (para no perder tiempo re-auditándolas)

- `mtrRedactorModoSugerido` puede devolver «motivo_consulta» (primera clave de
  `MTR_CASILLAS_REDACTOR`, ≈41134) pero `mtrAbrirPanelRedaccion` lo descarta porque no está en
  `MTR_IA_MODOS` (≈42306) y cae a «enfermedad_actual»: comportamiento correcto.
- El banner «⚠️ Este paciente ya tiene una cita de control registrada para hoy» del Agendar
  (≈25088-25091) es inalcanzable desde el dock (con cita hecha el dock lleva a «Agendar labs»
  o «Recordatorio»); la anulación vive correctamente en el panel reabierto (≈22077-22079).
- `_vglAbrirAyudanteFaltan` (≈7489) sí nombra la pestaña: `mtrFactoresPendientesNavegables`
  compone «Hipertensión y Diabetes (Antecedentes)» (≈37858).
- El chooser de Exámenes y el de «Examen normal» (≈8314-8323) están bien resueltos (teclado,
  memoria, Escape).
