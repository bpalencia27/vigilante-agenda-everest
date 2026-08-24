# Registro de Novedades Clínicas — Vigilante de Agenda (Copiloto Everest PyM)

Bienvenido al registro de actualizaciones del **Vigilante de Agenda**. Este documento detalla las mejoras, correcciones y salvaguardas asistenciales incorporadas en cada versión para garantizar la seguridad de sus pacientes y agilizar su jornada de consulta médica.

---

## [Versión 17.6.29] — 2026-08-24 (Barrido S+ total — Bloque Eliminar: código muerto verificado, ~333 líneas)

Primer avance del bloque "Eliminar" del barrido total. Cada función se verificó con grep exhaustivo en **producción Y en tests** antes de retirarla (el barrido automático solo había revisado el archivo de producción — 5 candidatos iniciales resultaron tener pruebas dedicadas reales y se descartaron de esta limpieza, quedan para una revisión aparte con más cuidado: `mtrPrincipioEnTexto`, el modelo de grupos de sábado 1-3/2-4 completo, `extractAgrupador`, `apiHcValidacionExamenCronicos`/`_base64SinRelleno`).

### 🗑 Código sin ningún llamador en 34.000 líneas ni en tests, retirado
- `mtrSumarDiasHabiles`, `mtrCnoHDL`, `_relojEstadoParaTest`, `_relojAjustarParaTest`, `_getUltimoRelevoParaTest`, `_vglAvisoContextoFaltante`/`_vglContextoAvisado`, `mtrItemSugeridoEnRango` (duplicado del GAP 1, ya resuelto por `_marcarPlazoSegunSugerida`).
- La cadena completa del modal "Riesgo cardiovascular · Redacción IA" (beta cerrada, nunca conectada a un botón real): `openRiesgoModal`, `mtrRenderRiesgoModalHtml`, `mtrRenderResumenClinicoHtml` (~90 líneas cada una), `openFichaPacienteModal` (wrapper cuyo comentario afirmaba falsamente tener llamadores internos), y el listener global `mtrIaClickDelegado` que `boot()` seguía registrando para un botón (`#vgl-ia-redactar`) que solo esa cadena muerta podía pintar.
- La propiedad `estadioParaDosis` del resultado de `calcularEstadioRenal`: su condición era tautológica (ambas ramas devolvían lo mismo) y no tenía ningún consumidor.
- La variable `lastAutoFetchedDoc`: se escribía en dos sitios pero nunca se leía desde v17.0.3 (el piso real es `lastAutoFetchedAt`). De paso, el reset al revivir la sesión de Athenea reseteaba la variable muerta en vez de la real — el robot podía NO reintentar tras revivir la sesión, contradiciendo lo que su propio mensaje de consola prometía. Corregido: ahora resetea `lastAutoFetchedAt`.

### 🧹 Comentarios desactualizados corregidos
- Cuatro comentarios que seguían describiendo `lastAutoFetchedDoc` como "la guarda" ahora nombran la guarda real (`lastAutoFetchedAt`).

---

## [Versión 17.6.28] — 2026-08-24 (Barrido S+ total — Bloque S1, parte 2/2: 4 bugs críticos, cierra el bloque)

Segunda y última parte del Bloque S1 del barrido exhaustivo (8/8 críticos corregidos).

### 🐛 Un timeout de AppCita ya no se presenta como "no hay turnos de laboratorio"
- `cargarHorasLab` y `cargarHorasLabSolo` usaban `gmPostJson`, que no distingue "AppCita contestó: sin turnos" de "no contestó" (timeout, sin red, 500) — misma clase de bug que la AUDITORÍA #11 ya corrigió en `apiLaboratorioAgendarAuto`, pero seguía viva aquí. Ahora usan `gmPostJsonEx` y avisan honestamente cuando no hubo respuesta, sin tocar el interruptor de la toma.

### 🐛 Las interacciones farmacológicas ya no se silencian por falta de Cockcroft-Gault
- `mtrAvisosFarmacologicos` apagaba TODO —avisos de dosis Y las interacciones (Triple Whammy incluido)— cuando faltaba solo el Cockcroft-Gault, aunque las interacciones no lo necesitan. Además, el panel de Medicamentos nunca pasaba `tfgCockcroftGault` en absoluto: quedaba permanentemente en "Falta la función renal" para TODO paciente. Los dos huecos, corregidos.

