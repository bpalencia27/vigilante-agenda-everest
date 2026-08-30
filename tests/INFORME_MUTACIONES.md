# Informe de mutaciones verificadas

> Cada fila es una prueba que se **rompió a propósito** y se comprobó que una prueba
> concreta se pone roja, se restauró, y se confirmó que el banco vuelve a verde.
> La disciplina está en `CLAUDE.md`: *todo cambio de comportamiento requiere mutación
> verificada*. Una prueba que no cae cuando el código se rompe no está probando nada — y
> este proyecto ya se llevó nueve sustos con pruebas que reportaban verde sin ejecutar.

## v17.6.82 — 26-ago-2026 ("no aparece mi nombre donde dice Médico" — caché de identidad por login)

Reporte en vivo con captura: en "Programación de cita" el campo "Médico:" salía vacío, y el
médico sospechó (correctamente, aunque la causa raíz no era la que él imaginó) que por eso
no le salían sus agendas — `_agendasPropias` filtra los cupos del día por el NOMBRE del
médico, así que con `doctorName === ""` ningún cupo hace match y la lista sale vacía.

Investigado con `git log -S` sobre `resolverMedicoPorPerfil`/`captureDoctorInfo`/
`identidadDesdeCliente`: ninguna de las tres cambia desde v12.3.1/v12.3.2 — no es una
regresión de esta versión. La causa real: las TRES vías de identidad (URL sniffing, login
publicado por Everest, localStorage/cookie del cliente) convergen todas en UNA sola llamada
de red — `GET GetUsuarioPerfil/<login>` —, y ese endpoint estuvo devolviendo 503 durante
TODA la sesión (confirmado en capturas de consola repetidas, en páginas distintas, a lo
largo de horas). Es deliberado por diseño (v12.3.2): en un equipo COMPARTIDO entre varios
médicos, el login leído del localStorage NUNCA se acepta sin que el backend lo valide —
de lo contrario, la sesión rancia de un médico anterior podría firmar citas/órdenes a
nombre de otro. Confirmado en vivo: el médico reportó "ya me reconoció" minutos después,
sin ningún cambio de código — Everest se recuperó solo.

Mejora pedida por el médico ("quiero que sea automático como antes, blíndalo más"): una
caché por LOGIN EXACTO (no "el último que pasó por este equipo") de la última identidad que
el backend SÍ validó, con vencimiento de 12 h. Con caché, `resolverMedicoPorPerfil` fija
`state.activeDoctor` de inmediato (síncrono, antes de esperar la red) mientras la llamada a
Everest confirma o corrige en segundo plano — así una caída del endpoint ya no deja "Médico:"
vacío durante toda la sesión. La garantía de v12.3.2 queda intacta: el login de un médico
DISTINTO simplemente no tiene entrada en la caché y exige validación fresca, igual que
siempre.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **lectura de caché** | `_identidadMedicoCacheLeer` vuelto a `return null;` sin condición | `suite_19` | *CON caché para ESE login, fija id+nombre de inmediato aunque GetUsuarioPerfil siga caído* → *de caché, de inmediato: esperaba 515 y obtuvo 0* |
| **escritura de caché** | la llamada a `_identidadMedicoCacheGuardar(...)` tras un 200 exitoso se comentó | `suite_19` | *al validar por red con éxito, guarda en caché para la próxima carga de página* → *quedó una entrada de caché para ese login (obtuvo false)* |

Las dos mutaciones se aplicaron una a la vez sobre producción, cada una cayó con la
aserción exacta esperada, y ambas se restauraron verificando `diff` contra una copia
intacta tomada antes de mutar. El banco completo volvió a 2294/2294 tras la restauración
final. Las pruebas nuevas también cubren, sin necesidad de mutación adicional (ya
verificado por construcción del propio caso): que una caché de OTRO login (equipo
compartido) NUNCA se usa, y que una entrada de más de 12 h se trata como si no existiera.

## v17.6.81 — 26-ago-2026 (Cockcroft-Gault disfrazado de CKD-EPI + notas largas entran a la rotación de cuota)

Dos reportes en vivo, la misma tarde.

**1) "No reconoce el peso" — y la fila de filtrado lo disimulaba.** Captura real: "Peso —
sin dato" arriba, pero "Filtrado (Cockcroft-Gault): 21.1 mL/min" abajo, como si el cálculo
SÍ hubiera usado el peso. Causa: sin peso, `erc.crcl` (Cockcroft-Gault real) da `null`, pero
`mtrFichaVivaFilas` caía a `erc.egfr` (CKD-EPI, que NO necesita peso) y lo pintaba bajo la
MISMA etiqueta "Cockcroft-Gault" — una fórmula disfrazada de otra, justo lo que "sin dato =
sin suposición" prohíbe. El peso en sí seguía sin leerse del DOM (bug real y distinto, aún
en investigación con `DIAGNOSTICO_PESO_TENSION_VIVO.js`), pero esta fila ocultaba esa
ausencia detrás de un número que parecía confirmar lo contrario. Fix: la etiqueta ahora dice
la verdad — "Filtrado (CKD-EPI — falta peso para Cockcroft-Gault)" cuando no hay CG real.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **etiqueta honesta** | `mtrFichaVivaFilas`: la fila de filtrado vuelve a decir siempre `"Filtrado (Cockcroft-Gault)"` sin condicional | `suite_63` | *REGRESIÓN (v17.6.81): sin peso, la fila de filtrado NO se disfraza de Cockcroft-Gault* → *dice CKD-EPI: Filtrado (Cockcroft-Gault) (obtuvo false)* |

**2) "Sigue apareciendo gemini-3.7-flash".** Decisión original (v16.5.0, 20-ago): Enfermedad
actual y Análisis y plan siempre usan el modelo más capaz (el de menor cupo diario), aparte
de la rotación de cuota de las casillas cortas. El médico reportó en vivo, otra vez, que
"gemini-3.7-flash sigue apareciendo" pese al respaldo de rotación-si-falla (v17.6.69) — el
PRIMER intento de toda nota larga golpeaba siempre ese mismo modelo, entrevista tras
entrevista. Confirmado con el médico (26-ago): revertir la excepción — Enfermedad actual y
Análisis y plan entran ahora a la MISMA rotación de cuota que las casillas cortas, desde el
primer intento. `MTR_MODOS_NOTA_LARGA` se conserva sin tocar para lo que sigue siendo
suyo: excluir `thinkingLevel:"minimal"` de las notas largas (eso es del LARGO del texto, no
de qué modelo lo genera).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **rotación para notas largas** | `mtrModeloGemini` vuelve a devolver el modelo potente fijo para `enfermedad_actual`/`analisis_plan` | `suite_57` | *la nota médico-legal ya no tiene modelo fijo: usa la rotación, igual que sin modo* → *esperaba "gemini-3.5-flash-lite" y obtuvo "gemini-3.7-flash"* |

Las dos mutaciones se aplicaron JUNTAS sobre producción (una por archivo/función, sin
solaparse), cada una cayó con la aserción exacta esperada, y ambas se restauraron
verificando `diff` contra una copia intacta tomada antes de mutar. El banco completo volvió
a 2289/2289 tras la restauración final.

## v17.6.80 — 26-ago-2026 (la caja de "cifras sin respaldo" marcaba en rojo umbrales reales de dosis renal)

