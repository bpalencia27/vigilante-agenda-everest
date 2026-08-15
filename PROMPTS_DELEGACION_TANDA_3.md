# Tanda 3 — la auditoría de unidades destapó algo vivo

> 14-ago-2026, v14.1.4, 963 comprobaciones en verde.
> Sale del informe de unidades de Gemini, el mejor que ha entregado. Verifiqué lo esencial
> antes de repartir.

---

## 🔴 LO PRIMERO: un riesgo que está en producción HOY y necesita una captura tuya

El script compara la **RAC ≥ 30** para decidir si acorta la vigencia de 180 a 90 días.
Ese umbral está en **mg/g**. Si Athenea reportara en **mg/mmol** (el estándar internacional):

| RAC real del paciente | Como llega si es mg/mmol | Lo que decide el script |
|---|---|---|
| 132 mg/g — **nefropatía activa** | `15` | 15 < 30 → **"normal"**, vigencia relajada a 180 días |

**Y esto no lo puede cazar ninguna guarda de rango**, porque 15 es un número perfectamente
normal en mg/g. Es lo contrario del caso de la creatinina, donde 88 era absurdo y se notaba.

Lo mismo pasa con **PTH** (pmol/L cae dentro del rango normal de pg/mL: un
hiperparatiroidismo severo se lee como normal), **Fósforo** (mmol/L se lee como
hipofosfatemia cuando es hiperfosfatemia tóxica) y **Hemoglobina** (mmol/L se lee como
anemia moderada).

**La única salida es leer el campo `unidades` que manda Athenea — y no sé qué manda.**

### Lo que necesito de ti (5 minutos, una vez)

Abre un paciente que tenga RAC, creatinina y hemoglobina en Athenea. En la consola (`F12`),
pega esto y mándame la salida:

```js
copy(JSON.stringify(
  (window.__VGL_LABS__ || []).map(l => ({
    nombre: l.NombreParametro || l.nombre,
    resultado: l.Resultado || l.resultado,
    unidades: l.unidades ?? l.Unidades ?? l.unidadMedida ?? "(NO VIENE)",
    claves: Object.keys(l)
  })), null, 1));
console.log("copiado al portapapeles");
```

Si `window.__VGL_LABS__` no existe, abre el modal de laboratorios del paciente primero y
mira en la pestaña **Network** la respuesta de `consultaDetalleSolicitud`: lo que necesito es
**una fila completa tal cual**, para ver si trae unidades y con qué nombre de campo.

**Sin datos de paciente**: bórrale el nombre y la cédula antes de pegármelo. Solo necesito
los nombres de campo y las unidades.

---

# 🟦 JULES — Tarea 5: guardas de plausibilidad donde el rango SÍ sirve

