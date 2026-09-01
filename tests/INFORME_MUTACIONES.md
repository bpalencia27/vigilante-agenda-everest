# Informe de mutaciones verificadas

> Cada fila es una prueba que se **rompió a propósito** y se comprobó que una prueba
> concreta se pone roja, se restauró, y se confirmó que el banco vuelve a verde.
> La disciplina está en `CLAUDE.md`: *todo cambio de comportamiento requiere mutación
> verificada*. Una prueba que no cae cuando el código se rompe no está probando nada — y
> este proyecto ya se llevó nueve sustos con pruebas que reportaban verde sin ejecutar.

## v17.47.0 — 29-ago-2026 (el JSON que va a la IA podía ir caducado)

`mtrAbrirPanelRedaccion` calculaba la hoja de hechos una sola vez al abrir el panel, y el
manejador de Generar reutilizaba esa foto. Con el panel abierto mientras el médico completa
la historia —uso normal, documentado en el propio código— la nota se redactaba con cifras
de hasta 13 minutos antes (3 min de TTL más el rato abierto).

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | Generar vuelve a usar la foto (`resumen`/`hoja` del cierre) — el defecto original | "el manejador de Generar usa el resumen resuelto" | Sí — 132/132 |
| 2 | `mtrIaResumenVigente` deja de consultar la caché | "al generar se usa el resumen VIGENTE" | Sí — 132/132 |

Una prueba de regresión existente (`v17.6.42: … llega a los 4 puntos de envío`) buscaba
`nombrePaciente: resumen._nombrePaciente` **por identificador literal** y cayó al renombrar
la variable a `_res`. Su intención —que el nombre llegue al objeto `opts`, que es lo que
permite tacharlo antes de enviarlo— no cambió, así que se aceptó cualquiera de los dos
portadores en vez de atarse al nombre exacto. Se verificó que sigue cayendo si se quita la
línea entera.

**Incidente de proceso, y se documenta en vez de disimularse:** al bumpear la v17.46.0
escribí `package.json` con `open(p,"w").write(open(p).read())` — Python evalúa el `open` de
escritura primero, **trunca el archivo**, y luego lee un archivo vacío. El `package.json`
quedó en 0 bytes y así se empujó al remoto en dos commits. Se detectó al primer `node
tests/runner.js` posterior ("Invalid package config") y se restauró desde el último commit
bueno (`e9e0255`). Ninguna prueba lo habría cazado: el banco no valida su propio
`package.json`. Desde esta versión el bump se hace con `json.load`/`json.dumps`, leyendo
antes de abrir para escritura.

## v17.46.0 — 29-ago-2026 (la cosecha se perdía en silencio con la cuota llena)

`_vglCosechaGuardar` escribía con `localStorage.setItem` a pelo dentro de un `try/catch`
que devuelve `null`: el `QuotaExceededError` se tragaba entero. `safeWriteJSON` (purga +
reintento) ya existía y otras rutas la usaban; la que guarda la memoria clínica, no.

**Reproducido antes de arreglar:** la prueba salió en rojo con el código intacto.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | Volver a `localStorage.setItem` directo, sin purga ni reintento | "la cosecha no se pierde en silencio si el almacén está lleno" | Sí — 38/38 |

**Una aserción propia nació equivocada y se corrigió en el sitio, no se acomodó el código.**
La primera versión de la prueba exigía que, tras guardar solo `diabetes`, siguiera estando
`hta`. Eso es fusión PROFUNDA, y `_vglCosechaGuardar` fusiona **plano** a propósito — el
"pozo" ya documentado en el código, que los llamadores reales esquivan pre-fusionando. La
prueba afirmaba algo que la función nunca ha prometido. Se reescribió para mandar el mapa
completo, igual que hace producción.

## v17.45.0 — 29-ago-2026 (fuga de PHI: el nombre no llegaba al censor por un canal)

`mtrDatosExtraTexto` llamaba a `mtrSanearTextoLibreAI(s)` sin el 2.º argumento, así que la
rama `if (nombrePaciente)` —la única defensa por TOKENS, y la única capaz de tachar un
apellido en MAYÚSCULAS SOSTENIDAS o un nombre propio, que no tiene forma reconocible—
quedaba inerte. Los otros cuatro canales del prompt sí lo pasaban.

**Reproducido antes de arreglar:** la prueba salió en rojo con el código intacto.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | `mtrDatosExtraTexto` vuelve a llamar al saneador sin el nombre | "tacha el nombre del paciente: no viaja a Gemini" | Sí — 128/128 |
| 2 | `mtrRedaccionPrompt` deja de propagar `o.nombrePaciente` | "el prompt propaga el nombre a los datos extra" | Sí — 128/128 |

**La mutación 2 NO cayó en el primer intento, y eso destapó una prueba vacua.** Estaba
escrita para armar un prompt real y comprobar que el nombre no apareciera en `user`; pero
con esos argumentos el ensamblador cae en otra rama y el bloque de datos extra **ni
siquiera se emite**, así que pasaba por ausencia. Se reescribió como regresión de código
fuente —el mismo patrón que la de `suite_71` sobre el enganche de los widgets— porque lo
que hay que fijar es el CABLE. Con eso, la mutación 2 sí cae.

Décima vez en este proyecto que una prueba nueva no caza su propia mutación. Se documenta
en vez de disimularse: una mutación que no cae es información.

## v17.44.0 — 29-ago-2026 (el recordatorio de PyM sobrevive al CSS de Everest)

No hay mutación de código que verificar: el cambio es puramente declarativo (seis
`!important` en reglas de color). La verificación equivalente, y más fuerte, es empírica en
Chromium real — y se hizo en las dos direcciones, que es lo que la convierte en prueba:

| Estado del código | Aviso clínico | Contador | Nombre | Título |
|---|---|---|---|---|
| **Sin** el arreglo (revertido a propósito) | ❌ pisado | ❌ pisado | ❌ pisado | ❌ pisado |
| **Con** el arreglo | ✅ ámbar | ✅ | ✅ | ✅ |

El CSS de "Everest" simulado es deliberadamente más agresivo que el real: lleva
`!important` **y** más especificidad que nuestras reglas. Si el color sobrevive a eso,
sobrevive a cualquier cosa. El CSS se extrajo del script con las hojas interpoladas
resueltas (mismo método que `suite_25`), nunca de una copia recortada a mano.

Revertir el arreglo y ver los cuatro caer es la contraprueba: demuestra que el arreglo era
necesario, no decorativo. El contador de `!important` de `suite_25` se actualizó a mano de
527 a 533 con su justificación, que es exactamente para lo que ese contador existe.

## v17.43.0 — 29-ago-2026 (diario de lentitud: del "cuántas veces" al "cuándo y qué")

Entrega de INSTRUMENTACIÓN, no de optimización: no se tocó ni una ruta caliente. El medidor
LoAF ya existía y sabía atribuir culpa (nuestra vs. Everest), pero solo agregaba baldes y
estaba atado al interruptor de la telemetría que puede salir del equipo — que el médico
tiene apagado. Se separó en dos interruptores y se le añadió memoria de contexto.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | El anillo de fases deja de vaciarse tras volcarse a la bitácora | "vacía el anillo tras volcarlo — no acusa a la fase equivocada dos veces" | Sí — 100/100 |
| 2 | Se retira el tope del anillo (`RUM_TRAMOS_MAX`) | "el anillo tiene tope — nunca crece sin límite en una jornada entera" | Sí — 100/100 |

Nota de método: la mutación 1 es la que de verdad importa. Sin vaciar el anillo, la
**segunda** tarea larga heredaría las fases de la primera y la bitácora acusaría a una fase
que ya había terminado — un diagnóstico que miente es peor que no tener diagnóstico.

Una prueba existente (`_iniciarRumObserver: con uxTelemetria apagada … NO crea ningún
observador`) fijaba el contrato viejo y se reescribió, conservando su intención: con los
DOS interruptores apagados sigue sin instalarse nada. Y se añadió la garantía que sostiene
la separación — con `perfLog` encendido y `uxTelemetria` apagado, **ningún contador entra al
almacén que viaja**.

## v17.42.0 — 29-ago-2026 (cruce de pacientes en "Ordenar pendientes")

Hallazgo de auditoría adversarial, no de consulta. `_conductaBuscarYAgregarExamen` era la
ÚNICA cadena de escritura clínica sin la guarda `_pacienteSigueAbierto` (las otras 13 rutas
sí la usaban). Entre el clic en el `<li>` y el clic en "Agregar" hay 700 ms de espera fija,
y cada `querySelectorAll("button")` posterior es de documento completo: si el médico
cambiaba de historia en ese hueco, se ordenaban los exámenes de un paciente en la historia
de otro.

**Reproducido ANTES de arreglar:** las dos pruebas nuevas se escribieron primero y salieron
en rojo (78 ok / 2 fallan) con el código sin tocar — el defecto era real y alcanzable desde
el arnés, no una hipótesis.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | Se retira la guarda del hueco de 700 ms (entre el `<li>` y "Agregar") | las 2 nuevas de cruce de pacientes | Sí — 80/80 |
| 2 | El orquestador deja de propagar `docIdEsperado` a cada búsqueda | "mtrConductaAgregarPendientes: propaga el docId…" | Sí — 80/80 |

Banco completo: **2.583** en verde (2.580 + 3 pruebas nuevas), `TZ=America/Bogota`.
La tercera prueba nueva fija la **retrocompatibilidad**: un llamador que no pasa `docId`
se comporta igual que antes, porque el parámetro es opcional a propósito.

## v17.41.0 — 28-ago-2026 (el badge de exámenes se ancla y se ve igual que Historial/Paquetes)

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | `mtrWidgetConductaTick`: el ancla vuelve a ser solo un botón (`mtrBotonOrdenarConducta`), no el par Historial+Paquetes (`mtrAnclaOrdenarPendientes`) | 4 pruebas de `suite_71` (las que dependen del nuevo ancla) | Sí — 77/77 |
| 2 | El desplazamiento vertical `MTR_ALTO_FILA_CONDUCTA + MTR_HUECO_FILA_CONDUCTA` se quita del cálculo del `top` | "encendido, con paciente/resumen/ancla — crea el widget centrado en una segunda fila..." | Sí — 77/77 |
| 3 | `centroX` deja de ser el punto medio `(rH.left+rP.right)/2` y pasa a ser solo `rP.right` | misma prueba de arriba | Sí — 77/77 |

Las mutaciones 2 y 3 **no cayeron en el primer intento** — la razón, y el fix del arnés que
lo permitió, están documentados en el CHANGELOG de esta versión y no se repiten aquí:
`boton()`/`botonHistorial()` no declaraban `.bottom` en su `getBoundingClientRect()`
simulado, así que `Math.max(rH.bottom, rP.bottom)` daba `NaN` en ambos lados de la
comparación y la prueba pasaba pasara lo que pasara con la fórmula. Con `.bottom` añadido
a los dos fixtures, las mutaciones 2 y 3 sí tumban la prueba como debían.

## v17.40.0 — 28-ago-2026 (las notificaciones ahora miran hasFocus(), no solo hidden)

Reporte en vivo: "cuando estoy en otra ventana o en otro programa, no me avisa de
llegadas, cambios de leyenda, inasistencias". Causa confirmada en el código: los cinco
puntos que deciden el CANAL de un aviso (`notify`, `_flushAvisosPendientes`,
`_dispararAvisoAudible`, `_dispararAvisoCartel`, `_dispararAvisoReal`) usaban
`_pestanaOculta()` — que solo mira `document.visibilityState`, y el navegador NO marca una
pestaña "hidden" por estar detrás de otra ventana o mientras el médico usa otro programa;
solo al minimizar o cambiar de pestaña. Con la ventana visible pero sin foco, el código
tomaba la rama de "pestaña visible" y pintaba el toast dentro de la página — tapado por la
otra ventana — sin llegar nunca a la notificación real de Windows.

Se agrega `_pestanaSinAtencion()` (`_pestanaOculta() || !document.hasFocus()`) y se cambian
los CINCO puntos de decisión de canal a usarla. A propósito **NO** se toca
`_pestanaOculta()` en sí ni su único otro uso real (`heartbeat()`, el relevo de liderazgo
entre pestañas): perder el foco sin estar oculta no debe disparar un cambio de mando, solo
cambiar cómo se avisa — mezclar los dos habría reintroducido el "rebote de liderazgo" que
v14.1.5 ya cerró con cuidado.

`document.hasFocus` se agregó al arnés (`tests/harness.js`, por defecto `() => true`) para
poder simular el caso real sin romper ninguna prueba existente (todas asumían implícitamente
foco, que es el estado por defecto).

Cuatro cambios de comportamiento verificados con mutación (los cinco puntos de canal
comparten una sola función nueva, así que dos mutaciones bastan para cubrir el mecanismo:
la función en sí, y que un punto de decisión de verdad la llame). Restaurado y verificado
con `diff` contra copia intacta. Banco completo en verde: **2580/2580** (suite_42 sola:
48/48; suite_17 sin cambios: 41/41, confirmando que `heartbeat()` no se vio afectado).

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `_pestanaSinAtencion()`: quitar el `\|\| !document.hasFocus()` (vuelve a ser un alias de `_pestanaOculta()`) | *VISIBLE pero SIN FOCO... cuenta igual que oculta* y *perder el foco... NO cambia `_pestanaOculta()`* (suite_42) |
| 2 | `notify()`: devolver `_pestanaSinAtencion()` a `_pestanaOculta()` en la decisión de canal | *VISIBLE pero SIN FOCO (otra ventana encima, sin minimizar) — cuenta igual que oculta: sale por el sistema* (suite_42) |

No se mutó cada uno de los cinco puntos por separado (`_flushAvisosPendientes`,
`_dispararAvisoAudible`, `_dispararAvisoCartel`, `_dispararAvisoReal`): las mutaciones 1 y 2
ya prueban que el mecanismo (la función nueva, y que al menos un punto real la invoque)
funciona: los otros cuatro son el mismo patrón de una línea, ya cubiertos por pruebas
preexistentes que fijan su comportamiento con `visibilityState="hidden"` — repetir la
mutación en cada uno habría sido repetir la misma prueba con otro nombre.

## v17.39.0 — 28-ago-2026 (el botón "Ordenar pendientes" copia el CSS real de "Paquetes")

Solo estilo visual — sin comportamiento nuevo que mutar, y decirlo es más honesto que
inventar una fila (mismo criterio que v17.33.0). El médico obtuvo el `getComputedStyle`
real del botón "Paquetes" desde la consola de Everest y lo pegó; el CSS de
`#vgl-cw-ordenar-btn` se reescribió con esos valores literales (fondo blanco, texto
`rgba(0,0,0,.87)`, sin borde, radio 13px, sin sombra, 36px de alto, tipografía real) en vez
del estilo propio (verde, con sombra). `font-size` usa `var(--t-micro)` (ya vale 12px) en
vez de un literal, para no romper la Regla G de `suite_25_cascada_css.js` (font-size
literales prohibidos fuera de la escala tipográfica) — sin cambiar el tamaño real.

**Verificado en Chromium real** (no solo la copia recortada que exige CLAUDE.md para reglas
de color nuevas fuera de `#vgl-root`): se montó el CSS exacto de este botón en una página
con un CSS "Everest" simulado agresivo (`div,span,p,b,small,label,button{color:red
!important}`) — el `color:rgba(0,0,0,.87) !important` sobrevive.

Sin mutación asociada. Banco en verde: **2577/2577**.

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

---

## v17.48.0 — una sola clave por paciente (D2)

**Reproducción antes de arreglar:** con el código intacto, las dos pruebas de lectura
tolerante de `vgl_cosecha` (guardar bajo `0005150076` y leer como `5150076`, y al revés)
salieron **en rojo**. La tercera (dos pacientes distintos no se cruzan) ya salía verde. El
defecto era real y alcanzable, no teórico.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | `_vglDocCanon` deja de componer con `normalizeKey` (vuelve a ser `extractDoc` a secas) | *v17.48.0 — apiParse entrega la cédula canónica…*, *— la cédula de la historia abierta sale canónica…*, *— el respaldo por DOM entrega la misma cédula canónica…* |
| 2 | `_vglListaTieneDoc` vuelve a `lista.includes(s)` (sin respaldo de lectura) | *v17.48.0 — el bloqueo del día reconoce al paciente con o sin ceros delante* |
| 3 | `_vglBuscarPorDoc` pierde el recorrido por forma canónica | *v17.48.0 — la memoria se archiva bajo UNA sola clave…*, *— y al revés…*, *— la fecha de la cita del día se encuentra…* |
| 4 | El detector agrupa con `length > 0` en vez de `> 1` (todo es duplicado) | *v17.48.0 — el detector agrupa las claves del MISMO paciente y no las de otros*, *— sin duplicados el detector no inventa grupos* |
| 5 | La línea de bitácora del detector añade un campo con las claves reales | *v17.48.0 — CERO PHI: el detector anota el conteo, jamás una cédula* |
| 6 | `_vglMismaCedula` pierde la guarda de cédula vacía (dos ilegibles se igualan) | *v17.48.0 — dos cédulas ilegibles NO son el mismo paciente* |

**Nota sobre la mutación 5.** El primer intento (filtrar `grupos[0][0]`, una cédula suelta)
**no tumbó ninguna prueba**: `vglLog` ya censura por su cuenta todo número o texto de más de
5 dígitos, así que la fuga no llegaba a disco. Siguiendo la regla de la casa —si una
mutación no cae, el defecto está en la prueba— se reforzó la prueba para que fije también la
**forma** de la línea (el nombre de la acción y la lista exacta de campos de `det`), y con
eso la mutación sí cae. La defensa de `vglLog` sigue ahí; ahora además está fijada la
promesa de que esa línea solo lleva conteos.

---

## v17.49.0 — la evidencia no se da por entregada sin acuse (D4)

**Medición previa, no reproducción:** el defecto (una fila de evidencia borrada tras un
envío que nadie confirmó) ya estaba acotado desde la v17.6.14 por la guarda de «acuse
fresco», así que no se puede reproducir en rojo con una prueba sencilla: hace falta la
ventana concreta de panel-sano-hace-menos-de-30-min-y-caído-ahora. Lo que sí se midió,
leyendo el receptor que vive en este repositorio, es que **la solución esbozada habría sido
peor que el defecto**: `LOTE_TTL_SEG = 21600` (6 h) contra un reintento que ocurre al
siguiente arranque — típicamente 13 h después. De ahí que la entrega no retenga-y-beaconee,
sino que **no beaconee la evidencia en absoluto**.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Revertir: la evidencia vuelve a viajar por beacon y a retirarse | 5 casos de suite_23, entre ellos *v17.49.0 (D4): la evidencia NO se despacha por beacon…* |
| 2 | `fraude` se cuela en la tabla de lo reconstruible | los mismos 5 casos: el fraude sale de la cola |
| 3 | Nada sale nunca por beacon, tampoco las `ux` | 5 casos: *…despacha TODAS las filas reconstruibles* y *…la fila reconstruible despachada se retira* |
| 4 | `err` vuelve a contar como entrega en `repPost` | *v17.49.0: la respuesta 'err' del panel NO cuenta como entrega…* y *…si el panel no confirma, el arranque NO pierde la evidencia* |
| 5 | `_repVaciadoDeArranque` con el cuerpo vacío | *v17.49.0: al arrancar se vacía la cola por el camino que confirma acuse* |
| 6 | El vaciado de arranque se programa a los 10 min en vez de a los 8 s | *boot: TODOS los timers quedan registrados en state.timers…* |
| 7 | (receptor) `cache.put` vuelve a ejecutarse ANTES de escribir la fila | `TABLERO/simulacion_local.js`: *«reintento del mismo lote: dup (debe ser ok)»* + *«filas L7 en la hoja: 0»* |

**Nota sobre tres pruebas reescritas.** `_vaciarTelemetriaAlSalir: despacha TODAS las filas
pendientes`, `…la fila despachada se retira de la cola` y `v17.6.14: …CON acuse fresco sí
despacha` exigían que la evidencia saliera por beacon y desapareciera de la cola. Las tres
nacieron de dos fallos reales del transporte (despachaba solo `repQ[0]`; no retiraba la fila
despachada), y **esas dos propiedades siguen fijadas** — ahora sobre las filas que de verdad
viajan por ese camino. Exigirle a la evidencia «sale por beacon» era fijar como contrato el
defecto que esta entrega cierra. Van con su porqué escrito en el sitio.

**Y un hueco del banco, cerrado de paso:** `_colaDemo` sembraba una cola mixta pero las tres
pruebas solo se afirmaban sobre la **longitud**, así que el banco no distinguía «se
retiraron las 4» de «se retiraron 4 cualesquiera». El helper nuevo `_lotesEnCola(c, evento)`
comprueba **qué** queda y con **qué lote**, que es de lo que depende que el panel no cuente
dos veces la misma jornada.

---

## v17.50.0 — exhaustividad, juicios de valor y mini-ejemplos en el prompt (D5, D6)

**Medición previa.** Se construyeron los CINCO prompts reales (`mtrRedaccionPrompt` con cada
modo, incluido uno inexistente para caer en el respaldo) y se buscó cada regla dentro del
`system` resultante. Resultado antes de tocar nada:

| Regla | enfermedad_actual | motivo | recomendaciones | analisis_plan | respaldo |
|---|---|---|---|---|---|
| «documentado como NO» ≠ «no se preguntó» | sí | sí | sí | sí | sí |
| juicios de valor prohibidos | sí | **no** | **no** | **no** | **no** |
| exhaustividad («no omitas») | **no** | **no** | **no** | **no** | **no** |
| mini-ejemplo | sí | **no** | **no** | sí (de forma) | no (correcto) |

Esa primera fila **corrige la entrevista**: la D6 daba por hecho que la distinción faltaba en
el prompt de casillas cortas, y ya estaba en los cinco desde la v17.13.0 (llega desde
`MTR_PRECEDENCIA_SYS`). Se documenta en vez de «arreglar» algo que no estaba roto — y queda
una prueba que lo mantiene así.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Se retira otra vez la regla de exhaustividad de `MTR_PRECEDENCIA_SYS` | *v17.50.0 (D5): los CINCO modos exigen no omitir…* y *…MTR_REDACCION_SYS ya no existe, y su regla no se fue con él* |
| 2 | Se retira la prohibición de juicios de valor | *v17.50.0 (D6): los CINCO modos prohíben los juicios de valor…* |
| 3 | El ejemplo del motivo se llena de cifras (presión y HbA1c) | *v17.50.0 (D6): NINGÚN ejemplo del prompt lleva cifras…* |
| 4 | El ejemplo de recomendaciones mete una dosis | la misma |
| 5 | El ejemplo de recomendaciones pierde su lado de salida | *v17.50.0 (D6): …ya traen su mini-ejemplo, con su par entrada → salida* |
| 6 | El ejemplo del motivo pierde su lado de entrada | la misma |
| 7 | `MTR_REDACCION_SYS` resucita | *…MTR_REDACCION_SYS ya no existe…* |

**Dos mutaciones no cayeron al primer intento, y las dos eran culpa mía, no del código.**

- La mutación 5 sobrevivió porque la prueba buscaba `SALIDA:` en TODO el prompt, y esa
  palabra ya aparece en el prompt base (`«SALIDA: prosa continua EN MAYÚSCULAS…»`): la
  aserción era vacua. Se reescribió para mirar **solo el bloque del ejemplo** y exigir el par
  `DATOS:` → `SALIDA:` en ese orden. Con eso caen la 5 y la 6.
- La mutación 7 pareció no caer, pero el mutante tenía un **error de sintaxis** (una cadena
  sin cerrar): el fichero no se podía cargar, así que la suite no llegó a correr. Un mutante
  que no compila **no es una mutación**: no prueba nada. Rehecha con sintaxis válida, cae.

**Y una alarma mía que resultó falsa, dicha para que no se repita:** al ver la suite «sin
fallos» con el fichero roto, di por hecho que el runner salía con código 0 y estuve a punto
de anotarlo como defecto grave del banco. Medido bien —sin una tubería `| tail` de por medio,
que era lo que me estaba devolviendo su propio código de salida— el runner sale con **2**.
El banco hacía lo correcto; el instrumento de medida era el que mentía.

---

## v17.51.0 — qué contesta el panel, dicho tal cual

**Origen: una verificación adversarial de la propia v17.49.0.** El enjambre que auditó el
embudo de telemetría (68 agentes) confirmó el arreglo pero señaló un residuo real: la prueba
de acuse quedó como **lista negra**, así que un cuerpo vacío o un texto arbitrario que no sea
HTML siguen contando como entrega.

**Se intentó la lista blanca y se revirtió, con la medición delante.** Al aceptar solo
«ok»/«dup», **7 pruebas existentes de suite_11 se pusieron rojas**, porque su red simulada
responde `{"ok":true}` — no el texto plano que devuelve el receptor real. Eso destapó lo
importante: **no se puede verificar qué contesta el receptor DESPLEGADO** (la cabecera de
`TABLERO/Codigo.gs` dice que es anterior a todo el historial del repositorio), y el fallo de
equivocarse —telemetría que no vuelve a confirmarse nunca, cola llena, evidencia sacrificada
al llegar al tope— es peor que el hueco. Así que se entrega el **instrumento** en vez de la
conjetura: la respuesta literal se guarda y se enseña en el diagnóstico. Con una pulsación del
médico en «Probar conexión», la lista blanca pasa a ser una decisión con dato.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | No se guarda lo que contesta el panel | *v17.51.0: se guarda LITERALMENTE lo que contesta el panel…* (+2 más) |
| 2 | Se guarda sin pasar por `sanitizePII` | *v17.51.0: la respuesta guardada pasa por el saneador de PHI* |
| 3 | El diagnóstico da por conocida cualquier respuesta | *v17.51.0: el diagnóstico enseña esa respuesta y avisa si NO es del panel* |
| 4 | Desaparece el renglón del diagnóstico | la misma |

---

## v17.52.0 — la albuminuria moderada (A2) como eje propio (D7)

**Medición previa, reproducida a mano antes de escribir una línea** (script propio que carga
el corpus dorado, reutiliza el `MAPA_ENTRADA` de la suite 45 leyéndolo de su fuente en vez de
copiarlo, y corre el motor real):

- línea base: el motor coincide con el Copiloto en **965 de 991**; las 26 desviaciones van
  todas hacia «alto» (`null→alto` 14, `moderado→alto` 10, `bajo→alto` 2), que es exactamente
  lo que hacen los dos pisos ya documentados.
- **A2 (RAC 30–299): 36 vectores**, todos con el valor `45` (es el único A2 del corpus). De
  ellos, 23 ya eran «muy alto» y 11 «alto»: **solo 2 cambian**, de moderado a alto.
- **A3 (RAC ≥300): 56 vectores, los 56 ya «muy alto»** — la albuminuria severa ya estaba
  cubierta por el paso 1.
- **852 de 991 vectores no traen RAC**, así que el corpus mide muy poco de esta regla. Dicho
  en el CHANGELOG en vez de presentar el «2 de 991» como si fuera el impacto real.

Tras el cambio: 963/991, con las 2 desviaciones nuevas siendo exactamente los 2 medidos.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | La regla A2 desaparece del paso 2 | 4 casos, entre ellos *v17.52.0 (D7): un RAC de 45 sube a ALTO a quien no es diabético* |
| 2 | La regla se come también A3 (≥300) en el paso 2 | *v17.52.0 (D7): el paso 2 NO se cuelga la macroalbuminuria* |
| 3 | El borde inferior se pierde (`> 30` en vez de `>= 30`) | *…los bordes exactos — 29 no, 30 sí, 299 sí…* |
| 6 | El borde inferior se corre a 29 | 3 casos, entre ellos el de los bordes |

**Dos mutaciones NO cayeron, y las dos son no-op reales — se documentan en vez de
disimularse, y en vez de contrarrestarlas con una prueba de una entrada imposible:**

- **Quitar la guarda `racA2 !== null`.** En JavaScript `null >= 30` es `false`, así que la
  guarda es redundante para el comportamiento. Se conserva porque es la convención del
  fichero (todas las lecturas numéricas del motor la llevan) y porque protege de un refactor
  futuro de `mtrFloat`, no porque hoy cambie nada.
- **Quitar `mtrFloat` y comparar el valor crudo.** El operador `>=` ya convierte las cadenas
  numéricas (`"45" >= 30` es `true`) y `mtrFloat` devuelve `null` para todo lo demás, que
  también compara `false`. Solo diferirían con entradas absurdas (un array `[45]`). Forzar la
  caída con una entrada que no puede ocurrir sería fabricar una prueba, no escribirla.

**Y una alarma que se comprobó antes de reportarla.** Al medir se vio que
`mtrFloat("45,3")` devuelve `null`: una RAC con coma decimal —el formato colombiano— no se
leería. Se siguió el dato hasta su origen antes de decir nada: **`_labNumerico` ya convierte
la coma en punto** (`.replace(",", ".")`) antes de que el valor entre al motor, por las dos
vías que lo alimentan (los últimos laboratorios y los factores del resumen previo). No es un
riesgo vivo. Comprobarlo costó tres minutos; reportarlo sin comprobarlo habría costado una
investigación entera al médico.

---

## v17.53.0 — los tres almacenes por cédula que la v17.48.0 se dejó

**Origen: una medición del enjambre, verificada a mano antes de creérsela.** El informe de la
entrega D3 (respaldo exportable) enumeró las 67 claves de almacenamiento del script y señaló
que `vgl_nosh_hist`, `vgl_prod` y `vgl_precon` se indexan por cédula y **no** tienen lectura
tolerante. Se comprobó con un script propio contra el userscript real, uno por uno:

| almacén | archivado como `0099900042`, consultado como `99900042` | ¿caduca? |
|---|---|---|
| `vgl_cosecha` | ✅ lo encuentra (v17.48.0) | no |
| `vgl_proc_today` | ✅ lo encuentra (v17.48.0) | por día |
| **`vgl_nosh_hist`** | ❌ devolvía **0** con 3 inasistencias archivadas | **no** |
| **`vgl_prod`** | ❌ `0099900042\|08:00` ≠ `99900042\|08:00` | por día |
| **`vgl_precon`** | ❌ fallo de caché | 6 h |

El primero es el que importa: no caduca, y su contador es un aviso clínico al médico. Y tenía
un segundo filo que solo se ve al escribir: `_noShowRegistrar` leía `h[docId]` directo, así que
registrar una falta nueva bajo la forma canónica **abría una segunda ficha con el contador en
cero**. Por eso el arreglo no escribe en la clave canónica sino en **la que ya existe**
(`_vglClaveDeDoc`): normalizar hacia adelante sin dejar huérfano lo de atrás.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | La lectura de inasistencias vuelve a ser exacta | *v17.53.0: el historial de inasistencias reconoce al paciente con o sin ceros delante* |
| 2 | Registrar escribe siempre en la clave canónica | *v17.53.0: registrar una inasistencia NO reinicia el contador ya archivado* |
| 3 | La clave de productividad vuelve a conservar los ceros | *v17.53.0: la clave de productividad no se parte por los ceros de relleno* |
| 4 | `_vglClaveDeDoc` deja de buscar la escritura antigua | *…NO reinicia el contador ya archivado* |

**Lección de proceso:** la v17.48.0 arregló los dos almacenes que la investigación de aquel
momento tenía a la vista y se dio por completa. El inventario exhaustivo —las 67 claves, no
las que uno recuerda— es lo que destapó los otros tres. *Arreglar los casos que uno conoce no
es lo mismo que arreglar el defecto.*

---

## v17.54.0 — umbrales estrictos: se retira el margen del +15 % (D9)

**Medición previa.** Las franjas se calcularon con las metas reales del motor, no de memoria:
LDL 55,1–63,25 / 70,1–80,50 / 100,1–115,00 / 116,1–133,40; HbA1c 7,1–8,05 %; glicemia
131–149,5. Coinciden al decimal con las que la entrevista anotó.

**Inventario del margen: CUATRO puertas, no dos.** El informe del enjambre decía dos; la
revisión adversarial señaló una tercera; leyendo el fichero apareció una cuarta que nadie
había visto:

1. `mtrFueraDeMeta` → `mtrAcortarPorFueraDeMeta` — parte la vigencia en el plan de exámenes.
2. `mtrFueraDeMeta` con `opts.aplicar50` (`:4078`) — la misma vara en la precarga, que es la
   del aviso de entrada y la del antiduplicado de Ordenar.
3. `MTR_FALLA_UMBRAL` en `mtrGravedadFalla` — declara la falla terapéutica.
4. **`mtrEvaluarMetaLdl` con `1.15` y `1.30` escritos a mano**, sin pasar por las constantes.
   Alimenta `mtrEducationFlags`, o sea **la hoja educativa que el paciente se lleva impresa**.
   Cambiar la constante sin tocar esto habría dejado el papel del paciente y el plan diciendo
   cosas distintas.

**Un defecto real, destapado al medir.** El barrido MTT de la v17.7.5 (1.440 planes, cero
fusiones fuera de la orden) concluyó que la unión explícita `order_list ∪ MTT fusionados`
sería una línea inerte y decidió no escribirla — correcto con la regla de entonces. La D9 la
vuelve alcanzable: un diabético con glicemia 140 **tomada ayer** entra en falla sin estar
cerca de vencer, se le fusiona el recontrol y su glicemia **no entraba en la orden**. Se
agenda la toma y nadie pide el examen. La línea se escribe ahora, con su caso concreto fijado
en una prueba.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Vuelve el margen del 15 % | 5 casos entre suite_45 y suite_49 |
| 2 | La cuarta puerta vuelve a su literal `1.15` | *v17.54.0 (D9): la meta de LDL declara falla por encima de la meta…* |
| 3 | El umbral grave de la cuarta puerta se desvía a 1.50 | la misma |
| 4 | La fusión MTT deja de entrar en la orden | *v17.54.0: una glicemia en falla TOMADA AYER entra en la orden…* y el barrido de suite_46 |

**Cinco pruebas reescritas, y la distinción importa.** Cuatro fijaban el margen del +15 %:
**no eran pruebas equivocadas, eran las pruebas correctas de una decisión anterior** (la del
médico del 20-ago), que él mismo revocó el 29-ago. Se reescriben fijando el contrato nuevo y
dejando escrita esa sucesión.

La quinta es distinta y merece nombrarse: *«CERO VENCIDOS — la toma va al vencimiento más
próximo, nunca después»* filtraba **todos** los drivers, mientras su propio comentario decía
«ningún driver **vigente**». No era lo mismo, y hasta hoy no se notaba porque con el margen
ese paciente no tenía ninguno vencido. Se comprobó midiendo el caso con y sin margen antes de
tocarla: lo que cambia es que su HbA1c queda vencida y **la fecha de toma se adelanta un mes**
—que es justo lo que debe pasar—, y el examen sale en la orden. Se afinó el predicado para que
diga lo que el comentario ya decía, y se le añadió la comprobación que faltaba: que todo lo
vencido vaya en la orden.

---

## v17.55.0 — menos viajes al laboratorio (D10, replanteada dos veces por el médico)

**El plan se rechazó dos veces, y las dos correcciones cambiaron la entrega entera.** La
primera versión graduaba el recontrol como *cuanto más descontrolado, más pronto vuelve*.
Respuesta del médico: *«la idea es que el paciente tenga la menos cantidad de veces que ir a
sangrarse e ir a la IPS. ¿Repetir la glucosa en menos de 1 mes? ¿LDL en máximo 8 semanas?»*

**El error no fue el diseño: fue la métrica.** Se estaba midiendo «cuántos casos pasan de grave
a leve» en vez de lo único que le pasa al paciente: cuántas veces va a sangrarse.

**Medición previa (3.072 planes con el motor real) y resultado:**

| | antes | después |
|---|---|---|
| Viajes por paciente | 2,329 | **1,613** (−31 %) |
| Con segunda cita dedicada | 78,1 % | **42,6 %** |
| Citas dedicadas totales | 4.082 | 1.884 (−54 %) |
| Con falla y sin ninguna fecha | 0 | **0** |

