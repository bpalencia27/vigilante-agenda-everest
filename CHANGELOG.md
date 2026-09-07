# Registro de Novedades Clínicas — Vigilante de Agenda (Copiloto Everest PyM)

Bienvenido al registro de actualizaciones del **Vigilante de Agenda**. Este documento detalla las mejoras, correcciones y salvaguardas asistenciales incorporadas en cada versión para garantizar la seguridad de sus pacientes y agilizar su jornada de consulta médica.

---

## [Versión 18.3.0] — 2026-09-05 (La IA con red de seguridad, y el consentimiento antes de nada)

### 🪜 La escalera de IA (m2m)
El redactor clínico deja de depender de un único proveedor: z.ai (GLM-5.3) es el primario
y Gemini el respaldo — si el primario falla o tarda, la nota se pide al respaldo sin que
usted note más que unos segundos de más. Cada llamada mide su latencia y el proveedor que
respondió, para auditar la calidad del servicio con datos, no con impresiones.

Tres errores finos corregidos en el camino:
- **Agendarle a otro paciente**: la lectura del identificador del paciente ahora usa la ruta
  segura del dato — antes podía tomar un número de la vista y agendar para la persona equivocada.
- **HbA1c obligatoria vacía ya se reporta**: un valor exigido pero sin diligenciar aparece en
  el reporte como pendiente; ya no desaparece en silencio.
- **«Normalidad» solo con ancla**: la normalidad fija del Examen ya no se afirma sola — exige
  el hallazgo que la sustenta.

### 🔒 La barrera de cero identificables
Todo lo que sale hacia el proveedor de IA pasa por una barrera que garantiza cero datos
identificables: ni cédulas, ni nombres, ni números de historia — solo lo clínico estricto.

### ✋ El consentimiento, antes de la primera nota
Primera versión con compuerta de consentimiento **fail-closed**: sin consentimiento vigente
del paciente, el redactor no funciona — y si algo falla al consultarlo, también queda cerrado
(nunca abierto por defecto). Los términos v1.1 se presentan al médico, se versionan y se deja
constancia en el tablero (fecha y versión aceptada), además del latido base del módulo.

### 📈 Observabilidad sin identificadores
Módulo nuevo de observación (`obs*`) que cuenta latidos y salud del script — parámetros,
procesos, tiempos de arranque — sin cédulas, sin nombres, sin URLs de pacientes.

### 🧹 Saneamiento del código
Dos constantes muertas salieron del archivo y tres funciones zombi (nadie las llama) quedaron
en cuarentena con marcador, listas para retirarse en la próxima versión. El banco de pruebas
creció a **3.385 comprobaciones en verde** y cada cambio se verificó rompiéndolo a propósito
primero (mutación) antes de darlo por bueno.

### 🩹 Incidencia 4 — el Panel que culpaba a los laboratorios
Corregida la causa que hacía que el Panel del Paciente mostrara «No se pudo leer al paciente
ahora (los laboratorios no respondieron)» en **todos** los pacientes:

- **Causa raíz (scope)**: una bandera interna vivía declarada dentro de un bloque `try` y se
  leía fuera de él — cualquier lectura exitosa que llegaba al final reventaba con un error
  invisible que nadie atrapaba, y el Panel lo reportaba como fallo de laboratorios. La bandera
  ahora vive a nivel de función.
- **Degradación honesta**: si el motor del resumen falla por cualquier otro motivo interno,
  ya no revienta hasta el Panel: se degrada a «sin dato» y se marca como degradado — jamás
  se inventa ni se culpa a los laboratorios.
- **La caché no se envenena**: un resumen degradado por error interno **no** pisa la última
  lectura buena guardada.
- **El redactor IA no alucina con hoja vacía**: si el resumen llegó degradado, el redactor
  lo descarta antes de usarlo como hoja de hechos — sin datos reales, prefiere el aviso
  honesto de «sin datos» antes que darle a la IA libertad de inventar.

## [Versión 18.1.0] — 2026-09-04 (Quién ve qué, y el aviso del paciente nuevo)

### 🔐 El control de acceso por médico
Desde hoy el script no es «todo para todos»: cada médico recibe según su perfil, definido en
una hoja nueva del tablero (`acceso`), no en el código.

- **COMPLETO**: todo el script, como siempre lo ha tenido usted.
- **LABORATORIOS**: Centinela, laboratorios, agendamiento de exámenes, widgets de exámenes
  y el aviso de paciente nuevo; sin panel de paciente, redactor IA, RCV ni agendar control.
- **PÚBLICO** (colega de Everest fuera del padrón): solo Psicología/Odontología y PyM — como ya era.
- **BLOQUEADO** (lista negra): el script no se construye, en silencio — ni avisa ni deja rastro en pantalla.

Cambiar un médico de perfil ya no exige publicar versión nueva: se edita la hoja `acceso` en
el tablero y cada equipo la recoge al arrancar, cada 4 horas y al abrir ajustes; si el tablero
no responde, se usa la última lista guardada en el equipo (un fallo de red no castiga a nadie).

La identidad pasa a ser el `UsuarioId` de sesión (el número interno de cada cuenta), con el
nombre solo como respaldo. Si la sesión no expone identidad, hay 12 horas de gracia con el
último perfil vigente; después, perfil público con las funciones privadas cerradas.

### 🆕 El aviso del paciente nuevo
Cuando aparece en la agenda una cita de un paciente que no figuraba en el histórico del día,
suena un aviso una sola vez por cita (máximo 3 por hora, para no convertir el turno de la
tarde en una tanda de campanas). El conteo del día queda visible en el dock y se reinicia a
medianoche; el mismo paciente en otra lectura no vuelve a sonar.

### 📊 Lo que se mide (y lo que no)
Cuando un perfil recortado intenta usar una función que no le corresponde, se cuenta el
intento — solo el de escritura real. El evento `acceso_deneg` viaja al tablero una vez al día
y lleva uid, perfil y contadores por capacidad: sin nombre del médico, sin cédulas, sin URLs.

### ⚠️ Para instalar esta versión (orden obligatorio)
**Primero el tablero, después los equipos.** El Apps Script del tablero debe tener la hoja
`acceso` publicada ANTES de actualizar el userscript: sin ella, todos los equipos caen a
perfil público (nada se rompe, pero nadie ve sus módulos). El tablero va anotando en
`acceso_uid` los uids reales de sesión de cada médico: son los que se copian a `acceso`
para armar el padrón y la lista negra.

### 🧱 El límite que no cambia
Un userscript corre en la máquina de quien lo usa: esto es control operativo (evitar errores
y uso indebido de nuestros servicios), no una barrera de seguridad. La cerradura de verdad
sigue siendo el servidor.

---

## [Versión 17.56.0] — 2026-08-29 (La marca de llegada tarde ya no se borra sola)

### 🔴➡️🟢 El reporte
Una colega, en vivo: *«cuando lo confirman tarde sale rojo y después me salía verde»*. El aviso
de confirmación extemporánea salió, la tarjeta se puso roja… y más tarde volvió a verde.

### 🔍 Qué pasaba
Cada cita se identifica con una clave interna. Esa clave llevaba **la posición del paciente en
la lista** — y la posición cambia. Entra un cupo adicional, la agenda se reordena, y **la misma
cita pasa a tener otra clave**: la marca de «llegó tarde» queda archivada bajo la clave vieja y
la tarjeta vuelve a pintarse verde.

Lo mismo ocurría cuando **el documento aparece o desaparece entre lecturas**: el script lee la
agenda por dos vías (la conexión directa con Everest y, si esa falla, lo que se ve en pantalla),
y una trae la cédula donde la otra a veces no. La misma cita saltaba de una clave a otra.

Reproducido de punta a punta antes de tocar nada: paciente citado a las 11:20, confirmado 12
minutos tarde → **rojo**; entra un cupo adicional → **verde**.

### ✅ Ahora
- **La posición en la lista sale de la clave.** Es exactamente la corrección que ya se le hizo
  al contador de productividad en la v17.6.2, cuando usted reportó *«atendí a 10 y el Resumen
  dice 20»*: el orden de la lista no identifica a nadie. Esta parte del script nunca la recibió.
- **La cédula se canonicaliza**: `0005150076` y `5150076` no pueden dar dos claves distintas.
- **La marca queda anotada bajo las dos identidades del paciente** —su documento y su nombre—
  para que la siguiente lectura la encuentre venga por donde venga.
- **Y se lee tolerante**: una marca puesta esta misma mañana con la versión anterior se sigue
  encontrando. El arreglo no borra hoy la evidencia que viene a proteger.

Comprobadas las cuatro combinaciones (marcada con/sin documento, releída con/sin documento, y
con la agenda reordenada): las cuatro siguen en **rojo**. Y un paciente que llegó a tiempo sigue
saliendo verde: el arreglo no convierte a nadie en tarde.

### 📄 Sobre las reclamaciones ya afectadas
**Lo que se perdía era el color, no el registro.** La línea `FRAUDE_EXTEMPORANEO` —con la hora
de la cita, la hora real de confirmación y los minutos de retraso— se escribe en la auditoría en
el momento en que suena el aviso, y ahí sigue. Si su colega necesita reclamar por los casos de
hoy, el dato está en el CSV de auditoría aunque la tarjeta se haya puesto verde.

---

## [Versión 17.55.0] — 2026-08-29 (Un tercio menos de viajes al laboratorio)

### 🚌 Lo que se midió primero
Usted lo dijo así: *«la idea es que el paciente tenga la menos cantidad de veces que ir a
sangrarse e ir a la IPS»*. Así que antes de tocar nada se midió eso, sobre **3.072 planes**:

| | antes |
|---|---|
| Viajes al laboratorio por paciente | **2,33** |
| Pacientes con una **segunda cita** aparte | **78,1 %** |
| Quién la provocaba | LDL 2.046 · HbA1c 1.152 · **glicemia 884** |

**Cuatro de cada cinco pacientes con una falla ya recibían un viaje extra.** Y sus dos
preguntas tenían respuesta exacta:

- *«¿Repetir la glucosa en menos de 1 mes?»* — Sí: 884 de esas citas eran por glicemia, a los
  **14 días**.
- *«¿LDL en máximo 8 semanas?»* — Ni siquiera. Eran **42 días fijos, siempre**: el «6 a 8
  semanas» estaba escrito en el código pero el extremo largo **no colocaba ninguna fecha
  jamás**.

### ✅ Ahora

| | después |
|---|---|
| Viajes por paciente | **1,61** — un **31 % menos** |
| Con segunda cita aparte | **42,6 %** — casi la mitad |
| Pacientes con falla que se quedan sin ninguna fecha | **0** |

**Tres cambios, y ninguno inventa un número nuevo:**

1. **La glicemia deja de tener viaje propio.** El propio protocolo lo permite («2-4 semanas *o
   alineada con la HbA1c*»). Si la HbA1c también está en falla, la glicemia se pega a su misma
   fecha; si no, la cubre la toma general. La falla se sigue declarando y el examen se sigue
   pidiendo: lo que desaparece es el viaje.
2. **La ventana de recontrol se usa entera.** Por defecto se va al extremo largo, porque una
   fecha más tardía **cabe mucho mejor en la toma que ya está programada**. Adelantar dos
   semanas no compra un control mejor: compra un viaje más. El extremo corto queda para quien
   de verdad no puede esperar.
3. **La toma general puede recoger un recontrol que caía después.** Antes, si la toma caía
   **cinco días antes** del recontrol, no se juntaban: segunda cita por cinco días. Ahora se
   junta — pero **nunca** por debajo del piso clínico de cada examen (para el LDL, 4 semanas:
   antes de eso el resultado no significa nada).

### ⚖️ Y la gravedad ya significa una sola cosa
Como usted decidió, desaparece el escalón del +30 %. «Grave» queda para la regla clínica:
**riesgo alto o muy alto, TFG < 45 y menor de 75 años.** Su privilegio ya no es «tener fecha»
—desde ahora la tiene **toda** falla, que era el hueco que esto abría— sino **ser lo único que
justifica un viaje aparte**.

### 🔴 El rojo de la tabla de tendencias empieza en la meta
Como usted eligió: LDL > 70 en riesgo alto (antes > 91), > 55 en muy alto, HbA1c > 7,0 (antes
> 9,1), triglicéridos > 400 (antes > 520). El RAC no cambia: 300 ya era su corte.

### 🧾 Y un examen que se agendaba sin que nadie lo pidiera
Al repartir los recontroles, un examen que acababa con cita propia **se quedaba fuera de la
orden**: se le agendaba el viaje al paciente y nadie pedía la prueba. Lo cazó una prueba de la
versión anterior, que existe justo para eso. Ahora, **haya cita propia o no, si hay recontrol
el examen se pide**.

---

## [Versión 17.54.0] — 2026-08-29 (Se acabó la franja de cortesía)

### 🎯 Estricto en los tres ejes
Como usted pidió: **por encima de la meta ya cuenta**, sin el margen del 15 %. Las franjas que
hasta hoy se callaban, medidas una a una antes de tocar nada:

| eje | meta | franja que se callaba |
|---|---|---|
| LDL, riesgo muy alto | 55 | 55,1 – 63,25 |
| LDL, riesgo alto | 70 | 70,1 – 80,50 |
| LDL, riesgo moderado | 100 | 100,1 – 115,00 |
| LDL, riesgo bajo | 116 | 116,1 – 133,40 |
| HbA1c | 7,0 % | 7,1 – 8,05 % |
| Glicemia (diabéticos) | 130 | 131 – 149,5 mg/dL |

**Qué cambia en la práctica.** Un paciente con LDL 80 y meta 70 figuraba «en meta», conservaba
los 180 días de vigencia y no se le declaraba falla. Ahora está fuera de meta, su examen se
recorta a 90 días y se declara falla leve. Y un diabético con HbA1c de 7,1 pasa de «control en
mes y medio» a **vencida hoy y citado un mes antes** (medido en un caso real del banco: la
fecha de toma se adelanta del 30-sep al 29-ago).

### 🚪 Había una cuarta puerta que nadie había encontrado
El margen se aplicaba en cuatro sitios, y **uno de ellos tenía el 15 % escrito a mano**, sin
pasar por el número común. Ese sitio alimenta la **hoja educativa que usted imprime y le
entrega al paciente**. Cambiar el número sin tocar el literal habría hecho que el papel del
paciente y el plan de exámenes dijeran cosas distintas del mismo paciente. Ahora los cuatro
caminos leen el mismo número.

### 🧾 Y un examen que se agendaba pero nadie pedía
Al medir el cambio saltó un defecto **real**, no una prueba a retocar. Un diabético con
glicemia de 140 **tomada ayer**: con el umbral estricto entra en falla y se le fija el
recontrol para la próxima toma, pero como su vigencia normal no ha vencido, **la glicemia no
entraba en la orden**. Se agendaba la toma y nadie pedía el examen.

Estaba documentado como imposible, y con la regla anterior lo era. Ya no. Ahora toda falla que
se retoma en la misma toma entra en la orden.

### 🔒 Lo que NO se tocó
El escalón del **30 %** (falla «grave») sigue exactamente igual. Es la decisión D10 y está
pendiente de que usted confirme un detalle: ese mismo número decide también **el rojo de la
tabla de tendencias**, que fue una decisión suya del 21-ago. Quitarlo a secas pintaría de rojo
casi todo. No se toca hasta que usted lo diga.

---

## [Versión 17.53.0] — 2026-08-29 (Faltaban tres cajones por revisar)

### 🗄 El arreglo de la v17.48.0 estaba a medias
Aquella versión hizo que la memoria del paciente y el registro del día reconocieran al mismo
paciente viniera su cédula con ceros de relleno o sin ellos. **Se quedaron fuera tres
almacenes más que también se guardan por cédula.** Lo destapó una medición posterior, y se
comprobó uno por uno antes de tocar nada.

**El grave: el historial de inasistencias.** Ese sí **no caduca** — guarda cuántas veces ha
faltado el paciente a lo largo del tiempo, y es lo que le avisa a usted. Un paciente archivado
bajo la forma rellenada aparecía con **cero inasistencias**: su historial entero, invisible,
sin que nada lo dijera. Peor todavía: al registrarle una falta nueva se le abría una segunda
ficha y el contador **empezaba de cero otra vez**.

Ahora se lee reconociendo las dos formas, y al registrar se escribe **sobre la ficha que ya
existe**, no sobre una nueva — para no dejar huérfano lo archivado antes. No se fusiona ni se
mueve nada de sitio.

**Los otros dos, menores pero arreglados:** la clave de la productividad partía en dos la
misma atención (justo lo que el comentario de esa función promete que no pasa), y la caché de
exámenes previos fallaba y obligaba a volver a consultar — una espera que usted sí nota.

---

