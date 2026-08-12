# Informe de Verificación Adversarial (Fase 3 - Agentes D1 a D6)

## D1 · Cazador de invenciones
*   **Inspección:** Todos los selectores y endpoints introducidos estaban previamente presentes y respaldados por capturas. El mapeo de etiquetas de paciente se realiza de forma flexible normalizando las cuerdas para acomodar mayúsculas/minúsculas y espacios, cayendo en el caso "SIN_ETIQUETA" seguro si falla, lo que cumple la regla de no inventar.
*   **Veredicto:** Aprobado.

## D2 · Auditor de PHI
*   **Inspección:** El diff acumulado y las pruebas en `tests/` incluyen nombres explícitamente ficticios ("JUAN", "PEDRO", "MARIA") y documentos tipo `"123", "111", "333"`. Ninguna de las salidas de log contiene datos identificables, en su lugar se loguea la forma de los arreglos.
*   **Veredicto:** Aprobado. Cero PHI.

## D3 · Refutador de mutaciones
*   **Inspección:** Se verificó de nuevo cada mutación de las tareas `TA`, `T3`, `T4`, `T5` restaurando manualmente los códigos a estados deficientes:
    *   Mutación `TA`: `.atendido` desactivado. Falla la aserción correspondiente en suite_04.
    *   Mutación `T3`: Regla de "escalera" re-insertada. Falla la comprobación sobre paciente "Nefroprotección+Diabetes" en suite_23.
    *   Mutación `T4`: Sábados excluidos de cálculo en `calcTargetDateRangeExtended`. Cae la suite_24 de conteo de días candidato.
    *   Mutación `T5`: Aserción de CSS `.adicional` desactivada en asignación de horas. Cae la suite_25.
*   **Veredicto:** Todas las pruebas demuestran ser verídicas y no triviales. Aprobado.

## D4 · Verificador de regresión funcional
*   **Inspección:** La refactorización ha tocado la creación del modal y la renderización, pero ha mantenido las llamadas intactas al contrato de `AsignarTurno` (L7460-7540). El módulo del panel post-cita, el SMS, y Laboratorios (que de hecho se le mantuvieron las rutinas de±3 días al no tocar `calcDateRangeAroundIso`) siguen completamente funcionales.
*   **Veredicto:** Aprobado.

## D5 · Adversario de red
*   **Inspección:** El sondeo múltiple con `pollDayAgenda` puede fallar si la API se cae. El código prevé que el `fetch` rechace, devolviendo `null` a través del `catch(() => null)`. Si esto ocurre para todos los 16 días, la lógica lo degrada a la vista básica de "±3 días hábiles" (fallback implementado en T4) con advertencia explícita.
*   **Veredicto:** Aprobado.

## D6 · Crítico de completitud
*   **Inspección:** Los requerimientos del brief pedían incluir sábados y 7 días de ventana (implementado), ocultar días sin agenda (implementado), destacar visualmente citas adicionales y recomendadas para diabetes (implementado). El diseño seleccionado fue B3 y está plasmado.
*   **Veredicto:** Aprobado.
