// ==UserScript==
// @name         Vigilante de Agenda — Copiloto Everest PyM
// @namespace    vigilante-agenda-everest
// @version      14.1.9
// @match        *://medicosviva1a.atheneasoluciones.com/*
// @connect      medicosviva1a.atheneasoluciones.com
// @description  // [COPY-UX] Asistente clínico para la gestión fluida de la agenda médica y actividades de PyM en Everest.
// @author       bpalencia27
// @match        *://neps.everestintelligent.com/*
// @match        *://*.everestintelligent.com/*
// @match        *://viva1aips-my.sharepoint.com/*
// @match        *://appcita.viva1a.com.co/*
// @match        *://*.viva1a.com.co/*
// @connect      appcita.viva1a.com.co
// @connect      viva1a.com.co
// @run-at       document-start
// @noframes
// @connect      viva1aips-my.sharepoint.com
// @connect      sharepoint.com
// @connect      microsoftonline.com
// @connect      login.live.com
// @connect      svc.ms
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      googleusercontent.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt
// @downloadURL  https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt
// ==/UserScript==





// v12.0.0 — RETIRADO el "GARBAGE COLLECTOR PARA SPA" (estaba pegado DOS veces, líneas 39-108
// y 110-179 de la versión anterior). No era una limpieza inocua: enganchaba history.pushState,
// history.replaceState y popstate del objeto History REAL de Everest, de modo que en CADA
// navegación del router de Angular ejecutaba run(), y run() hacía clearInterval de los cuatro
// temporizadores creados en boot() — el recordatorio de cargar el PyM, el repintado del
// silenciador, el reintento del reporte y el chequeo de versión — que NADIE volvía a armar,
// porque boot() solo corre una vez. Tras el primer cambio de vista se apagaban en silencio.
// Además arrancaba del DOM los modales registrados: el de agendamiento podía desaparecer a
// media consulta. Y al estar duplicado, los dos parches de history quedaban encadenados.
// La fuga que pretendía resolver ya está corregida en origen (módulo duplicado eliminado).

// --- AUTOACTUALIZACIÓN -------------------------------------------------------
// Activada (v7.4.0): Tampermonkey revisa este Gist secreto solo y actualiza cada
// equipo cuando @version suba. Para publicar una versión nueva: editar el Gist
// https://gist.github.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91 (pegar el
// archivo completo, subir @version, "Update secret gist") — nada más que hacer en
// los consultorios. Guía completa: 3_ACTUALIZAR_TODOS_LOS_EQUIPOS.txt
// ----------------------------------------------------------------------------

/*
  v12.5.0 — TELEMETRÍA DE USO DEL PANEL (mejora continua, pedido del 11-08-2026)
  Cada acción del médico en el panel se CUENTA de forma anónima (uxTrack: nombre fijo
  de acción + números; jamás cédulas, nombres ni texto del DOM) y cada 30 minutos la
  pestaña líder envía UNA fila "ux" agregada al tablero de Apps Script por la cola con
  reintentos ya existente (reportar/repFlush). Ventana persistida en localStorage
  (vgl_ux): sobrevive recargas y despacha lo pendiente de otro día al arrancar
  (uxBootCheck). Interruptor en Ajustes ("Métricas de uso del panel", uxTelemetria) y
  respeta además el interruptor general del reporte. ~20 acciones instrumentadas:
  abrir agendar/ordenar/labs, cita creada/rechazada/cupo perdido, lab agendado,
  órdenes creadas/fallo/correo, avisos PyM/PES mostrados y atendidos, Auto-Labs,
  filtros, búsqueda, silenciar, hojas de Resumen/Ajustes, abrir PyM manual. El
  tablero procesa la fila con TABLERO/Codigo.gs (pestañas "uso" y "uso_detalle").

  v12.5.1 — REVISIÓN ADVERSARIAL DE LA TELEMETRÍA (3 lentes, 18 confirmados, 0 refutados):
  · El saneo anti-PII ahora se aplica TAMBIÉN al exportar (uxClaveLimpia en claves,
    valores forzados a número, tiras de 6+ dígitos eliminadas): una ventana contaminada
    por un tercero en localStorage ya no puede subir texto al tablero.
  · Presupuesto por claves enteras (jamás un JSON partido por slice) + "_recortadas".
  · Cambio de día: la ventana vieja se APARCA (vgl_ux_pend) y la despacha SOLO la
    pestaña líder — sin filas duplicadas y sin descartar conteos cuando el reporte
    está apagado o no hay red.
  · La cola remota sacrifica filas "ux" antes que fraude/resumen al desbordarse, y
    repQLoad ya no cachea (una pestaña vieja no pisa filas de otra).
  · Los botones "Probar" de Ajustes ya no contaminan las métricas (esPrueba).
  · VERSION ahora sale de GM_info (la const llevaba 3 versiones diciendo 12.3.37 en
    cada fila del tablero) y una prueba compara el respaldo contra @version.
  · TABLERO/Codigo.gs endurecido: lista blanca de eventos (adiós pestaña "otros" con
    cuerpo arbitrario), re-saneo server-side, topes de tamaño y claves, neutralización
    de fórmulas (=,+,-,@) y uso_detalle por lotes (setValues, máx. 120).
  Banco: 549 comprobaciones, cobertura 289/314 (92.0%).

  v12.5.2 — 11-08-2026: LOGIN DE ATHENEA, RESUELTO DE RAÍZ (confirmado con el equipo:
  Athenea NO tiene login por médico — TODA la sede entra con la MISMA cuenta
  institucional). El diseño "por médico en turno" de v12.3.16 era, sin saberlo,
  contraproducente: pedía guardar la misma cuenta N veces bajo N IDs distintos para
  que "funcionara para todos". Ahora:
  · atheneaCredsGet/Set/Clear ya NO reciben docId: hay UNA credencial compartida por
    equipo/navegador (GM_setValue, ofuscada — nunca cifrado real, ver aviso junto al
    código). Guardarla una vez en Ajustes sirve para cualquier médico que use ese
    computador.
  · DEFAULTS.atheneaAutoLogin pasa a true (encendido de fábrica): sin credenciales
    guardadas simplemente no hace nada, así que no hay riesgo en el cambio.
  · atheneaAutoLogin() ya no exige un médico identificado en Everest primero — no
    tiene sentido cuando la cuenta es la misma para todos.
  · Lo que NO cambia y es la garantía real: la credencial NUNCA toca el archivo del
    script ni se commitea a git — vive solo en el almacén local de cada equipo. Una
    filtración obliga a cambiar la contraseña de Athenea, no a purgar el historial de
    git de todos los consultorios.
  · Restricción de fondo que sigue intacta (no tiene arreglo posible desde aquí): la
    cookie de sesión de Athenea es de sesión pura — muere al cerrar el navegador. El
    auto-login es lo más cerca de "permanente" que se puede llegar sin tocar el
    servidor; dentro de una misma sesión de navegador, el latido de 3 min (v12.3.5)
    ya impedía que el timeout deslizante se cumpliera.
  Banco: 547 comprobaciones, cobertura 288/313 (92.0%).
*/

/*
  v12.5.3 — 11-08-2026: FECHA DE ATHENEA, MÁS EVIDENCIA DE CAMPO. Un caso real en
  consultorio mostró "fechas reconocibles: []" con la ventana de ±400/+700 alrededor
  del formulario de la solicitud — ni siquiera una candidata rechazada por
  ambigüedad, y lo que sigue al formulario es solo el campo oculto "hash". La fecha,
  si existe en este HTML, está más lejos de lo que se buscaba. Se ensancha la
  ventana hacia atrás a 3000 caracteres (una fila de tabla con varias columnas de
  estado/sede/médico antes de la celda de acciones puede ser larga) y, sobre todo,
  el diagnóstico ahora vuelca el texto CRUDO de esos últimos 1500 caracteres antes
  del formulario — no solo lo que el regex de fecha reconoció — para poder leerlo
  directamente en la próxima captura de consola y encontrar el formato real, en vez
  de seguir adivinando un patrón nuevo a ciegas. También captura hasta 2 solicitudes
  distintas por sesión (antes solo 1), para comparar si el patrón es consistente.
*/

/*
  v12.5.13 — 12-08-2026: IMPRIMIR DIRECTO — RECORDATORIO DE CITA Y ORDEN DE PYM. Pedido
  explícito del médico: hasta ahora los dos primeros botones del panel (agendar cita de
  control y generar órdenes PyM) solo ofrecían enviar por correo/SMS, sin opción directa de
  imprimir. Contrato REAL, no inventado: capturado con el grabador de red del propio
  proyecto (GRABADOR_1/2), justo tras crear una cita y una orden reales y hacer clic en el
  botón "Imprimir" oficial de Everest en cada caso.
  - Cita de control: GET /apiviva/APIImpresionV2/api/Impresion/ImprimirRecordatorioCita
    ?CitaId=<radicado>&Eps=<nombre EPS>&nombreCompleto=<nombre completo>&swVirtual=false.
    CitaId es el radicado que devuelve AsignarTurno para ESTA cita puntual — nunca "la
    última cita en pantalla". Eps/nombreCompleto se toman del mismo
    BuscarPacienteDetallado que ya se llamaba para los programas del paciente (sin
    consulta extra). Nuevo botón "🖨️ Imprimir recordatorio de cita", visible solo tras
    crear la cita con éxito (openAgendamientoModal).
  - Orden de PyM (CORREGIDO en v12.6.5): la URL de impresión NO se arma aquí — la
    devuelve el propio Everest en el cuerpo de
    GET /apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos
    ?PacienteId=<id>&Agrupador=<agrupador>, que además es el paso que genera el
    reporte en el servidor. La URL real capturada es
    /apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=<agrupador>&idPaciente=<id>
    (otro módulo, otra grafía y sin NumAutorizacion: reconstruirla a mano daba 404).
    Un botón "🖨️ Orden <agrupador>" por cada agrupador ÚNICO generado en esa corrida
    (openOrdenamientoModal).
  Ambos abren la URL real en una pestaña nueva (mismo patrón que abrirInformeAthenea): es
  el navegador el que decide qué hacer con la respuesta (PDF nativo o una página que
  dispara su propio print()). Sin ID real (cita no creada / orden no generada), ninguno
  de los dos abre nada — nunca se imprime "lo último en pantalla".
  Pendiente, sin tocar: el interruptor NORMAL/ANORMAL del uroanálisis (ver v12.5.11) sigue
  esperando el HTML real de ese control específico.
  Banco: 628/628 (6 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.6.1 — 12-08-2026: RECONCILIACIÓN CON LA VERSIÓN DESPLEGADA (12.6.0) + AVISOS SOLO EN
  HCHEALTH. Esta rama y el Gist secreto que Tampermonkey venía sirviendo en producción se
  habían separado en dos historias divergentes desde un ancestro común (~12.5.9): cada una
  tenía cambios que la otra no tenía. Confirmado leyendo el código fuente completo de la
  12.6.0 pegado por el médico. Se portan aquí sus DOS cambios, y el número de versión ya
  puede subir de nuevo (quedaba retenido a propósito, ver los commits de esta rama entre
  12.5.9 y 12.5.13, hasta terminar esta reconciliación):
  - WHITELIST_13_LABS.TRIGLICERIDOS pierde el CUPS 903866 (auditoría cruzada con el
    Copiloto RCV: ese código es TGP/ALT, no Triglicéridos — un resultado de función
    hepática que caía por error en esta casilla). Queda solo 903868 (ver v12.0.5).
  - RAC con albuminuria franca (≥30 mg/g) exige control más frecuente: su vigencia para
    el aviso ROJO de labs RCV vencidos (v12.5.7) se reduce a la mitad, 90 días en vez de
    180. Nueva _vigenciaDiasParaAnalito(key, resultValCrudo), usada solo por
    _analitosRcvVencidos — injectLabsIntoCronicos no cambia.
  Además, en esta misma versión (no presente en la 12.6.0 desplegada): los avisos
  (Windows/toast/sonido/cartel) ya solo se MUESTRAN dentro del módulo clínico HCHealth —
  nunca se pierden, si ninguna pestaña está ahí quedan en cola y se disparan en cuanto una
  lo esté (ver _encolarAvisoPendiente/_flushAvisosPendientes/_dispararAvisoReal); más el
  reconocimiento del uroanálisis por componentes y su agrupación en el modal de
  laboratorios (ver commits previos de esta misma rama).
  Banco: 649/649.
*/

/*
  v12.6.2 — 12-08-2026: IMPRIMIR ORDEN DE PYM — CORREGIDO EL 404 REAL. Reportado en
  consultorio con captura de pantalla: el botón "🖨️ Orden <agrupador>" (v12.5.13) abría una
  pestaña con "HTTP ERROR 404" de neps.everestintelligent.com.
  Causa real, no adivinada: GenerarOrdenHC exige que el reporte YA esté generado en el
  servidor. El flujo de "Enviar por correo" (mismo modal) SÍ llamaba primero a
  GenerarLinksImpresionOrdenamientos (api/Morbilidad — nombre literal: "generar los ENLACES
  de impresión") antes de enviar; el botón de Imprimir, agregado después, nunca hacía esa
  llamada — construía la URL de GenerarOrdenHC directo con los datos de la creación de la
  orden y la abría sin más. imprimirOrdenPyM ahora acepta una pestaña ya abierta (mismo
  patrón que abrirInformeAthenea): se abre en blanco de forma SÍNCRONA en el clic real del
  médico —para no chocar con el bloqueador de ventanas emergentes del navegador, que trata
  un window.open() disparado después de un await como no venido de una acción directa del
  usuario— y se navega a la URL real recién cuando GenerarLinksImpresionOrdenamientos
  confirma que el reporte ya existe.
  apiOrdenamientoGenerarLinks ya no descarta su respuesta en silencio: la devuelve y la
  vuelca una única vez a consola (diagnóstico) — si trae un enlace directo y listo para
  usar, la próxima captura del médico permite dejar de reconstruir la URL a mano.
  Banco: 658/658 (5 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.6.3 — 12-08-2026: PANEL FLOTANTE POST-CITA (pedido explícito del médico). Reportado
  en consultorio: al asignar la cita de control, #vgl-agendar-modal se autocierra 2.6 s
  después (setTimeout(closeMod, 2600)) — sin tiempo real de leer ni pulsar el botón
  "🖨️ Imprimir recordatorio de cita" (v12.5.13), que vivía DENTRO de ese modal.
  Nueva mostrarPanelPostCita(citaId, epsNombre, nombreCompleto, patientNameFallback): crea
  un elemento INDEPENDIENTE del modal, directo en document.body — sobrevive a closeMod() y
  queda en pantalla (esquina inferior derecha) hasta que el médico lo cierre a mano o pasen
  5 min sin interacción. El botón de imprimir se movió ahí; el mensaje de éxito dentro del
  modal (que sí se ve durante los 2.6 s) queda igual.
  Confirmado con el médico (captura de pantalla + grabación de red real): el checkbox
  "📱 Enviar SMS de recordatorio al paciente" que vive dentro de #vgl-agendar-modal
  (ver S.smsRecordatorio, apiAccesoAsignarTurno) YA es el recordatorio de la CITA DE
  CONTROL — no de laboratorios — y YA envía el SMS automáticamente al crear la cita
  (contrato confirmado por segunda vez: GET /apiviva/APIAcceso/api/SMS/EnviarSMS
  ?Telefono=<celular>&AgendaTurnoId=<radicado>). No hace falta agregar nada ahí.
  Pendiente, sin evidencia todavía: "enviar por correo" el recordatorio de cita de control
  (a diferencia de las órdenes PyM, no hay una captura real de un endpoint de correo para
  citas — no se inventa uno).
  Banco: 663/663 (5 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.6.4 — 12-08-2026: EL SMS DE LA TOMA DE MUESTRAS, VISIBLE DONDE SE AGENDA (pedido
  explícito del médico: "¿hay opción de enviar el recordatorio de la cita de laboratorios
  al celular? Es importante tenerlo justo debajo o al lado de la opción de agendamiento").
  La respuesta es SÍ, y ya existía: apiLaboratorioAgendarAuto recibe el celular y, desde
  v12.3.31, envía el SMS de AppCita (GET /API/EnviarMensajeTextoLaboratorio?Celular&Fecha
  &Hora&codigoCita=<radicado>&codigoSede=378) reusando el MISMO número de la casilla
  "📱 Enviar SMS de recordatorio al paciente" que el médico ya ve y puede corregir arriba.
  Lo que faltaba era que se VIERA: mirando la casilla de laboratorio no había forma de
  saber si esa cita también avisaría al paciente. Nueva nota #vgl-agm-lab-sms-nota, dentro
  de la propia caja de laboratorio, que dice a qué número saldrá el SMS (o por qué no
  saldrá) y se actualiza en vivo al marcar/desmarcar la casilla o corregir el celular.
  Cero llamadas nuevas: solo hace visible lo que ya ocurría.
  Banco: 663/663 (2 comprobaciones nuevas, verificadas con test de mutación).
*/

/*
  v12.6.5 — 12-08-2026: IMPRIMIR ORDEN DE PYM — LA URL REAL, LA QUE DEVUELVE EVEREST.
  La corrección de v12.6.2 (llamar a GenerarLinksImpresionOrdenamientos ANTES de abrir la
  orden) era necesaria pero no suficiente: el 404 seguía porque la URL que se abría estaba
  RECONSTRUIDA a mano. La grabación real del médico (GRABADOR, botón "Imprimir" oficial de
  Everest) muestra que ese mismo endpoint devuelve la URL de impresión en el cuerpo de la
  respuesta, ya lista:
    GET /apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos
        ?PacienteId=<id>&Agrupador=<agrupador>
    -> https://neps.everestintelligent.com/apiviva/APIImpresion/reportepdf/GenerarOrdenHC
       ?Agrupador=<agrupador>&idPaciente=<id>
  Es decir: OTRO módulo (APIImpresion, no APIOrdenamientoHealth), otra grafía
  (reportepdf en minúsculas) y SIN el parámetro NumAutorizacion. Las tres cosas juntas
  explican el 404 exacto de la captura. Ya no se reconstruye nada: se usa la URL que el
  servidor devuelve (_urlImpresionOrdenPyM la extrae venga como texto plano, como cadena
  JSON o dentro de un objeto). La reconstrucción queda solo como último recurso, y ahora
  con la ruta correcta de la captura. Como el cuerpo NO siempre es JSON, la llamada dejó
  de pasar por pageFetchJson (que hace resp.json() y descartaba la respuesta entera al no
  poder parsearla) y lee el cuerpo como texto, igual que apiEnviarOrdenPorCorreo.
  Retirado NumAutorizacion de imprimirOrdenPyM y el mapa numAutPorAgrupador que solo
  existía para alimentarlo: la URL real de Everest no lo lleva.
  Banco: 665/665 (4 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.6.6 — 12-08-2026: EL AVISO DE LABS RCV, POR FIN CON SU PROPIA TARJETA + EL CORREO
  DE LA ORDEN CON EL ID DEL PACIENTE.
  1) Reportado en consultorio con captura: el aviso "Laboratorios RCV sin resultado
     vigente" salía como TEXTO SUELTO sobre la historia clínica —sin tarjeta, sin fondo,
     en el azul heredado de Everest y encimado con el formulario— pese a tener su hoja de
     estilos completa desde v12.5.7. No era un problema de diseño: #vgl-labsv-modal se
     cuelga de document.body, fuera de #vgl-root, y NO estaba en la lista de selectores
     donde se declaran los tokens (--bg-solid, --fg, --r-surface, --font-stack...). Sin
     tokens, toda declaración con var() es inválida y el navegador la descarta: quedaban
     solo las literales (padding, max-width, text-align), que es exactamente la pantalla
     que mandó el médico. El diseño ya existía; nunca le llegaba.
     El mismo agujero tenía #vgl-postcita-panel (v12.6.3), que habría salido igual de roto
     la primera vez que apareciera. Ambos entran ahora en las cuatro listas globales:
     tokens oscuro, tokens claro, prefers-reduced-motion y el reset de box-sizing; y se
     les extiende el blindaje de color contra los estilos globales de Everest.
     Prueba nueva ESTRUCTURAL (mira la fuente, no el DOM simulado: el arnés no aplica CSS,
     así que ninguna prueba de comportamiento puede ver esto): todo overlay creado por el
     código cuya regla propia lo posiciona con position:fixed debe estar en la lista de
     tokens. Sirve para cualquier overlay futuro.
  2) apiEnviarOrdenPorCorreo: `UsuarioId` es el id del PACIENTE, no el del médico.
     Confirmado en la grabación real: en la misma corrida Everest pide
     GenerarLinksImpresionOrdenamientos?PacienteId=801848 y acto seguido
     EnviarEmailOrdenamiento?...&UsuarioId=801848, siendo 309 el médico de esa sesión
     (mismo patrón en EnviarEmailMedicamento). Se replica lo que hace Everest — el médico
     no tiene cómo verificar si los correos están llegando. El id sale de BuscarPaciente
     de ESA cita (pacienteIdOrd), así que cambia de paciente en paciente; nunca es fijo.
     La prueba nueva ejercita el PUNTO DE USO (el botón "Enviar" del modal), no solo la
     función de red: por eso la mutación al id del médico ahora se cae.
  Banco: 667/667 (3 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.6.7 — 12-08-2026: EL UROANÁLISIS SE COMPLETA DE VERDAD. ORDEN CORREGIDO.
  Reportado en consultorio con captura: el script marcó "SI" en "¿Uroanálisis?" y dejó el
  bloque ENTERO vacío — ni resultado, ni fecha, ni las 7 casillas de componente (Nitritos,
  Sangre, Hematíes, Glucosuria, Leucocitos, Cilindros, Proteinuria).
  Causa real, no adivinada: el "SI" se marcaba AL FINAL de injectLabsIntoCronicos, después
  de recorrer los laboratorios e intentar escribir cada casilla. Pero esas casillas solo
  existen en el DOM cuando el interruptor está en SI — Angular monta el bloque con *ngIf.
  Es decir: en la primera visita se buscaban 7 casillas que el propio script todavía no
  había hecho aparecer, todas se anotaban como "sin casilla" y nunca se reintentaban.
  El médico lo había dicho literalmente: "recuerda que primero debe darse clic al botón SÍ".
  - Nueva _hayComponenteUroReal(labsArray): responde SOLO con datos, sin tocar el DOM, si
    Athenea trajo al menos un componente real del parcial (no vacío, no PENDIENTE). Con
    eso el "SI" se marca ANTES de buscar la primera casilla.
  - Reintento acotado también para las 7 casillas de componente (300 ms y 900 ms, y se
    abandona): el re-render del *ngIf no es síncrono con el click. Ya existía para el par
    resultado/fecha desde v12.5.12; ahora cubre el bloque completo. Se guarda el valor del
    analito MÁS RECIENTE, nunca uno viejo, y se escribe solo en casilla vacía.
  Sin cambios en las reglas sagradas: verbatim de Athenea, jamás en casilla ya escrita.
  El interruptor NORMAL/ANORMAL sigue SIN automatizarse — es interpretación clínica y no
  hay evidencia de la semántica del control: ante la duda, decide el médico.
  Banco: 671/671 (4 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.6.8 — 12-08-2026: UN SEPARADOR DISTINTO YA NO PIERDE UN RESULTADO.
  Reportado en consultorio con el PDF real del laboratorio: una paciente con resultado de
  RAC (RELACION MICROALBUMINURIA CREATININA = 6.93 mg/gr, orden 26080402518) no se
  completó sola en la Ruta de Crónicos.
  Causa encontrada: _matchLabInWhitelist comparaba el nombre como TEXTO CRUDO en
  mayúsculas — sensible a tildes (por eso la entrada de RAC ya tenía que repetir a mano
  "RELACION"/"RELACIÓN") y sobre todo a la PUNTUACIÓN. El mismo examen viaja con
  separadores distintos según la vista de la que salga ("RELACION MICROALBUMINURIA
  CREATININA", ".../CREATININA", "...-CREATININA"), y con un solo carácter de diferencia
  no casaba con NINGUNA entrada: su resultado no se escribía y el analito desaparecía sin
  contarse ni avisarse. Nuevo _canonNombreLab: quita tildes y normaliza / - _ , . ; : ( )
  a espacio, en AMBOS lados de la comparación (nombres Y exclusiones). Es normalización
  tipográfica, no clínica — no amplía qué examen casa con qué casilla; las guardas que
  separan creatinina sérica de creatinina en orina, o microalbuminuria (mg/L) de la
  relación albuminuria/creatinina (mg/g), siguen intactas y con prueba propia.
  Además, diagnóstico único por sesión: se vuelca a consola qué trajo Athenea que no casó
  con ningún examen conocido (nombre, padre, código y resultado — nunca datos del
  paciente). Si vuelve a fallar un analito, el siguiente reporte trae el nombre exacto y
  se agrega con evidencia. Hasta ahora ese caso era mudo.
  Banco: 673/673 (2 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.6.9 — 12-08-2026: EL TABLERO POR FIN DICE DE QUIÉN ES CADA FILA, Y VE LOS ERRORES.
  Revisando la Hoja real de Apps Script (34 filas de dos jornadas) salieron tres cosas:
  1) La columna `equipo` venía VACÍA en TODAS las filas. Dependía de que alguien escribiera
     a mano el ajuste S.equipo y nadie lo hace: el tablero era un montón de filas anónimas
     donde no se podía saber si dos venían del mismo consultorio. Nuevo _equipoId(): si el
     ajuste está vacío se usa un identificador aleatorio y estable creado en ESE navegador
     — un número de serie sin significado (ni nombre, ni usuario, ni IP, ni huella del
     navegador), que el médico puede sobrescribir poniéndole nombre al equipo en Ajustes.
  2) Había filas DUPLICADAS exactas: mismo ts y mismo contenido, recibidas con minutos de
     diferencia (un reintento de la cola que en realidad sí había llegado). Cada fila lleva
     ahora `lote`, único por encolado, para que el tablero descarte el duplicado en vez de
     contar dos veces la misma jornada.
  3) Solo se reportaba lo que salía BIEN. Un fallo del script en consultorio no dejaba
     rastro remoto: se sabía de él únicamente si el médico lo contaba. Ahora se enganchan
     los errores del propio userscript (window.error y promesas sin capturar, filtrados por
     origen para no subir el ruido de Everest, que es constante): se CUENTAN todos y los 5
     primeros de cada día viajan con su mensaje saneado — sin URL, sin comillas y con toda
     tira de 6+ dígitos borrada, así una cédula no sobrevive ni aunque venga dentro del
     mensaje de error.
  Y una fila `entorno` una vez al día (versión instalada, navegador, sistema, tamaño de
  pantalla, zona horaria y gestor de userscripts): sin eso, un fallo reportado no se puede
  leer, y el tablero mostraba versiones que ya no se reconocían.
  Cero PHI, como siempre: nada de esto identifica a un paciente ni a una persona.
  Banco: 677/677 (4 pruebas nuevas, verificadas con test de mutación).
*/

/*
  v12.5.12 — 12-08-2026: LA CASILLA DE RESULTADO DEL UROANÁLISIS SE COMPLETA SOLA.
  Con el HTML real pegado en consultorio se confirmó lo que v12.0.4 nunca pudo ver:
  `resultadoUroanalisis`/`fechaResultUroanalisis` (los mismos resultId/dateId que
  WHITELIST_13_LABS ya tenía desde el principio) SÍ existen en el DOM — pero Angular los
  monta con `*ngIf` solo cuando "¿Uroanálisis?" está en SI. Por eso nunca se encontraban:
  la vista los oculta hasta que alguien marca SI, y hasta v12.5.11 nadie lo hacía por el
  médico. Ahora que _marcarUroanalisisSi() ya lo marca (ver esa versión), el camino
  genérico de injectLabsIntoCronicos encuentra la casilla la mayoría de las veces en la
  MISMA corrida síncrona. Para el caso en que Angular tarde en re-renderizar el *ngIf
  (el click y la lectura del DOM ocurren en el mismo tick de JS, sin garantía de que el
  framework ya haya montado el nodo), se agrega UN reintento corto (300 ms) que solo se
  dispara si (a) se acaba de marcar SI en esta misma corrida y (b) la casilla no apareció
  a tiempo — nunca como sondeo general. Mismas reglas sagradas: valor y fecha verbatim de
  Athenea, solo si la casilla sigue vacía cuando el reintento la encuentra.
*/

/*
  v12.5.11 — 12-08-2026: EL BOTÓN AUTO-LABS (ATHENEA) TAMBIÉN MARCA "SI" EN
  ¿UROANÁLISIS? Pedido del consultorio, con la etiqueta HTML real capturada en campo: el
  interruptor "¿Uroanálisis?" de la Ruta de Crónicos es un par de radios `name=
  "resultadoPrograma.swUroanalisis"` SIN atributo `value` (Angular los distingue por
  FormControl, no por HTML) — la única ancla real es el texto visible del <label> que
  envuelve cada radio ("SI"/"NO"), igual que _findUroInput ya usa el placeholder para las
  7 casillas de componentes desde v12.3.37. Nuevo _marcarUroanalisisSi(): busca el radio
  cuya etiqueta sea "SI" y le hace click, PERO SOLO si el médico no había elegido SI ni NO
  todavía (si ya eligió cualquiera de los dos, se respeta tal cual — nunca se pisa una
  decisión clínica ya tomada, ni siquiera para "corregir" un NO). Se dispara en
  injectLabsIntoCronicos en cuanto Athenea confirma al menos un componente REAL (no vacío,
  no PENDIENTE) del parcial de orina — la misma condición que ya decide si ese componente
  se escribe en su casilla — y el resultado queda expuesto en `uroanalisisMarcado` para
  que el resumen del botón se lo diga al médico.
  El interruptor NORMAL/ANORMAL sigue SIN automatizarse — es interpretación clínica y la
  evidencia de DOM que se recibió para ese control coincidía, sin explicación, con la del
  propio SI/NO de "¿Uroanálisis?"; se pidió confirmación antes de tocarlo, misma regla de
  la casa de siempre (v11.0.1): ante la duda, se deja al médico, jamás se inventa.
*/

/*
  v12.5.10 — 12-08-2026: LOS AVISOS GRANDES DE PACIENTE YA NO SE SUPERPONEN. Pantallazo
  real de consultorio: un paciente con PyM pendiente (Tamización de VIH) Y labs RCV
  vencidos (Uroanálisis) a la vez mostraba los DOS modales de pantalla completa AL MISMO
  TIEMPO, uno encima del otro — nombre del paciente duplicado, pie de página duplicado,
  botón "Entendido" duplicado, ilegible. Causa: checkRecordatorioPym, checkAbandonoPES y
  checkLabsVencidos corren uno tras otro en el mismo tick (10091), cada uno decide por su
  cuenta si le toca mostrar SU modal, y ninguno mira si otro de los tres ya está abierto.
  Nuevo guard otroAvisoDePacienteAbierto() (mira #vgl-pym-modal/#vgl-pes-modal/
  #vgl-labsv-modal en el DOM): si cualquiera de los otros dos ya está en pantalla, el
  tercero NO se marca como visto todavía y se pospone — el siguiente tick (por defecto
  5 s) lo reintenta solo, y en cuanto el médico cierra el primero con "Entendido" el
  siguiente sale por su cuenta. Ningún aviso se pierde, solo se ponen en fila. El cartel
  de fraude (#vgl-modal) es una familia aparte y no entra en este guard.
*/

/*
  v12.5.9 — 11-08-2026: SEGUNDA VARIANTE REAL DE TARJETA DE ATHENEA — LA FECHA DENTRO
  DEL FORMULARIO. Consola de campo (paciente con 11 solicitudes, modal "Sin fecha" en
  todos los renglones): Athenea tiene una plantilla donde el <form> de "Ver Informe" NO
  va al final de la tarjeta sino que la ENVUELVE — la fecha en español y el "Numero" van
  DENTRO del formulario, después de su apertura, y los formularios de solicitudes
  consecutivas quedan pegados (</form><form>) sin divs entre ellos. El recorte de
  v12.5.5 ("la fecha siempre va antes del formulario", cierto solo para la variante
  clásica) producía aquí DOS fallos a la vez, confirmados en el diagnóstico de consola:
  la tarjeta quedaba sin su propia fecha (tarjeta #1: español [], ninguna), y esa fecha
  caía en la ventana TRASERA de la tarjeta SIGUIENTE, que la adoptaba si el año
  coincidía (tarjeta #2 "aceptó" 2026-08-04 06:02 — fecha de la solicitud 1330106, no
  de la 763563: la misma clase de contaminación cruzada que v12.5.5 corrigió, por otra
  vía). La frontera correcta, válida para AMBAS variantes, es el CIERRE </form>: la
  fecha propia vive siempre entre el cierre del formulario ANTERIOR y el cierre del
  PROPIO (HTML prohíbe anidar formularios, así que el primer </form> tras cada apertura
  es inequívocamente el suyo). El hash/token pierde además su tope fijo de 1500: son
  campos del formulario y el cierre propio los acota exactamente (en la variante
  envolvente el token va al FINAL y podía quedar fuera del tope).
  Pruebas: 4 nuevas con la variante envolvente calcada del volcado real (una sola,
  dos pegadas del mismo año — el repro exacto del fallo de campo —, mezcla de ambas
  variantes en una página, y envolvente sin fecha junto a vecino con fecha).
  Revisión adversarial DEL PROPIO FIX (3 lentes, 8 hallazgos, 8 confirmados con repro
  ejecutable, 0 refutados) — todos corregidos en esta misma versión:
  · ALTA: el emparejamiento apertura→cierre tomaba CUALQUIER </form> posterior; a un
    formulario sin cierre (truncado/averiado) se le asignaba el cierre de la tarjeta
    VECINA — adoptaba su fecha y hasta su hash/token, y la vecina perdía los suyos.
    Ahora el cierre solo cuenta como propio si queda antes de la apertura siguiente;
    si no, aplica el respaldo (inicio del siguiente o apertura+1500), nunca la
    frontera de una vecina.
  · MEDIA: '</form >' y '</form\n>' (fines de etiqueta válidos en HTML) eran
    invisibles para el barrido de cierres — ahora /<\/form\s*>/gi, simétrico con la
    apertura.
  · MEDIA: un '</form>' dentro de un comentario HTML o de un <script> (marcado
    legado, string de JS) partía la tarjeta en una frontera falsa — se excluyen las
    zonas muertas del barrido.
  · MEDIA: la primera tarjeta no tenía frontera trasera estructural y su ventana de
    -3000 ingería chrome de página (una "Fecha de impresión" del año en curso podía
    colarse en una tarjeta sin fecha) — si hay algún </form> antes de la primera
    tarjeta (p. ej. el __AjaxAntiForgeryForm de ASP.NET), ese cierre es ahora su
    frontera trasera.
  · 3 huecos de cobertura clavados con prueba: form ajeno intercalado, respaldo de
    HTML truncado (era código sin ejercitar), y cierre en mayúsculas </FORM>.
  Banco: 608 comprobaciones, cobertura 296/323 (91.6%).
*/

/*
  v12.5.8 — 11-08-2026: EL AUTO-LOGIN DE ATHENEA YA NO FALLA EN SILENCIO. Reportado en
  campo con consola real: la sesión caía, el latido intentaba el auto-inicio y "no pasaba
  nada" — sin una sola línea que dijera por qué. Los tres caminos mudos de
  atheneaAutoLogin ahora explican su motivo: (1) SIN credencial guardada en ESTE equipo
  (la causa del reporte: la cuenta compartida se guarda una sola vez POR COMPUTADOR en
  Ajustes y jamás viaja con el script — en un equipo recién actualizado ese paso manual
  sigue pendiente), avisa por consola Y con una notificación ámbar una vez al día con la
  instrucción exacta; (2) /Account/Login con HTTP distinto de 200, lo dice como
  transitorio; (3) página de login sin token CSRF reconocible, lo dice como posible
  cambio del portal. Ningún cambio de comportamiento de login en sí — solo visibilidad.
*/

/*
  v12.5.7 — 11-08-2026: AVISO ROJO DE LABORATORIOS RCV SIN RESULTADO EN 180 DÍAS (pedido
  explícito del médico, simplifica el enfoque de estadificación renal por Cockcroft-Gault
  que se había planteado antes — queda pendiente para otra sesión si se retoma). A TODO
  paciente se le busca ahora el resultado MÁS RECIENTE de 7 analitos (Colesterol Total,
  Colesterol HDL, Triglicéridos, Glucosa en Suero, Uroanálisis, Creatinina en Suero, RAC) y,
  si a alguno le falta un resultado en los últimos 180 días (ausente o vencido), se avisa en
  ROJO al abrir la historia — mismo patrón "una vez por paciente por día" que
  checkRecordatorioPym/checkAbandonoPES, y lee SOLO lo que el robot de Athenea ya
  pre-cargó (_labsPrefetch), nunca dispara su propia consulta. HbA1c se sigue extrayendo
  (whitelist de siempre) pero NUNCA entra en esta regla (no todo paciente es diabético);
  PTH, Hemoglobina, Fósforo y Albúmina tampoco entran: esos solo se autocompletan en
  Everest si Athenea trae resultado, y si no, se omiten sin aviso — comportamiento que ya
  existía sin cambios.
  Piezas nuevas: _ultimaFechaPorAnalito (extraída de injectLabsIntoCronicos, donde vivía
  inline desde v12.5.6, para reutilizar la misma regla "gana la fecha más reciente"),
  _analitosRcvVencidos, labsVencidosAlert (modal calcado de abandonoPESAlert con la paleta
  --c-rojo), checkLabsVencidos, interruptor + botón "Probar" en Ajustes.
  Revisión adversarial (3 lentes, 3 hallazgos, 3 confirmados, 0 refutados): un resultado
  NUMÉRICO 0 (p. ej. RAC=0 en un paciente sano) es un valor real, pero `||` lo trataba como
  ausente (0 es falsy) — con este aviso nuevo, eso se traducía en un falso ROJO pese a
  existir un resultado vigente; corregido con _valorCrudoLab (solo descarta
  null/undefined/cadena vacía, nunca un 0 legítimo). Además: prueba reforzada para la
  mezcla real "1 analito vencido + 6 nunca realizados" en la misma llamada, y prueba de
  no-excepción para labsVencidosAlert con datos realistas y con lista vacía.
  Banco: 596 comprobaciones, cobertura 296/322 (91.9%).
*/

/*
  v12.5.6 — 11-08-2026: EN COLISIÓN DE ANALITOS, GANA LA FECHA MÁS RECIENTE (pedido
  explícito del médico). injectLabsIntoCronicos escribía la casilla con el PRIMER
  resultado del mismo analito que encontraba en labsArray, asumiendo que Athenea
  siempre entrega las solicitudes de más reciente a más antigua — un supuesto de
  ORDEN, nunca comparado contra las fechas reales. Ahora se agrupan primero TODOS los
  candidatos de cada uno de los 13 analitos del whitelist (PTH, Fósforo, Albúmina y
  Hemoglobina incluidos) y gana el que tenga la fecha ISO más reciente: un resultado
  CON fecha siempre le gana a uno sin fecha, y entre dos con fecha manda la mayor
  (empate o ambos sin fecha: se conserva el primero visto, estable). No cambia nada
  del resto de las reglas ya existentes (casilla del médico sagrada, fecha solo se
  completa si está vacía, etc.) — solo decide CUÁL repetición es la vigente antes de
  aplicarlas.
  Pendiente (bloqueado, a la espera de que el médico entregue la fórmula de
  Cockcroft-Gault y confirme cómo se determina el "programa" del paciente en Everest):
  estadificación renal para exigir/omitir PTH, Fósforo y Albúmina según estadio ERC, y
  contrastar la fecha más reciente contra la VIGENCIA administrativa por examen que el
  médico ya entregó (tablas de control DM2/HTA/ERC del manual de programas especiales).
*/

/*
  v12.5.5 — REVISIÓN ADVERSARIAL DE v12.5.4 (3 lentes, 13 confirmados, 0 refutados,
  11-08-2026): la ventana de búsqueda alrededor de cada solicitud (-3000/+700 desde
  v12.5.3) no estaba acotada por tarjeta — con solicitudes reales pegadas una tras
  otra, cubría 2-3 tarjetas VECINAS, y _fechaDesdeNumeroSolicitud (sin bandera /g)
  devolvía el PRIMER "Numero:" de esa ventana compartida: el de la tarjeta vecina, no
  el de la propia. Confirmado 8/9 mal en un repro de 9 solicitudes reales — la fecha
  de OTRO examen del mismo paciente podía terminar escrita en Crónicos (hallazgo
  BLOQUEANTE). Un bug simétrico en la extracción de hash/token podía además abrir el
  PDF de una solicitud vecina desde el botón "Ver informe" (ALTA). Correcciones:
  · Cada tarjeta ahora se procesa con las posiciones de TODAS las demás ya conocidas
    (matchAll en vez de exec en bucle), y su ventana de búsqueda queda acotada por la
    tarjeta anterior y la siguiente — nunca más ancha que la tarjeta propia.
  · Se retiró el margen fijo hacia ADELANTE del formulario: la tarjeta REAL de
    consultorio (confirmada en v12.5.4) demostró que la fecha y el "Numero" van
    SIEMPRE antes del formulario, nunca después — ese margen ya no aportaba nada y sí
    abría la vía de contaminación cruzada. Una prueba de v12.3.36 que asumía fecha
    DESPUÉS del formulario quedó documentada como superada.
  · _fechaDesdeNumeroSolicitud exige ahora la MISMA disciplina que el camino español:
    recoger TODOS los "Numero:" del texto y exigir que resuelvan a una única fecha.
  · El camino numérico dd/mm/aaaa preexistente ahora también se descarta ante
    conflicto con "Numero" de la misma tarjeta (antes solo protegía el camino español
    en texto plano — fix simétrico).
  · La entidad &nbsp;/&#160;/etc. ya no exige el ';' de cierre (algunas variantes de
    HTML lo omiten; sin esto la HORA se perdía en silencio, nunca la fecha).
  · abrirInformeAthenea gana una guarda anti-doble-clic (Set de hashes en vuelo).
  Banco: 572 comprobaciones, cobertura 291/317 (91.8%).
*/

/*
  v12.5.4 — LA FECHA DE ATHENEA, RESUELTA DE VERDAD (11-08-2026). Cierre de la cadena de
  diagnósticos de campo iniciada en v12.5.3: capturas de red confirmaron que el informe
  PDF es una imagen escaneada sin una sola letra de texto (0 operadores BT, los 7 streams
  fallan al descomprimir como deflate — no hay nada que leer ahí). Pero una captura de
  pantalla real de consultorio reveló que la fecha SIEMPRE estuvo en el HTML que el
  script ya descarga, en texto plano, dentro de cada tarjeta de solicitud — el problema
  nunca fue DÓNDE buscar (ya se había ensanchado la ventana en v12.5.3), fue QUÉ patrón
  buscar: Athenea la escribe como "vie. 15 may. 2026 07:31 a. m." (día de la semana +
  día + MES EN LETRAS ESPAÑOLAS + año), un formato que ningún patrón numérico podía
  reconocer. Se agrega _parseFechaEspanolLike para ese formato exacto.
  Verificación cruzada añadida (nunca como única fuente): la misma tarjeta trae
  "Numero: 26051503125" — confirmado 4/4 contra fechas reales que los 6 primeros
  dígitos son año-mes-día. Si el texto en español y el Numero DISCREPAN, se descarta la
  fecha entera en vez de adivinar cuál tiene razón (misma filosofía "antes casilla
  vacía que dato inventado" de siempre). Con esto, el pipeline COMPLETO que ya existía
  desde v12.4.x (getAtheneaLabsAuto → __vglFechaSolicitud/__vglHoraSolicitud →
  _extractAtheneaFecha → injectLabsIntoCronicos) empieza a funcionar de punta a punta
  sin ningún cambio adicional: la fecha real llega sola a la casilla de Crónicos.
  Bono: se extrae también hash+token de cada tarjeta (los mismos campos que el propio
  botón "Ver Informe" de Athenea envía a /Resultados/Reporte, confirmado con captura de
  red real) y se agrega un botón 📄 en la tabla de laboratorios del modal que abre ese
  PDF real con un clic — no reemplaza la fecha (el PDF no tiene texto legible), es solo
  un atajo para que el médico vea el documento oficial sin navegar Athenea a mano.
  Banco: 564 comprobaciones, cobertura 291/317 (91.8%).
*/

/*
  v12.4.0 — RONDA DEL 11-08-2026 (pedidos del consultorio, decisiones del médico A/B/C/D)
  1. AGENDA BLINDADA ("solo aparece 5:30 PM"): en Medicina General ya se consultan TODAS
     las agendas propias del médico en el día (antes .find() se quedaba con la primera y
     una jornada partida perdía la otra media agenda). Diagnóstico en consola de agendas
     recibidas/del día/propias + distribución de estados de turnos, y detector de "agenda
     congelada" (mismos turnos para fechas distintas ⇒ advertencia visible).
  2. CUPO EN TIEMPO REAL (cita principal, patrón del laboratorio): antes de AsignarTurno
     se re-consulta la agenda; si la hora elegida ya no está activa, NO se dispara la
     escritura: se recargan los horarios y se avisa "esa hora ya no está disponible".
     Tras un rechazo del servidor también se refrescan los horarios.
  3. PANEL PyM: los chips envuelven en varias líneas (adiós scroll horizontal con máscara
     que cortaba el último chip), letra 11.5px, y los nombres son LOS DE LA TABLA OFICIAL
     de CUPS. Optometría (AV) y Odontología (OD) salen del panel; siguen como pendientes
     en el aviso al abrir la historia, que ahora: muestra SOLO lo que queda pendiente si
     el médico ya ordenó desde el panel (markOrdenesCreadasHoy guarda las actividades
     cubiertas), y se repinta ROSA (--c-pes) con abandono del programa cardiovascular.
  4. TABLA OFICIAL DE CUPS en PYM_CATALOG: Z108 con LDL 903816 (tamizaje de SANOS; el
     903817 queda solo en el RCV exprés de crónicos ERC/HTA/DM2 — aclarado en consulta);
     fuera Hepatitis C (906225) y VDRL (906039): de las ETS solo se tamiza VIH. Keyword
     'cardiometabolic' arregla el premarcado de Z108 que el género -a/-o dejaba inerte.
  5. PyM DIARIO CON PARADA: se busca el Agenda_Dia_CMB de hoy cada 10 min durante toda la
     jornada (mientras tanto manda la base piloto), y en cuanto el REAL de hoy carga, la
     re-búsqueda PARA (debeBuscarPymDiario) — pedido explícito; «Abrir PyM» siempre manda.
  6. PUNTUALIDAD RESCATADA (semántica original v8.2.0, decisión A): siembra silenciosa +
     VERDE solo en llegada EN VIVO (a.arrival por fin se consume); textos precisos y
     neutros — ROJO "Confirmación extemporánea", MORADO "última llamada ~1 min", ÁMBAR
     "venció el tiempo de gracia".
  7. HORA DE ATHENEA DE PUNTA A PUNTA: _parseFechaHoraLike conserva {fecha, hora} en ISO,
     /Date(ms)/ y dd/mm/aaaa (cuyo ancla $ hacía que "11/08/2026 07:35" cayera a "Sin
     fecha" — bug real corregido); el raspado de la tarjeta captura la hora del portal
     (única e inequívoca o nada); la tabla del modal muestra "dd/mm/aaaa · HH:MM" y las
     casillas inyectadas en Crónicos llevan tooltip "Athenea: fecha a las HH:MM" (el
     <input type=date> de Everest no puede almacenar hora). Diagnóstico nuevo: si la
     fecha se reconoce pero ninguna fuente trae hora, la consola lo dice con las claves
     reales del analito.
  Banco: 520 comprobaciones (26 nuevas, suite_21), cobertura 282/308 (91.6%).

  v12.4.1 — REVISIÓN ADVERSARIAL DE LA v12.4.0 (3 lentes + verificación escéptica):
  16 hallazgos, 15 confirmados con reproducción real, todos corregidos aquí:
  · Entidades HTML en la tarjeta de Athenea ("p.&nbsp;m."): una toma de la TARDE se
    mostraba como de la mañana — se normalizan entidades y se descarta la hora si el
    meridiano quedó a medias. NBSP/espacio fino aceptados como separador.
  · «Abrir PyM» con un archivo VIEJO ya no apaga la búsqueda del real de hoy: el día
    solo se estampa cuando lo cargado es el diario real (nombre con la fecha de hoy).
  · /Date(ms)/ de medianoche UTC: fecha por getters UTC, sin día corrido ni "19:00".
  · Hora con designador de zona (Z/±hh:mm): se calla (podría estar corrida de reloj).
  · Basura pegada a la fecha ("11/08/2026-15/09/2026", "12/05/2026 Control"): el valor
    ENTERO se rechaza en vez de escribir la primera mitad en la historia.
  · pymPendientesRestantes: el [] de "órdenes sin coincidencia PyM" ya se persiste y no
    silencia tamizajes nunca ordenados; chip "+ remisión AV/OD" en el panel para que
    las remisiones no queden invisibles con el aviso apagado.
  · Confirmar cita: contexto del turno CONGELADO antes de los await (el turno asignado
    no puede divergir de la hora visible) y botones de hora bloqueados en vuelo.
  · Detector de agenda congelada: firma solo con ids completos y por especialidad.
  · La hora del envoltorio de consultaDetalleSolicitud ahora sí se hereda.
  · Pruebas nuevas: jornada partida (2 agendas propias), cupo re-verificado (con y sin
    turno vivo), entidades HTML, zona horaria, basura tras fecha, [] persistido, parada
    del polling con archivo viejo. Banco: 533 comprobaciones, cobertura 283/308.
  Pendiente delegado (tests/): suite_05/07 tienen 10 casoAsync sin await (comprobaciones
  fantasma) — tarea escrita para Jules en JULES_TAREAS.md; no toca este archivo.
*/

/*
  v12.0.0 — UNIFICACIÓN DE LOS DOS LINAJES
  El script se había bifurcado en dos versiones que evolucionaron por separado y ya no se
  podían mezclar solas. Esta versión las funde en una sola: de cada lado se conserva lo que
  funciona y se descarta lo que no.

  SE ELIMINA (venía del linaje del repositorio y era peligroso o inerte)
  - Resultados de laboratorio INVENTADOS. Cuando la consulta real no devolvía nada se
    mostraban siete exámenes fabricados en la misma tabla y con la misma etiqueta de origen
    que los reales. Además nunca se llegaba a consultar Athenea de verdad: el contrato de
    getAtheneaIdSolicitudAuto estaba mal comprobado y esa rama era código muerto, así que
    los datos inventados eran, en la práctica, lo único que se veía.
  - Pacientes de PRUEBA con cédulas ficticias que se pintaban en el panel igual que los
    reales, uno de ellos marcado como abandono del programa cardiovascular.
  - El recolector de basura para la SPA: estaba pegado dos veces y, en cada cambio de ruta
    de Angular, apagaba los cuatro temporizadores creados al arrancar (recordatorio de PyM,
    reporte, chequeo de versión y contador del silenciador) sin que nadie los volviera a
    armar, y arrancaba del DOM los modales abiertos, incluido el de agendamiento en uso.
  - Los modales de agendar, ordenar y laboratorios, y la bitácora de auditoría, dejan de
    publicarse en la ventana de la página: eran acciones de ESCRITURA clínica accesibles a
    cualquier script de Everest.
  - La quinta ruta de búsqueda de paciente, que pasaba la cédula donde va el id interno.

  SE CONSERVA DEL LINAJE DEL REPOSITORIO
  - Buscador de pacientes tolerante a erratas.
  - Bitácora local de diagnóstico, ahora sin objetos crudos: solo campos acotados, para que
    no acaben datos del paciente en el registro.
  - Liberación del bloqueo de liderazgo también en unload, no solo en beforeunload.
  - Consulta a Athenea como fuente principal del modal de paraclínicos, ya reparada.
  - Resaltado en rojo de los valores que el propio laboratorio declara alterados. El resto
    deja de pintarse en verde: dar por normal lo que el script no ha interpretado es una
    afirmación clínica que no le corresponde hacer.

  SE INCORPORA DEL LINAJE LOCAL
  - Consulta a Athenea con reintento por AÑO: con un solo año, los laboratorios pedidos a
    finales del año anterior no aparecían nunca.
  - Avisos de sincronización descartables y con autocierre; antes se quedaban fijos toda la
    jornada tapando la esquina de la pantalla.
  - La notificación del PyM del día deja de repetirse en cada revisión de fondo.
  - Parche de digiturno para los nombres con espacios, acotado al host correcto.

  SE CORRIGE EN LA PROPIA UNIFICACIÓN
  - El filtro de sexo de las órdenes PyM estaba definido pero NO se usaba: las diez
    actividades seguían saliendo premarcadas, incluidas mamografía y citología en hombres.
  - Los ajustes técnicos habían quedado INALCANZABLES (se abrían con una marca que ya nadie
    escribía) y con ellos controles que el médico sí usa. Ahora «Actualizar lista de
    prevención» y «Sincronizar almacenamiento» están siempre visibles, y el resto se abre
    con un interruptor normal.
  - El cartel de cita asignada usaba una clase CSS que no existía y salía sin estilo.
  - Las filas de Athenea se pintaban con el texto genérico «Paraclínico» porque faltaba su
    campo de nombre.
  - Aviso cuando algún examen de un paquete de órdenes no se pudo resolver.

  PENDIENTE (documentado, no resuelto aquí)
  - (RESUELTO en v14.1.1) La contraseña de Athenea ya NO está en el código: las
    credenciales solo se leen de GM_getValue y, si no están fijadas, no hay autologin.
    OJO: retirarla del código no la desactiva — sigue siendo válida en Athenea y sigue
    en el historial de git. ROTARLA en Athenea sigue pendiente y es acción del médico.
  - ProgramaId en AsignarTurno y BuscarCitasDisponibles: la aplicación oficial los envía y
    el script no. Sin más capturas, cambiarlo es más arriesgado que el defecto.
  - (RESUELTO en v12.3.0) El módulo de órdenes PyM ya está verificado contra una captura
    del módulo nativo de Everest: el payload coincide byte por byte.
*/

/*
  v11.0.1 — AUDITORÍA CONTRA TELEMETRÍA REAL (26 capturas · 1527 llamadas de Everest)
  Cada cambio está respaldado por lo que la aplicación OFICIAL hace de verdad. Lo que no
  tenía respaldo en las capturas se dejó como estaba, y se anotó por qué.

  SEGURIDAD DEL PACIENTE
  - La cita solo se da por creada si el servidor lo confirma (error:false + radicado).
    Antes cualquier "mensaje" —incluido uno de ERROR— mostraba "¡Cita Creada
    Exitosamente!", marcaba al paciente como agendado y silenciaba al vigilante para él.
  - La toma de muestras se agenda DESPUÉS de confirmar la cita principal y una sola vez.
  - Se retiran los valores CABLEADOS del laboratorio: el teléfono 3022813246 (destinatario
    de TODOS los SMS y teléfono de TODOS los pacientes), el agendaId 282531 y la hora
    07:00:00. Y se elimina el "cupo por defecto", que citaba en silencio en el primer
    turno del día cuando la hora elegida ya no estaba libre.
  - Las agendas se filtran por la FECHA elegida (la respuesta mezcla hasta 7 días) y el
    turno muestra siempre profesional, fecha y sede.
  - Sin nombre de médico cableado: si no se identifica la agenda propia se avisa.
  - El médico activo se toma solo de servicios fiables: varios endpoints usan
    "UsuarioId" para el id del PACIENTE.
  - Órdenes PyM: sin coincidencia con la base salen DESMARCADAS (antes las 10 venían
    premarcadas: mamografía y citología a hombres, PSA a mujeres) y se advierte el choque
    de sexo. Un CIE-10 o un CUPS no resuelto ya no se sustituye por el primero de la lista.
  - Laboratorios: la fecha de toma ya no se rellena con la de HOY, los analitos PENDIENTES
    dejan de escribirse como resultados y la casilla del RAC usa el identificador real.
  - Retirados los dos prompt() que permitían teclear una cédula o un idSolicitud a mano y
    volcar los resultados de otro paciente en la historia clínica abierta.

  ESTABILIDAD
  - Ninguna ESCRITURA se reintenta: el motor de red repetía los POST hasta 8 veces (ocho
    citas u ocho órdenes idénticas).
  - Corregido un bucle infinito de recarga en el chequeo de versión.
  - localStorage.clear() ya no borra la bitácora de auditoría de fraudes e inasistencias,
    los contadores, los ajustes ni el registro anti-duplicados del día.

  PRIVACIDAD
  - El mapa de cédulas con PyM pendiente deja de publicarse en window.state.
  - Retirada la telemetría a un endpoint que era un marcador de posición.

  PENDIENTE (a propósito, por falta de evidencia)
  - ProgramaId en AsignarTurno y BuscarCitasDisponibles: la app oficial los envía y el
    script no. Cambiarlos con una sola captura es más peligroso que el defecto.
  - (RESUELTO en v12.3.0) El contrato del módulo de órdenes PyM ya está verificado.

  v7.9.0 — AGENDAMIENTO EXPRÉS DE CONTROL Y PyM EN 1-CLIC DESDE EL PANEL
  Agendamiento inteligente de citas de control directamente desde el panel del Vigilante
  conectado con APIAcceso (https://neps.everestintelligent.com/apiviva/APIAcceso/api/...).
  - Detección automática del médico en sesión (UsuarioId / UsuarioNombreCompleto).
  - Cálculo automático de fecha de control (1m, 2m, 3m, 6m, 15d) con ajuste a día hábil
    inmediatamente anterior si la fecha calculada cae en fin de semana.
  - Búsqueda directa de agendas disponibles filtradas por el médico activo.
  - Despliegue de turnos/horas disponibles en 1-clic (6:00 AM, 6:20 AM...).
  - Confirmación con marca PyM y campo de observación -> Creación vía API AsignarTurno.
  - Configuración toggleable en Ajustes (agendamientoRapido: true/false).

  v7.8.4 — ETIQUETAS DE LA BASE PILOTO ("Último VIH" / "Última SOMF"): confirmado con
  captura real de la hoja "CONSULTA" de la base piloto que esas dos columnas son las
  MISMAS actividades que ya se traducen en el PyM diario ("Aplica para VIH (Tamizacion
  anual)" y "SOMF (Tamizacion de cancer de colon)"), solo que la base piloto usa un
  nombre de columna distinto. Se agregaron ambos encabezados (con/sin tilde) al
  diccionario FRIENDLY para que salgan igual de claros que en el PyM real de hoy.

  v7.8.3 — ACCESO AUTOMÁTICO A SHAREPOINT SIN LOGIN MANUAL (pedido explícito: varios PCs,
  sin credenciales de administrador de Microsoft 365 disponibles para automatizar por
  Azure AD/Graph API). Se usa el enlace de "Compartir" que SharePoint ya genera para la
  carpeta del PyM (CONFIG.SP.shareLink): visitarlo le da al navegador acceso de lectura
  a esa carpeta sin que nadie escriba usuario/contraseña. El script "recarga" ese enlace
  solo (primeShareAccess) cada ~25 min y, si el listado falla (401/403), reintenta una
  vez forzando la recarga antes de avisar que la sesión pudo vencer. El botón manual
  «Abrir SharePoint» de Ajustes sigue existiendo como respaldo si el enlace compartido
  llegara a caducar o a revocarse. NINGUNA credencial viaja en el script ni en el Gist.

  v7.8.0 — RENDIMIENTO DE FONDO PARA EQUIPOS LENTOS (medido con réplicas reales, no estimado)
  El congelamiento de pestañas al cargar venía de la tubería del PyM, que corría entera
  en el hilo de la página. Banco de pruebas con una réplica exacta de la base piloto
  (13,7 MB, 90.000 filas, mismo esquema de columnas del Agenda_Dia_CMB real):
    ANTES: peor bloqueo único 2,8 s · 6,0 s totales bloqueados · pico 511 MB de RAM ·
           caché de 10,8 MB (a 1 MB del tope de 12 MB que la descartaba EN SILENCIO y
           obligaba a re-descargar los ~14 MB en CADA recarga, todo el día).
    AHORA: peor bloqueo 0,16 s · 0,4 s totales · pico 244 MB · caché de 2,8 MB.
    (En un PC de consultorio, multiplicar por 4-8: de ~20-40 s congelado a nunca >1 s.)
  Cómo:
  - STREAMING + FUSIÓN: la hoja se descomprime por trozos y cada fila se indexa y se
    descarta al vuelo. Nunca existen ni el string de 110 MB de XML ni el arreglo de
    90.000 filas. sharedStrings también va en streaming. (readPymWorkbookStream)
  - PRESUPUESTO DE TIEMPO: se cede el hilo cada ~15 ms MEDIDOS (MessageChannel, sin el
    clamp de 4 ms de setTimeout), no cada N filas: en un equipo lento cede más seguido
    él solo. Aplica a parseo, indexado, caché y desempaquetado. (makeYielder)
  - CACHÉ COMPACTA v3 con diccionario de etiquetas (~4x más pequeña: 2,8 MB vs 10,8).
    Adiós al acantilado silencioso de los 12 MB; si algún día se superara, AVISA.
  - BOOT DIFERIDO: cada pestaña ya no parsea la caché en plena carga de la página;
    se desempaqueta por tandas cuando el navegador está libre (requestIdleCallback).
  - CONEXIÓN SHAREPOINT REPARADA: al vencerse la sesión, SharePoint redirige a
    login.microsoftonline.com / *.svc.ms, dominios que NO estaban en @connect —
    Tampermonkey cortaba ahí y salía el mensaje engañoso "no dejó salir la conexión".
    Se añadieron los dominios, el diagnóstico ahora lo dice claro, y hay botón
    «Abrir SharePoint» en Ajustes para reactivar la sesión y que el captador de esa
    pestaña haga el resto solo. Verificación de equivalencia: el nuevo lector produce
    EXACTAMENTE el mismo resultado que el anterior en todos los casos de prueba
    (multi-hoja, encabezado en fila 4+, inlineStr, ceros a la izquierda, exclusiones).

  v7.4.0 — AUDITORÍA UI/UX (equipo de 6 lentes: contraste/daltonismo, jerarquía visual,
  interacción/teclado, ergonomía clínica, rendimiento en equipos lentos, consistencia de
  sistema) + reparación de lo seguro y de mayor consenso:
  - Contraste WCAG AA recalculado en badges, cuenta regresiva morada/ámbar, botones
    on/off, contador de fraudes y --fg3 (antes fallaba 4.5:1 en varios, sobre todo claro).
  - Tarjeta de fraude ahora dice "⛔ Atención extemporánea" en texto (no solo tinte de fondo); el mismo
    refuerzo de tarjeta se extendió a MORADO (última llamada) y AMBAR (inasistencia).
  - Foco de teclado visible en TODOS los controles (antes solo el buscador lo tenía).
  - blur reducido de 30px a 14px en el panel/dock, RETIRADO de los toasts y del modal de
    fraude (pasan a fondo sólido) — menos costo de GPU en los equipos lentos que motivaron
    este proyecto. El modal de fraude además dejó de ignorar el tema claro/oscuro.
  - Panel responsive (max-width + @media) para ventanas angostas; nombre de paciente con
    tooltip completo y ya no se traga la cédula; cuenta regresiva en palabra ("en"/"hace")
    en vez de signo +/−; "no aparece en la base" deja de usar el color de una alerta real.
  Detalle completo y backlog de propuestas no aplicadas: ver conversación / memoria.

  v7.6.0 — RECORDATORIO DE PyM AL ABRIR LA HISTORIA CLÍNICA
  Al abrir la historia clínica de un paciente con PyM pendiente, sale UNA vez al día
  (por paciente) un aviso calmado — estilo propio en teal, NO el rojo de fraude — que
  hay que cerrar a mano, recordando qué actividades ordenar. Detección: confirmado con
  diagnóstico real en Everest que la pestaña #anamesis solo existe en esa vista, y que
  la cédula vive en un .text-muted del bloque de datos del paciente (mismo patrón de
  clase que "Citas del día" — reutiliza extractDoc()). Sin nombre raspado del DOM: se
  cruza la cédula contra la agenda que el Vigilante ya tiene cargada. Toggle en Ajustes
  (activado por defecto) + botón "Probar" para verlo sin esperar un paciente real.

  v7.5.0 — SEGUNDA TANDA (backlog de la auditoría + seguridad + auto-update)
  - COLA DE AVISOS CON PRIORIDAD REAL: ROJO/MORADO van al frente y nunca se autodescartan;
    AZUL/VERDE/AMBAR se cierran solos a los 9 s. Al recortar por exceso (máx. 4 visibles)
    se quita primero el más viejo que NO sea crítico. Antes un aviso MORADO podía quedar
    tapado detrás de avisos rutinarios sin cerrar — probado en vivo con 6 avisos mezclados.
  - Confirmación antes de "Restablecer todo" en Ajustes (antes un clic borraba todo sin
    preguntar). Recordatorio (máx. 1 vez/mes) si pasan 60+ días sin ver una versión nueva
    — pista de que el auto-update pudo quedar roto, sin ser una alarma falsa.
  - Blur apagado durante el arrastre del panel (arrastre más fluido en GPU vieja) y nuevo
    toggle "Modo rendimiento" en Ajustes que lo apaga del todo.
  - Tokens de los 5 colores de alerta (--c-rojo/morado/ambar/verde/azul) y de los 3 radios
    de superficie (--r-chip/card/surface): antes cada valor se repetía como literal en
    8-11 sitios distintos de la hoja de estilos.
  - v7.4.2 trajo el aviso "✅ Vigilante actualizado" (una vez, al detectar que Tampermonkey
    instaló una versión nueva del Gist) y activó el auto-update de verdad.

  v7.3.5 — MODO LIGERO
  Diseñado para equipos lentos: nada corre en segundo plano salvo lo imprescindible.
  - VIGILANCIA: vía directa del API de Everest (unos kB por consulta, con la sesión
    ya abierta; sigue vigilando aunque la pestaña esté en una historia clínica). La
    llamada se aprende con el registro de rendimiento del navegador (PerformanceObserver;
    no se intercepta ni se clona nada). Respaldo: se lee la página que está delante.
  - PyM: la base de la sede se baja UNA vez al día por su identificador de SharePoint
    (o se captura sola al abrir la base en SharePoint); «Abrir PyM» para carga manual.
  - AVISOS: un solo canal a la vez con escalamiento (Windows → aviso en la página),
    identificador por evento para no repetir jamás, y solo el FRAUDE es persistente.
  - Sin clon de fondo ni ganchos de red: ese código se ELIMINÓ por completo (no es
    que esté apagado: ya no existe).
  - REPORTE MÍNIMO al tablero (Hoja de Google, v7.3.6): SOLO el resumen del día
    anterior (1 fila/día) y los fraudes en vivo (hora + minutos, sin cédula ni
    nombre, tope 20/día). Nada de pings, errores ni diagnósticos automáticos.
  PRIVACIDAD: ningún dato de pacientes sale del navegador. Conexiones externas:
  la DESCARGA de la base (SharePoint de la IPS) y las filas mínimas del tablero.
*/

(function () {
  "use strict";
  if (window.top !== window.self) return; // nunca correr dentro de un frame

  // --- MÓDULO ATHENEA SOLUCIONES (AUTOLOGIN & AUTOBÚSQUEDA EN 1-CLIC) ---
  if (location.hostname.includes("atheneasoluciones.com")) {
    window.addEventListener("DOMContentLoaded", () => {
      // 1. Auto-login si estamos en la pantalla de inicio de sesión
      const userInput = document.querySelector("#Username") || document.querySelector("input[name='Username']");
      const passInput = document.querySelector("#Password") || document.querySelector("input[name='Password']");
      const loginBtn = document.querySelector("button[type='submit']") || document.querySelector("input[type='submit']");

      // v14.1.1 — CREDENCIAL RETIRADA DEL CÓDIGO. Hasta esta versión había un usuario y
      // una contraseña de Athenea EN CLARO aquí como "respaldo heredado", con un aviso al
      // lado que decía "ROTARLA" y que llevaba versiones sin atenderse.
      //
      // Por qué se retira ahora y no "algún día": el repositorio se va a compartir con
      // agentes externos (Jules clona el repo entero en una VM de Google CON internet;
      // pegar el archivo en un modelo lo sube a otro servicio). Una credencial en el
      // código deja de ser un riesgo teórico en el momento en que el archivo sale del
      // equipo — y este archivo, además, se distribuye por URL a cada instalación.
      //
      // Ahora las credenciales SOLO viven en el almacén local de Tampermonkey, que no sale
      // del computador. Si no están fijadas, el autologin sencillamente no ocurre y el
      // médico entra a mano, como haría igual: NO se degrada a una credencial de fábrica.
      // Para fijarlas una vez por equipo, desde la consola de Tampermonkey:
      //   GM_setValue("vgl_ath_user", "USUARIO"); GM_setValue("vgl_ath_pass", "CLAVE");
      //
      // ⚠ RETIRARLA DEL CÓDIGO NO LA DESACTIVA: la contraseña que estuvo publicada sigue
      // siendo válida en Athenea y permanece en el historial de git. Hay que ROTARLA en
      // Athenea, y solo entonces fijar la nueva por GM_setValue.
      let athUser = "", athPass = "";
      try {
        if (typeof GM_getValue !== "undefined") {
          athUser = GM_getValue("vgl_ath_user", "") || "";
          athPass = GM_getValue("vgl_ath_pass", "") || "";
        }
      } catch (e) {}

      if (userInput && passInput && loginBtn && !userInput.value && athUser && athPass) {
        userInput.value = athUser;
        passInput.value = athPass;
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => loginBtn.click(), 300);
        return;
      }

      // 2. Autobúsqueda por documento si venimos redirigidos desde el Vigilante (#doc=123456)
      const hash = location.hash || "";
      const searchMatch = hash.match(/#doc=(\d+)/) || location.search.match(/[?&]doc=(\d+)/);
      if (searchMatch) {
        const docToSearch = searchMatch[1];
        const docInput = document.querySelector("#NumeroIdentificacion") ||
                         document.querySelector("input[name='NumeroIdentificacion']") ||
                         document.querySelector("#Documento") ||
                         document.querySelector("input[type='search']") ||
                         document.querySelector("input.form-control");

        if (docInput) {
          docInput.value = docToSearch;
          docInput.dispatchEvent(new Event('input', { bubbles: true }));
          const searchBtn = document.querySelector("button[type='submit']") ||
                            document.querySelector("#btnBuscar") ||
                            document.querySelector(".btn-primary");
          if (searchBtn) setTimeout(() => searchBtn.click(), 400);
        }
      }
    });
    return; // No ejecutar la lógica de Everest en la web de Athenea
  }
  // v12.5.1 — La versión sale del PROPIO encabezado vía Tampermonkey (GM_info): la
  // const manual llevaba TRES versiones sin subirse ("12.3.37") y toda fila del tablero
  // y el log de arranque mentían la versión. El literal queda solo de respaldo para
  // entornos sin GM_info (el banco de pruebas) — y ahora hay una prueba que lo compara
  // contra el @version del encabezado para que no vuelva a quedarse atrás.
  const VERSION = (typeof GM_info !== "undefined" && GM_info && GM_info.script && GM_info.script.version) || "14.1.9";

  // =====================================================================
  //  BLACK-BOX FLIGHT RECORDER & TELEMETRY ENGINE (v11.0 TELEMETRY)
  //  Registra silenciosamente eventos, llamadas API, extracciones de CC,
  //  auto-llenado de laboratorios y errores para depuración en vivo.
  // =====================================================================
  const FLIGHT_RECORDER_KEY = "vgl_flight_recorder_logs";
  const MAX_LOG_ENTRIES = 500;
  // v12.3.13 — Cuota de almacenamiento llena (QuotaExceededError): se avisa por
  // console.warn UNA sola vez por sesión, no en cada escritura fallida.
  let quotaAvisada = false;

  function vglLog(category, action, details) {
    try {
      const safeDetails = {};
      if (details) {
        for (const k in details) {
          const val = details[k];
          safeDetails[k] = (typeof val === "string") ? sanitizePII(val) : (typeof val === "number" && val > 99999 ? sanitizePII(String(val)) : val);
        }
      }
      const entry = {
        ts: new Date().toISOString(),
        cat: category, // 'NAV' | 'PATIENT' | 'ATHENEA' | 'APPCITA' | 'ORDEN' | 'ERROR' | 'PERF'
        act: action,
        det: safeDetails || {}
      };

      console.log(`[VglFlightRecorder] [${entry.cat}] ${entry.act}`, entry.det);

      let logs = [];
      try {
        const raw = localStorage.getItem(FLIGHT_RECORDER_KEY);
        logs = raw ? JSON.parse(raw) : [];
      } catch (e) { logs = []; }

      logs.push(entry);
      if (logs.length > MAX_LOG_ENTRIES) logs = logs.slice(-MAX_LOG_ENTRIES);
      try {
        localStorage.setItem(FLIGHT_RECORDER_KEY, JSON.stringify(logs));
      } catch (eq) {
        // Cuota llena (QuotaExceededError / code 22 / lo que sea que lance setItem):
        // el tope circular de 500 ya limita el tamaño, así que aquí solo se recorta
        // el búfer al 60% más reciente y se reintenta UNA vez. Si vuelve a fallar,
        // se pierde esta entrada pero el flujo jamás se rompe.
        try { localStorage.setItem(FLIGHT_RECORDER_KEY, JSON.stringify(logs.slice(-Math.floor(MAX_LOG_ENTRIES * 0.6)))); } catch (e2) {}
      }
    } catch (e) {}
  }

  function vglExportLogs() {
    try {
      const raw = localStorage.getItem(FLIGHT_RECORDER_KEY);
      const logs = raw ? JSON.parse(raw) : [];
      const report = {
        meta: {
          version: VERSION,
          exportedAt: new Date().toISOString(),
          totalEntries: logs.length,
          userAgent: navigator.userAgent,
          url: location.href
        },
        logs: logs
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `BITACORA_VIGILANTE_REAL_${todayStamp()}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      alert("✅ Bitácora de Telemetría descargada exitosamente. Envía este archivo para depurar con datos reales.");
    } catch (e) { alert("❌ No se pudo exportar la bitácora de telemetría en este momento. Inténtelo nuevamente."); }
  }

  // Interceptores Globales de Errores y Excepciones
  window.addEventListener("error", (e) => {
    // v12.3.27 — "ResizeObserver loop completed with undelivered notifications." es
    // ruido de navegador conocido (Angular/Google Charts de la propia página de
    // Everest, no del Vigilante) sin ningún valor para depurar. Confirmado con una
    // bitácora real de 22 h: llenó 32 de las 500 entradas (6.4%) con esto solo,
    // compitiendo por espacio con los eventos que sí hacen falta.
    if (String(e.message || "").includes("ResizeObserver loop")) return;
    vglLog("ERROR", "UncaughtException", { msg: e.message, src: e.filename, line: e.lineno, col: e.colno });
  });

  window.addEventListener("unhandledrejection", (e) => {
    vglLog("ERROR", "UnhandledPromiseRejection", { reason: String(e.reason) });
  });

  // Observador de Navegación y Secciones Everest
  let lastObservedUrl = "";
  setInterval(() => {
    if (location.href !== lastObservedUrl) {
      const oldUrl = lastObservedUrl;
      lastObservedUrl = location.href;
      vglLog("NAV", "UrlChanged", { from: oldUrl, to: lastObservedUrl, section: seccionActiva() });
    }
  }, 1000);
 // fuente única de la versión (título + diagnóstico)

  // fetch ORIGINAL, guardado en document-start (antes de que Angular y el propio
  // Vigilante envuelvan el de la página). Las consultas al API van por aquí: así no
  // pasan por ningún envoltorio ajeno ni por el registro de red del propio script,
  // que clonaría cada respuesta y gastaría memoria en cada sondeo.
  const FETCH0 = (function () {
    try { const f = window.fetch; if (typeof f !== "function") return null; return (u, o) => f.call(window, u, o); } catch (e) { return null; }
  })();

  // v12.0.0 (del otro linaje) — HOTFIX DIGITURNO: el nombre del paciente viaja en la URL
  // de LlamadoPorMedicoManual y, si lleva espacios, la petición se rompe. Se recodifica al
  // vuelo. El enganche está ACOTADO al host de digiturno y a esa única llamada: no toca la
  // red de Everest ni la de ningún otro sitio.
  // endsWith y no includes: con includes, un host como "digiturno.viva1a.com.co.otro.com"
  // también habría activado el parche. Y el replace va en try/catch porque este código se
  // interpone en TODAS las peticiones del host: si lanzara, rompería la aplicación entera.
  if (location.hostname === "digiturno.viva1a.com.co" || location.hostname.endsWith(".digiturno.viva1a.com.co")) {
    const originalOpenXhr = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      try {
        if (url && typeof url === "string" && url.includes("LlamadoPorMedicoManual") && url.includes("NombreUsuario=")) {
          url = url.replace(/NombreUsuario=([^&]+)/, function (match, namePart) {
            return "NombreUsuario=" + encodeURIComponent(decodeURIComponent(namePart));
          });
        }
      } catch (e) { /* si la URL no es decodificable se deja intacta */ }
      return originalOpenXhr.apply(this, [method, url, ...rest]);
    };
  }

  // =====================================================================
  //  MÓDULO: EXTRACCIÓN E INYECCIÓN DE LABORATORIOS EN RUTA CRÓNICOS
  //  Lista estricta autorizada (13 analitos):
  //  1. Colesterol Total  2. Colesterol HDL  3. Colesterol LDL  4. Triglicéridos
  //  5. Uroanálisis       6. Glucosa en Suero 7. Creatinina en Suero 8. RAC
  //  9. HbA1c            10. PTH            11. Fósforo en Suero   12. Albúmina en Suero
  //  13. Hemoglobina
  // =====================================================================

  const WHITELIST_13_LABS = [
    { key: "COLESTEROL_TOTAL", names: ["COLESTEROL TOTAL"], codes: ["2009", "903818"], resultId: "resultadoColesterolTotal", dateId: "fechaResultColesterolTotal" },
    { key: "COLESTEROL_HDL", names: ["COLESTEROL HDL", "COLESTEROL DE ALTA DENSIDAD"], codes: ["2015", "903815"], resultId: "resultadoColesterolHDL", dateId: "fechaResultColesterolHDL" },
    { key: "COLESTEROL_LDL", names: ["COLESTEROL LDL", "COLESTEROL DE BAJA DENSIDAD"], codes: ["2014", "903817", "903816"], resultId: "resultadoColesterolLDL", dateId: "fechaResultColesterolLDL" },
    // v12.0.5 — CORREGIDO con el CUPS real capturado en el consultorio: los triglicéridos
    // son 903868 (payload de Everest: {"codigo":"903868","descripcion":"TRIGLICERIDOS"}).
    // Aquí figuraba 903866, que no corresponde a nada, mientras que 903868 estaba asignado
    // por error al RAC. Como el emparejamiento por CÓDIGO manda sobre el nombre, un
    // resultado de TRIGLICÉRIDOS se escribía en la casilla de la relación
    // albuminuria/creatinina: dos analitos distintos, con rangos distintos.
    // v12.6.0 — auditoría cruzada con el Copiloto (RCV): el CUPS 903866 no es
    // Triglicéridos, es TGP/ALT (Alanina Aminotransferasa) — un resultado de función
    // hepática que caía por error en esta casilla. Se retira; 903868 (el CUPS real de
    // Triglicéridos, confirmado en consultorio, ver v12.0.5 arriba) queda como único
    // código adicional al genérico 2074.
    { key: "TRIGLICERIDOS", names: ["TRIGLICERIDOS", "TRIGLICÉRIDOS"], codes: ["2074", "903868"], resultId: "resultadoTrigliceridos", dateId: "fechaResultTrigliceridos" },
    // v12.0.4 — VERIFICADO: en la Ruta de Crónicos NO hay casilla de texto para el
    // uroanálisis. Lo que existe es `resultadoPrograma.swUroanalisis`, un par de botones
    // de opción (sí/no), donde no cabe un resultado escrito. Se deja la entrada para que
    // el analito se CUENTE y se avise ("Sin casilla en esta vista: UROANALISIS") en vez de
    // desaparecer en silencio.
    // v12.5.11 — el par SI/NO en sí YA se automatiza (ver _marcarUroanalisisSi, disparado
    // desde injectLabsIntoCronicos): con un componente real del parcial de orina, se marca
    // SI solo. Los 7 resultados detallados (Nitritos, Sangre, etc.) ya se auto-completaban
    // desde v12.3.37 vía UROANALISIS_COMPONENTES/_findUroInput — esto no cambia esa parte,
    // solo agrega el interruptor SI que faltaba antes de esas casillas.
    // v12.5.12 — resultId/dateId de ESTA entrada (resultadoUroanalisis/
    // fechaResultUroanalisis) SÍ existen en el DOM real, confirmado con HTML pegado en
    // consultorio — el "no hay casilla" de v12.0.4 pasaba porque Angular la monta con
    // *ngIf solo cuando el SI de arriba ya está marcado. Con el SI ya automatizado, este
    // camino genérico la encuentra solo casi siempre (y hay un reintento corto para
    // cuando Angular tarda, ver el final de injectLabsIntoCronicos).
    { key: "UROANALISIS", names: ["UROANALISIS", "PARCIAL DE ORINA"], codes: ["2095", "907106"], resultId: "resultadoUroanalisis", dateId: "fechaResultUroanalisis" },
    { key: "GLUCOSA", names: ["GLUCOSA EN SUERO", "GLICEMIA", "GLICEMIA BASAL"], codes: ["2013", "903841"], resultId: "resultadoGlicemia", dateId: "fechaResultGlicemia" },
    // v12.0.5 — CONFIRMADO EN EL CONSULTORIO (10/08/2026), leyendo la etiqueta que
    // acompaña a cada casilla en la Ruta de Crónicos:
    //     resultadoRelacionAlbuminaCreatinina  -> "Relación albuminuria/Creatinina en orina (mg/g)"   <-- ESTA
    //     resultadoMicroAlbuminuriaCreatinuria -> "Microalbuminuria/Creatinuria"
    // El médico registra la relación en la PRIMERA, que es la que usa el script. Con el
    // nombre anterior ("resultadoRAC", que no existe en el DOM) esa casilla no se llenaba
    // nunca. Se conserva el nombre viejo como alternativa por si otra vista lo usa.
    // NO cambiar a resultadoMicroAlbuminuriaCreatinuria: es otra casilla distinta.
    // Se quitan además los códigos 2092/2080 y los alias sueltos "MICROALBUMINURIA"/"RAC",
    // que capturaban analitos que no son la relación.
    { key: "RAC", names: ["RELACION MICROALBUMINURIA CREATININA", "RELACION ALBUMINA/CREATININA", "RELACIÓN ALBÚMINA/CREATININA"], codes: ["8779"], resultId: "resultadoRelacionAlbuminaCreatinina", altIds: ["resultadoRAC"], dateId: "fechaResultRelacionAlbuminaCreatinina", altDateIds: ["fechaResultRAC"] },
    // v11.0.1 — "CREATININA" a secas casaba también con la creatinina en ORINA, la
    // creatinuria y la depuración de 24 h, que sobrescribían la creatinina sérica.
    { key: "CREATININA", names: ["CREATININA EN SUERO", "CREATININA"], excluye: ["ORINA", "CREATINURIA", "DEPURAC", "24 H"], codes: ["2028", "903895"], resultId: "resultadoCreatinina", dateId: "fechaResultCreatinina" },
    // v12.0.4 — VERIFICADO: en la Ruta de Crónicos NO existe ninguna casilla de HbA1c
    // (se listaron los 64 campos de resultado de esa vista y no aparece). El nombre
    // "resultadoHBA1C" era una suposición que nunca se cumplió. Se conserva la entrada
    // para que el analito se avise como pendiente de escribir a mano, no para escribirlo.
    { key: "HBA1C", names: ["HBA1C", "HEMOGLOBINA GLICOSILADA", "HEMOGLOBINA GLICADA"], codes: ["2035", "903843"], resultId: "resultadoHBA1C", dateId: "fechaResultHBA1C" },
    { key: "PTH", names: ["PTH", "HORMONA PARATIROIDEA", "PARATOHORMONA"], codes: ["2065", "904921"], resultId: "resultadoPTH", dateId: "fechaResultPTH" },
    // v14.0.0 — Athenea entrega este analito como "FOSFORO INORGANICO (FOSFATOS)" (reporte
    // del médico en consultorio), no como "FOSFORO EN SUERO": sin ese nombre en la lista,
    // Auto-Labs nunca lo casaba y la casilla quedaba vacía. Se agrega el nombre real; los
    // dos anteriores se conservan por si otra vista o laboratorio lo rotula distinto.
    { key: "FOSFORO", names: ["FOSFORO EN SUERO", "FÓSFORO EN SUERO", "FOSFORO INORGANICO"], codes: ["2031", "903837"], resultId: "resultadoFosforo", dateId: "fechaResultFosforo" },
    { key: "ALBUMINA", names: ["ALBUMINA EN SUERO", "ALBÚMINA EN SUERO"], codes: ["2002", "903801"], resultId: "resultadoAlbumina", dateId: "fechaResultAlbumina" },
    { key: "HEMOGLOBINA", names: ["HEMOGLOBINA"], codes: ["2034", "902207"], resultId: "resultadoHemoglobina", dateId: "fechaResultHemoglobina" }
  ];

  // v14.0.2 — CUPS DE ESCRITURA (ordenamiento) para HbA1c/PTH/Fósforo/Albúmina, confirmados
  // vía diagnóstico cruzado Copiloto↔Vigilante (`teamwork_projects/sync_copiloto_vigilante/
  // MATRIZ_DIVERGENCIAS.md` en el repo del Copiloto, sección "brecha de capacidad de orden"),
  // que a su vez toma el catálogo `NAME_TO_CUPS`/`CUPS_EMBEBIDOS` del Copiloto — ya en
  // producción para ORDENAR (no solo leer) estos 4 analitos, y probado en
  // `tests/test_catalogos_embebidos.py` de ese repo.
  //
  // OJO: estos códigos NO son los mismos que WHITELIST_13_LABS de arriba — esos son de
  // LECTURA (reconocer un resultado que ya llegó de Athenea), estos son de ESCRITURA
  // (pedir el examen). Para PTH/Fósforo/Albúmina difieren entre sí; para Hemoglobina
  // coinciden en la práctica (902213 en ambos catálogos de escritura — 902207 de
  // WHITELIST_13_LABS es solo lectura, se incluye aquí solo por completitud/referencia).
  //
  // v14.0.4 — CORREGIDO: HbA1c NO es 904426. Ese era el código corto del Copiloto
  // ("HEMOGLOBINA GLICOSILADA", sin más) — pero este mismo archivo YA tiene, más abajo en
  // `PYM_CATALOG` (paquete I10X "RCV EXPRÉS", línea ~11545), el código `903426`
  // "Hemoglobina Glicosilada AUTOMATIZADA", tomado de una orden REAL ya guardada en Everest
  // (`ObtenerOrdenamientoPorPacienteIdVigente`, ver `EVIDENCIA_ORDENAMIENTO_CURADO.md` §2) —
  // la fuente más confiable que existe (una orden real, no una intención), y EXACTAMENTE el
  // mismo patrón semi/automatizado ya visto dos veces en este proyecto (LDL 903816/903817,
  // Microalbuminuria 903028/903026): el 904426 del Copiloto es probablemente su variante
  // SEMI/genérica, y este médico ordena la AUTOMATIZADA. El texto capturado en consultorio
  // para el <li> ("HEMOGLOBINA GLICOSILADA AUTOMATIZADA", ver CONDUCTA_LI_TEXTO_POR_ANALITO
  // abajo) confirma que 903426 es el que corresponde a ese texto, no 904426. Se usa 903426
  // — la evidencia PROPIA y más fuerte gana sobre la del otro repo.
  //
  //   Analito     | lectura (arriba) | escritura (aquí) |
  //   PTH         | 904921           | 903890            |
  //   Fósforo     | 903837           | 903885            |
  //   Albúmina    | 903801           | 903803            |
  //   Hemoglobina | 902207           | 902213 (= lectura de facto, no divergen)  |
  //   HbA1c       | 903843           | 903426 (YA vigente en PYM_CATALOG/I10X)    |
  //
  // NO están conectados a ningún botón todavía (salvo HbA1c, que ya vive en el paquete
  // I10X desde antes de este bloque): el propio médico resolvió el 2026-08-11
  // (`DECISIONES_PENDIENTES.md`, P4) que Vigilante solo debe ORDENAR PTH/Fósforo/Albúmina/
  // Hemoglobina cuando el estadio ERC del paciente esté confirmado y la tabla de vigencias
  // diga que corresponde — "si el script todavía no conoce el estadio del paciente, se
  // omiten por ahora, no se piden a ciegas". Esa condición depende de que Vigilante se
  // vuelva consciente del estadio renal (P6), todavía sin implementar. Este bloque solo
  // deja los códigos correctos y ya verificados listos para cuando esa pieza exista — no
  // se adivina nada nuevo, y no se ordena nada nuevo con este cambio.
  const CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO = {
    HBA1C: "903426",
    PTH: "903890",
    FOSFORO: "903885",
    ALBUMINA: "903803",
    HEMOGLOBINA: "902213",
  };

  // v14.0.3 — Nombre EXACTO con el que cada analito aparece como <li> en el buscador nativo
  // de Conducta de Everest (Paquetes → HTA → agregar examen individual). NO son inventados
  // ni tomados del catálogo del Copiloto (esos son descripciones cortas, p. ej. "HEMOGLOBINA
  // GLICOSILADA" sin "AUTOMATIZADA") — son el texto LITERAL capturado por el grabador de
  // clics del proyecto en consultorio el 12-08-2026 (`captura_ordenamiento_paquete_
  // HTA_20260812.json`, ver también `EVIDENCIA_ORDENAMIENTO_CURADO.md` §2 y §4), en la
  // MISMA sesión donde el médico agregó estos 4 uno por uno además del paquete HTA:
  //   li "HORMONA PARATIROIDEA MOLÉCULA INTACTA" → Agregar   (PTH)
  //   li "ALBUMINA EN SUERO U OTROS FLUIDOS"     → Agregar   (Albúmina)
  //   li "FÓSFORO EN SUERO U OTROS FLUIDOS"      → Agregar   (Fósforo)
  //   li "HEMOGLOBINA"                            → Agregar   (Hemoglobina)
  //   li "HEMOGLOBINA GLICOSILADA AUTOMATIZADA"  → Agregar   (HbA1c)
  // Usados por _conductaBuscarYAgregarExamen (más abajo), que reproduce EXACTAMENTE esa
  // misma secuencia de clics. Coincidencia exacta de texto (normalizado con _canonTexto),
  // nunca substring: un match parcial en un catálogo clínico real podría clickear el examen
  // equivocado, algo que aquí es inaceptable.
  const CONDUCTA_LI_TEXTO_POR_ANALITO = {
    PTH: "HORMONA PARATIROIDEA MOLECULA INTACTA",
    ALBUMINA: "ALBUMINA EN SUERO U OTROS FLUIDOS",
    FOSFORO: "FOSFORO EN SUERO U OTROS FLUIDOS",
    HEMOGLOBINA: "HEMOGLOBINA",
    HBA1C: "HEMOGLOBINA GLICOSILADA AUTOMATIZADA",
  };

  // v14.0.3 — Reproduce en el DOM real de Everest el mismo gesto que el médico ya hace a
  // mano en Conducta: clic en el <li> del examen (coincidencia EXACTA de texto, nunca
  // parcial) y, tras darle a Angular un instante para reaccionar, clic en el botón
  // "Agregar" que aparece. NO llama a ningún endpoint propio ni navega — solo dispara los
  // mismos eventos de clic que ya dispararía el médico, así que el guardado real ocurre
  // donde siempre ocurre: cuando él guarda el JSON completo de la historia.
  // Fallo seguro: si el <li> no aparece (no está en la pantalla actual, o el texto no casó
  // exacto) no se clickea nada por aproximación — "casilla vacía antes que clic inventado".
  async function _conductaBuscarYAgregarExamen(nombreLiExacto) {
    try {
      const claveObjetivo = _canonTexto(nombreLiExacto);
      const items = document.querySelectorAll("li");
      let li = null;
      for (const el of items) {
        if (_canonTexto(el.textContent) === claveObjetivo) { li = el; break; }
      }
      if (!li) return false;
      li.click();
      // v14.0.3 — Mismo motivo que el reintento de 300-600ms del uroanálisis (arriba):
      // Angular no monta el botón "Agregar" de forma síncrona con el clic. La ventana de
      // espera imita la cadencia real observada en la captura (~700-1500ms entre el clic
      // del <li> y el del botón en cada uno de los 5 exámenes agregados esa sesión).
      await new Promise((r) => setTimeout(r, 700));
      const botones = document.querySelectorAll("button");
      let btnAgregar = null;
      for (const b of botones) {
        if (_canonTexto(b.textContent) === "AGREGAR" && !b.disabled) { btnAgregar = b; break; }
      }
      if (!btnAgregar) return false;
      btnAgregar.click();
      return true;
    } catch (e) { console.warn("[Vigilante] _conductaBuscarYAgregarExamen falló:", e); return false; }
  }

  // v12.3.37 — SECCIÓN URONÁLISIS DE LA RUTA CRÓNICOS (pedido del consultorio, pantallazo
  // del 2026-08-11): además del interruptor NORMAL/ANORMAL, la vista tiene 7 casillas de
  // texto para los componentes del parcial de orina, todas con placeholder
  // "Resultado <Componente>" visible en pantalla. Ese placeholder es el ÚNICO ancla
  // confirmada del DOM (no hay ids capturados para estos campos), así que la búsqueda va
  // por placeholder normalizado (sin tildes, sin mayúsculas/minúsculas). Los nombres con
  // que Athenea entrega cada componente AÚN NO están confirmados en campo: los sinónimos
  // de abajo son candidatos razonables del LIS, y si ninguno casa la casilla queda VACÍA
  // (fallo seguro) mientras el diagnóstico de orina imprime el nombre real para añadirlo
  // aquí con evidencia, nunca por adivinanza.
  // El interruptor NORMAL/ANORMAL NO se automatiza todavía: es interpretación clínica y
  // no hay evidencia del control ni de la semántica de IdNormalidad — regla de la casa
  // (v11.0.1): ante la duda, se deja al médico, jamás se inventa.
  const UROANALISIS_COMPONENTES = [
    { key: "NITRITOS",    placeholder: "RESULTADO NITRITOS",    names: ["NITRITO"] },
    // Las exclusiones "24 H"/"HORAS"/"DEPURAC" replican el patrón de la entrada sérica de
    // CREATININA (incidente v11.0.1): la glucosuria/proteinuria DE 24 HORAS es un examen
    // CUANTITATIVO distinto (mg/24 h) que, por coincidencia de nombre, caería verbatim en
    // la casilla de la tira reactiva del parcial. Confirmado en revisión adversarial
    // ejecutando el flujo completo. "ALBUMINA" se retiró de los sinónimos de proteinuria:
    // "ALBUMINA EN ORINA" es el hijo cuantitativo del panel RAC (mg/L), no la tira; si el
    // LIS llama "ALBUMINA" a la proteína del parcial, el diagnóstico de orina lo mostrará
    // y se añadirá con evidencia.
    { key: "GLUCOSURIA",  placeholder: "RESULTADO GLUCOSURIA",  names: ["GLUCOSURIA", "GLUCOSA"], excluye: ["24 H", "HORAS", "DEPURAC"] },
    // "RELACION PROTEINA/CREATININA" y "MICROALBUMINURIA" son OTROS exámenes (cocientes),
    // no la proteína del parcial: sin la exclusión, su valor caería en esta casilla.
    { key: "PROTEINURIA", placeholder: "RESULTADO PROTEINURIA", names: ["PROTEINURIA", "PROTEINA"], excluye: ["RELACION", "CREATININ", "MICROALBUMIN", "24 H", "HORAS", "DEPURAC"] },
    { key: "CILINDROS",   placeholder: "RESULTADO CILINDROS",   names: ["CILINDRO"] },
    { key: "SANGRE",      placeholder: "RESULTADO SANGRE",      names: ["SANGRE", "HEMOGLOBINA"] },
    { key: "HEMATIES",    placeholder: "RESULTADO HEMATIES",    names: ["HEMATIE", "ERITROCITO"] },
    { key: "LEUCOCITOS",  placeholder: "RESULTADO LEUCOCITOS",  names: ["LEUCOCIT", "ESTERASA"] }
  ];

  // Normalización compartida para comparar nombres/placeholders: sin tildes, en
  // mayúsculas y con los espacios colapsados ("Resultado  Hematíes " → "RESULTADO HEMATIES").
  const _canonTexto = (s) => stripAccents(String(s || "")).toUpperCase().replace(/\s+/g, " ").trim();

  // v12.3.37 — ¿Este analito pertenece al panel de ORINA? Primero por su padre
  // (NombreParametroPadre, el campo con que Athenea agrupa los hijos de un panel);
  // como respaldo, por nombre propio SOLO cuando el nombre existe únicamente en orina.
  // Jamás por "LEUCOCITOS"/"HEMATIES"/"HEMOGLOBINA" a secas: esos también son del
  // hemograma EN SANGRE, y confundirlos escribiría sangre en las casillas de orina.
  function _esAnalitoDeOrina(lab) {
      const padre = _canonTexto(lab && (lab.NombreParametroPadre || lab.nombreParametroPadre));
      // "URINAR" cubre SEDIMENTO URINARIO / CITOQUIMICO URINARIO (revisión adversarial:
      // "URINARIO" no contiene la subcadena "ORINA" y esos padres se colaban al suero).
      if (/ORINA|URINAR|UROAN/.test(padre)) return true;
      const nombre = _canonTexto(lab && (lab.NombreParametro || lab.nombre || lab.examen));
      return /\bORINA\b/.test(nombre) || /GLUCOSURIA|PROTEINURIA|NITRITO|CILINDRO|ESTERASA LEUCOCITARIA/.test(nombre);
  }

  // v12.6.7 — ¿Athenea trajo al menos UN componente real del parcial de orina? Se
  // responde ANTES de tocar el DOM, mirando solo los datos. Hasta v12.6.6 esto se
  // averiguaba SOBRE LA MARCHA, mientras se intentaba escribir cada casilla, y por eso el
  // "SI" se marcaba DESPUÉS de haber buscado las 7 casillas: como Angular las monta con
  // *ngIf solo cuando "¿Uroanálisis?" está en SI, en la primera visita NINGUNA existía
  // todavía y todas se iban a "sin casilla" en silencio. Es exactamente lo que reportó el
  // médico con captura: el script marcaba SI y dejaba el bloque entero vacío.
  function _hayComponenteUroReal(labsArray) {
      if (!Array.isArray(labsArray)) return false;
      return labsArray.some((lab) => {
          if (!lab || !_esAnalitoDeOrina(lab) || !_matchUroComponente(lab)) return false;
          const v = lab.Resultado || lab.resultado || lab.valor;
          if (!v) return false;
          return !(Number(lab.idEstado) === 1 || String(v).trim().toUpperCase() === "PENDIENTE");
      });
  }

  function _matchUroComponente(lab) {
      const nombre = _canonTexto(lab && (lab.NombreParametro || lab.nombre || lab.examen));
      if (!nombre) return null;
      for (const comp of UROANALISIS_COMPONENTES) {
          if (comp.excluye && comp.excluye.some((x) => nombre.includes(x))) continue;
          if (comp.names.some((n) => nombre.includes(n))) return comp;
      }
      return null;
  }

  // v12.5.16 — AGRUPAR LOS COMPONENTES DEL UROANÁLISIS EN UN SOLO BLOQUE (modal de
  // Laboratorios, openLaboratoriosModal). Reportado en consultorio con el PDF real del
  // laboratorio: un solo examen "Uroanálisis" con ~28 parámetros (Color, Glucosa,
  // Nitritos, Sangre...) se mostraba en esta tabla como si cada parámetro fuera un
  // examen INDEPENDIENTE — cada uno con su propia fila, su propia fuente y su propio
  // botón de informe — sin nada que marcara visualmente que eran UN solo resultado de
  // UN solo examen, a diferencia de los otros 12 analitos del whitelist que sí lo son.
  // Mismo criterio de agrupación que ya usa el resto del script (_esAnalitoDeOrina): toda
  // fila que pertenezca al panel de orina se recoge en un único bloque "Uroanálisis" con
  // todos sus componentes adentro; el resto de la lista no se toca. La fecha del bloque
  // es la del componente MÁS RECIENTE (misma regla "gana el más reciente" que
  // _ultimaFechaPorAnalito), y ese mismo componente presta su hash/token de informe (si
  // los trae) para el botón de PDF del bloque completo.
  function _agruparUroanalisisParaTabla(todosLabs) {
      if (!Array.isArray(todosLabs)) return [];
      const componentes = todosLabs.filter((lab) => _esAnalitoDeOrina(lab));
      if (!componentes.length) return todosLabs.slice();

      let representante = componentes[0];
      let mejorFecha = _extractAtheneaFecha(representante);
      for (let i = 1; i < componentes.length; i++) {
          const f = _extractAtheneaFecha(componentes[i]);
          if (f && (!mejorFecha || f.iso > mejorFecha.iso)) { representante = componentes[i]; mejorFecha = f; }
      }

      // v14.0.1 — Reportado en consultorio EN VIVO con pantallazo: el mismo componente
      // aparecía DOS veces en la lista ("GLUCOSA EN SUERO...", "CREATININA EN SUERO...",
      // cada uno repetido), amontonando el bloque y volviéndolo ilegible. Causa real: esta
      // función nunca deduplicaba — Athenea manda una fila por CADA solicitud histórica del
      // mismo componente (una vieja, una nueva), y todas entraban a la rejilla sin criterio.
      // Mismo patrón ya usado en _ultimaFechaPorAnalito (arriba, línea ~2254): por nombre
      // canónico, se conserva SOLO el más reciente por fecha — un dato viejo repetido no
      // aporta nada y sí ensucia la vista.
      const porNombre = new Map();
      componentes.forEach((c) => {
          const nombre = c.NombreParametro || c.nombre || c.examen || "";
          const clave = _canonNombreLab(nombre);
          const resultado = c.Resultado || c.resultado || c.valor || "—";
          const fechaInfo = _extractAtheneaFecha(c);
          const resultDate = fechaInfo ? fechaInfo.iso : null;
          const previo = porNombre.get(clave);
          if (previo && !(resultDate && (!previo.resultDate || resultDate > previo.resultDate))) return;
          porNombre.set(clave, { nombre, resultado, resultDate });
      });
      const items = [...porNombre.values()].map((v) => ({ nombre: v.nombre, resultado: v.resultado }));
      const grupo = Object.assign({}, representante, {
          NombreParametro: "Uroanálisis",
          __vglGrupoUroComponentes: items,
      });

      const salida = [];
      let insertado = false;
      todosLabs.forEach((lab) => {
          if (_esAnalitoDeOrina(lab)) {
              if (!insertado) { salida.push(grupo); insertado = true; }
              return;
          }
          salida.push(lab);
      });
      return salida;
  }

  // Busca la casilla del componente por su placeholder visible (única ancla confirmada).
  function _findUroInput(placeholderCanon) {
      try {
          const inputs = document.querySelectorAll("input[placeholder]");
          for (const el of inputs) {
              if (_canonTexto(el.placeholder) === placeholderCanon) return el;
          }
      } catch (e) {}
      return null;
  }

  // v12.5.11 — El interruptor "¿Uroanálisis?" (pedido del consultorio, pantallazo del
  // 12-08-2026, confirmado en campo): un par de radios `name="resultadoPrograma.
  // swUroanalisis"`, SI/NO, SIN atributo `value` en el DOM (Angular los distingue por
  // FormControl, no por HTML) — la única ancla real es el texto visible junto a cada
  // radio, mismo patrón que _findUroInput usa con el placeholder. Se busca el radio cuya
  // etiqueta (el texto del <label> que lo envuelve) sea exactamente "SI".
  // Regla sagrada de siempre: si el médico YA marcó SI o NO, no se toca — solo se marca
  // cuando NINGÚN radio del par está seleccionado todavía.
  function _marcarUroanalisisSi() {
      try {
          const radios = document.querySelectorAll('input[name="resultadoPrograma.swUroanalisis"]');
          let yaElegido = false, radioSi = null;
          for (const el of radios) {
              if (el.checked) yaElegido = true;
              if (_canonTexto(el.parentElement && el.parentElement.textContent) === "SI") radioSi = el;
          }
          if (yaElegido || !radioSi) return false;
          radioSi.click();
          return true;
      } catch (e) { return false; }
  }

  // v12.0.0 (del otro linaje) — Consulta a Athenea con reintento por AÑO. El endpoint exige
  // el año de la solicitud; con un único año, los laboratorios pedidos a finales del año
  // anterior no aparecían nunca. Se prueban el año en curso y los dos anteriores, y se
  // distingue la sesión vencida de la ausencia real de resultados.
  let _diagSolicitudFechaLogged = false;
  function fetchAtheneaLabs(idSolicitud, anoEspecifico = null) {
      const currentYear = new Date().getFullYear();
      const yearsToTry = anoEspecifico ? [anoEspecifico] : [currentYear, currentYear - 1, currentYear - 2];

      const tryFetchYear = (yearIndex) => {
          const ano = yearsToTry[yearIndex];
          return new Promise((resolve, reject) => {
              const siguiente = (motivoFinal) => {
                  if (yearIndex + 1 < yearsToTry.length) tryFetchYear(yearIndex + 1).then(resolve).catch(reject);
                  else reject(motivoFinal);
              };
              GM_xmlhttpRequest({
                  method: "POST",
                  url: "https://medicosviva1a.atheneasoluciones.com/Resultados/consultaDetalleSolicitud",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  data: JSON.stringify({ idSolicitud: parseInt(idSolicitud, 10), ano: ano, modulo: "LAB" }),
                  // v12.3.12 — sin `timeout`, el ontimeout de abajo era código muerto: una
                  // conexión que Athenea aceptara y nunca respondiera dejaba esta promesa
                  // colgada para siempre. 15 s, el mismo margen que usa _gmReq en este puente.
                  timeout: 15000,
                  onload: function (response) {
                      try {
                          if (response.status === 200) {
                              const res = JSON.parse(response.responseText);
                              if (res && res.dataObject) {
                                  const data = JSON.parse(res.dataObject);
                                  if (Array.isArray(data) && data.length > 0) {
                                      // v12.3.32 — BLINDAJE de fechas: hasta ahora solo se leía
                                      // res.dataObject (los analitos) y se DESCARTABA el resto de
                                      // la respuesta. Si la fecha vive a nivel de SOLICITUD (no de
                                      // analito, patrón común en estos backend), se buscaba donde
                                      // nunca iba a estar. Se escanea el nivel superior con el
                                      // mismo detector por forma y, si aparece, se hereda a cada
                                      // analito como último respaldo (__vglFechaSolicitud). El
                                      // registro de abajo es de UNA vez y deja evidencia decisiva:
                                      // qué claves trae el nivel superior y si alguna es fecha.
                                      try {
                                          // v12.3.33 — solo claves de nombre inequívoco (ver
                                          // _extractFechaSolicitudTopLevel); las demás fechas del
                                          // envoltorio se REGISTRAN pero jamás se escriben.
                                          const fechaSol = _extractFechaSolicitudTopLevel(res);
                                          if (!_diagSolicitudFechaLogged) {
                                              _diagSolicitudFechaLogged = true;
                                              const otrasFechas = Object.keys(res)
                                                  .filter((k) => k !== "dataObject" && _parseFechaLike(res[k]))
                                                  .map((k) => k + "=" + _parseFechaLike(res[k]));
                                              console.log("[Vigilante Athenea] consultaDetalleSolicitud — claves de nivel superior:", Object.keys(res),
                                                  "· fecha de solicitud ACEPTADA:", fechaSol ? (fechaSol.key + " → " + fechaSol.iso) : "NINGUNA",
                                                  "· otros valores con pinta de fecha (solo evidencia, NO se usan):", otrasFechas,
                                                  "· claves del primer analito:", Object.keys(data[0] || {}));
                                          }
                                          // v12.4.1 — la HORA del envoltorio también se hereda (antes se calculaba y se tiraba).
                                          if (fechaSol) data.forEach((a) => { if (a && typeof a === "object") { a.__vglFechaSolicitud = fechaSol.iso; if (fechaSol.hora) a.__vglHoraSolicitud = fechaSol.hora; } });
                                      } catch (eDiag) {}
                                      resolve(data); return;
                                  }
                              }
                              if (res && res.bolValido === false) {
                                  reject("La sesión en Athenea ha vencido. Abre medicosviva1a.atheneasoluciones.com para renovar el acceso.");
                                  return;
                              }
                              siguiente("No se encontraron resultados en Athenea para la solicitud #" + idSolicitud + " (años " + yearsToTry.join(", ") + ").");
                          } else {
                              siguiente("La sesión con Athenea ha caducado (HTTP " + response.status + "). Inicia sesión en Athenea.");
                          }
                      } catch (e) {
                          siguiente("Error al procesar la respuesta de Athenea: " + e);
                      }
                  },
                  onerror: function (err) { siguiente("No se pudo conectar con Athenea: " + err); },
                  ontimeout: function () { siguiente("Athenea no respondió a tiempo."); },
              });
          });
      };

      return tryFetchYear(0);
  }

  // =====================================================================
  //  PUENTE ATHENEA — BÚSQUEDA POR CÉDULA, SOLO NAVEGADOR (v12.3.3)
  //
  //  Reemplaza al "API Bridge" de localhost:5050 (Milestone 3): ese servidor
  //  nunca existió en este repositorio, así que la búsqueda automática en
  //  Athenea era código muerto en TODOS los equipos — nunca falló con un
  //  error visible, simplemente nunca encontraba nada.
  //
  //  Reconstruido a partir de una captura HAR real del flujo humano
  //  (Buscar otro paciente -> cédula -> Ver Resumen), confirmando que:
  //   1. GET  /Resultados/BusquedaPaciente         -> formulario + token CSRF
  //   2. POST /Resultados/BuscarPaciente (multipart, tipoId=0 = Cédula)
  //      -> si hay UN solo resultado, la respuesta trae ya el <input
  //         name="IdPaciente"> (el id INTERNO de Athenea) y un token CSRF
  //         nuevo, listos para confirmar.
  //   3. POST /Resultados/DatosPaciente (multipart, con ese IdPaciente)
  //      -> página del paciente. Cada solicitud aparece como
  //         <form id="{idSolicitud}{año}" data-modulo="LAB|PAT"
  //               action="/Resultados/Reporte">
  //         (el propio JS de Athenea, DatosPaciente.js, parte ese id en los
  //         últimos 4 dígitos como año y el resto como idSolicitud — misma
  //         regla que se usa aquí).
  //   4. consultaDetalleSolicitud {idSolicitud, ano, modulo} por cada una
  //      (ya implementado arriba en fetchAtheneaLabs).
  //
  //  El paciente activo vive en la SESIÓN DEL SERVIDOR de Athenea, no en la
  //  URL: por eso no basta un GET con la cédula. GM_xmlhttpRequest reusa la
  //  sesión ya iniciada en el navegador (cookies del dominio, incluido el
  //  token antifraude), igual que ya hacía fetchAtheneaLabs.
  // =====================================================================

  function _gmReq(opts) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest(Object.assign({ timeout: 15000, onload: resolve, onerror: () => reject(new Error("NetErr")), ontimeout: () => reject(new Error("Timeout")) }, opts));
    });
  }

  // Multipart/form-data a mano: Athenea exige ese Content-Type exacto (así lo
  // envía su propio formulario) y GM_xmlhttpRequest no construye FormData.
  function _atheneaMultipart(fields) {
    const boundary = "----VglAthenea" + Math.random().toString(16).slice(2) + Date.now().toString(16);
    let body = "";
    for (const k of Object.keys(fields)) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${fields[k] == null ? "" : fields[k]}\r\n`;
    }
    body += `--${boundary}--\r\n`;
    return { boundary, body };
  }

  function _atheneaToken(html) {
    const m = /name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i.exec(html)
      || /value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["']/i.exec(html);
    return m ? m[1] : "";
  }

  function _atheneaIdPaciente(html) {
    const tag = /<input[^>]*name=["']IdPaciente["'][^>]*>/i.exec(html);
    if (!tag) return "";
    const v = /value=["']([^"']*)["']/i.exec(tag[0]);
    return v ? v[1] : "";
  }

  // v12.3.3 — VERIFICACIÓN DE IDENTIDAD. La respuesta de DatosPaciente va a
  // usarse para escribir resultados en la historia clínica del paciente
  // ABIERTO en Everest. Antes de confiar en nada, se confirma que la cédula
  // que trae la página de Athenea es la MISMA que se buscó — no basta con
  // que el servidor haya respondido 200.
  function _atheneaCedulaCoincide(html, docLimpio) {
    if (!docLimpio) return false;
    const m = /\b(?:CC|TI|CE|RC|PA|CD|MS|AS|CN)\b[^0-9]{0,10}(\d{5,12})/i.exec(html);
    if (m) return m[1].replace(/\D/g, "") === docLimpio;
    try { return new RegExp("(?<!\\d)" + docLimpio + "(?!\\d)").test(html); } catch (e) { return html.includes(docLimpio); }
  }

  // Lee las tarjetas de solicitud de la página de resultados: cada una es un
  // <form action="/Resultados/Reporte"> cuyo id concatena idSolicitud+año.
  // v12.3.35 — FECHA DE LA SOLICITUD desde su tarjeta. CONFIRMADO con el diagnóstico de
  // campo (2026-08-11): consultaDetalleSolicitud NO trae fecha en NINGUNA parte — ni en
  // los 18 campos del analito ni en los 10 del envoltorio. La única fuente que queda es
  // ESTA página, donde el portal le muestra al usuario la fecha de cada solicitud junto a
  // su tarjeta. Se busca en el texto inmediatamente anterior a cada form un valor con
  // forma de fecha, con DOS guardas para no adivinar jamás: (1) la tarjeta debe contener
  // EXACTAMENTE UNA fecha reconocible (ambigüedad = sin fecha), y (2) el AÑO de esa fecha
  // debe coincidir con el año que la propia solicitud declara en su id (idSolicitud+año).
  // v12.5.3 — CONFIRMADO con evidencia de campo real (2026-08-11, consultorio): para
  // una solicitud concreta, la ventana de ±400/+700 no reconoció NINGUNA fecha (ni
  // siquiera una candidata rechazada por ambigüedad) y lo que sigue al formulario es
  // solo el campo oculto "hash" — la fecha, si existe en este HTML, está más lejos de
  // lo que se estaba mirando. Se ensancha muchísimo hacia atrás (una fila de tabla con
  // varias columnas de estado/sede/médico antes de la celda de acciones puede ser larga)
  // y esta vez se vuelca el texto CRUDO —no solo lo que el regex reconoció— para poder
  // leerlo directamente y no seguir adivinando un formato de fecha a ciegas.
  // v12.5.4 — RESUELTO CON EVIDENCIA DE CAMPO REAL (2026-08-11): el volcado crudo de la
  // v12.5.3 mostró la tarjeta completa. La fecha SIEMPRE estuvo ahí, en texto plano,
  // dentro de <div class="card-text no-margin"> — el problema nunca fue la ventana, fue
  // el PATRÓN: Athenea la escribe como "vie. 15 may. 2026 07:31 a. m." (día de la semana
  // abreviado + día + MES EN LETRAS ESPAÑOLAS + año), un formato que ningún patrón
  // numérico (dd/mm/aaaa, aaaa-mm-dd) podía reconocer jamás. Se añade
  // _parseFechaEspanolLike para ese formato. Como verificación cruzada adicional (no
  // como única fuente): la misma tarjeta trae "Numero: 26051503125", donde los 6
  // primeros dígitos son año-mes-día — confirmado 4/4 contra fechas reales de una
  // captura de pantalla. Si el texto en español y el Numero DISCREPAN, se descarta la
  // fecha entera en vez de adivinar cuál de las dos tiene razón.
  let _diagFechaSolicitudHtmlLogged = 0; // contador (hasta 2 muestras), no booleano
  const MESES_ES_ABR = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
  function _parseFechaEspanolLike(texto) {
    const out = [];
    const re = /\b(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\.?\s+(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s+(20\d{2})\b/gi;
    let mm;
    while ((mm = re.exec(texto))) {
      const mesNum = MESES_ES_ABR[mm[2].toLowerCase()];
      if (!mesNum) continue;
      const dia = Number(mm[1]), anio = Number(mm[3]);
      // Fecha real (rechaza "31 feb", etc.) — new Date normaliza desbordes en silencio,
      // así que se comprueba que lo que salió sea EXACTAMENTE lo que se pidió.
      const d = new Date(anio, mesNum - 1, dia);
      if (d.getFullYear() !== anio || d.getMonth() !== mesNum - 1 || d.getDate() !== dia) continue;
      const iso = `${anio}-${String(mesNum).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      let hora = null;
      const resto = texto.slice(mm.index + mm[0].length);
      const hm = /^[\s,]*\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?\s?m\.?/i.exec(resto);
      if (hm) {
        let h = Number(hm[1]); const min = Number(hm[2]);
        const ap = hm[3].toLowerCase();
        if (ap === "p" && h < 12) h += 12;
        if (ap === "a" && h === 12) h = 0;
        if (h >= 0 && h <= 23 && min >= 0 && min <= 59) hora = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      }
      out.push({ iso, hora });
    }
    return out;
  }
  // Verificación cruzada (nunca única fuente): "Numero: 26051503125" -> aaMMdd + consecutivo.
  // v12.5.5 — BLOQUEANTE de la revisión adversarial: usaba .exec() SIN bandera /g, así que
  // devolvía el PRIMER "Numero:" de TODO el texto que se le pasara — si ese texto abarcaba
  // más de una tarjeta (ver el bloqueante de más abajo sobre el acotado de ventana), tomaba
  // el consecutivo de una solicitud VECINA y lo hacía pasar por el de la actual. Ahora exige
  // la MISMA disciplina que _parseFechaEspanolLike: recoger TODOS los "Numero:" del texto
  // que se le entregue y exigir que resuelvan a una única fecha (ambigüedad = null).
  function _fechaDesdeNumeroSolicitud(texto) {
    const re = /\bNumero\s*:\s*(\d{2})(\d{2})(\d{2})\d+\b/gi;
    const isos = new Set();
    let m;
    while ((m = re.exec(texto))) {
      const mesN = Number(m[2]), diaN = Number(m[3]), anio = 2000 + Number(m[1]);
      if (mesN < 1 || mesN > 12 || diaN < 1 || diaN > 31) continue;
      const d = new Date(anio, mesN - 1, diaN);
      if (d.getFullYear() !== anio || d.getMonth() !== mesN - 1 || d.getDate() !== diaN) continue;
      isos.add(`${anio}-${m[2]}-${m[3]}`);
    }
    return isos.size === 1 ? [...isos][0] : null;
  }
  function _atheneaExtraerSolicitudes(html) {
    const out = [];
    const re = /<form\b[^>]*action=["']\/Resultados\/Reporte["'][^>]*>/gi;
    // v12.5.5 — BLOQUEANTE de la revisión adversarial (confirmado 8/9 tarjetas en un repro
    // con 9 solicitudes reales, como las de la captura de pantalla del consultorio): antes
    // se procesaba tarjeta por tarjeta con `while (re.exec(html))` y CADA una recortaba su
    // propia ventana de -3000/+700 caracteres SIN saber dónde empezaba o terminaba la
    // tarjeta vecina. Con solicitudes reales de ~900-1200 caracteres cada una, esa ventana
    // rutinariamente cubría 2-3 tarjetas ANTERIORES — así que la fecha, el Numero, y hasta
    // el hash/token de una solicitud VECINA podían colarse como si fueran de la actual (la
    // fecha de OTRO examen del mismo paciente, o el PDF de OTRA solicitud detrás del botón
    // "Ver informe"). Se recolectan TODAS las posiciones de formulario en un solo pase para
    // poder acotar cada ventana exactamente entre la tarjeta anterior y la siguiente —
    // nunca más ancha que la tarjeta propia.
    const matches = [...html.matchAll(re)];
    // v12.5.9 — SEGUNDA variante REAL de tarjeta, vista en campo (consola del 11-08-2026,
    // paciente con 11 solicitudes): en esta plantilla de Athenea el <form> NO va al final
    // de la tarjeta — la ENVUELVE: la fecha en español y el "Numero" van DENTRO del
    // formulario, después de su etiqueta de apertura, y los formularios de solicitudes
    // consecutivas quedan pegados uno tras otro (</form><form>) sin divs de tarjeta entre
    // ellos. El recorte de v12.5.5 ("la fecha siempre va antes del formulario") era cierto
    // solo para la PRIMERA variante: aquí dejaba a cada tarjeta sin su propia fecha y —
    // peor — esa fecha caía en la ventana TRASERA de la tarjeta SIGUIENTE, que la adoptaba
    // si el año coincidía (la fecha de OTRA solicitud del mismo paciente: la misma clase
    // de bloqueante que v12.5.5 corrigió, por otra vía). La frontera correcta, válida para
    // AMBAS variantes, es el CIERRE </form>: la fecha propia vive siempre entre el cierre
    // del formulario ANTERIOR y el cierre del PROPIO (antes de la apertura en la variante
    // clásica, dentro del formulario en la envolvente) — y como HTML prohíbe anidar
    // formularios, el primer </form> tras cada apertura es inequívocamente el suyo.
    // v12.5.9 (revisión adversarial del propio fix, 8/8 confirmados con repro ejecutable):
    //  · '\s*' antes de '>': '</form >' y '</form\n>' son fines de etiqueta VÁLIDOS en
    //    HTML que el regex estricto no veía — y un solo cierre invisible desplazaba TODAS
    //    las fronteras (pérdida de fechas en cascada).
    //  · Un '</form>' dentro de un comentario HTML o de un <script> (marcado legado,
    //    string de JS) NO es una frontera real para el navegador, pero sí lo era para el
    //    barrido crudo: partía la tarjeta en un punto falso (fecha y token perdidos, y la
    //    cola con la fecha real caía en la ventana de la tarjeta siguiente). Se excluyen.
    const zonasMuertas = [...html.matchAll(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>/gi)].map((z) => [z.index, z.index + z[0].length]);
    const enZonaMuerta = (pos) => zonasMuertas.some(([a, b]) => pos >= a && pos < b);
    const cierresTodos = [...html.matchAll(/<\/form\s*>/gi)].filter((c) => !enZonaMuerta(c.index)).map((c) => c.index + c[0].length);
    const cierres = matches.map((mm, i) => {
      // v12.5.9 (hallazgo ALTA de la revisión del fix): el cierre hallado solo es el
      // PROPIO si queda antes de la apertura del formulario siguiente — sin esta cota, a
      // un formulario sin cierre (truncado/averiado) se le asignaba el cierre de la
      // tarjeta VECINA: su ventana abarcaba las dos (fecha y hasta hash/token de OTRA
      // solicitud adoptados como propios) y la vecina quedaba con ventana vacía (su fecha
      // existente, perdida en silencio). La igualdad preserva el caso pegado </form><form>.
      const sigApertura = i < matches.length - 1 ? matches[i + 1].index : Infinity;
      const c = cierresTodos.find((pos) => pos > mm.index && pos <= sigApertura);
      if (c !== undefined) return c;
      // Sin cierre propio (HTML truncado/averiado): cae al inicio del formulario
      // siguiente o a un tope fijo — nunca a la frontera de una tarjeta vecina.
      return i < matches.length - 1 ? matches[i + 1].index : Math.min(html.length, mm.index + mm[0].length + 1500);
    });
    // v12.5.9 (hallazgo MEDIA): la PRIMERA tarjeta era la única sin frontera trasera
    // estructural — su ventana de -3000 ingería chrome de página (encabezado, panel), y
    // una fecha suelta ahí (p. ej. "Fecha de impresión") del año en curso podía colarse
    // en una tarjeta sin fecha propia. Si la página trae algún </form> ANTES de la
    // primera tarjeta (p. ej. el __AjaxAntiForgeryForm de ASP.NET), ese cierre es la
    // frontera trasera del idx 0.
    let cierreAntesDelPrimero = 0;
    if (matches.length) { for (const pos of cierresTodos) { if (pos <= matches[0].index) cierreAntesDelPrimero = pos; else break; } }
    for (let idx = 0; idx < matches.length; idx++) {
      const m = matches[idx];
      const tag = m[0];
      const idM = /\bid=["'](\d+)(20\d{2})["']/.exec(tag);
      if (!idM) continue;
      const modM = /data-modulo=["']([A-Za-z]+)["']/i.exec(tag);
      let fechaIso = null;
      let horaTxt = null; // v12.4.0 — hora que el portal muestra junto a la fecha, si existe
      // v12.5.5/12.5.9 — Límites REALES de esta tarjeta: nunca antes del cierre del
      // formulario anterior, nunca después del cierre del propio.
      const limiteAtras = idx > 0 ? cierres[idx - 1] : cierreAntesDelPrimero;
      const limiteAdelante = cierres[idx];
      try {
        const desde = Math.max(0, limiteAtras, m.index - 3000);
        const hasta = Math.min(html.length, limiteAdelante);
        // v12.4.1 — La ventana es HTML CRUDO: el designador español "p. m." lleva un
        // espacio duro que ASP.NET encodea como &nbsp;/&#160;/&#8239;. Sin decodificarlo,
        // el regex capturaba "7:35 p." a medias y una toma de las 7:35 PM se mostraba
        // como 07:35 de la mañana (hallazgo ALTO de la revisión adversarial). Se
        // normalizan esas entidades a espacio simple ANTES de buscar.
        // v12.5.5 — ';' opcional: el HTML a veces omite el punto y coma de cierre de la
        // entidad (los navegadores lo toleran igual); sin esto la HORA se perdía en
        // silencio con esas variantes (nunca la fecha — la busca un regex aparte).
        const ventana = html.slice(desde, hasta).replace(/&(?:nbsp|#0*160|#x0*a0|#0*8239|#x0*202f);?/gi, " ");
        // v12.4.0 — La HORA ya no se descarta: el regex captura la fecha CON su hora
        // adyacente si el portal la pinta ("11/08/2026 7:35 a. m."). Misma filosofía de
        // no adivinar: la hora solo se acepta si viene PEGADA a la única fecha aceptada.
        // v12.4.1 — El separador acepta también NBSP/espacio fino LITERALES, y si tras la
        // hora capturada el texto inmediato parece un meridiano truncado o una entidad
        // residual, esa hora se DESCARTA (mejor sin hora que hora invertida).
        const brutas = ventana.match(/(?:\b\d{1,2}\/\d{1,2}\/20\d{2}|\b20\d{2}-\d{2}-\d{2})(?:[ ,·T  ]{1,3}\d{1,2}:\d{2}(?::\d{2})?(?:[\s  ]*[ap]\.?[\s  ]?m\.?)?)?/gi) || [];
        const parseadas = brutas.map((b) => {
          const fh = _parseFechaHoraLike(b);
          if (!fh || !fh.hora) return fh;
          // ¿El texto que sigue a esta captura en la ventana insinúa un meridiano a
          // medias ("p." sin "m.", "&" de entidad sin decodificar)? Hora fuera.
          const fin = ventana.indexOf(b) + b.length;
          const cola = ventana.slice(fin, fin + 12);
          if (/^[\s  ]*(?:&|[ap]\b)/i.test(cola) && !/[ap]\.?[\s  ]?m/i.test(b)) return { iso: fh.iso, hora: null };
          return fh;
        }).filter(Boolean);
        const encontradas = [...new Set(parseadas.map((p) => p.iso))];
        // v12.5.4 — Fuente REAL confirmada en campo: el texto en español de la tarjeta.
        const esp = _parseFechaEspanolLike(ventana);
        const espIsos = [...new Set(esp.map((p) => p.iso))];
        const numeroIso = _fechaDesdeNumeroSolicitud(ventana);

        // v12.5.5 — Candidata PRIMARIA: español (fuente real confirmada) o, en su defecto,
        // el patrón numérico dd/mm/aaaa preexistente — ambos exigen ser la ÚNICA fecha
        // reconocible en la ventana (ya acotada a esta tarjeta) y que el año coincida con
        // el que la propia solicitud declara en su id.
        let primaria = null;
        if (espIsos.length === 1 && espIsos[0].startsWith(idM[2] + "-")) {
          const horas = [...new Set(esp.filter((p) => p.iso === espIsos[0] && p.hora).map((p) => p.hora))];
          primaria = { iso: espIsos[0], hora: horas.length === 1 ? horas[0] : null };
        } else if (encontradas.length === 1 && encontradas[0].startsWith(idM[2] + "-")) {
          const horas = [...new Set(parseadas.filter((p) => p.iso === encontradas[0] && p.hora).map((p) => p.hora))];
          primaria = { iso: encontradas[0], hora: horas.length === 1 ? horas[0] : null };
        }
        if (primaria) {
          // Si el "Numero" de la misma tarjeta también se reconoce y NO coincide con la
          // fecha primaria, algo no cuadra entre las dos fuentes: mejor ninguna fecha que
          // arriesgar cuál de las dos tiene razón.
          // v12.5.5 — ALTA de la revisión adversarial: antes esta verificación solo
          // protegía el camino español; el camino numérico dd/mm/aaaa quedaba con la
          // MISMA clase de vulnerabilidad — ahora es simétrica para los dos.
          if (!numeroIso || numeroIso === primaria.iso) {
            fechaIso = primaria.iso;
            horaTxt = primaria.hora;
          }
        } else if (numeroIso && numeroIso.startsWith(idM[2] + "-")) {
          // Último respaldo: solo el consecutivo de "Numero" (sin hora — ese campo no la trae).
          fechaIso = numeroIso;
        }
        if (_diagFechaSolicitudHtmlLogged < 2) {
          _diagFechaSolicitudHtmlLogged++;
          // Posición del formulario DENTRO de `ventana` (que arranca en `desde`): todo lo
          // que hay antes de ese punto es "antes del formulario" en el HTML real.
          const posFormEnVentana = m.index - desde;
          console.log("[Vigilante Athenea] diagnóstico tarjeta de solicitud #" + _diagFechaSolicitudHtmlLogged + " — fechas reconocibles (numérico):", encontradas,
            "· español:", espIsos, "· Numero:", numeroIso || "NINGUNO",
            "· aceptada:", fechaIso || "NINGUNA", "· hora:", horaTxt || "NINGUNA",
            "· tras el formulario:", JSON.stringify(html.slice(m.index + tag.length, Math.min(hasta, m.index + tag.length + 240))),
            "· ANTES del formulario (crudo, últimos 1500 caracteres):", JSON.stringify(ventana.slice(Math.max(0, posFormEnVentana - 1500), posFormEnVentana)));
        }
      } catch (e) {}
      // v12.5.4 — Extrae hash + token CSRF de ESTA tarjeta: son los dos campos que el
      // propio botón "Ver Informe" de Athenea envía a /Resultados/Reporte (confirmado
      // con una captura de red real, 2026-08-11). El informe demostró ser una imagen
      // escaneada SIN texto (ni un solo operador BT en todo el PDF, los 7 streams son
      // binarios no-deflate) — la fecha no se puede leer de ahí, pero con estos dos
      // campos el médico puede abrir el PDF real con un clic en vez de navegar Athenea
      // a mano. El orden de los atributos varía entre campos (visto en campo: "hash"
      // trae type/id/name/value, el token trae name/type/value), así que se prueban
      // ambos órdenes.
      // v12.5.5 — ALTA de la revisión adversarial: igual que la fecha, esta búsqueda NO
      // se detenía en el límite de la tarjeta — si la actual no traía su propio hash/token
      // cerca (p. ej. una solicitud sin informe generado aún), el botón "Ver informe" podía
      // terminar abriendo el PDF de una solicitud VECINA.
      // v12.5.9 — hash y token son CAMPOS del formulario: viven, por definición, entre su
      // apertura y su cierre </form> (limiteAdelante). Se quita el tope fijo de 1500: en
      // la variante envolvente el token va al FINAL del formulario y puede quedar más
      // lejos; el cierre propio lo acota sin riesgo (los formularios no se anidan).
      let hash = null, token = null;
      try {
        const tras = html.slice(m.index + tag.length, limiteAdelante);
        const hM = /<input[^>]*\bname=["']hash["'][^>]*\bvalue=["']([^"']*)["']/i.exec(tras) || /<input[^>]*\bvalue=["']([^"']*)["'][^>]*\bname=["']hash["']/i.exec(tras);
        const tM = /<input[^>]*\bname=["']__RequestVerificationToken["'][^>]*\bvalue=["']([^"']*)["']/i.exec(tras) || /<input[^>]*\bvalue=["']([^"']*)["'][^>]*\bname=["']__RequestVerificationToken["']/i.exec(tras);
        if (hM) hash = hM[1];
        if (tM) token = tM[1];
      } catch (e) {}
      out.push({ idSolicitud: parseInt(idM[1], 10), ano: parseInt(idM[2], 10), modulo: modM ? modM[1] : "LAB", fechaIso, horaTxt, hash, token });
    }
    return out;
  }

  // Resuelve, para una cédula, la lista de solicitudes {idSolicitud, ano, modulo}
  // disponibles en Athenea. Devuelve null ante cualquier fallo o duda de
  // identidad — nunca "adivina" un idPaciente ni una solicitud.
  // v12.3.4 — Heurística de página de login: si Athenea no reconoce la sesión, en vez de
  // servir el formulario esperado suele redirigir a Account/Login (con un campo de
  // contraseña). Detectarlo aquí convierte un "no encontrado" mudo en un diagnóstico
  // accionable: "inicia sesión en Athenea en este navegador".
  function _atheneaPareceLogin(html) {
    return /type=["']password["']/i.test(html) || /Iniciar\s+sesi[oó]n/i.test(html);
  }

  // =====================================================================
  //  v12.5.2 — AUTO-INICIO DE SESIÓN EN ATHENEA (encendido de fábrica, cuenta
  //  ÚNICA compartida por la sede)
  //
  //  Confirmado con el equipo el 11-08-2026: Athenea NO tiene un login por
  //  médico — toda VIVA 1A IPS BELLO entra con LA MISMA cuenta institucional.
  //  Por eso este ya no guarda credenciales "por médico en turno" (v12.3.16):
  //  hay UNA sola credencial compartida, guardada UNA vez por computador, y
  //  sirve para cualquier médico que use ese equipo — exactamente lo que
  //  hacía que "por médico" fuera contraproducente (la cuenta es la misma
  //  para todos; pedir que cada quien la reguarde bajo su propio ID solo
  //  añadía un paso sin ningún beneficio de aislamiento real).
  //
  //  Permite que Vigilante reinicie sesión sola en Athenea cuando la sesión
  //  caiga, para que los laboratorios automáticos no exijan un login manual
  //  tras cada reinicio del navegador — la cookie de Athenea es DE SESIÓN
  //  pura (confirmado en el HAR real: muere al cerrar el navegador y su
  //  formulario no ofrece "recordarme"), así que esto es lo más cerca que
  //  se puede llegar a "permanente" sin tocar nada del lado del servidor.
  //
  //  ADVERTENCIA DE SEGURIDAD, sin adornos: el almacén de Tampermonkey
  //  (GM_setValue) NO está cifrado, y la ofuscación de abajo solo evita leer
  //  la contraseña de un vistazo en el panel de Tampermonkey — NO es
  //  cifrado real; cualquiera con acceso técnico al equipo puede
  //  recuperarla. LA CREDENCIAL NUNCA VIVE EN EL CÓDIGO NI SE COMMITEA A
  //  GIT: se escribe una sola vez en Ajustes, queda SOLO en el almacén
  //  local de ESE navegador/computador, y nunca sale de ahí (no viaja al
  //  script fuente, ni al Gist, ni a ningún repositorio). Guardarla ahí en
  //  vez de hornearla en el archivo es la diferencia entre "una filtración
  //  obliga a cambiarla en N computadores" y "una filtración obliga a
  //  cambiarla en TODOS los equipos de TODA la clínica para siempre,
  //  imposible de revertir una vez publicada en el historial de git".
  //  Un rechazo de credenciales NO se reintenta solo (los intentos
  //  repetidos bloquean la cuenta institucional para TODA la sede): se
  //  marca y se avisa una vez para volver a guardarlas.
  // =====================================================================
  const ATH_CRED_KEY = "vgl_ath_creds";
  let atheneaLoginBloqueado = false;  // credencial compartida rechazada: NO reintentar sola
  let atheneaLoginEnVuelo = false;
  // Ofuscación reversible (XOR + base64) — anti-vistazo, NO cifrado (ver arriba).
  function _vglXor(s) { const k = "Vgl-Athenea-2026-local"; let o = ""; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return o; }
  function _vglOfusca(s) { try { return btoa(unescape(encodeURIComponent(_vglXor(String(s))))); } catch (e) { return ""; } }
  function _vglDesofusca(s) { try { return _vglXor(decodeURIComponent(escape(atob(String(s))))); } catch (e) { return ""; } }
  function atheneaCredsGet() {
    try {
      const c = GM_getValue(ATH_CRED_KEY, null);
      if (!c || !c.u || !c.p) return null;
      const u = _vglDesofusca(c.u), p = _vglDesofusca(c.p);
      return (u && p) ? { u, p } : null;
    } catch (e) { return null; }
  }
  function atheneaCredsSet(u, p) {
    if (!u || !p) return false;
    try { GM_setValue(ATH_CRED_KEY, { u: _vglOfusca(u), p: _vglOfusca(p), savedAt: Date.now() }); atheneaLoginBloqueado = false; return true; } catch (e) { return false; }
  }
  function atheneaCredsClear() {
    try { GM_setValue(ATH_CRED_KEY, null); } catch (e) {}
    atheneaLoginBloqueado = false;
  }
  // Intenta iniciar sesión en Athenea con la credencial compartida de la sede.
  // Devuelve true solo si la sesión quedó activa. Distingue fallo de RED (transitorio,
  // se reintentará) de rechazo de CREDENCIALES (se marca y NO se reintenta solo).
  // v12.5.2 — ya NO exige un médico identificado en Everest primero: al ser una cuenta
  // compartida, no depende de saber quién está en turno.
  async function atheneaAutoLogin() {
    if (!S.atheneaAutoLogin) return false;
    if (atheneaLoginBloqueado || atheneaLoginEnVuelo) return false;
    const cred = atheneaCredsGet();
    // v12.5.8 — Reportado en campo (11-08-2026): la sesión caía, el auto-login "no hacía
    // nada" y NADIE decía por qué — este return era 100% mudo. La causa real: en ESTE
    // computador nunca se había guardado la credencial compartida (vive SOLO en el
    // almacén local de cada equipo, a propósito — jamás viaja con el script). Ahora lo
    // dice claro, una vez al día, con la instrucción exacta de qué hacer.
    if (!cred) {
      console.warn("[Vigilante Athenea] auto-login: este equipo NO tiene guardada la cuenta compartida de Athenea — se guarda una sola vez en Ajustes → «Auto-inicio de sesión en Athenea». Sin eso, el login debe hacerse a mano.");
      notify("AMBAR", "🔑 Athenea: falta guardar la cuenta compartida en ESTE equipo",
        "El auto-inicio de sesión está activado pero este computador no tiene guardada la cuenta compartida de Athenea (se guarda una sola vez por equipo, en Ajustes → «Auto-inicio de sesión en Athenea»). Mientras tanto, inicia sesión a mano en medicosviva1a.atheneasoluciones.com.",
        false, "athenea_sin_creds|" + todayStamp());
      return false;
    }
    atheneaLoginEnVuelo = true;
    try {
      const BASE = "https://medicosviva1a.atheneasoluciones.com";
      const g = await _gmReq({ method: "GET", url: BASE + "/Account/Login" });
      // v12.5.8 — Estos dos returns eran mudos: desde la consola era imposible saber si el
      // auto-login siquiera lo intentó. Ahora cada camino dice qué pasó.
      if (g.status !== 200) { console.warn("[Vigilante Athenea] auto-login: /Account/Login respondió HTTP " + g.status + " (transitorio, se reintenta en el próximo latido)."); return false; }
      const token = _atheneaToken(g.responseText);
      if (!token) { console.warn("[Vigilante Athenea] auto-login: la página de login no trae el token CSRF reconocible (¿cambió el formulario de Athenea?)."); return false; }
      // Contrato confirmado en HAR real: application/x-www-form-urlencoded; éxito = 302 a /Resultados.
      // La contraseña NUNCA se registra en consola ni en telemetría.
      const cuerpo = "Usuario=" + encodeURIComponent(cred.u) + "&Password=" + encodeURIComponent(cred.p) + "&__RequestVerificationToken=" + encodeURIComponent(token);
      const r = await _gmReq({ method: "POST", url: BASE + "/Account/Login", headers: { "Content-Type": "application/x-www-form-urlencoded" }, data: cuerpo });
      const ok = r.status >= 200 && r.status < 400 && !_atheneaPareceLogin(r.responseText || "");
      if (ok) { console.log("[Vigilante Athenea] sesión iniciada automáticamente (cuenta compartida de la sede)."); return true; }
      // Rechazo de credenciales (o el portal cambió): se MARCA y NO se reintenta solo.
      atheneaLoginBloqueado = true;
      notify("AMBAR", "🔑 Athenea: revisa la cuenta compartida",
        "El inicio de sesión automático en Athenea falló (usuario/contraseña incorrectos o el portal cambió). Vuelve a guardarlos en Ajustes o inicia sesión a mano. No se reintenta solo para no bloquear la cuenta de toda la sede.",
        false, "athenea_autologin_fallo|" + todayStamp());
      return false;
    } catch (e) {
      console.warn("[Vigilante Athenea] auto-login: error de red (reintenta en el próximo latido):", e && e.message);
      return false;                                             // error de RED, no de credenciales: no se bloquea
    } finally { atheneaLoginEnVuelo = false; }
  }

  // v12.3.5 — LATIDO DE SESIÓN. Reportado en uso real: la sesión de Athenea caduca en
  // pocos minutos y el médico tenía que volver a iniciar sesión constantemente para que
  // los laboratorios automáticos funcionaran.
  //
  // Vigilante NO guarda ni escribe la contraseña de Athenea en ningún caso — eso sería
  // un riesgo real en un equipo de consultorio compartido. Lo que SÍ puede hacer, sin
  // tocar credenciales: la mayoría de sesiones ASP.NET (que es lo que corre Athenea, a
  // juzgar por el token __RequestVerificationToken y /Account/Login) usan expiración
  // DESLIZANTE por defecto — el reloj se reinicia con cada petición autenticada, no solo
  // con clics del médico. Un GET periódico y liviano (el mismo BusquedaPaciente ya usado
  // en el paso 1 de la búsqueda) mantiene viva la sesión mientras el médico ya inició
  // sesión una vez en este navegador — sin credenciales, sin adivinar nada.
  //
  // Si la sesión NO está activa (nunca se inició, o el intervalo fue más largo que el
  // timeout real), se avisa UNA VEZ AL DÍA con notify() (que ya deduplica por uid+día)
  // en vez de fallar en silencio cada vez que se intenta traer un laboratorio.
  let atheneaKeepAliveAt = 0;
  let atheneaSesionViva = null;   // null = aún no se sabe; true/false tras el primer chequeo
  async function atheneaKeepAlive() {
    try {
      const r = await _gmReq({ method: "GET", url: "https://medicosviva1a.atheneasoluciones.com/Resultados/BusquedaPaciente" });
      let viva = r.status === 200 && !_atheneaPareceLogin(r.responseText);
      // v12.3.16 — Si la sesión cayó y el médico configuró el auto-inicio, se intenta ANTES
      // de molestarlo: el login corre sobre BusquedaPaciente de nuevo tras loguear, así que
      // basta con marcar viva=true (atheneaAutoLogin ya verificó que la sesión quedó activa).
      if (!viva && S.atheneaAutoLogin && await atheneaAutoLogin()) viva = true;
      if (viva !== atheneaSesionViva) {
        console.log("[Vigilante Athenea] latido — sesión " + (viva ? "ACTIVA (mantenida)" : "NO activa"));
        // v12.3.15 — Al REVIVIR la sesión (el médico acaba de iniciar sesión en la otra
        // pestaña), se resetea la guarda una-vez-por-paciente del robot: en el siguiente
        // tick de la historia clínica vuelve a buscar los laboratorios del paciente
        // abierto, sin recargar la página ni volver a entrar a la historia.
        if (viva && atheneaSesionViva === false) {
          lastAutoFetchedDoc = "";
          console.log("[Vigilante Athenea] sesión restaurada: el robot reintentará los laboratorios del paciente abierto.");
        }
      }
      atheneaSesionViva = viva;
      if (!viva) {
        notify("AMBAR", "🔑 Athenea: inicia sesión una vez",
          "Los laboratorios automáticos no se están cargando porque no hay sesión activa en Athenea en este navegador. Abre medicosviva1a.atheneasoluciones.com e inicia sesión — después Vigilante la mantiene activa sola, sin que tengas que repetirlo.",
          false, "athenea_sesion_caducada|" + todayStamp());
      }
    } catch (e) { console.warn("[Vigilante Athenea] latido de sesión falló:", e); }
  }

  async function getAtheneaSolicitudesAuto(docId) {
    const doc = String(docId || "").replace(/\D/g, "");
    if (!doc) return null;
    const BASE = "https://medicosviva1a.atheneasoluciones.com";
    const diag = (paso, extra) => console.log("[Vigilante Athenea] " + paso + (extra ? " — " + extra : ""));
    try {
      const r1 = await _gmReq({ method: "GET", url: `${BASE}/Resultados/BusquedaPaciente` });
      diag("1/3 GET BusquedaPaciente", "status=" + r1.status + " len=" + (r1.responseText || "").length);
      if (r1.status !== 200) { console.warn("[Vigilante Athenea] paso 1 falló: HTTP " + r1.status); return null; }
      if (_atheneaPareceLogin(r1.responseText)) { atheneaSesionViva = false; console.warn("[Vigilante Athenea] paso 1 devolvió una pantalla de LOGIN: la sesión de Athenea no está activa en este navegador. Inicia sesión en medicosviva1a.atheneasoluciones.com y vuelve a intentar."); return null; }
      const token1 = _atheneaToken(r1.responseText);
      if (!token1) { console.warn("[Vigilante Athenea] paso 1 respondió 200 pero sin token CSRF reconocible (¿cambió el formulario de Athenea?)."); return null; }

      // tipoId=0 = Cédula de Ciudadanía (confirmado en captura real: numId=<cédula>).
      const mp1 = _atheneaMultipart({ porRango: "false", tipoId: "0", numId: doc, nombre1: "", nombre2: "", apellido1: "", apellido2: "", __RequestVerificationToken: token1 });
      const r2 = await _gmReq({ method: "POST", url: `${BASE}/Resultados/BuscarPaciente`, headers: { "Content-Type": `multipart/form-data; boundary=${mp1.boundary}` }, data: mp1.body });
      diag("2/3 POST BuscarPaciente", "status=" + r2.status + " len=" + (r2.responseText || "").length);
      if (r2.status !== 200) { console.warn("[Vigilante Athenea] paso 2 falló: HTTP " + r2.status); return null; }
      if (_atheneaPareceLogin(r2.responseText)) { console.warn("[Vigilante Athenea] paso 2 devolvió una pantalla de LOGIN: la sesión de Athenea caducó a mitad de la búsqueda."); return null; }

      // Sin IdPaciente no se avanza: puede ser que Athenea no tenga a este
      // paciente, o que la búsqueda haya devuelto una LISTA de coincidencias
      // en vez de un resultado único — en ambos casos, se detiene en vez de
      // adivinar (el mismo motivo por el que v11.0.1 quitó el prompt() de
      // cédula manual: un dato mal supuesto escribe en la ficha equivocada).
      const idPaciente = _atheneaIdPaciente(r2.responseText);
      const token2 = _atheneaToken(r2.responseText);
      if (!idPaciente || !token2) { console.warn("[Vigilante Athenea] paso 2 no devolvió un paciente único (idPaciente=" + JSON.stringify(idPaciente) + ", token=" + (token2 ? "sí" : "no") + "): puede que la cédula no exista en Athenea, o que la búsqueda haya dado varios resultados. Verifique manualmente en el portal."); return null; }

      const mp2 = _atheneaMultipart({ IdPaciente: idPaciente, __RequestVerificationToken: token2 });
      const r3 = await _gmReq({ method: "POST", url: `${BASE}/Resultados/DatosPaciente`, headers: { "Content-Type": `multipart/form-data; boundary=${mp2.boundary}` }, data: mp2.body });
      diag("3/3 POST DatosPaciente", "status=" + r3.status + " len=" + (r3.responseText || "").length);
      if (r3.status !== 200) { console.warn("[Vigilante Athenea] paso 3 falló: HTTP " + r3.status); return null; }

      if (!_atheneaCedulaCoincide(r3.responseText, doc)) {
        console.warn("[Vigilante Athenea] la cédula de la respuesta no coincide con la buscada; se descarta por seguridad.");
        return null;
      }

      const solicitudes = _atheneaExtraerSolicitudes(r3.responseText);
      diag("OK", solicitudes.length + " solicitud(es) encontradas: " + solicitudes.map((s) => s.idSolicitud + "/" + s.ano + "/" + s.modulo).join(", "));
      return { idPaciente, solicitudes };
    } catch (e) {
      console.warn("[Vigilante Athenea] excepción resolviendo solicitudes:", e);
      return null;
    }
  }

  // Trae y fusiona los analitos de TODAS las solicitudes de laboratorio
  // (módulo LAB) de un paciente. Cada solicitud ya trae su año exacto
  // (raspado de Athenea), así que fetchAtheneaLabs no necesita reintentar
  // por año — solo lo hace cuando se le llama sin ese dato.
  async function getAtheneaLabsAuto(docId) {
    const resuelto = await getAtheneaSolicitudesAuto(docId);
    if (!resuelto || !resuelto.solicitudes.length) return [];
    const porLab = resuelto.solicitudes.filter((s) => s.modulo === "LAB");
    // v12.3.35 — cada analito hereda la fecha de SU PROPIA solicitud (raspada de la
    // tarjeta del portal, ver _atheneaExtraerSolicitudes): es la única fuente de fecha
    // que existe, confirmado en campo. No pisa una fecha que fetchAtheneaLabs ya hubiera
    // detectado por otra vía.
    const listas = await Promise.all(porLab.map((s) =>
      fetchAtheneaLabs(s.idSolicitud, s.ano).then((arr) => {
        if (s.fechaIso && Array.isArray(arr)) arr.forEach((a) => {
          if (a && typeof a === "object" && !("__vglFechaSolicitud" in a)) {
            a.__vglFechaSolicitud = s.fechaIso;
            // v12.4.0 — la hora raspada de la tarjeta acompaña a su fecha, si existe.
            if (s.horaTxt) a.__vglHoraSolicitud = s.horaTxt;
          }
        });
        // v12.5.4 — hash/token de ESTA solicitud, para el botón "Ver informe" del modal
        // de laboratorios: abre el PDF real con un clic en vez de navegar Athenea a mano.
        if (s.hash && s.token && Array.isArray(arr)) arr.forEach((a) => {
          if (a && typeof a === "object") { a.__vglHash = s.hash; a.__vglToken = s.token; a.__vglModulo = s.modulo; }
        });
        return arr;
      }).catch(() => [])
    ));
    return listas.flat();
  }

  // Despacha eventos para que Angular actualice el modelo
  function setNgValue(inputEl, value) {
      if (!inputEl) return;
      inputEl.value = value;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // v12.6.8 — Canon para comparar nombres de analito. Hasta v12.6.7 la comparación era
  // texto crudo en mayúsculas: sensible a tildes (por eso la lista de RAC tenía que
  // repetir "RELACION"/"RELACIÓN" a mano) y, sobre todo, sensible a la PUNTUACIÓN. El
  // mismo examen viaja con separadores distintos según de dónde salga —
  // "RELACION MICROALBUMINURIA CREATININA" en el PDF del laboratorio,
  // "RELACION MICROALBUMINURIA/CREATININA" o "MICROALBUMINURIA-CREATININA" en otras
  // vistas — y con un solo carácter de diferencia el analito no casaba con NINGUNA
  // entrada, así que su resultado no se escribía en la historia. Se normalizan los
  // separadores a espacio y se quitan las tildes en AMBOS lados de la comparación. Es
  // normalización tipográfica, no clínica: no amplía qué examen casa con qué casilla, solo
  // deja de perder el que ya debía casar.
  const _canonNombreLab = (s) => stripAccents(String(s || "")).toUpperCase().replace(/[\/\-_,.;:()]+/g, " ").replace(/\s+/g, " ").trim();

  function _matchLabInWhitelist(lab) {
      const code = String(lab.CodigoParametro || lab.codigo || "").trim();
      const name = _canonNombreLab(lab.NombreParametro || lab.nombre || lab.examen);

      // v11.0.1 — El código exacto manda SIEMPRE sobre el nombre (antes dependía del
      // orden del recorrido). Solo si ningún código casa se intenta por nombre, y ahí se
      // respetan las exclusiones de cada analito.
      for (const item of WHITELIST_13_LABS) {
          if (code && item.codes.includes(code)) return item;
      }
      // v12.3.37 — GUARDA DE ORINA. Los hijos del parcial de orina se llaman igual que
      // exámenes de SANGRE ("HEMOGLOBINA", "GLUCOSA", "ALBUMINA"...): sin esta guarda, la
      // hemoglobina EN ORINA caía por nombre en la casilla de hemoglobina SÉRICA — el
      // mismo error clínico silencioso que v11.0.1 corrigió para la creatinina, ahora
      // para el panel entero. Por nombre, un analito de orina solo puede casar con los
      // exámenes que legítimamente SON de orina (RAC y el propio uroanálisis); el código
      // exacto de arriba sigue mandando porque un CUPS es inequívoco.
      const deOrina = _esAnalitoDeOrina(lab);
      for (const item of WHITELIST_13_LABS) {
          if (deOrina && item.key !== "RAC" && item.key !== "UROANALISIS") continue;
          // Un HIJO cuyo nombre incluye el del panel ("LEUCOCITOS (PARCIAL DE ORINA)")
          // casaría aquí con la entrada general UROANALISIS y jamás llegaría a su casilla
          // de componente: si el analito mapea a un componente, se deja pasar a esa ruta.
          if (deOrina && item.key === "UROANALISIS" && _matchUroComponente(lab)) continue;
          if (item.excluye && item.excluye.some((x) => name.includes(_canonNombreLab(x)))) continue;
          for (const n of item.names) {
              if (name.includes(_canonNombreLab(n))) return item;
          }
      }
      return null;
  }

  // Primer elemento del DOM que exista entre el id principal y sus alternativas.
  function _findLabField(primaryId, altIds) {
      for (const id of [primaryId].concat(altIds || [])) {
          if (!id) continue;
          const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
          if (el) return el;
      }
      return null;
  }

  // v12.3.26 — CONFIRMADO con el HTML real de la Ruta Crónicos pegado en consultorio:
  // "Hemoglobina" (hemograma, type=text, sin límites) y "Hemoglobina glicosilada %"
  // (HbA1c, type=number, max=30) tienen literalmente el MISMO id/name en el DOM de
  // Everest — id="resultadoHemoglobina", name="resultadoHemoglobina" en LOS DOS <input>
  // (un choque de ids real del propio Everest, no nuestro). document.getElementById()
  // y querySelector('[name=...]') solo devuelven el PRIMERO que aparece — que es
  // siempre el de Hemoglobina normal — así que _findLabField() nunca puede alcanzar el
  // de HbA1c por id. Mapear HBA1C a ese mismo id escribiría el resultado de HbA1c en la
  // casilla de hemoglobina normal: un error clínico silencioso, peor que no escribir
  // nada. Se distingue por ATRIBUTO (type="number" + max="30", únicos del campo de
  // HbA1c entre los que comparten ese id/name), no por posición en el DOM — así sigue
  // funcionando aunque Everest reordene los campos de la vista. La fecha se busca como
  // HERMANA del resultado dentro del mismo .input-group (mismo patrón que TODOS los
  // pares resultado+fecha de esta vista), no por id: la fecha también está duplicada.
  function _findHbA1cFields() {
      const candidatos = document.querySelectorAll('input[name="resultadoHemoglobina"], input#resultadoHemoglobina');
      for (const el of candidatos) {
          if (el.type === "number" && el.getAttribute("max") === "30") {
              const grupo = el.closest(".input-group");
              const fechaEl = grupo ? grupo.querySelector('input[type="date"]') : null;
              return { resultEl: el, dateEl: fechaEl };
          }
      }
      return { resultEl: null, dateEl: null };
  }

  // v12.3.10 — Se comprobó en consultorio real que los 7 resultados de un paciente se
  // inyectaron bien, pero NINGUNA fecha se escribió: lab.Fecha/fechaResult/fecha eran
  // nombres de campo adivinados, nunca confirmados contra la respuesta real de
  // consultaDetalleSolicitud. En vez de adivinar un cuarto nombre a ciegas, se deja
  // esta bandera para volcar UNA sola vez las claves reales del primer analito sin
  // fecha reconocida — así la próxima corrida real revela el nombre correcto.
  let _diagLabFechaLogged = false;
  let _diagLabsSinCasarLogged = false;
  let _diagLabFechaKeyFound = false;
  const _diagLabFechaPorCasilla = new Set();
  // v12.3.36 — Reportado en consultorio con el Administrador de tareas en la mano: la
  // consola abierta retiene CADA entrada con su pila de llamadas, y este aviso salía
  // decenas de veces por clic (uno por analito duplicado, en cada reintento). Ahora se
  // avisa UNA vez por casilla y sesión; el conteo completo ya viaja en el resumen.
  const _avisoCasillaYaEscrita = new Set();
  // v12.3.37 — volcar los analitos de ORINA tal como llegan de Athenea (nombre, padre,
  // resultado, idNormalidad, idEstado): la evidencia real para afinar los sinónimos de
  // UROANALISIS_COMPONENTES y construir la futura regla NORMAL/ANORMAL con datos, no con
  // adivinanzas. La revisión adversarial tumbó la bandera única por sesión: el primer
  // paciente del día agotaba el volcado y los componentes de los demás jamás se
  // capturaban. Ahora se vuelca cuando aparece un NOMBRE de analito no visto aún en la
  // sesión; paneles idénticos repetidos no vuelven a imprimir (mismo control de ruido
  // de consola de v12.3.36).
  const _diagUroNombresVistos = new Set();
  const _CAMPOS_FECHA_CONOCIDOS = ["Fecha", "fechaResult", "fecha", "fechaOrden", "fechaResultado"];

  // v12.3.30 — Los 4 nombres de campo de arriba se probaron contra la respuesta real de
  // Athenea (confirmado en consultorio, capturas de pantalla del 2026-08-11) y NINGUNO
  // existe en el objeto: no es un problema de formato, la clave real se llama distinto.
  // Capturarla con un HAR de la pestaña era imposible por diseño — GM_xmlhttpRequest
  // despacha la petición por fuera de la pila de red de la página, así que nunca aparece
  // en el panel de Red del navegador ni en su exportación a .har. En vez de adivinar un
  // quinto nombre a ciegas, se detecta la fecha por LA FORMA del valor (ISO, dd/mm/aaaa
  // o fecha .NET /Date(ms)/, los 3 formatos que puede devolver un backend ASP.NET como
  // este) recorriendo TODAS las claves del objeto — sin importar cómo se llame la que
  // la contiene. De paso corrige un bug latente: si la fecha llegaba como "15/03/2026",
  // un <input type="date"> la rechazaba en silencio aunque el campo SÍ se hubiera
  // encontrado, porque ese control exige el formato ISO aaaa-mm-dd exacto.
  // v12.4.0 — LA HORA YA NO SE TIRA A LA BASURA. Antes, cada rama de _parseFechaLike
  // truncaba a aaaa-mm-dd: un ISO "2026-08-11T07:35" perdía las 07:35, un /Date(ms)/
  // descartaba horas y minutos que el timestamp SÍ contiene, y — el peor caso, bug real —
  // "11/08/2026 07:35" no casaba con NINGUNA rama (la de dd/mm/aaaa estaba anclada con $)
  // y terminaba como "Sin fecha": la hora no solo se perdía, se llevaba la fecha entera.
  // Ahora el parseador devuelve {iso, hora} y todos los consumidores conservan ambas.
  // La hora se valida (0-23:0-59) y acepta el formato del portal ("7:35 a. m.").
  function _parseFechaHoraLike(v) {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (!s) return null;
      // v12.4.1 — Lo que sigue a la fecha se clasifica en TRES casos (revisión adversarial):
      //  · hora reconocida y sana → {hora:"HH:MM"}; el separador acepta NBSP ( ) y
      //    espacio fino ( ), habituales en HTML renderizado;
      //  · hora seguida de designador de zona ("Z", "+00:00", "-05:00") → hora null (el
      //    instante podría estar corrido de zona: antes casilla sin hora que hora movida);
      //  · cualquier otra cosa (texto, un rango "11/08/2026-15/09/2026", "99:99") → la
      //    FECHA ENTERA se rechaza: un valor con basura pegada no es una fecha confiable.
      const analizarResto = (resto) => {
          const r = String(resto || "");
          if (!r.trim()) return { hora: null, ok: true };            // fecha sola y limpia
          const hm = r.match(/^[T ,·  ]{1,3}(\d{1,2}):(\d{2})(?::\d{2})?(?:[\s  ]*([ap])\.?[\s  ]?m\.?)?/i);
          if (!hm) return { hora: null, ok: false };                 // basura tras la fecha
          let h = Number(hm[1]); const min = Number(hm[2]);
          if (hm[3]) { const ap = hm[3].toLowerCase(); if (ap === "p" && h < 12) h += 12; if (ap === "a" && h === 12) h = 0; }
          if (h < 0 || h > 23 || min < 0 || min > 59) return { hora: null, ok: false };
          // Tras la hora: milisegundos opcionales y luego, si viene una zona explícita,
          // la hora se calla (no sabemos en qué reloj está escrita).
          const tras = r.slice(hm[0].length).replace(/^[.,]\d+/, "").replace(/^[\s  ]+/, "");
          if (/^(?:z\b|z$|[+-]\d{2}:?\d{2})/i.test(tras)) return { hora: null, ok: true };
          return { hora: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, ok: true };
      };
      // v12.3.33 — hallado en revisión adversarial: sin frontera al final ni validación de
      // rango, un folio como "2026-08-1234567" se leía como la fecha 2026-08-12 y
      // "2026-99-99" pasaba entero. Se exige que tras el día NO siga otro dígito y que
      // mes/día estén en rango — igual de estricto que la rama dd/mm/aaaa de abajo.
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?!\d)/);
      if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= 31) {
          const r = analizarResto(s.slice(m[0].length));
          return r.ok ? { iso: `${m[1]}-${m[2]}-${m[3]}`, hora: r.hora } : null;
      }
      if (m) return null;
      m = s.match(/^\/Date\((-?\d+)/);
      if (m) {
          const d = new Date(Number(m[1]));
          if (isNaN(d.getTime())) return null;
          // v12.4.1 — Una medianoche UTC exacta es el patrón "solo guardé la fecha" de un
          // backend que serializa en UTC: se devuelve la fecha UTC sin hora. Sin esta
          // guardia, /Date(...T00:00Z)/ en Colombia salía como el DÍA ANTERIOR a las
          // "19:00" — fecha corrida y hora inventada a la vez.
          if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0)
              return { iso: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`, hora: null };
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          // Muchos backend ASP.NET mandan la medianoche exacta cuando solo guardan la
          // FECHA: una 00:00 en punto no se muestra como hora (sería inventar precisión).
          const hh = d.getHours(), mi = d.getMinutes();
          return { iso, hora: (hh === 0 && mi === 0) ? null : `${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}` };
      }
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/);
      if (m) {
          const dd = m[1].padStart(2, "0"), mm = m[2].padStart(2, "0");
          if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
              const r = analizarResto(s.slice(m[0].length));
              return r.ok ? { iso: `${m[3]}-${mm}-${dd}`, hora: r.hora } : null;
          }
      }
      return null;
  }
  function _parseFechaLike(v) { const r = _parseFechaHoraLike(v); return r ? r.iso : null; }

  // v12.3.33 — BLOQUEANTE hallado en revisión adversarial de v12.3.32: heredar CUALQUIER
  // valor con pinta de fecha del nivel superior de la respuesta era peligrosísimo — si el
  // envoltorio trae el timestamp del SERVIDOR (fechaConsulta = hoy, patrón común en
  // ASP.NET), un resultado de hace meses quedaría fechado HOY en la historia clínica:
  // exactamente la falsificación clínica que v11.0.1 eliminó. Solo se acepta una clave
  // cuyo NOMBRE denote inequívocamente la fecha de la solicitud/toma/orden; todo lo demás
  // queda únicamente en el registro de diagnóstico como evidencia para ampliar esta lista
  // con datos reales, nunca por adivinanza.
  function _extractFechaSolicitudTopLevel(res) {
      if (!res || typeof res !== "object") return null;
      for (const k of Object.keys(res)) {
          if (!/^fecha[_ ]?(solicitud|toma|muestra|orden)/i.test(k)) continue;
          const fh = _parseFechaHoraLike(res[k]);
          if (fh) return { iso: fh.iso, hora: fh.hora, key: k };
      }
      return null;
  }

  // v12.4.0 — Devuelve {iso, hora, key}: la hora viaja junto a la fecha desde CUALQUIER
  // fuente que la contenga (campo del analito, envoltorio, o la tarjeta del portal vía
  // __vglFechaSolicitud/__vglHoraSolicitud). Si ninguna fuente la trae, hora es null y
  // la interfaz muestra solo la fecha — nunca se inventa.
  function _extractAtheneaFecha(lab) {
      if (!lab || typeof lab !== "object") return null;
      for (const k of _CAMPOS_FECHA_CONOCIDOS) {
          const fh = _parseFechaHoraLike(lab[k]);
          if (fh) return { iso: fh.iso, hora: fh.hora, key: k };
      }
      // Sin match por nombre: se recorren las demás claves buscando un valor con forma
      // de fecha. Se prefiere una clave que además CONTENGA "fecha" en el nombre, para
      // no confundirse con otro campo numérico que por azar calce /Date(ms)/.
      // v12.3.32 — __vglFechaSolicitud (heredada del nivel de solicitud) se excluye del
      // barrido general: es el ÚLTIMO respaldo, para que cualquier fecha propia del
      // analito, se llame como se llame, siga ganando.
      let candidato = null;
      for (const k of Object.keys(lab)) {
          if (_CAMPOS_FECHA_CONOCIDOS.includes(k) || k === "__vglFechaSolicitud" || k === "__vglHoraSolicitud") continue;
          const fh = _parseFechaHoraLike(lab[k]);
          if (!fh) continue;
          if (/fecha/i.test(k)) return { iso: fh.iso, hora: fh.hora, key: k };
          if (!candidato) candidato = { iso: fh.iso, hora: fh.hora, key: k };
      }
      if (candidato) return candidato;
      const fhSol = _parseFechaHoraLike(lab.__vglFechaSolicitud);
      if (!fhSol) return null;
      // La hora de la tarjeta del portal (si el raspado la encontró) acompaña a la fecha
      // de la solicitud; una hora ya presente en el valor de la fecha gana sobre ella.
      const horaSol = fhSol.hora || (typeof lab.__vglHoraSolicitud === "string" && /^\d{2}:\d{2}$/.test(lab.__vglHoraSolicitud) ? lab.__vglHoraSolicitud : null);
      return { iso: fhSol.iso, hora: horaSol, key: "__vglFechaSolicitud" };
  }

  // v12.5.7 — Extraído de injectLabsIntoCronicos (donde vivía como "candidatosPorClave")
  // para reutilizar la MISMA regla en el nuevo aviso de laboratorios RCV vencidos
  // (checkLabsVencidos): dado un labsArray de Athenea, agrupa por analito del whitelist
  // sérico y devuelve, para cada uno, el resultado con la fecha MÁS RECIENTE (v12.5.6 —
  // una fecha real siempre le gana a "sin fecha"; entre dos con fecha, la mayor ISO gana;
  // empate o ambas sin fecha, se conserva la primera vista, estable). No toca los
  // componentes de orina (ruta aparte, ver inyectarComponenteOrina) ni cuenta nada más
  // allá de los pendientes que él mismo descarta.
  // v12.5.7 — CONFIRMADO en la revisión adversarial: `lab.Resultado || lab.resultado ||
  // lab.valor` trataba un resultado NUMÉRICO 0 (p. ej. RAC=0 en un paciente sano, un valor
  // real y clínicamente posible) como si estuviera ausente (0 es falsy en JS) — con el
  // nuevo aviso de laboratorios vencidos, eso se traducía en un falso aviso ROJO ("nunca
  // realizado") pese a existir un resultado real. Se descarta SOLO null/undefined/cadena
  // vacía, nunca un 0 legítimo, conservando el mismo orden de respaldo entre campos.
  const _valorCrudoLab = (v) => (v === null || v === undefined || String(v).trim() === "") ? undefined : v;
  const _WHITELIST_UROANALISIS = WHITELIST_13_LABS.find((w) => w.key === "UROANALISIS");
  // v12.5.15 — Athenea JAMÁS manda una fila llamada literalmente "UROANALISIS"/"PARCIAL DE
  // ORINA": manda entre 20 y 30 filas, una por componente (Color, Glucosa, Nitritos,
  // Sangre, Hematíes...), cada una con NombreParametroPadre="UROANALISIS" (confirmado con
  // capturas reales del portal Y del PDF oficial del laboratorio en consultorio). Por eso
  // _matchLabInWhitelist (que exige el NOMBRE del panel completo) nunca encontraba
  // candidato para la key UROANALISIS aunque el examen SÍ se hubiera hecho — el aviso de
  // vigencia RCV lo mostraba como faltante siempre, sin excepción.
  // Segundo parámetro opcional: SOLO checkLabsVencidos (vía _analitosRcvVencidos) lo activa.
  // injectLabsIntoCronicos NO lo activa a propósito: ese camino ya tiene su propia ruta
  // dedicada para los componentes (inyectarComponenteOrina/UROANALISIS_COMPONENTES,
  // v12.3.37) que escribe cada uno en SU casilla; si este respaldo también corriera ahí,
  // el valor de un componente cualquiera (p. ej. "NEGATIVO" de Sangre) se colaría como si
  // fuera el resultado general del panel en la casilla resultadoUroanalisis.
  function _ultimaFechaPorAnalito(labsArray, opciones) {
      const uroPorComponentes = !!(opciones && opciones.uroanalisisPorComponentes);
      const candidatos = new Map();
      let pendientesWhitelist = 0;
      if (!Array.isArray(labsArray)) return { candidatos, pendientesWhitelist };
      labsArray.forEach((lab) => {
          let matched = _matchLabInWhitelist(lab);
          if (!matched && uroPorComponentes && _WHITELIST_UROANALISIS && _matchUroComponente(lab)) {
              matched = _WHITELIST_UROANALISIS;
          }
          if (!matched) return;
          const resultVal = _valorCrudoLab(lab.Resultado) ?? _valorCrudoLab(lab.resultado) ?? _valorCrudoLab(lab.valor);
          if (resultVal === undefined) return;
          // v11.0.1 — Un analito que aún NO tiene resultado ("PENDIENTE", o estado 1 en
          // Athenea) no cuenta como candidato: escribirlo sería mostrar un resultado que
          // todavía no existe.
          if (Number(lab.idEstado) === 1 || String(resultVal).trim().toUpperCase() === "PENDIENTE") { pendientesWhitelist++; return; }
          const fechaInfo = _extractAtheneaFecha(lab);
          const resultDate = fechaInfo ? fechaInfo.iso : null;
          const previo = candidatos.get(matched.key);
          if (previo && !(resultDate && (!previo.resultDate || resultDate > previo.resultDate))) {
              // Repetición del mismo analito con fecha igual, más vieja, o sin fecha frente
              // a un candidato que ya tiene una: se descarta, avisando una sola vez.
              if (!_avisoCasillaYaEscrita.has(matched.key)) { _avisoCasillaYaEscrita.add(matched.key); console.warn("[Vigilante] repetición del mismo analito, se conserva la fecha más reciente:", matched.key); }
              return;
          }
          candidatos.set(matched.key, { lab, matched, resultVal, fechaInfo, resultDate });
      });
      return { candidatos, pendientesWhitelist };
  }

  // v14.1.5 — GUARDA DE IDENTIDAD DEL PACIENTE. Devuelve `true` solo si el paciente
  // abierto en el DOM AHORA MISMO sigue siendo aquel para el que se pidieron los datos.
  // Sin `docIdEsperado` no puede opinar y deja pasar: eso es para los tests, que montan
  // un DOM sin cabecera de paciente. TODA llamada de producción tiene que pasarlo — hay
  // una prueba que lee este archivo y falla si algún llamador se lo olvida.
  function _pacienteSigueAbierto(docIdEsperado) {
      if (!docIdEsperado) return true;
      const actual = (typeof extractPacienteAbierto === "function") ? extractPacienteAbierto() : "";
      // Si el DOM no deja leer la cédula (Angular re-renderizando la cabecera) NO se
      // asume que sigue siendo el mismo: escribir a ciegas es justo lo que se evita.
      return !!actual && String(actual) === String(docIdEsperado);
  }

  // v14.1.5 — CRUCE DE PACIENTES (hallazgo de auditoría; el riesgo clínico más alto que
  // ha tenido este script). `docIdEsperado` es la cédula que estaba abierta cuando se
  // PIDIERON estos resultados. Entre esa petición y esta escritura pasan 2-4 s de red
  // contra Athenea, y en ese lapso el médico puede haber abierto otra historia: Angular
  // monta las casillas del paciente NUEVO y esta función, que busca por id global en el
  // documento, las encontraría y les escribiría los laboratorios del paciente ANTERIOR.
  // En un caso real eso es asentar la falla renal de uno en la historia del otro, y al
  // guardar queda en firme. Los reintentos diferidos (300/900 ms) vuelven a comprobarlo
  // por su cuenta: disparan MÁS TARDE todavía, así que están aún más expuestos.
  // v14.1.8 — ¿Se puede escribir este valor en la casilla, según la tabla OFICIAL de la
  // IPS? Devuelve null cuando no hay nada que objetar (y entonces se escribe como
  // siempre), o el veredicto cuando el valor es IMPLAUSIBLE y hay que negarse.
  //
  // El criterio de "negarse" y no "escribir y avisar" es el mismo que rige el resto del
  // proyecto: no escribir es recuperable —el médico ve el analito marcado y lo escribe a
  // mano sabiendo por qué—, escribir un número equivocado no lo es. El caso que esto
  // ataca es concreto y ya mordió a este script: una creatinina reportada en µmol/L llega
  // como 88 donde se espera 1,0 mg/dL. La guarda de v14.1.3 impidió que ese 88 se
  // convirtiera en un estadio renal falso, pero Auto-Labs seguía escribiéndolo en la
  // casilla tal cual, y de ahí se guarda en la historia.
  //
  // Sólo se juzga cuando hay las tres cosas: tabla oficial, regla aplicable a ESTE
  // paciente y un número de verdad. Un "> 300" o un "PENDIENTE" no se juzgan (no hay
  // número que comparar) y siguen su camino de siempre.
  function _objecionOficialAlValor(labKey, resultValCrudo, opts) {
      const o = opts || {};
      // Basta con comprobar que sea un arreglo: si viene vacío, `_reglasParaLabKey`
      // devuelve [] y la salida de dos líneas más abajo lo atrapa igual. Aquí había
      // además un `|| !o.tablaOficial.length` que una mutación demostró REDUNDANTE
      // —quitarlo no ponía roja ni una prueba, y no porque faltara una aserción, sino
      // porque no cambiaba nada. Una guarda que aparenta sujetar algo y no sujeta nada
      // es peor que no tenerla: la próxima persona la lee como load-bearing.
      if (!Array.isArray(o.tablaOficial)) return null;
      const n = _labNumerico(resultValCrudo);
      if (n == null) return null;
      const reglas = _reglasParaLabKey(o.tablaOficial, labKey, { edad: o.edad, sexo: o.sexo });
      if (!reglas.length) return null;
      const v = _plausibilidadOficial(n, reglas);
      if (v.estado !== "bajo" && v.estado !== "alto") return null;
      return { key: labKey, valor: String(resultValCrudo), estado: v.estado, unidad: v.unidad, min: v.min, max: v.max, mensaje: v.mensaje };
  }

  // v14.1.8 — El aviso al médico cuando un valor NO se escribió por implausible.
  //
  // Dice tres cosas y ninguna más: qué llegó, qué esperaba la IPS y en qué unidad. NO
  // dice "está mal", NO propone un valor corregido y NO convierte unidades — sugerir la
  // conversión sería justo lo que este proyecto prohíbe, porque la sospecha de unidad es
  // una sospecha, no un hecho, y el número "corregido" acabaría escrito en una historia
  // clínica sin que nadie lo hubiera comprobado en el laboratorio.
  function _textoImplausibles(lista) {
      if (!Array.isArray(lista) || !lista.length) return "";
      const lineas = lista.map((o) => {
          const rango = (o.min == null ? "?" : o.min) + "\u2013" + (o.max == null ? "?" : o.max) + (o.unidad ? " " + o.unidad : "");
          return "   \u00b7 " + o.key + ": lleg\u00f3 \"" + o.valor + "\" y la IPS espera " + rango
               + (o.mensaje ? " (" + o.mensaje + ")" : "");
      });
      return "\n\n\ud83d\udeab " + lista.length + " resultado(s) NO se escribieron porque est\u00e1n fuera del rango que la propia IPS"
           + " tiene parametrizado para ese examen:\n" + lineas.join("\n")
           + "\n\n   Suele ser una unidad distinta a la que espera la casilla, o un error de digitaci\u00f3n en el"
           + " laboratorio. Verif\u00edquelo y escr\u00edbalo a mano si el valor es correcto.";
  }

  // v14.1.8 — Reúne lo que hace falta para juzgar un valor contra la tabla oficial: la
  // tabla que Everest ya cargó en esta vista, y la edad/sexo del paciente.
  //
  // Nada de esto es obligatorio, y ese es el punto: si no hay tabla, o si no se pudo leer
  // la demografía, se devuelve lo que haya y `_objecionOficialAlValor` no objeta nada.
  // Auto-Labs se comporta EXACTAMENTE como antes de v14.1.8. Ninguna de estas dos
  // consultas puede impedir que el médico llene su historia.
  //
  // Consecuencia que conviene tener presente en vez de esconderla: de las 28 reglas
  // reales, la ÚNICA que acota por edad es HEMOGLOBINA (0–110 años). Si la demografía no
  // se puede leer, la hemoglobina se queda sin rango oficial y no se juzga — que es lo
  // correcto, pero significa que el analito del rango más llamativo es justo el que más
  // depende de que esa consulta funcione.
  async function _contextoOficialParaLabs(docId) {
      const ctx = { tablaOficial: _tablaOficialVigente(), edad: null, sexo: "" };
      try {
          const pid = await apiAccesoBuscarPaciente(docId);
          if (pid) {
              const demo = await apiAccesoObtenerDemograficos(pid);
              if (demo) { ctx.edad = demo.edad; ctx.sexo = demo.sexo; }
          }
      } catch (e) { /* sin demografía se juzga menos, nunca peor */ }
      return ctx;
  }

  function injectLabsIntoCronicos(labsArray, docIdEsperado, opts) {
      if (state.killed) {
          return { count: 0, pendientes: 0, sinCasilla: [], respetadas: 0, uroanalisisMarcado: false, implausibles: [], abortadoPorKillSwitch: true };
      }
      if (state.disabledFeatures && state.disabledFeatures.has("autoLabs")) {
          return { count: 0, pendientes: 0, sinCasilla: [], respetadas: 0, uroanalisisMarcado: false, implausibles: [], desactivadoRemoto: true };
      }
      let count = 0;
      let pendientes = 0;
      let respetadas = 0;
      const sinCasilla = [];
      const implausibles = [];
      const yaEscritas = new Set();
      if (!Array.isArray(labsArray)) return { count: 0, pendientes: 0, sinCasilla: [], respetadas: 0, uroanalisisMarcado: false, implausibles: [] };
      if (!_pacienteSigueAbierto(docIdEsperado)) {
          console.warn("[Vigilante] Auto-Labs ABORTADO: el paciente abierto cambió mientras Athenea respondía. No se escribió ninguna casilla.");
          return { count: 0, pendientes: 0, sinCasilla: [], respetadas: 0, uroanalisisMarcado: false, implausibles: [], abortadoPorPaciente: true };
      }
      // v12.5.11 — se enciende en cuanto Athenea confirma AL MENOS un componente real
      // (no vacío, no PENDIENTE) del parcial de orina — la misma condición que ya decide
      // si ese componente se escribe en su casilla. Es la evidencia de que el uroanálisis
      // SÍ se hizo, así que el interruptor SI se marca aunque la casilla puntual de algún
      // componente no se haya encontrado en esta vista.
      let uroanalisisConfirmadoReal = false;

      // v12.3.37 — Componentes del uroanálisis: cada uno va a SU casilla propia (anclada
      // al placeholder visible), nunca al whitelist de suero. Mismas reglas sagradas del
      // resto de casillas: se escribe VERBATIM lo que entrega Athenea, solo en casilla
      // VACÍA; un valor distinto del médico se respeta entero; y el primer valor gana —
      // las solicitudes llegan de más reciente a más antigua, así que el primero ES el
      // resultado más reciente y los anteriores se omiten (pedido explícito del médico).
      const escritorPorMarca = new Map();
      // v12.6.7 — El "SI" se marca AQUÍ, antes de buscar una sola casilla: es lo que hace
      // aparecer el bloque entero (Angular lo monta con *ngIf). El orden anterior —marcar
      // al final— garantizaba que la primera corrida no encontrara ninguna de las 7
      // casillas de componente.
      uroanalisisConfirmadoReal = _hayComponenteUroReal(labsArray);
      const uroanalisisMarcado = uroanalisisConfirmadoReal ? _marcarUroanalisisSi() : false;
      // Casillas que no existían ni siquiera después de marcar SI: se reintentan abajo,
      // porque el re-render del *ngIf no es síncrono con el click.
      const reintentosOrina = new Map();
      const inyectarComponenteOrina = (lab) => {
          const nombreCanon = _canonTexto(lab.NombreParametro || lab.nombre || lab.examen);
          const comp = _matchUroComponente(lab);
          const marca = comp ? "URO_" + comp.key : null;
          const reclamar = () => { if (marca) { yaEscritas.add(marca); escritorPorMarca.set(marca, nombreCanon); } };
          const resultVal = lab.Resultado || lab.resultado || lab.valor;
          // Revisión adversarial de v12.3.37: el analito MÁS RECIENTE reclama su casilla
          // aunque llegue vacío o PENDIENTE. Sin esto, un duplicado de hace meses del mismo
          // componente la llenaba con un dato viejo — indetectable, porque estas 7 casillas
          // no tienen fecha acompañante — y en la corrida siguiente el resultado nuevo
          // quedaba "respetado" como si fuera del médico: el dato viejo se volvía permanente.
          if (!resultVal) { reclamar(); return; }
          if (Number(lab.idEstado) === 1 || String(resultVal).trim().toUpperCase() === "PENDIENTE") {
              pendientes++;
              reclamar();
              return;
          }
          if (!comp) return; // nombre aún sin confirmar: casilla vacía; el diagnóstico de orina ya mostró el nombre real
          uroanalisisConfirmadoReal = true;
          if (yaEscritas.has(marca)) {
              // Dos analitos DISTINTOS compitiendo por la misma casilla (tira reactiva vs.
              // sedimento, subtipos de cilindros): manda el más reciente y se AVISA una vez
              // por sesión, como en la ruta sérica — nunca una omisión muda.
              const escritor = escritorPorMarca.get(marca);
              const avisoKey = marca + "|" + nombreCanon;
              if (escritor && escritor !== nombreCanon && !_avisoCasillaYaEscrita.has(avisoKey)) {
                  _avisoCasillaYaEscrita.add(avisoKey);
                  console.warn("[Vigilante] casilla de uroanálisis ya reclamada por otro analito, se conserva el más reciente:", marca, "· omitido:", nombreCanon);
              }
              return;
          }
          const inputEl = _findUroInput(comp.placeholder);
          if (!inputEl) {
              if (!sinCasilla.includes(marca)) sinCasilla.push(marca);
              // El primero que llega es el más reciente (ver arriba): es el que se
              // reintentará, nunca uno más viejo.
              if (!reintentosOrina.has(marca)) reintentosOrina.set(marca, { comp, resultVal });
              return;
          }
          const valorActual = String(inputEl.value == null ? "" : inputEl.value).trim();
          if (valorActual !== "" && valorActual !== String(resultVal).trim()) { respetadas++; reclamar(); return; }
          if (valorActual === "") { setNgValue(inputEl, resultVal); count++; } else { respetadas++; }
          reclamar();
      };

      // v12.3.37 — Diagnóstico de orina y componentes por su ruta propia (no whitelist
      // sérico): sigue recorriendo labsArray directamente, sin pasar por el agrupador.
      labsArray.forEach((lab) => {
          if (_esAnalitoDeOrina(lab) && !_diagUroNombresVistos.has(_canonTexto(lab.NombreParametro || lab.nombre || lab.examen))) {
              try {
                  const deOrinaTodos = labsArray.filter(_esAnalitoDeOrina);
                  deOrinaTodos.forEach((l) => _diagUroNombresVistos.add(_canonTexto(l.NombreParametro || l.nombre || l.examen)));
                  console.log("[Vigilante] diagnóstico uroanálisis — analitos de orina recibidos de Athenea:",
                      JSON.stringify(deOrinaTodos.map((l) => ({
                          nombre: l.NombreParametro || l.nombre || l.examen || "",
                          padre: l.NombreParametroPadre || l.nombreParametroPadre || "",
                          resultado: String(l.Resultado || l.resultado || l.valor || ""),
                          idNormalidad: l.IdNormalidad !== undefined ? l.IdNormalidad : l.idNormalidad,
                          idEstado: l.idEstado
                      }))));
              } catch (e) {}
          }
          // Filtro estricto: solo los 13 laboratorios autorizados (whitelist sérico, ver
          // abajo)… y, desde v12.3.37, los componentes del panel de orina por su ruta propia.
          if (!_matchLabInWhitelist(lab) && _esAnalitoDeOrina(lab)) inyectarComponenteOrina(lab);
      });

      // v12.5.11 — Con al menos un componente real confirmado se marca "SI" en el
      // interruptor "¿Uroanálisis?", solo si el médico no lo había elegido ya (ver
      // _marcarUroanalisisSi). Desde v12.6.7 eso ocurre ARRIBA, antes de buscar casillas.
      // El interruptor NORMAL/ANORMAL sigue SIN automatizarse: misma regla de la casa,
      // ante la duda no se inventa.

      // v12.5.6 — CAMBIO PEDIDO POR EL MÉDICO: antes "el primero de la lista gana" (el
      // resto se descartaba con solo un aviso), asumiendo que Athenea siempre entrega las
      // solicitudes de más reciente a más antigua — un supuesto de ORDEN, no una
      // comparación real de fechas. Ahora GANA la repetición con la FECHA más reciente de
      // verdad (v12.5.7 — extraído a _ultimaFechaPorAnalito para compartirlo con el aviso
      // de laboratorios vencidos). Con la ventana de Athenea ya acotada por tarjeta
      // (v12.5.5), varias solicitudes del mismo analito ya no se cruzan entre sí — esto
      // solo decide, con evidencia real, cuál de ellas es la vigente para Crónicos.
      const { candidatos: candidatosPorClave, pendientesWhitelist } = _ultimaFechaPorAnalito(labsArray);
      pendientes += pendientesWhitelist;

      // v12.6.8 — DIAGNÓSTICO ÚNICO POR SESIÓN: qué trajo Athenea que NO casó con ninguno
      // de los 13 analitos ni con un componente del parcial de orina. Reportado en
      // consultorio: una paciente con resultado real de RAC (6.93 mg/gr en el PDF del
      // laboratorio) no se completó en la historia. Un analito que no casa desaparece hoy
      // en silencio: no se cuenta, no se avisa y no hay forma de saber con qué nombre
      // exacto llegó. Con esta línea, el siguiente reporte del médico trae el nombre real
      // y se agrega a la lista con evidencia, nunca por adivinanza. Solo nombre, código y
      // resultado — jamás datos del paciente.
      if (!_diagLabsSinCasarLogged) {
          try {
              const sinCasar = labsArray.filter((l) => l && !_matchLabInWhitelist(l) && !_matchUroComponente(l));
              if (sinCasar.length) {
                  _diagLabsSinCasarLogged = true;
                  console.log("[Vigilante] diagnóstico: analitos de Athenea que NO casaron con ningún examen conocido:",
                      JSON.stringify(sinCasar.map((l) => ({
                          nombre: l.NombreParametro || l.nombre || l.examen || "",
                          padre: l.NombreParametroPadre || l.nombreParametroPadre || "",
                          codigo: String(l.CodigoParametro || l.codigo || ""),
                          resultado: String(l.Resultado || l.resultado || l.valor || "")
                      }))));
              }
          } catch (e) {}
      }

      candidatosPorClave.forEach(({ lab, matched, resultVal, fechaInfo, resultDate }) => {
          // v11.0.1 — La fecha ya NO se rellena con la de HOY cuando el laboratorio no la
          // trae: eso convertía un resultado de hace meses en uno "de hoy" dentro de la
          // historia clínica. Si no hay fecha real, la casilla queda vacía para que el
          // médico la escriba.
          if (fechaInfo && !_diagLabFechaKeyFound && !_CAMPOS_FECHA_CONOCIDOS.includes(fechaInfo.key)) {
              _diagLabFechaKeyFound = true;
              console.log("[Vigilante] fecha de Athenea detectada por forma del valor, clave real:", fechaInfo.key, "→", fechaInfo.iso);
          }
          if (!resultDate && !_diagLabFechaLogged) {
              _diagLabFechaLogged = true;
              console.warn("[Vigilante] diagnóstico: no se reconoció ninguna fecha (ni por nombre ni por forma) en el resultado de Athenea. Claves disponibles:", Object.keys(lab), lab);
          }

          // v12.3.26 — HBA1C toma una ruta de búsqueda propia (ver _findHbA1cFields): su
          // id/name choca con el de "Hemoglobina" normal en el DOM de Everest, así que
          // _findLabField (basada en getElementById/[name=]) siempre encontraría la
          // casilla equivocada para este analito en particular.
          let inputEl, dateInput;
          if (matched.key === "HBA1C") {
              const campos = _findHbA1cFields();
              inputEl = campos.resultEl;
              dateInput = campos.dateEl;
          } else {
              inputEl = _findLabField(matched.resultId, matched.altIds);
              // v12.3.31 — CONFIRMADO en consultorio real (2026-08-11): con solo el id
              // estático (dateId/altDateIds del whitelist) el VALOR se escribía bien pero
              // la FECHA nunca aparecía para NINGÚN analito — porque, a diferencia de
              // resultId (verificado contra el DOM real en v12.0.4), esos dateId NUNCA se
              // confirmaron: son un nombre construido por convención ("fechaResult" + el
              // mismo sufijo), nunca comprobado. El propio comentario de _findHbA1cFields
              // ya documenta que la fecha vive como HERMANA del resultado dentro del mismo
              // .input-group "en TODOS los pares resultado+fecha de esta vista" — así que
              // se generaliza esa misma búsqueda dinámica aquí, con el id estático como
              // respaldo solo si esa estructura no aparece.
              const grupo = inputEl && inputEl.closest ? inputEl.closest(".input-group") : null;
              dateInput = (grupo && grupo.querySelector("input[type=\"date\"]")) || (inputEl ? _findLabField(matched.dateId, matched.altDateIds) : null);
          }

          if (inputEl) {
              // v12.3.34 — LA CASILLA DEL MÉDICO ES SAGRADA. Reportado en consultorio: el
              // robot repetido reescribía valores que el médico había borrado o corregido.
              // v12.3.35 — afinado en revisión adversarial: la guarda cubre valor Y fecha
              // por separado. Un valor DISTINTO al de Athenea (escrito por el médico) se
              // respeta entero, incluida su fecha; un valor IGUAL al de Athenea (escrito
              // por una corrida anterior) no se reescribe pero SÍ permite completar una
              // fecha que quedó vacía; y la fecha solo se escribe cuando su casilla está
              // VACÍA — una fecha corregida a mano por el médico no se pisa jamás.
              const valorActual = String(inputEl.value == null ? "" : inputEl.value).trim();
              const mismoValor = valorActual !== "" && valorActual === String(resultVal).trim();
              if (valorActual !== "" && !mismoValor) {
                  respetadas++;
                  return;
              }
              if (valorActual === "") {
                  // v14.1.8 — La tabla oficial de la IPS manda ANTES de escribir. Un valor
                  // implausible no se escribe: se reporta para que el médico lo ponga a
                  // mano sabiendo qué rango esperaba Everest y en qué unidad.
                  const objecion = _objecionOficialAlValor(matched.key, resultVal, opts);
                  if (objecion) {
                      implausibles.push(objecion);
                      console.warn("[Vigilante] Auto-Labs NO escribió " + matched.key + " = " + resultVal
                        + ": fuera del rango que la IPS declara (" + objecion.min + "–" + objecion.max
                        + (objecion.unidad ? " " + objecion.unidad : "") + ").");
                      return;
                  }
                  setNgValue(inputEl, resultVal);
                  count++;
                  if (matched.key === "RAC") {
                      // v14.1.5 — la guarda nace con reloj y con cupo (ver checkRacGuardia).
                      _racGuardia = { activa: true, docId: (typeof extractPacienteAbierto === "function") ? extractPacienteAbierto() : "", valor: resultVal, ts: Date.now(), restauraciones: 0 };
                  }
              } else {
                  respetadas++;
              }
          } else {
              sinCasilla.push(matched.key);   // el campo no existe en esta vista: hay que avisarlo
              return;
          }

          // v12.3.31 — diagnóstico UNO POR ANALITO (antes era una sola bandera global, que
          // se apagaba con el primer analito y dejaba a ciegas el resto). Si tras el arreglo
          // de arriba la fecha SIGUE sin aparecer para algún laboratorio puntual, esta línea
          // dice exactamente si el problema es "no hay dateInput" (el .input-group no tiene
          // <input type="date">, ni tampoco el id estático) o "no hay resultDate" (Athenea no
          // trae ninguna fecha reconocible para ese analito en particular).
          if (!_diagLabFechaPorCasilla.has(matched.key)) {
              _diagLabFechaPorCasilla.add(matched.key);
              console.log(`[Vigilante] diagnóstico fecha — ${matched.key}: dateInput ${dateInput ? "SÍ encontrado" : "NO encontrado"}, resultDate ${resultDate ? "= " + resultDate : "= null"}`);
          }

          // v12.3.35 — la fecha SOLO se escribe en una casilla de fecha VACÍA: si el
          // médico la corrigió a mano (p. ej. la fecha real de la toma), se respeta.
          if (dateInput && resultDate && String(dateInput.value == null ? "" : dateInput.value).trim() === "") {
              setNgValue(dateInput, resultDate);
          }
          // v12.4.0 — La casilla de fecha de Everest es <input type="date"> y NO puede
          // llevar hora. Cuando Athenea la trae, se deja visible como tooltip en ambas
          // casillas (pasar el mouse la muestra): el médico ya no tiene que abrir el
          // portal solo para saber a qué hora fue la toma.
          try {
              if (fechaInfo && fechaInfo.hora) {
                  const p = fechaInfo.iso.split("-");
                  const titulo = `Athenea: ${p[2]}/${p[1]}/${p[0]} a las ${fechaInfo.hora}`;
                  if (dateInput && !dateInput.title) dateInput.title = titulo;
                  if (inputEl && !inputEl.title) inputEl.title = titulo;
              }
          } catch (e) {}
      });

      // v12.5.12 — CASILLA DE RESULTADO DEL UROANÁLISIS (confirmada en campo, HTML real
      // pegado en consultorio): `resultadoUroanalisis`/`fechaResultUroanalisis` — los
      // mismos resultId/dateId que ya llevaba WHITELIST_13_LABS desde siempre — SOLO
      // existen en el DOM cuando "¿Uroanálisis?" está en SI (Angular la monta con
      // *ngIf). El bucle de arriba ya intentó escribirla por el camino genérico; si
      // JUSTO en esta corrida se acaba de hacer click en SI (uroanalisisMarcado), es
      // posible que Angular todavía no la haya montado en ese mismo instante síncrono.
      // Un único reintento corto (300 ms) le da tiempo al *ngIf sin bloquear nada: si
      // para entonces la casilla sigue sin aparecer, se deja como estaba (el aviso
      // "sin casilla" ya se mostró) — el médico la llena a mano o vuelve a pulsar
      // Auto-Labs (con SI ya marcado, el camino genérico de arriba la encuentra directo).
      // Mismas reglas sagradas de siempre: verbatim, solo si la casilla sigue vacía.
      // v12.6.7 — Mismo reintento acotado para las 7 casillas de COMPONENTE (Nitritos,
      // Sangre, Hematíes, Glucosuria, Leucocitos, Cilindros, Proteinuria). Ya se marcó SI
      // arriba, pero el re-render del *ngIf de Angular no es síncrono con el click: si en
      // esa misma corrida las casillas aún no existían, se vuelven a buscar dos veces
      // (300 ms y 900 ms) y se abandona. Reglas de siempre: verbatim, solo en casilla
      // vacía, y nunca un valor más viejo (se guardó el primero, que es el más reciente).
      if (uroanalisisMarcado && reintentosOrina.size) {
          const intentarOrina = (intento) => {
              // v14.1.5 — este temporizador dispara 300-900 ms DESPUÉS del clic: para
              // entonces el médico ya pudo haber abierto otra historia. Se recomprueba.
              if (!_pacienteSigueAbierto(docIdEsperado)) {
                  console.warn("[Vigilante] uroanálisis: reintento cancelado, el paciente abierto cambió.");
                  reintentosOrina.clear();
                  return;
              }
              let escritas = 0;
              for (const [marca, r] of [...reintentosOrina]) {
                  const el = _findUroInput(r.comp.placeholder);
                  if (!el) continue;
                  reintentosOrina.delete(marca);
                  const actual = String(el.value == null ? "" : el.value).trim();
                  if (actual === "") { setNgValue(el, r.resultVal); escritas++; }
              }
              if (escritas) console.log("[Vigilante] uroanálisis: " + escritas + " casilla(s) de componente completadas tras reintento (Angular tardó en montarlas después de marcar SI).");
              if (!reintentosOrina.size) return;
              if (intento < 2) setTimeout(() => intentarOrina(intento + 1), 600);
              else console.warn("[Vigilante] uroanálisis: estas casillas de componente no aparecieron tras marcar SI:", [...reintentosOrina.keys()].join(", "));
          };
          setTimeout(() => intentarOrina(1), 300);
      }

      const uroCandidato = candidatosPorClave.get("UROANALISIS");
      if (uroCandidato && sinCasilla.includes("UROANALISIS") && uroanalisisMarcado) {
          const { matched, resultVal, resultDate } = uroCandidato;
          setTimeout(() => {
              try {
                  // v14.1.5 — misma guarda que el reintento de componentes: 300 ms después
                  // del clic el paciente abierto puede ser otro.
                  if (!_pacienteSigueAbierto(docIdEsperado)) {
                      console.warn("[Vigilante] uroanálisis: reintento cancelado, el paciente abierto cambió.");
                      return;
                  }
                  const inputEl = _findLabField(matched.resultId, matched.altIds);
                  if (!inputEl) {
                      console.warn("[Vigilante] uroanálisis: la casilla de resultado sigue sin aparecer tras marcar SI — revise a mano o vuelva a pulsar Auto-Labs.");
                      return;
                  }
                  // v14.0.0 — BUG REAL REPORTADO EN CONSULTA (dos veces): "Auto-Labs no pone
                  // la fecha del uroanálisis". La causa estaba aquí: este reintento salía con
                  // `if (valorActual !== "") return;` en cuanto la casilla de RESULTADO ya
                  // tenía algo — y se llevaba por delante la escritura de la FECHA, aunque su
                  // casilla estuviera vacía. Basta con que el resultado se haya puesto en una
                  // corrida anterior (o por el camino de componentes) para que la fecha no se
                  // escriba NUNCA por más veces que se pulse el botón.
                  // El camino principal ya resolvió esto en v12.3.35 separando valor y fecha;
                  // a este reintento no se le aplicó. Se replica aquí la MISMA regla:
                  //   · valor DISTINTO al de Athenea -> lo escribió el médico: se respeta
                  //     entero, incluida su fecha. La casilla del médico es sagrada.
                  //   · valor IGUAL al de Athenea (corrida anterior) -> no se reescribe, pero
                  //     SÍ se completa la fecha si quedó vacía.
                  //   · casilla vacía -> se escriben valor y fecha.
                  const valorActual = String(inputEl.value == null ? "" : inputEl.value).trim();
                  const mismoValor = valorActual !== "" && valorActual === String(resultVal).trim();
                  if (valorActual !== "" && !mismoValor) return; // valor propio del médico: no se toca nada
                  if (valorActual === "") setNgValue(inputEl, resultVal);
                  const grupo = inputEl.closest ? inputEl.closest(".input-group") : null;
                  const dateInput = (grupo && grupo.querySelector('input[type="date"]')) || _findLabField(matched.dateId, matched.altDateIds);
                  const fechaVacia = dateInput && String(dateInput.value == null ? "" : dateInput.value).trim() === "";
                  if (dateInput && resultDate && fechaVacia) setNgValue(dateInput, resultDate);
                  // Diagnóstico dirigido: si la fecha SIGUE sin escribirse, esto dice por cuál
                  // de las tres razones posibles, en vez de dejar al médico adivinando.
                  if (!resultDate) {
                      console.warn("[Vigilante] uroanálisis: no se escribió la fecha porque Athenea NO trajo fecha para este uroanálisis (resultDate = null). Los componentes de orina pueden venir sin fecha propia aunque el examen padre sí la tenga.");
                  } else if (!dateInput) {
                      console.warn("[Vigilante] uroanálisis: no se escribió la fecha porque NO se encontró su casilla (ni como hermana input[type=date] del .input-group, ni por el id " + matched.dateId + ").");
                  } else if (!fechaVacia) {
                      console.log("[Vigilante] uroanálisis: la fecha ya tenía valor, se respeta la del médico.");
                  }
                  console.log("[Vigilante] uroanálisis: casilla de resultado completada tras reintento (Angular tardó en mostrarla después de marcar SI).");
              } catch (e) {}
          }, 300);
      }

      return { count, pendientes, sinCasilla, respetadas, uroanalisisMarcado, implausibles };
  }

  // =====================================================================
  //  v12.5.7 — AVISO DE LABORATORIOS RCV SIN RESULTADO EN 180 DÍAS
  //  Pedido explícito del médico (11-08-2026): a TODO paciente se le debe buscar el
  //  analito MÁS RECIENTE de este grupo de 7 — si a alguno le falta un resultado
  //  vigente (dentro de los últimos 180 días), avisar en ROJO al abrir su historia.
  //  HbA1c se sigue extrayendo (whitelist de siempre) pero, por pedido explícito,
  //  NUNCA entra en esta regla de vigencia (no todo paciente es diabético). PTH,
  //  Hemoglobina, Fósforo y Albúmina NO entran aquí tampoco: esos solo se
  //  autocompletan en Everest si Athenea los trae, y si no, se omiten sin aviso —
  //  eso ya lo hace injectLabsIntoCronicos con el whitelist completo, sin cambios.
  // =====================================================================
  const RCV_VIGENCIA_DIAS = 180;
  // v14.1.4 — LDL AÑADIDO A LA VIGILANCIA (decisión del médico, 14-ago-2026). Estaba en
  // WHITELIST_13_LABS (se leía), en PYM_CATALOG (se podía ordenar) y en la tabla de
  // vigencias por estadio (180 días)… pero NO aquí, que es la lista de lo que el script
  // avisa cuando vence. Resultado: un LDL vencido no generaba ninguna alerta — un punto
  // ciego justo en el analito que fija la meta terapéutica del riesgo cardiovascular.
  const RCV_VIGENCIA_KEYS = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS", "GLUCOSA", "UROANALISIS", "CREATININA", "RAC"];
  const RCV_VIGENCIA_NOMBRES = {
      COLESTEROL_TOTAL: "Colesterol Total",
      COLESTEROL_HDL: "Colesterol HDL",
      COLESTEROL_LDL: "Colesterol LDL",
      TRIGLICERIDOS: "Triglicéridos",
      GLUCOSA: "Glucosa en Suero",
      UROANALISIS: "Uroanálisis",
      CREATININA: "Creatinina en Suero",
      RAC: "RAC (Relación Albúmina/Creatinina)",
  };
  // v12.6.0 — RAC (relación albúmina/creatinina) con albuminuria franca (≥30 mg/g) pide
  // control más frecuente que los demás analitos del grupo: su vigencia se reduce a la
  // mitad (90 días en vez de 180). Los demás analitos, y un RAC por debajo del umbral,
  // conservan los 180 días normales.
  const RAC_VIGENCIA_UMBRAL_ALBUMINURIA = 30; // mg/g
  // v14.1.0 — R1b. Convierte a número el resultado crudo de un laboratorio numérico.
  // Es el MISMO saneo que _vigenciaDiasParaAnalito ya aplicaba solo a la RAC (ver abajo),
  // extraído para reutilizarlo: los LIS reportan fuera de rango con desigualdad ("> 300",
  // "< 0,3") y con coma decimal, y `Number("> 300")` es NaN. Devuelve null —nunca 0, que
  // en una creatinina sería un valor "válido" y catastrófico— cuando no hay número real.
  function _labNumerico(crudo) {
      const txt = String(crudo == null ? "" : crudo);
      // Un signo negativo se PIERDE al quitar todo lo que no sea dígito/coma/punto, así que
      // "-1.2" saldría convertido en 1.2 — un valor plausible donde en realidad había basura.
      // Ningún analito de esta lista puede ser negativo: se rechaza de plano.
      if (/-\s*\d/.test(txt)) return null;
      const limpio = txt.replace(/[^\d.,]/g, "").replace(",", ".");
      if (!limpio) return null;
      const n = Number(limpio);
      return Number.isFinite(n) && n > 0 ? n : null;
  }
  // =====================================================================
  //  v14.1.8 — RANGOS Y UNIDADES OFICIALES, LEÍDOS DE EVEREST
  //
  //  Everest publica en `GetValidacionExamenCronicos?citaId=` una tabla de validación por
  //  examen. Campos OBSERVADOS en la captura real del 12-08-2026 (28 filas):
  //  `codigoExamen`, `sexo`, `edadMin`, `edadMax`, `valorMinimo`, `valorMaximo`,
  //  `swRequerido` y `unidad`. `codigoExamen` NO es un CUPS: es el nombre interno del
  //  campo ("HEMOGLOBINA", "HBA1C", "RELACION_ALBUMINURIA_CREATININA").
  //
  //  Cuidado con la forma: `sexo` llegó como null en una fila y AUSENTE en las otras 27, y
  //  `edadMin`/`edadMax` solo venían en HEMOGLOBINA. Los dos casos —null y ausente— tienen
  //  que dar el mismo resultado, y por eso nada aquí usa `Number()` a secas.
  //  `mensajeMinimo`/`mensajeMaximo` NO aparecen en la captura: se leen por si la IPS los
  //  activa, y mientras no estén el mensaje sale vacío. Eso es compatibilidad hacia
  //  adelante, no un campo observado.
  //
  //  Por qué vale más que una tabla escrita a mano:
  //
  //  · Trae la UNIDAD declarada. Es el dato que se llevaba pidiendo desde que se vio que
  //    la RAC puede venir en mg/g o en mg/mmol y que NINGUNA guarda de rango puede
  //    distinguirlas: 15 mg/mmol y 15 mg/g son igual de plausibles y significan cosas
  //    opuestas — nefropatía franca una, normalidad la otra.
  //  · Los rangos son de la propia IPS y varían por SEXO y EDAD, cosa que una tabla fija
  //    no hace: el límite bajo de hemoglobina de una mujer no es el de un hombre.
  //  · No se desactualiza sola. Si la IPS cambia un criterio, el script obedece sin que
  //    nadie tenga que acordarse de editar una constante.
  //
  //  LA REGLA QUE GOBIERNA TODO ESTO: ante la duda, la regla NO se aplica. Una fila cuyo
  //  sexo no se reconozca, o que acote por edad cuando la del paciente no se pudo leer, se
  //  descarta. Aplicar una regla que quizá no corresponde es peor que no aplicar ninguna:
  //  convertiría un valor legítimo en una alarma falsa, y a la tercera alarma falsa el
  //  médico deja de mirarlas.
  // =====================================================================

  // Número o null. NUNCA Number() a secas sobre datos de la API, y este es el motivo:
  // `Number(null)`, `Number("")`, `Number(" ")`, `Number([])` y `Number(false)` valen 0, no
  // NaN. Con `Number()` directo, una fila con `edadMin: null` —que es como Everest dice "no
  // acoto por edad"— se leía como "acoto desde los 0 años", y entonces la fila se
  // descartaba en todo paciente cuya edad no se hubiera podido leer. Peor todavía: una
  // fila con `valorMinimo: null, valorMaximo: null` se convertía en el rango [0, 0], que
  // declara ALTO cualquier valor positivo; y un resultado vacío ("" del LIS cuando el
  // laboratorio aún no ha llegado) se volvía el número 0, marcado BAJO en vez de "no hay
  // número que comparar". Tres alarmas falsas nacidas de la misma coerción.
  function _numeroEstricto(v) {
    if (v === null || v === undefined || typeof v === "boolean") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // ¿Esta fila de la tabla le corresponde a ESTE paciente? Conservadora a propósito.
  function _reglaExamenAplicable(fila, opts) {
    if (!fila || typeof fila !== "object") return false;
    const { edad, sexo } = (opts || {});

    // SEXO. Una fila sin sexo declarado vale para todos. Con sexo declarado tiene que
    // coincidir — y si lo que trae no se reconoce como M o F, la fila se descarta: no se
    // adivina a quién se refiere.
    const sexoFila = String(fila.sexo == null ? "" : fila.sexo).trim().toUpperCase();
    if (sexoFila && sexoFila !== "AMBOS" && sexoFila !== "A" && sexoFila !== "T") {
      const inicial = sexoFila.charAt(0);
      if (inicial !== "M" && inicial !== "F") return false;             // valor desconocido
      if (!String(sexo == null ? "" : sexo).trim()) return false;       // sin sexo del paciente
      if ((inicial === "F") !== _esSexoFemenino(sexo)) return false;
    }

    // EDAD. Solo se comprueba si la fila acota. Y si acota pero no sabemos la edad del
    // paciente, la fila NO se aplica: es justo el caso en que podría no corresponderle.
    const min = _numeroEstricto(fila.edadMin), max = _numeroEstricto(fila.edadMax);
    if (min !== null || max !== null) {
      const e = _numeroEstricto(edad);
      if (e === null) return false;
      if (min !== null && e < min) return false;
      if (max !== null && e > max) return false;
    }
    return true;
  }

  // Filas aplicables a un examen concreto. `codigoExamen` se compara como texto exacto
  // (sin espacios alrededor): un código clínico no se parece "un poco".
  function _reglasDeExamen(tabla, codigoExamen, opts) {
    if (!Array.isArray(tabla)) return [];
    const buscado = String(codigoExamen == null ? "" : codigoExamen).trim();
    if (!buscado) return [];
    return tabla.filter((f) =>
      f && String(f.codigoExamen == null ? "" : f.codigoExamen).trim() === buscado &&
      _reglaExamenAplicable(f, opts)
    );
  }

  // La unidad que Everest declara para ese examen. Si las filas aplicables NO coinciden
  // entre sí se devuelve null: dos unidades distintas para el mismo paciente son una
  // contradicción de la fuente, y elegir una sería exactamente adivinar.
  function _unidadOficialDeExamen(reglas) {
    if (!Array.isArray(reglas) || !reglas.length) return null;
    const unidades = new Set();
    for (const r of reglas) {
      const u = String(r && r.unidad != null ? r.unidad : "").trim();
      if (u) unidades.add(u);
    }
    return unidades.size === 1 ? [...unidades][0] : null;
  }

  // Veredicto de plausibilidad contra los rangos oficiales.
  //
  // Devuelve SIEMPRE un estado explícito, nunca null a secas, y esa es la diferencia que
  // más importa: "no hay regla para este examen" y "el valor se sale del rango" son cosas
  // distintas y el médico necesita distinguirlas. Fundirlas hace desaparecer el analito
  // como si el laboratorio no hubiera llegado nunca.
  function _plausibilidadOficial(valorNum, reglas) {
    const v = _numeroEstricto(valorNum);
    if (v === null) return { estado: "valor_no_numerico", unidad: null, min: null, max: null, mensaje: "" };
    if (!Array.isArray(reglas) || !reglas.length) return { estado: "sin_regla", unidad: null, min: null, max: null, mensaje: "" };

    const unidad = _unidadOficialDeExamen(reglas);
    // Con varias filas aplicables se toma la ENVOLVENTE: el rango más permisivo de todos.
    // Rechazar por el más estrecho marcaría como imposible un valor que alguna regla de la
    // propia IPS considera válido.
    let min = null, max = null, msgMin = "", msgMax = "";
    for (const r of reglas) {
      const a = _numeroEstricto(r.valorMinimo), b = _numeroEstricto(r.valorMaximo);
      if (a !== null && (min === null || a < min)) { min = a; msgMin = String(r.mensajeMinimo || ""); }
      if (b !== null && (max === null || b > max)) { max = b; msgMax = String(r.mensajeMaximo || ""); }
    }
    if (min === null && max === null) return { estado: "sin_regla", unidad, min: null, max: null, mensaje: "" };
    if (min !== null && v < min) return { estado: "bajo", unidad, min, max, mensaje: msgMin };
    if (max !== null && v > max) return { estado: "alto", unidad, min, max, mensaje: msgMax };
    return { estado: "dentro", unidad, min, max, mensaje: "" };
  }

  // ---------------------------------------------------------------------
  //  LO QUE LOS RANGOS DE EVEREST SON, Y LO QUE NO SON
  //
  //  Capturado en consultorio el 12-08-2026, la tabla real trae, entre otras:
  //      HEMOGLOBINA   3.0 – 30.0  g/dL
  //      CREATININA    0.2 – 20.0  mg/dL
  //      HBA1C         3.0 – 25.0  %
  //
  //  Una hemoglobina de 3.2 g/dL cae DENTRO y es una urgencia transfusional. Estos son
  //  rangos de PLAUSIBILIDAD —"¿este número puede ser un resultado de laboratorio de
  //  verdad, o es un dedazo / una unidad equivocada?"— y NO rangos de normalidad clínica.
  //  Por eso la función se llama `_plausibilidadOficial` y su estado bueno se llama
  //  "dentro" y no "normal": quien pinte "dentro" como "normal" estará tranquilizando al
  //  médico sobre un valor crítico. No se hace. Nunca.
  //
  //  Lo que sí resuelven, y era lo que se buscaba: la UNIDAD declarada por la IPS.
  //  `RELACION_ALBUMINURIA_CREATININA` viene en mg/g — la pregunta de si la RAC de esta
  //  IPS es mg/g o mg/mmol queda contestada por la fuente, no por una suposición.
  // ---------------------------------------------------------------------

  // Puente entre las claves de WHITELIST_13_LABS y los `codigoExamen` de Everest.
  // Cada línea que no es una coincidencia literal lleva su evidencia al lado; ninguna
  // sale de "me suena que es lo mismo".
  const LAB_KEY_A_EXAMEN_EVEREST = {
      COLESTEROL_TOTAL: "COLESTEROL_TOTAL",
      COLESTEROL_HDL: "HDL",
      COLESTEROL_LDL: "LDL",
      TRIGLICERIDOS: "TRIGLICERIDOS",
      GLUCOSA: "GLUCOSA_SUERO",          // la propia entrada se llama "GLUCOSA EN SUERO"
      CREATININA: "CREATININA",
      HBA1C: "HBA1C",
      PTH: "PTH",
      FOSFORO: "FOSFORO_SERICO",         // "FOSFORO EN SUERO" en la lista de nombres
      ALBUMINA: "ALBUMINA_SERICA",       // "ALBUMINA EN SUERO" en la lista de nombres
      HEMOGLOBINA: "HEMOGLOBINA",
      // La casilla que usa el script es `resultadoRelacionAlbuminaCreatinina`, cuya
      // etiqueta se leyó en consultorio (v12.0.5): "Relación albuminuria/Creatinina en
      // orina (mg/g)". Everest declara RELACION_ALBUMINURIA_CREATININA en mg/g. Mismo
      // nombre, misma unidad. NO es MICROALBUMINURIA_CREATINURIA, que también viene en
      // mg/g pero corresponde a la OTRA casilla —`resultadoMicroAlbuminuriaCreatinuria`—
      // que ese mismo comentario prohíbe expresamente usar: son dos exámenes distintos.
      RAC: "RELACION_ALBUMINURIA_CREATININA",
      // UROANALISIS no se mapea a propósito: no es un examen numérico (es el par SI/NO
      // más siete componentes de texto) y Everest no lo parametriza. Inventarle una
      // correspondencia sería juzgar con un rango algo que no tiene número.
  };

  // Reglas oficiales para una clave del catálogo del script (no para un `codigoExamen`).
  function _reglasParaLabKey(tabla, labKey, opts) {
      const codigo = LAB_KEY_A_EXAMEN_EVEREST[labKey];
      if (!codigo) return [];
      return _reglasDeExamen(tabla, codigo, opts);
  }

  function _vigenciaDiasParaAnalito(key, resultValCrudo) {
      if (key === "RAC") {
          // v12.10.15 — Bug real de auditoría: los LIS suelen reportar valores fuera de
          // rango con desigualdad ("> 300", ">= 30"). Number("> 300") es NaN, así que sin
          // sanitizar el umbral nunca se cumplía justo para la albuminuria más franca —el
          // caso de mayor riesgo— y la vigencia volvía a los 180 días completos en vez de
          // acortarse a 90. Se quita todo lo que no sea dígito/coma/punto antes de parsear.
          // v14.1.3 — Ahora usa _labNumerico en vez de repetir aquí el saneo. Cuando se
          // extrajo esa función (v14.1.0) se dejó esta copia sin migrar, y las dos habían
          // divergido: _labNumerico rechaza los negativos, esta no. Con un "-50" corrupto
          // del LIS, el saneo de aquí borraba el signo y devolvía 50 — por encima del
          // umbral de albuminuria (30), así que un dato inválido ACORTABA la vigencia a la
          // mitad. Una sola función, un solo criterio.
          const n = _labNumerico(resultValCrudo);
          if (n != null && n >= RAC_VIGENCIA_UMBRAL_ALBUMINURIA) return RCV_VIGENCIA_DIAS / 2;
      }
      return RCV_VIGENCIA_DIAS;
  }
  // v12.10.11 — R1a: las cuatro fórmulas renales puras (TFG por Cockcroft-Gault y por
  // CKD-EPI 2021, estadificación KDIGO y discordancia entre ambas TFG). Sin DOM, sin red,
  // sin estado global — la lectura de peso/talla por red y el disparo por paciente/día
  // son de otro PR (R1b). Aritmética portada tal cual desde el proyecto hermano Copiloto
  // RCV, ya verificada en producción allí.
  //
  // "Femenino" se reconoce con el mismo criterio que ya usa el archivo para el sexo que
  // reporta BuscarPacienteDetallado (líneas ~9586/10709): primera letra en mayúscula,
  // "F" o "M" — no se inventa otro criterio aquí.
  function _esSexoFemenino(sexo) {
      return String(sexo == null ? "" : sexo).trim().toUpperCase().charAt(0) === "F";
  }
  // Cockcroft-Gault usa el peso REAL siempre (decisión clínica ya tomada: es el estadio
  // administrativo) — nunca peso ideal ni ajustado. Centinela 0 = "no evaluable".
  function cockcroftGault(edadAnios, pesoKg, creatininaSerica, sexo) {
      const edad = Number(edadAnios), peso = Number(pesoKg), creat = Number(creatininaSerica);
      if (!(edad >= 18 && edad <= 120) || !(peso >= 20 && peso <= 300) || !(creat >= 0.1 && creat <= 20)) return 0;
      let v = ((140 - edad) * peso) / (72 * creat);
      if (_esSexoFemenino(sexo)) v *= 0.85;
      return Math.round(v * 10) / 10;
  }
  // CKD-EPI 2021 (sin el término de raza, ya retirado). Centinela 0 = "no evaluable".
  function ckdEpi2021(edadAnios, creatininaSerica, sexo) {
      const edad = Number(edadAnios), creat = Number(creatininaSerica);
      if (!(edad >= 18 && edad <= 120) || !(creat >= 0.1 && creat <= 20)) return 0;
      const femenino = _esSexoFemenino(sexo);
      const k = femenino ? 0.7 : 0.9;
      const a = femenino ? -0.241 : -0.302;
      const R = creat / k;
      const F = R <= 1 ? Math.pow(R, a) : Math.pow(R, -1.2);
      let e = 142 * F * Math.pow(0.9938, edad);
      if (femenino) e *= 1.012;
      return Math.round(e * 10) / 10;
  }
  // Estadificación KDIGO de la TFG (ml/min/1.73m²) en los seis estadios estándar.
  function estadioKDIGO(tfg) {
      const v = Number(tfg);
      // v14.1.3 — GUARDA EN LA FUENTE. Sin esta línea, la función tenía el peor fallo
      // posible escondido en la aritmética de JavaScript: TODA comparación de orden con
      // NaN es false, así que un `tfg` no numérico (texto, null, undefined) caía por los
      // seis `if` y salía por el `return "G5"` del final — el estadio MÁS GRAVE, falla
      // renal terminal, a partir de un dato que ni siquiera se pudo leer. Lo mismo con el
      // centinela 0 que devuelven cockcroftGault/ckdEpi2021 para decir "no evaluable".
      // `estadioRenalDelPaciente` ya lo blindaba por fuera, pero esta función es pública y
      // pura: quien la llame directo merece la misma protección. "No evaluable" es null,
      // nunca el diagnóstico más grave.
      if (!Number.isFinite(v) || v <= 0) return null;
      if (v >= 90) return "G1";
      if (v >= 60) return "G2";
      if (v >= 45) return "G3a";
      if (v >= 30) return "G3b";
      if (v >= 15) return "G4";
      return "G5";
  }
  const KDIGO_POSICION = { G1: 1, G2: 2, G3a: 3, G3b: 4, G4: 5, G5: 6 };
  // Compara el estadio KDIGO derivado de Cockcroft-Gault contra el derivado de CKD-EPI:
  // una discordancia de más de 2 estadios es clínicamente relevante (p.ej. TFG conservada
  // por CG en un paciente de bajo peso muscular que CKD-EPI marca en falla avanzada).
  // `null` = no evaluable (alguna de las dos TFG es 0/centinela o no es un número).
  function evaluarDiscordanciaTFG(tfgCG, tfgCKD) {
      const cg = Number(tfgCG), ckd = Number(tfgCKD);
      if (!cg || !ckd || !Number.isFinite(cg) || !Number.isFinite(ckd)) return null;
      const estadioCG = estadioKDIGO(cg), estadioCKD = estadioKDIGO(ckd);
      const posCG = KDIGO_POSICION[estadioCG], posCKD = KDIGO_POSICION[estadioCKD];
      const diferenciaEstadios = Math.abs(posCG - posCKD);
      if (diferenciaEstadios <= 2) return null;
      return {
          alerta: true,
          estadioCG,
          estadioCKD,
          diferenciaEstadios,
          mensaje: "Discordancia entre TFG por Cockcroft-Gault (" + estadioCG + ") y CKD-EPI 2021 (" + estadioCKD + "): diferencia de " + diferenciaEstadios + " estadios KDIGO.",
      };
  }
  // =====================================================================
  // R2 — Tabla de vigencias por estadio renal (MODO SOMBRA — no cambia ningún aviso).
  //
  // Transcripción EXACTA de PROMPT_JULES_R2_VIGENCIAS_ESTADIO.md líneas 35-70 (fuente:
  // everest-rcv-copiloto/motor_vigencias.py líneas 30-84, ya en producción en el proyecto
  // hermano). NO se recalcula ni se ajusta aquí. "BLOQ" = el analito no se pide en ese
  // estadio. Vigencias en DÍAS. Los rangos de creatinina en G3a/G3b/G4 se conservan como
  // rango {min, max} — colapsarlos a un número sería inventar una política que la tabla no
  // fija; esa decisión es de la tarea R3, no de esta.
  //
  // Esta tabla NO está conectada a ningún aviso todavía (eso es R3, con visto bueno médico
  // explícito): RCV_VIGENCIA_DIAS, _vigenciaDiasParaAnalito y el aviso de 180 días planos
  // siguen exactamente igual que hoy.
  //
  // El estadio a usar aquí es SIEMPRE el de Cockcroft-Gault (estadioKDIGO(cockcroftGault(...))),
  // nunca el de CKD-EPI — decisión clínica ya tomada (ver PROMPT_JULES_R2_VIGENCIAS_ESTADIO.md
  // §1): Cockcroft-Gault es el "estadio administrativo" que rige vigencias ante la EPS;
  // CKD-EPI es el "estadio clínico", para razonar función renal, no para esto. El cableado de
  // cuál TFG se le pasa a estadioKDIGO antes de llamar a vigenciaPorEstadio es de otra tarea;
  // esta función solo recibe el estadio ya calculado, como cadena.
  const RCV_VIGENCIA_ESTADIO_TABLA = {
      // Programa ERC (paciente con "Nefroprotección" confirmada — ver §3 del prompt fuente).
      ERC: {
          creatinina: { G1: 180, G2: 180, G3a: { min: 90, max: 121 }, G3b: { min: 90, max: 121 }, G4: { min: 60, max: 93 } },
          glicemia: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 60 },
          parcial_orina: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 120 },
          hemoglobina: { G1: 365, G2: 365, G3a: 365, G3b: 365, G4: 180 },
          pth: { G1: "BLOQ", G2: "BLOQ", G3a: 365, G3b: 365, G4: 180 },
          albumina: { G1: "BLOQ", G2: "BLOQ", G3a: "BLOQ", G3b: 365, G4: 365 },
          fosforo: { G1: "BLOQ", G2: "BLOQ", G3a: "BLOQ", G3b: 365, G4: 365 },
          colesterol_total: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 120 },
          trigliceridos: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 120 },
          // v14.1.2 — CORREGIDO contra la Tabla 50 oficial (imagen entregada por el médico
          // el 14-ago-2026): en Estadio 4 el LDL es 120 días, no 180. El valor viejo hacía
          // que en el estadio MÁS avanzado el LDL se pidiera con MENOS frecuencia que el
          // colesterol total y los triglicéridos de su misma fila — la incoherencia que
          // delataba el error.
          ldl: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 120 },
          hdl: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 180 },
          // v14.1.2 — La Tabla 50 (ERC) pide "Micro albuminuria", NO la relación
          // albúmina/creatinina. Son cosas distintas —concentración frente a cociente— y
          // este proyecto ya trata esa distinción como crítica (decisión confirmada en
          // consultorio el 10-08-2026: se usa resultadoRelacionAlbuminaCreatinina y NUNCA
          // resultadoMicroAlbuminuriaCreatinuria). Las tablas 39 (HTA) y 43 (DM) sí piden la
          // RELACIÓN; solo la de ERC pide la microalbuminuria. Se respeta cada tabla como
          // está escrita, en vez de unificarlas por parecido de nombre.
          microalbuminuria: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 180 },
          // v14.1.2 — CORREGIDO: la Tabla 50 da 180 días en TODOS los estadios (120 en E4).
          // El "(solo para diabéticos)" de la tabla NO es un bloqueo por estadio: eso ya lo
          // aplica vigenciaPorEstadio con su parámetro `esDM2`. Tener ADEMÁS "BLOQ" en G1/G2
          // era una segunda compuerta que la fuente no tiene, y dejaba sin HbA1c a un
          // diabético en estadio renal temprano — justo el paciente en quien más se controla.
          hba1c: { G1: 180, G2: 180, G3a: 180, G3b: 180, G4: 120 },
          // v14.1.2 — Filas de la Tabla 50 que faltaban ENTERAS en esta tabla.
          hematocrito: { G1: 365, G2: 365, G3a: 365, G3b: 365, G4: 180 },
          depuracion_creatinina_orina24h: { G1: 365, G2: 180, G3a: 180, G3b: 180, G4: 90 },
      },
      // Programa DM2 (sin ERC activa, o ERC en G1/G2) — la tabla fuente no lo desglosa por
      // estadio, son valores planos. No exige PTH/Albúmina/Fósforo (no están en este bloque).
      DM2: {
          hba1c: 180,
          glicemia: 180,
          creatinina: 180,
          rac: 180,
          parcial_orina: 180,
          colesterol_total: 180,
          ldl: 180,
          hdl: 180,
          trigliceridos: 180,
          ecg: 365, // solo si opciones.edad >= 45 — lo exige vigenciaPorEstadio.
      },
      // Programa HTA (sin ERC activa, o ERC en G1/G2) — tampoco desglosado por estadio.
      HTA: {
          glicemia: 180,
          creatinina: 180,
          rac: 180,
          parcial_orina: 180,
          colesterol_total: 180,
          ldl: 180,
          hdl: 180,
          trigliceridos: 180,
          ecg: 365,
          // ⚠ v14.1.2 — ESTAS DOS NO ESTÁN EN LA TABLA 39 que entregó el médico. Esa tabla
          // tiene exactamente 9 filas: parcial de orina, glicemia basal, creatinina sérica,
          // colesterol total, LDL, HDL, triglicéridos, relación albuminuria/creatinina (las
          // 8 a 180 días, 2 veces al año) y electrocardiograma (1 vez, anual). Ni
          // ecocardiograma ni ácido úrico aparecen.
          // No se borran todavía porque podrían venir de otra parte del manual que no se ha
          // visto, y borrar un examen es una decisión clínica. Quedan marcadas para que el
          // médico confirme: el ácido úrico está en "BLOQ" (nunca se pide), que es
          // equivalente a no estar en la tabla, así que es inocuo; el ECOCARDIOGRAMA sí
          // cambia el comportamiento — hoy se pediría una vez al año sin respaldo en la
          // Tabla 39.
          ecocardiograma: 365,
          acido_urico: "BLOQ",
      },
  };
  // Consulta PURA de la tabla anterior: sin DOM, sin red, sin estado global, sin deducir nada
  // que no venga explícito en los parámetros. `opciones = { esDM2, edad }` — ambos SIEMPRE
  // explícitos, nunca inferidos aquí dentro (eso es responsabilidad de quien llame).
  // Devuelve: un número de días; `{min, max}` para los rangos de creatinina; la cadena
  // "BLOQ"; o `null` cuando la combinación (programa/estadio/analito/opciones) no está
  // contemplada por la tabla — nunca un número inventado.
  function vigenciaPorEstadio(programa, estadio, analito, opciones) {
      const opts = opciones || {};
      if (programa === "ERC") {
          const porAnalito = RCV_VIGENCIA_ESTADIO_TABLA.ERC[analito];
          if (!porAnalito) return null;
          if (analito === "hba1c" && opts.esDM2 !== true) return null;
          if (!Object.prototype.hasOwnProperty.call(porAnalito, estadio)) return null;
          const v = porAnalito[estadio];
          if (v && typeof v === "object") return { min: v.min, max: v.max };
          return v;
      }
      if (programa === "DM2") {
          const tabla = RCV_VIGENCIA_ESTADIO_TABLA.DM2;
          if (!Object.prototype.hasOwnProperty.call(tabla, analito)) return null;
          if (analito === "ecg") return Number(opts.edad) >= 45 ? tabla.ecg : null;
          return tabla[analito];
      }
      if (programa === "HTA") {
          const tabla = RCV_VIGENCIA_ESTADIO_TABLA.HTA;
          if (!Object.prototype.hasOwnProperty.call(tabla, analito)) return null;
          return tabla[analito];
      }
      return null;
  }
  // Mapeo EXPLÍCITO clave RCV (RCV_VIGENCIA_KEYS, línea ~2570) -> nombre de analito de la
  // tabla de vigencias por estadio (R2). Solo las 7 claves que hoy sí se vigilan tienen
  // mapeo; el resto de analitos de la tabla — hemoglobina, pth, albumina, fosforo, ldl,
  // hba1c, ecg, ecocardiograma, acido_urico (9) — NO tienen ninguna clave RCV que vigilar
  // hoy (injectLabsIntoCronicos los autocompleta aparte, sin cambios de esta tarea) y no se
  // les inventa una: cualquier clave fuera del mapa, o cualquiera de esas 9, devuelve `null`.
  function analitoTablaDesdeClaveRcv(clave) {
      const MAPA = {
          CREATININA: "creatinina",
          GLUCOSA: "glicemia",
          UROANALISIS: "parcial_orina",
          COLESTEROL_TOTAL: "colesterol_total",
          TRIGLICERIDOS: "trigliceridos",
          COLESTEROL_HDL: "hdl",
          COLESTEROL_LDL: "ldl",
          RAC: "rac",
      };
      return Object.prototype.hasOwnProperty.call(MAPA, clave) ? MAPA[clave] : null;
  }
  // `hoyIso` se recibe como parámetro (nunca Date.now()/new Date() implícito aquí) para
  // que la prueba pueda fijar "hoy" y el resultado sea siempre reproducible.
  function _analitosRcvVencidos(labsArray, hoyIso) {
      const hoy = _parseFechaHoraLike(hoyIso);
      if (!hoy) return [];
      const hoyMs = new Date(hoy.iso + "T00:00:00").getTime();
      const { candidatos } = _ultimaFechaPorAnalito(Array.isArray(labsArray) ? labsArray : [], { uroanalisisPorComponentes: true });
      const faltantes = [];
      for (const key of RCV_VIGENCIA_KEYS) {
          const c = candidatos.get(key);
          if (!c || !c.resultDate) { faltantes.push({ key, nombre: RCV_VIGENCIA_NOMBRES[key] }); continue; }
          const fechaMs = new Date(c.resultDate + "T00:00:00").getTime();
          const dias = Math.round((hoyMs - fechaMs) / 86400000);
          const vigenciaDias = _vigenciaDiasParaAnalito(key, c.resultVal);
          if (dias > vigenciaDias) faltantes.push({ key, nombre: RCV_VIGENCIA_NOMBRES[key], resultDate: c.resultDate, dias });
      }
      return faltantes;
  }

  // Interfaz de Usuario para activar la inyección
    // =====================================================================
  //  ROBOT AUTOMÁTICO ATHENEA: BUSCA LA CÉDULA DEL PACIENTE AL ABRIR HISTORIA
  // =====================================================================
  let lastAutoFetchedDoc = "";
  let lastAutoFetchedAt = 0;
  // v12.3.34 — PRE-CARGA, no escritura. Reportado en consultorio con log real: el robot
  // reescribía las casillas de la Ruta Crónicos cada ~30 s (el piso anti-ráfagas de
  // v12.3.27 convirtió "una vez por paciente" en "cada 30 s por paciente"), pisando lo
  // que el médico borraba o corregía — sin ningún clic suyo. Ahora el robot solo CONSULTA
  // Athenea y guarda el resultado aquí; escribir en la historia clínica es EXCLUSIVO del
  // botón «🧬 Auto-Labs», que gracias a esta pre-carga responde al instante.
  let _labsPrefetch = { docId: "", labs: null, ts: 0 };
  let _labsAvisoDoc = "";
  const LABS_PREFETCH_TTL_MS = 10 * 60000;

  // v12.6.9 - Guarda para evitar borrado espontáneo de la RAC al editar Creatinina.
  let _racGuardia = { activa: false, docId: "", valor: "", ts: 0, restauraciones: 0 };
  function _getRacGuardiaParaTest() { return _racGuardia; }
  function _setRacGuardiaParaTest(v) { _racGuardia = v; }

  async function autoFetchAtheneaLabsForActivePatient() {
      // v11.0.1 — El registro va DESPUÉS de la guarda. Antes se escribía en cada ráfaga del
      // observador de DOM, y cada escritura reserializa hasta 500 entradas: en la historia
      // clínica eso era trabajo constante y evitable en el hilo de la página.
      const docId = (typeof extractPacienteAbierto === "function") ? extractPacienteAbierto() : "";
      if (!docId) return;
      // v12.3.27 — La guarda de "mismo docId" NO bastaba: una bitácora real mostró este
      // disparo cada 1-5 s de forma sostenida (410 de 500 entradas en 22 h) — mucho más
      // rápido de lo que un médico cambia de paciente. Indicio real: extractPacienteAbierto()
      // no siempre devuelve la MISMA cadena exacta entre relecturas del DOM (Angular
      // re-renderiza esa zona), así que la comparación de igualdad fallaba y cada disparo
      // repetía TODA la búsqueda en Athenea (3-4 peticiones reales) — no era solo ruido de
      // bitácora, era carga real e innecesaria contra el servidor de Athenea. Se añade un
      // piso de 30 s: además de "¿es el mismo docId?", exige que haya pasado ese tiempo
      // desde el último disparo, sea cual sea el docId.
      const ahora = Date.now();
      if (docId === lastAutoFetchedDoc && (ahora - lastAutoFetchedAt) < 30000) return;
      // v12.3.34 — con resultados ya pre-cargados y vigentes para ESTE paciente, no hay
      // nada que volver a consultar: esto es lo que de verdad cumple "una consulta por
      // paciente" (el piso de 30 s de arriba queda como respaldo para los casos de error).
      if (docId === _labsPrefetch.docId && _labsPrefetch.labs && (ahora - _labsPrefetch.ts) < LABS_PREFETCH_TTL_MS) return;
      vglLog("PATIENT", "AutoFetchTriggered", { section: seccionActiva() });

      lastAutoFetchedDoc = docId;
      lastAutoFetchedAt = ahora;
      console.log(`[Vigilante Robot Athenea] 🤖 Paciente detectado en Historia Clínica (CC: ${docId}). Pre-consultando laboratorios (sin escribir nada)...`);

      try {
          const labs = await getAtheneaLabsAuto(docId);
          // v12.10.15 — Bug real de auditoría (informe nocturno): antes solo se cacheaba
          // aquí cuando labs.length > 0, así que un paciente SIN laboratorios en Athenea
          // —el caso de mayor riesgo real, porque le faltan los 7 analitos RCV— nunca
          // actualizaba _labsPrefetch.docId/ts. Eso encadenaba dos fallas: (1) el piso de
          // 30 s dejaba de ser un piso real y el robot volvía a golpear Athenea con 3-4
          // peticiones cada 30 s mientras la historia siguiera abierta (riesgo de bloqueo
          // de IP), y (2) checkLabsVencidos() —que exige _labsPrefetch.docId === doc antes
          // de revisar— nunca llegaba a evaluar a ese paciente, silenciando justo la alerta
          // que más le hace falta. getAtheneaLabsAuto siempre resuelve a un arreglo (nunca
          // null/undefined); si algo lanza antes de esta línea, el catch de abajo evita
          // este bloque sin tocar la caché, que es lo correcto (reintentar, no cachear un
          // error como si fuera "cero laboratorios").
          _labsPrefetch = { docId, labs, ts: Date.now() };
          if (labs.length > 0) {
              // v12.3.34 — AQUÍ YA NO SE ESCRIBE NADA: injectLabsIntoCronicos solo corre
              // cuando el médico pulsa el botón. El robot deja los resultados listos y
              // avisa UNA sola vez por paciente.
              vglLog("ATHENEA", "LabsAutoPrefetched", { docId, totalLabs: labs.length });
              if (_labsAvisoDoc !== docId) {
                  _labsAvisoDoc = docId;
                  notify("VERDE", "🧪 Paraclínicos de Athenea encontrados",
                    `Hay ${labs.length} resultados listos para este paciente.\nNADA se escribió en la historia: pulse el botón «🧬 Auto-Labs (Athenea)» cuando quiera diligenciarlos.`,
                    false, "athenea_listo|" + docId + "|" + todayStamp());
              }
          }
      } catch (e) {
          console.warn("[Vigilante Robot Athenea] No se pudieron pre-consultar los paraclínicos:", e);
      }
  }

  function createLabInjectorUI() {
      autoFetchAtheneaLabsForActivePatient();
      if (document.getElementById("vgl-lab-injector")) return;

      const btn = document.createElement("button");
      btn.id = "vgl-lab-injector";
      btn.innerHTML = "🧬 Auto-Labs (Athenea)";
      btn.className = "vgl-lab-inj";

      btn.onclick = async () => {
          const docId = (typeof extractPacienteAbierto === "function") ? extractPacienteAbierto() : "";
          if (!docId) {
              alert("No se pudo determinar el paciente abierto en esta historia clínica.");
              return;
          }
          btn.innerHTML = "⏳ Buscando en Athenea...";
          uxTrack("labs.autollenado.click");
          try {
              // v12.3.35 — hallado en revisión adversarial: usar aquí la PRE-CARGA servía
              // datos de hasta 10 minutos como si fueran actuales ("siguen PENDIENTES" de
              // resultados que ya habían salido) y no había forma de forzar un refresco
              // dentro de ese lapso. El clic del médico SIEMPRE consulta en vivo; la
              // pre-carga del robot queda solo para el aviso temprano y para no repetir
              // consultas automáticas. Tras la consulta viva se refresca la pre-carga,
              // así el robot no vuelve a pedir lo que el clic acaba de traer.
              const labs = await getAtheneaLabsAuto(docId);
              // v12.10.15 — mismo fix que autoFetchAtheneaLabsForActivePatient: cachear
              // SIEMPRE que la consulta viva resuelva (incluida la lista vacía), para que
              // el robot no repita esta misma consulta 30 s después.
              if (labs) _labsPrefetch = { docId, labs, ts: Date.now() };
              if (labs && labs.length > 0) {
                  const r = injectLabsIntoCronicos(labs, docId, await _contextoOficialParaLabs(docId));
                  // v14.1.5 — si el médico cambió de historia mientras Athenea respondía,
                  // no se escribió nada y hay que DECIRLO: callarlo dejaría creer que la
                  // historia quedó diligenciada.
                  if (r.abortadoPorPaciente) {
                      uxTrack("labs.autollenado.abortado_cambio_paciente");
                      alert("🛑 No se diligenció nada: la historia clínica abierta cambió mientras Athenea respondía."
                        + "\n\nLos resultados que llegaron son del paciente con cédula " + docId + ", y en pantalla hay otro paciente."
                        + "\n\nVuelva a abrir la historia de ese paciente y pulse Auto-Labs de nuevo.");
                      btn.innerHTML = "🧬 Auto-Labs (Athenea)";
                      return;
                  }
                  uxTrack("labs.autollenado.casillas", { n: r.count });
                  alert("✅ Se encontraron " + labs.length + " analitos y se diligenciaron " + r.count + " casillas en la Ruta Crónicos."
                    + (r.uroanalisisMarcado ? "\n\n🧪 Se marcó \"SI\" en ¿Uroanálisis? porque Athenea trajo resultados reales del parcial de orina." : "")
                    + (r.respetadas ? "\n\n✋ " + r.respetadas + " casilla(s) ya tenían valor y se RESPETARON (no se sobrescribió nada)." : "")
                    + (r.pendientes ? "\n\n⏳ " + r.pendientes + " analito(s) siguen PENDIENTES en el laboratorio: no se escribieron." : "")
                    + (r.sinCasilla.length ? "\n\n⚠ Sin casilla en esta vista: " + r.sinCasilla.join(", ") + "." : "")
                    + _textoImplausibles(r.implausibles)
                    + "\n\nRevise las fechas de toma antes de guardar la historia.");
              } else if (atheneaSesionViva === false) {
                  // v12.3.15 — La causa más común de "sin resultados" es que NO HAY SESIÓN
                  // en Athenea: su cookie es DE SESIÓN pura (muere al cerrar el navegador)
                  // y el formulario de login no ofrece "recordarme" — verificado en la
                  // captura real: solo Usuario, Password y token CSRF. Ningún latido puede
                  // resucitar una cookie que ya no existe, así que en vez de un aviso sin
                  // salida se ofrece abrir el portal aquí mismo; al volver, el latido en
                  // cadencia rápida detecta la sesión nueva y el robot reintenta solo.
                  // v12.3.16 — Si el médico configuró el auto-inicio, se intenta aquí mismo y
                  // se reintenta la búsqueda una vez, sin abrir otra pestaña ni pedir nada.
                  if (S.atheneaAutoLogin && atheneaCredsGet()) {
                      btn.innerHTML = "🔑 Iniciando sesión en Athenea…";
                      const okl = await atheneaAutoLogin();
                      if (okl) {
                          btn.innerHTML = "⏳ Reintentando…";
                          const labs2 = await getAtheneaLabsAuto(docId);
                          if (labs2 && labs2.length > 0) {
                              const r2 = injectLabsIntoCronicos(labs2, docId, await _contextoOficialParaLabs(docId));
                              if (r2.abortadoPorPaciente) {
                                  uxTrack("labs.autollenado.abortado_cambio_paciente");
                                  alert("🛑 No se diligenció nada: la historia clínica abierta cambió mientras se iniciaba sesión en Athenea."
                                    + "\n\nVuelva a abrir la historia del paciente con cédula " + docId + " y pulse Auto-Labs de nuevo.");
                                  btn.innerHTML = "🧬 Auto-Labs (Athenea)";
                                  return;
                              }
                              alert("✅ Sesión iniciada y " + labs2.length + " analitos encontrados: " + r2.count + " casillas diligenciadas en la Ruta Crónicos."
                                + (r2.uroanalisisMarcado ? "\n\n🧪 Se marcó \"SI\" en ¿Uroanálisis? porque Athenea trajo resultados reales del parcial de orina." : "")
                                + (r2.respetadas ? "\n\n✋ " + r2.respetadas + " casilla(s) ya tenían valor y se RESPETARON (no se sobrescribió nada)." : "")
                                + (r2.pendientes ? "\n\n⏳ " + r2.pendientes + " analito(s) siguen PENDIENTES: no se escribieron." : "")
                                + (r2.sinCasilla.length ? "\n\n⚠ Sin casilla en esta vista: " + r2.sinCasilla.join(", ") + "." : "")
                                + _textoImplausibles(r2.implausibles)
                                + "\n\nRevise las fechas de toma antes de guardar la historia.");
                          } else {
                              alert("Sesión de Athenea iniciada, pero no se encontraron laboratorios para el paciente (cédula " + docId + ").");
                          }
                      } else {
                          alert("❌ No se pudo iniciar sesión automáticamente en Athenea. Revise sus credenciales en Ajustes o inicie sesión a mano.");
                      }
                  } else if (confirm("🔑 La sesión de Athenea no está activa en este navegador — por eso no aparecen los laboratorios."
                    + "\n\n¿Abrir Athenea ahora para iniciar sesión?"
                    + "\n\nAl volver a esta pestaña, el Vigilante reintentará solo en menos de un minuto.")) {
                      window.open("https://medicosviva1a.atheneasoluciones.com/Account/Login", "_blank");
                  }
              } else {
                  // v11.0.1 — SIN prompt(). Escribir a mano un idSolicitud traía a esta
                  // historia clínica los resultados de CUALQUIER otro paciente, sin
                  // comprobación de identidad. Este mensaje cubre tanto "no se encontró
                  // el paciente en Athenea" como "se encontró pero sin resultados": en
                  // ambos casos no se diligenció nada y hay que revisar a mano.
                  alert("⚠️ No se encontraron laboratorios para el paciente abierto (cédula " + docId + ") en Athenea."
                    + "\n\nConsulte los resultados directamente en el portal. No se diligenció ninguna casilla.");
              }
          } catch (e) {
              alert("❌ No se pudo conectar con el Portal de Athenea para consultar los paraclínicos. Por favor verifique su conexión o intente desde el portal.");
          }
          btn.innerHTML = "🧬 Auto-Labs (Athenea)";
      };

      document.body.appendChild(btn);
  }

  // v14.0.0 (T5) — DOCK DE WIDGETS SOBRE LA HISTORIA CLÍNICA. Fase 4 de
  // SUPERPROMPT_DISENO_V14.md: los tres botones que T4 sacó de la tarjeta del panel
  // (🗓️ agendar · 📋 ordenar PyM · 🧪 labs) renacen aquí como widgets flotantes sobre la
  // Historia Clínica de Everest — misma mecánica de anclaje que createLabInjectorUI()
  // arriba (D8: idempotente por id, se re-crea sola si Angular la borra), mismas
  // funciones de siempre (openAgendamientoModal/openOrdenamientoModal/
  // openLaboratoriosModal/openLabSoloModal — NINGUNA se tocó, siguen siendo las mismas
  // que usaba render()) y los MISMOS bloqueos antiduplicado (isCitaAgendadaHoy/
  // isLabAgendadaHoy/isOrdenesCreadasHoy).
  //
  // De dónde sale el paciente: extractPacienteAbierto() solo da la CÉDULA (no hay nombre
  // ni estado ahí) — las cuatro funciones open*Modal() solo EXIGEN `apt.doc_id` (su
  // primera línea es siempre `if (!apt || !apt.doc_id) {...return;}`) y `apt.nombre` es
  // puramente cosmético (`apt.nombre || apt.name || "Paciente Everest"`, ya así antes de
  // esta tarea). Por eso: si la cédula abierta coincide con una cita de
  // state.lastSnapshot.list (la ÚLTIMA agenda real leída, que sigue en memoria aunque el
  // médico haya navegado a la historia — la SPA no recarga la página), se usa esa cita
  // REAL completa; si no hay coincidencia (paciente fuera de la agenda visible de hoy),
  // se arma el objeto mínimo `{doc_id}` — nunca se inventa un nombre.
  //
  // Por qué se reconstruye el HTML entero en cada llamada (a diferencia de
  // createLabInjectorUI, que crea su botón UNA vez y no lo vuelve a tocar): los tres
  // estados de cada botón (ya agendado/falta el laboratorio/ya ordenado) pueden cambiar
  // mientras el médico sigue en la MISMA historia clínica (p. ej. si él mismo agenda
  // desde este widget) — sin refrescar el contenido, el botón quedaría mintiendo que algo
  // sigue pendiente cuando ya se hizo. El contenedor #vgl-acciones-dock en sí NUNCA se
  // quita y se vuelve a poner (evita el parpadeo que prohíbe D8): solo su innerHTML se
  // renueva, igual de barato que createLabInjectorUI (un getElementById por tick).
  function createAccionesDockUI() {
    if (!_enModuloHCHealth()) { const fuera = document.getElementById("vgl-acciones-dock"); if (fuera) fuera.remove(); return; }
    const docId = extractPacienteAbierto();
    if (!docId) { const sinPac = document.getElementById("vgl-acciones-dock"); if (sinPac) sinPac.remove(); return; }

    let dock = document.getElementById("vgl-acciones-dock");
    const esNuevo = !dock;
    if (esNuevo) {
      dock = document.createElement("div");
      dock.id = "vgl-acciones-dock";
      document.body.appendChild(dock);
    }
    // El colapso es una preferencia del médico, no del paciente: se lee del propio nodo
    // (si ya existía) o de GM_getValue en la primera creación de la sesión.
    const colapsado = esNuevo
      ? (typeof GM_getValue !== "undefined" ? GM_getValue("vgl_dock_acciones_colapsado", "") === "1" : false)
      : dock.classList.contains("colapsado");
    dock.className = "vgl-acciones-dock" + (isLight() ? " light" : "") + (colapsado ? " colapsado" : "");

    const citaReal = (state.lastSnapshot && state.lastSnapshot.list)
      ? state.lastSnapshot.list.find((a) => a.doc_id && normalizeKey(a.doc_id) === normalizeKey(docId))
      : null;
    const apt = citaReal || { doc_id: docId };

    const citaHechaHoy = isCitaAgendadaHoy(docId);
    const labHechoHoy = isLabAgendadaHoy(docId);
    const soloFaltaLab = citaHechaHoy && !labHechoHoy;
    const yaOrdenadoHoy = isOrdenesCreadasHoy(docId);

    // Se reconstruye por ELEMENTOS reales (createElement + addEventListener directo),
    // no por plantilla de innerHTML + querySelector — mismo estilo que createLabInjectorUI
    // y createExamenFisicoInjectorUI: cada botón guarda su propia referencia, así que
    // agregar/quitar el listener no depende de que un selector encuentre el nodo correcto
    // después de parsear HTML.
    while (dock.children.length) dock.removeChild(dock.children[0]);

    const btnToggle = document.createElement("button");
    btnToggle.className = "vgl-dock-toggle";
    btnToggle.setAttribute("data-accion", "toggle");
    btnToggle.setAttribute("aria-label", colapsado ? "Expandir acciones" : "Colapsar acciones");
    btnToggle.title = colapsado ? "Expandir" : "Colapsar";
    btnToggle.textContent = colapsado ? "\u25C0" : "\u25B6";
    btnToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const nuevoColapsado = !dock.classList.contains("colapsado");
      dock.classList.toggle("colapsado", nuevoColapsado);
      try { if (typeof GM_setValue !== "undefined") GM_setValue("vgl_dock_acciones_colapsado", nuevoColapsado ? "1" : ""); } catch (e2) {}
      uxTrack(nuevoColapsado ? "widget.colapsar" : "widget.expandir");
    });
    dock.appendChild(btnToggle);

    const btns = document.createElement("div");
    btns.className = "vgl-dock-btns";
    dock.appendChild(btns);

    // Mismos tres estados que ya tenía el botón de agendar en render() (T4 los quitó de
    // la tarjeta, no de existencia: isCitaAgendadaHoy/isLabAgendadaHoy siguen siendo las
    // mismas funciones, con las mismas pruebas).
    if (S.agendamientoRapido !== false) {
      const bAg = document.createElement("button");
      bAg.className = "vgl-dock-btn" + (soloFaltaLab ? " vgl-dock-btn-ambar" : "");
      bAg.setAttribute("data-accion", "agendar");
      if (citaHechaHoy && labHechoHoy) {
        bAg.disabled = true;
        bAg.setAttribute("aria-label", "Cita y toma de muestras ya agendadas hoy");
        bAg.title = "\u2705 Cita de control y toma de muestras ya agendadas hoy. Bloqueado para evitar duplicados.";
        bAg.textContent = "\uD83D\uDDD3\uFE0F";
      } else if (soloFaltaLab) {
        bAg.setAttribute("aria-label", "Falta agendar toma de muestras");
        bAg.title = "\uD83E\uDDEA Cita de control ya agendada hoy \u2014 falta la toma de muestras. Clic para agendarla.";
        bAg.textContent = "\uD83E\uDDEA";
      } else {
        bAg.setAttribute("aria-label", "Agendar cita de control");
        bAg.title = "\uD83D\uDDD3\uFE0F Agendar cita de control";
        bAg.textContent = "\uD83D\uDDD3\uFE0F";
      }
      bAg.addEventListener("click", (e) => { e.stopPropagation(); if (bAg.disabled) return; uxTrack(soloFaltaLab ? "widget.agendar.sololab" : "widget.agendar.abrir"); soloFaltaLab ? openLabSoloModal(apt) : openAgendamientoModal(apt); });
      btns.appendChild(bAg);

      const bOrd = document.createElement("button");
      bOrd.className = "vgl-dock-btn";
      bOrd.setAttribute("data-accion", "ordenar");
      if (yaOrdenadoHoy) {
        bOrd.disabled = true;
        bOrd.setAttribute("aria-label", "\u00d3rdenes PyM ya generadas hoy");
        bOrd.title = "\u2705 \u00d3rdenes PyM ya generadas hoy. Bloqueado para evitar duplicados.";
      } else {
        bOrd.setAttribute("aria-label", "Generar \u00f3rdenes PyM");
        bOrd.title = "\uD83D\uDCCB Generar \u00f3rdenes PyM";
      }
      bOrd.textContent = "\uD83D\uDCCB";
      bOrd.addEventListener("click", (e) => { e.stopPropagation(); if (bOrd.disabled) return; uxTrack("widget.ordenar.abrir"); openOrdenamientoModal(apt); });
      btns.appendChild(bOrd);
    }

    const bLabs = document.createElement("button");
    bLabs.className = "vgl-dock-btn";
    bLabs.setAttribute("data-accion", "labs");
    bLabs.setAttribute("aria-label", "Ver paracl\u00ednicos / laboratorios");
    bLabs.title = "\uD83E\uDDEA Ver paracl\u00ednicos / laboratorios";
    bLabs.textContent = "\uD83E\uDDEA";
    bLabs.addEventListener("click", (e) => { e.stopPropagation(); uxTrack("widget.labs.abrir"); openLaboratoriosModal(apt); });
    btns.appendChild(bLabs);
  }

  // v12.9.0 — Pestaña "Revisión por sistema y Examen físico": el médico escribe a mano, en
  // cada consulta, la MISMA frase específica por cada sistema (p. ej. "Piel y faneras:
  // NEGATIVO PARA LESIONES, PRURITO O CAMBIOS DE COLORACIÓN.", "Corazón: NEGATIVO PARA
  // PRECORDIALGIA..."): un texto DISTINTO por casilla, no uno único repetido.
  //
  // Diagnóstico real en consultorio (13-08-2026, DIAGNOSTICO_EXAMEN_FISICO.js): 45 de 56
  // campos de esa pestaña comparten LITERALMENTE el mismo id="alert_message" (defecto de
  // Everest, no un elemento compartido) — getElementById solo alcanza el primero, hace falta
  // querySelectorAll. Sin un id o etiqueta propia por casilla (label[for] y closest(label)
  // dieron vacío en el mismo diagnóstico), la ÚNICA forma de saber "esta casilla es Corazón"
  // es su POSICIÓN dentro del NodeList — que sigue el orden visual de arriba hacia abajo. Es
  // un supuesto, no una certeza: si Everest cambiara el orden o el número de casillas entre
  // pacientes (el propio médico mostró que un paciente pediátrico trae secciones adicionales
  // de curvas de crecimiento que uno adulto no tiene), la posición N ya no sería el mismo
  // sistema. Por eso el botón avisa explícitamente si el número de casillas de hoy no
  // coincide con lo esperado, en vez de aplicar en silencio.
  //
  // v12.10.4 — Se retiraron "💾 Guardar plantilla" / "📋 Aplicar plantilla" (v12.9.0, la
  // plantilla que se "recordaba" del último paciente vía localStorage) a pedido directo del
  // médico: solo quiere la plantilla FIJA de normalidad semiológica de abajo, con un único
  // botón y sin cuadro de confirmación de por medio (sigue sin sobrescribir NUNCA una casilla
  // con texto — esa regla no se negocia).

  // v12.10.3 — Plantilla de normalidad semiológica FIJA, incluida en el propio script. 19
  // frases de "Revisión por sistema" seguidas de 17 de "Examen físico" — el médico pidió
  // omitir MAMAS y GENITO/URINARIO de esa segunda sección porque no las examina de rutina.
  // Cada texto es SOLO la descripción (Everest ya muestra el nombre del sistema como
  // etiqueta propia de la casilla, no hace falta repetirlo dentro del texto).
  const EXAMEN_FISICO_NORMALIDAD_FIJA = [
      // I. Revisión por sistema (subjetivo) — 19
      "NEGATIVO PARA LESIONES, PRURITO O CAMBIOS DE COLORACIÓN.",
      "NEGATIVO PARA OTALGIA, TINNITUS O HIPOACUSIA.",
      "NEGATIVO PARA XEROSTOMÍA, ODINOFAGIA O LESIONES EN MUCOSA.",
      "NEGATIVO PARA PRECORDIALGIA, PALPITACIONES O DISNEA.",
      "NEGATIVO PARA DISFAGIA O DOLOR FARÍNGEO.",
      "NEGATIVO PARA TOS, EXPECTORACIÓN O DOLOR PLEURÍTICO.",
      "NEGATIVO PARA DOLOR PÉLVICO O PESANTEZ.",
      "SIN HALLAZGOS PATOLÓGICOS REFERIDOS.",
      "SIN DISURIA, HEMATURIA, POLIURIA NI SECRECIONES.",
      "SIN POLIDIPSIA, POLIFAGIA NI INTOLERANCIA TÉRMICA.",
      "SIN EQUIMOSIS, EPISTAXIS NI TENDENCIA AL SANGRADO.",
      "NEGATIVO PARA FOTOFOBIA, ESCOTOMAS O DOLOR OCULAR.",
      "NEGATIVO PARA RINORREA, OBSTRUCCIÓN O EPISTAXIS.",
      "SIN ORTOPNEA, DISNEA PAROXÍSTICA NOCTURNA O EDEMAS.",
      "HÁBITO INTESTINAL NORMAL. SIN DISPEPSIA NI DOLOR.",
      "NEGATIVO PARA ARTRALGIAS, MIALGIAS O RIGIDEZ.",
      "NEGATIVO PARA CEFALEA, PARESTESIAS O SÍNCOPE.",
      "NEGATIVO PARA APARICIÓN DE MASAS O ADENOMEGALIAS.",
      "NEGATIVO PARA ASTENIA, ADINAMIA, FIEBRE O PÉRDIDA DE PESO.",
      // II. Examen físico (objetivo) — 17 (se omiten MAMAS y GENITO/URINARIO a pedido del médico)
      "BUEN ESTADO GENERAL. ALERTA, ORIENTADO, HIDRATADO, AFEBRIL.",
      "NORMOCRÓMICA, NORMOTÉRMICA, ELÁSTICA. SIN LESIONES AGUDAS.",
      "NORMOCÉFALO. SIN PUNTOS DOLOROSOS NI SIGNOS DE TRAUMA.",
      "MÓVIL, SIMÉTRICO. TIROIDES GRADO 0. SIN ADENOMEGALIAS.",
      "ISOCÓRICOS, FOTORREACTIVOS. CONJUNTIVAS NORMOCRÓMICAS, ESCLERAS ANICTÉRICAS.",
      "FOSAS NASALES PERMEABLES. TABIQUE CENTRADO. MUCOSA SANA.",
      "MUCOSA ORAL HÚMEDA. DENTADURA EN BUEN ESTADO. SIN LESIONES.",
      "RÍTMICO, SIN SOPLOS NI RUIDOS AGREGADOS. PULSOS SIMÉTRICOS.",
      "OROFARINGE NORMAL. AMÍGDALAS SIN EXUDADOS NI ERITEMA.",
      "EXPANSIVIDAD CONSERVADA. MURMULLO VESICULAR NORMAL. SIN AGREGADOS.",
      "SIMÉTRICA, ESTABLE, NO DOLOROSA A LA MANIOBRA DE COMPRESIÓN.",
      "PABELLONES NORMALES. CONDUCTOS PERMEABLES. MEMBRANAS ÍNTEGRAS.",
      "SIMÉTRICO, SIN DEFORMIDADES. DINÁMICA RESPIRATORIA NORMAL.",
      "BLANDO, DEPRIMIBLE, NO DOLOROSO. SIN VISCEROMEGALIAS NI SIGNOS PERITONEALES.",
      "ARCOS MÓVILES COMPLETOS. FUERZA 5/5. SIN EDEMAS NI CIANOSIS.",
      "GLASGOW 15/15. PARES CRANEALES ÍNTEGROS. SIN SIGNOS DE FOCALIDAD.",
      "LLENADO CAPILAR < 2 SEG. PULSOS DISTALES PRESENTES. SIN VÁRICES.",
  ];

  function _casillasExamenFisico() {
      return Array.from(document.querySelectorAll('input[id="alert_message"][type="text"]'))
          .filter((el) => el.offsetParent !== null);
  }

  function createExamenFisicoInjectorUI() {
      if (document.getElementById("vgl-examen-normalidad")) return;

      const btnNormalidad = document.createElement("button");
      btnNormalidad.id = "vgl-examen-normalidad";
      btnNormalidad.innerHTML = "🩺 Normalidad fija";
      btnNormalidad.title = "Pega, casilla por casilla y en el mismo orden, la plantilla FIJA de normalidad semiológica que trae el script — SOLO en las casillas que estén vacías. Nunca sobrescribe una que ya tenga texto.";
      btnNormalidad.className = "vgl-exf-btn vgl-exf-btn-normalidad";

      btnNormalidad.onclick = () => {
          uxTrack("examenFisico.normalidadFija.click");
          const candidatos = _casillasExamenFisico();
          if (!candidatos.length) {
              alert("No se encontraron casillas de Revisión por sistema / Examen físico en esta pantalla.");
              return;
          }
          // LA CASILLA DEL MÉDICO ES SAGRADA: nunca se sobrescribe una casilla con contenido,
          // y solo se recorre hasta el menor de los dos tamaños. A pedido del médico, este
          // botón no pide confirmación — un solo clic — pero la regla de no-sobrescribir no
          // se negocia.
          const porAplicar = [];
          const n = Math.min(candidatos.length, EXAMEN_FISICO_NORMALIDAD_FIJA.length);
          for (let i = 0; i < n; i++) {
              const actual = String(candidatos[i].value == null ? "" : candidatos[i].value).trim();
              if (actual === "") porAplicar.push({ el: candidatos[i], texto: EXAMEN_FISICO_NORMALIDAD_FIJA[i] });
          }
          if (!porAplicar.length) {
              alert("No hay ninguna casilla vacía que la plantilla fija pueda completar en esta pantalla.");
              return;
          }
          const desajuste = candidatos.length !== EXAMEN_FISICO_NORMALIDAD_FIJA.length;
          const aviso = desajuste
            ? "\n\n⚠️ Esta pantalla tiene " + candidatos.length + " casilla(s) y la plantilla fija trae " + EXAMEN_FISICO_NORMALIDAD_FIJA.length + ". El orden podría no coincidir exactamente — revisa el resultado antes de guardar la historia."
            : "";
          porAplicar.forEach(({ el, texto }) => setNgValue(el, texto));
          uxTrack("examenFisico.normalidadFija.aplicada", { n: porAplicar.length, desajuste });
          alert("✅ Se rellenaron " + porAplicar.length + " casilla(s) vacías con la plantilla fija de normalidad."
            + (candidatos.length - porAplicar.length > 0 ? "\n\n✋ Las demás ya tenían texto o quedan fuera de la plantilla, y se respetaron." : "")
            + aviso);
      };

      document.body.appendChild(btnNormalidad);
  }

  // v12.3.14 — ERRADICADO el MutationObserver global del Robot Athenea (initLabMutationObserver).
  // Observaba document.body ENTERO con { childList: true, subtree: true }: en la SPA de
  // Angular de Everest eso son cientos de mutaciones por minuto, y CADA ráfaga despertaba
  // un debounce de 300 ms solo para decidir si tocaba crear el botón Auto-Labs — CPU
  // quemada vigilando el universo para una pregunta que se responde con un getElementById.
  // La misma validación viaja ahora en el bucle tick() ya existente (rama "historia", en
  // TODA pestaña, SIN condicionar a leader: el observador también corría en todas): la
  // llamada es barata porque createLabInjectorUI es idempotente con su botón (si
  // #vgl-lab-injector ya existe no crea nada) y el robot automático conserva intacta su
  // semántica de una-vez-por-paciente (la guarda lastAutoFetchedDoc de
  // autoFetchAtheneaLabsForActivePatient, que corre ANTES de esa comprobación a
  // propósito: así un cambio de paciente en la misma historia sí re-dispara la búsqueda).
  // Se conserva ESTA única llamada de arranque —reemplazo del bootstrap del observador—
  // para que el botón aparezca sin esperar el primer tick cuando el script se instala
  // ya dentro de una historia clínica abierta.
  if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { if (seccionActiva() === "historia") { createLabInjectorUI(); createExamenFisicoInjectorUI(); } });
  } else if (seccionActiva() === "historia") {
      createLabInjectorUI();
      createExamenFisicoInjectorUI();
  }





  const PAGEWIN = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;

  // =====================================================================
  //  SECOPS Y ESTABILIDAD (VIGILANTE DE AGENDA)
  // =====================================================================

  function debounceVgl(func, wait) {
      let timeout;
      return function(...args) {
          const context = this;
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(context, args), wait);
      };
  }

  // Saneamiento profundo y recursivo de PHI/PII (R1.4, R1.5)
  function scrubPII(input) {
    if (input == null || typeof input === "boolean") return input;
    if (typeof input === "number") {
      if (input >= 100000 && input <= 9999999999) return "[CENSURADO]";
      return input;
    }
    if (Array.isArray(input)) return input.map(scrubPII);
    if (typeof input === "object") {
      const res = {};
      for (const k of Object.keys(input)) {
        res[k] = scrubPII(input[k]);
      }
      return res;
    }
    let str = String(input);
    str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[CORREO_CENSURADO]");
    str = str.replace(/(?:Av(?:enida)?\s+El\s+Dorado|\b(?:Calle|Cra|Carrera|Cl|Diag|Diagonal|Transv|Transversal|Av|Avenida)(?:\s+[a-zA-Z0-9]+)?)\s*#\s*[\d-]+/gi, "[DIR_CENSURADA]");
    str = str.replace(/(?:\+57\s*)?(?:\(?3\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{4}|\b3\d{9}\b)/g, "[TEL_CENSURADO]");
    str = str.replace(/\b\d{1,3}(?:[.-]\d{3}){1,3}\b/g, "[CENSURADO]");
    str = str.replace(/(?<=\b|_)\d{6,10}(?=\b|_)/g, "[CENSURADO]");
    return str;
  }
  function sanitizePII(input) {
    return scrubPII(input);
  }

  // v11.0.1 — RETIRADA la telemetría remota a ".../AKfycby_TELEMETRY/exec". Ese
  // identificador es un marcador de posición (los reales tienen ~60 caracteres): NADIE
  // recibía nada. Y se disparaba con CUALQUIER error de la página, incluidos los de
  // Angular y los de la propia Everest, ajenos al Vigilante, generando peticiones
  // inútiles todo el día. El registro local (vglLog) ya cubre la depuración sin que
  // ningún dato salga del equipo.

  // v11.0.1 — RETIRADO el "modo desarrollador": siete clics sobre el número de versión
  // abrían un cuadro pidiendo un PIN y, si se acertaba, recargaba la página. La marca que
  // guardaba (__vgl_dev_mode) NO SE LEE EN NINGÚN SITIO, así que no revelaba nada: para el
  // médico solo era una recarga inesperada a mitad de consulta.
 // ventana real de la página (sandbox de Tampermonkey)

  // =====================================================================
  //  CESIÓN DEL HILO POR PRESUPUESTO DE TIEMPO (v7.8)
  //  Todo trabajo pesado (leer el Excel, indexar, caché) pasa por aquí: cada
  //  ~15 ms MEDIDOS se devuelve el control al navegador. MessageChannel y no
  //  setTimeout: los timeouts anidados se recortan a 4 ms mínimo y harían el
  //  trabajo total mucho más lento; el canal de mensajes despacha de inmediato.
  //  En un equipo lento cada tramo rinde menos filas, así que cede MÁS seguido
  //  él solo — es autoadaptativo, sin números mágicos por modelo de PC.
  // =====================================================================
  const YIELD_MC = (typeof MessageChannel !== "undefined") ? new MessageChannel() : null;
  // COLA (no ranura única): cada cesión pendiente guarda SU resolución y cada mensaje
  // del canal despierta exactamente a una, en orden. Con una ranura única, dos tareas
  // cediendo a la vez (lector de la base + sondeo de caché de 60 s) se pisaban y una
  // quedaba colgada para siempre — lo cazó la auditoría adversarial, reproducido 5/5.
  const yieldQueue = [];
  if (YIELD_MC) YIELD_MC.port1.onmessage = () => { const r = yieldQueue.shift(); if (r) r(); };
  function yieldNow() {
    if (YIELD_MC) return new Promise((r) => { yieldQueue.push(r); YIELD_MC.port2.postMessage(0); });
    return new Promise((r) => setTimeout(r, 0));
  }
  function makeYielder(budgetMs) {
    const budget = budgetMs || 15;
    let last = performance.now();
    return async function () {
      const now = performance.now();
      if (now - last < budget) return false;
      await yieldNow();
      last = performance.now();
      return true;
    };
  }
  // Ejecutar cuando el navegador esté libre (con tope): para diferir trabajo del boot.
  function idleRun(fn, timeoutMs) {
    try { if (typeof requestIdleCallback === "function") { requestIdleCallback(() => fn(), { timeout: timeoutMs || 4000 }); return; } } catch (e) {}
    setTimeout(fn, 700);
  }

  // =====================================================================
  //  AJUSTES DEL USUARIO (v5.0) — se guardan en el navegador y sobreviven
  //  a los reinicios. Se editan desde el botón "Ajustes" del panel.
  // =====================================================================
  const SETTINGS_KEY = "vgl_cfg";
  const DEFAULTS = {
    tolerancia: 6.0,          // minutos de gracia antes de marcar inasistencia
    refresco: 5,              // segundos entre lecturas
    tema: "oscuro",           // oscuro | claro | auto (sigue a Windows)
    sonido: true,             // tonos por color
    volumen: 0.15,            // 0.02 – 0.60
    insistir: true,           // el rojo repite el sonido hasta reconocer
    popup: false,             // ventana emergente en la barra de tareas
    cartel: false,            // cartel grande dentro de Everest (apagado: solo Windows)
    parpadeo: false,          // pestaña + favicon parpadeando (apagado: solo Windows)
    excluir: "vdrl,sifilis,hepatitis,hepb,hepc,hvc,vhc,hbv,vhb", // PyM a ocultar (VIH nunca se oculta)
    recordatorio: "07:30",    // avisa si a esta hora aún no hay PyM cargado ("" = nunca)
    baseAuto: true,           // bajar la base PyM de la sede UNA vez al día (por identificador)
    respaldoId: "",           // opcional: otro archivo de base (enlace o identificador)
    reporte: false,           // reporte MÍNIMO al tablero (Default-off R1.8)
    equipo: "",               // etiqueta del PUESTO (ej. "Consultorio 3"), NO un dato personal
    reporteUrl: "",           // opcional: otra Web App de Google (vacío = la de fábrica)
    modoRendimiento: false,   // apaga el blur/vidrio por completo (equipos muy viejos)
    recordatorioPym: true,    // recordatorio (calmado) de PyM pendiente al abrir la historia
    bannerPym: true,          // v14.0.0 (T7) — banner superior de PyM en vez del aviso modal.
                              // INTERRUPTOR DE EMERGENCIA: en false se quita el banner y vuelve
                              // el aviso modal de siempre (ver la red de seguridad en tick()).
                              // Nunca deja al médico sin ninguna de las dos alertas.
    abandonoPES: true,        // alarma de abandono en riesgo cardiovascular (Abandonados_PES="Si")
    labsVencidos: true,       // aviso ROJO de laboratorios RCV sin resultado en los últimos 180 días (v12.5.7)
    agendamientoRapido: true, // agendamiento de citas de control/PyM en 1-clic desde el panel (v7.9)
    smsRecordatorio: true,    // enviar al paciente el SMS de recordatorio al crear la cita (v11.0.1)
    atheneaAutoLogin: true,   // v12.5.2 — ENCENDIDO de fábrica: cuenta única compartida por la sede (ver aviso de seguridad junto a atheneaCredsGet). Sin credenciales guardadas, simplemente no hace nada.
    uxTelemetria: false,      // v12.5.0 — telemetría desactivada de fábrica (Default-off R1.8)
    opcionesTecnicas: false,  // mostrar los ajustes avanzados en la hoja de Ajustes (v12.0.0)
    medicoNombre: "",          // opcional: nombre manual del médico (si difiere del auto-detectado)
    medicoId: 0,              // opcional: ID manual del médico
  };
  function safeReadJSON(k, def) {
    try {
      const r = localStorage.getItem(k);
      if (r === null || r === undefined) return def;
      return JSON.parse(r);
    } catch (e) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const qKey = `vgl_quarantine_${k}_${Date.now()}`;
          localStorage.setItem(qKey, raw);
        }
      } catch (e2) {}
      return def;
    }
  }
  function readJSON(k, def) { return safeReadJSON(k, def); }

  // v12.3.13 — Purga de emergencia cuando setItem lanza por cuota llena: libera el
  // ~40% más viejo de las estadísticas y bitácoras DEL PROPIO script (deja 18 de los
  // 30 días), reutilizando purgeOld y purgeEventDays con ventana reducida. Jamás toca
  // claves ajenas de Everest.
  function purgaPorCuota() {
    try {
      const dias = 18;
      try { const a = safeReadJSON("vgl_stats", {}) || {}; purgeOld(a, dias); localStorage.setItem("vgl_stats", JSON.stringify(a)); } catch (e) {}
      try { purgeEventDays(dias); } catch (e) {}
      if (!quotaAvisada) { quotaAvisada = true; console.warn("[Vigilante] Almacenamiento del navegador lleno (QuotaExceeded): se purgó lo más viejo de los registros propios (vgl_*) y se reintenta la escritura."); }
    } catch (e) {}
  }

  function safeWriteJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) {
      purgaPorCuota();
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e2) { return false; }
    }
  }
  function writeJSON(k, v) { return safeWriteJSON(k, v); }

  const SCHEMA_TARGET_VERSION = 14;
  function migrarEsquemaVgl() {
    let schema = safeReadJSON("vgl_schema", null);
    if (!schema || typeof schema !== "object") {
      schema = { version: 0, migrationsApplied: [] };
    }
    if (schema.version > SCHEMA_TARGET_VERSION) {
      try {
        localStorage.setItem(`vgl_future_backup_${schema.version}_${Date.now()}`, JSON.stringify(schema));
      } catch (e) {}
      return schema;
    }
    const applied = Array.isArray(schema.migrationsApplied) ? [...schema.migrationsApplied] : [];
    let v = schema.version || 0;
    if (v < 4) {
      applied.push("v0->v4: normalizar configuraciones");
      v = 4;
    }
    if (v < 7) {
      applied.push("v4->v7: purga de eventos legados");
      try { localStorage.removeItem("vgl_events"); } catch (e) {}
      try { localStorage.setItem("vgl_v73", "1"); } catch (e) {}
      v = 7;
    }
    if (v < 12) {
      applied.push("v7->v12: migracion de agenda y RCV");
      v = 12;
    }
    if (v < 13) {
      applied.push("v12->v13: modularizacion de storage");
      v = 13;
    }
    if (v < 14) {
      applied.push("v13->v14: esquema unificado v14");
      v = 14;
    }
    const nuevo = Object.assign({}, schema, { version: 14, migrationsApplied: applied, updated: new Date().toISOString() });
    safeWriteJSON("vgl_schema", nuevo);
    return nuevo;
  }

  const _circuitBreakers = new Map();
  function getCircuitBreaker(endpointKey) {
    if (!_circuitBreakers.has(endpointKey)) {
      _circuitBreakers.set(endpointKey, {
        state: "CLOSED",
        failures: 0,
        threshold: 3,
        resetTimeoutMs: 60000,
        nextAttemptTs: 0
      });
    }
    return _circuitBreakers.get(endpointKey);
  }

  async function circuitBreakerExec(endpointKey, fn, fallbackFn) {
    const cb = getCircuitBreaker(endpointKey);
    const now = Date.now();
    if (cb.state === "OPEN") {
      if (now >= (cb.nextAttemptTs || 0)) {
        cb.state = "HALF-OPEN";
      } else {
        if (typeof fallbackFn === "function") return fallbackFn();
        return null;
      }
    }
    try {
      const result = await fn();
      if (cb.state === "HALF-OPEN") {
        if (result === null || result === undefined) {
          cb.state = "OPEN";
          cb.resetTimeoutMs = Math.min(300000, (cb.resetTimeoutMs || 60000) * 2);
          cb.nextAttemptTs = Date.now() + cb.resetTimeoutMs;
          if (typeof fallbackFn === "function") return fallbackFn();
          return null;
        }
        cb.state = "CLOSED";
        cb.failures = 0;
        cb.resetTimeoutMs = 60000;
      } else if (cb.state === "CLOSED") {
        cb.failures = 0;
      }
      return result;
    } catch (err) {
      cb.failures++;
      if (cb.state === "HALF-OPEN") {
        cb.state = "OPEN";
        cb.resetTimeoutMs = Math.min(300000, (cb.resetTimeoutMs || 60000) * 2);
        cb.nextAttemptTs = Date.now() + cb.resetTimeoutMs;
      } else if (cb.failures >= cb.threshold) {
        cb.state = "OPEN";
        cb.nextAttemptTs = Date.now() + (cb.resetTimeoutMs || 60000);
      }
      if (typeof fallbackFn === "function") return fallbackFn(err);
      return null;
    }
  }

  function invalidarApiSiCambioMedico(nuevoMedicoId) {
    if (!nuevoMedicoId) return;
    const previo = localStorage.getItem("vgl_api_medico");
    if (previo && String(previo) !== String(nuevoMedicoId)) {
      localStorage.removeItem("vgl_api_url");
      if (state.apiCitas) state.apiCitas = null;
      state.apiEn = 0;
      state.lastSnapshot = null;
      state.lastSignature = "";
    }
    localStorage.setItem("vgl_api_medico", String(nuevoMedicoId));
  }

  const S = Object.assign({}, DEFAULTS, readJSON(SETTINGS_KEY, {}));
  // Migración desde v4.x: la ventana emergente se guardaba en una clave aparte.
  try { const viejo = localStorage.getItem("vgl_popup"); if (viejo !== null && !("popup" in (readJSON(SETTINGS_KEY, {}) || {}))) S.popup = viejo === "1"; } catch (e) {}
  // Migración a v7.3 MODO LIGERO (una sola vez): en instalaciones que ya tenían ajustes
  // guardados se apagan los canales extra.
  try {
    if (localStorage.getItem("vgl_v73") !== "1") {
      localStorage.setItem("vgl_v73", "1");
      S.cartel = false; S.parpadeo = false; S.popup = false;
      writeJSON(SETTINGS_KEY, S);
    }
  } catch (e) {}
  function saveSettings() { writeJSON(SETTINGS_KEY, S); applySettings(); }
  // --- PREVENCIÓN DE DUPLICADOS EN CITAS Y ÓRDENES (diario, resetea a medianoche) ---
  const PROC_KEY = "vgl_proc_today";
  function getProcessedToday() {
    const today = todayStamp();
    const data = readJSON(PROC_KEY, null);
    if (!data || data.dia !== today) {
      const fresh = { dia: today, citas: [], ordenes: [] };
      writeJSON(PROC_KEY, fresh);
      return fresh;
    }
    return data;
  }
  function isCitaAgendadaHoy(docId) {
    if (!docId) return false;
    const p = getProcessedToday();
    return p.citas && p.citas.includes(String(docId));
  }
  function isOrdenesCreadasHoy(docId) {
    if (!docId) return false;
    const p = getProcessedToday();
    return p.ordenes && p.ordenes.includes(String(docId));
  }
  // v12.3.28 — "ID y bloqueo de seguridad" independiente para cita de control y toma de
  // muestras. Pedido explícito en consultorio: si la cita de control se creó pero la
  // toma de muestras falló (turno agotado, red caída), o viceversa, la que SÍ se creó
  // debe quedar bloqueada para evitar un duplicado, y la que quedó pendiente debe seguir
  // disponible — no las dos juntas como un solo bloque, como hasta ahora. Se guarda
  // también la fecha REAL de la cita de control agendada (fechaIso): si más tarde el
  // médico solo necesita reintentar el laboratorio, hace falta esa fecha para calcular
  // "5 días hábiles antes" sin volver a pasar por la creación de la cita (que ya existe).
  function isLabAgendadaHoy(docId) {
    if (!docId) return false;
    const p = getProcessedToday();
    return !!(p.labs && p.labs.includes(String(docId)));
  }
  // Fecha (ISO) de la cita de control agendada hoy para este paciente — null si no hay
  // ninguna, o si se agendó antes de esta versión y no quedó guardada.
  function citaAgendadaFechaHoy(docId) {
    if (!docId) return null;
    const p = getProcessedToday();
    return (p.citasDetalle && p.citasDetalle[String(docId)] && p.citasDetalle[String(docId)].fechaIso) || null;
  }
  function markCitaAgendadaHoy(docId, fechaIso) {
    if (!docId) return;
    const p = getProcessedToday();
    const sDoc = String(docId);
    let cambio = false;
    if (!p.citas.includes(sDoc)) { p.citas.push(sDoc); cambio = true; }
    if (fechaIso) {
      if (!p.citasDetalle) p.citasDetalle = {};
      p.citasDetalle[sDoc] = { fechaIso, ts: Date.now() };
      cambio = true;
    }
    if (cambio) { writeJSON(PROC_KEY, p); state.lastSignature = ""; repaint(); }
  }
  function markLabAgendadaHoy(docId) {
    if (!docId) return;
    const p = getProcessedToday();
    const sDoc = String(docId);
    if (!p.labs) p.labs = [];
    if (!p.labs.includes(sDoc)) { p.labs.push(sDoc); writeJSON(PROC_KEY, p); state.lastSignature = ""; repaint(); }
  }
  // v12.3.x — "ID y bloqueo de seguridad": además del booleano de dedup (p.ordenes, ya
  // existente), se guarda el/los agrupador(es) REALES que Everest asignó a la orden —
  // el mismo id que usa el propio botón oficial para reimprimir o reenviar. Con esto el
  // botón deshabilitado en el panel y el envío por correo saben CUÁL orden ya existe,
  // no solo QUE existe. Reemplaza a guardarOrdenEnMemoriaLocal (nunca se implementó:
  // era un `if (typeof ... === 'function')` que siempre evaluaba false, código muerto).
  // v12.4.0 — Además de los agrupadores, se guardan las ACTIVIDADES del Excel que cada
  // orden cubrió (las etiquetas de pymPorPaquete): así el aviso al abrir la historia
  // puede mostrar SOLO lo que sigue pendiente (p. ej. las remisiones AV/OD, que no se
  // ordenan desde el panel) en vez de callarse del todo.
  function markOrdenesCreadasHoy(docId, agrupadores, actividades) {
    if (!docId) return;
    const p = getProcessedToday();
    const sDoc = String(docId);
    if (!p.ordenes.includes(sDoc)) p.ordenes.push(sDoc);
    if ((agrupadores && agrupadores.length) || actividades) {
      if (!p.ordenesDetalle) p.ordenesDetalle = {};
      const det = p.ordenesDetalle[sDoc] || {};
      det.agrupadores = [...new Set((det.agrupadores || []).concat(agrupadores || []))];
      // v12.4.1 — Un arreglo VACÍO también se persiste (det.actividades = []): significa
      // "estas órdenes no cubrieron ninguna actividad del Excel" (selección manual sin
      // coincidencia) y es distinto de "marca vieja sin detalle". Sin esta distinción,
      // el fallback de pymPendientesRestantes silenciaba tamizajes nunca ordenados.
      if (actividades) det.actividades = [...new Set((det.actividades || []).concat(actividades))];
      det.ts = Date.now();
      p.ordenesDetalle[sDoc] = det;
    }
    writeJSON(PROC_KEY, p);
    // v14.0.0 — El médico acaba de ordenar DESDE EL SCRIPT: el banner de PyM tiene que
    // enterarse ya. Sin esto seguía insistiendo con las mismas actividades hasta que
    // venciera su caché de 10 minutos (BANNER_PYM_TTL_MS) — el médico ordenaba y la franja
    // seguía pidiéndole lo mismo, que es justo el comportamiento que T7 venía a eliminar.
    // _bannerPymInvalidar existía desde T7 y NADIE la llamaba (salía como "sin cubrir" en
    // el runner). También se invalida la caché de órdenes vigentes de T6: la orden recién
    // creada ES una orden vigente nueva, y quien la consulte a continuación debe verla.
    try { _bannerPymInvalidar(); } catch (e) {}
    try { _ordenesVigentesInvalidar(); } catch (e) {}
    state.lastSignature = "";
    repaint();
  }
  // Detalle de la(s) orden(es) ya generadas hoy para este paciente — null si no hay.
  function ordenesDetalleHoy(docId) {
    if (!docId) return null;
    const p = getProcessedToday();
    return (p.ordenesDetalle && p.ordenesDetalle[String(docId)]) || null;
  }
  function applySettings() {
    CONFIG.TOLERANCIA_MIN = 6.0; // 6.0 minutos rígidos de gracia para todo el mundo
    CONFIG.POLL_MS = clampNum(S.refresco, 2, 120, DEFAULTS.refresco) * 1000;
    CONFIG.EXCLUDE_PYM = String(S.excluir || "").split(",").map((x) => stripAccents(x.trim().toLowerCase())).filter(Boolean);
    if (S.respaldoId && /\S/.test(S.respaldoId)) { const g = parseSpDocId(S.respaldoId); if (g) CONFIG.SP.respaldo = { id: g, name: "Base PyM (enlace personalizado)" }; }
    applyTheme();
    restartPolling();
  }
  function clampNum(v, lo, hi, def) { const n = parseFloat(v); if (!isFinite(n)) return def; return Math.min(hi, Math.max(lo, n)); }
  function darkPreferred() { try { return !PAGEWIN.matchMedia || PAGEWIN.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return true; } }
  function isLight() { return S.tema === "claro" || (S.tema === "auto" && !darkPreferred()); }
  function applyTheme() {
    try {
      const r = document.getElementById("vgl-root"); if (r) { r.classList.toggle("light", isLight()); r.classList.toggle("perf", !!S.modoRendimiento); }
      const d = document.getElementById("vgl-dock"); if (d) { d.classList.toggle("light", isLight()); d.classList.toggle("perf", !!S.modoRendimiento); }
      const ad = document.getElementById("vgl-acciones-dock"); if (ad) { ad.classList.toggle("light", isLight()); ad.classList.toggle("perf", !!S.modoRendimiento); }
      const pb = document.getElementById("vgl-pym-banner"); if (pb) { pb.classList.toggle("light", isLight()); pb.classList.toggle("perf", !!S.modoRendimiento); }
      const t = document.getElementById("vgl-toasts"); if (t) t.classList.toggle("light", isLight());
    } catch (e) {}
  }

  const CONFIG = {
    POLL_MS: 5000,
    TOLERANCIA_MIN: 6.0,
    // Actividades PyM a OCULTAR porque la meta ya está cumplida en la IPS (ETS: solo se
    // conserva VIH). Coincidencia por texto sin acentos/minúsculas contra encabezado+etiqueta.
    // VIH SIEMPRE se conserva. Edita esta lista si cambian las metas.
    // (hvc/vhc/hbv/vhb = como aparece la hepatitis en la base piloto)
    EXCLUDE_PYM: ["vdrl", "sifilis", "hepatitis", "hepb", "hepc", "hvc", "vhc", "hbv", "vhb"],
    // SharePoint: SOLO la base de la sede, bajada por identificador único (sourcedoc).
    SP: {
      host: "viva1aips-my.sharepoint.com",
      web: "/personal/director_bello_viva1a_com_co",
      // v7.7: carpeta donde aparece el PyM del día real (confirmada por captura real:
      // Merly Lorena Rua Quintana > INTRANET > ACTIVIDADES DE PYM, archivo suelto en
      // la raíz, tipo "Agenda_Dia_CMB_20260806.xlsx"). Es la PRIMERA opción; la base
      // piloto de abajo queda como respaldo mientras no aparezca la de hoy.
      folder: "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM",
      folders: [
        "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM",
        "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM/CITAS DIA EBS",
        "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM/ESTRATEGIAS POR SEDE 2026/SEDE BELLO"
      ],
      respaldo: {
        id: "809a098b-69d1-44fe-9e51-b01f07290807",
        name: "BASE PILOTO DE CONSULTA  BELLO MAYO.xlsx",
      },
      // v7.8.3: enlace de compartir de la carpeta (generado desde SharePoint: "Compartir"
      // → "Cualquier persona con el vínculo" / "Personas de la organización"). Visitarlo
      // le da a ESTE navegador una cookie de acceso anónimo válida para esa carpeta, sin
      // que el médico tenga que iniciar sesión en SharePoint con su usuario. Se "recarga"
      // cada cierto tiempo (primeShareAccess) antes de listar/descargar.
      shareLink: "https://viva1aips-my.sharepoint.com/:f:/g/personal/director_bello_viva1a_com_co/IgCsGP_chaHvTKYH9v-QZ2Q1AQuJo3umR5gDLjKlkUqgPS4?e=jscdBl",
    },
    SEL: {
      hora: ".labelHora", estado: ".status-label", contenedor: [".card-body", ".card"],
      documento: ".text-muted", nombre: [".text-uppercase.fw-bold", ".text-uppercase"],
      modalidad: ".fw-bold.mb-0", fecha: ".fecha",
    },
  };
  // [UI-CSS] Paleta clínica suavizada (WCAG compliant, tono no estresante)
  const COLORS = { VERDE: "#10B981", AMBAR: "#D97706", ROJO: "#E54D42", AZUL: "#2563EB", MORADO: "#9333EA" };
  const TINT = { VERDE: "rgba(16,185,129,.16)", AMBAR: "rgba(217,119,6,.16)", ROJO: "rgba(229,77,66,.16)", AZUL: "rgba(37,99,235,.16)", MORADO: "rgba(147,51,234,.16)" };
  // v7.8.1: etiquetas ACCIONABLES, confirmadas por el médico del programa (no adivinadas):
  //  - Tamización CMB = riesgo cardiometabólico según Resolución 3280/2018 (el nombre del
  //    archivo "Agenda_Dia_CMB" es la sede/contrato, NO la prueba — se aclaró a propósito).
  //  - Tamización mama = examen clínico de mama Y mamografía juntos bajo un solo estado.
  //  - Tamización colon = Sangre Oculta en Materia Fecal (SOMF), no una colonoscopia.
  //  - Cita_AV/OD/PF pasan de nombrar la cita a decir la remisión concreta.
  //  - Tamización cérvix: el TIPO de prueba (VPH / citología-CCU) se funde en el mismo
  //    chip cuando el dato lo trae — ver PRUEBA_CERVIX y detalleTipoCervix() más abajo.
  // [COPY-UX] Diccionario clínico simplificado para actividades de prevención
  // v12.4.0 — Los nombres de los tamizajes ahora son LOS DE LA TABLA OFICIAL de CUPS de
  // la IPS ("ACTIVIDAD SUSCEPTIBLE"): el mismo nombre que ve el médico en el panel es el
  // que encabeza el paquete de ordenamiento (PYM_CATALOG), sin traducciones intermedias.
  // Las remisiones (PF/AV/OD) y la valoración integral no están en esa tabla y conservan
  // su etiqueta clínica. Hepatitis B/C y VDRL siguen con nombre por si el médico las
  // desoculta en Ajustes, aunque de fábrica quedan excluidas (solo se tamiza VIH en ETS).
  const FRIENDLY = {
    VALORACION_INTEGRAL: "Valoración integral de salud", TAMIZACION_CMB: "Tamización cardiometabólica",
    CITA_PF: "Remisión a Planificación Familiar", CITA_AV: "Remisión a Optometría", CITA_OD: "Remisión a Odontología",
    TAMIZACION_CERVIX: "Cáncer de cuello uterino", TAMIZACION_PROSTATA: "PSA (antígeno de próstata)",
    PRUEBA_CERVIX: "Cáncer de cuello uterino", TAMIZACION_MAMA: "Mamografía",
    TAMIZACION_COLON: "SOMF (sangre oculta en materia fecal)",
    TAMIZACION_HEPC: "Tamización de Hepatitis C", TAMIZACION_HEPB: "Tamización de Hepatitis B",
    TAMIZACION_VDRL: "Tamización de Sífilis", TAMIZACION_HB: "Hemoglobina",
    TAMIZACION_VIH: "VIH", TAMIZACION_HTO: "Hematocrito",
    "Último VIH": "VIH", "Ultimo VIH": "VIH",
    "Última SOMF": "SOMF (sangre oculta en materia fecal)", "Ultima SOMF": "SOMF (sangre oculta en materia fecal)",
  };
  // [COPY-UX] Detalle clínico de la prueba de cérvix
  function detalleTipoCervix(valorCrudo) {
    const s = stripAccents(String(valorCrudo || "").toLowerCase());
    if (s.includes("vph")) return "VPH";
    if (s.includes("ccu") || s.includes("citolog")) return "citología cervicouterina";
    return String(valorCrudo || "").trim();               // valor tal cual si no se reconoce
  }
  const DOC_EXACT = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];

  const GHOST = {
    promises: new Map(),
    hoverTimers: new Map(), // v8.1.0: Timer tracking para Debounce
    listeners: new Set(),
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    notify(prop, val) { this.listeners.forEach(fn => { try { fn(prop, val); } catch(e){} }); }
  };

  const rawState = {
    pym: new Map(), pymTodos: null, pymAbandono: new Set(), pymFile: "", pymMTime: "", pymFP: "", pymFallback: false, pymHoja: "", pymDia: "", historical: new Map(),
    fraudWatch: new Set(), alertedFraud: new Set(), warnedTimes: new Set(),
    lastSignature: "", minimized: false, lastSnapshot: null,
    notified: new Map(), summarized: false, osNotif: false,
    lastVersionCheck: 0, versionCheckUrl: "https://script.google.com/macros/s/AKfycbwXwwQdSGGMyt4X6Wf5YbJVRZjB_z_cYEVVpRoebO_VrobIhtHKD3nAJs689kq3R7tC/exec",
    leader: false, shared: null,
    // v5.0
    filtro: "todas", busqueda: "", muteUntil: 0, sheet: null, lastRefresh: null,
    apiCitas: null, apiEn: 0,
    // v7.8.1: true SOLO si el propio script recogió el panel a la pastilla por estar
    // fuera de agenda/historia clínica — para no pelear con un "×" que el médico haya
    // pulsado a propósito (ese no se auto-restaura al volver a una vista permitida).
    autoDocked: false,
    // Última ventana elegida DE VERDAD por el médico (×/−/+, doble clic, o restaurada
    // al abrir la página). El auto-recogido/auto-restaurado por sección nunca la toca.
    userWinState: "full",
    // v7.9.0: médico activo detectado dinámicamente desde la sesión / API
    activeDoctor: { id: 0, name: "" },
    // Red de seguridad remota y Kill-Switch (R5.1, R5.3)
    killed: false,
    killReason: "",
    disabledFeatures: new Set(),
    timers: [],
    // Detección de Instancia Duplicada (R5.8)
    isDuplicateInstance: false,
    duplicateVersion: "",
  };

  const state = new Proxy(rawState, {
    set(target, prop, val) {
      target[prop] = val;
      GHOST.notify(prop, val);
      return true;
    }
  });
  // v11.0.1 — Ya NO se cuelga el estado interno de la ventana real de la página. Exponía
  // en `window.state` el mapa completo de pacientes con PyM pendiente (cédulas y
  // actividades) al alcance de cualquier script cargado por Everest.
  try { PAGEWIN.vglDebug = { version: VERSION, pymSize: () => state.pym.size, leader: () => state.leader }; } catch (e) {}
  // v12.0.0 — RETIRADO todo lo demás que colgaba de la ventana real de la página. Arriba
  // queda solo `vglDebug`, que no contiene ningún dato de paciente. Lo eliminado y por qué:
  //
  //  · simularCitasDirectas — cableaba TRES cédulas inventadas con actividades de PyM
  //    ficticias (una de ellas marcada como abandono del programa cardiovascular) y las
  //    pintaba en el panel EXACTAMENTE igual que a los pacientes reales, además de dejar
  //    state.pymFile en "Base_Simulada_PyM.xlsx". Un dato clínico fabricado indistinguible
  //    del real no puede viajar en el script que se usa en consulta.
  //  · openAgendamientoModal / openOrdenamientoModal / openLaboratoriosModal — publicaban,
  //    con parámetro libre, los tres modales que terminan en ESCRITURAS clínicas (crear
  //    cita, crear orden, volcar laboratorios en la historia). Cualquier script de la
  //    página podía abrirlos con una cita fabricada. Se siguen invocando desde los botones
  //    de cada tarjeta, dentro del script: no hacía falta ningún puente por window.
  //  · vglLog / vglExportLogs — daban acceso a la bitácora que respalda el registro de
  //    atenciones extemporáneas e inasistencias: permitían insertar entradas falsas o
  //    desplazar las reales por el tope de 500, y disparar la descarga sin intervención
  //    del médico. La exportación sigue disponible desde el botón de Ajustes.
  //  · repaint / renderSettings — superficie expuesta sin necesidad; ya se llaman desde
  //    los propios controles del panel.
  let pollTimer = null;
  function restartPolling() { if (!el || !el.root) return; if (pollTimer) clearInterval(pollTimer); pollTimer = setInterval(tick, CONFIG.POLL_MS); }
  // ---- Coordinación entre pestañas: SOLO UNA vigila y notifica (evita avisos repetidos) ----
  const TABID = String(Math.random()).slice(2) + Date.now();

  let chan = null;
  try { chan = new BroadcastChannel("vgl"); chan.onmessage = (e) => { if (e.data && e.data.t) state.shared = e.data; }; } catch (e) {}

  // v12.3.36 — DESCUBIERTO EN CONSULTORIO (panel clavado en "Última lectura...
  // vuelve a Citas del día" + cero avisos de confirmación durante toda la jornada):
  // Edge SUSPENDE las pestañas en segundo plano, y el candado de Web Locks (v8.1.0)
  // lo retenía una pestaña CONGELADA — sus temporizadores no corren, no sondea la
  // agenda ni avisa, y ninguna otra pestaña podía relevarla porque el candado seguía
  // ocupado hasta cerrar esa pestaña. Con el flujo real del consultorio (cada
  // historia clínica abre pestaña NUEVA y la original queda atrás), el "líder"
  // terminaba siendo siempre una pestaña dormida: vigilancia muerta todo el día.
  //
  // Se vuelve al latido en localStorage, pero con RELEVO AUTOMÁTICO: el líder
  // renueva su latido cada ≤5 s (ver el bucle de la ventana crítica); si el latido
  // lleva más de 20 s sin renovarse (líder congelado o cerrado en frío), la primera
  // pestaña despierta que lo note toma el mando y fuerza una lectura de agenda
  // inmediata. El doble-líder transitorio de un empate es inofensivo: los avisos ya
  // se deduplican entre pestañas (crossTabDup) y una consulta de agenda repetida no
  // daña nada. Al cerrarse con orden, el líder suelta su latido para que el relevo
  // sea instantáneo en vez de esperar los 20 s.
  const LEADER_KEY = "vgl_leader_beat", LEADER_TTL_MS = 20000;
  state.leader = false;
  // v14.1.5 — AVISOS TARDÍOS (reportado por los compañeros del médico, 14-ago-2026:
  // "a veces no te avisa con tiempo, es como si estuvieran asincrónicas").
  //
  // El sondeo vive en `setInterval(tick, 5000)` DENTRO de la pestaña líder. Y el líder
  // se elegía por orden de llegada, sin mirar si esa pestaña está a la vista. Ahí está
  // la causa: **el navegador estrangula los temporizadores de las pestañas OCULTAS a
  // uno por minuto** (y pasados unos minutos aplica el estrangulamiento intensivo). Si
  // la pestaña que ganó el liderazgo es la de la agenda y el médico se pasa a trabajar
  // en la historia clínica —que es lo normal—, el vigilante deja de latir cada 5 s y
  // late cada 60 s: un aviso que debía sonar al minuto 0 sale hasta 60 s tarde.
  //
  // Y hay un efecto encadenado: LEADER_TTL_MS son 20 s, MENOS que los 60 s del
  // estrangulamiento. El líder oculto ni siquiera alcanza a renovar su propio latido,
  // así que otra pestaña se lo queda y el liderazgo rebota.
  //
  // Arreglo: una pestaña VISIBLE puede quitarle el liderazgo a una OCULTA aunque su
  // latido esté fresco. Entre dos visibles (o entre dos ocultas) manda la regla de
  // siempre —el primero que llegó— para no introducir un forcejeo nuevo.
  function _pestanaOculta() {
    try { return document.visibilityState === "hidden"; } catch (e) { return false; }
  }
  const RELEVO_VISIBILIDAD_MIN_MS = 10000;
  let _ultimoRelevoVisibilidad = 0;
  function _getUltimoRelevoParaTest() { return _ultimoRelevoVisibilidad; }
  function _setUltimoRelevoParaTest(v) { _ultimoRelevoVisibilidad = v; }
  function heartbeat() {
    try {
      const ahora = Date.now();
      let beat = null;
      try { beat = JSON.parse(localStorage.getItem(LEADER_KEY) || "null"); } catch (e) {}
      const yoOculta = _pestanaOculta();
      if (beat && beat.id && beat.id !== TABID && (ahora - beat.t) < LEADER_TTL_MS) {
        // Latido ajeno y fresco. Solo se le desafía si él está oculto —y por tanto
        // estrangulado por el navegador— y yo estoy a la vista.
        // v14.1.5 — El enfriamiento NO es decorativo, y lo señaló una auditoría adversarial
        // del propio arreglo: cada toma de mando hace `API.ultimo = 0`, o sea una lectura
        // inmediata de la agenda. Con Alt+Tab rápido entre dos pestañas de Everest, cada
        // conmutación robaba el mando y disparaba su consulta, así que el servidor recibía
        // ráfagas de peticiones. Un relevo por visibilidad cada 10 s como mucho: quien de
        // verdad se quedó mirando la pestaña se lleva el mando igual, solo que sin ráfaga.
        const relevoPorVisibilidad = beat.oculta === true && !yoOculta &&
          (ahora - _ultimoRelevoVisibilidad) > RELEVO_VISIBILIDAD_MIN_MS;
        if (!relevoPorVisibilidad) {
          state.leader = false;             // hay un líder ajeno y su latido está fresco
          return false;
        }
        _ultimoRelevoVisibilidad = ahora;
        console.log("[Vigilante] Relevo de liderazgo: la pestaña líder está oculta y el navegador le estrangula el temporizador. Toma el mando esta, que está a la vista.");
      }
      // Latido propio, vencido, inexistente, o de un líder oculto al que se releva.
      try { localStorage.setItem(LEADER_KEY, JSON.stringify({ id: TABID, t: ahora, oculta: yoOculta })); } catch (e) {}
      if (!state.leader) API.ultimo = 0;    // al tomar el relevo: agenda fresca YA, sin esperar cadencia
      state.leader = true;
      return true;
    } catch (e) { return state.leader; }
  }
  try {
    window.addEventListener("beforeunload", () => {
      try {
        const b = JSON.parse(localStorage.getItem(LEADER_KEY) || "null");
        if (b && b.id === TABID) localStorage.removeItem(LEADER_KEY);
      } catch (e) {}
    });
  } catch (e) {}

  function share(list) { try { if (chan) chan.postMessage({ t: Date.now(), list }); } catch (e) {} }

  const limpio = (s) => (s || "").replace(/\s+/g, " ").trim();
  function normalizeKey(val) {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    if (s.endsWith(".0")) s = s.slice(0, -2);
    // Celdas numéricas que Excel entrega en notación científica ("1.23457E+9"):
    // sin esto, quedarían como "1234579" y el cruce con la agenda fallaría.
    if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(s)) { const n = Number(s); if (isFinite(n)) s = n.toFixed(0); }
    // Solo dígitos y SIN ceros a la izquierda: si la base guarda la cédula rellenada
    // ("0005150076") y la agenda la trae limpia ("5150076"), deben ser la misma clave.
    return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  }
  function extractDoc(t) { if (!t) return ""; const first = t.split(",")[0].replace(/[.\s]/g, ""); let m = /^(\d{5,15})$/.exec(first); if (m) return m[1]; m = /(\d{5,15})/.exec(t.replace(/[.\s]/g, "")); return m ? m[1] : ""; }
  // Se ejecuta más de un millón de veces con las bases grandes: primero los descartes
  // baratos (vacío o texto largo) y solo después se normaliza la cadena.
  function isPending(val) {
    if (val === null || val === undefined || val === "") return false;
    const s = typeof val === "string" ? val : String(val);
    if (s.length > 32) return false;
    const t = s.trim().toLowerCase();
    return t === "susceptible" || t === "pendiente" || t.startsWith("tamizar");
  }
  // v7.8.1: exacto "Si"/"Sí" (sin acento insensible, sin distinguir mayúsculas) para
  // ABANDONADOS_PES — a propósito NO usa .includes() para no confundir con "Sin dato"
  // u otros valores que casualmente empiecen distinto. Un "No" (o vacío) nunca cuenta.
  function esSi(val) {
    if (val === null || val === undefined) return false;
    return stripAccents(String(val).trim().toLowerCase()) === "si";
  }
  function friendly(h) {
    // v12.3.24 — La etiqueta del chip se arma con el encabezado ORIGINAL del Excel (para
    // conservar tildes/mayúsculas en los headers que SÍ están bien escritos — ver
    // activityLabel más abajo), pero el diccionario FRIENDLY solo tiene claves EN
    // MAYÚSCULAS ("CITA_PF"). Si el Excel trae la columna como "Cita_PF" (mayúscula solo
    // en la inicial, como de hecho la trae la base real), la búsqueda exacta fallaba en
    // silencio y el chip mostraba el respaldo crudo "Cita PF" en vez de "Remisión a
    // Planificación Familiar" — reportado en consultorio como texto que no alcanza a
    // decir nada útil. Se prueba primero tal cual (cubre las claves con tildes del
    // diccionario, como "Último VIH") y luego en mayúsculas (cubre CITA_PF/TAMIZACION_*
    // venga como venga escrito en el Excel).
    const raw = String(h == null ? "" : h).trim();
    if (FRIENDLY[raw]) return FRIENDLY[raw];
    const upper = raw.toUpperCase();
    if (FRIENDLY[upper]) return FRIENDLY[upper];
    const bruto = raw.replace(/_/g, " ").trim();
    // Si el encabezado ya viene escrito como texto normal ("Última tamización CMB"),
    // se respeta tal cual; solo se arregla el que viene TODO EN MAYÚSCULAS.
    if (/[a-záéíóúñ]/.test(bruto)) return bruto;
    const t = bruto.toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function activityLabel(header, val) { const f = friendly(header); const s = String(val).trim().toLowerCase(); if (s === "susceptible" || s === "pendiente") return f; return `${f} — ${String(val).trim()}`; }
  function stripAccents(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function isExcludedActivity(header, label) {
    const hay = stripAccents((header + " " + label).toLowerCase());
    if (hay.includes("vih")) return false; // VIH siempre se conserva
    return CONFIG.EXCLUDE_PYM.some((k) => hay.includes(k));
  }
  function getActivities(docId) { return state.pym.get(normalizeKey(docId)) || []; }
  // v12.4.0 — Optometría (AV) y Odontología (OD) salen de los CHIPS del panel, por pedido
  // del consultorio: saturaban la fila y no son órdenes que se generen desde ahí. SIGUEN
  // en el índice PyM: el aviso al abrir la historia (pymAlert) las muestra como pendientes.
  function isPanelHiddenActivity(label) { return /optometr|odontolog/i.test(stripAccents(String(label || ""))); }
  function panelActivities(list) { return (list || []).filter((l) => !isPanelHiddenActivity(l)); }
  // v12.4.0 — Pendientes que QUEDAN para el aviso de la historia: todo lo del índice PyM
  // menos las actividades cuyas órdenes ya se generaron HOY desde el panel (el detalle
  // por actividad lo guarda markOrdenesCreadasHoy). Si el médico no ha ordenado nada,
  // devuelve la lista completa. Con órdenes de una versión vieja (sin detalle de
  // actividades) se asume que cubrieron lo ordenable y quedan solo remisiones/valoración.
  function pymPendientesRestantes(docId) {
    const pend = getActivities(docId);
    if (!pend.length) return pend;
    const det = ordenesDetalleHoy(docId);
    if (!det) return pend;
    const cubiertas = det.actividades;
    // v12.4.1 — Solo la marca de una versión ANTERIOR (campo ausente, no []) cae al
    // fallback "se asume que cubrieron lo ordenable": un [] real de hoy significa que
    // las órdenes no casaron con ninguna actividad y NADA debe silenciarse.
    if (!Array.isArray(cubiertas)) return pend.filter((l) => /optometr|odontolog|planificaci|valoraci/i.test(stripAccents(String(l || ""))));
    return pend.filter((l) => !cubiertas.includes(l));
  }

  // v7.8: el indexado ya no recibe la tabla entera — es INCREMENTAL. El lector en
  // streaming le entrega una fila a la vez y la fila se descarta al instante: nunca
  // existe el arreglo completo de 90.000 filas en memoria.
  function makeIndexer(headersRaw) {
    const crudos = headersRaw || [];
    // Array.from (no .map) para que los huecos de las hojas reales no se salten.
    const headers = Array.from({ length: crudos.length }, (_, i) => (crudos[i] == null || crudos[i] === "" ? `COL_${i}` : String(crudos[i]).trim().toUpperCase()));
    const docIdx = findDocIdx(headers);
    // [COPY-UX]
    if (docIdx < 0) throw new Error("No se encontró la columna con la identificación del paciente. Verifique el formato de la lista cargada.");
    // TODOS los documentos de la hoja (tengan o no pendientes): permite distinguir en el
    // panel "sin PyM pendiente" (está en la base, al día) de "no aparece en la base"
    // (paciente nuevo o cédula que no cruza) — dos cosas muy distintas para auditar.
    const map = new Map();
    const todos = new Set();
    // Memoria por columna: calcular la etiqueta y si se oculta implica normalizar acentos,
    // que es carísimo. Como el vocabulario de valores es diminuto ("Susceptible", "Tamizar
    // con CCU"…), se calcula una vez por columna+valor en lugar de por celda.
    const memo = [];
    // v7.8.1: PRUEBA_CERVIX se funde dentro del chip de TAMIZACION_CERVIX (VPH/citología)
    // en vez de salir como un chip "Prueba cérvix" aparte y genérico — confirmado con el
    // médico del programa. Se resuelven los índices UNA vez, no en cada fila.
    const cervixTamIdx = headers.indexOf("TAMIZACION_CERVIX");
    const cervixPruebaIdx = headers.indexOf("PRUEBA_CERVIX");
    // v7.8.1: ABANDONADOS_PES (o ABANDONADO_PES en la base vieja) — "Si" significa que el
    // paciente tiene abandono en el Programa de riesgo cardiovascular (PES) y su atención
    // de hoy debe PRIORIZAR el control de riesgo cardiovascular. No es una "actividad
    // pendiente" más (su vocabulario es Si/No, no Susceptible/Tamizar), así que se rastrea
    // aparte para poder darle color propio en la agenda y una alarma al abrir la historia.
    const abandonoIdx = headers.indexOf("ABANDONADOS_PES") >= 0 ? headers.indexOf("ABANDONADOS_PES") : headers.indexOf("ABANDONADO_PES");
    const abandono = new Set();
    return {
      map, todos, abandono,
      push(row) {
        const docKey = normalizeKey(row[docIdx]); if (!docKey) return;
        todos.add(docKey);
        if (abandonoIdx >= 0 && esSi(row[abandonoIdx])) abandono.add(docKey);
        const bucket = map.get(docKey) || [];
        let detalleCervix = "", cervixYaAgregado = false;
        if (cervixPruebaIdx >= 0) {
          const pv = row[cervixPruebaIdx];
          if (isPending(pv)) detalleCervix = detalleTipoCervix(pv);
        }
        for (let i = 0; i < headers.length; i++) {
          if (i === docIdx || i === cervixPruebaIdx || i === abandonoIdx) continue;
          const celda = row[i];
          if (!isPending(celda)) continue;
          let label;
          if (i === cervixTamIdx && detalleCervix) {
            // Con el TIPO de prueba disponible, ese detalle manda sobre el valor crudo
            // de Tamizacion_cervix (que normalmente es solo "Susceptible"/"Pendiente"
            // y no aporta nada que el médico no sepa ya).
            label = "Cáncer de cuello uterino — " + detalleCervix;
            cervixYaAgregado = true;
          } else {
            const clave = String(celda);
            let cm = memo[i] || (memo[i] = new Map());
            label = cm.get(clave);
            if (label === undefined) {
              // Etiqueta con el encabezado ORIGINAL (conserva tildes y mayúsculas);
              // la decisión de ocultar usa la versión en mayúsculas.
              const l = activityLabel((crudos && crudos[i]) || headers[i], celda);
              label = isExcludedActivity(headers[i], l) ? null : l;
              cm.set(clave, label);
            }
            if (label === null) continue;
            if (i === cervixTamIdx) cervixYaAgregado = true;
          }
          if (!bucket.includes(label)) bucket.push(label);
        }
        // Caso raro pero posible: Prueba_cervix trae un tipo de prueba pendiente pero
        // Tamizacion_cervix NO estaba pendiente en esa fila (p. ej. datos inconsistentes
        // entre columnas). No se pierde la información: se agrega igual.
        if (detalleCervix && !cervixYaAgregado) {
          const label = "Cáncer de cuello uterino — " + detalleCervix;
          if (!bucket.includes(label)) bucket.push(label);
        }
        // Solo se guardan los pacientes que SÍ tienen algo pendiente. Así el número que
        // muestra el panel es el útil, y si por error se leyera la hoja equivocada el
        // contador se va a cero y salta a la vista en lugar de engañar.
        if (bucket.length) map.set(docKey, bucket);
      },
    };
  }
  // Para tablas ya materializadas (CSV): misma lógica, cediendo el hilo por tandas.
  async function indexRowsAsync(headersRaw, rows, maybeYield) {
    const ix = makeIndexer(headersRaw);
    for (let i = 0; i < rows.length; i++) {
      ix.push(rows[i]);
      if (maybeYield && (i & 1023) === 0) await maybeYield();
    }
    return { map: ix.map, todos: ix.todos, abandono: ix.abandono };
  }
  function parseCSV(text) { return text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length).map((l) => l.split(",")); }

  // =====================================================================
  //  LECTOR DE EXCEL BLINDADO (v5.4) + STREAMING (v7.8)
  //  Pensado para aguantar archivos reales, no solo el PyM diario limpio:
  //   - Libros con VARIAS hojas: elige la correcta por CONTENIDO (la que
  //     tenga columna de documento y celdas "Susceptible"), no la primera.
  //   - Hojas gigantes (decenas de MB): v7.8 — se descomprimen POR TROZOS y
  //     cada fila se indexa y se descarta al vuelo. La base piloto infla a
  //     110 MB de XML: antes ese string vivía entero en memoria (y solo
  //     decodificarlo congelaba el hilo 2,8 s); ahora nunca existe.
  //   - Encabezado que no está en la fila 1 (hojas con títulos o logos).
  //   - Sin librerías externas: la red corporativa bloquea los CDN.
  // =====================================================================
  const XLSX_LIMITS = { scanBytes: 300000, maxRows: 300000, maxBufChars: 8 * 1024 * 1024 };

  // Inflado con tope opcional: para "espiar" el principio de una hoja enorme
  // sin descomprimirla entera (así elegir hoja cuesta milisegundos).
  async function inflateRaw(bytes, maxBytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    if (!maxBytes) { const ab = await new Response(stream).arrayBuffer(); return new Uint8Array(ab); }
    const reader = stream.getReader();
    const trozos = []; let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        trozos.push(value); total += value.length;
        if (total >= maxBytes) break;
      }
    } finally { try { reader.cancel(); } catch (e) {} }
    const out = new Uint8Array(total); let p = 0;
    for (const t of trozos) { out.set(t, p); p += t.length; }
    return out;
  }
  function colToIdx(ref) { const m = /^([A-Z]+)/.exec(ref || ""); if (!m) return -1; let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; }
  function unescXml(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, "&");
  }
  // Trozos descomprimidos de una entrada del ZIP, según van saliendo (v7.8).
  async function* zipEntryChunks(zip, name) {
    const f = zip.files[name];
    if (!f) return;
    const lh = f.localOff;
    const start = lh + 30 + zip.dv.getUint16(lh + 26, true) + zip.dv.getUint16(lh + 28, true);
    const comp = zip.bytes.subarray(start, start + f.compSize);
    if (f.method === 0) { yield comp; return; }
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([comp]).stream().pipeThrough(ds);
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally { try { reader.releaseLock(); } catch (e) {} }
  }
  // sharedStrings: soporta texto con formato (varios <t> dentro de un <si>).
  // v7.8: en STREAMING — el XML de textos nunca se retiene completo, y se cede
  // el hilo por presupuesto de tiempo mientras se procesa.
  async function parseSharedStringsStream(zip, maybeYield) {
    const out = [];
    if (!zip.files["xl/sharedStrings.xml"]) return out;
    const td = new TextDecoder("utf-8");
    let buf = "";
    const siRe = /<si\b(?:\s*\/>|[^>]*>([\s\S]*?)<\/si>)/g;
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    for await (const chunk of zipEntryChunks(zip, "xl/sharedStrings.xml")) {
      buf += td.decode(chunk, { stream: true });
      siRe.lastIndex = 0;
      let m, consumed = 0;
      while ((m = siRe.exec(buf)) !== null) {
        const cuerpo = m[1] || "";
        let s = "";
        tRe.lastIndex = 0;
        let t;
        while ((t = tRe.exec(cuerpo)) !== null) s += t[1];
        out.push(unescXml(s));
        consumed = siRe.lastIndex;
        await maybeYield();
      }
      if (consumed) buf = buf.slice(consumed);
      // [COPY-UX]
      if (buf.length > 4 * 1024 * 1024) throw new Error("El archivo contiene un volumen de datos superior al límite soportado.");
    }
    return out;
  }
  // Parseo de UNA fila (mismas reglas de siempre: huecos rellenos, inlineStr,
  // sharedStrings, referencia de columna). La usa el lector en streaming.
  function parseRowBody(cuerpo, shared) {
    const CELL_RE = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
    const arr = [];
    if (cuerpo) {
      CELL_RE.lastIndex = 0;
      let cm, libre = 0;
      while ((cm = CELL_RE.exec(cuerpo)) !== null) {
        const attrs = cm[1] || "", body = cm[2] || "";
        const refM = /r="([A-Z]+)\d+"/.exec(attrs);
        let idx = refM ? colToIdx(refM[1]) : -1;
        if (idx < 0) idx = libre;
        libre = idx + 1;
        const tM = /t="([^"]+)"/.exec(attrs), tipo = tM ? tM[1] : "";
        let val = "";
        if (tipo === "inlineStr") {
          const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t;
          while ((t = tRe.exec(body)) !== null) val += t[1];
          val = unescXml(val);
        } else {
          const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
          val = vM ? vM[1] : "";
          if (tipo === "s") { const i = parseInt(val, 10); val = (shared && shared[i] !== undefined) ? shared[i] : ""; }
          else val = unescXml(val);
        }
        arr[idx] = val;
      }
    }
    for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = "";
    return arr;
  }
  function scanSheetRows(xml, shared, maxRows) {
    const filas = [];
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g;
    const cellRe = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
    let rm;
    while ((rm = rowRe.exec(xml)) !== null) {
      const cuerpo = rm[2];
      const arr = [];
      if (cuerpo) {
        cellRe.lastIndex = 0;
        let cm, libre = 0;
        while ((cm = cellRe.exec(cuerpo)) !== null) {
          const attrs = cm[1] || "", body = cm[2] || "";
          const refM = /r="([A-Z]+)\d+"/.exec(attrs);
          let idx = refM ? colToIdx(refM[1]) : -1;
          if (idx < 0) idx = libre;
          libre = idx + 1;
          const tM = /t="([^"]+)"/.exec(attrs), tipo = tM ? tM[1] : "";
          let val = "";
          if (tipo === "inlineStr") {
            const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t;
            while ((t = tRe.exec(body)) !== null) val += t[1];
            val = unescXml(val);
          } else {
            const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
            val = vM ? vM[1] : "";
            if (tipo === "s") { const i = parseInt(val, 10); val = (shared && shared[i] !== undefined) ? shared[i] : ""; }
            else val = unescXml(val);
          }
          arr[idx] = val;
        }
      }
      // Las hojas reales saltan celdas vacías, lo que deja "huecos" en el arreglo.
      // Se rellenan: si no, .map() los ignora y el resto del código recibe undefined.
      for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = "";
      filas.push(arr);
      if (filas.length >= (maxRows || XLSX_LIMITS.maxRows)) break;
    }
    return filas;
  }
  // Índice del ZIP (sin descomprimir contenidos todavía).
  function zipIndex(arrayBuffer) {
    const dv = new DataView(arrayBuffer), bytes = new Uint8Array(arrayBuffer), td = new TextDecoder();
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    // [COPY-UX]
    if (eocd < 0) throw new Error("El archivo seleccionado no tiene un formato Excel (.xlsx) válido.");
    let cdCount = dv.getUint16(eocd + 10, true), cdOffset = dv.getUint32(eocd + 16, true);
    // ZIP64: libros muy grandes traen los tamaños reales en otro bloque.
    if (cdOffset === 0xffffffff || cdCount === 0xffff) {
      for (let i = eocd - 20; i >= 0 && i > eocd - 200; i--) {
        if (dv.getUint32(i, true) === 0x07064b50) {
          const z64 = Number(dv.getBigUint64(i + 8, true));
          if (dv.getUint32(z64, true) === 0x06064b50) { cdCount = Number(dv.getBigUint64(z64 + 32, true)); cdOffset = Number(dv.getBigUint64(z64 + 48, true)); }
          break;
        }
      }
    }
    const files = {}; let p = cdOffset;
    for (let n = 0; n < cdCount; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), compSize = dv.getUint32(p + 20, true), uncSize = dv.getUint32(p + 24, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      files[td.decode(bytes.subarray(p + 46, p + 46 + nameLen))] = { method, compSize, uncSize, localOff };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { dv, bytes, files };
  }
  async function zipRead(zip, name, maxBytes) {
    const f = zip.files[name]; if (!f) return null;
    const lh = f.localOff;
    const start = lh + 30 + zip.dv.getUint16(lh + 26, true) + zip.dv.getUint16(lh + 28, true);
    const comp = zip.bytes.subarray(start, start + f.compSize);
    const raw = f.method === 0 ? (maxBytes ? comp.subarray(0, maxBytes) : comp) : await inflateRaw(comp, maxBytes);
    return new TextDecoder("utf-8").decode(raw);
  }
  // Orden real de las hojas (workbook.xml + rels). Si algo falla, cae a sheetN.
  function sheetOrder(wbXml, relsXml) {
    const rmap = {};
    if (relsXml) { const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g; let m; while ((m = re.exec(relsXml)) !== null) rmap[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\//, ""); }
    const out = [];
    if (wbXml) {
      const re = /<sheet\b([^>]*)\/?>/g; let m;
      while ((m = re.exec(wbXml)) !== null) {
        const a = m[1];
        const nm = /name="([^"]*)"/.exec(a), rid = /r:id="([^"]*)"/.exec(a);
        const tgt = rid && rmap[rid[1]];
        if (tgt) out.push({ name: nm ? unescXml(nm[1]) : tgt, path: "xl/" + tgt });
      }
    }
    return out;
  }
  // ¿Sirve esta hoja? Puntaje por contenido: columna de documento + "Susceptible".
  function scoreSheet(filas) {
    let mejor = { score: -1, headerRow: -1, pend: 0 };
    const tope = Math.min(filas.length, 15);
    for (let h = 0; h < tope; h++) {
      const cruda = filas[h] || [];
      const cab = Array.from({ length: cruda.length }, (_, i) => String(cruda[i] == null ? "" : cruda[i]).trim().toUpperCase());
      if (cab.filter(Boolean).length < 2) continue;
      if (findDocIdx(cab) < 0) continue;
      let pend = 0;
      for (let r = h + 1; r < Math.min(filas.length, h + 400); r++) {
        const fila = filas[r] || [];
        for (let c = 0; c < fila.length; c++) if (isPending(fila[c])) pend++;
      }
      const score = 100 + Math.min(300, pend) - h;
      if (score > mejor.score) mejor = { score, headerRow: h, pend };
    }
    return mejor;
  }
  function findDocIdx(headers) {
    const h = (headers || []).map((x) => String(x == null ? "" : x));
    for (const cand of DOC_EXACT) { const k = h.indexOf(cand); if (k >= 0) return k; }
    return h.findIndex((x) => x.includes("IDENT") || x.includes("CEDULA") || x.includes("DOCUMENTO"));
  }
  // Lee el libro en STREAMING y devuelve el ÍNDICE ya construido (v7.8):
  // { headers, map, todos, sheetName, rowCount, sheets }. La elección de hoja sigue
  // siendo por muestra barata; la lectura completa va fila a fila: parsear -> indexar
  // -> descartar, cediendo el hilo por presupuesto de tiempo. Nunca se materializa
  // ni el XML completo de la hoja ni la tabla de filas.
  async function _readPymWorkbookStreamCore(arrayBuffer) {
    const maybeYield = makeYielder(15);
    const zip = zipIndex(arrayBuffer);
    const shared = await parseSharedStringsStream(zip, maybeYield);
    let hojas = sheetOrder(await zipRead(zip, "xl/workbook.xml"), await zipRead(zip, "xl/_rels/workbook.xml.rels"));
    if (!hojas.length) hojas = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort().map((p) => ({ name: p, path: p }));
    if (!hojas.length) throw new Error("el libro no tiene hojas legibles");

    // 1) Espiar solo el principio de cada hoja para elegir la buena (barato).
    const cand = [];
    for (const h of hojas) {
      const info = zip.files[h.path]; if (!info) continue;
      try {
        const muestra = await zipRead(zip, h.path, XLSX_LIMITS.scanBytes);
        const filas = scanSheetRows(muestra || "", shared, 400);
        const sc = scoreSheet(filas);
        if (sc.score > 0) cand.push({ h, sc, size: info.uncSize || 0 });
      } catch (e) { /* hoja ilegible: se ignora */ }
      await maybeYield();
    }
    cand.sort((a, b) => b.sc.score - a.sc.score);
    const elegida = cand[0] || { h: hojas[0], sc: { headerRow: 0 } };
    const headerRow = Math.max(0, elegida.sc.headerRow || 0);

    // 2) Streaming de la hoja elegida: cada fila completa se parsea, se indexa y se tira.
    progreso("Leyendo «" + elegida.h.name + "»…");
    const td = new TextDecoder("utf-8");
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g;
    let buf = "", nRow = 0, headers = null, indexer = null;
    for await (const chunk of zipEntryChunks(zip, elegida.h.path)) {
      buf += td.decode(chunk, { stream: true });
      rowRe.lastIndex = 0;
      let m, consumed = 0;
      while ((m = rowRe.exec(buf)) !== null) {
        const fila = parseRowBody(m[2], shared);
        if (nRow === headerRow) { headers = fila; indexer = makeIndexer(headers); }
        else if (nRow > headerRow && indexer) indexer.push(fila);
        nRow++;
        consumed = rowRe.lastIndex;
        if (nRow >= XLSX_LIMITS.maxRows) break;
        if (await maybeYield()) {
          if ((nRow & 8191) === 0) progreso("Leyendo el archivo… " + nRow.toLocaleString("es") + " filas");
        }
      }
      if (consumed) buf = buf.slice(consumed);
      if (nRow >= XLSX_LIMITS.maxRows) break;
      // Una "fila" que no cierra en 8 MB no es una fila: archivo corrupto o no tabular.
      if (buf.length > XLSX_LIMITS.maxBufChars) throw new Error("la hoja «" + elegida.h.name + "» no se puede leer por filas");
    }
    if (!indexer) throw new Error("no encontré la fila de encabezados en «" + elegida.h.name + "»");
    return { headers, map: indexer.map, todos: indexer.todos, abandono: indexer.abandono, sheetName: elegida.h.name, rowCount: nRow, sheets: hojas.map((x) => x.name) };
  }

  // Wrapper Web Worker para Excel Parsing (CYPHER)
  async function readPymWorkbookStream(arrayBuffer) {
    return new Promise((resolve, reject) => {
      const code = `
        const XLSX_LIMITS = ${JSON.stringify(XLSX_LIMITS)};
        const DOC_EXACT = ${JSON.stringify(DOC_EXACT)};
        const FRIENDLY = ${JSON.stringify(FRIENDLY)};
        const CONFIG = { EXCLUDE_PYM: ${JSON.stringify(CONFIG.EXCLUDE_PYM)} };

        function progreso(msg) { self.postMessage({ type: 'progress', msg }); }

        function makeYielder(budgetMs) {
          let last = performance.now();
          return async function () {
            if (performance.now() - last < (budgetMs || 50)) return false;
            await new Promise(r => setTimeout(r, 0));
            last = performance.now();
            return true;
          };
        }

        ${normalizeKey.toString()}
        ${isPending.toString()}
        ${esSi.toString()}
        ${stripAccents.toString()}
        ${friendly.toString()}
        ${activityLabel.toString()}
        ${isExcludedActivity.toString()}
        ${detalleTipoCervix.toString()}
        ${findDocIdx.toString()}
        ${makeIndexer.toString()}

        ${inflateRaw.toString()}
        ${colToIdx.toString()}
        ${unescXml.toString()}
        ${zipEntryChunks.toString()}
        ${parseSharedStringsStream.toString()}
        ${parseRowBody.toString()}
        ${scanSheetRows.toString()}
        ${zipIndex.toString()}
        ${zipRead.toString()}
        ${sheetOrder.toString()}
        ${scoreSheet.toString()}

        ${_readPymWorkbookStreamCore.toString()}

        self.onmessage = async (e) => {
          try {
            const result = await _readPymWorkbookStreamCore(e.data);
            self.postMessage({ type: 'done', result });
          } catch(err) {
            self.postMessage({ type: 'error', error: err.message, stack: err.stack });
          }
        };
      `;

      const blob = new Blob([code], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      // [BLINDADO v8.2.0 MEM-01] Declarar watchdog ANTES de los handlers para evitar TDZ con const.
      // Se asigna el setTimeout DESPUÉS de definir los handlers pero ANTES de postMessage.
      let watchdog;

      worker.onmessage = (e) => {
        const { type, msg, result, error, stack } = e.data;
        if (type === 'progress') {
          if (typeof progreso === "function") progreso(msg);
        } else if (type === 'done') {
          clearTimeout(watchdog); // [BLINDADO v8.2.0 MEM-01] Cancelar watchdog en éxito
          URL.revokeObjectURL(workerUrl);
          worker.terminate();
          resolve(result);
        } else if (type === 'error') {
          clearTimeout(watchdog); // [BLINDADO v8.2.0 MEM-01] Cancelar watchdog en error manejado
          URL.revokeObjectURL(workerUrl);
          worker.terminate();
          const err = new Error(error);
          err.stack = stack;
          reject(err);
        }
      };

      worker.onerror = (e) => {
        clearTimeout(watchdog); // [BLINDADO v8.2.0 MEM-01] Cancelar watchdog en crash de onerror
        URL.revokeObjectURL(workerUrl);
        worker.terminate();
        // [COPY-UX] Captura de error en procesamiento de datos
        reject(new Error("Error en el procesamiento en segundo plano: " + (e.message || "Fallo inesperado")));
      };

      // Watchdog Timer Anti-Zombie: se asigna después de los handlers.
      watchdog = setTimeout(() => {
        URL.revokeObjectURL(workerUrl);
        worker.terminate();
        // [COPY-UX]
        reject(new Error("El procesamiento del archivo excedió el tiempo límite (90s). Recargue la página e intente con otro archivo."));
      }, 90000); // 90s — un archivo de 14MB no debería tardar más de 30s en hardware mínimo

      try {
        worker.postMessage(arrayBuffer, [arrayBuffer]);
      } catch (err) {
        clearTimeout(watchdog);
        URL.revokeObjectURL(workerUrl);
        worker.terminate();
        reject(err);
      }
    });
  }
  function afterPymLoaded(fileName, esDiarioRealDeHoy) {
    state.pymFile = fileName;
    // v12.4.0 — Día en que se aplicó ESTA carga: con él, la re-búsqueda del diario sabe
    // distinguir "ya tengo el PyM real DE HOY" (parar) de "sigo con el de ayer" (buscar).
    // v12.4.1 — Hallazgo ALTO de la revisión adversarial: estampar el día SIEMPRE hacía
    // que una carga manual de un archivo VIEJO ("Abrir PyM" con el Excel de ayer, justo
    // lo que induce el recordatorio de las 7:30 cuando la red falló) apagara la búsqueda
    // del real de hoy para toda la jornada. Ahora el día solo se estampa cuando quien
    // llama SABE que lo cargado es el diario real de hoy; en cualquier otro caso queda
    // vacío y debeBuscarPymDiario() sigue buscando — el real reemplaza al llegar.
    state.pymDia = esDiarioRealDeHoy ? todayStamp() : "";
    if (state.lastSnapshot) state.lastSnapshot.list.forEach((a) => { a.pym = getActivities(a.doc_id); });
    state.lastSignature = ""; tick();
    // [COPY-UX]
    setSummary(`Actividades preventivas cargadas: ${state.pym.size} paciente(s) — ${fileName}`);
  }
  // v12.4.0 — ¿Hay que seguir BUSCANDO el Agenda_Dia_CMB de hoy en SharePoint? Sí,
  // mientras no esté cargado el PyM REAL DE HOY: sin nada cargado, con la base piloto
  // (fallback), o con un PyM que se cargó otro día (pestaña que cruzó la medianoche).
  // En cuanto el real de hoy está puesto, la re-búsqueda PARA (pedido explícito del
  // consultorio: el archivo lo suben en el transcurso de la mañana; buscarlo cada 10
  // minutos solo tiene sentido hasta encontrarlo).
  function debeBuscarPymDiario() {
    return !state.pymFile || state.pymFallback === true || state.pymDia !== todayStamp();
  }
  // Huella de un archivo PyM: identifica "el mismo archivo" sin depender solo de la fecha.
  function pymFP(name, mtime) { return String(name || "") + "|" + String(mtime || ""); }

  // =====================================================================
  //  CACHÉ COMPACTA v3 (v7.8) — diccionario de etiquetas.
  //  Las mismas ~30 etiquetas ("Tamización VIH", "Valoración integral"…) se
  //  repetían decenas de miles de veces en el JSON viejo. Ahora se guardan UNA
  //  vez y cada paciente lleva solo sus índices: 2,8 MB donde antes había 10,8
  //  (medido con la réplica de la base piloto). Empaquetar y desempaquetar
  //  ceden el hilo por tandas: ninguna pestaña se congela por la caché.
  // =====================================================================
  async function packPym(map, todos, abandono, meta, maybeYield) {
    const labels = []; const lidx = new Map();
    const parts = new Array(map.size); let n = 0;
    for (const [k, arr] of map) {
      let ids = "";
      for (const l of arr) {
        let i = lidx.get(l);
        if (i === undefined) { i = labels.length; lidx.set(l, i); labels.push(l); }
        ids += (ids ? "." : "") + i;
      }
      parts[n++] = k + ":" + ids;
      if (maybeYield && (n & 4095) === 0) await maybeYield();
    }
    const p = parts.join("|");
    if (maybeYield) await maybeYield();
    const t = Array.from(todos || []).join(",");
    if (maybeYield) await maybeYield();
    // v7.8.1: cédulas con Abandonados_PES="Si" (riesgo cardiovascular) — clave "ab".
    const ab = Array.from(abandono || []).join(",");
    if (maybeYield) await maybeYield();
    return JSON.stringify(Object.assign({ v: 3, labels, p, t, ab }, meta || {}));
  }
  async function unpackPym(txt, maybeYield) {
    const o = JSON.parse(txt);
    if (o.v !== 3) return null;                       // formato viejo: se descarta
    const labels = o.labels || [];
    const map = new Map();
    const parts = o.p ? o.p.split("|") : [];
    for (let i = 0; i < parts.length; i++) {
      const c = parts[i].indexOf(":");
      if (c < 0) continue;
      const ids = parts[i].slice(c + 1);
      const arr = ids ? ids.split(".").map((x) => labels[+x]).filter((x) => x !== undefined) : [];
      map.set(parts[i].slice(0, c), arr);
      if (maybeYield && (i & 2047) === 0) await maybeYield();
    }
    const todos = new Set();
    const t = o.t ? o.t.split(",") : [];
    for (let i = 0; i < t.length; i++) { if (t[i]) todos.add(t[i]); if (maybeYield && (i & 8191) === 0) await maybeYield(); }
    // Caché de una versión anterior a v7.8.1 sin "ab": abandono vacío, no un error.
    const abandono = new Set();
    const ab = o.ab ? o.ab.split(",") : [];
    for (let i = 0; i < ab.length; i++) { if (ab[i]) abandono.add(ab[i]); if (maybeYield && (i & 8191) === 0) await maybeYield(); }
    return { map, todos, abandono, meta: o };
  }

  // v7.8: se aplica un ÍNDICE ya construido ({map, todos, abandono}) — el lector en
  // streaming lo entrega directo, sin pasar por una tabla intermedia de filas.
  function applyPymIdx(idx, fileName, mtime, nombreReal, esDiarioRealDeHoy) {
    state.pym = idx.map; state.pymTodos = idx.todos;
    state.pymAbandono = idx.abandono || new Set();
    state.pymMTime = mtime || "";
    // La huella usa el nombre CRUDO del archivo (sin las etiquetas que se le añaden para
    // mostrar), para que coincida con lo que devuelve SharePoint en la siguiente ronda.
    state.pymFP = pymFP(nombreReal || fileName, mtime);
    afterPymLoaded(fileName, esDiarioRealDeHoy);
    // La caché se escribe DESPUÉS y por tandas: el panel ya está usable.
    savePymCache(fileName);
    try {
      // La fecha va TAMBIÉN en una clave diminuta: así comprobar "¿la caché es de hoy?"
      // no obliga a interpretar varios MB de JSON cada ronda.
      localStorage.setItem("vgl_pym_dia", todayStamp());
    } catch (e) {}
  }
  async function savePymCache(fileName) {
    try {
      if (typeof GM_setValue === "undefined") return;
      const txt = await packPym(state.pym, state.pymTodos, state.pymAbandono, { date: todayStamp(), name: fileName, mtime: state.pymMTime, fp: state.pymFP, fb: !!state.pymFallback }, makeYielder(15));
      if (txt.length <= 12 * 1024 * 1024) { GM_setValue("vgl_pym", txt); GM_setValue("vgl_pym_dia", todayStamp()); GM_setValue("vgl_pym_esfallback", state.pymFallback ? "1" : ""); }
      else {
        // Ya NO es un fallo silencioso (v7.8): con el formato compacto esto exigiría una
        // base ~4 veces mayor que la actual; si algún día pasa, que se sepa.
        GM_setValue("vgl_pym", ""); GM_setValue("vgl_pym_dia", "");
        setSummary("La base indexada no cabe en la caché (" + Math.round(txt.length / 1048576) + " MB): cada recarga volverá a leerla. Repórtalo.", "warn");
      }
    } catch (e) {}
  }

  // =====================================================================
  //  CONTADORES DEL DÍA + BITÁCORA DE AUDITORÍA (v5.0)
  //  Se guardan por fecha en el navegador; sirven para el reporte del turno
  //  y para ver la tendencia de la semana. Se conservan 30 días y se purgan.
  // =====================================================================
  const STATS_KEY = "vgl_stats", EVENTS_KEY = "vgl_events", KEEP_DAYS = 30;
  function allStats() { return readJSON(STATS_KEY, {}) || {}; }
  function statsToday() { const a = allStats(); return a[todayStamp()] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 }; }
  function bumpStat(kind) {
    const a = allStats(), d = todayStamp();
    a[d] = a[d] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 };
    a[d][kind] = (a[d][kind] || 0) + 1;
    purgeOld(a); writeJSON(STATS_KEY, a);
    frCache.dia = "";   // invalida el contador en memoria que usa la barra de estadísticas
  }
  function purgeOld(obj, dias) {
    // "dias" es opcional: solo la purga de emergencia por cuota llena lo pasa (18).
    const lim = new Date(); lim.setDate(lim.getDate() - (dias || KEEP_DAYS));
    for (const k of Object.keys(obj)) { const d = new Date(k + "T00:00:00"); if (!isFinite(d) || d < lim) delete obj[k]; }
  }
  function lastDays(n) {
    const a = allStats(), out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); out.push({ fecha: k, ...(a[k] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 }) }); }
    return out;
  }
  // Bitácora: se guarda para poder exportar el turno aunque se recargue la página.
  // UN ARCHIVO POR DÍA. Antes todo vivía en una sola clave y cada evento reescribía los
  // 30 días completos (hasta 13 MB y 194 ms por evento, con riesgo de superar la cuota
  // del navegador y perder la evidencia en silencio). Ahora se escribe solo el día en
  // curso, y además en tandas de 2 s en vez de en cada evento.
  const evKey = (d) => "vgl_ev_" + (d || todayStamp());
  let evBuffer = [], evTimer = null, evDia = "";
  function evFlush() {
    evTimer = null;
    if (!evBuffer.length) return;
    try {
      const d = evDia || todayStamp(), k = evKey(d);
      const pend = evBuffer;
      evBuffer = [];
      const hoy = (readJSON(k, []) || []).concat(pend);
      // writeJSON ya trae purga de emergencia + reintento si la cuota está llena.
      // Si aun así falla, la tanda vuelve a la cola (tope 200) en vez de perderse.
      if (!writeJSON(k, hoy.length > 3000 ? hoy.slice(-3000) : hoy)) evBuffer = pend.concat(evBuffer).slice(-200);
    } catch (e) { evBuffer = []; }
  }
  function logEvent(ev) {
    try {
      const d = todayStamp();
      if (evDia && evDia !== d) evFlush();       // el turno cruzó la medianoche
      evDia = d;
      evBuffer.push(ev);
      if (evBuffer.length >= 200) { evFlush(); return; }
      // El FRAUDE se escribe en el acto, sin esperar a la tanda. Es la evidencia que
      // justifica todo esto: si el equipo se apaga o se cierra el navegador en esos dos
      // segundos, el registro se habría perdido. Son pocos al día, así que no pesa.
      if (ev && ev.ev === "FRAUDE_EXTEMPORANEO") { if (evTimer) { clearTimeout(evTimer); evTimer = null; } evFlush(); return; }
      if (!evTimer) evTimer = setTimeout(evFlush, 2000);
    } catch (e) {}
  }
  function eventsOf(day) { evFlush(); return readJSON(evKey(day), []) || []; }
  // Limpieza de días viejos: una sola vez al arrancar, no en cada evento.
  function purgeEventDays(dias) {
    try {
      // "dias" es opcional: solo la purga de emergencia por cuota llena lo pasa (18).
      const lim = new Date(); lim.setDate(lim.getDate() - (dias || KEEP_DAYS));
      const viejas = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        // v11.0.1 — Las marcas anti-duplicado entre pestañas (vgl_n_*) se creaban una por
        // aviso y no las borraba nadie: crecían sin límite. Su ventana útil son 12 s.
        if (k.indexOf("vgl_n_") === 0) {
          const t = +(localStorage.getItem(k) || 0);
          if (!t || Date.now() - t > 86400000) viejas.push(k);
          continue;
        }
        if (k.indexOf("vgl_ev_") !== 0) continue;
        const f = new Date(k.slice(7) + "T00:00:00");
        if (!isFinite(f) || f < lim) viejas.push(k);
      }
      viejas.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(EVENTS_KEY);        // formato antiguo (un solo blob gigante)
    } catch (e) {}
  }
  try { window.addEventListener("beforeunload", evFlush); } catch (e) {}
  function csvCell(v) { const s = String(v === undefined || v === null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function downloadBlob(blob, filename) {
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); } catch (e) {}
  }
  // Reporte del turno en CSV (se abre tal cual en Excel; separador ";" para Excel en español).
  function exportAudit(day) {
    const d = day || todayStamp(), evs = eventsOf(d), st = allStats()[d] || { fraude: 0, inasistencia: 0, atiempo: 0 };
    // [COPY-UX] Reporte de atención clínica
    const head = ["Hora", "Evento", "Hora cita", "Documento", "Estado", "Estado previo", "Minutos", "Paciente"];
    const lines = [
      "REPORTE CLINICO DE ATENCION - VIGILANTE DE AGENDA v" + VERSION,
      "Fecha;" + d,
      "Confirmaciones extemporáneas;" + (st.fraude || 0),
      "Inasistencias registradas;" + (st.inasistencia || 0),
      "Ingresos a tiempo;" + (st.atiempo || 0),
      "Eventos registrados;" + evs.length,
      "",
      head.join(";"),
    ];
    for (const e of evs) lines.push([e.t, e.ev, e.hora, e.doc, e.estado, e.previo || "", e.min === undefined ? "" : e.min, e.nombre || ""].map(csvCell).join(";"));
    // BOM para que Excel respete las tildes.
    downloadBlob(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), "auditoria_vigilante_" + d + ".csv");
    setSummary("Reporte del " + d + " descargado (" + evs.length + " evento(s)).");
  }


  // =====================================================================
  //  REPORTE MÍNIMO AL TABLERO (v7.3.6) — Hoja de Google vía Apps Script.
  //  SOLO dos tipos de fila, para que la hoja no se llene de basura:
  //    "resumen" — 1 vez al día: conteos del día ANTERIOR (fraude/inasistencia/
  //                a tiempo/última llamada), con candado para no repetirse.
  //    "fraude"  — 1 fila por fraude EN VIVO (hora de la cita y minutos tarde;
  //                SIN cédula ni nombre), tope 20/día.
  //  Nada de pings de arranque, errores, ni diagnósticos automáticos.
  //  Cola diminuta (máx. 30) por si no hay red; se reintenta cada 10 min.
  // =====================================================================
  const TABLERO = {
    url: "https://script.google.com/macros/s/AKfycbwaSyv2nWxoeGKW1v6EpSKnnDgVv-cYKVNFe6j9VbNK1wOI3VOD0zIBHyXMgCT3zNBl/exec",
    token: "vgl-2026", // debe coincidir con el TOKEN del Apps Script (ver carpeta TABLERO)
  };
  const repUrl = () => (S.reporteUrl && /^https?:/i.test(S.reporteUrl)) ? S.reporteUrl.trim() : TABLERO.url;
  const repOn = () => !!S.reporte && !!repUrl() && typeof GM_xmlhttpRequest !== "undefined";
  // true = la Hoja lo recibió de verdad (Google a veces contesta 200 con una página
  // de login o error HTML: eso NO cuenta como recibido).
  function repPost(obj) {
    return new Promise((res) => {
      try {
        GM_xmlhttpRequest({
          method: "POST", url: repUrl(), data: JSON.stringify(obj),
          headers: { "Content-Type": "text/plain;charset=utf-8" }, timeout: 20000, // text/plain = sin preflight CORS
          onload: (r) => res(r.status >= 200 && r.status < 400 && !/accounts\.google|ServiceLogin/i.test(String(r.finalUrl || "")) && !/^\s*</.test(String(r.responseText || "").slice(0, 200))),
          onerror: () => res(false), ontimeout: () => res(false),
        });
      } catch (e) { res(false); }
    });
  }
  let repQ = null, repFlushing = false;
  // v12.5.1 — repQLoad ya NO cachea: siempre relee el almacén compartido. La caché en
  // memoria hacía que una pestaña con cola vieja pisara filas recién encoladas por otra
  // (revisión adversarial); releer 30 filas cuesta microsegundos. Queda una ventana de
  // carrera mínima entre leer y guardar — asumida: GM no ofrece escritura atómica.
  function repQLoad() { try { repQ = JSON.parse(GM_getValue("vgl_repq", "[]")) || []; } catch (e) { repQ = repQ || []; } }
  function repQSave() {
    try {
      let q = (repQ || []).slice();
      // v12.5.1 — Al recortar por tope, las filas "ux" (telemetría de uso) se sacrifican
      // PRIMERO: una fila de fraude o el resumen diario jamás debe salir de la cola por
      // culpa de las métricas de uso.
      while (q.length > 30) {
        const i = q.findIndex((r) => r && r.evento === "ux");
        if (i < 0) break;
        q.splice(i, 1);
      }
      GM_setValue("vgl_repq", JSON.stringify(q.slice(-30)));
    } catch (e) {}
  }
  async function repFlush() {
    if (repFlushing || !repOn()) return;
    repQLoad(); if (!repQ.length) return;
    repFlushing = true;
    try { let g = 0; while (repQ.length && g++ < 10) { if (await repPost(repQ[0])) { repQ.shift(); repQSave(); } else break; } }
    finally { repFlushing = false; }
  }
  // v12.6.9 — IDENTIFICADOR DE EQUIPO AUTOMÁTICO. Hasta v12.6.8 la columna `equipo` del
  // tablero salía VACÍA en todas las filas: dependía de que alguien escribiera a mano el
  // ajuste S.equipo, y nadie lo hace. Sin ese dato el tablero es un montón de filas
  // anónimas: no se sabe si dos filas son del mismo consultorio o de dos distintos, ni se
  // puede seguir a un equipo con un fallo concreto. Ahora, si el ajuste está vacío, se usa
  // un identificador ALEATORIO y estable creado en ESTE navegador. No lleva nada de la
  // persona ni del equipo real: ni nombre, ni usuario, ni IP, ni huella del navegador —
  // es un número de serie sin significado, que además el médico puede sobrescribir
  // poniéndole nombre al equipo en Ajustes.
  const EQUIPO_ID_KEY = "vgl_equipo_id";
  function _equipoId() {
    try {
      const manual = String(S.equipo || "").trim();
      if (manual) return manual.slice(0, 40);
      let id = localStorage.getItem(EQUIPO_ID_KEY);
      if (!id) {
        id = "eq-" + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
        localStorage.setItem(EQUIPO_ID_KEY, id);
      }
      return String(id).slice(0, 40);
    } catch (e) { return ""; }
  }

  // v12.6.9 — `lote`: identificador único por fila encolada. En la Hoja aparecieron filas
  // DUPLICADAS exactas (mismo ts, mismo payload, recibidas con minutos de diferencia): un
  // reintento de la cola que sí llegó la primera vez y volvió a entregarse. Con este
  // campo el tablero puede descartar el duplicado en vez de contar dos veces la misma
  // jornada. No cambia nada del envío: solo lo hace identificable.
  let _loteSeq = 0;
  function _loteId() {
    _loteSeq++;
    return (_equipoId() || "eq") + "-" + Date.now().toString(36) + "-" + _loteSeq;
  }

  function reportar(evento, extra) {
    if (!repOn()) return;
    repQLoad();
    repQ.push(Object.assign({ token: TABLERO.token, equipo: _equipoId(), ver: VERSION, evento, ts: new Date().toISOString(), dia: todayStamp(), lote: _loteId() }, extra || {}));
    repQSave(); repFlush();
  }

  // v12.6.9 — ENTORNO, una vez al día. Para leer un fallo reportado hace falta saber sobre
  // qué corría: versión real instalada (el tablero mostraba versiones que ya no se
  // reconocían), navegador, sistema, tamaño de pantalla y zona horaria. Todo del entorno
  // técnico: ninguna de estas piezas identifica a una persona ni a un paciente.
  function repEntornoDiario() {
    if (!repOn()) return;
    try {
      const k = "vgl_rep_entorno";
      if (localStorage.getItem(k) === todayStamp()) return;
      localStorage.setItem(k, todayStamp());
      const ua = String((navigator && navigator.userAgent) || "");
      const nav = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
        : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "otro";
      const so = /Windows NT 10/.test(ua) ? "Windows 10/11" : /Windows/.test(ua) ? "Windows"
        : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "otro";
      let zona = "";
      try { zona = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").slice(0, 40); } catch (e2) {}
      reportar("entorno", {
        nav, so, zona,
        pantalla: (screen && screen.width ? screen.width + "x" + screen.height : ""),
        gestor: (typeof GM_info !== "undefined" && GM_info && GM_info.scriptHandler) ? String(GM_info.scriptHandler).slice(0, 20) : ""
      });
    } catch (e) {}
  }

  // v12.6.9 — ERRORES DE VERDAD, no solo clics. Hasta ahora el tablero solo recibía
  // acciones exitosas: un fallo del script en consultorio no dejaba rastro remoto y solo
  // se sabía de él cuando el médico lo reportaba a mano. Se cuentan TODOS (contador
  // agregado en la ventana de uso) y, además, los 5 primeros del día viajan con su
  // mensaje SANEADO: sin URL completas, sin comillas, y con toda tira de 6+ dígitos
  // borrada — una cédula no puede sobrevivir ahí ni aunque venga dentro del mensaje.
  const ERR_MAX_DIA = 5;
  let _errN = 0, _errDia = "", _errVistos = null;
  // v12.10.12 — MIGAS DE PAN (breadcrumbs, al estilo Sentry/Crashlytics): las últimas
  // acciones que uxTrack() fue contando ANTES del error, para leer "qué pasó justo antes
  // de romperse" sin ningún dato de paciente — son los mismos nombres FIJOS de acción que
  // ya viajan sanos por uxTrack, nunca texto libre ni del DOM.
  const MIGAS_MAX = 8;
  const _migas = [];
  function _migaPush(a) {
    _migas.push(a);
    if (_migas.length > MIGAS_MAX) _migas.shift();
  }
  function _sanearMensajeError(msg) {
    return String(msg == null ? "" : msg)
      .replace(/https?:\/\/[^\s)]+/g, "<url>")
      .replace(/\d{6,}/g, "")
      .replace(/["'`]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }
  function reportarError(origen, msg, donde) {
    try {
      // Migas ANTES de que este mismo error entre a la cuenta (si no, la última miga
      // sería siempre el error que se está reportando, y no diría nada nuevo).
      const migasAntes = _migas.slice();
      uxTrack("error." + (origen === "promesa" ? "promesa" : origen === "api" ? "api" : "js"));
      const d = todayStamp();
      if (_errDia !== d) { _errDia = d; _errN = 0; _errVistos = new Set(); }
      // v12.10.12 — DISTINTOS vs TOTAL: el tope de 5/día limita cuántos errores viajan con
      // detalle, pero el conteo de "cuántos son la MISMA falla" (huella = origen+dónde, o
      // el mensaje saneado si no hay "dónde") ya venía perdiéndose por completo. Un solo
      // bug repitiendo 200 veces y 5 bugs distintos de una vez se veían IGUAL en el
      // tablero. Este contador (agregado, vía la misma ventana de uxTrack) sobrevive
      // aunque el tope de detalle ya esté agotado.
      const huella = (origen || "js") + "|" + (donde ? String(donde).slice(0, 60) : _sanearMensajeError(msg).slice(0, 40));
      if (!_errVistos.has(huella)) { _errVistos.add(huella); uxTrack("error.distintos"); }
      if (!repOn()) return;
      if (_errN >= ERR_MAX_DIA) return;
      _errN++;
      reportar("error", { origen: String(origen || "js").slice(0, 12), msg: _sanearMensajeError(msg), donde: _sanearMensajeError(donde).slice(0, 60), migas: migasAntes.join(">").slice(0, 160) });
    } catch (e) {}
  }
  // Solo se enganchan los errores que salen del PROPIO script: el userscript comparte
  // ventana con Everest y con Athenea, y subir los errores ajenos llenaría el tablero de
  // ruido que no podemos arreglar (la consola del consultorio está llena de ellos).
  // v14.1.6 — EL CAZADOR DE ERRORES LLEVABA UNA SEMANA SIN CAZAR NADA.
  //
  // Hallazgo del export real del tablero (14-ago-2026, 20 equipos, ~6 días): la hoja
  // `error` NO EXISTE. El servidor la crea al recibir el primer evento de ese tipo, así
  // que su ausencia prueba que no ha llegado ninguno. Y la segunda confirmación, esta
  // independiente: en `uso_detalle` no hay ni una clave `error.js`, `error.promesa` ni
  // `error.distintos` — y esas se emiten desde `reportarError` ANTES del tope diario y
  // ANTES de `repOn()`, así que aparecerían aunque el envío estuviera capado o apagado.
  // Conclusión: `reportarError` no se ha llamado nunca, en ninguna máquina.
  //
  // La causa es el filtro de aquí. Estaba escrito contra `ev.filename` esperando leer
  // algo con "userscript" o "vigilante" dentro, pero el nombre de archivo que el gestor
  // de userscripts pone en un error depende de CÓMO inyecte el script, y en varias
  // configuraciones no contiene ninguna de las dos palabras: puede ser la URL de la
  // página, un blob:, una URL de extensión, o venir vacío. El filtro que debía dejar
  // fuera los errores de Everest estaba dejando fuera también los nuestros.
  //
  // El arreglo no vuelve a adivinar cómo nos vemos: lo AVERIGUA al arrancar. Se provoca
  // un error controlado y se anota de qué archivo dice venir. Esa firma es la de nuestro
  // propio código, sea cual sea el gestor y el navegador, y contra ella se comparan los
  // errores que lleguen después. La heurística vieja se conserva como respaldo por si la
  // firma no se pudiera capturar.
  let _firmaPropia = "";
  try {
    throw new Error("firma");
  } catch (e) {
    try {
      // La primera línea del stack es el `throw` de aquí arriba: justo nuestro archivo.
      const linea = String((e && e.stack) || "").split("\n").find((l) => /:\d+:\d+/.test(l)) || "";
      const m = linea.match(/\(?([^()\s]+):\d+:\d+\)?\s*$/);
      if (m && m[1] && m[1].length > 4) _firmaPropia = m[1];
    } catch (e2) {}
  }
  function _esErrorPropio(pila, archivo) {
    const s = String(pila || "") + " " + String(archivo || "");
    if (_firmaPropia && s.indexOf(_firmaPropia) !== -1) return true;
    return /userscript|vigilante|tampermonkey|greasemonkey|violentmonkey/i.test(s);
  }
  function _getFirmaPropiaParaTest() { return _firmaPropia; }
  function _setFirmaPropiaParaTest(v) { _firmaPropia = v; }

  function _instalarCazaErrores() {
    try {
      window.addEventListener("error", (ev) => {
        try {
          const archivo = String((ev && ev.filename) || "");
          // El stack del Error real es mucho más fiable que `filename`: lleva TODOS los
          // marcos, así que basta con que uno solo sea nuestro para reconocerlo.
          const pila = String((ev && ev.error && ev.error.stack) || "");
          if (!_esErrorPropio(pila, archivo)) return;
          reportarError("js", (ev && ev.message) || "", (archivo.split("/").pop() || "?") + ":" + ((ev && ev.lineno) || 0));
        } catch (e) {}
      });
      window.addEventListener("unhandledrejection", (ev) => {
        try {
          const r = ev && ev.reason;
          const pila = String((r && r.stack) || "");
          // Sin stack no se puede saber de quién es. Se sigue dejando pasar —como antes—
          // porque una promesa nuestra rechazada con un valor suelto (no un Error) no
          // trae stack, y perder eso es peor que un poco de ruido ajeno.
          if (pila && !_esErrorPropio(pila, "")) return;
          reportarError("promesa", (r && r.message) || r || "", "");
        } catch (e) {}
      });
    } catch (e) {}
  }
  // Resumen del día ANTERIOR, una sola vez (candado por fecha en el navegador).
  function repDailySummary() {
    if (!repOn()) return;
    try {
      const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
      const k = ayer.getFullYear() + "-" + String(ayer.getMonth() + 1).padStart(2, "0") + "-" + String(ayer.getDate()).padStart(2, "0");
      if (localStorage.getItem("vgl_rep_sum") === k) return;
      localStorage.setItem("vgl_rep_sum", k);
      const st = (allStats() || {})[k]; if (!st) return; // sin actividad ese día: ni fila
      reportar("resumen", { deDia: k, fraude: st.fraude || 0, inasistencia: st.inasistencia || 0, atiempo: st.atiempo || 0, ultima: st.ultima || 0 });
    } catch (e) {}
  }
  // Fraude en vivo: hora de la cita y minutos de retraso. SIN datos del paciente.
  let repFrN = 0, repFrDia = "";
  function reportarFraude(hora, min) {
    if (!repOn()) return;
    const d = todayStamp(); if (repFrDia !== d) { repFrDia = d; repFrN = 0; }
    if (repFrN >= 20) return; repFrN++;
    reportar("fraude", { hora: hora || "", min: Math.round((min || 0) * 10) / 10 });
  }

  // =====================================================================
  //  v12.5.0 — TELEMETRÍA DE USO DEL PANEL (mejora continua)
  //  Pedido del 11-08-2026: cada acción del médico en el panel se CUENTA — jamás se
  //  registra QUIÉN era el paciente (ni cédula, ni nombre, ni texto del DOM): solo el
  //  nombre FIJO de la acción y números. Cada 30 minutos la pestaña LÍDER envía UNA
  //  sola fila "ux" agregada al tablero de Apps Script, por la misma cola con
  //  reintentos del reporte mínimo. Diseño deliberado: AGREGAR y no inundar — la cola
  //  remota admite 30 filas y la Hoja no debe llenarse de clics sueltos. La fila "ux"
  //  se procesa en el tablero con TABLERO/Codigo.gs (pestaña "uso" de la Hoja).
  //  Nota de concurrencia: dos pestañas del mismo navegador comparten la ventana en
  //  localStorage; una carrera de escritura puede perder algún conteo aislado —
  //  aceptable para métricas de uso, jamás para datos clínicos.
  const UX_KEY = "vgl_ux";
  const UX_PEND_KEY = "vgl_ux_pend"; // v12.5.1 — aparcadero de UNA ventana de otro día aún sin despachar
  const UX_FLUSH_MS = 30 * 60 * 1000; // media hora, decidido con el pedido ("cada 30 min o cada hora")
  function uxVentanaNueva() { return { dia: todayStamp(), desde: new Date().toISOString(), acciones: {} }; }
  // v12.5.1 — El MISMO saneo se aplica al escribir Y al exportar (revisión adversarial:
  // localStorage lo comparte la página de Athenea y cualquier otro script del origen —
  // la barrera solo en la escritura convertía al Vigilante en un puente que podía subir
  // texto ajeno, incluso PII, al tablero).
  // Además del filtro de caracteres, toda tira de 6+ dígitos se elimina: una cédula
  // jamás puede sobrevivir en una clave, ni siquiera inyectada por un tercero.
  // v14.1.9 — LA BARRERA TENÍA LOS PASOS EN EL ORDEN EQUIVOCADO, y por eso no paraba
  // ninguna cédula escrita como se escriben las cédulas.
  //
  // La versión anterior era: quitar los tramos de 6+ dígitos, y DESPUÉS quitar todo lo que
  // no fuera `[a-z0-9.:_-]`. Con ese orden se colaban tres formas, todas cotidianas:
  //
  //   · "1.143.142.498"  — el punto está en la lista de caracteres PERMITIDOS, así que no
  //     hay ningún tramo de 6 dígitos seguidos que quitar. La cédula salía entera.
  //   · "300-123-4567"   — igual con el guion. El celular salía entero.
  //   · "1 143 142 498"  — el espacio SÍ se quitaba… pero en el segundo paso, cuando el
  //     primero ya había pasado. Los dígitos se pegaban DESPUÉS de la única comprobación
  //     que los habría cazado, y salía "1143142498".
  //
  // Ahora se normaliza primero y se cuentan los dígitos IGNORANDO los separadores: si un
  // tramo suma 6 o más, se va entero. Las 38 claves reales del script son literales y
  // ninguna lleva dígitos (la más cargada es "panel.silenciar15", con dos), así que esto
  // no puede tragarse telemetría legítima — hay prueba que lo fija.
  function uxClaveLimpia(k) {
    let s = String(k == null ? "" : k).toLowerCase().replace(/[^a-z0-9.:_-]/g, "");
    s = s.replace(/\d[\d.:_-]*\d/g, (m) => (m.replace(/\D/g, "").length >= 6 ? "" : m));
    // Al quitar un tramo quedan separadores pegados ("labs..fin"); se colapsan para que la
    // clave saneada no dependa de dónde estaba el dato que se fue.
    s = s.replace(/([.:_-])[.:_-]+/g, "$1").replace(/^[.:_-]+|[.:_-]+$/g, "");
    return s.slice(0, 60);
  }
  function uxTrack(accion, extra) {
    try {
      if (S.uxTelemetria === false) return;
      // Solo nombres fijos de acción (letras/números/./:/_/-): nada que venga del DOM
      // o del paciente puede colarse en la clave.
      const a = uxClaveLimpia(accion);
      if (!a) return;
      _migaPush(a);
      let w = readJSON(UX_KEY, null);
      if (!w || !w.acciones || typeof w.acciones !== "object") w = uxVentanaNueva();
      // Cambio de día con conteos pendientes: la ventana vieja se APARCA (una sola
      // plaza) y la despacha la pestaña líder en su siguiente ciclo — así ninguna
      // pestaña no-líder duplica la fila, y un reporte apagado o sin red no tira los
      // conteos a la basura (revisión adversarial v12.5.1).
      if (w.dia !== todayStamp()) { writeJSON(UX_PEND_KEY, w); w = uxVentanaNueva(); }
      w.acciones[a] = (w.acciones[a] || 0) + 1;
      const n = extra && typeof extra.n === "number" && isFinite(extra.n) ? extra.n : 0;
      if (n) w.acciones[a + ".total"] = (w.acciones[a + ".total"] || 0) + n;
      writeJSON(UX_KEY, w);
    } catch (e) {}
  }
  // Empaqueta una ventana con conteos en UNA fila "ux" hacia la cola del tablero.
  // true = la fila quedó ENCOLADA (la entrega real la garantiza repFlush con reintentos).
  function uxEnviarVentana(w) {
    try {
      if (!w || !w.acciones || typeof w.acciones !== "object") return false;
      if (S.uxTelemetria === false || !repOn()) return false;
      // v12.5.1 — Reconstrucción con saneo de salida: claves re-filtradas y SOLO
      // valores numéricos positivos; lo demás se descarta. Presupuesto por CLAVES
      // enteras (nunca un JSON partido a mitad de string, que el tablero registraría
      // a medias o descartaría): si no cabe, se omiten claves y se anota cuántas.
      const limpio = {};
      let total = 0, omitidas = 0, tam = 2;
      for (const k of Object.keys(w.acciones)) {
        const kk = uxClaveLimpia(k);
        const v = Number(w.acciones[k]);
        if (!kk || !isFinite(v) || v <= 0) continue;
        const peso = kk.length + String(Math.round(v)).length + 4; // "clave":valor,
        if (tam + peso > 3800) { omitidas++; continue; }
        tam += peso;
        limpio[kk] = (limpio[kk] || 0) + Math.round(v);
        if (!kk.endsWith(".total")) total += Math.round(v);
      }
      if (!Object.keys(limpio).length) return false;
      if (omitidas) limpio["_recortadas"] = omitidas;
      reportar("ux", { deDia: String(w.dia || "").slice(0, 10), desde: String(w.desde || "").slice(0, 30), n: total, acciones: JSON.stringify(limpio) });
      return true;
    } catch (e) { return false; }
  }
  function uxFlush() {
    try {
      if (!heartbeat()) return;                          // solo la pestaña líder envía
      // Primero la ventana aparcada de otro día (si el reporte estaba apagado o sin
      // red cuando cruzó la medianoche); después la ventana corriente.
      const pend = readJSON(UX_PEND_KEY, null);
      if (pend && uxEnviarVentana(pend)) { try { localStorage.removeItem(UX_PEND_KEY); } catch (e2) {} }
      const w = readJSON(UX_KEY, null);
      if (w && w.acciones && Object.keys(w.acciones).length && uxEnviarVentana(w)) writeJSON(UX_KEY, uxVentanaNueva());
    } catch (e) {}
  }
  // Al arrancar: si quedó una ventana de OTRO día (el navegador se cerró antes del
  // último envío), sale ya — sin esperar la primera media hora.
  function uxBootCheck() {
    try {
      if (!heartbeat()) return;
      const pend = readJSON(UX_PEND_KEY, null);
      if (pend && uxEnviarVentana(pend)) { try { localStorage.removeItem(UX_PEND_KEY); } catch (e2) {} }
      const w = readJSON(UX_KEY, null);
      if (w && w.dia !== todayStamp() && uxEnviarVentana(w)) writeJSON(UX_KEY, uxVentanaNueva());
    } catch (e) {}
  }

  // ================== SharePoint: PyM del día automático ==================
  function todayStamp() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function spBase() { return "https://" + CONFIG.SP.host + CONFIG.SP.web; }
  // v7.7: encuentra el archivo del PyM de HOY en la carpeta de SharePoint, por su
  // nombre — sin adivinar formatos raros: prueba las variantes de fecha más comunes
  // (20260806, 2026-08-06, 06-08-2026, 6/8/2026…) y solo acepta una coincidencia
  // EXACTA con hoy. Si no hay ninguna, no elige "el más reciente" a ciegas — mejor
  // caer al piloto que cargar sin darse cuenta la agenda de otro día.
  function todayTokens() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    const Y = d.getFullYear(), M = p(d.getMonth() + 1), D = p(d.getDate()), m = d.getMonth() + 1, day = d.getDate();
    // v7.8: también el mes EN LETRAS ("6 de agosto", "06 agosto"), por si algún día
    // suben el archivo con el nombre escrito así en vez de con la fecha numérica.
    const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][d.getMonth()];
    return [`${Y}${M}${D}`, `${Y}-${M}-${D}`, `${Y}_${M}_${D}`, `${D}${M}${Y}`, `${D}-${M}-${Y}`, `${D}_${M}_${Y}`, `${day}-${m}-${Y}`, `${day}/${m}/${Y}`,
      `${day} de ${MES}`, `${D} de ${MES}`, `${day} ${MES}`, `${D} ${MES}`];
  }
  function normName(s) { return String(s || "").replace(/[.\s_\-\/]/g, "").toLowerCase(); }
  // ¿El nombre contiene el token SIN que sea cola de otro número? Evita que el día 6
  // acepte un archivo del "26 de agosto" (el "6deagosto" vive dentro de "26deagosto").
  // OJO: esta guarda SOLO aplica a los tokens con mes en letras. A los numéricos NO:
  // un "Agenda_v2_20260806.xlsx" real quedaría rechazado porque al normalizar la "2"
  // de "v2" queda pegada a la fecha (medido en el banco de pruebas) — esos conservan
  // la coincidencia simple de siempre.
  function nameHasToken(n, t) {
    let i = -1;
    while ((i = n.indexOf(t, i + 1)) >= 0) { const prev = n[i - 1]; if (!(prev >= "0" && prev <= "9")) return true; }
    return false;
  }
  function esNombreDeHoy(name) {
    const toks = todayTokens().map(normName);
    const n = normName(name);
    return toks.some((t) => (/[a-z]/.test(t) ? nameHasToken(n, t) : n.includes(t)));
  }
  function pickTodaysFile(files) {
    const xls = (files || []).filter((f) => /\.(xlsx|xlsm|csv)$/i.test(f.Name || "") && !/^~\$/.test(f.Name || ""));
    if (!xls.length) return null;
    // 1. Coincidencia EXACTA con el nombre de HOY (ej: Agenda_Dia_CMB_20260808.xlsx)
    const matchName = xls.find((f) => esNombreDeHoy(f.Name));
    if (matchName) return matchName;

    // 2. Si no hay coincidencia por nombre, buscar archivos modificados HOY que NO sean de fechas futuras
    const todayStr = todayStamp();
    const matchMod = xls.find((f) => f.TimeLastModified && f.TimeLastModified.startsWith(todayStr) && !/20\d{6}/.test(f.Name));
    if (matchMod) return matchMod;

    return null;
  }
  // v7.8: si el PyM de HOY subió en formato .xls ANTIGUO (binario de Excel 97-2003),
  // no se puede leer desde el navegador — pero callarlo sería peor: se detecta y se
  // avisa UNA vez al día, para que pidan re-guardarlo como .xlsx.
  function xlsViejoDeHoy(files) {
    return (files || []).find((f) => /\.xls$/i.test(f.Name || "") && !/^~\$/.test(f.Name || "") && esNombreDeHoy(f.Name)) || null;
  }
  // encodeURI (no encodeURIComponent): las barras del camino deben quedar como barras.
  function spListUrl(folder) { return spBase() + "/_api/web/GetFolderByServerRelativeUrl('" + encodeURI(folder || CONFIG.SP.folder) + "')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$orderby=TimeLastModified%20desc&$top=60"; }
  const spRows = (j) => (j && (j.value || (j.d && j.d.results))) || [];
  function spDownloadUrl(sru) { return spBase() + "/_api/web/GetFileByServerRelativeUrl('" + encodeURI(sru) + "')/$value"; }
  // Listado (JSON), vía Everest con GM_xmlhttpRequest + cookies de SharePoint. Corto:
  // si la carpeta no responde en 12 s, no va a responder — mejor no dejar el panel quieto.
  const gmJson = async (url) => { const r = await gmGet(url, "json", "application/json;odata=nometadata", 12000); return r.response || (r.responseText ? JSON.parse(r.responseText) : {}); };

  // v7.8.3: "PRIME" del enlace compartido de la carpeta — sin login manual. Visitar el
  // enlace de "Compartir" de SharePoint le da a ESTE navegador (mismo dominio, mismas
  // cookies que ya usan spListUrl/spDownloadUrl) acceso de solo lectura a esa carpeta,
  // SIN que nadie tenga que iniciar sesión con su usuario. Se repite cada ~25 min (la
  // cookie de acceso anónimo de SharePoint expira; "recargar" el enlace la renueva) y
  // SIEMPRE antes de listar/descargar si la última vez falló con 401/403.
  let shareAccessAt = 0;
  async function primeShareAccess(force) {
    const link = CONFIG.SP.shareLink;
    if (!link || typeof GM_xmlhttpRequest === "undefined") return false;
    if (!force && Date.now() - shareAccessAt < 25 * 60 * 1000) return true;
    try { await gmGet(link, "", "", 15000); shareAccessAt = Date.now(); return true; }
    catch (e) { return false; }
  }
  // Del enlace de un ARCHIVO de SharePoint saca su identificador único (sourcedoc).
  // Acepta el enlace completo, el GUID con llaves o el GUID pelado.
  function parseSpDocId(u) {
    try {
      const s = decodeURIComponent(String(u || ""));
      const m = /sourcedoc=\{?([0-9a-fA-F-]{36})\}?/.exec(s) || /\{([0-9a-fA-F-]{36})\}/.exec(s) || /^\s*([0-9a-fA-F-]{36})\s*$/.exec(s);
      return m ? m[1].toLowerCase() : "";
    } catch (e) { return ""; }
  }
  // Dos formas de bajar un archivo por identificador (si una falla se prueba la otra).
  function spFallbackUrls(id) {
    const g = String(id || "").replace(/[{}]/g, "").toLowerCase();
    return [
      spBase() + "/_api/web/GetFileById('" + g + "')/$value",
      spBase() + "/_layouts/15/download.aspx?UniqueId=" + g,
    ];
  }
  // v7.8: devuelve directamente el ÍNDICE ({map, todos}); nunca la tabla de filas.
  async function readPym(name, buffer) {
    if (/\.csv$/i.test(name)) {
      const all = parseCSV(new TextDecoder().decode(new Uint8Array(buffer)));
      return indexRowsAsync(all[0] || [], all.slice(1), makeYielder(15));
    }
    const r = await readPymWorkbookStream(buffer);
    state.pymHoja = r.sheetName || "";
    return { map: r.map, todos: r.todos, abandono: r.abandono };
  }
  // Tiempo de espera POR LLAMADA: los listados deben rendirse rápido (si SharePoint no
  // responde en 12 s, no va a responder) para no dejar al usuario mirando un panel quieto;
  // las descargas sí necesitan margen porque la base piloto pesa 13 MB.
  function gmGet(url, responseType, accept, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === "undefined") { reject(new Error("permiso GM_xmlhttpRequest no concedido")); return; }
      GM_xmlhttpRequest({ method: "GET", url, responseType: responseType || "", headers: accept ? { Accept: accept } : {}, timeout: timeoutMs || 60000,
        onload: (r) => (r.status >= 200 && r.status < 300) ? resolve(r) : reject(new Error("HTTP " + r.status)),
        onerror: () => reject(new Error("error de red/permiso")), ontimeout: () => reject(new Error("se agotó el tiempo")) });
    });
  }
  const T_DESCARGA = 120000; // margen para la descarga: la base pesa ~14 MB
  // v7.8: ASÍNCRONA y por tandas. Antes cada pestaña interpretaba hasta 12 MB de JSON
  // de un solo golpe EN PLENA CARGA de la página (340 ms medidos en CPU rápida; segundos
  // en los equipos del consultorio, multiplicado por pestaña). Ahora: comprobación de
  // fecha barata sin desempaquetar, y el desempaquetado cede el hilo cada ~15 ms.
  let cacheCargando = false;
  async function loadPymFromCache() {
    if (cacheCargando) return false;
    cacheCargando = true;
    try {
      if (typeof GM_getValue === "undefined") return false;
      const raw = GM_getValue("vgl_pym", ""); if (!raw) return false;
      // Purga de días anteriores: no conservamos datos de pacientes de jornadas pasadas.
      // OJO: se borra TAMBIÉN la marca "vgl_pym_dia"; si queda puesta, el captador de la
      // pestaña de SharePoint cree que la base de hoy ya está y no vuelve a capturarla.
      const purgar = () => { try { GM_setValue("vgl_pym", ""); GM_setValue("vgl_pym_dia", ""); } catch (e2) {} };
      // Un paquete que no sea v3 (p. ej. la caché v2 del día de la actualización) se
      // descarta por el PREFIJO, sin pagar el JSON.parse de varios MB solo para tirarlo.
      if (raw.lastIndexOf('{"v":3', 0) !== 0) { purgar(); return false; }
      // La fecha viaja al FINAL del paquete (los metadatos van tras los datos): mirar la
      // cola evita desempaquetar varios MB solo para descubrir que es de ayer.
      const rapida = /"date":"(\d{4}-\d{2}-\d{2})"/.exec(raw.slice(-800));
      if (rapida && rapida[1] !== todayStamp()) { purgar(); return false; }
      const u = await unpackPym(raw, makeYielder(15));
      if (!u) { purgar(); return false; }               // formato v2 u otro: se re-indexa
      if (u.meta.date !== todayStamp()) { purgar(); return false; }
      if (state.pymFile) return true;                    // algo se cargó mientras se desempaquetaba
      state.pym = u.map; state.pymTodos = u.todos; state.pymAbandono = u.abandono || new Set(); state.pymMTime = u.meta.mtime || ""; state.pymFP = u.meta.fp || ""; state.pymFallback = !!u.meta.fb; afterPymLoaded((u.meta.name || "PyM") + " (auto)", !u.meta.fb); return true;
    } catch (e) { return false; } finally { cacheCargando = false; } }
  // ¿La respuesta es de verdad un Excel? (.xlsx = ZIP, empieza por "PK"). Si SharePoint
  // devuelve la página de inicio de sesión con estado 200, aquí se cae la careta.
  function esLibroValido(buf, nombre) {
    if (!buf || !buf.byteLength) return false;
    if (/\.csv$/i.test(nombre || "")) return true;
    const u8 = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
    return u8[0] === 0x50 && u8[1] === 0x4B;
  }
  // v7.8.1: un .xlsx PROTEGIDO CON CONTRASEÑA no es un ZIP — es un contenedor OLE/CFB
  // cifrado (firma D0 CF 11 E0). esLibroValido() ya lo rechaza (no empieza por "PK"),
  // pero antes caía en el mismo error genérico "no es un Excel" que una sesión vencida.
  // Se distingue para que el aviso diga la verdad, en vez de mandar a reabrir SharePoint
  // sin motivo cuando el problema real es que hay que quitarle la contraseña al archivo.
  function esXlsxCifrado(buf) {
    if (!buf || buf.byteLength < 8) return false;
    const u8 = new Uint8Array(buf, 0, 8);
    return u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
  }
  // Avisos de progreso: que nunca parezca colgado mientras trabaja.
  function progreso(txt) { try { if (!state.pymFile) setSummary("⏳ " + txt); } catch (e) {} }

  // ---- BASE PILOTO PERSISTENTE (v7.8.1, pedido explícito del programa) ----
  // La copia INDEXADA de la piloto queda GUARDADA entre días en el almacén de
  // Tampermonkey. Al necesitarla se muestra AL INSTANTE (sin red, sin releer 14 MB) y
  // solo se comprueba 1-2 VECES AL DÍA (mañana/tarde, una consulta de metadatos de
  // ~1 KB) si cambió en SharePoint. Sin red, o sin cambios: se usa SIEMPRE la última
  // copia guardada — nunca se vuelve a pagar la descarga completa solo por rutina.
  // El PyM del DÍA conserva su ciclo propio (cada 10 min); «Abrir PyM» manda siempre.
  let baseIntentos = 0;
  const PILOTO_KEY = "vgl_piloto", PILOTO_CHK = "vgl_piloto_chk";
  function pilotoId() { const fb = CONFIG.SP.respaldo; return (fb && fb.id ? String(fb.id) : "").replace(/[{}]/g, "").toLowerCase(); }
  async function pilotoDesdeCache() {
    try {
      if (typeof GM_getValue === "undefined") return false;
      const raw = GM_getValue(PILOTO_KEY, ""); if (!raw || raw.lastIndexOf('{"v":3', 0) !== 0) return false;
      const u = await unpackPym(raw, makeYielder(15));
      if (!u || (u.meta.id || "") !== pilotoId()) return false;   // cambió el enlace configurado en Ajustes
      if (state.pymFile) return true;
      state.pym = u.map; state.pymTodos = u.todos; state.pymAbandono = u.abandono || new Set(); state.pymMTime = u.meta.mtime || ""; state.pymFP = u.meta.fp || "";
      state.pymFallback = true;
      uxTrack("pym.fallback.cache");
      afterPymLoaded((u.meta.name || "Base piloto") + " (base piloto — aún no llega la de hoy)");
      return true;
    } catch (e) { return false; }
  }
  async function pilotoGuardar(idx, meta) {
    try {
      if (typeof GM_setValue === "undefined") return;
      const txt = await packPym(idx.map, idx.todos, idx.abandono, Object.assign({ date: todayStamp(), fb: true, id: pilotoId() }, meta || {}), makeYielder(15));
      if (txt.length <= 12 * 1024 * 1024) GM_setValue(PILOTO_KEY, txt);
    } catch (e) {}
  }
  // Metadatos del archivo piloto (unos bytes): saber si cambió SIN bajarlo entero.
  async function pilotoMeta() {
    try {
      const j = await gmJson(spBase() + "/_api/web/GetFileById('" + pilotoId() + "')?$select=Name,TimeLastModified");
      const o = (j && j.d) ? j.d : j;
      return (o && o.TimeLastModified) ? { name: o.Name || "", mtime: o.TimeLastModified } : null;
    } catch (e) { return null; }
  }
  // Revisión de frescura: como máximo UNA vez por franja (mañana / tarde) por día, y
  // solo mientras se esté usando la piloto (si ya llegó el PyM real, no aplica).
  let pilotoChkEnCurso = false;
  async function pilotoFreshCheck() {
    try {
      if (pilotoChkEnCurso || !S.baseAuto || !state.pymFallback || typeof GM_getValue === "undefined") return;
      if (!heartbeat()) return;
      const franja = todayStamp() + "|" + (new Date().getHours() < 12 ? "am" : "pm");
      if (GM_getValue(PILOTO_CHK, "") === franja) return;
      pilotoChkEnCurso = true;
      GM_setValue(PILOTO_CHK, franja);
      const m = await pilotoMeta();
      if (!m || (m.mtime && m.mtime === state.pymMTime)) return;  // sin metadatos o sin cambios: sigue la copia
      const ok = await loadPymBaseDescarga(true, m);
      if (ok) notify("AZUL", "📋 Base piloto actualizada", (m.name || "Base piloto") + "\nSe bajó la versión nueva desde el servidor de datos.", false, "pilotoupd|" + franja); // [COPY-UX]
    } catch (e) {} finally { pilotoChkEnCurso = false; }
  }
  async function loadPymBase(silent) {
    if (!S.baseAuto) return false;
    const fb = CONFIG.SP.respaldo;
    if (!fb || !fb.id || typeof GM_xmlhttpRequest === "undefined") return false;
    if (state.pymFile) return true;                    // ya hay algo cargado (caché o manual)
    // v7.8.1: PRIMERO la copia guardada (cero red, instantánea). La frescura se
    // revisa aparte, 1-2 veces al día, sin bloquear el arranque.
    if (await pilotoDesdeCache()) { pilotoFreshCheck(); return true; }
    return loadPymBaseDescarga(silent, await pilotoMeta());
  }
  async function loadPymBaseDescarga(silent, meta) {
    const fb = CONFIG.SP.respaldo;
    if (!fb || !fb.id || typeof GM_xmlhttpRequest === "undefined") return false;
    progreso("Bajando la base PyM de la sede… (pesa ~14 MB, puede tardar medio minuto)");
    // Las dos rutas del mismo archivo se prueban UNA TRAS OTRA, no a la vez: en
    // paralelo serían dos descargas de ~14 MB el mismo día. Medido en la red de la
    // sede: 13.6 MB en 15-19 s por ruta; el margen de 120 s sobra.
    const errores = [];
    let buf = null;
    for (const url of spFallbackUrls(fb.id)) {
      try {
        const dl = await gmGet(url, "arraybuffer", "", T_DESCARGA);
        if (!esLibroValido(dl.response, fb.name)) throw new Error(esXlsxCifrado(dl.response) ? "el archivo tiene contraseña" : "no es un Excel");
        buf = dl.response; break;
      } catch (e) { errores.push((e && e.message) || "error"); }
    }
    if (!buf) {
      // Diagnóstico CLARO (antes fallaba en silencio y nadie sabía por qué):
      // v7.8: el caso /red|permiso/ casi siempre era la SESIÓN de SharePoint vencida:
      // la petición redirige a login.microsoftonline.com y Tampermonkey la cortaba ahí
      // (esos dominios ya están en @connect, pero sin sesión igual no hay archivo).
      // v7.8.1: el archivo CON CONTRASEÑA se distingue del resto — no es un problema de
      // sesión, es que hay que quitarle la protección antes de subirlo.
      const razon = errores.find((x) => /contraseña/i.test(x)) ? "el archivo del servidor de datos tiene CONTRASEÑA — pide que lo guarden sin protección (Excel: Archivo → Información → Proteger libro → Quitar contraseña)" // [COPY-UX]
        : errores.find((x) => /red|permiso/i.test(x)) ? "la conexión no salió (permiso de Tampermonkey, o sesión de sincronización remota vencida que redirige al login)" // [COPY-UX]
        : errores.find((x) => /401|403/.test(x)) ? "el servidor de datos rechazó la sesión (401/403)" // [COPY-UX]
        : errores.find((x) => /no es un Excel/i.test(x)) ? "el servidor de datos contestó su página de inicio de sesión en vez del archivo" // [COPY-UX]
        : (errores[0] || "sin respuesta");
      if (!silent) setSummary("No bajó la base PyM — " + razon + ". Arreglo: Ajustes → «Sincronización remota», entra con tu usuario y espera el aviso de captura (o usa «Abrir PyM»).", "warn"); // [COPY-UX]
      console.warn("[Vigilante] base PyM:", errores.join(" · "));
      return false;
    }
    // En la revisión de frescura, state.pymFile YA está puesto (es la copia vieja de la
    // piloto): solo se aborta si lo cargado NO es la piloto (PyM real o carga manual).
    if (state.pymFile && !state.pymFallback) return true;
    progreso("Leyendo la base…");
    const idx = await readPym(fb.name, buf);
    if (state.pymFile && !state.pymFallback) return true;
    // La copia persistente se guarda ANTES de aplicar (orden determinista) y con los
    // metadatos reales del archivo, para que la próxima revisión de frescura compare bien.
    await pilotoGuardar(idx, { name: (meta && meta.name) || fb.name, mtime: (meta && meta.mtime) || "", fp: pymFP(fb.name, (meta && meta.mtime) || "") });
    // v7.7: esta es la base PILOTO (respaldo) — antes esta línea decía "false" por error
    // y el panel nunca alcanzaba a avisar "⚠ RESPALDO". Ahora sí marca correctamente que
    // NO es el PyM real del día, para que loadPymDiario() sepa que puede reemplazarla.
    state.pymFallback = true;
    uxTrack("pym.fallback.red");
    applyPymIdx(idx, ((meta && meta.name) || fb.name) + " (base piloto — aún no llega la de hoy)", (meta && meta.mtime) || "", fb.name);
    notify("AMBAR", "📋 Usando la base piloto (mientras llega la de hoy)", fb.name + "\n" + state.pym.size + " paciente(s). Es una base de referencia, NO la agenda de hoy — puede tener actividades desactualizadas. Se reemplaza sola apenas aparezca el PyM real de hoy en el servidor de datos.", false); // [COPY-UX]
    return true;
  }
  // v7.7: PyM DEL DÍA — primera opción. Busca en la carpeta de SharePoint (confirmada
  // por captura real) el archivo cuyo nombre trae la fecha de hoy y lo descarga directo,
  // sin que el médico entre a SharePoint. Si ya está cargado y no cambió, no hace nada
  // (compara la huella nombre+fecha de modificación — no vuelve a descargar los mismos
  // ~5-15 MB cada vez). Se llama periódicamente: la primera vez que lo encuentra
  // REEMPLAZA lo que hubiera (incluida la base piloto, vía el mismo applyPymIdx() que ya
  // sustituye todo el mapa de PyM, no lo mezcla).
  let diarioEnCurso = false;
  // v7.8.1: contador de chequeos SEGUIDOS en los que ni siquiera se pudo LISTAR la
  // carpeta (la sesión de SharePoint murió a media jornada — el caso más peligroso,
  // porque antes fallaba en silencio total y el médico seguía con la piloto sin
  // enterarse de que el PyM real podía llevar horas subido). A los 30 min (3
  // chequeos de 10 min) se avisa UNA sola vez al día.
  let diarioFallosSesion = 0;
  async function fetchSpFilesMultiFolder() {
    const flds = CONFIG.SP.folders || [CONFIG.SP.folder];
    let allRows = [];
    let lastError = null;
    for (const fld of flds) {
      try {
        const d = await gmJson(spListUrl(fld));
        const r = spRows(d);
        if (r && r.length) {
          allRows.push(...r);
          if (pickTodaysFile(r)) return allRows;
        }
      } catch (e) {
        lastError = e;
      }
    }
    if (allRows.length === 0 && lastError) throw lastError;
    return allRows;
  }

  async function loadPymDiario(silent) {
    if (diarioEnCurso || typeof GM_xmlhttpRequest === "undefined") return false;
    diarioEnCurso = true;
    try {
      // v7.8.3: renueva el acceso por el enlace compartido ANTES de listar — así la
      // gran mayoría de los equipos nunca ven un 401/403 en primer lugar.
      await primeShareAccess();
      let filas;
      try {
        filas = await fetchSpFilesMultiFolder();
        diarioFallosSesion = 0;                          // listó bien: la sesión está viva
      } catch (eList) {
        // Un solo reintento: fuerza refrescar el enlace compartido (por si la cookie
        // ya había expirado) y vuelve a listar antes de darse por vencido.
        try { await primeShareAccess(true); filas = await fetchSpFilesMultiFolder(); diarioFallosSesion = 0; }
        catch (eList2) {
          diarioFallosSesion++;
          filas = [];
          if (diarioFallosSesion === 3 && state.leader) {
            notify("AMBAR", "🔒 Posible sesión de sincronización vencida", "Llevo media hora sin poder revisar la carpeta del PyM — si el archivo de hoy ya está subido, no lo estoy viendo.\nAbre Sincronización remota una vez (Ajustes → «Sincronización remota») para renovar la sesión.", false, "sesionvencida|" + todayStamp()); // [COPY-UX]
          }
        }
      }
      const sel = pickTodaysFile(filas);
      if (!sel) {
        // ¿Subieron el de hoy pero en .xls antiguo? Avisar claro en vez de quedarse mudo.
        const viejo = xlsViejoDeHoy(filas);
        if (viejo && state.leader) notify("AMBAR", "📋 El PyM de hoy está en formato .xls antiguo", viejo.Name + "\nEse formato no se puede leer desde el navegador. Pide que lo guarden como .xlsx (Excel: Guardar como → Libro de Excel) y se cargará solo en el siguiente chequeo.", false, "xlsviejo|" + todayStamp());
        if (!silent) setSummary("Aún no aparece el PyM de hoy en el servidor de datos. " + (state.pymFile ? "Sigo con lo que hay cargado." : "Buscando también la base piloto mientras tanto."), "warn"); // [COPY-UX]
        return false;
      }
      // Ya es exactamente este archivo (mismo nombre + misma fecha de modificación):
      // nada que hacer, ahorra la descarga.
      if (state.pymFP === pymFP(sel.Name, sel.TimeLastModified)) return true;
      progreso("Descargando el PyM de hoy (" + sel.Name + ")…");
      const dl = await gmGet(spDownloadUrl(sel.ServerRelativeUrl), "arraybuffer", "", T_DESCARGA);
      if (!esLibroValido(dl.response, sel.Name)) throw new Error(esXlsxCifrado(dl.response) ? "el archivo tiene contraseña — pide que la quiten antes de subirlo" : "no es un Excel (¿sesión caída?)");
      const idx = await readPym(sel.Name, dl.response);
      const eraRespaldo = state.pymFallback;
      // v12.0.0 (del otro linaje) — El aviso de Windows solo sale cuando APORTA algo: la
      // primera carga del día, la llegada del PyM real tras la base piloto, o una búsqueda
      // pedida a mano. El script revisa la carpeta cada 10 minutos y vuelve a descargar en
      // cuanto alguien guarda el Excel, así que sin esta condición el médico recibía el
      // mismo cartel "PyM del día cargado" una y otra vez durante la consulta.
      const teniaPymPreviamente = !!state.pymMTime;
      state.pymFallback = false;
      applyPymIdx(idx, sel.Name + " (PyM de hoy)", sel.TimeLastModified, sel.Name, true);
      if (!silent || eraRespaldo || !teniaPymPreviamente) {
        notify("AZUL", eraRespaldo ? "📋 Ya llegó el PyM real de hoy" : (teniaPymPreviamente ? "📋 PyM del día actualizado" : "📋 PyM del día cargado"),
          sel.Name + "\n" + state.pym.size + " paciente(s) con actividades." + (eraRespaldo ? " Se reemplazó la base piloto." : ""), false);
      }
      return true;
    } catch (e) {
      if (!silent) setSummary("No pude leer el PyM del día (" + ((e && e.message) || e) + "). " + (state.pymFile ? "Sigo con lo que hay cargado." : "Probando la base piloto."), "warn");
      return false;
    } finally { diarioEnCurso = false; }
  }
  // CAPTADOR LIGERO en la pestaña de SharePoint (v7.3.2). Si la descarga desde
  // Everest falla (permiso de Tampermonkey, sesión, 403…), este es el plan seguro:
  // cuando usted abre SharePoint, la base se baja AQUÍ MISMO con fetch de la propia
  // pestaña (misma sesión, mismos permisos con los que ya está viendo el archivo) y
  // se comparte con Everest por el almacén de Tampermonkey. Solo actúa si falta la
  // base de hoy; no monta panel, no observa nada, no repite rondas.
  async function bootSharepointLite() {
    try {
      if (typeof GM_setValue === "undefined" || typeof GM_getValue === "undefined") return;
      if (!S.baseAuto) return;
      // "Ya está" SOLO si es de hoy, el paquete existe de verdad, Y no es la base
      // piloto (si es piloto, seguimos intentando conseguir el PyM real de hoy).
      const yaListo = GM_getValue("vgl_pym_dia", "") === todayStamp() && !GM_getValue("vgl_pym_esfallback", "1") && String(GM_getValue("vgl_pym", "") || "").length > 100;
      if (yaListo) return;
      spToast("Buscando el PyM de hoy…");
      // v7.7: PRIMERA opción — el PyM real de hoy, listando la carpeta (misma sesión,
      // sin permisos extra). Solo si no aparece se usa la base piloto de respaldo.
      let nombre = "", buf = null, esFallback = true, mtime = "";
      try {
        const rl = await fetch(spListUrl(), { credentials: "include", headers: { Accept: "application/json;odata=nometadata" } });
        if (rl.ok) {
          const sel = pickTodaysFile(spRows(await rl.json()));
          if (sel) {
            const rd = await fetch(spDownloadUrl(sel.ServerRelativeUrl), { credentials: "include" });
            if (rd.ok) { const b = await rd.arrayBuffer(); if (esLibroValido(b, sel.Name)) { buf = b; nombre = sel.Name; mtime = sel.TimeLastModified || ""; esFallback = false; } }
          }
        }
      } catch (e) {}
      if (!buf) {
        let fb = CONFIG.SP.respaldo;
        if (S.respaldoId && /\S/.test(S.respaldoId)) { const g = parseSpDocId(S.respaldoId); if (g) fb = { id: g, name: "Base PyM (enlace personalizado)" }; }
        if (!fb || !fb.id) return;
        let err = "";
        for (const url of spFallbackUrls(fb.id)) {
          try {
            const r = await fetch(url, { credentials: "include" });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const b = await r.arrayBuffer();
            if (!esLibroValido(b, fb.name)) throw new Error("no es un Excel");
            buf = b; nombre = fb.name; break;
          } catch (e) { err = (e && e.message) || "error"; }
        }
        if (!buf) { spToast("No pude bajar el PyM (" + err + "). Ábrelo una vez con tu usuario y recarga esta página."); return; }
      }
      const idx = await readPym(nombre, buf);
      const txt = await packPym(idx.map, idx.todos, idx.abandono, { date: todayStamp(), name: nombre + (esFallback ? " (base piloto — aún no llega la de hoy)" : " (PyM de hoy)"), mtime, fp: pymFP(nombre, mtime), fb: esFallback }, makeYielder(15));
      if (txt.length <= 12 * 1024 * 1024) { GM_setValue("vgl_pym", txt); GM_setValue("vgl_pym_dia", todayStamp()); GM_setValue("vgl_pym_esfallback", esFallback ? "1" : ""); }
      spToast((esFallback ? "⚠ Sin PyM de hoy — se usará la base piloto (referencia): " : "✓ PyM de hoy capturado: ") + nombre + " — " + idx.map.size + " paciente(s). Ya está disponible en Everest.");
    } catch (e) { try { spToast("No pude capturar el PyM: " + ((e && e.message) || e)); } catch (x) {} }
  }

  // Hasta 3 intentos espaciados por si la sesión de SharePoint aún no está lista al
  // arrancar el turno. Solo descarga la pestaña líder; las demás esperan la caché.
  function schedulePymBase() {
    if (state.pymFile || baseIntentos >= 3) return;
    const espera = baseIntentos === 0 ? 2000 : baseIntentos === 1 ? 45000 : 180000;
    baseIntentos++;
    setTimeout(async () => {
      if (state.pymFile || await loadPymFromCache()) return;
      if (!heartbeat()) { schedulePymBase(); return; }
      console.log("[Vigilante] base PyM: intento " + baseIntentos + " de 3");
      // El ÚLTIMO intento habla: si falla, el motivo queda a la vista en el panel
      // (antes los tres intentos eran mudos y el "PyM sin cargar" no se explicaba).
      const ok = await loadPymBase(baseIntentos < 3).catch(() => false);
      if (!ok) schedulePymBase();
    }, espera);
  }
  // v12.0.0 (del otro linaje) — Aviso de sincronización DESCARTABLE. La versión anterior
  // creaba un cartel fijo sin botón de cierre ni autodescarte: se quedaba tapando la
  // esquina de la pantalla el resto de la jornada. Ahora se cierra con la × , con un clic,
  // o solo a los 6 s (durationMs = 0 para dejarlo fijo cuando haga falta).
  let spToastTimer = null;

  function dismissSpToast() {
    try {
      if (spToastTimer) { clearTimeout(spToastTimer); spToastTimer = null; }
      const t = document.getElementById("vgl-sp");
      if (t) {
        t.classList.remove("vgl-sp-visible");
        setTimeout(() => { try { t.remove(); } catch (e2) {} }, 260);
      }
    } catch (e) {}
  }

  function spToast(msg, durationMs = 6000) {
    try {
      let t = document.getElementById("vgl-sp");
      if (!t) {
        t = document.createElement("div");
        t.id = "vgl-sp";
        /* HUD OLED autónomo: #vgl-sp vive fuera de #vgl-root (sin tokens ni .perf a mano), así que
           valores literales y CERO efectos pesados: sin backdrop-filter ni animaciones en bucle. */
        t.className = "vgl-sp-toast";

        const closeBtn = document.createElement("span");
        closeBtn.className = "vgl-sp-x";
        closeBtn.textContent = "×";
        closeBtn.onclick = (e) => { e.stopPropagation(); dismissSpToast(); };
        t.appendChild(closeBtn);

        t.onclick = () => dismissSpToast();
        (document.body || document.documentElement).appendChild(t);
        t.getBoundingClientRect();
      }

      let textNode = t.querySelector(".vgl-sp-text");
      if (!textNode) {
        textNode = document.createElement("span");
        textNode.className = "vgl-sp-text";
        // v12.3.32 — CONFIRMADO con captura real: el CSS de Everest pintaba este texto de
        // azul oscuro sobre fondo negro (ilegible). Un estilo inline normal no basta si la
        // página trae una regla !important, así que el color se fija también con !important.
        textNode.style.setProperty("color", "#f7fafc", "important");
        textNode.style.setProperty("font-weight", "600", "important");
        t.insertBefore(textNode, t.firstChild);
      }
      textNode.textContent = "🛡️ Vigilante PyM · " + msg;

      t.classList.add("vgl-sp-visible");

      if (spToastTimer) clearTimeout(spToastTimer);
      if (durationMs > 0) {
        spToastTimer = setTimeout(() => dismissSpToast(), durationMs);
      }
    } catch (e) {}
  }

  function loadPymFile(file) {
    const name = file.name.toLowerCase(); const reader = new FileReader();
    reader.onerror = () => setSummary("No se pudo leer el archivo PyM.", "error");
    // v12.4.1 — Un archivo elegido a mano solo cuenta como "el diario real de HOY" (y por
    // tanto detiene la re-búsqueda automática) si su NOMBRE trae la fecha de hoy. Un
    // Excel de ayer cargado a mano ya no apaga la búsqueda: el real de hoy lo reemplaza
    // en cuanto aparece en SharePoint (hallazgo ALTO de la revisión adversarial).
    const esDeHoy = esNombreDeHoy(file.name);
    if (name.endsWith(".csv")) { reader.onload = async (e) => { try { const all = parseCSV(String(e.target.result)); const idx = await indexRowsAsync(all[0] || [], all.slice(1), makeYielder(15)); state.pymFallback = false; applyPymIdx(idx, file.name, "", file.name, esDeHoy); } catch (err) { setSummary("Error CSV: " + err.message, "error"); } }; reader.readAsText(file, "UTF-8"); }
    else { reader.onload = async (e) => { try { if (typeof DecompressionStream === "undefined") throw new Error("Navegador sin soporte .xlsx; usa .csv."); const r = await readPymWorkbookStream(e.target.result); state.pymFallback = false; state.pymHoja = r.sheetName || ""; applyPymIdx({ map: r.map, todos: r.todos, abandono: r.abandono }, file.name + (r.sheetName ? " · hoja «" + r.sheetName + "»" : ""), "", file.name, esDeHoy); } catch (err) { setSummary("Error .xlsx (" + err.message + "). Prueba .csv.", "error"); } }; reader.readAsArrayBuffer(file); }
  }

  // ---- Extracción del DOM (parametrizada por documento: sirve para la página o para el clon) ----
  function firstMatch(root, selList) { const arr = Array.isArray(selList) ? selList : [selList]; for (const s of arr) { const el = root.querySelector(s); if (el) return el; } return null; }
  function containerOf(elHora) {
    for (const s of CONFIG.SEL.contenedor) { const c = elHora.closest(s); if (c) return c; }
    const body = elHora.ownerDocument.body; let n = elHora.parentElement, saltos = 0;
    while (n && n !== body && saltos < 8) { if (n.querySelector(CONFIG.SEL.estado)) return n; n = n.parentElement; saltos++; }
    return null;
  }
  function extractAgenda(doc) {
    doc = doc || document;
    const horas = Array.from(doc.querySelectorAll(CONFIG.SEL.hora));
    if (horas.length === 0) return { visible: false, citas: [] };
    const citas = horas.map((h, i) => {
      const cont = containerOf(h); let estado = "", documento = "", nombre = "", modalidad = "";
      if (cont) {
        estado = limpio((cont.querySelector(CONFIG.SEL.estado) || {}).textContent);
        documento = limpio((firstMatch(cont, CONFIG.SEL.documento) || {}).textContent);
        nombre = limpio((firstMatch(cont, CONFIG.SEL.nombre) || {}).textContent);
        modalidad = limpio((cont.querySelector(CONFIG.SEL.modalidad) || {}).textContent);
      }
      return { hora_texto: limpio(h.textContent), doc_id: extractDoc(documento), nombre: nombre || "Paciente Everest", modalidad, estado: estado || "Pendiente", index: i };
    });
    return { visible: true, citas };
  }

  // =====================================================================
  //  SECCIÓN ACTIVA (v7.8.1) — Everest es una SPA Angular: la página NO recarga al
  //  cambiar de pantalla (Angular solo reemplaza el DOM interno), así que el script,
  //  inyectado UNA sola vez por Tampermonkey al abrir Everest, seguía vigilando (leer
  //  el DOM, sondear el API, mostrar el panel) en CUALQUIER sección, no solo en las
  //  dos donde tiene sentido: agenda del día e historia clínica.
  //  Detección por LISTA BLANCA (no hace falta conocer todas las demás pantallas de
  //  Everest): los MISMOS marcadores de DOM que el script ya usaba para leer la
  //  agenda (.labelHora, CONFIG.SEL.hora) y el recordatorio de PyM (#anamesis).
  //  Fuera de las dos, tick() se apaga entero (DOM, API, panel) y se recoge a la
  //  pastilla flotante; al volver, se restaura sola.
  // =====================================================================
  // =====================================================================
  //  MÓDULO CLÍNICO (HCHealth) vs. OTROS MÓDULOS DE EVEREST (v12.5.14)
  //  Reportado en consultorio: los avisos (Windows/toast/sonido/cartel) llegaban
  //  también con la pestaña líder abierta en .../viva/Acceso/ — un módulo de Everest
  //  totalmente distinto (asignación/reserva de turnos), sin nada que ver con la
  //  agenda del día que el Vigilante vigila. Los avisos deben vivir SOLO dentro del
  //  módulo clínico HCHealth (.../viva/HCHealth/...), que es donde corren tanto
  //  "Citas del día" y la Historia Clínica como las demás pantallas del médico
  //  (Órdenes, RCV) que v12.3.21 ya dejaba notificar. Se distingue por el segmento
  //  de ruta, no por marcadores de DOM: seccionActiva() ya sirve para eso, pero es
  //  deliberadamente angosta (solo reconoce agenda/historia, no Órdenes ni RCV).
  // =====================================================================
  function _enModuloHCHealth() {
    try { return /\/viva\/HCHealth(\/|$)/i.test(location.pathname); }
    catch (e) { return false; }
  }

  function seccionActiva() {
    try {
      if (document.getElementById("anamesis")) return "historia";
      // v7.8.1: exige HORA + ESTADO juntos (no solo .labelHora) — un médico puede tener
      // a la vez la agenda y una pantalla de "Asignación de citas" (que probablemente
      // también muestre horas, para reservar turnos) en pestañas distintas; con un solo
      // marcador esa pantalla podría confundirse con la lista de "Citas del día" y abrir
      // el panel donde no corresponde. Exigir el PAR completo (hora Y el chip de estado
      // "En Sala"/"Sin presentarse"/"Atendido", que una pantalla de RESERVA de turnos no
      // tendría — ahí no hay estados de asistencia, solo horarios disponibles) es mucho
      // más específico de la vista real que vigila el script.
      if (document.querySelector(CONFIG.SEL.hora) && document.querySelector(CONFIG.SEL.estado)) return "agenda";
      return "otra";
    } catch (e) { return "otra"; }              // ante la duda, apagar la vigilancia para no causar errores en DOM
  }

  // =====================================================================
  //  RECORDATORIO DE PyM AL ABRIR LA HISTORIA CLÍNICA (v7.6)
  //  Confirmado con diagnóstico real en Everest: la pestaña #anamesis SOLO existe
  //  en la vista de historia clínica (ancla barata y confiable), y la cédula vive
  //  en un .text-muted dentro del bloque de datos del paciente — el MISMO patrón
  //  de clase que Everest ya usa en "Citas del día" (reutiliza extractDoc()).
  // =====================================================================
  function extractPacienteAbierto() {
    try {
      if (!document.getElementById("anamesis")) return "";     // no estamos en historia clínica
      const contenedor = document.querySelector("app-index") || document;
      for (const el of contenedor.querySelectorAll(".text-muted")) {
        if (el.closest("#vgl-root")) continue;                 // nunca leer el propio panel
        const doc = extractDoc(limpio(el.textContent));
        if (doc) return doc;
      }
      return "";
    } catch (e) { return ""; }
  }
  // v12.5.10 — Los tres avisos grandes de paciente (PyM, abandono PES, labs RCV vencidos)
  // se calculan por separado y podian coincidir en el MISMO tick para el mismo paciente
  // (p. ej. PyM pendiente + labs vencidos a la vez): cada check creaba su propio overlay
  // de pantalla completa sin mirar si otro ya estaba abierto, y los dos quedaban
  // superpuestos e ilegibles (reportado en consultorio con pantallazo). Este guard hace
  // que, si ya hay uno de los tres en pantalla, los demas NO se marquen como vistos
  // todavia (avisoMarcarVisto se salta) — el siguiente tick (cada 2-120s, por defecto 5s)
  // los reintenta solo, y en cuanto el medico cierra el primero con "Entendido" el
  // siguiente aparece por su cuenta. Nunca se pierde un aviso, solo se ponen en fila.
  function otroAvisoDePacienteAbierto() {
    return !!(document.getElementById("vgl-pym-modal") ||
      document.getElementById("vgl-pes-modal") ||
      document.getElementById("vgl-labsv-modal"));
  }
  // Una vez por paciente por día: se apoya en el mismo registro (avisoYaVisto/Marcar)
  // que ya usan las notificaciones — nada nuevo que mantener.
  function checkRecordatorioPym() {
    try {
      if (!S.recordatorioPym) return;
      const doc = extractPacienteAbierto(); if (!doc) return;
      const key = normalizeKey(doc); if (!key) return;
      // v12.4.0 — Antes, con las órdenes del panel ya generadas, el aviso se CALLABA del
      // todo; ahora muestra SOLO lo que queda pendiente (típicamente las remisiones a
      // Optometría/Odontología, que no se ordenan desde el panel). Si no queda nada,
      // sigue sin molestar. Y si el paciente está en abandono del programa de riesgo
      // cardiovascular, el cuadro entero se repinta de rosa (mismo color del panel).
      const pend = pymPendientesRestantes(doc); if (!pend.length) return;
      const uid = "pymrem|" + key;
      if (avisoYaVisto(uid)) return;
      if (otroAvisoDePacienteAbierto()) return;
      avisoMarcarVisto(uid);
      const cita = (state.lastSnapshot && state.lastSnapshot.list || []).find((a) => normalizeKey(a.doc_id) === key);
      const esPes = S.abandonoPES !== false && state.pymAbandono && state.pymAbandono.has(key);
      pymAlert(cita ? cita.nombre : "", pend, esPes);
    } catch (e) {}
  }

  // ---- Color / alerta ----
  // Interpreta la hora venga como venga. La pantalla de Everest la escribe
  // "7:30 a. m.", pero el API la puede mandar en 24 h ("07:30", "19:05:00") o
  // como fecha completa ("2026-08-04T07:30:00"). Antes solo se aceptaba el
  // formato de la pantalla: con cualquier otro, TODAS las citas quedaban con
  // 0 minutos transcurridos y no saltaba ni un solo fraude, en silencio.
  // Devuelve minutos desde medianoche, o null si de verdad no se entiende.
  function parseHoraMin(ts) {
    const s = String(ts == null ? "" : ts).trim();
    if (!s) return null;
    const m = /(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s);
    if (!m) return null;
    let h = parseInt(m[1], 10); const mi = parseInt(m[2], 10);
    if (!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59)) return null;
    const ap = /([AaPp])\.?\s*[Mm]/.exec(s.slice(m.index + m[0].length));
    if (ap) { h = h % 12; if (/[Pp]/.test(ap[1])) h += 12; }
    return h * 60 + mi;
  }
  // Vuelve a escribirla como la muestra Everest, para que el panel se lea igual
  // venga del API o de la pantalla.
  function horaBonita(min) {
    if (typeof min !== "number" || !Number.isFinite(min) || min < 0 || min >= 1440) return "";
    const h24 = Math.floor(min / 60) % 24, mi = min % 60, h12 = (h24 % 12) === 0 ? 12 : (h24 % 12);
    return h12 + ":" + String(mi).padStart(2, "0") + (h24 < 12 ? " a. m." : " p. m.");
  }
  function elapsedMin(ts, now) {
    const min = parseHoraMin(ts);
    if (min == null) { if (!state.warnedTimes.has(ts)) { state.warnedTimes.add(ts); console.warn("[Vigilante] hora no interpretable:", ts); } return 0; }
    const apt = new Date(now); apt.setHours(0, min, 0, 0);
    return (now - apt) / 60000;
  }
  // La clave incluye la HORA además del documento. Con la cédula sola, un paciente con dos
  // citas el mismo día (sobrecupo) compartía estado: si faltaba a la primera, al llegar
  // puntual a la segunda se le acusaba de FRAUDE, y las dos filas se pisaban en cada
  // lectura disparando alertas y contadores en bucle.
  function apptKey(a) { return (a.doc_id ? a.doc_id : a.nombre + "|" + a.index) + "@" + (a.hora_texto || ""); }
  // Reinicio al cambiar de día: sin esto, una pestaña dejada abierta toda la noche seguía
  // con la lista de "sospechosos" de ayer y marcaba fraude a quien volviera hoy.
  let diaActual = "";
  function diaNuevo() {
    const d = todayStamp();
    if (!diaActual) { diaActual = d; state.sessionEpoch = Date.now(); return; }
    if (diaActual === d) return;
    diaActual = d;
    state.sessionEpoch = Date.now(); // v8.1.0: KR-02 Invalida peticiones en vuelo de ayer
    state.historical.clear(); state.notified.clear();
    try { localStorage.removeItem(SIEMBRA_KEY); } catch (e) {}   // v14.1.5 — día nuevo, siembra nueva
    state.fraudWatch.clear(); state.alertedFraud.clear(); state.warnedTimes.clear();
    state.summarized = false; state.lastSignature = ""; statsSig = ""; frCache.dia = "";
    try { evFlush(); } catch (e) {}
    setSummary("Nuevo día: se reinició el seguimiento.");
    // v7.8.1: si la pestaña quedó abierta toda la noche (turno que cruza medianoche), el
    // PyM que tiene cargado es el de AYER. Antes se seguía mostrando "al día"/"sin
    // pendiente" cruzado contra la base vieja hasta el siguiente tick del intervalo de
    // 10 min — una ventana en la que el cruce PyM podía leerse como de hoy sin serlo.
    // Ahora se dispara YA la búsqueda del PyM real de hoy (la líder; el resto espera).
    if (heartbeat() && typeof GM_xmlhttpRequest !== "undefined") loadPymDiario(true).catch(() => {});
  }
  function colorAndAlert(a, now) {
    const st = (a.estado || "").toLowerCase(); const key = apptKey(a); const elapsed = elapsedMin(a.hora_texto, now); const pym = getActivities(a.doc_id);
    const prev = state.historical.get(key) || "";
    const grace = CONFIG.TOLERANCIA_MIN || 6.0, prealert = Math.max(1.0, grace - 1.0); let color = "AZUL", sound = false, reason = "", arrival = false;
    if (st.includes("en sala")) {
      if (state.fraudWatch.has(key)) { color = "ROJO"; if (!state.alertedFraud.has(key)) { sound = true; state.alertedFraud.add(key); } }
      else { color = "VERDE"; if (!prev.includes("en sala")) arrival = true; } // Llegada a sala (cualquier transición hacia En sala) // llegada a tiempo tras estar "Sin presentarse"
    }
    else if (st.includes("atendido")) {
      // Si el paciente estaba en la lista de sospechosos (pasó la tolerancia sin
      // presentarse) y aparece ya "Atendido", eso ES una confirmación extemporánea.
      // Antes esta rama solo miraba alertedFraud, así que cuando la agenda saltaba de
      // "Sin presentarse" directo a "Atendido" —sin pasar visiblemente por "En Sala"—
      // el fraude se pintaba VERDE y no quedaba registrado en ninguna parte.
      if (state.alertedFraud.has(key)) color = "ROJO";
      else if (state.fraudWatch.has(key)) { color = "ROJO"; sound = true; state.alertedFraud.add(key); }
      else color = "VERDE";
    }
    else if (st.includes("sin presentarse")) { if (elapsed >= grace) { color = "AMBAR"; state.fraudWatch.add(key); } else if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else color = "AZUL"; }
    else { if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else if (pym.length >= 3) { color = "MORADO"; reason = "pym"; } else color = "AZUL"; }
    const stamp = new Date().toLocaleTimeString(), mins = Math.round(elapsed * 10) / 10;
    if (!state.leader) { state.historical.set(key, st); return { ...a, key, color, reason, arrival, sound: false, elapsed: Math.round(elapsed * 10) / 10, pym }; }
    if (sound) { logEvent({ t: stamp, ev: "FRAUDE_EXTEMPORANEO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, min: mins, nombre: a.nombre }); reportarFraude(a.hora_texto, mins); }
    else if (st !== prev && prev !== "") logEvent({ t: stamp, ev: "CAMBIO_ESTADO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, previo: prev, min: mins, nombre: a.nombre });
    state.historical.set(key, st);
    return { ...a, key, color, reason, arrival, sound, elapsed: Math.round(elapsed * 10) / 10, pym };
  }

  let audioCtx = null;
  function beep(freq, ms, off) { try { if (!S.sonido || muted()) return; audioCtx = audioCtx || new (PAGEWIN.AudioContext || PAGEWIN.webkitAudioContext || window.AudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value = freq; o.type = "square"; const t0 = audioCtx.currentTime + off; g.gain.setValueAtTime(clampNum(S.volumen, 0.02, 0.6, 0.15), t0); o.start(t0); o.stop(t0 + ms / 1000); } catch (e) {} }
  // Silencio temporal ("Silenciar 15 min"): calla sonido/ventana/cartel, pero NUNCA deja
  // de registrar el evento ni de mostrarlo en el panel.
  function muted() { return Date.now() < state.muteUntil; }
  function muteFor(min) { state.muteUntil = Date.now() + min * 60000; stopNag(); paintMute(); setSummary("Silenciado " + min + " min. El registro sigue activo."); }
  function unmute() { state.muteUntil = 0; paintMute(); setSummary("Sonido reactivado."); }

  // =====================================================================
  //  CANALES DE AVISO QUE **NO** DEPENDEN DE WINDOWS
  //  (para equipos donde la política de la empresa bloquea las
  //   notificaciones del sistema). Todos se apagan al "reconocer".
  // =====================================================================
  const TONE = { ROJO: [1000, 1240], MORADO: [900, 680], AMBAR: [760, 620], VERDE: [680, 1020], AZUL: [620, 820], PES: [520, 780] };
  function playTone(color) { const t = TONE[color] || TONE.AZUL; beep(t[0], 380, 0); beep(t[1], 380, 0.42); }

  // (1) SONIDO INSISTENTE: el audio suena aunque el navegador esté minimizado o
  //     estés en Word. Se repite hasta que reconozcas la alerta.
  let nagTimer = null, nagLeft = 0, nagColor = "ROJO";
  function startNag(color) { stopNag(); if (!S.insistir) { playTone(color); return; } nagColor = color; nagLeft = 40; playTone(color); nagTimer = setInterval(() => { if (nagLeft-- <= 0) { stopNag(); return; } playTone(nagColor); }, 9000); }
  function stopNag() { if (nagTimer) clearInterval(nagTimer); nagTimer = null; }

  // (2) PESTAÑA QUE PARPADEA: título + favicon. Visible en la barra de pestañas
  //     aunque estés en otra pestaña del navegador.
  let flashTimer = null, origTitle = null, origIcon = null, flashOn = false;
  function faviconUrl(color) {
    const c = COLORS[color] || COLORS.AZUL;
    return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="${c}"/></svg>`);
  }
  function setFavicon(href) {
    try {
      let l = document.querySelector("link[rel~='icon'][data-vgl]");
      if (!l) { l = document.createElement("link"); l.rel = "icon"; l.setAttribute("data-vgl", "1"); document.head.appendChild(l); }
      if (href) l.href = href; else l.remove();
    } catch (e) {}
  }
  function startFlash(text, color) {
    stopFlash();
    if (!S.parpadeo) return;
    if (origTitle === null) origTitle = document.title;
    try { const cur = document.querySelector("link[rel~='icon']:not([data-vgl])"); origIcon = cur ? cur.href : null; } catch (e) {}
    flashTimer = setInterval(() => {
      flashOn = !flashOn;
      try { document.title = flashOn ? text : (origTitle || "Everest"); } catch (e) {}
      setFavicon(flashOn ? faviconUrl(color) : (origIcon || faviconUrl("AZUL")));
    }, 900);
  }
  function stopFlash() {
    if (flashTimer) clearInterval(flashTimer); flashTimer = null;
    try { if (origTitle !== null) document.title = origTitle; } catch (e) {}
    setFavicon(null);
  }

  // (3) VENTANA EMERGENTE REAL: es una ventana del navegador, así que aparece en la
  //     BARRA DE TAREAS de Windows y parpadea — se nota aunque estés en otra app.
  //     Requiere permitir ventanas emergentes para el sitio (permiso del sitio, no del SO).
  let popupWarned = false;
  function popupAlert(color, title, body) {
    if (!S.popup || muted()) return;
    try {
      const w = window.open("", "vglAlerta", "width=470,height=290,menubar=no,toolbar=no,location=no,status=no");
      if (!w) {
        if (!popupWarned) { popupWarned = true; setSummary("Para la ventana emergente: permite «Ventanas emergentes» en el candado de la barra de direcciones.", "warn"); }
        return;
      }
      const c = COLORS[color] || COLORS.AZUL;
      w.document.open();
      w.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
        <style>
          body{margin:0;font-family:-apple-system,'Segoe UI',sans-serif;background:#0B1220;color:#f5f5f7;display:flex;align-items:center;justify-content:center;height:100vh}
          .vgl-pop-card{padding:24px;text-align:center;max-width:420px}
          .vgl-pop-dot{width:16px;height:16px;border-radius:50%;margin:0 auto 14px}
          .vgl-pop-t{font-size:17px;font-weight:700;margin-bottom:8px}
          .vgl-pop-b{font-size:14px;opacity:.85;white-space:pre-line;line-height:1.45}
          .vgl-pop-ok{margin-top:18px;color:#001;border:0;border-radius:9px;padding:9px 20px;font-size:14px;font-weight:700;cursor:pointer}
        </style>
        <body>
        <div class="vgl-pop-card">
          <div class="vgl-pop-dot" style="background:${c};box-shadow:0 0 16px ${c}"></div>
          <div class="vgl-pop-t">${escapeHtml(title)}</div>
          <div class="vgl-pop-b">${escapeHtml(body)}</div>
          <button class="vgl-pop-ok" onclick="window.close()" style="background:${c}">Entendido</button>
        </div></body>`);
      w.document.close();
      try { w.focus(); } catch (e) {}
    } catch (e) {}
  }

  // Universal Modal Accessibility Manager (R6.4)
  function _activarAccesibilidadModal(modalEl, closeCallback) {
    if (!modalEl || typeof modalEl.addEventListener !== "function") return () => {};
    const previoFoco = typeof document !== "undefined" ? document.activeElement : null;
    try {
      if (typeof modalEl.getAttribute === "function" && typeof modalEl.setAttribute === "function") {
        if (!modalEl.getAttribute("role")) modalEl.setAttribute("role", "dialog");
        if (!modalEl.getAttribute("aria-modal")) modalEl.setAttribute("aria-modal", "true");
      }
    } catch (e) {}

    const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function getFocusableElements() {
      if (typeof modalEl.querySelectorAll !== "function") return [];
      return Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTOR) || []).filter(
        (el) => !el.getAttribute || el.getAttribute("aria-hidden") !== "true"
      );
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (typeof e.preventDefault === "function") e.preventDefault();
        cleanup();
        if (typeof closeCallback === "function") closeCallback();
        return;
      }
      if (e.key === "Tab") {
        const focusables = getFocusableElements();
        if (!focusables.length) {
          if (typeof e.preventDefault === "function") e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || (modalEl.contains && !modalEl.contains(document.activeElement))) {
            if (typeof e.preventDefault === "function") e.preventDefault();
            if (last && typeof last.focus === "function") last.focus();
          }
        } else {
          if (document.activeElement === last || (modalEl.contains && !modalEl.contains(document.activeElement))) {
            if (typeof e.preventDefault === "function") e.preventDefault();
            if (first && typeof first.focus === "function") first.focus();
          }
        }
      }
    }

    modalEl.addEventListener("keydown", onKeyDown);

    setTimeout(() => {
      try {
        const focusables = getFocusableElements();
        if (focusables.length > 0 && typeof focusables[0].focus === "function") focusables[0].focus();
        else if (typeof modalEl.focus === "function") modalEl.focus();
      } catch (e) {}
    }, 0);

    function cleanup() {
      try {
        if (typeof modalEl.removeEventListener === "function") {
          modalEl.removeEventListener("keydown", onKeyDown);
        }
        if (previoFoco && typeof previoFoco.focus === "function") {
          previoFoco.focus();
        }
      } catch (e) {}
    }

    return cleanup;
  }

  // (4) CARTEL GRANDE dentro de Everest para el FRAUDE: imposible de ignorar
  //     cuando el navegador está a la vista.
  // [COPY-UX] Cartel modal de confirmación fuera de secuencia
  function bigAlert(color, title, body) {
    if (!S.cartel) return;
    try {
      let ov = document.getElementById("vgl-modal");
      if (ov) ov.remove();
      const c = COLORS[color] || COLORS.AZUL;
      ov = document.createElement("div"); ov.id = "vgl-modal";
      ov.setAttribute("role", "alertdialog");
      ov.setAttribute("aria-modal", "true");
      if (isLight()) ov.classList.add("light");
      ov.innerHTML = `<div class="vgl-modal-card" style="--ac:var(--c-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},${c});--ac-rgb:var(--rgb-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},124,184,255)">
          <div class="vgl-modal-dot"></div>
          <div class="vgl-modal-t">${escapeHtml(title)}</div><div class="vgl-modal-b">${escapeHtml(body)}</div>
          <button class="vgl-modal-ok">Entendido</button>
        </div>`;
      const tEl = ov.querySelector ? ov.querySelector(".vgl-modal-t") : null;
      if (tEl) tEl.textContent = title;
      const bEl = ov.querySelector ? ov.querySelector(".vgl-modal-b") : null;
      if (bEl) bEl.textContent = body;
      const ok = ov.querySelector ? ov.querySelector(".vgl-modal-ok") : null;
      const closeMod = () => { ov.remove(); acknowledge(); };
      if (ok && typeof ok.addEventListener === "function") ok.addEventListener("click", closeMod);
      _activarAccesibilidadModal(ov, closeMod);
      document.body.appendChild(ov);
    } catch (e) {}
  }

  // Reconocer: apaga sonido insistente, parpadeo y cartel.
  function acknowledge() { stopNag(); stopFlash(); const m = document.getElementById("vgl-modal"); if (m) m.remove(); }

  // [COPY-UX] Recordatorio modal de actividades de prevención
  function pymAlert(nombre, actividades, esPes, esPrueba) {
    try {
      let ov = document.getElementById("vgl-pym-modal");
      if (ov) ov.remove();
      ov = document.createElement("div"); ov.id = "vgl-pym-modal";
      ov.setAttribute("role", "dialog");
      ov.setAttribute("aria-modal", "true");
      if (isLight()) ov.classList.add("light");
      if (esPes) {
        ov.classList.add("pes");
        ov.style.setProperty("--rgb-recordatorio", "var(--rgb-pes)");
        ov.style.setProperty("--c-recordatorio", "var(--c-pes)");
      }
      const chips = (actividades || []).map((a) => `<span class="vgl-pym-chip">${escapeHtml(a)}</span>`).join("");
      ov.innerHTML = `<div class="vgl-pym-card">
          <div class="vgl-pym-ic">🩺</div>
          <div class="vgl-pym-t">Actividades preventivas pendientes</div>
          <div class="vgl-pym-n">${escapeHtml(nombre || "Paciente")}</div>
          <div class="vgl-pym-lead">Se sugiere revisar y solicitar las siguientes actividades de prevención:</div>
          <div class="vgl-pym-list">${chips}</div>
          <div class="vgl-pym-foot">Este aviso no volverá a mostrarse durante la jornada para este paciente.</div>
          <button class="vgl-pym-ok">Entendido</button>
        </div>`;
      const nEl = ov.querySelector ? ov.querySelector(".vgl-pym-n") : null;
      if (nEl) nEl.textContent = nombre || "Paciente";
      const ok = ov.querySelector ? ov.querySelector(".vgl-pym-ok") : null;
      const closeMod = () => { if (!esPrueba) uxTrack("aviso.pym.entendido"); ov.remove(); };
      if (ok && typeof ok.addEventListener === "function") ok.addEventListener("click", closeMod);
      if (!esPrueba) uxTrack(esPes ? "aviso.pym.mostrado.pes" : "aviso.pym.mostrado", { n: (actividades || []).length });
      _activarAccesibilidadModal(ov, closeMod);
      document.body.appendChild(ov);
    } catch (e) {}
  }

  // [COPY-UX] Alerta modal de prioridad cardiovascular
  function abandonoPESAlert(nombre, esPrueba) {
    try {
      let ov = document.getElementById("vgl-pes-modal");
      if (ov) ov.remove();
      ov = document.createElement("div"); ov.id = "vgl-pes-modal";
      ov.setAttribute("role", "alertdialog");
      ov.setAttribute("aria-modal", "true");
      if (isLight()) ov.classList.add("light");
      ov.innerHTML = `<div class="vgl-pes-card">
          <div class="vgl-pes-ic">🫀</div>
          <div class="vgl-pes-t">Abandono Programa RCV</div>
          <div class="vgl-pes-n">${escapeHtml(nombre || "Paciente")}</div>
          <div class="vgl-pes-lead">Este paciente tiene un <b>abandono registrado</b> en el Programa de Riesgo Cardiovascular. <b>Priorice el control de riesgo cardiovascular sobre cualquier otra actividad de esta consulta.</b></div>
          <div class="vgl-pes-foot">Este recordatorio no volverá a mostrarse durante la jornada para este paciente.</div>
          <button class="vgl-pes-ok">Entendido</button>
        </div>`;
      const nEl = ov.querySelector ? ov.querySelector(".vgl-pes-n") : null;
      if (nEl) nEl.textContent = nombre || "Paciente";
      const ok = ov.querySelector ? ov.querySelector(".vgl-pes-ok") : null;
      const closeMod = () => { if (!esPrueba) uxTrack("aviso.pes.entendido"); ov.remove(); };
      if (ok && typeof ok.addEventListener === "function") ok.addEventListener("click", closeMod);
      if (!esPrueba) uxTrack("aviso.pes.mostrado");
      _activarAccesibilidadModal(ov, closeMod);
      document.body.appendChild(ov);
      playTone("PES");
    } catch (e) {}
  }
  // Una vez por paciente por día, con el mismo registro de "vistos" que ya usan los
  // demás avisos — nada nuevo que mantener. Independiente del recordatorio de PyM: un
  // paciente puede tener ambas cosas (o solo una) y ambos avisos salen por separado.
  function checkAbandonoPES() {
    try {
      if (!S.abandonoPES) return;
      const doc = extractPacienteAbierto(); if (!doc) return;
      const key = normalizeKey(doc); if (!key) return;
      if (!state.pymAbandono || !state.pymAbandono.has(key)) return;
      const uid = "pes|" + key;
      if (avisoYaVisto(uid)) return;
      if (otroAvisoDePacienteAbierto()) return;
      avisoMarcarVisto(uid);
      const cita = (state.lastSnapshot && state.lastSnapshot.list || []).find((a) => normalizeKey(a.doc_id) === key);
      abandonoPESAlert(cita ? cita.nombre : "");
    } catch (e) {}
  }

  // [COPY-UX] Alerta modal de laboratorios RCV sin resultado vigente (v12.5.7)
  function labsVencidosAlert(nombre, faltantes, esPrueba) {
    try {
      let ov = document.getElementById("vgl-labsv-modal");
      if (ov) ov.remove();
      ov = document.createElement("div"); ov.id = "vgl-labsv-modal";
      ov.setAttribute("role", "alertdialog");
      ov.setAttribute("aria-modal", "true");
      if (isLight()) ov.classList.add("light");
      const chips = (faltantes || []).map((f) => `<span class="vgl-labsv-chip">${escapeHtml(f.nombre)}</span>`).join("");
      ov.innerHTML = `<div class="vgl-labsv-card">
          <div class="vgl-labsv-ic">🧪</div>
          <div class="vgl-labsv-t">Laboratorios RCV sin resultado vigente</div>
          <div class="vgl-labsv-n">${escapeHtml(nombre || "Paciente")}</div>
          <div class="vgl-labsv-lead">Este paciente no tiene resultado en los <b>últimos 180 días</b> para:</div>
          <div class="vgl-labsv-list">${chips}</div>
          <div class="vgl-labsv-foot">Este aviso no volverá a mostrarse durante la jornada para este paciente.</div>
          <button class="vgl-labsv-ok">Entendido</button>
        </div>`;
      const nEl = ov.querySelector ? ov.querySelector(".vgl-labsv-n") : null;
      if (nEl) nEl.textContent = nombre || "Paciente";
      const ok = ov.querySelector ? ov.querySelector(".vgl-labsv-ok") : null;
      const closeMod = () => { if (!esPrueba) uxTrack("aviso.labsv.entendido"); ov.remove(); };
      if (ok && typeof ok.addEventListener === "function") ok.addEventListener("click", closeMod);
      if (!esPrueba) uxTrack("aviso.labsv.mostrado", { n: (faltantes || []).length });
      _activarAccesibilidadModal(ov, closeMod);
      document.body.appendChild(ov);
      playTone("ROJO");
    } catch (e) {}
  }
  // Una vez por paciente por día, mismo registro de "vistos" que el resto de avisos.
  // Independiente de PyM/PES: un paciente puede tener cualquier combinación de los tres,
  // y cada uno sale por separado. Lee SOLO lo que el robot de Athenea ya pre-cargó
  // (_labsPrefetch) — nunca dispara una consulta propia ni bloquea el tick esperando una;
  // si la pre-carga de este paciente aún no llegó, simplemente no hay nada que revisar
  // todavía y el siguiente tick lo reintenta solo.
  function checkLabsVencidos() {
    try {
      if (!S.labsVencidos) return;
      const doc = extractPacienteAbierto(); if (!doc) return;
      if (!_labsPrefetch.labs || _labsPrefetch.docId !== doc) return;
      const faltantes = _analitosRcvVencidos(_labsPrefetch.labs, todayStamp());
      if (!faltantes.length) return;
      const key = normalizeKey(doc); if (!key) return;
      const uid = "labsv|" + key;
      if (avisoYaVisto(uid)) return;
      if (otroAvisoDePacienteAbierto()) return;
      avisoMarcarVisto(uid);
      const cita = (state.lastSnapshot && state.lastSnapshot.list || []).find((a) => normalizeKey(a.doc_id) === key);
      labsVencidosAlert(cita ? cita.nombre : "", faltantes);
    } catch (e) {}
  }

  // ---- NOTIFICACIONES POR COLORES (recuperado de la v2.5): toast en Windows + respaldo en la página ----
  function colorDot(color) {
    const c = COLORS[color] || COLORS.AZUL;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="${c}"/></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  // Anti-duplicado entre pestañas: si otra pestaña de Everest ya lanzó este aviso hace <12s, no repetir.
  function crossTabDup(id) { try { const k = "vgl_n_" + id, now = Date.now(), prev = +(localStorage.getItem(k) || 0); if (now - prev < 12000) return true; localStorage.setItem(k, String(now)); return false; } catch (e) { return false; } }
  // REGISTRO PERSISTENTE POR IDENTIFICADOR (v7.3.5): cada aviso lleva un id y queda
  // anotado en el navegador. Un aviso ya mostrado NO se repite: ni al recargar la
  // página, ni al cambiar de pestaña, ni al reabrir Everest. Se limpia solo cada día.
  const SEEN_KEY = "vgl_vistos";
  function avisoYaVisto(uid) {
    if (!uid) return false;
    try {
      const o = readJSON(SEEN_KEY, {}) || {};
      if (o._dia !== todayStamp()) return false;        // registro de otro día: no aplica
      return !!o[uid];
    } catch (e) { return false; }
  }
  function avisoMarcarVisto(uid) {
    if (!uid) return;
    try {
      let o = readJSON(SEEN_KEY, {}) || {};
      if (o._dia !== todayStamp()) o = { _dia: todayStamp() };   // día nuevo: registro nuevo
      o[uid] = Date.now();
      writeJSON(SEEN_KEY, o);
    } catch (e) {}
  }
  function osNotify(color, title, body, persist, uid) {
    if (avisoYaVisto(uid)) return;                       // ya se mostró hoy: NUNCA repetir
    if (typeof Notification === "undefined" || Notification.permission !== "granted") { avisoMarcarVisto(uid); showToast(color, title, body, persist); return; }
    if (crossTabDup("os|" + (uid || title))) return;
    avisoMarcarVisto(uid);
    let done = false; const fb = () => { if (done) return; done = true; showToast(color, title, body, persist); };
    try {
      // requireInteraction SOLO para el fraude (persist): lo demás se cierra solo. Las
      // notificaciones persistentes que nadie cierra quedan vivas en el Centro de
      // actividades de Windows y REAPARECEN horas después — el famoso aviso fantasma.
      const n = new Notification(title, { body, icon: colorDot(color), badge: colorDot(color), requireInteraction: !!persist, tag: "vgl-" + (uid || title) });
      try { n.onshow = () => { done = true; }; n.onerror = fb; n.onclick = () => { try { window.focus(); } catch (e2) {} try { n.close(); } catch (e2) {} }; } catch (e) {}
      // Cierre automático: 20 s los avisos normales, 3 min el fraude (el sonido insistente
      // sigue por su lado hasta reconocer). Así nada queda pegado en el Centro de actividades.
      setTimeout(() => { try { n.close(); } catch (e2) {} }, persist ? 180000 : 20000);
      // Si Windows suprime el aviso (No molestar / política), 'show' no se dispara:
      // a los 1.6 s se ESCALA al aviso dentro del navegador. Un canal a la vez.
      setTimeout(fb, 1600);
    } catch (e) { fb(); }
  }
  // v7.5: cola de avisos con PRIORIDAD real. Antes se apilaban por orden de llegada,
  // máx. 4 visibles, ninguno se cerraba solo — un aviso MORADO ("última llamada", ~1 min
  // de margen) podía quedar tapado detrás de avisos rutinarios viejos sin cerrar. Ahora:
  // ROJO/MORADO van al FRENTE y nunca se autodescartan; AZUL/VERDE/AMBAR van al final y
  // se cierran solos a los 9 s. Al recortar por exceso, se quita primero el más viejo
  // que NO sea crítico (un crítico solo se quita si ya no hay ningún otro que sacar).
  // v8.1.0: SP-02 Cola de notificaciones (Toast Queue) para evitar colapso del Main Thread
  let toastQueue = [];
  let toastFlushTimer = null;

  function _renderToast(color, title, body, persist) {
    try {
      const wrap = document.getElementById("vgl-toasts"); if (!wrap) return;
      const col = COLORS[color] || COLORS.AZUL, tint = TINT[color] || TINT.AZUL;
      const icon = { ROJO: "⛔", MORADO: "⏳", AMBAR: "⚠", VERDE: "✅", AZUL: "🛡️" }[color] || "🛡️";
      const t = document.createElement("div"); t.className = "vgl-toast";
      // [v12.3.13] El CSS estático del toast vive al final de la hoja maestra de buildOverlay()
      // (antes CADA toast traía su propia copia y el motor la re-parseaba por aviso). El único
      // valor dinámico —el color del estado— entra como custom property inline (--tk) y como
      // var(--c-*) directo en cada pieza; las reglas de la hoja maestra lo consumen con var(),
      // de modo que el estilo computado es idéntico al de antes.
      t.innerHTML = `<i class="vgl-toast-rail" style="--tk:var(--rgb-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},124,184,255);background:var(--c-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},${col})"></i><div class="vgl-toast-ic" style="--tk:var(--rgb-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},124,184,255);color:var(--c-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},${col})"></div><div class="vgl-toast-main"><div class="vgl-toast-title" style="--tk:var(--rgb-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},124,184,255);color:var(--c-${String(color || "AZUL").replace(/[^a-zA-Z]/g, "").toLowerCase()},${col})"></div><div class="vgl-toast-b"></div></div><span class="vgl-toast-x">×</span>`;
      t.querySelector(".vgl-toast-ic").textContent = icon;
      t.querySelector(".vgl-toast-title").textContent = title;
      t.querySelector(".vgl-toast-b").textContent = body;
      const cerrar = () => { t.classList.add("out"); setTimeout(() => { try { t.remove(); } catch (e2) {} }, 260); };
      t.addEventListener("click", cerrar);
      const critico = color === "ROJO" || color === "MORADO";
      t.__vglCritico = critico;
      if (critico) wrap.prepend(t); else { wrap.appendChild(t); setTimeout(cerrar, 9000); }
      const vivos = () => [...wrap.children].filter((n) => !n.classList.contains("out"));
      while (vivos().length > 4) {
        const lista = vivos();
        const quitar = [...lista].reverse().find((n) => !n.__vglCritico) || lista[lista.length - 1];
        if (!quitar) break;
        quitar.remove();
      }
    } catch (e) {}
  }

  function showToast(color, title, body, persist) {
    toastQueue.push({ color, title, body, persist });
    if (!toastFlushTimer) {
      toastFlushTimer = setTimeout(() => {
        toastFlushTimer = null;
        if (toastQueue.length > 3) {
          const criticos = toastQueue.filter(t => t.color === "ROJO" || t.color === "MORADO").length;
          _renderToast("AMBAR", `Alerta Múltiple (${toastQueue.length})`, `${criticos} alertas críticas y ${toastQueue.length - criticos} rutinarias recibidas.`, true);
        } else {
          toastQueue.forEach(t => _renderToast(t.color, t.title, t.body, t.persist));
        }
        toastQueue = [];
      }, 500);
    }
  }
  // Solo Windows. El toast dentro de la página queda como RESPALDO únicamente si Windows
  // no está disponible (permiso no concedido/denegado), para no perder un aviso de fraude.
  function notify(color, title, body, persist, uid) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") { osNotify(color, title, body, persist, uid); }
    else { showToast(color, title, body, persist); }
  }
  // persist SOLO en el fraude: es el único aviso que debe exigir interacción. El resto
  // se cierra solo (los persistentes sin cerrar quedan en el Centro de actividades de
  // Windows y REAPARECEN horas después como fantasmas).
  // [COPY-UX] Mensajes de notificación clínica
  // v12.4.0 — Rescate de la semántica de puntualidad (elegida por el médico 2026-08-11):
  // VERDE = llegó/confirmó a tiempo (solo la transición EN VIVO, ver maybeNotify);
  // MORADO = queda ~1 minuto de los 6 de gracia sin confirmar; AMBAR = vencieron los 6
  // minutos sin confirmar; ROJO = confirmación extemporánea (después de la gracia).
  // Lenguaje preciso pero clínico-neutro: sin la palabra "FRAUDE" en pantalla.
  const NOTIFY = {
    ROJO: { icon: "⛔", label: "Confirmación extemporánea: ingreso después del tiempo de gracia", sound: true, persist: true },
    MORADO: { icon: "⏳", label: "Última llamada: ~1 minuto para confirmar la llegada", persist: false },
    AMBAR: { icon: "⚠", label: "Inasistencia: venció el tiempo de gracia sin confirmar", persist: false },
    VERDE: { icon: "✅", label: "Paciente confirmó a tiempo (En Sala)", persist: false },
  };
  // Clave de notificación: el MORADO se distingue por motivo (tiempo vs 3+ PyM) para no confundirlos.
  function nkey(a) { return a.color === "MORADO" ? "MORADO:" + (a.reason || "") : a.color; }
  // =====================================================================
  //  COLA DE AVISOS PENDIENTES (v12.5.14)
  //  Reportado en consultorio: el aviso audible/visual (Windows/toast/sonido/cartel)
  //  llegaba también con la pestaña líder abierta en .../viva/Acceso/ — un módulo de
  //  Everest sin nada que ver con la agenda del día. Pero SIEMPRE debe dispararse, no
  //  perderse: solo debe vivir dentro del módulo clínico HCHealth. Si ninguna pestaña
  //  está ahí en el instante de la transición, el aviso queda en cola (localStorage:
  //  cruza pestañas y sobrevive a que la pestaña líder se cierre) y se dispara —UNA
  //  sola vez— en cuanto CUALQUIER pestaña (líder o no) note que está en HCHealth.
  //  crossTabDup() en _dispararAvisoReal es la misma guardia ya usada para el
  //  "doble-líder transitorio": si dos pestañas en HCHealth notan la cola casi al
  //  mismo tiempo, solo la primera dispara el paquete completo (sonido, cartel,
  //  ventana emergente) — así NO se repite el aviso en todas las pestañas abiertas,
  //  el problema original que llevó al diseño de un solo líder.
  // =====================================================================
  const AVISOS_PENDIENTES_KEY = "vgl_avisos_pendientes";
  function _encolarAvisoPendiente(p) {
    try {
      const cola = readJSON(AVISOS_PENDIENTES_KEY, []) || [];
      if (cola.some((x) => x && x.uid === p.uid)) return;    // ya en cola: no duplicar
      cola.push(p);
      writeJSON(AVISOS_PENDIENTES_KEY, cola.slice(-50));      // tope defensivo
    } catch (e) {}
  }
  // v14.1.5 — La cola ya solo guarda CARTELES: el tono y la notificación del sistema
  // salieron en su momento, cuando el hecho ocurrió. Aquí queda una segunda cautela:
  // un cartel de hace media hora NO puede salir como si el paciente acabara de llegar.
  // Pasados 10 minutos se descarta — el aviso ya se dio, y repetirlo tarde solo consigue
  // que el médico atienda una llegada que ya pasó.
  const AVISO_CARTEL_CADUCA_MS = 600000;
  function _flushAvisosPendientes() {
    if (!_enModuloHCHealth()) return;
    let cola;
    try { cola = readJSON(AVISOS_PENDIENTES_KEY, []) || []; } catch (e) { return; }
    if (!cola.length) return;
    try { writeJSON(AVISOS_PENDIENTES_KEY, []); } catch (e) {}
    const ahora = Date.now();
    let caducados = 0;
    cola.forEach((p) => {
      if (!p) return;
      if (p.ts && (ahora - p.ts) > AVISO_CARTEL_CADUCA_MS) { caducados++; return; }
      _dispararAvisoCartel(p);
    });
    if (caducados) console.log("[Vigilante] " + caducados + " cartel(es) en cola ya no se muestran: el aviso sonó en su momento y han pasado más de 10 minutos.");
  }
  // v14.1.5 — TERCERA CAUSA DE LOS AVISOS TARDÍOS, y la más torcida de las tres.
  //
  // Hasta aquí, un aviso generado con el médico FUERA de /viva/HCHealth no sonaba: se
  // guardaba en una cola y esperaba a que entrara a una historia clínica. Entonces salían
  // todos de golpe, minutos u horas después del hecho. Eso es literalmente lo que
  // reportaron: "es como si estuvieran asincrónicas".
  //
  // Pero mírese lo que se estaba conteniendo: el TONO y la NOTIFICACIÓN DEL SISTEMA
  // OPERATIVO, que existen precisamente para avisar cuando el médico NO está mirando esta
  // pantalla. Condicionarlos a "que esté mirando esta pantalla" es justo al revés.
  //
  // Así que el aviso se parte en dos, según de qué dependa de verdad:
  //   · LO QUE ALCANZA AL MÉDICO ESTÉ DONDE ESTÉ (tono, notificación del sistema, parpadeo
  //     del título y del favicon): sale SIEMPRE, en el acto, sin mirar el módulo.
  //   · EL CARTEL DENTRO DE LA PÁGINA (bigAlert/popupAlert): ese sí es de la vista, y es lo
  //     único que tiene sentido encolar hasta que haya una pestaña donde pintarlo.
  // Lo que alcanza al médico esté donde esté. No mira el módulo: no depende de la vista.
  function _dispararAvisoAudible(p) {
    if (crossTabDup("full|" + p.uid)) return false;   // varias pestañas a la vez: solo la primera
    notify(p.color, p.title, p.body, p.persist, p.uid);
    if (p.color === "ROJO") startNag("ROJO");
    else playTone(p.color);
    startFlash(p.flashText, p.color);
    return true;
  }
  // El cartel dentro de la página. Este sí es de la vista, y es lo único que se encola.
  function _dispararAvisoCartel(p) {
    if (p.color === "ROJO") bigAlert("ROJO", p.title, p.body);
    popupAlert(p.color, p.title, p.body);
  }
  function _dispararAvisoReal(p) {
    if (!_dispararAvisoAudible(p)) return;   // otra pestaña se adelantó: tampoco el cartel
    _dispararAvisoCartel(p);
  }
  // v14.1.5 — SIEMBRA COMPARTIDA ENTRE PESTAÑAS. Guarda "qué se dio ya por visto hoy"
  // fuera de la memoria de una sola pestaña, para que un relevo de liderazgo no vuelva
  // a sembrar de cero y se trague el primer aviso de cada paciente (ver el bloque de
  // `!state.summarized` en tick). Se rehace sola cada día: si el sello no es el de hoy,
  // se ignora entera y la siembra vuelve a ser legítima.
  const SIEMBRA_KEY = "vgl_siembra_dia";
  function _siembraCompartidaLeer() {
    try {
      const g = readJSON(SIEMBRA_KEY, null);
      if (!g || g.dia !== todayStamp() || !g.mapa) return null;
      const m = new Map(Object.entries(g.mapa));
      return m.size ? m : null;
    } catch (e) { return null; }
  }
  function _siembraCompartidaGuardar(mapa) {
    try {
      const obj = {};
      for (const [k, v] of mapa) obj[k] = v;
      writeJSON(SIEMBRA_KEY, { dia: todayStamp(), mapa: obj });
    } catch (e) {}
  }

  // v14.1.5 — La decisión de "sembrar de cero o heredar" vive aquí, fuera de `tick`, por
  // una razón concreta: dentro de tick era código que ninguna prueba podía alcanzar. Una
  // mutación que anulaba la herencia (`sembradoPrevio = null`) SOBREVIVIÓ al banco entero
  // — es decir, el arreglo del aviso que no llega no estaba respaldado por nada. Sacarla
  // a una función propia es lo que la hace comprobable.
  function _sembrarEstadoInicial(processed) {
    const sembradoPrevio = _siembraCompartidaLeer();
    if (sembradoPrevio) {
      // Otra pestaña ya sembró hoy: se HEREDA lo que ella dio por visto, en vez de volver
      // a dar por vistos a todos. Lo que haya cambiado desde entonces sí avisa.
      for (const [k, v] of sembradoPrevio) state.notified.set(k, v);
      return "heredada";
    }
    (processed || []).forEach((a) => state.notified.set(a.key, nkey(a)));
    _siembraCompartidaGuardar(state.notified);
    return "nueva";
  }

  function maybeNotify(a) {
    const k = nkey(a); const prev = state.notified.get(a.key); if (prev === k) return; state.notified.set(a.key, k);
    // La siembra compartida se mantiene al día con cada aviso: si se quedara en la foto
    // de la mañana, un relevo a media jornada heredaría un mapa viejo y volvería a
    // tragarse en silencio todo lo avisado desde entonces — el mismo fallo, más tarde.
    _siembraCompartidaGuardar(state.notified);
    if (a.color === "MORADO" && a.reason !== "tiempo") return;
    // v12.4.0 — Rescate de las DOS guardias originales (v8.2.0/bea69e6), perdidas en la
    // refactorización v11.0 y consolidada la pérdida en la unificación v12.0.0:
    //  (1) SIEMBRA SILENCIOSA: la primera pasada tras arrancar solo registra el estado
    //      que ya existía — un paciente que YA estaba "En Sala" al abrir el panel no
    //      dispara el aviso verde (no fue una llegada que el vigilante haya visto).
    //  (2) El VERDE exige LLEGADA EN VIVO: solo la transición hacia "En Sala" observada
    //      en directo (a.arrival, que colorAndAlert calculaba desde entonces sin que
    //      nadie la leyera) genera "confirmó a tiempo". Decidido por el médico el
    //      2026-08-11 frente a la alternativa "primer verde visto" (VERDE_NOTIFIED).
    if (prev === undefined) return;
    if (a.color === "VERDE" && !a.arrival) return;

    const cfg = NOTIFY[a.color]; if (!cfg) return;
    // bumpStat/logEvent quedan SIEMPRE, con la hora REAL de la transición (auditoría de
    // puntualidad/fraude) — no dependen de en qué módulo esté el médico en este instante.
    bumpStat(a.color === "ROJO" ? "fraude" : a.color === "AMBAR" ? "inasistencia" : a.color === "VERDE" ? "atiempo" : "ultima");
    if (a.color !== "ROJO") logEvent({ t: new Date().toLocaleTimeString(), ev: a.color === "AMBAR" ? "INASISTENCIA" : a.color === "VERDE" ? "INGRESO_A_TIEMPO" : "ULTIMA_LLAMADA", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, min: a.elapsed, nombre: a.nombre });
    const title = `${cfg.icon} ${a.hora_texto} · ${a.estado}`;
    const body = `${a.nombre}${a.doc_id ? " (" + a.doc_id + ")" : ""}\n${cfg.label}`;
    const payload = { color: a.color, title, body, persist: !!cfg.persist, uid: a.key + "|" + a.color, flashText: `${cfg.icon} ${a.estado} · ${a.hora_texto}`, ts: Date.now() };
    // v14.1.5 — El aviso SIEMPRE suena y sale al sistema operativo, aquí y ahora, esté el
    // médico en el módulo que esté. Lo único que puede quedar esperando es el cartel de
    // dentro de la página, porque ese necesita una pestaña donde pintarse.
    if (_enModuloHCHealth()) _dispararAvisoReal(payload);
    else if (_dispararAvisoAudible(payload)) _encolarAvisoPendiente(payload);
  }
  function updateBell() {
    const b = document.getElementById("vgl-bell"); if (!b) return;
    const perm = (typeof Notification !== "undefined") ? Notification.permission : "unsupported";
    b.classList.toggle("on", perm === "granted");
    b.classList.toggle("off", perm === "denied");
    b.textContent = perm === "granted" ? "Alertas ✓" : perm === "denied" ? "Alertas ✕" : "Alertas";
    b.title = perm === "granted" ? "Notificaciones de Windows activas" : perm === "denied" ? "BLOQUEADAS: candado de la barra de direcciones → Notificaciones → Permitir" : "Activar notificaciones de Windows";
  }
  // Prueba manual: dispara una de cada color para verificar que Windows las muestra.
  function testNotifications() {
    if (typeof Notification === "undefined") { setSummary("Este navegador no soporta notificaciones de escritorio.", "error"); return; }
    if (Notification.permission === "denied") {
      setSummary("Notificaciones BLOQUEADAS: clic en el candado de la barra de direcciones → Notificaciones → Permitir, y recarga.", "error");
      showToast("ROJO", "⛔ Prueba (solo navegador)", "Windows está bloqueado para este sitio. Actívalo en el candado de la barra de direcciones.", true);
      return;
    }
    if (Notification.permission !== "granted") { setSummary("Pulsa «Permitir» en el aviso del navegador…"); enableOsNotifications(); return; }
    // UN SOLO CANAL A LA VEZ: la prueba usa la misma cascada que las alertas reales
    // (Windows y, solo si Windows no la muestra, el aviso dentro del navegador).
    // NO es persistente: se cierra sola a los 20 s y no deja fantasmas en Windows.
    const t = new Date().toLocaleTimeString();
    osNotify("ROJO", "⛔ Prueba " + t + " · En Sala", "PACIENTE DE PRUEBA\nConfirmación extemporánea (NO CONFIRMADO)\n(Este aviso se cierra solo)", false, "prueba|" + Date.now()); // [COPY-UX]
    playTone("ROJO");
    // Los canales extra solo se ejercitan si están activados en Ajustes (se gatean solos).
    bigAlert("ROJO", "⛔ PRUEBA · cartel", "Este cartel salió porque está activado en Ajustes.");
    startFlash("⛔ PRUEBA de alerta", "ROJO");
    popupAlert("ROJO", "⛔ PRUEBA", "Esta ventana salió porque está activada en Ajustes.");
    setSummary("Prueba enviada. Debe verse UNA notificación de Windows (+ sonido). Se cierra sola: no queda pegada en el Centro de actividades.");
  }
  function enableOsNotifications() {
    try {
      if (typeof Notification === "undefined") { setSummary("Este navegador no soporta notificaciones de escritorio.", "warn"); return; }
      Notification.requestPermission().then((p) => {
        state.osNotif = (p === "granted");
        if (p === "granted") notify("AZUL", "🔔 Avisos activados", "Recibirás avisos de extemporáneas e inasistencia como notificación de Windows, aunque estés en otra ventana.", false); // [COPY-UX]
        else setSummary("Permiso denegado: los avisos saldrán dentro del navegador.", "warn");
        updateBell();
      });
    } catch (e) {}
  }


  // =====================================================================
  //  LECTURA DIRECTA DEL API (v7.0) — el camino más eficiente posible.
  //  Everest pide su agenda con:
  //     GET /apiviva/APIMedicoHealth/api/Medico/ObtenerConsultas?especialidadId=..&profesionalId=..
  //  autenticado SOLO con las cookies de sesión (no hay token). Como el script
  //  corre en la misma página, puede repetir esa llamada tal cual: sin clon,
  //  sin recargar nada, unos pocos kB por consulta.
  //  La URL NO se configura: se aprende observando la llamada que la propia
  //  aplicación hace al abrir la agenda o al pulsar "Consultar".
  //  Si algo no encaja (campos irreconocibles, respuesta vacía, error de red),
  //  se vuelve solo al método de siempre. Nunca se queda sin vigilar.
  // =====================================================================
  const API = { url: "", visto: 0, campos: null, fallos: 0, ok: 0, ultimo: 0, enVuelo: false, ms: 0, noF0: false, medicoId: 0 };
  const API_RE = /\/ObtenerConsultas\?/i;
  // Vocabulario de estados que el script sabe interpretar. Si lo que llega no se
  // parece a esto, el API se descarta y se sigue por el camino de siempre.
  const EST_RE = /en sala|sin presentar|atendid|pendiente|confirmad|cancelad|agendad|asignad|no asisti|inasist|reprogram|programad|espera|admitid|admision|llamad|triage|ausente/i;
  try {
    API.url = localStorage.getItem("vgl_api_url") || "";
    API.medicoId = parseInt(localStorage.getItem("vgl_api_medico"), 10) || 0;
  } catch (e) {}
  function apiRecordar(url) {
    try {
      if (!url || !API_RE.test(url)) return;
      const abs = url.indexOf("http") === 0 ? url : (location.origin + (url[0] === "/" ? "" : "/") + url);
      if (abs === API.url) { API.visto = Date.now(); return; }
      API.url = abs; API.visto = Date.now(); API.fallos = 0;
      localStorage.setItem("vgl_api_url", abs);
      // v12.3.6 — Se etiqueta la URL aprendida con el médico bajo el cual se aprendió.
      // Ver invalidarApiSiCambioMedico() para el porqué: en un equipo de consultorio
      // compartido, esta URL trae el profesionalId de OTRO médico y no debe reusarse.
      API.medicoId = (state.activeDoctor && state.activeDoctor.id) || 0;
      try { localStorage.setItem("vgl_api_medico", String(API.medicoId)); } catch (e2) {}
      console.log("[Vigilante] llamada de agenda aprendida");
    } catch (e) {}
  }
  // v12.3.6 — DESCUBIERTO EN CONSULTORIO: el panel se quedaba mostrando "Última
  // lectura... vuelve a Citas del día" de forma PERSISTENTE (no transitoria) en el
  // equipo de un médico, incluso estando en Historia Clínica un buen rato — la
  // condición en la que el modo API en segundo plano está diseñado para funcionar
  // (ver el comentario "MODO LIGERO" en tick()).
  //
  // Causa: API.url guarda la URL COMPLETA de ObtenerConsultas, con el profesionalId
  // del médico que la generó, en localStorage — GLOBAL al equipo, no por médico. En
  // un consultorio compartido, si el Dr. A la dejó aprendida y luego entra la Dra. B,
  // Vigilante seguía reintentando la URL de A con la SESIÓN de B: el servidor la
  // rechaza, apiSano() exige menos de 2 fallos para confiar en el API (línea de
  // apiSano más abajo) y el modo API queda inhabilitado hasta que alguien note el
  // problema — el mismo patrón de fuga de identidad entre médicos ya corregido para
  // el agendamiento en v12.3.1/v12.3.2, aquí en la LECTURA de la agenda.
  //
  // Se limpia el estado del API en cuanto se identifica a un médico DISTINTO de aquel
  // bajo el que se aprendió la URL: Everest la vuelve a enseñar sola (apiObservar ya
  // está siempre activo) la próxima vez que ese médico visite "Citas del día", sin
  // que nadie tenga que reinstalar ni tocar Ajustes.
  function invalidarApiSiCambioMedico(nuevoId) {
    if (!(nuevoId > 0)) return;
    if (API.medicoId > 0 && API.medicoId !== nuevoId) {
      purgarApiUrl("pertenecía al médico id " + API.medicoId + ", ahora en sesión id " + nuevoId);
      state.apiCitas = null; state.apiEn = 0;
    }
    // Se etiqueta (o re-etiqueta) siempre con el médico ya resuelto: cubre tanto el
    // caso de arriba como el de una URL aprendida ANTES de que la identidad se
    // resolviera (apiRecordar la marcó con medicoId=0 por no saberlo aún) — de aquí
    // en adelante ya queda protegida frente al próximo cambio de médico.
    API.medicoId = nuevoId;
    try { localStorage.setItem("vgl_api_medico", String(nuevoId)); } catch (e) {}
  }
  // Segunda vía para aprender la llamada, SIN interceptar nada: el navegador ya
  // guarda todas las peticiones de la pestaña en su registro de rendimiento. Sirve
  // aunque la aplicación hiciera la llamada antes de instalarse el script y aunque
  // Angular vuelva a envolver XMLHttpRequest por encima del nuestro (que es
  // justamente lo que hacía que la captura se quedara en blanco).
  function apiSniffPerf(win) {
    try {
      const p = (win || window).performance;
      const ent = p && p.getEntriesByType ? p.getEntriesByType("resource") : null;
      if (!ent) return;
      for (let i = ent.length - 1; i >= 0; i--) if (API_RE.test(ent[i].name)) { apiRecordar(ent[i].name); return; }
    } catch (e) {}
  }
  // Mejor todavía: un observador. Avisa en cuanto la aplicación hace la llamada, sin
  // repasar la lista una y otra vez, y sin que importe que el registro se llene y
  // descarte las peticiones viejas (Everest hace cientos al arrancar). Con
  // buffered:true también repasa las que ya hubiera antes de instalarse.
  function apiObservar(win) {
    try {
      const w = win || window;
      if (!w.PerformanceObserver || w.__vglPO || w.__VGL_OBSERVADOR_ACTIVO__) return;
      w.__VGL_OBSERVADOR_ACTIVO__ = true;
      const po = new w.PerformanceObserver((l) => {
        const es = l.getEntries();
        for (let i = 0; i < es.length; i++) {
          if (es[i] && es[i].name) {
            captureDoctorInfo(es[i].name);
            if (API_RE.test(es[i].name)) apiRecordar(es[i].name);
          }
        }
      });
      po.observe({ type: "resource", buffered: true });
      w.__vglPO = po;
    } catch (e) {}
  }
  // El arreglo de citas, aunque venga envuelto ({ data: [...] }, { Consultas: [...] }).
  function apiLista(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return null;
    for (const k in data) { const v = data[k]; if (Array.isArray(v) && (!v.length || typeof v[0] === "object")) return v; }
    return null;
  }
  // Detecta qué campo es qué mirando los VALORES, no solo el nombre: un nombre de
  // campo puede ser cualquier cosa, pero una hora parece una hora y un estado se
  // repite en muchas filas. Así aguanta que Everest renombre sus campos.
  function apiCampos(lista) {
    const fila = lista.find((x) => x && typeof x === "object");
    if (!fila) return null;
    const claves = Object.keys(fila), muestra = lista.slice(0, 60);
    const vals = (k) => muestra.map((o) => (o ? o[k] : undefined));
    // HORA: la columna que más filas convierte en hora válida. Se penalizan las de
    // "fin", "creación" o "nacimiento", que también parecen horas y no lo son.
    let hora = null, mejorH = 0;
    for (const k of claves) {
      const v = vals(k); let ok = 0;
      for (const x of v) if ((typeof x === "string" || typeof x === "number") && parseHoraMin(x) != null) ok++;
      if (!ok) continue;
      let sc = ok / v.length;
      if (/hora|hour|time/i.test(k)) sc += 0.5;
      if (/inicio|cita|program|asignad|atencion/i.test(k)) sc += 0.3;
      if (/fin|final|termin|salida|creaci|registro|nacim|modific/i.test(k)) sc -= 1;
      if (sc > mejorH) { mejorH = sc; hora = k; }
    }
    // ESTADO: columna de texto con POCOS valores distintos y que se parecen a los
    // estados conocidos. Un nombre de paciente nunca pasa este filtro.
    let estado = null, mejorE = 0;
    for (const k of claves) {
      const v = vals(k).filter((x) => typeof x === "string" && x.trim());
      if (v.length < muestra.length * 0.5) continue;
      const dist = new Set(v.map((x) => x.trim().toLowerCase()));
      if (dist.size > 12) continue;
      let hit = 0; for (const d of dist) if (EST_RE.test(d)) hit++;
      if (!hit) continue;
      let sc = hit / dist.size;
      if (/estado|status|situacion/i.test(k)) sc += 0.5;
      if (sc > mejorE) { mejorE = sc; estado = k; }
    }
    const buscar = (re) => claves.find((k) => re.test(k));
    const doc = buscar(/(nro|num)\w*(doc|ident)|documento|identificacion|cedula/i) || buscar(/^doc|ident/i);
    // Ojo: excluir al médico y a la especialidad, o el panel mostraría el nombre
    // del profesional en todas las tarjetas en vez del paciente.
    const nombres = claves.filter((k) => /nombre|apellido|paciente/i.test(k) && !/medico|profesional|especial|usuario|sede|eps|entidad|empresa|convenio/i.test(k) && typeof fila[k] === "string");
    // v13.0.0 — CitaId numérico que Everest usa internamente para identificar una cita
    // puntual (distinto del doc_id/cédula del paciente). Confirmado por captura real de
    // /ObtenerConsultas: el campo se llama LITERALMENTE `citaId` — coincidencia exacta, no
    // heurística, para no adivinar. Sin consumidor propio desde que se retiró el botón
    // "Atender" (v14.0.2) que lo usaba; se conserva porque el dato ya viene gratis en la
    // respuesta y puede volver a hacer falta (p. ej. para identificar la cita al automatizar
    // el buscador de Conducta).
    const citaIdKey = buscar(/^citaid$/i);
    if (!hora || !estado || mejorH < 0.5) return null;
    return { hora, estado, doc, nombres, citaIdKey };
  }
  // Devuelve: arreglo de citas · [] si la agenda está vacía (dato válido) · null si
  // la respuesta no se entiende (eso sí es un fallo).
  function apiParse(lista) {
    if (!Array.isArray(lista)) return null;
    if (!lista.length) return [];
    const c = API.campos || apiCampos(lista);
    if (!c) return null;
    const citas = []; let buenas = 0;
    for (let i = 0; i < lista.length; i++) {
      const r = lista[i] || {}, min = parseHoraMin(r[c.hora]);
      if (min != null) buenas++;
      citas.push({
        hora_texto: min != null ? horaBonita(min) : limpio(String(r[c.hora] ?? "")),
        doc_id: extractDoc(String(c.doc ? (r[c.doc] ?? "") : "")),
        nombre: limpio(c.nombres.map((k) => r[k]).filter(Boolean).join(" ")) || "Paciente Everest",
        modalidad: "", estado: limpio(String(r[c.estado] ?? "")) || "Pendiente", index: i,
        // v13.0.0 — Solo se rellena si /ObtenerConsultas trajo el campo real `citaId`
        // (ver apiCampos): el camino de respaldo por DOM nunca lo tiene, y sin él el
        // botón "Atender" no aparece — casilla vacía, nunca un id inventado.
        citaId: (c.citaIdKey && r[c.citaIdKey] != null) ? (Number(r[c.citaIdKey]) || undefined) : undefined,
      });
    }
    // GUARDAS. Si algo no cuadra NO se usa el API: más vale seguir por el camino
    // lento que colorear mal y dejar pasar un fraude.
    if (buenas < citas.length * 0.6) return null;                 // horas ilegibles
    if (!citas.some((a) => EST_RE.test(a.estado))) return null;   // estados desconocidos
    API.campos = c;
    return citas;
  }
  // Tope de tamaño. Una agenda del día son unos 15 kB; 8 MB es 500 veces más. Si
  // llega algo mucho mayor (un error del servidor que devuelve media base de datos,
  // o una redirección rara), no se lee entero: solo digerir 30 MB de texto congela
  // el hilo principal casi un cuarto de segundo, y eso el médico lo NOTA.
  const API_MAX = 8 * 1024 * 1024;
  async function leerConTope(r, max) {
    const cl = +(r.headers.get("content-length") || 0);
    if (cl > max) { try { if (r.body && r.body.cancel) r.body.cancel(); } catch (e) {} throw new Error("respuesta demasiado grande (" + Math.round(cl / 1048576) + " MB)"); }
    if (cl || !r.body || !r.body.getReader) return r.text();   // tamaño conocido y razonable
    // Sin content-length (troceada): se lee vigilando cuánto lleva.
    const rd = r.body.getReader(), tr = []; let n = 0;
    try {
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        n += value.length;
        if (n > max) { try { rd.cancel(); } catch (e) {} throw new Error("respuesta demasiado grande"); }
        tr.push(value);
      }
    } finally { try { rd.releaseLock(); } catch (e) {} }
    const out = new Uint8Array(n); let q = 0;
    for (const t of tr) { out.set(t, q); q += t.length; }
    return new TextDecoder("utf-8").decode(out);
  }
  async function apiLeerAgenda() {
    if (!API.url || API.enVuelo) return null;
    API.enVuelo = true;
    const t0 = Date.now();
    const ctl = (typeof AbortController === "function") ? new AbortController() : null;
    // Corte por tiempo: sin esto, una consulta colgada dejaba peticiones
    // amontonándose una encima de otra y ahogaba la pestaña.
    const corte = setTimeout(() => { try { if (ctl) ctl.abort(); } catch (e) {} }, 9000);
    try {
      const opt = { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" };
      if (ctl) opt.signal = ctl.signal;
      let r = null;
      if (FETCH0 && !API.noF0) {
        try { r = await FETCH0(API.url, opt); }
        catch (e) { if (/illegal invocation/i.test((e && e.message) || "")) API.noF0 = true; else throw e; }
      }
      if (!r) r = await fetch(API.url, opt);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const txt = (await leerConTope(r, API_MAX) || "").trim();
      API.ms = Date.now() - t0;
      if (!txt) { API.fallos = 0; return []; }        // cuerpo vacío: agenda vacía, no es un fallo
      // v12.3.7 — BUG REAL encontrado al reforzar esto: si citas===null, el código de
      // antes SOLO retornaba cuando fallos llegaba a valer EXACTAMENTE 3 — pero como no
      // había return en los casos 1 y 2, la ejecución SEGUÍA de largo hasta "fallos = 0;
      // ok++; return citas" (con citas=null), que BORRABA el contador que se acababa de
      // subir y contaba la falla como un ÉXITO. fallos jamás llegaba a 3 de verdad: la
      // rama de recuperación era código muerto, y apiSano() (que exige ok>0) se daba por
      // buena con un API que en realidad llevaba fallando desde el principio.
      const citas = apiParse(apiLista(JSON.parse(txt)));
      if (citas === null) {
        API.fallos++;
        if (API.fallos >= 3) purgarApiUrl("la respuesta ya no tiene la forma esperada");
        return null;
      }
      API.fallos = 0; API.ok++;
      return citas;
    } catch (e) {
      API.fallos++;
      if (API.fallos >= 3) purgarApiUrl((e && e.message) || String(e));
      return null;
    } finally { clearTimeout(corte); API.enVuelo = false; }
  }
  // v12.3.7 — Antes se insistía contra la MISMA url hasta 5 fallos y luego se esperaban
  // 5 minutos completos, una y otra vez, contra una url que —salvo un corte de red
  // pasajero— casi nunca se recupera sola (sesión caída, médico distinto, o Everest
  // cambió la forma de la llamada). A los 3 fallos SEGUIDOS se olvida la URL entera: la
  // próxima vez que la propia Everest haga esa llamada (apiObservar está siempre activo),
  // se vuelve a aprender sin que nadie tenga que esperar ni volver a "Citas del día" a la
  // fuerza. Generaliza invalidarApiSiCambioMedico() a CUALQUIER causa de fallo repetido,
  // no solo el cambio de médico.
  function purgarApiUrl(motivo) {
    console.warn("[Vigilante] se descarta la llamada de agenda aprendida tras fallos repetidos (" + motivo + ").");
    API.url = ""; API.fallos = 0; API.ok = 0; API.medicoId = 0;
    try { localStorage.removeItem("vgl_api_url"); localStorage.removeItem("vgl_api_medico"); } catch (e) {}
  }
  // ¿Se puede intentar el API? Tras 5 fallos seguidos se deja descansar, pero se
  // reintenta cada 5 min: una caída pasajera (reinicio del servidor, corte de la VPN)
  // no debe dejar el camino directo muerto hasta que alguien recargue la página.
  const apiUtil = () => !!API.url && (API.fallos < 5 || Date.now() - (API.ultimo || 0) > 300000);
  // ¿Se puede CONFIAR en él para pintar la agenda? Basta con que empiece a fallar para
  // que deje de ser la fuente: más vale volver al clon que enseñar estados de hace rato.
  const apiSano = () => API.ok > 0 && API.fallos < 2;
  // Espera entre consultas. Si el API está fallando NO se va más lento: se va a un
  // ritmo fijo y contenido (10–30 s) para agotar los 5 intentos en un par de minutos.
  // Con un frenado creciente clásico, rendirse costaba un cuarto de hora.
  const apiEspera = (base) => (API.fallos >= 5 ? 300000 : API.fallos ? Math.min(30000, 5000 * (1 + API.fallos)) : Math.max(4000, base));

  // v12.5.14 — DIAGNÓSTICO EN VIVO, pedido para investigar el aviso "Última lectura...
  // vuelve a Citas del día" pegado durante minutos fuera de esa vista (reportado en
  // consultorio: 19 min de atraso con el médico en Historia Clínica). Sin esto había que
  // adivinar entre 3 causas posibles (API nunca aprendido en esta pestaña, API fallando
  // en racha, o esta pestaña sin el liderazgo de vigilancia) sin poder verlas — se expone
  // en window para pegarlo desde F12 en el momento exacto en que se congela. NINGÚN dato
  // de paciente: solo contadores, banderas y "hace cuántos ms", nunca nombres ni cédulas.
  window.__VGL_DIAG__ = function () {
    try {
      const ahora = Date.now();
      let beat = null;
      try { beat = JSON.parse(localStorage.getItem(LEADER_KEY) || "null"); } catch (e) {}
      return {
        seccion: seccionActiva(),
        esLider: !!state.leader,
        latidoLiderPropio: !!(beat && beat.id === TABID),
        latidoLiderHaceMs: beat ? (ahora - beat.t) : null,
        apiUrlAprendida: !!API.url,
        apiOk: API.ok,
        apiFallos: API.fallos,
        apiEnVuelo: !!API.enVuelo,
        apiUtil: apiUtil(),
        apiSano: apiSano(),
        apiUltimoIntentoHaceMs: API.ultimo ? (ahora - API.ultimo) : null,
        apiCitasFrescasHaceMs: state.apiEn ? (ahora - state.apiEn) : null,
        ultimoSnapshotHaceMs: (state.lastSnapshot && state.lastSnapshot.at) ? (ahora - state.lastSnapshot.at.getTime()) : null,
        ultimoSnapshotFuente: (state.lastSnapshot && state.lastSnapshot.source) || null,
        compartidoDeOtraPestañaHaceMs: (state.shared && state.shared.t) ? (ahora - state.shared.t) : null,
        refrescoConfiguradoMs: CONFIG.POLL_MS,
      };
    } catch (e) { return { error: String(e) }; }
  };

  // ---- Sondeo del API en MODO LIGERO (v7.3.1, umbrales v12.3.8) ----
  // Ritmo adaptativo, calcado del que usaba el clon pero sin clon: rápido SOLO
  // cuando una cita está cerca de la tolerancia (que es cuando puede colarse un
  // fraude), y muy tranquilo el resto del día. Cada consulta son unos pocos kB.
  //
  // v12.3.8 — Pedido explícito del médico: cadencia prudente casi todo el día y
  // "cada 5 segundos" desde el minuto 5 de gracia. La política se rediseñó ASIMÉTRICA
  // (el esquema anterior era ±2.5/±10 simétrico alrededor del cruce): el riesgo real —
  // que alguien pase la cita a "En Sala"/"Atendido" tapando una llegada tardía — ocurre
  // DESPUÉS del cruce de la tolerancia, no antes. Con tolerancia=6 (por defecto),
  // resta=1 equivale exactamente al "minuto 5 de gracia".
  //
  // El "elapsed" se recalcula EN VIVO desde hora_texto en vez de usar el congelado del
  // último snapshot: con un "Refresco" alto en Ajustes, el snapshot puede tener minutos
  // de edad y la ventana crítica se evaluaría con datos viejos justo cuando más importa.
  function vivoElapsed(a) {
    return a && a.hora_texto ? elapsedMin(a.hora_texto, Date.now()) : ((a && a.elapsed) || 0);
  }
  function apiCadencia() {
    const TOL = CONFIG.TOLERANCIA_MIN;
    const SIN_PENDIENTES = 90000; // 90s — ninguna cita "Sin presentarse" vigente: cero riesgo real
    const LEJANO         = 45000; // 45s — a más de 10 min del cruce; aquí vive casi toda la jornada
    const APROXIMACION   = 15000; // 15s — bisagra antes del cruce y vigilancia sostenida mucho después
    const RECIENTE       = 8000;  // 8s  — 2..15 min DESPUÉS del cruce: la franja de las ediciones tardías
    const CRITICA        = 5000;  // 5s  — minuto 5 de gracia → 2 min tras el cruce (piso real del sistema)
    const ABANDONO_MIN   = 60;    // >1h "Sin presentarse" sin editar: ya no cuenta (antes 25 min, pero
                                  // ese corte dejaba al no-show viejo INFLANDO "pendientes" para siempre
                                  // y el sistema jamás volvía al reposo de 90s)
    const lst = (state.lastSnapshot && state.lastSnapshot.list) || [];
    let pendientes = 0, mejor = Infinity;
    for (const a of lst) {
      const s = (a.estado || "").toLowerCase();
      if (s.includes("atendido") || s.includes("en sala")) continue;  // resuelta: no aporta riesgo
      const resta = TOL - vivoElapsed(a);        // + = falta para el cruce, − = ya lo cruzó (min)
      if (resta < -ABANDONO_MIN) continue;       // abandonada hace horas: se deja de vigilar
      pendientes++;
      let cad;
      if (resta > 10)        cad = LEJANO;
      else if (resta > 1)    cad = APROXIMACION; // 9 min de margen antes de la ventana crítica
      else if (resta >= -2)  cad = CRITICA;      // ventana crítica: minuto 5 → 2 min tras el cruce
      else if (resta >= -15) cad = RECIENTE;     // recién cruzada: máxima probabilidad de edición tardía
      else                   cad = APROXIMACION; // −60..−15: vigilancia sostenida sin urgencia
      if (cad < mejor) mejor = cad;
    }
    return pendientes ? mejor : SIN_PENDIENTES;
  }
  function tickApi() {
    if (!apiUtil()) return;
    const cada = apiEspera(apiCadencia());
    if (API.enVuelo || Date.now() - (API.ultimo || 0) < cada) return;
    API.ultimo = Date.now();
    const currentEpoch = state.sessionEpoch;
    apiLeerAgenda().then((citas) => {
      if (currentEpoch !== state.sessionEpoch) return; // KR-02: Descartes de datos de ayer
      if (citas) { state.apiCitas = citas; state.apiEn = Date.now(); }
    });
  }
  // v12.3.8 — BOMBA DE VENTANA CRÍTICA. Dos huecos que ningún umbral de apiCadencia()
  // puede cerrar por sí solo, señalados por la auditoría del diseño:
  //  (a) el "Refresco" de Ajustes (2–120s) gobierna tick(): con Refresco=30s, el
  //      "cada 5 segundos" de la ventana crítica jamás se cumplía en la práctica;
  //  (b) la entrada a la ventana se detectaba recién en el siguiente tick programado.
  // Este bucle propio de 5s corre SIEMPRE, pero su chequeo es unas comparaciones sobre
  // ≤20 citas (nada de red): solo cuando de verdad hay una cita en ventana crítica
  // dispara tickApi() — ignorando el Refresco configurado — y al ENTRAR a la ventana
  // fuerza una lectura INMEDIATA (API.ultimo=0 salta la espera de cadencia).
  // No duplica peticiones: tickApi() ya se protege solo con API.enVuelo + API.ultimo.
  let _criticoPrev = false;
  function hayVentanaCritica() {
    const TOL = CONFIG.TOLERANCIA_MIN;
    const lst = (state.lastSnapshot && state.lastSnapshot.list) || [];
    for (const a of lst) {
      const s = (a.estado || "").toLowerCase();
      if (s.includes("atendido") || s.includes("en sala")) continue;
      const resta = TOL - vivoElapsed(a);
      if (resta <= 1 && resta >= -2) return true;
    }
    return false;
  }
  setInterval(() => {
    try {
      // v12.3.36 — El latido de liderazgo se renueva AQUÍ, cada 5 s, pase lo que pase
      // con el "Refresco" de Ajustes (que gobierna tick() y puede llegar a 120 s):
      // sin esta renovación frecuente, el latido del propio líder vencería entre
      // ticks y las pestañas se relevarían en falso unas a otras.
      if (!heartbeat()) return;
      const crit = hayVentanaCritica();
      if (crit && !_criticoPrev) API.ultimo = 0;   // lectura inmediata al ENTRAR a la ventana
      if (crit) tickApi();
      _criticoPrev = crit;
    } catch (e) {}
  }, 5000);


  // ---- Overlay ----
  let el = {};
  let winState = "full";
  // Controles de ventana estilo macOS: full / min (solo barra) / dock (pastilla flotante).
  // v7.8.1: "auto" distingue un cambio de ventana DECIDIDO POR EL MÉDICO (clic en ×/−/+,
  // doble clic, restaurar al abrir la página) de uno hecho por el propio script al entrar
  // o salir de una sección permitida. Solo el primero se GUARDA (persiste entre recargas);
  // el segundo es puramente visual y nunca pisa la preferencia real del médico.
  function setWinState(s, auto) {
    winState = s; if (!el.root) return;
    el.root.classList.toggle("min", s === "min");
    el.root.style.display = (s === "dock") ? "none" : "flex";
    if (el.dock) el.dock.style.display = (s === "dock") ? "flex" : "none";
    if (!auto) { state.userWinState = s; savePos(); }
  }
  function buildOverlay() {
    const style = document.createElement("style");
    style.textContent = `
      /* ================================================================
         VIGILANTE DE AGENDA — HUD ESPACIAL 2026 (Spatial UI · Frost Glass)
         [UI-CSS] OLED + triaje neón-pastel · Bento · WCAG AAA · spring
         Todo efecto pesado se apaga bajo .perf y prefers-reduced-motion
      ================================================================ */

      /* ---- Design tokens — Modo Oscuro OLED (default) ---- */
      /* v12.6.6 — #vgl-labsv-modal y #vgl-postcita-panel FALTABAN en esta lista. Ambos se
         cuelgan de document.body, fuera de #vgl-root, así que sin estar aquí no heredaban
         NINGÚN token: cada var(--bg-solid)/var(--fg)/var(--r-surface) quedaba inválido y el
         navegador descartaba esa declaración. El aviso salía como texto suelto sobre la
         pantalla de Everest —sin tarjeta, sin fondo y con el azul heredado del host—, que es
         justo lo que reportó el médico. El diseño ya existía; no llegaba. */
      #vgl-root,#vgl-lab-injector,#vgl-examen-normalidad,#vgl-examen-guardar,#vgl-examen-aplicar,#vgl-sp,#vgl-dock,#vgl-acciones-dock,#vgl-pym-banner,#vgl-toasts,#vgl-modal,#vgl-pym-modal,#vgl-pes-modal,#vgl-agendar-modal,#vgl-ordenar-modal,#vgl-labs-modal,#vgl-labsv-modal,#vgl-postcita-panel,#vgl-instancia-duplicada{
        /* Vidrio frost sobre negro OLED */
        --bg:rgba(9,11,17,.84);
        --bg-sidebar:rgba(5,7,12,.66);
        --bg2:rgba(255,255,255,.055);
        --bg3:rgba(255,255,255,.095);
        --bg4:rgba(255,255,255,.17);
        --bg-solid:#0b0e15;
        /* Triaje neón-pastel — AAA (>=7:1) sobre fondo OLED */
        --c-rojo:#ff8177;
        --c-morado:#c9a2ff;
        --c-ambar:#ffc46b;
        --c-verde:#4ff0b8;
        --c-azul:#7cb8ff;
        --c-recordatorio:#54e6d4;
        --c-pes:#ff9ec4;
        /* v13.0.0 — Atendido y En Sala pasan los dos por colorAndAlert como VERDE (mismo
           eje de puntualidad): el badge de estado se veía IGUAL para ambos, y la única
           diferencia era la atenuación de la tarjeta completa (fácil de pasar por alto
           con el zoom del médico). Un tono EXCLUSIVO — que ningún otro estado ni el eje
           de fraude usa — para que el badge/borde de "Atendido" se lea sin ambigüedad,
           sin tocar el punto de puntualidad (--tc) que sigue reflejando SOLO fraude/demora. */
        --c-atendido:#9aa7c7;
        /* Canales RGB para veladuras y glows: rgba(var(--rgb-x),alfa) */
        --rgb-rojo:255,129,119;
        --rgb-morado:201,162,255;
        --rgb-ambar:255,196,107;
        --rgb-verde:79,240,184;
        --rgb-azul:124,184,255;
        --rgb-recordatorio:84,230,212;
        --rgb-pes:255,158,196;
        --rgb-atendido:154,167,199;
        /* Radios orgánicos 16–24 */
        --r-chip:16px;--r-card:20px;--r-surface:24px;--r-field:16px;--r-pill:999px;
        /* Tinta */
        --fg:#f7fafc;--fg2:rgba(226,232,240,.90);--fg3:#9aa7ba;
        /* v14.0.0 (T3) — --t-body/--t-lead se quedan en 14/16px con sus consumidores ya
           cableados (D1): el valor "oficial" del superprompt para --t-body es 13px, pero
           cambiarlo AHORA movería 6 elementos reales 1px — eso es un cambio visual, y esta
           tarea es "cero cambio visual". Queda como pregunta abierta para el médico, igual
           que ya se anotó en el commit de D1: ¿se baja --t-body a 13px en una fase de
           rediseño real (T4/TL1/TL2), o se acepta 14px como el valor vigente del sistema? */
        --t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;
        --s1:4px;--s2:8px;--s3:12px;--s4:16px;--s5:24px;--s6:32px;
        --surface-1:var(--bg2);--surface-2:var(--bg3);--surface-3:var(--bg4);
        /* v14.0.0 (T3) — D6: política de capas, por fin escrita. --z-toast queda intocado
           (2147483647, sin consumidor real todavía). --z-modal SÍ estaba declarado desde
           antes pero SIN NINGÚN consumidor real (todo el CSS usaba el literal 2147483647
           directo) — redefinir su valor aquí no cambia nada visible hoy; el cambio real
           ocurre más abajo, al conectar los tres modales de flujo (agendar/ordenar/labs) a
           este token en vez de al literal. Los otros 4 tokens nuevos son igual de nuevos y
           también tienen consumidor real desde este mismo commit. */
        --z-toast:2147483647;--z-modal:2147483000;
        --z-widget:2147480000;--z-banner:2147481000;--z-panel:2147482000;--z-alerta:2147483600;
        --line:rgba(255,255,255,.08);--edge:rgba(255,255,255,.15);
        --edge-side:rgba(255,255,255,.09);
        --toast:rgba(13,16,24,.94);
        /* Física spring + vidrio frost */
        --spring:cubic-bezier(0.34, 1.56, 0.64, 1);
        --ease-out:cubic-bezier(.2,.9,.3,1);
        --glass:blur(24px) saturate(190%);
        --glass-deep:blur(30px) saturate(210%);
        /* Capas de sombra ambiental + inner-glow (delimitar sin líneas) */
        --glow-edge:inset 0 1px 0 rgba(255,255,255,.13),inset 0 0 0 1px rgba(255,255,255,.04);
        --shadow-panel:
          0 0 0 1px rgba(255,255,255,.10),
          0 2px 6px rgba(0,0,0,.35),
          0 12px 32px rgba(0,0,0,.45),
          0 42px 110px rgba(2,4,10,.78),
          inset 0 1px 0 rgba(255,255,255,.13),
          inset 0 0 36px rgba(124,184,255,.05);
        --shadow-card:
          0 1px 2px rgba(0,0,0,.28),
          0 6px 18px rgba(0,0,0,.26),
          inset 0 1px 0 rgba(255,255,255,.07);
        --shadow-card-hover:
          0 4px 10px rgba(0,0,0,.32),
          0 18px 44px rgba(0,0,0,.48),
          inset 0 1px 0 rgba(255,255,255,.11);
        --shadow-float:
          0 10px 28px rgba(0,0,0,.45),
          0 34px 90px rgba(2,4,10,.70);
        --font-stack:system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }

      /* ---- Modo Claro — cerámica ---- */
      #vgl-root.light,#vgl-lab-injector.light,#vgl-examen-normalidad.light,#vgl-examen-guardar.light,#vgl-examen-aplicar.light,#vgl-sp.light,#vgl-dock.light,#vgl-acciones-dock.light,#vgl-pym-banner.light,#vgl-toasts.light,
      #vgl-modal.light,#vgl-pym-modal.light,#vgl-pes-modal.light,#vgl-agendar-modal.light,#vgl-ordenar-modal.light,#vgl-labs-modal.light,#vgl-labsv-modal.light,#vgl-postcita-panel.light,#vgl-instancia-duplicada.light{
        --bg:rgba(250,250,253,.86);
        --bg-sidebar:rgba(243,245,250,.80);
        --bg2:rgba(15,23,42,.045);--bg3:rgba(15,23,42,.075);--bg4:rgba(15,23,42,.13);
        --bg-solid:#f6f7fb;
        /* Triaje profundo — AAA sobre cerámica clara */
        --c-rojo:#991b1b;--c-morado:#5b21b6;--c-ambar:#92400e;
        --c-verde:#065f46;--c-azul:#1e40af;--c-recordatorio:#115e59;
        --c-pes:#9d174d;--c-atendido:#475569;
        --rgb-rojo:153,27,27;--rgb-morado:91,33,182;--rgb-ambar:146,64,14;
        --rgb-verde:6,95,70;--rgb-azul:30,64,175;--rgb-recordatorio:17,94,89;
        --rgb-pes:157,23,77;--rgb-atendido:71,85,105;
        /* v14.0.5 — INFORME_AUDITORIA_T8.md §"Llamadas de juicio" #1, decidido por el
           médico: --fg3 medía 4.11 en tema claro sobre el dock (bajo el mínimo AA de
           4.5). La auditoría dejó anotado que arreglarlo SOLO en .vgl-dock-toggle crearía
           una inconsistencia con .vgl-toast-x y con las ~30 usos de --fg3 del resto del
           panel, así que "debe ser un cambio global, no uno aislado a T5". Esto es ese
           cambio global: se sube el piso del propio TOKEN, con lo que todos sus usos
           (prosa muteada incluida, que también fallaba AA) suben a la vez y la convención
           sigue siendo una sola. #5b6b80 -> #4a5a6e: 4.37 -> 5.66 sobre el dock claro y
           7.05 sobre blanco puro (AAA), conservando la jerarquía --fg > --fg2 > --fg3.
           El tema oscuro NO se toca: ya medía 6.87, holgado sobre AA. */
        --fg:#0b1220;--fg2:rgba(30,41,59,.86);--fg3:#4a5a6e;
        --t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;
        --s1:4px;--s2:8px;--s3:12px;--s4:16px;--s5:24px;--s6:32px;
        --surface-1:var(--bg2);--surface-2:var(--bg3);--surface-3:var(--bg4);
        --z-toast:2147483647;--z-modal:2147483000;
        --z-widget:2147480000;--z-banner:2147481000;--z-panel:2147482000;--z-alerta:2147483600;
        --line:rgba(15,23,42,.08);--edge:rgba(15,23,42,.13);--edge-side:rgba(15,23,42,.10);
        --toast:rgba(255,255,255,.94);
        --glow-edge:inset 0 1px 0 rgba(255,255,255,.90),inset 0 0 0 1px rgba(255,255,255,.35);
        --shadow-panel:
          0 0 0 1px rgba(15,23,42,.08),
          0 2px 6px rgba(15,23,42,.06),
          0 14px 36px rgba(15,23,42,.10),
          0 42px 110px rgba(15,23,42,.16),
          inset 0 1px 0 rgba(255,255,255,.85);
        --shadow-card:
          0 1px 2px rgba(15,23,42,.06),
          0 5px 14px rgba(15,23,42,.07),
          inset 0 1px 0 rgba(255,255,255,.75);
        --shadow-card-hover:
          0 4px 10px rgba(15,23,42,.08),
          0 16px 40px rgba(15,23,42,.14),
          inset 0 1px 0 rgba(255,255,255,.85);
        --shadow-float:
          0 10px 28px rgba(15,23,42,.14),
          0 34px 90px rgba(15,23,42,.20);
      }

      /* ---- Panel Raíz — losa de vidrio espacial ---- */
      #vgl-root{
        position:fixed;bottom:22px;right:22px;
        width:690px;max-width:calc(100vw - 28px);
        max-height:84vh;
        z-index:var(--z-panel);
        display:flex;flex-direction:column;
        overflow:hidden;
        border-radius:var(--r-surface);
        background:
          linear-gradient(165deg,rgba(124,184,255,.07),rgba(201,162,255,.035) 42%,rgba(0,0,0,0) 72%),
          var(--bg);
        -webkit-backdrop-filter:var(--glass-deep);
        backdrop-filter:var(--glass-deep);
        border:1px solid var(--edge);
        box-shadow:var(--shadow-panel);
        color:var(--fg);
        font-family:var(--font-stack);
        -webkit-font-smoothing:antialiased;
        font-size:var(--t-body); /* Base 14px */
        line-height:1.45;
      }
      /* Aurora ambiental decorativa (se apaga en .perf y al arrastrar) */
      #vgl-root::before{
        content:"";position:absolute;inset:-30%;z-index:-1;pointer-events:none;
        background:
          radial-gradient(42% 34% at 16% 6%,rgba(124,184,255,.11),transparent 62%),
          radial-gradient(36% 30% at 90% 10%,rgba(201,162,255,.09),transparent 64%),
          radial-gradient(46% 40% at 80% 98%,rgba(79,240,184,.06),transparent 66%);
        filter:blur(28px);
      }
      #vgl-root.light::before{opacity:.5}
      #vgl-root.min{
        height:48px !important;
        max-height:48px !important;
        min-height:48px !important;
        overflow:hidden !important;
      }
      #vgl-root.min #vgl-body,
      #vgl-root.min #vgl-sheet{
        display:none !important;
      }
      @media (max-width:720px){
        #vgl-root{width:calc(100vw - 20px);right:10px;bottom:10px}
      }
      /* MODO RENDIMIENTO / arrastre: cero efectos pesados */
      #vgl-root.vgl-dragging,#vgl-root.perf{
        backdrop-filter:none;-webkit-backdrop-filter:none;
        will-change: transform;
      }
      #vgl-root.vgl-dragging::before{content:none}
      #vgl-root.perf{
        background:var(--bg-solid);
        box-shadow:0 0 0 1px var(--edge),0 16px 44px rgba(0,0,0,.50);
      }
      #vgl-root.perf::before{content:none}
      #vgl-root.perf *,#vgl-root.perf *::before,#vgl-root.perf *::after{
        animation:none !important;transition:none !important;
        backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
        text-shadow:none !important;filter:none !important;
      }
      #vgl-root.perf .vgl-card,#vgl-root.perf .vgl-card:hover{transform:none;box-shadow:none}
      #vgl-root.perf #vgl-sidebar{background:var(--bg-solid)}
      #vgl-dock.perf{
        backdrop-filter:none;-webkit-backdrop-filter:none;
        background:var(--bg-solid);
        box-shadow:0 0 0 1px var(--edge),0 10px 26px rgba(0,0,0,.45);
      }
      #vgl-dock.perf *{animation:none !important;transition:none !important;filter:none !important}
      @media (prefers-reduced-motion:reduce){
        #vgl-root,#vgl-root *,#vgl-root *::before,#vgl-root *::after,
        #vgl-dock,#vgl-lab-injector,#vgl-examen-guardar,#vgl-examen-aplicar,#vgl-sp,#vgl-dock *,#vgl-acciones-dock,#vgl-acciones-dock *,#vgl-pym-banner,#vgl-pym-banner *,#vgl-toasts *,
        #vgl-modal,#vgl-modal *,#vgl-pym-modal,#vgl-pym-modal *,
        #vgl-pes-modal,#vgl-pes-modal *,#vgl-agendar-modal,#vgl-agendar-modal *,
        #vgl-ordenar-modal,#vgl-ordenar-modal *,#vgl-labs-modal,#vgl-labs-modal *,
        #vgl-labsv-modal,#vgl-labsv-modal *,#vgl-postcita-panel,#vgl-postcita-panel *{
          animation:none !important;transition:none !important;
        }
      }
      /* Reset defensivo contra herencias del host */



      /* Estilos layout y utilidades JS */
      .vgl-d-none{display:none}
      .vgl-mb-10{margin-bottom:10px}
      .vgl-op-half{opacity:0.5}
      .vgl-line-through{text-decoration:line-through}
      .vgl-border-err{border:1px solid var(--c-rojo, #e54d42)}
      .vgl-bg-success{background:var(--c-verde, #10b981) !important;color:var(--bg-solid, #0b0e15)}
      .vgl-btn-wait{opacity:0.5;cursor:wait}

      .vgl-sp-toast{position:fixed;bottom:24px;right:24px;z-index:2147483647;max-width:460px;background:linear-gradient(165deg,rgba(255,255,255,.06),rgba(255,255,255,0) 55%),#0d1119;color:#f7fafc;border:1px solid rgba(255,255,255,.16);border-left:5px solid #4ff0b8;border-radius:16px;padding:14px 38px 14px 16px;font-family:system-ui,'Segoe UI',sans-serif;font-size:13.5px;font-weight:600;line-height:1.5;letter-spacing:.1px;box-shadow:0 14px 36px rgba(0,0,0,.50),0 0 20px rgba(79,240,184,.15),inset 0 1px 0 rgba(255,255,255,.10);cursor:pointer;transition:opacity 0.3s cubic-bezier(.2,.9,.3,1),transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);opacity:0;transform:translateY(14px)}
      .vgl-sp-toast.vgl-sp-visible{opacity:1;transform:translateY(0)}
      .vgl-sp-x{position:absolute;top:9px;right:11px;font-size:var(--t-strong);font-weight:700;color:#9aa7ba;cursor:pointer;line-height:1;padding:2px 7px;border-radius:999px}

      /* Botones inyectados globales */
      /* v14.0.0 — INCIDENTE REAL EN CONSULTA: el botón "Normalidad fija" desapareció.
         No estaba ausente: estaba PINTADO DETRÁS de Everest. #vgl-examen-normalidad se pega
         a document.body y NO está en las listas de contenedores con tokens (a diferencia de
         #vgl-examen-guardar/#vgl-examen-aplicar, que sí), así que --z-widget no resuelve
         para él; y una declaración con una var() indefinida es INVÁLIDA entera, con lo que
         z-index caía a "auto" y el contenido de Everest se le ponía encima. Verificado en
         Chromium: Auto-Labs (#vgl-lab-injector, que SÍ está en las listas) resolvía
         z-index:2147480000 y recibía el clic; el de examen físico resolvía "auto" y el clic
         se lo llevaba el app-root de Everest.
         La migración de z-index a tokens de D6 dejó este literal (antes 9999999) sin
         reserva, siendo el ÚNICO token de esta regla sin ella — color, font-family y
         font-size sí la llevan, y por exactamente este mismo motivo (incidente v12.6.6).
         El valor de reserva es el mismo de --z-widget en la tabla de D6. */
      .vgl-lab-inj,.vgl-exf-btn{
        position:fixed;left:15px;z-index:var(--z-widget,2147480000);
        color:var(--bg-solid, #fff);border:none;padding:10px 14px;border-radius:6px;
        font-family:var(--font-stack, sans-serif);font-size:var(--t-micro,12px);font-weight:bold;cursor:pointer;
        box-shadow:0 4px 10px rgba(0,0,0,0.5);transition:opacity 0.2s;
      }
      .vgl-lab-inj{bottom:80px;background:var(--c-morado, #8b5cf6)}
      .vgl-exf-btn{background:var(--c-verde, #16a34a)}
      .vgl-exf-btn-normalidad{bottom:130px}

      /* ---- T5: dock de acciones — widget flotante sobre la Historia Clínica ----
         D7 (presupuesto de rendimiento): sin backdrop-filter nuevo (superficie sólida de
         --surface-*), máximo 2 capas de sombra (--shadow-card, ya reutilizado en el resto
         del panel), sin animación permanente (solo transición de hover, neutralizada por
         la lista de prefers-reduced-motion y por .perf más abajo). Posición en el borde
         derecho, centrado verticalmente: no choca con #vgl-dock (abajo-derecha) ni con
         .vgl-lab-inj/.vgl-exf-btn (abajo-izquierda). */
      #vgl-acciones-dock{
        /* v14.0.1 — Reportado en consultorio EN VIVO con pantallazo: centrado verticalmente
           (top:50%) el dock quedaba encima del propio riel de iconos nativo de Everest, que
           vive justo en esa misma franja del borde derecho. Se sube cerca del borde superior
           (fuera de la franja donde vive ese riel nativo) en vez de adivinar un nuevo punto
           medio — si vuelve a chocar, hace falta otro pantallazo para ajustar el offset exacto. */
        position:fixed;top:110px;right:14px;
        z-index:var(--z-widget);
        display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:8px 6px;border-radius:var(--r-pill);
        /* v14.0.0 — BASE OPACA OBLIGATORIA. --surface-2 es un velo (~92% transparente)
           pensado para ir SOBRE el --bg de #vgl-root. Este dock cuelga de document.body,
           así que no tiene ese --bg debajo: con --surface-2 a secas su fondo real es el
           que pinte Everest, y en tema oscuro sobre una pantalla clara el texto casi
           blanco quedaba con contraste 1.05 — invisible. Se apila el mismo velo SOBRE
           --bg-solid: idéntico aspecto, pero el fondo ya no depende del host. */
        background:linear-gradient(0deg,var(--surface-2),var(--surface-2)),var(--bg-solid);
        border:1px solid var(--edge);
        box-shadow:var(--shadow-card);
        color:var(--fg);font-family:var(--font-stack);
      }
      #vgl-acciones-dock.colapsado .vgl-dock-btns{display:none}
      .vgl-dock-toggle{
        width:26px;height:22px;border:none;border-radius:var(--r-chip);
        background:transparent;color:var(--fg3);cursor:pointer;padding:0;
        display:flex;align-items:center;justify-content:center;font-size:var(--t-micro);
        transition:background .15s var(--ease-out),color .15s var(--ease-out);
      }
      .vgl-dock-toggle:hover{color:var(--fg);background:var(--surface-1)}
      .vgl-dock-btns{display:flex;flex-direction:column;gap:6px}
      .vgl-dock-btn{
        width:38px;height:38px;border:none;border-radius:var(--r-chip);
        background:var(--surface-1);color:var(--fg);
        font-size:var(--t-lead);line-height:1;cursor:pointer;padding:0;
        display:flex;align-items:center;justify-content:center;
        box-shadow:inset 0 0 0 1px var(--edge);
        transition:background .15s var(--ease-out);
      }
      .vgl-dock-btn:hover{background:var(--surface-2)}
      .vgl-dock-btn:disabled{opacity:.35;cursor:not-allowed}
      .vgl-dock-btn-ambar{box-shadow:inset 0 0 0 1px var(--c-ambar);color:var(--c-ambar)}
      #vgl-acciones-dock.perf,#vgl-acciones-dock.perf *{transition:none !important;animation:none !important}

      #vgl-root *,#vgl-lab-injector,#vgl-examen-guardar,#vgl-examen-aplicar,#vgl-sp,#vgl-dock *,#vgl-acciones-dock *,#vgl-pym-banner *,#vgl-toasts *,
      #vgl-modal *,#vgl-pym-modal *,#vgl-pes-modal *,
      #vgl-agendar-modal *,#vgl-ordenar-modal *,#vgl-labs-modal *,
      #vgl-labsv-modal *,#vgl-postcita-panel *{box-sizing:border-box}

      /* Blindaje contra estilos globales de Everest */
      #vgl-root b,#vgl-root i,#vgl-root small,#vgl-root mark,
      #vgl-root span,#vgl-root label{color:inherit}
      #vgl-toasts b,#vgl-toasts span{color:inherit}
      #vgl-dock span{color:inherit}
      #vgl-acciones-dock span{color:inherit}
      /* v12.6.6/v12.10.2 — mismo blindaje para los dos avisos que viven en document.body.
         v12.10.2: la versión de v12.6.6 usaba div/span/b A PELO (sin :not([class])) — con
         especificidad id+tipo (1,0,1), le ganaba a CUALQUIER regla de acento con clase
         propia dentro del mismo panel, aunque esa clase fuera más específica en intención.
         Reportado real en consultorio: ".vgl-postcita-title" (color:var(--c-verde)) y
         ".vgl-postcita-sub" (color:var(--fg2)) son <div> con clase — la regla vieja los
         forzaba a color:inherit de todos modos, y como #vgl-postcita-panel cuelga de
         document.body (no de #vgl-root), ese "inherit" terminaba en el azul de Everest.
         Verificado en Chromium con el CSS real generado por buildOverlay(). La regla
         correcta (armadura de v12.3.15, más abajo, con :where()+:not([class]) para no
         pisar reglas de acento con clase propia) ya existe para esto — solo faltaba
         incluir ahí estos dos paneles. Se quitó la regla vieja de aquí y se sumaron
         #vgl-labsv-modal y #vgl-postcita-panel a esa lista. */

      /* Foco de teclado — anillo neón */
      .vgl-btn:focus-visible,.vgl-fchip:focus-visible,.vgl-tl:focus-visible,
      .vgl-btn-action:focus-visible,.vgl-agm-btn:focus-visible,.vgl-agm-pbtn:focus-visible,
      .vgl-agm-sbtn:focus-visible,.vgl-agm-input:focus-visible,.vgl-agm-close:focus-visible,
      .vgl-sb-btn:focus-visible,.vgl-dock:focus-visible,#vgl-dock:focus-visible,
      .vgl-pymb-toggle:focus-visible,.vgl-postcita-x:focus-visible{
        outline:2px solid var(--c-azul);outline-offset:2px;box-shadow:0 0 0 4px rgba(var(--rgb-azul),.25)
      }
      .vgl-sw:focus-within i{outline:2px solid var(--c-azul);outline-offset:2px}

      /* ---- Header — barra de mando ---- */
      #vgl-head{
        height:48px;display:flex;align-items:center;gap:12px;
        padding:0 16px;cursor:move;user-select:none;
        border-bottom:1px solid var(--line);
        background:linear-gradient(rgba(255,255,255,.05),rgba(255,255,255,0));
        flex:0 0 auto;
      }
      #vgl-tls{display:flex !important;align-items:center !important;gap:8px !important;margin-right:8px !important;flex-shrink:0 !important}
      .vgl-tl{
        width:12px !important;height:12px !important;
        min-width:12px !important;min-height:12px !important;
        max-width:12px !important;max-height:12px !important;
        border-radius:50% !important;cursor:pointer !important;border:none !important;
        padding:0 !important;margin:0 !important;box-sizing:border-box !important;
        display:inline-block !important;flex:0 0 12px !important;
        aspect-ratio:1 / 1 !important;
        transition:filter .18s var(--ease-out), transform .18s var(--spring) !important;
        appearance:none !important;-webkit-appearance:none !important;
        outline:none !important;
        line-height:1 !important;overflow:hidden !important;
      }
      .vgl-tl:hover{filter:brightness(1.2) !important;transform:scale(1.18) !important}
      .vgl-tl.close{background:var(--c-rojo) !important;box-shadow:0 0 8px rgba(var(--rgb-rojo),.55) !important}
      .vgl-tl.min{background:var(--c-ambar) !important;box-shadow:0 0 8px rgba(var(--rgb-ambar),.55) !important}
      .vgl-tl.zoom{background:var(--c-verde) !important;box-shadow:0 0 8px rgba(var(--rgb-verde),.55) !important}
      #vgl-title{
        flex:1;text-align:center;font-weight:700;font-size:var(--t-lead); /* Título 16px */
        letter-spacing:.3px;color:var(--fg);opacity:.96;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      #vgl-title small{
        opacity:.60;font-weight:500;margin-left:6px;font-size:var(--t-micro) /* Mínimo 12px */
      }
      #vgl-dot{
        width:9px;height:9px;border-radius:50%;background:var(--fg3);
        flex:0 0 auto;transition:background .3s,box-shadow .3s
      }
      #vgl-dot.bg{background:var(--c-verde);box-shadow:0 0 10px rgba(var(--rgb-verde),.9)}
      #vgl-dot.page{background:var(--c-azul);box-shadow:0 0 10px rgba(var(--rgb-azul),.85)}
      #vgl-dot.stale{background:var(--c-ambar);box-shadow:0 0 10px rgba(var(--rgb-ambar),.85)}
      @keyframes vglPulse{
        0%,100%{box-shadow:0 0 10px rgba(var(--rgb-verde),.9),0 0 0 0 rgba(var(--rgb-verde),.45)}
        50%{box-shadow:0 0 10px rgba(var(--rgb-verde),.9),0 0 0 7px rgba(var(--rgb-verde),0)}
      }
      #vgl-dot.bg{animation:vglPulse 2.4s ease-out infinite}

      /* ---- Cuerpo 2 columnas ---- */
      #vgl-body{
        display:flex;flex:1 1 auto;overflow:hidden;min-height:0;
      }

      /* ---- Sidebar izquierdo — costado frost ---- */
      #vgl-sidebar{
        width:195px;flex-shrink:0;
        display:flex;flex-direction:column;gap:0;
        border-right:1px solid var(--edge-side);
        background:linear-gradient(180deg,rgba(var(--rgb-azul),.05),rgba(0,0,0,0) 42%),var(--bg-sidebar);
        overflow-y:auto;overflow-x:hidden;
        padding:14px 12px 16px;
        -webkit-backdrop-filter:var(--glass);
        backdrop-filter:var(--glass);
      }
      #vgl-sidebar::-webkit-scrollbar{width:0}

      /* Buscador */
      #vgl-find{margin-bottom:12px}
      #vgl-q{
        width:100%;appearance:none;
        border:1px solid var(--edge);background:var(--bg2);
        color:var(--fg);border-radius:var(--r-field);padding:9px 14px;
        font-size:13px;font-family:inherit;outline:none;
        line-height:1.4;
        box-shadow:var(--glow-edge);
        transition:border-color .18s var(--ease-out),box-shadow .18s var(--ease-out);
      }
      #vgl-q:focus{
        border-color:rgba(var(--rgb-azul),.65);
        box-shadow:0 0 0 3px rgba(var(--rgb-azul),.22),var(--glow-edge);
      }
      #vgl-q::placeholder{color:var(--fg3)}

      /* Etiqueta de sección */
      .vgl-sb-lbl{
        font-size:var(--t-micro);font-weight:700;letter-spacing:.9px; /* Mínimo 12px */
        color:var(--fg3);text-transform:uppercase;
        padding:0 4px;margin-bottom:6px;margin-top:8px;
      }

      /* Filtros */
      #vgl-filters{display:flex;flex-direction:column;gap:4px;margin-bottom:14px}
      .vgl-fchip{
        cursor:pointer;font-size:13px;font-weight:500;
        padding:8px 12px;border-radius:var(--r-chip);
        background:transparent;color:var(--fg2);
        border:0;text-align:left;font-family:inherit;
        transition:background .16s var(--ease-out),color .16s var(--ease-out),transform .24s var(--spring);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        line-height:1.4;
      }
      .vgl-fchip:hover{background:var(--bg3);color:var(--fg);transform:translateX(2px)}
      .vgl-fchip.sel{
        background:rgba(var(--rgb-azul),.16);color:var(--c-azul);
        font-weight:700;
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.30),var(--glow-edge);
      }
      #vgl-root.light .vgl-fchip.sel{color:var(--c-azul)}

      /* Stats */
      #vgl-stats{
        display:flex;flex-direction:column;gap:4px;
        margin-bottom:12px;
        border-top:1px solid var(--line);
        padding-top:12px;
      }
      #vgl-stats:empty{display:none;border-top:none;padding-top:0}
      .vgl-stat{
        display:flex;align-items:center;gap:8px;
        font-size:var(--t-micro);font-weight:600;color:var(--fg2); /* Mínimo 12px */
        padding:5px 6px;border-radius:var(--r-chip);
        line-height:1.4;
      }
      .vgl-stat b{font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums;margin-left:auto}
      .vgl-stat .vgl-d{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
      .vgl-stat.hot{
        background:rgba(var(--rgb-rojo),.16);color:var(--c-rojo);
        font-weight:800;padding:6px 8px;border-radius:var(--r-chip);
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-rojo),.30);
      }
      .vgl-stat.hot b{color:var(--c-rojo)}

      /* Botones Sidebar */
      #vgl-actions{
        margin-top:auto;display:flex;flex-direction:column;gap:6px;
        border-top:1px solid var(--line);padding-top:12px;
      }
      .vgl-sb-btn{
        appearance:none;border:0;border-radius:var(--r-chip);
        padding:9px 12px;font-size:13px;font-weight:500;
        cursor:pointer;color:var(--fg);background:var(--bg2);
        transition:background .16s var(--ease-out),transform .24s var(--spring),box-shadow .24s var(--ease-out);
        font-family:inherit;text-align:left;
        display:flex;align-items:center;gap:8px;
        line-height:1.4;
        box-shadow:var(--glow-edge);
      }
      .vgl-sb-btn:hover{background:var(--bg3);transform:translateY(-1px)}
      .vgl-sb-btn:active{transform:scale(.97)}
      .vgl-sb-btn.primary{
        background:linear-gradient(150deg,rgba(var(--rgb-azul),.30),rgba(var(--rgb-azul),.14));
        color:var(--c-azul);font-weight:700;
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.40),0 4px 14px rgba(var(--rgb-azul),.18);
      }
      .vgl-sb-btn.primary:hover{background:linear-gradient(150deg,rgba(var(--rgb-azul),.40),rgba(var(--rgb-azul),.20))}
      .vgl-sb-btn.on{
        background:rgba(var(--rgb-verde),.15);color:var(--c-verde);font-weight:700;
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-verde),.35);
      }
      .vgl-sb-btn.off{
        background:rgba(var(--rgb-rojo),.16);color:var(--c-rojo);font-weight:700;
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-rojo),.35);
      }

      /* ---- Área Principal ---- */
      #vgl-main{
        flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;
      }
      #vgl-sum{
        font-size:12.5px;color:var(--fg3);padding:9px 16px; /* Aumentado a 12.5px */
        border-bottom:1px solid var(--line);
        font-weight:600;letter-spacing:.1px;flex:0 0 auto;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        line-height:1.4;
      }
      #vgl-sum.warn{color:var(--c-ambar)}
      #vgl-sum.error{color:var(--c-rojo)}
      #vgl-root:not(.light) #vgl-sum.warn{color:var(--c-ambar)}
      #vgl-root:not(.light) #vgl-sum.error{color:var(--c-rojo)}

      /* Lista de Tarjetas — bandeja bento */
      #vgl-list{
        overflow-y:auto;padding:12px 12px 14px;
        display:flex;flex-direction:column;gap:10px;
        flex:1 1 auto;
      }
      #vgl-list::-webkit-scrollbar{width:6px}
      #vgl-list::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:var(--r-pill)}
      #vgl-root.stale #vgl-list{opacity:.75}

      #vgl-empty{
        color:var(--fg3);text-align:center;
        padding:36px 16px;font-size:13px;line-height:1.55;
      }

      /* ---- Tarjetas Paciente — losas flotantes ---- */
      @keyframes vglSpringIn{
        from{opacity:0;transform:translateY(8px) scale(.97)}
        to{opacity:1;transform:none}
      }
      .vgl-card{
        position:relative;
        background:linear-gradient(170deg,rgba(255,255,255,.045),rgba(255,255,255,0) 55%),var(--bg2);
        border:1px solid var(--line);
        border-radius:var(--r-card);
        border-left:4px solid transparent;
        padding:13px 15px 11px; /* Incremento de padding */
        box-shadow:var(--shadow-card);
        transition:background .16s var(--ease-out),
                   transform .26s var(--spring),
                   box-shadow .26s var(--ease-out),
                   border-color .16s var(--ease-out);
        animation:vglSpringIn .36s var(--spring) both;
      }
      .vgl-card:hover{
        background:linear-gradient(170deg,rgba(255,255,255,.06),rgba(255,255,255,0) 55%),var(--bg3);
        transform:translateY(-2px);
        box-shadow:var(--shadow-card-hover);
      }
      .vgl-card.rojo{
        background:linear-gradient(170deg,rgba(var(--rgb-rojo),.16),rgba(var(--rgb-rojo),.07));
        border-color:rgba(var(--rgb-rojo),.38);
        border-left-color:var(--c-rojo);
        box-shadow:var(--shadow-card),0 0 26px rgba(var(--rgb-rojo),.10);
      }
      .vgl-card.rojo:hover{background:linear-gradient(170deg,rgba(var(--rgb-rojo),.22),rgba(var(--rgb-rojo),.10))}
      .vgl-card.morado{
        background:linear-gradient(170deg,rgba(var(--rgb-morado),.14),rgba(var(--rgb-morado),.06));
        border-color:rgba(var(--rgb-morado),.34);
        border-left-color:var(--c-morado);
        box-shadow:var(--shadow-card),0 0 26px rgba(var(--rgb-morado),.08);
      }
      .vgl-card.morado:hover{background:linear-gradient(170deg,rgba(var(--rgb-morado),.20),rgba(var(--rgb-morado),.09))}
      .vgl-card.ambar{
        background:linear-gradient(170deg,rgba(var(--rgb-ambar),.14),rgba(var(--rgb-ambar),.06));
        border-color:rgba(var(--rgb-ambar),.34);
        border-left-color:var(--c-ambar);
        box-shadow:var(--shadow-card),0 0 26px rgba(var(--rgb-ambar),.08);
      }
      .vgl-card.ambar:hover{background:linear-gradient(170deg,rgba(var(--rgb-ambar),.20),rgba(var(--rgb-ambar),.09))}
      .vgl-card.pes{
        background:linear-gradient(170deg,rgba(var(--rgb-pes),.14),rgba(var(--rgb-pes),.06));
        border-color:rgba(var(--rgb-pes),.36);
        border-left-color:var(--c-pes);
        box-shadow:var(--shadow-card),0 0 26px rgba(var(--rgb-pes),.08);
      }
      .vgl-card.pes:hover{background:linear-gradient(170deg,rgba(var(--rgb-pes),.20),rgba(var(--rgb-pes),.09))}
      .vgl-card.hit{box-shadow:0 0 0 2px rgba(var(--rgb-ambar),.60),var(--shadow-card)}
      /* v13.0.0 — Además de atenuar (opacidad+grises), el borde izquierdo pasa al tono
         EXCLUSIVO --c-atendido: así la tarjeta se distingue de "En sala" (mismo verde en
         el badge) incluso antes de leer el texto. El fraude (.rojo) nunca entra aquí. */
      .vgl-card.atendido:not(.rojo){opacity:0.6;filter:grayscale(60%);border-left-color:var(--c-atendido)}

      .vgl-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      /* v12.0.0 — La tarjeta de paciente se rediseñó en tres franjas (hora/estado, nombre,
         PyM y botones) pero su CSS nunca llegó al archivo: sin estas reglas los elementos
         quedaban apilados en vertical, el nombre perdía la elipsis y los botones de acción
         se iban de sitio. Se añaden aquí para que el rediseño funcione como estaba pensado. */
      .vgl-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .vgl-card-time-wrap{display:flex;align-items:center;gap:8px;min-width:0}
      .vgl-card-badges-wrap{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .vgl-card-mid{display:flex;align-items:baseline;gap:8px;margin-top:6px;min-width:0}
      .vgl-card-btm{display:flex;align-items:center;gap:8px;margin-top:2px;min-width:0}
      .vgl-card-btm .vgl-pyms{flex:1 1 auto;min-width:0}
      .vgl-cdot{
        width:10px;height:10px;border-radius:50%;flex:0 0 auto;
        box-shadow:0 0 8px currentColor;
      }
      .vgl-time{
        font-weight:800;font-size:var(--t-lead);color:var(--fg); /* Hora protagonista */
        white-space:nowrap;font-variant-numeric:tabular-nums;
        letter-spacing:.2px;
      }
      .vgl-name{
        font-size:15.5px;color:var(--fg);flex:1;min-width:0;font-weight:600; /* Nombre protagonista */
      }
      .vgl-name b{
        font-weight:800;color:var(--fg);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        display:inline-block;max-width:100%;vertical-align:bottom;
      }
      .vgl-name mark{
        background:rgba(var(--rgb-ambar),.30);color:inherit;
        border-radius:6px;padding:0 3px
      }
      .vgl-doc{color:var(--fg3);font-size:var(--t-micro);font-weight:500;flex-shrink:0} /* Mínimo 12px */

      /* Badge & Flags */
      .vgl-badge{
        font-size:var(--t-micro);font-weight:800;padding:4px 11px; /* Mínimo 12px + padding */
        border-radius:var(--r-pill);white-space:nowrap;
        letter-spacing:.2px;color:var(--fg);flex-shrink:0;
        line-height:1.3;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);
      }
      .vgl-flag{
        font-size:var(--t-micro);font-weight:800;padding:3px 9px; /* Mínimo 12px */
        border-radius:var(--r-pill);background:var(--c-rojo);
        color:var(--bg-solid);white-space:nowrap;letter-spacing:.4px;flex-shrink:0;
        box-shadow:0 0 12px rgba(var(--rgb-rojo),.35);
      }
      .vgl-flag.pes{background:var(--c-pes);box-shadow:0 0 12px rgba(var(--rgb-pes),.35)}

      .vgl-cd{
        font-size:var(--t-micro);font-weight:700;font-variant-numeric:tabular-nums; /* Mínimo 12px */
        padding:3px 9px;border-radius:var(--r-pill);
        white-space:nowrap;background:var(--bg3);color:var(--fg2);
        flex-shrink:0;box-shadow:var(--glow-edge);
      }
      .vgl-cd.warn{background:rgba(var(--rgb-morado),.18);color:var(--c-morado)}
      #vgl-root.light .vgl-cd.warn{color:var(--c-morado)}
      .vgl-cd.late{background:rgba(var(--rgb-ambar),.18);color:var(--c-ambar)}
      #vgl-root.light .vgl-cd.late{color:var(--c-ambar)}

      /* Acciones en Tarjeta */
      /* Clases migradas de render() T1 */
      .vgl-empty-msg { opacity:.7; }
      .vgl-chip-ocultas { opacity:.75; }
      .vgl-btn-action:disabled { opacity:.4; cursor:not-allowed; }
      .vgl-card-top.vgl-card-top-t1 { gap:10px; }
      .vgl-card-time-wrap.vgl-card-time-wrap-t1 { gap:10px; }
      .vgl-cdot.vgl-cdot-t1 { width:11px; height:11px; }
      .vgl-time.vgl-time-t1 { font-size:var(--t-hero); font-weight:900; letter-spacing:.4px; }
      .vgl-badge.vgl-badge-t1 { font-size:12.5px; padding:5px 12px; }
      .vgl-card-mid.vgl-card-mid-t1 { margin-top:9px; gap:10px; }
      .vgl-name.vgl-name-t1 { font-size:var(--t-title); font-weight:800; line-height:1.25; }
      .vgl-doc-t1 { background:var(--bg2); padding:3px 10px; border-radius:var(--r-pill); box-shadow:var(--glow-edge); font-variant-numeric:tabular-nums; }
      .vgl-card-btm.vgl-card-btm-t1 { margin-top:7px; gap:10px; }

      .vgl-card-actions{
        display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0;
      }
      .vgl-btn-action,.vgl-btn-agendar,.vgl-btn-ordenar{
        all:unset;
        width:40px;height:40px;border-radius:var(--r-chip);
        border:1px solid var(--edge);
        background:var(--bg3);
        font-size:var(--t-title);
        display:inline-flex;align-items:center;justify-content:center;
        cursor:pointer;
        transition:transform .2s var(--spring),background .14s var(--ease-out),box-shadow .2s var(--ease-out);
        flex-shrink:0;box-sizing:border-box;
        box-shadow:var(--glow-edge);
      }
      .vgl-btn-action:hover,.vgl-btn-agendar:hover,.vgl-btn-ordenar:hover{
        transform:scale(1.14);background:var(--bg4);
        box-shadow:0 4px 12px rgba(0,0,0,.30),var(--glow-edge);
      }
      /* v12.10.0 — El ámbar del botón «🧪 falta la toma de muestras» DEBE ir aquí, después de la
         regla base y de :hover, y con selector COMPUESTO (.vgl-btn-action.vgl-btn-ambar). Antes de
         T1 esto era estilo inline, que gana a cualquier regla de la hoja; al migrarlo a una clase
         suelta declarada ANTES de .vgl-btn-action quedó con la MISMA especificidad (0,1,0) que la
         regla base, así que ganaba la última: el all:unset y el background:var(--bg3) borraban el
         ámbar y el botón quedaba idéntico al 🗓️ normal. Verificado en Chromium: mismo
         backgroundColor rgb(22,26,36) y box-shadow "none" en ambos. El médico perdía la única señal
         de que a esa cita le falta la toma de muestras. El selector compuesto (0,2,0) y la variante
         :hover (0,3,0) reproducen exactamente lo que hacía el inline: el ámbar manda en ambos estados. */
      .vgl-btn-action.vgl-btn-ambar,
      .vgl-btn-action.vgl-btn-ambar:hover{
        background:rgba(var(--rgb-ambar),.14);
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-ambar),.5);
      }

      /* Chips PyM */
      /* v12.4.0 — La fila ya NO se desplaza en horizontal (los chips quedaban cortados o
         escondidos tras la máscara de degradado, reportado en consultorio con captura):
         ahora ENVUELVE en varias líneas y el texto completo de cada actividad (con los
         nombres de la tabla oficial de CUPS, más largos) se ve entero. La letra baja de
         12.5px inline a 11.5px de clase — verificado el pedido "siento que las letras
         están muy grandes". */
      .vgl-pyms{
        margin-top:8px;
        display:flex;flex-wrap:wrap;
        gap:5px;
        padding-bottom:2px;
      }
      .vgl-chip{
        font-size:11.5px;font-weight:700;padding:3px 9px;
        border-radius:var(--r-pill);
        background:rgba(var(--rgb-azul),.14);color:var(--c-azul);
        white-space:normal;line-height:1.35;
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.25);
      }
      #vgl-root:not(.light) .vgl-chip{color:var(--c-azul)}
      .vgl-none{margin-top:6px;font-size:var(--t-micro);color:var(--fg2);font-style:italic} /* Mínimo 12px */
      .vgl-none.falta{color:var(--fg3);font-style:normal;font-weight:700}

      /* ---- Hoja Deslizante (Resumen / Ajustes) — bandeja bento ---- */
      #vgl-sheet{
        display:none;flex:1 1 auto;
        overflow-y:auto;padding:18px 20px 22px;
        animation:vglSheet .26s var(--spring);
      }
      #vgl-root.sheet #vgl-list,#vgl-root.sheet #vgl-find{display:none}
      #vgl-root.sheet #vgl-sheet{display:block}
      @keyframes vglSheet{
        from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:none}
      }
      .vgl-sh-h{
        display:flex;align-items:center;
        justify-content:space-between;margin-bottom:16px
      }
      .vgl-sh-t{font-size:17px;font-weight:800;color:var(--fg);letter-spacing:.2px} /* Título */
      .vgl-grp{
        background:linear-gradient(170deg,rgba(255,255,255,.04),rgba(255,255,255,0) 60%),var(--bg2);
        border:1px solid var(--line);
        border-radius:var(--r-card);padding:8px 16px;margin-bottom:14px;
        box-shadow:var(--shadow-card);
      }
      .vgl-fld{
        display:flex;align-items:center;
        justify-content:space-between;gap:12px;
        padding:10px 0;border-bottom:1px solid var(--line)
      }
      .vgl-fld:last-child{border-bottom:0}
      .vgl-fld label{font-size:var(--t-body);color:var(--fg);font-weight:500;line-height:1.4} /* Base 14px */
      .vgl-fld .vgl-hint{
        display:block;font-size:var(--t-micro);color:var(--fg2); /* Mínimo 12px */
        font-weight:400;margin-top:3px;max-width:280px;line-height:1.45 /* Interlineado 1.45 */
      }
      .vgl-fld input[type=text],.vgl-fld input[type=number],
      .vgl-fld input[type=time],.vgl-fld select{
        appearance:none;border:1px solid var(--edge);
        background:var(--bg2);color:var(--fg);border-radius:var(--r-field);
        padding:8px 12px;font-size:13px;font-family:inherit;
        outline:none;min-width:100px;max-width:170px;
        line-height:1.4;box-shadow:var(--glow-edge);
        transition:border-color .16s var(--ease-out),box-shadow .16s var(--ease-out);
      }
      .vgl-fld input:focus,.vgl-fld select:focus{
        border-color:rgba(var(--rgb-azul),.65);
        box-shadow:0 0 0 3px rgba(var(--rgb-azul),.20),var(--glow-edge)
      }

      /* Interruptor iOS */
      .vgl-sw{position:relative;width:44px;height:26px;flex:0 0 auto;cursor:pointer}
      .vgl-sw input{opacity:0;width:0;height:0;position:absolute}
      .vgl-sw i{
        position:absolute;inset:0;border-radius:var(--r-pill);
        background:var(--bg4);transition:background .2s var(--ease-out),box-shadow .2s;
        box-shadow:inset 0 1px 3px rgba(0,0,0,.22)
      }
      .vgl-sw i:after{
        content:"";position:absolute;top:2px;left:2px;
        width:22px;height:22px;border-radius:50%;
        background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);
        transition:transform .24s var(--spring)
      }
      .vgl-sw input:checked + i{background:var(--c-verde);box-shadow:0 0 12px rgba(var(--rgb-verde),.30)}
      .vgl-sw input:checked + i:after{transform:translateX(18px)}

      /* Botones Hoja */
      .vgl-btn{
        appearance:none;border:0;border-radius:var(--r-chip);
        padding:8px 15px;font-size:13px;font-weight:600;
        cursor:pointer;color:var(--fg);background:var(--bg3);
        transition:background .15s var(--ease-out),transform .22s var(--spring),box-shadow .22s var(--ease-out);
        font-family:inherit;white-space:nowrap;
        line-height:1.4;box-shadow:var(--glow-edge);
      }
      .vgl-btn:hover{background:var(--bg4);transform:translateY(-1px)}
      .vgl-btn:active{transform:scale(.96)}
      .vgl-btn.primary{
        background:linear-gradient(150deg,rgba(var(--rgb-azul),.32),rgba(var(--rgb-azul),.15));
        color:var(--c-azul);font-weight:700;
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.40),0 4px 14px rgba(var(--rgb-azul),.18)
      }
      .vgl-btn.primary:hover{background:linear-gradient(150deg,rgba(var(--rgb-azul),.42),rgba(var(--rgb-azul),.22))}
      .vgl-btn.on{background:rgba(var(--rgb-verde),.16);color:var(--c-verde);font-weight:700;box-shadow:inset 0 0 0 1px rgba(var(--rgb-verde),.35)}
      #vgl-root:not(.light) .vgl-btn.on{color:var(--c-verde)}
      .vgl-btn.off{background:rgba(var(--rgb-rojo),.18);color:var(--c-rojo);font-weight:700;box-shadow:inset 0 0 0 1px rgba(var(--rgb-rojo),.35)}
      #vgl-root:not(.light) .vgl-btn.off{color:var(--c-rojo)}

      /* KPIs y Barras */
      .vgl-bar .vgl-lb{font-size:var(--t-micro);color:var(--fg3);font-weight:700} /* Mínimo 12px */
      .vgl-kpi .vgl-l{font-size:var(--t-micro);color:var(--fg3);margin-top:4px;font-weight:700;letter-spacing:.4px} /* Mínimo 12px */

      /* ---- Pastilla Flotante (Dock) — cápsula HUD ---- */
      /* ---- T7: banner PyM superior — nivel 2 · persistente (D5) ----
         D5: empuja el contenido de Everest (posición NORMAL/sticky, nunca fixed/absolute
         flotando por encima) — se inserta como primer hijo de document.body. D7: sin
         backdrop-filter nuevo (superficie sólida --surface-2), máximo 2 capas de sombra,
         sin animación permanente (el minimizado es un display:none instantáneo, no una
         transición de alto/max-height — D7 prohíbe animar height/width/top/left), con
         interruptor .perf propio. */
      #vgl-pym-banner{
        position:sticky;top:0;left:0;right:0;z-index:var(--z-banner);
        display:flex;flex-direction:column;
        /* v14.0.0 — BASE OPACA OBLIGATORIA, y aquí es doblemente crítico. Igual que el
           dock, el banner cuelga de document.body y no tiene el --bg de #vgl-root debajo,
           así que --surface-2 a secas (velo ~92% transparente) dejaba su fondo a merced
           de Everest: en tema oscuro sobre pantalla clara el título y los nombres de
           actividad caían a contraste 1.05. Y por ser position:sticky, al hacer scroll
           las filas clínicas de Everest se leían A TRAVÉS del banner, sobreimpresas en su
           texto — leer mal un dato clínico por transparencia es peor que un defecto
           estético. El velo va apilado SOBRE --bg-solid: mismo aspecto, fondo propio. */
        background:linear-gradient(0deg,var(--surface-2),var(--surface-2)),var(--bg-solid);
        border-bottom:1px solid var(--edge);
        box-shadow:var(--shadow-card);
        color:var(--fg);font-family:var(--font-stack);font-size:var(--t-body);
      }
      .vgl-pymb-barra{display:flex;align-items:center;gap:var(--s2);padding:var(--s2) var(--s4)}
      .vgl-pymb-titulo{font-weight:700;font-size:var(--t-strong)}
      /* v14.0.0 — INCIDENTE REAL EN CONSULTA: el banner se veía con el título y los nombres
         de actividad ilegibles, "mezclado con el CSS de Everest". Causa: al quitar el
         escudo simple "#vgl-pym-banner span{color:inherit}" para arreglar el contraste del
         contador (T8), quedaron sin protección los elementos que NO declaran color propio y
         solo lo HEREDABAN del contenedor. Y un valor heredado pierde contra CUALQUIER regla
         que apunte al elemento directamente, por poca especificidad que tenga: el
         "span{color:...}" global de Everest les pega directo y la herencia ni compite.
         Prueba viva de la mecánica: el contador y el botón Ordenar SÍ se veían, porque son
         los únicos que traen color propio.
         El arreglo NO es devolver el escudo simple —eso reventaba el contador otra vez, es
         el bucle de v12.6.6/v12.10.2— sino que cada elemento con clase declare SU color, sin
         depender de la herencia. Van acotados por el id (1,1,0) para ganarle también a
         reglas de Everest más específicas que un simple "span". */
      #vgl-pym-banner .vgl-pymb-barra,
      #vgl-pym-banner .vgl-pymb-lista,
      #vgl-pym-banner .vgl-pymb-item,
      #vgl-pym-banner .vgl-pymb-titulo,
      #vgl-pym-banner .vgl-pymb-item-nombre{color:var(--fg)}
      /* Los dos que SÍ traían color propio también suben a 1,1,0: con una clase pelada
         (0,1,0) perdían contra un ".contenedor span{color:...}" de Everest (0,1,1) —
         verificado, el contador caía a contraste 1.54 en tema claro. Su color va sobre
         fondo de acento, así que perderlo no los deja grises: los deja ilegibles. */
      #vgl-pym-banner .vgl-pymb-contador{color:var(--bg-solid)}
      #vgl-pym-banner .vgl-pymb-item-btn{color:var(--bg-solid)}
      #vgl-pym-banner .vgl-pymb-aviso{color:var(--c-ambar)}
      #vgl-pym-banner .vgl-pymb-toggle{color:var(--fg3)}
      #vgl-pym-banner .vgl-pymb-toggle:hover{color:var(--fg)}
      .vgl-pymb-contador{
        background:var(--c-ambar);color:var(--bg-solid);font-weight:800;
        border-radius:var(--r-pill);padding:1px 8px;font-size:var(--t-micro);
      }
      .vgl-pymb-toggle{
        margin-left:auto;background:transparent;border:none;color:var(--fg3);cursor:pointer;
        font-size:var(--t-body);padding:var(--s1) var(--s2);border-radius:var(--r-chip);
      }
      .vgl-pymb-toggle:hover{color:var(--fg);background:var(--surface-1)}
      .vgl-pymb-aviso{
        padding:0 var(--s4) var(--s2);color:var(--c-ambar);font-size:var(--t-micro);font-weight:600;
      }
      .vgl-pymb-lista{display:flex;flex-wrap:wrap;gap:var(--s2);padding:0 var(--s4) var(--s3)}
      .vgl-pymb-item{
        display:flex;align-items:center;gap:var(--s2);
        background:var(--surface-1);border-radius:var(--r-chip);
        padding:var(--s1) var(--s2) var(--s1) var(--s3);
        box-shadow:inset 0 0 0 1px var(--edge);
      }
      .vgl-pymb-item.vgl-pymb-item-libre{box-shadow:inset 0 0 0 1px var(--c-ambar)}
      .vgl-pymb-item-nombre{font-size:var(--t-micro)}
      .vgl-pymb-item-btn{
        background:var(--c-azul);color:var(--bg-solid);border:none;font-weight:700;
        border-radius:var(--r-chip);padding:2px 10px;font-size:var(--t-micro);cursor:pointer;
      }
      #vgl-pym-banner.minimizado .vgl-pymb-aviso,
      #vgl-pym-banner.minimizado .vgl-pymb-lista{display:none}
      #vgl-pym-banner.perf{box-shadow:none;background:var(--bg-solid)}

      #vgl-dock{
        position:fixed;bottom:22px;right:22px;z-index:var(--z-panel);
        display:none;align-items:center;gap:10px;cursor:pointer;
        padding:11px 18px;border-radius:var(--r-pill);
        background:linear-gradient(160deg,rgba(var(--rgb-azul),.08),rgba(0,0,0,0) 60%),var(--bg);
        -webkit-backdrop-filter:var(--glass);
        backdrop-filter:var(--glass);
        border:1px solid var(--edge);
        box-shadow:var(--shadow-float),inset 0 1px 0 rgba(255,255,255,.12);
        color:var(--fg);
        font-family:var(--font-stack);
        font-size:12.5px;font-weight:700;
        transition:transform .22s var(--spring),box-shadow .22s var(--ease-out)
      }
      #vgl-dock:hover{transform:translateY(-2px)}
      #vgl-dock-dot{
        width:9px;height:9px;border-radius:50%;
        background:var(--c-verde);
        box-shadow:0 0 10px rgba(var(--rgb-verde),.9) /* [UI-CSS] */
      }
      #vgl-dock b{
        background:var(--c-rojo);color:var(--bg-solid);
        border-radius:var(--r-pill);padding:1px 7px;font-size:var(--t-micro);font-weight:800;
        box-shadow:0 0 10px rgba(var(--rgb-rojo),.40) /* [UI-CSS] */
      }

      /* ---- Toasts — naipes flotantes ---- */
      #vgl-toasts{
        position:fixed;top:16px;right:16px;z-index:2147483646;
        display:flex;flex-direction:column;gap:10px;
        max-width:390px;
        font-family:var(--font-stack);
        pointer-events:none
      }
      .vgl-toast{
        display:flex;gap:12px;align-items:flex-start;
        padding:14px 15px;border-radius:var(--r-card);
        pointer-events:auto;color:var(--fg);
        background:linear-gradient(165deg,rgba(255,255,255,.05),rgba(255,255,255,0) 55%),var(--toast);
        border:1px solid var(--edge);
        box-shadow:var(--shadow-float),inset 0 1px 0 rgba(255,255,255,.10);
        animation:vglToastIn .34s var(--spring);
        cursor:pointer;
      }
      @keyframes vglToastIn{
        from{opacity:0;transform:translateX(26px) scale(.97)}
        to{opacity:1;transform:none}
      }
      .vgl-toast-ic{
        background:linear-gradient(160deg,rgba(var(--tk),.30),rgba(var(--tk),.12));box-shadow:var(--glow-edge),inset 0 0 0 1px rgba(var(--tk),.40),0 0 16px rgba(var(--tk),.25);
        width:36px;height:36px;border-radius:var(--r-chip);flex:0 0 auto;
        display:flex;align-items:center;justify-content:center;font-size:var(--t-title);
        box-shadow:var(--glow-edge)
      }
      .vgl-toast-main{flex:1;min-width:0}
      .vgl-toast-title{font-weight:700;font-size:13.5px;letter-spacing:.1px}
      .vgl-toast-b{
        font-size:12.5px;
        margin-top:3px;font-size:var(--t-micro);color:var(--fg2);
        white-space:pre-line;line-height:1.45
      }
      .vgl-toast-x{
        cursor:pointer;color:var(--fg3);font-size:var(--t-lead);
        line-height:1;padding:2px 6px;border-radius:var(--r-chip);
        transition:background .14s var(--ease-out),color .14s var(--ease-out)
      }
      .vgl-toast-x:hover{background:var(--bg4);color:var(--fg)}
      .vgl-toast.out{
        opacity:0;transform:translateX(26px) scale(.97);
        transition:opacity .25s,transform .25s
      }

      /* ---- Modales (fraude, PyM, PES) — losas de alerta ---- */
      #vgl-modal{
        position:fixed;inset:0;z-index:var(--z-alerta);
        display:flex;align-items:center;justify-content:center;
        background:rgba(2,4,9,.72);
        animation:vglToastIn .25s ease
      }
      .vgl-modal-card{
        border-color:rgba(var(--ac-rgb),.60);
        background:linear-gradient(165deg,rgba(var(--ac-rgb),.10),rgba(0,0,0,0) 55%),var(--bg-solid);
        border:1px solid rgba(var(--ac-rgb),.55);
        border-radius:var(--r-surface);padding:30px 34px;
        max-width:460px;text-align:center;
        box-shadow:var(--shadow-float),0 0 60px rgba(var(--ac-rgb),.14),inset 0 1px 0 rgba(255,255,255,.10);
        font-family:var(--font-stack);color:var(--fg)
      }
      .vgl-modal-dot{background:var(--ac);box-shadow:0 0 22px rgba(var(--ac-rgb),.85);width:18px;height:18px;border-radius:50%;margin:0 auto 14px}
      .vgl-modal-t{font-size:19px;font-weight:800;color:var(--fg) !important;margin-bottom:8px;letter-spacing:.2px}
      .vgl-modal-b{font-size:var(--t-body);color:var(--fg2) !important;white-space:pre-line;line-height:1.55}
      .vgl-modal-ok{
        background:linear-gradient(180deg,var(--ac),rgba(var(--ac-rgb),.82));color:var(--bg-solid) !important;box-shadow:0 10px 26px rgba(var(--ac-rgb),.35),inset 0 1px 0 rgba(255,255,255,.35);
        margin-top:22px;border:0;border-radius:var(--r-chip);
        padding:11px 28px;font-size:var(--t-body);font-weight:800;
        cursor:pointer;font-family:inherit;
        transition:transform .2s var(--spring),filter .15s var(--ease-out)
      }
      .vgl-modal-ok:hover{transform:scale(1.04);filter:brightness(1.08)}
      #vgl-pym-modal{
        position:fixed;inset:0;z-index:var(--z-alerta);
        display:flex;align-items:center;justify-content:center;
        background:rgba(2,4,9,.58);animation:vglToastIn .25s ease
      }
      .vgl-pym-card{
        background:linear-gradient(165deg,rgba(var(--rgb-recordatorio),.10),rgba(0,0,0,0) 55%),var(--bg-solid);
        border:1px solid rgba(var(--rgb-recordatorio),.50);
        border-radius:var(--r-surface);padding:28px 32px;
        max-width:420px;text-align:center;
        box-shadow:var(--shadow-float),0 0 54px rgba(var(--rgb-recordatorio),.13),inset 0 1px 0 rgba(255,255,255,.10);
        font-family:var(--font-stack);color:var(--fg)
      }
      .vgl-pym-ic{text-shadow:0 0 14px rgba(var(--rgb-recordatorio),.45);
        width:46px;height:46px;border-radius:var(--r-chip);margin:0 auto 12px;
        display:flex;align-items:center;justify-content:center;font-size:var(--t-hero);
        background:rgba(var(--rgb-recordatorio),.14);border:1px solid rgba(var(--rgb-recordatorio),.40);
        box-shadow:0 0 18px rgba(var(--rgb-recordatorio),.20)
      }
      .vgl-pym-t{font-size:12.5px;font-weight:800;color:var(--c-recordatorio) !important;margin-bottom:2px;letter-spacing:1.1px;text-transform:uppercase}
      .vgl-pym-n{font-size:21px;font-weight:800;color:var(--fg) !important;line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-recordatorio),.30);margin-bottom:14px}
      .vgl-pym-lead{font-size:12.5px;color:var(--fg2) !important;margin-bottom:10px}
      .vgl-pym-list{
        display:flex;flex-wrap:wrap;gap:7px;
        justify-content:center;margin-bottom:16px
      }
      .vgl-pym-chip{
        font-size:var(--t-micro);font-weight:700;padding:6px 13px;
        border-radius:var(--r-pill);
        background:rgba(var(--rgb-recordatorio),.13);color:var(--fg);
        border:1px solid rgba(var(--rgb-recordatorio),.35)
      }
      .vgl-pym-foot{font-size:var(--t-micro);color:var(--fg3) !important;margin-bottom:4px} /* [UI-CSS] */
      .vgl-pym-ok{
        border:0;border-radius:var(--r-chip);padding:10px 26px;
        font-size:13px;font-weight:800;color:var(--bg-solid);
        cursor:pointer;font-family:inherit;background:var(--c-recordatorio);
        box-shadow:0 6px 18px rgba(var(--rgb-recordatorio),.25);
        transition:transform .2s var(--spring),filter .15s var(--ease-out)
      }
      .vgl-pym-ok:hover{transform:scale(1.04);filter:brightness(1.06)}
      #vgl-pes-modal{
        position:fixed;inset:0;z-index:var(--z-alerta);
        display:flex;align-items:center;justify-content:center;
        background:rgba(2,4,9,.58);animation:vglToastIn .25s ease
      }
      .vgl-pes-card{
        background:linear-gradient(165deg,rgba(var(--rgb-pes),.10),rgba(0,0,0,0) 55%),var(--bg-solid);
        border:1px solid rgba(var(--rgb-pes),.50);
        border-radius:var(--r-surface);padding:28px 32px;
        max-width:420px;text-align:center;
        box-shadow:var(--shadow-float),0 0 54px rgba(var(--rgb-pes),.13),inset 0 1px 0 rgba(255,255,255,.10);
        font-family:var(--font-stack);color:var(--fg)
      }
      .vgl-pes-ic{text-shadow:0 0 14px rgba(var(--rgb-pes),.45);
        width:46px;height:46px;border-radius:var(--r-chip);margin:0 auto 12px;
        display:flex;align-items:center;justify-content:center;font-size:var(--t-hero);
        background:rgba(var(--rgb-pes),.14);border:1px solid rgba(var(--rgb-pes),.40);
        box-shadow:0 0 18px rgba(var(--rgb-pes),.20)
      }
      .vgl-pes-t{font-size:12.5px;font-weight:800;color:var(--c-pes) !important;margin-bottom:2px;letter-spacing:1.1px;text-transform:uppercase}
      .vgl-pes-n{font-size:21px;font-weight:800;color:var(--fg) !important;line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-pes),.30);margin-bottom:14px}
      .vgl-pes-lead{
        font-size:12.5px;color:var(--fg2) !important;margin-bottom:14px;line-height:1.55
      }
      .vgl-pes-foot{font-size:var(--t-micro);color:var(--fg3) !important;margin-bottom:4px} /* [UI-CSS] */
      .vgl-pes-ok{
        border:0;border-radius:var(--r-chip);padding:10px 26px;
        font-size:13px;font-weight:800;color:var(--bg-solid);
        cursor:pointer;font-family:inherit;background:var(--c-pes);
        box-shadow:0 6px 18px rgba(var(--rgb-pes),.25);
        transition:transform .2s var(--spring),filter .15s var(--ease-out)
      }
      .vgl-pes-ok:hover{transform:scale(1.04);filter:brightness(1.06)}
      /* v12.5.7 — Aviso de laboratorios RCV vencidos: mismo esqueleto de tarjeta que el
         de prioridad cardiovascular (.vgl-pes-*), pero con la lista de chips del
         recordatorio de PyM (.vgl-pym-*) para enumerar los analitos faltantes, y el rojo
         de alerta (--c-rojo/--rgb-rojo) en vez del rosa cardiovascular. */
      #vgl-labsv-modal{
        position:fixed;inset:0;z-index:var(--z-alerta);
        display:flex;align-items:center;justify-content:center;
        background:rgba(2,4,9,.58);animation:vglToastIn .25s ease
      }
      .vgl-labsv-card{
        background:linear-gradient(165deg,rgba(var(--rgb-rojo),.10),rgba(0,0,0,0) 55%),var(--bg-solid);
        border:1px solid rgba(var(--rgb-rojo),.50);
        border-radius:var(--r-surface);padding:28px 32px;
        max-width:420px;text-align:center;
        box-shadow:var(--shadow-float),0 0 54px rgba(var(--rgb-rojo),.13),inset 0 1px 0 rgba(255,255,255,.10);
        font-family:var(--font-stack);color:var(--fg)
      }
      .vgl-labsv-ic{text-shadow:0 0 14px rgba(var(--rgb-rojo),.45);
        width:46px;height:46px;border-radius:var(--r-chip);margin:0 auto 12px;
        display:flex;align-items:center;justify-content:center;font-size:var(--t-hero);
        background:rgba(var(--rgb-rojo),.14);border:1px solid rgba(var(--rgb-rojo),.40);
        box-shadow:0 0 18px rgba(var(--rgb-rojo),.20)
      }
      .vgl-labsv-t{font-size:12.5px;font-weight:800;color:var(--c-rojo) !important;margin-bottom:2px;letter-spacing:1.1px;text-transform:uppercase}
      .vgl-labsv-n{font-size:21px;font-weight:800;color:var(--fg) !important;line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-rojo),.30);margin-bottom:14px}
      .vgl-labsv-lead{font-size:12.5px;color:var(--fg2) !important;margin-bottom:10px}
      .vgl-labsv-list{
        display:flex;flex-wrap:wrap;gap:7px;
        justify-content:center;margin-bottom:16px
      }
      .vgl-labsv-chip{
        font-size:var(--t-micro);font-weight:700;padding:6px 13px;
        border-radius:var(--r-pill);
        background:rgba(var(--rgb-rojo),.13);color:var(--fg);
        border:1px solid rgba(var(--rgb-rojo),.35)
      }
      .vgl-labsv-foot{font-size:var(--t-micro);color:var(--fg3) !important;margin-bottom:4px} /* [UI-CSS] */
      .vgl-labsv-ok{
        border:0;border-radius:var(--r-chip);padding:10px 26px;
        font-size:13px;font-weight:800;color:var(--bg-solid);
        cursor:pointer;font-family:inherit;background:var(--c-rojo);
        box-shadow:0 6px 18px rgba(var(--rgb-rojo),.25);
        transition:transform .2s var(--spring),filter .15s var(--ease-out)
      }
      .vgl-labsv-ok:hover{transform:scale(1.04);filter:brightness(1.06)}

      /* ---- Modales de Agendamiento / Ordenamiento — placas bento ---- */
      #vgl-agendar-modal,#vgl-ordenar-modal,#vgl-labs-modal{
        position:fixed;top:0;left:0;width:100vw;height:100vh;
        background:rgba(2,4,9,.74);z-index:var(--z-modal);
        display:flex;align-items:center;justify-content:center;
        font-family:var(--font-stack);
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)
      }
      .vgl-agm-card{
        background:linear-gradient(160deg,rgba(var(--rgb-azul),.08),rgba(var(--rgb-morado),.04) 45%,rgba(0,0,0,0) 75%),var(--bg-solid);
        color:var(--fg);
        border:1px solid var(--edge);
        border-radius:var(--r-surface);width:92%;max-width:580px;
        max-height:86vh;overflow-y:auto;margin:auto;
        padding:24px;
        box-shadow:var(--shadow-float),inset 0 1px 0 rgba(255,255,255,.10);
        animation:vglSpringIn .30s var(--spring)
      }
      .vgl-agm-card::-webkit-scrollbar{width:6px}
      .vgl-agm-card::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:var(--r-pill)}
      #vgl-agendar-modal.light .vgl-agm-card,#vgl-ordenar-modal.light .vgl-agm-card,#vgl-labs-modal.light .vgl-agm-card{
        background:linear-gradient(160deg,rgba(var(--rgb-azul),.05),rgba(0,0,0,0) 60%),var(--bg-solid);
        color:var(--fg);
        border-color:var(--edge);
        box-shadow:var(--shadow-float),inset 0 1px 0 rgba(255,255,255,.85)
      }
      .vgl-agm-head{
        display:flex;justify-content:space-between;
        align-items:flex-start;margin-bottom:18px;
        border-bottom:1px solid var(--line);
        padding-bottom:14px
      }
      #vgl-agendar-modal.light .vgl-agm-head,#vgl-ordenar-modal.light .vgl-agm-head,#vgl-labs-modal.light .vgl-agm-head{border-bottom-color:var(--line)}
      .vgl-agm-title{
        font-size:var(--t-title);font-weight:800;color:var(--fg);
        display:flex;align-items:center;gap:8px;letter-spacing:.2px
      }
      #vgl-agendar-modal.light .vgl-agm-title,#vgl-ordenar-modal.light .vgl-agm-title,#vgl-labs-modal.light .vgl-agm-title{color:var(--fg)}
      .vgl-agm-sub{font-size:var(--t-body);margin-top:3px;color:var(--fg2)}
      #vgl-agendar-modal.light .vgl-agm-sub,#vgl-ordenar-modal.light .vgl-agm-sub,#vgl-labs-modal.light .vgl-agm-sub{color:var(--fg2)}
      .vgl-agm-sub b{color:var(--fg);font-weight:800}
      #vgl-agendar-modal.light .vgl-agm-sub b,#vgl-ordenar-modal.light .vgl-agm-sub b,#vgl-labs-modal.light .vgl-agm-sub b{color:var(--fg)}
      .vgl-agm-sub.med b{color:var(--c-azul)}
      #vgl-agendar-modal.light .vgl-agm-sub.med b{color:var(--c-azul)}
      .vgl-agm-close{
        background:transparent;border:0;color:var(--fg);
        font-size:var(--t-hero);font-weight:700;cursor:pointer;
        opacity:.7;padding:0 6px;border-radius:var(--r-chip);
        transition:opacity .15s var(--ease-out),color .15s var(--ease-out),transform .2s var(--spring)
      }
      #vgl-agendar-modal.light .vgl-agm-close,#vgl-ordenar-modal.light .vgl-agm-close,#vgl-labs-modal.light .vgl-agm-close{color:var(--fg)}
      .vgl-agm-close:hover{opacity:1;color:var(--c-rojo);transform:scale(1.1)}
      .vgl-agm-sec{margin-bottom:18px}
      .vgl-agm-lbl{
        font-size:var(--t-micro);font-weight:800;letter-spacing:.7px;text-transform:uppercase;
        display:block;margin-bottom:9px;color:var(--c-azul)
      }
      #vgl-agendar-modal.light .vgl-agm-lbl,#vgl-ordenar-modal.light .vgl-agm-lbl,#vgl-labs-modal.light .vgl-agm-lbl{color:var(--c-azul)}
      .vgl-agm-presets{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px}
      .vgl-agm-pbtn{
        background:var(--bg2);color:var(--fg);
        border:1px solid var(--edge);
        border-radius:var(--r-pill);padding:7px 15px;
        font-size:var(--t-micro);font-weight:600;cursor:pointer;
        transition:background .15s var(--ease-out),color .15s var(--ease-out),border-color .15s var(--ease-out),transform .2s var(--spring),box-shadow .2s var(--ease-out);
        box-shadow:var(--glow-edge)
      }
      #vgl-agendar-modal.light .vgl-agm-pbtn,#vgl-ordenar-modal.light .vgl-agm-pbtn,#vgl-labs-modal.light .vgl-agm-pbtn{
        background:var(--bg2);color:var(--fg);border-color:var(--edge)
      }
      .vgl-agm-pbtn:hover{background:var(--bg3);color:var(--fg);border-color:var(--bg4);transform:translateY(-1px)}
      #vgl-agendar-modal.light .vgl-agm-pbtn:hover,#vgl-ordenar-modal.light .vgl-agm-pbtn:hover{background:var(--bg3);border-color:var(--bg4)}
      .vgl-agm-pbtn.active{
        background:rgba(var(--rgb-azul),.22)!important;color:var(--c-azul)!important;border-color:rgba(var(--rgb-azul),.55)!important;
        font-weight:800;box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.30),0 4px 14px rgba(var(--rgb-azul),.18)
      }
      .vgl-agm-dinfo{
        font-size:var(--t-micro);color:var(--fg);
        background:rgba(var(--rgb-verde),.13);border:1px solid rgba(var(--rgb-verde),.45);
        border-radius:var(--r-field);padding:9px 13px;margin-top:7px;font-weight:600
      }
      .vgl-agm-dinfo b{color:var(--c-verde)}
      .vgl-agm-dinfo span{color:var(--c-verde)!important}
      .vgl-agm-slots{
        display:flex;gap:8px;flex-wrap:wrap;
        max-height:150px;overflow-y:auto;
        background:var(--bg2);padding:12px;
        border-radius:var(--r-field);border:1px solid var(--line);
        box-shadow:var(--glow-edge)
      }
      .vgl-agm-slots::-webkit-scrollbar{width:6px}
      .vgl-agm-slots::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:var(--r-pill)}
      #vgl-agendar-modal.light .vgl-agm-slots{
        background:var(--bg2);border-color:var(--line)
      }
      /* v12.0.0 — Estas tres clases se usaban en el modal pero NUNCA estaban definidas:
         el cartel verde de "Cita asignada exitosamente" salía sin ningún estilo y los
         botones de turno y de plazo perdían el ajuste de línea que tenían en línea. */
      .vgl-msg-success{
        background:rgba(var(--rgb-verde),.16);color:var(--c-verde);font-size:var(--t-body);font-weight:700;padding:13px;
        text-align:center;margin-top:14px;border:1px solid rgba(var(--rgb-verde),.50);border-radius:var(--r-field);
        box-shadow:0 0 22px rgba(var(--rgb-verde),.12);
      }
      .vgl-agm-sbtn.vgl-wrap{white-space:normal;text-align:left;height:auto;padding:6px 10px}
      .vgl-agm-pbtn.vgl-sm{font-size:var(--t-micro);padding:3px 9px}
      .vgl-agm-sbtn{
        background:var(--bg2);color:var(--fg);
        border:1px solid var(--edge);
        border-radius:var(--r-pill);padding:7px 14px;
        font-size:var(--t-micro);font-weight:700;
        cursor:pointer;
        transition:background .15s var(--ease-out),border-color .15s var(--ease-out),color .15s var(--ease-out),transform .2s var(--spring),box-shadow .2s var(--ease-out);
        box-shadow:var(--glow-edge)
      }
      #vgl-agendar-modal.light .vgl-agm-sbtn,#vgl-ordenar-modal.light .vgl-agm-sbtn,#vgl-labs-modal.light .vgl-agm-sbtn{
        background:var(--bg2);color:var(--fg);border-color:var(--edge)
      }
      .vgl-agm-sbtn:hover{background:var(--bg3);border-color:var(--bg4);color:var(--fg)}
      .vgl-agm-sbtn.active{
        background:rgba(var(--rgb-verde),.20)!important;color:var(--c-verde)!important;border-color:rgba(var(--rgb-verde),.60)!important;
        transform:scale(1.05);box-shadow:0 0 14px rgba(var(--rgb-verde),.25)
      }
      /* v12.10.8 — D3-bis, Eje A: insignia de horario sugerido (escala+borde, mismo
         lenguaje visual ya decidido en disenos/COMPARACION.md para "el día recomendado").
         Sin !important a propósito: si el médico la elige, .active (arriba) debe ganar y
         mostrarse como ELEGIDA, no como sugerida — la sugerencia deja de importar una vez
         que el médico decide. .active gana igual sin depender de esto: usa !important, y
         !important le gana a cualquier regla sin !important sin importar la especificidad. */
      /* v14.0.0 — El médico: «la cita sugerida debe resaltar mucho más ya que a duras penas
         se nota». Se sube el peso visual sin salirse del sistema: borde izquierdo grueso
         (el mismo recurso que ya usan las tarjetas del panel para el color de puntualidad),
         fondo más presente y contorno completo. Sigue sin preseleccionar nada. */
      .vgl-agm-sbtn-sugerido{
        background:rgba(var(--rgb-ambar),.22);color:var(--c-ambar);border-color:rgba(var(--rgb-ambar),.85);
        border-left:5px solid var(--c-ambar);font-weight:800;
        transform:scale(1.04);box-shadow:0 0 0 1px rgba(var(--rgb-ambar),.45),0 0 18px rgba(var(--rgb-ambar),.28)
      }
      /* v12.10.9 — bug real: en tema claro la insignia SUGERIDO se veía sin ningún color
         propio (texto oscuro sobre fondo casi blanco, indistinguible del resto de turnos).
         Causa: #vgl-agendar-modal.light .vgl-agm-sbtn (id+2 clases, arriba) le gana en
         especificidad a .vgl-agm-sbtn-sugerido (1 clase) y sobrescribe background/color/
         border-color de vuelta a los del botón sin elegir. Mismo patrón de colisión INTERNA
         de especificidad que T1 (ver CLAUDE.md) — no es CSS de Everest esta vez, es nuestro
         propio selector de tema claro. Se iguala la especificidad citando los mismos tres
         ids del selector que compite (id+2 clases) para ganarle por orden de declaración
         sin recurrir a !important, que rompería que .active gane al elegir con un clic. */
      #vgl-agendar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-sugerido,
      #vgl-ordenar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-sugerido,
      #vgl-labs-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-sugerido{
        background:rgba(var(--rgb-ambar),.14);color:var(--c-ambar);border-color:rgba(var(--rgb-ambar),.55)
      }
      /* v14.0.0 — La FRANJA recomendada completa, no solo la hora elegida como sugerida.
         El encargo del médico pedía las dos cosas ("se deben repintar de otro color Y
         escoger alguna de esas como sugerida"): esto es la primera. Deliberadamente MÁS
         SUAVE que la insignia ⭐ — mismo tono ámbar, sin escala ni resplandor — para que la
         jerarquía siga siendo evidente: la franja se insinúa, la sugerida manda. Nunca
         bloquea ni oculta las horas de fuera de franja: el médico elige la que quiera.
         Lleva la MISMA armadura de especificidad que la insignia por el mismo motivo, el
         bug real de v12.10.9: sin citar los tres ids,
         "#vgl-agendar-modal.light .vgl-agm-sbtn" (id+2 clases) le ganaría y en tema claro la franja no se vería. */
      .vgl-agm-sbtn-franja{
        background:rgba(var(--rgb-ambar),.07);border-color:rgba(var(--rgb-ambar),.30)
      }
      #vgl-agendar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-franja,
      #vgl-ordenar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-franja,
      #vgl-labs-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-franja{
        background:rgba(var(--rgb-ambar),.10);border-color:rgba(var(--rgb-ambar),.34)
      }
      /* v14.0.0 — CUPOS ADICIONALES (7:30/9:30/11:30/13:30/15:30/17:30 y los que Everest
         marque como tal). Color PROPIO —morado, no el ámbar de la recomendación— porque son
         un eje distinto: el ámbar dice "le conviene a este paciente", el morado dice "este
         cupo no es de la malla normal". Un turno puede ser las dos cosas a la vez, y por eso
         no pueden compartir color. El elemento visual extra que pidió el médico es la
         etiqueta "+ ADICIONAL" dentro del propio botón, no solo un tono de fondo. */
      .vgl-agm-sbtn-adicional{
        border-style:dashed;border-color:rgba(var(--rgb-morado),.60)
      }
      .vgl-agm-cupo-adic{
        display:inline-block;font-size:10px;font-weight:800;letter-spacing:.6px;
        color:var(--c-morado);background:rgba(var(--rgb-morado),.16);
        border:1px solid rgba(var(--rgb-morado),.40);border-radius:var(--r-pill);
        padding:1px 7px;margin-right:6px;vertical-align:1px
      }
      /* Desaconsejada por perfil (diabético o renal): se atenúa, NUNCA se oculta ni se
         bloquea — el médico debe poder usarla cuando no queda otra cita, que es justo el
         caso puntual que él describió. */
      .vgl-agm-sbtn-adic-no{opacity:.62}
      .vgl-agm-sbtn-adic-no .vgl-agm-cupo-adic{
        color:var(--fg3);background:rgba(var(--rgb-atendido),.16);border-color:rgba(var(--rgb-atendido),.40)
      }
      #vgl-agendar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-adicional,
      #vgl-ordenar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-adicional,
      #vgl-labs-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-adicional{
        border-style:dashed;border-color:rgba(var(--rgb-morado),.55)
      }
      /* v14.0.0 — Chip de día SÁBADO en el selector de fecha. Borde punteado (mismo
         lenguaje visual que "no es la malla normal" de los cupos adicionales, pero en su
         propio tono azul para no confundirse con ellos) mientras se confirma en segundo
         plano si el médico tiene agenda ese sábado — si no la tiene, el chip se retira
         solo y este estilo nunca llega a notarse. */
      .vgl-agm-pbtn-sabado{border-style:dashed;border-color:rgba(var(--rgb-azul),.55)}
      .vgl-agm-loading{
        font-size:var(--t-micro);color:var(--fg2);padding:6px;font-style:italic
      }
      .vgl-agm-err{
        font-size:var(--t-micro);color:var(--c-rojo); /* [UI-CSS] */
        background:rgba(var(--rgb-rojo),.13);border:1px solid rgba(var(--rgb-rojo),.35); /* [UI-CSS] */
        padding:9px 11px;border-radius:var(--r-field);font-weight:700
      }
      .vgl-agm-check-lbl{
        display:flex;align-items:center;gap:10px;
        font-size:var(--t-body);font-weight:700;margin-bottom:8px;
        cursor:pointer;color:var(--fg)
      }
      /* v12.3.20 — Sin min-width:0 el span no podía encogerse por debajo de su ancho
         intrínseco (comportamiento por defecto de los hijos flex) y el texto largo del
         checkbox de laboratorio se salía de la tarjeta en vez de partirse en varias líneas. */
      .vgl-agm-check-lbl span{min-width:0;word-break:break-word}
      .vgl-agm-input{
        width:100%;box-sizing:border-box;
        background:var(--bg2);color:var(--fg);
        border:1px solid var(--edge);
        border-radius:var(--r-field);padding:11px 13px;
        font-size:var(--t-micro);font-family:inherit;resize:none;
        box-shadow:var(--glow-edge);
        transition:border-color .16s var(--ease-out),box-shadow .16s var(--ease-out)
      }
      .vgl-agm-input:focus{
        border-color:rgba(var(--rgb-azul),.60);
        box-shadow:0 0 0 3px rgba(var(--rgb-azul),.18),var(--glow-edge);
        outline:none
      }
      #vgl-agendar-modal.light .vgl-agm-input{
        background:var(--bg2);color:var(--fg);border-color:var(--edge)
      }
      .vgl-agm-foot{
        display:flex;justify-content:flex-end;gap:12px;
        margin-top:22px;
        border-top:1px solid var(--line);padding-top:16px
      }
      #vgl-agendar-modal.light .vgl-agm-foot{border-top-color:var(--line)}
      #vgl-agendar-modal.light .vgl-agm-title, #vgl-ordenar-modal.light .vgl-agm-title{color:var(--fg)}
      #vgl-agendar-modal.light .vgl-agm-sub, #vgl-ordenar-modal.light .vgl-agm-sub{color:var(--fg2)}
      #vgl-agendar-modal.light .vgl-agm-dinfo b, #vgl-ordenar-modal.light .vgl-agm-dinfo b{color:var(--c-verde)}
      .vgl-agm-btn{
        border:0;border-radius:var(--r-chip);padding:11px 22px;
        font-size:var(--t-body);font-weight:800;cursor:pointer;
        transition:background .15s var(--ease-out),transform .2s var(--spring),box-shadow .2s var(--ease-out),color .15s var(--ease-out)
      }
      .vgl-agm-btn.sec{background:var(--bg3);color:var(--fg)}
      .vgl-agm-btn.sec:hover{background:var(--bg4)}
      .vgl-agm-btn.pri{
        background:linear-gradient(135deg,rgba(var(--rgb-verde),.30),rgba(var(--rgb-verde),.16)); /* [UI-CSS] */
        color:var(--c-verde);
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-verde),.45),0 6px 18px rgba(var(--rgb-verde),.16) /* [UI-CSS] */
      }
      .vgl-agm-btn.pri:hover{transform:translateY(-1px)}
      .vgl-agm-btn.pri:disabled{
        background:var(--bg2);color:var(--fg3);
        box-shadow:none;cursor:not-allowed;transform:none
      }

      /* v12.6.3 — Panel flotante POST-cita: reportado en consultorio, el botón de
         imprimir vivía dentro de #vgl-agendar-modal, que se autocierra 2.6 s después de
         crear la cita (setTimeout(closeMod, 2600)) — sin tiempo real de pulsarlo. Este
         panel es independiente del modal (no se cierra con él) y permanece hasta que el
         médico lo cierre a mano o pasen 5 min sin interacción. */
      #vgl-postcita-panel{
        position:fixed;bottom:18px;right:18px;z-index:2147483646;
        font-family:var(--font-stack);
        animation:vglToastIn .34s var(--spring)
      }
      .vgl-postcita-card{
        position:relative;min-width:260px;max-width:340px;
        padding:16px 18px;border-radius:var(--r-card);
        /* v12.10.2 — El médico reportó el panel "horrible" en consultorio: se veía mezclado
           con la fila de la cita en la agenda de Everest, justo debajo. Causa real: --toast
           es rgba(...,.94) — 94% opaco A PROPÓSITO para los toasts normales (dejan ver un poco
           la página, efecto vidrio), pero ese 6% de transparencia deja asomar la fila de
           Everest detrás en esta esquina concreta, donde Everest coloca sus propios botones
           "Historias Clínicas"/"Consentimientos" por cita. Esta tarjeta necesita leerse sola,
           sin nada compitiendo detrás: --bg-solid es el mismo token, ya existente en el
           proyecto, pero SIN alfa — 100% opaco. */
        background:linear-gradient(165deg,rgba(255,255,255,.05),rgba(255,255,255,0) 55%),var(--bg-solid);
        border:1px solid var(--edge);
        box-shadow:var(--shadow-float),inset 0 1px 0 rgba(255,255,255,.10);
        color:var(--fg)
      }
      .vgl-postcita-x{
        position:absolute;top:8px;right:10px;
        background:transparent;border:0;color:var(--fg3);
        font-size:var(--t-lead);cursor:pointer;line-height:1;padding:2px
      }
      .vgl-postcita-x:hover{color:var(--fg)}
      .vgl-postcita-title{font-size:var(--t-body);font-weight:800;color:var(--c-verde) !important;margin-bottom:2px}
      .vgl-postcita-sub{font-size:var(--t-micro);color:var(--fg2) !important;margin-bottom:12px}
      #vgl-postcita-panel .vgl-agm-btn{width:100%;text-align:center;box-sizing:border-box}

      /* Items de Órdenes PyM — celdas bento */
      .vgl-ord-item {
        background: linear-gradient(170deg,rgba(255,255,255,.04),rgba(255,255,255,0) 55%),var(--bg2);
        border: 1px solid var(--line);
        border-radius: var(--r-field);
        padding: 13px 15px;
        width: 100%;
        box-sizing: border-box;
        transition: background .16s var(--ease-out),border-color .16s var(--ease-out),box-shadow .2s var(--ease-out),transform .22s var(--spring);
        box-shadow: var(--glow-edge);
      }
      .vgl-ord-item:hover {
        background: linear-gradient(170deg,rgba(255,255,255,.05),rgba(255,255,255,0) 55%),var(--bg3);
        border-color: rgba(var(--rgb-azul),.50); /* [UI-CSS] */
        transform: translateY(-1px);
      }
      #vgl-agendar-modal.light .vgl-ord-item {
        background: var(--bg2);
        border-color: var(--line);
      }
      #vgl-agendar-modal.light .vgl-ord-item:hover {
        background: var(--bg3);
        border-color: rgba(var(--rgb-azul),.50);
      }
      .vgl-ord-label {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        cursor: pointer;
        width: 100%;
        box-sizing: border-box;
      }
      .vgl-ord-chk {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        margin-top: 2px;
        cursor: pointer;
        accent-color: var(--c-azul);
      }
      .vgl-ord-content {
        flex: 1 1 auto;
        min-width: 0;
      }
      .vgl-ord-title {
        color: var(--fg);
        font-size:var(--t-body);
        font-weight: 700;
        line-height: 1.45;
        word-break: break-word;
      }
      #vgl-agendar-modal.light .vgl-ord-title {
        color: var(--fg);
      }
      .vgl-ord-cie {
        color: var(--c-azul); /* [UI-CSS] */
        font-weight: 800;
        white-space: nowrap;
      }
      #vgl-agendar-modal.light .vgl-ord-cie {
        color: var(--c-azul);
      }
      .vgl-ord-cups {
        font-size: var(--t-micro); /* [UI-CSS] */
        color: var(--fg2);
        font-weight: 400;
        margin-top: 4px;
        line-height: 1.45;
        word-break: break-word;
      }
      #vgl-agendar-modal.light .vgl-ord-cups {
        color: var(--fg2);
      }

      /* ==== [v12.3.13] CSS del modal de laboratorios — antes inline en openLaboratoriosModal(); se movió aquí para inyectarse UNA vez y no re-parsearse en cada apertura ==== */
      /* ---- Cabecera: jerarquía masiva — el paciente ES el título ---- */
      #vgl-labs-modal .vgl-agm-head{align-items:center;gap:14px;border-bottom:0;padding-bottom:0;margin-bottom:14px}
      #vgl-labs-modal .vgl-labs-kicker{
        display:inline-flex;align-items:center;gap:7px;
        font-size:10.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--c-verde);background:rgba(var(--rgb-verde),.12);
        border:1px solid rgba(var(--rgb-verde),.32);border-radius:var(--r-pill);
        padding:4px 12px;margin-bottom:9px;box-shadow:0 0 18px rgba(var(--rgb-verde),.10)
      }
      #vgl-labs-modal .vgl-labs-patient{
        font-size:25px;font-weight:900;letter-spacing:-.4px;line-height:1.12;
        color:var(--fg);overflow-wrap:anywhere;
        text-shadow:0 0 30px rgba(var(--rgb-verde),.22)
      }
      #vgl-labs-modal.light .vgl-labs-patient{text-shadow:none}
      #vgl-labs-modal .vgl-agm-sub{margin-top:5px}
      #vgl-labs-modal .vgl-agm-lbl{color:var(--c-verde)}
      #vgl-labs-modal.light .vgl-agm-lbl{color:var(--c-verde)}

      /* ---- Celda bento de fuente + botón portal ---- */
      #vgl-labs-modal .vgl-labs-srcbar{
        display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;
        background:linear-gradient(165deg,rgba(var(--rgb-azul),.10),rgba(var(--rgb-azul),.02) 70%),var(--bg2);
        border:1px solid rgba(var(--rgb-azul),.28);border-radius:var(--r-card);
        padding:12px 16px;box-shadow:var(--glow-edge)
      }
      #vgl-labs-modal.light .vgl-labs-srcbar{background:rgba(var(--rgb-azul),.06)}
      #vgl-labs-modal .vgl-labs-srclbl{font-size:var(--t-micro);color:var(--fg2);line-height:1.5;min-width:0}
      #vgl-labs-modal .vgl-labs-srclbl b{color:var(--fg);font-weight:800}
      #vgl-labs-modal .vgl-labs-portal{
        text-decoration:none;display:inline-flex;align-items:center;gap:7px;
        background:linear-gradient(135deg,rgba(var(--rgb-azul),.30),rgba(var(--rgb-azul),.15));
        color:var(--c-azul);font-size:var(--t-micro);font-weight:800;
        padding:9px 16px;border-radius:var(--r-pill);
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.40),0 6px 18px rgba(var(--rgb-azul),.14);
        transition:transform .2s var(--spring),filter .15s var(--ease-out)
      }
      #vgl-labs-modal .vgl-labs-portal:hover{transform:translateY(-1px);filter:brightness(1.08)}

      /* ---- Contenedor de resultados ---- */
      #vgl-labs-modal #vgl-labs-content{background:rgba(0,0,0,.22);border-color:var(--line);padding:0 10px 10px}
      #vgl-labs-modal.light #vgl-labs-content{background:rgba(15,23,42,.035)}
      #vgl-labs-modal .vgl-agm-loading{display:flex;align-items:center;gap:10px;padding:18px 8px;font-size:13px;animation:vglLabsPulse 1.6s ease-in-out infinite}
      @keyframes vglLabsPulse{0%,100%{opacity:.55}50%{opacity:1}}
      #vgl-labs-modal .vgl-labs-empty{
        margin:10px 0 2px;background:var(--bg2);border:1px dashed var(--edge);color:var(--fg2);
        border-radius:var(--r-card);padding:22px 20px;text-align:center;
        font-size:13px;font-weight:600;line-height:1.6;box-shadow:var(--glow-edge)
      }
      #vgl-labs-modal .vgl-labs-empty b{color:var(--fg)}

      /* ---- Tabla clínica: filas respiradas, el RESULTADO manda ---- */
      /* v12.8.1 — La tabla salía ilegible en consultorio (capturas del médico): una
         palabra por línea en la columna Resultado y el resto de columnas aparentemente
         VACÍAS. Ninguna de las dos cosas era un fallo de datos; eran tres decisiones de
         CSS sumadas:
          1) La tarjeta genérica .vgl-agm-card limita a 580px — bien para un formulario,
             asfixiante para una tabla clínica de 6 columnas. Aquí se ensancha.
          2) overflow-wrap:anywhere (abajo) SÍ cuenta para el ancho mínimo intrínseco, así
             que con table-layout:auto el navegador concluía que la columna Resultado podía
             encogerse hasta un carácter. Se pasa a break-word, que NO afecta ese cálculo, y
             se fija el reparto con table-layout:fixed.
          3) vertical-align:middle centraba el contenido de las demás celdas a media altura
             de una fila de miles de píxeles: seguían ahí, pero fuera de la pantalla. Va a top. */
      #vgl-labs-modal .vgl-agm-card{max-width:1120px}
      #vgl-labs-modal .vgl-labs-table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0 7px;text-align:left}
      #vgl-labs-modal .vgl-labs-table th:nth-child(1){width:118px}
      #vgl-labs-modal .vgl-labs-table th:nth-child(2){width:23%}
      #vgl-labs-modal .vgl-labs-table th:nth-child(4){width:96px}
      #vgl-labs-modal .vgl-labs-table th:nth-child(5){width:110px}
      #vgl-labs-modal .vgl-labs-table th:nth-child(6){width:58px}
      #vgl-labs-modal .vgl-labs-table thead th{
        position:sticky;top:0;z-index:2;background:var(--bg-solid);
        font-size:10.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;
        color:var(--fg3);text-align:left;padding:12px 12px 9px;
        border-bottom:1px solid var(--edge)
      }
      #vgl-labs-modal .vgl-labs-tr td{
        background:var(--bg2);padding:11px 12px;vertical-align:top;
        transition:background-color .15s var(--ease-out)
      }
      #vgl-labs-modal .vgl-labs-tr td:first-child{border-radius:var(--r-field) 0 0 var(--r-field)}
      #vgl-labs-modal .vgl-labs-tr td:last-child{border-radius:0 var(--r-field) var(--r-field) 0}
      #vgl-labs-modal .vgl-labs-tr:hover td{background:var(--bg3)}
      #vgl-labs-modal .vgl-labs-date{font-size:11.5px;color:var(--fg3);font-variant-numeric:tabular-nums;white-space:nowrap}
      #vgl-labs-modal .vgl-labs-exam{font-size:13px;font-weight:700;color:var(--fg);overflow-wrap:break-word}
      #vgl-labs-modal .vgl-labs-val{
        font-size:15.5px;font-weight:900;letter-spacing:-.2px;color:var(--fg);
        font-variant-numeric:tabular-nums;overflow-wrap:break-word
      }
      #vgl-labs-modal .vgl-labs-ref{font-size:11px;color:var(--fg3);overflow-wrap:break-word}
      /* v12.8.1 — Panel multiparamétrico (uroanálisis): un uroanálisis son ~30 parámetros,
         no un valor único. En rejilla auto-ajustable ocupan 2–4 columnas según el ancho
         disponible y la fila deja de medir varias pantallas. Tipografía de DATO, no de
         titular: el 15.5px/900 de .vgl-labs-val es para un valor suelto, no para 30. */
      /* v14.0.1 — Reportado en consultorio EN VIVO con pantallazo: la rejilla desbordaba
         horizontalmente la celda (minmax(198px,...) es un MÍNIMO de pista — con menos
         ancho disponible que eso, la rejilla fuerza el desborde en vez de encogerse, que es
         justo lo que se vio: barra de scroll horizontal y la columna "Informe" cortada).
         Se baja el mínimo a 150px (encoge mejor en modales angostos) y se añade separación
         vertical explícita entre filas (antes 0, todo pegado contra el borde de abajo). El
         principal culpable de lo amontonado era la falta de deduplicación de arriba —
         menos ítems, aunque envuelvan en 2-3 líneas, ya se leen con claridad. */
      #vgl-labs-modal .vgl-labs-uro{
        display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
        gap:6px 18px;font-size:var(--t-micro);font-weight:600;letter-spacing:0
      }
      #vgl-labs-modal .vgl-labs-uro-i{
        min-width:0;overflow-wrap:break-word;line-height:1.5;
        padding:3px 0;border-bottom:1px solid var(--line)
      }
      #vgl-labs-modal .vgl-labs-uro-i b{color:var(--fg3);font-weight:800;font-size:11.5px}
      /* v14.1.1 (R1b) — recuadro de función renal. Superficie propia para que se lea como
         un resumen y no como una fila más de la tabla de resultados. */
      #vgl-labs-modal .vgl-labs-renal{
        background:var(--surface-1);border:1px solid var(--edge);border-radius:var(--r-card);
        padding:10px 12px;display:flex;flex-direction:column;gap:5px
      }
      #vgl-labs-modal .vgl-labs-renal-top{
        display:flex;align-items:center;gap:9px;flex-wrap:wrap;
        font-size:var(--t-body);color:var(--fg) !important
      }
      #vgl-labs-modal .vgl-labs-renal-tfg{font-weight:800;font-variant-numeric:tabular-nums;color:var(--fg) !important}
      #vgl-labs-modal .vgl-labs-renal-estadio{
        font-weight:800;letter-spacing:.4px;padding:2px 9px;border-radius:var(--r-chip);
        background:rgba(var(--rgb-azul),.16);color:var(--c-azul) !important;
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.32)
      }
      #vgl-labs-modal .vgl-labs-renal-det{font-size:var(--t-micro);color:var(--fg2) !important;line-height:1.5}
      #vgl-labs-modal .vgl-labs-renal-aviso{font-size:var(--t-micro);color:var(--c-ambar) !important;line-height:1.45}
      #vgl-labs-modal .vgl-labs-renal-vacio{font-size:var(--t-micro);color:var(--fg2) !important;line-height:1.5}
      #vgl-labs-modal .vgl-labs-src{
        display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
        font-size:10.5px;font-weight:800;letter-spacing:.4px;
        padding:4px 10px;border-radius:var(--r-pill);
        background:var(--bg3);color:var(--fg2);box-shadow:var(--glow-edge)
      }
      #vgl-labs-modal .vgl-labs-src.athenea{
        background:rgba(var(--rgb-azul),.16);color:var(--c-azul);
        box-shadow:inset 0 0 0 1px rgba(var(--rgb-azul),.38),0 0 14px rgba(var(--rgb-azul),.10)
      }
      /* v12.5.4 — Botón "Ver informe" (PDF real de Athenea) */
      #vgl-labs-modal .vgl-labs-pdfcol{text-align:center;width:1%}
      #vgl-labs-modal .vgl-labs-pdf{
        all:unset;cursor:pointer;font-size:var(--t-lead);padding:4px 8px;border-radius:var(--r-chip);
        transition:transform .15s var(--ease-out),background .15s var(--ease-out)
      }
      #vgl-labs-modal .vgl-labs-pdf:hover{background:var(--bg3);transform:scale(1.12)}
      #vgl-labs-modal .vgl-labs-pdf:disabled{opacity:.5;cursor:wait}

      /* ---- Alerta roja neón: SOLO donde la fuente lo declara ---- */
      #vgl-labs-modal .vgl-labs-tr.vgl-labs-alert td{background:rgba(var(--rgb-rojo),.10)}
      #vgl-labs-modal .vgl-labs-tr.vgl-labs-alert:hover td{background:rgba(var(--rgb-rojo),.15)}
      #vgl-labs-modal .vgl-labs-tr.vgl-labs-alert td:first-child{box-shadow:inset 3px 0 0 var(--c-rojo)}
      #vgl-labs-modal .vgl-labs-alert .vgl-labs-val{color:var(--c-rojo);text-shadow:0 0 16px rgba(var(--rgb-rojo),.50)}
      #vgl-labs-modal.light .vgl-labs-alert .vgl-labs-val{text-shadow:none}
      #vgl-labs-modal .vgl-labs-alert .vgl-labs-val::before{content:"▲ ";font-size:10px;vertical-align:2px}

      @media (prefers-reduced-motion:reduce){
        #vgl-labs-modal,#vgl-labs-modal *{animation:none!important;transition:none!important}
      }

      /* ---- MODO RENDIMIENTO: cero efectos pesados nuevos ---- */
      #vgl-root.perf~#vgl-labs-modal,
      #vgl-root.perf~#vgl-labs-modal *,
      #vgl-root.perf~#vgl-labs-modal *::before,
      #vgl-root.perf~#vgl-labs-modal *::after{
        animation:none!important;transition:none!important;
        backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
        filter:none!important;text-shadow:none!important
      }
      #vgl-root.perf~#vgl-labs-modal{background:rgba(2,4,9,.86)}
      #vgl-root.perf~#vgl-labs-modal .vgl-agm-card{box-shadow:0 0 0 1px var(--edge),0 16px 44px rgba(0,0,0,.50)}
      #vgl-root.perf~#vgl-labs-modal .vgl-labs-srcbar,
      #vgl-root.perf~#vgl-labs-modal .vgl-labs-src,
      #vgl-root.perf~#vgl-labs-modal .vgl-labs-empty,
      #vgl-root.perf~#vgl-labs-modal .vgl-labs-kicker,
      #vgl-root.perf~#vgl-labs-modal .vgl-labs-portal{box-shadow:none}
      #vgl-root.perf~#vgl-labs-modal .vgl-labs-portal:hover{transform:none}

      /* ==== [v12.3.13] CSS del modal de agendamiento — antes inline en openAgendamientoModal(); se movió aquí para inyectarse UNA vez y no re-parsearse en cada apertura ==== */
      /* ---- Bento grid (micro-grilla asimétrica 12 col) ---- */
      #vgl-agendar-modal .vgl-agm-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;align-items:stretch}
      #vgl-agendar-modal .vgl-agm-c5{grid-column:span 5}
      #vgl-agendar-modal .vgl-agm-c6{grid-column:span 6}
      #vgl-agendar-modal .vgl-agm-c7{grid-column:span 7}
      #vgl-agendar-modal .vgl-agm-c12{grid-column:span 12}
      @media (max-width:640px){
        #vgl-agendar-modal .vgl-agm-c5,#vgl-agendar-modal .vgl-agm-c6,#vgl-agendar-modal .vgl-agm-c7{grid-column:span 12}
      }
      #vgl-agendar-modal .vgl-agm-cell{
        background:linear-gradient(165deg,rgba(255,255,255,.05),rgba(255,255,255,0) 62%),var(--bg2);
        border:1px solid var(--line);border-radius:var(--r-card);padding:16px;min-width:0;
        box-shadow:var(--glow-edge);
        transition:border-color .18s var(--ease-out),box-shadow .22s var(--ease-out),transform .22s var(--spring)
      }
      #vgl-agendar-modal .vgl-agm-cell:hover{border-color:var(--edge);box-shadow:var(--shadow-card)}
      #vgl-agendar-modal.light .vgl-agm-cell{background:var(--bg2)}
      #vgl-agendar-modal .vgl-agm-cell .vgl-agm-presets:last-child{margin-bottom:0}
      #vgl-agendar-modal .vgl-agm-cell.vgl-agm-cell-flat {padding:13px 16px}

      /* ---- Cabecera: jerarquía masiva — el paciente ES el título ---- */
      #vgl-agendar-modal .vgl-agm-head{align-items:center;gap:14px;border-bottom:0;padding-bottom:0;margin-bottom:16px}
      #vgl-agendar-modal .vgl-agm-kicker{
        display:inline-flex;align-items:center;gap:7px;
        font-size:10.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--c-azul);background:rgba(var(--rgb-azul),.12);
        border:1px solid rgba(var(--rgb-azul),.32);border-radius:var(--r-pill);
        padding:4px 12px;margin-bottom:9px;box-shadow:0 0 18px rgba(var(--rgb-azul),.10)
      }
      #vgl-agendar-modal .vgl-agm-patient{
        font-size:25px;font-weight:900;letter-spacing:-.4px;line-height:1.12;
        color:var(--fg);overflow-wrap:anywhere;
        text-shadow:0 0 30px rgba(var(--rgb-azul),.25)
      }
      #vgl-agendar-modal.light .vgl-agm-patient{text-shadow:none}
      #vgl-agendar-modal .vgl-agm-sub{margin-top:5px}

      /* ---- Pasos numerados como fichas ---- */
      #vgl-agendar-modal .vgl-agm-lbl{display:flex;align-items:center;gap:8px;margin-bottom:10px}
      #vgl-agendar-modal .vgl-agm-step{
        flex:none;display:inline-flex;align-items:center;justify-content:center;
        width:21px;height:21px;border-radius:var(--r-pill);
        font-size:11px;font-weight:900;color:var(--c-azul);
        background:rgba(var(--rgb-azul),.15);border:1px solid rgba(var(--rgb-azul),.42);
        box-shadow:0 0 12px rgba(var(--rgb-azul),.14)
      }

      /* ---- Horarios como grilla de losetas ---- */
      #vgl-agendar-modal .vgl-agm-slots{
        display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:9px;
        max-height:224px;padding:12px;border-radius:var(--r-field)
      }
      #vgl-agendar-modal .vgl-agm-slots .vgl-agm-loading,
      #vgl-agendar-modal .vgl-agm-slots .vgl-agm-err{grid-column:1/-1}
      #vgl-agendar-modal .vgl-agm-sbtn{
        border-radius:var(--r-field);padding:9px 11px;min-height:38px;
        white-space:normal;line-height:1.4;text-align:center
      }
      #vgl-agendar-modal .vgl-agm-sbtn.active{transform:scale(1.02)}

      /* ---- Celdas bento SMS (azul) y Laboratorio (verde) ---- */
      #vgl-agendar-modal .vgl-agm-cell.vgl-agm-cell-sms {
        background:linear-gradient(165deg,rgba(var(--rgb-azul),.16),rgba(var(--rgb-azul),.03) 72%),var(--bg2);
        border-color:rgba(var(--rgb-azul),.36);
        box-shadow:var(--glow-edge),0 0 26px rgba(var(--rgb-azul),.08)
      }
      #vgl-agendar-modal .vgl-agm-cell.vgl-agm-cell-sms:hover {border-color:rgba(var(--rgb-azul),.55);transform:translateY(-1px)}
      #vgl-agendar-modal .vgl-agm-cell.vgl-agm-cell-lab {
        background:linear-gradient(165deg,rgba(var(--rgb-verde),.15),rgba(var(--rgb-verde),.03) 72%),var(--bg2);
        border-color:rgba(var(--rgb-verde),.34);
        box-shadow:var(--glow-edge),0 0 26px rgba(var(--rgb-verde),.08)
      }
      #vgl-agendar-modal .vgl-agm-cell.vgl-agm-cell-lab:hover {border-color:rgba(var(--rgb-verde),.52);transform:translateY(-1px)}
      #vgl-agendar-modal.light .vgl-agm-cell.vgl-agm-cell-sms {background:rgba(var(--rgb-azul),.07)}
      #vgl-agendar-modal.light .vgl-agm-cell.vgl-agm-cell-lab {background:rgba(var(--rgb-verde),.07)}
      /* v12.3.x — Se extiende a #vgl-ordenar-modal (antes solo agendar) para la sección de
         envío de la orden por correo: mismo layout de fila, sin duplicar la regla. */
      #vgl-agendar-modal .vgl-agm-fieldrow, #vgl-ordenar-modal .vgl-agm-fieldrow{
        display:flex;align-items:center;gap:8px;flex-wrap:wrap;
        margin-top:8px;font-size:var(--t-micro);color:var(--fg2)
      }
      #vgl-agendar-modal .vgl-agm-fieldrow>label, #vgl-ordenar-modal .vgl-agm-fieldrow>label{
        flex:none;font-weight:800;font-size:11px;letter-spacing:.6px;
        text-transform:uppercase;color:var(--c-azul)
      }
      #vgl-agendar-modal .vgl-agm-cell-lab .vgl-agm-fieldrow>label{color:var(--c-verde)}
      #vgl-agendar-modal #vgl-agm-sms-nota{font-size:11.5px;font-style:italic;color:var(--fg3)}
      #vgl-agendar-modal .vgl-agm-lab-sms-nota{font-size:11.5px;font-style:italic;color:var(--fg3);margin:2px 0 6px}
      #vgl-agendar-modal #vgl-lab-date-lbl{color:var(--c-verde)}
      #vgl-agendar-modal .vgl-agm-check-lbl{margin-bottom:0}
      #vgl-agendar-modal .vgl-agm-check-lbl input[type=checkbox]{width:17px;height:17px;flex:none;accent-color:var(--c-azul)}
      #vgl-agendar-modal .vgl-agm-cell-lab .vgl-agm-check-lbl input[type=checkbox]{accent-color:var(--c-verde)}
      #vgl-agendar-modal #vgl-agm-obs{border-radius:var(--r-card);padding:13px 15px;min-height:58px}

      /* ---- Pie flotante (sticky glass) ---- */
      #vgl-agendar-modal .vgl-agm-foot{
        position:sticky;bottom:10px;z-index:5;
        margin:18px 2px 2px;padding:12px 14px;
        background:var(--bg);
        border:1px solid var(--edge);border-radius:var(--r-card);
        backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);
        box-shadow:var(--shadow-float)
      }
      @supports not ((backdrop-filter:blur(4px)) or (-webkit-backdrop-filter:blur(4px))){
        #vgl-agendar-modal .vgl-agm-foot{background:var(--bg-solid)}
      }

      /* ---- MODO RENDIMIENTO: cero efectos pesados nuevos ---- */
      #vgl-root.perf~#vgl-agendar-modal,
      #vgl-root.perf~#vgl-agendar-modal *,
      #vgl-root.perf~#vgl-agendar-modal *::before,
      #vgl-root.perf~#vgl-agendar-modal *::after{
        animation:none!important;transition:none!important;
        backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
        filter:none!important;text-shadow:none!important
      }
      #vgl-root.perf~#vgl-agendar-modal{background:rgba(2,4,9,.86)}
      #vgl-root.perf~#vgl-agendar-modal .vgl-agm-card{box-shadow:0 0 0 1px var(--edge),0 16px 44px rgba(0,0,0,.50)}
      #vgl-root.perf~#vgl-agendar-modal .vgl-agm-cell,
      #vgl-root.perf~#vgl-agendar-modal .vgl-agm-cell:hover{box-shadow:none;transform:none}
      #vgl-root.perf~#vgl-agendar-modal .vgl-agm-foot{background:var(--bg-solid);box-shadow:0 0 0 1px var(--edge)}

      /* ==== [v12.3.13] CSS del modal de ordenamiento PyM — antes inline en openOrdenamientoModal(); se movió aquí para inyectarse UNA vez y no re-parsearse en cada apertura ==== */
      /* ---- Cabecera: jerarquía masiva — el paciente ES el título ---- */
      #vgl-ordenar-modal .vgl-agm-head{align-items:center;gap:14px;border-bottom:0;padding-bottom:0;margin-bottom:16px}
      #vgl-ordenar-modal .vgl-agm-kicker{
        display:inline-flex;align-items:center;gap:7px;
        font-size:10.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--c-morado);background:rgba(var(--rgb-morado),.12);
        border:1px solid rgba(var(--rgb-morado),.32);border-radius:var(--r-pill);
        padding:4px 12px;margin-bottom:9px;box-shadow:0 0 18px rgba(var(--rgb-morado),.10)
      }
      #vgl-ordenar-modal .vgl-agm-patient{
        font-size:25px;font-weight:900;letter-spacing:-.4px;line-height:1.12;
        color:var(--fg);overflow-wrap:anywhere;
        text-shadow:0 0 30px rgba(var(--rgb-morado),.25)
      }
      #vgl-ordenar-modal.light .vgl-agm-patient{text-shadow:none}
      #vgl-ordenar-modal .vgl-agm-sub{margin-top:5px}

      /* ---- Rótulo de sección con ficha de conteo ---- */
      #vgl-ordenar-modal .vgl-agm-lbl{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:var(--c-morado)}
      #vgl-ordenar-modal .vgl-agm-step{
        flex:none;display:inline-flex;align-items:center;justify-content:center;
        min-width:21px;height:21px;padding:0 6px;border-radius:var(--r-pill);
        font-size:11px;font-weight:900;color:var(--c-morado);
        background:rgba(var(--rgb-morado),.15);border:1px solid rgba(var(--rgb-morado),.42);
        box-shadow:0 0 12px rgba(var(--rgb-morado),.14)
      }

      /* ---- Lista de actividades como micro-grilla bento ---- */
      #vgl-ordenar-modal #vgl-ord-list{
        display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;
        align-items:stretch;max-height:340px;overflow-y:auto;padding:4px 4px 8px
      }
      #vgl-ordenar-modal #vgl-ord-list::-webkit-scrollbar{width:6px}
      #vgl-ordenar-modal #vgl-ord-list::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:var(--r-pill)}
      #vgl-ordenar-modal .vgl-ord-item{
        height:100%;border-radius:var(--r-card);padding:13px 14px;
        transition:background .16s var(--ease-out),border-color .16s var(--ease-out),box-shadow .2s var(--ease-out),transform .22s var(--spring)
      }
      #vgl-ordenar-modal .vgl-ord-item:hover{
        border-color:rgba(var(--rgb-morado),.50);box-shadow:var(--shadow-card);transform:translateY(-1px)
      }
      /* Marcada para generar => celda respira en VERDE (mismo color del botón primario) */
      #vgl-ordenar-modal .vgl-ord-item:has(.vgl-ord-chk:checked){
        background:linear-gradient(165deg,rgba(var(--rgb-verde),.14),rgba(var(--rgb-verde),.03) 70%),var(--bg2);
        border-color:rgba(var(--rgb-verde),.45);
        box-shadow:var(--glow-edge),0 0 22px rgba(var(--rgb-verde),.10)
      }
      #vgl-ordenar-modal .vgl-ord-item:has(.vgl-ord-chk:disabled){opacity:.55}
      /* Borde transparente de reserva: cuando el JS pinta el borde rojo de fallo
         sobre el label, no hay salto de layout */
      #vgl-ordenar-modal .vgl-ord-label{gap:11px;border:1px solid transparent;border-radius:var(--r-field);padding:1px}
      #vgl-ordenar-modal .vgl-ord-chk{width:19px;height:19px;accent-color:var(--c-verde)}
      #vgl-ordenar-modal .vgl-ord-chk:focus-visible{outline:2px solid rgba(var(--rgb-verde),.80);outline-offset:2px;border-radius:4px}
      #vgl-ordenar-modal .vgl-ord-title{font-size:var(--t-body);line-height:1.4}
      #vgl-ordenar-modal .vgl-ord-cie{
        display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.5px;
        color:var(--c-morado);background:rgba(var(--rgb-morado),.13);
        border:1px solid rgba(var(--rgb-morado),.35);border-radius:var(--r-pill);
        padding:1px 8px;margin-left:2px;white-space:nowrap;vertical-align:1px
      }
      /* CUPS como chips pastilla */
      #vgl-ordenar-modal .vgl-ord-cups{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-top:8px}
      #vgl-ordenar-modal .vgl-ord-cupk{
        flex:none;font-size:9.5px;font-weight:800;letter-spacing:1.2px;
        text-transform:uppercase;color:var(--fg3)
      }
      #vgl-ordenar-modal .vgl-ord-cup{
        display:inline-flex;align-items:baseline;gap:5px;min-width:0;
        font-size:11px;font-weight:600;line-height:1.35;color:var(--fg2);
        background:var(--bg2);border:1px solid var(--line);
        border-radius:var(--r-field);padding:2px 9px;box-shadow:var(--glow-edge)
      }
      #vgl-ordenar-modal .vgl-ord-cup b{flex:none;color:var(--c-azul);font-weight:800;letter-spacing:.3px}
      /* Aviso de actividad propia del otro sexo — chip ROJO neón-pastel */
      /* v12.3.x — Caption de trazabilidad: qué actividad REAL del Excel de PyM disparó
         cada paquete sugerido. Mismo tratamiento visual que .vgl-ord-sexwarn, en acento
         morado informativo (no es una advertencia, es la fuente del dato). */
      #vgl-ordenar-modal .vgl-ord-pymsrc{
        font-size:11.5px;font-weight:700;line-height:1.45;
        color:var(--c-morado);background:rgba(var(--rgb-morado),.13);
        border:1px solid rgba(var(--rgb-morado),.35);border-radius:var(--r-field);
        padding:7px 10px;margin-top:8px;
      }
      #vgl-ordenar-modal .vgl-ord-sexwarn{
        font-size:11.5px;font-weight:700;line-height:1.45;
        color:var(--c-rojo);background:rgba(var(--rgb-rojo),.13);
        border:1px solid rgba(var(--rgb-rojo),.40);border-radius:var(--r-field);
        padding:7px 10px;margin-top:8px;
        box-shadow:0 0 16px rgba(var(--rgb-rojo),.10)
      }
      /* v14.0.0 — Cruce antiduplicado (D4): aviso de que YA hay una orden vigente en
         Everest para este paquete. Verde, no rojo: no es un error ni un bloqueo, es
         información positiva ("esto ya está cubierto") — mismo tratamiento visual que
         .vgl-ord-sexwarn/.vgl-ord-pymsrc, solo cambia el acento de color. */
      #vgl-ordenar-modal .vgl-ord-vigwarn{
        font-size:11.5px;font-weight:700;line-height:1.45;
        color:var(--c-verde);background:rgba(var(--rgb-verde),.13);
        border:1px solid rgba(var(--rgb-verde),.35);border-radius:var(--r-field);
        padding:7px 10px;margin-top:8px;
      }

      /* ---- Pie flotante (sticky glass) ---- */
      #vgl-ordenar-modal .vgl-agm-foot{
        position:sticky;bottom:10px;z-index:5;
        margin:18px 2px 2px;padding:12px 14px;
        background:var(--bg);
        border:1px solid var(--edge);border-radius:var(--r-card);
        backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);
        box-shadow:var(--shadow-float)
      }
      @supports not ((backdrop-filter:blur(4px)) or (-webkit-backdrop-filter:blur(4px))){
        #vgl-ordenar-modal .vgl-agm-foot{background:var(--bg-solid)}
      }

      /* ---- MODO RENDIMIENTO: cero efectos pesados nuevos ---- */
      #vgl-root.perf~#vgl-ordenar-modal,
      #vgl-root.perf~#vgl-ordenar-modal *,
      #vgl-root.perf~#vgl-ordenar-modal *::before,
      #vgl-root.perf~#vgl-ordenar-modal *::after{
        animation:none!important;transition:none!important;
        backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
        filter:none!important;text-shadow:none!important
      }
      #vgl-root.perf~#vgl-ordenar-modal{background:rgba(2,4,9,.86)}
      #vgl-root.perf~#vgl-ordenar-modal .vgl-agm-card{box-shadow:0 0 0 1px var(--edge),0 16px 44px rgba(0,0,0,.50)}
      #vgl-root.perf~#vgl-ordenar-modal .vgl-ord-item,
      #vgl-root.perf~#vgl-ordenar-modal .vgl-ord-item:hover,
      #vgl-root.perf~#vgl-ordenar-modal .vgl-ord-item:has(.vgl-ord-chk:checked),
      #vgl-root.perf~#vgl-ordenar-modal .vgl-ord-cup{box-shadow:none;transform:none}
      #vgl-root.perf~#vgl-ordenar-modal .vgl-ord-sexwarn{box-shadow:none}
      #vgl-root.perf~#vgl-ordenar-modal .vgl-agm-foot{background:var(--bg-solid);box-shadow:0 0 0 1px var(--edge)}

      /* ==== [v12.3.13] CSS del cartel modal de alerta (bigAlert) — antes inline en cada innerHTML; se movió aquí para inyectarse UNA vez y no re-parsearse en cada alerta. El color del estado NO se interpola en el CSS: el elemento raíz del cartel lo fija inline como custom property (--ac / --ac-rgb) y estas reglas lo consumen con var(), así el estilo computado queda idéntico ==== */
      /* Frost sobre Everest + entrada spring; todo se apaga en .perf y reduced-motion */
      #vgl-modal{backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%)}
      @keyframes vglModalPop{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:none}}
      @keyframes vglModalBeacon{
        0%,100%{box-shadow:0 0 0 0 rgba(var(--ac-rgb),.50),0 0 22px rgba(var(--ac-rgb),.85)}
        50%{box-shadow:0 0 0 14px rgba(var(--ac-rgb),0),0 0 30px rgba(var(--ac-rgb),.95)}
      }
      #vgl-modal .vgl-modal-card{
        animation:vglModalPop .44s var(--spring) both;
        background:linear-gradient(165deg,rgba(var(--ac-rgb),.16),rgba(0,0,0,0) 55%),var(--bg-solid);
        box-shadow:var(--shadow-float),0 0 90px rgba(var(--ac-rgb),.22),var(--glow-edge);
      }
      #vgl-modal .vgl-modal-dot{animation:vglModalBeacon 1.6s ease-in-out infinite}
      #vgl-modal .vgl-modal-t{font-size:var(--t-hero);letter-spacing:.3px}
      #vgl-modal .vgl-modal-b{font-size:var(--t-strong)}
      #vgl-modal .vgl-modal-ok:focus-visible{outline:2px solid var(--ac);outline-offset:3px}
      #vgl-root.perf~#vgl-modal,#vgl-root.perf~#vgl-modal *{
        animation:none !important;transition:none !important;
        backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
        text-shadow:none !important;
      }
      #vgl-root.perf~#vgl-modal .vgl-modal-card{box-shadow:0 0 0 1px rgba(var(--ac-rgb),.55),0 16px 44px rgba(0,0,0,.50) !important}
      #vgl-root.perf~#vgl-modal .vgl-modal-dot,
      #vgl-root.perf~#vgl-modal .vgl-modal-ok{box-shadow:none !important}
      @media (prefers-reduced-motion:reduce){
        #vgl-modal,#vgl-modal *{animation:none !important;transition:none !important}
      }

      /* ==== [v12.3.13] CSS del recordatorio modal de PyM (pymAlert) — antes inline en cada innerHTML; se movió aquí para inyectarse UNA vez y no re-parsearse en cada apertura ==== */
      /* Frost + entrada spring; jerarquía: el nombre del paciente manda. Apagado en .perf/reduced-motion */
      #vgl-pym-modal{backdrop-filter:blur(12px) saturate(140%);-webkit-backdrop-filter:blur(12px) saturate(140%)}
      @keyframes vglPymPop{from{opacity:0;transform:translateY(22px) scale(.93)}to{opacity:1;transform:none}}
      #vgl-pym-modal .vgl-pym-card{animation:vglPymPop .42s var(--spring) both}
      #vgl-pym-modal .vgl-pym-chip{transition:transform .18s var(--spring),box-shadow .18s var(--ease-out),background .18s var(--ease-out)}
      #vgl-pym-modal .vgl-pym-chip:hover{
        transform:translateY(-2px) scale(1.04);
        background:rgba(var(--rgb-recordatorio),.22);
        box-shadow:0 4px 14px rgba(var(--rgb-recordatorio),.28);
      }
      #vgl-pym-modal .vgl-pym-ok:focus-visible{outline:2px solid var(--c-recordatorio);outline-offset:3px}
      #vgl-root.perf~#vgl-pym-modal,#vgl-root.perf~#vgl-pym-modal *{
        animation:none !important;transition:none !important;
        backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
        text-shadow:none !important;
      }
      #vgl-root.perf~#vgl-pym-modal .vgl-pym-card{box-shadow:0 0 0 1px rgba(var(--rgb-recordatorio),.45),0 16px 44px rgba(0,0,0,.50) !important}
      #vgl-root.perf~#vgl-pym-modal .vgl-pym-ic,
      #vgl-root.perf~#vgl-pym-modal .vgl-pym-chip,
      #vgl-root.perf~#vgl-pym-modal .vgl-pym-chip:hover,
      #vgl-root.perf~#vgl-pym-modal .vgl-pym-ok{box-shadow:none !important;transform:none !important}
      @media (prefers-reduced-motion:reduce){
        #vgl-pym-modal,#vgl-pym-modal *{animation:none !important;transition:none !important}
      }

      /* ==== [v12.3.13] CSS de la alerta de prioridad cardiovascular (abandonoPESAlert) — antes inline en cada innerHTML; se movió aquí para inyectarse UNA vez y no re-parsearse en cada apertura ==== */
      /* Frost + entrada spring + latido del icono; jerarquía: nombre del paciente arriba de todo. Apagado en .perf/reduced-motion */
      #vgl-pes-modal{backdrop-filter:blur(12px) saturate(140%);-webkit-backdrop-filter:blur(12px) saturate(140%)}
      @keyframes vglPesPop{from{opacity:0;transform:translateY(22px) scale(.93)}to{opacity:1;transform:none}}
      @keyframes vglPesBeat{
        0%,100%{transform:scale(1)}
        12%{transform:scale(1.14)}
        24%{transform:scale(1)}
        36%{transform:scale(1.08)}
        48%{transform:scale(1)}
      }
      #vgl-pes-modal .vgl-pes-card{animation:vglPesPop .42s var(--spring) both}
      #vgl-pes-modal .vgl-pes-ic{text-shadow:0 0 14px rgba(var(--rgb-pes),.45);animation:vglPesBeat 1.8s ease-in-out .5s infinite}
      #vgl-pes-modal .vgl-pes-ok:focus-visible{outline:2px solid var(--c-pes);outline-offset:3px}
      #vgl-root.perf~#vgl-pes-modal,#vgl-root.perf~#vgl-pes-modal *{
        animation:none !important;transition:none !important;
        backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
        text-shadow:none !important;
      }
      #vgl-root.perf~#vgl-pes-modal .vgl-pes-card{box-shadow:0 0 0 1px rgba(var(--rgb-pes),.45),0 16px 44px rgba(0,0,0,.50) !important}
      #vgl-root.perf~#vgl-pes-modal .vgl-pes-ic,
      #vgl-root.perf~#vgl-pes-modal .vgl-pes-ok{box-shadow:none !important;transform:none !important}
      @media (prefers-reduced-motion:reduce){
        #vgl-pes-modal,#vgl-pes-modal *{animation:none !important;transition:none !important}
      }
      /* v12.5.7 — Mismas animaciones ya definidas arriba (vglPesPop/vglPesBeat son
         genéricas, no específicas de PES): se reutilizan aquí, sin duplicar keyframes. */
      #vgl-labsv-modal .vgl-labsv-card{animation:vglPesPop .42s var(--spring) both}
      #vgl-labsv-modal .vgl-labsv-ic{text-shadow:0 0 14px rgba(var(--rgb-rojo),.45);animation:vglPesBeat 1.8s ease-in-out .5s infinite}
      #vgl-labsv-modal .vgl-labsv-ok:focus-visible{outline:2px solid var(--c-rojo);outline-offset:3px}
      #vgl-root.perf~#vgl-labsv-modal,#vgl-root.perf~#vgl-labsv-modal *{
        animation:none !important;transition:none !important;
        backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
        text-shadow:none !important;
      }
      #vgl-root.perf~#vgl-labsv-modal .vgl-labsv-card{box-shadow:0 0 0 1px rgba(var(--rgb-rojo),.45),0 16px 44px rgba(0,0,0,.50) !important}
      #vgl-root.perf~#vgl-labsv-modal .vgl-labsv-ic,
      #vgl-root.perf~#vgl-labsv-modal .vgl-labsv-ok{box-shadow:none !important;transform:none !important}
      @media (prefers-reduced-motion:reduce){
        #vgl-labsv-modal,#vgl-labsv-modal *{animation:none !important;transition:none !important}
      }

      /* ==== [v12.3.13] CSS de los avisos toast (_renderToast) — antes inline en CADA toast (una copia por aviso); se movió aquí para inyectarse UNA vez. El color del estado NO se interpola en el CSS: cada pieza del toast lo fija inline como custom property (--tk) y con var(--c-*) directo, así el estilo computado queda idéntico ==== */
      /* Apagado total de efectos en modo rendimiento (#vgl-root precede a #vgl-toasts en body) */
      #vgl-root.perf~#vgl-toasts .vgl-toast,#vgl-root.perf~#vgl-toasts .vgl-toast *{
        animation:none !important;transition:none !important;
        backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
        text-shadow:none !important;
      }
      #vgl-root.perf~#vgl-toasts .vgl-toast{
        background:var(--toast);
        box-shadow:0 0 0 1px var(--edge),0 10px 26px rgba(0,0,0,.45);
      }
      #vgl-root.perf~#vgl-toasts .vgl-toast .vgl-toast-rail,
      #vgl-root.perf~#vgl-toasts .vgl-toast .vgl-toast-ic{box-shadow:none !important}

      /* ==== [v12.3.13] CSS del Resumen del turno — antes inline en renderResumen(); se movió aquí para inyectarse UNA vez y no re-parsearse en cada apertura de la hoja ==== */
      /* [HUD-2026] Resumen del turno — bento de estadísticas. Scope estricto: #vgl-root #vgl-sheet. */
      #vgl-root #vgl-sheet .vgl-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
      #vgl-root #vgl-sheet .vgl-kpi{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px 10px 15px;border-radius:var(--r-card);background:linear-gradient(165deg,rgba(var(--kpi-rgb),.16),rgba(var(--kpi-rgb),.04) 72%),var(--bg2);box-shadow:inset 0 0 0 1px rgba(var(--kpi-rgb),.22),var(--shadow-card);transition:transform .24s var(--spring),box-shadow .24s var(--ease-out)}
      #vgl-root #vgl-sheet .vgl-kpi:hover{transform:translateY(-2px);box-shadow:inset 0 0 0 1px rgba(var(--kpi-rgb),.36),0 10px 26px rgba(var(--kpi-rgb),.13),var(--shadow-card-hover)}
      #vgl-root #vgl-sheet .vgl-kpi-rojo{--kpi-rgb:var(--rgb-rojo)}
      #vgl-root #vgl-sheet .vgl-kpi-ambar{--kpi-rgb:var(--rgb-ambar)}
      #vgl-root #vgl-sheet .vgl-kpi-verde{--kpi-rgb:var(--rgb-verde)}
      #vgl-root #vgl-sheet .vgl-kpi .vgl-n{font-size:38px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.5px;color:rgb(var(--kpi-rgb));text-shadow:0 0 18px rgba(var(--kpi-rgb),.35)}
      #vgl-root #vgl-sheet .vgl-kpi .vgl-l{color:var(--fg2);letter-spacing:.6px;margin-top:7px}
      #vgl-root #vgl-sheet .vgl-tile-chart{padding:14px 16px 12px}
      #vgl-root #vgl-sheet .vgl-chart-cap{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:var(--t-micro);color:var(--fg3);font-weight:700;letter-spacing:.4px}
      #vgl-root #vgl-sheet .vgl-leg{display:flex;gap:12px;flex-wrap:wrap}
      #vgl-root #vgl-sheet .vgl-leg-i{display:inline-flex;align-items:center;gap:5px;font-size:var(--t-micro);font-weight:600;color:var(--fg2);letter-spacing:0}
      #vgl-root #vgl-sheet .vgl-leg-i i{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:rgb(var(--lg-rgb));box-shadow:0 0 8px rgba(var(--lg-rgb),.55)}
      #vgl-root #vgl-sheet .vgl-lg-verde{--lg-rgb:var(--rgb-verde)}
      #vgl-root #vgl-sheet .vgl-lg-ambar{--lg-rgb:var(--rgb-ambar)}
      #vgl-root #vgl-sheet .vgl-lg-rojo{--lg-rgb:var(--rgb-rojo)}
      #vgl-root #vgl-sheet .vgl-bars{display:flex;align-items:flex-end;gap:8px;height:84px;margin-top:12px}
      #vgl-root #vgl-sheet .vgl-bar{flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%;padding:4px 2px 3px;border-radius:12px;transition:background .18s var(--ease-out)}
      #vgl-root #vgl-sheet .vgl-bar:hover{background:var(--bg2)}
      #vgl-root #vgl-sheet .vgl-bar:last-child .vgl-lb{color:var(--fg)}
      #vgl-root #vgl-sheet .vgl-col{display:flex;flex-direction:column-reverse;width:20px;gap:2px}
      #vgl-root #vgl-sheet .vgl-col:empty::after{content:"";display:block;height:3px;border-radius:2px;background:var(--bg3)}
      #vgl-root #vgl-sheet .vgl-seg{width:100%;border-radius:5px;min-height:2px}
      #vgl-root #vgl-sheet .vgl-count{font-variant-numeric:tabular-nums;font-size:var(--t-strong);font-weight:800;color:var(--fg);background:var(--bg3);padding:4px 12px;border-radius:var(--r-pill);box-shadow:var(--glow-edge);white-space:nowrap}
      /* [v12.3.13] .vgl-fld tiene métricas DISTINTAS en Resumen (11px, gap heredado 12px) y en Ajustes (12px, gap 14px).
         Antes nunca convivían (cada hoja traía su bloque de estilos y solo existía uno en el DOM); ya consolidadas en esta
         hoja única, la regla posterior pisaría a la anterior. El :has() reproduce esa exclusividad: solo aplica la regla
         de la hoja que está realmente montada (.vgl-kpis solo existe en Resumen, .vgl-set-cap solo en Ajustes). */
      #vgl-root #vgl-sheet:has(.vgl-kpis) .vgl-fld{margin:0 -8px;padding:11px 8px;border-radius:12px;border-bottom:1px solid var(--line);transition:background .16s var(--ease-out)}
      #vgl-root #vgl-sheet .vgl-fld:last-child{border-bottom:0}
      #vgl-root #vgl-sheet .vgl-fld:hover{background:var(--bg2)}
      #vgl-root.perf #vgl-sheet .vgl-kpi,#vgl-root.perf #vgl-sheet .vgl-kpi:hover{transform:none;box-shadow:inset 0 0 0 1px rgba(var(--kpi-rgb),.25)}
      #vgl-root.perf #vgl-sheet .vgl-seg{box-shadow:none!important}
      #vgl-root.perf #vgl-sheet .vgl-leg-i i,#vgl-root.perf #vgl-sheet .vgl-count{box-shadow:none}
      @media (prefers-reduced-motion:reduce){#vgl-root #vgl-sheet *{transition:none!important;animation:none!important}#vgl-root #vgl-sheet .vgl-kpi:hover{transform:none}}

      /* ==== [v12.3.13] CSS de Ajustes — antes inline en renderSettings(); se movió aquí para inyectarse UNA vez y no re-parsearse en cada apertura de la hoja ==== */
      /* [HUD-2026] Ajustes — celdas claras + switches grandes. Scope estricto: #vgl-root #vgl-sheet. */
      #vgl-root #vgl-sheet .vgl-set-cap{display:flex;align-items:center;gap:8px;padding:12px 0 7px;font-size:var(--t-micro);font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:var(--fg3)}
      #vgl-root #vgl-sheet .vgl-set-cap i{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:rgb(var(--cap-rgb));box-shadow:0 0 10px rgba(var(--cap-rgb),.55)}
      #vgl-root #vgl-sheet .vgl-cap-azul{--cap-rgb:var(--rgb-azul)}
      #vgl-root #vgl-sheet .vgl-cap-ambar{--cap-rgb:var(--rgb-ambar)}
      #vgl-root #vgl-sheet .vgl-cap-verde{--cap-rgb:var(--rgb-verde)}
      #vgl-root #vgl-sheet .vgl-cap-recordatorio{--cap-rgb:var(--rgb-recordatorio)}
      #vgl-root #vgl-sheet .vgl-cap-morado{--cap-rgb:var(--rgb-morado)}
      /* [v12.3.13] Mismo caso que arriba: la variante de .vgl-fld de Ajustes solo aplica cuando la hoja montada es Ajustes */
      #vgl-root #vgl-sheet:has(.vgl-set-cap) .vgl-fld{margin:0 -8px;padding:12px 8px;gap:14px;border-radius:12px;border-bottom:1px solid var(--line);transition:background .16s var(--ease-out)}
      #vgl-root #vgl-sheet .vgl-fld:last-child{border-bottom:0}
      #vgl-root #vgl-sheet .vgl-fld:hover{background:var(--bg2)}
      #vgl-root #vgl-sheet .vgl-sw{width:54px;height:32px}
      #vgl-root #vgl-sheet .vgl-sw i:after{width:26px;height:26px;top:3px;left:3px}
      #vgl-root #vgl-sheet .vgl-sw input:checked + i:after{transform:translateX(22px)}
      #vgl-root #vgl-sheet .vgl-fld input[type=range]{accent-color:var(--c-azul);width:180px;max-width:180px;height:28px;cursor:pointer;background:transparent;border:0;box-shadow:none;padding:0}
      #vgl-root #vgl-sheet .vgl-fld input:disabled{opacity:.55;cursor:not-allowed}
      #vgl-root #vgl-sheet .vgl-grp-tec{background:linear-gradient(170deg,rgba(var(--rgb-morado),.07),rgba(var(--rgb-morado),0) 55%),var(--bg2);box-shadow:inset 0 0 0 1px rgba(var(--rgb-morado),.16),var(--shadow-card)}
      #vgl-root #vgl-sheet #c-export-logs{background:linear-gradient(150deg,rgba(var(--rgb-verde),.30),rgba(var(--rgb-verde),.15));color:var(--c-verde);font-weight:700;box-shadow:inset 0 0 0 1px rgba(var(--rgb-verde),.40)}
      #vgl-root.perf #vgl-sheet .vgl-set-cap i{box-shadow:none}
      @media (prefers-reduced-motion:reduce){#vgl-root #vgl-sheet *{transition:none!important;animation:none!important}}

      /* ==== [v12.3.15] BLINDAJE TIPOGRÁFICO contra los estilos globales de Everest ==== */
      /* Descubierto con un pantallazo real del consultorio: los textos que confiaban en
         HERENCIA (p. ej. el <span> de .vgl-agm-check-lbl hereda color:var(--fg)) salían
         en el azul corporativo de Everest, ilegible sobre nuestros paneles oscuros: la
         hoja global de Everest trae reglas DIRECTAS sobre span/label/b, y un valor
         directo siempre le gana a uno heredado, por baja que sea su especificidad. En el
         preview sintético del rediseño (sin el CSS de Everest) esto era invisible.
         La armadura: forzar color:inherit SOLO en los elementos SIN clase (los únicos
         que dependen de herencia) dentro de cada contenedor nuestro. Con el ID del
         contenedor le gana a cualquier regla sin ID de Everest; con :where() aporta
         especificidad CERO extra, así TODAS nuestras reglas internas de acento (fechas
         verdes, etiquetas azules, notas) le siguen ganando sin tocarlas. */
      #vgl-root :where(span:not([class]),b:not([class]),i:not([class]),em:not([class]),strong:not([class]),small:not([class]),label:not([class]),p:not([class]),li:not([class]),td:not([class]),th:not([class])),
      #vgl-dock :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-acciones-dock :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-pym-banner :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-toasts :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-modal :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-pym-modal :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-pes-modal :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-agendar-modal :where(span:not([class]),b:not([class]),i:not([class]),em:not([class]),strong:not([class]),small:not([class]),label:not([class]),p:not([class]),li:not([class]),td:not([class]),th:not([class])),
      #vgl-ordenar-modal :where(span:not([class]),b:not([class]),i:not([class]),em:not([class]),strong:not([class]),small:not([class]),label:not([class]),p:not([class]),li:not([class]),td:not([class]),th:not([class])),
      #vgl-labs-modal :where(span:not([class]),b:not([class]),i:not([class]),em:not([class]),strong:not([class]),small:not([class]),label:not([class]),p:not([class]),li:not([class]),td:not([class]),th:not([class])),
      #vgl-labsv-modal :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class])),
      #vgl-postcita-panel :where(span:not([class]),b:not([class]),small:not([class]),label:not([class]),p:not([class]))
      {color:inherit}
    `;
    document.head.appendChild(style);
    const root = document.createElement("div"); root.id = "vgl-root";
    // [COPY-UX] Estructura principal del panel del asistente clínico
    root.innerHTML = `
      <div id="vgl-head">
        <div id="vgl-tls">
          <button class="vgl-tl close" id="vgl-tl-close" title="Ocultar (se colapsa a una pastilla)" aria-label="Ocultar"><svg viewBox="0 0 6 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1 1L5 5M5 1L1 5"/></svg></button>
          <button class="vgl-tl min" id="vgl-tl-min" title="Minimizar (solo la barra)" aria-label="Minimizar"><svg viewBox="0 0 6 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1 3H5"/></svg></button>
          <button class="vgl-tl zoom" id="vgl-tl-zoom" title="Restaurar tamaño completo" aria-label="Restaurar"><svg viewBox="0 0 6 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1 3H5M3 1V5"/></svg></button>
        </div>
        <div id="vgl-title">Asistente Clínico<small>v${VERSION}</small></div>
        <span id="vgl-dot" title="origen de datos"></span>
      </div>
      <div id="vgl-body">
        <div id="vgl-sidebar">
          <div id="vgl-find">
            <input id="vgl-q" type="text" aria-label="Buscar paciente por nombre o cédula" spellcheck="false" placeholder="🔍 Buscar paciente por nombre o cédula…">
          </div>
          <div class="vgl-sb-lbl">Filtros</div>
          <nav id="vgl-filters">
            <button class="vgl-fchip sel" data-f="todas">Todas las citas</button>
            <button class="vgl-fchip" data-f="riesgo" title="Alertas de atención e inasistencias">⚠ Atención prioritaria</button>
            <button class="vgl-fchip" data-f="sinpres">Sin presentarse</button>
            <button class="vgl-fchip" data-f="ensala">En sala</button>
            <button class="vgl-fchip" data-f="pym">Con PyM</button>
          </nav>
          <div id="vgl-stats"></div>
          <div id="vgl-actions">
            <button class="vgl-sb-btn primary" id="vgl-load" title="Cargar lista de actividades preventivas (.xlsx / .csv)">📂 Cargar prevención</button>
            <button class="vgl-sb-btn" id="vgl-bell" title="Activar notificaciones de Windows">🔔 Alertas</button>
            <button class="vgl-sb-btn" id="vgl-mute" title="Silenciar el sonido 15 minutos">🔉 Silenciar</button>
            <button class="vgl-sb-btn" id="vgl-rep" title="Resumen de la jornada y reporte de atención">📊 Resumen</button>
            <button class="vgl-sb-btn" id="vgl-cfg" title="Ajustes">⚙ Ajustes</button>
          </div>
        </div>
        <div id="vgl-main">
          <div id="vgl-sum">Iniciando asistente clínico…</div>
          <div id="vgl-list"><div id="vgl-empty">Ingrese a la vista de "Citas del día" para cargar la agenda.</div></div>
          <div id="vgl-sheet"></div>
        </div>
      </div>
      <input type="file" id="vgl-file" accept=".xlsx,.xlsm,.csv" class="vgl-d-none">
    `;
    document.body.appendChild(root);
    el = { root, sum: root.querySelector("#vgl-sum"), stats: root.querySelector("#vgl-stats"), list: root.querySelector("#vgl-list"), file: root.querySelector("#vgl-file"), dot: root.querySelector("#vgl-dot"), sheet: root.querySelector("#vgl-sheet"), q: root.querySelector("#vgl-q") };
    if (el.sum) el.sum.setAttribute("aria-live", "polite");
    root.querySelector("#vgl-load").addEventListener("click", () => { uxTrack("panel.pym.abrir_archivo"); el.file.click(); });
    root.querySelector("#vgl-bell").addEventListener("click", () => { uxTrack("panel.notificaciones.activar"); enableOsNotifications(); });
    root.querySelector("#vgl-rep").addEventListener("click", () => { uxTrack("panel.hoja.resumen"); toggleSheet("resumen"); });
    root.querySelector("#vgl-cfg").addEventListener("click", () => { uxTrack("panel.hoja.ajustes"); toggleSheet("ajustes"); });
    root.querySelector("#vgl-mute").addEventListener("click", () => { uxTrack(muted() ? "panel.sonido.reactivar" : "panel.silenciar15"); (muted() ? unmute() : muteFor(15)); });
    // Buscador: filtra en vivo y resalta la coincidencia. La telemetría cuenta la
    // PRIMERA tecla de cada búsqueda (no cada pulsación, y jamás el texto escrito).
    el.q.addEventListener("input", () => { if (el.q.value.trim().length === 1 && !state.busqueda) uxTrack("panel.busqueda"); state.busqueda = el.q.value.trim().toLowerCase(); state.lastSignature = ""; repaint(); });
    el.q.addEventListener("keydown", (e) => { if (e.key === "Escape") { el.q.value = ""; state.busqueda = ""; state.lastSignature = ""; repaint(); } e.stopPropagation(); });
    root.querySelectorAll(".vgl-fchip").forEach((c) => c.addEventListener("click", () => {
      uxTrack("panel.filtro:" + c.dataset.f); // valores fijos del propio panel (todas/…)
      state.filtro = c.dataset.f; state.lastSignature = "";
      root.querySelectorAll(".vgl-fchip").forEach((x) => x.classList.toggle("sel", x === c));
      if (root.classList.contains("sheet")) closeSheet();
      repaint();
    }));
    // Al volver a la pestaña o hacer clic en el panel: reconocer (apaga sonido y parpadeo).
    root.addEventListener("click", (e) => { if (!e.target.closest("#vgl-sheet")) acknowledge(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      stopFlash();
      // v14.1.5 — El relevo por visibilidad tiene que ser INMEDIATO. Si se esperara al
      // siguiente tick, ese tick es justamente el que el navegador acaba de estrangular:
      // se tardaría hasta un minuto en recuperar la cadencia, que es el retraso que se
      // quiere eliminar. Al volver a esta pestaña se reclama el mando y se late ya.
      try { heartbeat(); } catch (e) {}
      try { tick(); } catch (e) {}
    });
    el.file.addEventListener("change", (e) => { if (e.target.files[0]) loadPymFile(e.target.files[0]); e.target.value = ""; });
    root.querySelector("#vgl-tl-close").onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } setWinState("dock"); };
    root.querySelector("#vgl-tl-min").onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } setWinState(winState === "min" ? "full" : "min"); };
    root.querySelector("#vgl-tl-zoom").onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } setWinState("full"); };
    root.querySelector("#vgl-head").addEventListener("dblclick", (e) => { if (e.target.closest("button")) return; setWinState(winState === "min" ? "full" : "min"); });
    // [COPY-UX] Dock flotante del asistente clínico
    const dock = document.createElement("div"); dock.id = "vgl-dock"; dock.title = "Mostrar Asistente Clínico (Alt+V)";
    dock.setAttribute("role", "button");
    dock.setAttribute("tabindex", "0");
    dock.setAttribute("aria-label", "Mostrar Asistente Clínico (Alt+V)");
    dock.innerHTML = `<span id="vgl-dock-dot"></span><span>Asistente Clínico</span><b id="vgl-dock-b" class="vgl-d-none">0</b>`;
    dock.addEventListener("click", () => setWinState("full"));
    dock.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWinState("full"); } });
    document.body.appendChild(dock); el.dock = dock; el.dockB = dock.querySelector("#vgl-dock-b");
    const toasts = document.createElement("div"); toasts.id = "vgl-toasts";
    toasts.setAttribute("role", "status");
    toasts.setAttribute("aria-live", "polite");
    document.body.appendChild(toasts);
    makeDraggable(root, root.querySelector("#vgl-head"));
    // Atajo de teclado: Alt+V muestra u oculta el panel sin tocar el mouse. Escape cierra sheet si está abierto.
    document.addEventListener("keydown", (e) => {
      if (e.altKey && !e.ctrlKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        setWinState(winState === "dock" ? "full" : "dock");
      } else if (e.key === "Escape" && el && el.root && el.root.classList.contains("sheet")) {
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
      }
    });
    restorePos(); applyTheme(); paintMute(); updateBell();
    // El tema "auto" sigue al modo claro/oscuro de Windows en vivo.
    try { if (PAGEWIN.matchMedia) PAGEWIN.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S.tema === "auto") applyTheme(); }); } catch (e) {}
  }

  // =====================================================================
  //  AGENDAMIENTO EXPRÉS DE CONTROL Y PyM (v7.9.0)
  //  Integración directa con APIAcceso de Everest
  //  (https://neps.everestintelligent.com/apiviva/APIAcceso/api/...)
  // =====================================================================

  // Capta automáticamente el UsuarioId y UsuarioNombreCompleto del médico en sesión
  function captureDoctorInfo(srcStr) {
    try {
      if (typeof PAGEWIN !== "undefined" && PAGEWIN) {
        if (PAGEWIN.UsuarioId && (!state.activeDoctor.id || state.activeDoctor.id === 0)) {
          const id = parseInt(PAGEWIN.UsuarioId, 10);
          if (id > 0) state.activeDoctor.id = id;
        }
        if (PAGEWIN.UsuarioNombreCompleto && !state.activeDoctor.name) {
          state.activeDoctor.name = String(PAGEWIN.UsuarioNombreCompleto).trim();
        }
        if (PAGEWIN.UsuarioLogin && !state.activeDoctor.name) {
          state.activeDoctor.name = String(PAGEWIN.UsuarioLogin).trim();
        }
        // v12.3.1 — Si la página publica el LOGIN, no hay que esperar a que la aplicación
        // llame a GetUsuarioPerfil por su cuenta: se consulta activamente (una sola vez,
        // resolverMedicoPorPerfil ya deduplica) para fijar id y nombre del médico.
        if (PAGEWIN.UsuarioLogin && (!state.activeDoctor.id || state.activeDoctor.id === 0)) {
          loginVisto = String(PAGEWIN.UsuarioLogin).trim();
          resolverMedicoPorPerfil(loginVisto);
        }
      }
    } catch (e) {}
    if (!srcStr || typeof srcStr !== "string") return;
    try {
      // v11.0.1 — LISTA BLANCA DE ORIGEN. Antes se aceptaba cualquier "UsuarioId=" de
      // cualquier URL del registro de red, y varios servicios usan ese nombre para el id
      // del PACIENTE (APIEnvioCorreo, APIHCHealth/Morbilidad) o de otro usuario (digiturno).
      // El "médico activo" podía acabar siendo el identificador de un paciente, y con él se
      // creaban las citas y las órdenes.
      // v12.3.1 — Se retira ApiIntegracionEverestDigiturno de la lista: el propio comentario
      // de arriba documenta que su "UsuarioId" es el de OTRO usuario, y aun así seguía en la
      // lista blanca. Y el id raspado ya NO pisa uno existente: la ficha de GetUsuarioPerfil
      // es autoritativa, y un eco de las llamadas del propio Vigilante (que viajan con el
      // S.medicoId manual de Ajustes) no debe sobrescribirla.
      const ORIGEN_FIABLE = /^https:\/\/neps\.everestintelligent\.com\/apiviva\/APIAcceso\//i;
      const uIdM = ORIGEN_FIABLE.test(srcStr) ? (/UsuarioId=(\d+)/i.exec(srcStr) || /"usuarioId":\s*(\d+)/i.exec(srcStr)) : null;
      if (uIdM && uIdM[1]) {
        const id = parseInt(uIdM[1], 10);
        if (id > 0 && !state.activeDoctor.id) { state.activeDoctor.id = id; state.lastSignature = ""; }
      }
      const uNameM = /UsuarioNombreCompleto=([^&]+)/i.exec(srcStr) || /"usuarioNombreCompleto":\s*"([^"]+)"/i.exec(srcStr);
      if (uNameM && uNameM[1]) {
        const name = decodeURIComponent(uNameM[1]).replace(/\+/g, " ").trim();
        if (name && name.length > 3) state.activeDoctor.name = name;
      }

      // v12.0.2 — FUENTE REAL DE LA IDENTIDAD DEL MÉDICO.
      // El nombre completo NO viaja en ninguna URL de Everest: los raspados de arriba nunca
      // encuentran nada (el único "NombreUsuario=" del registro de red es de digiturno y
      // lleva el nombre del PACIENTE, no el del profesional). Por eso, mientras existió el
      // nombre cableado del autor, el filtro "mi agenda" parecía funcionar — en realidad no
      // detectaba a nadie. Al retirarlo quedó al descubierto: sin nombre no se puede
      // reconocer la agenda propia y se ofrecen turnos de otros profesionales.
      //
      // Everest sí publica la ficha del usuario en sesión, con id y nombre completo:
      //   GET /apiviva/APIAcceso/api/ParametrizacionLista/GetUsuarioPerfil/<login>
      //   -> { data: { id: 515, nombreCompleto: "…", perfilCodigo: "PROFESIONAL" } }
      // Aquí se detecta el <login> cuando la propia aplicación llama a ese endpoint y se
      // consulta una sola vez para resolver id y nombre de forma autoritativa.
      const perfilM = /\/apiviva\/APIAcceso\/api\/ParametrizacionLista\/GetUsuarioPerfil\/([^/?#]+)/i.exec(srcStr);
      if (perfilM && perfilM[1]) { loginVisto = decodeURIComponent(perfilM[1]); resolverMedicoPorPerfil(loginVisto); }

      // v12.3.1 — MECANISMO PRIMARIO para cualquier médico. GetUsuarioPerfil no aparece
      // en NINGUNA captura posterior al login (solo ocurre —si ocurre— en el bootstrap),
      // así que esperar únicamente por él dejaba el id en 0 en los equipos ajenos y
      // BuscarPaciente con UsuarioId=0 "no encontraba" a ningún paciente. Pero la
      // aplicación SÍ pasa el LOGIN de la sesión como parámetro en otras llamadas
      // (capturado en consultorio: APIMedicoHealth/api/Medico/ObtenerEspecialidadMedico
      // ?login=bpalencia al pulsar "Nueva orden"). Cualquier "login=" dentro de /apiviva/
      // es el del usuario en sesión; se resuelve por la misma puerta autoritativa
      // (GetUsuarioPerfil) antes de usarse para nada.
      if (!state.activeDoctor.id) {
        const loginM = /\/apiviva\/[^?#\s"']+\?[^#\s"']*\blogin=([^&#\s"']+)/i.exec(srcStr);
        if (loginM && loginM[1]) {
          const lg = decodeURIComponent(loginM[1]).trim();
          if (lg) { loginVisto = lg; resolverMedicoPorPerfil(lg); }
        }
      }
    } catch (e) {}
  }

  // Consulta (una sola vez por login) la ficha del usuario en sesión para fijar el médico
  // activo. Es de SOLO LECTURA y no bloquea nada: si falla, el panel sigue avisando de que
  // no identificó la agenda propia y el médico puede escribir su nombre en Ajustes.
  let perfilPedido = "";
  let loginVisto = "";   // v12.3.1 — último login de sesión visto en la red (para reintentos)
  let idRetryAt = 0;     // v12.3.1 — sello del último reintento de identidad desde tick()
  async function resolverMedicoPorPerfil(login) {
    if (!login || perfilPedido === login) return;
    perfilPedido = login;
    try {
      const r = await pageFetchJson(`/apiviva/APIAcceso/api/ParametrizacionLista/GetUsuarioPerfil/${encodeURIComponent(login)}`);
      const d = r && r.data;
      const id = d ? parseInt(d.id, 10) : 0;
      // v12.3.1 — Sin ficha con id se LIBERA el login para poder reintentar: antes un
      // único fallo (red caída, 4xx) vetaba ese login de por vida de la pestaña.
      if (!(id > 0)) { perfilPedido = ""; return; }
      const nombre = String(d.nombreCompleto || "").trim();
      if (nombre.length > 3) state.activeDoctor.name = nombre;
      invalidarApiSiCambioMedico(id);   // v12.3.6 — antes de fijar el id nuevo, purgar el de otro médico
      state.activeDoctor.id = id;
      console.log("[Vigilante] médico en sesión:", state.activeDoctor.name, "· id", state.activeDoctor.id);
      state.lastSignature = "";   // que el panel se repinte ya con la identidad resuelta
    } catch (e) { perfilPedido = ""; console.warn("[Vigilante] no se pudo resolver el perfil del médico:", e); }
  }

  // v12.3.2 — IDENTIDAD DESDE EL ALMACENAMIENTO DEL CLIENTE (volcado real del 2026-08-10
  // en el equipo de otro profesional). Everest guarda en localStorage la ficha de la
  // sesión: user = {userId, userIdIdentity, username, ...} y jwt (JWT cuyo sub es ese
  // mismo userIdIdentity), y además deja la cookie UsuarioMedico=<login>. El login NUNCA
  // se usa directamente: se pasa por GetUsuarioPerfil (validación de backend), así que un
  // almacenamiento rancio de un médico anterior en un equipo compartido no puede firmar
  // nada por sí solo. Coherencia extra: si hay jwt, user.username solo se acepta cuando
  // jwt.sub coincide con user.userIdIdentity (el jwt es el token vivo de ESTA sesión).
  function identidadDesdeCliente() {
    if (state.activeDoctor.id) return;
    try {
      let login = "";
      let u = null;
      try { u = JSON.parse(localStorage.getItem("user") || "null"); } catch (e) {}
      let jwtSub = "";
      try {
        const seg = String(localStorage.getItem("jwt") || "").trim().split(".");
        if (seg.length === 3) jwtSub = String((JSON.parse(atob(seg[1].replace(/-/g, "+").replace(/_/g, "/"))) || {}).sub || "");
      } catch (e) {}
      if (u && u.username && (!jwtSub || !u.userIdIdentity || String(u.userIdIdentity).toLowerCase() === jwtSub.toLowerCase())) {
        login = String(u.username).trim();
      }
      if (!login) {
        const ckM = /(?:^|;\s*)UsuarioMedico=([^;]+)/.exec(document.cookie || "");
        if (ckM && ckM[1]) login = decodeURIComponent(ckM[1]).trim();
      }
      if (login) { loginVisto = login; resolverMedicoPorPerfil(login); }
    } catch (e) {}
  }
  // Primer intento en cuanto termina de evaluarse el script (el almacenamiento de la
  // sesión ya existe a document-start; el timeout evita depender del orden de las const).
  try { setTimeout(identidadDesdeCliente, 0); } catch (e) {}
  const FESTIVOS = new Set([
    // 2024
    "2024-01-01", "2024-01-08", "2024-03-25", "2024-03-28", "2024-03-29",
    "2024-05-01", "2024-05-13", "2024-06-03", "2024-06-10", "2024-07-01",
    "2024-07-20", "2024-08-07", "2024-08-19", "2024-10-14", "2024-11-04",
    "2024-11-18", "2024-12-08", "2024-12-25",
    // 2025
    "2025-01-01", "2025-01-06", "2025-03-24", "2025-04-17", "2025-04-18",
    "2025-05-01", "2025-06-02", "2025-06-23", "2025-06-30", "2025-07-20",
    "2025-08-07", "2025-08-18", "2025-10-13", "2025-11-03", "2025-11-17",
    "2025-12-08", "2025-12-25",
    // 2026
    "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
    "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
    "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12",
    "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    // 2027
    "2027-01-01", "2027-01-11", "2027-03-22", "2027-03-25", "2027-03-26",
    "2027-05-01", "2027-05-10", "2027-05-31", "2027-06-07",
    // v14.0.1 — San Pedro y San Pablo (29 de junio, Ley Emiliani: se traslada al lunes
    // siguiente). En 2026 el 29 de junio YA cae lunes (ver "2026-06-29" arriba, sin
    // traslado). En 2027 el 29 de junio cae martes, así que el trasladado es el 5 de
    // julio — festivo nacional real, faltaba en esta tabla.
    "2027-07-05",
    "2027-07-20", "2027-08-07", "2027-08-16", "2027-10-18",
    "2027-11-01", "2027-11-15", "2027-12-08", "2027-12-25"
  ]);

  function esFestivo(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    if (yyyy > 2027) {
      if (!state.warnedTimes.has("festivos_caducados")) {
        state.warnedTimes.add("festivos_caducados");
        console.warn("[Vigilante] La tabla de festivos caducó, hay que actualizarla.");
      }
    }
    return FESTIVOS.has(`${yyyy}-${mm}-${dd}`);
  }



  // Calcula la fecha objetivo sumando meses/días y ajusta a viernes si cae en fin de semana
  function calcBusinessTargetDate(monthsToAdd, daysToAdd) {
    const d = new Date();
    const originalDay = d.getDate(); // v8.1.0: VK-02 Guardar el día original
    if (monthsToAdd) {
      d.setMonth(d.getMonth() + monthsToAdd);
      if (d.getDate() !== originalDay) {
        d.setDate(0); // Ajuste EOM (End of Month) por desbordamiento
      }
    }
    if (daysToAdd) d.setDate(d.getDate() + daysToAdd);

    // Si cae sábado (6), retrocede 1 día -> Viernes. Si cae domingo (0), retrocede 2 días -> Viernes.
    const day = d.getDay();
    if (day === 6) d.setDate(d.getDate() - 1);
    else if (day === 0) d.setDate(d.getDate() - 2);

    while (esFestivo(d) || d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }

    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());

    return {
      iso: `${yyyy}-${mm}-${dd}`,             // Formato YYYY-MM-DD para API POST
      fmt: `${dd}/${mm}/${yyyy}`,             // Formato DD/MM/YYYY para API GET Turnos
      lbl: d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      dateObj: d,
    };
  }

  // Petición universal en el contexto de la página (núcleo) con SYNAPSE (Exponential Backoff + Jitter)
  async function _pageFetchJsonCore(url, options) {
    let delay = 300;
    // v11.0.1 — NO se reintenta una ESCRITURA. Este núcleo reintentaba hasta 4 veces y,
    // en cada vuelta, repetía la petición por una segunda vía (GM_xmlhttpRequest): hasta
    // OCHO envíos del mismo POST. En AsignarTurno son ocho citas para el mismo paciente;
    // en GuardarOrdenamiento, ocho órdenes clínicas repetidas.
    const metodo = String((options && options.method) || "GET").toUpperCase();
    const esEscritura = metodo !== "GET" && metodo !== "HEAD" && !(options && options.__idempotent === true);
    const maxRetries = esEscritura ? 0 : 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let isError = false;
      try {
        const f = FETCH0 || window.fetch;
        if (typeof f === "function") {
          const fullUrl = url.indexOf("http") === 0 ? url : (location.origin + (url[0] === "/" ? "" : "/") + url);
          const resp = await f(fullUrl, Object.assign({
            headers: { "Content-Type": "application/json", "Accept": "application/json" }
          }, options || {}));
          if (resp && resp.ok) {
            const data = await resp.json();
            if (data) return data;
          } else if (resp && resp.status >= 500) {
            isError = true;
          } else {
            return null; // Error 4xx, no reintentar
          }
        } else {
          isError = true;
        }
      } catch (e) {
        isError = true;
      }

      if (isError) {
        // v11.0.1 — En una escritura NO se reenvía por la segunda vía: la primera pudo
        // llegar al servidor y solo haberse perdido la respuesta. Duplicaría la cita.
        if (esEscritura) { console.warn("[Vigilante] escritura fallida, NO se reintenta para no duplicar:", url); return null; }
        if (typeof GM_xmlhttpRequest !== "undefined") {
          try {
            const result = await new Promise((resolve, reject) => {
              GM_xmlhttpRequest(Object.assign({
                method: (options && options.method) || "GET",
                url: url.indexOf("http") === 0 ? url : (location.origin + (url[0] === "/" ? "" : "/") + url),
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                data: (options && options.body) || null,
                timeout: 15000,
                onload: (r) => {
                  if (r.status >= 500) reject(new Error("500"));
                  else { try { resolve(JSON.parse(r.responseText)); } catch (e) { resolve(null); } }
                },
                onerror: () => reject(new Error("NetErr")),
                ontimeout: () => reject(new Error("Timeout")),
              }, options || {}));
            });
            if (result) return result;
          } catch (e) {
            // [BLINDADO v8.2.0 NET-01] Silent Failure eliminado: registrar para diagnóstico técnico (sin datos de pacientes)
            if (console && console.warn) console.warn('[Vigilante SYNAPSE] GM fallback también falló en intento ' + attempt + ':', (e && e.message) || String(e));
          }
        }

        if (attempt < maxRetries) {
          // v8.1.0: VK-01 Exponential Backoff + Jitter aleatorio amplificado
          const jitter = Math.random() * 500;
          await new Promise(r => setTimeout(r, delay + jitter));
          delay *= 2;
        }
      }
    }
    return null;
  }

  // v12.10.12 — RUM (Real User Monitoring) del API de Everest: latencia y tasa de
  // éxito por endpoint, al estilo de lo que Google/Meta miden de sus propios back-ends.
  // La etiqueta NUNCA sale de la URL real (que trae cédulas/IDs en query string o hasta
  // en el propio camino, ej. GetUsuarioPerfil/<login>): es un nombre FIJO de esta lista,
  // elegido por prueba de pertenencia — si la URL no calza con ninguno, la etiqueta es
  // "otro". Cero riesgo de fuga aunque la URL traiga cualquier cosa.
  const RUM_ENDPOINTS = [
    [/BuscarPacienteDetallado/, "pacienteDetallado"],
    [/BuscarPaciente/, "buscarPaciente"],
    [/AgdValidarAgenda/, "validarAgenda"],
    [/AsignarTurno/, "asignarTurno"],
    [/BuscarCitasDisponibles/, "citasDisponibles"],
    [/ObtenerTurnos/, "turnos"],
    [/GetUsuarioPerfil/, "perfilUsuario"],
    [/EnviarSMS/, "enviarSms"],
    [/EnviarEmailOrdenamiento/, "enviarEmailOrden"],
    [/ObtenerResultadosLaboratorio/, "resultadosLab"],
    [/GenerarLinksImpresionOrdenamientos/, "linksImpresionOrden"],
    [/ImprimirRecordatorioCita/, "imprimirRecordatorio"],
    [/ObtenerConsultas/, "consultas"],
    [/ObtenerEstadoCita/, "estadoCita"],
    [/guardarHoraApertura/, "horaApertura"],
    [/ObtenerListadoCupsPorPaciente/, "listadoCups"],
    [/ObtenerListadoDiagnostico/, "listadoDiagnostico"],
    [/GuardarOrdenamiento/, "guardarOrdenamiento"],
    [/FinalizarTicket/, "finalizarTicket"],
  ];
  function _rumEndpointLabel(url) {
    const u = String(url || "");
    for (let i = 0; i < RUM_ENDPOINTS.length; i++) if (RUM_ENDPOINTS[i][0].test(u)) return RUM_ENDPOINTS[i][1];
    return "otro";
  }
  // Observador puro: no toca `promesa` (ni su resolución ni su rechazo), solo mira
  // cuánto tardó y si el resultado fue verdadero (éxito) o falso/null (fallo) — el
  // mismo criterio que ya usan todos los llamadores reales de pageFetchJson().
  function _rumTrack(url, t0, promesa) {
    try {
      if (S.uxTelemetria === false) return;
      const etiqueta = _rumEndpointLabel(url);
      promesa.then(
        (data) => { try { uxTrack("api." + etiqueta + (data ? ".ok" : ".err"), { n: Date.now() - t0 }); } catch (e) {} },
        () => { try { uxTrack("api." + etiqueta + ".err", { n: Date.now() - t0 }); } catch (e) {} }
      ).catch(() => {});
    } catch (e) {}
  }

  // Wrapper reactivo con GHOST (Deduplicación de Promesas / Promise Pooling)
  async function pageFetchJson(url, options) {
    const key = url + "|" + (options ? JSON.stringify(options) : "");
    if (GHOST.promises.has(key)) return GHOST.promises.get(key);

    const t0 = Date.now();
    const p = _pageFetchJsonCore(url, options).finally(() => {
      GHOST.promises.delete(key);
    });
    _rumTrack(url, t0, p);

    GHOST.promises.set(key, p);
    return p;
  }

  // Extractor recursivo de PacienteID para desenrollar cualquier anidación (res.data.data[0]...)
  function extractPatientId(res) {
    if (!res) return null;
    if (typeof res === "number" && res > 0) return res;
    if (typeof res === "string" && /^\d+$/.test(res)) return parseInt(res, 10);
    if (Array.isArray(res) && res.length > 0) return extractPatientId(res[0]);
    if (typeof res === "object") {
      const direct = res.idPaciente || res.pacienteId || res.id || res.PacienteId || res.IdPaciente || res.id_paciente || res.ID || res.Id || res.paciente_id;
      if (direct && typeof direct === "number" && direct > 0) return direct;
      if (direct && typeof direct === "string" && /^\d+$/.test(direct)) return parseInt(direct, 10);
      if (res.data) {
        const fromData = extractPatientId(res.data);
        if (fromData) return fromData;
      }
      // v11.0.1 — Al bajar por las ramas del objeto, NO entrar en las que se sabe que NO
      // contienen al paciente. Sin esta lista, una ficha sin `id` devolvía el primer entero
      // positivo que encontrara: el id de la EPS (2) o el de una sede (12). Con ese número
      // se agendaba y se ordenaba: paciente equivocado.
      const NO_PACIENTE = new Set(["eps", "sedes", "contratos", "planes_Medicos", "programasPaciente",
        "ubicacionesBOT", "mediosTransporte", "puntosReferenciaResidencia", "puntosReferenciaUbicacionHabitual",
        "prestador", "remisor", "usuarioCreacion"]);
      for (const k of Object.keys(res)) {
        if (k !== "data" && !NO_PACIENTE.has(k) && (Array.isArray(res[k]) || (res[k] && typeof res[k] === "object"))) {
          const fromSub = extractPatientId(res[k]);
          if (fromSub) return fromSub;
        }
      }
    }
    return null;
  }

  // Interfaz con APIAcceso: Buscar Paciente por Cédula (robusto con sesión nativa)
  // v14.1.9 — CACHÉ POR CÉDULA. La búsqueda prueba rutas EN CASCADA, así que cada llamada
  // cuesta hasta 4 peticiones secuenciales contra el servidor de la IPS. Hay 8 llamadores
  // de producción, y desde v14.1.8 uno de ellos está en el camino del clic de Auto-Labs:
  // el médico esperaba la cascada ENTERA, encima de los 2-4 s que ya había esperado a
  // Athenea, antes de que se escribiera una sola casilla.
  //
  // La relación cédula → id interno de Everest no cambia, así que cachearla es seguro. El
  // propio comentario de v12.0.3 tres líneas más abajo ya se quejaba de "un goteo constante
  // de 404 contra el servidor" por repetir estas búsquedas: esto es lo que faltaba.
  //
  // Solo se cachea el ACIERTO. Un `null` significa "no se pudo" —red caída, sesión vencida,
  // paciente que aún no existe en Everest— y eso sí cambia de un momento a otro: cachearlo
  // dejaría al médico sin poder reintentar hasta que venciera el TTL.
  //
  // La clave lleva el id del médico porque va en la URL de la consulta.
  // (No hay `_pacienteIdInvalidarTodo`: se escribió por costumbre y se borró antes de
  // subirla. No hay ningún evento que deba invalidar esto — la relación cédula → id interno
  // no cambia, la clave ya separa por médico y por cédula, y el TTL cubre el resto. Es la
  // cuarta vez que este proyecto casi mete un invalidador sin llamador.)
  const _pacienteIdCache = new Map();
  async function apiAccesoBuscarPaciente(docId) {
    const uId = state.activeDoctor.id || S.medicoId || 0;
    const cleanDoc = String(docId || "").replace(/\D/g, "");
    if (!cleanDoc) return null;

    const clave = uId + "|" + cleanDoc;
    const enCache = _pacienteIdCache.get(clave);
    if (enCache && (Date.now() - enCache.ts) < ORDENES_VIGENTES_TTL_MS) return enCache.pid;

    const paths = [
      // v12.0.3 — RETIRADAS las dos rutas de APIPacienteV2: en la consola del consultorio
      // devuelven 404 para TODOS los pacientes, sin excepción. Al ir primeras en la
      // cascada, cada búsqueda gastaba dos peticiones fallidas antes de llegar a la que sí
      // funciona (APIAcceso), y como la precarga al pasar el cursor por las tarjetas también
      // las dispara, la agenda entera generaba un goteo constante de 404 contra el servidor.
      `/apiviva/APIAcceso/api/Paciente/BuscarPaciente?identificacion=${encodeURIComponent(cleanDoc)}&TipoDocumento=CC&epsId=2&UsuarioId=${uId}`,
      `/apiviva/APIAcceso/api/Paciente/BuscarPaciente?identificacion=${encodeURIComponent(cleanDoc)}&UsuarioId=${uId}`,
      // v12.0.0 — RETIRADA la quinta ruta: pasaba la CÉDULA en el parámetro idPaciente,
      // que espera el identificador INTERNO de Everest. Son dos numeraciones distintas, así
      // que una cédula puede coincidir con el id interno de OTRA persona y devolver su
      // ficha. Además solo se disparaba cuando fallaban las cuatro anteriores, es decir,
      // justo cuando nadie iba a sospechar del resultado.
    ];

    for (const path of paths) {
      try {
        const res = await pageFetchJson(path);
        const pid = extractPatientId(res);
        if (pid) { _pacienteIdCache.set(clave, { pid, ts: Date.now() }); return pid; }
      } catch (e) {}
    }
    return null;
  }

  // Interfaz con APIAcceso: Buscar Agendas Disponibles (Soporta Medicina General, Med. Interna, Nutrición, Psicología y Odontología)
  // propagarError: por defecto false (compatibilidad con las llamadas existentes — un fallo
  // de red se traduce silenciosamente en "sin agendas", como siempre). El sondeo en segundo
  // plano de renderDayChips (D2) lo pasa en true, porque para esa lista SÍ necesita distinguir
  // un fallo de red real (no debe ocultar el día) de una respuesta legítima vacía (si oculta).
  //
  // OJO: pageFetchJson/_pageFetchJsonCore NUNCA lanzan — tragan cualquier fallo (4xx, 5xx
  // agotando reintentos, excepción de fetch) y devuelven `null`. Por eso la señal que hay que
  // mirar aquí no es un catch, es que la respuesta haya sido `null`: eso es "no se sabe" (la
  // red falló o el servidor no contestó nada útil), mientras que un objeto real —aunque
  // describa una lista vacía— es una respuesta legítima del servidor y sí se puede confiar.
  async function apiAccesoBuscarCitasDisponibles(pacienteId, fechaIso, especialidadId, propagarError) {
    const uId = state.activeDoctor.id || S.medicoId || 0;
    const espId = especialidadId || 12;
    const path1 = `/apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles?PacienteId=${pacienteId}&EspecialidadId=${espId}&FechaDeseada=${fechaIso}&ProgramaId=0&PuntoAtencionId=12&PerfilCodigo=PROFESIONAL&swParticular=false&presupuestoId=0`;
    const path2 = `/apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles?PacienteId=${pacienteId}&EspecialidadId=${espId}&FechaDeseada=${fechaIso}&ProgramaId=0&PuntoAtencionId=0&PerfilCodigo=PROFESIONAL&swParticular=false&presupuestoId=0`;

    try {
      const res = await pageFetchJson(path1, { method: "POST", body: "{}", __idempotent: true });
      const list = extractAgendasList(res);
      if (list && list.length) return res;
    } catch (e) {}

    try {
      const res2 = await pageFetchJson(path2, { method: "POST", body: "{}", __idempotent: true });
      if (propagarError && res2 == null) throw new Error("apiAccesoBuscarCitasDisponibles: ninguna vía dio una respuesta real");
      return res2;
    } catch (e) {
      if (propagarError) throw e;
      return {};
    }
  }

  // Calcula una fecha X días hábiles ANTES de una fecha ISO dada (omitiendo fines de semana)
  function calcBusinessDaysBefore(isoDateStr, daysBefore = 5) {
    const parts = isoDateStr.split("-");
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    let count = 0;
    while (count < daysBefore) {
      dt.setDate(dt.getDate() - 1);
      if (dt.getDay() !== 0 && dt.getDay() !== 6 && !esFestivo(dt)) count++;
    }
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const mm = pad(dt.getMonth() + 1);
    const dd = pad(dt.getDate());
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      fmt: `${dd}/${mm}/${yyyy}`,
      dayLbl: dt.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
    };
  }

  // Helper para POST Cross-Domain vía GM_xmlhttpRequest (AppCita)
  const gmPostJson = async (url, data = {}) => {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest === "undefined") { resolve(null); return; }
      GM_xmlhttpRequest({
        method: "POST",
        url: url,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(data),
        timeout: 10000,
        onload: (res) => {
          try { resolve(JSON.parse(res.responseText)); } catch (e) { resolve(null); }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null)
      });
    });
  };

  // v11.0.1 — Igual que gmPostJson pero además informa del RESULTADO HTTP. Hacía falta
  // porque el agendamiento de laboratorio daba por buena la cita sin mirar la respuesta.
  // Se añade aparte para no cambiar el valor de retorno de gmPostJson, que usan otros
  // puntos del script.
  const gmPostJsonEx = async (url, data = {}) => {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest === "undefined") { resolve({ ok: false, status: 0, data: null }); return; }
      GM_xmlhttpRequest({
        method: "POST", url, headers: { "Content-Type": "application/json" },
        data: JSON.stringify(data), timeout: 15000,
        onload: (r) => {
          let parsed = null;
          try { parsed = JSON.parse(r.responseText); } catch (e) {}
          resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, data: parsed, text: r.responseText });
        },
        onerror: () => resolve({ ok: false, status: 0, data: null }),
        ontimeout: () => resolve({ ok: false, status: 0, data: null }),
      });
    });
  };

  // v12.3.32 — BLINDAJE del emparejamiento de horas con AppCita: la hora elegida en el
  // modal y la hora que devuelve ObtenerTurnosPorFecha en el momento de confirmar pueden
  // venir con formatos distintos ("6:40:00" vs "06:40:00" vs "06:40") aunque sean EL MISMO
  // turno. Comparar las cadenas crudas hacía que un turno perfectamente libre se declarara
  // "ya no disponible" (captura real: el toast listaba como libre la MISMA hora que decía
  // ocupada). Se normaliza a "HH:MM" (cero a la izquierda, sin segundos) antes de comparar.
  function normalizeHora(h) {
    const m = /(\d{1,2}):(\d{2})/.exec(String(h || ""));
    if (!m) return String(h || "").trim();
    return m[1].padStart(2, "0") + ":" + m[2];
  }

  function perfilPaciente(etiquetas) {
    if (!etiquetas || !Array.isArray(etiquetas) || etiquetas.length === 0) {
      return { franja: "sin_preferencia", adicionales: "visibles" };
    }

    const norm = etiquetas.map(e => {
      return String(e || "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .replace(/\//g, "+");
    });

    let tieneDM = false;
    let tieneNefro = false;
    let tieneHTA = false;
    let etiquetaReconocida = false;

    for (const e of norm) {
      if (e.includes("diabetes") || e.includes("hta+dm")) {
        tieneDM = true;
        etiquetaReconocida = true;
      }
      if (e.includes("nefroproteccion")) {
        tieneNefro = true;
        etiquetaReconocida = true;
      }
      if (e.includes("hipertension") || e === "hta") {
        tieneHTA = true;
        etiquetaReconocida = true;
      }
    }

    if (!etiquetaReconocida) {
      return { franja: "sin_preferencia", adicionales: "visibles" };
    }

    // D3-bis: La diabetes es la única que impone franja.
    const franja = tieneDM ? "primera_mitad" : "sin_preferencia";

    // D3-bis: Eje B es una lista de exclusiones.
    let adicionales = "visibles";
    if (tieneDM || tieneNefro) {
      adicionales = false;
    } else if (tieneHTA) {
      adicionales = true;
    }

    return { franja, adicionales };
  }

  function recomendacionHorario(perfil, turnosDelDia) {
    if (!perfil || perfil.franja !== "primera_mitad" || !turnosDelDia || turnosDelDia.length === 0) {
      return { sugerida: null, rangoTexto: null, horasEnFranja: [] };
    }

    const horasAM = [];
    const horasPM = [];

    for (const t of turnosDelDia) {
      const hStr = normalizeHora(t.hora || t.horaTexto || t.Hora || "");
      if (!hStr) continue;
      const m = /^(\d{2}):(\d{2})$/.exec(hStr);
      if (!m) continue;

      const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

      if (mins >= 360 && mins <= 540) horasAM.push({ original: hStr, mins });
      if (mins >= 780 && mins <= 960) horasPM.push({ original: hStr, mins });
    }

    const franjas = [];
    let candidatos = [];

    if (horasAM.length > 0) {
      franjas.push("AM 06:00–09:00");
      candidatos = candidatos.concat(horasAM);
    }
    if (horasPM.length > 0) {
      franjas.push("PM 13:00–16:00");
      candidatos = candidatos.concat(horasPM);
    }

    if (candidatos.length === 0) {
      return { sugerida: null, rangoTexto: null, horasEnFranja: [] };
    }

    candidatos.sort((a, b) => a.mins - b.mins);
    const sugerida = candidatos[0].original;
    const horasEnFranja = [...new Set(candidatos.map(c => c.original))];

    return {
      sugerida,
      rangoTexto: franjas.join(" y "),
      horasEnFranja
    };
  }

  // v14.0.0 — CITAS ADICIONALES (encargo del médico, 12-ago): «Las horas de la agenda
  // 7:30, 9:30, 11:30, 1:30, 3:30 y 5:30 (según la jornada que aplique) se deben resaltar
  // con otros colores y otros elementos visuales, ya que esas citas se consideran
  // adicionales a las de cada 20 minutos normales de las agendas».
  // Dos fuentes, en este orden:
  //  1. El CAMPO del turno, si Everest lo trae (clasificaCupoAgenda ya sabía leerlo, pero
  //     llevaba desde su commit sin un solo llamador). Es la fuente autoritativa.
  //  2. Si el campo no viene o no se reconoce, la LISTA DE HORAS que dio el médico. Es una
  //     heurística, no un dato de Everest — por eso se marca aparte en el retorno, para no
  //     presentar como confirmado algo que se dedujo del reloj.
  const HORAS_ADICIONALES = ["07:30", "09:30", "11:30", "13:30", "15:30", "17:30"];
  function esCupoAdicional(turno, horaNorm) {
    const campo = turno && (turno.tipoCupo || turno.TipoCupo || turno.tipo || turno.Tipo ||
                            turno.clasificacion || turno.Clasificacion || turno.cupo || turno.Cupo);
    const porCampo = clasificaCupoAgenda(campo);
    if (porCampo === "adicional") return { adicional: true, fuente: "campo" };
    if (porCampo === "normal") return { adicional: false, fuente: "campo" };
    return { adicional: HORAS_ADICIONALES.indexOf(String(horaNorm || "")) !== -1, fuente: "hora" };
  }

  function clasificaCupoAgenda(valorCampoAgenda) {
    if (!valorCampoAgenda) return "desconocido";
    const norm = String(valorCampoAgenda)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");

    if (norm === "adicional" || norm === "adicional-staff") {
      return "adicional";
    }
    if (norm === "normal") {
      return "normal";
    }
    return "desconocido";
  }

  function format12hTime(timeStr) {
    if (!timeStr) return "";
    const parts = String(timeStr).split(":");
    let hh = parseInt(parts[0], 10);
    if (isNaN(hh)) return String(timeStr);
    const mm = parts[1] || "00";
    const ampm = hh >= 12 ? "PM" : "AM";
    if (hh === 0) hh = 12;
    else if (hh > 12) hh -= 12;
    return `${String(hh).padStart(2, "0")}:${mm} ${ampm}`;
  }

  // Interfaz API: Agendamiento Automático de Citas de Laboratorio (AppCita V2)
  // v12.3.31 — celular es OPCIONAL: sin él (llamadas existentes que no lo pasan) el
  // comportamiento no cambia, solo se agrega la posibilidad de mandar el SMS de
  // confirmación cuando quien llama SÍ tiene el número a mano.
  async function apiLaboratorioAgendarAuto(docId, fechaIso, horaSeleccionada, celular) {
    try {
      const urlTurnos = `https://appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/ObtenerTurnosPorFecha?sedeId=378&fechaBuscar=${fechaIso}`;
      const resAg = await gmPostJson(urlTurnos, {});
      const turnos = extractAgendasList(resAg);
      // v11.0.1 — SIN "cupo por defecto". Antes, si la hora elegida por el médico ya no
      // estaba libre (o no venía), se caía a `turnos[0]`: el paciente quedaba citado
      // EN SILENCIO en el primer cupo del día (normalmente las 6:00 a. m.), una hora que
      // nadie eligió y que el médico nunca llegaba a ver.
      let turnoElegido = null;
      if (turnos && turnos.length && horaSeleccionada) {
        // v12.3.31 — antes solo probaba t.hora (minúscula): si el turno traía la hora en
        // t.Hora (mayúscula, el nombre confirmado contra el código fuente real del front
        // de AppCita para AgendaId/Hora) nunca calzaba con la elegida, y el flujo caía
        // SIEMPRE por la rama de "ya no está disponible" aunque el cupo siguiera libre —
        // mismos 3 candidatos que ya usa la lista de "otrasHoras" un poco más abajo.
        // v12.3.32 — y además se compara la hora NORMALIZADA (ver normalizeHora): la
        // captura real mostró el toast de "no disponible" listando como libre la MISMA
        // hora rechazada — formato distinto, mismo turno.
        const buscada = normalizeHora(horaSeleccionada);
        turnoElegido = turnos.find((t) => normalizeHora(t.hora || t.horaTexto || t.Hora || "") === buscada) || null;
      }
      if (!turnoElegido) {
        // v12.3.25 — Reportado en consultorio: "no me asigna nada y no dice qué más hay
        // disponible". La hora elegida ya se ocupó entre que se consultó (al abrir el
        // modal) y que se confirmó la cita — pero la respuesta que se acaba de recibir
        // (`turnos`) YA trae la disponibilidad real de ese mismo día, y se estaba
        // descartando sin mostrarla. En vez de mandar al médico a mirar a ciegas en
        // AppCita, se listan aquí los horarios que SÍ siguen libres — sin reservar
        // ninguno solo (ver v11.0.1 más arriba: nunca un cupo por defecto sin que el
        // médico lo haya visto y elegido).
        // v12.3.32 — lista ACOTADA (captura real: un muro de 50+ horas ilegible tapaba el
        // mensaje). Se muestran las primeras 8 y se dice cuántas más hay; el modal, que
        // se recarga solo tras el fallo, es donde se ve la lista completa.
        const otrasHoras = [...new Set((turnos || []).map((t) => normalizeHora(t.hora || t.horaTexto || t.Hora)).filter(Boolean))];
        const muestra = otrasHoras.slice(0, 8).map(format12hTime).join(", ");
        const resto = otrasHoras.length > 8 ? ` y ${otrasHoras.length - 8} horarios más (véalos en el panel)` : "";
        // v12.3.33 — el texto anterior prometía "el panel acaba de refrescar" también
        // cuando se llega desde el modal principal, que NO refresca y se cierra solo a
        // los 2,6 s. Se indica la ruta de reintento que funciona en AMBOS contextos.
        const sugerencia = otrasHoras.length
          ? ` Siguen libres ese día: ${muestra}${resto}. Elija otro horario y reintente; si este panel ya se cerró, use el botón 🧪 de la tarjeta del paciente para reintentar solo la toma de muestras.`
          : " Ese día ya no quedan horarios libres de laboratorio en AppCita.";
        spToast(`⚠ El horario de laboratorio elegido (${format12hTime(horaSeleccionada)}) ya no está disponible.${sugerencia} NO se agendó la toma de muestras.`, 14000);
        return false;
      }
      // v11.0.1 — Sin valores fabricados: el "07:00:00" y sobre todo el agendaId
      // "282531" estaban cableados, de modo que un turno sin datos habría citado al
      // paciente en una agenda arbitraria. Ahora, si falta cualquiera de los dos, se aborta.
      // v12.3.33 — hallado en revisión adversarial: aquí solo se leía turnoElegido.hora
      // (minúscula), así que cuando el turno trae la hora como Hora/horaTexto (los mismos
      // candidatos que YA usa el emparejador de arriba), se caía al string viejo del modal
      // — enviando a AgendarCita una hora con formato que ese turno nunca tuvo. Se envía
      // la hora TAL CUAL la trae el turno recién consultado, igual que hace el front
      // oficial de AppCita (row.Hora verbatim).
      const horaFinal = turnoElegido.hora || turnoElegido.horaTexto || turnoElegido.Hora || horaSeleccionada;
      // v12.3.31 — CONFIRMADO contra el código fuente real del front de AppCita
      // (agente-calendario.component.ts, pegado en consultorio): `agendarCita(row, ...)`
      // usa `row.AgendaId` TAL CUAL, sin pasar por ningún mapeo a minúsculas — a
      // diferencia de `consultarCita()`, que sí baja todo a minúsculas para el
      // calendario. `agendaId`/`id` (lo único que se probaba antes) nunca se confirmaron
      // contra una respuesta real; quedan de respaldo por si AppCita cambia el casing,
      // pero el nombre real confirmado va primero.
      const agendaId = turnoElegido.AgendaId || turnoElegido.agendaId || turnoElegido.id;
      // v12.3.31 — Mismo dígitos-solamente que ya usa apiAccesoAsignarTurno (línea
      // ~6141): sin esto un celular con espacios/guiones llegaba tal cual al parámetro.
      // v11.0.1 — El número 3022813246 estaba CABLEADO: se enviaba como teléfono de
      // TODOS los pacientes. Ahora, sin celular real conocido, va el literal 0 — lo que
      // manda la aplicación oficial cuando no lleva número (4 de 6 capturas reales).
      const telParam = celular ? String(celular).replace(/\D/g, "") : "0";
      // v12.3.31 — NombrePaciente=%20 (espacio CODIFICADO): la captura real del front
      // manda el espacio como %20; el literal " " sin codificar que había antes quedaba
      // como URL mal formada, aunque el servidor lo tolerara.
      const urlBook = `https://appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/AgendarCita?sedeId=378&Identificacion=${encodeURIComponent(docId)}&AgendaId=${agendaId}&NombrePaciente=%20&Telefono=${telParam}&Correo=&Hora=${encodeURIComponent(horaFinal)}&FechaCita=${fechaIso}&generaImpresion=false&LugarCreacion=Vigilante`;
      const resBook = await gmPostJsonEx(urlBook, {});
      console.log("[Vigilante Lab] AgendarCita →", resBook.status, resBook.text);

      // v12.3.31 — ÉXITO ESTRICTO, igual que AsignarTurno (v11.0.1) y ahora confirmado
      // también aquí contra el código fuente real: `agendarConfirmado()` en el front SOLO
      // da la cita por creada si `x['error']==false`, y saca el radicado de `x['radicado']`
      // — plano, no anidado bajo `.data` como en la respuesta de Everest. Antes de esto
      // solo se miraba el HTTP 200, que AppCita también devuelve cuando RECHAZA la cita
      // (el cuerpo trae error:true): un rechazo real podía anunciarse como éxito.
      const body = resBook.data;
      const creada = !!(resBook.ok && body && body.error === false);
      if (!creada) {
        spToast(`❌ No se pudo confirmar la cita de laboratorio (respuesta ${resBook.status || "sin conexión"}). Agéndela manualmente en AppCita.`);
        return false;
      }
      const radicado = body.radicado;

      // v11.0.1 — RETIRADO el SMS de laboratorio. Iba a un número cableado (no al del
      // paciente) y con codigoCita=AgendaId, que es el identificador de la AGENDA, no el
      // de la cita: en las capturas reales un mismo AgendaId genera varios codigoCita
      // distintos.
      // v12.3.31 — REACTIVADO: el código fuente real de AppCita (enviarSMS(), llamado
      // justo después de agendarConfirmado()) confirma que codigoCita es el `radicado`
      // de la respuesta de AgendarCita — no AgendaId — y que el endpoint es un GET a
      // /API/EnviarMensajeTextoLaboratorio con Celular/Fecha/Hora/codigoCita/codigoSede.
      // Solo se envía si YA se conoce el celular real del paciente (igual que exige el
      // propio front: "El número de celular es obligatorio para poder recibir el sms").
      let smsEnviado = false;
      if (celular && radicado) {
        try {
          const urlSms = `https://appcita.viva1a.com.co:8051/API/EnviarMensajeTextoLaboratorio?Celular=${encodeURIComponent(telParam)}&Fecha=${fechaIso}&Hora=${encodeURIComponent(horaFinal)}&codigoCita=${encodeURIComponent(radicado)}&codigoSede=378`;
          // v12.3.33 — hallado en revisión adversarial: _gmReq resuelve con CUALQUIER
          // estado HTTP (incluidos 4xx/5xx), así que un rechazo del servicio de SMS se
          // anunciaba igual como "Se envió SMS" y el médico se saltaba el recordatorio
          // verbal. Solo se declara enviado con estado 2xx — el mismo estándar estricto
          // que la reserva de arriba.
          const rSms = await _gmReq({ method: "GET", url: urlSms });
          smsEnviado = !!(rSms && rSms.status >= 200 && rSms.status < 300);
        } catch (e) { console.warn("[Vigilante Lab] error enviando SMS de laboratorio:", e); }
      }

      spToast(`🧪 Cita de Laboratorio agendada en AppCita para el ${fechaIso} a las ${format12hTime(horaFinal)}.` + (smsEnviado ? " Se envió SMS de recordatorio." : " El paciente NO recibe SMS del laboratorio: recuérdeselo."));
      return true;
    } catch(e) { console.warn("[Vigilante Lab] error agendando laboratorio:", e); return false; }
  }

  // Interfaz API: Finalizar Ticket Digiturno al terminar atención
  async function apiDigiturnoFinalizarTicket(citaId) {
    if (!citaId) return;
    const uId = state.activeDoctor.id || S.medicoId || 0;
    const b64Cita = btoa(String(citaId));
    const path = `/apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket?tipoIntegracion=IntegracionDigiturno&TicketId=0&UsuarioId=${uId}&EverestId=${encodeURIComponent(b64Cita)}`;
    try { await pageFetchJson(path); } catch (e) {}
  }

  // Interfaz API: Obtener Laboratorios Annar y Citi por PacienteId
  async function apiAccesoObtenerLaboratoriosAnnar(pacienteId) {
    const path = `/apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioAnnar?pacienteId=${pacienteId}`;
    try { return await pageFetchJson(path); } catch (e) { return null; }
  }
  async function apiAccesoObtenerLaboratoriosCiti(pacienteId) {
    const path = `/apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioCiti?pacienteId=${pacienteId}`;
    try { return await pageFetchJson(path); } catch (e) { return null; }
  }

  // v14.0.0 (T6) — Órdenes VIGENTES ya existentes en Everest para el paciente, para no
  // pedirle al médico (banner de T7) algo que ya se ordenó. La respuesta real capturada en
  // consultorio superó los 20.000 caracteres (truncada por el grabador de red): es pesada,
  // así que se cachea por paciente además de la deduplicación que pageFetchJson ya trae vía
  // GHOST.promises (esa solo evita llamadas CONCURRENTES idénticas, no repetir la consulta
  // en cada tick mientras el médico sigue con el mismo paciente abierto).
  let _ordenesVigentesCache = { pacienteId: "", data: null, ts: 0 };
  const ORDENES_VIGENTES_TTL_MS = 10 * 60000;
  function _ordenesVigentesInvalidar() { _ordenesVigentesCache = { pacienteId: "", data: null, ts: 0 }; }
  async function apiHcObtenerOrdenamientosVigentes(pacienteId) {
    if (!pacienteId) return null;
    const key = String(pacienteId);
    const ahora = Date.now();
    if (_ordenesVigentesCache.pacienteId === key && _ordenesVigentesCache.data &&
        (ahora - _ordenesVigentesCache.ts) < ORDENES_VIGENTES_TTL_MS) {
      return _ordenesVigentesCache.data;
    }
    const path = `/apiviva/APIHCHealth/api/Historicos/ObtenerOrdenamientoPorPacienteIdVigente?pacienteid=${encodeURIComponent(key)}`;
    try {
      const data = await pageFetchJson(path);
      // Solo se cachea una respuesta EXITOSA y utilizable (un arreglo — vacío incluido: un
      // paciente sin órdenes vigentes es un resultado real, no un fallo). Cualquier otra
      // forma (null, objeto, string) es una respuesta inesperada: ni se cachea ni se
      // devuelve como si fuera válida — sube como null, igual que un fallo de red, para que
      // pymCubiertoPorOrdenVigente la trate con la misma prudencia ("fallo = no cubierto").
      if (!Array.isArray(data)) return null;
      _ordenesVigentesCache = { pacienteId: key, data, ts: Date.now() };
      return data;
    } catch (e) {
      console.warn("[Vigilante] apiHcObtenerOrdenamientosVigentes falló:", e);
      return null;
    }
  }

  // v14.1.0 (R1b) — SIGNOS VITALES: la única pieza que le faltaba al motor renal.
  // El médico decidió el 14-ago-2026 que la fórmula que gobierna el estadio es
  // COCKCROFT-GAULT, y esa fórmula necesita el PESO REAL, que hasta hoy no existía en
  // ninguna parte del script (verificado por grep: las únicas apariciones de "peso" eran
  // comentarios de la fórmula y una variable de bytes de telemetría).
  //
  // Endpoint verificado EN VIVO en consultorio el 12-08-2026 con sesión real de Everest
  // (documentado en PROMPT_JULES_R1_TFG_KDIGO.md:129-148). Respuesta real observada:
  //   [{"fechaRegistro":"2026-08-12T18:56:06.535-05:00","presionSistolica":120,...,
  //     "peso":65.0,"talla":152.0,"imc":28.13}]
  // Un ARRAY con el registro más reciente PRIMERO. Se usa el primer elemento; si el array
  // viene vacío, peso/talla quedan ausentes y NO se inventa un valor por defecto — un peso
  // inventado saldría por la fórmula convertido en un estadio renal falso.
  //
  // Misma caché por paciente y mismo TTL que las órdenes vigentes: durante una consulta el
  // peso no cambia, y este endpoint se consulta desde un flujo que puede repetirse.
  let _signosVitalesCache = { pacienteId: "", data: null, ts: 0 };
  function _signosVitalesInvalidar() { _signosVitalesCache = { pacienteId: "", data: null, ts: 0 }; }
  // v14.1.8 — Tabla de validación por examen de la propia IPS (rangos + UNIDAD), por cita.
  // Cacheada por citaId con el mismo TTL que las demás: dentro de una consulta la
  // parametrización no cambia, y son datos de configuración, no del paciente.
  // No hay `_validacionExamenInvalidar`: se escribió por simetría con las otras cachés y
  // se borró antes de subirla, porque no hay ni un evento que deba invalidarla. Es
  // parametrización de la IPS, no dato del paciente; la caché va por citaId, así que otro
  // paciente ya falla por clave, y el TTL cubre un cambio de configuración a media
  // jornada. Una función que nadie llama es la deuda que este proyecto ya arrastró tres
  // veces (`_bannerPymInvalidar` vivió versiones enteras sin un solo llamador).
  function _base64SinRelleno(txt) {
    const s = String(txt == null ? "" : txt);
    if (!s) return "";
    try { return btoa(s).replace(/=+$/, ""); } catch (e) { return ""; }
  }
  let _validacionExamenCache = { citaId: "", data: null, ts: 0 };
  async function apiHcValidacionExamenCronicos(citaId) {
    if (!citaId) return null;
    const key = String(citaId);
    const ahora = Date.now();
    if (_validacionExamenCache.citaId === key && _validacionExamenCache.data &&
        (ahora - _validacionExamenCache.ts) < ORDENES_VIGENTES_TTL_MS) {
      return _validacionExamenCache.data;
    }
    // El parámetro NO es el id en claro: la captura real lo trae como
    // `citaId=MTIyMTk3NA`, que es base64 de "1221974" con el relleno `=` quitado — el
    // mismo formato que ya usa apiDigiturnoFinalizarTicket (`btoa(String(citaId))`).
    // Mandar el número en claro era pedirle al servidor una cita que no existe. Se
    // reproduce exactamente lo observado en el tráfico, relleno incluido (es decir,
    // quitado), en vez de suponer que el servidor también aceptaría la otra forma.
    const b64 = _base64SinRelleno(key);
    if (!b64) return null;
    const path = `/apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos?citaId=${encodeURIComponent(b64)}`;
    try {
      const data = await pageFetchJson(path);
      // Misma prudencia que en los demás: SOLO un arreglo es una respuesta utilizable.
      // Vacío incluido — una cita sin parametrización es un resultado real, y significa
      // "no hay reglas oficiales", que es distinto de "no se pudo consultar".
      if (!Array.isArray(data)) return null;
      _validacionExamenCache = { citaId: key, data, ts: Date.now() };
      return data;
    } catch (e) {
      console.warn("[Vigilante] apiHcValidacionExamenCronicos falló:", e);
      return null;
    }
  }

  // ---------------------------------------------------------------------
  //  v14.1.8 — OYENTE PASIVO: la tabla oficial se ESCUCHA, no se pide.
  //
  //  El `citaId` que necesita el endpoint NO está en la URL de la historia clínica
  //  (`/viva/HCHealth/` a secas, comprobado en la captura) ni en ningún sitio que el
  //  script pueda leer estando en esa vista: vive dentro del estado de Angular. Pedirla
  //  desde aquí exigiría adivinar un identificador, que es justo lo que este proyecto
  //  tiene prohibido.
  //
  //  Pero no hace falta pedirla: al abrir la Ruta Crónicos, **Everest la pide sola**. Se
  //  observa esa respuesta y ya está. Sale gratis (ni una petición más contra el servidor
  //  de la IPS) y no hay identificador que adivinar.
  //
  //  El oyente es de SOLO LECTURA y no puede romper Everest:
  //   · `open` únicamente anota la URL en la propia instancia del XHR;
  //   · la lectura va en un `addEventListener("load")`, no en `onload`, así que no pisa
  //     el manejador de Everest (asignarlo lo habría reemplazado);
  //   · una excepción dentro de un listener no impide que corran los demás ni altera el
  //     XHR — y aun así todo va dentro de try/catch;
  //   · nunca se toca `xhr.response` ni se modifica nada de la petición.
  //  Se lee `xhr.response` y no `responseText` porque Angular pone
  //  `responseType = "json"`, y ahí `responseText` LANZA (lección de v14.1.7 con el mapa).
  // ---------------------------------------------------------------------
  let _tablaOficialVista = { tabla: null, ts: 0 };
  const TABLA_OFICIAL_TTL_MS = 1800000;   // 30 min: es configuración de la IPS, no del paciente
  const _RE_VALIDACION_EXAMEN = /GetValidacionExamenCronicos/i;
  function _guardarTablaOficialVista(data) {
    if (!Array.isArray(data) || !data.length) return false;
    _tablaOficialVista = { tabla: data, ts: Date.now() };
    return true;
  }
  // La tabla que Everest cargó en esta vista, o null si no se ha visto (o ya caducó).
  function _tablaOficialVigente() {
    if (!_tablaOficialVista.tabla) return null;
    if ((Date.now() - _tablaOficialVista.ts) > TABLA_OFICIAL_TTL_MS) return null;
    return _tablaOficialVista.tabla;
  }
  function _instalarOyenteTablaOficial(win) {
    const w = win || (typeof window !== "undefined" ? window : null);
    if (!w || !w.XMLHttpRequest || w.__vglOyenteTablaOficial) return false;
    const XHR = w.XMLHttpRequest.prototype;
    const openOriginal = XHR.open;
    if (typeof openOriginal !== "function") return false;
    XHR.open = function (metodo, url) {
      try { this.__vglUrl = String(url || ""); } catch (e) {}
      try {
        if (_RE_VALIDACION_EXAMEN.test(this.__vglUrl || "")) {
          this.addEventListener("load", () => {
            try {
              const cuerpo = this.response;
              const datos = typeof cuerpo === "string" ? JSON.parse(cuerpo) : cuerpo;
              if (_guardarTablaOficialVista(datos)) {
                console.log("[Vigilante] tabla oficial de exámenes capturada de Everest:", datos.length, "reglas");
              }
            } catch (e) { /* jamás se propaga nada hacia Everest */ }
          });
        }
      } catch (e) {}
      return openOriginal.apply(this, arguments);
    };
    w.__vglOyenteTablaOficial = true;
    return true;
  }

  async function apiHcObtenerSignosVitales(pacienteId) {
    if (!pacienteId) return null;
    const key = String(pacienteId);
    const ahora = Date.now();
    if (_signosVitalesCache.pacienteId === key && _signosVitalesCache.data &&
        (ahora - _signosVitalesCache.ts) < ORDENES_VIGENTES_TTL_MS) {
      return _signosVitalesCache.data;
    }
    const path = `/apiviva/APIHCHealth/api/Historicos/ObtenerHistoricoSignosVitales?PacienteId=${encodeURIComponent(key)}`;
    try {
      const data = await pageFetchJson(path);
      // Mismo criterio de prudencia que apiHcObtenerOrdenamientosVigentes: solo un ARRAY
      // es una respuesta utilizable (vacío incluido — un paciente sin signos vitales
      // registrados es un resultado real). Cualquier otra forma sube como null.
      if (!Array.isArray(data)) return null;
      _signosVitalesCache = { pacienteId: key, data, ts: Date.now() };
      return data;
    } catch (e) {
      console.warn("[Vigilante] apiHcObtenerSignosVitales falló:", e);
      return null;
    }
  }

  // v14.1.0 (R1b) — Extrae el peso del registro MÁS RECIENTE. Devuelve
  // { peso, fechaRegistro } o null. No promedia ni rellena: si el registro más nuevo no
  // trae peso utilizable, es null aunque uno más viejo sí lo tuviera — un peso de hace
  // dos años no describe a este paciente hoy, y la fórmula no tiene forma de saberlo.
  function _pesoDeSignosVitales(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    const r = arr[0];
    if (!r || typeof r !== "object") return null;
    // v14.1.3 — Pasa por _labNumerico en vez de Number() a secas. La captura real de
    // consultorio trae `"peso":65.0` como NÚMERO, así que Number() bastaba hoy; pero si
    // alguna instalación devolviera "72,5" (coma decimal, formato local) o "70 kg",
    // Number() daría NaN y se descartaría un peso VÁLIDO — y sin peso no hay
    // Cockcroft-Gault, así que el paciente se quedaría sin estadificación por un formato.
    const peso = _labNumerico(r.peso);
    if (peso == null) return null;
    return { peso, fechaRegistro: r.fechaRegistro || "" };
  }

  // v14.1.1 (R1b) — EDAD y SEXO del paciente. Los dos vienen del MISMO endpoint que el
  // script ya llamaba desde hace versiones (`BuscarPacienteDetallado`, en el modal de
  // agendamiento y en el de ordenamiento): el sexo ya se leía, pero la EDAD viajaba en la
  // respuesta y nadie la tocaba — verificado contra la captura real de consultorio
  // (`captura_agendamiento_oficial_20260810.json`: `"edad": 82, "edadAnos": 82`). Sin ella
  // no hay ninguna de las dos fórmulas renales, así que era el hueco más barato de cerrar
  // de toda la cadena. Se extrae aquí, cacheado por paciente, para no repetir la llamada.
  let _demograficosCache = { pacienteId: "", data: null, ts: 0 };
  function _demograficosInvalidar() { _demograficosCache = { pacienteId: "", data: null, ts: 0 }; }
  async function apiAccesoObtenerDemograficos(pacienteId) {
    if (!pacienteId) return null;
    const key = String(pacienteId);
    const ahora = Date.now();
    if (_demograficosCache.pacienteId === key && _demograficosCache.data &&
        (ahora - _demograficosCache.ts) < ORDENES_VIGENTES_TTL_MS) {
      return _demograficosCache.data;
    }
    try {
      const det = await pageFetchJson(`/apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado?idPaciente=${encodeURIComponent(key)}`);
      const d = det && det.data;
      if (!d || typeof d !== "object") return null;
      // `edad` es el campo visto en la captura real; `edadAnos` se acepta como sinónimo por
      // si otra versión del backend lo nombra así. NO se deriva de fecha_Nacimiento: sería
      // recalcular a mano algo que el servidor ya entrega hecho.
      const edadN = Number(d.edad != null ? d.edad : d.edadAnos);
      const out = {
        edad: Number.isFinite(edadN) && edadN > 0 ? edadN : null,
        sexo: String(d.sexo == null ? "" : d.sexo).trim(),
      };
      _demograficosCache = { pacienteId: key, data: out, ts: Date.now() };
      return out;
    } catch (e) {
      console.warn("[Vigilante] apiAccesoObtenerDemograficos falló:", e);
      return null;
    }
  }

  // v14.1.1 (R1b) — Saca del arreglo de laboratorios la creatinina SÉRICA más reciente con
  // su fecha. Reutiliza `_ultimaFechaPorAnalito`, que ya resuelve lo difícil: casar el
  // nombre contra la whitelist, descartar los PENDIENTE y quedarse con la fecha más nueva
  // cuando el mismo analito viene repetido. La entrada CREATININA del whitelist ya excluye
  // ORINA/CREATINURIA/DEPURAC/24 H, así que aquí no puede colarse una creatinina en orina.
  function _creatininaDeLabs(labsArray) {
    try {
      const { candidatos } = _ultimaFechaPorAnalito(labsArray);
      const c = candidatos && candidatos.get("CREATININA");
      if (!c) return null;
      return { crudo: c.resultVal, fechaIso: c.resultDate || "" };
    } catch (e) { return null; }
  }

  // v14.1.0 (R1b) — EL ORQUESTADOR. Junta las cuatro entradas y devuelve el estadio, o
  // dice EXACTAMENTE qué falta. Aquí vive toda la seguridad clínica de esta función:
  //
  //  1. Es PURA (no hace red): recibe ya resueltos edad/peso/creatinina/sexo. Quien la
  //     llama decide cuándo pagar las llamadas. Así se puede probar de verdad.
  //  2. NUNCA devuelve un estadio a medias. Si falta UNA sola entrada, `estadio` es null y
  //     `faltan` nombra cuál — el consumidor debe mostrar el hueco, no rellenarlo. Es la
  //     regla del proyecto ("casilla vacía antes que dato inventado") aplicada al dato con
  //     más consecuencias de todo el script: de este estadio cuelga qué exámenes se piden.
  //  3. La fórmula que MANDA es Cockcroft-Gault — decisión del médico del 14-ago-2026,
  //     frente a CKD-EPI (que no habría necesitado el peso y era más barata de implementar).
  //     Se calcula CKD-EPI igualmente, solo para contrastar: `evaluarDiscordanciaTFG` ya
  //     existía escrita para esto y hasta hoy nadie la llamaba.
  //  4. La creatinina se pasa por `_labNumerico`: los LIS mandan "> 5,0" y `Number()` daría
  //     NaN. Un NaN aquí se lo tragarían las guardas de las fórmulas devolviendo 0, y un 0
  //     no es "no evaluable" para `estadioKDIGO` — devolvería G5, el estadio más grave.
  //     Por eso la creatinina se valida ANTES de entrar a la fórmula, no después.
  //
  // Devuelve siempre un objeto (nunca null) para que el consumidor no tenga que distinguir
  // "no se pudo" de "se rompió":
  //   { estadio, tfg, formula, faltan: [], entradas: {...}, discordancia }
  function estadioRenalDelPaciente(opts) {
    // `= {}` en la firma solo cubre `undefined`, NO `null` — desestructurar null lanza.
    // Un llamador que pase el resultado de otra función que devolvió null es el caso obvio.
    const { edad, peso, creatininaCruda, sexo, fechaCreatinina, fechaPeso } = (opts || {});
    const faltan = [];
    const edadN = Number(edad);
    if (Number.isFinite(edadN) && edadN > 0 && edadN < 18) faltan.push("edad_pediatrica");
    else if (!Number.isFinite(edadN) || edadN <= 0 || edadN > 120) faltan.push("edad");
    const pesoN = Number(peso);
    if (!Number.isFinite(pesoN) || pesoN <= 0) faltan.push("peso");
    else if (pesoN < 20 || pesoN > 300) faltan.push("peso_fuera_de_rango");
    const creatN = _labNumerico(creatininaCruda);
    if (creatN == null) faltan.push("creatinina");
    else if (creatN < 0.1 || creatN > 20) faltan.push("creatinina_fuera_de_rango");
    // El sexo NO bloquea: sin él la fórmula corre igual (el factor 0.85 solo se aplica a
    // mujeres), pero se anota, porque un sexo ausente sesga la TFG al alza en una mujer.
    const sexoTxt = String(sexo == null ? "" : sexo).trim();

    const entradas = {
      edad: Number.isFinite(edadN) && edadN > 0 ? edadN : null,
      peso: Number.isFinite(pesoN) && pesoN > 0 ? pesoN : null,
      creatinina: creatN,
      creatininaCruda: creatininaCruda == null ? "" : String(creatininaCruda),
      sexo: sexoTxt,
      fechaCreatinina: fechaCreatinina || "",
      fechaPeso: fechaPeso || "",
    };

    if (faltan.length) {
      return { estadio: null, tfg: null, formula: "Cockcroft-Gault", faltan, entradas, discordancia: null, sexoAusente: !sexoTxt };
    }

    const tfgCG = cockcroftGault(edadN, pesoN, creatN, sexoTxt);
    if (!(tfgCG > 0)) {
      // Las fórmulas devuelven el centinela 0 = "no evaluable". No se degrada a un estadio.
      return { estadio: null, tfg: null, formula: "Cockcroft-Gault", faltan: ["tfg_no_evaluable"], entradas, discordancia: null, sexoAusente: !sexoTxt };
    }
    const tfgCKD = ckdEpi2021(edadN, creatN, sexoTxt);
    return {
      estadio: estadioKDIGO(tfgCG),
      tfg: tfgCG,
      formula: "Cockcroft-Gault",
      faltan: [],
      entradas,
      // Contraste informativo con la otra fórmula: no cambia el estadio que manda, pero un
      // desacuerdo grande merece verse (bajo peso muscular, obesidad, amputados…).
      discordancia: evaluarDiscordanciaTFG(tfgCG, tfgCKD),
      tfgCkdEpi: tfgCKD > 0 ? tfgCKD : null,
      sexoAusente: !sexoTxt,
    };
  }

  // v14.1.1 (R1b) — EL ENSAMBLADOR: la pieza que faltaba para que el motor renal dejara de
  // estar en modo sombra. `estadioRenalDelPaciente` es puro a propósito (para poder probarlo
  // de verdad); esta función es la que va a buscar sus cuatro entradas al mundo real y se la
  // llama. Es el único sitio del script que paga las llamadas de red del cálculo renal.
  //
  // Las dos consultas van EN PARALELO porque son independientes (demográficos y signos
  // vitales), y las dos están cacheadas por paciente: abrir el modal dos veces seguidas no
  // vuelve a pedirlas. La creatinina NO se pide: se saca de los laboratorios que el modal ya
  // trajo, así que este cálculo no añade ni una consulta de laboratorio.
  //
  // Devuelve exactamente lo mismo que `estadioRenalDelPaciente` (siempre un objeto), así que
  // quien la consuma no tiene que distinguir "no se pudo" de "se rompió".
  async function calcularEstadioRenal(pacienteId, labsArray) {
    const creat = _creatininaDeLabs(labsArray);
    let demo = null, sv = null;
    if (pacienteId) {
      try {
        [demo, sv] = await Promise.all([
          apiAccesoObtenerDemograficos(pacienteId).catch(() => null),
          apiHcObtenerSignosVitales(pacienteId).catch(() => null),
        ]);
      } catch (e) { /* ninguna de las dos lanza; el catch es por si Promise.all se rompe */ }
    }
    const p = _pesoDeSignosVitales(sv);
    return estadioRenalDelPaciente({
      edad: demo && demo.edad,
      peso: p && p.peso,
      creatininaCruda: creat && creat.crudo,
      sexo: demo && demo.sexo,
      fechaCreatinina: creat && creat.fechaIso,
      fechaPeso: p && p.fechaRegistro,
    });
  }

  function _renderEstadioRenalHtml(r) {
    if (!r) return "";
    const ETIQUETA = { edad: "la edad", edad_pediatrica: "edad adulta", peso: "el peso", peso_fuera_de_rango: "el peso", creatinina: "la creatinina", tfg_no_evaluable: "una TFG evaluable" };
    if ((r.faltan || []).indexOf("edad_pediatrica") !== -1) {
      return `<div class="vgl-labs-renal-vacio">🫘 <b>Función renal:</b> no se puede calcular en pacientes menores de 18 años (paciente pediátrico). Las fórmulas Cockcroft-Gault y CKD-EPI solo aplican a adultos.</div>`;
    }
    if ((r.faltan || []).indexOf("creatinina_fuera_de_rango") !== -1) {
      const v = r.entradas && r.entradas.creatininaCruda;
      return `<div class="vgl-labs-renal-vacio">🫘 <b>Función renal:</b> no se puede calcular — la creatinina (<b>${escapeHtml(String(v))}</b>) queda fuera del rango posible en suero (0,1–20 mg/dL). Suele significar que el laboratorio la reportó en otras unidades (µmol/L). <b>Verifíquela antes de usarla:</b> con esas unidades la TFG saldría unas 88 veces menor de lo real.</div>`;
    }
    if (!r.estadio) {
      const faltan = (r.faltan || []).map((f) => ETIQUETA[f] || f);
      const lista = faltan.length > 1
        ? faltan.slice(0, -1).join(", ") + " y " + faltan[faltan.length - 1]
        : (faltan[0] || "un dato");
      const pista = (r.faltan || []).indexOf("peso") !== -1
        ? " El peso se toma de los signos vitales de Everest: si hoy no se le registraron, no aparecerá."
        : "";
      return `<div class="vgl-labs-renal-vacio">🫘 <b>Función renal:</b> no se puede calcular — falta ${escapeHtml(lista)}.${pista}</div>`;
    }
    const e = r.entradas || {};
    const fecha = (iso) => {
      const s = String(iso || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
      return " (" + s.split("-").reverse().join("/") + ")";
    };
    const avisos = [];
    if (r.discordancia && r.discordancia.alerta) {
      avisos.push(`⚠ Cockcroft-Gault y CKD-EPI difieren en ${escapeHtml(String(r.discordancia.diferenciaEstadios))} estadios (${escapeHtml(String(r.discordancia.estadioCG))} vs ${escapeHtml(String(r.discordancia.estadioCKD))}) — suele pasar con peso muy alto o muy bajo. Verifique el peso antes de decidir.`);
    }
    if (r.sexoAusente) avisos.push("⚠ Sin sexo registrado: en una mujer, esto sobreestima la TFG en un 15 %.");
    return `<div class="vgl-labs-renal">
        <div class="vgl-labs-renal-top">🫘 <b>Función renal estimada:</b>
          <span class="vgl-labs-renal-tfg">${escapeHtml(String(r.tfg))} mL/min</span>
          <span class="vgl-labs-renal-estadio">${escapeHtml(String(r.estadio))}</span>
        </div>
        <div class="vgl-labs-renal-det">Por <b>${escapeHtml(String(r.formula))}</b> · creatinina ${escapeHtml(String(e.creatininaCruda || e.creatinina))}${escapeHtml(fecha(e.fechaCreatinina))} · peso ${escapeHtml(String(e.peso))} kg${escapeHtml(fecha(e.fechaPeso))} · ${escapeHtml(String(e.edad))} años${e.sexo ? " · " + escapeHtml(String(e.sexo)) : ""}${r.tfgCkdEpi ? " · CKD-EPI: " + escapeHtml(String(r.tfgCkdEpi)) : ""}</div>
        ${avisos.map((a) => `<div class="vgl-labs-renal-aviso">${a}</div>`).join("")}
      </div>`;
  }

  // v14.0.0 (T6, CORREGIDO tras releer D4 completo en el superprompt — la ventana por
  // año-calendario de la primera versión de esta función usaba una regla ya cerrada por el
  // médico el 12-ago-2026, distinta de la que quedó escrita aquí; JULES_TAREAS_DISENO_V14.md
  // traía el texto de tarea SIN esa actualización). La ventana correcta NO es "el año
  // calendario en curso" (eso es solo la vigencia ADMINISTRATIVA de fechaVencimiento, que
  // D4 dice explícitamente que no aplica) — es la VIGENCIA CLÍNICA del analito/actividad:
  //   · Riesgo cardiovascular: máximo RCV_VIGENCIA_DIAS (180) días desde la orden.
  //   · PyM que no es RCV: el campo `vigenciaDias` de PYM_CATALOG (Resolución 3280/2018).
  // "Reutiliza eso; no escribas una segunda tabla de vigencias" (D4) — por eso el I10X
  // (RCV exprés) toma vigenciaDias = RCV_VIGENCIA_DIAS en vez de un número repetido a mano.
  //
  // Las actividades SIN `vigenciaDias` confirmado (el médico aún no ha dado la periodicidad
  // de la Resolución 3280 para ellas) SIEMPRE cuentan como pendientes — D4: "ante la duda,
  // el banner se muestra". No se inventa un plazo. Ver PYM_CATALOG para el detalle de cuáles
  // quedan así (anotado ahí mismo para que el médico las complete).
  //
  // `estado` ("PEN"/"PRO" vistos en la captura real, ver §1.6 del superprompt) NO SE
  // INTERPRETA a propósito: su significado no está confirmado todavía. Ninguna orden se
  // acepta ni se descarta por su valor de `estado` — solo por CUPS + vigencia clínica. Si el
  // médico confirma después qué significan, se afina aquí.
  //
  // D4 ("fallo = no cubierto"): cualquier cosa que no sea un arreglo de órdenes utilizable
  // (fallo de red, respuesta malformada, lista vacía) deja TODAS las actividades como
  // pendientes — nunca se oculta en silencio un recordatorio de prevención real.
  function pymCubiertoPorOrdenVigente(actividades, ordenes, hoy) {
    const lista = Array.isArray(actividades) ? actividades : [];
    if (!lista.length) return lista;
    if (!Array.isArray(ordenes) || !ordenes.length) return lista;
    const hoyInfo = _parseFechaHoraLike(hoy);
    if (!hoyInfo) return lista; // sin "hoy" fiable no hay vigencia que calcular
    const hoyMs = new Date(hoyInfo.iso + "T00:00:00").getTime();
    // Por cada CUPS, se guarda la fecha de creación MÁS RECIENTE entre las órdenes vigentes
    // (si el mismo examen se ordenó varias veces, la repetición más nueva es la que importa).
    // Cada actividad se compara luego contra SU PROPIA vigencia clínica — no hay un único
    // límite global, porque RCV (180 días) y el resto de PyM (Resolución 3280) no comparten
    // periodicidad.
    const masRecientePorCup = new Map();
    for (const o of ordenes) {
      if (!o || !o.cup || o.cup.codigo === undefined || o.cup.codigo === null) continue;
      const fc = _parseFechaHoraLike(o.fechaCreacion);
      if (!fc) continue; // fecha ilegible: por prudencia, esta orden NO cuenta como cobertura
      const fcMs = new Date(fc.iso + "T00:00:00").getTime();
      if (fcMs > hoyMs) continue; // fecha futura: dato absurdo, se descarta por prudencia
      const cup = String(o.cup.codigo);
      const prev = masRecientePorCup.get(cup);
      if (prev === undefined || fcMs > prev) masRecientePorCup.set(cup, fcMs);
    }
    return lista.filter((act) => {
      if (!Number.isFinite(act.vigenciaDias) || act.vigenciaDias <= 0) return true; // sin vigencia confirmada: siempre pendiente (D4)
      const cups = Array.isArray(act.cups) ? act.cups : [];
      // v14.1.4 — `every`, no `some` (decisión del médico, 14-ago-2026). Con `some`, una
      // actividad se daba por cubierta si UNO SOLO de sus CUPS estaba vigente: en el paquete
      // RCV exprés, que trae diez exámenes, bastaba una glicemia de hace un mes para que el
      // banner dejara de pedir los otros nueve —creatinina, perfil lipídico y RAC incluidos—.
      // El caso que lo delató es la RAC: el propio catálogo documenta que se produce con DOS
      // exámenes (903876 creatinina en orina + 903026 microalbuminuria) y que "van SIEMPRE
      // los dos: uno solo no produce la RAC", pero `some` la daba por hecha con cualquiera.
      // Es el mismo agujero para toda actividad de más de un CUPS; las de un solo CUPS se
      // comportan exactamente igual que antes.
      // Efecto buscado: el banner pide MÁS, no menos. Es la dirección segura de D4 ("ante la
      // duda, se muestra") y la correcta: un paquete a medias no está hecho.
      // El `cups.length > 0` NO es decorativo: `[].every()` es `true` por definición, así que
      // sin él una actividad sin CUPS se daría por cubierta sin haber comprobado nada.
      const cubierta = cups.length > 0 && cups.every((c) => {
        if (!c || c.codigo === undefined || c.codigo === null) return false;
        const fcMs = masRecientePorCup.get(String(c.codigo));
        if (fcMs === undefined) return false;
        const dias = Math.round((hoyMs - fcMs) / 86400000);
        return dias <= act.vigenciaDias;
      });
      return !cubierta;
    });
  }

  // Interfaz con APIAcceso: Validar Agenda
  async function apiAccesoAgdValidarAgenda(agendaId, pacienteId) {
    const path = `/apiviva/APIAcceso/api/Acceso/AgdValidarAgenda?agendaId=${agendaId}&pacienteId=${pacienteId}&ordenMongo=null&cup=null&swParticular=false`;
    // v11.0.1 — Devuelve el veredicto en vez de descartarlo. Es una compuerta del servidor
    // ("Superó las validaciones" / isError) y el script la estaba ignorando por completo.
    try {
      return await pageFetchJson(path);
    } catch (e) { console.warn("[Vigilante] AgdValidarAgenda falló:", e); return null; }
  }

  // Interfaz con APIAcceso: Obtener Turnos / Horas Libres
  async function apiAccesoObtenerTurnos(agendaId, fechaFmt, pacienteId) {
    const path = `/apiviva/APIAcceso/api/Acceso/ObtenerTurnos?agendaid=${agendaId}&fecha=${encodeURIComponent(fechaFmt)}&pacienteId=${pacienteId}&ordenMongo=null&cup=null&swParticular=false`;
    return pageFetchJson(path);
  }

  // Celular al que se envió el último SMS de recordatorio (para mostrarlo en el aviso de
  // confirmación: el médico debe poder ver a qué número salió). Vacío = no se envió.
  let ultimoSmsEnviado = "";

  async function apiAccesoAsignarTurno(turnoId, pacienteId, fechaIso, observacion, isPyM, marcacion, programaId, celularSms) {
    if (state.killed) return { error: true, mensaje: "Pausa de seguridad remota activa (Kill-Switch activo): el asistente está en pausa de seguridad para proteger la historia clínica. No se realizaron cambios." };
    const uId = state.activeDoctor.id || S.medicoId || 0;
    // v12.0.0 — Antes se caía a 515, el identificador de UN médico concreto: si la
    // detección fallaba, TODAS las citas de TODOS los pacientes se creaban a nombre de
    // otro profesional. Ahora se aborta de forma visible y el médico puede fijar su
    // identificador en Ajustes.
    if (!uId) return { error: true, mensaje: "No se pudo identificar al médico en Everest. NO se creó la cita. Indique su identificador en Ajustes." };
    const docName = stripAccents(String(state.activeDoctor.name || S.medicoNombre || "").toUpperCase());

    const rcvDoctors = ["PALENCIA", "BPALENCIA", "PINO", "MPINO", "ESTRADA", "EESTRADA", "MIJARES", "SMIJARES"];
    const esMedicoRCV = rcvDoctors.some((p) => docName.includes(p));

        const swPyM = esMedicoRCV ? true : !!isPyM;
        const swProgEspecial = esMedicoRCV ? true : false;
        const marc = encodeURIComponent(marcacion || "Consulta");
        const obs = encodeURIComponent(observacion || "");

        const path = `/apiviva/APIAcceso/api/Acceso/AsignarTurno?OrdenMongoId=null&TurnoId=${turnoId}&Marcacion=${marc}&PacienteId=${pacienteId}&FechaDeseada=${fechaIso}&TipoConsulta=PRESENCIAL&Ip=192&UsuarioId=${uId}&CodigoCups=null&SwProgramaEspecial=${swProgEspecial}&swIsPac=false&swIsPyM=${swPyM}&ObservacionCita=${obs}&FechaMinimaConsultaOrden=null` + (programaId ? `&ProgramaId=${encodeURIComponent(programaId)}` : "") + `&Tratamiento=false&Consulta=false&Emergencia=false&PresupuestoId=0`;
        console.log("[Vigilante] AsignarTurno →", { Marcacion: marcacion || "NA", Consulta: false, swIsPyM: swPyM, SwProgramaEspecial: swProgEspecial });
        const res = await pageFetchJson(path, { method: "POST", body: "{}" });

        // ---- SMS de recordatorio al paciente -------------------------------------
        // v11.0.1. Replica lo que hace la aplicación oficial de Everest tras agendar
        // (capturado: EnviarSMS?Telefono=...&AgendaTurnoId=..., y AsignarTurno devuelve
        // swSms:false, o sea que el servidor NO lo manda solo). Con tres cautelas:
        //  1) Solo se envía si la cita se creó DE VERDAD (error:false + radicado), para no
        //     avisar al paciente de una cita inexistente.
        //  2) Un solo disparo (fetch directo). Por pageFetchJson se reintentaría hasta 4
        //     veces con doble vía: hasta OCHO mensajes al mismo paciente.
        //  3) Se puede apagar desde Ajustes (S.smsRecordatorio).
        // NOTA: en las 26 telemetrías, los 2 de 2 envíos de SMS de la aplicación oficial
        // fueron precedidos por un clic manual del operador; aquí es automático a petición
        // expresa del médico, por eso queda el interruptor y el aviso en pantalla.
        ultimoSmsEnviado = "";
        const creada = res && res.error === false && res.data && (Number(res.data.radicado) > 0 || /Agendada Correctamente/i.test(String(res.data.motivo || "")));
        // v12.2.0 — El número YA NO se busca aquí a ciegas: llega desde el modal, donde el
        // médico lo ha visto y ha podido corregirlo. Motivo: en las telemetrías del propio
        // consultorio hay un mismo celular registrado para DOS pacientes distintos, así que
        // enviar al "celular de la ficha" sin mirarlo puede avisar a la persona equivocada
        // de la cita de otra, con su nombre y su fecha.
        const cel = String(celularSms || "").replace(/\D/g, "");
        if (creada && S.smsRecordatorio && cel.length >= 7) {
          const smsUrl = location.origin + `/apiviva/APIAcceso/api/SMS/EnviarSMS?Telefono=${encodeURIComponent(cel)}&AgendaTurnoId=${turnoId}`;
          (FETCH0 || window.fetch)(smsUrl, { credentials: "include", headers: { Accept: "application/json" } })
            .then(() => { console.log("[Vigilante] SMS de recordatorio enviado al turno", turnoId); })
            .catch((e) => console.warn("[Vigilante] falló el envío del SMS:", e));
          ultimoSmsEnviado = cel;
        } else if (creada && S.smsRecordatorio) {
          console.warn("[Vigilante] sin celular válido: no se envía SMS");
        }

        return res;
      }

  // v12.5.13 — IMPRIMIR RECORDATORIO DE CITA (pedido explícito del médico: hasta ahora solo
  // se enviaba por SMS/se veía en pantalla, sin opción directa de imprimir).
  //
  // Contrato REAL, no inventado: capturado con el grabador de red del propio proyecto justo
  // tras un AsignarTurno exitoso y un clic en el botón "Imprimir" oficial de Everest —
  //   GET /apiviva/APIImpresionV2/api/Impresion/ImprimirRecordatorioCita
  //       ?CitaId=<radicado>&Eps=<nombre EPS>&nombreCompleto=<nombre completo>&swVirtual=false
  // CitaId es el `radicado` que devuelve AsignarTurno para ESTA cita puntual (nunca "la última
  // cita en pantalla"): así no hay forma de imprimir el recordatorio de un paciente distinto.
  // swVirtual=false: este flujo (openAgendamientoModal) solo crea citas PRESENCIAL, igual que
  // el propio AsignarTurno de aquí arriba — no hay evidencia (ni necesidad) de la variante
  // virtual todavía. La respuesta capturada llegó con status 0/cuerpo vacío (la pestaña se
  // abrió antes de que la petición terminara de bajar) — igual que el resto de los enlaces de
  // impresión de Everest en este script, se abre en una pestaña nueva y es el navegador el que
  // decide qué hacer con la respuesta (PDF nativo o una página que dispara su propio print()).
  function imprimirRecordatorioCita(citaId, epsNombre, nombreCompleto) {
    if (!citaId) return;
    const url = location.origin + "/apiviva/APIImpresionV2/api/Impresion/ImprimirRecordatorioCita"
      + "?CitaId=" + encodeURIComponent(citaId)
      + "&Eps=" + encodeURIComponent(epsNombre || "")
      + "&nombreCompleto=" + encodeURIComponent(nombreCompleto || "")
      + "&swVirtual=false";
    window.open(url, "_blank");
  }

  // v12.6.3 — PANEL FLOTANTE POST-CITA (pedido explícito del médico: el botón de imprimir
  // vivía dentro de #vgl-agendar-modal, que se autocierra 2.6 s después de crear la cita —
  // sin tiempo real de leerlo ni pulsarlo). Este panel es un elemento INDEPENDIENTE del
  // modal (no un botón dentro de él), así que sobrevive a closeMod(): sigue en pantalla
  // hasta que el médico lo cierre a mano o pasen 5 min sin interacción.
  function mostrarPanelPostCita(citaId, epsNombre, nombreCompleto, patientNameFallback) {
    if (!citaId) return;
    try {
      document.querySelectorAll("#vgl-postcita-panel").forEach((e) => e.remove());
      const panel = document.createElement("div");
      panel.id = "vgl-postcita-panel";
      panel.className = isLight() ? "light" : "";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", "Confirmación de Cita");
      panel.innerHTML = `
        <div class="vgl-postcita-card">
          <button class="vgl-postcita-x" id="vgl-postcita-x" title="Cerrar" aria-label="Cerrar">✕</button>
          <div class="vgl-postcita-title">✅ Cita creada</div>
          <div class="vgl-postcita-sub">${escapeHtml(nombreCompleto || patientNameFallback || "")}</div>
          <button class="vgl-agm-btn sec" id="vgl-postcita-print">🖨️ Imprimir recordatorio de cita</button>
        </div>
      `;
      document.body.appendChild(panel);
      const cerrar = () => { try { panel.innerHTML = ""; panel.remove(); } catch (e) {} };
      panel.querySelector("#vgl-postcita-x").addEventListener("click", cerrar);
      panel.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(); }
      });
      panel.querySelector("#vgl-postcita-print").addEventListener("click", () => {
        uxTrack("cita.imprimir");
        imprimirRecordatorioCita(citaId, epsNombre, nombreCompleto);
      });
      setTimeout(cerrar, 300000); // 5 min: no queda pegado en pantalla toda la jornada si el médico lo ignora
    } catch (e) {}
  }

  // [BLINDADO v8.2.0 DOM-04] Extractor universal de Agendas movido a scope de módulo.
  // Antes estaba declarado como function DENTRO de cargarHoras() (bloque async), lo que
  // produce comportamiento ambiguo de hoisting en modo estricto según el motor JS.
  function extractAgendasList(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (typeof res === "object") {
      if (res.dtCitasDisponibles) return extractAgendasList(res.dtCitasDisponibles);
      if (res.agendas && Array.isArray(res.agendas)) return res.agendas;
      if (res.citas && Array.isArray(res.citas)) return res.citas;
      if (res.turnos && Array.isArray(res.turnos)) return res.turnos;
      if (res.Table && Array.isArray(res.Table)) return res.Table;
      if (res.Table1 && Array.isArray(res.Table1)) return res.Table1;
      if (res.data) return extractAgendasList(res.data);
      for (const k of Object.keys(res)) {
        if (Array.isArray(res[k]) && res[k].length > 0 && typeof res[k][0] === "object") return res[k];
      }
    }
    return [];
  }

  // [C3] Concurrencia acotada: helper puro para el sondeo de días del modal (D2),
  // que va a lanzar hasta 18 consultas contra el EHR del consultorio y necesita un
  // tope real en vez del `Promise.all` a pelo que ya se usa en otras partes del
  // archivo. Sin llamadores todavía — queda listo para que D2 lo conecte.
  //   · Devuelve los resultados en el MISMO orden de `items`, sin importar el
  //     orden real de finalización.
  //   · Nunca mantiene más de `limite` promesas en vuelo a la vez.
  //   · Un rechazo individual (incluida una `fn` que lanza de forma síncrona) no
  //     aborta el lote: cada resultado es {ok:true, valor} o {ok:false, error}.
  //   · `cancelado` es opcional: si al reclamar la siguiente tarea devuelve verdad,
  //     esa tarea (y todas las que quedaban por arrancar) no se ejecuta y queda
  //     como {ok:false, cancelado:true} — las que ya estaban en vuelo terminan
  //     normalmente, no se interrumpen a medias.
  //   · `limite <= 0` se trata como 1 (nunca como "sin tope"); `limite >= items.length`
  //     se comporta como `Promise.all`.
  async function mapConLimite(items, limite, fn, cancelado) {
    const lista = Array.isArray(items) ? items : [];
    const n = lista.length;
    const resultados = new Array(n);
    if (n === 0) return resultados;
    let tope = Math.floor(Number(limite));
    if (!Number.isFinite(tope) || tope < 1) tope = 1; // limite<=0 (o no numérico) -> 1
    const nTrabajadores = Math.min(tope, n);
    let siguiente = 0;
    async function trabajador() {
      while (siguiente < n) {
        const idx = siguiente++;
        if (typeof cancelado === "function" && cancelado()) {
          resultados[idx] = { ok: false, cancelado: true };
          continue;
        }
        try {
          const valor = await fn(lista[idx], idx);
          resultados[idx] = { ok: true, valor };
        } catch (error) {
          resultados[idx] = { ok: false, error };
        }
      }
    }
    const activos = [];
    for (let i = 0; i < nTrabajadores; i++) activos.push(trabajador());
    await Promise.all(activos);
    return resultados;
  }

  // Genera un rango de ±3 días hábiles alrededor de la fecha calculada
  function calcTargetDateRange(monthsToAdd, daysToAdd) {
    const baseObj = calcBusinessTargetDate(monthsToAdd, daysToAdd);
    const baseDate = new Date(baseObj.dateObj);
    const pad = (n) => String(n).padStart(2, "0");

    const getInfo = (dt, isCenter) => {
      const yyyy = dt.getFullYear();
      const mm = pad(dt.getMonth() + 1);
      const dd = pad(dt.getDate());
      const dayShort = dt.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");
      const dayCap = dayShort.charAt(0).toUpperCase() + dayShort.slice(1);
      return {
        iso: `${yyyy}-${mm}-${dd}`,
        fmt: `${dd}/${mm}/${yyyy}`,
        shortLbl: `${dayCap} ${dd}/${mm}`,
        lbl: dt.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        isCenter: !!isCenter,
        dateObj: new Date(dt),
      };
    };

    const prevDays = [];
    let curPrev = new Date(baseDate);
    while (prevDays.length < 3) {
      curPrev.setDate(curPrev.getDate() - 1);
      if (curPrev.getDay() !== 0 && curPrev.getDay() !== 6 && !esFestivo(curPrev)) {
        prevDays.unshift(getInfo(curPrev, false));
      }
    }

    const nextDays = [];
    let curNext = new Date(baseDate);
    while (nextDays.length < 3) {
      curNext.setDate(curNext.getDate() + 1);
      if (curNext.getDay() !== 0 && curNext.getDay() !== 6 && !esFestivo(curNext)) {
        nextDays.push(getInfo(curNext, false));
      }
    }

    return [...prevDays, getInfo(baseDate, true), ...nextDays];
  }

  // v12.10.10 (C2) — Días a SONDEAR (no a mostrar como confirmados) alrededor de una
  // fecha ISO ya calculada: ±7 días hábiles más los sábados que caen entre ellos, porque
  // el consultorio sí abre algunos sábados y esos días requieren sondeo por red aparte
  // (esta función solo entrega el QUÉ sondear; el sondeo por red en sí es de otra tarea).
  function calcRangoSondeoIso(isoDateStr) {
    const parts = isoDateStr.split("-");
    const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const pad = (n) => String(n).padStart(2, "0");

    const getInfo = (dt, isCenter, esSabado) => {
      const yyyy = dt.getFullYear();
      const mm = pad(dt.getMonth() + 1);
      const dd = pad(dt.getDate());
      const dayShort = dt.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");
      const dayCap = dayShort.charAt(0).toUpperCase() + dayShort.slice(1);
      return {
        iso: `${yyyy}-${mm}-${dd}`,
        fmt: `${dd}/${mm}/${yyyy}`,
        shortLbl: `${dayCap} ${dd}/${mm}`,
        lbl: dt.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        isCenter: !!isCenter,
        dateObj: new Date(dt),
        esSabado: !!esSabado,
        confirmado: !esSabado,
      };
    };

    const prevDays = [];
    let curPrev = new Date(baseDate);
    while (prevDays.length < 7) {
      curPrev.setDate(curPrev.getDate() - 1);
      if (curPrev.getDay() !== 0 && curPrev.getDay() !== 6 && !esFestivo(curPrev)) {
        prevDays.unshift(getInfo(curPrev, false, false));
      }
    }

    const nextDays = [];
    let curNext = new Date(baseDate);
    while (nextDays.length < 7) {
      curNext.setDate(curNext.getDate() + 1);
      if (curNext.getDay() !== 0 && curNext.getDay() !== 6 && !esFestivo(curNext)) {
        nextDays.push(getInfo(curNext, false, false));
      }
    }

    // Sábados candidatos: los que caen estrictamente entre el primer y el último día
    // hábil del rango (los domingos y festivos ya quedan fuera por construcción arriba).
    const sabados = [];
    const curSab = new Date(prevDays[0].dateObj);
    curSab.setDate(curSab.getDate() + 1);
    const ultimoHabil = nextDays[nextDays.length - 1].dateObj;
    while (curSab < ultimoHabil) {
      if (curSab.getDay() === 6 && !esFestivo(curSab)) {
        sabados.push(getInfo(curSab, false, true));
      }
      curSab.setDate(curSab.getDate() + 1);
    }

    return [...prevDays, getInfo(baseDate, true, false), ...nextDays, ...sabados]
      .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
  }

  // v12.3.20 — Igual que calcTargetDateRange pero centrado en una fecha ISO ya calculada
  // (no en "hoy + meses/días"). Se usa para los chips de fecha alterna de toma de
  // muestras, centrados en la fecha sugerida (5 días hábiles antes de la cita principal).
  function calcDateRangeAroundIso(isoDateStr, sideCount = 3) {
    const parts = isoDateStr.split("-");
    const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const pad = (n) => String(n).padStart(2, "0");

    const getInfo = (dt, isCenter) => {
      const yyyy = dt.getFullYear();
      const mm = pad(dt.getMonth() + 1);
      const dd = pad(dt.getDate());
      const dayShort = dt.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");
      const dayCap = dayShort.charAt(0).toUpperCase() + dayShort.slice(1);
      return {
        iso: `${yyyy}-${mm}-${dd}`,
        fmt: `${dd}/${mm}/${yyyy}`,
        shortLbl: `${dayCap} ${dd}/${mm}`,
        lbl: dt.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        isCenter: !!isCenter,
        dateObj: new Date(dt),
      };
    };

    const prevDays = [];
    let curPrev = new Date(baseDate);
    while (prevDays.length < sideCount) {
      curPrev.setDate(curPrev.getDate() - 1);
      if (curPrev.getDay() !== 0 && curPrev.getDay() !== 6 && !esFestivo(curPrev)) {
        prevDays.unshift(getInfo(curPrev, false));
      }
    }

    const nextDays = [];
    let curNext = new Date(baseDate);
    while (nextDays.length < sideCount) {
      curNext.setDate(curNext.getDate() + 1);
      if (curNext.getDay() !== 0 && curNext.getDay() !== 6 && !esFestivo(curNext)) {
        nextDays.push(getInfo(curNext, false));
      }
    }

    return [...prevDays, getInfo(baseDate, true), ...nextDays];
  }

  // Modal de Laboratorios y Paraclínicos (Annar, Citi y Puente Athenea)
  async function openLaboratoriosModal(apt) {
    if (!apt || !apt.doc_id) { setSummary("El paciente seleccionado no tiene documento legible.", "warn"); return; }

    let existing = document.getElementById("vgl-labs-modal");
    if (existing) existing.remove();

    const patientName = apt.nombre || apt.name || "Paciente Everest";
    const modal = document.createElement("div");
    modal.id = "vgl-labs-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "vgl-labs-title");
    if (isLight()) modal.classList.add("light");

    const atheneaUrl = `https://medicosviva1a.atheneasoluciones.com/Resultados/BusquedaPaciente#doc=${apt.doc_id}`;

    modal.innerHTML = `
      <div class="vgl-agm-card" style="max-width:760px">
        <div class="vgl-agm-head">
          <div style="min-width:0">
            <div class="vgl-agm-title vgl-labs-kicker" id="vgl-labs-title">🧪 Exámenes de Laboratorio · Portal Athenea Soluciones</div>
            <div class="vgl-labs-patient">${escapeHtml(patientName)}</div>
            <div class="vgl-agm-sub">Cédula: <b>${escapeHtml(apt.doc_id)}</b></div>
          </div>
          <button class="vgl-agm-close" id="vgl-labs-x" aria-label="Cerrar">✕</button>
        </div>

        <div class="vgl-agm-sec vgl-labs-srcbar" style="margin-bottom:14px">
          <span class="vgl-labs-srclbl"><b>Fuente de Consulta:</b> Búsqueda automática directa en <b>Athenea Soluciones API</b></span>
          <a href="${atheneaUrl}" target="_blank" class="vgl-agm-btn sec vgl-labs-portal">
            🌐 Abrir en Portal Athenea (Auto-Login)
          </a>
        </div>

        <div class="vgl-agm-sec" id="vgl-labs-renal-sec"></div>

        <div class="vgl-agm-sec">
          <label class="vgl-agm-lbl">⚡ Resultados de Paraclínicos (Búsqueda Prioritaria en Athenea Soluciones):</label>
          <div id="vgl-labs-content" class="vgl-agm-slots" aria-live="polite" style="max-height:420px;overflow-y:auto;display:block">
            <div class="vgl-agm-loading">⏳ Consultando automáticamente exámen de laboratorios en Portal Athenea Soluciones...</div>
          </div>
        </div>

        <div class="vgl-agm-foot">
          <button class="vgl-agm-btn sec" id="vgl-labs-close" onclick="this.closest('#vgl-labs-modal').remove()">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let cerrado = false;
    const vivo = () => !cerrado && modal.isConnected !== false;
    const closeMod = () => {
      cerrado = true;
      xBtn?.removeEventListener("click", closeMod);
      cancelBtn?.removeEventListener("click", closeMod);
      modal.removeEventListener("click", typeof bgClick !== 'undefined' ? bgClick : closeMod);
      modal.innerHTML = "";
      modal.remove();
    };
    const xBtn = modal.querySelector("#vgl-labs-x");
    const cancelBtn = modal.querySelector("#vgl-labs-close");
    if (xBtn) xBtn.addEventListener("click", closeMod);
    if (cancelBtn) cancelBtn.addEventListener("click", closeMod);

    const bgClick = (e) => { if (e.target === modal) closeMod(); };
    modal.addEventListener("click", bgClick);
    _activarAccesibilidadModal(modal, closeMod);


    const contentEl = modal.querySelector("#vgl-labs-content");

    const todosLabs = [];

    // 1. BÚSQUEDA PRIORITARIA Y DE ENTRADA EN ATHENEA SOLUCIONES (v12.3.3: puente real
    // por navegador — búsqueda por cédula, sin depender de ningún servidor externo).
    try {
      const labsArr = await getAtheneaLabsAuto(apt.doc_id);
      if (labsArr && labsArr.length) {
        labsArr.forEach(l => todosLabs.push({ origen: "Athenea (Principal)", ...l }));
      }
    } catch (e) {
      console.warn("[Vigilante Labs] Error consultando Athenea:", e);
    }
    if (!vivo()) return;

    // 2. BÚSQUEDA SECUNDARIA EN COMPLEMENTO (ANNAR / CITI)
    let pacienteIdLabs = null;
    try {
      let pId = await apiAccesoBuscarPaciente(apt.doc_id);
      if (!vivo()) return;
      pacienteIdLabs = pId || null;
      if (pId) {
        const [annarRes, citiRes] = await Promise.all([
          apiAccesoObtenerLaboratoriosAnnar(pId).catch(() => null),
          apiAccesoObtenerLaboratoriosCiti(pId).catch(() => null)
        ]);
        const annarList = extractAgendasList(annarRes);
        const citiList = extractAgendasList(citiRes);
        if (annarList && annarList.length) annarList.forEach(item => todosLabs.push({ origen: "Annar", ...item }));
        if (citiList && citiList.length) citiList.forEach(item => todosLabs.push({ origen: "Citi", ...item }));
      }
    } catch (e) {}
    if (!vivo()) return;

    // v14.1.1 (R1b) — FUNCIÓN RENAL. Aquí es donde el motor renal deja de estar en modo
    // sombra: este es su primer llamador de producción. Se pone en el modal de laboratorios
    // porque es justo donde el médico está mirando la creatinina, y se lanza SIN await para
    // no retrasar ni un milisegundo la tabla de resultados, que es lo que él vino a ver: el
    // recuadro renal aparece solo cuando sus dos consultas vuelven.
    // Si algo falla, el recuadro simplemente no aparece — nunca rompe el modal.
    (async () => {
      try {
        const r = await calcularEstadioRenal(pacienteIdLabs, todosLabs);
        if (!vivo()) return;
        const sec = modal.querySelector("#vgl-labs-renal-sec");
        if (sec) sec.innerHTML = _renderEstadioRenalHtml(r);
      } catch (e) { console.warn("[Vigilante] recuadro renal no disponible:", e); }
    })();

    // v12.0.0 — RETIRADOS los "datos clínicos de muestra". Cuando la consulta real no
    // devolvía nada, se inventaban SIETE resultados de laboratorio (glicemia 98 mg/dL,
    // colesterol total 224 "Elevado", "Negativo para LIE"…) y se pintaban en la misma
    // tabla y con la misma etiqueta "Athenea (Principal)" que los reales: el médico no
    // tenía forma de distinguirlos. Ahora, sin resultados, se dice que no los hay.
    if (!todosLabs.length) {
      contentEl.innerHTML = `<div class="vgl-agm-err vgl-labs-empty">ℹ No se encontraron paraclínicos recientes para este paciente en Athenea, Annar ni Citi.<br><br>Verifique directamente en el portal de Athenea con el botón azul de arriba. <b>No se muestra ningún resultado de ejemplo.</b></div>`;
      return;
    }

    // v12.3.19 — Confirmado en consultorio real (captura de pantalla): la tabla del
    // modal (esta función, DISTINTA de injectLabsIntoCronicos y su propio diagnóstico
    // de v12.3.10) mostró 5/5 resultados de Athenea con "Sin fecha" pese a que
    // NombreParametro/Resultado sí se reconocieron. Los 4 nombres de campo de fecha ya
    // probados aquí no calzan con el objeto real de Athenea. En vez de adivinar un
    // quinto nombre, se vuelca UNA sola vez (por apertura de modal) las claves reales
    // del primer resultado de Athenea sin fecha reconocida.
    let diagFechaModalLogged = false;
    let diagHoraModalLogged = false; // v12.4.0
    // v14.0.0 (TL2) — mismo diagnóstico que fecha/hora arriba, para el mismo hueco de
    // evidencia: la columna "Ref. / Rango" sale vacía a menudo porque el nombre real del
    // campo en el payload de Athenea no está confirmado (aquí se prueban `referencia`,
    // `ValoresReferencia`, `Estado`; los 4 nombres de fecha ya probados tampoco existían
    // en el objeto real — no se adivina un quinto nombre sin evidencia, se captura la de
    // verdad). Al detenerse en el primer analito sin ninguno de los tres campos, la
    // consola del navegador (F12) muestra las claves reales de ESE analito para copiarlas
    // y confirmar en consultorio cuál es el nombre correcto.
    let diagReferenciaModalLogged = false;
    let rowsHtml = _agruparUroanalisisParaTabla(todosLabs).map(lab => {
      // v12.5.16 — El bloque agrupado del uroanálisis (ver _agruparUroanalisisParaTabla)
      // trae sus componentes en __vglGrupoUroComponentes: el "Resultado" de la fila es la
      // lista de todos ellos, no un valor único, y la columna de referencia muestra cuántos
      // parámetros incluye en vez de un rango (cada componente tiene el suyo propio).
      const esGrupoUro = Array.isArray(lab.__vglGrupoUroComponentes);
      // v12.3.30 — misma detección por forma de valor que injectLabsIntoCronicos (ver
      // _extractAtheneaFecha): los 4 nombres de campo ya probados aquí no existen en el
      // objeto real de Athenea, así que se busca la fecha por su forma, no por su nombre.
      const fechaInfo = _extractAtheneaFecha(lab);
      // v12.4.0 — La HORA acompaña a la fecha en la tabla cuando alguna fuente la trae
      // (campo del analito, envoltorio o la tarjeta del portal). Sin hora real, solo fecha.
      const fecha = fechaInfo
        ? (() => { const p = fechaInfo.iso.split("-"); return `${p[2]}/${p[1]}/${p[0]}` + (fechaInfo.hora ? ` · ${fechaInfo.hora}` : ""); })()
        : "Sin fecha";
      if (fecha === "Sin fecha" && !diagFechaModalLogged && String(lab.origen || "").includes("Athenea")) {
        diagFechaModalLogged = true;
        console.warn("[Vigilante Labs] diagnóstico: no se reconoció ninguna fecha (ni por nombre ni por forma) en la tabla del modal. Claves disponibles:", Object.keys(lab), lab);
      }
      // v12.4.0 — Diagnóstico de HORA (una vez por apertura): si la fecha sí se reconoce
      // pero ninguna fuente trae hora, la consola lo dice con las claves reales — es la
      // evidencia para decidir si Athenea la publica en otro campo o no existe.
      if (fechaInfo && !fechaInfo.hora && !diagHoraModalLogged && String(lab.origen || "").includes("Athenea")) {
        diagHoraModalLogged = true;
        console.log("[Vigilante Labs] diagnóstico hora: la fecha se reconoció (clave '" + fechaInfo.key + "') pero SIN hora en ninguna fuente. Claves del analito:", Object.keys(lab));
      }
      // v12.0.0 — Se añade NombreParametro al principio: es el campo con el que Athenea
      // nombra el examen (el mismo que ya lee _matchLabInWhitelist). Sin él, TODA fila
      // venida de Athenea se pintaba con el texto genérico "Paraclínico".
      const examen = lab.NombreParametro || lab.examen || lab.descripcion || lab.Examen || lab.nombreExamen || lab.nombre || lab.Prueba || "Examen sin nombre";
      const resultado = lab.Resultado || lab.resultado || lab.valor || lab.Valor || "—";
      // v12.0.0 — Fuera `lab.unidades` de esta cadena: unas unidades ("mg/dL") no son un
      // rango de referencia, y colarlas aquí ensucia la única señal que usa el resaltado.
      const referencia = lab.referencia || lab.ValoresReferencia || lab.Estado || "";
      if (!esGrupoUro && !referencia && !diagReferenciaModalLogged && String(lab.origen || "").includes("Athenea")) {
        diagReferenciaModalLogged = true;
        console.warn("[Vigilante Labs] diagnóstico Ref./Rango: ninguno de los campos probados (referencia/ValoresReferencia/Estado) trajo valor. Claves disponibles:", Object.keys(lab), lab);
      }
      // v12.0.0 — El color por defecto ya NO es verde. Pintar de verde todo lo que no
      // reconoce equivale a declarar "normal" un resultado que el script no ha
      // interpretado: es una afirmación clínica que no le corresponde hacer. Ahora solo
      // marca en rojo lo que la PROPIA fuente declara elevado o anormal; el resto va en
      // color de texto neutro, sin insinuar nada.
      // v12.5.16 — Para el bloque agrupado, "elevado/anormal" se busca en CUALQUIERA de
      // sus componentes (un solo parámetro alterado ya justifica marcar el bloque entero).
      const esAlerta = esGrupoUro
        ? lab.__vglGrupoUroComponentes.some((c) => String(c.resultado).toLowerCase().includes("anormal"))
        : (String(referencia).toLowerCase().includes("elevado") || String(resultado).toLowerCase().includes("anormal"));
      // v12.5.4 — Botón "Ver informe": abre el PDF real de Athenea con un clic (hash +
      // token ya raspados de la tarjeta de la solicitud). El informe resultó ser una
      // imagen escaneada sin texto legible por máquina (confirmado en campo), así que
      // esto NO reemplaza la fecha/hora ya extraídas — es solo un atajo para que el
      // médico vea el documento oficial sin navegar todo el portal a mano.
      const btnInforme = (lab.__vglHash && lab.__vglToken)
        ? `<button class="vgl-labs-pdf" data-hash="${escapeHtml(lab.__vglHash)}" data-token="${escapeHtml(lab.__vglToken)}" data-modulo="${escapeHtml(lab.__vglModulo || "LAB")}" title="Abrir el informe (PDF) real de Athenea" aria-label="Abrir el informe (PDF) real de Athenea">📄</button>`
        : "";

      // v12.5.16 — Bloque agrupado: cada componente se escapa POR SEPARADO y se une con
      // <br> (nombre en negrilla · resultado) — nunca se re-escapa el bloque completo,
      // porque eso rompería las etiquetas ya armadas.
      // v12.8.1 — Los componentes ya NO se unen con <br>: cada uno va en su propio
      // <span> para que el CSS los pueda repartir en REJILLA de varias columnas. Con
      // <br> el uroanálisis (~30 parámetros) formaba una sola columna altísima dentro de
      // una celda de tabla, y la fila crecía tanto que el resto de columnas quedaba fuera
      // de la pantalla (reportado en consultorio con capturas). El formato del texto de
      // cada componente NO cambia: sigue siendo "<b>NOMBRE</b>: VALOR".
      const resultadoHtml = esGrupoUro
        ? `<div class="vgl-labs-uro">${lab.__vglGrupoUroComponentes.map((c) => `<span class="vgl-labs-uro-i"><b>${escapeHtml(String(c.nombre))}</b>: ${escapeHtml(String(c.resultado))}</span>`).join("")}</div>`
        : escapeHtml(String(resultado));
      const referenciaHtml = esGrupoUro
        ? escapeHtml(lab.__vglGrupoUroComponentes.length + " parámetro" + (lab.__vglGrupoUroComponentes.length === 1 ? "" : "s"))
        : escapeHtml(String(referencia));

      return `
        <tr class="vgl-labs-tr${esAlerta ? " vgl-labs-alert" : ""}">
          <td class="vgl-labs-date">${escapeHtml(String(fecha))}</td>
          <td class="vgl-labs-exam">${escapeHtml(String(examen))}</td>
          <td class="vgl-labs-val">${resultadoHtml}</td>
          <td class="vgl-labs-ref">${referenciaHtml}</td>
          <td><span class="vgl-labs-src${lab.origen.includes("Athenea") ? " athenea" : ""}">${escapeHtml(lab.origen)}</span></td>
          <td class="vgl-labs-pdfcol">${btnInforme}</td>
        </tr>
      `;
    }).join("");

    contentEl.innerHTML = `
      <table class="vgl-labs-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Examen / Paraclínico</th>
            <th>Resultado</th>
            <th>Ref. / Rango</th>
            <th>Fuente</th>
            <th>Informe</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
    // v12.5.4 — Un solo listener delegado (la tabla se reconstruye por completo en cada
    // refresco de contentEl.innerHTML, así que enganchar por fila individual se perdería).
    const tabla = contentEl.querySelector(".vgl-labs-table");
    if (tabla) tabla.addEventListener("click", (e) => {
      const btn = e.target.closest(".vgl-labs-pdf");
      if (!btn) return;
      abrirInformeAthenea(btn.dataset.hash, btn.dataset.token, btn.dataset.modulo, btn);
    });
  }

  // v12.5.4 — Abre el informe (PDF) real de Athenea con un clic: el mismo POST que hace
  // el propio botón "Ver Informe" del portal, con el hash+token ya raspados de la
  // tarjeta de la solicitud. NO lee ni interpreta el PDF (demostrado en campo: es una
  // imagen escaneada sin texto) — solo se lo entrega al médico para que lo vea él mismo.
  // La pestaña se abre en blanco de forma SÍNCRONA con el clic (antes de cualquier
  // await): los navegadores bloquean window.open() disparado desde dentro de una
  // promesa, aunque haya sido un clic real del usuario el que la inició.
  // v12.5.5 — BAJA de la revisión adversarial: sin esta guarda, un doble clic (o dos
  // clics en dos filas con el mismo hash) disparaba dos peticiones simultáneas al mismo
  // informe — dos pestañas en blanco, dos POST redundantes a Athenea.
  const _informesEnVuelo = new Set();
  function abrirInformeAthenea(hash, token, modulo, btn) {
    if (!hash || !token) return;
    if (_informesEnVuelo.has(hash)) return;
    _informesEnVuelo.add(hash);
    const pestana = window.open("", "_blank");
    if (btn) { btn.disabled = true; btn.textContent = "⏳"; }
    const restaurar = () => { _informesEnVuelo.delete(hash); if (btn) { btn.disabled = false; btn.textContent = "📄"; } };
    if (typeof GM_xmlhttpRequest === "undefined") {
      restaurar();
      if (pestana) pestana.close();
      alert("No se pudo abrir el informe: falta el permiso de red del script.");
      return;
    }
    GM_xmlhttpRequest({
      method: "POST",
      url: "https://medicosviva1a.atheneasoluciones.com/Resultados/Reporte",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "hash=" + encodeURIComponent(hash) + "&modulo=" + encodeURIComponent(modulo || "LAB") + "&__RequestVerificationToken=" + encodeURIComponent(token),
      responseType: "blob",
      timeout: 30000,
      onload: (r) => {
        restaurar();
        if (r.status < 200 || r.status >= 300 || !r.response) {
          if (pestana) pestana.close();
          alert("No se pudo obtener el informe de Athenea (HTTP " + r.status + "). Verifique la sesión e inténtelo desde el portal.");
          return;
        }
        try {
          const url = URL.createObjectURL(r.response);
          if (pestana && !pestana.closed) pestana.location.href = url;
          else window.open(url, "_blank");
          // El blob permanece disponible mientras la pestaña lo necesite; se libera
          // solo tras un margen amplio (evita revocar la URL mientras aún se está
          // renderizando en la pestaña nueva).
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 120000);
        } catch (e) {
          if (pestana) pestana.close();
          alert("No se pudo visualizar el informe de resultados. Por favor intente consultarlo directamente en el portal.");
        }
      },
      onerror: () => { restaurar(); if (pestana) pestana.close(); alert("No se pudo conectar con Athenea para traer el informe."); },
      ontimeout: () => { restaurar(); if (pestana) pestana.close(); alert("Athenea no respondió a tiempo al pedir el informe."); },
    });
  }

  // Modal interactivo de Agendamiento Exprés y Remisiones RCV en 1-Clic
  function openAgendamientoModal(apt) {
    if (!apt || !apt.doc_id) { setSummary("El paciente seleccionado no tiene documento legible.", "warn"); return; }

    let existing = document.getElementById("vgl-agendar-modal");
    if (existing) existing.remove();
    // v8.2.1: also clean up any orphaned ordenar modals that may be stacked
    document.querySelectorAll("#vgl-ordenar-modal").forEach(e => e.remove());

    const patientName = apt.nombre || apt.name || "Paciente Everest";
    const doctorName = state.activeDoctor.name || S.medicoNombre || "";
    const modal = document.createElement("div");
    modal.id = "vgl-agendar-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "vgl-agm-title");
    modal.className = isLight() ? "light" : "";

    let selectedEspId = 12; // 12: Med General (Control) por defecto
    let selectedEspName = "Medicina General (Control)";

    modal.innerHTML = `
      <div class="vgl-agm-card" style="max-width:720px">
        <div class="vgl-agm-head">
          <div style="min-width:0">
            <div class="vgl-agm-title vgl-agm-kicker" id="vgl-agm-title">📅 Programación de Cita · Remisión RCV</div>
            <div class="vgl-agm-patient">${escapeHtml(patientName)}</div>
            <div class="vgl-agm-sub">Documento: <b>${escapeHtml(apt.doc_id)}</b> · Médico: <b>${escapeHtml(doctorName)}</b></div>
          </div>
          <button class="vgl-agm-close" id="vgl-agm-x" aria-label="Cerrar">✕</button>
        </div>

        <div class="vgl-agm-grid">
          <div class="vgl-agm-cell vgl-agm-c5">
            <label class="vgl-agm-lbl"><span class="vgl-agm-step">1</span>Especialidad o servicio a agendar / remitir</label>
            <div class="vgl-agm-presets" id="vgl-esp-presets" style="flex-wrap:wrap;gap:6px">
              <button class="vgl-agm-pbtn active" data-esp="12" data-name="Medicina General (Control)">🩺 Med. General (Control)</button>
              <button class="vgl-agm-pbtn" data-esp="46" data-name="Psicología">🧠 Psicología</button>
              <button class="vgl-agm-pbtn" data-esp="14" data-name="Odontología">🦷 Odontología</button>
            </div>
          </div>

          <div class="vgl-agm-cell vgl-agm-c7">
            <label class="vgl-agm-lbl"><span class="vgl-agm-step">2</span>Plazo y fecha objetivo (±7 días hábiles + sábados)</label>
            <div class="vgl-agm-presets" id="vgl-time-presets">
              <button class="vgl-agm-pbtn" data-m="0" data-d="15">15 días</button>
              <button class="vgl-agm-pbtn active" data-m="1" data-d="0">1 mes</button>
              <button class="vgl-agm-pbtn" data-m="2" data-d="0">2 meses</button>
              <button class="vgl-agm-pbtn" data-m="3" data-d="0">3 meses</button>
              <button class="vgl-agm-pbtn" data-m="4" data-d="0">4 meses</button>
              <button class="vgl-agm-pbtn" data-m="5" data-d="0">5 meses</button>
              <button class="vgl-agm-pbtn" data-m="6" data-d="0">6 meses</button>
            </div>
            <div id="vgl-day-chips" class="vgl-agm-presets" style="margin-top:8px;gap:5px;flex-wrap:wrap"></div>
            <div id="vgl-agm-date-info" class="vgl-agm-dinfo" style="margin-top:6px">Calculando fecha deseada...</div>
          </div>

          <div class="vgl-agm-cell vgl-agm-c12">
            <label class="vgl-agm-lbl"><span class="vgl-agm-step">3</span>Horarios disponibles en la agenda del servicio</label>
            <div id="vgl-agm-slots" class="vgl-agm-slots"><div class="vgl-agm-loading">Consultando horarios disponibles...</div></div>
          </div>

          <div class="vgl-agm-cell vgl-agm-c12 vgl-agm-cell-flat">
            <!-- v12.1.0 — Selector de PROGRAMA. Confirmado con la captura del consultorio:
                 la aplicación oficial muestra aquí un desplegable con los programas del
                 paciente y el médico ELIGE uno; ese identificador viaja como ProgramaId en
                 AsignarTurno. No se puede deducir: en la captura, para una agenda de HTA el
                 médico eligió "Nefroprotección". Por eso se pregunta, igual que Everest. -->
            <div id="vgl-agm-prog-box" class="vgl-d-none vgl-mb-10">
              <label class="vgl-agm-lbl" for="vgl-agm-prog-sel">Programa al que se carga la cita:</label>
              <select id="vgl-agm-prog-sel" class="vgl-agm-input"></select>
            </div>
            <label class="vgl-agm-check-lbl">
              <input type="checkbox" id="vgl-agm-pym-chk" checked>
              <span>¿Es cita para actividades del programa RCV / Prevención?</span>
            </label>
          </div>

          <!-- v12.2.0 — El SMS ya no sale a ciegas. Se muestra el celular registrado, se
               puede corregir antes de confirmar y se puede desmarcar. Motivo: en las
               telemetrías del propio consultorio hay un mismo celular registrado para DOS
               pacientes distintos; enviando sin mirar, uno recibiría el aviso de la cita
               del otro, con su nombre y su fecha. La aplicación oficial también lo enseña
               antes de enviar. -->
          <div id="vgl-agm-sms-box" class="vgl-agm-cell vgl-agm-c6 vgl-agm-cell-sms">
            <label class="vgl-agm-check-lbl">
              <input type="checkbox" id="vgl-agm-sms-chk" checked>
              <span>📱 Enviar SMS de recordatorio al paciente</span>
            </label>
            <div class="vgl-agm-fieldrow">
              <label for="vgl-agm-sms-tel">Celular:</label>
              <input type="tel" id="vgl-agm-sms-tel" class="vgl-agm-input" style="width:auto;min-width:150px;flex:1;padding:7px 11px;font-size:13px" placeholder="cargando…">
              <span id="vgl-agm-sms-nota"></span>
            </div>
          </div>

          <div class="vgl-lab-box vgl-agm-cell vgl-agm-c6 vgl-agm-cell-lab">
            <label class="vgl-agm-check-lbl">
              <input type="checkbox" id="vgl-agm-lab-chk" disabled>
              <span>🧪 Pre-agendar Toma de Muestras (sugerido, 5 días hábiles antes: <b id="vgl-lab-date-lbl">--/--/----</b>)</span>
            </label>
            <!-- v12.6.4 — Pedido explícito del médico: que se vea, justo aquí, si el
                 paciente también recibirá el SMS de recordatorio de la toma de muestras
                 (AppCita, EnviarMensajeTextoLaboratorio — ver apiLaboratorioAgendarAuto).
                 Usa el MISMO celular/casilla de arriba (#vgl-agm-sms-chk/#vgl-agm-sms-tel):
                 no es un envío aparte, solo se hace visible que también aplica aquí. -->
            <div id="vgl-agm-lab-sms-nota" class="vgl-agm-lab-sms-nota"></div>
            <!-- v12.3.20 — Si el día sugerido no tiene turnos de laboratorio, antes no había
                 forma de elegir otro: quedaba con la casilla bloqueada y sin salida, a
                 diferencia de la fecha de la cita principal (que sí tiene chips ±3 días). -->
            <div id="vgl-lab-day-chips" class="vgl-agm-presets" style="margin:2px 0 6px;gap:4px;flex-wrap:wrap"></div>
            <div class="vgl-agm-fieldrow">
              <label for="vgl-agm-lab-time-sel">Hora del Laboratorio:</label>
              <select id="vgl-agm-lab-time-sel" class="vgl-agm-input" style="width:auto;flex:1;padding:7px 9px;font-size:12px">
                <option value="">⏳ Consultando disponibilidades en AppCita...</option>
              </select>
            </div>
          </div>

          <textarea id="vgl-agm-obs" class="vgl-agm-input vgl-agm-c12" placeholder="Observaciones de la cita (ej. REMISION RCV CON CONTROL)..." rows="2"></textarea>
        </div>

        <div class="vgl-agm-foot">
          <button id="vgl-agm-cancel" class="vgl-agm-btn sec">Cancelar</button>
          <button id="vgl-agm-confirm" class="vgl-agm-btn pri" disabled>✓ Confirmar y asignar cita</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let selectedTimeframe = { m: 1, d: 0 };
    let selectedDateInfo = null;
    let selectedLabDateInfo = null; // v12.3.20 — día elegido para la toma de muestras (editable con chips)
    // v14.0.1 — Rango de días candidatos y su mapa iso->botón, hechos visibles fuera de
    // renderDayChips: cargarHoras() los necesita para el salto automático a "otro día del
    // mismo médico" cuando el día elegido no trae agenda PROPIA (ver más abajo).
    let diaRangeActual = [];
    let diaBotonesPorIso = new Map();
    let pacienteIdAcceso = null;
    // v12.5.13 — Eps/nombreCompleto del paciente, capturados del mismo BuscarPacienteDetallado
    // que ya se llamaba para los programas (más abajo): son exactamente los parámetros que pide
    // ImprimirRecordatorioCita (ver imprimirRecordatorioCita), así que no hace falta una consulta
    // aparte solo para imprimir.
    let pacienteEpsNombre = "";
    let pacienteNombreCompleto = "";
    // v12.10.8 — D3-bis: perfil del paciente (perfilPaciente/recomendacionHorario, ya
    // probadas con mutación en suite_24_motor_perfil.js) calculado UNA vez junto con los
    // programas — mismo patrón que pacienteEpsNombre/pacienteNombreCompleto de arriba.
    // Solo se usa el Eje A (franja horaria: "SUGERIDO" en la hora que recomienda para
    // diabetes/HTA+DM). El Eje B (cupos adicionales) queda sin conectar a propósito:
    // la evidencia está en captura_agendamiento_oficial_20260810.json donde el campo
    // `agenda` puede ser "Normal", "Adicional", o "Adicional-Staff" (SUPERPROMPT_AGENDA_V13.md
    // líneas 395-397). Todavía falta la estadística de ocupación de esos cupos (ver
    // BACKLOG_MEJORAS.md #3).
    let perfilDelPaciente = null;
    let progCargados = false;   // v12.1.0: los programas del paciente se cargan una vez
    let selectedTurnoObj = null;
    // v12.4.0 — Contexto del turno elegido (agenda y fecha reales de donde salió): lo
    // necesita la verificación en tiempo real del cupo justo antes de confirmar.
    let selectedTurnoCtx = null;
    // v12.4.0 — Detector de agenda congelada: si Everest devuelve EXACTAMENTE los mismos
    // turnos para fechas distintas, la agenda que llega está incompleta o el servidor
    // ignora la fecha — se le advierte al médico en vez de presentarlo como normal.
    const _turnosVistosPorFecha = new Map();

    const xBtn = modal.querySelector("#vgl-agm-x");
    const cancelBtn = modal.querySelector("#vgl-agm-cancel");
    const confirmBtn = modal.querySelector("#vgl-agm-confirm");
    const dateInfoEl = modal.querySelector("#vgl-agm-date-info");
    const slotsEl = modal.querySelector("#vgl-agm-slots");
    if (slotsEl) slotsEl.setAttribute("aria-live", "polite");
    const dayChipsEl = modal.querySelector("#vgl-day-chips");

    let cerrado = false;
    const vivo = () => !cerrado && modal.isConnected !== false;
    const closeMod = () => {
      cerrado = true;
      xBtn?.removeEventListener("click", closeMod);
      cancelBtn?.removeEventListener("click", closeMod);
      modal.removeEventListener("click", typeof bgClick !== 'undefined' ? bgClick : closeMod);
      modal.innerHTML = "";
      modal.remove();
    };
    xBtn.addEventListener("click", closeMod);
    cancelBtn.addEventListener("click", closeMod);
    _activarAccesibilidadModal(modal, closeMod);

    // v14.0.1 — Extraída de cargarHoras (misma regla, ahora también la usa el sondeo en
    // segundo plano de renderDayChips): qué agendas de una lista pertenecen de verdad al
    // médico activo, por coincidencia de nombre. Sin nombre no se filtra nada (nm.includes("")
    // sería siempre cierto y elegiría cualquier agenda como "propia").
    function _agendasPropias(agendasDelDia, nombreMedico) {
      const normMedDoc = stripAccents(String(nombreMedico || "").toLowerCase()).trim();
      if (!normMedDoc) return [];
      const toks = normMedDoc.split(/\s+/).filter(Boolean);
      return agendasDelDia.filter((a) => {
        const nm = stripAccents(String(a.medico || a.usuarioNombreCompleto || a.nombreMedico || a.profesional || a.nombre || "").toLowerCase());
        return nm.includes(normMedDoc) || (toks.length > 0 && toks.every((tok) => tok.length > 2 && nm.includes(tok)));
      });
    }

    // v14.0.1 — Pedido explícito del médico (reportado en consultorio con pantallazo): si
    // el día elegido no tiene su agenda propia, no basta con avisar — hay que buscar SOLO
    // otro día del rango que sí la tenga, empezando por el más cercano en el tiempo (antes
    // o después, el que quede más próximo). Consulta uno por uno (no hay forma de pedirle
    // varios días a la vez a este endpoint) y se detiene en el primero que sí encuentra
    // agenda propia real. `tokenOriginal` cancela la búsqueda si el médico cierra el modal
    // o cambia de día a mano mientras tanto — igual que el resto de cargarHoras.
    async function _buscarDiaConAgendaPropia(tokenOriginal) {
      const centroIso = selectedDateInfo.iso;
      const centroMs = new Date(centroIso + "T12:00:00").getTime();
      const candidatos = diaRangeActual
        .filter((it) => it.iso !== centroIso)
        .slice()
        .sort((a, b) => {
          const da = Math.abs(new Date(a.iso + "T12:00:00").getTime() - centroMs);
          const db = Math.abs(new Date(b.iso + "T12:00:00").getTime() - centroMs);
          return da - db;
        });
      for (const item of candidatos) {
        if (!vivo() || tokenOriginal !== _cargarHorasToken) return null;
        let res;
        try { res = await apiAccesoBuscarCitasDisponibles(pacienteIdAcceso, item.iso, selectedEspId); } catch (e) { continue; }
        const agendasDeEseDia = extractAgendasList(res).filter((a) => String(a.fechaAgenda || "").trim() === item.fmt);
        if (_agendasPropias(agendasDeEseDia, doctorName).length) return item;
      }
      return null;
    }

    let _cargarHorasToken = 0;
    let _cargarHorasLabToken = 0;
    async function cargarHoras() {
      if (!selectedDateInfo) return;
      const token = ++_cargarHorasToken;
      selectedTurnoObj = null;
      selectedTurnoCtx = null;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "✓ Sí, Crear Cita";
      dateInfoEl.innerHTML = `Servicio: <b>${escapeHtml(selectedEspName)}</b> · Fecha deseada: <b>${escapeHtml(selectedDateInfo.fmt)}</b> <span style="color:var(--c-verde)">(${escapeHtml(selectedDateInfo.lbl)})</span>`;
      const suggestedLab = calcBusinessDaysBefore(selectedDateInfo.iso, 5);
      const labLbl = modal.querySelector("#vgl-lab-date-lbl");
      if (labLbl) labLbl.textContent = `${suggestedLab.fmt} (${suggestedLab.dayLbl})`;

      // v12.3.20 — El día de laboratorio ahora tiene chips ±3 días hábiles, igual que la
      // cita principal: si el sugerido no tiene turnos, el médico puede elegir otro sin
      // quedar bloqueado. renderLabDayChips ya dispara la consulta de horas del día centro.
      renderLabDayChips(suggestedLab.iso);







      slotsEl.innerHTML = `<div class="vgl-agm-loading">Buscando agendas de ${escapeHtml(selectedEspName)} para el ${escapeHtml(selectedDateInfo.fmt)}...</div>`;

      if (!pacienteIdAcceso) {
        pacienteIdAcceso = await apiAccesoBuscarPaciente(apt.doc_id);
      }
      if (!vivo()) return;
      if (token !== _cargarHorasToken) return;

      if (!pacienteIdAcceso) {
        // v12.3.1 — BuscarPaciente exige el UsuarioId del profesional: con UsuarioId=0
        // "no encuentra" a NADIE. Si esa es la causa, decirlo con claridad — el mensaje
        // genérico culpaba al paciente y en el equipo de otro médico fallaban todos.
        if (!(state.activeDoctor.id || S.medicoId)) {
          slotsEl.innerHTML = `<div class="vgl-agm-err">⚠ El panel aún no identifica su usuario de Everest, y sin él la búsqueda de pacientes no funciona. Abra <b>Ajustes</b> y escriba <b>su identificador de médico</b>, o use una vez la agenda oficial de Everest para que se detecte solo.</div>`;
        } else {
          slotsEl.innerHTML = `<div class="vgl-agm-err">⚠ No se encontró el paciente en el sistema de agenda con el documento ${escapeHtml(apt.doc_id)}.</div>`;
        }
        return;
      }

      // v12.1.0 — Se cargan los programas del paciente para el selector, una sola vez por
      // modal. Solo se ofrecen los marcados swProgramaEspecial (los mismos que lista la
      // aplicación oficial: en la captura, "Salud Mental" no aparecía y sí las otras dos).
      if (!progCargados) {
        progCargados = true;
        try {
          const det = await pageFetchJson(`/apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado?idPaciente=${pacienteIdAcceso}`);
          if (!vivo()) return;
          pacienteEpsNombre = (det && det.data && det.data.eps && det.data.eps.nombre) || "";
          pacienteNombreCompleto = (det && det.data && det.data.nombreCompleto) || "";
          // v12.10.8 — D3-bis: TODOS los programas (no solo los swProgramaEspecial===true
          // que se filtran para el selector de abajo) — perfilPaciente() ya sabe ignorar
          // lo que no reconoce, y una etiqueta como "Diabetes" puede no venir marcada
          // como programa especial pese a ser la que decide la franja horaria.
          const etiquetasPaciente = ((det && det.data && det.data.programasPaciente) || [])
            .map((p) => p && p.descripcion).filter(Boolean);
          perfilDelPaciente = perfilPaciente(etiquetasPaciente);
          const progs = ((det && det.data && det.data.programasPaciente) || []).filter((p) => p && p.swProgramaEspecial === true && p.id);
          const box = modal.querySelector("#vgl-agm-prog-box"), sel = modal.querySelector("#vgl-agm-prog-sel");
          if (progs.length && box && sel) {
            sel.innerHTML = progs.map((p, i) => `<option value="${escapeHtml(String(p.id))}"${i === 0 ? " selected" : ""}>${escapeHtml(String(p.descripcion || ("Programa " + p.id)))}</option>`).join("");
            box.style.display = "block";
          }

          // v12.2.0 — Celular del SMS: se muestra el registrado para que el médico lo vea
          // y pueda corregirlo. Si el paciente no tiene ninguno, la casilla del SMS se
          // desmarca y se dice por qué, en vez de intentar un envío que no llegaría.
          const tel = String((det && det.data && (det.data.celular || det.data.telefono)) || "").replace(/\D/g, "");
          const inpTel = modal.querySelector("#vgl-agm-sms-tel");
          const chkSms = modal.querySelector("#vgl-agm-sms-chk");
          const notaSms = modal.querySelector("#vgl-agm-sms-nota");
          if (inpTel) {
            inpTel.value = tel;
            inpTel.placeholder = tel ? "" : "sin celular registrado";
            if (!tel) {
              if (chkSms) { chkSms.checked = false; }
              if (notaSms) notaSms.textContent = "— el paciente no tiene celular en su ficha";
            } else if (notaSms) {
              notaSms.textContent = "— verifíquelo antes de confirmar";
            }
          }

          // v12.6.4 — Pedido explícito del médico: que se vea, junto a la casilla de
          // laboratorio, si esa cita TAMBIÉN recibe SMS. No es un envío aparte: reusa el
          // MISMO celular/casilla de arriba, que apiLaboratorioAgendarAuto ya recibe como
          // parámetro `celular` y ya envía a EnviarMensajeTextoLaboratorio (ver esa función)
          // — esto solo lo hace visible donde el médico está mirando de verdad. Se
          // actualiza en vivo si el médico corrige el celular o desmarca la casilla.
          const notaLabSms = modal.querySelector("#vgl-agm-lab-sms-nota");
          const actualizarNotaLabSms = () => {
            if (!notaLabSms) return;
            const marcado = !!(chkSms && chkSms.checked);
            const telActual = String((inpTel && inpTel.value) || "").replace(/\D/g, "");
            notaLabSms.textContent = (marcado && telActual.length >= 7)
              ? `📱 También se envía SMS de recordatorio al ${telActual} (mismo número de arriba)`
              : "📱 Sin SMS para esta cita: marque «Enviar SMS de recordatorio» arriba y verifique el celular";
          };
          actualizarNotaLabSms();
          if (chkSms) chkSms.addEventListener("change", actualizarNotaLabSms);
          if (inpTel) inpTel.addEventListener("input", actualizarNotaLabSms);
        } catch (e) { console.warn("[Vigilante] no se pudieron cargar los datos del paciente:", e); }
      }

      const resAgendas = await apiAccesoBuscarCitasDisponibles(pacienteIdAcceso, selectedDateInfo.iso, selectedEspId);
      if (!vivo()) return;
      if (token !== _cargarHorasToken) return;
      const agendas = extractAgendasList(resAgendas);

      if (!agendas || !agendas.length) {
        slotsEl.innerHTML = `<div class="vgl-agm-err">No hay agendas abiertas de ${escapeHtml(selectedEspName)} para el ${escapeHtml(selectedDateInfo.fmt)}. Prueba haciendo clic en otro día vecino arriba.</div>`;
        return;
      }

      // v11.0.1 — FILTRO POR FECHA. La respuesta del servidor mezcla agendas de VARIOS días
      // (en la captura real: 123 agendas repartidas en 7 fechas distintas, incluidas 3 del
      // mismo día de la consulta). Sin este filtro se podían ofrecer turnos de un día que
      // no era el que el médico eligió en los chips.
      const agendasDelDia = agendas.filter((a) => String(a.fechaAgenda || "").trim() === selectedDateInfo.fmt);
      if (!agendasDelDia.length) {
        slotsEl.innerHTML = `<div class="vgl-agm-err">No hay agendas de ${escapeHtml(selectedEspName)} el ${escapeHtml(selectedDateInfo.fmt)}. Elija otro día del rango.</div>`;
        return;
      }

      let agendasFiltradas = agendasDelDia;
      if (selectedEspId === 12) {
        // v12.4.0 — BLINDAJE "solo aparece 5:30 PM": antes se usaba .find() — la PRIMERA
        // agenda propia del día y las demás a la basura. Con jornada partida (mañana +
        // tarde = dos agendas el mismo día), el médico veía únicamente los turnos de la
        // agenda que el servidor listara primero (p. ej. la de tarde con un solo cupo a
        // las 17:30) y "su agenda" parecía tener un único horario, todos los días.
        // Ahora se consultan TODAS las agendas propias del día.
        const misAgendas = _agendasPropias(agendasDelDia, doctorName);
        if (misAgendas.length) {
          agendasFiltradas = misAgendas;
        } else {
          // v14.0.1 — Reportado en consultorio EN VIVO con pantallazo: antes, si no se
          // reconocía la agenda propia, se caía a mostrar los turnos de OTRO profesional
          // con solo un aviso rojo ("verifique el nombre antes de confirmar") — un clic
          // distraído podía agendar al paciente con el médico equivocado. Ahora este día
          // se BLOQUEA (nunca se ofrecen turnos ajenos) y se busca automáticamente, entre
          // los demás días del rango, el más cercano que sí tenga agenda propia real.
          slotsEl.innerHTML = `<div class="vgl-agm-loading">Este día solo tiene agenda de otro profesional — buscando el día más cercano con SU agenda propia...</div>`;
          const otroDia = await _buscarDiaConAgendaPropia(token);
          if (!vivo() || token !== _cargarHorasToken) return;
          if (otroDia) {
            diaBotonesPorIso.forEach((b) => b.classList.remove("active"));
            const btnNuevo = diaBotonesPorIso.get(otroDia.iso);
            if (btnNuevo) btnNuevo.classList.add("active");
            selectedDateInfo = otroDia;
            cargarHoras();
            return;
          }
          slotsEl.innerHTML = `<div class="vgl-agm-err">⚠ Ningún día del rango tiene su agenda propia identificada — solo se encontraron agendas de otros profesionales. Verifique su nombre en Ajustes, o elija la fecha desde la agenda oficial de Everest.</div>`;
          return;
        }
      }

      // v12.4.0 — Evidencia en consola para diagnosticar agendas incompletas: cuántas
      // agendas llegaron, de qué fechas, y cuántas son del médico. Sin datos de paciente.
      try {
        console.log("[Vigilante Agendamiento] diagnóstico agendas:", {
          fechaPedida: selectedDateInfo.fmt, recibidas: agendas.length, delDia: agendasDelDia.length,
          propias: agendasFiltradas === agendasDelDia ? 0 : agendasFiltradas.length,
          fechasRecibidas: [...new Set(agendas.map((a) => String(a.fechaAgenda || "").trim()))].slice(0, 12),
        });
        // v14.0.0 — DIAGNÓSTICO DEL SÁBADO QUE TRABAJA ESTE MÉDICO (opción elegida por el
        // médico el 14-ago frente a buscar un campo propio en Everest, que nadie ha visto).
        // Cada médico trabaja un sábado cada 15 días y el script necesita saber CUÁL para
        // ofrecerlo como día agendable (encargo del 12-ago). No se inventa la regla ni se
        // añade ninguna petición: se OBSERVA la respuesta que esta pantalla YA trae, se
        // anotan los sábados con agenda propia real y se deja constancia en consola para
        // deducir la cadencia con datos de campo antes de cablear nada.
        // Deliberadamente NO decide ni agenda: solo registra. Cablear la cadencia sin
        // varias observaciones sería adivinar en qué sábados trabaja el médico.
        const sabadosConAgenda = agendas
          .map((a) => String(a.fechaAgenda || "").trim())
          .filter((f) => f)
          .filter((f, i, arr) => arr.indexOf(f) === i)
          .filter((f) => {
            // fechaAgenda viene como dd/mm/aaaa en esta respuesta (mismo formato que
            // selectedDateInfo.fmt); se convierte a Date sin depender del locale del PC.
            const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(f);
            if (!m) return false;
            const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
            return d.getDay() === 6;   // 6 = sábado
          });
        if (sabadosConAgenda.length) {
          console.log("[Vigilante Agendamiento] diagnóstico SÁBADO del médico — sábados con agenda en esta respuesta:",
            sabadosConAgenda,
            "· médico:", (state.activeDoctor && state.activeDoctor.id) || "(sin id)",
            "· NOTA: junte varias de estas líneas de días distintos para deducir cada cuántos sábados le toca. Aún no se usa para agendar.");
        }
      } catch (e) {}

      slotsEl.innerHTML = `<div class="vgl-agm-loading">Consultando turnos en ${escapeHtml(String(agendasFiltradas.length))} agenda(s)...</div>`;

      const turnosAcumulados = [];
      for (const ag of agendasFiltradas.slice(0, 8)) {
        if (!vivo()) return;
        if (token !== _cargarHorasToken) return;
        const agendaId = ag.agendaId || ag.id || ag.AgendaId || ag.idAgenda || ag.IdAgenda || ag.AGendadId;
        const nombreProf = ag.medico || ag.usuarioNombreCompleto || ag.nombreMedico || ag.profesional || ag.nombre || "Profesional";
        // v11.0.1 — El veredicto de la validación ya no se tira a la basura: si el servidor
        // dice explícitamente que esta agenda no admite al paciente, se salta en vez de
        // ofrecer turnos que después fallarán al confirmar.
        const val = await apiAccesoAgdValidarAgenda(agendaId, pacienteIdAcceso);
        const vd = val && val.data;
        if (vd && vd.isError === true) { console.warn("[Vigilante] agenda descartada por validación:", agendaId, vd.mensaje); continue; }

        const resTurnos = await apiAccesoObtenerTurnos(agendaId, selectedDateInfo.fmt, pacienteIdAcceso);
        const turnos = extractAgendasList(resTurnos);
        if (turnos && turnos.length) {
          turnos.forEach((t) => turnosAcumulados.push({ turno: t, agendaId, profesional: nombreProf, sede: ag.sede || "", fecha: ag.fechaAgenda || selectedDateInfo.fmt }));
        }
      }

      if (!vivo()) return;
      if (token !== _cargarHorasToken) return;

      if (!turnosAcumulados.length) {
        slotsEl.innerHTML = `<div class="vgl-agm-err">Sin horas libres en ${escapeHtml(selectedEspName)} para el ${escapeHtml(selectedDateInfo.fmt)}. Seleccione otro día del rango.</div>`;
        return;
      }

      slotsEl.innerHTML = "";
      // v11.0.1 — Solo turnos activos. "ACT" es el único estado visto en campo; si el
      // campo no viene, se asume activo para no dejar al médico sin poder agendar.
      const turnosLibres = turnosAcumulados.filter((x) => {
        const e = String((x.turno && x.turno.estado) || "ACT").toUpperCase().trim();
        return e === "" || e === "ACT";
      });
      // v12.4.0 — Distribución de estados en consola: si un día "lleno salvo las 5:30 PM"
      // es real o es un estado de cupo que el filtro no reconoce, esta línea lo delata.
      try {
        const dist = {};
        turnosAcumulados.forEach((x) => { const e = String((x.turno && x.turno.estado) || "(sin estado)").toUpperCase().trim() || "(vacío)"; dist[e] = (dist[e] || 0) + 1; });
        console.log("[Vigilante Agendamiento] turnos del", selectedDateInfo.fmt, "→ total:", turnosAcumulados.length, "· libres:", turnosLibres.length, "· estados:", dist);
      } catch (e) {}
      if (!turnosLibres.length) {
        slotsEl.innerHTML = `<div class="vgl-agm-err">Hay turnos en la agenda del ${escapeHtml(selectedDateInfo.fmt)} pero ninguno está activo. Elija otro día.</div>`;
        return;
      }
      // v12.4.0 — Detector de agenda congelada: la firma de los turnos (ids ordenados) se
      // compara entre fechas distintas dentro del mismo modal. Si DOS fechas devuelven
      // exactamente los mismos turnos, el servidor está ignorando la fecha pedida o la
      // agenda llega incompleta — se advierte en pantalla y en consola, porque "el mismo
      // único cupo de 5:30 PM todos los días" es exactamente esa firma repetida.
      try {
        // v12.4.1 — La firma exige que TODOS los turnos tengan id reconocible: si alguno
        // viene sin id, la firma queda vacía y no se compara (antes, turnos sin id daban
        // la firma ",," y CUALQUIER par de fechas disparaba el falso positivo). La clave
        // lleva la especialidad: los mismos turnos en fechas distintas solo alarman
        // dentro de la MISMA especialidad.
        const ids = turnosLibres.map(({ turno: t }) => String(t.turnoId || t.id || t.TurnoId || t.idTurno || t.IdTurno || "")).filter(Boolean);
        const firma = (ids.length && ids.length === turnosLibres.length) ? ids.sort().join(",") : "";
        const claveFecha = selectedEspId + "|" + selectedDateInfo.fmt;
        if (firma) {
          for (const [clavePrev, firmaPrev] of _turnosVistosPorFecha) {
            if (clavePrev !== claveFecha && clavePrev.split("|")[0] === String(selectedEspId) && firmaPrev === firma) {
              const w2 = document.createElement("div");
              w2.className = "vgl-agm-err";
              w2.textContent = `⚠ Everest devolvió LOS MISMOS turnos para el ${clavePrev.split("|")[1]} y el ${selectedDateInfo.fmt}. La agenda puede estar llegando incompleta — verifique en la agenda oficial antes de confiar en estos horarios.`;
              slotsEl.appendChild(w2);
              console.warn("[Vigilante Agendamiento] agenda congelada: firma de turnos idéntica entre fechas", clavePrev, "y", claveFecha, "→", firma);
              break;
            }
          }
        }
        _turnosVistosPorFecha.set(claveFecha, firma);
      } catch (e) {}
      // v12.10.8 — D3-bis, Eje A: la hora que perfilPaciente()+recomendacionHorario()
      // recomiendan (primera mitad de la jornada, solo si el perfil del paciente la
      // impone) se resalta con una insignia — nunca se preselecciona ni se oculta el
      // resto. El médico sigue eligiendo cualquier hora libre con un clic normal.
      const recHorario = perfilDelPaciente
        ? recomendacionHorario(perfilDelPaciente, turnosLibres.map((x) => x.turno))
        : { sugerida: null, rangoTexto: null, horasEnFranja: [] };
      turnosLibres.forEach(({ turno: t, agendaId, profesional, sede, fecha }) => {
        const horaTxt = t.horaTexto || t.hora || t.horaInicio || "Hora s/d";
        const esSugerida = !!recHorario.sugerida && normalizeHora(horaTxt) === recHorario.sugerida;
        // v14.0.0 — El encargo del médico eran DOS cosas, no una: «se deben repintar de
        // otro color Y escoger alguna de esas como sugerida». Hasta ahora solo se hacía la
        // segunda: se marcaba UNA hora con la insignia ⭐ y las demás horas de la franja
        // recomendada quedaban idénticas a las de fuera de franja. De hecho
        // recomendacionHorario() YA calculaba `horasEnFranja` (6:00–9:00 y 13:00–16:00,
        // según D3-bis) y el valor se descartaba sin usar.
        // Ahora toda hora dentro de la franja se repinta, y la elegida como sugerida
        // conserva además su insignia — así el médico ve de un vistazo el BLOQUE
        // recomendado para el perfil del paciente, no solo un punto suelto, y sigue
        // pudiendo escoger cualquier otra hora (nada se bloquea ni se oculta).
        const enFranja = !esSugerida && Array.isArray(recHorario.horasEnFranja) &&
          recHorario.horasEnFranja.indexOf(normalizeHora(horaTxt)) !== -1;
        // v14.0.0 — CITAS ADICIONALES (encargo del 12-ago). Son los cupos extra que se
        // abren fuera de la malla normal de 20 minutos; el médico pidió resaltarlas «con
        // otros colores y otros elementos visuales» porque no son intercambiables con una
        // cita normal. Y pidió también la regla clínica de a quién ofrecérselas:
        //   «solamente se deben sugerir a aquellos pacientes hipertensos que no tengan
        //    diabetes ni enfermedad renal crónica… en casos puntuales que no haya más
        //    citas ni agendas en otros días se habilitarían para cualquier paciente».
        // Eso es exactamente el Eje B de D3-bis (perfil.adicionales), que hasta ahora se
        // calculaba y NADIE leía: true = HTA puro, este paciente es el destinatario;
        // false = DM o nefro, se marca pero se desaconseja; "visibles" = sin etiqueta
        // reconocida, se marca sin opinar. NUNCA se ocultan ni se bloquean: el médico
        // debe poder usarlas cuando no queda otra, que es el caso puntual que él describió.
        const infoCupo = esCupoAdicional(t, normalizeHora(horaTxt));
        const esAdicional = infoCupo.adicional;
        const adicionalRecomendada = esAdicional && perfilDelPaciente && perfilDelPaciente.adicionales === true;
        const adicionalDesaconsejada = esAdicional && perfilDelPaciente && perfilDelPaciente.adicionales === false;
        // v11.0.1 — El profesional y la fecha se muestran SIEMPRE (antes se ocultaban en
        // Medicina General, que es justo donde el fallback podía colar otra agenda).
        const marcaAdicional = esAdicional ? `<span class="vgl-agm-cupo-adic">+ ADICIONAL</span> ` : "";
        const labelCompleto = (esSugerida ? "⭐ SUGERIDO · " : (enFranja ? "● " : "✓ ")) + marcaAdicional + `${escapeHtml(horaTxt)} — ${escapeHtml(profesional)} (${escapeHtml(String(fecha || ""))}${sede ? " · " + escapeHtml(String(sede)) : ""})`;
        const btn = document.createElement("button");
        btn.className = "vgl-agm-sbtn" + (selectedEspId !== 12 ? " vgl-wrap" : "") +
          (esSugerida ? " vgl-agm-sbtn-sugerido" : "") + (enFranja ? " vgl-agm-sbtn-franja" : "") +
          (esAdicional ? " vgl-agm-sbtn-adicional" : "") +
          (adicionalDesaconsejada ? " vgl-agm-sbtn-adic-no" : "");
        const notaCupo = !esAdicional ? "" :
          (adicionalRecomendada
            ? " · Cupo ADICIONAL: apropiado para este paciente (hipertenso sin diabetes ni enfermedad renal)."
            : adicionalDesaconsejada
              ? " · Cupo ADICIONAL: este paciente tiene diabetes o enfermedad renal — se reserva para hipertensos, úselo solo si no queda otra cita."
              : " · Cupo ADICIONAL (fuera de la malla de 20 minutos).") +
          (infoCupo.fuente === "hora" ? " [deducido por la hora, Everest no marcó el tipo de cupo]" : "");
        if (esSugerida) btn.title = `Horario sugerido para este paciente (franja ${recHorario.rangoTexto || "recomendada"})` + notaCupo;
        else if (enFranja) btn.title = `Dentro de la franja recomendada para este paciente (${recHorario.rangoTexto || "recomendada"}) — puede elegir esta o cualquier otra` + notaCupo;
        else if (notaCupo) btn.title = notaCupo.replace(/^ · /, "");
        btn.innerHTML = labelCompleto;
        btn.addEventListener("click", () => {
          modal.querySelectorAll(".vgl-agm-sbtn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedTurnoObj = t;
          selectedTurnoCtx = { agendaId, fecha: selectedDateInfo.fmt, horaTxt }; // v12.4.0
          confirmBtn.disabled = false;
          confirmBtn.textContent = `✓ Sí, Crear Cita en ${selectedEspName} (${horaTxt})`;
        });
        slotsEl.appendChild(btn);
      });
    }

    // v12.3.20 — Consulta los turnos de laboratorio REALES para selectedLabDateInfo (no
    // para una fecha recalculada a ciegas). Se saca de la IIFE original de cargarHoras()
    // para poder llamarla otra vez cuando el médico pulsa un chip de día distinto.
    async function cargarHorasLab() {
      if (!selectedLabDateInfo) return;
      const labToken = ++_cargarHorasLabToken;
      const labTimeSel = modal.querySelector("#vgl-agm-lab-time-sel");
      const labChk = modal.querySelector("#vgl-agm-lab-chk");
      // v12.3.22 — BLOQUEANTE hallado en revisión adversarial: si el médico ya había
      // marcado la casilla para un día de laboratorio Y LUEGO cambiaba el día de la
      // CITA PRINCIPAL (navegación normal por los chips de arriba), cargarHoras()
      // recalculaba suggestedLab y volvía a llamar renderLabDayChips(), que sobrescribía
      // selectedLabDateInfo EN SILENCIO sin tocar la casilla — si el nuevo día también
      // tenía cupo, la casilla seguía marcada pero apuntando a una fecha que el médico
      // NUNCA eligió. Se desmarca y bloquea aquí, al INICIO de cada consulta (cubre
      // tanto el recentrado por cambio de cita principal como el clic directo en un
      // chip de laboratorio distinto), para que solo quede marcada una fecha que el
      // médico confirmó viendo el resultado real de esa fecha.
      if (labChk) { labChk.checked = false; labChk.disabled = true; }
      if (labTimeSel) labTimeSel.innerHTML = `<option value="">⏳ Consultando disponibilidades en AppCita...</option>`;
      try {
        const urlTurnos = `https://appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/ObtenerTurnosPorFecha?sedeId=378&fechaBuscar=${selectedLabDateInfo.iso}`;
        const resAg = await gmPostJson(urlTurnos, {});
        if (!vivo()) return;
        // v11.0.1 — Guarda de respuesta obsoleta: si el médico ya pulsó otro chip de fecha
        // (principal o de laboratorio) mientras esta consulta viajaba, sus horas pertenecen
        // a otro día y no deben pintarse.
        if (labToken !== _cargarHorasLabToken) return;
        const turnos = extractAgendasList(resAg);
        // v11.0.1 — Se descartan los turnos sin hora real en vez de fabricar "07:00:00".
        const turnosConHora = (turnos || []).filter((t) => t && (t.hora || t.horaTexto || t.Hora));
        if (labTimeSel) {
          if (turnosConHora.length > 0) {
            labTimeSel.innerHTML = turnosConHora.map((t, idx) => {
              const hRaw = t.hora || t.horaTexto || t.Hora;
              const hFmt = format12hTime(hRaw);
              const selected = idx === 0 ? "selected" : "";
              return `<option value="${escapeHtml(hRaw)}" ${selected}>${escapeHtml(hFmt)}</option>`;
            }).join("");
            if (labChk) { labChk.disabled = false; }
          } else {
            labTimeSel.innerHTML = `<option value="">⛔ No hay turnos de laboratorio disponibles para el ${escapeHtml(selectedLabDateInfo.fmt)}. Elija otro día arriba.</option>`;
            if (labChk) { labChk.checked = false; labChk.disabled = true; }
          }
        }
      } catch(e) {
        if (!vivo()) return;
        if (labTimeSel) labTimeSel.innerHTML = `<option value="">⚠ No se pudo conectar con AppCita</option>`;
        if (labChk) { labChk.checked = false; labChk.disabled = true; }
      }
    }

    // v12.3.20 — Chips ±3 días hábiles alrededor del día sugerido de toma de muestras,
    // igual patrón que renderDayChips para la cita principal. Se regenera cada vez que
    // cambia la fecha de la cita principal, porque el centro (5 días hábiles antes) cambia.
    function renderLabDayChips(centerIso) {
      const labChipsEl = modal.querySelector("#vgl-lab-day-chips");
      if (!labChipsEl) return;
      const range = calcDateRangeAroundIso(centerIso, 3);
      labChipsEl.innerHTML = "";
      const labLblEl = modal.querySelector("#vgl-lab-date-lbl");

      range.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "vgl-agm-pbtn vgl-sm" + (item.isCenter ? " active" : "");
        btn.innerHTML = item.isCenter ? `<b>${escapeHtml(item.shortLbl)} 🎯</b>` : escapeHtml(item.shortLbl);
        btn.addEventListener("click", () => {
          labChipsEl.querySelectorAll(".vgl-agm-pbtn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedLabDateInfo = item;
          if (labLblEl) labLblEl.textContent = `${item.fmt} (${item.lbl})`;
          cargarHorasLab();
        });
        labChipsEl.appendChild(btn);
        if (item.isCenter) selectedLabDateInfo = item;
      });
      cargarHorasLab();
    }

    // v14.0.0 — Encargo del médico (12-ago), conectado con calcRangoSondeoIso (existía,
    // probada, 0 llamadores): "los días que se muestren sean 7 días antes (hábiles) y 7
    // días después (hábiles) a la cita sugerida... se deben incluir los sábados laborales
    // ... no se deben mostrar los días en los que no haya agenda". Reemplaza a
    // calcTargetDateRange (±3 días hábiles, SIN sábados), que quedaba como duplicado
    // reducido de la misma idea. No se borra calcTargetDateRange: T5 la usa vía
    // openLabSoloModal para los días de laboratorio, que no pidió este cambio.
    let _sweepAgendaToken = 0;
    function renderDayChips(m, d) {
      const isoBase = calcBusinessTargetDate(m, d).iso;
      const range = calcRangoSondeoIso(isoBase);
      diaRangeActual = range;
      dayChipsEl.innerHTML = "";
      const miToken = ++_sweepAgendaToken;
      // Mapa iso -> botón, guardado por CIERRE en vez de buscarse luego con querySelector:
      // el DOM falso del arnés de pruebas deja querySelector/querySelectorAll como no-op
      // (mismo hallazgo ya documentado varias veces en este proyecto), y en el navegador
      // real esto además evita un recorrido del DOM por cada uno de los ~17 días del sondeo.
      const botonesPorIso = new Map();
      diaBotonesPorIso = botonesPorIso;

      range.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "vgl-agm-pbtn vgl-sm" + (item.esSabado ? " vgl-agm-pbtn-sabado" : "");
        // El estado "active" se marca SIEMPRE por classList (nunca concatenado en el string
        // inicial): así el sondeo en segundo plano, que decide qué chip no retirar mirando
        // classList.contains("active"), lee la misma fuente de verdad que el clic de arriba.
        if (item.isCenter) btn.classList.add("active");
        btn.innerHTML = item.isCenter ? `<b>${escapeHtml(item.shortLbl)} 🎯</b>` : escapeHtml(item.shortLbl);
        if (item.esSabado) btn.title = "Sábado — este médico no siempre tiene agenda los sábados. Se está verificando en segundo plano; si no hay turnos, este día se retirará solo.";
        btn.addEventListener("click", () => {
          botonesPorIso.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedDateInfo = item;
          cargarHoras();
        });
        dayChipsEl.appendChild(btn);
        botonesPorIso.set(item.iso, btn);
        if (item.isCenter) selectedDateInfo = item;
      });
      cargarHoras();

      // "No se deben mostrar los días en los que no haya agenda": se verifica en SEGUNDO
      // PLANO, con concurrencia acotada (mapConLimite — existía, probada, 0 llamadores),
      // para no bloquear la apertura del modal con hasta 15 peticiones antes del primer
      // pintado. Solo se OCULTA un día si la consulta confirma cero turnos; ante un error
      // de red el chip se deja tal cual — es más seguro mostrar de más que ocultar un día
      // que sí tenía agenda por un problema de conexión.
      _sondearAgendaDeCadaDia(range, botonesPorIso, miToken);
    }

    async function _sondearAgendaDeCadaDia(range, botonesPorIso, miToken) {
      try {
        if (!pacienteIdAcceso) pacienteIdAcceso = await apiAccesoBuscarPaciente(apt.doc_id);
      } catch (e) { return; }
      if (!vivo() || !pacienteIdAcceso || miToken !== _sweepAgendaToken) return;
      // Los sábados van primero: son los únicos con probabilidad real de estar vacíos
      // ("cada médico trabaja un sábado cada 15 días" — el propio médico lo describió así),
      // así que se resuelven antes de gastar las peticiones acotadas en días hábiles que
      // casi siempre sí tienen agenda.
      const candidatos = range.slice().sort((x, y) => (y.esSabado ? 1 : 0) - (x.esSabado ? 1 : 0));
      await mapConLimite(candidatos, 3, async (item) => {
        if (miToken !== _sweepAgendaToken) return;
        let hayAgenda = true; // por defecto NO se oculta: un fallo de red no debe borrar un día real
        try {
          const res = await apiAccesoBuscarCitasDisponibles(pacienteIdAcceso, item.iso, selectedEspId, true);
          const agendasDelDia = extractAgendasList(res).filter((a) => String(a.fechaAgenda || "").trim() === item.fmt);
          // v14.0.2 — Gap documentado desde v14.0.1: el sondeo en segundo plano decidía
          // "hay agenda" con CUALQUIER agenda de la respuesta (propia o ajena), así que un
          // sábado con agenda de OTRO profesional se ofrecía como chip normal — y al
          // pulsarlo, cargarHoras() lo bloqueaba igual que el día central y saltaba de
          // nuevo. Ahora el sondeo usa la MISMA regla de "propia" que cargarHoras() y
          // _buscarDiaConAgendaPropia (solo aplica a Medicina General, único caso donde el
          // concepto de agenda ajena existe: las demás especialidades no se filtran por
          // médico en ningún otro punto del modal).
          hayAgenda = selectedEspId === 12
            ? _agendasPropias(agendasDelDia, doctorName).length > 0
            : agendasDelDia.length > 0;
        } catch (e) { hayAgenda = true; }
        if (!vivo() || miToken !== _sweepAgendaToken) return;
        if (!hayAgenda) {
          // El botón ACTIVO (el que el médico tiene seleccionado en este momento) nunca se
          // retira, aunque su consulta confirme cero turnos: cargarHoras() ya le está
          // mostrando ese mismo resultado con su propio mensaje explícito
          // ("⛔ No hay turnos... Elija otro día"), y borrarle el chip de debajo de los
          // dedos sería peor experiencia que dejarlo con el error a la vista.
          const btn = botonesPorIso.get(item.iso);
          if (btn && !btn.classList.contains("active")) btn.remove();
        }
      }, () => miToken !== _sweepAgendaToken);
    }

    // Eventos para cambiar de Especialidad RCV
    modal.querySelectorAll("#vgl-esp-presets .vgl-agm-pbtn").forEach((eb) => {
      eb.addEventListener("click", () => {
        modal.querySelectorAll("#vgl-esp-presets .vgl-agm-pbtn").forEach((b) => b.classList.remove("active"));
        eb.classList.add("active");
        selectedEspId = parseInt(eb.getAttribute("data-esp") || "12", 10);
        selectedEspName = eb.getAttribute("data-name") || "Especialidad";
        cargarHoras();
      });
    });

    // Eventos para cambiar de Plazo (15 días, 1 mes, etc.)
    modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn").forEach((pb) => {
      pb.addEventListener("click", () => {
        modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn").forEach((b) => b.classList.remove("active"));
        pb.classList.add("active");
        const m = parseInt(pb.getAttribute("data-m") || "0", 10);
        const d = parseInt(pb.getAttribute("data-d") || "0", 10);
        selectedTimeframe = { m, d };
        renderDayChips(m, d);
      });
    });

    // Cargar ventana de días iniciales (1 mes)
    renderDayChips(1, 0);

    confirmBtn.addEventListener("click", async () => {
      if (!selectedTurnoObj || !selectedDateInfo || !pacienteIdAcceso) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "⏳ Asignando cita...";

      // v12.4.1 — CONTEXTO CONGELADO ANTES DE CUALQUIER await (hallazgo ALTO de la
      // revisión adversarial): si el médico clicaba otra hora o otro chip de fecha
      // mientras la verificación estaba en vuelo, el turno ASIGNADO podía divergir de la
      // hora/fecha mostradas en el mensaje de éxito. Todo lo que describe al turno se
      // captura en constantes aquí, y los botones de hora se bloquean mientras la
      // confirmación está en curso (los recrea habilitados cualquier cargarHoras()).
      const turnoElegido = selectedTurnoObj;
      const ctxElegido = selectedTurnoCtx;
      const fechaElegida = selectedDateInfo;
      const turnoId = turnoElegido.turnoId || turnoElegido.id || turnoElegido.TurnoId || turnoElegido.idTurno || turnoElegido.IdTurno;
      const horaTxt = turnoElegido.horaTexto || turnoElegido.hora || turnoElegido.horaInicio || "";
      modal.querySelectorAll(".vgl-agm-sbtn").forEach((b) => { b.disabled = true; });

      // v12.4.0 — VERIFICACIÓN EN TIEMPO REAL DEL CUPO (el mismo patrón que ya usaba el
      // laboratorio): justo antes de confirmar se re-consulta la agenda; si el turno
      // elegido ya no está activo (otro usuario lo tomó entre el listado y el clic), NO
      // se dispara AsignarTurno: se recargan los horarios frescos y se le dice al médico
      // que elija otra hora. Si la re-consulta falla por red (null), se sigue adelante:
      // el servidor sigue siendo la compuerta final y un fallo de red no debe bloquear.
      if (ctxElegido && ctxElegido.agendaId) {
        confirmBtn.textContent = "⏳ Verificando que el cupo siga disponible...";
        const fresco = await apiAccesoObtenerTurnos(ctxElegido.agendaId, ctxElegido.fecha, pacienteIdAcceso);
        if (!vivo()) return;
        const listaFresca = extractAgendasList(fresco);
        if (Array.isArray(listaFresca) && listaFresca.length) {
          const sigueLibre = listaFresca.some((t) => {
            const idT = t.turnoId || t.id || t.TurnoId || t.idTurno || t.IdTurno;
            const e = String((t && t.estado) || "ACT").toUpperCase().trim();
            return String(idT) === String(turnoId) && (e === "" || e === "ACT");
          });
          if (!sigueLibre) {
            vglLog("APPCITA", "TurnoYaNoDisponible", { turnoId });
            uxTrack("cita.cupo_perdido");
            const horaPerdida = ctxElegido.horaTxt || horaTxt || "elegida";
            selectedTurnoObj = null; selectedTurnoCtx = null;
            await cargarHoras(); // repinta los cupos REALES del momento (la hora tomada ya no aparece)
            if (vivo()) {
              const w = document.createElement("div");
              w.className = "vgl-agm-err";
              w.textContent = `⚠ La hora ${horaPerdida} ya no está disponible: acaba de ser tomada por otro usuario. Los horarios se actualizaron — elija otra hora.`;
              // prepend() no existe en todos los entornos (el DOM simulado del banco, WebViews viejos)
              if (typeof slotsEl.prepend === "function") slotsEl.prepend(w); else slotsEl.appendChild(w);
              confirmBtn.disabled = true;
              confirmBtn.textContent = "✓ Sí, Crear Cita";
            }
            return;
          }
        }
      }
      const isPyM = !!modal.querySelector("#vgl-agm-pym-chk").checked;
      const obsInput = modal.querySelector("#vgl-agm-obs").value || "";
      const obs = selectedEspId === 12 ? obsInput : `REMISION A ${selectedEspName.toUpperCase()}. ${obsInput}`.trim();

      console.log("[Vigilante Agendamiento] Asignando turno RCV:", { turnoId, pacienteIdAcceso, fechaIso: fechaElegida.iso, obs, isPyM, selectedEspId });
      vglLog("APPCITA", "AsignarTurnoRequested", { turnoId, pacienteIdAcceso, fecha: fechaElegida.iso });
      // v11.0.1 — Marcacion="NA": el valor que envía la aplicación oficial en la única
      // secuencia capturada que terminó en "Agendada Correctamente". "Consulta" no aparece
      // ni una vez en las 1527 llamadas registradas: era un valor inventado.
      // v12.1.0 — El programa que eligió el médico viaja como ProgramaId, igual que en
      // la aplicación oficial. Si el paciente no tiene programas, va vacío y no se envía.
      // v12.2.0 — El SMS solo sale si la casilla está marcada, y al número que el
      // médico tiene a la vista (puede haberlo corregido).
      const smsChk = modal.querySelector("#vgl-agm-sms-chk");
      const smsTel = modal.querySelector("#vgl-agm-sms-tel");
      // v12.3.31 — era /D/g (la letra D literal, no "no-dígito"): un celular con espacios
      // o guiones no se limpiaba de verdad antes de mandarlo. Debe ser /\D/g, igual que
      // el mismo patrón en apiAccesoAsignarTurno (línea ~6174).
      const celularSms = (smsChk && smsChk.checked && smsTel) ? String(smsTel.value || "").replace(/\D/g, "") : "";
      const progSel = modal.querySelector("#vgl-agm-prog-sel");
      const programaId = (progSel && progSel.value) || "";
      const res = await apiAccesoAsignarTurno(turnoId, pacienteIdAcceso, fechaElegida.iso, obs, isPyM, "NA", programaId, celularSms);
      // v12.0.0 — Se registran solo campos PLANOS y acotados. sanitizePII únicamente
      // censura valores de primer nivel, así que pasar el objeto `res` entero podía escribir
      // datos del paciente en la bitácora local sin filtrar.
      vglLog("APPCITA", "AsignarTurnoResponse", { error: !!(res && res.error), radicado: Number((res && res.data && res.data.radicado) || 0), motivo: String((res && res.data && res.data.motivo) || "") });
      console.log("[Vigilante Agendamiento] Respuesta AsignarTurno:", res);

      const isLabChecked = modal.querySelector("#vgl-agm-lab-chk")?.checked;
      const selectedLabTime = modal.querySelector("#vgl-agm-lab-time-sel")?.value;

      // v11.0.1 — ÉXITO ESTRICTO. Antes bastaba con que la respuesta trajera cualquier
      // `mensaje` (incluido uno de ERROR) para dar la cita por creada: se mostraba
      // "¡Cita Creada Exitosamente!", se marcaba al paciente como agendado del día y se
      // silenciaba al vigilante para él. Ahora se exige la forma confirmada en campo:
      // error:false + data.radicado>0 (o el motivo literal "Agendada Correctamente").
      const d = res && res.data;
      const ok = !!(res && res.error === false && d && (Number(d.radicado) > 0 || /Agendada Correctamente/i.test(String(d.motivo || ""))));
      if (ok) {
        // v12.3.14 — La cita YA quedó creada en el servidor: el registro y el estado de
        // abajo corren siempre; lo único que se salta si el modal fue cerrado es pintarlo.
        if (vivo()) {
          confirmBtn.classList.add("vgl-bg-success"); // [UI-CSS]
          confirmBtn.textContent = "✅ ¡Cita Creada Exitosamente!";

          const successMsg = document.createElement("div");
          successMsg.className = "vgl-agm-dinfo";
          successMsg.className = "vgl-msg-success"; // [UI-CSS]
          successMsg.innerHTML = `✅ <b>Cita asignada exitosamente</b><br>Fecha: <b>${escapeHtml(fechaElegida.fmt)}</b> · Hora: <b>${escapeHtml(horaTxt)}</b>`;
          modal.querySelector(".vgl-agm-card").appendChild(successMsg);
        }

        // v12.6.3 — Reportado en consultorio: este modal se autocierra 2.6 s después de
        // crear la cita (setTimeout(closeMod, 2600) más abajo), sin tiempo real de leer ni
        // pulsar el botón de imprimir cuando vivía DENTRO de él. mostrarPanelPostCita es un
        // panel flotante INDEPENDIENTE del modal: sobrevive a closeMod() y sigue en pantalla
        // hasta que el médico lo cierre a mano.
        mostrarPanelPostCita(d.radicado, pacienteEpsNombre, pacienteNombreCompleto || patientName, patientName);

        markCitaAgendadaHoy(apt.doc_id, fechaElegida.iso);
        uxTrack("cita.creada:" + selectedEspId);
        // v11.0.1 — persist=false y uid estable: los avisos persistentes que nadie cierra
        // quedan vivos en el Centro de actividades de Windows y REAPARECEN horas después.
        // Se indica además a qué número salió el SMS, para que el médico pueda verificarlo.
        notify("VERDE", "✅ Cita asignada exitosamente",
          `Paciente: ${patientName}\nFecha: ${fechaElegida.fmt} · Hora: ${horaTxt}`
          + (ultimoSmsEnviado ? `\nSMS de recordatorio enviado al ${ultimoSmsEnviado}.` : `\nSin SMS de recordatorio.`),
          false, "cita|" + apt.doc_id + "|" + fechaElegida.iso);
        bumpStat("atiempo");

        // v11.0.1 — La toma de muestras se agenda SOLO si la cita principal se creó de
        // verdad (antes salía disparada antes de comprobarlo, de modo que una cita fallida
        // dejaba igualmente al paciente citado en el laboratorio), CON await para que el
        // médico vea el resultado, y una sola vez aunque se pulse "Reintentar".
        if (isLabChecked && apt.doc_id && modal.dataset.labDone !== "1") {
          modal.dataset.labDone = "1";
          // v12.3.20 — Antes se recalculaba "5 días hábiles antes" desde cero aquí, IGNORANDO
          // el día que el médico haya elegido con los chips de fecha alterna: si el sugerido
          // no tenía turnos y el médico eligió otro, la orden se mandaba igual al día
          // original (sin cupo). Ahora se usa la fecha realmente seleccionada.
          const labFecha = selectedLabDateInfo || calcBusinessDaysBefore(fechaElegida.iso, 5);
          // v12.3.31 — se reutiliza el mismo celular ya capturado/editado por el médico
          // para el SMS de la cita principal (celularSms), para que el paciente también
          // reciba confirmación de la toma de muestras cuando ese número es conocido.
          const labOk = await apiLaboratorioAgendarAuto(apt.doc_id, labFecha.iso, selectedLabTime, celularSms);
          // v12.3.28 — Se marca SOLO si de verdad se agendó: así, si falla, el botón de
          // la tarjeta sigue ofreciendo "falta laboratorio" en vez de darlo por hecho.
          uxTrack(labOk ? "lab.agendado" : "lab.fallo");
          if (labOk) markLabAgendadaHoy(apt.doc_id);
        }

        setTimeout(() => closeMod(), 2600);
      } else {
        if (vivo()) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "✓ Reintentar Crear Cita";
        }
        uxTrack("cita.rechazada");
        const errMsg = (res && res.mensaje) || (d && d.motivo) || "Sin respuesta del sistema de agenda."; // [COPY-UX]
        alert("No se pudo confirmar la creación de la cita: " + errMsg + "\n\nLa cita NO se dio por creada. Se actualizaron los horarios disponibles — verifique y elija de nuevo.");
        // v12.4.0 — Tras un rechazo del servidor (cupo tomado, agenda cerrada…) los
        // horarios en pantalla ya son viejos: se refrescan solos para que el médico
        // elija sobre cupos REALES en vez de reintentar a ciegas el mismo turno.
        if (vivo()) { selectedTurnoObj = null; selectedTurnoCtx = null; try { cargarHoras(); } catch (e) {} }
      }
    });

    cargarHoras(selectedTimeframe.m, selectedTimeframe.d);
  }

  // v12.3.28 — Modal ligero para cuando la cita de CONTROL ya se agendó hoy pero la
  // toma de muestras quedó pendiente (turno agotado, fallo de red, etc. en el intento
  // original). Antes no había forma de reintentar SOLO esa parte: reabrir el flujo
  // completo (openAgendamientoModal) habría arriesgado crear una SEGUNDA cita de control
  // duplicada para el mismo paciente el mismo día. Reutiliza la fecha real que quedó
  // guardada al crear la cita de control (citaAgendadaFechaHoy) para calcular el mismo
  // rango de "5 días hábiles antes" ±3 días que ya usa el flujo completo — nunca vuelve
  // a preguntar nada de la cita principal, que ya existe y no se toca.
  async function openLabSoloModal(apt) {
    if (!apt || !apt.doc_id) { setSummary("El paciente seleccionado no tiene documento legible.", "warn"); return; }

    const citaFechaIso = citaAgendadaFechaHoy(apt.doc_id);
    if (!citaFechaIso) {
      // Caso de transición: la cita se marcó "agendada hoy" antes de que esta versión
      // empezara a guardar la fecha real. Sin esa fecha no hay sobre qué calcular "5
      // días hábiles antes" sin arriesgar una fecha inventada — se avisa en vez de adivinar.
      notify("AMBAR", "🧪 Falta la fecha guardada localmente (no es un error en Everest)",
        `Para ${apt.nombre || "este paciente"}, la cita de control quedó marcada como agendada hoy antes de que el panel empezara a guardar su fecha exacta (posible actualización del script a mitad del día). La cita en Everest está bien — solo agende la toma de muestras manualmente en AppCita.`,
        false, "labsolo-sinfecha|" + apt.doc_id);
      return;
    }

    let existing = document.getElementById("vgl-agendar-modal");
    if (existing) existing.remove();
    // v12.3.30 — misma limpieza defensiva que openAgendamientoModal (v8.2.1): por si queda
    // un modal de órdenes huérfano apilado, se retira también antes de pintar este.
    document.querySelectorAll("#vgl-ordenar-modal").forEach(e => e.remove());

    const patientName = apt.nombre || apt.name || "Paciente Everest";
    const modal = document.createElement("div");
    modal.id = "vgl-agendar-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "vgl-labsolo-title");
    modal.className = isLight() ? "light" : "";

    const suggestedLab = calcBusinessDaysBefore(citaFechaIso, 5);
    const citaFechaFmt = (() => {
      const p = citaFechaIso.split("-");
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : citaFechaIso;
    })();

    modal.innerHTML = `
      <div class="vgl-agm-card" style="max-width:520px">
        <div class="vgl-agm-head">
          <div style="min-width:0">
            <div class="vgl-agm-title vgl-agm-kicker" id="vgl-labsolo-title">🧪 Toma de Muestras Pendiente</div>
            <div class="vgl-agm-patient">${escapeHtml(patientName)}</div>
            <div class="vgl-agm-sub">Documento: <b>${escapeHtml(apt.doc_id)}</b> · Cita de control ya agendada para el <b>${escapeHtml(citaFechaFmt)}</b></div>
          </div>
          <button class="vgl-agm-close" id="vgl-agm-x" aria-label="Cerrar">✕</button>
        </div>

        <div class="vgl-agm-sec">
          <label class="vgl-agm-lbl">Elija el día de toma de muestras (sugerido: <b>${escapeHtml(suggestedLab.fmt)} — ${escapeHtml(suggestedLab.dayLbl)}</b>)</label>
          <div id="vgl-lab-day-chips" class="vgl-agm-presets" style="gap:5px;flex-wrap:wrap"></div>
          <div class="vgl-agm-fieldrow" style="margin-top:10px">
            <label for="vgl-agm-lab-time-sel">Hora del Laboratorio:</label>
            <select id="vgl-agm-lab-time-sel" class="vgl-agm-input" style="width:auto;flex:1;padding:7px 9px;font-size:12px">
              <option value="">⏳ Consultando disponibilidades en AppCita...</option>
            </select>
          </div>
        </div>

        <div class="vgl-agm-foot">
          <button id="vgl-agm-cancel" class="vgl-agm-btn sec">Cancelar</button>
          <button id="vgl-agm-confirm" class="vgl-agm-btn pri" disabled>Seleccione un horario</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const xBtn = modal.querySelector("#vgl-agm-x");
    const cancelBtn = modal.querySelector("#vgl-agm-cancel");
    const confirmBtn = modal.querySelector("#vgl-agm-confirm");
    const labChipsEl = modal.querySelector("#vgl-lab-day-chips");

    let cerrado = false;
    const vivo = () => !cerrado && modal.isConnected !== false;
    const closeMod = () => {
      cerrado = true;
      xBtn?.removeEventListener("click", closeMod);
      cancelBtn?.removeEventListener("click", closeMod);
      modal.innerHTML = "";
      modal.remove();
    };
    xBtn.addEventListener("click", closeMod);
    cancelBtn.addEventListener("click", closeMod);
    _activarAccesibilidadModal(modal, closeMod);

    let selectedLabDateInfo = null;
    let _tokenLabSolo = 0;
    // v12.3.29 — BLOQUEANTE hallado en revisión adversarial: sin este candado, un clic en
    // un chip de día MIENTRAS la reserva ya estaba en curso reactivaba el botón Confirmar
    // (la consulta de horas, de una sola llamada, resolvía antes que apiLaboratorioAgendarAuto,
    // que hace lectura+escritura), permitiendo un segundo apiLaboratorioAgendarAuto concurrente
    // y una posible cita de laboratorio duplicada de verdad en AppCita.
    let isSubmitting = false;

    // v12.3.33 — `exigirEleccion` (hallado en revisión adversarial): en el refresco
    // automático tras un fallo de reserva, preseleccionar el primer cupo del día (las
    // 6:00 a. m., normalmente) con el botón habilitado permitía que un reclic ciego en
    // "Agendar" reservara una hora que el médico NUNCA eligió — la misma clase de fallo
    // de "cupo por defecto" que v11.0.1 eliminó. Con exigirEleccion=true el desplegable
    // arranca en un marcador vacío y el botón queda bloqueado hasta que el médico ELIJA.
    async function cargarHorasLabSolo(exigirEleccion) {
      if (!selectedLabDateInfo || isSubmitting) return;
      const token = ++_tokenLabSolo;
      const labTimeSel = modal.querySelector("#vgl-agm-lab-time-sel");
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Seleccione un horario";
      if (labTimeSel) labTimeSel.innerHTML = `<option value="">⏳ Consultando disponibilidades en AppCita...</option>`;
      try {
        const urlTurnos = `https://appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/ObtenerTurnosPorFecha?sedeId=378&fechaBuscar=${selectedLabDateInfo.iso}`;
        const resAg = await gmPostJson(urlTurnos, {});
        if (!vivo() || token !== _tokenLabSolo || isSubmitting) return;
        const turnos = extractAgendasList(resAg);
        const turnosConHora = (turnos || []).filter((t) => t && (t.hora || t.horaTexto || t.Hora));
        if (labTimeSel) {
          if (turnosConHora.length > 0) {
            const placeholder = exigirEleccion ? `<option value="" selected>— elija un horario —</option>` : "";
            labTimeSel.innerHTML = placeholder + turnosConHora.map((t, idx) => {
              const hRaw = t.hora || t.horaTexto || t.Hora;
              const hFmt = format12hTime(hRaw);
              return `<option value="${escapeHtml(hRaw)}" ${(!exigirEleccion && idx === 0) ? "selected" : ""}>${escapeHtml(hFmt)}</option>`;
            }).join("");
            if (!exigirEleccion) {
              confirmBtn.disabled = false;
              confirmBtn.textContent = "✓ Agendar Toma de Muestras";
            }
          } else {
            labTimeSel.innerHTML = `<option value="">⛔ No hay turnos disponibles para el ${escapeHtml(selectedLabDateInfo.fmt)}</option>`;
          }
        }
      } catch (e) {
        if (!vivo()) return;
        if (labTimeSel) labTimeSel.innerHTML = `<option value="">⚠ No se pudo conectar con AppCita</option>`;
      }
    }

    // v12.3.33 — pareja de exigirEleccion: cuando el médico elige un horario en el
    // desplegable recién refrescado, el botón se habilita; si vuelve al marcador vacío,
    // se bloquea de nuevo.
    const _labTimeSelEl = modal.querySelector("#vgl-agm-lab-time-sel");
    if (_labTimeSelEl && _labTimeSelEl.addEventListener) _labTimeSelEl.addEventListener("change", () => {
      if (isSubmitting) return;
      if (_labTimeSelEl.value) { confirmBtn.disabled = false; confirmBtn.textContent = "✓ Agendar Toma de Muestras"; }
      else { confirmBtn.disabled = true; confirmBtn.textContent = "Seleccione un horario"; }
    });

    function renderLabDayChipsSolo() {
      const range = calcDateRangeAroundIso(suggestedLab.iso, 3);
      labChipsEl.innerHTML = "";
      range.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "vgl-agm-pbtn vgl-sm" + (item.isCenter ? " active" : "");
        btn.innerHTML = item.isCenter ? `<b>${escapeHtml(item.shortLbl)} 🎯</b>` : escapeHtml(item.shortLbl);
        btn.addEventListener("click", () => {
          if (isSubmitting) return;
          labChipsEl.querySelectorAll(".vgl-agm-pbtn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedLabDateInfo = item;
          cargarHorasLabSolo();
        });
        labChipsEl.appendChild(btn);
        if (item.isCenter) selectedLabDateInfo = item;
      });
      cargarHorasLabSolo();
    }
    renderLabDayChipsSolo();

    confirmBtn.addEventListener("click", async () => {
      const selectedLabTime = modal.querySelector("#vgl-agm-lab-time-sel")?.value;
      if (!selectedLabTime || !selectedLabDateInfo || isSubmitting) return;
      isSubmitting = true;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "⏳ Agendando...";
      const ok = await apiLaboratorioAgendarAuto(apt.doc_id, selectedLabDateInfo.iso, selectedLabTime);
      if (ok) {
        // v12.3.29 — mismo patrón que el modal principal (v12.3.14, línea ~6901): la cita
        // YA quedó creada en el servidor, así que el registro de éxito corre siempre; solo
        // pintar el modal se salta si el médico ya lo cerró durante el await.
        uxTrack("lab.agendado.solo");
        markLabAgendadaHoy(apt.doc_id);
        if (vivo()) {
          confirmBtn.classList.add("vgl-bg-success"); // [UI-CSS]
          confirmBtn.textContent = "✅ ¡Toma de Muestras Agendada!";
          const successMsg = document.createElement("div");
          successMsg.className = "vgl-msg-success"; // [UI-CSS]
          successMsg.innerHTML = `✅ <b>Toma de muestras agendada exitosamente</b><br>Fecha: <b>${escapeHtml(selectedLabDateInfo.fmt)}</b> · Hora: <b>${escapeHtml(format12hTime(selectedLabTime))}</b>`;
          modal.querySelector(".vgl-agm-card").appendChild(successMsg);
        }
        setTimeout(() => closeMod(), 2600);
      } else {
        isSubmitting = false;
        // v12.3.32 — tras un rechazo de AppCita (turno ocupado, formato, red), el panel NO
        // se queda mostrando la lista de horas vieja: se vuelve a consultar la
        // disponibilidad real en ese mismo momento, así el médico elige sobre datos
        // frescos en vez de reintentar a ciegas contra un cupo que ya no existe.
        // v12.3.33 — con exigirEleccion=true: el refresco NO preselecciona ningún cupo ni
        // habilita el botón; el médico debe elegir la hora nueva a conciencia.
        if (vivo()) cargarHorasLabSolo(true);
      }
    });
  }

  // =====================================================================
  //  v8.0.0: GENERADOR AUTOMÁTICO DE ÓRDENES PYM EN 1-CLIC (APIOrdenamientoHealth)
  // =====================================================================
  // [COPY-UX] Catálogo de actividades de prevención y mantenimiento
  // v14.0.0 (T6, D4) — `vigenciaDias`: cada cuántos días una orden vigente (§1.6,
  // pymCubiertoPorOrdenVigente) deja de "tapar" la necesidad de esta actividad. I10X (RCV
  // exprés) reutiliza RCV_VIGENCIA_DIAS — "no escribas una segunda tabla de vigencias" — en
  // vez de repetir 180 a mano. Las demás actividades (Resolución 3280 de 2018) TODAVÍA NO
  // tienen su periodicidad confirmada por el médico: quedan A PROPÓSITO sin `vigenciaDias`,
  // así que pymCubiertoPorOrdenVigente las trata SIEMPRE como pendientes (D4: ante la duda,
  // el banner se muestra) — anotado en cada una para que el médico las complete.
  const PYM_CATALOG = [
    {
      cie10: "I10X",
      titulo: "⚡ PAQUETE SUPER-ORDENAMIENTO RCV EXPRÉS (Perfil Lipídico + Renal + Glicemia)",
      keywords: ["rcv", "super", "expres", "paquete rcv"],
      vigenciaDias: RCV_VIGENCIA_DIAS,
      cups: [
        { codigo: "903815", desc: "Colesterol De Alta Densidad [HDL]" },
        { codigo: "903817", desc: "Colesterol De Baja Densidad [LDL]" },
        { codigo: "903818", desc: "Colesterol Total" },
        { codigo: "903868", desc: "Triglicéridos" },
        { codigo: "903895", desc: "Creatinina En Suero U Otros Fluidos" },
        { codigo: "903841", desc: "Glucosa En Suero (Glicemia)" },
        { codigo: "907106", desc: "Uroanálisis / Parcial de Orina" },
        // v14.0.0 — HALLAZGO A de AUDITORIA_MOTOR_RCV_v68.md, cerrado con los CUPS que
        // entregó el médico (14-ago, contra la tabla oficial). El script marcaba la RAC
        // como VENCIDA en rojo (está en RCV_VIGENCIA_KEYS) y su propio paquete NO PODÍA
        // PEDIRLA: la relación albúmina/creatinina se produce con estos DOS exámenes
        // juntos, y ninguno existía en el archivo — por eso el médico los añadía a mano
        // en cada paciente. Van SIEMPRE los dos: uno solo no produce la RAC.
        // OJO con el código: la microalbuminuria es 903026, NO 903028 como afirmaba la
        // auditoría — error de esa nota, corregido por el médico contra la tabla real.
        { codigo: "903876", desc: "Creatinina En Orina Parcial" },
        { codigo: "903026", desc: "Microalbuminuria Automatizada En Orina Parcial" },
        // v14.0.1 — EVIDENCIA_ORDENAMIENTO_CURADO.md §2 ("LA LISTA CURADA REAL"): tomada
        // directamente de un ordenamiento YA GUARDADO en Everest (ObtenerOrdenamientoPorPacienteIdVigente,
        // agrupador 12260710549, dx N189), no de un clic observado — es la fuente más
        // confiable posible (una orden real, no una intención). La HbA1c automatizada es
        // uno de los 9 CUPS de esa orden real y no estaba en este paquete.
        // NO se tocan 902210/902213 (hemograma/hemoglobina) ni 903817 (LDL): la evidencia
        // sobre esos tres es más débil (clics observados en la grabación, no confirmados
        // contra una orden guardada) y el propio documento los deja como "pendiente de
        // confirmar" — no se cambia una lista de CUPS clínicos sobre evidencia parcial.
        { codigo: "903426", desc: "Hemoglobina Glicosilada Automatizada" }
      ]
    },
    // v12.4.0 — Paquetes alineados con la TABLA OFICIAL de CUPS de la IPS (actividad
    // susceptible → CUPS → diagnóstico CIE-10). Los títulos son los mismos nombres que
    // muestran los chips del panel (FRIENDLY). Cambios de esta versión:
    //  · Z108 vuelve al 903816 (LDL SEMIAUTOMATIZADO) porque el tamizaje cardiometabólico
    //    es para pacientes SANOS y ese es su CUPS en la tabla oficial; el 903817 queda
    //    SOLO en el paquete RCV exprés de arriba (crónicos ERC/HTA/DM2) — aclarado por
    //    el médico del programa el 2026-08-11.
    //  · Se RETIRAN los paquetes de Hepatitis C (906225) y VDRL (906039): por decisión
    //    del programa se descartan todas las ETS excepto VIH.
    {
      cie10: "Z124",
      titulo: "Cáncer de cuello uterino (Citología / ADN VPH)",
      keywords: ["cuello uterino", "cervix", "citologia", "ccu", "vph", "tamizar con ccu"],
      // vigenciaDias: sin confirmar (Resolución 3280/2018) — pregunta abierta para el médico.
      cups: [
        { codigo: "908890", desc: "Deteccion Virus Del Papiloma Humano Por Pruebas Moleculares (Especifico)" },
        { codigo: "898001", desc: "Estudio de coloracion basica en citologia vaginal tumoral o funcional" },
        { codigo: "892901", desc: "Toma No Quirurgica De Muestra O Tejido Cervicovaginal Para Estudio Citologico" }
      ]
    },
    {
      cie10: "Z113",
      titulo: "VIH (Anticuerpos VIH 1 y 2)",
      keywords: ["vih", "inmunodeficiencia", "hiv"],
      // vigenciaDias: sin confirmar (Resolución 3280/2018) — pregunta abierta para el médico.
      cups: [
        { codigo: "906249", desc: "Virus De Inmunodeficiencia Humana 1 Y 2 Anticuerpos" }
      ]
    },
    {
      cie10: "Z108",
      titulo: "Tamización cardiometabólica (Perfil lipídico, Creatinina, Parcial de orina, Glicemia)",
      keywords: ["cardiometabolic", "colesterol", "creatinina", "uroanalisis", "glucosa", "trigliceridos"],
      // vigenciaDias: sin confirmar (Resolución 3280/2018, tamización de pacientes SANOS —
      // periodicidad distinta a la de RCV en crónicos) — pregunta abierta para el médico.
      cups: [
        { codigo: "903815", desc: "Colesterol De Alta Densidad" },
        { codigo: "903816", desc: "Colesterol De Baja Densidad Semiautomatizado" }, // tabla oficial: CMB de pacientes sanos (903817 es de crónicos, ver RCV exprés)
        { codigo: "903818", desc: "Colesterol Total" },
        { codigo: "903895", desc: "Creatinina En Suero U Otros Fluidos" },
        { codigo: "907106", desc: "Uroanalisis" },
        { codigo: "903841", desc: "Glucosa En Suero U Otro Fluido Diferente A Orina" },
        { codigo: "903868", desc: "Trigliceridos" }
      ]
    },
    {
      cie10: "Z123",
      titulo: "Mamografía (Mamografía Bilateral)",
      keywords: ["mamografia", "mama", "seno"],
      // vigenciaDias: sin confirmar (Resolución 3280/2018) — pregunta abierta para el médico.
      cups: [
        { codigo: "876802", desc: "Mamografia Bilateral" }
      ]
    },
    {
      cie10: "Z125",
      titulo: "PSA (antígeno de próstata)",
      keywords: ["psa", "prostata"],
      // vigenciaDias: sin confirmar (Resolución 3280/2018) — pregunta abierta para el médico.
      cups: [
        { codigo: "906610", desc: "Antigeno Especifico De Prostata Semiautomatizado O Automatizado" }
      ]
    },
    {
      cie10: "Z121",
      titulo: "SOMF (sangre oculta en materia fecal)",
      keywords: ["somf", "omf", "sangre oculta", "materia fecal", "colon"],
      // vigenciaDias: sin confirmar (Resolución 3280/2018) — pregunta abierta para el médico.
      cups: [
        { codigo: "907009", desc: "Sangre Oculta En Materia Fecal (Determinacion De Hemoglobina Humana Especifica)" }
      ]
    },
    {
      cie10: "Z103",
      titulo: "Hemoglobina y Hematocrito",
      keywords: ["hemoglobina", "hematocrito"],
      // vigenciaDias: sin confirmar (Resolución 3280/2018) — pregunta abierta para el médico.
      cups: [
        { codigo: "902213", desc: "Hemoglobina" },
        { codigo: "902211", desc: "Hematocrito" }
      ]
    }
  ];

  // v14.0.0 (T7) — Extraído de dentro de openOrdenamientoModal (donde vivía desde v12.3.x,
  // inline): la MISMA lógica de emparejamiento por palabra clave que decide qué paquetes de
  // PYM_CATALOG le corresponden a las etiquetas del Excel de PyM de un paciente. Ahora la
  // reutiliza también el banner (T7) — una sola verdad de "qué paquete es cuál etiqueta", no
  // dos copias que puedan desincronizarse.
  function pymPaquetesDelPaciente(etiquetas) {
    const stripToAlphanum = (s) => stripAccents(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    const lista = Array.isArray(etiquetas) ? etiquetas : [];
    const pymPorPaquete = new Map();
    const emparejadas = new Set();
    for (const pkg of PYM_CATALOG) {
      const coincidencias = lista.filter((etiqueta) => {
        const et = stripToAlphanum(etiqueta);
        return pkg.keywords.some((kw) => et.includes(stripToAlphanum(kw)));
      });
      if (coincidencias.length) {
        pymPorPaquete.set(pkg, coincidencias);
        coincidencias.forEach((e) => emparejadas.add(e));
      }
    }
    const matchedPackages = PYM_CATALOG.filter((pkg) => pymPorPaquete.has(pkg));
    // Etiquetas del Excel que NO casaron con ningún paquete del catálogo (p. ej. Optometría/
    // Odontología, que son remisiones, no exámenes con CUPS propio): T7 las trata como
    // SIEMPRE pendientes — no hay forma de cruzarlas contra una orden vigente sin CUPS.
    const sinEmparejar = lista.filter((e) => !emparejadas.has(e));
    return { pymPorPaquete, matchedPackages, sinEmparejar };
  }

  // Buscar Paciente en APIOrdenamientoHealth
  async function apiOrdenamientoBuscarPaciente(docId) {
    const cleanDoc = String(docId || "").replace(/\D/g, "");
    if (!cleanDoc) return null;
    const path = `/apiviva/APIOrdenamientoHealth/api/Paciente/BuscarPaciente?Identificacion=${encodeURIComponent(cleanDoc)}&TipoDocumento=CC&epsId=2`;
    try {
      const res = await pageFetchJson(path);
      if (res) {
        return res.id || res.Id || (res.data && (res.data.id || res.data.Id)) || null;
      }
    } catch (e) {}
    return null;
  }

  // Obtener DiagnosticoId por CIE-10 (ej: Z113 -> 24300)
  const DX_CACHE = {};
  async function apiOrdenamientoObtenerDx(cie10) {
    if (DX_CACHE[cie10]) return DX_CACHE[cie10];
    const path = `/apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoDiagnostico?filter=${encodeURIComponent(cie10)}`;
    try {
      const res = await pageFetchJson(path);
      const items = Array.isArray(res) ? res : (res && res.data && Array.isArray(res.data) ? res.data : []);
      const item = items.find((x) => String(x.codigo || x.Codigo || "").toUpperCase() === cie10.toUpperCase());
      // v11.0.1 — Sin `|| items[0]`: si el CIE-10 no aparece, antes se cogía el PRIMER
      // diagnóstico de la lista y la orden salía con un diagnóstico ajeno al paciente.
      if (item) {
        const dxId = item.id || item.Id || item.DiagnosticoId;
        if (dxId) { DX_CACHE[cie10] = dxId; return dxId; }
      }
    } catch (e) {}
    return null;
  }

  // Obtener CUPS info por PacienteId y Código CUPS
  const CUP_CACHE = {};
  async function apiOrdenamientoObtenerCup(pacienteId, cupCodigo) {
    const key = pacienteId + "_" + cupCodigo;
    if (CUP_CACHE[key]) return CUP_CACHE[key];
    const path = `/apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoCupsPorPaciente?pacienteId=${pacienteId}&filter=${encodeURIComponent(cupCodigo)}`;
    try {
      const res = await pageFetchJson(path);
      const items = Array.isArray(res) ? res : (res && res.data && Array.isArray(res.data) ? res.data : []);
      const item = items.find((x) => String(x.codigo || x.Codigo || "").trim() === cupCodigo.trim());
      // v11.0.1 — Sin `|| items[0]`: si el CUPS pedido no aparece, antes se sustituía por
      // el PRIMERO de la lista, es decir, se ordenaba un EXAMEN DISTINTO del solicitado.
      if (item) {
        const cObj = {
          Id: item.id || item.Id || item.cupId,
          Codigo: item.codigo || item.Codigo || cupCodigo,
          Descripcion: item.descripcion || item.Descripcion || "",
          Nivel: item.nivel || item.Nivel || 1
        };
        if (cObj.Id) { CUP_CACHE[key] = cObj; return cObj; }
      }
    } catch (e) {}
    return null;
  }

  // Guardar Ordenamiento por CIE-10 (POST GuardarOrdenamiento)
  // v12.3.0 — CONTRATO VERIFICADO contra el módulo NATIVO de Everest (captura del
  // consultorio, 10/08/2026, orden de VIH). El cuerpo que arma esta función coincide byte
  // por byte con el que envía Everest, y la cadena de búsquedas previa devuelve los mismos
  // identificadores: Z113 -> DiagnosticoId 24300, CUPS 906249 -> cup.Id 19984. La respuesta
  // real es {"agrupador":"1226083892","ordenAuth":[{"numeroAutorizacion":"1226083892319"}]},
  // que la comprobación de éxito de más abajo reconoce correctamente.
  //
  // NO CONFUNDIR con el ordenamiento desde la Ruta de Crónicos: ese es OTRO flujo, con un
  // cuerpo distinto (camelCase, el objeto completo del paciente, citaId real y swHC:true).
  // Alinear esta función con aquel rompería lo que hoy funciona.
  async function apiOrdenamientoGuardar(pacienteId, dxId, cupsList) {
    if (state.killed) {
      alert("Pausa de seguridad remota activa: el asistente está en pausa de seguridad para proteger la historia clínica. No se realizaron cambios.");
      return null;
    }
    const uId = state.activeDoctor.id || S.medicoId || 0;
    // v12.0.0 — Igual que en AsignarTurno: sin identificador de médico NO se crean
    // órdenes clínicas a nombre de otro profesional.
    if (!uId) { alert("No se pudo identificar al médico en Everest. NO se generaron las órdenes.\n\nIndique su identificador en Ajustes."); return null; }
    const path = `/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento`;
    const payload = {
      DiagnosticoId: dxId,
      RemisorId: 12,
      paciente: { Id: pacienteId },
      SwHc: false,
      perfil: "PROFESIONAL",
      CitaId: "0",
      UsuarioId: uId,
      ordenes: cupsList.map((c) => ({
        tipo: "ORD",
        nota: "",
        cup: {
          Id: c.Id,
          Codigo: "",
          Descripcion: c.Descripcion,
          Nivel: c.Nivel || 1,
          Cantidad: 1
        }
      }))
    };
    return pageFetchJson(path, { method: "POST", body: JSON.stringify(payload) });
  }

  // =====================================================================
  //  v12.3.x — ENVÍO DE LA ORDEN POR CORREO AL PACIENTE
  //
  //  Contrato REAL, no inventado: reconstruido a partir de telemetría de red genuina
  //  capturada en consultorio el 8 de agosto de 2026 (VIGILANTE_AGENDA_RESCATE/
  //  everest_telemetry_PRO_*.json — decenas de envíos reales, mismo patrón repetido),
  //  la MISMA vía que usa el botón oficial de Everest para esto:
  //   1. GET /apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos
  //         ?PacienteId=<id>&Agrupador=<agrupador>   (genera el link/PDF de la orden;
  //         se observó SIEMPRE antes del envío — best-effort: si falla, no bloquea)
  //   2. GET /apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento
  //         ?Grupo=<agrupador>&Correo=<correo>&UsuarioId=<idMedico>
  //  Mismo origen que Everest (neps.everestintelligent.com): fetch normal, no
  //  GM_xmlhttpRequest — eso es solo para el puente a Athenea (otro dominio).
  //  La telemetría de origen NUNCA grabó el cuerpo de la respuesta (herramienta de
  //  captura sin registro de body): la validación de éxito es por status HTTP, con un
  //  diagnóstico de una sola vez que confirmará su forma exacta en el primer uso real.
  // =====================================================================

  // Recursivo, mismo patrón que extractPatientId: la respuesta de GuardarOrdenamiento
  // ya expone `agrupador` directo o en `.data.agrupador` (ver el manejo de éxito más
  // abajo); este extractor cubre además cualquier variante de mayúsculas o anidación.
  function extractAgrupador(res) {
    if (!res) return null;
    if (typeof res === "number" && res > 0) return String(res);
    if (typeof res === "string" && res.trim()) return res.trim();
    if (Array.isArray(res) && res.length > 0) return extractAgrupador(res[0]);
    if (typeof res === "object") {
      const direct = res.agrupador || res.Agrupador || res.grupo || res.Grupo || res.idAgrupador || res.IdAgrupador;
      if (direct) return String(direct).trim();
      if (res.data) { const fromData = extractAgrupador(res.data); if (fromData) return fromData; }
      for (const k of Object.keys(res)) {
        if (k !== "data" && (Array.isArray(res[k]) || (res[k] && typeof res[k] === "object"))) {
          const fromSub = extractAgrupador(res[k]);
          if (fromSub) return fromSub;
        }
      }
    }
    return null;
  }

  // Best-effort: genera el link/PDF de impresión de la orden. Un fallo aquí NO debe
  // impedir el envío del correo (el paso se observó siempre antes, pero su función es
  // preparar el documento, no autorizar el envío).
  // v12.6.5 — La respuesta ya NO pasa por pageFetchJson. La grabación real del consultorio
  // muestra que este endpoint contesta la URL de impresión en el cuerpo, en texto plano
  // (no un objeto JSON): resp.json() lanzaba, pageFetchJson lo tomaba por error de red,
  // reintentaba y terminaba devolviendo null — por eso "no traía nada" en v12.6.2. Se lee
  // el cuerpo como texto y se intenta parsear como JSON solo por si Everest lo envuelve
  // (mismo patrón directo que apiEnviarOrdenPorCorreo).
  async function apiOrdenamientoGenerarLinks(pacienteId, agrupador) {
    try {
      const f = FETCH0 || window.fetch;
      const url = location.origin + "/apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos"
        + "?PacienteId=" + encodeURIComponent(pacienteId) + "&Agrupador=" + encodeURIComponent(agrupador);
      const resp = await f(url, { headers: { "Accept": "application/json" } });
      let cuerpo = "";
      try { cuerpo = await resp.text(); } catch (e) {}
      let res = null;
      try { res = JSON.parse(cuerpo); } catch (e) { res = cuerpo ? String(cuerpo).trim() : null; }
      if (!_diagGenerarLinksLogged) { _diagGenerarLinksLogged = true; console.log("[Vigilante PyM] GenerarLinksImpresionOrdenamientos — diagnóstico único:", res); }
      return res;
    } catch (e) { console.warn("[Vigilante PyM] GenerarLinksImpresionOrdenamientos falló (no bloquea el envío del correo):", e); return null; }
  }
  let _diagGenerarLinksLogged = false;

  // v12.6.5 — Extrae la URL de impresión de lo que devuelva GenerarLinksImpresionOrdenamientos.
  // En la captura real llega como texto plano ("https://..."), pero se aceptan también las
  // formas habituales de este backend (cadena JSON, objeto con url/enlace/link, arreglo)
  // porque el contrato solo está confirmado en UNA grabación. Solo se acepta una URL
  // absoluta http(s): si viene cualquier otra cosa, se devuelve null y el llamador usa su
  // propio respaldo — nunca se navega a un texto que no sea una URL de verdad.
  function _urlImpresionOrdenPyM(res) {
    const esUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s.trim());
    if (!res) return null;
    if (esUrl(res)) return res.trim();
    if (Array.isArray(res)) {
      for (const it of res) { const u = _urlImpresionOrdenPyM(it); if (u) return u; }
      return null;
    }
    if (typeof res === "object") {
      for (const k of ["url", "Url", "URL", "enlace", "Enlace", "link", "Link", "ruta", "Ruta"]) {
        if (esUrl(res[k])) return String(res[k]).trim();
      }
      for (const k of Object.keys(res)) {
        if (res[k] && typeof res[k] === "object") { const u = _urlImpresionOrdenPyM(res[k]); if (u) return u; }
      }
    }
    return null;
  }

  let _diagEnvioCorreoLogged = false;
  async function apiEnviarOrdenPorCorreo(agrupador, correo, usuarioId) {
    try {
      const f = FETCH0 || window.fetch;
      const url = location.origin + "/apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento"
        + "?Grupo=" + encodeURIComponent(agrupador) + "&Correo=" + encodeURIComponent(correo) + "&UsuarioId=" + encodeURIComponent(usuarioId);
      const resp = await f(url, { headers: { "Accept": "application/json" } });
      if (!_diagEnvioCorreoLogged) {
        _diagEnvioCorreoLogged = true;
        let cuerpo = "";
        try { cuerpo = await resp.clone().text(); } catch (e) {}
        console.log("[Vigilante] EnviarEmailOrdenamiento — diagnóstico único: status=" + resp.status + " cuerpo=" + cuerpo.slice(0, 300));
      }
      return !!(resp && resp.ok);
    } catch (e) { console.warn("[Vigilante PyM] no se pudo enviar la orden por correo:", e); return false; }
  }

  // v12.5.13 — IMPRIMIR ORDEN DE PYM (pedido explícito del médico: hasta ahora solo se
  // enviaba por correo, sin opción directa de imprimir).
  //
  // Contrato REAL, no inventado: capturado con el grabador de red del propio proyecto.
  //
  // v12.6.2 — Primera corrección: GenerarOrdenHC exige que el reporte YA esté generado en el
  // servidor. El flujo de "Enviar por correo" (ver el botón de correo en openOrdenamientoModal)
  // SÍ llamaba primero a GenerarLinksImpresionOrdenamientos (ver apiOrdenamientoGenerarLinks) —
  // el nombre del endpoint es literal: "generar los ENLACES de impresión" — antes de enviar; el
  // botón de Imprimir, agregado en v12.5.13, nunca hacía esa llamada. `pestanaExistente` (mismo
  // patrón que abrirInformeAthenea): la pestaña se abre EN BLANCO de forma síncrona en el clic
  // real del médico (para no chocar con el bloqueador de ventanas emergentes del navegador) y
  // se navega a la URL real recién que GenerarLinksImpresionOrdenamientos responde.
  //
  // v12.6.5 — Segunda corrección, y la que faltaba: la URL NO se arma aquí. La grabación del
  // clic en el botón "Imprimir" OFICIAL de Everest muestra que GenerarLinksImpresionOrdenamientos
  // devuelve la URL ya lista en el cuerpo de su respuesta:
  //   https://<host>/apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=<agrupador>&idPaciente=<id>
  // La que se reconstruía a mano (/apiviva/APIOrdenamientoHealth/ReportePdf/... con
  // &NumAutorizacion=) apuntaba a otro módulo, con otra grafía y un parámetro de más: ese era
  // el 404 de la captura del médico. Ahora `urlServidor` (lo que devolvió Everest, extraído por
  // _urlImpresionOrdenPyM) manda; la reconstrucción queda solo como último recurso si esa
  // llamada falla, y ya con la ruta correcta de la captura. NumAutorizacion se retiró: la URL
  // real de Everest no lo lleva.
  function imprimirOrdenPyM(pacienteId, agrupador, pestanaExistente, urlServidor) {
    if (!agrupador) { if (pestanaExistente && !pestanaExistente.closed) pestanaExistente.close(); return; }
    const url = urlServidor || (location.origin + "/apiviva/APIImpresion/reportepdf/GenerarOrdenHC"
      + "?Agrupador=" + encodeURIComponent(agrupador)
      + "&idPaciente=" + encodeURIComponent(pacienteId || ""));
    if (pestanaExistente && !pestanaExistente.closed) pestanaExistente.location.href = url;
    else window.open(url, "_blank");
  }

  // Modal interactivo de Generación de Órdenes PyM en 1-Clic
  async function openOrdenamientoModal(apt) {
    if (!apt || !apt.doc_id) { setSummary("El paciente seleccionado no tiene documento legible.", "warn"); return; }

    let existing = document.getElementById("vgl-ordenar-modal");
    if (existing) existing.remove();

    const patientName = apt.nombre || apt.name || "Paciente Everest";
    const doctorName = state.activeDoctor.name || S.medicoNombre || "";
    const modal = document.createElement("div");
    modal.id = "vgl-ordenar-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "vgl-ord-title");
    modal.className = isLight() ? "light" : "";

    let cerrado = false;
    const vivo = () => !cerrado && modal.isConnected !== false;
    let xBtn, cancelBtn;
    const closeMod = () => {
      cerrado = true;
      xBtn?.removeEventListener("click", closeMod);
      cancelBtn?.removeEventListener("click", closeMod);
      modal.innerHTML = "";
      modal.remove();
    };

    modal.innerHTML = `
      <div class="vgl-agm-card" style="max-width:680px">
        <div class="vgl-agm-head">
          <div style="min-width:0">
            <div class="vgl-agm-title vgl-agm-kicker" id="vgl-ord-title">📋 Órdenes de Prevención · PyM</div>
            <div class="vgl-agm-patient">${escapeHtml(patientName)}</div>
            <div class="vgl-agm-sub">Documento: <b>${escapeHtml(apt.doc_id)}</b> · Médico: <b>${escapeHtml(doctorName)}</b></div>
          </div>
          <button class="vgl-agm-close" id="vgl-ord-x" aria-label="Cerrar">✕</button>
        </div>
        <div class="vgl-agm-sec">
          <label class="vgl-agm-lbl">Verificando datos del paciente antes de sugerir actividades...</label>
          <div class="vgl-agm-loading">⏳ Cargando actividades de prevención sugeridas...</div>
        </div>
        <div class="vgl-agm-foot">
          <button id="vgl-ord-cancel" class="vgl-agm-btn sec">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    xBtn = modal.querySelector("#vgl-ord-x");
    cancelBtn = modal.querySelector("#vgl-ord-cancel");
    xBtn.addEventListener("click", closeMod);
    cancelBtn.addEventListener("click", closeMod);
    _activarAccesibilidadModal(modal, closeMod);

    // v12.0.1 — El sexo del paciente se CONSULTA antes de pintar las casillas. Sin esto,
    // `apt.sexo` nunca se rellenaba (los objetos de cita solo traen hora, documento,
    // nombre, modalidad y estado) y el aviso de "actividad propia del otro sexo" no se
    // disparaba jamás: la protección existía en el código pero era inerte. El campo `sexo`
    // viene en la ficha de BuscarPacienteDetallado. Si la consulta falla, se sigue adelante
    // sin el aviso — nunca se bloquea el ordenamiento por no haber podido comprobarlo.
    let sexoPacienteReal = "";
    let pid = null;
    try {
      pid = await apiAccesoBuscarPaciente(apt.doc_id);
      if (pid) {
        const det = await pageFetchJson(`/apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado?idPaciente=${pid}`);
        sexoPacienteReal = String((det && det.data && det.data.sexo) || "").trim().toUpperCase().charAt(0);
      }
    } catch (e) { console.warn("[Vigilante PyM] no se pudo consultar el sexo del paciente:", e); }
    if (!vivo()) return; // el médico ya cerró el modal mientras se verificaba el sexo

    // v14.0.0 — CRUCE ANTIDUPLICADO al ordenar (pedido explícito del médico): antes este
    // modal no cruzaba nada contra Everest, así que un paquete YA vigente (ordenado hace
    // poco, dentro de su propia vigencia clínica) podía volver a marcarse y duplicarse sin
    // ningún aviso. Reutiliza EXACTAMENTE la misma consulta y la misma regla de vigencia
    // que T6/T7 ya usan para el banner (apiHcObtenerOrdenamientosVigentes +
    // pymCubiertoPorOrdenVigente) — no se inventa una segunda tabla de vigencias (D4). Un
    // fallo de red aquí NO bloquea nada: simplemente ningún paquete se marca como vigente
    // (el mismo comportamiento de antes de este cambio), nunca se oculta la opción de
    // ordenar por una duda.
    let ordenesVigentesEnEverest = null;
    try {
      if (pid) ordenesVigentesEnEverest = await apiHcObtenerOrdenamientosVigentes(pid);
    } catch (e) { console.warn("[Vigilante PyM] no se pudo verificar órdenes vigentes:", e); }
    if (!vivo()) return;

    // v12.3.x — Antes solo se sabía SI había coincidencia con la base de PyM (booleano);
    // ahora se guarda también CUÁL actividad concreta del Excel del SharePoint la
    // disparó — "el nombre de la prueba que toca enviarle al paciente según los xlsx",
    // tal como se pidió. Esa etiqueta (activityLabel, viene de FRIENDLY/friendly() en la
    // lectura del Excel) YA EXISTÍA en apt.pym — se usaba para emparejar por dentro, pero
    // nunca se le mostraba al médico en el modal de Órdenes. Coincidencia por etiqueta
    // INDIVIDUAL (no por el texto de todas juntas): más preciso, y permite saber cuál
    // etiqueta específica corresponde a cuál paquete cuando el paciente tiene varias.
    // v14.0.0 (T7) — emparejamiento extraído a pymPaquetesDelPaciente(), reutilizado ahora
    // también por el banner.
    const { pymPorPaquete, matchedPackages } = pymPaquetesDelPaciente(apt.pym || []);

    // v11.0.1 — Cuando NO hay coincidencia con el PyM del paciente se siguen mostrando
    // todas las actividades, pero DESMARCADAS. Antes salían las 10 premarcadas y un solo
    // clic en "Generar" creaba las diez órdenes: incluidas mamografía y citología en un
    // hombre, o PSA en una mujer. Ahora premarcar exige coincidencia explícita.
    const hayCoincidencia = matchedPackages.length > 0;
    const pkgsToRender = hayCoincidencia ? matchedPackages : PYM_CATALOG;
    // Sexo esperado por actividad (solo para DESMARCAR y advertir, nunca para ocultar:
    // el médico manda). Z123 mama y Z124 cérvix -> F; Z125 próstata -> M.
    const SEXO_PKG = { Z123: "F", Z124: "F", Z125: "M" };
    const sexoPaciente = sexoPacienteReal || String((apt && apt.sexo) || "").trim().toUpperCase().charAt(0);

    // v14.0.0 — pymCubiertoPorOrdenVigente devuelve el subconjunto de PENDIENTES (aún sin
    // cubrir): lo que sobra al restarlo de pkgsToRender es lo que YA está vigente en
    // Everest. Un paquete sin vigenciaDias confirmado nunca cae aquí (ver comentario de la
    // propia función) — se sigue mostrando como cualquier otro, sin marcar.
    const pendientesEnEverest = pymCubiertoPorOrdenVigente(pkgsToRender, ordenesVigentesEnEverest, todayStamp());
    const yaVigentesEnEverest = new Set(pkgsToRender.filter((p) => pendientesEnEverest.indexOf(p) === -1));

    // v12.3.22 — Contenido real, reemplazando TODO el innerHTML de una sola vez (igual
    // que el código original) ahora que ya se conoce el sexo. Los botones de la ventana
    // de carga quedan destruidos junto con el resto del contenido anterior; por eso
    // xBtn/cancelBtn se vuelven a consultar y a enganchar abajo.
    if (!vivo()) return;
    modal.innerHTML = `
      <div class="vgl-agm-card" style="max-width:680px">
        <div class="vgl-agm-head">
          <div style="min-width:0">
            <div class="vgl-agm-title vgl-agm-kicker" id="vgl-ord-title">📋 Órdenes de Prevención · PyM</div>
            <div class="vgl-agm-patient">${escapeHtml(patientName)}</div>
            <div class="vgl-agm-sub">Documento: <b>${escapeHtml(apt.doc_id)}</b> · Médico: <b>${escapeHtml(doctorName)}</b></div>
          </div>
          <button class="vgl-agm-close" id="vgl-ord-x" aria-label="Cerrar">✕</button>
        </div>

        <div class="vgl-agm-sec">
          <label class="vgl-agm-lbl"><span class="vgl-agm-step">${pkgsToRender.length}</span>Seleccione las actividades de prevención a solicitar para el paciente:</label>
          ${hayCoincidencia ? "" : `<div class="vgl-agm-err" style="margin-bottom:10px">No se detectaron actividades pendientes en la base de prevención para este paciente. Las opciones salen <b>sin marcar</b>: seleccione manualmente lo que corresponda.</div>`}
          <div id="vgl-ord-list">
            ${pkgsToRender.map((pkg, idx) => {
              // v12.0.0 — El \`checked\` era INCONDICIONAL: sin coincidencia con la base
              // salían las 10 actividades premarcadas y un solo clic en "Generar" creaba
              // las diez órdenes, incluidas mamografía y citología en un hombre o PSA en
              // una mujer. Ahora premarcar exige coincidencia explícita Y que el sexo
              // registrado no contradiga la actividad.
              const sexoReq = SEXO_PKG[pkg.cie10] || "";
              const chocaSexo = !!(sexoReq && sexoPaciente && sexoReq !== sexoPaciente);
              const yaVigente = yaVigentesEnEverest.has(pkg);
              const marcar = hayCoincidencia && !chocaSexo && !yaVigente;
              const pymEtiquetas = pymPorPaquete.get(pkg) || [];
              return `
              <div class="vgl-ord-item">
                <label class="vgl-ord-label">
                  <input type="checkbox" class="vgl-ord-chk" data-idx="${idx}"${marcar ? " checked" : ""}>
                  <div class="vgl-ord-content">
                    <div class="vgl-ord-title">${escapeHtml(pkg.titulo)} <span class="vgl-ord-cie">CIE-10 ${escapeHtml(pkg.cie10)}</span></div>
                    ${pymEtiquetas.length ? `<div class="vgl-ord-pymsrc">📋 Según PyM (Excel SharePoint): <b>${pymEtiquetas.map(escapeHtml).join(", ")}</b></div>` : ""}
                    ${yaVigente ? `<div class="vgl-ord-vigwarn">✅ Ya existe una orden vigente en Everest para esto — no se premarca, pero puede volver a solicitarla si de verdad corresponde repetirla.</div>` : ""}
                    ${chocaSexo ? `<div class="vgl-ord-sexwarn">⚠ Actividad propia del sexo ${escapeHtml(sexoReq)}; el paciente registra sexo ${escapeHtml(sexoPaciente)}. Verifique antes de ordenar.</div>` : ""}
                    <div class="vgl-ord-cups">
                      <span class="vgl-ord-cupk">CUPS</span>${pkg.cups.map((c) => `<span class="vgl-ord-cup"><b>${escapeHtml(c.codigo)}</b> ${escapeHtml(c.desc)}</span>`).join("")}
                    </div>
                  </div>
                </label>
              </div>`;
            }).join("")}
          </div>
        </div>

        <div class="vgl-agm-foot">
          <button id="vgl-ord-cancel" class="vgl-agm-btn sec">Cancelar</button>
          <button id="vgl-ord-confirm" class="vgl-agm-btn pri">✓ Generar órdenes seleccionadas (${pkgsToRender.length})</button>
        </div>
      </div>
    `;

    xBtn = modal.querySelector("#vgl-ord-x");
    cancelBtn = modal.querySelector("#vgl-ord-cancel");
    const confirmBtn = modal.querySelector("#vgl-ord-confirm");
    const chks = modal.querySelectorAll(".vgl-ord-chk");
    xBtn.addEventListener("click", closeMod);
    cancelBtn.addEventListener("click", closeMod);

    const updateCount = () => {
      const count = Array.from(chks).filter((c) => c.checked).length;
      confirmBtn.disabled = count === 0;
      confirmBtn.textContent = count > 0 ? `✓ Sí, Generar Órdenes (${count})` : "Selecciona al menos una orden";
    };

    chks.forEach((c) => c.addEventListener("change", updateCount));
    updateCount();

    confirmBtn.addEventListener("click", async () => {
      const selectedBoxes = Array.from(chks).filter((c) => c.checked);
      if (!selectedBoxes.length) return;

      confirmBtn.disabled = true;
      confirmBtn.textContent = "⏳ Obteniendo datos del paciente en el sistema de órdenes..."; // [COPY-UX]

      const pacienteIdOrd = await apiOrdenamientoBuscarPaciente(apt.doc_id);
      if (!pacienteIdOrd) {
        alert("No se pudo localizar al paciente en el sistema de órdenes con la cédula " + apt.doc_id); // [COPY-UX]
        if (!vivo()) return;
        confirmBtn.disabled = false;
        confirmBtn.textContent = "✓ Reintentar Generar Órdenes";
        return;
      }

      let creadasCount = 0;
      let agrupadores = [];
      let fallidasCount = 0;
      const actividadesCubiertas = []; // v12.4.0 — etiquetas del Excel cubiertas por las órdenes creadas
      // v12.6.5 — RETIRADO el mapa numAutPorAgrupador (v12.5.13): existía solo para armar la
      // URL de impresión con &NumAutorizacion, y la URL real de Everest no lo lleva.

      for (const c of selectedBoxes) {
        const i = parseInt(c.getAttribute("data-idx"), 10);
        const pkg = pkgsToRender[i];
        if (vivo()) confirmBtn.textContent = `⏳ Generando ${pkg.cie10}... (${creadasCount + fallidasCount + 1}/${selectedBoxes.length})`;

        const dxId = await apiOrdenamientoObtenerDx(pkg.cie10);
        if (!dxId) { console.warn("[Vigilante PyM] No Dx para", pkg.cie10); fallidasCount++; continue; }

        const cupsObjs = [];
        const cupsFaltantes = [];
        for (const cInfo of pkg.cups) {
          const cObj = await apiOrdenamientoObtenerCup(pacienteIdOrd, cInfo.codigo);
          if (cObj) cupsObjs.push(cObj); else cupsFaltantes.push(cInfo.codigo);
        }

        if (!cupsObjs.length) { console.warn("[Vigilante PyM] No CUPS para", pkg.cie10); fallidasCount++; continue; }
        // v12.0.0 — Si algún examen del paquete no se pudo resolver, se avisa: antes la
        // orden se creaba incompleta en silencio y el médico creía haberlos pedido todos.
        if (cupsFaltantes.length) console.warn("[Vigilante PyM] " + pkg.cie10 + ": no se resolvieron los CUPS " + cupsFaltantes.join(", "));

        vglLog("ORDEN", "GuardarOrdenRequested", { pacienteIdOrd, dxId, countCups: cupsObjs.length });
        const resOrd = await apiOrdenamientoGuardar(pacienteIdOrd, dxId, cupsObjs);
        // v12.0.0 — Igual que arriba: solo campos planos, nunca el objeto completo.
        vglLog("ORDEN", "GuardarOrdenResponse", { error: !!(resOrd && resOrd.error), agrupador: String((resOrd && (resOrd.agrupador || (resOrd.data && resOrd.data.agrupador))) || "") });
        // v11.0.1 — Éxito estricto: antes bastaba cualquier respuesta sin `error:true`
        // (incluido un cuerpo vacío) para dar la orden por creada, mostrar el agrupador
        // falso "OK", marcarla como hecha del día y silenciar el recordatorio de PyM.
        const agpReal = resOrd && (resOrd.agrupador || (resOrd.data && resOrd.data.agrupador));
        if (resOrd && !resOrd.error && agpReal) {
          creadasCount++;
          const agp = agpReal;
          agrupadores.push(agp);
          actividadesCubiertas.push(...(pymPorPaquete.get(pkg) || []));
          if (vivo()) {
            c.checked = false; // Desmarcar exitoso
            c.disabled = true; // Deshabilitar
            const lbl = c.closest("label"); if(lbl && lbl.classList) lbl.classList.add("vgl-op-half", "vgl-line-through");
          }
        } else {
          fallidasCount++;
          if (vivo()) { const lbl2 = c.closest("label"); if (lbl2 && lbl2.classList) lbl2.classList.add("vgl-border-err"); } // Marcar fallido en ROJO // [UI-CSS]
        }
      }

      if (creadasCount > 0 && fallidasCount === 0) {
        // v12.3.14 — Las órdenes YA quedaron creadas en el servidor: el registro y el
        // estado de abajo corren siempre; solo el pintado se salta si el modal fue cerrado.
        const agrupadoresUnicos = [...new Set(agrupadores)];
        if (vivo()) {
          confirmBtn.classList.add("vgl-bg-success"); // [UI-CSS]
          confirmBtn.textContent = `✅ ¡${creadasCount} Orden(es) Creada(s)!`;

          const successMsg = document.createElement("div");
          successMsg.className = "vgl-agm-dinfo";
          successMsg.className = "vgl-msg-success"; // [UI-CSS]
          successMsg.innerHTML = `✅ <b>${creadasCount} Orden(es) PyM Generada(s) Exitosamente</b><br>Agrupadores: <b>${escapeHtml(agrupadores.join(", "))}</b>`;
          modal.querySelector(".vgl-agm-card").appendChild(successMsg);

          // v12.5.13 — Imprimir directamente la(s) orden(es) recién creada(s). Contrato real,
          // ver imprimirOrdenPyM. Un botón por agrupador ÚNICO de ESTA corrida — nunca una
          // orden vieja de otra sesión ni de otro paciente.
          const printBox = document.createElement("div");
          printBox.className = "vgl-ord-printbox";
          printBox.innerHTML = `<label class="vgl-agm-lbl" style="margin-top:14px">🖨️ Imprimir la(s) orden(es)</label>`;
          const printRow = document.createElement("div");
          printRow.className = "vgl-agm-fieldrow";
          agrupadoresUnicos.forEach((agp) => {
            const printBtn = document.createElement("button");
            printBtn.className = "vgl-agm-btn sec";
            printBtn.textContent = "🖨️ Orden " + agp;
            printBtn.addEventListener("click", async () => {
              uxTrack("ordenes.imprimir");
              // v12.6.2 — pestaña en blanco SÍNCRONA en el clic real (evita el bloqueador de
              // ventanas emergentes: un window.open() tras un await ya no cuenta como gesto
              // directo del usuario para el navegador) — se navega recién cuando
              // GenerarLinksImpresionOrdenamientos confirma que el reporte existe en el
              // servidor (ver imprimirOrdenPyM).
              const pestana = window.open("", "_blank");
              printBtn.disabled = true;
              const textoOriginal = printBtn.textContent;
              printBtn.textContent = "⏳ Preparando...";
              // v12.6.5 — Esa misma respuesta TRAE la URL de impresión (ver
              // apiOrdenamientoGenerarLinks): se usa la del servidor, no una armada aquí.
              let urlServidor = null;
              try { urlServidor = _urlImpresionOrdenPyM(await apiOrdenamientoGenerarLinks(pacienteIdOrd, agp)); } catch (e) {}
              imprimirOrdenPyM(pacienteIdOrd, agp, pestana, urlServidor);
              if (vivo()) { printBtn.disabled = false; printBtn.textContent = textoOriginal; }
            });
            printRow.appendChild(printBtn);
          });
          printBox.appendChild(printRow);
          modal.querySelector(".vgl-agm-card").appendChild(printBox);

          // v12.3.x — Envío de la orden al correo del paciente. Contrato real, ver
          // apiEnviarOrdenPorCorreo. El correo se pide DESPUÉS de generar las órdenes,
          // como se pidió: nunca antes, para no bloquear la creación si en ese momento
          // no se tiene el correo del paciente a mano.
          const mailBox = document.createElement("div");
          mailBox.className = "vgl-ord-mailbox";
          mailBox.innerHTML = `
            <label class="vgl-agm-lbl" for="vgl-ord-mail-input" style="margin-top:14px;cursor:pointer">📧 Enviar la(s) orden(es) al correo del paciente (opcional)</label>
            <div class="vgl-agm-fieldrow">
              <input type="email" id="vgl-ord-mail-input" class="vgl-agm-input" placeholder="correo@ejemplo.com" style="flex:1;min-width:180px">
              <button class="vgl-agm-btn pri" id="vgl-ord-mail-send">Enviar</button>
            </div>
            <div id="vgl-ord-mail-status" class="vgl-agm-sub"></div>
          `;
          modal.querySelector(".vgl-agm-card").appendChild(mailBox);
          const mailInput = mailBox.querySelector("#vgl-ord-mail-input");
          const mailBtn = mailBox.querySelector("#vgl-ord-mail-send");
          const mailStatus = mailBox.querySelector("#vgl-ord-mail-status");
          mailBtn.addEventListener("click", async () => {
            const correo = (mailInput.value || "").trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { mailStatus.textContent = "⚠ Escriba un correo válido."; return; }
            mailBtn.disabled = true; mailBtn.textContent = "⏳ Enviando...";
            // v12.6.6 — CORREGIDO: `UsuarioId` aquí es el id del PACIENTE, no el del médico.
            // Confirmado en la grabación real del consultorio (12-08-2026): en la MISMA
            // corrida, GenerarLinksImpresionOrdenamientos va con PacienteId=801848 y acto
            // seguido Everest manda EnviarEmailOrdenamiento?...&UsuarioId=801848 — mismo
            // número — mientras el médico de esa sesión es el 309 (GuardarHCMorbilidad
            // ?UsuarioId=309, profesionalId=309). El mismo patrón se ve en el envío de
            // fórmulas (EnviarEmailMedicamento?...&UsuarioId=801848). Se replica lo que
            // hace Everest: el médico no tiene forma de verificar si los correos llegaron.
            const uIdEnvio = pacienteIdOrd;
            let okCount = 0;
            for (const agp of agrupadoresUnicos) {
              await apiOrdenamientoGenerarLinks(pacienteIdOrd, agp);
              const ok = await apiEnviarOrdenPorCorreo(agp, correo, uIdEnvio);
              if (ok) okCount++;
            }
            vglLog("ORDEN", "EnviarPorCorreoIntentado", { agrupadores: agrupadoresUnicos.length, ok: okCount });
            uxTrack("ordenes.correo", { n: okCount });
            if (!vivo()) return;
            mailBtn.disabled = false; mailBtn.textContent = "Enviar";
            mailStatus.textContent = okCount === agrupadoresUnicos.length
              ? `✅ Orden(es) enviada(s) a ${correo}.`
              : (okCount > 0 ? `⚠ Se enviaron ${okCount} de ${agrupadoresUnicos.length} orden(es). Verifique en el portal de Everest.` : "❌ No se pudo enviar la orden por correo. Verifique el correo o inténtelo desde el portal.");
          });
        }

        // v12.3.x — "ID y bloqueo de seguridad": se guardan los agrupadores reales junto
        // con la marca "ya ordenado hoy" — de aquí lee el botón 📋 de la tarjeta (se
        // deshabilita) y checkRecordatorioPym (se calla la alerta grande de PyM).
        markOrdenesCreadasHoy(apt.doc_id, agrupadoresUnicos, [...new Set(actividadesCubiertas)]);
        uxTrack("ordenes.creadas", { n: creadasCount });
        notify("VERDE", "✅ Órdenes PyM Generadas", `Paciente: ${patientName}\n${creadasCount} orden(es) creadas en el sistema de órdenes.`, true); // [COPY-UX]
        bumpStat("atiempo");
        // v12.3.x — Ya NO se cierra sola a los 2.6 s: el médico necesita tiempo para
        // escribir el correo del paciente y confirmar el envío. Se cierra con ✕/Cancelar.
      } else {
        if (vivo()) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "✓ Reintentar Generar Órdenes";
        }
        uxTrack("ordenes.fallo");
        alert("No se pudieron generar las órdenes en el sistema de órdenes."); // [COPY-UX]
      }
    });
  }

  // =====================================================================
  //  T7 — BANNER PyM SUPERIOR (nivel 2 · persistente, D5)
  // =====================================================================
  // v14.0.0 (T7) — Reemplaza el aviso MODAL de checkRecordatorioPym/pymAlert (interruptivo,
  // nivel 3 por accidente: bloqueaba hasta que el médico lo reconocía, para algo que D5
  // clasifica como nivel 2 · persistente). El banner ocupa su franja arriba, empuja el
  // contenido de Everest (no lo tapa) y NO se puede cerrar mientras algo siga pendiente —
  // solo minimizar a una barra fina con el contador. El abandono del Programa RCV NO pasa
  // por aquí: sigue siendo abandonoPESAlert/checkAbandonoPES, nivel 3, sin degradar (D5).
  //
  // D4 ("ante la duda, se muestra"): si apiHcObtenerOrdenamientosVigentes no pudo verificar
  // (fallo de red, respuesta malformada), el banner se muestra con TODAS las actividades
  // emparejadas como pendientes y un texto honesto de que no se pudo comprobar — nunca se
  // apaga por una duda.
  //
  // D7 (una consulta por paciente, cacheada): igual que _labsPrefetch, el refresco corre
  // en segundo plano y el render siempre lee de la caché — nunca bloquea el tick esperando
  // la red.
  let _bannerPymCache = { docId: "", pendientes: null, sinEmparejar: null, verificado: false, ts: 0 };
  let _bannerPymEnVuelo = null;
  const BANNER_PYM_TTL_MS = 10 * 60000;
  function _bannerPymInvalidar() { _bannerPymCache = { docId: "", pendientes: null, sinEmparejar: null, verificado: false, ts: 0 }; }

  // v14.0.0 — Lo que el médico YA ordenó HOY DESDE EL SCRIPT no puede seguir apareciendo
  // en el banner. El banner solo cruzaba contra las órdenes vigentes de Everest (T6), y ese
  // endpoint tarda en reflejar una orden recién creada: el médico ordenaba, el banner se
  // refrescaba y le volvía a pedir exactamente lo mismo. markOrdenesCreadasHoy ya guarda
  // las actividades cubiertas (det.actividades) — es la MISMA fuente que usa
  // pymPendientesRestantes para el aviso modal desde v12.4.0, así que el banner y el aviso
  // clásico coinciden en qué consideran ya resuelto en vez de contradecirse.
  function _pymYaOrdenadoHoyDesdeElScript(docId) {
    const det = ordenesDetalleHoy(docId);
    // Ojo con la distinción de v12.4.1: `undefined` = marca vieja sin detalle (no se puede
    // descontar nada); `[]` = se ordenó y no cubrió ninguna actividad del Excel. Solo se
    // descuenta cuando hay una lista real.
    return (det && Array.isArray(det.actividades)) ? det.actividades : [];
  }

  async function _refrescarBannerPym(docId) {
    const yaOrdenadas = _pymYaOrdenadoHoyDesdeElScript(docId);
    const etiquetas = getActivities(docId).filter((e) => yaOrdenadas.indexOf(e) === -1);
    if (!etiquetas.length) {
      _bannerPymCache = { docId, pendientes: [], sinEmparejar: [], verificado: true, ts: Date.now() };
      return;
    }
    const { matchedPackages, sinEmparejar } = pymPaquetesDelPaciente(etiquetas);
    if (!matchedPackages.length) {
      // Nada que cruzar contra T6 (ningún paquete conocido), pero las etiquetas sin
      // emparejar (p. ej. Optometría/Odontología) siguen contando como pendientes.
      _bannerPymCache = { docId, pendientes: [], sinEmparejar, verificado: true, ts: Date.now() };
      return;
    }
    let ordenes = null;
    try {
      const pacienteId = await apiAccesoBuscarPaciente(docId);
      if (pacienteId) ordenes = await apiHcObtenerOrdenamientosVigentes(pacienteId);
    } catch (e) { console.warn("[Vigilante] banner PyM: no se pudo verificar contra Everest:", e); }
    const verificado = Array.isArray(ordenes); // null = fallo/malformado; [] o [...] = éxito real
    const pendientes = pymCubiertoPorOrdenVigente(matchedPackages, ordenes, todayStamp());
    _bannerPymCache = { docId, pendientes, sinEmparejar, verificado, ts: Date.now() };
  }

  function createPymBannerUI() {
    if (!_enModuloHCHealth()) { const fuera = document.getElementById("vgl-pym-banner"); if (fuera) fuera.remove(); return; }
    const docId = extractPacienteAbierto();
    if (!docId) { const sinPac = document.getElementById("vgl-pym-banner"); if (sinPac) sinPac.remove(); return; }

    const cacheDelPaciente = _bannerPymCache.docId === docId;
    const cacheVigente = cacheDelPaciente && (Date.now() - _bannerPymCache.ts) < BANNER_PYM_TTL_MS;
    if (!cacheVigente) {
      if (!cacheDelPaciente) {
        // Paciente distinto al de la caché: sin datos frescos todavía NO se muestra el
        // banner del paciente ANTERIOR — D8: mejor ausente un instante que equivocado.
        const viejo = document.getElementById("vgl-pym-banner"); if (viejo) viejo.remove();
      }
      if (!_bannerPymEnVuelo) {
        _bannerPymEnVuelo = _refrescarBannerPym(docId).catch(() => {}).finally(() => { _bannerPymEnVuelo = null; });
      }
      if (!cacheDelPaciente) return; // se pinta en el próximo tick, cuando el refresco resuelva
    }

    const { pendientes, sinEmparejar, verificado } = _bannerPymCache;
    const totalPendientes = (pendientes || []).length + (sinEmparejar || []).length;
    let banner = document.getElementById("vgl-pym-banner");
    if (!totalPendientes) { if (banner) banner.remove(); return; }

    const esNuevo = !banner;
    if (esNuevo) {
      banner = document.createElement("div");
      banner.id = "vgl-pym-banner";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Alertas de Prevención y Mantenimiento");
      document.body.insertBefore(banner, document.body.firstChild);
    }
    const minimizado = esNuevo
      ? (typeof GM_getValue !== "undefined" ? GM_getValue("vgl_banner_pym_minimizado", "") === "1" : false)
      : banner.classList.contains("minimizado");
    banner.className = "vgl-pym-banner" + (isLight() ? " light" : "") + (minimizado ? " minimizado" : "");
    banner.setAttribute("aria-expanded", String(!minimizado));

    while (banner.children.length) banner.removeChild(banner.children[0]);

    const barra = document.createElement("div");
    barra.className = "vgl-pymb-barra";
    const titulo = document.createElement("span");
    titulo.className = "vgl-pymb-titulo";
    titulo.textContent = "📋 Prevención (PyM) pendiente";
    const contador = document.createElement("span");
    contador.className = "vgl-pymb-contador";
    contador.textContent = String(totalPendientes);
    const toggle = document.createElement("button");
    toggle.className = "vgl-pymb-toggle";
    toggle.setAttribute("aria-label", minimizado ? "Expandir" : "Minimizar");
    toggle.title = minimizado ? "Expandir" : "Minimizar";
    toggle.textContent = minimizado ? "▼" : "▲";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const nuevoMinimizado = !banner.classList.contains("minimizado");
      banner.classList.toggle("minimizado", nuevoMinimizado);
      banner.setAttribute("aria-expanded", String(!nuevoMinimizado));
      toggle.textContent = nuevoMinimizado ? "▼" : "▲";
      toggle.title = nuevoMinimizado ? "Expandir" : "Minimizar";
      toggle.setAttribute("aria-label", nuevoMinimizado ? "Expandir" : "Minimizar");
      try { if (typeof GM_setValue !== "undefined") GM_setValue("vgl_banner_pym_minimizado", nuevoMinimizado ? "1" : ""); } catch (e2) {}
      uxTrack(nuevoMinimizado ? "banner.pym.minimizar" : "banner.pym.expandir");
    });
    barra.appendChild(titulo);
    barra.appendChild(contador);
    barra.appendChild(toggle);
    banner.appendChild(barra);

    if (!verificado) {
      const aviso = document.createElement("div");
      aviso.className = "vgl-pymb-aviso";
      aviso.textContent = "⚠ No se pudo verificar contra Everest si alguna ya se ordenó — se muestran todas por seguridad.";
      banner.appendChild(aviso);
    }

    const citaReal = (state.lastSnapshot && state.lastSnapshot.list)
      ? state.lastSnapshot.list.find((a) => a.doc_id && normalizeKey(a.doc_id) === normalizeKey(docId))
      : null;
    const apt = citaReal || { doc_id: docId };

    const lista = document.createElement("div");
    lista.className = "vgl-pymb-lista";
    for (const pkg of (pendientes || [])) {
      const item = document.createElement("div");
      item.className = "vgl-pymb-item";
      const nombre = document.createElement("span");
      nombre.className = "vgl-pymb-item-nombre";
      nombre.textContent = pkg.titulo;
      const btnOrd = document.createElement("button");
      btnOrd.className = "vgl-pymb-item-btn";
      btnOrd.textContent = "Ordenar";
      btnOrd.addEventListener("click", (e) => { e.stopPropagation(); uxTrack("banner.pym.ordenar.abrir"); openOrdenamientoModal(apt); });
      item.appendChild(nombre);
      item.appendChild(btnOrd);
      lista.appendChild(item);
    }
    for (const etiqueta of (sinEmparejar || [])) {
      const item = document.createElement("div");
      item.className = "vgl-pymb-item vgl-pymb-item-libre";
      const nombre = document.createElement("span");
      nombre.className = "vgl-pymb-item-nombre";
      nombre.textContent = etiqueta;
      item.appendChild(nombre);
      lista.appendChild(item);
    }
    banner.appendChild(lista);
  }

  // =====================================================================
  // [BLINDADO v8.2.0 DOM-02] SYNAPSE: SHADOW PREFETCH con Debounce real de 300ms
  // GHOST.hoverTimers es un Map (L379): se usan .has/.get/.set/.delete en lugar de []
  // =====================================================================
  document.addEventListener("mouseover", (e) => {
    if (!e.target) return;
    const card = e.target.closest(".vgl-card");
    if (!card) return;
    const docSpan = card.querySelector(".vgl-doc");
    if (!docSpan) return;
    const docId = (docSpan.textContent || "").replace(/\D/g, "");
    if (!docId) return;

    const promKey = "prefetch_" + docId;
    if (GHOST.promises.has(promKey)) return; // Prefetch activo: no duplicar

    const timerKey = "hover_" + docId;
    if (GHOST.hoverTimers.has(timerKey)) return; // Timer de debounce ya activo

    // [FIX: DOM-02] El cursor debe detenerse ≥300ms sobre la tarjeta antes de lanzar la petición
    // Esto evita el auto-DDoS cuando el cursor pasa sobre 100 tarjetas a velocidad
    const timerId = setTimeout(() => {
      GHOST.hoverTimers.delete(timerKey);
      if (GHOST.promises.has(promKey)) return; // Re-verificar en el momento de lanzar
      const p = (async () => {
        try {
          const pacienteId = await apiAccesoBuscarPaciente(docId);
          if (pacienteId) {
            const dt = new Date();
            dt.setDate(dt.getDate() + 1);
            const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
            await apiAccesoBuscarCitasDisponibles(pacienteId, iso);
          }
        } catch (err) {}
      })();







      GHOST.promises.set(promKey, p);
      setTimeout(() => { if (GHOST.promises.get(promKey) === p) GHOST.promises.delete(promKey); }, 300000); // 5 min TTL
    }, 300);
    GHOST.hoverTimers.set(timerKey, timerId); // [FIX: DOM-02] .set() de Map, no []
  });

  // [BLINDADO v8.2.0 DOM-02] mouseout: cancelar el timer si el cursor sale antes de 300ms
  document.addEventListener("mouseout", (e) => {
    if (!e.target) return;
    const card = e.target.closest(".vgl-card");
    if (!card) return;
    const docSpan = card.querySelector(".vgl-doc");
    if (!docSpan) return;
    const docId = (docSpan.textContent || "").replace(/\D/g, "");
    if (!docId) return;
    const timerKey = "hover_" + docId;
    if (GHOST.hoverTimers.has(timerKey)) {         // [FIX: DOM-02] .has() de Map, no []
      clearTimeout(GHOST.hoverTimers.get(timerKey)); // [FIX: DOM-02] .get() de Map, no []
      GHOST.hoverTimers.delete(timerKey);             // [FIX: DOM-02] .delete() de Map, no delete []
    }
  });


  // ---- Posición y estado de la ventana: se recuerdan entre sesiones ----
  function savePos() { try { const r = el.root.getBoundingClientRect(); writeJSON("vgl_pos", { left: Math.round(r.left), top: Math.round(r.top), win: winState }); } catch (e) {} }
  function restorePos() {
    const p = readJSON("vgl_pos", null); if (!p) return;
    try {
      if (typeof p.left === "number" && typeof p.top === "number") {
        const L = Math.min(Math.max(0, p.left), Math.max(0, innerWidth - 120)), T = Math.min(Math.max(0, p.top), Math.max(0, innerHeight - 60));
        el.root.style.left = L + "px"; el.root.style.top = T + "px"; el.root.style.right = "auto"; el.root.style.bottom = "auto";
      }
      if (p.win && p.win !== "full") setWinState(p.win);
    } catch (e) {}
  }

  // ---- Hoja deslizante: Resumen del turno / Ajustes ----
  function closeSheet() { state.sheet = null; el.root.classList.remove("sheet"); el.sheet.innerHTML = ""; }
  function toggleSheet(kind) { if (state.sheet === kind) { closeSheet(); return; } state.sheet = kind; el.root.classList.add("sheet"); if (kind === "resumen") renderResumen(); else renderSettings(); }
  function sheetHeader(title, extraHtml) {
    return `<div class="vgl-sh-h"><span class="vgl-sh-t">${escapeHtml(title)}</span><span>${extraHtml || ""}<button class="vgl-btn" data-x="1" style="margin-left:6px">Cerrar</button></span></div>`;
  }
  function wireClose() { const b = el.sheet.querySelector('[data-x="1"]'); if (b) b.addEventListener("click", closeSheet); }

  // Resumen del turno: KPIs de hoy + barras de los últimos 7 días + exportar auditoría.
  function renderResumen() {
    const hoy = statsToday(), dias = lastDays(7), evs = eventsOf();
    const max = Math.max(1, ...dias.map((d) => (d.fraude || 0) + (d.inasistencia || 0) + (d.atiempo || 0)));
    const dow = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];
    const bars = dias.map((d) => {
      const t = new Date(d.fecha + "T00:00:00");
      const seg = (n, c) => (n ? `<div class="vgl-seg" style="height:${Math.max(2, Math.round((n / max) * 52))}px;background:${c};box-shadow:0 0 9px ${c}55" title="${n}"></div>` : "");
      return `<div class="vgl-bar"><div class="vgl-col">${seg(d.atiempo, COLORS.VERDE)}${seg(d.inasistencia, COLORS.AMBAR)}${seg(d.fraude, COLORS.ROJO)}</div><span class="vgl-lb">${dow[t.getDay()]} ${t.getDate()}</span></div>`;
    }).join("");
    // [v12.3.13] El CSS de esta hoja vive al final de la hoja maestra de buildOverlay(): se
    // inyecta UNA vez en vez de re-parsearse en cada apertura. Aquí solo queda HTML puro.
    el.sheet.innerHTML = sheetHeader("Resumen del turno") + `
      <div class="vgl-kpis">
        <div class="vgl-kpi vgl-kpi-rojo"><div class="vgl-n">${hoy.fraude || 0}</div><div class="vgl-l">EXTEMPORÁNEAS</div></div> <!-- [COPY-UX] -->
        <div class="vgl-kpi vgl-kpi-ambar"><div class="vgl-n">${hoy.inasistencia || 0}</div><div class="vgl-l">INASISTENCIAS</div></div>
        <div class="vgl-kpi vgl-kpi-verde"><div class="vgl-n">${hoy.atiempo || 0}</div><div class="vgl-l">A TIEMPO</div></div>
      </div>
      <div class="vgl-grp vgl-tile-chart">
        <div class="vgl-chart-cap"><span>ÚLTIMOS 7 DÍAS</span><span class="vgl-leg"><span class="vgl-leg-i"><i class="vgl-lg-verde"></i>A tiempo</span><span class="vgl-leg-i"><i class="vgl-lg-ambar"></i>Inasistencia</span><span class="vgl-leg-i"><i class="vgl-lg-rojo"></i>Extemporánea</span></span></div> <!-- [UI-CSS] -->
        <div class="vgl-bars">${bars}</div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Eventos registrados hoy<span class="vgl-hint">Cambios de estado y alertas, con hora exacta.</span></label><b class="vgl-count">${evs.length}</b></div>
        <div class="vgl-fld"><label>Reporte de auditoría<span class="vgl-hint">Archivo .csv que se abre en Excel. No sale del computador.</span></label><button class="vgl-btn primary" id="vgl-exp">Descargar</button></div>
        <div class="vgl-fld"><label>Copiar resumen<span class="vgl-hint">Para pegarlo en un correo o en el acta del turno.</span></label><button class="vgl-btn" id="vgl-copy">Copiar</button></div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Archivo PyM en uso<span class="vgl-hint">${escapeHtml(state.pymFile || "ninguno")}</span></label><b class="vgl-count">${state.pym.size}</b></div>
        <div class="vgl-fld"><label>Diagnóstico técnico<span class="vgl-hint">Sin datos de pacientes. Úsalo si algo deja de funcionar.</span></label><button class="vgl-btn" id="vgl-diag">Diag</button></div>
      </div>`;
    wireClose();
    el.sheet.querySelector("#vgl-exp").addEventListener("click", () => exportAudit());
    el.sheet.querySelector("#vgl-diag").addEventListener("click", downloadDiagnostic);
    el.sheet.querySelector("#vgl-copy").addEventListener("click", copySummary);
  }
  function copySummary() {
    const h = statsToday(), lst = (state.lastSnapshot && state.lastSnapshot.list) || [];
    const cnt = (f) => lst.filter((a) => f((a.estado || "").toLowerCase())).length;
    // [COPY-UX] Resumen clínico de la jornada
    const txt = ["Asistente Clínico de Agenda — " + todayStamp(),
      "Citas en agenda: " + lst.length,
      "En sala ahora: " + cnt((s) => s.includes("en sala")) + " · Atendidas: " + cnt((s) => s.includes("atendido")) + " · Sin presentarse: " + cnt((s) => s.includes("sin presentarse")),
      "Confirmaciones extemporáneas: " + (h.fraude || 0),
      "Inasistencias registradas: " + (h.inasistencia || 0),
      "Ingresos a tiempo: " + (h.atiempo || 0),
      "Prevención PyM: " + (state.pymFile || "sin cargar")].join("\n");
    try { navigator.clipboard.writeText(txt).then(() => setSummary("Resumen copiado al portapapeles."), () => setSummary("No fue posible copiar al portapapeles. Verifique permisos.", "warn")); }
    catch (e) { setSummary("No fue posible copiar al portapapeles. Verifique permisos.", "warn"); }
  }

  // [COPY-UX] Ajustes del asistente clínico
  function renderSettings() {
    // v12.0.0 — La sección técnica se abría con una marca (__vgl_dev_mode) que solo escribía
    // el "modo desarrollador" de los siete clics y un PIN. Al retirarse ese activador (no
    // hacía nada y provocaba recargas a mitad de consulta), la sección quedó INALCANZABLE:
    // con ella se perdían controles que el médico sí usa, como «Actualizar lista de
    // prevención» o «Sincronizar almacenamiento». Ahora se abre con un interruptor normal,
    // y los dos controles operativos se sacaron a la parte siempre visible.
    const isDevMode = !!S.opcionesTecnicas;
    const devStyle = isDevMode ? "" : 'class="vgl-d-none"';
    const sw = (id, on) => `<label class="vgl-sw"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><i></i></label>`;
    // v12.5.2 — Estado de la credencial COMPARTIDA de Athenea en este equipo (sin exponer valores).
    const athEstado = atheneaCredsGet()
      ? "<b>✅ Credenciales guardadas en este equipo.</b>"
      : "<b>⚠️ Sin credenciales guardadas — la sesión de Athenea seguirá cayendo hasta que alguien las guarde aquí, una sola vez.</b>";
    // [v12.3.13] El CSS de esta hoja vive al final de la hoja maestra de buildOverlay(): se
    // inyecta UNA vez en vez de re-parsearse en cada apertura. Aquí solo queda HTML puro.
    el.sheet.innerHTML = sheetHeader("Ajustes") + `
      <div class="vgl-grp">
        <div class="vgl-set-cap vgl-cap-azul"><i></i>Apariencia</div>
        <div class="vgl-fld"><label>Tema<span class="vgl-hint">"Automático" sigue el modo claro/oscuro del sistema operativo.</span></label>
          <select id="c-tema"><option value="oscuro">Oscuro</option><option value="claro">Claro</option><option value="auto">Automático</option></select></div>
        <div class="vgl-fld"><label>Modo rendimiento<span class="vgl-hint">Desactiva los efectos visuales complejos para mejorar la fluidez en equipos con recursos limitados.</span></label>${sw("c-perf", S.modoRendimiento)}</div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-set-cap vgl-cap-ambar"><i></i>Alertas y sonido</div>
        <div class="vgl-fld"><label>Sonido<span class="vgl-hint">Un tono distinto por tipo de notificación.</span></label>${sw("c-snd", S.sonido)}</div>
        <div class="vgl-fld"><label>Volumen</label><input type="range" id="c-vol" min="2" max="60" value="${Math.round(S.volumen * 100)}"></div>
        <div class="vgl-fld"><label>Repetir alerta sonora<span class="vgl-hint">La notificación de atención no confirmada repite el sonido cada 9 s hasta su reconocimiento.</span></label>${sw("c-ins", S.insistir)}</div>
        <div class="vgl-fld"><label>Ventana modal de alerta<span class="vgl-hint">Aviso emergente en pantalla cuando se detecta un ingreso extemporáneo.</span></label>${sw("c-car", S.cartel)}</div>
        <div class="vgl-fld"><label>Pestaña parpadeando<span class="vgl-hint">Título e ícono del navegador titilan durante una alerta sin responder.</span></label>${sw("c-par", S.parpadeo)}</div>
        <div class="vgl-fld"><label>Ventana emergente<span class="vgl-hint">Muestra alertas flotantes del sistema operativo.</span></label>${sw("c-pop", S.popup)}</div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-set-cap vgl-cap-verde"><i></i>Asistencia clínica</div>
        <div class="vgl-fld"><label>Recordatorio al abrir la historia<span class="vgl-hint">Aviso al abrir la historia clínica si existen actividades preventivas pendientes.</span></label>${sw("c-pymrem", S.recordatorioPym)}</div>
        <div class="vgl-fld"><label>PyM como banner superior (nuevo)<span class="vgl-hint">ENCENDIDO: las actividades de PyM pendientes salen en una franja fija arriba de la Historia Clínica, que empuja el contenido y no tapa nada. APAGADO: vuelve el aviso emergente de siempre. Si el banner se ve mal en consulta, apague esto y el aviso clásico regresa al instante — nunca se queda sin ninguno de los dos.</span></label>${sw("c-pymbanner", S.bannerPym !== false)}</div>
        <div class="vgl-fld"><label>Alerta de Abandono Programa RCV<span class="vgl-hint">Resalta pacientes con abandono registrado en el Programa de Riesgo Cardiovascular al abrir su historia clínica.</span></label>${sw("c-pes", S.abandonoPES)}</div>
        <div class="vgl-fld"><label>Alerta de laboratorios RCV vencidos<span class="vgl-hint">Aviso en rojo al abrir la historia si Colesterol Total/HDL, Triglicéridos, Glucosa, Uroanálisis, Creatinina o RAC no tienen resultado en los últimos 180 días.</span></label>${sw("c-labsv", S.labsVencidos)}</div>
        <div class="vgl-fld"><label>Agendamiento directo de citas<span class="vgl-hint">Habilita la asignación rápida de citas de control desde cada tarjeta de paciente.</span></label>${sw("c-agend", S.agendamientoRapido !== false)}</div>
        <div class="vgl-fld"><label>Enviar SMS de recordatorio al paciente<span class="vgl-hint">Al crear una cita, envía al celular registrado el mensaje de recordatorio de Everest. Solo se envía si la cita quedó creada correctamente.</span></label>${sw("c-sms", S.smsRecordatorio !== false)}</div>
      </div>
      <!-- v12.5.2 — Auto-inicio de sesión en Athenea: ENCENDIDO de fábrica, cuenta ÚNICA
           compartida por la sede (confirmado: Athenea no tiene login por médico). -->
      <div class="vgl-grp">
        <div class="vgl-set-cap vgl-cap-verde"><i></i>Auto-inicio de sesión en Athenea</div>
        <div class="vgl-fld"><label>Iniciar sesión en Athenea automáticamente<span class="vgl-hint">Guarda AQUÍ, una sola vez por computador, el usuario y la contraseña de la CUENTA COMPARTIDA de Athenea de la sede — sirve para cualquier médico que use este equipo, sin repetirlo. El almacén del navegador NO está cifrado: úsalo únicamente en equipos de la IPS. La contraseña nunca sale de este navegador. ${athEstado}</span></label>${sw("c-athlogin", S.atheneaAutoLogin !== false)}</div>
        <div class="vgl-fld"><label>Usuario de Athenea<span class="vgl-hint">La cuenta compartida de la sede — se guarda solo en este navegador/computador.</span></label><input type="text" id="c-athuser" autocomplete="off" spellcheck="false" placeholder="usuario" value=""></div>
        <div class="vgl-fld"><label>Contraseña de Athenea<span class="vgl-hint">No se muestra ni se registra en ningún log. Déjala vacía si solo quieres cambiar el usuario.</span></label><input type="password" id="c-athpass" autocomplete="new-password" placeholder="••••••••" value=""></div>
        <div class="vgl-fld"><label>Guardar credenciales<span class="vgl-hint">Guarda la cuenta compartida en ESTE equipo — sirve para todos los médicos que lo usen.</span></label><button class="vgl-btn" id="c-athsave">Guardar</button></div>
        <div class="vgl-fld"><label>Borrar credenciales de este equipo<span class="vgl-hint">Elimina de este equipo la credencial compartida de Athenea — afecta a TODOS los médicos que usen este computador.</span></label><button class="vgl-btn off" id="c-athclear">Borrar</button></div>
      </div>
      <!-- v12.0.0 — Controles operativos: SIEMPRE visibles para el médico -->
      <div class="vgl-grp">
        <div class="vgl-set-cap vgl-cap-recordatorio"><i></i>Operación</div>
        <div class="vgl-fld"><label>Actualizar lista de prevención<span class="vgl-hint" id="c-basen">Busca ahora mismo la versión más reciente de la lista de PyM.</span></label><button class="vgl-btn" id="c-basego">Buscar</button></div>
        <div class="vgl-fld"><label>Sincronizar almacenamiento<span class="vgl-hint">Abre el almacenamiento para renovar la sesión si la descarga automática falla.</span></label><button class="vgl-btn" id="c-spabrir">Abrir</button></div>
        <div class="vgl-fld"><label>Su identificador de médico<span class="vgl-hint">Solo si el panel no lo detecta solo. Sin él no se pueden crear citas ni órdenes: aparece detectado como <b>${escapeHtml(String(state.activeDoctor.id || S.medicoId || "— sin detectar —"))}</b>.</span></label><input type="number" id="c-medid" min="0" value="${escapeHtml(String(S.medicoId || ""))}" placeholder="(automático)"></div>
        <div class="vgl-fld"><label>Su nombre como aparece en la agenda<span class="vgl-hint">Solo si el panel no identifica su agenda propia. Detectado: <b>${escapeHtml(String(state.activeDoctor.name || S.medicoNombre || "— sin detectar —"))}</b>.</span></label><input type="text" id="c-mednom" value="${escapeHtml(String(S.medicoNombre || ""))}" placeholder="(automático)"></div>
        ${(() => {
          // v14.0.4 — AUDITORIA_MOTOR_RCV_v68.md §7.4: la tabla FESTIVOS está codificada a
          // mano para 2026-2027 (esFestivo ya avisa por consola cuando se pasa de año, pero
          // eso solo lo ve alguien con DevTools abierto). Aviso VISIBLE aquí, en Ajustes,
          // para que no dependa de que alguien mire la consola — se calcula del propio
          // contenido de FESTIVOS, nunca de un año fijo aparte que pueda desincronizarse.
          const anioMax = Math.max(...[...FESTIVOS].map((f) => parseInt(f.slice(0, 4), 10)));
          const vencida = new Date().getFullYear() >= anioMax;
          const hint = vencida
            ? `⚠ Vigente solo hasta el 31/12/${anioMax} — actualícela pronto: un festivo real que falte en la tabla puede ofrecer un día de agenda que en realidad está cerrado.`
            : `Vigente hasta el 31/12/${anioMax}.`;
          return `<div class="vgl-fld"><label>Tabla de festivos colombianos<span class="vgl-hint">${hint}</span></label></div>`;
        })()}
        <div class="vgl-fld"><label>Mostrar opciones técnicas<span class="vgl-hint">Muestra los ajustes avanzados (reportes, pruebas y diagnóstico). No hacen falta para el uso diario.</span></label>${sw("c-tecnicas", S.opcionesTecnicas)}</div>
      </div>
      <!-- SECCIÓN TÉCNICA (oculta salvo que se active arriba) -->
      <div class="vgl-grp vgl-grp-tec ${S.opcionesTecnicas ? '' : 'vgl-d-none'}">
        <div class="vgl-set-cap vgl-cap-morado"><i></i>Opciones técnicas</div>
        <div class="vgl-fld"><label>Tolerancia (Fijo)<span class="vgl-hint">Minutos de gracia rígidos (6.0 min predeterminado).</span></label><input type="number" id="c-tol" value="6" disabled></div>
        <div class="vgl-fld"><label>Refresco<span class="vgl-hint">Frecuencia de actualización en segundos de la agenda.</span></label><input type="number" id="c-ref" step="1" min="2" max="120" value="${S.refresco}"></div>
        <div class="vgl-fld"><label>Probar avisos<span class="vgl-hint">Dispara una notificación de prueba.</span></label><button class="vgl-btn" id="c-test">Probar</button></div>
        <div class="vgl-fld"><label>Actividades PyM a ocultar<span class="vgl-hint">Separadas por coma. Las actividades de VIH permanecen visibles por seguridad clínica.</span></label><input type="text" id="c-exc" value="${escapeHtml(S.excluir)}"></div>
        <div class="vgl-fld"><label>Recordatorio de carga PyM<span class="vgl-hint">Hora programada para verificar disponibilidad de la lista de prevención.</span></label><input type="time" id="c-rec" value="${escapeHtml(S.recordatorio)}"></div>
        <div class="vgl-fld"><label>Probar recordatorio<span class="vgl-hint">Muestra una vista previa del aviso de prevención.</span></label><button class="vgl-btn" id="c-pymtest">Probar</button></div>
        <div class="vgl-fld"><label>Probar alerta cardiovascular<span class="vgl-hint">Muestra una vista previa del aviso de prioridad cardiovascular.</span></label><button class="vgl-btn" id="c-pestest">Probar</button></div>
        <div class="vgl-fld"><label>Probar alerta de laboratorios vencidos<span class="vgl-hint">Muestra una vista previa del aviso de laboratorios RCV sin resultado vigente.</span></label><button class="vgl-btn" id="c-labsvtest">Probar</button></div>
        <div class="vgl-fld"><label>Consulta automática de prevención<span class="vgl-hint">Consulta la lista del día en la plataforma de almacenamiento. En su ausencia, utiliza la base de referencia.</span></label>${sw("c-base", S.baseAuto)}</div>
        <div class="vgl-fld"><label>Enlace de la base de referencia<span class="vgl-hint">${escapeHtml((CONFIG?.SP?.respaldo?.name) || "ninguna")} — Identificador del archivo de referencia.</span></label><input type="text" id="c-fbid" placeholder="(predeterminado)" value="${escapeHtml(S.respaldoId)}"></div>
<!-- v12.0.0: «Actualizar lista de prevención» y «Sincronizar almacenamiento» se movieron
             arriba, a la sección siempre visible: son operativos, no técnicos. -->
        <div class="vgl-fld"><label>Reporte de atención consolidado<span class="vgl-hint">Permite el envío del resumen diario de atención al panel de seguimiento.</span></label>${sw("c-rep", S.reporte)}</div>
        <div class="vgl-fld"><label>Nombre del consultorio / puesto<span class="vgl-hint">Identificador de la estación de trabajo (ej. "Consultorio 3").</span></label><input type="text" id="c-eq" placeholder="(opcional)" value="${escapeHtml(S.equipo)}"></div>
        <div class="vgl-fld"><label>Probar comunicación<span class="vgl-hint" id="c-repn">Realiza una prueba de conexión con el servidor de reportes.</span></label><button class="vgl-btn" id="c-repgo">Probar</button></div>
        <div class="vgl-fld"><label>Dirección del servidor de reportes<span class="vgl-hint">URL de servicio de datos.</span></label><input type="text" id="c-repurl" placeholder="(predeterminado)" value="${escapeHtml(S.reporteUrl)}"></div>
        <div class="vgl-fld"><label>Métricas de uso del panel<span class="vgl-hint">Conteo anónimo de acciones (sin ningún dato de paciente), enviado agregado cada 30 min al panel de seguimiento para mejorar el programa.</span></label>${sw("c-uxtel", S.uxTelemetria)}</div>
        <div class="vgl-fld"><label>Restablecer configuración<span class="vgl-hint">Restaura las opciones del sistema a sus valores predeterminados.</span></label><button class="vgl-btn off" id="c-reset">Restablecer</button></div>
        <div class="vgl-fld"><label>📦 Bitácora de Telemetría Real<span class="vgl-hint">Descarga todos los eventos registrados hoy para depuración en vivo.</span></label><button class="vgl-btn" id="c-export-logs">📥 Descargar Bitácora (.json)</button></div>
      </div>`;
    wireClose();
    const q = (id) => el.sheet.querySelector(id);
    q("#c-tema").value = S.tema;
    const bind = (id, key, get) => { const n = q(id); if (n) n.addEventListener("change", () => { S[key] = get(n); saveSettings(); state.lastSignature = ""; repaint(); }); };
    bind("#c-ref", "refresco", (n) => clampNum(n.value, 2, 120, DEFAULTS.refresco));
    bind("#c-tema", "tema", (n) => n.value);
    bind("#c-perf", "modoRendimiento", (n) => n.checked);
    bind("#c-snd", "sonido", (n) => n.checked);
    bind("#c-ins", "insistir", (n) => n.checked);
    bind("#c-car", "cartel", (n) => n.checked);
    bind("#c-par", "parpadeo", (n) => n.checked);
    bind("#c-pop", "popup", (n) => n.checked);
    bind("#c-exc", "excluir", (n) => n.value);
    bind("#c-rec", "recordatorio", (n) => n.value);
    bind("#c-pymrem", "recordatorioPym", (n) => n.checked);
    // v14.0.0 (T7) — interruptor de emergencia del banner. Al apagarlo hay que quitar el
    // banner que YA está en pantalla en ese momento: el siguiente tick reactiva el aviso
    // modal, pero sin esto la franja se quedaría pegada arriba hasta recargar la página.
    bind("#c-pymbanner", "bannerPym", (n) => n.checked);
    const pymBannerSw = q("#c-pymbanner");
    if (pymBannerSw) pymBannerSw.addEventListener("change", () => {
      if (!pymBannerSw.checked) {
        const pb = document.getElementById("vgl-pym-banner");
        if (pb) pb.remove();
      }
      uxTrack(pymBannerSw.checked ? "ajustes.bannerpym.on" : "ajustes.bannerpym.off");
    });
    const pymBtn = q("#c-pymtest"); if (pymBtn) pymBtn.addEventListener("click", () => { uxTrack("ajustes.probar.pym"); pymAlert("Paciente de prueba", ["Tamización VIH", "Tamización de mama"], false, true); });
    bind("#c-pes", "abandonoPES", (n) => n.checked);
    const pesBtn = q("#c-pestest"); if (pesBtn) pesBtn.addEventListener("click", () => { uxTrack("ajustes.probar.pes"); abandonoPESAlert("Paciente de prueba", true); });
    bind("#c-labsv", "labsVencidos", (n) => n.checked);
    const labsvBtn = q("#c-labsvtest"); if (labsvBtn) labsvBtn.addEventListener("click", () => {
      uxTrack("ajustes.probar.labsv");
      labsVencidosAlert("Paciente de prueba", RCV_VIGENCIA_KEYS.map((key) => ({ key, nombre: RCV_VIGENCIA_NOMBRES[key] })), true);
    });
    bind("#c-agend", "agendamientoRapido", (n) => n.checked);
    bind("#c-sms", "smsRecordatorio", (n) => n.checked);
    // v12.5.2 — Auto-inicio de sesión en Athenea. El interruptor solo activa/desactiva el
    // comportamiento; la credencial compartida se guarda aparte y nunca se registra en
    // consola ni en telemetría.
    bind("#c-athlogin", "atheneaAutoLogin", (n) => n.checked);
    bind("#c-uxtel", "uxTelemetria", (n) => n.checked);
    const athSave = q("#c-athsave");
    if (athSave) athSave.addEventListener("click", () => {
      const uNode = q("#c-athuser"), pNode = q("#c-athpass");
      const u = (uNode && uNode.value || "").trim();
      const p = (pNode && pNode.value) || "";
      if (!u || !p) { alert("Escribe el usuario y la contraseña de Athenea antes de guardar."); return; }
      const okg = atheneaCredsSet(u, p);
      if (pNode) pNode.value = "";   // no dejar la contraseña en el DOM tras guardar
      alert(okg
        ? "✅ Credenciales de Athenea guardadas en este equipo. Sirven para cualquier médico que use este computador — el inicio de sesión automático se activará cuando la sesión de Athenea caiga."
        : "❌ No se pudieron guardar las credenciales.");
      renderSettings();
    });
    const athClear = q("#c-athclear");
    if (athClear) athClear.addEventListener("click", () => {
      if (!atheneaCredsGet()) { alert("No hay credenciales guardadas en este equipo."); return; }
      if (!confirm("¿Borrar de este equipo la credencial compartida de Athenea? Esto afecta a TODOS los médicos que usen este computador.")) return;
      atheneaCredsClear();
      alert("🗑️ Credenciales de Athenea borradas de este equipo.");
      renderSettings();
    });
    bind("#c-medid", "medicoId", (n) => parseInt(n.value, 10) || 0);
    bind("#c-mednom", "medicoNombre", (n) => String(n.value || "").trim());
    // v12.0.0 — El deslizador de Volumen se pintaba pero NO estaba enlazado a nada: moverlo
    // no cambiaba el volumen ni se guardaba. Al soltarlo suena un tono para confirmarlo.
    const volSlider = q("#c-vol");
    if (volSlider) volSlider.addEventListener("change", () => { S.volumen = clampNum(volSlider.value, 2, 60, 15) / 100; saveSettings(); playTone("AZUL"); });
    // El interruptor de opciones técnicas repinta la hoja para mostrar u ocultar el bloque.
    const tecBtn = q("#c-tecnicas");
    if (tecBtn) tecBtn.addEventListener("change", () => { S.opcionesTecnicas = tecBtn.checked; saveSettings(); renderSettings(); });
    bind("#c-base", "baseAuto", (n) => n.checked);
    bind("#c-fbid", "respaldoId", (n) => n.value);
    const baseBtn = q("#c-basego"); if (baseBtn) baseBtn.addEventListener("click", () => { loadPymBase(); q("#c-basen").textContent = "Buscando..."; });
    const spBtn = q("#c-spabrir"); if (spBtn) spBtn.addEventListener("click", () => { primeShareAccess(true); });
    bind("#c-rep", "reporte", (n) => n.checked);
    bind("#c-eq", "equipo", (n) => n.value);
    bind("#c-repurl", "reporteUrl", (n) => n.value);
    const repBtn = q("#c-repgo"); if (repBtn) repBtn.addEventListener("click", async () => {
      q("#c-repn").textContent = "Probando...";
      const ok = await repPost({ token: TABLERO.token, equipo: (S.equipo || "").slice(0, 40), ver: VERSION, evento: "prueba", ts: new Date().toISOString(), dia: todayStamp() });
      q("#c-repn").textContent = ok ? "✅ Conexión exitosa" : "❌ Error de conexión";
    });
    const exportBtn = q("#c-export-logs"); if (exportBtn) exportBtn.addEventListener("click", () => vglExportLogs());
    const testBtn = q("#c-test"); if (testBtn) testBtn.addEventListener("click", testNotifications);
    const resetBtn = q("#c-reset"); if (resetBtn) resetBtn.addEventListener("click", () => {
      if (!confirm("¿Restablecer toda la configuración a los valores predeterminados?")) return;
      // v12.0.0 — Era `S = Object.assign({}, DEFAULTS)`, una REASIGNACIÓN de `S`, que está
      // declarada con `const`: lanzaba TypeError y el botón no restablecía nada. Se muta el
      // objeto en su sitio, que es lo que hacía el otro linaje.
      Object.assign(S, DEFAULTS); saveSettings(); applySettings(); state.lastSignature = ""; repaint(); renderSettings();
    });
  }

  function paintMute() {
    const b = document.getElementById("vgl-mute"); if (!b) return;
    const on = muted();
    b.classList.toggle("off", on);
    b.textContent = on ? "🔕 " + Math.max(1, Math.ceil((state.muteUntil - Date.now()) / 60000)) + " min" : "🔉 Silenciar";
    b.title = on ? "Silenciado. Clic para reactivar el sonido." : "Silenciar el sonido 15 minutos (se sigue registrando todo)";
  }
  function repaint() { if (state.lastSnapshot) render(state.lastSnapshot.list, state.lastSnapshot.source, state.lastSnapshot.at); }

  function makeDraggable(root, handle) {
    let dx = 0, dy = 0, dragging = false;
    // v7.5: el navegador no puede "cachear" un backdrop-filter mientras el elemento se
    // mueve — tiene que re-muestrear lo que hay detrás en cada frame. En GPU vieja eso
    // se siente como arrastre entrecortado justo cuando se mueve el panel para despejar
    // la vista. La clase "vgl-dragging" apaga el blur (fondo sólido de --toast) SOLO
    // mientras dura el arrastre, y se restaura al soltar.
    handle.addEventListener("mousedown", (e) => { if (e.target.closest("button")) return; dragging = true; root.classList.add("vgl-dragging"); const r = root.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; root.style.bottom = "auto"; root.style.right = "auto"; e.preventDefault(); });
    document.addEventListener("mousemove", (e) => { if (!dragging) return; root.style.left = Math.max(0, e.clientX - dx) + "px"; root.style.top = Math.max(0, e.clientY - dy) + "px"; });
    document.addEventListener("mouseup", () => { if (dragging) { dragging = false; root.classList.remove("vgl-dragging"); savePos(); } });
  }
  function setSummary(text, level) { if (!el.sum) return; el.sum.className = level || ""; el.sum.textContent = (level === "error" ? "⚠ " : level === "warn" ? "⏸ " : "") + text; }
  function signatureOf(list) { return list.map((a) => `${a.key}~${a.estado}~${a.color}~${a.pym.join("·")}`).join("||"); }
  // Barra de estadísticas: "En sala" = confirmadas del momento; "Atendidas" ya culminaron
  // (no cuentan como actuales). Se añade el contador de fraudes del día.
  let statsSig = "", frCache = { dia: "", n: 0 };
  // El contador de fraudes se guarda en memoria y solo se relee cuando cambia (bumpStat
  // lo invalida). Antes se leía y se interpretaba localStorage en CADA tick: 8.640 veces
  // por jornada solo para pintar un número que casi nunca cambia.
  function fraudesHoy() {
    const d = todayStamp();
    if (frCache.dia !== d) { frCache = { dia: d, n: statsToday().fraude || 0 }; }
    return frCache.n;
  }
  function renderStats(list) {
    if (!el.stats) return;
    if (!list.length) { if (statsSig !== "") { statsSig = ""; el.stats.innerHTML = ""; } return; }
    // v7.4.1: "Sin presentarse" se partió en dos leyendas. Antes mezclaba, bajo el mismo
    // número, al paciente que TODAVÍA puede llegar (aún no vence la tolerancia) con el que
    // YA la perdió (pasó la tolerancia = AMBAR, lo mismo que ya cuenta como "inasistencia"
    // en el resto de la app). Ahora "Sin presentarse" es SOLO el primer caso; el segundo
    // pasa a "Inasistencias" (mismo término que ya usa el Resumen del turno y los avisos).
    let ensala = 0, pend = 0, inasist = 0, atend = 0;
    for (const a of list) {
      const s = (a.estado || "").toLowerCase();
      if (s.includes("en sala")) ensala++;
      else if (s.includes("sin presentarse")) { if (a.color === "AMBAR") inasist++; else pend++; }
      else if (s.includes("atendido")) atend++;
    }
    const fr = fraudesHoy();
    const sig = ensala + "|" + pend + "|" + inasist + "|" + atend + "|" + fr;
    if (sig === statsSig) return;              // nada cambió: no se toca el DOM
    statsSig = sig;
    el.stats.innerHTML =
      `<div class="vgl-sb-lbl" style="margin-top:0">Estado</div>` +
      `<span class="vgl-stat"><span class="vgl-d" style="background:${COLORS.VERDE}"></span>En sala <b>${ensala}</b></span>` +
      `<span class="vgl-stat"><span class="vgl-d" style="background:${COLORS.AZUL}"></span>Sin pres. <b>${pend}</b></span>` +
      `<span class="vgl-stat"><span class="vgl-d" style="background:${COLORS.AMBAR}"></span>Inasistencias <b>${inasist}</b></span>` +
      `<span class="vgl-stat"><span class="vgl-d" style="background:var(--fg3)"></span>Atendidas <b>${atend}</b></span>` +
      (fr ? `<span class="vgl-stat hot" title="Confirmaciones extemporáneas detectadas hoy">⛔ Extemporáneas <b>${fr}</b></span>` : ""); // [COPY-UX]
    if (el.dockB) { el.dockB.style.display = fr ? "inline-block" : "none"; el.dockB.textContent = String(fr); }
  }

  // v7.8.1: ¿tiene abandono registrado en el Programa de riesgo cardiovascular (PES)?
  // Solo "Si" cuenta (esSi() en el indexador) — un "No" nunca llega a este conjunto.
  function tieneAbandonoPES(a) { return S.abandonoPES && state.pymAbandono && state.pymAbandono.has(normalizeKey(a.doc_id)); }
  // ---- Buscador y filtros rápidos ----
  let _fuzzyPrevRow = new Uint16Array(64);
  let _fuzzyCurrRow = new Uint16Array(64);
  let _fuzzyPrevPrevRow = new Uint16Array(64);
  let _lastQueryStr = null;
  let _lastQueryTokens = [];

  function fuzzyMatch(q, text) {
    if (q !== _lastQueryStr) {
      _lastQueryStr = q;
      _lastQueryTokens = stripAccents(q).toLowerCase().split(/\s+/).filter(Boolean);
    }
    const queryTokens = _lastQueryTokens;
    const textTokens = stripAccents(text).toLowerCase().split(/\s+/).filter(Boolean);

    let prevRow = _fuzzyPrevRow;
    let currRow = _fuzzyCurrRow;
    let prevPrevRow = _fuzzyPrevPrevRow;

    for (const qToken of queryTokens) {
      let tokenMatched = false;
      const m = qToken.length;
      const maxErrors = m <= 3 ? 0 : (m <= 6 ? 1 : 2);

      for (const tToken of textTokens) {
        if (tToken.includes(qToken)) {
          tokenMatched = true;
          break;
        }
        if (maxErrors === 0) continue;

        const n = tToken.length;

        // Ensure buffers are large enough
        if (n + 1 > prevRow.length) {
            const size = Math.max(n + 1, prevRow.length * 2);
            prevRow = new Uint16Array(size);
            currRow = new Uint16Array(size);
            prevPrevRow = new Uint16Array(size);
            _fuzzyPrevRow = prevRow;
            _fuzzyCurrRow = currRow;
            _fuzzyPrevPrevRow = prevPrevRow;
        }

        // initialize 1st row
        for (let j = 0; j <= n; j++) {
          prevRow[j] = j;
        }

        for (let i = 1; i <= m; i++) {
          currRow[0] = i;
          for (let j = 1; j <= n; j++) {
            const cost = qToken[i - 1] === tToken[j - 1] ? 0 : 1;
            currRow[j] = Math.min(
              prevRow[j] + 1,
              currRow[j - 1] + 1,
              prevRow[j - 1] + cost
            );
            if (i > 1 && j > 1 && qToken[i - 1] === tToken[j - 2] && qToken[i - 2] === tToken[j - 1]) {
              currRow[j] = Math.min(currRow[j], prevPrevRow[j - 2] + cost);
            }
          }
          // Swap rows: prevPrevRow <- prevRow, prevRow <- currRow
          let temp = prevPrevRow;
          prevPrevRow = prevRow;
          prevRow = currRow;
          currRow = temp;
        }

        let minCost = Infinity;
        for (let j = Math.max(0, m - maxErrors); j <= Math.min(n, m + maxErrors); j++) {
          if (prevRow[j] < minCost) minCost = prevRow[j];
        }
        if (minCost <= maxErrors) {
          tokenMatched = true;
          break;
        }
      }
      if (!tokenMatched) return false;
    }
    return true;
  }

  function matchesSearch(a) {
    const q = state.busqueda; if (!q) return true;
    if (fuzzyMatch(q, a.nombre || "")) return true;
    const digitos = q.replace(/\D/g, "");
    return !!digitos && String(a.doc_id || "").includes(digitos);
  }
  function matchesFilter(a) {
    const s = (a.estado || "").toLowerCase();
    switch (state.filtro) {
      // v7.8.1: abandono PES entra también a "Riesgo" — es exactamente eso, un paciente
      // que hoy debe priorizar el control de riesgo cardiovascular.
      case "riesgo": return a.color === "ROJO" || a.color === "AMBAR" || (a.color === "MORADO" && a.reason === "tiempo") || tieneAbandonoPES(a);
      case "sinpres": return s.includes("sin presentarse");
      case "ensala": return s.includes("en sala");
      case "pym": return a.pym && a.pym.length > 0;
      default: return true;
    }
  }
  function highlight(txt) {
    const q = state.busqueda; const safe = escapeHtml(txt);
    if (!q) return safe;
    const i = txt.toLowerCase().indexOf(q); if (i < 0) return safe;
    return escapeHtml(txt.slice(0, i)) + "<mark>" + escapeHtml(txt.slice(i, i + q.length)) + "</mark>" + escapeHtml(txt.slice(i + q.length));
  }
  // Cuenta regresiva: cuánto le queda al paciente antes de perder la cita (o cuánto lleva pasado).
  function countdown(a) {
    const s = (a.estado || "").toLowerCase();
    if (s.includes("en sala") || s.includes("atendido") || !a.hora_texto) return "";
    const rest = CONFIG.TOLERANCIA_MIN - (a.elapsed || 0);
    // Solo tiene sentido cerca de la hora de la cita: si falta más de 1½ h, no se muestra.
    if (rest > 90 || rest < -180) return "";
    const abs = Math.abs(rest);
    let cuanto;
    if (abs >= 60) cuanto = Math.floor(abs / 60) + "h" + String(Math.round(abs % 60)).padStart(2, "0");
    else { const mm = Math.floor(abs), ss = Math.round((abs - mm) * 60); cuanto = mm + ":" + String(Math.min(59, ss)).padStart(2, "0"); }
    // v7.4: palabra corta en vez de signo matemático — bajo presión, un "−"/"+" de 10.5px
    // junto a una hora en el mismo formato numérico es fácil de pasar por alto o confundir.
    // Se mantiene compacto (mismo orden de longitud que el signo) para no romper la fila.
    const txt = (rest >= 0 ? "en " : "hace ") + cuanto;
    const cls = rest <= 0 ? " late" : rest <= 1 ? " warn" : "";
    const tip = rest >= 0 ? "Le quedan " + cuanto + " para confirmar" : "Lleva " + cuanto + " pasado de la tolerancia";
    return `<span class="vgl-cd${cls}" title="${tip}">${txt}</span>`;
  }

  function render(list, source, at) {
    const sinCruce = state.pymFile && state.pym.size > 0 && list.length > 0 && list.every((a) => !a.pym || !a.pym.length);
    // v7.8.3: texto más claro cuando se está usando la base PILOTO (no la de hoy) — antes
    // decía solo "⚠ RESPALDO", una palabra que no explica QUÉ significa ni QUÉ hacer.
    const pymTxt = state.pymFile
      ? (`PyM: ${state.pym.size}` + (state.pymFallback ? " · ⚠ base piloto (aún no llega la de hoy)" : "") + (sinCruce ? " ⚠ SIN CRUCE (Ajustes→Diag)" : ""))
      : "PyM sin cargar";
    const hora = at ? at.toLocaleTimeString() : "—";
    const mute = muted() ? " · 🔕" : "";
    if (el.dot) el.dot.className = source === "api" ? "bg" : source === "pagina" ? "page" : source === "compartido" ? "page" : "stale";
    if (source === "api") setSummary(`Vigilando (directo) · ${list.length} cita(s) · act. ${hora} · ${pymTxt}${mute}`);
    else if (source === "pagina") setSummary(`En Citas del día · ${list.length} cita(s) · act. ${hora} · ${pymTxt}${mute}`);
    else if (source === "compartido") setSummary(`Espejo · ${list.length} cita(s) · act. ${hora} · ${pymTxt}${mute}`);
    else if (list.length) setSummary(`Última lectura ${hora} · vuelve a "Citas del día" para refrescar · ${pymTxt}${mute}`, "warn");
    else setSummary(`Esperando "Citas del día"… · ${pymTxt}`);
    el.root.classList.toggle("stale", !source && list.length > 0);
    renderStats(list);
    paintMute();

    const vista = list.filter((a) => matchesFilter(a) && matchesSearch(a));
    // La firma YA NO incluye los minutos transcurridos. Antes sí, y como esos minutos
    // cambian a la vez para todas las citas, la lista entera se reconstruía cada minuto
    // (721 veces por jornada) devolviendo el desplazamiento al principio en plena lectura.
    // Ahora la cuenta regresiva se refresca en el sitio, sin recrear las tarjetas.
    const sig = (source || "C") + "|" + state.filtro + "|" + state.busqueda + "|" + signatureOf(vista);
    if (sig === state.lastSignature) { refrescarCuentas(vista); return; }
    state.lastSignature = sig;
    if (!list.length) { el.list.innerHTML = `<div id="vgl-empty">Aún sin citas.<br>Entra una vez a "Citas del día" para leer la agenda.</div>`; return; }
    if (!vista.length) { el.list.innerHTML = `<div id="vgl-empty">Ninguna cita coincide con el filtro.<br><span class="vgl-empty-msg">${escapeHtml(list.length + " cita(s) ocultas")}</span></div>`; return; }
    el.list.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (const a of vista) {
      const col = COLORS[a.color] || COLORS.AZUL, tint = TINT[a.color] || TINT.AZUL;
      const card = document.createElement("div");
      // v7.4: refuerzo de tarjeta completa para ROJO/MORADO/AMBAR (antes solo ROJO tenía
      // clase propia). Verde/azul se quedan sin tinte: son estados resueltos/informativos.
      const colorCls = (a.color === "ROJO" || a.color === "MORADO" || a.color === "AMBAR") ? " " + a.color.toLowerCase() : "";
      const esPes = tieneAbandonoPES(a);
      const esAtendido = !!(a.estado && a.estado.toLowerCase().includes("atendido"));
      card.className = "vgl-card" + colorCls + (a.color === "ROJO" ? " rojo" : "") + (esPes ? " pes" : "") + (state.busqueda && matchesSearch(a) ? " hit" : "") + (esAtendido ? " atendido" : "");
      // v13.0.0 — El badge de estado usaba el mismo verde de puntualidad (--tc) que "En
      // sala": aquí, y SOLO aquí (nunca en --tc/el punto, que sigue siendo el eje de
      // fraude de colorAndAlert), Atendido cambia a --c-atendido — color que ningún otro
      // estado usa — para que la leyenda "Atendido" se lea sin confundirse con "En sala".
      // El fraude (ROJO) manda: si está marcado como fraude, se queda con el rojo de alerta.
      const atendidoLeyenda = esAtendido && a.color !== "ROJO";
      const badgeCol = atendidoLeyenda ? "var(--c-atendido)" : `var(--tc,${col})`;
      const badgeRgba = (alfa) => atendidoLeyenda ? `rgba(var(--rgb-atendido),${alfa})` : `rgba(var(--trgb),${alfa})`;
      // Bandera de fraude EXPLÍCITA en texto (no solo color): así no depende de memorizar
      // el código de color, y sigue diciendo "fraude" aunque el estado cambie más tarde.
      const flag = a.color === "ROJO" ? `<span class="vgl-flag">⛔ NO CONFIRMADO</span>` : ""; // [COPY-UX]
      // v7.8.1: bandera de abandono PES, en texto — igual de explícita que la de fraude,
      // convive con ella si un paciente cayera en ambas categorías a la vez.
      // v14.0.0 (T4, D9) — "SEGUIMIENTO CARDIOVASCULAR" pasa a "ABANDONO PROGRAMA RCV": el
      // médico pidió que el texto oriente a priorizar el control del programa, no solo a
      // notar un seguimiento pendiente. Mismos otros dos sitios en abandonoPESAlert() y en
      // el rótulo de Ajustes.
      const pesFlag = esPes ? `<span class="vgl-flag pes">❤ ABANDONO PROGRAMA RCV</span>` : ""; // [COPY-UX]
      // v14.0.0 (T4) — AMPUTACIÓN DEL PANEL: agendar/ordenar/labs (🗓️/📋/🧪) y los chips de
      // PyM salen de la tarjeta — el panel queda solo como vigía de agenda. Los tres flujos
      // renacen como widgets sobre la Historia Clínica en T5, reutilizando exactamente las
      // mismas funciones (openAgendamientoModal/openOrdenamientoModal/openLaboratoriosModal/
      // openLabSoloModal) y los mismos bloqueos antiduplicado (isCitaAgendadaHoy/
      // isLabAgendadaHoy/isOrdenesCreadasHoy) — por eso esas funciones NO se tocan aquí, solo
      // dejan de tener llamador DENTRO de render(). panelActivities() tampoco se toca: T5 la
      // reconecta para el propio widget.
      // v14.0.2 — El botón "Atender" (registrar en Everest la hora de apertura sin navegar
      // a la historia) se retiró a pedido explícito del médico: usa directamente el botón
      // nativo "Historias Clínicas" de Everest para entrar a la historia, sin intermediarios.
      // La fila inferior de la tarjeta (vgl-card-btm) ya no tiene contenido que mostrar —
      // T4 ya se había llevado los botones de agendar/ordenar/labs y los chips de PyM a los
      // widgets del dock (T5); este era el último ocupante.
      card.innerHTML = `
        <div class="vgl-card-top vgl-card-top-t1" style="--tc:var(--c-${COLORS[a.color] ? a.color.toLowerCase() : "azul"},${col});--trgb:var(--rgb-${COLORS[a.color] ? a.color.toLowerCase() : "azul"})">
          <div class="vgl-card-time-wrap vgl-card-time-wrap-t1">
            <span class="vgl-cdot vgl-cdot-t1" style="background:var(--tc,${col});box-shadow:0 0 10px var(--tc,${col})"></span>
            <span class="vgl-time vgl-time-t1">${escapeHtml(a.hora_texto)}</span>
            ${countdown(a)}
          </div>
          <div class="vgl-card-badges-wrap">
            ${flag}${pesFlag}
            <span class="vgl-badge vgl-badge-t1" style="background:${badgeRgba(".16")};color:${badgeCol};box-shadow:inset 0 0 0 1px ${badgeRgba(".32")}">${escapeHtml(a.estado)}</span>
          </div>
        </div>
        <div class="vgl-card-mid vgl-card-mid-t1">
          <div class="vgl-name vgl-name-t1" title="${escapeHtml(a.nombre)}">${highlight(a.nombre)}</div>
          ${a.doc_id ? `<span class="vgl-doc vgl-doc-t1">CC ${highlight(String(a.doc_id))}</span>` : ""}
        </div>`;
      card.__vglKey = a.key;
      fragment.appendChild(card);
    }
    el.list.appendChild(fragment);
    // v12.4.0 — Retirada la medición scrollWidth/clientWidth y la máscara "hay más"
    // (v12.3.24): la fila de chips ahora envuelve en varias líneas y nada queda oculto.
  }
  // Refresca SOLO el texto de la cuenta regresiva de cada tarjeta ya pintada. Cuesta unos
  // pocos microsegundos frente a recrear la lista entera.
  function refrescarCuentas(vista) {
    try {
      const cards = el.list ? el.list.children : null;
      if (!cards || cards.length !== vista.length) return;
      for (let i = 0; i < vista.length; i++) {
        const card = cards[i], a = vista[i];
        if (!card || card.__vglKey !== a.key) return;      // el orden cambió: lo hará el repintado normal
        const cd = card.querySelector(".vgl-cd"), html = countdown(a);
        if (!html) { if (cd) cd.remove(); continue; }
        const m = /class="vgl-cd([^"]*)"[^>]*title="([^"]*)"[^>]*>([^<]*)</.exec(html);
        if (!m) continue;
        if (cd) {
          const newCls = "vgl-cd" + m[1];
          if (cd.className !== newCls) cd.className = newCls;
          if (cd.title !== m[2]) cd.title = m[2];
          if (cd.textContent !== m[3]) cd.textContent = m[3];
        }
        else { const badge = card.querySelector(".vgl-badge"); if (badge) badge.insertAdjacentHTML("beforebegin", html); }
      }
    } catch (e) {}
  }
  // [BLINDADO v8.2.0 DOM-01] escapeHtml reforzado: cubre & < > " ' ` — vectores completos de XSS en atributos HTML.
  // La versión anterior omitía comilla simple y backtick, riesgo latente si se usan en contextos de atributo con comilla simple.
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;', '`': '&#x60;' }[c])); }


  // Autocomprobación criptográfica de integridad SHA-256 (R1.9)
  async function verificarIntegridadArranque(fuenteOpcional) {
    try {
      let src = fuenteOpcional;
      if (!src && typeof GM_info !== "undefined" && GM_info && GM_info.scriptSource) {
        src = GM_info.scriptSource;
      }
      if (!src) return { status: "skipped", reason: "no_source" };
      const encoder = new TextEncoder();
      const data = encoder.encode(src);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      return { status: "ok", sha256: hashHex };
    } catch (e) {
      return { status: "error", error: e.message };
    }
  }

  // Saludo AZUL: UNA sola vez al día en todo el navegador (antes salía en cada pestaña/recarga).
  // v7.3.3: si el Vigilante arranca TARDE (turno ya empezado), NO se dispara ningún aviso
  // de lo que ya pasó: sale este ÚNICO resumen de lo corrido y desde ahí solo se avisa
  // lo que ocurra en vivo (la siembra silenciosa de maybeNotify garantiza lo segundo).
  // [COPY-UX] Notificación inicial al activar el asistente clínico
  function helloOncePerDay(list) {
    try { if (localStorage.getItem("vgl_hello") === todayStamp()) return; localStorage.setItem("vgl_hello", todayStamp()); } catch (e) {}
    let atend = 0, sala = 0, pend = 0, vencidas = 0;
    for (const a of list) {
      const s = (a.estado || "").toLowerCase();
      if (s.includes("atendido")) atend++;
      else if (s.includes("en sala")) sala++;
      else if (s.includes("sin presentarse")) { pend++; if (a.color === "AMBAR") vencidas++; }
    }
    notify("AZUL", "ℹ Asistente clínico activo — estado inicial de la jornada",
      `${list.length} cita(s): ${atend} atendida(s) · ${sala} en sala · ${pend} sin presentarse` +
      (vencidas ? ` (${vencidas} con tiempo de tolerancia transcurrido)` : "") +
      `.\nMonitoreo activo para eventos en tiempo real.`, false);
  }
  function tick() {
    try {
      const leader = heartbeat();
      diaNuevo();                                    // reinicio limpio si el turno cruzó la medianoche
      // v7.8.1: fuera de agenda del día / historia clínica, el panel no se repinta —
      // se recoge sola a la pastilla flotante (el "×" real del usuario NO se toca:
      // autoDocked distingue uno de otro) y se restaura sola al volver a una de las
      // dos vistas permitidas. heartbeat() y diaNuevo() SIEMPRE corren primero
      // (baratos, importantes: continuidad del liderazgo entre pestañas y limpieza de
      // medianoche aunque el médico esté en otra pantalla en ese instante).
      // v12.3.11 — Antes, "otra" también apagaba el sondeo del API y el sniff de la
      // llamada aprendida (return inmediato, antes de llegar al bloque "leader" de
      // más abajo). Ninguno de los dos toca el DOM de Everest: son solo red y JSON,
      // así que salir a Órdenes, RCV o cualquier otra pantalla los dejaba sin correr
      // sin ninguna razón real — la causa de que el panel pidiera "vuelve a Citas del
      // día" incluso con el modo API ya aprendido. Ahora solo el repintado (que sí
      // depende del DOM de cada vista) se queda condicionado a estar en agenda/historia.
      const secc = seccionActiva();
      const enVistaVigilada = secc !== "otra";
      if (!enVistaVigilada) {
        if (state.lastSeccion !== "otra" && el.root && winState !== "dock") {
          state.autoDocked = true;
          setWinState("dock", true);
        }
      } else if (state.autoDocked) {
        // Al volver a una sección permitida, se restaura la ÚLTIMA ventana que el
        // médico eligió de verdad (state.userWinState) — no siempre "full": si la
        // había dejado minimizada, sigue minimizada; si la había cerrado a mano, ver
        // más abajo.
        state.autoDocked = false; setWinState(state.userWinState, true);
      }
      state.lastSeccion = secc;

      // v12.3.14 — Disparo del Robot Athenea SIN MutationObserver global: la pregunta
      // que el observador erradicado respondía quemando CPU en cada mutación de la SPA
      // se contesta aquí por el precio de un getElementById por tick. Corre en TODA
      // pestaña (SIN condicionar a leader, igual que corría el observador) y es barata:
      // createLabInjectorUI es idempotente con su botón y el robot automático conserva
      // su guarda de una-vez-por-paciente (lastAutoFetchedDoc).
      if (secc === "historia") { createLabInjectorUI(); createExamenFisicoInjectorUI(); checkRacGuardia(); }
      // v14.0.0 (T5) — el dock de acciones usa _enModuloHCHealth() (por ruta, viva/HCHealth)
      // en vez de secc==="historia" (por el marcador #anamesis): es el alcance MÁS AMPLIO
      // que pide el encargo original ("widgets sobre la Historia Clínica"), no solo la
      // pestaña concreta. La función es idempotente y se autolimpia sola si el médico sale
      // del módulo o cierra al paciente — igual de barata que createLabInjectorUI().
      createAccionesDockUI();

      // v14.0.0 (T7) — el banner PyM usa _enModuloHCHealth() (por ruta), el mismo alcance
      // amplio que T5 le dio al dock de widgets: vive sobre TODA la Historia Clínica, no
      // solo la pestaña con el marcador #anamesis. Idempotente y se autolimpia sola.
      //
      // RED DE SEGURIDAD (v14.0.0, decisión del médico antes de estrenarlo en consulta
      // real): el banner REEMPLAZA al aviso modal de PyM (checkRecordatorioPym), y su
      // inserción como primer hijo de document.body nunca se pudo verificar contra la
      // página real de Everest — si el contenedor raíz de Angular tuviera position:fixed
      // o height:100vh propio, "empujar el contenido" no se vería aunque el cálculo de
      // flujo normal sea correcto en el arnés. Sin red, ese fallo dejaría al médico SIN
      // aviso de PyM y sin enterarse: la alerta clínica desaparecería en silencio, que es
      // exactamente lo que D4 prohíbe. Por eso el banner nunca se apaga solo:
      //   · S.bannerPym === false (interruptor de Ajustes) -> se quita el banner y vuelve
      //     el aviso modal de siempre. Nunca se queda sin ninguno de los dos.
      //   · si createPymBannerUI() lanza, se atrapa, se reporta y se cae al aviso modal en
      //     el MISMO tick, en vez de perder la alerta.
      if (S.bannerPym !== false) {
        let bannerPintado = true;
        try {
          createPymBannerUI();
        } catch (e) {
          bannerPintado = false;
          try { reportarError("createPymBannerUI", String((e && e.message) || e), "tick"); } catch (e2) {}
        }
        if (!bannerPintado) checkRecordatorioPym();
      } else {
        const pbApagado = document.getElementById("vgl-pym-banner");
        if (pbApagado) pbApagado.remove();
        checkRecordatorioPym();
      }

      // v12.5.14 — Cualquier pestaña (líder o no) que esté en el módulo clínico HCHealth
      // dispara los avisos que quedaron en cola mientras ninguna pestaña estaba ahí (ver
      // _encolarAvisoPendiente/_dispararAvisoReal). Corre en TODA pestaña, sin condicionar
      // a leader: si el médico tiene la agenda en una pestaña no-líder, el aviso debe
      // salir ahí igual, no solo en la pestaña que hace el sondeo del API.
      _flushAvisosPendientes();

      // v12.3.21 — Antes, aunque tickApi() ya sondea el API en TODA la aplicación desde
      // v12.3.11 (más abajo), el PROCESADO de esa respuesta —calcular colores, disparar
      // maybeNotify— solo corría dentro de enVistaVigilada. Reportado en consultorio: con
      // el médico en Órdenes/RCV/otra pantalla, el paciente entraba a tiempo y NO llegaba
      // ningún aviso — el dato ya estaba fresco en state.apiCitas pero nadie lo procesaba
      // hasta volver a "Citas del día". maybeNotify() ya es idempotente por diseño (dedup
      // contra state.notified/avisoYaVisto), así que llamarlo aquí sin importar la vista
      // es seguro: no duplica avisos. Lo único que se queda atado a enVistaVigilada es lo
      // que de verdad depende del DOM — el respaldo por scrape de la página y el pintado
      // del panel— para no gastar CPU pintando una vista que no está visible.
      const now = new Date();
      let data = null, source = null;
      // v7.3 MODO LIGERO: primero el API (unos kB por consulta, con la sesión ya
      // abierta: funciona aunque la pestaña esté en una historia clínica o en cualquier
      // otra pantalla) y, como respaldo SOLO si hay agenda visible, la página delante.
      if (leader && apiSano() && state.apiCitas && Date.now() - (state.apiEn || 0) < 180000) {
        data = { visible: true, citas: state.apiCitas }; source = "api";
      }
      if (enVistaVigilada && (!data || !data.citas.length)) {
        const dPag = extractAgenda(document);
        if (dPag.visible && dPag.citas.length) { data = dPag; source = "pagina"; }
      }
      if (data && data.citas.length) {
        const processed = data.citas.map((a) => colorAndAlert(a, now));
        if (!state.summarized) {
          // Estado inicial: se SIEMBRA sin notificar (no-inferencia v2.5: solo eventos EN DIRECTO).
          // v14.1.5 — ...pero SOLO la primera vez del día en TODO el navegador, no una vez
          // por pestaña. `state.notified` y `state.summarized` viven en memoria de cada
          // pestaña, así que cada relevo de liderazgo estrenaba una siembra: el nuevo
          // líder marcaba a TODOS los pacientes como ya vistos sin avisar de ninguno, y
          // `maybeNotify` los tapaba después con su `if (prev === undefined) return`. Ese
          // es el "a veces NO te avisa" — no un aviso tarde, un aviso que no llega nunca.
          // Con el relevo por visibilidad de esta misma versión los relevos son MÁS
          // frecuentes, así que sin esto el arreglo de arriba habría empeorado el otro
          // síntoma. La siembra se comparte entre pestañas y se rehace cada día.
          state.summarized = true;
          _sembrarEstadoInicial(processed);
          // v12.5.14 — helloOncePerDay ya se auto-protege contra duplicados entre pestañas
          // (localStorage "vgl_hello" por día): no depende de "leader" para eso. Quitar esa
          // condición aquí es lo que permite que el saludo SÍ salga en cuanto esta pestaña
          // esté en HCHealth, aunque la pestaña líder (la que sondea el API) esté en otro
          // módulo de Everest en ese momento.
          if (_enModuloHCHealth()) helloOncePerDay(processed);
        } else if (leader) {
          processed.forEach(maybeNotify);
        }
        state.lastSnapshot = { at: now, list: processed, source };
        if (leader) share(processed);
        if (enVistaVigilada) render(processed, source, now);
      } else if (enVistaVigilada) {
        if (state.shared && Date.now() - state.shared.t < 60000) {
          render(state.shared.list, "compartido", new Date(state.shared.t));
        } else if (state.lastSnapshot) { render(state.lastSnapshot.list, null, state.lastSnapshot.at); }
        else { render([], null, null); }
      }

      // Vía directa, SIEMPRE al final (haya datos o no, y en TODA la aplicación desde
      // v12.3.11): si aún no se aprendió la llamada se busca en el registro de
      // rendimiento; si ya se aprendió, se sondea.
      if (leader) {
        if (!API.url) apiSniffPerf(window);
        tickApi();
        // v12.3.5 — Latido de sesión de Athenea, cada 3 min: bien por debajo del ~5 min
        // reportado en consultorio, deja margen para que la expiración deslizante nunca
        // llegue a cumplirse mientras el navegador siga abierto.
        // v12.3.12 — El latido corre en TODA la aplicación, no solo en agenda/historia.
        // Confirmado con un log real de consultorio: el flujo automático de labs funcionó
        // varias veces seguidas y, un rato después, el modal manual encontró la sesión de
        // Athenea CADUCADA — el tiempo que la médica pasó en otras pantallas de Everest
        // dejó al latido apagado y la expiración deslizante se cumplió. Igual que el
        // sondeo del API en v12.3.11: es red pura (GM_xmlhttpRequest), no toca el DOM de
        // Everest, así que no había razón real para condicionarlo a la vista activa.
        // v12.3.15 — Cadencia adaptativa del latido: 3 min bastan cuando la sesión está
        // viva (solo hay que impedir que el timeout deslizante se cumpla), pero cuando
        // está CAÍDA se sondea cada 45 s: así, tras el login manual del médico en la
        // otra pestaña, la restauración se detecta en menos de un minuto y el robot
        // reanuda solo (ver el reset de lastAutoFetchedDoc en atheneaKeepAlive).
        if (Date.now() - atheneaKeepAliveAt > (atheneaSesionViva === false ? 45000 : 180000)) {
          atheneaKeepAliveAt = Date.now();
          atheneaKeepAlive();
        }
        if (enVistaVigilada) {
          // v12.3.1 — Reintento de identidad, mismo patrón que apiSniffPerf: mientras el
          // médico no esté identificado, cada 30 s se re-consultan los globales de la
          // página y, si ya se vio un login en la red pero su resolución falló, se vuelve
          // a intentar (resolverMedicoPorPerfil deduplica los intentos en vuelo).
          if (!state.activeDoctor.id && Date.now() - idRetryAt > 30000) {
            idRetryAt = Date.now();
            captureDoctorInfo("");
            identidadDesdeCliente();
            if (loginVisto) resolverMedicoPorPerfil(loginVisto);
          }
          // v14.0.0 (T7) — checkRecordatorioPym()/pymAlert() APAGADO: el aviso MODAL
          // interruptivo que hacían quedó reemplazado por createPymBannerUI() (arriba),
          // nivel 2 · persistente (D5) en vez de bloquear la pantalla hasta que el médico
          // lo reconociera. Las funciones NO se borran (checkAbandonoPES/abandonoPESAlert,
          // nivel 3, siguen intocadas y son independientes) — solo se deja de invocar esta.
          checkAbandonoPES();
          checkLabsVencidos();
        }
      }
    } catch (e) { console.error("[Vigilante] tick:", e); }
  }

  // v14.1.9 — La cabecera del informe descargable filtraba lo que todo el resto del
  // informe se cuidaba de ocultar. `san()` sustituye cada nodo de texto por "···" y
  // `mask()` recorta las cédulas a 3 dígitos… y dos líneas más arriba se escribían
  // `location.href` y `document.title` en crudo.
  //
  // `document.title` es el peor de los dos: en un sistema de historia clínica suele llevar
  // el NOMBRE del paciente. Y la URL lleva los identificadores en la consulta y en el
  // fragmento — el propio script construye `...BusquedaPaciente#doc=<cédula>`.
  //
  // Se conserva lo que sirve para diagnosticar (qué vista es, cuántos parámetros había) y
  // se tira lo que identifica. El título no se recorta ni se sanea: se omite. Recortarlo
  // dejaría el principio del nombre, que es justo la parte que identifica.
  function _urlDiagnostico() {
    try {
      const href = String((typeof location !== "undefined" && location.href) || "");
      if (!href) return "(no disponible)";
      const sinFrag = href.split("#")[0];
      const partes = sinFrag.split("?");
      const nParams = partes[1] ? partes[1].split("&").filter(Boolean).length : 0;
      return partes[0]
        + (nParams ? " · (" + nParams + " parámetro(s) omitido(s))" : "")
        + (href.indexOf("#") !== -1 ? " · (fragmento omitido)" : "");
    } catch (e) { return "(no se pudo leer la URL)"; }
  }
  function _tituloDiagnostico() {
    try {
      const t = String((typeof document !== "undefined" && document.title) || "");
      return t ? "(omitido — " + t.length + " caracteres)" : "(vacío)";
    } catch (e) { return "(no se pudo leer el título)"; }
  }

  function downloadDiagnostic() {
    const ddoc = document; const KEEP = new Set(["class", "role", "routerlink", "type", "name"]); const out = [];
    const sels = [".labelHora", ".status-label", ".card", ".card-body", ".text-muted", ".text-uppercase", ".fw-bold.mb-0", ".fecha", ".text-uppercase.fw-bold"];
    const counts = {}; sels.forEach((s) => { try { counts[s] = ddoc.querySelectorAll(s).length; } catch (e) { counts[s] = "err"; } });
    const freq = {}; ddoc.querySelectorAll("*").forEach((n) => (n.classList ? [...n.classList] : []).forEach((c) => (freq[c] = (freq[c] || 0) + 1)));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 120);
    const san = (node) => { const c = node.cloneNode(true); const w = (x) => { if (x.nodeType === 3) { if (x.textContent && x.textContent.trim()) x.textContent = "···"; return; } if (x.nodeType !== 1) return; [...(x.attributes || [])].forEach((a) => { if (!KEEP.has(a.name) && !a.name.startsWith("data-")) x.removeAttribute(a.name); else if (a.name.startsWith("data-")) x.setAttribute(a.name, ""); }); [...x.childNodes].forEach(w); }; w(c); return c.outerHTML; };
    let card = ""; try { const h = ddoc.querySelector(".labelHora"); const c = h && containerOf(h); card = c ? san(c).slice(0, 15000) : "(no se encontró .labelHora)"; } catch (e) { card = "err: " + e; }
    out.push("===== DIAGNÓSTICO — VIGILANTE v" + VERSION + " =====", "Fecha: " + new Date().toISOString(), "URL: " + _urlDiagnostico(), "Título: " + _tituloDiagnostico(),
      "\n--- CONTEO DE SELECTORES ---", JSON.stringify(counts, null, 2),
      "\n--- CLASES MÁS FRECUENTES (top 120) ---", top.map(([c, n]) => n + "  ." + c).join("\n"),
      "\n--- PRIMERA TARJETA (HTML sanitizado) ---", card,
      "\n--- NOTIFICACIONES ---",
      "Soporte Notification: " + (typeof Notification !== "undefined"),
      "Permiso actual: " + (typeof Notification !== "undefined" ? Notification.permission : "n/a"),
      "Visibilidad de la pestaña: " + document.visibilityState,
      "Silenciado: " + (muted() ? "sí" : "no"),
      "\n--- AJUSTES ACTIVOS ---", JSON.stringify(S, null, 2),
      "\n--- CONTADORES (últimos 7 días) ---", JSON.stringify(lastDays(7), null, 2),
      "\n--- PyM ---", "Archivo: " + (state.pymFile || "sin cargar"), "Pacientes con pendientes: " + state.pym.size,
      "Documentos totales en la hoja: " + (state.pymTodos ? state.pymTodos.size : "n/a"),
      "Base automática activa: " + (S.baseAuto ? "sí" : "no") + " · id: " + ((CONFIG.SP.respaldo && CONFIG.SP.respaldo.id) || "n/a"),
      "\n--- CRUCE PyM ↔ AGENDA (v7.3.3) ---", (function () {
        try {
          const mask = (s) => { s = String(s == null ? "" : s); return s ? s.slice(0, 3) + "…(" + s.length + " díg.)" : "(vacío)"; };
          const out = ["Hoja elegida: " + (state.pymHoja || "n/a")];
          const keys = []; for (const k of state.pym.keys()) { keys.push(k); if (keys.length >= 8) break; }
          out.push("Muestra de claves de la base: " + (keys.map(mask).join(" · ") || "(ninguna)"));
          const dist = {}; let n = 0;
          for (const k of state.pym.keys()) { dist[k.length] = (dist[k.length] || 0) + 1; if (++n >= 40000) break; }
          out.push("Longitudes de clave en la base {dígitos: cuántas}: " + JSON.stringify(dist));
          const lst = (state.lastSnapshot && state.lastSnapshot.list) || [];
          let hit = 0;
          const det = lst.map((a) => { const k = normalizeKey(a.doc_id); const ok = state.pym.has(k); if (ok) hit++; return mask(k) + (ok ? "✓" : "✗"); });
          out.push("Citas de hoy (" + lst.length + "): " + (det.join(" · ") || "(sin lectura)"));
          out.push("COINCIDEN: " + hit + "/" + lst.length + (hit ? "" : "  ← si es 0, la columna que la hoja usa como documento NO es la cédula, o el formato no cruza"));
          return out.join("\n");
        } catch (e) { return "err: " + e; }
      })(),
      "\n--- LECTURA DIRECTA DEL API ---",
      "Llamada aprendida: " + (API.url ? "SÍ" : "todavía no"),
      "Lecturas correctas: " + API.ok + " · fallos seguidos: " + API.fallos + " · última respuesta: " + (API.ms || 0) + " ms",
      "Campos detectados: " + (API.campos ? JSON.stringify(API.campos) : "ninguno aún"));
    const blob = new Blob([out.join("\n")], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "diagnostico_vigilante_SANITIZADO.txt"; document.body.appendChild(a); a.click(); a.remove();
    setSummary("Diagnóstico descargado (solo local, sin datos de pacientes). Revisa Descargas.");
  }

  // v14.1.5 — LA GUARDA DE LA RAC AHORA SE RINDE, Y ESO ES EL ARREGLO.
  // Existe porque Everest borra esa casilla solo, al re-renderizar, segundos después de
  // escribirla. Pero tal como estaba no distinguía ese borrado del OTRO: el del médico
  // que borra la casilla a propósito. Corría en cada tick, sin límite de tiempo ni de
  // veces, así que rellenaba la casilla una y otra vez a espaldas del profesional —
  // exactamente lo contrario de la regla sagrada del proyecto.
  //
  // La diferencia entre los dos borrados es CUÁNDO y CUÁNTAS VECES: el de Everest ocurre
  // en el re-render inmediato y no se repite; el del médico llega más tarde y, si se le
  // pisa, insiste. Por eso la guarda ahora vive 20 s y tiene cupo de 2 restauraciones.
  // Pasado cualquiera de los dos límites se apaga PARA SIEMPRE en este paciente: el
  // médico gana el desempate, que es como tiene que ser.
  const RAC_GUARDIA_VENTANA_MS = 20000;
  const RAC_GUARDIA_MAX_RESTAURACIONES = 2;
  function checkRacGuardia() {
      if (!_racGuardia.activa) return;
      const docId = (typeof extractPacienteAbierto === "function") ? extractPacienteAbierto() : "";
      if (docId !== _racGuardia.docId) { _racGuardia.activa = false; return; }
      // El reloj se mira ANTES de tocar el DOM: pasada la ventana, la guarda no tiene
      // nada que hacer aquí aunque la casilla esté vacía.
      if ((Date.now() - (_racGuardia.ts || 0)) > RAC_GUARDIA_VENTANA_MS) {
          _racGuardia.activa = false;
          return;
      }
      const el = _findLabField("resultadoRelacionAlbuminaCreatinina", ["resultadoRAC"]);
      if (!el) return;
      const val = String(el.value == null ? "" : el.value).trim();
      if (val === "") {
          if ((_racGuardia.restauraciones || 0) >= RAC_GUARDIA_MAX_RESTAURACIONES) {
              // Ya se restauró el cupo entero y la casilla volvió a quedar vacía: eso ya
              // no parece un re-render, parece una persona borrando. Se cede.
              _racGuardia.activa = false;
              console.warn("[Vigilante] RAC: la casilla se vació de nuevo tras " + RAC_GUARDIA_MAX_RESTAURACIONES + " restauraciones. Se deja como el médico la dejó y no se vuelve a tocar.");
              uxTrack("rac.guardia.cede");
              return;
          }
          _racGuardia.restauraciones = (_racGuardia.restauraciones || 0) + 1;
          setNgValue(el, _racGuardia.valor);
          console.warn("[Vigilante] RAC vacía, restaurando valor del robot (" + _racGuardia.restauraciones + "/" + RAC_GUARDIA_MAX_RESTAURACIONES + "). Si la borra otra vez, se respeta.");
          uxTrack("rac.restaurada");
      } else if (val !== String(_racGuardia.valor).trim()) {
          _racGuardia.activa = false;
      }
  }

  // Recordatorio: si a la hora configurada todavía no hay PyM cargado, avisa (una vez al día).
  function pymReminderCheck() {
    try {
      if (!state.leader || !S.recordatorio || state.pymFile) return;
      const parts = String(S.recordatorio).split(":"), h = parseInt(parts[0], 10), m = parseInt(parts[1] || "0", 10);
      if (!isFinite(h)) return;
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + (isFinite(m) ? m : 0)) return;
      if (localStorage.getItem("vgl_rem") === todayStamp()) return;
      localStorage.setItem("vgl_rem", todayStamp());
      notify("AMBAR", "📋 Falta el PyM de hoy", "Todavía no se ha cargado el archivo de actividades PyM.\nPulsa «Abrir PyM» en el panel del Vigilante y elige el archivo del día.", false, "rem|" + todayStamp());
      playTone("AMBAR");
    } catch (e) {}
  }

  // v7.4.1: avisa UNA vez cuando Tampermonkey acaba de instalar una versión nueva del
  // Gist — así el personal sabe que el auto-update funcionó de verdad, sin tener que
  // fijarse en el numerito de versión del panel. Compara contra la última versión que
  // ESTE equipo vio arrancar; si cambió, es que se acaba de actualizar. La primera vez
  // que se instala el script (no hay versión anterior guardada) NO avisa — para eso ya
  // está el saludo "Vigilante activo" que sale una vez al día.
  function avisarSiActualizado() {
    try {
      const anterior = GM_getValue("vgl_last_ver", "");
      const cambio = anterior !== VERSION;
      if (anterior && cambio) {
        notify("AZUL", "✅ Vigilante actualizado", `Ya tienes la última versión (v${VERSION}).`, false, "verupd|" + VERSION);
      }
      if (cambio) {
        GM_setValue("vgl_last_ver", VERSION);
        GM_setValue("vgl_ver_desde", todayStamp()); // reinicia el contador de "desde cuándo" cada vez que SÍ hay una actualización real
      }
    } catch (e) {}
  }
  // v7.5: recordatorio (NO alarma) si pasa MUCHO tiempo sin ver una versión nueva — es
  // una pista de que el auto-update pudo quedar roto (Gist borrado, URL cambiada,
  // permiso de Tampermonkey revocado), pero perfectamente normal si nada cambió. Avisa
  // como máximo 1 vez al mes para no fastidiar.
  function chequearAutoUpdateLento() {
    try {
      const hoy = todayStamp();
      if (!GM_getValue("vgl_ver_desde", "")) { GM_setValue("vgl_ver_desde", hoy); return; }
      const desde = GM_getValue("vgl_ver_desde", hoy);
      const dias = Math.floor((new Date(hoy) - new Date(desde)) / 86400000);
      if (dias < 60) return;
      const ultimoAviso = GM_getValue("vgl_ver_aviso", "");
      if (ultimoAviso && Math.floor((new Date(hoy) - new Date(ultimoAviso)) / 86400000) < 30) return;
      GM_setValue("vgl_ver_aviso", hoy);
      notify("AZUL", "🔄 Recordatorio de actualización",
        `Llevas ${dias} días en la v${VERSION} sin ver una versión nueva.\nSi esperabas una y no llegó, revisa Tampermonkey → Panel de control → menú → «Check for userscript updates».`,
        false, "verold|" + hoy);
    } catch (e) {}
  }

  // =====================================================================
  //  RED DE SEGURIDAD REMOTA, KILL-SWITCH Y CANARIO (R5.1, R5.3)
  // =====================================================================
  function emergencyTeardown(reason) {
    state.killed = true;
    state.killReason = reason || "Apagado remoto de emergencia";
    if (typeof GM_setValue !== "undefined") {
      GM_setValue("vgl_kill_active", true);
      GM_setValue("vgl_kill_reason", state.killReason);
    }
    if (Array.isArray(state.timers)) {
      state.timers.forEach((t) => {
        try { clearTimeout(t); } catch (e) {}
        try { clearInterval(t); } catch (e) {}
      });
      state.timers.length = 0;
    }
    try {
      const root = document.getElementById("vgl-root");
      if (root) root.remove();
      const dock = document.getElementById("vgl-dock");
      if (dock) dock.remove();
      const accDock = document.getElementById("vgl-acciones-dock");
      if (accDock) accDock.remove();
      const banner = document.getElementById("vgl-pym-banner");
      if (banner) banner.remove();
      if (document.querySelectorAll) {
        const injected = document.querySelectorAll("[id^='vgl-']");
        injected.forEach((el) => { try { el.remove(); } catch (e) {} });
      }
    } catch (e) {}
    _mostrarAvisoPausaClinica(state.killReason);
  }

  function _mostrarAvisoPausaClinica(motivo) {
    try {
      if (typeof document === "undefined" || !document.body) return;
      let aviso = document.getElementById("vgl-pausa-clinica");
      if (aviso) aviso.remove();
      aviso = document.createElement("div");
      aviso.id = "vgl-pausa-clinica";
      aviso.style.cssText = "position:fixed;top:10px;right:10px;z-index:2147483647;background:#991b1b;color:#fff;padding:12px 18px;border-radius:12px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.5);";
      const texto = "🛡️ Pausa de seguridad remota activa: " + (motivo || "Asistente clínico desactivado remotamente para proteger la historia clínica.");
      const span = document.createElement("span");
      span.textContent = texto;
      aviso.appendChild(span);
      document.body.appendChild(aviso);
    } catch (e) {}
  }

  // --- Detección de Instancia Duplicada de Tampermonkey (R5.8) ---
  function _detectarInstanciaDuplicada() {
    try {
      if (typeof window === "undefined") return false;

      // 1. Detección por variable global de ventana
      const inst = window.__VGL_ACTIVE_INSTANCE__;
      if (inst && inst.id && inst.id !== TABID) {
        state.isDuplicateInstance = true;
        state.duplicateVersion = inst.version || "desconocida";
        console.warn("[Vigilante] Se detectó otra instancia activa de Vigilante de Agenda (v" + state.duplicateVersion + "). Esta instancia (v" + VERSION + ") aborta su inicio para evitar duplicidad.");
        _mostrarAvisoInstanciaDuplicada(state.duplicateVersion, VERSION);
        return true;
      }

      // 2. Detección por marcador en el DOM
      if (typeof document !== "undefined" && document.documentElement) {
        const domInst = document.documentElement.getAttribute("data-vgl-instance");
        const domVer = document.documentElement.getAttribute("data-vgl-version") || "";
        if (domInst && domInst !== TABID) {
          state.isDuplicateInstance = true;
          state.duplicateVersion = domVer || "desconocida";
          console.warn("[Vigilante] Se detectó instancia duplicada por marcador en DOM (v" + state.duplicateVersion + "). Abortando inicio.");
          _mostrarAvisoInstanciaDuplicada(state.duplicateVersion, VERSION);
          return true;
        }
      }

      // Registrar la instancia activa actual
      window.__VGL_ACTIVE_INSTANCE__ = { version: VERSION, id: TABID, ts: Date.now() };
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.setAttribute("data-vgl-instance", TABID);
        document.documentElement.setAttribute("data-vgl-version", VERSION);
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function _mostrarAvisoInstanciaDuplicada(verActiva, verDuplicada) {
    try {
      if (typeof document === "undefined" || !document.body) return;
      if (document.getElementById("vgl-instancia-duplicada")) return;

      const aviso = document.createElement("div");
      aviso.id = "vgl-instancia-duplicada";
      aviso.setAttribute("role", "alert");
      aviso.setAttribute("aria-live", "assertive");
      aviso.style.cssText = "position:fixed;top:15px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#78350f;color:#fef3c7 !important;border:2px solid #f59e0b;padding:14px 20px;border-radius:10px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:500;line-height:1.5;box-shadow:0 10px 25px rgba(0,0,0,0.6);max-width:650px;display:flex;align-items:center;gap:14px;";

      const span = document.createElement("span");
      span.style.cssText = "color:#fef3c7 !important;";
      span.textContent = "⚠️ Atención: Se detectaron dos copias de Vigilante de Agenda activas en este navegador (v" + (verActiva || "previa") + " y v" + (verDuplicada || VERSION) + "). Para evitar alertas repetidas o lentitud, abra la extensión Tampermonkey y desactive la versión antigua.";
      aviso.appendChild(span);

      const btn = document.createElement("button");
      btn.textContent = "Entendido";
      btn.setAttribute("aria-label", "Cerrar advertencia de copia duplicada");
      btn.style.cssText = "background:#f59e0b;color:#78350f !important;border:none;padding:6px 12px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0;";
      btn.onclick = () => { try { aviso.remove(); } catch (e) {} };
      aviso.appendChild(btn);

      document.body.appendChild(aviso);
    } catch (e) {}
  }

  // v7.8.1: chequea versión mínima requerida contra Google Apps Script público
  // Si la versión actual es menor y NO hay historia clínica abierta, fuerza reload + limpia caché
  function checkVersionMinimum() {
    try {
      if (state.killed) return;
      if (typeof GM_xmlhttpRequest === "undefined") return;
      if (Date.now() - (state.lastVersionCheck || 0) < 300000) return; // chequea max 1 vez cada 5 min
      state.lastVersionCheck = Date.now();

      if (!state.versionCheckUrl || state.versionCheckUrl.includes("YOUR_DEPLOYMENT_ID")) return;

      GM_xmlhttpRequest({
        method: "GET",
        url: state.versionCheckUrl,
        timeout: 5000,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            if (!data || typeof data !== "object") return;

            // 1. Evaluación de Kill-Switch remoto
            if (data.killSwitch && data.killSwitch.active) {
              const scope = data.killSwitch.scope || "all";
              const eqId = _equipoId();
              const aplica = scope === "all" || (Array.isArray(scope) && (scope.includes(eqId) || scope.includes("all")));
              if (aplica) {
                emergencyTeardown(data.killSwitch.reason || "Apagado remoto de emergencia");
                return;
              }
            }

            // 2. Evaluación de características desactivadas (Feature flags)
            if (data.killSwitch && Array.isArray(data.killSwitch.disabledFeatures)) {
              state.disabledFeatures = new Set(data.killSwitch.disabledFeatures);
            } else if (data.disabledFeatures && Array.isArray(data.disabledFeatures)) {
              state.disabledFeatures = new Set(data.disabledFeatures);
            }

            // 3. Evaluación de versión mínima requerida (con soporte canario)
            let minVer = String(data.minVersion || "").trim();
            if (data.canary && data.canary.enabled) {
              const eqId = _equipoId();
              const pct = typeof data.canary.percentage === "number" ? data.canary.percentage : 0;
              const allowed = Array.isArray(data.canary.allowedEquipos) && data.canary.allowedEquipos.includes(eqId);
              let hash = 0;
              for (let i = 0; i < eqId.length; i++) hash = ((hash << 5) - hash) + eqId.charCodeAt(i) | 0;
              const eqPct = Math.abs(hash) % 100;
              if (allowed || (pct > 0 && eqPct < pct)) {
                if (data.canary.minVersion) minVer = String(data.canary.minVersion).trim();
                if (Array.isArray(data.canary.enabledFeatures)) {
                  data.canary.enabledFeatures.forEach((f) => state.disabledFeatures.delete(f));
                }
              }
            }

            if (!minVer) return;

            // Comparar versiones: "14.1.6" vs "14.1.5"
            const parse = (v) => String(v).split(".").map(x => parseInt(x, 10) || 0);
            const [maj, min, pat] = parse(VERSION);
            const [minMaj, minMin, minPat] = parse(minVer);

            const needsUpdate = (minMaj > maj) || (minMaj === maj && minMin > min) ||
                                (minMaj === maj && minMin === min && minPat > pat);
            const forceReload = data.force === true || data.forceReload === true;

            if (needsUpdate || forceReload) {
              // v7.8.1: SOLO reload si NO hay historia clínica abierta (evita pérdida de datos)
              if (seccionActiva() === "historia") {
                setSummary(`📦 Actualización v${minVer} disponible — se aplicará cuando cierres la historia clínica`, "info");
                return;
              }
              const marca = "vgl_upd|" + minVer;
              try {
                if (sessionStorage.getItem(marca)) {
                  setSummary(`📦 Hay una versión nueva (v${minVer}). Actualízala desde el Menú de Tampermonkey → «Buscar actualizaciones del complemento».`, "warn");
                  return;
                }
                sessionStorage.setItem(marca, "1");
              } catch (e) {}
              try { localStorage.removeItem("vgl_pym_dia"); } catch (e) {}
              setSummary(`🔄 Vigilante se actualiza a v${minVer}...`, "info");
              setTimeout(() => location.reload(), 2000);
            }
          } catch (e) { console.error("[Vigilante] version check parse:", e); }
        },
        onerror: () => {},
        ontimeout: () => {}
      });
    } catch (e) { console.error("[Vigilante] checkVersionMinimum:", e); }
  }

  function boot() {
    try {
      const killActivo = (typeof GM_getValue !== "undefined" && GM_getValue("vgl_kill_active", false)) === true;
      const bypass = (typeof localStorage !== "undefined" && localStorage.getItem("vgl_override_kill") === "1") ||
                     (typeof location !== "undefined" && String(location.search || "").includes("vgl_bypass=1"));
      if (killActivo && !bypass) {
        state.killed = true;
        const motivo = (typeof GM_getValue !== "undefined" && GM_getValue("vgl_kill_reason", "")) || "Apagado remoto de emergencia";
        state.killReason = motivo;
        _mostrarAvisoPausaClinica(motivo);
        console.warn("[Vigilante] Inicio cancelado: Pausa de seguridad activa (" + motivo + ").");
        return;
      }
    } catch (e) {}

    if (_detectarInstanciaDuplicada()) return;
    if (document.getElementById("vgl-root")) return;
    purgeEventDays();                 // limpia bitácoras de más de 30 días (una sola vez)
    buildOverlay();
    applySettings();   // aplica tus ajustes guardados (tolerancia, refresco, tema, sonido…) y arranca el reloj
    avisarSiActualizado();
    const tAutoUpd = setTimeout(chequearAutoUpdateLento, 6000);
    heartbeat();
    tick();
    checkVersionMinimum();            // v7.8.1: chequea versión mínima cada 5 min
    const tVer = setInterval(checkVersionMinimum, 300000); // repite cada 5 minutos
    const tPaint = setInterval(paintMute, 15000);
    const tPymRem = setInterval(pymReminderCheck, 60000);
    // Reporte mínimo al tablero: el resumen de AYER (una vez) y el reintento de la
    // cola cada 10 min (sale de inmediato si no hay nada pendiente).
    const tRepSum = setTimeout(repDailySummary, 8000);
    const tRepFlush = setInterval(repFlush, 600000);
    // v12.5.0 — telemetría de uso del panel: la ventana pendiente de otro día sale al
    // arrancar (45 s, tras estabilizarse el liderazgo) y luego una fila agregada cada
    // 30 minutos. Solo la pestaña líder envía; el toggle vive en Ajustes (uxTelemetria).
    const tUxBoot = setTimeout(() => { try { uxBootCheck(); } catch (e) {} }, 45000);
    const tUxFlush = setInterval(() => { try { uxFlush(); } catch (e) {} }, UX_FLUSH_MS);
    // v12.6.9 — Errores y entorno. La caza de errores se engancha YA (un fallo temprano
    // es justo el que más falta hace ver); la fila de entorno sale a los 12 s, cuando la
    // pestaña ya se estabilizó, y solo una vez al día.
    _instalarCazaErrores();
    // v14.1.8 — Oyente pasivo de la tabla oficial de exámenes. Se engancha temprano por la
    // misma razón que la caza de errores: Everest pide esa tabla al ABRIR la Ruta
    // Crónicos, y si el oyente llega después, esa carga ya pasó y nos la perdimos.
    try { _instalarOyenteTablaOficial(); } catch (e) {}
    const tRepEnt = setTimeout(() => { try { repEntornoDiario(); } catch (e) {} }, 12000);
    if (Array.isArray(state.timers)) {
      state.timers.push(tAutoUpd, tVer, tPaint, tPymRem, tRepSum, tRepFlush, tUxBoot, tUxFlush, tRepEnt);
    }
    // PyM del día (v7.7): primero la caché de hoy. Si no hay, se intenta el PyM REAL
    // de hoy en SharePoint (primera opción); si aún no aparece, cae a la base piloto
    // mientras tanto (sus propios 3 reintentos espaciados). Pase lo que pase, sigue
    // revisando el diario cada 10 min — así en cuanto lo suban, reemplaza SOLO lo que
    // hubiera cargado (incluida la base piloto). «Abrir PyM» siempre puede reemplazar.
    // v7.8: DIFERIDO a un momento libre del navegador (requestIdleCallback) — la página
    // de Everest termina de cargar primero; el PyM se materializa por tandas después.
    idleRun(async () => {
      if (await loadPymFromCache()) return;
      if (heartbeat()) { const ok = await loadPymDiario(true).catch(() => false); if (!ok) schedulePymBase(); }
      else schedulePymBase();
    }, 4000);
    // v12.4.0 — BÚSQUEDA ACTIVA DEL DIARIO, CON PARADA. Cada 10 minutos, durante toda la
    // jornada, se busca el Agenda_Dia_CMB de HOY en SharePoint — pero SOLO mientras no
    // esté cargado (sin nada, con la base piloto de respaldo, o con el PyM de otro día).
    // El archivo lo suben en el transcurso de la mañana: mientras tanto manda la piloto,
    // y en cuanto el real aparece, loadPymDiario reemplaza TODO (applyPymIdx → panel
    // repintado con los datos nuevos) y esta re-búsqueda se detiene sola — pedido
    // explícito del consultorio (2026-08-11). Nota: la revisión "¿subieron una
    // corrección a mediodía?" de v7.8.1 se sacrifica a propósito con esta parada; si un
    // archivo cargado resulta equivocado, «Abrir PyM» manual sigue mandando siempre.
    setInterval(() => {
      if (!heartbeat()) return;
      if (debeBuscarPymDiario()) loadPymDiario(true);
      // v7.8.1: si después de todo esto sigue sin haber NADA cargado (ni PyM de hoy ni
      // piloto — p. ej. los 3 intentos del arranque se agotaron por una falla pasajera de
      // red a las 6 a.m.), se reintenta la piloto aquí. Sin esto, la promesa de "si no
      // está el de hoy, usa la piloto mientras tanto" solo regía los primeros ~4 minutos
      // de vida de la pestaña (hallazgo de la auditoría adversarial).
      if (!state.pymFile) loadPymBase(true);
      // Revisión de frescura de la PILOTO (máx. 1 vez por franja mañana/tarde; se
      // autolimita adentro, así que colgarla de este mismo intervalo no cuesta nada).
      pilotoFreshCheck();
    }, 10 * 60 * 1000);
    // Enganche del captador: si la base se capturó en la pestaña de SharePoint DESPUÉS
    // de arrancar Everest, se toma sola. Solo mira mientras no haya nada cargado; en
    // cuanto hay PyM, esta revisión no cuesta nada (sale de una).
    // v7.8: además, si aquí quedó la base PILOTO pero el captador ya consiguió el PyM
    // REAL de hoy, se adopta el real desde la caché compartida — sin depender de que la
    // descarga directa desde Everest (que pudo ser justo la que falló) lo reintente.
    setInterval(() => {
      try {
        if (!state.pymFile) { loadPymFromCache(); return; }
        if (state.pymFallback && typeof GM_getValue !== "undefined" &&
            GM_getValue("vgl_pym_dia", "") === todayStamp() && GM_getValue("vgl_pym_esfallback", "1") === "") {
          const raw = GM_getValue("vgl_pym", "");
          if (raw && raw.lastIndexOf('{"v":3', 0) === 0) {
            unpackPym(raw, makeYielder(15)).then((u) => {
              if (u && u.meta.date === todayStamp() && !u.meta.fb && state.pymFallback) {
                state.pym = u.map; state.pymTodos = u.todos; state.pymAbandono = u.abandono || new Set(); state.pymMTime = u.meta.mtime || ""; state.pymFP = u.meta.fp || ""; state.pymFallback = false;
                afterPymLoaded((u.meta.name || "PyM") + " (auto)", true);
                notify("AZUL", "📋 Ya llegó el PyM real de hoy", (u.meta.name || "PyM") + "\n" + state.pym.size + " paciente(s). Se reemplazó la base piloto.", false, "pymreal|" + todayStamp());
              }
            }).catch(() => {});
          }
        }
      } catch (e) {}
    }, 60000);
    console.log("[Vigilante] userscript v" + VERSION + " activo (MODO LIGERO: lectura de la página + PyM manual).");
  }

  // v7.3 MODO LIGERO: sin ganchos de red (no se envuelve fetch/XHR ni se clona
  // ninguna respuesta) y sin cosechador de SharePoint. Para la vía directa del API
  // solo se usa el OBSERVADOR DE RENDIMIENTO del propio navegador: una lista de URLs
  // que el navegador ya lleva de todos modos; costo prácticamente cero.
  if (/sharepoint\.com$/i.test(location.hostname)) {
    // En SharePoint SOLO corre el captador ligero de la base (y solo si falta la de hoy).
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { bootSharepointLite(); });
    else bootSharepointLite();
    return;
  }
  apiObservar(window); // document-start: aprende la llamada de la agenda en cuanto Everest la haga
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

})();
