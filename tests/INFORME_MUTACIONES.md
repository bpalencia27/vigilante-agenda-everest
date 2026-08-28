# Informe de mutaciones verificadas

> Cada fila es una prueba que se **rompió a propósito** y se comprobó que una prueba
> concreta se pone roja, se restauró, y se confirmó que el banco vuelve a verde.
> La disciplina está en `CLAUDE.md`: *todo cambio de comportamiento requiere mutación
> verificada*. Una prueba que no cae cuando el código se rompe no está probando nada — y
> este proyecto ya se llevó nueve sustos con pruebas que reportaban verde sin ejecutar.

## v17.38.0 — 28-ago-2026 (corrección del médico: el botón es ESTÁTICO, no sigue el scroll por JS)

Corrección directa sobre v17.37.0, la misma tarde: "yo no te pedí que siguiera el scroll,
te pedí que sea un botón estático debajo del botón de historial y paquetes de Everest". Se
retira `_cwReposicionarEnScroll`/`_cwInstalarEscuchaScroll` por completo. La causa de fondo
identificada esta vez: los tres widgets usaban `position:fixed` (coordenadas de VENTANA,
que por diseño del navegador nunca se mueven con el scroll de la página) — la única forma
de "seguir" al botón real era recalcular todo por JS, exactamente lo que el médico acaba de
rechazar. Cambiado a `position:absolute` (coordenadas de PÁGINA): el navegador desplaza el
widget junto con el resto del contenido de forma nativa, sin ningún JavaScript de por
medio — genuinamente estático respecto a "Historial"/"Paquetes", que es lo que se pidió.
`_cwCoordX`/`_cwCoordY` solo suman el `pageXOffset`/`pageYOffset` actual al rectángulo que
ya devuelve `getBoundingClientRect()`.

Un cambio de comportamiento verificado con mutación. Restaurado y verificado con `diff`
contra copia intacta. Banco completo en verde: **2577/2577** (suite_71 sola: 77/77).

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Quitar `_cwCoordX()`/`_cwCoordY()` de la posición del botón (vuelve a ignorar el desplazamiento de la página) | *con la página desplazada, la posición usa coordenadas absolutas — no solo lo visible* (suite_71) |

## v17.37.0 — 28-ago-2026 (reporte en vivo: el widget sigue el scroll, y el botón deja de agregar hemograma)

Dos defectos reales, reportados por el médico en consultorio con captura de pantalla y
consola, la misma tarde de v17.36.0.

**1. El widget "viaja solo" al hacer scroll.** Causa: `position:fixed` (coordenadas de
pantalla) solo se recalculaba en el tick periódico de fondo (5-30 s), nunca al desplazarse
— entre una vuelta y la siguiente, el botón quedaba clavado en su posición vieja mientras el
formulario se movía por debajo. Arreglo: `_cwReposicionarEnScroll` (nueva) reposiciona los
tres widgets de Conducta en cada evento de scroll/resize, acotado a un solo repintado por
`requestAnimationFrame` — nunca uno por cada evento de un gesto de scroll continuo.
`_cwInstalarEscuchaScroll` la engancha una sola vez desde boot(), en fase de captura (para
enterarse también del scroll de un contenedor interno, que no burbujea hasta `document`).

**2. El botón agregaba hemograma sin que nadie lo pidiera.** El gesto "Paquetes → HTA"
(disparado para el perfil lipídico/glicemia/uroanálisis/creatinina) trae SIEMPRE, de
arrastre, "HEMOGRAMA IV ... AUTOMATIZADO" (902210) — confirmado en el catálogo de
`captura_ordenamiento_paquete_HTA_20260812.json` — un examen fuera de los 13 analitos
permitidos. El médico lo rechazó de plano. Arreglo: `MTR_ANALITOS_PAQUETE_CONDUCTA` queda
VACÍA — el disparo de "Paquetes → HTA" se retira por completo; el botón solo agrega los
analitos con búsqueda individual confirmada.

`requestAnimationFrame`/`cancelAnimationFrame` se añadieron al arnés (`tests/harness.js`):
sin el navegador real, el sandbox no los tenía y cualquier prueba directa de la coalescencia
revienta con "no está definido".

Tres cambios de comportamiento verificados con mutación. Restaurado y verificado con `diff`
contra copia intacta tras cada mutación. Banco completo en verde: **2579/2579** (suite_71
sola: 79/79).

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `MTR_ANALITOS_PAQUETE_CONDUCTA` con CREATININA de vuelta (el paquete vuelve a dispararse) | *{paquete} queda SIEMPRE vacío* (suite_71) |
| 2 | `_cwReposicionarEnScroll`: quitar la guarda de coalescencia (`if (_cwScrollRaf !== null) return` → `if (false) return`) | *reposiciona los tres widgets, pero UNA sola vez por fotograma* (suite_71) — tres llamadas seguidas debían agendar un solo `requestAnimationFrame`, y con la mutación agendaban tres |
| 3 | `_cwReposicionarEnScroll`: quitar `_cwScrollRaf = null` dentro del propio fotograma (deja el "cerrojo" puesto para siempre) | la misma prueba, su última aserción: *"tras consumirse el primer fotograma, la siguiente llamada agenda uno nuevo"* — sin resetear la bandera, ninguna llamada posterior vuelve a reposicionar nunca más |

## v17.36.0 — 28-ago-2026 (corrección del médico: la RAC ya no arrastra el paquete completo)

Corrección en el sitio, la misma tarde del v17.35.0. Esa entrega documentaba como "hueco
conocido" que, si la RAC era lo único pendiente, el botón igual disparaba el paquete "HTA"
completo (8-10 analitos ajenos) para conseguir la mitad de la RAC que el catálogo del
paquete también trae (creatinina en orina, 903876). El médico lo rechazó de plano: "jamás
debes hacer eso, solamente ordenar lo que se debe" — y aportó la corrección: la creatinina
en orina parcial SÍ se busca y agrega individual, con el mismo texto exacto que ya constaba
en la propia evidencia capturada (`captura_ordenamiento_paquete_HTA_20260812.json`, la
respuesta de `ObtenerPaqueteProgramasCupsByCitaId`: `"CREATININA EN ORINA PARCIAL"`, código
903876) — no es un texto adivinado, solo no se había reconocido que ese mismo nombre sirve
también para una búsqueda individual. La RAC salió por completo de
`MTR_ANALITOS_PAQUETE_CONDUCTA`: sus dos componentes (microalbuminuria automatizada +
creatinina en orina parcial) ahora viven en `CONDUCTA_LI_TEXTO_POR_ANALITO.RAC` como un
arreglo de dos textos, y `mtrConductaAgregarPendientes` exige que las DOS búsquedas tengan
éxito para dar la RAC por agregada (ya establecido desde v17.32.0: "no se pide media RAC").

