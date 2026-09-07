# SEGUIMIENTO DE MEDIDAS — HALLAZGOS NT (correctivas, preventivas y de mejora)
## Vigilante de Agenda v18.3.x · Apertura: 2026-09-07 · SA-DEV (implementación) / SA-ORQ (validación) / Médico (confirmación Q1-Q5)

> Sistema de seguimiento continuo exigido por el encargo de implementación. Una fila por
> medida. Estado: ⏳ pendiente · 🔧 en curso · ✅ implementada y validada · ⏸ aplazada
> (con causa) · 👤 pendiente de confirmación del médico. Toda desviación se documenta en
> la columna correspondiente y en §Desviaciones. Evidencia: suite/prueba + corrida.

## 1. Acciones por criticidad (alta → media → baja)

| # | Hallazgo(s) | Crit. | Acción (M#) | Responsable | Plazo | Estado | Evidencia / desviación |
|---|---|---|---|---|---|---|---|
| A01 | NT-101 presupuesto silencia R=3 | Alta | M1: eximir abandono/prioridadRcv del presupuesto 6/día + `aviso.universal.suprimido` | SA-DEV | S0 2026-09-07 | ✅ | suite_89 · mutación M1 · DIS-6/Q4 👤 confirmación médico |
| A02 | NT-102 fuga v17.6.8 + race | Alta | M2: pintar→marcar verificado, reembolso de presupuesto, re-check de uid pre-appendChild | SA-DEV | S0 2026-09-07 | ✅ | suite_89 · mutación M2 |
| A03 | NT-104/105 osNotify contado-no-visto / doble canal | Alta | M3: marca solo si canal pintó (avisoOlvidar revert), onshow tardío cierra la Notification | SA-DEV | S0 2026-09-07 | ✅ | suite_89 · mutación M3 |
| A04 | NT-107 PHI en cola localStorage | Alta | M10: cola sin PHI (hora/estado/apptKey) + purga por tiempo AL ESCRIBIR; Ley 1581/2012 art. 4, Circular Ext. 005/2017 SIC | SA-DEV | S0 2026-09-07 | ✅ | suite_89 · mutación M10 |
| A05 | NT-106 nombre en SO (Q1) | Alta | M9: cuerpo del SO sin nombre ni cédula para eventos de agenda («paciente de las HH:MM»); directos sin cambio | SA-DEV | S0 2026-09-07 | ✅ | suite_89 · mutación M9 · 👤 opción (b) aplicada según instrucción; reversible |
| A06 | NT-108 3+ PyM color-only (axioma §1.5) | Alta | M5: bandera de TEXTO «⏳ 3+ ACTIVIDADES PyM» en tarjeta + aviso C1 silencioso con tope 3/h (Q5) | SA-DEV | S1 2026-09-07 | ✅ | suite_89 · mutación M5 · Q5 👤 |
| A07 | NT-109 mute no compartido + traga ROJO (Q2) | Alta | M4: `vgl_mute_hasta` compartido (localStorage); Q2 opción (a): ROJO exento del silencio (tono+cartel) | SA-DEV | S1 2026-09-07 | ✅ | suite_89 + suite_42 + suite_70 actualizadas · mutaciones M4/Q2 · 👤 |
| A08 | NT-110 pausa clínica 2,31:1 | Alta | M16: pares fijos #991b1b/#ffffff (8,31:1 AAA) + `role="alert"` | SA-DEV | S0 2026-09-07 | ✅ | suite_89 (contrato de fuente) |
| A09 | NT-111 D02 1/día + C3 visible | Media-Alta | M6/M14: re-aviso por EPISODIO (30 min de ceguera continua) + marca C0 en resumen. AJUSTE 07-sep: despacho por osNotify directo (el banco v17.6.15/v18.0.8 exige que la ceguera salga al SO esté donde esté el médico; «un aviso=un canal» no aplica a un aviso operativo sin hecho clínico) | SA-DEV | S1 2026-09-07 | ✅ | suite_17 verde tras ajuste · desviación §2.4 |
| A10 | NT-112/113 C4 para R≤2 | Media | M11/M12: solo-adelantables → C1; re-aviso labs → C1. M11 DESESTIMADA (contradice el contrato v18.0.120: el LDL fuera de metas vigente sale como aviso de entrada completo); M12 mantenida | SA-DEV | S1 2026-09-07 | ✅ (M12) ⏸ (M11) | suite_04 punta-a-punta verde · desviación §2.5 |
| A11 | NT-115 a11y toasts | Media | M15: críticos `role="alert"`, teclado (Tab/Esc/Enter), cierre accesible | SA-DEV | S1 2026-09-07 | ✅ | suite_89 |
| A12 | NT-116/117/126 UI | Media/Baja | M17: z-index por tokens (salvo .vgl-sp-toast, literal exigido por Regla J); pym-t/pym-lead suben a var(--t-micro) 12px; reduced-motion en paquete/chooser/flash. AJUSTE: --t-nano conserva 10px (escala v18.0.124, suite_25 Reglas G/H) | SA-DEV | S2 2026-09-08 | ✅ | suite_89 + suite_25 verdes · desviación §2.6 |
| A13 | NT-118 uid D03/dedup D11 | Media | M19: uid explícito PyM-actualizado; dedup por día en fallos de guardado | SA-DEV | S1 2026-09-07 | ✅ | suite_89 (contrato de fuente) |
| A14 | NT-119 .then post-kill | Media | M7: guarda `state.killed` | SA-DEV | S1 2026-09-07 | ✅ | suite_89 |
| A15 | NT-120 descartes invisibles | Baja | M18: `cola.descartado`, `toast.desenlace`, `tono.disparado`, `aviso.durante_escritura`, `avisos.canal.hora`, `mute.activado`, `nag.reconocido` | SA-DEV | S0 2026-09-07 | ✅ | suite_89 · NT-122: `let enviadas/fallo` ya corregidas por el enjambre (verificado, no re-editado) |
| A16 | NT-122 repFlush ReferenceError | Alta (telemetría) | Verificación: corrección ya presente en el archivo (declaración `let enviadas = 0, fallo = false;`) | SA-DEV | S0 2026-09-07 | ✅ | suite_89 caso NT-122 |
| A17 | NT-123 retención vgl_aviso_hist | Media | M21: purga TEMPORAL además de por conteo | SA-DEV | S2 2026-09-08 | ✅ | suite_79 + suite_89 · mutación M21 |
| A18 | NT-124 Términos no declaran 4 flujos | Media | M22: v1.3 con cláusula T-47 (avisos/notificaciones); docs + suite_82 sincronizados; Decreto 1377/2013 | SA-DEV | S2 2026-09-08 | ✅ | suite_82 verde (22 ok) |
| A19 | NT-103 modo oculto consume presupuesto | Media | Guarda: no evaluar aviso universal en modo oculto (difiere, no consume) | SA-DEV | S2 2026-09-08 | ✅ | suite_89 |
| A20 | NT-125/Q3 caducidad cartel ROJO 10 min | A decidir | Opción (b): ROJO caduca a 30 min (los demás siguen a 10 min) | SA-DEV | S1 2026-09-07 | ✅ | suite_68 + suite_17 reescrita al contrato (2 casos) · 👤 |
| A21 | NT-113b/NT-114 CSS muerto banner PyM | Baja | LIMPIEZA APLAZADA: el enjambre paralelo edita las mismas zonas CSS en este momento; borrar ~10 bloques ahora arriesga un conflicto de escritura. Se ejecuta cuando el repo esté quieto. | SA-DEV | post-swarm | ⏸ | desviación §2.2 |
| A22 | NT-127 VERDE/AZUL sin respaldo visual | Baja | Cerrado por diseño vía M13 AJUSTADA: VERDE no gasta SO con pestaña VISIBLE fuera de HCHealth; con pestaña DESATENDIDA el SO es su único canal (invariante v14.1.5 manda). AZUL residual documentado. | SA-ORQ | — | ✅ | suite_89 + suite_04 v14.1.5 verdes · desviación §2.7 |
| A23 | M20 topes a R≥2 | Condicionada | NO se implementa tope a eventos R≥2 sin datos (DIS-1); la medición la cierra M18 | SA-ORQ | tras M18 | ✅ (dictamen) | M18 en verde; decisión documentada |

