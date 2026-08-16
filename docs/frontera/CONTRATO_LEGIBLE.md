# El Contrato de Frontera con Everest: DOM, Red y Estado

> **Documento para lectura médica y de ingeniería.**  
> Este documento describe cada una de las suposiciones que el Vigilante de Agenda asume sobre el sistema Everest (EHR) y el LIS Athenea, ordenadas estrictamente por su nivel de fragilidad ante cambios ajenos.

---

## 📊 Las Tres Cifras de la Frontera

| Métrica | Valor | Significado Clínico |
|---|---|---|
| **Total de suposiciones sobre Everest** | **95** | Puntos de acoplamiento exactos (selectores DOM, rutas de red, campos JSON y almacenamiento). |
| **Verificadas contra capturas reales** | **75 (78.9%)** | Suposiciones respaldadas por evidencia física de capturas o volcados en consultorio. |
| **Suposiciones de fragilidad ALTA** | **58 (61.1%)** | **Cifra crítica:** Puntos donde un simple cambio cosmético de Bootstrap o Angular deja al script callado. |

---

## 1. Suposiciones de Fragilidad ALTA (58 Elementos)
*Riesgo Crítico: Clases de estilo visual (Bootstrap), IDs específicos de formularios Angular, anclajes por texto visible de botones o placeholders, y emparejamiento de campos de API.*

### 1.1. Selectores de Agenda y Citas
| ID | Selector / Literal | Función y Línea | Para qué sirve | Qué le pasa al médico si falla (`si_falla`) | Fuente de Evidencia |
|---|---|---|---|---|---|
| `dom-agenda-hora` | `.labelHora` | `applyTheme` (L4343) / `scrapeAgenda` (L6258) / `seccionActiva` (L6313) | Lee la hora de la cita en la tarjeta de agenda. | `seccionActiva()` devuelve 'otra'. Se apaga todo el panel, los colores de estado y la detección de fraude. El médico queda sin asistencia. | `captura_agendamiento_oficial_20260810.json` / `MAPA_EVEREST_20260814_1611.json` |
| `dom-agenda-estado` | `.status-label` | `applyTheme` (L4343) / `scrapeAgenda` (L6253, L6263) | Lee el estado de asistencia ('En Sala', 'Atendido', 'Sin presentarse'). | Estado queda vacío. La máquina de fraude (`colorAndAlert`) no detecta retrasos y deja a todos en AZUL normal (**falsa tranquilidad**). | `captura_agendamiento_oficial_20260810.json` / `MAPA_EVEREST_20260814_1611.json` |
| `dom-agenda-documento` | `.text-muted` | `applyTheme` (L4344) / `scrapeAgenda` (L6264) / `extractPacienteAbierto` (L6329) | Extrae la cédula del paciente en la tarjeta y en la cabecera clínica. | No se lee la cédula; no se pueden consultar alertas PyM del Excel, ni buscar laboratorios en Athenea, ni calcular `apptKey`. | `captura_agendamiento_oficial_20260810.json` |
| `dom-agenda-nombre` | `.text-uppercase.fw-bold`, `.text-uppercase` | `applyTheme` (L4344) / `scrapeAgenda` (L6265) | Lee el nombre completo del paciente. | Nombre queda '(sin nombre)'; el filtro 'Mi agenda' no puede reconocer las citas del médico. | `captura_agendamiento_oficial_20260810.json` |
| `dom-agenda-modalidad` | `.fw-bold.mb-0` | `applyTheme` (L4345) / `scrapeAgenda` (L6266) | Identifica modalidad Presencial vs Telemedicina. | Modalidad queda vacía; no distingue teleconsulta de presencial. | `captura_agendamiento_oficial_20260810.json` |

---

### 1.2. Detección de Historia Clínica y Errata de Everest
| ID | Selector / Literal | Función y Línea | Para qué sirve | Qué le pasa al médico si falla (`si_falla`) | Fuente de Evidencia |
|---|---|---|---|---|---|
| `dom-hc-anamesis` | `#anamesis` | `seccionActiva` (L6304) / `extractPacienteAbierto` (L6327) | Detecta la apertura de la historia clínica. **Depende de una errata ortográfica de Everest ('anamesis' sin la segunda 'n').** | Si Everest corrige la errata a `#anamnesis`, el script cree que no hay historia abierta. Se apagan Auto-Labs, Normalidad Fija, alertas PyM y guarda RAC. | `captura_rutacronicos_borrado_rac_20260812.json` / `MAPA_EVEREST_20260814_1706.json` |

