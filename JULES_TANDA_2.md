# Tanda 2 — prompts listos para Jules

> **Cómo se usa:** una tarea por sesión de Jules. Copia el bloque `## TAREA X` COMPLETO y
> pégalo como única instrucción. En el panel de Jules, **selecciona siempre la rama base
> `claude/pym-agenda-blindaje-v12-4`** — nunca `main`, que está 100+ commits atrás y no
> tiene ni `AGENTS.md` ni `CLAUDE.md`.

## Línea base de HOY (verifícala antes de lanzar)

```
node tests/runner.js
  comprobaciones : 756 pasan
  funciones cubiertas: 330 / 355  (93.0%)
  (sin bloque "sin cubrir": ya no queda ninguna función alcanzable sin prueba)
```

Si tu copia local no da 756, actualiza la rama antes de lanzar nada.

## Qué NO está aquí, y por qué

La auditoría produjo 20 tareas; entrego 18. Dos se cayeron porque ya las resolví
directamente mientras la auditoría corría:

- **Reparar suite_05** (las 8 pruebas async huérfanas de `AsignarTurno`/`GuardarOrdenamiento`)
  — hecho en `dcb065a`. La suite pasó de un falso "1 ok" a 10 pruebas reales.
- **Reparar suite_07** (2 huérfanas más del lector de Excel) — mismo commit.

Y se descartaron 7 candidatas más en la propia auditoría, por un verificador escéptico
que las contrastó contra el código real. Los motivos están al final de este archivo.

**Tres tareas me las quedo yo, no se delegan** (regla de `CLAUDE.md`: el CSS de producción
y todo lo que toque PHI lo hago directo):
1. La insignia SUGERIDO pierde su color en tema claro (bug real de v12.10.8) — hay que
   verificarlo en Chromium con `getComputedStyle`, no con un `includes()`.
2. Terminar de redactar identidad en las capturas versionadas — delegar una fuga de PHI
   *es* la fuga.
3. `!important` en la línea 6335 y los ids muertos `#vgl-examen-*`.

## Orden de lanzamiento

**Lánzalas en este orden. Las del grupo A van TODAS en paralelo, ya.**

| Grupo | Tareas | Cuándo |
|---|---|---|
| **A** | A2, A3, A4, A5, A7, A8 | **Ahora, las 6 en paralelo.** Tocan suites distintas. |
| **B** | B1, B2, B3, B4, B5 | Cada una declara su precondición al inicio. B1→B2 en cadena. |
| **C** | C1, C2, C3, C5 en paralelo; C4 tras C1 | Tocan `vigilante_agenda.user.js`. Ver aviso ⚠ abajo. |
| **D** | D1 (tras B4), D2 (tras B5) | Al final. |

### ⚠ El único choque real

Todo PR que toque `vigilante_agenda.user.js` debe subir **las dos** versiones:
`@version` (línea 4) y `const VERSION` (línea ~941). `suite_23` exige que coincidan.
Dos PRs paralelos chocarán ahí — es trivial de resolver (gana el número más alto), pero
**fusiónalos de uno en uno**, no en lote. Afecta a A8, C1-C5 y D1.

`tests/INFORME_MUTACIONES.md` lo tocan casi todas, pero es un *append* al final: el
conflicto se resuelve conservando ambas filas y no cuenta como bloqueo.

---

## TAREA A2 — Suite 08: las dos guardas sin cubrir de `injectLabsIntoCronicos`
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** Dos mutaciones sobreviven hoy al banco entero (756/756). Una toca la regla dura "casilla vacía antes que dato inventado" en su forma más literal: un componente de orina que Athenea marca como PENDIENTE (`idEstado:1`) pero que trae un valor con pinta de resultado real NO puede llegar a la historia clínica.
**Ubicación exacta:** `vigilante_agenda.user.js` **L2304**, dentro de la clausura `inyectarComponenteOrina` (declarada en L2292, dentro de `injectLabsIntoCronicos` L2262): `if (Number(lab.idEstado) === 1 || String(resultVal).trim().toUpperCase() === "PENDIENTE") { pendientes++; ...`. Y **L2268**, primera guarda de `injectLabsIntoCronicos`: `if (!Array.isArray(labsArray)) return { count: 0, pendientes: 0, sinCasilla: [], respetadas: 0, uroanalisisMarcado: false };`. Los casos nuevos van en `tests/suite_08_labs_cronicos.js` como HERMANOS, insertados **después de la línea 910** (el `});` que cierra el caso "_ultimaFechaPorAnalito: Resultado 'PENDIENTE' sin idEstado…") y antes de la línea 912.
**Qué hacer:** añade DOS `t.caso` usando la instancia compartida `c` y `testApi` que la suite ya tiene montadas al inicio.
1. **Ruta de orina** — copia el patrón de montaje del caso de la línea 398 (guardar `prevQSA`, sustituir `querySelectorAll`, restaurar):
   ```js
   mockDOM = {};
   const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
   const prevQSA = c.env.doc.querySelectorAll;
   c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputNitritos] : []);
   const res = testApi.injectLabsIntoCronicos([
     { NombreParametro: "NITRITOS", NombreParametroPadre: "PARCIAL DE ORINA", Resultado: "NEGATIVO", idEstado: 1 }
   ]);
   c.env.doc.querySelectorAll = prevQSA;
   ```
   Asertar `res.pendientes === 1`, `res.count === 0` y `inputNitritos.value === ""`. El `dispatchEvent: () => {}` del input falso es **obligatorio**: sin él, bajo la mutación el caso muere por `TypeError` en `setNgValue` en vez de por la aserción, y se pondría rojo por el motivo equivocado.
2. **Entrada que no es arreglo** — llamar `injectLabsIntoCronicos` con `null`, `undefined`, `"no es un arreglo"` y `{}`, y asertar en las CUATRO las cinco claves por separado y con igualdad exacta: `count === 0`, `pendientes === 0`, `Array.isArray(sinCasilla) && sinCasilla.length === 0`, `respetadas === 0`, `uroanalisisMarcado === false`. No vale `t.noLanza(...)` ni comprobar una sola clave: la mutación devuelve `{}`, que no lanza y cuyas claves valen `undefined`.

**Qué NO hacer:** NO toques `vigilante_agenda.user.js`. NO añadas un caso para la rama SÉRICA de `idEstado` (L2247): ya está cubierta por los casos de las líneas 887 y 899 y esa mutación ya se pone roja hoy. NO anides los casos: van como hermanos.
**Advertencias técnicas del arnés:** la instancia compartida de esta suite ya trae el shim `c.ctx.Event` (línea 18) y un `getElementById` que devuelve `null` si la clave no está en `mockDOM` — reutilízalos, no cargues una instancia nueva.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Laboratorios Crónicos (Suite 08)" sube de **93 a exactamente 95** y el total de **756 a 758**. `node -c tests/suite_08_labs_cronicos.js` sin error. Verificado por mí: con este montaje el resultado es exactamente `{"count":0,"pendientes":1,"sinCasilla":[],"respetadas":0,"uroanalisisMarcado":false}` y el input queda en `""`.
**Mutación obligatoria:** (a) L2304 `Number(lab.idEstado) === 1` → `=== 2`: debe ponerse roja **exactamente la prueba nueva de orina, nombrada por su título**, y ninguna otra (comprobado: 94 ok / 1 FALLAN). (b) L2268 → `return {};`: debe ponerse roja **exactamente la prueba nueva de entrada no-arreglo** (comprobado: 94 ok / 1 FALLAN). Restaurar tras cada una y confirmar verde. Dos filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA A3 — Suite 10: la tanda de eventos vuelve a la cola (tope 200) si falla la escritura
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** `evFlush()` reencola la tanda cuando `writeJSON` falla (cuota llena del navegador) para que la bitácora de auditoría no se pierda. Hoy ninguna prueba hace fallar la escritura, así que ese reencolado y su tope de 200 no están protegidos.
**Ubicación exacta:** `vigilante_agenda.user.js` **L4119**, dentro de `evFlush()` (L4109-L4121): `if (!writeJSON(k, hoy.length > 3000 ? hoy.slice(-3000) : hoy)) evBuffer = pend.concat(evBuffer).slice(-200);`. Los casos nuevos van en `tests/suite_10_eventos_auditoria.js` como HERMANOS de los de las líneas 221-240, con el helper `leerJSON(c, clave)` que la suite ya define (línea 23).
**Qué hacer:** añade DOS `t.caso` (síncronos, como todos los de esta suite):
1. **La tanda no se pierde:** `cargar({ silencioso: true })` propio; `c.api.logEvent({ev:"X1"}); c.api.logEvent({ev:"X2"});`; guardar `c.env.win.localStorage.setItem` y sustituirlo por `() => { throw new Error("QuotaExceededError"); }`; `c.api.evFlush();`; restaurar el `setItem` real; `c.api.evFlush();`; asertar que `leerJSON(c, c.api.evKey())` es exactamente `[{"ev":"X1"},{"ev":"X2"}]`, en ese orden.
2. **El tope:** mismo montaje pero metiendo 250 eventos (`{ev:"E"+i}`) con la escritura rota; tras restaurar y volver a vaciar, asertar `arr.length === 200`, `arr[0].ev === "E50"` y `arr[199].ev === "E249"` — se conservan los 200 MÁS RECIENTES.
   Documenta en un comentario del propio test una mecánica que despista: `logEvent` se auto-vacía al llegar a 200 (L4128 `if (evBuffer.length >= 200) { evFlush(); return; }`), así que meter 250 eventos con la escritura rota NO produce un solo flush de 250 sino ~51 flushes encadenados. El resultado final es el mismo y las tres cifras se sostienen (medidas y confirmadas), pero el mecanismo no es el que sugiere la lectura ingenua.

