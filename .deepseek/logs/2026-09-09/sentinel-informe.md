# SENTINEL · Auditoría de seguridad — 2026-09-09 — rama sentinel/nocturno-2026-09-09

## Estado de la entrega

**EN CURSO** (no se activó el protocolo de la sección 5: ni PHI en tránsito no
protegida, ni XSS ejecutable demostrable). Ningún commit nuevo esta noche — el
banco de pruebas se corrió como baseline (verde) y no se aplicó ninguna
corrección, porque no surgió ningún hallazgo demostrado de bajo riesgo que no
tocara el flujo en vivo del médico.

## Resumen ejecutivo (sin PHI)

La superficie XSS del userscript sigue sólida: 144 sumideros `innerHTML` + 3
`insertAdjacentHTML` + 2 `document.write`, 248 llamadas a `escapeHtml()`, cero
`eval`/`new Function`, cero `@require` remotos. La barrera cero-identificables
del redactor IA tiene un único punto de salida verificado en código (justo
antes del único `GM_xmlhttpRequest` a los tres proveedores de IA) — la lección
v17.45.0 sigue cerrada arquitectónicamente. El hallazgo real de la noche es de
gestión de secretos: las claves de IA y la contraseña institucional de Athenea
se protegen con ofuscación XOR reversible (no cifrado), con la clave de
ofuscación fija en el código PÚBLICO — mientras el propio repo ya tiene un
módulo de cifrado real (AES-GCM 256, clave aleatoria por equipo) usado para
los datos de pacientes en disco. No se corrigió esta noche: migrar las claves
requiere volver asíncronos varios puntos de lectura usados en vivo durante el
login a Athenea y la generación de notas con IA — alto riesgo de romper flujo
del médico sin poder verificarlo en Chromium contra el portal real.

## Inventario auditado (con anclas verificadas)

**2.1 Sumideros XSS** — `grep -c "\.innerHTML"` → 144; `insertAdjacentHTML` → 3;
`document.write` → 2; `escapeHtml(` → 248 usos; definición en
`vigilante_agenda.user.js:37913`. `eval(`/`new Function(` → 0 apariciones reales.
Barrido dirigido (script Node ad-hoc, sin persistir) de las 144 asignaciones
`innerHTML=`: 9 bloques con `${...}` y sin `escapeHtml` en la misma línea de
grep; los 9 se verificaron manualmente (líneas 17596, 27655, 29729/29713-29727,
31001, 31225, 32789, 36420, 36631, 37176) — todos interpolan solo números,
constantes de color (`COLORS.*`), o variables ya escapadas en un paso previo
(p. ej. `filas`/`_filasLlenar` en 29713-29727, con `escapeHtml(d.clave)` etc.
por cada campo). Sin hallazgo nuevo de escape faltante.

**2.2 Fugas de PHI** — `vglLog()` (`vigilante_agenda.user.js:1069`) pasa cada
campo string de `details` por `sanitizePII()` antes de `console.log` y antes de
persistir en el flight recorder local (`localStorage`, nunca se transmite).
Barrido de 148 `console.log/info/debug/warn`: los que interpolan datos
sensibles usan enmascarado explícito (`_mtrCelularMascarado`, `sanitizePII`);
no se halló ningún `JSON.stringify(err.contexto)` ni volcado de objeto crudo
con campos de paciente. Telemetría de red: `uxTrack()`
(`vigilante_agenda.user.js:14434`) fuerza la clave de acción por
`uxClaveLimpia()` (solo `[a-z0-9./:_-]`, catálogo fijo) y de `extra` SOLO lee
`extra.n` (numérico) — cualquier otro campo pasado por el llamador (p. ej.
`{pacientes: escritos}`) se descarta antes de llegar al buffer que se
transmite. Consistente con `docs/AUDITORIA_TELEMETRIA_EXPORT_20260907.md`
(barrera PHI LIMPIA, 0 tiras de 6+ dígitos en 86.183 filas reales). Almacén:
la carpeta local de pacientes usa AES-GCM 256 (suite 69, verde). No se
encontraron claves GM/localStorage nuevas con PHI en claro.

