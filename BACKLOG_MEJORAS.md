# Backlog de Mejoras - Vigilante de Agenda

Este documento contiene las propuestas priorizadas para nuevas funcionalidades del Vigilante de Agenda. Cada propuesta se basa en el contexto clínico y técnico del proyecto (flujos de agenda, PyM, laboratorios de Athenea y telemetría de uso) y respeta las reglas de seguridad clínica del script (el médico decide, jamás se bloquea la interfaz, cero inventos sin evidencia).

---

## 1. Mitigación del abandono en el embudo de agendamiento
**El problema real:** La telemetría actual ya registra la apertura del modal (`uxTrack("panel.agendar.abrir")`) y la confirmación final de la cita (`uxTrack("cita.creada")`). Existe un riesgo latente de que un médico abra el panel, no encuentre un cupo adecuado a la primera, cierre el modal y el paciente termine la consulta sin su próximo control RCV agendado (reapareciendo meses después descompensado o por urgencias).
**Evidencia que ya existe:** Los eventos de telemetría base (`panel.agendar.abrir`, `cita.creada`, `cita.rechazada`, `cita.cupo_perdido`) ya existen y miden las acciones. El botón de agendar en la tarjeta de paciente cambia de estado cuando la cita está hecha.
**Evidencia que falta:** Extraer y analizar las métricas reales del servidor para cuantificar la **tasa de abandono** (% de aperturas sin creación). Adicionalmente, necesitamos encuestar a los médicos o analizar telemetría detallada para saber el porqué: ¿no hubo cupos (escasez)?, ¿se cerró por error?, ¿el paciente rechazó la fecha?
**Coste estimado:** Medio. Implica agregar un indicador visual persistente (ej. una insignia en la tarjeta del paciente o un recordatorio al cerrar la historia) para aquellos que iniciaron el flujo pero no tienen la cita creada en la sesión actual.
**Riesgo clínico:** Bajo (positivo). Asegurar que no se olvide el agendamiento del paciente crónico reduce el riesgo de inasistencias prolongadas.
**Por qué es mejor que no hacerla:** Si no intervenimos, los pacientes que sufren este abandono engrosan las estadísticas de falta de adherencia al tratamiento y sobrecargan al sistema a largo plazo.

## 2. Alerta temprana de citas RCV ineficaces por laboratorios vencidos
**El problema real:** Los pacientes acuden a su cita de control cardiovascular (RCV) sin los laboratorios requeridos vigentes (Colesterol, Glucosa, HbA1c, etc.). La cita ocurre, el médico no puede tomar decisiones clínicas (ej. titulación de insulina o estatinas) y el cupo se malgasta, requiriendo otra cita adicional.
**Evidencia que ya existe:** El Vigilante ya sabe leer los laboratorios faltantes mediante Athenea y dispara una alerta al abrir la historia (`checkLabsVencidos` / `labsVencidosAlert`).
**Evidencia que falta:** Se necesita una captura real de los endpoints de la agenda global del día para saber si el script puede cruzar a los pacientes citados "mañana" contra la base de laboratorios de Athenea *antes* de que el paciente llegue al consultorio.
**Coste estimado:** Alto. Requiere un barrido proactivo de los pacientes del día o del día siguiente, lo que implica múltiples llamadas a la API de Athenea. Se debe diseñar un mecanismo de lotes (batching) con caché agresiva para no tumbar la red de la clínica.
**Riesgo clínico:** Moderado. La alerta debe ser estrictamente informativa ("Paciente citado a las 8:00 no tiene HbA1c vigente") y sugerir al equipo administrativo contactar al paciente. Jamás debe cancelar automáticamente una cita, ya que el médico puede necesitar intervenir clínicamente sin los laboratorios.
**Por qué es mejor que no hacerla:** Optimiza drásticamente el valor de cada cupo de la agenda RCV, reduciendo las consultas no resolutivas.

## 3. Promoción proactiva de cupos adicionales y sábados infrautilizados
**El problema real:** Existen citas adicionales (7:30, 9:30) diseñadas para un perfil muy específico (hipertensos puros sin DM ni ERC) y sábados laborales. A menudo estos cupos quedan libres porque el médico tiene que buscar manualmente a los candidatos idóneos entre su panel.
**Evidencia que ya existe:** La arquitectura de la v13 (Fase 2) introduce el motor de recomendación de perfiles (`perfilPaciente`, `recomendacionHorario`) y el escaneo de días (incluyendo sábados confirmados por `BuscarCitasDisponibles`).
**Evidencia que falta:** Estadísticas de ocupación final de los cupos marcados como `agenda: "Adicional"` y la tasa de llenado de los sábados en comparación con los días hábiles ordinarios.
**Coste estimado:** Medio. Implica resaltar en el panel principal (fuera del modal de agendamiento) a los pacientes que encajan perfectamente en los cupos difíciles de llenar, sugiriendo al médico proactivamente: "Este paciente es candidato para los sábados/cupos adicionales libres".
**Riesgo clínico:** Bajo. Solo altera la prioridad visual de a quién agendar primero, sin bloquear el agendamiento del resto.
**Por qué es mejor que no hacerla:** Maximiza la ocupación de la agenda y asegura que los cupos especiales se asignen al perfil clínico correcto, mejorando la eficiencia del especialista.

---

## 🚫 Mejoras Descartadas (Ideas plausibles pero sin evidencia o inaceptables)

### ❌ Asignación automática de citas (Auto-agendamiento por perfil)
**El concepto:** Si conocemos el perfil del paciente (ej. diabético) y hay cupos libres en la primera mitad de la jornada, el script asume la cita recomendada y la reserva automáticamente para ahorrarle el clic al médico.
**Por qué se descarta:** Viola el principio fundamental del proyecto: **el médico manda, el script sugiere**. Automatizar la reserva elimina la negociación con la disponibilidad real del paciente. Además, un fallo en el API o en la red podría generar agendamientos fantasma masivos sin que el médico lo note. No hay evidencia de que el médico desee ceder este control final, y el riesgo clínico de crear citas falsas es prohibitivo.

### ❌ Inferencia de perfil clínico por ausencia de datos ("Sano por defecto")
**El concepto:** Si un paciente no tiene la etiqueta "Diabetes" o "Nefroprotección" en su lista de programas (`programasPaciente[]`), asumir de forma determinista que es un "Hipertenso puro" y ofrecerle los cupos adicionales.
**Por qué se descarta:** Va en contra de la regla de oro: **Casilla vacía antes que dato inventado**. La ausencia de una etiqueta puede deberse a que el paciente es nuevo, a un fallo de red en la carga, o a que el proceso administrativo está incompleto. Inferir un estado clínico de un silencio técnico podría llevar a ofrecer franjas horarias inapropiadas a pacientes graves. El estado debe ser explícitamente `SIN_ETIQUETA` y no debe habilitar reglas excluyentes.

### ❌ Cálculo predictivo matemático de los sábados laborales
**El concepto:** Usar una fórmula basada en el número de semana, si es par o impar, y el ID del médico para saber qué sábado le toca trabajar y mostrarlo en el modal sin necesidad de consultar la API de Everest.
**Por qué se descarta:** No existe evidencia de que la rotación se cumpla de forma matemáticamente perfecta. Las permutas entre médicos, los festivos, incapacidades y vacaciones romperían la fórmula de manera silenciosa, provocando que el script ofrezca al médico un sábado en el que realmente no tiene agenda. Ya se estableció (Decisión D1) que la única fuente de verdad es realizar una petición a la API `BuscarCitasDisponibles` por ese sábado concreto.
