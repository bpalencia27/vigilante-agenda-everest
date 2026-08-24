# Registro de Novedades Clínicas — Vigilante de Agenda (Copiloto Everest PyM)

Bienvenido al registro de actualizaciones del **Vigilante de Agenda**. Este documento detalla las mejoras, correcciones y salvaguardas asistenciales incorporadas en cada versión para garantizar la seguridad de sus pacientes y agilizar su jornada de consulta médica.

---

## [Versión 17.6.10] — 2026-08-23 (Limpieza final: se retiran opciones de Ajustes y código muerto)

Auditoría línea por línea de las ~34.000 líneas del archivo para eliminar lo duplicado,
roto o sin uso. **Ninguna función con uso real se tocó**: el contrato de escritura, el
kill-switch, la regla de "casilla vacía antes que dato inventado" y todos los interruptores
vivos de Ajustes quedan intactos. Lo que se retiró tenía cero llamadores en producción.

### ⚙️ Panel de Ajustes — claves muertas
- `recordatorioPym`: nacía `true` pero nada en producción la leía (el canal del recordatorio
  lo deciden hoy `avisoPymModal` y el chip del dock).
- `opcionesTecnicas`: el modo programador real usa `_vglProgOn` (Modo programador en Ajustes);
  la clave sobraba desde v12.0.0.

### 🧹 Funciones y datos sin llamador
- `_textoImplausibles`: el aviso por valores fuera de rango se construye en línea en el
  botón Auto-Labs desde v17.6.8; la función quedó huérfana.
- `fechasAmbiguas`: se llenaba en Auto-Labs pero nunca se leía (el `console.warn` de la
  fecha compartida se conserva).
- `lastAutoResumenDoc`: se escribía, nunca se leía (se conserva `lastAutoResumenAt`).
- `isPanelHiddenActivity`/`panelActivities`: el filtro AV/OD del panel vive en línea en
  `pymPendientesRestantes`; las dos funciones no tenían llamador.
- `calcTargetDateRange`: reemplazada hace versiones por `calcRangoSondeoIso` y
  `calcDateRangeAroundIso`.
- `mtrLeerFactoresRCV`: stub que nunca devolvía datos (endpoint sin capturar); el lector real es
  `mtrLeerFactoresRcvDelDom`.
- `mtrPartirNota`/`mtrInsertarNota`: la inserción actual es por modo
  (`mtrInsertarEnCasillaModo`/`mtrInsertarSiVacia`), nunca por nota partida.
- `MTR_IA_MODOS_LEGADO`: ningún llamador vivo pasa modos retirados; un modo desconocido
  cae en "Enfermedad actual" sin reventar.
- Trazabilidad muerta del lector de factores (`_origen`, `_dePantalla`, `_deArchivo`,
  `_deCabecera`, `_confirmadoContraHistoria`, `_sinDocumentar`): nada las leía; se
  conservan `_leidos`, `_documentados` y `_total`.
- `preferirTarde`: parámetro muerto en la llamada a `mtrPlanParaclinicos` (retirado en
  v16.9.0).

### 🧪 Verificación
- Suites 02, 15, 21, 31, 39, 46, 57 y 58 actualizadas al contrato nuevo (se retiran los
  casos que probaban el código eliminado; suite_57 conserva el contrato de los modos
  vigentes). Mutación verificada (re-agregar `mtrPartirNota` no pone roja ninguna prueba:
  confirma que era código muerto). Banco completo en verde: **1.908 comprobaciones, 0 en
  rojo** (1919 en 17.6.9; −11 casos retirados).

---

## [Versión 17.6.9] — 2026-08-23 (Menos notificaciones: se consolidan los avisos duplicados)

Reporte de consultorio: "muchas notificaciones sobre lo mismo". El panel consolidaba por paciente el toast ANTIGUO al pintar el nuevo, pero la cola podía apilar varios avisos del mismo paciente en el mismo instante (p. ej. "Cierre de consulta" + "Espera prolongada" del mismo tick).

- **Sin duplicados del mismo aviso**: si el mismo aviso del mismo paciente (misma clave de cita + mismo título) llega dos veces en el mismo instante, solo se muestra una vez.
- **Una sola tarjeta por paciente**: los avisos distintos del mismo paciente se combinan en una única tarjeta («2 avisos de este paciente» con los dos motivos), en vez de apilarse. Si alguno es crítico, la tarjeta combinada es crítica.
- Los avisos globales (pausa, 20-20-20, Auto-Labs) se conservan aparte, y "Alerta Múltiple" ahora cuenta ya consolidado.