**Qué NO hacer:** NO toques `vigilante_agenda.user.js`. **NO uses como criterio la mutación del `catch` de L4120** (`evBuffer = []` → `{}`): es equivalente y sobrevivirá siempre, porque `evBuffer = []` ya se ejecutó dentro del `try` (L4115) y ni `readJSON` (L3016) ni `writeJSON` (L3031) lanzan jamás. Déjalo escrito así en el comentario del test.
**Advertencias técnicas del arnés:** `writeJSON` resuelve `localStorage` contra `win.localStorage`, por eso sustituir `c.env.win.localStorage.setItem` sí funciona; `readJSON` sigue leyendo bien mientras tanto.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Estadísticas, eventos y auditoría" sube de **24 a exactamente 26** y el total de **756 a 758**. `node -c tests/suite_10_eventos_auditoria.js` sin error. Verificado por mí: caso 1 devuelve `[{"ev":"X1"},{"ev":"X2"}]`; caso 2 devuelve `len=200`, `E50`, `E249`.
**Mutación obligatoria:** (a) quitar el reencolado de L4119 (dejar solo `writeJSON(k, ...)`) → el caso 1 debe ponerse ROJO (la bitácora queda vacía); restaurar. (b) `.slice(-200)` → `.slice(-2)` en esa misma línea → el caso 2 debe ponerse ROJO; restaurar y confirmar verde. Dos filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA A4 — Suite 12: las dos rutas de fallo del piloto que nadie ejercita
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** Dos mutaciones sobreviven hoy al banco entero. Una haría que una caché rota se hiciera pasar por base piloto cargada; la otra dejaría la cadena de reintentos de la base piloto en un solo intento cuando la carga RECHAZA en vez de devolver `false`.
**Ubicación exacta:** `vigilante_agenda.user.js` **L4661** (`} catch (e) { return false; }` dentro de `async function pilotoDesdeCache()`, L4650-L4662) y **L4908** (`const ok = await loadPymBase(baseIntentos < 3).catch(() => false);`, seguida de `if (!ok) schedulePymBase();` en L4909, dentro de `function schedulePymBase()` L4898-L4911). Los casos nuevos van en `tests/suite_12_sharepoint_piloto.js`: el primero justo después del caso de la línea 258, el segundo justo después del de la línea 483.
**Qué hacer:** añade DOS casos con `await t.casoAsync(...)` (**con `await`**, como todos los de esta suite), reutilizando los helpers ya definidos en la cabecera: `PILOTO_GUID` (L13), `dormir` (L39), `gmxhrPiloto` (L50), `contadorNuevo` (L67).
1. **Caché corrupta:** `const c = cargar({ silencioso: true }); c.env.gm["vgl_piloto"] = '{"v":3, ESTO NO ES JSON';` — empieza por el prefijo `{"v":3` para superar la guarda de L4653 (`raw.lastIndexOf('{"v":3', 0) !== 0`) y llegar a `unpackPym`, que hace `JSON.parse` y lanza: es la única vía a ese `catch`. Asertar `await c.api.pilotoDesdeCache() === false`, `c.api.__state.pymFile === ""`, `c.api.__state.pym.size === 0` y que `c.api.__state.pymFallback` es falso.
2. **`loadPymBase` rechaza:**
   ```js
   const cont = contadorNuevo("base_piloto.csv", "T");
   const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
   c.api.__CONFIG.SP.respaldo = { id: PILOTO_GUID, name: "base_piloto.csv" };
   c.api.schedulePymBase();
   await dormir(400);
   ```
   La palanca es **NO definir `c.ctx.TextDecoder`** (a diferencia del caso de la línea 483, que sí lo hace en la 486): así `readPym` lanza "TextDecoder is not defined", `loadPymBase` queda RECHAZADA en vez de devolver `false`, y el `.catch(() => false)` es lo único que mantiene viva la cadena de reintentos. Asertar `cont.descargas === 3` (la cadena completa, 3 de 3) y `c.api.__state.pymFile === ""`.

