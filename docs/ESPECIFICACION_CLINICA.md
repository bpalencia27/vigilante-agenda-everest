# Especificación Clínica y Frontera DOM — Vigilante de Agenda (v14.1.4)

## 1. Principios Clínicos No Negociables

El userscript *Vigilante de Agenda* es un asistente de consulta médica en tiempo real integrado sobre el EHR institucional (*Everest / Athenea Soluciones*). El sistema interactúa directamente con tres superficies críticas:

1. **Ruta de Crónicos (Formulario de Anamnesis y Laboratorios)**: Inyección de 13 analitos de laboratorio clínico.
2. **Órdenes Médicas (Conducta y Procedimientos PyM)**: Selección y estructuración de exámenes preventivos y de seguimiento (CUPS).
3. **Agendamiento (API AsignarTurno y Consulta Externa)**: Verificación de citas, estados de atención y control de tiempos.

Para garantizar la seguridad del paciente y la integridad de la historia clínica, se aplican los siguientes cuatro principios inviolables:

- **Casilla vacía antes que dato inventado**: Si un dato no se encuentra, está ambiguo o no cumple las reglas de validación biológica, la casilla permanece vacía o el cálculo devuelve "no calculable". Jamás se extrapola, adivina o completa por defecto.
- **La casilla del médico es sagrada**: El script nunca sobrescribe en silencio información que el profesional ya haya digitado o modificado. Si el médico borra un dato inyectado, tras dos intentos de restauración respetuosa el script cede el control permanentemente.
- **El script sugiere, el médico decide**: Ninguna orden médica, cita ni confirmación se ejecuta sin la intervención activa y consciente del médico tratante.
- **Cero Datos de Salud Protegidos (Zero PHI)**: Prohibición absoluta de registrar nombres, números de documento, diagnósticos o fechas de nacimiento en registros de auditoría, logs de consola, repositorios de código o telemetría.

---

## 2. Matriz de los 13 Laboratorios de Crónicos (Whitelist)

El motor de extracción e inyección de laboratorios procesa exclusivamente los 13 analitos aprobados en el protocolo clínico institucional de Riesgo Cardiovascular (RCV) y Enfermedad Renal Crónica (ERC). Todo analito recibido desde el LIS que no case formalmente con esta lista es descartado.

| # | Clave (`key`) | Nombres Canónicos / Alias Aceptados | Códigos LIS / CUPS | Campo Resultado DOM (`resultId` / `altIds`) | Campo Fecha DOM (`dateId` / `altDateIds`) | Exclusiones Léxicas (`excluye`) |
|---|---|---|---|---|---|---|
| 1 | `COLESTEROL_TOTAL` | `COLESTEROL TOTAL` | `2009`, `903818` | `resultadoColesterolTotal` | `fechaResultColesterolTotal` | — |
| 2 | `COLESTEROL_HDL` | `COLESTEROL HDL`, `COLESTEROL DE ALTA DENSIDAD` | `2015`, `903815` | `resultadoColesterolHDL` | `fechaResultColesterolHDL` | — |
| 3 | `COLESTEROL_LDL` | `COLESTEROL LDL`, `COLESTEROL DE BAJA DENSIDAD` | `2014`, `903817`, `903816` | `resultadoColesterolLDL` | `fechaResultColesterolLDL` | — |
| 4 | `TRIGLICERIDOS` | `TRIGLICERIDOS`, `TRIGLICÉRIDOS` | `2074`, `903868` | `resultadoTrigliceridos` | `fechaResultTrigliceridos` | Retirado 903866 (TGP/ALT) |
| 5 | `UROANALISIS` | `UROANALISIS`, `PARCIAL DE ORINA` | `2095`, `907106` | `resultadoUroanalisis` | `fechaResultUroanalisis` | Requiere subcomponentes |
| 6 | `GLUCOSA` | `GLUCOSA EN SUERO`, `GLICEMIA`, `GLICEMIA BASAL` | `2013`, `903841` | `resultadoGlicemia` | `fechaResultGlicemia` | Bloqueada glucosa urinaria |
| 7 | `RAC` | `RELACION MICROALBUMINURIA CREATININA`, `RELACION ALBUMINA/CREATININA`, `RELACIÓN ALBÚMINA/CREATININA` | `8779` | `resultadoRelacionAlbuminaCreatinina` (alt: `resultadoRAC`) | `fechaResultRelacionAlbuminaCreatinina` (alt: `fechaResultRAC`) | Retirados 2092, 2080, "MICROALBUMINURIA" |
| 8 | `CREATININA` | `CREATININA EN SUERO`, `CREATININA` | `2028`, `903895` | `resultadoCreatinina` | `fechaResultCreatinina` | `ORINA`, `CREATINURIA`, `DEPURAC`, `24 H` |
| 9 | `HBA1C` | `HBA1C`, `HEMOGLOBINA GLICOSILADA`, `HEMOGLOBINA GLICADA` | `2035`, `903843` | `resultadoHBA1C` | `fechaResultHBA1C` | Desambiguación DOM vs Hemoglobina |
| 10 | `PTH` | `PTH`, `HORMONA PARATIROIDEA`, `PARATOHORMONA` | `2065`, `904921` | `resultadoPTH` | `fechaResultPTH` | — |
| 11 | `FOSFORO` | `FOSFORO EN SUERO`, `FÓSFORO EN SUERO`, `FOSFORO INORGANICO` | `2031`, `903837` | `resultadoFosforo` | `fechaResultFosforo` | — |
| 12 | `ALBUMINA` | `ALBUMINA EN SUERO`, `ALBÚMINA EN SUERO` | `2002`, `903801` | `resultadoAlbumina` | `fechaResultAlbumina` | — |
| 13 | `HEMOGLOBINA` | `HEMOGLOBINA` | `2034`, `902207` | `resultadoHemoglobina` | `fechaResultHemoglobina` | Bloqueada hematuria / orina |

