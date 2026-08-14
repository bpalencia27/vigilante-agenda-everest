# Tanda 2 de delegación — salida de las auditorías de Gemini

> 14-ago-2026, v14.1.3, 960 comprobaciones en verde.
> Estas tareas salen de los dos informes de Gemini, **ya filtrados**: verifiqué cada
> hallazgo antes de convertirlo en tarea. Tres eran reales y de valor alto (ya los
> corregí), uno estaba sobrestimado, y los que quedan abajo son trabajo real.

---

## Lo que ya corregí yo de esos informes (no lo delegues otra vez)

| Hallazgo | Estado |
|---|---|
| `estadioKDIGO(NaN)` devolvía **G5** (falla renal terminal) | ✅ corregido v14.1.3 |
| Creatinina en µmol/L → TFG 88× menor → **G5 en paciente sano** | ✅ guarda por rango, v14.1.3 |
| `_vigenciaDiasParaAnalito` no usaba `_labNumerico` (un "-50" acortaba la vigencia) | ✅ unificado v14.1.3 |
| `_signosVitalesInvalidar` "hereda el peso del paciente anterior" | ❌ **falso** — las cachés van por `pacienteId`; Gemini lo sobrestimó |

---

# 🟦 JULES — Tarea 3: las pruebas que no pueden fallar

```
[OBJETIVO]
Eliminar del banco de pruebas los casos que pasarían aunque el código estuviera roto, y
dejar en su lugar pruebas que sí puedan fallar.

[CONTEXTO]
Una auditoría externa encontró tres patrones. Verifica cada uno tú mismo antes de tocarlo:

 1. BUCLES QUE NO ITERAN. En `tests/suite_25_cascada_css.js` hay pruebas que recorren
    reglas extraídas del CSS con expresiones regulares. Si la regex deja de casar, el
    arreglo queda vacío, el bucle no itera, no se ejecuta NINGUNA aserción y el caso da
    verde sin haber medido nada. Ya pasó de verdad en este proyecto con una guarda de
    contraste cuyo selector dejó de casar.
 2. ASERCIONES DENTRO DE UN `if` que puede no cumplirse nunca. Mismo efecto.
 3. `t.noLanza` SOBRE FUNCIONES QUE ATRAPAN SUS PROPIOS ERRORES. Caso señalado:
    `tests/suite_04_agenda_alertas.js`, la prueba de `labsVencidosAlert`. Esa función
    tiene un try/catch interno, así que `t.noLanza` pasa aunque el modal no se pinte.

[RESTRICCIONES]
- NO toques `vigilante_agenda.user.js`. Esta tarea es solo del banco.
- NO borres pruebas para "arreglar" el problema: conviértelas en pruebas que comprueben
  algo. Para el patrón 1, el arreglo es una línea antes del bucle:
  `t.cierto(coleccion.length > 0, "debe encontrar N para poder validar")`.
- Para `labsVencidosAlert`: en vez de `t.noLanza`, comprueba que el modal QUEDÓ en el DOM
  y que su contenido nombra los analitos que se le pasaron. Mira cómo lo hacen otras
  pruebas de modales de la suite 15 (leen `.innerHTML`, nunca `.textContent` — en este
  arnés `textContent` es una propiedad estática que no se deriva del HTML).

[VERIFICACIÓN]
Para CADA prueba que toques, demuestra en el PR que ahora puede fallar: rompe a propósito
el código o el dato que debería comprobar, pega la salida roja con el nombre del caso, y
restaura. Una prueba reescrita cuya rotura no puedas demostrar no vale.

[ENTREGA]
Rama `test/pruebas-que-si-fallan`, abre PR. En la descripción, una tabla: prueba, patrón
que tenía, cómo se rompió para demostrarlo.
```

---

# 🟦 JULES — Tarea 4: el antiduplicado de órdenes no tiene ninguna prueba

```
[OBJETIVO]
Cubrir con pruebas `_pymYaOrdenadoHoyDesdeElScript`, que hoy aparece en el runner como
"sin cubrir" y es la única defensa contra ordenarle dos veces lo mismo a un paciente.

[CONTEXTO]
- La función vive en `vigilante_agenda.user.js` (búscala; ronda la línea 12470).
- El runner la lista explícitamente en su bloque "sin cubrir" al terminar.
- Es la guarda que impide que, si el médico pulsa ordenar dos veces o reabre la consulta,
  se generen órdenes duplicadas ante la EPS.
- Alrededor hay funciones hermanas YA cubiertas que te sirven de plantilla:
  `isOrdenesCreadasHoy` / `markOrdenesCreadasHoy` están probadas en
  `tests/suite_09_ajustes.js`. Sigue ese estilo.

[RESTRICCIONES]
- NO cambies el comportamiento de la función. Si al escribir las pruebas crees haber
  encontrado un bug, NO lo arregles: anótalo en la sección "Hallazgos NO tocados" del PR
  con el caso que lo reproduce.
- Los datos de prueba son sintéticos. Ninguna cédula real, ningún nombre real.

[VERIFICACIÓN]
- `node tests/runner.js` en verde, y la función ya NO aparece en la lista "sin cubrir".
- Mutación obligatoria: rompe la guarda a propósito (haz que siempre diga "no ordenado"),
  demuestra que tu prueba se pone roja nombrando el caso, restaura, confirma verde.
- Documenta la mutación en `tests/INFORME_MUTACIONES.md`, fila AL FINAL, con las mismas 4
  columnas que las existentes.

[ENTREGA]
Rama `test/antiduplicado-ordenes`, abre PR.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 3: el algoritmo de riesgo cardiovascular

> AI Studio, `gemini-3.7-flash`, **thinking: high**.
> Adjunta `vigilante_agenda.user.js` **y la imagen del algoritmo de 4 pasos**.

```
Te adjunto un userscript clínico de ~853 KB y la imagen de un algoritmo oficial de
evaluación del riesgo cardiovascular en adultos (4 pasos, de un manual colombiano de
atención a crónicos). Quiero un ANÁLISIS DE VIABILIDAD, no código.

