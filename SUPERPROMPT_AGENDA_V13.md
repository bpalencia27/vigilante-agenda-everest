# SUPER PROMPT — Orquestador de subagentes
## Refactorización visual del panel de agendamiento (Vigilante de Agenda v13.0.0)

> Pégalo completo como brief del orquestador. Está escrito para ejecutarse por fases con
> compuertas; ningún agente de una fase arranca sin el entregable de la anterior.

---

# 0-bis. MODO JULES — cómo se ejecuta esto en un agente único

Este documento describe 18 agentes en 5 fases. **Jules no es un orquestador: es UN agente
asíncrono por tarea.** No le pegues el documento entero esperando que lo ejecute todo — leería
500 líneas y haría *algo*. El reparto en tareas está en **`JULES_TAREAS_AGENDA_V13.md`**, en
este mismo repo: una tarea por sesión, en el orden que indica.

**Cada tarea de Jules se resuelve así:** «lee `SUPERPROMPT_AGENDA_V13.md` y ejecuta ÚNICAMENTE
el agente X». El brief está commiteado, así que no hace falta repetirlo en el prompt.

### Reglas del entorno (léelas antes de tocar nada)

- **Rama base: `claude/pym-agenda-blindaje-v12-4`**, no `main`. El PR va contra esa rama.
- **El banco corre sin instalar nada:** `node tests/runner.js`. No hay `npm install`, no hay
  `package.json` con dependencias, no hay framework de pruebas. **No añadas ninguno.**
- **PROHIBIDO reformatear.** Nada de Prettier, ESLint --fix, reordenar funciones, cambiar
  comillas, normalizar indentación ni «limpiar» el archivo. `vigilante_agenda.user.js` es un
  IIFE de ~11.500 líneas: un reformateo produce un diff imposible de revisar y **el PR se
  descarta entero**, aunque el cambio de fondo fuera correcto.
- **No añadas herramientas de build, bundlers, TypeScript ni dependencias.** El archivo se
  copia tal cual a un Gist y Tampermonkey lo ejecuta; cualquier paso de compilación lo rompe.
- **Ninguna petición real** a Everest, Athenea ni AppCita. Todo con mocks, como las suites
  existentes. Jules no tiene —ni debe tener— credenciales de la clínica.
- **Diff mínimo.** Solo lo que pide la tarea. Nada de «de paso arreglé…».
- **Si Jules te pide aprobar un plan**, ese plan debe incluir explícitamente: (1) qué prueba
  nueva va a escribir y (2) qué mutación va a aplicar para verificarla. Un plan sin esas dos
  cosas se rechaza antes de que escriba una línea.
- **Comentarios en español**, con el estilo de la casa: cada comentario explica el POR QUÉ
  —el incidente o la restricción que lo motivó—, no el qué.

### Qué hace fallar un PR aunque «las pruebas pasen»

1. El banco trae **menos comprobaciones** que la rama base (parte de 677): se borró o debilitó
   una prueba.
2. Falta la **transcripción de mutación** en la descripción del PR.
3. Un selector, endpoint o regla clínica **sin evidencia citada**.
4. Cualquier dato de paciente real, en cualquier archivo.
5. El diff toca algo fuera del alcance de D5.
6. El archivo aparece reformateado.

---

# 0. CONTEXTO INMUTABLE (ningún agente puede cambiar esto)

**Producto.** `vigilante_agenda.user.js` — userscript de Tampermonkey (IIFE única, sin build,
sin bundler, sin dependencias externas) que un médico de una IPS colombiana usa DENTRO del
EHR Everest. Se distribuye por Gist: `@version` en el encabezado dispara la autoactualización.

- Repo: `bpalencia27/vigilante-agenda-everest` · Rama: `claude/pym-agenda-blindaje-v12-4`
- Clon local: `/workspace/vigilante-agenda-everest`
- Versión de partida: **12.6.9** · Banco de pruebas: **677/677 en verde**
- Entregable de esta tanda: **v13.0.0**

**Las tres reglas sagradas del proyecto. Violarlas invalida el trabajo entero:**

1. **Cero PHI.** Jamás un nombre, cédula, teléfono o dato de paciente real en código,
   pruebas, commits, logs o comentarios. Los datos de prueba son inventados y evidentes.
2. **Casilla vacía antes que dato inventado.** Ningún selector del DOM, endpoint, parámetro
   ni regla clínica entra al código sin evidencia real capturada. Si falta evidencia: se
   entrega un script de diagnóstico y **se pregunta**. Nunca se rellena con una suposición
   plausible.
3. **Toda modificación trae prueba nueva + test de mutación.** El ciclo obligatorio es:
   escribir la prueba → romper a propósito el arreglo → **confirmar que la prueba nueva
   falla** → restaurar → confirmar verde. Una mutación que sobrevive significa que la prueba
   no prueba nada y hay que rehacerla. Se documenta qué mutación se aplicó y qué prueba cayó.

**El médico manda.** El script sugiere, nunca decide por él. Prohibido: ocultar
disponibilidad real, auto-asignar una cita, o impedir que elija algo que el sistema permite.
Toda regla clínica de este encargo es un **realce visual y una recomendación**, jamás un
bloqueo.

**Disciplina del banco de pruebas** (`tests/harness.js` + `tests/runner.js`, `node tests/runner.js`):
- El arnés expone automáticamente como `c.api.*` las funciones declaradas como `function NOMBRE(...)` de nivel superior.
- Cada suite declara un arreglo `cubre` que se **valida contra la API real**: un nombre que no exista rompe el banco.
- El DOM simulado **no interpreta `innerHTML`**: los nodos pintados con plantillas no existen como nodos.
  Para ejercitar UI hay que usar el patrón de `tests/suite_15_interfaz_avanzada.js`
  (`enriquecerDom` → `querySelector` memoizado por selector; `disparar(nodo, "click")`;
  cada elemento memoiza SUS PROPIOS selectores, así que hay que llegar por el mismo camino
  que recorre el código de producción).
- El arnés **recorta todo `setTimeout` del script a ≤1 ms**: nunca se prueba con reloj de
  pared, se prueba contando invocaciones.
- El runner sale con código distinto de cero ante cualquier fallo.

---

# 1. ANCLAS VERIFICADAS DEL CÓDIGO ACTUAL

