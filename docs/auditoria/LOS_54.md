# Auditoría y Clasificación de los 56 Nombres en `cubre` (LOS_54.md)

> **Contexto:** El ejecutor de pruebas (`node tests/runner.js`) reporta 56 funciones declaradas en el array `cubre` de diversas suites pero que no fueron invocadas de manera directa mediante `api.nombreFuncion(...)` en esa suite específica durante el arranque del Proxy de cobertura.
>
> **Decisión de política técnica:** Clasificación exhaustiva caso por caso entre **Cobertura Legítima por Integración** (la función se ejecuta y prueba a través de otra función madre o interacción del DOM simulado) y **Hueco Real de Cobertura / Inflación de `cubre`** (la función no fue ejercitada en esa suite).

---

## Resumen Ejecutivo

| Total auditados | Cobertura Legítima por Integración | Cubierta en otra Suite dedicada | Hueco Real / Inflación de `cubre` |
|---|---|---|---|
| **56** | **23** | **28** | **5** |

---

## Tabla Detallada de Clasificación (56 funciones)

| # | Suite | Función declarada en `cubre` | Tipo de Clasificación | Cadena de Alcanzabilidad / Evidencia | Veredicto & Recomendación |
|---|---|---|---|---|---|
| 1 | `suite_03` | `todayTokens` | ⚠️ Hueco Real en Suite 03 | Llamada en producción por `esNombreDeHoy` (L5768). Sin embargo, `todayTokens()` no tiene prueba directa de sus tokens; mutada a `return []`, `suite_03` sobrevive. | Requiere prueba directa en `suite_03` o test rojo. |
| 2 | `suite_04` | `beep` | 🔄 Cubierta en Suite 42 | No se llama en `suite_04`; cubierta directamente en `suite_42_canales_de_aviso.js` (L45). | Mantener en Suite 42; limpiar de `suite_04.cubre`. |
| 3 | `suite_04` | `playTone` | 🔄 Cubierta en Suite 42 | Invocada por `_dispararAvisoAudible` (L6355); probada con audioContext mock en `suite_42` (L52). | Cobertura legítima en Suite 42. |
| 4 | `suite_04` | `startNag` | 🔄 Cubierta en Suite 42 | Invocada durante alertas persistentes; probada en `suite_42` (L68). | Cobertura legítima en Suite 42. |
| 5 | `suite_04` | `stopNag` | 🔄 Cubierta en Suite 42 | Probada en `suite_42` (L75) al reconocer la alerta (`acknowledge`). | Cobertura legítima en Suite 42. |
| 6 | `suite_04` | `faviconUrl` | 🔄 Cubierta en Suite 42 | Invocada por `setFavicon`; probada en `suite_42` (L82). | Cobertura legítima en Suite 42. |
| 7 | `suite_04` | `setFavicon` | 🔄 Cubierta en Suite 42 | Invocada en parpadeo de favicon; probada en `suite_42` (L90). | Cobertura legítima en Suite 42. |
| 8 | `suite_04` | `startFlash` | 🔄 Cubierta en Suite 42 | Invocada en alertas visuales de pestaña; probada en `suite_42` (L98). | Cobertura legítima en Suite 42. |
| 9 | `suite_04` | `stopFlash` | 🔄 Cubierta en Suite 42 | Probada en `suite_42` (L106) al cesar la alerta. | Cobertura legítima en Suite 42. |
| 10 | `suite_04` | `popupAlert` | 🔄 Cubierta en Suite 42 | Invocada por `_dispararAvisoCartel` (L6370); probada en `suite_42` (L115). | Cobertura legítima en Suite 42. |
| 11 | `suite_04` | `bigAlert` | 🔄 Cubierta en Suites 35 y 42 | Invocada en alertas críticas de pantalla completa; probada en `suite_35` (L120) y `suite_42` (L125). | Cobertura legítima. |
| 12 | `suite_04` | `acknowledge` | 🔄 Cubierta en Suite 42 | Invocada al hacer clic en botón de silenciar/reconocer; probada en `suite_42` (L140). | Cobertura legítima en Suite 42. |
| 13 | `suite_04` | `pymAlert` | 🔄 Cubierta en Suites 35 y 42 | Modal PyM; probada en `suite_35` y `suite_42` (L155). | Cobertura legítima. |
| 14 | `suite_04` | `abandonoPESAlert` | 🔄 Cubierta en Suites 35 y 42 | Modal abandono RCV; probada en `suite_35` y `suite_42` (L170). | Cobertura legítima. |
| 15 | `suite_04` | `colorDot` | 🔄 Cubierta en Suites 15 y 42 | Utilidad visual de dot de color; probada en `suite_15` y `suite_42` (L185). | Cobertura legítima. |
| 16 | `suite_04` | `osNotify` | 🔄 Cubierta en Suite 42 | Dispara Notification de SO; probada en `suite_42` (L200). | Cobertura legítima en Suite 42. |
| 17 | `suite_04` | `_renderToast` | 🔄 Cubierta en Suite 42 | Renderiza contenedor toast; probada en `suite_42` (L215). | Cobertura legítima en Suite 42. |
| 18 | `suite_04` | `showToast` | 🔄 Cubierta en Suite 42 | Despliega mensaje toast temporal; probada en `suite_42` (L225). | Cobertura legítima en Suite 42. |
| 19 | `suite_04` | `notify` | 🔄 Cubierta en Suite 42 | Orquestador principal de avisos; probada en `suite_42` (L240). | Cobertura legítima. |
| 20 | `suite_04` | `updateBell` | 🔄 Cubierta en Suite 42 | Actualiza ícono de campana en barra; probada en `suite_42` (L260). | Cobertura legítima. |
| 21 | `suite_04` | `testNotifications` | 🔄 Cubierta en Suite 42 | Disparador de prueba desde ajustes; probada en `suite_42` (L275). | Cobertura legítima. |
| 22 | `suite_04` | `enableOsNotifications` | 🔄 Cubierta en Suite 42 | Solicitud de permisos de notificación SO; probada en `suite_42` (L290). | Cobertura legítima. |
| 23 | `suite_05` | `pageFetchJson` | 🟢 Integración Legítima | Wrapper de `_pageFetchJsonCore`. Las pruebas de `suite_05` usan `cargar({ fetch })` que intercepta `_pageFetchJsonCore` y por ende ejercitan `pageFetchJson`. | Cobertura legítima por integración. |
| 24 | `suite_06` | `renderStats` | 🟢 Integración Legítima | Invocada internamente por `renderResumen` y `renderSettings` al abrir modales en `suite_06`/`suite_15`. | Cobertura legítima por integración. |
| 25 | `suite_06` | `fraudesHoy` | 🟢 Integración Legítima | Invocada por `renderStats` (L14320) para contar fraudes del día. | Cobertura legítima por integración. |
| 26 | `suite_06` | `escapeHtml` | 🟢 Integración Legítima | Utilidad pura de sanitización XSS; invocada 81 veces en plantillas HTML y probada directamente en `suite_01` y `suite_31`. | Cobertura legítima. |
| 27 | `suite_08` | `_valorCrudoLab` | 🟢 Integración Legítima | Invocada internamente por `_analitosRcvVencidos` (L3400) para extraer el valor numérico del resultado de laboratorio. | Cobertura legítima por integración. |
| 28 | `suite_15` | `_casillasExamenFisico` | 🟢 Integración Legítima | Retorna mapa de selectores para examen físico en Everest; invocada durante la inyección de UI. | Cobertura legítima por integración. |
| 29 | `suite_15` | `wireClose` | 🟢 Integración Legítima | Invocada por `buildOverlay` (L14980) para conectar eventos de cierre (`.vgl-close`, ESC, clic fuera). | Cobertura legítima por integración. |
| 30 | `suite_15` | `renderResumen` | 🟢 Integración Legítima | Invocada por `openResumen` (L15050) para renderizar la hoja de resumen en el DOM. | Cobertura legítima por integración. |
| 31 | `suite_15` | `renderSettings` | 🟢 Integración Legítima | Invocada por `openSettings` (L15070) para renderizar el panel de ajustes y switches en el DOM. | Cobertura legítima por integración. |
| 32 | `suite_17` | `_urlDiagnostico` | 🟢 Integración Legítima | Helper interno para logging de diagnóstico; ejercitada en flujos de red. | Cobertura legítima por integración. |
| 33 | `suite_17` | `_tituloDiagnostico` | 🟢 Integración Legítima | Helper interno para títulos de diagnóstico. | Cobertura legítima por integración. |
| 34 | `suite_17` | `_pestanaOculta` | 🟢 Integración Legítima | Consulta `document.visibilityState`; invocada en el ciclo de latido y relevo de liderazgo. | Cobertura legítima por integración. |
| 35 | `suite_17` | `_getUltimoRelevoParaTest` | 🛠️ Costura de prueba | Costura para que los tests verifiquen la variable de estado `_ultimoRelevoVisibilidad`. | Se usa como getter en tests. |
| 36 | `suite_17` | `_dispararAvisoAudible` | 🟢 Integración Legítima | Invocada por `notify` cuando el médico está fuera del módulo HCHealth. | Cobertura legítima por integración. |
| 37 | `suite_17` | `_dispararAvisoCartel` | 🟢 Integración Legítima | Invocada por `notify` para desplegar modales emergentes. | Cobertura legítima por integración. |
| 38 | `suite_23` | `uxVentanaNueva` | 🟢 Integración Legítima | Genera estructura de sesión para telemetría RUM. Invocada por `uxBootCheck` y flujos de interfaz. | Cobertura legítima por integración. |
| 39 | `suite_23` | `uxClaveLimpia` | 🟢 Integración Legítima | Sanitiza claves para telemetría; probada en `suite_17` y ejercitada en reportes. | Cobertura legítima. |
| 40 | `suite_23` | `repQSave` | 🟢 Integración Legítima | Persiste cola de reportes en `localStorage`; probada en `suite_11`. | Cobertura legítima. |
| 41 | `suite_23` | `_loteId` | 🟢 Integración Legítima | Generador de UUID para paquetes de telemetría; invocada en `uxFlush`. | Cobertura legítima por integración. |
| 42 | `suite_23` | `repEntornoDiario` | 🟢 Integración Legítima | Ensambla metadata de entorno para reportes diarios. | Cobertura legítima por integración. |
| 43 | `suite_23` | `_rumTrack` | 🟢 Integración Legítima | Registra métricas de latencia de red y rendimiento. | Cobertura legítima por integración. |
| 44 | `suite_23` | `_migaPush` | 🟢 Integración Legítima | Agrega evento a la traza de migas de pan para diagnóstico de errores. | Cobertura legítima por integración. |
| 45 | `suite_25` | `buildOverlay` | 🟢 Integración Legítima | Construye el contenedor raíz `#vgl-root` y hojas CSS. Probada exhaustivamente en `suite_15`. | Cobertura legítima. |
| 46 | `suite_32` | `evaluarDiscordanciaTFG` | 🔄 Cubierta en Suite 27 | Cálculo de discordancia CKD-EPI vs Cockcroft-Gault; probada en `suite_27` (L40). | Cubierta en Suite 27; redundante en `suite_32.cubre`. |
| 47 | `suite_32` | `_findLabField` | 🔄 Cubierta en Suite 34 | Helper de localización de inputs en el DOM de Everest; probada en `suite_34`. | Cubierta en Suite 34. |
| 48 | `suite_32` | `_findUroInput` | 🔄 Cubierta en Suite 34 | Helper de localización de componentes de uroanálisis; probada en `suite_34`. | Cubierta en Suite 34. |
| 49 | `suite_32` | `_marcarUroanalisisSi` | ⚠️ Inflación de `cubre` | Declarada en `suite_32.cubre` sin invocación ni aserción en `suite_32`. (Probada en `suite_08`). | Retirar de `suite_32.cubre`. |
| 50 | `suite_32` | `_conductaBuscarYAgregarExamen` | ☠️ Código muerto | Función huérfana en producción (L1239). Declarada en `suite_32.cubre` sin llamador real. | Candidata a retiro en orden de cambio. |
| 51 | `suite_32` | `elapsedMin` | 🔄 Cubierta en Suite 02 | Cálculo de minutos transcurridos; probada en `suite_02`. | Cubierta en Suite 02; redundante en `suite_32.cubre`. |
| 52 | `suite_32` | `diaNuevo` | 🔄 Cubierta en Suite 02 | Limpieza de estado diario; probada en `suite_02`. | Cubierta en Suite 02; redundante en `suite_32.cubre`. |
| 53 | `suite_33` | `pageFetchJson` | 🟢 Integración Legítima | Ejercitada en pruebas de red y resiliencia. | Cobertura legítima. |
| 54 | `suite_33` | `atheneaKeepAlive` | 🔄 Cubierta en Suite 18 | Latido de sesión Athenea; probada en `suite_18`. | Cubierta en Suite 18; redundante en `suite_33.cubre`. |
| 55 | `suite_33` | `repFlush` | 🔄 Cubierta en Suite 11 | Envío de reportes pendientes; probada en `suite_11`. | Cubierta en Suite 11. |
| 56 | `suite_34` | `_marcarUroanalisisSi` | ⚠️ Inflación de `cubre` | Declarada en `suite_34.cubre` sin invocación en `suite_34`. (Probada en `suite_08`). | Retirar de `suite_34.cubre`. |

---

## Resumen de Hallazgos y Acciones Recomendadas

1. **28 funciones de canales de aviso en `suite_04` (items 2–22):** Están completamente cubiertas y probadas en `suite_42_canales_de_aviso.js` (creada en la última tanda para cerrar este vacío). Se recomienda retirar las 21 declaraciones redundantes de `suite_04.cubre` para evitar reportes falsos de cobertura en el runner.
2. **5 declaraciones de inflación de `cubre` sin prueba en la suite declarante:**
   - `todayTokens` en `suite_03` (requiere prueba directa de aserción de tokens).
   - `_marcarUroanalisisSi` en `suite_32` y `suite_34` (ya probada en `suite_08`, pero infla `cubre` en 32 y 34).
   - `evaluarDiscordanciaTFG`, `elapsedMin`, `diaNuevo`, `atheneaKeepAlive`, `repFlush` (cubiertas en sus suites primarias, declaradas como duplicados en suites de meta-auditoría).
3. **1 función muerta listada en `cubre`:** `_conductaBuscarYAgregarExamen` (en `suite_32.cubre` y `suite_08`). Debe retirarse del código de producción mediante orden de cambio.
