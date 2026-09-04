# COLA_FUTURO — Hallazgos confirmados que esperan decisión del médico

Fecha: 2026-09-04 · Regla de la casa: la clínica se reporta con OPCIONES, nunca se
decide por el médico. Ninguno de estos hallazgos es S0/S1: el userscript v18.0.137
NO se tocó en esta auditoría. Cada entrada indica qué haría cada opción y su riesgo.

---

## Hallazgo A — El apagado de emergencia no cancela la última escritura al disco

**Qué pasa hoy (evidencia en `P5_REFUTACION.md` a):** si usted (o soporte) dispara el
apagado remoto de emergencia mientras hay una escritura espejo en espera, esa
escritura puede salir hasta 4 segundos DESPUÉS del apagado, una sola vez, a la
carpeta local de su computador. No va a internet, no toca la historia clínica de
Everest; es el mismo espejo que el asistente ya estaba autorizado a guardar.

**Por qué importa:** el apagado de emergencia promete «el asistente dejó de vigilar
y de tocar nada». Una escritura póstuma, aunque sea local y única, rompe esa promesa
al margen.

**Opciones:**
- **A. Arreglarlo (recomendado técnicamente):** en el apagado, recorrer el Map de
  debounces y cancelarlos (unas 3 líneas dentro de `emergencyTeardown`, sin
  funciones nuevas). Riesgo: casi nulo; cambio puramente aditivo y testeable.
- **B. Dejarlo y documentarlo:** aceptar que el apagado corta la vigilancia y la red,
  pero el espejo local puede terminar una escritura en curso. Riesgo: semántico,
  no clínico.
- **C. Arreglarlo junto con el hallazgo B en una sola versión:** menos versiones
  publicadas, un solo ciclo de verificación.
- **D. Pedir más evidencia:** reproducirlo en un entorno de prueba antes de decidir.

---

## Hallazgo B — La recuperación de memoria confía a ciegas en el archivo del disco

**Qué pasa hoy (evidencia en `P5_REFUTACION.md` b):** al arrancar, el asistente lee
`vgl_cosecha.json` de la carpeta local y lo fusiona con la memoria del navegador.
Ese archivo entra SIN tope de registros (el límite de 80 pacientes solo existe en la
exportación, no en la recuperación) y la fusión la gana quien tenga la fecha más
reciente — así esa fecha haya sido editada a mano o corrompida.

**Por qué importa:** alguien con acceso a la carpeta (o un archivo dañado) podría
(a) inflar la memoria hasta reventar el almacenamiento del navegador — justo la
avería que este sistema existe para resistir — o (b) hacer que un registro viejo o
falso derrotemos siempre a la memoria buena, y esa fusión queda persistida.

**Opciones:**
- **A. Aplicar el mismo tope de 80 en la recuperación** y rechazar registros con
  fecha futura (tolerancia pequeña): cierre directo del hueco, ~5-8 líneas, sin
  funciones nuevas. Riesgo: si un día usted mismo edita el archivo a mano para
  recuperar algo, esa edición con fecha adelantada dejaría de ganar.
- **B. Solo el tope, sin tocar las fechas:** cierra el riesgo de cuota, deja la
  fusión por fecha tal cual. Riesgo: la vía de «fecha forjada» queda abierta.
- **C. Dejarlo y documentarlo:** el riesgo exige acceso local al computador del
  consultorio; si ese acceso ya está comprometido, el archivo es lo menos crítico.
- **D. Pedir más evidencia:** probar en un entorno de prueba con un archivo
  manipulado antes de decidir.

---

## Hallazgo D (nota de estilo) — `innerHTML +=` en el aviso de datos incompletos

**Qué pasa hoy (evidencia en `P4_PHI_SEGURIDAD.md` §3):** el aviso «falta documentar
X» del banner de sugerencias se agrega re-parseando el HTML del banner completo
(L28285). El contenido está escapado; no hay riesgo. Es un costo minúsculo y un
patrón que el propio proyecto ya corrigió en otro sitio (v18.0.121).

**Opciones:**
- **A. Refactor menor** a plantilla completa o `insertAdjacentHTML` la próxima vez
  que se edite esa zona por cualquier otro motivo (no merece versión sola).
- **B. Dejarlo:** funciona, está escapado y no está en bucle.

---

## Registro de decisiones

| Hallazgo | Decisión del médico | Fecha | Versión donde entra |
|---|---|---|---|
| A (debounce tras kill) | _pendiente_ | — | — |
| B (restauración sin tope) | _pendiente_ | — | — |
| D (innerHTML +=) | _pendiente_ | — | — |

> Cualquier arreglo elegido entra por el circuito normal: prueba roja → parche →
> banco verde → mutación, sin funciones nuevas, sin `!important`, y publicación
> completa (GitHub + Gist) porque SÍ cambiaría el userscript.
