# Auditoría combinada — 25-ago-2026

Dos flujos independientes de agentes, ambos completados 100% (incluida su pasada de
verificación adversarial — cada hallazgo listado abajo como "CONFIRMADO" fue puesto en
duda por un segundo agente a propósito antes de llegar aquí):

- **`auditoria-v68`**: 159 cláusulas del `MOTOR_RCV_V68_SPEC.md` (su spec clínico,
  pegado el 25-ago) contra el motor `mtr*` portado. 23 declaradas "falta"; 20
  confirmadas FALTA + 1 parcial tras refutación adversarial.
- **`barrido-s-plus`**: barrido completo del archivo (10 agentes, ~34.000 líneas) +
  `TABLERO/Codigo.gs` + el banco de pruebas. 114 hallazgos candidatos, 30 verificados
  adversarialmente (29 CONFIRMADO, 1 REFUTADO), 20 funciones candidatas a código muerto.

**Nada de esto se ha tocado todavía.** Es un mapa para que usted decida qué se ataca
primero — no una lista de cambios ya hechos.

---

## 0. Antes que nada: la cobertura de pruebas de ESTA rama es incompleta

Uno de los agentes del barrido comparó `tests/` de esta rama contra
`origin/claude/v17-6-2-22ago`: **41 suites aquí contra 72 en esa rama — faltan ~31**
(38, 40-45, 47-56, 59-69), y son justo las que defienden el código v17.6.x que SÍ está
en este archivo (Panel del paciente, motor RCV/fármaco, tablero, cierre de cita).
Cobertura real por ejecución: **48.9% (398/948 funciones sin cubrir)**, incluida TODA la
vía de escritura de alto riesgo (dead-man/`vglEscrituraPermitida`, Deshacer/espejo,
llenado de factores) y el Panel del paciente completo. `tests/INFORME_MUTACIONES.md` de
esta rama cita suites (`suite_67`/`68`/`62`/`47`...) que aquí no existen.

**Por qué importa para todo lo demás de este informe**: "1486/1486 en verde" en esta
rama no significa lo mismo que en la rama completa. Antes de fiarse de que un fix nuevo
quedó bien probado, conviene recuperar esas ~31 suites (probablemente con un
`git merge`/`cherry-pick` desde `origin/claude/v17-6-2-22ago`, no reescribiéndolas).

---

## 1. Bugs de seguridad clínica/operativa — CONFIRMADOS, arreglar primero

Ordenados por lo que puede pasarle a un paciente real HOY, no por dónde viven en el archivo.

### 1.1 `mtrUltimaPrescripcionPorMolecula` borra medicamentos reales distintos (ya en producción, v17.6.52)
`vigilante_agenda.user.js:27144-27172` — la "molécula" es el **primer token** del nombre
normalizado. Verificado: `ACIDO ACETILSALICILICO` y `ACIDO FOLICO` → ambos `"acido"`;
`INSULINA GLARGINA` e `INSULINA LISPRO` → ambos `"insulina"`; `CARBONATO DE CALCIO` y
`CARBONATO DE LITIO` → ambos `"carbonato"`; `SULFATO FERROSO` y `SULFATO DE MAGNESIO` →
ambos `"sulfato"`. Solo sobrevive el renglón con la fecha más reciente de esa "molécula"
→ el otro fármaco **desaparece en silencio** de la lista que alimenta Panel, avisos de
dosis renal, interacciones y duplicidad terapéutica. Caso real: la aspirina se borra
porque el ácido fólico se formuló después, y con ella se apaga la alerta de
antiagregante+AINE/DOAC. La insulina basal se borra porque la prandial se formuló en
otro control — justo el esquema que el propio catálogo (`MTR_GRUPOS_DUPLICABLES`,
27724-27729) declara correcto y excluye a propósito de duplicidad. Las pruebas de
`suite_39` solo cubren el caso de la MISMA molécula (amlodipino/valsartán) — ninguna
caza esto. **Este es el hallazgo que el barrido anterior ya había señalado sobre este
filtro — queda confirmado, no era ruido.**

