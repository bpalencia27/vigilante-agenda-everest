# Campaña "CORRÍGELOS TODOS" — Estado M2M (hallazgos 8-36)

> Documento de trabajo del agente. **No se commitea** (higiene del repo).
> Rama: `claude/m2m-fixes-30` · Orquestador: `c:\Users\brand\.gemini\antigravity\brain\3491a93e-ccd9-494c-a026-bf31c0deb4a4\prompt_orquestador_m2m.md`
> Última actualización: 2026-09-05

## Protocolo por fix (no negociable)

1. Verificar líneas → editar → prueba SIBLING rojo→verde → **mutación muerta** →
   restaurar → verde → fila en `tests/INFORME_MUTACIONES.md` (siguiente: **556**) →
   commit (mensaje UTF-8 **sin BOM**).
2. `node tests/runner.js <suite>` para la suite tocada; banco completo antes del push.
3. Git real: `C:\Program Files\Git\cmd\git.exe` (el del PATH está roto).
4. El disco debe estar en **LF**: git-Windows autocrlf lo reescribe a CRLF en
   checkout/stash y rompe los source-tests (ver "CRLF" abajo). Tras cualquier
   `git checkout`/`stash pop`, re-normalizar y correr el banco.
5. Archivos ajenos NO commitear: `tests/suite_82_consentimiento.js`,
   `vigilante_agenda_v18.1.2_optimized.js`, `vigilante_agenda_v18.1.3_optimized.js`.

## Hallazgo crítico de infraestructura: CRLF en disco (RESUELTO)

- `vigilante_agenda.user.js` quedó en CRLF tras un checkout/stash de git-Windows.
- Los source-tests (`readFileSync(RUTA,"utf8")` crudo) que buscan `"\n    });\n"`
  recibían `cierre = -1` → ventana de respaldo i+900 corta → fallos falsos.
- Causó las 3 caídas "pre-existentes": hallazgo 11 (suite_15, renderDayChips),
  v18.0.124 alto contraste y v18.0.127 densidad 1366x768 (ambas suite_25).
- **Reparado 2026-09-05**: normalización LF UTF-8-sin-BOM de
  `vigilante_agenda.user.js` y `tests/suite_15_interfaz_avanzada.js`
  (diff de git nulo: los blobs ya eran LF).
- Resultado: suite_15 **271/0**, suite_25 **32/0**. Las 3 caídas ya no existen.

## Progreso por clúster

| Clúster | Hallazgos | Estado | Detalle |
|---|---|---|---|
| f7 | 7 | ✅ COMMITED | diasSinRespuesta en «primer cupo»; fila 551 |
| f8 | 8 (órdenes) + 21 (cita) | ✅ COMMITED (8: dd59ac6; 21: 5216eef) | ver abajo |
| f9 | 9+10 | ✅ COMMITED (842008f) | filas 554/555; ver abajo |
| f11 | 11-13+23 | ✅ COMMITED (2f5579e) | filas 556-559; ver abajo |
| f14 | 14 | ✅ COMMITED (1b76c55) | fila 560; ver abajo |
| f16 | 16+25 | ✅ COMMITED (c29328a) | filas 561/562; ver abajo |
| f17 | 17+18+22 | ✅ COMMITED (9ebd4c4) | filas 563-565; ver abajo |
| f15 | 15 | ✅ COMMITED (4002024) | fila 566; ver abajo |
| f19 | 19-20+30-33 | ✅ COMMITED (6eea704) | filas 567-572; ver abajo |
| f24 | 24+26-29 | ✅ COMMITED (9065a96) | filas 573-577; ver abajo |
| f34 | 34-36 | ✅ COMMITED (3ccc466) | filas 578-580; ver abajo |
| fz | — | ✅ CERRADO (banco 3164/0; reparación 26fee95; push) | ver abajo |

## FIX 8 (órdenes) — ✅ COMMITED (dd59ac6)

- Helper `_ordenYaFiguraEnEverestHoy(pid, cups)` L22459: consulta
  `apiHcObtenerOrdenamientosVigentes` tras invalidar caché; true solo si TODOS los
  CUPS figuran vigentes con `fechaCreacion` de HOY.
- Rama `else if (resOrd == null)` L31254: recuperación → marca local, casilla
  tachada/deshabilitada, `recuperadasCount`, NO re-POST.