### 2.1 Jerarquía de Emparejamiento
1. **Jerarquía del Código**: Si el objeto contiene `codigo` o `CodigoParametro` coincidente con `codes`, casa de inmediato.
2. **Guarda de Orina (`_esAnalitoDeOrina`)**: Los analitos procedentes de orina (`NombreParametroPadre` contiene `ORINA`, `URINAR`, `UROAN` o nombres `GLUCOSURIA`, `PROTEINURIA`, `NITRITO`, `CILINDRO`, `ESTERASA LEUCOCITARIA`) están estrictamente bloqueados de casar con casillas séricas (Glicemia, Creatinina, Hemoglobina). Solo casan con `RAC` o `UROANALISIS`.
3. **Exclusiones Léxicas**: Expresiones como `DEPURACION DE CREATININA` o `CREATININURIA EN 24 HORAS` son rechazadas para `CREATININA`.
4. **Normalización Canónica**: Eliminación de tildes, signos de puntuación (`/`, `-`, `_`, `()`) y mayúsculas (`_canonNombreLab`).

---

## 3. Guardas de Plausibilidad Biológica y Validación de Unidades

Dado que el LIS institucional no siempre envía unidades estandarizadas, el script aplica rangos fisiológicos estrictos. Todo valor fuera del rango es rechazado (`analito_fuera_de_rango`) evitando falsas alarmas clínicas o clasificaciones erróneas.

