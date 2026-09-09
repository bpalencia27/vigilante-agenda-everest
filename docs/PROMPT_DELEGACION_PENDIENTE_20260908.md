# PROMPT DE DELEGACIÓN — Trabajo pendiente del Vigilante de Agenda (2026-09-08)

> Documento de encargo para otra instancia/sesión de un LLM (Claude Code, u otro
> agente con acceso a shell + git). Léelo completo antes de tocar nada: la
> sección 0 describe un incidente reciente que cambia qué carpeta es segura
> usar.

---

## 0. INCIDENTE DE ENTORNO — LEER PRIMERO (crítico, no saltar)

El 2026-09-08 a las ~17:45 (hora local), el árbol de trabajo original del
proyecto se vació por completo (coincidió al minuto con un auto-reinicio del
daemon de Claude Code por actualización de binario; causa exacta no
confirmada, pero el efecto es total y verificado):

- **`E:\CENTINELA\vigilante-agenda-everest`** (el checkout principal, NO
  worktree) — **YA NO ES UN REPOSITORIO GIT.** `.git` desapareció. Está vacío
  salvo un puñado de archivos sueltos sin relación. **NO trabajes ahí. No lo
  reutilices. No intentes "reparar" ese directorio.**
- **`E:\CENTINELA\vigilante-agenda-everest\.claude\worktrees\sf-v18.6.1-fix`**
  (el worktree donde se trabajaba) — vacío igual, 0 archivos.

**La recuperación ya se hizo.** El repositorio íntegro vive ahora en:

```
E:\CENTINELA\vigilante-agenda-everest-restaurado
```

Es un `git clone` fresco desde `origin` (GitHub, `bpalencia27/vigilante-agenda-everest`),
rama `claude/sf-v18.6.1-fix`, verificado íntegro. **Trabaja EXCLUSIVAMENTE
ahí.** Todo el historial de commits hasta `b1ab189` (v18.10.0, el último
paquete publicado) está intacto — nada de lo commiteado y pusheado se perdió.

**Lo que SÍ se perdió (nunca se commiteó antes del vaciado) y por eso está
pendiente:** el trabajo de la ORDEN #8 (ver §2 abajo) — un fix ya diseñado,
codificado, con pruebas y mutaciones verificadas, pero jamás commiteado.
Hay que **rehacerlo desde cero** en el repo restaurado; el diseño ya está
resuelto y documentado abajo con precisión suficiente para no tener que
re-investigar nada, solo re-aplicarlo.

Verifica tú mismo el estado antes de empezar:
```bash
cd "E:/CENTINELA/vigilante-agenda-everest-restaurado"
git log --oneline -5        # debe mostrar b1ab189 en la punta
git status --short          # debe salir limpio
grep -m1 "@version" vigilante_agenda.user.js   # debe decir 18.10.0
node tests/runner.js 2>&1 | tail -5            # banco debe salir EXIT=0 (~3761 comprobaciones)
```

Insumos que sobrevivieron al vaciado (no están en git, pero siguen en disco;
reutilízalos, no los regeneres):
- `C:\Users\brand\AppData\Local\Temp\_base_piloto_sep.xlsx` (23,6 MB) — el
  libro real de la base piloto de la IPS, exportado el 2026-09-07. **Nunca
  subas este archivo a git ni lo publiques**: viene de un sistema clínico.
- `C:\Users\brand\.claude\jobs\60f8f919\tmp\auditar_reposo_a5.cjs` — el
  script que ya parsea ese xlsx (ZIP+XML, sin dependencias) para volcar
  encabezados/estructura de sus 12 hojas **sin tocar filas de pacientes**.
  Referencia de patrón; puedes reescribirlo si lo prefieres.

---

## 1. Contexto del proyecto (para no re-descubrir lo obvio)

`vigilante_agenda.user.js` es un userscript (Tampermonkey) de ~54.700 líneas,
IIFE único sin build, que corre EN VIVO durante consultas médicas reales sobre
el EHR **Everest/Athenea** (IPS Viva 1A, Colombia). Cero backend propio del
lado clínico (todo vive en el navegador del médico); sí existe un backend de
telemetría anónima propio: **Cloudflare Workers + D1**
(`REPLICA_TELEMETRIA/worker.js`, desplegado y en producción — reemplazó a un
Google Apps Script que se quedó sin cuota).

Reglas del proyecto que **debes seguir sin excepción** (verificadas por el
banco de pruebas y por convención de commits ya usada en cientos de entregas
anteriores — no las inventes distinto):

