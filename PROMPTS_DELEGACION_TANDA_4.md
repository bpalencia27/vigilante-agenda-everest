# Tanda 4 — todo lo que queda, repartido de una vez

> 14-ago-2026, v14.1.5, 976 comprobaciones en verde.
> Ocho tareas. Las de Jules llevan pruebas y PR; las de Gemini son informes sin código.
> Puedes lanzarlas TODAS en paralelo: están escritas para no pisarse entre ellas.

---

## ⚡ Lo de las notificaciones tardías: YA ESTÁ ARREGLADO, no hay que delegarlo

Lo que reportaron tus compañeros —"tardías, a veces no te avisa, como si fueran
asincrónicas"— eran **dos fallos distintos**, y los encontré leyendo la arquitectura. Van
corregidos en v14.1.5, con pruebas y mutaciones.

**1. Tardías.** El sondeo vive en `setInterval(tick, 5000)` **dentro de la pestaña líder**, y
el líder se elegía por orden de llegada, sin mirar si esa pestaña está a la vista. Los
navegadores **estrangulan los temporizadores de las pestañas ocultas a uno por minuto**. Si la
pestaña líder es la de la agenda y te pasas a la historia clínica —o sea, siempre— el
vigilante deja de latir cada 5 s y late cada 60. Un aviso que debía sonar al minuto 0 sonaba
hasta un minuto tarde. Ahora una pestaña **a la vista releva a una oculta**, y el relevo se
reclama en el propio `visibilitychange` (esperar al siguiente tick sería esperar justo al tick
estrangulado).

**2. "A veces no te avisa" — que NO es lo mismo.** `state.notified` vive en la memoria de cada
pestaña, así que **cada relevo de liderazgo estrenaba una siembra**: el líder nuevo daba por
vistos a TODOS los pacientes sin avisar de ninguno. Eso no es un aviso tarde, es un aviso que
**no llega nunca**, y nadie se entera. Ahora la siembra se comparte entre pestañas, sellada por
día.

Los dos están enlazados: el arreglo del #1 hace los relevos **más frecuentes**, así que sin el
#2 habría empeorado el otro síntoma. Por eso van juntos.

**Lo que te toca a ti:** avísales a tus compañeros de que actualicen el script. Y si con
v14.1.5 puesta el retraso siguiera, dímelo — quedaría una tercera causa (la cola de
`_encolarAvisoPendiente`, que solo se vacía dentro de `/viva/HCHealth`) y esa la ataco
distinto.

---

# 🟦 JULES — Tarea 6: PAS, PAD e IMC del endpoint que ya se llama

```
[OBJETIVO]
Leer presión arterial sistólica, diastólica e índice de masa corporal del historial de signos
vitales que el script YA consulta, y mostrarlos junto al estadio renal en el modal de
laboratorios.

[POR QUÉ ES BARATO]
`apiHcObtenerSignosVitales(pacienteId)` ya se llama en producción, ya está cacheada por
paciente, y su respuesta ya trae `presionSistolica`, `presionDiastolica` e `imc` en el mismo
registro del que se saca el peso. Hoy `_pesoDeSignosVitales` los tira a la basura. Cero
consultas nuevas de red.

[QUÉ HACER]
- Añadir `_signosVitalesDelRegistro(arr)` junto a `_pesoDeSignosVitales`, que devuelva
  `{ peso, pas, pad, imc, fechaIso }` leyendo SOLO `arr[0]`.
- Cada número pasa por `_labNumerico` (que ya rechaza negativos y no numéricos).
- Rangos de plausibilidad, mismo criterio de la creatinina — se RECHAZA, no se convierte:
    PAS  60 – 300 mmHg      PAD  30 – 200 mmHg      IMC  10 – 100 kg/m²
- Mostrarlos en `_renderEstadioRenalHtml`, con su fecha, igual que se muestra el peso.

[RESTRICCIONES CRÍTICAS]
- SOLO `arr[0]`, el registro más reciente. NUNCA caer al anterior si a este le falta un dato:
  mezclar la presión de hoy con el peso del mes pasado inventa un paciente que no existe. Si
  falta, se dice que falta.
- No escribir NADA en las casillas de Everest en esta tarea. Solo leer y mostrar.
- No calcular riesgo cardiovascular todavía. Eso es otra tarea y depende del tabaquismo.

[VERIFICACIÓN]
- `node tests/runner.js` en verde.
- Por cada campo, el par de siempre: un valor de otra unidad o imposible que se RECHAZA, y el
  extremo patológico REAL que SÍ pasa (PAS 220 en crisis hipertensiva tiene que pasar).
- Un caso con `arr[0]` incompleto y `arr[1]` completo: debe faltar el dato, NO heredarlo.
- Mutación obligatoria por guarda, documentada en `tests/INFORME_MUTACIONES.md`, 4 columnas,
  filas al final.

[ENTREGA]
Rama `feat/signos-vitales-pas-pad-imc`, PR con la tabla de rangos y su par de casos.
```

---

