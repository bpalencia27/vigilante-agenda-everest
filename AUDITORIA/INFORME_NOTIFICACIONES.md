# INFORME FINAL — AUDITORÍA DEL SISTEMA DE NOTIFICACIONES (ENJAMBRE NT)
## Vigilante de Agenda v18.3.x · 2026-09-06 · SA-ORQ

> Encargo: auditar el sistema de avisos **como producto** (intrusividad, relevancia,
> oportunidad) y producir un plan de modificación concreto. Meta del médico: que las
> notificaciones **no fatiguen**, se activen **solo cuando sea absolutamente necesario**
> y mejoren la usabilidad global.
> Evidencia completa en `AUDITORIA/REGISTRO_NOTIFICACIONES.md` (catálogo NT-01 + filas
> NT-101…NT-128 + DIS-1…6). Este informe NO modifica código: cada cambio es una tarea
> = un PR del plan §3.

---

## 1. CATÁLOGO CONSOLIDADO CON RÚBRICA FINAL (I/R/C · dictamen SA-ORQ)

I = coste de canal × repetición real (medida de referencia: jornada NT-121 — 55 avisos,
13,3/h, pico 15/h). R/O/C según §3.2. Dictamen: ✅ mantener · ⚠ candidata a modificación · ❌ violación.

| Grupo | Punto(s) | Canal | R | O | C | Dictamen |
|---|---|---|---|---|---|---|
| **Agenda** | B05 ROJO extemporáneo | C5 | 3 | 3 | — | ✅ Axioma §1.1-1.2; edge 1/cita; nag ≤6 min. Intocable |
| | C01a Abandono RCV / prioridadRcv | C4 | 3 | 2 | — | ❌ **NT-101**: el presupuesto 6/día puede silenciarlo (violación práctica de §1.1) |
| | C08 Pausa clínica | C4 | 3 | 3 | — | ❌ **NT-110**: contraste 2,31:1 — el aviso de seguridad es ilegible |
| | D02 Líder ciego | C3 | 3 | 2 | — | ⚠ **NT-111**: 1/día insuficiente; C3 con pestaña visible |
| | B02 MORADO última llamada | C1/C3+tono | 3 | 3 | — | ✅ (deadline al segundo exacto: predecible) |
| | B04 AMBAR inasistencia | C1/C3 persist | 2-3 | 3 | — | ✅ edge terminal 1/cita; persist correcto |
| | B01 VERDE llegada | C1 (C3 si oculto) | 1 | 3 | — | ⚠ **M13**: oculto debería ser C0, no C3 (regla de oro) |
| | B03 MORADO 3+ PyM | solo color | 2 | 2 | — | ❌ **NT-108**: color-only, viola axioma §1.5 |
| **Prevención** | C01b PyM / C01c labs vencidos | C4 | 2 | 2 | — | ✅ (unificación pedida por el médico) con presupuesto corregido por M1 |
| | C02 re-aviso labs tardíos | C4 | 2 | 2 | — | ⚠ **NT-113**: debería ser C1 persistente |
| | C01 solo-adelantables 🎯 | C4 | 1 | 2 | — | ⚠ **NT-112**: nace alto (4 > 1) |
| | C03 Pacientes nuevos | C1 | 2 | 2 | — | ✅ patrón de tope 3/h a extender |
| | C04 Labs encontrados | C1/C3 | 2 | 2 | — | ✅ 1/paciente/día |
| | C06 Pastilla dock Pendientes | C0→C4 | 1 | 3 | — | ✅ reemplaza al banner muerto (C05, NT-114) |
| **Infra** | D03 falta PyM / sesión vencida | C1/C3 | 2 | 2 | — | ⚠ condición NIVEL avisada 1 vez sin marca C0 persistente |
| | D01 arranque · D05 Chrome · D06 deadman | C1/C3 | 1 | 2 | — | ✅ topes 1/día |
| | D04 versión · D15 onboarding · D13/D16/D08 ecos | C1 | 0 | 2 | — | ✅ tolerable (autocierran 9 s); sin acción propuesta — la fatiga real no está aquí |
| | D11 fallos de guardado | C1 | 2 | 2 | — | ⚠ **NT-118**: repite por intento, sin dedup |
| **Acciones** | E01-E11 (~70 confirmaciones) | C1 | 0-1 | 3 | — | ✅ respuesta a acción propia, no interrupción |
| **Frecuencia global** | — | — | — | — | **C=3** | 55/jornada medidos (NT-121): por encima de 40; el 44% autodescartable; 13 interrupciones durante escritura de HC |

