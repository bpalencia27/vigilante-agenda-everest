# Registro de Novedades Clínicas — Vigilante de Agenda (Copiloto Everest PyM)

Bienvenido al registro de actualizaciones del **Vigilante de Agenda**. Este documento detalla las mejoras, correcciones y salvaguardas asistenciales incorporadas en cada versión para garantizar la seguridad de sus pacientes y agilizar su jornada de consulta médica.


## [Versión 17.6.2] — 2026-08-22 (Desenganches reales entre módulos, PyM↔Athenea antiduplicado y SMS real)

Banco: **2.297 comprobaciones en verde, cobertura 100 % (849/849)**, con **7 mutaciones
verificadas** (las cinco de la tanda de hoy + la del antiduplicado de productividad + la de
la fecha de HbA1c). Es la versión que
cierra la tanda de pedidos de hoy: los desenganches donde un módulo no consumía lo que
otro ya produjo, el cruce antiduplicado PyM↔Athenea para los Excel desactualizados, el
SMS que se anunciaba enviado cuando el proveedor lo rechazaba, el CUPS de citología, y el
sniffer de UsuarioId. Todas las fuentes citadas; nada inventado.

### 🔗 Desenganche Panel ↔ pre-consulta: el Panel ya no abre «sin laboratorios»

Reporte en vivo (22-ago): el Panel del paciente abría sin laboratorios aunque el robot de
pre-consulta ya los había traído — la telemetría del día confirma `LabsAutoPrefetched` con
84-448 resultados por paciente. Causa: `mtrCalcularResumenClinico` golpeaba Athenea EN
VIVO en cada apertura ignorando `_labsPrefetch`. Ahora se sirve primero de la pre-carga
fresca (mismo criterio que ya usaba el cruce RCV de PyM), y la bandera `{fresco:true}` —
el botón «🔄 Buscar laboratorios nuevos» y el guardado de la meta de HbA1c— salta la caché
a propósito: el clic del médico siempre consulta en vivo (regla v12.3.35).

### 🔗 Desenganche agendamiento: el aviso ya no dice «falta documentar» lo ya documentado

Reporte en vivo: la sugerencia de control avisaba que faltaban Hipertensión, Diabetes y
Tabaquismo cuando esas casillas ya estaban llenas. Causa: `_agmAvisarSiFaltaDocumentar`
leía solo la pantalla de la pestaña actual. Ahora fusiona con la memoria del resumen
clínico cacheado (`mtrFactoresConMemoria`): lo que el médico dejó en pantalla manda, y la memoria solo puede afirmar
lo que ya consolidó — nunca escribe un «No» aplanado de un resumen viejo como evidencia.

### 📱 SMS: el criterio de éxito real (la captura del 2026-08-10 manda)

Los pacientes reportaban que el recordatorio no les llegaba, y el botón «Enviar mensaje»
parecía muerto. Dos causas: (1) solo se validaba el estado HTTP 2xx — un 200 con
`error:true` en el cuerpo (rechazo del proveedor) se anunciaba como enviado; (2) el
feedback del botón se escribía en `#vgl-postcita-mailnota`, un id inexistente desde
v17.1.0. Corregido: `error:false` explícito en el cuerpo (como en la captura real) para
cantar éxito, y el botón ahora escribe en `#vgl-postcita-smsnota`.

### 🧪 PyM ↔ Athenea: cuando el Excel de PyM está desactualizado, Athenea manda

El problema de fondo que usted describió: la base piloto y el XLSX de SharePoint a veces
no están al día, así que un paciente puede aparecer como si no se hubiera hecho un examen
de PyM cuando sí. Ahora el modal de órdenes consulta Athenea para todo paquete con
`vigenciaDias` confirmada — antes solo el RCV (I10X) — y, si encuentra el examen hecho
dentro de la vigencia, **desmarca la opción de ordenar y lo avisa** con el detalle. En la
duda (red caída, sin resultado, fecha ilegible) devuelve falso: un falso «hágalo» solo
cuesta un clic; un falso «ya está hecho» le quitaría al paciente un examen que necesita.
Vigencias fijadas por usted: **VIH = 1 año** (365 días, Z113) y **SOMF = 2 años** (730
días, Z121, tamizaje de colon de la RPMS). El CUPS de citología del paquete Z124 pasó de
898001 a **898015** (pedido suyo del 22-ago).

### 🛰 Sniffer de identidad: ConfirmarTicket/FinalizarTicket de Digiturno

El UsuarioId del médico (515) aparece en las rutas `ConfirmarTicket`/`FinalizarTicket` de
`ApiIntegracionEverestDigiturno`, a diferencia de `/api/Turno` (que es de otro usuario y
sigue fuera de la lista blanca). El raspado nunca pisa un id ya fijado.

### 🩸 Auto-Labs: la FECHA de la HbA1c ya se autocompleta

Reporte en vivo (22-ago): el valor de la HbA1c se llenaba pero la fecha quedaba en blanco,
mientras los demás analitos sí la llenaban. La ruta HBA1C solo buscaba la fecha HERMANA
dentro del `.input-group` del resultado y, si Everest la monta separada, quedaba en blanco
sin intentar el id-por-convención `fechaResultHBA1C` (el respaldo que los demás
analitos usan desde v12.3.31). Corregido con el mismo respaldo.

### 🔢 Productividad: el doble conteo (10 → 20) en el Resumen del turno

Reporte en vivo: «atendí a 10 y el Resumen dice 20». La clave de la cita sin documento
usaba la POSICIÓN de la fila (`nombre#idx|hora`), y esa posición difiere entre las dos
fuentes de la agenda (la lectura automática y el respaldo por pantalla): cuando el
documento no se pudo leer en una de las dos, la misma cita caía en
dos claves y se contaba dos veces. Ahora el fallback es `nombre|hora` (sin posición) y el
registro mantiene un mapa `porNombreHora` que cuelga la identidad estable al mismo hueco
venga de donde venga. El subconteo del caso límite (dos citas idénticas sin documento) es
preferible al doble conteo masivo.

### 🧪 Banner de «Labs primero»: la nota ya no contradice la fecha

Reporte en vivo: con exámenes vencidos, el piso de 14 días cede y la toma se adelanta al
primer cupo hábil — pero el banner seguía diciendo «la toma queda 14–21 días antes».
Verificado con el motor real: hoy sábado 22-ago → toma lunes 24 → control lunes 31
(primer cupo hábil + 7 días, regla CERO VENCIDOS). La nota ahora explica el adelanto
cuando el piso cedió, en vez de repetir el texto genérico que confundía.

Banco: **2.272 comprobaciones en verde, cobertura 100 % (846/846)**, con **5 mutaciones
verificadas** sobre el defecto clínico y las pruebas nuevas de esta versión.

Esta versión no nace de un pedido suyo — nace de que, apenas entregada v17.6.0, usted
pidió una auditoría de producción de verdad sobre ese mismo entregable: varios agentes
independientes revisando en paralelo (datos clínicos, pruebas reales, privacidad/PHI,
seguridad de código, empaquetado) y cada hallazgo verificado por un segundo agente
tratando de refutarlo antes de darlo por bueno. De 16 hallazgos, los 16 sobrevivieron esa
verificación adversarial. Se lo cuento completo, sin recortar la parte incómoda, porque
es lo que este proyecto le debe.

### 🩺 El defecto clínico real: la fila de HbA1c se le mostraba también a pacientes SIN diabetes

v17.6.0 corrigió tres eslabones rotos que impedían que el valor REAL de HbA1c llegara
hasta la fila de "Metas terapéuticas" del Panel. Lo que no se vio en ese momento: una vez
que el valor llegaba, la fila nunca comprobaba si el paciente **es diabético**. El resto
del motor sí lo exige —`mtrFueraDeMeta` y `mtrPlanFallas` llevan tiempo negándose a
evaluar una meta de HbA1c fuera de diabetes— pero `mtrTableroClinico` (quien arma los
datos para el Panel) nunca exponía ese dato hacia la fila, así que `mtrPanelMetasHtml`
no tenía cómo aplicarlo. Resultado: un paciente sin diabetes al que alguna vez se le midió
HbA1c por otro motivo podía ver una meta y una etiqueta de "fuera de meta" que no le
correspondían — exactamente el tipo de señal que invita a pedir un examen sin indicación
real. Corregido en los dos puntos (`mtrTableroClinico` ahora expone si el paciente es
diabético; `mtrPanelMetasHtml` ahora lo exige antes de pintar la fila), con una prueba
nueva y mutación verificada.

### 🔍 Sobre el ítem 2: la cita a "v16.7.0 — Auditoría #14" no se sostuvo