Leídas del archivo real (números de línea sobre v12.6.9; verifícalos, no los asumas):

| Elemento | Dónde | Qué hace hoy |
|---|---|---|
| `openAgendamientoModal(apt)` | :8858 | Construye `#vgl-agendar-modal` completo |
| `calcBusinessTargetDate(m, d)` | :7903 | Fecha objetivo; **sábado→viernes, domingo→viernes** |
| `calcTargetDateRange(m, d)` | :8481 | Ventana de chips: **exactamente 3 días antes y 3 después**, con `getDay() !== 0 && getDay() !== 6` — **descarta sábados por diseño** |
| `calcDateRangeAroundIso(iso, sideCount)` | :8525 | Igual, centrado en una ISO dada (lo usa laboratorio) |
| `renderDayChips(m, d)` | :9376 | Pinta los chips. El sugerido solo recibe `🎯` + clase `.active` → **esto es "a duras penas se nota"** |
| `apiAccesoBuscarCitasDisponibles(pacienteId, fechaIso, especialidadId)` | :8082 | Devuelve las agendas de un día. **Fuente de verdad de si un día tiene agenda** |
| `apiAccesoObtenerTurnos(agendaId, fechaFmt, pacienteId)` | :8339 | Turnos de una agenda; la hora viene en `hora` / `horaTexto` / `Hora` |
| `normalizeHora(...)` | ~:8209 | Normalizador de hora ya existente — **reutilizar, no reescribir** |
| `programasPaciente` | :9094 | **Ya se lee**: `BuscarPacienteDetallado` → `data.programasPaciente[]` con `id`, `descripcion`, `swProgramaEspecial` |
| `#vgl-agm-prog-box` / `#vgl-agm-prog-sel` | :8931 | Desplegable de programa. **Ya se llena** con `programasPaciente[]` filtrando `swProgramaEspecial === true`; el médico ELIGE uno y ese id viaja como `ProgramaId` en `AsignarTurno` |
| `_cargarHorasToken` | :9039 | Patrón de cancelación de respuestas obsoletas — **respetarlo** |
| `vivo()` / `closeMod()` | :9027 | Guarda de promesa huérfana: nada se pinta sobre un modal ya cerrado |
| `colorAndAlert(a, now)` | :5027 | **Asigna VERDE tanto a «En sala» como a «Atendido»** — de ahí que se vean idénticos. El color codifica PUNTUALIDAD (verde a tiempo / rojo fraude / ámbar sin presentarse), no estado de atención |
| `render()` — `card.innerHTML` | ~:11054 | Tarjeta del paciente: punto de color, hora, `<span class="vgl-badge">` con `a.estado` textual, nombre, CC, chips PyM y botones |
| Tokens de diseño CSS | ~:5654 | Lista de selectores donde viven `--bg-solid`, `--fg`, `--r-surface`… |

**Trampa conocida (incidente v12.6.6).** Todo overlay que cuelgue de `document.body` fuera de
`#vgl-root` **debe** estar en las cuatro listas globales de CSS (tokens oscuro, tokens claro,
`prefers-reduced-motion`, reset de `box-sizing`) o cada `var()` queda inválido y el elemento
sale como texto desnudo sobre Everest. Existe una prueba estructural en
`tests/suite_06_interfaz.js` que lo verifica: **no la debilites, extiéndela si hace falta.**

---

# 2. EL ENCARGO (palabras del médico, sin interpretar de más)

> «El panel de agendamiento de citas es ambiguo y confuso; necesita una refactorización
> **netamente visual**, lo funcional está OK.»

1. Mostrar **7 días hábiles antes y 7 días hábiles después** de la cita sugerida.
2. La cita sugerida debe **resaltar mucho más** (hoy apenas se nota).
3. **Incluir los sábados laborales.** Cada médico trabaja un sábado cada 15 días → el script
   debe averiguar **qué sábado trabaja el id del médico conectado**.
4. **No mostrar los días sin agenda.**
5. Resaltar con **color y elementos visuales propios** las horas **7:30, 9:30, 11:30, 1:30,
   3:30 y 5:30** (según la jornada que aplique): son citas **adicionales** a las de cada
   20 minutos.
6. Esas citas adicionales **por lo general** solo se sugieren a **hipertensos sin diabetes ni
   enfermedad renal crónica**. En casos puntuales sin más cupos en otros días, **se habilitan
   para cualquier paciente**.
7. **Las etiquetas del paciente ya existen y son la clave de todo esto.** En el módulo de
   citas de Everest —y en el del script— aparece en cada paciente una etiqueta que lo
   clasifica: **`hipertensión`, `HTA+DM`, `diabetes`, `nefroprotección`**. Esa es la señal que
   debe alimentar la recomendación.
8. **Perfil diabético** (etiqueta `diabetes` y/o `HTA+DM`): se recomiendan las horas de la
   **primera mitad de la jornada**, repintadas con un color propio y con **una de ellas
   elegida como sugerida**. Primera mitad = **06:00–09:00 en la jornada de la mañana** y
   **13:00–16:00 en la de la tarde**.
9. En todos los casos **queda disponible elegir cualquier otra hora**. La meta es que el
   módulo **encuentre las citas recomendadas por perfil de paciente**, no que restrinja.
10. **Distinguir de un vistazo al paciente ATENDIDO del que está EN SALA.** Reportado con
    captura del panel real: hoy lo único que los diferencia es la palabra dentro de la
    insignia. Todo lo demás —punto de color, tono de la insignia, tratamiento de la tarjeta—
    es idéntico. El médico necesita una ayuda visual, no leer cada tarjeta.
    *(Nota de alcance: esto NO es el modal de agendamiento, es la LISTA de tarjetas del panel.
    Ver D6 y el agente C6.)*
11. **Analizar qué funcionalidades útiles se podrían agregar** con todo lo que ya se conoce.

---

# 3. DECISIONES DE ARQUITECTURA YA TOMADAS

No se re-litigan. Un agente que quiera desviarse debe escribir una objeción razonada en su
entregable y **detenerse**, no improvisar.

### D1 — El sábado NO se calcula: se pregunta.
Prohibido modelar la rotación quincenal con una fórmula (fecha ancla + paridad de semana +
`medicoId`). Sería una regla inventada, sin evidencia, y fallaría en silencio en festivos,
cambios de turno o permutas entre médicos — con el peor resultado posible: ofrecer al médico
un sábado que no trabaja.

