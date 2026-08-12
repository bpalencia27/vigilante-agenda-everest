# Informe Fase 0 - Reconocimiento

## A1 · Cartógrafo del modal
### `openAgendamientoModal(apt)`

*   **Línea:** 6897
*   **Estado interno:**
    *   `selectedEspId`, `selectedEspName`: Especialidad seleccionada, default Medicina General.
    *   `selectedProgId`: Programa RCV seleccionado (ID de programa).
    *   `selectedDateInfo`: Fecha seleccionada (`{ iso, fmt }`).
    *   `pacienteIdAcceso`: ID interno del paciente en el sistema (requerido para buscar citas).
    *   `_cargarHorasToken`: Token de cancelación de concurrencia para la promesa de carga de horas.
*   **Orden de llamadas principal:**
    1. Crea y ancla modal `#vgl-agendar-modal` (destruyendo el previo si existe).
    2. Construye el DOM y lo inyecta vía `innerHTML`.
    3. `apiAccesoBuscarPaciente(apt.doc_id)`: Obtiene `pacienteIdAcceso`.
    4. `apiAccesoBuscarPacienteDetallado(pacienteIdAcceso)`: Obtiene los programas del paciente (`data.programasPaciente`).
    5. Renderiza los chips de programas disponibles filtrando por `swProgramaEspecial === true`.
    6. `renderDayChips`: Calcula la ventana de días (±3 hábiles) y los pinta en el DOM. Selecciona un "día objetivo".
    7. `_cargarHoras`: Se lanza para cargar las horas de `selectedDateInfo`.
*   **_cargarHoras(isoStr, fmtStr, manualToken):**
    1. Genera un `token` y verifica que sea igual a `_cargarHorasToken`. Si no lo es, cancela (cierre u otro click en progreso).
    2. Comprueba `vivo()` para asegurar que el modal sigue en el DOM antes de afectar la UI.
    3. `apiAccesoBuscarCitasDisponibles(pacienteIdAcceso, iso, espId)`: Busca las agendas abiertas del día.
    4. Extrae lista de agendas (`extractAgendasList`).
    5. Filtra por fecha estricta `String(a.fechaAgenda).trim() === fmtStr`.
    6. Filtra por Médico (`a.profesionalId` == `state.activeDoctor.id`).
    7. Escoge la primera agenda coincidente (o falla si no hay).
    8. `apiAccesoObtenerTurnos(agenda.agendaId, fmtStr, pacienteIdAcceso)`: Carga los turnos.
    9. Filtra los turnos `EstadoTexto === "Libre"`.
    10. Pinta los turnos con `normalizeHora()`.
*   **Invariantes:**
    *   `vivo()` / `closeMod()`: `vivo()` chequea que `#vgl-agendar-modal` siga en el DOM. Si se cierra el modal, la promesa debe abortar cualquier mutación a la UI.
    *   `_cargarHorasToken`: Un timestamp o contador que invalida respuestas en vuelo si el usuario hace click en otra fecha o especialidad antes de que vuelva la consulta anterior.
*   **Puntos de corte de diseño (riesgos para reescribir ventana de días):**
    *   `calcTargetDateRange(m, d)` (línea 8481): Asume y devuelve un array plano de objetos `{iso, fmt, dateObj}`. Los recorre de izquierda a derecha sin importar huecos de calendario, simplemente cuenta días.
    *   Al extender la ventana a ±7 días y sondear todos para ver si hay citas (incluyendo los sábados "laborales" que cambian por médico), si se esperan todas las respuestas de red, se bloqueará el renderizado, dejando un spinner largo.
*   **CSS Relevante:**
    *   El CSS del modal está al final de `buildOverlay()` (L5654). El modal se ancla a `document.body`, por lo que las clases deben respetar el modo oscuro/claro global (`#vgl-root.light`).
    *   Las horas se pintan con la clase `.vgl-agm-tbtn`.
    *   El día sugerido recibe `.active` en `.vgl-agm-dbtn`.