**Qué NO hacer:** NO toques `vigilante_agenda.user.js`. NO añadas `c.ctx.TextDecoder` al segundo caso: es justo la palanca. NO conviertas los casos en síncronos ni olvides el `await` delante de `t.casoAsync`.
**Advertencias técnicas del arnés:** los `setTimeout` están recortados a 1 ms (`harness.js:93`), por eso las esperas reales de 2 s / 45 s / 180 s del programador caben en `dormir(400)`.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "SharePoint y caché del piloto (Suite 12)" sube de **40 a exactamente 42** y el total de **756 a 758**. Verificado por mí: el caso 1 devuelve `false` con `pymFile=""`, `pym.size=0`, `pymFallback` falso; el caso 2 da `cont.descargas === 3` y `pymFile === ""`.
**Mutación obligatoria:** (a) L4661 `catch (e) { return false; }` → `return true;` → el caso 1 ROJO; restaurar. (b) L4908 `.catch(() => false)` → `.catch(() => true)` → `cont.descargas` pasa de 3 a 1 y el caso 2 se pone ROJO; restaurar y confirmar verde. Dos filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA A5 — Probar de verdad el enmascarado anti-PHI de `downloadDiagnostic`
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** El archivo se llama `diagnostico_vigilante_SANITIZADO.txt` y es lo que el médico descarga y ENVÍA a soporte. Regla dura del proyecto: cero PHI. Hoy la única prueba corre con `state.pym` y `state.lastSnapshot` VACÍOS, así que el bloque de cruce emite "(ninguna)" y "(sin lectura)" y el enmascarado **no se ejecuta ni una vez**: si se rompe, el archivo sale con cédulas y el banco sigue verde.
**Ubicación exacta:** `vigilante_agenda.user.js` **L11820** (`const mask = (s) => ... s.slice(0,3) + "…(" + s.length + " díg.)"`), dentro de `function downloadDiagnostic()` (L11796-L11841). El caso nuevo va en `tests/suite_17_nucleo.js` como HERMANO, inmediatamente después del caso existente que empieza en la línea **359** ("downloadDiagnostic: genera el archivo sanitizado y lo descarga en local").
**Qué hacer:** añade UN `t.caso` que reutilice el patrón de captura del Blob ya probado en el caso vecino:
```js
const c = cargar({ silencioso: true });
let blobCapturado = null;
c.env.win.URL.createObjectURL = (b) => { blobCapturado = b; return "blob:diag"; };
// documentos y nombres INVENTADOS (regla de cero PHI)
c.api.__state.pym.set("1234567890", ["VIH"]);
c.api.__state.pym.set("1112223330", ["Citología"]);
c.api.__state.lastSnapshot = { list: [
  { doc_id: "1234567890", nombre: "PACIENTE FICTICIO UNO" },
  { doc_id: "9876543210", nombre: "PACIENTE FICTICIO DOS" }
] };
c.api.downloadDiagnostic();
const texto = String(blobCapturado.parts[0]);
```
Aserciones: (1) el texto NO contiene `"1234567890"` ni `"9876543210"`; (2) SÍ contiene `"123…(10 díg.)"` y `"987…(10 díg.)"`; (3) contiene la línea `"COINCIDEN:"`. Añade también, como red de seguridad, que no contenga `"PACIENTE FICTICIO"` — pero **documenta en un comentario que esa aserción pasa vacuamente**, porque `downloadDiagnostic` no vuelca el campo `nombre` en ningún punto: no cuenta como cobertura y la mutación no se comprueba contra ella.
**Qué NO hacer:** NO toques `vigilante_agenda.user.js`. NO uses ningún documento ni nombre real. NO modifiques el caso existente de la línea 359.
**Advertencias técnicas del arnés:** el Blob falso guarda su contenido en `blob.parts[0]`; el `<a>` de descarga aparece en `c.env.doc._nodos`.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Núcleo: bucles, latidos y utilidades GM" sube de **27 a exactamente 28** y el total de **756 a 757**. Verificado por mí: el bloque generado dice literalmente `Muestra de claves de la base: 123…(10 díg.) · 111…(10 díg.)` y `Citas de hoy (2): 123…(10 díg.)✓ · 987…(10 díg.)✗ / COINCIDEN: 1/2`.
**Mutación obligatoria:** L11820 `const mask = (s) => { ... };` → `const mask = (s) => String(s);` → deben ponerse rojas las aserciones (1) y (2) de la prueba nueva; restaurar y confirmar verde. Fila en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA A7 — Suite 25: dos guardas mecánicas de tokens CSS (Regla C y Regla D)
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** Una `var(--x)` sin declarar NO da error: el navegador descarta la declaración y el elemento hereda el color de Everest (azul). Es el modo de fallo del incidente v12.6.6, donde `#vgl-labsv-modal` y `#vgl-postcita-panel` faltaban en la lista de tokens y el aviso salía como texto suelto sobre la pantalla del EHR. AGENTS.md ya obliga a "confirmar con grep que la variable está REALMENTE definida", pero hoy eso es disciplina humana y nada lo verifica.
**Ubicación exacta:** `tests/suite_25_cascada_css.js` — dos `t.caso` HERMANOS insertados **después del `});` de la línea 211** (cierre de "Regla B - !important contra estilo inline") y **antes del `}` de la línea 213**. Reutiliza el extractor de CSS que la suite ya tiene en las líneas 10-16 (recorta desde `style.textContent = \`` hasta el primer `` `; ``; captura las líneas 6111-7967 del userscript, 1857 líneas). No se toca `vigilante_agenda.user.js`.
**Qué hacer:**
1. **`"Regla C - toda var(--X) que consume la hoja está declarada"`**: sobre el CSS extraído, **quita primero los comentarios** (`css.replace(/\/\*[\s\S]*?\*\//g, "")` — sin este paso entran dos falsos positivos, `--c-` y `--rgb-x`, que vienen de comentarios y de plantillas dinámicas). Recolecta USADAS con `/var\(\s*(--[A-Za-z0-9_-]+)/g` y DECLARADAS con `/(?:^|[;{,\s])(--[A-Za-z0-9_-]+)\s*:/g`. Falla listando `USADAS − DECLARADAS` si no queda vacío **salvo una lista blanca de exactamente tres entradas**, comentada:
   - `--ac` y `--ac-rgb` → los inyecta JavaScript como estilo inline en la línea 5299 (`pymAlert`/modal genérico).
   - `--tk` → lo inyecta JavaScript como estilo inline en la línea 5524 (`_renderToast`), y la hoja lo consume en la 6900.
   Escribe también en el comentario la **limitación**: esta guarda demuestra que el token está declarado en ALGÚN sitio de la hoja, NO que llegue al elemento (un elemento fuera de las listas de ids pasa esta guarda estando roto en runtime). Y **NO compruebes la dirección inversa** (declarada-y-sin-usar): hoy hay 15 tokens en ese caso, entre ellos `--rgb-atendido`, que se consume desde JavaScript en la línea 11474, y los tokens de escala tipográfica y de capas que están pendientes de conectar.
2. **`"Regla D - paridad de tokens claro/oscuro y un token por cada color de COLORS"`**, dos aserciones en un solo caso:
   - Extrae los ids de la lista oscura (userscript línea **6124**) con `/#([a-z0-9-]+)/g` y los de la lista clara (líneas **6196-6197**) con `/#([a-z0-9-]+)\.light/g` — ojo: hay que casar `.light` explícitamente, si usas la misma regex en ambos la comparación es trivialmente cierta. Falla si algún id del bloque oscuro no tiene gemelo `.light`. Hoy: 15 = 15, pasa.
   - Lee las claves de `const COLORS = {...}` (userscript línea **3228**: VERDE, AMBAR, ROJO, AZUL, MORADO) y comprueba que para cada clave en minúscula existen en el CSS `--c-<clave>:` y `--rgb-<clave>:`. Hoy los 10 existen, pasa.
   Localiza los bloques por su contenido, no por número de línea fijo (hay otras dos listas de ids, en 6307 y 6343, que no son estas).
   Justificación que va en el comentario: la línea 11474 usa `rgba(var(--trgb),${alfa})` y la 11561 fija `--trgb:var(--rgb-${clave})` **sin valor de respaldo**, así que una clave nueva en `COLORS` sin su token `--rgb-*` volvería inválido ese `rgba()` y la tarjeta heredaría el azul de Everest.

**Qué NO hacer:** NO toques `vigilante_agenda.user.js` (el CSS de producción lo hace Claude). NO modifiques Regla A ni Regla B. NO escribas un extractor nuevo.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Cascada CSS" sube de **2 a exactamente 4** y el total de **756 a 758**. Verificado por mí sobre el archivo de hoy: 49 usadas, 61 declaradas, y `USADAS − DECLARADAS` es exactamente `{--ac, --ac-rgb, --tk}`.
**Mutación obligatoria:** (a) Regla C — cambiar en el userscript la línea **6340** `background:var(--c-verde, #16a34a)` por `background:var(--c-noexiste)` → la Regla C debe ponerse ROJA **nombrando `--c-noexiste`**; revertir. (b) Regla D — borrar de la línea 6197 la cadena `,#vgl-postcita-panel.light` (la coma va DELANTE; la línea termina en `{`, no hay coma detrás) → la Regla D debe ponerse ROJA; revertir. (c) Regla D — añadir `TURQUESA: "#0ff"` a `COLORS` (línea 3228) → ROJA, porque no existe `--c-turquesa`; revertir. **No uses `PES` para esta mutación: `--c-pes` y `--rgb-pes` SÍ existen y el test se quedaría verde.** Confirma verde tras cada reversión. Tres filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance (`git diff --stat`: solo `tests/`) / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA A8 — Eje B: `clasificaCupoAgenda` y corregir el comentario que dice que no hay evidencia
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** Un comentario del código afirma que "no hay evidencia real de qué campo de la respuesta de Everest marca una agenda como Adicional", y por eso el Eje B (cupos adicionales) quedó sin conectar. **Ese comentario es falso**: la evidencia está en el repo. Esta tarea crea la función pura de clasificación y corrige el comentario. No conecta nada al modal.
**Ubicación exacta:**
- Función nueva en `vigilante_agenda.user.js`, entre la línea **8595** (el `}` que cierra `recomendacionHorario`, declarada en 8550) y la línea **8597** (`function format12hTime`).
- Comentario a corregir: líneas **9460-9467**; la frase falsa ocupa **9464-9467**.
- Pruebas: `tests/suite_24_motor_perfil.js` (115 líneas, 12 casos, `pruebas(t, api)` síncrono), casos hermanos del último.
**Qué hacer:**
1. Implementa `function clasificaCupoAgenda(valorCampoAgenda)` — pura, sin DOM, sin red — que devuelva `"normal"`, `"adicional"` o `"desconocido"`, normalizando igual que `perfilPaciente` (línea 8499): minúsculas, sin tildes, sin espacios de más. `"Adicional"` y `"Adicional-Staff"` → `"adicional"`; `"Normal"` → `"normal"`; cadena vacía, `null`, `undefined` o cualquier valor no visto → `"desconocido"` (**nunca** `"normal"`: asumir normal ante el silencio ofrecería un cupo que no existe).
2. Corrige el comentario 9464-9467 citando la evidencia real: en `captura_agendamiento_oficial_20260810.json`, cada agenda de `dtCitasDisponibles.data[]` trae el campo `agenda` con tres valores reales — `"Normal"` (15), `"Adicional"` (32) y `"Adicional-Staff"` (2) — y `SUPERPROMPT_AGENDA_V13.md` líneas 395-397 lo documenta. El comentario nuevo **no debe seguir diciendo que falta evidencia del campo**; si mantienes la referencia a `BACKLOG_MEJORAS.md #3`, tiene que ser para lo que ese backlog realmente dice que falta (la estadística de ocupación de esos cupos), no el campo.
3. Añade al menos 3 casos en `tests/suite_24_motor_perfil.js` con las TRES cadenas exactas de la captura (`"Adicional-Staff"` **con guion**, no "Adicional Staff") más `""`, `null` y `undefined` → `"desconocido"`.
4. Sube `@version` (línea 4) y `const VERSION` (línea 941) al mismo literal (hoy ambas en `12.10.8`).

**Qué NO hacer:** NO conectes la función a nada: no toques el modal, ni el bucle de 9668-9685, ni el pintado de 9754-9774. El cableado y su lenguaje visual (y la regla de colisión con la franja del Eje A) son trabajo de Claude. NO inventes más valores del campo `agenda` que los tres de la captura. NO metas ninguna cédula ni dato de paciente en las pruebas.
**Advertencias técnicas del arnés:** el arnés publica automáticamente las declaraciones `function NOMBRE` de primer nivel del IIFE (`tests/harness.js:156`), así que la función será probable por nombre **sin tocar `harness.js`**. **AVISO sobre la evidencia:** los cuerpos de respuesta de esa captura son cadenas JSON ESCAPADAS — `grep '"agenda"'` o un `require()` del JSON devuelven CERO. Búscalo en la forma escapada `\"agenda\":\"...\"` o desanida `network[].response`. Si no lo haces así vas a concluir que la evidencia no existe.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Motor de perfil (D3-bis)" sube de **12 a al menos 15** y el total nunca baja de **756**. `git diff` no debe tocar ninguna función existente salvo el bloque de comentario 9460-9467 y las dos líneas de versión.
**Mutación obligatoria:** hacer que el valor desconocido devuelva `"normal"` en vez de `"desconocido"` → debe caer una prueba nueva con nombre explícito; restaurar y confirmar verde. Fila en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA B1 — Las guardas del SMS al paciente en `apiAccesoAsignarTurno` (requiere A1 fusionada)
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!) — **empieza solo si `node tests/runner.js 05` ya imprime `10 ok`.** Si imprime `1 ok` o menos de 10, la reparación previa de suite_05 no está fusionada: detente y dilo.
**Contexto:** En las telemetrías del propio consultorio hay un mismo celular registrado para DOS pacientes distintos. Un SMS mal disparado le cuenta a un tercero la fecha de cita de otra persona: fuga de PHI. Las tres guardas que lo impiden no tienen hoy ni una aserción, y el aviso de fallo del envío tampoco.
**Ubicación exacta:** `vigilante_agenda.user.js`, `async function apiAccesoAsignarTurno(...)` (L8798-L8850). Bloque SMS L8819-L8847: `const creada = ...` (**L8832**), `if (creada && S.smsRecordatorio && cel.length >= 7)` (**L8839**), el envío por `(FETCH0 || window.fetch)` (**L8841**) y su `.catch(...)` (**L8843**). Casos nuevos en `tests/suite_05_api_everest.js`, hermanos al final de la suite, todos con `await t.casoAsync`.
**Qué hacer:** cinco casos. Montaje común (los cuatro primeros comparten un mock de fetch que registra TODAS las URLs pedidas en un array):
```js
const urls = [];
const c = cargar({ silencioso: true, fetch: async (url) => { urls.push(String(url));
  return { ok:true, status:200, json: async () => ({ error:false, data:{ radicado:123 } }) }; } });
c.api.__state.activeDoctor = { id: 777, name: "MEDICO PRUEBA" };
c.api.__S.smsRecordatorio = true;
c.env.doc.querySelector = () => ({ getAttribute: () => "tok" });
await c.api.apiAccesoAsignarTurno("T1", "P1", "2026-09-15", "obs", false, "NA", null, "3001234567");
```
- (a) con ese montaje: alguna URL contiene `/api/SMS/EnviarSMS`, con `Telefono=3001234567` y `AgendaTurnoId=T1`. **Este caso es obligatorio y va primero**: demuestra que el SMS SÍ sale con el montaje, sin él los tres siguientes pasarían vacuamente.
- (b) igual pero `c.api.__S.smsRecordatorio = false` → NINGUNA URL contiene `EnviarSMS`.
- (c) igual con celular de 5 dígitos (`"12345"`) → NINGUNA URL contiene `EnviarSMS` (guarda `cel.length >= 7`).
- (d) igual pero con la cita NO creada (`{ error:true }`, y otro caso con `{ error:false, data:{ radicado:0 } }`) → NINGUNA URL contiene `EnviarSMS`.
- (e) **el fallo del SMS nunca es silencioso**: instancia nueva cuyo `fetch` RECHAZA (`throw new Error("red caida")`) cuando la url contiene `"EnviarSMS"` y resuelve normal para el resto; sustituye `c.ctx.console` por un espía de `warn`; tras `await` y ~40 ms, asertar que hay EXACTAMENTE 1 warn que empieza por la cadena **`"[Vigilante] falló el envío del SMS:"`** — con tildes en "falló" y "envío"; la versión sin tildes no existe en el archivo y el filtro devolvería 0.

**Qué NO hacer:** NO toques `vigilante_agenda.user.js`. NO uses ningún celular ni nombre real: `3001234567` y `"MEDICO PRUEBA"` son inventados. NO reasignes `c.env.win.fetch` después de `cargar()`.
**Advertencias técnicas del arnés:** (1) el celular es el **OCTAVO argumento posicional** — firma real `apiAccesoAsignarTurno(turnoId, pacienteId, fechaIso, observacion, isPyM, marcacion, programaId, celularSms)`; las dos pruebas que ya existen la llaman con 4 argumentos, así que no hay de dónde copiarlo. (2) `c.api.__state.activeDoctor` con `id` distinto de 0 es OBLIGATORIO: sin él la función aborta en L8804 y los casos (b), (c) y (d) pasan en falso. (3) `FETCH0` captura `window.fetch` al cargar: el mock va en `cargar({ fetch })`, nunca en `c.env.win.fetch`. (4) `S.smsRecordatorio` se conmuta con `c.api.__S.smsRecordatorio` y vale `true` por defecto.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Llamadas a Everest y clínicas" sube de **10 a exactamente 15** y el total sube en 5 respecto de la cifra que midas al empezar (756 → 761). Verificado por mí: con este montaje sale exactamente una URL `.../api/SMS/EnviarSMS?Telefono=3001234567&AgendaTurnoId=T1`, y en (e) exactamente un warn `[Vigilante] falló el envío del SMS: Error: red caida`.
**Mutación obligatoria:** (a) quitar `&& cel.length >= 7` de **L8839** → el caso (c) ROJO; restaurar. (b) quitar `creada &&` **de la L8839** (no del `else if` de la L8845) → el caso (d) ROJO; restaurar. (c) L8843 `.catch((e) => console.warn(...))` → `.catch((e) => {})` → el caso (e) ROJO; restaurar y confirmar verde. Tres filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA B2 — `_pageFetchJsonCore` NUNCA reintenta una escritura (requiere A1 y B1 fusionadas)
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!) — **empieza solo si `node tests/runner.js 05` ya imprime al menos `15 ok`.**
**Contexto:** El propio comentario del código (v11.0.1, L8261-8264) dice que el bug YA ocurrió: este núcleo reintentaba hasta 4 veces y en cada vuelta repetía la petición por una segunda vía (GM_xmlhttpRequest), hasta OCHO envíos del mismo POST — ocho citas para el mismo paciente, u ocho órdenes clínicas repetidas. Esa guardia no tiene hoy ninguna prueba.
**Ubicación exacta:** `vigilante_agenda.user.js`, `async function _pageFetchJsonCore(url, options)` (L8259-L8330): `esEscritura`/`maxRetries` en **L8266-L8267**, reintento por 5xx en **L8281**, `return null` de 4xx en **L8284**, y la guardia que corta antes del respaldo GM en **L8296** (`if (esEscritura) { console.warn(...); return null; }`). Casos nuevos en `tests/suite_05_api_everest.js`, hermanos al final, todos con `await t.casoAsync`.
**Qué hacer:** cuatro casos. Montaje común, **con contador doble y un `gmxhr` que LIQUIDE la promesa**:
```js
const cont = { fetch: 0, gm: 0 };
const c = cargar({ silencioso: true,
  fetch: async () => { cont.fetch++; return { ok:false, status:500, json: async () => ({}) }; },
  gmxhr: (o) => { cont.gm++; o.onerror(new Error("red")); } });
c.env.doc.querySelector = () => ({ getAttribute: () => "tok" });
```
- (a) `await c.api._pageFetchJsonCore("/x", { method:"POST", body:"{}" })` → devuelve `null`, `cont.fetch === 1` (NO reintenta) y **`cont.gm === 0`** (no se reenvía por la segunda vía).
- (b) GET que devuelve 500 → `null`, `cont.fetch === 4` (1 + 3 reintentos) y `cont.gm === 4`.
- (c) GET que devuelve 404 → `null`, `cont.fetch === 1`, `cont.gm === 0` (4xx no reintenta).
- (d) POST con `options.__idempotent === true` y 500 → `null`, `cont.fetch === 4`, `cont.gm === 4` (sí reintenta, es la excepción explícita).