## [Versión 17.52.0] — 2026-08-29 (La albuminuria ya no necesita permiso de la diabetes)

### 🧪 Qué cambia
Hasta hoy la albuminuria pesaba en la clasificación de riesgo de dos formas, y una de ellas
con condición:

- **RAC ≥ 300** (macroalbuminuria): subía sola a **muy alto**. Eso sigue igual.
- **RAC 30–299** (albuminuria moderada, A2): contaba **solo si el paciente era diabético**, y
  ahí como uno más de los daños de órgano blanco.

O sea: **un hipertenso no diabético con RAC 45 no subía de categoría por su albuminuria.**
Desde ahora **A2 sube a ALTO por sí sola**, como usted decidió, sin depender del diagnóstico
de base. Es el eje CGA de KDIGO: la albuminuria es un eje propio, independiente del filtrado.

**Lo que cambia de verdad es la conducta:** ese paciente pasa de una meta de LDL de **100 a
70**.

### 📏 Lo que se midió antes de tocar nada
Contra los 991 vectores del corpus:

| | vectores | qué les daba el motor |
|---|---|---|
| A2 (RAC 30–299) | 36 | 23 ya «muy alto», 11 ya «alto», **2 «moderado»** |
| A3 (RAC ≥ 300) | 56 | **los 56 ya «muy alto»** |
| A1 (< 30) | 47 | — |
| sin RAC medido | **852** | — |

Es decir: **cambian 2 de 991**, los dos de moderado a alto. La albuminuria severa ya estaba
cubierta. Esos 2 quedan como excepción declarada y estrecha, igual que el piso por diabetes y
el de mayores de 79: si mañana el corpus deja de tenerlos, una prueba avisa en vez de
arrastrar una excepción huérfana.

**Una advertencia honesta sobre ese número:** el corpus casi no prueba esta regla — el único
valor A2 que contiene es `45`, y **852 de sus 991 vectores no traen RAC**. En su consulta la
RAC sí se pide de rutina, así que en pacientes reales esto moverá bastante más de 2. El corpus
no puede decirnos cuánto.

### 🚫 Y lo que NO hace
- **Un RAC que nadie midió no es un RAC normal.** Si el campo no está, está vacío o trae texto
  que no es un número, el paciente se queda donde estaba. Casilla vacía antes que dato
  inventado, aplicado a la clasificación.
- **El paso 1 sigue mandando.** Un A2 con enfermedad cardiovascular establecida sigue saliendo
  «muy alto»: la regla nueva vive en el paso 2 y el clasificador para en el primero que se
  cumple.

---

## [Versión 17.51.0] — 2026-08-29 (Qué contesta el panel, dicho tal cual)

### 🔍 Una pregunta que no se puede responder adivinando
La v17.49.0 dejó que el script solo dé una fila por entregada cuando el panel lo confirma. Esa
comprobación funciona **tachando respuestas malas**: si la respuesta no es «no», ni «err», ni
una página web, ni el inicio de sesión de Google, se da por buena. Lo estricto sería al revés:
aceptar **solo** «ok» y «dup» y desconfiar de todo lo demás — así una respuesta vacía o el
texto de un proxy de la IPS tampoco pasarían por entrega.

No se hizo, y por una razón concreta: **desde aquí no hay forma de saber qué contesta el panel
que usted tiene publicado**. El código del receptor que vive en el repositorio solo ha
respondido nunca esas cuatro palabras, pero su propia cabecera dice que la versión desplegada
es anterior a todo ese historial. Si me equivoco en esa dirección, **la telemetría entera deja
de confirmarse en silencio**, que es peor que el hueco que cerraría.

### ✅ Así que en vez de adivinar, se mide
Ahora el script **guarda lo que el panel contesta, literalmente**, y se lo enseña en
**Ajustes → «Probar y diagnosticar»**, en un renglón nuevo:

- *«ok» (respuesta esperada del panel)* — todo en orden.
- *«…» — esto NO lo dice el panel: quien contesta puede no ser él* — en rojo, cuando llega algo
  que el receptor nunca dice: ahí hay un proxy, una URL equivocada o un despliegue viejo de por
  medio.
- *todavía no ha contestado nada en este equipo* — cuando aún no se ha probado, en vez de
  fingir que todo va bien.

**Con que usted pulse «Probar conexión» una vez, la pregunta queda contestada** y la
comprobación estricta se puede activar sabiendo, no suponiendo.

Lo guardado pasa por el mismo saneador de datos personales que todo lo demás: ni siquiera lo
que responde un servidor entra sin tachar.

---

## [Versión 17.50.0] — 2026-08-29 (Al prompt le faltaba la mitad: «no te dejes nada»)

### 📝 El contrato con la IA solo prohibía
Todas las reglas que el asistente le impone al modelo apuntaban en la misma dirección: **no
inventes**. No había ninguna que dijera lo contrario — **no te dejes nada**.

Esa regla sí existía, palabra por palabra: *«no omitas hallazgos clínicamente relevantes que
sí estén en los HECHOS»*. Vivía en un prompt que dejó de usarse hace versiones y que nadie
retiró, así que se perdió sin que se notara. Y se nota poco por una razón incómoda: **un
borrador al que le falta algo no dispara ninguna alarma**, mientras que uno con una cifra
inventada sí. Un hallazgo que estaba en los datos y no llegó a la nota es una omisión en una
historia clínica que usted firma.

Ahora esa regla está en el bloque común, así que **alcanza a los cinco modos** de redacción:
enfermedad actual, motivo de consulta, recomendaciones, análisis y plan, y el respaldo que
se usa si el modo no se reconoce.

### ⚖️ Y ninguno prohibía calificar al paciente
La prohibición de **juicios de valor e inferencias sin respaldo** («incumplidor», «poco
colaborador», conjeturas sobre causas o intenciones) estaba **solo** en el prompt de
Enfermedad Actual. Los otros cuatro no la llevaban. Ahora la llevan los cinco.

### 🧭 Dos casillas ya tienen su mini-ejemplo
**Motivo de consulta** y **Recomendaciones** no tenían ninguno. La rotación de modelos
incluye variantes pequeñas desde el primer intento, y esos modelos copian un patrón mucho
mejor de lo que siguen una instrucción abstracta.

Los ejemplos van **sin una sola cifra**, a propósito y comprobado con la función real: el
verificador marca como inventado todo número con unidad que no esté en la hoja de hechos, así
que un ejemplo con cifras se le colaría al modelo y a usted le saltaría el aviso de «cifras
sin respaldo» sobre un dato copiado del propio prompt.

### 🧹 Y se retiran quince líneas muertas
El prompt antiguo (`MTR_REDACCION_SYS`) no lo referenciaba nadie. Se fue — **después** de
rescatar lo único suyo que hacía falta.

### 📌 Una corrección a lo que habíamos hablado
En la entrevista quedó anotado que la distinción entre **«documentado como NO»** y **«no se
preguntó»** faltaba en el prompt de casillas cortas. Al construir los cinco prompts reales y
mirarlos, resulta que **ya estaba en los cinco** desde la v17.13.0: llega desde el bloque
común. No había nada que arreglar ahí, y ahora hay una prueba que lo mantiene así.

---

## [Versión 17.49.0] — 2026-08-29 (La evidencia no se da por entregada sin acuse)

### 📮 Qué pasaba
El script guarda en una cola lo que le manda al panel remoto. Hay dos clases de fila:
**métricas de uso** (cuántas veces se abrió cada pantalla — si se pierden, se reconstruyen)
y **evidencia**: los fraudes de llegada, los errores del script y el resumen del día.

Al ocultar o cerrar la pestaña, el script vaciaba la cola entera por el transporte rápido
del navegador (`sendBeacon`). Ese transporte, **por diseño del navegador, no puede leer la
respuesta**: devuelve «enviado» sin saber si llegó. Y la fila se borraba igual. Con el panel
caído, con la sesión de Google caducada o con el token cambiado, un fraude o el resumen del
día **desaparecían sin que nadie se enterara**.

### ✅ Ahora
**La evidencia ya no viaja por ahí.** Por el transporte a ciegas solo salen las métricas de
uso y la fila de entorno. Los fraudes, los errores y el resumen se quedan en la cola y salen
por el camino que **sí lee el acuse del panel**. Si no hay acuse, no salen: esperan.

**Y el reintento al arrancar ahora es literal.** Antes, lo que quedó pendiente de ayer
esperaba hasta diez minutos con la pestaña abierta. Ahora se vacía a los 8 segundos de
abrir Everest.

### 🚫 Por qué NO se hace lo que parecía más obvio
La idea inicial era mandar la evidencia por el transporte rápido **igual**, y además
dejarla en la cola para reintentarla. Al revisar el receptor (que está en este mismo
repositorio) resultó que **habría duplicado cada fila**: el panel descarta el reenvío
mirando una memoria que **caduca a las 6 horas**, y el reintento ocurre cuando usted vuelve
a abrir Everest — al día siguiente, o el lunes. Trece horas después, esa memoria ya no
existe y la fila se escribiría dos veces, inflando los acumulados del tablero. Que es
exactamente el defecto que ese mecanismo nació para cerrar.

Mandarla **una sola vez, por el camino que confirma**, no depende de esa ventana de 6 horas
ni de qué versión del receptor esté publicada.

### 🩹 Dos agujeros más, encontrados por el camino
- **«Recibida» no es «guardada».** El panel responde `err` (con estado normal) cuando
  recibió la fila pero no pudo escribirla. El script lo contaba como entrega buena: borraba
  la fila **y** ponía en verde el sello de «último envío confirmado», que a su vez
  autorizaba media hora de envíos a ciegas contra un panel que estaba fallando. Ahora `err`
  cuenta como fallo, con su motivo escrito: *«el panel recibió la fila pero no pudo
  guardarla (¿cuota de Google agotada?)»*.
- **El panel quemaba el identificador antes de escribir.** `TABLERO/Codigo.gs` marcaba la
  fila como «ya vista» *antes* de guardarla. Si la escritura fallaba, el reintento recibía
  «duplicada» y se descartaba: la fila no se escribía nunca. Ahora se marca **después** de
  guardar. ⚠️ **Este cambio es del panel, no del script: solo tiene efecto cuando usted
  vuelva a publicar `TABLERO/Codigo.gs` en Apps Script.**

---

## [Versión 17.48.0] — 2026-08-29 (Un paciente, una sola casilla de memoria)

### 🗂 El mismo paciente podía quedar archivado dos veces
La memoria local del script —lo aprendido de un paciente en consultas anteriores, y también
el registro del día que evita ordenarle dos veces lo mismo— se guarda **bajo su cédula**.

El problema: Everest no siempre entrega la cédula igual. Si por una vía llega rellenada de
ceros (`0005150076`) y por otra llega limpia (`5150076`), el script las trataba como **dos
pacientes distintos**. Consecuencias reales:

- Los antecedentes recogidos en el control anterior no aparecían en el siguiente: el script
  parecía **olvidar** al paciente.
- El bloqueo antiduplicados no reconocía «ya le ordené hoy», así que podía dejar pasar una
  **segunda orden** al mismo paciente.
- La fecha real de la cita de control agendada no se encontraba, y sin ella no se puede
  calcular la toma de muestras «5 días hábiles antes».

**Desde ahora la cédula se normaliza en el origen**, en los tres sitios por donde entra: la
historia clínica abierta, la agenda por API de Everest y el respaldo por pantalla. Una sola
clave por paciente, venga como venga.

### 🔎 Y lo ya guardado no se vuelve invisible
Arreglar solo las escrituras habría hecho **desaparecer** a los pacientes ya archivados bajo
la forma rellenada — el mismo síntoma que veníamos a evitar. Por eso la lectura ahora
compara por forma canónica: encuentra el registro esté guardado como esté.

Sigue sin cruzar pacientes distintos: `5150076` y `5150077` son dos personas, y así se
tratan.

### 🧮 Lo que este arreglo NO hace, a propósito
**No fusiona nada.** Si algún paciente ya quedó partido en dos claves, el script ahora lo
**detecta y lo anota** (una sola vez, con el conteo y **sin ninguna cédula** en la bitácora
— cero PHI), pero no une los registros por su cuenta. Fusionar es destructivo: la memoria se
fusiona plano, y `programas`, `pestanasVistas` y `hcEverest` no llevan marca de tiempo por
campo, así que una unión mal hecha borraría antecedentes ya documentados. Antes de fusionar
hace falta el **respaldo exportable**, que es la entrega siguiente.

Fue exactamente lo que usted pidió: *que detecte y le informe primero*.

---

## [Versión 17.47.0] — 2026-08-29 (La IA ya no redacta con cifras de hace 13 minutos)

### 🕐 El panel de redacción tomaba una foto al abrirse y la usaba al generar
Cuando usted abre ✍ Redactar, el script calculaba en ese instante la hoja de hechos del
paciente —TFG, LDL, categoría de riesgo, metas— y **la guardaba**. Después, al pulsar
Generar, reutilizaba esa misma hoja.

El problema es cómo se usa el panel de verdad: usted lo abre y lo deja abierto mientras
termina de completar la historia. Si pasan diez minutos, la nota se redactaba con los
números de hace diez minutos, más los tres de antigüedad que ya podía tener el cálculo.
Hasta **trece minutos** de desfase, en una nota que usted firma.

El texto libre sí se releía en cada clic (se arregló en la v17.6.22). Los números no.

**Ahora, al pulsar Generar, se resuelve el resumen vigente en ese instante.** El Panel del
paciente refresca sus cálculos cada 20 segundos, así que casi siempre habrá algo más nuevo
que la foto, y eso es lo que se usa.

**Y donde no se puede, no se finge.** Si el cálculo ya caducó —por ejemplo, porque usted
acaba de escribir algo y eso invalida la caché— el script **no puede** recomponerlo desde
el panel: haría falta volver a leer los laboratorios. En ese caso conserva la foto, pero
**no dice que la refrescó**. Presentar como fresco algo que no lo es sería peor que el
defecto original.

---

## [Versión 17.46.0] — 2026-08-29 (La memoria del paciente ya no se pierde en silencio)

### 💾 Con el navegador lleno, lo aprendido de un paciente desaparecía sin avisar
El script guarda lo que aprende de cada paciente (factores de riesgo, qué pestañas ya
revisó, la historia cosechada) para tenerlo en el próximo control. Esa escritura se hacía
sin ninguna red de seguridad: si el almacenamiento del navegador estaba lleno, el error se
**tragaba entero y en silencio**, y todo lo de esa consulta no existía al día siguiente.

Usted no habría visto ningún error. Lo que notaría, días después, es que "la compuerta de
contexto se quedó atascada" — exactamente el mismo síntoma que ya reportó en campo por otra
causa (v16.4.0), y que por eso mismo habría sido difícil de atribuir.

Lo llamativo: **la defensa ya existía en el script**. Hay una función que, cuando el
almacén se llena, purga lo viejo y reintenta. La usan otras rutas. La que guarda la memoria
clínica del paciente, no.

Ahora sí la usa. Y si aun después de purgar no cabe, **se lo dice** en vez de callarse:
perder la memoria del paciente sin avisar es peor que interrumpirle un momento.

---

## [Versión 17.45.0] — 2026-08-29 (🔒 El nombre del paciente ya no puede viajar a la IA por el campo de medicamentos)

### Una fuga de datos del paciente, cerrada
Hallazgo de auditoría adversarial, no de consulta. El script tiene un censor que limpia lo
que se le manda a la IA, y ese censor trabaja de **dos formas distintas**:

1. **Por forma**: reconoce correos, teléfonos y cédulas porque tienen un patrón.
2. **Por nombre**: si se le dice cómo se llama el paciente, tacha sus apellidos donde
   aparezcan.

La segunda es la única capaz de tachar un apellido escrito en MAYÚSCULAS, que es como
Everest muestra los nombres. Y es la única posible para un nombre propio, porque un
apellido no tiene "forma" que un patrón pueda reconocer — es una palabra como cualquier
otra.

**El problema:** de los cinco caminos por los que su texto llega a la IA, cuatro le decían
al censor el nombre del paciente. Uno no: el de **"medicamentos aportados"**, que es
justamente un campo de texto libre donde es natural escribir cosas como *"según la esposa
de PEREZ GOMEZ, olvida la dosis de la noche"*. Por ahí, ese apellido salía del computador.

Ya está cerrado: ese canal recibe el nombre igual que los otros cuatro.

### Y una prueba que no probaba nada
Al verificar el arreglo rompiéndolo a propósito, **una de las tres pruebas nuevas no se
puso en rojo**. Investigado: armaba un prompt real y comprobaba que el nombre no
apareciera… pero con esos datos el ensamblador toma otro camino y el bloque ni siquiera se
genera, así que la prueba pasaba **por ausencia**. Se reescribió para que verifique el
cable de verdad, y ahora sí cae cuando el código se rompe.