### 🐛 La contraseña institucional de Athenea ya no se guarda en claro
- `atheneaCredsSet` escribía la credencial compartida en CUATRO sitios EN CLARO (GM y localStorage de los dos orígenes) al lado de la copia ofuscada, anulando la protección documentada. Ahora la copia ofuscada es la única escritura; las claves en claro heredadas de versiones viejas se migran y se borran al leerse.

### 🐛 "SMS enviado" ya no se afirma antes de saberlo
- La notificación de cita creada decía "SMS de recordatorio enviado al X" en el mismo instante en que se disparaba la petición (fire-and-forget) — un rechazo del proveedor o un fallo de red se anunciaba igual como éxito. El texto ahora dice lo único que se sabe con certeza en ese momento: que se solicitó el envío.

---

## [Versión 17.6.27] — 2026-08-24 (Barrido S+ total — Bloque S1, parte 1/2: 4 bugs críticos)

Primer lote del barrido exhaustivo línea por línea de todo el archivo (33.869 líneas, 48 agentes, verificación adversarial): 8 hallazgos S1 confirmados. Estos 4 primeros.

### 🐛 El uroanálisis ya no inventa resultados en pantalla
- `_resumenClinicoUro` pintaba SIEMPRE "Límpido · Leucocitos (-) · Nitritos (-)" cuando la heurística no marcaba patológico — literales fijos, no lo que el informe real dice. Un aspecto "TURBIO" (que la heurística no reconoce: no está en su lista de valores negativos ni positivos) salía como "Límpido" fabricado junto al badge "Sin hallazgos patológicos". Ahora los chips citan los valores REALES de aspecto/color/leucocitos/nitritos del informe; si ninguno está presente, un texto neutro que no afirma nada no medido.

### 🐛 Las comorbilidades ya no se pierden al cambiar de pestaña de Everest
- `_vglCosecharFactoresVisibles` prometía en su propio comentario fusionar lo archivado con lo nuevo, pero arrancaba de un mapa vacío y `_vglCosechaGuardar` fusiona plano — cada pestaña visitada REEMPLAZABA entero el archivo de factores del paciente. Abrir Antecedentes (diabetes/HTA archivados) y pasar a Hábitos borraba diabetes/HTA del archivo, con la compuerta de contexto abierta: riesgo cardiovascular falsamente bajo. Ahora el mapa arranca de lo ya archivado y la pantalla actual se superpone — igual que ya hace `_vglConfirmacionGuardar` con las confirmaciones.

### 🐛 La regla "50% de vigencia fuera de meta" ya llega a los pacientes con programa/estadio
- `_vigenciaDiasParaAnalito` retornaba la vigencia por tabla de estadio ANTES de evaluar `opts.aplicar50` — la regla de v16.4.0 quedaba inalcanzable justo para los pacientes con contexto clínico completo (el caso principal para el que se escribió: los dos únicos llamadores con `aplicar50:true` siempre pasan también programa/estadio cuando hay resumen en caché). Un LDL fuera de meta con programa HTA salía "vigente" por 180 días completos en vez de acortarse a 90.

### 🐛 Las funciones nuevas ya no se autoencienden en instalaciones limpias
- La guarda `_habiaConfigPrevia` de la migración "estreno" (v14.2.0, ya blindada una vez en v17.6.8) se leía DESPUÉS de que cuatro migraciones anteriores ya habían escrito `vgl_cfg` — así que en TODA instalación limpia la guarda daba falso positivo y motor/IA/telemetría/reporte se encendían solos. Se captura ahora antes de la primera migración, y además la migración se marca como "ya evaluada" siempre (no solo cuando enciende las banderas), para que un equipo limpio que más tarde genera su primer `vgl_cfg` tampoco dispare la migración fuera de tiempo.

---

## [Versión 17.6.26] — 2026-08-24 (Redactor IA — se elimina la redundancia «Datos del paciente», el estilo se aprende solo, y se limpia texto interno que se colaba a pantalla)

Seguimiento inmediato al Bloque A: el médico revisó el resumen de los cambios y encontró tres cosas más antes de seguir con la rotación de modelos.