## A2 · Arqueólogo de evidencia
### `apiAccesoBuscarCitasDisponibles`
*   **URL:** `/apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles?PacienteId=...`
*   **Método:** POST (cuerpo `{}`)
*   **Respuesta (evidencia de `captura_agendamiento_oficial_20260810.json` / `suite_13_api_agenda.js`):** Devuelve objeto con `Data` o un Array anidado. `extractAgendasList(res)` lo estandariza.
*   **Campos clave de las agendas:** `fechaAgenda` (formato "DD/MM/YYYY"), `profesionalId`, `agendaId`, `CitasDisponibles` (entero).
*   **Huecos / Casos raros:** Un día sin agenda devuelve un objeto vacío, un Array vacío, o listas que NO coinciden en `fechaAgenda` (el backend de Everest tiene un bug comprobado v11.0.1 donde devuelve agendas de otros días, por lo que el script DEBE filtrar estrictamente por `String(a.fechaAgenda).trim() === selectedDateInfo.fmt`).
*   **Confianza:** `confirmado` (línea 6282).

### `apiAccesoObtenerTurnos`
*   **URL:** `/apiviva/APIAcceso/api/Acceso/ObtenerTurnos?AgendaId=...`
*   **Método:** POST
*   **Respuesta (evidencia de `suite_13_api_agenda.js`):** Lista de turnos.
*   **Campos clave de cada turno:** `hora` / `horaTexto` / `Hora` (hay variabilidad, por eso se usa `normalizeHora`), `EstadoTexto` (debe ser "Libre"), `TurnoId`.
*   **Confianza:** `confirmado` (línea 6308).

### `apiAccesoBuscarPacienteDetallado`
*   **URL:** `/apiviva/APIAcceso/api/Acceso/BuscarPacienteDetallado?PacienteId=...`
*   **Método:** GET o POST
*   **Respuesta (evidencia de `suite_13_api_agenda.js`):** Objeto con datos del paciente.
*   **Campos clave:** `programasPaciente` (Array). Cada elemento tiene `id`, `descripcion`, `swProgramaEspecial`.
*   **Confianza:** `confirmado` (línea 6344).

## A4 · Auditor de UX
*   **Síntomas de ambigüedad y confusión:**
    *   **Jerarquía de los días:** Actualmente, la ventana de ±3 días simplemente destaca el día central con `class="active"` y a veces un emoji 🎯. No grita visualmente "este es el día objetivo recomendado clínicamente" frente a los demás.
    *   **Contraste y Lenguaje Visual de las horas:** Los botones de horas son todos grises idénticos (`.vgl-agm-tbtn`). El médico no sabe a primera vista qué horas son "normales", cuáles son los "cupos adicionales" de 20 min que se otorgan a crónicos, y cuál es la franja recomendada si el paciente tiene diabetes/riesgo (e.g. primera mitad de jornada AM o PM).
    *   **Densidad de la información:** 3 días antes y 3 días después puede ocultar la disponibilidad real, requiriendo hacer clics ciegos a izquierda y derecha si no hay citas en ese rango corto. Obligar al médico a cazar citas de a poco.
    *   **Competencia Visual:** No hay separación visual si una hora es "Adicional (e.g., 7:30)", "Recomendada por Perfil (e.g., AM para diabéticos)", o "Normal". Necesitan 3 lenguajes visuales distintos para no pisarse.
*   **Criterios de éxito:**
    *   La ventana de ±7 días + sábados laborales debe cargar progresivamente (sin congelar la UI) y no mostrar días en los que se sepa que no hay agenda.
    *   El día sugerido debe destacarse por 3 canales: tamaño/forma, color, y rótulo textual (ej. "Día Objetivo").
    *   Las horas recomendadas deben estar pintadas de distinto color, y la primera de la franja debe estar preseleccionada y rotulada.
    *   Las horas adicionales deben estar demarcadas (ej. un borde, un ícono o etiqueta).
    *   Todo cambio debe cumplir WCAG AA en modos oscuro y claro.

---

*Nota de Compuerta 0: La estructura de las etiquetas exactas (ej. si dice "HTA+DM" o "HTA + DM") en `programasPaciente[].descripcion` no está confirmada textualmente en los archivos leídos. Se requiere que el Agente A3 genere el script de diagnóstico y que el médico envíe las cadenas exactas. Mientras tanto, se construirá un motor de emparejamiento con parámetros configurables y fallback a `SIN_ETIQUETA`.*