**Lectura de la regla de oro (canal ≤ R):** el sistema la cumple en 15 de 19 familias.
Las excepciones consolidadas: presupuesto que silencia R=3 (NT-101), VERDE oculto en C3
(R=1), solo-adelantables en C4 (R=1), re-aviso labs en C4 (R=2).

**Cumplimiento de los axiomas §1:** nivel 3 reservado ✅ (salvo NT-101) · ROJO
edge-triggered ✅ (verificado 1 disparo/cita en arnés) · 1 aviso = 1 canal ✅ (C3=0 en
jornada atendida; salvo NT-105, carrera de escalada) · asimetría D4 respetada en las
propuestas (ningún tope a R≥2) · color único portador ❌ en B03 (NT-108) · perf/oculto
⚠ (NT-103: modo oculto consume presupuesto invisiblemente).

---

## 2. MODIFICACIONES PROPUESTAS (por eje; impacto = HIPÓTESIS MEDIBLE, no promesa)

### EJE A — Reglas de activación

| M# | Punto | Problema (evid.) | Cambio exacto | Impacto I/R/C esperado | Coste/riesgo | Orden |
|---|---|---|---|---|---|---|
| M1 | `avisoUniversal` presupuesto (`obsPresupuestoConsumir:51420`, llamada :15357) | NT-101: puede silenciar abandono RCV R=3 | Consultar el presupuesto SOLO cuando el aviso no lleve `abandono`/`prioridadRcv` (o presupuesto separado R3 sin tope). Confirmar en cola (Q4). | R: garantizado para R=3 · I: sin cambio · C: −2 avisos útiles suprimidos/jornada (los 2 medidos en NT-121 eran R≤2… verificar con `aviso.universal.suprimido {seccion}`) | Bajo (una condición) · riesgo: más modales/jornada → medir con telemetría | **S0** |
| M2 | `avisoUniversal` catch mudo :15445 + marca tras pintar | NT-102: render fallido = aviso perdido + presupuesto consumido; race de 2 pestañas | `appendChild` con verificación; marcar visto y consumir presupuesto SOLO si se pintó; re-chequear `avisoYaVisto(uid)` justo antes de `appendChild`. | Consistencia: 0 avisos «contados y no vistos» | Bajo · prueba nueva con render forzado a fallar (mutación) | **S0** |
| M3 | `osNotify:15714-15731` | NT-104/NT-105: marca visto sin canal confirmado; escalada 1,6 s puede duplicar canal | No marcar visto hasta `onshow` o fallback renderizado; revertir marca si el fallback fue suprimido por el gate HCHealth; en `fb`, cerrar la Notification si `onshow` llega tarde. | 1 aviso = 1 canal restaurado en el 100% de los casos | Medio (timing del SO difícil de probar → mock con onshow retrasado) | **S0** |
| M4 | `muteFor:14769` | NT-109a: silencio no compartido entre pestañas | Sello `vgl_mute_hasta` en localStorage leído por `muted()` (respetando el diseño v17.19.0: calla tono+cartel, no toast/SO). | I: elimina tonos dobles de la pestaña hermana; sin cambio visible para el médico | Bajo | **S1** |
| M5 | tarjeta 3+ PyM (:34785) | NT-108: color-only, viola axioma §1.5 | Badge de texto «3+ PyM» en la tarjeta (icono+texto junto al tinte). Opcional (Q5): edge-aviso C1 propio con tope 3/h (patrón C03). | Accesibilidad: estado distinguible sin color · si se aprueba el aviso: R=2 gana canal | Bajo el badge · Medio el aviso (nueva fuente de fatiga → solo con tope) | **S1** |
| M6 | D02 `osNotify:35439` | NT-111: ceguera media jornada muda | Re-armar el uid por EPISODIO (nuevo aviso si la ceguera reaparece >30 min después del último) + marca C0 persistente en el panel mientras viva la condición. Con pestaña visible → C1 (ver M14). | O: vigilancia siempre garantizada · I: +0-1 aviso/jornada | Bajo | **S1** |
| M7 | `.then` de `tickApi` → `avisoPacEval` | NT-119: avisos y toasts póstumos al killswitch | Guarda `if (state.killed) return;` en el `.then`. | 0 avisos póstumos | Bajo | **S1** |
| M8 | `bigAlert:15263` | NT-128: modal reemplazado sin acknowledge | `ov.remove()` previo → llamar `acknowledge()` si el modal saliente era ROJO con nag vivo. | 0 nags huérfanos | Bajo | **S2** |