1. **Cero PHI.** Nunca un nombre real, cédula, ni dato identificable de
   paciente en código, comentarios, tests, docs ni mensajes de commit. Los
   moldes de prueba usan `"PACIENTE DE PRUEBA"` / `"MEDICO DE PRUEBA"` /
   documentos ficticios de 6-9 dígitos.
2. **Casilla vacía antes que dato inventado.** Si un valor no se puede leer o
   confirmar con evidencia real, se muestra vacío/ausente — nunca se rellena
   con un supuesto o un placeholder que parezca un dato real.
3. **El médico manda.** Ninguna función actúa por su cuenta sobre datos
   clínicos sin que el médico lo haya pedido con un clic explícito. Los
   cambios de comportamiento automático (polling, avisos) nunca escriben ni
   confirman nada por sí solos.
4. **Disciplina de mutación verificada.** Todo cambio de comportamiento en
   producción exige: (a) un caso de prueba nuevo o actualizado que lo cubra,
   (b) al menos **2 mutaciones** (romper la lógica a propósito, confirmar que
   la prueba se pone ROJA con el mensaje exacto esperado, restaurar, confirmar
   verde) documentadas como filas nuevas en `tests/INFORME_MUTACIONES.md`,
   (c) el banco completo en verde (`node tests/runner.js`, EXIT=0 real, nunca
   solo "no truena") antes de dar por cerrado el cambio.
5. **Versionado R5.1 (bump cuádruple sincronizado).** Cada entrega que cambia
   comportamiento sube la versión en LOS CUATRO puntos a la vez o el banco
   falla solo:
   - `// @version      X.Y.Z` (cabecera del userscript, línea ~4)
   - `const VERSION = (... ) || "X.Y.Z";` (línea ~1040, el respaldo sin
     `GM_info`)
   - `"version": "X.Y.Z"` en `package.json`
   - El fixture de `tests/suite_75_disco.js` que espera la "versión viva"
   El repo restaurado está en **18.10.0** — la próxima entrega que cambie
   comportamiento debe subir a **18.11.0** (o el siguiente minor libre; revisa
   que no exista ya antes de fijarlo).
6. **CRLF.** El userscript, `package.json`, la mayoría de `tests/*.js` y
   `docs/*.md` están en CRLF. Verifica el EOL de cada archivo antes de editar
   (`grep -c $'\r' archivo` o similar) y no mezcles finales de línea dentro
   del mismo archivo.
7. **Commits**: mensajes descriptivos en español, sin urgencia falsa, sin
   emojis salvo que el propio archivo ya los use (el CHANGELOG sí). Un commit
   por frente lógico (no mezclar dos órdenes distintas en un commit). Termina
   los mensajes de commit con la línea de atribución que te indique tu propio
   sistema (no la inventes tú).
8. **Publicación en gist.** El userscript se publica también en un Gist de
   GitHub (`d231aab6f54de51a5c472b392aac1b91`, 3 archivos:
   `gistfile1.txt`/`vigilante_agenda.user.js` con el fuente completo,
   `gistfile2.txt` con las novedades por versión más recientes primero,
   `PROBAR_CENTINELA.js` que NUNCA se toca). Al publicar: baja el
   `gistfile2.txt` actual, antepón el bloque de la versión nueva conservando
   el historial completo, sube el PATCH, y **verifica byte a byte** (SHA-256
   del fuente local normalizado CRLF→LF contra el remoto) antes de dar la
   entrega por cerrada. Herramientas de referencia en
   `docs/herramientas/armar_payload_gist.js`.
9. **Actas.** Cada decisión de diseño no trivial y cada publicación se
   registra como fila nueva (nunca editando una fila vieja) en
   `docs/REGISTRO_DECISIONES.md`. El `CHANGELOG.md` (raíz) se escribe en
   lenguaje llano para el médico, sin jerga técnica (hay una suite —
   `suite_36`-algo — que falla si detecta palabras como "DOM").

---

## 2. TAREA A — Rehacer la ORDEN #8 (perdida en el vaciado)

### 2.1 El encargo original del médico (transcrito, no resumido)

