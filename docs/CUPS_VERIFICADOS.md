# Inventario y Verificación Normativa de Códigos CUPS y LIS — Vigilante de Agenda (v14.1.4)

## 1. Marco Normativo y Jerarquía de Confianza

Los códigos de procedimientos de laboratorio clínico y actividades de Promoción y Mantenimiento de la Salud (PyM) utilizados en *Vigilante de Agenda* están rigurosamente contrastados contra la Clasificación Única de Procedimientos en Salud (CUPS) de la República de Colombia, regulada por el Ministerio de Salud y Protección Social:

- **Resolución 2292 de 2021 / Resolución 2808 de 2022 / Resolución 2336 de 2023**: Actualizaciones oficiales de la Clasificación Única de Procedimientos en Salud (CUPS).
- **Resolución 3280 de 2018**: Rutas Integrales de Atención en Salud (RIAS) para Promoción y Mantenimiento de la Salud y Detección Temprana de Cáncer y Enfermedades Crónicas.

### Jerarquía de Confianza del Repositorio
1. **Orden Real Guardada en Everest**: Captura formal de ordenamiento médico (`ObtenerOrdenamientoPorPacienteIdVigente`).
2. **Endpoints de Parametrización en Vivo de Everest**:
   - `GET /apiviva/ApiOrdenamientoHealth/api/Combo/ObtenerPaqueteProgramasCupsByCitaId?citaID=&paqueteProgramaId=`: Verificación en tiempo real de paquetes y códigos CUPS contratados por programa para la cita activa.
   - `GET /apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos?citaId=`: Parametrización oficial de analitos de crónicos, unidades declaradas y rangos de referencia.
3. **Clic Capturado en Producción**: Archivos `captura_*.json` y texto literal de elementos `<li>` en la interfaz clínica.
4. **Catálogo Normativo Oficial**: Resoluciones MinSalud.

---

## 2. Inventario Exhaustivo de Códigos (34 Códigos CUPS y LIS)