**2.3 Claves de IA — HALLAZGO (ver tabla)** — `_vglOfusca`/`_vglDesofusca`
(`vigilante_agenda.user.js:2449-2451`) implementan XOR con clave estática
`"Vgl-Athenea-2026-local"` + base64, con comentario propio del código que ya
lo llama «Ofuscación reversible... anti-vistazo, NO cifrado». Protege: la
contraseña institucional de Athenea (`ATH_CRED_KEY`) y las tres claves de IA
(`MTR_GEMINI_KEY` L48158, `MTR_ZAI_KEY` L48196, y la de DeepSeek L48203).
Barrido de secretos reales en el repo (patrones `sk-`, `api_key=`, `Bearer `,
`AIza`) sobre userscript/tests/docs/scripts: **0 coincidencias** — ningún
secreto real vive en el repo público. El propio repo documenta la decisión en
`docs/SECRETOS_EXPUESTOS.md` §3.5 (para las credenciales de Athenea,
v17.6.28/v12.5.2) con compensación declarada (rotación periódica en el
servidor real). Rotación: cambiar la clave en Ajustes sobreescribe
directamente `GM_setValue`, sin caché vieja que siga usándose — no hay bug de
rotación.

**2.4 BroadcastChannel** — un solo canal, `"vgl"` (`vigilante_agenda.user.js:11106`).
El receptor valida forma antes de aceptar (`_vglChanMsgValido`,
línea 11101-11105: exige `t` numérico finito y `list` array ≤500) — cumple (a)
y (d). `share(processed)` (línea 11313, llamado en 38211) transmite la lista
de citas de la agenda (incluye nombre y cédula del paciente, ya que es la
misma lista que se pinta con `escapeHtml` en las tarjetas) EN CLARO entre
pestañas del mismo origen — no cifrada. El propio código documenta la
decisión (línea 11094-11098): el canal es same-origin, así que cualquiera con
capacidad de inyectar en él ya puede leer `localStorage` directamente sin
pasar por el canal — cifrar el mensaje no añadiría protección real contra ese
modelo de amenaza. No hay evaluación de código ni interpolación sin escapar
del contenido del mensaje en un sumidero (se re-renderiza con las mismas
funciones `escapeHtml` que la ruta normal). Se deja constancia en el
inventario porque la sección 2.4(c) lo exige explícitamente; no se reclasifica
como hallazgo nuevo — es una decisión ya razonada y documentada.

**2.5 Integridad de dependencias** — `@require`/`@resource`: 0 apariciones.
`@grant`: 6 declarados (`GM_xmlhttpRequest`, `GM_setValue`, `GM_getValue`,
`GM_listValues`, `GM_deleteValue`, `GM_notification`) — los 6 tienen uso real
verificado (`GM_setValue` 47, `GM_getValue` 43, `GM_deleteValue` 5,
`GM_listValues` 1, `GM_notification` 1, `GM_xmlhttpRequest` 40): ningún grant
de más. `@connect`: 15 dominios, todos identificables como servidores propios
o de la IPS/Athenea/Microsoft/Google Apps Script/proveedores de IA
configurados por el médico — sin CDN ni dominio ajeno sin explicar.

**2.6 Barrera cero-identificables** — Punto único de salida confirmado por
lectura de código: `mtrGeminiRedactar` (línea 49615) construye `p =
mtrRedaccionPrompt(...)`, aplica `mtrBarreraIdentificables(p.system, p.user,
...)` en la línea 49664 (bloquea y cuenta en telemetría sin generar si
dispara), y el ÚNICO `GM_xmlhttpRequest` de IA (línea 49741) envía
exclusivamente `prov.cuerpo(modelo, p.system, p.user, modo)` — los tres
`cuerpo()` de los proveedores (z.ai L49476, Gemini, DeepSeek) solo leen
`system`/`user`, ningún tercer campo. No se halló ruta alterna. Suites
verdes: `suite_81_barrera_ia.js` (6/6), `suite_44_grounding_sin_phi.js`,
`suite_96_grounding.js`, `suite_57_ia_redaccion.js` (176 ok dentro del banco).

## Hallazgos

