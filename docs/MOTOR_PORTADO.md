# El motor portado — mapa función a función

> Rama `feat/motor-portado`, 15-ago-2026. Base `claude/v14-continuacion` (`25f2f99`).
> Origen: `everest-rcv-copiloto` en `6fa28d1c`.

## Qué es esto

El Copiloto RCV calcula en Python cosas que el Vigilante necesita **dentro de Everest**, donde
no hay servidor. Este bloque trae ese cálculo a JavaScript.

**No es una segunda implementación. Es un port verificado.** La diferencia:

| | Segunda implementación | Port verificado |
|---|---|---|
| Cuando la regla cambia en Python | diverge en silencio | **cae una prueba** |
| Cómo se sabe que coinciden | alguien lo leyó | 15.222 vectores ejecutados en los dos |
| Qué pasa con las diferencias | se descubren en consulta | están declaradas y vigiladas |

Es la diferencia entre esto y el `904426`: un CUPS copiado del Copiloto que divergió del que el
médico ordena de verdad. Un dígito, dos copias, ningún vigilante de la copia.

## El mecanismo

```
motor_deterministic.py ──ejecuta──> golden_gen.py ──graba──> tests/golden/<fn>.json
                                                                      │
                                            SHA-256 del .py de origen ┘
                                                                      │
tests/suite_43_conformidad_cruzada.js ──lee y exige──────────────────┘
```

Cambia la regla en Python → cambia el hash → la suite cae hasta que el cambio se porte.

```bash
python3 golden_gen.py            # regenera todos los dorados
python3 golden_gen.py fechas     # solo un bloque
node tests/runner.js suite_43    # el contraste
```

## Lo portado

| Bloque | Funciones JS | Origen Python | Vectores dorados |
|---|---|---|---|
| Fechas y días hábiles | 8 | `motor_deterministic.py` | 2.310 |
| Vigencias y programa rector | 5 | `motor_vigencias.py` | 1.152 |
| Lípidos | 3 | `motor_deterministic.py` | 171 |
| **Seguridad de dosis renal** | **26** | `motor_deterministic.py` | **9.270** |
| Discrepancia de estadios | 3 | `motor_deterministic.py` | (vía orquestador) |
| **Interacciones farmacológicas** | **4** | `motor_deterministic.py` | **1.536** |
| Costura al endpoint real de medicamentos | 8 | — (nuevo) | fixture sintético |
| **Capa de presentación** | **3** | — (nuevo) | 15 pruebas, 3 de ellas de XSS |

**76 funciones `mtr*` nuevas (verificado contando lo que el arnés expone de verdad, no de
memoria). 15.222 vectores de conformidad (38 archivos dorados) + 128 pruebas de comportamiento
escritas a mano en las suites 38-42, más las 42 de contraste de la suite 43.**

Nota de calibración: esta cifra reemplaza a "59 funciones / 15.760 vectores / 21.700 vectores",
que aparecieron en distintos puntos de esta misma noche sin volver a verificarse contra el
código — exactamente el tipo de deriva que este proyecto existe para cazar. La de arriba se
obtuvo así:

```bash
node -e "const{cargar}=require('./tests/harness.js');const c=cargar({silencioso:true});
  console.log(Object.keys(c.api).filter(k=>/^mtr[A-Z]/.test(k)).length)"      # 76
python3 -c "import json,glob;print(sum(len(json.load(open(f))['vectores'])
  for f in glob.glob('tests/golden/*.json')))"                                # 15222
```

### Las 8 interacciones

Las reglas de dosis renal miran un fármaco a la vez. Estas miran la lista **entera**: hay
combinaciones seguras fármaco a fármaco y peligrosas juntas.

| | Qué detecta |
|---|---|
| `TRIPLE_WHAMMY` | IECA/ARA-II + diurético + AINE. De las causas evitables más frecuentes de falla renal aguda ambulatoria. |
| `DOBLE_BLOQUEO_SRAA` | IECA + ARA-II simultáneos |
| `GEMFIBROZILO_ESTATINA` | rabdomiólisis |
| `HIPERKALEMIA_SINERGICA` | ahorrador de K + suplemento de K (sube a CRITICAL con K+ ≥ 5,5) |
| `RIESGO_SANGRADO_AINE_DOAC` | anticoagulante directo + AINE |
| `METFORMINA_CONTRASTE` | metformina con eGFR < 60 y contraste yodado |
| `BETA_CCB_NODHP` | betabloqueador + verapamilo/diltiazem |
| `SGLT2_SULFONILUREA` | hipoglucemia por sinergia |