Y quedó fijada en el banco: el caso *«el barrido completo hace menos viajes que antes, y nadie
se queda sin fecha»* corre su propio barrido y exige las dos cosas a la vez — menos viajes **y**
cero pacientes sin vigilancia. Una sin la otra no vale.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | La fecha de recontrol vuelve al extremo corto siempre | *v17.55.0: la ventana de recontrol se usa ENTERA* + el barrido |
| 2 | La fusión hacia atrás cruza el piso clínico | *…FUSIÓN HACIA ATRÁS, HASTA EL PISO* (suite_46) |
| 3 | Se quita la fusión hacia atrás | la misma |
| 4 | Una leve vuelve a poder crear cita dedicada | *…una falla leve no manda al paciente a sangrarse aparte* + suite_46 |
| 5 | Solo las graves vuelven a tener fecha | *v17.55.0: TODA falla lleva fecha, no solo las graves* |
| 6 | Se retira también la regla renal de `mtrGravedadFalla` | 6 casos de suite_49 |
| 7 | El rojo de tendencias vuelve a meta+30 % | 3 casos de suite_67 |
| 8 | Lo que tiene cita dedicada deja de entrar en la orden | *v17.54.0: una glicemia en falla TOMADA AYER entra en la orden* |

**La mutación 8 documenta un defecto que introduje yo en esta misma entrega**, y lo cazó una
prueba de la versión anterior. Al repartir los recontroles entre tres destinos (fusionados, con
cita dedicada, sin viaje), la unión a la lista de órdenes de la v17.54.0 seguía mirando **solo
las fusiones** — así que un analito con cita propia se agendaba y nadie lo pedía. Es exactamente
el invariante que esa unión existe para proteger, y por eso la prueba lo vio.

**Trece pruebas reescritas, en tres categorías distintas, y la distinción importa:**

- **Seis fijaban el escalón del +30 %** (gravedad y rojo de tendencias). No eran pruebas
  equivocadas: eran las pruebas correctas de la regla anterior, que el médico revocó. Se
  reescriben fijando el contrato nuevo, con la sucesión escrita en el sitio.
- **Cuatro se apoyaban en `meta.fallaGrave`**, un campo que esta versión **retira**: con la D10
  «grave» deja de ser un porcentaje y pasa a ser la regla renal, que `mtrEvaluarMetaLdl` no
  puede evaluar (no recibe filtrado ni edad). Seguir emitiéndolo habría dejado **dos
  definiciones de «grave» conviviendo sobre el mismo paciente** — el mismo defecto que la
  v17.6.83 ya documentó y corrigió con las banderas educativas. Sus dos consumidores lo leían
  en un `OR` con `falla`, y `fallaGrave` siempre implicaba `falla`: quitarlo no cambia ningún
  resultado.
- **Tres necesitaban cifras nuevas** para seguir demostrando lo mismo. La más ilustrativa: *«la
  misma cifra no es grave en un paciente de riesgo bajo: la meta es del paciente, no del
  analito»*. Con el corte en meta+30 % lo demostraba un LDL de 131; con el corte en la meta hay
  que usar 100. **Lo que la prueba defiende no cambió; cambió el número que lo hace visible.**

**Retiradas por quedarse sin un solo consumidor**: `MTR_FALLA_GRAVE_UMBRAL` y `_mtrMargenGrave`.
Una constante clínica sin usuarios es una invitación a que alguien la vuelva a cablear pensando
que significa algo.

---

## v17.56.0 — la marca de llegada tarde ya no se borra sola

**Origen: reporte en vivo de una colega**, textual: *«cuando lo confirman tarde sale rojo y
después me salía verde»*.

**Reproducido con el arnés ANTES de tocar nada**, y esa reproducción es la prueba:

```
11:32  sin presentarse, 12 min tarde  ->  AMBAR   clave: PACIENTE DE PRUEBA|3@m680
11:33  en sala, misma posición        ->  ROJO
11:40  entra un cupo adicional        ->  VERDE   clave: PACIENTE DE PRUEBA|4@m680  <-- otra clave
11:41  ahora sí se lee el documento   ->  VERDE   clave: 5150076@m680               <-- y otra más
```

La marca seguía en `state.fraudWatch`, intacta, bajo una clave que ya no coincidía. **El almacén
compartido entre pestañas se descartó como causa**: `_fraudeCompartidoFusionar` **fusiona**,
nunca reemplaza, así que por ahí no se pierde nada.

**Es el mismo defecto que `mtrProdClaveCita` corrigió en la v17.6.2**, tras el reporte del
médico «atendí a 10 y el Resumen dice 20». La razón que se escribió entonces vale literalmente
aquí — *«el orden de la lista no identifica nada»* — y `apptKey` nunca recibió la corrección.

| # | Qué se rompió a propósito | Prueba que cayó |
|---|---|---|
| 1 | Vuelve `a.index` (la posición) a la clave | *apptKey: arma la clave de la cita* (suite_02) |
| 2 | La cédula deja de canonicalizarse | *apptKey…* + *v17.56.0: …el documento aparezca o desaparezca* |
| 3 | La lectura tolerante pierde la forma del nombre | 2 casos de suite_66 |
| 4 | La marca deja de anotarse bajo las dos identidades | *…marcada con documento, releída sin él* |
| 5 | Se quita la lectura tolerante entera | *v17.56.0: la marca sobrevive a que la agenda se reordene* |

**Nota sobre la mutación 1, dicha porque es información y no un adorno:** cae en `suite_02`
(que fija la forma de la clave) pero **no** en `suite_66` (que prueba el comportamiento). El
motivo es real y conviene tenerlo escrito: la marca se anota además bajo el nombre, así que la
lectura tolerante **enmascara** el defecto en la prueba de comportamiento. Los dos mecanismos
se solapan a propósito —clave estable *y* lectura tolerante—, y por eso hace falta la prueba de
forma: sin ella, devolver la posición a la clave pasaría desapercibido hasta que alguien tocara
también el otro mecanismo.

**Lo que NO se perdía:** la línea `FRAUDE_EXTEMPORANEO` de la auditoría se escribe cuando suena
el aviso y no depende de la clave. La evidencia para reclamaciones de los casos ya afectados
sigue en el CSV; lo que se perdía era el color de la tarjeta.


## v18.0.6 — 31-ago-2026 · FUSIÓN DE LAS DOS LÍNEAS DE TRABAJO (rama ↔ main)

Las dos ramas se habían separado en `87849d3` (v17.6.82) y siguieron por caminos distintos:
la rama llegó a v17.56.0 (51 commits) y `main` a v18.0.4 (136 commits). **Ninguna de las dos
era superset de la otra, y en direcciones opuestas:**

| | rama | main | se toma de |
|---|---|---|---|
| `vigilante_agenda.user.js` | v17.56.0 | **v18.0.4** (0 marcadores exclusivos de la rama) | **main**, y encima la build v18.0.5 instalada |
| banco de pruebas | **2.213 casos** | 1.926 casos | **la rama** (main había perdido 349 casos) |
| `INFORME_MUTACIONES.md` | **872 filas** | 319 filas | **la rama**, injertando las 23 de main |

Se comprobó midiendo, no opinando: cero marcadores `v1x.y.z` exclusivos de la rama en el
userscript (main los tiene todos, más v17.57.0→v18.0.4), y 349 títulos `t.caso` presentes solo
en la rama. Donde la versión de main de una suite pasaba y la de la rama no, se tomó la de main
**injertándole** los casos que solo existían en la rama, en vez de reemplazar y perderlos.

Renombrada `suite_70_lint_pantalla.js` → `suite_72_lint_pantalla.js`: main traía su propia
`suite_70_enjambre_pre_despliegue.js` y dos suites no pueden llevar el mismo número.

### Mutaciones verificadas de esta entrega

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | **comentario `//` dentro de la plantilla** — se devuelve una línea `// …` entre el `` ` `` de apertura de `el.sheet.innerHTML` y el `<div>` del botón Diag (el defecto original de la v18.0.5, visto en pantalla por el médico) | "REGLA H — ninguna línea `//` vive DENTRO de una plantilla de texto" (`suite_72`) | Sí — 17/17 |
| 2 | **adorno dentro del dato** — se devuelve el `"🔴 "` al principio de `motivoTexto` | "REGLA I — motivoTexto es TEXTO: sin emoji, sin marcado, sin adorno" (`suite_72`) | Sí — 17/17 |

**Regla H no es una prueba de conducta, es un analizador del código fuente**, y por eso caza
esta familia entera: recorre el archivo distinguiendo comillas, comentarios y plantillas (con
su anidamiento `${…}`), y marca cualquier línea que empiece por `//` dentro del texto de una
plantilla. Una expresión regular no puede hacerlo: no sabe si un `//` está dentro de una
plantilla o dentro de una URL. El bug original no daba error en consola, no rompía ninguna
prueba de comportamiento y el archivo seguía siendo JavaScript válido — se veía solo en la
pantalla del médico, en consulta.

### Conducta de la v18.0.5 que se entregó sin prueba, y que ahora la tiene

- **Tercera ruta de descarga por `shareId`** (`spFallbackUrls`): `suite_12` exigía exactamente
  dos rutas y se puso roja al fusionar. Ahora se fijan las dos mitades del `if` (con `shareId`
  → tres rutas; sin él → dos) y que un `shareId` igual al `id` no se repite. Y la prueba de
  `loadPymBaseDescarga` deja de contar «2» a mano: cuenta contra `spFallbackUrls().length`, para
  que lo que protege sea lo que importa —una ruta cada vez, en orden, nunca en paralelo— y no
  un número que caduca.

### Cambio CLÍNICO de la v18.0.5 que se conserva pero queda señalado

- **Piso por diabetes plano** (`vigilante_agenda.user.js:33660`): la v18.0.5 revirtió el
  refinamiento de la v17.6.94. Antes, sabiendo el tiempo de evolución mandaba el consenso y un
  diabético de 5–12 años sin otros factores podía quedar MODERADO; ahora **todo** diabético
  entra en ALTO. **No se revierte desde el banco de pruebas** —es la conducta que el médico
  tiene instalada y corriendo—, pero se deja escrito su coste, que no es pequeño: ALTO baja la
  meta de LDL de 100 a 70; con `MTR_FALLA_UMBRAL = 0` (estricto, D9) un LDL de 110 pasa de estar
  en meta a estar fuera; su vigencia se parte a la mitad (regla del 50 %); y el arrastre del
  grupo lipídico (`mtrPlanParaclinicos`, regla 1.15) se lleva colesterol total, HDL y
  triglicéridos al mismo viaje. Pendiente de que el médico confirme o revierta.

### Filas de mutación que solo existían en `main` y se recuperan aquí

| **rojo de tendencias (v17.55.0)** | `_mtrTendUmbralGrave` vuelto a `const factor = 1.3` (revive el +30 %) | `suite_67` | *#123 rojo por VALOR* → *131 con meta 116 ya está sobre la meta: rojo en riesgo bajo también* (esperaba "grave", obtuvo null) y *#123: HbA1c usa la meta del paciente...* → *9,2 con meta individual de 8,0 está sobre ella* (esperaba "grave", obtuvo null) |
| **chips PyM en la tarjeta (v17.22.0)** | `pymsVisibles = pymsPanel.slice(0, 0)` (amputa los chips otra vez) | `suite_15` | *render: ... los chips PyM volvieron en v17.22.0* → *el chip de PyM pendiente vuelve a la tarjeta*; *T4/v14.0.2 + v17.22.0...* → *la fila de chips PyM volvió*; *v14.0.2 + v17.22.0...* → *y muestra el chip PyM del paciente* (las tres obtuvieron false) |
| **mensaje de labs sin lectura (v17.8.1)** | la rama `_noSePudoLeer` vuelta al texto viejo «No se encontraron paraclínicos recientes» | `suite_15` | *openLaboratoriosModal (v17.8.1): sin poder leer el portal...* → *el fallo fue del sistema: se dice como tal (obtuvo false)* |
| **botón del modal de órdenes sin lista (v17.16.0)** | el confirm vuelto a «Sin actividades para ordenar» siempre (sin distinguir «No hay lista que consultar») | `suite_15` | *openOrdenamientoModal: sin coincidencia PyM...* → *y el botón no invita a ordenar nada (antes decía 'Sin actividades'...) (obtuvo false)* |
| **claves muertas del banner (v17.19.0)** | `bannerPym: false` revivido en DEFAULTS | `suite_15` | *v15 (v17.19.0): el bloque T7 se retiró entero...* → *la clave del banner ya no existe en los ajustes (esperaba undefined y obtuvo false)* |
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
| **reaprovechamiento del salto** | en el llamador se vuelve a `cargarHoras()` sin pasarle `otroDia.res` (re-consulta el día encontrado) | `suite_15` | *openAgendamientoModal v17.58.1: el salto al día con agenda propia NO re-consulta BuscarCitasDisponibles — el día elegido se trae 2 veces (búsqueda + sondeo), nunca 3* → máximo por día 3 y el sábado elegido con 3 (esperaba 2) |
| **forzado de la política** | se retiran `S.reporte = true; S.uxTelemetria = true;` (una config guardada con `false` vuelve a ganar) | `suite_31` | *Telemetría: nace ENCENDIDA por política del dueño (v17.58.2); el forzado gana a una config guardada con false* → `el forzado gana a una config guardada con reporte=false (obtuvo false)` |
| **atribución del INP** | se retira el `uxTrack("rum.self.inp.detalle…")` dentro del observer de eventos | `suite_23` | *_iniciarRumObserver: la interacción lenta se atribuye por el ELEMENTO que el médico tocó* → `el INP malo nuestro dice qué botón: agm-btn: esperaba 1 y obtuvo undefined` |
| **render en lote** | en el render de turnos se vuelve a `slotsEl.appendChild(btn)` por turno (además del lote) | `suite_23` | *v17.58.2: los handlers … se montan en lote (INP)* → `y no queda un appendChild por turno (obtuvo true)` |
| **fase del Diario de Lentitud** | en el handler del chip de día se vuelve a `cargarHoras()` a secas (sin `_rumTramo`) | `suite_23` | *v17.58.2: los handlers … anotan su fase con _rumTramo (INP)* → `el clic en un chip de día anota su fase (agm.clickDia) (obtuvo false)` |
| **cálculo del deadline** | en `_proximoDeadlineTiempo` (línea 27044), el tramo "antes de la prealerta" devuelve `graMs` en vez de `preMs` (`if (ahora < preMs) best = graMs`) | `suite_04` | *_proximoDeadlineTiempo: 'Sin presentarse' antes de la prealerta…* → `siguiente cruce = 5 min (prealerta)`; y *_proximoDeadlineTiempo: ignora llegadas/atendidos…* → `el más próximo es 08:05` |
| **ventana crítica del sondeo** | en `_hayCitaCritica` (línea 27068), `VENTANA_CRITICA_MS` pasa de `90000` a `90000000` (toda cita "Sin presentarse" se vuelve crítica) | `suite_04` | *_hayCitaCritica: 'Sin presentarse' a 30 s de la gracia…* → `2 min antes de la gracia -> no crítica (obtuvo true)` |
| **marca de onboarding** | en `_onboardingColores` (línea 27027), `setItem("vgl_onb_colores", "1")` pasa a `"2"` (la marca nunca queda válida) | `suite_17` | *_onboardingColores: la leyenda de colores se muestra UNA sola vez…* → `la marca queda guardada en localStorage: esperaba "1" y obtuvo "2"` |

## v18.0.7 — 31-ago-2026 · CUATRO REPORTES EN VIVO DE CONSULTORIO

Todo lo de esta entrega sale de reportes del médico con el script corriendo en consulta, y
del diagnóstico sanitizado de su propio equipo. Ninguna es una mejora especulativa.

### 1. El aviso de PyM y el de abandono de RCV dejaron de salir (a él y a sus compañeros)

El diagnóstico de su equipo lo dijo sin ambigüedad:

```
Archivo: ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx (PyM de hoy) (auto)
Pacientes con pendientes: 0
Documentos totales en la hoja: 1396
COINCIDEN: 0/20
```

El libro se descargó y se leyó bien —1.396 documentos, la columna del documento SÍ se
encontró— pero ninguna fila traía actividad pendiente. **Era otro libro.** El listado no es
de una carpeta: `fetchSpFilesMultiFolder` junta las TRES de `CONFIG.SP.folders`, y una es
`…/ACTIVIDADES DE PYM/ESTRATEGIAS POR SEDE 2026/SEDE BELLO`, donde vive ese archivo de
productividad. La 2ª regla de `pickTodaysFile` acepta cualquier `.xlsx` sin fecha en el
nombre modificado hoy: lo cumplía, y se eligió como «el PyM de hoy».

**El daño era doble**, y esa segunda mitad es la que dejó al médico sin aviso toda la
jornada: al dar por encontrado el de hoy, `state.pymFP` quedaba puesto, el siguiente chequeo
cortaba por huella, y **nunca se caía al respaldo de la base piloto ni se seguía buscando el
CMB real** — desactivando la regla que el médico tenía escrita: *«mientras no esté subido el
CMB del día se usa la base piloto, y cada X minutos se rectifica si ya subieron el oficial»*.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | la 2ª regla vuelve a aceptar archivos de subcarpetas (se quita `sueltoEnLaRaiz`) | *un libro de una SUBCARPETA no puede pasar por «el PyM de hoy»* y *entre el libro de la subcarpeta y el suelto en la raíz, gana el de la raíz* (`suite_03`) | Sí — 23/23 |
| 2 | `MTR_PYM_DOCS_SOSPECHA` a 999999 (la guarda de contenido nunca dispara) | *mtrLibroNoParecePym — muchos documentos y CERO pendientes es OTRO libro* (`suite_03`) | Sí — 23/23 |

Tres capas, no una: (a) la 2ª regla solo mira archivos **sueltos en la carpeta principal**,
que es donde el propio `CONFIG` dice que aparece el PyM del día; (b) `mtrLibroNoParecePym`
rechaza cualquier libro con ≥50 documentos y CERO pendientes, **lo dice** y recuerda la
huella para no reintentarlo cada diez minutos; (c) la caché del día (`vgl_pym`) se purga
sola si trae un índice con esa firma — sin esto, toda pestaña que arrancara volvería a
cargar el índice malo y el aviso seguiría mudo aunque la descarga ya estuviera arreglada.

### 2. Avisos ÁMBAR de pacientes YA ATENDIDOS

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 3 | se quita `if (_consultorioTiene(a.doc_id)) callar = true` | *si el médico abrió HOY su historia, el mismo ÁMBAR se marca para callar* (`suite_04`) | Sí — 68/68 |
| 4 | se calla PERDIENDO la evidencia (`if (a.callar) return` antes de contar) | *LA EVIDENCIA NO SE PIERDE — se sigue contando y se sigue escribiendo la fila de auditoría* (`suite_04`) | Sí — 68/68 |
| 5 | `_consultorioTiene` deja de canonizar la cédula | *la cédula se compara canonizada — los ceros de relleno no abren un boquete* (`suite_04`) | Sí — 68/68 |

La mutación 4 es la importante: prueba que la supresión apaga **solo la interrupción**. El
ÁMBAR se conserva, `bumpStatCita` cuenta y la fila `INASISTENCIA` se escribe — la evidencia
de las reclamaciones queda intacta. Misma contención que la decisión v16.2.8 del médico.

### 3. El botón «Ordenar pendientes» flotando sobre «Citas del día»

Se pinta en `document.body` con `position:absolute` y coordenadas de PÁGINA, y el único que
lo escondía era su propio tick, que solo corre en la pestaña Conducta. Al navegar la SPA
fuera de la historia nadie lo retiraba. Ahora: oculto al usuario final (encargo del médico,
queda tras el modo programador), candado de ruta, y `mtrOcultarBotonOrdenarPendientes()` que
el tick general llama en cada vuelta esté donde esté el médico.

### 4. D11 (KDIGO) — punto 9 de la orden de ejecución del 29-ago

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 6 | `kdigoFrena = false` (la guarda del motor del panel) | *la falla terapéutica NO se apaga…* y *D11 PUNTA A PUNTA…* (`suite_49`) | Sí — 39/39 |
| 7 | se quita la guarda del camino del aviso de entrada | *la guarda vive TAMBIÉN en la vara del aviso de entrada y del antiduplicado de PyM* (`suite_49`) | Sí — 39/39 |
| 8 | el corte pasa de `< 60` a `<= 60` | *la guarda solo mira los cuatro lípidos, y solo por debajo de 60* (`suite_49`) | Sí — 39/39 |

Vive en los DOS caminos que parten la vigencia a propósito: con la guarda en uno solo, el
panel diría «vence en 180» y el aviso de entrada seguiría reclamando el mismo LDL a los 90
sobre el MISMO paciente. Dos varas para una regla es peor que una vara equivocada.

Y no choca con CERO VENCIDOS: la guarda solo puede ALARGAR una vigencia, así que la fecha de
toma no se adelanta y, por construcción, nada puede vencer antes de ella. Hay una prueba que
lo comprueba recorriendo todo el plan.

Banco completo al cerrar: **2.716 comprobaciones pasan, 0 fallan.**

## v18.0.8 — 31-ago-2026 · LA CAUSA REAL DEL AVISO FALSO, Y LA CORRECCIÓN DEL MÉDICO

La v18.0.7 había tratado el síntoma: callaba el aviso ÁMBAR de un paciente ya atendido pero
**seguía contando la inasistencia**, «para no perder evidencia». El médico lo desmontó en una
frase: *«no puede ser inasistencia porque el paciente sí llegó a tiempo y se atendió
normalmente»*, y añadió lo que resultó ser la clave del diagnóstico: *«no es posible que un
paciente aparezca sin presentarse y que ya haya confirmado su cita; o vino o no vino»* y *«por
lo general el script es el del problema, no Everest»*.

Tenía razón en las dos cosas. Una fila `INASISTENCIA` sobre un paciente que vino no es
evidencia: es evidencia FALSA, y ensucia justo el CSV con el que reclama.

### La causa, reproducida antes de tocar nada

```
1) 10:03  la agenda dice «Sin presentarse»  -> se confirma
   ...45 minutos sin un solo tick...
2) 10:20:44 la agenda dice «Atendido» -> colorAndAlert devuelve:
   estado "Sin presentarse" · color AMBAR · elapsed 20,7
```

**20,7 es la cifra literal de su captura.** El script no leyó mal Everest: **descartó la
lectura buena y evaluó con una memoria de 45 minutos antes.** El antirrebote de v17.6.21
existe para absorber un parpadeo entre dos fuentes (API y raspado del DOM) que discrepan en el
MISMO instante: exige ver la lectura nueva dos veces seguidas. Es correcto con dos lecturas
separadas por un tick (~5 s). Tras un apagón, la lectura «anterior» ya no es un competidor: es
un recuerdo — y se imponía igual, calculando encima el desfase contra la hora actual.

Y el apagón tenía su propia causa, encontrada en el mismo barrido: `heartbeat()` lo dispara el
canal «latido», que vive en el nivel superior del IIFE y corre en TODA pestaña de Everest;
pero el canal «tick», el que evalúa, solo se registra en `restartPolling()`, que empieza con
`if (!el || !el.root) return`. **Una pestaña sin panel construido latía, ganaba el mando y no
miraba nada**, mientras las demás se ponían `leader = false`. Es exactamente la regla que el
médico tenía escrita: *«siempre debe estar analizando citas del día con esa pestaña líder».*

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | el antirrebote vuelve a imponerse tras un hueco largo (se quita `!huecoLargo`) | *tras un apagón largo, la lectura FRESCA manda (el caso exacto del 31-ago)* + *una inasistencia ya contada se RECTIFICA…* (`suite_04`) | Sí — 71/71 |
| 2 | `huecoMax` a 999999999 (ningún hueco se considera largo) | las mismas dos (`suite_04`) | Sí — 71/71 |
| 3 | se quita la rectificación retroactiva | *una inasistencia ya contada se RECTIFICA al ver al paciente en sala o atendido* (`suite_04`) | Sí — 71/71 |
| 4 | el ÁMBAR callado vuelve a contarse | *si el paciente estuvo en consulta, NO se cuenta ni se registra inasistencia* (`suite_04`) | Sí — 71/71 |
| 5 | se quita la guarda de liderazgo (`_puedoEvaluarLaAgenda`) | *una pestaña SIN reloj de evaluación no puede ser líder*, *la pestaña ciega tampoco PUBLICA latido* y *la pestaña ciega SUELTA el mando…* (`suite_17`) | Sí — 48/48 |

La mutación 2 merece una nota: es la que prueba que la ventana está **atada a la cadencia
real de sondeo** (`max(30 s, 4 × POLL_MS)`) y no a un número suelto. Si el médico pone el
refresco en 2 s o en 120 s, la ventana lo acompaña sola.

### Lo que NO se rompió, y también se prueba

`el parpadeo REAL de un tick sigue absorbido`: una lectura discrepante a 5 s sigue esperando
confirmación, y se acepta a la segunda. El mecanismo de v17.6.21 queda intacto; lo único que
cambia es que deja de aplicarse donde nunca tuvo sentido.

### Rectificación retroactiva (decisión del médico)

Si de una cita ya se contó una `INASISTENCIA` y después la agenda dice EN SALA o ATENDIDO, se
descuenta del contador del día y se escribe una fila `RECTIFICACION_INASISTENCIA`. **La fila
original NO se borra**: se añade el porqué. Borrarla dejaría un hueco mudo en el CSV; quien lo
lea después tiene que poder seguir el razonamiento completo.

### El aviso de ceguera, que no podía salir donde el médico trabaja

`if (leader && _enModuloHCHealth() && !enVistaVigilada && …)` — y `enVistaVigilada` es
`secc !== "otra"`, o sea VERDADERO también dentro de una historia clínica. Pero el respaldo
que justifica el aviso (el raspado del DOM) solo funciona en «Citas del día». Dentro de una
historia, con el API caído, el Vigilante está igual de ciego… y ahí es donde el médico pasa la
jornada. La condición correcta no era «no estoy en una vista vigilada» sino «aquí no puedo
leer la agenda del DOM»: `secc !== "agenda"`. Con su prueba, y con la contraria (en «Citas del
día» NO se declara ciego, que sería un falso aviso).

Banco completo: **2.725 comprobaciones pasan, 0 fallan.**

### Anexo v18.0.8 — el piso por diabetes NO tapaba ningún MUY ALTO (medido, sin tocar código)

Precisión del médico (31-ago): *«todo diabético entra en alto riesgo pero se sigue
clasificando con el método de 4 pasos del consenso colombiano de dislipidemias, es decir que
los diabéticos aún pueden subir a muy alto»*.

Se midió sobre el corpus dorado ANTES de proponer nada, y **no hizo falta cambiar el código**:
de los **125 vectores diabéticos, 102 salen MUY ALTO y 23 ALTO — ninguno por debajo**. La razón
es estructural: «muy alto» lo produce ÚNICAMENTE el paso 1, que corre ANTES del piso; los
pasos 3 y 4 solo pueden dar alto/moderado/bajo, así que el `return` del piso no puede tapar
ninguno.

Se añaden dos pruebas para que ese razonamiento no se pierda con el tiempo.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 6 | el piso por diabetes se adelanta ANTES del paso 1 | *en TODO el corpus dorado, ningún diabético queda por debajo de ALTO — y la mayoría sube a MUY ALTO* (`suite_45`), además de otras tres ya existentes | Sí — 63/63 |

La segunda prueba nueva es de forma, no de conducta: recorre el clasificador y exige que
**toda** línea que produzca `categoria: "muy alto"` lleve `paso: 1`. Si alguien añadiera una
vía a «muy alto» en el paso 3 o el 4, el piso empezaría a tapar categorías en silencio y esta
prueba lo obliga a decidirlo a conciencia.

## v18.0.9 — 31-ago-2026 · BLINDAR EL ACCESO A LA AGENDA

Encargo del médico, textual: *«lo que hay que blindar es que el Centinela siempre tenga
acceso a la API de citas del día o algún otro método que sea infalible para este tipo de
cosas que me están poniendo muchos problemas últimamente»*.

### Lo que se midió antes de tocar

```
fallos seguidos -> espera hasta el siguiente intento
  1 -> 10 s   2 -> 15 s   3 -> 20 s   4 -> 25 s
  5 -> 300 s  6 -> 300 s  7 -> 300 s …
tiempo hasta agotar los 5 intentos: 370 s
y a partir de ahí, un intento cada 5 minutos
```

Cinco minutos de descanso entre intentos. Y dentro de una historia clínica **no hay respaldo
posible**: el raspado del DOM solo funciona en «Citas del día». Así que cada reintento costaba
hasta cinco minutos de ceguera total, sin ninguna señal. Baja a **1 minuto** (`API_DESCANSO_MS`):
una petición por minuto contra un servidor caído no es martilleo, y devuelve el camino directo
en cuanto la red vuelve.

**Corrección a una propuesta mía anterior, dicha porque estaba equivocada:** llegué a
proponerle al médico «compartir la URL aprendida entre pestañas» como si no se hiciera. **Sí se
hace** desde v17.6.14: se persiste ofuscada en `localStorage` (`vgl_api_url`) y se lee al
cargar. Ese hueco no existía.

### Relevo por ceguera

Hasta aquí el mando solo cambiaba por VISIBILIDAD (v14.1.5): un líder OCULTO, estrangulado por
el navegador, se lo cede a uno a la vista. Pero un líder **a la vista y sin ninguna fuente**
—API caído y fuera de «Citas del día», que es exactamente el médico trabajando dentro de una
historia— lo retenía indefinidamente mientras otra pestaña capaz de leer se quedaba callada.

Ahora el latido lleva `ve` (¿puedo leer la agenda?), y quien ve puede relevar a quien no ve.
Con el mismo enfriamiento que el relevo por visibilidad, y con dos guardas: si las dos
pestañas están ciegas NO hay relevo (movería la ceguera de sitio), y a un líder que sí ve no
se le quita el mando por esta vía.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | se quita el relevo por ceguera de la condición | *una pestaña que SÍ ve releva a un líder ciego, aunque el líder esté a la vista* (`suite_17`) | Sí — 52/52 |
| 2 | el relevo se dispara aunque yo tampoco vea (se quita `&& yoVeo`) | *si el líder ciego y yo estamos los dos ciegos, NO hay relevo* (`suite_17`) | Sí — 52/52 |
| 3 | el latido deja de publicar `ve` | *el latido publica si esta pestaña PUEDE leer la agenda* (`suite_17`) | Sí — 52/52 |

La mutación 2 es la que importa de verdad: sin ella el relevo degeneraría en dos pestañas
ciegas pasándose el mando en ráfaga, que es peor que el defecto original.

Banco completo: **2.731 comprobaciones pasan, 0 fallan.**

## v18.0.10 — 31-ago-2026 · SE RETIRA LA HEURÍSTICA DEL CONSULTORIO

Decisión del médico (31-ago), a propuesta mía: **«quítala entonces»**.

### Qué era, y por qué se va

La v18.0.7 añadió una heurística: *«si el médico abrió hoy la historia de ese paciente, calla
el aviso ÁMBAR de Sin presentarse»*. Nació de un reporte real —dos avisos de pacientes ya
atendidos— pero **atacaba el síntoma**. La v18.0.8 encontró la causa de verdad (el antirrebote
resucitaba un estado de 45 minutos antes) y la arregló, con lo que esta heurística se quedó
sin trabajo.

Y tenía un filo que el propio médico señaló al dar el criterio bueno —*«o vino o no vino»*—:
**abrir una historia no prueba que el paciente viniera.** Si la abre para revisar un dato de
alguien que al final no se presentó, esa inasistencia REAL quedaba silenciada y sin contar.
Cambiar un falso positivo por un falso negativo, justo en el CSV con el que reclama, es peor
negocio que el problema original.

### Qué se retiró, entero

`_consultorioLeer` / `_consultorioMarcar` / `_consultorioTiene`, la clave de almacenamiento
`vgl_consultorio_dia`, el campo `state.enConsultorio`, la marca `callar` que ponía en el
ÁMBAR, la salida temprana de `maybeNotify` para ese caso, y sus cinco pruebas.
`extractPacienteAbierto()` vuelve a ser un **extractor puro**: se le había añadido un efecto
secundario (anotar al paciente) para no olvidarse de ninguno de sus 27 llamadores, y ese
efecto ya no tiene razón de ser. `callar` vuelve a ponerlo **solo** el ROJO de «sin
presentarse → atendido» (v16.2.8 / v18.0.4), que es evidencia que el médico sí quiere.

### Verificación de que no se abre un agujero al quitarla

Reproducido con el arnés, ya sin la heurística:

```
CASO DEL 31-AGO   -> estado "Atendido"  color VERDE  elapsed 20,7   (el aviso falso NO sale)
INASISTENCIA REAL -> color AMBAR  callar=false                      (sigue avisando y contando)
```

La protección viene del antirrebote con ventana (v18.0.8), no de la heurística. No hace falta
mutación nueva: las mutaciones 1 y 2 de la v18.0.8 ya fijan esa protección, y siguen en verde.
Lo que sí queda comprobado aquí es la otra mitad —que una inasistencia REAL vuelve a avisar y
a contarse sin nadie que la calle—, que era justo el riesgo de la heurística retirada.

Banco completo: **2.726 comprobaciones pasan, 0 fallan** (cinco menos que la v18.0.9: las de
la heurística, que se van con ella).

## v18.0.11 — 31-ago-2026 · LA GUARDA EN TODOS LOS CAMINOS, Y EL «NO SÉ POR QUÉ»

Dos huecos que quedaban abiertos tras la v18.0.7, verificados contra el código actual.

### 1. `applyPymIdx` instalaba un libro equivocado por las otras dos puertas

La v18.0.7 puso la guarda del libro equivocado en la descarga automática y en el captador de
la pestaña de SharePoint. Pero a `applyPymIdx` se llega **además** desde la base piloto
(`loadPymBaseDescarga`) y desde el **selector manual de archivo**. Y es ahí donde está el daño
de verdad, porque `applyPymIdx` hace tres cosas seguidas:

1. `afterPymLoaded(...)` **sella el día** → `debeBuscarPymDiario()` pasa a decir «ya está» y
   el reloj de 10 minutos **deja de buscar la lista real hasta medianoche**;
2. `savePymCache(...)` **persiste el índice malo**, que se readmite en cada recarga;
3. `localStorage.setItem("vgl_pym_dia", …)` deja la marca de «ya tengo la de hoy».

Un libro equivocado por cualquiera de esas puertas apagaba el aviso la jornada entera. La
guarda pasa a vivir **en `applyPymIdx`**, que es el cuello por el que pasan todos.

### 2. Los tres mensajes que explicaban el fallo eran inalcanzables

`loadPymDiario` tiene tres ramas de fallo bien redactadas, todas dentro de `if (!silent)`. Las
**tres** llamadas de producción pasan `silent = true`. El diagnóstico se calculaba y se tiraba
en cada vuelta, y al médico le quedaba un «PyM sin cargar» mudo. Sus palabras: *«no sé por
qué»*. Ahora la razón se guarda en `state.pymUltimoFallo` y se enseña **donde él ya mira**: la
línea de estado del panel y el bloque `--- PyM ---` del Diag. Sin interrumpir nada — no es un
aviso nuevo, es la respuesta esperando en el sitio donde surge la pregunta.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | se quita la guarda de `applyPymIdx` | *applyPymIdx RECHAZA un libro que no parece PyM — venga por donde venga*, + las dos del motivo (`suite_03`) | Sí — 27/27 |
| 2 | el motivo se anota pero no se limpia al cargar bien | *al cargar bien, el motivo anterior se OLVIDA — no se queda colgado del día* (`suite_03`) | Sí — 27/27 |

La mutación 2 protege algo que se olvida fácil: **un motivo viejo que sobrevive a una carga
buena es una mentira sobre el estado actual**, y de las peores — le diría al médico que algo
falla justo cuando ya funciona.

Banco completo: **2.730 comprobaciones pasan, 0 fallan.**

## v18.0.12 — 31-ago-2026 · LA PREMISA DE v16.2.8 ERA FALSA

El médico corrigió una afirmación mía sobre el ROJO y, al tirar del hilo, resultó que
corregía una decisión suya de agosto. Sus palabras, en dos mensajes:

> «el rojo es cuando cambia de "sin presentarse" a "en sala" después del tiempo de
> confirmación. **en ningún momento pasará de sin presentarse a atendido**»
>
> «yo soy el que decido si se atiende o no al que llega tarde […] **JAMÁS pasaría a la
> leyenda "atendido" si yo no estoy de acuerdo en atenderlo**»

En Everest la cita SIEMPRE pasa por «En Sala» —ahí él llama al paciente— antes de
«Atendido». La v16.2.8 (20-ago) trató el salto directo como un hecho real y decidió «no
notificar, pero registrar en rojo». Lo que veía entonces no era Everest saltándose un
estado: era **el script perdiéndose esa lectura**, el mismo hueco arreglado hoy por tres
sitios (líder ciego, antirrebote que resucitaba estados viejos, y el descanso de 5 min del
API). Un dato que solo aparece cuando el script parpadea no es un hallazgo clínico: es la
huella del parpadeo.

