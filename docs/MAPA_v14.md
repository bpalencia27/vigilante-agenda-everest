# Mapa Arquitectónico y Catálogo de Funciones — Vigilante de Agenda (v14)

**Fecha de generación:** 2026-08-20T04:28:12.663Z  
**Archivo analizado:** `vigilante_agenda.user.js` (736 funciones declaradas)  
**Suites de prueba:** 64 archivos en `tests/`  

---

## 1. Resumen Ejecutivo del Inventario

| Nivel de Riesgo | Total Funciones | Cubiertas (`cubre:`) | Efectivas (Nombradas) | Sin Cubrir |
|---|---|---|---|---|
| 🔴 **ALTO (Clínico / Escritura / Fraude)** | **49** | 49 | 49 | 0 |
| 🟡 **MEDIO (Operación / DOM / Red / Estado)** | **647** | 592 | 592 | 55 |
| 🟢 **BAJO (Utilidades Puras / Formato / Audio)** | **40** | 33 | 33 | 7 |
| **TOTAL** | **736** | **674 (91.6%)** | **674** | **62** |

---

## 2. Catálogo de Funciones de Riesgo ALTO (51 Funciones Críticas)
*Funciones con impacto clínico directo: escrituras en historia clínica Everest, cálculo renal KDIGO, agendamiento de citas, emisión de órdenes CUPS o máquina de fraude.*

| # | Línea | Función | Estado Cobertura | Suites Asociadas | Descripción Clínica |
|---|---|---|---|---|---|
| 1 | L1336 | `_esAnalitoDeOrina` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Discrimina componentes de orina para evitar cruce de casillas. |
| 2 | L1352 | `_hayComponenteUroReal` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_34_cobertura_alto_riesgo_mutantes.js | Valida presencia de datos reales antes de marcar casillas de uroanálisis. |
| 3 | L1366 | `_matchUroComponente` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js, suite_34_cobertura_alto_riesgo_mutantes.js | Mapea analito recibido a componente específico del parcial de orina. |
| 4 | L1389 | `_agruparUroanalisisParaTabla` | 🟢 Cubierta (Nombrada) | suite_15_interfaz_avanzada.js, suite_34_cobertura_alto_riesgo_mutantes.js | Agrupa analitos de orina para visualización y escritura en bloque. |
| 5 | L1578 | `_findUroInput` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_34_cobertura_alto_riesgo_mutantes.js | Localiza input específico de uroanálisis en el DOM de Everest. |
| 6 | L1596 | `_marcarUroanalisisSi` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Modifica estado del selector 'Presenta Uroanálisis: SÍ' en Everest. |
| 7 | L1760 | `_atheneaCedulaCoincide` | 🟢 Cubierta (Nombrada) | suite_18_athenea_bridge.js, suite_34_cobertura_alto_riesgo_mutantes.js | Guarda anti-cruce: Valida coincidencia estricta de cédula entre Everest y Athenea. |
| 8 | L1832 | `_fechaDesdeNumeroSolicitud` | 🟢 Cubierta (Nombrada) | suite_18_athenea_bridge.js, suite_34_cobertura_alto_riesgo_mutantes.js | Extrae fecha clínica a partir del número de solicitud de laboratorio. |
| 9 | L2359 | `_matchLabInWhitelist` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Matriz 13 Labs: Mapeo exacto entre catálogo Athenea y whitelist clínica. |
| 10 | L2392 | `_findLabField` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_34_cobertura_alto_riesgo_mutantes.js | Localiza input de analito en formulario de crónicos de Everest. |
| 11 | L2415 | `_findHbA1cFields` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js, suite_34_cobertura_alto_riesgo_mutantes.js | Localiza casillas específicas de Hemoglobina Glicosilada. |
| 12 | L2543 | `_extractFechaSolicitudTopLevel` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_34_cobertura_alto_riesgo_mutantes.js | Extrae fecha de solicitud para validación de vigencia clínica. |
| 13 | L2557 | `_extractAtheneaFecha` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_34_cobertura_alto_riesgo_mutantes.js | Parser de fechas de resultados con múltiples formatos colombianos. |
| 14 | L2600 | `_valorCrudoLab` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_34_cobertura_alto_riesgo_mutantes.js | Extracción de valor antes de parseo numérico; previene mutilación de signos. |
| 15 | L2730 | `_pacienteSigueAbierto` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_34_cobertura_alto_riesgo_mutantes.js | Guarda crítica: Aborta escritura si el médico cambió de paciente durante la petición. |
| 16 | L2825 | `injectLabsIntoCronicos` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_31_labs_rango_oficial.js, suite_34_cobertura_alto_riesgo_mutantes.js | Superficie de escritura principal: Inyecta hasta 13 laboratorios en la HC. |
| 17 | L3247 | `_labNumerico` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js | Convierte valor textual a float clínico preservando decimales y comas. |
| 18 | L3531 | `_esSexoFemenino` | 🟢 Cubierta (Nombrada) | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js, suite_34_cobertura_alto_riesgo_mutantes.js | Factor multiplicador (0.85) en fórmula de Cockcroft-Gault. |
| 19 | L3536 | `cockcroftGault` | 🟢 Cubierta (Nombrada) | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js | Cálculo de Tasa de Filtración Glomerular estimada (eGFR / CrCl). |
| 20 | L3745 | `_analitosRcvVencidos` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Evaluación de vigencia de 180/365 días en analitos cardiovasculares. |
| 21 | L7441 | `extractPacienteAbierto` | 🟢 Cubierta (Nombrada) | suite_14_extraccion_dom.js, suite_34_cobertura_alto_riesgo_mutantes.js | Extrae cédula y nombre del paciente activo en la pestaña de Everest. |
| 22 | L7495 | `apptKey` | 🟢 Cubierta (Nombrada) | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js | Llave única de cita (doc_id@hora); previene falso positivo en citas múltiples. |
| 23 | L7499 | `diaNuevo` | 🟢 Cubierta (Nombrada) | suite_02_tiempo_fechas.js | Limpia listas fraudWatch y alertedFraud al cambiar de jornada. |
| 24 | L7524 | `colorAndAlert` | 🟢 Cubierta (Nombrada) | suite_04_agenda_alertas.js, suite_32_correccion_clinica_dom.js | Máquina de estados de colores (Verde, Ámbar, Morado, Rojo) y alertas de fraude. |
| 25 | L11756 | `apiAccesoBuscarPaciente` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js, suite_31_labs_rango_oficial.js | Consulta demográfica del paciente en la base de Everest. |
| 26 | L11801 | `apiAccesoBuscarCitasDisponibles` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Consulta de cupos reales en la agenda de la sede. |
| 27 | L11931 | `perfilPaciente` | 🟢 Cubierta (Nombrada) | suite_24_motor_perfil.js, suite_34_cobertura_alto_riesgo_mutantes.js | Determinación de perfil clínico del paciente para sugerencias. |
| 28 | L12010 | `recomendacionHorario` | 🟢 Cubierta (Nombrada) | suite_24_motor_perfil.js | Sugerencia de franja horaria óptima para próxima cita. |
| 29 | L12136 | `apiLaboratorioAgendarAuto` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Mutación de Agenda: Agenda cita de toma de laboratorio en Everest. |
| 30 | L12261 | `apiDigiturnoFinalizarTicket` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js, suite_34_cobertura_alto_riesgo_mutantes.js | Cierra ticket en sistema de llamado de pacientes. |
| 31 | L12270 | `apiAccesoObtenerLaboratoriosAnnar` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js, suite_34_cobertura_alto_riesgo_mutantes.js | Consulta histórica de laboratorios en Annar. |
| 32 | L12274 | `apiAccesoObtenerLaboratoriosCiti` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js, suite_34_cobertura_alto_riesgo_mutantes.js | Consulta histórica de laboratorios en Citi. |
| 33 | L12288 | `apiHcObtenerOrdenamientosVigentes` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js, suite_34_cobertura_alto_riesgo_mutantes.js | Consulta órdenes activas del paciente para evitar duplicación. |
| 34 | L12441 | `apiHcObtenerSignosVitales` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js | Consulta peso y presión arterial en Everest para Cockcroft-Gault. |
| 35 | L12489 | `_pesoDeSignosVitales` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js, suite_34_cobertura_alto_riesgo_mutantes.js | Extrae peso corporal en kg para fórmula de función renal. |
| 36 | L12512 | `apiAccesoObtenerDemograficos` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js, suite_32_correccion_clinica_dom.js, suite_34_cobertura_alto_riesgo_mutantes.js | Consulta edad y sexo del paciente para cálculos clínicos. |
| 37 | L12545 | `_creatininaDeLabs` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js, suite_32_correccion_clinica_dom.js, suite_34_cobertura_alto_riesgo_mutantes.js | Extrae último valor de creatinina sérica para cálculo renal. |
| 38 | L12575 | `estadioRenalDelPaciente` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js, suite_32_correccion_clinica_dom.js | Orquesta cálculo de eGFR y clasificación en estadios G1 a G5. |
| 39 | L12642 | `calcularEstadioRenal` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js, suite_32_correccion_clinica_dom.js, suite_34_cobertura_alto_riesgo_mutantes.js | Clasificación numérica estricta según guías KDIGO. |
| 40 | L12733 | `pymCubiertoPorOrdenVigente` | 🟢 Cubierta (Nombrada) | suite_21_v12_4_pym_horas.js, suite_32_correccion_clinica_dom.js | Verifica si actividad PyM ya está cubierta por orden vigente en Everest. |
| 41 | L12784 | `apiAccesoAgdValidarAgenda` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js, suite_34_cobertura_alto_riesgo_mutantes.js | Valida restricciones de agenda antes de reservar. |
| 42 | L12794 | `apiAccesoObtenerTurnos` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js, suite_34_cobertura_alto_riesgo_mutantes.js | Obtiene turnos disponibles en la agenda médica. |
| 43 | L12840 | `apiAccesoAsignarTurno` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js, suite_34_cobertura_alto_riesgo_mutantes.js | Mutación de Agenda: Asigna cita médica definitiva en Everest. |
| 44 | L15921 | `apiOrdenamientoBuscarPaciente` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js, suite_34_cobertura_alto_riesgo_mutantes.js | Valida paciente en módulo de órdenes médicas. |
| 45 | L15936 | `apiOrdenamientoObtenerDx` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js, suite_34_cobertura_alto_riesgo_mutantes.js | Obtiene diagnósticos CIE-10 asociados al paciente. |
| 46 | L15955 | `apiOrdenamientoObtenerCup` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js, suite_34_cobertura_alto_riesgo_mutantes.js | Valida código CUPS y cobertura en el plan de beneficios. |
| 47 | L15989 | `apiOrdenamientoGuardar` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js, suite_34_cobertura_alto_riesgo_mutantes.js | Superficie de Escritura: Guarda orden médica oficial en Everest. |
| 48 | L16072 | `apiOrdenamientoGenerarLinks` | 🟢 Cubierta (Nombrada) | suite_20_correo_ordenes.js, suite_34_cobertura_alto_riesgo_mutantes.js | Genera enlaces de impresión y PDF de órdenes clínicas. |
| 49 | L17764 | `checkRacGuardia` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Protección de casilla: Guardia anti-borrado y respeto a la decisión médica. |