Reporte en vivo con captura: la nota de Análisis y plan citaba textualmente una alerta de
seguridad ("máximo 1000 mg/día con TFG 30-44 mL/min/1.73m2", "renoprotector hasta TFG
20-25...") y la caja roja de "cifras sin respaldo" marcaba esos umbrales como inventados.
No lo son: son el mensaje LITERAL de `mtrAvisosDosisRenal` (`alertas_dosis`), que el propio
prompt de "Análisis y plan" le ordena a la IA citar. `mtrVerificarCifrasIA` solo conocía la
hoja de hechos — nunca supo que `alertas_dosis` es un SEGUNDO canal que también llega a la
IA, así que cada número de un umbral clínico legítimo se leía como cifra sin respaldo.
Se agregó un tercer parámetro opcional (`extraConocido`) con las mismas alertas que la IA
recibe, calculadas una vez al abrir el panel de redacción.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **fuente extra de conocidas** | `mtrVerificarCifrasIA`: `if (Array.isArray(extraConocido)) for (const t of extraConocido) sumar(t);` se cambió a `if (false && ...)` | `suite_57` | *un umbral de dosis renal citado textualmente NO se marca cuando se declara como conocido* → *esperaba 0 y obtuvo 2* |

Se aplicó sobre producción, cayó exactamente la prueba nueva, se restauró (verificado con
`diff` contra una copia intacta) y el banco volvió a 2287/2287.

## v17.6.79 — 26-ago-2026 (fusión con la otra sesión + botones de imprimir orden rotulados por id crudo)

**Nota de orden**: esta rama tuvo dos sesiones trabajando en paralelo el mismo día —
esta (fixes en vivo #1-6 más abajo, escritos como v17.6.73-76 antes de saberlo) y la de
`origin/claude/hunks-cluster-remaining-9fjixx` (v17.6.65-78, con su propio historial
completo intercalado más abajo en este archivo). Al fusionar, las entradas quedaron en
el orden en que git las concatenó, no estrictamente por número de versión — las
entradas "v17.6.73/74/75" de abajo son reales y verificadas, solo que el número final
que terminó llevando el archivo (por la fusión) es este, 17.6.79. El detalle técnico y
las mutaciones de cada una siguen siendo válidos tal como están escritos.

### Botones de imprimir orden rotulados con el id crudo del agrupador, no con la actividad

Reporte en vivo: con 2+ órdenes PyM generadas a la vez, los botones "🖨️ Orden 483920"
no dejaban saber cuál era VIH y cuál PSA sin abrirlos a ciegas. Se anota `pkg.titulo`
(el mismo texto de la tarjeta que el médico ya reconoce al marcar las casillas) por
agrupador, en el mismo bucle donde `apiOrdenamientoGuardar` ya lo confirma, y se usa
para rotular cada botón: "🖨️ VIH (Anticuerpos VIH 1 y 2)" en vez de "🖨️ Orden 483920".

**Sin mutación automatizada propia**: el punto de cambio vive dentro del flujo asíncrono
completo de `openOrdenamientoModal` (búsqueda de paciente → Dx → CUPS →
`apiOrdenamientoGuardar` por cada actividad seleccionada), sin una suite existente que
mockee esa cadena completa con múltiples agrupadores distintos — mismo tipo de deuda
que el triaje de agendamiento y el peso del Panel, documentados abajo. Se verificó
leyendo el código de punta a punta: `_tituloPorAgrupador` se llena en el mismo punto
donde `agrupadores.push(agpReal)` ya confirma qué `pkg` generó ESE agrupador exacto, y
el rótulo del botón cae a `"Orden " + agp` si por algún motivo faltara el título — nunca
queda un botón sin texto. Queda como deuda explícita el mismo mock de
`apiOrdenamientoGuardar`/`apiOrdenamientoObtenerDx`/`apiOrdenamientoObtenerCup` con dos
paquetes distintos, para blindar esto y los demás pasos de ese flujo de una vez.

## v17.6.75 — 26-ago-2026 (dos reportes más en vivo: avisos en tres pantallas puntuales, y la TFG ciega al peso recién escrito)

### 1. El médico nombró tres pantallas donde NO quiere sonido/notificación

Confirmado con dos preguntas puntuales: el panel y el sonido siguen tan amplios como
hoy en todo lo demás (Citas del día + Historia + Ordenamiento-dentro-de-historia,
invariante v14.1.5 intacto), pero en `/viva/Acceso/`, `/viva/EverHealth/OrdenamientoHealth`
y `/viva/EverHealth/` a secas, ni tono ni notificación de Windows ni toast — el hecho se
sigue contando y el cartel queda en cola para cuando vuelva a una pantalla clínica real.
Nueva función `_enPaginaExcluidaDeAvisos()`, gemela de `_enModuloHCHealth()`.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **exclusión de avisos** | `maybeNotify`: la rama `else if (_enPaginaExcluidaDeAvisos()) _encolarAvisoPendiente(payload);` se retiró (las tres páginas nombradas vuelven a sonar) | `suite_04` | *v17.6.75: en las tres pantallas que el médico nombró, el aviso NO suena…* → *ni una sola notificación de Windows en ninguna de las tres rutas nombradas: esperaba 0 y obtuvo 3* |

Se aplicó sobre producción, cayeron exactamente las pruebas nuevas de `suite_04` y
`suite_14` (`_enPaginaExcluidaDeAvisos`), se restauró (verificado con `diff` contra una
copia intacta) y el banco volvió a verde. Dos pruebas viejas (`maybeNotify v14.1.5...` y
`_flushAvisosPendientes: al volver a HCHealth...`) usaban `/viva/Acceso/` como ejemplo de
"cualquier pantalla fuera del módulo" — se migraron a `/viva/OtraPantalla/` porque ese
ejemplo concreto ahora SÍ tiene un comportamiento distinto (el invariante v14.1.5 general
sigue vivo, solo cambió para las tres rutas nombradas).

### 2. Cockcroft-Gault nunca tuvo un lector de DOM en vivo para el peso

Reporte en vivo con dos capturas: "no aparece la TFG y me dice que falta el peso pero yo
ya lo consigné en su respectiva casilla de Everest" (Peso (Kg): 77, con asterisco
obligatorio, en Examen físico). A diferencia de la tensión (`mtrLeerTensionDelDom`) y la
cintura (`mtrLeerCinturaDelDom`), nunca existió un `mtrLeerPesoDelDom` — Cockcroft-Gault
solo recibía `ent.peso` (lo que ya trajera la entrada de Athenea/API), así que un
paciente sin peso guardado por esa vía se quedaba "sin dato" aunque el médico lo
acabara de escribir delante de sus ojos. Ancla real confirmada en `grounding/mapas/`:
`id="peso"` (tipo number, obligatorio, pestaña "Examen físico"). Se agregó el lector y
se conectó en los mismos tres puntos que ya reconcilian la tensión en vivo:
`mtrResumenDesdeModalLabs` (la vía principal), la apertura del Panel y su vigilancia de
20 s (`_tableroFirmaDom` tampoco incluía el peso en su firma — sin eso, escribirlo no
contaba como "algo cambió" y la vigilancia nunca reclasificaba por esa sola razón).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **lector puro** | `mtrLeerPesoDelDom`: `return mtrLeerCampoNumerico("peso", doc)` se cambió por `return null` | `suite_55` | *mtrLeerPesoDelDom: lee la casilla real id="peso" de Examen físico…* → *el peso recién escrito… esperaba 77 y obtuvo null* |

Se aplicó sobre producción, cayó exactamente la prueba nueva, se restauró (verificado con
`diff` contra una copia intacta) y el banco volvió a 2267/2267. **Sin mutación propia
para el cableado en `mtrResumenDesdeModalLabs`/el Panel**: es el mismo caso que el
triaje de agendamiento de v17.6.74 — el punto de fusión (`ent.peso != null ? ent.peso :
pesoDom`) es un one-liner que reutiliza EXACTAMENTE el patrón ya probado de la tensión
(`ent.pas != null ? ent.pas : ta.pas`, misma función, tres líneas más abajo, con su
propia cobertura en `suite_47`); se verificó leyendo el código de punta a punta y
confirmando por grep que antes de este cambio no existía ningún respaldo de DOM para
`pesoKg` en ninguna de las tres rutas. Queda como deuda explícita construir el mock de
`document.querySelector` a nivel de harness para probar el cableado de punta a punta,
no solo el lector puro.

## v17.6.74 — 26-ago-2026 (dos reportes en vivo, en plena consulta: triaje ciego a la tensión de hoy, y "extemporáneo" originado por una pestaña de fondo)

### 1. El triaje de agendamiento (franja sugerida) leía la tensión CACHEADA, no la de hoy

Reporte en vivo con captura: paciente con PA 140/100 tomada hoy salía "🟢 Paciente
estable... Sugerido: Final de la jornada". `_evaluarComplejidadPaciente` en sí estaba
bien (`paDescontrolada` exige PAS≥160 o PAD≥100 — 140/100 sí debía disparar la insignia),
pero su único llamador real (`openAgendamientoModal`) lo alimentaba con
`mtrCacheResumenLeer(apt.doc_id)` sin más — la tensión que traía era la del último
resumen calculado (al abrir Laboratorios o el Panel), nunca la que el médico ACABA de
escribir en Signos Vitales de esta consulta si no volvió a abrir el Panel después. El
Panel del paciente sí reconcilia la tensión en vivo con `mtrLeerTensionDelDom` antes de
clasificar (ver `openPanelPacienteModal`); el agendamiento no lo hacía. Se agregó la
misma reconciliación, mismo patrón, antes de llamar a `_evaluarComplejidadPaciente`.

**Sin mutación automatizada propia todavía**: el punto de falla vive dentro del tramo
asíncrono de `openAgendamientoModal` (tras `await ...BuscarPacienteDetallado`), y las
suites existentes que abren ese modal (`suite_61`) lo hacen de forma síncrona, inspeccionando
el banner ANTES de que esa promesa resuelva — no llegan a ejercitar esta línea. Se
verificó leyendo el código de punta a punta y confirmando por grep que `_evaluarComplejidadPaciente`
nunca recibía una tensión reconciliada en ningún otro punto de la función. Queda como
deuda explícita: construir un test async con `pageFetchJson` mockeado para
`BuscarPacienteDetallado` y una tensión de DOM inyectada, análogo a los de `suite_67`
para el Panel — no se quiso demorar la entrega de un fix en vivo por escribir esa
infraestructura de prueba desde cero en plena consulta del médico.

### 2. "Confirmación extemporánea" podía originarla una pestaña de fondo, estrangulada por el navegador

Reporte en vivo: "me salió de nuevo esos avisos de que me confirmaron pacientes
extemporáneos... es como si el script no leyera en tiempo real la agenda". La marca
`fraudWatch` (la que convierte un "Sin presentarse" vencido en un ROJO permanente para
el resto del día, incluso después de "Atendido") la podía originar y compartir CUALQUIER
pestaña abierta de Everest —el chequeo `if (!state.leader)` de `colorAndAlert` vive
DESPUÉS del bloque que marca `fraudWatch`, no antes—, y una pestaña de fondo tiene su
temporizador estrangulado por el navegador (el propio médico lo tenía en su consola:
"la pestaña líder está oculta y el navegador le estrangula el temporizador"), así que su
sondeo puede llegar tarde y confirmar "pasados los 6 minutos" con una lectura vieja,
mientras la pestaña activa ya vio "En Sala" hace rato. La marca se comparte a todas las
pestañas (`_fraudeCompartidoGuardar`/`_fraudeCompartidoFusionar`) y no existe ninguna vía
para deshacerla. Ahora solo la pestaña LÍDER puede originar la marca.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **guarda de origen** | `colorAndAlert`: `if (state.leader && !state.fraudWatch.has(key))` se cambió a `if (true && !state.fraudWatch.has(key))` (cualquier pestaña vuelve a poder originar la marca) | `suite_04` | *v17.6.74: una pestaña NO líder no origina fraudWatch…* → *pero NO origina la marca compartida — eso solo lo hace la líder (obtuvo true)* |

Se aplicó sobre producción, cayó exactamente la prueba nueva, se restauró (verificado con
`diff` contra una copia intacta) y el banco volvió a 2263/2263.

## v17.6.73 — 26-ago-2026 (se restaura la guarda anti-repetición de inasistencia/extemporánea, perdida en el camino entre ramas)

Reporte en vivo del médico (26-ago, en plena consulta): "me salió de nuevo esos avisos
de que me confirmaron pacientes extemporáneos en otra pestaña de Everest, algo pasó con
eso. No es normal, antes funcionaba bien". Investigado con el archivo real que el médico
tiene instalado (`v17.6.65`, aportado en consultorio): la guarda
`if (!_conto && (a.color === "AMBAR" || a.color === "ROJO")) return;` de `maybeNotify`
(el fix de v17.6.52 "la inasistencia no vuelve a avisar tras un parpadeo") NUNCA llegó a
ningún commit compartido — quedó escrita, probada y mutada en un `git stash` local que
nunca se subió, así que ni la rama que se fusionó como base (`f430d66`) ni la rama de
donde se recuperaron las 31 suites (`origin/claude/hunks-cluster-remaining-9fjixx`)
la tenían. Se restauró desde el propio stash (la prueba `t.caso` correspondiente
sobrevivió intacta ahí también) y se re-verificó con mutación antes de dar el caso por
cerrado.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **guarda anti-repetición** | `maybeNotify`: `if (!_conto && ...)` se cambió a `if (false && ...)` (la guarda queda inerte) | `suite_04` | *v17.6.52: la inasistencia (AMBAR) NO vuelve a avisar tras un parpadeo de estado…* → *la marca no se reescribió (obtuvo true)* |

Se aplicó sobre producción, cayó exactamente la prueba esperada, se restauró (verificado
con `diff` contra una copia intacta) y el banco volvió a 2262/2262.

### De regalo, en la misma revisión: una suite recuperada citaba una función ya retirada

Al recuperar las 31 suites de `origin/claude/hunks-cluster-remaining-9fjixx` (fusión ya
hecha en esa rama con `origin/claude/v17-6-2-22ago`), `tests/suite_58_ia_insercion.js`
seguía declarando `cubre: [..., "mtrInsertarNota"]` y llamando a `api.mtrInsertarNota(...)`
directamente en tres casos — pero esa función (nunca tuvo llamador en producción desde
v17.6.10, según su propio comentario) ya no existe en el archivo actual: se retiró en
algún commit posterior de esa misma rama sin que la suite se actualizara. El validador de
cobertura del runner lo trata como error fatal (por diseño, para cazar justo este tipo de
deriva) — el banco no corría en absoluto hasta corregirlo. Se quitó `mtrInsertarNota` de
`cubre` y se retiraron los tres casos que la llamaban directamente; `mtrCasillaPorNombre`,
`mtrCasillaAnalisis` y `mtrInsertarSiVacia` (las tres funciones que sí siguen vivas, ver
`mtrInsertarEnCasillaModo`) quedan cubiertas igual por los casos restantes de la misma
suite. No es una mutación de comportamiento propio — es limpieza de un `cubre` desactualizado —
así que no lleva fila en la tabla de arriba.
## v17.6.78 — 26-ago-2026 (ítems 6 y 7: documentación de divergencias vigentes y código muerto dudoso — solo comentarios, CERO cambio de comportamiento)

Ambos ítems son documentación pura (comentarios en el código), riesgo bajo por diseño —
sin cambio de comportamiento, por lo que NO aplica mutación verificada (la disciplina de
CLAUDE.md la exige para "todo cambio de comportamiento"; un comentario no lo es). Se
confirmó con `TZ=America/Bogota node tests/runner.js` que las 2280 pruebas siguen en
verde, sin ninguna nueva ni ninguna caída, tras cada tanda de comentarios. Se combinan en
una sola entrega por ser ambos de la misma naturaleza (documentación, mismo nivel de
riesgo) — no porque no se hayan verificado por separado.

**Ítem 6 — divergencias de la sección 5, ya vigentes, comentadas junto a su código**:
- `falla_dispensacion` fijo en "NO" (`mtrJsonV68DesdeResumen`): sin comentario previo;
  se documenta que el Vigilante no tiene forma de saber si la EPS falló en dispensar, y
  que inventar "SI" dispararía en el prompt la constancia médico-legal sobre un paciente
  sin problema real — el peor tipo de dato inventado.
- Orden de redondeo CKD-EPI/Cockcroft-Gault (`cockcroftGault`/`ckdEpi2021`): se documenta
  que el redondeo a 1 decimal ocurre ANTES de que `estadioKDIGO()` clasifique el
  estadio — fiel al port del Copiloto, no un descuido; cambiar el orden sería una
  decisión clínica nueva.
- Discordancia clínico/administrativo para DOAC/gabapentinoides/HBPM: se documenta junto
  a `MTR_FORMULA_CG`/`MTR_FORMULA_CKDEPI` que `mtrReglaDoac`/`mtrReglaGabapentinoide`/
  `mtrReglaLmwh` usan Cockcroft-Gault (fiel a ficha técnica/estándar FDA de dosis renal)
  mientras el resto de reglas usa CKD-EPI (el estadio clínico) — el estadio que ve el
  médico puede no coincidir con la TFG que de verdad gatilla el ajuste de esos 3 grupos.
- Ventana de 180 días para remisión por progresión / correcciones de IRA por salto
  KDIGO (`MTR_IRA_VENTANA_DIAS`, `mtrPenultimaCreatinina`, `mtrSospechaIra`): YA estaban
  extensamente documentadas (comentarios v17.0.0/v17.0.1/v17.0.2 existentes) — se
  confirmó que cubren ambos consumidores (`mtrSospechaIra` Y el criterio de progresión
  de `mtrRemisionNefrologia`); no se dupicó comentario, solo se verificó.
- Gap de normalización de unidades (`_objecionOficialAlValor`/`_labNumerico`): se
  documenta que el motor SOLO detecta y BLOQUEA valores implausibles (p.ej. creatinina
  en µmol/L) — nunca los CONVIERTE — por decisión deliberada: convertir exigiría
  detectar con certeza la unidad de origen, y una conversión mal disparada sería
  inventar un número.
- Festivo raro 2026-07-13/2027-07-12: YA estaba documentado como "DIVERGENCIA ABIERTA"
  con referencia a `docs/MOTOR_PORTADO.md §divergencias` y cubierto por la suite 43 — no
  se tocó, ya cerrado el círculo de documentación.
- Ventanas ANR desplazadas (`mtrPlanParaclinicos`, cálculo del Agujero Negro Renal): se
  documenta que la ventana se ancla en "hoy" (el día en que se calcula el plan), no en
  la fecha de la propia creatinina — se "desplaza" cada vez que el plan se recalcula en
  un día distinto. Nota: no se localizó el texto original exacto de la auditoría para
  esta divergencia; la documentación se basó en lectura directa del código, fiel a la
  regla de "no documentar a ciegas" — si la intención original era otra, requiere
  confirmación del médico.
- `medicamentos_actuales` sin frecuencia: CERRADA por el fix de v17.6.66 (ítem 1 de esta
  misma lista de trabajo) — se documenta el CIERRE, no la divergencia (ya no es vigente).

**Ítem 7 — código muerto DUDOSO, investigado uno por uno (ningún borrado, solo
documentación, sin autorización explícita para eliminar)**:
- `CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO`: SIN caller de producción, pero YA estaba
  extensamente documentado (comentario existente explica que espera la pieza P6 de
  estadio-consciencia, todavía sin implementar según ese comentario) — no se agregó
  comentario nuevo, ya está cubierto.
- `_rumTramo`: SIN caller de producción (confirmado por grep) — instrumentación propia
  de RUM (v17.1.0 #149), probada pero nunca adoptada por ningún llamador real.
- `debounceVgl`: SIN caller de producción — debounce genérico probado, sin ningún
  handler de eventos que lo use todavía.
- `_pesoDeSignosVitales`: SIN caller de producción — hallazgo: quedó SUPERADA por
  `_signosVitalesDelRegistro` (que sí tiene un llamador real, línea ~16108, y extrae el
  mismo peso además de PAS/PAD/IMC).
- `_signosVitalesInvalidar`: SIN caller de producción — hallazgo: mismo patrón exacto
  que sus hermanas `mtrMedsInvalidar` y `_demograficosInvalidar` (tampoco tienen
  caller): las tres cachés de invalidación manual del archivo terminaron apoyándose
  solo en TTL, ninguna se enganchó a un evento real.
- `extractAgrupador`: SIN caller de producción — hallazgo MÁS FUERTE: el propio
  comentario de la función anuncia que sirve para "el manejo de éxito más abajo" de
  GuardarOrdenamiento, pero ese manejo de éxito (línea ~21977) terminó con su PROPIA
  expresión en línea, más angosta, en vez de llamar a esta función escrita
  específicamente para ese caso.
- `mtrInsertarSiVacia`: SIN caller de producción — hallazgo: `mtrInsertarEnCasillaModo`
  (la inserción real del Redactor) reimplementa línea por línea la misma comprobación
  "solo casilla vacía" en vez de llamar a esta función.
- `mtrSabadoFijarGrupoManual`: SIN caller de producción — hallazgo: es la ÚNICA función
  del subsistema «sábados» sin caller (sus hermanas `mtrSabadoRegistrarObservacion`/
  `mtrSabadoGrupoDeMedico` SÍ están en producción); es la válvula manual que
  `mtrSabadoGrupoDeMedico` ya sabe RESPETAR (`origen === "manual"`) pero nada en la
  interfaz llama para FIJARLO — no hay botón conectado.

Todos los 7 candidatos se confirmaron SIN caller real de producción mediante grep
exhaustivo del archivo completo (no solo del entorno de pruebas). Ninguno se borró.

## v17.6.77 — 26-ago-2026 (ítem 5: aviso visible de fármaco fuera de grupo — decisión del médico: "Sí")

**El hallazgo**: `mtrMedsSinGrupo` (v14.2.0) ya detecta cuántos medicamentos del paciente
no caen en NINGÚN grupo farmacológico que el motor reconoce, pero solo alimentaba
telemetría (`uxTrack("farmaco.cobertura", {total, sinGrupo})` — solo enteros, PHI-free
a propósito) y nunca llegaba a la vista del médico.

**El fix, en tres partes**:
1. `mtrMedsFueraDeGrupoNombres` — función NUEVA y SEPARADA (NO se toca
   `mtrMedsSinGrupo`, que sigue intacta, íntegra para telemetría PHI-free): misma
   lógica de detección exacta, pero devuelve los NOMBRES en vez de un conteo.
2. `mtrAvisoFueraDeGrupo` — construye un aviso con `mtrAlertaInteraccion` (mismo patrón
   que el resto del flujo), severidad INFO, conducta MONITORIZAR: nunca sugiere
   suspender/ajustar nada sobre un fármaco que, por definición, el motor no reconoce.
   Se suma a `todo` en `mtrAvisosFarmacologicos`, junto a `mtrRenderAvisosHtml`.
3. **Hallazgo cruzado, corregido en el camino**: al verificar la detección contra
   fixtures reales (omeprazol + clopidogrel), se descubrió que `mtrMedsSinGrupo` —y por
   tanto la nueva función— NUNCA miraba `mtrGruposCatalogoRcv` (el catálogo externo
   v17.6.4, un TERCER sistema de clasificación que llegó DESPUÉS de esta función y
   nunca se sumó). El omeprazol participa en la interacción CLOPIDOGREL_IBP solo por el
   catálogo, y contaba como "sin grupo" pese a que el motor SÍ lo evalúa — un falso
   positivo de cobertura real, no solo teórico. Se corrige en AMBAS funciones (la de
   telemetría también, porque es el mismo criterio completado, no uno nuevo).

**Cuidado con la semántica de `motivo`/`legible`**: el aviso de cobertura no depende de
la función renal (ni de `tfgCkdEpi` ni de `tfgCockcroftGault`), así que su sola
presencia en `todo` NO puede convertir un `motivo: "SIN_FUNCION_RENAL"` honesto en
`"OK"` — eso ocultaría que la dosis renal de verdad nunca se evaluó (regresión real
detectada por una prueba preexistente, v17.6.28). `motivo`/`legible` se calculan sobre
`combinado` (avisos renales + interacciones, SIN el aviso de cobertura); `todo` (lo que
de verdad se pinta) sí lo incluye — `mtrRenderAvisosHtml` solo mira `todo.length`, nunca
`motivo`, para decidir si hay algo que mostrar, así que no hay contradicción visible.

**Mutación verificada** (tres mutaciones independientes):
- Se quitó `avisoFueraDeGrupo` de `todo`: cayó EXACTAMENTE 1 prueba nueva ("ya no se
  pinta como 'todo limpio'... obtuvo 40" en vez de -1).
- Se revirtió el chequeo del catálogo en ambas funciones: cayeron EXACTAMENTE 3 pruebas
  (2 nuevas + la preexistente de `tests/suite_69_catalogo_rcv.js` que ya protegía la
  identidad `todo.length === avisos.length + interacciones.length`, "esperaba 3 y
  obtuvo 4" — la misma prueba que reveló el hallazgo cruzado en primer lugar).
- Se revirtió `n = combinado.length` a `n = todo.length`: cayó EXACTAMENTE la prueba
  preexistente de v17.6.28 ("esperaba SIN_FUNCION_RENAL y obtuvo OK").
En los tres casos se restauró desde el backup y el banco volvió a 2280 en verde. Se
añadieron 5 pruebas nuevas: en `tests/suite_41_motor_vista.js` (el aviso visible con
ACETAMINOFEN, y que omeprazol-por-catálogo NO se marca fuera de grupo; se cambió
también el fixture de una prueba preexistente de ACETAMINOFEN a LOSARTAN, porque el
escenario que protegía —"nada que reportar"— ya no lo cumple ACETAMINOFEN una vez que
SÍ genera el aviso de cobertura) y en `tests/suite_55_framingham_oficial.js`
(`mtrMedsSinGrupo` con el fix del catálogo, aislado de la vista).

## v17.6.76 — 26-ago-2026 (ítem 4: fusiones MTT → JSON, campo `order_list_mtt` — decisión del médico: "Sí")

El motor ya calcula, en `mtrConsolidarMtt` (invocado desde `mtrPlanFallas`, guardado en
`resumen.fallas.fusiones`/`.fechasDedicadas`), cuándo el recontrol de una falla
terapéutica GRAVE (LDL o HbA1c) se RETOMA en la misma visita que la FTL maestra
("fusión", cuando cae a ≤60 días de espera) o necesita una visita APARTE y prioritaria
("fecha dedicada", ya colapsada con otras cercanas ≤7 días entre sí) — pero esa
información nunca salía en el JSON v68 que lee la IA redactora, así que la nota clínica
nunca podía mencionar cuándo debía repetirse el LDL/HbA1c tras ajustar el tratamiento.

**El fix**: nuevo campo `order_list_mtt` en `mtrJsonV68DesdeResumen`, con dos listas:
- `fusiones`: `[{analito, fecha}]` — recontroles que se retoman en la FTL maestra.
- `fechas_dedicadas`: `[{analitos, fecha}]` — recontroles con visita propia (ya
  colapsados: `analitos` puede traer más de uno si `mtrConsolidarMtt` los fusionó por
  caer cerca entre sí).

Las fechas van RELATIVIZADAS (`mtrRelativizarFechaIso`), mismo criterio que
`ftl_date`/`control_date`: nunca crudas, son cuasi-identificadores que no deben viajar
al prompt de la IA. Sin `resumen.fallas` (o sin fallas graves con recontrol), ambas
listas salen vacías — nunca se inventa una fusión/fecha dedicada que el motor no
calculó (CERO INFERENCIA). Defensivo contra formas inesperadas (`fusiones`/
`fechasDedicadas` null o no-array): no lanza, cae a lista vacía.

**Mutación verificada**: se respaldó el archivo, se eliminó con `python3` el campo
`order_list_mtt` completo (dejando `mtrJsonV68DesdeResumen` exactamente como estaba
antes). `TZ=America/Bogota node tests/runner.js` puso rojas EXACTAMENTE las 3 pruebas
nuevas (2274 pasan / 3 fallan): la que confirma que el campo existe con datos reales
("obtuvo false"), la de fechas dedicadas colapsadas (`TypeError: Cannot read properties
of undefined`, al intentar leer `.fechas_dedicadas` de un campo que ya no existía), y la
de CERO INFERENCIA con `resumen.fallas` ausente. Ninguna otra prueba se vio afectada. Se
restauró desde el backup y el banco volvió a 2277 en verde. Se añadieron 3 pruebas
nuevas en `tests/suite_57_ia_redaccion.js`: el caso con fusión y fecha dedicada reales,
el caso de fechas dedicadas ya colapsadas con dos analitos, y el caso CERO INFERENCIA
(sin `fallas`, con `fallas` vacío, y con `fallas` de forma inesperada).

## v17.6.75 — 26-ago-2026 (ítem 3 / auditoría 25-ago 1.17: Estado R prioritario para RAC≥30 vencido — decisión del médico)

Decisión del médico: "usa el mismo piso/techo que el Estado A normal (Recomendado si no
tiene el spec a mano)" — enfoque conservador, sin inventar un spec nuevo.

**El hallazgo**: en `mtrEstadoAnalito`, el guard `estado !== "A"` bloqueaba la promoción
a Estado R (vigilancia estrecha por albuminuria) cuando el RAC≥30 YA estaba vencido — se
quedaba como Estado A normal, perdiendo la señal específica de albuminuria.

**El fix, en tres capas** (verificado que las tres son necesarias, no solo la primera):
1. Se quita el guard: RAC≥30 se promueve a R SIEMPRE, vencido o no. Se agrega
   `vencidoBase` (verdad de terreno de si YA estaba vencido antes de la promoción,
   independiente del label final).
2. **CRÍTICO** — sin tocar nada más, promover la etiqueta a "R" por sí solo habría sido
   PELIGROSO: `mtrPlanParaclinicos` calcula `masProximo`/`ftlCruda` a partir de los
   drivers en estado "D"/"R" con `.vence`, y el `.vence` de un RAC vencido es una fecha
   YA PASADA. Verificado con el motor real: sin la exclusión de `vencidoBase` en
   `hayEstadoA`/`conVencimiento`, `plan.ftl` salía en **2026-04-01** para un `hoyIso` de
   **2026-08-16** — una toma de laboratorios programada 4 MESES EN EL PASADO, violación
   directa de CERO VENCIDOS. Se excluye `vencidoBase` de `conVencimiento` (no compite
   como "próximo vencimiento futuro") y se incluye en `hayEstadoA` (sigue disparando el
   piso de 14/techo de 21 días, exactamente "el mismo piso/techo que el Estado A
   normal"). Mismo trato aplicado en `mtrAvisoVencimiento` y las dos copias de
   `vigilados` en `mtrFechaControlAjustada`/`mtrPlanLabsPrimero` (todas comparten el
   mismo riesgo de fecha pasada).
3. `plan.vencidos` ahora incluye también los R con `vencidoBase` — así el RAC sigue
   apareciendo en "Ya vencidos" (chips del banner, nombrado en `mtrFechaControlAjustada`)
   y en `plan.ordenar`, aunque su `estado` ya no sea literalmente "A". El texto de
   `mtrTableroClinico` (`quePasa`) y el `motivo` de `mtrEstadoAnalito` se corrigieron
   para decir "venció" (pasado), nunca "vence el [fecha ya pasada]" — un tiempo verbal
   que mentiría sobre algo que ya ocurrió.

**Mutación verificada** (tres mutaciones independientes, una por capa):
- Se restauró el guard `estado !== "A"`: cayeron EXACTAMENTE 2 pruebas (2272 pasan / 2
  fallan) — la promoción a R y el texto "venció" del tablero.
- Se revirtieron `hayEstadoA`/`conVencimiento` a no excluir `vencidoBase`: cayó
  EXACTAMENTE 1 prueba, la de seguridad de fecha ("CERO VENCIDOS... obtuvo false") — y
  se confirmó a mano que `plan.ftl` volvía a salir en el pasado (2026-04-01).
- Se revirtió `vencidos` a no incluir los R con `vencidoBase`: cayeron EXACTAMENTE 2
  pruebas — "el RAC sigue apareciendo en Ya vencidos" y "el RAC vencido está en la lista
  de qué ordenar".
En los tres casos se restauró desde el backup y el banco volvió a 2274 en verde. Se
añadieron 4 pruebas nuevas: 3 en `tests/suite_46_ftl_sabados.js` (promoción a R con
vencidoBase, RAC<30 sin cambios, y el escenario completo de `mtrPlanParaclinicos` con la
guarda anti-fecha-pasada) y 1 en `tests/suite_63_tablero_riesgo.js` (el texto "venció",
no "vence", en el tablero que ve el médico).

## v17.6.74 — 26-ago-2026 (Panel del paciente: dos dosis del mismo fármaco aparecían como dos medicamentos — reportado en consultorio, captura real sin PHI)

**El reporte**: en "MEDICAMENTOS DEL PROGRAMA CARDIOVASCULAR" del Panel del paciente
aparecían LOSARTAN 50mg, ROSUVASTATINA 40mg Y ROSUVASTATINA 20mg — tres renglones.
Instrucción explícita del médico: "cuando sea ese caso el script solamente debe tomar
los ÚLTIMOS que fueron prescritos. No poner dos medicamentos iguales pero con diferentes
dosis." Sin ningún dato de paciente (la captura solo traía la lista de fármacos).

**Dos causas raíz distintas, confirmadas leyendo el código real, arregladas por separado**:

1. `mtrMedicamentosDesdeRespuesta` aplanaba las formulaciones de Everest a texto SIN
   ordenarlas por fecha — `form.fechaCreacion` se descartaba por completo (su función
   hermana, `mtrRenglonesMedicamentoDesdeRespuesta`, sí la conserva). Sin fecha, el dedup
   "primero visto gana" de `mtrMedicamentosRcv` no tenía cómo saber cuál de dos
   formulaciones del mismo fármaco era la más reciente — sobrevivía la que trajera
   primero la respuesta de Everest, no la última prescrita.
2. `_mtrClaveDedupMedicamento` (la clave de dedup ya existente) CONSERVA la dosis A
   PROPÓSITO — decisión ya documentada desde v17.1.0 (#112/#113): "LOSARTAN 50 MG" y
   "LOSARTAN 100 MG" deben seguir siendo dos entradas distintas para que
   `mtrDuplicidadesTerapeuticas` pueda alertar cuando dos concentraciones del mismo
   principio conviven (comentario explícito ahí: "dos concentraciones distintas del
   mismo principio siguen alertando igual... revise si uno debía suspenderse al iniciar
   el otro"). `mtrMedicamentosRcv` (la lista del Panel) usaba esa MISMA clave, así que
   heredaba ese comportamiento — correcto para la alerta de duplicidad, incorrecto para
   la lista de "qué toma el paciente ahora".

**El fix, dos partes independientes**:
- **Parte A**: `mtrMedicamentosDesdeRespuesta` ahora ordena `datos` por `fechaCreacion`
  DESCENDENTE (más reciente primero) antes de aplanar. Formularios sin fecha (o con
  fecha ilegible) quedan al final, nunca se inventa una fecha; entre dos sin fecha (o dos
  con la misma fecha) el orden relativo original se conserva (`sort` estable de JS).
- **Parte B**: nueva función `_mtrClaveDedupMedicamentoSinDosis`, DISTINTA de
  `_mtrClaveDedupMedicamento` (que NO se tocó): corta el nombre en la primera cifra
  numérica y usa solo lo que queda antes, canonizado — "ROSUVASTATINA 40 MG (TABLETA)" y
  "ROSUVASTATINA 20 MG (TABLETA)" caen en la misma clave ("rosuvastatina"), pero un
  combo como "AMLODIPINO + LOSARTAN 5/50MG (TABLETA)" sigue distinto de "AMLODIPINO 10
  MG (TABLETA)" porque el "+" viene antes de cualquier dígito. Se usa SOLO en
  `mtrMedicamentosRcv` (la lista del Panel), verificada contra el vocabulario real del
  catálogo (`catalogo_farmacologico_rcv.json`) y los ejemplos de consola citados en el
  reporte (INDAPAMIDA, GEMFIBROZIL, ENALAPRIL MALEATO, LINAGLIPTINA + METFORMINA,
  INSULINA GLARGINA...). La frecuencia (Map #114) se sigue buscando con la clave que
  CONSERVA la dosis (una frecuencia es propia de una concentración concreta, no se debe
  mezclar entre dosis distintas).

**Decisión documentada, no aplicada a ciegas**: `mtrMedicamentosUnicos` (la pestaña
"Medicamentos", y la que alimenta `mtrDuplicidadesTerapeuticas`) se dejó INTACTA a
propósito — cambiarla habría apagado la alerta real de "posible duplicidad terapéutica"
para el caso exacto que la comparte (dos concentraciones del mismo principio conviviendo
sin que se sepa si una debía suspenderse). El cambio se limitó a `mtrMedicamentosRcv`,
que es la única función que alimenta la lista reportada por el médico.

**Mutación verificada** (las dos partes por separado):
- Se revirtió el ordenamiento por fecha en `mtrMedicamentosDesdeRespuesta`: cayeron
  EXACTAMENTE las 3 pruebas que dependen de él (2267 pasan / 3 fallan) — las dos
  unitarias de orden y el escenario real completo. Se restauró y el banco volvió a 2270
  en verde.
- Se revirtió `mtrMedicamentosRcv` a la clave CON dosis: cayeron EXACTAMENTE las 3
  pruebas que dependen del dedup sin dosis (2267 pasan / 3 fallan) — las dos de
  `mtrMedicamentosRcv` en `tests/suite_64_pestanas_botones.js` y el escenario real
  completo en `tests/suite_39_motor_farmaco.js`. Se restauró y el banco volvió a 2270 en
  verde.

Se añadieron 8 pruebas nuevas en total: 3 en `tests/suite_39_motor_farmaco.js`
(ordenamiento por fecha, formularios sin fecha al final, y el escenario real completo de
punta a punta) y 5 en `tests/suite_64_pestanas_botones.js` (dedup sin dosis en
`mtrMedicamentosRcv`, combo vs. componentes sueltos, frecuencia por dosis exacta, la
clave `_mtrClaveDedupMedicamentoSinDosis` contra el vocabulario real, y una guarda
explícita de que `_mtrClaveDedupMedicamento` —con dosis— sigue intacta).

## v17.6.73 — 26-ago-2026 (redacción del banner "Labs primero" — reportado en consultorio: "ni él ni sus compañeros lo entienden bien")

**El reporte**: el médico pegó el texto real del banner cuando el piso de 14 días se
relaja por exámenes vencidos — mensaje confuso, jerga interna del motor, sin dato de
paciente.

**Causa raíz confirmada leyendo el código real**: dos problemas en el mismo texto.
1. `motivoPiso` (armado en `mtrPlanLabsPrimero`, dos ramas) empezaba con su propio verbo
   — "adelantada porque..." / "adelantada al vencimiento de...: el piso de 14 días la
   habría dejado vencer" — pensado para leerse como frase independiente.
2. `notaLP` (armado en `_pintarBannerSugerida`, dentro de `openAgendamientoModal`, que es
   donde el médico REALMENTE lo lee) EMBEBÍA ese `motivoPiso` dentro de otra frase que
   YA empezaba con "se adelanta... porque" — el resultado decía literalmente
   "porque... (adelantada porque...", duplicado, más "ventana de 14–21 días"/"piso"/"cupo
   hábil": jerga interna sin explicar.

**El fix**: `motivoPiso` pasa a ser SOLO la razón, sin verbo propio —
`"ya hay examen(es) vencido(s) y esperar 14 días no los recupera"` (caso 1) y
`"el examen " + nombre + " vence el " + fecha + " y esperar 14 días lo dejaría vencer"`
(caso 2) — y `notaLP` lo embebe UNA sola vez, sin jerga:
`"Se adelanta la toma al primer cupo disponible porque " + motivoPiso + ". El control
queda ~7 días después de la toma..."`. La rama SIN piso relajado (el `else` de `notaLP`)
no se tocó — el médico no la reportó como confusa.

**Mutación verificada**: se respaldó el archivo, se revirtieron con `python3` las tres
piezas (los dos `motivoPiso` y el `notaLP`) a la redacción vieja. `TZ=America/Bogota node
tests/runner.js` puso rojas EXACTAMENTE las 3 pruebas relacionadas con la redacción
(2259 pasan / 3 fallan): la prueba de texto-fuente nueva en
`tests/suite_15_interfaz_avanzada.js` (que confirma que `notaLP` no repite la frase
duplicada ni la jerga) y las dos aserciones de texto exacto reforzadas en
`tests/suite_24_motor_perfil.js` sobre `mtrPlanLabsPrimero` (los dos casos de
`motivoPiso`). Las pruebas viejas con regex sueltos (`/ya hay examen\(es\)
vencido\(s\)/`, `/Glicemia/`) siguieron en verde con la redacción vieja, confirmando que
sin la aserción exacta nueva esta regresión habría pasado desapercibida — motivo por el
que se AÑADIERON las aserciones de texto exacto en vez de solo confiar en las regex
preexistentes. Se restauró desde el backup y el banco volvió a 2262 pruebas en verde
(2261 + 1 prueba nueva de texto-fuente; las otras dos son fortalecimiento de pruebas ya
existentes, no pruebas nuevas).

## v17.6.72 — 26-ago-2026 (ítem 2 / auditoría 25-ago 1.15: grupo de lípidos, vigencia = la más corta — decisión del médico)

Colesterol Total, HDL, LDL y Triglicéridos salen de UNA sola muestra de sangre. Antes,
`mtrPlanParaclinicos` evaluaba la "cosecha" (si un examen vigente vale la pena adelantar
a la visita actual) de cada uno de los 4 de forma completamente independiente, contra SU
PROPIA vigencia individual — así que si, por ejemplo, el colesterol total estaba VENCIDO
pero el HDL (con una vigencia individual más larga, ver CORRECCIÓN 1 de esta misma
suite: ERC G4 da 120 días a total/LDL/triglicéridos pero 180 a HDL) todavía tenía margen
de sobra, el HDL quedaba DIFERIDO a un viaje futuro aparte — obligando al paciente a una
segunda punción solo para el HDL semanas o meses después.

Decisión del médico: "vigencia del grupo de lípidos = la más corta (Recomendado)" —
cuando CUALQUIERA de los 4 necesita repetirse pronto según su propia vigencia (faltante,
vencido, o cosechado por margen), los 4 se ordenan juntos en la misma visita.

**El fix**: en `mtrPlanParaclinicos`, justo después del bucle de cosecha existente, un
paso nuevo revisa si algún miembro de `MTR_GRUPO_LIPIDOS` (los 4 claves) ya está en
`faltantes`, `vencidos` o `cosechados` — y si es así, mueve TODOS los demás miembros del
grupo que sigan en `diferidos` hacia `cosechados` (de donde `ordenar` ya los recoge). Sin
ningún disparador dentro del grupo, nadie se mueve: el comportamiento previo (cada lípido
por su propia vigencia) se conserva intacto cuando nadie del grupo lo necesita todavía —
verificado con una prueba de "no falsos positivos" dedicada.

**Mutación verificada**: se respaldó el archivo, se eliminó con `python3` el bloque
completo del paso nuevo (dejando `mtrPlanParaclinicos` exactamente como estaba antes).
`TZ=America/Bogota node tests/runner.js` puso rojas EXACTAMENTE las 2 pruebas que
verifican el arrastre entre miembros del grupo (2259 pasan / 2 fallan: "el HDL se ordena
JUNTO..." y "el HDL, con vigencia de sobra por su cuenta, se arrastra igual", ambas con
"obtuvo false"); la prueba de "sin disparador, nadie se adelanta a la fuerza" siguió en
verde como corresponde (esa prueba protege la ausencia del efecto, no su presencia). Se
restauró desde el backup y el banco volvió a 2261 pruebas en verde. Se añadieron 3
pruebas nuevas en `tests/suite_46_ftl_sabados.js`: colesterol total vencido arrastra a
los otros 3, ningún disparador no adelanta nada (control negativo), y un lípido
COSECHADO (no vencido) también arrastra a los demás — las tres formas de "necesitar
repetirse pronto" (faltante/vencido/cosechado) quedan cubiertas.

## v17.6.71 — 26-ago-2026 (ítem 0-E: panel IA minimizado sobrevivía al cambio de paciente — reportado en consultorio)

**El reporte**: el médico minimizó el módulo de Redacción IA mientras atendía a un
paciente, cerró esa historia (navegó a "Citas del día"), y el módulo SIGUIÓ apareciendo
minimizado en pantalla — riesgo de contaminación cruzada con el paciente siguiente. Sin
ningún dato de paciente.

**Causa raíz confirmada leyendo el código real**: el mecanismo de minimizado
(`_vglMinimizados` Map, `vglMinimizarPanel`/`vglRestaurarPanel`/`vglMinDescartar`) ya
tenía, desde v17.0.2, un AVISO al restaurar un panel de otro paciente ("Ojo: otro
paciente") — pero nunca un descarte automático. Peor: el panel de Redacción IA
(`mtrAbrirPanelRedaccion`, `#vgl-ia-modal`) NUNCA anotaba `modal.dataset.vglDoc` (a
diferencia de `#vgl-panel-modal`, que sí lo hace desde la misma v17.0.2) — así que al
minimizarlo, `vglMinimizarPanel` (que lee `panel.dataset.vglDoc` como respaldo) lo
registraba con `docId: null`. Ni siquiera el aviso de "otro paciente" ya existente
llegaba a activarse para el módulo específico que reportó el médico: quedaba invisible
para CUALQUIER blindaje contra cruce de pacientes.

**El fix**: dos partes.
1. `mtrAbrirPanelRedaccion` ahora anota `modal.dataset.vglDoc = String(resumen._docId ||
   "")` al construir el panel — mismo patrón que `#vgl-panel-modal` — usando el campo
   que la propia función ya usa en otros 10+ puntos (`_pacienteSigueAbierto`,
   `_vglGuardarDeshacer`, etc.).
2. Nueva función `_vglMinDescartarDeOtroPaciente(docIdActual)`: DESCARTA (borra el nodo
   del DOM con `vglMinDescartar`, no solo oculta) cualquier panel minimizado cuyo
   `docId` propio sea distinto del paciente abierto ahora mismo — incluido `""` (ningún
   paciente abierto). Los paneles SIN docId propio (`reg.docId` falsy) nunca se tocan:
   solo se descarta lo que se sabe con certeza que es de OTRO paciente, nunca por duda.
   Se engancha en `createAccionesDockUI` (el mismo punto que ya resuelve QUIÉN está en
   pantalla, corre en cada tick), ANTES de sus retornos tempranos — así cubre los DOS
   casos reportados: cambiar de paciente Y cerrar la historia por completo (navegar a
   "Citas del día", donde `extractPacienteAbierto()` da `""`).

**Mutación verificada** (dos mutaciones independientes, una por cada mitad del fix):
- Se revirtió `modal.dataset.vglDoc = ...` en `mtrAbrirPanelRedaccion`: cayó
  EXACTAMENTE la prueba nueva de `tests/suite_59_burbujas_ux.js` que confirma que el
  docId queda anotado ("obtuvo undefined" donde se esperaba "12345678"). Ninguna otra
  prueba se vio afectada.
- Se convirtió `_vglMinDescartarDeOtroPaciente` en un no-op: cayeron EXACTAMENTE las 4
  pruebas que verifican que SÍ se descarta (3 unitarias en
  `tests/suite_65_minimizar_modulos.js` + 1 de integración end-to-end en
  `tests/suite_15_interfaz_avanzada.js` que pasa por el `createAccionesDockUI` real);
  las pruebas que verifican que NO se descarta (mismo paciente, sin docId propio)
  siguieron en verde, como corresponde — un no-op también cumple "no descartar".
En ambos casos se restauró desde el backup y el banco volvió a 2258 pruebas en verde
(2249 + 1 en suite_59 + 6 en suite_65 + 2 de integración en suite_15).

## v17.6.70 — 26-ago-2026 (ítem 0-D: sin vía para cancelar/reagendar una cita de control sin laboratorio — reportado en consultorio)

**El reporte**: el médico asignó solo cita de control (sin laboratorio); a última hora la
paciente pidió cambio de hora; el médico no pudo acceder al módulo de agendamiento del
script para modificarla/cancelarla — el dock solo lo dejaba entrar a "🧪 Agendar labs".
Tuvo que usar la web original de Everest. Sin ningún dato de paciente.

**Causa raíz confirmada leyendo el código real** (más profunda que la hipótesis inicial de
"radicado no guardado en algún camino" — el radicado SÍ se guarda, pero se BORRA
enseguida): el flujo de creación de cita (dentro de `openAgendamientoModal`, tras un
agendamiento exitoso) llama a `markCitaAgendadaHoy` DOS VECES para la MISMA cita:

1. Línea ~20759, directo, con el `extra` completo: `{citaId, pacienteId, eps, hora,
   nombre, …}` — todo lo que el endpoint `CancelarCita` necesita.
2. Línea ~20788, `vglNotificarCompletado("cita_control", { doc, fechaIso, hora })` —
   SIN `extra` — disparada inmediatamente después, en el mismo flujo síncrono, para
   invalidar cachés y repintar el dock.

`markCitaAgendadaHoy` (línea ~6563) hacía `p.citasDetalle[sDoc] = Object.assign({
fechaIso, ts }, extra || {})` — un REEMPLAZO wholesale, no una fusión. La segunda llamada
(sin `extra`) borraba TODO lo que la primera acababa de guardar, dejando solo
`{fechaIso, ts}`. Como `citaDetalleHoy` (línea ~16340) exige `d.citaId` para devolver
algo ("sin radicado no hay recordatorio que reabrir"), el resultado era que NINGUNA cita
creada por este flujo — control-solo O control+laboratorio, el bug es el mismo camino
para ambas — quedaba con recordatorio reabrible. Consecuencia en el dock (línea ~5390):
con `soloFaltaLab` (control hecho, falta el lab), el compañero "🖨 Recordatorio" (línea
~5507) nunca aparecía porque su condición exige `citaDetalleHoy(docId)`; con todo ya
agendado (línea ~5474), el botón principal se quedaba deshabilitado ("✅ Agendado") en vez
de convertirse en el recordatorio vivo. En ambos casos, la única salida quedaba fuera del
alcance del script — exactamente lo reportado.

**El fix**: `markCitaAgendadaHoy` ahora FUSIONA con lo que ya hubiera guardado para ese
documento (`Object.assign({}, p.citasDetalle[sDoc] || {}, { fechaIso, ts }, extra ||
{})`) en vez de reemplazar. Una llamada posterior sin `extra` solo actualiza fecha/ts,
nunca borra un citaId/pacienteId ya guardados; una llamada posterior CON `extra` sigue
pudiendo corregir/actualizar campos normalmente. Se verificó que la cancelación real
(`_anularCitaMarcasLocales`, línea ~16431) sigue usando `delete p.citasDetalle[sDoc]` —
borra el registro entero, así que la fusión no deja datos viejos colgados tras una
cancelación genuina.

**Mutación verificada**: se respaldó el archivo, se revirtió con `python3` la fusión a la
versión original (reemplazo wholesale). `TZ=America/Bogota node tests/runner.js` puso roja
EXACTAMENTE la prueba nueva que reproduce el flujo real completo (2248 pasan / 1 falla:
"tras la notificación posterior, el recordatorio SIGUE siendo reabrible — obtuvo false").
Ninguna otra prueba se vio afectada, incluida la prueba preexistente de
`tests/suite_09_ajustes.js` ("una marca vieja sin fechaIso no la borra", un caso distinto
—sin `fechaIso` en absoluto— que ni siquiera toca esta rama). Se restauró desde el backup
y el banco volvió a 2249 pruebas en verde. Se añadieron 3 pruebas nuevas a
`tests/suite_62_cierre_cita.js`: el escenario real completo (crear con extra, notificar
sin extra, confirmar que el detalle sobrevive), que una llamada posterior SÍ puede seguir
actualizando campos, y que `_anularCitaMarcasLocales` sigue limpiando el registro entero
al cancelar (para blindar contra un "fix" ingenuo que dejara datos viejos pegados).

## v17.6.69 — 26-ago-2026 (ítem 0-C: timeout de red nunca rotaba de modelo Gemini — reportado en consultorio)

**El reporte**: el médico vio "La IA no redactó (tiempo agotado). Le dejo los hechos para
copiar a mano." y notó que `gemini-3.7-flash` seguía apareciendo, sin rotar a
`gemini-3.5-flash-lite`/`gemini-3.1-flash-lite` como esperaba. Sin ningún dato de
paciente.

**Aclaración**: `gemini-3.7-flash` sigue correctamente en `MTR_GEMINI_MODELOS` — es
`MTR_MODELO_POTENTE` (el último de la lista, el más capaz), usado A PROPÓSITO como primer
intento de las dos notas largas (`enfermedad_actual`, `analisis_plan`, decisión del
médico del 20-ago). Eso no se tocó.

**Causa raíz confirmada leyendo el código real**: `mtrGeminiRedactar` (línea ~31417) SÍ
tiene rotación automática, pero solo dentro de `onload`, para respuestas HTTP con status
reconocido (`_mereceRotar`: 429 cuota, 503 sobrecarga, 400/404/500/502/504 no-disponible).
El handler `ontimeout` (línea ~31545, disparado por `GM_xmlhttpRequest` con
`timeout: 25000`) resolvía como fallo DE INMEDIATO — `resolve({ ok:false, texto:"",
motivo:"tiempo agotado" })` — sin rotar ni reintentar, a diferencia de `onload`. El
comentario de `MTR_MODELO_POTENTE` promete "si el potente falla, mtrGeminiRedactar ya
rota al siguiente: el respaldo queda intacto", pero esa promesa nunca se cumplió para un
timeout de red — exactamente el escenario reportado (el primer intento de una nota larga
usa siempre el modelo potente, el más grande/lento de la lista).

**El fix**: mismo patrón que `onload` — en `ontimeout`, si `intentos < maxIntentos - 1`,
rota (`intentos++; mtrRotarModelo()`) y reintenta (`intentar()`); solo resuelve como
fallo cuando ya se agotaron todos los modelos, con un motivo más preciso ("tiempo agotado
en todos los modelos").

**Mutación verificada**: se respaldó el archivo, se revirtió con `python3` el `ontimeout`
nuevo a la versión original (resuelve sin rotar). `TZ=America/Bogota node tests/runner.js`
puso rojas EXACTAMENTE las 2 pruebas nuevas (2244 pasan / 2 fallan): la que confirma que
un timeout en el primer modelo rota al segundo y logra responder `ok:true`
("obtuvo false"), y la que confirma que se agotan los 7 modelos antes de rendirse
("esperaba 7 y obtuvo 1" — sin el fix, el primer timeout ya resolvía el fallo). Ninguna
otra prueba se vio afectada. Se restauró desde el backup y el banco volvió a 2246 pruebas
en verde. Se añadieron 2 pruebas nuevas a `tests/suite_57_ia_redaccion.js` (mismo patrón
que las pruebas ya existentes de rotación por 429/503, usando el mock `gmxhr` del arnés
para disparar `ontimeout` sin depender de temporizadores reales).

**Nota de diseño no bloqueante**: cada intento sigue con `timeout: 25000` fijo, así que en
el peor caso (los 7 modelos truenan por timeout) el médico esperaría hasta ~175 s antes
del mensaje de fallo — más que el peor caso anterior (que cortaba en el primer timeout).
Se deja así a propósito: es el mismo comportamiento ya aceptado para la rotación por
429/503/400, y no hay evidencia de campo que pida acortar el timeout de los reintentos —
no se inventa ese ajuste sin un reporte que lo respalde.

## v17.6.68 — 26-ago-2026 (ítem 0-B: bloque "Uroanálisis" mezclaba QUIMICA URINARIA — informe de laboratorio real y captura de pantalla reales, aportados en consultorio)

**El caso**: informe de laboratorio real con fecha 21-ago-2026, sección "QUIMICA
URINARIA" (tres exámenes: creatinina en orina espontánea, microalbuminuria, relación
microalbuminuria/creatinina — el estudio CUANTITATIVO de la RAC). Ningún
uroanálisis/parcial de orina fue ordenado ni resultado ese día. La captura del panel del
médico, sin embargo, mostraba en "Historial de Paraclínicos" una fila fechada ese mismo
día, etiquetada "Uroanálisis", con hallazgos de sedimento urinario (Hematíes, Hematíes No
Lisados, Células del Túbulo Renal) que corresponden a OTRO examen de OTRA fecha — un
uroanálisis real más viejo. Sin ningún dato identificable del paciente, EPS ni médico
tratante.

**Causa raíz confirmada leyendo el código real**: `_esAnalitoDeOrina(lab)` (línea ~1354)
decide qué filas "pertenecen a orina" con el regex `/ORINA|URINAR|UROAN/` sobre
`NombreParametroPadre`. Ese patrón, pensado para sinónimos REALES del parcial
("SEDIMENTO URINARIO", "CITOQUIMICO URINARIO"), TAMBIÉN matchea "QUIMICA URINARIA" — un
panel completamente distinto. `_agruparUroanalisisParaTabla` (línea ~1407, arma la fila
"Uroanálisis" del Historial de Paraclínicos) usa SOLO `_esAnalitoDeOrina` como filtro, sin
un segundo filtro por componente — así que mete en el MISMO bloque sintético componentes
reales de un uroanálisis viejo Y los 3 exámenes de Química Urinaria del día de la
consulta. Como el "representante" del grupo se elige por la fecha MÁS RECIENTE entre TODO
lo que cae en el filtro, el bloque terminaba fechado el día de la Química Urinaria (la
actividad "de orina" más reciente) pero con el TEXTO de otro examen real más viejo —
fecha de hoy, contenido de otro día, etiqueta que dice "Uroanálisis" cuando ese examen no
se hizo.

Se confirmó que los DEMÁS llamadores de `_esAnalitoDeOrina`
(`injectLabsIntoCronicos`/`inyectarComponenteOrina`, `mtrHallazgosUroDesdeLabs`) ya
estaban protegidos: exigen ADEMÁS `_matchUroComponente(lab)` contra los 7 nombres reales
de componentes del parcial (NITRITOS/GLUCOSURIA/PROTEINURIA/CILINDROS/SANGRE/
HEMATIES/LEUCOCITOS), y ninguno de los 3 analitos de Química Urinaria matchea esos
nombres — por eso ese camino (las casillas de la Ruta de Crónicos) nunca se contaminó.
También se verificó el guard `deOrina` en `_matchLabInWhitelist` (línea ~2592): el fix no
lo rompe porque el whitelist de CREATININA ya excluye por separado cualquier nombre que
contenga "ORINA", y ninguna otra entrada del whitelist matchea por nombre a
"MICROALBUMINURIA"/"CREATININA EN ORINA ESPONTANEA"/"RELACION MICROALBUMINURIA
CREATININA" antes de llegar a RAC.

**El fix**: en `_esAnalitoDeOrina`, se agregó una exclusión explícita ANTES del patrón
amplio — `if (/QUIMICA URINARIA/.test(padre)) return false;` — específica de "QUIMICA
URINARIA" (no de "URINAR" en general), para que "SEDIMENTO URINARIO"/"CITOQUIMICO
URINARIO" (sinónimos reales del parcial) sigan reconociéndose sin cambios.

**Mutación verificada**: se respaldó el archivo, se removió con `python3` el bloque
completo de la exclusión (dejando `_esAnalitoDeOrina` exactamente como estaba antes del
fix). `TZ=America/Bogota node tests/runner.js` puso rojas EXACTAMENTE las 2 pruebas
nuevas (2242 pasan / 2 fallan): la prueba directa de `_esAnalitoDeOrina` con los 3
nombres reales de Química Urinaria ("obtuvo true" donde se esperaba `false`), y la
prueba de integración de `_agruparUroanalisisParaTabla` que reproduce el caso completo
(esperaba 4 filas —1 bloque real + 3 independientes de Química Urinaria— y obtuvo 1,
confirmando que sin el fix las 3 filas de Química Urinaria se fundían en el bloque
"Uroanálisis" junto con los componentes reales). Ninguna otra prueba se vio afectada. Se
restauró desde el backup y el banco volvió a 2244 pruebas en verde. Se añadieron 2
pruebas nuevas: una en `tests/suite_08_labs_cronicos.js` (`_esAnalitoDeOrina` directo,
incluye una comprobación de que los sinónimos reales del parcial —SEDIMENTO
URINARIO/CITOQUIMICO URINARIO— siguen reconociéndose) y una en
`tests/suite_15_interfaz_avanzada.js` (`_agruparUroanalisisParaTabla`, el escenario
completo con fechas y contenidos reales del caso reportado).

## v17.6.67 — 26-ago-2026 (ítem 0: uroanálisis "fantasma" — reportado en consultorio EN VIVO, con consola completa pegada por el médico)

**El reporte**: "el auto-labs Athenea no me reconoció el uroanálisis nuevo realizado por
la paciente, solamente me reconoció uno viejo de enero" (sin ningún dato identificable
del paciente).

**Causa raíz confirmada leyendo el código real** (no la auditoría vieja):
`_nuevoReemplazaCandidato(previo, nuevo)` (línea ~2851) decide, para cada analito de
`WHITELIST_13_LABS`, cuál candidato "gana" cuando hay varias filas. Para UROANALISIS,
cuando Athenea no manda una fila con el nombre literal del panel (lo normal — manda
20-30 filas, una por componente: Color, Nitritos, Sangre, Leucocitos...),
`_ultimaFechaPorAnalito` arma un candidato de "respaldo" por cada componente que
matchea (`viaComponente: true`). Cada componente de CADA solicitud de orina, de TODAS
las fechas, compite por el mismo slot `candidatos.get("UROANALISIS")`.

La regla de desempate tenía 3 pasos: (1) fila real gana a respaldo, sin importar
fecha — correcto, no es el problema; (2) un resultado NUMÉRICO gana a uno que no lo es,
SIN IMPORTAR LA FECHA; (3) solo si ambos son igual de "numéricos", gana la fecha más
reciente. El bug: cuando AMBOS candidatos son `viaComponente` (el caso normal de
uroanálisis), el paso 1 no distingue nada y cae al paso 2 — pero `_labNumerico` (línea
~3549) trata como "no numérico" cualquier texto con letras no-unidad ("NEGATIVO", la
respuesta típica de Nitritos/Sangre) Y cualquier rango con guion tipo "0-2" (el regex
`/-\s*\d/` lo confunde con un negativo). Un conteo limpio sin guion como "5" SÍ pasa
como numérico. Resultado: si el uroanálisis VIEJO (enero) tenía un componente numérico
limpio y el NUEVO (agosto) tenía su componente coincidente como "NEGATIVO" o un rango
"0-2" (ambos no-numéricos), la regla 2 mantenía el candidato de ENERO ganando PARA
SIEMPRE — la fecha (regla 3) nunca llegaba a evaluarse. Exactamente el síntoma
reportado.

**El fix**: se agregó un paso 1.5 en `_nuevoReemplazaCandidato`, entre las reglas 1 y 2 —
cuando AMBOS candidatos son `viaComponente`, "numérico" deja de ser señal de validez (son
fragmentos cualitativos de paneles posiblemente distintos, y que uno traiga o no un
número es casi arbitrario); la única señal confiable entre dos respaldos es la fecha, y
se usa directamente sin pasar por `_labNumerico`. Las reglas 1 (fila real > respaldo) y 2
(numérico > no-numérico, cuando NINGUNO es `viaComponente` — el caso de analitos séricos
como RAC/LDL) quedan intactas.

**Mutación verificada**: se respaldó el archivo (`cp` a `/tmp/x2.js`), se removió con
`python3` el bloque completo del paso 1.5 (dejando la función exactamente como estaba
antes del fix), y se corrió `TZ=America/Bogota node tests/runner.js`. Cayeron
EXACTAMENTE las 3 pruebas nuevas relacionadas (2239 pasan / 3 fallan): las dos pruebas
directas de `_nuevoReemplazaCandidato` con el escenario enero-numérico/agosto-cualitativo
y con el rango "0-2", y la prueba de integración end-to-end de
`_ultimaFechaPorAnalito` que reproduce el bug reportado (agosto vs. enero, en ambos
órdenes de llegada) — sin afectar ninguna otra prueba, incluidas las dos nuevas que
confirman que las reglas 1 y 2 originales NO se rompieron. Se restauró desde el backup y
el banco volvió a 2242 pruebas en verde. Se añadieron 6 pruebas nuevas en total a
`tests/suite_08_labs_cronicos.js` (también se agregó `_nuevoReemplazaCandidato` a la
lista `cubre` de esa suite — antes no tenía ni una sola prueba propia, pese a ser lógica
de desempate central para los 13 analitos de la Ruta de Crónicos).

## v17.6.66 — 26-ago-2026 (auditoría 25-ago, ítem 1: marcador [DOSIS NO ESPECIFICADA] — decisión confirmada por el médico: "Sí, construirlo")

Cuando un medicamento del programa cardiovascular no tiene frecuencia/dosis en el
histórico de Everest (`mtrMapaFrecuenciasPorNombre`, alimentado por
`mtrLeerFrecuenciasMedicamento`), ahora se marca visiblemente con
`[DOSIS NO ESPECIFICADA]` en vez de aparecer indistinguible de un medicamento cuya
frecuencia simplemente no se mostró. CERO INFERENCIA: no se inventa una dosis, solo se
hace visible que falta.

Dos puntos de salida tocados:
1. `mtrMedicamentosRcv(lista, frecuencias)` — ahora agrega `sinFrecuenciaEspecificada`
   (booleano) a cada renglón devuelto, y `.texto` incluye `" [DOSIS NO ESPECIFICADA]"`
   cuando aplica. Esto alimenta directamente la Ficha viva (línea ~17577,
   `medsRcv.slice(0,14).map(m => m.texto)`), que es donde el médico ve la lista en vivo.
2. `mtrJsonV68DesdeResumen` — `medicamentos_actuales` ahora pasa
   `r.medicamentosFrecuencia` a `mtrMedicamentosRcv` (antes se llamaba sin ese argumento,
   perdiendo el dato) y agrega el mismo sufijo al nombre exportado, para que la IA que
   redacta la nota clínica no trate un medicamento sin frecuencia como si tuviera una
   omitida a propósito.

Detalle de diseño clave (para no generar ruido falso): el marcador solo aparece cuando
`frecuencias` SÍ se pasó (aunque el Map resultante esté vacío) y no hubo coincidencia
para ese fármaco puntual. Si `frecuencias` no se pasó en absoluto (p. ej. el reconciliador
de fuentes en la línea ~18358, que solo necesita nombres), no se marca nada — "no se
preguntó" no es lo mismo que "se preguntó y no hay dato".

**Mutación verificada**: se respaldó el archivo (`cp vigilante_agenda.user.js /tmp/x.js`),
se revirtieron con `python3` las dos líneas que arman el marcador —
`texto: nombre + (frecuenciaTexto ? " (" + frecuenciaTexto + ")" : "") + " — " + c.para`
(sin la rama `[DOSIS NO ESPECIFICADA]`) y `medicamentos_actuales: ...map((m) => m.nombre)`
(sin pasar `r.medicamentosFrecuencia` ni el sufijo) — dejando el resto del motor intacto.
Con esa mutación, `TZ=America/Bogota node tests/runner.js` puso roja EXACTAMENTE la
prueba nueva `"mtrJsonV68DesdeResumen: medicamentos_actuales marca [DOSIS NO
ESPECIFICADA]..."` (2235 pasan / 1 falla: "LOSARTAN sin frecuencia en el histórico: se
marca visiblemente, CERO INFERENCIA (obtuvo false)"), sin afectar ninguna otra prueba. Se
restauró desde el backup y el banco volvió a 2236 pruebas en verde (se añadieron 2 pruebas
nuevas en `tests/suite_57_ia_redaccion.js`: una confirma el marcador cuando el histórico
no trae frecuencia para un fármaco puntual, la otra confirma que SIN pasar
`medicamentosFrecuencia` en absoluto no se marca nada, evitando ruido cuando ni se
intentó leer el dato).

## v17.6.65 — 26-ago-2026 (auditoría 25-ago, sección 4: síndrome metabólico — decisión confirmada por el médico)

Nueva función pura `mtrSindromeMetabolico(f)`: evalúa los 5 criterios estándar IDF
(ajustados a Latinoamérica) — cintura >90cm hombre / >80cm mujer, triglicéridos ≥150,
HDL <40 hombre / <50 mujer, PA ≥130/85 o ya en tratamiento antihipertensivo, glicemia en
ayunas ≥100 o diabetes ya diagnosticada — y cuenta cuántos se cumplen. `enAntihipertensivos`
y `diabetes` son los mismos flags booleanos ya usados en la clasificación de riesgo ASCVD,
reutilizados como atajo (sin cifra cruda necesaria si ya hay tratamiento/diagnóstico). La
cintura se lee de la casilla real de Everest `cinturaPelvica` (confirmada contra
`grounding/mapas/MAPA_EVEREST_*.json`) vía el nuevo wrapper `mtrLeerCinturaDelDom(doc)`.

CERO INFERENCIA en el resultado: `cumple` es un tri-estado `true | false | null`, nunca
un booleano que fuerce una respuesta. `evaluables` cuenta cuántos de los 5 criterios
tenían dato; `faltan = 5 - evaluables`. `cumple` es `true` si `count >= 3`; es `false`
solo si NI SIQUIERA el mejor caso posible (`count + faltan`) puede llegar a 3 — es decir,
que aunque los datos faltantes resultaran todos positivos, seguiría sin cumplir; en
cualquier otro caso (el mejor caso SÍ podría llegar a 3, pero no hay dato suficiente para
confirmarlo) queda `null`, nunca se asume "no cumple" solo porque falte información.

**Mutación verificada**: la primera versión de la fórmula tenía un bug de límite —
`cumple = (count>=3) ? true : (faltan===0 ? false : null)` — que devolvía `null` en vez
de `false` cuando, aunque faltaran datos, el mejor caso posible ya no alcanzaba a 3 (p.
ej. cintura y HDL negativos, 3 criterios sin dato, pero el mejor caso 0+3 SÍ podría llegar
a 3 en ese ejemplo — el caso de prueba real usa 4 evaluados/0 cumplidos + 1 sin dato, mejor
caso 0+1=1). Al aplicar esa mutación al código real (revirtiendo a la fórmula rota vía
`cp`/`python3`), la prueba nueva
`"mtrSindromeMetabolico: aunque falten datos, si ni el mejor caso llega a 3, cumple=false
(no null)"` (suite 45) se puso roja (2233 pasan / 1 falla), confirmando que SÍ prueba el
límite. Se restauró la fórmula correcta
`cumple = (count>=3) ? true : ((count+faltan)<3 ? false : null)` y el banco volvió a verde
(2234 pasan). Se añadieron 6 pruebas nuevas para `mtrSindromeMetabolico` en total (umbral
3-de-5, cortes por sexo, atajos de tratamiento/diagnóstico, el caso `null` no-concluyente,
el caso sin ningún dato, y este límite de `false` con datos incompletos).

## v17.6.64 — 26-ago-2026 (auditoría 25-ago, sección 4: cNoHDL cableado — decisión confirmada por el médico)

`mtrCnoHDL(ct, hdl)` (colesterol no-HDL = CT − HDL) ya existía, pura y probada, pero SIN
NINGÚN llamador — pese a que el prompt de "Análisis y plan" (línea ~30783) le pide
literalmente a la IA "menciona cNoHDL junto al LDL indicando si está en meta". El modelo
tenía que inventarlo o calcularlo él mismo — justo lo que la cabecera del spec prohíbe
(delegarle a un LLM un cálculo determinista). Se cablea en 3 puntos:
`mtrHojaDeHechos`/`mtrHojaDeHechosTexto` (lo que ve la IA y lo que el recuadro muestra si
falla) y `mtrJsonV68DesdeResumen` (`cno_hdl`/`cno_hdl_target`) — junto con su meta
(`MTR_METAS_LIPIDICAS.cnoHdl`, ya existía) para que el modelo solo tenga que citar el
número, nunca calcularlo.

- **Mutación**: se forzaron `cNoHDL`/`metaCnoHdl` a `null` fijo en `mtrHojaDeHechos`. 1
  roja: *"cNoHDL se calcula de CT y HDL..."*. Restaurado, banco vuelve a 2228 en verde.
- **Pruebas nuevas**: `tests/suite_56_hoja_hechos.js` — 2 casos (cálculo real con meta, y
  null sin inventar cuando falta CT/HDL); `tests/suite_57_ia_redaccion.js` — 2 aserciones
  nuevas en el test existente del JSON v68.

## v17.6.63 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.10: construida la segunda capa de blindaje de Enfermedad Actual — decisión confirmada por el médico)

`mtrHechosSinExamenFisico`/`mtrQuitarExamenFisicoIA` (los nombres que citaba la auditoría)
NO existen en este código — es funcionalidad nueva, no un arreglo de código existente. El
médico confirmó construirla (entrevista de esta sesión). MTR_EA_SYS ya prohíbe en el PROMPT
que la Enfermedad Actual traiga TFG/riesgo cardiovascular/meta LDL/laboratorios/signos
vitales (esos van en Análisis y Plan) — pero un prompt es una instrucción, no una garantía.
Se construye `mtrQuitarDatosProhibidosEA`: quita del borrador cualquier línea que empiece
EXACTAMENTE con uno de los 5 prefijos que `mtrHojaDeHechosTexto` usa para esos datos
("Signos vitales:", "Laboratorios y paraclínicos:", "Función renal:", "Riesgo
cardiovascular:", "Meta LDL:") — nunca por contener la palabra en cualquier parte de la
prosa. Se cablea en el conector, junto al saneador de `analisis_plan` que ya existía, solo
para el modo `enfermedad_actual`.

- **Mutación**: se redujo la lista a solo 2 de los 5 prefijos (los que la auditoría decía
  que YA estaban cubiertos en la versión perdida). 1 roja: *"quita las 5 líneas
  prohibidas..."*. Restaurado, banco vuelve a 2226 en verde.
- **Pruebas nuevas**: `tests/suite_57_ia_redaccion.js` — 3 casos (las 5 líneas se quitan
  conservando el resto; una mención de la palabra dentro de la prosa NO se filtra —solo el
  prefijo exacto de línea—; texto vacío/null no lanza).

## v17.6.62 — 26-ago-2026 (auditoría 25-ago, sección 7: "Probar conexión" no usaba el mismo respaldo de id anónimo)

El botón "Probar y diagnosticar" (`#c-repgo`, en Ajustes) mandaba
`equipo: (S.equipo||"").slice(0,40)` en vez de `_equipoId()` — el mismo respaldo que
`reportar()` SIEMPRE usa (genera y persiste un id anónimo tipo `eq-xxxxxx` cuando el médico
nunca puso un nombre a mano). Sin nombre manual, el botón mandaba `equipo:""` y esa fila de
prueba caía en el balde "sin equipo" del tablero — un equipo distinto del que los reportes
reales de ese mismo consultorio usan. Fix de una línea: `equipo: _equipoId()`.

- **Mutación**: se revirtió a `(S.equipo||"").slice(0,40)`. 1 roja: *"c-repgo (Probar
  conexión): manda el mismo _equipoId()..."* (equipo enviado vacío). Restaurado, banco
  vuelve a 2223 en verde.
- **Prueba nueva**: `tests/suite_15_interfaz_avanzada.js` — 1 caso, instancia propia con
  `gmxhr` mockeado para capturar el payload real enviado al hacer clic en el botón.

## v17.6.61 — 26-ago-2026 (auditoría 25-ago, sección 6: `GHOST.subscribe` — código muerto confirmado)

`listeners`/`subscribe`/`notify` en `GHOST` formaban un pub-sub que nadie suscribía en todo
el archivo (`GHOST.subscribe(`: 0 llamadores, confirmado con grep). `notify()` corría en
CADA `set` del Proxy `state` — miles de veces por sesión — iterando un `Set` eternamente
vacío: un no-op perpetuo en un camino caliente. Se retiran los tres (y su única llamada,
dentro del `set` trap del Proxy `state`).

- **No es un cambio de comportamiento**: por construcción, `notify()` nunca pudo tener
  efecto observable (su único consumidor posible, `subscribe`, nunca se llamó en ningún
  punto del archivo) — no aplica el ciclo de mutación roja/verde de siempre, porque no hay
  ninguna prueba cuyo resultado pudiera depender de este código. Se verificó en su lugar que
  `node tests/runner.js` sigue en verde (2222) tras el retiro, y que no queda ninguna
  referencia colgante (`grep GHOST.subscribe/listeners/notify` → 0 resultados fuera del
  comentario que documenta el retiro).
- **No tocado**: `mtrChipResumenTexto` (también listado como "muerto confirmado" en la
  auditoría) NO se retiró — su propio comentario dice "si esto desaparece, la alerta
  clínica desapareció", lo que sugiere que podría ser una función que un refactor anterior
  desconectó por accidente (una regresión real), no código genuinamente muerto. Retirarla
  sin que el médico confirme cuál de las dos cosas es cerraría la puerta a recuperar una
  alerta clínica si de verdad se perdió. Queda señalada, no tocada.

## TABLERO/Codigo.gs — 26-ago-2026 (auditoría 25-ago, hallazgo 1.23: el resumen de telemetría podía mostrar la versión/fecha equivocada)

`armarResumen()` (TABLERO/Codigo.gs:260, Google Apps Script — NO forma parte del userscript
ni de `tests/runner.js`) sobrescribía `f.ultimo`/`f.ver` SIN comparar contra el valor ya
guardado: el bucle procesa las hojas en orden fijo (`resumen`, `fraude`, `uso`, `error`,
`entorno`, `prueba` al final), y el resultado dependía de qué hoja se procesó de ÚLTIMA, no
de la fecha real más reciente. Un equipo que probó la conexión una vez hace semanas (hoja
`prueba`, la última del arreglo) y desde entonces manda telemetría normal en una versión
nueva podía aparecer 🔴 ATRASADO de forma falsa, con la versión vieja de esa prueba pisando
la real. Fix: `f.ultimo`/`f.ver` solo se actualizan cuando la fecha de la fila actual es de
verdad más reciente que la ya guardada.

- **Sin banco de pruebas para este archivo**: `TABLERO/Codigo.gs` no tiene ninguna suite en
  `tests/` (es Google Apps Script, acoplado a `SpreadsheetApp`, y no lo carga
  `tests/runner.js`). No se pudo aplicar la disciplina de mutación verificada dentro del
  banco. Se verificó el ALGORITMO por separado, con un script de Node desechable que
  reproduce la lógica pura (sin `SpreadsheetApp`): con dos filas (`resumen` reciente en
  v17.6.56, `prueba` vieja en v14.2.0, procesada al final) — la versión original (sin
  comparar) da como resultado `14.2.0` (el bug reproducido); con el fix, da `17.6.56`
  (correcto). Esto NO sustituye una prueba real en un banco; queda anotado como deuda si
  algún día se arma un harness para `Codigo.gs`.
- **1.15 y 1.17** (grupo lipídico, Estado R prioritario) y **1.10/1.13/1.18** (blindaje de
  Enfermedad Actual, meta LDL individual, fila de divergencias del spec) siguen pendientes
  — ver las entradas de esta misma sesión para el porqué de cada uno.

## v17.6.60 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.22: la caja de "datos críticos" podía quedar ilegible por el CSS de Everest)

`_pintarCriticos` (dentro de `#vgl-ia-modal` — la caja roja que bloquea generar la nota sin
categoría de riesgo/TFG/medicamentos) pinta con `<div style="...">` SIN clase propia. El
blindaje tipográfico `:where(...:not([class])){color:inherit}` (especificidad CERO,
CLAUDE.md) solo cubría `span/b/small/label/p` para `#vgl-ia-modal`, no `div` — exactamente
el patrón de bug #2 que el CLAUDE.md ya documenta, en un elemento que el censo previo (v17.6.4,
v14.0.0) no cubrió. Fix: se añade `div:not([class])` a la lista de `#vgl-ia-modal`, siguiendo
al pie de la letra la "regla práctica" del CLAUDE.md — nunca `#vgl-ia-modal div{color:inherit}`
a pelo (eso reintroduciría el bug #1, especificidad tipo).

- **Alcance**: se tocó SOLO `#vgl-ia-modal` (donde se confirmó el `<div>` sin clase), no los
  otros 11 modales que comparten la misma lista — no se verificó que ellos tengan el mismo
  problema, y `:where()` de especificidad cero no arriesga nada al no tocarlos.
- **Nota de verificación**: no se corrió la verificación en Chromium contra un CSS "Everest"
  simulado que el CLAUDE.md recomienda (sin navegador disponible en esta sesión) — el patrón
  añadido es idéntico, carácter por carácter, al que ya usan las otras 11 líneas de este
  mismo bloque (`:where(...:not([class])){color:inherit}`), ya validado y en producción.
- **Mutación**: se quitó `div:not([class])` de la línea de `#vgl-ia-modal`. 1 roja: *"Regla
  I - #vgl-ia-modal blinda también los `<div>` sin clase propia"*. Restaurado, banco vuelve
  a 2222 en verde.
- **Prueba nueva**: `tests/suite_25_cascada_css.js` — Regla I, verifica por texto que la
  línea de blindaje de `#vgl-ia-modal` incluye `div:not([class])`.

## v17.6.59 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.21: el dead-man switch no protegía la inserción de notas de IA)

`vglEscrituraPermitida` (línea ~24531) tenía un ÚNICO llamador en todo el archivo
(`vglLlenarFactoresEnEverest`, el llenado de antecedentes). El propio mensaje del dead-man
promete "dejo de escribir en la historia clínica (llenar antecedentes **e insertar
notas**)" — pero ningún punto de inserción de notas de texto libre generadas por IA
consultaba el dead-man: con la escritura cortada (40+ días sin contacto con el servidor de
control), el redactor seguía insertando notas en la historia como si nada. Fix: se añade el
guardado a `mtrInsertarEnCasillaModo` (la inserción real del redactor, vía
`MTR_CASILLAS_REDACTOR`), con un motivo explícito (`"deadman"`) distinto de los demás
motivos de fallo de esa función.

- **Mutación**: se quitó el guardado nuevo. El banco pasó de 2221 en verde a 1 roja: *"con
  el dead-man switch cortando la escritura, no inserta nada y lo dice"* (insertaba igual).
  Restaurado, banco vuelve a 2221 en verde.
- **Prueba nueva**: `tests/suite_57_ia_redaccion.js` — 1 caso, mismo patrón de sellado que
  ya usa `suite_68_v17_cola.js` para el llenado de antecedentes (`_vglDeadmanSellar` con un
  sello de 40 días).

## v17.6.58 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.20: Auto-Labs presentaba un fallo de lectura como hecho clínico)

El botón "🧬 Auto-Labs (Athenea)" (rama final del `onclick`, vigilante_agenda.user.js:~5220)
alcanzaba el mismo mensaje "Athenea no tiene laboratorios registrados" tanto con
`labs===[]` (Athenea SÍ respondió: el paciente de verdad no tiene resultados) como con
`labs===null` (`getAtheneaLabsAuto` NO PUDO leer — timeout, 500, red — contrato v16.2.8). Un
fallo de lectura se presentaba como un hecho clínico verificado. Fix: rama nueva para
`labs === null` con un mensaje honesto ("no se pudo leer... no es que no tenga
laboratorios"), antes de la rama que ahora SOLO cubre el `[]` real.

- **Test existente corregido**: `"createLabInjectorUI: sin solicitud resoluble..."`
  (suite_15) ya ejercitaba exactamente `labs===null` (verificado con el harness — su
  comentario decía "acaba en []", que era incorrecto) pero su aserción era una OR de tres
  mensajes posibles, así que toleraba el bug sin detectarlo. Se corrigió el comentario y se
  volvió una aserción exacta.
- **Mutación**: se forzó la nueva rama a `else if (false)` (inalcanzable). El banco pasó de
  2220 en verde a 1 roja: el test corregido esperaba "No se pudo leer Athenea" y el botón
  volvía a mostrar el mensaje genérico de "sin laboratorios". Restaurado, banco vuelve a
  2220 en verde.

## v17.6.57 — 26-ago-2026 (auditoría 25-ago, hallazgos 1.16 y 1.19)

**1.16 — un resultado real sin fecha perdía su valor.** `mtrEstadoAnalito` (línea ~30008)
devolvía `valor: null` siempre que faltaba la fecha, aunque `ultimo.valor` sí trajera un
resultado real (alcanzable: `_extractAtheneaFecha` puede devolver `null`). Se ordenaba un
examen que YA TIENE resultado, sin forma de saberlo desde este objeto. Fix: se conserva el
valor real; el motivo distingue "hay un resultado pero sin fecha" de "no hay ningún
resultado registrado".

**1.19 — MTT-CONSOLIDA podía adelantar un LDL a 2-3 semanas de cambiar la estatina.**
`mtrConsolidarMtt` comparaba con `Math.abs()` (bidireccional): un recontrol que cae
DESPUÉS de la FTL se fusionaba igual que uno que cae ANTES. Con la FTL antes del recontrol
(caso corriente: FTL a 14-21 d, recontrol de LDL a 42 d tras cambiar la estatina), la
diferencia entraba en el `<=60` de fusión y el LDL se adelantaba a una toma de 2-3 semanas
— por debajo del piso de 4 semanas que hace interpretable la respuesta a un cambio de
estatina. Fix: la fusión solo aplica cuando es un RETRASO del recontrol (la FTL cae en o
después de su fecha natural) — nunca cuando lo adelantaría.

- **Mutación 1.16**: se revirtió a `valor: null` fijo. 1 roja: *"un analito CON valor pero
  SIN fecha no pierde el valor"*. Restaurado, banco vuelve a verde.
- **Mutación 1.19**: se revirtió a `Math.abs()` bidireccional. 1 roja: *"una falla grave
  cuyo recontrol cae DESPUÉS de la FTL nunca se ADELANTA fusionándola"* (con el caso real
  de la auditoría, volvía a fusionar en vez de quedar como fecha dedicada). Restaurado,
  banco vuelve a verde (2220).
- **Test existente actualizado**: `"una falla grave cuyo recontrol cae cerca de la FTL se
  FUSIONA"` (suite_49) ejercitaba exactamente el escenario "adelantar" que el bug describe
  (FTL 15 días ANTES del recontrol) — se cambió a un retraso real (FTL 15 días DESPUÉS)
  para seguir siendo representativa del comportamiento correcto.
- **Pruebas nuevas**: `tests/suite_46_ftl_sabados.js` (2 casos, 1.16) y
  `tests/suite_49_falla_recontrol.js` (1 caso nuevo + 1 actualizado, 1.19).
- **Nota**: 1.17 (Estado R prioritario del RAC≥30 vencido) y 1.18 (documentar la regla del
  50% en la tabla de divergencias del spec) quedan pendientes — 1.17 requiere implementar
  una regla de programación del spec v68 ("piso HOY+21") que no tengo completa y que toca
  el motor CERO VENCIDOS ya muy afinado; 1.18 requiere el archivo `MOTOR_RCV_V68_SPEC.md`
  real, que no existe en este repositorio (el médico lo pegó directo en otra conversación).
- **1.15** (grupo lipídico partido) tampoco se tocó: requiere una decisión de diseño real
  (cómo debe agruparse CT/HDL/LDL/TG) que la auditoría no especifica.

## v17.6.56 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.14: `order_list` del JSON dejaba fuera lo cosechado)

`mtrJsonV68DesdeResumen` (vigilante_agenda.user.js:31789) armaba `order_list` como
`faltantes+vencidos` en vez de usar `plan.ordenar` (que `mtrPlanParaclinicos` ya construye
bien: faltantes+vencidos de los drivers, MÁS lo cosechado — un examen vigente que se
adelanta a esta misma toma porque le queda poca vigencia — y los pasajeros en estado A, sin
bloqueados, deduplicado). Un cosechado NUNCA aparece en faltantes ni en vencidos (si
estuviera vencido no habría nada que cosechar), así que la nota clínica que el médico copia
a la historia describía MENOS exámenes de los que el asistente realmente iba a ordenar. Fix
de una línea: `order_list: claves(plan.ordenar)`.

- **Test existente actualizado**: `"mtrJsonV68DesdeResumen mapea lo determinista..."` usaba
  un `plan` sintético sin campo `ordenar` (no representa la forma real que produce
  `mtrPlanParaclinicos`); se le añadió `ordenar: [...]` para seguir siendo representativo.
- **Mutación**: se revirtió a `[].concat(claves(plan.faltantes), claves(plan.vencidos))`.
  El banco pasó de 2217 en verde a 1 roja: *"order_list incluye lo COSECHADO..."* (un
  cosechado, COLESTEROL_HDL, no aparecía). Restaurado, banco vuelve a 2217 en verde.
- **Prueba nueva**: `tests/suite_57_ia_redaccion.js` — 1 caso con un cosechado que
  faltantes/vencidos por sí solos no traen.

## v17.6.55 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.12: "sin estatina de alta intensidad" se disparaba con el paciente YA en dosis alta)

Mismo patrón exacto que el bug de HbA1c de v17.6.0 (documentado arriba en este mismo
archivo): `mtrResumenDesdeModalLabs` leía los medicamentos reales del paciente
(`mtrLeerMedicamentos`) **DESPUÉS** de llamar a `mtrResumenClinico`, solo para adjuntarlos
como `resumen.medicamentos` (para mostrarlos) — pero `mtrPlanFallas` → `mtrInerciaEstatina`
corren **DENTRO** de `mtrResumenClinico`, así que nunca veían `c.meds`. Efecto: "⚠ LDL en
falla sin estatina de alta intensidad" se disparaba SIEMPRE que hay falla de LDL, incluso en
un paciente con atorvastatina 80 mg real — una afirmación de hecho falsa que empuja a subir
una dosis ya máxima. Fix: se adelanta la lectura de medicamentos a ANTES de la llamada a
`mtrResumenClinico`, y se pasa como `meds:` en el ctx (reutilizando la misma lectura para
`resumen.medicamentos`, sin leer dos veces).

- **Nota de alcance**: el hallazgo hermano 1.13 (meta de LDL individual "solo apretar") NO
  se tocó en esta entrega — a diferencia de 1.12, no es un simple cableado: no existe
  todavía ningún mecanismo para que el médico fije una meta de LDL individual (el
  equivalente de `metaHba1cManual` para LDL simplemente no existe, ni botón ni
  almacenamiento). Construirlo es una funcionalidad clínica nueva, no un bug fix, y queda
  pendiente de que el médico la pida explícitamente.
- **Mutación**: se quitó `meds: _medsParaMotor` del ctx (volviendo a la lectura tardía). El
  banco pasó de 2216 en verde a 1 roja: *"el adaptador ahora SÍ manda los medicamentos
  reales al motor..."* (con atorvastatina 80 mg real, `inercia` seguía dando `true`).
  Restaurado, banco vuelve a 2216 en verde.
- **Prueba nueva**: `tests/suite_47_recuadro_clinico.js` — 1 caso, de punta a punta
  (`mtrRefrescarMedicamentos` con fixture inline de atorvastatina 80 mg → `mtrResumenDesdeModalLabs`
  → `resumen.fallas.inercia`), mismo patrón que las pruebas de HbA1c ya existentes en la
  misma suite.

## v17.6.54 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.11: ASCVD Colombia mezclaba ecuación masculina con factor femenino)

`mtrClasificarRiesgoCv` (paso 4, vigilante_agenda.user.js:28920): el ASCVD crudo
(`mtrAscvdPceCrudo`) elige ecuación con `mtrEsSexoFemenino(sexo)` — femenina si es cierto,
MASCULINA en cualquier otro caso (su rama `else`, que cubre sexo ausente). El factor de
ajuste Colombia elegía con `mtrEsSexoMasculino(sexo)` — una función DISTINTA que, con sexo
ausente, TAMBIÉN da `false` (ninguna de las dos funciones exige que el dato exista para
devolver `false`). Resultado: con sexo ausente, el crudo salía calculado con la ecuación
MASCULINA pero el factor aplicado era el FEMENINO (0.54 en vez de 0.28) — casi el doble de
riesgo ajustado, puede saltar de BAJO a MODERADO o de MODERADO a ALTO. Fix: el factor se
elige con la MISMA función (`mtrEsSexoFemenino`) que decidió la ecuación — queda siempre
pareado con la que de verdad se usó, sin inventar un "sexo por defecto" nuevo.

- **Mutación**: se revirtió el factor a `mtrEsSexoMasculino(x.sexo) ? 0.28 : 0.54`. El
  banco pasó de 2215 en verde a 1 roja: *"PASO 4 — con sexo AUSENTE, el factor de ajuste
  debe parear con la ecuación realmente usada"* (sin sexo daba un % distinto al de
  "Hombre", pese a usar la misma ecuación). Restaurado, banco vuelve a 2215 en verde.
- **Prueba nueva**: `tests/suite_45_riesgo_cv.js` — 1 caso (sin sexo == Hombre; Mujer sí
  distinto de Hombre, para no romper el caso real de ajuste por sexo).

## v17.6.53 — 26-ago-2026 (auditoría 25-ago, hallazgos 1.8 y 1.9: dos elecciones manuales del médico que una recarga borraba)

Mismo módulo (`openAgendamientoModal`, sección de toma de laboratorios), mismo patrón de
bug: una recarga del panel de laboratorio "olvidaba" una elección que el médico ya había
hecho a mano, por no tener un flag equivalente a `_controlElegidoManual`/
`_celularSmsEditadoManual` (que sí protegen la fecha de control y el celular del SMS).

**1.8 — el interruptor "Agendar también la Toma de Muestras" se apagaba solo.**
`cargarHorasLab` (línea ~19790) ponía `checked=false` al INICIO de cada recarga (cambio
de chip de día, cambio de especialidad) y solo lo re-marcaba si era el default de
labs-primero Y el médico nunca lo había tocado (`!labChk.dataset.tocado`). Si el médico lo
marcaba a mano en modo normal, la siguiente recarga lo apagaba y NUNCA lo volvía a marcar
— al confirmar se creaba solo la cita de control, sin la toma que el médico pidió. Fix: se
guarda el ÚLTIMO VALOR elegido a mano (`_labChkEditadoManual`/`_labChkValorManual`), no
solo si "ya lo tocó".

**1.9 — la fecha de TOMA elegida a mano se descartaba en cada cambio de fecha de control.**
`renderLabDayChips` (línea ~19821) reasignaba el centro (y `selectedLabDateInfo`) al ítem
central de la sugerencia SIN comprobar si el médico ya había elegido otra fecha de toma con
un clic — a diferencia de `_controlElegidoManual`, que sí protege la fecha de control.
`cargarHoras`, que corre en cada cambio de fecha de control, vuelve a llamar a
`renderLabDayChips` con una sugerencia recién calculada, descartando la elección. Un
segundo punto del MISMO bug: `cargarHoras` también pisaba directamente el texto de
`#vgl-lab-date-lbl` con la fecha recién sugerida, sin pasar por `renderLabDayChips` — el
chip activo podía quedar bien pero la etiqueta visible mostraba otra fecha. Fix: nuevo flag
`_labFechaTomaElegidaManual`, consultado en los dos puntos.

- **Mutación 1.8**: se revirtió a `dataset.tocado`/`_chkPorDefecto` puro (sin los nuevos
  flags). El banco pasó de 2214 en verde a 1 roja: *"el interruptor de Toma de Muestras
  marcado A MANO sobrevive a un cambio de día de laboratorio"*. Restaurado, banco vuelve a
  2214 en verde.
- **Mutación 1.9**: se revirtieron los dos puntos (centro de `renderLabDayChips` y el texto
  de `cargarHoras`) a la versión sin flag. El banco pasó de 2214 en verde a 1 roja: *"la
  fecha de TOMA elegida a mano sobrevive a un cambio de fecha de control"* (esperaba
  "15/09/2026..." y volvió a dar "09/09/2026...", la fecha recién recalculada).
  Restaurado, banco vuelve a 2214 en verde.
- **Pruebas nuevas**: `tests/suite_15_interfaz_avanzada.js` — 2 casos, ambos con el modal
  completo de agendamiento montado en el DOM simulado (mismo patrón que el resto de la
  suite: `_mockAgendaComun`-style fetch/gmxhr, clics reales vía `disparar`).

## v17.6.52 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.7: el recorte de RAC≥30 nunca aplicaba con contexto clínico)

`_vigenciaDiasParaAnalito` (vigilante_agenda.user.js:3804, usada por `_analitosRcvVencidos`
— el aviso de entrada y el antiduplicado de "Ordenar") calculaba `base` desde
`vigenciaPorEstadio` cuando el llamador aportaba `opts.estadio`/`opts.programa`, y hacía
`if (base != null) return base;` **antes** de llegar a la rama que recorta la vigencia de RAC
a 90 días cuando hay albuminuria franca (≥30 mg/g). Con contexto clínico (el caso normal), esa
rama nunca se alcanzaba. Verificado: RAC 350 en DM2/HTA con contexto → 180 días en vez de 90;
un paciente con macroalbuminuria podía quedar declarado "RAC vigente" seis meses en la pantalla
que el médico ve al entrar. Fix: el recorte de RAC≥30 pasa a ser un TOPE (`Math.min`) sobre
`base`, no una rama alternativa — mismo criterio que ya usa la vía correcta
(`mtrVigenciaDiasNorma`, línea ~29796).

- **Mutación**: se revirtió el orden (recorte de RAC después del `if (base != null) return
  base;`, como estaba). El banco pasó de 2212 en verde a 1 roja: *"el recorte de RAC≥30 se
  aplica IGUAL con contexto de programa/estadio"* (esperaba 90 y volvió a dar 180 con
  contexto). Restaurado, banco vuelve a 2212 en verde.
- **Prueba nueva**: `tests/suite_08_labs_cronicos.js` — 1 caso (HTA, DM2, sin albuminuria, y
  ERC G4 para confirmar que el tope nunca alarga la vigencia por encima de la base).

## v17.6.51 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.6: sin peso, el plan ERC desaparece sin avisar por qué)

Consecuencia directa de 1.5: sin peso, `erc.estadioAdministrativo` sale `null`
(`mtrEvaluarErc` exige peso para Cockcroft-Gault), y `mtrVigenciaDias("ERC", ...)` devuelve
`null` para los 9 drivers de ERC → todos `NO_APLICA` → `mtrPlanParaclinicos` (línea ~30059)
devolvía el mensaje genérico "no hay ningún examen que vigilar con este programa y estadio".
Verificado con el harness (ERC, edad 70, creat 1.6, sin peso): plan vacío, cero exámenes
pendientes — al médico se le presentaba como "no hay nada que vigilar" en vez de "falta el
peso". No pasa en HTA/DM2 puros (esas tablas no usan estadio). Fix: `mtrPlanParaclinicos`
recibe una bandera `pesoFaltaParaEstadio` (calculada por `mtrResumenClinico` desde
`erc.faltan`) y, cuando aplica, cambia el mensaje a uno que dice la verdad.

- **Mutación**: se revirtió el cambio en `mtrPlanParaclinicos` (vuelta al mensaje genérico
  fijo, sin la bandera). El banco pasó de 2211 en verde a 1 roja: *"ERC sin peso: el plan
  avisa que FALTA EL PESO, no que 'no hay nada que vigilar'"* (esperaba que el motivo
  mencionara "falta el peso" y seguía diciendo "no hay ningún examen que vigilar").
  Restaurado, banco vuelve a 2211 en verde.
- **Pruebas nuevas**: `tests/suite_46_ftl_sabados.js` — 2 casos (con la bandera, y sin ella
  para confirmar que el comportamiento previo no cambia). Verificado también de punta a
  punta vía `mtrResumenClinico` con el harness (edad 70, sexo F, sin peso, creat 1.6, ERC).

## v17.6.50 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.5: sexo ausente sube el estadio renal sin avisar)

`mtrEvaluarErc` (vigilante_agenda.user.js:29358): con sexo vacío, `mtrEsSexoFemenino` da
`false` y AMBAS fórmulas (Cockcroft-Gault, CKD-EPI) se calculan como si el paciente fuera
hombre. Verificado con el harness: `{edad:70, peso:70, creat:1.0, sexo:''}` → CrCl 68.1 = G2;
el mismo caso con `sexo:'F'` → CrCl 57.8 = **G3a**. Una mujer sin sexo registrado sube un
estadio administrativo entero (cambia vigencias, ventana ANR, bloqueos de PTH/Fósforo/Albúmina)
sin que nada distinga "calculado con un supuesto" de "calculado con dato real". La vía legacy
(`estadioRenalDelPaciente`) ya expone `sexoAusente` para esto (línea ~15930, consumida en un
aviso "esto sobreestima la TFG en un 15 %" en línea 16003) — el motor `mtr*` no lo había
heredado. Fix: se añade el mismo campo `sexoAusente` al resultado de `mtrEvaluarErc`.

- **Mutación**: se forzó `sexoAusente: false` fijo (ignorando el sexo real). El banco pasó de
  2209 en verde a 1 roja: *"sexo ausente: el número sale calculado COMO HOMBRE... sexoAusente
  avisa que es un supuesto"* (esperaba `true` y obtuvo `false`). Restaurado, banco vuelve a
  2209 en verde.
- **Prueba nueva**: `tests/suite_45_riesgo_cv.js` — 1 caso (con y sin sexo, mismo paciente).
- **Alcance de esta entrega**: se expone el campo en el motor (igual que ya existe en la vía
  legacy); no se conectó todavía a un aviso visible en el panel renal del motor `mtr*` — eso
  es un cambio de UI más grande (encontrar el consumidor correcto de `mtrResumenClinico` /
  `mtrPanelRiesgoRenalHtml`) que queda para una entrega aparte si el médico lo pide.

## v17.6.49 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.4: SOMF/PCR colándose como uroanálisis)

`_ultimaFechaPorAnalito` (vigilante_agenda.user.js:2911, con `{uroanalisisPorComponentes:true}`,
usada por `_analitosRcvVencidos`) era el ÚNICO punto que llamaba `_matchUroComponente(lab)` sin
exigir primero `_esAnalitoDeOrina(lab)` — a diferencia de `_hayComponenteUroReal` e
`injectLabsIntoCronicos`, que sí lo exigen. `_matchUroComponente` solo mira el NOMBRE:
"SANGRE OCULTA EN MATERIA FECAL" (SOMF, tamización de colon) casa con el componente SANGRE, y
"PROTEINA C REACTIVA" casa con PROTEINURIA. Efecto real: un SOMF/PCR reciente podía declarar el
uroanálisis "vigente" por su fecha, silenciando el aviso justo cuando el parcial de orina real
SÍ está vencido. Fix de una línea: se añade `_esAnalitoDeOrina(lab) &&` a la condición.

- **Mutación**: se quitó `_esAnalitoDeOrina(lab) &&` de la condición. El banco pasó de 2208 en
  verde a 1 roja: *"un SOMF (sangre oculta en heces) o una PCR NO cuentan como componente de
  uroanálisis"* (esperaba que el uroanálisis siguiera faltando y obtuvo `false`, es decir, se
  dio por vigente). Restaurado, banco vuelve a 2208 en verde.
- **Prueba nueva**: `tests/suite_08_labs_cronicos.js` — 1 caso (SOMF y PCR, dos analitos).

## v17.6.48 — 26-ago-2026 (reconstrucción de trabajo perdido: dos bugs de `mtrVerificarCifrasIA`)

Reconstruido a partir de un fragmento de chat de la sesión desconectada (`session_01SY2...`,
rama `claude/actualizar-rama-vigilante-07ce6f`, nunca pusheada) que el médico pegó. Dos bugs
reales en `mtrVerificarCifrasIA` (vigilante_agenda.user.js:31063, verificador anti-alucinación
de cifras de la nota de IA):

1. **`re2` partía una cita legal en una PA falsa**: `(\d{1,3})\s*\/\s*(\d{1,3})` sin blindaje
   de borde hacía match de "280/201" dentro de "Resolución 3280/2018" — se marcaba como una
   presión arterial inventada que el modelo nunca escribió. Fix: `(?<!\d)...(?!\d)` exige que
   la fracción no tenga OTRO dígito pegado justo antes/después (una PA real nunca lo tiene).
2. **El contexto mostrado cortaba palabras largas a la mitad**: el corte fijo (24 caracteres
   antes / 20 después del número) no buscaba el espacio más cercano — "SINTOMATOLOGICAMENTE"
   salía como "ATOLOGICAMENTE". Fix: se extiende el borde (tope +15 caracteres por lado) hasta
   el siguiente espacio cuando el corte cae a mitad de palabra.

- **Mutación 1**: se revirtió el blindaje de `re2` a la versión sin `(?<!\d)/(?!\d)`. El banco
  pasó de 2207 en verde a 1 roja: *"una cita legal tipo 'Resolución 3280/2018' no se confunde
  con una PA"* (esperaba 0 y obtuvo 2). Restaurado, banco vuelve a verde.
- **Mutación 2**: se revirtió el ensanche de borde al `slice` fijo original. 1 roja: *"el
  contexto mostrado nunca corta una palabra a la mitad"* (esperaba que incluyera
  "SINTOMATOLOGICAMENTE", obtuvo "ATOLOGICAMENTE presenta 45 mg."). Restaurado, banco vuelve
  a verde (2207).
- **Pruebas nuevas**: `tests/suite_57_ia_redaccion.js` — 2 casos.

**Nota de alcance**: el fragmento de chat también describía un tercer arreglo (`getAtheneaLabsAuto`,
un reintento automático cuando la precarga de labs devuelve una lista vacía sospechosa) y una
feature (listado agrupado por fecha de vencimiento con "Sin historial" aparte). No se
reconstruyeron en esta entrega: el código actual de `getAtheneaLabsAuto`/`_conTope` ya tiene una
defensa null≠[] y de lectura parcial (`__vglIncompleto`) más sofisticada que la que describe el
fragmento, y no se pudo confirmar contra qué escenario exacto se probó el fix perdido sin
inventar el criterio — pendiente de que el médico aporte más contexto o decida el alcance.

## v17.6.47 — 26-ago-2026 (auditoría 25-ago, hallazgo 1.2: `esMedicoRCVActivo` por sub-cadena)

`esMedicoRCVActivo` (vigilante_agenda.user.js:16110) comparaba con `docName.includes(p)`:
"PINO" es sub-cadena de "OSPINO" y de "ESPINOSA", así que un médico ajeno al programa RCV con
uno de esos apellidos quedaba forzado a `swIsPyM`/`swProgramaEspecial = true` en el POST real
de `apiAccesoAsignarTurno` (escribe la cita en Athenea con esos flags mal puestos). Fix: se
compara por TOKEN completo (`docName.split(/[^A-Z0-9]+/)`), no por sub-cadena — conserva el
match de "BPALENCIA"/"EESTRADA" como token propio.

- **Mutación**: se restauró temporalmente `docName.includes(p)` (quitando el split por
  tokens). El banco pasó de 2205 en verde a **1 prueba roja**: "esMedicoRCVActivo: un apellido
  que CONTIENE a un médico RCV como sub-cadena no debe activar el forzado" (caso "JORGE
  OSPINO" → obtuvo `true` en vez de `false`). Se restauró el fix y el banco volvió a 2205 en
  verde.
- **Prueba nueva**: `tests/suite_15_interfaz_avanzada.js` — 3 casos (OSPINO, ESPINOSA no
  activan; "DR. PINO" sí sigue activando).

## v17.6.46 — 26-ago-2026 (fusión de `claude/v17-6-2-22ago`: recuperación de 31 suites)

Fusión de `origin/claude/v17-6-2-22ago` (v17.6.4b) sobre `claude/hunks-cluster-remaining-9fjixx`
(v17.6.45) para recuperar 31 suites de prueba del Panel del paciente y el motor RCV/fármaco
que solo existían en la rama vieja. En `vigilante_agenda.user.js` ganó HEAD (v17.6.45, más
auditado) en todo conflicto de "misma función, versión más nueva"; el merge de git dejó
además dos bloques de código completos duplicados sin marcar como conflicto (diff
mal-alineado entre las dos reorganizaciones del módulo del Panel y del kill-switch), que se
detectaron y eliminaron aparte.

Se restauraron unas pocas funciones puramente auxiliares que solo existían en la rama vieja
y que las suites recuperadas necesitan (`mtrCnoHDL`, `mtrSumarDiasHabiles`,
`mtrItemSugeridoEnRango`, `mtrRenderResumenClinicoHtml`, `_vglAvisoContextoFaltante`,
`_getUltimoRelevoParaTest`, `_relojEstadoParaTest`/`_relojAjustarParaTest`) — ninguna pisa
ni cambia una decisión clínica vigente de v17.6.45.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | Se reintrodujo la línea `uxTrack("fn.agendar.abandon")` residual dentro del `closeMod` del modal de Laboratorios (el bug de copia-pega que v17.6.20 ya había corregido en HEAD, reintroducido por el merge sin marcar conflicto) | Telemetría de uso del panel (v12.5) | "embudo de Laboratorios: abrir y cerrar ANTES de que lleguen los datos cuenta como abandono" — "cerrar Laboratorios NO contamina el embudo de Agendamiento" |

Banco tras la fusión: **2.204 comprobaciones en verde** (con `TZ=America/Bogota`; el banco
depende de esa zona horaria para una prueba de v17.6.39), cobertura de funciones públicas
88.6 % (770/869).

## v17.6.1 — 22-ago-2026 (remediación tras la auditoría de producción de v17.6.0)

Banco antes (cierre de v17.6.0): 2.266 comprobaciones · después: **2.272** (6 pruebas
nuevas), cobertura **100 % (846/846)**.

Esta versión no es trabajo nuevo pedido por usted — es la respuesta a una auditoría de
producción con varios agentes independientes (más una verificación adversarial de cada
hallazgo) que se le pidió a este mismo repositorio recién entregado v17.6.0, con la
instrucción de dejarlo listo para producción de verdad. De 16 hallazgos confirmados, uno
era un defecto clínico real (ver CHANGELOG.md) y el resto, en su mayoría, filtraciones de
datos reales hacia el código y las pruebas — el detalle completo, con la magnitud real de
lo encontrado, está en CHANGELOG.md. Aquí solo van las **cinco mutaciones verificadas**
sobre el único cambio de comportamiento clínico de esta versión y sobre las pruebas
nuevas que la auditoría dejó como tarea.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **defecto clínico** | `mtrPanelMetasHtml`: se vuelve a `const h = d && d.hba1c;` (se quita el `d.esDm2 &&`) | `suite_68` | *con HbA1c medida pero SIN diabetes, la fila NO se muestra (v17.6.1)* (esperaba que la fila no apareciera, obtuvo `true`) |
| **narrativa del ítem 2** | `MTR_HECHOS_FACTORES` recupera las cuatro claves viejas (`dislipidemia`, `ecvEstablecida`, `antecedenteFamiliarPrematuro`, `ercPrevia`) | `suite_56` | *las claves viejas retiradas… NUNCA salen, aunque vengan encendidas* (esperaba `undefined`, obtuvo `true` en las cuatro) |
| **meta de HbA1c — bordes** | `openPanelPacienteModal`: la guarda del guardado pasa de `v >= 5 && v <= 12` (inclusive) a `v > 5 && v < 12` (exclusive) | `suite_67` | *los bordes EXACTOS 5 % y 12 % se aceptan…* (5 % y 12 % exactos empiezan a rechazarse) |
| **meta de HbA1c — reapertura** | `openPanelPacienteModal`: el campo del formulario deja de leer `_resumen.hba1c.meta` y siempre arranca en `MTR_HBA1C_META_DM2` | `suite_67` | *para un paciente que YA tiene una meta individual guardada, el editor arranca en ESE valor…* (esperaba `value="9.5"`, obtuvo `false`) |
| **meta de HbA1c — payload** | `openPanelPacienteModal`: el mensaje de error de un valor inválido pasa de un texto fijo a repetir `inp.value` sin escapar | `suite_67` | *un payload con forma de XSS se rechaza… y nunca queda reflejado en el DOM* (esperaba que el mensaje fuera el genérico, obtuvo el payload repetido) |

Las cinco se aplicaron una a una sobre el archivo de producción, se corrió la suite
señalada, se confirmó el rojo con el mensaje esperado, y se restauró antes de seguir con
la siguiente. El banco completo volvió a 2.272/2.272 tras la restauración final.

### Una sexta cosa que se blindó, y que a propósito NO tiene mutación

La misma auditoría señaló que `x.estado` era el único campo de la fila de "Metas
terapéuticas" en `mtrPanelMetasHtml` sin pasar por `escapeHtml(...)`, mientras sus cinco
vecinos (rótulo, meta, actual, extra, editable) sí. Se corrigió por consistencia y
defensa en profundidad — pero, a diferencia de las cinco de arriba, **esta no tiene una
mutación verificada**, y vale explicar por qué en vez de fingir que sí la tiene: `x.estado`
lo fijan dos funciones más arriba en el mismo archivo, siempre a uno de tres literales
fijos ("nd"/"ok"/"falla") — no hay hoy ningún punto de entrada público por el que una
prueba (ni un atacante) pueda hacer que ese campo cargue otra cosa. Revertir el
`escapeHtml` no pone roja ninguna prueba posible, porque `escapeHtml("ok")` y `"ok"` son
el mismo string: no hay nada que mutar de forma honesta. Se deja constancia de esto en
vez de escribir una prueba que solo aparentara probar algo.

## v17.6.0 — 22-ago-2026 (todas las mejoras aprobadas el 22-ago, excepto la sede del laboratorio)

Banco antes (cierre de v17.5.0): 2.253 comprobaciones · después: **2.266** (13 pruebas
nuevas), cobertura **100 % (846/846)** — 1 función nueva (`mtrEducacionFlagsTexto`),
cubierta.

Usted respondió "PROCEDE CON TODAS LAS MEJORAS EXCEPTO LA 4" sobre
`docs/MEJORAS_PENDIENTES_20260822.md`: van los ítems 1, 3, 5 y 6 (el 2 se investigó y
NO se tocó — ver `CHANGELOG.md` — y el 4, la sede del laboratorio, queda fuera por su
instrucción). Doce mutaciones deliberadas en total, cada una restaurada antes de seguir
con la siguiente — el ítem 3 se llevó seis, porque al cablear el campo editable
aparecieron dos eslabones rotos más abajo en la misma cadena (ver `CHANGELOG.md`).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **ítem 1** | `mtrHojaDeHechos`: `educacion` vuelve a leer `Array.isArray(r.educationFlags)` (el defecto original) en vez de `mtrEducacionFlagsTexto(...)` | `suite_56` | *«Educación indicada» ahora sí llega a la hoja…* (esperaba 2 ítems, obtuvo 0) |
| **ítem 1** | `mtrJsonV68DesdeResumen`: `ef` vuelve a construirse con el `Array.isArray` viejo en vez de leer el objeto directo | `suite_57` | *education_flags.dieta/.actividad ahora sí reflejan el programa…* (dieta encendida en el resumen, obtuvo `false`) |
| **ítem 5** | `MTR_COSECHA_MARGEN_PROP` vuelve a 0.25 (el corte viejo) | `suite_46` | *el corte de cosecha en 33% adelanta un examen que con el corte viejo (25%) se habría diferido* (27,8 % de margen, obtuvo `false`) |
| **ítem 6** | `MTR_MEDS_TTL_MS` vuelve a `5 * 60 * 1000` | `suite_39` | *el TTL de medicamentos subió de 5 a 10 min: a los 7 min…* (obtuvo `false`) |
| **ítem 6** | `MTR_CACHE_TTL_MS` vuelve a `20 * 60000` | `suite_50` y `suite_57` | *el TTL del resumen bajó de 20 a 10 min…* (esperaba `null`, obtuvo el resumen cacheado) y *caché del resumen: edad en minutos…* (esperaba `null` a los 10 min y 1 s, obtuvo `10`) |
| **ítem 6** | `TABLA_OFICIAL_TTL_MS` vuelve a `1800000` | `suite_31` | *el TTL de la tabla oficial bajó de 30 a 10 min…* (esperaba `null`, obtuvo la tabla) |
| **ítem 3** | `mtrResumenDesdeModalLabs`: se quita `hba1c: val("HBA1C")` del ctx (primer eslabón que faltaba — nunca mandaba el valor crudo) | `suite_47` | 2 pruebas: *el adaptador ahora SÍ manda el valor real de HbA1c…* y *sin meta individual guardada, el Panel muestra la meta general…* |
| **ítem 3** | `mtrResumenClinico`: se quita la línea `resumen.hba1c = (c.hba1c != null) ? {...} : null` (segundo eslabón — el ctx ya llegaba bien, pero nunca se copiaba a un campo propio del resumen) | `suite_47` | las mismas 2 pruebas de arriba, mismo síntoma por una causa distinta |
| **ítem 3** | `mtrPanelMetasHtml`: se quita `editable: "hba1c"` del objeto de la fila | `suite_68` | *la fila de HbA1c trae el botón para fijar una meta individual…* (esperaba el id fijo de la fila, obtuvo `false`) |
| **ítem 3** | `openPanelPacienteModal`: el rango válido del campo se amplía de 5-12 a 5-25 (la guarda deja de rechazar el caso de prueba) | `suite_67` | *fijar la meta individual de HbA1c…* (esperaba el mensaje de error para 20 %, obtuvo `false`) |
| **ítem 3** | `openPanelPacienteModal`: se quita la llamada a `_vglCosechaGuardar(...)` en el clic de Guardar | `suite_67` | la misma prueba — sin el guardado, la lectura posterior de la cosecha lanza (`Cannot read properties of null`) |
| **ítem 3** | `mtrRecalcularConFactores`: se quitan los campos `hba1c`/`metaHba1c` del ctx (tercer eslabón — la reclasificación EN VIVO, la que corre CADA VEZ que se abre el Panel con caché tibia o cada 20 s, reconstruía el resumen sin ellos) | `suite_67` | la misma prueba — el botón de editar ya ni aparece al abrir (*con HbA1c medida y diabetes, el Panel muestra el botón…*, obtuvo `false`) |

Las doce mutaciones se aplicaron una a una sobre el archivo de producción, se corrió la
suite señalada, se confirmó el rojo con el mensaje esperado, y se restauró antes de
seguir con la siguiente. Ninguna quedó sin cazar. El banco completo volvió a
2.266/2.266 tras la restauración final.

### Los tres eslabones del ítem 3, y por qué son tres mutaciones distintas y no una

La meta de HbA1c individual (el campo editable en el Panel) es lo único que el médico
pidió, pero verificar el dato al que esa meta se compara —el valor REAL de HbA1c—
destapó que la fila entera de "Metas terapéuticas" para HbA1c llevaba **apagada desde
que se escribió (v17.0.0)**, por tres motivos independientes y sucesivos en la misma
cadena de datos:

1. `mtrResumenDesdeModalLabs` (el adaptador que arma el resumen con lo que Athenea ya
   trajo) nunca leía el valor crudo de HbA1c del laboratorio — sí RAC, colesterol y LDL,
   dos líneas más arriba en el mismo objeto.
2. Aunque lo leyera, `mtrResumenClinico` nunca copiaba ese valor a un campo propio del
   resumen (`resumen.hba1c`) — solo viajaba, ya envuelto en `{actual,meta}`, hacia
   ADENTRO de `mtrPlanFallas` (la alerta de "fuera de meta"), nunca hacia afuera, que es
   por donde lo lee `mtrTableroClinico` para la fila del Panel.
3. Aunque los dos anteriores estuvieran bien, `mtrRecalcularConFactores` —la
   reclasificación EN VIVO que corre cada vez que el Panel abre con una caché tibia, y
   cada 20 segundos mientras sigue abierto— reconstruye el resumen sin pasar por los
   dos primeros pasos, y tampoco llevaba `hba1c`/`metaHba1c`: el mismo patrón que la
   auditoría de v17.0.1/v17.0.2 ya había encontrado con `grupoSabado`, `uroHallazgos` y
   `embarazo`, ahora en un campo nuevo.

Los tres se encontraron leyendo el código de punta a punta antes de confiar en una sola
prueba — el segundo y el tercero no aparecen en ningún grep razonable (`resumen.hba1c =`
no calza con "propiedad dentro de un objeto literal que se pasa a otra función", que es
la forma real de la trampa) y solo salieron al abrir el Panel de verdad, con datos de
verdad, en una prueba `casoAsync` completa. Quedan documentados aquí en detalle porque
son exactamente la clase de error que este proyecto más le importa cazar: una señal
clínica que existe en el código pero nunca llega a la pantalla.

## v17.5.0 — 22-ago-2026 (compuerta de completitud del Panel del paciente, y el mismo aviso extendido al agendamiento)

Banco antes (cierre de v17.4.0): 2.242 comprobaciones · después: **2.253** (11 pruebas
nuevas: 8 de la compuerta del dock/funciones puras + disparo automático en
`suite_15_interfaz_avanzada.js`, 3 del aviso en el banner de agendamiento en
`suite_61_v158_ux.js`), cobertura **100 % (845/845)** — 3 funciones nuevas
(`autoCalcularResumenSiNecesario`, `mtrFactoresPendientesNavegables`,
`mtrIrAPestanaPorNombre`), las tres cubiertas.

Orden explícita del médico: el botón «Panel del paciente» debe quedar DESHABILITADO —no
solo con aviso— hasta que el script recopile lo mínimo necesario, con una lista de
faltantes navegable por pestaña; y el mismo aviso, ya no bloqueante, extendido a la
sugerencia de fecha del agendamiento. Cuatro mutaciones deliberadas sobre el núcleo de la
lógica nueva, cada una restaurada antes de seguir con la siguiente:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **v17.5.0** | `mtrFactoresPendientesNavegables`: se invierte la condición de "pendiente" (`v !== null` → `v === null`), de modo que documentado pasa a leerse como faltante y viceversa | `suite_15` | 6 pruebas: las 2 de unidad de la propia función, las 2 de la compuerta del dock («aún cargando» y «un solo atajo»), y 2 más que dependen de una lista de pendientes correcta |
| **v17.5.0** | `createAccionesDockUI`: `_panelBloqueado` se fija en `false` sin condición | `suite_15` | 2 pruebas: «Panel bloqueado mientras el resumen automático no termine» y «Panel bloqueado y con un solo atajo» |
| **v17.5.0** | `_agmAvisarSiFaltaDocumentar` (agendamiento): la condición `_pendAgm.length > 0` se reemplaza por `true`, así que el aviso ⚠️ aparece siempre, incluso con los factores completos | `suite_61` | «con los factores completos, la misma sugerencia NO lleva el aviso de completitud» |
| **v17.5.0** | `autoCalcularResumenSiNecesario`: se elimina la guarda `if (mtrCacheResumenLeer(docId)) return;`, así que un resumen ya cacheado no evita una consulta nueva | `suite_15` | «con un resumen ya fresco en caché, abrir la historia no dispara ninguna consulta nueva» (pasa de 0 a ≥1 consultas contadas) |

Las cuatro mutaciones se aplicaron una a una sobre el archivo de producción (con
`sed` dirigido a la línea exacta, nunca a mano sobre el original), se confirmó cada
prueba en rojo con el fallo esperado, y se restauró el archivo — verificado con `diff`
contra una copia intacta — antes de pasar a la siguiente. Ninguna quedó sin cazar. El
banco completo volvió a 2.253/2.253 tras la restauración final.

No se tocó la lógica de `_pintarBannerSugerida` en sí (las cuatro ramas de la sugerencia
—labs-primero, fecha sugerida, y las dos de "sin sugerencia"— ya tenían cobertura previa
en `suite_15`/`suite_61`; lo nuevo es únicamente el aviso que se les suma).

## v17.3.1 — 22-ago-2026 (el mismo reporte de CSS, una capa más abajo — el médico insistió y tenía razón)

Banco antes (cierre de v17.3.0): 2.242 comprobaciones · después: **2.242** (sin blocks de
prueba nuevos — el fallo lo cazan dos pruebas YA existentes, Regla E y Regla G de
`suite_25_cascada_css.js`, ajustadas a los nuevos totales), cobertura **100 % (842/842)**.

El médico volvió a reportar «el azul de Everest se sigue colando» con el MISMO pantallazo
del modal de confirmación de agendamiento («PROGRAMA AL QUE SE CARGA LA CITA:», el aviso
de RCV/Prevención, «↩ Modificar / Atrás»), horas después de recibir v17.3.0 — el parche que
en teoría ya cubría exactamente esas tres cosas. Antes de asumir que simplemente no había
instalado el archivo nuevo (la consola sí mostraba `userscript v17.2.0 activo`, lo cual era
cierto y explica la mayoría de lo reportado ese día), se volvió a montar el trío completo
en Chromium real contra el `<style>` YA con v17.3.0 puesto, para no dar una respuesta a
ciegas. El rótulo, el kicker, la tarjeta, el paciente, el subtítulo, cerrar, el aviso fijo
y los dos botones — 7 de los 9 campos — SÍ sobrevivían. Pero el `<span>` suelto dentro de
`.vgl-agm-check-lbl` («¿Es cita para actividades del programa RCV / Prevención?») seguía
midiendo `rgb(31, 78, 121)` en los dos temas, CON el parche de v17.3.0 puesto. El reporte
del médico tenía razón en algo que mi propia verificación de ayer no había medido a ese
nivel de detalle: v17.3.0 blindó la ETIQUETA (`.vgl-agm-check-lbl{color:var(--fg)
!important}`), no el texto que vive DENTRO de ella.

**Causa raíz**: es el bug #2 del `CLAUDE.md`, en una variante que el propio documento no
nombra explícitamente. La "armadura tipográfica" general (`:where(selector:not([class]))
{color:inherit}`, v12.3.15, extendida a este trío en v17.0.3) es CORRECTA para pelear
contra nuestras propias reglas viejas (bug #1: especificidad), pero no lleva `!important` —
nunca lo necesitó para el bug #1, porque ahí compite contra OTRA regla nuestra sin
`!important` tampoco. Contra Everest, que sí usa `!important`, una declaración normal
pierde SIEMPRE sin importar la especificidad — y el `<span>` de `.vgl-agm-check-lbl` es
precisamente un elemento sin clase propia que depende de esa armadura. El color heredado
del `<label>` (ya blindado) nunca entra a competir: Everest tiene una regla que apunta al
`<span>` DIRECTAMENTE, y un valor heredado no compite cuando existe una regla que ataca al
elemento en persona.

**Alcance real, mayor de lo reportado**: al confirmar el mecanismo, se revisó cada uso real
de `.vgl-agm-check-lbl` en el archivo (4 sitios: RCV/Prevención, SMS y Toma de Muestras en
Agendar; «Mi estilo» en el modal de Redacción IA). Los cuatro comparten el mismo defecto.
El caso de «Mi estilo» es notable: es el reporte de campo del 20-ago que motivó el parche
de v16.7.0/v17.0.3 — y NUNCA quedó resuelto del todo. Se verificó en Chromium con el
marcado real de `#vgl-ia-modal`: seguía en azul de Everest en los dos temas. Y la tarjeta
de plan unificado de Agendar («🧪 Agendar también la Toma de Muestras») tiene un `<b>`
suelto con el mismo problema, sin haber sido reportado todavía — se corrigió junto con los
`<span>`, no se dejó para el próximo pantallazo.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl span` del trío (agendar/ordenar/labs) | `suite_25` | *Regla E* (74→77, el trío SÍ está en su lista de paneles) **y** *Regla G* (279→278) — doble captura, igual que el `.vgl-agm-btn span` de v17.3.0 |
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl b` del trío | `suite_25` | *Regla E* (74→77) **y** *Regla G* (279→278) — doble captura |
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl span` de los 7 hermanos (ia-modal y compañía) | `suite_25` | *Regla G* únicamente (279→278) — Regla E no ve estos 7 paneles, no están en su lista `paneles` (a propósito: esa lista es de los 7 paneles con censo exhaustivo, no de todos los que exigen `!important`) |
| **v17.3.1** | Se quita `!important` de `.vgl-agm-check-lbl b` de los 7 hermanos | `suite_25` | *Regla G* únicamente (279→278) |

Las cuatro mutaciones se aplicaron una a una sobre el archivo de producción, se confirmó
cada prueba en rojo con el mensaje exacto esperado (`salió 278`, y `Salieron 77` cuando
correspondía), y se restauró antes de seguir con la siguiente. Ninguna quedó sin cazar.

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color nueva)

Se repitió el mismo montaje de ayer (hoja `<style>` real extraída de `buildOverlay()`,
estructura real tomada línea por línea de `openAgendamientoModal`, CSS agresivo de Everest
cargado antes) — esta vez con el archivo YA con las 4 reglas nuevas puestas:

- **Las 9 mediciones del trío de agendamiento vuelven a pasar, ahora incluyendo el `<span>`
  que ayer no se había medido por separado**: 9 campos × 2 temas = 18 mediciones, 0 fugas
  (ayer: 8/9 pasaban sin el `<span>` aislado; con él aislado y ANTES de este parche, medía
  `rgb(31, 78, 121)` en los dos temas — la prueba que faltaba).
- **`#vgl-ia-modal` — «Mi estilo» (el caso real que motivó v16.7.0/v17.0.3)**: antes de
  este parche, `rgb(31, 78, 121)` en los dos temas. Después, `rgb(247, 250, 252)` oscuro /
  `rgb(11, 18, 32)` claro — los tokens `--fg` reales, igual que el resto de la etiqueta.
- **El `<b>` suelto de «🧪 Agendar también la Toma de Muestras»** (no reportado, hallado al
  auditar el alcance): antes, mismo azul; después, `rgb(247, 250, 252)` oscuro /
  `rgb(11, 18, 32)` claro.

### Nota para la próxima auditoría de este tipo

La verificación de v17.3.0 midió 9 campos por módulo, pero `.vgl-agm-check-lbl` como
CAMPO (la etiqueta) y `.vgl-agm-check-lbl span` como campo (el texto de adentro) son dos
elementos DISTINTOS con reglas de cascada independientes — medir uno no confirma el otro.
La lección concreta: cuando un contenedor mezcla texto directo y `<span>`/`<b>` anidados,
cada nivel de anidamiento necesita su propia medición, no solo la del contenedor. Se deja
anotado aquí porque es la misma clase de trampa que ya mordió al censo de `!important` en
v15.2.0 y al muestreo de contraste de #114: la verificación pasó, pero no había medido lo
que hacía falta medir.

## v17.3.0 — 22-ago-2026 (cuatro reportes del mismo día: consola, CSS, rotación de Gemini y auditoría de prompt)

Banco antes (cierre de v17.2.0): 2.236 comprobaciones · después: **2.242**, cobertura **100 %
(842/842)** — la única función pública nueva es `mtrEsModeloNoDisponible` (841→842); los otros
tres arreglos no agregan funciones (uno retira una llamada muerta, otro reescribe un prompt ya
existente, el otro es CSS puro).

Los cuatro salieron del mismo reporte de campo del 21-ago (consola real + dos pantallazos + una
lectura directa de un borrador real de Enfermedad Actual):

1. **Choque en consola**: `Uncaught (in promise) ReferenceError: _frenoMarcaOk is not defined`
   en CADA generación exitosa del panel de Redacción IA, en los tres modos. La función nunca
   existió en el archivo — se retiró la llamada muerta.
2. **El azul de Everest se cuela**: en el modal de confirmación de la cita («RESUMEN DE LA CITA
   A ASIGNAR») el rótulo del resumen y el aviso de RCV salían en el azul marino de Everest — el
   trío agendar/ordenar/labs nunca había recibido el barrido de Regla E que sí tuvieron
   Ficha/Tablero/Panel (v16.1.0) e IA/Datos-IA/Riesgo/Confirma+Llenar (v16.7.0).
3. **Rotación de Gemini atascada**: `gemini-2.5-flash` (404, modelo retirado) y
   `gemini-3.7-flash` (400/503 intermitente en consola real) no eran reconocidos como "hay que
   rotar" — el conector se quedaba pegado al mismo modelo caído en vez de probar el siguiente.
4. **Auditoría del propio médico**: un borrador real de Enfermedad Actual traía una cifra de
   función renal y una clasificación de riesgo cardiovascular — datos que, por convención propia
   de su historia clínica, van en Análisis y Plan, no ahí.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`_frenoMarcaOk`** | se reintrodujo la llamada muerta `_frenoMarcaOk();` en el mismo punto donde vivía antes del arreglo (justo tras `habilitarPost(textoFinal)`) | `suite_59` | *v17.3.0 — Generar (éxito): ya NO revienta con '_frenoMarcaOk is not defined'…* — clic real sobre el botón «Generar», con Gemini simulado en 200; antes de restaurar, la prueba capturó textualmente `_frenoMarcaOk is not defined` |
| **Regla E, trío de agendamiento** | se le quitó el `!important` a UNA sola declaración del bloque nuevo (`.vgl-agm-btn span{color:inherit}`, sin tocar el valor) | `suite_25` | *Regla G - escala tipográfica / censo de !important* (275→274) — y de regalo, también cayó *Regla E - color con selector de PANEL fuera de #vgl-root lleva !important* (el censo exacto de cadenas sin !important subió de 74 a 77: la declaración mutada, al perder el !important, pasó a contarse ahí) |
| **Rotación ante modelo no disponible** | `mtrEsModeloNoDisponible` se neutralizó a `return false` siempre | `suite_57` | 4 rojas: *mtrEsModeloNoDisponible reconoce 400/404/500/502/504…*, *el conector ROTA de modelo ante 404…*, *el conector también ROTA ante 400…*, *si TODOS los modelos configurados están 404/400, informa 'no disponible'…* |
| **Auditoría de Enfermedad Actual** | la regla 6 volvió a admitir cifras sin acotar a HOY (se quitó "DE HOY" y la exclusión de labs) y se retiraron las dos líneas nuevas de PROHIBIDO (labs/paraclínicos; clasificación de riesgo/metas terapéuticas) | `suite_57` | *Enfermedad Actual ya NO admite labs/paraclínicos ni clasificación de riesgo — eso vive en Análisis y Plan* |

Las cuatro mutaciones se aplicaron una a una sobre el archivo de producción, corriendo solo la
suite correspondiente, restaurando entre cada una. **Ninguna quedó sin cazar** — la del trío de
agendamiento, de hecho, cazó por partida doble (Regla E Y Regla G) sin proponérselo.

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color nueva)

El trío de agendamiento es la única regla de color nueva de v17.3.0 (los otros tres arreglos no
tocan CSS). Se montó la hoja `<style>` REAL extraída de `buildOverlay()` (vía el propio arnés de
pruebas — con las constantes ya interpoladas, no una copia recortada a mano) sobre la estructura
real de los tres modales (tags exactos tomados de `openAgendamientoModal`,
`openOrdenamientoModal` y `openLaboratoriosModal`), con el CSS agresivo de Everest que exige el
proyecto (`div,span,p,b,small,label{color:#1f4e79 !important}`) cargado ANTES, en los dos temas:

- **Ningún azul de Everest se coló**: 9 campos (kicker, tarjeta, paciente, subtítulo, cerrar,
  rótulo, dato, checkbox, botón) × 3 módulos × 2 temas = 54 mediciones — ninguna dio
  `rgb(31, 78, 121)`.
- **La identidad de color por módulo sobrevivió**: kicker y rótulo salieron en tres colores
  DISTINTOS (azul/morado/verde) tanto en oscuro (`rgb(124,184,255)` / `rgb(201,162,255)` /
  `rgb(79,240,184)`) como en claro (`rgb(30,64,175)` / `rgb(91,33,182)` / `rgb(6,95,70)`) — la
  razón misma por la que este parche usa tres reglas separadas en vez de una combinada.
- **Hallazgo de regalo**: el rótulo (`.vgl-agm-lbl`) de Ordenar en tema CLARO tenía un defecto
  previo, ajeno por completo al azul de Everest — `#vgl-agendar-modal.light .vgl-agm-lbl,
  #vgl-ordenar-modal.light .vgl-agm-lbl,#vgl-labs-modal.light .vgl-agm-lbl{color:var(--c-azul)}`
  (línea ~12669) empata en especificidad con la regla morada propia de Ordenar
  (`#vgl-ordenar-modal .vgl-agm-lbl`, línea ~13444, que no tiene variante `.light`) y la de
  arriba lleva DOS clases (`.light` cuenta como clase) contra una sola de la de abajo — así que
  en tema claro el rótulo de Ordenar salía azul en vez de morado, sin que Everest tuviera nada
  que ver. Labs no tenía este defecto porque sí cuenta con su propia variante `.light` (línea
  13093). El `!important` de v17.3.0, al no distinguir tema, corrige esto de regalo: no era su
  objetivo, pero es la misma declaración que ya se estaba blindando.

## v17.2.0 — 21-ago-2026 (#114 — la frecuencia real de los medicamentos)

Banco antes (cierre de #151, v17.1.1): 2.216 · después: **2.236**, cobertura **100 %
(841/841)** — las 6 funciones públicas nuevas (`mtrFrecuenciaTexto`,
`mtrMapaFrecuenciasPorCodigo`, `mtrMapaFrecuenciasPorNombre`,
`mtrPedirHistoricoMedicamentos`, `mtrLeerFrecuenciasMedicamento`,
`mtrEnriquecerAvisosConFrecuencia`) explican las 835→841.

`#114` llevaba mucho tiempo bloqueado: `CargarMedicamentosPaciente` (el endpoint que ya
se usaba) nunca trajo frecuencia, en ningún campo. La grabación del 21-ago (GRABADOR
v3.4.0, tras corregir el defecto de `resBody` en null) encontró el dato real en otro
sitio: `HistoricoMedicamentoHCM?PacienteId=…` trae `frecuenciaNumero` +
`frecuenciaUnidad` estructurados por cada renglón histórico. El médico pidió la
frecuencia en las tres superficies (Ficha/Medicamentos, avisos de seguridad renal e
interacciones, y la redacción con IA) y las tres quedaron construidas — con una
excepción deliberada, ver abajo.

**Decisión de alcance, no negociada con silencio**: los avisos de INTERACCIÓN (Triple
Whammy, doble bloqueo SRAA, gemfibrozilo+estatina…) citan un PAR DE CLASES en
`par_farmacos` — «IECA + ARA-II», no «LOSARTAN 50 MG» —, nunca un fármaco literal del
paciente. Colgarles una frecuencia real exigiría ADIVINAR cuál de los dos (o tres)
fármacos del par la disparó, y una frecuencia mal atribuida en una alerta de seguridad
es peor que no mostrar ninguna — es la misma lógica de "casilla vacía antes que dato
inventado" aplicada a un caso donde el dato SÍ existe pero no hay dónde colgarlo sin
inferir. Por eso `mtrEnriquecerAvisosConFrecuencia` solo actúa sobre avisos con
`medicamento_detectado` (el campo que solo traen los avisos de DOSIS renal, que sí citan
un fármaco puntual) y dejó fuera, a propósito, los avisos de interacción. La mutación
que prueba exactamente este límite es la de alcance, en la tabla de abajo.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **#114** | `mtrFrecuenciaTexto` invierte singular/plural (`n===1` pasa a llevar la "s") | `suite_39` | *arma la frase, sin inventar plural que no toca* (4 rojas) |
| **#114** | `mtrMapaFrecuenciasPorCodigo` prefiere el renglón MÁS VIEJO en vez del más reciente | `suite_39` | *del histórico completo, el renglón MÁS RECIENTE por código* (2 rojas) |
| **#114** | `mtrMapaFrecuenciasPorNombre` cruza por `codigo` en vez de por `descripcion` (rompe el puente código→nombre) | `suite_39` y `suite_57` | *cruza el histórico (por código) con la formulación vigente* (2 rojas) y *(#114): la frecuencia real llega hasta el texto que ve la IA* (1 roja) |
| **#114 (alcance clínico)** | `mtrEnriquecerAvisosConFrecuencia` cae a `par_farmacos[0]` cuando falta `medicamento_detectado` — justo la fuga que la decisión de alcance prohíbe | `suite_39` | *(#114, alcance): un aviso de INTERACCIÓN (par de clases, sin fármaco literal) NUNCA se enriquece* |
| **#114** | `mtrPanelMedicamentosHtml` pinta `.vgl-tab-frec` SIEMPRE, aunque `frecuenciaTexto` esté vacío | `suite_67` | *(#114): la frecuencia sale junto al nombre SOLO cuando el histórico la trajo* |
| **#114** | `mtrMedicamentosRcv` busca la frecuencia por el nombre CRUDO (`frec.get(nombre)`) en vez de la clave normalizada (`frec.get(clave)`) — rompe mayúsculas/tildes | `suite_39` | *con el mapa de frecuencias, el texto la incluye; sin él, sale IDÉNTICO a como salía antes de #114* |
| **#114** | `mtrAvisosDosisRenal` deja de llamar a `mtrEnriquecerAvisosConFrecuencia` (la costura se calcula pero no se usa) | `suite_39` | *con medicamentosFrecuencia explícito, el aviso sale con la frecuencia puesta* |
| **#114** | `mtrFichaVivaFilas` deja de pasar `r.medicamentosFrecuencia` a `mtrMedicamentosRcv` (el typo que ninguna prueba anterior cazaba) | `suite_15` | *(#114): la frecuencia real llega hasta la fila del medicamento en la Ficha* |
| **#114** | `mtrHojaDesdeResumen` deja de pasar `medicamentosFrecuencia` a `mtrHojaDeHechos` (rompe la tercera pata: redacción con IA) | `suite_57` | *(#114): la frecuencia real llega hasta el texto que ve la IA* |

Dos de las nueve mutaciones (la del puente código→nombre y la del alcance clínico) se
verificaron sobre DOS suites a la vez a propósito: son los dos puntos donde una prueba
unitaria sola no basta — hace falta la costura completa (unitaria + integración) para
que un typo o un descuido de alcance no se cuele en silencio por un solo nivel.

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color)

`.vgl-tab-frec` (el paréntesis con la frecuencia, junto al nombre del medicamento en
«Lo que está tomando») es la única regla de color nueva de #114. Se montó la hoja `<style>`
REAL extraída de `buildOverlay()` (vía el propio arnés de pruebas, no una copia recortada
a mano — 203.219 caracteres, con las cuatro constantes interpoladas incluidas) sobre la
estructura real `#vgl-panel-modal > .vgl-agm-card > .vgl-tab-lista > .vgl-tab-fila >
.vgl-tab-ex > .vgl-tab-frec`, con el CSS agresivo de Everest que exige el proyecto
(`div,span,p,b,small,label{color:#1f4e79 !important}`) cargado antes, en los dos temas:

- **Ningún azul de Everest se coló**: `.vgl-tab-frec` midió `rgb(154,167,186)` en oscuro
  y `rgb(74,90,110)` en claro — los tokens `--fg3` reales, nunca `#1f4e79`.
- **Jerarquía visual correcta**: `.vgl-tab-frec` sale en `font-weight:400` contra los
  `700` de `.vgl-tab-ex` (el nombre), y con un color distinto — se lee como dato
  secundario, no compite con el nombre del fármaco.
- **Contraste, contra el PÍXEL RENDERIZADO** (no el valor declarado — `.vgl-tab-fila`
  usa `background:var(--bg2)`, translúcido, compuesto sobre `.vgl-agm-card`; se
  fotografió la página real con Playwright y se muestreó el píxel de fondo con `sharp`,
  igual que la verificación de #123): **6,31–6,43:1 en tema oscuro** y **5,46–5,49:1 en
  claro** — ambos por encima del 4,5:1 que exige la Regla O.
- **Aviso para la próxima verificación de este tipo**: la primera pasada de este mismo
  muestreo dio un falso rojo (2,0–2,96:1 en claro) porque la foto se tomó ANTES de que
  terminara `vglSpringIn` (la animación de entrada de `.vgl-agm-card`, 0,30 s, que arranca
  en `opacity:0`) — el píxel muestreado era la tarjeta a medio aparecer sobre el fondo de
  la página, no el color final. Se corrigió esperando 600 ms antes de fotografiar. Queda
  anotado aquí porque es la misma clase de trampa que ya mordió al censo de `!important`
  en v15.2.0 (medir algo que parece la señal pero es un artefacto de CUÁNDO se mide).

## v17.1.1 — 21-ago-2026 (en caliente, reportado en pleno consultorio)

Banco antes: 2.210 comprobaciones · después: **2.216**, cobertura **100 % (835/835)**.

Reporte con pantallazos: en «Revisión por sistema y Examen físico» salían «Enfermedad
actual» Y «Auto-Labs» (de otras pestañas); al pasar a «Ruta Crónicos» salía «Normalidad
fija» (de Examen físico) y Auto-Labs — el que SÍ correspondía ahí — no salía. Causa:
`_vglPestanaActiva` buscaba `.active[role="tab"]` sin acotar a ninguna barra, y Ruta
Crónicos trae un segundo tabset suelto (los programas Síndrome Metabólico/Hipertensión/
Diabetes/ERC) con su propia `.active`; cuál ganaba dependía del orden del DOM, no de la
pestaña real. Los conteos de respaldo (cuando la barra no se podía leer) tenían el mismo
defecto por otra vía: contaban ids repetidos en varias pestañas sin mirar si Everest los
había dejado montados-pero-tapados.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **#151** | `_vglPestanaActiva` vuelve a buscar `.active[role="tab"]` sin ancla, documento entero | `suite_64` | *#151 no se confunde con un tabset SUELTO que también trae su propia .active* (toma "decoy" en vez de "pes") |
| **#151** | `hayCasillas`/`nRapido` (Auto-Labs y Normalidad) vuelven a contar por id sin mirar visibilidad real | `suite_15` | *createLabInjectorUI (#151): la misma casilla, pero VISIBLE, sí enciende el botón* |

Verificación: cada mutación se aplicó sobre el archivo de producción, se confirmó la
prueba en rojo, y se restauró antes de seguir — ninguna quedó sin cazar.

### De regalo, mientras se investigaba: el hallazgo real de #114

No es una mutación (no hay comportamiento de producción que tocar todavía — ver
`CHANGELOG.md`), pero queda anotado aquí porque salió de la MISMA sesión de grabación:
`HistoricoMedicamentoHCM?PacienteId=…` (GET, confirmado con cuerpo real tras corregir el
GRABADOR a v3.4.0) trae `frecuenciaNumero` + `frecuenciaUnidad` estructurados por cada
renglón de medicamento — el dato que `CargarMedicamentosPaciente` nunca tuvo. Pendiente
de acordar el alcance antes de tocar el motor de medicamentos.

## v17.1.0 — 21-ago-2026

Banco antes: 2.154 comprobaciones · después: **2.210**, cobertura **100 % (833/833)**.
Las 17 mutaciones se aplicaron una a una sobre el archivo de producción, corriendo solo la
suite correspondiente, restaurando entre cada una. **Ninguna quedó sin cazar.**

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **#146** | `bumpStatCita(...)` → `bumpStat(...)`: se vuelve a contar cada transición en vez de cada cita | `suite_04` | *#146: una cita que oscila de estado se cuenta UNA vez — no una por transición* (2 rojas) |
| **#72** | `apptKey` deja de canonizar la hora a minutos y vuelve al texto crudo | `suite_02` | *apptKey: arma la clave de la cita, con la hora canonizada a minutos* (2 rojas) |
| **#112** | `mtrDuplicidadesTerapeuticas` deja de deduplicar antes de contar | `suite_68` | *el mismo renglón repetido NO es duplicidad — son fórmulas postfechadas* (2 rojas) |
| **#113** | La pestaña Medicamentos vuelve a pintar la lista cruda | `suite_68` | *la pestaña Medicamentos y el «(N)» del Resumen cuentan LO MISMO* |
| **#123** | El rojo por SALTO (≥25 %) se apaga | `suite_67` | *#123 rojo por SALTO: empeorar 25 % o más en un solo control es grave* |
| **#123** | El rojo por VALOR (fuera de meta grave) se apaga | `suite_67` | *#123 rojo por VALOR: fuera de meta grave, aunque no se haya movido* (4 rojas) |
| **#137** | El piso de 14 días deja de ceder ante un examen ya vencido | `suite_24` | *mtrPlanLabsPrimero: con un examen YA VENCIDO el piso de 14 días cede (#137)* |
| **#148** | El campo «dónde» vuelve a pasar por el saneador de mensajes (que se come el nº de línea) | `suite_23` | *reportarError: el número de línea SOBREVIVE al saneado* |
| **#148** | El tope vuelve a gastarse por error en vez de por huella | `suite_23` | *reportarError: el MISMO fallo repetido nueve veces manda UNA sola fila* (2 rojas) |
| **#150** | Annar y Citi vuelven a compartir etiqueta de telemetría | `suite_23` | *_rumEndpointLabel: Annar y Citi NO pueden compartir etiqueta* |
| **#116** | Se invierte la condición del conmutador del acordeón de uroanálisis | `suite_48` | *_uroToggleAcordeon: el primer clic ABRE el panel…* (4 rojas) |
| **#149** | Se quita otra vez el punto y coma de `transition:none !important` | `suite_25` | *Regla P - ninguna declaración !important queda pegada a la siguiente* |
| **#115** | Se quita el `!important` del pie `.vgl-rcv-pie` | `suite_25` | *Regla G - escala tipográfica / censo de !important* |
| **#71** | La fecha vuelve a depender de que exista la casilla de resultado | `suite_08` | *injectLabsIntoCronicos (#71): sin casilla de RESULTADO, la FECHA se escribe igual* |
| **#147** | `citaDetalleHoy` deja de devolver el detalle guardado | `suite_62` | *citaDetalleHoy: devuelve el detalle solo si hay radicado guardado* |
| **#73** | El botón de redacción se pinta siempre, haya casilla o no | `suite_64` | *createIaInjectorUI: no pinta ningún botón si la casilla no está en pantalla* |
| **#126** | Se quita la sincronización del relevo del tick (vuelve a depender de que haya agenda) | `suite_17` | *tick (#126): al RECUPERAR el mando se sincroniza aunque este tick no traiga ni una cita* (2 rojas) |

### Verificación en Chromium real (exigida por CLAUDE.md para toda regla de color)

Las reglas de color nuevas de **#115** y **#123** se midieron con `getComputedStyle` en
Chromium sobre el `<style>` REAL extraído de `buildOverlay()` — no una copia recortada a
mano —, montado con un CSS «Everest» simulado en cuatro niveles de agresividad y en los
dos temas. Resultados:

- **#115**: `.vgl-ord-vigwarn` y los dos `.vgl-rcv-pie` sobreviven al nivel que exige el
  proyecto (`div,span,p,b,small,label{color:#1f4e79 !important}`) y al siguiente. Ya no
  sale `rgb(31,78,121)` en ninguno.
- **#123**: el rojo de la fila grave, su flecha y su motivo salen en `--c-rojo` en los dos
  temas. Contraste WCAG del motivo contra el fondo REAL de la fila (píxel renderizado, no
  el valor declarado): **6,75:1 en tema oscuro** y **6,24:1 en claro** — por encima del
  4,5:1 que exige la Regla O.
- **Regresión**: `.mejora` y `.empeora` idénticas a la v16.8.0 e invariantes. De 64 filas
  generadas, **0** llevan dos clases de color a la vez (la Regla A del banco lo prohíbe).
- **Un defecto propio cazado en esta misma verificación**: el `<b>En rojo</b>` que añadí en
  #123 es un `<b>` SUELTO dentro de `.vgl-rcv-pie`, y el blindaje tipográfico
  `:where(b:not([class])){color:inherit}` no lleva `!important`. Medido: quedaba a **2,21:1**
  en tema oscuro. Es el bug #2 del CLAUDE.md, otra vez. Corregido con una regla propia y
  vuelto a medir: **7,85:1**.

### Nota sobre el censo de `!important`

`suite_25` cuenta los `!important` leyendo el **fuente** entre las líneas del literal de
`buildOverlay`, así que no ve los que aportan las cuatro constantes interpoladas
(`MTR_CSS`, `MTR_RCV_CSS`, `MTR_RCV_CSS_TODOS_LOS_MODALES`, `VGL_UX_CSS`). En la hoja real
son **370**, no 259. El 259 es correcto para lo que la prueba mide, pero **un `!important`
añadido dentro de esas constantes no dispara el contador**. Queda anotado como deuda: el
censo debería correr sobre la hoja generada, no sobre el recorte del fuente.

## v17.6.2 — 22-ago-2026 (desenganches reales + PyM↔Athenea antiduplicado + SMS real)

Banco antes (cierre de v17.6.1): 2.272 comprobaciones · después: **2.297** (25 pruebas
nuevas), cobertura **100 % (849/849)**.

Este es el trabajo pedido en la tanda de hoy: cerrar desenganches donde un módulo no
consumía lo que otro ya produjo (Panel que abría sin laboratorios pese a la pre-carga,
aviso de agendamiento que decía "falta documentar" lo ya documentado, SMS que se cantaba
enviado cuando el proveedor lo rechazaba), el cruce antiduplicado PyM↔Athenea para los
Excel desactualizados (VIH 365 días, SOMF 730 días, Resolución 3280/2018 + decisión del
médico), el CUPS 898015 de citología, el sniffer de UsuarioId en ConfirmarTicket/
FinalizarTicket, la fecha de la HbA1c que quedaba en blanco, y el doble conteo de la
productividad (10→20). Siete mutaciones verificadas, cada una aplicada sobre el archivo
de producción, corrida la suite señalada, confirmado el rojo esperado y restaurada antes
de pasar a la siguiente:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **desenganche Panel** | `mtrCalcularResumenClinico`: la condición de la pre-carga pasa de `!o.fresco &&` a `false &&` (ya nunca sirve `_labsPrefetch`) | `suite_15` | *v17.6.2 — si la pre-carga ya trajo labs frescos de ESTE paciente, los usa SIN volver a golpear Athenea* (esperaba la creatinina de la pre-carga, obtuvo `false`) |
| **aviso agendamiento** | `mtrFactoresConMemoria`: `const mem = (f._leidos…)` se deja en `null` (nunca fusiona el resumen) | `suite_64` | *un factor ya documentado en el resumen cacheado deja de aparecer como faltante* (esperaba `true`, obtuvo `null`) y *el aviso completo del agendamiento queda coherente* (esperaba 0 pendientes, obtuvo 2) |
| **SMS real** | `reenviarSmsRecordatorio` y el envío automático: `if (j && j.error === true)` pasa a `if (false && …)` (el 200 con `error:true` ya no se rechaza) | `suite_62` | *reenviar el mensaje: un 200 con error:true en el cuerpo NO se canta como enviado* (esperaba `false`, obtuvo `true`) |
| **PyM↔Athenea** | `pymPaqueteCubiertoPorAthenea`: `return dias <= pkg.vigenciaDias` pasa a `return false` (nunca da por cubierto) | `suite_08` | *VIH hecho hace 15 días: Athenea manda sobre el Excel desactualizado, no se duplica* (esperaba `true`, obtuvo `false`) y *SOMF hecha hace 2 años exactos: el límite es inclusivo* (esperaba `true`, obtuvo `false`) |
| **sniffer UsuarioId** | `ORIGEN_FIABLE`: `(?:ConfirmarTicket\|FinalizarTicket)` pasa a `(?:ConfirmarTicket\|FinalizarTicketSIN)` (FinalizarTicket ya no es fiable) | `suite_14` | *FinalizarTicket fija el id desde cero* (esperaba `515`, obtuvo `0`) |
| **antiduplicado productividad** | `mtrProdRegistrar`: la fusión `porNombreHora` pasa a `if (nh && false)` (la misma cita con/sin documento ya no se cuelga al mismo hueco) | `suite_68` | *la misma cita vista por API (con doc) y por DOM (sin doc) NO cuenta dos veces* (esperaba 2, obtuvo 4 — el doble conteo 10→20 del reporte) |
| **fecha HbA1c** | `injectLabsIntoCronicos`: se quita el respaldo `\|\| _findLabField(matched.dateId, matched.altDateIds)` de la ruta HBA1C | `suite_08` | *v17.6.2 — HbA1c: con la fecha NO hermana en el .input-group pero SÍ el id-por-convención, la fecha se escribe igual* (esperaba `"2026-08-01"`, obtuvo `""`) |

Todas restauradas; el banco completo volvió a 2.297/2.297 tras la restauración final.
La corrección del banner de "Labs primero" (nota que ahora explica el piso relajado) se
verificó con el motor real (hoy sábado 22-ago → toma lunes 24 → control lunes 31) y no
tiene mutación propia: el texto exacto no está anclado por ninguna prueba existente y la
nueva rama se cubre con la misma prueba de `pisoRelajado` de `suite_24`/`suite_62`.

## v17.6.3 — 22-ago-2026 (la IA dejó de inventar la presión arterial en «Enfermedad actual»)

Banco antes (cierre de v17.6.2): 2.297 comprobaciones · después: **2.298** (1 prueba
nueva), cobertura **100 % (849/849)**.

Reporte del médico en consultorio: la Enfermedad Actual venía con una PA inventada
(p. ej. «PA 110/70»). Raíz: las reglas 5 y 6 de `MTR_EA_SYS` (el system prompt del modo
`enfermedad_actual`) pedían la presión arterial como contenido OBLIGATORIO
incondicional; cuando la TA no está documentada o no se leyó del DOM (`#taSistolicaAcostado`
/ `#taDiastolicaAcostado` vacíos), la hoja de hechos queda sin PA (`mtrHojaDeHechosTexto`
omite la línea) pero el modelo «rellenaba» el vacío con una cifra típica — violando la
regla del proyecto (casilla vacía antes que dato inventado). Se condicionan las reglas 5
y 6 a que el dato ESTÉ en los bloques entregados y PROHIBIDO gana una línea que nombra
explícitamente que inventar cifras de signos vitales no se hace (mismo patrón positivo +
negativo que la corrección de labs/riesgo de v17.3.0). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **PA alucinada** | `MTR_EA_SYS` regla 6: se elimina la cláusula «Si una cifra no está en NINGÚN bloque (p. ej. la presión arterial), NO la escribas — el texto queda sin esa cifra» (la cifra ausente vuelve a quedar sin condición) | `suite_57` | *Enfermedad Actual ya NO exige la PA cuando no viene en los hechos: se omite, no se inventa* (esperaba la condición «si la cifra no está…», obtuvo `false`) |

Restaurada; el banco completo volvió a 2.298/2.298 tras la restauración.

## v17.6.3 — 22-ago-2026 (la nota de «Análisis y plan» sale limpia de markdown basura)

Banco antes (tras la PA alucinada): 2.298 comprobaciones · después: **2.301** (3 pruebas
nuevas), cobertura **100 % (850/850)**.

Reporte del médico: la nota de «Análisis y plan» llegaba con basura markdown del modelo
(p. ej. «====** COCKCROFT-»): negritas `**`, `=` sueltos y cabeceras malformadas, pese a
la regla de texto plano del prompt. Raíz: `MTR_NOTA_SYS` autoriza las cabeceras
`===== SECCIÓN: X =====` y los `::` de ítem, y los modelos flash-lite generalizan de más
(negritas alrededor de las etiquetas, decoración `=` suelta, cabeceras truncadas); el
texto de la respuesta entraba SIN saneamiento a la casilla de la historia clínica. Se
corrige en dos capas: (1) el prompt ahora declara por nombre cuál es la ÚNICA decoración
permitida y prohíbe asteriscos/negritas/backticks (positivo + negativo); (2) defensa en
profundidad: nueva función pura `mtrLimpiarNotaIA` (normaliza cabeceras a la forma
sancionada, elimina `**`/`__`/backticks/enlaces y corridas de `=` basura; nunca inventa ni
borra contenido clínico; el marcador `#PACIENTE_[ID]_#RCV_CONTROL_[AÑO_MES]` sobrevive),
aplicada en el conector `mtrGeminiRedactar` para `analisis_plan` (todos los caminos:
Generar y Generar todo). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **markdown sucio** | `mtrLimpiarNotaIA`: la limpieza de corridas de `=` (`return l.replace(/={2,}/g, "")`) pasa a `return l` (la decoración `=` vuelve a pasar) | `suite_57` | *mtrLimpiarNotaIA: el borrador de la nota sale limpio de markdown (el reporte «====** COCKCROFT-» no puede volver a pasar)* (esperaba sin `=` fuera de cabeceras, obtuvo la línea sucia) |

Restaurada; el banco completo volvió a 2.301/2.301 tras la restauración.

## v17.6.3 — 22-ago-2026 (la lista «toma quedó» del agendamiento deja de duplicarse y desordenarse)

Banco antes (tras el markdown sucio): 2.301 comprobaciones · después: **2.303** (2 pruebas
nuevas), cobertura **100 % (852/852)**.

Reporte del médico: en el agendamiento, la lista «toma quedó» del banner aparecía
duplicada o en desorden. Raíz: el clic en un chip de día de toma hacía
`_bannerSug.innerHTML += …` (línea 19470) SIN quitar la nota anterior — el segundo clic
apilaba otra nota (y el tercero, otra), y las notas quedaban en orden de clic, no de
fecha; el banner sí se repintaba fresco en el otro camino (`_pintarBannerSugerida`), pero
esta rama (control ya elegido a mano) solo acumulaba. Se corrige con la nota bajo un id
FIJO y una función pura `mtrPegarNotaTomaQuedo` que REEMPLAZA la nota anterior a nivel de
cadena (una sola «toma quedó», siempre la del último clic); el handler del chip pasa de
`+=` a esa función. El arnés no simula el DOM del modal, así que el contrato (id estable
+ reemplazo) se prueba en las funciones puras. Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **toma quedó duplicada** | `mtrPegarNotaTomaQuedo`: el reemplazo por id (`bannerHtml.replace(re, "") + nota`) pasa a `bannerHtml + nota` (vuelve a acumular como el `innerHTML +=` viejo) | `suite_62` | *v17.6.3 — la nota «toma quedó» se reemplaza, nunca se acumula (un clic por chip = una sola nota)* (esperaba 1 aparición, obtuvo 2 — el duplicado) |

Restaurada; el banco completo volvió a 2.303/2.303 tras la restauración.

## v17.6.3 — 22-ago-2026 (lote aprobado por el médico: A1 sede única, C2 motivo fijo, meta general de HbA1c)

Banco antes (tras «toma quedó»): 2.303 comprobaciones · después: **2.306** (3 pruebas
nuevas: 1 en `suite_62`, 1 en `suite_57`, 1 en `suite_67`).

Tres decisiones del médico del 22-ago, implementadas con su fuente única y su
mutación verificada:

1. **A1 — sede del laboratorio**: la sede 378 vivía escrita a mano en 5 URLs de AppCita.
   Ahora `mtrSedeIdLab()` es la única fuente (378 de fábrica) y las 5 URLs la usan.
2. **C2 — motivo de consulta**: lo que ve la IA es SIEMPRE «CONTROL DE RIESGO
   CARDIOVASCULAR», aunque la casilla de Everest traiga otra cosa (o PHI). Solo contexto
   del redactor; la casilla del médico jamás se toca.
3. **Meta general de HbA1c (flujo Ajustes → Ficha)**: nueva `mtrMetaHba1cGeneral()`
   lee `S.metaHba1cGeneral` (campo nuevo en Ajustes, 5–12 %); ausente o fuera de rango
   cae a 7,0 (la regla de siempre). La meta individual del paciente (✏️ del Panel,
   `metaHba1cManual`) gana sobre la general.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **sede equivocada** | `mtrSedeIdLab()` pasa de `return 378` a `return 379` (el número deja de ser el de instalación) | `suite_62` | *v17.6.3 — la sede del laboratorio tiene UNA sola fuente (mtrSedeIdLab, 378 de fábrica)* (esperaba 378 y obtuvo 379) |
| **motivo de Everest** | `mtrLeerTextoLibreHistoria`: la asignación `out.motivo = "CONTROL DE RIESGO CARDIOVASCULAR"` se sustituye por la lectura de la casilla `alert_message` de Everest (vuelve el motivo variable/PHI) | `suite_57` | *mtrLeerTextoLibreHistoria: el motivo es SIEMPRE «CONTROL DE RIESGO CARDIOVASCULAR» (decisión C2)…* (esperaba «CONTROL DE RIESGO CARDIOVASCULAR» y obtuvo «») |
| **meta ignorada** | `mtrMetaHba1cGeneral()` pierde la lectura de `S.metaHba1cGeneral` y devuelve fijo `MTR_HBA1C_META_DM2` (la config de Ajustes deja de mandar) | `suite_67` | *v17.6.3 — mtrMetaHba1cGeneral: 7,0 de fábrica; la de Ajustes (5–12) la reemplaza; fuera de rango vuelve a 7,0* (esperaba 7.5 y obtuvo 7) |

Restauradas una a una; `suite_57` (70), `suite_62` (43) y `suite_67` (30) en verde tras
cada restauración.

## v17.6.3 — 22-ago-2026 (lote aprobado 2/2: A2 anti-alucinación, B2 chips, B5 hoja educativa, D1 telemetría, D2 export)

Banco antes (tras el lote 1/2): 2.305 comprobaciones · después: **2.318** (13 pruebas
nuevas: 3 en `suite_57`, 3 en `suite_04`, 2 en `suite_67`, 2 en `suite_68`, 3 en `suite_23`).

Cinco decisiones del médico del 22-ago, cada una con su mutación verificada:

- **A2 — verificador de cifras de la IA**: `mtrVerificarCifrasIA` marca en rojo toda cifra
  de medida del borrador sin respaldo en los hechos entregados (el «PA 110/70» inventado ya
  no pasa callado). Caja roja en el modal, re-evaluada al editar.
- **B2 — aviso único con chips accionables**: cada chip de lab/PyM y el botón «Agendar
  control» abren el panel de órdenes / el agendamiento (`mtrAvisoAccionDe`); sin paciente
  identificado el aviso informa pero no inventa botones muertos.
- **B5 — hoja educativa imprimible**: `mtrHojaEducativaHtml` arma el documento con las
  secciones que el resumen real justifica (alarmas, dieta, actividad, pendientes, meta
  HbA1c, riesgo) y cero datos inventados.
- **D1 — tablero local de telemetría**: `mtrTableroTelemetria` lee la ventana UX local y
  calcula el ABANDONO DEL EMBUDO DE AGENDAMIENTO (abiertos `fn.agendar.open` vs creadas
  `cita.creada.*`); se pinta en el Resumen del turno.
- **D2 — export semanal de productividad**: `mtrProductividadCsvSemana` baja la semana en
  curso a CSV con la misma regla de la vista (un día sin atendidas no cuenta meta en contra).

Verificado como YA implementado (sin cambio de código): A3 (cosecha ya en 33 %,
`MTR_COSECHA_MARGEN_PROP = 0.33`) y A4 (relojes ya unificados a 10 min con la pre-consulta
deliberada a 6 h).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **verificador ciego** | `mtrVerificarCifrasIA`: se retira `if (conocidas.has(r)) return;` (toda cifra de medida se marca, aun las que SÍ estaban en los hechos) | `suite_57` | *mtrVerificarCifrasIA: una PA inventada…* y *…un lab que la IA cambió se marca; el que copió bien no* (esperaba 0 y obtuvo 2 — PA 120/80 y LDL 118 marcadas) |
| **chips muertos** | `mtrAvisoAccionDe()` devuelve fijo `null` (ningún clic dispara acción) | `suite_04` | *mtrAvisoAccionDe: encuentra la acción en el chip y en sus contenedores, y nada fuera* (esperaba «ordenar» y obtuvo null) |
| **alarmas a todos** | `mtrHojaEducativaHtml`: `if (flags.alarmas)` pasa a `if (true)` (la sección de alarmas sale para cualquier paciente) | `suite_67` | *v17.6.3 — mtrHojaEducativaHtml: sin riesgo ni pendientes sigue siendo un documento imprimible (no inventa secciones)* (la sección de alarmas no debía salir) |
| **embudo roto** | `mtrTableroTelemetria`: `cita.creada.*` pasa a la clave exacta `cita.creada` (las creadas dejan de contarse) | `suite_23` | *mtrTableroTelemetria: embudo de agendamiento…* (esperaba 7 creadas y obtuvo 0; abandono 100) |
| **meta en días sin trabajo** | `mtrProductividadCsvSemana`: `if (at > 0)` pasa a `if (true)` (el día sin atendidas mete meta en contra) | `suite_68` | *mtrProductividadCsvSemana: una fila por día + total…* (el martes sin trabajo salía con meta 18) |
| **cuenta atrás en mayúsculas** | `countdownParts`: el texto de la cuenta pasa de `"en "` a `"EN "` | `suite_06` | *countdown calcula tiempo faltante* (esperaba `en 16:00` y obtuvo `EN 16:00`) |
| **latido nunca escrito** | `heartbeat`: la condición del write-condicional pasa a `if (false && …)` (LEADER_KEY jamás se escribe) | `suite_17` | *heartbeat: liderazgo por latido con RELEVO…* — «y deja su latido escrito» (obtuvo false) + otros 6 casos de heartbeat |
| **timer escalonado sin registrar** | `boot()`: se omite `tVerMin` del push a `state.timers` (el chequeo de versión diferido 4 s quedaría fuera del alcance de emergencyTeardown) | — | **Sobrevivió** — `suite_17` verifica solo el intervalo de 5 min y `suite_30` pone `state.timers = [999]` antes del teardown; ninguna prueba comprueba que TODOS los timers de boot queden registrados |

Restauradas una a una; el banco completo volvió a verde tras cada restauración.

## v17.6.3 — 22-ago-2026 (la guardia de ruta acepta la URL real de producción /viva/EverHealth/HCHealth)

Banco de ESTE repositorio antes: 1.894 comprobaciones · después: **1.895** (1 prueba nueva en
`suite_14`). El harness pasa a cargar por defecto con la URL REAL donde el médico ejecuta el
script — `https://neps.everestintelligent.com/viva/EverHealth/HCHealth` — en lugar de la
`/viva/HCHealth/` de la captura original, así que el banco entero valida contra la página
real.

El médico confirmó que la página de trabajo es `.../viva/EverHealth/HCHealth` (con el
segmento `EverHealth/` entre `/viva/` y `HCHealth`). `_enModuloHCHealth()` solo aceptaba
`/\/viva\/HCHealth(\/|$)/`, así que en la página real devolvía `false` y `tick()` ocultaba el
panel por completo (v16.2.2 lo esconde fuera del módulo): el Vigilante no aparecía donde el
médico trabaja. El regex ahora acepta las DOS formas (`/\/viva\/(?:EverHealth\/)?HCHealth(\/|$)/`),
porque el segmento final `HCHealth` identifica el módulo clínico (Citas del día, Historia
Clínica, Órdenes y RCV viven bajo él). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **URL real** | `_enModuloHCHealth`: el regex vuelve a `/\/viva\/HCHealth(\/|$)/` (sin el segmento `EverHealth/` opcional — la forma que rompía en la página real) | `suite_14` | *_enModuloHCHealth: true con la URL real /viva/EverHealth/HCHealth (y sus subrutas)* (esperaba `true` en la Historia Clínica real, obtuvo `false`) |

Aplicada sobre el archivo de producción, corrida `suite_14`, confirmado el rojo con el
mensaje esperado, y restaurada antes de seguir. El banco completo volvió a 1.895/1.895 tras
la restauración.

## v17.6.3 — 22-ago-2026 (el hueco «timer escalonado sin registrar» queda cerrado)

La tabla de v17.6.3 (lote 2/2) documentó una mutación SOBREVIVIENTE: `boot()` omitía
`tVerMin` del push a `state.timers` y ninguna prueba la cazaba — `suite_17` solo verificaba
dos intervalos puntuales por su función y `suite_30` ponía `state.timers = [999]` a mano
antes del teardown. `state.timers` es la lista EXACTA que `emergencyTeardown()` cancela con
el kill-switch; un timer que no esté en ella sigue consultando la red con la interfaz
retirada. Se agrega un caso hermano en `suite_17` (39→40 comprobaciones en la suite) que
exige el registro completo: tras `boot()`, `state.timers` sube en 13 (los diez del push
principal + tSonda + tPymDiario + tPymCaptador) y el handle del chequeo de versión
escalonado (setTimeout 4 s → `checkVersionMinimum`) está entre ellos, por identidad de
objeto. La mutación ahora cae:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **timer escalonado (revisado)** | `boot()`: `state.timers.push(tAutoUpd, tVerMin, …)` vuelve a omitir `tVerMin` (el push baja a 12 handles) | `suite_17` | *boot: TODOS los timers quedan registrados en state.timers (tVerMin incluido)…* (esperaba 13, obtuvo 12) |

Aplicada sobre el archivo de producción, corrida `suite_17`, confirmado el rojo con el
mensaje exacto, y restaurada antes de seguir. El banco completo volvió a 1.896/1.896 tras
la restauración.

## v17.6.3 — 22-ago-2026 (blindaje CSS verificado en Chromium real con el DOM real: kicker/sub del modal IA, botones .sec/.pri y #vgl-head)

Se montó el E2E visual con el DOM REAL (protocolo T8, pero el userscript entero inyectado
en Chromium sobre un fixture de Everest con el CSS hostil por delante; los modales los
construye el propio código vía `__VGL__`). El CSSOM confirmó tres huecos de blindaje sin
regla ganadora frente al hostil (`div,span,p,…{color:#1f4e79 !important}`):

- `#vgl-ia-modal .vgl-agm-kicker` y `.vgl-agm-sub`: el modal IA no estaba en las listas
  ficha/tablero/panel → el título del modal salía en azul Everest.
- `.vgl-agm-btn.sec` y `.vgl-agm-btn.pri`: las reglas base no llevaban la marca → los
  botones salían en azul Everest (el `.pri`, verde sobre fondo, quedaba ilegible).
- `#vgl-head`: no declaraba color → el título del panel salía en azul Everest.

Corregido editando las listas existentes (nunca duplicando selectores): kicker/sub del IA
entran a las listas que ya llevaban la marca (no cambian el censo) y `.sec`/`.pri`/`#vgl-head`
ganan su propia marca (censo 307 → 310; suite_25 actualizada). Re-medido en Chromium real:
modal IA 9/9 campos OK en claro (7.18–17.49:1) y el trío con sus identidades de color por
módulo (azul/morado/verde). Una mutación verificada:

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **botón pri sin marca** | `.vgl-agm-btn.pri`: `color:var(--c-verde) !important` vuelve a `color:var(--c-verde)` (el botón queda expuesto al hostil) | `suite_25` | *Regla G - escala tipográfica / censo de !important* (esperado 310, salió 309) |
| **count del resumen sin marca** | `#vgl-root #vgl-sheet .vgl-count`: `color:var(--fg) !important` vuelve a `color:var(--fg)` (el conteo queda expuesto al hostil de Everest) | `suite_25` | *Regla G - escala tipográfica / censo de !important* (esperado 333, salió 332) |
| **ámbar del reloj apagado** | `actualizarRelojCabecera()`: `c.classList.toggle("vgl-stale", !fresco)` vuelve a `toggle(..., false)` (el reloj nunca avisa que los datos están viejos) | `suite_31` | *el reloj se pone ámbar cuando la última lectura pasa de 30 s* ("debe ponerse ámbar (obtuvo false)") |
| **cronómetro siempre nulo** | `cronometroDe(a)`: se antepone `if (true) return null` (el cronómetro nunca aparece aunque el paciente esté en sala) | `suite_31` | *cronómetro: solo cuenta al paciente en sala* ("debe pintar ⏱ Nm; devolvió null") |

Aplicada sobre el archivo de producción, corrida `suite_25`, confirmado el rojo con el
mensaje exacto, y restaurada antes de seguir. El banco completo volvió a verde tras la
restauración.
| **no-show no suma (v17.6.7)** | _noShowRegistrar: e.total = (e.total || 0) + 1 mutado a + 0 (el historial de inasistencias nunca crece) | suite_31 | *v17.6.7: adherencia registra el no-show sin duplicar* ("el primer no-show queda con total 1: esperaba 1 y obtuvo 0") |
| **festivos sin delegación (v17.6.8)** | esFestivo: eturn mtrEsFestivoCO(...) mutado a eturn false para años fuera de la tabla (2028 queda ciego y el agendamiento citaría en festivo) | suite_69 | *v17.6.8: esFestivo delega al motor calculado* ("1-ene-2028 debe ser festivo (obtuvo false)") |
| **toasts sin agrupar (v17.6.9)** | _agruparToasts: se antepone eturn (lista||[]).slice() (los avisos del mismo paciente vuelven a apilarse) | suite_42 | *v17.6.9: _agruparToasts combina avisos del mismo paciente* ("debe quedar en una sola tarjeta") |

## v17.6.10 — 23-ago-2026 (limpieza final: dead code y claves de Ajustes muertas)

La tarea fue de REMOCIÓN (código sin llamador en producción). La mutación que corresponde
a una remoción es re-agregar lo eliminado y comprobar que ninguna prueba cae: si cayera,
el código no estaba muerto. Que la mutación SOBREVIVA es el resultado esperado y queda
documentado aquí como evidencia de que nada depende de ese código.

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~30966 (v17.6.10) | Se re-agregó `mtrPartirNota` (retirada en esta versión por no tener llamador; suite_57 dejó de probarla) | SÍ (esperado) | Ninguna: suite_57 quedó en 72/72 con la función de vuelta. Confirma que era código muerto y que retirar su prueba era correcto. |

Se restauró de inmediato (borrada otra vez) y suite_57 volvió a verde antes de cerrar la
versión. El banco completo al cierre: **1.908 comprobaciones, 0 en rojo** (1919 en 17.6.9;
−11 casos de prueba retirados junto con el código muerto que probaban).

## v17.6.11 — 23-ago-2026 (Redacción IA S+: contador de palabras)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~32024 (v17.6.11) | `mtrContarPalabrasTexto` mutada a `return 0` (el contador del borrador nunca reporta palabras) | NO | Ninguna: la prueba *v17.6.11: el contador de palabras del borrador nunca miente ni revienta* (suite_57) cayó a rojo como se esperaba. Restaurada de inmediato; suite_57 volvió a 73/73. |

Mutación aplicada sobre el archivo de producción, corrida suite_57, confirmado el rojo con la
aserción esperada, y restaurada antes de cerrar la versión. El banco completo quedó en verde
con las suites presentes en este equipo (44 suites, 1.408 comprobaciones).

## v17.6.12 — 23-ago-2026 (Redacción IA, 2ª tanda S+: poda de memoria del texto previo)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~31322 (v17.6.12) | `_vglTextoPrevioPodar` mutada a `const sobra = 0` (la poda nunca recorta: el mapa de textos previos crecería sin límite en sesiones largas) | NO | Ninguna: la prueba *v17.6.12: _vglTextoPrevioPodar recorta a tope y conserva los más recientes* (suite_57) cayó a rojo como se esperaba. Restaurada de inmediato; suite_57 volvió a 75/75. |

Mutación aplicada sobre el archivo de producción, corrida suite_57 (74 ok + 1 rojo con la
aserción esperada), restaurada y confirmado el verde antes de cerrar la versión. El banco
completo quedó en verde con las suites presentes en este equipo (44 suites, **1.410
comprobaciones**, +2 por los casos nuevos de la poda).

## v17.6.13 — 23-ago-2026 (Auditoría S+ del Agendamiento: 5 hallazgos, 5 mutaciones)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~19672 (v17.6.13) | `if (esSugerida)` vuelto a `if (esSugerida \|\| (!_preseleccion && idx === 0))` (la preselección de madrugada sin sugerencia reaparece) | NO | Ninguna: *v17.6.13: sin sugerencia clínica, NINGÚN turno nace activo* (suite_15) cayó a rojo. Restaurada; suite_15 volvió a 144/144. |
| ~19683 (v17.6.13) | Quitado el reset `confirmBtn.dataset.dupOk/vencOk` del clic de turno (cambiar de turno conservaba la marca del aviso visto) | NO | Ninguna: *v17.6.13: cambiar de turno reinicia la doble confirmación* (suite_15) cayó a rojo. Restaurada de inmediato. |
| ~19358 (v17.6.13) | Quitado `_vglCelularSinDatos()` de la rama de datos incompletos (el celular vuelve a quedarse en "cargando…" con SMS tildado) | NO | Ninguna: *v17.6.13: si Everest no devuelve los datos del paciente...* (suite_15) cayó a rojo. Restaurada de inmediato. |
| ~18824 (v17.6.13) | Quitado `aria-current="step"` del indicador inicial del stepper | NO | Ninguna: *v17.6.13: accesibilidad del modal — aria-live... y aria-current* (suite_15) cayó a rojo. Restaurada de inmediato. |
| ~19618 (v17.6.13) | `marcaNoRecomendado` forzado a `""` (la razón del cupo desaconsejado vuelve a vivir solo en el tooltip) | NO | Ninguna: *v17.6.13: el cupo desaconsejado se ve usable...* (suite_15) cayó a rojo. Restaurada de inmediato. |

Las 5 mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada
una antes de la siguiente), cada corrida dejó suite_15 en 143 ok + 1 rojo con la aserción
esperada, y se confirmó el verde (144/144) al restaurar. El banco completo al cierre:
**1.416 comprobaciones, 0 en rojo** (44 suites presentes, +6 casos nuevos en suite_15).

## v17.6.14 — 23-ago-2026 (Telemetría S+: beacon con acuse, memoria acotada, backoff y URL ofuscada)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~8001 (v17.6.14) | Quitado el backoff de `reportar()` (vuelve el flush inmediato: cada evento reintenta contra un panel caído, hasta 20 s de timeout por intento) | NO | Ninguna: *v17.6.14: reportar con el panel caído hace backoff* (suite_23) cayó a rojo. Restaurada; suite_23 volvió a verde. |
| ~8430 (v17.6.14) | Quitada la guarda de acuse fresco de `_vaciarTelemetriaAlSalir` (el beacon vuelve a retirar evidencia sin acuse: panel caído/token rotado = fila perdida en silencio) | NO | Ninguna: *v17.6.14: _vaciarTelemetriaAlSalir SIN acuse fresco NO retira evidencia* (suite_23) cayó a rojo. Restaurada de inmediato. |
| ~8109 (v17.6.14) | `_errVistos.add(huella)` incondicional (el Set vuelve a crecer sin tope: la memoria ya no está acotada a 40 huellas) | NO | Ninguna: *v17.6.14: reportarError no deja crecer la memoria de huellas por encima del techo* (suite_23) cayó a rojo, y también la prueba vieja del techo por huella (ahora 41 filas). Restaurada de inmediato. |
| ~10800 (v17.6.14) | `localStorage.setItem("vgl_api_url", abs)` (la URL con el profesionalId vuelve a dormir en claro, legible para scripts del host) | NO | Ninguna: las aserciones de ofuscación de suite_19 (2 casos) cayeron a rojo. Restaurada de inmediato. |

Las 4 mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada
una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se confirmó el
verde al restaurar. El banco completo al cierre: **1.424 comprobaciones, 0 en rojo** (44
suites presentes; +7 casos en suite_23, +1 en suite_19, y suites 13/19 ajustadas a la URL
ofuscada).

## v17.6.15 — 24-ago-2026 (Agenda S+: aviso honesto de lectura ciega fuera de Citas del día)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~24073 (v17.6.15) | Guarda del aviso forzada a `if (false && leader && ...)` (el Vigilante vuelve a quedar ciego en silencio, sin avisar que no tiene lectura de la agenda) | NO | Ninguna: *tick: sin API sano y fuera de agenda/historia (pero dentro de HCHealth), avisa UNA vez que está ciego* (suite_17) cayó a rojo. Restaurada de inmediato; suite_17 volvió a 41/41. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. Una prueba preexistente de suite_17
("...sin volver a notificar") se ajustó (filtro por título en vez de contador global) porque
el mismo escenario que prueba ahora dispara, LEGÍTIMAMENTE, el nuevo aviso honesto —
ver CHANGELOG.md v17.6.15. El banco completo al cierre: **1.425 comprobaciones, 0 en
rojo** (44 suites presentes; +1 caso nuevo en suite_17).

## v17.6.16 — 24-ago-2026 (Agenda S+: la URL de agenda ya no se abandona por fallos pasajeros)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~11026 (v17.6.16) | Reintroducido `if (API.fallos >= 3) purgarApiUrl(...)` en la rama catch de `apiLeerAgenda` (la URL vuelve a olvidarse tras 3 fallos seguidos) | NO | Ninguna: *apiEspera/apiUtil: una racha larga de fallos NO purga la URL — solo se enfría (v17.6.16)* (suite_13) cayó a rojo. Restaurada de inmediato; suite_13 volvió a 60/60. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. La prueba preexistente que verificaba el
purgado a los 3 fallos (v12.3.7) se reescribió para verificar el comportamiento nuevo
(sobrevive una racha larga, entra al enfriamiento de 5 min de `apiUtil()`, y se recupera
sola sin volver a "Citas del día") — ver CHANGELOG.md v17.6.16. El banco completo al
cierre: **1.425 comprobaciones, 0 en rojo** (44 suites presentes).

## v17.6.18 — 24-ago-2026 (Panel del paciente S+: el aviso al abrir la historia vuelve a ser solo informativo)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~10028 (v17.6.18) | Reinsertado el botón `📅 Agendar control` en `avisoUniversal` (el aviso vuelve a mostrar acciones) | NO | Ninguna: *avisoUniversal: los chips son informativos (spans), sin botones de acción (v17.6.18)* (suite_04) cayó a rojo. Restaurada de inmediato; suite_04 volvió a 192/192. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. Se retiraron, sin dejar rastro: los dos
botones de acción del aviso, la conversión de los chips en botones (`data-aviso-accion`),
la delegación de clics asociada, el helper puro `mtrAvisoAccionDe` (ya sin llamador) y su
prueba dedicada, y el parámetro `apt`/`_aptAviso` que solo existía para esas acciones —
ver CHANGELOG.md v17.6.18. El banco completo al cierre: **1.423 comprobaciones, 0 en
rojo** (44 suites presentes; -2 casos consolidados en 1 en suite_04, -1 prueba de la
función eliminada).

## v17.6.19 — 24-ago-2026 (Bienestar/Turno: se retiran 4 funciones sin uso real en consultorio)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~12368 (v17.6.19) | Reinsertadas las 2 reglas CSS `.vgl-cd.vgl-cron` (3 `!important`) que el cronómetro dejó al retirarse | NO | Ninguna: *Regla G - escala tipográfica...* (suite_25, censo de `!important`) cayó a rojo (esperaba 347, salió 350). Restaurada de inmediato; suite_25 volvió a 15/15. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. Los otros 3 retiros (Regla 20-20-20,
Sugerir fecha de control, Botón de fin de turno) no tenían prueba dedicada que los
protegiera (los cuatro estaban APAGADOS por defecto, sin cobertura propia) — se verificó
su retiro completo por lectura: sin llamadores huérfanos, sin referencias a `S.ojos`/
`S.ojosMin`/`S.seguimiento`/`S.resumenFin` en el resto del archivo ni en tests/. El banco
completo al cierre: **1.423 comprobaciones, 0 en rojo** (44 suites presentes; censo de
suite_25 ajustado de 350 a 347 y su comentario actualizado).