### 🗑 «➕ Datos del paciente» se retira por completo — redundante con «Indicaciones»
- Existían DOS lugares para darle contexto extra a la IA: el textarea "Indicaciones" del panel principal (un cuadro, cero clics) y el modal "➕ Datos del paciente" (botón → abrir → llenar 9 campos → guardar → cerrar). Ambos alimentaban el mismo bloque del prompt. Se retira el modal (`mtrAbrirDatosAdicionales`, su botón y su handler); "Indicaciones" pasa a cubrir también síntomas, adherencia y hábitos en texto libre.
- La caja roja de datos críticos (categoría de riesgo, TFG, medicamentos — la que bloquea la generación de Análisis y plan si falta algo obligatorio) **no se toca**: es un guardián automático, no una alternativa de captura de texto.
- `MTR_DATOS_EXTRA_ETIQUETAS` se reduce de 12 a 3 claves (las de la caja roja); las 9 del modal retirado ya no las alimenta nadie.

### 🧠 La memoria de estilo ahora es automática — sin botón, sin checkbox
- Se retiran el botón "💾 Guardar mi estilo" y el checkbox "Mi estilo": ya no son decisiones manuales del médico. `mtrEstiloGuardar` se llama sola cada vez que el médico acepta un borrador (Copiar o Insertar) SIN editarlo (`mtrCalcularDeltaEdicion === "intacta"`) — un texto que necesitó reescritura no enseña estilo. Y los ejemplos guardados se usan SIEMPRE que haya al menos uno: nada que marcar.

### 🐛 Texto interno filtrado a la pantalla del médico
- Tres textos visibles en la interfaz citaban fechas y "decisiones" de una conversación de desarrollo interna ("decisión suya del 20-ago", "decisión del 22-ago", "decisión clínica del médico, 20-ago-2026") — lenguaje que solo tiene sentido en el registro de cambios, no en una herramienta que usan médicos que no participaron en esa conversación. Corregido en: el aviso de privacidad del Redactor IA, el tooltip del botón "Hoja educativa", y dos criterios de clasificación de riesgo (piso por diabetes, piso por edad) — el contenido clínico se conserva intacto, solo se retira la referencia a la fecha/decisión.

---

## [Versión 17.6.25] — 2026-08-24 (Redactor IA — Bloque A: botón «Preguntar» y datos del paciente que se perdían)

Primer bloque de la auditoría S+ de 20 bugs sobre la Redacción Asistida (IA), pedida por el médico tras revisar los hallazgos ("hay botones de más", además de los ya conocidos de contexto/rotación/tokens que se atacan en bloques siguientes). Correcciones aisladas, sin dependencias entre sí.

### 🐛 v17.6.24 — El botón «❓ Preguntar sobre este paciente» ahora SÍ se ve seleccionado
- Comparte el selector delegado de los 3 chips de casilla (`.vgl-ia-modos [data-modo]`) y sí recibía la clase `.active` al hacer clic, pero llevaba `class="vgl-agm-btn sec"` (no `vgl-agm-pbtn`) y no existía ninguna regla CSS `.active` para esa combinación en toda la hoja de estilos: el clic cambiaba de modo de verdad (aparecía el campo de pregunta) pero apagaba los 3 chips sin encender nada — parecía que el clic no había hecho efecto. Nueva regla `.vgl-agm-btn.sec.active`, misma paleta que `.vgl-agm-pbtn.active`. Censo de `!important` de suite_25: 347 → 349 (+2, documentado en el propio test).

### 🐛 v17.6.25 — «➕ Datos del paciente» ya no borra en silencio lo que la caja de críticos había guardado
- El Guardar de ese formulario armaba `datos` desde cero con solo sus 9 campos y llamaba `mtrDatosExtraGuardar`, que **reemplaza** todo el almacén (no fusiona). Si antes el médico había llenado la caja roja de datos críticos del Análisis y plan (categoría de riesgo, TFG, medicamentos — que sí fusiona con `Object.assign`), esos 3 campos se perdían sin ningún aviso al guardar el formulario general. Ahora el Guardar arranca desde lo ya guardado (leído fresco, no la foto de cuando se abrió el modal) y superpone sus 9 campos encima.

---

## [Versión 17.6.23] — 2026-08-24 (Redactor IA: se ataca la causa raíz del truncamiento, no solo el aviso)

Corrección sobre v17.6.22: "necesito que siempre salga completo, así no me sirve" — el aviso honesto de borrador incompleto queda como red de seguridad, pero se sube el presupuesto real de tokens.

