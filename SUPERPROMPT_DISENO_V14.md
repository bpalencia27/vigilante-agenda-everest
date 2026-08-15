# SUPER PROMPT — Refactorización global del diseño
## Vigilante de Agenda v14.0.0 · «El panel vigila, la historia clínica asiste»

> Documento de encargo. Lo ejecuta un agente de código (Jules) **una tarea por sesión**.
> El reparto está en **`JULES_TAREAS_DISENO_V14.md`**, en este mismo repo.
> Nada de lo que hay aquí se aprueba por «se ve bien»: todo se audita contra criterios
> escritos antes de empezar.

---

# 0-bis. MODO JULES — cómo se ejecuta esto

**Jules no es un orquestador: es UN agente asíncrono por tarea.** No le pegues este documento
entero esperando que lo ejecute todo — leería 600 líneas y haría *algo*. Cada tarea se abre así:

> «Lee `SUPERPROMPT_DISENO_V14.md` en la raíz del repo y ejecuta ÚNICAMENTE la tarea **TX**.»

### Reglas del entorno (léelas antes de tocar nada)

- **Rama base: `claude/pym-agenda-blindaje-v12-4`**, nunca `main`. El PR va contra esa rama.
- **El banco corre sin instalar nada:** `node tests/runner.js`. No hay `npm install`, no hay
  framework de pruebas. **No añadas ninguno.**
- **PROHIBIDO REFORMATEAR.** Nada de Prettier, ESLint `--fix`, reordenar funciones, cambiar
  comillas ni normalizar indentación. `vigilante_agenda.user.js` es un IIFE de ~11.500 líneas:
  un reformateo produce un diff imposible de revisar y **el PR se descarta entero**, aunque el
  cambio de fondo fuera correcto. Esto vale DOBLE en este encargo, porque un refactor de estilo
  tienta a «limpiar de paso».
- **Ni bundlers, ni TypeScript, ni dependencias, ni CSS-in-JS de librería.** El archivo se copia
  tal cual a un Gist y Tampermonkey lo ejecuta; cualquier paso de compilación lo rompe.
- **Ninguna petición real** a Everest, Athenea ni AppCita. Todo con mocks.
- **Diff mínimo.** Solo lo que pide la tarea.
- **Si Jules pide aprobar un plan**, ese plan debe incluir: (1) qué prueba nueva escribirá y
  (2) qué mutación aplicará para verificarla. Un plan sin esas dos cosas se rechaza.
- **Comentarios en español**, estilo de la casa: cada comentario explica el **POR QUÉ** —el
  incidente o la restricción que lo motivó—, no el qué.

### Qué hace fallar un PR aunque «las pruebas pasen»

1. El banco trae **menos comprobaciones** que la rama base (parte de **690**).
2. Falta la **transcripción de la mutación** en la descripción del PR.
3. Un selector, endpoint o regla clínica **sin evidencia citada**.
4. Cualquier dato de paciente real, en cualquier archivo.
5. El diff toca algo fuera del alcance de la tarea.
6. El archivo aparece reformateado.
7. **Se tocó el eje de color de puntualidad** (ver D0).

---

# 0. CONTEXTO INMUTABLE

Esto es un **userscript de Tampermonkey** que asiste a médicos de una IPS colombiana dentro del
EHR **Everest**. No es una web app: es un huésped que se inyecta en el DOM de una SPA de Angular
ajena que repinta sola y que no controlamos.

### Reglas sagradas del proyecto (valen más que cualquier preferencia estética)

1. **Cero PHI.** Jamás datos reales de paciente en código, pruebas, commits ni logs.
2. **Casilla vacía antes que dato inventado.** Ningún selector del DOM, endpoint ni regla clínica
   sin evidencia real capturada. Si falta evidencia, se pide o se deja vacío. **Nunca se adivina.**
3. **Todo cambio de comportamiento necesita prueba nueva + mutación documentada.**
4. **El médico manda.** El script sugiere, nunca decide, nunca oculta disponibilidad real, nunca
   auto-asigna, nunca bloquea algo que el sistema permite.

### D0 — El eje de color de PUNTUALIDAD es intocable

`colorAndAlert()` (línea ~5027) asigna VERDE/ROJO/ÁMBAR/MORADO codificando **puntualidad**, no
estética: verde = llegó a tiempo · rojo = confirmación extemporánea (fraude) · ámbar = venció la
tolerancia · morado = por vencer. **Ese es el propósito original del script y sostiene la detección
de fraude.** Ninguna tarea de este encargo puede recolorear, reasignar ni «armonizar» ese eje.
Se puede cambiar *cómo se dibuja* (grosor de un borde, forma de un punto); **nunca qué significa**.