## v17.6.20 — 24-ago-2026 (Telemetria corregida + se retiran Espera prolongada y Pausa activa)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~19049 (v17.6.20) | Quitado `if (!_fnCompletado) uxTrack("fn.agendar.abandon")` del closeMod real de `openAgendamientoModal` (el embudo vuelve a quedarse sin su propio abandono) | NO | Ninguna: *embudo de Agendamiento: cerrar sin crear cita cuenta como abandono de SU PROPIO embudo* (suite_23, nueva) Y la prueba genérica *embudo: todo modal con fn.X.open tiene tambien su fn.X.complete y su fn.X.abandon* cayeron a rojo. Restaurada de inmediato; suite_23 volvió a 91/91. |
| ~12368 — revisado, no reaplicado (ver v17.6.19) | (mutación de la limpieza de Espera prolongada/Pausa activa) | — | Sin prueba dedicada que proteja estos dos retiros (estaban APAGADOS de fábrica, sin cobertura propia, igual que los 3 de v17.6.19) — se verificó el retiro completo por lectura: cero referencias a `S.pausas`/`S.escalada`/`state.pacienteDesde`/`state.escaladoAvisados`/`state.pausaProx`/`state.ojosProx` en el resto del archivo ni en tests/. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con la aserción
esperada, y se confirmó el verde al restaurar. El banco completo al cierre: **1.424
comprobaciones, 0 en rojo** (44 suites presentes; +2 casos en suite_23: la contaminación
cruzada de embudos y el embudo propio de Agendamiento).

