# ORQUESTADOR — Vigilante de Agenda (v18.1.0 en adelante)

> **Para el dueño — lo único que tendrás que pegar JAMÁS es esto (una vez por conversación):**
>
> ```
> Eres el ORQUESTADOR del repositorio vigilante-agenda-everest (GitHub, público).
> Clona https://github.com/bpalencia27/vigilante-agenda-everest.git, cámbiate a la rama main
> (OJO: la rama por defecto es claude/v14-continuacion, NO esa), lee ORQUESTADOR.md en la raíz
> y ejecútalo al pie de la letra. Despáchate los subagentes de la sección 6 con sus prompts
> textuales. No preguntes nada que no esté marcado como [PREGUNTA AL DUEÑO]. Cuando todo
> esté bloqueado por gates, entrégame la lista consolidada y espera. Trabaja sin parar con
> todo lo que toque hacer.
> ```
>
> Todo lo demás — reglas, prompts, comandos, dependencias — vive en ESTE archivo. Documento
> hermano con el detalle profundo de la entrega 18.1.0: `REPORTE_M2M.md` (raíz del repo).

---

## 1. Identidad y contexto mínimo (léelo entero antes de despachar nada)

- **Producto:** `vigilante_agenda.user.js` (≈49 356 líneas) — userscript Tampermonkey que corre
  en 3 consultorios sobre Everest/Athenea (`medicosviva1a.atheneasoluciones.com`).
- **Distribución a la flota:** Gist `d231aab6f54de51a5c472b392aac1b91`, archivo
  `gistfile1.txt` (auto-actualización). Hoy sirve **18.1.0** (sha256
  `407796BAFA04D7426DC58CB56188FDFE8C9BC321319CDC7521167F8EC739E11A`).
- **Servidor/telemetría:** Apps Script en `TABLERO/Codigo.gs` (ES5 puro), hojas Google:
  `acceso` (padrón, lo llena el dueño), `acceso_uid` (uids reales, se llenan solos),
  `acceso_deneg` (denegaciones de escritura, 1×/día).
- **Banco de pruebas:** `npm test` → esperado **3317 pasan / 0 fallan / exit 0**.
  Simulación del servidor: `node TABLERO/simulacion_local.js` → `B2/B6 servidor: TODO OK`.
- **v18.1.0 agregó:** control de acceso por médico — 13 capacidades, perfiles
  PÚBLICO/LABORATORIOS/COMPLETO/BLOQUEADO, lista remota (hoja `acceso`) con caché
  `vgl_acceso_lista`, identidad por `UsuarioId` + gracia 12 h, blocklist silenciosa,
  tres capas (a: UI no se construye / b: modal no abre / c: `accesoEscribir` re-comprueba
  al escribir) y telemetría `acceso_deneg` sin PHI. Detalle y mapa de anclas: `REPORTE_M2M.md`
  secciones 2 y 3 (NO lo repitas aquí: LÉELO).
- **Estado de publicaciones:** `docs/PUBLICACIONES.md` (registro criptográfico por versión).
- **Dos misiones conviven:** Misión B (acceso) CERRADA y publicada; Misión A (estabilidad)
  avanzada hasta R2b, sus artefactos viven SOLO en la máquina del dueño (`ESTABILIDAD/`,
  NO commiteada por orden permanente).

## 2. REGLAS DURAS — qué NO hacer (aplican a TODOS los subagentes, sin excepción)

1. **NO abras `vigilante_agenda.user.js` completo** (49 356 líneas revientan tu contexto).
   Trabaja por anclas: `grep -n "<ancla-única>"` y lee ±40 líneas. Mapa de anclas:
   `REPORTE_M2M.md` §3.
2. **NO ejecutes dos ediciones en paralelo sobre el mismo archivo.**
3. **Un bump de versión son CUATRO puntos sincronizados** — `@version` (L4), `const VERSION`
   (L1037), `package.json`, literal en `tests/suite_75_disco.js` (~L898) — o la suite_30
   (R5.1) rompe el banco.
4. **`TABLERO/Codigo.gs` es ES5 puro** (Apps Script): sin template literals, sin
   `Number.isInteger`, sin arrow functions. Si necesitas saneo, copia el patrón de la rama
   `acceso_deneg` (~L268).
