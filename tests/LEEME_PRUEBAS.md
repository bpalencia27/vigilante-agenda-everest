# Banco de Pruebas del Vigilante de Agenda (Satélite S2)

> **Estado Actual:** **47 suites automatizadas**, **1.405 comprobaciones**, **479/479 funciones cubiertas (100% de la API expuesta)**.  
> **Ejecución estándar:** `node tests/runner.js` (= `npm test`).  
> **Aislamiento:** Sin dependencias externas de npm en runtime (ejecuta con Node.js puro usando `vm` y simulación DOM en memoria).

---

## 1. Cómo Ejecutar el Banco de Pruebas

```bash
# Ejecutar todas las 47 suites:
node tests/runner.js

# Ejecutar una suite específica (por subcadena en nombre o archivo):
node tests/runner.js renal
node tests/runner.js farmaco
node tests/runner.js suite_08
```

---

## 2. Mapa Completo de las 47 Suites de Pruebas

| Suite | Archivo | Área de Cobertura Clínica y Técnica | Comprobaciones |
|---|---|---|:---:|
| **01** | `suite_01_texto_datos.js` | Normalización de texto, sanitización de PII y cédulas | 41 ok |
| **02** | `suite_02_tiempo_fechas.js` | Fechas hábiles, cálculo de controles y stamps | 17 ok |
| **03** | `suite_03_excel_pym.js` | Empaquetado PyM, SharePoint y normalización de nombres | 24 ok |
| **04** | `suite_04_agenda_alertas.js` | Detección de fraude, colores, llegadas tardías y sonidos | 15 ok |
| **05** | `suite_05_api_everest.js` | Endpoints de Everest, parseo de respuestas y agendas | 10 ok |
| **06** | `suite_06_interfaz.js` | Panel lateral, tarjetas, filtros y ordenamiento | 12 ok |
| **07** | `suite_07_excel_parser.js` | Descompresión ZIP nativa sin SheetJS y lectura XML | 18 ok |
| **08** | `suite_08_labs_cronicos.js` | Inyección de 13 laboratorios, uroanálisis y guarda RAC | 114 ok |
| **09** | `suite_09_ajustes.js` | Almacenamiento local, temas claro/oscuro y persistencia | 28 ok |
| **10** | `suite_10_eventos_auditoria.js` | Telemetría, registro de auditoría local y exportación | 26 ok |
| **11** | `suite_11_reportes.js` | Cola de reportes, resiliencia y reintentos | 21 ok |
| **12** | `suite_12_sharepoint_piloto.js` | Conexión con SharePoint institucional y caché local | 42 ok |
| **13** | `suite_13_api_agenda.js` | Asignación de turnos, validación de cupos y SMS | 58 ok |
| **14** | `suite_14_extraccion_dom.js` | Lectura del DOM nativo de Everest e identificación | 26 ok |
| **15** | `suite_15_interfaz_avanzada.js` | Modales, accesibilidad por teclado y arrastre | 146 ok |
| **16** | `suite_16_excel_stream.js` | Procesamiento en flujo (streaming) de hojas pesadas | 24 ok |
| **17** | `suite_17_nucleo.js` | Latidos, coordinación de liderazgo y temporizadores | 39 ok |
| **18** | `suite_18_athenea_bridge.js` | Puente con LIS Athenea, CSRF y desencriptación | 80 ok |
| **19** | `suite_19_identidad_cuota.js` | Identidad del médico, cookies y blindaje de cuota | 21 ok |
| **20** | `suite_20_correo_ordenes.js` | Envío de órdenes por email y URLs de impresión | 7 ok |
| **21** | `suite_21_comparador.js` | Comparación de fuentes de datos | 1 ok |
| **21b** | `suite_21_v12_4_pym_horas.js` | Horas, panel PyM y tabla de paquetes CUPS | 49 ok |
| **22** | `suite_22_utilidades_puras.js` | Funciones matemáticas, clamp y mapeo concurrente | 10 ok |
| **23** | `suite_23_ux_telemetria.js` | Medición de latencias y eventos de usuario | 33 ok |
| **24** | `suite_24_motor_perfil.js` | Motor de perfil clínico del paciente | 20 ok |
| **25** | `suite_25_cascada_css.js` | Blindaje CSS contra sobreescritura de estilos Everest | 15 ok |
| **26** | `suite_26_banco_sano.js` | Centinelas del banco de pruebas (anti-falsos positivos) | 9 ok |
| **27** | `suite_27_funcion_renal.js` | Cockcroft-Gault, CKD-EPI 2021 y discordancias TFG | 12 ok |
| **28** | `suite_28_vigencias_estadio.js` | Vigencias de exámenes según estadio renal KDIGO | 35 ok |
| **29** | `suite_29_estadio_renal_r1b.js` | Plomería de cálculo y renderizado de estadios | 41 ok |
| **30** | `suite_30_killswitch_canario.js`| Red de seguridad remota, Kill-Switch y canarios | 7 ok |
| **30b**| `suite_30_rangos_oficiales.js` | Tabla de 28 reglas de rangos de la IPS | 32 ok |
| **31** | `suite_31_labs_rango_oficial.js`| Validación de plausibilidad en inyección Auto-Labs | 21 ok |
| **31b**| `suite_31_seguridad_phi_xss.js` | Protección contra XSS y saneamiento de PHI | 11 ok |
| **32** | `suite_32_correccion_clinica_dom.js`| Frontera DOM, límites biológicos y guardas | 33 ok |
| **33** | `suite_33_robustez_concurrencia_red.js`| Circuit breaker, fallbacks y esquemas de migración | 26 ok |
| **34** | `suite_34_cobertura_alto_riesgo_mutantes.js`| Resistencia a mutantes en funciones de alto riesgo | 19 ok |
| **35** | `suite_35_interfaz_accesibilidad_medica.js`| Cumplimiento Ley de Fitts (44px) y WCAG AA | 23 ok |
| **36** | `suite_36_entrega_runbook_prr.js`| Detección de instancias duplicadas y arranque limpio | 17 ok |
| **37** | `suite_37_invariantes_criticos.js`| Detección de regresiones y mutaciones olvidadas | 14 ok |
| **38** | `suite_38_motor_fechas.js` | Motor determinista: festivos, días hábiles y control | 26 ok |
| **39** | `suite_39_motor_farmaco.js` | Ajustes de dosis renal (Metformina, Espironolactona) | 39 ok |
| **40** | `suite_40_motor_interacciones.js`| Interacciones medicamentosas de alto riesgo | 20 ok |
| **41** | `suite_41_motor_vista.js` | Renderizado de avisos farmacológicos y severidad | 15 ok |
| **42** | `suite_42_canales_de_aviso.js` | Los 28 canales de alerta sonora, visual y toasts | 32 ok |
| **43** | `suite_43_conformidad_cruzada.js`| Validación cruzada de paridad con Copiloto RCV | 42 ok |
| **44** | `suite_44_grounding_sin_phi.js` | Verificación de cero PHI en groundings y esquemas | 6 ok |

