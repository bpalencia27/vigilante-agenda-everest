# PROMPT — MESA DE EXPERTOS: Auditoría, Refactorización y Mejora Integral del Vigilante de Agenda

Pedido en vivo del médico (08-sep-2026): crear un prompt profesional de «mesa de
expertos» para auditar, refactorizar y mejorar de forma integral el userscript
`vigilante_agenda.user.js` (IIFE único, ~54 K líneas, sin build, sin dependencias,
usado EN VIVO durante consultas reales sobre el EHR Everest de Athenea), y
**ejecutarlo de inmediato** sobre el script objetivo.

---

## 1. Misión

Resolver TODOS los problemas del código sin romper NADA de lo que hoy funciona en
producción: eliminar funciones muertas, corregir callejones sin salida en los flujos
de ejecución, simplificar los workflows hasta que sean completamente claros y
trazables, e implementar mejoras sustanciales de experiencia del usuario final.

## 2. Reglas inviolables (heredadas del proyecto, no se negocian)

1. **Casilla vacía antes que dato inventado.** Sin evidencia real → se deja vacío.
2. **La casilla del médico es sagrada.** Nada sobrescribe lo que el médico escribió.
3. **El médico manda, el script sugiere.** Cero acciones sin clic explícito (salvo
   las excepciones documentadas caso por caso).
4. **Cero PHI.** Nunca nombres, cédulas ni datos reales de paciente en código,
   tests, comentarios, commits ni informes.
5. **CSS:** ninguna regla de color nueva en un contenedor pegado a `document.body`
   sin `!important`; el patrón de blindaje es `:where(...:not([class]))` (especificidad
   cero); verificación en Chromium contra un CSS «Everest» simulado agresivo antes de
   dar por buena una regla.
6. **Cada cambio de comportamiento exige mutación verificada** (romper → prueba roja
   específica → restaurar → verde → fila en `tests/INFORME_MUTACIONES.md`) y el banco
   `node tests/runner.js` completo en verde (EXIT=0).
7. **Nunca tocar:** el checkout principal con WIP ajeno, los archivos `_*.txt`/
   `_pw_profile*/` del árbol principal, ni el `.har` con credenciales reales.

## 3. Mesa de expertos — roles

| Rol | Misión específica |
|---|---|
| **Arqueóloga del código muerto** | Caza de funciones/variables/constantes definidas y nunca usadas (o solo usadas por otro código muerto), bloques CSS huérfanos, ramas `if` imposibles, parámetros fantasma. Evidencia: cierre transitivo de referencias, no intuición. |
| **Cartógrafa de flujos** | Traza los flujos de ejecución principales (arranque, tick, dock, HC, ordenamientos, aviso universal, agendar, labs, telemetría, teardown) y detecta callejones sin salida: caminos que no llegan a ninguna acción útil, estados inalcanzables, guardas redundantes en cascada, awaits cuyo resultado se ignora. |
| **Simplificadora de workflows** | Reduce la complejidad ciclomática y la profundidad de anidamiento donde se pueda sin cambiar comportamiento: extrae helpers puros, aplana condicionales, unifica duplicados idénticos. Solo simplificaciones verificables por el banco. |
| **Experta en UX clínica** | Evalúa la experiencia del médico en consulta: tiempos de respuesta percibidos, cantidad de clics, claridad de rótulos y toasts, accesibilidad (tamaños táctiles ≥ 28 px, aria-labels, foco), y propone mejoras de UX de bajo riesgo. |
| **Directora de pruebas** | Define para cada hallazgo cómo quedaría PROBADO (suite y caso concreto), ejecuta el banco completo antes y después, y registra cada mutación en INFORME_MUTACIONES. |

## 4. Pasos estructurados de trabajo

1. **Inventario** (todos los roles, solo lectura): leer el código y los tests
   existentes; producir el catálogo de hallazgos con ubicación exacta
   (función/línea), clasificación (muerta / callejón / simplificable / UX) y
   evidencia (quién la llama, qué prueba la cubre).
2. **Consenso**: cruzar hallazgos para eliminar falsos positivos (una «muerta» que
   solo se usa en producción vía handlers delegados NO es muerta) y priorizar por
   (impacto en seguridad/PHI, riesgo de regresión, beneficio UX, costo).
3. **Triaje**: tres cestos — (A) aplicar ya, (B) aplicar con mutación y prueba
   específica, (C) documentar y NO tocar (riesgo > beneficio; se explica por qué).
4. **Ejecución centralizada**: UNA sola mano edita el userscript (el coordinador);
   los expertos no escriben código directamente, entregan parches revisados.
5. **Verificación**: banco completo EXIT=0 antes y después; cada cambio de
   comportamiento con mutación verificada; CSS nuevo verificado en Chromium contra
   Everest simulado agresivo; suites de anclas literales (Regla S, F1) al día.
6. **Entrega**: informe final con TODAS las modificaciones, su justificación y los
   beneficios (UX y mantenibilidad), más los hallazgos del cesto C documentados.

## 5. Criterios de calidad obligatorios

- **Cero regresiones**: banco completo verde antes y después; ninguna función
  pública que desaparece sin que la «Directora de pruebas» lo registre.
- **Evidencia sobre opinión**: cada «muerta» con su cierre transitivo de
  referencias; cada «callejón» con su traza de entrada; cada UX con su beneficio
  medible (clics evitados, segundos ahorrados, tamaño táctil ganado).
- **Trazabilidad**: cada cambio con su fila en `tests/INFORME_MUTACIONES.md`
  (si cambia comportamiento) y su entrada en el informe final.
- **Lenguaje**: español con tildes; identificadores y literales de código intactos.
- **Cero PHI** en cualquier documento generado.

## 6. Entregables concretos

1. `docs/INFORME_MESA_EXPERTOS_20260908.md` — informe final: tabla de hallazgos
   (ubicación, tipo, decisión A/B/C, acción tomada), lista de modificaciones con
   justificación, beneficios obtenidos (UX y mantenibilidad), hallazgos del cesto C
   con su motivo, y resumen de pruebas (banco, mutaciones, navegadores).
2. Código aplicado en `vigilante_agenda.user.js` con bump de `@version`/`VERSION`
   y las 4 sincronizaciones de versión de siempre.
3. `tests/INFORME_MUTACIONES.md` actualizado por cada cambio de comportamiento.
4. Gist `d231aab6f54de51a5c472b392aac1b91` actualizado y verificado byte a byte
   (mandato del médico: nunca dejar trabajo solo local).

## 7. Cómo se ejecuta (esta sesión)

Los roles corren como agentes de auditoría SOLO LECTURA en paralelo sobre el
worktree; sus hallazgos los aplica el coordinador (una sola mano edita), que corre
el banco, las mutaciones y publica. Nada de lo que diga un resumen de agente se
toma por cierto sin verificar contra el fuente real.
