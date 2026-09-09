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
