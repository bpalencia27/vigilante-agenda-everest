# SUPER PROMPT — Enjambre de auditoría del sistema de notificaciones
## Vigilante de Agenda v18.3.x · «Avisar lo necesario, por el canal justo, una sola vez»

> Documento de encargo. Lo ejecuta un **enjambre de subagentes** coordinado por un
> orquestador (SA-ORQ). **Un perfil por tarea NT-##, una sesión por tarea.**
> Tercer pilar tras `SUPERPROMPT_AUDITORIA_ELITE.md` (estático) y
> `SUPERPROMPT_SIMULACION_FLUJOS.md` (dinámico): este audita **el sistema de avisos
> como producto** — intrusividad, relevancia y oportunidad — y produce un plan de
> modificación concreto.
> Meta declarada por el médico: que las notificaciones **no fatiguen**, se activen
> **solo cuando sea absolutamente necesario** y mejoren la usabilidad global.

---

# 0. REGLAS DEL ENTORNO (heredadas, sin excepción)

- Un solo archivo (`vigilante_agenda.user.js`): sin módulos, bundlers, TypeScript ni
  dependencias nuevas. **PROHIBIDO REFORMATEAR** — el PR se descarta entero.
- Cero PHI (incluye el TEXTO de cualquier aviso, toast y notificación del SO: un
  `GM_notification` con nombre de paciente es PHI en el escritorio). Casilla vacía
  antes que dato inventado. El médico manda.
- Banco: `node tests/runner.js` ≥ baseline de la FASE 0. Todo cambio de comportamiento
  = prueba nueva + mutación transcrita en `tests/INFORME_MUTACIONES.md`.
- Sin peticiones reales a Everest/Athenea; todo con el arnés y sus mocks.
- CSS/aspecto computado se verifica con Playwright + `getComputedStyle` sobre el
  HTML+CSS real del arnés — nunca con `innerHTML.includes(...)`.
- `t.caso` nuevo como HERMANO del anterior; `t.casoAsync` siempre con `await`.
- Rama: la que congele la FASE 0 sobre la punta vigente; rebase + banco post-rebase
  antes de cada PR.

---

# 1. AXIOMAS DEL ENCARGO — lo que el enjambre NO puede recomendar

Estas decisiones ya las tomó el médico y están pagadas con incidentes reales. El
enjambre puede medir su coste y proponer alternativas **a la cola del médico**, pero
NUNCA recomendarlas como modificación directa:

1. **La jerarquía de intrusión de 3 niveles (D5) no se degrada:** nivel 3 (modal
   interruptivo con sonido) queda reservado a **Abandono Programa RCV y fraude**, que
   el médico pidió priorizar «sobre cualquier otra cosa». Reducir fatiga debe salir de
   los niveles 1-2 y de los topes, no de silenciar la seguridad clínica.
2. **El ROJO es edge-triggered:** una sola alerta sonora por cita (`alertedFraud`).
   Un aviso repetido fue un bug real; no se convierte en «refuerzo».
3. **1 aviso = 1 canal** (política del código: `notify`/`showToast`/`_notificarSistema`).
   No se duplica un mismo evento en dos canales para «asegurar».
4. **Asimetría de errores (D4):** un aviso de más es una molestia; un aviso de menos
   es una actividad de prevención perdida o un fraude sin detectar. Los costes NO son
   simétricos y toda métrica de «fatiga» se pondera con esto.
5. **El color nunca es el único portador** de un estado clínico (texto/icono siempre;
   hay daltonismo y monitores pésimos). Contraste mínimo AA en texto, **AAA (7:1)** en
   lo que codifique estado clínico. Mínimo 12px de letra. `prefers-reduced-motion`
   obligatorio en todo bloque nuevo.
6. **Modo `perf` y modo oculto apagan lo no esencial** — cualquier aviso nuevo hereda
   esa disciplina.

---

# 2. INVENTARIO OBLIGATORIO ANTES DE OPINAR (FASE 0-1)

Nadie audita de memoria. La tarea **NT-01** produce el **catálogo de puntos de aviso**
en `AUDITORIA/REGISTRO_NOTIFICACIONES.md`, generado con grep + lectura, con una fila
por punto:

```
| ID | Punto (función:línea) | Evento que lo dispara | Canal(es) | ¿Edge o nivel? | ¿Tope de frecuencia? | ¿Silenciable? (muteFor/oculto/perf) | Texto: ¿lleva PHI posible? |
```

