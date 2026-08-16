# Guía Rápida: Cómo Volver a la Versión Anterior (1 Página)

> **Para el médico o personal de soporte en consultorio.**  
> Si el asistente presenta fallas durante la consulta, siga estos **4 pasos sencillos**.  
> ⚠️ **REGLA DE ORO:** NUNCA copie y pegue texto en la ventana del asistente. Eso crearía dos programas funcionando al mismo tiempo y dañaría la información del paciente.

---

### Paso 1: Eliminar la versión con fallas (30 segundos)
1. En la esquina superior derecha de Google Chrome, haga clic en el icono negro de **Tampermonkey** (el cuadrado negro con dos círculos blancos).
2. Haga clic en **"Panel de control"**. Se abrirá una pestaña con la lista de programas instalados.
3. Busque la fila que dice **"Vigilante de Agenda Everest"**.
4. En el extremo derecho de esa fila, haga clic en el icono de la **Papelera de reciclaje** (o marque la casilla y pulse el botón *"Eliminar"* arriba).
5. En la ventana que pregunta *"¿Realmente desea eliminar este script?"*, haga clic en **Aceptar**.
   * *Resultado esperado:* La lista debe quedar vacía o sin el nombre del Vigilante.

---

### Paso 2: Instalar la versión anterior segura (30 segundos)
1. En esa misma pantalla de Tampermonkey, haga clic en la pestaña superior llamada **"Utilidades"** (al lado de *"Scripts instalados"*).
2. Busque la sección **"Importar desde archivo"** y haga clic en el botón gris **"Seleccionar archivo"** (o *"Elegir archivo"*).
3. Seleccione el archivo seguro que le entregó el soporte técnico (ejemplo: `vigilante_agenda_v14_estable.user.js`) y haga clic en **Abrir**.
4. Tampermonkey le mostrará una pantalla de confirmación con un botón verde que dice **"Instalar"** (o *"Reinstalar"*). Haga clic en **"Instalar"**.
   * *Resultado esperado:* Regresará a la lista principal y verá nuevamente el nombre *"Vigilante de Agenda Everest"* con el número de versión anterior.

---

### Paso 3: Probar que todo funciona (15 segundos)
1. Vuelva a la pestaña de Everest donde atiende a sus pacientes.
2. Presione la tecla **F5** (o el botón de recargar del navegador) para refrescar la pantalla.
3. Abra la agenda o una historia clínica de prueba.
   * *Resultado esperado:* El panel lateral del asistente reaparecerá en la esquina derecha funcionando con normalidad.

---

### Paso 4: Revisión Obligatoria de Historias Clínicas Ya Guardadas
> 🔴 **ADVERTENCIA CLÍNICA VITAL:**  
> Volver a la versión anterior en su computador **NO BORRA NI CORRIGE** los datos que el programa defectuoso ya guardó en Everest antes de ser apagado.

Si el asistente guardó datos incorrectos en algún paciente antes del cambio:
- **Es obligatorio ejecutar el protocolo de auditoría:** Consulte el documento [`docs/clinica/RECALL_CLINICO.md`](file:///e:/VA_reconciliacion/docs/clinica/RECALL_CLINICO.md) para verificar las historias clínicas de los pacientes atendidos en la jornada y corregir a mano cualquier dato discordante.
- Notifique inmediatamente al médico líder del servicio.