| Analito | Unidad Estándar | Rango de Plausibilidad | Valores Extremos Patológicos Permitidos | Unidad Internacional Alternativa | Consecuencia Clínica si no se Valida Unidad |
|---|---|---|---|---|---|
| **Creatinina Sérica** | mg/dL | `0.1 – 20.0` | `15.0 – 18.0` (ERC Terminal) | µmol/L (`×88.4`) | `1.0 mg/dL` reportado como `88.4 µmol/L` reduce TFG 88 veces $\to$ falso G5 / diálisis. |
| **Glicemia Basal** | mg/dL | `10.0 – 2500.0` | `20` (shock) / `1200` (EHH) | mmol/L (`×18.018`) | `5.5 mmol/L` interpretado como `5.5 mg/dL` $\to$ falsa hipoglicemia mortal. |
| **HbA1c** | % (NGSP) | `3.0 – 25.0` | `18.0 – 22.0` % | mmol/mol (IFCC) | `53 mmol/mol` (7.0%) interpretado como `53%` sobrepasa el límite biológico. |
| **Colesterol Total** | mg/dL | `30.0 – 2000.0` | `800 – 1200` (HF) | mmol/L (`×38.67`) | `5.0 mmol/L` leído como `5.0 mg/dL` $\to$ falso colapso lipídico. |
| **Colesterol HDL** | mg/dL | `3.0 – 250.0` | `1 – 3` (Tangier) / `180` (CETP) | mmol/L (`×38.67`) | `1.2 mmol/L` leído como `1.2 mg/dL` $\to$ falsa hipoalfalipoproteinemia extrema. |
| **Colesterol LDL** | mg/dL | `5.0 – 1500.0` | `15` (PCSK9i) / `900` (HF) | mmol/L (`×38.67`) | `2.6 mmol/L` leído como `2.6 mg/dL` $\to$ valor falsamente indetectable. |
| **Triglicéridos** | mg/dL | `10.0 – 15000.0` | `3000 – 8000+` (Quilomicrones) | mmol/L (`×88.57`) | `2.0 mmol/L` leído como `2.0 mg/dL` $\to$ falsa apolipemia. |
| **RAC** | mg/g | `0.0 – 10000.0` | Micro `30–299`, Macro $\ge 300$ | mg/mmol (`×8.84`) | `15 mg/mmol` (132 mg/g) interpretado como `15 mg/g` relaja vigencia indebidamente. |
| **PTH Intacta** | pg/mL | `1.0 – 5000.0` | `1500 – 3000` (Hiperparatiroidismo) | pmol/L (`×9.43`) | `15 pmol/L` (141 pg/mL) leído como `15 pg/mL` encubre hiperparatiroidismo. |
| **Fósforo Sérico** | mg/dL | `0.3 – 22.0` | `10.0 – 16.0` (Lisis tumoral/ERC G5) | mmol/L (`×3.1`) | `2.0 mmol/L` (6.2 mg/dL) leído como `2.0 mg/dL` oculta hiperfosfatemia severa. |
| **Albúmina Sérica** | g/dL | `0.5 – 7.5` | `1.2 – 1.8` (Síndrome Nefrótico) | g/L (`×10`) | `35 g/L` interpretado como `35 g/dL` es bloqueado por la guarda de rango. |
| **Hemoglobina** | g/dL | `2.0 – 28.0` | `3.0` (aplasia) / `22.0` (poliglobulia) | g/L (`×10`) | `140 g/L` interpretado como `140 g/dL` es bloqueado por la guarda de rango. |

---

## 4. Motor de Función Renal (Cockcroft-Gault y KDIGO)

### 4.1 Fórmulas Matemáticas y Centinela
- **Cockcroft-Gault (TFG en mL/min)**:
  $$\text{TFG}_{\text{CG}} = \frac{(140 - \text{edad}) \times \text{peso}}{72 \times \text{creatinina}} \times (\text{si Femenino: } 0.85)$$
  - *Reglas de frontera*: Válido únicamente para $\text{edad} \in [18, 120]$ años, $\text{peso} \in [20, 300]$ kg, $\text{creatinina} \in [0.1, 20.0]$ mg/dL. En pacientes pediátricos ($<18$ años) o entradas fuera de rango retorna centinela `0` ("no evaluable").
- **CKD-EPI 2021 (TFG en mL/min/1.73 m²)**:
  $$\text{TFG}_{\text{CKD-EPI}} = 142 \times \min\left(\frac{\text{Cr}}{\kappa}, 1\right)^\alpha \times \max\left(\frac{\text{Cr}}{\kappa}, 1\right)^{-1.200} \times 0.9938^{\text{edad}} \times (\text{si Femenino: } 1.012)$$
  - Femenino: $\kappa = 0.7$, $\alpha = -0.241$.
  - Masculino: $\kappa = 0.9$, $\alpha = -0.302$.
  - Mismas restricciones de rango biológico ($\text{edad} \in [18, 120]$, $\text{Cr} \in [0.1, 20.0]$).

