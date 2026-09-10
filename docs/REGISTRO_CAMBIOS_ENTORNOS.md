# Registro de cambios por entorno

Trazabilidad del trabajo hecho en **dos entornos con modelos distintos** sobre este
mismo repositorio. Una fila por cambio, **añadida al final**. Si dos entornos añaden
filas a la vez, el conflicto se resuelve conservando **AMBAS** filas, nunca descartando
la ajena.

La compuerta de fusión (`node tools/vgl-sync.js gate --from=<rama>`) exige que la rama
que se va a fusionar aparezca mencionada en este archivo.

Columnas: `Fecha · Rama · Entorno · Modelo · Archivos · Qué se hizo · Pruebas · Revisor`.

| Fecha | Rama | Entorno | Modelo | Archivos | Qué se hizo | Pruebas | Revisor |
|---|---|---|---|---|---|---|---|
| 2026-09-09 | `alt-ide/multi-ide-workflow-2026-09-09` | trae (este IDE) | agente TRAE | `tools/vgl-lock.js`, `tools/compat-check.js`, `tools/vgl-sync.js`, `.githooks/pre-commit`, `.gitattributes`, `.gitignore`, `docs/FLUJO_MULTI_IDE.md`, `docs/REGISTRO_CAMBIOS_ENTORNOS.md`, `tests/suite_113_multi_ide.js` | Flujo multi-IDE: candado de archivos, verificador de compatibilidad, compuerta de fusión e integración entre ramas, hook pre-commit y contrato documentado | `node tests/runner.js` + suite 113 | pendiente |

---

## Cómo añadir una fila

1. Toma el candado de los archivos que vas a tocar:
   `node tools/vgl-lock.js acquire <ruta>... --task="<qué>" --ttl=120`.
2. Trabaja y corre el banco: `node tests/runner.js`.
3. Añade tu fila **al final** de la tabla con la rama exacta (así la ve la compuerta).
4. Suelta el candado: `node tools/vgl-lock.js release <ruta>...`.

## Reglas de la columna «Entorno»

- `trae` — este IDE.
- `alt-ide` — el IDE alterno (otro modelo de IA).
- El nombre debe coincidir con el `env` de tu `.vgl-env.json`, o el candado no te
  reconocerá como dueño legítimo de lo que tomaste.

## Reglas de la columna «Pruebas»

Escribe el comando real que corriste y su resultado, no una promesa. Ejemplos:
`node tests/runner.js → EXIT=0`, `suite_113 → 12 casos nuevos`. Si un cambio no tiene
prueba, dilo explícitamente (`sin prueba — cambio de documentación`); una celda vacía
no se distingue de un olvido.
| 2026-09-09 | alt-ide/multi-ide-workflow-2026-09-09 | Trae (entorno 2) | — | vigilante_agenda.user.js, tests/suite_23_ux_telemetria.js, tests/suite_25_cascada_css.js, tests/suite_11_reportes.js, tests/suite_17_nucleo.js, REPLICA_TELEMETRIA/{worker.js,test_replica.mjs,README.md}, CHANGELOG.md, package.json, tests/INFORME_MUTACIONES.md | F1: merge de la rama perdida `claude/fix-css-permisos-notif` (v18.13.0–v18.14.0: mesa-expertos, palette, bolt, sentinel, CF wiring) CONSERVANDO la compuerta `CABLEADO_CF=false` (Piloto, D3-a) y el canal de versiones en GAS (D2-a); padrón D1-b→a (D1); E-2 horarios + guarda AA; telemetría C1/C2 desplegada y validada 9/9 | `node tests/runner.js` → 3795 pasan EXIT=0 · `node test_replica.mjs` → 62 ok EXIT=0 · suite_23 → 128 · suite_25 → 35 · worker en vivo 9/9 | pendiente revisión humana |
| 2026-09-09 | claude/merge-completion-formalize-26b88c | Claude Code (worktree aislado) | Sonnet 5 | vigilante_agenda.user.js, package.json, CHANGELOG.md, TABLERO/Codigo.gs, docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md, tests/INFORME_MUTACIONES.md, tests/suite_17_nucleo.js, tests/suite_67_panel_paciente.js, tests/suite_75_disco.js, tests/suite_78_acceso.js, tests/suite_81_barrera_ia.js, tests/suite_82_consentimiento.js, tests/suite_83_observabilidad.js | Reconciliación: esta rama estaba varada en un punto viejo (v18.3.6, divergida 2026-09-04 de la base compartida) sin el trabajo de F1; se fusionó `alt-ide/multi-ide-workflow-2026-09-09` (106 commits, hasta v18.14.0) resolviendo 33 conflictos en el userscript + 7 archivos más, preservando el modelo fail-open (v18.8.1) por encima de la lógica fail-closed/"fuera-del-padron" propia de esta rama (ya retirada aguas arriba) | `node tests/runner.js` → 3795 pasan EXIT=0 · `node tools/compat-check.js` → COMPATIBLE | pendiente revisión humana |
| 2026-09-09 | claude/merge-completion-formalize-26b88c | Claude Code (worktree aislado) | Sonnet 5 | vigilante_agenda.user.js, package.json, tests/suite_75_disco.js, tests/suite_15_interfaz_avanzada.js, TABLERO/Codigo.gs, tests/INFORME_MUTACIONES.md | Solicitud F, paso F2: la "SECCIÓN TÉCNICA" de Ajustes (Ctrl+Shift+D) ahora exige además `mtrEsDesarrollador()` (cap remota `desarrollador`, misma familia que `pym_opcional`) y se OMITE del HTML en vez de solo ocultarse con CSS (fail-closed real); semilla de producción actualizada para Brandon — requiere que el dueño añada `desarrollador` a mano en la hoja "acceso" YA EXISTENTE (la siembra automática solo corre en hoja nueva) | `node tests/runner.js` → 3795 pasan EXIT=0 · mutación en `isDevMode` verificada (roja 276/1, restaurada 277/0) · `compat-check` → COMPATIBLE (18.14.1) | pendiente revisión humana |