| # | Código | Denominación Oficial MinSalud / LIS | Subsistema / Mapeo | Tipo de Uso | Fuente Normativa / Evidencia | Observaciones Clínicas y Técnicas |
|---|---|---|---|---|---|---|
| 1 | **2002** | ALBUMINA EN SUERO | Whitelist 13 Labs (`ALBUMINA`) | Lectura LIS | Athenea LIS | Código interno de laboratorio receptor para albúmina sérica. |
| 2 | **2009** | COLESTEROL TOTAL | Whitelist 13 Labs (`COLESTEROL_TOTAL`) | Lectura LIS | Athenea LIS | Código interno para colesterol total. |
| 3 | **2013** | GLUCOSA EN SUERO | Whitelist 13 Labs (`GLUCOSA`) | Lectura LIS | Athenea LIS | Código interno para glicemia basal. |
| 4 | **2014** | COLESTEROL LDL | Whitelist 13 Labs (`COLESTEROL_LDL`) | Lectura LIS | Athenea LIS | Código interno para fracción LDL. |
| 5 | **2015** | COLESTEROL HDL | Whitelist 13 Labs (`COLESTEROL_HDL`) | Lectura LIS | Athenea LIS | Código interno para fracción HDL. |
| 6 | **2028** | CREATININA EN SUERO | Whitelist 13 Labs (`CREATININA`) | Lectura LIS | Athenea LIS | Código interno para creatinina sérica. |
| 7 | **2031** | FOSFORO EN SUERO | Whitelist 13 Labs (`FOSFORO`) | Lectura LIS | Athenea LIS | Código interno para fósforo sérico. |
| 8 | **2034** | HEMOGLOBINA BASAL | Whitelist 13 Labs (`HEMOGLOBINA`) | Lectura LIS | Athenea LIS | Código interno para hemoglobina sérica. |
| 9 | **2035** | HEMOGLOBINA GLICOSILADA | Whitelist 13 Labs (`HBA1C`) | Lectura LIS | Athenea LIS | Código interno para HbA1c. |
| 10 | **2065** | HORMONA PARATIROIDEA [PTH] | Whitelist 13 Labs (`PTH`) | Lectura LIS | Athenea LIS | Código interno para hormona paratiroidea. |
| 11 | **2074** | TRIGLICERIDOS | Whitelist 13 Labs (`TRIGLICERIDOS`) | Lectura LIS | Athenea LIS | Código interno para triglicéridos. |
| 12 | **2095** | UROANALISIS COMPLETO | Whitelist 13 Labs (`UROANALISIS`) | Lectura LIS | Athenea LIS | Código interno para parcial de orina con sedimento. |
| 13 | **876802** | MAMOGRAFIA BILATERAL | PyM Z123 (Cáncer de Mama) | Escritura / Orden | Res 2292/2021, Res 3280/2018 | Tamizaje bianual en mujeres de 50 a 69 años. |
| 14 | **8779** | RELACION ALBUMINA/CREATININA | Whitelist 13 Labs (`RAC`) | Lectura LIS | Athenea LIS | Código cuantitativo de relación microalbuminuria/creatinuria. |
| 15 | **892901** | TOMA NO QUIRURGICA DE MUESTRA CERVICOVAGINAL | PyM Z124 (Cáncer de Cuello Uterino) | Escritura / Procedimiento | Res 2292/2021 | Procedimiento en consultorio de toma de citología. |
| 16 | **898001** | ESTUDIO DE CITOLOGIA VAGINAL TUMORAL | PyM Z124 (Cáncer de Cuello Uterino) | Escritura / Orden | Res 2292/2021, Res 3280/2018 | Citología convencional para mujeres 25-29 años. |
| 17 | **902207** | HEMOGLOBINA [MANUAL / BASAL] | Whitelist 13 Labs (`HEMOGLOBINA`) | Lectura LIS | Res 2292/2021 | Código de lectura recibido de solicitudes básicas. |
| 18 | **902211** | HEMATOCRITO | PyM Z103 (Hemograma PyM) | Escritura / Orden | Res 2292/2021 | Complemento diagnóstico de anemia. |
| 19 | **902213** | HEMOGLOBINA [AUTOMATIZADA] | PyM Z103, Escritura Renal | Escritura / Orden | Res 2292/2021, Orden Guardada | Código formal para ordenamiento en Everest. |
| 20 | **903026** | MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL | PyM I10X (RCV Exprés) | Escritura / Orden | Res 2292/2021, Orden Guardada | Cuantificación en muestra aislada para cálculo de RAC. |
| 21 | **903426** | HEMOGLOBINA GLICOSILADA AUTOMATIZADA | PyM I10X, Escritura Renal | Escritura / Orden | Res 2292/2021, Orden Guardada | Método automatizado obligatorio para DM2 y ERC. |
| 22 | **903801** | ALBUMINA EN SUERO [LECTURA] | Whitelist 13 Labs (`ALBUMINA`) | Lectura LIS | Res 2292/2021 | Código CUPS receptor en reportes LIS. |
| 23 | **903803** | ALBUMINA EN SUERO U OTROS FLUIDOS | Escritura Renal | Escritura / Orden | Res 2292/2021, Captura Conducta | Código oficial para ordenamiento médico en Everest. |
| 24 | **903815** | COLESTEROL DE ALTA DENSIDAD [HDL] | Whitelist (`COLESTEROL_HDL`), PyM I10X, Z108 | Lectura y Escritura | Res 2292/2021 | Fracción HDL sérica. |
| 25 | **903816** | COLESTEROL DE BAJA DENSIDAD SEMIAUTOMATIZADO | Whitelist (`COLESTEROL_LDL`), PyM Z108 (Sanos) | Lectura y Escritura | Res 2292/2021 | Indicado específicamente para tamizaje de población general sana. |
| 26 | **903817** | COLESTEROL DE BAJA DENSIDAD AUTOMATIZADO | Whitelist (`COLESTEROL_LDL`), PyM I10X (Crónicos) | Lectura y Escritura | Res 2292/2021, Orden Guardada | Indicado en seguimiento de pacientes con HTA/DM2/ERC. |
| 27 | **903818** | COLESTEROL TOTAL | Whitelist (`COLESTEROL_TOTAL`), PyM I10X, Z108 | Lectura y Escritura | Res 2292/2021 | Cuantificación de colesterol sérico total. |
| 28 | **903837** | FOSFORO EN SUERO [LECTURA] | Whitelist 13 Labs (`FOSFORO`) | Lectura LIS | Res 2292/2021 | Código de reporte en Athenea. |
| 29 | **903841** | GLUCOSA EN SUERO [GLICEMIA] | Whitelist (`GLUCOSA`), PyM I10X, Z108 | Lectura y Escritura | Res 2292/2021 | Glicemia basal en ayunas. |
| 30 | **903843** | HEMOGLOBINA GLICOSILADA [LECTURA] | Whitelist 13 Labs (`HBA1C`) | Lectura LIS | Res 2292/2021 | Código de lectura en Athenea. |
| 31 | **903868** | TRIGLICERIDOS | Whitelist (`TRIGLICERIDOS`), PyM I10X, Z108 | Lectura y Escritura | Res 2292/2021 | Cuantificación de triglicéridos. |
| 32 | **903876** | CREATININA EN ORINA PARCIAL | PyM I10X (RCV Exprés) | Escritura / Orden | Res 2292/2021, Orden Guardada | Par necesario junto con 903026 para el índice RAC. |
| 33 | **903885** | FOSFORO EN SUERO U OTROS FLUIDOS | Escritura Renal | Escritura / Orden | Res 2292/2021, Captura Conducta | Código oficial para ordenamiento médico en Everest. |
| 34 | **903890** | HORMONA PARATIROIDEA MOLECULA INTACTA [PTH] | Escritura Renal | Escritura / Orden | Res 2292/2021, Captura Conducta | Código oficial para ordenamiento de PTH intacta. |
| 35 | **903895** | CREATININA EN SUERO | Whitelist (`CREATININA`), PyM I10X, Z108 | Lectura y Escritura | Res 2292/2021 | Creatinina para estimación de TFG. |
| 36 | **906249** | ANTICUERPOS VIH 1 Y 2 | PyM Z113 (VIH) | Escritura / Orden | Res 2292/2021, Res 3280/2018 | Única ETS conservada obligatoriamente en PyM. |
| 37 | **906610** | ANTIGENO ESPECIFICO DE PROSTATA [PSA] | PyM Z125 (Cáncer de Próstata) | Escritura / Orden | Res 2292/2021, Res 3280/2018 | Tamizaje en hombres de 50 a 75 años. |
| 38 | **907009** | SANGRE OCULTA EN MATERIA FECAL [SOMF] | PyM Z121 (Cáncer de Colon) | Escritura / Orden | Res 2292/2021, Res 3280/2018 | Prueba inmunoquímica bienal para 50-75 años. |
| 39 | **907106** | UROANALISIS CON SEDIMENTO | Whitelist (`UROANALISIS`), PyM I10X, Z108 | Lectura y Escritura | Res 2292/2021 | Parcial de orina citoquímico y microscópico. |
| 40 | **908890** | DETECCION ADN VIRUS PAPILOMA HUMANO [VPH] | PyM Z124 (Cáncer de Cuello Uterino) | Escritura / Orden | Res 2292/2021, Res 3280/2018 | Prueba molecular de ADN para mujeres 30-65 años. |