### 🧪 Verificación
- Suite 42 ampliada a 32 comprobaciones con mutación verificada (quitar la agrupación cae a rojo); banco completo en verde: **1.919 comprobaciones, 0 en rojo**.

---

## [Versión 17.6.8] — 2026-08-23 (Correcciones de la auditoría de 5 módulos: agendamiento, PyM, laboratorios, panel del paciente y redacción IA)

Auditoría de código + UX sobre los cinco módulos clínicos; se implementaron los hallazgos P1/P2 con verificación por mutación.

### 🔴 PyM — Contrato de `markOrdenesCreadasHoy` (P1)
- Una llamada con 2 argumentos dejaba `det.actividades` sin escribir; mientras el campo faltaba, el aviso del paciente caía al fallback de "marca de versión vieja" y **silenciaba VIH, cérvix, mama, colon, próstata y CMB** el resto del día. Ahora la llamada guarda los agrupadores y las actividades reales, igual que su gemela.

### 📅 Agendamiento — Doble clic físico y festivos
- El botón de confirmar cita ignora un segundo clic a menos de 700 ms: el doble clic accidental ya no crea la segunda cita ni se salta los avisos "pulse otra vez" (antidup y vencimiento).
- `esFestivo()` delega al motor calculado (Ley Emiliani) para años fuera de la tabla 2024-2027: el agendamiento ya no queda ciego en 2028 y no citará tomas en festivo real sin decirlo.

### 🧪 Laboratorios — Uroanálisis y Auto-Labs
- Un parcial con valores no interpretables (p. ej. NITRITOS "ANORMAL") ya no sale como "SIN HALLAZGOS": el motor devuelve **CONFIRMAR** y le pide al médico decidir con el valor delante.
- El bloqueo por plausibilidad de Auto-Labs deja de ser mudo: el botón ahora avisa qué valores NO se escribieron y por qué rango oficial.

### 🧑⚕️ Panel del paciente — Aviso único y nebivolol
- El aviso del paciente se **pinta antes de marcarse como visto**: si el render falla, el aviso queda pendiente y el siguiente tick lo reintenta (antes se perdía para toda la jornada).
- Nebivolol entra a la familia de hipertensión: ya no desaparece de los medicamentos RCV del Panel ni genera la pregunta espuria "medicamentos: ninguno".

### 🤖 Redacción IA — Privacidad
- La migración de estreno solo aplica a equipos que ya tenían configuración previa: las **instalaciones nuevas respetan los valores de fábrica** (IA, telemetría y reporte apagados) en vez de activar el envío a Gemini por sí solas.
- El censor de texto libre ahora tacha **teléfonos fijos** (601/604/…/800), no solo móviles 3xx — sin pisar cédulas (la clase no incluye el 1).
- Las fechas de agenda (tope de exámenes y control) se **relativizan** al prompt (`en 9 días`, `en ~2 meses`): misma información clínica, sin cuasi-identificadores fuera del equipo.

### 🧪 Verificación
- Nueva suite 69 (6 casos) con mutación verificada (la delegación de festivos que se quita cae a rojo); suites 02 y 57 actualizadas al comportamiento corregido; banco completo en verde: **1.916 comprobaciones, 0 en rojo**.

---

## [Versión 17.6.7] — 2026-08-23 (Cierre de turno: checklist, espera prolongada, seguimiento, adherencia y fin de turno)

Todo lo nuevo va **apagado por defecto** y se enciende desde Ajustes → grupo "Turno (avanzado)".

### ✅ Recordatorio de cierre de consulta
- Al pasar a «Atendido», si el paciente tiene **exámenes vencidos o pendientes de toma** en su plan, un aviso suave sugiere verificar que se ordenaron y entregaron todo. Una sola vez por cita, solo en transiciones observadas (un arranque tarde no avisa lo que ya pasó).

### ⏰ Espera prolongada en sala
- Si un paciente lleva más de **N minutos** en sala (configurable: 20/30/45/60), un aviso suave lo recuerda. Una sola vez por cita, reusa el cronómetro existente.

