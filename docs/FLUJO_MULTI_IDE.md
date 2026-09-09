# Flujo de trabajo multi-IDE (dos entornos, un solo producto)

> **Fecha:** 2026-09-09 · **Rama de este trabajo:** `alt-ide/multi-ide-workflow-2026-09-09`
> **Motivo:** el mismo repositorio se trabaja desde este IDE y desde un IDE alternativo
> con otros modelos. Sin reglas explícitas, los dos editan el mismo archivo, cada uno
> corre el banco en verde y el conflicto aparece al fusionar — cuando ya nadie recuerda
> qué se quería cambiar.

Este documento es el **contrato** entre entornos. Lo automatizado vive en `tools/`;
lo que exige criterio humano está marcado como tal y **no se finge que esté automatizado**.

---

## 1. Ramas: un carril por entorno

| Carril | Prefijo | Quién escribe |
|---|---|---|
| Producción | `main` | Nadie directamente. Solo recibe fusiones con compuerta (§2). |
| Base congelada | `claude/pym-agenda-blindaje-v12-4` | Nadie. HEAD inmutable (ver `ESTADO_RAMAS.md`). |
| Entorno de este IDE | `claude/*`, `trae/*` | Este entorno. |
| **Entorno alterno** | `alt-ide/*` | El IDE alternativo y sus modelos. |
| Agentes nocturnos | `bolt/*`, `palette/*`, `sentinel/*`, `jules/*` | Ya existían; siguen sus propias reglas (`.deepseek/`, `.jules/`). |

Reglas de merge que evitan sobrescrituras:

1. **Una rama, un cambio.** Formato `<prefijo>/<mejora>-<YYYY-MM-DD>`.
2. **Ningún carril fusiona en el otro.** Siempre se pasa por la base y por la compuerta.
3. **Prohibido `git push --force`** sobre `main` o sobre la base congelada.
4. **`git rebase` solo en la rama propia**, nunca en una rama ajena ni en la base.
5. Si dos carriles tocan el mismo archivo, decide el **candado** (§4), no el orden de llegada.

---

## 2. Compuerta de fusión (protocolo de sincronización segura)

Ningún cambio cruza de carril sin pasar **cuatro** compuertas, en este orden:

```bash
node tools/vgl-sync.js gate --from=alt-ide/<rama> --base=claude/pym-agenda-blindaje-v12-4 \
     --env=<tu-entorno> --reviewed-by=<quien-revisó>
```

| # | Compuerta | Qué comprueba | Automática |
|---|---|---|---|
| 1 | `candados` | Ningún archivo cambiado lo tiene otro entorno | Sí |
| 2 | `banco` | `node tests/runner.js` completo, exit 0 y `0 fallan` | Sí |
| 3 | `registro` | La rama aparece en `docs/REGISTRO_CAMBIOS_ENTORNOS.md` | Sí |
| 4 | `revision` | Alguien declaró la revisión manual (`--reviewed-by`) | **No** (se declara, no se demuestra) |

Sale `PASA`/`NO PASA` y exit 0/1. La compuerta **no escribe nada** en tu árbol.
Si el banco no imprime su cuenta (`comprobaciones : N pasan`), la compuerta falla:
un runner que muere en silencio no es un runner verde.

---

## 3. Registro de trazabilidad

Archivo: [`docs/REGISTRO_CAMBIOS_ENTORNOS.md`](REGISTRO_CAMBIOS_ENTORNOS.md).

Una fila por cambio: **fecha · rama · entorno · modelo · archivos · qué se hizo ·
pruebas ejecutadas · revisor**. La fila se añade **al final** (dos entornos añadiendo
filas producen un conflicto trivial: se conservan AMBAS, nunca se descarta la ajena).
La compuerta §2 exige que la rama esté mencionada ahí.

---

## 4. Candado de archivos (impide edición simultánea)

```bash
# identidad de este checkout (una vez, NO se versiona)
echo '{ "env": "trae", "model": "modelo-que-uses" }' > .vgl-env.json

# tomar un archivo
node tools/vgl-lock.js acquire vigilante_agenda.user.js --task="fix everest lento" --ttl=120

# ver el tablero / soltar / retirar vencidos
node tools/vgl-lock.js status
node tools/vgl-lock.js release vigilante_agenda.user.js
node tools/vgl-lock.js prune
```

- Estado: `.vgl-locks/<sha1(ruta)>[0..12].json`, **versionado** — el repositorio es el
  único canal compartido entre entornos. Un archivo por ruta ⇒ dos candados distintos
  nunca chocan entre sí.