### 1.2 `RCV_DOCTORS` hace match por substring — escritura real con flags incorrectos
`vigilante_agenda.user.js:16230-16234`, consumido en `apiAccesoAsignarTurno:16278-16286`.
`RCV_DOCTORS.some(p => docName.includes(p))` — `"PINO"` es substring de `"OSPINO"` y de
`"ESPINOSA"` (verificado carácter por carácter). El resultado fija `swPyM`/
`swProgEspecial` en el **POST real** que crea la cita en Athenea — puede forzar esos
flags a `true` para cualquier médico cuyo apellido contenga el substring, sin ser del
programa RCV. Esto no es un bug de UI: escribe mal una cita real en el sistema oficial.

### 1.3 Credenciales de Athenea: la captura en vivo no guarda nada, y la consola miente
`vigilante_agenda.user.js:944-1002` vs `2185-2187`. El bloque que corre en la página de
Athenea hace `return` en la línea 1001 **antes** de que `ATH_CRED_KEY`/
`atheneaLoginBloqueado` (2185-2187) se inicialicen — TDZ permanente en ese contexto.
`atheneaCredsSet`/`atheneaCredsGet` existen (hoisted) pero referencian esa constante
dentro de un `try/catch` que traga el `ReferenceError` y devuelve `false`/`null`. La
consola igual imprime **"Credenciales capturadas y guardadas para auto-login
permanente"** (línea 945) sin comprobar el retorno. Desde v17.6.28 (que hizo de esta la
ÚNICA vía de escritura), capturar la sesión a mano en Athenea no persiste nada, y el
autofill del formulario de login queda muerto en un equipo ya migrado. Fix: mover las
tres declaraciones antes del bloque del host de Athenea (o `var`/función). Ya estaba
identificado en un barrido anterior; queda confirmado con ubicación exacta.

### 1.4 Uroanálisis "por componente" puede colar un SOMF o una PCR como si fuera orina
`vigilante_agenda.user.js:2908-2914` (`_ultimaFechaPorAnalito`, respaldo
`uroanalisisPorComponentes`). Es el ÚNICO punto donde `_matchUroComponente(lab)` se usa
**sin** exigir `_esAnalitoDeOrina(lab)` (compárese `_hayComponenteUroReal:1373` e
`injectLabsIntoCronicos:3153`, que sí lo exigen). `SANGRE OCULTA EN MATERIA FECAL`
(SOMF, tamización de colon — frecuente en estos mismos pacientes) casa con el componente
SANGRE; `PROTEINA C REACTIVA` casa con PROTEINURIA. Efecto real: `_analitosRcvVencidos`
(el aviso de entrada) puede declarar el uroanálisis **vigente** por la fecha de un
SOMF/PCR reciente — silenciando el aviso rojo justo cuando el uroanálisis sí está
vencido. Fix de una línea: añadir `_esAnalitoDeOrina(lab)` a esa condición.

### 1.5 Sexo ausente no bloquea el cálculo de TFG — sube el estadio renal administrativo un grado
`mtrEvaluarErc:29508` (spec S0/S1). `guardaComun` exige solo edad+creatinina; con sexo
vacío, `mtrEsSexoFemenino` da `false` y **las dos fórmulas se calculan como hombre**, y
`datosCompletos` sale `true`. Verificado con el harness: `{edad:70, peso:70, creat:1.0,
sexo:''}` → CrCl 68.1 = G2; el mismo caso con `sexo:'F'` → CrCl 57.8 = **G3a**. Una mujer
sin sexo registrado sube un estadio administrativo entero — cambia vigencias, ventana
ANR, bloqueos de PTH/Fósforo/Albúmina y la fecha de toma. El número ya se muestra en
pantalla junto al aviso "falta: sexo", sin distinguir "calculado con supuesto" de
"calculado con dato real". La otra vía del archivo (`estadioRenalDelPaciente:15949`) SÍ
lleva esta defensa (avisa "esto sobreestima la TFG en un 15%") — el motor `mtr*` no la
heredó. Sin cobertura de prueba.

### 1.6 Falta el peso → el plan de exámenes ERC entero desaparece, sin avisar por qué
`mtrPlanParaclinicos:30139` vía `mtrVigenciaDias:26105` (`mtrIdxEstadio` da `null`).
Consecuencia directa de 1.5: sin peso, `estadioAdministrativo` es `null`, y **los 9
drivers de ERC salen NO_APLICA** con el motivo "no hay ningún examen que vigilar con
este programa y estadio". Verificado con el harness (ERC, edad 70, creat 1.6, sin peso):
plan vacío, cero exámenes pendientes. Al médico se le presenta como "no hay nada que
vigilar", no como "falta el peso". No pasa en HTA/DM2 puros (esas tablas no usan
estadio).