### Lo que se midió antes de cambiarlo

| | contador «fraude» | filas del CSV |
|---|---|---|
| Salto imposible (hueco de lectura) | **1** | INASISTENCIA · RECTIFICACIÓN · CAMBIO_ESTADO |
| Fraude real (pasa por «En Sala») | 1 | INASISTENCIA · RECTIFICACIÓN · **FRAUDE_EXTEMPORANEO** · CAMBIO_ESTADO |

Mismo número, **sin la fila que lo respalda**. El médico veía «1 confirmación extemporánea»
y no encontraba la línea con la que reclamar. Después del cambio, la primera fila queda en
`fraude = 0` y escribe `HUECO_DE_LECTURA`, que es el hecho verdadero; la segunda no cambia.

El color pasa a VERDE, y eso **no** afirma «llegó a tiempo»: `maybeNotify` exige `arrival`
—una llegada observada EN VIVO— para contar o avisar un verde, y aquí `arrival` es false
porque nadie vio la llegada. Así que no cuenta, no suena y no miente.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | vuelve la conducta de v16.2.8 (ROJO + `alertedFraud`) | *el salto imposible a Atendido NO es un fraude — es un hueco de lectura* (`suite_04`) | Sí — 68/68 |
| 2 | se quita el candado y la fila se repite en cada vuelta | *y no se repite en cada vuelta — una cita, un hueco, una fila* (`suite_04`) | Sí — 68/68 |
| 3 | el fraude REAL deja de sonar | *el FRAUDE REAL (pasa por En Sala) no se toca* + **dos pruebas preexistentes** (`suite_04`) | Sí — 68/68 |

La mutación 3 es la que de verdad importa: comprueba que al retirar el fraude falso **no se
tocó el verdadero**, y lo confirman dos casos que ya existían desde antes de esta entrega.
La 2 protege la bitácora: el sondeo pasa cada pocos segundos y sin candado se llenaría de la
misma línea.

`suite_32` (R2.5) afirmaba también la conducta vieja: se conserva el caso —la rama sigue
siendo alcanzable y hay que fijar su conducta— reescrito a lo que ahora debe pasar.

Banco completo: **2.732 comprobaciones pasan, 0 fallan.**

## v18.0.13 — 31-ago-2026 · EL CUADRE DEL CSV, POR EL OTRO LADO

Lo encontró una **auditoría adversarial de mi propia entrega v18.0.12**, lanzada para
intentar refutarla. Confirmó el arreglo… y destapó dos cosas más, una de ellas peor.

### 1. Un comentario que inventaba una red de seguridad

`maybeNotify` afirmaba: *«la fila de auditoría se escribe SOLO si de verdad se contó, para
que el número de la cabecera del CSV y el número de filas del cuerpo cuadren siempre (hay una
prueba de conciliación en suite_10 que lo exige)»*.

**Esa prueba no existía.** El único caso de `suite_10` que toca `exportAudit` inyecta a mano
`{fraude:3}` junto a DOS filas y solo comprueba el formateo — un ejemplo deliberadamente no
conciliado. Un comentario que inventa una red de seguridad es peor que no tener red: quien lo
lee deja de mirar. Por ese hueco pasaron **dos** defectos, uno en cada dirección.

### 2. Fila SIN contar (la dirección contraria a la de v18.0.12)

`logEvent(FRAUDE_EXTEMPORANEO)` vivía en `colorAndAlert` y `bumpStatCita("fraude")` en
`maybeNotify`. Y `tick()` llama a la primera sin la segunda en el **primer sondeo de cada
pestaña**: `if (!state.summarized) { _sembrarEstadoInicial(processed) } else if (leader) {
processed.forEach(maybeNotify) }`. Una pestaña que hereda `fraudWatch` de otra —se comparte
entre pestañas— y ve «En Sala» en su primer sondeo escribía la fila y no la contaba. Medido:

```
CABECERA del CSV -> Confirmaciones extemporáneas: 0
CUERPO   del CSV -> filas FRAUDE_EXTEMPORANEO   : 1
```

La fila se muda a `maybeNotify`, atada al mismo `_conto` que decide el número: contar y
registrar dejan de poder separarse. Verificado en tres escenarios (primer sondeo sin
`maybeNotify`, camino completo, y repeticiones): los tres cuadran.

### 3. La prueba que faltaba, escrita de verdad

`suite_10` gana **el cuadre del CSV**: recorre el motor real (`colorAndAlert` +
`maybeNotify`, sin inyectar contadores a mano), exporta el CSV y compara cabecera contra
cuerpo en las tres categorías. Detalle que la prueba dejó al descubierto y que conviene
tener escrito: **«En Sala» hay que leerlo DOS veces** para que el antirrebote de v17.6.21 lo
confirme; con una sola lectura el fraude no se detecta. Escribir el escenario con una sola
lectura habría sido probar algo que no ocurre en la cadencia real.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | la fila del fraude vuelve a `colorAndAlert`, separada del conteo | *cuadra TAMBIÉN en el primer sondeo de una pestaña, que no llama a maybeNotify* (`suite_10`) | Sí — 28/28 |
| 2 | se cuenta el fraude pero no se escribe la fila | *EL CUADRE DEL CSV — la cabecera y las filas del cuerpo dicen lo mismo* (`suite_10`) | Sí — 28/28 |

Una mutación por dirección, y cada una tumba exactamente la prueba de su lado.

**Nota de proceso.** El caso de v18.0.12 *«el FRAUDE REAL … sigue dejando su fila»* se puso
rojo con este cambio: comprobaba la fila llamando solo a `colorAndAlert`. Se corrigió para
recorrer el camino entero —que es el real— y se le añadió la comprobación del contador. Una
prueba que solo mira media tubería es justo cómo se coló el defecto.

Banco completo: **2.734 comprobaciones pasan, 0 fallan.**

## v18.0.14 — 31-ago-2026 · EL CSS DE EVEREST SÍ SE ESTABA COLANDO (yo medí mal)

Origen: el médico reportó el 31-ago que *«la mayoría de los módulos quedaron con problemas
con el rework visual»*, y marcó los cuatro síntomas —colores que parecen Everest, texto
ilegible, cosas fuera de sitio o cortadas, y se ve apretado— en los cuatro módulos
(Agendamiento, Panel del paciente, Laboratorios, panel del Centinela).

**Yo lo descarté con una medición mal hecha.** Mi analizador solo contaba reglas cuyo
selector llevara un id de módulo (`#vgl-…`), así que se me escaparon las reglas de SOLO
CLASE —`.vgl-agm-sub b`, `.vgl-uro-badge`, `.vgl-chip-mas`…—, que son las más numerosas y
viven dentro de todos los módulos a la vez. Le dije que la cascada no se estaba colando. El
censo real era de **125 declaraciones secuestrables**, no una. Tenía razón él.

### 1. El blindaje completo de `color`

Medido en Chromium con el Everest hostil que prescribe `CLAUDE.md`
(`div,span,p,b,small,label{color:#111827 !important}`):

| | antes | después |
|---|---|---|
| nodos de texto del panel que perdían su color | **46 de 58** (mediana 1,62:1) | 0 |
| documento del paciente (Laboratorios, tema oscuro) | 1,03:1 — **invisible** | legible |
| rótulo «Función renal:» (Laboratorios, tema oscuro) | 1,04:1 — **invisible** | legible |

Se blindan **todas** las declaraciones de `color` de la hoja: 423 declaraciones, **0
expuestas**. El total de `!important` pasa de 475 a 635.

Comprobado ANTES de barrer, porque era el riesgo real de barrer de más: `grep "style.color
="` devuelve **cero** en todo el archivo, así que ningún `!important` nuestro puede apagar un
color que el script pinte a mano desde JS.

### 2. El blindaje tipográfico estaba escrito de dos formas, y una no servía

Cuatro reglas lo escribían con el id DENTRO del `:where()`
—`:where(#vgl-cw-examenes :not([class])){color:inherit}`—, lo que deja la regla en
especificidad **(0,0,0)**: la gana cualquier `span{color:X}` de Everest. Pasan a la forma
fuerte que ya usaba el blindaje general de v12.3.15 (id FUERA, `!important`):
`#vgl-cw-examenes :where(:not([class])){color:inherit !important}` = (1,0,0).

**Corrección a mi propio criterio, que tenía mal.** Yo creía que el blindaje debía quedarse
sin `!important` «por tener especificidad cero». Eso confundía dos defensas distintas: la que
cierra el bug #1 del proyecto (nuestra regla vieja gana a nuestra clase nueva) es el
`:not([class])`, que hace al blindaje y a nuestras clases de acento **disjuntos por
construcción** — nunca alcanzan al mismo elemento, así que no pueden competir. La falta de
`!important` no defendía de nada; solo lo hacía perder contra Everest.

### 3. Un blindaje que hereda de un padre secuestrado no blinda nada

Aun con lo anterior, Chromium seguía marcando en rojo el `<b>vencido</b>` del widget de
Exámenes. El blindaje SÍ forzaba `color:inherit`… y heredaba de `.vgl-cw-panel` /
`.vgl-cw-fila`, que son `<div>` **con clase y sin color propio**: la regla
`div{color:X !important}` de Everest los pintaba a ellos. La cadena entera necesita color
propio desde la raíz. Se blindan las dos raíces (`#vgl-cw-examenes`, `#vgl-cw-farmaco`) y sus
contenedores estructurales.

### 4. Y debajo había un defecto vivo desde la v17.24.0

Midiendo el punto 3 apareció que la **regla raíz del widget de Fármacos no se aplicaba en
absoluto**: `position` salía `static` y `max-width` salía `none`. La causa estaba cinco
líneas más arriba, en un comentario que documentaba las clases del panel con comodines:

```
(.vgl-mtr-*/.vgl-dup-*)
        ↑ este "*/" CIERRA el comentario aquí
```

El analizador de CSS se queda con el **primer** `*/`, no con el que el autor tenía en la
cabeza. El resto de la frase pasaba a leerse como selector y el analizador seguía tragando
hasta poder recuperarse: **se comía la regla siguiente entera**.

Lo que llevaba meses muerto: `z-index:var(--z-widget)` (el widget podía pintarse por debajo
de elementos de Everest), `max-width:320px` (se estiraba sin freno) y `font-family`. La
posición se salvaba de milagro porque JS la pone en línea desde la v17.38.0 — que es
exactamente por qué el fallo pudo pasar meses sin verse.

Es la misma familia que la Regla N (un backtick suelto tumba el archivo entero), pero **mucho
más silenciosa**: no hay error de sintaxis ni en JS ni en CSS. El archivo carga, el banco
pasa, y una regla simplemente no existe.

### Pruebas nuevas

- **Regla P** (`suite_25`) — TODA declaración de `color` de la hoja lleva `!important`, sin
  excepción, recorriendo el CSS entero sin filtrar por selector (que es donde estaba mi punto
  ciego). Y en la otra dirección: cada rama de cada `:where()` debe conservar `:not([class])`,
  que es la condición que hace seguro ese `!important`.
- **Regla Q** (`suite_25`) — ningún comentario se cierra antes de tiempo. Dos comprobaciones:
  sintáctica (ningún `*/` seguido de texto en la misma línea) y semántica (tras despiezar los
  comentarios *como lo hace el analizador*, ningún selector con caracteres no ASCII — todos
  los nuestros son ASCII, la prosa del proyecto lleva tildes).
- **La regla raíz de `#vgl-cw-farmaco`** sobrevive al despiece y conserva sus cuatro
  propiedades.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 1 | se le quita `!important` a `.vgl-labsv-lead` (clase suelta, fuera de `#vgl-root`) | *Regla P* (`suite_25`) | Sí — 2.738 |
| 2 | se le quita `:not([class])` a una rama del blindaje de `#vgl-labsv-modal` | *Regla P*, segunda mitad (`suite_25`) | Sí — 2.738 |
| 3 | se reintroduce el `*/` prematuro del comentario de v17.24.0 | *Regla Q* (`suite_25`) | Sí — 2.738 |

**Nota de proceso — la mutación 2 encontró un fallo en mi propia prueba.** Escrita al
principio sobre `reglasCss`, NO se puso roja: el extractor de `suite_25` parte los selectores
por comas, **incluidas las comas de dentro de un `:where()`**, así que sus entradas traen
fragmentos con paréntesis sin cerrar y la comprobación no veía nada. Se reescribió esa mitad
sobre el CSS crudo, con recorrido de paréntesis balanceados. Sin la mutación, la prueba se
habría entregado verde y hueca.

Banco completo: **2.738 comprobaciones pasan, 0 fallan.**

## v18.0.15 — 31-ago-2026 · LA COSECHA EN VIVO MANDABA PHI A GEMINI SIN SANEAR

Hallazgo del **barrido exhaustivo de las 40.810 líneas** (97 agentes, cada hallazgo
verificado adversarialmente; 72 confirmados). Este es el primero que se arregla porque no es
una decisión de diseño: es una violación directa de la regla **Cero PHI** del proyecto, con
el dato saliendo del equipo.

### El defecto

El módulo tiene **dos caminos** que llevan la historia de Everest al prompt de Gemini:

| camino | desidentifica |
|---|---|
| vía de RED — `mtrHechosDesdeHcEverest` | sí: `mtrHcTachar` + `mtrHcValorLimpio` (→ `scrubPII`) |
| cosecha EN VIVO de la pantalla — `mtrCosecharHcDelDom` (v17.10.0) | **no: `v.slice(0,300)` crudo** |

Y de ahí no se quedaba quieto: `mtrHcAcumularDelDom` lo persiste en `hcEverest.dom`,
`mtrHcTextoParaHoja` lo vuelca tal cual bajo «escrito en la historia de HOY», y
`mtrRedaccionPrompt` lo mete en el bloque HECHOS DEL PACIENTE que viaja a
`generativelanguage.googleapis.com`.

Reproducido con el arnés, salida literal antes del arreglo:

```
COSECHADO DEL DOM  : "…CC 80123456 cel 3001234567 correo x@correo.com"
VÍA DE RED (limpio): "…CC [CENSURADO] cel [TEL_CENSURADO] correo [CORREO_CENSURADO]"
```

La cabecera del módulo (v17.9.0) **prometía lo contrario**: *«Defensa en profundidad: todo lo
que sea texto pasa igual por scrubPII»* y *«nunca se vuelca el DOM»*. Ningún comentario del
archivo declaraba esta ruta como excepción — que es justo lo que la hacía invisible. Es la
misma forma que el defecto de v17.45.0 (`mtrDatosExtraTexto` sin el nombre del paciente):
**cinco canales llegan al mismo prompt y basta con que uno se salte la defensa.**

### El arreglo

`mtrCosecharHcDelDom` pasa el texto por `mtrHcValorLimpio`, el mismo saneador de la vía de
red. Los valores numéricos siguen siendo números (peso, talla, tensión no se tocan), y si el
saneo deja la casilla vacía no viaja — la regla de la casa.

### Lo que este arreglo NO cierra, y hay que decirlo

`scrubPII` reconoce cédula, teléfono, correo y fechas **porque tienen forma**. Un **nombre
propio escrito a mano sigue pasando** por esta vía. La vía de red lo tacha con
`mtrHcTachar(crudo, mtrHcTachaduras(payload))`, usando la identidad que trae el propio
paquete — identidad que, **por diseño, no se guarda en ningún sitio** (`mtrHcTachaduras` la
usa y la tira). La cosecha del DOM no tiene esa fuente.

Cerrarlo exige decidir de dónde sale el nombre del paciente abierto, y además **depende de
otro defecto abierto del mismo barrido** (`mtrHcTachar` tacha por subcadena sin límite de
palabra: un nombre de 3-4 letras destroza el grounding clínico). Se declara aquí en vez de
improvisarlo: un examen que no se pide sin explicación es indistinguible de un olvido, y una
defensa a medias que nadie declaró es exactamente cómo apareció este defecto.

### Pruebas nuevas (`suite_57`)

- La cosecha en vivo desidentifica **igual** que la vía de red — comparación directa
  `mtrCosecharHcDelDom(...) === mtrHcValorLimpio(...)`. Mientras eso se cumpla no puede
  volver a haber un camino saneado y otro no, que es la forma que tuvo el defecto.
- El saneo **no rompe los números**: peso 72,5 y talla 168 siguen llegando como números.
- El eslabón siguiente: lo cosechado llega ya desidentificado a `mtrHcTextoParaHoja`, que es
  el texto que de verdad ve el modelo.

### Mutación verificada

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 4 | se restaura `salida[nombre] = v.slice(0, 300)` (la fuga original) | *la cosecha EN VIVO desidentifica igual que la vía de red* y *lo cosechado llega ya desidentificado al texto de la hoja* (`suite_57`) | Sí — 2.741 |

Banco completo: **2.741 comprobaciones pasan, 0 fallan.**

## v18.0.16 — 31-ago-2026 · MI PROPIO BLINDAJE SE COMIÓ CUATRO AVISOS

Regresión **mía**, de la v18.0.14, encontrada al comprobar si mi barrido de `!important`
podía haber roto el rediseño visual que el médico echa en falta. Podía, y lo hizo.

### Qué rompí

`CLAUDE.md` daba por sentado — y era cierto hasta esa entrega — que *«el estilo inline SÍ es
inmune a esto (gana a cualquier regla no-`!important`)»*. **Dejó de serlo el día que
nuestras propias reglas ganaron `!important`**: un `!important` de hoja le gana a un estilo
en línea que no lo lleva. Y el blindaje tipográfico alcanza a todo elemento **sin clase
propia**, que es exactamente lo que eran los cuatro sitios afectados.

Medido en Chromium, v18.0.13 contra v18.0.15:

| sitio | antes | después de mi barrido |
|---|---|---|
| hora asignada del modal de agendamiento | `#4ff0b8` | **blanco** |
| etiqueta de fecha («mañana», «hoy») | `#4ff0b8` | **blanco** |
| caja «la IA escribió una cifra que no está en los hechos» | `#8b1a1a` | **negro** |
| el número señalado dentro de esa caja | `#c00` | **negro** |

Los dos últimos son **el aviso más grave del módulo de redacción**. Los dos primeros son
cifras que el médico lee **antes de confirmar una cita**.

Y un quinto, **anterior a mi barrido**: los dos «✓ Activa en este equipo» de Ajustes pintaban
su verde en línea sobre un `.vgl-fld .vgl-hint` que ya declaraba `color:var(--fg2) !important`
desde antes. Nunca se vieron verdes. Se arregla de paso.

### Por qué la Regla B no lo cazó

La Regla B de `suite_25` existe literalmente para esto — «`!important` nuestro contra `.style`
de JS nuestro» — y mira `.style.color =`. Los cuatro pintaban por **`cssText`** o por
**`style="…"` dentro del HTML**, dos vías que la regla no miraba. Yo mismo me apoyé en ella:
antes de barrer comprobé `grep "style.color ="` → cero, y di el riesgo por descartado. La
comprobación era correcta y el alcance era demasiado estrecho.

### El arreglo

El idioma que el proyecto ya tenía escrito: **quien lleva color propio lleva clase propia**, y
entonces el `:not([class])` del blindaje no lo alcanza nunca. Los seis sitios pierden el color
en línea y lo reciben desde la hoja, con `!important` porque cuelgan de `document.body`.

Efecto lateral bueno: ahora esos cuatro avisos **también sobreviven al Everest hostil**, cosa
que antes no hacían — el estilo en línea sin `!important` perdía contra cualquier regla de
Everest que sí lo llevara.

### Prueba nueva — Regla R (`suite_25`)

Ningún color pintado en línea puede quedarse sin `!important`, contando **las tres vías**:
`style="…"` en el HTML, `elemento.style.cssText`, y `elemento.style.color =`. El invariante:
o lleva `!important` (y gana a todo, nuestro y de Everest), o no existe y el elemento lleva
clase propia con su color en la hoja, donde la Regla P ya lo obliga a blindarse. Las dos
salidas son seguras; lo inseguro es el término medio, que es lo que había.

### Mutación verificada

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 5 | se le devuelve el `color:#8b1a1a` en línea a la caja de cifras y se le quita la clase | *Regla R* (`suite_25`) | Sí — 2.742 |

Banco completo: **2.742 comprobaciones pasan, 0 fallan.**

## v18.0.17 — 31-ago-2026 · TRES DEL BARRIDO: LA NEGACIÓN SIN VERBO, EL CONTADOR QUE SE DESCONTABA POR PESTAÑA, Y EL AVISO QUE SE QUEMABA SOLO

Primeros tres defectos del **barrido de las 40.810 líneas** que no dependen de una decisión
del médico. Los tres reproducidos con el arnés antes de tocar nada.

### 1. «Paciente no diabético, no fumador» se leía como una AFIRMACIÓN

`mtrTextoOpinaSobre` reconocía la negación **con verbo** («no fuma», «no es diabético»,
arreglo de v17.6.30) pero no la forma en que el médico escribe de verdad, que va **sin
verbo**: «no diabético», «sin diabetes conocida», «nunca fumador», «sin tabaquismo». Todas
caían en el `return true` del final.

Medido con el arnés antes de arreglar: **6 de 12 frases clínicas normales mal clasificadas.**

Y no era cosmético. `mtrDiscrepanciasDeFuentes` devolvía una discrepancia de severidad ALTA,
`mtrDiscrepanciasQueFrenan` la dejaba **frenando**, y el Panel del paciente **no abría** hasta
que el médico respondiera un cuadro «Las fuentes no coinciden» sobre un dato que él mismo
acababa de negar por escrito. Si respondía «Sí», se archivaba una confirmación falsa.

**El arreglo es por proximidad, no por catálogo.** Se mira si hay un negador
(`no|sin|nunca|jamás`) justo antes de donde casó el término clínico, dentro de la misma
cláusula. Así vale para cualquier `re` que se le pase, hoy y en el futuro, sin mantener una
lista de enfermedades en paralelo.

La frontera es **la coma**, y esa decisión la obligan dos casos reales que deben seguir siendo
afirmaciones:

| frase | debe salir | por qué |
|---|---|---|
| «Sin control, diabético descompensado» | **AFIRMA** | «sin control» niega el control, no la diabetes |
| «Paciente no diabético, fumador activo» | **AFIRMA** (para tabaquismo) | el «no» es de la primera cláusula |
| «No solo tiene hipertensión sino también diabetes» | **AFIRMA** | «sino» no es «no» (límite de palabra) |

Después del arreglo: **19 de 19 correctas**, incluidas las tres trampas y el descarte de
antecedentes de terceros, que sigue intacto.

### 2. El contador de inasistencias se descontaba una vez POR PESTAÑA

La rectificación retroactiva de v18.0.8 vivía **112 líneas antes** del
`if (!state.leader) … return`, así que la ejecutaban **todas** las pestañas. Y desde la
v18.0.4 `_fraudeCompartidoFusionar` copia `contadas` a las no líderes cada 10 s, con lo que
todas llegaban con la marca puesta.

Con tres pestañas abiertas, el contador del día bajaba **3 → 0** en vez de 3 → 2, y se
escribían **tres filas** `RECTIFICACION_INASISTENCIA` por un único hecho. Una inasistencia
falsa borraba dos verdaderas. Son los números con los que el médico reclama.

La asimetría era evidente una vez vista: **contar** ya era exclusivo del líder y estaba
deduplicado por `contadas` (`bumpStatCita`); **descontar** no tenía ni lo uno ni lo otro.

**La guarda va sobre el bloque entero, no solo sobre el descuento**, y eso importa: si una
pestaña no líder borrase su marca local y llamara a `_fraudeCompartidoGuardar()`, empujaría
esa borradura al almacén compartido y el líder ya no vería la marca — **no rectificaría
nunca**. El arreglo a medias habría sido peor que el defecto.

### 3. El aviso de ceguera se quemaba solo, en el primer tick

`avisoYaVisto` está fechado **por día** y vive en localStorage compartido entre pestañas: el
aviso «Vigilante sin lectura de la agenda» sale **una vez al día y punto**.

Y salía en el primer tick de cada arranque. `state.apiCitas` nace `null` y `tickApi()` solo se
invoca **al final** del propio tick, así que `data === null` siempre la primera vez. Al
recargar (F5) o abrir Everest dentro de una historia clínica —donde el médico pasa el 90 % de
la jornada— la guarda se cumplía sin falta.

Dos daños, y el segundo es el grave:

1. se le afirmaba al médico que la conexión «aún no se aprendió esta sesión», **cosa falsa**
   cuando `API.url` ya está aprendida y persistida y el sondeo funciona un segundo después;
2. ese disparo espurio **consumía el único aviso del día**. Si a media mañana el Vigilante se
   quedaba ciego de verdad, el aviso ya no salía. El arreglo de v18.0.8, que existe
   precisamente para que la ceguera no pase en silencio, **quedaba anulado por el propio
   arranque de la pestaña**.

Condición que faltaba: que esta pestaña haya **intentado** leer el API al menos una vez. Sin
URL aprendida el mensaje sí es cierto y sigue saliendo — la ceguera real no se silencia.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 6 | se quita la negación por proximidad | *reconoce la negación por sustantivo o adjetivo, sin verbo* (`suite_01`) | Sí — 2.748 |
| 7 | se quita la guarda de líder de la rectificación | *una pestaña NO líder no descuenta la inasistencia* (`suite_04`) | Sí — 2.748 |
| 8 | se quita la exigencia de haber intentado leer el API | *el aviso de ceguera exige haber INTENTADO leer el API* (`suite_42`) | Sí — 2.748 |

**Nota sobre la prueba del punto 3.** Es una regresión de **código fuente**, y se dice por
qué: ejercitar el defecto de verdad exige el `tick()` completo con su DOM, su liderazgo y su
reloj — una prueba así comprobaría media docena de cosas a la vez y se rompería por cualquiera
de ellas. Lo que hay que fijar es un cable. Mismo criterio que la regresión de fuente de
`suite_71` sobre el enganche de los widgets y la de `suite_57` sobre el nombre que viaja al
saneador.

Banco completo: **2.748 comprobaciones pasan, 0 fallan.**

## v18.0.18 — 31-ago-2026 · LA MEMORIA DEL PACIENTE: UNA RESPUESTA DESCARTADA Y UN ALMACÉN REESCRITO CADA 2 SEGUNDOS

Dos defectos del barrido, los dos en `_vglCosechaGuardar` —la función que archiva lo que el
script sabe de cada paciente— y los dos reproducidos con el arnés.

### 1. Una respuesta del médico se descartaba en silencio, y la pregunta volvía para siempre

La guarda de escritura de la v18.0.4 («no escribir si nada cambió») comparaba firmas con un
replacer que borraba **toda** clave llamada `ts`, a cualquier profundidad. Entre ellas,
`confirmaciones[clave].ts` — que **no es ruido de reloj**: es lo único que decide si la
respuesta sigue viva (`_vglConfirmacionVigente`).

Reproducido:

```
vigente a los 31 días (30 de vigencia):  NO -> se vuelve a preguntar (correcto)
tras responder de nuevo, el sello guardado es de hace 31 días
¿vale ahora la respuesta?                NO
```

El médico responde «¿está embarazada?» —30 días de vigencia, severidad ALTA, **frena** el
Panel del paciente—, pasan 31 días, se le vuelve a preguntar y contesta lo mismo. La firma
nueva salía idéntica a la vieja y **no se escribía nada**: el sello seguía siendo el de hace
31 días y la misma pregunta bloqueante reaparecía cada vez que se abre el Panel,
indefinidamente. Sin toast y sin registro. Con la escalera de adherencia (vigencia 1 día), a
partir del segundo día no vuelve a callarse nunca.

Se ciegan **solo los dos sellos que de verdad son ruido**, y por su sitio, no por su nombre:
el del registro del paciente y el de `hcEverest` (que se renueva en cada cosecha de pantalla).
`confirmaciones[*].ts` y `factores[*].ts` quedan dentro de la firma.

### 2. El almacén entero se reescribía cada 2–5 segundos

Las tres líneas que anotan la pestaña vista ponían `Date.now()` **en cada vuelta del reloj**.
El sello viaja bajo la clave «Antecedentes» (no `ts`), así que la guarda no lo veía y la firma
cambiaba siempre. Medido: **10 escrituras en 10 vueltas sin un solo cambio real**.

Con 80 pacientes archivados eso es ~1 MB de `JSON.stringify` más un `setItem` síncrono cada
2–5 s, en cada pestaña con una historia abierta — y reabría justo la carrera que el comentario
de la v18.0.4 dice haber cerrado: dos pestañas que leen-fusionan-reescriben el almacén entero
en la misma vuelta pueden pisarse y **perder la fusión de la otra**, que es la memoria clínica
del paciente.

Conservar el sello viejo es seguro, y no de palabra: **el valor no se lee en ningún sitio**. El
único consumidor recorre `Object.keys(anotadas)`, no sus fechas.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 9 | vuelve la firma que ciega todo `ts` | *re-responder lo mismo tras la caducidad SÍ renueva la vigencia* (`suite_32`) | Sí — 2.751 |
| 10 | vuelve el sello incondicional de las pestañas | *el sello de la pestaña ya anotada no se renueva en cada vuelta* (`suite_32`) | Sí — 2.751 |

**Nota de proceso: la mutación 10 destapó que mis dos primeras pruebas eran HUECAS.**
Simulaban a mano la línea de producción (`if (!n["Antecedentes"]) …`) en vez de ejecutarla, así
que comprobaban su propia lógica local: al revertir el arreglo en el script **seguían verdes**.
Se reescribieron llamando a `_vglCosecharDePantalla`, que es la función que contiene de verdad
esas líneas, con la barra de pestañas de Everest simulada como ya hace `suite_64`. Es la
segunda vez hoy que una mutación encuentra un fallo en una prueba mía — y las dos veces la
prueba se habría entregado verde y vacía.

Banco completo: **2.751 comprobaciones pasan, 0 fallan.**

## v18.0.19 — 31-ago-2026 · EL AVISO DE ACTUALIZACIÓN LEÍA UN ARCHIVO DISTINTO DEL QUE SE INSTALA

Encontrado leyendo la telemetría real de la flota que el médico subió, no auditando código.

### El dato que lo destapó

De **74 equipos** en el histórico, **23 activos** en los últimos tres días. Repartidos así:

| rama | equipos activos |
|---|---|
| v18.0 | 10 |
| v17.28 | 1 |
| **v17.0** | **12** |

Doce equipos en producción, reportando hoy mismo, **sin ninguno de los arreglos de la
jornada** — incluido el del libro de PyM equivocado que los compañeros del médico reportaron.

### La causa

`VGL_UPDATE_GIST_URL` apuntaba a `gistfile2.txt` con el comentario **«= @updateURL del
encabezado»**. El encabezado apunta a `gistfile1.txt` desde el commit `62c09c2` («alinear
@updateURL con gistfile1, canal real de los equipos»). Se movió el canal y la constante se
quedó atrás, con su comentario jurando lo contrario.

Tampermonkey seguía instalando bien —lee el encabezado— pero el aviso proactivo
**«⬆ Actualización disponible» consultaba otro archivo**. Si ése se quedó congelado, el aviso
no sale nunca y un equipo solo se actualiza si Tampermonkey completa su ciclo diario por su
cuenta.

Es la misma clase de defecto que la v18.0.13: **un comentario que inventa una red de
seguridad**. Quien lo lee deja de comprobar.

**Lo que no pude verificar y hay que decirlo:** el proxy de la sesión bloquea
`gist.githubusercontent.com` (`CONNECT tunnel failed, 403`), así que no pude leer los dos
archivos para confirmar cuál está vivo. La corrección se apoya en lo que el propio código
declara —el encabezado es lo que el gestor usa para instalar— y en el mensaje del commit que
movió el canal. Conviene que el médico lo confirme de un vistazo en el Gist.

### El arreglo

No es cambiar el literal: es que **no pueda volver a separarse**. La URL se toma de `GM_info`,
que expone la misma cadena que el gestor usa para instalar — imposible que difieran. El
literal queda solo de respaldo, y ahora sí coincide con el encabezado.

### Mutación verificada

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 11 | el respaldo vuelve a apuntar a `gistfile2.txt` | *el aviso de actualización consulta el MISMO archivo que Tampermonkey instala* (`suite_42`) | Sí — 2.752 |

La prueba fija el **invariante**, no el literal: encabezado y constante deben apuntar al mismo
archivo. El día que se cambie el canal, cambiarlo en un sitio y no en el otro pone el banco en
rojo — que es exactamente lo que no pasó la última vez.

Banco completo: **2.752 comprobaciones pasan, 0 fallan.**

## v18.0.20 — 31-ago-2026 · UN FALLO DE RED PRESENTADO COMO HECHO CLÍNICO, Y UN ERROR DE DOCE HORAS

Dos defectos más del barrido, los dos reproducidos con el arnés.

### 1. «A este paciente le faltan estos exámenes» cuando lo que hubo fue un fallo de red

Cuando Athenea contesta **5 de 8** solicitudes, el lector devuelve lo que sí llegó pero
**marcado**: `__vglIncompleto = 3`, puesto con `Object.defineProperty({enumerable:false})`
para que no ensucie las iteraciones sobre el array.

`JSON.stringify` **no serializa propiedades no enumerables**. Al persistir la pre-consulta, la
marca desaparecía:

```
antes de guardar  · ¿marcado como incompleto? true  ( 3 solicitudes ilegibles )
tras persistir    · ¿marcado como incompleto? false ( undefined )
```

Aguas abajo: `_preconHidratar` mete ese array en `_labsPrefetch`, `checkAvisoUniversal`
calcula `labsListos = true`, y `_analitosRcvVencidos` declara **vencidos** los analitos que
venían en las solicitudes ilegibles. El aviso de entrada los lista como «Laboratorios RCV sin
resultado vigente» y `avisoMarcarVisto` lo silencia el resto de la jornada.

Al médico se le afirma **«a este paciente le faltan estos exámenes»** cuando lo que pasó fue
que tres solicitudes no se dejaron leer. Es exactamente lo que la regla **«casilla vacía antes
que dato inventado»** existe para impedir, y el aviso además se auto-silencia, así que la
afirmación falsa no vuelve a revisarse en todo el día.

Se guarda como campo normal —que sí viaja en el JSON— y se **recuelga al leer**, otra vez como
no enumerable, para que ninguna iteración la vea como un resultado más.

### 2. Doce horas de error por una palabra suelta

La marca de meridiano se buscaba **sin anclar**, sobre todo el resto de la cadena tras
`HH:MM`. Cualquier «a» o «p» seguida de una palabra que empiece por M pasaba por meridiano:

| entrada | daba | debía dar |
|---|---|---|
| `13:00 Cita Medica` | **60** (1:00 a. m.) | 780 |
| `19:00 Consulta Medicina` | **420** (7:00 a. m.) | 1140 |

Si la hora llegara con un sufijo así —el texto de `.labelHora` en otra vista, o porque
`apiCampos` elige como columna de hora una que arrastre texto, ya que esa función puntúa
columnas llamando a `parseHoraMin` sobre valores arbitrarios— `elapsedMin` daría **+12 h toda
la tarde**: la agenda entera en ÁMBAR pasada la gracia, y marcas de fraude falsas sobre
pacientes que llegaron a su hora.

Anclado al principio del resto. Comprobadas las once formas: `7:30 a. m.`, `07:00 AM`,
`7:30 A.M.`, `11:45 p.m.`, `12:00 p. m.`, `12:00 a. m.`, con texto detrás y sin meridiano.
**11 de 11 correctas.**

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 12 | se desancla el meridiano | *el meridiano se lee solo si viene pegado a la hora* (`suite_02`) | Sí — 2.757 |
| 13 | se deja de persistir la marca de lectura incompleta | *la marca de lectura incompleta sobrevive a la persistencia* (`suite_08`) | Sí — 2.757 |

Banco completo: **2.757 comprobaciones pasan, 0 fallan.**

## v18.0.21 — 31-ago-2026 · LA EVIDENCIA DEL FRAUDE SE PERDÍA POR TENER DOS VENTANAS, Y UNA HORA QUE NO EXISTE

### 1. Quien no avisa se comía la marca de un solo disparo