# 🟦 JULES — Tarea 7: el botón de auto-agregar a Conducta

```
[OBJETIVO]
Conectar `_conductaBuscarYAgregarExamen`, que existe, está probada y NO LA LLAMA NADIE, a un
botón real en el modal de laboratorios.

[CONTEXTO]
Es el caso clásico de este proyecto: función escrita, probada y documentada como terminada,
sin un solo llamador de producción. Búscala y verás que solo aparece en los tests.

[QUÉ HACER]
- Un botón por analito vencido en el modal de laboratorios, que llame a
  `_conductaBuscarYAgregarExamen` con el texto de `CONDUCTA_LI_TEXTO_POR_ANALITO`.
- ANTES de agregar, cruzar con el antiduplicado que el script YA tiene: si
  `pymCubiertoPorOrdenVigente` dice que ese CUPS está cubierto por una orden vigente, el botón
  sale deshabilitado y explica por qué. Decisión del médico: se conecta con el antiduplicado
  propio del script, no se agrega a ciegas.
- Estado visible por botón: pendiente / agregado / ya estaba.

[RESTRICCIONES CRÍTICAS]
- Un clic = un examen. Nada de "agregar todos" en esta tarea.
- Si la casilla de Conducta ya trae texto del médico, NO se pisa: se añade al final o se avisa.
  La casilla del médico es sagrada; búscalo en el archivo, es una regla de todo el proyecto.
- Si el examen ya está en la lista, no se duplica.

[VERIFICACIÓN]
- Prueba de que el botón deshabilitado NO llama a la función.
- Prueba de que con orden vigente el botón sale deshabilitado (usa el catálogo real, no
  códigos escritos a mano).
- Mutación por cada guarda, documentada.

[ENTREGA]
Rama `feat/boton-conducta`, PR.
```

---

# 🟦 JULES — Tarea 8: `panelActivities` — conectar o borrar, pero decidirlo

```
[OBJETIVO]
Resolver `panelActivities`, que lleva dos versiones (T4 prometió que T5 la reconectaría; T5 no
lo hizo) sin llamador de producción.

[QUÉ HACER]
1. Averigua qué hacía y si su función la cubre YA otra cosa — el dock de acciones (T5) y el
   banner PyM (T7) se le parecen mucho. Dilo con evidencia.
2. Si está duplicada: bórrala CON SUS PRUEBAS. Una prueba que cubre código muerto es peor que
   no tenerla: infla la cobertura y no protege nada.
3. Si aporta algo que no cubre nadie: conéctala a un llamador real.

[RESTRICCIONES CRÍTICAS]
- Antes de borrar, comprueba que nada la invoque por nombre dinámicamente (`window[nombre]`,
  `addEventListener` con cadena, atributo `onclick` en HTML generado). Esa es la trampa.
- No borres nada más "de paso".

[ENTREGA]
Rama `chore/panel-activities`, PR explicando cuál de los dos caminos tomaste y por qué.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 7: verifica MI arreglo de las notificaciones

> Adjunta `vigilante_agenda.user.js` (v14.1.5). `thinking: high`.

```
Te adjunto un userscript clínico. Acabo de corregir un fallo reportado en producción: las
notificaciones de llegada de pacientes salían tarde, y a veces no salían.

Mi diagnóstico fue este:
(a) El sondeo vive en setInterval(tick, 5000) dentro de la pestaña líder; el líder se elegía
    por orden de llegada sin mirar visibilidad; el navegador estrangula los temporizadores de
    las pestañas ocultas a ~1/minuto.
(b) state.notified vive en memoria por pestaña, así que cada relevo de liderazgo re-sembraba y
    se tragaba en silencio el primer aviso de cada paciente.

Mi arreglo: una pestaña visible releva a una oculta (heartbeat), el relevo se reclama en
visibilitychange, y la siembra se comparte entre pestañas por localStorage sellada por día.

NO quiero que me des la razón. Quiero que intentes REFUTARLO:

1. ¿Es correcto el diagnóstico (a)? Busca en el código TODOS los temporizadores que participan
   en el camino de un aviso, no solo el de tick. Si alguno más está estrangulado y yo no lo
   toqué, ese retraso sigue vivo. Nómbralos con su línea y su cadencia.
2. ¿Introduce mi arreglo un forcejeo nuevo? Describe el peor caso con 3 pestañas —una visible,
   dos ocultas— y con dos pestañas alternando visibilidad rápido. ¿Puede el liderazgo rebotar
   más que antes? ¿Puede quedarse SIN líder?
3. La cola `_encolarAvisoPendiente` solo se vacía dentro de `/viva/HCHealth`. Si el médico pasa
   una hora en otro módulo, ¿qué pasa con los avisos encolados? ¿Salen todos de golpe al
   entrar? Eso encaja con "asincrónicas" del reporte y YO NO LO TOQUÉ. Dime si es una tercera
   causa real y qué tan grave es.
