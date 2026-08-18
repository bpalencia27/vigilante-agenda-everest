# Mapa Arquitectónico y Catálogo de Funciones — Vigilante de Agenda (v14)

**Fecha de generación:** 2026-08-14T23:17:04.172Z  
**Archivo analizado:** `vigilante_agenda.user.js` (404 funciones declaradas)  
**Suites de prueba:** 34 archivos en `tests/`  

---

## 1. Resumen Ejecutivo del Inventario

| Nivel de Riesgo | Total Funciones | Cubiertas (`cubre:`) | Efectivas (Nombradas) | Sin Cubrir |
|---|---|---|---|---|
| 🔴 **ALTO (Clínico / Escritura / Fraude)** | **51** | 50 | 49 | 1 |
| 🟡 **MEDIO (Operación / DOM / Red / Estado)** | **313** | 288 | 271 | 25 |
| 🟢 **BAJO (Utilidades Puras / Formato / Audio)** | **40** | 33 | 25 | 7 |
| **TOTAL** | **404** | **371 (91.8%)** | **345** | **33** |

---

## 2. Catálogo de Funciones de Riesgo ALTO (51 Funciones Críticas)
*Funciones con impacto clínico directo: escrituras en historia clínica Everest, cálculo renal KDIGO, agendamiento de citas, emisión de órdenes CUPS o máquina de fraude.*