`alertedFraud` es lo que gobierna `if (sound) { logEvent(FRAUDE_EXTEMPORANEO); reportarFraude(); }`:
se dispara **una vez por cita**. Pero `colorAndAlert` corre en **toda** pestaña que lea la
agenda —`render` la llama con `.map` sin mirar el liderazgo— y desde la v18.0.4 las no líderes
fusionan `fraudWatch` del almacén compartido cada 10 s.

Así que una pestaña no líder llegaba a la rama del fraude, **marcaba y compartía** la marca.
Su propio `sound` se descarta (el `return` de no-líder lo pone en `false`), pero la marca ya
estaba puesta para todos: cuando el líder evaluaba la misma cita, la veía consumida y **no
escribía la fila de auditoría ni reportaba el fraude al tablero**.

La evidencia de una reclamación desaparecía por tener una segunda ventana abierta.

Es la **tercera vez hoy** que aparece la misma familia: v18.0.13 (la fila del fraude se
escribía sin contarse), v18.0.17 (la rectificación descontaba una vez por pestaña) y esta. El
patrón común: **un efecto de una sola vez, ejecutado en un camino que corre en todas las
pestañas.** `sound` se sigue calculando igual, así que el camino del líder no cambia en nada.

### 2. «1h60» es una hora que no existe, y salía media hora de cada hora

`elapsed` viene redondeado a un decimal. Un paciente con **119,7 min** pasados daba
`Math.floor(119,7/60) = 1` y `Math.round(119,7 % 60) = Math.round(59,7) = 60`: la tarjeta
mostraba **«hace 1h60»** y el `title` **«Lleva 1h60 pasado de la tolerancia»**, en vez de
«hace 2h00». Ocurría siempre que los minutos caían en `[59,5 ; 60)` —media hora de cada
hora— y también del lado positivo («en 1h60»).

Se redondea **una sola vez, al total**, y se reparte después: el acarreo a la hora siguiente
ya no puede perderse.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 14 | vuelve el redondeo que produce «1h60» | *la cuenta regresiva nunca imprime «h60»* (`suite_04`) | Sí — 2.760 |
| 15 | se quita la guarda de líder de `alertedFraud` | *una pestaña NO líder no consume la marca de fraude del líder* (`suite_04`) | Sí — 2.760 |

`countdownParts` **no tenía ninguna prueba** en todo el banco antes de esta entrega — se
comprobó con `grep` sobre `tests/`. Una función que pinta una cifra en cada tarjeta de la
agenda, sin una sola prueba: por eso «1h60» pudo estar ahí sin que nada lo notara.

Banco completo: **2.760 comprobaciones pasan, 0 fallan.**

## v18.0.22 — 31-ago-2026 · LA REGLA DE LA FAMILIA, EN VEZ DE UN CUARTO PARCHE

Cuatro veces en una sola jornada apareció **el mismo defecto**, con cuatro caras:

| entrega | cara |
|---|---|
| v18.0.13 | la fila del fraude se escribía sin contarse |
| v18.0.17 | la rectificación de inasistencias descontaba una vez **por pestaña** |
| v18.0.21 | una pestaña no líder consumía la marca de un solo disparo del fraude |
| **v18.0.22** | el registro del HUECO DE LECTURA — **escrito por mí ese mismo día** (v18.0.12), con exactamente el mismo agujero |

El patrón, una vez visto, es siempre el mismo: `colorAndAlert` corre en **toda** pestaña que
lea la agenda —`render` la llama con `.map`, sin mirar el liderazgo— y su
`if (!state.leader) … return` está **al final**. Todo efecto de una sola vez escrito antes de
esa línea lo ejecutan todas las ventanas: se duplican filas de auditoría, se descuentan
contadores de más, y se consumen marcas que el líder ya no vuelve a ver.

### El cuarto caso

`state.contadas.add(marca)` + `_fraudeCompartidoGuardar()` + `logEvent(HUECO_DE_LECTURA)`
corrían sin guarda. Una pestaña no líder empujaba `contadas` al almacén compartido —el mismo
empujón indebido que la v18.0.17 tuvo que cerrar en la rectificación— y, como la marca es por
pestaña hasta que la fusión de los 10 s la reparta, **dos ventanas que vean el hueco en la
misma vuelta escriben dos filas por un solo hecho**.

### Y la regla, que es lo que de verdad importa

Arreglar el cuarto caso y seguir no sirve de nada: el quinto se escribiría igual. `suite_04`
gana una **regresión estructural**: dentro de `colorAndAlert`, y antes de la guarda de líder,
todo efecto secundario (`_apptMarcar`, `_fraudeCompartidoGuardar`, `logEvent`, `bumpStatCita`,
`rectificarStat`, `_noShowRegistrar`, `reportarFraude`, `contadas.add/delete`) tiene que estar
gobernado por `state.leader`. Censo actual: **10 efectos protegidos, 0 sin proteger.**

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 16 | se quita la guarda del `HUECO_DE_LECTURA` | *ningún efecto de una sola vez corre sin ser líder* (`suite_04`) | Sí — 2.761 |
| 17 | se quita la guarda de la **rectificación** (otro miembro de la familia) | la misma regla | Sí — 2.761 |

La mutación 17 se hizo a propósito sobre un miembro **distinto** del que se acababa de
arreglar: una regla que solo cazara su propio caso no sería una regla, sería el parche otra
vez.

**Nota de proceso — la primera versión de esta regla era HUECA, y lo destapó su propia
mutación.** El contexto que examinaba incluía los comentarios, y los comentarios que explican
el arreglo contienen la cadena «state.leader»: la comprobación la encontraba siempre y pasaba
aunque se quitara la guarda de verdad. **Es exactamente el defecto que la regla existe para
cazar, cometido dentro de la regla misma.** Ahora el contexto se filtra a código.

Van **tres pruebas huecas** encontradas hoy por la disciplina de mutación (Regla P, las dos de
la memoria del paciente, y esta). Ninguna habría fallado nunca; las tres se habrían entregado
en verde.

Banco completo: **2.761 comprobaciones pasan, 0 fallan.**

## v18.0.23 — 31-ago-2026 · UN PUNTO VERDE SOBRE UN «CONTRAINDICADO», Y DOS FÁRMACOS QUE NO EXISTEN

### 1. El punto de «Medicamentos» salía verde «al día» sobre avisos CRÍTICOS

Se calculaba así: `estados.medicamentos = (meds === null || !meds.length) ? "nd" : "ok"`. La
**mera existencia** de fármacos pintaba el punto de verde.

Reproducido con el arnés — enalapril + losartán + espironolactona + ibuprofeno, TFG 45 y
potasio 5,4:

```
avisos+interacciones: 4
por severidad: {"CRITICAL":2,"HIGH":2}
ejemplo: "Espironolactona: CONTRAINDICADA con potasio sérico 5.4 mEq/L (>= 5.0 mEq/L)"

punto de la pestaña HOY: ok  <-- verde «al día»
```

El médico que recorre la tira de pestañas veía **verde en Medicamentos** y no tenía ningún
motivo para abrirla. El estado `pend` (ámbar, «revisar») ya existía y estaba declarado en la
hoja; aquí nadie lo usaba.

El cálculo se **extrajo a `mtrEstadoPuntoMedicamentos`** por dos motivos: dentro del cierre del
render no había forma de que el banco lo ejercitara, y así usa **exactamente el mismo contexto**
que arma la pestaña (misma deduplicación, mismo Cockcroft-Gault, mismo potasio) — si leyeran
datos distintos, volverían a poder discrepar. Devuelve `nd` cuando el motor no puede opinar:
no se afirma «al día» sobre algo que no se pudo revisar.

### 2. «Otros medicamentos: 2» sobre dos fármacos que el paciente no toma

La cifra salía de **restar dos listas deduplicadas con claves distintas**:
`mtrMedicamentosUnicos` conserva la dosis y `mtrMedicamentosRcv` la ignora desde la v17.6.74
—a propósito, para agrupar ROSUVASTATINA 40 con la de 20—. Restar sus longitudes atribuye ese
agrupamiento a «medicamentos que no son del programa».

Un paciente con LOSARTAN 100 y 50 MG, METFORMINA 850 MG y ATORVASTATINA 40 y 20 MG —5
renglones, **3 fármacos, todos cardiovasculares**— veía «Medicamentos del programa
cardiovascular (3)» y debajo «Otros medicamentos: 2».

Es el **mismo defecto que la v17.1.0 ya corrigió una vez en este mismo renglón** (las fórmulas
postfechadas), y que volvió por otra puerta cuando `medsRcv` cambió de clave. Ahora se cuenta
lo que se quiere contar en vez de deducirlo de una resta.

### 3. Una clase que la hoja no declara

El chip del sábado que el médico **sí** trabaja recibía `vgl-agm-pbtn-sabado-mio`; la regla
existe con otro nombre (`…-suyo`). Los dos sábados salían idénticos en pantalla y la única
diferencia era el `title`, que obliga a pasar el ratón chip por chip. El dato tenía dos estados
y la pantalla uno.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 18 | el punto vuelve a salir de la mera existencia de la lista | *el punto de Medicamentos avisa cuando hay avisos CRÍTICOS* (`suite_67`) | Sí — 2.767 |
| 19 | vuelve la resta de listas con claves distintas | *«Otros medicamentos» no inventa fármacos* (`suite_67`) | Sí — 2.767 |
| 20 | la clase del sábado vuelve a desparejarse | *la clase del sábado propio existe en la hoja* (`suite_67`) | Sí — 2.767 |

**Nota de proceso — la mutación 19 destapó la CUARTA prueba hueca del día.** La primera versión
calculaba la cuenta buena *en la propia prueba* (`unicos.filter(...)`) en vez de ejercitar la
línea de producción: al revertir el arreglo seguía verde. Se reescribió llamando a
`mtrFichaVivaFilas`, que es quien arma de verdad ese renglón, y leyendo **lo que el médico
vería en pantalla**.

El patrón de las cuatro es el mismo y conviene dejarlo escrito: **una prueba que reimplementa
la lógica que quiere vigilar no vigila nada.** Tiene que llamar al código de producción.

Banco completo: **2.767 comprobaciones pasan, 0 fallan.**

## v18.0.24 — 1-sep-2026 · EL REPINTADO «BARATO» NO ERA BARATO, Y ADEMÁS SE COMÍA UN AVISO

`refrescarCuentas` es el camino **rápido** del repintado: el que corre en cada vuelta del reloj
cuando la agenda no cambió. Traía dos defectos.

### 1. Coste que crece solo

Llamaba `_noShowPrevia(a.doc_id)` **una vez por tarjeta**, y esa función hace
`localStorage.getItem` + `JSON.parse` del historial **entero**, más un `_vglBuscarPorDoc` que
en el caso de fallo —el paciente sin inasistencias previas, o sea casi todos— recorre el mapa
completo cédula a cédula.

Con 30 tarjetas: **30 lecturas y 30 parses por vuelta**, en el hilo de la interfaz. Y
`vgl_nosh_hist` **no caduca nunca** (lo dice su propio comentario), así que ese mapa crece sin
techo con los meses: el coste por vuelta **aumenta solo**, sin que nadie toque nada.

Se parte en dos: `_noShowPreviaEn(hist, docId)`, que recibe el mapa ya leído, y el envoltorio
`_noShowPrevia` de siempre para los demás llamadores, que no cambian en nada. El historial se
lee **una vez por vuelta**.

### 2. La cuenta regresiva y el badge se confundían

El badge de inasistencias previas es `<span class="vgl-cd vgl-adh">` y vive en
`.vgl-card-time-wrap`, que va **antes** que `.vgl-card-badges-wrap` en el árbol. Cuando la
tarjeta se pintó **sin** cuenta regresiva (faltaba más de hora y media para la cita) y luego
entró en la ventana, `querySelector(".vgl-cd")` devolvía el **badge**: se le sobrescribían
`className`, `title` y `textContent` con los de la cuenta —perdía su `.vgl-adh` y su aviso— y
en la vuelta siguiente se creaba **además** una cuenta nueva. La tarjeta acababa con dos
cuentas y el aviso de inasistencias convertido en un cronómetro congelado.

De paso: `refrescarCuentas` insertaba la cuenta que faltaba en `.vgl-card-badges-wrap`,
mientras `render()` la pinta dentro de `.vgl-card-time-wrap`. **La misma tarjeta se veía de
dos maneras según por qué camino se hubiera pintado.** Ahora las dos vías coinciden.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 21 | el selector vuelve a confundir cuenta y badge | *la cuenta y el badge no se confunden entre sí* (`suite_04`) | Sí — 2.772 |
| 22 | vuelve la lectura del historial por tarjeta | *lee el historial UNA vez por vuelta* (`suite_04`) | Sí — 2.772 |

### Nota: el termómetro, no la fiebre

Al afinar el selector a `.vgl-cd:not(.vgl-adh)`, **dos pruebas existentes de `suite_15` se
pusieron rojas**. No era una regresión: el DOM falso de esa suite es un stub memoizado **por
cadena de selector**, con un nodo por selector, y `:not(...)` le creaba un nodo distinto.

La tentación era bajar producción a un selector más pobre para que el simulador lo entendiera.
Se hizo al revés: **el stub normaliza `:not(...)`**, porque en ese mundo falso `.vgl-cd` y
`.vgl-cd:not(.vgl-adh)` designan la misma cosa. Doblar el código de producción para complacer
al banco es arreglar el termómetro en vez de la fiebre — y habría dejado el defecto vivo en la
pantalla del médico, que es donde importa.

También se anotó, dentro de las dos comprobaciones de fuente, el filtro de comentarios que ya
hizo falta en la v18.0.22: los comentarios que explican un arreglo citan los selectores
literalmente, así que un barrido sobre el texto crudo los encuentra siempre y pasa aunque el
código vuelva atrás. Segunda vez el mismo día; por eso el filtro se escribe una vez y se
comparte.

Banco completo: **2.772 comprobaciones pasan, 0 fallan.**

## v18.0.25 — 1-sep-2026 · LA TACHADURA DE NOMBRES DESTROZABA EL TEXTO CLÍNICO

Implementa una **decisión expresa del médico**, y cierra el defecto del que dependía la parte
que la v18.0.15 dejó declarada como abierta.

### El defecto

`mtrHcTachaduras` admitía todo token del nombre de longitud ≥ 3, y `mtrHcTachar` construía
`new RegExp(esc, "gi")` **sin límites de palabra**: esas letras se tachaban dentro de cualquier
palabra clínica. Medido con el arnés, tachando «ANA» sobre un texto normal de consulta:

```
"Paciente refiere MAREO y ANASARCA. ANAMNESIS completa. Control en una SEMANA. ANALISIS y plan."
      ->  "MAREO y [CENSURADO]SARCA. [CENSURADO]MNESIS completa. … SEM[CENSURADO]. [CENSURADO]LISIS y plan."
```

Y «MAR» convierte MAREO en `[CENSURADO]EO`. **El síntoma desaparece del contexto** y el modelo
redacta la Enfermedad Actual sin él, o con la palabra rota. Nombres cortos y frecuentes aquí
—ANA, MAR, LUZ, PAZ, CRUZ, MORA, LEÓN— entran de lleno.

### La decisión

Del médico, textual: **«Solo palabras completas, y mínimo 4 letras»**, sobre la regla que él
mismo había fijado antes: *«solo se sanitiza hasta donde sea seguro para mi proyecto y
grounding. si va a romper el código entonces no se aplica en ese caso»*.

**Coste aceptado y declarado:** un componente de **tres** letras ya no se tacha por identidad.
Lo que tiene **forma** —cédula, celular, correo, fechas— lo sigue tachando `scrubPII` aparte.
Lo que se pierde es la tachadura por identidad de los componentes cortos; lo que se gana es que
el texto clínico llegue entero. Él eligió el grounding, y queda escrito quién lo eligió.

El límite es el **mismo** que ya usaba `mtrSanearTextoLibreAI`, con la misma clase de letras
españolas: si las dos defensas del módulo discreparan, una tacharía lo que la otra deja pasar.

### Lo que desbloquea

La v18.0.15 dejó anotado que el nombre propio seguía pasando por la vía de la cosecha del DOM,
y que cerrarlo **dependía de este defecto** (no se podía aplicar `mtrHcTachar` ahí sin destrozar
el grounding). Con el límite de palabra, esa puerta queda técnicamente abierta; sigue faltando
decidir de dónde sale el nombre del paciente en esa vía, que es lo que la v18.0.15 declaró.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 23 | vuelve la tachadura por subcadena | *el límite es de PALABRA, no de subcadena* y *las dos defensas usan el MISMO límite* (`suite_57`) | Sí — 2.777 |
| 24 | vuelve el mínimo de 3 letras | *mtrHcTachaduras exige 4 letras* (`suite_57`) | Sí — 2.777 |

Las pruebas fijan **las dos direcciones**: que no se pase de frenada (ROSACEA, LEONINA,
CRUZADO siguen enteras) y que no se quede corta (un apellido de 4+ letras que aparece como
palabra suelta se sigue tachando). Una defensa que solo se comprueba por un lado acaba siendo
la que destruye el dato o la que lo deja salir.

Banco completo: **2.777 comprobaciones pasan, 0 fallan.**

## v18.0.26 — 1-sep-2026 · UNA FALLA TERAPÉUTICA QUE NUNCA OCURRIÓ, Y UNA CASILLA ESCRITA A ESCONDIDAS

### 1. «No evaluable» se convertía en «FALLA PARCIAL», y eso acaba firmado

El comentario de `mtrEvaluarMetaLdl` **ya lo decía**: *«devuelve un objeto explícito en vez de
un booleano, porque no evaluable por falta de LDL basal no es lo mismo que no está en meta»*.
El código no lo cumplía: `cumpleReduccion` colapsaba `reduccion === null` a `false`, igual que
una reducción **medida** e insuficiente.

El caso es el del **paciente nuevo**, que es lo normal: `mtrLdlBasalDeSerie` devuelve `null`
cuando la serie tiene menos de dos puntos. Medido:

| paciente | antes | ahora |
|---|---|---|
| MUY ALTO, LDL 45 (meta <55), **sin** LDL previo | `meta_parcial` → **«FALLA PARCIAL»** | `en_meta_reduccion_no_evaluable` → «EN META (reducción no evaluable: falta LDL previo)» |
| MUY ALTO, LDL 45, basal 120 (−62,5 %) | «EN META» | «EN META» |
| MUY ALTO, LDL 45, basal 60 (−25 %, corta) | «FALLA PARCIAL» | **«FALLA PARCIAL»** — la falla real sigue siendo falla |
| MUY ALTO, LDL 90, sin basal | «FUERA DE META» | «FUERA DE META» |
| MODERADO, LDL 90 (no exige reducción) | «EN META» | «EN META» |

Ese texto viaja al JSON que alimenta la nota clínica de la IA **y al registro permanente del
paciente**: la historia que el médico **firma** decía falla terapéutica parcial de alguien que
está en meta, y lo único que faltaba era el laboratorio anterior.

`reduccionEvaluable` viaja aparte para que ningún consumidor tenga que deducirlo del texto, y
`enMeta` incluye el estado nuevo: el LDL bajo meta **es un hecho medido**; lo que no se pudo
evaluar es la reducción.

Es **otro comentario que prometía una red que no existía** — el mismo patrón que costó dos
defectos en la v18.0.13 y uno en la v18.0.19.

**Comprobado que no rompe el corpus dorado**: el banco completo, con los 991 vectores de
`suite_45`, sigue en verde.

### 2. Se escribía en una casilla deshabilitada, sin contarlo ni poder deshacerlo

`_vglMarcarRadio` hacía `el.click()`, `el.checked = true` y despachaba un `change` hacia
Angular **antes** de llegar a su `if (el.disabled === true) return false`. Devolvía `false`, el
llamador hacía `pares.pop()`, y salía el peor de los tres mundos a la vez:

- la casilla quedaba **marcada** en pantalla, con su evento ya emitido hacia Everest;
- **fuera de la foto de «Deshacer»**, así que no había forma de revertirla;
- `escritas` seguía en 0 y el toast decía «No había ninguna casilla que llenar en esta
  pantalla».

Se escribía en la historia del paciente **sin contarlo, sin avisarlo y sin poder deshacerlo**
— las tres cosas que la regla de la casilla existe para impedir. La guarda se sube al
principio: lo que está deshabilitado no se toca.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 25 | la guarda de `disabled` vuelve abajo, después de escribir | *una casilla deshabilitada no se toca* (`suite_32`) | Sí — 2.783 |
| 26 | «no evaluable» vuelve a colapsar en falla | *sin LDL previo, un paciente bajo meta NO se declara en falla* (`suite_45`) | Sí — 2.783 |

Banco completo: **2.783 comprobaciones pasan, 0 fallan.**

## v18.0.27 — 1-sep-2026 · UN SMS CITANDO A UNA AGENDA QUE NO EXISTE, Y UN FALLO DEL SISTEMA PRESENTADO COMO HUECO DEL PACIENTE

### 1. El aborto que el comentario de v11.0.1 afirma que existe, escrito de verdad

Ese comentario dice, textualmente:

> *«Sin valores fabricados: el "07:00:00" y sobre todo el agendaId "282531" estaban cableados,
> de modo que un turno sin datos habría citado al paciente en una agenda arbitraria. Ahora, si
> falta cualquiera de los dos, **se aborta**.»*

**No había ningún aborto.** Si el turno de `ObtenerTurnosPorFecha` no trae `AgendaId` /
`agendaId` / `id` —el escenario que el propio comentario dice cubrir, y que **ya ocurrió una
vez** con `hora`/`Hora` en la v12.3.31, cuando AppCita renombró un campo— `agendaId` quedaba
`undefined` y se interpolaba tal cual en la URL:

```
…/AgendarCita?…&AgendaId=undefined&…
```

Se hacía **la escritura real** contra AppCita. Si AppCita respondía 200 con `error:false`, el
script daba la cita por creada, devolvía `{ok:true}` y **además le mandaba al paciente un SMS
citándolo** a una toma cuya agenda no existe. El paciente se presenta al laboratorio y no hay
cita.

**Cuarto comentario de esta jornada que promete una red que no está** (v18.0.13 ×2, v18.0.19,
v18.0.26). Aquí la red se escribe, y con la prueba que la ejercita de verdad: la red simulada
confirma que **no se llega a `AgendarCita`** y que ninguna URL lleva `AgendaId=undefined`.

### 2. «Framingham oficial: faltan sexo», con el sexo delante

`mtrFraminghamEverest` exige exactamente `"M"` o `"F"`. Cuando la demografía de la API no trae
un sexo reconocible, `mtrResumenDesdeModalLabs` cae al respaldo de la cabecera (v17.6.85), que
devuelve la **palabra completa**: «Sexo: MASCULINO». Ese valor crudo llegaba al motor:

```
sexo="MASCULINO"  ->  puntos=null  faltantes=["sexo", …]
sexo="M"          ->  puntos=…     (funciona)
```

Y la cabecera de riesgo pintaba «Framingham oficial: **faltan sexo**» **en el mismo recuadro**
donde la TFG ya se había calculado **con ese mismo sexo**. Un fallo del sistema presentado al
médico como un hueco del paciente — y el puntaje predicho del formulario oficial no se
calculaba nunca para ese paciente.

Los normalizadores ya existían (`mtrEsSexoFemenino` / `mtrEsSexoMasculino`) y son los que usa
el resto del motor: aquí simplemente **no se llamaban**. Cuando el sexo de verdad no se sabe
(`""`, `null`, `"X"`), se sigue declarando faltante: no se sobre-corrigió hasta inventarlo.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 27 | se quita el aborto por `AgendaId` ausente | *un turno sin AgendaId aborta — no se escribe en AppCita ni se cita al paciente* (`suite_33`) | Sí — 2.788 |
| 28 | el sexo vuelve a pasarse crudo | *el llamador del Framingham normaliza el sexo antes de pasarlo* (`suite_55`) | Sí — 2.788 |

**Nota de método.** La prueba del Framingham incluye a propósito una comprobación del **cable**
—que el llamador normalice— además de las de conducta. Sin ella, las otras dos comprobarían los
normalizadores, *que ya funcionaban*, y no el defecto, que era que **nadie los llamaba en ese
punto**. Es la lección de las cuatro pruebas huecas del 31-ago, aplicada por adelantado.

Y una cara nueva de esa misma lección: la primera versión de esa comprobación recortaba 900
caracteres del archivo desde el llamador, y la nota que explica el arreglo ocupa más de mil —
el recorte se quedaba **entero dentro del comentario** y no veía una sola línea de código. La
ventana se toma ahora sobre el código ya despojado de comentarios.

Banco completo: **2.788 comprobaciones pasan, 0 fallan.**

## v18.0.28 — 1-sep-2026 · UNA INTERPOLACIÓN VIVA DENTRO DE UN COMENTARIO SE EJECUTA IGUAL

Tercer miembro de la misma **familia de frontera JS/plantilla**, y el más silencioso de los
tres:

| regla | qué caza |
|---|---|
| **H** (v18.0.6) | un `//` escrito dentro de una plantilla no comenta: se **pinta** en pantalla |
| **Q** (v18.0.14) | un `*/` dentro de un comentario CSS lo cierra antes de tiempo y el analizador **se come la regla siguiente** |
| **J** (esta) | un `${…}` dentro de un comentario de bloque **sí se evalúa** |

### El caso