`mtrAvisosFarmacologicos` junta los dos bloques y **ordena por gravedad**: lo `CRITICAL`
primero, porque en consulta nadie lee la tercera línea.

### Las 21 reglas de dosis renal

`metformina` · `rosuvastatina/simvastatina` · `iSGLT2` (con ajuste por HbA1c) · `espironolactona`
· `fenofibrato` · `gabapentinoides` · `IECA/ARA-II` · `betabloqueador hidrofílico` · `DOAC`
(rivaroxabán, apixabán, dabigatrán) · `tiazidas` · `iDPP-4` · `sulfonilureas` · `alopurinol`
· `colchicina` · `digoxina` · `AINEs` · `nitrofurantoína` · `insulina` · `HBPM` · `GLP-1 RA`
· `suplemento de potasio` · `furosemida` · y la regla global **ERC G3a + A2**, que es la única
que puede recomendar **iniciar** una terapia y no solo suspenderla.

## Lo NO portado, y por qué

| | Motivo |
|---|---|
| Redacción narrativa por IA | Exige clave de proveedor. El userscript se reparte en claro a veinte máquinas. |
| Persistencia de fichas de pacientes | D-6 (4-ago): el expediente vive en Everest; el Copiloto es caché de trabajo. Duplicar la caché lo empeora. |
| SPA de 3 pestañas | Es la interfaz del Copiloto. El Vigilante tiene la suya. |
| **GAP #6 — timing de insulinas** | Necesita la *indicación prescrita*. El endpoint de medicamentos no la trae. |
| **GAP #8 — tope de furosemida por mg** | La respuesta trae `dosificacion`, `cantidadDias` y `presentacion`, pero **la concentración solo aparece dentro del texto de `descripcion`**. Sacarla de ahí es inferencia. La regla está portada y avisa conservador. |

`mtrEvaluarSeguridadDosisRenal` **no acepta** `indicaciones` ni `dosis_mg`: su firma tiene 6
parámetros, no 8. Hay una prueba que comprueba precisamente eso, para que nadie los añada sin
portar las reglas que los usan. **Lo no portado no aparenta estarlo.**

## Divergencias declaradas

### 1. La regla de días hábiles — deliberada

`ajustar_fecha_habil` del Python empuja **+1 día hacia adelante** cuando la fecha cae en domingo
o festivo (`motor_deterministic.py:2027`). Aplicado a la FTL (`:2525`), pone la toma **después
del vencimiento** — y `dias_labs_efectivos` está calculado para caer exactamente en el
vencimiento del primer analito.

Eso es `CERO VENCIDOS` roto en el archivo que lo invoca como principio rector.

El médico cerró la regla el 5-ago-2026: **la toma se adelanta al último día hábil, nunca se
retrasa**. El port implementa lo decidido en `mtrRetrocederADiaHabil`, y conserva
`mtrAjustarFechaHabil` como port fiel para la cita de control, que sí puede correrse.

Hay una prueba marcada `PENDIENTE_COPILOTO` que **documenta que el Python todavía no cumple** y
que caerá el día que se arregle allá. Su fallo es la señal de que hay que unificar.

### 2. Las tablas de festivos — abierta, y es tuya

| | Vigilante | Copiloto |
|---|---|---|
| Años cubiertos | 2024-2027 | 2026-2027 |
| 2026-07-13 | no es festivo | **sí es festivo** |
| 2027-07-12 | no es festivo | **sí es festivo** |

Un festivo de más o de menos mueve la fecha de una toma de laboratorio. **No elegí un lado**:
hace falta la fuente oficial. Las 22 discrepancias que produce están declaradas una a una en
la suite 43 con su motivo — y la lista se vigila a sí misma: si una divergencia declarada deja
de divergir, **la suite falla** para que alguien la borre.

### 3. El orden de `par_farmacos` — deliberada

El Copiloto construye ese campo con `list(set(...))`, y el orden de un set de cadenas en
Python **no es determinista entre procesos**. Comprobado empíricamente: cuatro corridas del
mismo caso, cuatro órdenes distintos.