| # | Línea | Función | Estado Cobertura | Suites Asociadas | Descripción Clínica |
|---|---|---|---|---|---|
| 1 | L1233 | `_conductaBuscarYAgregarExamen` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Inserta líneas de conducta diagnóstica en el formulario clínico de Everest. |
| 2 | L1301 | `_esAnalitoDeOrina` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Discrimina componentes de orina para evitar cruce de casillas. |
| 3 | L1317 | `_hayComponenteUroReal` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Valida presencia de datos reales antes de marcar casillas de uroanálisis. |
| 4 | L1327 | `_matchUroComponente` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Mapea analito recibido a componente específico del parcial de orina. |
| 5 | L1350 | `_agruparUroanalisisParaTabla` | 🟢 Cubierta (Nombrada) | suite_15_interfaz_avanzada.js | Agrupa analitos de orina para visualización y escritura en bloque. |
| 6 | L1400 | `_findUroInput` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Localiza input específico de uroanálisis en el DOM de Everest. |
| 7 | L1418 | `_marcarUroanalisisSi` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Modifica estado del selector 'Presenta Uroanálisis: SÍ' en Everest. |
| 8 | L1582 | `_atheneaCedulaCoincide` | 🟢 Cubierta (Nombrada) | suite_18_athenea_bridge.js | Guarda anti-cruce: Valida coincidencia estricta de cédula entre Everest y Athenea. |
| 9 | L1654 | `_fechaDesdeNumeroSolicitud` | 🟢 Cubierta (Nombrada) | suite_18_athenea_bridge.js | Extrae fecha clínica a partir del número de solicitud de laboratorio. |
| 10 | L2110 | `_matchLabInWhitelist` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Matriz 13 Labs: Mapeo exacto entre catálogo Athenea y whitelist clínica. |
| 11 | L2143 | `_findLabField` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Localiza input de analito en formulario de crónicos de Everest. |
| 12 | L2166 | `_findHbA1cFields` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js, suite_32_correccion_clinica_dom.js | Localiza casillas específicas de Hemoglobina Glicosilada. |
| 13 | L2294 | `_extractFechaSolicitudTopLevel` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Extrae fecha de solicitud para validación de vigencia clínica. |
| 14 | L2308 | `_extractAtheneaFecha` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Parser de fechas de resultados con múltiples formatos colombianos. |
| 15 | L2351 | `_valorCrudoLab` | 🟡 Cubierta (No nombrada) | suite_08_labs_cronicos.js | Extracción de valor antes de parseo numérico; previene mutilación de signos. |
| 16 | L2402 | `_pacienteSigueAbierto` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Guarda crítica: Aborta escritura si el médico cambió de paciente durante la petición. |
| 17 | L2419 | `injectLabsIntoCronicos` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Superficie de escritura principal: Inyecta hasta 13 laboratorios en la HC. |
| 18 | L2804 | `_labNumerico` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js | Convierte valor textual a float clínico preservando decimales y comas. |
| 19 | L2842 | `_esSexoFemenino` | 🟢 Cubierta (Nombrada) | suite_32_correccion_clinica_dom.js | Factor multiplicador (0.85) en fórmula de Cockcroft-Gault. |
| 20 | L2848 | `cockcroftGault` | 🟢 Cubierta (Nombrada) | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js | Cálculo de Tasa de Filtración Glomerular estimada (eGFR / CrCl). |
| 21 | L3057 | `_analitosRcvVencidos` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Evaluación de vigencia de 180/365 días en analitos cardiovasculares. |
| 22 | L6032 | `extractPacienteAbierto` | 🟢 Cubierta (Nombrada) | suite_14_extraccion_dom.js | Extrae cédula y nombre del paciente activo en la pestaña de Everest. |
| 23 | L6118 | `apptKey` | 🟢 Cubierta (Nombrada) | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js | Llave única de cita (doc_id@hora); previene falso positivo en citas múltiples. |
| 24 | L6122 | `diaNuevo` | 🟢 Cubierta (Nombrada) | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js | Limpia listas fraudWatch y alertedFraud al cambiar de jornada. |
| 25 | L6141 | `colorAndAlert` | 🟢 Cubierta (Nombrada) | suite_04_agenda_alertas.js, suite_32_correccion_clinica_dom.js | Máquina de estados de colores (Verde, Ámbar, Morado, Rojo) y alertas de fraude. |
| 26 | L9750 | `apiAccesoBuscarPaciente` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js | Consulta demográfica del paciente en la base de Everest. |
| 27 | L9791 | `apiAccesoBuscarCitasDisponibles` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Consulta de cupos reales en la agenda de la sede. |
| 28 | L9885 | `perfilPaciente` | 🟢 Cubierta (Nombrada) | suite_24_motor_perfil.js | Determinación de perfil clínico del paciente para sugerencias. |
| 29 | L9936 | `recomendacionHorario` | 🟢 Cubierta (Nombrada) | suite_24_motor_perfil.js | Sugerencia de franja horaria óptima para próxima cita. |
| 30 | L10035 | `apiLaboratorioAgendarAuto` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Mutación de Agenda: Agenda cita de toma de laboratorio en Everest. |
| 31 | L10156 | `apiDigiturnoFinalizarTicket` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Cierra ticket en sistema de llamado de pacientes. |
| 32 | L10165 | `apiAccesoObtenerLaboratoriosAnnar` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Consulta histórica de laboratorios en Annar. |
| 33 | L10169 | `apiAccesoObtenerLaboratoriosCiti` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Consulta histórica de laboratorios en Citi. |
| 34 | L10183 | `apiHcObtenerOrdenamientosVigentes` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Consulta órdenes activas del paciente para evitar duplicación. |
| 35 | L10226 | `apiHcObtenerSignosVitales` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js | Consulta peso y presión arterial en Everest para Cockcroft-Gault. |
| 36 | L10253 | `_pesoDeSignosVitales` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js | Extrae peso corporal en kg para fórmula de función renal. |
| 37 | L10276 | `apiAccesoObtenerDemograficos` | 🟢 Cubierta (Nombrada) | suite_32_correccion_clinica_dom.js | Consulta edad y sexo del paciente para cálculos clínicos. |
| 38 | L10309 | `_creatininaDeLabs` | 🟢 Cubierta (Nombrada) | suite_32_correccion_clinica_dom.js | Extrae último valor de creatinina sérica para cálculo renal. |
| 39 | L10339 | `estadioRenalDelPaciente` | 🟢 Cubierta (Nombrada) | suite_29_estadio_renal_r1b.js, suite_32_correccion_clinica_dom.js | Orquesta cálculo de eGFR y clasificación en estadios G1 a G5. |
| 40 | L10414 | `calcularEstadioRenal` | 🟢 Cubierta (Nombrada) | suite_32_correccion_clinica_dom.js | Clasificación numérica estricta según guías KDIGO. |
| 41 | L10528 | `pymCubiertoPorOrdenVigente` | 🟢 Cubierta (Nombrada) | suite_21_v12_4_pym_horas.js, suite_32_correccion_clinica_dom.js | Verifica si actividad PyM ya está cubierta por orden vigente en Everest. |
| 42 | L10579 | `apiAccesoAgdValidarAgenda` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Valida restricciones de agenda antes de reservar. |
| 43 | L10589 | `apiAccesoObtenerTurnos` | 🟢 Cubierta (Nombrada) | suite_13_api_agenda.js | Obtiene turnos disponibles en la agenda médica. |
| 44 | L10599 | `apiAccesoAsignarTurno` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js | Mutación de Agenda: Asigna cita médica definitiva en Everest. |
| 45 | L12562 | `apiOrdenamientoBuscarPaciente` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js | Valida paciente en módulo de órdenes médicas. |
| 46 | L12577 | `apiOrdenamientoObtenerDx` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js | Obtiene diagnósticos CIE-10 asociados al paciente. |
| 47 | L12596 | `apiOrdenamientoObtenerCup` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js | Valida código CUPS y cobertura en el plan de beneficios. |
| 48 | L12630 | `apiOrdenamientoGuardar` | 🟢 Cubierta (Nombrada) | suite_05_api_everest.js | Superficie de Escritura: Guarda orden médica oficial en Everest. |
| 49 | L12711 | `apiOrdenamientoGenerarLinks` | 🟢 Cubierta (Nombrada) | suite_20_correo_ordenes.js | Genera enlaces de impresión y PDF de órdenes clínicas. |
| 50 | L13213 | `_pymYaOrdenadoHoyDesdeElScript` | 🔴 SIN CUBRIR | *(Ninguna)* | Previene ordenamiento duplicado en la misma sesión de consulta. |
| 51 | L14241 | `checkRacGuardia` | 🟢 Cubierta (Nombrada) | suite_08_labs_cronicos.js | Protección de casilla: Guardia anti-borrado y respeto a la decisión médica. |