---

## 3. Divergencias Críticas Documentadas

### 3.1 Divergencia Sistemática: Lectura (LIS) vs Escritura (Everest Orders)
El laboratorio clínico de la IPS procesa muestras bajo catálogos de lectura históricos (`codes` en `WHITELIST_13_LABS`), pero el módulo de prescripción médica de Everest exige códigos CUPS automatizados de última generación (`CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO`):

| Analito | Código de Lectura (Recepción LIS) | Código de Escritura (Orden Médica Everest) | Razón Técnica / Clínica de la Diferencia |
|---|---|---|---|
| **Hormona Paratiroidea** | `904921` / `2065` | `903890` (PTH Molécula Intacta) | 903890 es el código contratado en el paquete nefroprotector para cuantificación inmunorradiométrica exacta. |
| **Fósforo Sérico** | `903837` / `2031` | `903885` (Fósforo en Suero u otros fluidos) | 903885 es el ítem facturable en la parametrización de la EPS para seguimiento ERC. |
| **Albúmina Sérica** | `903801` / `2002` | `903803` (Albúmina en Suero u otros fluidos) | 903803 es el código activo en el catálogo de órdenes ambulatorias de Everest. |
| **Hemoglobina Glicosilada** | `903843` / `2035` | `903426` (HbA1c Automatizada) | 903426 es el estándar de oro automatizado certificado NGSP, exigido en RCV y ERC. *(Nunca usar 904426).* |
| **Hemoglobina** | `902207` / `2034` | `902213` (Hemoglobina Automatizada) | 902213 es la técnica automatizada requerida en las órdenes de PyM Z103 y nefrología. |

### 3.2 Diferenciación de Fracción LDL: Sanos (`Z108`) vs Crónicos (`I10X`)
- **Población Sana (Tamizaje Oportunista Z108)**: `903816` (Colesterol de baja densidad semiautomatizado).
- **Población Crónica (Seguimiento RCV / ERC I10X)**: `903817` (Colesterol de baja densidad automatizado directo).
- *Justificación*: Los acuerdos de gestión del riesgo diferencian la precisión analítica requerida para estratificación inicial vs titulación de estatinas de alta potencia.

---

## 4. Códigos Excluidos o Prohibidos y Razones de Retiro

1. **`903866` (Alanina Aminotransferasa / TGP / ALT)**: Retirado de `TRIGLICERIDOS`. Un cruce erróneo en versiones previas vinculaba ALT con triglicéridos.
2. **`904426` (Hemoglobina Glicosilada Genérica)**: Prohibido. En Everest la orden falla si no se especifica el código automatizado `903426`.
3. **`906039` (Serología VDRL) y `906225` (Anticuerpos Hepatitis C)**: Excluidos de los paneles automáticos de PyM por política de cumplimiento de metas de la IPS (VIH `906249` permanece siempre activo por seguridad biológica).
4. **`903028` (Microalbuminuria Semiautomatizada)**: Rechazado a favor de `903026` (Automatizada en orina parcial) para garantizar reproducibilidad en el cociente RAC.