El port lo devuelve **ordenado**. Si ese texto llega a una nota firmada, dos situaciones
clínicas idénticas producirían documentos distintos, y cualquier prueba de regresión sobre ese
campo parpadearía sin motivo. La suite 43 compara ese campo como conjunto — una normalización
declarada que solo afecta a ese campo y solo en las alertas de interacción.

### 4. Donde Python lanza, el JS devuelve `null`

Uniforme y deliberado: una excepción a mitad de consulta es peor que una casilla vacía, y este
proyecto ya decidió *casilla vacía antes que dato inventado*. Se comprueba explícitamente para
cada vector marcado `lanza`, no se ignora.

## Un hallazgo del camino

`mtrIsoDesdeFecha` usaba `instanceof Date`, que **no cruza realms**. El Vigilante crea un iframe
clon: un `Date` que viniera de ahí habría devuelto `null` en silencio. Corregido con
`Object.prototype.toString.call()`, con prueba propia. Lo encontró el banco, no una revisión.

## La costura, con el endpoint real

**El endpoint no se adivinó: estaba capturado.** En
`captura_ordenamiento_nativo_20260810.json` (rama `7df1a4b`), grabado por el GRABADOR del
propio proyecto el 10-ago-2026, con cuerpo de respuesta completo.

```
POST /apiviva/APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente
  petición  { pacienteId, fechaInicial, fechaFinal, estado }
            las fechas van como "Sun May 04 2025" — el formato de
            Date.toDateString(), NO ISO. Así las manda Everest.
  respuesta [ { tipo, agrupador, estado, fechaCreacion, fechaVencimiento,
                usuario{…}, detalles[ { codigo, descripcion,
                cantidadMedicamento, cantidadDias, dosificacion,
                presentacion, pf, posfechado… } ], urls[…] } ]
```

El nombre del fármaco viaja como **texto libre** en `detalles[].descripcion`, que es justo lo
que `mtrDetectarPrincipios` sabe leer. No hace falta ningún catálogo intermedio.

### Lo que se decidió al enchufarlo

- **Solo cuentan las formulaciones en estado `PENDIENTE`.** Una formulación `ANULADA` no puede
  juzgarse como si el paciente siguiera tomando ese fármaco. Si aparece un tercer estado en
  producción, `MTR_ESTADOS_VIGENTES` es el único sitio donde se decide — y hasta que se decida,
  se excluye.
- **Los renglones sin nombre se descartan.** La respuesta real trae renglones con
  `descripcion` en `null` y en blanco.
- **Una respuesta con forma inesperada devuelve `null`, nunca lista vacía.** Lista vacía diría
  "no toma nada", que es falso y peligroso.
- **La caché va por paciente y caduca a los 5 minutos.** Otro paciente jamás recibe esta lista.

### Qué está probado y qué no

El parseo es una función pura y tiene **14 pruebas** contra un fixture **sintético** con la
forma real (`tests/fixtures/everest_medicamentos.json` — inventado carácter a carácter, cero
datos de pacientes). La llamada de red tiene **5 pruebas más** con `fetch` simulado: ruta, verbo,
formato de fechas, caché por paciente, respuesta malformada y caída de red.

Lo único que no se puede probar aquí es que Everest responda de verdad. Eso se ve en la primera
consulta con la bandera encendida.

## Estado

```
1372 comprobaciones en verde        (antes del bloque: 1196)
476 / 510 funciones cubiertas       93,3 %   (antes: 400/433 = 92,4 %)
15 mutaciones aplicadas, 15 cazadas registradas en tests/INFORME_MUTACIONES.md

nombres en `cubre` sin ejercitar (textual):        0     (antes: 28)
nombres en `cubre` sin invocar vía api.· (runtime): 54    (ver abajo — informativo, no compuerta)
```

**El 93,3 % de ahora y el 92,4 % de antes no son comparables.** El de antes contaba 28 nombres
que ninguna prueba tocaba: la cobertura real era del 86 %. El de ahora no tiene ni uno.

### La reja va un escalón más estricta — `runner.js` ahora audita por ejecución, no solo por texto

El chequeo "nunca nombradas" es un grep: si el nombre del `cubre` aparece como palabra en el
archivo de la suite, lo da por cubierto — y esa misma laxitud es la puerta por la que se colaron
los 28 nombres huecos de más arriba (aparecían en la propia declaración `cubre`, que es texto).

