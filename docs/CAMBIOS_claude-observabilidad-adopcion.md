# Cambios — claude/observabilidad-adopcion (P13: instrumentación de uso y adopción)

Base: `claude/compuerta-consentimiento` 595534b.
Sin bump de versión (lo hace S6 al publicar).

## Qué cambia para el médico

Nada visible en consulta. Este PR añade una capa de observabilidad que
responde, con datos propios y sin PHI, las preguntas de adopción del prompt 07:
quién usa qué módulo, en qué punto del embudo se rinde cada uno y qué pasa
con los avisos después de mostrarse.

1. **Identidad de equipo estable** — `obsIdentidadEquipo` asigna un `eq-<hash>`
   persistente (prioridad: manual → GM → legado `vgl_equipo_id` → huella de
   pantalla/idioma/hilos/zona → nuevo + `obs.equipo.nuevo` diferido). El médico
   queda como `m-<hash>` (FNV-1a del identificador de constancia), nunca en
   claro.
2. **Sesgo de consulta** — `obsConsultaAbrir/Cerrar/Elegible` marcan apertura
   (hash de cédula+hora, dedup 5 min), cierre con motivo y qué módulos fueron
   elegibles/ejecutados por consulta: es el denominador que faltaba para
   medir embudes por consulta real.
3. **Desenlace de avisos** — cada aviso del panel registra `obs.aviso.mostrado`
   (fase inicio) y `obs.aviso.desenlace` (accion/cerrado/ignorado/expirado/
   silenciado/posterior, con ms). «posterior» (hizo lo sugerido después) es la
   métrica de oro de utilidad, hoy invisible.
4. **Presupuesto de interrupciones** — tope configurable de 6 avisos por
   consulta (`S.obsPresupuestoAvisos`, 0 = sin tope, fall-open). El sistema
   de avisos consulta `obsPresupuestoConsumir` antes de mostrarse.
5. **Cero PHI por construcción** — `obsSerializar` solo emite una lista blanca
   {medico, consulta, fase, resultado, codigo, ms, n, ctx}; ctx admite valores
   `[A-Za-z0-9._:-]` ≤24 sin espacios, o solo-números ≤4 caracteres; cualquier
   valor que no pase el filtro se descarta. Contador `obs_perdidos` en la fila
   de entorno diaria para dimensionar la pérdida.
6. **Avisos no intrusivos de telemetría** — el aviso de equipo nuevo se emite
   diferido 1 tick y SIN uxTrack (Fix 3): no cuenta como interrupción del
   médico. `obsCatch` convierte errores del módulo en `obs.catch.<codigo>`
   sin romper la consulta.
7. **Fix de reentrancia en `reportar`** (Fix 1) — la fila se construye una sola
   vez (`Object.assign`) y se empuja al final: evita que un `reportar` anidado
   durante `repQSave()` duplique o pierda filas.

## Cifras que motivan el PR (prompt 07, medición del dueño 22-ago→4-sep-2026, hoja uso_detalle)

Embudes: Laboratorios 79→72 (91,1%), Redacción IA 182→164 (90,1%), Agendar
194→164 (84,5%), Panel 373→220 (59,0%), Ordenar 142→57 (40,1% con 88
abandonos). Aviso universal: 2.202 mostrados, 1.950 entendidos (88,6%), 2 con
acción (0,09%). ≈4.020 interrupciones en 14 días. Ninguna de estas cifras
permite saber el desenlace por equipo: para eso se añade esta instrumentación.

## Archivos

- `vigilante_agenda.user.js` — módulo obs* (constantes, identidad, consulta,
  avisos, serializador, presupuesto, perdidos) + 4 integraciones:
  `autoFetchAtheneaLabs` (apertura de consulta), fila de entorno diaria
  (`obs_perdidos`), aviso del panel (mostrado/desenlace accion) y envío de red
  (`equipo: _equipoId()` delega en obsIdentidadEquipo).
- `tests/suite_83_observabilidad.js` — NUEVA: 12 casos (P13·0…P13·8), incluido
  el canario de fuga de PHI.
- Ajustes de suites existentes al patrón B6 (contar solo SU evento) y a los
  Fixes 1-3: suites 11, 17, 75, 78, 80.
- `docs/INSTRUMENTACION.md` — NUEVO: esquema de eventos, preguntas de negocio
  que responde cada uno, integraciones y límites.
- `docs/ENTREVISTA.md` — NUEVO: tanda 1 de 7 preguntas cerradas (A/B/C/D) para
  el dueño, con recomendada y regla verificable derivada de cada respuesta.
- `tests/INFORME_MUTACIONES.md` — 5 mutaciones verificadas (filas al final).

## Fases del prompt 07

- FASE 1 (código): completa en este PR.
- FASE 5 (entrevista): `docs/ENTREVISTA.md` es el entregable; las preguntas
  prioritarias ya están en la tanda 1.
- FASES 2, 3, 4 y 6 (embudes por consulta real, desenlaces de avisos,
  presupuesto activo, iteración): **delegadas** — dependen de ≥14 días de datos
  de producción que solo esta instrumentación puede producir.

## Banco

Ver resultado final en la última línea de `tests/INFORME_MUTACIONES.md` (0 fallan).