- La clave normaliza mayúsculas y separadores: `.\Vigilante_Agenda.user.js` y
  `vigilante_agenda.user.js` son **el mismo** candado en Windows y en Linux.
- **Adquisición atómica:** o se toma el lote completo o no se toma nada.
- **Vencimiento:** por defecto 240 min. Un candado vencido no bloquea y `prune` lo retira.
- **FAIL-OPEN documentado:** si un candado no se puede leer (JSON corrupto), no bloquea.
  Un candado que impide trabajar por un bug propio es peor que el conflicto que evita.
  La única compuerta DURA es el `pre-commit` cuando el candado es legible y es ajeno.

### Instalación del hook (una vez por clon)

```bash
git config core.hooksPath .githooks
git update-index --chmod=+x .githooks/pre-commit   # solo en clones POSIX
```

`.gitattributes` fuerza `eol=lf` en `.githooks/**`: con `core.autocrlf=true` un `\r`
al final del shebang deja el hook sin arrancar.

---

## 5. Compatibilidad entre entornos

```bash
node tools/compat-check.js          # tabla legible
node tools/compat-check.js --json   # para máquinas
```

Puntos **duros** (exit 1 si fallan): Node ≥ 18 · versión sincronizada en sus 4 puntos
(`@version`, `const VERSION`, `package.json`, literal de `suite_75_disco.js`) ·
cero dependencias de runtime · userscript sin `import`/`export` · CI con `MIN_COVERAGE`
y `TZ=America/Bogota` · `tests/runner.js` presente.
Avisos (no rompen): prefijo de rama desconocido · `package.json` sin `engines.node`.

---

## 6. Pruebas periódicas de integración entre ramas

```bash
node tools/vgl-sync.js integrate --from=alt-ide/<rama> --base=claude/pym-agenda-blindaje-v12-4
```

Crea un **worktree desechable** en el directorio temporal, fusiona la rama alterna
sobre la base y corre el banco COMPLETO **sobre el resultado fusionado**. Nunca
escribe en tu rama actual. Si hay conflictos de texto, los nombra archivo por archivo;
si no los hay, la prueba real es el banco sobre la fusión. Se borra al terminar
(`--keep` lo conserva para inspección).

Cadencia recomendada: **antes de cada compuerta §2** y al menos una vez al día
mientras los dos carriles estén activos.

---

## 7. Puesta en marcha, paso a paso

```bash
# 1. identidad local (no versionada)
echo '{ "env": "alt-ide", "model": "<modelo>" }' > .vgl-env.json

# 2. hooks
git config core.hooksPath .githooks

# 3. rama del carril
git switch -c alt-ide/<mejora>-2026-09-09

# 4. tomar el archivo ANTES de editarlo
node tools/vgl-lock.js acquire vigilante_agenda.user.js

# 5. editar, luego:
node tools/compat-check.js
node tests/runner.js

# 6. registrar el cambio (§3) y pedir revisión manual

# 7. compuerta de fusión (§2)
node tools/vgl-sync.js gate --from=alt-ide/<mejora>-2026-09-09 --reviewed-by=<quien>

# 8. integración contra la base (§6)
node tools/vgl-sync.js integrate --from=alt-ide/<mejora>-2026-09-09

# 9. soltar el candado
node tools/vgl-lock.js release vigilante_agenda.user.js
```

---

## 8. Lo que este flujo NO automatiza (y no se finge)

- **La revisión humana.** `--reviewed-by` deja constancia de quién revisó; no prueba
  que revisó bien. Eso es criterio, no script.
- **Los conflictos semánticos.** `integrate` detecta conflictos de texto y mide el banco
  sobre la fusión; dos cambios que compilan y pasan pruebas pero se contradicen en
  clínica siguen necesitando ojo humano.
- **El despliegue.** Fusionar a `main` no publica nada: el userscript se actualiza
  **a mano** en el Gist secreto (`CONTRIBUTING.md`).

---

## 9. Los 3 skills de TRAE: dónde encajan, qué exigen y cómo se verifican

Los tres skills pedidos **no se insertan en el código del producto**: son protocolos de
trabajo del agente. Lo que sí se inserta son sus **artefactos**, y van todos en rutas
ignoradas por git para no ensuciar el repo (`AGENTS.md`, higiene del repositorio).

