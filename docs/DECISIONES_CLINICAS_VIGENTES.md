# Decisiones Clínicas y de Seguridad Vigentes

Este documento consolida las decisiones de dominio clínico, seguridad operativa y grounding normativo para `vigilante_agenda.user.js` y el ecosistema Copiloto RCV.

---

## 1. Origen y Fallback de `esDM2` (Diabetes Mellitus Tipo 2)

### Contexto Clínico
En la estadificación KDIGO y la Resolución 3280 / Tabla 50, la presencia de Diabetes Mellitus Tipo 2 (`esDM2`) acorta la periodicidad de seguimiento de analitos como la glicemia y la albuminuria (RAC) en estadios tempranos (G1/G2) a 90 o 180 días.

### Regla de Grounding y Origen en Everest
1. **Fuente Primaria (EHR)**: Código CIE-10 del diagnóstico principal o antecedentes en `BuscarPacienteDetallado` (`E110`–`E119` para DM2; `E100`–`E109` para DM1).
2. **Regla de Invariante ("Casilla vacía antes que dato inventado")**: Si el diagnóstico no está explícitamente registrado o el campo viene en `null`, `esDM2` se evalúa como `false`/`null`.
3. **Fallback Seguro**: Cuando `esDM2` es desconocido, el cálculo de vigencias se rige estrictamente por el estadio renal KDIGO (`estadio`) y el plazo estándar `RCV_VIGENCIA_DIAS` (180 días), sin asumir patología no documentada.

---

## 2. Calendario de Festivos de Colombia (Ley 51 de 1983)

### Marco Normativo
En Colombia, los días festivos se rigen por la **Ley 51 de 1983** (Ley Emiliani).
- **Festivos Inamovibles**: 1 de enero, 1 de mayo, 20 de julio, 7 de agosto, 8 de diciembre, 25 de diciembre.
- **Festivos Trasladables (Lunes siguiente)**: Reyes Magos, San José, San Pedro y San Pablo, Asunción de la Virgen, Día de la Raza, Todos los Santos, Independencia de Cartagena, Sagrado Corazón, Corpus Christi, Ascensión del Señor.

### Principio "CERO VENCIDOS"
- Si la fecha límite calculada para una toma de laboratorio cae en domingo o día festivo, `mtrRetrocederADiaHabil` **adelanta** la toma al día hábil anterior (viernes o sábado según la IPS), garantizando que el paciente nunca llegue a consulta con el examen vencido.

---

## 3. Seguridad de Credenciales y Protocolo Zero-PHI

1. **Aislamiento de Credenciales**: Las credenciales de API de Athenea / Everest residen únicamente en el almacenamiento seguro de Tampermonkey (`GM_setValue` / `GM_getValue`) en el navegador del médico y **jamás** se transmiten a servidores externos ni se registran en logs.
2. **Cero PHI en Telemetría y Código**: Todos los identificadores (`doc_id`, nombres) se anonimizan (`scrubPII` / `sanitizePII`) antes de cualquier reporte de telemetría de errores (`repQSave`).
3. **Conexiones de Red Declaradas**: Solo los dominios explícitamente autorizados en la cabecera `@connect` (servidores internos de la IPS y endpoints de Everest) pueden ser contactados.

---

## 4. Estado de los Componentes

| Módulo | Estado | Verificación |
|---|:---:|---|
| **Triaje 5 Colores** | ✅ Activo | 100% fiel a especificación (Verde, Morado, Ámbar, Rojo, Azul) |
| **Cálculo Renal (Cockcroft-Gault + CKD-EPI)** | ✅ Activo | Con validación de signos vitales (TA, IMC, Peso) y rangos clínicos |
| **Vigencias por Estadio (R2)** | ✅ Activo | Soporta `opts` dinámico con fallback seguro |
| **Detección de Obligatorias Vacías (`swRequerido`)** | ✅ Activo | Exclusivo sobre catálogo oficial, cero escrituras |
| **Cascada CSS Suite 25** | ✅ 15/15 | Cero colisiones, paridad de tokens, WCAG AAA |