### 📅 Seguimiento sugerido (control)
- El Resumen del turno ahora puede mostrar, para los **atendidos del día** con plan en caché, la **fecha de control que sugiere el plan de exámenes** (toma de laboratorio + control), con su motivo. Es solo una sugerencia: el médico decide.

### ⚠️ Inasistencias previas en la tarjeta
- La tarjeta del paciente muestra cuántas **inasistencias registradas** tiene de días anteriores (`⚠ 3`). El historial se alimenta solo cuando el Vigilante observa «sin presentarse» con tolerancia vencida — el mismo evento del semáforo ámbar — y vive **solo en este computador**, sin duplicar el mismo día. El no-show de hoy no cuenta como «previo» (la tarjeta ya lo pinta ámbar).

### 🏁 Fin de turno
- Nuevo botón en el Resumen del turno que arma el **resumen de la jornada** (citas, atendidas, en sala, sin presentarse, extemporáneas) y lo copia al portapapeles, listo para el reporte.

### 🧪 Verificación
- Suite 31 ampliada a 14 casos con mutación verificada (el historial de inasistencias que no suma cae a rojo); censo de blindaje `!important` actualizado a **348**; banco completo en verde: **1.910 comprobaciones, 0 en rojo**.

---

## [Versión 17.6.6] — 2026-08-23 (Bienestar del turno largo: pausas activas, regla 20-20-20 y cronómetro del paciente en sala)

Todo lo nuevo va **apagado por defecto** y se enciende desde Ajustes → grupo "Bienestar (turno largo)".

### ☕ Recordatorio de pausas activas
- Aviso configurable cada `N` minutos (por defecto **90**): un cartel sugiere levantarse, estirar y volver a la pantalla. Se reprograma solo mientras esté activo; apagarlo limpia el próximo aviso.

### 👀 Regla 20-20-20 (descanso visual)
- Aviso cada `N` minutos (por defecto **20**): cada 20 minutos, mirar algo a **20 pies** durante **20 segundos** — pauta clínica contra la fatiga ocular del turno largo.

### ⏱ Cronómetro del paciente en sala
- Junto al nombre de cada paciente en sala, el panel ahora muestra **cuánto lleva esperando** (`⏱ 12m`, se actualiza cada minuto). Solo aparece para los que están en sala; se reinicia cada día con el cambio de turno.

### 🧪 Verificación
- Suite 31 ampliada a 8 casos (programación de pausas, canal "bienestar", cronómetro por paciente) con mutación verificada del cronómetro; censo de blindaje `!important` actualizado a **345**; banco completo en verde.

---

## [Versión 17.6.5] — 2026-08-23 (Turno largo: reloj, alto contraste, atajos y ancho ajustable)

### 🕐 Reloj del turno en la cabecera del panel
- La cabecera ahora muestra la **hora actual + tiempo de jornada** (p. ej. `14:03 · 6h12m`), para que el médico no pierda la noción del tiempo dentro de la consulta.
- Si la última lectura real de la agenda supera los **30 segundos**, el reloj se pone **ámbar** y el tooltip indica a qué hora fue la última lectura — el dato nunca se cree fresco sin serlo.

### 🔆 Alto contraste de 1 clic
- Nuevo botón en la cabecera (sol): activa **fondo sólido + letra más grande** en todo el asistente sin entrar a Ajustes. Transitorio (como el silencio de 15 min): al recargar vuelve el tema normal.

### ⌨️ Atajos de teclado nuevos
- `Alt+R` → abre el panel directo en el **Resumen del turno**; `Alt+A` → **Ajustes**; `Alt+M` → **silenciar/reactivar 15 min** (sin soltar el teclado). Se suman a `Alt+V` (mostrar/ocultar).

### 📏 Ancho del panel ajustable
- Borde izquierdo arrastrable (420–980 px) con persistencia entre recargas: el panel se adapta a monitores de 1366×768 o de 1920+ sin cambiar el layout interno.

### 🖱 Dock
- Doble clic en la pastilla "Asistente Clínico" abre el panel directamente en el **Resumen del turno**.

### 🧪 Verificación
- Nueva suite 31 (reloj, alto contraste, ancho) con mutación verificada; censo de blindaje `!important` actualizado a 342; banco completo en verde: **1.901 comprobaciones, 0 en rojo**.

---

## [Versión 17.6.4] — 2026-08-23 (Blindaje del Resumen del turno · azul de Everest erradicado de la hoja)