## v17.6.21 — 24-ago-2026 (Agenda S+: debounce contra el parpadeo de estado entre fuentes)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~9450 (v17.6.21) | Quitado el bloque de debounce completo en `colorAndAlert` (`stRaw`/`st` vuelven a ser siempre la lectura cruda, sin confirmación de dos ticks) | NO | Ninguna: *un solo parpadeo... queda absorbido* Y *la MISMA lectura repetida dos veces seguidas SÍ se confirma* (suite_04, ambas nuevas) cayeron a rojo. Restaurada de inmediato; suite_04 volvió a 194/194. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con las dos
aserciones esperadas, y se confirmó el verde al restaurar. Diagnosticado a partir de un
CSV real de auditoría que el médico adjuntó (sin PHI copiado a este repositorio ni a
código/pruebas: el patrón se verificó leyendo el CSV, nunca se persistió nombre ni
documento de paciente). El banco completo al cierre: **1.426 comprobaciones, 0 en rojo**
(44 suites presentes; +2 casos nuevos en suite_04).

## v17.6.22 — 24-ago-2026 (Redactor IA: borradores incompletos avisados, contexto ya no queda obsoleto)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~30900 (v17.6.22) | `mtrEstadoBorrador` devuelto a un único mensaje fijo, sin distinguir MAX_TOKENS | NO | Ninguna: *mtrEstadoBorrador: MAX_TOKENS avisa honestamente...* (suite_57) cayó a rojo. Restaurada; suite_57 volvió a 78/78. |
| ~32031 (v17.6.22) | `libreAhora` vuelto a envolver una foto única (`const libre = mtrLeerTextoLibreHistoria(); libreAhora = () => libre`) — reintroduce la foto vieja por una vía indirecta | NO | Ninguna: *el panel de redacción ya NO congela el texto libre...* (suite_57, aserción por texto fuente) cayó a rojo. Restaurada de inmediato. |
| ~32395 (v17.6.22) | Uno de los DOS disparadores de generación (botón «Generar») vuelto a `contextoLibre: ""` — regresión PARCIAL, solo un sitio | NO | Ninguna: la misma aserción de conteo (`usos === 2`) cayó a rojo al bajar a 1. Restaurada de inmediato. |

