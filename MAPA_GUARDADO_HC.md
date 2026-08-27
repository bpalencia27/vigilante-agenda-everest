# MAPA DEL GUARDADO DE LA HISTORIA CLÍNICA DE EVEREST

**Capturado en consulta el 27-ago-2026** con `DIAGNOSTICO_GUARDADO_HC.js`, sobre un paciente
real. Este documento contiene **solo nombres de campo, tipos y tamaños** — ni un valor, ni un
nombre, ni una cédula. El archivo original de la captura tampoco los tiene: el diagnóstico
está escrito para no guardarlos.

## Por qué existe este documento

El script leía del DOM **25 casillas** (`MTR_CAMPOS_FACTORES`). Everest, al guardar, envía al
servidor un paquete con **111 campos en la raíz**, y solo en antecedentes patológicos hay
**109 marcaciones**. La distancia entre lo que el asistente ve y lo que el médico realmente
escribió era, hasta esta captura, desconocida — y adivinarla era exactamente lo que este
proyecto se prohíbe: en v12.3.30 se supusieron cuatro nombres para la fecha de un resultado y
**ninguno de los cuatro existía**.

## Los cuatro envíos de un solo «Guardar»

| Ruta | Qué lleva |
|---|---|
| `APIHCHealth/api/Morbilidad/GuardarJsonHC` | 4 campos en la raíz, 40332 caracteres |
| `APIHCHealth/api/Morbilidad/GuardarJsonHC` | 4 campos en la raíz, 3704 caracteres |
| `APIPacienteV2/api/Paciente/ActualizarDatosPacienteHC/[ID]` | 91 campos en la raíz, 2455 caracteres |
| `APIHCHealth/api/Morbilidad/GuardarHCMorbilidad` | 111 campos en la raíz, 36938 caracteres |

El que importa es **`GuardarHCMorbilidad`**: es la historia clínica entera. Los dos
`GuardarJsonHC` llevan un campo `json` con el contenido serializado dentro (36.894 y 3.231
caracteres), y `ActualizarDatosPacienteHC` son los datos demográficos y administrativos.

## Las secciones de `GuardarHCMorbilidad`

Solo las que alimentan el razonamiento clínico. El resto (banderas `swFinalizacion*`,
programas de PyM, incapacidades) queda listado en la captura original.


### `examenFisico` — 39 campos

Aquí está **todo el examen físico**, no solo la tensión y el peso. Nótese
`circunferenciaAbdominal` **y** `cinturaPelvica` como campos distintos: es la confirmación
de la corrección de v17.6.97 (el script leía la cadera creyendo que era la cintura).

```
abdomen, boca, cabeza
cinturaPelvica, circunferenciaAbdominal, corazon
cuello, examenFisicoMamas, frecuenciaRespiratoria
garganta, genitoUrinario, imc
musculoEsqueletico, nariz, neurologico
oidos, ojos, pelvis
pelvistexto, perimetroBraquial, perimetroCefalico
perimetroPantorrilla, peso, piel
pliegueCutaneoSubescapular, pliegueCutaneoTriceps, presionDiastolica
presionSistolica, presiones, pulmon
pulso, saturacionOxigeno, sintomasGenerales
taDiastolicaAcostado, taSistolicaAcostado, talla
temperatura, torax, vascularPeriferico
```

### `antecedentePatologicos` — 132 campos

**109 marcaciones.** El clasificador de riesgo hoy mira 12. Entre las que no ve hay varias
que deciden categoría por sí solas: `infartoMiocardio`, `anginaDePecho`,
`revascularizacion`, `obstruccionesArteriales`, `isquemiaCerebralTransitoria` (todas ECV
establecida), `retinopatiaDiabetica` e `insuficienciaRenalcronica` (daño de órgano blanco).

```
accidenteCerebrovascularHemorragico, accidenteCerebrovascularIsquemico, aneurismasaorticos
anginaDePecho, arritmias, artritisReumatoide
autoinmunes, cancer, cardiomiopatia
cataratas, coagulosSanguineos, danorenalAgudo
desprendimientoRetina, diabetes, dislipidemia
ecv, emboliaPulmonar, emergenciaHipertensiva
enfermedadBuerger, enfermedadCerebroVascular, enfermedadRenal
enfermedadVision, epoc, eventoHemorragico
eventoTrombotio, eventoVascular, eventoembolico
fenomenoRaynaud, flebitis, glaucoma
hipertension, hipoglicemia, histerectomia
historicoAutoinmunes, historicoCancer, historicoDiabetes
historicoDislipidemia, historicoECV, historicoHipertension
historicoHipoglicemia, historicoHisterectomia, historicoInfeccioso
historicoInsuficienciaCardiaca, historicoInternaciones, historicoObservacionArritmias
historicoOtros, historicoTranstornosGastrointestinales, historicoTranstornosHormonales
historicoTranstornosNeuronales, historicoVacectomia, historicoValvulopatias
infartoMiocardio, infeccioso, insuficienciaCardiaca
insuficienciaRenalAguda, insuficienciaRenalcronica, internaciones
isquemiaCerebralTransitoria, lepra, ojoSeco
otros, pruebaTBC, pruebaVIH
retinopatiaDiabetica, revascularizacion, sincope
sindromeAortico, transtornosGastrointestinales, transtornosHormonales
transtornosNeuronales, tromboembolismoPulmunar, vacectomia
valvulopatias
```