---

## 3. Funciones Sin Cubrir (33 funciones)
*Funciones presentes en el userscript pero ausentes de los arrays `cubre: [...]` de las suites de prueba:*

| # | Línea | Función | Nivel de Riesgo | Justificación / Plan de Cobertura |
|---|---|---|---|---|
| 1 | L11455 | `_agendasPropias` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 2 | L11472 | `_buscarDiaConAgendaPropia` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 3 | L14326 | `_mostrarAvisoPausaClinica` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 4 | L4282 | `_pestanaOculta` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 5 | L13213 | `_pymYaOrdenadoHoyDesdeElScript` | **ALTO** | Previene ordenamiento duplicado en la misma sesión de consulta. |
| 6 | L11968 | `_sondearAgendaDeCadaDia` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 7 | L11004 | `bgClick` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 8 | L13587 | `bind` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 9 | L6850 | `buscar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 10 | L11495 | `cargarHoras` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 11 | L11841 | `cargarHorasLab` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 12 | L12301 | `cargarHorasLabSolo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 13 | L10991 | `closeMod` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 14 | L13474 | `cnt` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 15 | L1630 | `d` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 16 | L2013 | `diag` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 17 | L1705 | `enZonaMuerta` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 18 | L12734 | `esUrl` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 19 | L10484 | `fecha` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 20 | L10783 | `getInfo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 21 | L9570 | `pad` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 22 | L5166 | `q` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 23 | L11925 | `renderDayChips` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 24 | L11893 | `renderLabDayChips` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 25 | L12346 | `renderLabDayChipsSolo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 26 | L11215 | `restaurar` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 27 | L14186 | `san` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 28 | L12539 | `stripToAlphanum` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 29 | L13497 | `sw` | **BAJO** | Utilidad pura, tiempo, audio o presentación menor |
| 30 | L10756 | `trabajador` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 31 | L12991 | `updateCount` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 32 | L6822 | `vals` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |
| 33 | L10990 | `vivo` | **MEDIO** | Operación de interfaz, API, almacenamiento o estado |

---

## 4. Funciones Declaradas pero Nunca Nombradas en Aserciones (26 funciones)
*Funciones autoinformadas en `cubre: [...]` pero cuyo identificador literal no aparece en el cuerpo de las pruebas:*

| # | Línea | Función | Nivel de Riesgo | Suites que la declaran |
|---|---|---|---|---|
| 1 | L3468 | `_casillasExamenFisico` | MEDIO | suite_15_interfaz_avanzada.js |
| 2 | L5214 | `_loteId` | MEDIO | suite_23_ux_telemetria.js |
| 3 | L5265 | `_migaPush` | MEDIO | suite_23_ux_telemetria.js |
| 4 | L6486 | `_renderToast` | MEDIO | suite_04_agenda_alertas.js |
| 5 | L9692 | `_rumTrack` | MEDIO | suite_23_ux_telemetria.js |
| 6 | L2351 | `_valorCrudoLab` | ALTO | suite_08_labs_cronicos.js |
| 7 | L6288 | `acknowledge` | MEDIO | suite_04_agenda_alertas.js |
| 8 | L6170 | `beep` | BAJO | suite_04_agenda_alertas.js |
| 9 | L6693 | `enableOsNotifications` | MEDIO | suite_04_agenda_alertas.js |
| 10 | L6194 | `faviconUrl` | BAJO | suite_04_agenda_alertas.js |
| 11 | L13707 | `fraudesHoy` | MEDIO | suite_06_interfaz.js |
| 12 | L6456 | `osNotify` | MEDIO | suite_04_agenda_alertas.js |
| 13 | L6183 | `playTone` | BAJO | suite_04_agenda_alertas.js |
| 14 | L6226 | `popupAlert` | MEDIO | suite_04_agenda_alertas.js |
| 15 | L13712 | `renderStats` | MEDIO | suite_06_interfaz.js |
| 16 | L5230 | `repEntornoDiario` | MEDIO | suite_23_ux_telemetria.js |
| 17 | L6198 | `setFavicon` | BAJO | suite_04_agenda_alertas.js |
| 18 | L6516 | `showToast` | MEDIO | suite_04_agenda_alertas.js |
| 19 | L6205 | `startFlash` | BAJO | suite_04_agenda_alertas.js |
| 20 | L6188 | `startNag` | BAJO | suite_04_agenda_alertas.js |
| 21 | L6216 | `stopFlash` | BAJO | suite_04_agenda_alertas.js |
| 22 | L6189 | `stopNag` | BAJO | suite_04_agenda_alertas.js |
| 23 | L6673 | `testNotifications` | MEDIO | suite_04_agenda_alertas.js |
| 24 | L6664 | `updateBell` | MEDIO | suite_04_agenda_alertas.js |
| 25 | L5365 | `uxClaveLimpia` | MEDIO | suite_23_ux_telemetria.js |
| 26 | L5358 | `uxVentanaNueva` | MEDIO | suite_23_ux_telemetria.js |