### 1.7 Vigencia legacy de RAC≥30 nunca aplica el recorte a 90 días
Dos implementaciones de la misma regla. La correcta (`mtrVigenciaDiasNorma:29907`) toma
el mínimo entre vigencia de tabla y el override de albuminuria. La legacy
(`_vigenciaDiasParaAnalito:3796`, usada por `_analitosRcvVencidos` → **el aviso de
entrada y el antiduplicado de "Ordenar"**) hace `if (base != null) return base;`
**antes** de llegar a la rama RAC≥30. Verificado ejecutando ambas: RAC 350 en DM2/HTA →
motor 90 días, legacy 180 días. Un paciente con macroalbuminuria puede quedar declarado
"RAC vigente" seis meses en la pantalla que el médico ve al entrar.

### 1.8 Checkbox "Agendar también la Toma de Muestras" se apaga solo en repintados
`cargarHorasLab:19884-19939`. El checkbox se pone `checked=false` al INICIO de cada
recarga de horas (cambio de chip de día, cambio de especialidad) y solo se re-marca si
es el default Y el médico nunca lo tocó. Si el médico lo marcó a mano una vez
(`dataset.tocado='1'`), la siguiente recarga lo apaga y NO lo vuelve a marcar. Al
confirmar se crea SOLO la cita de control, sin la toma que el médico pidió — misma clase
de bug que ya se corrigió para el celular del SMS (`_celularSmsEditadoManual`, v17.0.3);
falta el flag equivalente aquí.

### 1.9 Fecha de toma elegida a mano se descarta en silencio (mismo módulo)
`renderLabDayChips:19987`, llamada desde `cargarHoras:19488` en cada cambio de fecha de
control. Reasigna `selectedLabDateInfo` al ítem central SIN comprobar si el médico ya
había elegido otra fecha de toma con un clic. A diferencia de `_controlElegidoManual`
(que sí protege la fecha de control), no existe flag equivalente para la fecha de TOMA.

### 1.10 Enfermedad Actual: el blindaje v17.6.54 solo filtra 2 de 5 líneas prohibidas
`mtrHechosSinExamenFisico:31097-31101` filtra solo `"Signos vitales:"` y `"Laboratorios y
paraclínicos:"`. Pero `mtrHojaDeHechosTexto` también emite `"Función renal: TFG..."`
(30596), `"Riesgo cardiovascular: ..."` (30598) y `"Meta LDL: <..."` (30599) — exactamente
los datos que `MTR_EA_SYS` prohíbe explícitamente para Enfermedad Actual (líneas
30779-30780) y por los que se abrió la auditoría v17.3.0 originalmente. La segunda capa
(`mtrQuitarExamenFisicoIA`) tampoco los ataja: exige cifra con unidad de signo vital
(mmHg, kg/m², lpm), y "TFG 52 mL/min" o "Meta LDL <70" no llevan esas unidades. Arreglo
de una línea: añadir esos tres prefijos al filtro (el patrón ya está montado, la suite
57 ya vigila esos prefijos).

### 1.11 Ajuste ASCVD Colombia: con sexo ausente, mezcla ecuación masculina con factor femenino
`mtrClasificarRiesgoCv:29020`. El ASCVD crudo se calcula con
`mtrEsSexoFemenino(x.sexo)`; el factor de ajuste Colombia se elige con
`mtrEsSexoMasculino(x.sexo) ? 0.28 : 0.54`. Con sexo ausente o no reconocible, AMBAS dan
`false` → se calcula el crudo con la ecuación MASCULINA y se multiplica por el factor
FEMENINO (0.54 en vez de 0.28) — casi el doble de riesgo ajustado, puede saltar de BAJO a
MODERADO o de MODERADO a ALTO.

### 1.12 "Sin estatina de alta intensidad" se dispara aunque el paciente SÍ la tenga
`mtrInerciaEstatina:33899`, cableado en `mtrResumenClinico:32125`. Los dos llamadores de
`mtrResumenClinico` (`mtrResumenDesdeModalLabs` y `mtrRecalcularConFactores`) **nunca
pasan `meds`** en el ctx. Con `meds` undefined, `mtrEstatinaAltaIntensidad` devuelve
`null` siempre → cada falla de LDL dispara "⚠ LDL en falla sin estatina de alta
intensidad" **incluso en un paciente con atorvastatina 80 mg**. Es una afirmación de
hecho falsa que empuja a subir una dosis ya máxima.