Es el mismo error que este proyecto ya se llevó nueve veces, y por eso cada cambio se
rompe a propósito antes de darlo por bueno: *una prueba que no cae cuando el código se
rompe no está probando nada*.

---

## [Versión 17.44.0] — 2026-08-29 (El recordatorio de PyM ya no puede volverse ilegible)

### 👁️ Seis avisos que Everest podía borrar de su pantalla, uno de ellos clínico
Hallazgo de una auditoría de CSS. El recordatorio de PyM (`#vgl-pym-banner`) se pega
directamente sobre la página de Everest, fuera de nuestro contenedor protegido. Sus colores
se defendían **por especificidad**: una técnica que gana contra las reglas normales de
Everest… pero pierde contra cualquier regla que Everest marque como "importante", sin
importar nada más.

Y no es hipotético: el propio comentario del código documenta que **el contador ya cayó una
vez a contraste 1,54 en tema claro** — prácticamente invisible — por este mismo mecanismo.
Se arregló a medias entonces.

Uno de los seis es `.vgl-pymb-aviso`, que es un **aviso clínico**. Que pierda su color no lo
deja gris: lo deja ilegible sobre su propio fondo. Un aviso que usted no puede leer es lo
mismo que un aviso que no existe.

**Verificado en Chromium real**, no en teoría, contra un CSS de Everest simulado más
agresivo que la vida real (reglas con la marca de importante Y más específicas que las
nuestras):

| | Antes | Ahora |
|---|---|---|
| Aviso clínico de PyM | ❌ pisado (rojo de Everest) | ✅ ámbar correcto |
| Contador | ❌ pisado | ✅ sobrevive |
| Nombre de la actividad | ❌ pisado | ✅ sobrevive |
| Título | ❌ pisado | ✅ sobrevive |

Los cuatro se perdían antes; los cuatro sobreviven ahora. Nada cambia de aspecto cuando
Everest se comporta bien — esto solo importa cuando intenta pisarnos.

### 📋 Sobre el resto de la paleta: está bien
La misma auditoría calculó el contraste real de todos los pares de color que conviven en
la interfaz, en **los dos temas**. Ninguno incumple la norma de accesibilidad (AA): el peor
caso medido es 5,01 y el mínimo exigido es 4,5. **El problema nunca fue su paleta**, sino
que el CSS ajeno pudiera pisarla.

---

## [Versión 17.43.0] — 2026-08-29 (El asistente empieza a anotar cuándo se pone lento)

### 🐢 Usted dijo "sí siento lentitud, pero no sé cuándo". Ahora el script lo apunta solo
No se optimizó nada todavía **a propósito**: primero hay que saber qué es. Es la misma
disciplina que en la v17.15.0 convirtió "la consola está llena de errores" en un número
concreto ("un hover costaba 16 peticiones; después, 4").

**Lo que ya había, y por qué no servía.** El script lleva desde la v17.1.0 un medidor de
verdad: usa una función del navegador (LoAF) que sabe distinguir si un tirón lo causó
**nuestro** código o el de Everest. Pero solo llevaba una cuenta: "hubo 7 tirones de más de
300 ms". Un número así dice *cuántas veces*, nunca *qué estaba haciendo* — así que jamás
habría podido responder su pregunta. Y estaba apagado.

**Lo que se hizo.**
- Las fases caras del ciclo de 5 segundos (la cosecha de datos de la pantalla y los tres
  widgets de Conducta) ahora se cronometran una por una. Curiosamente, la herramienta para
  hacerlo ya existía desde la v17.1.0 y su propio comentario decía que **nunca se había
  usado en ningún sitio**; ahora sí.
- Cuando ocurre un tirón de más de 300 ms y es **nuestro**, se anota **una línea** en la
  bitácora local con la hora, en qué pantalla estaba usted, si había una historia abierta,
  y **qué fases acababan de correr y cuánto costó cada una**.
- Nace encendido, pero conviene decir exactamente qué significa eso: es un interruptor
  **distinto** al de las métricas de uso. Ése (el que puede enviar datos fuera del equipo)
  **sigue apagado de fábrica y no se tocó**. El nuevo solo escribe en la bitácora de su
  propio computador, que no se envía a ninguna parte.
- **Cero PHI, y hay una prueba que lo fija:** la línea guarda si había un paciente abierto
  (sí/no), nunca la cédula. Se comprueba buscando la cédula dentro de la línea guardada y
  exigiendo que no aparezca.

**Qué sigue.** Trabaje una jornada normal. Después leemos la bitácora y sabremos si el
tirón es lo que sospechamos (la cosecha, que barre la pantalla entera cada 5 s y reescribe
un almacén de hasta 80 pacientes) o algo distinto. Si es algo distinto, **manda la medición
y se reordena el plan** — que para eso se mide antes de tocar.

---

## [Versión 17.42.0] — 2026-08-29 (⚠️ SEGURIDAD: "Ordenar pendientes" ya no puede escribir en la historia equivocada)

### 🛡️ Se cerró un cruce de pacientes en el botón "Ordenar pendientes"
Hallazgo de una auditoría adversarial, **no** un reporte de consulta: nadie lo había
sufrido todavía, y por eso importa cerrarlo antes de que pase.

**Qué podía pasar.** Cuando usted pulsa "Ordenar pendientes", el script reproduce sus
mismos clics sobre Everest: clic en el examen de la lista, espera ~0,7 s a que Angular
monte el botón, clic en "Agregar", y otra espera para el cuadro de confirmación. Con
cuatro exámenes eso son **más de 12 segundos** de clics automáticos. Si en ese lapso usted
cerraba la historia y abría otra, el script **seguía buscando los botones en toda la
pantalla** — y encontraba los del paciente nuevo. Resultado posible: los exámenes del
paciente A quedaban ordenados en la historia de B, y A quedaba marcado como "ya ordenado"
sin estarlo.

**Lo llamativo es que la defensa ya existía.** Desde la v14.1.5 hay una guarda
(`_pacienteSigueAbierto`) creada exactamente para esto, y su propio comentario en el código
la describe como *"el riesgo clínico más alto que ha tenido este script"*. Se usa en las 13
rutas de escritura del script… menos en ésta, que nació después (v17.35.0) y nunca se
cableó a ella. Era la única cadena de escritura clínica sin la guarda.

**Qué se hizo.** La cédula que estaba en pantalla cuando usted pulsó el botón ahora viaja
hasta el gesto real, y se comprueba **antes de cada clic** — no solo al empezar, porque lo
que importa no es quién estaba al principio sino quién está en el instante exacto en que se
va a escribir. También se comprueba entre un examen y el siguiente.

**Y el mensaje dice la verdad.** Si el gesto se detiene por un cambio de paciente, ya no
sale el aviso genérico de "no se encontraron los botones" (que le habría mandado a buscar
un problema inexistente). Sale uno que dice lo que pasó: *"Se cambió de paciente mientras
se agregaban los exámenes, así que se detuvo: nada se escribió en la historia de otra
persona."*

Nada de esto cambia el comportamiento cuando usted se queda en la misma historia, que es lo
normal: ahí funciona exactamente igual que antes.

---

## [Versión 17.41.0] — 2026-08-28 (El botón de exámenes se viste igual que Historial y Paquetes)

### 🧪 El widget de "exámenes a ordenar" ahora se ve y se ubica igual que los botones nativos de Everest
Encargo suyo, tras corregirle mal el primer intento: "quiero que se vea igual que sus
hermanos Historial y Paquetes [nativos de Everest], quiero que este botón se vea igual y
esté justamente debajo de estos de Everest". El badge 🧪 vivía anclado solo al botón
"Paquetes" y con su propio estilo (fondo de color según el estado, sin relación visual con
Everest). Ahora:
- **Se ancla igual que "Ordenar pendientes"**: al mismo punto medio entre "Historial" y
  "Paquetes" (`mtrAnclaOrdenarPendientes`, no ya `mtrBotonOrdenarConducta`), en una
  **segunda fila** justo debajo de donde iría "Ordenar pendientes" — nunca se solapan,
  aunque ese día no haya nada que ordenar.
- **Comparte una sola hoja CSS con `#vgl-cw-ordenar-btn`**, copiada del CSS real declarado
  del botón "Paquetes" que usted mismo pegó de la consola: mismo `border-radius`,
  `letter-spacing`, `line-height`, tipografía y color — así los dos NUNCA pueden divergir
  visualmente por accidente.
- Verificado en Chromium real contra un CSS "Everest" simulado agresivo
  (`div,span,p,b,small,label,button{color:red !important;background-color:blue
  !important}`): el `color` y el `background-color` del badge y del botón sobreviven los
  dos, porque las dos declaraciones llevan `!important` (regla del proyecto para todo lo
  que vive fuera de `#vgl-root`).

### 🔧 Un defecto de arnés de pruebas, encontrado al mutar el cambio de arriba
Al romper a propósito la fórmula de posición para confirmar que la prueba la detectaba,
la prueba **no la detectó** — ni con el ancla rota ni con el desplazamiento vertical
quitado. La causa: los objetos de botón simulados de `tests/suite_71_widget_conducta.js`
(`boton()`, `botonHistorial()`) nunca declaraban `.bottom` en su `getBoundingClientRect()`
simulado — solo `top`/`height`. `Math.max(rH.bottom, rP.bottom)` daba `NaN` tanto en el
valor real como en el esperado, y `"NaNpx" === "NaNpx"` pasaba sin que el código roto
importara. Se les añadió `bottom` (coherente con `top + height`) a los dos; con eso, romper
la fórmula de posición SÍ tumba la prueba. No cambia ningún comportamiento del script, solo
la capacidad del arnés de detectar una regresión real.

---

## [Versión 17.40.0] — 2026-08-28 (Reporte en vivo: ahora sí avisa aunque esté en otra ventana o programa)

### 🔔 Las notificaciones ya no se quedan calladas cuando Everest está de fondo
Reporte suyo: "cuando estoy en otra ventana que no sea Everest o en otro programa, no me
avisa de llegadas, cambios de leyenda, inasistencias". Tenía razón, y encontramos la causa
exacta: el script solo revisaba si la pestaña estaba minimizada u oculta para decidir cómo
avisarle — pero el navegador NO considera "oculta" una pestaña que sigue abierta detrás de
otra ventana, o mientras usted trabaja en otro programa. Solo pasa a "oculta" si la
minimiza o cambia de pestaña. En esos dos casos que usted describió, el script creía que
usted seguía mirando la pantalla, así que pintaba el aviso DENTRO de la página — quedando
tapado detrás de la otra ventana — en vez de mandar la notificación real de Windows, la
única que sí se ve estando en otro programa. Ahora el script también revisa si la ventana
tiene el foco, no solo si está oculta: "otra ventana encima" y "minimizado" cuentan igual,
y en los dos casos sale la notificación real del sistema. El reloj que detecta llegadas y
cambios de leyenda seguía funcionando bien de fondo — el defecto era solo en cómo avisaba,
nunca en que dejara de darse cuenta.

**Importante para que esto funcione**: Chrome o Edge le tienen que haber pedido permiso de
notificaciones para este sitio, y usted haberlo aceptado. Revíselo en el candado junto a la
barra de direcciones → Notificaciones. Sin ese permiso, ni este arreglo ni ninguna otra
versión puede mostrarle un aviso mientras está en otro programa.

---

## [Versión 17.39.0] — 2026-08-28 (El botón "Ordenar pendientes" ya luce igual al "Paquetes" real de Everest)

### 🎨 Mismo blanco, misma letra, mismo borde — el de verdad
A pedido suyo: sacó del propio navegador el estilo real del botón "Paquetes" (consola,
`getComputedStyle`) y lo pegó aquí. El botón "Ordenar pendientes" ahora usa exactamente
esos valores — fondo blanco, letra casi negra, sin borde, esquinas redondeadas iguales,
sin sombra, mismo alto y la misma tipografía de Everest — en vez de nuestro estilo propio
(verde, con sombra). Verificado en Chromium real contra un CSS agresivo simulado para
confirmar que el color no se lo come ninguna regla de Everest.

---

## [Versión 17.38.0] — 2026-08-28 (Corrección suya: el botón queda ESTÁTICO, sin seguir el scroll por JavaScript)

### 📌 Se retira el seguimiento por scroll — ahora es de verdad estático
Su corrección sobre la versión anterior: "yo no te pedí que siguiera el scroll, te pedí
que sea un botón estático". Tenía razón — el arreglo anterior recalculaba la posición del
botón con JavaScript cada vez que usted se desplazaba, y eso nunca se siente igual de
natural que un botón que de verdad forma parte de la página. Se retira ese mecanismo por
completo. La causa de fondo era otra: el botón se posicionaba con coordenadas de
**ventana** (`position: fixed`), que por diseño del navegador nunca se mueven con el
scroll — la única forma de "seguirlo" era recalcular todo el tiempo. Ahora se posiciona
con coordenadas de **página** (`position: absolute`), igual que cualquier otro elemento
del formulario: el navegador lo desplaza solo, junto con "Historial" y "Paquetes", sin una
sola línea de JavaScript de por medio. Aplicado a los tres widgets de Conducta (el botón
de ordenar, el de exámenes pendientes y el de seguridad farmacológica).

---

## [Versión 17.37.0] — 2026-08-28 (Reporte en vivo: el widget ya sigue el scroll, y el botón deja de agregar hemograma)

### 📍 El widget ya no "viaja solo" al desplazarse
Reporte suyo, con captura real: "el widget no es fijo, viaja contigo al mover el mouse o
cuando te desplazas... muy anti intuitivo". Causa: los tres widgets de Conducta se
posicionan con coordenadas de pantalla, pero solo las recalculaban cada varios segundos (el
reloj de sondeo de fondo) — nunca al desplazarse. Entre una vuelta y la siguiente, el botón
se quedaba clavado en su posición vieja mientras el formulario se movía por debajo, y de
golpe se recolocaba en el siguiente ciclo. Ahora los tres widgets se reposicionan en cada
gesto de scroll (y al cambiar el tamaño de la ventana), igual de livianos que antes.

### ⛔ El botón "Ordenar pendientes" deja de agregar hemograma
Reporte suyo, mismo mensaje: "agrega hemograma y ese laboratorio no hace parte de los
analitos permitidos". Tenía razón: el gesto "Paquetes → HTA" que el botón disparaba para el
perfil lipídico, la glicemia, el uroanálisis y la creatinina trae SIEMPRE, de arrastre, un
hemograma — un examen que no está entre los que este proyecto vigila ni pide. Se retira por
completo el disparo de "Paquetes → HTA": el botón ya NO agrega esos cinco (perfil
lipídico, glicemia, uroanálisis, creatinina); solo sigue agregando, uno por uno, los que
tienen búsqueda individual confirmada (PTH, fósforo, albúmina, hemoglobina, HbA1c y los dos
componentes de la RAC). Los que quedaron fuera del botón usted los sigue viendo, igual que
siempre, en la pastilla de "qué ordenar" — y los agrega usted mismo con su propio botón
"Paquetes" cuando decida qué hacer con el hemograma que trae de arrastre.

---

## [Versión 17.36.0] — 2026-08-28 (Corrección del médico: la RAC sola ya NO arrastra el paquete completo)

### ✅ La RAC ahora se agrega igual de sola que cualquier otro examen suelto
Corrección suya, en el sitio: la versión anterior, si la RAC era lo único pendiente,
igual disparaba el paquete completo de la HTA (8-10 exámenes ajenos) para conseguir la
mitad de la RAC que el paquete también trae. Usted lo señaló de inmediato: "jamás debes
hacer eso, solamente ordenar lo que se debe" — y con razón, porque los dos exámenes de la
RAC (microalbuminuria en orina parcial y creatinina en orina parcial) sí se pueden buscar
y agregar sueltos, uno por uno, igual que PTH, fósforo o albúmina. A partir de ahora, si
la RAC es lo único pendiente, el botón solo busca y agrega esos dos exámenes — nunca el
paquete completo. El botón sigue verificando cada uno en la propia tabla antes de darlo
por agregado, y si solo uno de los dos aparece, no cuenta la RAC como completa: se
avisa para que la revise a mano.

---

## [Versión 17.35.0] — 2026-08-28 (El botón "Ordenar pendientes" ahora hace lo mismo que el botón "Paquetes" de Everest)