Segundo eje, ya implementado y también intocable en su semántica: `--c-atendido` distingue
«Atendido» de «En sala» sin pisar el eje de fraude.

---

# 1. ANCLAS VERIFICADAS DEL CÓDIGO ACTUAL

Reconocimiento hecho y comprobado línea por línea (12 ago 2026, `@version 12.8.1`).
**No lo repitas: parte de aquí.** Si una línea no cuadra, es que el archivo se movió — búscala
por nombre y sigue, pero **avisa en el PR**.

### 1.1 Cómo está hecho el CSS hoy

> **Respuesta a «¿es CSS puro?»: sí, pero no vive en una hoja de estilos.**

| Hecho | Dato |
|---|---|
| Dónde vive el CSS | Un **template literal de JavaScript** dentro del IIFE, ~**1.660 líneas** (≈5.985–7.645) |
| Cómo llega al DOM | Se inyecta **una sola vez** en un `<style>` del `<head>` desde `buildOverlay()` (línea **5975**) |
| `style="..."` inline generado desde JS | **79 bloques** |
| …de ellos, dentro de `render()` (la tarjeta) | **20** |
| Asignaciones `.style.X = …` | **29** |
| `setProperty` | **4** |

**Consecuencia crítica, y la razón de que la Fase 1 exista:** una parte grande del aspecto NO está
en la hoja de estilos, sino **inline dentro del HTML que genera JavaScript** — y el inline gana por
especificidad. **Un refactor que solo reescriba el bloque CSS no cambiará casi nada visible y
producirá un PR que parece funcionar y no funciona.**

### 1.2 La trampa de los tokens (v12.6.6, incidente real ya pagado)

Los tokens (`--c-*`, `--rgb-*`, `--bg*`, `--fg*`, `--r-*`, `--shadow-*`…) **no se declaran sobre
`:root`**, sino sobre una **lista explícita de los 11 contenedores raíz**. Ese roster de 11 se
repite en **SEIS listas** que hay que mantener sincronizadas **a mano**:

| # | Línea | Qué hace | Qué pasa si se olvida | Cobertura |
|---|---|---|---|---|
| 1 | **5991** | Tokens, modo **oscuro** (por defecto) | Ningún `var(--…)` resuelve → el navegador **descarta cada declaración** | 11/11 |
| 2 | **6059–6060** | Los mismos tokens con `.light` | Se queda en oscuro dentro del modo claro | 11/11 |
| 3 | **6165–6170** | `@media (prefers-reduced-motion)` | Ignora la preferencia de accesibilidad | 11/11 |
| 4 | **6175–6178** | Reset de caja/tipografía | Hereda la tipografía de Everest | 11/11 |
| 5 | **6181–6188** | Blindaje `color:inherit` | **Everest pinta de azul** cualquier `<b>/<span>/<div>` propio | 11/11 |
| 6 | **7730–7738** | Blindaje tipográfico | Hereda la fuente de Everest | **9/11 ⚠️** |

`#vgl-labsv-modal` y `#vgl-postcita-panel` **faltaban** en la lista 1. Como se cuelgan de
`document.body` (fuera de `#vgl-root`), no heredaban NINGÚN token: cada `var(--bg-solid)` quedaba
inválido y el aviso salía como **texto suelto sin tarjeta ni fondo** sobre Everest — exactamente lo
que reportó el médico. El diseño existía; no llegaba.

> ⚠️ **La lista 6 sigue desincronizada hoy:** le faltan esos mismos dos contenedores. Está
> **fuera del alcance** de este encargo arreglarlo por tu cuenta; anótalo en el PR y sigue.

**Hay una prueba que ya vigila esto:** `tests/suite_06_interfaz.js`, caso *«todo overlay con
estilos propios hereda los tokens de diseño (si no, sale sin tarjeta sobre Everest)»* (líneas
44–96). **Extiéndela** con cada contenedor nuevo que añadas — su detección es por expresión
regular y es frágil, así que verifica a mano que de verdad caza tu elemento (mételo mal a
propósito una vez y comprueba que la prueba se pone roja).

> **Todo elemento nuevo colgado de `document.body` —el banner y los widgets lo estarán— entra en
> las SEIS listas.** Es lo primero que se audita.

### 1.3 Precedente real de inyección sobre la Historia Clínica

**Ya existe** un elemento propio inyectado en la pantalla de Everest: `createLabInjectorUI()`
(línea **2671**) crea `#vgl-lab-injector`.

```js
btn.style.cssText = "position:fixed;bottom:80px;left:15px;z-index:9999999;background:#8b5cf6;…"
```