### 1.13 Meta de LDL individual "solo apretar" nunca se aplica — la función está bien, nadie la alimenta
`mtrMetasLipidicas:29043` (`Math.min(base.ldl, previa)`, correcto y verificado). Pero
ningún llamador de `mtrResumenClinico` suministra `ldlMetaPrevia` — la rama "apretar" es
código inerte en producción: siempre gana la meta calculada por categoría, nunca la meta
individual que el médico ya había fijado. Mismo patrón de eslabón sin cablear que ya se
documentó para `ldlBasal` (v16.9.0) y `hba1c` (v17.6.0).

### 1.14 `order_list` del JSON deja fuera lo cosechado y las fusiones MTT
`mtrJsonV68DesdeResumen:32001` arma `order_list` como `faltantes+vencidos` en vez de
usar `plan.ordenar` (que el motor ya construye bien, con cosechados y sin bloqueados).
Consecuencia verificada con el harness (ERC G4, lípidos vencidos): `plan.ordenar` incluye
el HDL cosechado, `order_list` no. **La nota clínica que el médico copia a la historia
describe MENOS exámenes de los que el asistente realmente va a ordenar.** Arreglo de una
línea: usar `plan.ordenar` (sumando las fusiones MTT).

### 1.15 Perfil lipídico puede partirse — un HDL diferido por 0.6 días de margen
No existe noción de "grupo lipídico" en el motor: CT/HDL/LDL/TG son 4 drivers
independientes. Reproducido con el harness (ERC G4, hoy 2026-12-15, panel tomado
2026-08-20): `ORDENAR` = glucosa, creatinina, CT, LDL, TG, uroanálisis, RAC · `DIFERIDO`
= HDL (+60 días) — porque en G4 el HDL vale 180 días y los otros tres 120: con los cuatro
tomados el mismo día, el HDL vence 60 días después de la FTL y el margen de cosecha del
33% lo rechaza por 0.6 días (60 > 180×0.33=59.4). Se ordena el panel partido, y sin HDL
fresco tampoco se puede calcular cNoHDL del control.

### 1.16 Estado A con valor pero sin fecha pierde el valor y puede reordenar un examen ya resultado
`mtrEstadoAnalito:30091-30094` decide el estado SOLO por la fecha: sin fecha → Estado A,
`sin_historial`, **y el valor se pone a `null`**. Verificado: `mtrEstadoAnalito('CREATININA',
{fecha:null, valor:1.0}, ...)` → estado A, valor `null`. Es alcanzable (`_extractAtheneaFecha`
puede devolver `null` y `mtrResumenDesdeModalLabs` lo copia tal cual). Consecuencia: se le
ordena al paciente un examen que YA TIENE resultado, y se mueve la fecha de toma.

### 1.17 RAC≥30 vencido nunca llega al Estado R prioritario
`mtrEstadoAnalito:30141` exige `estado !== "A"` para asignar `"R"` — un RAC vencido cae
siempre en el Estado A genérico (piso HOY+14, sin el HOY+21 prioritario de v68, sin
reinicio de 90 días). Confirmado por refutación adversarial.

### 1.18 Falla leve (regla del 50%) adelanta fechas sin estar documentada como decisión
`mtrEstadoAnalito:30087` (`mtrAcortarPorFueraDeMeta`) parte la vigencia A LA MITAD de
cualquier analito con meta que esté por encima de meta+15% — decisión real del médico
(20-ago, v16.2.7) pero ausente de la tabla de divergencias del spec.

### 1.19 MTT-CONSOLIDA puede sacar un LDL a las 2 semanas de cambiar la estatina
`mtrConsolidarMtt:33918-33927` compara con `Math.abs(...)` (bidireccional) en vez de
"retraso" (unidireccional). Con la FTL ANTES del recontrol (caso corriente: FTL 14-21d,
recontrol LDL 42d), la diferencia entra en el `<=60` de fusión y el LDL se fusiona a una
toma de 2-3 semanas — por debajo del piso "nunca <4 semanas" que el propio motor define.
Un LDL a las 2 semanas de un cambio de estatina no es interpretable.