**La fuente de verdad es `BuscarCitasDisponibles` para ese sábado concreto**: si devuelve
agenda, el médico trabaja; si no, no. Eso responde "qué sábado trabaja este id" sin inventar
un calendario, y además funciona con permutas y festivos.

**Esto une los requisitos 3 y 4 en una sola solución**: hay que sondear día por día para saber
cuáles tienen agenda, y ese mismo sondeo revela los sábados laborales. Un único mecanismo.

*Opcional, solo si sobra presupuesto:* cachear los sábados confirmados por `medicoId` para
pintar el chip antes de que responda la consulta — pero **siempre** mostrando lo confirmado
por la API, con la predicción marcada visualmente como no confirmada.

### D2 — El coste de red es el riesgo principal de este encargo.
±7 hábiles + sábados ≈ **16-18 días**, y hoy se hace **1 petición por día**. Multiplicado por
cada apertura del modal y cada cambio de especialidad/plazo, eso puede degradar el consultorio
entero. Es obligatorio:

- Sondeo por lotes con **concurrencia limitada** (4-6 en vuelo, nunca 18 a la vez).
- **Caché** con clave `(pacienteId, especialidadId, fechaIso)` y TTL corto (5-10 min), viva
  mientras dure el modal como mínimo.
- **Render progresivo**: los chips aparecen a medida que responden, con estado de carga
  visible. Prohibido dejar el panel en blanco esperando 18 respuestas.
- Respetar `_cargarHorasToken` y `vivo()`: cambiar de especialidad o cerrar el modal debe
  **cancelar** el sondeo en curso, no dejarlo escribiendo sobre nodos muertos.
- Si el sondeo completo falla o tarda, **degradar** a la ventana actual (±3) con aviso —
  nunca dejar al médico sin poder agendar.

### D3 — El perfil del paciente sale de la ETIQUETA, no de una deducción clínica.
El médico confirmó que en el módulo de citas —el de Everest y el del script— cada paciente ya
trae una etiqueta: **`hipertensión`, `HTA+DM`, `diabetes`, `nefroprotección`**. Eso cambia el
problema entero: **no hay que inferir el perfil de laboratorios ni de diagnósticos; hay que
leer una etiqueta que el sistema ya calculó.**

**Capa 1 — la que ya existe en el código y es gratis.** `BuscarPacienteDetallado` →
`data.programasPaciente[]` con `id`, `descripcion`, `swProgramaEspecial`. El modal **ya la
pide y ya la pinta** en `#vgl-agm-prog-sel` (:8931, :9094). Las etiquetas que ve el médico
salen casi con certeza de ese `descripcion`. **Primera tarea de A3: confirmarlo y capturar
las cadenas EXACTAS** — `"Hipertensión"`, `"HTA + DM"`, `"HTA+DM"`, `"Diabetes"`,
`"Nefroprotección"`… no se sabe cómo vienen escritas, y de eso depende todo el emparejamiento.

**Tres hechos del dominio que cambian el diseño y que hay que respetar:**

1. **Un paciente tiene VARIOS programas, no uno.** `programasPaciente` es una lista. La
   clasificación del perfil debe mirar **toda la lista**, no solo el elemento seleccionado:
   un paciente con `Hipertensión` + `Nefroprotección` es nefroprotegido para efectos de la
   recomendación, aunque el médico cargue la cita a HTA.
2. **El médico elige a qué programa se carga la cita, y puede elegir uno distinto del
   perfil.** Está documentado en el código con captura real: para una agenda de HTA el médico
   eligió «Nefroprotección». Entonces la recomendación **debe recalcularse cuando cambia
   `#vgl-agm-prog-sel`**, mostrando si lo elegido concuerda o no con el perfil detectado — sin
   impedir nada.
3. **La etiqueta puede faltar.** Un paciente nuevo, o uno sin programa cargado, no tiene
   etiqueta. Eso es `SIN_ETIQUETA`, no "sano".

**Capas de refuerzo, solo si A3 confirma que la capa 1 no basta.** Todas aparecen en capturas
reales del GRABADOR pero **ninguna está verificada en su contenido**:

| Fuente | Endpoint | Qué aportaría |
|---|---|---|
| Diagnósticos | `ParDiagnosticos/GetParDiagnosticoByCitaId?citaId=` | CIE-10: I10 (HTA), E11 (DM2), N18 (ERC) |
| Programa PES | `APIHCHealth/api/Historicos/ObtenerProgramaPes?PacienteId=` | Programa de crónicos |
| Riesgo renal | `.../ObtenerHcDataPrevRenalByPacienteId?paciente_id=` | Datos renales previos |
| **Athenea (ya integrado)** | labs que el script YA precarga | Creatinina/TFG → ERC · HbA1c → DM · RAC → daño renal |

**Regla innegociable de honestidad.** El perfil se afirma solo con una fuente verificada. Si
no se puede: estado `SIN_ETIQUETA`, **que es comportamiento normal y no un fallo** — se
muestran todas las horas, sin recomendación de perfil, con rótulo honesto («sin etiqueta de
programa»). **Jamás inferir "hipertenso sin diabetes" del silencio**: un paciente sin datos
cargados no es un paciente sin diabetes, y ofrecerle un cupo adicional por omisión es
exactamente el error que este proyecto no comete.

### D3-bis — Motor de recomendación por perfil: DOS EJES INDEPENDIENTES
El módulo debe **encontrar la cita recomendada**, no filtrar la agenda.

Confirmado con el médico (13-08-2026): nefroprotección **no tiene preferencia de horario
propia**; si además hay diabetes, mandan las reglas de la diabetes. Eso descarta el modelo de
escalera única —donde un perfil «gana» y anula a los demás— porque produciría justo el error
contrario: un nefroprotegido diabético se quedaría sin su franja recomendada.

Son **dos preguntas separadas**, que se responden por separado sobre la MISMA lista de
etiquetas. Un paciente puede responder distinto a cada una y eso es normal, no un conflicto.

#### Eje A — ¿A qué hora le conviene? (recomendación de franja)

| Condición sobre las etiquetas | Recomendación |
|---|---|
| Contiene `diabetes` **o** `HTA+DM` | **Primera mitad de la jornada** (AM 06:00–09:00 · PM 13:00–16:00), repintada, con una hora preseleccionada |
| No contiene diabetes | Sin preferencia de franja — horario normal |