> «El profesional especializado en UI/UX, que ya ha sido asignado al
> proyecto, debe adicionalmente encargarse de:
> 1. Analizar y definir una ubicación óptima para el módulo de notificaciones
>    dentro de la interfaz de usuario, garantizando visibilidad sin
>    interrumpir la experiencia de flujo de trabajo, accesibilidad desde
>    todos los contextos del sistema, y cumplimiento con estándares de
>    usabilidad para sistemas integrados.
> 2. Diseñar y validar la posición y funcionalidad de la sección de reposo
>    correspondiente al anexo 5, asegurando que se integre de manera
>    coherente con la arquitectura visual existente, mantenga la coherencia
>    con el resto de componentes de la interfaz y cumpla con los
>    requerimientos funcionales del documento normativo.
> 3. Alinear toda la implementación de ambos elementos con los lineamientos,
>    requerimientos y estado actual de la base piloto, para garantizar la
>    sincronización total entre el diseño de interfaz y el funcionamiento del
>    entorno de pruebas.
> 4. Realizar pruebas de usabilidad para validar la ubicación seleccionada,
>    registrar métricas de interacción de los usuarios, ajustar la posición
>    en caso de detectar problemas de accesibilidad o usabilidad, y entregar
>    un informe final con las justificaciones de las ubicaciones elegidas y
>    los resultados de las pruebas de validación.»

Aclaración obtenida del médico en vivo cuando se le preguntó qué era la
"sección de reposo del anexo 5" (el término no existe en la UI ni en el
libro real — se verificó con el parser ZIP+XML contra las 12 hojas, 8.973
strings compartidos, cero coincidencias de "reposo"):

> «anexo 5 es una sección del excel de la base piloto la cual quedó
> registrado aparentemente en la auditoria exhaustiva que se realizo y se
> supone que deberia estar sincronizado al 100% con el vigilante_agenda_user.js»

**Conclusión de alcance ya fijada (no la reabras, ya se investigó a fondo):**
el punto 2 es sobre **sincronización de datos**, no de UI: qué columnas del
libro real "ANEXO 5 JULIO" (38 columnas, indexadas en
`docs/AUDITORIA_ARQUITECTURA_20260829.md` / la auditoría del 07-sep) el
userscript lee y muestra correctamente en el aviso del Anexo 5, y cuáles no.

### 2.2 El defecto encontrado (verificado con evidencia, listo para corregir)

El indexador del Anexo 5 (función que arma el mapa `docKey → registro
compacto` a partir de las filas del libro, hoy alrededor de
`function ... anexo5` — busca `MICROALBU` o `cSis`/`cDia`/`cCa` en el fuente
para ubicarla, las líneas exactas cambiaron tras el vaciado) lee **32 de 38**
columnas reales. La columna 33 —**el valor de laboratorio real de la RAC
(relación albúmina/creatinina), col. real del libro con el typo
`MICROALBU/CREATINURIA1`**— nunca se leía.

El aviso del Anexo 5 (función `a5AlertasDe`, busca `contexto:` y `rac:` en el
fuente) rotulaba el tramo "RAC" con **los PUNTOS de cumplimiento de la meta**
(campo `m[4][0]`, un entero de 0 a 25 que sale de
`CUMPLE_MICROALBUMINURIA`) **como si fueran el valor en mg/g**. Efecto
real: un paciente con 25 puntos de cumplimiento (meta lograda) podía leerse
en el aviso como «RAC 25» — 25 mg/g es un valor patológico, no un logro. El
defecto es de **confundir el puntaje de una meta con el resultado de
laboratorio que la meta mide**.

### 2.3 El fix ya diseñado (repítelo tal cual, ya está validado)

**A. En el indexador** (la función que construye el `Map` por `docKey` desde
las filas del Anexo 5, con `cSis`, `cDia`, `cCa`, `cA1c`, `cLdl`, `cGlu` ya
declarados por `findIndex` sobre columnas normalizadas):

```js
// Nueva columna, mismo patrón que las demás (busca por nombre normalizado,
// con el typo real del libro):
const cRac = norm.findIndex((x) => x === "MICROALBU_CREATINURIA1");

// El array `v` de valores de contexto pasa de 6 a 7 elementos:
const v = [
  cSis >= 0 ? num(row[cSis]) : 0,
  cDia >= 0 ? num(row[cDia]) : 0,
  cCa  >= 0 ? num(row[cCa])  : 0,
  cA1c >= 0 ? num(row[cA1c]) : 0,
  cLdl >= 0 ? num(row[cLdl]) : 0,
  cGlu >= 0 ? num(row[cGlu]) : 0,
  cRac >= 0 ? num(row[cRac]) : 0,   // v[6] — NUEVO: valor real de RAC en mg/g
];
```

**B. En `a5AlertasDe`** (donde arma `contexto` para el aviso):

```js
// v de respaldo pasa de 6 a 7 ceros:
const v = a.v || [0, 0, 0, 0, 0, 0, 0];

// ...
contexto: {
  // ...
  ldl: v[4] || 0, glu: v[5] || 0,
  // ANTES (defecto): rac: m[4] ? m[4][0] : 0,  ← puntos de la meta, NO el valor
  rac: v[6] || 0,                 // AHORA: valor real de laboratorio
  racFecha: m[4] ? m[4][1] : 0,   // la fecha de toma sigue viniendo de la meta (no cambia)
  // ...
}
```