Dos cambios de comportamiento verificados con mutación, más una tercera mutación que no
cazó a la primera y forzó una prueba nueva (ver abajo). Restaurado y verificado con `diff`
contra copia intacta tras cada mutación. Banco completo en verde: **2576/2576** (suite_71
sola: 76/76).

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Devolver RAC a `MTR_ANALITOS_PAQUETE_CONDUCTA` (vuelve a disparar el paquete completo) | *la RAC NUNCA entra al paquete, solo se busca individual* y *si la RAC es lo ÚNICO pendiente, no queda nada en `paquete`* (suite_71) |
| 2 | `mtrConductaAgregarPendientes`: quitar la verificación de fila nueva por cada texto de `liTextos` (`if (despues.size <= previos.size)` → `if (false)`) | **no cazó ninguna prueba existente** — todas las pruebas de RAC-con-dos-búsquedas usaban escenarios donde la búsqueda fallida lo era por `<li>` no encontrado (`disparado=false`), nunca por "se clickeó pero la fila no apareció". Se agregó *el clic se dispara pero ninguna fila nueva aparece — queda fallido, nunca se asume que sirvió* (caso general, no solo RAC) — con ella, la misma mutación SÍ cae |
| 3 | (repetida tras el fix de la prueba #2) confirmación de que la mutación #2 cae con la nueva prueba en su lugar | *el clic se dispara pero ninguna fila nueva aparece…* (suite_71) |

## v17.35.0 — 28-ago-2026 (el botón "Ordenar pendientes" simula el gesto real de "Paquetes", no el módulo de Ordenamientos)

Reversión puntual y documentada de una parte del retiro v15.7.0 (ver el encabezado de
`tests/suite_53_conducta_codigo.js` y el bloque de comentarios junto a
`_conductaBuscarYAgregarExamen` en el fuente, línea ~24086): el botón de v17.32.0 creaba
una orden real por el módulo de Ordenamientos, pero esa orden no aparecía en la tabla de
Conducta como sí aparece con "Paquetes" — confirmado con un diagnóstico en vivo
(`DIAGNOSTICO_PAQUETES_CONDUCTA.js`) que el médico corrió en consulta real. El médico, ya
visto las dos alternativas que no tocaban el DOM, pidió explícitamente lo contrario de lo
que se decidió el 20-ago: simular el clic real de "Paquetes" tal cual. El texto de cada
`<li>`/botón es literal, capturado dos veces en consultorio real (12-ago y 28-ago, 16 días
aparte, mismo resultado) — nunca adivinado.

Cuatro cambios de comportamiento verificados con mutación. Restaurado y verificado con
`diff` contra copia intacta tras cada mutación. Banco completo en verde: **2572/2572**
(suite_71 sola: 72/72).

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `_conductaBuscarYAgregarExamen`: coincidencia exacta (`_canonTexto(el.textContent) === claveObjetivo`) → `.indexOf(claveObjetivo) >= 0` (substring) | *coincidencia EXACTA, nunca por substring — examen parecido no se clickea (en ninguna de las dos direcciones)* (suite_71) — el primer intento de esta prueba usaba un `<li>` más CORTO que el buscado, y no cazó la mutación (un `indexOf` en el sentido "el texto del `<li>` contiene lo buscado" nunca puede fallar con un texto más corto); se corrigió añadiendo un segundo `<li>` MÁS LARGO (con un calificador extra) para cazar la dirección real del `indexOf` que la mutación introduce |
| 2 | `mtrConductaAgregarPendientes`: verificación del paquete leyendo la tabla (`if (huboFilasNuevas \|\| antes.size !== trasPaquete.size)`) → siempre cuenta como agregado, sin leer la tabla | *si el paquete no logra disparar (sin 'Paquetes'), esas claves quedan fallidas* y *paquete + individual juntos, verificado leyendo la tabla* (suite_71) |
| 3 | `mtrItemsOrdenarConducta`: RAC deja de entrar en los DOS grupos (`if (enPaquete)... if (liTexto)...` → `if (enPaquete)... else if (liTexto)...`) | *separa {paquete, individuales} — RAC entra en LOS DOS* (suite_71) |
| 4 | `_cwoClic`: la guarda de reentrada (`if (_cwoEnCurso \|\| !docId) return` → `if (!docId) return`) — a diferencia de v17.32.0 (por red, donde GHOST de `pageFetchJson` deduplicaba por debajo sin que `_cwoEnCurso` tuviera que hacerlo), aquí NO hay ninguna capa de deduplicación de otro módulo: sin la guarda, dos clics casi simultáneos disparan DOS secuencias de clics reales sobre el mismo botón/`<li>` | *dos clics antes de que termine el primero solo disparan UNA vez el clic real en Paquetes* (suite_71) |

~~**Un hueco conocido, dicho en vez de escondido** (sin mutación asociada — es una ausencia
deliberada de cobertura, no un comportamiento a proteger): si la RAC es el ÚNICO analito
pendiente, igual hace falta disparar el paquete completo "HTA" para la mitad de la RAC que
solo viene ahí (creatinina en orina, 903876) — no hay evidencia real de que ese examen se
pueda buscar y agregar individualmente, y adivinar un texto de `<li>` sin haberlo visto es
justo lo que este proyecto se prohíbe.~~ **Corregido en v17.36.0**: el médico rechazó este
comportamiento de plano y aportó la corrección — sí se puede buscar y agregar individual,
con el mismo texto que ya constaba en la evidencia capturada. Ver la entrada de v17.36.0
arriba.

## v17.34.0 — 28-ago-2026 (panel angosto corregido, botón centrado entre Historial y Paquetes, "Generar todo" retirado)

Tres cambios de comportamiento verificados con mutación (más la retirada de "Generar
todo", que no tiene mutación propia — es código eliminado, no lógica nueva). Restaurado y
verificado con `diff` contra copia intacta tras cada mutación. Banco en verde:
**2.564/2.564**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `mtrAnclaOrdenarPendientes`: la tolerancia de "mismo renglón" (`Math.abs(rb.top - rPaquetes.top) > 12`) → `if (false)` (acepta cualquier "Historial", de cualquier sección) | *mtrAnclaOrdenarPendientes: encuentra el par Historial+Paquetes del MISMO renglón, no cualquiera* y *'Paquetes' visible pero sin ningún 'Historial' en el mismo renglón, null* (suite_71) |
| 2 | `mtrPosicionPanelJuntoA`: `cabeADerecha` forzado a `true` siempre (nunca voltea a la izquierda) | *reportado en consultorio — sin espacio a la derecha, se abre a la IZQUIERDA* (suite_71) |
| 3 | `mtrPosicionPanelJuntoA`: el segundo recorte (contra el borde derecho tras caer a la izquierda) → `if (false)` | *cae a la izquierda del ancla, pero AÚN ASÍ se sale por la derecha — el segundo recorte lo trae de vuelta* (suite_71) — vector elegido a propósito (300/320, ventana 295) para que el primer recorte por sí solo NO explicara el resultado |
| 4 | `mtrWidgetOrdenarConductaTick`: `centroX = (rH.left + rP.right) / 2` → `centroX = rP.left` (centra sobre "Paquetes" solo, ignora "Historial") | *encendido, con pendientes — botón visible, CENTRADO entre Historial y Paquetes* (suite_71) — con la primera geometría de prueba (Historial pegado a Paquetes) esta mutación NO caía por coincidencia numérica (el punto medio y `rP.left` daban el mismo valor); se corrigió la geometría del `botonHistorial()` de prueba (con un hueco real entre los dos botones, como en la pantalla real) para que ambos valores diverjan y la mutación quedara genuinamente cazada |

## v17.33.0 — 28-ago-2026 (el interruptor de Ajustes ya describe el botón que sí actúa)

Solo texto de interfaz (la descripción del interruptor "Exámenes y órdenes en Conducta"):
no hay comportamiento nuevo que mutar, y decirlo es más honesto que inventar una fila. El
interruptor y su lógica de encendido/apagado ya estaban cubiertos por las pruebas de
v17.18.0/v17.24.0/v17.32.0 (`S.conductaWidgets`); esta versión solo corrige que su
descripción decía "Solo avisa" cuando, desde v17.32.0, el mismo interruptor también
enciende un botón que genera órdenes reales sin confirmación. Banco en verde: 2.554/2.554
(sin pruebas nuevas ni rotas).

## v17.32.0 — 28-ago-2026 (botón "Ordenar pendientes" en Conducta, un clic sin confirmación)

Cinco cambios de comportamiento verificados, uno documentado como NO caído (con el porqué,
en vez de escondido). Restaurado y verificado con `diff` contra copia intacta tras cada
mutación. Banco en verde: **2.554/2.554**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | RAC exige sus dos CUPS: `if (faltoAlguno \|\| !resueltos.length)` → `if (!resueltos.length)` (deja pedir un solo código de RAC) | *RAC exige SUS DOS códigos... no se pide media RAC* (suite_71) |
| 2 | El corte temprano sin items pendientes: `if (!items.length) return ...` → `if (false) return ...` | *sin items pendientes, no sale ni una petición a la red* (suite_71) |
| 3 | La confirmación del servidor: `if (!resOrd \|\| resOrd.error \|\| !agpReal)` → `if (false)` | *el servidor no confirma la orden... nada queda marcado como creado* (suite_71) |
| 4 | El namespace propio del día-guardado: `markOrdenLabsConductaHoy` también empuja a `p.ordenes` (el del botón «Ordenar» PyM del dock) | *namespace propio, NUNCA comparte almacén con isOrdenesCreadasHoy* (suite_71) |

**Mutación #5, documentada como NO caída — información, no un hueco escondido**: quitar
`_cwoEnCurso` de la guarda de reentrada (`if (_cwoEnCurso || !docId) return` →
`if (!docId) return`) NO hizo caer la prueba "dos clics antes de que termine el primero
solo generan UNA petición de guardado", ni siquiera reescribiéndola con un retraso de red
real (15 ms) para forzar una carrera genuina entre las dos peticiones. Investigado con
trazas directas (`node -e`, fuera del banco): `_cwoClic` SÍ se invoca dos veces bajo la
mutación (confirmado con un `console.log` temporal), pero la segunda orden nunca llega a
la red como una petición aparte — `pageFetchJson` (línea ~16391, "GHOST — Deduplicación de
Promesas") ya deduplica cualquier petición con la MISMA url+cuerpo mientras la primera
sigue en vuelo, y como ambos clics arman el mismo paciente/CUPS, la segunda petición se
resuelve compartiendo la promesa de la primera hasta el POST final. Esa protección es real
y anterior a esta versión — pero es un detalle de OTRO módulo, no un contrato que este
botón deba asumir por su cuenta. `_cwoEnCurso` queda en el código como defensa en
profundidad, documentada en el propio código (línea ~5618): evita recomputar todo dos
veces y seguiría protegiendo aunque la segunda petición llegara a tener un cuerpo
distinto, caso en el que GHOST no ayuda. No se inventó una prueba que solo fijara el
cableado interno del guardarraíl (el propio proyecto ya identificó ese patrón como una
falta, ver la nota de arriba de este documento) — se dejó escrito qué protege de verdad la
guarda y qué protege el otro módulo, que es lo honesto.

## v17.31.0 — 28-ago-2026 (la TFG por Cockcroft-Gault ya calculada resuelve sola la pregunta de ERC)

Un cambio de comportamiento en `mtrDiscrepanciasDeFuentes` (una función nueva,
`mtrTfgConfirmaErc`, y un `continue` de un solo caso dentro del bucle existente), cada
punto de fallo con su propia mutación. Restaurado y verificado con `diff` contra copia
intacta tras cada mutación. Banco en verde: **2.533/2.533**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `mtrTfgConfirmaErc` devuelve siempre `false` (`return false && ...`) | *v17.31.0 — con TFG por Cockcroft-Gault <60 ya calculada, el reconciliador NO pregunta por ERC* (suite_63) |
| 2 | El `continue` de `enfermedadRenal` en el bucle de `mtrDiscrepanciasDeFuentes` nunca se ejecuta (`if (h.clave === "enfermedadRenal" && false)`) | misma prueba — confirma que el guardarraíl vive en dos puntos (la función que decide y el punto donde se usa esa decisión), cada uno necesario |

Nota: la segunda prueba de la pareja (*una TFG≥60 (o no evaluable) NO apaga la pregunta*)
no se mutó aparte — es el control negativo que ya prueba, sin romper nada, que el
guardarraíl no se activa de más; su valor está en que sigue en verde después de las dos
mutaciones de arriba, confirmando que ninguna de las dos las volvió permisivas por error.

## v17.30.0 — 28-ago-2026 (con el ANR activo, la cosecha genérica y la gracia se apagan)

Un cambio de comportamiento, dos guardarraíles independientes en `mtrPlanParaclinicos`
(el de la cosecha base del 33% y el de la gracia de 14 días), cada uno con su propia
mutación y su propia prueba — confirmando que son dos puntos de fallo distintos, no uno
solo. Restaurado y verificado con `diff` contra copia intacta tras cada mutación. Banco
en verde: **2.531/2.531**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `if (anr) { diferidos.push(...); continue; }` → `if (false) {...}` en el bucle base de cosecha (33%) | *v17.30.0: con el ANR activo, un examen ajeno a lo renal tampoco se arrastra por el 33% BASE (sin gracia de por medio)* (suite_46) — el uroanálisis (margen 50 d de 180, 27,8%, ya calificaba solo para el 33% sin necesitar gracia) volvía a cosecharse |
| 2 | `if (!anr) {...}` → `if (true) {...}` en el bucle de arrastre por gracia | *v17.30.0: con el ANR activo, un examen ajeno a lo renal NO se arrastra aunque su margen quepa en el 33%+gracia* (suite_46) — la glicemia (margen 65 d, solo calificaba sumando la gracia de 14 días) volvía a cosecharse |

Nota: la primera mutación (bucle base) NO se pudo verificar con el mismo escenario de
glicemia usado para la prueba de gracia — con margen 65 d y vigencia 180 d (33% = 59,4 d),
la glicemia ya excede el 33% base por sí sola, así que romper solo el guardarraíl del
bucle base no la afecta (cae por la gracia de todos modos, o queda diferida en ambos
casos). Se necesitó un segundo vector (uroanálisis, margen 50 d, que SÍ calza dentro del
33% base) para que la mutación #1 quedara realmente cubierta — confirmando que ambos
guardarraíles son necesarios y ninguno sustituye al otro.

## v17.29.0 — 28-ago-2026 (arrastre por gracia medido, reloj de 3 min, meta de triglicéridos, color del RAC vencido)

Cinco cambios de comportamiento, todos restaurados y verificados con `diff` contra copia
intacta tras cada mutación. Banco en verde: **2.528/2.528**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `MTR_GRACIA_COSECHA_DIAS = 0` (sin gracia) | *ARRASTRE POR GRACIA (1.16): la creatinina que se pasó del 33%...* (suite_46) |
| 2 | `MTR_GRACIA_COSECHA_DIAS = 30` (gracia excesiva) | *ARRASTRE POR GRACIA (1.16): un diferido que se pasa por MÁS de 14 días...* (suite_46) |
| 3 | `MTR_CACHE_TTL_MS` de vuelta a 10 min | *v17.29.0 — el TTL del resumen bajó de 10 a 3 min...* (suite_50) y *caché del resumen: edad en minutos...* (suite_57) — las dos cayeron, confirmando que el mismo TTL protege dos consumidores distintos |
| 4 | `MTR_META_TRIGLICERIDOS` de vuelta a 150 | *v17.29.0 — meta de triglicéridos sube a 400...* (suite_67) |
| 5 | Quitar `(x.subestado === "vencido" \|\| x.vencidoBase)` → volver a `x.subestado === "vencido"` en `mtrPanelExamenesHtml` | *v17.29.0 — un RAC≥30 vencido se pinta en rojo...* (suite_67) |
| 6 | Quitar `vencidoBase: !!a.vencidoBase` del `fila()` de `mtrTableroClinico` | misma prueba, otra aserción: "mtrTableroClinico expone que de verdad está vencida" — confirma que el dato y su consumo son dos puntos de fallo independientes, cada uno con su propia mutación |

Nota sobre el hallazgo del RAC: no hay una función `mtrAcortarPorFueraDeMeta`/similar
involucrada — es un defecto de VISUALIZACIÓN puro (dos renderizadores HTML, el widget
flotante `mtrWidgetExamenesDatos` y la pestaña del Panel `mtrPanelExamenesHtml`, ambos
consumían `subestado` sin saber que un RAC vencido cambia de subestado al reclasificarse
por albuminuria). `mtrEstadoAnalito`/`mtrPlanParaclinicos` siempre calcularon bien
—`vencidoBase` ya existía como la verdad de terreno— el hueco era que ese dato no viajaba
hasta las dos pantallas.

## v17.28.0 — 28-ago-2026 (Enfermedad Actual, regla del 50%, retiro de Medicamentos actuales y del toast de laboratorio)

Cuatro cambios de comportamiento, todos restaurados y verificados con `diff` contra copia
intacta tras cada mutación. Banco en verde: **2.524/2.524**.

### Enfermedad Actual (sin examen físico de hoy)

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Reintroducir "Inventar cifras de signos vitales" (la prohibición condicional vieja) en vez de la nueva incondicional | *v17.28.0 — Enfermedad Actual NUNCA admite signos vitales de hoy...* (suite_57): "aclara que la exclusión aplica AUNQUE la cifra sí conste" |
| 2 | Reintroducir la regla 6 ("Cifras objetivas con unidades DE HOY: presión arterial, glucometría...") como contenido obligatorio | misma prueba: "la vieja regla 6... ya no existe como contenido obligatorio" |

### Regla del 50% de vigencia (triglicéridos sale, glicemia entra)

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 3 | Devolver TRIGLICERIDOS a `MTR_CLAVES_CON_META` Y a su caso en `mtrFueraDeMeta` (el código viejo completo) | *v17.16.0 — mtrFueraDeMeta: el umbral de meta+15%...* (suite_45): "triglicéridos ya no dispara por su cuenta" |
| 4 | Quitar GLUCOSA de `MTR_CLAVES_CON_META` | misma prueba: "150 no" (esperaba `cierto`, obtuvo `null`) |

Nota de proceso: mutar solo `MTR_CLAVES_CON_META` (sin tocar el `if` de `mtrFueraDeMeta`)
NO basta para reproducir el defecto viejo — el gate de la lista y el caso del `switch`
tienen que fallar JUNTOS. Se verificó explícitamente que cada mitad por separado sigue
protegida por la otra, antes de mutar las dos a la vez.

### "Medicamentos actuales" retirado del Panel

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 5 | Reinsertar el bloque de medicamentos en `mtrPanelResumenHtml` (`meds` de vuelta en el `return`) | *v17.28.0 — mtrPanelResumenHtml ya NO repite la lista completa...* (suite_67) |

### Toast de "Cita de Laboratorio agendada" retirado

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 6 | Reintroducir el `spToast(...)` de confirmación en `apiLaboratorioAgendarAuto` | *apiLaboratorioAgendarAuto: agenda el turno EXACTO elegido...* (suite_13): "el toast que el médico pidió retirar no debe volver por accidente" |

## v17.27.0 — 28-ago-2026 (la IA cita ldl_reduction_target en vez de memorizar "50%")

Reporte en vivo, mismo patrón que ldl_target/cno_hdl_target (v17.6.64): un número que el
motor calcula (`mtrEvaluarMetaLdl` → `metas.reduccion`) vivía SOLO como regla fija en el
texto del prompt ("reducción ≥50% del basal si riesgo alto/muy alto"), así que el
verificador de cifras (`mtrVerificarCifrasIA`) lo marcaba como inventado aunque el modelo
lo hubiera citado bien. Dos puntos de origen se corrigen (el JSON del motor y la hoja de
hechos en texto plano), cada uno con su propia mutación.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `ldl_reduction_target: null` fijo en `mtrJsonV68DesdeResumen` (ignora `meta.reduccion`) | *v17.26.0 — ldl_reduction_target viaja calculado...* (suite_57): "riesgo alto: viaja el 50% real, no un texto fijo" |
| 2 | `metaReduccionLdl: null` fijo en `mtrHojaDeHechos` (ignora `r.meta.metas.reduccion`) | *la lista blanca sí conserva lo CLÍNICO* (suite_56): "meta de reducción de LDL desde el basal" — la prueba del JSON (#1) NO cae con esta mutación, confirmando que son dos canales independientes que necesitaban su propia mutación cada uno |

Restauradas y verificadas con `diff` contra copia intacta. Banco en verde: **2.525/2.525**.

## v17.26.0 — 28-ago-2026 (Laboratorios: migración de la seguridad farmacológica y limpieza de redacción)

Cinco cambios de comportamiento, cinco mutaciones — todas restauradas y verificadas
contra copia intacta (`diff` limpio tras cada restauración).

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Quitar `a.titulo = r.titulo;` de `mtrEvaluarConCatalogoRcv` | *v17.26.0 — el aviso lleva el título legible del catálogo, no el código crudo* (suite_69) |
| 2 | Quitar la preferencia por `a.titulo` en `mtrEtiquetaAviso` (vuelve al mapa de códigos) | misma prueba — la aserción sobre `mtrEtiquetaAviso(a)` cae, la de `a.titulo` no (aísla cuál de las dos mitades del fix falló) |
| 3 | Vaciar `MTR_CONDUCTA_ETIQUETA` (sin la entrada `CAP_DOSIS`) | *v17.26.0 — 'CAP_DOSIS' no se pinta crudo: se traduce a 'TOPE DE DOSIS' en pantalla* (suite_39) |
| 4 | Reinsertar `<div id="vgl-labs-farmaco">` en la plantilla de `openLaboratoriosModal` | *v17.26.0 — el bloque de seguridad farmacológica SE FUE de Laboratorios (vive solo en Conducta)* (suite_31, M1) |
| 5 | Devolver el regex de `MTR_RCV_CSS_TODOS_LOS_MODALES` a la forma que no soporta selectores de clase compuestos (`.vgl-rcv-aviso.vgl-rcv-aviso-alto`) | *el modificador compuesto de aviso-alto debe llegar también a #vgl-riesgo-modal* (suite_25) |

### Defecto aparte, encontrado arreglando la prueba de la mutación #5

Al mutar la #5 se descubrió que la propia `tests/suite_25_cascada_css.js` tenía el MISMO
defecto de fondo que ya se había corregido tres veces esta semana en otros archivos
(`tools/verificar_color_chromium.js`, `tests/suite_41_motor_vista.js`, y en esta misma
suite para las otras tres hojas): la extracción textual de `${_cssSeguro(() => XXX)}`
buscaba literalmente `const NOMBRE = \`...\`;` y `MTR_RCV_CSS_TODOS_LOS_MODALES` NO es un
literal de plantilla puro — es `MTR_RCV_CSS.replace(/regex/g, cb) + \`...cola...\`;`. La
búsqueda fallaba en silencio (`continue`) y el marcador quedaba sin resolver: **la
regla A (regex compuesto) de arriba pasaba en producción pero la prueba nunca la vio**,
así que ni siquiera medía lo que decía medir. En vez de reescribir el `.replace()` a mano
en la prueba (arriesgando que el regex de la prueba divergiera del real sin que nada lo
note), se resuelve `MTR_RCV_CSS` primero y se EJECUTA el fragmento real de código fuente
con `new Function(...)`, verificando el comportamiento real en vez de una copia. Efecto
colateral honesto, no un defecto nuevo: `importantTotal` sube de 495 a 526 porque ahora
cuenta `!important` que YA estaban en la hoja real y esta prueba nunca había visto — mismo
patrón que el salto de 392→490 en v17.24.0, documentado en el propio comentario de la
prueba.

Banco en verde tras la restauración final: **2.524/2.524**.

## v17.25.0 — 28-ago-2026 (widget de farmacia en Conducta, y el hallazgo del reloj desconectado)

### El hallazgo más grave de la noche: un widget entregado que nunca se pintó

Investigando cómo enganchar `mtrWidgetFarmacoTick` al reloj de producción, se encontró
que su hermano — `mtrWidgetConductaTick` (v17.18.0) — **nunca se llamó desde `tick()`**.
Confirmado con `git log -p -S "mtrWidgetConductaTick()"`: ni el commit original de
v17.18.0 ni ningún commit posterior agregó esa llamada. La función estaba escrita,
probada de punta a punta (`suite_71`), y nunca conectada — el widget de "qué ordenar en
el próximo control" no ha aparecido en ninguna consulta real desde que se entregó.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Quitar `mtrWidgetConductaTick()`/`mtrWidgetFarmacoTick()` de la rama `if (secc === "historia")` de `tick()` | *REGRESIÓN: los dos widgets de Conducta están enganchados de verdad al tick() de la sección «historia»* |

Restaurada y verificada con `diff` contra copia intacta. Esta prueba nueva no ejercita
lógica: lee el código fuente y confirma que la llamada existe — la única forma de
proteger contra este defecto exacto, porque toda la lógica INTERNA de ambos widgets ya
estaba (y sigue estando) perfectamente probada. Ver el comentario extenso junto a la
prueba en `tests/suite_71_widget_conducta.js` — la misma lección de v17.12.0 ("probar
la pieza no es probar que la pieza está conectada"), aprendida una segunda vez por no
haberla generalizado la primera.

### El widget de farmacia, probado como su hermano

`mtrBotonFarmacoConducta`, `mtrWidgetFarmacoDatos` y `mtrWidgetFarmacoTick` reciben el
mismo banco de pruebas que `mtrBotonOrdenarConducta`/`mtrWidgetExamenesDatos`/
`mtrWidgetConductaTick` — mismos casos (ancla visible/oculta/ausente, apagado por
`S.conductaWidgets`, anti-parpadeo, reset entre pacientes) más los propios de la
decisión del médico sobre el motor apagado (aviso neutro, nunca oculto). Verificado en
Chromium (`tools/verificar_color_chromium.js`, 5 casos nuevos) que `#vgl-cw-farmaco`
sobrevive al CSS agresivo simulado, incluyendo los avisos/duplicidades que reutiliza de
`.vgl-mtr-*`/`.vgl-dup-*` (extendidos con un tercer destino, sin quitarle nada a los
otros dos). Banco completo en 2.520/2.521 (la 1 que falla es la preexistente de huso
horario de `suite_03`, v17.6.39, ajena a esta entrega).

---

## v17.24.0 — 28-ago-2026 (Panel del paciente, Fase 1: dashboard de estado y medicamentos pasivos)

### El dashboard nunca puede opinar distinto que su pestaña detallada

`mtrPanelResumenBentoDatos` lee literalmente los mismos campos de `d = mtrTableroClinico(resumen)`
que ya consumen `mtrPanelRiesgoRenalHtml`/`mtrPanelExamenesHtml`/`mtrPanelTendenciasHtml` — no
un criterio propio. Dos mutaciones, cada una en su propia zona:

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Invertir `alerta ? "pend" : "ok"` a `alerta ? "ok" : "pend"` en la tarjeta de riesgo CV | *mtrPanelResumenBentoDatos: riesgo alto/muy alto o alerta renal → «pend»…* — "riesgo bajo, sin alertas renales: al día" esperaba "ok" y obtuvo "pend" |
| 2 | Colapsar `meds = crudos ? ... : null` a `crudos ? ... : []` en la lista pasiva de medicamentos (mismo defecto que v17.0.2 ya corrigió una vez para la pestaña Medicamentos) | *mtrPanelResumenMedsHtml: lista lo que toma… distingue «no se pudo leer» de «no toma nada»* — "sin lectura, se dice que no se pudo leer" |

Restauradas y verificadas con `diff` contra copia intacta; banco completo en 2.502/2.503
(la 1 que falla es la preexistente de huso horario de `suite_03`, v17.6.39, ajena a esta
entrega).

### Los dos bugs de CSS de MTR_RCV_CSS (Regla A + asimetría Ordenar/Laboratorios)

No se mutaron a propósito por separado: la propia extensión de `tools/verificar_color_chromium.js`
(casos "RCV: aviso-alto"/"RCV: lista-orden") ES la mutación-inversa — se escribieron
primero contra el código roto (confirmado FALLA con el estado previo a este commit,
visible en el historial de edición de esta sesión), y pasan a OK solo tras el fix. La
combinación `#vgl-ordenar-modal .vgl-rcv-lista,#vgl-labs-modal .vgl-rcv-lista li` (el
selector viejo, asimétrico) sigue documentada en el propio comentario del CSS junto al
fix, para quien audite el diff.

### El punto ciego de suite_25 sobre las hojas CSS spliceadas

| # | Qué se rompió a propósito | Qué cayó |
|---|---|---|
| 3 | Revertir la resolución de `${_cssSeguro(() => XXX)}` en `tests/suite_25_cascada_css.js` (volver al escaneo textual ingenuo) | Los tres contadores que dependen de ver las 4 hojas spliceadas: `importantTotal` (490→392, mucho más bajo de lo real), la reserva `var(--t-micro,12px)` (2→1, deja de ver `#vgl-tip-pop`), y las colisiones de Regla A de `.vgl-rcv-aviso-alto`/`.vgl-rcv-lista-orden` (dejan de detectarse) |

Mismo fix que ya llevaba `tools/verificar_color_chromium.js` desde v17.23.0 — no es una
mutación nueva de comportamiento del script, es cerrar un punto ciego del INSTRUMENTO que
ya se había verificado en un sitio y faltaba en el otro.

---

## v17.23.0 — 28-ago-2026 (los avisos farmacológicos del Panel ya tienen color)

### El hallazgo

La investigación del rediseño S+ del Panel del paciente encontró que `MTR_CSS`
(`vigilante_agenda.user.js`, ~línea 37546) solo estaba sembrado para `#vgl-labs-modal`.
Los mismos avisos (`.vgl-mtr-*`, pintados por `mtrPintarAviso`) también se pintan dentro
de `#vgl-panel-modal` (pestaña Medicamentos), y ahí no había ninguna regla de color
propia — ni fondo, ni borde, ni el rojo/ámbar/azul de severidad. Se corrigió duplicando
cada selector a los dos modales, con `!important` en cada uno (Regla E).

### Un problema de instrumento, no solo de código

`tools/verificar_color_chromium.js` extrae el CSS del script leyendo texto plano entre
`style.textContent = \`` y su cierre — pero el bloque principal *interpola* otras hojas
con `${_cssSeguro(() => MTR_CSS)}`, que la extracción textual dejaba como texto literal
(CSS inválido), nunca como el contenido real. Cualquier clase que solo viviera en una de
esas hojas spliceadas nunca llegaba a Chromium, aunque en producción sí se pinta. Se
corrigió la herramienta para resolver cada marcador con el valor real de su `const`, y
solo entonces se pudieron escribir casos de prueba honestos para `.vgl-mtr-*` dentro de
`#vgl-panel-modal`.

| # | Qué se rompió a propósito | Qué cayó |
|---|---|---|
| 1 | Quitar `,#vgl-panel-modal .vgl-mtr-X` de cada selector de `MTR_CSS` (volver al estado original, un solo selector) | `tools/verificar_color_chromium.js`: 3 casos nuevos (`Panel: conducta de aviso CRITICAL/HIGH`, `Panel: título del bloque de avisos`) — de "TODO SOBREVIVE" a "3 FALLAN" |

*Nota: `node tests/runner.js` (suite 41, "el interruptor y su CSS están cableados") **no**
cae con esta mutación — solo verifica que toda declaración de color lleve `!important`,
no que ambos modales estén cubiertos. La única prueba que detecta un hueco de *scoping*
como este es la verificación empírica en Chromium, tal como exige `CLAUDE.md` para
cualquier panel pegado a `document.body`. Restaurado y verificado con `diff` contra copia
intacta; banco completo en **2.496/2.497** (la 1 que falla es la preexistente de
`suite_03`/huso horario, v17.6.39, ajena a este cambio) y Chromium en **TODO SOBREVIVE**.

*Nota aparte, para que no se pierda: las versiones v17.13.0–v17.22.0 de esta misma noche
del 28-ago no tienen su fila de mutación en este informe. Se hicieron y se verificaron en
su momento (el banco quedó en verde en cada una), pero el registro escrito aquí no se
completó antes de que la sesión se resumiera — el detalle exacto de cada mutación de esas
7 versiones no se reconstruye de memoria para no inventar lo que no se guardó.*

---

## v17.12.0 — 27-ago-2026 (se escucha lo que Everest CARGA, y el bloque farmacológico se inserta)

### Por qué el diagnóstico de consola capturó CERO

Se le entregó al médico un diagnóstico para descubrir qué carga Everest al abrir un paciente.
Devolvió **0 respuestas anotadas**. La causa la dio **su propia bitácora**: de 36 cambios de
URL, **24 arrancan con `from` vacío**, o sea que el script empezó de cero.

**Everest recarga la página de verdad al abrir un paciente**, y eso borra cualquier cosa
pegada en la consola antes de que la respuesta llegue. Dentro del userscript no pasa:
Tampermonkey lo reinyecta en cada carga.

*La lección: cuando un diagnóstico devuelve nada, la primera pregunta no es «¿qué falta en el
código?» sino «¿el instrumento llegó vivo al momento que quería medir?».*

### Y no hubo que adivinar ni un campo

La respuesta se reconoce con el **mismo detector por forma** que ya usa el envío
(`mtrEsPayloadHcEverest`, que exige ≥2 secciones conocidas). Si Everest la manda, se captura;
si no, no pasa nada. Pasa por la misma barrera: `datosUsuario` no se lee y el nombre se tacha
con la identidad del propio paquete, que se descarta sin guardarse.

**Lo que no puede pasar, y está fijado por prueba:** la respuesta se lee sobre un **clon**.
Leer el cuerpo original dejaría a Everest sin poder leerlo y la historia no cargaría. Es lo
único que separa esta escucha de romperle la aplicación al médico en consulta.

### El bloque de seguridad farmacológica: calculado y tirado

La auditoría lo puso como ejemplo del patrón *«se calcula y se tira a la basura antes de
pintar»*. `extraFarmaco` se armaba con `mtrRenderAvisosHtml` —dosis renales, metformina
contraindicada, estatina insegura— y la variable **moría al final del try**. Hasta el CSS
(`#vgl-labs-modal .vgl-mtr-bloque`) estaba escrito para ese modal y sin usar. Ahora se
inserta, **arriba de la tabla**: es lo que puede cambiar una dosis hoy.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Leer la respuesta SIN clonar (rompería Everest) | *la escucha no rompe Everest: no toca peticiones ni consume respuestas* |
| 2 | Envolver la inserción del bloque en `if (false)` | *el bloque de seguridad farmacológica se INSERTA, no se tira* |
| 3 | Quitar la lectura de `xhr.responseText` | *la escucha no rompe Everest…* |

### Dos mutaciones no cayeron, y las dos por lo mismo

Las pruebas de texto fuente buscaban **el fragmento** y no **la línea con su guarda**: `if
(false) cajaF.innerHTML = extraFarmaco` seguía casando con `innerHTML = extraFarmaco`. Y la
ventana de 3.000 caracteres sobre `mtrHcEnganchar` no llegaba al segundo enganche.

*Una prueba de texto fuente que no fija la condición no fija nada* — es la versión de esta
sesión de la regla vieja: probar la pieza no es probar que la pieza está conectada.

Banco completo en **2.432/2.432** con `TZ=America/Bogota`.

---

## v17.11.0 — 27-ago-2026 (auditoría de experiencia: Tanda 2, color con significado)

Patrón A del informe: *«el ámbar señala diez cosas sin relación entre sí; el rojo es a la vez
alarma clínica, "no hay cupos ese día", "este paciente no necesita nada" y el botón de cerrar
ventana. Con esa dispersión el color deja de comunicar y pasa a ser decoración»*.

Las dos de esta entrega son las que **cambian una conducta**: una rebaja una alarma y la otra
disfraza un fallo de éxito.

### #63 — agrupar avisos rebajaba la alarma

Reproducido: un aviso **ROJO** —la confirmación extemporánea, que este proyecto trata como
evidencia para una reclamación— agrupado con un AZUL rutinario del mismo paciente salía en
**ÁMBAR**. El rojo desaparecía por el solo hecho de que hubiera otro aviso al lado. El mismo
defecto estaba en «Alerta Múltiple», donde afecta a más avisos a la vez.

Ahora el color de un grupo es el del **más grave** que contiene (`mtrColorMasGrave`), con el
mismo orden que el resto del archivo ya usa. Y un color que nadie declaró se trata como **lo
más grave**: callar una alarma por no saber clasificarla es el peor error posible aquí.

### #44 — una corrida a medias se pintaba de «todo bien»

El aviso de que las órdenes salieron **a medias** reutilizaba `.vgl-ord-vigwarn`, que en ESE
modal es **verde** y significa «esto ya está cubierto». De un vistazo, una corrida en la que
parte de las órdenes NO se crearon decía que todo había ido bien — y el médico se va creyendo
que quedaron pedidas. Clase propia en ámbar, con `!important` (el modal cuelga de
`document.body`), **verificada en Chromium** contra un CSS de Everest agresivo: sobrevive.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | El grupo vuelve al ámbar fijo | *agrupar avisos NUNCA puede rebajar la alarma* |
| 2 | Un color desconocido deja de tratarse como grave | la misma |
| 3 | El parcial vuelve a la clase verde | *una corrida a medias no puede parecerse a una que salió bien* |

### El contador de `!important` contaba comentarios

Al añadir la clase nueva, el contador de `suite_25` saltó **+2** cuando la declaración era
**una**. La otra estaba dentro de un **comentario CSS**: escribir «con `!important` porque este
modal cuelga de document.body» subía el total como si se hubiera añadido código.

Un contador que se mueve porque alguien **explicó** algo no mide lo que dice medir, y peor:
**empuja a no documentar**. Ahora cuenta sobre el CSS con los comentarios quitados —usando el
`cssClean` que esa misma suite ya construye— y el número baja de 404 a **378 sin que haya
cambiado una sola declaración**: los 26 de diferencia siempre fueron prosa.

Banco completo en **2.429/2.429** con `TZ=America/Bogota`.

---

## v17.10.0 — 27-ago-2026 (la historia se lee mientras se escribe, no al guardarla)

**Rechazo explícito del médico a la v17.9.0, y tenía razón:** *«no me sirve para la siguiente
cita. La IA y el script completo, todos sus módulos, deben estar alimentados por ese json
INCLUSO ANTES DE GUARDAR, porque la idea es poder redactar en tiempo real. No acepto tu
solución. Debe ser algo mucho mejor que se actualice a medida que se vaya llenando la
historia»*.

La v17.9.0 se enganchaba al **Guardar**, que ocurre al final de la consulta — después de
redactar. Servía para la cita siguiente, que es justo lo que él no necesita.

### La pista que lo hace posible

Los `name` de las casillas del DOM de Everest **son las mismas rutas del paquete que se
guarda**: `name="AntecedentePatologicos.Hipertension"` en pantalla es
`antecedentePatologicos.hipertension` en el envío. **No hay que esperar al guardado para
conocer la estructura: está escrita en la pantalla, casilla por casilla.**

Así que se cosecha TODA casilla con `name` cuya ruta sea clínica, y se acumula por paciente.
Lo que él llenó en Antecedentes sigue ahí cuando pasa a Hábitos — Angular destruye la pestaña
anterior con `*ngIf`, así que releerla daría vacío, y **vacío no es «lo borró»**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | La lista blanca deja pasar todo | *BARRERA — la cosecha en vivo tampoco toca lo que identifica al paciente* |
| 2 | La cosecha reemplaza en vez de acumular | *lo de la pestaña anterior no se pierde al cambiar de pestaña* |
| 3 | Una casilla en blanco pasa a valer «no» | *una casilla en blanco NO se convierte en un «no»* |
| 4 | Desconectar la cosecha del reloj de pantalla | *CABLEADO — el reloj que vigila la pantalla dispara la cosecha de verdad* |

### La mutación 4 no cayó a la primera, y era la de siempre

Ninguna prueba se puso roja al desconectar `mtrHcAcumularDelDom` de
`_vglCosecharDePantalla`: **todas le pasaban el bloque ya cosechado a mano**. Es, literal, la
regla que este proyecto lleva ocho versiones repitiendo — *probar la pieza no es probar que
la pieza está conectada*. Se escribió la prueba que llama al mismo punto que dispara el router
de Everest y mira el almacén. Entonces cayó.

### Un incidente de proceso que conviene dejar escrito

El proceso de trabajo se reinició **en mitad de la mutación 1**, y esa mutación es la que
**desactiva la lista blanca de PHI**. Quedó aplicada en el árbol. Lo primero al retomar fue
comprobarlo (`grep` sobre la función) y restaurar contra la copia intacta, verificando con
`diff` antes de seguir. Nada de eso llegó a commit ni a producción: lo publicado era la
v17.9.0, con la barrera entera.

**La lección no es «tuve suerte»:** es que la disciplina de guardar una copia intacta y
restaurar con `diff` —y no de memoria— es lo que convirtió un reinicio a mitad de mutación en
un incidente de tres minutos en vez de una fuga de datos de paciente.

### El límite, dicho y no disimulado

Esto ve las pestañas que el médico **ya abrió** en esta consulta, más lo archivado de antes.
Lo que Everest tiene guardado en pestañas que no ha tocado hoy **no está en el DOM**. Cerrar
ese hueco exige leer lo que Everest **carga** al abrir el paciente, y ese endpoint todavía no
está capturado — **no se supone nada**.

Banco completo en **2.427/2.427** con `TZ=America/Bogota`.

---

## v17.9.0 — 27-ago-2026 (la IA recibe lo que Everest guarda, no lo que asomaba por la pestaña)

**Encargo del médico:** *«necesito que nuestro JSON también guarde todo lo mismo que guarda
Everest, nos servirá para que la IA tenga todo el contexto (grounding) necesario para buenas
redacciones»*. Desbloqueado porque él corrió `DIAGNOSTICO_GUARDADO_HC.js` (mapa completo en
`MAPA_GUARDADO_HC.md`).

| | |
|---|---|
| Lo que el asistente leía | **25 casillas** del DOM, y solo de la pestaña abierta |
| Lo que Everest guarda | **111 campos**: 109 antecedentes patológicos, 39 de examen físico, 33 hábitos, 25 familiares, 20 revisión por sistemas |

### Se reconoce por FORMA, no por la ruta

La ruta capturada es `/apiviva/APIHCHealth/api/Morbilidad/GuardarHCMorbilidad`, pero atarse a
esa cadena sería atarse a algo que Everest puede cambiar sin avisar — el susto de v12.3.30
(cuatro nombres supuestos, ninguno existía). Se reconoce por sus **secciones**, que son el
contrato clínico. Beneficio colateral: el día que se capture el endpoint que **carga** la
historia al abrir el paciente, este mismo código lo reconocerá sin tocar una línea.

### LA BARRERA, y la fuga que cazó su propia prueba

`datosUsuario` (91 campos: nombre, apellidos, cédula, celular, correo, dirección) y
`acompanante` **no se leen**. No es que se limpien: no entran. Una **lista blanca de
secciones** no se degrada cuando alguien añade un campo nuevo al otro lado; un filtro de
campos sí.

**Pero la primera versión filtraba igual, y la prueba de barrera lo cazó.** `scrubPII` sabe
reconocer correos, teléfonos, direcciones, fechas y cédulas —todos tienen forma— pero **no
puede reconocer un nombre propio**: «MARTHA» es una palabra como cualquier otra. Y el médico
escribe el nombre del paciente a mano en la enfermedad actual.

La salida estaba en el propio paquete: se lee `datosUsuario` **solo** para construir la lista
de tachaduras, se aplica al texto libre, y se descarta sin guardarse. *Tachar un nombre con
garantía exige conocerlo.* Verificado de punta a punta con un texto que lleva nombre, apellido
y cédula pegados: sale «[CENSURADO] [CENSURADO] [CENSURADO], CC [CENSURADO], refiere cefalea
occipital de 3 días» — lo clínico entero, la identidad ninguna.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Meter `datosUsuario` en la lista blanca | *BARRERA — nada que identifique al paciente sale del paquete* |
| 2 | Dejar de tachar el nombre en el texto libre | la misma |
| 3 | Que baste UNA sección para dar el paquete por bueno | *se reconoce por FORMA, no por la ruta de Everest* |
| 4 | Que un campo vacío viaje como si fuera un dato | *entra TODO lo clínico, y un «no» documentado vale tanto como un «sí»* |

### Dos decisiones que conviene tener escritas

- **Un `false` explícito SÍ viaja; un vacío NO.** «Marcado que no tiene infarto» es un hecho
  documentado y el modelo necesita saber que se preguntó. Un campo vacío no es «no tiene», y
  convertirlo en eso sería inventar.
- **No se interpreta ningún valor.** El diagnóstico capturó la **forma**, no el
  **significado**: no se sabe qué admite cada campo. Los booleanos y números pasan tal cual y
  el texto se sanea. Interpretar sin saber es justo lo que `MAPA_GUARDADO_HC.md` advierte.

### Lo que esto NO resuelve, y hay que decirlo

Everest manda este paquete cuando el médico pulsa **Guardar**, que normalmente es al FINAL de
la consulta — después de redactar. Así que lo capturado sirve de grounding para la consulta
**siguiente**, y para la actual solo si él guarda a mitad. Que sirva también para la actual
exige leer lo que Everest **carga** al abrir el paciente, y ese endpoint todavía no está
capturado. **No se ha simulado ni supuesto: está pendiente de un diagnóstico.**

Banco completo en **2.421/2.421** con `TZ=America/Bogota`.

---

## v17.8.2 — 27-ago-2026 (reportado en consulta: Auto-Labs escribía un uroanálisis viejo)

**El reporte, textual:** *«otra vez el problema de que el botón Auto-Labs Athenea no está
teniendo en cuenta el último uroanálisis realizado»* — y el «otra vez» es la parte importante.

**Reproducido con el arnés antes de tocar nada.** Athenea trae, para la misma paciente:

    fila REAL del panel   07/05/2026   Resultado: «NORMAL»
    31 componentes        20/08/2026   el que la tabla marca «Alteraciones detectadas»

Auto-Labs escribía en la historia clínica **el texto «NORMAL» y la fecha de mayo**.

### La causa: una decisión de diseño que era correcta para otra cosa

`_nuevoReemplazaCandidato`, regla 1: *«una fila REAL del panel siempre le gana a un respaldo
armado con un componente suelto»* — **sin mirar la fecha**, y así estaba escrito y comentado a
propósito. La razón original es buena: una fila real es el veredicto del panel completo, no un
fragmento. Pero esa razón sirve para elegir **entre iguales de fecha**, no para pisar un
examen tres meses más nuevo.

Y la dirección del daño no es simétrica: escribir **«NORMAL» sobre un uroanálisis alterado**
es un falso negativo que el médico firma.

**Regla nueva:** el respaldo por componentes gana cuando tiene fecha y la fila real es más
vieja — o no tiene fecha con que defenderse. Con fecha igual o más nueva, la fila real sigue
mandando, que es lo que la regla protegía de verdad.

### Un supuesto escrito como si fuera un hecho

Segundo defecto, del mismo reporte. Toda la lógica de «el primero reclama la casilla» descansa
en este comentario: *«las solicitudes llegan de más reciente a más antigua, así que el primero
ES el resultado más reciente»*. **Nada lo garantizaba**: ni `_atheneaExtraerSolicitudes` ni
`_getAtheneaLabsAutoNucleo` ordenan, el orden es el del HTML del portal. Y estas 7 casillas
**no llevan fecha acompañante**, así que un componente viejo colado ahí es invisible.

Ahora la inyección recorre una copia ordenada por fecha descendente (los sin fecha al final:
sin fecha no se puede afirmar que sean recientes). «El primero» y «el más reciente» pasan a ser
lo mismo **por construcción en vez de por suerte**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Que la fila real vuelva a ignorar la fecha | *REGLA 1 CORREGIDA* **y** *el uroanálisis de AGOSTO no lo pisa la fila «NORMAL» de MAYO* |
| 2 | Que una fila real SIN fecha vuelva a poder pisar a un componente fechado | *REGLA 1 CORREGIDA* |
| 3 | Quitar el orden por fecha de la inyección | *el orden por fecha deja de ser un supuesto y pasa a ser un hecho* |

### La tercera prueba de esta sesión que fijaba el defecto

`suite_08` tenía un caso llamado **«REGLA 1 intacta»** que exigía literalmente *«la fila real,
aunque más vieja, reemplaza al respaldo por componente»* — con una fila de enero ganando a un
componente de agosto. Es exactamente el caso que el médico reportó como fallo. Se invirtió,
dejando escrito el porqué y conservando lo que la regla sí protegía (fecha igual o más nueva).

Van tres en esta misma sesión: `suite_67` (la jerga del papel del paciente), `suite_15` (el
fallo del portal presentado como hecho del paciente) y esta. **Una prueba puede estar
protegiendo un defecto, y entonces el banco verde es una promesa falsa.**

Banco completo en **2.418/2.418** con `TZ=America/Bogota`.

---

## v17.8.1 — 27-ago-2026 (auditoría de experiencia: Tanda 1, todo lo que afirmaba algo falso)

Nueve mensajes que **afirmaban sin haber mirado**. El informe lo llama patrón G —*«el fallo
del sistema se presenta como un hecho del paciente»*— y es el que más veces viola la regla
fundacional: *«casilla vacía antes que dato inventado»*.

**Reproducido ejecutando el motor antes de tocar nada:**

| # | Decía | Lo que pasaba de verdad |
|---|---|---|
| 12 | «el paciente **está al día con su programa**» | `programa: null` — no se evaluó nada |
| 96 | `foco: "lipídico"` | sin programa y sin ejes: el foco se inventaba |
| 87 | «PA Descontrolada **(165/NaN)**» | literal; con diastólica 0, «(165/0)» |
| 26 | «No se encontraron paraclínicos **para este paciente**» | salía también con el portal caído |
| 13 | «falta **peso**» | faltaba la **creatinina**, con el peso impreso dos filas arriba |
| 34 | «**Todo ya estaba escrito**» | también cuando **nada casó** con ninguna casilla |
| 59 | `#PACIENTE_SIN_ID_#RCV_CONTROL_2026_08` | palabra de programador **en la historia clínica** |
| 14 | «(`_documentados`, `dislipidemiaDocumentada`)» | claves internas en un aviso al médico |
| 156 | «la telemetría **no sale de este equipo**» | Ajustes tiene un interruptor que la envía |

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Volver a decir «al día» sin programa | *REGLA D — «al día con su programa» solo si HUBO un programa que evaluar* |
| 2 | Que el foco vuelva a caer en «lipídico» | *el foco de la consulta no se inventa cuando no hay con qué decidir* |
| 3 | Devolver el `NaN` a la píldora | *nunca una cifra imposible ni una palabra de programador en la píldora* |
| 4 | Devolver las claves internas al aviso | *el aviso de cambios habla en idioma de consultorio, no en claves* |
| 5 | Que la telemetría vuelva a prometer que no sale | *la telemetría dice a dónde va de verdad, según el interruptor* |
| 6 | Que el fallo del portal vuelva a ser un hecho del paciente | *un fallo del portal NO se presenta como un hecho del paciente* |

### La REGLA D, que es lo que impide la décima

Las nueve son la misma clase de defecto, así que además de arreglarlas se fija el invariante:
**un mensaje tranquilizador exige evidencia de que se evaluó algo**. Se ancla en el Panel, que
es lo que el médico mira antes de decidir qué ordenar.

### Dos pruebas que fijaban el defecto, no la regla

- **`suite_15`** exigía que, con el portal caído (`onerror("sin red")`), la pantalla dijera «no
  se encontraron paraclínicos **para este paciente**». Estaba fijando exactamente la mentira
  del hallazgo #26. Se reescribió para exigir la distinción correcta; lo que protegía de
  verdad —que no se inventen resultados de ejemplo— sigue exigido.
- **`suite_67`** (v17.8.0) hizo lo mismo con la jerga del papel del paciente.

### Tres tropiezos míos, y qué enseñó cada uno

1. **Un arreglo que habría borrado el análisis y plan entero.** Para quitar el `SIN_ID` del
   encabezado escribí `r.texto = ""`… y `r.texto` es **toda la redacción** que el médico va a
   firmar, no el encabezado. Lo vi al releer el contexto antes de correr nada. Ahora se quita
   **la línea** del encabezado. *Un arreglo que destruye trabajo es peor que el defecto.*
2. **El primer arreglo del #12 no hacía nada.** Comprobaba `d.programa`, que es un **objeto**
   (`{rector, rotulo, inscritos, porQue}`) y por tanto siempre verdadero. Lo cazó la prueba de
   la REGLA D en su primera corrida: la aserción falló con el objeto entero impreso. Lo que
   dice si hubo programa es `rector`.
3. **La distinción `null` vs `[]` ya existía y se tiraba.** `getAtheneaLabsAuto` está escrita a
   propósito para separar «no pude leer» de «no hay nada», y el modal aplastaba las dos en un
   array vacío. No hubo que inventar nada: solo dejar de perder lo que el motor ya sabía.

Banco completo en **2.416/2.416** con `TZ=America/Bogota`.

---

## v17.8.0 — 27-ago-2026 (auditoría de experiencia: Tanda 0, las tres reglas mecánicas)

Arranca el trabajo del enjambre de UI/UX y copywriting (19 agentes, 186 hallazgos brutos →
**178 sostenidos** tras refutación adversarial; 93 con riesgo clínico, 79 de gravedad alta).
La Tanda 0 son tres reglas que el proyecto **ya tenía escritas** —dos en CLAUDE.md, una en un
comentario del propio código— y que hasta hoy dependían de que alguien se acordara.

Nacieron **rojas a propósito**, con sus números exactos:

| Regla | Al nacer | Al cerrar |
|---|---|---|
| A — toda bandera emitida declara su propio fondo | 2 sin regla | 0 |
| B — todo color fuera de `#vgl-root` lleva `!important` | 74 infracciones | 0 |
| C — el papel del paciente no lleva claves internas | 2 claves crudas | 0 |

### Regla A — dos avisos informativos llevaban meses pintados de rojo de alarma

`.vgl-flag.agpend` («🗓️ SIN TERMINAR») y `.vgl-flag.adic` («➕ CANDIDATO ADICIONAL») **no
existían en la hoja de estilos**, así que heredaban el fondo rojo de la regla base. El
comentario del código que las emite ya decía «ámbar, no rojo»; la regla nunca se escribió.

**Verificado en Chromium** con el CSS real y un «Everest» agresivo, antes y después:

    ANTES:   SIN TERMINAR        rgb(255,129,119)  <- el MISMO rojo que «NO CONFIRMADO»
             CANDIDATO ADICIONAL rgb(255,129,119)  <- idem
    DESPUÉS: SIN TERMINAR        rgb(255,196,107)  ámbar
             CANDIDATO ADICIONAL rgb(124,184,255)  azul

Gastar el rojo donde no hay alarma no confunde solo ese aviso: devalúa todos los demás.

### Regla B — la prueba que protegía la DEUDA en vez de la regla

Aquí la lección es sobre el banco, no sobre el CSS. Escribí la regla en `suite_70` y era
**más débil que una prueba que ya existía**: `suite_25` (Regla E) parsea el CSS de verdad y
veía 74 infracciones donde mi barrido por líneas encontraba 25.

Y esa prueba vieja llevaba las 74 anotadas en una `BASE_CONOCIDA`, comprobando que la lista
saliera **exactamente igual**. Eso no protegía la regla: **protegía la deuda**. Mientras el
número no se moviera, el banco quedaba verde con 74 declaraciones de color expuestas al CSS
de Everest — entre ellas `.vgl-ord-sexwarn`, el aviso que impide ordenar una citología a un
hombre.

Se pagó la deuda entera (55 declaraciones de color, +55 `!important`), la prueba pasa a
exigir **cero**, y se le añadieron los tres emergentes que nacieron después de escribirla
(`#vgl-confirma-modal`, `#vgl-ia-modal`, `#vgl-panel-modal`). Mi `suite_70` se retiró: dos
sitios para la misma regla es peor que uno.

El contador de `!important` (349 → 404) hizo su trabajo: saltó en rojo y obligó a escribir el
motivo. Se sube a mano, documentado.

### Regla C — un solo traductor de nombre de analito

Patrón C de la auditoría: «cuatro traductores conviviendo con precedencias distintas». Se veía
en el peor sitio posible — la hoja que el médico **imprime y entrega en la mano** al paciente
listaba `COLESTEROL_LDL`, `UROANALISIS`, `HBA1C`. Verificado ejecutando la función.

Causa exacta: `x.clave || x.nombre` — la preferencia estaba **invertida**. Ahora hay un
`mtrNombreLegibleAnalito` con precedencia fija y la Regla C impide que vuelva.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | Quitar la regla ámbar de `.vgl-flag.agpend` | `suite_70` | *ninguna bandera se pinta con un fondo que nadie declaró* |
| 2 | Quitar el `!important` del aviso de sexo | `suite_25` | *Regla E — color con selector de PANEL lleva !important* (y de paso la Regla G) |
| 3 | Invertir la precedencia del traductor | `suite_70` | *el traductor de analitos: precedencia fija y siglas intactas* |
| 4 | Que el respaldo vuelva a destrozar las siglas | `suite_70` + `suite_67` | *…siglas intactas* y *mtrHojaEducativaHtml: secciones según el resumen* |

### Cuatro cosas que salieron mal por el camino, y qué enseñó cada una

1. **Un comentario con backticks rompió el script entero.** El bloque CSS vive dentro de una
   plantilla de JavaScript: escribir `` `.vgl-flag` `` en un comentario CSS cierra la cadena.
   Sintaxis rota, banco sin arrancar.
2. **La mutación 3 no cayó dos veces seguidas.** La primera versión de la prueba usaba claves
   que están en el catálogo, y ahí el resultado sale igual por los dos caminos: la precedencia
   solo decide cuando la clave es **desconocida** y viene con nombre escrito a mano. Se
   escribió ese caso y entonces cayó.
3. **Mi propio respaldo destrozaba las siglas.** Convertía «LDL» en «Ldl». Lo cazó `suite_67`.
   Ahora, sin guion bajo no se toca nada.
4. **El banco de verificación en Chromium se daba la razón a sí mismo.** Dos errores a la vez:
   la sonda que calculaba el color esperado usaba estilo en línea —que **pierde** contra el
   `!important` de la hoja simulada—, y yo había añadido a la simulación un
   `background:transparent !important` que ninguna hoja real escribe. Con los dos, todo salía
   «FALLA» con el mismo valor. Un banco que no puede pasar no mide nada, igual que uno que no
   puede fallar.

### Una prueba se reescribió a propósito

`suite_67` exigía que en el papel apareciera literalmente «RAC». Lo que protege —que los
pendientes se listen— sigue valiendo; lo que ya no vale es exigir la jerga: ahora dice
«Relación albúmina/creatinina», y se le añadió la aserción de que **ninguna** clave del
catálogo puede quedar en ese papel.

La verificación en Chromium queda como herramienta reutilizable en
`tools/verificar_color_chromium.js` — fuera de `tests/` a propósito: el banco no puede
depender de que haya un navegador instalado.

Banco completo en **2.411/2.411** con `TZ=America/Bogota`.

---

## v17.7.5 — 27-ago-2026 (la última rama del spec sin construir, y una que era mejor no construir)

Cierra el MOTOR RCV v68. Dos puntos abiertos, y **solo uno terminó en código** — porque el
otro, medido, no lo necesitaba.

### El RAC: la cláusula existía, el hueco era real

v68 dice, dentro del bloque del ANR: *«RAC sincroniza si venc<=Vc+60d y reinicia»* (Vc =
vencimiento de la creatinina). Nunca se construyó.

**Medido con el arnés ANTES de escribir la línea:**

| | |
|---|---|
| Planes barridos | 2.016 |
| Con el ANR activo | 672 |
| Con el RAC dentro de la ventana Vc+60d | 480 |
| **De esos, DIFERIDOS** (segundo viaje solo por el RAC) | **72** → después: **0** |

Vector representativo: RAC de hace 10 días con vigencia de 90 (override por RAC≥30), vence a
49 días de la toma; el margen del 33 % (29,7 d) lo difería.

**Contención, sobre 2.688 planes:**

| | |
|---|---|
| Cambian la fecha de toma | **0** |
| Cambian la fecha de control | **0** |
| Cambian la lista | 88 — y en los 88 lo único que cambia es que **se añade el RAC** |

Misma forma y misma contención que la creatinina de v17.6.98: solo AÑADE un examen a la toma
que ya existe. El «reinicia» del spec ocurre solo — al tomarse la muestra ese día, los 90 días
vuelven a contar desde ahí.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Quitar la sincronía del RAC | *el RAC que vence dentro de Vc+60d entra en la toma*, *no mueve ninguna fecha* y *el barrido* |
| 2 | Sincronizar el RAC SIEMPRE (ventana a 99999) | *fuera de la ventana de 60 días, el RAC sigue la regla general* |
| 3 | Sincronizar el RAC sin comprobar el ANR | *fuera de la ventana…* **y** *sin ANR, la cláusula no existe* |

### Las fusiones MTT: la cláusula ya se cumplía, y **no** se escribió código

El spec pide `order_list = incluidos + drivers debidos + pasajeros no bloqueados + MTT
fusionados`. En el código `order_list` es solo `claves(plan.ordenar)` y las fusiones salen por
un campo aparte. Sobre el papel, un hueco.

**Medido: 1.440 planes, 128 con fusión, y cero fusiones fuera de `order_list`.** No es
casualidad, es el mecanismo: una fusión exige que la toma caiga EN O DESPUÉS de la fecha de
recontrol, y un analito cuyo recontrol ya venció para cuando llega la toma entra al plan por
su propio pie.

Añadir la unión explícita habría sido **una línea que ninguna mutación puede matar** — no
cambia nada en ningún caso alcanzable. Este proyecto ya arrastra bastantes ramas inertes, y
la disciplina de mutación existe justamente para no añadir más. Lo que sí faltaba era la
prueba: convierte la coincidencia en un invariante que se pondrá rojo el día que la Cosecha
cambie. Anotado como observación en la tabla del spec.

### El guardián del banco cazó mi propia válvula de escape

La primera versión de la prueba «fuera de la ventana» llevaba un `if` con un
`t.cierto(true, "este vector no cae fuera de la ventana…")` de reserva. `suite_34` (M4-AST)
la marcó como **tautología** y puso el banco en rojo, con el número de línea. Tenía razón: una
prueba que puede pasar sin comprobar nada no es una prueba. Se localizó con el arnés un vector
real donde el RAC vence 79 días después de la creatinina, y ahí sí se afirma que sigue
diferido. Segunda tautología, en el caso «sin ANR», cazada por lo mismo y sustituida igual.

Banco completo en **2.408/2.408** con `TZ=America/Bogota`.

---

## v17.7.4 — 27-ago-2026 (la causa real: Athenea llama «orina» a un examen de sangre)

**El diagnóstico del médico resolvió lo que ningún informe podía adivinar.** La v17.7.1 dijo
explícitamente que NO se afirmaba conocer la causa de la creatinina que faltaba, y se le
entregó un diagnóstico de consola. Él lo corrió. Esto es lo que devolvió:

    CREATININA EN SUERO. ORINA U OTROS
    GLUCOSA EN SUERO. LCR U OTRO FLUIDO DIFERENTE A ORINA

Athenea nombra los exámenes con la nomenclatura del laboratorio, y **dos analitos DE SANGRE
llevan la palabra «orina» dentro de su propio nombre**. El segundo dice literalmente
*«diferente a orina»* y el patrón `/\bORINA\b/` se quedaba con la palabra suelta.

**El daño era doble, y la mitad no estaba reportada:**

| | |
|---|---|
| Desaparecían de la tabla, absorbidos por el bloque «Uroanálisis» | 31 analitos contados dentro del acordeón en la paciente real |
| **Y no casaban con NINGUNA casilla** (`_matchLabInWhitelist` → `null`) | la creatinina sérica es la que manda el estadio renal, las vigencias y el ANR |

Lo segundo no lo reportó nadie porque es invisible: un examen que no casa con su casilla no
da error, simplemente no está.

**La regla nueva:** si el nombre declara la muestra (`EN SUERO`, `SÉRICA`, `EN SANGRE`,
`PLASMA`, `DIFERENTE A ORINA`), esa declaración **manda** sobre cualquier mención suelta de
orina. El laboratorio es explícito a propósito; quedarse con una subcadena es justo el error
que este proyecto ya cometió al revés en v12.3.37 (hemoglobina de orina cayendo en la casilla
sérica). Por eso la prueba 2 comprueba que esa guarda vieja sigue entera: arreglar un sentido
sin romper el otro es la mitad del trabajo.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| A | Quitar la precedencia de la muestra declarada | `suite_08` | *un examen DE SANGRE cuyo nombre contiene «orina» no es de orina* **y** *el bloque «Uroanálisis» deja de tragarse exámenes de sangre* |
| B | Quitar `DIFERENTE A ORINA` del patrón | `suite_08` | *un examen DE SANGRE cuyo nombre contiene «orina» no es de orina* |
| C | Devolver la exclusión «ORINA» sobre un nombre sérico | `suite_08` | la misma |

**La mutación B no cayó a la primera**, y eso fue información: el nombre real ya casaba por
`EN SUERO`, así que la alternativa `DIFERENTE A ORINA` no cargaba peso propio. En vez de dar
la mutación por buena se le escribió su caso —un nombre que declara la muestra SOLO por
descarte— y se **anotó en la prueba que ese nombre es construido, no observado en campo**,
para que nadie lo lea después como evidencia real.

Banco completo en **2.402/2.402** con `TZ=America/Bogota`.

---

## v17.7.3 — 27-ago-2026 (la hoja de hechos completa)

**Encargo textual del médico (27-ago):** *«la IA debe recibir todo el JSON de Everest ya que
toda esa información sirve de grounding para redactar una excelente nota clínica: se debe
mandar el examen físico, medicamentos actuales, laboratorios actuales, exámenes por vencer,
clasificación del riesgo cardiovascular, etc.»*

Todo lo que sigue **ya estaba calculado en el script** y nadie lo copiaba a `mtrHojaDeHechos`:
el modelo opinaba con menos datos de los que el propio asistente tenía en la mano.

| Añadido | Por qué faltaba |
|---|---|
| Peso y **cintura** | nadie los copiaba (la cintura se lee por rótulo desde v17.6.97) |
| Uroanálisis y paraclínicos de texto | el filtro `typeof c.valor !== "number"` descartaba **todo** resultado descriptivo |
| Síndrome metabólico con sus criterios | calculado en el resumen, nunca leído aquí |
| Plan: FTL, control, qué se va a ordenar, ANR | ídem |
| Exámenes **diferidos** | se ven en pantalla desde hace versiones; la IA podía recomendar pedir algo que el plan aplazó |

**Dos cosas que la prueba obligó a pensar mejor:**

1. **Un renombre de etiqueta habría roto un filtro en silencio.** Iba a llamar «Examen
   físico:» a la línea que ahora lleva PA, peso, IMC y cintura. `suite_57` se puso roja y al
   mirar por qué apareció el motivo real: «Signos vitales:» es uno de los prefijos de
   `MTR_EA_PREFIJOS_PROHIBIDOS`, la segunda capa que borra de la Enfermedad Actual las líneas
   que el modelo copie tal cual de la hoja. Compara **texto exacto**: renombrarla la habría
   dejado sin reconocer su propia línea, sin error visible. Se conserva la etiqueta.
2. **Un dato que llega al JSON y que el filtro no conoce es un boquete nuevo.** Los cinco
   bloques añadidos son DATOS (pertenecen a Análisis y Plan, no a la Enfermedad Actual), así
   que se registran los cinco prefijos nuevos en esa lista, con su prueba.

**Regla de la casa, verificada explícitamente:** lo que no consta se **omite** (`null` / lista
vacía), nunca se rellena. Hay una prueba entera dedicada a eso: sin cintura no se estima por
el IMC, sin uroanálisis no se declara «sin hallazgos», sin plan no se inventan fechas.

Banco en **2.399/2.399** al cerrar esta entrega.

---

## v17.7.2 — 27-ago-2026 (que el código deje de contradecirse a sí mismo)

Entrega de **cero cambios de conducta**: comentarios, spec y una prueba. Ninguna fecha se
mueve, ninguna orden cambia. Va aparte a propósito, para que las entregas que sí tocan lo que
se ordena lleguen limpias.

**Tres comentarios del motor afirmaban lo que su propia línea de código desmentía:**

| Decía | La línea de al lado hacía |
|---|---|
| «techo de 22» (`:31422`) | `MTR_TECHO_ESTADO_A = 21` desde v16.9.0 |
| «Agujero Negro Renal: en G3a-G4» (`:31455`) | `MTR_ESTADIOS_ANR` incluye **G5** |
| `mtrVentanaAnrDias(..., false)` a secas (`:31472`) | una decisión medida, con pinta de cabo suelto |

Un comentario que miente es peor que no tener comentario: el siguiente que lo lea —yo
incluido— lo tomará por cierto.

**El error que estuve a punto de cometer, y por qué no lo cometí.** El plan aprobado decía
«retirar la rama muerta `if (vigilanciaEstrecha) return 30;`». Antes de borrarla la medí:
**44 de los 242 vectores dorados** de `tests/golden/ventana_anr_dias.json` dependen de ella.
No es código sobrante — es port fiel del Copiloto Python, y borrarlo habría roto la
conformidad cruzada. *Muerta en producción no es lo mismo que sobrante.* Se queda, y lo que
se corrige es que su `false` lleve al lado el porqué (decisión del médico del 27-ago: el
mecanismo está invertido respecto a v68 y estrechar la ventana **desprotegería** —51 planes
perderían la agrupación en pacientes con sospecha de daño renal agudo).

**Cuatro divergencias que llevaban tiempo sin declararse** se añaden a la tabla de
`MOTOR_RCV_V68_SPEC.md`: el techo 21 vs 22, el ANR en G3a-G5, las ventanas 45/60/90 en vez de
30/45/60, y la vigilancia estrecha presente pero nunca activada.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | Devolver el comentario «techo de 22» | `suite_38` | *ningún comentario del motor contradice a su propia constante* |
| 2 | Devolver el rótulo «G3a-G4» del ANR | `suite_38` | la misma |
| 3 | Borrar `if (vigilanciaEstrecha) return 30;` | `suite_38` + `suite_43` | *la rama de 30 días NO se borra: la fijan los vectores dorados*, *el ANR solo existe de G3a en adelante* y **los 242 vectores dorados contra `motor_vigencias.py`** |

La mutación 3 es la que importa: reproduce exactamente el borrado que el plan pedía, y hace
caer los vectores dorados. La red que impide ese error ya existía; lo que faltaba era una
prueba que dijera **por qué** esa rama no se toca, para que el siguiente no tenga que
descubrirlo midiendo.

Cada mutación aplicada una a la vez, restaurada verificando con `diff`. Banco completo en
**2.393/2.393** con `TZ=America/Bogota`.

---

## v17.7.1 — 27-ago-2026 (reportado en consulta: falta un analito en el historial de paraclínicos)

**El reporte, textual:** *«el módulo de laboratorios no está reportando todos los analitos,
por ejemplo falta la creatinina en esta paciente que fue tomado también ahora en agosto»*.

**Lo que se encontró, y lo que NO se arregló todavía.** Rastreada la cadena entera de Athenea
hasta la fila pintada, la tabla del Historial de Paraclínicos llevaba **dos contadores que se
calculan y no se enseñan nunca**:

| Contador | Dónde se calcula | Quién lo leía |
|---|---|---|
| `__vglIncompleto` — solicitudes que Athenea no devolvió | `_getAtheneaLabsAutoNucleo` | solo el aviso de PyM; **la tabla no** |
| `_labViejasOcultas` — filas con más de 365 días | el propio filtro del modal | **nadie** |

Y un detalle que lo hacía irrecuperable: `__vglIncompleto` viaja como propiedad **no
enumerable** del array de Athenea, y la línea siguiente copia analito a analito a OTRO array
— el marcador se perdía justo después de escribirse.

Con los dos callados, una lectura **a medias** se presentaba con el mismo aspecto que una
completa. En consulta eso no se lee como «faltó una orden»: se lee como **«no se lo
hicieron»**. Es la regla de la casa —casilla vacía antes que dato inventado— incumplida por
omisión.

**Lo que esta versión NO afirma.** No se ha demostrado que ESA sea la causa del caso concreto
que él reportó. Hay tres formas de que una fila desaparezca y desde fuera se ven idénticas:
(A) una orden que Athenea no devolvió, (B) la fila absorbida dentro del bloque «Uroanálisis»
—`_agruparUroanalisisParaTabla` sigue sin el segundo filtro `_matchUroComponente` que sí
tienen los demás llamadores, admitido en el comentario de la propia función—, y (C) más de
365 días. Se entrega `DIAGNOSTICO_LABS_FALTANTES.js` para que el médico lo corra y lo
discrimine, en vez de escribir un arreglo a ciegas.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| A | `if (noLeidas > 0)` → `if (false)` | `suite_08` | *una lectura incompleta de Athenea se dice, no se disimula* **y** *las filas ocultas por antigüedad también se dicen* |
| B | `if (ocultas > 0)` → `if (false)` | `suite_08` | *las filas ocultas por antigüedad también se dicen* |
| C | Quitar el `return ""` cuando no hay nada que advertir | `suite_08` | *sin nada que advertir, el aviso NO sale* |
| D | Desconectar `mtrAvisoTablaLabsHtml` de `contentEl.innerHTML` | `suite_08` | *CABLEADO — la tabla pinta el aviso y lo lee antes de copiar* |
| E | Leer `__vglIncompleto` DESPUÉS del `forEach` que copia | `suite_08` | la misma |

Las mutaciones D y E fijan el **cableado** sobre el texto fuente, no la pieza: el modal es
asíncrono y depende de la red de Athenea, así que una prueba de comportamiento no lo alcanza.
Es la lección de v17.6.93/94 —probar la pieza no es probar que la pieza está conectada—
aplicada con el único instrumento disponible aquí.

Cada mutación aplicada **una a la vez** sobre el archivo de producción, restaurada verificando
con `diff` contra copia intacta. Banco completo en **2.391/2.391** con `TZ=America/Bogota`.

---

## v17.7.0 — 27-ago-2026 (reportado en consulta: el cuadro de fuentes no recibía el cambio en tiempo real)

**El reporte, textual:** *«me está mostrando en este módulo que yo no marqué en la historia
la hipertensión pero sí la marqué, y no recibió el cambio en tiempo real»*.

**Lo que se midió ANTES de tocar nada** (barrido con el arnés sobre los 25 campos de
`MTR_CAMPOS_FACTORES`, 6 transiciones cada uno = 150):

| | |
|---|---|
| Transiciones que NO movían `_tableroFirmaDom` | **18 de 150** |
| Campos afectados | ECV (las tres casillas, cuando otra ya estaba en «Sí»), autoinmunes, EPOC, alcohol, ejercicio permanente, ronca, somnolencia, cansancio |
| Tras el arreglo | **0 de 150** |

Corrige de paso mi propia hipótesis inicial: yo esperaba que el flanco perdido fuera
«blanco → No», y no lo era — ese lo cubría `_documentados`. El que se perdía era **«No → Sí»
en los campos que no llegan a la salida derivada**. Medir antes de escribir código es lo que
lo separó.

**Tres causas raíz, tres arreglos:**
1. `_leidos` no entraba en la firma de pantalla (se descarta por ser objeto).
2. El reconciliador se calculaba UNA vez, al abrir el Panel, y el HTML del cuadro es
   estático. **Esta es la causa directa del reporte.**
3. Una confirmación vieja pisaba la pantalla en silencio, sin caducidad, y contaminaba
   `_leidos` antes de llegar a `mtrDiscrepanciasDeFuentes`.

**Un bucle que el banco cazó a tiempo:** al hacer que «la pantalla mande», el valor
*archivado* (de una pestaña visitada hace rato) también contradecía la confirmación, así que
el cuadro preguntaba lo mismo para siempre. `suite_63` se puso roja y obligó a la precedencia
correcta: **archivo < confirmación < pantalla en vivo**. Sin esa prueba vieja, esto se habría
entregado.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | `const L = f._leidos` → `const L = null` (quitar `_leidos` de la firma) | `suite_63` | *la firma de pantalla ve TODAS las casillas* → *marcar EPOC de No a Sí tiene que contar como «algo cambió»* |
| 2 | `String(L[k])` → `String(!!L[k])` (recolapsar el tri-estado) | `suite_63` | *la firma de pantalla ve TODAS las casillas* → *dos casillas que se cruzan siguen siendo un cambio* |
| 3 | La confirmación vuelve a pisar la pantalla incondicionalmente | `suite_63` | *la casilla que él acaba de escribir manda sobre una confirmación vieja* **y** *el reconciliador vuelve a preguntar SOLO lo que la historia contradice* |
| 4 | La confirmación deja de rellenar la casilla vacía | `suite_63` | *la casilla que él acaba de escribir…* → *si la historia no dice nada, su respuesta rellena el hueco* |
| 5 | El filtro de `frenan` ignora las desfasadas | `suite_63` | *el reconciliador vuelve a preguntar SOLO lo que la historia contradice* |
| 6 | El cuadro no deja armado su `setInterval` de repaso | `suite_63` | *el cuadro de fuentes deja armado su propio repaso de 20 s* |
| 7 | `leidos: f._leidos` → `leidos: {}` (el reconciliador deja de mirar la historia) | `suite_63` | *RECONCILIADOR de punta a punta* **y** *el reconciliador vuelve a preguntar SOLO…* |
| 8 | `cabecera: {…}` → `cabecera: {}` (se pierde la cabecera como fuente) | `suite_63` | las mismas dos |

**Dos mutaciones que NO cayeron a la primera, y qué se hizo con cada una** — porque una
mutación que no cae es información, no un trámite:

- **La #2, en su primer intento.** `String(L[k])` y `String(!!L[k])` solo se diferencian en
  `null` vs `false`, y con un único campo cambiando eso ya lo delataba `_documentados`. En vez
  de dar la mutación por buena, se buscó el caso donde el tri-estado sí es estrictamente más
  fuerte —dos casillas cruzándose en el mismo repaso— y se le escribió su prueba. Entonces
  cayó.
- **Una mutación descartada por ser no-op del entorno.** Pasar `doc: null` a
  `mtrLeerFactoresRcvDelDom` dentro de `mtrReconciliarAhora` no rompía nada porque la función
  cae al `document` global, que en el arnés es el mismo objeto que la prueba había montado. No
  probaba nada: se sustituyó por la #7, que corta la fuente de verdad.

Cada mutación se aplicó sobre el archivo de producción **una a la vez**, restaurando con
`diff` contra copia intacta antes de la siguiente (las 8 restauraciones verificadas). Banco
completo en **2.386/2.386** con `TZ=America/Bogota` tras la restauración final.

**Queda anotado, no entregado:** los medicamentos que alimentan el reconciliador salen del
resumen en caché y `labsPorClave` va en `null`, así que la fuente Laboratorios está apagada en
esa comparación. Cambiarlo mueve qué discrepancias se emiten y merece su propia medición.

---

## v17.6.99 — 27-ago-2026 (reportado en consulta: un examen ya hecho se seguía ofreciendo)

Reporte del médico, en vivo: *«me sale que hay que enviarle el antígeno de próstata pero ya se
lo realizó y me sigue mostrando para enviárselo; habíamos quedado que lo que ya está realizado
no se vuelve a ordenar»*. En su pantalla el PSA aparecía hecho **seis días antes**.
Banco antes: 2.376 · después: **2.382**.

### La causa, reproducida

El script **reconoce el PSA perfectamente**. Lo comprobé: al mismo paquete, con una vigencia
puesta a mano, lo detecta como hecho sin problema. El defecto era una sola cosa: el paquete
`Z125` no tenía `vigenciaDias`, y `pymPaqueteCubiertoPorAthenea` se rendía en su primera
línea con cualquier paquete que no la tuviera:

```js
if (!pkg || !pkg.vigenciaDias || !Array.isArray(labs) || !labs.length) return false;
```

Ese `return false` significa «no está hecho», así que el paquete se volvía a ofrecer
premarcado. **Cinco de los ocho paquetes del catálogo estaban así** y nunca se cruzaban
contra Athenea: PSA, mamografía, citología, tamización cardiometabólica y hemoglobina. Cada
uno con el mismo comentario escrito al lado: *«vigenciaDias: sin confirmar (Resolución
3280/2018) — pregunta abierta para el médico»*. La pregunta nunca se le hizo.

Y **`pymPaqueteCubiertoPorAthenea` no tenía ninguna prueba**: se podía cambiar entera y el
banco seguía verde.

### El arreglo

1. **Vigencia del PSA: 730 días**, confirmada por el médico al reportarlo (27-ago).
2. **Se separan dos preguntas que estaban en una**, porque solo la segunda necesita una
   vigencia declarada:
   - *¿está hecho?* → `pymPaqueteHechoEnAthenea` devuelve `{iso, dias}` o `null`.
   - *¿sigue vigente?* → `pymPaqueteCubiertoPorAthenea`, ahora una línea sobre la anterior.
   Una sola forma de reconocer el examen; la vigencia aplicada aparte.
3. **El modal cruza TODOS los paquetes**, no solo los que tienen vigencia — ese filtro *era*
   el defecto. El coste de red no cambia: sigue siendo una consulta por paciente, cacheada.
4. Para los que siguen sin vigencia confirmada: se avisa con la fecha y no se da por cubierto.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| **1** | El PSA pierde su `vigenciaDias` | *el PSA hecho hace seis días ya NO se vuelve a ofrecer* |
| **2** | Se ignora la vigencia: cualquier resultado cuenta como cubierto | *…* (la aserción de los 955 días) |
| **3** | Un examen `PENDIENTE` pasa a contar como hecho | *un examen PENDIENTE no cuenta como hecho…* |
| **4** | Se queda con el PRIMER resultado en vez del más reciente | *se queda con el resultado MÁS RECIENTE cuando hay varios* |
| **5 · CABLEADO** | Vuelve el filtro `paquetesConVigencia` | *el modal cruza TODOS los paquetes y respeta el tope* |
| **6** | Se quita el tope de 730 días para desmarcar | *…y respeta el tope para desmarcar* |

Las seis se aplicaron sobre el archivo de producción **una a una**, restaurando con `diff`
contra copia intacta antes de la siguiente; cada corrida dejó rojo con la aserción exacta
esperada y el banco volvió a 2.382/2.382 tras cada restauración.

### Una decisión que se tomó por él, y por qué

El médico decidió que un examen ya hecho se avise **y se desmarque**, aunque no se sepa cada
cuánto se repite. Estaba respondiendo sobre un PSA de **seis días**.

El caso que no tenía delante es el contrario: una mamografía de **hace 955 días** también
«aparece hecha». Desmarcarla en silencio ya no evita un duplicado — provoca una **omisión**,
que es peor. Así que el aviso se da siempre, con su fecha y los días, pero la casilla solo se
desmarca si el resultado es más reciente que el intervalo **más largo que él mismo ha
confirmado** para cualquier examen: los 730 días del SOMF (22-ago) y del PSA (27-ago). No es
una vigencia inventada para la mamografía; es negarse a suponer que algo sigue bueno más allá
de lo que él ha dado por bueno alguna vez. Queda en una constante con nombre y se cambia con
una línea si prefiere lo otro.

## v17.6.98 — 27-ago-2026 (el ANR agrupa de verdad)

Último punto de la Fase 3, y el único que toca la orden de laboratorios de un paciente real.
Banco antes: 2.369 · después: **2.376**.

El «agujero negro renal» existe para que un paciente con enfermedad renal G3a-G5 no haga dos
viajes al laboratorio. **No agrupaba.** `mtrPlanParaclinicos` se limitaba a un `Math.min`
contra la fecha ya calculada; si otro examen vencía antes, el ANR se marcaba igual y la
creatinina caía en la regla genérica del 33 % y se iba a `plan.diferidos`. v17.6.90 corrigió
el TEXTO para que dejara de afirmar una agrupación que no ocurría, y dejó anotado que la
agrupación real iba aparte. Es esta.

### El daño, medido antes de tocar nada

Barrido de **240 planes con el ANR activo** (ERC G3b, creatinina de 40 a 120 días, resto de
analitos de 10 a 260):

| | antes | después |
|---|---|---|
| La creatinina ya mandaba la fecha | 88 | 88 |
| **Franja de dos viajes** | **26** | **0** |

### Por qué NO se aplicó la regla literal de v68

El spec dice *«HOY<Vc<=HOY+ventana → Vc=FTL Maestra; todos drivers A/D se agrupan en Vc»*:
mover la toma al vencimiento de la creatinina. Medido: en **0 de esos 240 casos sería
seguro**. Por construcción, si la creatinina no es ya la primera en vencer es porque algo la
adelanta, y retrasar la toma hasta Vc o deja vencer otro examen (reproducido: la glicemia se
pasaría 27 días) o hace esperar más a uno ya vencido. v68 pone CERO VENCIDOS en S0, por
encima de la logística de S3, así que **su propia jerarquía prohíbe aplicar su regla al pie
de la letra**. La única vía es la contraria: traer la creatinina a la toma que ya hay —
divergencia declarada frente al *«Creatinina-ancla no se fuerza»* del spec, decidida por el
médico el 27-ago tras ver estas cifras.

### Contención, verificada sobre 1.224 planes

| | |
|---|---|
| Planes donde cambia la **fecha de toma** | **0** |
| Planes donde cambia la **fecha de control** | **0** |
| Planes donde cambia la lista de órdenes | 78 |
| De esos 78, aquellos en que lo ÚNICO que cambia es que **se añade la creatinina** | **78** |

Nada se quita, ningún otro analito se toca, ningún día se mueve. El cambio vive en el bucle
de cosecha, que corre DESPUÉS de fijar la fecha.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| **1** | Se quita la línea del forzado | *con el ANR activo la creatinina NO se difiere nunca*, *…SOLO la creatinina…*, *PUNTA A PUNTA: la franja queda cerrada* y *el ANR AGRUPA…* → **4 rojas** |
| **2** | Se fuerzan **todos** los analitos, no solo la creatinina | *se fuerza SOLO la creatinina, no todo lo que tenga margen* |
| **3** | Se fuerza la creatinina **sin** comprobar el ANR | *SIN ANR, la creatinina sigue la regla de siempre — el cambio no se desborda* |
| **4** | `MTR_COSECHA_MARGEN_PROP` vuelve a 0.25 | *el margen de la cosecha es el 33 %…* |
| **5** | `mtrPriorityFocus` deja de mirar `plan.anr` | *un ANR activo enciende el foco RENAL* |

Las cinco se aplicaron sobre el archivo de producción **una a una**, restaurando con `diff`
contra copia intacta antes de la siguiente; cada corrida dejó rojo con la aserción exacta
esperada y el banco volvió a 2.376/2.376 tras cada restauración.

**La mutación 4 tapa un agujero que llevaba abierto desde v17.6.0.** El propio informe
documentaba que subir la cosecha de 25 % a 33 % estaba protegido por una prueba… **que ya no
existe**. Se verificó: antes de esta versión se podía cambiar ese número y el banco seguía
entero en verde. La regla nueva se apoya justo en él, así que se le puso su prueba.

**Una prueba se reescribió a propósito, no se borró.** `suite_47` tenía un caso —*«un ANR que
no agrupó NO dice que agrupó»*— que **fijaba el defecto**: exigía que la creatinina quedara
FUERA de la toma. Lo que ese caso protege de verdad es que el texto y el plan nunca se
contradigan, y eso sigue valiendo; se le dio la vuelta para exigir lo mismo sobre la conducta
nueva («agrupó y lo dice»). La rama «NO entra en esta toma» de `mtrTextoAnr` se sigue
probando en su caso unitario, así que no se perdió cobertura de esa frase.

### Lo que NO se entregó, y por qué

El médico autorizó también **cablear la vigilancia estrecha** — el tercer parámetro de
`mtrVentanaAnrDias`, que fuerza la ventana a 30 días y que ningún llamador de producción usa
nunca (código muerto reconocido en la auditoría del 25-ago). El plan llevaba una puerta de
seguridad: medirlo antes de entregarlo. **La puerta se disparó.**

Estrechar la ventana a 30 días hace que el ANR se active MENOS, y con la regla nueva eso
significa agrupar MENOS. Medido sobre pacientes con sospecha de deterioro agudo de la función
renal: la creatinina pasaría de agruparse en **180** planes a **90**, y **51 planes perderían
la agrupación** — justo en los pacientes a los que más conviene medirles la creatinina pronto.

La causa es que la semántica se invirtió con el mecanismo: en v68 el ANR RETRASA la toma
hasta Vc, y ahí una ventana estrecha protege; aquí el ANR ADELANTA la creatinina, y una
ventana estrecha desprotege. Queda reportado al médico y sin entregar. (De paso, esto respalda
su decisión de no bajar las ventanas a las de v68: con este mecanismo, más estrechas es peor.)

## v17.6.97 — 27-ago-2026 (la cintura era la cadera, y no se podía leer por id)

Cuarto punto de la Fase 3. Banco antes: 2.361 · después: **2.369**.

`mtrLeerCinturaDelDom` leía `cinturaPelvica`. **Eso no es la cintura: es la CADERA.** Lo
confirmó el médico al ver su propia pantalla: *«Circunferencia abdominal es lo que es cintura
en Everest, y cintura pélvica es caderas»*. Como la cadera siempre mide más que la cintura,
cablearla habría marcado obesidad central en casi todo paciente → un factor de riesgo mayor
falso → meta de LDL más estricta → más exámenes. **No llegó a hacer daño porque la función
estaba MUERTA** (cero llamadores) desde que se escribió en v17.6.65. Se corrige antes de
darle ningún uso.

**Y no se puede leer por id.** El diagnóstico que corrió el médico en su pantalla el 26-ago
devolvió la fila antropométrica entera:

| rótulo | id |
|---|---|
| Peso (Kg) | `peso` |
| Talla (cm) | `Talla` |
| IMC | `IMC` |
| **Circunferencia abdominal (cm)** | **`alert_message`** |
| Perímetro Cefálico (cm) | `IMC` ← repetido |
| Perímetro Braquial (cm) | `alert_message` ← repetido |
| Pliegue Cutáneo Subescapular | `IMC` ← repetido |
| Pliegue Cutáneo del Tríceps | `alert_message` ← repetido |
| Perímetro de pantorrilla (cm) | `perimetroPantorrilla` |
| Cintura pélvica (cm) | `cinturaPelvica` |

Cuatro casillas comparten dos ids, ninguna tiene atributo `name`, y la cintura es una de las
repetidas. Solo es alcanzable por **rótulo**. La estrategia de `mtrLeerCampoPorRotulo` no es
una conjetura: es la misma de `DIAGNOSTICO_CINTURA.js`, que se ejecutó contra el Everest real
y devolvió el rótulo correcto para las diez casillas.

**Regla dura:** si el rótulo casa con MÁS DE UNA casilla, se devuelve `null`. Un id repetido
ya costó una lectura equivocada; una coincidencia ambigua no se resuelve eligiendo la primera.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| **1** | La cintura vuelve a leer `cintura pélvica` | *la cintura es la CIRCUNFERENCIA ABDOMINAL, nunca la cintura pélvica* → **2 rojas** |
| **2** | Con 2+ coincidencias se coge la primera en vez de `null` | *un rótulo que casa con DOS casillas devuelve null, no la primera* |
| **3** | Se quita el rango de plausibilidad (30–250 cm) | *una cintura imposible no pasa, y nunca se inventa* |
| **4** | El umbral del síndrome metabólico vuelve a `>` estricto | *el umbral del síndrome metabólico es MAYOR O IGUAL, como dice el consenso* |
| **5** | La obesidad central por perímetro deja de contar como FR mayor | *la obesidad central cuenta como FR mayor, con SU umbral* |
| **6 · CABLEADO** | El contexto lee la cintura y no la mete en los factores | *la cintura se lee en los cuatro sitios que la necesitan* |
| **7 · CABLEADO** | La cintura sale de la FIRMA de los 20 s | *…los cuatro sitios…* |
| **8 · CABLEADO** | La reclasificación de los 20 s pierde `cinturaCm` de la mezcla | *la cintura sobrevive a la reclasificación de los 20 s* |

Las ocho se aplicaron sobre el archivo de producción **una a una**, restaurando con `diff`
contra copia intacta antes de la siguiente; cada corrida dejó rojo con la aserción exacta
esperada y el banco volvió a 2.369/2.369 tras cada restauración.

**Dos umbrales distintos sobre la misma medida, y v68 los escribe distintos.** El de los FR
mayores es `obesidad(IMC>=30 o CA>94H/>90M)` —estricto—; el del síndrome metabólico es
`CA>=90H/>=80M` —mayor o igual—. Se respetan los dos tal como están escritos. El segundo era
además una divergencia silenciosa: el código tenía `>` donde el consenso dice `>=`, así que un
hombre de exactamente 90 cm no sumaba el criterio que la norma sí le cuenta. Afecta solo al
valor justo en el borde, pero el borde es donde se decide.

**Lo que gana el motor, medido:** el paciente clásico del programa (TG 200, HDL 35) pasaba de
`cumple: null` —«con lo que hay no se puede decidir», con solo 4 de los 5 criterios
evaluables— a un veredicto real. Y el dato sirve en los dos sentidos: con 104 cm **cumple**,
con 84 cm se puede **descartar**, cosa que antes tampoco se podía.

**La mutación 7 es la lección del peso, repetida.** En v17.6.75 el peso no entraba en la firma
de la vigilancia de 20 s, así que escribirlo en Examen físico no contaba como «algo cambió» y
el Panel no reclasificaba por él solo. La cintura habría heredado el mismo defecto: se lee en
tres sitios y se compara en un cuarto, y ese cuarto es el que decide si merece la pena releer.

**Un aviso sobre la mutación 4:** la primera vez se aplicó con un comentario de línea al final
(`// MUTACION 4`), que se tragó el resto de la sentencia y convirtió el `criterios.push(...)`
en un no-op. Cayeron cinco pruebas en vez de una — un rojo que no probaba lo que decía probar.
Se repitió con `/* … */` delante y entonces cayó la prueba correcta, y solo esa. Una mutación
mal formada es tan inútil como una prueba que no cae.

## v17.6.96 — 27-ago-2026 (el punto ciego de la HbA1c en el antiduplicado del paquete RCV)

Hallazgo que destapó la auditoría del hueco 8 y que allí se dejó fuera a propósito, por ser
una decisión propia del médico. Banco antes: 2.355 · después: **2.361**.

El paquete I10X («RCV EXPRÉS») ordena el CUPS **903426, Hemoglobina Glicosilada**, desde
v14.0.0 — está en `PYM_CATALOG` y salió de una orden REAL ya guardada en Everest. Pero
`pymRcvCubiertoPorAthenea`, que responde «¿lo que este paquete iba a pedir ya está hecho?»,
lo decidía mirando solo las 8 claves de `RCV_VIGENCIA_KEYS`, que no la incluyen.

**Reproducido:** diabético con TODO fresco de 30 días y la HbA1c en **11,2 % de hace 219
días** → `pymRcvCubiertoPorAthenea` devolvía `true`, la casilla del paquete se desmarcaba y
la pantalla afirmaba «🧪 Athenea ya tiene todos estos resultados vigentes — el paciente ya se
los hizo». Falso: el examen que el paquete iba a pedir llevaba 39 días vencido, con un valor
catastrófico.

**Dos listas que no hay que volver a confundir.** La exclusión de HbA1c es DELIBERADA y es
del médico (11-08-2026, textual: *«HbA1c… NUNCA entra en esta regla de vigencia (no todo
paciente es diabético)»*), pero habla del **aviso rojo de entrada**, que se le hace a TODO
paciente. El **antiduplicado** responde otra pregunta, sobre un paquete concreto y un
paciente concreto. Por eso el arreglo NO añade la clave a `RCV_VIGENCIA_KEYS`, sino que el
llamador la aporta —`opts.clavesExtra`— y **solo cuando consta la diabetes**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| **1** | `_analitosRcvVencidos` ignora `opts.clavesExtra` | *con clavesExtra, la HbA1c vencida SÍ se reporta*, *BLOQ ya no se disfraza de 180*, y la de punta a punta → **3 rojas** |
| **2** | La clave extra se pide **sin** comprobar la diabetes | *…PUNTA A PUNTA…* → *NO diabético con esa misma HbA1c vieja: sigue cubierto* |
| **3** | El consumidor deja de saltar `BLOQ` | *BLOQ ya no se disfraza de 180 — un examen que la norma niega se SALTA* |
| **4** | El traductor olvida `HBA1C: "hba1c"` | *HbA1c SÍ tiene mapeo…*, *BLOQ…*, *la regla del 50 % alcanza por fin a la HbA1c* → **3 rojas** |
| **5** | `_vigenciaDiasParaAnalito` deja de propagar `BLOQ` | *BLOQ ya no se disfraza de 180…* |
| **6 · CABLEADO** | El antiduplicado deja de pedir la clave extra | *…PUNTA A PUNTA…* — las de unidad siguen verdes, porque construyen `clavesExtra` a mano |
| **7** | Diseño (A): meter `HBA1C` en `RCV_VIGENCIA_KEYS` | **9 rojas**, entre ellas la que fija la decisión del médico: *_analitosRcvVencidos: HbA1c NUNCA entra en la regla, ni ausente ni vencido* |

Las siete se aplicaron sobre el archivo de producción **una a una**, restaurando con `diff`
contra copia intacta antes de la siguiente; cada corrida dejó rojo con la aserción exacta
esperada y el banco volvió a 2.361/2.361 tras cada restauración.

**La mutación 7 es la que más tranquiliza:** el diseño obvio —añadir la clave a la lista de
siempre— rompe nueve pruebas, y una de ellas lleva años fijando la decisión del médico. Las
barandas ya estaban puestas; lo que faltaba era la puerta correcta.

**Una prueba mía no cazó su propia mutación, y se arregló antes de entregar.** La primera
versión del caso de `BLOQ` usaba un paciente CON HbA1c presente. Al quitar el salto, la
comparación `dias > "BLOQ"` da `NaN`, que es `false`, así que el analito tampoco se reportaba
y la prueba seguía verde con el código roto. El caso que sí distingue es el del paciente que
**nunca** se la ha tomado: sin candidato, la rama de «nunca realizado» lo empujaría a
faltantes — un examen que la norma PROHÍBE pedir, anunciado como pendiente. Es la séptima vez
que este proyecto se lleva ese susto, y la regla que lo evita sigue siendo la misma: *una
aserción sobre el resultado final puede estar pasando por un camino distinto del que crees
estar probando*.

**Efecto secundario que vale la pena:** `HBA1C` llevaba en `MTR_CLAVES_CON_META` desde
v16.4.0 **sin ningún consumidor que le pasara esa clave**. Con el arreglo, la regla del 50 %
del médico alcanza por fin a la hemoglobina glicosilada: una HbA1c fuera de meta parte su
vigencia a la mitad (180→90, y 120→60 en ERC G4/G5), igual que el LDL. El descontrolado se
cita antes.

**Límite conocido, escrito para que no sorprenda:** si no hay resumen en caché no consta la
diabetes, así que la clave extra no se pide y el punto ciego persiste en ese camino. Es
deliberado —«no se sabe» no puede leerse como «sí»— y además ese camino ya está degradado por
completo (sin programa ni estadio, todas las vigencias caen a 180 planos), no solo para la
HbA1c.

## v17.6.95 — 27-ago-2026 (una sola tabla de vigencias: el ERC G5 tenía las más largas)

Hueco 8 del plan de fidelidad. Banco antes: 2.346 · después: **2.355**.

Convivían dos tablas de vigencias. El motor, el Panel, Agendar y Ordenar usan
`mtrVigenciaDiasNorma`; el **aviso rojo de entrada** y el **antiduplicado del paquete RCV**
eran los dos únicos sitios que seguían consultando la legacy. Barrido exhaustivo del camino
real (8 claves × 6 estadios × 3 programas × `esDM2` en ambos valores): **8 celdas divergen
de 48, y en las ocho la legacy da MÁS días. Ninguna al revés.** Toda la divergencia vive
dentro del programa ERC; DM2 y HTA no cambian en ninguna celda.

Dos causas distintas:

1. **No hay columna G5.** `vigenciaPorEstadio` devuelve `null` para los 15 analitos en G5 —
   honesto, dice «no lo sé»— y el consumidor traduce ese `null` a `RCV_VIGENCIA_DIAS`, que
   es **180 días planos: el valor más largo de toda la tabla**.
2. **No hay fila `rac` en ERC.** La Tabla 50 pide «micro albuminuria», que es otro analito
   (decisión deliberada de v14.1.2), pero el traductor mapea `RAC → "rac"`. El puente apunta
   a una fila que no existe → el mismo `null` → los mismos 180.

| celda | legacy | norma | exceso |
|---|---|---|---|
| GLUCOSA · ERC G5 | 180 | 60 | **+120 d, el triple** |
| CREATININA · ERC G5 | 180 | 93 | +87 d |
| CT / LDL / TG / URO / RAC · ERC G5 | 180 | 120 | +60 d cada uno |
| RAC · ERC **G4** | 180 | 120 | +60 d |

**Esto no es una decisión clínica nueva: es una que el médico ya tomó.** El propio código lo
dice en `MTR_MAPA_ESTADIO_ERC` (línea ~26525): *«D-4 (decisión del médico, 4-ago-2026): G5
hereda la columna G4 mientras el protocolo no tabule una propia. Sin esto el paciente MÁS
grave recibía las vigencias MÁS largas.»* Se aplicó al motor y nunca a la tabla legacy.

Reproducido de punta a punta, mismos exámenes y mismo día, cambiando solo el estadio:

| exámenes de hace… | ERC G4, aviso rojo | ERC G5, aviso rojo |
|---|---|---|
| 100 días | GLUCOSA, CREATININA | **ninguno** |
| 130 días | 6 exámenes | **ninguno** |
| 170 días | 6 exámenes | **ninguno** |

Y en el segundo llamador el defecto no se calla, **afirma**: con exámenes de 130 días,
`pymRcvCubiertoPorAthenea` devolvía `true` para un G5 y la pantalla decía «🧪 Athenea ya
tiene todos estos resultados vigentes — el paciente ya se los hizo». (La casilla nunca se
bloquea —decisión del médico del 20-ago—, así que lo que se perdía era el premarcado y la
confianza en el mensaje, no la posibilidad de ordenarlo.)

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **1** | Se revierte a `vigenciaPorEstadio` (el estado de v17.6.94) | `suite_28` | *ERC G5 ya no recibe 180 días planos*, *ningún estadio puede quedar con la vigencia más larga que el anterior* (→ `G4=120 G5=180`), y **las dos de punta a punta** → **8 rojas** |
| **2 · LA TRAMPA GRAVE** | Se delega **sin** `mtrColapsarVigencia` | `suite_28` | *la creatinina sigue tomando el extremo SUPERIOR del rango* → **4 rojas** |
| **3** | Se colapsa al extremo **INFERIOR** (`funcionRenalInestable` forzado a `true`) | `suite_28` | *la creatinina sigue tomando el extremo SUPERIOR* → **3 rojas** |
| **4** | Se quita la guarda de tipo que protegería de un `"BLOQ"` | — | **NO CAE.** Ver abajo. |
| **5** | Se ignora `esDm2` | — | **NO CAE.** Ver abajo. |

Las tres primeras se aplicaron **una a una**, restaurando con `diff` contra copia intacta
antes de la siguiente; cada corrida dejó rojo con la aserción exacta esperada y el banco
volvió a 2.355/2.355 tras cada restauración.

**La mutación 2 es la razón de que este arreglo no fuera de una línea.** El motor devuelve la
creatinina como **array** `[90,121]`, no como el objeto `{min,max}` de la legacy; el bloque
viejo leía `v.max`, que sobre un array es `undefined`. Una delegación que no colapse deja la
creatinina **peor que antes**: 121→180 en G3a/G3b y 93→180 en G4. Y antes de esta versión
había **una sola** aserción en todo el banco que lo habría atrapado.

**Las mutaciones 4 y 5 no caen, y no se disimula.** No son pruebas flojas: son mutaciones
**inertes** por construcción, y está verificado por qué.
- La 4: `"BLOQ"` es **inalcanzable** por las 8 claves RCV — la imagen del traductor
  (`colesterol_total, hdl, ldl, trigliceridos, glicemia, parcial_orina, creatinina, rac`) es
  disjunta del conjunto de analitos bloqueables (`pth, albumina, fosforo, hba1c`). Barrido de
  8 claves × 3 programas × 6 estadios × `esDm2`: cero `"BLOQ"`. La guarda es defensa en
  profundidad y hoy no tiene forma de ejercitarse. **Lo que sí queda vivo es la prueba que
  fija esa inalcanzabilidad**: el día que alguien añada PTH, fósforo, albúmina o HbA1c a
  `RCV_VIGENCIA_KEYS`, esa prueba cae y lo obliga a decidir qué hace el aviso con un examen
  que la norma prohíbe pedir.
- La 5: `esDm2` solo distingue algo para `hba1c` en ERC, y HbA1c **no está** entre las 8
  claves (exclusión deliberada, línea ~3563: «no todo paciente es diabético»). El parámetro
  viaja por corrección de contrato, no porque hoy cambie un día de vigencia.

**Lo que este arreglo deja fuera a propósito**, y queda escrito en el código para que sea una
decisión y no un descuido: `funcionRenalInestable` se **lee** pero ningún llamador lo manda,
así que vale `false` y el rango se colapsa a su extremo superior — exactamente lo que hacía
la línea vieja. Encenderlo bajaría la creatinina de 121 a 90 en G3a/G3b y de 93 a 60 en
G4/G5 (medido), y eso es un cambio clínico que el médico no ha pedido en este hueco.

**Un hallazgo aparte que la auditoría destapó y que NO se toca aquí:** `HBA1C` no está en
`RCV_VIGENCIA_KEYS` ni en el traductor, así que el antiduplicado es ciego a ella — un
diabético con la HbA1c vencida hace 219 días puede recibir «RCV ya cubierto». La exclusión
es deliberada; que el paquete pueda declararse cubierto por ella es una decisión propia del
médico y merece su propia entrega.

## v17.6.94 — 27-ago-2026 (el piso por diabetes deja de ser incondicional, y la casilla que lo hace posible)

Divergencia **B1** de la revisión del 27-ago, con sus dos mitades juntas, como pidió el
médico. Banco antes: 2.337 · después: **2.346**.

El piso «todo diabético entra como ALTO» (v16.2.9) parecía una regla clínica. No lo era: su
propio comentario decía por qué existía — las dos reglas de diabetes del consenso (paso 1
«larga duración», paso 2 «DM+CONTEO≥1 y >10 años») dependen de `dmAnios`/`dmLargaDuracion`,
y en producción **no los alimentaba nadie**. El piso no corregía el consenso: tapaba una
ceguera de datos. Everest no tiene casilla para «desde cuándo es diabético», así que el dato
solo puede venir del médico.

**Lo primero fue medir, no cambiar.** Quitando el piso a secas, con el harness:

| Paciente | Hoy | Sin el piso, sin el dato |
|---|---|---|
| 60 a, DM2 + HTA | ALTO (LDL <70) | **MODERADO** (<100) |
| 52 a, DM2 sola | ALTO (<70) | **BAJO** (<116) |

Por eso el piso no se quita: se vuelve **condicional**. Aplica solo cuando el tiempo de
evolución no consta, se marca como provisional (`dmAniosRequerido`) y **pide el dato** en vez
de callarse. Con el dato, manda el consenso.

La medición destapó además un **hueco de redacción del propio v68**: el paso 3 dice «DM<10a
sin FR», así que un diabético de 12 años sin ningún otro factor no lo recoge el paso 1
(CONTEO=0, sin daño de órgano), ni el paso 2 (exige CONTEO≥1), ni el paso 3 (lo deja fuera
por pasar de 10) — y salía **BAJO**, mientras el mismo paciente con 5 años salía MODERADO.
Tener la enfermedad hace más tiempo lo bajaba de categoría. El potenciador pasa a ser
«diabetes sin FR mayores», sin techo de años: no baja a nadie y cierra la no-monotonía.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **1** | `mtrDmEvolucionConocida` devuelve siempre `true` (el piso no aplica nunca) | 45, 47, 57 | *PISO POR DIABETES…*, *…es tri-estado*, *CON el dato manda el consenso*, *los 4 pasos reproducen al Copiloto* (10 diabéticos dorados por debajo de ALTO) → **6 rojas** |
| **2** | `MTR_DM_LARGA_DURACION_ANIOS` baja de 20 a 10 | 45, 47 | *«larga duración» sale de los años…* → **4 rojas** |
| **3** | `mtrDmLargaDuracion` ignora lo que el médico marcó a mano | 45 | *…y lo que marca el médico manda*; además 4 desviaciones contra el corpus dorado → **2 rojas** |
| **4** | El potenciador recupera el techo de 10 años | 45 | *tener la diabetes hace MÁS tiempo nunca baja de categoría* → *a los 10 años bajó… 9a=moderado 10a=bajo* |
| **5** | `mtrSolicitudV68` deja de pedir el dato | 57 | *el diabético sin tiempo de evolución sale con categoría Y con solicitud* |
| **6 · CABLEADO** | `mtrTableroClinico` deja de publicar `dmAnios`/`dmAniosRequerido` | 47 | *el resumen publica los años de diabetes y si los está esperando* |
| **7 · CABLEADO** | La reclasificación de los 20 s pierde `dmAnios` de la mezcla | 47 | *los años de diabetes sobreviven a la reclasificación de los 20 s* |
| **8 · CABLEADO** | El ctx lee el dato pero lo guarda en un campo que el clasificador no mira | 47 | *el ctx del Panel lee los años guardados por el médico* |
| **9** | La fila del Panel afirma el piso siempre, se esté aplicando o no | 47 | *…y no molesta cuando no aplica* → *no se afirma un piso que no se está aplicando* |

Las nueve se aplicaron sobre el archivo de producción **una a una**, restaurando con `diff`
contra copia intacta antes de la siguiente; cada corrida dejó rojo con la aserción exacta
esperada y el banco volvió a 2.346/2.346 tras cada restauración.

**Las tres de CABLEADO son la mitad del trabajo.** El dato recorre cuatro tramos —el botón
del Panel lo guarda por cédula, el ctx lo lee al armar el resumen, el clasificador lo usa, el
tablero lo devuelve a pantalla— y cualquiera de ellos se puede cortar dejando todas las
funciones intactas y el banco verde. La 7 es la más traicionera: el Panel rehace la
clasificación cada 20 segundos con lo que lee de Everest, y Everest **no tiene este campo**,
así que un `Object.assign` mal ordenado haría desaparecer el dato solo a los 20 segundos —
el mismo defecto que v17.6.86 encontró con las frecuencias de los medicamentos.

**Una decisión que hay que mirar de frente.** El prompt v68 no pone número a «larga
duración»; solo dice «>10 años» en el paso 2. Si las dos cláusulas significaran lo mismo, la
del paso 2 sería inalcanzable — el paso 1 se lleva a todos antes. Para que las dos vivan,
«larga duración» tiene que ser un umbral más alto, y aquí se fija en **20 años**. Es una
lectura, no una cita, y cambia la meta de LDL de <70 a <55 en el diabético de muchos años.
Vive en una constante con nombre (`MTR_DM_LARGA_DURACION_ANIOS`) para que corregirla sea una
línea.

## v17.6.93 — 27-ago-2026 (el grupo de sábados vuelve, pero solo cuando es fiable)

Divergencia **A5** de la revisión del 27-ago. Banco antes: 2.329 · después: **2.337**.

El motor v68 ancla los sábados a una quincena fija; el script llevaba desde v16.9.0 la
regla contraria (*cualquier sábado si consta agenda propia*) porque la de grupos, cableada
y probada contra la agenda real el 20-ago, le **tachaba sábados en los que sí trabajaba**:
su deducción sale en CONFLICTO, y en conflicto el grupo queda en `null`, lo que dejaba
CERO sábados ofrecidos. Medido con el harness sobre septiembre de 2026 antes de tocar
nada: con grupo 1-3 se ofrecen 2 de 4 sábados; con su deducción real, ninguno.

Decisión del médico tras ver esa medición: **el grupo afina cuando la deducción es fiable,
y cuando no lo es se cae a la regla de v16.9.0**. La duda se resuelve siempre hacia ofrecer
el sábado de más —que él descarta de un vistazo— antes que esconderle uno en el que
trabaja.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **1** | `mtrGrupoSabadoFiable`: se quita la guarda `if (x.conflicto === true) return null` | `suite_46` | *mtrGrupoSabadoFiable exige constancia positiva de fiabilidad* → *en conflicto NUNCA, aunque venga con grupo (es el caso real del 20-ago)* |
| **2** | El respaldo `if (g === null) return true` pasa a `return false` (grupo no fiable ⇒ esconder) | `suite_46` (+`suite_24`, `suite_38`) | *EL FALLO DEL 20-AGO NO PUEDE VOLVER: en conflicto se ofrecen TODOS los sábados* → **6 pruebas rojas** |
| **3** | `return suyo === null ? true : suyo` pasa a `return suyo === true` (el 5º sábado se descarta) | `suite_46` | *el 5º sábado del mes no es de ningún grupo: no se esconde* → *y aun así se ofrece* |
| **4 · CABLEADO** | `mtrSabadoTrabajaEsteMedico` vuelve al objeto de v17.6.92 (tira `grupo`/`confianza`/`conflicto`) | `suite_46` | *CABLEADO REAL — lo que mtrSabadoTrabajaEsteMedico entrega BASTA para afinar* y *…con la deducción en conflicto, el mismo camino ofrece los cuatro* → **2 rojas** |
| **5** | `MTR_SAB_CONFIANZAS_FIABLES` acepta también `"conjetura"` | `suite_46` | *mtrGrupoSabadoFiable exige constancia positiva…* → *una sola observación es una corazonada* → **2 rojas** |
| **6** | Se quita el filtro de v16.9.0 (`if (!mtrSabadosHabilitados(...)) return false`) | `suite_46` (+`suite_24`, `suite_38`) | *el grupo no resucita un sábado si NO consta que el médico trabaje sábados* → **6 pruebas rojas** |

Las seis se aplicaron sobre el archivo de producción **una a una**, restaurando con `diff`
contra copia intacta antes de la siguiente; cada corrida dejó rojo con la aserción exacta
esperada y el banco volvió a 2.337/2.337 tras cada restauración.

**La mutación 4 es la importante.** Las otras cinco prueban la función; la 4 prueba que la
función está CONECTADA. `mtrSabadoTrabajaEsteMedico` es quien fabrica el objeto que viaja
al motor (`grupoSabado:` en el contexto de `mtrResumenClinico`), y hasta v17.6.92 dejaba
por el camino los tres campos que la regla necesita: renombraba `grupo` a `grupoDeducido`
y descartaba `confianza` y `conflicto`. Con ese objeto, `mtrGrupoSabadoFiable` devuelve
`null` SIEMPRE: la regla habría quedado escrita, verde en pruebas de unidad, y sin ningún
efecto en producción — que es exactamente el fallo que la auditoría de v17.0.1 ya había
encontrado en esta misma línea de código. Se detectó ANTES de entregar porque las dos
pruebas *CABLEADO REAL* recorren el camino entero (memoria por médico →
`mtrSabadoTrabajaEsteMedico` → `mtrDiaValidoParaControlConSabado`) en vez de construir a
mano el objeto que ninguna parte de producción construye.

## v17.6.92 — 27-ago-2026 (el síndrome metabólico existía, estaba muerto y no contaba)

Segundo hueco de la Fase 2 (v68 S2, FR MAYORES).

`mtrSindromeMetabolico` llevaba versiones escrita, bien resuelta y con **cero llamadores en
producción**. Es uno de los diez factores de riesgo mayores del consenso, y sumaba cero
siempre. De paso, al clasificador tampoco le llegaban **triglicéridos ni glicemia** —dos de los
cinco criterios—, así que el cálculo no podía ni intentarse.

Reproducido con el harness sobre el paciente clásico del programa (hipertenso tratado,
sedentario, TG 200, HDL 35, glicemia 105, **no** diabético para que no lo tapara el piso
institucional):

```
mtrSindromeMetabolico -> cumple: true   (4 de 5 criterios evaluables)
factores.prediabetesSdMetabolico : undefined
conteoFrMayores : 2      categoría: BAJO      meta LDL: 116
```

Con el punto que le corresponde cruza el `CONTEO>=3` del Paso 2: **ALTO, meta <70**. Y de la
meta salen la falla terapéutica, las vigencias y las fechas de toma — un solo factor no contado
mueve todo lo demás.

**La regla que no se puede equivocar:** `cumple` es TRI-ESTADO y solo cuenta cuando es `true`.
Un `null` significa "con lo que hay no se puede decidir" (faltan criterios que aún podrían
empujarlo a 3) y no cuenta ni a favor ni en contra: contarlo sería inferir un factor de riesgo,
y de ahí sale una meta más estricta. Y si el médico ya documentó el factor a mano, eso manda:
el cálculo no se lo pisa.

El detalle del cálculo (criterios cumplidos y cuántos se pudieron evaluar) viaja en el resumen:
un factor de riesgo que aparece sin explicación es indistinguible de uno inventado.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **sin cablear** | se quitó la asignación de `prediabetesSdMetabolico` | `suite_45` | *…cuenta como factor mayor y cambia la categoría* |
| **tri-estado relajado** | `cumple !== false` en vez de `=== true` (un "sin decidir" pasaría a contar) | `suite_45` | *…un síndrome metabólico SIN DECIDIR no cuenta como factor* |
| **sin triglicéridos** | `trigliceridos: null` fijo | `suite_45` | *…cuenta como factor mayor* **y** *…los triglicéridos y la glicemia llegan al clasificador* |
| **sin glicemia** | `glicemia: null` fijo | `suite_45` | *…los triglicéridos y la glicemia llegan al clasificador* |
| **sin detalle** | `resumen.sindromeMetabolico = null` | `suite_45` | **cuatro** pruebas |

Las cinco cayeron a la primera. Aplicadas de una en una desde copia intacta, restaurado con
`diff`. Banco en 2329/2329.

**Falta el quinto criterio, la CINTURA**, y se anota para no aparentar una cobertura que no
existe: el cálculo corre hoy con cuatro de cinco. En el paciente clásico eso basta para
concluir, pero en otros dejará `null` donde con la cintura habría decidido. Va en su propia
entrega porque tiene un riesgo aparte: el diagnóstico de campo del médico (27-ago) reveló que
Everest **repite los identificadores** en esa fila —`alert_message` e `IMC` aparecen en tres
casillas distintas cada uno— y que el campo correcto, *"Circunferencia abdominal (cm)"*, no
tiene `name`. Es decir: no es alcanzable por identificador y habrá que leerlo por su rótulo.
Ojo además con `mtrLeerCinturaDelDom`, que hoy lee `cinturaPelvica` = **CADERAS**: usarla habría
sobrediagnosticado obesidad central en casi todos los pacientes.

## v17.6.91 — 27-ago-2026 (la gestante con bacteriuria no recibía la pregunta de embarazo)

Primer hueco de la Fase 2 (v68 S4 UROANÁLISIS: *"Embarazo: tamizar y tratar"*).

`mtrEvaluarUroanalisis` ya tenía bien resuelta la excepción de la norma —`embarazo &&
(sugestivo || bacteriuria)` → `BACTERIURIA EN EMBARAZO`, urocultivo con antibiograma— pero esa
rama era **INALCANZABLE en el camino real**, por dos eslabones rotos a la vez:

1. La pregunta de embarazo solo se disparaba con parciales **sugestivos de ITU**
   (`mtrDebePreguntarEmbarazo` exigía `uroSugestivo === true`), y una bacteriuria franca **sin
   piuria** no es sugestiva.
2. El motor calculaba `bacteriuria` en una variable local y **no la exponía**, así que el
   llamador ni siquiera podía consultarla.

Reproducido con el harness (bacterias abundantes, sin nitritos, sin esterasa, leucocitos 0-2):

```
sugestivo                      : false
¿expone 'bacteriuria'?         : false
¿se le pregunta si está embarazada? : false
con embarazo conocido -> estado: BACTERIURIA EN EMBARAZO   <-- el motor SÍ sabe qué hacer
```

O sea: el motor sabía tratarla y nunca se enteraba de que estaba embarazada. Importa porque la
bacteriuria asintomática no tratada en el embarazo es factor de pielonefritis y de parto
pretérmino — la única excepción que la norma marca en mayúsculas.

Se expone `bacteriuria` en el resultado y la compuerta pasa a usar **la misma condición** que la
rama del motor, para que no puedan volver a separarse. Comprobado que no se dispara de más: ni a
un hombre, ni fuera de edad fértil, ni con la orina limpia, ni si ya contestó.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **dato no expuesto** | se quitó `bacteriuria` del objeto que devuelve el motor | `suite_48` | *…expone la bacteriuria, no solo si es sugestivo* **y** *…la rama ya es alcanzable de punta a punta* |
| **compuerta estrecha** | vuelta a exigir solo `uroSugestivo` | `suite_48` | *…SÍ se le pregunta por embarazo* **y** *…alcanzable de punta a punta* |
| **compuerta abierta** | `return true` (preguntaría en cada consulta) | `suite_48` | la prueba de v16.9.0 **y** *…SÍ se le pregunta* |
| **insumos incompletos** | `mtrInsumosEmbarazo` deja de leer la bacteriuria | `suite_48` | *…los insumos de la pregunta se leen del resumen, sin perder ninguno* |

Nota, y van seis: la mutación del **cableado** no caía. Borrar el insumo que el Panel le pasa a
la compuerta dejaba el banco entero en verde, porque ese armado vivía suelto dentro de
`openPanelPacienteModal` —una función de interfaz que el banco no puede ejercitar— y nada
comprobaba que la compuerta recibiera lo que necesita. Se extrajo a `mtrInsumosEmbarazo`, que sí
es probable, y entonces sí cayó.

**Límite conocido que queda, y se anota en vez de disimularlo:** la línea final
`mtrDebePreguntarEmbarazo(mtrInsumosEmbarazo(...))` dentro del Panel **sigue sin cubrir**. Es
una sola línea, y cubrirla exigiría ejercitar un modal completo. Lo que sí queda defendido es
todo lo que decide: qué insumos se leen, y qué hace la compuerta con ellos.

Aplicadas de una en una desde copia intacta, restaurado con `diff`. Banco en 2325/2325.

## v17.6.90 — 26-ago-2026 (el ANR afirmaba en pantalla una agrupación que no ocurría)

Quinto y último hueco de la Fase 1 (v68 S3, ANR / "agujero negro renal").

La línea del recuadro se pintaba **siempre** que existiera `plan.anr`, diciendo *"Ventana renal
de N días activa: todo se agrupa en la fecha de la creatinina"*. Pero el ANR solo mueve la fecha
de toma si la creatinina es la que vence PRIMERO (`if (creat.vence < ftlCruda)`); si otro examen
vence antes, `anr` se marca igual y **no agrupa nada**.

Reproducido con el harness — ERC G3b, creatinina que vence el 19-oct dentro de la ventana de 60
días, lípidos vencidos que fuerzan la toma al 9-sep:

```
FTL elegida : 2026-09-09          creatinina vence: 2026-10-19
se ordenan  : lípidos, hemoglobina, PTH, fósforo, albúmina
se difieren : glucosa, uroanálisis, CREATININA, RAC
pantalla    : "todo se agrupa en la fecha de la creatinina"   <-- FALSO
```

La creatinina sale **DIFERIDA**: no entra en esa orden. El paciente iría el 9-sep por los
lípidos y tendría que **volver una segunda vez** justo por la creatinina — que es exactamente el
viaje que el ANR existe para evitar. Y el médico lee en pantalla que todo está agrupado, sobre
un plan que va a firmar.

Es el peor tipo de error de este proyecto: no una casilla vacía, sino un dato que **contradice**
el plan y sobre el que el médico puede apoyarse para no revisar la lista.

Se extrae `mtrTextoAnr(plan)`, que describe lo que de verdad pasó en tres ramas: la creatinina
manda (se agrupa ahí), se adelanta a la toma (un solo viaje), o **no entra** (aviso explícito de
que el paciente tendría que volver). Sin ANR devuelve cadena vacía.

**Esto NO arregla la agrupación**, solo deja de mentir sobre ella. Que el ANR agrupe de verdad
cambia fechas de toma de pacientes reales y va en su propia entrega (Fase 3 del plan).

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **texto viejo** | la pantalla devuelta a la línea que siempre afirma agrupación | `suite_47` | *v17.6.90: en pantalla, un ANR que no agrupó NO dice que agrupó* |
| **ciego a la orden** | `enLaToma` cableado a `true` en `mtrTextoAnr` | `suite_47` | las **dos** pruebas |
| **ciego a quién manda** | `if (false)` en la rama de "la creatinina manda" | `suite_47` | *…describe lo que de verdad pasó* |
| **aviso ablandado** | el aviso de segundo viaje sustituido por "se agrupan en esta toma" | `suite_47` | las **dos** pruebas |

Las cuatro mutaciones cayeron a la primera — sin el tropiezo de las cuatro versiones
anteriores. La diferencia: las ramas se probaron **una por una contra la función pura** y además
de punta a punta sobre el HTML, en vez de fiarse de un solo vector end-to-end. La rama del
"se adelanta a esta misma toma" se verificó con un plan sintético: no logré construir un vector
realista que la produjera, y se anota para no aparentar una cobertura que no tiene.

Aplicadas de una en una desde copia intacta, restaurado con `diff`. Banco en 2321/2321.

## v17.6.89 — 26-ago-2026 (el JSON afirmaba datos completos con la estratificación sin hacer)

Cuarto hueco de la Fase 1. Tres defectos en el mismo emisor, todos verificados con el harness
sobre el mismo paciente (45 años, sin factores documentados, sin ASCVD → los pasos 1-3 no
clasifican):

| campo | emitía | debía |
|---|---|---|
| `datos_completos` | `true` — solo miraba la función renal | `false`: la estratificación no se hizo |
| `cv_risk` | `""` | `null` (v68: *"N/A=null"*) |
| `status` | `""` **siempre** | `PENDIENTE` |

El de `status` era el peor: leía `r.meta.status`, **que no existe** — `mtrEvaluarMetaLdl` expone
`estado`, no `status`. Era un campo muerto del contrato desde que se escribió: salía vacío
incluso en un paciente perfectamente clasificado y en meta.

Consecuencia: el JSON le decía a la IA *"paciente evaluado, datos completos, sin categoría de
riesgo"* y el modelo redactaba en consecuencia, **sin** la SOLICITUD de ASCVD que v68 exige
para dejar constancia de que la clasificación quedó pendiente.

Se separa el cálculo en `mtrStatusV68` (PENDIENTE si no hay categoría o los datos del riesgo
están incompletos; si no, el estado de la meta con el vocabulario del propio v68 — *"completa
si LDL<meta Y red>=50; si solo una → FALLA parcial"*) y `mtrSolicitudV68` (el texto literal, con
variante para cuando lo que falta es la TFG). Sin LDL con qué juzgar, `status` sale `""`: no se
inventa un estado de meta.

**Y se cablea en el prompt**, que es la mitad que suele faltar: sin una regla que le diga al
modelo qué hacer con `status: PENDIENTE`, el campo habría nacido muerto — el JSON diría
PENDIENTE y la nota se redactaría igual.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **datos_completos** | vuelto a mirar solo la función renal | `suite_57` | *v17.6.89: si la estratificación no se pudo hacer, el JSON lo DICE* |
| **cv_risk** | vuelto a cadena vacía | `suite_57` | *…el JSON lo DICE* |
| **status** | vuelto al campo muerto `r.meta.status` | `suite_57` | las **tres** pruebas de status |
| **solicitud** | emitida siempre vacía | `suite_57` | *…el JSON lo DICE* **y** *…sin TFG la solicitud es la de la TFG* |
| **guarda de categoría nula** | `if (false)` en la primera guarda de `mtrStatusV68` | `suite_57` | *…una categoría nula basta para PENDIENTE, aunque nadie marque datosCompletos* |
| **regla del prompt** | la instrucción sobre `status: PENDIENTE` desactivada | `suite_57` | *…el prompt le enseña al modelo qué hacer con status PENDIENTE* |

Nota, y van cinco: **la quinta mutación no caía con las pruebas iniciales.** Las dos guardas de
`mtrStatusV68` se solapan en cualquier resumen construido por `mtrResumenClinico` (cuando no
clasifica, marca las dos cosas), así que desactivar la primera no cambiaba nada. Pero este
emisor se llama también con resúmenes armados a mano —esta misma suite lo hace—, y ahí una
categoría nula puede venir SIN `datosCompletos`: sin la primera guarda ese paciente saldría con
status `""`. Se añadió una prueba que ataca la función directamente con ese resumen y entonces
sí cayó. La regla que se repite: **una aserción sobre el resultado final puede estar siendo
satisfecha por un camino distinto del que se quiere probar.**

Las seis mutaciones se aplicaron de una en una desde copia intacta y el archivo se restauró
verificando `diff`. Banco en 2319/2319.

## v17.6.88 — 26-ago-2026 (el urocultivo que el motor calcula y la IA nunca recibe)

Tercer hueco de la Fase 1 (v68 S4 UROANÁLISIS: *"pedir UROCULTIVO+antibiograma"*, *"sin
antibiótico a ciegas"*, *"la orden nunca queda vacía"*).

**Corrección a la auditoría, que exageraba el hallazgo:** decía que el urocultivo no se
enseñaba "en ninguna pantalla". Falso — la frase de la conducta ya decía *"pida urocultivo con
antibiograma"*. El hueco real es más estrecho y está en el otro lado: **el JSON que lee la IA
no lo llevaba**. Verificado con el harness (nitritos + síntomas): `uroanalisis.orden` traía
`["Urocultivo","Antibiograma"]` y la cadena "urocultivo" no aparecía por ninguna parte del
JSON emitido — la IA recibía solo `itu_estado: "PROBABLE ITU"` y tenía que DEDUCIR el
urocultivo, que es justo la inferencia que el resto del prompt le prohíbe. O lo omitía, o se
lo inventaba.

Se añade `orden_uroanalisis` como campo PROPIO del JSON — no dentro de `order_list`, que lleva
CLAVES de analito que sus lectores cruzan con el catálogo de CUPS y que se rompería con nombres
libres. Y en la pantalla la orden pasa a verse como línea propia, no solo enterrada dentro de
la frase de la conducta.

De paso queda anclada la cláusula *"la orden nunca queda vacía"*: los cinco estados devuelven
algo, incluido el negativo (control de rutina) y el ambiguo (confirmar síntomas ANTES de pedir
el urocultivo). Y que la bacteriuria asintomática **no** pide urocultivo: la norma prohíbe
tratarla.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **campo ausente** | se borró la línea `orden_uroanalisis` del JSON | `suite_48` | *v17.6.88: la orden del uroanálisis viaja al JSON que lee la IA* **y** *…sin uroanálisis evaluado no se inventa ninguna orden* |
| **campo siempre vacío** | `orden_uroanalisis: []` fijo (existe pero no lleva nada) | `suite_48` | *v17.6.88: la orden del uroanálisis viaja al JSON…* |
| **línea de pantalla** | se borró la línea "Qué ordenar por este hallazgo" del render | `suite_48` | *v17.6.88: la orden del uroanálisis viaja al JSON…* |

Nota, y van cuatro veces: **la tercera mutación NO caía con las pruebas iniciales.** Se podía
borrar entera la línea de la pantalla y el banco seguía en 2314/2314, porque las pruebas solo
miraban el JSON. Se añadieron dos aserciones sobre el HTML renderizado y entonces sí cayó.
Cada vez que este arreglo toca DOS costuras, hay que probar las dos por separado.

Las tres mutaciones se aplicaron de una en una desde copia intacta, y el archivo se restauró
verificando `diff`. Banco en 2314/2314.

## v17.6.87 — 26-ago-2026 ("Nunca se le ha tomado" sobre un examen que SÍ tiene resultado)

Segundo hueco de la Fase 1 del plan de fidelidad a v68.

v17.6.57 ya había arreglado que un analito con valor pero sin fecha perdiera el valor, y su
`motivo` distingue el caso ("hay un resultado (260) pero sin fecha registrada"). **No bastaba:**
el subestado seguía siendo `sin_historial` para los dos casos, y quien pinta la pantalla
(`mtrTableroClinico`) decide el texto por el **subestado**, no por el motivo.

Reproducido con el harness — glicemia de 260 llegada sin fecha (alcanzable: `_extractAtheneaFecha`
puede devolver `null` y `mtrResumenDesdeModalLabs` lo copia tal cual):

```
subestado                       : sin_historial
motivo                          : hay un resultado (260) pero sin fecha registrada…
lo que LEE EL MÉDICO en pantalla: "Nunca se le ha tomado"
```

Además de perderse un resultado alarmante, se reordena un examen ya hecho — viaje y gasto que la
misión del motor ("minimizar desplazamientos sin dejar vencer exámenes") existe para evitar.

Se separan los dos casos en el subestado (`sin_fecha` / `sin_historial`), se añade la rama de
texto en el tablero (muestra el valor y explica por qué se vuelve a pedir), y se incluye
`sin_fecha` en el filtro de `faltantes` para que el examen **se siga ordenando**: sin fecha
sigue sin poderse afirmar que esté vigente. Lo que cambia es que ya no se afirma una falsedad;
la conducta es la misma.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **subestado compartido** | `subestado` vuelto a `"sin_historial"` para ambos casos | `suite_46` + `suite_63` | *un analito CON valor pero SIN fecha no pierde el valor* **y** *v17.6.87: un examen CON resultado pero sin fecha no se anuncia como 'nunca se le ha tomado'* |
| **rama del texto** | la rama `if (a.subestado === "sin_fecha")` del tablero anulada con `false &&` | `suite_63` | *v17.6.87: …no se anuncia como 'nunca se le ha tomado'* |
| **filtro de faltantes** | `sin_fecha` retirado del filtro (el examen dejaría de ordenarse) | `suite_63` | *v17.6.87: …no se anuncia como 'nunca se le ha tomado'* |

La tercera mutación es la que más importa: si `sin_fecha` sale del filtro, el examen
**desaparece del plan** y el paciente se queda sin él. La prueba de punta a punta lo caza porque
comprueba primero que la fila existe, antes de mirar su texto.

Una prueba de v17.6.57 (`suite_46`) fijaba `subestado === "sin_historial"` para este caso: se
actualizó a `sin_fecha` con el porqué, porque el comportamiento cambió a propósito.

Las tres mutaciones se aplicaron de una en una desde copia intacta y el archivo se restauró
verificando `diff`. Banco en 2311/2311.

## v17.6.86 — 26-ago-2026 (el marcador [DOSIS NO ESPECIFICADA] se apagaba a los 20 segundos)

Primer hueco de la Fase 1 del plan de fidelidad a v68 (S4: *"MEDS: genérico+dosis+frecuencia;
falta -> [DOSIS NO ESPECIFICADA]"*).

`mtrRecalcularConFactores` copia del resumen viejo al nuevo una lista larga de campos —
incluido `medicamentos`— pero **no copiaba `medicamentosFrecuencia`**. Consecuencia: el
marcador que v17.6.66 construyó para impedir que la IA invente una posología duraba lo que
tardara el médico en escribir el peso o la tensión en el Panel. Al reclasificar,
`mtrJsonV68DesdeResumen` dejaba de recibir el mapa y emitía los medicamentos **sin** el
marcador.

Reproducido con el harness usando la MISMA hoja en las dos llamadas, para que el único
cambio fuera el resumen:

```
ANTES  : ["ATORVASTATINA 80 MG [DOSIS NO ESPECIFICADA]", "LOSARTAN 50 MG [DOSIS NO ESPECIFICADA]"]
DESPUÉS: ["ATORVASTATINA 80 MG", "LOSARTAN 50 MG"]
```

La nota que el médico copia a la historia quedaba sin las frecuencias **y sin la advertencia
de que faltaban** — el peor de los dos mundos, porque nadie ve que se perdió. Un Map vacío es
un dato ("se preguntó y no hay frecuencias"), distinto de `undefined` ("no se preguntó"), así
que la guarda comprueba que sea un Map y no que tenga contenido.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **copia del mapa** | se retiraron las tres líneas que copian `medicamentosFrecuencia` en `mtrRecalcularConFactores` | `suite_63` | *v17.6.86: el marcador [DOSIS NO ESPECIFICADA] sobrevive a una reclasificación* **y** *v17.6.86: un mapa CON frecuencias tampoco se pierde al reclasificar* |

Las pruebas son de **punta a punta** (resumen → reclasificar → JSON) a propósito: probar solo
que el campo sobrevive dejaría pasar un cambio que lo copiara pero rompiera su consumo en el
JSON. Es la lección que este informe ya anotó tres versiones seguidas — *probar la pieza no es
probar que la pieza está conectada*.

Mutación aplicada sobre producción desde copia intacta, caída con las dos aserciones
esperadas, y restaurada verificando `diff`. Banco en 2310/2310.

## v17.6.85 — 26-ago-2026 (el sexo del paciente: la cabecera de la historia como respaldo, y la mina de la guarda)

Encargo del médico, literal: *"el script debe buscar la manera de encontrar qué sexo es el
paciente"*. Contexto: el sexo era el **único insumo de Cockcroft-Gault/CKD-EPI sin red de
seguridad**. El peso y la tensión ya tienen respaldo de DOM (`mtrLeerPesoDelDom`,
`mtrLeerTensionDelDom`); el sexo tenía una sola fuente —la demografía de la API— y un solo
intento. Si esa ficha llegaba con el campo vacío, AMBAS fórmulas se calculaban como hombre y
una mujer subía un estadio administrativo entero: el que rige vigencias, ventana ANR y
bloqueos de PTH/Fósforo/Albúmina.

**La fuente.** Una investigación del archivo dejó una pregunta sin resolver ("¿imprime la
cabecera de la historia el sexo? — no pude verificarlo, y sería la mejor fuente de todas").
El médico la contestó con dos capturas: la cabecera imprime `Sexo: MASCULINO` / `Sexo:
FEMENINO`. Es la mejor fuente porque vive en la cabecera que Everest pinta en **todas** las
pestañas, no cuesta una petición de red, y no depende de que haya una pestaña concreta
montada — al contrario que cualquier lector del formulario, que en esta SPA solo ve la
pestaña activa. Y `_vglLeerCabeceraHistoria` ya leía esa misma cabecera para otras cosas:
añadirlo fue una línea, como la investigación había predicho.

Detalle que la captura reveló: el campo **comparte línea** con el siguiente (`Sexo:
MASCULINO, Eps: NUEVA EPS`), así que se captura solo la palabra y no `(.+)$` como los demás
campos. Comprobado que el valor sucio SÍ lo reconocería `mtrEsSexoMasculino` (le basta
empezar por "MAS"), así que el riesgo no era fallar la lectura: era que el nombre de la
aseguradora viajara dentro del campo `sexo` hasta `erc.entradas.sexo`, que se muestra y se
persiste.

**La mina que había que desactivar primero.** La guarda `sexoAusente` solo cazaba la cadena
VACÍA. Verificado con el harness sobre `{edad:70, peso:70, creat:1.0}`: un valor presente
pero no reconocible —`"0"`, `"1"`, `"2"`, `"Indeterminado"`, `"N/A"`— daba CrCl 68.1 (G2),
calculado **como hombre**, y encima `sexoAusente:false`: el script afirmaba tener el dato. Es
**peor que el caso vacío**, que al menos levantaba la bandera. Y es exactamente donde caería
cualquier fuente nueva leída de un `<select>` de Angular, cuyo `.value` suele ser `"0"`/`"1"`
— se habría cambiado un fallo silencioso por otro peor. La guarda correcta no es "¿está
vacío?" sino "¿lo reconozco?".

El respaldo solo se usa si el paciente abierto es el mismo (igual que peso y tensión) y solo
si el valor es reconocible; el sexo de la API sigue mandando.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **lectura de la cabecera** | `salida.sexo` de `_vglLeerCabeceraHistoria` vuelto a `null` | `suite_32` | *v17.6.85: el sexo se lee de la cabecera de la historia, sin arrastrar la EPS* (y también *…un rótulo de sexo sin valor no inventa un sexo*) |
| **regex con comodín** | `([A-Za-zÁÉÍÓÚÑáéíóúñ]+)` vuelto a `(.+)$` — arrastra la EPS | `suite_32` | *…sin arrastrar la EPS* → el campo sale `"MASCULINO, Eps: NUEVA EPS"` |
| **guarda de sexo** | `sexoAusente` vuelto a `sexo === ""` | `suite_32` | *…un sexo presente pero NO reconocible cuenta como ausente, no como hombre* |
| **cableado del respaldo** | el respaldo cortado en `mtrResumenDesdeModalLabs` (`sexo: ent.sexo`), dejando el lector intacto | `suite_47` | *…sin sexo reconocible en la API, el respaldo de la cabecera lo aporta* |

Nota honesta, y **es la tercera vez en tres versiones**: la última fila **no caía** con las
pruebas que había escrito. El lector de la cabecera estaba probado a fondo, la guarda
también, y aun así podía cortarse el cableado entero y el banco seguía en verde
(2306/2306) — porque nada comprobaba que el lector se CONSULTARA. Es el patrón de "la
función existe, nadie la cablea" que ya dejó inertes a `ldlBasal` (v16.9.0), `hba1c`
(v17.6.0) y `ldlMetaPrevia` en este mismo archivo. Se añadieron dos pruebas en `suite_47`
que ejercitan `mtrResumenDesdeModalLabs` de punta a punta (con la cabecera simulada en el
`document` del arnés), y entonces sí cayó. **Probar la pieza no es probar que la pieza está
conectada.**

`_vglLeerCabeceraHistoria` no tenía NINGUNA prueba antes de esta versión (estaba en la lista
de "sin cubrir" del banco). Las de `suite_32` son las primeras.

Las cuatro mutaciones se aplicaron de una en una desde una copia intacta, y el archivo se
restauró verificando `diff` contra ella. Banco en 2308/2308. Cero PHI: los textos de cabecera
de las pruebas reproducen la FORMA real con cifras y nombres inventados.

## v17.6.84 — 26-ago-2026 (tres decisiones del médico sobre la auditoría v68: constancia legal, piso de HbA1c y el tercer eje de falla)

Las tres salen de una entrevista al médico el 26-ago sobre los hallazgos abiertos de la
auditoría v68. Ninguna es interpretación mía: cada una es una respuesta suya.

**1. El prompt pedía una constancia médico-legal que ningún campo respalda** (decisión:
"Cortar la mención ahora"). La sección de LOGÍSTICA del prompt de Análisis y Plan le pedía
al modelo redactar la constancia de *"toma previa incumplida por barrera de acceso no
imputable al profesional"* — pero **ningún campo del JSON le dice si eso ocurrió**: el
script todavía no persiste si la FTL anterior se cumplió. El modelo solo podía omitirla
siempre o inventársela, y una constancia inventada tiene consecuencia jurídica sobre un
paciente que quizá sí fue a tomarse los exámenes. Es el mismo criterio con el que
`falla_dispensacion` se dejó fija en "NO" (v17.6.78): casilla vacía antes que dato
inventado, y con más razón cuando el dato es una afirmación jurídica. La constancia por
falla de dispensación NO se toca: esa sí está atada a un campo real del JSON.

**2. La regla del 50% sacaba la HbA1c por debajo de su propio piso** (decisión: "Sí, piso de
90 días"). La regla del 50% (v16.2.7) partía la vigencia de cualquier analito fuera de meta
sin mirar si el resultado seguía siendo interpretable. En ERC G4 la HbA1c vale 120 días, así
que una HbA1c fuera de meta se volvía a pedir **a los 60** — por debajo del piso de 90 que el
propio motor ya declara en `MTR_RECONTROL.hba1c.pisoDias`. En G4 la vida del eritrocito ya
está acortada: repetirla a los 60 días no es interpretable como respuesta al tratamiento,
gasta un cupo de alto costo y le suma un viaje al paciente. El piso se lee de
`MTR_RECONTROL` para que viva en un solo sitio y nunca ALARGA una vigencia (si la norma ya da
menos que el piso, manda la norma).

**3. La glicemia, el tercer eje de falla que v68 exige y que nunca se cableó** (decisión:
meta de **130 mg/dL**). v68 manda vigilar la falla en tres ejes (LDL/glicemia/HbA1c) y el
tercero no existía: lo bloqueaba que **no hubiera meta de glicemia en ninguna parte del
archivo** — y v68 tampoco la da. Con la meta del médico y el umbral único del proyecto
(meta+15%), la falla arranca en 149,5 mg/dL. Solo aplica a diabéticos, igual que la HbA1c.
Sin este eje, un diabético con la glicemia disparada y la HbA1c todavía vigente no disparaba
falla ni recontrol de 2-4 semanas: el descontrol glucémico agudo pasaba entero por debajo del
radar de S2, porque la HbA1c —lo único que se vigilaba— se mueve en 90-120 días.
De paso se cerró el medio cableado que habría dejado el eje inerte: `mtrEjesEnFalla` decidía
el eje metabólico solo por el ESTADO del driver (ausente/vencido) y nunca por la falla
terapéutica —al contrario que el lipídico, que sí cuenta `meta.falla`—, así que un diabético
con la glicemia en 260 y todos sus laboratorios frescos disparaba la falla pero no el foco.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **piso de HbA1c** | `mtrAcortarPorFueraDeMeta`: se retiró el `Math.min(vigencia, Math.max(acortada, piso))` | `suite_49` | *v17.6.84: la regla del 50% nunca baja la HbA1c por debajo de su piso de 90 días* |
| **tercer eje** | la rama `if (c.esDm2 && c.glicemia …)` de `mtrPlanFallas` anulada con `false &&` | `suite_49` | *…la glicemia es el tercer eje de falla, con meta de 130 mg/dL* — y también *…el eje llega cableado desde mtrResumenClinico* |
| **cableado del eje** | el respaldo `c.ultimos.GLUCOSA` de `mtrResumenClinico` devuelto a `null` (el eje existe pero nadie lo alimenta) | `suite_49` | *…el eje llega cableado desde mtrResumenClinico, no nace muerto* |
| **constancia legal** | la frase devuelta al prompt de LOGÍSTICA | `suite_57` | *…el prompt NO puede pedir una constancia médico-legal que ningún campo respalda* |
| **foco metabólico** | `mtrEjesEnFalla`: se quitaron `fallaDe("HbA1c") \|\| fallaDe("Glicemia")` | `suite_48` | *…la falla terapéutica de glicemia/HbA1c enciende el eje metabólico aunque el driver esté vigente* |

Nota honesta sobre la última fila, y es la segunda vez que pasa en dos versiones: **la
primera prueba que escribí para el foco metabólico NO cazaba la mutación.** Afirmaba
`foco === "metabólico"` sobre un diabético, y en un diabético el programa rector ya devuelve
"metabólico" por su cuenta — la aserción pasaba igual con el código roto (el banco quedó en
2302/2302 con la mutación aplicada). Se reescribió apuntando directamente a
`mtrEjesEnFalla(...).metabolico` con los drivers en estado vigente, y entonces sí cayó.
Queda anotado: una aserción sobre el resultado FINAL puede estar siendo satisfecha por un
camino distinto del que se quiere probar.

Las cinco mutaciones se aplicaron de una en una sobre producción (cada una desde una copia
intacta), y el archivo se restauró verificando `diff` contra ella. Banco en 2303/2303.

## v17.6.83 — 26-ago-2026 (auditoría v68 del port, bloque S5: el foco y las banderas de la salida)

Auditoría nueva del `MOTOR_RCV_V68_SPEC.md` contra el código de HOY (la del 25-ago quedó
desactualizada: esta rama lleva 17 versiones de arreglos encima). 114 cláusulas verificadas
una por una con el harness y con una pasada de refutación adversarial por bloque. Dos
hallazgos del bloque S5 se reprodujeron ejecutando el motor, y son los que cierra esta
versión. Ambos son de FIDELIDAD al spec, no divergencias: v68 dice una cosa y el port hacía
otra sin que nadie lo hubiera decidido.

**1. El foco de la consulta ignoraba el RAC vencido.** `mtrEjesEnFalla` decidía "este eje
está en falla" con `a.estado === "A"` a secas. Pero desde v17.6.75 un RAC≥30 VENCIDO ya no
sale como "A": sale como **"R"** (vigilancia estrecha) con `vencidoBase`. Verificado con el
harness — paciente HTA, RAC 45 tomado hace 138 días, resto de laboratorios frescos y LDL en
meta: el eje renal salía `false` y el foco de la consulta salía **"lipídico"**. Ese foco
viaja al JSON (`priority_focus`) que lee la IA, así que la nota clínica que el médico copia
a la historia declaraba el foco equivocado — y precisamente en el paciente que v17.6.75
acababa de promover a recontrol prioritario. Se adopta la MISMA condición que ya usa la
lista "Ya vencidos" de `mtrPlanParaclinicos` (:30704), para que las dos lecturas de "está
vencido" no puedan volver a contradecirse. Un Estado R que aún NO ha vencido sigue sin
encender el eje: si no, todo paciente con albuminuria tendría foco renal permanente.

**2. `education_flags.alarmas` tenía DOS fórmulas que se contradecían.** La hoja educativa
que se IMPRIME y se le entrega al paciente salía de `mtrEducationFlags`, que miraba
`meta.falla`/`meta.fallaGrave` — del eje **lipídico** exclusivamente. El JSON que lee la IA
tenía su propia fórmula (`fallas.hayGrave || muy alto`). Verificado con el harness —
diabético con **HbA1c en 11 %** (falla grave del eje metabólico) y el LDL en meta: la hoja
impresa decía `alarmas:false` (se iba **sin la sección de signos de alarma**) mientras el
JSON decía `alarmas:true`. Dos verdades sobre el mismo paciente en la misma consulta. Causa
de fondo: `resumen.fallas` se calculaba DESPUÉS de `resumen.educationFlags`, así que las
banderas no podían verlo aunque quisieran. Se sube el cálculo (seguro: `mtrPlanFallas` solo
necesita `riesgo`, `erc`, `plan.ftl`, `meta.metas` y `factores`, todos ya construidos), se
hace de `mtrEducationFlags` la ÚNICA fuente mirando los tres ejes, y el JSON pasa a
consumirla en vez de recalcularla. Se cuentan graves y leves: v68 dice "alarmas=true si MUY
ALTO o FALLA" sin distinguir gravedad, y ante la duda educar de más es inocuo — omitir los
signos de alarma no lo es.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| **eje renal ciego al Estado R** | `mtrEjesEnFalla`: la condición vuelta a `a.estado === "A"` a secas | `suite_48` | *v17.6.83: un RAC≥30 vencido (Estado R) enciende el eje renal…* → *RAC vencido en Estado R -> eje renal (obtuvo false)* |
| **banderas solo del eje lipídico** | `mtrEducationFlags`: `hayFalla` vuelto a `meta.falla \|\| meta.fallaGrave` | `suite_48` | *…la falla de CUALQUIER eje enciende las alarmas* → *HbA1c en falla grave con el LDL en meta -> alarmas (obtuvo false)* — y además cayó la invariante hoja/JSON |
| **el JSON recalcula por su cuenta** | `education_flags.alarmas` del JSON vuelto a `fallas.hayGrave \|\| muy alto` | `suite_48` | *…la hoja impresa y el JSON de la IA nunca discrepan* → *con falla LEVE, hoja y JSON siguen diciendo lo mismo: esperaba true y obtuvo false* |
| **orden de cálculo** | el bloque `resumen.fallas = mtrPlanFallas({…})` devuelto a su posición original (después de las banderas) | `suite_48` | *…la hoja impresa y el JSON de la IA nunca discrepan* → *y con una falla grave, lo que dicen es que SÍ (obtuvo false)* |

Nota honesta sobre la tercera fila: **la primera versión de la prueba NO cazaba esa
mutación**. El vector end-to-end usaba una falla GRAVE, y con falla grave las dos fórmulas
viejas coinciden por casualidad — el banco seguía en verde con el código roto. Se añadió un
segundo vector con falla **LEVE**, que es justo donde divergen, y entonces sí cayó. Queda
anotado porque es exactamente el susto que esta disciplina existe para evitar.

Las cuatro mutaciones se aplicaron de una en una sobre producción, cada una cayó con la
aserción exacta esperada, y todas se restauraron verificando `diff` contra una copia intacta
tomada antes de mutar. El banco volvió a 2297/2297 tras la restauración final.

**Hallazgo NO arreglado, a propósito:** tres agentes de la auditoría (bloques S2, S3 y S5)
reportaron que las fusiones MTT no entran en `plan.ordenar`/`order_list`, y es cierto a
nivel de código (nada las añade). Pero al intentar reproducir la consecuencia clínica que
describían —el paciente viaja y no le sacan el analito del recontrol— **no se logró con
vectores realistas**: en los casos donde la fusión ocurre, la regla de Cosecha ya arrastra
ese analito a la orden. No se empuja un arreglo para un daño que no se ha podido demostrar;
queda anotado para consultarlo con el médico.

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
| **festivos sin delegación (v17.6.8)** | esFestivo: 
eturn mtrEsFestivoCO(...) mutado a 
eturn false para años fuera de la tabla (2028 queda ciego y el agendamiento citaría en festivo) | suite_69 | *v17.6.8: esFestivo delega al motor calculado* ("1-ene-2028 debe ser festivo (obtuvo false)") |
| **toasts sin agrupar (v17.6.9)** | _agruparToasts: se antepone 
eturn (lista||[]).slice() (los avisos del mismo paciente vuelven a apilarse) | suite_42 | *v17.6.9: _agruparToasts combina avisos del mismo paciente* ("debe quedar en una sola tarjeta") |

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

---

## v17.13.0 — los prompts aprenden a usar el contexto que ya recibían

Entre la v17.7.3 y la v17.12.0 la hoja de hechos creció con el examen físico completo, el
uroanálisis, el síndrome metabólico, el plan con sus fechas y —desde la v17.10.0— la historia
clínica entera tal como Everest la guarda. **Ningún prompt nombraba el bloque nuevo**: es la
regla que el propio proyecto se había escrito en la v17.7.3, *un dato que llega al JSON y que
el prompt no nombra es un dato que no llegó*. Esta versión los conecta, ordena la precedencia
entre las fuentes, pide la reescritura mejorada que encargó el médico (27-ago) sin tocarle la
casilla sin confirmación, y traduce a español clínico la jerga interna del motor antes de que
el modelo la vea.

Cada mutación se aplicó **una a la vez** sobre el archivo de producción, se corrió el banco
completo, se confirmó el rojo con la aserción esperada, y se restauró comparando con `diff`
contra una copia intacta antes de la siguiente. El banco volvió a **2.441/2.441** tras la
restauración final.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | Se quitó del prompt la línea que nombra `LO REGISTRADO EN LA HISTORIA CLÍNICA DE EVEREST` | `suite_57` | *v17.13.0 — los tres prompts nombran la historia clínica de Everest* |
| 2 | Se invirtió la precedencia: el motor por encima del médico | `suite_57` | *v17.13.0 — la precedencia se enuncia, y va antes que el formato de salida* → *el médico manda por encima de lo que calculó el motor, no al revés* |
| 3 | Se borró la distinción entre un campo en `false` (documentado como ausente) y un campo ausente (no se preguntó) | `suite_57` | *v17.13.0 — un «no» documentado no es lo mismo que un campo ausente* |
| 4 | Se renombró en el prompt un bloque (`TEXTO YA REGISTRADO EN LA HISTORIA HOY` → `RESUMEN DEL CONTROL ANTERIOR`) sin renombrarlo en `mtrRedaccionPrompt` | `suite_57` | *v17.13.0 — todo rótulo que el prompt cita, el mensaje lo emite de verdad* |
| 5 | `reemplazar` pasó a ser el valor por defecto de `mtrInsertarEnCasillaModo` | `suite_57` | *v17.13.0 — la casilla ocupada sigue intacta mientras el médico no confirme* **y** *mtrInsertarEnCasillaModo: vacía inserta; ocupada NO pisa…* (las dos: es la regla de la casa) |
| 6 | Se aplanó de nuevo la línea de órdenes, sin decir cuál examen fija la fecha | `suite_57` | *v17.13.0 — la hoja dice cuál examen fija la fecha y cuáles se enganchan* |
| 7 | Se quitó una prohibición clínica del prompt de la nota (`sin antibiótico a ciegas`) | `suite_57` | *v17.13.0 — ninguna advertencia clínica se perdió por el camino* |

**Cuatro pruebas existentes se corrigieron, no se acomodaron**: `suite_57` exigía en tres
lugares el rótulo literal «Agujero negro renal ACTIVO», que es el apodo INTERNO del motor. El
médico fue explícito el 27-ago: *«el usuario final no debe saber sobre esos términos, el ANR y
todo lo demás solamente es conmigo el programador»*. La prueba fijaba jerga, no una regla.
Ahora exige el hecho clínico dicho en llano («Vigilancia de la función renal:») **y además**
que el apodo no viaje — que es lo que de verdad había que proteger y nadie comprobaba.

---

## v17.14.0 — Tanda 3 del enjambre: tres avisos que existían y no se leían

Los tres hallazgos que quedaban de la Tanda 3 son la misma clase de defecto: el aviso está
escrito, es correcto, y aun así el médico no lo ve. Uno por quedar debajo del pliegue, otro
por quedar cortado por una elipsis, el tercero por vestirse igual que la nota rutinaria que
lo rodea. Un aviso que no se lee no es un aviso.

Banco en verde tras la restauración final: **2.444/2.444**. El color nuevo se verificó además
en Chromium real (`tools/verificar_color_chromium.js`) contra el «Everest agresivo» que exige
CLAUDE.md — `div,span,p,b,small,label{color:#111827 !important}` — y sobrevive.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 8 | La caja «⚠ Cifras sin respaldo» volvió a montarse DESPUÉS del área de texto (`salida.nextSibling`), donde una nota larga la deja fuera de pantalla | `suite_70` | *REGLA D1 (#53) — el aviso de cifras inventadas va ARRIBA del borrador, no debajo* |
| 9 | `#vgl-sum.warn/.error` volvió a `text-overflow:ellipsis`, truncando la instrucción que vive al final del aviso | `suite_70` | *REGLA D2 (#2) — una advertencia de la barra de estado no puede quedar truncada* |
| 10 | El aviso de que la respuesta guardada quedó desactualizada volvió a pegarse dentro de «Importa porque…», sin elemento ni acento propios | `suite_63` | *v17.14.0 — el aviso de que su respuesta quedó desactualizada NO vive en el pie* |

El contador de `!important` de `suite_25` (Regla G) subió de 378 a 379: es exactamente el
`color` de `.vgl-conf-desfase`, que la Regla E **exige** por colgar de `document.body` fuera
de `#vgl-root`. Se actualizó el esperado con esa razón escrita, no en silencio.

---

## v17.14.1 — PHI real fuera del repositorio y la mamografía se guía por PyM

Dos decisiones del médico en la entrevista del 27-ago, más el hallazgo que la motivó.

**El hallazgo.** Una auditoría del repositorio encontró PHI REAL sin redactar, ya publicada:
nombre completo, cédula, dirección, celular, correo y fecha de nacimiento de dos pacientes en
las capturas de red de agosto; tres pacientes más con nombre y cédula en la maqueta
`src/overlay_ui.py`; el registro médico de tres profesionales; y un celular real copiado a un
fixture de `tests/suite_62`. Ya había **seis** commits previos titulados `fix(phi)` sobre esos
mismos archivos: la redacción a ojo, repetida seis veces, seguía dejando datos. Por eso la
regla se vuelve mecánica.

**Decisiones del médico.** Valores sintéticos que preservan la forma (la captura sigue
sirviendo de evidencia de la API de Everest), y **no se reescribe el historial de git** — la
redacción es hacia adelante. Y: *«mamografía guiarse netamente de los SharePoints»*.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 11 | Se devolvió a una captura de red una de las cédulas reales que se habían redactado (no se transcribe aquí: este informe también está bajo la regla) | `suite_31` | *v17.14.0 — ningún archivo del repositorio trae la PHI real que se redactó* |
| 12 | Se devolvió un correo de dominio personal (`@gmail.com`) a una captura | `suite_31` | *v17.14.0 — una captura de red no puede traer un correo de dominio personal* |
| 13 | Se vació `PYM_MANDA_SHAREPOINT`, dejando la mamografía otra vez a merced del tope de 730 días | `suite_28` | *v17.6.99 CABLEADO — el modal cruza TODOS los paquetes y respeta el tope para desmarcar* |

La prueba 12 es la que importa a futuro: no es una lista de casos conocidos sino una regla
estructural —un correo `@gmail/@hotmail/@outlook/@yahoo/@live/@icloud` dentro de una captura
es, por definición, el de una persona real— y por eso atrapa la PRÓXIMA captura, no la de
agosto. La 11 es el guardarraíl de regresión de lo ya redactado.

El tope de 730 días **no se tocó**: sigue rigiendo para los demás paquetes sin vigencia
confirmada. Lo que cambia es que la tamización de mama sale de su alcance, porque su
periodicidad depende de la edad y del riesgo (Resolución 3280/2018) y eso ya lo resuelve el
programa de la IPS al armar la lista. El resultado de Athenea **no se esconde**: se sigue
mostrando con su fecha; lo único que deja de hacer es tocar la casilla.

---

## v17.15.0 — la consola deja de sepultarse sola, y el panel de salud mira lo que falló

El médico pegó su consola de una sesión real en v17.14.1: una pared de
«[Vigilante SYNAPSE] GM fallback también falló en intento N», cada una con su traza de pila,
sobre `BuscarPaciente` y `GetUsuarioPerfil`, con los servicios de Everest devolviendo 500 y
agotando el tiempo.

**El defecto reproducido con números ANTES de tocar nada** (`/tmp/repro.js` sobre el arnés,
servidor simulado devolviendo 500):

| | peticiones al servidor | líneas de consola |
|---|---|---|
| Antes — un solo hover sobre una tarjeta | **16** | **8** |
| Después — el mismo hover | **4** | **0** |
| Después — lo que el médico pide con un clic | 16 | 8 (**sin cambio, a propósito**) |
| Después — con el cortacircuitos abierto: especulativa / pedida | **0** / 8 | |

El detonante no era una acción del médico: era el preparador por hover, una optimización
especulativa cuyo fallo ya se descartaba con un `catch` vacío. Con el servidor caído, pasar
el cursor por la lista del día eran cientos de peticiones a un servidor que ya estaba mal, y
una consola inservible — justo la consola donde este proyecto le pide al médico que lea los
diagnósticos.

Banco en verde tras la restauración final: **2.451/2.451**.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | Que una llamada `especulativo` volviera a reintentar 4 veces | `suite_05` | *v17.15.0 — una llamada especulativa no insiste ni narra su fallo* |
| 2 | Que el `console.warn` por intento volviera a emitirse en la vía especulativa | `suite_05` | *(la misma)* |
| 3 | Que el cortacircuitos frenara también lo que el médico pidió con un clic | `suite_05` | *v17.15.0 — el cortacircuitos frena lo especulativo y JAMÁS lo que el médico pidió* |
| 4 | Quitar `_apiMarcarResultado(false)` del agotamiento de intentos | `suite_05` | *v17.15.0 — «Servicios de Everest» aparece en el panel de salud y refleja la caída* **y** la del cortacircuitos (sin marcar fallos no se abre nunca: es la consecuencia correcta, no un descuido de la prueba) |
| 5 | Devolver el `378` literal a la URL del SMS del paciente | `suite_13` | *apiLaboratorioAgendarAuto: con celular conocido, envía el SMS…* → *la sede del SMS sale de `mtrSedeIdLab()`, no de un literal* |
| 6 | Que `repPost` volviera a contar el `"no"` del panel como entregado | `suite_11` | *v17.15.0 — el «no» del panel NO cuenta como entregado, y deja causa legible* |

**Una prueba existente fijaba el cableado, no la regla.** `suite_13` exigía literalmente
`codigoSede=378`: si alguien cambiaba la sede en `mtrSedeIdLab()`, esa línea seguía pidiendo
el número viejo y el rojo habría señalado al arreglo en vez de al defecto. Reescrita para
exigir la función. Es la misma clase de defecto que ya se documentó cuatro veces en este
informe — una prueba que protege lo que hay en vez de lo que debe haber.

**Y el residuo que destapó:** la v17.6.3 sacó el `378` cableado de **cinco** URLs a
`mtrSedeIdLab()` y dejó **una** — la del SMS que llega al celular del paciente diciéndole a
qué laboratorio ir. De las seis, la única que sale de la IPS por escrito.

**Sin mutación, y se dice en vez de inventar una:** el `TZ: America/Bogota` del flujo de
GitHub, la medición de sábados (`tools/medir_sabados.js`) y la revisión de
`docs/DECISIONES_PENDIENTES_20260820.md` no cambian el comportamiento del script.

---

## v17.16.0 — Tanda 4: tres afirmaciones que nadie había comprobado

Sigue la **REGLA D** del enjambre —*un mensaje tranquilizador exige evidencia de que se
evaluó algo*— y su patrón G: *el fallo del sistema se presenta como un hecho del paciente*.
La v17.8.1 corrigió nueve casos; estos tres son de la misma familia y seguían vivos.

**1. El modal de Órdenes.** Decía «No se detectaron actividades de prevención pendientes en
la base de PyM **para este paciente**» en tres situaciones que no se parecen en nada: la
lista está cargada y él no tiene pendientes (cierta); la lista está cargada y él **no
aparece** en ella (no se sabe nada de él); y **la lista no está cargada** (no se miró nada, y
la frase es falsa). Los datos para distinguirlas ya existían (`state.pymFile`, `pymDia`,
`pymFallback`, `pymTodos` — este último guardado explícitamente para eso). Ahora hay tres
mensajes, y el del caso 1 viene con su evidencia dicha: «está en la lista de hoy y no tiene
pendientes».

**2. El reloj del turno.** Con `state.ultimaLectura` en 0 —arranque, o una sesión en la que
nunca se pudo leer la agenda— afirmaba **«Datos al día»** sobre datos que no existen. No
alarmar al arrancar está bien y se conserva (no se pinta en `vgl-stale`); afirmar que están
al día es otra cosa. Tres estados donde había dos.

**3. El cruce antiduplicado contra Athenea.** Su propio comentario decía que un fallo de red
«se cae **en silencio** al comportamiento de siempre». La conducta era correcta —ante la duda
se ofrece el examen, nunca se esconde— pero el médico veía la lista premarcada igual que
siempre, sin forma de saber que la comprobación no se hizo. El síntoma que le queda es
exactamente el que él reportó en la v17.6.99: *«me sale que hay que enviarle el antígeno de
próstata pero ya se lo realizó»*, y sin ninguna explicación a la vista. Ahora lo dice.

Banco en verde tras la restauración final: **2.455/2.455**. El color nuevo se verificó en
Chromium real contra el «Everest agresivo» de CLAUDE.md.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | Que el motivo «sin lista» dejara de existir y todo cayera en «sin pendientes» | `suite_70` + `suite_15` | *REGLA D (#Tanda 4) — «no tiene actividades pendientes» exige haber mirado una lista* **y** *openOrdenamientoModal: sin coincidencia PyM…* |
| 2 | Que el modal volviera a la frase única, ignorando el motivo | `suite_15` | *openOrdenamientoModal: sin coincidencia PyM no ofrece NADA para ordenar y lo avisa* |
| 3 | Que el reloj volviera a dar por hecho que hubo lectura | `suite_70` | *REGLA D (#Tanda 4) — el reloj no dice «datos al día» antes de haber leído nada* |
| 4 | Que el fallo de Athenea volviera a caerse en silencio | `suite_15` | *v17.16.0 — si no se pudo consultar Athenea, el modal lo DICE en vez de callarlo* |
| 5 | Que el aviso dejara de distinguir `null` («no pude preguntar») de `[]` («pregunté y no hay») | `suite_15` | *v17.16.0 — si Athenea SÍ responde (aunque sin nada), el aviso NO sale* |

**Una prueba existente llamaba «aviso honesto» a la frase menos honesta del modal.**
`suite_15` fijaba literalmente *«No se detectaron actividades de prevención pendientes»* — en
un vector donde **no se había cargado ninguna lista de PyM**. Es la octava vez que este
informe registra una prueba que fija un defecto en vez de una regla, y se reescribió dejando
escrito el porqué.

**Y una aserción mía nació equivocada y se corrigió en el sitio, no se acomodó.** Al escribir
la mitad «si Athenea responde, el aviso no sale» la añadí a un caso cuyo vector **no** tiene
a Athenea respondiendo (el arnés por defecto devuelve `null`, que es justamente «no se pudo
leer»): la aserción se puso roja con razón. En vez de relajarla, se movió a un caso con un
plan de red propio donde el portal contesta en cada puerta y el paciente no tiene ninguna
solicitud — y ese caso **empieza comprobando que el vector da `[]` y no `null`**, o no estaría
distinguiendo nada.

El contador de `!important` de `suite_25` sube de 379 a 380: es el `color` de
`.vgl-ord-nocruce`, que la Regla E **exige** por colgar de `document.body`.

**Nota de nomenclatura:** convivían dos «REGLA D» con significados distintos (la del enjambre
y la que añadió la v17.14.0 para los avisos que no se leen). Las de la v17.14.0 conservan sus
rótulos D1/D2 por estar ya citadas en este informe, y queda anotado en `suite_70` que la D a
secas es la del enjambre.

---

## v17.16.1 — los cabos sueltos del propio banco

**Sin un solo cambio de comportamiento del script.** Esta entrega no toca producción: cierra
los huecos que el propio informe de cobertura llevaba señalando y que nadie había atendido.

### 1. El informe de cobertura estaba mintiendo, y hacia abajo

Dos listas del runner venían con contenido desde hace versiones:

- **«declaradas en cubre pero JAMÁS invocadas vía `api.·(...)`» (13)** — funciones que una
  suite decía cubrir y que ninguna prueba llegaba a llamar. Dos eran mías (`_saludMarca`,
  `mtrAnalitoQueFijaLaToma`).
- **«sin cubrir» (107)** — de las cuales **16 SÍ se ejercitaban** en alguna suite y solo
  faltaban en su `cubre`. Entre ellas, **seis de la barrera de PHI** (`mtrHechosDesdeHcEverest`,
  `mtrCosecharHcDelDom`, `mtrHcAcumularDelDom`…): la parte más delicada del proyecto figuraba
  como no probada cuando sí lo estaba.

Un informe que **subestima** engaña igual que uno que exagera: esconde cuáles son los huecos
de verdad. Declarada la verdad, la cobertura pasó de **88,3 % a 90,1 % sin escribir una sola
prueba**. Las dos listas quedan hoy **vacías**.

### 2. Lo que de verdad faltaba, probado de frente

Escritas 13 pruebas nuevas, priorizando por consecuencia clínica, no por facilidad:

| Qué | Por qué importaba |
|---|---|
| `mtrRutaHcAceptada`, `mtrHcTachaduras`, `mtrHcTachar`, `mtrHcValorLimpio` | **El núcleo de la barrera de PHI**, sin una sola prueba directa. Si fallan, sale el nombre y la cédula del paciente hacia un servicio de terceros. Es exactamente la función que un reinicio del worker dejó desactivada una vez en el árbol de trabajo |
| `mtrFueraDeMeta`, `_mtrMargenMeta` | El umbral **meta+15 %** con que se declara falla terapéutica y se acorta la vigencia |
| `mtrStatusV68`, `mtrSolicitudV68` | Lo que impide que la nota clínica hable de una categoría de riesgo **que nunca se calculó** |
| `_vglGuardarDeshacer`, `_vglEjecutarDeshacer` | La red de la inserción en la historia, incluida la vía de reemplazo de la v17.13.0 |
| `mtrConsolidarMtt` | La fusión **direccional** de recontroles (v17.6.57): con `Math.abs` un LDL a 42 días se adelantaba por debajo del piso de 4 semanas |
| `_esMuestraSerica`, `_esUroComponenteAlterado` | La regla que destapó «falta la creatinina de agosto» |
| `mtrMedsSinGrupo`, `mtrMedsFueraDeGrupoNombres`, `mtrAvisoFueraDeGrupo` | El **punto ciego** del motor farmacológico |
| `_identidadMedicoCache*`, `_repSello`, `_saludMarca`, `vglMinBarra`, `_vglMinDescartarDeOtroPaciente`, `_apiCorteAbierto`, `_apiMarcarResultado` | Cachés, sellos y guardas con reglas no obvias (caducidad, contaminación cruzada, semáforo pegado) |

Cobertura final: **838 / 917 (91,4 %)**, banco **2.469/2.469**.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 6 | Que el aviso de fármaco fuera de grupo sugiriera «ajustar» | `suite_41` | *las tres funciones de «fármaco fuera de grupo»…* |
| 7 | Que la fusión MTT volviera a ser bidireccional (`Math.abs`) | `suite_46` | *mtrConsolidarMtt, probada de frente…* |
| 8 | Que `_esMuestraSerica` dejara de reconocer «DIFERENTE A ORINA» | `suite_08` | *_esMuestraSerica y _esUroComponenteAlterado…* |
| 9 | Que la caché de identidad del médico dejara de caducar | `suite_19` | *la caché de identidad del médico…* |
| 10 | Que una lectura buena dejara de borrar la ventana de fallo del semáforo | `suite_05` | *_saludMarca, probada de frente…* |
| 11 | Que el sello de error dejara de guardar la causa | `suite_23` | *_repSello, probada de frente…* |
| 12 | Que el descarte por cambio de paciente dejara de descartar | `suite_15` | *vglMinBarra y el descarte por cambio de paciente…* |
| 13 | Que el colapso de recontroles se fuera a la fecha más tardía | `suite_46` | *mtrConsolidarMtt…* |
| 14 | Que la lista blanca de PHI dejara de anclarse al inicio del nombre | `suite_31` | *mtrRutaHcAceptada: la lista blanca…* |
| 15 | Que las tachaduras dejaran de ordenarse de más larga a más corta | `suite_31` | *mtrHcTachaduras y mtrHcTachar…* |
| 16 | Que desapareciera el escape de expresión regular del tachado | `suite_31` | *mtrHcTachaduras y mtrHcTachar…* |
| 17 | Que el margen de falla volviera a «estrictamente > meta» | `suite_45` | *mtrFueraDeMeta: el umbral de meta+15 %…* |
| 18 | Que los datos incompletos dejaran de forzar `PENDIENTE` | `suite_45` | *mtrStatusV68 y mtrSolicitudV68…* |
| 19 | Que desapareciera la guarda de paciente del Deshacer | `suite_31` | *el Deshacer: una sola ranura…* |
| 20 | Que `mtrHcValorLimpio` dejara pasar objetos anidados | `suite_31` | *mtrHcValorLimpio…* |
| 21 | Que una lectura buena no cerrara el cortacircuitos | `suite_05` | *el cortacircuitos frena lo especulativo…* |

### 3. Tres aserciones mías nacieron equivocadas, y las tres se corrigieron en el sitio

- Una mutación **mal apuntada** (M6) rozó solo la rama plural del aviso mientras el vector usa
  la singular: el banco quedó verde y no era mérito de la prueba. Se reapuntó a la rama real.
- La prueba del Deshacer esperaba `1` donde el código devolvía `0` — y **el código tenía
  razón**: la guarda de paciente estaba haciendo su trabajo. En vez de relajar la aserción, se
  reescribió el caso para fijar **esa guarda**, que vale más que lo que yo iba a probar:
  restaurar «lo que había antes» con otra historia abierta sería escribirle a un paciente el
  texto de otro.
- Una comprobación del cortacircuitos, insertada a mitad del caso, **cerraba el corte** e
  invalidaba las comprobaciones siguientes. Se movió al final, con la razón anotada en el sitio.

### 4. Lo que queda sin cubrir, dicho y no disimulado

Quedan **79** funciones sin prueba. No son un hueco uniforme: **11** son del acompañante,
**7** de la precarga de laboratorios, **16** de ajustes y ventana (redimensionar, modo oculto,
alto contraste), **4** del registro de inasistencias. Ninguna decide una conducta clínica ni
escribe en la historia. Se dice en vez de dejar el número suelto: un 91,4 % con la barrera de
PHI y los umbrales clínicos cubiertos no es lo mismo que un 91,4 % repartido al azar.

---

## v17.17.0 — el vigilante de la agenda ya no acusa a quien llegó a tiempo

Reporte en vivo (27-ago): "avisa erróneamente que activaron un paciente tarde y no fue así"
— un falso positivo de CONTENIDO, no una demora ni un duplicado (los dos ya cerrados en
v17.6.21 y v17.6.74).

**Causa raíz confirmada antes de tocar código**, con dos revisores independientes intentando
refutarla sin lograrlo: la única compuerta para ORIGINAR una marca de fraude era
`state.leader` (v17.6.74) — sin exigir que la lectura fuera fresca. Con varias pestañas de
Citas del día del mismo médico, una pestaña oculta y estrangulada por el navegador que
recupera el liderazgo por `relevoPorVisibilidad` puede hacerlo con su PRIMERA lectura, que
puede venir de una copia estancada (su propio DOM sin refrescar, o `state.apiCitas` con hasta
180 s de antigüedad) — y como `elapsed` se calcula siempre contra el reloj real, esa lectura
vieja puede ya superar la gracia y originar fraude para un paciente que otra pestaña ya había
confirmado a tiempo.

**El primer arreglo propuesto (gatear por `!eraLider`, o exigir una segunda lectura en el
primer vistazo) fue descartado por un tercer revisor antes de escribirse**: `!eraLider` es
verdadero en CUALQUIER arranque de sesión (no distingue un relevo real de un inicio de una
sola pestaña) y habría suprimido la detección legítima del arranque tardío que ya protegen
`suite_04` y `suite_32`; exigir segunda lectura contradice el contrato explícito de
`colorAndAlert` ("la primera vez que se ve una cita nunca se demora") y puede perder evidencia
de un fraude genuino que se resuelve dentro de la espera artificial.

**El arreglo que sí se implementó** reutiliza una señal que ya existía y ya distingue
exactamente lo correcto: `_ultimoRelevoVisibilidad`, que solo se actualiza cuando ESTA
pestaña de verdad le quita el mando a otra pestaña ajena, oculta y con latido fresco — nunca
en un arranque de sesión sin relevo (empieza en 0 y una sesión de una sola pestaña jamás lo
toca). Durante `RELEVO_GRACIA_FRAUDE_MS` (8 s) tras un relevo así, la pestaña líder sigue
pintando el color de siempre pero NO origina la marca de fraude — la lectura sospechosa
queda igual en la bitácora (`LECTURA_TRAS_RELEVO_SIN_CONFIRMAR`) en vez de perderse. Pasada
la ventana, o sin relevo de por medio, origina exactamente igual que antes.

Banco en verde tras la restauración final: **2.473/2.473**.

| # | Qué se rompió a propósito | Suite | Prueba que cayó |
|---|---|---|---|
| 1 | Quitar la gracia por completo (volver a originar con el solo `state.leader`) | `suite_04` | *v17.17.0: la pestaña líder NO origina fraudWatch en la ventana de gracia…* **y** *v17.17.0: reproducción de dos pestañas…* |
| 2 | Invertir la condición (originar SOLO durante la gracia, nunca fuera de ella) | `suite_04` | 5 pruebas de `suite_04` caen, incluida la v17.6.74 preexistente — la gracia no puede convertirse en la única vía |
| 3 | Quitar el `logEvent` de la lectura suprimida | `suite_04` | *v17.17.0: la pestaña líder NO origina fraudWatch… pero deja constancia* |

**Sin mutación, y se dice en vez de inventar una:** el mapeo completo del Panel del paciente
y el diseño del widget de Conducta (`docs/BACKLOG_PENDIENTE_20260828.md`) no tocan código de
producción en esta versión — son insumo para la refactorización S+ pendiente.

---

## v17.18.0 — el widget de Conducta: "qué ordenar en el próximo control"

Primer widget flotante anclado a un botón real de Everest dentro de la pestaña Conducta
(`#vgl-cw-examenes`). Reusa `mtrTableroClinico` (el mismo motor de la Sección 3 del Panel
del paciente) para el contenido — cero cálculo nuevo — y ancla por texto sobre el botón
"Paquetes" (única evidencia real disponible: `captura_ordenamiento_paquete_HTA_20260812.json`
solo trae tag+texto de los clics, no selectores). Verificado en Chromium real contra un
CSS "Everest" agresivo (`tools/verificar_color_chromium.js`, 6 casos nuevos de selectores
compuestos): los 6 sobreviven.

Banco en verde tras la restauración final: **2.488/2.488**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Que el interruptor `S.conductaWidgets` dejara de apagar el widget | *mtrWidgetConductaTick: apagado por S.conductaWidgets=false…* |
| 2 | Que un cambio de paciente NO reiniciara la firma/conteo previos | *mtrWidgetConductaTick: cambiar de paciente reinicia el estado…* |
| 3 | Que el widget repintara su contenido aunque la firma no hubiera cambiado (parpadeo) | *mtrWidgetConductaTick: anti-parpadeo…* |
| 4 | Que `mtrBotonOrdenarConducta` dejara de filtrar botones no visibles de verdad | *mtrBotonOrdenarConducta: un botón 'Paquetes' oculto… no cuenta como visible* |
| 5 | Que "sin programa identificado" se confundiera con "al día" | *mtrWidgetExamenesDatos: sin programa identificado…* |

**Sin mutación, y se dice en vez de inventar una:** las 21 decisiones de la entrevista S+
de esta noche (`docs/DECISIONES_ENTREVISTA_SPLUS_20260828.md`) no tocan código de
producción en esta versión — son la base para el trabajo que sigue.

---

## v17.19.0 — "Silenciar 15 min" ahora sí silencia todo

Decisión del médico: el silencio temporal debía callar el toast y la notificación de
Windows además del tono. `_dispararAvisoAudible` gana un `if (muted()) return true;`
(devuelve `true`, no `false`, para no perder el encolado del cartel pendiente cuando el
silencio ya haya vencido) y `_dispararAvisoCartel` gana `&& !muted()` — cierra de paso una
brecha real: su propio comentario ya prometía "calla... cartel" desde antes, sin que el
código lo hiciera.

Banco en verde tras la restauración final: **2.490/2.490**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Quitar el `muted()` de `_dispararAvisoAudible` | *v17.19.0: el silencio temporal también calla el toast y la notificación de Windows…* |
| 2 | Quitar el `!muted()` de `_dispararAvisoCartel` | *v17.19.0: el silencio temporal también calla el cartel dentro de la página* |

**Investigado, sin mutación porque no hubo cambio de comportamiento que fijar:** el reporte
de "notificaciones repetidas" se revisó a fondo (toda la cadena de deduplicación —
`state.notified`, `bumpStatCita`/`state.contadas`, `state.alertedFraud`, la siembra
compartida) sin encontrar una vía nueva y reproducible más allá de lo que ya cubren seis
arreglos anteriores. Queda como investigación abierta en el CHANGELOG, no como mutación
falsa.

---

## v17.20.0 — cuatro ajustes muertos, retirados

Decisión del médico. **Sin mutación, y se dice en vez de inventar una**: `tolerancia`,
`labsVencidos`, `avisoPymModal` y `bannerPym` se confirmaron 100 % muertas ANTES de tocar
nada (`grep -n "S\.<clave>\b"` contra el archivo completo: cero resultados en los tres
últimos casos, y el único uso de `tolerancia` fuera de la declaración era el propio
`CONFIG.TOLERANCIA_MIN`, ya fijo en 6 sin depender del ajuste). Al no haber ningún código
que las leyera, no hay ningún comportamiento observable que una mutación pueda romper —
inventar una sería simular una prueba que no prueba nada. Se retiraron también sus dos
pruebas asociadas en `suite_15_interfaz_avanzada.js` (probaban exactamente la migración
que se retiró) y la etiqueta "(en pruebas)" del interruptor de avisos farmacológicos (puro
copy, sin lógica).

Banco en verde tras la restauración final: **2.488/2.488** (2.490 menos las 2 pruebas de
la migración retirada).

---

## v17.21.0 — el reloj de cabecera dice qué tan seguido está mirando

Decisión del médico: el tooltip del reloj de cabecera anota la cadencia real de sondeo
(`apiCadencia()`, 5–30 s) además de si los datos están al día. Nueva prueba directa de
`actualizarRelojCabecera` (función sin ninguna cobertura hasta ahora).

Banco en verde tras la restauración final: **2.489/2.489**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Quitar el cálculo de la cadencia del tooltip | *actualizarRelojCabecera: el tooltip dice la cadencia de sondeo real…* |

---

## v17.22.0 — los chips de PyM vuelven a la tarjeta (reversión consciente de T4)

Recuperadas `panelActivities`/`isPanelHiddenActivity` **textualmente** de su última versión
viva en el historial de git (commit `46e2076^`, antes de que v17.6.10 las retirara por
falta de llamador) — no se reinventó el filtro AV/OD, se recuperó el original. Nuevo: tope
de 3 chips visibles con overflow "+N más" (detalle completo en el `title`, nunca se
pierde). Se decidió NO abreviar el texto de cada chip — el propio comentario histórico de
`.vgl-pyms` (v12.4.0) documenta que truncar chips fue un defecto real de consultorio ya
corregido a propósito; inventar una tabla de siglas sin fuente real habría violado "casilla
vacía antes que dato inventado". Sin verificación adicional en Chromium: `.vgl-chip`/
`.vgl-pyms` viven dentro de `#vgl-root` (heredan su blindaje ya verificado) y la única
regla nueva (`.vgl-chip-mas`) solo toca `opacity`/`cursor`, ningún `color`.

Banco en verde tras la restauración final: **2.497/2.497**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Subir el tope de 3 chips a 30 (sin límite real) | *v17.22.0 — más de 3 actividades: se ven 3 chips y un '+N más'…* |
| 2 | `isPanelHiddenActivity` deja de reconocer Optometría/Odontología | 5 pruebas caen, incluida *isPanelHiddenActivity: reconoce Optometría/Odontología…* y la de AV/OD oculta aparte del tope |
| 3 | `enBase` siempre `true` (nunca detecta "no cruza con la base") | *v17.22.0 — con PyM cargado pero SIN cruzar con la base: 'Dato faltante'…* |
| 4 | Quitar `${pyms}` de la plantilla de la tarjeta | 9 pruebas caen — toda la sección de chips depende de este único punto de inserción |