**Qué NO hacer:** NO toques `vigilante_agenda.user.js`. NO omitas el `gmxhr` en ningún caso.
**Advertencias técnicas del arnés:** **el `gmxhr` que liquida la promesa es obligatorio**: el arnés pone por defecto `win.GM_xmlhttpRequest = o.gmxhr || (() => {})`, un no-op que nunca llama a `onload`/`onerror`/`ontimeout`, así que el `await new Promise(...)` de L8299 no resuelve JAMÁS y el runner (que no tiene timeout por caso) se cuelga para siempre. Los `setTimeout` entre reintentos (300/600/1200 ms) están recortados a 1 ms (`harness.js:93`), así que el caso (b) no tarda.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Llamadas a Everest y clínicas" sube de **14 a exactamente 18** y el total sube en 4 respecto de la cifra que midas al empezar. Verificado por mí llamando a la función: (a) 1/0, (b) 4/4, (c) 1/0, (d) 4/4.
**Mutación obligatoria:** neutralizar la guardia de **L8296** (`if (esEscritura) {...}` → `if (false) {...}`) → el caso (a) debe ponerse ROJO porque `cont.gm` pasa de 0 a 1; restaurar y confirmar verde. **NO uses como mutación `const maxRetries = esEscritura ? 0 : 3;` → `= 3;`: la verifiqué y SOBREVIVE**, porque la guardia de L8296 corta antes de que `maxRetries` importe. Fila en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA B3 — Suite 08: el aviso "no se reconoció ninguna fecha" sale UNA sola vez por sesión
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!) — va después de la tarea de las dos guardas de labs (mismo archivo).
**Contexto:** El candado `_diagLabFechaLogged` evita que el diagnóstico de fechas de Athenea inunde la consola del médico en cada corrida. Tres mutaciones de ese bloque sobreviven hoy al banco entero.
**Ubicación exacta:** `vigilante_agenda.user.js`: bandera en **L2049** (`let _diagLabFechaLogged = false;`) y bloque en **L2409-L2411**, dentro del `forEach` de `candidatosPorClave` en `injectLabsIntoCronicos`. El caso nuevo va en `tests/suite_08_labs_cronicos.js` como HERMANO, al final de los casos de `injectLabsIntoCronicos`.
**Qué hacer:** UN `t.caso` que use instancias NUEVAS (`cargar({ silencioso: true })`), obligatorio porque `_diagLabFechaLogged` es una bandera de módulo de una-sola-vez-por-sesión y la instancia compartida de la suite puede haberla encendido ya.
```js
const EventShim = class Event { constructor(tipo, init) { this.type = tipo; this.bubbles = !!(init && init.bubbles); } };
const PREFIJO = "[Vigilante] diagnóstico: no se reconoció ninguna fecha";
const c = cargar({ silencioso: true });
c.ctx.Event = EventShim;                      // OBLIGATORIO, ver advertencias
const warns = [];
c.ctx.console = { log: () => {}, warn: (...a) => warns.push(a.map(String).join(" ")), error: () => {}, info: () => {}, debug: () => {} };
const dom = { resultadoColesterolTotal: { value: "" }, resultadoTrigliceridos: { value: "" } };
c.env.doc.getElementById = (id) => (dom[id] ? Object.assign(dom[id], { id, tagName: "INPUT", dispatchEvent: () => {} }) : null);
c.env.doc.querySelectorAll = () => [];
c.api.injectLabsIntoCronicos([{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "10" }]);
c.api.injectLabsIntoCronicos([{ codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "10" }]);
```
Asertar con igualdad EXACTA que `warns.filter((w) => w.indexOf(PREFIJO) === 0).length === 1` — no 0 y no 2. Después, en una **segunda instancia recién cargada** (con su propio shim de `Event` y su propio espía), llamar una vez con un analito que SÍ trae fecha (`Fecha: "2026-08-01"`) y asertar que ese mismo filtro da **0**.
**Qué NO hacer:** NO toques `vigilante_agenda.user.js`. NO uses la instancia compartida de la suite. NO filtres por una cadena sin tildes.
**Advertencias técnicas del arnés:** (1) **acentos**: el texto real de L2411 es `"[Vigilante] diagnóstico: no se reconoció ninguna fecha ..."` — con tilde en "diagnóstico" y en "reconoció". La versión sin tildes aparece **0 veces** en el archivo. (2) filtra por el **prefijo completo**: existe otro aviso casi idéntico en L9165 que empieza por `"[Vigilante Labs] diagnóstico:"` y no es el objetivo. (3) una instancia nueva **no trae el shim de `Event`**: el de esta suite solo existe porque se monta sobre la instancia compartida (línea 18). El escenario propuesto SÍ escribe en la casilla (`Resultado "10"` es candidato válido), así que llama a `setNgValue` → `new Event` → "Event is not defined" si no pones el shim. (4) el espía debe interceptar `warn`, no `log`.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de la Suite 08 sube exactamente en 1 y el total sube exactamente en 1 respecto de la cifra que midas al empezar. `node -c tests/suite_08_labs_cronicos.js` sin error. Verificado por mí: dos corridas sin fecha producen exactamente 1 aviso; con fecha, 0.
**Mutación obligatoria:** las tres, por separado, y CADA UNA debe poner roja la prueba nueva: (a) L2409 `if (!resultDate && ...)` → `if (resultDate && ...)`; (b) L2410 `_diagLabFechaLogged = true;` → `= false;` (pasan a ser 2 avisos); (c) L2411 comentar el `console.warn` (pasan a ser 0). Restaurar tras cada una. Tres filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA B4 — Suite 25 "Regla E": línea base congelada de `color` sin `!important` en los paneles
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!) — va después de las guardas C y D (mismo archivo).
**Contexto:** Los 7 paneles que cuelgan directo de `document.body` no heredan ninguna protección: una clase nuestra con `color:var(--x)` sin `!important` puede perder contra el CSS de Everest (bug v12.10.5, reportado por el médico en vivo). Ejemplo real y de mayor riesgo clínico: `vigilante_agenda.user.js:7500`, `#vgl-labs-modal .vgl-labs-alert .vgl-labs-val{color:var(--c-rojo);...}` — el rojo con el que se resalta un resultado de laboratorio FUERA DE RANGO.
**Ubicación exacta:** `tests/suite_25_cascada_css.js` — un `t.caso` HERMANO al final del `module.exports.pruebas`. Reutiliza el extractor (líneas 10-16) y el parser de selectores/propiedades (líneas 38-82) que la suite ya tiene.
**Qué hacer:** añade `t.caso("Regla E - color con selector de PANEL fuera de #vgl-root lleva !important", ...)`:
1. Recorre las reglas ya parseadas cuyo **selector contenga** alguno de estos 7 ids: `#vgl-pym-modal`, `#vgl-pes-modal`, `#vgl-labs-modal`, `#vgl-labsv-modal`, `#vgl-postcita-panel`, `#vgl-agendar-modal`, `#vgl-ordenar-modal`.
2. Por cada declaración `color` sin `!important`, registra la infracción como `selector + "|" + declaracion`.
3. **Exención obligatoria:** salta los selectores que contengan `:where(` — es el blindaje tipográfico de especificidad CERO (v12.3.15), que a propósito NO debe llevar `!important`.
4. El banco tiene que quedar VERDE y **no debes tocar el CSS de producción**: congela una línea base. Declara en la propia prueba una constante `BASE_CONOCIDA` con las infracciones actuales como **conjunto de cadenas ÚNICAS ordenado alfabéticamente**, y afirma que el conjunto calculado es EXACTAMENTE igual a esa base (compara Sets, no arrays: hay 4 duplicados exactos). Genera la lista imprimiéndola una vez y pegándola; hoy deben salir **70 cadenas únicas** (81 declaraciones `color` bajo esos paneles, 7 exentas por `:where(`, 0 con `!important`, 74 pares, 70 únicos).
5. Documenta en un comentario el **punto ciego**: el filtro exige que el selector NOMBRE el panel, así que Regla E no ve las clases peladas (`.vgl-labsv-lead`, `.vgl-labsv-foot`, `.vgl-pym-t`, `.vgl-modal-t`…) — es decir, NO habría cazado el bug v12.10.5. Sirve para que no entre una regla NUEVA sin `!important`, no para auditar las viejas.