---

### 1.3. Casillas de los 13 Laboratorios Clínicos en Ruta Crónicos
| ID | Selector / Literal | Función y Línea | Para qué sirve | Qué le pasa al médico si falla (`si_falla`) | Fuente de Evidencia |
|---|---|---|---|---|---|
| `dom-lab-res-col-total` | `input#resultadoColesterolTotal` | `WHITELIST_13_LABS` (L1095) / `injectLabsIntoCronicos` (L2676) | Inyecta resultado de Colesterol Total. | Casilla queda vacía tras Auto-Labs; el médico debe digitarlo a mano. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-col-total` | `input#fechaResultColesterolTotal` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1095) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Colesterol Total. | Fecha queda vacía en la historia clínica. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |
| `dom-lab-res-col-hdl` | `input#resultadoColesterolHDL` | `WHITELIST_13_LABS` (L1096) / `injectLabsIntoCronicos` (L2676) | Inyecta resultado de Colesterol HDL. | Casilla queda vacía. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-col-hdl` | `input#fechaResultColesterolHDL` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1096) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Colesterol HDL. | Fecha queda vacía. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |
| `dom-lab-res-col-ldl` | `input#resultadoColesterolLDL` | `WHITELIST_13_LABS` (L1097) / `injectLabsIntoCronicos` (L2676) | Inyecta resultado de Colesterol LDL (meta RCV). | Casilla de LDL queda vacía. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-col-ldl` | `input#fechaResultColesterolLDL` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1097) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Colesterol LDL. | Fecha queda vacía. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |
| `dom-lab-res-trigliceridos` | `input#resultadoTrigliceridos` | `WHITELIST_13_LABS` (L1109) / `injectLabsIntoCronicos` (L2676) | Inyecta resultado de Triglicéridos. | Casilla queda vacía. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-trigliceridos` | `input#fechaResultTrigliceridos` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1109) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Triglicéridos. | Fecha queda vacía. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |
| `dom-lab-res-glicemia` | `input#resultadoGlicemia` | `WHITELIST_13_LABS` (L1127) / `injectLabsIntoCronicos` (L2676) | Inyecta resultado de Glucosa / Glicemia. | Casilla de glucosa queda vacía. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-glicemia` | `input#fechaResultGlicemia` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1127) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Glucosa. | Fecha queda vacía. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |
| `dom-lab-res-rac` | `input#resultadoRelacionAlbuminaCreatinina` | `WHITELIST_13_LABS` (L1138) / `injectLabsIntoCronicos` (L2676) | Inyecta resultado de Relación Albúmina/Creatinina (RAC). | Casilla de RAC queda vacía; no se vigila nefropatía diabética. | `captura_rutacronicos_borrado_rac_20260812.json` / `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-rac` | `input#fechaResultRelacionAlbuminaCreatinina` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1138) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de RAC. | Fecha queda vacía. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |
| `dom-lab-res-creatinina` | `input#resultadoCreatinina` | `WHITELIST_13_LABS` (L1141) / `injectLabsIntoCronicos` (L2676) | Inyecta Creatinina Sérica (clave para TFG y KDIGO). | Casilla de creatinina queda vacía; no se calcula la función renal. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-creatinina` | `input#fechaResultCreatinina` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1141) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Creatinina Sérica. | Fecha queda vacía. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |
| `dom-lab-res-hba1c` | `input#resultadoHemoglobina[type="number"][max="30"]` | `WHITELIST_13_LABS` (L1146) / `_findHbA1cFields` (L2173) | Inyecta Hemoglobina Glicosilada (desambiguada de Hemoglobina normal por `max=30`). | Si Everest cambia el atributo `max=30`, HbA1c no se encuentra o se inyecta por error en Hemoglobina sérica (**error clínico grave**). | `consultorio` (HTML real L2158) |
| `dom-lab-fec-hba1c` | `.input-group input[type="date"]` hermana de HbA1c | `_findHbA1cFields` (L2177) / `injectLabsIntoCronicos` (L2674) | Inyecta fecha de Hemoglobina Glicosilada. | Fecha queda vacía. | `consultorio` |
| `dom-lab-res-pth` | `input#resultadoPTH` | `WHITELIST_13_LABS` (L1147) / `_findLabField` (L2149) | Inyecta Paratohormona (PTH). | Casilla queda vacía. | `SUPUESTO` |
| `dom-lab-fec-pth` | `input#fechaResultPTH` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1147) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de PTH. | Fecha queda vacía. | `SUPUESTO` |
| `dom-lab-res-fosforo` | `input#resultadoFosforo` | `WHITELIST_13_LABS` (L1152) / `_findLabField` (L2149) | Inyecta Fósforo en suero. | Casilla queda vacía. | `SUPUESTO` |
| `dom-lab-fec-fosforo` | `input#fechaResultFosforo` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1152) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Fósforo. | Fecha queda vacía. | `SUPUESTO` |
| `dom-lab-res-albumina` | `input#resultadoAlbumina` | `WHITELIST_13_LABS` (L1153) / `_findLabField` (L2149) | Inyecta Albúmina en suero. | Casilla queda vacía. | `SUPUESTO` |
| `dom-lab-fec-albumina` | `input#fechaResultAlbumina` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1153) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Albúmina. | Fecha queda vacía. | `SUPUESTO` |
| `dom-lab-res-hemoglobina` | `input#resultadoHemoglobina` | `WHITELIST_13_LABS` (L1154) / `_findLabField` (L2149) | Inyecta Hemoglobina (hemograma sérico). | Casilla de hemoglobina queda vacía. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-lab-fec-hemoglobina` | `input#fechaResultHemoglobina` / `.input-group input[type="date"]` | `WHITELIST_13_LABS` (L1154) / `injectLabsIntoCronicos` (L2687) | Inyecta fecha de Hemoglobina. | Fecha queda vacía. | `SUPUESTO` (id) / `consultorio` (hermana input-group) |

