# REGISTRO DE SIMULACIONES — Vigilante de Agenda v18.3.5 (encargo SF)

> Dueño: la fase que crea cada fila. **Solo append** · ID único `S-####` · una fila por
> combinación EJECUTADA (las generadas y no corridas no cuentan para 1A) · conflicto entre
> sesiones paralelas: se conservan AMBAS filas. Encargo: `SUPERPROMPT_SIMULACION_FLUJOS.md`.
> Complementa a `AUDITORIA/REGISTRO_ELITE.md` (auditoría estática, cerrada); si un fallo
> repite un hallazgo `AE-###`, se referencia, no se re-describe.

## 0. BASELINE CONGELADA (FASE 0 / SF-00 — 2026-09-06)

| Dato | Valor | Evidencia (comando) |
|---|---|---|
| `@version` | **18.3.5** | `grep -n '@version' vigilante_agenda.user.js` → L4 |
| Bytes | **3.388.806** | `(Get-Item).Length` |
| Líneas | **51.287** | `((Get-Content -Raw) -split "\`n").Count` |
| sha256 | `0DEFA0F12DDC12121F0BC0A8E0417FEE28D0998783EE1F2C1DCD2F08AB5DB5ED` | `Get-FileHash -Algorithm SHA256` — idéntico al congelado por la auditoría élite el mismo día (`REGISTRO_ELITE.md` §0) |
| Rama local | `claude/m2m-fixes-30` · punta **`26fee95738cbd929555b49d2774f86d2f2d49489`** (`26fee95`, 2026-09-05 14:25 -0500, «M2M banco final: reparar suite_17 y suite_72 rotas por commits propios») | `.git/HEAD` + `git log -1` |
| Remote | `origin` = `github.com/bpalencia27/vigilante-agenda-everest.git` | `git remote -v` |
| Estado del árbol | **SUCIO**: ~35 modificados + untracked (sincronización v18.3.5 sin commit, misma que encontró la auditoría élite; incluye suites 81-84 nuevas ya contadas por el runner) | `git status --porcelain` |
| Motor | node **v24.18.1** (Windows) · PowerShell 5.1 | `node --version` |
| Suites recogidas | **89 archivos** `tests/suite_*.js` (regex del runner L160) | `Get-ChildItem tests -Filter 'suite_*.js'`.Count |
| **Banco completo (baseline)** | **3.400 pasan / 0 fallan** · funciones 971/1259 públicas (77,1%) · 121 anidadas · salida íntegra en `AUDITORIA/baseline_simulaciones_sf00_raw.txt` | `node tests/runner.js` (corrida desacoplada `Start-Process`, 21:19-21:36, 2026-09-06) |

Notas de la corrida:

- Primera corrida por tubería de terminal murió a mitad de suite_34 al reciclarse la
  terminal (sin resumen final). Se relanzó desacoplada (`Start-Process` con redirect),
  patrón ya usado por otras sesiones del repo. El resultado de la corrida válida es el
  que queda congelado arriba.
- El resultado reproduce EXACTO la baseline de la auditoría élite (3.400/0, 971/1259,
  77,1%) sobre el mismo sha256: no hay deriva entre ambas FASE 0 del mismo día.
- `AGENTS.md` cita ~885 KB / 14.158 líneas / 976 comprobaciones (verificado 14-ago):
  **dato caducado**, NO aplicar. La punta vigente es la de esta tabla.

**Límite duro:** ninguna tarea SF puede cerrar con el banco por debajo de
**3.400 pasan / 0 fallan**. Si un fix legítimo rompe una cifra de la baseline,
se detiene y se documenta (§8.4 del encargo), no se fuerza.

### 0.1 · Deriva del árbol durante SF-01 (2026-09-06, ~22:00 local)

Otra sesión paralela (worktrees `wt-arranque`/`wt-barrera`, campaña v18.3.6/18.3.7)
reescribió `vigilante_agenda.user.js` **en plena corrida** del banco de SF-01:
sha256 pasó de `0DEFA0F1…` (baseline) a **`6072D32D…`** (mientras las suites corrían).
Consecuencias:

- El sha de la §0 queda como NOTA HISTÓRICA de la FASE 0; la cifra de referencia
  del banco (**3.400/0**) sigue vigente y se evalúa contra el árbol que haya al
  momento de cada cierre de tarea.
- Banco intermedio contaminado por la escritura en vivo: 3.377/23 (festivos,
  Excel, TERMINOS). Re-corrido con el userscript ya estable: **3.397/3** —
  1×flake ANTIDUP suite_15 (precedente AE-011; aislada pasa **269/269**) y
  2×suite_82 (`TERMINOS_TEXTO` vs `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md`
  desincronizados por esa sesión). Ninguno de los 3 toca el diff de SF-01
  (verificado: suite_15 aislada verde; suite_82 compara producto↔docs, no arnés).
- Toda tarea SF posterior debe re-verificar el sha del userscript ANTES y
  DESPUÉS de su banco y anotar ambos.

## 1. TABLA DE TAREAS SF

| Tarea | Estado | Entrega |
|---|---|---|
| SF-00 · Congelar baseline + crear este registro | **cerrado** | Este archivo |
| SF-01 · Extraer/compartir enriquecedor DOM de suite_73 al arnés | **cerrado** | `tests/harness.js` exporta `enriquecerDom` + `instalarDomEnriquecido` + `disparar`; suite_73 consume `require("./harness.js")` sin copia local; suite_73 9/9 verde; mutación del cableado muerta (0/9 rojo, restaurada); banco 3.397/3 con las 3 fallas ajenas documentadas en §0.1 (ver §7.1 del encargo: las desviaciones se registran, no se tapan) · fila en `tests/INFORME_MUTACIONES.md` |
| SF-02 · R0 + combinatoria M1 + simulación M1 completa | **en curso** | R0 ejecutado y VERDE (suite_85_simulacion_m1, 1/1, exit 0; mutación del mock de confirmación muerta en la aserción antiduplicado F5) · tabla de combinatoria M1 en §2.1 · filas S-0001/S-0002/S-0003 · banco completo post-R0 **3.401/0** (sha userscript `2FEA6C71…` estable INI=FIN, por encima de la baseline 3.400 — las 3 fallas ajenas de §0.1 quedaron resueltas por la sesión paralela) · resto de combinaciones M1 (84 brutas + clases F1-F8) pendientes · NOTA integrador: la rama paralela también numeró «Suite 85» (modo GENERAL, worktree wt-arranque) — al fusionar, renombrar una de las dos |
| SF-03…SF-12 · Un módulo por tarea (M2…M11) | pendiente | Filas por módulo |
| SF-20 · Cruce de módulos | pendiente | Filas de cruce |
| SF-30 · Informe de errores pre-corrección | pendiente | Informe (solo lectura hasta aquí) |
| SF-31… · Una corrección por tarea | pendiente | Diffs + pruebas + mutaciones |
| SF-90 · Re-simulación completa + certificación 1A | pendiente | `AUDITORIA/INFORME_SIMULACIONES.md` |

## 2. REGISTRO DE SIMULACIONES (solo append)

### 2.1 · Tabla de combinatoria M1 (SF-02, §5.2 del encargo — enumerable, no a mano alzada)

Ejes verificados contra el código vigente (v18.3.x, `openAgendamientoModal` L27386+):