**Plazos:** S0 = 2026-09-07 (hoy) · S1 = 2026-09-07 · S2 = 2026-09-08.
**Responsable de validación:** SA-ORQ (banco + mutaciones + re-simulación).
**Normativa aplicada:** Ley 1581/2012 (arts. 3-4, 8-9), Decreto 1377/2013, Circular Ext.
005/2017 SIC, WCAG 2.1 AA/AAA, Ley 23/1981 (secreto profesional). Fuentes pendientes
según AE-014 se mantienen en REGISTRO_ELITE.md.

## 2. Desviaciones (se actualiza durante la ejecución)

1. (apertura) Entorno con enjambre paralelo SF-## editando el mismo archivo: las líneas
   derivan decenas de líneas por hora. Todas las ediciones usan anclas de contenido.
2. (apertura) A21 aplazada por colisión de escritura (causa arriba).
3. (pendiente de cierre) Q1/Q2/Q3/Q4/Q5: opciones aplicadas según instrucción expresa
   del usuario; quedan marcadas 👤 para ratificación o reversión del médico.
4. (07-sep, banco completo) La primera corrida del banco tras S0-S2 dejó 10 fallos: 6
   regresiones/contradicciones mías y 4 pruebas con contrato viejo. Diagnóstico y
   corrección aplicados:
   - M13 original suprimía el SO del VERDE también con pestaña DESATENDIDA → violaba el
     invariante v14.1.5 (suite_04 ×2). Corregida: solo se suprime con pestaña VISIBLE.
   - M11 (solo-adelantables → toast) contradecía el contrato v18.0.120 (suite_04 LDL
     punta a punta). DESESTIMADA; M12 se mantiene.
   - M14 (D02 vía notify()) no sacaba el SO con pestaña visible → suite_17 ×2.
     Ajustada a osNotify directo conservando el episodio de 30 min y el uid.
   - Q3 cambió la caducidad del ROJO de 10 a 30 min → prueba vieja de suite_17
     reescrita al contrato nuevo (2 casos hermanos).
   - Q2 (ROJO exento de mute) → caso viejo de suite_70 reescrito (igual que suite_42).
   - M17 tipografía: --t-nano debe seguir 10px (escala v18.0.124, suite_25) y
     .vgl-sp-toast conserva su literal (Regla J). Ajustada: pym-t/pym-lead a
     var(--t-micro) (12px por token), nano→10px, sp-toast→literal.