### 🎨 Resumen del turno y Ajustes ya no se pintan con el azul de Everest
Se reprodujo el reporte de consultorio en Chromium real con el CSS hostil de Everest cargado por delante: **todo el texto del Resumen del turno** (título, cifras KPI, rótulos, leyenda del gráfico, encabezados, conteos, etiquetas de barras, campos y botones) salía en `rgb(31, 78, 121)` — el azul oscuro de la Historia Clínica. La hoja vivía dentro del panel y había quedado fuera del blindaje anterior.
- Se blindaron con `!important` las 23 declaraciones de color de la hoja y su base: `#vgl-root`, `#vgl-sheet`, título, labels y pistas de los campos, números y rótulos de los KPI, cap del gráfico, leyenda, conteos, etiquetas de barras, campos de Ajustes y todos los botones `.vgl-btn` (base, primario, on y off).
- Re-verificado con el script real en navegador: **0 fugas de azul de Everest en tema claro y oscuro**; los KPI conservan su rojo/ámbar/verde clínico y los botones su color de acción.
- Banco completo en verde: **1.896 comprobaciones, 0 en rojo**, con mutación verificada (el censo de `!important` cae a rojo si se quita una marca) documentada en `tests/INFORME_MUTACIONES.md`.

---

## [Versión 17.6.3] — 2026-08-23 (URL real de producción + blindaje visual verificado en navegador real)

### 🔗 Compatibilidad con la URL real de la Historia Clínica
- El Vigilante se ejecuta en `https://neps.everestintelligent.com/viva/EverHealth/HCHealth` — con el segmento `EverHealth/` entre `/viva/` y `HCHealth`. La guardia del módulo clínico solo reconocía la ruta de la captura original (`/viva/HCHealth/`), así que en la página real el panel **ni siquiera aparecía** (se ocultaba por completo al considerarla fuera del módulo). Ahora se aceptan las dos formas y el panel se muestra donde usted trabaja.

### 🎨 Blindaje visual confirmado en Chromium real (CSS hostil de Everest por delante)
Se verificó el diseño con el script completo corriendo en un navegador real sobre la estructura real de Everest, midiendo el color y el contraste de cada elemento con el CSS agresivo de Everest cargado antes (la misma prueba que exige el protocolo del proyecto). Se corrigieron tres puntos donde el azul de Everest se colaba:
- **Modal de Redacción IA:** el título ("✍ Redacción asistida (IA)"), el subtítulo y el rótulo de la casilla salían en azul de Everest; ahora usan los colores propios del tema (claro y oscuro).
- **Botones de los modales:** los botones secundarios y el botón principal (verde) salían en azul ilegible; ahora conservan su color en ambos temas.
- **Título del panel flotante:** salía en azul de Everest; ahora usa el color del tema.
- Contraste re-medido tras la corrección: **oscuro 20/20 elementos con AAA** (7.6:1–18.8:1) y **claro 9/9 en el modal de IA con AA+** (7.18:1–17.49:1).

### 🧪 Banco de pruebas saneado y ampliado
- El banco completo quedó en **1.896 comprobaciones en verde, 0 en rojo**, con el entorno de pruebas cargando por defecto en la URL real de producción.
- Se cerró un hueco del kill-switch: ahora se verifica que **los 13 temporizadores** del arranque queden registrados (incluido el chequeo de versión escalonado), para que la pausa de seguridad remota los cancele de verdad.
- Se alinearon las suites desactualizadas (riesgo cardiovascular con los pisos clínicos por diabetes y edad, festivos por algoritmo, burbujas del rediseño del modal, drivers de Conducta retirados) sin tocar la lógica clínica — solo se declaró lo que ya era decisión del médico en producción.

---

## [Versión 14.2.0] — 2026-08-17 (Estreno en consulta · 3 médicos)

### 🔔 Un solo aviso por paciente (menos ruido, más claridad)
- **Aviso único al abrir la historia:** las actividades de prevención (PyM) pendientes, el abandono del Programa de Riesgo Cardiovascular y los laboratorios RCV sin resultado vigente ahora se reúnen en **un solo cuadro** por paciente, en vez de varias ventanas seguidas. Menos interrupciones, toda la información de un vistazo.
- **Se retiró el banner de PyM** y los interruptores sueltos de alerta del menú de Ajustes (repetir sonido, ventana modal, pestaña parpadeando, ventana emergente): esos canales los maneja el sistema automáticamente. El aviso base de un ingreso extemporáneo (sonido + notificación de Windows) sigue saliendo siempre.