Tres mutaciones aplicadas sobre el archivo de producción, UNA A LA VEZ (restaurando cada
una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. Se refactorizó `_estadoBorrador` (cierre interno del
modal, sin llamador aislable) a `mtrEstadoBorrador` (función pura de nivel superior) para
poder protegerla con una prueba directa, sin reconstruir el modal completo — mismo
criterio de diseño testeable que ya usa el resto del módulo. El fix del contexto obsoleto
se protege por aserción de texto fuente (mismo patrón ya establecido en este archivo para
"uxTrack no arrastra texto clínico"): no hay una unidad aislable para probar "se lee en el
momento del clic" sin reconstruir el modal completo de 600 líneas. El banco completo al
cierre: **1.429 comprobaciones, 0 en rojo** (44 suites presentes; +3 casos nuevos en
suite_57).

## v17.6.23 — 24-ago-2026 (Redactor IA: se ataca la causa raiz del truncamiento, no solo el aviso)

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~31106-31107 (v17.6.23) | `maxOutputTokens` devuelto de 8192 a 2048 en ambas ramas de `cuerpoPara` | NO | Ninguna: dos pruebas de suite_57 ("tope de salida 8192..." y "el tope de salida NO se recorta... v17.6.23") cayeron a rojo. Restaurada de inmediato; suite_57 volvió a 78/78. |

Mutación aplicada sobre el archivo de producción, corrida dejó rojo con ambas
aserciones esperadas, y se confirmó el verde al restaurar. Corrección directa sobre
v17.6.22 (mismo día): el médico aceptó el aviso honesto pero pidió la causa raíz —
se conservan AMBOS (el aviso como red de seguridad, el tope subido como arreglo real). El
banco completo al cierre: **1.429 comprobaciones, 0 en rojo** (44 suites presentes; 0
casos nuevos, 2 aserciones existentes actualizadas al nuevo valor).

## v17.6.24-25 — 24-ago-2026 (Redactor IA — Bloque A de la auditoría S+ de 20 bugs: botón «Preguntar» y datos que se perdían)

Primer bloque de una auditoría multi-agente de 20 hallazgos confirmados sobre la
Redacción Asistida (IA), pedida por el médico tras revisarlos ("hay botones de más").
Se implementa **por bloques, con pausa de revisión entre cada uno** (pedido explícito del
médico) — este es el Bloque A, correcciones aisladas sin dependencias.

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~13400 (v17.6.24) | Borrada la regla CSS `.vgl-agm-btn.sec.active` completa | NO | Ninguna: *v17.6.24: el botón «Preguntar» tiene una regla CSS .active* (suite_57) Y *Regla G — censo de `!important`* (suite_25, esperaba 349, salió 347) cayeron a rojo. Restaurada de inmediato; ambas suites volvieron a verde. |
| ~32016 (v17.6.25) | `const datos = Object.assign({}, mtrDatosExtraLeer(docId) \|\| {});` vuelto a `const datos = {};` (el Guardar de «➕ Datos del paciente» vuelve a reemplazar el almacén en vez de fusionar) | NO | Ninguna: *v17.6.25: «Datos del paciente» fusiona con lo ya guardado, no lo reemplaza* (suite_57) cayó a rojo. Restaurada de inmediato; suite_57 volvió a verde. |

Las dos mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando
cada una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. El bug de v17.6.24 no tiene una unidad aislable (el toggle
de `.active` vive dentro del handler delegado de clic del modal de 600 líneas) — se
protege por texto fuente, mismo criterio ya establecido en este archivo para "uxTrack no
arrastra texto clínico" y el contexto obsoleto de v17.6.22. El de v17.6.25 igual: el
handler de Guardar vive dentro de `mtrAbrirDatosAdicionales`, que construye un modal real
con `document.createElement`/`querySelector` sobre subárboles que el DOM de prueba de
este arnés no soporta (`elem.querySelector()` siempre devuelve `null`, ver
`tests/harness.js`) — reconstruir el modal completo para aislar el clic no es viable, así
que se protege igual por texto fuente. El banco completo al cierre: **1.431
comprobaciones, 0 en rojo** (44 suites presentes; +2 casos nuevos en suite_57, censo de
suite_25 ajustado de 347 a 349).

## v17.6.26 — 24-ago-2026 (Redactor IA — se retira «Datos del paciente» por redundante, el estilo se aprende solo, texto interno fuera de pantalla)

Seguimiento inmediato al Bloque A: el médico revisó el resumen y pidió tres cosas más
antes de seguir con la rotación de modelos. **Esta versión SUPERSEDE el parche de
v17.6.25**: en vez de arreglar el bug de fusión de `mtrAbrirDatosAdicionales`, se retira
la función completa (con su bug incluido) por ser una superficie redundante con
"Indicaciones" — la mutación de v17.6.25 documentada arriba ya no aplica porque el código
que protegía ya no existe; queda en el historial como evidencia de que el bug era real
antes de decidir eliminar la superficie en vez de parchearla.

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~31970 (v17.6.26) | Reinsertados `function mtrAbrirDatosAdicionales(x){}` y una referencia fantasma a `"vgl-ia-datos-btn"` al final del archivo | NO | Ninguna: *v17.6.26: «➕ Datos del paciente» se retiró por completo* (suite_57) cayó a rojo. Restaurada de inmediato; suite_57 volvió a verde. |
| ~32473 (v17.6.26) | `_autoAprenderEstilo`: el umbral `delta === "intacta"` mutado a `delta === "reescritura"` (guardaría como ejemplo de estilo justo los textos que el médico tuvo que reescribir) | NO | Ninguna: *v17.6.26: el guardado de estilo es automático* (suite_57) cayó a rojo. Restaurada de inmediato. |
| ~30827 (v17.6.26) | `mtrRedaccionPrompt`: reinsertado el interruptor `o.usarEstilo &&` en el cálculo de `ejemplos` | NO | Ninguna: DOS pruebas cayeron a rojo: el guardia de código fuente (*v17.6.26: el guardado de estilo es automático*, `t.falso(/o\.usarEstilo/...)`) Y la de comportamiento (*los ejemplos de estilo se inyectan automáticamente, sin ningún interruptor*). Restaurada de inmediato; suite_57 volvió a verde. |

Las tres mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando
cada una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. Los tres textos de interfaz corregidos (aviso de
privacidad del Redactor, tooltip de "Hoja educativa", dos criterios de clasificación de
riesgo) son cambios de contenido de texto sin lógica que mutar — se verificaron por
lectura: ninguno de los tres conserva la referencia a fecha/decisión interna, y el
contenido clínico (qué se envía a Gemini, por qué el piso de diabetes/edad aplica) quedó
intacto. El banco completo al cierre: **1.432 comprobaciones, 0 en rojo** (44 suites
presentes; +2 casos nuevos en suite_57 netos: se agregaron 4 y se retiró 1 obsoleto de
v17.6.25 más el ajuste de 2 pruebas existentes a las 3 claves restantes de
`MTR_DATOS_EXTRA_ETIQUETAS`).

## v17.6.27 — 24-ago-2026 (Barrido S+ total — Bloque S1, parte 1/2: 4 bugs críticos)

Primer lote de la auditoría exhaustiva línea por línea de las 33.869 líneas del archivo
(48 agentes: 14 lectores por segmento + 6 transversales, verificación adversarial de cada
hallazgo). 8 hallazgos S1 confirmados en total; estos 4 primeros.

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~1517 (v17.6.27) | `_resumenClinicoUro`: la rama sin patología vuelta al literal fijo `chips.push("Límpido", "Leucocitos (-)", "Nitritos (-)")` (se quita la derivación de valores reales) | NO | Ninguna: *v17.6.27: \_resumenClinicoUro NUNCA inventa chips fijos* (suite_08) cayó a rojo. Restaurada de inmediato; suite_08 volvió a verde. |
| ~4479 (v17.6.27) | `_vglCosecharFactoresVisibles`: `mapa` vuelto a `{}` (se quita la fusión con lo ya archivado) | NO | Ninguna: *v17.6.27: la cosecha de factores por pestaña SE ACUMULA* (suite_32) cayó a rojo. Restaurada de inmediato; suite_32 volvió a verde. |
| ~3765 (v17.6.27) | `_vigenciaDiasParaAnalito`: `if (typeof v === "number") base = v;` vuelto a `return v;` (reintroduce el retorno temprano que hacía inalcanzable aplicar50) | NO | Ninguna: *v17.6.27: aplicar50 SÍ se aplica cuando hay programa/estadio* (suite_28, caso HTA/LDL numérico) cayó a rojo. Restaurada de inmediato. |
| ~6362 y ~6374 (v17.6.27) | `_habiaConfigPrevia` movida de vuelta a después de las 4 migraciones anteriores, y la marca `vgl_v1420_estreno` vuelta a depender de `_habiaConfigPrevia` (reintroduce ambas capas del bug) | NO | Ninguna: *v17.6.27: instalación LIMPIA (sin vgl_cfg previo) NO enciende las 4 banderas de estreno* (suite_09) cayó a rojo. Restaurada de inmediato; suite_09 volvió a verde. |

Las cuatro mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando
cada una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. El banco completo al cierre: **1.439 comprobaciones, 0 en
rojo** (44 suites presentes; +9 casos nuevos entre suite_08/09/28/32).

## v17.6.28 — 24-ago-2026 (Barrido S+ total — Bloque S1, parte 2/2: 4 bugs críticos, cierra el bloque)

Segunda y última parte del Bloque S1 (8/8 críticos corregidos y verificados).

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| ~19797 (v17.6.28) | `cargarHorasLab`: la guarda `if (!resAgEx \|\| !resAgEx.ok)` mutada a `if (false)` (nunca detecta la falta de respuesta) | NO | Ninguna: *v17.6.28: cargarHorasLab y cargarHorasLabSolo usan gmPostJsonEx* (suite_15) cayó a rojo. Restaurada de inmediato; suite_15 volvió a verde. |
| ~28481 (v17.6.28) | `mtrAvisosFarmacologicos`: reintroducido `\|\| base.motivo === "SIN_FUNCION_RENAL"` en la guarda de corte temprano (vuelve a silenciar las interacciones sin CG) | NO | Ninguna: *v17.6.28: sin Cockcroft-Gault, las interacciones farmacológicas SÍ se evalúan* (suite_39) cayó a rojo. Restaurada de inmediato; suite_39 volvió a verde. |
| ~2206 (v17.6.28) | `atheneaCredsSet`: reintroducidas las 4 escrituras en claro (GM y localStorage de `vgl_ath_user`/`vgl_ath_pass`) | NO | Ninguna: *v17.6.28: atheneaCredsSet NO deja ninguna copia en claro* (suite_18) cayó a rojo. Restaurada de inmediato; suite_18 volvió a verde. |
| ~20774 (v17.6.28) | La notificación de cita creada vuelta a "SMS de recordatorio enviado al X." (afirmación de entrega confirmada) | NO | Ninguna: *v17.6.28: la notificación de cita creada ya NO afirma que el SMS se entregó* (suite_15) cayó a rojo. Restaurada de inmediato. |

Las cuatro mutaciones se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando
cada una antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. El banco completo al cierre: **1.447 comprobaciones, 0 en
rojo** (44 suites presentes; +8 casos nuevos entre suite_15/18/39). Con esto se cierra el
Bloque S1 completo (8/8 hallazgos críticos del barrido total corregidos y verificados).

## v17.6.29 — 24-ago-2026 (Barrido S+ total — Bloque Eliminar: código muerto verificado)

Remoción de 13 funciones/variables sin ningún llamador. Igual que v17.6.10 (mismo criterio
del proyecto): la mutación que corresponde a una remoción es re-agregar lo eliminado y
comprobar que NINGUNA prueba cae — que la mutación SOBREVIVA es el resultado esperado y
la evidencia de que el código en verdad estaba muerto. Antes de retirar cada una se hizo
grep exhaustivo en `vigilante_agenda.user.js` Y en `tests/*.js` (no solo producción, que es
lo único que había revisado el barrido automático): 5 candidatos iniciales del barrido
(`mtrPrincipioEnTexto`, el modelo de grupos de sábado 1-3/2-4 completo, `extractAgrupador`,
`apiHcValidacionExamenCronicos`/`_base64SinRelleno`) resultaron tener pruebas dedicadas
reales — SOBREVIVIERON el grep de tests y se descartaron de esta limpieza.

| Función/variable retirada | Verificación | ¿Sobrevivió el banco? |
|---|---|---|
| `mtrSumarDiasHabiles`, `mtrCnoHDL` | grep producción+tests: 0 llamadores | SÍ — banco sin cambios (1447/1447) |
| `_relojEstadoParaTest`, `_relojAjustarParaTest`, `_getUltimoRelevoParaTest` | grep producción+tests: 0 llamadores (se conservó `_setUltimoRelevoParaTest`, que SÍ tiene test) | SÍ |
| `_vglAvisoContextoFaltante`/`_vglContextoAvisado` | grep producción+tests: 0 llamadores; reemplazada por `_vglTextoContextoFaltante` (viva) | SÍ |
| `mtrItemSugeridoEnRango` | grep producción+tests: 0 llamadores; duplicado del GAP 1 ya resuelto por `_marcarPlazoSegunSugerida` | SÍ |
| `openFichaPacienteModal` | grep producción+tests: 0 llamadores (su comentario afirmaba falsamente lo contrario) | SÍ |
| `openRiesgoModal`, `mtrRenderRiesgoModalHtml`, `mtrRenderResumenClinicoHtml`, `mtrIaClickDelegado` + su registro en `boot()` | grep producción+tests: 0 llamadores reales (solo comentarios/documentación); el botón `#vgl-ia-redactar` que el listener buscaba solo lo pintaba la propia cadena muerta | SÍ |
| `estadioParaDosis` (propiedad de `calcularEstadioRenal`) + `posAdmin`/`posClinico` | grep producción+tests: 0 lectores; condición tautológica | SÍ |
| `lastAutoFetchedDoc` (variable, 2 escrituras) | grep producción+tests: nunca leída desde v17.0.3 | SÍ — y se corrigió de paso el reset de sesión de Athenea, que apuntaba a la variable muerta en vez de a `lastAutoFetchedAt` (la guarda real): el robot podía no reintentar tras revivir la sesión |

El banco completo al cierre: **1.447 comprobaciones, 0 en rojo** (mismo número que antes de
la limpieza — ninguna prueba dependía de este código). 957 → 944 funciones registradas en
`__VGL__`. ~333 líneas netas retiradas.

## v17.6.30 — 24-ago-2026 (Barrido S+ total — Bloque Editar, 1/62: negación simple en el cotejo de fuentes)

Banco antes: 1.449 comprobaciones (con las 4 pruebas nuevas ya sumadas antes de la
mutación) · después de restaurar: **1.450**.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`mtrTextoOpinaSobre`** | La lista de negaciones reconocidas vuelve a `/\b(niega\|no refiere\|sin antecedente\|descarta\|no presenta\|no tiene\|nunca ha)\b/` (se quita `no es\|no fue\|no fuma\|no consume\|no padece\|no usa\|no ha`) | `suite_01` | *v17.6.30: mtrTextoOpinaSobre reconoce la negación simple 'no + verbo'…* → *'no fuma' debe negar, no afirmar: esperaba false y obtuvo true* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.450/1.450 tras la restauración.

Nota sobre el primer intento de esta prueba: el caso original usaba "No es diabético…"
contra el regex real de `diabetes` (`textoSi: /\bdiabet|\bdm2?\b|\bdmid\b|insulinorrequir/i`),
que no matchea por la tilde de "diabético" (`\bdiabet` exige la `e` sin acento) — un
defecto distinto, no relacionado con esta negación, y fuera del alcance de este ítem. Se
cambió el ejemplo de prueba a HTA (`hipertens`, sin tildes en el radical) para no mezclar
ambos hallazgos; el problema de tildes se corrigió aparte en v17.6.31.

## v17.6.31 — 24-ago-2026 (hallazgo colateral de v17.6.30: tildes en el cotejo de fuentes)

Banco antes: 1.451 comprobaciones (con la prueba nueva ya sumada antes de la mutación) ·
después de restaurar: **1.451** (sin cambio — la mutación no agrega pruebas, solo prueba
la ya escrita).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`mtrTextoOpinaSobre`** | El filtro inicial vuelve a `if (!re.test(frase)) continue;` (prueba el patrón contra la frase CRUDA, con tildes, en vez de contra `f`, la versión ya sin tildes) | `suite_01` | *v17.6.31: mtrTextoOpinaSobre reconoce el hecho aunque la frase real lleve tilde y el patrón no* → *'no es diabético' debe negar…: esperaba false y obtuvo null* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.451/1.451 tras la restauración.

## v17.6.32 — 24-ago-2026 (Barrido S+ total — Bloque Editar: trato de usted, consistente en toda la interfaz)

Banco antes: 1.452 (con la prueba nueva ya sumada) · después de restaurar: **1.452**.
Diez sitios de texto (`avisarSiActualizado`, `chequearAutoUpdateLento`, el aviso de lista
de prevención demasiado grande, la caída de descarga de SharePoint, los dos "pruebe con
.csv", `testNotifications` ×2, el tooltip de fuente de laboratorios, y los dos avisos de
Ajustes) tuteaban al médico; se corrigieron los diez a usted y se protegieron con una
única prueba de fuente (source-regex) que exige la ausencia de las 12 formas de tuteo Y
la presencia de las 12 formas de usted — mismo patrón que la prueba de SMS de v17.6.28 en
`suite_15`.

## v17.6.33 — 24-ago-2026 (Barrido S+ total — Bloque Editar: el celular del paciente ya no queda completo en la consola)

Banco antes: 1.454 (con las 2 pruebas nuevas ya sumadas) · después de restaurar: **1.454**.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`_mtrCelularMascarado`** | El cuerpo vuelve a `return String(cel \|\| "");` (sin enmascarar) | `suite_15` | *v17.6.33: \_mtrCelularMascarado conserva solo los últimos 2 dígitos del celular* → *número real: prefijo + máscara + últimos 2: esperaba "300****67" y obtuvo "3001234567"* |
| **cableado** | El sitio de `reenviarSmsRecordatorio` vuelve a pasar `cel` crudo en vez de `_mtrCelularMascarado(cel)` | `suite_15` | *v17.6.33: los 3 registros de consola del flujo de SMS ya no exponen el celular completo* → *ya no debe quedar el celular crudo en los otros 2 registros (obtuvo true)* |

Ambas se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada una antes
de la siguiente), cada corrida dejó rojo con la aserción esperada, y se confirmó el verde
al restaurar. El banco completo volvió a 1.454/1.454 tras la restauración final.