**Qué NO hacer:** NO añadas `!important` al CSS de producción (eso lo hace Claude, CLAUDE.md:75). NO ensanches el filtro a "qué clase vive en qué modal": eso es criterio, no cadena. NO toques Regla A, B, C ni D.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Cascada CSS" sube exactamente en 1 y el total en 1 respecto de la cifra que midas al empezar. Verificado por mí con el extractor real: 81 / 7 / 0 / 74 / 70 únicos.
**Mutación obligatoria:** añade **temporalmente** al CSS del userscript la regla `#vgl-labsv-modal .vgl-prueba{color:var(--c-rojo)}` → Regla E debe ponerse ROJA nombrando ese selector; **quítala** y confirma verde (el `git diff` final no debe contener esa regla). Fila en `tests/INFORME_MUTACIONES.md`. **No intentes la mutación inversa** ("quitar el `!important` de una regla que hoy sí lo tiene dentro de esos paneles"): la verifiqué y es imposible, hay CERO declaraciones `color` con `!important` cuyo selector nombre uno de los 7 paneles.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance (`git diff --stat` debe mostrar solo `tests/`) / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA B5 — Blindar `runner.js` para que una prueba async huérfana no vuelva a pasar desapercibida
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**ORDEN OBLIGATORIO:** esta tarea va **DESPUÉS** de que estén fusionadas la reparación de suite_05 y la de suite_07. Antes de empezar, `node tests/runner.js` debe imprimir **756 pasan** en verde. Si imprime menos de 756, párate y dilo: aplicar esto antes deja el banco rojo con fallos que hoy están ocultos.
**Contexto:** Un `t.casoAsync` sin `await` (o dentro de un `pruebas` no-async) se lanza, no se espera, y sus resultados llegan después del recuento: la prueba es invisible y sus fallos no llegan ni al total ni al código de salida. Así estuvieron 8 pruebas rojas durante meses.
**Ubicación exacta:** `tests/runner.js`: `crearT()` en las líneas **12-35** (el objeto `res` se crea en la 13; `casoAsync` ocupa las **20-24**), y el bucle que lee los contadores en las **72-76** (`await suite.pruebas(...)` en la 73, `tp += res.pasa` en la 76).
**Qué hacer:**
1. En `crearT()`, añade al objeto `res` un array `pendientes: []`.
2. Cambia `casoAsync` para que guarde su propia promesa y la devuelva, **sin cambiar su semántica actual** (sigue capturando la excepción e incrementando `pasa`/`falla`):
   ```js
   casoAsync(desc, fn) {
     res.actual = desc;
     const p = (async () => {
       try { await fn(); res.pasa++; }
       catch (e) { res.falla++; res.fallos.push({ desc, msg: e.message }); }
     })();
     res.pendientes.push(p);
     return p;
   },
   ```
3. En el bucle de `main()`, justo DESPUÉS del `try/catch` de `await suite.pruebas(...)` y ANTES de `tp += res.pasa`, añade `await Promise.all(res.pendientes);`.

**Qué NO hacer:** NO toques ninguna suite. NO toques `vigilante_agenda.user.js`. NO cambies el cálculo de cobertura ni el formato de salida.
**Criterio de aceptación:** `node tests/runner.js` sigue en verde con **exactamente 750** comprobaciones (el total no puede bajar) y `echo $?` = 0. Verificado por mí: con las dos suites reparadas da 750 y salida 0.
**Mutación obligatoria (discriminador verificado):** deja `tests/suite_05_api_everest.js` en su estado ANTERIOR a la reparación (`git show <commit-previo>:tests/suite_05_api_everest.js`), o simula el defecto quitando el `async` de su línea 4 y los 8 `await`. Con el runner de HOY eso da salida **0**; con tu runner blindado debe dar salida **1** y reportar 6 fallos. Restaura y confirma verde. **NO uses como comprobación "quitar el await de un casoAsync de suite_13 y romper una aserción"**: lo probé y pone el banco en rojo con los DOS runners, porque `t.cierto(false)` lanza de forma síncrona antes de cualquier `await`, así que no discrimina nada. Fila en `tests/INFORME_MUTACIONES.md`.
**Riesgo que debes escribir en el PR:** tras este cambio, una promesa huérfana que NUNCA se liquide deja de ignorarse y **cuelga el banco para siempre** (el runner no tiene timeout por caso). El caso típico es el `GM_xmlhttpRequest` no-op del arnés, que nunca llama a `onload`/`onerror`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas (ninguna) / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA C1 — R1a: las cuatro fórmulas renales puras (TFG, KDIGO, discordancia)
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** El script avisa "laboratorio vencido a los 180 días" para todos los analitos por igual, sin saber en qué estadio de función renal está el paciente. Esta tarea porta **solo la aritmética** ya verificada en producción en el proyecto hermano (Copiloto RCV). Es la mitad pura de la tarea R1: la lectura de peso/talla por red y el disparo por paciente/día van en un PR aparte (R1b) y NO se hacen aquí.
**Ubicación exacta:** `vigilante_agenda.user.js`, bloque nuevo insertado entre la línea **2591** (el `}` que cierra `_vigenciaDiasParaAnalito`, declarada en 2585) y la línea **2592** (el comentario de `_analitosRcvVencidos`). Suite nueva: `tests/suite_26_funcion_renal.js`.
**Qué hacer:** implementa CUATRO funciones **puras** de primer nivel del IIFE (sin DOM, sin red, sin estado global), transcribiendo esta aritmética TAL CUAL:
```
cockcroftGault(edadAnios, pesoKg, creatininaSerica, sexo):
  si edad<=0 o peso<=0 o creatinina<=0 o edad>=140 -> devuelve 0 (centinela "no evaluable")
  v = ((140 - edad) * peso) / (72 * creatinina)
  si sexo es femenino -> v *= 0.85
  redondear a 1 decimal
ckdEpi2021(edadAnios, creatininaSerica, sexo):
  si edad<=0 o creatinina<=0 -> devuelve 0
  k = 0.7 si femenino, 0.9 si no ; a = -0.241 si femenino, -0.302 si no
  R = creatinina / k ; F = R^a si R<=1, si no R^-1.200
  e = 142 * F * (0.9938^edad) ; si femenino -> e *= 1.012
  redondear a 1 decimal
estadioKDIGO(tfg): >=90 "G1"; >=60 "G2"; >=45 "G3a"; >=30 "G3b"; >=15 "G4"; si no "G5"
evaluarDiscordanciaTFG(tfgCG, tfgCKD):
  si cualquiera es 0/null -> null (no evaluable)
  posiciones G1=1,G2=2,G3a=3,G3b=4,G4=5,G5=6
  si |posCG - posCKD| > 2 -> { alerta:true, estadioCG, estadioCKD, diferenciaEstadios, mensaje }
  si no -> null
```
Cockcroft-Gault usa el **peso REAL siempre** (decisión clínica ya tomada: es el estadio administrativo). "Femenino" se reconoce con el mismo criterio que ya usa el archivo para el sexo que reporta `BuscarPacienteDetallado`: cadena `"F"` / `"M"` — no inventes otro.
Crea `tests/suite_26_funcion_renal.js` con `nombre: "Función renal (R1)"`, `cubre: ["cockcroftGault","ckdEpi2021","estadioKDIGO","evaluarDiscordanciaTFG"]` y `pruebas(t, api)` síncrono, con al menos estos vectores (**calculados y verificados por mí; si tu implementación no los reproduce, la implementación está mal, no el vector**):
- `cockcroftGault(63, 113, 0.55, "F") === 186.8` (el caso "paciente obesa" que motivó usar peso real) y `cockcroftGault(63, 113, 0.55, "M") === 219.7`.
- `cockcroftGault(55, 70, 1.1, "M") === 75.1` y `cockcroftGault(55, 70, 1.1, "F") === 63.9`.
- `ckdEpi2021(63, 0.55, "F") === 102.9`; `ckdEpi2021(55, 1.1, "M") === 79.3`; `ckdEpi2021(55, 1.1, "F") === 59.3`; `ckdEpi2021(55, 2.5, "M") === 29.6`.
- Centinelas: `cockcroftGault(0, 70, 1, "M") === 0`, `cockcroftGault(55, 70, 0, "M") === 0`, `cockcroftGault(140, 70, 1, "M") === 0`, `ckdEpi2021(55, 0, "M") === 0`.
- `estadioKDIGO` en **cada frontera exacta**: 90→G1, 89.9→G2, 60→G2, 59.9→G3a, 45→G3a, 44.9→G3b, 30→G3b, 29.9→G4, 15→G4, 14.9→G5.
- `evaluarDiscordanciaTFG(95, 50) === null` (diferencia de 2, no alerta) y `evaluarDiscordanciaTFG(95, 35)` devuelve `alerta:true` con `estadioCG:"G1"`, `estadioCKD:"G3b"`, `diferenciaEstadios:3`. Y `evaluarDiscordanciaTFG(0, 50) === null`.