### ✍️ Redacción asistida por IA (Gemini)
- **Borrador de Enfermedad Actual y Nota Clínica** a partir de los datos de la historia, que usted revisa, edita y firma. Solo llena casillas vacías; nunca pisa lo que usted escribió.
- **A la IA solo se le envían datos clínicos SIN identificadores** (ni nombre, ni cédula, ni fechas): una hoja de hechos desidentificada por lista blanca.
- **Rotación automática de modelos:** ante un tope de cuota diaria, el asistente cambia solo al siguiente modelo gratuito disponible, sin que usted tenga que configurar nada.

### 💊 Motor de seguridad farmacológica ampliado (RCV)
- Más reglas de interacciones peligrosas y contraindicaciones por función renal, enfocadas en el riesgo cardiovascular (cardiología, diabetología, nefrología, endocrinología). **No ordena ni cambia nada: solo avisa.**

### 📊 Ayúdanos a mejorar (estadísticas de uso anónimas)
- Nueva opción **"Ayudar a mejorar el Vigilante"** (estilo Google): envía estadísticas de uso anónimas —qué funciones se usan, errores, rendimiento, aciertos/tiempos de la IA— para mejorar la herramienta para todos. **Nunca** se envían datos de pacientes ni el texto de los borradores. Puede apagarla cuando quiera desde Ajustes.

### 🔍 Auditoría final pre-producción (2026-08-18)
- **Uroanálisis:** se corrigió un caso donde un resultado en **cero** (p. ej. Hematíes o Leucocitos = 0, un hallazgo normal frecuente) no se registraba como resultado real y la casilla quedaba vacía.
- **Redacción IA — modo "Preguntar":** la pregunta libre que usted escribe ahora pasa por el mismo filtro de datos identificables que ya protegía los demás campos del panel de IA, reforzando la barrera antes de que cualquier texto salga hacia Gemini.
- **Resistencia a fallos inesperados:** el arranque del asistente y el refresco de la agenda ahora aíslan mejor un error puntual (por ejemplo, un dato atípico en una sola cita) para que no deje al Vigilante "mudo" el resto de la jornada.
- **Medicamentos activos y alertas de dosis renal en el panel de redacción IA:** se corrigió un cruce de identificadores que hacía que, en ciertos casos, el motor no reconociera los medicamentos ya cargados del paciente aunque Athenea sí los tuviera. La hoja de hechos para la IA y las alertas de dosis por función renal ahora reflejan siempre lo que el motor realmente encontró, en vez de quedar vacías por ese cruce.
- **Código muerto retirado:** cuatro bloques de funciones sin ningún llamador activo en el script (una migración de esquema y un "circuit breaker" en desuso, dos rutas de aviso ya reemplazadas por el aviso único, y el banner de PyM anterior) se eliminaron por completo, junto con sus pruebas dedicadas — menos superficie que mantener, mismo comportamiento clínico para el médico.
- **Tiempo de gracia del aviso único, corregido:** antes se contaba en "vueltas" del refresco automático de la agenda —configurable por cada médico entre 2 y 120 segundos—, así que la espera real a que Athenea resolviera los laboratorios variaba según ese ajuste, sin relación con lo que Athenea de verdad tarda; además, un único contador compartido entre pacientes podía perder la cuenta si se revisaban dos historias casi al tiempo. Ahora la espera es un tiempo real fijo, contado por separado para cada paciente.
- **Menos datos en los registros internos de diagnóstico (consola del navegador):** varios mensajes de diagnóstico traían de más —la cédula del paciente, el objeto completo de un resultado de laboratorio, hasta 1.740 caracteres de la tarjeta de solicitud de Athenea, o la respuesta cruda de las llamadas para agendar citas, asignar turnos y enviar órdenes por correo—. Se recortaron a lo mínimo necesario para depurar (nombres de campos, códigos de estado, sí/no), sin perder utilidad para detectar fallas.