## v17.6.34 — 24-ago-2026 (Barrido S+ total — Bloque Editar: un error de la IA ya no llega en inglés al médico)

Banco antes: 1.455 (con la prueba nueva ya sumada) · después de restaurar: **1.455**.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`mtrRespuestaGemini`** | El motivo genérico vuelve a `"API: " + detalleCrudo` (el mensaje crudo de la API, en inglés) | `suite_57` | *v17.6.34: un error de la API de Gemini nunca llega crudo (en inglés) al médico* → *el mensaje crudo de Google no debe llegar al motivo visible (obtuvo true)* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.455/1.455 tras la restauración.

## v17.6.35 — 24-ago-2026 (Barrido S+ total — Bloque Editar: el contador del Redactor ya no se congela tras la primera generación)

Banco antes: 1.456 (con la prueba nueva ya sumada) · después de restaurar: **1.456**.
`_pintarMeta` vive dentro del cierre de `mtrAbrirPanelRedaccion` (no es una unidad
aislable) — se protege por texto fuente, mismo criterio ya establecido en el banco.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`_pintarMeta`** | `escapeHtml(_ultimoModelo)` vuelto a `esc(_ultimoModelo)` (la función inexistente original) | `suite_57` | *v17.6.35: \_pintarMeta usa escapeHtml (el helper real), no el inexistente esc()* → *ya no debe quedar la llamada a esc(), que no existe (obtuvo true)* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.456/1.456 tras la restauración.

