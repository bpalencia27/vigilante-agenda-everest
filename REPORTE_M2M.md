# REPORTE M2M — v18.1.0 «Quién ve qué» · Relevo de la sesión 2026-09-04

> **Documento máquina-a-máquina.** Lo escribe la IA que cerró la Misión B (control de acceso
> por médico) y dejó la Misión A (estabilidad) avanzada hasta R2b. Si eres la IA sucesora:
> léelo COMPLETO antes de tocar `vigilante_agenda.user.js` (**49 356 líneas — NO lo abras
> entero**, trabaja por anclas, sección 3). El dueño delega trabajo leyendo este repo desde
> GitHub; todo lo que sigue es verificable con los comandos que se dan aquí.

---

## 0. Verificación rápida (¿estás en el commit correcto?)

```bash
git clone https://github.com/bpalencia27/vigilante-agenda-everest.git   # repo PÚBLICO, sin auth
cd vigilante-agenda-everest
git checkout main                                    # la rama ACTIVA es main
git log -1 --format="%H %s" -- REPORTE_M2M.md        # EL commit de esta entrega
sha256sum vigilante_agenda.user.js
# debe dar: 407796bafa04d7426dc58cb56188fdfe8c9bc321319cdc7521167f8ec739e11a
head -5 vigilante_agenda.user.js                     # debe mostrar @version 18.1.0
```

- Repo: `bpalencia27/vigilante-agenda-everest` (público). **OJO: la rama por defecto en
  GitHub es `claude/v14-continuacion`, pero la rama de trabajo real es `main`.** Un clone
  trae la rama por defecto: haz `git checkout main` sí o sí.
- Gist de producción (auto-actualización de la flota, 3 consultorios):
  id `d231aab6f54de51a5c472b392aac1b91`, archivo `gistfile1.txt`.
- Referencia inmediatamente anterior: `6d5f633` = v18.0.143 (ya estaba en `origin/main`
  ANTES de esta entrega; esta sesión no lo empujó — llegó por otro conducto).

## 1. Estado al cierre — HECHO vs PENDIENTE

| # | Ítem | Estado |
|---|---|---|
| 1 | Misión B (B1–B6): código, pruebas, bump, docs | **HECHO** (commit de esta entrega) |
| 2 | Parche TABLERO `acceso_deneg` + simulación caso 8 | **HECHO** (mismo commit) |
| 3 | Banco completo `npm test` | **HECHO: 3317 pasan / 0 fallan / exit 0** |
| 4 | Commit local en `main` | **HECHO** (este commit) |
| 5 | Push a `origin/main` | **PENDIENTE — bloqueado por credenciales** |
| 6 | Merge `main` → `claude/v14-continuacion` (rama por defecto) | **PENDIENTE — depende de 5** |
| 7 | Gist PATCH (publicar 18.1.0 a la flota) | **PENDIENTE — bloqueado por credenciales** |
| 8 | Revocación del PAT | **PENDIENTE (manual, dueño)** — ver 10 |

**Por qué 5–7 quedaron pendientes:** el PAT clásico provisto por el dueño en la sesión
resultó **invalidado** cuando se fue a usar (última hora de la sesión):

- `PATCH https://api.github.com/gists/<id>` → **HTTP 401 `Bad credentials`**
- `GET https://api.github.com/user` con ese token → **HTTP 401 `Bad credentials`**
- `git push` sin token (repo público, push exige auth) → `fatal: could not read Username for 'https://github.com': terminal prompts disabled`
- La red a GitHub **funciona** (el gist público responde 200): el problema es SOLO el token
  (revocado, expirado o mal copiado — no hay forma de distinguirlo desde fuera).