| Skill | Ubicación del skill | Requisitos previos | Artefacto que deja | ¿Aplica a este repo? |
|---|---|---|---|---|
| `TRAE-code-review` | `~/.trae/builtin_skills/TRAE-code-review` | Un **diff** (`git diff <base>...<rama>`) y la rama resuelta | Tabla de hallazgos en la respuesta; no escribe archivos | **Sí** |
| `TRAE-debugger` | `~/.trae/builtin_skills/TRAE-debugger` | Node + Debug Server del skill (localhost); un bug **reproducible** | `debug-<sessionId>.md` + `trae-debug-log-<sessionId>.ndjson` (ignorados por git) | **Sí** (para «EVEREST ESTÁ LENTO») |
| `developing-with-streamlit` | `~/.agents/skills/developing-with-streamlit` | Python + paquete `streamlit >= 1.57` en el proyecto | — | **NO** |

**Por qué `developing-with-streamlit` no aplica:** verificado el 2026-09-09,
`grep -ri streamlit` sobre el repo devuelve **cero** coincidencias. El producto es un
userscript Tampermonkey de un solo archivo (sin build, sin Python de aplicación). El
sustituto correcto para «verificar que un estilo se ve bien» en este proyecto no es
Streamlit, es lo que ya manda `AGENTS.md`: `tests/harness.js` + `buildOverlay()` y
`getComputedStyle(...)` sobre Chromium vía Playwright.

### Dependencias entre los tres (para ejecutarlos «a la vez» sin chocar)

```
TRAE-debugger  →  evidencia de runtime  →  fix mínimo
      │                                        │
      └──────────► TRAE-code-review ◄──────────┘   (revisa el diff del fix)
                          │
                          └──► node tests/runner.js  (banco del proyecto)
developing-with-streamlit  —  fuera de alcance (no hay Streamlit)
```

No son tres procesos concurrentes sobre los mismos ficheros: son **tres fases** con
un punto de contacto común (el diff). Ejecutarlos «simultáneamente» de forma segura
significa: (a) el candado §4 impide que dos entornos editen el mismo archivo a la vez;
(b) el debugger solo escribe `debug-*.md` (ignorado) y la instrumentación temporal
dentro del archivo **bajo candado**; (c) el code-review **solo lee**.

### Verificación de que los tres «operan correctamente al mismo tiempo»

```bash
# (1) el candado está tomado por ti, no por el otro entorno
node tools/vgl-lock.js status

# (2) el debugger dejó su sesión abierta y el servidor responde
ls debug-*.md
curl -s http://127.0.0.1:8787/health

# (3) el code-review tiene un diff real que revisar (no vacío)
git diff --stat <base>...HEAD

# (4) el tercero no aplica: se comprueba en vez de suponerse
grep -ri streamlit --include=*.json --include=*.js -l . | wc -l   # esperado: 0

# (5) cierre: banco del proyecto y compatibilidad
node tools/compat-check.js && node tests/runner.js
```

Si (1) muestra el candado de otro entorno, **no** se edita: se pide el relevo o se
espera el vencimiento. Ese es el único caso en que dos entornos sí se estorban, y es
exactamente el que el candado convierte en un mensaje claro en vez de un conflicto.

### Ejemplo práctico completo (bug de UX + revisión, los dos skills que sí aplican)

```bash
# A. instrumentar (TRAE-debugger): primero hipótesis, luego logs — nunca al revés
node tools/vgl-lock.js acquire vigilante_agenda.user.js --task="everest lento"
#    → añadir instrumentación en región #region debug-point, reproducir, leer /logs

# B. fix mínimo con evidencia, y borrar la instrumentación
node tests/runner.js

# C. revisar (TRAE-code-review) el diff del fix, con la evidencia como contexto
git diff --stat claude/pym-agenda-blindaje-v12-4...HEAD

# D. registrar (§3) y pasar la compuerta (§2)
node tools/vgl-sync.js gate --from=alt-ide/everest-lento-2026-09-09 --reviewed-by=<quien>
```

---

## 10. Archivos de este flujo

| Archivo | Rol |
|---|---|
| `tools/vgl-lock.js` | Candado: `acquire` · `release` · `status` · `check --staged` · `prune` |
| `tools/vgl-sync.js` | Compuerta `gate` y prueba de integración `integrate` |
| `tools/compat-check.js` | Deriva entre entornos (versión, deps, estándares) |
| `.githooks/pre-commit` | Bloquea el commit de un archivo con candado ajeno |
| `.gitattributes` | `eol=lf` en los hooks (shebang) |
| `.vgl-locks/` | Estado del candado (**versionado**) |
| `.vgl-env.json` | Identidad local del entorno (**ignorado**) |
| `tests/suite_113_multi_ide.js` | Pruebas del flujo (se ejecuta solo en `npm test`) |