---

### 1.4. Uroanálisis, Examen Físico y Conducta
| ID | Selector / Literal | Función y Línea | Para qué sirve | Qué le pasa al médico si falla (`si_falla`) | Fuente de Evidencia |
|---|---|---|---|---|---|
| `dom-uro-radio-sw` | `input[name="resultadoPrograma.swUroanalisis"]` | `_marcarUroanalisisSi` (L1426) | Activa el radio 'Presenta Uroanálisis: SÍ' buscando texto 'SI' en el label padre. | No se marca SÍ; Angular no monta con `*ngIf` las 7 casillas de componentes de orina. | `consultorio` (L1416) |
| `dom-uro-input-nitritos` | `input[placeholder*="RESULTADO NITRITOS" i]` | `UROANALISIS_COMPONENTES` (L1279) / `_findUroInput` (L1408) | Casilla de Nitritos en orina (anclada por placeholder). | Casilla de nitritos queda vacía. | `consultorio` (L1265) |
| `dom-uro-input-glucosuria` | `input[placeholder*="RESULTADO GLUCOSURIA" i]` | `UROANALISIS_COMPONENTES` (L1288) / `_findUroInput` (L1408) | Casilla de Glucosuria en orina. | Casilla de glucosuria queda vacía. | `consultorio` (L1265) |
| `dom-uro-input-proteinuria` | `input[placeholder*="RESULTADO PROTEINURIA" i]` | `UROANALISIS_COMPONENTES` (L1291) / `_findUroInput` (L1408) | Casilla de Proteinuria en orina. | Casilla de proteinuria queda vacía. | `consultorio` (L1265) |
| `dom-uro-input-cilindros` | `input[placeholder*="RESULTADO CILINDROS" i]` | `UROANALISIS_COMPONENTES` (L1292) / `_findUroInput` (L1408) | Casilla de Cilindros en orina. | Casilla de cilindros queda vacía. | `consultorio` (L1265) |
| `dom-uro-input-sangre` | `input[placeholder*="RESULTADO SANGRE" i]` | `UROANALISIS_COMPONENTES` (L1293) / `_findUroInput` (L1408) | Casilla de Sangre en orina. | Casilla de sangre en orina queda vacía. | `consultorio` (L1265) |
| `dom-uro-input-hematies` | `input[placeholder*="RESULTADO HEMATIES" i]` | `UROANALISIS_COMPONENTES` (L1294) / `_findUroInput` (L1408) | Casilla de Hematíes en orina. | Casilla de hematíes queda vacía. | `consultorio` (L1265) |
| `dom-uro-input-leucocitos` | `input[placeholder*="RESULTADO LEUCOCITOS" i]` | `UROANALISIS_COMPONENTES` (L1295) / `_findUroInput` (L1408) | Casilla de Leucocitos en orina. | Casilla de leucocitos queda vacía. | `consultorio` (L1265) |
| `dom-uro-res-general` | `input#resultadoUroanalisis` | `WHITELIST_13_LABS` (L1126) / `injectLabsIntoCronicos` (L2816) | Casilla general de Uroanálisis (tras `*ngIf`). | Casilla general queda vacía si Angular tarda más de 300 ms en renderizar. | `MAPA_EVEREST_20260814_1712.json` |
| `dom-exf-alert-message` | `input[id="alert_message"][type="text"]` | `_casillasExamenFisico` (L3809) | Inyecta plantilla de Normalidad Fija en 10 casillas de examen físico que comparten el ID duplicado `alert_message`. | Si Everest corrige el ID o altera el orden, inyecta texto en sistemas anatómicos cruzados. | `consultorio` (L3808) |
| `dom-conducta-li` | `li (texto exacto de catálogo)` | `_conductaBuscarYAgregarExamen` (L1242) | Selecciona examen en catálogo de Conducta por coincidencia de texto literal exacto. | Si cambia una letra o espacio en el catálogo, el examen no se selecciona. | `captura_ordenamiento_paquete_HTA_20260812.json` |
| `dom-conducta-btn-agregar` | `button (texto 'AGREGAR' habilitado)` | `_conductaBuscarYAgregarExamen` (L1254) | Confirma la adición del examen tras 700 ms de espera de render. | Si la máquina tarda más de 700 ms, el botón no se cliclea y el examen no se agrega. | `captura_ordenamiento_paquete_HTA_20260812.json` |