### 🗂️ Backlog de mejoras, segunda pasada (2026-08-18)
- **Checkbox RCV/Prevención, ahora honesto:** para los médicos cuya agenda completa se registra siempre como RCV/Prevención (encargo del consultorio), el checkbox del modal de agendamiento no tenía ningún efecto real pero seguía mostrándose editable. Ahora sale marcado y **deshabilitado** para ellos, con una nota explicando por qué; para el resto de médicos sigue siendo una elección real. La lista de médicos y la comprobación se unificaron en un solo sitio para que el checkbox y el guardado nunca puedan volver a desincronizarse.
- **Guardia de `Escape` en modales:** si estaba redactando dentro de una casilla de texto (p. ej. el panel de redacción IA) y usaba Escape para cerrar un autocompletado del navegador, el modal completo se cerraba con usted y se perdía el borrador. Ahora Escape respeta el foco: si está escribiendo, solo cierra lo nativo del navegador.
- **Arrastre de panel, sin quedarse "pegado":** si soltaba el clic fuera de la ventana de Chrome mientras arrastraba el panel flotante, este podía quedarse siguiendo al cursor porque el navegador nunca veía el clic soltarse. Ahora se detecta y el arrastre se corta solo.
- **Candidatos a cupos Adicional, visibles en el panel:** cuando revisa el agendamiento de un paciente con perfil sencillo (hipertensión pura, sin diabetes, sin daño renal, sin falla terapéutica ni presión sin controlar), su tarjeta en el panel principal ahora queda marcada con "➕ CANDIDATO ADICIONAL" el resto de la jornada — útil para la próxima vez que quede libre un cupo Adicional o de sábado. Es solo una sugerencia visual (no bloquea agendar a nadie más) y solo aparece para pacientes cuyo agendamiento ya revisó hoy: el Vigilante no le pregunta nada a Everest por adelantado sobre pacientes que aún no ha mirado.
- **Indicador de agendamiento sin terminar:** al revisar el backlog de mejoras se confirmó que este ya estaba resuelto desde antes (bandera "🗓️ SIN TERMINAR" en la tarjeta) — no hizo falta ningún cambio.
- **Alerta temprana por laboratorios vencidos antes de la cita (evaluada, no implementada):** requeriría que el Vigilante le pregunte a Athenea, por adelantado, la agenda completa de mañana — un tipo de consulta que nunca se ha capturado ni confirmado en este proyecto. Implementarla esta noche habría significado adivinar cómo responde ese sistema y probarlo por primera vez en producción, con 3 médicos dependiendo del script desde mañana. Se deja documentada en el backlog de mejoras para retomarla con una captura real cuando haya oportunidad.
- 1.665 comprobaciones automáticas en verde, 0 en rojo (sube desde 1.654: 11 pruebas nuevas para los cuatro puntos de arriba que sí se implementaron).

---

## [Versión 14.1.9] — 2026-08-15 (Versión Actual / Candidata a Producción)

### 🛡️ Seguridad Clínica y Protección del Paciente
- **Blindaje del Contrato de Interfaz Visual de Everest:** Mapeo exhaustivo de los 95 puntos de acoplamiento con Everest. Si el sistema de la IPS cambia de diseño o estilo visual, el script no falla silenciosamente ni genera datos erróneos: activa automáticamente el **Modo Seguro** (solo lectura) y le avisa con un banner visible.
- **Protección contra cruce de historias clínicas (Auto-Labs Seguro):** Si usted cambia de paciente en Everest mientras el laboratorio de Athenea está consultando resultados, el sistema cancela de inmediato la escritura. Esto evita que los exámenes del paciente anterior puedan registrarse por error en la historia clínica del paciente actual.
- **Separación estricta entre analitos de orina y sangre:** Los resultados de laboratorio procedentes de orina (como glucosa o proteínas en parcial de orina) ya no pueden insertarse bajo ninguna circunstancia en las casillas de sangre (glicemia sérica o proteínas en suero).
- **Límites biológicos oficiales de la IPS:** Integración de la tabla de 28 reglas de rangos y unidades oficiales para los 13 exámenes de la Ruta de Crónicos (Creatinina, Glicemia, HbA1c, Colesterol Total, HDL, LDL, Triglicéridos, RAC, PTH, Fósforo, Albúmina y Hemoglobina). Los resultados biológicamente imposibles no se escriben y se muestran en ámbar para verificación del médico.
- **Protección de la nota médica ("La casilla del médico es sagrada"):** Si usted ya escribió un dato en un campo de la historia clínica o decide borrar un valor sugerido por el asistente, el sistema respeta su decisión tras dos intentos y nunca volverá a sobrescribir su criterio.