Nota de depuración: el primer intento de esta prueba usaba una ventana de recorte
(`slice`) de 700 caracteres desde el inicio de `_pintarMeta`, pero la llamada real a
`escapeHtml` está a 785 caracteres — la prueba fallaba por ventana corta, no por el
código (mismo tipo de error ya documentado en v17.6.28 con `mtrPanelMedicamentosHtml`).
Ampliada a 1000 caracteres.

## v17.6.36 — 24-ago-2026 (se identifica y corrige la causa raíz del aviso falso "hay borrador sin pegar")

Banco antes: 1.457 (con la prueba nueva ya sumada) · después de restaurar: **1.457**.
Esta es la causa raíz del PRIMER reporte de bug de toda esta auditoría (el que la abrió).
El snapshot de cambio de chip vive dentro del cierre de `mtrAbrirPanelRedaccion` (no es
una unidad aislable) — se protege por texto fuente, mismo criterio ya establecido en el
banco.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **snapshot de cambio de chip** | `Object.assign({}, _borradores[modoAnterior], {...})` vuelto a `{ texto: ..., original: ..., estado: ... }` (objeto nuevo, sin fusionar) | `suite_57` | *v17.6.36: el cambio de chip preserva la bandera insertado (no la pisa con un objeto nuevo)* → *ya no debe crear un objeto nuevo que pierda las banderas existentes (obtuvo true)* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.457/1.457 tras la restauración.

