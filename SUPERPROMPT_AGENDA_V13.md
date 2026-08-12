# SUPER PROMPT — Orquestador de subagentes
## Refactorización visual del panel de agendamiento (Vigilante de Agenda v13.0.0)

> Pégalo completo como brief del orquestador. Está escrito para ejecutarse por fases con
> compuertas; ningún agente de una fase arranca sin el entregable de la anterior.

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
10. **Analizar qué funcionalidades útiles se podrían agregar** con todo lo que ya se conoce.

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

### D3-bis — Motor de recomendación por perfil: escalera de precedencia explícita
El módulo debe **encontrar la cita recomendada**, no filtrar la agenda. Un único componente
—llamémoslo `perfilPaciente(etiquetas)` → `recomendacionHorario(perfil, turnosDelDia)`—
resuelve los dos casos con la misma maquinaria.

**Escalera de precedencia** (se evalúa de arriba abajo; el primero que casa manda):

| # | Perfil | Etiquetas | Recomendación | Cupos adicionales (7:30…) |
|---|---|---|---|---|
| 1 | `NEFROPROTECCION` | contiene `nefroprotección` | **sin regla de horario definida — PREGUNTAR** | ❌ no se recomiendan (es enfermedad renal) |
| 2 | `DIABETICO` | contiene `diabetes` **o** `HTA+DM` | **primera mitad de la jornada** (AM 06:00–09:00 · PM 13:00–16:00), repintada, con una hora elegida como sugerida | ❌ no se recomiendan (tiene diabetes) |
| 3 | `HIPERTENSO` | contiene `hipertensión` y ninguna de las anteriores | horario normal | ✅ **se recomiendan** — es el perfil objetivo |
| 4 | `SIN_ETIQUETA` | ninguna reconocida | sin recomendación de perfil | ➖ visibles, sin recomendar |

Por qué en ese orden: `HTA+DM` casa con hipertensión **y** con diabetes a la vez; sin una
escalera explícita el resultado dependería del orden del arreglo, que es exactamente el tipo
de azar que produce un error clínico silencioso. La diabetes gana sobre la hipertensión
porque la instrucción del médico es explícita, y la nefroprotección gana sobre todo porque es
el único criterio que **excluye** los cupos adicionales por sí solo.

**Reglas de comportamiento, para los cuatro perfiles por igual:**
- **Nada se oculta ni se deshabilita.** Todas las horas disponibles siguen siendo elegibles.
- La recomendación es **realce + preselección**, y el médico puede cambiarla con un clic.
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

**Colisión de realces.** 7:30 es cupo adicional **y** cae dentro de 06:00–09:00. Como los
perfiles 1 y 2 no reciben recomendación de cupo adicional, la colisión casi no ocurre; pero
debe estar definida igual: **manda el realce del perfil** (primera mitad) y el cupo adicional
conserva su marca de «adicional» como información secundaria. Nunca dos realces compitiendo
por el mismo espacio visual.

### D4 — Las horas adicionales se detectan normalizando, no comparando cadenas.
7:30, 9:30, 11:30 son AM; 1:30, 3:30, 5:30 son **PM (13:30, 15:30, 17:30)**. La API entrega
`"07:30 AM"` / `"01:30 PM"` y a veces `hora`, `horaTexto` o `Hora`. **Reutilizar
`normalizeHora`**, que ya resuelve ese lío. Un `includes("7:30")` es motivo de rechazo:
casaría con `17:30` y con `07:30 PM`.

### D5 — Alcance cerrado.
**Se toca:** la ventana de días, el realce del sugerido, el filtrado de días sin agenda, el
lenguaje visual de los cupos, la clasificación de programa y el CSS del modal.
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

**Pruebas mínimas — la escalera de precedencia es el corazón de esto:**
- `["Hipertensión"]` → `HIPERTENSO` → recomienda cupos adicionales.
- `["HTA+DM"]` y `["HTA + DM"]` y `["hta/dm"]` → `DIABETICO` (no `HIPERTENSO`) → primera mitad, **sin** cupos adicionales.
- `["Diabetes"]` → `DIABETICO`.
- `["Hipertensión","Nefroprotección"]` → `NEFROPROTECCION` gana → **sin** cupos adicionales, aunque también sea hipertenso.
- `["Hipertensión","Diabetes"]` → `DIABETICO`.
- `[]` / `null` / etiqueta desconocida → `SIN_ETIQUETA`: muestra todo, no recomienda, **no bloquea**.
- **Una capa que falle en red nunca degrada a `HIPERTENSO`** (sería ofrecer un cupo adicional a un diabético por un fallo de red).
- Cambiar `#vgl-agm-prog-sel` recalcula la recomendación.
- Escasez: sin cupos normales en toda la ventana, los adicionales se ofrecen a cualquier perfil **rotulados como excepción**.
- Ninguna hora disponible queda deshabilitada en ningún perfil.

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