Sube `@version` (línea 4) y `const VERSION` (línea 941) al mismo literal.
**Qué NO hacer:** NO hagas ninguna llamada de red nueva (nada de `ObtenerHistoricoSignosVitales`). NO cablees ningún disparo "una vez por paciente por día". NO toques `RCV_VIGENCIA_DIAS`, `_vigenciaDiasParaAnalito` ni ninguna regla de vigencia. NO crees ningún elemento visual, `alert()` ni `console.log` de producción. NO toques `render()` ni la hoja de estilos. Existe `PROMPT_JULES_R1_TFG_KDIGO.md` en el repo: sus §3.2 y §3.3 y sus casos 5-7 son **otro PR** — ignóralos aquí. NO uses ningún dato real de paciente.
**Advertencias técnicas del arnés:** el arnés publica automáticamente las declaraciones `function NOMBRE` de primer nivel del IIFE, así que las cuatro serán probables por nombre sin tocar `harness.js`; deben ser `function` declaradas, no métodos ni funciones anidadas. El runner descubre solo cualquier `tests/suite_*.js`.
**Criterio de aceptación:** `node tests/runner.js` en verde, con una línea nueva `✓ Función renal (R1)` y el total subiendo exactamente en el número de casos que añadas. `git diff --stat`: `vigilante_agenda.user.js`, `tests/suite_26_funcion_renal.js` y `tests/INFORME_MUTACIONES.md`, nada más. El bloque CSS de `buildOverlay()` debe quedar sin cambios.
**Mutación obligatoria:** invierte una frontera de `estadioKDIGO` (`>= 45` → `> 45`) → debe caer la prueba de fronteras nombrándola; restaura. Segunda: quita el multiplicador femenino `*= 1.012` de `ckdEpi2021` → debe caer `ckdEpi2021(63, 0.55, "F") === 102.9`; restaura y confirma verde. Dos filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA C2 — `calcRangoSondeoIso`: ±7 días hábiles y los sábados como CANDIDATOS
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** Los chips de fecha del modal muestran hoy ±3 días hábiles y excluyen los sábados, aunque el consultorio sí abre algunos sábados. Esta tarea entrega **solo la mitad pura**: qué días hay que sondear. Quién confirma si ese sábado tiene agenda es el sondeo por red, que NO es parte de esta tarea.
**Ubicación exacta:** `vigilante_agenda.user.js`, función nueva insertada entre la línea **8970** (el `}` que cierra `calcTargetDateRange`, declarada en 8930) y la línea **8972** (el comentario de `calcDateRangeAroundIso`, declarada en 8975). Pruebas en `tests/suite_02_tiempo_fechas.js`, casos hermanos insertados después de la línea **76** y antes de la 78.
**Qué hacer:**
1. Crea `function calcRangoSondeoIso(isoDateStr)` — con ese nombre exacto. Es una **función NUEVA**: no modifiques `calcTargetDateRange` ni `calcDateRangeAroundIso` (las pruebas de suite_02 líneas 62-68 y 70-76 asertan arreglos de EXACTAMENTE 7 fechas y deben seguir verdes sin tocar un solo carácter).
2. Devuelve, en **orden cronológico ascendente**, un único arreglo con: los **7 días hábiles anteriores**, el centro, los **7 días hábiles posteriores**, y además **todos los sábados que caen estrictamente entre el primero y el último de esos días hábiles**. Domingos y festivos nunca aparecen, ni como hábil ni como sábado (reutiliza `esFestivo`, línea 8209).
3. Cada elemento conserva la forma exacta que ya usan los chips — `{iso, fmt, shortLbl, lbl, isCenter, dateObj}`, con el mismo `getInfo` que ya tienen las dos funciones vecinas — **más dos campos nuevos en TODOS los elementos**: `esSabado` (true solo en los sábados) y `confirmado` (`false` en los sábados, `true` en los días hábiles).
4. Añade `"calcRangoSondeoIso"` al array `cubre` de `tests/suite_02_tiempo_fechas.js` (línea 3).
5. Pruebas obligatorias. **Una de ellas debe asertar el arreglo ISO EXACTO completo** con `t.igual(isos, [...])`, igual que hacen las dos pruebas existentes — es lo único que fija el borde de los sábados. Para `calcRangoSondeoIso("2026-08-13")` el resultado correcto, **calculado y verificado por mí contra la tabla FESTIVOS del archivo**, es exactamente:
   ```
   ["2026-08-03","2026-08-04","2026-08-05","2026-08-06","2026-08-08","2026-08-10","2026-08-11",
    "2026-08-12","2026-08-13","2026-08-14","2026-08-15","2026-08-18","2026-08-19","2026-08-20",
    "2026-08-21","2026-08-22","2026-08-24","2026-08-25"]
   ```
   (18 elementos: 7 hábiles + centro + 7 hábiles + 3 sábados; se saltan el viernes 2026-08-07 y el lunes 2026-08-17, ambos festivos, y los domingos).
   Más: exactamente 7 elementos con `confirmado === true` a cada lado del centro; ningún domingo; ningún festivo; los tres sábados con `esSabado === true` y `confirmado === false`; un único elemento con `isCenter === true` y es el 2026-08-13.
6. Sube `@version` (línea 4) y `const VERSION` (línea 941).

**Qué NO hacer:** NO modifiques `calcTargetDateRange`, `calcDateRangeAroundIso`, ni ninguna prueba existente. NO conectes la función a `renderDayChips` ni a nada más: no debe tener ningún llamador. NO hagas ninguna llamada de red ni toques el DOM.
**Advertencias técnicas del arnés:** `FESTIVOS` es un `const`, y el arnés **solo publica funciones** (más `__S`, `__CONFIG`, `__state`, `__WHITELIST`, `__PYM_CATALOG`, `__COLORS`, `__FRIENDLY`): `api.FESTIVOS` es `undefined` y estrellará tu prueba. Usa `api.esFestivo(...)` o las fechas fijas de 2026 escritas a mano. Esta función recibe la fecha por parámetro, así que **no necesitas `runWithMockDate`** para nada.
**Criterio de aceptación:** `node tests/runner.js` en verde; las dos pruebas existentes de `calcTargetDateRange` (suite_02:62 y :70) siguen verdes sin modificarse; el contador de "Tiempo y fechas" sube exactamente en el número de casos que añadas. `node -c tests/suite_02_tiempo_fechas.js` sin error.
**Mutación obligatoria:** baja el tope de 7 a 3 → debe caer la prueba del arreglo exacto nombrándola; restaura. Segunda: quita la inclusión de sábados → debe caer la misma prueba; restaura y confirma verde. Dos filas en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA C3 — `mapConLimite`: concurrencia acotada (el tope que exige D2)
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** El sondeo de días del modal va a lanzar hasta 18 consultas contra el EHR del consultorio. La decisión D2 prohíbe expresamente lanzarlas todas a la vez y exige 4-6 en vuelo. Hoy no existe ningún helper de concurrencia acotada en el archivo: el único patrón es `Promise.all` a pelo (líneas 1934 y 9117) y el bucle secuencial `agendasFiltradas.slice(0, 8)` de la 9668.
**Ubicación exacta:** `vigilante_agenda.user.js`, función nueva insertada entre la línea **8927** (el `}` que cierra `extractAgendasList`, declarada en 8911) y la línea **8929** (el comentario de `calcTargetDateRange`). Pruebas en `tests/suite_22_utilidades_puras.js` (hoy 3 casos).
**Qué hacer:**
1. Implementa `async function mapConLimite(items, limite, fn, cancelado)`:
   - devuelve los resultados en el **MISMO orden de entrada**;
   - **nunca** mantiene más de `limite` promesas en vuelo;
   - un rechazo individual **no aborta el lote**: cada resultado se entrega como `{ok:true, valor}` o `{ok:false, error}` — un día cuya consulta falló NO es un día sin agenda, y confundirlos ocultaría un día que sí existe;
   - una `fn` que lanza **de forma síncrona** (no que devuelve una promesa rechazada) también da `{ok:false, error}` y no tumba el lote;
   - `cancelado` es una función opcional: si devuelve verdadero, no se arrancan más tareas y las pendientes quedan `{ok:false, cancelado:true}`;
   - `items` vacío → `[]`; `limite >= items.length` → se comporta como `Promise.all`; **`limite <= 0` se trata como 1, nunca como ilimitado** (eso es justo lo que D2 prohíbe).
2. Pruebas: cambia la línea 4 de `tests/suite_22_utilidades_puras.js` de `pruebas(t, api) {` a **`async pruebas(t, api) {`** y usa **`await t.casoAsync(...)`** en cada caso nuevo. Casos: tope de concurrencia (18 tareas, `limite` 5 → máximo observado **exactamente 5**, nunca 6), orden de resultados = orden de entrada aunque terminen desordenadas, lista vacía, una tarea que rechaza no tumba las demás, una `fn` que lanza síncronamente, cancelación a mitad, y `limite <= 0`.
3. Sube `@version` (línea 4) y `const VERSION` (línea 941).