Dentro de `MTR_RCV_CSS` se escribió el nombre de la expresión que inserta ese CSS **como si
fuera una interpolación**. Al motor de JavaScript el comentario CSS no le dice nada: la
plantilla es una plantilla y la interpolación corre al inicializar la constante. La flecha leía
`MTR_RCV_CSS` **todavía en su zona muerta temporal**, lanzaba `ReferenceError`, y `_cssSeguro`
se lo tragaba devolviendo `""`. El comentario entregado al navegador quedaba como
«…splicea **(**, invisible…».

Reproducido en aislamiento con el mismo `_cssSeguro`:

```
lo que queda en el comentario entregado al navegador: ""
```

### El filo, que es lo que lo hace grave

Esto **solo no tumba el arranque** porque `_cssSeguro` es una declaración de tipo `function`,
que está hoisted. El día que alguien la convierta en `const` o en una arrow declarada más
abajo, **el archivo entero deja de evaluarse en la carga** — comprobado en aislamiento:

```
ReferenceError: el archivo ENTERO dejaría de evaluarse en la carga
```

Un userscript que no evalúa es un Centinela que no existe, en mitad de una consulta.

### Nota honesta

Al escribir el arreglo **cometí este mismo defecto dentro del comentario que lo explica** —puse
el ejemplo con su dólar y sus llaves— y el `node --check` lo cazó al instante. Por eso la
Regla J mira el archivo entero y no solo el sitio conocido: el patrón es fácil de reintroducir
justo al documentarlo.

### Mutación verificada

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 29 | vuelve la interpolación viva en el comentario CSS | *Regla J — ningún comentario de bloque contiene una interpolación viva* (`suite_72`) | Sí — 2.789 |

Banco completo: **2.789 comprobaciones pasan, 0 fallan.**

## v18.0.29 — 1-sep-2026 · EL AUTO-LOGIN DE ATHENEA LLEVABA ROTO DESDE SIEMPRE, Y LA CONSOLA DECÍA LO CONTRARIO

### El defecto

`ATH_CRED_KEY` y `atheneaLoginBloqueado` se declaraban **1.340 líneas por debajo** del bloque
de Athenea, y ese bloque hace `return` al terminar. En la web de Athenea el hilo **sale del
ámbito antes de evaluarlas**, así que quedaban en su **zona muerta temporal para siempre** en
esa página.

`atheneaCredsSet` / `atheneaCredsGet` sí existen —son declaraciones de tipo `function`,
izadas— pero al tocar `ATH_CRED_KEY` lanzaban `ReferenceError`, que **sus propios try/catch se
tragaban** devolviendo `false`/`null`. Reproducido en aislamiento:

```
dentro del bloque que hace return temprano:      false
tras evaluar el const, ya fuera de ese camino:   "valor:vgl_ath_creds"
```

Resultado en el consultorio: el médico teclea usuario y contraseña en Athenea, el script los
captura, **el guardado falla siempre**, y la consola imprime igual «Credenciales capturadas y
guardadas para auto-login permanente». El auto-login nunca funcionó, y nada lo decía.

**Un fallo del sistema presentado como un hecho** — el mismo patrón del Framingham (v18.0.27) y
del aviso de ceguera (v18.0.17). Y la **tercera zona muerta temporal** de la jornada, con la de
`MTR_CSS` que la flota reporta 771 veces (ya resuelta en ramas v17+) y la del comentario de
`MTR_RCV_CSS` (v18.0.28).

### El arreglo, en tres partes

1. Las dos declaraciones suben por encima del bloque de Athenea.
2. El mensaje se condiciona al **resultado**: si el guardado falla, sale un `console.warn`
   diciendo que el auto-login no funcionará.
3. Queda anotado en el sitio de donde se movieron, para que nadie las devuelva.

### Por qué la prueba es de código fuente, y se dice

El arnés carga el script con hostname de **Everest**, no de Athenea, así que **ese camino —el
único donde el defecto se manifiesta— no se recorre nunca en el banco**. Una prueba de conducta
aquí daría verde con el defecto puesto. Lo que hay que fijar es el **orden de declaración**, y
eso se vigila sobre el fuente: `const ATH_CRED_KEY` debe aparecer antes que el `if` del
hostname de Athenea.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 30 | las declaraciones vuelven abajo (zona muerta) | *ATH_CRED_KEY se declara ANTES del bloque de Athenea* (`suite_37`) | Sí — 2.791 |
| 31 | el mensaje vuelve a imprimirse siempre | *el mensaje depende del resultado* (`suite_37`) | Sí — 2.791 |

Banco completo: **2.791 comprobaciones pasan, 0 fallan.**

---

## v18.0.30 — Auto-Labs: un «Deshacer» que borraba el lote ANTERIOR, y una rama muda

Tres hallazgos del mismo módulo (el botón «🧪 Exámenes») y de la misma familia: el asistente
decía —o callaba— cosas que no se correspondían con lo que había hecho.

### 1. El «↩ Deshacer» borraba trabajo ya aceptado (el grave)

Tras un llenado que escribía **cero casillas**, el ofrecimiento de deshacer salía igual. Con
`count = 0` **no se guarda lote nuevo** (`_vglGuardarDeshacer` sale en seco si no hay pares),
así que la única ranura de deshacer seguía conteniendo **el lote anterior** — el examen físico
que el médico ya había aceptado un minuto antes. Y la guarda de `_vglEjecutarDeshacer` solo
comprueba que sea **el mismo paciente**, no que sea el mismo lote: no lo impedía.

Es decir: el botón aparecía pegado al mensaje «✋ no toqué nada» y, al pulsarlo, deshacía otra
cosa. Pasaba en las **dos** ramas de Auto-Labs (la principal y la del reintento tras el
auto-inicio de sesión). Ahora cada una comprueba su propia escritura antes de ofrecerlo.

### 2. Con el llenado desactivado, la rama era muda del todo

`_vglFeedbackBoton` escribe el aviso EN el botón y lo deja 8 s; la línea de al lado
(`btn.innerHTML = "🧪 Exámenes";`) se lo borraba **en el mismo tick**, y esa rama tampoco tenía
aviso flotante. El médico pulsaba Exámenes, no veía pasar nada y se quedaba creyendo que el
laboratorio no tenía resultados. Se quita el borrado y se añade el aviso que faltaba. El mismo
borrado en la rama de «cambió el paciente» se quita también (allí el toast sí existía, pero el
mensaje del botón duraba cero milisegundos).

### 3. En el reintento, «no pude leer» seguía diciéndose como «no tiene»

La v17.6.58 separó `labs === null` (fallo de lectura) de `labs === []` (el paciente de verdad no
tiene) en la rama principal. A la rama del **reintento** se le quedó sin aplicar: los dos casos
mostraban «Sin resultados en el laboratorio para este paciente». Un fallo de red presentado como
un hecho clínico verificado. De paso, esa rama cantaba «✓ N casillas escritas» en **verde**
aunque N fuera 0 — el mismo hallazgo que la v17.8.1 ya había arreglado en la principal.

### Las pruebas son de conducta, y donde no pueden serlo se dice

Los casos 1 y 2 se prueban **de punta a punta**: el contexto nuevo completa la cadena de 3 pasos
de Athenea (`BusquedaPaciente → BuscarPaciente → DatosPaciente → consultaDetalleSolicitud`), así
que `getAtheneaLabsAuto` devuelve un analito real y el flujo entra en la rama «hay laboratorios»
— que hasta ahora **nadie recorría entera en el banco**. Como el documento falso no tiene
casillas `input[id^="resultado"]`, se escriben 0: exactamente el escenario del defecto.

Dos detalles del arnés obligaron a instrumentar en vez de mirar el DOM al final:

- **capa todo `setTimeout` a 1 ms**, así que el rótulo vuelve y el «Deshacer» se retira casi en
  el mismo instante en que aparecen. Se graba lo que **pasó** (cada texto escrito en el botón,
  cada nodo colgado del body), no lo que queda.
- **`_renderToast` reparte el cuerpo con `querySelector` interno** que el DOM pelado no resuelve:
  sin `enriquecerDom`, el aviso se pierde en el try/catch y la prueba diría «mudo» tanto con el
  arreglo puesto como sin él.

La rama del **reintento** pediría un mock con estado que simule el login real de Athenea; se fija
por código fuente, acotado a `_ejecutarLlenadoExamenes`, y la propia prueba lo dice.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 32 | vuelve el borrado del aviso del kill-switch (y se calla el toast) | *con el llenado desactivado el aviso se queda a la vista* (`suite_15`) | Sí — 2.794 |
| 33 | solo se quita el aviso flotante del kill-switch | *(la misma)* — el toast por sí solo ya la sostiene | Sí — 2.794 |
| 34 | el «Deshacer» vuelve a ofrecerse tras escribir 0 casillas (rama principal) | *tras escribir CERO casillas no se ofrece «↩ Deshacer»* + la de fuente (`suite_15`) | Sí — 2.794 |
| 35 | el «Deshacer» vuelve a ofrecerse sin escritura en el reintento | *en el reintento, ni «Deshacer» sin escritura ni «no tiene» cuando no se pudo leer* (`suite_15`) | Sí — 2.794 |
| 36 | el reintento vuelve a decir «no tiene» cuando no pudo leer | *(la misma)* | Sí — 2.794 |
| 37 | el reintento vuelve a cantar verde con cero casillas | *(la misma)* | Sí — 2.794 |

Banco completo: **2.794 comprobaciones pasan, 0 fallan.**

---

## v18.0.31 — Seis nombres del hemograma se llevaban la casilla de la hemoglobina

Hallazgo (C) del frente de laboratorios. `«HEMOGLOBINA»` casa por **subcadena**, y el hemograma
trae varios nombres que la contienen. Reproducido con el arnés **antes de tocar nada**, contra el
archivo vivo:

```
nombre                                             | casa con
HEMOGLOBINA                                        | HEMOGLOBINA
HEMOGLOBINA CORPUSCULAR MEDIA                      | HEMOGLOBINA   <- HCM, en pg
CONCENTRACION DE HEMOGLOBINA CORPUSCULAR MEDIA     | HEMOGLOBINA   <- CHCM, en g/dL
HEMOGLOBINA GLOBULAR MEDIA                         | HEMOGLOBINA
HEMOGLOBINA A1C                                    | HEMOGLOBINA   <- la glicosilada, en %
HEMOGLOBINA FETAL                                  | HEMOGLOBINA
```

Los tres del panel son **numéricos y de la misma fecha**, así que `_nuevoReemplazaCandidato`
empata y gana **el primero que Athenea devuelva**: qué cifra acaba escrita en la historia lo
decidía el orden de las filas, no la clínica. Una anemia de 9,8 podía quedar documentada como
**30,2** (el HCM); una A1c de 7,2, como una anemia severa que el paciente no tiene.

Mismo patrón de exclusión que ya protege a `CREATININA` (v11.0.1) y a `COLESTEROL_LDL`
(v14.2.10). Los CUPS exactos (2034/902207) siguen mandando sobre el nombre, así que ningún
examen legítimo se pierde; y un nombre raro que hoy caía por error queda **sin casar** —
casilla vacía antes que dato inventado.

### Y la fragilidad de mis propias pruebas de la v18.0.30

Las dos pruebas de conducta de la v18.0.30 esperaban **40 ms fijos** a que terminara la cadena
async de Athenea. Eso las hacía depender de la carga de la máquina: con el banco corriendo en
paralelo (o con Chromium al lado) se ponen rojas sin que haya regresión ninguna — que es
exactamente lo que un revisor externo observó y reportó como «el banco no es determinista».
**Medido: cinco corridas seguidas del banco completo, todas 2.794/0.** El banco sí es
determinista; lo frágil era la espera. Se cambia por esperar **a que pase lo que se mide**
(`esperarA(cond, 5000)`), con tope generoso. No es un cambio de conducta del script, así que no
lleva mutación propia: lo que fija esas dos pruebas siguen siendo las mutaciones 32–37.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 38 | se quita la exclusión entera (vuelve el defecto) | *los índices del hemograma NO se llevan la casilla de hemoglobina sérica* (`suite_08`) | Sí — 2.795 |
| 39 | solo se quita `CORPUSCULAR` (el HCM vuelve a robar la casilla) | *(la misma)* | Sí — 2.795 |
| 40 | solo se quita `A1C` (la glicosilada vuelve a la casilla de hemoglobina) | *(la misma)* | Sí — 2.795 |
| 41 | la exclusión se pasa de rosca y se come la hemoglobina de verdad | *(la misma)* **+ una prueba vieja de la suite** | Sí — 2.795 |

La mutación 41 es la contrapartida deliberada: una guarda que se «arregla» excluyéndolo todo
también tiene que ponerse roja, o la prueba solo vigilaría una dirección.

Banco completo: **2.795 comprobaciones pasan, 0 fallan.**

---

## v18.0.32 — El parcial de orina: dos defectos independientes, los dos cerrando el caso sin urocultivo

Hallazgos (A) `L1496` y (B) `L39755` del barrido. **No son el mismo defecto visto dos veces:**
arreglar uno dejaba el otro en pie, y cada uno por su cuenta bastaba para que un parcial
infeccioso saliera rotulado como normal. Reproducidos con el arnés **antes de tocar nada**.

### (A) El agrupador tiraba el ancla de panel

`_agruparUroanalisisParaTabla` comprimía cada fila a `{nombre, resultado}` y descartaba
`NombreParametroPadre`. Aguas abajo, `mtrHallazgosUroDesdeLabs` exige `_esAnalitoDeOrina(lab)`,
que sin padre cae al respaldo **por nombre** — y ese respaldo, **a propósito** (v12.3.37), no
reconoce `LEUCOCITOS`/`HEMATIES`/`SANGRE`, porque esos nombres también existen en el hemograma
en sangre. Medido:

```
CRUDO       hallazgos: {"esterasa":"PRESENTE","leucocitos":999,"nitritos":"NEGATIVO"}
COMPRIMIDO  hallazgos: {"esterasa":"PRESENTE","nitritos":"NEGATIVO"}      <- se pierde la piuria
COMPRIMIDO  _resumenClinicoUro: {"esPatologico":false, ...}               -> «Sin hallazgos patológicos (Normal)»
```

No se arregla relajando `_esAnalitoDeOrina` para que reconozca esos nombres: eso reintroduce el
bug que el comentario de la v12.3.37 prohíbe. Se conserva el dato real, no se amplía la
heurística.

### (B) Una esterasa en cruces CON número se contaba como recuento de leucocitos

`mtrUroRecuento("3+")` devuelve 3, y la guarda vieja solo reconocía la cruz pelada (`/^[+-]+$/`).
Una esterasa `3+` entraba al campo del **recuento** como «3 leucocitos por campo»: por debajo del
umbral de piuria (10) y, peor, **afirmando un conteo normal que nadie midió**.

```
informe típico: tira LEUCOCITOS «3+» + sedimento «15-20» x campo + NITRITOS negativo
ANTES:   {"leucocitos":20,"nitritos":"NEGATIVO"}   -> SIN HALLAZGOS
                                                      «no se pide urocultivo por este resultado»
DESPUÉS: {"esterasa":"3+","leucocitos":20,...}     -> REQUIERE SÍNTOMAS
                                                      «confirme síntomas antes de ordenar urocultivo»
```

Bordes verificados intactos: `20+`, `100+` y `MAYOR A 100` siguen siendo **recuentos** (son cotas
de conteo, no cruces); `0` sigue siendo 0; el negativo pelado sigue yendo a esterasa. El regex va
**anclado** a propósito: desanclarlo cambia este defecto por el contrario.

### (A-bis) Una mutación destapó un hueco en mi propio arreglo

**M2 no puso roja a nadie.** Conservar el ancla de panel pero mandar al motor el valor **de
pantalla** (`"—"`, que es relleno visual para la tabla) hacía que `esValorReal` lo aceptara —solo
rechaza vacío, `PENDIENTE` e `idEstado 1`— y el motor se inventaba un hallazgo sobre un paciente
**sin parcial de orina**:

```
hallazgos:  {"nitritos":"—","esterasa":"—"}
evaluación: CONFIRMAR — «Hay valores que el asistente no pudo interpretar (nitritos: —;
            esterasa leucocitaria: —). Revíselos a mano en el parcial y decida.»
```

El valor **crudo** viaja aparte del de pantalla. Prueba añadida y M2 repetida: ahora sí cae.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 42 | el agrupador vuelve a tirar el ancla de panel | *el bloque agrupado NO pierde la piuria* (`suite_51`) | Sí — 2.799 |
| 43 | el agrupador manda el «—» de pantalla al motor | **primero NO cayó nadie** → prueba nueva *(A-bis)* → repetida y cae | Sí — 2.799 |
| 44 | vuelve la guarda vieja: solo la cruz pelada | *(B)* + *(B de punta a punta)* (`suite_51`) | Sí — 2.799 |
| 45 | el regex se pasa de rosca y se come «20+»/«100+» | *(B)* — los recuentos de verdad siguen siéndolo | Sí — 2.799 |
| 46 | el regex se desancla (una cruz en medio de otra cosa cuenta) | *(B)* | Sí — 2.799 |

Las mutaciones 45 y 46 van en la **dirección contraria** a propósito: un arreglo que solo se
vigila en un sentido no está vigilado.

Banco completo: **2.799 comprobaciones pasan, 0 fallan.**

---

## v18.0.33 — «Utiliza cifras incorrectas de PA, peso, etc.»: el Panel firmaba con la tensión de otro

Reporte del médico en consulta. Hallazgo `L22392` del barrido, confirmado por el enjambre del
01-sep como **el de la queja**. Reproducido con el arnés antes de tocar nada.

### La causa: cuatro lectores, una sola guarda

De los cinco datos antropométricos que el Panel mete en el resumen, **solo uno** llevaba guarda
de identidad:

| dato | lector | guarda |
|---|---|---|
| IMC / factores | `mtrLeerFactoresRcvDelDom(docId, doc)` | **sí** — `_pacienteSigueAbierto` |
| PA | `mtrLeerTensionDelDom(document)` | no — ids globales |
| Peso | `mtrLeerPesoDelDom(document)` | no — `id="peso"` |
| Cintura | `mtrLeerCinturaDelDom(document)` | no — por rótulo |

Y un `|| {}` convertía la **negativa** del único protegido («en pantalla hay otro paciente, no
leo») en «no hay factores», con lo que los otros tres entraban igual:

```
A) resumen de A recién cacheado:   {"imc":24,"paSistolica":118,"paDiastolica":72,"pesoKg":68,"cinturaCm":86}
   pantalla ahora = paciente B     PA 186/114 · peso 103 · cintura 121
B) DESPUÉS de abrir el Panel de A con B en pantalla, BAJO LA CÉDULA DE A:
   {"imc":24,"paSistolica":186,"paDiastolica":114,"pesoKg":103,"cinturaCm":121}
   línea que se le manda a la IA:
   >> Signos vitales: PA 186/114 mmHg · peso 103 kg · IMC 24 · circunferencia abdominal 121 cm
```

La huella que el médico veía en pantalla era esa línea **internamente incoherente**: el IMC era
el suyo (único protegido) y los otros tres, los del paciente de al lado. Y se **regrababa en la
caché** de A, de donde la leen después el Panel y el Redactor IA.

### El arreglo

`mtrPanelFactoresDePantalla(docId, doc)` — función **nombrada**, y por tanto ejecutable desde el
banco: lee **todo o nada**. Los dos sitios (al abrir y el repaso de 20 s) pasan por ella. Cuando
se niega, el Panel **lo dice** en su propio aviso, no en un cartel flotante más.

El tick de 20 s ya estaba protegido *de rebote* (`_tableroFirmaDom` devuelve `""` y el `return`
de arriba corta), pero era un efecto colateral, no una guarda. Se hace explícita.

### La prueba vieja que se puso roja, y por qué se cambió y no se revirtió

`suite_46` fijaba **por texto fuente** las dos líneas de la cintura que este refactor movió. La
intención («la cintura se lee en los cuatro sitios») sigue viva, así que se actualizó la prueba
— y se **subió de nivel**: la función nueva sí se puede ejecutar, y la conducta real se fija
ahora en `suite_63`. Cambiar una comprobación de texto por una de conducta es siempre una
mejora; al revés, nunca.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 47 | la función deja de negarse con otro paciente | *cruce de pacientes* + *sin cédula legible* (`suite_63`) | Sí — 2.803 |
| 48 | `\|\| {}` en el sitio de abrir **y** `if (true)` | **primero NO cayó nadie** → prueba reforzada → repetida y cae | Sí — 2.803 |
| 49 | la cintura se cae de la función con guarda | *CABLEADO* (`suite_46`) + *contrapartida* (`suite_63`) | Sí — 2.803 |
| 50 | el repaso de 20 s vuelve a leer sin guarda | *CABLEADO* (`suite_46`) | Sí — 2.803 |
| 51 | el Panel se calla | *y no se calla* (`suite_63`) | Sí — 2.803 |
| 52 | la guarda se pasa de rosca y devuelve null siempre | *contrapartida* (`suite_63`) | Sí — 2.803 |

**La 48 merece leerse dos veces.** Mi prueba del aviso miraba el fuente y comprobaba que el
MENSAJE existiera. La mutación dejó el mensaje intacto y volvió su rama **inalcanzable**
(`if (true)`): el texto seguía escrito, muerto, y la prueba pasaba en verde. Es la sexta forma
de prueba hueca de la jornada, y la más sutil: *comprobar que algo existe no comprueba que
pueda llegar a ocurrir*. La prueba ahora fija la FORMA del condicional.

Banco completo: **2.803 comprobaciones pasan, 0 fallan.**

---

## v18.0.34 — El mismo cruce, en el agendamiento; y una regla que destapó un tercer sitio

Hallazgo `L23432` del barrido, hermano del que cerró la v18.0.33. Reproducido con el arnés
antes de tocar nada:

```
A) resumen de A recién cacheado:                PA 118/72
   ¿mtrCacheResumenLeer devuelve la MISMA referencia?  true
B) en pantalla ahora: paciente 222222 con PA    186/114
   ¿el paciente A sigue abierto?                false      <-- el script YA lo sabía
C) DESPUÉS de abrir el agendamiento de A con B en pantalla:
   PA cacheada BAJO LA CÉDULA DE A:             186/114
   línea que se le manda a la IA para A:        Signos vitales: PA 186/114 mmHg · peso 68 kg
```

**Dos defectos en cuatro líneas.** El triaje que decide la franja horaria leía
`mtrLeerTensionDelDom(document)` —ids globales, sin guarda de identidad— y, peor, asignaba el
resultado sobre `resumenClin.factores`, siendo `resumenClin` la **referencia viva** que devuelve
`mtrCacheResumenLeer`. La cifra de otro paciente quedaba escrita en la caché de este, y de ahí
la leen el Panel y el Redactor IA.

### La regla de familia, y el tercer sitio que apareció al escribirla

En vez de un segundo parche puntual, `suite_37` gana una **regresión estructural**: para cada
variable declarada a partir de `mtrCacheResumenLeer(...)`, ninguna línea de su bloque puede
asignarle una propiedad. Censo: **14 sitios de lectura, 0 escrituras**.

Al ejecutarla por primera vez encontró **un tercer sitio que nadie había reportado**: el
refresco de medicamentos del widget de Fármacos (`resumen.medicamentos = lista`). Ahí la
identidad sí estaba garantizada —`mtrCacheResumenLeer(docId)` devuelve null si la caché es de
otro—, pero mutar en sitio tiene su propio precio: quien tenga una referencia a ese objeto (el
Redactor guarda la suya al abrirse) ve cambiar la lista por debajo, y su hoja de hechos queda
desincronizada de su propio resumen. Pasa a copia.

La regla se acompaña de una prueba de conducta que **demuestra su premisa** (dos lecturas
devuelven el mismo objeto, y escribirle encima queda en la caché). Sin ella, la regla sería una
manía de estilo; con ella, es la consecuencia de un hecho medido.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 53 | vuelve la lectura de tensión sin guarda | *el agendamiento no lee sin comprobar de quién es* | Sí — 2.806 |
| 54 | vuelve la escritura dentro del resumen cacheado | *regla de familia* **+** *el agendamiento…* (las dos) | Sí — 2.806 |
| 55 | vuelve la escritura en sitio del widget de Fármacos | *regla de familia* | Sí — 2.806 |
| 56 | la caché pasa a CLONAR al leer | *la premisa de esa regla es real* | Sí — 2.806 |

La **56 es la que le da sentido a la regla**: si algún día `mtrCacheResumenLeer` empezara a
clonar, la prohibición dejaría de tener motivo — y la prueba de la premisa cae para avisarlo,
en vez de dejar una regla huérfana que nadie sabe por qué existe.

Banco completo: **2.806 comprobaciones pasan, 0 fallan.**

---

## v18.0.35 — El Redactor: lo que el médico escribe llega entero, y deja de salirle en rojo

Reporte en consulta: *«no está teniendo muy en cuenta lo que yo escribo en el cuadro de texto
antes de generar y no entiende los contextos anteriores que yo pego»*. Tres defectos distintos
detrás de esa frase, los tres del enjambre del 01-sep.

### 1. El corte en seco a 800 caracteres

`slice(0, 800)`, sin aviso a nadie. Medido con una nota de control anterior pegada de **1.339
caracteres**: llegaban 800 y se perdían 539, con el corte cayendo a mitad de palabra. Y lo que
se pierde suele ser **la instrucción**, porque uno la escribe al final.

El tope sube a 6.000 y el corte, cuando toca, se hace por **ítem completo** —la misma función
que ya usa el ancla del control anterior desde la v17.0.1, por este mismo motivo—. La pregunta
del modo «Preguntar» sube de 300 a 2.000: una pregunta clínica con contexto no cabe en 300.

### 2. El rótulo del bloque contemplaba solo la mitad de lo que trae

Se llamaba «INSTRUCCIONES DEL MÉDICO PARA ESTA REDACCIÓN». Pero por ese mismo cuadro el médico
pega el control anterior entero, que son **datos**, no una orden de estilo — así que una nota
pegada se leía como instrucción.

Pasa a **LO QUE EL MÉDICO ESCRIBIÓ O PEGÓ PARA ESTA NOTA**, con la decisión del médico escrita
dentro: lo que él aporta es **pasado**, lo que el script calcula es **presente**, y ante una
contradicción manda lo de hoy — pero **no en silencio**: el cambio se escribe en la propia nota,
con las dos cifras y su dirección, como frase clínica y no como nota al margen.

> Al renombrar el bloque, la prueba *«todo rótulo que el prompt cita, el mensaje lo emite de
> verdad»* (v17.13.0) se puso roja: había renombrado el bloque en el mensaje y no en la lista de
> precedencia del prompt. Cazó una desconexión **real** que yo acababa de introducir.

### 3. La caja roja marcaba como inventadas las cifras del propio médico

`mtrVerificarCifrasIA` solo daba por respaldadas las de la **hoja**. El automonitoreo que el
paciente le trae, la nota del control anterior que él pegó — todo eso salía en rojo como «el
modelo pudo inventarlas». O sea: **el borrador que usaba fielmente su contexto era justo el que
salía marcado**. Un aviso que grita con lo que uno mismo aportó enseña a ignorarlo, y entonces
deja de servir para lo único que importa.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 57 | vuelve el corte en seco a 800 | *ya no se corta en seco* | Sí — 2.810 |
| 58 | se sube el tope pero se corta a mitad de palabra | *ya no se corta en seco* (la mitad del ítem completo) | Sí — 2.810 |
| 59 | la caja roja vuelve a ignorar el aporte del médico | *el modal le pasa esas fuentes* | Sí — 2.810 |
| 60 | `extraConocido` deja de contarse dentro de la función | *las cifras que él aportó NO se marcan* | Sí — 2.810 |
| 61 | el bloque se renombra en el mensaje y no en la precedencia | *rótulo que el prompt cita* + otras dos | Sí — 2.810 |
| 62 | se pierde la regla de pasado/presente | **primero NO cayó nadie** → prueba nueva → repetida y cae | Sí — 2.810 |

La **62** es la séptima prueba hueca de la jornada: una **decisión explícita del médico** vivía
solo en el texto del prompt, sin nada que la vigilara. Se podía borrar y el banco seguía verde.

Banco completo: **2.810 comprobaciones pasan, 0 fallan.**

---

## v18.0.36 — El grounding deja de ser una foto, y llega lo que el médico lleva tecleado

Dos hallazgos del enjambre del 01-sep, los dos detrás de la misma queja.

### 1. La hoja de hechos se arrastraba de la foto

La v17.47.0 prometía «el JSON que va a la IA no puede ir caducado» y resolvía el resumen
vigente en el instante del clic. Pero la rama del **caso normal** —la caché guarda el MISMO
objeto que la foto, que es lo que pasa casi siempre porque el panel saca su resumen de la
caché— devolvía la hoja de la foto **sin tocarla**:

```js
if (vigente === resumenFoto) { salida.edadMin = …; return salida; }   // <- se va con la hoja vieja
```

Y ese resumen puede haber cambiado **por dentro** desde entonces: hasta la v18.0.34 el
agendamiento le escribía la tensión encima. La hoja que leía la IA quedaba desincronizada de su
propio resumen sin que nada lo dijera. `mtrHojaDesdeResumen` es pura y barata: se recalcula
siempre. `refrescado` pasa a significar lo que dice (cambió el objeto), en vez de un `true` fijo.

### 2. Lo que el médico teclea no llegaba hasta que guardara

`mtrLeerTextoLibreHistoria` solo mira **Revisión por sistemas** y **Examen físico**. Lo que él
escribe en **Enfermedad actual**, **Análisis y plan** o **Recomendaciones** no llegaba al prompt
por ninguna vía hasta que guardara la historia y el script la releyera de la API. Redactar «con
lo que él escribió» sin haberlo leído es exactamente lo que reportó.

Dos exclusiones, las dos a propósito: **la casilla del modo que se está generando** (devolverle
su propio borrador lo llevaría a parafrasearlo en vez de redactar desde los hechos) y **Motivo
de consulta** (decisión C2 de la v17.6.3: la IA ve siempre la constante).

### La lección de la v18.0.33, aplicada esta vez de verdad

La primera versión de la prueba miraba el **fuente**. Una mutación la dejó en ridículo: bastaba
un `return` temprano para volver el bloque inalcanzable —el texto seguía escrito— y la prueba
pasaba en verde. **La misma trampa que había caído dos versiones antes.**

En vez de reforzar otra vez la comprobación de texto, la lógica salió del closure a
`mtrTextoDeOtrasCasillas(modo, doc, nombrePaciente)` — función **nombrada y ejecutable**. La
prueba ahora la llama con un DOM falso y comprueba conducta. Es el mismo camino que
`mtrPanelFactoresDePantalla` en la v18.0.33: *lo que se puede ejecutar se puede probar de verdad*.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 63 | vuelve la rama que arrastra la hoja de la foto | *la hoja se recalcula del resumen vigente* | Sí — 2.812 |
| 64 | se anuncia «refrescado» sin que cambie el objeto | *la hoja se recalcula…* | Sí — 2.812 |
| 65 | la función nueva se queda muda (rama inalcanzable) | *lo que teclea SÍ llega* — **la caza porque la ejecuta** | Sí — 2.812 |
| 66 | se le devuelve su propio borrador de la casilla en curso | *lo que teclea SÍ llega…* | Sí — 2.812 |
| 67 | el texto sale sin pasar por el censor de nombres | *lo que teclea SÍ llega…* | Sí — 2.812 |
| 68 | desaparecen los rótulos por casilla | *lo que teclea SÍ llega…* | Sí — 2.812 |
| 69 | el modal deja de llamar a la función (existe, nadie la usa) | *ya NO congela el texto libre* | Sí — 2.812 |

La **69** cubre el hueco que la 65 no puede ver por sí sola: una función correcta que nadie
llama es código muerto con buena conciencia.

Banco completo: **2.812 comprobaciones pasan, 0 fallan.**

---

## v18.0.37 — Dos formas de que el modal de agendamiento actuara por su cuenta

*«El médico manda, el script sugiere»* (CLAUDE.md). Las dos lo violaban en silencio.
Hallazgos `L24897` y `L23853` del barrido.

### 1. Un clic agendaba una hora que el médico nunca eligió

La v16.4.0 quitó el `selected` de la primera opción, pero dejó el marcador vacío **condicionado
a un parámetro** (`exigirEleccion`) y dejó vivo el bloque que habilitaba el botón. Por la ruta
normal —el primer pintado y el clic en un chip de día— la función se llama **sin argumento**:

```js
const placeholder = exigirEleccion ? `<option value="" selected>…` : "";   // <- vacío
…
if (!exigirEleccion) { confirmBtn.disabled = false; confirmBtn.textContent = "✓ Agendar…"; }
```

Sin una opción vacía delante, el navegador **selecciona la primera por su cuenta**, y el botón
nacía habilitado. Un clic reservaba el primer cupo del día —las 6:00 a. m.— sin que nadie lo
hubiera elegido.

El marcador vacío pasa a ir **siempre**, con `disabled`, y el parámetro **desaparece**:
acordarse de pasarlo era justamente la parte que fallaba. Una regla que depende de que alguien
la recuerde en cada sitio de llamada no es una regla.

### 2. La casilla que se marcaba sola porque solo se escuchaba una vez

«Agendar también la Toma de Muestras» registraba su `change` con `{ once: true }`. El listener
se retira tras el **primer** cambio, así que la bandera que recuerda la elección del médico se
queda congelada:

> desmarca *(queda registrado `false`, listener retirado)* → se arrepiente y la vuelve a marcar
> *(ya no hay quien lo oiga)* → elige otro día → el repintado escribe `checked = false` encima.

La casilla del médico es sagrada **también cuando cambia de opinión dos veces**. Se escucha
siempre, con una marca en el elemento para no apilar un listener por repintado — que es lo que
`{ once: true }` estaba evitando, a costa del defecto.

La regla que lo vigila es **general**, porque el defecto lo es: *ningún `change` se registra
para escuchar una sola vez*. La gente cambia de opinión.

### La prueba vieja que se rompió por la firma, no por lo vigilado

`suite_15` cortaba el fuente por `indexOf("async function cargarHorasLabSolo(exigirEleccion) {")`.
Al retirar el parámetro, `indexOf` devolvió **-1** y el `slice` acabó mirando el final del
archivo. Se corta ahora por el **nombre**, que es lo estable: una prueba no debe romperse porque
cambie la firma de lo que vigila, solo porque cambie su conducta.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 70 | vuelve el marcador vacío condicionado a un parámetro | *nunca nace con una hora puesta* | Sí — 2.814 |
| 71 | se le quita el `disabled` al marcador vacío | *nunca nace con una hora puesta* | Sí — 2.814 |
| 72 | vuelve el `{ once: true }` | *ningún interruptor se escucha una sola vez* | Sí — 2.814 |
| 73 | se quita el `once` pero se apila un listener por repintado | *ningún interruptor…* (la otra mitad) | Sí — 2.814 |

La **73** es la mutación en dirección contraria: quitar el `once` sin más habría cambiado un
defecto (dejar de escuchar) por otro (escuchar N veces y contar N cambios por uno).

Banco completo: **2.814 comprobaciones pasan, 0 fallan.**

---

## v18.0.38 — Un examen no es un paquete

Hallazgo `L25747`. La función devolvía «hecho» **en cuanto UNA fila casara**, y con eso el modal
deshabilita la casilla y escribe en pantalla *«se realizó hace N días; por ser tan reciente no la
marcamos»*: una afirmación falsa sobre una tamización que nadie hizo. Reproducido con el arnés:

```
Z108 (7 CUPS), y Athenea solo trae la creatinina, de hace 3 meses
  ANTES   {"iso":"2026-06-01","dias":92}     <- el paquete entero por cubierto
  DESPUÉS null

Z103 «Hemoglobina y Hematocrito», y solo hay una HbA1c (que NO es del paquete)
  ANTES   {"iso":"2026-08-25","dias":7}      <- «hemoglobina» casa por SUBCADENA
  DESPUÉS null
```

### El tercer defecto, que apareció al reproducir los otros dos

Con el paquete **completo** pero fechas dispares —seis componentes de marzo y uno de agosto—
devolvía la **más reciente**:

```
  ANTES   {"iso":"2026-08-28","dias":4}                     <- «hecho hace 4 días»
  DESPUÉS {"iso":"2026-03-01","dias":184,"componentes":7}   <- la verdad
```

Un perfil lipídico de hace seis meses se daba por actual porque los triglicéridos se repitieron
la semana pasada. Y esa fecha es exactamente la que decide si el paquete sigue vigente.

### La regla nueva, y su dirección

Se exige **cobertura completa por código CUPS**, que es inequívoco, y se devuelve la fecha del
componente **más antiguo**. Las palabras clave dejan de contar para la cobertura: no se puede
saber a qué CUPS corresponde un nombre suelto, y ya se vio lo que pasa cuando se supone (es la
misma familia que la v18.0.31, donde seis nombres del hemograma se llevaban la casilla de la
hemoglobina sérica). Siguen valiendo solo para paquetes que no declaran CUPS, donde no hay nada
mejor.

**La dirección del error es deliberada:** si no se puede establecer que TODO el paquete está
cubierto, no se afirma que esté hecho. Quedarse corto cuesta repetir una orden; pasarse cuesta
una tamización que nadie hizo y que el script dio por hecha.

> El banco seguía verde con el defecto puesto: **ninguna prueba cubría esta conducta**. Por eso
> vivía. Las cuatro mutaciones de abajo existen para que no vuelva a pasar.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 74 | vuelve «basta con uno» | *un paquete de 7 CUPS NO se da por hecho con un examen suelto* | Sí — 2.817 |
| 75 | vuelve la fecha más reciente en vez de la más antigua | *un paquete es tan viejo como su componente más viejo* | Sí — 2.817 |
| 76 | las palabras clave vuelven a cubrir un paquete con CUPS | las **tres** pruebas nuevas | Sí — 2.817 |
| 77 | un PENDIENTE vuelve a contar como hecho | *un examen PENDIENTE no cuenta* (v17.6.99, ya existía) | Sí — 2.817 |

Y una nota sobre el propio banco: la meta-regla **M4-AST** (`suite_34`) rechazó una aserción
tautológica `t.cierto(true, …)` que yo había puesto como salida defensiva por si el paquete no
existía en el catálogo. Tenía razón: una prueba que puede pasar sin comprobar nada no es una
prueba. Se sustituyó por la comprobación real de que Z103 sigue declarando esa palabra clave.

Banco completo: **2.817 comprobaciones pasan, 0 fallan.**

---

## v18.0.39 — «Paciente Everest» no es un nombre

Hallazgo `L11731`. Es el **relleno** que pone `extractAgenda` cuando la tarjeta de Everest no
deja leer ningún nombre (`nombre: nombre || "Paciente Everest"`, línea ~11802). Usarlo como
identidad convierte a **todas** las citas sin nombre legible de una misma hora en una sola cita
para el script. Reproducido con el arnés:

```
apptKey(A) = Paciente Everest@m480
apptKey(B) = Paciente Everest@m480      <- otro paciente, misma clave: true
tras marcar a A por inasistencia:  ["Paciente Everest@m480"]
¿B figura marcado?  true
```

**La variante peor** es la que mide el daño real: A es ilegible y B —otro paciente de la misma
hora— sí tiene su cédula. La marca de A entra como `Paciente Everest@m480`, y `_apptKeysLegado`
consulta la forma por nombre: B sale **ROJO con sonido** por algo que hizo A, y con su fila en el
CSV con el que el médico reclama.

### El genérico deja de identificar en las TRES puertas

No basta con arreglar `apptKey`: la identidad de una cita entra por tres sitios y los tres tenían
que taparse a la vez — la clave que se **escribe** (`apptKey`), las formas viejas que se **leen**
(`_apptKeysLegado`) y las que se **marcan** (`_apptMarcar`). Arreglar una sola habría dejado el
contagio vivo por las otras dos.

Sin documento y sin nombre propio, `apptKey` cae a la **posición** (`#0@m480`): no es una
identidad —y por eso `_apptPuedeAcusar` dice que no— pero impide que dos filas distintas
colapsen en la contabilidad interna.

### Y no se acusa a quien no se puede señalar

Una fila que no identifica a nadie **ya no origina** una marca de fraude: queda una línea en la
bitácora (`CONFIRMACION_SIN_PACIENTE_IDENTIFICABLE`) para que el médico vea que hubo algo raro,
sin que el script acuse a nadie. *Una acusación que no se puede atribuir tampoco se puede
reclamar.*

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 78 | el genérico vuelve a ser identidad en `apptKey` | *dos citas ilegibles no colapsan* | Sí — 2.820 |
| 79 | `_apptMarcar` vuelve a escribir la forma por nombre | *dos citas ilegibles no colapsan* | Sí — 2.820 |
| 80 | `_apptKeysLegado` vuelve a emitirla | *el genérico tampoco contagia a quien SÍ tiene cédula* | Sí — 2.820 |
| 81 | `_apptPuedeAcusar` se vuelve permisivo | *no se puede acusar a nadie* | Sí — 2.820 |
| 82 | el reconocedor se vuelve sensible a mayúsculas y espacios | *no se puede acusar a nadie* | Sí — 2.820 |

La **82** cubre lo que casi siempre se escapa: comparar `"Paciente Everest"` con `===` funciona
hasta que Everest devuelve `"  PACIENTE  EVEREST "`. Se normaliza acentos, espacios y caja.

Banco completo: **2.820 comprobaciones pasan, 0 fallan.**

---

## v18.0.40 — Una interacción borraba el aviso de que no se juzgó ninguna dosis

Hallazgo `L33460`. La cabecera de esa vista promete *«el silencio SIEMPRE lleva motivo»*, y lo
cumplía. Faltaba el caso en que **no hay silencio**: con `n > 0` el motivo colapsa a `"OK"` y con
eso desaparecía el único rastro de que la dosis renal no se había podido juzgar.

Reproducido con el arnés (`__S.motorPortado = true`), paciente **sin TFG**:

```
A) METFORMINA sola                       → «Falta la función renal… no se puede juzgar la dosis»  ✔
B) + LOSARTAN + IBUPROFENO (1 interacción) → el aviso DESAPARECE
                                            pie: «Calculado con la función renal de arriba»       ✘
contraste: los MISMOS tres con TFG 25    → 3 avisos de dosis renal
```

El médico veía un panel completo y tranquilizador —«1 para revisar», con su pie de calculado—
donde el motor **no juzgó ni una sola dosis**. Con TFG 25 uno de esos avisos es metformina
CONTRAINDICADA.

### El arreglo

El motivo de la **dosis** viaja aparte del motivo del **conjunto** (`motivoDosisRenal`), así que
colapsar el segundo ya no borra el primero. El aviso se pinta **encima de la lista** —donde no
hay forma de no verlo, misma decisión que la caja de cifras del Redactor (v17.14.0)— y el pie
dice la verdad en vez de lo contrario.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 83 | el motivo de la dosis deja de viajar aparte | *una interacción no puede borrar el aviso* | Sí — 2.821 |
| 84 | el aviso vuelve a pintarse solo cuando no hay nada | *idem* | Sí — 2.821 |
| 85 | el pie vuelve a afirmar que se calculó | *idem* | Sí — 2.821 |
| 86 | el aviso se pinta DEBAJO de la lista | **primero NO cayó nadie** → aserción reescrita → cae | Sí — 2.821 |
| 87 | el aviso se pinta siempre, también con TFG real | *idem* (la contrapartida) | Sí — 2.821 |

**La 86 es la octava prueba hueca de la jornada**, y de una variedad nueva: mi aserción de
posición comparaba el aviso contra el **pie del bloque**, así que moverlo debajo de la lista
—pero encima del pie— la seguía cumpliendo. Ahora se compara contra el **primer aviso pintado**,
que es lo que de verdad decide si el médico lo ve antes o después de leerse la lista entera.

Banco completo: **2.821 comprobaciones pasan, 0 fallan.**

---

## v18.0.41 — Dos afirmaciones falsas en pantalla

### 1. «· albuminuria: vigilancia estrecha» sobre una glicemia (`L35453`)

El sufijo pertenece a la promoción a **R** del RAC con albuminuria, pero colgaba de
`vencidoBase`, que solo significa «estaba vencido» y vale igual para la glicemia, la creatinina
y el LDL. Reproducido con el arnés, paciente **sin RAC medido** (`ctx.rac = null`):

```
GLUCOSA vencida:  «vencido hace 418 día(s) — resultado del 2025-01-10 · albuminuria: vigilancia estrecha»
LDL vencido:      «vencido hace 396 día(s) — resultado del 2025-02-01 · albuminuria: vigilancia estrecha»
```

Ese motivo es **literalmente** lo que se pinta en la lista «Ya vencidos» del recuadro clínico. El
médico leía que su paciente tiene albuminuria y vigilancia estrecha sobre una glicemia, en
alguien a quien **nadie le midió la albuminuria**. El sufijo se ata ahora a la promoción a R, que
es de quien de verdad la tiene.

### 2. Anular la cita de control borraba la marca de la toma de muestras (`L19487`)

La toma vive en AppCita y el script **no puede anularla** — el propio comentario de la v15.5.0 lo
dice. Borrar su marca local era afirmar que ya no está agendada cuando sigue estándolo, y apagaba
**dos cosas a la vez**:

- el aviso *«la cita de control quedó anulada, la TOMA DE MUESTRAS sigue agendada»*, que se decide
  leyendo esa misma marca justo después: no podía salir nunca, porque acababa de borrarse;
- el **antiduplicados** del modal de laboratorio, con lo que tras cancelar el control se podía
  crear una **segunda** toma para el mismo paciente y el mismo día sin la segunda confirmación.

Paciente que llega en ayunas a una toma huérfana, o con dos tomas el mismo día, y el médico nunca
fue avisado.

Además, la foto del estado se toma **antes** de anular. Aunque la marca ya no se borre, decidir un
aviso releyendo un almacén que la operación de al lado acaba de tocar es la forma de que el aviso
vuelva a desaparecer en silencio la próxima vez que alguien cambie esa limpieza.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 88 | el sufijo vuelve a pegarse a todo examen vencido | *NO se pega a cualquier examen vencido* | Sí — 2.825 |
| 89 | el sufijo desaparece también del RAC promovido | *(contrapartida)* el RAC SÍ lo conserva | Sí — 2.825 |
| 90 | anular la cita vuelve a borrar la marca de la toma | *no borra la marca* **+** *foto antes de anular* | Sí — 2.825 |
| 91 | el aviso vuelve a decidirse releyendo el almacén | *foto antes de anular* | Sí — 2.825 |

La **89** es la mutación en dirección contraria, y aquí importa especialmente: el arreglo se podía
«cumplir» borrando el sufijo de todas partes, y con eso se habría perdido la prioridad de atención
que la v17.6.75 puso ahí a propósito.

Banco completo: **2.825 comprobaciones pasan, 0 fallan.**

---

## v18.0.42 — LA REGRESIÓN DE DISEÑO: un comentario mío se comió 878 líneas de CSS

**Reporte del médico, en vivo, sobre la v18.0.32 que tiene instalada:** *«hubo una regresión muy
grande en temas de diseño en todo el script, actualmente se ve horrible… el azul de Everest se
mezcla con el nuestro, los botones parecen viejos de Windows 98, todo lo bueno que teníamos se
perdió»*.

### La causa, y es mía

En la v18.0.28 escribí, dentro de `MTR_RCV_CSS`, un comentario que **nombraba el peligro de la
Regla Q escribiendo la secuencia de cierre literal**:

```
   … y la Regla Q (un */ que cierra un
   comentario CSS antes de tiempo).
```

Ese cierre **terminó el comentario en mitad de la frase**. Todo lo que venía detrás dejó de ser
comentario y pasó a ser CSS inválido; el parser perdió el hilo y **descartó las 878 líneas
restantes de la hoja**. Es exactamente el defecto que ese comentario describía, cometido dentro
del comentario que lo describe — el mismo error que la v18.0.28 ya había cometido con una
interpolación viva, en el mismo sitio.

### Medido en Chromium, con el CSS real generado por `buildOverlay()`

```
                        ANTES        DESPUÉS
reglas aceptadas         746          1105        (+359 resucitadas)
.vgl-bento-head       ausente        presente
.vgl-ux-seccion-tit   ausente        presente
.vgl-prod-pct         ausente        presente
muestra de 26 selectores repartidos:  23/26  ->  26/26
```

La última regla viva era `.vgl-rcv-aviso`. De ahí al final —el tablero «Estado de un vistazo»,
la vista de productividad, la hoja de UX entera— **no existía para el navegador**. Sin esas
reglas, cada elemento cae al estilo por defecto del navegador y al CSS global de Everest: de ahí
los botones de Windows 98 y el azul ajeno.

### Por qué la guarda que existe para esto no lo vio

`suite_25` extraía **solo** el bloque `style.textContent` de `buildOverlay()` y **no resolvía**
los `${_cssSeguro(() => XXX_CSS)}`. Todo lo que vive en `MTR_CSS`, `MTR_RCV_CSS`,
`MTR_RCV_CSS_TODOS_LOS_MODALES` y `VGL_UX_CSS` era invisible para **todas** las reglas de la
suite — la P, la Q y la R incluidas.

Y el propio comentario roto afirmaba que esa suite ya lo veía («invisible para esa suite **hasta
esta versión**»). Es la quinta vez en esta jornada que aparece el mismo patrón: **un comentario
que promete una red de seguridad que no existe**. Esta vez costó el diseño entero.

Ahora la suite resuelve los splices —incluida la constante derivada
`MTR_RCV_CSS_TODOS_LOS_MODALES`, que se compone en tiempo de ejecución— y verifica que **no
quede ninguno sin resolver**: uno solo deja una hoja completa fuera del alcance de las reglas.

### Dos censos, no uno

El censo histórico de `!important` se calibró sobre el bloque principal y de ahí sale su lista
detallada de excepciones, así que se queda ahí. Las hojas spliceadas reciben **censo propio**
(132): hasta hoy no tenían ninguno, y por ese hueco pasó esto.

### Además, en la misma versión

- **`.vgl-uro-arrow`** (la flechita ▾ del acordeón del uroanálisis) no tenía **ninguna** regla
  de color en toda la hoja: heredaba, y la herencia pierde contra una regla de tipo de Everest
  con `!important`. Medido: **18,67:1 → 1,10:1**, invisible.
- **El titular y el icono del aviso flotante, y la insignia de estado de cada tarjeta de cita**,
  pintaban su color **en línea sin `!important`**. La Regla R —escrita en la v18.0.16 justo para
  eso— era ciega: su `style="([^"]*)"` se corta en la primera comilla doble, y esos atributos
  llevan una dentro de la interpolación (`String(color || "AZUL")`). Tres coincidencias en esa
  línea, **ninguna** con `color:`. Se neutralizan las interpolaciones antes de buscar,
  conservando los saltos de línea para que los números de línea del informe sigan siendo reales.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 92 | se reintroduce el cierre literal en `MTR_RCV_CSS` | **Regla Q** — ahora sí lo ve (2 fugas) | Sí — 2.825 |
| 93 | se quita la regla de `.vgl-uro-arrow` | censo de `!important` del bloque principal | Sí — 2.825 |
| 94 | se quita el `!important` de un color en línea | **Regla R** — con las interpolaciones neutralizadas | Sí — 2.825 |
| 95 | se deja un splice sin resolver | *no queda ningún splice sin resolver* | Sí — 2.825 |

Banco completo: **2.825 comprobaciones pasan, 0 fallan.**

---

## v18.0.43 — la agrupación de exámenes: 59 días de vigencia quemados en un viaje que todavía no existe

**Reporte en vivo del médico (1-sep), con captura de pantalla:** *"ESTO TAMPOCO TIENE SENTIDO
LA FORMA EN LA QUE SE AGRUPAN TODOS LOS EXÁMENES QUE INCLUSO ESTAN A MUCHO TIEMPO SE SUGIERE LA
REALIZACION EN DICIEMBRE Y NO ES ASÍ".* El plan ponía la toma el **23 de diciembre** —a 113
días, porque ese día vencía la creatinina— y arrastraba **siete exámenes que vencían el 20 de
febrero** (a 172 días), cada uno rotulado *"se aprovecha el mismo viaje"*.

### La asimetría, medida antes de tocar nada

`tools/medir_arrastre_lejano.js` (nuevo, mismo método que `medir_cercania.js`: Monte Carlo
determinista, 10.000 pacientes sintéticos por población, cero datos reales). Lo primero que
salió fue que la población de `medir_cercania.js` **no contiene el caso del médico**: con el
último resultado de cada driver repartido entre 0 y 250 días, casi siempre hay algo vencido, y
entonces la toma cae a 14-21 días (84,3 % de los planes). El paciente de la captura acaba de
hacerse el panel completo — nada vencido — y ahí la toma se va a meses vista. Con esa población
añadida (0-30 días), **31,7 % de los planes ponen la toma a más de 30 días**.

La cosecha medía el margen **solo contra el 33 % de la vigencia del propio examen**, nunca
contra la distancia a la que está la toma. Con algo por pedir esa distancia es como mucho
`MTR_TECHO_ESTADO_A`, así que el canje "vigencia por viaje" que el médico aprobó en v17.6.0 se
cobraba sobre un viaje inminente. Sin nada por pedir, la misma regla seguía corriendo contra un
viaje que todavía no existe: entre hoy y diciembre el plan se recalcula en cada consulta.

Qué regla cosecha qué, en la población del caso reportado:

| regla | % de lo cosechado | adelanto medio | máximo |
|---|---|---|---|
| grupo de lípidos (sin tope) | 52,1 % | 122,0 d | 168 d |
| cosecha del 33 % | 32,1 % | 15,3 d | 59 d |
| vence con la toma | 8,5 % | 0 d | 0 d |
| gracia de 14 d | 5,6 % | 59,9 d | 73 d |
| ANR (creatinina / RAC) | 1,7 % | 53-73 d | 108 d |

### El arreglo

La **cosecha genérica** (el 33 % y la gracia de 14 días) solo corre si la toma cae dentro de
`MTR_TECHO_ESTADO_A` (21 d) — la ventana que este proyecto ya llamaba *"el mismo viaje"*. Misma
forma que el guardarraíl que el médico pidió en v17.30.0 para el ANR: cuando la fecha la
gobierna otra cosa, la cosecha genérica no se suma encima. Y hace verdadera la frase de
pantalla.

**Lo que NO se toca, a propósito:** el ANR (lo ordenó el médico explícitamente) y el grupo de
lípidos — que es el que más adelanta de todos y aun así se deja sin tope, porque **los cuatro
lípidos no se pueden pedir sueltos en Everest** (`CONDUCTA_LI_TEXTO_POR_ANALITO` no tiene texto
de `<li>` para ninguno: solo existen dentro del paquete). Excluirlos no evitaría que el
laboratorio los procese; solo enseñaría una lista que no coincide con lo que el paquete agrega.
Y no hace falta acotarlo por otro lado: esa regla solo dispara si YA va un lípido en la visita,
así que se apaga sola cuando se apaga la cosecha que la alimentaba.

Coste medido con umbral 21 d:

| población | planes que cambian | viajes extra | vigencia devuelta |
|---|---|---|---|
| todos los días (0-250 d) | 39 de 10.000 | **1 paciente de 10.000** | 5.373 d |
| panel recién hecho (0-30 d) | 2.770 de 10.000 | 1.158 (11,58 %) | 265.951 d (21,8 d/examen) |

Con umbral 14 el coste en la población de todos los días se multiplica por 29 (1.131 planes);
con 30 y con 45 no se gana nada más. **21 es el codo de la curva** y además es el número que el
proyecto ya usa para decir "el mismo viaje".

### Y se dice por qué, y cuánto cuesta

Cada cosechado viaja ahora con `motivoCosecha` y `adelantoDias`, y la pastilla "qué ordenar"
los usa. El texto único de antes (*"se aprovecha el mismo viaje"*) era verdad para un examen
que vence en una semana y mentira para uno que vence en febrero, y los dos salían idénticos:

- lípidos → *"viene en el mismo perfil lipídico, no se pide suelto"*
- ANR → *"la ventana renal lo trae a esta toma"*
- 33 % / gracia → *"se adelanta N d para salir en la misma toma"* — con el número delante
- el que fija la fecha → *"justo el día de la toma"*

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 96 | `tomaEsElMismoViaje` forzado a `true` (la conducta vieja) | los 7 de febrero vuelven a arrastrarse a diciembre — 3 fallan | Sí — 86 ok |
| 97 | `tomaEsElMismoViaje` forzado a `false` (se apaga también donde sí sirve) | el borde de 21 días y la gracia — 7 fallan | Sí — 86 ok |
| 98 | se quita el guardarraíl **solo** de la gracia | la gracia arrastra con la toma lejos — 3 fallan | Sí — 86 ok |
| 99 | `cosechar` empuja el objeto original en vez de una copia | *el driver original no queda marcado* — 1 falla | Sí — 86 ok |

La mutación 97 es la que importa en la dirección contraria: prueba que el guardarraíl **no**
apaga la cosecha donde el médico la aprobó — con el viaje a la vuelta de la esquina sigue
adelantando sus 59 días.

---

## v18.0.44 — al paciente que la lista oficial no conoce, ahora se le pregunta al respaldo

**Pedido del médico (1-sep), con captura:** *"HAY ALGUNOS PACIENTES QUE ME APARECEN ASÍ CON LA
BASE DE DATOS OFICIAL PERO QUERÍA PREGUNTARTE SI ES POSIBLE QUE SOLAMENTE EN ESOS CASOS QUE
'Dato faltante: sin registro en PyM' SE PUEDA CONSULTAR LA BASE PILOTO (EL RESPALDO) A VER SI EL
PACIENTE TIENE ACTIVIDADES PENDIENTES ... COMO SE PODRÍA HACER SIN ROMPER LO QUE YA FUNCIONA?"*

Hasta esta versión la base piloto era **excluyente**: se cargaba en lugar de la lista del día
cuando esa no aparecía, y en cuanto llegaba la oficial se reemplazaba entera. Un paciente que
no cruza con el `Agenda_Dia_CMB` de hoy salía como *"Dato faltante: sin registro en PyM"* y ahí
moría, aunque el respaldo estuviera guardado en la misma máquina.

### Cómo se hizo sin romper lo que ya funciona

**Un segundo índice de solo consulta** (`state.pymResp*`), que convive con la oficial en vez de
sustituirla. Cuatro contenciones, cada una con su prueba:

1. **Nunca sustituye a la oficial.** Se consulta SOLO cuando `pymTodos` no tiene al paciente.
   Quien está en la oficial se lee solo de ella, incluido su *"al día"*.
2. **Nunca se mezcla en `state.pym`.** Ningún consumidor existente —`getActivities`,
   `pymPendientesRestantes`, el módulo de ordenamiento, el aviso al abrir la historia— cambia
   de comportamiento. El respaldo **no** alimenta el ordenamiento automático: informa, y el
   médico decide.
3. **Nunca se presenta como dato de hoy.** Todo lo que sale del respaldo viaja con su
   procedencia y su fecha pegadas, en ámbar y con borde punteado en la tarjeta.
4. **Nunca dice "al día".** Si el respaldo tiene al paciente sin nada anotado, eso no prueba
   que hoy no le falte nada. Se dice exactamente eso — la Regla D del proyecto, aplicada al
   revés.

**No descarga nada nuevo:** lee la copia que el script ya guarda (`vgl_piloto`, escrita por
`pilotoGuardar` desde v7.8.1). Si esa copia no existe todavía, el respaldo no responde y la
pantalla se queda exactamente como estaba.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 100 | se quita la contención *"está en la oficial"* | *al paciente que SÍ está en la lista oficial no se le consulta el respaldo* | Sí — 23 ok |
| 101 | se quita la contención *"la activa YA es el respaldo"* | *no se le pregunta dos veces a la misma fuente* | Sí — 23 ok |
| 102 | el respaldo vacío se presenta como *"está al día"* | *REGLA D al revés* | Sí — 23 ok |
| 103 | el mensaje deja de decir de dónde salió el dato | *dice de dónde salió el dato* | Sí — 23 ok |

### Y una trampa nueva, anotada

El primer intento sumaba **cinco** `!important` al censo de la suite 25 en vez de cuatro: el
quinto era la palabra escrita **dentro de un comentario del propio CSS**. Ese censo cuenta texto
crudo, así que una mención en prosa le inventa una regla que no existe. Misma familia que la
trampa del `*/` de la v18.0.42: **el comentario de una hoja de estilos no es un lugar neutral**.
Queda anotado en el comentario de esa regla para no repetirlo. Censo: 645 → 649.

### v18.0.44 (segunda entrega) — el respaldo se trae solo, y una prueba hueca de la peor clase

**El hueco que hacía inútil lo anterior.** La copia `vgl_piloto` solo se escribe cuando el
respaldo se carga como lista ACTIVA, y eso solo pasa los días en que la lista de la sede llega
tarde (`loadPymBase` corta con `if (state.pymFile) return true`). En una máquina donde el
`Agenda_Dia_CMB` llega puntual varios días seguidos, la copia puede no existir — y la consulta
al respaldo no respondería nunca. Se añade `traerRespaldoSoloParaConsulta()`: una vez al día,
solo la pestaña líder, solo con la base automática encendida, **después** de que la lista del
día esté cargada, y sin pasar por `applyPymIdx` ni tocar `state.pym` / `pymFile` / `pymFallback`.

**Un error de diseño propio, corregido por su prueba.** El primer intento marcaba el día
*antes* de descargar, "para no reintentar en bucle". Efecto real: un fallo de red al arrancar
la jornada —la sesión de SharePoint a medio despertar, que es exactamente cuando esto corre—
dejaba el respaldo mudo el día entero, justo lo que el médico pidió evitar. Ahora la marca se
pone **solo al conseguirlo**, y el bucle se corta con un contador en memoria (3 por pestaña).

**LA PRUEBA HUECA #9 DE LA SESIÓN, Y LA MÁS CARA.** La prueba que descubrió lo anterior estaba
escrita como `t.caso("…", async () => { … })`. `t.caso` llama a `fn()` de forma **síncrona** y
suma un acierto en el acto; una función `async` devuelve una promesa ahí mismo, así que la
prueba se cuenta como pasada **antes de ejecutar una sola afirmación**. Al convertirla a
`await t.casoAsync` se puso roja contra el código sin mutar — y así apareció el error de diseño.

Un barrido del banco encontró **cinco**, cuatro de ellas anteriores a esta sesión:

| suite | prueba | qué comprobaba (o creía comprobar) |
|---|---|---|
| 18 | `atheneaAutoLogin` (a) | que con el interruptor apagado no hace nada |
| 18 | `atheneaAutoLogin` sin credenciales | que no exige médico identificado |
| 18 | `atheneaAutoLogin` v12.5.8 | que el motivo ya no es mudo |
| **31** | **`openLaboratoriosModal`** | **inyección de atributos en `<a>` vía `doc_id` — una prueba de SEGURIDAD que llevaba tiempo sin comprobar nada** |
| 72 | respaldo (nueva) | la de arriba |

Las cuatro pasan de verdad tras convertirlas. Se verificó rompiendo a propósito la afirmación
de la de seguridad (suite 31): ahora sí cae, y antes no.

El banco ya tenía tres reglas para `t.casoAsync` sin `await` y para suites sin `async pruebas`;
faltaba la puerta de al lado. Se añade la cuarta en `suite_26`.

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 104 | la marca del día se pone antes de conseguirlo | *un fallo de red NO quema el intento del día* | Sí — 24 ok |
| 105 | la descarga fallida igual escribe el índice de consulta | *sin descarga no se inventa un índice* | Sí — 24 ok |
| 106 | se reintroduce una prueba hueca `t.caso(..., async ...)` | la regla nueva de `suite_26` | Sí — 10 ok |

Banco completo: **0 fallan.**

---

## v18.0.45 — los dos primeros del enjambre de funciones: un aviso farmacológico sobre una cifra que nadie midió, y PHI en el archivo llamado «sanitizado»

Los dos de mayor daño entre los 47 confirmados por el enjambre
(`docs/ENJAMBRE_FUNCIONES_20260901.md`). Los dos comprobados contra la cabeza actual antes de
tocar nada — el enjambre corrió contra un HEAD anterior a la v18.0.33.

### 1. `eGFR = null` se evaluaba como `eGFR = 0` (gravedad alta, clínico)

`mtrEvaluarInteracciones` recibe `egfr` en **`null`** cuando la función renal nunca se ha
medido: paciente nuevo, o falta el peso para calcularla. Las dos comparaciones eran
`egfr < 30` y `egfr < 60` a pelo, y en JavaScript **`null < 30` es `true`** (null se convierte
a 0). Un paciente sin función renal medida se evaluaba como si tuviera una eGFR de **cero**.

Medido antes y después con el arnés, mismos fármacos:

| | antes | después |
|---|---|---|
| LOSARTÁN + ESPIRONOLACTONA, eGFR `null`, K⁺ 4,0 | `HIPERKALEMIA_SINERGICA` (severidad alta) | — |
| los mismos, eGFR **25** real | `HIPERKALEMIA_SINERGICA` | `HIPERKALEMIA_SINERGICA` |
| METFORMINA + CONTRASTE, eGFR `null` | `METFORMINA_CONTRASTE` («suspender 48 h») | — |
| los mismos, eGFR **45** real | `METFORMINA_CONTRASTE` | `METFORMINA_CONTRASTE` |

Es «casilla vacía antes que dato inventado» del lado peor: un aviso farmacológico falso o
gasta la atención del médico, o le hace suspender un fármaco por una cifra que no existe.

Se arregla con **una variable** (`egfrMedida`), no parcheando cada comparación: así una regla
nueva que mire la función renal no puede volver a caer en la coerción sin darse cuenta. El K⁺
alto sigue disparando por su cuenta — la regla tiene dos disparadores y solo se desactivó el
que dependía de una cifra ausente.

### 2. La cédula viajaba cruda en el diagnóstico «sanitizado» (gravedad alta, PHI)

`san()`, dentro de `downloadDiagnostic`, tacha con `···` todo el **texto** visible de la
tarjeta —y ya había pruebas de cero PHI para eso—, pero de los atributos solo vaciaba los
`data-*`: los cinco de `KEEP` (`class`, `role`, `routerlink`, `type`, `name`) se conservaban
con su **valor original**. Angular escribe rutas como `[routerLink]="['/paciente', doc.cedula]"`,
así que la cédula podía salir de la clínica dentro de un archivo llamado
`diagnostico_vigilante_SANITIZADO.txt`.

No se borran los atributos —su presencia y su forma son justo lo que hace útil el
diagnóstico—: se va el dato. Cualquier corrida de **4 o más dígitos** pasa a `···`.

    /Paciente/1122334455   ->  /Paciente/···        (identificadores sintéticos)
    /hc/1122334455/lab/98765 ->  /hc/···/lab/···
    card patient-link      ->  card patient-link    (las clases no se tocan)
    col-6                  ->  col-6                (los números cortos tampoco)

**Por qué esto nunca se había probado**, y qué se hizo al respecto: el DOM del banco no tiene
`cloneNode` ni atributos iterables, así que `san()` entera no se puede ejecutar allí (`grep`
de `cloneNode` en `tests/`: cero coincidencias). El saneador se saca a **función propia con
nombre** (`_diagValorAtributoSeguro`) y se prueba de verdad; la rama que lo llama se fija con
una comprobación **estructural**, declarada como tal en la propia prueba en vez de disfrazarse
de comprobación de conducta.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 107 | vuelve `egfr < 30` (coerción de null) en la hiperkalemia | *sin función renal medida no se inventa una eGFR de cero* | Sí — 21 ok |
| 108 | vuelve `egfr < 60` en metformina + contraste | la misma | Sí — 21 ok |
| 109 | el atributo conservado se reescribe con su valor original | *ningún atributo conservado se escribe sin pasar por el saneador* | Sí — 40 ok |
| 110 | el saneador de atributos no tacha nada | *el diagnóstico «sanitizado» no deja pasar una cédula* | Sí — 40 ok |

Quedan **45 hallazgos confirmados** del enjambre sin aplicar, con su reproducción y su arreglo
propuesto en `docs/ENJAMBRE_FUNCIONES_20260901.md`.

---

## v18.0.46 — tres más del enjambre: una tilde, un cero y una coma

Tres defectos de gravedad alta que comparten forma: **un carácter** —una tilde, un cero, una
coma— y en los tres el fallo del programa se le presentaba al médico como un hecho sobre el
paciente. Los tres comprobados contra la cabeza actual antes de tocar nada.

### 1. Una tilde apagaba el módulo de PyM la jornada entera

`findDocIdx` no quitaba acentos. Los encabezados llegan en mayúsculas y recortados, pero no
sin tildes, así que una columna llamada **«CÉDULA»** —la ortografía correcta en español—
fallaba por las dos vías: no coincide exacto con `"CEDULA"` de `DOC_EXACT`, y
`includes("CEDULA")` tampoco, por la É. `makeIndexer` entonces lanza «No se encontró la
columna con la identificación del paciente» y **el módulo de Actividades Preventivas queda
apagado todo el día**.

Se normaliza dentro de la función y no en los llamadores porque son tres, y **uno vive dentro
del Web Worker** (`findDocIdx` se serializa con `.toString()`): arreglar solo el de arriba
habría dejado roto el camino normal de un `.xlsx`. `stripAccents` ya se serializa antes que
ella, así que se puede usar. De paso queda robusto a un encabezado sin `toUpperCase`.

### 2. Un RAC de 0 de hoy perdía contra un RAC de 45 de enero

Auto-Labs escribía en la historia el **45** —albuminuria franca, de hace meses— y decía
«✓ casillas escritas» en verde. No salía en `sinCasilla` ni en `implausibles`: el médico veía
y firmaba un dato falso.

La causa estaba a un nivel de distancia. `_labNumerico` termina en `n > 0 ? n : null`, y ese
cero se rechaza **a propósito** («nunca 0, que en una creatinina sería catastrófico») — pero
esa exclusión es **global para los 13 analitos**, y el desempate de `_nuevoReemplazaCandidato`
la reutilizaba como si significara «no es un número». En el RAC, donde 0 sí es un resultado
posible, el valor real y más reciente quedaba tratado como texto y perdía contra cualquier
valor viejo distinto de cero.

**No se toca `_labNumerico`**: su cero sigue siendo veneno donde debe serlo. Lo que cambia es
el desempate, y solo para los dos analitos donde el cero es un resultado de verdad —RAC y
uroanálisis—, con una lista corta y explícita porque ampliarla es una decisión clínica. Y solo
un cero **limpio** (`0`, `0.0`, `0,00`): un rango `0-2` o un `NEGATIVO` siguen sin ser número.

### 3. Una coma entrecomillada borraba a un paciente, en silencio

`parseCSV` era `l.split(",")` a pelo. Un apellido escrito `"Pérez, Juan"` —lo que produce
Excel al exportar cualquier campo con coma— corría todas las columnas siguientes un puesto,
la del documento devolvía el texto equivocado, y el paciente **no entraba ni en `map` ni en
`todos`**. Y como tampoco estaba en `todos`, el panel le decía al médico, con toda confianza,
que ese paciente «NO aparece en la lista de prevención de hoy».

Ahora se lee carácter a carácter con las reglas de CSV de verdad: campo entrecomillado,
comillas escapadas por duplicación, y **saltos de línea dentro de un campo** (que el
`split("\n")` de antes tampoco podía manejar).

> **Y una prueba que era el guardaespaldas del defecto.** `suite_16` decía «NO interpreta
> comillas» *como si fuera una decisión* y clavaba el resultado roto para que nadie lo
> cambiara. Un comentario que llama «a propósito» a un defecto es peor que el defecto: la
> prueba deja de proteger y pasa a defenderlo. Reescrita.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 111 | `findDocIdx` vuelve a no quitar tildes | *una tilde no puede apagar el módulo de PyM* | Sí — 14 ok |
| 112 | el desempate vuelve a usar `_labNumerico` a pelo | *un RAC de 0 de hoy le gana a un RAC de 45* | Sí — 140 ok |
| 113 | el cero se acepta en TODOS los analitos | *el cero sigue siendo veneno donde un 0 no es un paciente sano* | Sí — 140 ok |
| 114 | vuelve el `split(",")` ingenuo | *una coma dentro de comillas ya no parte la fila* (2 fallan) | Sí — 26 ok |

Banco completo: **2.845 comprobaciones pasan, 0 fallan.** Quedan **41 hallazgos confirmados**
del enjambre sin aplicar, documentados en `docs/ENJAMBRE_FUNCIONES_20260901.md`.

---

## v18.0.47 — dos del enjambre en la misma función: el `fetch` que nunca vuelve y el 401 que nadie contaba

Los dos en `_pageFetchJsonCore`, el núcleo por el que pasa **toda** llamada del asistente a
Everest.

### 1. Una conexión colgada bloqueaba para siempre la acción REAL del médico

La segunda vía (`GM_xmlhttpRequest`) lleva `timeout: 15000` desde siempre. La primera —la que
se usa en el 100 % de los casos normales— **no tenía ninguno**. Una conexión que acepta y no
responde (la red de la sede cayendo a medias, un proxy que no cierra) no da error: se queda
abierta. Y como todo aquí se hace con `await`, la acción que la disparó —**Agendar**,
**Guardar orden**, **Buscar paciente**— se cuelga con ella. Sin error, sin aviso, sin vuelta.

Ahora la petición lleva `AbortController` con el **mismo tope de 15 s**, sacado a constante
(`PAGE_FETCH_TIMEOUT_MS`) para que las dos vías no puedan volver a separarse en silencio. Al
abortar, el flujo sigue por donde ya iba para un fallo de red — incluida la regla de v11.0.1 de
**no reenviar una escritura**, que aquí importa más que nunca: la petición abortada pudo haber
llegado al servidor.

### 2. Una sesión caducada se trataba igual que un «no existe»

Un **401/403** caía en el mismo `return null` que un 404 y **nunca** llamaba a
`_apiMarcarResultado(false)`: no contaba como fallo, no abría el cortacircuitos y no ponía en
rojo el panel de salud. El asistente se quedaba ciego —sin fuente de agenda, sin avisos de
llegada— y por dentro seguía creyéndose sano. El médico no tenía **una sola señal**.

No se reintenta (reintentar un 401 no lo arregla) pero **sí se cuenta**. Y la contención: un
404 o un 400 son respuestas legítimas, no un API caído, y siguen sin contar — contarlas
abriría el cortacircuitos por nada.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 115 | se quita el aborto por tiempo del `fetch` | **el banco entero se colgó**: `suite_05` no terminó ni con 180 s de tope — la demostración más literal posible del defecto | Sí — 29 ok |
| 116 | el 401 vuelve al `return null` mudo | *un 401 SÍ cuenta como fallo* | Sí — 29 ok |
| 117 | cualquier 4xx cuenta como fallo (contención rota) | *un 404 NO es un fallo del API* | Sí — 29 ok |

La 115 merece subrayarse: **no puso una prueba en rojo, dejó al banco sin terminar.** Un
defecto que se manifiesta como «nada vuelve nunca» no produce un fallo que se pueda leer —
produce silencio, que es justo lo que le pasaba al médico delante del paciente.

Banco completo: **2.847 comprobaciones pasan, 0 fallan.** Van **7 de los 47** del enjambre.

---

## v18.0.48 — el cruce de pacientes, cuarto sitio: la historia clínica se archivaba bajo quien estuviera abierto al LLEGAR

Hallazgo del enjambre de funciones, gravedad alta. `mirar()`, dentro de `mtrHcEnganchar`,
leía `extractPacienteAbierto()` **en el momento de la llegada de la respuesta**, no en el de
la petición. Entre las dos hay segundos de red — y Everest **recarga la página** al abrir un
paciente. Si el médico cambia de historia en ese lapso, los antecedentes, hábitos y examen
físico del paciente **anterior** quedaban archivados bajo la cédula del **nuevo**, y de ahí
salen a alimentar al Redactor y al Panel.

Es el mismo defecto, por cuarta vez, en un sitio distinto:

| versión | dónde | qué se cruzaba |
|---|---|---|
| v14.1.5 | `injectLabsIntoCronicos` | los laboratorios |
| v18.0.33 | Panel del paciente | tensión, peso y cintura |
| v18.0.34 | agendamiento y widget de Fármacos | el resumen clínico |
| **v18.0.48** | **`mtrHcEnganchar`** | **la historia clínica entera** |

Se cierra con la guarda que ya existía —`_pacienteSigueAbierto(idAlPedir)`—, anotando en el
`send`/`fetch` quién estaba abierto al **pedirlo**. La rama `"envio"` corre de forma síncrona
dentro del propio `send`, así que ahí el paciente es por construcción el correcto y no lleva
guarda; el riesgo vivía solo en los dos caminos asíncronos. Y el descarte **se dice por
consola**: callarlo sería indistinguible de no haber leído nada.

### Y una prueba que se rompía sola

`v17.12.0 — la escucha no rompe Everest` cortaba el fuente con `iEng + 6000`, un número
mágico. Mi comentario hizo crecer la función y la prueba se puso **roja sin que el código
estuviera mal** — la peor forma de fallar, porque la siguiente persona sube el número y no
mira más. Ahora corta por un **ancla real** y comprueba que el ancla exista, para que un
renombre la ponga en rojo por el motivo correcto en vez de medir un trozo cualquiera. De paso
sus dos regexes ahora **exigen** el argumento de identidad.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 118 | se quita la guarda de identidad | *una historia que llega tras cambiar de paciente NO se archiva* | Sí — 42 ok |
| 119 | el `fetch` vuelve a no anotar quién pidió la historia | la anterior + la de fuente (2 fallan) | Sí — 42 ok |
| 120 | la guarda acepta que no se pueda LEER la cédula | *tampoco se archiva a ciegas* | Sí — 42 ok |

La 120 es la que importa de las tres: sin ella, un DOM que Angular está re-renderizando —cuando
la cédula no se puede leer— haría pasar la historia por buena. La regla del proyecto es la
contraria: **sin cédula legible, no se escribe.**

Banco completo: **2.849 comprobaciones pasan, 0 fallan.** Van **8 de los 47** del enjambre.

---

## v18.0.49 — la dosis del otro principio activo, y un cero pegado a una cifra real

### 1. En una combinación de dosis fija se leía la dosis del OTRO principio (gravedad alta)

«Amlodipino/Atorvastatina 5/40mg» es una presentación real y común en HTA + dislipidemia.
`mtrDosisDeTexto` tomaba **el primer número que hubiera después del nombre buscado**, y
después de «atorvastatina» lo primero que aparece es el **5 del amlodipino**.

Medido de punta a punta:

    mtrDosisDeTexto("Amlodipino/Atorvastatina 5/40mg …", "atorvastatina")  ->  5   (la real es 40)
    mtrEstatinaAltaIntensidad([…])                                        ->  null
    mtrInerciaEstatina(true, […])  ->  "LDL en falla SIN estatina de alta intensidad: revise intensidad"

Esa última frase es **clínicamente falsa** para un paciente que ya está en atorvastatina 40 mg
—el techo habitual de esa dosis fija— y empuja a subir una dosis que ya está bien, o a
desconfiar de un dato que sí es correcto.

En una combinación los números van en el **mismo orden que los nombres** («A/B N1/N2»), así
que se emparejan por posición: es la única lectura que la presentación permite. Y cuando no
hay pareja clara —un combo con un solo número, como «Amlodipino/Atorvastatina 5 mg», donde ese
5 puede ser de cualquiera de los dos— **no se adivina**: se devuelve vacío. Ahí estuvo el
detalle fino del arreglo: hay que distinguir «esto no es un combo» de «es un combo y no se
puede emparejar», porque confundirlos devuelve el llamador a la lectura vieja y al mismo
error. Lo primero es `undefined`, lo segundo `null`.

### 2. «PA Descontrolada (0/105)» (gravedad alta según el enjambre; cosmético según su refutador)

La guarda de la v17.8.1 se escribió **justo para esto** —no imprimir un dato falso pegado a
uno real, «(165/NaN)», «(165/0)»— y quedó **coja**: exigía `pad > 0` pero nunca `pas > 0`. Con
la sistólica en 0 (lectura fallida) y una diastólica real de 105, salía **«(0/105)»**.

El refutador tenía razón en una cosa y se anota: la **conducta no cambia**, porque
`paDescontrolada` ya era cierto por la diastólica sola, así que la franja horaria sugerida es
la misma. Lo que cambia es lo que el médico **lee**. Se arregla igual: la guarda que el
proyecto ya había decidido tener, completa en vez de a medias.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 121 | se quita el emparejamiento por posición | *cada dosis se empareja con SU principio* (2 fallan) | Sí — 41 ok |
| 122 | un combo sin emparejar vuelve a caer a la lectura de siempre | *si no se puede emparejar, se devuelve vacío* | Sí — 41 ok |
| 123 | se emparejan **al revés** | *cada dosis se empareja con SU principio* | Sí — 41 ok |
| 124 | la guarda de la PA vuelve a quedar coja | *nunca imprime un cero como si fuera media lectura* | Sí — 41 ok |

La 123 merece la pena: sin ella, invertir el emparejamiento habría pasado la prueba del caso
principal (la atorvastatina saldría 40 igual si solo se comprobara ese) — por eso la prueba
comprueba **los dos** principios del mismo texto.

Banco completo: **2.852 comprobaciones pasan, 0 fallan.** Van **10 de los 47** del enjambre.

---

## v18.0.50 — el reporte del médico de esta mañana: «nunca me avisó que el paciente llegó»

**Reporte en vivo (1-sep), textual:** *«HOY NO ME AVISÓ SOBRE CUANDO LLEGÓ UN PACIENTE, PASÓ DE
ESTADO "SIN PRESENTARSE" A "EN SALA" MIENTRAS YO ATENDÍA A OTRA PACIENTE CON SU HISTORIA
CLÍNICA ABIERTA Y NUNCA ME AVISÓ»*. El enjambre de funciones lo encontró el mismo día por su
cuenta, reproducido con el arnés — dos caminos independientes al mismo defecto.

### La causa

El candado de leyendas era **uno solo por paciente y por día** (`legend|<cédula>`), compartido
por **tres avisos que dicen cosas distintas**:

| aviso | qué dice |
|---|---|
| MORADO | «última llamada»: queda ~1 min de gracia |
| VERDE | **«confirmó a tiempo»: el paciente YA ESTÁ EN SALA** |
| AZUL | checklist de cierre de consulta |

El primero de los tres que ocurriera en el día **gastaba el único cupo**. Y MORADO → VERDE no
son dos avisos rivales: son **las dos etapas de la misma espera**, en ese orden y con segundos
de diferencia. Cualquier paciente que confirme en el último minuto dispara el MORADO y, acto
seguido, el VERDE. No era un caso raro: era **el** caso.

Resultado: el médico recibía la alarma de «se está por vencer» y **nunca la buena noticia de
que sí llegó**. Podía creer que el paciente seguía sin confirmar teniéndolo en sala.

El candado se mantiene —su motivo original sigue en pie— pero pasa a ser **por tipo de
leyenda**. Tres avisos distintos, tres cupos; el mismo aviso, uno solo. El `tipo` es
obligatorio: dejarlo opcional habría permitido que un llamador nuevo volviera a compartir cupo
sin notarlo, que es exactamente cómo nació este defecto.

### Y el hueco de siempre, mordiendo por tercera vez en la sesión

La primera versión de la prueba de contención comprobaba `_legendMarcaUnaVez` **directamente**.
Con eso, **borrar la llamada entera desde `maybeNotify` dejaba el banco en verde**: el candado
se probaba a sí mismo y nadie vigilaba que siguiera conectado. Es el mismo hueco de v18.0.33 y
v18.0.36 — **comprobar que una función se porta bien no comprueba que se llame**.

La prueba se rehízo por conducta, sobre el canal real (`crossTabDup` escribe su marca en
`localStorage` dentro de `_dispararAvisoAudible`, así que la marca existe si y solo si el aviso
llegó a dispararse), y con el segundo VERDE bajo **otra clave de cita y el mismo paciente**,
para que la deduplicación de 12 s de `crossTabDup` no pudiera tapar el resultado.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 125 | el candado vuelve a ser uno solo por paciente (**el defecto reportado**) | *el aviso de última llamada ya no se come el de que llegó* (2 fallan) | Sí — 81 ok |
| 126 | se quita el candado del todo (vuelve el ruido que lo motivó) | *una leyenda NO se repite para el mismo paciente* | Sí — 81 ok |

La 126 es la que hubo que ganarse: en su primer intento **no mordió**, y eso destapó el hueco
de alcanzabilidad de arriba.

Banco completo: **2.854 comprobaciones pasan, 0 fallan.** Van **11 de los 47** del enjambre, y
queda cerrado el segundo de los cinco reportes en vivo del médico.

---

## v18.0.51 — «lo mandé a desactivar y sale en todas las pestañas»: el quinto y último reporte en vivo

**Reporte del médico (1-sep), textual:** *«EL BOTON DE "ORDENAR PENDIENTES" ESTÁ ACTIVO Y YO LO
MANDÉ A DESACTIVAR. LO PEOR ES QUE SALE EN TODAS LAS PESTAÑAS ENFRENTE DE TODO»*. El enjambre
de funciones lo confirmó y lo reprodujo con el arnés.

### Un arreglo a medias, de mi propia mano

La **v18.0.7** ya había atendido este mismo reporte… **para uno de los tres widgets
flotantes**. Los tres usan idéntica arquitectura —se pintan en `document.body` con
`position:absolute` y coordenadas de PÁGINA, y solo se esconden dentro de **su propio tick**,
que corre únicamente con `secc === "historia"`— pero el rescate del tick general
(`mtrOcultarBotonOrdenarPendientes`) tocaba **solo** `#vgl-cw-ordenar-btn`.

Medido por el enjambre: al navegar a «Citas del día», `#vgl-cw-examenes` y `#vgl-cw-farmaco`
seguían con `display:""` — la pastilla 🧪 de exámenes y la 💊 de alertas farmacológicas
flotando sobre la lista de citas **con el juicio clínico del PACIENTE ANTERIOR**. Eso no es
estorbo: es un dato clínico de una persona encima de la pantalla de otra.

### Y la primera mitad del reporte era el mismo defecto por el otro lado

*«Lo mandé a desactivar y sigue activo»*: apagar `S.conductaWidgets` solo surtía efecto **la
próxima vez que corriera el tick de cada widget**, o sea **solo estando dentro de una
historia**. Un widget ya huérfano en otra pantalla no se enteraba nunca de que el médico lo
había apagado.

Por eso el apagador se llama ahora en **las dos** situaciones: fuera de la historia **y** con
el interruptor apagado. Y los tres widgets se agrupan en una sola función a propósito: **tener
un apagador por widget es exactamente cómo se quedaron dos sin él.**

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 127 | el apagador vuelve a tocar solo un widget | *retira LOS TRES widgets flotantes* | Sí — 85 ok |
| 128 | el tick general vuelve a llamar solo al apagador viejo | *los retira al salir de la historia Y al apagar el interruptor* | Sí — 85 ok |

Banco completo: **2.856 comprobaciones pasan, 0 fallan.**

**Los cinco reportes en vivo del médico quedan cerrados**: la regresión de diseño (v18.0.42),
el grounding antiguo (v18.0.36), la agrupación de exámenes (v18.0.43), el aviso de llegada del
paciente (v18.0.50) y este. Del enjambre van **12 de 47**.

---

## v18.0.52 — el apellido real podía llegar intacto a Gemini

Hallazgo del enjambre de funciones, gravedad alta, reproducido con el arnés. Viola
directamente la regla no negociable de `CLAUDE.md`: **cero PHI**.

En texto **en mayúsculas sostenidas** —el estilo real de Everest— la defensa por TOKENS es la
**única** capaz de tachar el nombre: la de honoríficos exige mayúscula inicial + minúsculas y
no puede actuar. Y tenía dos huecos:

| hueco | medido |
|---|---|
| `t.length >= 3` descartaba apellidos de dos letras (Li, Wu, Ng, Ho, Vo) | «…CON LA FAMILIA **LI** EN CASA…» salía **sin tachar** |
| sin normalizar tildes, «Muñoz» no casaba con «MUNOZ» | «PACIENTE **MUNOZ** REFIERE…» salía **sin tachar** |

El segundo no es un caso raro: el desajuste entre el nombre registrado con tilde y su
aparición sin ella es **la norma** en cualquier sistema que pase el texto a ASCII. Ahora el
patrón casa en las **dos direcciones** —«Muñoz» encuentra «MUNOZ» y «Munoz» encuentra
«MUÑOZ»— convirtiendo cada letra con variantes acentuadas en una clase que las admite todas.

### Por qué NO se hizo lo que proponía el hallazgo

El arreglo propuesto era «bajar el filtro a 1 o quitarlo». Eso censuraría **cada «de» y cada
«la»** del texto clínico y lo dejaría ilegible — exactamente el defecto que ya costó la
v18.0.25 («la tachadura de nombres destrozaba el texto clínico»). Un hallazgo puede tener
razón en el diagnóstico y equivocarse en la receta.

Se hizo con **mínimo dos letras, menos una lista corta de partículas** (`de, del, la, los, y,
san, van, von, di, mac…`) que no identifican a nadie por sí solas. Comprobado: con el nombre
«Pedro De La Cruz», «CRUZ» se tacha y «DOLOR DE CABEZA DE LA MAÑANA» **queda entero**.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 129 | vuelve el filtro de 3 letras | *un apellido de dos letras también se tacha* | Sí — 45 ok |
| 130 | se quita la tolerancia a tildes | *la tilde no puede ser un escondite* | Sí — 45 ok |
| 131 | se quita la lista de partículas | *las partículas NO se censuran: destrozarían la nota* | Sí — 45 ok |

La 131 es la que protege el arreglo **de sí mismo**: sin ella, endurecer la censura un poco
más habría vuelto a romper el texto clínico y el banco no se habría enterado.

Banco completo: **2.859 comprobaciones pasan, 0 fallan.** Van **13 de los 47** del enjambre.

---

## v18.0.53 — el kill-switch se activaba en silencio total

Hallazgo del enjambre de funciones, gravedad alta, **verificado en Chromium con el CSS real**.

El médico usa «modo oculto» (Ctrl+Shift+V) para trabajar sin la interfaz del Vigilante *«sin
apagar su trabajo de fondo»* — es la promesa explícita de esa función, y el estado **sobrevive
recargas** por diseño. Si el consultorio dispara el kill-switch remoto con el modo oculto
encendido, `emergencyTeardown` para el reloj y borra la interfaz… y el **único** aviso que lo
delata (el cartel rojo de Pausa de seguridad) lo escondía **nuestra propia hoja de estilos**,
porque su id estaba dentro del grupo que el modo oculto apaga.

    SIN modo oculto  → #vgl-pausa-clinica: block   · #vgl-root: flex
    CON modo oculto  → #vgl-pausa-clinica: none    · #vgl-root: none     (antes)
    CON modo oculto  → #vgl-pausa-clinica: block   · #vgl-root: none     (después)

El médico seguía tecleando creyendo que el asistente vigilaba vigencias, fraude y PyM cuando
ya no vigilaba nada. **Y el propio comentario de ese bloque de CSS ya tenía escrita la regla,
dos líneas más arriba**: *«los sonidos críticos de fraude NO se apagan: son seguridad, no
decoración»*. El cartel del kill-switch es exactamente eso.

**Dos capas, y ninguna sobra.** (1) Su id sale del grupo: inmune al modo oculto por diseño.
(2) `_mostrarAvisoPausaClinica` apaga el modo oculto entero — si mañana alguien añade otra
regla que esconda cosas, este aviso ya no depende de que se acuerde de excluirlo.

Verificador nuevo: `tools/verificar_pausa_modo_oculto.js`.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 132 | el aviso vuelve a la lista del modo oculto | *es inmune al modo oculto* | Sí — 11 ok |
| 133 | el kill-switch deja de apagar el modo oculto | *le gana a una preferencia de interfaz* | Sí — 11 ok |
| 134 | se vacía la lista entera en vez de sacar un id | *el modo oculto sigue escondiendo el panel* | Sí — 11 ok |

La 134 es la contención: sin ella, «arreglarlo» borrando el grupo entero habría dejado el modo
oculto sin ocultar nada, y el banco no se habría enterado.

Y una nota de proceso: el comentario de este arreglo se escribió **dos veces**. El primero
llevaba backticks y la palabra de prioridad dentro de un comentario de CSS — las dos trampas
que ya mordieron hoy (v18.0.42 rompió el parseo, v18.0.44 falseó el censo). Documentadas en la
bitácora esta mañana y aun así reincididas la misma tarde: por eso quedan escritas **dentro
del propio comentario**, donde el siguiente que edite esa zona las va a leer.

Banco completo: **2.861 comprobaciones pasan, 0 fallan.** Van **14 de los 47** del enjambre.

---

## v18.0.54 — «PRESIÓN ARTERIAL DE 110/70» en la nota, y 136/85 en la pantalla

**Reporte en vivo del médico (1-sep)**, con captura de su pantalla de Examen físico y de la
nota generada. Peso (70), cintura (95) e IMC (27,34) coincidían; **solo la tensión estaba
mal**, y estaba mal de la peor forma: una cifra que nadie midió hoy, firmada en la historia
como hallazgo del examen físico de hoy.

### Dos defectos encadenados

**(1) Se prefería la casilla equivocada.** Everest tiene DOS pares de tensión: **«T.A:*»**
—obligatoria, la que el médico llena siempre— y **«T.A Acostado:»** —opcional, vacía en su
captura—. `mtrLeerTensionDelDom` pedía **primero la de acostado**.

**(2) El respaldo nunca leía la diastólica**: devolvía `pad: null` cableado. Así que en el
mejor de los casos la tensión de hoy llegaba **a medias**.

**Y entonces la mitad que faltaba se rellenaba sola.** El refresco del resumen resolvía las
dos cifras con dos `num(nuevo, previo)` **independientes**:

    paSistolica:  num(fNue.paSistolica,  fPrev.paSistolica)
    paDiastolica: num(fNue.paDiastolica, fPrev.paDiastolica)

Sistólica de una toma + diastólica de otra = una presión arterial **que no existió nunca**,
impresa como una sola medición de hoy.

### El arreglo

- El lector prefiere la **obligatoria** y lee **siempre las dos cifras**; la de acostado queda
  como lo que es, un respaldo para cuando sea la única que hay.
- **Las dos cifras viajan juntas o no viajan**: si la lectura nueva trae al menos una, manda
  la nueva **entera** (aunque la otra quede vacía — una casilla vacía es honesta); solo si no
  trae ninguna se usa la anterior, y entonces **las dos** de la anterior. Es el mismo
  principio todo-o-nada de `mtrPanelFactoresDePantalla` (v18.0.33), pero aquí el cruce no es
  entre pacientes: es entre **mediciones del mismo paciente**.

### Lo que NO se da por cerrado, y por qué

Los nombres de campo de esta fila **no están verificados contra el DOM real**, y los ids de
Everest ya engañaron a este proyecto una vez (cuatro campos comparten dos ids; la cintura solo
es alcanzable por su rótulo — ver `_mtrRotuloDeCampo`). Así que se prueban varios nombres por
casilla y queda `DIAGNOSTICO_TENSION_CASILLAS.js` para fijarlos **con evidencia** en
consultorio, igual que se hizo con la cintura. Lo que esta versión sí garantiza, sean cuales
sean los ids: **nunca se mezclan dos mediciones**.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 135 | vuelven los dos `num()` independientes (**el defecto reportado**) | *la sistólica y la diastólica se deciden con la misma condición* | Sí — 22 ok |
| 136 | el lector vuelve a preferir la casilla de acostado | *manda la tensión obligatoria* (2 fallan) | Sí — 19 ok |
| 137 | el respaldo vuelve a no leer la diastólica | *se leen siempre las dos cifras* | Sí — 19 ok |

Banco completo: **2.863 comprobaciones pasan, 0 fallan.**

---

## v18.0.55 — claves de programador en el papel que firma el médico, y una fecha que el modelo se inventó

Los otros dos defectos del reporte del 1-sep, encontrados comparando la nota generada contra
las capturas de la pantalla.

### 1. `COLESTEROL_LDL` en un documento clínico

La sección de la nota salía así:

    :: PRÓXIMOS LABORATORIOS (EN ~3 MESES):
    COLESTEROL_LDL
    GLUCOSA
    UROANALISIS

Es la **Regla C** del proyecto —«lo que lee un humano no lleva identificadores de
programador», hallazgo #61— incumplida en el peor sitio posible.

La causa no era el JSON: `order_list` lleva claves **a propósito**, y su propio comentario lo
explica («sus lectores las cruzan con el catálogo de CUPS; meterle nombres libres la
rompería»). El defecto era que **el prompt le pedía a la IA imprimir esa lista tal cual**. Se
añade la lista **paralela** `order_list_legible`, construida con el traductor único que ya
existe y ya está probado (`mtrNombreLegibleAnalito`), y el prompt pasa a listar esa. La de
claves sigue viajando para quien la necesita.

### 2. Una fecha de calendario que nadie le dio al modelo

La nota decía **«CITA CONTROL DE RIESGO CARDIOVASCULAR EL 2026-12-03»**. Comprobado con el
arnés sobre el JSON real que recibe el modelo:

    Fechas ISO crudas en el JSON que va a la IA: (ninguna)
    ftl_date: "en 14 días"   ·   control_date: "en 21 días"

**Ni una sola fecha de calendario viaja al modelo** —todas se relativizan a propósito, porque
una fecha exacta es un cuasi-identificador—. Así que **esa fecha la calculó él solo** a partir
del plazo, y el médico se la encuentra firmada como si fuera una cita agendada. Es exactamente
el primero de los tres daños que el médico marcó en la entrevista: *«se inventa cifras que
nadie midió»*.

Dos cambios, porque una plantilla no basta para cerrar una tentación: la plantilla pierde el
«EL» que invitaba a poner una fecha, y se añade una regla explícita —*«NUNCA conviertas un
plazo en una fecha de calendario … Una fecha que tú calculas es una cita que nadie agendó»*.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 138 | el prompt vuelve a listar las claves crudas | *el prompt manda listar la lista legible* | Sí — 155 ok |
| 139 | la lista legible se arma sin el traductor | *ninguna entrada puede tener forma de clave* | Sí — 155 ok |
| 140 | se quita la prohibición de calcular fechas | *se le prohíbe de frente convertir el plazo en fecha* | Sí — 155 ok |

La 139 es la que importa del par: sin ella, añadir el campo y llenarlo con las mismas claves
habría pasado la prueba del prompt y dejado el defecto intacto.

Banco completo: **2.866 comprobaciones pasan, 0 fallan.**

---

## v18.0.56 — el uroanálisis anormal que la nota no mencionaba

Cuarto y último defecto del reporte del 1-sep. La pantalla del médico mostraba el uroanálisis
como **ANORMAL**, con **esterasa leucocitaria 3+** y hematíes 3,20; la sección de REVISIÓN
PARACLÍNICA de la nota **no lo mencionaba en absoluto**, y el plan volvía a pedir uroanálisis
sin decir nada del que ya estaba alterado.

### Dos causas encadenadas

**(1) La sección del prompt no tenía sitio para él.** Sus ítems eran cuatro —función renal,
perfil lipídico, metabolismo glucídico y análisis de metas— y ninguno era el uroanálisis. El
modelo escribía exactamente lo que se le pedía.

**(2) Y aunque lo hubiera tenido, no había qué escribir.** Los valores leídos entraban a
`mtrEvaluarUroanalisis`, se usaban para decidir… **y no salían**. El objeto devuelto llevaba la
conclusión (`estado`, `criterios`, `conducta`) pero nunca los valores, así que ningún
consumidor —ni el Panel, ni la nota, ni la IA— podía **nombrar** lo que el parcial mostró.

    uro_valores (antes)   : []
    uro_valores (después) : ["esterasa: 3+", "nitritos: NEGATIVO"]

### La contradicción que había que evitar al arreglarlo

Con esterasa 3+ el motor devuelve `itu_estado: "SIN HALLAZGOS"` — y **es correcto como
decisión**: la esterasa sola, sin recuento de piuria, no es criterio de ITU, y no tratar una
bacteriuria asintomática es una regla clínica ya acordada. Pero escrito en la nota junto a
«esterasa 3+» se leería como una contradicción.

**No se toca la etiqueta**: «SIN HALLAZGOS» es un rótulo clínico del médico y lo esperan varias
pruebas. Lo que se hace es decirle al modelo qué significa: *«se refiere ÚNICAMENTE a criterios
de infección urinaria; si hay valores alterados y dice SIN HALLAZGOS, escribe que NO HAY
CRITERIOS DE INFECCIÓN URINARIA — nunca que el uroanálisis fue normal, porque no lo fue»*.

Y sin uroanálisis evaluado, el ítem **se omite entero**: no se afirma que fue normal ni que no
se hizo. Casilla vacía antes que dato inventado.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 141 | los valores vuelven a no salir del motor | *los valores del uroanálisis salen del motor* | Sí — 157 ok |
| 142 | la sección del prompt vuelve a no tener uroanálisis | *la revisión paraclínica tiene un ítem de uroanálisis* | Sí — 157 ok |
| 143 | se quita la regla de no llamarlo normal | *no puede llamarlo normal* | Sí — 157 ok |

### Queda anotado, y es decisión del médico

`mtrHallazgosUroDesdeLabs` capturó `esterasa` y `nitritos` pero **no los hematíes** (3,20 en su
pantalla). La hematuria no llega al motor. No se toca aquí porque cambiar qué componentes del
parcial se vigilan es una decisión clínica, no técnica.

Banco completo: **2.868 comprobaciones pasan, 0 fallan.** Los **cuatro** defectos del reporte
del 1-sep quedan cerrados.

---

## v18.0.57 — una negación se llevaba por delante todo lo que compartiera frase con ella

Hallazgo del enjambre de funciones, gravedad alta, reproducido con el arnés.

La lista vieja de negadores (v17.6.30) se probaba como **substring sobre la frase entera**, sin
mirar dónde estaba el negador respecto del término clínico — y encima corría **antes** del
arreglo por proximidad de la v18.0.17, cortocircuitándolo. Cinco frases perfectamente normales
en una historia:

| texto | diabetes leída como |
|---|---|
| «Niega tabaquismo, es diabético e hipertenso» | **NEGADA** (y la HTA también) |
| «No fuma, pero es diabético» | **NEGADA** |
| «Paciente diabético e hipertenso, niega tabaquismo» | **NEGADA** |

El daño va en las dos direcciones, y ninguna es cosmética. `mtrDiscrepanciasDeFuentes` marca
diabetes e HTA con severidad **ALTA**, y una discrepancia alta **frena la apertura del Panel
del paciente** hasta que el médico responda un cuadro «Las fuentes no coinciden» sobre un dato
que él mismo acaba de afirmar por escrito. Y al revés es peor: un paciente diabético leído como
no diabético cambia qué tabla de vigencias rige y baja su riesgo cardiovascular.

Las dos listas se unifican en **una sola comprobación por proximidad**, la que la v18.0.17 ya
había escrito bien: el negador tiene que estar cerca del término **y en la misma cláusula**. Se
conserva el caso real que ese comentario protege —«sin control, diabético descompensado» es una
AFIRMACIÓN— porque la ventana no puede cruzar la coma.

Detalle que costó una vuelta: la alternancia va **de la forma más larga a la más corta**. Con
`no` delante, `no refiere` nunca se reconocería entero y la ventana quedaría corta.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 144 | vuelve la lista vieja sin proximidad (**el defecto**) | *negar UN hecho no niega los demás de la misma frase* | Sí — 50 ok |
| 145 | se pierde la frontera de coma | *«sin control, diabético» es una afirmación* (3 fallan) | Sí — 50 ok |

### Y una trampa de PROCESO, nueva y de las que engañan

Las mutaciones 145 y 146 **salieron verdes en el primer intento**, y estuve a punto de
apuntarlo como «la prueba no muerde». No era eso: mi `replace(..., 1)` sustituía la **primera**
aparición del patrón en el archivo, que estaba **dentro del comentario que acababa de escribir**
—porque el comentario cita la regla textualmente—, no en la línea de código. La mutación editaba
prosa y dejaba el código intacto.

**Una mutación que no muerde exige comprobar primero que la mutación se aplicó.** Un verde
después de mutar puede significar dos cosas muy distintas —la prueba es hueca, o la mutación
no llegó— y confundirlas hace descartar una prueba que sí servía. Al repetirlas contra la línea
real, la 145 tumbó 3 comprobaciones. La 146 (reordenar la alternancia) sigue sin morder de
verdad: se anota como hueco conocido en vez de inventarle una prueba a medida.

Banco completo: **2.870 comprobaciones pasan, 0 fallan.** Van **15 de los 47** del enjambre.

---

## v18.0.58 — la base piloto vieja podía pisar el PyM real de hoy, y decirlo al revés

Hallazgo del enjambre de funciones, gravedad alta, reproducido con el arnés.

`loadPymBaseDescarga` comprueba `state.pymFile && !state.pymFallback` **dos veces** —antes y
justo después de `readPym`— precisamente para no pisar un PyM real que haya llegado mientras
tanto. Pero `pilotoGuardar` empaqueta el índice con `packPym`, **que cede el hilo varias
veces**, y después de ESE `await` ya no se volvía a mirar.

Si en esa ventana `loadPymDiario` —que corre cada 10 minutos en la misma pestaña— termina de
cargar el archivo real de hoy, las líneas de abajo lo reemplazan por la base piloto. Reproducido:
`state.pym.size` pasaba de **1 (el paciente real) a 0 (la piloto)**.

Y el daño no acaba en el reemplazo:

- `applyPymIdx` se llama **sin el 5.º parámetro**, así que `state.pymDia` se vacía y
  `debeBuscarPymDiario()` vuelve a creer que la lista de hoy no se ha cargado.
- El médico ve el cartel ámbar **«Usando la base piloto (mientras llega la de hoy)»** — una
  afirmación **falsa**, porque la de hoy ya había llegado.
- Y consulta actividades de referencia desactualizadas sobre pacientes reales hasta el
  siguiente ciclo.

El arreglo es **la misma guarda, una tercera vez**, justo antes de aplicar. La copia en disco
se sigue guardando —eso está bien, sirve para mañana—; lo que no puede pasar es **aplicarla**
encima de la lista buena.

### Mutación verificada

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 147 | se quita la tercera guarda (**el defecto**) | *si el PyM real de hoy llega mientras se guarda la piloto, la piloto NO lo pisa* | Sí — 46 ok |

La prueba abre la ventana de la carrera de verdad: envuelve `GM_setValue` y, en el instante en
que `pilotoGuardar` escribe la copia, simula que la otra corrutina acaba de aplicar el PyM real.
No es una simulación teórica — es lo que pasa en consultorio cuando el archivo de la sede
aparece a media mañana.

Banco completo: **2.871 comprobaciones pasan, 0 fallan.** Van **16 de los 47** del enjambre.

---

## v18.0.59 — «Deshacer» revertía una casilla distinta de la que el médico creía

Hallazgo del enjambre de funciones, gravedad alta, reproducido con el arnés. Rompe una de las
reglas no negociables del proyecto —«la casilla del médico es sagrada»— **desde el propio botón
que existe para rescatarla**.

La ranura de deshacer es única, y desde v17.0.1 se avisa antes de destruir un lote vivo… pero
ese aviso solo se daba `if (anterior !== etiqueta)`. Con el **mismo botón pulsado dos veces**
—Athenea respondió distinto la segunda vez, o simplemente se reintentó— la etiqueta es
idéntica: **no había aviso y el primer lote se perdía igual**.

    clic 1  ->  escribe la casilla A
    clic 2  ->  escribe la casilla B      (el lote de A se pierde, en silencio)
    ↩ Deshacer  ->  revierte solo B, y canta «volvió exactamente a como estaba»

El médico cree que corrigió el dato malo del primer clic. Ese dato sigue escrito en la historia
**sin ninguna forma de deshacerlo**.

### El arreglo, y el detalle que lo hace correcto

Se toma la mejor de las dos salidas posibles: con el **mismo paciente y el mismo botón**, y el
lote vivo, los pares nuevos se **acumulan** en vez de reemplazar — así «Deshacer» revierte todo
lo que ese botón escribió en la tanda de clics, que es lo que el médico espera. Y cuando de
verdad se sustituye un lote (otro botón, otro paciente) **se avisa siempre**, ya sin la
condición de la etiqueta.

**El detalle que decide la corrección:** al acumular, si una casilla ya estaba en el lote se
conserva su valor previo **más viejo** y se descarta el nuevo. Deshacer tiene que devolver la
casilla a como estaba **antes de la primera escritura automática**, no a como la dejó el clic
anterior — que también era nuestro. Sin eso, «deshacer» dejaría dentro un valor que el médico
nunca escribió.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 148 | vuelve el reemplazo en vez de acumular (**el defecto**) | *el mismo botón dos veces revierte LAS DOS casillas* | Sí — 45 ok |
| 149 | al acumular se pisa el valor previo viejo con el nuevo | *vuelve al valor anterior a TODO lo automático* | Sí — 45 ok |

La 149 es la que protege el arreglo de sí mismo: acumular mal deja la casilla con un valor que
también escribimos nosotros, y el toast seguiría diciendo «volvió exactamente a como estaba».

Banco completo: **2.871 comprobaciones pasan, 0 fallan.** Van **17 de los 47** del enjambre.

---

## v18.0.60 — la memoria clínica del paciente se orfanizaba en silencio

Hallazgo del enjambre de funciones, gravedad alta, reproducido con el arnés.

`_vglCosechaGuardar` escribía **siempre bajo el docId crudo**. Pero un registro archivado antes
de la canonicalización de v17.48.0 vive bajo la clave con ceros de relleno («0000111111»), y
`extractPacienteAbierto()` entrega hoy la canónica («111111»). La primera cosecha del día
—basta con que el médico entre a Antecedentes o Hábitos— creaba una clave **nueva y vacía**, y
el almacén quedaba con **dos entradas del mismo paciente**.

Y la tolerancia de lectura no salva: `_vglBuscarPorDoc` devuelve la coincidencia **exacta**
antes de buscar la canónica, así que a partir de ahí gana siempre la vacía.

Lo que desaparecía sin un solo aviso: la **confirmación de embarazo** (severidad alta, vigencia
30 días), la de adherencia, los **programas de Ruta Crónicos** y el resto del contexto ya
documentado. La compuerta vuelve a preguntar lo ya respondido y el clasificador de riesgo se
queda sin comorbilidades.

Se resuelve la clave de **escritura** con el patrón que `_noShowRegistrar` ya usa desde
v17.53.0 para su propio almacén: si el paciente ya tiene entrada bajo cualquier forma de su
cédula, se escribe encima de esa; solo si no existe ninguna se crea con la canónica de hoy.

### Una precisión que salió al escribir la prueba, y se anota en vez de exagerar el daño

**`factores` NO era lo que se perdía.** `_vglCosecharFactoresVisibles` relee el archivo con
`_vglCosechaLeer` —que sí es tolerante con la forma de la cédula— y entrega el mapa ya
fusionado, así que los factores se rescataban solos por esa vía. Lo que se perdía eran las
claves de primer nivel que **nadie prefusiona**: `programas`, `confirmaciones` y cualquier otra
que se añada mañana. La primera versión de la prueba afirmaba lo contrario y se puso roja: se
corrigió la prueba, no el código.

### Una prueba ajena que este arreglo dejó sin sentido, y por qué se reescribió

`suite_64` fabricaba el duplicado **llamando dos veces a `_vglCosechaGuardar`** con las dos
formas de la cédula. Desde esta versión eso ya no produce un duplicado — que es justo el
objetivo. La prueba se rehace montando el duplicado **como se produce de verdad**: un registro
que quedó en disco escrito por una versión anterior. El detector sigue haciendo falta
exactamente para eso: **los duplicados viejos ya están en las máquinas.**

### Mutación verificada

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 150 | vuelve a escribir bajo la clave cruda (**el defecto**) | *una cosecha nueva no orfaniza la memoria archivada* | Sí — 45 ok |

Banco completo: **2.873 comprobaciones pasan, 0 fallan.** Van **18 de los 47** del enjambre.

---

## v18.0.61 — «falta el peso» sobre un peso que sí estaba

Hallazgo del enjambre de funciones, gravedad alta, reproducido con el arnés.

El motor **ya distingue** «dato ausente» de «dato presente pero implausible»: por eso existe
`peso_fuera_de_rango` (20–300 kg) además de `peso`. Pero solo la creatinina tenía su bloque
propio de mensaje; el peso caía en la rama genérica y el diccionario `ETIQUETA` lo traducía
**igual que si nunca se hubiera tomado**:

    peso = 15 kg registrado  ->  «Función renal: no se puede calcular — falta el peso.»

Un 15 en vez de 51, o la talla escrita en la casilla del peso, es **exactamente** el error de
transcripción que ese rango existe para atrapar. Y el mensaje hace dos cosas mal a la vez: dice
algo **falso** —el dato sí está en Everest— y manda al médico a **tomar signos vitales otra
vez** en vez de a corregir una casilla concreta.

Ahora recibe el mismo trato explícito que su caso gemelo, **con el valor delante**:

> 🫘 **Función renal:** no se puede calcular — el peso registrado (**15** kg) queda fuera del
> rango plausible (20–300 kg). **El dato SÍ está en Everest**, así que no hace falta volver a
> tomar los signos vitales: revise esa casilla, suele ser un dígito de más o de menos, o la
> talla escrita en el lugar del peso.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 151 | se quita el bloque propio (**el defecto**) | *un peso implausible NO se anuncia como ausente* | Sí — 43 ok |
| 152 | el bloque nuevo se traga también el peso AUSENTE | *un peso realmente ausente sigue diciendo que falta* (2 fallan) | Sí — 43 ok |

La 152 es la contención: sin ella, «arreglarlo» de más habría hecho lo contrario —decir que un
peso que no existe está mal digitado— y el médico iría a revisar una casilla vacía.

Banco completo: **2.875 comprobaciones pasan, 0 fallan.** Van **19 de los 47** del enjambre.

## v18.0.62 — un parpadeo del documento anulaba el antirrebote y fabricaba una llegada

Hallazgo del enjambre de funciones, gravedad alta, reproducido con el arnés.

El proyecto ya sabía que **el `doc_id` aparece y desaparece entre lecturas** —la API lo trae, el
respaldo por DOM a veces no— y lo tiene escrito en el comentario de `apptKey`. Por eso los
CONJUNTOS de fraude (`fraudWatch`, `alertedFraud`) se leen y se marcan con
`_apptMarcada`/`_apptMarcar`, que cubren todas las identidades de la cita.

Los MAPAS `state.historical`, `state.historicalAt` y `state.estadoPendiente` no tenían
equivalente: leían y escribían con la clave **cruda**. Un parpadeo del documento cambia la
clave de la MISMA cita, y con eso:

1. `esNueva` sale `true` → **el antirrebote de v17.6.21 queda anulado por completo**: la
   tarjeta salta a VERDE «En Sala» con una sola lectura sin confirmar. Es exactamente el
   defecto que aquella versión cerró, reabierto por la puerta del documento en vez de la del
   estado.
2. Sin ningún cambio real de estado, se genera una **segunda llegada fantasma**
   (`arrival: true` otra vez): el aviso vuelve a sonar por un paciente que ya estaba en sala.
3. `historicalAt` vuelve a 0 → «hueco largo» → la guarda de v18.0.8 desactiva el antirrebote
   por su cuenta, aunque el punto 1 estuviera resuelto.

Ahora los tres mapas usan `_apptMapaLeer` / `_apptMapaEscribir` / `_apptMapaBorrar`. Leer
tolerante **no basta**: si la vuelta siguiente solo trae el nombre, no hay forma de derivar la
clave por documento — hay que haberla escrito antes. Por eso se escribe bajo todas las
identidades, igual que `_apptMarcar`, y por eso el borrado tiene que barrer las mismas
entradas que la escritura sembró.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 153 | la escritura vuelve a anotar solo bajo la clave cruda (**el defecto**) | *no se cuenta como segunda llegada* + *no anula el antirrebote* + *el candidato no sobrevive* (3 fallan) | Sí — 86 ok |
| 154 | la lectura de `historical` vuelve a `.get(key)` a pelo | *si el documento APARECE entre lecturas* + *el candidato no sobrevive* (2 fallan) | Sí — 86 ok |
| 155 | la lectura de `historicalAt` vuelve a `.get(key)` a pelo | *la marca de tiempo del antirrebote sobrevive al parpadeo* | Sí — 86 ok |
| 156 | el borrado de `estadoPendiente` solo quita la clave cruda | *el candidato del antirrebote no sobrevive bajo la otra identidad* | Sí — 86 ok |

Las cuatro muerden por vías distintas y ninguna es redundante: 153 cubre el parpadeo
documento→sin-documento, 154 el inverso (sin-documento→documento, donde no hay clave por
documento que derivar), 155 la mitad del antirrebote que vive en la marca de tiempo, y 156 la
puerta de atrás —un candidato que sobrevive a su propia confirmación y se acepta a la primera
lectura la próxima vez que vuelve por la otra vía—.

**Precisión de proceso.** La primera versión de este arreglo solo hacía la lectura tolerante, y
la sonda seguía dando llegada fantasma: con el documento perdido no existe forma de derivar la
clave por documento. Y las mutaciones 154 y 155 **no mordieron** contra la primera tanda de
pruebas, porque escribir bajo todas las identidades ya dejaba el valor bajo la clave cruda: las
que faltaban eran las pruebas del sentido inverso, no código. Se corrigieron **las pruebas**.

Banco completo: **2.880 comprobaciones pasan, 0 fallan.** Van **20 de los 47** del enjambre.

## v18.0.63 — reabrir «Ordenar» creaba una segunda orden real del mismo examen

Dos hallazgos del enjambre de funciones, los dos con respaldo en la telemetría real del
1-sep (ver `docs/TELEMETRIA_20260901.md`).

### A. El duplicado de órdenes (hallazgo #19, gravedad alta, 3 de 3 refutadores fallaron)

El único filtro antiduplicado que vivía DENTRO del modal era la consulta EN VIVO a Everest, y
el propio código documenta que **«un fallo de red aquí NO bloquea nada»**. Si esa consulta
falla —o si Everest simplemente todavía no indexó la orden que el script acaba de crear—
reabrir el modal ofrecía «Generar» otra vez, en silencio y con el mismo mensaje de éxito. Con
una mamografía o un PSA eso no es un renglón administrativo de más: **es un examen repetido de
verdad al paciente**.

La marca local `markOrdenesCreadasHoy` existía desde la v12.3, pero guardaba agrupadores y
etiquetas del Excel — **nunca QUÉ paquete**. Ahora guarda también los CIE-10, y el modal:

1. **No premarca** un paquete ya ordenado hoy, y lo dice con todas las letras. No lo bloquea:
   el médico manda y puede tener un motivo real para repetirlo.
2. **Relee la marca justo antes de cada POST**, no solo al pintar. Y se omite **solo** si la
   casilla venía premarcada por el script y el médico no la tocó — si la tocó él, la decisión
   es suya y se respeta.
3. **Escribe la marca en cuanto el servidor confirma cada orden**, no al terminar el lote. Es
   lo que cierra la ventana de la reproducción: generar → cancelar a mitad → reabrir.
4. Cuando todo lo seleccionado se omite por duplicado, el mensaje ya no dice «no se pudo
   generar ninguna… puede reintentar sin riesgo de duplicar» —que era falso y además el
   consejo exactamente contrario al correcto—: dice que ya estaban generadas.

**Respaldo en la telemetría del 1-sep:** «Ordenar» es el embudo con más abandono de todo el
script (6 abiertos, 2 completados, **4 abandonados**), y abandonar a mitad del lote es
literalmente el gesto de la reproducción.

Una marca ANTERIOR a esta versión no lleva la lista de CIE-10 y por tanto **no dice nada**
sobre qué paquete se ordenó: se trata como «sin evidencia» y no desmarca nada. Casilla vacía
antes que dato inventado.

### B. Los íconos propios se reportaban como de Everest (hallazgo #27)

En un `<svg>` —y hay 45 íconos así, varios dentro de botones `.vgl-*`— `className` es un
`SVGAnimatedString`, no un string: `String(...)` daba `"[object SVGAnimatedString]"`, que nunca
empieza por `vgl-`, así que un ícono NUESTRO caía en la etiqueta `host` (= de Everest). Es
justo el error de atribución que el comentario de ese bloque dice evitar.

**Confirmado en el export real del 1-sep:** `rum.self.inp.detalle.host.needs_imp` = 7 —
interacciones de NUESTRA interfaz (`rum.self.*`) atribuidas a Everest. Ahora se lee la clase
con `getAttribute("class")`, igual que ya hacía `_rumNodoEsNuestro` dos líneas más arriba.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 157 | se quita la guarda antes del POST (**el defecto**) | *reabrir «Ordenar» y volver a pulsar NO crea una segunda orden real* | Sí — 187 ok |
| 158 | la guarda ignora que el médico tocó la casilla | *si el médico marca él mismo la casilla, la orden SÍ se repite* | Sí — 187 ok |
| 159 | el modal vuelve a premarcar lo ya ordenado hoy | *el modal no premarca lo que ya se ordenó hoy, y lo dice* | Sí — 187 ok |
| 160 | la marca vuelve a escribirse solo al final del lote | *la marca se escribe en cuanto el servidor confirma cada orden* | Sí — 187 ok |
| 161 | `ordenCreadaHoyParaCie10` afirma sobre una marca vieja | *una marca ANTERIOR no afirma nada* | Sí — 187 ok |
| 162 | `_rageEtiqueta` vuelve a `String(className)` | *un icono SVG NUESTRO no se reporta como de Everest* | Sí — 103 ok |

Las 158, 159 y 161 son contenciones: sin ellas, «arreglarlo» de más habría bloqueado al
médico, desmarcado exámenes que quizá nunca se pidieron, o convertido una marca sin datos en
una afirmación.

**Precisión de proceso — una prueba que pasaba por el motivo equivocado.** La primera versión
de la prueba del duplicado **compartía el objeto de casilla falsa entre las dos aperturas**, y
tras crear la orden el propio código la deja `checked = false`: la segunda vuelta no
seleccionaba nada, así que no había nada que duplicar y la prueba habría pasado igual sin el
arreglo. **La mutación 157 la destapó** (no mordió). Se da una casilla nueva en cada apertura,
como hace el DOM real al repintar. Es la décima forma de prueba hueca de estas jornadas, y la
regla vuelve a ser la misma: *una mutación que no muerde no absuelve al código, acusa a la
prueba.*

Banco completo: **2.886 comprobaciones pasan, 0 fallan.** Van **22 de los 47** del enjambre.

## v18.0.64 — cuatro reportes en vivo del médico en una sola tarde

Todo lo de esta versión salió de reportes con captura del 1-sep, con el script corriendo en
consulta real. El análisis de la telemetría que los acompaña está en
`docs/TELEMETRIA_20260901.md`.

### A. «Se sigue colando el azul de Everest» — y esta vez en TODO el script

Dos capturas: «atendidas de su agenda» (Productividad) y el 🫀 de «Abandono Programa RCV»
(recuadro clínico), los dos en el azul oscuro de Everest. Y la orden: *«LOCALÍZALO EN TODO EL
SCRIPT Y ELIMÍNALO, SOLAMENTE MI SCRIPT DEBE TENER MI PROPIO CSS NADA DE EVEREST»*.

`CLAUDE.md` documenta dos formas de fuga. Esta es **una tercera que no estaba escrita**: una
clase NUESTRA que **no declara color en absoluto** y depende de heredar. Un valor heredado no
participa en la cascada — pierde SIEMPRE contra cualquier regla que apunte al elemento, tenga
la especificidad que tenga. El blindaje tipográfico existente no la cubre porque lleva
`:not([class])` a propósito, justo para no competir con nuestras clases de acento.

Se escribió `tools/auditar_color_todo_chromium.js`, que **no lleva lista escrita a mano**:
deriva los candidatos de la hoja real y del HTML real, los monta en su contenedor real y los
mide en Chromium contra un Everest hostil. Resultados:

| censo | antes | después |
|---|---|---|
| declaraciones de color sin prioridad | 0 | 0 |
| clases con texto propio y sin color declarado | **36** | **0** |

Dos correcciones del propio programa durante el barrido, las dos porque el resultado no era
creíble: (1) su primer filtro descartaba las costuras de concatenación y con eso se le escapó
`.vgl-pym-ic` —el círculo del emoji que el médico ve azul en su captura—; (2) leía el CSS por
extracción textual y no podía resolver `MTR_RCV_CSS_TODOS_LOS_MODALES`, dejando **14.500
caracteres de CSS real sin medir**. Ahora ejecuta el script en el arnés y lee el `<style>` que
de verdad genera: 267.336 caracteres, cero marcadores sin resolver.

Y una cuarta fuga, de otra familia: la pastilla «⏳ Abriendo la pestaña Conducta…» del Redactor
IA pinta su color **en línea**, que es inmune a cualquier regla normal pero NO a una con
prioridad. La **Regla R** del banco existe exactamente para esto y no la vio: su patrón miraba
solo la PRIMERA cadena del `cssText`, y aquí el color vive en la segunda. Es la misma ceguera
que la v18.0.42 ya cerró en la otra rama de esa regla; ahora consume la concatenación entera.

**Dos intentos descartados por el propio banco**, los dos por el bug #1 de `CLAUDE.md` (nuestra
regla nueva peleando con la nuestra vieja): escribir el blindaje como `#vgl-root .clase`
(1,1,0) empataba con `#vgl-paquete-modal .vgl-paq-aldia` —la Regla A lo cazó—, y escribirlo
como `#vgl-root :where(.clase)` (1,0,0) habría ganado a cualquier clase de acento suelta, que
es el mismo bug por la puerta de atrás. Queda como clase a secas, la forma del resto de la hoja.

