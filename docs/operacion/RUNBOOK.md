# Manual de Solución Rápida en Consulta (Runbook de 10 Fallos)

> **Guía para el Médico en Consultorio.**  
> Si experimenta un comportamiento inesperado durante la atención, busque el síntoma aquí.  
> **Formato directo:** Qué ve en pantalla → Qué significa → Qué hacer de inmediato → Cuándo llamar a soporte.

---

### Ficha 1: El botón "🧬 Auto-Labs" no escribe ningún resultado en Crónicos
- **Qué ve el médico:** Hace clic en el botón de Auto-Labs pero las casillas de colesterol, creatinina o glucosa quedan en blanco.
- **Qué significa:** La sesión en el sistema de laboratorios (Athenea) se cerró por inactividad o el paciente no tiene exámenes en los últimos 6 meses.
- **Qué hacer ahora:**
  1. En el panel lateral, haga clic en el botón **"🔑 Conectar Athenea"**.
  2. Si se abre una ventana pidiendo usuario y contraseña de laboratorio, ingréselos y haga clic en entrar.
  3. Vuelva a la historia clínica y presione el botón de Auto-Labs nuevamente.
- **Cuándo llamar a soporte:** Si tras iniciar sesión en Athenea el botón sigue sin responder en pacientes con exámenes confirmados.

---

### Ficha 2: El panel lateral tapa botones o campos de Everest
- **Qué ve el médico:** La barra lateral del asistente queda encima del botón de guardar de Everest o de una casilla de texto.
- **Qué significa:** La resolución de pantalla es pequeña o la ventana de Chrome no está maximizada.
- **Qué hacer ahora:**
  1. En la parte superior del panel, haga clic en la flecha **"◀ Ocultar"** (o presione `Ctrl + B`). El panel se replegará a una pequeña pestaña en el borde.
  2. También puede hacer clic sostenido en la barra superior del panel y arrastrarlo hacia la izquierda o hacia abajo.
- **Cuándo llamar a soporte:** Si el botón de ocultar no responde.

---

### Ficha 3: El computador se pone muy lento o se congela al cambiar de paciente
- **Qué ve el médico:** La pantalla tarda varios segundos en responder al hacer clic en las pestañas de Everest.
- **Qué significa:** Hay demasiadas pestañas de Everest abiertas al mismo tiempo en el computador.
- **Qué hacer ahora:**
  1. Cierre todas las pestañas viejas de Everest y deje abierta una sola pestaña activa.
  2. Presione la tecla **F5** para refrescar la página.
- **Cuándo llamar a soporte:** Si tras cerrar pestañas y reiniciar Chrome la lentitud persiste.

---

### Ficha 4: Las alertas de PyM (mamografía, citología, etc.) aparecen en blanco o dicen "Sin datos"
- **Qué ve el médico:** El paciente tiene actividades pendientes en el programa institucional pero el asistente no muestra ninguna sugerencia.
- **Qué significa:** El archivo de Excel de la jornada no se ha cargado hoy o la sesión con la nube institucional caducó.
- **Qué hacer ahora:**
  1. Abra el panel lateral y haga clic en **"⚙️ Ajustes"**.
  2. En la sección **"Base de Datos PyM"**, haga clic en **"Cargar Excel de la jornada"** y seleccione el archivo actualizado del día.
- **Cuándo llamar a soporte:** Si el archivo de Excel no se puede descargar de la carpeta compartida.

---

### Ficha 5: Los pacientes de la agenda no cambian de color (todos quedan en azul)
- **Qué ve el médico:** Los pacientes en sala de espera o retrasados no se pintan de verde, morado o ámbar.
- **Qué significa:** Everest actualizó la vista de la agenda o el filtro de visualización está mostrando citas de otro consultorio.
- **Qué hacer ahora:**
  1. Verifique que en Everest esté seleccionada su propia agenda médica y la fecha de hoy.
  2. Recargue la página con **F5**.
- **Cuándo llamar a soporte:** Si tras recargar los colores siguen apagados.

---

### Ficha 6: El asistente emite un sonido de alerta injustificado en un paciente puntual
- **Qué ve el médico:** Suena la alarma de atención retrasada con un paciente que acaba de llegar.
- **Qué significa:** El paciente tenía dos citas programadas el mismo día y la primera cita quedó sin atender.
- **Qué hacer ahora:**
  1. En el panel lateral, haga clic en la campanita para silenciar el aviso de esa cita.
- **Cuándo llamar a soporte:** Si la alarma se repite continuamente con todos los pacientes.

---

### Ficha 7: La casilla de Relación Albúmina/Creatinina (RAC) se borra sola
- **Qué ve el médico:** Escribe o inyecta el valor de RAC y al cambiar de pestaña en Crónicos la casilla aparece vacía.
- **Qué significa:** Everest tiene una regla automática que limpia la casilla si no se marca primero la opción de examen de orina.
- **Qué hacer ahora:**
  1. El asistente tiene un mecanismo de protección que restaura el valor automáticamente dos veces.
  2. Si persiste vacía, marque la opción **"SÍ"** en la pregunta *"¿Presenta Uroanálisis?"* y vuelva a escribir el valor.
- **Cuándo llamar a soporte:** Si la casilla se borra más de tres veces consecutivas.

---

### Ficha 8: Error al guardar la orden médica en Conducta ("Examen no disponible")
- **Qué ve el médico:** Al intentar agregar un laboratorio desde el asistente, aparece un aviso rojo de error en Everest.
- **Qué significa:** El código de examen (CUPS) no está habilitado para el contrato de la EPS del paciente o falta el diagnóstico CIE-10 principal.
- **Qué hacer ahora:**
  1. Verifique que la casilla de Diagnóstico Principal en Everest no esté vacía (ej. código I10 para hipertensión).
  2. Si el examen no aparece en la lista de Everest, agréguelo manualmente buscando el nombre genérico en el catálogo oficial.
- **Cuándo llamar a soporte:** Si ningún examen del paquete se puede ordenar.

---

### Ficha 9: La ventana de "🩺 Normalidad Fija" inyecta texto en casillas equivocadas
- **Qué ve el médico:** El texto del examen físico (ej. ruidos cardiacos) aparece en la casilla de abdomen.
- **Qué significa:** Everest cambió el orden de las casillas en la historia clínica.
- **Qué hacer ahora:**
  1. **DETENGA EL USO DEL BOTÓN DE NORMALIDAD FIJA.**
  2. Borre las casillas desalineadas y redacte el examen físico a mano.
  3. Presione `Ctrl + Shift + Q` para pausar el asistente y evitar inyecciones incorrectas.
- **Cuándo llamar a soporte:** **INMEDIATAMENTE.** Es un fallo de seguridad que requiere actualización del programa.

---

### Ficha 10: El asistente desapareció por completo y no se ve en pantalla
- **Qué ve el médico:** No aparece ningún botón, panel ni colores en Everest tras iniciar sesión.
- **Qué significa:** La extensión Tampermonkey está desactivada en Chrome o se activó el interruptor de apagado de emergencia.
- **Qué hacer ahora:**
  1. Mire la esquina superior derecha de Google Chrome. Si el icono de Tampermonkey está en gris o tiene un círculo rojo con una barra, haga clic en él y seleccione **"Habilitar"**.
  2. Si el icono está activo, presione `Ctrl + Shift + S` para abrir los ajustes y verificar si estaba pausado.
  3. Recargue Everest con **F5**.
- **Cuándo llamar a soporte:** Si la extensión no aparece en la barra de Chrome.
