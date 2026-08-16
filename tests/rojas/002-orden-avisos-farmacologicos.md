# Prueba Roja 002 — Eliminación del bypass condicional en `suite_41` (Orden CRITICAL vs HIGH)

- **Qué está mal:** En `tests/suite_41_motor_vista.js` (línea 122), la aserción de orden de severidad estaba envuelta en un condicional permisivo:
  ```javascript
  if (primerAlto >= 0) t.cierto(primerCrit < primerAlto, "un HIGH quedó antes que un CRITICAL");
  ```
  Si un cambio accidental en el motor farmacológico provoca que los avisos de severidad HIGH (`vgl-mtr-alto`) dejen de renderizarse, `primerAlto` se convierte en `-1`. La condición `if (primerAlto >= 0)` se evalúa como `false`, **la aserción nunca se ejecuta y la prueba continúa reportando verde sin haber medido la precedencia de severidad**.
- **Cómo reproducirlo:**
  Mutar el template o generador para que no emita avisos de severidad `HIGH`. La suite 41 actual pasa en verde, mientras que la prueba roja `tests/rojas/002-orden-avisos-farmacologicos.js` cae inmediatamente con `"debe existir al menos un aviso de advertencia alta (vgl-mtr-alto)"`.
- **Qué línea de producción la pone verde:**
  En producción, `mtrRenderAvisosHtml` ya ordena los avisos (`todo.sort(...)`). La prueba roja elimina la guarda condicional y exige formalmente que ambos niveles existan y mantengan el orden de prioridad clínica en el DOM.
- **Consecuencia clínica:** En pacientes polimedicados con falla renal (ej. ERC G4), la prioridad visual de las contraindicaciones absolutas (ej. Metformina o Triple Whammy) sobre las advertencias de monitoreo (ej. Losartán) es crítica para evitar fatiga de alertas en los 15 minutos de consulta. Triage: Backlog de Mejoras / Refuerzo del Banco de Pruebas.
