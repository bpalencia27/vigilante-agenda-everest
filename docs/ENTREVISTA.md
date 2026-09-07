# ENTREVISTA (GRILL-ME) — Tanda 1 · P13 Fase 5

**Fecha:** 2026-09-05 · **Para:** dueño + sus dos compañeros (3 médicos generales)
**Cómo se responde:** "1B, 2A, 3D…" — una letra por pregunta. Sin justificar,
sin abrir debate: la discusión viene después, con la regla escrita.
**Regla:** cada respuesta se convierte en una REGLA VERIFICABLE, no en una nota.

Cifras citadas: prompt 07 (medición del dueño 22-ago→4-sep-2026, hoja uso_detalle).

---

**1. ¿En qué momento exacto de la consulta MOLESTA un aviso y en cuál se agradece?**
(dato: 4.020 interrupciones en 14 días, 88,6 % cerradas, 2 con acción)

A) Molesta siempre: prefiero buscar la información yo cuando la necesite.
B) Molesta al abrir la historia (aún no sé de qué viene el paciente); se agradece al CERRAR la consulta, antes de despacharlo.
C) Molesta mientras escribo la nota; se agradece al abrir, para planear la consulta.
D) Depende del tipo de aviso, no del momento.

**Recomendada: B.** La regla que genera es verificable: agrupar los pendientes
del paciente y entregarlos en el momento de cierre (4.5 del prompt) — y el
desenlace `obs.aviso.desenlace` medirá si la tasa de acción sube del 0,09 %.

---

**2. ¿Cuál de los cinco módulos les ahorraría más tiempo si funcionara perfecto?**
(dato de finalización: Laboratorios 91,1 % · Redacción IA 90,1 % · Agendar 84,5 % · Panel 59,0 % · Ordenar 40,1 %)

A) Ordenar (el peor embudo: 88 abandonos de 142 aperturas).
B) Redacción IA (cuando responde, el texto sirve tal cual el 94,5 % de las veces — pero hoy falla el 43,3 %).
C) Panel paciente.
D) Laboratorios.

**Recomendada: B.** No por el embudo sino por la palanca: el 89,5 % de las
aperturas llega "sin configurar" y el 85 % de las respuestas tarda >5 s. Arreglar
puesta en marcha + latencia convierte un módulo ya casi terminado (90,1 %) en
ahorro diario inmediato; Ordenar exige además rediseño. Regla: onboarding cero
del redactor antes que cualquier cambio visual.

---

**3. ¿Qué hacen hoy a mano, repetido, que el script podría dejar listo?**

A) Copiar resultados de laboratorios a la nota.
B) Buscar el próximo control / cita del paciente en la agenda.
C) Diligenciar campos repetitivos de la orden (fórmulas, dosis, frecuencia).
D) Nada: lo repetitivo ya está cubierto.

**Recomendada: C.** Es la única opción donde el script ya conoce el contexto
(PyM pendientes + fórmulas del catálogo) y el médico conserva el criterio
(lo clínico lo decide el médico). Regla verificable: propuesta de prellenado
revisable (palanca 4 de la Fase 6) con `obs.modulo.ordenar` midiendo `resultado:"ok"`
sin edición posterior.

---

**4. Ordenar se abandona el 60 % de las veces (142 abre → 57 termina). ¿En qué punto se rinden?**

A) Al abrir: no encuentro lo que busco en el catálogo.
B) A mitad: el formulario pide datos que no tengo a la mano en ese momento.
C) Al final: dudé de una fórmula/código y preferí hacerlo directo en Everest.
D) Lo abro por error o para consultar, sin intención de ordenar.

**Recomendada: B.** Los 27 abandonos de Agendar (84,5 %) frente a los 88 de
Ordenar sugieren que no es el modal sino el CAMINO: Agendar pide poco y Ordenar
pide mucho. Regla: `obs.modulo.ordenar` con `codigo` de punto de salida hará
visible la respuesta real en 14 días — esta pregunta fija la hipótesis, no la
verdad.

---

**5. Panel paciente se cierra a medias (373 abre → 220 termina, 59 %). ¿Por qué?**

A) Lo abro solo para VER un dato y ya (no es abandono).
B) Es lento en abrir y cierro por impaciencia (dato: INP "poor" 77.772 en 14 días).
C) Muestra información que no me cambia la decisión.
D) No sabía que podía hacer más cosas desde ahí.

**Recomendada: A.** Si es cierto, la métrica "finalización" del panel está mal
definida y hay que medir intención, no finalización — cambia la métrica, no el
panel. Regla: separar `obs.modulo.panel` con `resultado:"ok"` (visto y usado)
de `cancelado` (abierto sin tocar).

---

**6. El botón "no más" se usó 30 veces en 14 días (0,8 % de 3.658 apariciones). ¿Qué falla?**

A) No lo encuentro / no sabía que existía.
B) Lo veo pero no confío: miedo a perder un aviso que SÍ importaba.
C) Preferiría silenciar POR TIPO de aviso, no todo o nada.
D) Nunca quise silenciar nada.

**Recomendada: C (con B de fondo).** Regla: silencio visible, reversible y con
memoria por tipo (4.6) — el presupuesto de interrupciones ya en código (tope 6
por equipo/día, `S.obsPresupuestoAvisos`) reduce el coste de equivocarse, lo
que ataca directamente la desconfianza de B.

---

**7. ¿Cuántas interrupciones por consulta les parece tolerable como TOPE?**
(hoy ≈72 por equipo/día; el código ya trae tope 6/día para el aviso universal)

A) 1 por consulta, solo nivel 1 (daño al paciente si no actúo).
B) 2-3 por consulta y punto; lo demás vive en el panel sin interrumpir.
C) Ninguna: todo pasivo, yo pregunto.
D) Las que haga falta: prefiero exceso de información.

**Recomendada: B.** Regla ya verificable en código: presupuesto por equipo y
día (`obsPresupuestoConsumir`) con `aviso.presupuesto.agotado` midiendo cuántas
veces se calló — si el tope resulta bajo, se sube `S.obsPresupuestoAvisos` sin
tocar nada más. C es el ideal de la Fase 4 pero exige inventario previo (4.1).

---

## Registro de respuestas

| Tanda | Fecha | Respondió | Respuestas | Reglas derivadas |
|---|---|---|---|---|
| 1 | — | — | — | — |

*(Se responde "1B, 2A…". Cada letra se convierte en fila de regla; nada se
ejecuta sin decisión del médico dueño — R5.)*

## Preguntas ya respondidas

Ninguna todavía — esta es la primera tanda. Antes de la tanda 2, revisar esta
tabla para no repetir.