Sin valor real indexado (`v[6] === 0`, típico de un registro viejo con el
paquete de datos en versión anterior, o de una fila del libro sin ese dato) →
el tramo del RAC en el aviso **no se pinta** (casilla vacía, regla del
proyecto). Nunca se vuelve a rotular el puntaje de la meta como si fuera el
valor.

**C. Empaquetado.** El registro del Anexo 5 se serializa completo con
`JSON.stringify` (no hay lista de campos fija que actualizar aparte); un
registro viejo en caché con `v` de 6 elementos simplemente da `v[6] ===
undefined → 0` hasta el próximo refresco — eso ya es el comportamiento
correcto sin cambios adicionales.

### 2.4 Pruebas a escribir/actualizar

Localiza las suites que ya cubren el indexador y el aviso del Anexo 5 (busca
`REC_A5`, `a5AlertasDe`, `hcAnexo5Render`, `anexo5.get` en `tests/*.js` — muy
probablemente `suite_91_hc_launch.js` y `suite_92_base_unica.js`, aunque los
nombres/números pudieron cambiar tras las entregas AB-1..AB-8 de v18.10.0;
verifica con `grep -rl "a5AlertasDe" tests/`).

Casos a añadir (mínimo):
1. Fixture del indexador con la columna `MICROALBU/CREATINURIA1` poblada
   (p. ej. valor `25`) → el registro trae `v[6] === 25` (o el valor decimal
   real, p. ej. `6.93` si el fixture usa mg/g de verdad).
2. Fila mínima sin esa columna → `v[6] === 0`.
3. `a5AlertasDe` con valor real indexado (p. ej. `v[6] = 6.93`) →
   `contexto.rac === 6.93` (no los puntos).
4. `a5AlertasDe` con meta CUMPLIDA (25 puntos, `m[4] = [25, fecha]`) pero
   **sin** valor real (`v[6] = 0`) → `contexto.rac === 0` — el caso que
   reproduce el defecto original (25 puntos ya NO se lee como "RAC 25").
5. `hcAnexo5Render` (o el pintor del aviso que sea) con valor real → el HTML
   contiene el texto `RAC <valor>` correcto; con meta cumplida y sin valor →
   el HTML **no** contiene ningún texto `RAC ` (tramo ausente).

### 2.5 Mutaciones a verificar (mínimo 2)

- **M1**: deja de leer la columna nueva en el indexador (p. ej. condiciona
  `cRac >= 0 ? ... : 0` a `false`) → el caso 3 de arriba debe ponerse ROJO
  con el mensaje exacto (`esperaba 6.93 y obtuvo 0` o similar). Restaura y
  confirma verde.
- **M2**: vuelve a rotular con los puntos de la meta (`rac: (m[4] &&
  m[4][0]) || 0` en vez de `v[6] || 0`) → el caso 4 (meta cumplida sin valor
  real) debe ponerse ROJO (`esperaba 0 y obtuvo 25` o el mensaje que
  corresponda). Restaura y confirma verde.

Documenta ambas como filas nuevas en `tests/INFORME_MUTACIONES.md` (sigue el
formato de las secciones `## v18.9.0` / `## v18.10.0` ya presentes en el
archivo — tabla de 4 columnas, mensajes de assert citados literalmente).

### 2.6 El resto del encargo (puntos 1, 3 y 4 — documental, no solo código)

- **Punto 1 (ubicación de notificaciones)**: ya existe un mapa completo de
  cómo funciona hoy el sistema de notificaciones (bandeja `#vgl-toasts`,
  dock de pendientes, aviso del Anexo 5 dentro de `#vgl-root`, canales
  C0-C5) en auditorías previas — revisa `docs/AUDITORIA_UIUX_20260902.md` y
  cualquier informe de notificaciones que encuentres en `docs/`. Escribe un
  acta corta (nueva fila en `docs/REGISTRO_DECISIONES.md` o un documento
  dedicado si el análisis es largo) que responda: ¿la ubicación actual ya
  cumple visibilidad + no-interrupción + accesibilidad desde todos los
  contextos? Si sí, documenta por qué con evidencia (igual que se hizo con
  "U1 ya existe" en auditorías anteriores). Si detectas un hueco real,
  propón el cambio concreto y ejecútalo con la misma disciplina de mutación.