---

## 3. Funciones Sin Cubrir (62 funciones)
*Funciones presentes en el userscript pero ausentes de los arrays `cubre: [...]` de las suites de prueba:*

| # | Línea | Función | Nivel de Riesgo | Justificación / Plan de Cobertura |
|---|---|---|---|---|
| 1 | L15306 | `_afinarLabsPrimeroConCupos` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 2 | L14460 | `_agendasPropias` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 3 | L15268 | `_aplicarPlazoElegido` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 4 | L14470 | `_buscarDiaConAgendaPropia` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 5 | L15220 | `_derivarLabsPrimero` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 6 | L15201 | `_derivarSugerenciaBase` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 7 | L15193 | `_leerPlanActual` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 8 | L15290 | `_marcarPlazoSegunSugerida` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 9 | L15064 | `_pcCancelar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 10 | L15241 | `_pintarBannerSugerida` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 11 | L14394 | `_pintarPlanLinea` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 12 | L15336 | `_preseleccionarSugerencia` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 13 | L14956 | `_sondearAgendaDeCadaDia` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 14 | L13407 | `bgClick` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 15 | L16915 | `bind` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 16 | L21768 | `busca` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 17 | L8458 | `buscar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 18 | L14493 | `cargarHoras` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 19 | L14816 | `cargarHorasLab` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 20 | L15636 | `cargarHorasLabSolo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 21 | L8429 | `claves` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 22 | L7679 | `cleanup` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 23 | L7795 | `closeMod` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 24 | L16718 | `cnt` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 25 | L1808 | `d` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 26 | L2221 | `diag` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 27 | L21767 | `en` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 28 | L23412 | `enFalla` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 29 | L1883 | `enZonaMuerta` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 30 | L16100 | `esUrl` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 31 | L23276 | `esValorReal` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 32 | L13675 | `esc` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 33 | L21556 | `evaluar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 34 | L12688 | `fecha` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 35 | L4299 | `fila` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 36 | L7622 | `getFocusableElements` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 37 | L13157 | `getInfo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 38 | L14324 | `irAPaso` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 39 | L13756 | `lab` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 40 | L21862 | `limpiar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 41 | L1444 | `num` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 42 | L7629 | `onKeyDown` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 43 | L936 | `p` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 44 | L11556 | `pad` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 45 | L6271 | `paso` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 46 | L13862 | `pintar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 47 | L21026 | `pos` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 48 | L6344 | `q` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 49 | L2156 | `r` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 50 | L14902 | `renderDayChips` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 51 | L14856 | `renderLabDayChips` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 52 | L15681 | `renderLabDayChipsSolo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 53 | L14021 | `restaurar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 54 | L17709 | `san` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 55 | L13639 | `sigueVivo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 56 | L15898 | `stripToAlphanum` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 57 | L16820 | `sw` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 58 | L13130 | `trabajador` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 59 | L16353 | `updateCount` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 60 | L1027 | `val` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 61 | L8430 | `vals` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 62 | L13391 | `vivo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |

---

## 4. Funciones Declaradas pero Nunca Nombradas en Aserciones (0 funciones)
*Funciones autoinformadas en `cubre: [...]` pero cuyo identificador literal no aparece en el cuerpo de las pruebas:*

| # | Línea | Función | Nivel de Riesgo | Suites que la declaran |
|---|---|---|---|---|

---

## 5. Catálogo de Funciones de Riesgo MEDIO (647 funciones)

| Línea | Función | Estado | Suites |
|---|---|---|---|
| L936 | `p` | 🔴 Sin cubrir | - |
| L1022 | `vglLog` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L1027 | `val` | 🔴 Sin cubrir | - |
| L1060 | `vglExportLogs` | 🟢 Cubierta | suite_10_eventos_auditoria.js, suite_31_seguridad_phi_xss.js |
| L1439 | `_esUroComponenteAlterado` | 🟢 Cubierta | suite_51_uro_conducta.js |
| L1444 | `num` | 🔴 Sin cubrir | - |
| L1455 | `_clasificarComponentesUro` | 🟢 Cubierta | suite_51_uro_conducta.js |
| L1476 | `_resumenClinicoUro` | 🟢 Cubierta | suite_51_uro_conducta.js |
| L1521 | `_evaluarComplejidadPaciente` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L1615 | `fetchAtheneaLabs` | 🟢 Cubierta | suite_05_api_everest.js |
| L1724 | `_gmReq` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1732 | `_atheneaMultipart` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1742 | `_atheneaToken` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1748 | `_atheneaIdPaciente` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1798 | `_parseFechaEspanolLike` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1808 | `d` | 🔴 Sin cubrir | - |
| L1845 | `_atheneaExtraerSolicitudes` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1883 | `enZonaMuerta` | 🔴 Sin cubrir | - |
| L2033 | `_atheneaPareceLogin` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2077 | `_vglXor` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2078 | `_vglOfusca` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2079 | `_vglDesofusca` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2080 | `atheneaCredsGet` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2097 | `atheneaCredsSet` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2111 | `atheneaCredsClear` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2128 | `atheneaAutoLogin` | 🟢 Cubierta | suite_18_athenea_bridge.js, suite_33_robustez_concurrencia_red.js |
| L2156 | `r` | 🔴 Sin cubrir | - |
| L2189 | `atheneaKeepAlive` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2217 | `getAtheneaSolicitudesAuto` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2221 | `diag` | 🔴 Sin cubrir | - |
| L2291 | `getAtheneaLabsAuto` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2302 | `_getAtheneaLabsAutoNucleo` | 🟢 Cubierta | suite_61_v158_ux.js |
| L2331 | `setNgValue` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2472 | `_parseFechaHoraLike` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L2533 | `_parseFechaLike` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2635 | `_nuevoReemplazaCandidato` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2649 | `_esLdlDirecto` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2663 | `_resolverLdlPorTrigliceridos` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2672 | `_ultimaFechaPorAnalito` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2762 | `_objecionOficialAlValor` | 🟢 Cubierta | suite_31_labs_rango_oficial.js |
| L2787 | `_textoImplausibles` | 🟢 Cubierta | suite_31_labs_rango_oficial.js |
| L2813 | `_contextoOficialParaLabs` | 🟢 Cubierta | suite_31_labs_rango_oficial.js |
| L3253 | `limpio` | 🟢 Cubierta | suite_01_texto_datos.js |
| L3301 | `_numeroEstricto` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3311 | `_reglaExamenAplicable` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3340 | `_reglasDeExamen` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3353 | `_unidadOficialDeExamen` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3369 | `_plausibilidadOficial` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3438 | `_reglasParaLabKey` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3447 | `_labKeyDesdeCodigoExamen` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3463 | `_casillasObligatoriasVacias` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L3492 | `_vigenciaDiasParaAnalito` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L3544 | `ckdEpi2021` | 🟢 Cubierta | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js |
| L3557 | `estadioKDIGO` | 🟢 Cubierta | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js |
| L3581 | `evaluarDiscordanciaTFG` | 🟢 Cubierta | suite_27_funcion_renal.js |
| L3699 | `vigenciaPorEstadio` | 🟢 Cubierta | suite_28_vigencias_estadio.js |
| L3729 | `analitoTablaDesdeClaveRcv` | 🟢 Cubierta | suite_28_vigencias_estadio.js |
| L3780 | `_getRacGuardiaParaTest` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L3781 | `_setRacGuardiaParaTest` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L3783 | `autoFetchAtheneaLabsForActivePatient` | 🟢 Cubierta | suite_17_nucleo.js |
| L3845 | `createLabInjectorUI` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4000 | `_vglDockRotulo` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4012 | `createAccionesDockUI` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4281 | `_casillasExamenFisico` | 🟢 Cubierta | suite_15_interfaz_avanzada.js, suite_42_canales_de_aviso.js |
| L4296 | `_etiquetaCercanaCasilla` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4299 | `fila` | 🔴 Sin cubrir | - |
| L4316 | `_examenFisicoAnclas` | 🟢 Cubierta | suite_52_agend_pendiente.js |
| L4364 | `_excluirMamasGenitoPorTexto` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4401 | `_vglGuardarDeshacer` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4405 | `_vglDeshacerDisponible` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4408 | `_vglEjecutarDeshacer` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4423 | `_vglOfrecerDeshacer` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4440 | `_vglFeedbackBoton` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4448 | `createExamenFisicoInjectorUI` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L4570 | `debounceVgl` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4580 | `scrubPII` | 🟢 Cubierta | suite_31_seguridad_phi_xss.js |
| L4609 | `sanitizePII` | 🟢 Cubierta | suite_01_texto_datos.js, suite_31_seguridad_phi_xss.js |
| L4642 | `yieldNow` | 🟢 Cubierta | suite_17_nucleo.js |
| L4646 | `makeYielder` | 🟢 Cubierta | suite_17_nucleo.js |
| L4658 | `idleRun` | 🟢 Cubierta | suite_17_nucleo.js |
| L4721 | `safeReadJSON` | 🟢 Cubierta | suite_33_robustez_concurrencia_red.js |
| L4737 | `readJSON` | 🟢 Cubierta | suite_09_ajustes.js |
| L4743 | `purgaPorCuota` | 🟢 Cubierta | suite_19_identidad_cuota.js, suite_33_robustez_concurrencia_red.js |
| L4752 | `safeWriteJSON` | 🟢 Cubierta | suite_33_robustez_concurrencia_red.js |
| L4759 | `writeJSON` | 🟢 Cubierta | suite_09_ajustes.js |
| L4814 | `saveSettings` | 🟢 Cubierta | suite_09_ajustes.js |
| L4822 | `getProcessedToday` | 🟢 Cubierta | suite_09_ajustes.js, suite_33_robustez_concurrencia_red.js |
| L4832 | `isCitaAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L4837 | `isOrdenesCreadasHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L4850 | `isLabAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L4857 | `citaAgendadaFechaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L4862 | `markCitaAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js, suite_33_robustez_concurrencia_red.js |
| L4878 | `markLabAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L4893 | `vglNotificarCompletado` | 🟢 Cubierta | suite_52_agend_pendiente.js |
| L4915 | `markAgendamientoPendiente` | 🟢 Cubierta | suite_52_agend_pendiente.js |
| L4922 | `clearAgendamientoPendiente` | 🟢 Cubierta | suite_52_agend_pendiente.js |
| L4928 | `isAgendamientoPendiente` | 🟢 Cubierta | suite_52_agend_pendiente.js |
| L4951 | `markOrdenesCreadasHoy` | 🟢 Cubierta | suite_09_ajustes.js, suite_33_robustez_concurrencia_red.js |
| L4978 | `ordenesDetalleHoy` | 🟢 Cubierta | suite_20_correo_ordenes.js |
| L4983 | `applySettings` | 🟢 Cubierta | suite_09_ajustes.js |
| L4992 | `clampNum` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4993 | `darkPreferred` | 🟢 Cubierta | suite_09_ajustes.js |
| L4994 | `isLight` | 🟢 Cubierta | suite_09_ajustes.js |
| L4995 | `applyTheme` | 🟢 Cubierta | suite_09_ajustes.js |
| L5029 | `_fzZoomDe` | 🟢 Cubierta | suite_61_v158_ux.js |
| L5035 | `aplicarTamanoLetra` | 🟢 Cubierta | suite_61_v158_ux.js |
| L5118 | `detalleTipoCervix` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5223 | `_relojIniciar` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js, suite_60_reloj_segundo_plano.js |
| L5247 | `_relojVigilarWorker` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js |
| L5266 | `_relojDegradar` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js, suite_60_reloj_segundo_plano.js |
| L5277 | `_relojCada` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js |
| L5286 | `_relojDetener` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js |
| L5293 | `_relojDetenerTodo` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js |
| L5298 | `_relojEstadoParaTest` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js |
| L5299 | `_relojAjustarParaTest` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js |
| L5305 | `_avisarPestanaDescartada` | 🟢 Cubierta | suite_60_reloj_segundo_plano.js |
| L5320 | `restartPolling` | 🟢 Cubierta | suite_09_ajustes.js |
| L5364 | `_pestanaOculta` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L5369 | `_getUltimoRelevoParaTest` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L5370 | `_setUltimoRelevoParaTest` | 🟢 Cubierta | suite_17_nucleo.js |
| L5371 | `heartbeat` | 🟢 Cubierta | suite_17_nucleo.js |
| L5411 | `share` | 🟢 Cubierta | suite_17_nucleo.js |
| L5414 | `normalizeKey` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5425 | `extractDoc` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5428 | `isPending` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5438 | `esSi` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5442 | `friendly` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5464 | `activityLabel` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5465 | `stripAccents` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5466 | `isExcludedActivity` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5471 | `getActivities` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5475 | `isPanelHiddenActivity` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L5476 | `panelActivities` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L5482 | `pymPendientesRestantes` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L5498 | `makeIndexer` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5580 | `indexRowsAsync` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5588 | `parseCSV` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5606 | `inflateRaw` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5625 | `unescXml` | 🟢 Cubierta | suite_01_texto_datos.js, suite_07_excel_parser.js |
| L5654 | `parseSharedStringsStream` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5683 | `parseRowBody` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5713 | `scanSheetRows` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5754 | `zipIndex` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5782 | `zipRead` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5791 | `sheetOrder` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5807 | `scoreSheet` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5825 | `findDocIdx` | 🟢 Cubierta | suite_07_excel_parser.js |
| L5835 | `_readPymWorkbookStreamCore` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5889 | `readPymWorkbookStream` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5903 | `progreso` | 🟢 Cubierta | suite_16_excel_stream.js |
| L6008 | `afterPymLoaded` | 🟢 Cubierta | suite_16_excel_stream.js |
| L6030 | `debeBuscarPymDiario` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L6034 | `pymFP` | 🟢 Cubierta | suite_16_excel_stream.js |
| L6044 | `packPym` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6066 | `unpackPym` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6092 | `applyPymIdx` | 🟢 Cubierta | suite_16_excel_stream.js |
| L6109 | `savePymCache` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6129 | `allStats` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6130 | `statsToday` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6131 | `bumpStat` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6138 | `purgeOld` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6143 | `lastDays` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6153 | `evKey` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6155 | `evFlush` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6168 | `logEvent` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6182 | `eventsOf` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6184 | `purgeEventDays` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6213 | `csvCell` | 🟢 Cubierta | suite_01_texto_datos.js |
| L6214 | `downloadBlob` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L6218 | `exportAudit` | 🟢 Cubierta | suite_10_eventos_auditoria.js, suite_32_correccion_clinica_dom.js |
| L6253 | `repUrl` | 🟢 Cubierta | suite_11_reportes.js |
| L6254 | `repOn` | 🟢 Cubierta | suite_11_reportes.js |
| L6260 | `_repSello` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6269 | `repDiagnostico` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6271 | `paso` | 🔴 Sin cubrir | - |
| L6294 | `repPost` | 🟢 Cubierta | suite_11_reportes.js |
| L6315 | `repBeacon` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6341 | `repQLoad` | 🟢 Cubierta | suite_11_reportes.js, suite_33_robustez_concurrencia_red.js |
| L6342 | `repQSave` | 🟢 Cubierta | suite_11_reportes.js, suite_33_robustez_concurrencia_red.js |
| L6356 | `repFlush` | 🟢 Cubierta | suite_11_reportes.js |
| L6373 | `_equipoId` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6392 | `_loteId` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L6397 | `reportar` | 🟢 Cubierta | suite_11_reportes.js, suite_23_ux_telemetria.js |
| L6408 | `repEntornoDiario` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L6443 | `_migaPush` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L6447 | `_sanearMensajeError` | 🟢 Cubierta | suite_23_ux_telemetria.js, suite_31_seguridad_phi_xss.js |
| L6458 | `reportarError` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6516 | `_esErrorPropio` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6521 | `_getFirmaPropiaParaTest` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6522 | `_setFirmaPropiaParaTest` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6528 | `_iniciarRumObserver` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6578 | `_rageEtiqueta` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6592 | `_detectarRageClick` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6612 | `_instalarRageTracker` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6625 | `_vaciarTelemetriaAlSalir` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6648 | `_instalarDescargaResiliente` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6659 | `_instalarCazaErrores` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6688 | `repDailySummary` | 🟢 Cubierta | suite_11_reportes.js |
| L6701 | `reportarFraude` | 🟢 Cubierta | suite_11_reportes.js |
| L6723 | `uxVentanaNueva` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L6747 | `uxClaveLimpia` | 🟢 Cubierta | suite_17_nucleo.js |
| L6761 | `_uxVolcarBuffer` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6778 | `uxTrack` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6796 | `uxEnviarVentana` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6822 | `uxFlush` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6836 | `uxBootCheck` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L6848 | `todayStamp` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L6849 | `spBase` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6855 | `todayTokens` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6864 | `normName` | 🟢 Cubierta | suite_01_texto_datos.js, suite_03_excel_pym.js |
| L6871 | `nameHasToken` | 🟢 Cubierta | suite_01_texto_datos.js, suite_03_excel_pym.js |
| L6876 | `esNombreDeHoy` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6881 | `pickTodaysFile` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6898 | `xlsViejoDeHoy` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6902 | `spListUrl` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6903 | `spRows` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6904 | `spDownloadUrl` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6907 | `gmJson` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6916 | `primeShareAccess` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6925 | `parseSpDocId` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6933 | `spFallbackUrls` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6941 | `readPym` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6953 | `gmGet` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L6967 | `loadPymFromCache` | 🟢 Cubierta | suite_03_excel_pym.js |
| L6992 | `esLibroValido` | 🟢 Cubierta | suite_03_excel_pym.js |
| L7003 | `esXlsxCifrado` | 🟢 Cubierta | suite_03_excel_pym.js |
| L7020 | `pilotoId` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7021 | `pilotoDesdeCache` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7035 | `pilotoGuardar` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7043 | `pilotoMeta` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7053 | `pilotoFreshCheck` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7067 | `loadPymBase` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7077 | `loadPymBaseDescarga` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7141 | `fetchSpFilesMultiFolder` | 🟢 Cubierta | suite_03_excel_pym.js |
| L7161 | `loadPymDiario` | 🟢 Cubierta | suite_03_excel_pym.js |
| L7224 | `bootSharepointLite` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7271 | `schedulePymBase` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7291 | `dismissSpToast` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7302 | `spToast` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7345 | `loadPymFile` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L7358 | `firstMatch` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L7359 | `containerOf` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L7365 | `extractAgenda` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L7406 | `_enModuloHCHealth` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L7411 | `seccionActiva` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L7556 | `muted` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7557 | `muteFor` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7558 | `unmute` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7610 | `_activarAccesibilidadModal` | 🟢 Cubierta | suite_35_interfaz_accesibilidad_medica.js |
| L7622 | `getFocusableElements` | 🔴 Sin cubrir | - |
| L7629 | `onKeyDown` | 🔴 Sin cubrir | - |
| L7679 | `cleanup` | 🔴 Sin cubrir | - |
| L7704 | `_vglTipCerrar` | 🟢 Cubierta | suite_59_burbujas_ux.js |
| L7713 | `_vglTipTeclado` | 🟢 Cubierta | suite_59_burbujas_ux.js |
| L7723 | `_vglTipAbrir` | 🟢 Cubierta | suite_59_burbujas_ux.js |
| L7750 | `_vglTipInstalar` | 🟢 Cubierta | suite_59_burbujas_ux.js |
| L7769 | `vglTip` | 🟢 Cubierta | suite_59_burbujas_ux.js |
| L7776 | `bigAlert` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7795 | `closeMod` | 🔴 Sin cubrir | - |
| L7803 | `acknowledge` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7842 | `_avisoUnivReset` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7843 | `avisoUniversal` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7887 | `checkAvisoUniversal` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7941 | `crossTabDup` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7946 | `avisoYaVisto` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7954 | `avisoMarcarVisto` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7963 | `osNotify` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7993 | `_renderToast` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8023 | `showToast` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8040 | `notify` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8052 | `_gmNotify` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L8080 | `nkey` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8097 | `_encolarAvisoPendiente` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8111 | `_flushAvisosPendientes` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8162 | `_notificarSistema` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8169 | `_dispararAvisoAudible` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8189 | `_dispararAvisoCartel` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8192 | `_dispararAvisoReal` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8206 | `_siembraCompartidaLeer` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8214 | `_siembraCompartidaGuardar` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8227 | `_sembrarEstadoInicial` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8240 | `maybeNotify` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L8273 | `updateBell` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8282 | `testNotifications` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8299 | `enableOsNotifications` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8333 | `apiRecordar` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8367 | `invalidarApiSiCambioMedico` | 🟢 Cubierta | suite_19_identidad_cuota.js, suite_33_robustez_concurrencia_red.js |
| L8386 | `apiSniffPerf` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8398 | `apiObservar` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8417 | `apiLista` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8426 | `apiCampos` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8429 | `claves` | 🔴 Sin cubrir | - |
| L8430 | `vals` | 🔴 Sin cubrir | - |
| L8458 | `buscar` | 🔴 Sin cubrir | - |
| L8476 | `apiParse` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8508 | `leerConTope` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8527 | `apiLeerAgenda` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8579 | `purgarApiUrl` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L8587 | `apiUtil` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8590 | `apiSano` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8594 | `apiEspera` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8659 | `apiCadencia` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8687 | `tickApi` | 🟢 Cubierta | suite_13_api_agenda.js |
| L8709 | `hayVentanaCritica` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L8746 | `setWinState` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L8897 | `buildOverlay` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L11354 | `captureDoctorInfo` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L11441 | `resolverMedicoPorPerfil` | 🟢 Cubierta | suite_17_nucleo.js |
| L11468 | `identidadDesdeCliente` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L11570 | `_pageFetchJsonCore` | 🟢 Cubierta | suite_05_api_everest.js, suite_33_robustez_concurrencia_red.js |
| L11670 | `_rumEndpointLabel` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L11678 | `_rumTrack` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L11690 | `pageFetchJson` | 🟢 Cubierta | suite_05_api_everest.js |
| L11705 | `extractPatientId` | 🟢 Cubierta | suite_05_api_everest.js |
| L11847 | `calcBusinessDaysAfter` | 🟢 Cubierta | suite_52_agend_pendiente.js |
| L11864 | `gmPostJson` | 🟢 Cubierta | suite_17_nucleo.js |
| L11886 | `gmPostJsonEx` | 🟢 Cubierta | suite_17_nucleo.js |
| L11914 | `hora24De` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L11990 | `perfilRefinadoConResumen` | 🟢 Cubierta | suite_52_agend_pendiente.js |
| L12095 | `esCupoAdicional` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L12104 | `clasificaCupoAgenda` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L12287 | `_ordenesVigentesInvalidar` | 🟢 Cubierta | suite_32_correccion_clinica_dom.js |
| L12330 | `_signosVitalesInvalidar` | 🟢 Cubierta | suite_29_estadio_renal_r1b.js |
| L12340 | `_base64SinRelleno` | 🟢 Cubierta | suite_31_labs_rango_oficial.js |
| L12346 | `apiHcValidacionExamenCronicos` | 🟢 Cubierta | suite_30_rangos_oficiales.js |
| L12403 | `_guardarTablaOficialVista` | 🟢 Cubierta | suite_31_labs_rango_oficial.js |
| L12409 | `_tablaOficialVigente` | 🟢 Cubierta | suite_31_labs_rango_oficial.js |
| L12414 | `_instalarOyenteTablaOficial` | 🟢 Cubierta | suite_31_labs_rango_oficial.js |
| L12469 | `_signosVitalesDelRegistro` | 🟢 Cubierta | suite_29_estadio_renal_r1b.js |
| L12511 | `_demograficosInvalidar` | 🟢 Cubierta | suite_32_correccion_clinica_dom.js |
| L12667 | `_renderEstadioRenalHtml` | 🟢 Cubierta | suite_29_estadio_renal_r1b.js, suite_32_correccion_clinica_dom.js |
| L12688 | `fecha` | 🔴 Sin cubrir | - |
| L12812 | `esMedicoRCVActivo` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12821 | `_smsVistaPrevia` | 🟢 Cubierta | suite_61_v158_ux.js |
| L12902 | `_anularCitaAsignadaReal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12954 | `_anularCitaMarcasLocales` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12977 | `_anularCitaAsignada` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12980 | `_deshacerOrdenesPyM` | 🟢 Cubierta | suite_53_conducta_codigo.js |
| L13031 | `imprimirRecordatorioCita` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13046 | `mostrarPanelPostCita` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13088 | `extractAgendasList` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L13121 | `mapConLimite` | 🟢 Cubierta | suite_22_utilidades_puras.js |
| L13130 | `trabajador` | 🔴 Sin cubrir | - |
| L13157 | `getInfo` | 🔴 Sin cubrir | - |
| L13308 | `_labReferenciaDe` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13334 | `openLaboratoriosModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js, suite_31_seguridad_phi_xss.js |
| L13391 | `vivo` | 🔴 Sin cubrir | - |
| L13407 | `bgClick` | 🔴 Sin cubrir | - |
| L13637 | `mtrCalcularResumenClinico` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13639 | `sigueVivo` | 🔴 Sin cubrir | - |
| L13674 | `mtrRenderRiesgoModalHtml` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13675 | `esc` | 🔴 Sin cubrir | - |
| L13741 | `mtrFichaVivaFilas` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13756 | `lab` | 🔴 Sin cubrir | - |
| L13808 | `abrirRedactorTextoLibre` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13834 | `openFichaPacienteModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13862 | `pintar` | 🔴 Sin cubrir | - |
| L13912 | `openRiesgoModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L14015 | `abrirInformeAthenea` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L14021 | `restaurar` | 🔴 Sin cubrir | - |
| L14063 | `openAgendamientoModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L14324 | `irAPaso` | 🔴 Sin cubrir | - |
| L14394 | `_pintarPlanLinea` | 🔴 Sin cubrir | - |
| L14460 | `_agendasPropias` | 🔴 Sin cubrir | - |
| L14470 | `_buscarDiaConAgendaPropia` | 🔴 Sin cubrir | - |
| L14493 | `cargarHoras` | 🔴 Sin cubrir | - |
| L14816 | `cargarHorasLab` | 🔴 Sin cubrir | - |
| L14856 | `renderLabDayChips` | 🔴 Sin cubrir | - |
| L14902 | `renderDayChips` | 🔴 Sin cubrir | - |
| L14956 | `_sondearAgendaDeCadaDia` | 🔴 Sin cubrir | - |
| L15064 | `_pcCancelar` | 🔴 Sin cubrir | - |
| L15193 | `_leerPlanActual` | 🔴 Sin cubrir | - |
| L15201 | `_derivarSugerenciaBase` | 🔴 Sin cubrir | - |
| L15220 | `_derivarLabsPrimero` | 🔴 Sin cubrir | - |
| L15241 | `_pintarBannerSugerida` | 🔴 Sin cubrir | - |
| L15268 | `_aplicarPlazoElegido` | 🔴 Sin cubrir | - |
| L15290 | `_marcarPlazoSegunSugerida` | 🔴 Sin cubrir | - |
| L15306 | `_afinarLabsPrimeroConCupos` | 🔴 Sin cubrir | - |
| L15336 | `_preseleccionarSugerencia` | 🔴 Sin cubrir | - |
| L15515 | `openLabSoloModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L15636 | `cargarHorasLabSolo` | 🔴 Sin cubrir | - |
| L15681 | `renderLabDayChipsSolo` | 🔴 Sin cubrir | - |
| L15897 | `pymPaquetesDelPaciente` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16044 | `extractAgrupador` | 🟢 Cubierta | suite_20_correo_ordenes.js |
| L16099 | `_urlImpresionOrdenPyM` | 🟢 Cubierta | suite_15_interfaz_avanzada.js, suite_20_correo_ordenes.js |
| L16100 | `esUrl` | 🔴 Sin cubrir | - |
| L16119 | `apiEnviarOrdenPorCorreo` | 🟢 Cubierta | suite_20_correo_ordenes.js |
| L16163 | `imprimirOrdenPyM` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16173 | `openOrdenamientoModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16353 | `updateCount` | 🔴 Sin cubrir | - |
| L16675 | `sheetHeader` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16678 | `wireClose` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16681 | `renderResumen` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16716 | `copySummary` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16739 | `_ajustesSucio` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16740 | `_ajustesPonBorrador` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16747 | `_ajustesPintarBarra` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16750 | `_ajustesGuardar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16760 | `_ajustesDescartar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16767 | `_ajustesIntentarCerrar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16786 | `_vglAlternarModoProg` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16793 | `_vglInstalarModoProg` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16805 | `renderSettings` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17038 | `paintMute` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17049 | `repaint` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17051 | `makeDraggable` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17073 | `setSummary` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17081 | `fraudesHoy` | 🟢 Cubierta | suite_06_interfaz.js, suite_42_canales_de_aviso.js |
| L17086 | `renderStats` | 🟢 Cubierta | suite_06_interfaz.js, suite_42_canales_de_aviso.js |
| L17117 | `tieneAbandonoPES` | 🟢 Cubierta | suite_06_interfaz.js |
| L17124 | `candidatoAdicional` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17191 | `matchesSearch` | 🟢 Cubierta | suite_06_interfaz.js |
| L17197 | `matchesFilter` | 🟢 Cubierta | suite_06_interfaz.js |
| L17261 | `_saludMarca` | 🟢 Cubierta | suite_61_v158_ux.js |
| L17270 | `_saludEstado` | 🟢 Cubierta | suite_61_v158_ux.js |
| L17276 | `_saludHayAlerta` | 🟢 Cubierta | suite_61_v158_ux.js |
| L17282 | `_saludGlobitoHtml` | 🟢 Cubierta | suite_61_v158_ux.js |
| L17295 | `_saludGlobitoToggle` | 🟢 Cubierta | suite_61_v158_ux.js |
| L17311 | `render` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17423 | `refrescarCuentas` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L17450 | `verificarIntegridadArranque` | 🟢 Cubierta | suite_31_seguridad_phi_xss.js |
| L17473 | `helloOncePerDay` | 🟢 Cubierta | suite_17_nucleo.js |
| L17487 | `tick` | 🟢 Cubierta | suite_17_nucleo.js |
| L17684 | `_urlDiagnostico` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L17696 | `_tituloDiagnostico` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L17703 | `downloadDiagnostic` | 🟢 Cubierta | suite_17_nucleo.js |
| L17792 | `pymReminderCheck` | 🟢 Cubierta | suite_17_nucleo.js |
| L17811 | `avisarSiActualizado` | 🟢 Cubierta | suite_17_nucleo.js |
| L17828 | `chequearAutoUpdateLento` | 🟢 Cubierta | suite_17_nucleo.js |
| L17847 | `mtrVersionEsMasNueva` | 🟢 Cubierta | suite_53_conducta_codigo.js |
| L17866 | `mtrCheckActualizacionGist` | 🟢 Cubierta | suite_53_conducta_codigo.js |
| L17901 | `mtrSondaPestanias` | 🟢 Cubierta | suite_55_framingham_oficial.js |
| L17928 | `emergencyTeardown` | 🟢 Cubierta | suite_30_killswitch_canario.js |
| L17960 | `_mostrarAvisoPausaClinica` | 🟢 Cubierta | suite_35_interfaz_accesibilidad_medica.js |
| L17978 | `_detectarInstanciaDuplicada` | 🟢 Cubierta | suite_36_entrega_runbook_prr.js |
| L18017 | `_mostrarAvisoInstanciaDuplicada` | 🟢 Cubierta | suite_36_entrega_runbook_prr.js |
| L18046 | `checkVersionMinimum` | 🟢 Cubierta | suite_17_nucleo.js, suite_30_killswitch_canario.js |
| L18172 | `_acompStoreLeer` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18175 | `_acompStoreGuardar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18178 | `_acompMedId` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18182 | `_acompEstadoLeer` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18189 | `_acompEstadoGuardar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18197 | `_acompActivo` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18206 | `_acompNotificarAccion` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18220 | `_acompSugerencia` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18247 | `_acompCerrar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18256 | `_acompMostrar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18300 | `_acompTick` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18317 | `_vglModoOcultoLeer` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18320 | `_vglModoOcultoAplicar` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18323 | `_vglAlternarOculto` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18331 | `_vglInstalarModoOculto` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18364 | `_festivosAvisarSiVencida` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L18378 | `boot` | 🟢 Cubierta | suite_17_nucleo.js |
| L18584 | `mtrRound` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18603 | `mtrEsFalsy` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18609 | `mtrFloat` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18621 | `mtrNormalizarTexto` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18628 | `mtrFechaDesdeIso` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18643 | `mtrEsFecha` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18647 | `mtrIsoDesdeFecha` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18653 | `mtrSumarDias` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18661 | `mtrFechaIso` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L18677 | `mtrEsFestivoCO` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L18690 | `mtrEsDiaNoHabil` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L18731 | `mtrIsoAFechaAgenda` | 🟢 Cubierta | suite_61_v158_ux.js |
| L18740 | `mtrListaDiasBusquedaCupo` | 🟢 Cubierta | suite_61_v158_ux.js |
| L18754 | `mtrPlazoMasCercano` | 🟢 Cubierta | suite_61_v158_ux.js |
| L18769 | `mtrSugerenciaPorPlazo` | 🟢 Cubierta | suite_61_v158_ux.js |
| L18811 | `mtrPlanLabsPrimero` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L18831 | `mtrControlDesdeLabs` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L18835 | `mtrAjustarFechaHabil` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L18852 | `mtrRetrocederADiaHabil` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18863 | `mtrSumarDiasHabiles` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L18874 | `mtrDiaValidoParaControl` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L18890 | `mtrFechaControlDesdeFtl` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L18904 | `mtrProgramaRector` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L18954 | `mtrIdxEstadio` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18965 | `mtrAcortarRacSiAlbuminuria` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L18978 | `mtrVigenciaDias` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L19010 | `mtrNormEstadio` | 🟢 Cubierta | suite_38_motor_fechas.js |
| L19016 | `mtrVentanaAnrDias` | 🟢 Cubierta | suite_38_motor_fechas.js, suite_43_conformidad_cruzada.js |
| L19030 | `mtrCnoHDL` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19038 | `mtrReduccionLdlPct` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19048 | `mtrNormalizarRiesgoCv` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19092 | `mtrAlerta` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19107 | `mtrFmt1` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19150 | `mtrPrincipioEnTexto` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19160 | `mtrReglaMetformina` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19174 | `mtrReglaRosuvastatina` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19189 | `mtrReglaEspironolactona` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19203 | `mtrReglaFenofibrato` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19217 | `mtrReglaBetabloqueadorHidrofilico` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19231 | `mtrReglaTiazida` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19240 | `mtrReglaSulfonilurea` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19254 | `mtrReglaAlopurinol` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19263 | `mtrReglaColchicina` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19272 | `mtrReglaDigoxina` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19281 | `mtrReglaAines` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19290 | `mtrReglaNitrofurantoina` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19299 | `mtrReglaArbIeca` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19313 | `mtrReglaInsulina` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19327 | `mtrReglaLmwh` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19341 | `mtrReglaSuplementoK` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19353 | `mtrFmt0` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19360 | `mtrAlertaSuave` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19367 | `mtrReglaSglt2` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19405 | `mtrReglaDpp4` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19421 | `mtrReglaGlp1Ra` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19432 | `mtrReglaGabapentinoide` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19471 | `mtrReglaDoac` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19510 | `mtrReglaFurosemida` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19546 | `mtrClasificarEstadioTfg` | 🟢 Cubierta | suite_31_seguridad_phi_xss.js, suite_39_motor_farmaco.js |
| L19559 | `mtrEvaluarDiscrepanciaEstadios` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19580 | `mtrNumPy` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19585 | `mtrDetectarGruposFarmacologicos` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19601 | `mtrDetectarPrincipios` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19613 | `mtrReglaErcG3aA2` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19683 | `mtrEvaluarSeguridadDosisRenal` | 🟢 Cubierta | suite_43_conformidad_cruzada.js |
| L19767 | `mtrMotorEncendido` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19785 | `mtrLeerMedicamentos` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19793 | `mtrMedsInvalidar` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19798 | `mtrRefrescarMedicamentos` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19810 | `mtrLeerFactoresRCV` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19816 | `mtrAvisosDosisRenal` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19892 | `mtrFechaEverest` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19905 | `mtrMedicamentosDesdeRespuesta` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19928 | `mtrRenglonesMedicamentoDesdeRespuesta` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L19957 | `mtrPedirMedicamentos` | 🟢 Cubierta | suite_39_motor_farmaco.js |
| L20016 | `mtrAlertaInteraccion` | 🟢 Cubierta | suite_40_motor_interacciones.js |
| L20030 | `mtrUnirFarmacos` | 🟢 Cubierta | suite_40_motor_interacciones.js |
| L20046 | `mtrEvaluarInteracciones` | 🟢 Cubierta | suite_40_motor_interacciones.js, suite_43_conformidad_cruzada.js |
| L20185 | `mtrDetectarGruposAmp` | 🟢 Cubierta | suite_54_farmaco_rcv.js |
| L20209 | `mtrEsSuplementoKReal` | 🟢 Cubierta | suite_54_farmaco_rcv.js |
| L20216 | `mtrEvaluarInteraccionesAmpliadas` | 🟢 Cubierta | suite_54_farmaco_rcv.js |
| L20366 | `mtrMedsSinGrupo` | 🟢 Cubierta | suite_55_framingham_oficial.js |
| L20381 | `mtrReglasRenalesAmpliadas` | 🟢 Cubierta | suite_54_farmaco_rcv.js |
| L20402 | `mtrAvisosFarmacologicos` | 🟢 Cubierta | suite_40_motor_interacciones.js |
| L20478 | `mtrEtiquetaAviso` | 🟢 Cubierta | suite_41_motor_vista.js |
| L20486 | `mtrPintarAviso` | 🟢 Cubierta | suite_41_motor_vista.js |
| L20507 | `mtrRenderAvisosHtml` | 🟢 Cubierta | suite_41_motor_vista.js |
| L20574 | `mtrEsSexoFemenino` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20580 | `mtrEsSexoMasculino` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20588 | `mtrAscvdFueraDeRangoEtario` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20602 | `mtrAscvdPceCrudo` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20634 | `mtrContarFrMayores` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20653 | `mtrContarPotenciadores` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20674 | `mtrCriteriosPaso1` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20697 | `mtrCriteriosPaso2` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20725 | `mtrClasificarRiesgoCv` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20796 | `mtrMetasLipidicas` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20807 | `mtrEvaluarMetaLdl` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L20892 | `mtrLeerRadioSiNo` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L20925 | `mtrLeerCampoNumerico` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L20947 | `mtrLeerFactoresRcvDelDom` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21023 | `mtrPosEstadio` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L21026 | `pos` | 🔴 Sin cubrir | - |
| L21032 | `mtrRemisionNefrologia` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L21049 | `mtrSospechaIra` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L21058 | `mtrEvaluarErc` | 🟢 Cubierta | suite_45_riesgo_cv.js |
| L21162 | `mtrOrdinalSabadoDelMes` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21170 | `mtrGrupoDeEsteSabado` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21181 | `mtrMedicoTrabajaSabado` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21193 | `mtrDeducirGrupoSabado` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21225 | `mtrSabadoMemoriaLeer` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21234 | `mtrSabadoMemoriaGuardar` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21242 | `mtrSabadoGrupoDeMedico` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21261 | `mtrSabadoRegistrarObservacion` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21277 | `mtrSabadoFijarGrupoManual` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21298 | `mtrDiaValidoParaControlConSabado` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21313 | `mtrFechaControlSugerida` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21405 | `mtrVigenciaDiasNorma` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21437 | `mtrColapsarVigencia` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21488 | `mtrEstadoAnalito` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21550 | `mtrPlanParaclinicos` | 🟢 Cubierta | suite_46_ftl_sabados.js |
| L21556 | `evaluar` | 🔴 Sin cubrir | - |
| L21702 | `mtrClaseCategoria` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L21714 | `mtrFechaLegible` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L21748 | `mtrFraminghamEverest` | 🟢 Cubierta | suite_55_framingham_oficial.js |
| L21767 | `en` | 🔴 Sin cubrir | - |
| L21768 | `busca` | 🔴 Sin cubrir | - |
| L21797 | `mtrSugerirFindrisc` | 🟢 Cubierta | suite_55_framingham_oficial.js |
| L21837 | `mtrRelativizarFecha` | 🟢 Cubierta | suite_56_hoja_hechos.js |
| L21859 | `mtrHojaDeHechos` | 🟢 Cubierta | suite_56_hoja_hechos.js |
| L21862 | `limpiar` | 🔴 Sin cubrir | - |
| L21927 | `mtrHojaDeHechosTexto` | 🟢 Cubierta | suite_56_hoja_hechos.js |
| L21966 | `mtrGuardarClaveGemini` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L21969 | `mtrLeerClaveGemini` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L21972 | `_mtrModeloIdx` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L21982 | `mtrModeloGemini` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L21983 | `mtrRotarModelo` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L21995 | `mtrEstiloGuardar` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22013 | `mtrEstiloLeer` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22169 | `mtrSanearTextoLibreAI` | 🟢 Cubierta | suite_31_seguridad_phi_xss.js, suite_56_hoja_hechos.js |
| L22191 | `mtrDatosExtraTexto` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22202 | `mtrRedaccionPrompt` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22258 | `mtrRespuestaGemini` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22280 | `mtrCalcularDeltaEdicion` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22304 | `mtrPartirNota` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22324 | `mtrEsCuotaAgotada` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22329 | `mtrGeminiRedactar` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22424 | `mtrCasillaPorNombre` | 🟢 Cubierta | suite_58_ia_insercion.js |
| L22431 | `mtrCasillaAnalisis` | 🟢 Cubierta | suite_58_ia_insercion.js |
| L22443 | `mtrInsertarSiVacia` | 🟢 Cubierta | suite_58_ia_insercion.js |
| L22465 | `mtrCasillaDeModo` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22481 | `mtrRedactorModoSugerido` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22495 | `mtrInsertarEnCasillaModo` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22511 | `mtrInsertarNota` | 🟢 Cubierta | suite_58_ia_insercion.js |
| L22533 | `mtrDatosExtraGuardar` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22538 | `mtrDatosExtraLeer` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22547 | `mtrLeerTextoLibreHistoria` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22594 | `mtrJsonV68DesdeResumen` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22651 | `mtrResumenClinico` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L22726 | `mtrRenderCabeceraRiesgoHtml` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L22758 | `mtrRenderFallaHtml` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L22788 | `mtrRenderResumenClinicoHtml` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L22884 | `mtrIaClickDelegado` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L22905 | `mtrHojaDesdeResumen` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L22920 | `mtrAbrirDatosAdicionales` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L22972 | `mtrAbrirPanelRedaccion` | 🟢 Cubierta | suite_59_burbujas_ux.js |
| L23182 | `mtrChipResumenTexto` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L23195 | `mtrLeerTensionDelDom` | 🟢 Cubierta | suite_55_framingham_oficial.js |
| L23207 | `mtrResumenDesdeModalLabs` | 🟢 Cubierta | suite_47_recuadro_clinico.js |
| L23272 | `mtrHallazgosUroDesdeLabs` | 🟢 Cubierta | suite_51_uro_conducta.js |
| L23276 | `esValorReal` | 🔴 Sin cubrir | - |
| L23340 | `mtrEvaluarUroanalisis` | 🟢 Cubierta | suite_48_uro_foco.js |
| L23409 | `mtrEjesEnFalla` | 🟢 Cubierta | suite_48_uro_foco.js |
| L23412 | `enFalla` | 🔴 Sin cubrir | - |
| L23425 | `mtrPriorityFocus` | 🟢 Cubierta | suite_48_uro_foco.js |
| L23447 | `mtrEducationFlags` | 🟢 Cubierta | suite_48_uro_foco.js |
| L23464 | `mtrAlertaTrigliceridos` | 🟢 Cubierta | suite_48_uro_foco.js |
| L23515 | `mtrGravedadFalla` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23528 | `mtrEvaluarFalla` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23549 | `mtrVentanaRecontrol` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23557 | `mtrFechaRecontrol` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23575 | `mtrDosisDeTexto` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23585 | `mtrEstatinaAltaIntensidad` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23596 | `mtrInerciaEstatina` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23615 | `mtrConsolidarMtt` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23644 | `mtrPlanFallas` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23694 | `mtrTelemetriaResumen` | 🟢 Cubierta | suite_49_falla_recontrol.js |
| L23745 | `mtrCacheResumenGuardar` | 🟢 Cubierta | suite_50_puente_modales.js |
| L23750 | `mtrCacheResumenLeer` | 🟢 Cubierta | suite_50_puente_modales.js |
| L23759 | `mtrCacheResumenEdadMin` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L23766 | `mtrCacheResumenBorrar` | 🟢 Cubierta | suite_57_ia_redaccion.js |
| L23772 | `mtrItemSugeridoEnRango` | 🟢 Cubierta | suite_50_puente_modales.js |
| L23794 | `mtrPrioridadPaquetePym` | 🟢 Cubierta | suite_50_puente_modales.js |

---

## 6. Catálogo de Funciones de Riesgo BAJO (40 funciones)

| Línea | Función | Estado | Suites |
|---|---|---|---|
| L1329 | `_canonTexto` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2357 | `_canonNombreLab` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L5624 | `colToIdx` | 🟢 Cubierta | suite_01_texto_datos.js, suite_07_excel_parser.js |
| L6344 | `q` | 🔴 Sin cubrir | - |
| L7467 | `parseHoraMin` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L7480 | `horaBonita` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L7485 | `elapsedMin` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L7553 | `beep` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7566 | `playTone` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7571 | `startNag` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7572 | `stopNag` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7577 | `faviconUrl` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7581 | `setFavicon` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7588 | `startFlash` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7599 | `stopFlash` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L7935 | `colorDot` | 🟢 Cubierta | suite_42_canales_de_aviso.js |
| L8644 | `vivoElapsed` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L11520 | `esFestivo` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L11536 | `calcBusinessTargetDate` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L11556 | `pad` | 🔴 Sin cubrir | - |
| L11824 | `calcBusinessDaysBefore` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L11925 | `normalizeHora` | 🟢 Cubierta | suite_13_api_agenda.js |
| L12120 | `format12hTime` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L13152 | `calcTargetDateRange` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L13198 | `calcRangoSondeoIso` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L13259 | `calcDateRangeAroundIso` | 🟢 Cubierta | suite_22_utilidades_puras.js |
| L15898 | `stripToAlphanum` | 🔴 Sin cubrir | - |
| L16660 | `savePos` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16661 | `restorePos` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16673 | `closeSheet` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16674 | `toggleSheet` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L16718 | `cnt` | 🔴 Sin cubrir | - |
| L16820 | `sw` | 🔴 Sin cubrir | - |
| L16915 | `bind` | 🔴 Sin cubrir | - |
| L17074 | `signatureOf` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L17130 | `fuzzyMatch` | 🟢 Cubierta | suite_01_texto_datos.js |
| L17209 | `highlight` | 🟢 Cubierta | suite_06_interfaz.js |
| L17216 | `countdown` | 🟢 Cubierta | suite_06_interfaz.js |
| L17446 | `escapeHtml` | 🟢 Cubierta | suite_01_texto_datos.js, suite_06_interfaz.js, suite_31_seguridad_phi_xss.js |
| L17709 | `san` | 🔴 Sin cubrir | - |
