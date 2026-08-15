# Protocolo de Recall Clínico y Trazabilidad — Vigilante de Agenda (v14.1.4)

## 1. Definición del Riesgo Clínico y Fronteras de Seguridad

El userscript *Vigilante de Agenda* asiste al profesional médico durante la atención clínica directa. Los riesgos clínicos potenciales asociados a la automatización sobre la historia clínica electrónica (*Everest EHR*) se clasifican en cuatro categorías críticas:

1. **Sobre-ordenamiento o Duplicación de Órdenes**: Prescripción redundante de paraclínicos o actividades de PyM que ya fueron ordenados recientemente o están vigentes, generando sobrecostos al sistema, incomodidad innecesaria al paciente y riesgo de glosa médica.
2. **Solapamiento o Cruce de Citas**: Asignación indebida de turnos en agendas ajenas o en horarios duplicados para un mismo paciente.
3. **Alertas No Advertidas o Falsas Alarmas de Fraude**: Desatención de pacientes extemporáneos o acusaciones erróneas por problemas de concurrencia o desbordamiento de medianoche.
4. **Contaminación Cruzada por Cambio de Paciente**: Inyección de paraclínicos del paciente anterior en la historia clínica del nuevo paciente si el médico cambia de pestaña en Everest mientras Athenea responde.

---

## 2. Salvaguardas Preventivas en Tiempo de Ejecución

### 2.1 Deduplicación Estricta de Órdenes Vigentes (`pymCubiertoPorOrdenVigente`)
- El script consulta el endpoint oficial `ObtenerOrdenamientoPorPacienteIdVigente` de Everest antes de sugerir o agregar órdenes.
- **Regla Todo o Nada en Actividades Multi-CUP**: Si una actividad exige múltiples códigos (ej. RCV Exprés requiere `903876` y `903026` para el índice RAC), la actividad solo se considera cubierta si **todos** los CUPS constituyentes cuentan con una orden vigente (`ordenes.every(...)`).
- **Control de Vigencia Temporal**: Las órdenes con fechas futuras o que superen los días de vigencia clínica (`dias > act.vigenciaDias`, típicamente 180 días en RCV o 90 días en RAC patológico) se consideran vencidas y reactivan la sugerencia.

### 2.2 Blindaje Anti-Cambio de Paciente en Vuelo (`_pacienteSigueAbierto`)
- Toda petición asíncrona a Athenea o a la API de Everest captura el `pacienteId` y el documento antes del envío.
- Al recibir la respuesta, `injectLabsIntoCronicos` y `calcularEstadioRenal` comprueban que el paciente visible en el DOM coincida exactamente con el paciente que originó la consulta. Si difieren, la inyección se cancela de inmediato y se emite un mensaje de seguridad:
  `[Vigilante] Auto-Labs ABORTADO: el paciente abierto cambió mientras Athenea respondía.`

### 2.3 Respeto a la Casilla del Médico
- El script inspecciona si el campo de texto en el formulario de Everest ya contiene caracteres digitados por el médico.
- Si la casilla no está vacía, no se sobrescribe. Si el médico borra deliberadamente un dato inyectado, tras dos intentos de restauración el script cesa cualquier modificación sobre dicho campo.

---

## 3. Arquitectura del Registro de Auditoría Local

Para garantizar la trazabilidad forense sin comprometer la privacidad del paciente (Cero PHI), el userscript implementa un subsistema de eventos locales:

- **Almacenamiento Diario Aislado**: Los eventos se registran en `localStorage` bajo la clave `vgl_ev_YYYY-MM-DD`.
- **Estructura del Evento**:
  ```json
  {
    "ts": 1723674938000,
    "tipo": "FRAUDE_EXTEMPORANEO",
    "det": { "key": "HASH_ID@08:00 AM", "color": "ROJO", "elapsed": 15.4 }
  }
  ```
- **Volcado Inmediato (`evFlush`)**: Los eventos de alto impacto clínico (como `FRAUDE_EXTEMPORANEO` o escrituras de órdenes) fuerzan la persistencia síncrona en `localStorage`.
- **Exportación Segura de Auditoría (`exportAudit(day)`)**:
  - Función pública que genera un archivo `.csv` formateado.
  - Incorpora Byte Order Mark UTF-8 (`\uFEFF`) y delimitador punto y coma (`;`) para compatibilidad directa con Microsoft Excel en español.
  - Escapado estricto de celdas (`csvCell`) para evitar inyección de fórmulas CSV (`=`, `+`, `-`, `@`).

---

## 4. Protocolo de Recall Clínico en 4 Fases

En caso de identificarse una anomalía operativa, error de inyección o discrepancia clínica en una jornada de atención, se aplica el siguiente protocolo estandarizado:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROTOCOLO DE RECALL CLÍNICO EN 4 FASES               │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ FASE 1: Detección y Extracción Forense                                │
 │ - El médico o auditor ejecuta exportAudit() desde la consola.         │
 │ - Se descarga vgl_ev_YYYY-MM-DD.csv y se revisan las marcas de tiempo.│
 └───────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ FASE 2: Conciliación de Discrepancias                                 │
 │ - Identificación del paciente afectado vía documento seudonimizado.  │
 │ - Cruce de órdenes generadas vs solicitud real en Everest.            │
 └───────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ FASE 3: Remediación Focalizada en EHR Everest                         │
 │ - Anulación manual de la orden médica duplicada en el módulo Órdenes. │
 │ - Corrección de paraclínicos en la historia clínica si hubo colisión. │
 │ - Liberación o reasignación del turno en el módulo Acceso.            │
 └───────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ FASE 4: Invalidación de Caché y Notificación                          │
 │ - Ejecución de _ordenesVigentesInvalidar() y _demograficosInvalidar().│
 │ - Registro del incidente en el informe de auditoría de la IPS.        │
 └───────────────────────────────────────────────────────────────────────┘
```

### Detalle de las Acciones de Remediación (Fase 3 y 4)
1. **Órdenes Duplicadas**: Ingresar a *Everest $\to$ Historia Clínica $\to$ Conducta $\to$ Órdenes Médicas*, seleccionar el registro generado por el script en el minuto identificado en el log y marcar "Anular / Cancelar Orden".
2. **Laboratorios Erróneos en Crónicos**: En *Ruta de Crónicos $\to$ Anamnesis*, corregir manualmente el valor y guardar la atención. La política "la casilla del médico es sagrada" garantiza que el script no volverá a pisar la corrección.
3. **Invalidación de Memoria Local**: Invocar en consola:
   ```javascript
   _ordenesVigentesInvalidar();
   _demograficosInvalidar();
   ```
   Esto asegura que consultas posteriores carguen el estado saneado directamente desde los servidores de Everest.
