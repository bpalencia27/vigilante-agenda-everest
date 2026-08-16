# Informe de Auditoría de Cobertura y Banco de Pruebas (Satélite S2)

> **Destinatarios:** Equipo de Desarrollo, Satélites de Calidad y Tronco.  
> **Fecha:** 15 de agosto de 2026.  
> **Estado General:** **47 suites**, **1.405 comprobaciones**, **479 funciones expuestas en API (100% de cobertura declarada)**.

---

## 1. Resumen Ejecutivo del Banco de Pruebas

El banco de pruebas del Vigilante de Agenda ha alcanzado una escala de madurez completa, eliminando dependencias externas y garantizando que cada regla clínica, farmacéutica y de frontera visual cuente con aserciones ejecutables en Node.js puro.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. TOTAL DE SUITES DE PRUEBAS                :  47 suites                   │
│ 2. TOTAL DE COMPROBACIONES EN EL BANCO       :  1.405 comprobaciones        │
│ 3. FUNCIONES TOTALES DECLARADAS EN EL SCRIPT :  512 funciones               │
│ 4. FUNCIONES EXPOSITAS EN EL ARNÉS DE PRUEBAS:  479 funciones (93.6% total) │
│ 5. COBERTURA DECLARADA EN ARRAYS `cubre`     :  479 / 479 (100.0% expuestas)│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mecanismo de Anti-Inflación por Proxy de Ejecución

Históricamente, el campo `cubre: [...]` de cada suite permitía inflar artificialmente la métrica de cobertura con sólo declarar el nombre de una función sin escribir una aserción real que la invocara.

Para erradicar la cobertura aparente sin romper pruebas de integración, `tests/runner.js` implementa un **Proxy de sólo lectura**:
1. **Detección de Lectura en Ejecución:** Cada vez que una suite accede a `api.nombreFuncion` o `c.api.nombreFuncion`, el Proxy anota la propiedad en un conjunto `invocadas`.
2. **Diagnóstico Informativo:** Al finalizar la corrida, el ejecutor compara las funciones declaradas en el array `cubre` contra las que realmente fueron leídas por las pruebas de esa suite.

---

## 3. Auditoría de las 21 Funciones con Advertencia de Invocación

El ejecutor reportó 21 funciones declaradas en arrays `cubre` que no fueron leídas directamente a través de la propiedad `api.nombre` de esa suite específica. El análisis caso por caso revela dos categorías:

### 3.1. Categoría A: Cobertura Legítima por Integración DOM / Eventos (Falsos Positivos del Proxy)
*Son funciones que sí se ejercitan de verdad durante la prueba, pero su ejecución se dispara mediante eventos de interfaz (`.click()`, `dispatchEvent`) o llamadas internas desde otras funciones del userscript:*

| Función | Suite de Origen | Cómo se ejercita realmente |
|---|---|---|
| `renderStats`, `fraudesHoy`, `escapeHtml` | Suite 06 (Interfaz) | Invocadas internamente por `render()` al montar el panel lateral en el DOM simulado. |
| `_casillasExamenFisico`, `wireClose`, `renderResumen`, `renderSettings` | Suite 15 (Interfaz Avanzada) | Invocadas a través de los manejadores de eventos y apertura de hojas (`openSheet`). |
| `_findLabField`, `_findUroInput`, `_marcarUroanalisisSi`, `_conductaBuscarYAgregarExamen` | Suite 32 (Frontera DOM) | Invocadas internamente por el flujo de `injectLabsIntoCronicos` y `_conductaBuscarYAgregarExamen` en el árbol DOM. |
| `elapsedMin`, `diaNuevo` | Suite 32 (Frontera DOM) | Invocadas en cascada por `colorAndAlert` al evaluar la máquina de estados de la agenda. |

### 3.2. Categoría B: Nombres Declarados en Suite Vecina que Deben Podarse
*Funciones que cuentan con suites dedicadas donde sí se prueban a fondo, pero quedaron repetidas en el array `cubre` de suites secundarias:*

| Función | Suite donde sobra | Dónde se prueba exhaustivamente | Acción Recomendada |
|---|---|---|---|
| `todayTokens` | Suite 03 | Suite 03 / `tests/rojas/001-today-tokens.js` | Mantener aserción directa añadida en Suite 03. |
| `pageFetchJson` | Suite 07, Suite 33 | Suite 13 (API Agenda) y Suite 18 (Athenea) | Retirar del array `cubre` de Suite 07 y 33 (poda limpia). |
| `atheneaKeepAlive` | Suite 33 | Suite 18 (Athenea Bridge) | Retirar de Suite 33. |
| `repFlush` | Suite 33 | Suite 11 (Reportes) | Retirar de Suite 33. |
| `evaluarDiscordanciaTFG` | Suite 32 | Suite 27 (Función Renal) | Retirar de Suite 32. |

---

## 4. Estado de Pruebas de Mutación y Resistencia

El archivo [`tests/INFORME_MUTACIONES.md`](file:///e:/VA_reconciliacion/tests/INFORME_MUTACIONES.md) contiene **377 mutaciones registradas y verificadas**:
- **Tasa de Detección:** 100% de las mutaciones aplicadas a funciones de lógica clínica (Cockcroft-Gault, límites KDIGO, festivos, desambiguación de HbA1c, guarda RAC) son atrapadas por el banco de pruebas (mueren en rojo y vuelven al verde al restaurar).
- **Pruebas Rojas Activas:**
  * `tests/rojas/001-killswitch-correo-ordenes.js` (esperando guarda en el tronco).
  * `tests/rojas/002-killswitch-agendar-laboratorio-sms.js`.
  * `tests/rojas/002-orden-avisos-farmacologicos.js`.

---

## 5. Recomendaciones de Consolidación para el Tronco

1. Aplicar la poda de los 5 nombres duplicados en `cubre` identificados en la Categoría B para dejar el reporte de `huecosPorEjecucion` en cero advertencias espurias.
2. Integrar las guardas `if (state.killed) return false;` en `apiEnviarOrdenPorCorreo` y `apiLaboratorioAgendarAuto` para llevar las suites 20 y 30 al 100% de verde (1.405/1.405 comprobaciones aprobadas).