**La diabetes es la única que impone franja.** `nefroprotección` sola, `hipertensión` sola, o
ambas juntas → sin preferencia. `nefroprotección` **+** diabetes → primera mitad, igual que
cualquier diabético: la nefroprotección no anula nada en este eje.

#### Eje B — ¿Puede usar los cupos adicionales (7:30 / 9:30 / 11:30 / 1:30 / 3:30 / 5:30)?

| Condición sobre las etiquetas | Cupos adicionales |
|---|---|
| `hipertensión` **y** sin diabetes **y** sin nefroprotección | ✅ **Recomendados** — es el perfil objetivo |
| Contiene `diabetes` o `HTA+DM` | ❌ No recomendados (tiene diabetes) |
| Contiene `nefroprotección` | ❌ No recomendados (enfermedad renal) |
| Sin etiqueta reconocida | ➖ Visibles, sin recomendar |

**Este eje es una lista de exclusiones, no un escalafón.** Basta UNA condición excluyente para
que los cupos dejen de recomendarse; no importa el orden en que se evalúen. Esa propiedad es
deliberada: elimina la clase entera de bugs donde el resultado depende del orden del arreglo.

**Ejemplos resueltos, para que no haya interpretación:**

| Etiquetas | Eje A (franja) | Eje B (cupos adicionales) |
|---|---|---|
| `Hipertensión` | sin preferencia | ✅ recomendados |
| `HTA+DM` | primera mitad | ❌ |
| `Diabetes` | primera mitad | ❌ |
| `Nefroprotección` | sin preferencia | ❌ |
| `Hipertensión` + `Nefroprotección` | sin preferencia | ❌ |
| `Nefroprotección` + `Diabetes` | **primera mitad** | ❌ |
| `Nefroprotección` + `HTA+DM` | **primera mitad** | ❌ |
| (ninguna / desconocida) | sin recomendación | ➖ visibles |

**Reglas de comportamiento, para todos los perfiles por igual:**
- **Nada se oculta ni se deshabilita.** Todas las horas disponibles siguen siendo elegibles.
- La recomendación es **realce + preselección**; el médico la cambia con un clic.
- Cada realce lleva **su razón visible** («recomendado: perfil diabético · primera mitad de la
  jornada»). Un color sin explicación es justo lo que hoy hace el panel «ambiguo y confuso».
- **Excepción de escasez** (requisito 6): si NO hay cupos normales en ningún día de la
  ventana, los adicionales se ofrecen a cualquier perfil, **rotulados como excepción** para
  que el médico sepa por qué se los están ofreciendo.
- Recalcular al cambiar `#vgl-agm-prog-sel`, la especialidad o el día.

**Primera mitad de la jornada: hay que detectar la jornada, no asumirla.** Un día puede tener
agenda de mañana, de tarde o ambas. La partición se calcula sobre **los turnos que realmente
devolvió `ObtenerTurnos` para ESE día**: los que caen en 06:00–09:00 son primera mitad de la
jornada AM; los de 13:00–16:00, primera mitad de la PM. Si un día solo tiene jornada de tarde,
la recomendación es 13:00–16:00 y no existe la de mañana. Prohibido asumir que toda agenda
empieza a las 6.

**Colisión de realces.** 7:30 es cupo adicional **y** cae dentro de 06:00–09:00. Un paciente
nunca recibe los dos realces a la vez (quien tiene franja recomendada es diabético, y un
diabético no recibe cupos adicionales), salvo bajo la excepción de escasez. En ese caso manda
el realce del perfil y la marca de «adicional» queda como información secundaria. Nunca dos
realces compitiendo por el mismo espacio visual.

### D4 — Las horas adicionales se detectan normalizando, no comparando cadenas.
7:30, 9:30, 11:30 son AM; 1:30, 3:30, 5:30 son **PM (13:30, 15:30, 17:30)**. La API entrega
`"07:30 AM"` / `"01:30 PM"` y a veces `hora`, `horaTexto` o `Hora`. **Reutilizar
`normalizeHora`**, que ya resuelve ese lío. Un `includes("7:30")` es motivo de rechazo:
casaría con `17:30` y con `07:30 PM`.

### D6 — «Atendido» vs «En sala»: hace falta un SEGUNDO eje visual, no repintar el existente.
Diagnóstico verificado en el código, no supuesto: `colorAndAlert` (:5031-5044) devuelve
**VERDE para «En sala» y VERDE para «Atendido»**. La tarjeta pinta ese color en el punto, en
el tinte de la insignia y en el borde. Por eso son gemelas: **el color no codifica el estado
de atención, codifica la PUNTUALIDAD** — verde llegó bien, rojo fraude extemporáneo, ámbar
pasó la tolerancia sin presentarse, morado por vencer, azul en espera normal.

Y ese eje **no se puede tocar**: es el que sostiene la detección de fraude, que es la función
original del Vigilante. Repintar «Atendido» de gris rompería la señal de fraude en pacientes
ya atendidos (la rama que pinta ROJO cuando alguien pasó de «Sin presentarse» directo a
«Atendido»), que costó una versión entera arreglar.

**La solución es añadir un segundo eje independiente**, el de *¿requiere acción?*:

| Estado | Significado para el médico | Eje 1 (color = puntualidad) | Eje 2 (atención) |
|---|---|---|---|
| **En sala** | **Te está esperando AHORA. Actúa.** | intacto (verde/rojo) | **destacado, activo** |
| **Atendido** | Hecho. No requiere nada. | intacto (verde/rojo) | **atenuado, cerrado** |
| Sin presentarse / otros | En curso o pendiente | intacto | neutro |

**Cómo se expresa el eje 2** (lo concreta el diseño de la Fase 1, pero con estas reglas):
- **Nunca solo con color**: tiene que haber forma, opacidad, peso tipográfico o un icono —
  el panel se usa con luz de consultorio y hay médicos con daltonismo.
- «Atendido» se **atenúa** (es trabajo terminado, debe pesar menos visualmente y dejar de
  competir por la atención), pero **sigue legible** — no se oculta ni se colapsa: el médico
  necesita poder releerlo y usar sus botones.