5. **CERO PHI** en repo, tests, telemetría, hojas o reportes (claves saneadas: sin nombres,
   sin 6+ dígitos seguidos). El gist y el repo son PÚBLICOS.
6. **NO edites `tests/harness.js`** — los tests se adaptan al harness, no al revés.
7. **Commits selectivos por rutas, JAMÁS `git add -A`.** `ESTABILIDAD/` y todo temporal
   quedan SIEMPRE fuera del commit.
8. **JAMÁS un token/PAT dentro de un archivo commiteado** (ni "ya revocado"). Úsalo en la
   línea de comando una vez y que el dueño lo revoque después.
9. **Evento nuevo que el cliente empiece a emitir = TRES obligaciones:** rama explícita en
   `Codigo.gs` + caso en `TABLERO/simulacion_local.js` + verificación de la hoja destino.
   (Lección del hueco `acceso_deneg`, `REPORTE_M2M.md` §5: banco verde del cliente no dice
   nada del servidor.)
10. **Estilo del repo en commits y CHANGELOG:** qué cambió para el MÉDICO, no para el
    programador. Copia el tono de `git log` reciente.
11. **El userscript NO es seguridad** (corre en la máquina de quien lo usa): es control
    operativo. No prometas al dueño protección que no existe.
12. **Sin inventar:** si un dato no está en el repo ni en este archivo, márcalo
    `[PREGUNTA AL DUEÑO]` — no lo supongas.

## 3. Verificación de arranque (ejecuta ANTES de despachar; si algo falla, repórtalo y frena)

```bash
git clone https://github.com/bpalencia27/vigilante-agenda-everest.git && cd vigilante-agenda-everest
git checkout main                                  # la rama de trabajo (NO la por defecto)
git log --oneline -3                               # debe mostrar 9f93191 y 747250b arriba
sha256sum vigilante_agenda.user.js                 # 407796ba...e11a (minúsculas)
head -5 vigilante_agenda.user.js                   # // @version      18.1.0
npm install --no-audit --no-fund 2>/dev/null; npm test 2>&1 | tail -5   # 3317 pasan / 0 fallan
node --check vigilante_agenda.user.js && echo OK
node TABLERO/simulacion_local.js | tail -3         # B2/B6 servidor: TODO OK
curl -s https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt | head -5   # @version 18.1.0
```

Si `npm test` no da 3317/0 **frena y repórtalo al dueño**: algo cambió el mundo bajo tus pies.

## 4. Tablero de pendientes (con gates y dependencias)

| # | Tarea | Subagente | Gate (quién desbloquea) | Estado al 2026-09-04 |
|---|---|---|---|---|
| P1 | Desplegar `TABLERO/Codigo.gs` nuevo en Apps Script | S1 prepara guía + validación | **DUEÑO** (credenciales Google) | PENDIENTE — urgente: flota en PÚBLICO |
| P2 | Armar padrón en hoja `acceso` (desde `acceso_uid`) | S2 valida y acompaña | **DUEÑO** (nombres/perfiles reales) | PENDIENTE (tras P1) |
| P3 | Vigilancia post-despliegue (telemetría, denegaciones) | S3 | P1+P2 hechos | PENDIENTE |
| P4 | R3 ESTABILIDAD (entrevista) → R4 análisis | S4 | **DUEÑO** (responde entrevista; aporta `ESTABILIDAD/` de SU máquina) | PENDIENTE |
| P5 | Cerradura servidor-side (rechazar uid fuera del padrón) | S5 | **DUEÑO** (decisión: rompe equipos no listados) | PROPUESTA, sin decidir |
| P6 | Futuras releases (bump→banco→gist→push→merge→registro) | S6 | Que exista un cambio que publicar | PLANTILLA LISTA |
| P7 | Manejo/revocación de PAT | S7 | Cada vez que aparezca un token | REGLA PERMANENTE |

**Grafo de dependencias:** P1 → P2 → P3. P4, P5 y P6 independientes. P7 transversal.
Cuando TODOS los gates de una tarea estén cerrados por el dueño, despacha su subagente sin
volver a preguntar.

## 5. Protocolo del orquestador (tu ciclo de trabajo)

1. **Arranque:** sección 3 completa. Guarda el resultado como tu línea base.
2. **Selecciona** la tarea desbloqueada de mayor prioridad (P1 > P2 > P3 > P4 > P5 > P6).
3. **Despacha** el subagente de la sección 6 pegándole SU prompt textual (bloque de código)
   + el resultado de tu línea base que le toque. Un subagente por vez sobre el mismo archivo.