```
[OBJETIVO]
Añadir una guarda de rango de plausibilidad por analito, de modo que un valor de laboratorio
imposible en la unidad esperada no entre a ningún cálculo ni a ninguna casilla de la historia
clínica.

[CONTEXTO]
- Ya existe el precedente exacto que debes seguir: en `estadioRenalDelPaciente` hay una
  guarda de creatinina (0,1–20 mg/dL) añadida en v14.1.3. Búscala por
  "creatinina_fuera_de_rango" y replica su forma: rechazar y decir por qué, NUNCA convertir.
- El motivo real: si un laboratorio reporta en otra unidad, un número imposible entra a las
  fórmulas. Con creatinina en µmol/L (88 en vez de 1,0), un paciente sano salía clasificado
  en G5, falla renal terminal. Está documentado en `tests/INFORME_MUTACIONES.md`.
- La función que sanea los valores es `_labNumerico`. La lista de analitos es
  `WHITELIST_13_LABS`.

[RANGOS A IMPLEMENTAR] (unidad estándar de la IPS; están elegidos para dejar pasar los
extremos patológicos REALES, que es el paciente en quien más importa acertar)
  CREATININA        mg/dL    0.1  – 30
  GLUCOSA           mg/dL     10  – 2500
  HBA1C             %          3  – 25
  COLESTEROL_TOTAL  mg/dL     30  – 2000
  COLESTEROL_HDL    mg/dL      3  – 250
  COLESTEROL_LDL    mg/dL      5  – 1500
  TRIGLICERIDOS     mg/dL     10  – 15000
  ALBUMINA          g/dL     0.5  – 7.5
  HEMOGLOBINA       g/dL       2  – 28
  FOSFORO           mg/dL    0.3  – 22
  PTH               pg/mL      1  – 5000

[RESTRICCIONES CRÍTICAS]
- **NO añadas guarda de rango a la RAC.** Su rango en mg/mmol se solapa con el de mg/g justo
  en la zona que importa, así que una guarda numérica daría falsa seguridad. Queda pendiente
  de una captura del campo `unidades`. Si la añades, la estás empeorando.
- **NUNCA conviertas automáticamente entre unidades.** Adivinar la unidad de un dato clínico
  está prohibido en este proyecto. Se rechaza y se informa, nada más.
- El rechazo NO puede degradarse a un valor por defecto ni a cero: un cero en creatinina
  produce el estadio MÁS GRAVE. "Fuera de rango" es su propio estado, distinto de "no hay dato".
- No toques el flujo de escritura en las casillas de Everest en esta tarea: solo la capa de
  lectura/validación. Si crees que la guarda debería aplicarse también ahí, anótalo en
  "Hallazgos NO tocados".

[VERIFICACIÓN]
- `node tests/runner.js` en verde.
- Para CADA analito, dos pruebas: una con el valor típico de la OTRA unidad (que debe
  rechazarse) y otra con el extremo patológico REAL de la unidad correcta (que debe pasar).
  Ejemplo del par para creatinina: 88 (µmol/L) se rechaza; 12 mg/dL (falla renal real) pasa.
- Mutación obligatoria por cada guarda nueva, documentada en `tests/INFORME_MUTACIONES.md`
  con las 4 columnas de siempre, filas al final.

[ENTREGA]
Rama `feat/guardas-plausibilidad-labs`, abre PR. En la descripción, la tabla de rangos y, por
cada uno, el par de casos que lo demuestra.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 5: el camino de escritura a la historia clínica

> Adjunta `vigilante_agenda.user.js` completo. `thinking: high`.

```
Te adjunto un userscript clínico de ~853 KB. Tu propio informe anterior señaló que
`injectLabsIntoCronicos` escribe valores de laboratorio DIRECTAMENTE en las casillas del
formulario de la historia clínica de un EHR ajeno (Angular), y que ese camino no tiene
prácticamente pruebas. Quiero auditarlo a fondo, porque es el único punto del script donde un
error no se queda en la pantalla: queda ESCRITO en la historia clínica del paciente.

1. RECONSTRUYE EL CAMINO COMPLETO, paso a paso, desde que llega un resultado de Athenea hasta
   que queda escrito en una casilla de Everest. Nombra cada función y su línea, en orden.

2. ¿QUÉ PROTEGE HOY AL MÉDICO en ese camino? El proyecto tiene una regla que llama sagrada:
   "la casilla del médico nunca se sobrescribe en silencio". Encuentra el código que la
   implementa y evalúa si de verdad la cumple. Busca en concreto: ¿qué pasa si el médico está
   escribiendo EN ESE MOMENTO? ¿si la casilla tiene un valor puesto por Everest y no por él?
   ¿si el valor es visualmente igual pero distinto (espacios, coma vs punto)?

3. ¿QUÉ PASA SI ANGULAR NO HA MONTADO LA CASILLA TODAVÍA? Hay reintentos en el código
   (búscalos). ¿Cubren todos los caminos, o solo algunos? ¿Qué ocurre con los que no?