- «En sala» se **destaca**, porque es lo único de la lista que exige una acción inmediata.
- El **rojo de fraude sigue ganando** sobre cualquier atenuación: un atendido con fraude
  extemporáneo tiene que seguir gritando. Prueba obligatoria de este caso.
- Los botones de acción de una tarjeta atenuada **siguen funcionando**. Atenuar es un peso
  visual, jamás una discapacidad funcional.

**Contar los estados no basta.** El resumen del panel ya dice cuántos hay en sala y cuántos
atendidos (:10845): el problema no es el conteo, es reconocerlos **dentro de la lista** sin
leer palabra por palabra.

### D5 — Alcance cerrado.
**Se toca:** la ventana de días, el realce del sugerido, el filtrado de días sin agenda, el
lenguaje visual de los cupos, la clasificación de programa, el CSS del modal y —solo para lo
que pide D6— el **lenguaje visual de la tarjeta en la lista del panel** (`render()`, ~:11054).
**No se toca:** `AsignarTurno` y su contrato, el flujo de laboratorio, `mostrarPanelPostCita`,
el SMS, el módulo de órdenes PyM, la telemetría. Si un agente cree que debe tocarlos, lo
escribe como hallazgo y **para**.

---

# 4. FASES, AGENTES Y COMPUERTAS

Cada agente devuelve **JSON estructurado**. La compuerta entre fases la evalúa el orquestador:
si un criterio de aceptación no se cumple, esa fase se repite con el hallazgo como entrada —
no se avanza «con lo que hay».

---

## FASE 0 — RECONOCIMIENTO (4 agentes en paralelo, SOLO LECTURA)

Prohibido escribir código en esta fase.

### A1 · Cartógrafo del modal
Mapea `openAgendamientoModal` de punta a punta: estado interno, orden de llamadas, quién pinta
qué, dónde vive cada trozo de CSS, qué invariantes existen (`vivo()`, tokens de cancelación,
guardas de promesa huérfana) y qué se rompería al cambiar la ventana de días.
**Salida:** `{ funciones:[{nombre,linea,rol}], estado:[...], invariantes:[...], puntosDeCorte:[{donde,linea,riesgo}], cssRelevante:[...] }`

### A2 · Arqueólogo de evidencia
Recorre las capturas del GRABADOR del repo y los contratos ya documentados. Para CADA
endpoint de agenda: forma exacta de la respuesta, campos, tipos, casos raros (día sin agenda,
varias agendas el mismo día, turnos sin hora).
**Salida:** `{ endpoints:[{url,metodo,respuesta,camposClave,evidencia,confianza:"confirmado|parcial|sin_evidencia"}], huecos:[...] }`
**Criterio de aceptación:** ningún endpoint marcado `confirmado` sin cita textual de dónde salió.

### A3 · Investigador de etiquetas y perfil del paciente
Ejecuta D3. **Su tarea número uno, antes que ninguna otra: averiguar de dónde salen las
etiquetas que el médico ve** (`hipertensión`, `HTA+DM`, `diabetes`, `nefroprotección`) y
capturar **las cadenas EXACTAS** con que llegan. Candidata principal:
`programasPaciente[].descripcion`, que el código ya lee en :9094. Verificar también si esas
etiquetas aparecen en la LISTA de la agenda (además del detalle del paciente), porque eso
permitiría clasificar sin una petición extra por paciente.

Debe entregar la **tabla de emparejamiento** cadena-real → perfil, contemplando variantes de
tildes, mayúsculas, espacios y separadores (`HTA+DM`, `HTA + DM`, `HTA/DM`) — el proyecto ya
perdió un resultado de laboratorio entero por comparar nombres sin normalizar (v12.6.8): esa
lección aplica aquí igual.

Clasifica cada fuente en `confirmada` / `necesita captura` / `descartada` y **diseña el script
de diagnóstico** que el médico correrá una vez en consola (sin PHI: solo forma, nombres de
campos y las cadenas de `descripcion`, que no identifican a nadie).
**Salida:** `{ etiquetasReales:[...], mapeoEtiquetaPerfil:[{cadena,perfil,evidencia}], capas:[{fuente,confianza,queAporta,comoVerificar}], escaleraPrecedencia:{...}, scriptDiagnostico:"...", preguntasAlMedico:[...] }`
**Criterio de aceptación:** ninguna cadena de etiqueta declarada sin evidencia de dónde salió.

### A4 · Auditor de UX (por qué es "ambiguo y confuso")
Inventario **concreto** de los defectos del panel actual: jerarquía, contraste, densidad,
qué compite por la atención, cuántos clics hasta agendar, qué no se entiende sin explicación.
Cruza con la telemetría real (`panel.agendar.abrir` vs `cita.creada:12` → tasa de abandono) y
con los criterios del proyecto: legibilidad a 1 m, daltonismo, WCAG AA mínimo.
**Salida:** `{ defectos:[{sintoma,causa,evidencia,severidad}], metricas:{...}, criteriosDeExito:[...] }`

> **COMPUERTA 0:** A2 y A3 deben declarar explícitamente qué NO está confirmado. Si las
> cadenas exactas de las etiquetas no se pueden confirmar, la Fase 2 implementa igual: el
> motor de perfil queda construido y probado con las cadenas **como parámetro configurable**,
> el comportamiento por defecto es `SIN_ETIQUETA` (D3) y el script de diagnóstico de A3 entra
> en el entregable final. Así el médico corre el diagnóstico, manda las cadenas reales y solo
> hay que rellenar la tabla — no rehacer el motor.

---

## FASE 1 — DISEÑO (3 propuestas divergentes + panel de jueces)

### B1, B2, B3 · Tres propuestas independientes
Cada una parte de A1+A4 y **no ve a las otras**. Ángulos obligatoriamente distintos:

- **B1 · Densidad clínica** — máxima información en mínimo espacio; el médico ve 16 días y sus cupos sin desplazarse.
- **B2 · Línea de tiempo** — eje temporal continuo; el sugerido es el ancla visual y la distancia se lee de un vistazo.
- **B3 · Tarjetas por día** — cada día es una tarjeta con su carga; sábados y cupos adicionales como ciudadanos de primera.