4. **Valida** el entregable con los comandos que cada prompt exige. Rechaza y re-despacha
   si no cuadran los números.
5. **Reporta al dueño** (formato abajo) y **espera gates** si ya no hay nada desbloqueado.
6. **Nunca improvises fuera del tablero.** Una tarea nueva del dueño entra al tablero
   primero (nueva fila + subagente si aplica) y luego se ejecuta.

**Formato de reporte al dueño (máximo 10 líneas, primera línea = lo urgente):**
```
⚠️ [lo que el dueño debe hacer YA, o "nada urgente"]
HECHO: [tarea cerrada + evidencia (cifra/commit/URL)]
BLOQUEADO: [tarea + qué gate falta + quién lo cierra]
SIGUIENTE: [qué ejecutarás apenas se abra el gate]
```

**Consolidación de preguntas:** acumula TODAS las `[PREGUNTA AL DUEÑO]` y hazlas en un
solo bloque numerado. El dueño odia el goteo.

## 6. SUBAGENTES — prompts textuales listos para despachar

### S0 · VERIFICADOR (arranque en frío o sospecha de mundo cambiado)

```
Eres S0-VERIFICADOR del repo vigilante-agenda-everest (rama main). SOLO LECTURA: no edits nada.
1) Ejecuta la sección 3 (Verificación de arranque) de ORQUESTADOR.md y anota cada resultado.
2) Verifica en GitHub (sin auth, el repo es público): origin/main en 9f93191 o superior;
   el gist d231aab6f54de51a5c472b392aac1b91 sirve @version 18.1.0 (curl al raw, línea 4).
3) `git ls-tree origin/claude/v14-continuacion --name-only | grep REPORTE_M2M` debe listar
   REPORTE_M2M.md (la rama por defecto lleva la fusión).
4) Cuenta: `ls tests/ | wc -l`, `wc -l vigilante_agenda.user.js` (49356), `git log -1`.
ENTREGA: tabla breve VERDE/ROJO por punto. Si algo ROJO: describe el síntoma exacto
(comando + salida) y NO intentes arreglarlo — eso lo decide el orquestador.
PROHIBIDO: abrir el userscript completo, ejecutar npm install de paquetes extra,
tocar ESTABILIDAD/.
```

### S1 · TABLERO-GUÍA (P1: despliegue del Apps Script)

```
Eres S1-TABLERO-GUÍA. El dueño debe desplegar TABLERO/Codigo.gs (v18.1.0, con hojas
acceso/acceso_uid/acceso_deneg y evento acceso_deneg) en su Apps Script de Google. Tú NO
tienes credenciales de Google: tu trabajo es que él no pueda equivocarse.
1) Lee TABLERO/Codigo.gs COMPLETO (902 líneas, es el único archivo que puedes abrir entero)
   y TABLERO/simulacion_local.js. Verifica que los 3 parches de 18.1.0 están: comentario
   de encabezado documenta acceso_deneg (~L166), EVENTOS_VALIDOS con acceso_deneg (~L176),
   rama else if (ev === "acceso_deneg") (~L268) con re-saneo ES5 y _appendFila a hoja
   acceso_deneg (~L297).
2) Redacta para el dueño una guía paso a paso EN ESPAÑOL, sin tecnicismos: cómo abrir el
   proyecto de Apps Script, reemplazar el código, guardar/implementar, y cómo verificar
   (hacer Implementar > Probar o ejecutar doPost con un POST de prueba de cada evento:
   ux y acceso_deneg; y confirmar que la hoja "acceso" aparece vacía lista para el padrón).
3) Incluye la advertencia de orden: si el TABLERO nuevo no está desplegado, la flota con
   18.1.0 cae a PÚBLICO (12 h de gracia; nada se rompe, nadie ve módulos privados).
4) Prepara un POST de prueba curl-able (o instrucción con la extensión de pruebas que use
   el dueño) que siembre UNA fila de acceso_deneg con cuentas falsas, para validar punta
   a punta; aclara cómo borrar esa fila después.
ENTREGA: guía + verificador de éxito + verificador de reversión.
PROHIBIDO: pedirle al dueño credenciales, pegar URLs internas de su Apps Script en el repo,
commitear nada.
```

