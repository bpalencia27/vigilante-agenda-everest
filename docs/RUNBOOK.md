# Manual de Operación y Resolución de Incidentes en Consultorio (Runbook) — Vigilante de Agenda

**Dirigido a:** Médicos de Consulta Externa, Coordinación Médica PyM y Soporte Técnico de Sede  
**Versión:** 1.0.0 (RC v14.1.6)

---

## Matriz Rápida de Diagnóstico Asistencial

| # | Síntoma Observado por el Médico | Causa Raíz Probable | Nivel de Riesgo | Acción Rápida de Recuperación |
|---|---|---|---|---|
| **01** | El panel muestra *"Consultando turnos..."* indefinidamente o no carga las tarjetas de citas. | Congestión o caída temporal del API de agenda de Everest (`/apiviva/...`). | Bajo (Consulta no bloqueada) | Clic en el botón 🔄 **Actualizar Agenda** o presionar `F5`. Everest sigue funcionando normalmente. |
| **02** | Aparece un aviso superior ámbar: *"Modo sin conexión — Mostrando última agenda guardada"*. | Corte temporal de internet o enlace de red en el consultorio. | Bajo | Continuar la atención con las citas en memoria; el script reintenta solo al volver la red. |
| **03** | Una ventana emergente (modal de labs u órdenes) no cierra al hacer clic en la "X". | Pérdida de foco del navegador o conflicto con un menú desplegable de Everest. | Muy Bajo | Presionar la tecla **Escape (`Esc`)** en el teclado o el botón «Cerrar» inferior. |
| **04** | Al pulsar «Auto-Labs», un paraclínico reciente no se escribe en la historia clínica. | El resultado está "PENDIENTE" en Athenea o su nombre no coincide con la lista de 13 analitos. | Medio | Abrir el modal de laboratorios para ver el estado en Athenea. Si ya está validado, digitarlo manualmente. |
| **05** | La consola o el panel indican *"Pestaña en segundo plano (Modo pasivo)"*. | Múltiples pestañas de Everest abiertas simultáneamente en el mismo equipo. | Muy Bajo | Comportamiento normal. La pestaña que esté usando en pantalla toma el control activo. |
| **06** | Alerta visual: *"Hora del equipo desajustada por X minutos respecto al servidor"*. | El reloj de Windows de la estación local se desincronizó del servidor de dominio. | Medio | Notificar a Sistemas para sincronizar la hora de Windows. La agenda se ordena según la hora oficial. |
| **07** | Mensaje discreto en la barra inferior: *"Memoria local llena, optimizando..."*. | Cuota de almacenamiento del navegador alcanzada por acumulación de días previos. | Bajo | Ir a **Ajustes** ⚙️ $\to$ **Limpiar datos de días anteriores**, o el script lo purgará automáticamente. |
| **08** | Everest solicita usuario y contraseña repentinamente o muestra error de permisos. | Expiró la sesión institucional de Everest por inactividad. | Bajo | Ingresar credenciales institucionales en Everest. El asistente reanudará su monitoreo sin reiniciar Chrome. |
| **09** | Cartel de advertencia: *"Auto-Labs abortado: el paciente en pantalla cambió"*. | Se cambió de paciente en Everest mientras el laboratorio aún estaba respondiendo. | Alto (Salvaguarda activa) | Regla de seguridad cumplida. Volver a hacer clic en «Auto-Labs» estando en la historia correcta. |
| **10** | El panel muestra: *"Asistente en pausa preventiva por mantenimiento central"*. | La coordinación médica o soporte activó el Kill-Switch remoto por actualización. | Bajo (Informativo) | No requiere acción. Everest opera en su modo habitual. El asistente volverá al culminar el mantenimiento. |

---

## Procedimientos Detallados de Recuperación

### Escenario 01: Caída o Lentitud del API de Everest
- **Síntoma Clínico:** Las tarjetas de la agenda no aparecen o el botón de actualización gira indefinidamente.
- **Explicación Técnica:** El microservicio de agenda de Everest (`ApiTurno/GetCitas`) respondió con código HTTP 500/504 o excedió el tiempo límite de espera (timeout de 10 segundos).
- **Procedimiento de Recuperación:**
  1. No es necesario reiniciar el computador.
  2. Verifique si la lista nativa de citas de Everest (página principal de agenda) está cargando.
  3. En el panel del Vigilante, haga un solo clic en el botón 🔄 **Actualizar**.
  4. Si persiste la lentitud del servidor central, presione la tecla **F5** para refrescar la página.

### Escenario 02: Desconexión o Falla de Red Local
- **Síntoma Clínico:** Aparece una barra superior de color ámbar indicando *"Modo sin conexión"*.
- **Explicación Técnica:** El navegador no tiene acceso a la puerta de enlace predeterminada o la red de la IPS se encuentra caída.
- **Procedimiento de Recuperación:**
  1. El asistente entra en modo seguro de solo lectura y preserva las citas que ya habían sido descargadas al inicio de la jornada.
  2. El médico puede seguir atendiendo a los pacientes ya citados.
  3. Tan pronto el servicio de internet se restablezca, el script detectará el evento `online` y sincronizará la agenda en el siguiente minuto sin interrumpir la escritura médica.

### Escenario 03: Ventana Emergente Bloqueada o Sin Respuesta
- **Síntoma Clínico:** El médico intenta cerrar la ventana de agendamiento o de paraclínicos pero la pantalla queda en penumbra con el cuadro visible.
- **Explicación Técnica:** Un elemento select o diálogo modal nativo de Everest retuvo el foco de eventos de la ventana (`focus trap`).
- **Procedimiento de Recuperación:**
  1. Presione una vez la tecla **Escape (`Esc`)** en la esquina superior izquierda de su teclado.
  2. Si no responde, haga clic en el botón gris **«Cerrar»** ubicado en la esquina inferior derecha del modal.
  3. Si la ventana continúa fija, presione **F5** para recargar Everest. Todo dato previamente guardado en la historia clínica ya está asegurado en los servidores de Everest.