Cada propuesta entrega: maqueta en HTML/CSS **estático y autónomo** (fuera del userscript,
para poder verla), jerarquía visual justificada, tratamiento del día sugerido, y **los tres
lenguajes visuales que ahora conviven sin pisarse**: (1) día sugerido, (2) cupo adicional
7:30/9:30/…, (3) franja recomendada por perfil (primera mitad para diabéticos). Además:
la etiqueta del perfil visible en el panel con su razón, comportamiento con 0 días
disponibles / 1 día / 16 días, y estado de carga progresiva.

**Cada maqueta debe mostrarse en los cuatro perfiles** (`HIPERTENSO`, `DIABETICO`,
`NEFROPROTECCION`, `SIN_ETIQUETA`): si el diseño solo se ve bien en uno, no sirve.
**Restricciones:** sin librerías externas; usa los tokens de diseño existentes; funciona en
claro y oscuro; el color **nunca** es el único portador de significado (daltonismo).

### B4 · Panel de jueces (3 jueces con lentes distintas, en paralelo)
- **Juez clínico:** ¿resuelve la ambigüedad? ¿el sugerido grita lo suficiente? ¿se entiende sin capacitación? **¿Se distinguen a simple vista los TRES lenguajes visuales que ahora conviven —día sugerido, cupo adicional y franja recomendada por perfil— sin que compitan entre sí?**
- **Juez de accesibilidad:** contraste, daltonismo, teclado, movimiento reducido, tamaño de objetivo.
- **Juez de implementación:** ¿es construible sin romper el arnés? ¿el DOM simulado puede probarlo? ¿cuánto CSS nuevo? ¿riesgo de regresión?

Cada juez puntúa 1-10 con justificación. **Síntesis: se toma la ganadora y se le injertan las
mejores ideas de las otras dos**, argumentando cada injerto.

> **COMPUERTA 1:** un diseño ganador, escrito, con las decisiones visuales justificadas una
> por una. Si ninguna propuesta supera 7/10 en las tres lentes, se repite la fase con los
> reparos como entrada.

---

## FASE 2 — IMPLEMENTACIÓN (pipeline; worktrees aislados donde haya escritura concurrente)

Cada agente: implementa **+ escribe su prueba + ejecuta su mutación** antes de entregar.
Un entregable sin mutación documentada **se rechaza sin leerlo**.

### C1 · Ventana de días (±7 hábiles + sábados reales + ocultar días sin agenda)
Reescribe `calcTargetDateRange` (o crea su sucesora sin romper a `calcDateRangeAroundIso`, que
usa laboratorio). Implementa D1 y D2 completos: sondeo por lotes, concurrencia limitada,
caché, render progresivo, cancelación, degradación.
**Pruebas mínimas:** 7 antes/7 después contando solo hábiles; el sábado con agenda aparece y
el sábado sin agenda no; los días sin agenda desaparecen; con 0 días disponibles hay mensaje
claro y ninguna pantalla vacía; la concurrencia nunca supera el tope; cancelar no escribe.

### C2 · Realce de la cita sugerida
Implementa el tratamiento ganador. El sugerido debe distinguirse por **al menos tres canales
simultáneos** (color + forma/tamaño + rótulo textual), nunca solo por color.
**Prueba:** el chip central sale con los tres marcadores y ningún otro los lleva.

### C3 · Lenguaje visual de las horas: cupos adicionales + primera mitad de jornada
Implementa **las dos familias de realce** con la misma maquinaria (D3-bis):

**(a) Cupos adicionales** 7:30 / 9:30 / 11:30 / 1:30 / 3:30 / 5:30. Detección vía
`normalizeHora` (D4), lenguaje visual propio y leyenda que explique qué son.
**Pruebas:** `01:30 PM` sí y `13:30` sí y `07:30 PM` **no**; `17:30` y `5:30 PM` sí; turno sin
hora no rompe nada; jornada de solo mañana no inventa cupos de tarde.

**(b) Primera mitad de la jornada** para el perfil diabético: AM 06:00–09:00, PM 13:00–16:00,
**calculada sobre los turnos reales del día**, nunca asumida. Color propio, distinto del de
los cupos adicionales, y **una hora preseleccionada como sugerida** dentro de ese rango.
**Pruebas:** día con solo jornada AM → recomienda dentro de 06:00–09:00 y no inventa tarde;
día con solo PM → 13:00–16:00; día con ambas → ambas franjas marcadas y la sugerida es una
sola; 09:00 dentro y 09:20 fuera (fijar el borde explícitamente); 16:00 dentro y 16:20 fuera;
día sin ningún turno en la franja → **no se inventa una recomendación**, se dice que no hay.

**Regla de colisión** (7:30 es adicional y además primera mitad): manda el realce del perfil;
la marca de «adicional» queda como información secundaria. **Prueba dedicada para esto.**

### C4 · Perfil del paciente y motor de recomendación
Implementa D3 + D3-bis con las cadenas que A3 haya confirmado. Dos piezas separables y
probables por unidad: `perfilPaciente(etiquetas)` (puro, sin DOM ni red) y
`recomendacionHorario(perfil, turnosDelDia)` (puro). El emparejamiento de cadenas **normaliza
tildes, mayúsculas y separadores** (lección de v12.6.8). Cero PHI en logs.

**Pruebas mínimas — los DOS EJES se prueban por separado, y la tabla de ejemplos resueltos
de D3-bis se convierte en una prueba por fila. Ninguna fila puede quedar sin cubrir.**

*Eje A (franja):*
- `["Diabetes"]`, `["HTA+DM"]`, `["HTA + DM"]`, `["hta/dm"]` → primera mitad.
- `["Hipertensión"]`, `["Nefroprotección"]`, `["Hipertensión","Nefroprotección"]` → sin preferencia.
- **`["Nefroprotección","Diabetes"]` y `["Nefroprotección","HTA+DM"]` → primera mitad.** Es la
  fila que el médico corrigió expresamente: la nefroprotección **no** anula la regla de la
  diabetes. Prueba obligatoria y con nombre explícito.

*Eje B (cupos adicionales):*
- `["Hipertensión"]` → ✅ único caso que los recomienda.
- Cualquier lista con diabetes → ❌. Cualquier lista con nefroprotección → ❌.
- **Independencia del orden:** `["Nefroprotección","Hipertensión"]` y `["Hipertensión","Nefroprotección"]` dan idéntico resultado en ambos ejes.