### B. «¿Cómo así que 23/36?» — Productividad medía otra cosa

*«¿NO DEBERÍA MÁS BIEN MOSTRAR CUÁNTOS PACIENTES HE VISTO DE LOS QUE TENGO QUE VER A LA
SEMANA? ¿Y ASÍ TAMBIÉN CON EL DEL MES?»*

El denominador era «la meta de los días que ya trabajó» (un martes: 2 × 18 = 36), que responde
a otra pregunta. Ahora es la meta COMPLETA del periodo, con los días que faltan incluidos:
**23/90** la semana, **10/396** el mes. Qué días cuentan:

- domingo y festivo: nunca — él lo confirmó por escrito: *«YO NO TRABAJO NI DOMINGOS NI FESTIVOS»*;
- un día pasado sin ninguna atendida: tampoco (protección que ya existía, no reprochar un día
  que no le tocaba);
- hoy y los días futuros de lunes a viernes: sí;
- un **sábado futuro**: no. Sus sábados no son fijos y su propia telemetría lo prueba — trabajó
  el sábado 22-ago y no el 29-ago. Darlo por hecho inflaría la meta en 24 pacientes.

Y el COLOR pasa a seguir al **ritmo** (contra lo que ya debería estar hecho), no al avance
sobre el periodo: sin eso, el día 1 del mes la tarjeta saldría en rojo con un 2,5 % que no
significa que vaya mal, sino que el mes acaba de empezar.

