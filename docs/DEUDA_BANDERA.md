# Qué está apagado, quién lo enciende y qué lo desbloquea

> Este archivo existe por una razón concreta: este proyecto arrastra **nueve casos** del mismo
> fallo — *cosas que parecen vivas y no lo están*. Código en sombra, pruebas que reportan verde
> sin ejecutar, funciones con cero llamadores que sobrevivieron versiones enteras.
>
> El motor portado añade 76 funciones `mtr*` que **hoy no tienen llamador en producción real**
> (fuera de sus propias pruebas): la presentación que sí las invoca vive detrás de una bandera
> apagada. Sin este archivo serían el décimo caso. Con él son código con dueño, con pruebas y
> con fecha.

---

## 1. La bandera

```js
S.motorPortado   // ausente = false. Nace APAGADA.
```

Enciende **la capa de presentación**, no el motor. El motor puro se carga siempre porque el
banco de pruebas lo ejercita entero en cada corrida de CI: 15.222 vectores de conformidad más
128 pruebas de comportamiento (suites 38-42). No es código muerto — es código probado esperando
su interruptor.

**Quién la enciende:** Brandon, en su máquina, después de verlo funcionar en consulta real.
**Nunca** llega encendida a los veinte consultorios.

---

## 2. Lo que está esperando, y a qué

| Qué | Estado | Qué lo desbloquea | Cuánto cuesta |
|---|---|---|---|
| **Las 21 reglas de dosis renal** | **ENGANCHADAS** al endpoint real | Nada. Encender la bandera y verlo en consulta | — |
| **Las 8 interacciones farmacológicas** | **ENGANCHADAS**, misma costura de medicamentos | Nada. Encender la bandera y verlo en consulta | — |
| **La capa de presentación** (avisos ámbar bajo función renal) | escrita y probada, detrás de la bandera | Nada. Verlo funcionar en consulta real | — |
| **Riesgo CV / ASCVD** | sin portar | Correr `DIAGNOSTICO_FACTORES_RCV.js` para saber en qué campo vive el tabaquismo | **2 minutos** |
| GAP #6 — timing de insulinas | sin portar, **pero ya tiene 50 vectores dorados generados** (`_regla_insulina_timing`, capturados contra el Python real y sin usar — ver nota abajo) | Saber si Everest expone la *indicación prescrita* (sale de la misma captura de medicamentos) | — |
| GAP #8 — tope de furosemida por mg | regla portada, sin dosis | Saber si Everest expone la *dosis diaria* (misma captura) | — |
| La divergencia de festivos | abierta | La fuente oficial de festivos colombianos | decisión tuya |
| La regla de días hábiles del Copiloto | incumplida allá | Arreglar `ajustar_fecha_habil` en `motor_deterministic.py` | trabajo en el Copiloto |

**Sobre los 50 vectores de GAP #6 sin usar:** `golden_gen.py` los generó la misma noche que los
demás (ejecutando `motor_deterministic._regla_insulina_timing` real), previendo portar la regla
esa misma sesión. No se llegó a escribir `mtrReglaInsulinaTiming` ni a enganchar `indicaciones`
en el orquestador (la prueba de la suite 43 que exige aridad 6, no 8, existe justo para que
nadie lo haga a medias). El archivo `tests/golden/_regla_insulina_timing.json` queda ahí,
verificado contra el Python de origen y con su SHA-256, esperando a que alguien porte la regla
— es trabajo ya hecho, no hay que volver a capturarlo.

### El guion que SIGUE haciendo falta

`DIAGNOSTICO_MEDICAMENTOS.js` ya **no** hace falta: el endpoint estaba capturado desde el
10-ago-2026 y su guion buscaba un nombre equivocado (`MedicamentoPorPaciente`; el real es
`CargarMedicamentosPaciente`, en `APIMedicamentoHealth`).

Sigue haciendo falta **`DIAGNOSTICO_FACTORES_RCV.js`**, para el tabaquismo. Abrir la historia de
un paciente, F12 → Console, pegar el archivo entero, navegar por las pestañas donde estén los
factores de riesgo, y terminar con la función que el propio guion indica. Redacta la identidad
antes de guardar y conserva solo los nombres de campo.

**Revísalo antes de mandármelo**, aunque venga redactado.

### Y una lección que vale más que el guion

**El endpoint llevaba cinco días capturado y nadie lo miró.** El GRABADOR del proyecto graba
cuerpos de respuesta; el `.har` exportado del navegador NO (61 llamadas de API, cero cuerpos).
Antes de escribir un guion de reconocimiento nuevo, mirar qué hay ya en `captura_*.json`.

---

## 3. La costura

### Medicamentos — ENGANCHADA

El endpoint estaba capturado desde el 10-ago-2026 y nadie lo había mirado:

```
POST /apiviva/APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente
```

`mtrRefrescarMedicamentos(pacienteId)` lo llama, `mtrLeerMedicamentos(pacienteId)` lee la caché
(5 min, por paciente). Solo cuentan las formulaciones en estado `PENDIENTE`.

**Lo que falta para que el médico lo VEA:** la capa de presentación (los avisos ámbar en el
modal renal) y encender `S.motorPortado`. El cálculo y la lectura ya están.

### Tabaquismo — SIGUE EN `null`

```js
mtrLeerFactoresRCV(citaId)    // → null
```

`ObtenerDatosPuntajeFramingham` existe —aparece en `test.har`— pero ese HAR se exportó **sin
cuerpos de respuesta**: 61 llamadas de API, ninguna con cuerpo. Se sabe cómo se llama el
endpoint; no cómo se llaman sus campos.

En v12.3.30 se supusieron **cuatro** nombres para la fecha de un resultado de Athenea y ninguno
existía. La casilla salía vacía y nadie se enteraba. Hay una prueba que exige que siga
devolviendo `null`.

### El contrato de lo que sigue pendiente

```js
mtrLeerFactoresRCV:
  null                → no se pudo leer
  { fuma: true|false|null, ... }
        fuma === null → el campo existe pero está sin diligenciar
                        (≠ "no fuma": eso cambia el riesgo calculado)
```

---

## 4. La regla que hace todo esto seguro

`mtrAvisosDosisRenal` **nunca devuelve una lista pelada**. Devuelve siempre un objeto con
`motivo`:

| motivo | Significa |
|---|---|
| `SIN_LISTA_DE_MEDICAMENTOS` | No sé qué toma. **No significa que no haya riesgo.** |
| `SIN_FUNCION_RENAL` | Falta creatinina, peso, talla o edad. |
| `SIN_MEDICAMENTOS_ACTIVOS` | Leí la lista y está vacía. |
| `SIN_HALLAZGOS` | Leí todo y ningún fármaco requiere ajuste. |
| `OK` | Hay avisos. |

Los dos silencios peligrosos —"no pude leer" y "leí y está bien"— son clínicamente opuestos y
**tienen motivos distintos**. Hay una prueba que exige que nunca coincidan.

Es la propiedad más importante de todo el bloque: el fallo peligroso de un avisador clínico no
es avisar de más, es **callar porque no pudo leer** y que eso se lea como tranquilidad.