En v17.6.0 le dije que las tres claves señaladas por `MEJORAS_PENDIENTES_20260822.md`
(`dislipidemia`, `antecedenteFamiliarPrematuro`, `ercPrevia`) eran "alias de lectura
dejados a propósito, de una corrección que ya se hizo en v16.7.0 (Auditoría #14)". La
auditoría revisó esa cita contra el CHANGELOG real de v16.7.0 —no aparece— y contra el
propio `MEJORAS_PENDIENTES_20260822.md`, escrito DESPUÉS de v16.7.0, que seguía listando
esto como abierto y sin dueño. La cita no se sostiene, y se lo corrijo aquí en vez de
dejarla escrita: no sé decirle hoy cuándo exactamente se agregaron las claves reales
(`dislipidemiaDocumentada`, `ecvAterescleroticaEstablecida`, `hxfamEcvPrematura`,
`enfermedadRenalDocumentada`) a la lista blanca que arma la hoja de hechos para la IA; lo
que sí verifiqué de nuevo, y ahora con una prueba dedicada que antes no existía, es que
esas cuatro SÍ son las que el resto del archivo escribe y SÍ llegan a la hoja cuando están
documentadas. Las claves viejas —tres que ya señalaba `MEJORAS_PENDIENTES_20260822.md`,
más una cuarta (`ecvEstablecida`) que verifiqué por mi cuenta y también está muerta— se
retiraron de la lista en vez de quedar como alias sin sustento: una búsqueda en las
~32.000 líneas del archivo confirma que ninguna de las cuatro se escribe jamás como
propiedad de un objeto de factores, así que retirarlas no cambia nada en tiempo de
ejecución.

### 🔒 Su nombre real iba mucho más allá de lo que le dije en v17.6.0

Esta es la parte que más le debo con franqueza. En v17.6.0 escribí que "una búsqueda
completa del repositorio confirma cero menciones restantes" de su nombre. Esa búsqueda
fue una búsqueda de texto por su primer nombre solamente, sensible a mayúsculas — se le
escapó absolutamente todo lo demás. Lo que apareció al buscar de verdad:

- **Su apellido real, usado como dato funcional** en `RCV_DOCTORS` (la lista que marca
  automáticamente sus citas y las de algunos colegas como Programa Especial/RCV). Se lo
  pregunté directamente y usted eligió *"dejarlo como está, resolvemos después"* — así
  queda en esta versión, sin tocar, por su propia instrucción y no por descuido.
- **El nombre completo real de una colega**, en un comentario de configuración interna
  sin ningún efecto en el comportamiento del script. Retirado.
- **Un número de teléfono real**, cableado en dos puntos del código como destinatario de
  SMS de prueba. Retirado.
- **Una identidad de prueba completa** (nombre de pila + su apellido real, y también su
  usuario de acceso) usada como médico/paciente de muestra en varios archivos de
  pruebas — la más extendida de todas, con más de una docena de apariciones. Se
  reemplazó por un nombre e identificador claramente ficticios en todo lo que era
  gratuito (pruebas de identidad de sesión, de coincidencia difusa de texto, de
  kill-switch — ninguna necesitaba SU nombre en particular). Se dejó exactamente donde
  probar el comportamiento real exige que la identidad esté en `RCV_DOCTORS` — dos
  pruebas unitarias que verifican el checkbox/flags de RCV, y el servidor simulado que
  usan las pruebas end-to-end de Playwright (con la prueba que verifica esas mismas
  reglas de RCV) — por la misma razón que `RCV_DOCTORS`: tocarlo hoy habría significado
  resolver, a mi criterio y sin preguntarle, la misma decisión que usted pidió dejar para
  después. Las pruebas end-to-end, además, no pude correrlas en este entorno para
  verificar un cambio ahí (dependen de Windows) — otra razón más para no tocarlas a
  ciegas.
- **Caché de Python compilada** (`.pyc`) que arrastraba su nombre real desde el código
  fuente hacia archivos binarios. Borrada — se regenera sola, y no hacía falta
  conservarla.
- **Datos reales de pacientes** en cuatro capturas de red (`.har`) de una sesión real de
  depuración contra el portal de laboratorios Athenea. Nunca viajaron hacia usted —ya
  estaban excluidos del paquete de entrega desde antes de esta auditoría— pero seguían
  sueltos en este entorno de trabajo. Se movieron a una carpeta con nombre explícito
  (`_CUARENTENA_PHI_PACIENTES_REALES/`), sin borrarlas: no me correspondía decidir borrar
  datos de pacientes por usted. Ese entorno es una copia de trabajo separada de su
  computador — si esas mismas capturas existen también allá, valdría la pena revisarlas
  con el mismo criterio.
- **No existía un `.gitignore`** en esta copia de trabajo. Se agregó uno que excluye
  `__pycache__/`, `*.pyc` y `*.har`, para que este tipo de descuido tenga una barrera
  automática en vez de depender de que alguien se acuerde cada vez.

De paso, y sin relación con lo anterior: `docs/SECRETOS_EXPUESTOS.md` sigue documentando
la rotación pendiente de las credenciales del portal Athenea (SEC-01) como **no
resuelta**. No es parte de esta auditoría ni de este código — es una acción suya en el
servidor de Athenea — pero se lo recuerdo aquí para que no se pierda entre tantos
hallazgos.

### 🧪 Tres huecos de cobertura en la meta de HbA1c editable (ítem 3 de v17.6.0)

La auditoría señaló que la prueba de punta a punta del campo editable de HbA1c (v17.6.0)
probaba un valor cómodamente inválido (20 %) y uno válido cualquiera (7,6 %), pero nunca
tres casos más filosos:

- **Los bordes EXACTOS de la validación** (5 % y 12 %, que el código acepta por ser
  `>=`/`<=` inclusive) — nunca se habían probado exactos, solo por dentro y por fuera del
  rango.
- **Reabrir el editor para un paciente que YA tiene una meta individual guardada** — el
  campo debe arrancar en esa meta, no en la general (7 %). La precedencia era correcta;
  ahora está probada.
- **Un payload con forma de XSS** (`<img src=x onerror=alert(1)>`) en vez de solo números
  fuera de rango — se rechaza por la misma puerta que cualquier valor no numérico
  (`mtrFloat` lo descarta) y jamás queda reflejado, ni crudo ni escapado, en ningún punto
  del modal.

Los tres eran comportamiento correcto sin prueba que lo demostrara — quedan las tres
pruebas, con sus mutaciones verificadas (detalle en `tests/INFORME_MUTACIONES.md`).

### 🛡️ Un blindaje sin vulnerabilidad real detrás

`x.estado` era el único campo de esa misma fila de metas sin pasar por `escapeHtml(...)`,
mientras sus cinco vecinos sí. Se corrigió por consistencia, aunque hoy no había forma
real de explotarlo: ese campo solo puede valer "nd"/"ok"/"falla", fijados por el propio
código dos funciones más arriba — nunca texto que pueda llegar de afuera.
`tests/INFORME_MUTACIONES.md` explica por qué, a propósito, este es el único cambio de
esta versión sin una mutación verificada: no hay forma honesta de romper algo que no
depende de ninguna entrada real.

## [Versión 17.6.0] — 2026-08-22 (La meta individual de HbA1c — y una fila del Panel que llevaba apagada desde que se escribió)

Banco: **2.266 comprobaciones en verde, cobertura 100 % (846/846)**, con **12 mutaciones
verificadas** sobre las cuatro mejoras de esta versión.

### 🎯 La meta de HbA1c ya se puede fijar por paciente — y salió a la luz que la fila entera llevaba apagada

El cimiento quedó listo en v16.4.0, con la promesa de que "el campo editable por paciente en la Ficha llega en la próxima versión" — y no había llegado. Ya está: en la fila de HbA1c de «Metas terapéuticas» (Panel del paciente, sección Riesgo y función renal), un lápiz ✏️ abre un campo para fijar la meta individual (5–12 %, con el mismo control de rango que ya usan los demás campos editables). El caso que usted señaló —el paciente de 85 años con 7,6 %— ya se puede marcar dentro de su propia meta en vez de compararlo contra el 7,0 % general.

Al cablear ese campo necesité mostrar también el valor REAL de HbA1c junto a la meta — y ahí aparecieron dos hallazgos que no esperaba, y que le debo con el mismo detalle que el resto de esta bitácora. La fila de HbA1c en «Metas terapéuticas», y la alerta de «fuera de meta» que depende del mismo dato, llevaban **completamente apagadas desde que se escribieron** (la fila desde v17.0.0, la alerta desde v16.4.0) — por tres fallas independientes y sucesivas en la misma cadena de datos:

1. El adaptador que arma el resumen con lo que Athenea ya trajo nunca leía el valor crudo de HbA1c del laboratorio — sí leía RAC, colesterol y LDL, dos líneas más arriba en el mismo código.
2. Aunque lo leyera, el motor clínico nunca copiaba ese valor a un campo propio del resumen: viajaba escondido dentro de otro cálculo interno, nunca hacia el Panel.
3. Aunque los dos anteriores estuvieran bien, la reclasificación EN VIVO —la que corre cada vez que el Panel se abre con la caché tibia, y cada 20 segundos mientras sigue abierto— reconstruye el resumen sin pasar por los dos pasos anteriores, y tampoco llevaba el dato: el mismo patrón de «campo que se pierde al reclasificar en vivo» que ya se había encontrado y corregido con otros datos en v17.0.1/v17.0.2.

Las tres fallas quedan corregidas, y seis de las doce mutaciones de esta versión son solo para probar que cada una realmente se cazaba antes de darla por cerrada — detalle completo en `tests/INFORME_MUTACIONES.md`.

### 🩺 La bandera «Educación indicada» ya llega a la nota con IA

Un error de tipo, no una decisión pendiente suya: la nota clínica redactada con IA leía la bandera de educación (alarmas, dieta, actividad) con `Array.isArray(...)` — y esa bandera siempre ha sido un objeto, nunca un arreglo, así que la comprobación daba falso siempre. Resultado: la señal para reforzarle al paciente dieta, actividad física o signos de alarma nunca llegaba a la redacción, en ninguna nota, desde que existe esta bandera. Corregida en los dos sitios que la leían —la hoja de hechos que ve la IA y el JSON que arma el prompt— ya viaja.

### ⏱️ Los relojes de frescura, un paso más cerca de uno solo

De los cinco relojes que deciden cuándo un dato se considera viejo, tres suben a un plazo más largo: medicamentos pasa de 5 a 10 minutos, el resumen clínico de 20 a 10, y la tabla oficial de la IPS de 30 a 10. Laboratorios, órdenes, signos vitales y datos demográficos ya compartían 10 minutos desde antes —con esto, cuatro de los cinco quedan en el mismo número. El quinto, la caché de pre-consulta a 6 horas, se deja aparte a propósito: existe para sobrevivir el tiempo ENTRE consultas, no dentro de una.

### 🧪 El corte de cosecha de exámenes sube de 25 % a 33 %

La idea —adelantar a la misma toma un examen vigente si le queda poco margen por delante, para ahorrarle al paciente un viaje meses después— ya estaba construida; el número exacto quedó pendiente de la entrevista del 20-ago. Con el corte en 33 %, un examen que antes se hubiera diferido para la próxima cita ahora se adelanta con un poco más de margen por delante.

### 🔍 Sobre el ítem 2 de la lista del 22-ago (la «hoja de hechos»): revisado, y no se tocó

La lista le señalaba tres claves —`dislipidemia`, `antecedenteFamiliarPrematuro`, `ercPrevia`— como posibles sobras de un clasificador anterior, sin dueño en ningún otro punto del archivo. Al volver a mirarlo con calma antes de tocar nada, resultó ser un diagnóstico mío ya superado: las tres son alias de lectura, dejados ahí a propósito, de una corrección que ya se hizo en v16.7.0 (Auditoría #14) — las claves REALES (`dislipidemiaDocumentada`, `ecvAterescleroticaEstablecida`, `hxfamEcvPrematura`, `enfermedadRenalDocumentada`) ya están en la misma lista y ya se leen bien; los tres nombres viejos se conservan solo por si una caché de antes de esa versión todavía los trajera. No había nada que corregir, así que no se tocó nada — se lo cuento para que la lista del 22-ago no le quede como una promesa sin cumplir.

### 🔒 Aparte, no es clínico: un nombre que no debía estar en el código

Una revisión de rutina de todo el repositorio encontró su nombre de pila en texto plano, en un comentario de v14.2.0 (17-ago) y en un puñado de comentarios y mensajes de prueba de esta misma semana. Ninguno tocaba datos de pacientes ni el comportamiento del script —eran solo comentarios para quien lee el código— pero la regla de este proyecto es que su nombre real nunca quede escrito ahí, con lo que se reemplazaron todos por una referencia genérica («el médico»). Una búsqueda completa del repositorio confirma cero menciones restantes.

## [Versión 17.5.0] — 2026-08-22 (El Panel del paciente ya no se abre a medias — y el agendamiento avisa lo mismo, sin cerrarle la puerta)

Banco: **2.253 comprobaciones en verde, cobertura 100 % (845/845)**, con **4 mutaciones
verificadas** sobre la lógica nueva.

### 🔒 El botón «Panel del paciente» se bloquea hasta que haya con qué abrirlo

Usted lo pidió sin rodeos: que el botón quedara deshabilitado —no solo advertido— mientras
el asistente no hubiera recopilado lo mínimo (hipertensión, diabetes y tabaquismo
documentados, y el resumen clínico ya calculado) para que sus cinco secciones tuvieran
sentido. Así queda:

- Mientras falte algo, el botón se ve bloqueado y dice por qué: «🔒 aún falta documentar…»
  con el factor exacto y su pestaña, o «⏳ recopilando…» si lo único pendiente es la
  consulta de laboratorios que corre sola en segundo plano.
- Junto al botón aparece un atajo «📍 Ir a [pestaña]» por cada pestaña con algo pendiente —
  un clic lo lleva directo a Antecedentes o a Hábitos y Gestión de Riesgo, sin tener que
  adivinar dónde documentarlo.
- Apenas usted lo documenta (o el resumen automático termina), el botón se habilita solo,
  sin recargar nada — sensible a los cambios, como usted mismo lo planteó.

### 🤖 El resumen clínico ya no espera su clic para empezar

El botón deshabilitado creaba un candado sin llave: antes, la única forma de calcular el
resumen clínico era pulsando el propio botón que ahora empieza bloqueado. Para que el Panel
pudiera llegar a abrirse solo, la consulta a Athenea/laboratorios ahora se dispara sola, una
vez por paciente, apenas se abre su historia — es una lectura, nunca una escritura, con el
mismo resguardo de "una vez por paciente" que ya usa el Robot Athenea. El costo que usted
aceptó a sabiendas: Athenea se consulta en cada apertura de historia, no solo cuando pulsaba
el botón.

### ⚠️ El mismo aviso, ahora también en la sugerencia de fecha del agendamiento — sin bloquear nada

Tal como pidió: "de ahí extiendo el mismo aviso al agendamiento". A diferencia del Panel,
agendar una cita nunca debe quedar imposibilitado por un dato que falta — así que aquí es un
AVISO, no un candado. Cuando la fecha sugerida se apoya en un paciente con hipertensión,
diabetes o tabaquismo sin documentar, el banner de la sugerencia suma una línea ámbar que
dice exactamente qué falta, sin ocultar ni bloquear la fecha propuesta.

## [Versión 17.4.0] — 2026-08-22 (Modelos de IA al día y una nota clínica más segura de leer)

Banco: **2.242 comprobaciones en verde, cobertura 100 % (842/842)**.

### 🤖 La rotación de Gemini, cotejada contra su cuenta real

Usted nos mandó el pantallazo del panel de límites de Google AI Studio con los modelos y
cupos reales de su cuenta. Comparamos uno por uno contra la lista que ya traía el asistente
y sumamos los dos que tenían cupo real y le faltaban: **gemini-2.5-flash-lite** y
**gemini-3-flash**. Quedan afuera, a propósito, los que su cuenta muestra en 0 solicitudes
(gemini-2-flash, gemini-2-flash-lite, gemini-2.5-pro, gemini-3.1-pro) y **gemini-2.5-flash**,
que sigue retirado por Google así el panel todavía le muestre una fila con cupo. Con esto la
rotación pasa de 5 a 7 modelos: más respaldo para los momentos en que varios están saturados
a la vez, como el que su propia captura mostraba hoy con gemini-3.5-flash.

### ✍️ Análisis y Plan: el ajuste de dosis renal ya no se diluye en la prosa, y la evolución dice en qué

Dos mejoras al prompt que redacta la nota clínica completa, a partir de lo que usted nos
señaló al revisar el prompt hermano (el de la consola interactiva /meds /labs /ok):

- **Ajuste de dosis, primero y aparte:** cuando el motor trae un ajuste de dosis por función
  renal, la nota ahora lo abre con su propio bloque — «AJUSTE DE DOSIS POR FUNCIÓN RENAL:» y
  un renglón por cada medicamento (dosis actual, dosis sugerida, motivo, TFG usada) — antes
  de cualquier otro contenido del plan farmacológico. Un aviso de seguridad no debería
  competir por atención con el resto de la prosa.
- **La evolución ya tiene que decir en qué:** antes bastaba con «evolución vs. el control
  previo»; ahora la instrucción exige nombrar el cambio concreto en los campos que sí traiga
  el JSON o lo anotado (función renal, RAC, perfil lipídico, glicemia/HbA1c si hay diabetes,
  ajustes farmacológicos) — nunca «evolución favorable» sin decir de qué.

### 🔎 Nota sobre el prompt de la consola interactiva que usted nos compartió

Ese prompt (el de /meds, /labs, /fecha, /add, /evolucion, /ok) es una versión anterior —
v67 del Motor RCV — del mismo linaje que ya evolucionó en el script hasta la v68 y hoy genera
la nota de una sola vez, sin consola de comandos: fue una decisión suya, tomada en la
entrevista del 20-ago, para que usted editara el resultado directamente en vez de conversar
con la IA paso a paso. Lo que sí tenía de valioso ese prompt —el ajuste de dosis destacado,
la evolución con cambios nombrados— ya quedó incorporado arriba.

## [Versión 17.3.1] — 2026-08-22 (El azul de Everest, la capa que faltaba)

Banco: **2.242 comprobaciones en verde, cobertura 100 % (842/842)**, con **4 mutaciones
verificadas** y las reglas de color nuevas medidas en Chromium real, en los dos temas.

### 🎨 El azul de Everest ya no se cuela en los checkbox de Agendar ni en «Mi estilo»

Usted insistió en que el azul se seguía colando en el mismo modal de confirmación de la
cita, después de instalar la corrección de hace unas horas — y tenía razón en una parte que
esa corrección no alcanzó a cubrir. La v17.3.0 blindó el RÓTULO «¿Es cita para actividades
del programa RCV / Prevención?», pero no el texto que va DENTRO de él: un `<span>` suelto
que hereda su color, y que Everest intercepta directo, sin que le llegue a importar de qué
color esté blindado el rótulo que lo envuelve. Al revisar esto a fondo aparecieron dos casos
más con el mismo defecto, uno de ellos más viejo de lo que parecía: la etiqueta «Mi estilo»
del panel de Redacción con IA, que se reportó por primera vez hace dos días y que, según se
confirmó ahora midiendo colores reales en el navegador, nunca había quedado resuelta del
todo — y el texto «🧪 Agendar también la Toma de Muestras» de la tarjeta de plan unificado de
Agendar, que nadie había reportado todavía. Los tres quedan corregidos juntos.

### 🔎 Nota sobre lo que ya se le entregó hoy

Si usted sigue viendo el azul de Everest en pantallazos de HACE UNAS HORAS, es esperable:
la consola de esas capturas mostraba `userscript v17.2.0 activo` — la corrección de hoy
(v17.3.0, y ahora esta) no estaba instalada todavía en ese momento. Con este archivo puesto,
tanto lo reportado ayer como esta capa adicional quedan cubiertos.

## [Versión 17.3.0] — 2026-08-22 (Cuatro correcciones del mismo reporte de campo)

Banco: **2.242 comprobaciones en verde, cobertura 100 % (842/842)**, con **4 mutaciones
verificadas** y la única regla de color nueva medida en Chromium real, en los dos temas.

### 🔧 Un error silencioso menos en la consola al Generar con IA

No le impedía usar el asistente ni le escondía el borrador — el texto siempre quedó bien
puesto en la casilla —, pero cada vez que «Generar» terminaba con éxito, en cualquiera de
los tres modos, quedaba detrás un error sin capturar en la consola del navegador
(`_frenoMarcaOk is not defined`). Era una llamada a una función que nunca llegó a existir en
el archivo. Se retiró; el resto del flujo (el borrador en la salida, el aviso de "listo") no
se tocó porque ya corría antes de esa línea.

### 🎨 El azul de Everest ya no se cuela en Agendar, Ordenar ni Laboratorios

Con sus dos pantallazos: en el resumen de la cita a asignar, el rótulo y el aviso de
prevención cardiovascular salían en el azul marino de Everest en vez del color propio del
asistente. Estos tres módulos habían quedado por fuera de los barridos anteriores contra
este mismo problema (Ficha/Tablero/Panel y Redacción IA ya lo tenían resuelto). Quedan
blindados ahora — **cada uno conservando su propio color** (Agendar azul, Ordenar morado,
Laboratorios verde, como ya estaba decidido), no un único color parejo para los tres. De
regalo, se corrigió también un defecto aparte que no tenía que ver con Everest: en tema
claro, el rótulo de Ordenar salía azul en lugar de morado por una casualidad de dos reglas
empatadas — ya sale morado en los dos temas.

### 🔄 La redacción con IA ya no se queda pegada a un modelo caído

En la consola real aparecían modelos de Gemini respondiendo 404 (retirados por Google) y
400/503 (sobrecarga o cambios del lado de ellos), y el asistente no reconocía esas
respuestas como motivo para probar el siguiente modelo de la lista — se quedaba
insistiéndole al mismo modelo caído. Ahora un 400, 404, 500, 502 o 504 se trata igual que la
cuota agotada o la saturación: rota al siguiente modelo automáticamente, y solo le avisa a
usted si TODOS los modelos configurados fallan.

### 📝 Enfermedad Actual deja de admitir laboratorios y clasificación de riesgo

Al revisar un borrador real, usted encontró una cifra de función renal y una clasificación
de riesgo cardiovascular metidas en Enfermedad Actual — dato que, por su propia convención
de historia clínica, no va ahí. La instrucción que recibe la IA para esa casilla ahora acota
las cifras a las tomadas EN LA CONSULTA DE HOY (signos vitales, automonitoreo) y excluye
explícitamente resultados de laboratorio/paraclínicos y la clasificación de riesgo o metas
terapéuticas. Ningún dato desaparece: ambos siguen disponibles para Análisis y Plan, que es
donde ya se interpretan.

## [Versión 17.2.0] — 2026-08-21 (#114 — la frecuencia real de los medicamentos)

Banco: **2.236 comprobaciones en verde, cobertura 100 % (841/841)**, con **9 mutaciones
verificadas** y la única regla de color nueva medida en Chromium real, en los dos temas.

### 💊 La frecuencia (c/12h, c/24h…) ya se muestra — encontrada, no inventada

Semanas pidiéndola y el problema nunca fue de programación: el endpoint que se usaba
hasta hoy (`CargarMedicamentosPaciente`) sencillamente nunca trajo ese dato, en ningún
campo. Sus grabaciones del 21-ago, con el grabador ya corregido, encontraron dónde vive
de verdad: el histórico de fórmulas de cada paciente (`HistoricoMedicamentoHCM`) sí trae
un número y una unidad por cada renglón — "cada 12 horas", "cada 1 día" — y ahora se lee,
se cruza con el nombre del medicamento vigente, y se muestra en las tres partes que usted
pidió:

- **En la Ficha y en la pestaña Medicamentos**: junto al nombre, entre paréntesis y en
  letra más tenue — «LOSARTAN 50 MG (cada 1 día)» — para que se lea como el dato
  secundario que es, sin competir con el nombre del fármaco.
- **En los avisos de seguridad por dosis renal**: cuando un fármaco dispara un aviso
  (por ejemplo, metformina con función renal baja), el mensaje ahora cita la frecuencia
  real con la que el paciente lo está tomando, no solo el nombre.
- **En la redacción con IA**: el texto que se arma para Conducta / Análisis y plan
  también trae la frecuencia, cuando el histórico la tuvo.

**Cuando el histórico no trae el dato para un fármaco puntual, ese fármaco se muestra
exactamente igual que siempre — sin paréntesis de más.** Es la misma regla de todo el
asistente: casilla vacía antes que dato inventado. Nunca se calcula ni se supone una
frecuencia; solo se muestra la que Everest ya tiene escrita en alguna parte.

### 🚫 Lo que a propósito NO lleva frecuencia: los avisos de interacción

Triple Whammy, doble bloqueo del SRAA, gemfibrozilo + estatina y el resto de avisos de
interacción citan una PAREJA de familias de medicamento — «IECA + ARA-II» — nunca un
fármaco puntual del paciente. Colgarles una frecuencia real exigiría adivinar cuál de los
dos (o tres) medicamentos de la pareja fue el que la disparó, y una frecuencia mal
atribuida en un aviso de seguridad es peor que no mostrar ninguna. Por eso esta entrega
deja esos avisos exactamente como estaban — sin frecuencia — mientras que los avisos de
dosis renal, que sí citan un medicamento puntual, sí la llevan. No es un olvido: quedó
puesto a prueba a propósito, para que un cambio futuro no lo rompa en silencio.

## [Versión 17.1.1] — 2026-08-21 (Los botones que se colaban de pestaña)

Corrección en caliente, reportada por usted mismo en pleno consultorio con pantallazos.

### 🔀 «Enfermedad actual» y «Auto-Labs» en Revisión por sistema; «Normalidad fija» en Ruta Crónicos

Cada botón vive en una pestaña — «Auto-Labs» solo en Ruta Crónicos, «Normalidad fija» solo en Examen físico, los de redacción solo en Anamnesis/Impresión Diagnóstica — pero los tres se estaban colando en la pestaña de al lado, y en Ruta Crónicos «Auto-Labs» directamente no salía.

- **La causa:** Everest tiene, en la misma pantalla, más de una barra de pestañas — la principal y, dentro de Ruta Crónicos, la de los programas (Síndrome Metabólico/Hipertensión/Diabetes/ERC), que también usa el mismo marcado. La forma de leer «cuál pestaña está abierta» buscaba la primera coincidencia en TODO el documento, así que a veces contestaba con la pestaña equivocada. Ahora se ancla primero por los ids ya confirmados de la barra principal y solo mira dentro de ella.
- **Segunda capa:** los conteos de respaldo (cuando la barra no se podía leer) contaban casillas por su identificador SIN mirar si de verdad estaban a la vista — y Everest no cierra la pestaña que usted deja de ver, solo la tapa por debajo. Ahora esos conteos ignoran lo que sigue montado por detrás y no está realmente a la vista.
- Verificado con mutación: se rompió cada corrección a propósito y las pruebas nuevas cayeron en rojo antes de restaurar.

### 🔬 #114 — la frecuencia SÍ existe, y ya sé en qué endpoint vive

Sus grabaciones (una vez corregido el propio grabador, que tampoco estaba trayendo el cuerpo de las respuestas) encontraron el dato que llevábamos semanas buscando: `HistoricoMedicamentoHCM` trae `frecuenciaNumero` + `frecuenciaUnidad` estructurados, algo que `CargarMedicamentosPaciente` (el único endpoint que se había mirado hasta hoy) nunca tuvo. Queda para la próxima entrega: falta acordar CÓMO se muestra antes de tocar el motor de medicamentos, que es código de seguridad clínica y no se apura.

## [Versión 17.1.0] — 2026-08-21 (Toda la cola, más tres hallazgos que salieron de sus propios datos)

Los trece pendientes acordados, construidos de una pasada, más lo que apareció al revisar la telemetría, la bitácora y la auditoría que usted me mandó hoy. Banco: **2.210 comprobaciones en verde, cobertura 100 % (833/833)**, con **17 mutaciones verificadas** y las reglas de color medidas en Chromium real.

### 🔢 Los «38 A TIEMPO» con 21 citas: eran tres errores a la vez

Usted lo vio y tenía razón. Su propia auditoría lo probaba: la cabecera del CSV decía «Ingresos a tiempo;38» y el cuerpo traía **18 filas para 14 citas distintas**.

- **El contador no contaba solo llegadas a tiempo.** Había tres sitios que lo subían, y dos no tenían nada que ver con puntualidad: **asignar una cita** y **generar las órdenes de PyM**. Alguien lo usó como marcador de éxito genérico. Retirados los dos: lo que cuentan ya viaja con su propio nombre en la telemetría de uso.
- **La misma cita se contaba varias veces.** Los indicadores contaban *transiciones*, no citas, y la clave se re-armaba en cuanto la fila se leía un tick con otro estado. Cuatro pacientes suyos salieron dos veces, a 13 s, 6 min, 15 min y 16 min. Ahora se cuenta **una cita, un color, una vez**, con la marca compartida entre pestañas — igual que Productividad, que por eso sí le dio 15/18 correcto en la misma pantalla.
- **Y la misma cita tenía dos identidades.** El API escribe la hora «7:00 a. m.» y el raspado de la pantalla «07:00 AM»: dos claves para una cita, que rompían a la vez las cuatro protecciones que dependen de ella. La hora entra canonizada.
- El banco tiene ahora una prueba de **conciliación**: el número de la cabecera del CSV tiene que ser igual al número de filas del cuerpo. Es la que habría cazado esto el primer día.

### 💊 Medicamentos: las fórmulas postfechadas dejan de ser una alarma

- **La duplicidad terapéutica ya no salta por una fórmula postfechada.** En Everest es normal que una sola orden genere dos o tres renglones (dispensación escalonada) — usted lo confirmó — y también que el mismo fármaco se renueve en varios controles. Nada de eso es que el paciente tome dos medicamentos. El falso positivo además viajaba al **archivo permanente del paciente** en su carpeta.
- **La duplicidad real sigue alertando igual**: dos moléculas del mismo grupo, y dos concentraciones del mismo principio (50 mg y 100 mg). Eso no se toca.
- **La pestaña Medicamentos deja de repetir cada fármaco.** Mostraba la lista cruda mientras el Resumen, dos pestañas más allá, decía «(3)» ya agrupado. Ahora las dos vistas cuentan lo mismo, y se dice cuántos renglones se agruparon — esconderlos sin avisar sería mentir por omisión.
- **La frecuencia (c/12h) todavía no se puede mostrar.** Verifiqué la respuesta real de Everest: **no existe ningún campo de frecuencia**. Lo único parecido es un número de un dígito cuya etiqueta en pantalla no he podido confirmar, y traducirlo sería inventar. Usted eligió capturar primero la pantalla de formulación con el GRABADOR; queda pendiente de esa captura.

### 📈 El semáforo de Tendencias ya tiene ROJO

Lo esperaba y nunca salía: el sentido clínico era binario (mejora/empeora) y el CSS solo tenía dos colores. Con su decisión del 21-ago:

- **Rojo si cualquiera de las dos cosas ocurre**: el salto contra el control anterior es de **25 % o más** en el sentido malo, **o** el valor quedó fuera de meta grave. El 25 % no es un número nuevo: es el mismo que el asistente ya usa para sospecha de injuria renal y remisión a nefrología.
- **Meta grave** = meta + 30 %, el corte que el propio motor ya llamaba «falla grave»: LDL según su categoría de riesgo, triglicéridos sobre 150, HbA1c sobre su meta, y **RAC ≥300** (macroalbuminuria, el número que ya dispara la remisión).
- Para los siete analitos que el asistente **no** sabe juzgar —hemoglobina, PTH, fósforo, albúmina, colesterol total, HDL y glicemia— el corte lo pone **el rango de referencia que manda el propio laboratorio con cada resultado**. Ese rango ya llegaba y se descartaba. Si no viene, esos analitos se quedan en verde/ámbar/gris: **no se inventa un umbral**.
- Cada fila roja dice **por qué** lo es. Y de paso, HbA1c, PTH, Fósforo, Albúmina y Hemoglobina dejan de salir en MAYÚSCULA PELADA.

### 🧪 Laboratorios: la fecha del uroanálisis, y el 50 % de fallo que no era

- **La fecha y el resultado estaban atados.** Son dos casillas independientes con dos identificadores distintos, pero si faltaba la de resultado, el asistente se iba sin ni siquiera buscar la de fecha. Y es exactamente el caso del uroanálisis, cuyo resultado no se escribe nunca a propósito. Es la causa del bug que usted lleva versiones reportando.
- **El reintento se cancelaba solo al segundo clic.** Exigía haber marcado él mismo el interruptor SI/NO; si usted ya lo había marcado a mano, o si era el segundo Auto-Labs del día sobre ese paciente, no corría.
- **Y el fallo era mudo.** El asistente sabía qué resultados no había podido escribir y no lo decía en ninguna parte. Ahora se lo dice.
- **El «50 % de fallo» del panel era un espejismo.** Dos laboratorios distintos —Annar y Citi— compartían contador y se piden siempre en pareja: Annar responde bien y **Citi responde 404 el 100 % de las veces**. Contadores separados, y Citi se apaga solo tras el primer 404 en vez de gastar una petición por paciente.
- **Pero sí había un fallo real:** las solicitudes de Athenea se lanzaban **todas a la vez, sin tope**. La consola de su consultorio ya lo había registrado («8 solicitudes» → «Error: Timeout»). Ahora van de tres en tres.

### ⚡ Rendimiento: un punto y coma que apagaba la mitad del modo rendimiento

- **`transition:none !important` no llevaba punto y coma**, así que el navegador descartaba la transición y **se tragaba entera la regla de sombras**. Desde la v15.5.0 el modo rendimiento apagaba la mitad de lo que prometía: 185 sombras y 63 transiciones seguían vivas en los siete módulos que cuelgan por fuera. Un carácter, verificado leyendo el CSS real del navegador.
- **El registro de productividad reescribía el disco 12 veces por minuto** para guardar exactamente lo mismo. Ahora solo si cambió: 43 → 31 escrituras por minuto.
- **La bitácora releía y reprocesaba 64 KB en cada línea** (0,68 ms de media, picos de 16,7). Ahora vive en memoria: 0,20 ms.
- **Y una honesta:** medí el asistente completo en Chromium con 21 tarjetas: **36 ms de hilo principal por minuto, 0,06 %, cero tareas largas**. Los 12.803 eventos de lentitud que marcaba el panel **no eran suyos**, y eso lleva a la sección siguiente.

### 📡 La telemetría ahora dice de quién es cada milisegundo

- **El medidor de rendimiento no preguntaba quién causaba la tarea.** Escuchaba todas las del navegador, así que le facturaba al asistente cada ciclo de Angular y cada tabla de Everest. Un dato que no se puede atribuir es peor que no tenerlo: manda a arreglar lo que no está roto.
- Ahora usa **LoAF** (la API que reemplazó a la vieja precisamente por esto), que entrega el origen y la duración de **cada script** del cuadro. Todo lleva dueño en el nombre: **nuestro** o **de la página**. Y hay un número que antes no existía: cuánto consume nuestro código **dentro de un cuadro ajeno**.
- Las interacciones lentas se atribuyen por el elemento que usted tocó. Y en un navegador sin LoAF, **todo se marca como de la página**: sin atribución no se afirma que algo sea nuestro.
- **El tope de errores pasa de 5 al día a 40 fallas DISTINTAS.** No es el mismo número: antes cinco repeticiones del mismo error agotaban el cupo y el sexto defecto —otro, quizá el grave— no llegaba nunca. Ahora las repeticiones no gastan cupo y viajan agregadas.
- **El saneador borraba el número de línea.** Elimina tiras de 5 a 12 dígitos para proteger cédulas, y el archivo tiene más de 30.000 líneas: `...user.js:12668` llegaba como `...user.js:`. Dos tercios del archivo entregaban el «detalle» sin detalle.
- Y la cola de salida descartaba en silencio las filas de error al desbordarse, porque son siempre las más viejas. Tope de 30 → 80, con orden de sacrificio explícito: primero las métricas de uso, los errores nunca.

### 🖨 Volver al recordatorio de una cita ya asignada

Su reporte de hoy: *«ya le asigné la cita y quiero regresar al módulo para imprimirle el recordatorio, pero ya solamente aparece el de agendar labs»*. Era cierto — y cuando ya estaban las dos cosas, el botón quedaba gris e inerte.

- Ese botón muerto se convierte en uno vivo: **🖨 Recordatorio**. Un control gris es una promesa de que no hay nada que hacer, y aquí sí lo hay.
- Mientras falte el laboratorio **conviven los dos botones**, cada uno con una sola acción.
- El panel ofrece **imprimir**, **reenviar el mensaje al celular**, **los datos de la cita** y **cancelarla**. «Enviar al correo» se retira: nunca funcionó —falta capturar la llamada real de Everest— y un botón que solo puede avisar de que le falta configuración es ruido en la ventana donde usted está cerrando la cita.
- Al cancelar, si hay toma de muestras agendada **se le pregunta qué hacer con ella** en vez de decidir por usted.

### ✍️ Los botones de redacción, cada uno junto a su casilla

- Usted los pidió los dos en «Impresión Diagnóstica». Verificado contra la pantalla real capturada en su consultorio: **ahí solo existe una casilla de texto libre** («Análisis y Plan»); *Enfermedad actual* vive en Anamnesis. Se lo consulté y eligió que cada botón viva en su casilla real, para que ninguno prometa llenar algo que no está en pantalla.
- Al pulsar se abre el borrador **para que usted lo lea y lo edite antes de insertarlo**. «El médico manda, el script sugiere» no se negocia por ahorrar un clic.
- Si la casilla no está medible en pantalla, el botón **no se pinta**. Nada de una esquina fija de reserva.

### 🧹 Y lo demás de la cola

- **«Ruta Crónicos» sale del redactor de verdad.** La v16.7.0 le quitó el chip pero dejó el modo vivo por dentro: por eso el asistente todavía le anunciaba «→ Siguiente: Análisis y seguimiento» de una casilla que ya no está. Lo que usted escriba ahí a mano **se sigue leyendo como contexto**.
- **El TDZ de los chips muertos (#110) ya estaba corregido desde la v16.7.0** — usted tiene instalada la v16.6.1. Barrí el archivo entero buscando otro: cero. Y el panel de seguimiento lo confirma: **cinco filas de ese error, todas de v16.6.2001, ninguna de v17**.
- **Auto-Labs se calla cuando no hay nada nuevo que escribir.** Solo habla el botón, en ámbar y sin visto bueno — igual que ya hacía «Normalidad fija». Y no repite el aviso para el mismo paciente. Además, si el apagado remoto bloqueó la escritura, ya no se pinta como «✓ 0 casillas escritas» en verde.
- **El acordeón «Ver N analitos»** del uroanálisis pasa a ser código probable: tuvo el HTML y el CSS listos trece versiones sin clic enganchado y ninguna prueba lo notó.
- **El azul de Everest en el Panel**: los tres encabezados que usted señaló **no estaban fugando** —salen en nuestro propio azul, medido en Chromium contra el CSS real de Athenea—. Las que sí fugaban eran las dos líneas pegadas a ellos: *«Faltan N dato(s). El asistente NO los inventa»* y el pie *«El resumen muestra lo LEÍDO, nunca lo supuesto»*. Justamente las dos frases que declaran la honestidad del módulo.
- **El aviso «Paciente confirmó a tiempo» ya no le sale repetido en otras pestañas.** Cuando una pestaña recupera el mando de la vigilancia, se pone al día con lo que las otras ya avisaron. Ese ponerse al día existía desde la v16.2.4, pero **solo ocurría si esa misma vuelta traía citas a la vista** — y fuera de «Citas del día» no las trae. Así que el mando se tomaba sin sincronizar, y como eso pasa una sola vez por relevo, ya no volvía a intentarlo: se reavisaba todo lo que la otra pestaña ya había avisado.
- **El piso de 14 días de labs-primero ya cede** cuando el vencimiento lo hace imposible, incluido el examen que **ya venció** — que era, hasta hoy, el caso más urgente y el único que seguía esperando dos semanas. La regla ya existía escrita y probada en el motor; esta era la copia que se quedó sin ella.

## [Versión 17.0.4] — 2026-08-21 (Guardar en Ajustes se comporta como cualquier programa)

### 💾 «Guardar cambios» no confirmaba nada y dejaba la ventana abierta

Usted lo describió exacto: *«cuando le doy Guardar cambios no da ningún mensaje de confirmación y no se cierra la ventana de Ajustes como lo haría normalmente cualquier programa»*. Las dos mitades eran ciertas y tenían la misma raíz. Al guardar, lo único que cambiaba a la vista era que la barra «Tiene cambios sin guardar» desaparecía — una **ausencia**, no una confirmación — y la ventana se quedaba abierta, idéntica a como estaba antes de pulsar: sin ninguna señal de que algo hubiera pasado. El cartel verde de confirmación sí se emitía (lo comprobé), pero sale en la esquina **superior derecha** de la pantalla, al otro extremo de donde está el botón, y se cierra solo a los 9 segundos: mirando el botón que acaba de pulsar, uno no lo ve pasar.

Ahora Guardar hace lo que hace cualquier programa — **aplica y cierra** —, que es la confirmación que de verdad se lee, y el cartel verde queda como refuerzo. Es además lo que este mismo módulo ya hacía por el otro camino desde hace versiones: si usted cerraba Ajustes con cambios pendientes, el botón «💾 Guardar y salir» guardaba **y cerraba**. Los dos caminos vuelven a comportarse igual.

> Nota de banco: la prueba que existía llamaba a la función de guardar **directamente**, así que verificaba que el ajuste se aplica y se persiste, pero nunca tocaba el botón real ni miraba qué ve el médico al pulsarlo — que es justo donde estaba el defecto. La prueba nueva entra por el botón, como usted.


## [Versión 17.0.3] — 2026-08-21 (Reportes en vivo de hoy: el congelamiento, el SMS y Auto-Labs pegado)

Tres reportes suyos de hoy mismo, en plena consulta. Banco: **2.153 comprobaciones en verde, cobertura 100 % (817/817)**.

### 🥶 El congelamiento del agendamiento — "toca apagarlo a la fuerza"

Cuando un paciente tiene exámenes vencidos o por vencer, el asistente busca solo, en segundo plano, el primer día con cupos reales de laboratorio dentro de la ventana de 14–21 días — hasta 8 consultas seguidas a Everest. Esa búsqueda era la única de todo el módulo que **no se podía cancelar**: si usted elegía un plazo, un día o entraba al calendario manual mientras la búsqueda seguía en el aire, la ronda vieja igual aplicaba su resultado al volver — repintando el control Y la toma, cada uno con su propio barrido de red, encima de lo que usted ya estaba mirando. De ahí las dos fechas marcadas a la vez, y de ahí que con varios clics seguidos la acumulación de consultas superpuestas terminara congelando el navegador. Ahora esa búsqueda lleva la misma protección que ya tenían sus hermanas (un token de vigencia): en cuanto usted elige algo, cualquier ronda vieja que responda después se reconoce a sí misma como obsoleta y no toca nada.

### 📵 El resumen de la cita mostraba un celular distinto al que usted acababa de escribir

En el paso 3 ("Resumen de la cita a asignar"), la línea "Notificación SMS: …" se pintaba una sola vez al entrar a ese paso. Si usted corregía el celular ahí mismo — sin salir y volver a entrar — la línea de arriba se quedaba con el número viejo mientras la casilla de abajo ya tenía el suyo: los dos números distintos, a la vista al mismo tiempo, que usted reportó. Ahora esa línea se actualiza sola con cada tecla. Revisé además los dos únicos sitios del código que de verdad envían el SMS (el automático al confirmar la cita, y el de "reenviar recordatorio" desde el panel de post-cita): ambos leen el celular de la pantalla en el momento exacto del envío, no uno guardado antes — así que no debieran estar mandándolo al número equivocado. Les agregué registro de diagnóstico (queda el celular usado, en la consola) para poder confirmarlo con hechos si el síntoma vuelve a aparecer.

### 📍 «Auto-Labs» seguía apareciendo sobre la lista de Citas del día

Ya existía un remedio para esto desde la v16.1.0 (Everest no recarga la página al navegar, así que los botones inyectados en la historia de un paciente se quedaban colgados del body con su última visibilidad), pero ese remedio solo actuaba al salir del módulo clínico **por completo** — y "Citas del día" vive bajo la misma ruta que la Historia Clínica, así que volver de un paciente a la lista del día, lo más común de toda la jornada, se quedaba fuera de esa protección. Ahora también se recoge al volver a Citas del día, aunque la ruta siga siendo la del módulo clínico.


## [Versión 17.0.2] — 2026-08-21 (Segunda auditoría: el Panel no abría, y otros diecisiete)

La primera auditoría revisó la v17.0.0. Esta segunda revisó **el Panel y el minimizar**, que nunca se habían mirado, y **verificó mis propios arreglos de la v17.0.1** — de los que tres estaban incompletos. Banco: **2.118 comprobaciones en verde, cobertura 100 % (814/814)**.

### 🚨 El Panel no abría en pacientes con sospecha de infección urinaria

La pregunta de embarazo que añadí en la v16.9.0 se entregaba con nombres de campo distintos a los que el emergente que la muestra sabe leer. El error quedaba atrapado en un `try` y el módulo se rendía en silencio: **en toda mujer en edad fértil con parcial de orina sugestivo, pulsar «Panel del paciente» no hacía absolutamente nada**. Sin ventana, sin aviso, sin nada. Es el mismo síntoma que usted reportó el 20 de agosto («estos botones no funcionan»), reintroducido por mí en otro sitio. Ahora, además, si el emergente no se puede mostrar por lo que sea, el Panel abre igual en vez de quedarse mudo.

### 🚪 Callejones sin salida

- **«Decidir luego» y Escape** en el cuadro de discrepancias cerraban la ventana y no abrían el módulo. Volver a pulsar sacaba el mismo cuadro: parecía un bucle y dejaba el paciente sin Panel toda la sesión.
- **Se podía minimizar el emergente de antecedentes** — y al reabrirlo se destruían las respuestas Sí/No que usted ya había marcado. Justo la pérdida que el botón de minimizar existe para evitar. Los emergentes que piden una decisión ya no se minimizan.

### 👤 Minimizar podía mostrarle otro paciente

Las pastillas decían «▣ Panel del paciente», sin nombre: con dos pacientes en la jornada eran indistinguibles, y al pulsar una salía a pantalla completa el riesgo, la TFG y los medicamentos **del otro**, sobre el Everest del actual. Ahora la pastilla lleva el nombre y, si al restaurar la historia abierta ya es de otro paciente, se lo digo.

Y el reloj de vigilancia del Panel (cada 20 s) **seguía corriendo mientras el módulo estaba minimizado**, el resto de la jornada, reteniendo todo el resumen. Ahora un módulo escondido está dormido.

### 🔁 Tres arreglos míos de la v17.0.1 que estaban incompletos

- **El sábado volvía a perderse a los 20 segundos.** El arreglo se apoyaba en un campo que el motor no devuelve, así que la reclasificación del Panel lo borraba y se volvían a tachar todos los sábados. Ahora sobreviven también el uroanálisis y el embarazo confirmado, que se perdían igual.
- **La productividad podía contar el doble.** La hora viene escrita distinta según responda la agenda o el respaldo: un solo cambio de fuente a mitad de jornada duplicaba a todos los atendidos del día. Ahora la hora se normaliza siempre igual.
- **Quedaba una cuarta forma de borrar su historial**: un archivo que no se puede *leer* (permiso, disco) se tomaba por archivo nuevo y se sobrescribía. Ahora, si no puedo leerlo, no lo toco.

### 🩺 Y en lo clínico

- **La tendencia de cuatro analitos salía neutra**: PTH, fósforo, albúmina y hemoglobina no estaban en la tabla de sentido clínico. Una hemoglobina que se desploma de 13 a 8,2 se pintaba gris, igual que un analito estable, y sin la palabra «empeora».
- **La TFG previa se calculaba con la edad de hoy** — medio punto porcentual por año, suficiente para cruzar una frontera de estadio e inventar un deterioro. Y un cambio de estadio **ya no basta por sí solo**: 60,1 → 59,6 es medio mililitro, ruido de laboratorio, y disparaba la alerta roja con todo lo que arrastra. Ahora se exige una caída real.
- **«No se pudo leer la lista de medicamentos» dejó de escribirse como «no toma nada»** en su carpeta. Son cosas distintas y ahora se dicen distinto.
- **«Datos recién leídos» mentía** cuando la lectura había expirado: la etiqueta contaba hasta 20 minutos y se reiniciaba a lo más tranquilizador, justo en la línea que usted usa para decidir si se fía de los números.
- Los chips de día **seguían hablando del modelo de grupos de sábado retirado** («sábado del OTRO grupo»).


## [Versión 17.0.1] — 2026-08-21 (Auditoría de la v17.0.0: quince defectos, míos)

Después de entregar la v17.0.0 la sometí a una revisión adversarial completa. Encontró quince defectos reales en el código que yo acababa de escribir. **Actualice a esta versión antes de usar el llenado de antecedentes o la carpeta.** Banco: **2.110 comprobaciones en verde, cobertura 100 % (814/814)**.

### 🚨 Lo que podía afectar a un paciente

- **Cruce de pacientes al insertar notas.** El Panel reclasifica solo cada 20 segundos y guardaba el resultado sin la cédula del paciente. El redactor usa esa cédula como guarda antes de escribir en la historia: sin ella, **la guarda no llegaba ni a evaluarse**. Si usted abría el Panel, escribía algo en Everest y cambiaba de historia, la nota podía insertarse en la del paciente equivocado. Era el riesgo que se cerró en v14.1.5, reabierto sin querer.
- **«Sospecha de injuria renal» en pacientes que MEJORAN.** Bastaba con que cambiara el estadio, en cualquier dirección: de G2 a G1 —es decir, mejorando— salía la alerta roja, se acortaban todas las vigencias y el aviso viajaba a la nota de la IA. El defecto llevaba tiempo latente y lo activó la propia v17.0.0 al suministrar por fin el dato previo.
- **El «↩ Deshacer» del llenado no deshacía nada.** Usaba el mecanismo de las casillas de texto, que en un botón de opción no hace nada — y encima le corrompía el valor interno, dejando el campo ilegible para el asistente. El aviso decía «volvieron exactamente a como estaban». Era falso siempre. Además el botón quedaba **tapado** por el propio Panel: se le prometía un Deshacer que no se podía ni tocar.
- **Respuestas archivadas aunque no se escribieran.** Lo que usted contestaba en el emergente quedaba guardado como confirmado incluso si la casilla no se pudo escribir, o si Everest ya la tenía documentada **con el valor contrario**. Y esas confirmaciones mandan sobre lo leído en la historia: un dato invisible y sin auditoría decidiendo la clasificación de riesgo, en esa cita y en todas las siguientes.
- **El cuestionario podía salir con las casillas de otro paciente**: se leía la historia abierta sin comprobar de quién era.
- **La tensión arterial de otro paciente** podía entrar al cálculo de riesgo si usted cambiaba de historia mientras los laboratorios cargaban — y desde v17 eso quedaba escrito en el archivo del primero.

### 📁 Lo que podía perder su historial

- Si el respaldo de un archivo ilegible fallaba, **el archivo se reescribía igual**: años de controles borrados sin copia y sin un mensaje. Ahora, si no se puede respaldar, no se toca nada.
- El respaldo tenía **nombre fijo**, así que una segunda corrupción destruía la única copia buena. Ahora cada uno lleva su propio nombre y nunca se pisa uno anterior.
- Un archivo con otro formato se descartaba **sin respaldo**.
- Una lectura degradada (laboratorios caídos) **borraba la instantánea buena** del mismo día. Ahora solo se reemplaza si la nueva conserva al menos lo que había.
- Dos módulos guardando a la vez podían chocar y perder la instantánea en silencio. Ahora se serializan.
- Y si el guardado falla, **se lo digo** una vez al día en vez de callarlo.

### 🔧 Y además

- **La carpeta se apagaba en cada recarga** de Everest: el permiso no se guardaba. Ahora sobrevive.
- **La regla única de sábado quedó escrita y sin cablear** en la v16.9.0: seguía viajando el grupo deducido, que es nulo justo cuando la deducción sale en conflicto — su caso. El resultado era que a usted, que trabaja sábados, se le tachaban todos.
- **La productividad contaba mal**: leía un campo de hora que las citas no tienen, así que dos citas del mismo paciente el mismo día contaban como una, y sin documento legible la cita desaparecía del cálculo.
- **El dead-man estaba inerte** justo en el equipo que nunca logró hablar con el servidor.
- El mapeo Sí/No podía **tragarse su respuesta** en silencio, o escribir en un formulario invisible. Ahora, si no reconozco el par Sí/No, no escribo y se lo digo.
- La ventana de la injuria renal era de 365 días: llamar «agudo» a un cambio de hace once meses es un error de concepto. Son 180. Y un valor atípico en medio de la serie (una muestra diluida) ya no fabrica una caída que no existe.
- Las series de LDL mezclaban el directo con el calculado — dos escalas distintas — y de ahí podía salir un «basal» inválido.


## [Versión 17.0.0] — 2026-08-21 (Toda la cola, de una vez)

Lo que quedaba acordado y sin construir, completo. Banco: **2.093 comprobaciones en verde, cobertura 100 % (806/806)**.

### 🫘 La injuria renal por fin se puede detectar
- El asistente sabía la regla —una caída de ≥25 % de la TFG, o un salto de estadio, entre dos controles— pero **el dato del control anterior no se lo daba nadie**. Como con el LDL basal: la alerta existía escrita y era inalcanzable.
- Ahora la TFG previa se calcula desde la **penúltima creatinina** de Athenea (dentro del último año), y cuando hay caída se dice con números: «bajó de 70 a 35 desde el 1 de febrero», no un «hay sospecha» a secas. Se le pide confirmar con una creatinina de control **antes** de ajustar dosis por el valor de hoy.

### 🎯 Metas terapéuticas, LDL y HbA1c juntas
- Sección nueva en el Panel. La meta de HbA1c la calculaba el motor desde hace versiones y **no se mostraba en ninguna pantalla**. Ahora van las dos con el valor actual al lado y en verde o ámbar, porque «¿está en meta?» es la pregunta de la consulta.
- La de HbA1c solo aparece si el paciente tiene el examen: enseñar una meta a quien no tiene diabetes invita a pedirlo sin indicación.

### 💊 Duplicidad terapéutica
- Chequeo determinista, el que faltaba del par «interacciones y duplicidades»: **dos del mismo grupo** (dos ARA II, dos estatinas, dos sulfonilureas) con el riesgo concreto de cada caso. Es el error más fácil de cometer al arrastrar una fórmula y el más difícil de ver, porque los dos salen en renglones separados.
- IECA + ARA II no entra aquí (ya tiene su alerta de interacción) y la insulina basal + prandial tampoco: eso es el esquema correcto, no un error.

### 📊 Productividad, en el Resumen del turno
- Vistas **diaria, semanal y mensual**: atendidas de su agenda sobre la meta de **18** de lunes a viernes y **24** el sábado, con los **+3 de sobreagenda** contados aparte (21 y 27 citados).
- Su advertencia —«ojo con las duplicaciones»— es la que define el diseño: **no hay un contador que se incrementa**. Se guarda el conjunto de citas ya vistas como atendidas, así que la misma cita cuenta una vez aunque el asistente la vea cuarenta, con dos pestañas abiertas o tras recargar.
- Un día sin ninguna cita atendida **no suma meta en contra**: vacaciones o incapacidad no son un incumplimiento.

### 📁 La carpeta de historias en su computador
- Elige una carpeta **una vez** (Ajustes) y desde ahí el asistente guarda, en cada control, un **`<cédula>.json`** con todo lo que vio: laboratorios y sus series, función renal, riesgo, metas, medicamentos, plan, confirmaciones y la nota insertada. **Historial completo, sin borrar nada.**
- Todo se queda en su equipo. Nada de esto viaja por red.
- Si abre el Panel cuatro veces en una consulta, el control **sigue siendo uno** (se reemplaza, no se apila). Y si un archivo llegara ilegible, se conserva al lado como `.roto.json` en vez de pisarse.

### ✍️ La Enfermedad Actual arranca desde el control anterior
- Con carpeta elegida, el borrador se **ancla en el control pasado**: «venía con LDL en 130 y meta <70, con estos medicamentos». En crónicos el control de hoy es la continuación del anterior, no una hoja en blanco.
- Sin carpeta no hay ancla y **no se inventa una**. Un «control anterior» fabricado sería el peor error posible, porque suena a dato y no lo es.

### 📝 Faltan antecedentes → se los pregunto → los escribo yo
- La segunda mitad del patrón que usted definió para el Panel. Si hay casillas de antecedentes **en blanco** en la pantalla, se le preguntan una vez —con **«No sé»** como respuesta legítima— y el asistente las escribe en Everest. Después el Panel abre completo, ya con esos factores contando en la clasificación.
- Cuatro reglas que no se negocian: solo se escribe **lo que usted acaba de responder**; solo en casillas **vacías** (lo documentado no se pisa jamás); solo si la historia abierta sigue siendo la del **mismo paciente**; y siempre con **«↩ Deshacer»**.

### 🔒 Dead-man switch
- El apagado remoto solo sirve si el equipo **llega** al servidor de control. Un computador que deje de alcanzarlo quedaba corriendo sin supervisión y sin que nadie se enterara.
- Ahora, a los **7 días** sin contacto se avisa; a los **21**, el asistente deja de **escribir** en la historia clínica por su cuenta — y solo eso: la vigilancia de la agenda y los avisos siguen. Dejarlo a usted sin asistente por una falla de red sería peor que el riesgo que se cubre.
- Se incluye **`Codigo_propuesto.gs`**, el servidor de control listo para desplegar en Google Apps Script, con instrucciones y una función que lista **qué equipos llevan días sin preguntar** — que es la señal que de verdad importa.


## [Versión 16.9.0] — 2026-08-21 (Las reglas clínicas que usted decidió, por fin aplicadas)

Siete decisiones de las entrevistas del 20 de agosto que estaban acordadas y sin construir. Banco: **2.063 comprobaciones en verde, cobertura 100 % (770/770)**.

### 🫘 Discordancia entre las dos fórmulas renales: la alerta empieza en DOS estadios
- El aviso solo saltaba a partir de **tres** estadios de diferencia. Eso dejaba pasar en silencio el caso más frecuente y más peligroso: **G2 por Cockcroft-Gault contra G3b por CKD-EPI** en una paciente de bajo peso muscular — dos estadios, dosis renales calculadas sobre la fórmula equivocada y ninguna advertencia.
- A partir de **tres** ya no se le pide ajustar la conducta: se le pide **revisar el dato**. Una diferencia así rara vez es real, y lo que suele estar mal es el peso o la creatinina.

### 🩸 El LDL basal, por fin existe
- Sus metas de riesgo alto y muy alto tienen dos mitades: el número (<70, <55) **y** una reducción de ≥50 % desde el basal. La segunda **no la suministraba nadie**: el basal llegaba vacío, la reducción salía «no calculable» y el criterio era **inalcanzable por construcción** — un paciente por debajo de su meta se quedaba en «meta parcial» para siempre.
- Ahora el basal sale del histórico de Athenea, como usted decidió: **el más alto del último año**, y se muestra con su fecha para que lo compruebe. Sin histórico previo se dice **«no evaluable»**, que no es lo mismo que «no ha reducido».

### 📅 Toma 14–21 y control +7, iguales por todos los caminos
- La ventana de toma era **14–22** por un camino y **14–21** por otro: un día de diferencia, invisible en el código y visible en la consulta.
- El control se elegía «en algún punto entre 4 y 14 días». Ahora el objetivo es **+7**, y si ese día no se puede citar se corre al **más cercano a 7**, nunca por debajo de las 72 horas que pide la norma. Y se dice cuando se corrió, y por qué.
- El «Modo Estable» (citar lo más tarde posible) se retiró: era la última pieza que hacía que el mismo paciente saliera con dos fechas según por dónde se entrara.

### 📆 Sábados: una sola regla
- Se acabó el modelo de grupos 1-3 / 2-4. Con los datos reales de su equipo la deducción salía **«conflicto»** —usted trabaja sábados que el modelo dice que no le tocan— y el asistente le **tachaba sábados buenos**.
- Regla nueva, la que usted pidió: **si consta que trabaja sábados, los sábados se proponen**. Y el calendario quincenal muerto (anclado al 11 de julio de 2026) se eliminó: tener dos reglas de sábado, una de ellas sin usar, era una trampa esperando a que alguien llamara a la equivocada.

### 🇨🇴 Festivos: calculados, no copiados a mano
- La tabla se acababa en 2027. **En enero de 2028 el asistente habría citado tomas el 1 de enero sin decir nada.** Ahora los festivos se calculan con la Ley Emiliani y no caducan nunca.
- De paso apareció un error: la tabla ponía la Independencia de Cartagena de 2024 el **18** de noviembre cuando el **11** ya caía lunes. Un festivo mal puesto mueve una fecha de toma.
- El aviso de respaldo cambió de sentido: ya no dice «actualice la tabla», sino que **compara el cálculo con la referencia** y, si discrepan, le dice **qué día concreto** está en disputa.

### ⏱️ Agendar: ningún plazo viene marcado de fábrica
- El chip **«1 mes» nacía activo**, así que un plazo que nadie eligió parecía elegido. Ahora, si el asistente tiene datos del paciente marca el plazo que corresponde y lo explica; si no tiene con qué deducirlo, **la fila queda en blanco** y se lo pide. Un chip marcado es una recomendación, y recomendar sin datos es justamente lo que no se hace.

### 🤰 La pregunta de embarazo, solo donde cambia la conducta
- En embarazo la bacteriuria **se trata siempre**, con o sin síntomas — el motor ya lo sabía, pero el dato nunca le llegaba, así que esa rama era inalcanzable.
- Ahora se le pregunta **solo** cuando la respuesta cambia algo: **mujer en edad fértil con parcial de orina sugestivo**. La respuesta vale **30 días** y después se vuelve a preguntar.


## [Versión 16.8.0] — 2026-08-21 (El Panel del paciente: por fin, un solo módulo)

Lo que usted reclamó: **«no me sale el módulo unificado como te lo mandé a pedir»**. Aquí está. Banco: **2.042 comprobaciones en verde, cobertura 100 % (757/757)**.

### 🧾 Un módulo, cinco secciones
- La **Ficha** (lo que leí y de dónde) y **Riesgo y exámenes** (lo que concluyo) eran dos ventanas con dos botones, y para juzgar a un paciente había que abrir las dos y compararlas de memoria. Se acabó: ahora son **un solo Panel del paciente** con cinco secciones —**Resumen**, **Riesgo y función renal**, **Exámenes y vigencias**, **Tendencias** y **Medicamentos**— que se cambian con un clic.
- **Una sola lectura del paciente alimenta las cinco.** Pasar de una sección a otra **no cuesta ni una consulta**: todo estaba ya en la mano.
- En el dock queda **un solo botón, 🧾 Panel del paciente**. El de ❤️ Riesgo desapareció porque su contenido está adentro; los caminos que ya abrían el tablero (el agendamiento, por ejemplo) siguen funcionando y entran directo a esa sección.
- Se puede **minimizar** como todos los módulos: lo que estaba mirando sigue ahí cuando vuelve.

### 📈 Tendencias: por fin se ve hacia dónde va el paciente
- Sección nueva. Una HbA1c de 8,1 % no dice lo mismo si el control anterior fue 9,4 % que si fue 7,0 %, y hasta ahora el asistente solo le mostraba el último valor: **el histórico que Athenea ya había traído se tiraba a la basura**.
- Ahora cada analito muestra su serie de hasta seis controles, el cambio contra el anterior **con números**, y si eso es **mejorar o empeorar** — con el sentido clínico correcto: bajar la HbA1c mejora, bajar la TFG empeora.
- **Un cambio menor al 5 % se llama estable**: por debajo de eso, dos controles son el mismo control con otra tinta.
- Un analito con un solo control se nombra aparte, dicho tal cual: **«todavía sin tendencia»**. No se dibuja una línea con un punto.

### 💊 Medicamentos, en su propia sección
- Lo que el paciente está tomando según Everest, con las alertas de dosis renal e interacciones que el motor ya sabía calcular. Sin lista de medicamentos, lo dice y **no opina a ciegas**.


## [Versión 16.7.0] — 2026-08-20 (Los botones que no hacían nada, el azul de Everest y el freno de la IA)

Todo lo que usted reportó el 20 de agosto, más los arreglos pendientes de la auditoría. Banco: **2.029 comprobaciones en verde, cobertura 100 % (747/747)**.

### 🐞 Los chips del módulo de Redacción IA volvieron a funcionar
- «Estos botones no funcionan, no hacen nada». Tenía toda la razón: **cada clic en una casilla lanzaba un error** y no pasaba nada. Fue un fallo mío de la v16.6.0 — al añadir los borradores por casilla, una variable interna se llamó igual que el botón y lo tapaba. El error salía en su consola en cada clic; con su volcado se localizó en un minuto.
- **«Ruta Crónicos» eliminado del módulo**, como pidió. Quedan las tres casillas reales de la historia y el botón dice ahora **«Generar todo (3)»**.

### 🎨 Se coló otra vez el azul de Everest
- Blindados los textos del panel de Redacción IA y de sus cinco hermanos: el rótulo «Casilla de la historia», la etiqueta «Mi estilo», el «(opcional)» del botón de preguntar y los chips sin seleccionar. Se respetaron a propósito los colores que **significan** algo: el rojo del módulo de Riesgo y el azul del chip activo.

### ➖ Botón MINIMIZAR en todos los módulos
- Lo que pidió: **minimizar sin perder lo que ya llenó**. Cada módulo tiene ahora un «—» junto a la ✕. Al pulsarlo el módulo baja a una barra abajo a la izquierda y **el contenido queda intacto** —lo escrito, lo marcado, los borradores de IA— porque no se cierra nada: se esconde. Un clic en la pastilla y vuelve tal cual estaba.
- La ✕ de la pastilla sí descarta de verdad, y lo avisa.
- Se instala solo en todos los módulos, presentes y futuros.

### ❤️ El módulo «Riesgo y exámenes» ya abre siempre
- «Me sigue saliendo ese mensaje». El botón sacaba el aviso y **no abría nada**: en su equipo el módulo era inalcanzable. Cambió la regla: **el módulo abre siempre**. Cuando no he podido leer Antecedentes y Hábitos, lo que hago es **no opinar sobre el riesgo** —donde iría la categoría va un cartel que dice qué me falta— pero función renal, vigencias y exámenes por pedir se pintan igual, porque esos salen de los laboratorios y son válidos.

### 🛡️ Seguro contra las llamadas repetidas (lo que usted pidió)
- **Toda** petición del asistente que salga por la vía externa se une a la que ya va en camino en vez de duplicarla: dos clics seguidos = una sola llamada al servidor.
- En la Redacción IA, además, **freno de 20 segundos por casilla** tras cada generación buena. Si insiste (segundo clic en menos de 5 segundos tras el aviso) se entiende que es deliberado y se deja pasar: el freno es contra el desespero, no contra usted.

### 🔬 Uroanálisis: se acabaron los falsos negativos
- Los informes de laboratorio no escriben «positivo»: escriben **«++», «3+», «ESCASAS», «MODERADAS», «ABUNDANTES»**. El asistente solo entendía «+» y «positivo», así que un parcial con **esterasa ++ y 10-15 leucocitos por campo** —piuria de manual— salía como «SIN HALLAZGOS». Ya no.
- Los recuentos por rango («10-15 x campo», «> 50») se leen por su **tope**: perder una piuria cuesta una infección sin tratar.
- **«Escasas» y «trazas» no deciden nada** a propósito (bacterias escasas es el hallazgo inespecífico más común del parcial), pero quedan anotadas a la vista para que usted juzgue.
- Y cuando el informe trae la esterasa y el recuento en filas separadas, ya no se pisan: manda el nombre del analito, no el orden de llegada, y entre dos lecturas del mismo hallazgo se queda la más alarmante.

### 📋 Órdenes PyM: se acabó el «no se pudo» con órdenes ya creadas
- Si de tres órdenes se creaban dos y fallaba una, el asistente decía **«No se pudieron generar las órdenes»** — con dos órdenes ya existiendo en el sistema. Usted reintentaba y quedaban duplicadas.
- Ahora el parcial se dice con números: **«Se generaron 2 de 3»**, las creadas quedan marcadas como ordenadas y con su botón de imprimir, y el botón de arriba reintenta **solo las que faltaron**.

### 📡 Un fallo de red ya no se le presenta como un hecho
- **Laboratorio (AppCita):** si no contesta, ya no dice «ese día ya no quedan horarios». Dice que no se pudo consultar.
- **Agenda de Everest:** si no responde, ya no dice «no hay agendas abiertas ese día, pruebe con otro». Con la red caída usted descartaba día tras día y el paciente se iba sin cita.
- **Lista de prevención (SharePoint):** si no se pudo ni abrir la carpeta, ya no dice «aún no aparece la lista de hoy». Y el aviso de «llevo media hora sin poder revisar la carpeta», que por un descuido no salía nunca, ahora sí sale.

### 🔒 La vigilancia de fraude sobrevive al relevo de pestaña
- Si cerraba la pestaña líder, la que tomaba el relevo arrancaba **sin memoria**: un paciente que ya había pasado la tolerancia sin presentarse llegaba a sala y se pintaba verde «llegó a tiempo», y la evidencia para la reclamación se perdía. Ahora la vigilancia del día se comparte entre pestañas.


## [Versión 16.6.1] — 2026-08-20 (El semáforo en la agenda y el botón «Generar todo»)

Los dos que usted aceptó. Banco: **1.988 comprobaciones en verde, cobertura 100 % (731/731)**.

### 🚦 Semáforo de pre-consulta en cada tarjeta
- Junto a la hora de cada citado: **punto verde** = sus laboratorios ya están precargados (la ficha abre al instante); **punto ámbar** = en cola, trayéndose en segundo plano. Sin punto = módulo apagado en Ajustes. Pase el mouse por el punto y se lo explica.
- Una sola lectura del almacén por repintado de la lista — el semáforo no le cuesta nada al rendimiento.

### ✨ «Generar todo (4)»
- Un botón nuevo junto a Generar: produce los borradores de las **cuatro casillas en cadena** — Enfermedad Actual y Análisis y plan con el modelo potente, Recomendaciones y Ruta Crónicos con la rotación — mostrando el avance ("Generando 2/4…").
- **En cadena a propósito, no en ráfaga**: la cuota gratuita castiga las ráfagas, y así cada llamada conserva su respaldo de rotación.
- Si falta la categoría de riesgo (el crítico bloqueante), el Análisis y plan **se salta con nota** y las otras tres salen igual — nada se queda a medias por culpa de una.
- Cada borrador queda guardado en su chip: revise casilla por casilla e inserte con el botón que ya navega y pega solo.

## [Versión 16.6.0] — 2026-08-20 (El botón que navega por usted, y la pre-consulta que deja todo listo)

Sus dos encargos de la noche. Banco: **1.987 comprobaciones en verde, cobertura 100 % (730/730)**.

### 🖱 Insertar ahora navega y pega por usted
- Su orden: *"el botón debe navegar por nosotros y pegar el texto automáticamente"* — y su duda sobre el módulo superpuesto quedó resuelta como lo hablamos: al pulsar **⬇ Insertar**, si la casilla no está a la vista, **el modal se encoge a una pastilla de progreso** en la esquina ("⏳ Abriendo la pestaña Conducta…"), Everest queda visible, el script hace clic en la pestaña destino, espera a que aparezca la casilla (hasta 8 s) y pega con las guardas de siempre — mismo paciente, no pisar, Deshacer.
- **Y respondiendo su pregunta: NO toca volver a abrir el módulo.** Al terminar, el modal **vuelve solo**, marca la casilla con ✓ y salta a la siguiente pendiente. Cada casilla **conserva su borrador** al cambiar de chip — puede generar las cuatro y luego insertarlas una tras otra sin regenerar nada.
- Si la pestaña no se encuentra o la casilla no aparece, el modal vuelve **con su borrador intacto** y le dice exactamente qué pasó.

### 🚀 Pre-consulta: los laboratorios de sus citados se van trayendo solos
- Aprobado por usted, con su objeción resuelta: **no hace falta abrir ninguna historia ni que línea de frente confirme a nadie** — Athenea se consulta por documento, y el documento viene en la agenda.
- **Nivel 1**: con la agenda del día en mano, la pestaña líder trae los laboratorios de UN citado cada 15 segundos (sin castigar la red), y los guarda por día. **Nivel 2**: el paciente que pasa a "En Sala" salta al frente de la cola. Al abrir su historia, la ficha **abre al instante** con lo precargado mientras llega lo fresco — la consulta de siempre corre igual; esto adelanta la foto, no la reemplaza.
- Un fallo de Athenea **no se guarda** como "sin laboratorios" (la regla de la v16.2.8 aplica aquí también). El paciente de primera vez queda honesto: su riesgo dice "pendiente de abrir la historia".
- Se apaga en Ajustes si algún día molesta. Signos vitales y medicamentos no se precargan: son llamadas rápidas que ya se hacen al abrir.

## [Versión 16.5.1] — 2026-08-20 (El resumen del turno ya no puede amanecer en ceros dos veces)

Banco: **1.982 comprobaciones en verde, cobertura 100 % (722/722)**.

### 🪞 Espejo de doble almacén para sus métricas
- **Primero, la absolución**: sus números viven en el almacenamiento del NAVEGADOR, no en el script — actualizar la versión no los toca. Y su propio reporte lo demuestra: el pantallazo en ceros es de las 12:59 y usted instaló la versión nueva después de la 1 pm. **La actualización no fue la causa.** Los sospechosos reales: limpieza de datos del sitio (política de la IPS), otro perfil de navegador, ventana privada, u otro computador.
- **Luego, el blindaje** (porque esas limpiezas sí pasan): las claves del resumen — estadísticas del turno, telemetría de uso y la bitácora del día — ahora se **espejan en el almacén interno del script**, que sobrevive a las limpiezas del sitio y solo muere si se ELIMINA el script (actualizar no lo toca). Al arrancar, si el navegador perdió el original, **se restaura solo desde el espejo** y queda una línea en consola explicando qué pasó. Dos almacenes con causas de muerte distintas: para perder sus números tendrían que morir los dos a la vez.
- El espejo escribe con freno anti-ráfaga **con cola**: el último conteo siempre llega, sin castigar el rendimiento.
- Regla de actualización segura para el consultorio: **actualice pegando sobre el MISMO script en Tampermonkey** (o instalando el archivo encima). Si borra el script y crea uno nuevo, el almacén interno del espejo se va con él.

## [Versión 16.5.0] — 2026-08-20 (La Redacción asistida, rediseñada con usted casilla por casilla)

El módulo que usted llamó "uno de los campos más sensibles para mí", reconstruido con las 8 decisiones de su entrevista. Banco: **1.979 comprobaciones en verde, cobertura 100 % (720/720)**.

### ✍ Cuatro casillas y nada más — y Preguntar donde se ve
- Decisión suya: **Motivo, Nota clínica y Resumen previo salen del módulo**. "Nota clínica y Análisis y plan es lo mismo": ahora **Análisis y plan genera la nota completa del Copiloto** — blindaje médico-legal, estructura de secciones, alertas de dosis renal destacadas al inicio del borrador — alimentada por el JSON del motor, y se inserta en la casilla exacta de Everest.
- **Preguntar** dejó de ser un chip escondido: es un botón propio, rotulado **(opcional)**, con su explicación. No escribe en la historia.
- Los nombres viejos no revientan: un acceso rezagado a "Nota clínica" cae en Análisis y plan.

### 📅 Las fechas ya viajan a la IA — porque usted lo decidió
- Su plantilla de Enfermedad Actual exige cronología ("QUIEN REFIERE QUE DESDE…") y la censura de fechas la dejaba coja. Usted eligió enviarlas: ahora **las fechas de atención llegan a la IA**; nombres, cédulas, teléfonos y direcciones **se siguen tachando siempre**. El pie del modal dice la verdad nueva. El resto del script (telemetría, registros) sigue censurando fechas como antes.
- El encabezado de la nota (#PACIENTE_…) usa marcadores **[ID] y [AÑO_MES] que se rellenan en SU equipo** después de generar: el identificador jamás viaja a la IA.

### 🧾 Recomendaciones 100 % personalizadas, escritas como suyas
- Prompt nuevo con una **regla de oro**: si una frase podría pegarse en la historia de otro paciente sin cambiar una palabra, no sirve. Trato de usted; sus medicamentos con horario; SUS metas en cifras; estilo de vida ajustado a SUS patologías; **signos de alarma elegidos según sus diagnósticos**; y el cierre con su próxima cita y toma.

### 🚦 El cuadro de datos críticos — solo lo que invalida la nota
- Antes de generar el Análisis y plan, si falta la **categoría de riesgo** (obligatoria — el propio Copiloto se niega sin ella), la **TFG** o los **medicamentos**, aparece un cuadro para completarlos ahí mismo. La categoría bloquea; TFG y medicamentos se pueden aportar o dejar declarados. **Nada más interrumpe jamás** — como usted acotó: "solamente en casos absolutamente necesarios".

### ⚡ Modelo por casilla, consciente de la cuota gratuita
- Las notas largas (Enfermedad Actual, Análisis y plan) van **siempre al modelo más capaz**; las casillas cortas siguen en la rotación que reparte cuota. Ante un límite de cuota, los reintentos caen a la rotación — el potente nunca se gasta en ráfagas. Con dos médicos a la vez: **la cuota es por clave, no por computador** — cada médico con su propia clave en Ajustes la duplica (recomendado).

### 🔌 Verificación pedida: los botones de inserción
- Revisado el cableado completo: cada casilla inserta en su ancla exacta de Everest (MotivoConsulta→Anamnesis, UltimaEnfermedad→Anamnesis, el área de "Ingrese la descripción del análisis y plan"→Impresión Diagnóstica, RecomendacionesMedicas→Conducta, comentariosFinales→Ruta Crónicos), con tres guardas: mismo paciente en pantalla, casilla ocupada → reemplazo con Deshacer, y casilla ausente → aviso con el nombre de la pestaña que hay que abrir. Límite conocido: la pestaña destino debe estar abierta (Everest solo monta la pestaña visible); el botón no navega por usted.

## [Versión 16.4.0] — 2026-08-20 (URGENTE: la compuerta atascada, más cinco decisiones suyas de la entrevista)

Banco: **1.978 comprobaciones en verde, cobertura 100 % (720/720)**.

### 🚪 URGENTE — La compuerta de contexto se quedaba cerrada aunque usted abriera las pestañas
- Reporte de campo de hoy mismo: *"ya abrí las respectivas pestañas de Everest y aun así no me deja entrar al módulo"*. Dos causas, las dos mías:
- **Una pestaña visitada pero SIN diligenciar no dejaba rastro.** El archivo solo guardaba radios con Sí/No marcado; en un paciente con la historia virgen (todos los pares "SiNo" sin responder — el caso exacto del reporte), abrir Antecedentes no contaba. Ahora **la visita misma es contexto**: la pestaña queda anotada como vista, con su hora, aunque venga vacía — "el médico la miró y no había nada" también es información.
- **La cosecha solo corría en pantallas con cierto marcador presente.** En las subpantallas de la historia donde ese marcador no existe, las pestañas podían no dejar rastro jamás. Ahora corre en todo el módulo de Historia Clínica, con el mismo criterio del menú de acciones.
- **Y autocuración inmediata**: la pestaña que usted tiene abierta en este preciso instante cuenta ya, sin esperar al archivo. Si vuelve a ver el aviso con la pestaña abierta delante, es un bug y quiero saberlo.

### ❤️ Sus cinco decisiones de la entrevista, implementadas
- **Una sola vara para "vencido"**: el aviso al entrar a la historia y el bloqueo "ya cubierto por Athenea" ahora usan la tabla por estadio + su regla del 50% cuando el resumen del paciente está disponible — el mismo criterio de Agendar y Riesgo. Un renal G4 ya no puede ser "cubierto" y "vencido" en la misma sesión.
- **Un solo umbral para "fuera de meta"**: acortar la vigencia al 50% y declarar falla usan el mismo margen (meta+15%). El paciente de la franja gris (HbA1c 7,4 con meta 7,0) ya no recibe viajes extra sin falla declarada.
- **Mayores de 79: riesgo ALTO como piso** — y como usted subrayó, *"claramente puede subir a muy alto"*: el daño de órgano, la enfermedad cardiovascular o la función renal muy baja siguen mandando. La escala extrapolada ya no decide en el añoso. En **menores de 40** se mantiene la escala calibrada con su letrero, como manda el consenso que usted citó.
- **La hora de la toma de muestras se elige SIEMPRE**: ya no nace preseleccionada en el primer cupo (las 6:00 a. m. que nadie decidía). El desplegable abre en "— elija la hora —" y el confirmar espera su elección.
- **Meta de HbA1c**: unificada la clave interna duplicada que hacía inalcanzable la individualización (dos nombres para la misma meta que nunca se encontraban). El campo editable por paciente en la Ficha llega en la próxima versión sobre este cimiento.
- Además, de su ronda anterior: **la agenda propia manda** (continuidad estricta con salto automático de día — usted eligió mantenerla, queda registrada como decisión y no como accidente).

### 💊 La polifarmacia ya no cuenta fármacos que no son del programa
- Reportado con pantallazo: la insignia decía *"Polifarmacia (27 fármacos)"* cuando solo 3 eran cardiovasculares. Su orden vigente (v16.1.0) es que los demás *"ni se listan ni entran en ningún cálculo"* — y esta insignia era un cálculo que los contaba.
- Ahora el triaje mide la polifarmacia SOLO sobre los fármacos del programa y el rótulo lo dice: *"Polifarmacia del programa (N fármacos RCV)"*. La detección de insulina sigue mirando la lista completa: no pasar por alto a un insulinorrequirente no es "usar" los otros fármacos.

### 🧪 El historial de laboratorios cumple lo que promete
- Reportado: el rótulo dice *"últimos 365 días"* pero la tabla mostraba resultados de hace más de un año (las solicitudes de Athenea llegan por año natural, no por ventana móvil).
- La tabla ahora filtra a 365 días de verdad. Las filas sin fecha legible se conservan — esconder un resultado real por un defecto de lectura sería peor — y el motor de vigencias sigue viendo el historial completo: el filtro es de pantalla, no clínico.

### 📡 Telemetría: el acuse falso, corregido
- El receptor responde "no" cuando rechaza el token, y ese "no" pasaba como entregado: una rotación del token producía una hoja vacía con el sello en verde. Ahora el "no" es un fallo con su causa legible: *"el panel rechazó el token"*.

## [Versión 16.3.2] — 2026-08-20 (El reconciliador ya pregunta, recuerda su respuesta y lee lo que usted escribe)

Sus tres decisiones de esta tarde, implementadas completas. Banco: **1.977 comprobaciones en verde, cobertura 100 % (719/719)**.

### 💬 El modal de confirmación, en lo estrictamente necesario
- Cuando las fuentes se contradicen en un dato que decide una conducta, el módulo se detiene y le pregunta — con las dos versiones a la vista: quién afirma, quién niega y por qué importa. Responde con un clic («Sí tiene» / «No tiene») y el módulo se abre solo.
- **Estrictamente necesario**, como usted acotó: solo se pregunta al abrir un módulo que va a usar el dato (nunca de la nada), solo por las discrepancias graves —las que deciden la tabla de vigencias: diabetes, hipertensión, enfermedad renal—, y solo lo que usted no haya confirmado ya. El tabaquismo y la enfermedad cardiovascular no abren modal nunca.
- El ✕ es «decidir luego»: no responde nada y el módulo no se abre.

### 🧠 Su respuesta vale la jornada… y las siguientes citas
- Decisión suya: *"toda la jornada. Y si es posible mantener esos datos y el caché y todo lo demás para las siguientes citas sería perfecto"*.
- Las confirmaciones y todo el archivo de contexto (las pestañas que usted ya revisó) pasan a **almacenamiento persistente**: cerrar la pestaña o apagar el equipo ya no borra lo aprendido. En el control del próximo mes, el asistente arranca sabiendo lo que usted ya le confirmó.
- **Lo único que NO se conserva entre citas son los laboratorios**, y es a propósito: un resultado de la cita pasada mostrado como actual podría esconder uno nuevo. Athenea se vuelve a consultar en cada visita. Se persiste lo que USTED vio o afirmó, no lo que un sistema externo respondió un día.
- El archivo se poda solo (80 pacientes más recientes, nada mayor de 120 días) para no crecer sin límite en un equipo compartido.
- Si su confirmación choca con lo que la historia sigue diciendo, la confirmación manda para los cálculos — pero el choque queda anotado y el modal se lo recuerda: la historia es el documento oficial y quien debe corregirla es usted.

### ✍️ Lo que usted ya escribió cuenta como contexto — y editarlo rehace el análisis
- Encargo suyo: el script debe usar el texto ya escrito en las áreas libres y, si se editan, reanalizar.
- Ahora se leen **las cinco casillas** (Motivo de consulta, Enfermedad actual, Análisis y plan, Recomendaciones, y el Análisis de Ruta Crónicos — antes solo se aprovechaban dos, y solo para la IA). Su texto entra al reconciliador como una fuente más: si escribió «fumador» y el antecedente está sin marcar, eso cuenta como contradicción.
- **Al salir de una casilla con el texto cambiado**, el análisis en memoria se invalida y el siguiente módulo que abra recalcula todo — riesgo, vigencias, fecha de control — con los laboratorios que siguen calientes, así que no hay espera. El texto que ya estaba escrito al llegar solo se toma como contexto: leerlo no dispara nada.

## [Versión 16.3.1] — 2026-08-20 (Ninguna fuente es de fiar por sí sola: ahora se cruzan)

Corrección de algo que entregué hace una hora, y la base de lo que usted pidió. Banco: **1.968 comprobaciones en verde, cobertura 100 % (712/712)**.

### ⚠️ Corregido: la cabecera ya no decide nada
- Usted advirtió: *"no siempre confiarse de la cabecera de Everest... toca reconfirmar esos hallazgos puesto que no siempre son verídicos"*. Tenía razón, y me hizo ver que en la versión anterior **había reintroducido por otra puerta el fallo que estábamos cerrando**: dejé que las marcaciones abrieran el módulo y afirmaran que un paciente es diabético. Si esas marcaciones envejecen —son inscripciones administrativas— eso es exactamente un dato dudoso presentado como un hecho.
- **La cabecera ya no abre el módulo ni alimenta ningún cálculo.** Se sigue leyendo, pero solo para contrastar. La compuerta vuelve a exigir contexto verificado: las pestañas que usted abrió de verdad.

### 🔍 El asistente cruza las fuentes y le pregunta cuando se contradicen
- Encargo suyo: *"si en el texto dice que el paciente es fumador pero en la historia no está marcado, el script debe pedirte confirmación... si dice la historia que es diabético pero los exámenes, los medicamentos, y el texto libre dice otra cosa, también"*.
- Ninguna de las fuentes de aquí merece fe ciega: la cabecera envejece, los radios se quedan sin diligenciar, el texto libre es prosa, y los medicamentos y laboratorios son indicios. En vez de elegir una y creerle, **se cruzan las cinco**. Mientras coinciden, el asistente no dice nada. Cuando se contradicen en algo que decide una conducta, se detiene y le pregunta.
- Se vigilan cinco datos: **diabetes, hipertensión, enfermedad renal, tabaquismo y enfermedad cardiovascular establecida**. Los tres primeros frenan el flujo (deciden qué tabla de vigencias rige); los otros dos se muestran sin bloquear.
- **Lee prosa con cuidado**: *"niega tabaquismo"* se entiende como negación, y *"padre fumador"* se descarta por ser de un tercero. Ante la duda no opina.
- **Una sola fuente hablando no es una contradicción.** Si la historia marca la diabetes y nadie más dice nada porque usted está en otra pestaña, no se le pregunta nada. Solo hay pregunta cuando dos fuentes se contradicen de verdad.
- **Una prueba encontró un fallo mío mientras lo construía**: yo contaba *"no hay HbA1c"* como argumento en contra de la diabetes **incluso cuando los laboratorios no se habían cargado todavía**. Con eso, un diabético con su metformina y su historia bien marcada generaba una pregunta absurda. Es el mismo error de fondo que corregimos esta mañana en Athenea: **no pude leerlo no es lo mismo que no lo tiene**. Ahora una fuente solo puede negar algo si de verdad se cargó.

## [Versión 16.3.0] — 2026-08-20 (El asistente ya no opina sin contexto — y descubrimos que lo tenía delante)

Su decisión sobre habilitar módulos, implementada. Banco: **1.961 comprobaciones en verde, cobertura 100 % (709/709)**.

### 👀 Everest ya le decía lo que el asistente no sabía leer
- Al investigar su pregunta encontré esto, y es incómodo: la **cabecera de la Historia Clínica** muestra siempre, esté usted en la pestaña que esté:
  `Marcaciones: HTA+DM, Nefroprotección · Cockcroft-Gault: 58.03 · Estadio: 3a`
- El asistente **nunca la leía**. En su captura de esa paciente, el módulo decía *"Riesgo sin clasificar: falta la TFG"* y *"Cockcroft-Gault: sin dato"* mientras Everest lo tenía impreso tres centímetros más arriba, en la misma pantalla.
- Ahora se lee. Es la mejor fuente que hay aquí: no depende de qué pestaña esté abierta, no cuesta una consulta y no hay que esperar a Athenea.
- **Solo puede afirmar, nunca negar**: si la marcación nombra la diabetes, el paciente es diabético aunque el antecedente no esté a la vista. Que no la nombre no prueba lo contrario — ahí queda en «sin dato», nunca en «no».

### 🚦 Los módulos que opinan ya no se abren sin contexto
- Decisión suya, textual: *"hasta que el script no tenga el contexto completo de toda la historia no se debería habilitar los módulos que dependen de este mismo"*.
- Le había recomendado algo más suave y **usted decidió el criterio estricto**. Va como usted dijo: el módulo de Riesgo no se abre si el asistente no puede sostener lo que va a afirmar.
- **Por qué su criterio gana**: sin esas pestañas el módulo no salía roto, salía **confiado y equivocado**. Un módulo que no aparece es un inconveniente; uno que afirma un riesgo falso puede anclar una decisión clínica.
- **Pero no se bloquea a ciegas**: antes de cerrarse mira la cabecera, así que en la mayoría de pacientes la compuerta se abre sola y usted nunca llega a ver el bloqueo.
- Cuando sí se cierra, **dice qué falta y dónde está**: *"Para opinar sobre este paciente necesito leer Antecedentes y Hábitos y Gestión de Riesgo. Abra esa(s) pestaña(s) una vez y el módulo se activa solo — no hay que guardar nada."*
- **Ruta Crónicos no se exige** a propósito: solo aporta matices que afinan el riesgo, no que lo deciden. Pedirla bloquearía a casi todos sin ganar seguridad.

### 🔔 El recordatorio, una sola vez y en silencio
- Como usted pidió: si a un paciente le falta contexto, se le dice **una vez por paciente y por jornada**, sin sonido y sin bloquear nada. Si lo ignora, no vuelve a insistir con ese paciente.
- Abrir el módulo a propósito no está sujeto a ese límite: ahí siempre se le explica qué falta.

## [Versión 16.2.9] — 2026-08-20 (Todo diabético entra como riesgo alto, y el asistente ya no se queda ciego fuera de su pestaña)

Las cuatro decisiones que usted tomó hoy en la entrevista. Banco: **1.951 comprobaciones en verde, cobertura 100 % (703/703)**.

### ❤️ Todo diabético entra como riesgo ALTO, como mínimo
- Decisión suya, textual: *"sí, todo diabético debe entrar como riesgo alto"*.
- **Es un piso, no un techo** (como usted confirmó): el diabético con daño de órgano blanco, con enfermedad cardiovascular establecida o con la función renal muy baja **sigue subiendo a MUY ALTO**. Lo que desaparece es que un diabético pueda quedar en "moderado", en "bajo" o **sin clasificar**.
- **Por qué hacía falta**, y es incómodo de contar: la norma ya tenía dos reglas que subían de categoría al diabético, pero las dos dependen de dos datos —los años de evolución de la diabetes y si es de larga duración— que **ningún punto del asistente escribe nunca**. Estaban muertas. Con ellas moría la única vía por la que un diabético subía, y por eso su paciente de 85 años con hipertensión y diabetes insulinorrequiriente salía en riesgo **bajo**, con meta de LDL <116. Ahora esa misma paciente sale en **alto**, con meta **<70**.
- El efecto se encadena con la regla del 50 % de la versión anterior: al bajar la meta, más resultados quedan "fuera de meta", y esos exámenes se repiten a la mitad del plazo.

### 🧠 El asistente ya tiene el contexto de toda la historia, no solo de la pestaña abierta
- Pedido suyo: *"debes buscar una solución para que el script aunque estés en X pestaña sea capaz de tener el contexto de toda la historia clínica"*.
- **El problema era real y explicaba media auditoría**: Everest es una aplicación de una sola página, así que en la pantalla **solo existe la pestaña que usted tiene delante**. Los factores de riesgo viven repartidos en cuatro (Antecedentes, Hábitos, Examen físico, Clínica del paciente). Estando usted en Paraclínicos, el asistente leía "no tiene hipertensión, no tiene diabetes, no fuma" **de un paciente que lo tiene todo documentado**.
- **Cómo se resolvió** (la opción que usted eligió): el asistente va **archivando lo que usted abre**. Cada vez que pasa por una pestaña, lo que esa pestaña revela queda guardado para ese paciente con su hora, y el clasificador lee después la **suma de todo lo visto**. Cero peticiones extra a Everest y cero intromisión en su pantalla.
- **Solo se archiva lo documentado**: un campo que no está en pantalla no se guarda como "no lo tiene". Esa confusión es justo el defecto que se estaba corrigiendo.
- **Corregido de paso**: el archivado usaba el documento del ciclo *anterior* mientras leía la pantalla de *ahora*. Si usted cambiaba de historia dentro de la misma pestaña, se guardaban los programas de un paciente bajo el documento de otro — y como solo escribe "sí", nunca "no", eso solo podía **inventarle enfermedades** al primero.

### 📋 La ficha ya no afirma "No" cuando nadie lo documentó
- Las filas de Diabetes, Hipertensión y Fuma **ya estaban escritas** en tres estados (Sí / No / sin dato), pero la rama de "sin dato" era código muerto: el dato llegaba siempre convertido a Sí o No. Una ficha cuya regla declarada es *"sin dato = sin suposición"* imprimía "Fuma o exfumador: **No**" como un hecho — y esa ficha alimenta la redacción con IA.
- Ahora dice **sin dato** cuando nadie lo marcó. Como usted decidió, **la clasificación de riesgo se sigue calculando igual**: la ficha es honesta, pero no le llena la pantalla de advertencias de "incompleto".

### ✍️ Redactar ya no puede mezclar dos pacientes
- Al pulsar ✍ Redactar, el asistente tarda 3-6 segundos leyendo laboratorios, medicamentos y función renal, y en ese rato usted puede navegar. Dos de los lectores —la tensión arterial y el texto libre de la historia— **no comprobaban de quién era la pantalla**: un cambio de historia a mitad metía la tensión y el examen físico del paciente nuevo dentro del resumen del anterior, y lo dejaba **20 minutos en memoria** alimentando la fecha de control de Agendar y la prioridad de Ordenar.
- Ahora, si al terminar de leer ya no está en la misma historia, **se descarta todo** y se le avisa: *"Cambió de paciente mientras se leían los datos, así que no se usó nada de lo leído"*.

## [Versión 16.2.8] — 2026-08-20 (Seis reportes de consultorio, y una sola causa detrás de la mitad)

Todo lo que reportó hoy en la última tanda. Banco: **1.947 comprobaciones en verde, cobertura 100 % (700/700)**.

### 🔴 La causa raíz: un fallo de Athenea se presentaba como un hecho clínico
- Reportado: *"a esta otra paciente no le aparece ningún dato en este módulo"*, con la consola adjunta. Ahí estaba la prueba:
  `[Vigilante Athenea] OK — 8 solicitud(es) encontradas` … y acto seguido `excepción resolviendo solicitudes: Error: Timeout`.
- Athenea contestó las tres primeras llamadas y **se cayó por tiempo** al pedir el detalle. Hasta ahora *cualquier* fallo —sesión vencida, error del servidor, red, tiempo agotado— se traducía a "este paciente no tiene laboratorios". Con eso, el asistente afirmaba cosas falsas sobre una paciente que sí tenía todo hecho: *"Riesgo cardiovascular sin clasificar"*, *"Falta la TFG"*, los nueve exámenes en *"Nunca se le ha tomado"*, y el aviso de entrada listando los ocho analitos RCV como vencidos — marcándose además como visto, para no repetirse en toda la jornada.
- **Ahora hay dos respuestas distintas y no se pueden confundir**: "no pude leer" y "leí, y no hay nada". Un fallo ya no se guarda en memoria (así el siguiente ciclo lo reintenta en vez de arrastrar la mentira diez minutos), ya no dispara la lista falsa de vencidos, y el semáforo de estado deja de decir que los laboratorios "van bien" cuando llevan horas caídos.
- **Encontrado de paso, y es serio**: la verificación de seguridad que compara la cédula de la respuesta con la buscada se rompía si el portal escribía el número **con puntos de miles** (`CC: 12.345.678`): capturaba solo `12`, no coincidía, y descartaba la lectura entera en silencio. El resultado para usted era idéntico —paciente sin laboratorios— sin ninguna pista de por qué. La verificación sigue exigiendo igualdad exacta de dígitos; solo deja de romperse por el formato.
- Este mismo defecto explica el **"TFG 0"**: sin creatinina, la TFG quedaba en cero y el asistente la leía como insuficiencia renal terminal en vez de como "no la sé".

### 🔔 El aviso de "Sin presentarse → Atendido" ya no interrumpe
- Pedido suyo, con el pantallazo de una notificación recibida a las 12:09 por una cita de las 11:20: *"solamente necesito el aviso cuando la leyenda pasa de 'sin presentarse' a 'en sala' fuera del tiempo de confirmación; pero para 'sin presentarse' a 'atendido' no es necesario"*.
- Tiene toda la lógica: cuando la agenda ya dice "Atendido", el paciente lleva rato dentro del consultorio y avisar entonces no cambia nada.
- **Se conserva todo lo que sirve de evidencia**: el caso se sigue pintando en rojo y se sigue escribiendo en el reporte de auditoría con su hora exacta. Lo único que se quitó es el canal que interrumpe (tono, notificación de Windows y cartel).

### 📅 El plazo que usted elige vuelve a mandar
- Reportado: *"estoy escogiendo a 3 meses y el sistema no respeta mi decisión y me sigue mostrando solo las citas del mes siguiente"*.
- Era literal. Cuando el paciente tenía exámenes vencidos, el asistente descartaba su plazo y repintaba los días alrededor de **su propia** fecha — mientras el banner, dos centímetros más arriba, prometía *"es una sugerencia, no una imposición"*. La promesa era falsa: con esos días usted no podía llegar a los 3 meses ni queriendo.
- Ahora los días se pintan sobre **su** plazo, y la fecha que evita el vencimiento se ofrece con un botón de un clic. La recomendación no desaparece; deja de imponerse.

### 💬 Dos mensajes que se contradecían o no decían nada
- *"Aquí sale que hay examen vencido pero no dice cuál, igual de ambiguo"*: el aviso decía "(1 vencido)" sin nombrarlo. Ahora los **nombra** —hasta cuatro, y el resto contados— separando los vencidos de los que nunca se han tomado.
- *"Mensajes contradictorios al elegir cupo"*: el globito pegaba dos juicios sobre cosas distintas sin avisar que lo eran — *"dentro de la franja recomendada · puede elegir esta o cualquier otra"* (que habla de la **hora**) seguido de *"no recomendado para este paciente"* (que habla del **tipo de cupo**). Ahora se nombran por separado: *"La HORA sirve… Lo que NO conviene es el TIPO de cupo"*.

### 🧪 Las fechas que faltaban en el autocompletado
- Reportado: *"hay exámenes que no se les está poniendo la fecha… la hemoglobina, el fósforo, la PTH, la albúmina"*.
- Encontrada una causa concreta y corregida: cuando dos exámenes resolvían a **la misma casilla de fecha** (el respaldo por nombre construido "por convención" nunca se verificó contra la pantalla real), el primero la escribía y los demás se saltaban en silencio por la regla de "solo escribo si está vacía" — exactamente el síntoma. Ahora, si la casilla ya la ocupó otro examen, **no se escribe encima** (poner ahí la fecha de otro examen sería peor que dejarla vacía) y queda avisado.
- Se amplió el diagnóstico de consola para que, si vuelve a pasar, diga **qué casilla** eligió y **por qué vía**. Si lo ve otra vez, páseme esa línea y lo cierro del todo.

## [Versión 16.2.7] — 2026-08-20 (La regla del 50% por fuera de meta, y la hora real de cada aviso)

Dos reportes suyos de hoy, uno de ellos una deuda mía. Banco: **1.942 comprobaciones en verde, cobertura 100 % (699/699)**.

### 🎯 Un resultado fuera de meta ya no espera la vigencia completa
- Reportado con pantallazo: *"si te das cuenta el LDL está muy elevado, y aun así el script me lo manda para dentro de mucho tiempo, no se está cumpliendo la regla del 50% que habíamos definido"*.
- **Tenía razón y la deuda es mía**: usted definió esa regla el 20 de agosto y quedó anotada como decisión, pero **nunca llegó al código**. No era un fallo de cálculo: la regla sencillamente no existía.
- Ahora sí. Cuando el último resultado de un examen está **por fuera de meta**, su vigencia se parte a la mitad: la vigencia de la norma supone un paciente controlado, y si no lo está hay que volver a medirlo antes.
- **Dónde se aplica, y por qué solo ahí.** Se aplica a los tres analitos que hoy tienen una meta escrita en el asistente: **LDL** (según la categoría de riesgo del paciente), **triglicéridos** (150) y **hemoglobina glicosilada** (7,0 o la meta propia del paciente si la tiene). **No** se aplica a glicemia, colesterol total, HDL, creatinina, hemoglobina, PTH, fósforo, albúmina ni uroanálisis: para esos no hay una meta definida en el asistente, y ponerle un número inventado a un examen clínico es peor que no acortarlo — quien lea el código después no podría distinguirlo de uno real. Si quiere que entren, dígame el umbral y entran.
- La relación albúmina/creatinina queda deliberadamente fuera: ya tiene su propio acortamiento por albuminuria desde antes, y aplicarle las dos reglas la partiría dos veces.
- El motivo lo dice en pantalla: *"fuera de meta: se repite a la mitad (90 d en vez de 180)"*, para que la fecha corta nunca aparezca sin explicación.
- **Efecto secundario que descubrió una prueba interna**: al acortarse, algunos exámenes pasan a estar **ya vencidos**, y eso adelanta la fecha de toma sugerida. Es exactamente lo que usted quería, pero conviene saberlo: va a ver más exámenes en rojo que antes, porque antes estaban tapados por una vigencia demasiado larga.

### 🕒 Cada aviso dice ahora a qué hora ocurrió, no solo la hora de la cita
- Reportado: *"me llegó esta notificación pero no me dice a qué hora exactamente me la confirmaron y es importante para mí ese dato para poder hacer reclamaciones"*.
- El aviso mostraba **11:20 a. m.**, que es la hora **de la cita** — no el momento del hecho. Ahora lleva una tercera línea: **🕒 Visto 11:47:23 a. m. · +27,4 min frente a la cita**.
- Dice **«Visto»** y no «Confirmado» a propósito. El asistente consulta la agenda cada pocos segundos, así que esa es la hora en que **lo vio**, que puede ir un poco por detrás del instante exacto en que Everest recibió la confirmación. Para una reclamación importa que el dato sea defendible, no que suene más preciso de lo que es.
- **Y algo que quizá no sabía**: esto ya se venía registrando. En **Ajustes → Reporte de auditoría → Descargar** obtiene un archivo `.csv` que se abre en Excel con la hora exacta de cada evento del día, el documento, el estado y los minutos de desfase. Las confirmaciones extemporáneas se escriben en el acto, sin esperar, precisamente para que sirvan de evidencia. Ese archivo es su soporte real para una reclamación; el aviso en pantalla es solo el adelanto.

## [Versión 16.2.6] — 2026-08-20 (Encontrada la causa del "se desactiva solo y toca F5")

Tres arreglos, uno de ellos el que llevaba semanas sin explicación. Banco: **1.939 comprobaciones en verde, cobertura 100 % (697/697)**.

### 🩺 El misterio del asistente que se apagaba solo: resuelto
- Su consola del 20-ago trajo la prueba que faltaba: `boot() abortó por una excepción sin capturar — el asistente puede quedar INACTIVO en esta pestaña hasta recargar: ReferenceError: Cannot access 'MTR_CSS' before initialization`.
- **Qué pasaba.** El arranque leía cuatro hojas de estilo opcionales con una comprobación de "¿esto existe?" que se creía a prueba de fallos. No lo era: cuando lo que se pregunta es una pieza que aún no ha terminado de crearse, esa comprobación **no responde «no existe» — se cae**. Y el arranque corría a mitad de la carga del archivo, cuando esas piezas todavía no estaban listas.
- **Por qué era intermitente** — y por eso nunca se pudo reproducir. Si la página aún estaba cargando, el arranque se aplazaba y para entonces ya todo existía: todo bien. Si la página **ya había terminado de cargar** (navegación interna de Everest, o inyección tardía de Tampermonkey), el arranque corría de inmediato y reventaba. De ahí que a unos les pasara y a otros no, y que un F5 lo "arreglara".
- **Qué se hizo.** El arranque ahora espera a que el archivo termine de cargarse por completo, y las cuatro lecturas de estilos pasan por una función que no puede lanzar. Cinturón y tirante: si mañana alguien reintroduce el patrón, el banco lo rechaza.
- Esto es lo que su colega describía como *"se desactiva solo, toca F5"*.

### 🎨 El menú de acciones ya no se sale de su propia caja
- Reportado con pantallazo: *"el widget no se ve bien estéticamente ya que los elementos no caben en el espacio"*.
- El contenedor usaba un radio de esquina de **999 px**, pensado para una pastilla horizontal pequeña. Aplicado a una columna de unos 300 px de alto, eso deja de ser una esquina redondeada y se vuelve una elipse: los botones de los extremos —«Agendar» arriba y «Riesgo y exámenes» abajo— quedaban pisando la curva, por fuera del fondo pintado.
- Ahora lleva un radio proporcionado a su altura, los botones acuerdan ancho con el contenedor (el borde los envuelve de verdad) y el texto ya no roza el borde.

### 📱 Un solo botón para mandar el recordatorio, no dos
- Reportado con pantallazo: *"ambos botones funcionan y creo que hacen lo mismo, se debe elegir uno solo... mejor replica como Everest lo hace pero con nuestro CSS"*.
- No eran lo mismo por dentro (uno abría la casilla, el otro enviaba), pero una vez abierta quedaban los dos a la vista para una sola acción. Ahora el control viene armado de una: el celular ya escrito y **«Enviar mensaje»**, como en Everest.
- De paso, una mejora que usted no pidió pero que el cambio dejó a la mano: si la cita **no dejó su número interno**, antes se ofrecía el botón igual y solo al pulsarlo se descubría que no servía. Ahora directamente no se ofrece y en su lugar queda el aviso que remite al recordatorio impreso.

## [Versión 16.2.5] — 2026-08-20 (Athenea entra a decidir qué NO ordenar, y el aviso de "labs primero" por fin dice cuáles)

Dos de sus encargos de hoy. Banco: **1.936 comprobaciones en verde, cobertura 100 % (696/696)**.

### 🧪 Antes de ofrecerle ordenar el paquete RCV, el asistente le pregunta a Athenea
- Pedido suyo: *"con la misma lógica que se revisan los exámenes de riesgo cardiovascular y sus vencimientos, para el módulo de ordenamiento de PyM el script debe consultar Athenea para revisar si alguno de esos exámenes ya fue realizado y si ese es el caso se debe deshabilitar la opción de volver a ordenarlo porque sería un duplicado"* — y su aclaración: *"igual que el aviso al entrar a la historia, también debe estar sincronizado con Athenea antes de mostrar qué es lo que tiene pendiente"*.
- Hasta ahora el módulo solo cruzaba contra **Everest**, que sabe si ya hay una *orden puesta* — pero no si el paciente de verdad se hizo el examen (una orden puede llevar semanas sin tomarse). Athenea sí lo sabe. Ahora, al abrir el módulo de Ordenar, se consulta Athenea **antes** de pintar la lista, y si los ocho analitos del paquete RCV ya están hechos y vigentes, la casilla aparece sin marcar y con un aviso que dice por qué.
- Como usted decidió: **no se bloquea**. La casilla se puede volver a marcar si de verdad corresponde repetirlo — igual que ya funcionaban el aviso de "orden vigente en Everest" y el de choque de sexo. El asistente advierte; usted manda.
- Se aplica al paquete **RCV EXPRÉS** únicamente, y por una razón concreta: es el único del catálogo con vigencia clínica confirmada (180 días). Los otros siete (cérvix, VIH, mamografía, PSA, SOMF, hemoglobina, tamización cardiometabólica) siguen marcados en el propio código como *"periodicidad sin confirmar"* desde hace varias versiones — sin ese dato no hay contra qué comparar, y preferimos ofrecerlos que esconderlos por una suposición.
- Detalles de ingeniería que valen la pena: no consulta Athenea si el paciente no tiene el paquete RCV entre sus actividades (cero peticiones de más), reutiliza la consulta que el robot ya hizo al abrir la historia en vez de repetirla, y **ante cualquier duda ofrece el paquete** — red caída, sesión vencida o paciente sin nada en Athenea nunca se leen como "ya está hecho". Una prueba del banco destapó justo esa trampa: un fallo al leer la fecha devolvía "lista vacía", que se leía igual que "no falta nada" — habría escondido los ocho exámenes en silencio. Corregido antes de salir.

### 🔎 "3 por vencer en ≤30 días" ahora dice CUÁLES
- Reportado con pantallazo: *"mejora la redacción de ese tipo de mensajes y ahí directamente se debe mencionar cuáles son aquellos exámenes que se van a vencer para que el médico los vea rápidamente"*. Tenía razón: el aviso daba un número y tocaba salirse a otro módulo para saber de qué se trataba.
- Ahora los nombra, en fichas, separando **"Ya vencidos"** (rojo) de **"Vencen pronto"** (ámbar), y cada ficha lleva los días que le quedan — *Creatinina · 3 d*. Van **ordenados por urgencia**: lo que vence primero, primero.
- Para no saturar la vista (su condición de siempre): máximo 4 fichas por grupo, y el resto se resume en un *"+N más"*. Nunca una lista larga.
- De paso se reescribió la nota de abajo, que explicaba el mecanismo sin decir para qué sirve. Ahora dice lo que importa: la toma queda 14–21 días antes y el control ~7 días después **para que ningún resultado llegue vencido a la consulta**.


## [Versión 16.2.4] — 2026-08-20 (Las notificaciones de llegada ya no se repiten en ráfaga al volver a Ordenamiento o Acceso)

Su reporte de hoy. Banco: **1.930 comprobaciones en verde, cobertura 100 % (695/695)**.

### 🔔 Se acabó la ráfaga de avisos repetidos al cambiar de pestaña de Everest
- Reportado: *"LAS NOTIFICACIONES DE LLEGADA NO SE DEBEN REPETIR EN OTRAS VENTANAS DE EVEREST SI YA APARECIERON EN OTRA DISTINTA... A VECES CUANDO ME VOY A LA PAGINA DE ORDENAMIENTO O DE ACCESO DE EVEREST VUELVE Y ME SALEN TODAS LAS NOTIFICACIONES DE LLEGADA, ETC"*.
- Causa real, rastreada en el propio código antes de tocar nada: entre las pestañas de Everest solo UNA "manda" a la vez (evita sondear el API varias veces a la vez) y las demás quedan calladas — normal y de siempre. El problema es que una pestaña sin el mando deja de actualizar su propia lista de "ya avisado" mientras espera. Si esa pestaña recupera el mando más tarde (p. ej. usted vuelve a mirarla tras un rato en Ordenamiento o Acceso), comparaba la agenda de HOY contra su lista vieja de "ya avisado" — y todo paciente que cambió de estado mientras tanto se leía como si acabara de pasar en ese instante, así ya se le hubiera avisado hace rato desde otra pestaña.
- Ahora, justo en el momento en que una pestaña recupera el mando (y solo ahí — no en cada ciclo normal), se pone al día primero con lo que de verdad ya se avisó entre todas sus pestañas, antes de fijarse en si algo cambió. Lo genuinamente nuevo sigue avisando exactamente igual que siempre; lo que ya se le avisó desde otra pestaña, ya no se repite.


## [Versión 16.2.3] — 2026-08-20 (El azul de Everest también se colaba en el Paso 1 de Agendar — "pre-agenda la toma de muestras")

Otro reporte de hoy, mismo síntoma que ya se había visto en Ficha y Riesgo. Banco: **1.928 comprobaciones en verde, cobertura 100 % (695/695)**.

### 🎨 El azul oscuro de Everest, también fuera del Paso 1 de Agendar
- Reportado: en el modal de agendamiento, en la parte de "pre-agenda la toma de muestras" (Paso 1, tarjetas de tipo de cita), el texto se veía con el azul oscuro de Everest en vez del color propio del script.
- Misma causa que v16.1.0 (Ficha/Riesgo): ese bloque completo — la barra de pasos, las tarjetas de tipo de cita, el resumen final del Paso 3 y el banner de "cita ya registrada" — tenía su propio color de texto declarado, pero **sin el `!important`** que sí protege al resto del panel desde entonces. Quedó fuera de aquella pasada porque es un bloque más antiguo (v15.0.0). Ahora todo ese bloque queda con la misma protección: nunca vuelve a perder el pulso contra el CSS de Everest.
- Revisado el bloque completo, no solo la tarjeta que usted vio primero — así no queda pendiente el mismo aviso para el Paso 3 (resumen antes de confirmar) la próxima vez que alguien llegue hasta ahí.


## [Versión 16.2.2] — 2026-08-20 (El Vigilante ya solo aparece dentro de la historia clínica — Acceso y Ordenamiento quedan libres)

Su instrucción de hoy, con su compañera ya usando el script en otro equipo también. Banco: **1.927 comprobaciones en verde, cobertura 100 % (695/695)**.

### 🫥 Fuera de HCHealth, el Vigilante deja de aparecer — panel Y pastilla
- Pedido suyo: *"EL VIGILANTE DEBE APARECER SOLAMENTE AQUÍ: HC | EverHealth... EN LAS OTRAS PESTAÑAS COMO: Acceso Y Ordenamiento - Everest NO DEBE APARECER EL SCRIPT"*. Antes, el panel completo se mostraba también en Acceso (Citas del día), y en Ordenamiento quedaba al menos la pastilla mínima. Ahora ninguno de los dos aparece fuera de la historia clínica: cero rastro visible, ni panel ni pastilla.
- Antes de tocar una sola línea, se rastreó en el propio código si esto podía chocar con su otra prioridad de siempre — el aviso en tiempo real de llegadas y vencimientos de confirmación. Hallazgo: **no choca**. El sondeo del API y el disparo real de las alertas (tono, notificación de Windows, parpadeo) ya corrían en toda pestaña sin importar el módulo desde hace varias versiones (v12.3.11, v14.1.5) — precisamente para que nunca dependieran de en qué pantalla estuviera usted mirando. Ocultar el panel es un cambio puramente visual: por dentro, el vigilado sigue exactamente igual, en todas las pestañas, aunque su compañera tenga varias de Everest abiertas a la vez.
- Dentro de HCHealth nada cambió: si usted mismo minimiza el panel a la pastilla en una subpantalla sin historia abierta (p. ej. Ordenamiento dentro de la propia historia), eso se sigue viendo igual que siempre — la novedad es solo la frontera con Acceso/Ordenamiento-Everest.

### 🕵️ Pendiente de campo: "se desactiva solo" de su compañera
- Sigue abierta la investigación de por qué el script de su compañera se apaga solo y le toca F5. Confirmado que ella abre varias pestañas de Everest a la vez; con este cambio, muchas menos de esas pestañas van a tener el panel completo corriendo a la vista, pero el mecanismo que se sospecha de fondo (el guardia contra instancias duplicadas) no se tocó todavía — hace falta la línea exacta de consola ("[Vigilante] Se detectó...") que le aparece a ella para confirmar la causa real antes de tocarlo.


## [Versión 16.2.1] — 2026-08-20 (El recordatorio de cita ya no se le va derecho a Adobe Acrobat)

Un encargo de hoy. Banco: **1.923 comprobaciones en verde, cobertura 100 % (695/695)**.

### 🖨️ «Imprimir recordatorio de cita»: ahora se abre en Chrome, no en Acrobat
- Reportado con pantallazo: al pedir el recordatorio de la cita, Windows lo bajaba y lo abría con Adobe Acrobat, en vez de mostrarse en Chrome para imprimir desde ahí — como sí pasa con el recordatorio de laboratorio. Usted preguntó si esto se podía forzar automáticamente, sin tocar ningún ajuste de Windows o Chrome.
- La causa: ese PDF es el propio de Everest, servido con sus encabezados de descarga — y qué programa lo abre lo decide el sistema operativo, no el script. Eso, en efecto, ningún script lo puede pisar.
- Lo que sí estaba a la mano: en vez de mandar el navegador derecho a la URL de Everest, el asistente ahora **trae el PDF él mismo** (misma sesión, mismo origen que el resto de sus llamadas) y lo entrega a la pestaña como un archivo sin ningún encabezado de descarga de por medio — con eso, Chrome normalmente lo muestra en su propio lector en vez de bajarlo a disco.
- Si su equipo tiene marcado "Descargar los PDF en vez de abrirlos en Chrome", Chrome respeta esa preferencia igual — ese único caso sigue quedando fuera del alcance de cualquier script, y ahí el ajuste real es en `chrome://settings/content/pdfDocuments`.
- Y si por lo que sea la traída del PDF falla (red, sesión, lo que sea), cae exactamente al comportamiento de siempre — la pestaña nunca se queda muda ni en blanco.


## [Versión 16.2.0] — 2026-08-20 (El módulo de Ordenar deja de ofrecer lo que no aplica, la Guía deja de fiarse de un clic, y la agenda vuelve a autoseleccionar el cupo del control habitual)

Tres cosas más de hoy, con la agenda ya en manos de su compañera también. Banco: **1.922 comprobaciones en verde, cobertura 100 % (695/695)**.

### 📋 Ordenar: si el paciente no aplica a nada, no se ofrece nada
- Antes, sin coincidencia con la base de PyM, el modal caía al catálogo institucional COMPLETO para marcar a mano — justo lo que usted pidió evitar: *"QUIERO QUE NO APAREZCA NADA PARA ORDENAR CUANDO EL PACIENTE NO APLICA A NINGUNA ACTIVIDAD"*. Ahora, sin coincidencia, no se ofrece ni una sola casilla: el aviso lo dice de frente y remite al catálogo institucional real de Ordenamientos en Everest si de verdad corresponde algo.

### 🧠 La Guía ya no da por hecho que "Entendido" significa "hecho"
- Un clic en «Entendido» apagaba el aviso para ese paciente el resto de la sesión, sin verificar que la acción real hubiera ocurrido. Ahora ese clic solo compra un respiro de 1-2 minutos; si la tarea de verdad sigue pendiente, la guía se lo vuelve a decir sola — porque ya recalcula del estado real en cada vuelta, no de clics. «No volver a mostrar esta ayuda» sigue siendo la única salida permanente, sin condiciones — esa sí es una decisión explícita suya.

### ⭐ El cupo sugerido del "control habitual" vuelve a marcarse solo
- Hallazgo de campo con pantallazo: el recuadro de complejidad prometía *"🟡 Control habitual → Sugerido: Segunda mitad o cupo adicional (:30)"*, pero ningún turno se marcaba con la insignia — esa franja nunca tuvo su pieza de código, a diferencia del paciente complejo (🔴) o el estable (🟢), que sí funcionaban. Ahora sí: primero busca un cupo :30 real libre (el "cupo adicional" que no le quita el puesto a nadie), y si no hay, la mitad más tardía de los turnos del día.
- Ojo con un matiz a propósito: si el asistente todavía no tiene ningún dato del paciente (sin resumen, sin ninguna etiqueta de programa), no se inventa una sugerencia solo porque "control habitual" es el default de "no sabemos" — eso se queda tal cual estaba, sin insignia.

### 🔒 Limpieza de datos de prueba
- Un nombre completo y una cédula reales quedaron, desde antes de esta ronda, en 9 archivos de prueba (y un comentario del script) como dato de ejemplo. Reemplazados por datos de prueba genéricos, cuidando que las pruebas que sí dependían de ese apellido (la lista de médicos con agenda 100% RCV) lo conservaran.

## [Versión 16.1.0] — 2026-08-20 (Correcciones de campo: cada botón en su pestaña, el azul de Everest afuera, y el asistente deja de contradecirse)

Todo lo que reportó con pantallazos hoy. Banco: **1.917 comprobaciones en verde, cobertura 100 % (695/695)**.

### 🩺 Cada botón, solo en su pestaña
- **«Normalidad» ahora solo aparece en Revisión por sistema y Examen físico.** **«Auto-Labs» solo en Ruta Crónicos.** Antes se mostraban por parecido de casillas —y Paraclínicos también tiene casillas «resultado…», y el marcador que usaba Examen físico aparece suelto en Ruta Crónicos—, por eso se colaban.
- Ahora la puerta es la **identidad de la pestaña abierta**, leída de la barra de la propia Everest. Si algún día esa barra cambia, los botones vuelven al criterio anterior en vez de desaparecer.

### ↩ El «Deshacer» ya no se queda pegado
- Se retira solo **a los 20 segundos** si nadie se arrepiente, y también **si usted cambia de pestaña** (deshacer casillas que ya no están en pantalla no tiene sentido). Por dentro, el respaldo sigue guardado sus 5 minutos: no se pierde nada de lo que se puede restaurar.

### 🎨 El azul de Everest, fuera de los módulos
- Los módulos nuevos (Ficha y Riesgo y exámenes) cuelgan por fuera del panel, así que la hoja de estilos de Everest les ganaba la partida: los valores salían azules y **los criterios del «Por qué» quedaban azul oscuro sobre fondo oscuro, ilegibles**. Ahora **cada pieza de texto de los dos módulos fija su propio color**, con la misma regla de la casa que ya protegía el widget, la barra de Ajustes y el panel de cita creada.

### 🤝 El asistente deja de contradecirse
- El agendamiento decía *«no se pudieron leer los exámenes del paciente»* **justo después** de que Auto-Labs los leyera y los llenara. Era mentira: lo que pasaba es que ese paciente **no tenía programa de crónicos identificado**, y sin programa no hay tabla de vigencias que aplicar. Ahora el cartel dice la razón exacta: no pude leer / no tiene programa / no tiene exámenes por vigilar — cada una con su salida.

### 🧠 El asistente ahora RECUERDA lo que ve en cada pestaña
- Causa de fondo del punto anterior: un paciente con **«Hipertensión Arterial» marcada en Ruta Crónicos** salía «sin programa», porque el asistente solo miraba los antecedentes (que estaban en blanco) y esa pestaña ni siquiera estaba en pantalla.
- Ahora, mientras usted navega la historia, **el asistente va guardando lo que cada pestaña revela** (empezando por las casillas de «Ingreso a programa») en una memoria por paciente que dura la sesión. Eso alimenta la clasificación de riesgo y las vigencias sin pedirle nada extra y **sin tocar la historia**.

### 🕒 Las fechas y la hora, siempre a la vista
- En la tarjeta de la toma de muestras, la **hora** vivía dentro de «Cambiar fecha u hora» y desaparecía al plegarla. Ahora la línea de arriba muestra siempre **toma + hora + control**, esté plegado o no.

### 📱 El recordatorio de control ahora al celular (como lo hace Everest de verdad)
- Las citas de control de Everest avisan por SMS al celular, no por correo — usted lo señaló y el módulo de cierre ya lo refleja: el botón visible ahora es **«📱 Reenviar el recordatorio al celular»**, con el número ya puesto (el que quedó registrado al crear la cita), usando el mismo servicio real de SMS de Everest que ya estaba capturado. El botón de correo se retiró de la vista normal — sigue existiendo, marcado «en pruebas», solo en modo programador, mientras no exista una captura real de esa llamada.
- De paso, el campo de texto del celular —que salía angosto y apretado junto a «Enviar»— ahora ocupa todo el ancho, en su propia línea, como el resto del panel.

### 🧹 Los botones ya no se cuelan a pantallas donde no aplican
- **«Auto-Labs Athenea» ya no aparece en Citas del día** ni en ninguna otra pantalla fuera de la historia clínica. La corrección de pestañas de este mismo paquete solo ocultaba el botón al cambiar de pestaña *dentro* de la historia; si usted salía del todo del módulo, el botón se quedaba pegado. Ahora se retira por completo (no solo se esconde) en cuanto sale de la historia clínica.

### 💊 «Medicamentos activos»: solo los del riesgo cardiovascular
- La lista de medicamentos activos —en la Ficha, en lo que se le envía al asistente de IA y en las cuentas internas que arman las fechas sugeridas— ahora muestra **solo** los que tratan hipertensión, diabetes, dislipidemia, enfermedad renal crónica o protección cardiovascular en general, con la razón al lado (p. ej. «Losartán — hipertensión»). El resto de la fórmula no se menciona ni se cuenta para ningún cálculo clínico-administrativo, tal como usted lo pidió.
- **La seguridad de dosis renal no pierde nada:** el motor que avisa por AINEs, nitrofurantoína, gabapentinoides y demás sigue viendo la fórmula COMPLETA por dentro — el filtro solo aplica a lo que se muestra y a lo que se cuenta; nunca a lo que se vigila por seguridad. Verificado línea por línea antes de cerrar esta versión.


## [Versión 16.0.0] — 2026-08-20 (Módulo nuevo: «Riesgo y exámenes» — la clasificación con su porqué, las dos TFG y las vigencias del programa)

El módulo que pidió, al estilo del Promptware, dentro de la historia clínica. Banco: **1.896 comprobaciones en verde, cobertura 100 % (685/685 funciones públicas)**.

### ❤️ Un módulo propio (el botón de beta por fin se abre)
- El botón «🔒 Riesgo CV (beta)» del widget deja de estar bloqueado y pasa a ser **«❤️ Riesgo y exámenes»**, con contenido de verdad. También se entra desde el **módulo de agendamiento**, con un enlace bajo la fecha sugerida: «❤️ Ver riesgo cardiovascular y vigencias de exámenes».

### 🫀 La clasificación, y POR QUÉ es esa
- La categoría de riesgo cardiovascular se muestra grande y en color, y **debajo van los criterios exactos que la produjeron** (los mismos de la norma), con el paso de la regla que la decidió y la fuente. Nunca una categoría a secas: si falta un dato para clasificar, lo dice en vez de arriesgar un número.

### 🧪 La función renal por las DOS fórmulas, sin confundirlas
- Dos tarjetas lado a lado: **Cockcroft-Gault** («la que rige las vigencias del programa») y **CKD-EPI 2021** («la de la clasificación clínica y el riesgo»), cada una con su TFG y su estadio, y con qué peso y creatinina se calcularon.
- Si las dos no coinciden, se dice cuántos estadios de diferencia hay y cuál manda para qué. Si el paciente cumple criterio de remisión a nefrología, aparece con su motivo.

### 📋 Qué ordenar en la próxima toma — con la fecha de vencimiento al lado
- Lista de los exámenes que hay que pedir, cada uno con **qué le pasa** («Nunca se le ha tomado», «Venció el 12 jun», «Vence el 20 nov: se aprovecha el mismo viaje») **y su fecha a la derecha**, para ver de un vistazo qué está por caducar.
- Debajo, **«Lo que sigue vigente»**: el resto de los exámenes del programa, del que vence primero al último, con la fecha y los días que le quedan. Los que la norma no contempla en ese estadio se listan aparte, dichos como lo que son: no aplican.
- Y el cierre con las dos fechas que ya calculaba el asistente: toma sugerida y control.

### 🎯 Un solo programa manda las vigencias, y se ve cuál
- Aunque el paciente esté inscrito en dos o tres programas, **las vigencias las fija uno solo**: primero renal, luego diabetes, luego hipertensión. El módulo muestra el que manda, cuáles quedaron desplazados y lo explica en una frase.

### 🔄 Se actualiza solo mientras usted trabaja
- Con la ventana abierta, el asistente **revisa la historia cada 20 segundos**. Si usted documentó algo nuevo (tensión, peso, un factor de riesgo, un antecedente), **reclasifica solo** y avisa qué cambió: *«Se actualizó con lo que acaba de escribir en la historia (tabaquismo, tensión sistólica)»*.
- Ese repaso **no vuelve a consultar laboratorios** — es la parte lenta y no cambia mientras usted escribe. Para eso está el botón **«🔄 Buscar laboratorios nuevos»**, que sí los pide de nuevo cuando usted quiera.


## [Versión 15.9.0] — 2026-08-20 (El cierre de la cita igual al de Everest, y ninguna fecha que deje vencer un examen en silencio)

Sus dos encargos de hoy, completos. Banco: **1.882 comprobaciones en verde, cobertura 100 % (680/680 funciones públicas)**.

### 🖨️ El módulo de cierre que usted ya conoce — ahora dentro del asistente
- Al crear la cita, el asistente despliega **el mismo cierre del módulo de Acceso de Everest** (con nuestros colores): el nombre del paciente, la fecha, la hora y el servicio, y las **dos salidas de siempre — «🖨️ Imprimir recordatorio» y «✉️ Enviar al correo del paciente»**. La idea es que nadie tenga que aprender nada nuevo: es el gesto que ya hacían a mano.
- **Imprimir** usa el mismo servicio de Everest de siempre, así que funciona desde el primer día.
- **Enviar al correo**: esa llamada de Everest no quedó grabada en ninguna captura y **no se adivina una dirección que manda correos a pacientes**. El botón aparece igual, y mientras no esté configurado lo dice de frente y remite a la impresión. Con la guía **CAPTURAR_MENSAJES.md** (parte 2) usted la captura una vez, la pega en Ajustes → modo programador, y el botón queda enviando de verdad. Antes de enviar, el asistente pide y verifica el correo, y solo canta «enviado» si el servidor respondió que sí.

### 🧪 El recordatorio de la TOMA DE MUESTRAS — el papel que AppCita no imprime
- Cuando además se agenda la toma, el cierre suma **«🖨️ Imprimir recordatorio de la toma»**: un papel limpio, listo para Ctrl+P, con paciente, documento, fecha, hora, lugar y **el número de la cita que devolvió AppCita**. Esa opción no existía en ningún lado — ni en Everest ni en el flujo manual.
- Como usted decidió, **no lleva ninguna instrucción clínica sin confirmar**: cierra con «consulte en el laboratorio la preparación que requiere su examen». El nombre de la sede se configura una vez en modo programador.
- **También en SOLO Laboratorios**: si solo se agendó la toma, sale el mismo cierre con su recordatorio (y sin los botones de una cita que no se creó).

### ⚠️ «Esta fecha deja vencer un examen» — con las dos salidas en la mano
- Si la fecha elegida haría que **la toma quede después del vencimiento** de algún examen del programa del paciente, el asistente lo dice en el momento: *«Con esa fecha, la toma quedaría el 10 dic — 20 días después de que vence Creatinina sérica (20 nov). Ese resultado llegaría vencido a la consulta.»*
- Dos botones, ninguna imposición: **«🎯 Pasar a la fecha sugerida»** (mueve cita y toma a lo que manda la norma) o **«Continuar con mi fecha»** (el aviso se retira y no vuelve a molestar por esa fecha).
- Sale **en los dos momentos** que usted pidió: al elegir el día y otra vez al confirmar, si la fecha sigue siendo tardía — ahí basta con volver a pulsar para seguir adelante.
- Como usted precisó, **la referencia del aviso es siempre la fecha de la toma de laboratorio**, que es la que de verdad decide si un resultado llega vencido: mover la toma unos días antes apaga el aviso aunque la consulta no se mueva. Todas las demás reglas de sugerencia (plazo elegido, vigencias, labs primero, complejidad y sábados) siguen exactamente como estaban.


## [Versión 15.8.0] — 2026-08-20 (Las 5 propuestas aprobadas, construidas: fecha inteligente por vigencias, primer cupo, semáforo de salud, vista del SMS y tamaño de letra)

Las cinco propuestas que usted aprobó del recorrido del médico primerizo (N1–N5), más su redefinición de la N3 y las 4 decisiones de la entrevista del 20-08. Banco: **1.862 comprobaciones en verde, cobertura 100 % de las funciones públicas (674/674)**.

### 🎯 La fecha sugerida ahora es INTELIGENTE: su plazo × las vigencias de los exámenes (N3, redefinida por usted)
- **Su elección sigue mandando**: los plazos de siempre (15 días, 1 a 6 meses) quedan como la primera decisión del médico. Con cada plazo que toque, el sistema lo revisa contra las **vigencias de cada examen del programa rector del paciente** (ERC primero; si no, Diabetes; si no, Hipertensión — la prioridad de la norma que ya venía aplicándose).
- **Si a la fecha elegida todo sigue vigente**, se respeta su plazo tal cual y el banner lo dice: «Se respeta su plazo: todos los exámenes del programa ERC siguen vigentes a esa fecha».
- **Si algún examen vencería antes**, manda el sistema de siempre de toma-y-control (CERO VENCIDOS): la toma de laboratorios se pone en el vencimiento más próximo y el control ~4–14 días después, para recibir al paciente con resultados frescos. El banner lo explica con nombre propio: «Creatinina sérica vence el jue 19 nov: con el plazo elegido llegaría vencido → toma el 19 nov y control el 26 nov». (Decidido en entrevista: «toma al vencer + control después».)
- **Al abrir el módulo, la sugerencia ya viene puesta**: el plazo que mejor calza con ella aparece marcado y el calendario centrado en la fecha sugerida — siempre con la opción de tocar cualquier otro plazo, el calendario manual o el primer cupo.
- **El análisis ya no exige abrir Laboratorios primero**: si falta, el propio módulo de agendamiento lo calcula solo en segundo plano (2–5 s). Y si llega cuando usted ya está mirando horarios, **no le mueve nada**: actualiza el banner y le ofrece un botón «Usar esta fecha» — usted decide. Si las fuentes no responden, lo dice honesto y usted elige el plazo como siempre.
- El «¿por qué esta fecha?» pedido en la propuesta original vive en ese mismo banner: una frase, en lenguaje de consultorio, nunca un tratado.

### ⚡ «Primer cupo disponible» (N1) — lo más pedido en ventanilla
- Botón nuevo junto al calendario manual: recorre la agenda **desde mañana**, día por día (domingos y festivos afuera; los sábados los decide su agenda propia), y aterriza en el **primer día suyo con turnos libres de verdad** (agenda validada y turnos activos), mostrando sus horarios de una vez.
- Horizonte honesto de **30 días hábiles**: si no hay nada, lo dice sin rodeos y le deja el calendario manual a mano. No cambia ninguna regla clínica: es un buscador, no una sugerencia — por eso entra como el modo manual (sin estrella) y con «↩ Volver a las sugerencias».

### 🚦 Semáforo de salud del asistente (N2) — la falla silenciosa deja de ser silenciosa
- El punto de estado del panel ahora vigila **cuatro frentes**: Agenda del día, Historia clínica, Laboratorios (Athenea) y Lista de prevención (PyM). Si alguno lleva **3 minutos o más sin poder leerse**, el punto se pone **ámbar** (los parpadeos pasajeros de Everest no alarman).
- **Tóquelo y le cuenta**: un globito con los cuatro renglones en lenguaje llano — «Laboratorios (Athenea) — no se está pudiendo leer; puede seguir su consulta normal; si persiste, avise al administrador». El punto de la pastilla flotante se pinta igual. Para usted: el reporte telefónico llega con el dedo puesto en el módulo exacto.

### 📱 Vista previa del SMS del paciente (N4)
- En la casilla del SMS (y en la de la toma de laboratorios) hay un enlace nuevo: **«Ver el mensaje que le llegará al paciente»**. Mientras no se capture el texto real, la vista dice honestamente **qué contiene** el mensaje (fecha, hora y sede de esta cita) y aclara que la redacción exacta la pone Everest — nunca se inventa una redacción «oficial».
- Cuando usted capture el mensaje real (guía **CAPTURAR_SMS.md** en esta entrega, como lo pidió), lo pega en Ajustes → modo programador con los comodines {fecha} {hora} {sede} {profesional}, y desde ahí la vista previa muestra **el texto exacto** con los datos de cada cita.

### 🔠 Tamaño de letra del asistente (N5)
- Ajustes → Apariencia → **«Tamaño de letra»: Normal / Grande / Muy grande**. Escala TODO el asistente de una vez (panel, botones, ventanas) — pensado para monitores de 1366×768, luz mala y presbicia. Con previsualización inmediata al elegir, igual que el tema, y Guardar/Descartar de siempre.


## [Versión 15.7.1] — 2026-08-20 (El recorrido del médico primerizo: 18 correcciones de claridad)

Recorrí el asistente completo como un médico que lo usa por primera vez (con sus capturas reales de Everest y las grabaciones de consultorio). Informe completo aparte (INFORME_UX_PRIMERIZO.md) y 6 propuestas nuevas para elegir (PROPUESTAS_UX_NUEVAS.md). Lo corregido de una vez:

- **El botón fantasma «Abrir PyM»**: dos avisos mandaban a un botón que no existía con ese nombre (la carga es el icono 📂). Ahora el 📂 se llama «Abrir PyM» y los avisos señalan exactamente ese botón. Era el bloqueo más real para un novato.
- **Una promesa FALSA en el modal de órdenes**: la leyenda decía que los códigos se documentan «automáticamente en segundo plano» — comportamiento retirado en v15.3. Ahora dice la verdad (la orden se crea en el módulo oficial y se abre para imprimir; los códigos en la historia los escribe usted). El botón «Generar Órdenes en Conducta» también mentía: quedó «✓ Generar la(s) Orden(es)».
- **Jerga interna fuera**: «Vigilando (directo)» → «Vigilando la agenda»; «Espejo» → «Vigilando (desde otra pestaña)»; la versión salió del título del panel (queda en Ajustes → «Acerca del asistente»); «Diagnóstico técnico» del resumen del turno solo aparece en modo programador; «Briefing» → «Resumen previo».
- **Avisos re-redactados**: el de la fecha no anotada («guardada localmente…») ahora dice solo lo que el médico debe hacer; el de falta de lista de prevención señala el 📂; y cayeron los últimos restos de tuteo («Pulsa "Permitir"», «Recibirás…», «Prueba haciendo clic», «Selecciona al menos una orden»).
- Verificados como BIEN resueltos (sin tocar): la píldora de complejidad clínica, el diálogo de anular, el cartel único del paciente, los estados vacíos con salida, los chips de sábado y el recibo contado.


## [Versión 15.7.0] — 2026-08-20 (Sus 8 órdenes de la revisión, ejecutadas completas)

Todo lo de esta versión salió de sus comentarios sobre el registro de novedades. Banco: **1.840 comprobaciones en verde** y — como lo exigió — **cobertura del 100 % de las funciones públicas** (661/661; las 55 anidadas se prueban a través de sus dueñas, y el medidor ahora lo dice tal cual en vez de mentir hacia abajo).

### 📅 Agendamiento: MODO MANUAL con calendario (su pedido, tal cual)
- En el paso de fecha hay un control nuevo, visible y sin taparse con nada: **«📅 Elegir fecha en el calendario…»**. Al elegir una fecha, **se cancelan las sugerencias del asistente** (ni banner, ni ⭐, ni reordenar): se muestran los turnos de esa fecha **±7 días hábiles**, en su orden natural. Usted manda.
- **«↩ Volver a las sugerencias»** restaura todo tal como estaba (y tocar cualquier plazo de sugerencias también sale del modo manual). Una fecha pasada se rechaza con explicación.
- **La toma de muestras tiene la misma modalidad**: calendario propio («📅 Otra fecha para la toma…») tanto dentro de la cita como en SOLO Laboratorios, y en modo manual el refinado automático de labs-primero se calla.

### 🖨️ PyM: la orden se abre SOLA lista para imprimir (como Everest)
- Al generar las órdenes, se abre automáticamente **una pestaña con el documento oficial listo para Ctrl+P** — la pestaña se abre en el clic mismo (después el navegador la bloquearía) y navega a la orden real solo cuando el servidor la confirma; si algo falla, se cierra sola y no queda una pestaña en blanco.
- Con varios agrupadores, el primero se abre solo y los demás quedan con su botón (el navegador solo permite una pestaña por clic).

### 🗑️ Retiro COMPLETO del clic-en-Conducta (su orden: «totalmente fuera del código»)
- Salió del código **toda** la maquinaria que escribía en la historia simulando clics: el catálogo de textos capturados, el buscador de Conducta/Impresión Diagnóstica, el gesto tipear-clic-Agregar, las colas de pendientes con su tope de intentos, y **también el botón «Agregar a Conducta»** del modal de Ordenamiento.
- El ordenamiento oficial es **únicamente el módulo PyM** (la orden por Ordenamientos de Everest). La suite 53 quedó convertida en **pines de permanencia**: si algo de eso intenta volver, el banco lo rechaza. La evidencia de campo que alimentaba los catálogos sigue en el repositorio por si algún día se necesita.

### 📡 Telemetría: el embudo COMPLETO, de inicio a fin
- Cada intento de envío deja su sello: **último envío confirmado** y **último fallo con causa legible** («la hoja pidió inicio de sesión», «sin red hacia el panel», «respuesta 500»…).
- En el modo programador, **«Probar y diagnosticar»** revisa el embudo **puerta por puerta** y lo muestra tal cual: interruptor → dirección del panel → permiso de red → cola de salida (cuántas filas y hace cuánto esperan) → último envío → último fallo → resumen diario de ayer → nombre del consultorio. La primera puerta cerrada explica el silencio.
- Autochequeo al arrancar: si el envío está encendido, lleva 3+ días sin confirmar y hay cola acumulada, queda constancia (para el programador) con la ruta del diagnóstico.

### 🗣️ Redacción de consumidor final — ahora sí en TODO el script
- Se inventariaron **las 241 cadenas visibles** (avisos, botones, burbujas, títulos, campos) y se corrigió todo lo que hablaba en técnico o tuteaba: los tres avisos de Athenea (que además mandaban a una sección de Ajustes que ya no existe para el médico), «analitos» → «resultados», el aviso de Chrome, los errores de archivo PyM, las instrucciones de notificaciones, los acuses («✅ ¡Cita creada exitosamente!»), y más.
- **Auditoría de todos los avisos** (color y persistencia, la mejor experiencia): lo crítico quedó ROJO y persistente (cita no creada, pausa de seguridad, órdenes no generadas, Athenea caída), lo informativo dejó de quedarse pegado en pantalla (anular cita con radicado viejo, deshacer con otro paciente), y cada aviso dice qué hacer.

### 💯 Cobertura del 100 % (su exigencia)
- Se cubrieron las funciones que faltaban (el trío del uroanálisis y la anulación delegada) y se escribieron **invocaciones directas** para todo lo que solo se probaba de rebote (feedback de botones, modo oculto, borrador de Ajustes, atajo del modo programador, almacén de la guía…).
- El medidor se corrigió: contaba funciones ANIDADAS (imposibles de probar una a una desde afuera) en el denominador, así que el 100 % era matemáticamente inalcanzable. Ahora mide la superficie pública real y reporta las anidadas aparte. **661/661 = 100,0 %.**

### 🎨 Estética y mapa del archivo (pasada final, sin tocar comportamiento)
- El archivo abre ahora con un **masthead**: qué es el Vigilante, el **mapa de módulos** (para encontrar cada uno con Ctrl+F) y las **5 reglas de oro** del proyecto, cada una con su prueba. La descripción del encabezado quedó limpia.
- A propósito NO se reformateó el cuerpo del código (reindentar 23.000 líneas de producción es riesgo puro sin ganancia funcional): la estética se concentró donde ayuda a un humano a navegar el archivo.


## [Versión 15.6.1] — 2026-08-20 (Sus 4 reportes de esta mañana, en caliente)

- **Ajustes más limpios para el médico**: la tarjeta informativa «Aviso del paciente al abrir la historia» (que no tenía nada que decidir) y **todo el grupo de Athenea** (credenciales de la sede — configuración de instalación, una vez por equipo) se movieron al modo programador. El médico ya solo ve opciones que le sirven.
- **Redacción revisada de los textos de Ajustes** (en v15.7.0 el barrido se extendió a TODOS los textos del script, como usted lo pidió): sin mecánica interna («flujos», «aplica de una vez», «almacén del navegador»), sin mayúsculas gritadas; cada opción dice qué gana usted al encenderla.
- **La barra «Tiene cambios sin guardar» quedó bien puesta**: era translúcida y el contenido se veía a través de ella (su pantallazo), y el azul de Everest se colaba en el texto. Ahora es una bandeja sólida con el color propio del asistente.


## [Versión 15.6.0] — 2026-08-20 (Las 3 propuestas aprobadas + Ajustes con Guardar + todo en su sitio)

Esta entrega ejecuta sus tres aprobaciones de anoche (Ficha viva, Redactor con IA, Guía paso a paso), los dos arreglos restantes de la auditoría, el barrido de lenguaje y el reacomodo visual según su pantallazo. Banco: **1.883 comprobaciones en verde**.

### 🧾 Ficha del paciente (Propuesta 1 — la «ficha viva»)
- Nuevo botón **🧾 Ficha** en el widget: muestra en segundos **qué leyó el asistente y de dónde salió cada dato** — edad y peso (Everest), laboratorios con fecha (Athenea/Annar/Citi), presión y factores (lo escrito hoy en la historia), medicamentos (órdenes de Everest), y lo calculado (filtrado renal, riesgo, programa rector) declarado como calculado.
- Su regla de oro quedó cableada y probada: **sin dato = sin suposición**. Lo que falta dice «— sin dato» en ámbar y un aviso cuenta cuántos insumos faltan; el asistente jamás rellena con valores plausibles.
- La cabecera dice **qué tan fresca es la lectura** («calculada hace X min») y el botón «🔄 Recalcular ahora» fuerza una lectura nueva de las fuentes reales. Es el MISMO resumen del que beben Laboratorios, el triaje y el redactor: una sola verdad por paciente.

### ✍ Redactar con IA (Propuesta 3 — módulo propio, ya separado del beta)
- Nuevo botón **✍ Redactar**: borradores completos para las casillas de texto libre reales de la historia (mapeadas de sus capturas reales de las pantallas de Everest): **Motivo de consulta, Enfermedad actual, Análisis y plan, Recomendaciones y el recuadro de la Ruta de Crónicos**.
- Gemini redacta **desde toda la historia disponible** (la misma ficha viva) y usted tiene un campo de **«Indicaciones para este borrador»** para decirle qué tener en cuenta — como pidió. El texto sale con la redacción natural de un médico (las reglas de la casa: mayúsculas sostenidas, diagnósticos en extenso, cero relleno, cero inferencia).
- **Nada se escribe solo**: usted genera, revisa, edita e inserta. Si la casilla ya tiene texto, NO se pisa — se le ofrece «Reemplazar» y siempre queda **↩ Deshacer**. Si cambió de paciente, el asistente se niega a insertar.
- **Privacidad intacta**: a Gemini viajan solo datos clínicos desidentificados (la misma barrera de siempre) y sus indicaciones pasan por el censor de nombres. Probado con pruebas nuevas.
- Optimizado para los modelos que usted indicó (gemini-3.5/3.1-flash-lite con reserva 2.5/3.5/3.7): en las casillas se pide **pensamiento mínimo** (más rápido y barato — plantillar no es razonar), sin recortar el tope de salida (lección de las notas truncadas), con la rotación por cuota de siempre.
- El **Riesgo CV queda solo y en beta** (rotulado «Riesgo CV (beta)»), como ordenó: la redacción ya no vive dentro de él.
- **HALLAZGO de fondo arreglado**: los paneles de Riesgo, Redacción IA y Datos del paciente **nunca tuvieron regla de posición en pantalla** — se anexaban al fondo del documento, invisibles. Eso explica el «no hace nada» que usted reportó del botón ❤️. Ya comparten el esqueleto de los demás modales (probado).

### 🧭 Guía paso a paso (Propuesta 6 — el modo acompañado)
- **Una burbuja a la vez**, pegada al botón que toca usar, que sugiere el siguiente paso natural según el estado real del paciente: primero leerlo (Ficha), luego agendar (con labs primero si hay pendientes), luego prevención; y en la pestaña de examen físico, el botón de Normalidad.
- **Se enciende sola para un médico que el script no ha visto nunca** y **se apaga sola cuando ya completó 5 flujos reales** (citas creadas, órdenes generadas, textos insertados) — avisándolo. Interruptor en Ajustes para prenderla cuando llegue alguien nuevo.
- Jamás suena, jamás tapa un modal, «Entendido» la despide para ese paciente y «No volver a mostrar esta ayuda» la veta para siempre (por médico). Cuenta los flujos aunque las estadísticas de uso estén apagadas.

### 💾 Ajustes ahora se GUARDAN como en cualquier programa (su pedido)
- Cambiar opciones ya no aplica al vuelo: aparece la barra **«Tiene cambios sin guardar — Descartar / 💾 Guardar cambios»** (el patrón moderno de las apps actuales). Guardar aplica y persiste todo junto; Descartar devuelve lo guardado.
- Si intenta cerrar con cambios pendientes: **«¿Guardar los cambios antes de salir?»** con dos salidas claras. El tema y el volumen se previsualizan al moverlos y se revierten solos si descarta.
- Los botones de acción (probar, credenciales, restablecer) siguen actuando de inmediato — son acciones, no opciones. Restablecer y Borrar credenciales ahora piden **doble toque** en el propio botón (adiós ventanas del navegador).

### 🔒 Modo programador (Ctrl+Shift+D) — lo técnico fuera de la vista del médico
- Todo lo que el médico no tiene por qué ver vive ahora en un grupo que **solo aparece con Ctrl+Shift+D** (no se guarda: al recargar vuelve a esconderse): la **clave de Gemini** (una para toda la sede), el interruptor de la redacción IA, las opciones técnicas de siempre, y el **estado del envío al panel de seguimiento**.
- Sobre su CSV: la telemetría al panel **sí funcionó hasta el 11-08 (v12.3.0) y lleva 8 días muda**. Ahora el modo programador muestra «último envío confirmado hace X · filas esperando salir: N» y el botón **«Probar ahora»** (que usted extrañaba) volvió aquí. La columna «fraude» que se ve como fechas de 1899 es formato de la hoja de Google: seleccione la columna → Formato → Número (los datos llegan bien).

### 🎨 Todo en su sitio (su pantallazo del 19-08)
- El **widget de acciones se mudó a la columna izquierda libre** (la franja de la barra azul de Everest): a la derecha tapaba el botón «Información» del paciente. La pastilla del asistente ya no nace sobre el botón «Historial»; Normalidad y Auto-Labs quedaron compactos en esa misma columna sin invadir el formulario (por eso el rótulo corto «🩺 Normalidad»).
- Auditoría H1 y H2 aplicadas: las estadísticas de uso escriben a disco **en tandas de 2 s** (antes reescribían todo el objeto en cada clic) y el modo rendimiento ahora también apaga las **sombras**.

### 🗣️ Barrido de lenguaje (todo «bien masticado»)
- **Cero ventanas del navegador en todo el script** (se convirtieron las 18 que quedaban: informes de Athenea, credenciales, restablecer, bitácora, cita rechazada, pausa de seguridad…): todos los avisos van por los recuadros propios, en lenguaje llano y diciendo qué hacer.
- Se corrigieron textos con tecnicismos y uno que mandaba a un campo de Ajustes que ya no existe (la identidad del médico se detecta sola en la agenda).


## [Versión 15.5.0] — 2026-08-19 (Anular citas DE VERDAD + botones a prueba de niños + modo oculto + auditoría de rendimiento)

Esta entrega nace de su captura del endpoint real de anulación (gracias por el .json del consultorio), de su entrevista de mejoras y de la auditoría de rendimiento que usted pidió y que se ejecutó completa.

### 🗑️ Anular citas: ahora es REAL (su captura del consultorio)
- Hasta hoy, «anular» solo borraba las marcas locales del script: la cita seguía viva en Everest. Ahora el botón llama al **servicio real de Everest** (`CancelarCita`), replicando exactamente el contrato que usted capturó: mismo endpoint, misma consulta, mismo cuerpo (estado CAN, motivo, médico).
- **Regla de oro fijada con prueba**: las marcas locales se limpian **ÚNICAMENTE si Everest confirma** («Cancelado Correctamente»). Si Everest dice que no, o la red falla, nada se toca y se le dice con claridad — el script jamás le miente diciendo que anuló algo que no anuló.
- Al anular se pide el **motivo** con los mismos motivos del formulario de Everest (Prefiere otra fecha / No puede asistir / Error de agendamiento / Otro), en un recuadro propio — se acabó el confirm() feo del navegador.
- Citas agendadas con versiones viejas del script (sin radicado guardado): se le avisa con honestidad que esa hay que anularla en Everest directamente — no se dispara nada a ciegas.
- Pendiente que usted ya conoce: la anulación de la CITA DE LABORATORIO espera su captura desde la red de la empresa (el grabador ya la enmascara en origen).

### 🙈 Modo oculto: todo el script desaparece con un toque (su pedido)
- **Ctrl+Shift+V** o el puntico «V» discreto de la esquina: ocultan/muestran TODO lo visual del Vigilante (panel, widget, botones de Normalidad y Auto-Labs, avisos en página). La elección queda guardada y sobrevive recargas.
- La vigilancia de fondo (fraude, agenda, kill-switch) **sigue corriendo** — solo se esconde la ropa, no el cuerpo.

### 🧸 Normalidad fija y Auto-Labs: a prueba de niños (las 4 mejoras que eligió)
- **Aparecen solo donde aplican**: Normalidad fija solo en la pestaña de examen físico; Auto-Labs solo donde hay casillas de resultados. Donde no aplican, no están (antes estaban siempre, hicieran algo o no).
- **Recibo contado**: al terminar dicen exactamente qué hicieron — «✓ 45 escritas · 3 respetadas · 2 excluidas» — sobre el propio botón (verde si hizo, ámbar si no había nada que hacer).
- **Botón Deshacer**: tras cada escritura aparece «↩ Deshacer» por 5 minutos, que restaura TAL CUAL lo que había antes — casilla por casilla — y solo si la historia abierta sigue siendo la del mismo paciente.
- **Cero ventanas del navegador**: se eliminaron todos los alert() nativos; todo aviso va en los recuadros propios del script, con el mismo lenguaje llano.

### 🔒 Riesgo + IA: beta cerrada (mientras lo construimos)
- El botón sigue visible (desaparecerlo haría creer que se perdió otra vez) pero queda **bloqueado y rotulado «beta»**: al tocarlo explica que el módulo está en construcción. Una prueba nueva fija que ese clic no pueda abrir nada hasta que lo liberemos.

### 🧹 Ajustes: solo queda lo que merece estar (su barrido)
- Fuera: campos de servidor, identidad manual del médico (ahora es un renglón de solo lectura con el médico en sesión detectado), festivos manuales, tolerancia, refresco, probar comunicación, sincronizar almacenamiento y los controles de IA (van con la beta).
- Los **festivos de Colombia** ya no dependen de un campo olvidado: si la tabla del año está por vencer, el script se lo avisa solo, una vez al día, al arrancar.

### 🏎️ Auditoría de rendimiento ejecutada (su superprompt) — 6 arreglos, cero cambios de comportamiento
- El informe completo va aparte (INFORME_AUDITORIA_RENDIMIENTO.md). Lo aplicado: el observador de URL despierta 5× menos (1 s → 5 s); los botones de historia deciden su visibilidad con UNA consulta barata en vez de recorridos; el pintor del botón de silencio ya no reescribe si nada cambió; el **modo rendimiento ahora sí apaga TODA la GPU** (blur/animaciones/transiciones — antes se le escapaban 29 blurs y 37 animaciones); código muerto eliminado; y la memoria del modal de agendamiento quedó con tope. Costos que NO se tocaron por seguridad y por qué (latido anti-fraude de 5 s, base PyM diaria): en el informe.
- El banco de pruebas queda en **1.862 comprobaciones en verde** (92,2 % de funciones cubiertas), incluidas pruebas nuevas que fijan estos arreglos.


## [Versión 15.4.0] — 2026-08-19 (Sus 6 reportes de la tarde, resueltos + reglas clínicas nuevas de agendamiento)

Todo lo de esta entrega salió de sus reportes en vivo con pantallazos y de la entrevista de reglas clínicas. Cada cambio quedó fijado con pruebas (1.854 comprobaciones en verde).

### 🔔 Notificaciones: un aviso = un canal (su pedido de paz mental)
- Antes un solo evento crítico podía disparar hasta SEIS canales a la vez: notificación de Windows, tono, parpadeo del título, parpadeo del favicon, cartel y ventana emergente — y hasta una llegada a tiempo (VERDE) sonaba e iluminaba la pestaña.
- Ahora: **sonido solo en lo crítico** (ROJO repica hasta reconocer; MORADO un único tono; ámbar/verde/azul en silencio). **Canal visible: exactamente uno** — con la pestaña a la vista, el aviso sale dentro de la página y nada va a Windows; con la pestaña oculta, sale la notificación del sistema (Windows o, si la política de la IPS lo bloquea, la de la extensión — una de las dos, nunca ambas), y el toast queda solo como último respaldo. El parpadeo de pestaña quedó únicamente como señal de reserva para lo crítico cuando no hay ningún canal de sistema.
- La **ventana emergente se eliminó por duplicada** (hacía lo mismo que el cartel y que la notificación del sistema, encima de ellos). El botón de prueba de Ajustes ahora prueba exactamente la política real.

### 🗓️ Agendamiento: reglas clínicas nuevas (las que usted dictó)
- **Labs primero**: si el paciente tiene exámenes **vencidos o por vencer en ≤30 días**, la toma de laboratorios se prioriza en una ventana de **14–21 días calendario** (el primer día hábil con cupo real en AppCita) y el control médico queda **~7 días calendario después de la toma**, corrido al hábil siguiente si choca con festivo. Sin exámenes pendientes, rige la sugerencia clásica de siempre.
- **Fechas ligadas**: si usted mueve la toma, el control se recalcula solo (+7, hábil siguiente). Si usted ya había fijado el control a mano, no se le pisa: se le ofrece moverlo con un clic.
- **Triaje v2** (primera mitad vs. final de jornada): insulinorrequirentes, polifarmacia (≥5 fármacos), TFG<60, falla terapéutica, PA descontrolada o ≥3 crónicos → **primera mitad**. Estables con pocos medicamentos (bajo/moderado/alto estable) → **final de la jornada** (últimas 2 horas / últimos 4 cupos), incluido el diabético NO insulinorrequirente estable. Un diabético del que aún no hay resumen clínico se asume complejo (no se puede verificar la insulina). Los antecedentes entran desde la pestaña de Antecedentes y los medicamentos desde el motor farmacológico (lo último ordenado en Everest).

### 🎯 Agendamiento: fin de la ambigüedad visual (sus pantallazos 2 y 3)
- **Una sola selección**: quedaban DOS turnos marcados a la vez (el primero en verde y el ⭐ SUGERIDO aparte). Ahora se preselecciona únicamente el sugerido — o el primero si no hay sugerencia.
- **Sugeridos arriba**: el turno sugerido va de primero y la franja recomendada enseguida (las dos primeras filas son las sugerencias); el resto sigue en orden normal más abajo.
- **Adiós al falso seleccionado**: el chip de sábado ya no lleva borde punteado (parecía una segunda fecha elegida); se distingue por tono y su explicación al pasar el mouse.
- **BUG DE FONDO corregido**: el comparador de horas ignoraba AM/PM — "06:00 PM" se leía como las 6 de la MAÑANA, y por eso un turno de la tarde salía estrellado como si fuera de la franja matinal. Nuevo conversor de 24 horas en todas las comparaciones de franjas.

### 🧪 Paso de confirmación: tarjeta de plan unificado
- La pieza de Toma de Muestras (checkbox + 7 chips + selector, todo suelto) ahora es **una tarjeta que narra el plan completo** (toma → control) con un solo interruptor; los chips y la hora quedan tras «✎ Cambiar fecha u hora». Con la regla labs-primero activa, el interruptor nace **marcado**; en modo normal, desmarcado como siempre.

### 🧾 Modal de laboratorios: columna Ref./Rango (su pantallazo 1)
- Ninguno de los tres nombres de campo probados existe en el objeto real de Athenea (trae 24 claves con otros nombres). Ahora la referencia se busca **por forma** (cualquier clave que hable de referencia/rango, o el par mínimo–máximo compuesto). Si aun así no aparece, el diagnóstico de consola ahora imprime **los nombres reales de las 24 claves** — péguelo aquí y cierro el caso con el nombre exacto.

### 🧰 Widget flotante (su pantallazo 5)
- **Azul de Everest colándose**: los botones del dock viven fuera del área blindada, así que sus colores quedaron protegidos con la misma regla dura que ya usa el recuadro renal. 
- **Botón Riesgo + IA "no hace nada"**: el cableado interno está correcto; le puse detector — si vuelve a fallar, ahora sale el motivo exacto en consola y como aviso en pantalla, en vez de silencio.
- De paso: el observador de tareas largas emitía una advertencia de consola en cada arranque (banderas incompatibles) y su medición de arranque se perdía; corregido.

## [Versión 15.3.0] — 2026-08-19 (Reunión del trabajo hecho con Gemini/Antigravity + vuelta al PyM original)

Esta entrega junta en un solo archivo el trabajo que usted había hecho localmente con Gemini y que no aparecía por ningún lado, con todo lo que ya había en esta línea. Se recuperó reproduciendo una por una las 77 modificaciones que aquella sesión había hecho al archivo, a partir de su registro de trabajo. Nada de lo que ya funcionaba se perdió, y cada choque entre las dos versiones se resolvió con usted.

### 🗓️ El agendamiento vuelve a ser el asistente de 3 pasos
- Se recupera íntegro el rediseño: **paso 1** qué se va a agendar, **paso 2** fecha y horarios disponibles, **paso 3** resumen en tarjetas antes de confirmar. Antes era un formulario único y largo.
- Se conserva lo que ya tenía: el checkbox de PyM bloqueado para los médicos de RCV, las burbujas de ayuda, el aviso de cita duplicada del mismo día y la verificación de que el cupo siga libre justo antes de crear la cita.
- **Corregido sobre el rediseño**: al crear la cita el botón se quedaba colgado en «Asignando cita…» y nunca acusaba recibo. Vuelve a decir «✅ ¡Cita Creada Exitosamente!».
- **Corregido sobre el rediseño**: se había perdido el registro de uso del módulo (abrir → elegir horario → crear o abandonar). Restituido.

### 🫀 Riesgo cardiovascular con las dos fórmulas de función renal
- El modal de riesgo muestra ahora **las dos**: Cockcroft-Gault (para ajustar dosis y calcular vigencias) y CKD-EPI 2021 (para el estadio de enfermedad renal). Antes solo se veía una.
- Se conserva la entrada a la redacción asistida con sus cuatro modos.

### ⏱️ Horario sugerido: los dos criterios suman, ninguno rebaja al otro
- Convivían dos formas de decidir a qué franja mandar al paciente. La de Gemini sobrescribía siempre a la anterior, así que un paciente que ya estaba marcado para la primera mitad de la jornada podía terminar en un cupo de los :30 cuando su criterio no lo veía complejo (le falta el resumen clínico si nadie abrió Laboratorios todavía).
- Ahora **cualquiera de los dos puede subirlo a la primera mitad, y ninguno puede bajarlo**. Se queda siempre con el criterio más protector.

### 🧪 Uroanálisis y laboratorios legibles
- Se recupera el aislamiento de estilos del panel de uroanálisis: los valores se veían en azul oscuro sobre fondo oscuro, heredado de los estilos de Everest. Ahora tienen contraste propio.

### 📋 PyM vuelve a su forma original: la orden por el módulo de Ordenamientos
- **Retirado por decisión suya** el paso que, después de crear la orden, además escribía los códigos dentro de la historia clínica (el CIE-10 en Impresión Diagnóstica y los CUPS en Conducta) simulando su gesto manual, cambiando de pestaña y dejando en cola lo que no alcanzaba a poner.
- La orden se sigue creando exactamente igual, por el módulo de Ordenamientos de Everest. Los códigos en la historia los escribe usted, como antes.
- Con esto **desaparece de raíz el «bucle»** que reportó en consultorio: era ese mecanismo el que retecleaba un código en cada vuelta del reloj cuando no lograba encontrarlo.
- También se retira el cambio automático de pestaña, que solo existía para alimentar ese paso.
- El botón «Agregar a Conducta» del modal de Ordenamiento **se conserva**: ese lo pulsa usted a propósito y es otra cosa.

### 🛠️ Un fallo grave corregido en el código recuperado
- La función que revierte las órdenes de PyM del día hacía, literalmente, `_dxPendienteAgregar = []` creyendo que vaciaba una lista. Esos dos nombres son **funciones**, no listas: la instrucción las reemplazaba por listas vacías de forma permanente. A partir de ese clic, cualquier intento posterior de encolar un código en el mismo turno fallaba hasta recargar la página. Corregido, con prueba propia que lo fija.

### Lo que NO se integró, por decisión suya
- El «Modo Catálogo PyM», que habilitaba el botón de ordenar y abría el catálogo institucional completo aun cuando el paciente no tuviera actividades pendientes.

**Banco de pruebas: 1.838 comprobaciones en verde, 0 en rojo.**

## [Versión 15.2.1] — 2026-08-19 (Dos fallos reportados EN VIVO en consultorio, corregidos)

Entrega urgente por dos reportes suyos en pleno turno. Los dos quedan corregidos y con prueba propia que se rompe si alguna vez se repiten.

### 🔁 El "bucle" al generar la orden de PyM: un código que no calzaba se reintentaba PARA SIEMPRE
- Lo que reportó: al generar una orden, el script "entra en bucle" y "se pega nuevamente el código a pesar de que uno lo borre".
- La causa: cuando un código pendiente (de Conducta → Ordenamientos o de Impresión Diagnóstica) no encontraba ningún ítem que calzara en la lista de Everest, se quedaba en la cola **para siempre** — nada lo sacaba de ahí. Como esta función corre en cada vuelta mientras la sección está en pantalla, ese código se volvía a tipear en el buscador una y otra vez, peleándole el campo a quien lo borraba a mano.
- La corrección: ahora se cuentan los intentos sin éxito por paciente + sección + código. Al tercer intento sin calzar, el código se da por agotado, **sale de la cola** (ya no se reintenta) y se le avisa con un aviso ámbar que lo agregue usted a mano — el mismo trato que ya recibía un código que Everest reconocía pero pedía confirmar.
- Lo que esto NO toca: la lógica que decide si un código calza con un ítem de la lista no cambió — sigue exigiendo el mismo calce exacto (prefijo "(código)" o descripción idéntica del catálogo) para no arriesgar un clic sobre un examen parecido pero equivocado. Si un código concreto sigue sin calzar tras el aviso, es una señal de que vale la pena revisar ese código puntual (p. ej. si el buscador que recibió el texto era realmente el de la sección esperada), no un síntoma que este cambio deba ocultar.
- Cobertura: prueba nueva en `tests/suite_53_conducta_codigo.js` que reproduce el no-calce tres veces seguidas y confirma que el código sale de la cola al tercer intento, se avisa por telemetría y ya no se vuelve a tocar.

### 🖼️ "SE VE MAL EL MODULO": las etiquetas del dock de acciones no tenían dónde caber
- Lo que reportó: el panel flotante de accesos rápidos (Agendar / Ordenar / Laboratorios / Riesgo + IA) se veía desbordado, con texto montado sobre lo de al lado.
- La causa: cada botón del dock seguía fijo en 38×38 px — la medida de cuando el botón solo tenía un emoji, antes de que se le agregara una etiqueta de texto siempre visible ("Laboratorios", "Riesgo + IA", etc.). Ni el ícono ni la etiqueta tenían ninguna regla de estilo propia en toda la hoja — un comentario cercano afirmaba que sí la tenían, pero no era cierto — así que el texto desbordaba la caja fija.
- La corrección: el botón ahora crece con su etiqueta (ancho mínimo, ya no fijo) y el ícono/la etiqueta tienen su propia regla de tamaño y espaciado; los botones del dock quedan parejos, del ancho del más largo.
- Cobertura: prueba nueva en `tests/suite_25_cascada_css.js` que confirma que ambas clases tienen regla propia y que el botón ya no fuerza un ancho fijo.

### Nota sobre "todo lo que trabajé con Gemini ya no está"
Por separado, usted reportó la sospecha de que se revirtió trabajo suyo (con Gemini/Gemini Antigravity) sobre el cambio automático de pestaña en Everest, el módulo de RCV + IA y el de agendamiento. No se tocó el script de producción durante esta sesión salvo estos dos arreglos puntuales — pero esa investigación completa (qué se pudo verificar, qué no, y qué hace falta para verificar el resto) se le explica aparte, no aquí: este CHANGELOG documenta código, no esa reconstrucción de los hechos.

## [Versión 15.2.0] — 2026-08-19 (Auditoría con verificación adversarial · 11 fallos corregidos + telemetría completa)

Esta entrega no agrega funciones: corrige cinco cosas que estaban mal y que nadie estaba mirando, y le pone red de pruebas debajo a lo que corría sin ella. Todo lo de abajo se comprobó ejecutando, y cada corrección pasó mutación verificada — se rompe a propósito, se confirma que la prueba que le corresponde se pone roja, se restaura.

### 📊 La telemetría ahora cubre los cinco módulos, no solo el de IA
- Pedido suyo: hasta ahora el único módulo con embudo era el panel de IA. **Laboratorios, Ordenamiento, Agendamiento y Riesgo se abrían a ciegas** — se sabía cuántas veces se pulsaba el botón, pero no qué pasaba después. Ahora los cinco tienen el mismo recorrido: **abrir → paso intermedio → cerrar con éxito o abandonar**.
  - **Laboratorios**: abrir → llegaron resultados (con cuántos) o no había ninguno → completado / abandonado antes de que llegaran.
  - **Ordenamiento**: abrir → tocó la lista de actividades → órdenes creadas / abandonado.
  - **Agendamiento**: abrir → eligió un horario → cita creada / abandonado.
  - **Riesgo**: abrir → riesgo calculado o sin laboratorios para calcularlo → completado / abandonado.
- Con eso el tablero pasa a poder decirle **dónde se cae la gente**, que es la pregunta que importa: no es lo mismo que un médico no abra Ordenamiento, a que lo abra, elija las actividades y lo cierre sin confirmar.
- Los pasos intermedios se anotan **una sola vez por apertura**: cambiar tres veces de horario no son tres médicos indecisos.
- Queda una guardia que lee el archivo y exige que **todo embudo esté completo**. Si alguien instrumenta un modal nuevo y se olvida del abandono, el banco se pone rojo — un embudo sin abandono parece que nadie se cae nunca, y eso ensucia todos los porcentajes.

### 🔒 La etiqueta de fricción ya no puede llevarse un nombre de Everest
- La detección de "pulsé tres veces esto y no responde" armaba su etiqueta con el `id` o la clase **del elemento pulsado**, que puede ser de Everest y no nuestro. El limpiador borra números de 6 o más dígitos —ahí morían las cédulas— pero **no borra palabras**: un identificador ajeno del estilo `paciente_juan_perez` habría viajado entero al tablero. Era el único punto de todo el sistema donde una etiqueta del sistema ajeno llegaba a la hoja de Google.
- Ahora solo salen etiquetas de un catálogo conocido. Lo que no esté en él se agrupa: `otro` si es un elemento nuestro sin catalogar, `host` si es de Everest. Se pierde algo de detalle y se gana no depender nunca de cómo llame Everest a sus cosas.

### 🧹 Retirado un texto clínico que viajaba hacia la telemetría sin usarse
- Una llamada pasaba la enfermedad actual del paciente como dato adjunto de una métrica. **No había fuga**: esa función solo lee un campo numérico y descarta el resto, y así lo comprobé ejecutando. Pero bastaba con que alguien hiciera que registrara los datos adjuntos para convertirlo en una fuga de historia clínica de una sola línea. Se retiró el texto y quedó solo el conteo, que era lo único que se usaba. Hay una prueba que impide que vuelva a entrar.

### 🚨 Lo más grave:### 🚨 Lo más grave: las órdenes podían escribirse en la historia de OTRO paciente
- La función que teclea los códigos en Conducta e Impresión Diagnóstica tiene **cuatro barreras** que abortan si el médico cambió de paciente a mitad del gesto. Las cuatro empiezan comprobando el documento esperado… y **los dos llamadores del flujo de órdenes no se lo estaban pasando**. Con ese dato ausente, las cuatro barreras nunca se ejecutaban: eran código muerto.
- La única comprobación real se hacía **una sola vez, antes del bucle**. Y ese bucle escribe en pantalla entre 17 y 54 segundos (el paquete de riesgo cardiovascular son 10 códigos, cada uno con sus esperas de filtro y de montaje). Si en esa ventana usted abría la historia de otro paciente —que es exactamente lo que uno hace mientras "se están generando" las órdenes— el script seguía pulsando y escribía los exámenes y el diagnóstico del primero en la historia del segundo.
- El arreglo es pasar el documento en las llamadas. Las barreras ya estaban escritas; solo estaban desarmadas.
- Hay un **tercer** llamador con el mismo olvido: el camino principal del botón "Agregar a Conducta". Ese sí tiene una comprobación antes de cada examen, así que su ventana era mucho menor —entre 1,7 y 5,4 segundos por examen, no 17 a 54 en total— pero existía igual, porque durante ese tramo las cuatro barreras internas tampoco vigilaban. También corregido.
- **Cómo pudo entrar:** el propio comentario del código promete que "hay una prueba que lee este archivo y falla si algún llamador se lo olvida". Esa prueba existe — vive en `tests/_challenger_test.js`, y el ejecutor solo recoge los archivos `suite_*.js`. Nunca corrió ni una vez. Ahora la comprobación vive en una suite que sí se ejecuta, junto con dos pruebas que ejercen la barrera de verdad contra la pantalla simulada.

### 🔒 Fuga de datos de paciente hacia la IA### 🔒 Fuga de datos de paciente hacia la IA: el censor de nombres no reconocía las MAYÚSCULAS
- El texto libre que va a la IA pasa por un censor que borra el nombre que aparece detrás de "paciente", "señora", "acompañante", etc. Ese censor tenía escritas a mano las variantes del honorífico, así que reconocía "Paciente" y "paciente" pero **no "PACIENTE"** — y la historia clínica de Everest se escribe habitualmente en mayúsculas sostenidas. En esos casos el nombre del paciente salía entero hacia el servicio externo. Comprobado ejecutando, no leyendo. Segunda fuga por la misma vía: exigía un espacio justo detrás del honorífico, de modo que "Acompañante: Jose Perez" no se censuraba nunca, ni siquiera en minúsculas. Las dos están cerradas.
- Se midió también la dirección contraria, que importa igual: censurar de más destroza el borrador. La primera versión del arreglo se comía contenido clínico en 6 de cada 8 frases reales sin nombre ("PACIENTE ~~HIPERTENSO EN CONTROL PERIODICO~~"), y se descartó por eso. La versión entregada deja 0 fugas de 7 casos y 0 censuras de más de 8.
- **Límite que queda, dicho sin adornos:** si la nota está ENTERA en mayúsculas ("PACIENTE MARIA RODRIGUEZ REFIERE…"), no hay forma de distinguir el nombre de una palabra clínica por su forma: "MARIA" y "HIPERTENSO" son idénticas para el censor. La solución correcta no es adivinar mejor, es pasarle al censor el nombre real del paciente abierto —que el script ya sabe leer— y retirar ese nombre concreto. Queda como decisión suya, y con una prueba que fija el estado de hoy para que el día que se implemente obligue a revisarla.

### 🔒 "Mi estilo": la nota de un paciente podía entrar en el borrador de otro
- Los ejemplos que se guardan con "Guardar mi estilo" se saneaban solo con el limpiador de identificadores, que **no toca nombres propios**. Así, un ejemplo quedaba guardado en el equipo con el nombre de un paciente dentro y, con "mi estilo" activo, ese texto viajaba en el prompt de otros pacientes. Ahora pasa por el saneador completo al guardarse y al usarse.

### 🎨 El rediseño de UI/UX que pidió el consultorio se estaba pintando SIN UN SOLO ESTILO
- El fallo más grande y el más silencioso. Dos constantes de estilos estaban declaradas y **nunca se inyectaban en la pantalla**: `VGL_UX_CSS` (las burbujas de información "?", las leyendas que explican para qué sirve cada módulo, y las etiquetas visibles del dock de acciones) y la que extiende las tarjetas de riesgo al modal de riesgo cardiovascular. O sea: los botones y los textos estaban en la pantalla, pero sin forma, sin color y sin posición — peor que antes del rediseño. Eso explica por qué la confusión de los compañeros podía seguir igual después de dos versiones dedicadas justo a resolverla. Ya se inyectan: son unos 10 KB de estilos que no llegaban.
- Queda una guardia nueva ("Regla I") que recorre el archivo y exige que toda constante de estilos declarada se inyecte de verdad. No la engaña un comentario que solo la nombre.

### ⛔ La bandera de fraude "NO CONFIRMADO" se veía a 2,31:1 — casi ilegible
- El aviso de fraude de asistencia es una señal de seguridad: es lo que le dice que alguien marcó "En Sala" después de haberse ido. Estaba diseñada con letra oscura sobre rojo (7,96:1, nivel AAA) y se estaba viendo con letra clara sobre rojo, a **2,31:1** — por debajo del mínimo legible.
- La causa es el mismo tropiezo que las reglas del proyecto ya tenían documentado dos veces (el botón ámbar, y el panel post-cita en la v12.10.2): el blindaje contra los estilos de Everest estaba escrito como `#vgl-root span`, que por especificidad le gana a nuestras propias clases de color. Se pasó a la forma correcta, la que ya estaba establecida: especificidad cero y alcanzando solo al texto suelto sin clase propia.
- Medido en Chromium real contra la hoja de estilos de verdad, antes y después: **2,31:1 → 7,96:1**. Nota honesta: el contador de la tarjeta bajó de 15,18:1 a 10,69:1, porque antes heredaba un blanco más brillante del que le corresponde y ahora usa su color de diseño; los dos valores superan AAA de sobra.
- Queda una guardia ("Regla J") que impide volver a escribir el blindaje en la forma vieja.

### ⚠️ El aviso de "no se pudo confirmar la EPS" salía como texto plano
- La clase de ese aviso se usaba en pantalla y **no tenía ninguna regla de estilo**: se pintaba igual que el texto de alrededor, siendo una advertencia de que el recordatorio impreso puede salir con ese campo en blanco. Ahora tiene el mismo tratamiento visual que los demás avisos del modal de agendamiento, en ámbar.

### 🧪 Una cifra del banco de pruebas no medía lo que decía medir
- La prueba de cascada vigila cuántas declaraciones de prioridad de estilo hay en la hoja, para que ninguna entre sin que alguien lo note. Contaba el texto **tal cual, sin distinguir comentario de código**: de las 162 que contaba, **5 venían de frases explicativas**, no de estilos reales. La cifra llevaba tiempo significando otra cosa de la que decía. Esa misma trampa mordió tres veces seguidas durante esta auditoría (también con un token tipográfico y con el nombre de una constante). Ahora se cuenta sobre la hoja sin comentarios: 157 declaraciones reales. Comprobado en las dos direcciones — un comentario que mencione la palabra ya no descuadra nada, y quitar una declaración de verdad sigue poniendo la prueba en rojo.

### 🛑 El apagado remoto de emergencia no apagaba todo
- El kill-switch es la palanca que se tira cuando se sospecha que el script puede estar haciendo daño. Retiraba la interfaz y mostraba "Pausa de seguridad remota activa"… mientras tres temporizadores seguían vivos, porque se habían creado sin guardar la referencia y el apagado solo cancela lo que tiene registrado. La pestaña seguía consultando SharePoint y desempacando el libro de PyM (unos 13,6 MB) cada 10 minutos, indefinidamente. Ya quedan los tres registrados, y una guardia estructural exige que todo temporizador nuevo del arranque quede registrado — si alguien agrega uno suelto, el banco se pone rojo.

### 🖥️ Fuga de pestañas en el copiloto (Python)
- Cuando fallaba la lectura de la agenda, se soltaba la referencia a la pestaña propia **sin cerrarla**. Ese fallo es el que lanza el navegador cada vez que la pantalla de Everest se reconstruye al navegar, así que cada vuelta del bucle dejaba una pestaña más con Everest entero cargado, para siempre. Medido conduciendo el bucle real: 12 vueltas, 12 pestañas abiertas, 0 cerradas. En un equipo de consultorio eso es la memoria comida y el navegador congelado. Ya se cierra antes de soltarla, con cuatro pruebas que lo cuidan.

### 📊 El envío de mediciones al cerrar la pestaña perdía casi todo y duplicaba lo poco que mandaba
- El envío de última hora despachaba **una sola fila de hasta 30**, así que se perdían las demás — incluida la de fraude y el resumen del día, que son justamente las que la cola protege a propósito. Y la que sí despachaba no se retiraba de la cola, de modo que se volvía a enviar después y salía **duplicada** en el tablero. Ahora salen todas, cada una se retira al salir, y las que el navegador rechace se quedan para el siguiente intento.

### 🔐 Las colas que escriben en la historia ya tienen quien las vigile
- Los códigos CUPS y los diagnósticos que el script agrega solo en Conducta e Impresión Diagnóstica pasan antes por dos colas guardadas en el equipo. Esas colas no tenían **ninguna prueba**, y ahí vive la invariante más delicada de todo el archivo: que lo encolado para un paciente jamás salga en la historia de otro. Ahora hay 8 pruebas que la fijan, junto con la no duplicación de un código ya encolado, la separación entre la cola de exámenes y la de diagnósticos, y que un documento parecido pero distinto no arrastre la cola ajena.
- Comprobado rompiendo a propósito el aislamiento entre pacientes: la prueba correspondiente se pone roja.

### 🧪 Pruebas que se habían perdido por el camino, recuperadas### 🧪 Pruebas que se habían perdido por el camino, recuperadas
- La regla del LDL —cuando los triglicéridos pasan de 400, el laboratorio reporta el inmunológico y ese es el que se usa— seguía funcionando bien, pero se había quedado **sin ninguna prueba que la vigilara**. Lo mismo el desempate "un número real gana sobre un texto sin número", y la fecha del uroanálisis tomada del componente más reciente. Ocho casos recuperados y en verde.
- El reloj de segundo plano (lo que sostiene que los avisos lleguen a tiempo con la pestaña oculta) tenía **cero pruebas**, y no por descuido: el banco de pruebas era incapaz de observarlo. Se corrigió esa limitación y ahora tiene 18 pruebas, incluida la propiedad que más importa: pase lo que pase, el Vigilante nunca se queda sin reloj.

- 1.738 comprobaciones automáticas en verde, 0 en rojo (antes: 1.678). Cobertura 85,0 % → 89,0 %. En el copiloto, 226 pruebas en verde.

### 🧪 Cobertura del banco de pruebas llevada a su techo real (usted preguntó "qué hace falta para el 100 %")
- Encontré el límite: 48 de las 688 piezas que cuenta el banco son ayudantes que viven **anidados dentro de otra función** (por ejemplo, los controles de teclado de un modal, o los ayudantes de una fila de agenda). El mecanismo con el que el banco se asoma al script solo alcanza piezas de primer nivel, nunca las anidadas — así que esas 48 le son estructuralmente invisibles, aunque el médico las use todos los días sin saberlo. Las revisé una por una: las 48 viven dentro de funciones que sí tienen pruebas extensas, así que están ejercitadas igual, solo que el banco no puede señalarlas por separado. Con este mecanismo, el 100 % literal no es alcanzable; el techo real es 93,0 % (640 de 688), y hoy se llegó exactamente a ese techo — cero piezas alcanzables sin al menos una prueba.
- De camino aparecieron dos hallazgos reales, no solo de conteo:
  - **El más importante:** la guardia que evita que un código o un diagnóstico encolado se escriba en la historia de OTRO paciente tiene cuatro puntos de control independientes; uno de ellos —dentro de la cola de auto-completado pendiente— no tenía ninguna prueba propia que lo protegiera de una regresión futura. En la práctica nunca hubo riesgo real: comprobé apagando ese control a propósito, y un segundo control más adelante en la misma cadena seguía deteniendo la escritura cruzada igual. Pero un cambio futuro que tocara justo ese punto habría pasado desapercibido hasta ese segundo control, sin ninguna prueba propia que lo señalara antes. Ya tiene su prueba estructural, verificada rompiendo el control a propósito.
  - El nombre fijo de una métrica interna de rendimiento (un rango de duración de 100 a 300 milésimas de segundo) resulta chocar con el filtro que borra corridas de 6 o más dígitos en las etiquetas de telemetría — el mismo filtro que existe para que una cédula jamás llegue al tablero. No es una fuga (el filtro está siendo más estricto de lo necesario, nunca menos) y no afecta nada clínico: ese rango puntual pierde su nombre en el tablero de uso interno, sin más consecuencia. Queda anotado en el propio código para quien quiera corregirlo con calma.
- Se sumaron pruebas de comportamiento real (con sus casos límite verificados a mano, y las de más riesgo con mutación: se rompe la función a propósito y se confirma que la prueba correspondiente se pone roja) a funciones que no tenían ninguna — desde el rótulo de los botones del panel de acciones hasta el aviso de "Chrome puso en pausa esta pestaña", pasando por el registro de tareas largas y de demora al responder un clic, y la métrica que mide cuánto edita usted lo que redacta la IA.
- 1.835 comprobaciones automáticas en verde, 0 en rojo (antes: 1.738). Cobertura 89,0 % → 93,0 % — el techo real de lo que el banco puede señalar por separado.

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