### 🖱️ El botón ya no crea una orden aparte: ahora clickea la pantalla igual que usted
El diagnóstico en vivo de la versión anterior confirmó que "Paquetes" no manda nada a un
módulo distinto: agrega las filas directo en la tabla de Conducta que usted ve en
pantalla, sin ninguna petición extra de por medio. El botón nuevo, hasta ahora, sí creaba
una orden real pero por otro camino — por eso usted no la veía en la tabla. A partir de
esta versión, el botón hace exactamente lo que usted haría a mano: clickea "Paquetes" y
luego el programa correspondiente para los exámenes que vienen agrupados, y busca y
agrega uno por uno los que se piden sueltos (PTH, fósforo, albúmina, hemoglobina,
hemoglobina glicosilada y la microalbuminuria de la RAC). Cada texto que busca es el texto
real que usted mismo ve en pantalla — capturado dos veces en su consultorio, 16 días
aparte, con el mismo resultado las dos veces. Sigue sin pedir confirmación, como usted
pidió, y sigue verificando en la propia tabla que la fila apareció antes de darla por
agregada — nunca asume que un clic funcionó solo porque se dio.

~~**Un límite que hay que saber**: si la RAC es el único examen pendiente, el botón igual
agrega el paquete completo de 8-10 exámenes, porque la mitad de la RAC (la creatinina en
orina) solo existe agrupada ahí — no hay manera confirmada de pedirla sola.~~ **Corregido
en la v17.36.0** (ver más arriba): sí hay manera de pedirla sola, y así quedó.

Pruébelo con calma las primeras veces y revise que las filas correctas queden en la tabla
de Ordenamientos antes de guardar la consulta.

---

## [Versión 17.34.0] — 2026-08-28 (Reporte en vivo: el panel angosto, el botón mal ubicado, y "Generar todo" fuera)

### 🩹 El panel de exámenes ya no se abre angosto y partido letra por letra
Reporte en vivo, con pantallazo: al abrir el aviso de "qué ordenar" junto al botón
"Paquetes", el panel salió pegado al borde derecho de la pantalla, tan angosto que el
texto se leía partido letra por letra. Causa: el panel se posicionaba con
`izquierda = borde derecho del botón + 10`, sin límite — cuando ese punto queda cerca del
borde de la ventana, el navegador ENCOGE el panel al espacio que queda en vez de dejarlo
salirse (así calcula el ancho cualquier caja con posición fija que solo fija un lado).
Ahora la posición se decide en el propio script: si no cabe a la derecha, se abre a la
izquierda del botón; si tampoco cabe ahí, se recorta contra el borde — nunca más angosto
de lo que hace falta. Corregido en los dos paneles que comparten el mismo patrón (el de
exámenes y el de seguridad farmacológica).

### 🎯 El botón "Ordenar pendientes" queda literal en medio de "Historial" y "Paquetes"
Encargo del médico: "quiero que literal esté en medio del botón de historial y paquetes,
justo debajo, sin afectar la visibilidad de lo demás". El botón (v17.32.0) se ancla ahora
al punto medio entre los dos botones nativos de Everest, justo debajo de ambos — no solo
al de "Paquetes" como en la primera entrega. Ojo con el detalle real: la pantalla de
Conducta tiene DOS botones de texto "Historial" (el de Ordenamientos y el de
Medicamentos, más abajo); el ancla nuevo descarta cualquiera que no esté en el MISMO
renglón que "Paquetes", para no terminar centrado contra el botón equivocado.

### 🔬 Diagnóstico en vivo: así es como Everest agrega un paquete — y por qué el botón nuevo no llenaba la misma tabla
Reporte en vivo: "tampoco pega los laboratorios así como lo hace el botón de Paquetes".
Diagnóstico corrido por el médico en consulta real (solo forma: método+ruta de red, texto
de botón, y código/nombre/cantidad de examen — nunca nada del paciente) confirma que
"Paquetes" + "Agregar" hacen **una sola** petición de red (un `GET` que trae el catálogo
del paquete) y el resto — las diez filas que aparecen en la tabla — lo arma Everest
enteramente en el navegador, sin ninguna otra petición; la fila queda pendiente de
guardarse hasta que el médico use el "Guardar" propio de Everest para toda la consulta.
Es un mecanismo DISTINTO del que usa el botón nuevo (que crea una orden real, ya guardada,
por el módulo de Ordenamientos de Everest — el mismo que ya usan las órdenes de PyM desde
hace meses). Con esa evidencia en la mano, qué hacer con el botón queda como decisión
pendiente del médico — documentado, no adivinado.

### 🧹 Se retira "Generar todo" del Redactor IA
Encargo del médico: "casi ni lo uso, más bien estorba". El botón que generaba las tres
casillas del Redactor (Enfermedad Actual, Análisis y plan, Recomendaciones) en cadena, con
un solo clic, se retira junto con su lógica exclusiva. Queda "Generar" (una casilla a la
vez, la de siempre) sin cambios.

---

## [Versión 17.33.0] — 2026-08-28 (El interruptor de Ajustes ya dice que el botón nuevo SÍ actúa)

### 🏷️ "Solo avisa" dejó de ser cierto para este interruptor, y el texto ya lo dice
Reporte en vivo: el médico encendió Conducta y no vio ni el botón nuevo de v17.32.0 ni el
aviso de seguridad farmacológica — los tres widgets de Conducta (el de exámenes, el de
farmacia y el botón "Ordenar pendientes") cuelgan del MISMO interruptor de Ajustes
("Exámenes y órdenes en Conducta"), apagado de fábrica desde que existe. No es un defecto:
así se diseñó desde v17.18.0, para que nadie reciba un widget nuevo sin haberlo pedido. Pero
su descripción decía "Solo avisa: no toca ni escribe nada dentro de Conducta" — cierto
cuando se escribió, y ya no: el mismo interruptor ahora también enciende un botón que SÍ
actúa, sin pantalla de confirmación. El texto se corrige para decir las dos cosas por
separado — lo que solo avisa, y lo que sí ordena — antes de que el médico decida encenderlo.

---

## [Versión 17.32.0] — 2026-08-28 (Botón "Ordenar pendientes" en Conducta: un clic, sin pantalla intermedia)

### 📋 Debajo del botón "Paquetes" de Everest, un botón que ordena todo lo pendiente de un clic
Encargo del médico: "necesito además el botón debajo del botón de Paquetes en la sección de
Conducta para agregar en un solo clic los laboratorios que se debe ordenar cada paciente en
la próxima consulta de manera ágil y fácil". Al preguntarle si debía abrir el modal de
Ordenar ya marcado (un clic más para confirmar) o generar la orden de una vez sin pantalla
intermedia, eligió la segunda — "tal cual como lo haría el botón de Paquetes que ya trae
Everest". Es la excepción documentada que CLAUDE.md prevé (v12.10.4): un botón sin cuadro
de confirmación porque el propio médico lo pidió así.

**Qué ordena, y por qué es exactamente lo mismo que ya ve en el widget de al lado**: el
botón lee `resumen.plan.ordenar` a través de `mtrTableroClinico` — el MISMO dato, calculado
por el MISMO `mtrPlanParaclinicos`, que ya alimenta el widget de solo-lectura "qué ordenar"
(#vgl-cw-examenes, v17.18.0) que el médico ya usa a diario. El botón no tiene ninguna regla
propia sobre qué está pendiente: todo lo que decidieron esta semana (drivers y pasajeros,
el equilibrio ANR/cosecha de v17.30.0, la gracia de 14 días, el grupo de lípidos, la regla
del 50% por meta, la TFG de v17.31.0) ya vive en `mtrPlanParaclinicos` y llega intacto.

**Cómo ordena**: reusa el mismo camino de red ya probado y en producción que usa el botón
"Ordenar" del dock (`apiOrdenamientoBuscarPaciente` → `ObtenerDx` → `ObtenerCup` →
`GuardarOrdenamiento`), con el mismo diagnóstico "I10X" (PYM_CATALOG, "RCV EXPRÉS") que el
médico ya verificó el 2026-08-11 para exactamente esta población. Los CUPS de cada analito
vienen de dos fuentes ya verificadas en producción — el propio I10X y
`CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO` — nada se inventa. RAC exige sus dos códigos
(creatinina en orina + microalbuminuria) siempre juntos: si falta uno, RAC entera queda sin
ordenar en vez de pedir la mitad. Un fallo de red o del servidor se avisa con un aviso
visible y el botón queda disponible para reintentar — nunca se marca como hecho algo que no
se sabe si quedó. Un "ya se ordenó hoy" propio (namespace separado del botón "Ordenar" PyM
del dock, para que uno no apague al otro con un mensaje que ya no sería cierto) evita un
doble pedido si el médico vuelve a entrar a Conducta el mismo día.

**Lo que esta versión deliberadamente NO hace**: no toca la pantalla de Conducta en ningún
momento — ni para leerla (salvo encontrar el botón "Paquetes" como ancla de posición, igual
que ya hacía el widget hermano) ni para escribirla. v15.3.0 retiró para siempre la
automatización que simulaba clics ahí, por un bucle real que causó en consultorio; este
botón crea la orden por el módulo de Ordenamientos de Everest, exactamente como si el
médico hubiera hecho el gesto manual — el mismo principio que ya rige el botón "Ordenar"
desde ese retiro.

---

## [Versión 17.31.0] — 2026-08-28 (Con la TFG por Cockcroft-Gault ya calculada, ya no pregunta si hay ERC)

### 🧠 Una TFG<60 ya calculada resuelve la pregunta sola
Reporte en vivo: al entrar al Panel del paciente, a veces pregunta si el paciente tiene
enfermedad renal crónica aunque la TFG ya esté por debajo de 60 — "el script no consulta
la TFG... el script debe ser inteligente en estos casos" (y, al recordárselo: "RECUERDA
COCKCROFT GAULT" — la TFG que decide aquí es la administrativa, Cockcroft-Gault, la misma
que rige vigencias en todo el resto del script, NUNCA la CKD-EPI). Causa: el reconciliador
de fuentes nunca recibía la TFG — el único llamador en vivo no traía los laboratorios a
propósito, y de todos modos ERC en la lista de hechos sensibles no tenía ningún laboratorio
asociado, porque la TFG no es un resultado de laboratorio con clave propia, es un cálculo.
Con una TFG por Cockcroft-Gault ya calculada y por debajo de 60 ml/min, la enfermedad renal
crónica queda establecida por evidencia objetiva y esa pregunta puntual se salta por
completo — el resto de hechos sensibles (diabetes, hipertensión, tabaquismo, enfermedad
cardiovascular) no se toca, y sin la TFG en caché (o con TFG≥60) la pregunta sigue
saliendo exactamente igual que antes.

---

## [Versión 17.30.0] — 2026-08-28 (Con el ANR activo, solo se vale UNA regla — no dos apiladas)

### 🔀 Ya no se pueden activar el ANR y la cosecha genérica a la vez
Reporte en vivo, con pantallazo: en un paciente con ERC, la creatinina forzaba la toma a
solo 6 días (agujero negro renal activo) y arrastraba con ella glicemia, uroanálisis y
HbA1c — cada una a unos 65 días de SU PROPIO vencimiento, sin relación alguna con lo
renal — porque con la toma tan adelantada, el 33% de margen de esos exámenes (y encima
la gracia de 14 días, v17.29.0, del mismo día) seguían cabiendo igual. El médico: "no
puedes activar ANR y a su vez los vencidos [la cosecha genérica], trata de equilibrar,
proponme otra alternativa". La alternativa: con el ANR gobernando la fecha de la visita,
solo la creatinina (siempre) y el RAC sincronizado (si cae dentro de la ventana) se
agrupan de forma automática — el resto de los drivers vuelve a necesitar estar vencido o
faltante por su propia cuenta para entrar en esa visita, tanto por la regla base del 33%
como por la gracia de 14 días. Nada de esto toca el grupo de lípidos (que sigue
arrastrando LDL/HDL/colesterol total/triglicéridos entre sí cuando alguno falla) ni la
regla del 33% o la gracia cuando NO hay ANR activo — solo se apaga la superposición de
las dos reglas cuando el ANR ya está gobernando la fecha.

---

## [Versión 17.29.0] — 2026-08-28 (Menos viajes al laboratorio: arrastre por gracia, medido antes de construir)

### 🚗 Un examen que se pasa por poco de su corte ya no obliga a un viaje aparte
Reporte en vivo: creatinina (margen 69 días de una vigencia de 180) y glicemia (margen
54 días, ya se cosechaba) en la misma visita — 15 días de diferencia, y aun así la
creatinina quedaba para otro viaje. Investigado: no es un bug del ANR ni de una "ventana
de agrupación" — cada examen se evalúa solo contra el 33% de su propia vigencia. El
médico pidió una propuesta y aprobó medir antes de tocar código (`tools/medir_cercania.js`,
10.000 pacientes sintéticos): con 14 días de gracia sobre ese corte, 18,6% de los
pacientes con algún examen diferido se ahorran un viaje completo. El médico vio la tabla
completa (7/14/21/30 días) y eligió 14 — el mismo piso que ya usa el motor para Estado A.
La regla nunca compara la fecha de un examen contra la de otro ni mueve la fecha de la
toma: solo adelanta un examen que ya estaba a punto de entrar por su cuenta.

### ⏱️ El resumen clínico compartido se refresca cada 3 minutos, no cada 10
Agendamiento y Ordenamiento reutilizan el resumen que calculó Laboratorios (labs, función
renal, riesgo, fecha de control) para no repetir la consulta por red. Esa copia se
consideraba válida por 10 minutos — suficiente para que, en una consulta activa, un dato
que acababa de cambiar no se reflejara a tiempo. Baja a 3 minutos.

### 🩸 La meta de triglicéridos sube a 400 mg/dL
Encargo del médico: "vamos a repetir los triglicéridos mayor a 400, ya no en 200". La
meta base pasa de 150 a 400 — con el mismo margen del 30% que ya usa el resto del motor
para marcar "grave" en las tendencias, el corte queda cerca de 520, alineado con el
umbral clínico de riesgo de pancreatitis (TG≥500) que ya menciona el prompt de la IA.

### 🐛 Un RAC vencido ya no se veía en ámbar mientras la LDL vencida sí se veía en rojo
Reporte en vivo, con pantallazo: en el mismo paciente, la LDL vencida salía roja y el RAC
≥30 (también vencido, y con albuminuria — "vigilancia estrecha") salía en el color de
"por pedir", como si no fuera urgente. Causa: un RAC≥30 vencido se reclasifica
internamente a un estado propio para señalar la albuminuria, y el chequeo de color de dos
pantallas distintas (el widget flotante de Conducta y la pestaña Exámenes del Panel) solo
reconocía el estado "vencido" normal, nunca ese caso. Corregido en las dos: un RAC
vencido con albuminuria se ve igual de rojo que cualquier otro examen vencido — nunca
menos urgente.

---

## [Versión 17.28.0] — 2026-08-28 (Enfermedad Actual sin examen físico, la regla del 50% se ajusta, y limpieza de Panel/notificaciones)

### 🩺 Enfermedad Actual deja de mezclar anamnesis con examen físico
Reporte en vivo del médico: "se sigue colando examen físico en la enfermedad actual, eso
no es permitido". Investigado contra semiología clínica estándar (anamnesis y examen
físico son fases distintas del acto médico) — la presión arterial y el peso de HOY salían
como contenido obligatorio de Enfermedad Actual desde v17.6.3 (con la condición de que
constaran en los hechos). Esa condición no bastaba: el error no era inventar la cifra, era
pedirla en el lugar equivocado incluso siendo real. Se retira por completo — nunca más en
Enfermedad Actual, ni siquiera si consta. El automonitoreo domiciliario que el paciente
refiere de su casa sigue siendo anamnesis legítima y no se toca.

### ⚖️ La regla del 50% de vigencia por fuera de metas se ajusta a lo que el médico confirmó
- **Triglicéridos** sale de la lista de disparadores independientes — solo se arrastra con
  el grupo lipídico cuando otro lípido dispara, nunca por su cuenta.
- **Glicemia >130 mg/dL** entra — antes deliberadamente excluida por falta de meta
  definida; ahora reusa la misma meta (130) que ya usa el eje de falla terapéutica desde
  v17.6.84, con el mismo margen del 15% que el resto ("una sola vara").
- RAC y TFG/creatinina por Cockcroft-Gault, mencionados en la misma regla, **no se tocan
  todavía**: ambos ya tienen su propio mecanismo de acortamiento (RAC: override a 90 días;
  TFG: la tabla de vigencias por estadio ERC), y añadirlos a esta lista los reemplazaría en
  vez de sumarse — pendiente de que el médico confirme si esos mecanismos ya cumplen su
  regla o si de verdad quiere una capa nueva encima.

### 🧹 "Medicamentos actuales" sale del Panel — solo riesgo cardiovascular
La lista pasiva completa de medicamentos que el Resumen del Panel ganó en v17.24.0 se
retira: duplicaba, sin aportar nada, la fila "Medicamentos del programa cardiovascular" ya
existente en la Ficha (esa sí filtrada a RCV). El Panel solo debe mostrar medicamentos con
foco de riesgo cardiovascular.

