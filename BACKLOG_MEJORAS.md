# Backlog de Mejoras Funcionales Priorizado (Fase 4 - Agente E1)

## 1. Detección Temprana de Abandonos (Abandono en Panel)
*   **Problema Real:** La telemetría `panel.agendar.abrir` frente a `cita.creada:12` muestra una tasa de abandono en pleno agendamiento. El médico invierte tiempo abriendo el modal pero no concreta la cita.
*   **Evidencia Existente:** Métrica de telemetría actual.
*   **Evidencia Faltante:** Es necesario capturar exactamente en qué sub-etapa el médico detiene el proceso (¿al ver la escasez de días? ¿al buscar especialidad?).
*   **Coste Estimado:** Bajo (Agregar eventos en `closeMod` para enviar a telemetría).
*   **Riesgo Clínico:** Ninguno.
*   **Por qué es mejor no ignorarlo:** Optimizar la oferta para retener la intención de cita disminuye huecos de seguimiento de RCV.

## 2. Visibilidad Inmediata de Labs Vencidos
*   **Problema Real:** El médico programa citas a "ciegas" sobre el estatus de los paraclínicos a menos que abra la tarjeta de laboratorios específicamente, provocando consultas sin base de estudio.
*   **Evidencia Existente:** Integración de Athenea `obtenerHcDataPrevRenalByPacienteId` verificada.
*   **Evidencia Faltante:** Fechas exactas de vigencia protocolaria que espera Everest.
*   **Coste Estimado:** Medio (requiere un banner/icono extra en el modal de agendamiento si hay labs > 90 días).
*   **Riesgo Clínico:** Bajo. Sólo promueve mayor revisión.

## 3. Optimización de Uso de Sábados
*   **Problema Real:** Sábados infrautilizados. Al ser turnos de rotación, pueden quedar descubiertos si no hay sugerencia explícita.
*   **Evidencia Existente:** `apiAccesoBuscarCitasDisponibles` responde si hay agenda en sábados.
*   **Evidencia Faltante:** Cuantificación actual del porcentaje de ocupación en sábados (telemetría futura).
*   **Coste Estimado:** Bajo (Dar peso visual adicional a los sábados descubiertos en la interfaz).
*   **Riesgo Clínico:** Ninguno.

## Funcionalidades Descartadas Explícitamente
*   **Auto-asignación al primer hueco disponible (Botón "Agendar Ya"):** Suena bien, pero la regla #3 "El médico manda" es innegociable. No se puede ocultar la decisión y quitar disponibilidad real.
*   **Cruce automatizado en Diagnóstico Renales:** Se sugiere pero no tiene evidencia firme. Dedicarse a deducir "Nefroprotección" basándonos en laboratorios viola explícitamente D3 (El perfil sale de la ETIQUETA, no de deducción).