**Qué NO hacer:** NO la conectes a `cargarHoras` ni a nada: debe quedar sin llamadores. NO toques el DOM, la red ni temporizadores propios. NO hagas ninguna petición real.
**Advertencias técnicas del arnés:** **trampa que hace pasar la prueba del tope en falso**: si la `fn` de mentira resuelve de forma síncrona/inmediata, el máximo en vuelo observado será 1 y no 5. La prueba del tope **debe usar promesas DIFERIDAS** (guarda los `resolve` en un array y dispáralos a mano) para que la concurrencia llegue a acumularse; solo así el "exactamente 5" mide lo que dice medir. Cuenta con un contador que sube al entrar y baja al salir, registrando el máximo. `setTimeout` está recortado a 1 ms.
**Criterio de aceptación:** `node tests/runner.js` en verde; el contador de "Utilidades Puras" sube de **3 a al menos 7** y el total sube exactamente en el número de casos añadidos. `node -c tests/suite_22_utilidades_puras.js` sin error. **Comprueba que la suite quedó como `async pruebas` y que TODOS sus `t.casoAsync` llevan `await`**: sin eso las pruebas nuevas son invisibles y el contador no sube.
**Mutación obligatoria:** sube el tope a `items.length` (equivalente a `Promise.all`) → debe caer la prueba del tope nombrándola; restaura y confirma verde. Fila en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA C4 — R2: tabla de vigencias por estadio renal, en modo sombra (requiere C1 fusionada)
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!) — **empieza solo si `estadioKDIGO` ya existe en `vigilante_agenda.user.js`.** Si no existe, párate y dilo.
**Contexto:** El protocolo real de la EPS fija vigencias de laboratorio distintas según el estadio renal. Esta tarea **transcribe la tabla** y entrega una función pura de consulta. **No cambia ningún aviso**: el médico sigue viendo los 180 días planos. El cableado es R3.
**Ubicación exacta:** `vigilante_agenda.user.js`, bloque nuevo inmediatamente **después** de las cuatro funciones que dejó R1a (busca `evaluarDiscordanciaTFG` y ponlo detrás). Suite nueva: `tests/suite_27_vigencias_estadio.js`. Referencias de solo lectura: `RCV_VIGENCIA_DIAS` (línea 2569), `RCV_VIGENCIA_KEYS` (línea 2570), `_vigenciaDiasParaAnalito` (línea 2585).
**Qué hacer:**
1. Transcribe la tabla de `PROMPT_JULES_R2_VIGENCIAS_ESTADIO.md` líneas 35-70 tal cual, sin recalcularla ni ajustarla, como una constante del módulo. `BLOQ` = el analito no se pide en ese estadio. Vigencias en DÍAS. **Los rangos `(min, max)` de creatinina en G3a/G3b/G4 se conservan COMO RANGO** (`{min, max}`), nunca colapsados a un número: elegir extremo es decisión de R3.
2. Implementa la consulta como función **PURA**: `function vigenciaPorEstadio(programa, estadio, analito, opciones)`, donde `opciones = { esDM2, edad }` — ambos **parámetros explícitos, nunca deducidos dentro**. Devuelve: un número de días; `{min, max}` para los rangos; la cadena `"BLOQ"` cuando la celda lo dice; y **`null`** cuando la combinación no está contemplada (programa desconocido o `"NO_CONFIRMADO"`, analito ausente de la tabla, estadio fuera de G1..G4). Nunca un número inventado.
   - ERC + `hba1c`: solo aplica si `opciones.esDM2 === true`; si no, `null`.
   - DM2 + `ecg`: 365 solo si `opciones.edad >= 45`; si no, `null`.
   - HTA + `acido_urico`: `"BLOQ"` siempre.
   Esta firma es **obligatoria**: el prompt original tiene una contradicción interna (su §3 obliga a `NO_CONFIRMADO` para todo paciente diabético mientras su §6 exige pruebas del programa DM2). Con el programa, `esDM2` y `edad` como parámetros, DM2 se prueba por unidad aunque en producción esa rama no se alcance todavía.
3. Implementa `function analitoTablaDesdeClaveRcv(clave)` con el mapeo **completo y explícito** entre los nombres de Everest y los de la tabla: `CREATININA→creatinina`, `GLUCOSA→glicemia`, `UROANALISIS→parcial_orina`, `COLESTEROL_TOTAL→colesterol_total`, `TRIGLICERIDOS→trigliceridos`, `COLESTEROL_HDL→hdl`, `RAC→rac`; cualquier otra clave → `null`. Documenta en un comentario que estas filas de la tabla **no tienen analito que vigilar hoy** y **no se les inventa clave**: `hemoglobina`, `pth`, `albumina`, `fosforo`, **`ldl`**, `hba1c`, `ecg`, `ecocardiograma`, `acido_urico` (ojo: no existe ninguna clave LDL en `RCV_VIGENCIA_KEYS`, solo `COLESTEROL_TOTAL` y `COLESTEROL_HDL`).
4. Crea `tests/suite_27_vigencias_estadio.js` con `cubre: ["vigenciaPorEstadio","analitoTablaDesdeClaveRcv"]`, cubriendo: cada rango de creatinina como rango; todos los `BLOQ`; `hba1c` con y sin `esDM2`; `ecg` con edad 44 y 45; `acido_urico` en HTA; programa `"NO_CONFIRMADO"` → `null`; analito desconocido → `null`; el mapeo completo y sus 9 ausencias.
5. Sube `@version` (línea 4) y `const VERSION` (línea 941).

**Qué NO hacer:** NO conectes la tabla a nada: `git diff` no debe tocar `RCV_VIGENCIA_DIAS` (2569), ni `_vigenciaDiasParaAnalito` (2585), ni ningún aviso. NO inventes la cadena de programa de Diabetes: si al leer `INFORME_ETIQUETAS.md` encuentras una `descripcion` que no es "Nefroprotección" ni "Hipertensión", regístrala en "Hallazgos NO tocados" para que la confirme el médico, no la uses para clasificar. NO deduzcas `esDM2` ni `edad` dentro de la función.
**Advertencias técnicas del arnés:** el arnés publica las `function NOMBRE` de primer nivel; la constante de la tabla no se publica, así que toda la comprobación pasa por las dos funciones.
**Criterio de aceptación:** `node tests/runner.js` en verde por encima de la cifra que midas al empezar, con una línea nueva de suite. `git diff --stat`: `vigilante_agenda.user.js`, `tests/suite_27_vigencias_estadio.js` y `tests/INFORME_MUTACIONES.md`.
**Mutación obligatoria:** invierte `BLOQ`/365 en la fila `pth` del estadio G3a → debe caer una prueba tuya nombrándola; restaura y confirma verde. Fila en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA C5 — Borrar la función muerta `fraudSound()`
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!)
**Contexto:** `fraudSound()` la reemplazó `playTone(color)` (línea 5210), que se llama desde 7 sitios (5215, 5380, 5428, 5617, 5669, 11243, 11870) y cuyo `TONE.ROJO = [1000, 1240]` cubre el mismo caso. `fraudSound` aparece exactamente 2 veces en TODO el repo y ninguna es una llamada.
**Ubicación exacta:** `vigilante_agenda.user.js` línea **5202** (`function fraudSound() { beep(1000, 400, 0); beep(1200, 400, 0.45); }`) y `tests/suite_04_agenda_alertas.js` línea **3**, la cadena `"fraudSound"` dentro del array `cubre`.
**Qué hacer:** borra la línea 5202 completa y quita `"fraudSound", ` del array `cubre` de la línea 3 de `tests/suite_04_agenda_alertas.js`. Sube `@version` (línea 4) y `const VERSION` (línea 941). Nada más.
**Qué NO hacer:** no toques `playTone`, `beep` ni `TONE`. No borres ninguna otra entrada del array `cubre`. No reformatees.
**Criterio de aceptación:** `git grep -c fraudSound` no devuelve ninguna línea. `node tests/runner.js` sigue en verde con **exactamente las mismas 756 comprobaciones** (`fraudSound` solo estaba declarada en `cubre`, nunca ejercitada) y el contador de cobertura pasa de **330 / 355 (93.0%)** a **329 / 354 (92.9%)**. Verificado por mí aplicando y revirtiendo el borrado: los tres números salen exactos. Si el runner aborta con "la suite dice cubrir 'fraudSound', pero esa función no existe en el API", es que borraste del userscript y olvidaste el array `cubre`.
**Mutación obligatoria:** no aplica (borrado de código muerto, sin cambio de comportamiento). Aun así **añade la fila** a `tests/INFORME_MUTACIONES.md` documentando que la comprobación fue el contador invariante 756 y la cobertura 330/355.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas (ninguna) / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA D1 — Conectar la escala tipográfica: 36 `font-size` literales a `--t-micro/--t-body/--t-lead`
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!) — va después de que estén fusionadas las Reglas C, D y E de suite_25 (mismo archivo de pruebas).
**Contexto:** Los tokens `--t-micro:12px; --t-body:14px; --t-lead:16px` están declarados en las dos listas (líneas 6160 oscura y 6210 clara) pero **se consumen 0 veces**: son tokens muertos. Esta tarea los cablea. El valor computado no cambia (valen exactamente 12/14/16px en oscuro Y en claro), así que es cero cambio visual demostrable sin navegador.
**Ubicación exacta:** hoja maestra de CSS dentro de `buildOverlay()`, líneas **6111-7967**. Las 36 sustituciones, verificadas una a una:
- `font-size:12px` → `var(--t-micro)` — **25 líneas**: 6336, 6406, 6458, 6492, 6658, 6662, 6669, 6677, 6757, 6790, 6847, 6848, 6873, 6909, 6977, 6982, 7015, 7055, 7060, 7174, **7361**, 7606, 7894, 7896, 7923.
- `font-size:14px` → `var(--t-body)` — **6 líneas**: 6255, 6788, 6941, 6945, 7169, 7294.
- `font-size:16px` → `var(--t-lead)` — **5 líneas**: 6401, 6642, 6913, 7291, 7490.
**Qué hacer:**
1. Sustituye EXACTAMENTE esas 36 declaraciones. La línea **7361 está escrita `font-size: 12px` CON ESPACIO** tras los dos puntos: un `sed` literal de `font-size:12px` se la salta.
2. **Caso especial 6336** (`.vgl-lab-inj,.vgl-exf-btn`): escribe **`var(--t-micro,12px)`, con reserva**, respetando la convención defensiva del propio bloque (`var(--font-stack, sans-serif)`, `var(--c-verde, #16a34a)`). No es cosmético: `.vgl-exf-btn` lo lleva el botón `#vgl-examen-normalidad`, que se pega a `document.body` y **NO está en ninguna de las dos listas de tokens**, así que sin reserva la declaración quedaría inválida y el botón heredaría el `font-size` de Everest — exactamente el modo de fallo del incidente v12.6.6.
3. Añade a `tests/suite_25_cascada_css.js` un `t.caso` HERMANO al final que, sobre el CSS extraído: `/font-size: *12px(?![0-9.])/g` → **0** coincidencias (hoy 25), `14px` → **0** (hoy 6), `16px` → **0** (hoy 5); `/var\(--t-micro(?:,[^)]*)?\)/g` → **exactamente 25**, `var(--t-body)` → **6**, `var(--t-lead)` → **5**; y una aserción explícita de que **la línea 6336 conserva la reserva** (`var(--t-micro,12px)` aparece exactamente 1 vez). Cuenta también `!important` en la hoja: debe seguir siendo **146**.
4. Segundo `t.caso`: `--t-micro`, `--t-body` y `--t-lead` siguen declarados en **LAS DOS** listas de tokens (6160 oscura y 6210 clara) con los valores 12px/14px/16px sin cambio. Si una sola desaparece de la lista clara, el modo claro se queda sin `font-size`.
5. Sube `@version` (línea 4) y `const VERSION` (línea 941).