### 🔧 Tope de salida de Gemini cuadruplicado: 2048 → 8192
- En los modelos 3.x, el PENSAMIENTO del modelo consume del MISMO presupuesto que el texto visible — y las notas largas (Enfermedad actual, Análisis y plan) no restringen el pensamiento a propósito (conservan el comportamiento por defecto). Con 2048 de tope total, una nota clínica de 7 secciones podía quedarse sin espacio de salida real después de que el modelo terminara de "pensar", incluso antes de escribir la nota completa.
- 8192 es un techo ampliamente soportado por los modelos gratuitos de la rotación (2.x y 3.x) y cuadruplica el margen real disponible para el texto visible.
- El aviso de v17.6.22 (`mtrEstadoBorrador`) se conserva como red de seguridad honesta para el caso raro que aún así ocurra — no se retira, porque nunca mentir sobre el estado del borrador sigue siendo la regla.

---

## [Versión 17.6.22] — 2026-08-24 (Redactor IA: borradores incompletos avisados, contexto ya no queda obsoleto)

Reporte en consultorio, mismo día: "esa sección de redacción asistida con IA está muy mal diseñada, porque los resultados a veces aparecen cortados incompletos, no tiene en cuenta los datos que yo pongo en el cuadro de texto".

### 🐛 Borrador truncado por el modelo: ahora se avisa, en vez de fingir que está completo
- `mtrRespuestaGemini` ya trataba `finishReason: "MAX_TOKENS"` como éxito a propósito (un borrador parcial es mejor que nada — cortarlo en seco perdería trabajo real del modelo), pero nada en el camino se lo decía al médico: el panel pintaba el mismo "Borrador listo" de siempre. Nueva función pura `mtrEstadoBorrador(r)`: cuando el modelo se quedó sin espacio de salida, el estado dice explícitamente "⚠ Borrador incompleto... puede cortarse a mitad de frase" en vez de sonar terminado.

### 🐛 El contexto que el médico escribe en Everest ya no queda congelado en una foto vieja
- El panel leía `mtrLeerTextoLibreHistoria()` (motivo, revisión por sistemas, examen físico, hábitos) **una sola vez al abrirse** y reutilizaba esa foto para cada "Generar"/"Generar todo" — si el médico seguía escribiendo en esas casillas de Everest después de abrir el Redactor (lo normal: el panel queda abierto mientras redacta), el borrador se generaba ignorando lo recién escrito. Ahora se lee fresco en el momento exacto de cada clic — Generar, Generar todo, y el prellenado del formulario "➕ Datos del paciente".
- Nota honesta: el prompt en sí (`mtrRedaccionPrompt`) siempre incluyó correctamente estos bloques — el defecto no era QUÉ se le pedía al modelo, sino CUÁNDO se leían los datos que se le pasaban.

---

## [Versión 17.6.21] — 2026-08-24 (Agenda S+: debounce contra el parpadeo de estado entre fuentes)

Reporte en consultorio, con CSV real de auditoría adjunto (sin PHI en este registro): "la tarjeta titilaba entre verde y ámbar" y una confirmación extemporánea "me avisó súper tarde y quedé con la duda".

### 🐛 Parpadeo de estado corregido con confirmación en dos lecturas (debounce)
- El CSV mostró el mismo paciente alternando "En Sala" ↔ "Sin presentarse" más de 10 veces en 15 minutos, y varios pacientes distintos cambiando en el mismo instante exacto — la firma de que el modo API y el respaldo por lectura de pantalla no coincidían en ese tick, no de pacientes moviéndose de verdad. Cada parpadeo pasaba por `colorAndAlert` como un `CAMBIO_ESTADO` real: ensuciaba la auditoría y podía disparar o retrasar una alerta de fraude por una lectura transitoria — la causa más probable del aviso "súper tarde".
- Ahora una lectura que difiere del último estado **confirmado** no se acepta a la primera: se guarda como candidato. Solo si la misma lectura se repite en el siguiente tick (unos segundos después, no minutos) se confirma y recién ahí alimenta color, aviso y auditoría. Mientras tanto la tarjeta sigue mostrando el último estado confirmado — texto y color **siempre juntos**, nunca una combinación imposible. Un cambio real sigue avisando en segundos; un parpadeo de una sola lectura queda absorbido sin dejar rastro. La primera vez que se observa una cita nunca se demora.

---

## [Versión 17.6.20] — 2026-08-24 (Telemetría corregida + se retiran Espera prolongada y Pausa activa)