- `soloRecuperadas` L31322 → botón «1 orden creada sin confirmación», mensaje
  «La conexión se cortó, pero la orden ya quedó creada... **No la vuelva a generar**»,
  clase `vgl-ord-parcial`, uxTrack `ordenes.post_perdido.recuperada`.
- Prueba SIBLING suite_15 L4572-4627 (**verde**): helpers `_dupFixture`,
  `_casillaOrd`, `_inyectarCasilla` L4490-4529. OJO arnés: `appendChild` NO refleja
  en `innerHTML` → leer hijos de `.vgl-agm-card` y su `innerHTML` propio.
- Mutación L31269 `if (false && _recuperada)` → **270/1 (mutante muerto)**;
  restaurado → **271/0**. Fila 552 en INFORME_MUTACIONES.
- Corridas de evidencia (números): mut `vgl_mut8.log`, restaurado `vgl_rest8.log`,
  LF `vgl_run15_lf.log`, suite_25 `vgl_run25_lf.log`, baseline HEAD `vgl_base4.log`.

## FIX 21 (cita) — ✅ COMMITED (5216eef)

`_confirmarCita` (~L29580): POST sin veredicto → re-chequeo del cupo con el MISMO
matcher `sigueLibre`; si ya NO está libre → toast AMBAR + botón deshabilitado +
`uxTrack("cita.sin_respuesta_cupo_ocupado")` + return SIN reintento. Fila 553.

## FIX 9 + FIX 10 — ✅ COMMITED (842008f)

**FIX 9 (`_findLabField`, ~L2971)**: Everest ya renderó el MISMO id/name en varios
`<input>` (HbA1c vs Hemoglobina, v12.3.26). Ahora se recolectan TODOS los candidatos
por id+name (dedup por identidad); si hay varios, gana el primero VISIBLE y
habilitado; si ninguno, `cands[0]` (comportamiento de siempre). Pruebas SIBLING en
suite_08 (2 casos): mock del `querySelectorAll` del arnés con `offsetParent: null`
para la copia oculta. **150/0**; mutante `if (!el.disabled && true) return cands[0];`
→ **149/1**; restaurado **150/0**. Fila 554.

**FIX 10 (`_conductaBuscarYAgregarExamen`, ~L31847)**: filtro
`&& _vglVisibleDeVerdad(...)` en el loop del `<li>` y en los `find` de
AGREGAR/REPETIRLO/CONFIRMAR/ENTENDIDO (5 puntos). Pruebas SIBLING en suite_71
(5 casos; `mockLi` extendido con 3.er param `{ visible: false }` que simula
`offsetParent: null`). **90/0**; mutante sin los 5 filtros → **85/5**;
restaurado **90/0**. Fila 555.

LECCIÓN (crítica): NUNCA reescribir `vigilante_agenda.user.js` con cmdlets de texto
de PowerShell (`Get-Content`/`Set-Content`): PS 5.1 lee UTF-8-sin-BOM como ANSI y
`Set-Content -Encoding utf8` escribe BOM → roundtrip corrompió 16.700 líneas (mojibake
en todas las tildes). Recuperado con `git checkout --` + re-aplicar fixes con
SearchReplace. Mutaciones y ediciones de producción SIEMPRE con SearchReplace.

## FIX 11-13 + 23 — ✅ LISTO (f11)

**FIX 11 (`mtrReglaErcG3aA2`, L39004)**: ternario invertido corregido — AINE con
IECA/ARA-II activo (doble whammy) = CRITICAL, sin SRAA = HIGH.

**FIX 12 (`mtrReglaBetabloqueadorHidrofilico`, L38548)**: rama eGFR<15 ahora
«50 mg cada 48 horas (ficha FDA de Tenormin)»; la rama 15-35 («50 mg/día») no cambia.

**FIX 13 (`mtrReglaDoac`, L38830-38846)**: rama edoxabán nueva tras la de apixabán —
CrCl>95 EVITAR (antes silencio del `return null`), CrCl<15 CONTRAINDICADA/CRITICAL,
CrCl 15-50 CAP_DOSIS 30 mg/día (ficha Savaysa/Lixiana §4.2).

