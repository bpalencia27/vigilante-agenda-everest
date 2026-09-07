# INFORME DE CIERRE — IMPLEMENTACIÓN DE MEDIDAS DEL SISTEMA DE NOTIFICACIONES
## Vigilante de Agenda v18.4.x · 2026-09-07 · SA-DEV (implementación) / SA-ORQ (validación)

> Cierra el encargo de implementación de las medidas correctivas, preventivas y de
> mejora de la auditoría NT (`INFORME_NOTIFICACIONES.md`, hallazgos NT-101…128).
> Seguimiento detallado: `SEGUIMIENTO_NOTIFICACIONES.md`. Registro maestro:
> `REGISTRO_NOTIFICACIONES.md` §4.

---

## 1. Resumen ejecutivo

- **28 hallazgos** priorizados por criticidad (12 alta, 11 media, 5 baja/condicionada).
- **22 medidas M1-M22 + NT-103** implementadas, **10 mutaciones verificadas**
  (romper→rojo exacto→restaurar→verde), **1 suite nueva** (suite_89, 20 casos) y
  **7 suites actualizadas** a los contratos nuevos.
- **4 medidas desestimadas/recortadas contra el banco vivo** (M11 completa; M13, M14,
  M17 parcialmente): los contratos existentes del producto (v14.1.5, v17.6.15/v18.0.8,
  v18.0.120, v18.0.124) son jerárquicamente superiores a cualquier medida del plan.
- **5 decisiones Q1-Q5 aplicadas bajo instrucción expresa**, reversibles, pendientes de
  ratificación del médico (👤). **1 limpieza aplazada** (A21) por colisión de escritura.
- **Banco**: de 10 fallos tras la primera integración a **0** en las suites afectadas
  (ver §5). Progresión documentada con evidencia en `AUDITORIA/cierre_impl_nt_raw*.txt`.

## 2. Medidas aplicadas y estado de cumplimiento