El algoritmo clasifica al paciente en MUY ALTO / ALTO / MODERADO / BAJO riesgo, con una
meta de LDL distinta para cada nivel, mediante 4 pasos sucesivos.

Necesito saber, para CADA condición que aparece en los 4 pasos del algoritmo:

1. ¿El script YA tiene ese dato disponible hoy? Si sí, di de dónde sale: qué función lo
   obtiene, de qué endpoint o de qué campo, y en qué línea. Sé literal: solo cuenta lo que
   puedas señalar en el archivo.
2. Si NO lo tiene, ¿de qué tipo de dato se trata? Clasifícalo:
   (a) está en algún endpoint que el script YA llama pero no lee ese campo,
   (b) exigiría una llamada nueva a un endpoint que el script no usa,
   (c) es un dato que solo puede teclear el médico (antecedente, hallazgo clínico),
   (d) es un cálculo derivable de datos que sí tiene.
3. Marca cuáles condiciones son OBJETIVAS (un número o un código de diagnóstico que se
   puede leer) y cuáles exigen JUICIO CLÍNICO.

Después, respóndeme esto, que es lo que de verdad decide si esto se construye:
   **¿Qué porcentaje del algoritmo se podría resolver hoy solo con lo que el script ya
   tiene, y cuál es el subconjunto MÍNIMO de datos nuevos que desbloquearía la mayor parte
   del resto?** Ordena ese subconjunto por relación valor/esfuerzo.

Y una advertencia que quiero que respetes: este script tiene una regla dura —"casilla vacía
antes que dato inventado"—. Si una condición del algoritmo no se puede determinar con
certeza, la respuesta correcta NO es asumir que no se cumple: es no clasificar. Señala qué
pasos del algoritmo se romperían si se aplicara esa regla estrictamente.

NO escribas código. Informe, con líneas citadas. Si no estás seguro de una línea, dilo.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 4: unidades en TODOS los laboratorios

```
Te adjunto un userscript clínico de ~853 KB. Acabo de corregir un fallo grave: las fórmulas
renales asumen la creatinina en mg/dL, pero el script descarta el campo `unidades` que envía
el laboratorio. Si un laboratorio reportara en µmol/L, una creatinina normal (1,0 mg/dL)
llegaría como 88 y el paciente saldría clasificado en falla renal terminal.

Ya puse una guarda por rango de plausibilidad para la creatinina. Quiero saber DÓNDE MÁS
está ese mismo agujero.

1. Encuentra TODOS los puntos del archivo donde un valor numérico de laboratorio se usa para
   decidir algo —una comparación contra un umbral, un cálculo, un color de alerta, una
   vigencia— y di, para cada uno, si valida la unidad o si asume una implícitamente.
2. Para cada analito de `WHITELIST_13_LABS`, dime cuál es su unidad estándar y cuáles son las
   otras unidades de uso corriente en el mundo para ese mismo analito. Marca los casos donde
   el cambio de unidad produce un número que PARECE plausible (esos son los peligrosos: un
   número absurdo se nota, uno plausible no).
3. Propón para cada analito un rango de plausibilidad en la unidad estándar, con el criterio
   de que debe dejar pasar los extremos patológicos REALES (un paciente en falla renal
   terminal tiene creatinina de 12 mg/dL y ese dato es válido, no un error de unidades).
4. ¿Hay algún sitio donde se comparen o combinen DOS analitos que podrían venir en unidades
   distintas? Ese es el caso más difícil de detectar.

Ordena por riesgo clínico. Informe, sin código. Y sé honesto con la incertidumbre: si no
sabes la unidad estándar de un analito, dilo en vez de suponerla.
```

---

## Lo que sigo teniendo yo

1. **El botón de auto-agregar a Conducta** con el cruce antiduplicado, como decidiste.
2. **`panelActivities`** — conectar o borrar, con criterio.
3. **La fusión de los ~195 commits a `main`.**
4. **Revisar los PR de Jules** antes de que entren.
5. Dos hallazgos clínicos de Gemini que **necesitan tu decisión**, abajo.

---

## 🟡 Dos preguntas clínicas nuevas, para ti

Ninguna la puede decidir un agente:

1. **El LDL no se vigila.** Está en la lista de lectura, se puede ordenar, y tiene vigencia
   de 180 días en la tabla… pero **no está en `RCV_VIGENCIA_KEYS`**, que es la lista de lo
   que el script avisa cuando vence. Resultado: **un LDL vencido nunca genera alerta.**
   ¿Lo agrego a la vigilancia?

2. **La RAC se da por cubierta con la mitad.** Tu propio comentario en el código dice que la
   relación albúmina/creatinina necesita **los dos** exámenes (`903876` + `903026`) y que
   "uno solo no produce la RAC". Pero el cruce antiduplicado usa una regla de "alguno", así
   que si en Everest aparece **uno solo** de los dos, el script da la RAC por cubierta y deja
   de pedirla. ¿La marco como cubierta solo cuando estén los dos?
