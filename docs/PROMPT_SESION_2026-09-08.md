# PROMPT DE DELEGACIÓN — Sesión nueva (2026-09-08)

> Escrito al cierre de la sesión anterior (job 60f8f919) por pedido explícito del médico:
> «finaliza lo que estés haciendo y crea un prompt de delegación de tareas, vamos a
> iniciar una nueva sesión desde el inicio por lo que necesito que le pongas todo lo que
> está pendiente dentro de él, no se puede perder nada, las tareas en cola quedarán para
> la sesión nueva, no debes terminarlo tú».
>
> **LEER COMPLETO ANTES DE EMPEZAR.** Todo lo pendiente está aquí. El trabajo sin cerrar
> quedó commiteado como WIP y pusheado (ver §4), nada se pierde.

## 1. Mandatos del médico vigentes

- Autonomía total mientras el médico está fuera (heredado: «no vuelvo hasta dentro de
  8 horas… tienes autonomía para realizar lo que sea necesario para el script»).
- Al terminar cada entrega: **gist + subir a GitHub** (publicar y pushear, nunca dejar
  trabajo solo local).
- Disciplina: mutación verificada + fila en `tests/INFORME_MUTACIONES.md` por cada
  cambio de comportamiento; bump de `@version` y `const VERSION` en cada entrega;
  banco `node tests/runner.js` EXIT=0; gist verificado byte a byte.
- Restricciones permanentes:
  - **Cero PHI** (sintéticos permitidos: DOC-1…, 1001112223, 1018888777,
    "PACIENTE PRUEBA", 5150076, 5150077; cero nombres/cédulas reales).
  - **La casilla del médico es sagrada**: nunca pisar texto que el médico escribió.
  - **El médico manda, el script sugiere**: nada sin clic explícito (excepción
    documentada caso a caso, v12.10.4).
  - Trabajar **SOLO en el worktree** (ver §2). NO tocar el WIP del checkout principal
    (hay un agente paralelo: no tocar `_*.txt`, `_pw_profile*/`, `AUDITORIA_*SEP*`).
  - Nunca push a main/master ni force-push. Usar `git -C "<ruta del worktree>"` explícito.

## 2. Entorno de trabajo

- **Worktree**: `E:\CENTINELA\vigilante-agenda-everest\.claude\worktrees\sf-v18.6.1-fix`
  (entrar con `EnterWorktree(path=…)`; si el worktree no existiera al arrancar —p. ej.
  fue limpiado—, recrearlo: `git worktree add .claude/worktrees/sf-v18.6.1-fix
  claude/sf-v18.6.1-fix` desde el checkout principal; el código WIP está pusheado, no
  hay nada que se pierda).
- **Rama de trabajo**: `claude/sf-v18.6.1-fix` (rastreada contra `origin/`).
- **Gist de producción**: `d231aab6f54de51a5c472b392aac1b91` (ficheros:
  `gistfile1.txt` = userscript, `gistfile2.txt` = novedades públicas en texto plano).
- **Proyecto**: userscript Tampermonkey IIFE único (~54K líneas, sin build, sin
  dependencias) sobre el EHR Everest (Athenea Soluciones), usado EN VIVO en consulta.
  Reglas CSS del CLAUDE.md (dos defensas + verificación Chromium) — leer el CLAUDE.md
  del worktree antes de tocar CSS.

## 3. Estado del banco y de las suites al corte

- v18.8.2 publicada en gist y verificada byte a byte (SHA-256 `689d276e…b010c9c`;
  banco 3644/3644 en 106 suites). Últimos commits publicados: `91d6cad` (widget) y
  `70c1d67` (acta).
- Suites del trabajo en curso, TODAS VERDES al corte: suite_82 24/24 (términos),
  suite_17 59/59 (núcleo + guía), suite_78 37/37, suite_80 9/9.

## 4. Estado exacto del trabajo (qué está hecho y qué falta)

Hay un **commit WIP pusheado** en `claude/sf-v18.6.1-fix` con todo lo siguiente
(implementado y probado, PERO SIN DOCUMENTAR NI CERRAR):

### 4.1 PEDIDO 1 — Términos: almacenamiento de por vida (HECHO, falta solo documentar)

Pedido del médico: «Implementa un almacenamiento persistente de por vida (lifetime)
para el estado de aceptación de los términos. Actualmente, el modal de aceptación
vuelve a aparecer cada vez que se actualiza el script…».

