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
| Cómo se sabe que coinciden | alguien lo leyó | 21.700 vectores ejecutados en los dos |
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
| Costura y bandera | 4 | — (nuevo) | — |

**46 funciones nuevas. 21.700 comprobaciones de conformidad.**

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
| **GAP #6 — timing de insulinas** | Necesita la *indicación prescrita*. Everest no la expone en un campo que sepamos leer. |
| **GAP #8 — tope de furosemida por mg** | Necesita la *dosis diaria*. Mismo motivo. La regla SÍ está portada y avisa conservador cuando no hay dosis. |
| Interacciones farmacológicas (Triple Whammy, doble bloqueo SRAA…) | Pendiente. Es el siguiente bloque natural y ya tiene sus dorados generables. |

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

### 3. Donde Python lanza, el JS devuelve `null`

Uniforme y deliberado: una excepción a mitad de consulta es peor que una casilla vacía, y este
proyecto ya decidió *casilla vacía antes que dato inventado*. Se comprueba explícitamente para
cada vector marcado `lanza`, no se ignora.

## Un hallazgo del camino

`mtrIsoDesdeFecha` usaba `instanceof Date`, que **no cruza realms**. El Vigilante crea un iframe
clon: un `Date` que viniera de ahí habría devuelto `null` en silencio. Corregido con
`Object.prototype.toString.call()`, con prueba propia. Lo encontró el banco, no una revisión.

## Estado

```
1288 comprobaciones en verde        (antes del bloque: 1196)
463 / 497 funciones cubiertas       93,2 %   (antes: 400/433 = 92,4 %)
3 mutaciones aplicadas, 3 cazadas   registradas en tests/INFORME_MUTACIONES.md
```
