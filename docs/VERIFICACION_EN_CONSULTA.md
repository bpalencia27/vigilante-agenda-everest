# Lista de Verificación Previa al Uso en Consulta — Vigilante de Agenda v18.0.4

**Para:** Médico responsable de validar la nueva versión del asistente  
**Tiempo estimado:** 15 minutos  
**Cuándo usar este documento:** La primera vez que use una versión nueva, preferiblemente antes de la jornada de consulta o en un momento sin pacientes.

---

> **Importante:** Este proceso lo realiza el médico en su propio equipo, con Everest abierto, sin pacientes en consulta. Si cualquier punto de la lista no funciona como se describe, contacte a soporte técnico antes de usar el asistente en consulta real.

---

## ✅ Paso 1: Confirmar que la versión correcta está instalada (1 minuto)

1. Abra Google Chrome y navegue a Everest como lo hace normalmente.
2. Mire la esquina superior derecha del panel del Vigilante (el recuadro flotante que aparece sobre Everest).
3. Busque el número de versión. Debe leer: **v18.0.4**
4. Si el número es diferente, no continúe: el asistente no se actualizó correctamente. Contacte soporte técnico.

☐ La versión visible en el panel es **18.0.4**

---

## ✅ Paso 2: Verificar que el panel carga correctamente (2 minutos)

1. Espere 10 segundos después de que Everest termine de cargar.
2. Debe aparecer el panel del Vigilante con la lista de citas del día.
3. Las tarjetas de citas deben mostrar nombre del paciente, hora y estado de color (Verde, Azul, Ámbar, etc.).

☐ El panel aparece y muestra citas con sus colores de estado  
☐ No aparece ningún mensaje de error en rojo en la parte superior  
☐ No aparece aviso de «copias duplicadas» (si aparece, ver nota al pie*)

---

## ✅ Paso 3: Verificar la Ruta de Crónicos — Auto-Labs (5 minutos)

1. Abra la historia clínica de un paciente en la Ruta de Crónicos que tenga exámenes recientes en Athenea (idealmente con resultado de Creatinina o Glicemia).
2. Navegue a la sección de laboratorios de la Ruta.
3. Haga clic en el botón **«Auto-Labs»** (o similar) en el panel del Vigilante.
4. Espere 5 segundos mientras el asistente consulta Athenea.

**Lo que debe ocurrir:**
- Los resultados disponibles se deben escribir en sus casillas correspondientes.
- Las casillas que ya tenían un valor escrito por usted deben quedar intactas.
- Si algún examen estaba pendiente (no validado), no debe escribirse nada en esa casilla.

☐ Los resultados se escriben en las casillas correctas  
☐ Los valores ya escritos por el médico no se modificaron  
☐ No apareció ningún aviso de error rojo permanente  

---

## ✅ Paso 4: Verificar las alertas de la agenda (3 minutos)

1. Quédese en la pantalla principal de Everest con la agenda visible.
2. Espere a que el asistente termine de cargar (barra de estado sin actividad).
3. Verifique que las tarjetas de cita tienen el color correcto según el estado del paciente:
   - **Verde** = Paciente a tiempo o en sala
   - **Ámbar** = Paciente que no se ha presentado pasando la tolerancia
   - **Rojo** = Atención extemporánea (era ámbar y reapareció)
   - **Azul** = Normal / sin novedad

☐ Los colores de las tarjetas corresponden con los estados visibles en la agenda nativa de Everest

---

## ✅ Paso 5: Verificar el Kill-Switch y el estado del servicio (1 minuto)

1. En el panel del Vigilante, busque el icono de ajustes (⚙️) o la información de versión.
2. Confirme que NO aparece ningún aviso de «mantenimiento central» ni de «pausa remota».
3. Si aparece ese aviso, el equipo de coordinación médica activó el interruptor de emergencia. Contacte a coordinación.

☐ El asistente está activo (sin mensajes de pausa o mantenimiento)

---

## ✅ Paso 6: Prueba de apagado rápido (2 minutos)

Este paso verifica que puede apagar el asistente en caso de emergencia.

1. Haga clic en el ícono de **Tampermonkey** en la esquina superior derecha de Chrome.
2. Vea el interruptor al lado de «Vigilante de Agenda — Copiloto Everest PyM».
3. Haga clic en el interruptor para **apagarlo** (debe quedar gris).
4. Presione F5 para recargar Everest.
5. Confirme que el panel del Vigilante **desapareció** y Everest funciona en su modo normal.
6. Vuelva a encender el asistente en Tampermonkey y presione F5 para restaurar.

☐ El asistente se apagó al desactivarlo en Tampermonkey  
☐ Everest siguió funcionando normalmente sin el asistente  
☐ El asistente volvió al reactivarlo y recargar la página  

---

## ✅ Resumen — Criterios de aprobación

| Criterio | Estado |
|---|---|
| Versión 14.1.6 visible | ☐ |
| Panel carga con citas | ☐ |
| Auto-Labs funciona sin errores | ☐ |
| Colores de agenda correctos | ☐ |
| Sin aviso de pausa o mantenimiento | ☐ |
| Apagado de emergencia funciona | ☐ |

**Si todos los ítems están marcados:** El asistente está listo para uso en consulta.  
**Si algún ítem falla:** Contactar soporte técnico antes de usar en consulta con pacientes reales.

---

## 📞 Contactos de Soporte

- **Soporte técnico de sede:** Extensión de Sistemas
- **Coordinación Médica PyM:** Canal de chat institucional
- **Incidente crítico** (datos de paciente, error en historia clínica): Notificar de inmediato a Coordinación Médica y a Sistemas

---

*\* Si aparece aviso de «copias duplicadas instaladas»: Abra el Panel de Control de Tampermonkey → desactive y elimine la versión más antigua → recargue la página. El asistente debe quedar con una sola copia activa.*

---

*Documento generado durante el proceso de endurecimiento a producción RC v14.1.6 — Agosto 2026*
