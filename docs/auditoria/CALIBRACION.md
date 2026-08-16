# Informe de Calibración (Fase 0) — Enjambre de Diagnóstico

> **Fecha de ejecución:** 15 de agosto de 2026  
> **Ámbito de auditoría:** ~16.800 líneas en `vigilante_agenda.user.js` y 47 suites en `tests/`  
> **Comando de verificación base:** `node tests/runner.js` (1401 comprobaciones en verde)

---

## 1. Resumen de Calibración

La Fase 0 de calibración exige comprobar la efectividad del método de auditoría confrontándolo contra los 9 casos históricos del patrón *"cosas que parecen vivas y no lo están"*.

- **Casos confirmados encontrados (8 de 8):** ✅ 100% detectados con evidencia verificable.
- **Caso refutado (#7 - PR #69):** ❌ **RECHAZADO COMO FALSO POSITIVO** (confirmado que `estadioRenalDelPaciente` y `_signosVitalesInvalidar` sí cuentan con aserciones directas, llamadas en tiempo de ejecución y mutaciones cazadas en `suite_29_estadio_renal_r1b.js`).
- **Estado de `vigenciaPorEstadio` (#8):** 🔍 **RESUELTO CON EVIDENCIA ACTUAL**: Salió del modo sombra. Ya cuenta con llamador de producción en la línea 3149 (`_vigenciaDiasParaAnalito`), invocado a su vez en la línea 3408 (`_analitosRcvVencidos`).

---

## 2. Auditoría de los 9 Casos de Calibración

### Caso 1 — `suite_05`: 6 de 8 casos sin `await`
- **Diagnóstico:** En versiones previas, `pruebas()` en `suite_05_api_everest.js` no era `async` y los `t.casoAsync` se ejecutaban sin `await`. Las aserciones resolvían después de que el runner cerraba la suite, reportando "1 ok" y ocultando 6 fallos en funciones críticas de escritura (`apiOrdenamientoGuardar`, `apiAccesoAsignarTurno`).
- **Estado actual:** Corregido en `suite_05_api_everest.js` y blindado con el centinela estático de `suite_26_banco_sano.js` (línea 119), que falla si cualquier suite introduce un `t.casoAsync` sin `await`.

### Caso 2 — `suite_25`: Arrays vacíos en aserciones (`[].every()`)
- **Diagnóstico:** Comprobaciones del tipo `t.cierto(lista.every(...))` sobre colecciones vacías devuelven `true` por definición en JavaScript. En `pymCubiertoPorOrdenVigente` (v14.1.4), una actividad sin CUPS o con lista vacía se daba por cubierta sin verificar nada.
- **Estado actual:** Corregido con la guarda obligatoria `cups.length > 0` y blindado en `suite_37_invariantes_criticos.js` (línea 46) y `suite_21_v12_4_pym_horas.js` (línea 332).

### Caso 3 — `suite_04`: `t.noLanza` ciego
- **Diagnóstico:** Uso de `t.noLanza` sobre funciones de alerta (`checkLabsVencidos`, `checkRecordatorioPym`) donde la prueba pasa sin comprobar el estado real resultante (ej. si el aviso se marcó como visto o si el DOM cambió).
- **Estado actual:** `suite_04_agenda_alertas.js` fue reforzada en v14.2.0 agregando aserciones explícitas de estado (`t.cierto(c.api.avisoYaVisto(uid))`) tras cada llamada.

### Caso 4 — `runner.js`: `t.lanza`/`t.noLanza` con funciones `async`
- **Diagnóstico:** `t.lanza` y `t.noLanza` eran puramente síncronos; al recibir una función `async` devolvían una promesa que no se esperaba, impidiendo capturar rechazos asíncronos y dando verde incondicional.
- **Estado actual:** Corregido en `runner.js` (líneas 36-72) bifurcando según si el retorno es un *thenable*, y respaldado por 4 pruebas en `suite_26_banco_sano.js` (líneas 35-54).

### Caso 5 — PR #59: Guarda de cobertura que buscaba el nombre como texto
- **Diagnóstico:** La verificación original de cobertura (`nuncaNombradas`) realizaba un regex textual sobre el archivo de la suite. Un nombre de función que apareciera dentro de un comentario o cadena se consideraba "cubierto" sin ejecutarse.
- **Estado actual:** `runner.js` implementó `envolverApiParaCobertura` (líneas 113-122) usando un `Proxy` en tiempo de ejecución para registrar accesos reales a propiedades de `api`.

### Caso 6 — PR #66: `cubre` sin prueba (`_evaluarAccionesRenales`)
- **Diagnóstico:** Se añadió `_evaluarAccionesRenales` al array `cubre` de la suite sin implementar ninguna prueba ni aserción, inflando artificialmente el porcentaje de cobertura para superar `MIN_COVERAGE`.
- **Estado actual:** PR #66 fue cerrado y no fusionado. La función no existía en la base v14.1.8.

### Caso 7 — PR #69: Dos nombres en `cubre` sin prueba — **REFUTADO**
- **Veredicto:** ❌ **FALSO POSITIVO HISTÓRICO — RECHAZADO.**
- **Evidencia en el código actual:**
  - `estadioRenalDelPaciente`: Tiene más de 12 pruebas directas en `suite_29_estadio_renal_r1b.js` (líneas 35-255) con cobertura de casos borde (edad <= 0, creatinina fuera de rango, discriminación por sexo) y mutaciones cazadas documentadas en `tests/INFORME_MUTACIONES.md`.
  - `_signosVitalesInvalidar`: Se invoca explícitamente en `suite_29_estadio_renal_r1b.js` línea 285 (`c.api._signosVitalesInvalidar()`) y su efecto se comprueba en la línea 287 con `t.igual(n, 3, "tras invalidar, vuelve a consultar")`.
- **Conclusión:** Ambos métodos se prueban de verdad; reportarlos como huecos de cobertura fue un falso positivo derivado de análisis puramente textual o de desactualización de notas.

### Caso 8 — `vigenciaPorEstadio`: Estado de código en sombra
- **Diagnóstico original:** Declarada con "cero llamadores en producción" en v14.1.8 con 101 referencias en `suite_28`.
- **Estado actual verificado en el código:** **SALIÓ DE MODO SOMBRA.**
  - Declaración: `vigilante_agenda.user.js` línea 3351 (`function vigenciaPorEstadio(programa, estadio, analito, opciones)`).
  - Llamador de producción: Línea 3149 en `_vigenciaDiasParaAnalito`:
    ```javascript
    const v = vigenciaPorEstadio(programa, opts.estadio, analito, opts);
    ```
  - Cadena de integración: `_analitosRcvVencidos` (línea 3408) invoca `_vigenciaDiasParaAnalito`, que a su vez ejecuta `vigenciaPorEstadio`.

### Caso 9 — Las 16-17 funciones huérfanas del PR #68
- **Diagnóstico:** Detección de funciones sin llamador en producción mediante análisis de grafo de llamadas BFS y AST.
- **Resultado del barrido:** Se confirmaron las categorías de:
  - Deuda muerta (`_conductaBuscarYAgregarExamen`, `apiDigiturnoFinalizarTicket`, `apiHcValidacionExamenCronicos`, `_demograficosInvalidar`, `debounceVgl`, `migrarEsquemaVgl`, etc.).
  - Funciones a medio enganchar (`panelActivities`, `calcTargetDateRange`, `mtrLeerFactoresRCV`).
  - Costuras de prueba (`_getRacGuardiaParaTest`, `_setRacGuardiaParaTest`, `_getUltimoRelevoParaTest`, `_setUltimoRelevoParaTest`, `_getFirmaPropiaParaTest`, `_setFirmaPropiaParaTest`).

---

## 3. Veredicto de Calibración

El sistema de escaneo y verificación ha demostrado:
1. Detectar con precisión los 8 casos confirmados.
2. Rechazar correctamente el Caso #7 sin caer en la trampa del falso positivo.
3. Determinar con evidencia el estado real de `vigenciaPorEstadio`.
4. El método es apto para proceder con la auditoría general de Sombras.