Al momento de escribir esto el gist **sigue sirviendo v18.0.143** (3 194 775 bytes) y
`origin/claude/v14-continuacion` está **27 commits por detrás** de `main` (su tope es el PR
#115). `origin/main` estaba en `6d5f633` = v18.0.143. La sección 7 trae los comandos exactos
para cerrar 5–7 con un PAT válido; el dueño también puede hacerlo a mano en 5 minutos.

## 2. Qué ES v18.1.0 (arquitectura de la Misión B, B1–B6)

**Problema original (v18.0.143):** dos listas embebidas de nombres (`MTR_MEDICOS_AUTORIZADOS`
y `RCV_DOCTORS`) como fuentes de verdad divergentes; identidad por nombre normalizado
(frágil: homónimos, segundo apellido); solo capa "a" (la UI no se construye) sin
re-comprobación al escribir; quien no estaba en el padrón veía un script parcial; nada de
perfiles, blocklist, lista remota ni telemetría. Diagnóstico completo conservado en
`ACCESO/00_ESTADO_ACCESO.md` (sección «Diagnóstico original»).

**Lo que quedó (una fuente de verdad, tres capas):**

- **Modelo de capacidades — 13 caps, resolución `accesoCap(cap)`:**
  - PÚBLICO (2 sí): `psic_odonto`, `pym`.
  - LABORATORIOS (9 sí): las 2 públicas + `centinela`, `notificaciones`, `agendar_labs`, `laboratorios`, `widget_examen_normal`, `widget_examenes_autolabs`, `aviso_paciente_nuevo`.
  - COMPLETO (13 sí): todo + `agendar_control`, `panel_paciente`, `redactor_ia`, `rcv`.
  - BLOQUEADO (0 sí): ni las públicas; el script no se construye, en silencio.
  - Cap desconocida → `false` en todos MENOS COMPLETO («COMPLETO = todo», por diseño, caso cubierto en suite_80).
  - Los legados `mtrEsMedicoAutorizado` / `esMedicoRCVActivo` quedaron como envoltorios de `accesoCap()` — nada más los consulta.
- **Lista remota (B2):** hoja `acceso` del tablero (Apps Script). Refresco al arrancar + cada 4 h + al abrir Ajustes. Validación estricta antes de aplicar (regla D3: una lista a medias NO se aplica parcialmente — se ignora entera). Caché local `vgl_acceso_lista` MANDA como respaldo sin castigo.
- **Identidad (B3, D1/D2):** `UsuarioId` de la sesión (`state.activeDoctor.id`), respaldo por nombre normalizado (uid GANA sobre nombre). Sin identidad → gracia 12 h (`vgl_acceso_ultimo_ok`, solo se anotan perfiles privilegiados) → después PÚBLICO. Identidad presente pero fuera del padrón → PÚBLICO sin heredar gracia. Blocklist (uid o nombre) gana SIEMPRE y en silencio.
- **Tres capas:** (a) la UI no se construye; (b) el modal no se abre; (c) `accesoEscribir(cap)` re-comprueba JUSTO antes de escribir — tabla única `ACCESO_ESCRITURA_URLS` (URL de escritura → capacidad) que consultan los embudos de red; una URL fuera de la tabla es LECTURA y pasa siempre. BLOQUEADO no escribe NADA, ni siquiera con caps públicas.
- **Aviso de paciente nuevo (B5):** dedup por cita (`vgl_aviso_hist_<uid>`), bootstrap silencioso, máx 3 toasts/h, contador en el dock, clave datada SIN nombres, cap `aviso_paciente_nuevo`.
- **Telemetría de denegaciones sin PHI (B6):** SOLO la capa c cuenta (`_accesoDenegAnota`); memoria → disco cada 30 min (`vgl_acceso_deneg_<YYYY-MM-DD>` con poda); al tablero 1×/día solo si hubo denegaciones: `reportar("acceso_deneg", {uid, perfil, cuentas})` con candado `vgl_rep_acceso_deneg` y anti-tormenta de 32 claves.
- **Límite honesto (decírselo al dueño sin adornos):** un userscript NO impone seguridad — corre en la máquina de quien lo usa. Esto es CONTROL OPERATIVO. La cerradura real sería servidor-side: propuesta en `ACCESO/00_ESTADO_ACCESO.md` (el Apps Script rechaza `UsuarioId` fuera del padrón en cada endpoint).

Documentos de diseño y cierre: `ACCESO/00_ESTADO_ACCESO.md` (estado + matriz + pendientes del
dueño), `ACCESO/01_ENTREVISTA.md` (7 preguntas respondidas: 1C 2B 3A 4A 5A 6A 7A),
`ACCESO/02_DISENO_ACCESO.md` (capacidades, D1/D2/D3, capas).

## 3. Mapa de anclas — NO abras el userscript completo

Trabaja SIEMPRE así: `grep -n "<nombre-único>" vigilante_agenda.user.js` → lee ±40 líneas
alrededor. Los números de línea son de esta entrega (pueden correr ±5 con futuros cambios;
los NOMBRES son únicos y estables).

**`vigilante_agenda.user.js` (v18.1.0):**

| Ancla | ~Línea | Qué es |
|---|---|---|
| `ACCESO_CAPS_PUBLICAS` | 10499 | `["psic_odonto","pym"]` |
| `ACCESO_CAPS_LABORATORIOS` | 10500 | las 7 caps de laboratorios |
| `ACCESO_GRACIA_MS` | 10501 | 12 h |
| `accesoListaValida` | ~10507 | validación D3 (lista completa o se ignora) |
| `accesoLeerLista` | ~10522 | lee+valida caché `vgl_acceso_lista` |
| refresco lista remota (B2) | ~10544 | arrancar + 4 h + Ajustes |
| `_accesoAnotarOk` | ~10569 | siembra `vgl_acceso_ultimo_ok` |
| `_accesoGracia` | ~10580 | gracia 12 h solo sin identidad |
| `accesoPerfil` | 10596 | orden: blocklist → uid → nombre → gracia → PÚBLICO |
| `accesoCap` | 10621 | capa a/b (UI y apertura) |
| `accesoEscribir` | 10636 | capa c + llama `_accesoDenegAnota` |
| `_accesoDenegAnota` | 10659 | memoria de denegaciones (solo capa c) |
| `_accesoDenegDia` / `_accesoDenegFlush` | 10688–10703 | disco 30 min + POST diario (L10697) |
| `ACCESO_ESCRITURA_URLS` | 10704 | tabla única URL de escritura → cap |
| `accesoEscribirUrl` | 10719 | lo que consultan los embudos de red |
| `avisoPacHistKey` | 10764 | `vgl_aviso_hist_<uid>` (dedup aviso) |
| `reportar` | 12259 | embudo de telemetría (mergea `extra` tal cual) |
| `repAccesoDiario` | 12314 | reporte diario agregado |
| timer `tAccesoUid` | 36017 | ciclo de refresco de identidad/lista |

**Sincronía de versión — CUATRO puntos (la suite_30 R5.1 los exige):**
`@version` (L4) · `const VERSION` (L1037) · `package.json` (`"version"`) · literal en
`tests/suite_75_disco.js` (~L898). Un bump que olvide uno rompe el banco (pasó con
package.json en esta sesión: 10 ok / 1 fallan hasta sincronizarlo).

**`TABLERO/Codigo.gs` (902 líneas, Apps Script, ES5 puro):**

| Ancla | ~Línea | Qué es |
|---|---|---|
| comentario evento `acceso_deneg` | 166–175 | contrato del evento |
| `EVENTOS_VALIDOS` | 176 | incluye `acceso` y `acceso_deneg` |
| rama `else if (ev === "acceso_deneg")` | 268 | re-saneo de `body.cuentas` (objeto o string, claves ≤40 chars y sin 6+ dígitos, valores positivos, tope 32) |
| `_appendFila(_hoja(ss, "acceso_deneg", …))` | 297 | hoja `acceso_deneg`: uid, perfil, cuentas |

Hojas del tablero: `acceso` (el padrón que llena el dueño), `acceso_uid` (uids reales que
llegan solos cuando cada médico abre sesión), `acceso_deneg` (telemetría de denegaciones).

**Claves de almacenamiento del userscript:** `vgl_acceso_lista` (caché del padrón),
`vgl_acceso_ultimo_ok` (gracia), `vgl_rep_acceso_deneg` (candado diario),
`vgl_acceso_deneg_<YYYY-MM-DD>` (disco datado con poda), `vgl_aviso_hist_<uid>` (dedup).

**Hechos del harness de pruebas (no intuitivos, causan horas perdidas):**
cada `cargar()` crea una VM nueva con clausura fresca (opera SIEMPRE sobre `c.api`); el
harness siembra `vgl_cfg={reporte:true}` y `GM_xmlhttpRequest`, así que `repOn()` es TRUE por
defecto; para espiar la red usa el patrón `crearRed`/`gmxhr`/`red.posts[0].data` de suite_78;
`reportar()` mergea `extra` sin limpiar → `cuentas` llega al servidor como OBJETO (el
servidor maneja objeto o string y NUNCA confía en el emisor).

## 4. Banco de pruebas y evidencia

- `npm test` → **3317 comprobaciones pasan / 0 fallan / exit 0** (progresión de la sesión:
  3294 → 3308 → 3317). `node --check` OK en userscript y en `Codigo.gs`.
- Suites nuevas: `tests/suite_78_acceso.js` (35 casos, B1–B4), `suite_79_aviso_paciente.js`
  (14, B5 — verde a la primera), `suite_80_acceso_matriz.js` (9, matriz 4 perfiles × 13 caps
  × 3 capas). 58 casos nuevos; 15 suites ampliadas.
- Servidor simulado: `node TABLERO/simulacion_local.js` → `B2/B6 servidor: TODO OK`,
  incluye el caso 8 (POST `acceso_deneg` → hoja `acceso_deneg`; verifica que una clave
  maliciosa `mala_con_12345678901` llega saneada como `mala_con_`).
- Diff de la entrega: 21 archivos rastreados, +1297/−83 (userscript +545, `Codigo.gs` +204,
  `simulacion_local.js` +82), más lo nuevo: `ACCESO/` (3 docs), suites 78/79/80 y este
  reporte. `ESTABILIDAD/` NO va en el commit (sección 6).

## 5. Lección de la sesión — el hueco `acceso_deneg`

El cliente (userscript) quedó enviando `acceso_deneg`, pero **el TABLERO no lo aceptaba**:
`EVENTOS_VALIDOS` no lo listaba y el `else` final lo descartaba. El hueco salió de una
revisión de anclas de punta a punta (cliente → `reportar` → servidor → hoja) hecha DESPUÉS de
que el banco estaba verde, porque el banco de la Misión B prueba el userscript con mocks, no
el Apps Script real. Se parchó en tres puntos (encabezado, `EVENTOS_VALIDOS`, rama con
re-saneo ES5) y se agregó el caso 8 a `simulacion_local.js`. **Regla para el sucesor: cada
evento nuevo que el cliente empiece a emitir exige (1) rama explícita en `Codigo.gs`,
(2) caso en `simulacion_local.js`, (3) verificación de que la hoja destino existe y recibe
las columnas esperadas.** El banco verde del cliente no dice nada del servidor.

## 6. Misión A — ESTABILIDAD (local-only, NO commitear)

- La carpeta `ESTABILIDAD/` (R0–R2b, 31 hallazgos en `04_HALLAZGOS.jsonl`) vive SOLO en la
  máquina del dueño. **Orden permanente: NO commitear `ESTABILIDAD/`** — por eso el commit de
  esta entrega es selectivo por rutas y jamás `git add -A`.
- R3 (entrevista de estabilidad con el dueño) está REDACTADA y espera al dueño; requiere sus
  respuestas para avanzar. Reanudar: leer `ESTABILIDAD/` en la máquina del dueño, NO en el
  repo.
- Cero PHI verificado en `ACCESO/` antes de commitear; mantén esa regla para todo lo que suba.

## 7. Publicación PENDIENTE — comandos exactos (con PAT válido del dueño)

**ORDEN OBLIGATORIO — despliegue del TABLERO ANTES que cualquier publicación del userscript:**

1. **Dueño, primero:** desplegar el `TABLERO/Codigo.gs` nuevo en el Apps Script (publica la
   hoja `acceso`, acepta `acceso_deneg`, crea `acceso_deneg` solo). Sin este paso, la flota
   que actualice a 18.1.0 no encuentra padrón y TODA cae a PÚBLICO (nada se rompe, nadie ve
   módulos privados, gracia de 12 h sobre el último perfil vigente) — riesgo documentado y
   asumido, pero evitable desplegando en orden.
2. **Dueño:** armar el padrón — copiar los uids reales de la hoja `acceso_uid` a la hoja
   `acceso` con su perfil (`COMPLETO`/`LABORATORIOS`) y blocklist con uid+motivo.
3. Recién entonces, publicar el userscript (gist PATCH) y push:

```bash
# --- a) Gist PATCH (publica 18.1.0 a la flota) ---
export GITHUB_TOKEN="ghp_..."   # PAT nuevo del dueño (scopes: gist, repo)
python3 - <<'PY'
import json, os, urllib.request
src = open("vigilante_agenda.user.js", encoding="utf-8").read()
assert "// @version      18.1.0" in src[:600], "version no esta en cabecera"
payload = json.dumps({
    "description": "Vigilante de Agenda — Everest/Athenea (v18.1.0)",
    "files": {"gistfile1.txt": {"content": src}},
}).encode()
req = urllib.request.Request(
    "https://api.github.com/gists/d231aab6f54de51a5c472b392aac1b91",
    data=payload, method="PATCH",
    headers={"Authorization": "token " + os.environ["GITHUB_TOKEN"],
             "Accept": "application/vnd.github+json",
             "User-Agent": "vigilante-release"})
body = json.loads(urllib.request.urlopen(req).read())
print("raw_url:", body["files"]["gistfile1.txt"]["raw_url"])
PY
# verificar (el raw puede tardar ~1 min en refrescar cache):
curl -s "<raw_url_impreso_arriba>" | head -5    # debe mostrar // @version      18.1.0

# --- b) Push de main ---
git push origin main

# --- c) Merge a la rama por defecto (para que un clone cualquiera vea el trabajo) ---
git fetch origin
git checkout -B claude/v14-continuacion origin/claude/v14-continuacion
git merge main -m "Merge v18.1.0 — control de acceso por médico (ver REPORTE_M2M.md)"
git push origin claude/v14-continuacion
# (equivalente: PR en la web main → claude/v14-continuacion, como el #115)

# --- d) Al terminar TODO: revocar el PAT (manual, ver sección 10) ---
```

El TABLERO tiene guardarraíl `MIN_VERSION` (subido a 18.0.142 en `5908980`): una vez que el
gist sirve 18.1.0, los equipos rezagados son empujados a actualizarse solos.

## 8. Trabajo para la IA sucesora (en orden)

1. **Verificar que 5–7 de la sección 1 estén cerrados** (gist sirviendo 18.1.0, `origin/main`
   con este commit, rama por defecto fusionada). Si no: ejecutar la sección 7 con PAT del dueño.
2. **R3 de ESTABILIDAD** — entrevista con el dueño (sus artefactos están en su máquina, no en
   el repo). Es el único frente que abre trabajo nuevo de la Misión A.
3. **Vigilar la telemetría nueva** tras el despliegue: hojas `acceso_uid` (llenar el padrón) y
   `acceso_deneg` (si aparecen denegaciones de un uid que DEBERÍA tener permiso, el padrón
   está mal armado — revisar `acceso`).
4. Propuesta abierta (decisión del dueño): mover la cerradura real al servidor (Apps Script
   rechaza `UsuarioId` fuera del padrón por endpoint), ver `ACCESO/00_ESTADO_ACCESO.md`.

## 9. Reglas duras del repo (no negociables, aprendidas a golpes)

- NO abras el userscript completo: anclas únicas + lectura local ±40 líneas (sección 3).
- NO ejecutes dos ediciones en paralelo sobre el mismo archivo.
- Un bump de versión son CUATRO puntos sincronizados (sección 3) o la suite_30 rompe el banco.
- `Codigo.gs` es ES5 puro (Apps Script): sin template literals, sin `const` en loops que
  exijan ES5, sin `Number.isInteger` — el saneo de `cuentas` ya está escrito en ES5, cópialo
  de ahí si necesitas saneo nuevo.
- CERO PHI en repo, tests, telemetría o reportes (claves de telemetría saneadas: sin nombres,
  sin 6+ dígitos seguidos).
- NO edites `tests/harness.js` — los tests se adaptan al harness, no al revés.
- Commits selectivos por rutas; JAMÁS `git add -A` (protege `ESTABILIDAD/` y temporales).
- JAMÁS un token dentro de un archivo commiteado (ni "ya revocado").
- El mensaje de commit y el CHANGELOG van en el estilo del repo: qué cambió para el MÉDICO,
  no para el programador (ver `CHANGELOG.md` entrada 18.1.0 y `git log` reciente).

## 10. Seguridad y PAT

- El PAT provisto para esta sesión resultó invalidado (401 `Bad credentials`, sección 1);
  no quedó copiado en NINGÚN archivo del repo ni de configuración local. GitHub no ofrece
  auto-revocación vía API: **la revocación es manual** — Dueño: GitHub → Settings →
  Developer settings → Personal access tokens → borrar el token viejo y el nuevo cuando
  termine la publicación. Si aparece otro token con scope `gist`/`repo`, trátalo igual:
  úsalo UNA vez por línea de comando y revócalo después.
- El gist y el repo son públicos: cualquier cosa que subas la ve el mundo. La regla de cero
  PHI no es negociable por eso mismo.

— Fin del reporte. Banco 3317/0, sintaxis OK, PADRÓN por armar, TABLERO por desplegar
PRIMERO. Buena suerte.