- **Causa raíz resuelta**: la constancia vivía solo en GM storage, y Tampermonkey
  descarta el GM del script anterior al actualizar recreando el userscript. Solución:
  **doble residencia GM + localStorage del origen de Everest** (sobrevive a las
  actualizaciones) con rescate y autorreparación mutua.
- Implementado en `vigilante_agenda.user.js` (~L39093+): constantes
  `TERMINOS_LS_ACEPTA` / `TERMINOS_LS_RECHAZO`, helpers `mtrTerminosLsLeer` /
  `mtrTerminosLsGuardar` / `mtrTerminosLsBorrar`; `mtrConsentimientoConstancia()`
  autorrepara LS desde GM válida y rescata GM desde LS; `mtrTerminosRechazoFresco()`
  con fallback LS; `_terminosAlAceptar` / `_terminosAlRechazar` siembran ambos
  almacenes. `TERMINOS_VERSION` = "1.4"; constancia `{version, ts, id}` con id
  anónimo (`uid:N` / `login:x` del MÉDICO, cero PHI).
- **Verificado**: suite_82 24/24; 2 mutaciones ya ejecutadas y confirmadas (M1
  escritura-LS, M2 rescate-LS). Si se necesitan los textos exactos de las
  afirmaciones rojas, re-aplicar cada mutación (romper → correr suite_82 → capturar
  «obtuvo» → restaurar) o leer el transcript de la sesión anterior (§7).
- **FALTA**: las 2 filas en `tests/INFORME_MUTACIONES.md` (M1, M2) — en el cierre §5-T2.

### 4.2 PEDIDO 4 — Mini guía en el aviso de actualización (HECHO, falta solo documentar)

Pedido del médico: «El mensaje de actualización obligatoria… al presionar el botón
"Actualizar ahora" se abre el archivo raw del gist… Implemente una mini guía integrada
dentro del mismo aviso…» (requisitos: concisa para no técnicos, pasos numerados, tono
formal, ANTES de los pasos existentes, qué hacer tras abrirse el raw, alternativas
manual/arreglar botón, legible, complementar no reemplazar).

- Implementado en `_mostrarAvisoBloqueoVersion` (~L38151): card con par fijo AAA
  `#991b1b`/`#ffffff` (contraste 8,31:1 — también resuelve la ilegibilidad en tema
  oscuro), todos los hijos `color:#ffffff !important`, botón blanco/rojo, y un NUEVO
  bloque «guia» insertado ENTRE el botón y los pasos originales (texto: «¿El botón
  abrió una página con texto de programación…?», pasos 1–5 con Ctrl+A/C/V, Panel de
  Tampermonkey, «＋», Ctrl+S, F5, y alternativa «Utilidades → Buscar actualizaciones
  de userscripts»). Los pasos originales quedaron intactos debajo.
- **Verificado**: suite_17 59/59; 1 mutación ya ejecutada y confirmada (orden del
  card: botón → guía → pasos).
- **FALTA**: la fila de esa mutación en `tests/INFORME_MUTACIONES.md` — cierre §5-T2.

### 4.3 PEDIDO 2 — CSS de modales/avisos incl. el aviso del Anexo 5 (EN CURSO — T1)

Pedido del médico: «Soluciona la mezcla de estilos CSS de Everest Health que afecta a
los nuevos modales y avisos, incluyendo el del anexo 5. Asegúrate de que todos estos
elementos de interfaz tengan estilos aislados para evitar conflictos, rediseña su
UI/UX para que sean visualmente claros y funcionales, y garantiza que los mensajes de
notificaciones sean perfectamente legibles y visibles para el usuario.»

**Análisis heredado (ya hecho, no rehacer):**

- El «aviso del Anexo 5» = `hcAnexo5Render()` (~L15359–L15440, llamada en L37497;
  toggle `tog_anexo5` ~L9971). Es el panel F1 que aparece al abrir la HC con el estado
  del programa RCV.