- **Punto 3 (sincronización total con la base piloto)**: tras el fix de la
  RAC quedan **33 de 38** columnas sincronizadas. Documenta explícitamente
  (en el acta) las **5 columnas restantes** que el aviso no muestra por
  diseño (revisa `docs/AUDITORIA_BASE_PILOTO_SEP_20260907.md` o el volcado
  del xlsx con `auditar_reposo_a5.cjs` para identificarlas con certeza —
  candidatas conocidas: estado oficial/clasificación del programa, HDL,
  triglicéridos, IMC recientes, marca de "Estudiado para ERC") y propón,
  sin implementar sin visto bueno, cómo se mostrarían si el médico decide
  incluirlas en una versión futura.
- **Punto 4 (pruebas de usabilidad + informe final)**: dado que este
  userscript no tiene instrumentación de usuario real disponible para ti en
  esta sesión (no hay acceso a la flota en vivo), las "pruebas de
  usabilidad" se satisfacen con: (a) el banco de pruebas automatizado
  verde con los casos nuevos de §2.4, (b) verificación manual de que el
  aviso se ve correctamente en ambos temas (claro/oscuro) si el tramo del
  RAC toca CSS nuevo (revisa si necesitas verificación Chromium según
  `CLAUDE.md`/las reglas de blindaje tipográfico del proyecto — probablemente
  NO, porque este es un cambio de dato, no de regla CSS nueva), y (c) un
  informe final en `docs/` (nombre sugerido:
  `AUDITORIA_NOTIFICACIONES_ANEXO5_UIUX_20260909.md`) que cierre los 4
  puntos con su evidencia, siguiendo el formato de
  `docs/AUDITORIA_PANEL_PACIENTE_20260907.md` como plantilla de estilo.

---

## 3. TAREA B — Mesa de expertos (auditoría integral, encargo ya definido)

Existe un prompt de encargo completo, ya escrito y aprobado por el médico,
para una auditoría integral con enjambre de subagentes especializados
(deduplicación de código y UI, adaptación a configuración por usuario,
experiencia no intrusiva, auditoría de flujos de trabajo). **No lo
reescribas: está en**

```
docs/PROMPT_MESA_EXPERTOS_20260908.md
```

Léelo completo y ejecútalo tal cual describe (roles en paralelo, solo
lectura para el inventario; triaje A/B/C de hallazgos; aplicación
centralizada por una sola mano para evitar conflictos de edición
concurrente; verificación con la misma disciplina de mutación de §1.4;
entrega con informe + bump de versión + publicación en gist).

Esta tarea se había empezado a lanzar (5 roles de exploración en paralelo)
cuando la sesión anterior se interrumpió por errores de saldo insuficiente de
API (`402 Insufficient Balance`) en las llamadas en segundo plano — **no por
un problema del proyecto ni del código**. Si tu proveedor/modelo tiene saldo
disponible, puedes lanzarla directamente desde cero siguiendo el documento
referenciado; no hay estado parcial que recuperar (los 5 exploradores nunca
llegaron a producir resultados).

---

## 4. Orden de ejecución sugerido

1. Verifica el entorno (§0) — no continúes si `git status` no sale limpio o
   la versión no es `18.10.0`.
2. Ejecuta la TAREA A completa (§2) primero: es acotada, ya está diseñada,
   y cierra un defecto clínico real (un dato de laboratorio mal rotulado).
   Ciérrala con commit + push + publicación en gist + acta, siguiendo
   exactamente el patrón de las entregas anteriores que verás en
   `git log --oneline` (mensajes tipo `feat(vX.Y.Z): ...`, luego
   `docs(registro): acta de publicación...`).
3. Solo después, si el médico no ha dado otra prioridad, arranca la TAREA B
   (§3) — es mucho más grande (enjambre completo) y no debe mezclarse en el
   mismo commit ni la misma versión que la Tarea A.
4. Cualquier decisión que dependa del médico (por ejemplo qué hacer con las 5
   columnas restantes del Anexo 5, o qué variante de un experimento A/B
   probar) se documenta como pregunta abierta en el acta — **no se decide
   por tu cuenta ni se implementa sin su visto bueno.**

---

## 5. Qué NO hacer

- No trabajes en `E:\CENTINELA\vigilante-agenda-everest` (ya no es un repo).
- No inventes el enunciado de la ORDEN #8 de forma distinta a la transcripción
  de §2.1 — ya se investigó a fondo (incluyendo parseo del xlsx real) y el
  alcance quedó fijado por el propio médico.
- No subas el xlsx de la base piloto (ni ningún volcado con filas de
  pacientes) a git, al gist, ni a ningún sitio.
- No mezcles la Tarea A y la Tarea B en el mismo commit/versión.
- No fuerces (`git push --force`) nada. Si `origin` avanzó por otra vía,
  reconcilia con un merge/rebase normal.