### 1.20 Auto-Labs presenta un fallo de lectura como hecho clínico
Botón Auto-Labs, rama final (~línea 5187). Con `labs===null` (fallo de lectura, contrato
documentado desde v16.2.8) y sesión viva, cae en el mensaje **"Athenea no tiene
laboratorios..."** — afirma ausencia de datos cuando en realidad la lectura falló.

### 1.21 El dead-man switch no protege la inserción de notas de IA
`vglEscrituraPermitida` (24632-24638) tiene un ÚNICO llamador en todo el archivo (línea
18203, llenado de antecedentes). El mensaje del propio dead-man promete "dejo de
escribir en la historia clínica (llenar antecedentes **e insertar notas**)" — pero
ningún punto de inserción de notas de texto libre generadas por IA consulta el dead-man.

### 1.22 Caja de "datos críticos" puede quedar ilegible por el CSS de Everest
`_pintarCriticos` (32519-32523, dentro del redactor IA) usa `<div style="...">` sin clase
propia. El blindaje tipográfico (`:where(...)`, línea 14516) solo cubre
`span/b/small/label/p`, **no `div`** — un `div{color:X!important}` de Everest ganaría por
herencia, dejando ilegible la caja que bloquea generar la nota sin categoría de riesgo.
Mismo patrón que el CLAUDE.md ya documenta (bug #2), en un elemento que el censo previo
no cubrió.

### 1.23 `Codigo.gs`: el resumen de telemetría puede mostrar la versión/fecha equivocada
`armarResumen():578-596`. El bucle procesa las hojas en orden fijo (…, `entorno`,
`prueba` al final) y sobrescribe `f.ultimo`/`f.ver` SIN comparar contra el valor ya
guardado — el resultado depende de qué hoja se procesó de ÚLTIMA, no de la fecha real
más reciente. Un equipo que probó la conexión una vez hace semanas en v14.x, y desde
entonces manda telemetría normal en v17.6.56, puede aparecer en el resumen de flota como
🔴 ATRASADO de forma falsa — el mismo bug que v12.6.9 decía haber corregido. Mismo patrón
(acotado a filas de hoy, menos grave) en `construirInformeDelDia():277-285`.

---

## 2. Automatización ya lista para conectar — lo que usted describió en la sesión de "ultracode"

Dos hallazgos de severidad alta categorizados como `automatizacion`, no `bug`: las
piezas para el **botón que agregue automáticamente a Ordenamientos los exámenes de la
próxima cita, desde el Panel del paciente** (el "paso 5" del flujo que usted describió)
**ya existen todas por separado y no están conectadas**:

- `_analitosRcvVencidos` + `vigenciaPorEstadio` ya calculan exactamente qué está vencido
  o vencerá para la próxima cita.
- `pymPendientesRestantes` + `pymPaqueteCubiertoPorAthenea`/`pymRcvCubiertoPorAthenea`
  (antiduplicado contra resultados reales) + `markOrdenesCreadasHoy` (candado del día).
- El Panel del paciente ya tiene el título "qué ordenar en la próxima toma"
  (`openPanelPacienteModal`, línea 5480).
- `openOrdenamientoModal` ya crea órdenes reales vía `GuardarOrdenamiento` + `PYM_CATALOG`.

Falta solo el puente: un botón en el Panel que abra el modal de Ordenamiento con los CUPS
de los vencidos **pre-marcados** (el médico revisa y confirma — respeta "el script
sugiere, el médico decide"). Sin lógica de negocio nueva que inventar.

---

## 3. Decisiones suyas ya tomadas, que faltan en la tabla de divergencias del spec

Todas estas son cambios de comportamiento **ya vigentes en producción**, documentados en
el código con fecha y cita textual suya, pero que `MOTOR_RCV_V68_SPEC.md` no registra
(solo registra cosecha 33%, sábados por grupo observado y festivos algorítmicos). Riesgo:
la próxima auditoría los vuelve a reportar como "divergencia no declarada" en vez de
"decisión ya tomada". Es trabajo de documentación, no de código — bajo riesgo, puedo
añadir estas filas a la tabla en cuanto usted confirme cuáles siguen vigentes:

- **Todo diabético entra como ALTO como mínimo** (piso institucional, v16.2.9, 20-ago).
- **Todo mayor de 79 años entra como ALTO como mínimo** (v16.4.0, 20-ago — PCE no
  validadas >79).
- **Control siempre +7 días de la toma** (no "misma semana"), unificado en TODOS los
  caminos (v16.9.0, 20-ago).
- **La FTL retrocede al día hábil anterior**, no avanza (5-ago-2026, para cumplir CERO
  VENCIDOS).
- **Sábados: "cualquier sábado si consta que el médico trabaja sábados"**, no la regla de
  grupo 1º-3º/2º-4º que el spec sí tiene tabulada (v16.9.0 amplió más de lo declarado;
  `mtrMedicoTrabajaSabado`, que sí implementa el grupo, quedó sin llamadores en
  producción).
- **Techo de la ventana Estado A es 21 días, no 22** (unificación v16.9.0).
- **Apnea del sueño nunca se marca `true`** — Everest no tiene esa casilla, solo 3
  síntomas; el código se niega a inventar el diagnóstico (documentado, 29253-29258).
- **ERC solo es programa rector si el estadio NO es G1/G2** (condición añadida al orden
  ERC>DM2>HTA).

---

## 4. "Falta" — confirmado por refutación adversarial (construir, no arreglar)

Estos 20 pasaron por un segundo agente que intentó tumbarlos con grep exhaustivo y
lectura del código real; ninguno cayó. Agrupados por lo que cuesta construirlos:

**Cálculo puro que falta (bajo esfuerzo, alto valor):**
- `cNoHDL = CT − HDL` **nunca se calcula** — solo existe la meta numérica. El modelo de
  IA lo escribe por instrucción de estilo (inventándolo), y el verificador
  anti-alucinación lo marcará en rojo cada vez. Esto es, literalmente, lo que la
  cabecera del spec prohíbe: delegarle a un LLM un cálculo determinista.
- Síndrome metabólico (≥3 de 5 criterios): no existe ningún cálculo. Hay un campo
  homónimo `sindromeMetabolico` pero es la membresía manual a un programa de Everest, no
  el cálculo clínico — y ni siquiera se lee desde el clasificador de factores.
- `[DOSIS NO ESPECIFICADA]` cuando falta dosis/frecuencia de un medicamento: no existe el
  marcador; hoy el dato ausente es invisible.

**Cableado roto (la función ya existe, nadie la conecta):**
- Glicemia como tercer eje de FALLA (junto a LDL y HbA1c) — `mtrPlanFallas` solo mira
  LDL/HbA1c.
- Fusiones MTT y su 2ª fecha prioritaria (`order_list_mtt`) — se calculan y se pintan en
  HTML, nunca llegan al JSON que lee el redactor.
- Fármaco fuera de todo grupo → "revisar ajuste renal": la detección existe, solo
  alimenta telemetría, nunca un aviso visible.
- `status: "PENDIENTE"` + texto de SOLICITUD de ASCVD cuando el Paso 4 no clasifica:
  `r.meta.status` no existe en ningún objeto real — el campo del JSON es siempre `""`.

**Rama completa sin construir (esfuerzo medio-alto):**
- "LLEGA TARDE SIN LABS" (FTL vencida y nunca tomada): ramificación 14/21/28 + nota
  médico-legal de "no imputable al médico" — no hay ni la materia prima (falta persistir
  si la FTL previa se cumplió).
- Estado B (falla) como estado propio del analito — hoy las fallas viven en un motor
  paralelo que no se refleja en `estado`.
- ANR: sincronización de RAC con la ventana Vc+60d — el RAC hoy usa el margen genérico.
- MODO ESTABLE (≥2 controles sin cambios → vigencia máxima, cita lo más tarde) — el
  contador no existe; su consumidor se retiró a propósito en v16.9.0 (decisión ya
  vigente de controlar siempre a +7 días), así que construirlo hoy sería informativo,
  no cambiaría fechas.
- Grupo LIPÍDICO (los 4 nunca aislados, vigencia = la más corta del grupo) — ver 1.15.
- Uroanálisis: pregunta de síntomas urinarios — el patrón ya existe para embarazo
  (`mtrDebePreguntarEmbarazo`/`mtrPreguntaEmbarazo`), falta la gemela para síntomas.
- `S6` como auto-validación antes de emitir el JSON (las 24 claves, TFG doble, `order_list
  ⊇ plan.ordenar`, cero vencidos tras la FTL) — no existe ninguna función que lo haga.
- FR mayores sin capturar: MASLD, hiperuricemia (ninguna interfaz los pregunta —
  hiperuricemia además choca con la lista negra: ácido úrico no se ordena, solo cabría
  confirmación manual).
- Ponderación extra por edad>75 en el conteo de factores mayores — no existe (solo un
  piso institucional de categoría por edad>79, que no es lo mismo).
- `P4: categoria_riesgo_medico` del input con trinquete (solo apretar) — la constante del
  trinquete existe y está muerta, sin ningún lector.
- "FTL previa: CUMPLIDA/INCUMPLIDA" y "Controles estables: [n]" en la FICHA — la materia
  prima está persistida, nada la compara.
- Primera línea rígida `<<FICHA_RCV | ...>>` — decisión ya documentada de NO portarla
  (evitar dos verdades), pero ausente de la tabla de divergencias del spec (solo
  documentación).

---

## 5. Otros hallazgos "diverge" de interés (severidad media, no urgente)

- **CKD-EPI/Cockcroft-Gault**: la vía legacy (`estadioRenalDelPaciente`) redondea a 1
  decimal ANTES de estadificar; el motor `mtr*` redondea después. Un CrCl de 59.96 sale
  G2 en una pantalla y G3a en otra — mismo paciente, mismo número mostrado ("60").
- **Discordancia clínico/administrativo**: para DOAC/gabapentinoides/LMWH la fórmula es
  FIJA por fármaco (siempre C-G), nunca "la que esté peor" como dice S1 — es lo que pide
  la ficha técnica (S2), pero contradice la cláusula de S1.
- **Remisión por progresión**: la ventana de 180 días (correcta para IRA) se reutiliza
  para el criterio de caída≥25%+cambio de estadio de remisión — una progresión de hace 7
  meses queda invisible para ese criterio.
- **IRA por salto KDIGO**: exige además caída≥10% y que el estadio empeore (correcciones
  v17.0.1/17.0.2, razonables, pero no están en la tabla de divergencias).
- **Normalización de unidades**: no existe para LDL ni HbA1c en la entrada del motor (sí
  para creatinina). Un LDL en mmol/L entraría crudo y se declararía "en meta" sin avisar.
- **Festivo 2027-07-13 / 2026-07-13** que la tabla del spec v68 trae y el algoritmo
  (Pascua+Emiliani) no reproduce — no corresponde a ningún festivo colombiano real;
  probablemente un error del prompt v68, a confirmar.
- **`falla_dispensacion`** cableado fijo a `"NO"` — afirma sin evidencia que no hubo
  falla de dispensación, dejando muerta la rama médico-legal del redactor.
- **ANR**: ventanas (30/45/60 días) corridas un escalón hacia arriba (45/60/90 en
  producción); el 30 real es código muerto.
- **medicamentos_actuales del JSON**: manda solo el nombre, sin la frecuencia que el
  motor ya averiguó (se descarta dos veces en la misma línea).

---

## 6. Código muerto — confirmado o dudoso (limpieza, bajo riesgo)

**Muerto real, confirmado:**
- `GHOST.subscribe` — nunca se invoca; `notify()` corre en cada set del Proxy `state`
  pero con `listeners` siempre vacío es un no-op perpetuo. Sin cobertura de prueba.
- `mtrChipResumenTexto` — el propio comentario dice "si esto desaparece, la alerta
  clínica desapareció", pero no tiene ningún llamador ni sustituto.

**Dudosa (0 llamadores en producción, solo se ejercita desde tests) — candidatas a
retirar o a confirmar que son pre-staged a propósito:**
`CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO` (declarada explícitamente como pre-staged),
`_rumTramo`, `debounceVgl`, `_pesoDeSignosVitales`, `_signosVitalesInvalidar`,
`extractAgrupador` (quedó huérfana tras un duplicado inline en producción),
`mtrInsertarSiVacia` (un comentario cercano afirma que se usa y no es cierto),
`mtrSabadoFijarGrupoManual`.

**Confirmadas VIVAS pese a la sospecha inicial** (no tocar): `applyPymIdx`,
`_renderToast`, `markOrdenesCreadasHoy`, `closeMod` (patrón de closure repetido en 8
constructores de modal — el auditor automático no ve funciones anidadas, no es señal de
muerte), `renderSettings`, `mtrEvaluarConCatalogoRcv`, `todayTokens`,
`_esUroComponenteAlterado`, `reportarError`, `doPost` (vive en `Codigo.gs`, invocada por
el runtime de Apps Script, no por una llamada explícita).

**1 hallazgo REFUTADO** (no es un bug real): `state.disabledFeatures` SÍ está
inicializado (`new Set()` en `rawState`, línea 6805) — el reporte que decía lo contrario
no se sostiene contra el código real.

---

## 7. Otros hallazgos técnicos menores (severidad baja/media, del barrido)

- `_vglEspejoGuardar`: el espejo de `vgl_ev_*` (bitácora diaria) nunca se purga de GM —
  crecimiento sin techo confirmado por grep (0 `GM_deleteValue` para ese prefijo).
- `_vglRestaurarDeEspejo` + `uxFlush`: puede resucitar una ventana de telemetría ya
  enviada tras un reinicio, generando un duplicado que el servidor no puede deduplicar.
- `uxTrack`: solo procesa el campo `extra.n`; varios llamadores mandan objetos ricos
  (`{total,conName,...}`) que se descartan enteros — solo cuenta el disparo del evento,
  no el detalle.
- MTR_RCV_CSS: varias reglas en `#vgl-ordenar-modal` colorean el contenedor completo con
  la misma especificidad que la regla del `<b>` interno — el `<b>` queda sin blindaje
  propio (mismo patrón del bug #2 del CLAUDE.md, en una ubicación no cubierta por el
  censo previo).
- `captureDoctorInfo`: el NOMBRE del médico (a diferencia del id) no pasa por
  `ORIGEN_FIABLE` y puede sobrescribirse desde cualquier URL de red que traiga el
  parámetro.
- `_afinarLabsPrimeroConCupos` sigue en `gmPostJson` (no `gmPostJsonEx`) — mismo bug de
  "null por fallo de red confundido con null por sin-cupos" que ya se corrigió tres
  veces en otras funciones hermanas del mismo archivo.
- `openPanelPacienteModal`/`_vglMarcarRadio`: dos guardas de "sigo vivo"/"un solo radio
  marcado" más débiles que sus equivalentes en otras partes del mismo archivo.
- `mtrDetectarGruposFarmacologicos` acepta implícitamente que le pasen objetos en vez de
  strings (`String(med)` da `"[object Object]"`) — hoy inofensivo porque los llamadores
  reales pasan strings, pero es una trampa latente.
- `MTR_ETIQUETA_INTERACCION` solo tiene 8 claves; ~17 reglas del catálogo traen un
  `titulo` propio que nunca se copia a la alerta — el médico ve el código crudo en vez
  del texto.
- `tests/harness.js:107-108`: `setInterval` es un no-op total bajo el harness por
  defecto — cualquier lógica que dependa de un intervalo real no se está probando salvo
  que el test lo dispare a mano.
- `#c-repgo` ("Probar conexión" en Ajustes) no usa el mismo respaldo de id anónimo que
  `reportar()` — puede enviar `equipo:''` y caer en el balde "sin equipo" del tablero.

---

## Cómo priorizar

Si tuviera que elegir por dónde empezar, en este orden de impacto/esfuerzo:

1. **1.1 y 1.2** — ya están pasando en cada consulta real hoy mismo, son arreglos
   pequeños y acotados (una función de ~15 líneas y una comparación por substring).
2. **1.4, 1.5, 1.6, 1.7** — errores de cálculo/lógica clínica con harness ya verificado,
   fixes de alcance pequeño-mediano cada uno.
3. **1.8/1.9** — mismo patrón que un bug que usted ya priorizó y se corrigió (celular del
   SMS); un flag por checkbox, bajo riesgo.
4. **1.10** — tres prefijos más en un filtro que ya existe.
5. **Sección 3** — es solo documentación; puedo hacerla en un solo PR sin tocar código.
6. El resto de la sección 1, luego sección 2 (automatización), luego sección 4.

Dígame por cuál empezamos y lo trabajo con el mismo estándar de siempre: prueba +
mutación verificada + bump de versión antes de darlo por cerrado.