**Qué NO hacer:** NO toques los otros 84 `font-size` de la hoja (12.5px×21, 13px×12, 13.5px×7, 11.5px×7, 22px×6, 10.5px×6, 11px×5, 18px×4, 25px×3, 21px×3, 15px×3, 15.5px×2, 9.5px, 38px, 19px, 17px, 10px): no hay token para ellos y forzarlos sería un cambio visual. NO toques las líneas 5265-5270 (`popupAlert`): ese CSS se escribe con `document.write` en una VENTANA APARTE abierta con `window.open`, donde los tokens no existen — un `var(--t-body)` ahí se perdería en silencio. NO toques los `font-size` inline de las plantillas HTML (9432, 10122). **NO cambies el VALOR de ningún token.** NO añadas tokens nuevos, no renombres, no reformatees.
**Advertencias técnicas del arnés:** ninguna de las 36 está dentro de un `@media` (verificado por conteo de llaves: 7919 y 7942 son bloques `@media` de UNA SOLA LÍNEA autocontenidos, por eso 7923 queda fuera). Ningún `font-size` de la hoja lleva `!important`, **pero 5 de las 36 líneas sí llevan `!important` en OTRA declaración**: 6941, 6982, 7015, 7060 y 7294. `.vgl-labsv-foot` (7060) es exactamente la clase del bug v12.10.5 que el médico reportó en vivo: perder ese `!important` al editar la línea reabre el bug. De ahí la aserción del conteo 146.
**Criterio de aceptación:** `node tests/runner.js` en verde; el total sube exactamente en 2 respecto de la cifra que midas al empezar. `git diff`: **exactamente 36 líneas modificadas entre 6111 y 7967, MÁS la línea 4 (`@version`) y la 941 (`const VERSION`)**, que deben subir juntas y al mismo literal (`tests/suite_23_ux_telemetria.js:249` lo asserta).
**Mutación obligatoria:** revierte UNA sustitución (p. ej. 6642 `.vgl-time`) a `16px` literal → la prueba del punto 3 debe ponerse ROJA; restaura y confirma verde. Segunda: quita la reserva de 6336 (`var(--t-micro,12px)` → `var(--t-micro)`) → la aserción de la reserva debe ponerse ROJA; restaura. Dos filas en `tests/INFORME_MUTACIONES.md`.
**Dos preguntas abiertas que van en el PR, sin tocarlas:** `SUPERPROMPT_DISENO_V14.md` línea 486 fija `--t-body:13px` (aquí vale 14px) y no define `--t-lead` en absoluto (allí es `--t-strong:15px`). No resuelvas ninguna de las dos: anótalas.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados (incluye: `#vgl-examen-guardar` y `#vgl-examen-aplicar` aparecen SOLO en 4 selectores CSS y en ningún sitio del JS — son ids muertos —, mientras que el id vivo `#vgl-examen-normalidad` no está en ninguna lista de tokens).

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

---

## TAREA D2 — Hacer visible la cobertura fantasma del banco
**Rama base:** claude/pym-agenda-blindaje-v12-4  (¡NO main!) — va después del blindaje de `runner.js` (mismo archivo).
**Contexto:** La cobertura del banco es DECLARATIVA: el runner valida (líneas 64-71) que el nombre exista en el API, pero no que alguna prueba lo ejercite. Hoy el 93.0% es autodeclarado y nadie sabe cuánto vale de verdad.
**Ubicación exacta:** `tests/runner.js` línea **75** (`(suite.cubre || []).forEach(n => cubiertas.add(n));`) y el bloque de `sinCubrir` (líneas 83-93).
**Qué hacer:** en `main()`, después de calcular `sinCubrir`, añade un segundo cálculo **puramente informativo**: lee con `fs` el texto de cada `tests/suite_*.js`, quítale su propio bloque `cubre: [...]`, y para cada nombre declarado en algún `cubre` comprueba si aparece como palabra completa (`\bNOMBRE\b`) en el texto restante de alguna suite. Imprime un bloque nuevo `declaradas pero nunca nombradas (N):` con la lista, en amarillo, con el mismo formato de 6 por línea que ya usa `sin cubrir`. Añade un comentario breve explicando que el número de funciones con prueba efectiva es 330 menos N.
**Qué NO hacer:** NO cambies el porcentaje de cobertura, ni el total de comprobaciones, ni el código de salida — es un informe, no un fallo. NO lo llames "sin probar": `_casillasExamenFisico`, por ejemplo, sí se ejercita de verdad vía `btnN.onclick()` en `suite_15` (líneas 657, 673, 690) aunque su nombre no aparezca escrito. Por eso el bloque se llama **"nunca nombradas"**. NO toques ninguna suite ni `vigilante_agenda.user.js`.
**Criterio de aceptación (por propiedades, no por número):** `node tests/runner.js` sigue en verde, con el mismo total de comprobaciones, el mismo porcentaje de cobertura y salida 0. El bloque nuevo **debe** incluir `beep`, `startNag`, `popupAlert` y `_renderToast`, y **no debe** incluir `colorDot` (se nombra en suite_15:1369) ni `escapeHtml` (se nombra en suite_01:135-144). Referencia medida por mí hoy: son **25** nombres — `_casillasExamenFisico, _loteId, _renderToast, _valorCrudoLab, acknowledge, beep, enableOsNotifications, faviconUrl, fraudSound, fraudesHoy, osNotify, playTone, popupAlert, renderStats, repEntornoDiario, setFavicon, showToast, startFlash, startNag, stopFlash, stopNag, testNotifications, updateBell, uxClaveLimpia, uxVentanaNueva` — pero **no claves el número en la aceptación**: si ya se fusionó el borrado de `fraudSound`, serán 24.
**Mutación obligatoria:** añade al `cubre` de `tests/suite_22_utilidades_puras.js` un nombre del API que ninguna prueba nombre (verifícalo antes con `git grep -w`; **`escapeHtml` NO sirve**, ya se nombra) → debe aparecer en la lista; quítalo → debe desaparecer. Fila en `tests/INFORME_MUTACIONES.md`.
**Formato del PR:** Qué cambié / Salida completa del runner / Pruebas nuevas (ninguna) / Mutación aplicada / Verificación de alcance / Hallazgos NO tocados.

Sigue AGENTS.md. No commitees archivos de trabajo propios (scripts .py, borradores de PR, logs del runner).

---

# 4. Plan de lanzamiento

**Tanda 1 — lanzar ya, las 8 en paralelo** (siete son solo-tests y cada una vive en un archivo distinto; A8 es la única que toca el userscript):
A1 suite_05 · A2 suite_08 · A3 suite_10 · A4 suite_12 · A5 suite_17 · A6 suite_07 · A7 suite_25 · A8 userscript+suite_24.
Único punto de roce: `tests/INFORME_MUTACIONES.md` (append al final; conservar SIEMPRE ambas filas, nunca descartar la ajena).

**Tanda 2 — en cuanto fusione su predecesora:**
- B1 (tras A1) → luego B2 (tras B1). Mismo archivo, estrictamente en cadena.
- B3 (tras A2). B4 (tras A7).
- **B5 solo cuando A1 y A6 estén las dos fusionadas y el banco marque 750.** Lanzarla antes deja el banco rojo con los fallos que hoy oculta.

**Tanda 3 — userscript.** C1, C2, C3 y C5 pueden trabajarse en paralelo (zonas 2591 / 8971 / 8928 / 5202, sin solape), pero **se fusionan de una en una**: todas suben `@version` (línea 4) y `const VERSION` (941), y ahí chocan. Resolución: quedarse con el número más alto y volver a correr el banco tras el merge. C4 solo después de C1.

**Tanda 4 — al final:** D1 (tras B4, comparten suite_25) y D2 (tras B5, comparten runner.js). Si C5 ya se fusionó, la lista de D2 baja a 24 nombres: por eso su criterio va por propiedades.

**Cifras de control:** 756 hoy (las reparaciones de suite_05 y suite_07 ya están fusionadas) → +2 A2, +2 A3, +2 A4, +1 A5, +2 A7 → **765** con el grupo A completo (A8 aparte, según cuántos casos añada).

**Fuera del reparto de Jules, para Claude, en este orden:**
1. `!important` en `.vgl-agm-sbtn-sugerido` (7197) **más** una regla `:hover` propia — sin ella, poner `!important` mata el hover de `.vgl-agm-sbtn:hover` (7187) sobre justo el botón que el script recomienda. Verificar en Chromium.
2. `!important` en el `color` de la línea **6335** (`.vgl-lab-inj,.vgl-exf-btn`) y decidir a la vez si `#vgl-examen-normalidad` entra en las listas de tokens: **entrar cambia el texto del botón de blanco a casi negro** en modo oscuro. Es una decisión visual que necesita el ojo del médico.
3. Redacción **completa** de las capturas: HECHA en la v17.14.0 — las dos cédulas, el celular, los correos, las direcciones, los nombres y los `registroMedico` de las dos capturas quedaron reemplazados por valores sintéticos que preservan la forma. Decisión del médico (27-ago): NO se reescribe el historial de git, la redacción es hacia adelante. `PROMPT_JULES_R1_TFG_KDIGO.md:112` afirma que esa captura está "ya redactada de PHI": es falso y esa garantía está escrita en el repo.

---

# Anexo — las 7 candidatas descartadas y por qué

| Candidata | Por qué se cayó |
|---|---|
| Detector CSS "Regla C" para la insignia SUGERIDO | El detector propuesto daba 259 falsos positivos y 0 aciertos sobre el bug que decía cazar. El bug es real; lo arreglo yo en Chromium. |
| Mutaciones del SMS en suite_05 | Inejecutable hasta reparar suite_05 (ya hecho). Absorbida dentro de B1. |
| Pruebas de `openLabSoloModal` | Ya estaba hecha (PR #41). |
| "41 mutaciones de T7" | 31 de 42 filas no nombran ningún caso de prueba: el criterio de aceptación era imposible de comprobar. |
| T3-bis/C (superficies) | Es una decisión de diseño disfrazada de `sed`. Esperar a T4/TL1. |
| Redactar cédulas de las capturas | Delegarlo es la fuga. Además el alcance detectado estaba incompleto. Me la quedo. |
| `!important` 6335 / ids `#vgl-examen-*` | CSS de producción es mío por regla. La segunda además cambiaba el color del texto de un botón sin declararlo. |
