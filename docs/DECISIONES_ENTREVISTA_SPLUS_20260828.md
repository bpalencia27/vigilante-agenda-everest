# Decisiones de la entrevista S+ — noche del 28-ago-2026

Las 26 preguntas del artefacto `mapa-panel-s-plus` (5 ya respondidas el 28-ago de día,
21 respondidas esta noche antes de que el médico durmiera) quedan cerradas aquí. Cada una
es una decisión firme del médico, no una recomendación mía — implementar en consecuencia,
sin volver a preguntar salvo que él la reabra.

## Chips de PyM en la tarjeta de la agenda

1. Reversión consciente de la decisión de agosto — sí, quiere volver a tenerlos.
2. Lista completa, no compacta: **3 actividades visibles por tarjeta**, como antes de T4.
3. Etiquetas **abreviadas** (ej. "VPH", no "Cáncer de cuello uterino — VPH").
4. El chip **reemplaza el banner de la Historia Clínica** (el aviso modal al abrir se
   conserva, conviven los dos).

## Notificaciones

5. **Hallazgo de bug, no solo preferencia**: el toast de confirmación/inasistencia Y el
   aviso de fraude se están **repitiendo** para eventos que ya habían aparecido — sonido
   incluido. Investigar como bug real (reproducir antes de arreglar), no cerrar con una
   preferencia de diseño.
6. Quiere el conjunto de avisos **lo más minimalista posible**.
7. "Silenciar 15 min" debe silenciar **tono + toast + notificación de Windows juntos**,
   no solo el tono como hoy.
8. Repique fuerte / cartel / parpadeo de pestaña: confirmado que nunca los encendió a
   mano — siguen apagados de fábrica sin que haya nada que limpiar ahí.
9. Los dos `alert()`/`confirm()` nativos bloqueantes **no son el problema reportado** —
   dejarlos como están.

## Panel de Ajustes

10. "Refresco": **automático + visible** — sin control manual (nadie lo puede
    desconfigurar), pero el reloj de cabecera debe mostrar qué cadencia de sondeo está
    usando en cada momento (5–30 s según `apiCadencia()`).
11. Retirar YA las cuatro claves muertas: `tolerancia`, `labsVencidos`, `avisoPymModal`,
    `bannerPym`.
12. Sede del laboratorio (378, fija en código): **dejarla fija por ahora**, no hacerla
    editable — no hay planes inmediatos de instalar en otra sede.
13. "Actividades PyM a ocultar" y "Recordatorio de carga PyM" en modo programador: siguen
    en pie exactamente como se decidió el 27-ago.
14. **Aviso de abandono PES — VERIFICADO EN CÓDIGO (28-ago, noche), sigue sin decidir el
    toggle.** El médico tenía razón: mi pregunta original lo describía mal ("paciente que
    sale de la sala de espera sin ser atendido") — no tiene nada que ver con eso. Lo real,
    confirmado leyendo `tieneAbandonoPES` (~línea 24777) y `S.abandonoPES` (~línea 6801):
    "PES" es el **Programa de riesgo cardiovascular**, y esta alarma avisa cuando el
    paciente **abandonó el seguimiento de ese programa** — el dato sale de la columna
    `Abandonados_PES="Si"` del mismo Excel/SharePoint que ya alimenta PyM (`state.pymAbandono`),
    no de nada relacionado con la sala de espera. `S.abandonoPES` nace `true` (encendido) y
    hoy **no tiene ningún interruptor en Ajustes** (confirmado por comentario propio del
    código, ~línea 10863: "sin interruptor en Ajustes").
    Con esto corregido, la pregunta original SÍ sigue siendo válida y queda abierta para
    cuando el médico esté despierto: ¿le damos un interruptor visible en Ajustes (como sus
    hermanos clínicos), o se deja fijo en encendido sin opción, como está hoy?
15. Nombre/identificador del médico: no se agrega control manual de respaldo — se deja
    solo por consola, como hoy.

## Motor farmacológico

16. El interruptor ya estaba encendido y el médico nunca vio el bloque en Panel del
    paciente → Medicamentos — su experiencia de "no funciona" viene del modal de
    Laboratorios (arreglado ayer).
17. Comorbilidades a priorizar para contraindicaciones: las que el script ya lee para RCV
    (EPOC, autoinmunes, ECV, enfermedad renal, embarazo) **más insuficiencia cardiaca
    (NYHA) e insuficiencia hepática** (ninguna de las dos se lee hoy en ningún punto).
18. Retirar la etiqueta **"(en pruebas)"** del interruptor ya — el bloque se pinta de
    verdad en las dos pantallas.
19. **Timing de insulinas y tope de dosis de furosemida en miligramos entran en el
    alcance ahora** (el segundo depende de que Everest exponga un dato que hoy no se
    puede leer — puede quedar bloqueado por eso, no por falta de decisión).

## Sincronización con la historia clínica y otros módulos

20. Correr el diagnóstico de "carga" de v17.12.0 en consulta real pronto, para confirmar
    empíricamente que sí captura las secciones al abrir un paciente — no darlo por
    cerrado sin esa evidencia.
21. Alergias, quirúrgicos, traumáticos y transfusiones entran YA al alcance del próximo
    bloque de grounding para la IA, con la misma prioridad que tuvieron los antecedentes
    patológicos — **no fueron excluidos a propósito por PHI, quedaron pendientes**.
22. Extender la reconciliación en vivo de Agendar (hoy limitada a tensión arterial) a
    **comorbilidades y medicamentos**, aceptando la llamada de red adicional que eso
    implica cada vez que se abre el modal.
23. El reloj de frescura de Agendar (10 min, aprobado el 22-ago) pasa a un **reloj más
    corto** — el médico no fijó el número exacto; proponer uno concreto al implementar y
    confirmarlo con él, no adivinarlo en silencio.
24. Los listados de órdenes (además de quirúrgicos/traumáticos/transfusiones) quedaron
    pendientes por omisión, no por exclusión de PHI — agregarlos.

---

**Disciplina de implementación**: cada punto de esta lista es una petición ya decidida,
pero **implementar de a una, con su propia reproducción/medición cuando aplique, prueba
nueva y mutación verificada** — ninguna se hace "de paso" dentro de otra. El punto 14
(PES/SharePoint) queda BLOQUEADO hasta releer el código real; el punto 5 (notificaciones
repetidas) se trata como un bug prioritario, con el mismo rigor que el falso positivo de
fraude de esta misma tarde (v17.17.0).