Las atendidas se suman siempre, aunque el calendario diga que ese día no tocaba: el numerador
no puede depender de que nuestra tabla de festivos esté bien (ya tuvo un 2024-11-18 erróneo).

### C. «¿49 avisos hoy? ¿No es mucho?» — el CSV de auditoría se inundaba

De los 49 eventos de su CSV real, **36 eran legítimos** (10 pacientes × 2 CAMBIO_ESTADO + 10
INGRESO_A_TIEMPO, más 3 inasistencias con su ÚLTIMA_LLAMADA) y **13 eran una misma constancia
repetida**: una sola cita la generó SIETE veces. La rama que la escribe no marca `fraudWatch`
a propósito, así que sin candado propio volvía a escribirla en cada vuelta del reloj mientras
durase la gracia del relevo — y esa gracia se reabre cada vez que el médico cambia de pestaña.
El CSV es el documento con el que él reclama: repetir un hecho siete veces no añade evidencia,
la entierra. Ahora es UNA por cita, con dos conjuntos separados (uno por tipo de constancia),
porque `_apptMarcar` añade además las claves legadas SIN prefijo y con un solo conjunto un
tipo habría tapado al otro.

### D. «Última toma completa» no hacía lo que dice

*«DEBE FUNCIONAR COMO EL DE ABAJO … LA DIFERENCIA ES QUE SOLAMENTE TRAE LOS RESULTADOS DE LOS
ÚLTIMOS 90 DÍAS … PARA AMBOS DEBE SER EL ÚLTIMO RESULTADO DISPONIBLE POR CADA ANALITO».*