### 🔕 Se retira el toast de "Cita de Laboratorio agendada"
El aviso en pantalla que confirmaba cada cita de laboratorio agendada (con o sin SMS
enviado) se retira por pedido del médico. El agendamiento real y el envío del SMS al
paciente no se tocan — solo se calla el aviso.

---

## [Versión 17.27.0] — 2026-08-28 (La IA ya no memoriza el "50% de reducción de LDL" — lo cita del motor)

### 🐛 Corrección en vivo: la meta de reducción de LDL se marcaba como cifra inventada
El médico probó "Análisis y plan" contra un paciente real y la caja roja de "cifras sin
respaldo" marcó el "50" de "REDUCCIÓN MAYOR O IGUAL AL 50% DEL BASAL" — pese a que el
modelo lo escribió bien. Causa real: ese porcentaje SÍ es un valor que el motor calcula
(la misma tabla de metas que da la meta de LDL <70 mg/dL), pero el prompt lo tenía escrito
como una regla fija ("...si riesgo alto/muy alto") en vez de pasarlo como dato — el modelo
lo citaba de memoria de la instrucción, no de ningún campo del JSON, así que el verificador
de cifras nunca lo reconoció como legítimo. Mismo principio que ya protegía la meta de LDL
y el cNoHDL ("el número real viaja calculado para que la IA solo lo cite, nunca lo
recuerde"): se agrega `ldl_reduction_target` al JSON del motor y a la hoja de hechos en
texto plano, y el prompt pasa a citar el campo en vez de declarar un número fijo. Cuando el
riesgo es moderado/bajo (la norma no exige reducción), el campo queda vacío y el prompt
calla ese porcentaje — nunca inventa uno que no aplica.

---

## [Versión 17.26.0] — 2026-08-28 (Laboratorios: la seguridad farmacológica se muda a Conducta, y su redacción se limpia)

### 🐛 Corrección en vivo: códigos crudos en los avisos de seguridad farmacológica
El médico probó el motor contra un paciente real en el modal de Laboratorios y reportó
dos defectos de redacción en el mismo bloque:

- Las 17 interacciones del catálogo RCV (`AINE_RAAS`, `ISRS_ISRN_AINE`,
  `TRAMADOL_ISRS_ISRN`...) se veían en pantalla con su **código interno crudo** en vez de
  un título legible. El catálogo ya trae ese título (con fuente citada, BNF) desde que se
  incorporó — solo faltaba pasarlo del catálogo al aviso que se pinta. Corregido:
  `mtrEvaluarConCatalogoRcv` copia `titulo` al aviso y `mtrEtiquetaAviso` lo prefiere sobre
  el código.
- La conducta `"CAP_DOSIS"` (18 sitios del Copiloto de dosis renal — metformina,
  rosuvastatina, furosemida, DOAC...) se veía tal cual, en snake_case, junto al resto de
  conductas ya legibles (AJUSTAR, EVITAR, CONTRAINDICADA...). Se traduce a "TOPE DE DOSIS"
  solo al pintar — ninguno de los 18 sitios que deciden la conducta se toca.

### 🚚 El bloque de seguridad farmacológica sale de Laboratorios
Reporte del médico, mismo hallazgo en vivo: ese bloque **no debería estar en el modal de
resultados de laboratorio** — el juicio farmacológico ya vive en su propio widget en
Conducta (`#vgl-cw-farmaco`, v17.25.0), y tenerlo repetido en Laboratorios era, en sus
palabras, "erróneo". Se retira el contenedor y el cálculo de Laboratorios; el recuadro de
función renal (TFG, estadio) se queda — la observación fue puntual sobre seguridad
farmacológica, no sobre ese recuadro.

### 🩺 El recuadro de función renal de Laboratorios, por fin visible (auditoría propia)
Mismo patrón que el hallazgo de v17.12.0, encontrado en una auditoría del módulo de
Laboratorios: `_renderEstadioRenalHtml` (TFG, estadio, discordancia entre fórmulas,
paciente pediátrico, creatinina fuera de rango) estaba escrita, probada de punta a punta
y con su propio CSS — y nunca se insertaba en ningún sitio: no había ni un contenedor
para ella en la plantilla del modal. Corregido junto con lo anterior.

---

## [Versión 17.25.0] — 2026-08-28 (Widget de farmacia en Conducta — Fase 2, y un hallazgo grave)

### 💊 Widget de análisis farmacológico en Conducta (Fase 2 del rediseño del Panel)
Junto al botón "+" de reformular un medicamento, un aviso propio con el mismo lenguaje
que el widget de exámenes: insignia, panel al abrir, 3 estados honestos. Con el motor
de avisos apagado (su estado de fábrica), el widget **aparece con un aviso neutro** —
nunca oculto, nunca como si ya se hubiera revisado y no hubiera nada (decisión del
médico, entrevista de anoche). La duplicidad terapéutica se ve siempre, dependa o no
del motor.

Se repinta después de una acción real de prescribir (un clic en "+" o en confirmar del
modal de reformular), releyendo los medicamentos por la misma vía que ya usa el resto
del script. **No es repintado por cada tecla** — el pedido original era "en tiempo real
mientras receta", y esta entrega no llega del todo a eso: la estructura interna de
cómo Everest muestra cada medicamento en pantalla no se pudo capturar sin arriesgarse
a inventar un dato que nadie verificó. Dos grabaciones reales de consulta (28-ago)
confirmaron el botón de anclaje y el gesto de reformular con detalle; una segunda
grabación reveló además la tabla donde se agrega un medicamento nuevo — información
valiosa para una futura entrega, pero todavía no verificada lo suficiente como para
construir sobre ella sin adivinar.

### 🐛 Hallazgo grave: el widget de exámenes de Conducta nunca se había pintado
Investigando cómo enganchar el widget nuevo se descubrió que su hermano — el widget de
"qué ordenar en el próximo control" (Conducta, v17.18.0) — **jamás se conectó al reloj
real del script**. Su lógica estaba escrita y probada de punta a punta desde que se
entregó, pero la línea que debía llamarlo en cada revisión de la historia nunca se
escribió. En la práctica, ese widget no ha aparecido en ninguna consulta real desde que
el registro de cambios lo dio por entregado. Corregido: los dos widgets de Conducta
(exámenes y farmacia) ahora sí se enganchan al mismo reloj que ya usan el resto de los
avisos automáticos de la historia. Se añadió una prueba de regresión que lee el propio
código fuente para confirmar que la llamada existe — la misma lección que ya dejó
escrita `tests/INFORME_MUTACIONES.md` en v17.12.0: "probar la pieza no es probar que
la pieza está conectada".

---

## [Versión 17.24.0] — 2026-08-28 (Panel del paciente, Fase 1: dashboard de estado y medicamentos pasivos)

### 🧾 Rediseño S+ del Panel del paciente — Fase 1
Primera de dos entregas del rediseño decidido en la entrevista de anoche: la pestaña
**Medicamentos desaparece** del Panel (queda en 4 pestañas: Resumen, Riesgo y función
renal, Exámenes y vigencias, Tendencias). Todo el juicio farmacológico accionable
(avisos de seguridad, duplicidades) se muda a un widget nuevo en Conducta —Fase 2,
todavía bloqueada, ver más abajo. Resumen gana dos piezas nuevas:

- **«Estado de un vistazo»**: 3 tarjetas (Riesgo cardiovascular, Exámenes y vigencias,
  Tendencias) con el mismo semáforo de 3 estados honestos que ya usa el widget de
  exámenes de Conducta — nunca "no sé" disfrazado de "está bien". Cada tarjeta usa
  literalmente los mismos datos que su pestaña detallada (nunca un criterio propio que
  pueda divergir), y un clic salta directo a esa pestaña sin pedir nada por red.
- **«Medicamentos actuales»**: lista simple de lo que el paciente toma, sin avisos ni
  duplicidades — un archivo de consulta rápida, no una decisión clínica.

Antes de tocar el Panel se investigó su arquitectura real con una tanda de agentes (7
en total): confirmó que `#vgl-ficha-modal`/`#vgl-tablero-modal` son ids fósiles sin
consumidor real (todo pasa por `openPanelPacienteModal`), y que separar el juicio
farmacológico del Panel evita el riesgo de que dos superficies (Panel y widget)
cuenten algo distinto para el mismo paciente — el mismo defecto que ya se corrigió en
v17.1.0 para el conteo de medicamentos.

Se le presentó al médico una maqueta visual (HTML, sin lógica, con la paleta real del
script) antes de escribir una sola línea de producción — nada de esto se implementó a
ciegas.

### 🐛 Dos bugs de CSS reales, encontrados investigando (no hipótesis)
- El CSS de los avisos farmacológicos (`.vgl-mtr-*`) solo estaba sembrado para el
  modal de Laboratorios: dentro de la extinta pestaña Medicamentos del Panel, esos
  avisos se pintaban sin color de severidad. Corregido en la v17.23.0 (anoche), antes
  de esta entrega.
- En el recuadro de "Riesgo cardiovascular" que comparten Ordenar y Laboratorios, 6
  reglas de color solo llevaban el descendiente real (`b`, `li`, `summary`) del lado
  de Laboratorios — el lado de Ordenar apuntaba a la clase sola y ese texto (TFG en
  negrita, cada ítem de examen, el analito vencido en ámbar) nunca recibía su color
  ahí. Corregido con simetría entre los dos modales.
- Dos modificadores (`.vgl-rcv-aviso-alto`, `.vgl-rcv-lista-orden`) competían con su
  clase base por la misma especificidad: cuál ganaba dependía del orden de la hoja,
  no de la intención. Ahora son selectores compuestos (`.base.modificador`), como ya
  se hace en el resto del script para este mismo patrón.

### 🔧 El instrumento de prueba dejó de ser ciego a media hoja de estilos
`tests/suite_25_cascada_css.js` extraía el CSS real con un escaneo de texto que no
evaluaba las interpolaciones (`${_cssSeguro(() => XXX)}`) con las que el script
"empalma" cuatro hojas completas (declaradas como const separadas para evitar un
error de inicialización). Esas cuatro hojas —una de ellas la que sostiene el
dashboard nuevo de esta versión— eran invisibles para el banco de regresión de CSS
desde siempre, aunque sí se aplican en el navegador real. Corregido con el mismo fix
que ya llevaba `tools/verificar_color_chromium.js` desde anoche.

### 🔒 Fase 2 — todavía bloqueada, sin cambios
El widget de análisis farmacológico en vivo (Conducta, junto al botón de recetar)
sigue sin construirse: hace falta ver el formulario de prescripción mientras se
llena, no solo el botón — las funciones que leen medicamentos hoy son 100% vía API y
no sirven para eso. El médico ya grabó una consulta real con el script de captura de
la pantalla de Conducta; su análisis es el siguiente paso.

---

## [Versión 17.23.0] — 2026-08-28 (Los avisos farmacológicos del Panel del paciente ya tienen color)

### 🐛 Hallazgo real, no hipotético
Durante la investigación del rediseño S+ del Panel del paciente salió un bug concreto:
el CSS de los avisos de seguridad farmacológica (duplicidad, interacción, dosis renal —
lo que pinta `mtrPintarAviso`) solo estaba sembrado para el modal de Laboratorios
(`#vgl-labs-modal`). Los mismos avisos también se pintan dentro de la pestaña
Medicamentos del Panel del paciente (`#vgl-panel-modal`), y ahí se veían **sin fondo, sin
borde y sin el color rojo/ámbar/azul de severidad** — no por perder una batalla de
especificidad contra Everest, sino porque ninguna regla nuestra aplicaba ahí. Con el
motor de avisos encendido (`S.motorPortado`, apagado de fábrica), un aviso CRITICAL se
veía visualmente igual que uno informativo. Cada selector de ese bloque ahora apunta a
los dos modales; verificado en Chromium real contra un CSS de Everest simulado agresivo
(protocolo del proyecto), y de paso se corrigió la herramienta de verificación misma:
no estaba resolviendo el CSS que se inserta por interpolación (`${_cssSeguro(...)}`), así
que un bloque entero de estilos quedaba fuera de lo que en verdad se probaba.

---

## [Versión 17.22.0] — 2026-08-28 (Los chips de PyM vuelven a la tarjeta)

### ↩️ Reversión consciente de una decisión de agosto
Decisión firme del médico (entrevista de la noche del 28-ago): en agosto se pidió que el
panel quedara "solamente para ver la agenda", sacando de la tarjeta los chips de
actividades de prevención pendientes (PyM). Anoche pidió que vuelvan — no fue un olvido,
es una reversión consciente. La tarjeta vuelve a mostrar, para cada paciente, qué
actividades de PyM tiene pendientes (tamizajes, controles), hasta 3 a la vez; si hay más,
un chip "+N más" resume el resto sin perder el detalle (queda completo al pasar el
mouse). Si el paciente solo tiene pendiente una remisión de Optometría/Odontología (que
no se ordenan desde este panel), se avisa aparte en vez de desaparecer en silencio. Y
cuando no hay nada pendiente, la tarjeta dice honestamente por qué: al día de verdad, sin
lista de PyM cargada todavía, o sin que la cédula cruce con la base — nunca "al día"
como frase de relleno cuando en realidad no se pudo comprobar.

Un punto se queda para que el médico lo confirme: pidió "etiquetas abreviadas", pero el
propio historial de este archivo documenta un reporte real de consultorio (v12.4.0) donde
truncar el texto de los chips salió mal y se corrigió a propósito para que siempre se vea
completo. Se optó por el tope de 3 chips (que sí cumple "no ensanchar la tarjeta") en vez
de inventar una tabla de abreviaturas clínicas sin una fuente real que la respalde.

---

## [Versión 17.21.0] — 2026-08-28 (El reloj de cabecera dice qué tan seguido está mirando)

### 👁️ La cadencia de sondeo ahora es visible, sin volverse un control manual
Decisión del médico: el "Refresco" se retiró como ajuste editable (ya era automático y
adaptativo — entre 5 y 30 segundos según qué tan cerca esté una cita del momento crítico —
y un número fijo solo lo habría desconfigurado). Pero pidió poder VER qué está haciendo en
cada momento. El tooltip del reloj de la cabecera ahora dice, además de si los datos están
al día, cada cuántos segundos está sondeando la agenda ahora mismo.

---

## [Versión 17.20.0] — 2026-08-28 (Limpieza: cuatro ajustes que ya no hacían nada)

### 🧹 Sin ningún cambio de comportamiento clínico
Decisión del médico (entrevista de la noche del 28-ago): retirar cuatro ajustes internos
confirmados 100 % muertos — `tolerancia`, `labsVencidos`, `avisoPymModal` y `bannerPym` —
ninguno lo leía ya ningún código activo (el tiempo de gracia real, por ejemplo, siempre
estuvo fijo en 6 minutos, sin importar lo que dijera el ajuste `tolerancia`). Se retiró
también, junto con ellos, la migración de una sola vez que los apagaba en instalaciones
antiguas (ya había corrido hace docenas de versiones en todo equipo real). Y se retiró la
etiqueta "(en pruebas)" del interruptor de avisos de seguridad farmacológica, ahora que el
bloque se pinta de verdad en el Panel del paciente y en Laboratorios.

---

## [Versión 17.19.0] — 2026-08-28 (Silenciar 15 min ahora sí silencia todo)

### 🔇 "Silenciar 15 min" pasa a callar el toast y la notificación de Windows, no solo el tono
Decisión del médico (entrevista de la noche del 28-ago): antes, silenciar solo apagaba el
tono — el aviso dentro de la página y la notificación de Windows seguían saliendo igual, y
eso es justo el ruido que pidió reducir ("mejor dejarlo lo más minimalista posible"). Ahora
los tres canales obedecen el silencio temporal. El hecho se sigue contando y quedando
registrado exactamente igual — nada de esto toca la auditoría ni el panel del asistente —
solo se calla el ruido hacia afuera.

De paso se cerró una brecha real entre lo que el código decía y lo que hacía: el
comentario de "Silencio temporal" ya prometía desde hace tiempo que callaba "sonido,
ventana y cartel", pero el cartel nunca miró si estaba silenciado.

### 🔍 Investigación: notificaciones que se repiten
El médico también reportó que el toast de confirmación/inasistencia y el aviso de fraude
se le repetían, con sonido, para hechos que ya habían aparecido. Se revisó a fondo toda la
cadena de deduplicación existente (`state.notified`, `state.contadas`/`bumpStatCita`,
`state.alertedFraud`, la siembra compartida entre pestañas) — es una cadena que ya
absorbió varios reportes reales anteriores (v12.4.0, v14.1.5, v16.2.4, v17.1.0, v17.6.21,
v17.6.52, v17.6.74) y no se encontró, con el tiempo disponible esta noche, ninguna vía
nueva y reproducible de duplicado que esa cadena no cubra ya. No se inventa una causa sin
evidencia: queda documentado como investigación abierta, y el arreglo de esta versión
(silencio real de verdad) atiende directamente la parte del reporte que sí se pudo
confirmar y corregir.

---

## [Versión 17.18.0] — 2026-08-28 (Qué ordenar en el próximo control, junto al botón de Everest)

### ✨ Nuevo: widget de "qué ordenar" dentro de Conducta
Pedido del médico: en vez de tener que abrir el Panel del paciente para ver qué exámenes
hacen falta para el próximo control, ahora una pastilla flotante junto al botón de
"Paquetes" de Everest (dentro de Conducta) lo muestra directamente — 🧪 con el número de
pendientes, en ámbar si hay algo por ordenar y en verde si el paciente está al día. Un
clic la despliega con el detalle (nombre del examen y qué le pasa a cada uno).

No inventa ningún dato nuevo: usa exactamente el mismo cálculo que ya usa el Panel del
paciente, así que las dos vistas nunca pueden decir cosas distintas. Tampoco toca nada
dentro de Conducta — solo lee, nunca escribe ni simula clics (la misma disciplina que ya
se estableció en v15.3.0 para esa pestaña). Viene **apagado de fábrica**: se enciende
desde Ajustes → "Aviso de exámenes en Conducta (en pruebas)".

Si Everest no tiene el botón "Paquetes" visible en ese momento (otra sub-pantalla, u otra
versión del formulario), el widget simplemente no aparece — nunca flota en una posición
inventada. Y nunca arrastra el juicio de un paciente a la pantalla del siguiente: cambiar
de historia clínica reinicia el widget por completo.

---

## [Versión 17.17.0] — 2026-08-28 (El vigilante de la agenda ya no acusa a quien llegó a tiempo)

### 🐛 Falso positivo de fraude cuando se usan varias pestañas de Citas del día
Reporte en vivo: el asistente avisaba, algunas veces, que un paciente había llegado tarde
cuando en realidad había llegado puntual — no una demora, una acusación equivocada. Causa
real: cuando se tienen varias pestañas de Citas del día abiertas (algo rutinario para
usted y sus colegas) y una pestaña en segundo plano toma el mando de la vigilancia justo
al volver a mirarla, su primera lectura puede venir de una copia de la pantalla que quedó
atrás mientras estaba oculta. Si esa copia todavía decía "Sin presentarse" y ya había
pasado el tiempo de gracia, el asistente lo tomaba por cierto y marcaba fraude — una marca
que después se comparte con todas sus pestañas.

Ahora, justo después de tomar el mando de una pestaña que estaba oculta, el asistente
espera unos segundos antes de poder ACUSAR de fraude (nunca antes de pintar el color que
corresponde ni de mostrar la hora exacta — eso no cambia). Si en esos segundos la lectura
resulta estar atrasada, queda igual anotada en la bitácora para que usted la revise, pero
no se convierte en una acusación. Pasada esa breve espera, o si nunca hubo relevo de por
medio (por ejemplo con una sola pestaña abierta), el asistente sigue marcando el fraude
real exactamente igual que antes — esto no debilita ni retrasa la detección de una
inasistencia genuina.

Nada de esto necesitó tocar ninguna fecha, ningún cálculo de vigencia ni el mecanismo que
permite trabajar con varias pestañas de Everest a la vez (eso ya funcionaba y sigue igual).

---

## [Versión 17.16.1] — 2026-08-27 (El banco de pruebas deja de mentir sobre sí mismo)

### 🧪 El informe de cobertura subestimaba lo que sí estaba probado — y ocultaba lo que no
Sin ningún cambio de comportamiento clínico. El banco de pruebas llevaba dos listas
desactualizadas: 13 funciones que una suite decía cubrir y ninguna prueba llegaba a
ejercitar de verdad, y 107 «sin cubrir» de las cuales 16 sí se ejercitaban y solo faltaban
en su declaración — entre ellas seis de la barrera que impide que el nombre y la cédula
del paciente lleguen a la IA. Declarada la verdad, la cobertura subió de 88,3 % a 90,1 %
sin escribir una sola prueba nueva. Después se escribieron 13 pruebas para lo que de
verdad faltaba: el núcleo de esa barrera de privacidad (que no tenía una sola prueba
directa), el umbral con que se declara una falla terapéutica, la pieza que evita que la
nota hable de un riesgo cardiovascular que nunca se calculó, y la red de seguridad del
botón Deshacer. Cobertura final: 91,4 %.

---

## [Versión 17.16.0] — 2026-08-27 (Tanda 4 de la auditoría: tres mensajes que afirmaban sin haber comprobado nada)

### 🐛 «No hay actividades pendientes para este paciente» a veces significaba «no miré ninguna lista»
El módulo de Órdenes decía esa misma frase en tres situaciones distintas: cuando de
verdad no tenía pendientes, cuando el paciente no aparecía en la lista de prevención del
día, y cuando esa lista sencillamente no se había cargado. En el tercer caso la frase era
falsa. Ahora dice cuál de las tres es, y en el caso de duda no afirma nada sobre el
paciente.

### 🐛 El reloj del turno decía "Datos al día" antes de haber leído nada
Al arrancar la sesión, con la agenda todavía sin leerse una sola vez, el reloj de cabecera
igual afirmaba que los datos estaban al día. Ahora dice que todavía no ha leído nada.

### 🐛 El cruce con Athenea contra exámenes repetidos fallaba en silencio
Si el portal de Athenea no respondía al comprobar si un examen de prevención ya se había
hecho, la lista de órdenes seguía viéndose exactamente igual que cuando sí se pudo
comprobar — sin ningún aviso de que la comprobación había fallado. Es la misma causa
detrás del reporte «me sale que hay que enviarle un examen que ya se realizó» (v17.6.99).
Ahora se avisa cuando la comprobación no se pudo hacer.

---

## [Versión 17.15.0] — 2026-08-27 (La consola deja de sepultarse sola, y el panel de salud aprende a ver lo que falla)

### 🐛 Con Everest caído, una sola tarjeta rozada por el cursor disparaba 16 peticiones y 8 avisos de error
Reportado en consulta: la consola quedaba enterrada bajo una pared de errores de red. La
causa era una optimización que se adelanta a buscar los datos de un paciente cuando el
cursor se detiene sobre su tarjeta — útil cuando todo funciona, pero que insistía igual de
fuerte que una acción real cuando los servicios estaban caídos. Ahora esa anticipación
hace un solo intento y no llena la consola de avisos; después de tres fallos seguidos deja
de intentarlo durante 5 minutos. Lo que usted pide con un clic se sigue intentando
siempre, sin excepción.

### ✨ "Estado del asistente" ahora vigila también los servicios de Everest
El panel de salud tenía cuatro indicadores (agenda, historia, laboratorios, prevención) y
ninguno reflejaba si buscar un paciente o agendar una cita estaba fallando: esos cuatro
indicadores se alimentan de la lectura de la pantalla, que sigue funcionando aunque los
servicios estén caídos. Se agrega un quinto indicador que sí lo refleja.

---

## [Versión 17.14.1] — 2026-08-27 (Limpieza de datos de pacientes en archivos internos, y la mamografía se guía por la lista de la sede)

### 🔒 Datos de pacientes reales en archivos internos del proyecto, reemplazados
Una revisión encontró nombre, cédula, dirección, celular, correo y fecha de nacimiento de
pacientes reales en archivos de trabajo interno del proyecto (capturas de red guardadas
para depurar la integración con Everest). Se reemplazaron por datos inventados que
conservan el mismo formato, y se añadió una verificación automática para que esto no
vuelva a pasar sin que el banco de pruebas lo note.

### 🐛 La mamografía ahora se guía por la lista de prevención de la sede, no por Athenea
Para la tamización de cáncer de mama, la lista de prevención de la sede (el archivo de
SharePoint) pasa a mandar sobre lo que Athenea reporte: si la lista dice que está
pendiente, se ofrece, así Athenea tenga un resultado antiguo. El resultado de Athenea se
sigue mostrando con su fecha, para que usted lo tenga presente.

---

## [Versión 17.14.0] — 2026-08-27 (Tres avisos de seguridad que existían y no llegaban a leerse)

### 🐛 El aviso "cifras sin respaldo" en las notas de la IA quedaba fuera de la vista
El aviso que le dice que la IA pudo haber inventado una cifra se pintaba después del
borrador completo de la nota — en una nota larga, se podía leer y firmar sin haberlo visto
nunca. Ahora se pinta antes del texto.

### 🐛 Un aviso importante de la barra de estado se cortaba a la mitad
La barra de estado corta el texto largo con puntos suspensivos. Cuando el aviso llevaba la
instrucción de qué hacer al final de la frase ("clic en el candado... y recargue"), esa
parte era justo la que desaparecía. Ahora los avisos de advertencia o error pueden
extenderse hasta 3 líneas en vez de cortarse.

### 🐛 En el cuadro de confirmación de datos, un aviso importante se veía igual que uno rutinario
Cuando algo que usted ya había confirmado antes deja de coincidir con lo que dice la
historia hoy, el cuadro lo avisaba con la misma letra y el mismo color gris que cualquier
otra nota. Ahora ese aviso tiene su propio color y va arriba del todo.

---

## [Versión 17.13.0] — 2026-08-27 (Los prompts de redacción aprenden a usar todo el contexto que ya reciben)

### 🐛 La IA no sabía qué hacer con la mayor parte de la información que se le enviaba
Desde varias versiones atrás la información que se le manda a la IA para redactar creció
mucho — examen físico, uroanálisis, síndrome metabólico, el plan de exámenes con sus
fechas, y toda la historia clínica que Everest guarda — pero las instrucciones que recibe
la IA nunca mencionaban buena parte de ese contenido nuevo. Ahora se le dice explícitamente
qué fuentes recibe y en qué orden mandan si se contradicen (lo que usted anota en el
momento manda sobre todo lo demás), que un campo marcado como "no" es un dato tan válido
como uno marcado "sí", y que términos internos del programa (los nombres técnicos que usa
el motor de cálculo para organizarse) nunca deben aparecer en lo que se redacta.

### ✨ El texto que usted ya escribió se puede reescribir mejorado, sin perder ningún dato suyo
Antes la IA solo leía lo que usted ya había escrito, sin tocarlo. Ahora puede ofrecerle una
versión reescrita según la Resolución 1995 de 1999 y la semiología clínica — conservando
cada dato que usted anotó y sin alterar ninguna cifra suya. Sigue siendo un borrador: su
casilla nunca se sobrescribe sin que usted lo confirme primero.

---

## [Versión 17.12.0] — 2026-08-27 (Se escucha lo que Everest carga, y el bloque de avisos de fármacos deja de perderse)

### 🐛 La lectura en tiempo real de la historia no siempre reaccionaba a un cambio de paciente
La lectura en tiempo real de lo que usted escribe en la historia (v17.10.0) solo se
actualizaba al detectar que se GUARDÓ algo; si Everest cargaba la historia de otro paciente
sin recargar la página completa, el asistente seguía mostrando lo que había leído del
paciente anterior. Ahora también reacciona a la carga de una historia nueva.

### 🐛 El bloque de avisos sobre medicamentos podía desaparecer del todo
Un error al construir el bloque de avisos farmacológicos podía dejar la sección entera en
blanco en vez de mostrar los avisos que sí se pudieron calcular.

---

## [Versión 17.11.0] — 2026-08-27 (Tanda 2 de la auditoría: el color vuelve a significar algo)

### 🎨 Un aviso desconocido se pintaba con el color menos grave, no con el más grave
Cuando varios avisos de distinta gravedad coincidían sobre el mismo dato, el color que se
mostraba no siempre era el del más grave — en algún caso, un color no reconocido se trataba
como el menos urgente. Ahora, ante la duda, gana el color más grave.

### 🐛 Una corrida de órdenes a medias no se distinguía de una completa
Cuando algunas órdenes de un lote se generaban y otras fallaban, el aviso de éxito se veía
exactamente igual que cuando todo salía bien. Ahora las corridas parciales se marcan en
ámbar.

---

## [Versión 17.10.0] — 2026-08-27 (La historia se lee mientras se escribe, no al guardarla)

### ✨ La IA recibe la historia clínica en tiempo real, casilla por casilla, sin esperar a que se guarde
La versión anterior (v17.9.0) leía la historia completa, pero solo al momento de guardarla
— es decir, después de que ya se redactó la nota. Usted lo señaló: para redactar en tiempo
real hace falta que el contexto esté disponible ANTES de guardar. Los nombres internos de
las casillas de Everest coinciden con los nombres que se usan al guardar, así que ahora se
va acumulando lo que usted marca y escribe, casilla por casilla, a medida que avanza por
las pestañas de la historia — sin esperar al final de la consulta.

---

## [Versión 17.9.0] — 2026-08-27 (La IA recibe todo lo que Everest guarda de la historia clínica)

### ✨ El contexto que recibe la IA para redactar se multiplica: de 25 casillas a toda la historia
Hasta ahora la IA solo veía 25 casillas puntuales de la pantalla que estuviera abierta.
Ahora recibe las mismas secciones completas que Everest guarda al cerrar la historia: 109
antecedentes patológicos, examen físico, hábitos, antecedentes familiares, revisión por
sistemas, diagnósticos y el texto libre de la consulta — con la misma barrera de privacidad
de siempre: los datos de identificación del paciente (nombre, cédula, celular, dirección)
nunca se leen, bajo ninguna circunstancia. Esta versión quedó superada un día después por
la v17.10.0, que hace lo mismo sin esperar a que usted guarde la historia.

---

## [Versión 17.8.2] — 2026-08-27 (Reportado en consulta: Auto-Labs escribía un uroanálisis viejo sobre uno alterado)

### 🐛 Auto-Labs podía escribir "NORMAL" sobre un uroanálisis con alteraciones reales
Reportado en consulta, por segunda vez: "el botón Auto-Labs no está teniendo en cuenta el
último uroanálisis realizado". La causa: cuando Athenea trae dos versiones del mismo
uroanálisis (una fila resumida antigua y el detalle completo más reciente), el asistente
prefería siempre la fila resumida sin mirar cuál era más nueva. Podía terminar escribiendo
"NORMAL", con la fecha de meses atrás, sobre un resultado con alteraciones reales y mucho
más reciente. Ahora gana el resultado más nuevo.

---

## [Versión 17.8.1] — 2026-08-27 (Tanda 1 de la auditoría: nueve mensajes que afirmaban sin haber comprobado nada)

### 🐛 Varios avisos presentaban un fallo del sistema como si fuera un hecho del paciente
Nueve mensajes distintos caían en el mismo error: cuando el asistente no podía comprobar
algo (el portal de laboratorios estaba caído, faltaba un dato para evaluar, no se había
podido leer la agenda), el mensaje afirmaba una conclusión sobre el paciente como si sí se
hubiera comprobado. Ejemplos corregidos: "el paciente está al día con su programa" cuando
en realidad no había ningún programa que evaluar; "no se encontraron paraclínicos para
este paciente" cuando el portal de Athenea estaba caído; "falta peso" cuando lo que
faltaba era la creatinina, con el peso ya escrito dos líneas más arriba; una presión
arterial mostrada como "165/NaN" o "165/0", cifras imposibles. Cada uno ahora dice
exactamente qué no se pudo comprobar, en vez de suponer un resultado tranquilizador.

---

## [Versión 17.8.0] — 2026-08-27 (Arranca la auditoría de experiencia: tres reglas que dejan de depender de la memoria)

### 🎨 Dos avisos informativos se pintaban en rojo de alarma, sin serlo
Dos indicadores puramente informativos ("agenda pendiente de completar" y "candidato
adicional para un cupo") heredaban por accidente el mismo rojo intenso reservado para las
alarmas reales, porque nunca se les había declarado un color propio. Se corrige a ámbar y
azul respectivamente. Gastar el color de alarma donde no hay alarma le resta fuerza a las
alarmas reales.

### 🐛 74 avisos en ventanas emergentes podían perder su color frente al estilo propio de Everest
Los recuadros que se abren sobre la pantalla de Everest (confirmaciones, avisos de
laboratorio, el módulo de órdenes) no heredan protección visual del resto del programa: si
el estilo propio de Everest cambia, un color sin la protección adecuada puede desaparecer
sin que nadie lo note en el momento. Se blindan 74 declaraciones de color, incluida la
advertencia que impide ordenar una citología a un paciente hombre.

### 🐛 La hoja educativa que se le entrega al paciente mostraba nombres técnicos de laboratorio
El papel que el paciente se lleva a su casa mostraba nombres internos como
"COLESTEROL_LDL" o "UROANALISIS" en vez de "Colesterol LDL" o "Uroanálisis". Corregido.

---

## [Versión 17.7.5] — 2026-08-27 (Cierra la fidelidad del motor de riesgo cardiovascular al modelo aprobado)

### 🐛 El examen de albúmina/creatinina en orina (RAC) podía obligar a un segundo viaje al laboratorio
Cuando la vigilancia estrecha de la función renal estaba activa, el examen RAC quedaba
fuera del grupo de exámenes que se agrupan en la misma toma, aunque su vencimiento cayera
dentro de la misma ventana que el resto — obligando a un viaje adicional solo por ese
examen. Medido sobre planes reales de pacientes: 72 de cada 2.016 casos hacían ese viaje de
más. Corregido sin mover ninguna fecha ya calculada.

---

## [Versión 17.7.3–17.7.4] — 2026-08-27 (Por qué faltaba la creatinina en el historial de agosto)

### 🐛 Dos exámenes de sangre desaparecían de la tabla por tener la palabra "orina" en su nombre
Reportado en consulta: faltaba una creatinina tomada en agosto. Causa real, encontrada con
un diagnóstico que usted mismo corrió en la consola: Athenea nombra algunos exámenes de
SANGRE con la palabra "orina" dentro de su propio nombre de laboratorio — por ejemplo
"CREATININA EN SUERO. ORINA U OTROS" o uno que dice literalmente "GLUCOSA... DIFERENTE A
ORINA". El asistente los clasificaba como exámenes de orina por esa sola palabra suelta, y
desaparecían de la tabla de laboratorios crónicos. Es especialmente grave con la
creatinina, porque de ella depende el cálculo del estadio de la función renal y las fechas
de control. Ahora, si el nombre completo declara que la muestra es "en suero", "sérica" o
"en sangre", esa declaración manda sobre la palabra "orina" suelta en el resto del nombre.
De paso, la hoja de datos que recibe la IA para redactar se completa con el examen físico
entero, el uroanálisis y el síndrome metabólico, que hasta ahora no viajaban.

---

## [Versión 17.7.2] — 2026-08-27 (Corrección de comentarios internos: el código dejaba de contradecirse a sí mismo)

### 🧹 Comentarios y documentación interna corregidos, sin cambios de comportamiento
Tres comentarios del código describían un comportamiento distinto al que el propio código
tenía desde hacía versiones (un plazo, un rango de estadios renales, una decisión ya
tomada). Se corrigen los comentarios para que coincidan con lo que el programa realmente
hace. Ninguna fecha ni ningún cálculo cambia.

---

## [Versión 17.7.1] — 2026-08-27 (Reportado en consulta: la tabla de laboratorios no avisaba cuando venía incompleta)

### 🐛 Una lectura parcial de Athenea se veía exactamente igual que una completa
Reportado en consulta: faltaba un resultado de laboratorio de una toma de agosto. La
investigación encontró que la tabla de laboratorios ya sabía, internamente, cuándo Athenea
no había devuelto todas las solicitudes de un paciente o cuándo se ocultaban resultados por
tener más de un año — pero nunca se lo decía al médico. Con los dos casos callados, una
lectura a medias se veía igual que una completa, y en consulta eso no se lee como "faltó
una solicitud": se lee como "no se lo hicieron". Se agregan los avisos correspondientes.

---

## [Versión 17.7.0] — 2026-08-27 (Reportado en consulta: el cuadro de confirmación de datos no recibía los cambios en tiempo real)

### 🐛 El cuadro "Las fuentes no coinciden" mostraba una foto vieja de la historia
Reportado en consulta: el cuadro de confirmación de datos decía que la hipertensión estaba
marcada como "No" cuando usted ya la había marcado como "Sí" hacía un momento. El cuadro
tenía razón sobre lo que había leído, pero lo había leído solo una vez, al abrir el Panel
del paciente, y nunca volvía a mirar la pantalla. Ahora se revisa cada 20 segundos: si la
historia ya aclaró la duda, el cuadro se cierra solo; si el dato sigue distinto, actualiza
el texto sin borrar lo que usted ya hubiera respondido en los demás campos.

---

## [Versión 17.6.99] — 2026-08-27 (Reportado en consulta: un examen ya realizado se seguía ofreciendo para ordenar)

### 🐛 5 de los 8 paquetes de prevención nunca se comparaban contra los resultados reales en Athenea
Reportado en consulta: el antígeno prostático (PSA) aparecía hecho en Athenea seis días
antes, y el módulo de órdenes lo seguía ofreciendo premarcado para pedirlo de nuevo. La
causa: cinco de los ocho paquetes de prevención (PSA, mamografía, citología, tamización
cardiometabólica y hemoglobina) no tenían definida una vigencia, y sin ese dato el
asistente nunca llegaba a comprobar contra Athenea si ya se habían hecho. Se confirmó la
vigencia del PSA en 2 años y se separó la pregunta "¿ya está hecho?" de "¿sigue vigente?",
para que un paquete sin vigencia confirmada al menos avise que ya se hizo, aunque no pueda
decir si conviene repetirlo.

---

## [Versión 17.6.98] — 2026-08-27 (El agujero negro renal ahora agrupa los exámenes de verdad)

### 🐛 La agrupación de exámenes por vigilancia renal estrecha no estaba ocurriendo de verdad
El mecanismo que evita que un paciente con enfermedad renal avanzada haga dos viajes al
laboratorio (uno por la creatinina y otro por el resto de sus exámenes) calculaba bien la
fecha, pero no siempre lograba juntar los exámenes en esa misma fecha. Medido sobre 240
planes reales: 26 exigían un segundo viaje. Corregido a 0, sin mover ninguna fecha ya
calculada para el resto de los pacientes.

---

## [Versión 17.6.97] — 2026-08-27 (La circunferencia abdominal se leía como cadera, y no se podía leer por su identificador)

### 🐛 La casilla de "cintura" apuntaba en realidad a la de "cadera"
Confirmado por usted al revisar su propia pantalla: "circunferencia abdominal" es cintura,
y "cintura pélvica" en Everest es cadera. La función que leía este dato apuntaba a la
casilla equivocada. No llegó a afectar ningún cálculo real porque la función todavía no
tenía ningún uso activo. Se corrige antes de conectarla a nada, junto con la forma de
localizar esa casilla en la pantalla (varias comparten el mismo identificador interno, así
que solo se puede ubicar por su rótulo visible).

---

## [Versión 17.6.96] — 2026-08-27 (El paquete de exámenes cardiovasculares no veía una HbA1c vencida hace más de 200 días)

### 🐛 Un paquete de prevención se marcaba "ya cubierto" con una hemoglobina glicosilada vencida
El paquete de exámenes cardiovasculares (que incluye la hemoglobina glicosilada para
pacientes diabéticos) comparaba contra Athenea usando una lista de analitos que no incluía
ese examen. Un paciente diabético con todos sus demás exámenes frescos, pero con una
hemoglobina glicosilada de 11,2 % tomada hace más de 7 meses, aparecía como "ya cubierto,
no hace falta pedir nada". Corregido.

---

## [Versión 17.6.95] — 2026-08-27 (Una sola tabla de vigencias — la enfermedad renal en estadio 5 tenía plazos demasiado largos)

### 🐛 Convivían dos tablas de vigencias de laboratorio, y la vieja daba plazos más largos de lo debido
El aviso de entrada a la historia y la comprobación de "ya está cubierto" usaban una tabla
de vigencias distinta a la que usa el resto del programa. En 8 de 48 combinaciones posibles
la diferencia era real, y siempre en la misma dirección: la tabla vieja daba MÁS días de
vigencia de los que corresponden — hasta el triple, en pacientes con enfermedad renal en su
estadio más avanzado. Se unifica en una sola tabla en todo el programa.

---

## [Versión 17.6.94] — 2026-08-27 (El paciente diabético clasificaba siempre como riesgo alto, incluso sin dato suficiente)

### 🐛 Un piso de seguridad se aplicaba siempre, tapando la falta de un dato real
Todo paciente diabético clasificaba automáticamente como mínimo "riesgo alto", sin importar
el resto de sus datos. La intención original era de seguridad, pero en realidad tapaba que
nadie estaba registrando desde cuándo el paciente es diabético — un dato que si se
conociera podría, según la norma, bajar la categoría. Ahora ese piso solo se aplica cuando
el dato de verdad falta (y lo dice, pidiéndolo), y se agregó una casilla nueva en el Panel
para registrar los años de evolución de la diabetes.

### ✨ Nueva casilla: años de evolución de la diabetes
Everest no tiene un campo para este dato. Se agrega en la sección de Riesgo y función
renal del Panel del paciente, y con él la clasificación de riesgo cardiovascular puede
calcularse según la norma en vez de recurrir siempre al piso de seguridad.

---

## [Versión 17.6.93] — 2026-08-27 (El grupo de sábados del médico vuelve, pero solo cuando se puede confiar en la deducción)

### 🐛 La deducción del grupo de sábados de un médico podía tacharle sábados en los que sí trabaja
Al reactivarse el cálculo de a qué grupo de sábados pertenece un médico (1-3 o 2-4), se
midió contra la agenda real de consulta antes de aplicarlo: en varios casos la deducción
entraba en conflicto con sábados donde el médico sí tenía agenda propia. Ahora el grupo
solo se usa cuando la deducción es clara y consistente; ante cualquier duda, se prefiere
ofrecer un sábado de más (que usted descarta con un vistazo) a esconderle uno donde sí
puede atender.

---

## [Versión 17.6.92] — 2026-08-27 (El síndrome metabólico se calculaba pero nunca contaba para nada)

### 🐛 Un criterio completo de riesgo cardiovascular estaba desconectado del cálculo final
El síndrome metabólico —uno de los factores de riesgo mayores del consenso de riesgo
cardiovascular— se calculaba correctamente en el código, pero el resultado nunca llegaba a
sumar en la clasificación final del paciente. Un paciente con hipertensión, sedentarismo,
triglicéridos y glicemia alterados, y colesterol HDL bajo, clasificaba como riesgo BAJO
cuando le correspondía ALTO. Se conecta el cálculo a la clasificación final.

---

## [Versión 17.6.91] — 2026-08-27 (La bacteriuria en el embarazo no disparaba la pregunta que la norma exige)

### 🐛 Una gestante con bacteriuria no recibía la pregunta obligatoria sobre su embarazo
La norma exige tratar siempre la bacteriuria en el embarazo, incluso sin síntomas, por el
riesgo de parto prematuro. El asistente ya sabía aplicar esa excepción, pero la pregunta
que confirma si la paciente está embarazada solo se disparaba cuando el uroanálisis era
"sugestivo" de infección — y una bacteriuria franca sin otros signos no siempre calificaba
como sugestiva. Corregido para que la pregunta se dispare en el mismo caso que la propia
regla clínica evalúa.

---

## [Versión 17.6.90] — 2026-08-26 (El aviso de agrupación renal afirmaba algo que no estaba ocurriendo)

### 🐛 El recuadro decía "todo se agrupa en la fecha de la creatinina" cuando en realidad no se agrupaba
El aviso de vigilancia renal estrecha se mostraba siempre que esa vigilancia estuviera
activa, afirmando que todos los exámenes se agrupaban en la fecha de la creatinina — pero
eso solo es cierto cuando la creatinina es el examen que vence primero. Si otro examen
vencía antes, la creatinina en realidad quedaba diferida para una toma posterior, y el
aviso seguía prometiendo una agrupación que no iba a pasar. Corregido para describir lo que
de verdad ocurre en cada caso.

---

## [Versión 17.6.89] — 2026-08-26 (El resumen para la IA afirmaba "datos completos" con la clasificación de riesgo sin hacer)

### 🐛 Tres campos del resumen que recibe la IA quedaban vacíos o incorrectos en todo paciente
El campo que debía decir el estado de la clasificación de riesgo cardiovascular estaba
apuntando a un nombre de dato que ya no existía en el programa, así que salía vacío
siempre — incluso en un paciente perfectamente clasificado. Y el campo "datos completos"
solo miraba la función renal, nunca si el riesgo cardiovascular se pudo calcular. La IA
podía redactar como si la clasificación estuviera resuelta cuando en realidad seguía
pendiente por falta de un dato.

---

## [Versión 17.6.88] — 2026-08-26 (El urocultivo que el motor ya decidía pedir no llegaba a la IA)

### 🐛 La orden de urocultivo, ya calculada, no viajaba al resumen que redacta la nota
Cuando el uroanálisis sugería infección urinaria, el asistente ya sabía que correspondía
pedir un urocultivo con antibiograma — se veía en pantalla, dentro del texto de conducta.
Pero ese dato no viajaba de forma explícita al resumen que usa la IA para redactar, así que
la IA tenía que adivinar si mencionarlo o no. Ahora viaja como un dato propio.

---

## [Versión 17.6.87] — 2026-08-26 ("Nunca se le ha tomado" se decía de un examen que sí tenía resultado)

### 🐛 Un resultado sin fecha se presentaba como si el examen nunca se hubiera hecho
Cuando un resultado de laboratorio llegaba desde Athenea sin fecha asociada, el asistente
lo trataba igual que un examen que jamás se ha realizado — mostrando "Nunca se le ha
tomado" y volviendo a ordenarlo, en vez de mostrar el valor (que puede ser alarmante) y
explicar por qué, sin la fecha, no se puede confiar en su vigencia. Ahora se distinguen los
dos casos: sin fecha no es lo mismo que sin historial.

---

## [Versión 17.6.86] — 2026-08-26 (El aviso "dosis no especificada" desaparecía a los 20 segundos)

### 🐛 La advertencia de que falta la posología de un medicamento se apagaba sola
Cuando el resumen del paciente se recalculaba (por ejemplo, al escribir el peso en el
Panel), la marca que advierte que a un medicamento le falta su dosis y frecuencia se
perdía. La nota clínica quedaba entonces sin la frecuencia del medicamento Y sin el aviso
de que faltaba — sin que nadie lo notara. Corregido para que la marca sobreviva a
cualquier recálculo del resumen.

---

## [Versión 17.6.85] — 2026-08-26 (El sexo del paciente gana una segunda fuente de respaldo)

### 🐛 El sexo del paciente dependía de una sola fuente, sin respaldo
El sexo del paciente es un dato del que dependen directamente las fórmulas de función
renal (Cockcroft-Gault y CKD-EPI). A diferencia del peso y la presión arterial, que ya
tenían una fuente de respaldo si la primera fallaba, el sexo tenía una única fuente: si
esa ficha llegaba vacía, ambas fórmulas se calculaban como si el paciente fuera hombre. Se
agrega como respaldo la cabecera de la historia clínica, donde Everest ya imprime "Sexo:
FEMENINO" o "Sexo: MASCULINO" en todas las pestañas.

---

## [Versión 17.6.84] — 2026-08-26 (Tres decisiones suyas sobre los hallazgos de la auditoría del motor de riesgo)

### 🧠 Constancia médico-legal, piso de HbA1c en pacientes añosos, y un tercer criterio de falla terapéutica
Tres respuestas suyas a hallazgos abiertos de la auditoría de fidelidad al modelo de
riesgo cardiovascular: la nota clínica deja de pedirle a la IA una constancia legal que
ningún dato del sistema puede respaldar todavía; se define un piso más flexible de
hemoglobina glicosilada para pacientes de edad avanzada; y se agrega un tercer eje de
falla terapéutica junto a los dos que ya existían.

---

## [Versión 17.6.83] — 2026-08-26 (Auditoría del motor de riesgo cardiovascular: el foco de la consulta ignoraba un examen renal vencido)

### 🐛 El "foco" que aparece en la nota clínica no consideraba un examen renal vencido y recategorizado
Un paciente con la relación albúmina/creatinina (RAC) vencida hace más de 4 meses, pero con
el resto de sus exámenes al día, no aparecía con foco renal en la nota clínica —el sistema
solo miraba un estado que ese examen ya había dejado de tener, tras haber sido
recategorizado como prioritario. La nota clínica declaraba entonces un foco distinto al
que de verdad correspondía atender primero.

---

## [Versión 17.6.82] — 2026-08-26 (El nombre del médico deja de desaparecer cuando Everest falla)

### 🐛 "Médico:" salía vacío cuando el servicio de identificación de Everest fallaba
Reportado en consulta: el nombre del médico desaparecía del panel y, sin él, el asistente
no podía encontrar los cupos de agenda propios. La causa no era un error del programa: el
servicio de Everest que confirma la identidad del médico había estado fallando durante toda
la sesión. Se agrega una memoria de 12 horas de la última identidad confirmada, para que
una caída pasajera de ese servicio no deje al médico sin su propio nombre durante el resto
del turno.

---

## [Versión 17.6.81] — 2026-08-26 (Cockcroft-Gault deja de mostrarse como si fuera CKD-EPI, y las notas largas entran a la rotación de modelos)

### 🐛 Sin el peso del paciente, se mostraba un cálculo de función renal con la etiqueta equivocada
Cuando faltaba el peso del paciente (necesario para el cálculo de Cockcroft-Gault), el
Panel mostraba igual una cifra bajo esa etiqueta — pero en realidad era el resultado del
otro método de cálculo (CKD-EPI), que no necesita el peso. Ahora avisa explícitamente que
falta el peso para calcular Cockcroft-Gault, en vez de mostrar el número equivocado bajo el
nombre equivocado.

### 🧠 Las notas largas (Enfermedad Actual y Análisis y Plan) entran a la rotación normal de modelos de IA
Reportado por usted repetidas veces: "sigue apareciendo el modelo más lento". Esas dos
casillas usaban siempre el modelo de IA más capaz, aparte de la rotación que evita agotar
la cuota diaria del resto de casillas — y ese modelo es también el más lento. Ahora entran
a la misma rotación que las demás.

---

## [Versión 17.6.80] — 2026-08-26 (La caja de advertencia por "cifras inventadas" marcaba dosis renales reales como sospechosas)

### 🐛 Un ajuste de dosis por función renal, calculado por el programa, se marcaba como posible invento de la IA
La advertencia que revisa si la IA inventó alguna cifra no sabía distinguir un ajuste de
dosis renal legítimo —calculado por el propio programa y que la IA solo tiene que citar—
de una cifra puesta por la IA sin respaldo. Cada ajuste de dosis real terminaba marcado
como sospechoso. Corregido.

---

## [Versión 17.6.79] — 2026-08-26 (Los botones para imprimir una orden ya no muestran un número interno sin sentido)

### 🐛 Con dos o más órdenes generadas a la vez, los botones para imprimirlas no decían cuál era cuál
Reportado en consulta: al generar varias órdenes de prevención de una vez (por ejemplo VIH
y PSA juntos), los botones para imprimir cada una decían solo "Orden 483920" — un número
interno que no permite saber cuál corresponde a cuál examen sin abrirlas primero. Ahora
cada botón muestra el nombre de la actividad.

---

## [Versión 17.6.78] — 2026-08-26 (Documentación de decisiones ya vigentes, sin cambios de comportamiento)

### 🧹 Se documentan divergencias ya vigentes y se investiga código sin uso real
Entrega puramente de documentación: se anotan junto al código las divergencias ya
vigentes respecto al modelo de riesgo cardiovascular de referencia, y se investigan ocho
funciones candidatas a no tener ningún uso real en producción — siete se confirman sin
llamador, y se dejan documentadas sin borrar (ninguna decisión de eliminarlas se ha
tomado todavía).

---

## [Versión 17.6.46] — 2026-08-26 (Fusión: se recuperan ~31 suites de prueba de `claude/v17-6-2-22ago`)

### 🧪 Recuperación de suites del Panel del paciente y del motor RCV/fármaco
- Se fusiona `origin/claude/v17-6-2-22ago` (v17.6.4b) sobre esta rama para recuperar suites de prueba que existían solo en aquella rama y cubren el Panel del paciente y el motor RCV/fármaco. En todo conflicto de código de producción gana la versión más reciente y auditada de esta rama (v17.6.45): ninguna decisión clínica vigente (piso diabético/edad ALTO, control +7d, FTL a día hábil anterior, techo de ventana Estado A=21 días, apnea del sueño nunca true, ERC como programa rector solo fuera de G1/G2) se pierde en la fusión.

---

## [Versión 17.6.45] — 2026-08-24 (Barrido S+ total — Auto-Labs ya no anuncia como escrito un resultado que el navegador rechazó)

### 🐛 Auto-Labs ya no cuenta como "resultado llevado" uno que el navegador rechazó en silencio
- Esta protección ya existía desde v16.7.0 (una casilla numérica puede rechazar un valor con coma decimal, quedando vacía sin avisar) pero solo se aplicaba en la ruta de los componentes del uroanálisis. El camino principal — la lista de 13 laboratorios crónicos, que es el grueso de lo que Auto-Labs escribe cada día — seguía sin esta comprobación: si el navegador rechazaba un valor, el asistente igual lo contaba como "resultado llevado" en el aviso verde, aunque la casilla hubiera quedado vacía. Se corrige tanto en el camino principal como en el reintento de las casillas de uroanálisis que a veces tardan en aparecer.

---

## [Versión 17.6.44] — 2026-08-24 (Barrido S+ total — la regla de triglicéridos altos para el LDL ya reconoce comas decimales y desigualdades)

### 🐛 La regla "triglicéridos muy altos" para elegir el LDL correcto ya reconoce el formato real de los informes
- Cuando el colesterol LDL viene reportado por partida doble (el valor medido directo y el calculado), el asistente decide cuál de los dos usar según los triglicéridos: si están muy altos, la fórmula que calcula el LDL deja de ser confiable y debe preferirse el valor medido directamente. Pero esa comparación leía el número de triglicéridos de forma cruda, sin manejar comas decimales ("436,2", el formato común de los informes) ni desigualdades ("> 400", cuando el laboratorio reporta un valor por fuera de su rango medible) — en esos formatos, la regla nunca se activaba, y silenciosamente se usaba siempre el LDL calculado, aunque no fuera el confiable en ese caso.

---

## [Versión 17.6.43] — 2026-08-24 (Barrido S+ total — un resultado de laboratorio en 0 ya no se muestra ni se procesa como "sin dato")

### 🐛 Un resultado de laboratorio en 0 ya no se confunde con "sin dato"
- En cuatro sitios del módulo de laboratorios, un resultado numérico real de 0 (por ejemplo, Hematíes=0 o Leucocitos=0 en un uroanálisis — un resultado negativo perfectamente normal) se procesaba como si no existiera ningún resultado, porque el código comparaba el valor con una condición que trata el número 0 igual que "no hay dato". Esto afectaba tanto la tabla del modal de Laboratorios (mostraba "—" en vez de "0") como el motor que detecta hallazgos de uroanálisis (un resultado negativo real podía perderse en silencio en vez de registrarse). Ahora los cuatro sitios distinguen correctamente "no hay resultado" de "el resultado es 0".

---

## [Versión 17.6.42] — 2026-08-24 (Barrido S+ total — el censor de nombres ahora sí cubre las MAYÚSCULAS SOSTENIDAS de Everest)

### 🐛 Un nombre escrito en mayúsculas sostenidas ya no sobrevivía al censor antes de llegar a la IA
- El texto libre que se envía a la IA pasa por un censor que tacha nombres propios, pero ese censor solo reconocía la forma "Mayúscula inicial + minúsculas" (ej. "Maria Rodriguez") — el estilo real con el que Everest guarda muchas casillas es MAYÚSCULAS SOSTENIDAS ("MARIA RODRIGUEZ"), donde un nombre y una palabra clínica cualquiera son indistinguibles por su forma. Esto ya estaba documentado en el propio código como una limitación conocida, pendiente de una solución de diseño: en vez de adivinar cuál palabra en mayúsculas es el nombre, ahora se le entrega al censor el nombre real del paciente que ya está abierto (que el asistente ya conoce, de la agenda del día) y lo tacha literalmente, en cualquier forma de mayúsculas, antes de que cualquier texto libre salga hacia el proveedor de IA.

---

## [Versión 17.6.41] — 2026-08-24 (Barrido S+ total — Bloque Editar: la franja de color de los avisos ya no queda invisible)

### 🐛 La franja de color de cada aviso emergente ya no era invisible
- Cada aviso emergente (toast) trae una franja de color a su izquierda para identificar de un vistazo si es rojo, verde, ámbar o azul — pero esa franja nunca tuvo ancho ni alto propios en el CSS, así que era invisible en la práctica. De paso se corrigieron dos declaraciones repetidas en el mismo aviso que se anulaban entre sí sin ningún efecto visible ni beneficio: un doble sombreado alrededor del ícono (el segundo pisaba el anillo de color del primero) y un tamaño de letra duplicado en el cuerpo del mensaje.

---

## [Versión 17.6.40] — 2026-08-24 (Barrido S+ total — Bloque Editar: el modo oculto ahora esconde todo, sin excepciones)

### 🐛 El modo oculto (privacidad de pantalla) ya escondía casi todo, ahora esconde todo
- El "modo oculto" (el botón que apaga de un vistazo toda la interfaz visible del Vigilante, por ejemplo si alguien más va a mirar la pantalla) dejaba 7 elementos visibles que se agregaron al script después de escribirse esa lista: la confirmación de dos pasos, la ventana de llenado automático, la barra minimizada, y los botones de deshacer y de inyección rápida del Redactor. Ahora los siete quedan cubiertos.

---

## [Versión 17.6.39] — 2026-08-24 (Barrido S+ total — Bloque Editar: la lista de prevención de hoy ya no se confunde con la de anoche)

### 🐛 Un archivo modificado anoche ya no se confunde con el de hoy
- Al buscar el archivo de la lista de prevención del día en SharePoint, cuando el nombre del archivo no traía la fecha, el asistente comparaba la hora de modificación (que SharePoint entrega en hora universal) contra la fecha del calendario local sin convertirla primero. En Colombia esto tenía un efecto concreto: un archivo modificado entre las 7 de la noche y la medianoche quedaba, al día siguiente, marcado por error como "el de hoy" — y el asistente dejaba de buscar el archivo real durante toda la jornada. Ahora ambas fechas se comparan en la misma hora local.

---

## [Versión 17.6.38] — 2026-08-24 (Barrido S+ total — Bloque Editar: "Generar" y "Generar todo" ya no pueden correr al mismo tiempo)

### 🐛 Ya no se pueden disparar dos generaciones a la vez
- "Generar todo" ya bloqueaba el botón "Generar" mientras trabajaba, pero "Generar" no hacía lo mismo con "Generar todo": si el médico alcanzaba a pulsar los dos casi al tiempo, las dos cadenas de generación corrían solapadas, y la que terminaba primero volvía a habilitar ambos botones a mitad del trabajo de la otra. Ahora "Generar" también bloquea "Generar todo" mientras está trabajando, cerrando el candado en los dos sentidos.

---

## [Versión 17.6.37] — 2026-08-24 (Barrido S+ total — Bloque Editar: un intento fallido de generar ya no pisa la casilla equivocada)

### 🐛 Un intento de generar que falla ya no pinta la casilla equivocada
- Si el médico cambiaba de casilla mientras "Generar" seguía trabajando en la anterior y ese intento terminaba fallando, el texto de respaldo (los hechos en bruto, para copiar a mano) se pintaba sobre la casilla NUEVA que el médico tenía abierta en ese momento, no sobre la que en verdad falló — y ese texto ajeno quedaba guardado como si fuera el borrador de la casilla nueva. Ahora el resultado de un intento fallido respeta la misma regla que ya protegía a un intento exitoso: solo se pinta en pantalla si la casilla que lo pidió sigue siendo la que está abierta.

---

## [Versión 17.6.36] — 2026-08-24 (Barrido S+ total — se identifica y corrige la causa raíz del aviso falso "hay borrador sin pegar")

### 🐛 El aviso "hay borradores sin insertar" ya no aparece después de haber insertado
- Esta es la causa raíz del primer reporte de esta auditoría: el asistente advertía "Hay borradores sin insertar en la historia" al cerrar el Redactor aunque el médico ya hubiera insertado los tres textos. Al insertar una casilla y avanzar automáticamente a la siguiente, el cambio de casilla activa borraba —sin querer— la marca de "ya insertado" que se acababa de fijar un instante antes, porque reconstruía el registro del borrador desde cero en vez de conservar sus datos. Ahora ese registro conserva todo lo que ya tenía al actualizarse.

---

## [Versión 17.6.35] — 2026-08-24 (Barrido S+ total — Bloque Editar: el contador del Redactor ya no se congela tras la primera generación)

### 🐛 El contador de palabras y caracteres del borrador ya no deja de actualizarse
- El Redactor de texto libre con IA llamaba a una función (`esc`) que no existe en ningún punto del script para mostrar el nombre del modelo usado junto al contador de palabras/caracteres. Desde la primera nota generada (en cuanto hay un modelo que mostrar), ese error quedaba silenciado y el contador dejaba de actualizarse para el resto de la sesión — el médico veía siempre el mismo número de palabras aunque siguiera editando. Corregido para usar la función correcta del proyecto.

---

## [Versión 17.6.34] — 2026-08-24 (Barrido S+ total — Bloque Editar: un error de la IA ya no llega en inglés al médico)

### 🐛 Un rechazo de la IA ya no se muestra en el idioma y jerga del proveedor
- Cuando Gemini rechazaba una petición del Redactor por un motivo que el script no reconocía como cuota agotada, saturación o modelo no disponible (los tres únicos que ya se traducían), el mensaje crudo de la API — en inglés, pensado para desarrolladores — se mostraba tal cual en el estado del panel y en los chips de "Generar todo". Ahora ese caso también muestra una instrucción clara en español; el detalle técnico se conserva solo en el registro de diagnóstico interno.

---

## [Versión 17.6.33] — 2026-08-24 (Barrido S+ total — Bloque Editar: el celular del paciente ya no queda completo en la consola)

### 🐛 El número de celular del paciente ya no se registra completo en la consola del navegador
- Los tres registros del flujo de envío de SMS (envío automático exitoso, envío automático fallido, reenvío manual) escribían el celular del paciente completo en la consola del navegador. El propósito con el que se agregaron —permitirle al médico comparar, de un vistazo, el número usado contra el que cree haber escrito— se mantiene intacto: ahora se registra enmascarado, mostrando solo los últimos dígitos.

---

## [Versión 17.6.32] — 2026-08-24 (Barrido S+ total — Bloque Editar: trato de usted, consistente en toda la interfaz)

### 🧹 Diez avisos que tuteaban al médico ahora tratan de usted, como el resto de la interfaz
- El aviso de actualización disponible, el recordatorio de auto-actualización lenta, el aviso de lista de prevención demasiado grande para guardar, la caída de descarga de SharePoint, los dos mensajes de "pruebe con .csv", la prueba de notificaciones de escritorio (dos avisos), el tooltip de la fuente de laboratorios y los dos avisos de nueva versión disponible en Ajustes tuteaban al médico ("Ya tienes", "Actívalo", "Ábrelo", "cierres") mientras el resto de la interfaz —incluida la notificación de PyM que sale en el mismo flujo— trata siempre de usted. Ahora los diez quedan en usted, sin excepciones.

---

## [Versión 17.6.31] — 2026-08-24 (Barrido S+ total — hallazgo colateral de v17.6.30: tildes en el cotejo de fuentes)

Al probar el fix de v17.6.30 apareció un segundo defecto en la misma función, distinto y
anterior en la cadena: se corrige aparte para no mezclar dos mutaciones en una versión.

### 🐛 Una frase con tilde ya no se descarta antes de ser leída
- El cotejo de discrepancias entre fuentes comparaba la palabra clave del hecho (ej. "diabet") contra la frase **con sus tildes originales** — "No es diabético" no calzaba porque la comparación esperaba la sílaba sin acento, y la frase quedaba fuera del análisis por completo, en vez de reconocerse como una negación. Cualquier mención de un hecho con tilde en la sílaba clave ("diabético" es el caso real observado; hipertensión y enfermedad renal ya estaban a salvo) quedaba invisible para este cotejo. Ahora la comparación ignora tildes igual que el resto de la lógica de la función, así que estas frases se reconocen correctamente.

---

## [Versión 17.6.30] — 2026-08-24 (Barrido S+ total — Bloque Editar, 1/62: negación simple en el cotejo de fuentes)

Primer avance del bloque "Editar" del barrido total.

### 🐛 Un "no fuma" en el texto libre ya no se interpreta como que SÍ fuma
- `mtrTextoOpinaSobre` (usado por el cotejo de discrepancias entre fuentes, `mtrDiscrepanciasDeFuentes`) solo reconocía negaciones largas (`niega`, `no refiere`, `sin antecedente`, `descarta`, `no presenta`, `no tiene`, `nunca ha`). Una negación corta y común en la redacción real ("no fuma", "no es diabético", "no consume alcohol") no calzaba con ninguna, así que la frase caía en la afirmación por defecto de la línea siguiente: el texto libre que NIEGA un hecho terminaba usándose como la fuente que lo AFIRMA. Se amplió la lista de negaciones reconocidas para cubrir el patrón "no + verbo" más frecuente, sin tocar el resto de la lógica (antecedentes familiares siguen sin veredicto, una afirmación limpia sigue ganando sobre cualquier negación previa).

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