---

## 3. Arquitectura del Cargador (`harness.js`)

El userscript se empaqueta como un **único IIFE** (`(function() { ... })();`) sin módulos ES ni dependencias de compilación para garantizar compatibilidad con Tampermonkey.

`tests/harness.js` carga el script sin modificar el archivo de producción en disco:
1. Lee `vigilante_agenda.user.js` como texto.
2. Inyecta al final un hook que expone las funciones privadas en un objeto `api` (`Object.assign(scope, { ... })`).
3. Construye un contexto de máquina virtual (`vm.createContext`) con una simulación ligera pero fiel del DOM (`window`, `document`, `localStorage`, `sessionStorage`, `AudioContext`, `MutationObserver`).
4. Configura `document.readyState = "loading"`, impidiendo que `boot()` arranque automáticamente la interfaz durante las pruebas unitarias.

---

## 4. Medición de Cobertura y Anti-Inflación por Proxy (`runner.js`)

El ejecutor (`tests/runner.js`) incorpora un **Proxy de sólo lectura** en el objeto `api`:
- **Validación Estricta de `cubre: [...]`:** Antes de iniciar, el runner verifica que cada función declarada en el array `cubre` de una suite exista realmente en el userscript.
- **Rastreo de Acceso en Ejecución:** El Proxy intercepta las lecturas de propiedades en tiempo de ejecución. Si una suite declara una función en `cubre` pero sus pruebas jamás leen ni invocan `api.nombreFuncion`, el runner la reporta al final de la ejecución bajo la sección de advertencia informativa.

---

## 5. Reglas de Mutación y Pruebas Rojas

1. **Toda nueva funcionalidad clínica requiere prueba de mutación:** Romper intencionalmente la línea de código, verificar que la prueba específica caiga en rojo, restaurar y confirmar el regreso al verde.
2. **Registro Obligatorio:** Documentar la mutación en [`tests/INFORME_MUTACIONES.md`](file:///e:/VA_reconciliacion/tests/INFORME_MUTACIONES.md).
3. **Pruebas Rojas:** Cualquier defecto o discrepancia descubierta por una satélite se entrega como archivo ejecutable en `tests/rojas/` con su documento explicativo `.md` para que el tronco la ponga en verde.