### 🐛 Bug de telemetría corregido: el embudo de Agendamiento no tenía abandono propio
- Al auditar Laboratorios se encontró un residuo de copia-pega: el `closeMod` de `openLaboratoriosModal` disparaba `uxTrack("fn.agendar.abandon")` — un evento del embudo de OTRO módulo — cada vez que se cerraba el modal de Laboratorios. Contaminaba la métrica de abandono de Agendamiento (`mtrTableroTelemetria`, Resumen del turno) con eventos que nunca fueron un agendamiento abierto.
- Peor aún: al quitarlo se confirmó que el embudo real de Agendamiento (`fn.agendar.open`/`fn.agendar.complete`) **nunca había tenido su propio abandono** — vivía, por error, en el modal equivocado. Se restauró en el `closeMod` real de `openAgendamientoModal`.

### 🗑 Se retiran "Espera prolongada en sala" y "Pausa activa" (mismo pedido de campo que retiró Regla 20-20-20/Cronómetro/Sugerir fecha de control/Fin de turno en v17.6.19)
- Ambos estaban APAGADOS por defecto. Se retiran `_bienestarTick`, `_escaladaDe`, `_escaladaTick`, sus interruptores en Ajustes y el estado que solo ellos usaban (`state.pausaProx`, `state.pacienteDesde`, `state.escaladoAvisados`; también se limpió `state.ojosProx`, huérfano desde v17.6.19). El grupo "Bienestar (turno largo)" de Ajustes, que solo contenía Pausa activa, se retira completo.

---

## [Versión 17.6.19] — 2026-08-24 (Bienestar/Turno: se retiran 4 funciones sin uso real en consultorio)

Reporte en consultorio, mismo día: pidió eliminar directamente cuatro controles de Ajustes que, ya probados, "no le encontró utilidad" — Regla 20-20-20, Cronómetro del paciente en sala, Sugerir fecha de control y Botón de fin de turno. Los cuatro estaban APAGADOS por defecto (nadie los perdía encendidos sin saberlo).

### 🗑 Cuatro controles retirados por completo
- **Regla 20-20-20** (`S.ojos`/`S.ojosMin`): aviso cada N min para mirar a 6 metros. Se retira el interruptor, el selector de minutos y el aviso en `_bienestarTick`.
- **Cronómetro del paciente en sala** (`S.cronometro`): tiempo transcurrido junto a la tarjeta. Se retira la función `cronometroDe`, su pintado en la tarjeta y su refresco en vivo, el interruptor en Ajustes y el CSS asociado (3 reglas `!important`, censo de suite_25: 350 → 347).
- **Sugerir fecha de control** (`S.seguimiento`): bloque en el Resumen del turno con la fecha de control sugerida para los atendidos del día. Se retiran `_seguimientoHtml`/`_seguimientoSugerido` y su interruptor.
- **Botón de fin de turno** (`S.resumenFin`): armaba el resumen de la jornada y lo copiaba al portapapeles. Se retira `_textoFinTurno`, el botón y su manejador de clic.
- "Espera prolongada en sala" (`S.escalada`) y "Pausa activa" (`S.pausas`) **no se tocan** — no fueron parte del pedido.

---

## [Versión 17.6.18] — 2026-08-24 (Panel del paciente S+: el aviso al abrir la historia vuelve a ser solo informativo)

Reporte en consultorio, mismo día: "al inicio cuando se abre la historia clínica que aparecen los recordatorios de PyM y demás, se habilitaron unos botones para ordenar laboratorios y agendar cita, por favor elimínalos porque no les veo utilidad".

### 🗑 Se retiran los botones de acción del aviso único (📋 Ordenar paraclínicos / 📅 Agendar control)
- La v17.6.3 (decisión "B2") había convertido los chips de PyM/laboratorios y añadido dos botones de acción para que el aviso, además de informar, pudiera abrir directamente el panel de órdenes o el agendamiento. En el uso real esos atajos no aportaban — el médico ya tiene 🗓️/📋/🧪 en el dock de acciones de la historia clínica para eso, y el aviso solo necesita ser el recordatorio que siempre fue.
- Los chips de PyM y laboratorios vuelven a ser informativos (texto simple, no botones); se retiran los dos botones de acción y el helper de enrutado de clics (`mtrAvisoAccionDe`) que solo existía para ellos — sin dejar código muerto.
- v17.6.17 (mismo lote): ajuste cosmético del mensaje "Aún sin citas" tras v17.6.16 — ya no dice "entra una vez" de forma incondicional, distingue el primer arranque del día de un reintento en curso.

---

## [Versión 17.6.16] — 2026-08-24 (Agenda S+: la URL de agenda ya no se abandona por fallos pasajeros)

