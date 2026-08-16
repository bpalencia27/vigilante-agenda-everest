# Registro de Novedades Clínicas — Vigilante de Agenda (Copiloto Everest PyM)

Bienvenido al registro de actualizaciones del **Vigilante de Agenda**. Este documento detalla las mejoras, correcciones y salvaguardas asistenciales incorporadas en cada versión para garantizar la seguridad de sus pacientes y agilizar su jornada de consulta médica.

---

## [Versión 14.1.9] — 2026-08-15 (Versión Actual / Candidata a Producción)

### 🛡️ Seguridad Clínica y Protección del Paciente
- **Blindaje del Contrato de Interfaz Visual de Everest:** Mapeo exhaustivo de los 95 puntos de acoplamiento con Everest. Si el sistema de la IPS cambia de diseño o estilo visual, el script no falla silenciosamente ni genera datos erróneos: activa automáticamente el **Modo Seguro** (solo lectura) y le avisa con un banner visible.
- **Protección contra cruce de historias clínicas (Auto-Labs Seguro):** Si usted cambia de paciente en Everest mientras el laboratorio de Athenea está consultando resultados, el sistema cancela de inmediato la escritura. Esto evita que los exámenes del paciente anterior puedan registrarse por error en la historia clínica del paciente actual.
- **Separación estricta entre analitos de orina y sangre:** Los resultados de laboratorio procedentes de orina (como glucosa o proteínas en parcial de orina) ya no pueden insertarse bajo ninguna circunstancia en las casillas de sangre (glicemia sérica o proteínas en suero).
- **Límites biológicos oficiales de la IPS:** Integración de la tabla de 28 reglas de rangos y unidades oficiales para los 13 exámenes de la Ruta de Crónicos (Creatinina, Glicemia, HbA1c, Colesterol Total, HDL, LDL, Triglicéridos, RAC, PTH, Fósforo, Albúmina y Hemoglobina). Los resultados biológicamente imposibles no se escriben y se muestran en ámbar para verificación del médico.
- **Protección de la nota médica ("La casilla del médico es sagrada"):** Si usted ya escribió un dato en un campo de la historia clínica o decide borrar un valor sugerido por el asistente, el sistema respeta su decisión tras dos intentos y nunca volverá a sobrescribir su criterio.

### 💊 Auditoría Farmacológica e Interacciones Medicamentosas
- **Auditoría de Fórmulas Vigentes y Posfechados:** El asistente analiza los medicamentos activos del paciente leyendo directamente las órdenes de farmacia en Everest (`CargarMedicamentosPaciente`).
- **Ajuste de Dosis por Función Renal:** Alertas automáticas para medicamentos de riesgo nefrológico (Metformina, Espironolactona, IECA/ARA-II, Alopurinol) cuando la Tasa de Filtración Glomerular desciende por debajo de los umbrales seguros.
- **Detección de Interacciones Críticas:** Avisos discretos ante combinaciones de alto riesgo (ej. doble bloqueo del eje renina-angiotensina o combinación de ahorradores de potasio con insuficiencia renal).

### 🫘 Motor de Función Renal y Clasificación KDIGO
- **Cálculo exacto de TFG (Cockcroft-Gault y CKD-EPI 2021):** Estandarización de la TFG con el factor de corrección femenino oficial (0.85).
- **Estadificación KDIGO sin falsas alarmas:** Los estadios G1 a G5 cuentan con límites estrictos. En caso de que falte la creatinina o el peso, el sistema marca el estadio como "No calculable" y **jamás degrada erróneamente a G5** (Falla renal avanzada / diálisis).
- **Aviso de discrepancia clínica:** Si existe una diferencia marcada entre fórmulas renales (frecuente en pacientes con obesidad, amputaciones o desnutrición severa), el sistema le muestra una alerta preventiva sugiriendo correlación con el estado nutricional del paciente.

### 📅 Agenda, Detección de Fraude y Festivos de Colombia
- **Detección de Llegadas Tardías y Fraude:** Chip de colores estricto: Verde (a tiempo), Morado (pre-alerta o 3+ actividades PyM), Ámbar (sin presentarse / en lista de guardia) y Rojo (atención extemporánea). La marcación de "Atendido" consulta la lista de guardia para no pintar de verde a quien llegó fuera de tiempo.
- **Llave Única de Cita (`apptKey`):** La identificación de cada cita incluye la hora exacta, evitando falsas alarmas en pacientes con dos citas el mismo día.
- **Calendario nacional de festivos actualizado:** Integración completa de los 18 días festivos de Colombia (Ley Emiliani) para los años 2024 a 2027, garantizando que el cálculo de días hábiles para citas de control sea exacto.
- **Reinicio Automático de Día:** Limpieza automática de listas de guardia al cruzar la medianoche, evitando acusar a pacientes de la jornada anterior en pestañas dejadas abiertas.

### 👁️ Accesibilidad y Operación en Consultorio
- **Interruptor de Emergencia Local (`Ctrl + Shift + Q`):** Apagado instantáneo en menos de 1 segundo sin necesidad de internet.
- **Canario en Producción Ligero:** Verificación en segundo plano con costo computacional menor a 0.44 ms, garantizando fluidez en computadores de cualquier gama.
- **Convivencia fluida entre múltiples pestañas:** Si abre varias pestañas de Everest, el asistente coordina automáticamente las alertas y sonidos en la pestaña que esté usando en primer plano, evitando avisos duplicados.
- **Mayor contraste y tipografía WCAG AA:** Fuentes legibles de 14px a 16px con contraste adaptado para iluminación intensa de consultorio.

---

## [Versión 14.1.4] — 2026-08-14
- Incorporación de los 4 CUPS nefroprotectores automatizados en el modal de conducta médica.
- Visualización de signos vitales (PAS, PAD, IMC) en la tarjeta de riesgo cardiovascular.
- Inclusión del colesterol LDL en la vigilancia preventiva de pacientes crónicos.
- Generación de informe forense de auditoría exportable a Excel (`.csv`) con protección contra caracteres especiales.

---

## [Versión 12.4.0] — 2026-08-10
- Reorganización del panel lateral de actividades de Promoción y Mantenimiento de la Salud (PyM).
- Filtro inteligente de pacientes en sala de espera con detección de atenciones extemporáneas.
- Corrección en la lectura de órdenes vigentes para evitar la duplicación de exámenes ya autorizados.

---

## [Versión 12.3.19] — 2026-08-08 (Línea Base)
- Versión inicial estable del userscript para agendamiento, lectura de base PyM en SharePoint y visualización básica de estados de citas.