**No estaba configurado así.** Se quedaba con los resultados de UNA sola fecha, la máxima: si
la toma más fresca solo traía creatinina y glicemia, el LDL de doce días antes —dentro de los
90— desaparecía de la pantalla aunque fuera el último disponible de ese analito. Ahora la
ventana es de 90 días y la elección del último por analito la sigue haciendo
`injectLabsIntoCronicos`, igual que la opción de abajo. Si ninguna fecha se puede leer, se
devuelve la lista tal cual: un fallo de parseo no puede borrarle la pantalla.

### Mutaciones verificadas

| # | Qué se rompió | Cómo se destapó | Restaurado y verde |
|---|---|---|---|
| 163 | `.vgl-prod-cap` se queda sin color (**el defecto de la captura**) | el barrido del Resumen: 2 nodos secuestrados | Sí |
| 164 | se quita el blindaje de las 34 clases | el barrido completo: 35 clases secuestradas | Sí |
| 165 | la pastilla del Redactor pierde su prioridad | *Regla R* de suite_25 | Sí |
| 166 | la ventana de 90 días vuelve a ser «solo la fecha máxima» | *conserva el último de CADA analito* (2 fallan) | Sí |
| 167 | sin fechas legibles se devuelve vacío | *no se le borra la pantalla al médico* | Sí |
| 168 | la meta del periodo vuelve a ser la de los días trabajados | *la meta incluye los días por delante* | Sí |
| 169 | las atendidas de un festivo vuelven a perderse | *la semana suma lunes y miércoles* | Sí |
| 170 | la constancia vuelve a escribirse en cada tick (**el defecto del CSV**) | *UNA vez por cita, no una por tick* | Sí |
| 171 | el candado se hace global y calla otra cita | *sigue registrándose para OTRA cita distinta* | Sí |

Las 167, 169 y 171 son contenciones: sin ellas, «arreglarlo» de más habría dejado la pantalla
de laboratorios en blanco, borrado pacientes realmente atendidos, o enterrado evidencia de una
cita distinta.

**Precisión de proceso.** La corrección del CSS entró tres veces y las tres la rechazó el
banco antes de llegar al médico: dos por colisión de especificidad con nuestras propias clases
de acento (Reglas A y P) y una por los censos de `!important`, cuyo reparto entre la hoja
principal y las spliceadas **no era el que deduje leyendo el diff** — hubo que medirlo. Queda
escrito en la propia suite: *si vuelven a moverse, medirlos otra vez antes de tocarlos.*

Banco completo: **2.890 comprobaciones pasan, 0 fallan.**

## v18.0.65 — el cuadro «Las fuentes no coinciden» lo dejaba encerrado

**Bloqueo en consulta real, reportado en vivo con captura (01-sep):** *«ME ESTÁ SALIENDO ESTE
MENSAJE Y NO ME DEJA AVANZAR, NI CERRAR EL MÓDULO, LE DOY QUE SÍ TIENE ESAS ENFERMEDADES Y AÚN
ASÍ VUELVE Y ME APARECE INDEFINIDAMENTE».*

El cuadro frena un ítem si NO está confirmado **o** si está «desfasado» (su respuesta dice una
cosa y la casilla de la historia dice la contraria). Responder guardaba la respuesta… pero no
cambiaba la casilla de la historia, así que la contradicción seguía ahí en la vuelta siguiente
y el ítem volvía a frenar. **La única respuesta capaz de cerrar el cuadro era la que coincidiera
con la historia**: si el médico sabía que el paciente SÍ es diabético y la casilla decía que no,
quedaba encerrado sin salida.

Lo más incómodo es que el propio comentario del reconciliador ya decía la intención —«vuelve a
preguntar **UNA vez** en lugar de callarse»— pero **el mecanismo del “una vez” no existía**.

Ahora la respuesta guarda también qué decía la pantalla cuando él respondió (`vp`), y el
desfase solo vuelve a frenar si la historia dice algo **distinto** de lo que él ya vio y
resolvió. Una contradicción nueva sí merece preguntarse otra vez; la misma de siempre, no. Lo
que NO cambia: la historia sigue mandando sobre el valor — resolver el bloqueo no reescribe el
documento oficial. Y una respuesta guardada por una versión anterior (sin `vp`) se sigue
tratando como antes: se vuelve a preguntar una vez, que es el comportamiento documentado.

### Y los textos del módulo de agendamiento

*«NO QUIERO QUE APAREZCAN ESOS DOS TEXTOS CONTRADICTORIOS EN MI PUNTO DE VISTA, SOLO QUIERO
SIMPLIFICAR LO MÁS POSIBLE EL MÓDULO YA QUE MUY POCO LO USAN Y SI LO ABARROTAMOS DE TEXTO MENOS
LO USARÍAN».*

En su captura, el recuadro de sugerencia decía «toma de laboratorios **21 nov**» y justo debajo
el aviso decía «la toma quedaría el **lun 23 nov**»: dos fechas de toma en pantalla a la vez —
una la sugerida, otra la derivada de la fecha que él eligió— leídas como una contradicción. Y
la fecha sugerida aparecía **tres veces** en el mismo cuadro: en el recuadro, en el cuerpo del
aviso y en el botón.

- El aviso deja de repetir la fecha de la toma: dice el hecho y nada más — qué examen llega
  vencido y por cuántos días. De 3 frases a 1.
- Se retira la frase «La fecha que el asistente sugiere … es el X»: el recuadro de arriba ya la
  dice y el botón se llama «Pasar a la fecha sugerida».

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 172 | vuelve el bucle: se ignora lo que el médico ya vio (**el defecto**) | *responder cierra el cuadro aunque la historia siga diciendo lo contrario* (2 fallan) | Sí |
| 173 | se deja de guardar lo que la historia decía al responder | las mismas dos | Sí |
| 174 | el candado se hace ciego y calla también un choque NUEVO | *una contradicción NUEVA sí se vuelve a preguntar* (3 fallan) | Sí |
| 175 | el aviso vuelve al texto largo que repetía la fecha | *ya no abre repitiendo la fecha* | Sí |

La 174 es la contención, y es la que importa: «arreglarlo» de más habría convertido un cuadro
que molesta demasiado en uno que se calla cuando de verdad hay algo nuevo que decir. La 175 no
mordió en el primer intento —ninguna prueba fijaba el texto nuevo— y se añadió la que faltaba
antes de darla por buena.

Banco completo: **2.892 comprobaciones pasan, 0 fallan.**

## v18.0.66 — el canal de errores llevaba muerto desde la v17.2.0

Orden del médico, sin matices: *«Lo más grave: el canal de errores lleva muerto desde la
v17.2.0 — DEFINITIVAMENTE HAY QUE BLINDAR ESTO».*

### El hallazgo, y por qué era invisible

En el export del tablero del 1-sep, la hoja `error` no tiene **ni una fila** de ninguna versión
por encima de **17.2.0**. Y no es que no haya errores: el 27-ago, seis equipos distintos en
v18.0.4 emitieron **81 `error.js` / 81 `error.distintos`** en `uso_detalle` — los contadores
que `reportarError` incrementa en su **primera línea**, antes del tope diario y antes de
`repOn()`. La función corrió 81 veces y no llegó ninguna fila.

No era el transporte: `entorno`, `fraude` y `prueba` **sí** llegan desde v18 por la misma cola
y el mismo `repPost`. La diferencia estaba en la fila. De los cuatro eventos, `error` era el
único que mandaba un campo **sin columna en la hoja**:

| | campos que viajan | ¿todos tienen columna? |
|---|---|---|
| `entorno` | nav · so · zona · pantalla · gestor | sí |
| `fraude` | hora · min | sí |
| `prueba` | (ninguno extra) | sí |
| **`error`** | origen · msg · donde · migas · **veces** | **no: `veces` no existe** |

`veces` se añadió en la **v17.1.0 (#148)** — la versión exacta a partir de la cual se corta el
historial. El receptor envuelve su trabajo en un try/catch que responde `err` con HTTP 200, que
`repPost` trata como fallo desde la v17.49.0: la fila se quedaba en la cola para siempre.

El dato no se pierde: la cuenta de repeticiones se dobla dentro de `msg`, que sí tiene columna.

### Tres blindajes, porque es la TERCERA vez que este canal se calla

v14.1.6 (el filtro de `ev.filename`) y v17.1.0 #148 (el recorte de la cola por la cabeza) fueron
las dos anteriores. Arreglar el campo no basta:

1. **Nada interno viaja en la fila.** `repPost` manda una copia sin las claves que empiezan por
   `_`. La contabilidad de reintentos que este mismo cambio introduce habría sido, si no,
   exactamente el defecto que cierra: otro campo que la hoja no sabe escribir.
2. **La cola no se atasca detrás de una fila envenenada.** `repFlush` rompía el bucle al primer
   fallo — correcto con el panel caído, fatal cuando el servidor rechaza una fila CONCRETA: esa
   fila falla siempre, se queda la primera, y nada de lo que va detrás sale nunca. Ahora cada
   fila lleva su cuenta de intentos; a los tres (tres vueltas del temporizador de 10 minutos,
   media hora) se descarta, se anota el descarte y se sigue. Un corte de red sigue rompiendo el
   bucle como antes.
3. **Que el silencio se vea.** Lo que dejó esto muerto medio año no fue el campo de más: fue que
   nadie podía notarlo. Se añade `error.entregado` junto al `error.js` que ya existía; la
   diferencia entre detectados y entregados delata el canal roto desde la telemetría de uso —
   la que sí funciona— sin exportar nada ni esperar a que el médico lo reporte.

### Y los sábados, que ahora se saben

*«LOS SÁBADOS DE TRABAJO SON CADA 2 SEMANAS, ME TOCA ESTE SÁBADO NUEVAMENTE 5/09/2026».*

La v18.0.64 dejaba fuera de la meta **todo** sábado futuro porque no había forma de saber
cuáles le tocaban. Con su ancla sí se sabe, y el resultado se valida solo contra su propia
telemetría: el 22-ago le tocaba **y trabajó** (1.534 eventos), el 29-ago no le tocaba **y no
trabajó** (ni uno). Las metas quedan **23/114** la semana y **10/444** el mes.

El ancla es un dato suyo, no una constante técnica: si su turno cambia, se cambia en un solo
sitio.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 176 | vuelve el campo sin columna (**el defecto**) | *la fila de error solo lleva campos que la hoja tiene como columna* (2 fallan) | Sí |
| 177 | la contabilidad interna vuelve a viajar a la red | *nada interno se cuela en la fila* | Sí |
| 178 | la cola vuelve a atascarse en la primera fila mala | *una fila rechazada no puede callar el resto de la cola* | Sí |
| 179 | los sábados del médico se ignoran otra vez | *3 × 18 + 24 del sábado que le toca* | Sí |
| 180 | se cuentan TODOS los sábados, le toquen o no | la misma | Sí |

**Precisión de proceso.** La 177 **no mordió** en el primer intento: la prueba llamaba a
`_repFilaLimpia` directamente, así que quitar su uso en `repPost` no la rompía — la trampa de
alcanzabilidad de siempre. Se reescribió por conducta, mirando lo que de verdad sale por la red
en una fila que ya acumuló reintentos.

Banco completo: **2.896 comprobaciones pasan, 0 fallan.**

## v18.0.67 — el 50 % por fuera de metas ahora lo decide el médico

Regla nueva suya (01-sep), con la instrucción explícita de comprobar que no chocara con lo que
ya existe. Chocaba en dos sitios; los dos los resolvió él en la entrevista. Todo queda escrito
en `docs/REGLAS_MEDICO_20260901.md`.

### La regla

> *«Cuando un paciente se encuentra fuera de metas al momento de calcular los exámenes que se
> ordenarán en el siguiente control se le debe preguntar al médico que si en ese paciente desea
> repetir los exámenes fuera de metas sí o no. Si la respuesta es sí se repiten al 50 % de la
> vigencia original, si la respuesta es no se repiten en su vigencia normal sin adelantar.»*

- **UNA pregunta por paciente**, con la lista de exámenes fuera de meta delante (decisión suya:
  menos interrupciones). Severidad media: se ofrece, no retiene el flujo.
- **Vale solo para esta consulta.** El estado del paciente cambia entre citas.
- **Se repiten sí o sí, sin preguntar:** creatinina en suero con **TFG por Cockcroft-Gault < 60**
  y **RAC > 30 mg/g**.
- **Mientras no responda, manda la conducta de siempre** (adelantar). El script no cambia nada
  por su cuenta: hace falta un «no» explícito suyo para relajar una vigencia.

### Las dos colisiones, y cómo las resolvió él

**KDIGO manda sobre su respuesta.** Con TFG < 60 el perfil lipídico no se adelanta aunque
responda que sí, y por eso los lípidos ni siquiera entran en la pregunta — pero la pantalla lo
DICE, con el motivo. Callar por qué un examen no aparece en la lista convertiría la regla en una
caja negra.

**La creatinina obligatoria usa Cockcroft-Gault**, como él la dictó, mientras la regla vecina
(KDIGO) usa CKD-EPI 2021. Son números distintos y un mismo paciente puede quedar a un lado u
otro del 60 según cuál se mire. Se respeta lo que pidió y queda escrito en el código para que
nadie las unifique creyendo que es un descuido.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 181 | el «no» del médico se ignora (la regla no se implementa) | *el NO del médico relaja la vigencia* | Sí |
| 182 | el «no» apaga también los dos obligatorios | *la creatinina y la RAC no dependen de la respuesta* | Sí |
| 183 | la creatinina obligatoria pasa a CKD-EPI | *manda Cockcroft-Gault* (2 fallan) | Sí |
| 184 | KDIGO deja de mandar y el lípido entra en la pregunta | *el lípido lo frena KDIGO* | Sí |

Las 182, 183 y 184 son contenciones, y las tres protegen una decisión clínica que él tomó
explícitamente: sin ellas, «implementar la regla» habría desactivado dos exámenes que él quiere
siempre, cambiado a qué pacientes les aplica la obligatoriedad, y contradicho la precedencia que
él fijó entre su regla y KDIGO.

Banco completo: **2.901 comprobaciones pasan, 0 fallan.**

## v18.0.68 — el ancla de sábado es por médico, no una constante del script

**Corrección del propio médico sobre su pedido anterior**, la misma tarde: *«no es lo mismo
para todos los médicos, toca indagar médico por médico cuál de todos los sábados le toca
laborar, pero el ancla de 5 septiembre me sirve a mí, a maría edineth pino, a sinai mijares».*

La v18.0.66 escribió `MTR_PROD_SABADO_ANCLA` como constante del script — correcto para tres
médicos concretos y equivocado para cualquier otro que use el mismo instalador. Ahora es un
ajuste (`S.sabadoAncla`, campo de fecha en Ajustes), con el 5-sep como valor predeterminado —
sigue funcionando sin tocar nada para quien ya lo usaba, y cualquier otro médico pone el suyo.

Reglas nuevas explícitas:
- **Ancla vacía = no trabaja sábados.** No es «no se sabe»: es una respuesta, y la respuesta es
  que ningún sábado le suma meta.
- **Un ancla que no cae en sábado no se adivina de cuál habla**: se ignora.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 185 | ancla vacía deja de significar «no trabaja sábados» | ninguna (ver nota) | — |
| 186 | un ancla mal escrita ya no se ignora | *el 8-sep es martes, no un ancla válida* | Sí |
| 187 | se ignora `S.sabadoAncla` y siempre usa el predeterminado | *otro médico con turno desfasado* | Sí |

**Nota sobre la 185.** No mordió, y no es una prueba hueca: `mtrFechaDesdeIso("")` ya devuelve
`null`, así que el `if (!f || !a) return false;` de la línea siguiente cubre el caso vacío por
otra vía. La guarda explícita es una redundancia **deliberada** — documenta la intención («ancla
vacía = respuesta, no ausencia de dato») para quien lea el código después, aunque hoy el
resultado ya esté garantizado aguas abajo. Se deja tal cual: quitarla no cambia el
comportamiento actual, pero borraría la explicación.

Banco completo: **2.902 comprobaciones pasan, 0 fallan.**

## v18.0.69 — el módulo consulta cupo de laboratorio antes de sugerir la toma

Encargo del médico (01-sep), con caso real: *«el módulo debe consultar la disponibilidad de
agendas de laboratorios antes de sugerir una fecha, porque hoy 01/09 me está sugiriendo un
examen para mañana 02/09 porque X examen ya está vencido, pero para mañana ya no hay citas de
laboratorio».* Cuatro reglas fijadas por él en la entrevista, escritas en
`docs/REGLAS_MEDICO_20260901.md`: buscar hacia **atrás**, nunca después; margen de **5 días
hábiles** antes de detenerse a preguntar; mover **solo la toma**, nunca el control; y si AppCita
no responde, **decirlo**, nunca inventar disponibilidad.

### Lo que ya existía, y por qué no bastaba

Sí había una sonda de cupos (`_afinarLabsPrimeroConCupos`, v15.4.0), pero con dos defectos
reales, verificados los dos con el arnés:

1. **Compromiso sin verificar.** El bucle probaba hasta 8 días hacia adelante desde el piso; si
   se acababan los 8 intentos sin encontrar cupo, tomaba el **noveno día como bueno sin haberlo
   consultado nunca**. Con un examen vencido el piso queda en «mañana» pero el techo sigue a
   ~21 días — una ventana de hasta 20 días que 8 pasos no alcanzan a cubrir, así que el defecto
   se activaba justo en el escenario que él reportó.
2. **Extracción ciega de la respuesta.** Leía `r.turnos || r.data || r` y comprobaba
   `Array.isArray(...)`. El camino que SÍ reserva el turno de verdad
   (`apiLaboratorioAgendarAuto`) usa `extractAgendasList`, que reconoce seis formas distintas en
   que AppCita envuelve la lista (`dtCitasDisponibles`, `agendas`, `citas`, `Table`, `Table1`,
   además de `turnos`/`data`) — formas observadas en otros endpoints reales de esta misma API.
   La sonda vieja solo reconocía dos de las seis: cualquier día cuya respuesta viniera envuelta
   en otra forma se leía **siempre** como «sin cupo», tuviera turnos reales o no.

### Lo nuevo

- `mtrDiasParaSondearCupo` / `mtrBuscarCupoLaboratorio`: función pura que ordena los días a
  consultar (ideal primero, luego hacia atrás día hábil por día hábil, nunca cruza el piso ni
  el techo, nunca repite un día) y decide entre tres resultados — `encontrada`,
  `sin_cupo_en_margen` (AppCita respondió que no) y `sin_verificar` (AppCita no respondió) — sin
  confundir nunca los dos últimos.
- `mtrVerificarCupoLab`: el verificador real, usando `extractAgendasList` (la misma del camino
  de reserva) y `gmPostJsonEx` (para distinguir un 500 real de «cero turnos»).
- `mtrNotaDisponibilidadLab`: el aviso de una sola línea cuando no se pudo decidir solo — nunca
  dos textos que se contradigan, siguiendo la regla del médico de esa misma tarde sobre no
  abarrotar el módulo.
- `_afinarLabsPrimeroConCupos` reescrita sobre lo anterior: si no encuentra cupo dentro del
  margen, **no mueve nada** y lo dice en el banner, en vez de comprometerse con un día sin
  verificar.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 188 | la búsqueda deja de preferir «antes» (regla 1) | *sin cupo en la ideal, se busca hacia atrás* (2 fallan) | Sí |
| 189 | el margen de 5 días hábiles deja de respetarse (regla 2) | *agotado el margen, se detiene y pregunta* | Sí |
| 190 | un NO real se confunde con «no se pudo verificar» (regla 4) | *una mezcla de NO y sin verificar cuenta como respuesta real* (3 fallan) | Sí |
| 191 | `mtrVerificarCupoLab` deja de distinguir un 500 de «sin turnos» | *un 500 no es lo mismo que cero turnos reales* | Sí |
| 192 | `mtrVerificarCupoLab` vuelve a la extracción ciega original | *reconoce las formas reales de AppCita* | Sí |

La 192 es la reproducción directa del defecto histórico: revertir a `r.turnos || r.data || r` +
`Array.isArray` hace caer exactamente las pruebas que fijan las seis formas de
`extractAgendasList`.

**Alcance de esta entrega.** El motor (las funciones puras) y el sitio del reporte literal del
médico —la toma forzada por un examen vencido— quedan completos. Hay otros dos sitios del
módulo con la misma forma de sugerencia sin verificar (`cargarHoras` cuando el control ya está
elegido, y el modal de «toma sola»); comparten la misma causa de fondo pero el médico no los
reportó como confusos y ya tienen un mecanismo de recuperación en el momento de confirmar (el
propio AppCita lista los horarios libres si el elegido ya no lo está). Quedan como siguiente
paso, con el motor ya construido y probado.

Banco completo: **2.913 comprobaciones pasan, 0 fallan.**

## v18.0.70 — la caja roja de «cifras sin respaldo» no conocía las otras casillas del médico

Hallazgo #23 del enjambre de funciones, gravedad alta, 3 de 3 refutadores no lo tumbaron.

Lo que el médico escribe en OTRA casilla de texto libre (Recomendaciones, Análisis y plan,
Enfermedad actual — la que NO se está redactando ahora) **sí** viaja a Gemini como contexto vía
`mtrTextoDeOtrasCasillas` (se añadió en la v18.0.36, para el prompt). Pero `_respaldoDelMedico`
— la lista de «hechos conocidos» que usa la caja roja «⚠ cifra sin respaldo» — solo juntaba las
alertas de dosis, el cuadro de indicaciones, la pregunta del modo Preguntar y lo ya escrito en
la historia: **nunca** esa misma función. Si Gemini citaba fielmente una cifra que el médico ya
había dejado escrita en otra casilla —justo lo que el prompt le pide hacer—, la caja la marcaba
igual como inventada. Es el aviso que el propio código llama «el más grave del módulo»: un falso
positivo en el flujo normal de trabajo (escribir Recomendaciones antes que Análisis y plan, o al
revés) enseña a ignorarlo, y entonces deja de servir para cazar la cifra de verdad inventada.

La propia prueba de la v18.0.35 (que fija qué fuentes lleva `_respaldoDelMedico`) ya lo advertía
sin saberlo: `mtrTextoDeOtrasCasillas` se añadió una versión después y esa prueba nunca se
actualizó para exigirla también aquí — quedó documentado en el propio hallazgo del enjambre.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 193 | se quita `mtrTextoDeOtrasCasillas` de `_respaldoDelMedico` (**el defecto original**) | *la caja roja también conoce lo que el médico escribió en las otras casillas* | Sí |

**Sobre la cobertura de esta versión.** `_pintarCifras` vive dentro del closure del modal del
Redactor y no es alcanzable por el arnés (mismo caso que documentó la v18.0.35: «se fija por
fuente, sin comentarios»). Se añadieron DOS pruebas: la de fuente (la única que de verdad
protege el CABLEADO — la que mordió con M193) y una «EJECUTANDO» que reproduce el escenario
exacto del hallazgo (la cifra 45 de «TFG de 45 mL/min» escrita en Recomendaciones) llamando
directamente a `mtrTextoDeOtrasCasillas` + `mtrVerificarCifrasIA` — mecanismo real, pero
independiente del cableado del modal, así que **no** mordió con M193 y no debe leerse como
protección de la conexión. Se deja constancia explícita para no sobreclamar cobertura que la
prueba no da: documenta el mecanismo y reproduce el hallazgo, la de fuente es la que vigila
que el cableado no se vuelva a romper.

Banco completo: **2.915 comprobaciones pasan, 0 fallan.**

## v18.0.71 — un consecutivo con la fecha empotrada podía colarse como el PyM de hoy

Hallazgo #16 del enjambre de funciones, gravedad alta, 2 de 3 refutadores no lo tumbaron.

`esNombreDeHoy` (regla 1 de `pickTodaysFile`) aplicaba la guarda «no cola de otro número»
(`nameHasToken`) SOLO a los tokens con mes en letras («1 de septiembre»); los numéricos
(«192026», «20260901»…) usaban `n.includes(t)` a pelo, **sin ninguna protección de borde** — ni
siquiera la del lado izquierdo que sí tienen los de letras. Un consecutivo, factura o radicado
de 6-8 dígitos que por casualidad trae la fecha de hoy **empotrada** (p. ej.
`Reporte_45192026_Final.xlsx` el 1-sep: «192026» vive dentro de «45192026») se tomaba como el
PyM del día — y a diferencia de la regla 2 (que la v18.0.7 ya restringió a la raíz), esta regla
buscaba en **las tres carpetas** que junta `fetchSpFilesMultiFolder`, subcarpetas ajenas
incluidas.

Hoy (1-sep, día y mes de un solo dígito) es justo el peor caso: el token corto («192026», 6
dígitos) es el que más fácil se empotra en un número más largo.

### La reparación, y su límite deliberado

`nameHasToken` gana un tercer parámetro (`exigirBordeCompleto`): además de que no haya dígito
ANTES del token (lo de siempre), exige que tampoco haya dígito DESPUÉS. `esNombreDeHoy` gana un
segundo parámetro (`fueraDeLaRaiz`): fuera de la raíz, los tokens numéricos pasan también por
`nameHasToken` con el borde completo; dentro de la raíz, nada cambia.

Por qué el corte es solo fuera de la raíz, y por qué solo mira dígitos y no letras: el caso real
ya conocido, `Agenda_v2_20260806.xlsx`, tiene un dígito pegado a la IZQUIERDA de la fecha (la
«2» de «v2») y vive en la raíz — es justo el motivo por el que el código nunca aplicó esta
guarda a los numéricos. Aplicarla en la raíz lo habría roto. Y un candidato con **letras** a los
dos lados (`Consolidado_192026_v2.xlsx` — el «2» de «v2» viene después, separado por la letra
«v», no pegado) es estructuralmente el MISMO patrón de confianza que `Agenda_v2_*`: el código no
puede distinguir con justicia «la letra viene antes» de «la letra viene después», así que trata
los dos casos igual y los sigue aceptando.

### Mutaciones verificadas

| # | Qué se rompió | Prueba que cayó | Restaurado y verde |
|---|---|---|---|
| 194 | la regla 1 vuelve a no distinguir raíz de subcarpeta (**el defecto original**) | *un consecutivo con dígito pegado se rechaza fuera de la raíz* | Sí |
| 195 | el borde completo deja de exigir el lado derecho | *nameHasToken con el borde completo* (prefijo de un número más largo) | Sí |
| 196 | `fueraDeLaRaiz` deja de activar la guarda estricta | *esNombreDeHoy con fueraDeLaRaiz* (2 fallan) | Sí |
| 197 | la raíz TAMBIÉN aplica la guarda estricta (**rompe el caso real conocido**) | *Agenda_v2_20260806.xlsx en la raíz sigue intacto* (2 fallan) | Sí |

La 197 es la contención central: sin ella, «cerrar el hueco» habría roto el archivo real que la
v18.0.7 ya documentó como necesario proteger.

**Precisión de proceso.** Mi primera tanda de pruebas asumía, siguiendo la letra de la
reproducción del hallazgo, que `Consolidado_192026_v2.xlsx` debía rechazarse igual que los otros
dos ejemplos — y la implementación (correcta) la seguía aceptando, así que la prueba falló.
Revisando el porqué: ese nombre no tiene ningún dígito pegado al token, solo la letra «v»
después — es el mismo patrón de confianza que `Agenda_v2_*`, no una cola de otro número. La
reproducción del hallazgo mostraba que las TRES cadenas volvían `true` bajo el código VIEJO (sin
ninguna protección), no que las tres debieran rechazarse bajo el arreglo. Se corrigió la
prueba, no el código.

Banco completo: **2.920 comprobaciones pasan, 0 fallan.**