Es el **patrón de anclaje a copiar** (posición fija, idempotente por id, re-creado cuando la SPA
repinta vía `seccionActiva()`), y a la vez **el ejemplo de todo lo que este encargo debe corregir**:
color `#8b5cf6` a pelo, `sans-serif`, `z-index` improvisado, y `cssText` inline fuera del sistema
de tokens. **Los widgets nuevos heredan su mecánica de anclaje, no su estética.**

- Contexto del módulo clínico: `_enModuloHCHealth()` (línea **4908**) → `/\/viva\/HCHealth(\/|$)/i`
- Modales existentes usan `z-index:2147483647`; el inyector usa `9999999`. **Hoy no hay política
  de capas.** La habrá (ver D5).

### 1.3-bis Tres trampas que un refactor visual pisa sin darse cuenta

**(a) Parte de la hoja de estilos ya es código muerto.** La regla compartida de los botones de
acción (**6514–6524**) declara `width:30px;height:30px;font-size:14px` **sin `!important`**… y
`render()` los pinta con `style="width:40px;height:40px;font-size:18px"` inline. **Lo que se ve en
pantalla es 40px; lo que dice el CSS es 30px, y no lo aplica nadie.** Si retocas esa regla creyendo
que gobierna algo, no pasará nada y perderás el rato. Es la demostración canónica de D1.

**(b) Existe una PALETA PARALELA que no coincide con los tokens.** En **3101–3102**:

```js
const COLORS = { VERDE:"#10B981", AMBAR:"#D97706", ROJO:"#E54D42", AZUL:"#2563EB", MORADO:"#9333EA" };
const TINT   = { … };
```

Estos hex **no son** los tokens: `--c-verde` vale `#4ff0b8` en oscuro y `#065f46` en claro, mientras
`COLORS.VERDE` es `#10B981` siempre. Hay **dos fuentes de verdad** para los colores de triaje, y la
de JavaScript no sabe de modo claro/oscuro. Unificarlas es tentador y **está PROHIBIDO en este
encargo**: esos valores alimentan el eje de puntualidad (D0). Anótalo como deuda técnica en el PR;
lo decidirá el médico aparte.

**(c) Cinco custom properties existen SOLO inline.** `--tc` y `--trgb` (color de triaje de la
tarjeta), `--ac`/`--ac-rgb` y `--kpi-rgb` los **consume la hoja de estilos pero no los declara
nunca**: los fija JavaScript al pintar. Si al desincrustar el inline los renombras o los eliminas,
**las reglas que dependen de ellos se invalidan en silencio** — sin error, sin prueba roja, solo un
color que desaparece. Están explícitamente exceptuados de T1/T2.

### 1.4 Panel y tarjeta

| Pieza | Línea |
|---|---|
| `buildOverlay()` — monta `#vgl-root`, dock, toasts, e inyecta el CSS | **5975** |
| `colorAndAlert()` — **eje de puntualidad, intocable (D0)** | **5042** |
| `render()` — construye las tarjetas | **11046**–~11230 |
| `card.className` (clases de color/estado) | **11085** |
| Chips PyM del panel (`panelActivities`) | **11102**–11113 |
| Bandera PES `❤ SEGUIMIENTO CARDIOVASCULAR` | **11119** |
| `agendarBtn` | **11131** |
| `labsBtn` | **11156** |
| `atenderBtn` 🩺 (se QUEDA) | **11164** |
| `tieneAbandonoPES()` | **10953** |
| Modo `perf` (`#vgl-root.perf`) | **6141** |

### 1.5 Avisos y PyM

| Pieza | Línea |
|---|---|
| `pymAlert()` | **5185** |
| `abandonoPESAlert()` — título «Prioridad de Atención: Riesgo Cardiovascular» | **5223** / **5233** |
| `pymPendientesRestantes()` | **3321** |
| `helloOncePerDay()` | **11254** |
| `PYM_CATALOG` (actividad → CUPS → CIE-10) | **9892** |
| Etiqueta en Ajustes «Alerta de prioridad cardiovascular» | **10759** |
| Memoria diaria de órdenes: `isOrdenesCreadasHoy` / `ordenesDetalleHoy` | **2945** / **3037** |

### 1.6 EVIDENCIA NUEVA — cómo saber si el paciente YA tiene sus órdenes

**Capturado en consultorio con el grabador del proyecto (12 ago 2026). Respuesta real, no supuesta.**

```
GET /apiviva/APIHCHealth/api/Historicos/ObtenerOrdenamientoPorPacienteIdVigente?pacienteid=667364
→ 200 · array de órdenes VIGENTES del paciente
```

Forma real de cada elemento (claves confirmadas):