**FIX 23 (`mtrReglaSglt2`, L38701-38708)**: rama eGFR<20 pasa de SUSPENDER/CRITICAL a
EVITAR/HIGH: «NO iniciar. Si ya lo toma y lo tolera, CONTINUAR» (KDIGO 2024). La rama
20-44 no cambia.

**suite_39**: 50 → **53 casos** (1 reescrito + 3 hermanos nuevos). **suite_43**:
mecanismo DIVERGENCIAS/usadas extendido al test del orquestador (antes `t.igual`
ciego) + **247 divergencias declaradas**: 63 betabloqueador (ATENOLOL/nadolol/
CARVEDILOL × eGFR {5,10,14} × K 7 valores), 180 sglt2 (6 fármacos incl. metformina ×
eGFR {5,10,14,15,16} × HbA1c 6 valores), 4 orquestador (vectores ck=10 que atraviesan
atenolol/empagliflozina). HECHO CLAVE: el generador de dorados llama cada regla con
todos los fármacos SIN clasificar por grupo → los «controles negativos» (CARVEDILOL,
metformina) SÍ activan las ramas de umbral bajo y divergen también. suite_43: **40/0**.

Mutaciones (filas 556-559): 11 → 52/1 suite_39; 12 → 52/1 suite_39 (y con réplica
literal del dorado 37/3 suite_43); 13 → 52/1 suite_39 (sin eco en dorados: cero
edoxabán en `_regla_doac.json`); 23 → 52/1 suite_39 (réplica literal: 37/3 suite_43).
Restauradas una a una; cierre **53/0** y **40/0**.

## FIX 14 — ✅ COMMITED (1b76c55)

`_SCRUB_RX_GRUPO_NUM` (L9123, tras el bloque de constantes de L9105): la clase de
separadores pasa de `[\s.-]` a `[\s.,-]` y la regex gana el sufijo opcional de
dígito verificador `(?:\s*-\s*\d)?`. Cubre los dos huecos del hallazgo 14:
- «1,023,456,789» (formato que devuelve Everest en algunos campos) viajaba ENTERA —
  ninguna regex del pipeline la cazaba (`_SCRUB_RX_DOC_PLANO` exige 6-11 dígitos
  contiguos y cada trozo queda corto).
- «1.023.456.789-0» salía «[CENSURADO]-0»: el DV quedaba expuesto.
Mismo pipeline de `mtrHcTachar`/`mtrHcValorLimpio` → `scrubPII` (bitácora, prompts
de IA, exportaciones). El decimal corto con coma («Dosis 1,5 mg») NO se toca (un
solo dígito tras la coma no casa `\d{3}`). Prueba SIBLING suite_31 (hermana del
caso de cédulas L65): 5 aserciones de censura + 1 falso-positivo de control.
**52 → 53 casos**; mutante (regex revertida) **52/1**, restaurado **53/0**. Fila 560.

## FIX 16+25 — ✅ COMMITED (c29328a)

`_pageFetchJsonCore` (núcleo de transporte del API): cuando Everest contesta HTTP **200**
con algo que no es un dato útil → `null` (el «sin respuesta» que los llamadores entienden
vía `{__sinRespuesta}`), **sin reintentar y sin contar ni éxito ni fallo**.

- **FIX 16** — 200 con sobre `{"Error":"texto"}`: antes se devolvía como dato legítimo
  (modal de cupos anunciando «no hay cupos» con el servidor caído + panel de salud en
  verde). Helper `_esSobreError200` (L21487-21496): objeto no-array con `Error` STRING
  no vacío. La bandera BOOLEANA `Error:true/false` (anulación de citas, L23585/23588/
  30763) sigue siendo respuesta legítima — hay caso explícito. Aplicado en la rama fetch
  (L21549+) **y** en la vía GM (L21599).
- **FIX 25** — 200 con cuerpo falsy o `json()` que revienta al parsear: antes caía fuera
  del if/else → 4 intentos con backoff + GM en cada uno + `_apiMarcarResultado(false)`
  → cortacircuitos abierto y panel rojo por una respuesta que sí llegó. Ahora: null,
  un solo intento, sin fallo.
- **AbortError del tope preservado** (v18.0.104, fila 6): re-lanzado ANTES del
  `return null` del catch — sigue siendo caída de red (su caso sigue en verde).
