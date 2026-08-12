## Mutación TA

- **Línea rota:** En `vigilante_agenda.user.js` (render), se alteró temporalmente la asignación de clase CSS para forzar `esAtendido = false` o que ambas tuvieran el mismo tratamiento visual (quitando `+ (esAtendido ? " atendido" : "")`).
- **Prueba que cayó:** `TA: 'Atendido' recibe clase CSS .atendido y se atenúa, salvo que sea fraude (ROJO)` en `suite_15_interfaz_avanzada.js`.
- **Verde tras restaurar:** Sí, 499/499 comprobaciones pasan.

## Mutación T3
- **Línea rota:** En `perfilPaciente`, se hizo que nefroprotección anulara la franja de diabetes devolviendo el modelo a escalera.
- **Prueba que cayó:** `perfilPaciente: Nefroprotección + Diabetes -> primera mitad, NO adicionales` y `Nefroprotección + HTA+DM`. Ambas fallaron esperando "primera_mitad" y obteniendo "sin_preferencia".
- **Verde tras restaurar:** Sí, 510/510 comprobaciones pasan.

## Mutación T4
- **Línea rota:** En `calcTargetDateRangeExtended`, cambiamos la lógica para que los sábados no fueran incluidos, para ver si fallaban las pruebas o se rompía el modelo de D1 (sábados confirmados).
- **Prueba que cayó:** `calcTargetDateRangeExtended: devuelve +/- 7 hábiles y Sábados (total ~16 días)`
- **Verde tras restaurar:** Sí, 512/512 comprobaciones pasan.

## Mutación T5
- **Línea rota:** Se eliminó temporalmente la asignación de `extraClasses = " adicional";` en la construcción de los botones, haciendo que 07:30 no recibiera el realce de adicional.
- **Prueba que cayó:** `T5: Horas adicionales se distinguen con clase .adicional`.
- **Verde tras restaurar:** Sí, 513/513 comprobaciones pasan.