Semillas de grep (verificar contra el árbol vigente; los nombres provienen del
inventario de cobertura del banco): `notify(` · `showToast(` · `bigAlert(` ·
`osNotify` · `_gmNotify` · `beep(` · `playTone` · `startNag` · `stopNag` ·
`setFavicon` · `startFlash` · `avisoUniversal` · `checkAvisoUniversal` ·
`avisoPacEval` · `_agruparToasts` · `_encolarAvisoPendiente` · `_flushAvisosPendientes`
· `_dispararAvisoAudible/Cartel/Real` · banner PyM · `vglDiscoBannerPintar` ·
`_mostrarAvisoPausaClinica` · `pymAlert` · `abandonoPESAlert` · `spToast`.

Cada fila se completa con el **coste de canal** (§3.1). El catálogo es el universo
auditable: una notificación no catalogada es hallazgo en sí misma.

---

# 3. CRITERIOS UNIFICADOS — la misma regla para todos los perfiles

Todo subagente puntúa cada fila del catálogo con la MISMA rúbrica (0-3). Sin esta
sección común, los hallazgos no son consolidables.

### 3.1 Coste de canal (intrusividad base, no negociable por opinión)

| Nivel | Canal | Coste |
|---|---|---|
| C0 | Punto de color / badge en dock / favicon | 0 |
| C1 | Toast agrupado (vía `_agruparToasts`) | 1 |
| C2 | Banner persistente que reserva su franja | 2 |
| C3 | Notificación del SO (`GM_notification`, aparece FUERA de la pestaña) | 3 |
| C4 | Modal interruptivo | 4 |
| C5 | Modal interruptivo **con sonido** | 5 |

**Intrusividad (I)** = coste de canal × repetición real por jornada (deduplicada).
Se mide contando disparos reales en el arnés y/o desde telemetría `uxTrack` si existe
la clave; si no hay dato, «pendiente de medir» — nunca se estima de memoria.

### 3.2 Rúbrica 0-3 por criterio

- **Relevancia (R):** ¿cambia lo que el médico hace en los próximos minutos? 3 = acción
  clínica inmediata (fraude, abandono RCV) · 2 = prevención con ventana (PyM pendiente)
  · 1 = informativo útil · 0 = no cambia nada.
- **Oportunidad (O):** ¿llega cuando es accionable? 3 = en el momento exacto ·
  2 = pronto pero accionable · 1 = llega tarde o temprano sin daño · 0 = llega cuando
  ya no sirve o interrumpe un acto clínico (escritura en la HC).
- **Carga (C):** frecuencia neta percibida por jornada completa (20+ pacientes),
  contando agrupación. 0 = ≤ 5/jornada · 1 = 6-15 · 2 = 16-40 · 3 = > 40 o
  repeticiones del mismo evento.

### 3.3 Veredicto por notificación

`I` (canal×repetición) se lee contra `R`: **regla de oro — el canal no puede costar
más que la relevancia.** Un C5 solo se justifica con R=3. Cualquier notificación con
R=0, con repetición del mismo evento (no edge-triggered), o con C=3, entra al informe
como candidata a modificación. El dictamen final por fila lo firma SA-ORQ tras la
consolidación (§5), no el perfil que la encontró.

---

# 4. EL ENJAMBRE — perfiles, pautas y entregables

Cada perfil audita **el catálogo completo** desde SU ángulo y entrega su tabla de
hallazgos con la rúbrica §3 + sus recomendaciones específicas. Prohibido a todos:
proponer cambios de código (eso va al informe, §6); tocar invariantes (§1); inventar
frecuencias («creo que suena mucho» no es dato: se cuenta o se marca pendiente).

### 4.1 SA-NOTIF — Experto en sistemas de notificaciones
**Pautas:** edge vs level triggering · ventanas de deduplicación · colas
(`_encolarAvisoPendiente`/`_flushAvisosPendientes`: ¿se pierden o duplican avisos
acumulados al reabrir?) · agrupación (`_agruparToasts`: qué agrupa y qué no) ·
rate-limiting existente (precedente: aviso de paciente nuevo = 1 por cita, **máx 3/hora**;
¿qué OTROS puntos carecen de tope?) · cross-tab (`crossTabDup`, relevo de pestañas:
¿dos pestañas avisan el mismo evento?) · canales del SO vs pestaña · estado
(`avisoYaVisto`/`avisoMarcarVisto`, `_avisoUnaVezPorNavegador`).
**Entregable:** matriz técnica evento×canal×tope, con los puntos SIN tope y los
duplicables entre pestañas.