### Escenario 04: Discrepancia en Resultados de Laboratorio (Auto-Labs)
- **Síntoma Clínico:** El médico sabe que el paciente se tomó un examen de laboratorio (ej. Creatinina), pero al pulsar «Auto-Labs» la casilla correspondiente en la Ruta de Crónicos permanece vacía.
- **Explicación Técnica:** Pueden ocurrir tres situaciones:
  a) El resultado figura en Athenea como `idEstado = 1` ("PENDIENTE"), por lo que el script lo bloquea por seguridad para no inyectar datos no validados por bacteriología.
  b) El analito reportado proviene de orina (ej. Creatinuria) y fue rechazado por la guarda de sangre.
  c) La casilla en Everest ya contenía un valor digitado previamente y el script respetó la anotación del médico.
- **Procedimiento de Recuperación:**
  1. Abra el modal de paraclínicos haciendo clic en el botón **🧪 Ver Labs** en el panel.
  2. Revise la tabla: allí verá la fecha exacta, el valor y el estado del examen reportado por Athenea.
  3. Si el dato ya cuenta con validación médica y desea ingresarlo, digítelo directamente en el formulario de Everest.

### Escenario 05: Advertencia de Pestañas Múltiples Abiertas
- **Síntoma Clínico:** En el pie del panel aparece el mensaje *"Pestaña pasiva"*.
- **Explicación Técnica:** Para no saturar la red ni emitir sonidos duplicados en el consultorio, el script elige automáticamente una sola pestaña como "Líder" mediante `localStorage`.
- **Procedimiento de Recuperación:**
  1. No requiere ninguna intervención.
  2. La pestaña en la que el médico esté interactuando asumirá automáticamente el liderazgo.
  3. Como buena práctica de rendimiento, se recomienda cerrar pestañas de Everest de días anteriores.

### Escenario 06: Desincronización del Reloj Local (> 2 minutos)
- **Síntoma Clínico:** Alerta visual en la barra de estado indicando desfase horario.
- **Explicación Técnica:** La hora del sistema operativo Windows en la máquina del consultorio difiere en más de 120 segundos respecto a los servidores de Everest.
- **Procedimiento de Recuperación:**
  1. Las citas y los cálculos del script continúan operando de forma segura tomando como referencia la hora devuelta por los encabezados HTTP del servidor.
  2. Reporte a la mesa de ayuda de Sistemas indicando: *"Por favor resincronizar la hora del equipo con el servidor de dominio"*.

### Escenario 07: Almacenamiento Local Saturado (`QuotaExceededError`)
- **Síntoma Clínico:** Aparece el mensaje *"Optimizando almacenamiento local..."*.
- **Explicación Técnica:** El navegador Chrome asigna un límite de almacenamiento por sitio (`localStorage`), el cual puede llenarse si se acumulan meses de cachés de agenda no purgadas.
- **Procedimiento de Recuperación:**
  1. El script cuenta con un recolector automático que elimina registros con más de 7 días de antigüedad.
  2. Si desea forzar la limpieza inmediata: Panel del Vigilante $\to$ **Ajustes** (⚙️) $\to$ **Opciones técnicas** $\to$ **Limpiar caché histórica**.

### Escenario 08: Sesión de Everest Expirada
- **Síntoma Clínico:** Everest redirige a la pantalla de usuario/contraseña o muestra mensajes de *"Sesión no válida"*.
- **Explicación Técnica:** El token de seguridad JWT de Everest venció por inactividad prolongada (tiempo de espera institucional estándar).
- **Procedimiento de Recuperación:**
  1. Ingrese nuevamente su usuario y contraseña en el formulario de acceso de Everest.
  2. Al volver a la pantalla de historias clínicas, el Vigilante se reactivará solo sin necesidad de reinstalar ni recargar Tampermonkey.

### Escenario 09: Salvaguarda Anti-Cruce de Paciente Activada
- **Síntoma Clínico:** Alerta en pantalla: *"Inyección de laboratorios abortada: el paciente en pantalla cambió"*.
- **Explicación Técnica:** Mientras el script esperaba la respuesta del servidor de laboratorios para el Paciente A, el médico abrió la historia clínica del Paciente B. La función `_pacienteSigueAbierto` detectó el cambio de cédula y abortó la operación.
- **Procedimiento de Recuperación:**
  1. Esta es una salvaguarda clínica de protección.
  2. Verifique que el paciente en pantalla sea el que desea atender.
  3. Haga clic nuevamente en **«Auto-Labs»** para cargar los paraclínicos del paciente correcto.

### Escenario 10: Activación de Parada de Emergencia Remota (Kill-Switch)
- **Síntoma Clínico:** El panel del Vigilante queda oculto o muestra un aviso de *"Mantenimiento institucional activo"*.
- **Explicación Técnica:** La Coordinación Médica o el Administrador de TI activó la bandera de parada remota en el servidor central para aplicar cambios mayores en Everest.
- **Procedimiento de Recuperación:**
  1. Tranquilidad total: Everest sigue funcionando al 100% en su modalidad estándar nativa.
  2. El médico puede continuar su consulta sin ninguna interrupción.
  3. Cuando el equipo central desactive la parada, el Vigilante reanudará sus funciones automáticamente en la siguiente consulta.
