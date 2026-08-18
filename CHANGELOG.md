# Registro de Novedades Clínicas — Vigilante de Agenda (Copiloto Everest PyM)

Bienvenido al registro de actualizaciones del **Vigilante de Agenda**. Este documento detalla las mejoras, correcciones y salvaguardas asistenciales incorporadas en cada versión para garantizar la seguridad de sus pacientes y agilizar su jornada de consulta.

---

## [Versión 14.1.6] — 2026-08-14 (Versión de Producción / Release Candidate)

### 🛡️ Seguridad Clínica y Protección del Paciente
- **Protección contra cruce de historias clínicas (Auto-Labs Seguro):** Si usted cambia de paciente en Everest mientras el laboratorio de Athenea está consultando resultados, el sistema cancela de inmediato la escritura. Esto evita que los exámenes del paciente anterior puedan registrarse por error en la historia clínica del paciente actual.
- **Separación estricta entre analitos de orina y sangre:** Los resultados de laboratorio procedentes de orina (como glucosa o proteínas en parcial de orina) ya no pueden insertarse bajo ninguna circunstancia en las casillas de sangre (glicemia sérica o proteínas en suero).
- **Límites biológicos de seguridad:** Se incorporaron rangos de plausibilidad médica para los 13 exámenes de la Ruta de Crónicos (Creatinina, Glicemia, HbA1c, Colesterol Total, HDL, LDL, Triglicéridos, RAC, PTH, Fósforo, Albúmina y Hemoglobina). Si un resultado recibido del laboratorio presenta valores biológicamente imposibles o unidades no estandarizadas, el sistema no lo escribe y le avisa para su revisión manual.
- **Protección de la nota médica ("La casilla del médico es sagrada"):** Si usted ya escribió un dato en un campo de la historia clínica o decide borrar un valor sugerido por el asistente, el sistema respeta su decisión tras dos intentos y nunca volverá a sobrescribir su criterio.

### 🫘 Motor de Función Renal y Clasificación KDIGO
- **Cálculo exacto de TFG (Cockcroft-Gault y CKD-EPI 2021):** Estandarización de la TFG con el factor de corrección femenino oficial (0.85).
- **Estadificación KDIGO sin falsas alarmas:** Los estadios G1 a G5 cuentan con límites estrictos. En caso de que falte la creatinina o el peso, el sistema marca el estadio como "No calculable" y **jamás degrada erróneamente a G5** (Falla renal avanzada / diálisis).
- **Aviso de discrepancia clínica:** Si existe una diferencia marcada entre fórmulas renales (frecuente en pacientes con obesidad, amputaciones o desnutrición severa), el sistema le muestra una alerta preventiva sugiriendo correlación con el estado nutricional del paciente.

### 📅 Agenda, Festivos de Colombia y Concurrencia
- **Calendario nacional de festivos actualizado:** Integración completa de los 18 días festivos de Colombia (Ley Emiliani) para los años 2024 a 2027, garantizando que el cálculo de días hábiles para citas de control sea exacto.
- **Aviso de cambio de año/festivos:** El sistema le notificará con 60 días de anticipación cuando el calendario de festivos esté próximo a renovarse.
- **Zona horaria fija (Colombia):** Corrección para evitar que equipos con reloj desajustado cambien de fecha a las 7:00 PM.
- **Convivencia fluida entre múltiples pestañas:** Si abre varias pestañas de Everest, el asistente coordina automáticamente las alertas y sonidos en la pestaña que esté usando en primer plano, evitando avisos duplicados o lentitud en el computador.
- **Detección de copia duplicada:** Si por error se activan dos versiones simultáneas en el navegador, el sistema avisa de forma comprensible para desactivar la versión previa y evitar duplicidad de sonidos.

### 👁️ Interfaz Asistencial y Comodidad Visual (Accesibilidad WCAG AA)
- **Tipografía médica más legible:** Textos aumentados a un tamaño base de 14px y títulos a 16px con mayor espacio entre líneas para reducir el cansancio visual durante jornadas continuas de 8 horas.
- **Mayor contraste en modo claro y oscuro:** Ajuste de colores en botones y tarjetas para garantizar una lectura nítida bajo cualquier tipo de iluminación en el consultorio.
- **Navegación ágil por teclado:** Soporte completo para abrir y cerrar ventanas con la tecla `Escape` y desplazarse mediante la tecla `Tab`. Al abrir el buscador de órdenes o laboratorios, el cursor se posiciona automáticamente en la casilla de texto.

### 🔒 Privacidad y Confidencialidad (Habeas Data)
- **Cero datos del paciente en el exterior:** Ningún nombre, número de cédula, teléfono ni diagnóstico médico sale de su navegador ni se envía a servidores externos.
- **Contraseñas protegidas:** Las credenciales de consulta a laboratorios se guardan de forma encriptada en la configuración local de su propio computador.
- **Interruptor central de seguridad (Kill-Switch):** Mecanismo remoto para que la coordinación médica pueda pausar el asistente en caso de mantenimientos institucionales en Everest sin afectar su consulta.

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