*Transversales:*
- `[]` / `null` / etiqueta desconocida → `SIN_ETIQUETA`: muestra todo, no recomienda, **no bloquea**.
- **Un fallo de red nunca degrada al perfil que MÁS permite.** Si la clasificación no se pudo
  obtener, el resultado es `SIN_ETIQUETA`, jamás «hipertenso apto»: sería ofrecerle un cupo
  adicional a un diabético por culpa de una petición caída.
- Cambiar `#vgl-agm-prog-sel` recalcula ambos ejes.
- Escasez: sin cupos normales en toda la ventana, los adicionales se ofrecen a cualquier perfil **rotulados como excepción**.
- Ninguna hora disponible queda deshabilitada en ningún perfil.

**Mutación obligatoria de este agente:** hacer que la nefroprotección anule la franja de la
diabetes (volver al modelo de escalera). Debe caer la prueba de `["Nefroprotección","Diabetes"]`.
Si sobrevive, esa prueba no existe de verdad.

### C6 · Atendido vs En sala en la lista del panel (D6)
**Es la única tarea que NO toca el modal de agendamiento**: vive en `render()` (~:11054) y en
el CSS de la tarjeta. Por eso puede ir primero — es la mejora que el médico ve el mismo día.

**Prohibido tocar `colorAndAlert`**: el eje de puntualidad/fraude se queda exactamente como
está. El eje 2 se deriva del `estado` en la capa de pintado, sin alterar la lógica de alertas.

**Pruebas mínimas:**
- Tarjeta con estado «En sala» → marcador de atención activo; «Atendido» → atenuado; ambos
  con su color de puntualidad **intacto**.
- **Un «Atendido» con fraude extemporáneo (color ROJO) NO queda atenuado hasta perderse**: la
  señal de fraude sigue dominando. Prueba con nombre explícito.
- Los botones de una tarjeta atenuada siguen presentes y con sus listeners.
- Un estado desconocido («Confirmada», «Reprogramada»…) no rompe nada y cae en neutro.
- La distinción **no depende solo del color** (verificar que exista un segundo canal).

**Mutación obligatoria:** hacer que «Atendido» y «En sala» vuelvan a producir el mismo
tratamiento. Debe caer la prueba de distinción.

### C5 · CSS y tokens
Todo el CSS nuevo. Verifica la trampa v12.6.6 (tokens en las cuatro listas). Claro y oscuro.
`prefers-reduced-motion`. Contraste AA verificado numéricamente, no a ojo.
**Prueba:** extiende la prueba estructural de `suite_06` si aparece cualquier overlay nuevo.

> **COMPUERTA 2:** `node tests/runner.js` en verde, con TODAS las pruebas nuevas y cada
> mutación documentada (qué se rompió, qué prueba cayó, restaurado y verde).

---

## FASE 3 — VERIFICACIÓN ADVERSARIAL (paralelo; todos intentan REFUTAR)

- **D1 · Cazador de invenciones.** Recorre el diff y exige, para **cada** selector, endpoint,
  parámetro, código CIE-10 y regla clínica, la evidencia que lo respalda. Sin cita → hallazgo bloqueante.
- **D2 · Auditor de PHI.** Diff, pruebas, commits, comentarios y salidas de consola. Un solo
  dato de paciente real → bloqueante.
- **D3 · Refutador de mutaciones.** Re-ejecuta cada mutación declarada y verifica que la
  prueba cae de verdad. Una mutación que sobrevive → la prueba es falsa y vuelve a Fase 2.
- **D4 · Verificador de regresión funcional.** Comprueba que lo intocable (D5) sigue idéntico:
  contrato de `AsignarTurno`, flujo de laboratorio, panel post-cita, SMS, órdenes PyM, telemetría.
- **D5 · Adversario de red.** Simula: API caída, respuesta lenta, día con varias agendas, cero
  días disponibles, cierre del modal a mitad del sondeo, cambio de especialidad durante la
  carga. Ninguno puede dejar al médico sin poder agendar ni pintar sobre nodos muertos.
- **D6 · Crítico de completitud.** «¿Qué falta? ¿Qué requisito del §2 no está? ¿Qué se afirmó
  sin verificar?» Lo que encuentre es la siguiente ronda de trabajo.

**Regla de votación:** cada hallazgo bloqueante lo revisan 3 refutadores independientes; con
2 de 3 confirmando, vuelve a Fase 2. Ante la duda, **se asume que el hallazgo es real**.

---

## FASE 4 — FUNCIONALIDADES NUEVAS (agente E1, en paralelo desde la Fase 1; NO implementa)

Propone mejoras con todo el contexto del proyecto: agenda, PyM, labs de Athenea, telemetría
real de uso, endpoints ya confirmados. **Cada propuesta necesita**: problema real que resuelve
(con evidencia de que existe), evidencia disponible vs. faltante, coste estimado, riesgo
clínico, y por qué es mejor que no hacerla. **Entrega un backlog priorizado, no código.**
Descarta explícitamente lo que suene bien pero no tenga evidencia.

Semillas para pensar (no son un mandato): abandono entre abrir el panel y crear la cita
—la telemetría ya lo mide—; cupos adicionales desaprovechados; pacientes que reaparecen sin
control agendado; labs vencidos vs. próxima cita; sábados infrautilizados; qué error del
tablero se repite en varios equipos.

---

## FASE 5 — SÍNTESIS Y ENTREGA (agente F1, secuencial)

1. Integra todo en `vigilante_agenda.user.js`, sube a **v13.0.0** (encabezado `@version` **y**
   la constante `VERSION` de respaldo — hay una prueba que las compara).
2. Bloque de changelog en el encabezado con el estilo del archivo: **qué se reportó, cuál era
   la causa real, qué se cambió y qué queda pendiente sin evidencia.**
3. Banco en verde con el conteo exacto.
4. Commit con mensaje que explique causa→efecto (no lista de archivos) + push a la rama.
5. Entrega el `.user.js` completo al médico, más:
   - Resumen de qué verá distinto en el panel, en su idioma.
   - El script de diagnóstico de A3, si quedó algo sin verificar, con instrucciones de un solo paso.
   - **Las preguntas abiertas, explícitas**, con lo que se asumió mientras tanto.
   - El backlog de E1.

---

# 4-bis. DECISIONES CERRADAS Y LA ÚNICA PREGUNTA QUE QUEDA

## Cerradas por el médico (12–13 ago 2026). NO se re-litigan, NO se vuelven a preguntar.