---

### 1.5. Campos Clave de Respuestas de API y Estado
| ID | Campo / Variable | Función y Línea | Para qué sirve | Qué le pasa al médico si falla (`si_falla`) | Fuente de Evidencia |
|---|---|---|---|---|---|
| `api-campo-meds-respuesta` | `res.respuesta` | `meds` (L16460) | Array raíz de órdenes de medicamentos en `CargarMedicamentosPaciente`. | Lista vacía de medicamentos. El médico cree que el paciente no toma fármacos (**tranquilidad falsa**); no se auditan interacciones ni dosis renales. | `captura_ordenamiento_nativo_20260810.json` / `tests/fixtures/everest_medicamentos.json` |
| `api-campo-meds-detalles` | `orden.detalles` | `meds` (L16465) | Array de renglones/fármacos de cada orden. | No se lee ninguna molécula; módulo de medicamentos vacío. | `captura_ordenamiento_nativo_20260810.json` / `tests/fixtures/everest_medicamentos.json` |
| `api-campo-meds-descripcion` | `detalle.descripcion` | `meds` (L16470) | Nombre del fármaco (ej. 'METFORMINA CLORHIDRATO 850 MG'). | No se clasifica el grupo farmacológico; no se detectan interacciones ni contraindicaciones. | `captura_ordenamiento_nativo_20260810.json` / `tests/fixtures/everest_medicamentos.json` |
| `api-campo-meds-posfechado-ini` | `detalle.posfechadoInicial` | `meds` (L16480) | Fecha de inicio de entrega de fórmula posfechada. | El medicamento activo se juzga como vencido. | `captura_ordenamiento_nativo_20260810.json` / `tests/fixtures/everest_medicamentos.json` |
| `api-campo-meds-posfechado-fin` | `detalle.posfechadoFinal` | `meds` (L16481) | Fecha final de cobertura de posfechado. | No se calcula la vigencia real del tratamiento. | `captura_ordenamiento_nativo_20260810.json` / `tests/fixtures/everest_medicamentos.json` |
| `api-campo-meds-estado` | `orden.estado` | `meds` (L16462) | Estado de la orden ('PENDIENTE', 'ANULADA'). | Órdenes anuladas por el médico se procesarían como tratamientos activos. | `captura_ordenamiento_nativo_20260810.json` / `tests/fixtures/everest_medicamentos.json` |
| `api-campo-paciente-id` | `res.data.idPaciente` | `apiAccesoBuscarPaciente` (L10215) | Identificador entero del paciente en Everest. | `idPaciente` queda en 0; fallan citas y órdenes. | `captura_agendamiento_oficial_20260810.json` |
| `api-campo-cronicos-val-tabla` | `fila.codigoExamen, fila.valorMinimo, fila.valorMaximo, fila.unidad` | `_objecionOficialAlValor` (L2440) | Reglas oficiales de plausibilidad y unidades de la IPS. | Auto-Labs no objeta valores fuera de rango y escribe números implausibles en la historia. | `captura_rutacronicos_borrado_rac_20260812.json` |
| `api-campo-athenea-dataobject` | `res.dataObject` | `fetchAtheneaLabs` (L1467) | String JSON que contiene los analitos en Athenea. | Si Athenea devuelve objeto directo en vez de string serializado, JSON.parse lanza excepción y no se inyecta nada. | `consultorio` (HAR Athenea) |
| `api-campo-athenea-nombre` | `lab.NombreParametro` | `_matchLabInWhitelist` (L2118) | Nombre del analito en Athenea. | No casa con el whitelist; casilla queda vacía. | `consultorio` (HAR Athenea) |
| `api-campo-athenea-resultado` | `lab.Resultado` | `injectLabsIntoCronicos` (L2549) | Valor textual del resultado. | Casilla queda vacía. | `consultorio` (HAR Athenea) |
| `api-campo-athenea-padre` | `lab.NombreParametroPadre` | `_esAnalitoDeOrina` (L1308) | Agrupador del panel de orina en Athenea. | Analitos de orina caen en casillas séricas (ej. hemoglobina en orina -> hemoglobina sérica). | `consultorio` (HAR Athenea) |
| `api-campo-athenea-fecha` | `lab.FechaValidacion / FechaResultado` | `_extractAtheneaFecha` (L1483) | Fecha del resultado de laboratorio. | Casilla de fecha queda vacía en la historia. | `consultorio` (HAR Athenea) |
| `estado-storage-user` | `localStorage.getItem("user")` | `identidadDesdeCliente` (L9912) | Objeto de sesión de Everest ({ userId, username }). | No se auto-detecta la identidad del médico. | `consultorio` (volcado 2026-08-10) |
| `estado-storage-jwt` | `localStorage.getItem("jwt")` | `identidadDesdeCliente` (L9915) | Token JWT activo de Everest. | No se valida la frescura del login activo. | `consultorio` (volcado 2026-08-10) |
| `estado-window-pagewin` | `PAGEWIN.UsuarioId, PAGEWIN.UsuarioLogin` | `captureDoctorInfo` (L9796) | Variables globales en window de Everest. | El script recurre a interceptar URLs de red. | `consultorio` |