```
id · tipo · cup{ id, codigo, descripcion, … } · agrupador · remisor{ nombre, registroMedico }
usuario{ id, identificacion } · dx{ codigo, diagnostico } · cantidad · estado
fechaCreacion · fechaVencimiento · observaciones · logs[]
```

Muestra real (anonimizada, solo códigos):

| `cup.codigo` | `cup.descripcion` | `estado` | `tipo` | `fechaVencimiento` |
|---|---|---|---|---|
| 903818 | COLESTEROL TOTAL | PRO | ORD | 2027-07-09 |
| 895101 | ELECTROCARDIOGRAMA DE RITMO | PRO | ORD | 2027-07-09 |
| 890207 | CONSULTA PRIMERA VEZ POR OPTOMETRÍA | PEN | SOE | 2027-07-09 |
| 452305 | COLONOSCOPIA TOTAL | PEN | ORD | 2027-07-25 |

**Por qué esto lo cambia todo:** es la fuente de verdad de **Everest**, así que responde por los
**tres** caminos por los que el médico pudo ordenar (en la historia clínica, en la web de
ordenamientos, o desde el script). Y cruza directamente contra `PYM_CATALOG[].cups[].codigo`,
que el script ya tiene.

**Lo que NO está confirmado y no se puede inventar:**
- El significado de `estado` (`PEN` / `PRO`). **No asumas** que uno significa «ya hecho».
- La respuesta llegó **truncada a 20.012 caracteres** por el grabador: la lista real es **más
  larga**. Es una respuesta **pesada** — cuenta para el presupuesto de red.
- **El script NO llama hoy a este endpoint.** Es integración nueva.

---

# 2. EL ENCARGO (palabras del médico, sin interpretar de más)

> «quiero que las opciones de agendar citas, agendar ordenamientos de pym y ver laboratorios se
> retiren del panel visual actual al igual que las ayudas visuales de pym […] lo que quede del
> panel será solamente para ver la agenda, sus estados, colores, etc tal cual como está ahora y el
> botón nuevo de atender = abrir historia clínica, se seguirá marcando los abandonados PES al igual
> que antes y se le cambiará la etiqueta (seguimiento cardiovascular por = **Abandono Programa
> RCV**) y se debe orientar al médico de que debe **priorizar la atención del control de riesgo
> cardiovascular sobre cualquier otra cosa**; ahora el aviso de las actividades de pym vivirá en un
> **banner en el top de la página** al abrir la historia clínica […] recordándole al médico las
> actividades que debe ordenar [este banner desaparecería cuando el script detecte que ya el médico
> hizo los respectivos ordenamientos ya sea en everest, por la web de ordenamientos o directamente
> en el script]; los botones de agendar cita, ordenar pym y ver laboratorios ahora se convertirán en
> **widgets superpuestos sobre la historia clínica de everest pero sin estorbar** […] este trabajo
> debe tratar de **simplificar el uso** del script y ser **ALTAMENTE EFICIENTE, ALTAMENTE VISUAL Y
> DIFÍCIL DE IGNORAR** sobre todo las notificaciones, alertas, PyM, Abandono PES RCV. pero debe ser
> **amigable con PCs lentas y anticuadas**.»

**La idea rectora, en una frase:** *el panel deja de ser un centro de mando y se convierte en un
vigía; toda la asistencia clínica se muda a donde el médico trabaja de verdad, la historia clínica.*

---

# 3. DECISIONES DE ARQUITECTURA YA TOMADAS

**No se re-litigan. No se vuelven a preguntar.**

### D1 — El refactor NO empieza por el CSS. Empieza por desincrustar el estilo inline.

Con 79 bloques `style="…"` generados desde JS (20 solo en la tarjeta), rediseñar la hoja de
estilos primero es trabajar sobre reglas que el inline pisa. **Fase 1 = migración mecánica
inline → clases, con CERO cambio visual.** Diff grande pero mecánico y auditable: si algo se ve
distinto al terminar la Fase 1, la Fase 1 está mal.

### D2 — La tabla de laboratorios ya está arreglada en su emergencia; el rediseño es otra cosa.

**Ya corregido en v12.8.1 (no lo rehagas, no lo revientes):** la tabla salía a una palabra por
línea con las demás columnas aparentemente vacías. **No era un fallo de datos** —los nombres en
negrilla se veían en la propia captura— sino tres decisiones de CSS sumadas: `max-width:580px`
heredado de la tarjeta genérica de modal, `overflow-wrap:anywhere` (que **sí** entra en el cálculo
del ancho mínimo intrínseco y hacía que `table-layout:auto` colapsara la columna) y
`vertical-align:middle` (que dejaba el contenido de las otras celdas a media altura de una fila de
miles de píxeles, fuera de la pantalla). Además los ~30 parámetros de un uroanálisis pasaron de
unirse con `<br>` a repartirse en rejilla.

