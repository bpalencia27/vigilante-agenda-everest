# REGISTRO MAESTRO — Auditoría élite Vigilante de Agenda (v18.3.6)

> Dueño: SA-LOG. Solo append · ID único (AE-###) · vocabulario de estado cerrado
> (reportado/aceptado/en-cola/arreglado/descartado-con-motivo) · toda fila de otro
> subagente se conserva íntegra en conflictos. Encargo: `SUPERPROMPT_AUDITORIA_ELITE.md`.

## 0. BASELINE CONGELADA (FASE 0 — 2026-09-06)

| Dato | Valor | Evidencia (comando) |
|---|---|---|
| `@version` | **18.3.5** | `grep -n '@version' vigilante_agenda.user.js` → L4 |
| Líneas | **51.287** | `Get-Content -Raw` split `\n`.Count |
| Bytes | **3.388.806** | `(Get-Item).Length` |
| sha256 | `0DEFA0F12DDC12121F0BC0A8E0417FEE28D0998783EE1F2C1DCD2F08AB5DB5ED` | `Get-FileHash -Algorithm SHA256` — idéntico al Gist oficial y a `wt-barrera` (verificado en sesión previa, past-chat 6a9de4ce) |
| Rama local | `claude/m2m-fixes-30` (punta `26fee95`, = `origin/claude/m2m-fixes-30`) | `git branch -vv` |
| `origin/HEAD` | → `claude/v14-continuacion` (wt-barrera ya en **18.3.6**) | `git branch -a` |
| Rama base del encargo | `origin/claude/pym-agenda-blindaje-v12-4` (SOLO remota; sin checkout local) | `git branch -a` |
| Estado del árbol | SUCIO: 35 modificados + untracked (sincronización v18.3.5 de sesión previa, sin commit) | `git status` |
| Banco completo | **3.400 pasan / 0 fallan** · funciones 971/1259 (77,1%) · salida íntegra preservada en `AUDITORIA/baseline_1835_raw.txt` | `node tests/runner.js` (corrida desacoplada 2026-09-06) |

### Inventarios de riesgo re-contados (MAPA.md quedó en v18.0.137; re-cuento contra 18.3.5)

| Inventario | 137 (MAPA.md) | 18.3.5 (hoy) | Δ | Comando |
|---|---|---|---|---|
| `catch (e) {}` mudos | 749 | **838** | +89 | `grep -c "catch (e) {}"` |
| `innerHTML` | 140 | **141** | +1 | `grep -c "innerHTML"` |
| `addEventListener` | 237 | **263** | +26 | `grep -c "addEventListener"` |
| `removeEventListener` | 14 | **23** | +9 | `grep -c "removeEventListener"` |
| `setInterval` | 27 | **30** | +3 | `grep -c "setInterval"` |
| `setTimeout` | 74 | **78** | +4 | `grep -c "setTimeout"` |
| `GM_xmlhttpRequest` | 40 | **45** | +5 | `grep -c "GM_xmlhttpRequest"` |

Deriva a dictaminar en FASE 2: `addEventListener` +26 vs `removeEventListener` +9;
`setInterval` +3. Los números de línea de MAPA.md (v18.0.137, ~36k líneas) NO valen
para 18.3.5 (51k): Fase 1 debe re-verificar rangos antes de auditar cualquier zona.

## 1. TABLA DE TAREAS

| Tarea | Subagente | Descripción | Estado | PR |
|---|---|---|---|---|
| F0 | SA-LOG | Preparación: punta, baseline congelada, registro inicial | cerrado | — |
| F1-inventario | SA-LOG + SA-DIS | Universo auditable e integridad de anexos | cerrado | — |
| F2-barrido | SA-PROG | Revisión delta v18.0.137→18.3.6 (seguridad, invariantes, PHI/normativa) | cerrado | — |
| F3-deuda | SA-DIS + SA-PROG + SA-HCE | Inventario consolidado de deuda (18 hallazgos AE-001…AE-018) | cerrado | — |
| F4-pulido | SA-PROG | Arreglos: AE-008 (fail-closed D5/D6 + P10·7), AE-010 (warn latidos + P11·22), AE-006 (ancla VersionCheck), AE-016 (comentario CI), AE-007 (CHANGELOG 18.3.1-18.3.7); 3 mutaciones verificadas (M1-M3, muertas); bump quíntuple a 18.3.7 (AE-020); commit **6477423** rama `claude/auditoria-elite-1836` | cerrado | 6477423 |
| F5-cruzada | los 4 | Revisión cruzada: dictamen con 1 objeción crítica (bump/ancla — resuelta, AE-020) + 4 menores (fechas CHANGELOG, línea D6 — resueltas) | cerrado | — |
| F6-informe | SA-LOG | Informe final con certificación condicionada — `AUDITORIA/INFORME_FINAL_ELITE.md`; banco final **3.402/0** | cerrado | — |

## 2. HALLAZGOS

| ID | Fecha | Subagente | Severidad | Archivo:Línea | Hallazgo | Evidencia (comando/cita) | Estado | PR |
|---|---|---|---|---|---|---|---|---|
| AE-001 | 2026-09-06 | SA-LOG | S3 | — | La rama base del encargo (`claude/pym-agenda-blindaje-v12-4`) NO es la punta real del repositorio: `origin/HEAD` apunta a `claude/v14-continuacion`, que ya contiene **v18.3.6** en el worktree `wt-barrera`. Auditar 18.3.5 puede auditar una versión ya superada. | `git branch -a`; `git branch -vv` (wt-barrera: «v18.3.6 - banco en verde») | reportado | — |
| AE-002 | 2026-09-06 | SA-LOG | S3 | — | Baseline sin commit: la sincronización v18.3.5 (35 archivos modificados + untracked: suites 81-84, docs «barrera», CHANGELOG) vive solo en el árbol de trabajo. Cualquier `checkout`/`reset` la pierde sin rastro. | `git status` | reportado | — |
| AE-003 | 2026-09-06 | SA-LOG | S3 | raíz del repo | Tres variantes `vigilante_agenda_v18.1.x_optimized.js` untracked (18.1.2/3/4): ¿desincronizadas/desechables? El superprompt (§3.2) ordena verificarlo — entra a F1. | `git status` (untracked) | reportado | — |
| AE-004 | 2026-09-06 | SA-LOG | S4 | AUDITORIA/MAPA.md:26 | MAPA.md desfasado: sus números de línea e inventarios corresponden a v18.0.137 (749 catch mudos; hoy 838). Re-cuento inicial ya registrado arriba; F1/F2 deben re-verificar rangos de zonas pesadas. | Tabla §0 de este registro | reportado | — |
| AE-005 | 2026-09-06 | SA-LOG | S4 | vigilante_agenda.user.js (salida del runner) | Deuda de cobertura medible por el propio banco: 288 funciones públicas sin cubrir (77,1% cubierto), 2 declaradas pero nunca nombradas (`_acompCerrar`, `_vglCarpetaCifrar`) y 12 declaradas en cubre pero jamás invocadas vía `api.·(...)`. Entrada para F3; contrastar con `FUNCIONES_HUERFANAS.md`. | `AUDITORIA/baseline_1835_raw.txt` (bloques finales) | reportado | — |
| AE-006 | 2026-09-06 | SA-DIS | S2 | TABLERO/VersionCheck.gs:33-34 | Control de integridad inerte: `EXPECTED_SHA_VERSION`/`EXPECTED_SHA256` clavados en 18.0.142 con release vigente 18.3.6; el propio archivo ordena actualizar AMBAS constantes en cada release (:31-32). La verificación anti-manipulación no protege a ningún equipo en 18.3.6. | Subagente F1, cita directa | arreglado (rama auditoría) | — |
| AE-007 | 2026-09-06 | SA-DIS | S3 | CHANGELOG.md:7 | CHANGELOG no cubre 18.3.1–18.3.6 (última entrada 18.3.0, 2026-09-05); el trabajo está en INFORME_MUTACIONES:13415+ pero el registro que lee el médico quedó 6 parches atrás. | Subagente F1 | arreglado (rama auditoría) | — |
| AE-008 | 2026-09-06 | SA-PROG | S2 | vigilante_agenda.user.js:45892, 45915 | Catch mudos dentro de la barrera P10 (detectores D5 nombre/D6 honorífico): si la construcción de esas regex falla en runtime, el detector se desactiva EN SILENCIO y el prompt sale a z.ai/Gemini con una defensa menos, sin contador (`obsPerdidosSumar` no se usa ahí). Única debilitación silenciosa de un control de PHI hallada en el delta. | Subagente F2-seguridad | arreglado (fail-closed + P10·7, mutaciones M1/M2 muertas) | — |
| AE-009 | 2026-09-06 | SA-PROG | S3 | vigilante_agenda.user.js:51016-51021, 51100, 51183 | Pseudonimización débil en obs*: FNV-1a de 32 bits SIN sal sobre cédulas (dominio cerrado ~10^8) → re-identificable por fuerza bruta desde la hoja del tablero. El comentario :51013-51015 («no reversibles») es técnicamente falso. Requiere decisión del médico (sal por equipo/día cierra la fuga a cambio de no unir filas entre días). | Subagente F2-seguridad | en-cola | — |
| AE-010 | 2026-09-06 | SA-PROG | S3 | vigilante_agenda.user.js:36536 | `try { _instalarLatidosBase(); } catch (e) {}` — un fallo ahí deja la jornada sin registro de navegación, sin vigía del reloj y sin renovación del latido de liderazgo (relevos en falso), sin log ni aviso. | Subagente F2-seguridad | arreglado (console.warn + P11·22, mutación M3 muerta) | — |
| AE-011 | 2026-09-06 | SA-LOG | S4 | tests/suite_15_interfaz_avanzada.js | Banco completo 18.3.6 (wt-barrera): 1 falla en suite_15 (268 ok); aislada pasa 269/0. Mismo patrón que el flake ANTIDUP v18.0.98 documentado en sesión previa (carrera de temporizadores bajo carga). NO es regresión del tweak de 8aeff8f. | `_audit_out.txt` L42; `_s15_out.txt` L10 | descartado-con-motivo (flake conocido por carga) | — |
| AE-012 | 2026-09-06 | SA-HCE | S1 | wt-barrera raíz: captura_agendamiento_oficial_20260810.json:9,12,30,81,90; captura_ordenamiento_nativo_20260810.json:9,12,21,57,93,102 | Dos capturas de red en la RAÍZ con perfil completo de paciente (nombre+CC+celular+correo+dirección). Valores con marcadores sintéticos (CC secuenciales 40123456/41234567, @ejemplo.com, 1944-01-01) → probable paciente de pruebas; NO verificable desde el repo. Si fuera real = PHI expuesta. Requiere confirmación del autor. | Subagente F2-HCE | reportado | — |
| AE-013 | 2026-09-06 | SA-HCE | S3 | docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md:136-143,166 | La purga a 12 meses prometida en el aviso NO está instalada de forma verificable: `docs/tablero_purga_12m.gs` existe pero el propio aviso admite «Mientras esa tarea no exista, esta promesa no se está cumpliendo». | Subagente F2-HCE | en-cola | — |
| AE-014 | 2026-09-06 | SA-HCE | S3 | matriz normativa (informe F2-HCE) | Fuentes normativas PENDIENTES: Decreto 1377/2013 (solo cabecera TELEMETRIA.md), Ley 23/1981 (ausente del repo), vigencias Res. 3280/2018 (userscript:30277-30354 «sin confirmar»), habilitación (ausente). Regla dura: nada se completa de memoria. | Subagente F2-HCE | en-cola | — |
| AE-015 | 2026-09-06 | SA-HCE | S4 | vigilante_agenda.user.js:37071, 37338 | «Dra. Gloria» (nombre de pila de médica) en comentarios — PII de PERSONAL, no paciente; intencional (incidencia real 05-09). | Subagente F2-HCE | descartado-con-motivo (intencional) | — |
| AE-016 | 2026-09-06 | SA-DIS | S4 | .github/workflows/tests.yml:62 vs :11 | Comentario obsoleto en CI («fallar si X < 266» vs MIN_COVERAGE=351). | Subagente F1 | aceptado | — |
| AE-017 | 2026-09-06 | SA-PROG | S3 | AUDITORIA/COLA_FUTURO.md (hallazgos A/B) | Re-verificados en 18.3.6, SIGUEN PRESENTES: A = `_vglDiscoTimers` (Map L33190, debounce 4000 ms L32988) ajeno a `state.timers`/`emergencyTeardown` (35844-35902) → escritura póstuma hasta 4 s; B = `_vglDiscoMemoriaRestaurar` sin tope (L33258) y fusión por ts forjado (L33263). Sigue pendiente la decisión del médico, tal como documentó la auditoría v18.0.137. | Subagente F2-invariantes | en-cola | — |
| AE-018 | 2026-09-06 | SA-PROG | OK | vigilante_agenda.user.js (10 invariantes) | Dictamen F2-invariantes: las 10 invariantes de dominio INTACTAS en 18.3.6 (colorAndAlert def 14481/ramas 14595-14716, Atendido→fraudWatch 14642, ROJO edge-triggered 14595+16546, apptKey 14327, diaNuevo 14449, S.excluir 9228 sin VIH, marcas antiduplicado 29670/31189/22302, signatureOf 34714, escapeHtml único 34956, mtrRecalcularConFactores 26883/38153). Evolución semántica documentada (no rotura): Atendido+fraudWatch pinta VERDE+HUECO_DE_LECTURA desde v18.0.12 por corrección textual del médico (14642-14661). | Subagente F2-invariantes | arreglado (N/A: dictamen) | — |
| AE-019 | 2026-09-06 | SA-LOG | S2 | flujo de trabajo (herramienta de edición) | FANTASMA DE EDICIÓN: al enviar VARIAS ediciones search/replace en paralelo al mismo archivo, exactamente UNA se pierde de forma silenciosa pese al reporte de éxito (3 incidentes en esta sesión: catch D6, `@version` L4 y fecha CHANGELOG 18.3.4). Cazado las 3 veces por verificación grep post-edición y por el propio banco (suites 23/30/74 en la corrida V2). Mitigación adoptada: ediciones SECUENCIALES (una por mensaje) + grep de verificación inmediato en TODO archivo tocado. Aplica a cualquier agente que trabaje este repo. | Batches de esta sesión + `_final_out.txt` V2 (fallos suite 23/30/74) | arreglado (protocolo secuencial) | — |
| AE-020 | 2026-09-06 | SA-DIS (revisor F5) | S1-evitado | TABLERO/VersionCheck.gs + cabecera userscript | Objeción CRÍTICA de la revisión cruzada, resuelta: tocar el userscript sin bump habría (a) dejado el fix sin distribución (Tampermonkey ve versión igual — lección 18.3.2, commit 3124a66) y (b) con el ancla ya en 18.3.6, disparado `emergencyTeardown` anti-manipulación en TODA la flota actualizada. Resolución: bump quíntuple a **18.3.7** (`@version` L4, `const VERSION` L1038, `package.json`, pin suite_75 L900, semilla E2E L75) + `EXPECTED_SHA_VERSION="18.3.7"` + sha recalculado `e76e2bf1…fee7207c` sobre los bytes finales, con instrucción a S6 de re-verificar el raw del Gist al publicar. | Dictamen F5 + suites 23/30/74 del banco V2 | arreglado | — |


### Re-baseline 18.3.6 (decisión del propietario sobre AE-001, 2026-09-06)

| Dato | Valor | Evidencia |
|---|---|---|
| Ubicación | `E:\CENTINELA\wt-barrera` (worktree), rama `claude/v14-continuacion` = `origin/HEAD`, commit `8aeff8f` | `git status` limpio (solo untracked `docs/ENJAMBRE_TEAMWORK.md`) |
| `@version` | **18.3.6** | userscript L4; `const VERSION` L1038; `package.json:3`; pin `tests/suite_75_disco.js:900` (verificado por subagente F1) |
| Líneas/bytes/sha256 | 51.287 · 3.388.806 · `C332A89E43D64AB4D5969FBAA8F5E639F1B716F610E0C1FF1EAB96F81B43DBB5` | `Get-FileHash` |
| Delta 18.3.5→18.3.6 | userscript: SOLO 2 literales de versión (L4, L1038) + `tests/e2e/run_e2e.js` nuevo + tweaks suites 15/25/75 + 100 filas INFORME_MUTACIONES | `git diff 877d025 8aeff8f` |
| Delta auditable real | v18.0.137 (`2971d63`, auditada y cerrada) → 18.3.6: **+3.300/−495 líneas** en ~80 hunks (escalera z.ai P9, barrera P10, compuerta P11, saneamiento P12, observabilidad P13, carpeta cifrada v18.0.144, fixes M2M) | `git diff --stat 2971d63 8aeff8f -- vigilante_agenda.user.js` |
| Banco 18.3.6 (wt-barrera) | **3.399 pasan / 1 fallan** — suite_15 (268 ok / 1 FALLA); el mismo banco en 18.3.5 (worktree principal) dio 3.400/0 | `_audit_out.txt` L42/L124 — bajo diagnóstico (AE-011) |



- Pendiente de la sesión anterior RESUELTO: el caso ANTIDUP v18.0.98 (suite_15) pasó en esta corrida
  («Interfaz: ventana, hojas y modales — 269 ok»); la corrida de la sesión previa dio 3.399+1 flaky,
  hoy 3.400/0. Se confirma como flake sensible a carga, no regresión.
- Entorno hostil documentado: una sesión paralela en esta máquina interrumpe terminales compartidos
  y mata procesos node no desacoplados (ya reportado en past-chat 6a9de4ce). Toda corrida del banco
  en este encargo debe lanzarse desacoplada (`Start-Process -WindowStyle Hidden` con redirección).