- **El panel `#vgl-a5-panel` se monta DENTRO de `#vgl-root`** (L15379), así que NO
  necesita la defensa de los modales pegados a body; su problema real es el **tema
  oscuro**: usa colores duros casi negros que se vuelven ilegibles sobre fondo oscuro.
  Colores actuales a reemplazar por variables de tema (definiciones en L18886–L18890
  tema oscuro y L18988–L18989 tema claro):
  - título `color:#0F172A !important` → `var(--fg1)` (o la fg equivalente)
  - abandono `#B91C1C` → `var(--c-rojo)`
  - ámbar `#B45309` → `var(--c-ambar)`
  - azul `#1D4ED8` → `var(--c-azul)`
  - verde `#15803D` → `var(--c-verde)`
  - texto suelto `#334155` → `var(--fg2)`; cierre/contexto `#64748B` → fg apropiada
  - fondo `rgba(15,23,42,.03)` → `var(--surface-2)`; borde `rgba(15,23,42,.15)` →
    `var(--line)`; `border-left:4px` mantener el acento semántico.
  - el `font-size:12px` literal → `var(--t-small)` (Regla G prohíbe font-size
    literales en CSS nuevo).
  - Mantener los `!important` LITERALES inline (comentario «Regla R» en el propio
    código, L15395–15397) y **actualizar el contrato del censo de la Regla G de
    suite_25** si cambia el conteo (contrato actual: 668 `!important` en texto crudo).
- El aviso de bloqueo de versión (`_mostrarAvisoBloqueoVersion`) ya quedó resuelto
  como parte del pedido 4 (par AAA, ver 4.2) — no re-hacerlo.

**Pasos pendientes de T1 (en orden):**

1. Rediseñar `hcAnexo5Render()` con las variables de tema (§4.3 arriba), manteniendo
   estructura, roles ARIA, `_vglA5Cerrados`/`_vglA5Anunciado` y el aria-live intactos.