### EJE B — Canales de entrega

| M# | Punto | Problema | Cambio exacto | Impacto esperado | Coste/riesgo | Orden |
|---|---|---|---|---|---|---|
| M9 | `_notificarSistema:16064` | NT-106: nombre en el SO (PC compartido) | **A la cola del médico (Q1)**: opciones (a) iniciales, (b) «paciente de las HH:MM», (c) mantener nombre. El encargo §6 fija como objetivo «SO sin PHI». | Normativa: cumple Ley 1581/2012 art. 3-4 sin perder identificación del hecho | Bajo · cambia qué ve el médico → NO lo decide el enjambre | **S0 (decisión)** |
| M10 | `_encolarAvisoPendiente:15978` | NT-107: PHI en claro en localStorage, persistencia indefinida | Guardar solo `{color, hora, apptKey, uid, flashText}`; reconstruir texto genérico al pintar; purgar por tiempo AL ESCRIBIR (no solo al flush). | 0 PHI persistente fuera de pestaña | Medio (el cartel pierde el nombre → ver Q1, misma política) | **S0** |
| M11 | `avisoUniversal` solo-adelantables 🎯 | NT-112: C4 para R=1 | Si el aviso NO trae abandono/PyM/labs (solo 🎯): C1 toast persistente en vez de modal. | I: −1 modal/jornada · R intacto (información disponible en pastilla) | Bajo | **S1** |
| M12 | C02 re-aviso labs `checkAvisoUniversal:15599` | NT-113: C4 para R=2 en el 2.º aviso | Degradar a C1 persistente; modal solo si trae abandono. | I: −1 modal/jornada típica | Bajo | **S1** |
| M13 | VERDE con pestaña oculta (`_dispararAvisoAudible:16094`) | Regla de oro: R=1 no justifica C3 | VERDE oculto → C0 (favicon/badge dock), sin notificación del SO. DIS-4 resuelto: sin veto clínico. | I: −N SO/jornada en segundo plano (pendiente medir con `avisos.canal.hora`) · R=1 intacto en página | Bajo · cambia qué recibe el médico → informar en PR | **S1** |
| M14 | D02 con pestaña visible | NT-111: C3 directo | `osNotify` directo → `notify()` (respeta visibilidad: C1 visible, C3 oculto). | Canal ≤ R | Bajo | **S1** |
| M15 | `#vgl-toasts` (:21029) | NT-115: críticos polite, sin teclado | `aria-live="assertive"` para críticos; `.vgl-toast` con `role="button"`+`tabindex="0"`+Esc cierra. | Accesibilidad | Bajo | **S1** |
| M16 | CSS pausa clínica :35959 | NT-110: 2,31:1 en el aviso del killswitch | Usar los fallbacks AAA del propio literal (#991b1b/#ffffff → 8,31:1) o token dedicado; añadir `role="status"`+`aria-live`. | Legibilidad del aviso de seguridad | Bajo (CSS) · verificar con Playwright getComputedStyle | **S0** |
| M17 | z-index literales (9) · sub-12px (`.vgl-pym-t`, `.vgl-pym-lead`, `--t-nano`) · reduced-motion en flash/paquete/chooser | NT-116/117/126 | Migrar a tokens `--z-*`; subir a 12px; cubrir `prefers-reduced-motion` en el parpadeo (respetando que el flash crítico es señal: opción cola Q-ACC). | UI/A11y | Bajo, mecánico | **S2** |

### EJE C — Frecuencia máxima por usuario

| M# | Punto | Problema | Cambio exacto | Impacto esperado | Coste/riesgo | Orden |
|---|---|---|---|---|---|---|
| M18 | `uxTrack:13135` | §5.4: sin telemetría no hay decisión de topes con datos | Claves nuevas (fusión SA-USR+SA-UX, sin PHI): `toast.desenlace {color,via,ttl_ms}` · `avisos.canal.hora {c1,c3,c4,c5}` · `aviso.durante_escritura {color,canal}` · `bandeja.ocupacion {vivos,criticos}` · `tono.disparado {color}` · `aviso.universal.suprimido {seccion}` · `mute.activado {min}` · `nag.reconocido {repiques}` · `cola.descartado {motivo}` (cierra NT-120) | Convierte todos los «pendiente de medir» en conteos reales; prerequisito de DIS-1 | Medio (payload anónimo; verificar T-42) · **bloqueado por NT-122** (repFlush roto: la cola de telemetría revienta en modo estricto) | **S0** |
| M19 | D03 `:13906` sin uid; D11 sin dedup | NT-118 | uid explícito `pymupd|día|fp`; dedup persistente por día para D11 (1/día por tipo de fallo). | I: −repeticiones de fallos de guardado en cadena | Bajo | **S1** |
| M20 | topes por evento | DIS-1: fatiga de B02/B04 | **Ningún tope nuevo a eventos R≥2 hasta que M18 mida.** Si la medición lo pide, tope SOLO a R≤1 (p. ej. VERDE acumulativo con re-arme por hora), patrón `avisoPacEval` (ventana móvil 3/h, fall-open). | C: hipótesis a validar con datos | — | **Condicionado** |
| M21 | `avisoPacHistPodar:10848` | NT-123 | Purga temporal (además de por conteo) + salida desde el panel. | Retención acotada | Bajo | **S2** |
| M22 | `TERMINOS_TEXTO` v1.2 | NT-124 | v1.3 declarando los 4 stores/flujos (SO con nombre según Q1, cola pendiente, histórico cédulas, bitácora) → re-pregunta de aceptación. | Cumplimiento Decreto 1377/2013 | Medio (toque a la compuerta de consentimiento) | **S2** |

---

## 3. PLAN DE IMPLEMENTACIÓN (una tarea = un PR; diff mínimo + prueba nacida del caso + mutación en `tests/INFORME_MUTACIONES.md` + `node tests/runner.js` ≥ baseline; rebase sobre la punta ANTES de cada PR — el archivo se movió ~44 líneas durante esta auditoría)

| PR | Contenido | Prueba clave (nacida del hallazgo) | Orden |
|---|---|---|---|
| PR-NT-301 | M1 exención R3 del presupuesto + M2 marca-visto-tras-pintar + race re-check | Paciente 7+ con abandono tras agotar presupuesto → modal SÍ sale (rojo si se rompe la exención) | S0 |
| PR-NT-302 | M3 osNotify canal confirmado + anti-doble-canal | Mock Notification con `onshow` a 3 s → exactamente 1 canal | S0 |
| PR-NT-303 | M10 cola sin PHI + purga temporal | Cola persistida no contiene nombre/cédula (assert sobre el JSON) | S0 |
| PR-NT-304 | M16 contraste pausa clínica | Playwright `getComputedStyle` ratio ≥ 4.5:1 (ojo: prueba debe asegurar lectura del color computado, no `innerHTML.includes`) | S0 |
| PR-NT-305 | M18 telemetría (requiere fix NT-122 previo o en el mismo PR, si el médico lo autoriza — es «hallazgo no tocado») | Cada clave dispara con payload esperado en el mock | S0 |
| PR-NT-306 | M4 mute compartido · M7 guard killed · M14 D02 por notify | Silencio en pestaña A calla tono de B; `.then` post-kill no consume | S1 |
| PR-NT-307 | M5 badge 3+ PyM (+aviso si Q5 aprueba) · M6 D02 por episodio + C0 | Tarjeta con 3+ PyM legible en monocromo (Playwright) | S1 |
| PR-NT-308 | M11/M12 degradar C4→C1 (adelantables solos; re-aviso labs) | Casos hermanos: modal solo con abandono | S1 |
| PR-NT-309 | M13 VERDE oculto→C0 · M19 uids D03/D11 | VERDE con pestaña oculta: 0 SO, favicon sí | S1 |
| PR-NT-310 | M15 aria/teclado toasts | Toast crítico cierra con Esc; `aria-live=assertive` | S1 |
| PR-NT-311 | M8 acknowledge · M17 tokens z/12px/reduced-motion · M21 purga temporal · M14 limpieza CSS muerto (NT-114) | Mutaciones de mutación estándar + Playwright | S2 |
| PR-NT-312 | M22 Términos v1.3 | Compuerta re-pregunta | S2 |
| — | M9/Q1, M20 | Esperan decisión del médico / medición M18 | — |

---

## 4. COLA DEL MÉDICO (el enjambre NO decide)

| Q# | Decisión | Opciones | Riesgo |
|---|---|---|---|
| Q1 | **¿Nombre del paciente en las notificaciones de Windows?** (NT-106/DIS-2) | (a) Iniciales «J.P. — confirmación extemporánea» · (b) «Paciente de las 09:58…» (cero PHI) · (c) mantener nombre completo | (a/b) en PC compartido nadie más identifica al paciente; (b) pierde el nombre hasta abrir la agenda; (c) mantiene la exposición actual en el Centro de actividades 3 min |
| Q2 | **¿«Silenciar 15 min» exemta al ROJO?** (NT-109b/DIS-5) | (a) El ROJO siempre suena (mute calla lo demás) · (b) mantener como está | (a) rompe el «minimalista» pedido el 28-ago; (b) un fraude dentro de la ventana pierde su ÚNICO aviso sonoro de la jornada |
| Q3 | **¿Caducidad del cartel ROJO encolado (hoy 10 min)?** (NT-125/DIS-3) | (a) sin caducidad para ROJO (evidencia persiste) · (b) 30 min · (c) mantener 10 min | (a) puede recordarle una llegada ya atenida (lo que usted pidió evitar en v14.1.5); (c) fraude visto tarde sin reflejo visual |
| Q4 | **¿Confirma eximir abandono RCV del presupuesto 6/día?** (M1/DIS-6) | (a) sí, sin tope para R=3 · (b) presupuesto propio mayor (p. ej. 12/día solo abandono) | (a/b) más modales/jornada — se mide con `aviso.universal.suprimido` |
| Q5 | **¿Quiere OÍR el «3+ PyM»** (hoy solo colorea la tarjeta)? (NT-108) | (a) solo badge visual (sin sonido) · (b) badge + toast C1 con tope 3/h | (b) nueva fuente de fatiga, acotada por el tope |

---

## 5. CERTIFICACIÓN (NT-90)

1. **Estado del banco:** verde al cierre (exit 0; re-ejecutado tras la auditoría — ver
   registro). Este enjambre NO modificó `vigilante_agenda.user.js`: cero riesgo funcional
   introducido. Los cambios del enjambre paralelo SF-## están fuera de este alcance.
2. **Certificación del encargo:** el sistema de avisos fue auditado como producto con
   8 perfiles, 28 hallazgos con evidencia, 6 discrepancias resueltas por jerarquía y un
   plan de 12 PRs. La certificación «fatiga reducida sin pérdida clínica» queda
   **CONDICIONADA**: se emitirá tras aplicar el plan y re-simular la jornada (NT-121
   como línea base: 55 avisos/jornada, 13,3/h). Condición dura de certificación:
   ningún evento R=3 pierde canal ni repetición mínima (axiomas §1 verificados línea a
   línea en las propuestas M1-M22: ninguna los degrada; M1 los refuerza).
3. **Pendientes de medir declarados:** distribución real de canales por hora (M18),
   avisos en segundo plano (C3), desenlaces de toasts (clic vs expiración), ocupación
   de la bandeja. Todo tiene la telemetría o simulación que lo cierra (§5.4).
4. La palabra final es del médico, siempre.

---

## 6. ESTADO DEL PLAN (implementación 2026-09-07 — ver INFORME_CIERRE_NOTIFICACIONES.md)

- **S0+S1+S2 ejecutados en el día**: M1-M22 + NT-103 + Q1(b)/Q2(a)/Q3(b)/Q4/Q5(b)
  aplicados; suite nueva `tests/suite_89_nt_mejoras.js` (20 casos); 10 mutaciones
  verificadas en `tests/INFORME_MUTACIONES.md`; suites 42/68/70/79/82/83 y 17
  actualizadas a los contratos nuevos; Términos v1.3 (T-47) espejados con
  `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md`.
- **Ajustes contra el banco (contratos vivos mandan):** M11 desestimada (contraviene
  v18.0.120), M13/M14/M17 recortadas a lo compatible (v14.1.5, v17.6.15/v18.0.8,
  v18.0.124/Regla J). Detalle y lección en el informe de cierre.
- **Banco:** corridas de cierre en `AUDITORIA/cierre_impl_nt_raw*.txt` (progresión
  10 → 5 → 1 → 0 fallos). Estado final: ver informe de cierre §Resultados.
- **A21 aplazada** (CSS muerto banner PyM) y **Q1-Q5 👤 ratificación del médico**
  siguen abiertas — son los únicos remanentes del plan.