---

## 2. Suposiciones de Fragilidad MEDIA (9 Elementos)
*Riesgo Moderado: Contenedores estructurales de tarjetas, rutas del router Angular y atributos secundarios.*

| ID | Selector / Literal | Función y Línea | Para qué sirve | Qué le pasa al médico si falla (`si_falla`) | Fuente de Evidencia |
|---|---|---|---|---|---|
| `dom-agenda-contenedor` | `.card-body, .card` | `containerOf` (L6251) | Contenedor de la tarjeta de cita. | No se puede colorear la tarjeta en la agenda. | `captura_agendamiento_oficial_20260810.json` |
| `dom-agenda-fecha` | `.fecha` | `applyTheme` (L4345) | Selector de fecha de agenda. | No se valida fecha en pantalla. | `SUPUESTO` |
| `dom-hc-appindex` | `app-index` | `extractPacienteAbierto` (L6328) | Raíz del componente de historia. | Búsqueda se amplía a document global. | `MAPA_EVEREST_20260814_1611.json` |
| `dom-hc-pes-tab` | `a#pes` | Navegación PES | Pestaña Ruta Crónicos. | Médico debe navegar a mano. | `captura_rutacronicos_borrado_rac_20260812.json` |
| `dom-hc-conducta-tab` | `a#conducta` | Navegación Conducta | Pestaña Conducta. | Médico debe navegar a mano. | `captura_ordenamiento_paquete_HTA_20260812.json` |
| `api-campo-meds-codigo` | `detalle.codigo` | `meds` (L16472) | Código interno de fármaco. | Se apoya en la descripción textual. | `captura_ordenamiento_nativo_20260810.json` |
| `api-campo-meds-cantidad` | `detalle.cantidadMedicamento` | `meds` (L16475) | Cantidad de unidades recetadas. | No calcula días de cobertura. | `captura_ordenamiento_nativo_20260810.json` |
| `api-campo-meds-dosificacion` | `detalle.dosificacion` | `meds` (L16476) | Dosis / frecuencia diaria. | Asume 1 unidad/día por defecto. | `captura_ordenamiento_nativo_20260810.json` |
| `estado-cookie-medico` | `cookie UsuarioMedico` | `identidadDesdeCliente` (L9902) | Cookie de sesión del médico. | Se apoya en localStorage.user. | `consultorio` |

