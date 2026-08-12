# Informe de Fase 0 (Reconocimiento)

## A1 - Cartógrafo del modal (\`openAgendamientoModal\`)

\`\`\`json
{
  "funciones": [
    {"nombre": "openAgendamientoModal", "linea": 8858, "rol": "Punto de entrada. Construye el contenedor del modal #vgl-agendar-modal y lanza la inicialización."},
    {"nombre": "vivo", "linea": 9027, "rol": "Guarda de promesa huérfana. Evita pintar en un modal que ya fue cerrado por el usuario o al cambiar de contexto."},
    {"nombre": "closeMod", "linea": 9027, "rol": "Cierra el modal de agendamiento y detiene los renderizados asíncronos pendientes."},
    {"nombre": "calcDateRangeAroundIso", "linea": 8525, "rol": "Calcula un rango de fechas centrado en una fecha ISO específica (usado por el modal de laboratorios y agendamiento RCV)."},
    {"nombre": "calcTargetDateRange", "linea": 8481, "rol": "Calcula la ventana de chips (±3 días, excluyendo fines de semana)."},
    {"nombre": "calcBusinessTargetDate", "linea": 7903, "rol": "Calcula la fecha objetivo inicial ignorando fines de semana."},
    {"nombre": "renderDayChips", "linea": 9376, "rol": "Pinta la botonera superior con los días sugeridos (chips de ventana de fechas)."},
    {"nombre": "normalizeHora", "linea": 8209, "rol": "Normaliza la hora string recibida (AM/PM)."},
    {"nombre": "_cargarHorasToken", "linea": 9039, "rol": "Token de cancelación para evitar reescribir con respuestas obsoletas si se cambia rápido de especialidad o fecha."}
  ],
  "estado": [
    "Contexto del paciente cargado desde apt (documento, nombre, idPaciente).",
    "Listado de especialidades cargadas del endpoint ParEspecialidades/GetParEspecialidadList.",
    "Listado de programasPaciente (incluye id, descripcion, swProgramaEspecial).",
    "Especialidad seleccionada (defecto: medicina general o protección cardiovascular).",
    "Plazo (fecha sugerida para la cita)."
  ],
  "invariantes": [
    "No usar callbacks asíncronos si `!vivo()`. Todas las respuestas de API comprueban si el modal sigue abierto antes de inyectar HTML.",
    "Todo update de horas respeta un `_cargarHorasToken` incremental: si el token actual de la promesa no iguala al guardado, se descarta el resultado (cancelación obsoleta)."
  ],
  "puntosDeCorte": [
    {"donde": "calcTargetDateRange", "linea": 8481, "riesgo": "Cambiar esta función altera cuántos chips se pintan, pero no debe romper `calcDateRangeAroundIso` que usa el flujo de laboratorio y recibe sideCount dinámico."},
    {"donde": "renderDayChips", "linea": 9376, "riesgo": "Depende directamente de la respuesta devuelta por `calcTargetDateRange`. Si las fechas de fin de semana no se identifican con su propio endpoint, romperá las fechas sugeridas."},
    {"donde": "_cargarHorasToken", "linea": 9039, "riesgo": "Fundamental respetar este check de carrera en cualquier petición que inyecte resultados de agenda."}
  ],
  "cssRelevante": [
    "#vgl-agendar-modal (contenedor principal)",
    ".vgl-day-chip (estilos para los chips de fechas sugeridas)",
    ".vgl-day-chip.active (estado visual del día seleccionado)",
    "#vgl-agm-prog-box, #vgl-agm-prog-sel (selector de programas paciente)"
  ]
}
\`\`\`

## A2 - Arqueólogo de evidencia

\`\`\`json
{
  "endpoints": [
    {
      "url": "ParEspecialidades/GetParEspecialidadList",
      "metodo": "GET/POST",
      "respuesta": "Array de especialidades",
      "camposClave": ["Id", "Nombre"],
      "evidencia": "suite_05_api_everest.js y captura_agendamiento_oficial_*.json",
      "confianza": "confirmado"
    },
    {
      "url": "Acceso/BuscarCitasDisponibles",
      "metodo": "POST",
      "respuesta": "Array de Agendas disponibles",
      "camposClave": ["Id", "Fecha", "EspecialidadId", "Estado"],
      "evidencia": "captura_agendamiento_oficial_20260810.json y función apiAccesoBuscarCitasDisponibles",
      "confianza": "confirmado"
    },
    {
      "url": "Acceso/ObtenerTurnos",
      "metodo": "POST",
      "respuesta": "Array de turnos (horas) para una Agenda específica",
      "camposClave": ["Id", "Hora", "horaTexto", "hora"],
      "evidencia": "captura_agendamiento_oficial_20260810.json y función apiAccesoObtenerTurnos",
      "confianza": "confirmado"
    },
    {
      "url": "Paciente/BuscarPacienteDetallado",
      "metodo": "POST",
      "respuesta": "Objeto con datos del paciente, incluyendo programas",
      "camposClave": ["programasPaciente", "id", "descripcion", "swProgramaEspecial"],
      "evidencia": "Línea 9094 de vigilante_agenda.user.js y tests mock",
      "confianza": "confirmado"
    }
  ],
  "huecos": [
    "Las cadenas exactas del campo `descripcion` en `programasPaciente` (e.g., ¿'HTA+DM', 'Hipertensión'?) no están capturadas con evidencia real y deben confirmarse. Se creará un diagnóstico para esto."
  ]
}
\`\`\`

## A4 - Auditor de UX (Defectos y Métricas)

\`\`\`json
{
  "defectos": [
    {
      "sintoma": "La cita sugerida (el 'chip' central) apenas se nota.",
      "causa": "Solo recibe un símbolo 🎯 (emoji) y la clase .active que cambia sutilmente el color. No destaca visualmente en contraste sobre Everest.",
      "evidencia": "Defecto reportado por el médico, confirmado por la clase CSS .vgl-day-chip.active.",
      "severidad": "Alta (impacta UX de agendamiento rápido)"
    },
    {
      "sintoma": "Ambiguo para identificar los días SIN agenda o laborales en sábado.",
      "causa": "Los días calculados hoy son 'estáticos' (3 antes, 3 después, saltando 0/6 sábados/domingos). No muestran si realmente hay o no un hueco, ocultando disponibilidad potencial de fin de semana.",
      "evidencia": "Código estático en `calcTargetDateRange` que solo revisa `getDay() !== 0 && getDay() !== 6` sin verificar en la API.",
      "severidad": "Media (Pérdida de agendas reales)"
    },
    {
      "sintoma": "Los horarios adicionales no tienen un lenguaje visual separado.",
      "causa": "Todos los turnos recuperados se pintan con la misma clase genérica, sin priorizar el perfil clínico.",
      "evidencia": "Test de UI y queja en el encargo del médico.",
      "severidad": "Alta (No permite al médico diferenciar los cupos sugeridos en perfiles diabéticos o hipertensos)"
    }
  ],
  "metricas": {
    "abandono": "Diferencia alta entre `panel.agendar.abrir` y `cita.creada:12` (telemetría de uso)."
  },
  "criteriosDeExito": [
    "La tarjeta del día sugerido tiene más contraste y forma.",
    "El panel se escala o tiene scroll con concurrencia sin bloquear (ver `vivo()`).",
    "Cada tipo de cita o día sugerido tiene una etiqueta explícita (e.g., 'Primera mitad de la jornada', 'Adicional').",
    "Cumplir contraste AA WCAG."
  ]
}
\`\`\`