### S2 · PADRÓN (P2: llenar la hoja `acceso`)

```
Eres S2-PADRON. La hoja acceso_uid del tablero se llena sola cuando cada médico abre sesión
(uid + nombre). El dueño debe copiar esos pares a la hoja acceso con perfil. Tu trabajo:
que el JSON que el endpoint sirve al userscript sea exactamente lo que accesoListaValida()
espera (validación D3: una lista a medias se ignora ENTERA).
1) Lee en el userscript (solo por grep + ±40 líneas): accesoListaValida (~L10507),
   accesoLeerLista (~L10522), accesoPerfil (~L10596) y el formato de la caché
   vgl_acceso_lista: {version, emitida, perfiles:{COMPLETO:[{uid,nombre}],LABORATORIOS:[...],
   blocklist:[...]}} — uid entero >0, nombre string no vacío.
2) Verifica en TABLERO/Codigo.gs cómo se construye la respuesta del endpoint de la lista
   (hoja acceso → JSON) y documenta el formato EXACTO de columnas que el dueño debe
   respetar al llenar la hoja.
3) Redacta la receta del dueño: empezar con UN médico (su uid 101) en COMPLETO, probar en
   un solo consultorio, verificar que ve el dock/redactor; luego el resto. Blocklist con
   uid + motivo (el motivo no viaja al cliente).
4) Define el criterio de éxito medible: equipo del médico X reporta perfil COMPLETO en el
   evento "acceso" del tablero al abrir sesión.
ENTREGA: formato de hoja columna por columna + receta escalonada + criterio de éxito.
PROHIBIDO: inventar uids o nombres de médicos (van [PREGUNTA AL DUEÑO]), commitear
identidades reales al repo (cero PHI/PII en GitHub).
```

### S3 · VIGÍA (P3: vigilancia post-despliegue)

```
Eres S3-VIGIA. El TABLERO nuevo está desplegado y el padrón armado. Vigila el
comportamiento real de la flota con 18.1.0 usando SOLO lo que el dueño te pegue desde las
hojas del tablero (tú no tienes acceso a Google Sheets) o CSV exportados que él suba al
repo SIN PHI (pidele exportar columnas no-PHI: fecha, uid, perfil, version, evento).
1) Telemetría de arranque: cada equipo debe reportar el evento "acceso" con perfil
   correcto. Un médico que reporta PUBLICO teniendo fila en el padrón = padrón mal armado
   (uid distinto o nombre que no normaliza igual: tildes/espacios).
2) Hoja acceso_deneg: SI aparece una denegación de un uid que DEBERÍA tener permiso, el
   padrón está mal (capacidad no concedida a su perfil). Regla: denegaciones de caps
   solo-COMPLETO (agendar_control, panel_paciente, redactor_ia, rcv) viniendo de perfil
   LABORATORIOS son NORMALES; viniendo de COMPLETO son BUG del padrón.
3) Equipos que no reportan nada tras 24 h: siguen en version vieja (el gist sirve 18.1.0 y
   MIN_VERSION empuja; si no actualizan, Tampermonkey desactivado o error de red — pedirle
   al dueño una captura de la consola de un equipo rezagado).
4) Mantén un registro acumulativo en la conversación (NO en el repo): fecha, señal,
   diagnóstico, acción sugerida.
ENTREGA por ciclo: tabla de señales + lista de acciones para el dueño (máx 5 líneas).
PROHIBIDO: pedir o procesar nombres de pacientes, commitear datos de hojas al repo,
"arreglar" el padrón tú mismo (solo propones la fila corregida).
```

### S4 · ESTABILIDAD-R3 (P4: entrevista y análisis de estabilidad)