- suite_05: **35 → 37** casos (2 SIBLING tras el caso 401/404); mutaciones muertas
  **36/1** y **36/1** (filas 561/562), restauradas → **37/0**.
- No-regresión: suite_13 **64/0**, suite_19 **29/0**, suite_23 **109/0**, suite_33
  **23/0**, suite_70 **26/0**.

## FIX 17+18+22 — ✅ COMMITED (9ebd4c4)

Lectura del DOM de la agenda resiliente a renombres de clase Bootstrap y blindada
contra mezcla de PHI entre citas.

- **FIX 17** — `CONFIG.SEL` (~L9953) pasa a **LISTAS** de selectores (`hora`, `estado`,
  `contenedor`, `documento`, `nombre`, `modalidad`, `fecha`); nuevas `firstMatch()` y
  `qAll()` (unión de querySelectorAll en orden del mapa) en `extractAgenda`,
  `containerOf` y `seccionActiva`. Hoy cada lista trae SOLO el selector verificado
  contra Everest (no se inventan clases): si Everest renombra una clase, basta añadir
  el string al mapa — el código de lectura no se toca. `downloadDiagnostic`
  (L35741/35746) usa una lista hardcodeada propia: FUERA de alcance (hallazgo anotado).
- **FIX 18** — `_cedulaDelContenedor()`: itera los `.text-muted` del contenedor y se
  queda con el primero que PARSEE como cédula (mismo patrón que
  `extractPacienteAbierto`). Antes leía el primero a ciegas: un epígrafe/correo dejaba
  la cita con `doc_id ""` en silencio y el emparejamiento PyM moría para ese paciente.
- **FIX 22** — `containerOf()`: el fallback ascendente exige `_abrigaOtraHora()` — un
  ancestro con `.status-label` que abriga VARIAS citas ya NO sirve de contenedor
  (antes devolvía el wrapper de toda la agenda y la cita leía estado/cédula/nombre del
  vecino). La cita huérfana cae en valores por defecto (Pendiente / Paciente Everest /
  `doc_id ""`): casilla vacía antes que mezclar PHI.
- suite_14: **35 → 39** casos (4 SIBLING: qAll unión, ancestro multi-cita, cédula
  parse-first, cita huérfana) + invocaciones directas `api._abrigaOtraHora` /
  `api._cedulaDelContenedor` (limpia el aviso «JAMÁS invocadas vía api.» del runner);
  suite_04 mantiene **106** (su falso `tarjeta` aprende `querySelectorAll`).
- Mutaciones muertas: **38/1, 38/1, 37/2** (filas 563-565), restauradas → 39/0.
- No-regresión: suite_13 **64/0**, suite_19 **29/0**, suite_23 **109/0**, suite_33
  **23/0**, suite_70 **26/0**.

### Hallazgo operativo (para fz): el banco completo trunca en este entorno

`node tests/runner.js` SIN argumentos trunca tras suite_01 o suite_02 (no determinista):
node se queda sin trabajo pendiente y sale en silencio con código 0, sin resumen — el
modo de fallo que el propio runner documenta en L137-154 («alguna suite dejó una promesa
sin resolver»). **PROBADO PREEXISTENTE**: con el cambio de f16 stasheado, la línea base
TAMBIÉN trunca (cuenta `1218 de 1337` funciones vs `1219 de 1338` con el helper —
confirma que corría el árbol base). NO es regresión de esta campaña. El CI del repo corre
el banco completo; en este entorno hay que verificar **suite por suite** (el runner solo
acepta UNA suite por invocación: `process.argv[2]`). **f15 añade**: `suite_76_disco_hostil`
CUELGA TAMBIÉN EJECUTADA SOLA en este entorno (cabecera y nada más) — probado preexistente
con el código commiteado vía stash; suite_75 (disco camino feliz) corre verde.

## FIX 15 — ✅ COMMITED (4002024)

Cosecha merge multi-pestaña (lost update en `vgl_cosecha`).

- **Defecto** — `_vglCosechaGuardar` (L5347) hacía read-modify-write del almacén
  COMPLETO (hasta 80 pacientes) sin protección. Dos pestañas del Everest corren en
  procesos distintos: ambas leen S0, ambas fusionan y la que escribe última PISA la
  memoria clínica que la otra guardó. La guarda v18.0.4 redujo frecuencia, no cerró la
  ventana (el comentario del propio código lo admitía).