---

## 3. Suposiciones de Fragilidad BAJA (28 Elementos)
*Riesgo de Ruptura Bajo pero Consecuencia Catastrófica: Nombres de endpoints REST corporativos de Everest y Athenea.*

| ID | Endpoint / Recurso | Función y Línea | Consecuencia si cambia la ruta | Fuente de Evidencia |
|---|---|---|---|---|
| `api-ruta-acceso-buscar-paciente` | `GET /apiviva/APIAcceso/api/Paciente/BuscarPaciente` | `apiAccesoBuscarPaciente` (L10210) | No se puede resolver `idPaciente`; fallan citas y órdenes. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-paciente-detallado` | `GET /apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado` | `apiAccesoObtenerDemograficos` (L10865) | No hay edad ni sexo; no se calcula Cockcroft-Gault ni rangos oficiales. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-param-lista` | `GET /apiviva/APIAcceso/api/ParametrizacionLista/GetLista` | Catálogo de contratos | No se validan contratos de agenda. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-usuario-perfil` | `GET /apiviva/APIAcceso/api/ParametrizacionLista/GetUsuarioPerfil/<login>` | `resolverMedicoPorPerfil` (L9884) | Médico no identificado; no se pueden crear citas ni órdenes. | `consultorio` (L9848) |
| `api-ruta-acceso-validar-presupuestos` | `GET /apiviva/APIAcceso/api/Acceso/ValidarPresupuestosPaciente` | Validación presupuestal | No valida presupuestos de cita. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-buscar-citas` | `POST /apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles` | `apiAccesoBuscarCitasDisponibles` (L10243) | Asistente reporta 'No hay citas disponibles' (lista vacía). | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-validar-agenda` | `GET /apiviva/APIAcceso/api/Acceso/AgdValidarAgenda` | `apiAccesoAgdValidarAgenda` (L11129) | No se puede validar agenda antes de reservar. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-obtener-turnos` | `GET /apiviva/APIAcceso/api/Acceso/ObtenerTurnos` | `apiAccesoObtenerTurnos` (L11139) | No se muestran horarios para agendar. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-asignar-turno` | `POST /apiviva/APIAcceso/api/Acceso/AsignarTurno` | `apiAccesoAsignarTurno` (L11165) | **Superficie de Escritura:** La cita no se crea en Everest. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-acceso-enviar-sms` | `GET /apiviva/APIAcceso/api/SMS/EnviarSMS` | `apiAccesoAsignarTurno` (L11190) | Paciente no recibe confirmación SMS de su cita. | `captura_agendamiento_oficial_20260810.json` |
| `api-ruta-orden-buscar-paciente` | `GET /apiviva/APIOrdenamientoHealth/api/Paciente/BuscarPaciente` | `apiOrdenamientoBuscarPaciente` (L13117) | No se pueden emitir órdenes para el paciente. | `captura_ordenamiento_nativo_20260810.json` |
| `api-ruta-orden-diagnosticos` | `GET /apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoDiagnostico` | `apiOrdenamientoObtenerDx` (L13129) | No se puede asociar diagnóstico CIE-10 a la orden. | `captura_ordenamiento_nativo_20260810.json` |
| `api-ruta-orden-cups` | `GET /apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoCupsPorPaciente` | `apiOrdenamientoObtenerCup` (L13148) | Exámenes aparecen sin cobertura. | `captura_ordenamiento_nativo_20260810.json` |
| `api-ruta-orden-paquetes` | `GET /apiviva/ApiOrdenamientoHealth/api/Combo/ObtenerPaqueteProgramasCupsByCitaId` | Carga de paquetes HTA | No se cargan paquetes de programas. | `captura_ordenamiento_paquete_HTA_20260812.json` |
| `api-ruta-orden-guardar` | `POST /apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento` | `apiOrdenamientoGuardar` (L13182) | **Superficie de Escritura:** La orden médica no se guarda. | `captura_ordenamiento_nativo_20260810.json` |
| `api-ruta-orden-consultar` | `POST /apiviva/APIOrdenamientoHealth/api/ordenamiento/ConsultarOrdenamientosPaciente` | Consulta de órdenes | No se listan órdenes previas del paciente. | `captura_ordenamiento_nativo_20260810.json` |
| `api-ruta-orden-correo` | `POST /apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento` | `apiEnviarOrdenPorCorreo` (L13307) | **Superficie de Escritura:** Paciente no recibe la orden por email. | `consultorio` (L290) |
| `api-ruta-meds-cargar` | `POST /apiviva/APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente` | `meds` (L16456) | Módulo farmacológico no carga; no audita interacciones ni dosis. | `captura_ordenamiento_nativo_20260810.json` / `fixtures` |
| `api-ruta-hc-cronicos-val` | `GET /apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos` | `getValidacionExamenCronicos` (L10706) | Auto-Labs no tiene rangos oficiales de plausibilidad. | `captura_rutacronicos_borrado_rac_20260812.json` |
| `api-ruta-hc-signos-vitales` | `GET /apiviva/APIHCHealth/api/Historicos/ObtenerHistoricoSignosVitales` | `apiHcObtenerSignosVitales` (L10785) | No hay peso corporal; no se calcula Cockcroft-Gault. | `SUPUESTO` |
| `api-ruta-hc-ordenes-vigentes` | `GET /apiviva/APIHCHealth/api/Historicos/ObtenerOrdenamientoPorPacienteIdVigente` | `apiHcObtenerOrdenamientosVigentes` (L10632) | El script puede sugerir exámenes PyM ya ordenados. | `SUPUESTO` |
| `api-ruta-hc-labs-annar` | `GET /apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioAnnar` | `apiAccesoObtenerLaboratoriosAnnar` (L10614) | Lista vacía de históricos Annar. | `SUPUESTO` |
| `api-ruta-hc-labs-citi` | `GET /apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioCiti` | `apiAccesoObtenerLaboratoriosCiti` (L10618) | Lista vacía de históricos Citi. | `SUPUESTO` |
| `api-ruta-digiturno-finalizar` | `POST /apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket` | `apiDigiturnoFinalizarTicket` (L10605) | **Código muerto inerte.** No produce fallos hoy. | `SUPUESTO` |
| `api-ruta-athenea-detalle` | `POST https://medicosviva1a.atheneasoluciones.com/Resultados/consultaDetalleSolicitud` | `fetchAtheneaLabs` (L1443) | Auto-Labs no recibe resultados del LIS Athenea. | `consultorio` (HAR Athenea) |
| `api-ruta-athenea-busqueda` | `GET https://medicosviva1a.atheneasoluciones.com/Resultados/BusquedaPaciente` | `atheneaBuscarPaciente` (L1987) | Falla el puente de búsqueda en Athenea. | `consultorio` |
| `api-ruta-athenea-datos-paciente` | `POST https://medicosviva1a.atheneasoluciones.com/Resultados/DatosPaciente` | `atheneaDatosPaciente` (L1536) | No se pueden listar solicitudes históricas. | `consultorio` |
| `estado-session-marker` | `sessionStorage.getItem('vgl_active_instance')` | Detección duplicados (L15119) | Riesgo de instancias duplicadas en la pestaña. | `consultorio` |