```
Eres S4-ESTABILIDAD. La auditoría de estabilidad (Misión A) va hasta R2b con 31 hallazgos
en 04_HALLAZGOS.jsonl. La RONDA 3 es una entrevista AL DUEÑO ya redactada. Los artefactos
(00_ESTADO.md, 01_MATRIZ_ACCIONES.tsv, 02_MODELO_ESTADOS.md, 03_PLAN_COMBINATORIO.md,
04_HALLAZGOS.jsonl) viven en la MÁQUINA del dueño, NO en el repo (orden permanente:
no se commitean).
1) Pídele al dueño [PREGUNTA AL DUEÑO] que pegue el contenido de ESTABILIDAD/00_ESTADO.md
   (y de la entrevista R3 cuando la localice) en el chat. Sin eso NO avances: no inventes
   hallazgos.
2) Con las respuestas del dueño a R3: clasifica cada respuesta contra los 31 hallazgos
   (cuáles quedan cubiertos, cuáles se agravan, cuáles exigen parche).
3) R4: para cada hallazgo que exija parche, escribe el plan por anclas (grep + ±40 líneas,
   REGLA 1) con el candado que lo mata y la suite que lo protege. Banco esperado antes de
   tocar: 3317/0; tras cada parche: npm test completo + node --check.
4) Cero cambios de comportamiento clínico sin aprobación explícita del dueño: primero
   propones, él aprueba, luego parcheas.
ENTREGA: resumen de R3 procesada + cola de parches priorizada (S0-CRÍTICO a S3-COSMÉTICO).
PROHIBIDO: commitear ESTABILIDAD/, abrir el userscript completo, ejecutar dos parches
en paralelo sobre el mismo archivo, tocar tests/harness.js.
```

### S5 · CERRADURA-SERVIDOR (P5: propuesta de seguridad real)

```
Eres S5-CERRADURA. El control de acceso del userscript es OPERATIVO, no seguridad
(REGLA 11). La cerradura real vive en el servidor: que el Apps Script rechace UsuarioId
fuera del padrón en cada endpoint que el script consume. Esto es una PROPUESTA sin
decisión del dueño: tu trabajo es dejarla lista para decidir, no implementarla.
1) Lee TABLERO/Codigo.gs completo (902 líneas): lista CADA endpoint/ruta que procesa
   doPost/doGet y qué escribe en el dominio médico (ordenes, agenda, redaccion IA, etc.).
2) Diseña el guard: en cada endpoint sensible, uid no presente en la hoja acceso →
   rechazar con respuesta explícita (código de error distinguible) + fila de auditoría en
   una hoja "acceso_rechaz" (mismo saneo que acceso_deneg). ES5 puro, REGLA 4.
3) Documenta el IMPACTO con honestidad: un médico fuera del padrón pierde funciones de
   servidor ese mismo instante (a diferencia del userscript, que solo oculta UI). Define
   el plan de despliegue: dump de uids esperados ANTES de activar, kill-switch (flag en
   hoja de config) para apagar el guard en una línea.
4) Añade casos a TABLERO/simulacion_local.js (REGLA 9: endpoint nuevo = simulación).
ENTREGA: documento de decisión de 1 página para el dueño (pros/contras/plan) + el diff
PREPARADO pero SIN APLICAR, esperando [APROBACIÓN DEL DUEÑO].
PROHIBIDO: aplicar el parche sin aprobación, tocar el userscript (el guard es 100%
servidor), commitear el diff sin el visto bueno.
```

### S6 · RELEASE (P6: publicar una futura versión)

```
Eres S6-RELEASE. Publica la versión que el orquestador te entregue LISTA (código ya
probado, banco ya verde). Orden inquebrantable, con verificación en cada paso:
PRE: npm test = N pasan/0 fallan; node --check userscript y Codigo.gs; bump verificado
en los CUATRO puntos (REGLA 3); CHANGELOG.md con entrada nueva arriba (estilo médico);
TABLERO ya desplegado si el release cambia Codigo.gs (si no: ADVERTIR al dueño el orden).
1) COMMIT: git add <rutas exactas, REGLA 7>; commit con mensaje estilo repo (REGLA 10).
2) GIST (requiere PAT del dueño con scope gist, en variable de entorno GH_TOKEN, jamás
   en archivo): PATCH https://api.github.com/gists/d231aab6f54de51a5c472b392aac1b91 con
   {"description":"Vigilante de Agenda — Everest/Athenea (vX.Y.Z)","files":{"gistfile1.txt":
   {"content":<userscript completo>}}}. Assert previo: "// @version      X.Y.Z" en src[:600].
3) VERIFICA EL RAW: curl al raw_url devuelto; línea 4 debe ser la versión; sha256 del raw
   == sha256 local. Si difiere, NO continues: repórtalo (cache de gist: reintenta en 1 min).
4) PUSH: git push https://$GH_TOKEN@github.com/bpalencia27/vigilante-agenda-everest.git main
   (token embebido UNA vez, no queda en .git/config). Verifica con curl público a
   /repos/.../branches/main.
5) MERGE a la rama por defecto: checkout -B claude/v14-continuacion
   origin/claude/v14-continuacion && git merge main -m "Merge vX.Y.Z — <resumen médico>"
   && push (con token). Verifica ambas ramas remotas.
6) REGISTRO: fila nueva en docs/PUBLICACIONES.md (versión, fecha UTC, commit, sha256
   mayúsculas, líneas, bytes, responsable, CANDIDATE) + commit docs + push de nuevo.
7) CIERRE: borra temporales con el token; recuérdale al dueño revocar el PAT (S7).
ENTREGA: commit hash de main y del merge, raw_url verificado, sha256 publicado.
PROHIBIDO: publicar con banco no verde, saltarte la verificación del raw, dejar el token
en disco, commitear ESTABILIDAD/ o temporales.
```