### 4.2 SA-CUMPL — Auditor de cumplimiento normativo
**Pautas:** PHI en el texto de toasts/avisos/notificaciones del SO (un aviso que diga
el nombre del paciente en pantalla compartida es tratamiento de dato sensible; función
`_vglSinCedulas` como defensa existente — ¿la cubre TODO?) · minimización y
seudonimización (precedente AE-009) · consentimiento/avisos (TERMINOS_Y_AVISO_DE_PRIVACIDAD)
· retención (memoria de avisos por días: `avisoPacHistPodar`) · fuentes normativas
SIEMPRE citadas; lo no citable queda «pendiente de fuente» (regla AE-014).
**Entregable:** dictamen por punto: cumple / no cumple / pendiente de fuente.

### 4.3 SA-USR — Usuario promedio simulado
**Pautas:** jornada simulada de 20+ pacientes con el arnés (capa dinámica del
`SUPERPROMPT_SIMULACION_FLUJOS.md`): cuenta CADA aviso recibido, el momento y si
pudo/distinguió/molestó. Mide: avisos por hora, tiempo hasta descartar, avisos
ignorados sin leer, interrupciones durante escritura en la HC. Fatiga = dato contado,
no impresión.
**Entregable:** bitácora de jornada con conteos y los 5 momentos de mayor fricción.

### 4.4 SA-MED — Profesional del sector (médico de la IPS)
**Pautas:** ¿QUÉ aviso salvaría un evento clínico y cuál es ruido? Prioridad explícita
del médico propietario: Abandono RCV y fraude por encima de todo; PyM con ventana
clínica; lo administrativo al final. ¿Algún aviso llega durante un acto que no debe
interrumpirse? ¿Algún silencio esconde un evento que él esperaba oír?
**Entregable:** ranking de necesidad por evento (0 = podría desaparecer sin pérdida
clínica) y veto clínico a cualquier propuesta que degrade un canal R=3.

### 4.5 SA-DEV — Desarrollador del software
**Pautas:** cableado real de cada disparador (condiciones, timers, listeners; ¿qué
pasa en teardown/killswitch y modo oculto?) · carreras (mock de red lenta: ¿se emite
dos veces el mismo aviso? ¿se emite tras el apagado? precedente AE-017-A para el
disco) · `catch` mudos que tragan un aviso · dependencia del estado de pestaña
(visibilidad, relevo) · coste de rendimiento del repaint de avisos (presupuesto D7).
**Entregable:** por punto: condición exacta de disparo, riesgos de carrera/fuga, y
coste estimado de implementar cada tope propuesto.

### 4.6 SA-UX — Especialista en experiencia de usuario
**Pautas:** ciencia de la interrupción aplicada: escalamiento (C0→C1→C2 solo si el
evento sigue vivo y sin atender), agrupación, mensajería (un aviso = una acción
posible, verbo claro), persistencia correcta (el banner PyM no se cierra mientras la
condición viva — D5), aprendizaje (¿el médico puede predecir CUÁNDO sonará? lo
impredecible es lo que fatiga) · telemetría existente (`uxTrack`: qué claves habría
que añadir para MEDIR la mejora, sin PHI).
**Entregable:** reglas de escalamiento y mensajería por evento + claves de telemetría
propuestas.

### 4.7 SA-UI — Diseñador de interfaces
**Pautas:** jerarquía visual de los niveles D5 (¿un C1 se ve como C1?) · política de
capas z-index por tokens (`--z-*`, sin número suelto) · contraste AA/AAA verificado
con pares reales · color nunca único portador · 12px mínimo · `prefers-reduced-motion`
· densidad (herramienta de trabajo, no landing) · coherencia con los tokens del
sistema v14 y las 6 listas de contenedores raíz (todo elemento colgado de `body` entra
en TODAS — bug histórico de tokens que no llegaban).
**Entregable:** dictamen visual por canal con pares de contraste medidos.

### 4.8 SA-ACC — Especialista en accesibilidad
**Pautas:** daltonismo (¿cada estado se distingue sin color?) · sonido como canal
(¿todo lo crítico tiene reflejo visual y viceversa? — el ROJO suena UNA vez: ¿la marca
visual persiste?) · foco/teclado en modales (`_activarAccesibilidadModal`, Esc) ·
`prefers-reduced-motion` · tamaño legible en monitores de consultorio.
**Entregable:** matriz de redundancia sensorial por evento crítico.

### 4.9 SA-ORQ — Orquestador del enjambre
**Pautas:** reparte tareas NT, veda solapamientos de zona, custodia el registro
(`AUDITORIA/REGISTRO_NOTIFICACIONES.md`, solo append, filas `NT-###` de hallazgo con
formato `| ID | Perfil | Punto | Criterio afectado | Hallazgo | Evidencia | Severidad |`),
consolida (§5) y redacta el informe final (§6). No opina técnicamente: arbitra.