- **Fix (rebase-on-write, ~L5385)** — tras armar la fusión inicial se relee el disco
  vía `_vglCosechaTodo()`; si la memo quedó invalidada por contenido, se re-resuelve
  la clave (`_vglClaveDeDoc`), la fusión se rehace sobre lo fresco (la pantalla gana,
  como siempre) y `todo` se arma desde lo fresco. Poda y guarda de escritura existentes
  corren DESPUÉS y cubren la mezcla rebasada (cero código duplicado).
- **Prueba** — suite_64 **39 → 40** (SIBLING): `getItem` falso devuelve S0 en la 1.ª
  lectura y S1 después; aserciones sobre el mapa crudo del almacén. CERO PHI.
- **Mutación muerta** — fila **566**: `if (false && fresco !== previoTodo)` → «la
  memoria del paciente de la OTRA pestaña sobrevive (obtuvo false)» (39/1);
  restaurado 40/0.
- **No-regresión** — suite_32 **45/0**, suite_75 **50/0** (suite_76: cuelgue
  preexistente del entorno, ver hallazgo operativo de arriba).


## FIX 19-20+30-33 — ✅ COMMITED

Fronteras exactas sin aserción (hallazgos 19, 20, 30, 31, 32, 33).

- **Defecto (de cobertura)** — los tests usaban valores cómodos, nunca el valor
  EXACTO del umbral: colorAndAlert con 10 y 5,5 min (nunca 6 ni 5 justos, nunca
  3 actividades justas de PyM); guardas renales con peso 0/140 (nunca 20/300 ni
  creat 0,1/20 justos); candado «ya ordenado hoy» con "2020-01-01" (nunca el día
  SIGUIENTE). Un `>=` degradado a `>` tumbaría pacientes reales sin que el banco
  lo notara.
- **Verificación de producción** — el código era CORRECTO en todas las fronteras
  (`>=` inclusivo en L14761/L14810/L14812/L4511; candado por IGUALDAD `!==` en
  L9593) → el fix es SOLO adición de pruebas, cero cambio de producción.
- **Pruebas (8 SIBLING)** — suite_04 **106 → 111** (6/5/4,9 min y 3/2 PyM),
  suite_27 **12 → 14** (peso 20/19,9/300/300,1; creat 0,1/0,09/20/20,1 en
  Cockcroft y CKD-EPI), suite_09 **36 → 37** (sello del día de MAÑANA se resetea;
  contraste: orden de HOY sí bloquea). Edad 18/120 NO se duplica (suite_32 R2.3
  ya la prueba exacta).
- **Mutaciones muertas (filas 567-572)** — M1 grace `>=`→`>` (110/1), M2 prealert
  `>=`→`>` (110/1), M3 PyM `>=3`→`>3` (110/1), M4 peso `>=20`→`>20` (13/1), M5
  creat `>=0.1`→`>0.1` (13/1), M6 día `!==`→`<` (36/1). Cada una restaurada y
  grep-verificada antes de la siguiente.
- **No-regresión** — suite_10 **30/0** (toca colorAndAlert), suite_32 **45/0**.


## FIX 24+26+27+28+29 — ✅ COMMITED (9065a96)

Hallazgos 24 (compuerta de escritura por URL sin cobertura directa), 26 (extracción
naive del id de paciente en la orden), 27 (frontera de vigencia de confirmaciones),
28 (frontera de frescura de precarga de labs), 29 (bandera de sesión Athenea viva).

- **Defecto real (2 de producción)** —
  (f26) `apiOrdenamientoBuscarPaciente` extraía el id con una cadena naive
  (`res.data && res.data.idPaciente ? … : null`): si la ficha llegaba anidada en
  `data` (o `data.data[0]`) devolvía null y hundía la orden de PyM entera;
  (f29) si la sesión de Athenea caducaba A MITAD de la búsqueda (paso 2 devuelve
  pantalla de login), la bandera `atheneaSesionViva` quedaba en su valor previo y
  el keep-alive seguía en cadencia de sesión viva.
