# Enjambre UI/UX del 02-sep-2026 — material de las fases 1-2

- `../AUDITORIA_UIUX_20260902.md` — el entregable consolidado (fases 1-3, tabla de 48 filas, 22 fragmentos de código con verificación).
- `ux_clinico_20260902.md` — informe del agente UX_Clinico (recorrido simulado, 26 fricciones).
- `ui_estetico_20260902.md` — informe del agente UI_Estetico (728 nodos medidos en Chromium, 22 hallazgos, CSS propuesto).
- `render.js`, `variantes.js` — cómo se renderizó el HTML real de cada superficie y se midieron contrastes y solapes (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node …`).
- `medir_doble_cargarHoras.js` — medición con el arnés de la apertura de Agendar (fila 19 de la tabla).
- `anclas_v18.0.113.txt` — desplazamiento de líneas entre la instantánea auditada (v18.0.113) y el árbol final (v18.0.116).

Las 38 capturas PNG citadas por nombre en los informes quedan fuera del repositorio (se regeneran con `render.js`).
Ningún fragmento de la fase 3 está aplicado: cada uno pasa antes por reproducción, prueba, mutación y, si toca CSS,
medición en Chromium (regla del proyecto), y las ⚖️ esperan la decisión del médico. Cero PHI: todos los datos son sintéticos.