---

## 5. Catálogo de Funciones de Riesgo MEDIO (313 funciones)

| Línea | Función | Estado | Suites |
|---|---|---|---|
| L967 | `vglLog` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L999 | `vglExportLogs` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L1437 | `fetchAtheneaLabs` | 🟢 Cubierta | suite_05_api_everest.js |
| L1546 | `_gmReq` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1554 | `_atheneaMultipart` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1564 | `_atheneaToken` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1570 | `_atheneaIdPaciente` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1620 | `_parseFechaEspanolLike` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1630 | `d` | 🔴 Sin cubrir | - |
| L1667 | `_atheneaExtraerSolicitudes` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1705 | `enZonaMuerta` | 🔴 Sin cubrir | - |
| L1852 | `_atheneaPareceLogin` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1896 | `_vglXor` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1897 | `_vglOfusca` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1898 | `_vglDesofusca` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1899 | `atheneaCredsGet` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1907 | `atheneaCredsSet` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1911 | `atheneaCredsClear` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L1920 | `atheneaAutoLogin` | 🟢 Cubierta | suite_18_athenea_bridge.js, suite_33_robustez_concurrencia_red.js |
| L1981 | `atheneaKeepAlive` | 🟢 Cubierta | suite_18_athenea_bridge.js, suite_33_robustez_concurrencia_red.js |
| L2009 | `getAtheneaSolicitudesAuto` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2013 | `diag` | 🔴 Sin cubrir | - |
| L2061 | `getAtheneaLabsAuto` | 🟢 Cubierta | suite_18_athenea_bridge.js |
| L2090 | `setNgValue` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2223 | `_parseFechaHoraLike` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L2284 | `_parseFechaLike` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2366 | `_ultimaFechaPorAnalito` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2810 | `limpio` | 🟢 Cubierta | suite_01_texto_datos.js |
| L2815 | `_vigenciaDiasParaAnalito` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2857 | `ckdEpi2021` | 🟢 Cubierta | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js |
| L2870 | `estadioKDIGO` | 🟢 Cubierta | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js |
| L2894 | `evaluarDiscordanciaTFG` | 🟢 Cubierta | suite_27_funcion_renal.js, suite_32_correccion_clinica_dom.js |
| L3012 | `vigenciaPorEstadio` | 🟢 Cubierta | suite_28_vigencias_estadio.js |
| L3042 | `analitoTablaDesdeClaveRcv` | 🟢 Cubierta | suite_28_vigencias_estadio.js |
| L3092 | `_getRacGuardiaParaTest` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L3093 | `_setRacGuardiaParaTest` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L3095 | `autoFetchAtheneaLabsForActivePatient` | 🟢 Cubierta | suite_17_nucleo.js |
| L3154 | `createLabInjectorUI` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L3294 | `createAccionesDockUI` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L3468 | `_casillasExamenFisico` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L3473 | `createExamenFisicoInjectorUI` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L3549 | `debounceVgl` | 🟢 Cubierta | suite_01_texto_datos.js |
| L3567 | `verificarIntegridadArranque` | 🟢 Cubierta | suite_31_seguridad_phi_xss.js |
| L3602 | `scrubPII` | 🟢 Cubierta | suite_31_seguridad_phi_xss.js |
| L3637 | `sanitizePII` | 🟢 Cubierta | suite_01_texto_datos.js, suite_31_seguridad_phi_xss.js |
| L3670 | `yieldNow` | 🟢 Cubierta | suite_17_nucleo.js |
| L3674 | `makeYielder` | 🟢 Cubierta | suite_17_nucleo.js |
| L3686 | `idleRun` | 🟢 Cubierta | suite_17_nucleo.js |
| L3729 | `safeReadJSON` | 🟢 Cubierta | suite_33_robustez_concurrencia_red.js |
| L3748 | `readJSON` | 🟢 Cubierta | suite_09_ajustes.js |
| L3756 | `purgaPorCuota` | 🟢 Cubierta | suite_19_identidad_cuota.js, suite_33_robustez_concurrencia_red.js |
| L3764 | `safeWriteJSON` | 🟢 Cubierta | suite_33_robustez_concurrencia_red.js |
| L3775 | `writeJSON` | 🟢 Cubierta | suite_09_ajustes.js |
| L3781 | `migrarEsquemaVgl` | 🟢 Cubierta | suite_33_robustez_concurrencia_red.js |
| L3886 | `getCircuitBreaker` | 🟢 Cubierta | suite_33_robustez_concurrencia_red.js |
| L3901 | `circuitBreakerExec` | 🟢 Cubierta | suite_33_robustez_concurrencia_red.js |
| L3950 | `saveSettings` | 🟢 Cubierta | suite_09_ajustes.js |
| L3953 | `getProcessedToday` | 🟢 Cubierta | suite_09_ajustes.js, suite_33_robustez_concurrencia_red.js |
| L3963 | `isCitaAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L3968 | `isOrdenesCreadasHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L3981 | `isLabAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L3988 | `citaAgendadaFechaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L3993 | `markCitaAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js, suite_33_robustez_concurrencia_red.js |
| L4013 | `markLabAgendadaHoy` | 🟢 Cubierta | suite_09_ajustes.js |
| L4030 | `markOrdenesCreadasHoy` | 🟢 Cubierta | suite_09_ajustes.js, suite_33_robustez_concurrencia_red.js |
| L4068 | `ordenesDetalleHoy` | 🟢 Cubierta | suite_20_correo_ordenes.js |
| L4073 | `applySettings` | 🟢 Cubierta | suite_09_ajustes.js |
| L4081 | `clampNum` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4082 | `darkPreferred` | 🟢 Cubierta | suite_09_ajustes.js |
| L4083 | `isLight` | 🟢 Cubierta | suite_09_ajustes.js |
| L4084 | `applyTheme` | 🟢 Cubierta | suite_09_ajustes.js |
| L4164 | `detalleTipoCervix` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4238 | `restartPolling` | 🟢 Cubierta | suite_09_ajustes.js |
| L4282 | `_pestanaOculta` | 🔴 Sin cubrir | - |
| L4285 | `heartbeat` | 🟢 Cubierta | suite_17_nucleo.js |
| L4317 | `share` | 🟢 Cubierta | suite_17_nucleo.js |
| L4320 | `normalizeKey` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4331 | `extractDoc` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4334 | `isPending` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4344 | `esSi` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4348 | `friendly` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4370 | `activityLabel` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4371 | `stripAccents` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4372 | `isExcludedActivity` | 🟢 Cubierta | suite_01_texto_datos.js |
| L4377 | `getActivities` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4381 | `isPanelHiddenActivity` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L4382 | `panelActivities` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L4388 | `pymPendientesRestantes` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L4404 | `makeIndexer` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4486 | `indexRowsAsync` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4494 | `parseCSV` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4512 | `inflateRaw` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4531 | `unescXml` | 🟢 Cubierta | suite_01_texto_datos.js, suite_07_excel_parser.js |
| L4560 | `parseSharedStringsStream` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4589 | `parseRowBody` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4619 | `scanSheetRows` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4660 | `zipIndex` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4688 | `zipRead` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4697 | `sheetOrder` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4713 | `scoreSheet` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4731 | `findDocIdx` | 🟢 Cubierta | suite_07_excel_parser.js |
| L4741 | `_readPymWorkbookStreamCore` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4795 | `readPymWorkbookStream` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4803 | `progreso` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4903 | `afterPymLoaded` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4925 | `debeBuscarPymDiario` | 🟢 Cubierta | suite_21_v12_4_pym_horas.js |
| L4929 | `pymFP` | 🟢 Cubierta | suite_16_excel_stream.js |
| L4939 | `packPym` | 🟢 Cubierta | suite_03_excel_pym.js |
| L4961 | `unpackPym` | 🟢 Cubierta | suite_03_excel_pym.js |
| L4987 | `applyPymIdx` | 🟢 Cubierta | suite_16_excel_stream.js |
| L5003 | `savePymCache` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5023 | `allStats` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5024 | `statsToday` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5025 | `bumpStat` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5032 | `purgeOld` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5037 | `lastDays` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5047 | `evKey` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5049 | `evFlush` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5062 | `logEvent` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5076 | `eventsOf` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5078 | `purgeEventDays` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5102 | `csvCell` | 🟢 Cubierta | suite_01_texto_datos.js |
| L5103 | `downloadBlob` | 🟢 Cubierta | suite_10_eventos_auditoria.js |
| L5107 | `exportAudit` | 🟢 Cubierta | suite_10_eventos_auditoria.js, suite_32_correccion_clinica_dom.js |
| L5142 | `repUrl` | 🟢 Cubierta | suite_11_reportes.js |
| L5143 | `repOn` | 🟢 Cubierta | suite_11_reportes.js |
| L5146 | `repPost` | 🟢 Cubierta | suite_11_reportes.js |
| L5163 | `repQLoad` | 🟢 Cubierta | suite_11_reportes.js, suite_33_robustez_concurrencia_red.js |
| L5164 | `repQSave` | 🟢 Cubierta | suite_11_reportes.js, suite_23_ux_telemetria.js, suite_33_robustez_concurrencia_red.js |
| L5178 | `repFlush` | 🟢 Cubierta | suite_11_reportes.js, suite_33_robustez_concurrencia_red.js |
| L5195 | `_equipoId` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5214 | `_loteId` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5219 | `reportar` | 🟢 Cubierta | suite_11_reportes.js, suite_23_ux_telemetria.js |
| L5230 | `repEntornoDiario` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5265 | `_migaPush` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5269 | `_sanearMensajeError` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5278 | `reportarError` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5303 | `_instalarCazaErrores` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5323 | `repDailySummary` | 🟢 Cubierta | suite_11_reportes.js |
| L5336 | `reportarFraude` | 🟢 Cubierta | suite_11_reportes.js |
| L5358 | `uxVentanaNueva` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5365 | `uxClaveLimpia` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5366 | `uxTrack` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5389 | `uxEnviarVentana` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5415 | `uxFlush` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5428 | `uxBootCheck` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L5439 | `todayStamp` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L5447 | `spBase` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5453 | `todayTokens` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5462 | `normName` | 🟢 Cubierta | suite_01_texto_datos.js, suite_03_excel_pym.js |
| L5469 | `nameHasToken` | 🟢 Cubierta | suite_01_texto_datos.js, suite_03_excel_pym.js |
| L5474 | `esNombreDeHoy` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5479 | `pickTodaysFile` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5496 | `xlsViejoDeHoy` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5500 | `spListUrl` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5501 | `spRows` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5502 | `spDownloadUrl` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5505 | `gmJson` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5514 | `primeShareAccess` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5523 | `parseSpDocId` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5531 | `spFallbackUrls` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5539 | `readPym` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5551 | `gmGet` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5565 | `loadPymFromCache` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5590 | `esLibroValido` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5601 | `esXlsxCifrado` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5618 | `pilotoId` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5619 | `pilotoDesdeCache` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5633 | `pilotoGuardar` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5641 | `pilotoMeta` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5651 | `pilotoFreshCheck` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5665 | `loadPymBase` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5675 | `loadPymBaseDescarga` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5739 | `fetchSpFilesMultiFolder` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5759 | `loadPymDiario` | 🟢 Cubierta | suite_03_excel_pym.js |
| L5822 | `bootSharepointLite` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5869 | `schedulePymBase` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5889 | `dismissSpToast` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5900 | `spToast` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5943 | `loadPymFile` | 🟢 Cubierta | suite_12_sharepoint_piloto.js |
| L5956 | `firstMatch` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L5957 | `containerOf` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L5963 | `extractAgenda` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L6004 | `_enModuloHCHealth` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L6009 | `seccionActiva` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L6053 | `otroAvisoDePacienteAbierto` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6060 | `checkRecordatorioPym` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6173 | `muted` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6174 | `muteFor` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6175 | `unmute` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6226 | `popupAlert` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6260 | `bigAlert` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6288 | `acknowledge` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6291 | `pymAlert` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6329 | `abandonoPESAlert` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6359 | `checkAbandonoPES` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6375 | `labsVencidosAlert` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6410 | `checkLabsVencidos` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6434 | `crossTabDup` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6439 | `avisoYaVisto` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6447 | `avisoMarcarVisto` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6456 | `osNotify` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6486 | `_renderToast` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6516 | `showToast` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6533 | `notify` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6553 | `nkey` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6570 | `_encolarAvisoPendiente` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6578 | `_flushAvisosPendientes` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6586 | `_dispararAvisoReal` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6600 | `_siembraCompartidaLeer` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6608 | `_siembraCompartidaGuardar` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6621 | `_sembrarEstadoInicial` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6634 | `maybeNotify` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6664 | `updateBell` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6673 | `testNotifications` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6693 | `enableOsNotifications` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6727 | `apiRecordar` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6761 | `invalidarApiSiCambioMedico` | 🟢 Cubierta | suite_19_identidad_cuota.js, suite_33_robustez_concurrencia_red.js |
| L6779 | `apiSniffPerf` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6791 | `apiObservar` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6809 | `apiLista` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6818 | `apiCampos` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6822 | `vals` | 🔴 Sin cubrir | - |
| L6850 | `buscar` | 🔴 Sin cubrir | - |
| L6868 | `apiParse` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6900 | `leerConTope` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6919 | `apiLeerAgenda` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6969 | `purgarApiUrl` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L6977 | `apiUtil` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6980 | `apiSano` | 🟢 Cubierta | suite_13_api_agenda.js |
| L6984 | `apiEspera` | 🟢 Cubierta | suite_13_api_agenda.js |
| L7037 | `apiCadencia` | 🟢 Cubierta | suite_13_api_agenda.js |
| L7065 | `tickApi` | 🟢 Cubierta | suite_13_api_agenda.js |
| L7087 | `hayVentanaCritica` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L7121 | `setWinState` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L7128 | `buildOverlay` | 🟢 Cubierta | suite_15_interfaz_avanzada.js, suite_25_cascada_css.js |
| L9367 | `captureDoctorInfo` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L9454 | `resolverMedicoPorPerfil` | 🟢 Cubierta | suite_17_nucleo.js |
| L9481 | `identidadDesdeCliente` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L9584 | `_pageFetchJsonCore` | 🟢 Cubierta | suite_05_api_everest.js, suite_33_robustez_concurrencia_red.js |
| L9684 | `_rumEndpointLabel` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L9692 | `_rumTrack` | 🟢 Cubierta | suite_23_ux_telemetria.js |
| L9704 | `pageFetchJson` | 🟢 Cubierta | suite_05_api_everest.js, suite_33_robustez_concurrencia_red.js |
| L9719 | `extractPatientId` | 🟢 Cubierta | suite_05_api_everest.js |
| L9834 | `gmPostJson` | 🟢 Cubierta | suite_17_nucleo.js |
| L9856 | `gmPostJsonEx` | 🟢 Cubierta | suite_17_nucleo.js |
| L9994 | `esCupoAdicional` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L10003 | `clasificaCupoAgenda` | 🟢 Cubierta | suite_24_motor_perfil.js |
| L10182 | `_ordenesVigentesInvalidar` | 🟢 Cubierta | suite_32_correccion_clinica_dom.js |
| L10225 | `_signosVitalesInvalidar` | 🟢 Cubierta | suite_29_estadio_renal_r1b.js |
| L10275 | `_demograficosInvalidar` | 🟢 Cubierta | suite_32_correccion_clinica_dom.js |
| L10445 | `_renderEstadioRenalHtml` | 🟢 Cubierta | suite_32_correccion_clinica_dom.js |
| L10484 | `fecha` | 🔴 Sin cubrir | - |
| L10670 | `imprimirRecordatorioCita` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L10685 | `mostrarPanelPostCita` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L10714 | `extractAgendasList` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L10747 | `mapConLimite` | 🟢 Cubierta | suite_22_utilidades_puras.js |
| L10756 | `trabajador` | 🔴 Sin cubrir | - |
| L10783 | `getInfo` | 🔴 Sin cubrir | - |
| L10928 | `openLaboratoriosModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L10990 | `vivo` | 🔴 Sin cubrir | - |
| L10991 | `closeMod` | 🔴 Sin cubrir | - |
| L11004 | `bgClick` | 🔴 Sin cubrir | - |
| L11209 | `abrirInformeAthenea` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L11215 | `restaurar` | 🔴 Sin cubrir | - |
| L11255 | `openAgendamientoModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L11455 | `_agendasPropias` | 🔴 Sin cubrir | - |
| L11472 | `_buscarDiaConAgendaPropia` | 🔴 Sin cubrir | - |
| L11495 | `cargarHoras` | 🔴 Sin cubrir | - |
| L11841 | `cargarHorasLab` | 🔴 Sin cubrir | - |
| L11893 | `renderLabDayChips` | 🔴 Sin cubrir | - |
| L11925 | `renderDayChips` | 🔴 Sin cubrir | - |
| L11968 | `_sondearAgendaDeCadaDia` | 🔴 Sin cubrir | - |
| L12207 | `openLabSoloModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12301 | `cargarHorasLabSolo` | 🔴 Sin cubrir | - |
| L12346 | `renderLabDayChipsSolo` | 🔴 Sin cubrir | - |
| L12538 | `pymPaquetesDelPaciente` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12683 | `extractAgrupador` | 🟢 Cubierta | suite_20_correo_ordenes.js |
| L12733 | `_urlImpresionOrdenPyM` | 🟢 Cubierta | suite_15_interfaz_avanzada.js, suite_20_correo_ordenes.js |
| L12734 | `esUrl` | 🔴 Sin cubrir | - |
| L12753 | `apiEnviarOrdenPorCorreo` | 🟢 Cubierta | suite_20_correo_ordenes.js |
| L12793 | `imprimirOrdenPyM` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12803 | `openOrdenamientoModal` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L12991 | `updateCount` | 🔴 Sin cubrir | - |
| L13204 | `_bannerPymInvalidar` | 🟢 Cubierta | suite_32_correccion_clinica_dom.js |
| L13221 | `_refrescarBannerPym` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13245 | `createPymBannerUI` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13431 | `sheetHeader` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13434 | `wireClose` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13437 | `renderResumen` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13472 | `copySummary` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13488 | `renderSettings` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13679 | `paintMute` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13686 | `repaint` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13688 | `makeDraggable` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13699 | `setSummary` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13707 | `fraudesHoy` | 🟢 Cubierta | suite_06_interfaz.js |
| L13712 | `renderStats` | 🟢 Cubierta | suite_06_interfaz.js |
| L13743 | `tieneAbandonoPES` | 🟢 Cubierta | suite_06_interfaz.js |
| L13806 | `matchesSearch` | 🟢 Cubierta | suite_06_interfaz.js |
| L13812 | `matchesFilter` | 🟢 Cubierta | suite_06_interfaz.js |
| L13850 | `render` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13947 | `refrescarCuentas` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13977 | `helloOncePerDay` | 🟢 Cubierta | suite_17_nucleo.js |
| L13991 | `tick` | 🟢 Cubierta | suite_17_nucleo.js |
| L14180 | `downloadDiagnostic` | 🟢 Cubierta | suite_17_nucleo.js |
| L14273 | `pymReminderCheck` | 🟢 Cubierta | suite_17_nucleo.js |
| L14293 | `avisarSiActualizado` | 🟢 Cubierta | suite_17_nucleo.js |
| L14310 | `chequearAutoUpdateLento` | 🟢 Cubierta | suite_17_nucleo.js |
| L14326 | `_mostrarAvisoPausaClinica` | 🔴 Sin cubrir | - |
| L14345 | `emergencyTeardown` | 🟢 Cubierta | suite_30_killswitch_canario.js |
| L14384 | `checkVersionMinimum` | 🟢 Cubierta | suite_17_nucleo.js, suite_30_killswitch_canario.js |
| L14474 | `boot` | 🟢 Cubierta | suite_17_nucleo.js |