**Lo que queda para el rediseño (TL2):** que un panel multiparamétrico se lea como lo que es —un
panel—, jerarquía de lo alterado sobre lo normal, y densidad de información clínica. **La lección
a interiorizar: en esta tabla, `overflow-wrap:anywhere` y `table-layout:auto` no se vuelven a
juntar nunca.**

### D3 — Amputar del panel NO es borrar funciones.

`openAgendamientoModal` (8956), `openOrdenamientoModal` (10223), `openLaboratoriosModal` (8661) y
`openLabSoloModal` (9693) **siguen existiendo intactas**. Lo único que cambia es **quién las
llama**: hoy los botones de la tarjeta (líneas 11194/11196/11198), mañana los widgets. Borrar esas
funciones —o sus pruebas— es motivo de rechazo.

**Al sacar los botones del panel, estas funciones se quedan sin llamador dentro del script.**
Están vivas y probadas; **NO se borran** — las reconecta T5:

| Función | Único uso hoy | Para qué |
|---|---|---|
| `isCitaAgendadaHoy` (2940) | 11128 | Bloqueo antiduplicado de la cita |
| `isLabAgendadaHoy` (2958) | 11129 | Bloqueo antiduplicado del laboratorio |
| `isOrdenesCreadasHoy` (2945) | 11150 | Bloqueo antiduplicado de las órdenes |
| `panelActivities` (3315) | 11102 | Filtra Optometría/Odontología de los chips |
| `isPanelHiddenActivity` (3314) | 3315 | Idem |

⚠️ **Esos bloqueos antiduplicado son seguridad clínica, no comodidad:** existen para que un doble
clic no genere dos citas o dos órdenes para el mismo paciente. Si los widgets de T5 no los
replican, **se reabre un riesgo de duplicación que ya se cerró una vez**.

**Y la regla exacta que hay que preservar al migrarlos (verificada línea por línea):** la marca se
pone **solo cuando Everest confirma que procesó la petición de verdad** — nunca al pulsar, nunca
«optimistamente»:

| Marca | Se pone solo si… | Línea |
|---|---|---|
| `markCitaAgendadaHoy` | `res.error === false` **y** hay `radicado > 0` real de Everest | 9634 |
| `markOrdenesCreadasHoy` | cada orden trajo su **`agrupador` real** y `fallidasCount === 0` | 10569 |
| `markLabAgendadaHoy` | la reserva respondió **2xx estricto** | 9663 / 9865 |

Esto **no es opcional ni mejorable**: es el arreglo de un incidente real documentado en v11.0.1
(«antes bastaba cualquier respuesta sin `error:true` —incluido un cuerpo vacío— para dar la orden
por creada, mostrar el agrupador falso "OK", marcarla como hecha del día y silenciar el recordatorio
de PyM»). Un widget que marque antes de la confirmación **bloquea al médico para reintentar una
cita que nunca se creó**. Si dudas, mira esas cuatro líneas antes de escribir nada.

⚠️ **El ajuste `S.agendamientoRapido`** (declarado en 2881, interruptor en Ajustes 10761) hoy
gobierna los botones de agendar y ordenar (compuertas en 11131 y 11151). Si los widgets no lo
respetan, **el interruptor queda decorativo**: el médico lo apaga y los botones siguen ahí.

Lo mismo con la telemetría: `uxTrack("panel.agendar.abrir")` y compañía **se conservan**
(renombrando la clave a `widget.*`, documentándolo), porque son la única medida de si el rediseño
mejoró algo.

### D4 — El banner se apaga con la verdad de Everest, no con la memoria del script.

La memoria propia (`isOrdenesCreadasHoy`) solo sabe lo que se ordenó **desde el script y hoy**. El
médico pidió explícitamente que cubra los tres caminos → hay que preguntarle a Everest con
`ObtenerOrdenamientoPorPacienteIdVigente` (§1.6).

**Y la regla que decide el diseño entero:**

> **Ante la duda, el banner SE MUESTRA.**

Un banner de más es una molestia. Un banner de menos es **una actividad de prevención perdida** en
un programa de riesgo cardiovascular. Los dos errores no valen lo mismo. Por tanto: si la consulta
falla, tarda, devuelve algo inesperado o el cruce es ambiguo → **se muestra**, y el banner dice con
honestidad que no pudo verificar.

**Ventana temporal — CERRADA por el médico (12 ago 2026):** las órdenes vigentes de Everest duran
~1 año (`fechaVencimiento`), pero eso es vigencia **administrativa**, no periodicidad clínica. Que
exista una COLESTEROL TOTAL de hace 6 meses **no significa** que la tamización de este año esté
hecha. La ventana correcta es la **vigencia clínica del analito**:

- **Riesgo cardiovascular: máximo 180 días** entre repeticiones.
- **Tamización cardiometabólica en pacientes SANOS:** la periodicidad de la **Resolución 3280 de
  2018**, que NO se deriva de memoria ni de un PDF — sale de la tabla que ya mantiene el médico.

**El script YA tiene la mitad de esto implementado:** `RCV_VIGENCIA_DIAS = 180` (línea 2566) y
`RCV_VIGENCIA_KEYS` (2567) con los 7 analitos RCV, más `_vigenciaDiasParaAnalito`, que ya aplica
el acortamiento cuando RAC ≥ 30. **Reutiliza eso; no escribas una segunda tabla de vigencias.**
Tener dos sería tener dos verdades.

Para las actividades PyM que NO son de RCV, la periodicidad va como **dato por actividad** en
`PYM_CATALOG` (campo `vigenciaDias`), no como constante global. Las que el médico no haya
confirmado se dejan **sin `vigenciaDias`** y esas actividades **siempre cuentan como pendientes**
(D4: ante la duda, el banner se muestra). Anótalas en el PR para que el médico complete la tabla.

Ver `AUDITORIA_MOTOR_RCV_v68.md` en la raíz: la tabla completa de vigencias por estadio renal está
ahí, pero **su adopción es un encargo aparte (fases R2/R3) y NO entra en este PR**.

### D5 — «Difícil de ignorar» ≠ «que estorbe». Jerarquía de intrusión de 3 niveles.

Son órdenes en tensión y hay que resolverla por escrito, no por gusto:

| Nivel | Qué es | Cómo se comporta | Reservado a |
|---|---|---|---|
| **1 · Ambiente** | Widgets de acción (agendar, ordenar, labs) | Siempre visibles, discretos, colapsables, **nunca tapan contenido de Everest** | Herramientas |
| **2 · Persistente** | Banner PyM superior | Ocupa su franja, **no se puede cerrar mientras la condición siga viva**, sí se puede minimizar a una barra fina | Actividades PyM pendientes |
| **3 · Interruptivo** | Modal con sonido | Bloquea hasta que el médico lo reconoce | **Solo** Abandono Programa RCV y fraude |

**El nivel 3 no se degrada.** El abandono del programa cardiovascular **no** se convierte en banner:
sigue siendo interrupción, porque el médico pidió que se priorice sobre cualquier otra cosa.

**«Sin estorbar» es verificable, no opinable:**
- Ningún widget puede solaparse con controles reales de Everest. Anclaje por defecto: **borde
  derecho, centrado vertical**, fuera del área del formulario clínico.
- El banner **empuja** el contenido (reserva su espacio); **no lo tapa** en posición flotante.
- Todo widget es **colapsable a un tirador mínimo**, y su estado se recuerda.
- Nada se pone encima de un modal de Everest.

### D6 — Política de capas (z-index), por fin escrita

| Capa | Rango | Quién |
|---|---|---|
| Widgets sobre la HC | `2147480000` | Dock de acciones |
| Banner PyM | `2147481000` | Aviso superior |
| Panel / dock del Vigilante | `2147482000` | `#vgl-root` |
| Modales del Vigilante | `2147483000` | Agendar/ordenar/labs |
| Alertas nivel 3 | `2147483600` | PES RCV, fraude |

Se declaran como **tokens** (`--z-widget`, `--z-banner`, …). **Prohibido un `z-index` numérico
suelto nuevo.** `#vgl-lab-injector` (hoy `9999999`) se migra a este sistema.

### D7 — Presupuesto de rendimiento (PCs lentas). Verificable, no aspiracional.

El rediseño corre **encima de una SPA de Angular que ya está pintando**, en equipos viejos de
consultorio. Límites duros:

- **`backdrop-filter`: no se añade ni uno más** de los que ya existen. Es el efecto más caro del
  repertorio y ya está en los modales. Los widgets y el banner usan **color sólido u opacidad**.
- **Sombras: máximo 2 capas** por elemento en superficies nuevas.
- **Nada animado de forma permanente.** Ningún `animation` en bucle infinito sobre un elemento
  siempre visible. Las transiciones, solo en `transform` y `opacity` (compositables); nunca en
  `width`, `height`, `top`, `left` ni `filter`.
- **`@media (prefers-reduced-motion: reduce)` obligatorio** en todo bloque nuevo (ya hay
  precedente en el modal de labs).
