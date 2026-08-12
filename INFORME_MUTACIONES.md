## Mutación TA

- **Línea rota:** En `vigilante_agenda.user.js` (render), se alteró temporalmente la asignación de clase CSS para forzar `esAtendido = false` o que ambas tuvieran el mismo tratamiento visual (quitando `+ (esAtendido ? " atendido" : "")`).
- **Prueba que cayó:** `TA: 'Atendido' recibe clase CSS .atendido y se atenúa, salvo que sea fraude (ROJO)` en `suite_15_interfaz_avanzada.js`.
- **Verde tras restaurar:** Sí, 499/499 comprobaciones pasan.