Más 59 campos de fecha y observación libre asociados a los anteriores.

### `habitosGestionRiesgo` — 33 campos

El script lee 6 de estos 33. Faltan, entre otros, `indiceTabaquico` (que es un número, no
un sí/no), `frecuenciaAlcohol`, `sintomaticoRespiratorio` y `estres`.

> **Ojo, trampa real:** existen `horasSuenoAdecuadas` **y** `horasSueñoAdecuadas`, con y
> sin eñe. Cualquier lector debe probar las dos formas.

```
actualmenteFumaOExfumador, alcohol, azucarAlta
bajoConsumoGrasas, bajoConsumoSal, buenosHabitosAalimenticios
consumoAlimentosRicosFibra, discapacidad, ejercicioPermanente
estres, frecuenciaAlcohol, frecuenciaFumador
fumador, habitoOtros, horasSuenoAdecuadas
horasSueñoAdecuadas, indiceTabaquico, mayor40Anios
medicamentoAntiHipertensivos, pesoAdecuadoTalla, postTestVIH
preTestVIH, sangreOcultaEnHeces, seQuedaSinAliento
sedentarismo, sintomaticoRespiratorio, sustanciasPsicoactivas
tieneFlemaMayoriaDias, toceMuchoMayoriaDias, tomaAgua
victimaMaltrato, victimaViolenciaSexual
```

Más 1 campos de fecha y observación libre asociados a los anteriores.

### `antecedenteFamiliar` — 25 campos

El script lee 1 de 25 (`Cardiovasculares`). Cada antecedente trae además su fecha y su
observación.

```
cancerColon, cancerMama, cancerProstata
cancerPulmon, cardiovasculares, diabetes
hipertension, otroTipoCancer
```

Más 17 campos de fecha y observación libre asociados a los anteriores.

### `revisionSistema` — 20 campos

Revisión por sistemas completa, hoy invisible para el asistente.

```
boca, cardiovascular, corazon
endocrino, garganta, gastroIntestinal
genitalUrinario, hematopoyetico, linfatico
musculoEsqueleto, nariz, nervioso
oido, ojos, pelvis
pelvistexto, pielYAnexos, pulmon
respiratorio, sintomasGenerales
```

### Campos de texto libre de la consulta

| Campo | Qué es |
|---|---|
| `motivo` | motivo de consulta |
| `ultimaEnfermedad` | enfermedad actual |
| `analisisYplan` | análisis y plan |
| `recomendacionesMedicas` | recomendaciones |

Son **exactamente las tres casillas que el redactor con IA escribe**, más el motivo. Que
viajen aquí confirma el contrato: lo que el asistente redacta va a estos campos.

### Listas

`farmacologicos` (medicamentos, con `valor`, `maxMed`, `vademecunId` entre otros),
`diagnosticos`, `diagnosticoPrincipal`, `ListadoOrdenamiento`, `listadoPYP`,
`ListadoResultado`, `quirurgicos`, `traumaticos`, `transfusiones`, `alergicos`.

## Lo que esto habilita, y lo que NO

**Habilita** (Parte II del plan de la IA):
1. Un interceptor que lea este mismo paquete y lo guarde por paciente.
2. Una barrera de desidentificación **antes** de que nada de esto se acerque a un modelo.
3. Una hoja de hechos que pase de 25 casillas a las secciones completas.

**No habilita, y conviene decirlo:** este documento describe la **forma**, no el
**significado**. No se sabe todavía qué valores admite cada campo (¿`sexo` es «M»/«F»?,
¿`pruebaVIH` es booleano o un código?), y eso hay que verlo con una captura de valores
—desidentificada— o preguntándoselo al médico campo por campo. **Suponerlo sería repetir
v12.3.30.**

## Privacidad

Ni este documento ni la captura de la que sale contienen valores. La captura original **no se
versiona en el repositorio**: se queda en el equipo del médico. Lo que se guarda aquí son
nombres de campo, que son contrato de la aplicación, no datos de nadie.