4. ¿Hay algún camino por el que un aviso se pierda que yo no haya cubierto? En concreto:
   `crossTabDup`, `avisoYaVisto` y el sellado por día. ¿Alguno puede tragarse un aviso legítimo?
5. La siembra compartida se guarda en cada maybeNotify. ¿Cuántas escrituras a localStorage son
   en una jornada de 30 pacientes? ¿Es un problema de rendimiento en la página de Everest?

Informe, sin escribir código. Cita archivo:línea. Si crees que algo de lo mío está mal, dilo
con el caso concreto que lo rompe. Si no encuentras nada, dilo también — no inventes hallazgos
para llenar el informe.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 8: el arranque, de principio a fin

> Adjunta `vigilante_agenda.user.js`. `thinking: high`.

```
Te adjunto un userscript clínico de ~855 KB que corre sobre un EHR Angular ajeno.

Quiero entender qué pasa en los primeros 15 segundos desde que carga la página, porque ahí se
concentran los fallos que el médico ve como "el panel no aparece" o "tarda en despertar".

1. Reconstruye la secuencia de arranque en orden cronológico: qué corre inmediatamente, qué
   espera a readyState, qué está detrás de un setTimeout y con cuánto retraso. Una línea por
   paso, con archivo:línea y el retraso acumulado.
2. ¿Qué pasa si Everest tarda más de lo normal en montar su DOM? ¿Hay algo que se rinda a la
   primera y no reintente nunca?
3. ¿Hay trabajo pesado en el arranque que podría aplazarse? Busca en concreto: parseo de
   Excel, lectura completa de localStorage, construcción de CSS, y cualquier bucle sobre todo
   el documento.
4. Si el médico abre DOS pestañas de Everest a la vez, ¿las dos hacen todo el trabajo de
   arranque? ¿Cuál es el desperdicio real?
5. Ordena por impacto en lo que el médico percibe, no por elegancia del código.

Informe, sin código. Cita archivo:línea; si no estás seguro de una línea, dilo en vez de
inventarla.
```

---

# 🟩 GEMINI 3.7 FLASH — Tarea 9: qué falta para el motor de riesgo cardiovascular

> Adjunta `vigilante_agenda.user.js` y el algoritmo de 4 pasos que ya tienes.

```
Te adjunto un userscript clínico y el algoritmo de clasificación de riesgo cardiovascular en
4 pasos que debe implementar de forma determinista.

Para CADA variable que el algoritmo necesita, dime exactamente tres cosas:
  (a) ¿El script ya la tiene HOY? Si sí, en qué función y con qué nombre.
  (b) Si no la tiene, ¿está en algún dato que el script YA descarga y no lee? (Ese es el caso
      más valioso: sale gratis. Ya pasó dos veces — la edad venía en BuscarPacienteDetallado
      sin que nadie la leyera, y la presión venía en el historial de signos vitales.)
  (c) Si no está en ningún sitio, dilo claro y no propongas inferirla.

Cierra con una tabla ordenada por "esfuerzo para conseguirla", de menor a mayor, y marca cuáles
BLOQUEAN cada paso del algoritmo.

Aviso importante para tu análisis: la AUSENCIA de un antecedente NO se puede leer como "no lo
tiene". Un paciente con stent y estatina puede tener el LDL en 85. Si el script asume que no
tuvo infarto, lo clasifica en riesgo BAJO cuando es MUY ALTO. Cualquier propuesta tuya que
dependa de "si no aparece, es que no lo tiene" está mal de entrada.

Informe, sin código.
```

---

## Lo que me quedo yo

1. **Revisar los PR de Jules** (Tarea 1 `test/cobertura-honesta` lleva días esperando; su
   informe tiene una frase que me huele mal — "o por lo menos evaluadas sin fallar y
   referenciadas en código" — que suena a pruebas que solo nombran el token sin ejercitarlo).
2. **La fusión a `main`** de los ~195 commits marcados `[NO FUSIONAR SIN APROBACIÓN DEL MÉDICO]`.
3. **Montar las tres casillas del RCV** (ECV establecida / fuma / antecedente familiar) en
   cuanto me mandes la cosecha del DOM — con eso el Paso 3 del algoritmo deja de estar
   bloqueado.

---

## 🔴 Lo que sigue esperándote a ti (y no puedo hacer yo)

| Qué | Por qué importa | Cuánto tarda |
|---|---|---|
| **Rotar la contraseña de Athenea** | Estuvo publicada en claro en el código y sigue en el historial de git. **Retirarla no la desactiva.** Es lo más urgente de esta lista. | 2 min |
| **Correr `VGL_COSECHA_TODO()`** en una historia clínica | Desbloquea tabaquismo y antecedentes, que es lo único que frena el Paso 3 del motor de RCV | 1 min |
| **La captura del campo `unidades`** (sigue de la Tanda 3) | La RAC en mg/mmol se lee como normal cuando es nefropatía activa, y ninguna guarda de rango puede cazarlo | 5 min |
| Avisar a tus compañeros de que actualicen a v14.1.5 | Es el arreglo de las notificaciones tardías | 1 min |
