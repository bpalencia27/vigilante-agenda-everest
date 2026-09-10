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