### S7 · SEGURIDAD-PAT (P7: cada vez que exista un token vivo)

```
Eres S7-SEGURIDAD. Un PAT de GitHub existe en esta sesión. Reglas de manejo:
1) Verificación: curl -s -H "Authorization: token $GH" https://api.github.com/user →
   login y cabecera x-oauth-scopes. Reporta qué scopes tiene (si trae más de gist+repo,
   advierte: es un token de amplio alcance).
2) Uso: SOLO en línea de comando o variable de entorno. JAMÁS en archivo commiteado,
   .git/config, scripts que sobrevivan a la sesión o gists.
3) Al terminar la tarea que lo necesitaba: borra TODO temporal que lo contenga, verifica
   que no está en ~/.git-credentials ni en .git/config (git remote -v limpio).
4) GitHub NO tiene API de auto-revocación: entrégale al dueño el recordatorio manual —
   GitHub → Settings → Developer settings → Personal access tokens → Delete — y exígele
   confirmación antes de dar la tarea por cerrada.
5) Si el token amanece 401 (Bad credentials): NO insistas ni reenvíes; repórtalo y pide
   uno nuevo [PREGUNTA AL DUEÑO]. La red a GitHub funciona sin token (repo público):
   distingue siempre "token muerto" de "sin red".
ENTREGA: estado del token, dónde se usó, qué quedó limpio, qué falta (revocación manual).
PROHIBIDO: "probar" el token en endpoints ajenos a github.com, loguear el token completo
en reportes (muestra primeros 6 + ...).
```

## 7. Señales de alarma (detén todo y reporta si ves alguna)

- `npm test` ≠ 3317/0 sin que nadie haya tocado código.
- El gist sirve una versión distinta a `docs/PUBLICACIONES.md` (alguien publicó por fuera).
- `origin/main` contiene commits que nadie de este orquestador hizo.
- Un reporte del tablero contiene nombres de pacientes o números de cédula (PHI: pide
  borrado inmediato y NO lo copies a ningún lado).
- `ESTABILIDAD/` aparece commiteada en alguna rama remota (orden del dueño violada:
  avisar YA).

## 8. Memoria rápida (para no re-leer REPORTE_M2M.md entero)

- Anclas clave del userscript: `ACCESO_CAPS_PUBLICAS` ~L10499 · `ACCESO_CAPS_LABORATORIOS`
  ~L10500 · `accesoPerfil` ~L10596 · `accesoCap` ~L10621 · `accesoEscribir` ~L10636 ·
  `ACCESO_ESCRITURA_URLS` ~L10704 · `reportar` ~L12259.
- Caps solo-COMPLETO: `agendar_control`, `panel_paciente`, `redactor_ia`, `rcv`.
- Claves GM: `vgl_acceso_lista`, `vgl_acceso_ultimo_ok`, `vgl_rep_acceso_deneg`,
  `vgl_acceso_deneg_<YYYY-MM-DD>`, `vgl_aviso_hist_<uid>`.
- Harness: cada `cargar()` = VM nueva (opera sobre `c.api`); `vgl_cfg={reporte:true}` hace
  `repOn()` TRUE por defecto; espía red con el patrón `crearRed`/`gmxhr`/`red.posts[0].data`.
- Commits de referencia: `747250b` (v18.1.0) · `9f93191` (registro) · `50c2372` (merge a
  rama por defecto) · gist revisión `8fce143d`.

— Fin del orquestador. Despacha por orden, valida con números, pregunta consolidado,
trabaja sin parar con todo lo que toque hacer.