`runner.js` ahora también envuelve el `api` que recibe cada suite en un `Proxy` de solo lectura
que anota qué nombres se **leen de verdad** en tiempo de ejecución (`api.nombre`, no el texto
"nombre" en un comentario), y lo compara contra el `cubre` de esa suite. Es deliberadamente de
solo lectura — devuelve la función real, sin envolverla — porque el primer diseño (un wrapper
que anotaba al ser *llamada*) rompió dos pruebas reales por identidad/tipo de función antes de
llegar a producción (ver `tests/INFORME_MUTACIONES.md`, entrada `runner.js 76`). Sigue siendo,
a propósito, informativo y no compuerta: puede haber falsos positivos legítimos (una función
cubierta de verdad por integración — un evento del DOM, o porque otra función SÍ invocada por
`api.` la llama por dentro — nunca se lee como `api.nombre` directo).

De los 55 nombres que destapó en la primera corrida, se verificó a mano (con un análisis de
alcanzabilidad sobre el propio código, no de memoria) que **54 son alcanzables** por algún
camino interno desde algo que sí se invoca directamente — cobertura por integración legítima,
no hueca. El único que no lo era, `checkRecordatorioPym`, sí era un hallazgo real: es la **red
de seguridad D4** del banner de PyM (T7, v14.0.0, línea ~14524) — si `createPymBannerUI()`
lanza, o el médico apaga el banner desde Ajustes, es la única función que evita que el
recordatorio de PyM desaparezca en silencio — y estaba en el `cubre` de la suite 04 desde
siempre sin que ninguna prueba la ejercitara. Ahora tiene 6 pruebas directas y una mutación
cazada (ver `tests/INFORME_MUTACIONES.md`).

Los 54 restantes quedan documentados, no resueltos: son el mismo tipo de decisión que ya llevaba
"días" sin actuarse en el chequeo textual (cita del propio comentario de la suite 42) — conviene
que S2/tronco decida si vale la pena escribirles prueba directa una por una o si la cobertura
por integración es política aceptada para este proyecto. No se tocaron 54 suites a las 2 a.m.
sin esa decisión.

## La vista

Los avisos se pintan **debajo del recuadro de función renal** del modal de laboratorios, que es
de donde salen: ponerlos en otra pantalla obligaría al médico a cruzar dos sitios mentalmente.

Tres reglas, y las tres con prueba y con mutación registrada:

1. **Todo texto de Everest pasa por `escapeHtml`.** Los nombres de fármaco llegan crudos del
   EHR. La prueba no usa lista negra: exige que **ninguna etiqueta del HTML resultante sea
   distinta de las seis que el bloque escribe**.
2. **El silencio siempre lleva motivo, y se pinta distinto.** `vgl-mtr-sinjuicio` (no pude
   leer) frente a `vgl-mtr-limpio` (leí y está bien).
3. **Lo `CRITICAL` primero.** En consulta nadie lee la tercera línea.

El pie del bloque dice, literalmente, que no se ordena ni se cambia nada y que la decisión es
del médico. Hay una prueba que lo exige.

El interruptor está en **Ajustes → Avisos de seguridad farmacológica (en pruebas)**, y nace
apagado.

### Lo que enseñó la séptima mutación

Al quitarle una pata a la condición del Triple Whammy, **el contraste dorado no la cazó**: de
los 1.008 vectores no había ni uno de *IECA + AINE sin diurético*, que es justo la combinación
que la mutación convierte en falso positivo. Solo cayó la prueba de comportamiento.

Se añadieron las parciales de las ocho reglas — 1.008 → **1.536 vectores** — y con eso la misma
mutación tumba dos. **Un banco de vectores que solo contiene los casos que SÍ disparan no puede
detectar que una regla empezó a disparar de más.**

**Lo único que sigue sin fuente es el tabaquismo.** `ObtenerDatosPuntajeFramingham` aparece en
`test.har`, así que el endpoint existe y se llama así — pero ese HAR se exportó **sin cuerpos de
respuesta** (61 llamadas de API, 0 con cuerpo), de modo que sus campos siguen sin conocerse.
Es lo que resuelve `DIAGNOSTICO_FACTORES_RCV.js` en dos minutos.