Reporte en consultorio, mismo día: "necesito que por lo general el script tenga acceso al endpoint que muestra el estado de citas del día para evitar tener que estar en frente de 'Citas del día' a cada rato — debe ser en tiempo real aunque esté en otra pestaña de Everest, o dentro de la historia clínica".

### 🔌 La llamada de agenda aprendida ya no se purga por fallos repetidos
- El sondeo en segundo plano (modo API) ya corría en TODA la aplicación, no solo en "Citas del día" (v12.3.11/v14.1.5) — eso ya funcionaba. Pero desde v12.3.7, a los 3 fallos SEGUIDOS se **olvidaba por completo** la URL aprendida, razonando que "Everest la vuelve a enseñar sola" — cierto, pero SOLO si el médico visita "Citas del día" en esa misma pestaña, que es justo lo que pedía evitar.
- La causa más común de 3 fallos seguidos no es que la URL esté mal: es la sesión de Athenea caída (que el propio script ya revive sola, `atheneaKeepAlive`) o un corte de red pasajero. Purgar tiraba una URL perfectamente buena por un bache momentáneo.
- Ahora los fallos **nunca** purgan la URL por sí solos: solo activan el enfriamiento ya existente de `apiUtil()` (≥5 fallos → 5 min de descanso, reintenta después contra la MISMA url, indefinidamente). La URL solo se abandona por una causa real de identidad — cambio de médico en un equipo compartido (`invalidarApiSiCambioMedico`), que sigue purgando como siempre.

---

## [Versión 17.6.15] — 2026-08-24 (Agenda S+: aviso honesto cuando el Vigilante queda ciego fuera de Citas del día)

Reporte en consultorio: "los avisos de confirmación llegan tarde y el tiempo que pasó hasta que confirmaron no se queda fijo" cuando el médico no está directamente en "Citas del día".

### ⚠ Vigilante sin lectura de la agenda
- Causa real: fuera de "Citas del día"/Historia, el modo API en segundo plano es la ÚNICA fuente de datos — el respaldo por lectura de pantalla exige estar en esa vista. Si esa pestaña nunca aprendió la llamada de agenda de Everest (arranque en frío del día, o el API se invalidó por cambio de médico en un equipo compartido), no queda ninguna fuente viva mientras el médico trabaja en otra pantalla: el Vigilante queda ciego **en silencio**, y el "tiempo transcurrido" que se ve al volver ya no refleja el instante real de la confirmación, sino el de esa lectura tardía.
- No se puede resucitar un dato que nunca se leyó (casilla vacía antes que dato inventado — no hay snapshot que fabricar). Pero el silencio total es peor: el médico cree que está vigilado y no lo está. Ahora, una sola vez por día y solo dentro del módulo clínico, un aviso honesto le dice que pase un momento por "Citas del día" para que el Vigilante aprenda la conexión.

---

## [Versión 17.6.14] — 2026-08-23 (Telemetría S+: beacon con acuse, memoria acotada, backoff, RUM fijado y URL ofuscada)

Auditoría completa del workflow de telemetría y recopilación de datos. Veredicto previo: SÓLIDA (cola persistente con acuse real, cero PHI en el canal remoto, sin await en el camino crítico, topes y dedupe). Cinco refinamientos S+:

### 🚨 H1 — El beacon de salida ya no retira evidencia a ciegas
- `sendBeacon`/envío silencioso (no-cors) no dan acuse (respuesta opaca): al cerrar la pestaña, una fila "despachada" contra un panel caído, un login de Google o un token rotado se perdía en silencio — los tres rechazos que `repPost` SÍ detecta y reencola. Ahora el vaciado al salir solo despacha con **acuse fresco** (último envío confirmado hace < 30 min); si no, las filas quedan en la cola y el próximo arranque las reintenta por `repFlush` (que sí lee el acuse). El servidor ya descarta duplicados por `lote`.

### 🧠 H2 — Techo de memoria real en el reporte de errores
- El tope de 40 huellas limitaba el ENVÍO pero no la memoria: `_errVistos` crecía sin límite durante el día (un fallo del API con mensaje variable lo inflaba) y `_errVeces` añadía una clave por huella. El contador agregado (`error.distintos`) sigue viendo TODAS las huellas; el Set y el contador ahora se podan al umbral de 40.