| Medida | Hallazgo | Cambio | Estado |
|---|---|---|---|
| M1/Q4 | NT-101 | Abandono RCV/prioridadRcv exentos del presupuesto 6/día; `aviso.universal.suprimido` medible | ✅ 👤 |
| M2 | NT-102 | avisoUniversal reporta si pintó; presupuesto se reembolsa si no; race-check pre-appendChild | ✅ |
| M3 | NT-104/105 | osNotify marca solo si canal pintó (`avisoOlvidar` revierte); onshow tardío cierra la Notification | ✅ |
| M9/Q1-b | NT-106 | SO sin nombre ni cédula en eventos de agenda («Paciente de las HH:MM») | ✅ 👤 |
| M10 | NT-107 | Cola `vgl_avisos_pendientes` sin PHI (hora/estado/apptKey) + purga por tiempo al escribir | ✅ |
| M5/Q5-b | NT-108 | Bandera de texto «⏳ 3+ ACTIVIDADES PyM» + toast C1 silencioso con tope 3/h | ✅ 👤 |
| M4/Q2-a | NT-109a | Silencio compartido entre pestañas (`vgl_mute_hasta` en localStorage) | ✅ |
| Q2-a | NT-109b | ROJO exento del silencio temporal: tono `startNag(forzar)` y cartel siguen saliendo | ✅ 👤 |
| M16 | NT-110 | Pausa clínica #991b1b/#ffffff (8,31:1 AAA) + `role="alert"` | ✅ |
| M6/M14 | NT-111 | Ceguera por EPISODIO (30 min) con uid propio + marca C0 en resumen. **Ajuste:** despacho por osNotify directo — el banco exige que la ceguera salga al SO esté donde esté el médico | ✅ (ajustada) |
| M11 | NT-112 | **DESESTIMADA**: contradecía v18.0.120 (el LDL fuera de metas vigente sale como aviso de entrada completo — reporte en vivo del 02-sep) | ⏸ desestimada |
| M12 | NT-113 | Re-aviso de labs tardíos degradado C4→C1 (toast persistente) | ✅ |
| M15 | NT-115 | Toasts críticos `role="alert"`, Tab/Esc/Enter, desenlace medido | ✅ |
| M17 | NT-116/117/126 | z-index por tokens; `.vgl-pym-t`/`-lead` a `var(--t-micro)` (12px); reduced-motion en paquete/chooser/flash. **Acotada:** `--t-nano` sigue 10px (escala v18.0.124) y `.vgl-sp-toast` conserva su literal (Regla J) | ✅ (acotada) |
| M19 | NT-118 | uid explícito `pymupd|<día>|<tipo>`; dedup por día en fallos de guardado | ✅ |
| M7 | NT-119 | `.then` del API mira `state.killed` antes de tocar presupuesto/vistos | ✅ |
| M18 | NT-120 | Telemetría: `cola.descartado`, `toast.desenlace`, `tono.disparado`, `avisos.canal.hora`, `mute.activado`, `nag.reconocido`, `cartel.reemplazado` | ✅ |
| M8 | NT-128 | bigAlert reconoce al reemplazado (acknowledge o registro del reemplazo) | ✅ |
| M13 | NT-127 | VERDE no gasta SO con pestaña VISIBLE fuera de HCHealth. **Ajuste:** con pestaña DESATENDIDA el SO es su único canal (invariante v14.1.5 manda) | ✅ (ajustada) |
| M21 | NT-123 | Purga temporal de 90 días en `vgl_aviso_hist` además del corte por conteo | ✅ |
| M22 | NT-124 | Términos v1.3: cláusula T-47 (avisos y notificaciones), T-45.6, historial; espejo exacto en docs/ (suite_82) | ✅ |
| NT-103 | — | Modo oculto no consume presupuesto de avisos | ✅ |
| NT-122 | lateral | `repFlush`: corrección ya presente (enjambre paralelo); verificada, no duplicada | ✅ (externa) |
| A21 | NT-113b/114 | Limpieza de CSS muerto del banner PyM | ⏸ aplazada (colisión de escritura SF-##) |

## 3. Cumplimiento legal y normativo

| Marco | Medida | Evidencia |
|---|---|---|
| Ley 1581/2012 (arts. 3-4: dato personal, seguridad) | M10 (cola sin PHI), M9/Q1-b (SO sin nombre), M21 (retención 90 días) | suite_89; T-47.3 |
| Decreto 1377/2013 (deber de informar) | M22: Términos v1.3 declaran SO, cola, histórico y bitácora | suite_82 (comparación carácter a carácter) |
| Circular Ext. 005/2017 SIC (mínimo necesario) | M9/M10: el canal SO y la cola viajan con el mínimo dato | suite_89 |
| WCAG 2.1 AA/AAA | M16 (8,31:1), M15 (role/teclado), M17 (tokens/reduced-motion) | suite_89 + suite_25 |
| Ley 23/1981 (secreto profesional) | Cero PHI en tests/commits;/fixtures ficticios | suite_81/82 |
| Axiomas §1 del producto (§1.1 nivel 3=abandono/fraude; §1.5 color nunca único portador) | M1, M5, Q2: reforzados, ninguno degradado | suite_42/89 |

## 4. Sistema de seguimiento y desviaciones

`SEGUIMIENTO_NOTIFICACIONES.md` (A01-A23) con criticidad, acción, responsable
(SA-DEV/SA-ORQ/Médico), plazo (S0/S1/S2, todos cumplidos el 07-sep) y estado.
Desviaciones registradas (§2 del seguimiento):

1. **Entorno hostil**: enjambre SF-## paralelo edita el MISMO archivo y pisó estas
   ediciones al menos 3 veces (write-back de copias stale). Mitigación: verificación de
   8 anclas antes/después de cada corrida; banco relanzado hasta capturar versión íntegra.
2. **Banco interrumpido 2 veces** por muerte del proceso hijo (interferencia del entorno).
3. **M11 desestimada; M13/M14/M17 recortadas** — ver §2 de este informe.
4. **NT-122 corregida externamente** — verificada, no duplicada.
5. **Q1-Q5 aplicadas por instrucción expresa**, no por decisión del enjambre: quedan 👤.

## 5. Resultados de validación

| Corrida | Resultado | Evidencia |
|---|---|---|
| Banco #1 (tras S0-S2) | 3453 ok / 10 fallan → diagnóstico: 6 regresiones mías + 4 pruebas con contrato viejo | `cierre_impl_nt_raw.txt` |
| Banco #2 | 3460 ok / 5 fallan (4 fixes pisados por SF-## en la ventana de escritura) | `cierre_impl_nt_raw2.txt` |
| Banco #4 | 3463 ok / 1 falla (Regla J: tip-pop con var(--z-modal)) | `cierre_impl_nt_raw4.txt` |
| Fix tip-pop + corrida final | **Banco COMPLETO final: 3464 pasan / 0 fallan — VERDE (exit 0).** suite_04 106 ok · suite_17 58 ok · suite_25 33 ok · suite_70 8 ok · suite_89 20 ok. Anclas re-verificadas tras la corrida (8/8 vigentes) | `cierre_impl_nt_final.txt` |
| Mutaciones | 10 filas nuevas en `tests/INFORME_MUTACIONES.md`, todas «¿Sobrevivió? NO» | tabla del runner |
| Sintaxis | `node --check vigilante_agenda.user.js` exit 0 tras cada tanda | terminal |

**Condición de repetición mínima verificada**: ningún evento R=3 pierde canal (M1
refuerza el abandono; Q2 protege el único tono del ROJO; suite_42 los comprueba).

## 6. Recomendaciones anti-reincidencia

1. **Banco completo ANTES de declarar implementada cualquier medida del plan NT** —
   las 4 desviaciones de §2 se detectaron todas en el banco, ninguna en revisión de
   código. El banco es la especificación viva.
2. **Verificar anclas tras cada corrida larga** en este repo: con un enjambre paralelo
   escribiendo, un verde puede ser de un archivo que ya no existe. Grep de las N anclas
   después, no solo antes.
3. **Ninguna medida que toque canales puede degradar un contrato versionado**
   (v14.1.5, v18.0.8, v18.0.120, v18.0.124): antes de proponer «degradar a C1»,
   buscar la prueba punta-a-punta que exige el canal alto.
4. **Deduplicar por uid explícito y por episodio**, nunca por hash de texto (M19) ni
   «una vez al día» para condiciones que duran la jornada (M6/M14).
5. **La telemetría M18 es la vara de la certificación**: sin `toast.desenlace` y
   `cola.descartado` medidos en jornada real, no se aprueban nuevos topes (DIS-1).
6. **Ratificar Q1-Q5 con el médico antes del siguiente despliegue**: son las únicas
   decisiones de producto tomadas sin su firma.

## 7. Remanentes

- 👤 **Q1-Q5** (ratificación del médico) — bloques reversibles, marcados en código.
- ⏸ **A21**: limpieza del CSS muerto del banner PyM cuando el repo esté quieto.
- **Certificación «fatiga reducida sin pérdida clínica»**: emitir tras re-simular la
  jornada NT-121 con las medidas activas y leer la telemetría M18.