### 💊 Auditoría Farmacológica e Interacciones Medicamentosas
- **Auditoría de Fórmulas Vigentes y Posfechados:** El asistente analiza los medicamentos activos del paciente leyendo directamente las órdenes de farmacia en Everest (`CargarMedicamentosPaciente`).
- **Ajuste de Dosis por Función Renal:** Alertas automáticas para medicamentos de riesgo nefrológico (Metformina, Espironolactona, IECA/ARA-II, Alopurinol) cuando la Tasa de Filtración Glomerular desciende por debajo de los umbrales seguros.
- **Detección de Interacciones Críticas:** Avisos discretos ante combinaciones de alto riesgo (ej. doble bloqueo del eje renina-angiotensina o combinación de ahorradores de potasio con insuficiencia renal).

### 🫘 Motor de Función Renal y Clasificación KDIGO
- **Cálculo exacto de TFG (Cockcroft-Gault y CKD-EPI 2021):** Estandarización de la TFG con el factor de corrección femenino oficial (0.85).
- **Estadificación KDIGO sin falsas alarmas:** Los estadios G1 a G5 cuentan con límites estrictos. En caso de que falte la creatinina o el peso, el sistema marca el estadio como "No calculable" y **jamás degrada erróneamente a G5** (Falla renal avanzada / diálisis).
- **Aviso de discrepancia clínica:** Si existe una diferencia marcada entre fórmulas renales (frecuente en pacientes con obesidad, amputaciones o desnutrición severa), el sistema le muestra una alerta preventiva sugiriendo correlación con el estado nutricional del paciente.

### 📅 Agenda, Detección de Fraude y Festivos de Colombia
- **Detección de Llegadas Tardías y Fraude:** Chip de colores estricto: Verde (a tiempo), Morado (pre-alerta o 3+ actividades PyM), Ámbar (sin presentarse / en lista de guardia) y Rojo (atención extemporánea). La marcación de "Atendido" consulta la lista de guardia para no pintar de verde a quien llegó fuera de tiempo.
- **Llave Única de Cita (`apptKey`):** La identificación de cada cita incluye la hora exacta, evitando falsas alarmas en pacientes con dos citas el mismo día.
- **Calendario nacional de festivos actualizado:** Integración completa de los 18 días festivos de Colombia (Ley Emiliani) para los años 2024 a 2027, garantizando que el cálculo de días hábiles para citas de control sea exacto.
- **Reinicio Automático de Día:** Limpieza automática de listas de guardia al cruzar la medianoche, evitando acusar a pacientes de la jornada anterior en pestañas dejadas abiertas.

### 👁️ Accesibilidad y Operación en Consultorio
- **Interruptor de Emergencia Local (`Ctrl + Shift + Q`):** Apagado instantáneo en menos de 1 segundo sin necesidad de internet.
- **Canario en Producción Ligero:** Verificación en segundo plano con costo computacional menor a 0.44 ms, garantizando fluidez en computadores de cualquier gama.
- **Convivencia fluida entre múltiples pestañas:** Si abre varias pestañas de Everest, el asistente coordina automáticamente las alertas y sonidos en la pestaña que esté usando en primer plano, evitando avisos duplicados.
- **Mayor contraste y tipografía WCAG AA:** Fuentes legibles de 14px a 16px con contraste adaptado para iluminación intensa de consultorio.

---

## [Versión 14.1.4] — 2026-08-14
- Incorporación de los 4 CUPS nefroprotectores automatizados en el modal de conducta médica.
- Visualización de signos vitales (PAS, PAD, IMC) en la tarjeta de riesgo cardiovascular.
- Inclusión del colesterol LDL en la vigilancia preventiva de pacientes crónicos.
- Generación de informe forense de auditoría exportable a Excel (`.csv`) con protección contra caracteres especiales.

---

## [Versión 12.4.0] — 2026-08-10
- Reorganización del panel lateral de actividades de Promoción y Mantenimiento de la Salud (PyM).
- Filtro inteligente de pacientes en sala de espera con detección de atenciones extemporáneas.
- Corrección en la lectura de órdenes vigentes para evitar la duplicación de exámenes ya autorizados.

---

## [Versión 12.3.19] — 2026-08-08 (Línea Base)
- Versión inicial estable del userscript para agendamiento, lectura de base PyM en SharePoint y visualización básica de estados de citas.