### 📊 H3 — El mapeo URL→etiqueta del RUM queda fijado por pruebas
- El bug Annar/Citi (misma etiqueta para dos endpoints) entró sin que el banco lo viera: ninguna suite exportaba el mapeo. Nuevas pruebas fijan las 21 etiquetas + "otro", el orden Annar-antes-que-Citi (la semántica real) y que ninguna etiqueta filtra el id de la URL.

### 🔒 H4 — La URL aprendida del API ya no duerme en texto plano
- `apiRecordar` persistía la URL completa de `ObtenerConsultas` (con el `profesionalId`) en el localStorage del origen, legible para cualquier script de la página de Athenea. Ahora se persiste **ofuscada** (mismo mecanismo que la clave Gemini); la carga desofusca con migración tolerante al valor viejo en claro. En memoria y en las llamadas, la URL sigue siendo la completa.

### ⏱️ H5 — Backoff de red para la cola de reportes
- Cada evento reintentaba contra un panel caído: cada `repPost` espera hasta 20 s en fallar y hasta 60 filas/día (errores + fraudes) se encolaban con su intento inútil. Si el último envío falló hace < 3 min, la fila queda en la cola y la barre el timer de `repFlush` (10 min) que ya existía.

### 🧪 Verificación
- Suite 23: +7 casos (beacon sin/con acuse, techo de huellas, mapeo RUM, `_rumTrack` ok/err, backoff sí/no). Suite 13 y 19: aserciones actualizadas a la URL ofuscada + caso de migración. **4 mutaciones verificadas** (sin backoff, sin sello fresco, Set sin tope, URL en claro → cada una cae a rojo y se restauró). Banco local en verde: **1.424 comprobaciones, 0 en rojo** (44 suites presentes; ver nota de entorno en 17.6.11).

---

## [Versión 17.6.13] — 2026-08-23 (Agendamiento S+: sin preselección a ciegas, doble confirmación reiniciada, celular honesto y accesibilidad)

Auditoría S+ del módulo de Agendamiento (`openAgendamientoModal`). Ninguna regla clínica cambió: cinco hallazgos de UI/UX/robustez verificados contra el código real.

### 🎯 La hora se elige, nunca viene puesta
- Sin sugerencia clínica (modo manual o sin perfil), **ningún turno nace activo**: antes se preseleccionaba el primer horario cronológico (normalmente 06:00) y bastaba un clic a ciegas en Confirmar para crear la cita en una madrugada que nadie decidió. Se cumple la orden ya aplicada en v16.9.0 ("sin datos para recomendar, NINGÚN chip sale activo"). El botón queda apagado y dice **"Elija un horario para continuar"** en vez de un "Sí, Crear Cita" muerto.

### 🔁 Doble confirmación que no se deja saltar
- Los avisos "pulse otra vez" (anti-duplicado y vencimiento) se marcaban con `dataset.dupOk`/`vencOk` y **jamás se limpiaban**: si el médico veía el aviso y luego cambiaba de día o de turno, el siguiente Confirmar se lo saltaba con los datos NUEVOS. Ahora cada cambio de fecha o de turno reinicia ambas marcas.

### 📱 El celular dice la verdad
- Si Everest no devuelve los datos del paciente (red caída o respuesta sin cuerpo), el campo quedaba colgado en "cargando…" con el SMS tildado y la cita se creaba con celular vacío sin avisar. Ahora: placeholder "no se pudo cargar — escríbalo a mano", SMS desmarcado y nota "no se pudo verificar el celular del paciente". Distinto de "sin celular registrado" (que solo se dice cuando Everest confirma que no hay número).

### ♿ Accesibilidad
- `aria-live="polite"` en los 4 estados que mutan (sondeo de primer cupo, banner de sugerencia, aviso de vencimiento, info de fecha); el stepper lleva `role="list"`/`role="listitem"`, `aria-current="step"` que salta al paso en curso y el foco se mueve al primer elemento interactivo de cada paso (antes quedaba en un botón `display:none`).

### ⚠️ Cupo desaconsejado legible
- Opacidad `.62 → .85`: a .62 parecía un botón deshabilitado cuando en realidad es usable. La razón ("no recomendado para este paciente") ya no vive solo en el tooltip: la loseta lleva la etiqueta visible **"⚠ SOLO SI NO HAY OTRA CITA"** en ámbar, y el tooltip sigue como complemento.