4. EL PEOR ESCENARIO: descríbeme la secuencia concreta de eventos —paso a paso, como un guion—
   que llevaría a que un valor QUEDE ESCRITO EN LA CASILLA EQUIVOCADA de un paciente real.
   Quiero el camino más corto y más probable, no el más rebuscado. Si crees que no existe
   ninguno, dilo y demuéstralo señalando qué guarda lo impide.

5. ¿Se puede DESHACER? Si el script escribe algo mal, ¿el médico tiene forma de saberlo y
   revertirlo antes de guardar la historia?

Ordena por riesgo clínico. Informe, sin escribir código. Cita archivo:línea en cada
afirmación, y si no estás seguro de una línea, dilo en vez de inventarla.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 6: los 26 "declarados y nunca nombrados"

```
Te adjunto un userscript clínico de ~853 KB y su banco de pruebas (33 archivos de tests/).

El runner del proyecto imprime una lista de funciones "declaradas pero nunca nombradas". Un
análisis previo concluyó que eran "un subsistema de notificaciones abandonado", y ESO ERA
FALSO: varias están vivas y llamadas (showToast, playTone, stopNag, updateBell). Lo que la
lista mide en realidad es otra cosa.

Quiero que resuelvas la ambigüedad de una vez:

1. Para CADA función de esa lista, di con evidencia si está: (a) viva y llamada en producción,
   (b) llamada solo desde los tests, (c) sin ningún llamador en ningún sitio.
2. Para las del grupo (a) — vivas pero que la lista señala — explica POR QUÉ aparecen en esa
   lista. La causa está en cómo el runner calcula la cobertura: encuéntrala y explícala.
3. Para las del grupo (c), di si borrarlas es seguro: ¿alguna es un punto de entrada del
   navegador, un manejador de evento, o algo que se invoque por nombre dinámicamente
   (window[nombre], addEventListener con string, etc.)? Esa es la trampa a evitar.
4. Dame la lista final de las que se pueden borrar SIN RIESGO, y la lista de las que hay que
   conectar o dejar en paz, con el motivo de cada una.

Informe con líneas citadas. No escribas código ni borres nada.
```

---

## Lo que me quedo yo

1. **Leer PAS/PAD/IMC del endpoint que ya se llama.** Tu propio informe lo puso como TOP 1 con
   esfuerzo NULO: `apiHcObtenerSignosVitales` ya trae `presionSistolica`, `presionDiastolica`
   e `imc` en el payload, y `_pesoDeSignosVitales` los tira a la basura. Es código mío, de hoy.
2. **El botón de auto-agregar a Conducta** (sigue pendiente, es lo siguiente).
3. **`panelActivities`** — conectar o borrar.
4. **La fusión a `main`** y **revisar los PR de Jules**.

---

## Sobre el motor de riesgo cardiovascular (tu algoritmo de 4 pasos)

El análisis de viabilidad quedó claro y coincide con lo que veo:

- **El Paso 2 se puede automatizar casi entero HOY** — ERC por estadio, RAC, LDL ≥ 190,
  colesterol total > 310. Todo eso ya lo calcula el script.
- **El Paso 1 (infarto, ACV, stent previos) es 0% automático.** No está en ningún dato que el
  script pueda leer.
- **El Paso 3 está bloqueado por una sola variable: tabaquismo.** Sin ella la ecuación no corre.

Y hay una consecuencia que quiero que veas antes de que construyamos nada:

> **La ausencia de antecedentes NO se puede leer como "no los tiene".** Un paciente con stent
> y estatina puede tener el LDL en 85 y la creatinina normal. Si el script asume que no tuvo
> infarto, lo clasifica en riesgo BAJO (meta < 116) cuando es MUY ALTO (meta < 55).

Por eso, si lo construimos, la salida honesta para muchos pacientes va a ser
**"PENDIENTE DE ANTECEDENTES"**, no un riesgo calculado. ¿Te sirve así, o prefieres que
primero montemos las tres casillas (ECV establecida / fuma / antecedente familiar) para que
puedas marcarlas una vez por paciente?