5. (07-sep) NT-122 (repFlush) ya estaba corregido por el enjambre paralelo: verificado
   en fuente y cubierto por caso de suite_89; no se re-editó (regla: no duplicar trabajo
   ajeno). Registrado como «corregido externamente».
6. (07-sep) M11 desestimada y M13/M14/M17 recortadas por contradecir contratos vivos
   del banco (v18.0.120, v14.1.5, v17.6.15/v18.0.8, v18.0.124): lección registrada en
   el informe de cierre — ninguna medida del enjambre NT puede entrar sin correr el
   banco completo ANTES de darla por implementada.

## 3. Registro de avance (append)

| Fecha/hora | Medida | Evento |
|---|---|---|
| 2026-09-07 | — | Apertura del seguimiento; inicio S0 |
| 2026-09-07 | S0 | M1, M2, M3, M9, M10, M16, M18 aplicadas; NT-122 verificado corregido externamente |
| 2026-09-07 | S1 | M4/Q2, M5/Q5, M6/M14, M7, M8, M11, M12, M13, M15, M19, Q3 aplicadas |
| 2026-09-07 | S2 | M17, M21, M22 (Términos v1.3 + docs), NT-103 aplicadas |
| 2026-09-07 | IMP-5 | suite_89 creada (20 casos verdes); 10 mutaciones verificadas y registradas en tests/INFORME_MUTACIONES.md; suites 42/68/79/82/83 actualizadas a los contratos nuevos |
| 2026-09-07 | IMP-6 | Banco completo #1: 3453 ok / 10 fallan (evidencia cierre_impl_nt_raw.txt). Diagnóstico de los 10 (§2.4): 6 fixes de código + 4 pruebas al contrato nuevo. Banco #2 en corrida (cierre_impl_nt_raw2.txt) |
| 2026-09-07 | IMP-6 | Banco #2: 3460 ok / 5 fallan — 4 de ellos por ediciones PISADAS por el enjambre SF-## (write-back stale); re-aplicadas con verificación de 8 anclas antes/después de cada corrida |
| 2026-09-07 | IMP-6 | Banco #4: 3463 ok / 1 falla (Regla J: `#vgl-tip-pop` migrado a var(--z-modal) rompía el conteo exacto=2; corregido a `calc(var(--z-alerta) - 1)`) |
| 2026-09-07 | IMP-6 | **Banco FINAL (cierre_impl_nt_final.txt): 3464 pasan / 0 fallan — VERDE.** Anclas re-verificadas tras la corrida (8/8). Temporales de trabajo borrados |
| 2026-09-07 | DEPLOY | Commit 393faaa (93 archivos) pusheado a origin/claude/sf-simulacion-flujos; gist de distribución actualizado a v18.4.4 |
| 2026-09-07 | A24 | Requerimiento de permiso `pym_opcional` (Dra. Gloria, Medicina General): v18.4.4 + TABLERO v12.10.15 implementados; 2 mutaciones; banco v18.4.4 en corrida final |