- **El modo `perf` debe apagar TODO lo nuevo** igual que apaga lo viejo.
- **Se respeta el anti-repintado.** `signatureOf` / `state.lastSignature` evitan reconstruir la
  lista (un comentario del código cifra el coste en 721 reconstrucciones por jornada). Si el
  rediseño de la tarjeta obliga a repintar más, el PR **debe justificarlo con números**.
- **El banner NO consulta la red en cada repintado de Angular.** Una consulta por paciente, con
  caché y deduplicación (el script ya tiene `GHOST.promises` para esto).

### D8 — Convivir con una SPA que repinta sola

Everest es Angular: borra y recrea su DOM sin avisar. Todo elemento inyectado debe ser:
1. **Idempotente por id** (`if (document.getElementById(...)) return;`) — patrón ya usado en 2671.
2. **Re-creable** cuando la SPA lo borre, sin duplicarse ni parpadear.
3. **Sin dependencia de selectores internos de Everest** salvo que haya evidencia capturada. Si
   hace falta anclar a un elemento de Everest, se cita la evidencia; si no la hay, **se ancla al
   `body` con posición fija** (que es lo que ya hace el inyector de labs).
4. **Silencioso al desmontarse.** Nada de errores en consola cuando el médico navega.

### D9 — Etiqueta PES: qué cambia exactamente

Tres sitios, ni uno más:

| Línea | Hoy | v14 |
|---|---|---|
| **11082** | `❤ SEGUIMIENTO CARDIOVASCULAR` | `❤ ABANDONO PROGRAMA RCV` |
| **5233** | «Prioridad de Atención: Riesgo Cardiovascular» | «Abandono Programa RCV — priorice el control de riesgo cardiovascular **sobre cualquier otra actividad de esta consulta**» |
| **10722** | Ajustes: «Alerta de prioridad cardiovascular» | «Alerta de Abandono Programa RCV» |

El color `--c-pes` y la lógica `tieneAbandonoPES()` **no cambian**. Solo el texto y su fuerza.

### D10 — Alcance cerrado

**DENTRO:** el bloque CSS, `render()`, `buildOverlay()`, los tres modales, los avisos, el banner
nuevo, los widgets nuevos, la detección de órdenes vigentes, la etiqueta PES.

**FUERA (no se toca):** `colorAndAlert` y el eje de puntualidad · la lectura de la agenda
(`apiLeerAgenda`/`apiParse`) · el puente con Athenea · la generación real de órdenes
(`apiOrdenamientoGuardar`) · el agendamiento real (`apiAccesoAsignarTurno`) · la telemetría ·
el sistema de actualización por Gist.

**Ya delegado aparte, NO lo dupliques:** el rediseño *funcional* del modal de agendamiento
(ventana de días, realce de la cita sugerida, perfil del paciente) está en
**`SUPERPROMPT_AGENDA_V13.md`**. Aquí solo le toca su **piel** (tokens, tipografía, densidad),
nunca su lógica.

---

# 4. SISTEMA DE DISEÑO v14 — «2026» hecho auditable

«Bonito» no es un criterio revisable. Esto sí:

### 4.1 Lo que se conserva (ya está bien y costó incidentes)

Paleta de triaje AAA sobre fondo OLED, radios orgánicos (16–24px), física de muelle
(`--spring`), modo claro/oscuro completo, y el **mínimo de 12px de tamaño de letra**
(compromiso `[COPY-UX]` existente: **no se baja de ahí en ningún elemento nuevo**).

### 4.2 Lo que se añade

**Escala tipográfica** (fin del `font-size` arbitrario; hoy hay 11px, 11.5px, 12.5px, 13px,
15.5px, 16px, 18px, 21px, 22px sueltos):

```
--t-micro:12px   --t-body:13px    --t-strong:15px
--t-title:18px   --t-hero:22px
```

**Escala de espaciado** (base 4): `--s1:4px --s2:8px --s3:12px --s4:16px --s5:24px --s6:32px`

**Superficies** — tres niveles con función, no decorativos:
`--surface-1` (fondo) · `--surface-2` (tarjeta) · `--surface-3` (elemento interactivo)

**Capas:** los tokens `--z-*` de D6.

### 4.3 Reglas de composición

1. **Un solo acento por superficie.** Si la tarjeta ya grita en rojo por fraude, el badge no
   compite: se apaga.
2. **El color nunca es el único portador de información.** Todo estado crítico lleva **texto o
   icono** además de color (ya se cumple con `⛔ NO CONFIRMADO`; el rediseño no puede perderlo:
   hay médicos con daltonismo y monitores de consultorio pésimos).
3. **Contraste mínimo AA (4.5:1)** para texto; **AAA (7:1)** para todo lo que codifique estado
   clínico. Se verifica y se reporta en el PR con los pares de color reales.
