# Lista de Verificación en Consulta (15 Minutos)

> **Protocolo de Validación en Vivo por el Médico Líder.**  
> **Cuándo realizarlo:** Antes de aprobar una nueva versión en el puesto canario o al iniciar el turno tras una actualización.  
> **Instrucciones:** Ejecute los 8 pasos en orden y marque **[ SÍ ]** o **[ NO ]** comparando contra el resultado esperado exacto.

---

| # | Paso y Acción Física en Consultorio | Resultado Esperado Exacto | Cumple |
|---|---|---|:---:|
| **1** | **Carga del Asistente y Número de Versión:**<br>Abra Everest en Google Chrome e inicie sesión con su usuario médico habitual. Observe el margen derecho de la pantalla. | Aparece el panel lateral del Vigilante. En la esquina superior derecha se lee claramente el número de versión esperado (ejemplo: `v14.1.9`) en texto gris nítido. | [ ] SÍ<br>[ ] NO |
| **2** | **Lectura de la Base PyM de la Jornada:**<br>Mire la tarjeta superior del panel lateral que dice *"Actividades PyM"*. | Muestra un número total de pacientes cargados (ejemplo: *"342 pacientes"*). No muestra avisos de error en rojo ni *"Base vacía"*. | [ ] SÍ<br>[ ] NO |
| **3** | **Colores y Tiempos en la Agenda del Día:**<br>Navegue al módulo de Agenda de Everest (`/viva/Acceso/`). Busque pacientes en sala de espera y pacientes atendidos. | Las tarjetas de pacientes en sala se pintan de **Verde** (a tiempo) o **Ámbar** (retrasado). Los atendidos se marcan en **Azul/Gris**. El tiempo de espera en minutos coincide con el reloj. | [ ] SÍ<br>[ ] NO |
| **4** | **Inyección de los 13 Laboratorios (Auto-Labs):**<br>Abra la historia clínica de un paciente de prueba conocido con exámenes recientes en Athenea. Vaya a la pestaña **Ruta de Crónicos (PES)** y haga clic en **"🧬 Auto-Labs"**. | Las casillas de Colesterol Total, HDL, LDL, Triglicéridos, Glicemia y Creatinina se rellenan con los valores numéricos exactos del laboratorio. Los campos de fecha muestran la fecha real de toma. Ninguna casilla queda con valores desfasados. | [ ] SÍ<br>[ ] NO |
| **5** | **Formulación de Exámenes en Conducta (CUPS):**<br>Vaya a la pestaña **Conducta**, abra la sección de Órdenes y seleccione un paquete del asistente (ej. *"Paquete HTA Anual"*). | Los exámenes seleccionados (Creatinina, RAC, Perfil Lipídico) se insertan en la tabla de órdenes de Everest con sus códigos oficiales. El botón *"Guardar"* de Everest queda habilitado. | [ ] SÍ<br>[ ] NO |
| **6** | **Agendamiento y Reserva de Citas:**<br>Desde el panel del asistente, busque disponibilidad para un control médico y seleccione un turno libre. | Se abre la ventana de confirmación de Everest con la fecha, hora y médico correctos. Al confirmar, el turno se reserva en la agenda institucional. | [ ] SÍ<br>[ ] NO |
| **7** | **Interruptor de Emergencia Local (Apagado Rápido):**<br>Presione la combinación de teclas `Ctrl + Shift + Q` (o haga clic en el botón *"🛑 Pausar"* en Ajustes). | El panel lateral y todos los colores de la agenda desaparecen de inmediato en menos de 1 segundo. Everest continúa funcionando normalmente sin interferencias. Al recargar con `F5`, permanece pausado hasta que el médico lo reactive. | [ ] SÍ<br>[ ] NO |
| **8** | **Accesibilidad y Convivencia Visual:**<br>Reactivar el panel. Recorra la historia clínica: pestaña de antecedentes, evolución y guardado general. | El panel lateral no cubre el botón *"Guardar Evolución"*, ni la barra de desplazamiento, ni las pestañas superiores de Everest. La visualización es fluida. | [ ] SÍ<br>[ ] NO |

---

### Veredicto de la Prueba de Consulta
- **Todos los puntos en [ SÍ ]:** Versión **APROBADA** para continuar la atención de la jornada.
- **Cualquier punto en [ NO ]:** Versión **RECHAZADA**. Ejecutar de inmediato el [Protocolo de Reversión](file:///e:/VA_reconciliacion/docs/operacion/ROLLBACK.md) y notificar al equipo técnico.

**Médico Evaluador:** _________________________________  
**Fecha y Hora:** ____ / ____ / ________  —  ____ : ____