Cada una es una **decisión con prueba obligatoria**: si alguien la cambia sin que el médico lo
pida, tiene que caer una prueba con nombre explícito.

| # | Decisión | Consecuencia en el código |
|---|---|---|
| 1 | **Nefroprotección no tiene preferencia de horario propia.** Si además hay diabetes, aplican las reglas de la diabetes | Modelo de **dos ejes** (D3-bis), no escalera |
| 2 | **Un nefroprotegido diabético SÍ recibe la primera mitad** de la jornada | Prueba obligatoria de `["Nefroprotección","Diabetes"]` |
| 3 | **Los bordes van INCLUIDOS**: 09:00 está dentro de la franja AM y 16:00 dentro de la PM | Comparación `>=` / `<=`, con prueba de borde: 09:00 dentro · 09:20 fuera · 16:00 dentro · 16:20 fuera |
| 4 | **Se preselecciona la PRIMERA hora disponible** de la franja recomendada | Orden ascendente por hora normalizada, no por orden de llegada del API |
| 5 | **La excepción de escasez exige que no haya cupos normales en NINGÚN día** de la ventana completa | No basta con que falten en el día sugerido; se evalúa tras completar el sondeo de los ~16 días |

**Sobre la nº 5, una advertencia de implementación:** la condición depende del sondeo COMPLETO
de la ventana, que es asíncrono y progresivo (D2). Prohibido evaluarla con resultados
parciales — mostraría la excepción y la retiraría al llegar el resto, y el médico habría visto
un cupo ofrecido que desaparece. Se evalúa **una sola vez, con el sondeo terminado**, y hasta
entonces la excepción está apagada.

## La única pregunta abierta

1. **¿De dónde salen exactamente las etiquetas y con qué cadenas llegan?** Candidata
   confirmada en código: `programasPaciente[].descripcion` (:9094). Lo resuelve el script de
   diagnóstico del agente A3, que el médico corre una vez.
   *Mientras tanto:* el motor se construye y se prueba con las cadenas **como parámetro
   configurable**, y el comportamiento por defecto es `SIN_ETIQUETA`. Cuando lleguen las
   cadenas reales solo hay que rellenar una tabla — no rehacer nada.

**Protocolo si aparece una pregunta nueva:** no se inventa ni se omite. Se declara como
`{ pregunta, porQueImporta, queSeAsumioMientrasTanto, comoConfirmarlo }`, se sigue con el
resto, y todas llegan juntas al médico en la entrega.

---

# 5. DEFINICIÓN DE HECHO

- [ ] Los 10 puntos del §2 atendidos, o declarados como bloqueados con la razón y la pregunta.
- [ ] **Cada fila de la tabla de ejemplos resueltos de D3-bis tiene su prueba**, incluidas las combinadas.
- [ ] Los dos ejes probados por separado, y verificada la **independencia del orden** de las etiquetas.
- [ ] Mutación que devuelva el modelo a una escalera (nefroprotección anulando diabetes) tumbando su prueba.
- [ ] Ninguna hora disponible queda oculta o deshabilitada en ningún perfil.
- [ ] `node tests/runner.js` verde; ninguna prueba existente debilitada o borrada.
- [ ] Cada cambio con prueba nueva **y** mutación documentada que la tumba.
- [ ] Cero PHI, verificado por un agente dedicado.
- [ ] Cada selector/endpoint/regla clínica con evidencia citada; lo no confirmado, marcado.
- [ ] Nada fuera del alcance de D5 modificado.
- [ ] El médico nunca queda sin poder agendar, pase lo que pase con la red.
- [ ] Versión, changelog, commit, push y archivo entregado.

# 6. EJECUCIÓN EN OTRO ORQUESTADOR (Jules, Antigravity, el que sea)

Este brief es **agnóstico del modelo**: nada aquí depende de un proveedor. Lo que NO es
agnóstico son las compuertas. Si el orquestador que lo ejecute no las impone solo, **las impone
el humano**, o el brief se convierte en una sugerencia y el resultado en código sin verificar.

**Las cuatro compuertas son mecánicas — se comprueban sin discutir con nadie:**

1. `node tests/runner.js` sale en verde y con **más** comprobaciones que antes (677 al partir).
   Un banco que baja de número significa que alguien borró o debilitó una prueba: rechazar.
2. **Transcripción de mutación por cada cambio.** No vale «probado». Vale: qué línea se rompió,
   qué prueba cayó, con su nombre, y verde tras restaurar. Sin transcripción, el cambio no se
   revisa siquiera. *Un agente dirá que las pruebas pasan; lo que no puede fingir es una
   mutación que tumbe una prueba concreta.*
3. **Cada selector, endpoint y regla clínica cita su evidencia** (archivo de captura o línea
   del código actual). Sin cita, se saca del diff. Esta es la compuerta que protege pacientes:
   un modelo sin la historia de este proyecto inventará selectores plausibles con total
   naturalidad.
4. **Cero PHI** en diff, pruebas, commits y logs.

**Reparto por fases, si el trabajo se divide entre herramientas.** Las fases 0, 1 y 4
(reconocimiento, diseño, backlog) producen texto y maquetas: el error es visible y barato, y
son las más rentables para delegar. Las fases 2 y 3 tocan el userscript: ahí el arnés de
pruebas es la red de seguridad, no el modelo.

**Riesgo de fragmentación — el más probable en la práctica.** C1 a C5 tocan TODAS
`openAgendamientoModal` y la misma hoja de CSS. Ejecutarlas como tareas paralelas
independientes, cada una en su rama, produce cinco ramas que reescriben el mismo modal y un
merge imposible. **Ejecutarlas en serie sobre la misma rama**, o partir el archivo por función
antes de repartir. Esta advertencia vale más que cualquier optimización de coste.

---

# 7. PROTOCOLO ANTE LA DUDA

Si un agente no puede confirmar algo: **no lo inventa, no lo omite en silencio**. Lo declara en
su salida como `{ pregunta, porQueImporta, queSeAsumioMientrasTanto, comoConfirmarlo }` y sigue
con el resto. El orquestador acumula esas preguntas y **todas** llegan al médico en la entrega
final. Una pregunta bien hecha vale más que una suposición elegante — en este proyecto, una
suposición elegante ya escribió un resultado de laboratorio equivocado en una historia clínica.