2. Auditar el resto de modales/avisos pegados a `document.body` listados en CLAUDE.md:
   `#vgl-pym-modal`, `#vgl-pes-modal`, `#vgl-labs-modal`, `#vgl-labsv-modal`,
   `#vgl-postcita-panel`, `#vgl-agendar-modal`, `#vgl-ordenar-modal`, más las
   notificaciones toast/avisos y `_mostrarAvisoPausaClinica`. Aplicar las dos defensas:
   clase con color → `!important`; texto suelto sin clase → blindaje
   `:where(sel :not([class])){color:inherit}`. NUNCA `sel b,span,div{color:inherit}`
   a pelo (reintroduce el bug #1 del CLAUDE.md).
3. Verificar en **Chromium contra el CSS real** (Playwright), patrón de
   `docs/herramientas/chromium_102.py` (copiado desde el tmp del job anterior):
   cargar el userscript con `tests/harness.js`, invocar la función que genera el HTML
   del modal/aviso, extraer el `<style>` real, montarlo en una página de prueba con un
   CSS «Everest» simulado agresivo `div,span,p,b,small,label,button{color:X !important}`
   — el color esperado debe sobrevivir.
4. Regresión `node tests/runner.js suite_25` (Regla G: censo de `!important` y
   prohibición de font-size literales — ajustar contrato y documentar si el conteo
   cambia).
5. **Mutación(es) verificada(s)** del pedido 2 (p. ej. romper un `var(--c-rojo)`
   nuevo y ver la prueba correspondiente roja) + filas en `tests/INFORME_MUTACIONES.md`.
6. Banco completo EXIT=0 antes del cierre.

## 5. TAREAS — en orden estricto

- **T1 — Terminar el pedido 2 (§4.3)**, con mutaciones verificadas y filas.
- **T2 — Cierre v18.8.3** (UNA sola entrega con pedidos 1+2+4):
  1. `tests/INFORME_MUTACIONES.md`: filas de M1 (términos-escritura-LS), M2
     (términos-rescate-LS), mutación del orden de la guía (pedido 4), y las del
     pedido 2 (T1). Formato de las filas existentes; si faltara el detalle exacto de
     una mutación ya ejecutada, re-aplicarla y capturar «obtuvo» (o transcript §7).
  2. `CHANGELOG.md`: sección 18.8.3 (términos de por vida, mini guía del aviso de
     actualización, blindaje/rediseño CSS de modales y avisos incl. Anexo 5).
  3. `docs/REGISTRO_DECISIONES.md`: fila de decisión (términos lifetime + guía + CSS)
     y, tras publicar, fila de publicación con hashes (formato de las filas previas,
     p. ej. la de v18.8.2).
  4. **Bump de versión en 4 puntos** (verificados al corte):
     - `vigilante_agenda.user.js` L4: `// @version      18.8.3`
     - `vigilante_agenda.user.js` L1040: `const VERSION = … || "18.8.3"`
     - `package.json` L3: `"version": "18.8.3"`
     - `tests/suite_75_disco.js` L924: `t.igual(fila.ver, "18.8.3", "versión viva")`
  5. Banco completo `node tests/runner.js` (en el worktree) EXIT=0; registrar el total.
  6. Commit + push en el worktree (rama `claude/sf-v18.6.1-fix`).
  7. **Publicar al gist**: actualizar `gistfile1.txt` (userscript) y `gistfile2.txt`
     (novedades públicas; modelo: `docs/herramientas/gistfile2_nueva.txt`). PATCH vía
     `gh api --method PATCH gists/d231aab6f54de51a5c472b392aac1b91 --input payload.json`
     (payload con python; referencia: `docs/herramientas/armar_payload_gist.js`).
     **ATENCIÓN** (gotchas de §6): la API lista `content` truncado (`truncated:true`)
     → para verificar bajar por raw URL (con hash de revisión si es necesario);
     comparar **SHA-256 byte a byte** con cache-bust `?cb=$(date +%s)`; en Windows
     `sha256sum` agrega `\` al hash local — ignorarlo. Incluir el total del banco en
     las novedades.
  8. Fila de publicación en `REGISTRO_DECISIONES.md` con los SHA-256 local/remoto
     idénticos.
- **T3 — Cola posterior (NO empezar antes de publicar 18.8.3):**
  - #26 P1·A: rotación del token del tablero.
  - #27 P1·B: respaldo exportable.
  - #28 P1·C: migrar el cifrado XOR → AES-GCM.
  - #6: FF del checkout principal — **BLOQUEADA** por el WIP del agente paralelo
    (archivos `_*.txt`, `_pw_profile*/`, `AUDITORIA_*SEP*`): no tocar.

## 6. Gotchas técnicos (aprendidos; no repetir estos errores)

- **Harness** (`tests/harness.js`): `win.localStorage = storage` (~L109) respaldado en
  `env.almacen`; el mock de `setItem` **NO stringifica** — el código del userscript
  guarda `JSON.stringify(valor)`, así que las pruebas siembran `JSON.stringify({…})`
  en `env.almacen` y hacen `JSON.parse` al asertar. `GM_getValue` lee de `env.gm`
  (objeto crudo). Console silenciado.
- **Runner**: `node tests/runner.js [filtro-por-subcadena]`. La salida lleva ANSI:
  resumen con `grep -aE "pasan|FALLAN"`, detalle de fallos con `grep -a "obtuvo"`.
  En Git Bash los acentos salen como mojibake en consola, pero los archivos son UTF-8
  correctos: usar Read/Edit con el texto real, no grep -o de acentos.
- **Gist**: la API lista `content` truncado (`truncated:true`) → bajar por la raw URL
  con hash de revisión (`raw/<hash>/gistfile1.txt`). Cache-bust obligatorio para
  esquivar la caché. `sha256sum` de Git Bash en Windows agrega `\` al hash local
  (ignorar ese sufijo).
- **Regla G de suite_25**: censa los `!important` del texto crudo (contrato actual
  668) y prohíbe font-size literales en CSS nuevo. Si un cambio mueve el conteo,
  ajustar el contrato en la suite Y documentarlo en el informe.
- **Mutación verificada** (disciplina obligatoria): romper el cambio a propósito →
  confirmar que una prueba específica se pone roja → restaurar → confirmar verde →
  fila en `tests/INFORME_MUTACIONES.md`.
- **CSS**: fuera de `#vgl-root`, toda regla de color con clase lleva `!important` sin
  excepción; texto suelto sin clase usa `:where(…:not([class])){color:inherit}`;
  dentro de `#vgl-root`, preferir variables de tema y nunca colores duros
  claros/oscuros que no sobrevivan a ambos temas.

## 7. Recursos y rutas

- Transcript completo de la sesión anterior (detalles exactos de mutaciones,
  verificaciones y decisiones): `C:\Users\brand\.claude\projects\E--CENTINELA-vigilante-agenda-everest\60f8f919-92e4-4991-8e1f-ff047fa85386.jsonl`
- Memoria del proyecto (auto-memory, se carga sola): `C:\Users\brand\.claude\projects\E--CENTINELA-vigilante-agenda-everest\memory\MEMORY.md`
- Tmp del job anterior (puede desaparecer al eliminar el job; las herramientas clave
  ya están copiadas en `docs/herramientas/`): `C:\Users\brand\.claude\jobs\60f8f919\tmp\`
- Contexto adicional en `docs/`: `BACKLOG_PENDIENTE_20260828.md`, `BITACORA_20260901.md`, `DECISIONES_CLINICAS_VIGENTES.md`.
