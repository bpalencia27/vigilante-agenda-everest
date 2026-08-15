# Qué está apagado, quién lo enciende y qué lo desbloquea

> Este archivo existe por una razón concreta: este proyecto arrastra **nueve casos** del mismo
> fallo — *cosas que parecen vivas y no lo están*. Código en sombra, pruebas que reportan verde
> sin ejecutar, funciones con cero llamadores que sobrevivieron versiones enteras.
>
> El motor portado añade 46 funciones que **hoy no tienen llamador en producción**. Sin este
> archivo serían el décimo caso. Con él son código con dueño, con pruebas y con fecha.

---

## 1. La bandera

```js
S.motorPortado   // ausente = false. Nace APAGADA.
```

Enciende **la capa de presentación**, no el motor. El motor puro se carga siempre porque el
banco de pruebas lo ejercita entero en cada corrida de CI: 21.700 comprobaciones de conformidad
más 44 de comportamiento. No es código muerto — es código probado esperando su interruptor.

**Quién la enciende:** Brandon, en su máquina, después de verlo funcionar en consulta real.
**Nunca** llega encendida a los veinte consultorios.

---

## 2. Lo que está esperando, y a qué

| Qué | Estado | Qué lo desbloquea | Cuánto cuesta |
|---|---|---|---|
| **Las 21 reglas de dosis renal** | portadas y verificadas, sin fuente de entrada | Correr `DIAGNOSTICO_MEDICAMENTOS.js` sobre un paciente con medicamentos formulados | **1 minuto** |
| **Riesgo CV / ASCVD** | sin portar | Correr `DIAGNOSTICO_FACTORES_RCV.js` para saber en qué campo vive el tabaquismo | **2 minutos** |
| GAP #6 — timing de insulinas | sin portar | Saber si Everest expone la *indicación prescrita* (sale de la misma captura) | — |
| GAP #8 — tope de furosemida por mg | regla portada, sin dosis | Saber si Everest expone la *dosis diaria* (misma captura) | — |
| Interacciones farmacológicas | sin portar | Nada. Es el siguiente bloque, ya tiene dorados generables | — |
| La divergencia de festivos | abierta | La fuente oficial de festivos colombianos | decisión tuya |
| La regla de días hábiles del Copiloto | incumplida allá | Arreglar `ajustar_fecha_habil` en `motor_deterministic.py` | trabajo en el Copiloto |

### Los dos guiones de reconocimiento

Están en la raíz del repositorio desde antes de esta rama y **nunca se han ejecutado**. Los dos
redactan la identidad antes de guardar (nombre, cédula, teléfono, dirección, correo, fecha de
nacimiento) y conservan solo los **nombres de campo**, que es lo único que hace falta.

```
DIAGNOSTICO_MEDICAMENTOS.js    → forma real de MedicamentoPorPaciente
DIAGNOSTICO_FACTORES_RCV.js    → dónde vive el tabaquismo
```

Modo de uso: abrir la historia de un paciente, F12 → Console, pegar el archivo entero, navegar a
la sección, y escribir `VGL_DIAG_MEDS_FIN()`. Se descarga un `.json`.

**Revísalo antes de mandármelo**, aunque venga redactado.

---

## 3. La costura, y por qué devuelve `null`

```js
mtrLeerMedicamentos(citaId)   // → null
mtrLeerFactoresRCV(citaId)    // → null
```

No es pereza ni un hueco: es la única respuesta honesta mientras no exista la captura. El
endpoint candidato (`MedicamentoPorPaciente`) se vio de pasada en una captura antigua y **nunca
se registró su respuesta**: no se sabe cómo se llaman los campos, si el fármaco viene como texto
libre o como código, ni si trae la dosis.

En v12.3.30 se supusieron **cuatro** nombres para la fecha de un resultado de Athenea y ninguno
existía. La casilla salía vacía y nadie se enteraba.

Hay una prueba que exige que sigan devolviendo `null`, y una mutación registrada que lo
comprueba: si alguien las engancha a un endpoint adivinado, **el banco cae**.

### El contrato, para el día que se enganchen

```js
mtrLeerMedicamentos:
  null          → no se pudo leer          (≠ "no toma nada")
  []            → se leyó, no hay activos
  ["...","..."] → nombres TAL CUAL los escribe Everest, sin normalizar

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