---

## 6. Catálogo de Funciones de Riesgo BAJO (40 funciones)

| Línea | Función | Estado | Suites |
|---|---|---|---|
| L1294 | `_canonTexto` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L2108 | `_canonNombreLab` | 🟢 Cubierta | suite_08_labs_cronicos.js |
| L4530 | `colToIdx` | 🟢 Cubierta | suite_01_texto_datos.js, suite_07_excel_parser.js |
| L5166 | `q` | 🔴 Sin cubrir | - |
| L6088 | `parseHoraMin` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L6101 | `horaBonita` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L6108 | `elapsedMin` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L6170 | `beep` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6183 | `playTone` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6188 | `startNag` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6189 | `stopNag` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6194 | `faviconUrl` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6198 | `setFavicon` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6205 | `startFlash` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6216 | `stopFlash` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L6428 | `colorDot` | 🟢 Cubierta | suite_04_agenda_alertas.js |
| L7034 | `vivoElapsed` | 🟢 Cubierta | suite_19_identidad_cuota.js |
| L9533 | `esFestivo` | 🟢 Cubierta | suite_02_tiempo_fechas.js, suite_32_correccion_clinica_dom.js |
| L9550 | `calcBusinessTargetDate` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L9570 | `pad` | 🔴 Sin cubrir | - |
| L9814 | `calcBusinessDaysBefore` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L9879 | `normalizeHora` | 🟢 Cubierta | suite_13_api_agenda.js |
| L10019 | `format12hTime` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L10778 | `calcTargetDateRange` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L10824 | `calcRangoSondeoIso` | 🟢 Cubierta | suite_02_tiempo_fechas.js |
| L10885 | `calcDateRangeAroundIso` | 🟢 Cubierta | suite_22_utilidades_puras.js |
| L12539 | `stripToAlphanum` | 🔴 Sin cubrir | - |
| L13416 | `savePos` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13417 | `restorePos` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13429 | `closeSheet` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13430 | `toggleSheet` | 🟢 Cubierta | suite_15_interfaz_avanzada.js |
| L13474 | `cnt` | 🔴 Sin cubrir | - |
| L13497 | `sw` | 🔴 Sin cubrir | - |
| L13587 | `bind` | 🔴 Sin cubrir | - |
| L13700 | `signatureOf` | 🟢 Cubierta | suite_14_extraccion_dom.js |
| L13745 | `fuzzyMatch` | 🟢 Cubierta | suite_01_texto_datos.js |
| L13824 | `highlight` | 🟢 Cubierta | suite_06_interfaz.js |
| L13831 | `countdown` | 🟢 Cubierta | suite_06_interfaz.js |
| L13970 | `escapeHtml` | 🟢 Cubierta | suite_01_texto_datos.js, suite_06_interfaz.js, suite_31_seguridad_phi_xss.js |
| L14186 | `san` | 🔴 Sin cubrir | - |