4. **Densidad antes que aire.** Es una herramienta de trabajo para 20+ pacientes al día, no una
   landing page. Si un rediseño obliga a hacer scroll donde antes no hacía falta, es peor, por
   bonito que sea.
5. **Nada de iconografía inventada.** Se siguen usando emojis del sistema (ya en uso: 🩺 🗓️ 📋 🧪
   ❤ ⛔): pesan cero, se ven en cualquier PC y no requieren fuente externa.

### 4.4 Prohibiciones explícitas

- Fuentes externas, iconos externos, CSS externo, imágenes remotas (el script corre bajo CSP ajena
  y **sin red propia**: solo `--font-stack` del sistema).
- `!important` nuevo salvo en el bloque de `prefers-reduced-motion`.
- `position:absolute` con coordenadas mágicas dependientes del layout de Everest.
- Cualquier color a pelo (`#8b5cf6`) fuera del sistema de tokens.

---

# 5. FASES Y TAREAS

Detalle ejecutable en **`JULES_TAREAS_DISENO_V14.md`**. Resumen y **orden obligatorio**:

| Fase | Tarea | Qué entrega | Riesgo |
|---|---|---|---|
| **1** | **T1** Desincrustar el inline de `render()` | 20 bloques `style=` → clases. **Cero cambio visual.** | Medio |
| **1** | **T2** Desincrustar el inline de modales y avisos | Los 59 restantes → clases | Medio |
| **2** | **T3** Sistema de diseño v14 | Tokens nuevos (tipografía, espaciado, capas) en las **4 listas**. Sin rediseñar nada aún. | Bajo |
| **3** | **T4** Amputación del panel + etiqueta PES | Fuera los 3 botones y los chips PyM; queda agenda + 🩺. Etiqueta D9. | **Alto** |
| **4** | **T5** Dock de widgets sobre la HC | Los 3 botones renacen como widgets (D5, D6, D8) | **Alto** |
| **4** | **T6** Detección de órdenes vigentes | Integrar `ObtenerOrdenamientoPorPacienteIdVigente` (§1.6, D4) | **Alto** |
| **4** | **T7** Banner PyM superior | Banner nivel 2, se apaga con T6, falla mostrándose | **Alto** |
| **5** | **TL1** Piel de los modales | Agendar/ordenar bajo el sistema v14 | Bajo |
| **5** | **TL2** Rediseño del modal de labs | Panel multiparamétrico legible (D2) | Medio |
| **6** | **T8** Auditoría de rendimiento y contraste | Medición contra D7 y §4.3 | — |

**Cada tarea = un PR. Ninguna tarea empieza sin que la anterior esté fusionada.** T4 sin T1/T2
hechas produce un desastre silencioso (el inline sobrevive y pisa todo).

---

# 6. DEFINICIÓN DE HECHO

Un PR de este encargo está listo cuando:

1. `node tests/runner.js` en verde, con **≥ 690** comprobaciones (nunca menos).
2. **Salida completa del runner** pegada en el PR, con la línea de resumen final.
3. **Prueba nueva** que falla si se revierte el cambio, y **transcripción de la mutación**:
   qué línea se rompió, qué prueba lo cazó.
4. **Cero cambios fuera del alcance** de la tarea. Cero reformateo.
5. Todo elemento nuevo colgado de `document.body` está en las **4 listas de tokens** (§1.2).
6. Ningún `z-index`, color ni `font-size` numérico suelto: todo por token.
7. Cumple el presupuesto de D7 y lo dice explícitamente
   (`backdrop-filter` añadidos: **0**; capas de sombra; animaciones permanentes: **0**).
8. Modo **claro y oscuro** verificados. Modo **`perf`** apaga lo nuevo.
9. Pares de contraste reportados (§4.3.3).
10. **Auditoría de Claude superada**, y el diseño aprobado por el médico. *Jules no fusiona nada.*

---

# 7. PROTOCOLO ANTE LA DUDA

1. **¿Falta evidencia?** No la inventes. Deja la casilla vacía, dilo en el PR y, si hace falta,
   entrega un script de diagnóstico para capturarla en consultorio. Es una regla dura: el proyecto
   ya pagó incidentes por campos de API adivinados que no existían.
2. **¿Dos instrucciones chocan?** Gana la seguridad clínica, después la del médico, después la
   estética. «Difícil de ignorar» le gana a «elegante» siempre que haya una actividad de
   prevención en juego.
3. **¿El cambio obliga a tocar algo de D10-FUERA?** Detente y explícalo en el PR sin tocarlo.
4. **¿La prueba no pasa y no sabes por qué?** Nunca «ajustes» la prueba hasta que pase. Una prueba
   debilitada para que un PR entre es la peor manera de romper este script.