### 4.2 Clasificación KDIGO y Protección Anti-Degradación
$$\text{Estadios KDIGO}: \quad G1 \ge 90, \quad G2 \in [60, 89], \quad G3a \in [45, 59], \quad G3b \in [30, 44], \quad G4 \in [15, 29], \quad G5 < 15$$
- **Guarda Crítica**: Si la entrada es centinela `0`, `null`, `undefined`, `NaN` o $\le 0$, `estadioKDIGO` retorna `null`. **Nunca retorna G5**.
- **Discordancia Renal**: Si $|\text{Pos}(CG) - \text{Pos}(CKD-EPI)| > 2$, se activa aviso de discordancia clínica (común en sarcopenia, obesidad o amputaciones).
- **Sexo Ausente**: No bloquea el cálculo, asume factor masculino ($1.0$) y emite advertencia explícita: `"⚠ Sin sexo registrado: en una mujer, esto sobreestima la TFG en un 15 %."`

---

## 5. Días Festivos Colombianos y Zona Horaria

### 5.1 Calendario Nacional (Ley Emiliani — Ley 51 de 1983)
El script incorpora el cálculo determinístico de los 18 días festivos anuales de Colombia para los años 2024, 2025, 2026 y 2027:
- **6 Inamovibles**: 1 de enero, 1 de mayo, 20 de julio, 7 de agosto, 8 de diciembre, 25 de diciembre.
- **7 Trasladables al siguiente lunes**: 6 de enero (Reyes Magos), 19 de marzo (San José), 29 de junio (San Pedro y San Pablo), 15 de agosto (Asunción), 12 de octubre (Día de la Raza), 1 de noviembre (Todos los Santos), 11 de noviembre (Independencia de Cartagena).
- **5 Relativos a la Pascua (Computus / Meeus)**: Jueves Santo (Pascua - 3), Viernes Santo (Pascua - 2), Ascensión del Señor (Pascua + 43), Corpus Christi (Pascua + 64), Sagrado Corazón de Jesús (Pascua + 71).
- *Solapamiento 2025*: El 30 de junio de 2025 coinciden el traslado de San Pedro y San Pablo con el Sagrado Corazón (17 fechas calendario únicas, 18 festivos de ley).

### 5.2 Zona Horaria `America/Bogota` (UTC-5)
- Todas las marcas de fecha (`todayStamp()`) se generan obligatoriamente utilizando `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` para evitar desbordamientos de día a las 19:00 COT (00:00 UTC) en terminales mal configuradas o escritorios virtuales.
- Prohibición absoluta de constructores vulnerables a la zona horaria como `new Date("YYYY-MM-DD")`.

---

## 6. Máquina de Estados de la Agenda y Detección de Fraude

### 6.1 Estados y Tiempos de Tolerancia
- Tolerancia de gracia: `CONFIG.TOLERANCIA_MIN` (defecto 6.0 min). Pre-alerta: $\max(1.0, \text{gracia} - 1.0) = 5.0$ min.
- **`AZUL`**: Cita normal a tiempo o temprana.
- **`MORADO`**: Pre-alerta de tiempo ($\ge 5.0$ min y $< 6.0$ min) o $\ge 3$ actividades PyM pendientes.
- **`AMBAR`**: Paciente en `Sin presentarse` con retraso $\ge 6.0$ min. Se añade la clave a `state.fraudWatch`.
- **`ROJO` (Atención Extemporánea / Sospecha de Fraude)**: El paciente estuvo en `state.fraudWatch` y cambia su estado a `En Sala` o `Atendido`.
  - El sonido de alerta es **estrictamente de flanco (edge-triggered)**: suena una única vez y se registra la clave en `state.alertedFraud`.
- **`VERDE`**: Llegada puntual confirmada a `En Sala` o `Atendido` sin haber pasado por `fraudWatch`.

### 6.2 Clave Única de Cita (`apptKey`) y Cambio de Día (`diaNuevo()`)
- $\text{apptKey} = \text{doc\_id} + \text{"@"} + \text{hora\_texto}$. Permite distinguir pacientes con múltiples citas el mismo día (sobrecupos o consultas dobles).
- A medianoche (`todayStamp() !== diaActual`), `diaNuevo()` purga completamente `fraudWatch`, `alertedFraud`, `warnedTimes`, `historical` y la siembra local. Ningún paciente ausente de ayer es acusado hoy.

---

## 7. Contrato DOM Contextual por Sexo y Programa (`CONTRATO_DOM`)