Nota de depuración: el primer intento de esta prueba usaba una ventana de 900 caracteres
desde `let modoAnterior = modo;`, pero el bloque real (con el comentario nuevo de la
versión) llega a 1.445 caracteres antes de la línea del fix — ampliada a 1.700.

## v17.6.37 — 24-ago-2026 (Barrido S+ total — Bloque Editar: un intento fallido de generar ya no pisa la casilla equivocada)

Banco antes: 1.458 (con la prueba nueva ya sumada) · después de restaurar: **1.458**.
Vive dentro del cierre de `mtrAbrirPanelRedaccion` — se protege por texto fuente.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **guardado por modo** | La rama de fallo vuelve a escribir directo en `salida.value`/`estado.textContent` sin pasar por `_borradores[modoGen]` | `suite_57` | *v17.6.37: la rama de fallo de Generar respeta el mismo guardia modoGen === modo que la de éxito* → *el resultado de fallo se guarda bajo SU modo, igual que el de éxito (obtuvo false)* |
| **guardia de pintado** | Se quita el `if (modoGen === modo)` alrededor de la pintura en pantalla (vuelve a pintar siempre, sin comprobar el chip activo) | `suite_57` | misma prueba → *solo pinta la pantalla si el chip activo sigue siendo el que generó (obtuvo false)* |

Ambas se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada una antes
de la siguiente), cada corrida dejó rojo con la aserción esperada, y se confirmó el verde
al restaurar. El banco completo volvió a 1.458/1.458 tras la restauración final.

## v17.6.38 — 24-ago-2026 (Barrido S+ total — Bloque Editar: "Generar" y "Generar todo" ya no pueden correr al mismo tiempo)

Banco antes: 1.459 (con la prueba nueva ya sumada) · después de restaurar: **1.459**.
Vive dentro del cierre de `mtrAbrirPanelRedaccion` — se protege por texto fuente.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **candado de Generar → Generar todo** | Se quita `if (btnTodo) btnTodo.disabled = true/false` de ambos lados del `await` en el handler de "Generar" (vuelve a solo deshabilitar btnGen) | `suite_57` | *v17.6.38: Generar también deshabilita Generar todo mientras está en vuelo (candado en ambos sentidos)* → *al arrancar, deshabilita también Generar todo (obtuvo false)* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.459/1.459 tras la restauración.

## v17.6.39 — 24-ago-2026 (Barrido S+ total — Bloque Editar: la lista de prevención de hoy ya no se confunde con la de anoche)

Banco antes: 1.460 (con la prueba nueva ya sumada) · después de restaurar: **1.460**.
Máquina de pruebas confirmada en `America/Bogota` (UTC-5): la prueba reproduce el bug
real descrito por la auditoría, no una construcción teórica.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`pickTodaysFile`** | La regla 2 vuelve a comparar el string UTC crudo (`f.TimeLastModified.startsWith(todayStr)`) en vez de reducir ambos lados a fecha LOCAL con `todayStamp(new Date(...))` | `suite_03` | *v17.6.39: un archivo modificado anoche (hora local, tarde) NO se confunde con el de hoy, aunque su UTC ya sea de hoy* → *el archivo es de AYER en hora local: no debe tomarse como el de hoy: esperaba null y obtuvo {...}* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.460/1.460 tras la restauración. `todayStamp` gana un parámetro opcional (compatible
hacia atrás: los 100 llamadores existentes en producción siguen sin argumentos) para
poder reducir CUALQUIER instante a fecha local, no solo "ahora".

## v17.6.40 — 24-ago-2026 (Barrido S+ total — Bloque Editar: el modo oculto ahora esconde todo, sin excepciones)

Banco antes: 1.461 (con la prueba nueva ya sumada) · después de restaurar: **1.461**.
Cambio de CSS puro (sin lógica que mutar en el sentido de comportamiento JS) — la
"mutación" es quitar los 7 selectores nuevos de la regla y confirmar que la prueba de
fuente cae, igual que cualquier otro cambio de texto/CSS protegido por regex de este banco.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **regla `body.vgl-modo-oculto`** | Se quitan los 7 selectores nuevos (`#vgl-confirma-modal`, `#vgl-llenar-modal`, `#vgl-min-bar`, `#vgl-deshacer-llenado`, `#vgl-deshacer-lote`, `#vgl-ia-inj-ea`, `#vgl-ia-inj-an`) de la regla `display:none !important` | `suite_15` | *v17.6.40: el modo oculto (privacidad de pantalla) esconde los 7 elementos que faltaban* → *#vgl-confirma-modal debe esconderse en modo oculto (obtuvo false)* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.461/1.461 tras la restauración.

Nota de depuración: el primer intento de esta prueba falló con "fs is not defined" — a
diferencia de otras suites, `suite_15_interfaz_avanzada.js` no importa `fs`/`path` a
nivel de módulo; cada caso que los necesita los requiere localmente (mismo patrón ya
documentado en v17.6.28). Corregido agregando los `require` locales al caso nuevo.

## v17.6.41 — 24-ago-2026 (Barrido S+ total — Bloque Editar: la franja de color de los avisos ya no queda invisible)

Banco antes: 1.464 (con las 3 pruebas nuevas ya sumadas) · después de restaurar: **1.464**.
Contexto: un workflow de 15 agentes verificó ~68 hallazgos restantes del barrido, pero
por un error de directorio de trabajo los agentes auditaron un checkout DISTINTO del
script (`E:\Vigilante_Agenda\vigilante_agenda.user.js`, rama `claude/v17-6-10-23ago`, NO
el worktree `pr94-descarga` donde vive todo este trabajo) — sus números de línea y
fragmentos de código no son de fiar. Cada hallazgo se re-verificó a mano contra el
archivo real antes de tocar nada; este fue el primero.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`.vgl-toast-rail`** | Se quita la regla base nueva (`width:4px;...`) | `suite_25` | *v17.6.41: .vgl-toast-rail tiene una regla base real...* → *no debe depender solo del inline style de color (obtuvo false)* |
| **`.vgl-toast-ic`** | Se reintroduce el `box-shadow:var(--glow-edge)` duplicado al final del bloque | `suite_25` | *v17.6.41: .vgl-toast-ic ya no pisa su propio anillo...* → *esperaba 1 y obtuvo 2* |
| **`.vgl-toast-b`** | Se reintroduce el `font-size:12.5px;` duplicado al inicio del bloque | `suite_25` | *v17.6.41: .vgl-toast-b ya no declara font-size dos veces* → *esperaba 1 y obtuvo 2* |

Las tres se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada una
antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se confirmó el
verde al restaurar. El banco completo volvió a 1.464/1.464 tras la restauración final.

## v17.6.42 — 24-ago-2026 (el censor de nombres ahora sí cubre las MAYÚSCULAS SOSTENIDAS de Everest)

Banco antes: 1.465 (con la prueba nueva de cableado ya sumada; la de `mtrSanearTextoLibreAI`
en mayúsculas se agregó DENTRO de un `t.caso` ya existente, así que no suma al total de
"comprobaciones" que cuenta por `t.caso`, no por aserción individual) · después de
restaurar: **1.465**.

Contexto: hallazgo id=53 del re-triaje del workflow de 15 agentes, marcado por el propio
agente como "el hallazgo MÁS crítico de este clúster (fuga real de PII hacia un proveedor
externo)". Verificado a mano contra este worktree (no el checkout equivocado que auditó
el workflow): el propio código ya documentaba el diseño correcto desde v15.2.0 como
"pendiente de decisión del médico" — pasar el nombre real del paciente abierto y tacharlo
literalmente, en vez de adivinar por la forma de la palabra.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`mtrSanearTextoLibreAI` — núcleo** | Se quita por completo el bloque que tacha los tokens del nombre real | `suite_57` | *(dentro de "v16.5.0 — el rediseño del modal...")* → *el nombre de pila, en mayúsculas sostenidas, se tacha (obtuvo true)* |
| **cableado — `resumen._nombrePaciente`** | Se quita `resumen._nombrePaciente = (apt && apt.nombre) \|\| null;` | `suite_57` | *v17.6.42: resumen.\_nombrePaciente se arma y llega...* → *el resumen del paciente debe traer su nombre real (obtuvo false)* |
| **cableado — `mtrEstiloGuardar`** | La llamada vuelve a `mtrEstiloGuardar(salida.value)` sin el nombre | `suite_57` | misma prueba → *el aprendizaje automático de estilo también debe sanear con el nombre real antes de guardar (obtuvo false)* |

Las tres se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada una
antes de la siguiente), cada corrida dejó rojo con la aserción esperada, y se confirmó el
verde al restaurar. El banco completo volvió a 1.465/1.465 tras la restauración final. Los
otros dos puntos de cableado (`libreAhora()` y los dos objetos `opts` de Generar/Generar
todo) quedan cubiertos por la misma prueba de fuente pero no se mutaron uno a uno por ser
idéntico patrón mecánico (pasar una variable ya probada) repetido cuatro veces.

## v17.6.43 — 24-ago-2026 (un resultado de laboratorio en 0 ya no se muestra ni se procesa como "sin dato")

Banco antes: 1.465 (con las 3 pruebas nuevas ya sumadas) · después de restaurar: **1.465
con las 3 nuevas** = 1.468. Hallazgo id=11 del re-triaje, extendido: el mismo patrón de
bug (`a || b || c`, donde un `0` real cae al siguiente término por ser falsy) se encontró
en CUATRO sitios, no solo el citado por el hallazgo original — dos de ellos
(`mtrHallazgosUroDesdeLabs`) con consecuencia clínica real (un hallazgo negativo real se
perdía en vez de registrarse), verificados a mano contra este worktree.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`_agruparUroanalisisParaTabla`** | Vuelve a `c.Resultado \|\| c.resultado \|\| c.valor \|\| "—"` | `suite_15` | *v17.6.43: \_agruparUroanalisisParaTabla conserva un resultado real de 0* → *Hematíes=0 debe sobrevivir como 0, no como '—': esperaba 0 y obtuvo "—"* |
| **tabla general de Laboratorios** | Vuelve a `lab.Resultado \|\| lab.resultado \|\| lab.valor \|\| lab.Valor \|\| "—"` | `suite_15` | *v17.6.43: la tabla general del modal de Laboratorios conserva...* → *ya no debe quedar el encadenado \|\| crudo (obtuvo true)* |
| **`mtrHallazgosUroDesdeLabs`** (2 sitios idénticos) | Ambos vuelven a `lab.Resultado \|\| lab.resultado \|\| lab.valor` | `suite_15` | *v17.6.43: mtrHallazgosUroDesdeLabs no pierde un resultado real de 0* → *debe reconocer hallazgos reales, aunque los dos sean 0 (obtuvo false)* |

Las cuatro se aplicaron sobre el archivo de producción UNA A LA VEZ (restaurando cada una
antes de la siguiente — los dos sitios de `mtrHallazgosUroDesdeLabs` se mutaron juntos,
por ser el mismo patrón repetido), cada corrida dejó rojo con la aserción esperada, y se
confirmó el verde al restaurar. El banco completo volvió a 1.468/1.468 tras la
restauración final. Dos ocurrencias más del mismo patrón (líneas de diagnóstico
`console.log`, sin consecuencia clínica ni de pantalla) se dejaron intactas a propósito,
fuera del alcance de este hallazgo.

## v17.6.44 — 24-ago-2026 (la regla de triglicéridos altos para el LDL ya reconoce comas decimales y desigualdades)

Banco antes: 1.468 (con las 4 pruebas nuevas, tras corregir un caso límite en la propia
prueba — ver nota de depuración abajo) · después de restaurar: **1.471**. Hallazgo id=12
del re-triaje, verificado a mano contra este worktree.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`_resolverLdlPorTrigliceridos`** | Vuelve a `Number(trigliceridos.resultVal)`/`Number.isFinite(Number(c.resultVal))` en vez de `_labNumerico` | `suite_08` | *v17.6.44: ... reconoce TG>400 aunque venga con coma decimal* y *... con desigualdad ('> 450')* → ambas caen (esperaban el LDL directo, obtuvieron el calculado) |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo en las DOS pruebas afectadas con el mensaje esperado, y se restauró. El banco
completo volvió a 1.471/1.471 tras la restauración.

Nota de depuración: el primer intento de la prueba de desigualdad usaba `"> 400"` como
texto de triglicéridos, esperando que activara la regla — pero `_labNumerico("> 400")`
descarta el símbolo ">" y devuelve exactamente `400` (no "más de 400"), y la regla exige
`tg > 400` estricto: `400 > 400` es falso. El texto "> 400" del LIS, tomado literalmente
como número, cae justo en el borde donde la regla NO se activa — un caso límite genuino,
no un defecto de `_labNumerico` ni de la regla (la fórmula real solo se invalida
clínicamente por ENCIMA de 400, no en el borde). Se cambió el valor de prueba a `"> 450"`,
claramente por encima del umbral, para probar el reconocimiento de la desigualdad sin
tropezar con esa ambigüedad de frontera.

## v17.6.45 — 24-ago-2026 (Auto-Labs ya no anuncia como escrito un resultado que el navegador rechazó)

Banco antes: 1.471 (con las 2 pruebas nuevas ya sumadas) · después de restaurar: **1.473**.
Hallazgo id=13 del re-triaje, extendido a un segundo sitio hermano (el reintento de
uroanálisis) que el hallazgo original también señalaba.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **camino sérico principal** | Vuelve a `setNgValue(inputEl, resultVal); count++;` (sin comprobar el retorno) | `suite_08` | *v17.6.45: injectLabsIntoCronicos NO cuenta un resultado que el navegador rechazó...* → *esperaba 0 y obtuvo 1* |
| **reintento de uroanálisis** | Vuelve a `if (actual === "") { setNgValue(el, r.resultVal); escritas++; }` | `suite_08` | *v17.6.45: el reintento de casillas de uroanálisis también comprueba...* → *debe exigir que setNgValue haya devuelto true (obtuvo false)* |

La primera se probó con DOM real (una casilla mock cuyo `value` rechaza cualquier
asignación, simulando un `type="number"` descartando "1,2"); la segunda —dentro de un
`setTimeout`, no aislable— se protege por texto fuente. Ambas se aplicaron sobre el
archivo de producción UNA A LA VEZ (restaurando cada una antes de la siguiente), cada
corrida dejó rojo con la aserción esperada, y se confirmó el verde al restaurar. El banco
completo volvió a 1.473/1.473 tras la restauración final.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **`avisarSiActualizado`** (representativa de los 10 — misma prueba cubre las otras 9) | `Ya tiene la última versión` vuelto a `Ya tienes la última versión` | `suite_15` | *v17.6.32: los avisos de actualización, SharePoint y accesibilidad tratan al médico de usted, no de tú* → *no debe quedar tuteo: /Ya tienes la última versión/ (obtuvo true)* |

Se aplicó sobre el archivo de producción, se corrió el banco completo, se confirmó el
rojo con el mensaje exacto esperado, y se restauró. El banco completo volvió a
1.452/1.452 tras la restauración. Las otras 9 correcciones no se mutaron una a una por ser
la misma clase de cambio (texto sin lógica) verificado por la misma prueba en bucle sobre
las 12 formas; cualquier regresión futura en cualquiera de los 10 sitios hace caer esta
misma prueba.

## v17.56.0 — 29-ago-2026 (reconciliación del banco con la producción REAL del gist)

El workspace se sincronizó con la v17.56.0 del gist público (fuente de verdad, traída
íntegra) y el banco se reconcilió contra el código REAL: 13 pruebas documentaban contratos
intermedios que producción ya había cambiado (PR #101 y las decisiones del 28/29-ago). Cada
contrato nuevo que se portó a las pruebas se mutó para confirmar que la prueba mide algo
real y no es un no-op.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **rojo de tendencias (v17.55.0)** | `_mtrTendUmbralGrave` vuelto a `const factor = 1.3` (revive el +30 %) | `suite_67` | *#123 rojo por VALOR* → *131 con meta 116 ya está sobre la meta: rojo en riesgo bajo también* (esperaba "grave", obtuvo null) y *#123: HbA1c usa la meta del paciente...* → *9,2 con meta individual de 8,0 está sobre ella* (esperaba "grave", obtuvo null) |
| **chips PyM en la tarjeta (v17.22.0)** | `pymsVisibles = pymsPanel.slice(0, 0)` (amputa los chips otra vez) | `suite_15` | *render: ... los chips PyM volvieron en v17.22.0* → *el chip de PyM pendiente vuelve a la tarjeta*; *T4/v14.0.2 + v17.22.0...* → *la fila de chips PyM volvió*; *v14.0.2 + v17.22.0...* → *y muestra el chip PyM del paciente* (las tres obtuvieron false) |
| **mensaje de labs sin lectura (v17.8.1)** | la rama `_noSePudoLeer` vuelta al texto viejo «No se encontraron paraclínicos recientes» | `suite_15` | *openLaboratoriosModal (v17.8.1): sin poder leer el portal...* → *el fallo fue del sistema: se dice como tal (obtuvo false)* |
| **botón del modal de órdenes sin lista (v17.16.0)** | el confirm vuelto a «Sin actividades para ordenar» siempre (sin distinguir «No hay lista que consultar») | `suite_15` | *openOrdenamientoModal: sin coincidencia PyM...* → *y el botón no invita a ordenar nada (antes decía 'Sin actividades'...) (obtuvo false)* |
| **claves muertas del banner (v17.19.0)** | `bannerPym: false` revivido en DEFAULTS | `suite_15` | *v15 (v17.19.0): el bloque T7 se retiró entero...* → *la clave del banner ya no existe en los ajustes (esperaba undefined y obtuvo false)* |

Cada mutación se aplicó sobre el archivo de producción UNA A LA VEZ (restaurando antes de
pasar a la siguiente), se corrió la suite afectada con el filtro del runner, se confirmó el
rojo con la aserción esperada, y se restauró. El banco completo quedó en **2.295/2.295**
tras la restauración final.

## v17.58.0 — 29-ago-2026 (PARTE A: la escalera de adherencia del reconciliador)

Decisión del médico (29-ago): cuando un eje está en falla terapéutica y el examen se va a
repetir, el script pregunta en orden 1) ¿tiene tratamiento? 2) ¿es adecuado? 3) ¿adherencia?
— indagando antes en la historia (medicamentos RCV, inercia de la estatina) y preguntando
solo lo que no deduce. Las preguntas son de severidad MEDIA: se muestran en el cuadro del
reconciliador pero NO bloquean («el médico manda»), se ofrecen UNA vez por paciente y por
jornada (memoria `_mtrMediaPreguntadas`, limpiada en `diaNuevo`), y la adherencia caduca a
1 día (se conversa en cada consulta). La suite 63 pasó de 30 a 41 casos.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **escalón 1 (tratamiento)** | en `mtrDebePreguntarTratamientoEje` se retira el «indagó y SÍ tiene: no pregunta» (siempre pregunta) | `suite_63` | *compuertas de la escalera* → *con estatina en la historia ya no se pregunta (obtuvo true)* |
| **escalón 2 (adecuación)** | en `mtrDebePreguntarAdecuacionEje` se retira el «si la dedujo, no pregunta» (siempre pregunta) | `suite_63` | *compuertas de la escalera* → *LDL: la inercia ya la deduce (inadecuado) (obtuvo true)* |
| **escalón 3 (adherencia)** | en `mtrDebePreguntarAdherenciaEje` se retira el «respondida y vigente -> se calla» (siempre pregunta) | `suite_63` | *compuertas de la escalera* → *respondida y vigente -> se calla (obtuvo true)* |
| **caducidad de la adherencia** | en `mtrReconciliarAhora` se deja la clave de adherencia vencida en `confEje` (no se borra) | `suite_63` | *la adherencia caduca* → *pero la adherencia de hace 3 días CADUCÓ: se vuelve a preguntar (obtuvo false)* |
| **eje de la glicemia** | en `mtrEjesEnFallaAdherencia` se retira `a === "Glicemia"` (la glicemia ya no comparte la escalera de diabetes) | `suite_63` | *mtrEjesEnFallaAdherencia* → *glicemia sola también es eje de diabetes: esperaba "hba1c" y obtuvo ""* |
| **vigencia declarada** | en `mtrPreguntaAdherenciaEje` se retira `vigenciaDias: MTR_ADHERENCIA_VIGENCIA_DIAS` | `suite_63` | *las preguntas de la escalera* → *y la adherencia declara su vigencia de 1 día (esperaba 1 y obtuvo undefined)* |
| **memoria de lo ya preguntado** | en `_mtrMediaMarcarPreguntada` se retira `s.add(clave)` (la marca no se guarda) | `suite_63` | *memoria de lo ya preguntado* → *marcado -> ya fue preguntada (obtuvo false)* y *las MEDIA ya mostradas NO reaparecen* → *2ª apertura ... NO reaparecen (obtuvo true)* |
| **media que vuelven a bloquear** | en `_vglModalConfirmarDatos` el `listo` vuelve a `!pendientes.size` (las MEDIA retienen el flujo) | `suite_63` | *RECONCILIADOR de punta a punta* (regresión existente) → *y el módulo se abrió solo, sin volver a preguntar (obtuvo false)* |
| **marcar lo renderizado** | en `_vglModalConfirmarDatos` se retira el `_mtrMediaMarcarPreguntada` al pintar las filas | `suite_63` | *las MEDIA ya mostradas NO reaparecen* → *2ª apertura: las MEDIA ya mostradas NO reaparecen (obtuvo true)* |
| **reinicio diario** | en `diaNuevo()` se retira el `_mtrMediaPreguntadas.clear()` | `suite_63` | *diaNuevo reinicia la memoria* → *al día siguiente se vuelve a ofrecer (obtuvo true)* |

Las 10 mutaciones se aplicaron UNA A LA VEZ sobre el archivo de producción, se corrió
`node tests/runner.js 63` con `TZ=America/Bogota`, se confirmó el rojo con la aserción
esperada y se restauró cada una antes de pasar a la siguiente. El banco completo quedó en
**2.306/2.306** tras la restauración final (antes de la Parte A: 2.295 — la suite 63 ganó
11 casos).

## v12.10.13 (TABLERO/Codigo.gs) — 29-ago-2026: reparación de la telemetría contra el export real

Auditoría del XLSX/CSV reales subidos por el médico (9 hojas, 43.634 filas en `uso_detalle`).
Dos fallas ESTRUCTURALES del lado del receptor (Apps Script no corre en el banco; se
verificaron con una reproducción standalone en Node de `doPost` + `repararEncabezadosTelemetria`
sobre el estado REAL de la hoja, el mismo patrón que ya usaba la v12.10.12):

1. **Hoja `uso` desalineada** — 10.290/10.327 filas (99,6 %): la migración de v12.6.9 añadió
   `lote` al FINAL del encabezado (col 10) mientras las filas lo escriben en la col 6. El
   total `n` y el JSON de `acciones` quedaron desplazados una columna y el acumulado de UX
   del tablero de flota se leyó como 0 para todo equipo. Mutación verificada: con el
   encabezado ROTO (el real), un `post("ux")` nuevo escribe `lote` bajo la columna `deDia`;
   tras `repararEncabezadosTelemetria()`, el mismo envío cae en su columna por nombre
   (`lote`, `deDia`, `desde`, `n`, `acciones`), con `n` recalculado por el servidor (no
   confía en el cliente) y `ver` con apóstrofo.
2. **`ver` corrompida como fecha** — 523/777 en `error`, 1.142/10.327 en `uso`, 63/155 en
   `entorno`: "14.2.2001" (era 14.2.1), seriales "36755.0". El apóstrofo de `_celdaVersion`
   y `_forzarTextoColumnaVer` no están en el desplegado; hay que redesplegar y correr el
   menú «Reparar columna 'ver' corrupta en fecha» (ya existía).
3. **Hoja `resumen`** — la fila 1 la ocupaba un encabezado viejo de armarResumen (cols 1-11)
   y el encabezado real quedó corrido a las cols 12-22. Mutación verificada: tras la
   reparación, la fila 1 es el encabezado canónico y los datos (cols 1-11) quedan etiquetados.

La reproducción standalone confirmó: reparación idempotente (dos corridas = mismo resultado),
datos no movidos (solo se reescribe la fila 1) y los envíos posteriores alineados por nombre
de columna (`_appendFila`). El banco de JS del userscript no cambió (2.306/2.306).

## v17.58.1 — 29-ago-2026 (rendimiento: se reutiliza la respuesta de BuscarCitasDisponibles en el salto al día con agenda propia)

Salió de la auditoría de telemetría del export real (misma tanda que la v12.10.13):
`citasDisponibles` es el endpoint más pesado de la flota (promedio ~4,7 s, 450-825
llamadas/día en la ventana real). El flujo «el día elegido solo tiene agenda ajena» lo
consultaba DOS veces seguidas para el MISMO (fecha, especialidad): la búsqueda
(`_buscarDiaConAgendaPropia`) traía la respuesta del día al que iba a saltar y luego
`cargarHoras()` re-consultaba ese mismo día (~9 s de espera antes de pintar turnos).

Arreglo: `_buscarDiaConAgendaPropia` ahora devuelve `{ item, res }` con la respuesta cruda;
el llamador la pasa a `cargarHoras(resAgendasCrudas)`, que la reutiliza si es un objeto con
agendas y cae a la consulta real ante números (viejos llamadores `cargarHoras(m, d)`), null,
la marca `__sinRespuesta` o una respuesta sin agendas. El sondeo de días en segundo plano se
conserva intacto (sigue consultando cada día una vez).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **reaprovechamiento del salto** | en el llamador se vuelve a `cargarHoras()` sin pasarle `otroDia.res` (re-consulta el día encontrado) | `suite_15` | *openAgendamientoModal v17.58.1: el salto al día con agenda propia NO re-consulta BuscarCitasDisponibles — el día elegido se trae 2 veces (búsqueda + sondeo), nunca 3* → máximo por día 3 y el sábado elegido con 3 (esperaba 2) |

La mutación se aplicó una sola vez, se corrió `TZ=America/Bogota node tests/runner.js 15`,
se confirmó el rojo exacto en la aserción de conteo (el sábado elegido pasa de 2 a 3
llamadas) y se restauró. El banco completo quedó en **2.307/2.307** tras la restauración
(la suite 15 ganó 1 caso: 161 → 162).

## v17.58.2 — 29-ago-2026 (telemetría OBLIGATORIA + INP de la UI con atribución)

Dos encargos del dueño en la misma tanda:

1. **Política de telemetría** (decisión explícita del dueño, 29-ago): «necesito que la
   telemetría esté encendida por defecto y no se pueda desactivar, es el precio de pagar
   por usar el script gratis». `DEFAULTS.reporte`/`uxTelemetria` pasan a `true` y, sobre
   todo, **S los fuerza a `true` en cada arranque** (ni una config guardada con `false`,
   ni una edición manual de `vgl_cfg`, ni la migración de estreno los apagan). Los dos
   interruptores de Ajustes se retiraron (se muestra «siempre activa» como información
   fija). Se actualizaron las suites 09, 11, 23 y 31, que verificaban el viejo Default-off.
2. **INP de la UI** (2.740 `rum.self.inp.poor` + 2.497 `needs_imp` en el export real, sin
   decir qué interacción): (a) el INP ahora se reporta CON atribución
   (`rum.self.inp.detalle.<etiqueta>.<cubeta>`, catálogo fijo de `_rageEtiqueta`) para que
   el próximo export diga qué botón; (b) el render de turnos y los chips de día/labs se
   montan en lote (`append(...)` = una sola actualización de árbol) en vez de un
   `appendChild` por nodo; (c) los handlers de apertura, chip de día y especialidad del
   modal anotan su fase con `_rumTramo` («agm.abrir», «agm.clickDia», «agm.clickEsp») en
   el Diario de Lentitud — la infraestructura que la v17.6.78 dejó documentada como lista
   pero sin llamadores.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **forzado de la política** | se retiran `S.reporte = true; S.uxTelemetria = true;` (una config guardada con `false` vuelve a ganar) | `suite_31` | *Telemetría: nace ENCENDIDA por política del dueño (v17.58.2); el forzado gana a una config guardada con false* → `el forzado gana a una config guardada con reporte=false (obtuvo false)` |
| **atribución del INP** | se retira el `uxTrack("rum.self.inp.detalle…")` dentro del observer de eventos | `suite_23` | *_iniciarRumObserver: la interacción lenta se atribuye por el ELEMENTO que el médico tocó* → `el INP malo nuestro dice qué botón: agm-btn: esperaba 1 y obtuvo undefined` |
| **render en lote** | en el render de turnos se vuelve a `slotsEl.appendChild(btn)` por turno (además del lote) | `suite_23` | *v17.58.2: los handlers … se montan en lote (INP)* → `y no queda un appendChild por turno (obtuvo true)` |
| **fase del Diario de Lentitud** | en el handler del chip de día se vuelve a `cargarHoras()` a secas (sin `_rumTramo`) | `suite_23` | *v17.58.2: los handlers … anotan su fase con _rumTramo (INP)* → `el clic en un chip de día anota su fase (agm.clickDia) (obtuvo false)` |

Las 4 mutaciones se aplicaron UNA a la vez, se corrió la suite señalada con
`TZ=America/Bogota`, se confirmó el rojo exacto y se restauró cada una antes de la
siguiente. El banco completo quedó en **2.308/2.308** tras la restauración final
(suite_23 ganó 1 caso; suite_09/11/31 se actualizaron a la nueva política sin cambiar su
número de casos). El harness ganó `append(...)` en el DOM falso (lo imita el render en
lote); la doc de política quedó en `docs/TELEMETRIA.md`.
