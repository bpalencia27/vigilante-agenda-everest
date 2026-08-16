# Protocolo de Auditoría y Recall Clínico tras Incidente de Software

> **Documento de Seguridad del Paciente.**  
> **Destinatarios:** Médico tratante, Médico auditor de calidad y Dirección Médica de la IPS.  
> **Aplicación Obligatoria:** Siempre que se realice un rollback o se detecte una versión con fallos en la inyección de datos clínicos.

---

## 1. Principio Rector de Seguridad Clínica

El software es un asistente de apoyo; **la responsabilidad legal y clínica de la Historia Clínica recae exclusivamente en el médico que firma la atención.** 

Cuando se retira una versión defectuosa del userscript, el rollback solo previene fallas futuras en el computador local. **Cualquier dato ya inyectado y guardado en la base de datos de Everest permanece inalterado y requiere verificación médica manual.**

---

## 2. Procedimiento de Identificación de Pacientes Afectados

1. **Delimitar la Ventana Temporal del Incidente:**
   - Registrar la hora exacta en que se instaló la versión defectuosa y la hora en que se ejecutó el apagado/rollback.
2. **Listar los Pacientes Atendidos en la Ventana:**
   - En la vista de agenda de Everest, filtrar las citas con estado *"Atendido"* durante ese intervalo de tiempo.
3. **Extraer el Registro de Auditoría Local:**
   - Si el panel lateral aún es accesible, abrir *"Ajustes"* → *"Registro de Auditoría"* para descargar el historial de inyecciones realizadas durante el día.

---

## 3. Lista de Chequeo de Verificación Clínica por Paciente

Para cada paciente atendido durante la ventana del incidente, el médico tratante debe abrir la historia clínica en Everest y verificar punto por punto:

| Módulo Clínico | Qué Verificar | Acción Correctiva si hay Error |
|---|---|---|
| **Ruta de Crónicos (Laboratorios)** | Verificar que los 13 valores inyectados coincidan exactamente con el PDF oficial de Athenea y correspondan a la fecha de la toma real. | Editar la casilla en Everest con el valor real y guardar nota aclaratoria en la evolución. |
| **Relación Albúmina/Creatinina (RAC)** | Comprobar que no se haya borrado ni sobrescrito un valor previo válido del paciente. | Reingresar el valor del reporte oficial. |
| **Examen Físico (Revisión por Sistemas)** | Verificar que los textos de normalidad no se hayan desplazado entre sistemas (ej. auscultación en abdomen). | Corregir la descripción semiológica en el formulario. |
| **Órdenes Médicas (Conducta / CUPS)** | Verificar que no se hayan generado órdenes duplicadas o códigos erróneos para el diagnóstico del paciente. | Anular en Everest las órdenes médicas sobrantes. |
| **Fórmulas de Medicamentos** | Verificar que no se hayan modificado posfechados ni prescripciones vigentes. | Validar contra la fórmula física entregada al paciente. |

---

## 4. Registro y Cierre del Incidente

1. **Diligenciamiento del Acta de Seguridad:**
   - Registrar número de pacientes auditados, número de discordancias halladas y correcciones efectuadas.
2. **Notificación a Farmacia y Laboratorio:**
   - Si se anularon órdenes o fórmulas ya emitidas, notificar de inmediato a los servicios de apoyo para evitar despachos incorrectos.
3. **Cierre por Dirección Médica:**
   - Firma del reporte de recall clínico y archivo en la carpeta de auditoría médica de la IPS.