- **Defecto de cobertura (3)** — fronteras exactas sin aserción: frescura de
  precarga de labs (`< 2 min` estricto en L24990 con `LABS_PRECARGA_FRESCA_MS`),
  vigencia de confirmaciones (`<= dias` en L6103: 30 días EXACTOS vigente,
  +1 ms vencido, sello vacío null), y `accesoEscribirUrl` sin prueba directa de
  las tres grafías de cancelación (`CancelarCita|AnularCita|CancelarTurno`, L10823)
  ni contraste con URLs de IMPRESIÓN que no son escritura.
- **Fix de producción (2)** — f26: `extractPatientId(res)` (extractor blindado,
  L30611) — ante la duda null: "no se pudo" es reversible, un id equivocado no;
  f29: `atheneaSesionViva = false` al detectar login en el paso 2 (L2638) +
  accessor `_atheneaSesionVivaParaTest()` junto a `atheneaKeepAlive` (funciones
  alcanzables 1222 → 1223).
- **Pruebas (5 SIBLING)** — suite_05 **37 → 38** (ficha anidada/doble/ruido),
  suite_18 **93 → 94** (bandera a false tras paso-2-login), suite_15 **273 → 274**
  (119,5 s sirve caché / 120,5 s consulta en vivo), suite_48 **56 → 57** (30 días
  exactos, +1 ms, sello 0), suite_78 **34 → 35** (AnularCita/CancelarTurno cerradas
  para LABORATORIOS; impresión de orden/links y BuscarPaciente pasan incluso
  BLOQUEADO). `cubre` de suite_78 extendido con `accesoEscribirUrl`.
- **Mutaciones muertas (filas 573-577)** — M1 extractor → naive (37/1), M2 sin
  baja de bandera (93/1), M3 ventana 2 → 10 min (272/2: la nueva + frontera C11
  existente), M4 `<=` → `<` (56/1), M5 regex sin `AnularCita` (34/1). Cada una
  restaurada y grep-verificada antes de la siguiente.
- **No-regresión** — las 5 suites tocadas en verde: 38/94/274/57/35.

### Hallazgo de entorno: CRLF rompía suite_15 (rojo preexistente, hallazgo 11)

Al retomar, suite_15 fallaba su test de patrón (chips de especialidad): el disco
tenía el userscript 100 % CRLF (50 406 CR) y `src.indexOf("\n    });\n", …)`
devolvía -1 → bloque truncado. Producción CORRECTA (el handler SÍ llama
`renderDayChips`). **Resuelto** normalizando el userscript a LF en disco (script
Node sin BOM, cero diff de contenido — el índice ya era LF). **Riesgo de
recurrencia**: `core.autocrlf=true` re-CRLF-eará el archivo en un checkout futuro
y el test volverá a caer; NO se tocó .gitattributes ni la config de git ni el
test. Anotado aquí para quien lo vea roto otro día.


## FIX 34-36 — ✅ COMMITED (3ccc466)

> NOTA: el texto original de los hallazgos 34-36 se PERDIÓ con la auditoría M2M
> (el orquestador ya no los contiene). Se reconstruyeron por su título de
> clúster — "resiliencia anclas (ngb-tab-8, copy exacto, uro FormControl)" — y
> por inspección del código: los tres señalaban anclas frágiles contra
> rediseños de Everest/Angular.