### 7.1 Variación Contextual de Formularios en Everest
El formulario de consulta de la Ruta de Crónicos de Everest / Athenea Soluciones no posee una estructura estática uniforme; se renderiza dinámicamente según el sexo biológico del paciente y los programas de gestión del riesgo activos:

1. **Formulario Masculino (111 Campos)**:
   - Contiene la matriz de 13 laboratorios, signos vitales, antropometría, estratificación RCV y antecedentes patológicos generales.
   - *Fixture de prueba congelado*: `tests/fixtures/dom_everest_cronicos_hombre.html`.

2. **Formulario Femenino (160 Campos)**:
   - Contiene todos los campos del formulario masculino más el módulo especializado **Gineco-Obstétrico y PyM Femenino** (49 campos adicionales: FUR, gravidez, paridad, cesáreas, abortos, método anticonceptivo, fecha/resultado de citología vaginal y fecha/resultado de mamografía bilateral).
   - *Fixture de prueba congelado*: `tests/fixtures/dom_everest_cronicos_mujer.html`.

3. **Submódulos Específicos por Programa (HTA / DM2 / ERC)**:
   - Cada programa habilita secciones contextuales (órganos blanco, tamizaje de pie diabético, fondo de ojo, RAC, depuración de creatinina).

### 7.2 Protección de Modo Seguro (`MODO_SEGURO`)
- La verificación previa del DOM discrimina los campos según el contexto del paciente activo.
- Un campo no aplicable por contexto (ej. FUR o Mamografía en un paciente masculino) **no debe disparar falsos positivos** de fallo estructural ni activar indebidamente el Modo Seguro.
- Principio de Todo-o-Nada: La inyección de laboratorios para un paciente solo se ejecuta si el contrato DOM para su sexo y programa específico se valida satisfactoriamente.

---

## 8. Validación de Unidades, Rangos y Endpoints Oficiales de Everest

### 8.1 Endpoint Oficial de Parametrización y Validación de Exámenes
- **Endpoint**: `GET /apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos?citaId=`
- **Función Clínica**: Devuelve la configuración oficial de la IPS y la aseguradora para la validación de exámenes de crónicos asociados a la cita médica activa:
  1. **Unidad Declarada**: Resuelve formalmente discrepancias analíticas entre unidades estándar e internacionales (ej. $\text{mg/g}$ vs $\text{mg/mmol}$ para RAC, $\text{mg/dL}$ vs $\mu\text{mol/L}$ para creatinina).
  2. **Rangos Biológicos Parametrizados**: Especifica los límites de referencia superior e inferior ajustados por sexo y grupo etario.
  3. **Mensajes y Alertas Institucionales**: Provee las advertencias clínicas normativas requeridas para la historia clínica.

### 8.2 Endpoint de Paquetes de Programas CUPS
- **Endpoint**: `GET /apiviva/ApiOrdenamientoHealth/api/Combo/ObtenerPaqueteProgramasCupsByCitaId?citaID=&paqueteProgramaId=`
- **Función Clínica**: Segunda fuente autoritativa en tiempo real para verificar los paquetes de procedimientos CUPS parametrizados por programa (RCV, DM2, ERC, PyM) correspondientes a la cita actual del paciente.

---

## 9. Tratamiento Clínico de Antecedentes Patológicos (`AntecedentePatologicos.*`)

### 9.1 Invariante de Inicialización en Everest
En el EHR institucional Everest, las casillas y selectores del grupo `AntecedentePatologicos.*` (HTA, DM2, ERC, Dislipidemia, Tabaquismo, etc.) vienen pre-marcados por defecto en el valor **"NO"** al abrir un nuevo formulario de historia clínica.

### 9.2 Regla Clínica de No Descarte Activo
- **Prohibición de Asunción Clínica**: El valor por defecto `"NO"` **NO representa un descarte clínico activo, consciente ni explícito** por parte del médico tratante.
- El asistente clínico jamás interpretará las casillas en `"NO"` predeterminado como confirmación de ausencia de patología ni utilizará dicho valor para apagar o suprimir alertas de Promoción y Mantenimiento (PyM), alertas renales o recordatorios de tamizaje.