| id | severidad CVSS-style | descripción (sin PHI) | explotabilidad | corrección |
|---|---|---|---|---|
| SENT-01 | AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N ≈ **6.2 (medio)** | Contraseña institucional de Athenea y 3 claves de proveedores de IA se guardan con ofuscación XOR+base64 reversible (`_vglOfusca`), con la clave XOR estática **en el código público**. El repo ya tiene un módulo AES-GCM 256 con clave aleatoria por equipo (usado para el caché de pacientes en disco) que ofrece protección real y no se reutiliza aquí. | Requiere lectura del valor almacenado en GM/localStorage del equipo del médico (acceso local, técnico o vía copia de respaldo/perfil sincronizado) — no remoto, no requiere ejecutar el userscript. Con el valor + el código público (que ya trae la clave XOR) se recupera la credencial/clave en texto claro sin necesidad de acceso adicional al equipo. | **No corregido esta noche** (ver «requiere decisión»). |
| SENT-02 | informativo (sospecha a verificar, no vulnerabilidad) | `BroadcastChannel("vgl")` transporta la lista de citas (nombre, cédula) en claro entre pestañas del mismo origen. | Ya documentado y razonado en el propio código: mismo origen ⇒ cualquiera con capacidad de inyectar ya lee `localStorage` sin pasar por el canal. No se demuestra explotación adicional. | Sin corrección — decisión de arquitectura ya tomada y documentada; se deja registrada para que el orquestador la revise si el modelo de amenaza cambia (p. ej. extensiones de terceros con acceso al mismo origen). |

## Correcciones entregadas

Ninguna. No hubo hallazgo demostrado que fuera simultáneamente (a) de bajo
riesgo de producto y (b) corregible sin tocar el flujo en vivo del médico
(login a Athenea, generación de notas con IA) sin verificación en Chromium
contra el portal real — condición que esta sesión no puede cumplir de forma
responsable. `tests/INFORME_MUTACIONES.md` no recibe fila nueva porque no se
mutó ningún comportamiento.

## Hallazgos que requieren decisión

- **SENT-01** (tabla arriba): migrar `_vglOfusca`/`_vglDesofusca` a un envoltorio
  AES-GCM análogo al de la carpeta local cifrada (clave aleatoria por equipo,
  ya generada y persistida ahí en `VGL_CARPETA_CLAVE_GM`) es la corrección
  natural — pero exige volver asíncronas varias lecturas hoy síncronas
  (`mtrLeerClaveDeepseek`/`mtrLeerClaveZai`/`mtrLeerClaveGemini`,
  `atheneaCredsGet`) usadas en rutas en vivo (auto-login de Athenea al abrir
  cada historia clínica; escalera de proveedores de IA en cada generación de
  nota). Un error de tipeo en esa conversión rompe el auto-login institucional
  o la redacción IA para toda la sede sin aviso previo — exactamente la clase
  de cambio que CLAUDE.md reserva para verificación empírica en vivo, no para
  una sesión nocturna sin médico presente. Recomendación: acometerlo como
  tarea propia, de día, con Chromium contra capturas reales de Athenea y
  reintentos de IA, no como parche nocturno.

## No auditado / limitaciones

- No se ejercitó dinámicamente cada uno de los 144 sumideros `innerHTML` con
  cargas canónicas en `tests/harness.js` (los 9 candidatos sin `escapeHtml`
  visible en la línea de grep se verificaron por lectura de código, no con
  una prueba roja nueva) — el banco existente (`suite_31`, 1315 líneas) ya
  cubre una fracción amplia con inyección real; una pasada exhaustiva
  sumidero-por-sumidero con harness excede el tiempo de una sesión.
  Análisis estático razonado, marcado como tal.
- No se auditó el servidor Apps Script (`TABLERO/`) — fuera de alcance por
  prompt (sección 8).
- No se verificó en Chromium ningún flujo de UI esta noche (no hubo cambio de
  CSS/DOM que lo exigiera).
- El barrido de secretos fue por patrones conocidos (`sk-`, `Bearer `,
  `api_key=`, `AIza...`); un secreto con forma atípica no habría aparecido.

## Banco de pruebas

`node tests/runner.js` — EXIT=0. `comprobaciones : 3774 pasan`. `funciones
cubiertas: 1037 / 1367 públicas (75.9%)`. Sin fallos. Corrida completa capturada
como baseline de la noche (sin mutaciones aplicadas después, banco no se
volvió a correr tras el baseline porque no hubo edición de código).

## Commits de la rama

Ninguno nuevo esta noche (rama en `70e5cc5`, sin cambios).