### 🧪 Verificación
- Suite 15: +6 casos (preselección sin/con sugerencia, reinicio antidup, celular con red caída, aria-live/aria-current, etiqueta del cupo) con **5 mutaciones verificadas** (preselección vieja, sin reset, sin estado del celular, sin aria-current, sin etiqueta → cada una cae a rojo y se restauró). Suite 25: la regla nueva del variante ámbar sube especificidad para no colisionar con la base (Regla A). Banco local en verde: **1.416 comprobaciones, 0 en rojo** (44 suites presentes; ver nota de entorno en 17.6.11).

---

## [Versión 17.6.12] — 2026-08-23 (Redacción IA, 2ª tanda S+: textos exactos, memoria acotada, autosize y aviso al cerrar)

Segunda iteración de perfeccionamiento del módulo de Redacción Asistida con IA. Ninguna regla clínica cambió: pulido de UI/UX y de robustez sobre lo ya entregado en 17.6.11.

### ✏️ Textos exactos
- El contador del modal decía "Generando 1/4" y "hechas/4": el modal tiene **3 casillas**, no 4. Ahora dice `Generando 1/3…` por casilla y `✓ N borrador(es) listos` al terminar (con la nota del saltado de Análisis y plan si aplica).

### 🧠 Memoria acotada
- `_vglTextoPrevio` (último texto visto por `docId|modo`) crecía sin límite en sesiones largas: una entrada por cada par. Nueva función pura `_vglTextoPrevioPodar(mapa, tope)` que recorta a las **200 entradas más recientes** por orden de inserción; se llama tras cada escritura.

### 📐 Autosize del borrador
- El área de texto del borrador crece con el contenido (mín. 220 px, máx. 460 px) al escribir, al generar y al pintar errores — las notas clínicas largas ya no fuerzan scroll interno invisible.

### 🚪 Aviso al cerrar
- Si hay borradores con texto y **ninguno insertado**, al cerrar el modal se confirma con el diálogo nativo del navegador antes de descartar el trabajo (nada se ordena ni se pierde en silencio).

### 🧪 Verificación
- Suite 57: +2 casos para `_vglTextoPrevioPodar` (recorte a tope conservando los recientes; no toca mapas dentro del tope; aguanta tope inválido y sin mapa) con **mutación verificada** (poda desactivada → suite roja; restaurada → verde). Banco local en verde: **1.410 comprobaciones, 0 en rojo** (44 suites presentes; ver nota de entorno en 17.6.11).

---

## [Versión 17.6.11] — 2026-08-23 (Redacción IA: contador, atajo, bloqueo de carrera y Deshacer)

Rediseño S+ del módulo de Redacción Asistida con IA. Ninguna regla clínica cambió: son mejoras de UI/UX y de robustez sobre el flujo existente.

### ✨ Lo nuevo en el modal
- **Contador del borrador**: tras generar o al editar, muestra `N palabras · N caracteres · modelo usado`, para juzgar la extensión de un vistazo.
- **Atajo Ctrl+Enter** (o Cmd+Enter): genera desde cualquier campo del modal, sin tocar el Enter normal de las casillas de texto.
- **Deshacer tras insertar**: ahora también al insertar en una casilla vacía — el botón ↩ Deshacer devuelve la casilla a como estaba.
- **Accesibilidad**: el estado del modal se anuncia con `aria-live="polite"` y el área de texto lleva rótulo para lectores de pantalla.

### 🛡️ Corrección de carrera (en vivo)
- Los chips de casilla se **congelan mientras se genera**: antes, cambiar de casilla a mitad de la llamada entregaba el borrador en el chip equivocado. El resultado ahora se guarda bajo SU modo y solo se pinta si ese modo sigue activo. Igual en "Generar todo".

### 🧪 Verificación
- Suite 57: +1 caso para el contador (función pura, 6 comprobaciones) con mutación verificada (romper el contador cae a rojo y se restauró). Suite 25: censo de `!important` 348 → 350 (el contador usa 2 marcas scoped). Banco local en verde: **1.408 comprobaciones, 0 en rojo** (las suites que faltan del conteo 1.908 no están presentes en `tests/` en este equipo; ver abajo).

> **Nota de entorno**: al abrir esta sesión, 22 suites que corrían en v17.6.10 (38, 40–56, 59, 62, 67–69) ya no estaban en `tests/` (las únicas copias parciales están en `.claude/worktrees/motor-portado`). El banco local valida con las 44 suites presentes y sale verde; si esas suites deben volver, se restauran desde el historial de git del repositorio canónico.

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