- **f34 (ngb-tab-8, defecto real de producción)** — `_vglBarraPestanasPrincipal`
  solo anclaba por 4 ids: `ngb-tab-8` (autogenerado por Angular POR POSICIÓN: se
  renumera si Everest añade/reordena pestañas) y `pes`/`anamesis`/
  `impDiagnostica` (ids internos borrables en un rediseño). Fix: constante
  `VGL_BARRA_TEXTOS` (L6697, textos titulares de `VGL_PESTANAS`, SIN "conducta")
  + respaldo por TEXTO (L6731-6745): barrido de `a[role="tab"]` subiendo al
  tablist cuyo texto contenga un titular. El tabset suelto de los programas
  (Síndrome Metabólico/Hipertensión/Diabetes/ERC, v17.1.1/#151) NO contiene
  ninguno de esos textos → el respaldo no puede anclar al decoy. Defensivo con
  `querySelectorAll` faltante (try + `typeof === "function"`).
- **f35 (copy exacto, solo cobertura)** — la normalización
  `replace(/\s+/g," ").trim()` + `stripAccents().toLowerCase()` + `indexOf` de
  `_vglPestanaActiva`/`_vglEnPestana` ya era correcta; sin pruebas de frontera.
  Fix: SIBLING con doble espacio interno, MAYÚSCULAS totales, tildes, copy más
  largo que el nombre, y negativos que solo comparten palabras («Ruta de
  atención», «Impresión terapéutica», «Antecedentes anamnésicos»).
- **f36 (uro FormControl, defecto real de producción)** — `_marcarUroanalisisSi`
  seleccionaba `input[name="resultadoPrograma.swUroanalisis"]`: el prefijo
  `resultadoPrograma.` es estructura interna del FormControl (refactorable sin
  aviso). Fix: ancla por SUFIJO `input[name$="swUroanalisis"]` (L1875).
- **Pruebas** — suite_64 **40 → 42** (casos f34 y f35 tras el #151); suite_08
  **150 → 151** (SIBLING f36 tras «sin radios en esta vista»); **15 mocks** del
  selector uro en suite_08 + **1** en suite_34 migrados de igualdad exacta a
  substring `indexOf("swUroanalisis")` (el handoff registraba 7; el grep reveló
  15 en total — los 8 extra eran los que caían).
- **Mutaciones muertas (filas 578-580)** — M1 respaldo desactivado (suite_64
  41/1), M2 sin `replace(/\s+/g," ")` (41/1), M3 selector a name completo
  (suite_08 150/1). Cada una restaurada y grep-verificada.
- **No-regresión** — suite_64 42/0, suite_08 151/0, suite_34 16/0, suite_32
  45/0, suite_71 90/0. Verificado además: `tests/mutantes/*.json` NO se ejecuta
  (suite_34 filtra `^suite_.*\.js$`; los JSON solo viven en catálogos y docs);
  harness.js, `docConducta` y `barraDeEverest` devuelven `[]`/`null` para
  `a[role="tab"]` → el respaldo nuevo no los altera.

## Cierre fz — banco completo, reparación y push

- **Banco completo desacoplado** (`_banco.ps1`: una suite por proceso node con
  hasta 5 reintentos contra los 0xC0000139 aleatorios del spawn): las ~85 suites
  del repo terminaron con **3164 comprobaciones en verde / 0 fallan** tras la
  reparación. Sin "SIN RESUMEN".
- **El banco destapó 2 suites rotas por los commits de la propia campaña**
  (la producción estaba bien; lo roto era la prueba). Reparadas en el commit
  **26fee95**:
  - suite_17 (2 fallos): 9ebd4c4 (f17+18+22) hizo que `_cedulaDelContenedor`
    recorriera el contenedor con `querySelectorAll` y los 2 mocks de tick, que
    solo sabían `querySelector`, lanzaban TypeError → `summarized` nunca llegó a
    true. Fix: los mocks aprenden `querySelectorAll`. **52/0**.
  - suite_72 (1 fallo): dd59ac6 (f8) ensanchó el ternario del aviso a
    `(parcial || soloRecuperadas)` y el lint literal dejó de casar. Fix: regex
    tolerante `\(parcial[^)]*\) \?`. **25/0**.
  - Mutaciones muertas de cada reparación: **filas 581-582** de
    `tests/INFORME_MUTACIONES.md` (581: 24/1 → restaurado 25/0; 582: 51/1 →
    restaurado 52/0). No-regresión: suite_14 39/0, suite_04 111/0.
- **`tests/suite_82_consentimiento.js`**: archivo VACÍO (0 bytes), no commiteado,
  ajeno a esta campaña — el runner tropieza con él ("suite.pruebas is not a
  function"). Se dejó en disco sin tocar y NO se cuenta en el total del banco.
- **PUSH** de `claude/m2m-fixes-30` (13 commits: 8417a67 … 26fee95) con el PAT
  ya usado en sesiones previas.

## Pendientes operativos

- [x] Todos los commits de f8-f34 (dd59ac6 … 3ccc466).
- [x] Banco completo: desacoplado por suite (el runner de una pieza cae con
  0xC0000139 tras ~30 suites en este host) — 3164/0.
- [x] PUSH con el PAT ya usado en sesiones previas.
