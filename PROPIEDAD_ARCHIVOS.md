# Contrato de propiedad de archivos

> Gobierna todo trabajo concurrente sobre `vigilante-agenda-everest`.
> **Este documento se pega íntegro dentro del prompt de cada satélite.** No es documentación:
> es una cláusula ejecutable, y su cumplimiento se verifica con un comando, no con un juicio.

---

## 1. La regla

`vigilante_agenda.user.js` son ~14.000 líneas en un único IIFE. **Dos ramas que lo editan a la vez producen conflicto en casi cada hunk, y las fusiones que salen limpias mienten**: la rama A añade una guarda antes de escribir en una casilla clínica, la rama B refactoriza la ruta de escritura, git fusiona ambas sin quejarse y la guarda ya no guarda nada.

Por eso:

> ### Solo el TRONCO modifica el código de producción. Ninguna satélite. Nunca.
> ### Los hallazgos viajan como **pruebas rojas** o como **datos**, no como parches.

Una satélite que encuentra un bug **no lo arregla**. Emite la prueba que falla y lo demuestra, o el dato que lo especifica. El tronco pone las rojas en verde.

Un parche es una afirmación. Una prueba roja es una demostración: el tronco no necesita confiar en el criterio de la satélite, la ejecuta y la ve fallar.

---

## 2. Columnas

| Rama | Puede crear/modificar | Prohibido |
|---|---|---|
| **TRONCO** (`feat/motor-portado` sobre `claude/v14-continuacion`) | `vigilante_agenda.user.js`, `vigilante_centinela.user.js`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `tools/**`, y los `.md` **en la raíz de `docs/`** (`docs/MAPA_v14.md`, `docs/DEUDA_v14.md`, `docs/PRODUCTION_READINESS_REVIEW.md`, `docs/MOTOR_PORTADO.md`, `docs/DEUDA_BANDERA.md`) | los subdirectorios `docs/clinica/`, `docs/seguridad/`, `docs/operacion/`, `docs/fuentes/` |
| **S0** arqueología | `docs/RAMAS.md` | **todo lo demás**, incluido cualquier código |
| **S2** banco | `tests/suite_*.js`, `tests/harness.js`, `tests/runner.js`, `tests/mutantes/**`, `tests/LEEME_PRUEBAS.md`, `tests/INFORME_MUTACIONES.md` | userscript, `tests/fixtures/**`, `e2e/**` |
| **S3** frontera real | `e2e/**`, `tests/fixtures/**`, `CONTRATO_DOM.json` | userscript, `tests/suite_*.js` |
| **S4** clínica | `docs/clinica/**`, `docs/fuentes/**` | **todo código, sin excepción** |
| **S5** seguridad | `docs/seguridad/**`, `.gitignore`, `.github/workflows/**` | userscript, `tests/suite_*.js` |
| **S6** operación | `docs/operacion/**`, `CHANGELOG.md` | userscript, `tests/**` |

**Todas** pueden escribir además en:

- `tests/rojas/**` — la cola de pruebas rojas hacia el tronco *(excepto S0 y S4, que no escriben código; ver §4)*.
- `docs/cambios-pendientes/**` — órdenes de cambio.
- Su propio directorio bajo `.agents/`.

**Todas** pueden **leer** cualquier cosa del repositorio, incluido el userscript. Leer nunca está restringido.

**Regla de `docs/`:** la raíz de `docs/` es del tronco; **cada subdirectorio pertenece a una sola satélite**. Nadie escribe en el subdirectorio de otra. Si dos necesitan aportar al mismo documento, la dueña del subdirectorio lo redacta y la otra le entrega su parte por orden de cambio.

### Por qué S4 no puede escribir código

No es burocracia. S4 es el agente que verifica códigos CUPS, cortes KDIGO y coeficientes de fórmulas: **es el que más daño hace si alucina un valor**. Aislarlo de la escritura significa que su peor fallo posible es un documento equivocado que un humano revisa, no un código equivocado que corre en consulta. Ya costó un error de un dígito (HbA1c `903426` escrito `904426`).

---

## 3. Verificación mecánica

Antes de entregar, cada satélite ejecuta esto y pega la salida en su `handoff.md`:

```bash
# Archivos tocados respecto al tronco
git diff --name-only $(git merge-base HEAD rc/v14.1.4) HEAD
```

Cada línea de esa salida debe caer dentro de la columna de la satélite o en la zona común de §2. **Una sola línea fuera = fallo de compuerta**, igual que una prueba que no compila. No es una valoración: es una comparación de cadenas.

Comprobación adicional obligatoria, porque es el error que más daño hace:

```bash
# Tiene que salir vacío en TODA satélite
git diff --name-only $(git merge-base HEAD rc/v14.1.4) HEAD -- vigilante_agenda.user.js vigilante_centinela.user.js
```

---

## 4. Cómo viaja un hallazgo al tronco

### Vía A — Prueba roja *(la vía por defecto)*

La satélite escribe en `tests/rojas/NNN-<slug>.js` una prueba que **falla contra el código actual** y describe el comportamiento correcto. Junto a ella, `tests/rojas/NNN-<slug>.md` con:

- **Qué está mal**, en una frase.
- **Cómo reproducirlo**: comando exacto + salida verbatim del fallo.
- **Qué línea de producción la pone verde** — la satélite no la cambia, pero sí dice cuál cree que es.
- **Consecuencia clínica**: qué le pasa al paciente si esto llega a consulta. Si la respuesta es "nada", ver §6.

El tronco la ejecuta, la ve fallar, arregla, y la ve pasar. Entonces la mueve a la suite que corresponda.

> **Si una prueba roja pasa a la primera sin tocar el código, se devuelve a la satélite.**
> O el bug no existía, o la prueba está mal escrita. Las dos cosas hay que saberlas.

### Vía B — Dato *(para S0 y S4, que no escriben código)*

La satélite emite el hallazgo como **datos legibles por máquina** en su propia columna: `docs/clinica/ESPECIFICACION_CLINICA.json`, `docs/clinica/DISCREPANCIAS.json`, `CONTRATO_DOM.json`. **S2 genera la prueba a partir de esos datos**; el tronco la pone verde.

Esto conserva la propiedad de seguridad (S4 no toca código) y a la vez hace el hallazgo ejecutable. La especificación firmada se convierte, literalmente, en la prueba.

### Vía C — Orden de cambio *(excepcional)*

Solo cuando el cambio **no se puede expresar como prueba**: renombrar algo, mover un bloque, retirar código muerto, cambiar un comentario. Se escribe en `docs/cambios-pendientes/NNN-<slug>.md`:

- Diff propuesto, en formato aplicable.
- Razón, y por qué no cabe como prueba.
- Riesgo de aplicarlo, y qué prueba existente lo cubre.

El tronco la aplica **o la rechaza con motivo escrito**. Una orden de cambio rechazada no se reintenta sin argumento nuevo.

---

## 5. Cadencia

- **Rebase diario** de cada satélite sobre el tronco: `git fetch && git rebase rc/v14.1.4`. Como ninguna toca el userscript, el rebase es trivial siempre. Si un rebase da conflicto, es señal de que alguien salió de su columna — investígalo, no lo resuelvas a mano.
- **El tronco vacía la cola de rojas en lotes pequeños y frecuentes**, no al final.
- **No hay "gran fusión".** El Victory Auditor del PRR *verifica*; no *integra*. Si llega al final con trabajo pendiente de integrar, algo se hizo mal semanas antes.

---

## 6. Regla de triaje — qué NO se arregla en este release

Un hallazgo que **no** puede:

- escribir un dato equivocado en la historia clínica,
- ordenar el examen equivocado o dejar de ordenar el necesario,
- crear, mover o borrar una cita equivocada,
- filtrar datos de pacientes,
- ni tumbar Everest o el equipo del médico,

**no se arregla ahora**: va a `BACKLOG_MEJORAS.md` con su evidencia. Incluye estética, refactores, cobertura de funciones de riesgo BAJO y deuda técnica no bloqueante.

Esto no es pereza. Cada cambio en el userscript es riesgo, y el riesgo solo se justifica contra una de las cinco consecuencias de arriba.

---

## 7. Compuerta de integración

Una satélite entrega al tronco cuando **todo** se cumple:

1. `npm test` en verde en su rama, **incluidas sus pruebas nuevas**, y las de `tests/rojas/` fallando **por la razón documentada**.
2. La verificación mecánica de §3 sale limpia: **ningún archivo fuera de su columna**.
3. Rebase limpio sobre el tronco.
4. Sus 2 Reviewers + 2 Challengers + 1 Auditor en verde, **cada uno con su propia salida verbatim**. Ningún revisor firma sobre el reporte de otro: si no lo ejecutó él, no lo aprueba.
5. Todo hallazgo lleva su consecuencia clínica declarada, o está en el backlog por §6.

---

## 8. Reglas duras comunes a todas las ramas

- **Nunca** enviar, versionar ni incluir datos de pacientes: ni en pruebas, fixtures, logs, informes, capturas o commits. Si necesitas datos realistas, **genéralos sintéticos**.
- **Prohibido validar un código CUPS, un umbral clínico o una fórmula contra el conocimiento del modelo.** Solo cuenta lo contrastado contra un archivo de `docs/fuentes/`. Lo demás se marca `⚠️ SIN VERIFICAR` aunque el agente esté seguro.
- Toda afirmación cuantitativa va con el comando y su salida verbatim. **Cero cifras de memoria.**
- Cero `skip`, cero `xfail`, cero `assert true`, cero pruebas vacías, cero mocks-fachada.
- `tests/` se mantiene **sin dependencias externas** (Node puro). Playwright vive en `e2e/`.
- Si algo es **inviable de probar** en el entorno simulado, decirlo explícitamente en vez de escribir una prueba que pase sin ejercitar nada.
- Si un requisito choca con la seguridad del paciente, **gana el paciente**: para, documenta el conflicto y escala.
- **No borrar ramas.** Nunca. Eso lo decide el usuario.
- Commits en español, un cambio por commit: `feat:` `fix:` `perf:` `test:` `docs:` `chore:` `seguridad:`.