| Eje | Valores válidos (de producción) | Tipo |
|---|---|---|
| E1 tipo de cita | `control_lab` («Control Médico + Toma de Labs», defecto), `control` («SOLO Control Médico»), `lab` («SOLO Laboratorios») | independiente |
| E2 especialidad | 12 Med. General (Control, defecto), 46 Psicología, 14 Odontología | independiente |
| E3 plazo | 15 días, 1, 2, 3, 4, 5, 6 meses (`data-m`/`data-d`) | independiente |
| E4 día del rango | dependiente del rango de E3 (`calcRangoSondeoIso`); límites: centro 🎯, primer/último hábil, sábado, día tachado sin agenda | DEPENDIENTE de E3 |
| E5 turno | ninguno, 901/902/903 (estables por fecha en el router de simulación) | dependiente de E4 |
| E6 fecha manual | off / on (modo manual excluye plazo marcado; «↩ Volver» restaura) | independiente (2) |
| E7 paso | 1, 2, 3 (`irAPaso`) | transversal (F1-F8) |
| E8 eje toma | chips de toma + hora de toma: SOLO existe con E1=control_lab | DEPENDIENTE de E1 |

Combinaciones del conjunto cerrado dependiente E1×E2×E3: 3×3×7 = **63 brutas**.
De ellas, E1=lab (21) transiciona a M3 (`openLabSoloModal`) al pulsar «Siguiente» → se
registran en el cruce SF-20, no como combinación M1. **Permanecen 42 en M1**.
Con E6 on/off: 42×2 = **84 combinaciones** a ejecutar con las clases F1-F8 que apliquen.
Ejecutadas en esta sesión: **1** (R0). Pendientes: 83 + clases F1-F8 por eje.

| ID | Módulo | Clase (F1-F8) | Secuencia (pasos abreviados) | Esperado | Observado | Veredicto (OK/DESV/BUG) | Ref (hallazgo SF-###) |
|---|---|---|---|---|---|---|---|
| S-0001 | M1 agendamiento | F2+F3+F5+F6 encadenadas (R0 del médico, §6) | abrir → control_lab (clic reafirma defecto) → Siguiente → plazo 1 mes → ↩ Atrás → card «SOLO Control Médico» → Siguiente → plazo 3 meses → día concreto (no centro, no sábado) → turno 08:00 → #vgl-agm-confirm → ✕ → reabrir | Montado 1 vez; marcas únicas en cada transición; rango 1m y 3m según funciones de negocio; «1 mes» no coexiste con «3 meses»; 1 sola AsignarTurno (radicado 4567); marca antiduplicado SOLO tras confirmación; reabrir: aviso de cita previa + preferencia «solo control» recordada | TODO cumplido (suite_85_simulacion_m1, 1/1, exit 0). Contrato del retroceso documentado: la elección de plazo/día vive en el closure del modal y SOBREVIVE al «↩ Atrás» (no se descarta nada) | OK | — |
| S-0002 | M1 agendamiento | F2 (modificación a mitad de flujo) | con chips de toma pintados (control_lab) → «↩ Atrás» → card «SOLO Control Médico» → Siguiente | Literal §6 paso 5: «el eje labs desaparece de TODO el estado (chips, resumen, preferencias, telemetría) — cero residuo del paso 2» | La sección `.vgl-lab-box` se OCULTA (`display:none`, L27894-27897) pero NO se desmonta: los chips de toma quedan en el DOM ocultos, con marca `active` residual y `selectedLabDateInfo` retenida. Sin efecto en la cita: `isLabChecked` exige `control_lab` (L29643), la confirmación con solo-control no agenda toma. Riesgo real a sondear en la tanda F2 completa: al VOLVER a control_lab tras cambiar el plazo, ¿la toma oculta reaparece con la fecha del plazo viejo? | DESV | SF-02 → cola SF-30 (decidir si el residuo oculto se purga al cambiar de tipo) |
| S-0003 | M1 agendamiento | F5 (confirmación con mock sin confirmación real) — MUTACIÓN de la prueba | R0 completo con AsignarTurno → `{error:true}` (sin radicado) | La marca antiduplicado NO se escribe sin confirmación real; R0 debe ponerse rojo | R0 rojo exactamente en «la marca antiduplicado se escribió SOLO tras la confirmación real (radicado > 0)»; restaurado el mock → verde. Mutación muerta | OK | mutación documentada en tests/INFORME_MUTACIONES.md |

<!-- Continúa SF-02: combinaciones M1 restantes (83) + clases F1-F8. Solo append. -->