---

# 5. CONSOLIDACIÓN Y RESOLUCIÓN DE DISCREPANCIAS (tarea NT-20, solo SA-ORQ)

1. **Matriz de hallazgos compartidos:** un mismo punto auditado por varios perfiles se
   fusiona en UNA fila con la lista de perfiles que lo reportaron (hallazgo
   multi-perfil = prioridad alta de entrada).
2. **Resolución de discrepancias por jerarquía fija** (nunca por mayoría ni por gusto):
   **seguridad clínica → voluntad del médico (axiomas §1) → normativa → consistencia
   de estado → UX → UI/estética.** Ejemplo típico: SA-USR pide silenciar el modal RCV
   (fatiga) vs SA-MED lo veta (R=3): gana SA-MED, y la fatiga se ataca por el tope de
   REPETICIÓN o el canal de los eventos vecinos, no degradando el suyo.
3. **Cada discrepancia queda documentada** con las dos posiciones, el árbitro y el
   motivo. Sin borrones: el registro muestra el desacuerdo y su resolución.
4. Lo no medible se marca «pendiente de medir» con la telemetría o simulación que lo
   cerraría — nunca se resuelve por intuición.

---

# 6. INFORME FINAL Y MODIFICACIONES CONCRETAS (tareas NT-30+)

`AUDITORIA/INFORME_NOTIFICACIONES.md` debe contener, por este orden:

1. **Catálogo completo** (§2) con la rúbrica final consolidada por punto.
2. **Modificaciones propuestas, cada una con:** punto (función:línea) · problema (con
   evidencia del registro) · cambio exacto · impacto en I/R/C esperado (declarado como
   hipótesis medible, no promesa) · coste/riesgo.
   Las propuestas se agrupan en los TRES ejes pedidos:
   - **Reglas de activación:** edge-trigger obligatorio por evento único; condición
     viva como requisito de persistencia; escalado C0→C2 solo si el evento sigue sin
     atender; supresión durante escritura en la HC donde sea técnicamente seguro.
   - **Canales de entrega:** matriz evento→canal justificada por R (regla de oro §3.3);
     todo R≤1 baja de C≥2 a C0/C1; el SO (`osNotify`) solo para lo que ocurre con la
     pestaña en segundo plano y SIN PHI en el texto.
   - **Frecuencia máxima por usuario:** topes por evento y por jornada, tope global
     (precedente interno: 3/hora del aviso de paciente nuevo como patrón a extender),
     ventanas de silencio administrables y su interacción con muteFor/oculto/perf —
     **sin tocar los axiomas §1**.
3. **Plan de implementación:** una tarea = un PR = diff mínimo + prueba nueva nacida
   del caso que lo cazó + mutación transcrita + banco ≥ baseline. Orden S0→S1→S2.
4. **Cola del médico:** toda propuesta que toque un axioma §1 o cambie qué ve el
   médico, con opciones y riesgo — nunca decidida por el enjambre.

---

# 7. VALIDACIÓN FINAL (tarea NT-90)

1. Cada modificación aplicada se valida en TRES frentes, como exige el encargo:
   - **UX:** re-simulación de la jornada de SA-USR con los cambios: conteos de
     avisos/hora ANTES vs DESPUÉS (número a número); contrastes y redundancia
     sensorial re-verificados con Playwright.
   - **Normativa:** re-dictamen de SA-CUMPL sobre los textos/canales modificados
     (cero PHI, fuentes citadas o «pendiente de fuente»).
   - **Funcional:** banco completo ≥ baseline; invariantes §1 re-verificadas línea a
     línea (método AE-018); R0 y los recorridos de suite_73 siguen verdes; el apagado
     de emergencia y el modo perf/oculto siguen apagando lo nuevo.
2. Certificación: **«fatiga reducida sin pérdida clínica»** solo si: avisos/jornada
   baja medible, NINGÚN evento R=3 perdió canal o repetición mínima, y el banco está
   verde. Si algo quedó sin medir, se certifica condicionada declarándolo.
3. La palabra final es del médico, siempre.

---

# 8. PROTOCOLO ANTE LA DUDA

1. ¿No hay dato de frecuencia real? Se mide (simulación o telemetría nueva); no se
   estima. 2. ¿Dos perfiles se contradicen? §5.2, por jerarquía, documentado.
3. ¿La propuesta toca un axioma? A la cola del médico, con opciones.
4. ¿El fix debilitaría una prueba para entrar? No se debilita: se corrige el código o
   se documenta el bloqueo. 5. ¿Hallazgo que repite un AE-###? Se referencia, no se
   re-describe.