# 4-bis. PREGUNTAS ABIERTAS — NO SE RESPONDEN SOLAS

Estas quedaron sin definir al cerrar el encargo. El orquestador las lleva al médico **en la
primera entrega**, y mientras tanto se implementa el comportamiento seguro indicado. Ningún
agente puede resolverlas por su cuenta.

1. **`nefroprotección`: ¿qué horario se le recomienda?** Se sabe que **no** recibe los cupos
   adicionales (es enfermedad renal), pero no se dijo qué franja prefiere.
   *Mientras tanto:* horario normal, sin recomendación de franja, con la razón visible.
2. **¿Un nefroprotegido que además es diabético debe recibir la primera mitad de la jornada?**
   La escalera actual pone nefroprotección arriba, así que hoy **no** la recibiría.
   *Mientras tanto:* se sigue la escalera y se rotula el perfil compuesto para que se note.
3. **¿Las etiquetas vienen de `programasPaciente[].descripcion` o de otra fuente?** Y sobre
   todo, **¿con qué cadenas exactas?** Lo resuelve el diagnóstico de A3.
   *Mientras tanto:* motor construido con las cadenas como parámetro configurable.
4. **¿"Primera mitad" incluye el borde?** ¿Las 09:00 y las 16:00 están dentro o fuera?
   *Mientras tanto:* **inclusivo** (09:00 dentro, 09:20 fuera), fijado con prueba explícita
   para que cambiarlo sea un renglón.
5. **¿Cuál de las horas de la primera mitad se preselecciona** cuando hay varias libres — ¿la
   más temprana, la más cercana al día sugerido, la menos ocupada?
   *Mientras tanto:* la más temprana disponible, por ser la más predecible para el médico.
6. **La excepción de escasez** (ofrecer cupos adicionales a cualquiera): ¿se activa cuando no
   hay cupos en **ningún** día de la ventana, o basta con que no los haya en el día sugerido?
   *Mientras tanto:* ninguno en toda la ventana — el criterio más estricto.

---

# 5. DEFINICIÓN DE HECHO

- [ ] Los 10 puntos del §2 atendidos, o declarados como bloqueados con la razón y la pregunta.
- [ ] Los cuatro perfiles (`HIPERTENSO`, `DIABETICO`, `NEFROPROTECCION`, `SIN_ETIQUETA`) probados uno por uno, incluidos los compuestos.
- [ ] La escalera de precedencia cubierta con prueba por cada peldaño, y una mutación que la desordene tumbando una prueba.
- [ ] Ninguna hora disponible queda oculta o deshabilitada en ningún perfil.
- [ ] `node tests/runner.js` verde; ninguna prueba existente debilitada o borrada.
- [ ] Cada cambio con prueba nueva **y** mutación documentada que la tumba.
- [ ] Cero PHI, verificado por un agente dedicado.
- [ ] Cada selector/endpoint/regla clínica con evidencia citada; lo no confirmado, marcado.
- [ ] Nada fuera del alcance de D5 modificado.
- [ ] El médico nunca queda sin poder agendar, pase lo que pase con la red.
- [ ] Versión, changelog, commit, push y archivo entregado.

# 6. PROTOCOLO ANTE LA DUDA

Si un agente no puede confirmar algo: **no lo inventa, no lo omite en silencio**. Lo declara en
su salida como `{ pregunta, porQueImporta, queSeAsumioMientrasTanto, comoConfirmarlo }` y sigue
con el resto. El orquestador acumula esas preguntas y **todas** llegan al médico en la entrega
final. Una pregunta bien hecha vale más que una suposición elegante — en este proyecto, una
suposición elegante ya escribió un resultado de laboratorio equivocado en una historia clínica.
