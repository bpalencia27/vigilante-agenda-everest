# Enjambre de funciones — informe verificado (01-sep-2026)
Barrido de las 41.889 líneas del userscript en **24 particiones**, cruzando cada función
contra los estados y acciones que el médico puede producir en consulta real. **222 agentes**,
0 errores. Cada hallazgo tuvo que (a) **reproducirse con `tests/harness.js` contra el HEAD
real**, no contra una copia, y (b) **sobrevivir a una refutación adversarial de tres votos**
—cada refutador con la instrucción de tumbarlo y de dar por refutado lo dudoso—.

| | |
|---|---|
| reproducidos con el arnés | **66** |
| **confirmados tras refutación** | **47** |
| descartados por los refutadores | 19 |

> **Este informe es el entregable que el médico pidió** («informe verificado, yo parcheo»).
> Nada de lo que sigue está aplicado salvo que la fila lo diga. El enjambre corrió contra un
> HEAD anterior a la v18.0.33, así que **antes de parchear cada uno hay que comprobar que
> sigue abierto** — algunos caen dentro de lo que se arregló entre la v18.0.33 y la v18.0.44.


> **Cero PHI.** Todas las cédulas, nombres y datos de paciente que aparecen en las evidencias
> de este informe son **sintéticos**, generados por los agentes para la reproducción, o vienen
> del fixture congelado del propio repositorio (`tests/fixtures/dom_everest_agenda.html`).
> Ningún dato de paciente real entró en este documento.


## Ya aplicados (no volver a parchearlos)

| hallazgo | función | versión | mutaciones |
|---|---|---|---|
| `eGFR = null` evaluado como `eGFR = 0` → dos avisos farmacológicos falsos | `mtrEvaluarInteracciones` | **v18.0.45** | 107, 108 |
| la cédula viajaba cruda en el diagnóstico «SANITIZADO» | `downloadDiagnostic` / `san()` | **v18.0.45** | 109, 110 |
| una tilde en «CÉDULA» apagaba el módulo de PyM el día entero | `findDocIdx` | **v18.0.46** | 111 |
| un RAC de 0 de hoy perdía contra un RAC de 45 de enero | `_nuevoReemplazaCandidato` | **v18.0.46** | 112, 113 |
| una coma entrecomillada borraba a un paciente del índice | `parseCSV` | **v18.0.46** | 114 |
| el `fetch` del núcleo no tenía timeout: una conexión colgada bloqueaba Agendar / Guardar orden | `_pageFetchJsonCore` | **v18.0.47** | 115 |
| un 401 (sesión caducada) no contaba como fallo ni abría el cortacircuitos | `_pageFetchJsonCore` | **v18.0.47** | 116, 117 |
| la historia clínica se archivaba bajo el paciente abierto al LLEGAR la respuesta, no aquel para el que se pidió | `mtrHcEnganchar` | **v18.0.48** | 118, 119, 120 |
| en una combinación de dosis fija se leía la dosis del OTRO principio activo | `mtrDosisDeTexto` | **v18.0.49** | 121, 122, 123 |
| «PA Descontrolada (0/105)»: un cero impreso pegado a una cifra real | `_evaluarComplejidadPaciente` | **v18.0.49** | 124 |
| el candado de leyendas compartía MORADO y VERDE: el aviso de llegada del paciente se callaba — **el reporte en vivo del médico** | `_legendMarcaUnaVez` / `maybeNotify` | **v18.0.50** | 125, 126 |
| los widgets 🧪 y 💊 quedaban flotando sobre «Citas del día» con el juicio del paciente anterior — **el otro reporte en vivo** | `mtrWidgetConductaTick` / tick general | **v18.0.51** | 127, 128 |
| el apellido real podía llegar intacto a Gemini (dos letras, o tilde desajustada) | `mtrSanearTextoLibreAI` | **v18.0.52** | 129, 130, 131 |
| el kill-switch remoto se activaba en silencio total con «modo oculto» encendido | `_mostrarAvisoPausaClinica` / CSS | **v18.0.53** | 132, 133, 134 |
| la tensión se mezclaba mitad de hoy y mitad de otra medición — **reporte en vivo** | `mtrLeerTensionDelDom` / merge | **v18.0.54** | 135, 136, 137 |
| claves de programador en la nota, y una fecha que el modelo calculó — **reporte en vivo** | prompt IA / `mtrJsonV68DesdeResumen` | **v18.0.55** | 138, 139, 140 |
| el uroanálisis anormal no aparecía en la nota — **reporte en vivo** | prompt IA / `mtrEvaluarUroanalisis` | **v18.0.56** | 141, 142, 143 |
| una negación negaba todo lo de su misma frase | `mtrTextoOpinaSobre` | **v18.0.57** | 144, 145 |
| la base piloto vieja podía pisar el PyM real de hoy | `loadPymBaseDescarga` | **v18.0.58** | 147 |
| «Deshacer» revertía una casilla distinta de la que el médico creía | `_vglGuardarDeshacer` | **v18.0.59** | 148, 149 |
| la memoria clínica del paciente se orfanizaba bajo una clave nueva | `_vglCosechaGuardar` | **v18.0.60** | 150 |
| «falta el peso» sobre un peso registrado pero implausible | `_renderEstadioRenalHtml` | **v18.0.61** | 151, 152 |
| un parpadeo del `doc_id` anulaba el antirrebote y fabricaba una segunda llegada | `colorAndAlert` / `state.historical` | **v18.0.62** | 153, 154, 155, 156 |
| reabrir «Ordenar» creaba una segunda orden REAL del mismo examen — **confirmado por la telemetría del 1-sep** | `openOrdenamientoModal` / `markOrdenesCreadasHoy` | **v18.0.63** | 157–161 |
| un ícono SVG nuestro se reportaba como de Everest — **confirmado por la telemetría del 1-sep** | `_rageEtiqueta` | **v18.0.63** | 162 |
| la caja roja «cifras sin respaldo» no conocía lo que el médico escribió en las OTRAS casillas de texto libre | `mtrAbrirPanelRedaccion` / `_respaldoDelMedico` | **v18.0.70** | 193 |
| un consecutivo/factura con la fecha de hoy empotrada, en una subcarpeta ajena, se colaba como el PyM del día | `esNombreDeHoy` / `nameHasToken` / `pickTodaysFile` | **v18.0.71** | 194–197 |
| la poda de la cola de carpeta (>200 pacientes) podía borrar la clave de un guardado en curso y desincronizar dos escrituras del mismo paciente — refutación de un tercer votante examinada y descartada (defendía la atomicidad de UNA llamada, no la carrera entre llamadas) | `vglCarpetaGuardarInstantanea` | **v18.0.72** | 198 |
| `_isoAMs` aceptaba fechas de calendario imposibles (31-abr, 29-feb en año no bisiesto) y las rodaba en silencio — sin round-trip, a diferencia de `mtrFechaDesdeIso`; sin camino de clic-a-daño demostrado con datos reales por ninguna de sus tres rutas (Athenea usa DateTime real; la carpeta local usa `todayStamp()`), pero corregido por consistencia interna a costo cero | `_isoAMs` (usada por `mtrLdlBasalDeSerie`, `mtrPenultimaCreatinina`, `mtrAnclaControlAnterior`) | **v18.0.73** | 199 |
| una fecha de laboratorio con día de calendario imposible (31/04, 30/02) pasaba el rango 1-31/1-12 y llegaba a escribirse en un `<input type="date">`; el navegador la rechaza pero, a diferencia del valor (v17.6.45), nadie comprobaba el retorno — casilla vacía sin aviso, y además «reclamada» en `_fechasYaUsadas` sin poder servir de respaldo a otro analito | `_parseFechaHoraLike` / `injectLabsIntoCronicos` (sus tres escrituras de fecha) | **v18.0.74** | 200–203 |
| un aviso nuevo del piloto de SharePoint (staff, no el médico en consulta) dentro de la ventana de 260 ms de un dismiss anterior podía desaparecer solo, borrado por el `remove()` diferido de la llamada previa — arreglado por higiene del indicador, no por daño clínico (el refutador tenía razón: el dato ya se había guardado antes del toast) | `spToast` / `dismissSpToast` | **v18.0.75** | 204 |
| el título de la pestaña que parpadea se capturaba una sola vez por sesión y quedaba fijado para siempre — el arreglo propuesto por el hallazgo no bastaba por sí solo (verificado con una reproducción directa): `startFlash` llama a `stopFlash` ANTES de recapturar, y `stopFlash` restauraba el título sin comprobar si de verdad había un parpadeo activo, corrompiendo el título real antes de que la recaptura pudiera verlo | `startFlash` / `stopFlash` | **v18.0.76** | 205, 206 |
| Escape y el chip de filtro rápido llamaban a `closeSheet()` directo, sin pasar por `_ajustesIntentarCerrar()`: un cambio sin guardar en Ajustes se perdía en silencio — 3 de 3 refutadores no lo tumbaron | `closeSheet` / `_ajustesIntentarCerrar` | **v18.0.77** | 207 |
| el badge «⚠ N inasistencias previas» era inalcanzable con el paciente en «En sala»/«Atendido» — justo cuando el médico lo tiene delante para dialogar sobre eso — 3 de 3 refutadores no lo tumbaron | `refrescarCuentas` / `render` | **v18.0.79** | 212, 213 |
| un arranque matado por el kill-switch marcaba el aviso de festivos como «ya mostrado hoy» sin haberlo mostrado nunca (`#vgl-toasts` no existía todavía) — el refutador disidente tenía razón en el impacto real (hoy no hay discrepancia, y el aviso no gatea ninguna fecha), pero el arreglo es gratis y sigue el mismo patrón ya usado una vez en este archivo | `_festivosAvisarSiVencida` (orden de llamada en `boot()`) | **v18.0.80** | 214 |
| el POST de medicamentos (consulta pura) se trataba como escritura por faltarle `__idempotent:true` — cero reintentos y ni siquiera la segunda vía (GM_xmlhttpRequest) ante un blip de red, a diferencia de su hermano GET — 3 de 3 refutadores no lo tumbaron | `mtrPedirMedicamentos` | **v18.0.81** | 215 |
| `estadioParaDosis` devolvía el estadio MEJOR (no el peor) cuando Cockcroft-Gault (administrativo) era más grave que CKD-EPI (clínico) — justo el caso de peso muy bajo/sarcopenia que el propio aviso de discordancia cita; sin conexión hoy (nadie lo lee todavía), pero un contrato con nombre que ya mentía | `mtrEvaluarErc` | **v18.0.82** | 216 |
| `dataset.vglVigilado` marcaba el ELEMENTO como vigilado, no el paciente — si Angular reutiliza el mismo `<textarea>` al cambiar de historia (premisa no verificada contra Everest real, admitido por el propio hallazgo, pero el arreglo es gratis y puramente defensivo), la primera edición real sobre el paciente nuevo no invalidaba el resumen en caché | `_vglVigilarTextoLibre` / `_vglNotarTextoLibre` | **v18.0.83** | 217 |
| leucocitos/hematíes «incontables»/«innumerables»/«campo cubierto» (piuria o hematuria masiva, el hallazgo MÁS grave posible) pasaban como NORMAL — ninguna palabra clave los cubría, aunque el proyecto ya reconoce el mismo léxico como severidad máxima en `mtrUroGrado` — 3 de 3 refutadores no lo tumbaron | `_esUroComponenteAlterado` | **v18.0.84** | 218 |
| el descarte barato por longitud medía la cadena SIN recortar — relleno de Excel (espacios, Alt+Enter) podía descartar en silencio una actividad de PyM real y corta — 3 de 3 refutadores no lo tumbaron | `isPending` | **v18.0.85** | 219 |
| el límite de PALABRA (letras) que v18.0.25 fijó para nombres también se aplicaba a las tachaduras numéricas (celular/teléfono/identificación), que no protege contra adyacencia de otros DÍGITOS — un número clínico no relacionado que contuviera el celular como subcadena se partía con [CENSURADO]; el refutador demostró que ningún dato clínico realista lo dispara y que scrubPII es la defensa primaria, pero el arreglo es gratis y no reduce protección en ningún caso real | `mtrHcTachar` | **v18.0.86** | 220 |
| un `vgl_cfg` corrupto se ponía en cuarentena y S volvía a fábrica en silencio, pero la clave rota NUNCA se reescribía — el ajuste del médico desaparecía sesión tras sesión hasta que él mismo guardara Ajustes; el refutador demostró que el disparador es implausible y el daño mostrado es cosmético (fallbacks ya prudentes), pero el arreglo es gratis | `safeReadJSON` (autorreparación en la construcción de `S` + aviso en `boot()`) | **v18.0.87** | 221, 222 |
| Alto Contraste fijaba el zoom en 1.12 sin mirar `S.tamanoLetra`: si el médico ya tenía «letra muy grande» (1.28) elegida en Ajustes, encender Alto Contraste la ENCOGÍA — lo opuesto de lo que ambas opciones de accesibilidad prometen; el refutador disidente concedió el mecanismo pero llamó el daño cosmético (solo el panel principal retrocede, el resto del asistente sigue en 1.28), pero el arreglo es gratis | `_vglAlternarAltoContraste` | **v18.0.88** | 223 |
| `r.obligatoriasVacias`/`r2.obligatoriasVacias` (examen que Everest exige, según su propia tabla de validación, y sigue vacío) se calculaba en cada clic de Auto-Labs pero ningún llamador lo leía jamás — se tiraba a la basura en silencio; el refutador disidente concedió el código muerto pero dudó del daño clínico (Everest probablemente ya avisa por su cuenta en el frontend nativo), pero el arreglo sigue el mismo patrón ya usado para `sinCasilla`/`implausibles` y no cuesta nada | `injectLabsIntoCronicos` (los dos llamadores) | **v18.0.89** | 224, 225 |
| `fetchAtheneaLabs` (trae los RESULTADOS de laboratorio) llamaba a `GM_xmlhttpRequest` directo, sin el seguro anti-doble-disparo `_gmReq` que ya usan las demás llamadas GM a Athenea del archivo — dos flujos pidiendo el mismo laboratorio casi a la vez duplicaban tráfico real contra un portal que el propio código ya documenta como frágil bajo carga — 3 de 3 refutadores no lo tumbaron | `fetchAtheneaLabs` | **v18.0.90** | 226 |
| `_vglChooserModal` (selector "Exámenes"/"Examen normal") era el único modal del script que no pasaba por `_activarAccesibilidadModal`: Escape no lo cerraba y Tab no quedaba atrapado dentro, a diferencia de los otros ~9 modales; el refutador disidente concedió el mecanismo pero señaló que el chooser YA tiene otros dos canales de cierre (✕ y clic afuera), así que el arreglo se aplicó igual porque es gratis y cierra una inconsistencia real de UX | `_vglChooserModal` | **v18.0.91** | 227 |
| `friendly()` solo reconocía el encabezado EXACTO o TODO EN MAYÚSCULAS: una variante Título/mixta de "Último VIH"/"Última SOMF" (capitalización mixta específica en el diccionario) se mostraba sin traducir; el refutador disidente concedió el defecto pero lo llamó cosmético (`isExcludedActivity()` es inmune, el chip de VIH nunca deja de mostrarse), y el arreglo se aplicó igual porque es gratis y no depende de que el Excel escriba el header en una de dos formas exactas | `friendly` | **v18.0.92** | 228 |
| `_acompMostrar` recalculaba la posición del botón objetivo en cada vuelta pero la descartaba sin usarla cuando la burbuja ya mostraba el mismo hint — se quedaba pegada a las coordenadas del primer tick para siempre; el refutador disidente tenía razón en que un simple SCROLL no puede disparar esto (los 4 objetivos posibles son `position:fixed`), pero el botón de colapsar del dock (`display:none` sobre `.vgl-dock-btns`) SÍ puede correr la posición de un botón dentro del contenedor fijo sin mover el contenedor — el arreglo se aplicó igual, es gratis | `_acompMostrar` | **v18.0.93** | 229 |
| `highlight()` no usaba la misma normalización de acentos que `matchesSearch()`/`fuzzyMatch()`: un paciente que SÍ aparece en la lista filtrada por una búsqueda sin tilde ("jose" → "José") quedaba con su nombre sin resaltar; el refutador disidente concedió el defecto pero lo llamó puramente cosmético (`<mark>` no se lee en ningún otro lugar del script, el texto mostrado sigue siendo correcto), y el arreglo se aplicó igual porque es gratis y usa la misma normalización que el proyecto ya decidió para `fuzzyMatch` | `highlight` | **v18.0.94** | 230 |
| El potenciador "diabetes sin otros factores de riesgo mayores" (v17.6.94) era código muerto: el piso incondicional por diabetes de `mtrClasificarRiesgoCv` (v18.0.5) intercepta a TODO diabético antes de que la función llegue a invocar `mtrContarPotenciadores` — 2 de 3 refutadores no lo tumbaron. Sin daño clínico hoy (el piso es igual o más conservador); se retiró la rama muerta en vez de resucitarla, porque resucitarla habría revertido la corrección más reciente del médico (v18.0.5) sobre el mismo hueco | `mtrContarPotenciadores` | **v18.0.95** | 231 |

**Los 47 de 47 hallazgos confirmados del enjambre quedan aplicados.** El detalle de cada uno,
con su reproducción y su arreglo aplicado, sigue abajo (queda como registro histórico).

## Índice por gravedad

- **alta**: 25
- **media**: 17
- **baja**: 5

---

## 1. `mtrWidgetConductaTick / mtrWidgetFarmacoTick` — ALTA · bug

**Los widgets flotantes #vgl-cw-examenes y #vgl-cw-farmaco quedan huérfanos sobre 'Citas del día' — mismo bug que v18.0.7 arregló para su hermano #vgl-cw-ordenar-btn, pero no para estos dos**

- **Línea:** `6153`
- **Cruce estado × acción:** pestaña Conducta con pendientes reales (n>0) -> médico navega a 'Citas del día' (secc !== 'historia') -> nadie vuelve a llamar mtrWidgetConductaTick/mtrWidgetFarmacoTick para que se auto-oculten
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El código de línea 29102 muestra que las tres funciones (mtrWidgetConductaTick, mtrWidgetOrdenarConductaTick, mtrWidgetFarmacoTick) SOLO se llaman dentro de `if (secc === 'historia')`. El v18.0.7 (comentario en línea 6047-6049, reporte en vivo del médico con captura de pantalla) ya descubrió que esto deja el botón huérfano flotando sobre 'Citas del día' y agregó mtrOcultarBotonOrdenarPendientes(), llamada incondicionalmente en el tick general (línea 29063) cuando secc!=='historia'. Pero esa llamada de rescate solo toca #vgl-cw-ordenar-btn — nadie hace lo mismo por #vgl-cw-examenes ni #vgl-cw-farmaco, que usan exactamente la misma arquitectura (position:absolute, coordenadas de página, auto-ocultarse solo dentro de su propio tick). El resultado en consulta real: el médico revisa Conducta de un paciente con exámenes vencidos o alertas farmacológicas (badge visible), pasa a la agenda del día siguiente cita, y las burbujas 🧪/💊 con el juicio clínico DEL PACIENTE ANTERIOR se quedan flotando sobre la lista de citas — confuso y, si el médico las confunde con algo relativo a la cita que tiene delante, un riesgo de atribuir un dato clínico al paciente equivocado.

<details><summary>Evidencia de la reproducción</summary>

```
Paso 1 (en Conducta, con pendientes): #vgl-cw-examenes creado? true display: ""
Paso 1 (en Conducta, con pendientes): #vgl-cw-farmaco creado? true display: ""

Paso 2 (medico ya en 'Citas del dia'; solo corrio mtrOcultarBotonOrdenarPendientes()):
  #vgl-cw-ordenar-btn (SI tiene apagador dedicado) display: null (no existia en este escenario, no se creo)
  #vgl-cw-examenes    display: ""   <-- sigue SIN 'none': queda flotando sobre Citas del dia
  #vgl-cw-farmaco     display: ""   <-- sigue SIN 'none': queda flotando sobre Citas del dia

CONCLUSION:
mtrOcultarBotonOrdenarPendientes() SOLO oculta #vgl-cw-ordenar-btn.
#vgl-cw-examenes y #vgl-cw-farmaco NO tienen equivalente: quedan huerfanos, con las
coordenadas de pagina del paciente anterior, flotando sobre la pantalla nueva.
```

</details>

**Arreglo propuesto.** Replicar en la línea 29063 (o en una función mtrOcultarWidgetsConducta() que agrupe los tres) el mismo patrón: `if (secc !== "historia") { mtrOcultarBotonOrdenarPendientes(); ocultarWidgetExamenes(); ocultarWidgetFarmaco(); }`, ocultando también #vgl-cw-examenes y #vgl-cw-farmaco cuando se sale de la historia.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Verifiqué el mecanismo técnico con el arnés real (tests/harness.js -> cargar().api), llamando a la función `tick()` DE PRODUCCIÓN tal cual corre en vivo (no una simulación aparte de los widgets). Reproducción: cableé una historia clínica en pestaña Conducta con un resumen con pendientes reales (examen PTH vencido + duplicado ARA-II), corrí `tick()` -> #vgl-cw-examenes y #vgl-cw-farmaco se crean con display:"". Luego simulé la navegación real de la SPA (desaparece #anamesis, aparecen .labelHora+.status-label -> seccionActiva() pasa de "historia" a "agenda") y volví a correr el `tick()` REAL. Resultado empírico:
  #vgl-cw-examenes: display="" (sigue visible), left=-20px top=102px (coordenadas obsoletas del paciente anterior)
  #vgl-cw-farmaco : display="" (sigue visible), left=238px top=60px (coordenadas obsoletas)
Esto confirma el mecanismo exacto que describe el hallazgo: `mtrWidgetConductaTick`/`mtrWidgetFarmacoTick` solo corren dentro de `if (secc==="historia")` (línea 29219), `mtrOcultarBotonOrdenarPendientes()` (línea 29180, la única llamada incondicional del tick general) solo toca #vgl-cw-ordenar-btn, y no existe ningún MutationObserver, watcher de URL ni clase CSS (vgl-modo-oculto es un toggle manual del médico, no automático) que limpie estos dos widgets al salir de "historia". El bug de código es real y reproducible con un clic real (Conducta con pendientes -> Citas de
… (recortado)

</details>

---

## 2. `findDocIdx (línea 9509)` — ALTA · bug

**findDocIdx no quita tildes: un encabezado escrito 'CÉDULA' (la ortografía correcta en español) apaga el módulo de Actividades Preventivas el día entero**

- **Línea:** `9509`
- **Cruce estado × acción:** dato: encabezado de columna de identificación escrito con tilde ('CÉDULA', 'Cédula') x acción: cualquier carga del PyM — tanto la captura automática de SharePoint (scoreSheet/_readPymWorkbookStreamCore) como la selección manual de un .csv (línea 11778) — x repetición: debeBuscarPymDiario() vuelve a intentarlo cada 10 minutos con el mismo archivo y el mismo resultado.
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** DOC_EXACT (línea 8614) solo contiene formas SIN tilde ("CEDULA", "IDENTIFICACION"...), y el resto del propio código usa stripAccents() sistemáticamente para comparar texto en español (p.ej. línea 13613) — pero findDocIdx compara con .indexOf/.includes crudos, sin stripAccents. Si el archivo de la sede alguna vez nombra la columna 'Cédula' (con tilde — la única grafía correcta del español, y la que se usa en toda la prosa de comentarios del propio archivo) sin que también contenga las cadenas 'DOCUMENTO' o 'IDENT', findDocIdx devuelve -1. makeIndexer entonces lanza 'No se encontró la columna con la identificación del paciente' y todo el módulo de Actividades Preventivas queda sin lista real el día completo — un mensaje que no dice que la causa es una tilde, así que el médico o el TI del consultorio no tiene forma de adivinarlo sin leer el código.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_final.js
========== HALLAZGO B: findDocIdx no quita tildes ==========
findDocIdx(["NOMBRE","CEDULA","ESTADO"])   -> 1 (sin tilde: SI encuentra)
findDocIdx(["NOMBRE","CÉDULA","ESTADO"])   -> -1 (con tilde real: -1, NO encuentra)
findDocIdx(["NOMBRE","IDENTIFICACIÓN","X"]) -> 1 (con tilde, pero contiene IDENT sin tilde: SI encuentra)
makeIndexer con encabezado CÉDULA lanza: No se encontró la columna con la identificación del paciente. Verifique el formato de la lista cargada.
```

</details>

**Arreglo propuesto.** Normalizar ambos lados de la comparación con stripAccents() (ya definida en el propio archivo, línea 9117) antes de comparar contra DOC_EXACT y antes del .includes('CEDULA'/'IDENT'/'DOCUMENTO') — el mismo patrón que el código ya usa en decenas de otros sitios para texto clínico en español.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

El bug puntual es real y lo reproduje con el arnés (`tests/harness.js` -> `cargar({silencioso:true}).api`): `findDocIdx(["NOMBRE","CÉDULA","ESTADO"])` da -1 y `makeIndexer` lanza exactamente el mensaje citado. Confirmado: `findDocIdx` (línea 9509-9513) compara con `.indexOf`/`.includes` crudos sin `stripAccents`, mientras `DOC_EXACT` (línea 8614) solo tiene formas sin tilde.

Pero el HALLAZGO vende un daño ("apaga el módulo de Actividades Preventivas el día entero", "queda sin lista real el día completo") que el propio código ya neutraliza por diseño, y el hallazgo no lo menciona ni lo descarta:

1. Camino automático (SharePoint, el que corre "todo el día" cada 10 min): `CONFIG.SP.respaldo` está configurado con un ID real de producción (línea 8542-8552, "BASE PILOTO DE CONSULTA BELLO MAYO.xlsx") y `S.baseAuto` es `true` por DEFECTO (línea 8004). Cuando `loadPymDiario` falla por la excepción de `makeIndexer` (docIdx=-1), `state.pymFile` nunca se pone, así que en el mismo ciclo de 10 min (línea 30521-30529) se reintenta explícitamente la base piloto: `if (!state.pymFile) loadPymBase(true);`. Ese camino fue reforzado a propósito tras un "hallazgo de la auditoría adversarial" (comentario v7.8.1, línea ~30524) precisamente para que nunca quede "NADA cargado" un día entero. Si la piloto carga (lo normal: es un archivo estático ya validado, no el mismo que hoy falla), el médico recibe
… (recortado)

</details>

---

## 3. `maybeNotify / _legendMarcaUnaVez` — ALTA · bug

**El candado "una leyenda por día" comparte MORADO y VERDE: la confirmación a tiempo se calla si sonó el aviso de última llamada**

- **Línea:** `13805`
- **Cruce estado × acción:** MISMA cita, EN VIVO, primero transición a MORADO ("queda ~1 min de gracia") y segundos/minutos después, ANTES de medianoche, la transición real a VERDE ("confirmó a tiempo", a.arrival=true) del MISMO paciente.
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El propio v12.4.0 documenta el contrato: VERDE debe sonar en TODA transición en vivo hacia "En Sala" ("el médico decidió esto el 2026-08-11"). El candado _legendMarcaUnaVez (v-pedido dedup por paciente) se comparte entre MORADO, VERDE y el aviso de cierre "aunque cambie el color/estado": el PRIMERO de los tres que ocurra en el día gasta el único cupo. Como MORADO (última llamada, ~1 min de gracia) y VERDE (confirmó a tiempo) son etapas SECUENCIALES de la MISMA espera —cualquier paciente que confirme en el último minuto dispara MORADO y luego VERDE, en ese orden, dentro de segundos— este es el caso MÁS COMÚN, no uno raro. El médico recibe la alarma de "está por vencerse" pero nunca la buena noticia de que sí llegó: puede creer que el paciente sigue sin confirmar cuando ya está en sala, perdiendo tiempo en revisarlo a mano o llamándolo innecesariamente. El conteo/auditoría (CSV) queda intacto — solo se pierde el aviso que el médico ve/oye en el momento.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_legenda2.js
Antes de nada, localStorage tiene la marca de MORADO? false
Antes de nada, localStorage tiene la marca de VERDE? false

Tras MORADO:
  ¿se disparó el canal audible/visible del MORADO? (marca en localStorage): true

Tras VERDE (confirmó a tiempo, segundos después del MORADO):
  ¿se disparó el canal audible/visible del VERDE? (marca en localStorage): false

--- Lo que SÍ quedó registrado, para contraste ---
state.contadas tiene 'ultima@cita1' (el MORADO se contó): true
state.contadas tiene 'atiempo@cita1' (el VERDE se contó igual): true

=== CONCLUSIÓN ===
CONFIRMADO: el MORADO sonó/apareció, pero el VERDE (confirmación a
tiempo de la MISMA cita, la buena noticia tras la última llamada) NO
disparó ningún canal audible/visible -- aunque bumpStatCita/logEvent sí
lo contaron. El médico no se entera de que el paciente sí llegó a tiempo.

(Marca observada vía crossTabDup: 'vgl_n_full|cita1|MORADO' quedó en
localStorage tras el MORADO; 'vgl_n_full|cita1|VERDE' NUNCA se escribió
tras el VERDE — prueba directa de que _dispararAvisoAudible/_dispararAvisoReal
jamás se llamaron para el VERDE.)
```

</details>

**Arreglo propuesto.** Sacar VERDE del candado compartido (o usar una clave de leyenda por TIPO, p. ej. "legend|verde|doc" vs "legend|morado|doc", en vez de una sola "legend|doc"), ya que MORADO→VERDE es una secuencia de UN mismo evento donde la segunda notificación es la resolución de la primera, no una repetición de la misma información.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO por "conducta declarada DELIBERADA en el propio código", uno de los criterios explícitos de refutación.

El comportamiento que describe el hallazgo (MORADO y VERDE, y también el aviso de cierre de consulta, comparten UN solo candado "una leyenda por paciente por día", así que el primero que ocurra gasta el cupo del día) es exactamente como el código está diseñado a propósito, y lo dice por escrito en tres sitios distintos de vigilante_agenda.user.js:

1. Líneas 13728-13734 (comentario justo encima de `_legendMarcaUnaVez`): "Candado maestro 'una leyenda por paciente por día' (v-pedido deduplicación por paciente). Las leyendas RUTINARIAS (VERDE llegada, MORADO preaviso, y el cierre de consulta) se emiten UNA vez por paciente por jornada, aunque cambie el color/estado o se repinte. ROJO (fraude) y AMBAR (inasistencia) NO pasan por aquí: son hechos terminales con su propia guarda (bumpStatCita) y deben sonar siempre."

2. Líneas 13802-13805 (justo en el sitio del hallazgo): "Candado 'una leyenda por paciente por día': las leyendas rutinarias (VERDE/MORADO) solo suenan una vez por paciente en la jornada. El conteo y la auditoría de arriba ya quedaron registrados; aquí solo se frena el cartel/sonido repetido." seguido de `if ((a.color === "VERDE" || a.color === "MORADO") && !_legendMarcaUnaVez(a.doc_id)) return;`

3. Líneas 12337-12339, sobre el aviso de cierre de consulta: 
… (recortado)

</details>

---

## 4. `_pageFetchJsonCore` — ALTA · bug

**La petición fetch() del núcleo universal de red no tiene ningún timeout: una conexión colgada bloquea para siempre cualquier acción real del médico (Agendar, Guardar orden, Buscar paciente)**

- **Línea:** `18348`
- **Cruce estado × acción:** red: la conexión NO responde ni con error ni con éxito (se queda colgada, no un 4xx/5xx rápido) x acción: el médico hace clic en un botón real (Agendar cita, Guardar orden, Asignar turno — cualquier llamador de pageFetchJson/_pageFetchJsonCore, no solo el sondeo especulativo por hover)
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Si la red hacia Everest se queda 'colgada' (sin cerrar la conexión, sin devolver error — un escenario real de VPN inestable o proxy corporativo, distinto de un 500 rápido) durante un clic real como 'Confirmar cita' o 'Guardar orden', el botón se queda esperando para siempre: no hay timeout que lo libere. Y como pageFetchJson deduplica por GHOST (misma URL+cuerpo = misma promesa), un segundo clic del médico sobre el MISMO botón no crea una petición nueva: devuelve la MISMA promesa colgada. La única salida es recargar la página entera, perdiendo el modal abierto y cualquier dato ya tecleado.

<details><summary>Evidencia de la reproducción</summary>

```
Script /tmp/.../scratchpad/test_timeout.js — se monta el arnés con un `fetch` que jamás resuelve ni rechaza (`() => new Promise(() => {})`), y se llama a apiAccesoBuscarPaciente(doc, {especulativo:true}) (que internamente pasa por pageFetchJson -> _pageFetchJsonCore). Salida literal:

=== Caso 1: apiAccesoBuscarPaciente EN MODO ESPECULATIVO (hover) contra un fetch que jamás resuelve ===
¿pageFetchJson (vía especulativa) resolvió en <3000ms? false -- tiempo: 3003 ms
fetch() fue llamado 1 veces

La promesa sigue viva indefinidamente: no hay ningún AbortController/timeout en _pageFetchJsonCore que la corte. Confirmado también por lectura de código: `grep -n 'AbortController' vigilante_agenda.user.js` solo devuelve DOS líneas en todo el archivo de ~42.000, ambas dentro de apiLeerAgenda (líneas 14108 y 14111) — la única función de las ~30 que hacen red en el script que se protegió con un corte por tiempo. El propio comentario junto a ese AbortController (línea ~14075) dice textualmente: «sin esto una consulta colgada dejaba peticiones amontonándose una encima de otra y ahogaba la pestaña» — el equipo ya conoce y ya arregló exactamente este problema, pero solo para apiLeerAgenda. _pageFetchJsonCore (línea 18348) y su wrapper pageFetchJson (línea 18493) —el núcleo que usan BuscarPaciente, AsignarTurno, GuardarOrdenamiento, GetUsuarioPerfil, BuscarCitasDisponibles y prácticamente toda la interfaz con Everest, docenas de llamadores— no llevan ninguna protección equivalente.
```

</details>

**Arreglo propuesto.** Aplicar en _pageFetchJsonCore el mismo patrón que ya usa apiLeerAgenda: un AbortController con un setTimeout razonable (p. ej. 12-15 s) que aborte el fetch y pase a la vía de reintento/fallback, en vez de dejar la promesa de fetch() sin ningún límite de tiempo.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Confirmé leyendo el código que _pageFetchJsonCore (línea 18348) no tiene AbortController/timeout y que para escrituras (esEscritura=true → maxRetries=0) un fetch() colgado deja el await sin resolver para siempre — eso es real, y rastreé el clic real: confirmBtn.disabled=true + await apiAccesoAsignarTurno/apiOrdenamientoGuardar sin ningún timeout que lo envuelva (líneas 25225-25278 para agendar, 26488-26532 para guardar orden), así que ese botón concreto se queda colgado. PERO el daño que el hallazgo vende — "la única salida es recargar la página entera, perdiendo el modal abierto y cualquier dato tecleado" — es falso: verifiqué que en AMBOS modales (agendar cita línea 23608-23622, guardar orden línea 26445-26453) el botón ✕/Cancelar es un elemento DISTINTO de confirmBtn, nunca se deshabilita, y está cableado a closeMod, una función completamente síncrona (cerrado=true; modal.remove()) que no depende de la promesa colgada. El médico recupera el control con el mismo clic que ya usa para cancelar cualquier modal, sin recargar nada — solo pierde lo de ese modal puntual, no "la página entera". Además la evidencia aportada solo prueba la vía especulativa (hover), que el propio código dice explícitamente que no tiene consecuencia para el médico (catch vacío), y nunca se probó end-to-end el handler real de Confirmar/Guardar Orden. El bug técnico de fondo es real y vale la pena arreglar
… (recortado)

</details>

---

## 5. `_pageFetchJsonCore / _apiMarcarResultado` — ALTA · bug

**Un 401 (sesión de Everest caducada) se trata exactamente igual que una respuesta negativa legítima: nunca cuenta como fallo, nunca abre el cortacircuitos y nunca pone en alerta el panel de salud «Servicios de Everest»**

- **Línea:** `18378`
- **Cruce estado × acción:** red: 401/403 sostenido (token vencido) x acción: llamadas REALES repetidas del médico (no solo especulativas) x dato: cualquier cédula/paciente — todas devuelven null indistinguible de «no existe»
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Si el token de sesión de Everest vence a media jornada (escenario real de cualquier sistema con expiración de sesión), CADA llamada real del médico a través de pageFetchJson —buscar paciente, consultar cupos, guardar una orden— devuelve silenciosamente null, y cada llamador lo interpreta como una respuesta legítima vacía ('no se encontró el paciente', 'no hay cupos ese día', 'no se pudo guardar'). El médico no tiene ninguna señal de que la causa real es que su sesión murió: el panel «Servicios de Everest» sigue en verde porque _apiMarcarResultado(false) —el único camino que lo pondría en alerta— nunca se invoca para un 4xx. Puede pasar minutos u horas creyendo que está viendo hechos reales del sistema (paciente inexistente, agenda sin cupos) cuando en realidad ninguna petición real está llegando a ningún lado.

<details><summary>Evidencia de la reproducción</summary>

```
Script /tmp/.../scratchpad/test_401.js — arnés con fetch que SIEMPRE responde {ok:false, status:401}. Salida literal:

Estado del cortacircuitos ANTES: {"fallos":0,"hasta":0}
Resultados de las 5 búsquedas (todas null, indistinguible de 'paciente no existe'): [null,null,null,null,null]
fetch() fue llamado 10 veces (2 rutas x 5 intentos = 10 esperado si cada llamada agota su cascada)
Estado del cortacircuitos DESPUÉS de 5 fallos 401 reales seguidos: {"fallos":0,"hasta":0}
¿Se abrió el cortacircuitos (fallos>=3, hasta>0)? false

Contraste con 500 (caída real, misma función, MISMO número de llamadas de un solo apiAccesoBuscarPaciente):
fetch() llamado 8 veces; cortacircuitos: {"fallos":2,"hasta":0}

Es decir: 5 llamadas REALES (no especulativas) que fallan por 401 dejan el cortacircuitos en fallos:0 — CERO señal — mientras que una sola llamada bajo 500 real ya deja fallos:2. La causa, línea 18378: `else { return null; } // Error 4xx, no reintentar` — esta rama NUNCA llama a _apiMarcarResultado (que es quien marca _saludMarca('everest', false), el dato que alimenta el semáforo «Servicios de Everest» del panel de salud, verificado con las pruebas existentes de suite_05_api_everest.js líneas 493-518, que solo ejercitan esta ruta con status:500 — nunca con 401/403). Verifiqué además que no existe NINGUNA detección de sesión-de-Everest-caducada en otra parte del script (`grep -n 'status === 401'` no da resultados; la única lógica de re-login/token vencido que existe es para el portal ATHENEA, un dominio y subsistema totalmente distinto — medicosviva1a.atheneasoluciones.com, líneas 2422-2452 — no para neps.everestintelligent.com/apiviva).
```

</details>

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO por comentario de código que declara la conducta como DELIBERADA, exactamente en la función señalada.

Leí `vigilante_agenda.user.js` líneas 18348-18436 (`_pageFetchJsonCore`) y confirmé el hecho técnico crudo del hallazgo: en la rama `else { return null; }` (línea 18378) un 4xx —incluido un 401— nunca fija `isError=true`, nunca llega al `_apiMarcarResultado(false)` final (línea 18434), y como `_saludMarca("everest", ...)` SOLO se invoca dentro de `_apiMarcarResultado` (líneas 18331/18335 — únicos dos sitios en todo el archivo que tocan el módulo "everest" del panel de salud), un 401 sostenido efectivamente deja el semáforo «Servicios de Everest» en verde y el cortacircuitos en `fallos:0`. También confirmé que no existe ningún `status === 401` en el archivo y que la única lógica de sesión-caducada (líneas 2445-2452, 1897, 2489, 2533, 6931) es exclusiva del portal Athenea, no de Everest/apiviva — tal como afirma el reporte.

Pero justo encima de la línea `_apiMarcarResultado(false); return null;` que cierra la función (líneas 18427-18435) hay un comentario explícito, del mismo autor y de la misma versión (v17.15.0) que introdujo este cortacircuito, que dice textualmente: «Un 4xx NO llega aquí (se devuelve arriba sin reintentar): eso es una respuesta del servidor, no una caída, y contarlo como fallo abriría el cortacircuitos sin motivo.» Esto es una declaración deliberad
… (recortado)

</details>

---

## 6. `downloadDiagnostic (san/KEEP)` — ALTA · bug

**El informe de diagnóstico "SANITIZADO" filtra la cédula del paciente sin redactar cuando viaja en un atributo routerlink/name del DOM de la tarjeta**

- **Línea:** `29520`
- **Cruce estado × acción:** Tarjeta de agenda con un elemento que trae routerlink="/Paciente/<cedula>" (patrón estándar de Angular, [routerLink]="['/paciente', doc.cedula]") x médico pulsa "Descargar diagnóstico" para mandarlo a soporte
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El botón de diagnóstico existe para que el médico lo descargue y lo comparta con quien administra el asistente cuando algo falla, y el archivo se llama literalmente 'diagnostico_vigilante_SANITIZADO.txt'. La función san() sí tacha con '···' todo el TEXTO visible de la tarjeta (hora, nombre, estado) y ya existen pruebas dedicadas de 'cero PHI' para eso — pero KEEP = {class, role, routerlink, type, name} conserva esos CINCO atributos con su VALOR ORIGINAL intacto (solo a los data-* se les vacía el valor). Si la tarjeta real de Everest trae un enlace de navegación con la cédula en la ruta (justo lo que el propio _urlDiagnostico(), a dos funciones de distancia, ya sabe que hay que redactar en location.href), esa cédula viaja cruda en un archivo que el médico cree sanitizado y que puede salir de la clínica. Ninguna prueba existente ejercita este camino: grep -rln "cloneNode" tests/*.js no devuelve nada — san() nunca se probó de verdad, solo la rama '(no se encontró .labelHora)'.

<details><summary>Evidencia de la reproducción</summary>

```
Script: /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/t9_diag_phi.js (con mini-DOM real en t8_dom.js: nodeType, atributos, cloneNode, closest, querySelector, outerHTML -- el arnés base no trae cloneNode, por eso ninguna prueba existente llega a san()). Tarjeta construida: <div class="card"><span class="labelHora">07:00 AM</span><span class="status-label">Sin presentarse</span><a class="patient-link" routerlink="/Paciente/1122334455" name="pacienteFicticioUno" href="...">Ver historia</a><span class="text-uppercase fw-bold">PACIENTE FICTICIO UNO</span></div> (cédula 1122334455 SINTÉTICA). Salida LITERAL de node t9_diag_phi.js:

--- PRIMERA TARJETA (HTML sanitizado) ---
<div class="card"><span class="labelHora">···</span><span class="status-label">···</span><a class="patient-link" routerlink="/Paciente/1122334455" name="pacienteFicticioUno">···</a><span class="text-uppercase fw-bold">···</span></div>

===== VERIFICACION =====
El informe contiene la CEDULA SINTETICA cruda '1122334455': true
El informe contiene el atributo routerlink crudo con la ruta al paciente: true
El informe SI logra tachar el texto visible del enlace ("Ver historia" -> "···"): true
El nombre del paciente (texto) SI queda tachado: true
```

</details>

**Arreglo propuesto.** En san() (línea ~29525), tratar 'routerlink' y 'name' igual que ya se trata data-* dos líneas más abajo: conservar el NOMBRE del atributo pero vaciar su VALOR (x.setAttribute(a.name, "")) en vez de copiarlo tal cual. Alternativa más simple: sacar 'routerlink' y 'name' del KEEP de la línea 29520 — 'class'/'role'/'type' ya bastan para diagnosticar estructura/selectores sin arrastrar valores dinámicos que puedan llevar el identificador del paciente.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El código en sí es exactamente como lo describe el hallazgo (línea 29520: `KEEP = {class, role, routerlink, type, name}` conserva el VALOR de esos 5 atributos tal cual, solo a `data-*` se le vacía el valor) — eso lo confirmé leyendo el archivo. Pero el "camino completo desde un clic real hasta el daño" depende por completo de una premisa que el hallazgo NUNCA verificó contra el sistema real: que la tarjeta de agenda de Everest trae un elemento con `routerlink="/Paciente/<cedula>"` (o `name=`) en su DOM. Esa premisa es inventada, no observada.

Prueba directa: reconstruí la MISMA llamada a `downloadDiagnostic()`/`san()` pero usando, en vez de la tarjeta sintética del hallazgo, la tarjeta EXACTA del fixture congelado que el propio proyecto trata como el "contrato DOM con Everest" verificado empíricamente (`tests/fixtures/dom_everest_agenda.html`, usado en 5 suites: 02, 04, 14, 17, 32) — puro `div`/`span` con clases, cédula y nombre solo como texto (`<div class="text-muted">1.098.765.432, CC</div>`), sin ningún `<a>`, sin `routerlink`, sin `name`. Resultado real de ejecutar el código de producción contra esa tarjeta:
- Cédula real del fixture ('1.098.765.432') en el informe: false
- Nombre real del fixture ('PEREZ JUAN CARLOS') en el informe: false
- Cualquier atributo routerlink/name/role/type con valor no vacío: false
Cero fuga. `san()` sí cumple su trabajo contra la f
… (recortado)

</details>

---

## 7. `_vglModoOcultoAplicar / _vglInstalarModoOculto` — ALTA · bug

**El kill-switch remoto (emergencyTeardown) se activa en TOTAL SILENCIO si el médico dejó 'modo oculto' encendido de una sesión anterior: el cartel rojo de Pausa de seguridad clínica queda oculto por nuestra propia CSS**

- **Línea:** `30291`
- **Cruce estado × acción:** kill-switch se activa EN VIVO (emergencyTeardown, no solo al arrancar) x 'modo oculto' ya estaba encendido (guardado de una sesión anterior, 'sobrevive recargas' según el propio comentario de v15.5.0)
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El médico usa 'modo oculto' (Ctrl+Shift+V) a diario para trabajar sin la interfaz del Vigilante 'sin apagar su trabajo de fondo' — es la promesa explícita de la función (comentario v15.5.0). Ese estado se guarda por equipo y sobrevive recargas. Si el consultorio dispara el kill-switch remoto MIENTRAS el médico tiene una pestaña abierta con modo oculto encendido (el caso que emergencyTeardown() existe para cubrir — un incidente que exige apagar YA el asistente), el aviso rojo '🛡️ Pausa de seguridad remota activa' se crea igual, pero la propia hoja de estilos del Vigilante lo esconde con !important. El médico sigue tecleando con la creencia de que el asistente sigue vigilando en segundo plano (vigencias, fraude, PyM) cuando en realidad emergencyTeardown() ya detuvo TODO el reloj y borró toda la interfaz — sin ninguna señal visible que lo delate.

<details><summary>Evidencia de la reproducción</summary>

```
Paso 1 (arnés, tests/harness.js) — confirma que emergencyTeardown/_mostrarAvisoPausaClinica NUNCA tocan la clase 'vgl-modo-oculto' del body:
$ grep -n "classList.*vgl-modo-oculto" vigilante_agenda.user.js
30273:      if (document.body && document.body.classList && document.body.classList.contains("vgl-modo-oculto")) return;
30292:    try { document.body.classList.toggle("vgl-modo-oculto", !!oculto); } catch (e) {}
(son las DOS únicas líneas del archivo que tocan esa clase — ninguna vive en emergencyTeardown, que solo hace root.remove()/dock.remove()/querySelectorAll("[id^='vgl-']").forEach(remove) y nunca limpia document.body.classList)

Paso 2 (Chromium real, CSS REAL extraído de buildOverlay() con el mismo método de tools/verificar_color_chromium.js) — salida LITERAL de node contra /opt/pw-browsers/chromium-1194:
CSS extraido: 248052 caracteres
display de #vgl-pausa-clinica SIN modo-oculto en <body>: block
display de #vgl-pausa-clinica CON body.vgl-modo-oculto: none
El banner de PAUSA CLINICA sigue siendo visible al medico? false
BUG CONFIRMADO EN CHROMIUM: 'modo oculto' (heredado de una sesion anterior) esconde con !important el aviso ROJO de Pausa de seguridad remota — el kill-switch se activa en silencio total, sin ninguna senal visible para el medico.

(el HTML de prueba usó el <style> REAL producido por buildOverlay() — línea 14923 del userscript: 'body.vgl-modo-oculto #vgl-pausa-clinica{display:none !important}' — y el mismo aviso.style.cssText literal de _mostrarAvisoPausaClinica, línea ~29810)
```

</details>

**Arreglo propuesto.** En emergencyTeardown() (o en _mostrarAvisoPausaClinica), quitar explícitamente document.body.classList.remove('vgl-modo-oculto') antes de crear el aviso — el kill-switch debe ganarle siempre a una preferencia de UI heredada, nunca al revés. Alternativa complementaria: sacar #vgl-pausa-clinica del selector agrupado 'body.vgl-modo-oculto #vgl-...{display:none!important}' para que ese aviso en particular sea inmune a modo oculto por diseño, igual que ya se hizo con .vgl-labsv-lead/.vgl-labsv-foot para el CSS de Everest.

---

## 8. `mtrSanearTextoLibreAI` — ALTA · bug

**La defensa por tokens del nombre del paciente ignora apellidos de menos de 3 letras y no tolera tildes: en texto en MAYÚSCULAS (el estilo real de Everest) el nombre real puede llegar intacto a Gemini**

- **Línea:** `37584`
- **Cruce estado × acción:** dato 'nombrePaciente' con un token <3 letras (apellido corto tipo 'Li'/'Vo'/'Wu') O con tilde que el texto libre no repite ('Muñoz' vs 'MUNOZ') x acción 'texto en MAYÚSCULAS SOSTENIDAS' — el único modo en que, según el propio comentario del código (v17.6.42, línea ~37559), esta defensa por tokens es la ÚNICA capaz de tachar el nombre (la defensa por forma que va antes, mayúscula+minúsculas, no puede actuar sobre texto todo en mayúsculas)
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Viola directamente la regla no negociable de CLAUDE.md 'Cero PHI': el apellido real del paciente (dato identificable) viaja tal cual, dentro del texto libre que el médico pegó o escribió, a la API externa de Gemini — exactamente la fuga que este mismo saneador (creado en v17.6.42, comentario íntegro dedicado a explicar por qué la defensa por forma NO basta en MAYÚSCULAS SOSTENIDAS) existe para cerrar. Pasa en dos situaciones plausibles en una IPS colombiana: apellidos cortos de origen no hispano (Li, Wu, Vo, Ng, Ho — dos letras) y el desajuste, muy común en sistemas que normalizan texto a ASCII, entre el nombre registrado con tilde y su aparición sin tilde en la nota. El médico no tiene forma de saberlo: el saneador no avisa, simplemente no censura.

<details><summary>Evidencia de la reproducción</summary>

```
=== nombrePaciente de 2 letras ("Li"), texto en MAYUSCULAS ===
entrada : PACIENTE REFIERE QUE SEGUN LO CONVERSADO CON LA FAMILIA LI EN CASA, TOMA BIEN LOS MEDICAMENTOS.
salida  : PACIENTE REFIERE QUE SEGUN LO CONVERSADO CON LA FAMILIA LI EN CASA, TOMA BIEN LOS MEDICAMENTOS.
Se filtro el apellido 'LI'? -> false

=== control: nombrePaciente de 3+ letras ("Vega"), mismo patron ===
salida  : PACIENTE REFIERE QUE SEGUN LO CONVERSADO CON LA FAMILIA [NOMBRE_CENSURADO] EN CASA, TOMA BIEN LOS MEDICAMENTOS.
Se filtro el apellido 'VEGA'? -> true

=== nombrePaciente="Muñoz" (con tilde), texto trae "MUNOZ" (sin tilde) ===
salida: PACIENTE MUNOZ REFIERE ADHERENCIA COMPLETA AL TRATAMIENTO ACTUAL.
Se filtro 'MUNOZ'? -> false
(Reproducido con node /tmp/.../repro_nombre_corto.js y repro_nombre_acento.js contra el arnés real.)
```

</details>

**Arreglo propuesto.** En la construcción de `tokens` (línea 37584), bajar el filtro `t.length >= 3` a 1 (o quitarlo) — el riesgo de sobre-censurar una palabra corta clínica es mucho menor que dejar pasar un apellido real, y el proyecto ya acepta ese canje en la defensa por forma de más arriba. Y normalizar tildes (con el mismo patrón que `mtrNormalizarTexto`, NFKD + strip de diacríticos) tanto en `nombrePaciente` como en el texto contra el que se compara antes de construir `reTokens`, para que 'Muñoz' case con 'MUNOZ'.

---

## 9. `_evaluarComplejidadPaciente` — ALTA · clinico

**"PA Descontrolada" imprime una cifra sistólica de 0 (o negativa) como si fuera una lectura real, exactamente el defecto que el propio comentario de v17.8.1 dice haber corregido**

- **Línea:** `1749`
- **Cruce estado × acción:** paSistolica = 0 (o negativo, lectura fallida/no capturada) x paDiastolica >= 100 (lectura real presente) -> ambos son Number.isFinite, así que 'dosCifras' se activa y se imprimen las DOS cifras juntas
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El propio comentario que acompaña este código (v17.8.1, hallazgo #87) dice literalmente: '«NaN» es una palabra de programador y un 0 es un dato falso: los dos hacen dudar de la cifra que SÍ es real' -- y en efecto la rama de UNA sola cifra (Caso 2, pad=0) SÍ protege ese caso. Pero la guarda `dosCifras` (línea 1749) solo exige `Number.isFinite(pas) && Number.isFinite(pad) && pad > 0` -- nunca exige `pas > 0`. Con pas=0 (sistólica no leída/lectura fallida) y una diastólica real >=100, el badge sale 'PA Descontrolada (0/105)': un 0 -que el propio proyecto ya reconoció como dato falso- se imprime pegado a una cifra real, como si fueran las dos mitades de una misma lectura de tensión arterial. Con pas negativa (Caso 4, dato de parseo corrupto) sale peor todavía: '(-5/105)', una tensión arterial fisiológicamente imposible presentada como hecho en la insignia de triage clínico que el médico lee para decidir franja horaria y complejidad.

<details><summary>Evidencia de la reproducción</summary>

```
CASO 1 (pas=0, pad=105):
  badges: ["PA Descontrolada (0/105)"]
  motivoTexto: Paciente complejo (PA Descontrolada (0/105)) ➔ Sugerido: Primera mitad de la jornada
CASO 2 (pas=165, pad=0):
  badges: ["PA Descontrolada (sistólica 165)"]
CASO 3 (pas=NaN, pad=NaN):
  badges: ["Estable / Control Habitual"]
CASO 4 (pas=-5, pad=105):
  badges: ["PA Descontrolada (-5/105)"]
```

</details>

**Arreglo propuesto.** Simetrizar la guarda: `const dosCifras = Number.isFinite(pas) && pas > 0 && Number.isFinite(pad) && pad > 0;` -- igual que ya se exige `pas > 0` en la rama de una sola cifra (línea 1752), aplicarlo también a la rama de las dos cifras para que un 0 o negativo en cualquiera de las dos nunca se imprima como si fuera una lectura real.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

El mecanismo de código es real: verifiqué con tests/harness.js, reproduciendo el camino completo desde un DOM simulado fielmente (mismo helper docCon que usa suite_55_framingham_oficial.js para esta misma función) — sistólica vacía + diastólica real 105 -> mtrLeerTensionDelDom -> mtrResumenClinico -> _evaluarComplejidadPaciente produce literalmente "PA Descontrolada (0/105)", y confirmé que el mismo hueco (sin fallback a valor previo) existe en el camino real de Agendar (línea 23980-23992). Sin embargo el hallazgo vende esto como daño clínico de gravedad alta que afecta "la insignia de triage clínico que el médico lee para decidir franja horaria", y eso no ocurre: paDescontrolada (y por tanto franjaSugerida) ya es true por la diastólica real sola, así que el bug NUNCA cambia la sugerencia de agenda — solo el texto que la acompaña. Ese texto no alimenta ninguna nota clínica, redactor IA ni cálculo posterior (rastreé todos los consumidores de compEval: solo pintan un <b> en una píldora de UI). Un "0 mmHg" es, además, un artefacto obviamente imposible que cualquier médico reconoce igual que el NaN que el propio v17.8.1 ya trataba como "genera duda, no error clínico". Por último, el Caso 4 (pas=-5) que el hallazgo presenta como "peor todavía" no tiene ningún camino real: _labNumerico rechaza explícitamente cualquier texto con signo negativo en todos los lectores de PA de producción
… (recortado)

</details>

---

## 10. `_nuevoReemplazaCandidato (regla 2, vía _labNumerico) — usada por _ultimaFechaPorAnalito e injectLabsIntoCronicos` — ALTA · clinico

**Un RAC=0 de HOY (paciente sano, valor real) pierde contra un RAC=45 de hace meses: se escribe en la historia el valor VIEJO, no el reciente**

- **Línea:** `3097`
- **Cruce estado × acción:** dato = 0 (analito RAC, HOY) x dato = 45 (mismo analito, ENERO) x _ultimaFechaPorAnalito/_nuevoReemplazaCandidato, en cualquier orden de llegada del array de Athenea
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El botón Auto-Labs escribe en la casilla RAC de la Ruta Crónicos el valor 45 (albuminuria franca, de enero) en vez del 0 real y más reciente (agosto), sin ningún aviso: no aparece en 'sinCasilla' ni en 'implausibles', el botón dice '✓ casillas escritas' en verde como si todo estuviera correcto. El médico ve y firma un dato de albuminuria vencido y falso, creyendo que es el resultado más reciente del paciente — exactamente el error que _ultimaFechaPorAnalito fue construida para evitar (comentario v12.5.6: 'gana la repetición con la fecha más reciente de verdad'). La causa: _labNumerico() (línea 3844) devuelve null para el texto '0' a propósito ('nunca 0, que en una creatinina sería catastrófico'), pero esa exclusión es GLOBAL para los 13 analitos y la usa _nuevoReemplazaCandidato para decidir 'número usable le gana a fecha' (regla 2, línea 3097-3099) — así que un 0 real del RAC (donde 0 SÍ es clínicamente plausible, a diferencia de creatinina/hemoglobina/PTH) se trata como 'no es un número' y pierde el desempate por antigüedad frente a cualquier valor viejo que sí sea != 0. Ya existe una prueba (suite_08, línea ~1126) que confirma que un RAC=0 SÍ se registra como candidato, pero ninguna prueba cruza ese candidato-0 contra un candidato viejo distinto de cero en la comparación de reemplazo — el hueco exacto que pedía la tarea.

<details><summary>Evidencia de la reproducción</summary>

```
node repro1_labnumerico_cero.js:
=== _labNumerico('0') ===
null
=== _labNumerico('0.0') ===
null
=== _labNumerico('45') (control) ===
45
=== _nuevoReemplazaCandidato(previo=RAC 45 (ene), nuevo=RAC 0 (ago)) ===
¿el nuevo (0, mas reciente) reemplaza al previo (45, viejo)? false
=== _nuevoReemplazaCandidato(previo=RAC 0 (ago), nuevo=RAC 45 (ene, mas viejo)) ===
¿el nuevo (45, MAS VIEJO) reemplaza al previo (0, mas reciente)? true

node repro2_end_to_end.js (end-to-end con _ultimaFechaPorAnalito, la función real que injectLabsIntoCronicos usa para elegir qué escribir):
=== Con RAC viejo (45, enero) primero en el array, RAC nuevo (0, agosto) despues ===
Candidato elegido para escribir en la casilla RAC: {..."resultVal":"45"..."resultDate":"2026-01-15"...}
Se esperaria: resultVal='0', resultDate='2026-08-30' (el mas reciente). Obtenido: 45 2026-01-15

=== Orden invertido: RAC nuevo (0, agosto) primero, RAC viejo (45, enero) despues ===
Candidato elegido: {..."resultVal":"45"..."resultDate":"2026-01-15"...}
(el resultado es el mismo sin importar el orden de llegada del array: siempre gana el 45 viejo)
```

</details>

**Arreglo propuesto.** En _nuevoReemplazaCandidato, la regla 2 (línea 3097-3099) no debe usar _labNumerico tal cual para decidir 'es número usable': para el caso RAC (donde 0 es un resultado real posible), tratar un '0'/0 literal como número válido en el desempate de candidatos — p. ej. un chequeo local que solo excluya no-numérico real (texto, NaN) y no el valor exacto 0, dejando que _labNumerico siga rechazando 0 donde sí tiene sentido (creatinina, hemoglobina, plausibilidad oficial).

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Reproduje el hallazgo con el arnés real (tests/harness.js) contra HEAD, no una copia: `_labNumerico('0')` devuelve `null` (línea 3844, `n > 0` excluye el cero a propósito), y `_ultimaFechaPorAnalito` con dos filas RAC con forma real de Athenea —45 en enero y 0 en agosto— efectivamente elige el candidato del 45 de enero SIN IMPORTAR el orden de llegada del array, exactamente como describe el hallazgo. No encontré ninguna guarda más arriba que lo intercepte (la ruta de escritura en injectLabsIntoCronicos no filtra RAC=0 aparte, y _objecionOficialAlValor no marcaría 45 como implausible), ni ningún comentario que declare ESTA conducta (excluir 0 para RAC específicamente) como deliberada — el único comentario relevante (línea 3823-3824) justifica el `n>0` solo para el caso de creatinina, no menciona RAC. Tampoco está arreglado en HEAD.

Sin embargo, el hallazgo YA figura textualmente en docs/BLINDAJE_DEFECTOS.md (líneas 151-152, sección «Enjambre de funciones en curso (`wf_df8f59cb-aed`)»): «`_nuevoReemplazaCandidato`: un RAC = 0 de HOY (valor real de un paciente sano) pierde contra un RAC = 45 de hace meses, y se escribe el viejo.» — misma función, mismo escenario, mismos valores. Esa sección es explícitamente la cola de hallazgos del propio enjambre («24 cazadores... tres escépticos por hallazgo. Sin aplicar todavía: esperan la refutación»), es decir, el proyecto ya lo tiene regis
… (recortado)

</details>

---

## 11. `_vglCosechaGuardar (línea 4849, con _vglCosechaLeer/_vglClaveDeDoc del mismo bloque)` — ALTA · clinico

**_vglCosechaGuardar escribe bajo una clave nueva sin consultar _vglClaveDeDoc: la memoria del paciente que quedó archivada ANTES de v17.48.0 (cédula con ceros de relleno) se orfaniza en silencio en la primera cosecha de hoy**

- **Línea:** `4851`
- **Cruce estado × acción:** paciente REPETIDO (visita de control) cuyo registro en vgl_cosecha quedó guardado antes de la canonicalización v17.48.0 bajo una clave con ceros a la izquierda (p.ej. "0000111111"); hoy extractPacienteAbierto()->_vglDocCanon entrega la forma canónica ("111111") a _vglCosechaGuardar, que usa `previoTodo[id]` con `id` crudo en vez de `_vglClaveDeDoc(previoTodo, docId)` (patrón que v17.53.0 SÍ aplicó en _noShowRegistrar para otro almacén, vgl_nosh_hist)
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** La confirmación de embarazo (severidad alta, vigencia 30 días) y de adherencia, los `programas` de Ruta Crónicos (diabetes/HTA/ERC) y los `factores` de riesgo ya documentados para ese paciente desaparecen sin ningún aviso la primera vez que cualquier cosecha escribe algo nuevo hoy (basta con que el médico entre a Antecedentes o Hábitos). El almacén queda con DOS claves para el mismo paciente («111111» y «0000111111»); la nueva, vacía de contexto, siempre gana en las lecturas siguientes porque `_vglBuscarPorDoc` devuelve la coincidencia EXACTA antes de buscar la canónica — la tolerancia de lectura deja de proteger en cuanto existe el duplicado. La compuerta vuelve a preguntar lo ya respondido, y el clasificador de riesgo cardiovascular puede quedarse sin comorbilidades que el médico ya había dejado documentadas, sin que nada en pantalla lo delate.

<details><summary>Evidencia de la reproducción</summary>

```
--- ANTES ---
Lectura por _vglCosechaLeer(canonica): {"ts":1788060352438,"confirmaciones":{"embarazo":{"v":false,"ts":1788060352438}},"programas":{"diabetes":true,"hta":true}}
--- DESPUES de _vglCosechaGuardar(canonica, {factores:...}) ---
Claves en el almacen: [ '111111', '0000111111' ]
Registro bajo la clave VIEJA: {"ts":1788060352438,"confirmaciones":{"embarazo":{"v":false,"ts":1788060352438}},"programas":{"diabetes":true,"hta":true}}
Registro bajo la clave CANONICA: {"factores":{"tabaquismo":{"v":false,"ts":1788233152440}},"ts":1788233152440}
--- IMPACTO CLINICO ---
Confirmacion de embarazo (vigente 30 dias) vista HOY con docId canonico: null
(esperado: {v:false, ts:...} recuperada del archivo viejo; si sale null, la respuesta del medico se perdio)
Grupos de claves duplicadas detectados tras la escritura: [["111111","0000111111"]]
```

</details>

**Arreglo propuesto.** En _vglCosechaGuardar, resolver la clave de escritura con `const claveExistente = _vglClaveDeDoc(previoTodo, docId); const id = claveExistente || String(docId || "");` — igual que ya hace _noShowRegistrar (línea 28602) desde v17.53.0 — en vez de usar siempre el docId crudo como clave.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

El hallazgo describe correctamente el bug técnico (_vglCosechaGuardar usa previoTodo[id] con id crudo en vez de _vglClaveDeDoc(previoTodo, id), línea 4861 en HEAD v18.0.40), pero esto YA figura textualmente en docs/BLINDAJE_DEFECTOS.md línea 153 ("`_vglCosechaGuardar`: escribe bajo una clave nueva sin consultar `_vglClaveDeDoc`"), dentro de la sección "Enjambre de funciones en curso (wf_df8f59cb-aed)" — ya reproducido por otro enjambre y en cola esperando refutación adversarial. El documento está sincronizado con HEAD (v18.0.40 = v18.0.40 del script). Al ya figurar en el inventario de defectos, este criterio por sí solo refuta el hallazgo como aporte nuevo: no es un descubrimiento independiente, es un duplicado de un ítem ya trackeado y pendiente de su propio proceso.

</details>

---

## 12. `mtrTextoOpinaSobre (línea 5252)` — ALTA · clinico

**La lista de negaciones sin proximidad (línea 5271) niega CUALQUIER hecho que comparta frase con una negación de OTRO hecho: "Niega tabaquismo, es diabético e hipertenso" lee diabetes e HTA como negadas**

- **Línea:** `5271`
- **Cruce estado × acción:** texto libre con dos hechos en la MISMA frase, uno negado con una de las frases genéricas de v17.6.30 ("niega", "no fuma", "no tiene", "no es", "descarta"...) y el OTRO afirmado sin negación en esa misma frase — redacción clínica en español extremadamente común ("Niega tabaquismo, es diabético e hipertenso", "No fuma, pero es diabético")
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** mtrDiscrepanciasDeFuentes usa el resultado para diabetes e HTA (severidad ALTA, la misma que hoy BLOQUEA el Panel del paciente hasta que el médico responda — comentario de v18.0.17). Si la historia o la cabecera ya marcan diabetes/HTA como Sí, este texto perfectamente normal dispara un cuadro «Las fuentes no coinciden» FALSO, porque la comprobación de la línea 5271 es un substring sobre TODA la frase, sin mirar si el negador está cerca del término que se está evaluando — exactamente el defecto de proximidad que la propia v18.0.17 dice haber resuelto (líneas 5272-5296), pero solo para el patrón corto "no/sin/nunca/jamás", no para esta lista más vieja.

<details><summary>Evidencia de la reproducción</summary>

```
{"texto":"Niega tabaquismo, es diabético e hipertenso.","dDiab":false,"dHta":false}
{"texto":"No fuma, pero es diabético.","dDiab":false,"dHta":null}
{"texto":"El paciente no tiene alergias, es diabético.","dDiab":false,"dHta":null}
{"texto":"Descarta alergias medicamentosas, es diabético e hipertenso.","dDiab":false,"dHta":false}
{"texto":"Paciente diabético e hipertenso, niega tabaquismo.","dDiab":false,"dHta":false}
(dDiab/dHta esperado: true en los cinco casos — el texto SÍ afirma diabetes/HTA; el motor devuelve false, es decir 'lo niega expresamente')
```

</details>

**Arreglo propuesto.** Extender la comprobación de proximidad de la línea 5289-5296 (ya escrita para "no/sin/nunca/jamás") para que también cubra las frases multi-palabra de la lista de la línea 5271, en vez de aplicarlas como substring sobre la frase completa: buscar cada negador de la lista SOLO en la ventana de caracteres inmediatamente anterior al punto donde `re` coincidió (misma frontera de coma que ya usa el bloque de abajo), no en cualquier parte de la oración.

---

## 13. `_vglGuardarDeshacer / _vglEjecutarDeshacer` — ALTA · clinico

**El aviso «ya no se puede deshacer X» se suprime justo cuando el médico repite el MISMO botón: «Deshacer» revierte una casilla distinta a la que él cree, sin ninguna señal**

- **Línea:** `7535`
- **Cruce estado × acción:** mismo paciente, misma etiqueta ('Exámenes'/'Examen normal'/etc.), dos clics seguidos que SÍ escriben algo los dos (no el caso de 0 casillas que ya blinda L6643) — 'pulsar el botón dos veces sobre el mismo paciente', exactamente uno de los cruces pedidos
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El médico pulsa el mismo botón dos veces (p. ej. Athenea respondió distinto la segunda vez, o solo está reintentando). El primer lote se SUSTITUYE en silencio por el segundo — sin el aviso azul que el propio código (comentario v17.0.1) existe para dar, porque ese aviso solo se dispara `if (anterior !== etiqueta)`, y con el MISMO botón la etiqueta es idéntica. Si el médico pulsa «↩ Deshacer» pensando revertir la casilla mala del primer clic, en realidad revierte la del segundo: ve el toast VERDE «Deshecho: 1 casilla volvió exactamente a como estaba» y CREE que ya corrigió el dato erróneo, cuando ese dato sigue escrito en la historia sin ninguna forma de deshacerlo.

<details><summary>Evidencia de la reproducción</summary>

```
Tras CLIC 1: casillaA.value = "120" -> lote de deshacer guardado con 1 par (casillaA)
Tras CLIC 2 (misma etiqueta 'Exámenes'): casillaB.value = "80"

_vglEjecutarDeshacer() reporto haber revertido 1 casilla(s).
Estado FINAL -> casillaA.value = "120"  (se esperaria '' si 'Deshacer' revirtiera TODO Examenes)
Estado FINAL -> casillaB.value = ""  (esta si vuelve a vacio)

CONFIRMADO: casillaA (escrita en el CLIC 1) quedo con el valor auto-escrito '120' SIN NINGUNA forma de deshacerla, sin ningún toast de aviso (la condición `if (anterior !== etiqueta)` en _vglGuardarDeshacer lo impide cuando la etiqueta se repite). Reproducido con node /tmp/.../repro_deshacer_mismo_etiqueta.js contra el harness real (tests/harness.js) llamando directamente a `a._vglGuardarDeshacer` y `a._vglEjecutarDeshacer` exportadas del userscript.
```

</details>

**Arreglo propuesto.** Quitar la condición `if (anterior !== etiqueta)` y avisar SIEMPRE que se sustituye un lote vivo, sin importar si la etiqueta coincide — o, mejor aún, cuando docId y etiqueta coinciden y el lote sigue vivo, ACUMULAR los pares nuevos en el mismo lote (merge) en vez de reemplazarlo, para que «↩ Deshacer» revierta de verdad todo lo que el botón con ese nombre escribió en esta sesión de clics.

---

## 14. `parseCSV (línea 9272) + indexRowsAsync (línea 9264), consecuencia visible en pymMotivoSinActividades (línea 9741)` — ALTA · clinico

**Una coma entrecomillada en el .csv del PyM borra en silencio a un paciente, y el sistema le dice al médico con confianza que 'NO aparece en la lista'**

- **Línea:** `9272`
- **Cruce estado × acción:** acción 'Abrir PyM' con un archivo .csv real (ruta viva, línea 11778: FileReader -> parseCSV -> indexRowsAsync -> applyPymIdx) x dato: una coma DENTRO de un campo entrecomillado en una columna anterior o igual a DOCUMENTO (p.ej. 'Apellidos, Nombres', formato habitual en exportes administrativos) x primera carga del día.
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** parseCSV es un split ingenuo sin manejo de comillas (esto SÍ está documentado y probado a propósito en tests/suite_16_excel_stream.js:178, api.parseCSV('a,"b,c"') === [["a",'"b','c"']]). Lo que NO está probado ni documentado en ningún sitio es la consecuencia clínica: cuando esa coma cae antes o sobre la columna DOCUMENTO, la fila entera se desalinea, normalizeKey no encuentra dígitos en el fragmento que quedó en esa posición, y el paciente real desaparece de idx.todos/idx.map. applyPymIdx igual devuelve éxito ('Actividades preventivas cargadas: N paciente(s)') — no hay ningún aviso de fila descartada. Si luego el médico abre el modal de Órdenes para ese paciente, pymMotivoSinActividades (con datos reales, no inventados en el test) devuelve motivo 'no_esta_en_lista' con el texto 'Este paciente NO aparece en la lista de prevención de hoy'. Es exactamente el patrón que el propio proyecto llama 'Patrón G' (un fallo del sistema presentado como un hecho del paciente): un paciente con una prueba pendiente real (p.ej. tamización VIH) puede quedarse sin ella porque su apellido llevaba una coma.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_final.js
========== HALLAZGO A: parseCSV + coma entrecomillada ==========
filas tras parseCSV: [["NOMBRE","DOCUMENTO","TAMIZACION VIH"],["\"Perez"," Juan\"","111111","Susceptible"],["Gomez Maria","222222","Susceptible"]]
map final (doc_id -> actividades): [["222222",["Tamizacion vih"]]]
todos (universo de documentos vistos): ["222222"]
-> Juan (111111) NO esta en 'todos' ni en 'map': su fila desaparecio.
Mensaje mostrado para Juan (111111): {"motivo":"no_esta_en_lista","texto":"Este paciente NO aparece en la lista de prevención de hoy (puede ser nuevo, o su identificación no cruza con la del archivo). Por eso no puedo decir qué le corresponde. Si de verdad aplica algo, ordénelo desde el catálogo institucional de Ordenamientos en Everest."}

(Fila de entrada, cédula sintética 111111, sin PHI real; datos generados solo para esta prueba.)
```

</details>

**Arreglo propuesto.** No se trata de reescribir parseCSV como parser RFC-4180 completo (el equipo ya decidió a propósito no hacerlo). Basta con una guarda barata en indexRowsAsync/makeIndexer: si el número de celdas de una fila no coincide con el de encabezados, o el valor que cae en la columna DOCUMENTO no produce ningún dígito tras normalizeKey mientras las columnas vecinas sí parecen texto libre, descartar esa fila con una advertencia contada y visible ('N fila(s) del .csv no se pudieron leer, revíselas a mano') en vez de fusionarla en silencio como 'documento no encontrado'.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

El hallazgo queda REFUTADO por dos de los criterios de la consigna, ambos verificados en el repo:

1. **Ya figura en `docs/BLINDAJE_DEFECTOS.md`.** Línea 150, sección "Enjambre de funciones en curso (`wf_df8f59cb-aed`)": «`parseCSV`: una coma entrecomillada en el `.csv` del PyM borra en silencio a un paciente.» — es literalmente el mismo hallazgo (misma función, mismo mecanismo, misma consecuencia clínica), ya capturado por el proceso de enjambre y a la espera del mismo ciclo de escépticos en el que estoy participando ahora. No es un hallazgo nuevo: es un duplicado de algo ya registrado.

2. **Un comentario del código declara la conducta raíz como DELIBERADA.** `tests/suite_16_excel_stream.js` (línea ~172-178) tiene un bloque de test titulado explícitamente «`parseCSV` — separador ingenuo, a propósito» («a propósito» = a propósito/on purpose), con el comentario «Comportamiento documentado: el split es por coma cruda, sin manejo de comillas» y el propio caso `api.parseCSV('a,"b,c"') === [["a",'"b','c"']]` fijando ese comportamiento como contrato probado, no como bug accidental.

Verifiqué también en HEAD (`vigilante_agenda.user.js:9272` `parseCSV`, `9264` `indexRowsAsync`, `9182` `makeIndexer`, `9057` `normalizeKey`, `9741` `pymMotivoSinActividades`) que la cadena de causalidad que describe el hallazgo es real y reproducible tal como está escrita (una fila con coma dentro de com
… (recortado)

</details>

---

## 15. `loadPymBaseDescarga` — ALTA · clinico

**Carrera entre loadPymBaseDescarga y loadPymDiario: el PyM real de hoy, recién cargado, puede quedar sobrescrito por la base piloto vieja con un aviso falso**

- **Línea:** `11479`
- **Cruce estado × acción:** pestaña líder, con state.pymFallback=true (aún en base piloto), evaluando la refresca periódica de la piloto (pilotoFreshCheck -> loadPymBase -> loadPymBaseDescarga) EXACTAMENTE en el instante en que la corrutina de loadPymDiario (el chequeo cada 10 min del PyM real de hoy, en la misma pestaña) termina de encontrar y aplicar el archivo real de hoy vía applyPymIdx().
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** loadPymBaseDescarga() comprueba 'if (state.pymFile && !state.pymFallback) return true;' DOS veces (antes y justo después de leer el archivo con readPym), precisamente para no pisar un PyM real que haya llegado mientras tanto. Pero tras el SEGUNDO await —'await pilotoGuardar(idx, ...)', que empaqueta el índice con packPym y cede el hilo varias veces— YA NO se vuelve a comprobar: el código sigue directo a 'state.pymFallback = true; applyPymIdx(idx, ... + " (base piloto — aún no llega la de hoy)", ...)'. Si en esa ventana loadPymDiario() (que corre cada 10 min en la misma pestaña) terminó de cargar el PyM real, éste queda reemplazado por la base piloto desactualizada — que además puede tener MUCHOS pacientes con actividades de referencia obsoletas, no solo la tabla vacía de mi prueba. Encima state.pymDia se limpia (applyPymIdx se llama sin el 5º parámetro esDiarioRealDeHoy), así que debeBuscarPymDiario() vuelve a creer que la lista de hoy no se ha cargado. El médico ve el cartel ámbar 'Usando la base piloto (mientras llega la de hoy)' — una afirmación falsa, porque la de hoy ya había llegado — y puede consultar actividades de PyM desactualizadas para pacientes reales hasta el siguiente chequeo de 10 minutos.

<details><summary>Evidencia de la reproducción</summary>

```
node /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/test4_race_piloto.js

Estado ANTES de loadPymBaseDescarga: pymFile= "" pymFallback= false
[concurrencia] pilotoGuardar() esta escribiendo GM_setValue; en este instante loadPymDiario() (otra corrutina) TERMINA de cargar el PyM real de hoy...
[concurrencia] tras la carga real: state.pymFallback= false state.pym.size= 1 state.pymDia= 2026-09-01 (hoy=2026-09-01)
loadPymBaseDescarga() devolvio: true
---- ESTADO FINAL ----
state.pymFallback = true   (esperado: false, porque el PyM REAL de hoy ya habia llegado)
state.pym.size    = 0   (esperado: 1, el paciente REAL; si sale 0 es la base piloto vacia que la reemplazo)
state.pymFile     = "Base.csv (base piloto — aún no llega la de hoy)"
state.pymDia      = ""  (hoy=2026-09-01; vacio => debeBuscarPymDiario() volvera a decir que SI hay que buscar, aunque el real ya se habia cargado)
state.pymUltimoFallo = ""

BUG CONFIRMADO: loadPymBaseDescarga() SOBRESCRIBIO el PyM real de hoy (recien cargado por otra corrutina concurrente) con la base piloto vieja, y lo hizo diciendo al medico 'Usando la base piloto (mientras llega la de hoy)' -- un mensaje FALSO, porque la de hoy ya habia llegado.
```

</details>

**Arreglo propuesto.** Repetir la guarda 'if (state.pymFile && !state.pymFallback) return true;' también DESPUÉS de 'await pilotoGuardar(...)', justo antes de las líneas 'state.pymFallback = true; ... applyPymIdx(...)' — igual que ya se hace antes y después de 'await readPym(...)'.

---

## 16. `esNombreDeHoy / nameHasToken / pickTodaysFile` — ALTA · clinico

**La guarda contra 'el día 6 no debe matchear el 26' solo protege los tokens con mes en letras: un token de fecha NUMÉRICO empotrado dentro de un número más largo (factura, consecutivo) en CUALQUIER subcarpeta hace que ese archivo se tome como 'el PyM de hoy'**

- **Línea:** `11127`
- **Cruce estado × acción:** carpeta ajena (subcarpeta 'ESTRATEGIAS POR SEDE', no la raíz que exige la regla 2 ya blindada en v18.0.7) x nombre de archivo cuyo número de factura/consecutivo/reporte contiene por casualidad la fecha de hoy sin separadores (ej. día 1, mes 9: '...45192026...') x primer chequeo del día antes de que suba el PyM real.
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El bloque de comentarios v18.0.7 (líneas ~11138-11222) documenta en detalle un incidente real donde un libro ajeno sin fecha en el nombre se coló como 'el PyM de hoy' y dejó al médico sin el aviso de prevención toda la jornada; el arreglo fue exigir que la regla 2 (sin fecha en el nombre) solo mire archivos SUELTOS EN LA RAÍZ. Pero la regla 1 ('matchName', línea 11185) —la que sí exige fecha en el nombre— NO tiene esa restricción de carpeta: busca en TODOS los archivos de las 3 carpetas que junta fetchSpFilesMultiFolder, incluida 'ACTIVIDADES DE PYM/ESTRATEGIAS POR SEDE 2026/SEDE BELLO', y la reproducción muestra que un nombre con una fecha numérica de 6-8 dígitos empotrada (factura, consecutivo, ID de reporte) en esa subcarpeta ajena puede matchear igual. Si eso ocurre antes de que suba el PyM real, ese archivo se descarga y se intenta usar como lista de prevención del día — mejor caso: mtrLibroNoParecePym lo rechaza y sale un aviso confuso citando un archivo que no tiene nada que ver con la agenda; peor caso (si por azar el archivo sí trae columnas parecidas a 'Susceptible'/'Pendiente', p. ej. otro reporte de PyM de otra fecha o sede): se carga como si fuera la lista de HOY, con actividades que no corresponden a la jornada real.

<details><summary>Evidencia de la reproducción</summary>

```
node /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/test2_numeric_token.js

Reporte_45192026_Final.xlsx => true
Factura_00192026.xlsx => true
Consolidado_192026_v2.xlsx => true
InformeGeneral_2026_septiembre.xlsx => false
ArchivoNormal.xlsx => false
---- pickTodaysFile con archivo 'ajeno' en subcarpeta de estrategia, con fecha coincidente por casualidad ----
Seleccionado: Consolidado_192026_v2.xlsx

(fecha real del sistema al ejecutar la prueba: 2026-09-01; todayTokens() incluye "1-9-2026", que normName() reduce a "192026" y nameHasToken() acepta como substring SIN exigir que no sea cola de otro número — esa exigencia, según el propio comentario del código en la línea 11121-11126, 'SOLO aplica a los tokens con mes en letras. A los numéricos NO'.)
```

</details>

**Arreglo propuesto.** Aplicar a la regla 1 (matchName) la misma restricción 'sueltoEnLaRaiz' que ya protege a la regla 2, o extender la guarda de nameHasToken (rechazar coincidencia si el carácter siguiente/anterior también es dígito) a los tokens numéricos cuando el archivo no está en la carpeta raíz — no hace falta debilitar el caso ya conocido (Agenda_v2_20260806.xlsx en la raíz) para blindar las subcarpetas que el propio proyecto ya identificó como fuente de libros ajenos.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El hallazgo acierta en el dato de código (verificado y reproducido con el arnés): `esNombreDeHoy` usa `nameHasToken` (con la guarda "no cola de otro número") SOLO para tokens con mes en letras; para tokens numéricos usa `n.includes(t)` a pelo, así que un token de 6-8 dígitos puede aparecer empotrado dentro de un número más largo. Eso es cierto. Pero el salto de ahí a "daño clínico, gravedad alta" no sobrevive el trazado completo clic-a-daño:

1. **La ventana real es mucho más angosta de lo que dice el título.** El token corto (6 dígitos, "192026") solo existe cuando DÍA y MES son ambos de un solo dígito a la vez (día 1-9 Y mes 1-9): ~81 de 365 días al año (~22%), no "cualquier día". Hoy (1-sep-2026) es justo el peor caso posible, y el hallazgo lo usa sin aclararlo. El resto del año los tokens numéricos son de 7-8 dígitos, con probabilidad de colisión accidental órdenes de magnitud menor.

2. **La ruta real (`fetchSpFilesMultiFolder`, líneas 11503-11521) corta antes de llegar a la subcarpeta ajena la mayoría de los días.** Prueba carpeta por carpeta EN ORDEN (raíz → CITAS DIA EBS → ESTRATEGIAS POR SEDE) y hace `return` en cuanto `pickTodaysFile` matchea DENTRO de esa carpeta sola — si el PyM real ya subió a la raíz, la subcarpeta de estrategias ni se lista. El agujero solo se abre en la ventana transitoria "aún no ha subido el PyM real hoy", exactamente como reconoce e
… (recortado)

</details>

---

## 17. `colorAndAlert` — ALTA · clinico

**state.historical/historicalAt (y por tanto esNueva) usan la clave cruda de apptKey sin el respaldo de claves viejas que fraudWatch/alertedFraud ya tienen: un parpadeo del doc_id en el mismo tick que un cambio de estado anula por completo el antirrebote de v17.6.21 y genera una "llegada" fantasma**

- **Línea:** `12071`
- **Cruce estado × acción:** 1 pestaña líder x paciente cuyo doc_id aparece/desaparece entre lecturas (documentado como real en el comentario de apptKey, líneas 11966-11985) x el MISMO tick en que Everest reporta un cambio de estado (Sin presentarse -> En Sala)
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** v17.6.21 exige ver una lectura DOS VECES SEGUIDAS antes de aceptarla, precisamente para absorber el parpadeo API/DOM que el médico reportó en vivo ("la tarjeta titilaba entre verde y ámbar"). Pero ese antirrebote solo se activa si `!esNueva`, y esNueva se calcula con state.historical.has(key) usando la clave CRUDA — sin pasar por _apptMarcada/_apptKeysLegado como sí hacen fraudWatch y alertedFraud desde la v17.56.0. Si el doc_id parpadea en el MISMO tick en que el estado también parpadea (que es justo cuando más falta hace el antirrebote, porque ambos síntomas vienen de la misma inconsistencia API/DOM), la cita recibe una clave "nueva" y el antirrebote queda completamente anulado: la tarjeta salta a VERDE "En Sala" con una sola lectura sin confirmar, reproduciendo el defecto exacto que v17.6.21 se escribió para cerrar, solo que por la puerta del documento en vez de la del estado. Además, sin ningún cambio real de estado (el paciente sigue en sala todo el tiempo), un solo parpadeo del doc_id genera una SEGUNDA llegada fantasma (arrival:true otra vez) porque el historial bajo la clave nueva no tiene memoria del "en sala" ya registrado bajo la clave vieja.

<details><summary>Evidencia de la reproducción</summary>

```
CONTROL doc_id estable, tick2 a los 5s: {"color":"AZUL","estado":"Sin presentarse","arrival":false}
PRUEBA doc_id parpadea en el mismo tick: {"color":"VERDE","estado":"En Sala","key":"PACIENTE UNO@m596","arrival":true}

(segundo repro, sin ningún cambio real de estado)
tick1 (llega, doc_id presente): {"color":"VERDE","arrival":true,"key":"222222@m595"}
tick2 (mismo paciente, sigue en sala, doc_id se perdio esta vuelta): {"color":"VERDE","arrival":true,"key":"PACIENTE DOS@m595"}
```

</details>

**Arreglo propuesto.** Leer/escribir state.historical y state.historicalAt con el mismo mecanismo _apptMarcada/_apptMarcar (o una variante que devuelva el valor bajo cualquier clave legada) que ya protege fraudWatch y alertedFraud, en vez de state.historical.get(key)/.set(key,...) directos.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El defecto de código es real —confirmado leyendo y ejecutando el arnés— pero la cadena hasta un daño "clínico" se rompe en el primer eslabón después de `colorAndAlert`, y eso lo demuestra el propio código, no una opinión.

1) Lo que SÍ es cierto (verificado leyendo vigilante_agenda.user.js):
   - `colorAndAlert` (líneas 12097-12099, 12145, 12314, 12329-12330) usa `key = apptKey(a)` crudo para `state.historical`/`state.historicalAt`, sin pasar por `_apptMarcada`/`_apptKeysLegado` (líneas 12036-12041), a diferencia de `fraudWatch`/`alertedFraud` (líneas 12197, 12212, 12244, 12290, 12297) que sí usan ese respaldo desde v17.56.0.
   - Reproduje EXACTAMENTE los dos repros del hallazgo con `tests/harness.js` (`cargar({silencioso:true}).api`, `colorAndAlert` + `maybeNotify`): el parpadeo de `doc_id` en el mismo tick que un cambio de estado real SÍ anula el antirrebote de v17.6.21 y SÍ produce `{color:"VERDE", arrival:true}` sobre una clave "nueva" — igual que la evidencia aportada.

2) Por qué no llega a ser daño clínico, trazando el camino completo:
   - El canal que de verdad puede dañar al médico —la acusación de fraude (ROJO, `fraudWatch`/`alertedFraud`)— NO está expuesto: el propio hallazgo lo admite, y esas dos estructuras SÍ tienen el respaldo de claves viejas.
   - El canal VERDE/`arrival` sí queda con `esNueva=true`, pero antes de llegar al médico pasa por `maybeNot
… (recortado)

</details>

---

## 18. `_renderEstadioRenalHtml` — ALTA · clinico

**Un peso REGISTRADO pero clínicamente implausible (p.ej. 15 kg o 350 kg) se anuncia al médico como 'falta el peso', ocultando el valor real y sugiriendo que Everest no tiene el dato**

- **Línea:** `19611`
- **Cruce estado × acción:** signos vitales CON un peso presente pero fuera del rango plausible (20–300 kg, típico de un error de digitación o de unidades) x render del aviso de función renal
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** La función YA sabe distinguir 'dato ausente' de 'dato presente pero implausible' — así lo hace, con un mensaje rico y accionable, para la creatinina (creatinina_fuera_de_rango). Para el peso ese mismo caso (peso_fuera_de_rango) cae en la rama genérica de 'faltan' y el diccionario ETIQUETA lo traduce igual que si el peso nunca se hubiera tomado ('el peso' → 'falta el peso'). Un peso mal digitado en Everest (15 en vez de 51, o una talla puesta por error en la casilla de peso) es exactamente el tipo de error de transcripción que el chequeo de rango 20–300 kg está diseñado para atrapar — pero en vez de decirle al médico 'revise el peso, el valor registrado (15 kg) es implausible', el aviso dice 'falta el peso', que es información falsa (el dato SÍ está en Everest) y no da ninguna pista de que hay que ir a corregir un valor concreto en vez de simplemente tomarle los signos vitales de nuevo.

<details><summary>Evidencia de la reproducción</summary>

```
node probe2.js contra tests/harness.js:

estadioRenalDelPaciente({edad:70, peso:15, creatininaCruda:'1.0', sexo:'FEMENINO', ...})
faltan: ["peso_fuera_de_rango"]
entradas.peso: 15 (el valor SÍ está presente, no es null)

HTML mostrado al médico:
<div class="vgl-labs-renal-vacio">🫘 <b>Función renal:</b> no se puede calcular — falta el peso.</div>

¿El HTML dice 'falta el peso' (como si no existiera) en vez de avisar que el peso registrado (15 kg) es implausible? SI - el mensaje es ENGAÑOSO
¿Se muestra el valor real 15 para que el médico pueda ir a corregirlo en Everest? NO

Contraste — el caso gemelo (creatinina_fuera_de_rango) SÍ recibe trato especial en la misma función:
'no se puede calcular — la creatinina (<b>45</b>) queda fuera del rango posible en suero (0,1–20 mg/dL). Suele significar que el laboratorio la reportó en otras unidades (µmol/L). Verifíquela antes de usarla...'
```

</details>

**Arreglo propuesto.** Dar a 'peso_fuera_de_rango' el mismo trato temprano y explícito que ya tiene 'creatinina_fuera_de_rango' en _renderEstadioRenalHtml: un bloque propio que muestre el valor real (r.entradas.peso) y diga algo como 'el peso registrado (<b>15</b> kg) está fuera del rango plausible (20–300 kg) — verifíquelo en los signos vitales de Everest antes de continuar', en vez de dejarlo caer en la rama genérica de 'falta'.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El hallazgo es técnicamente correcto en lo textual (lo verifiqué corriendo tests/harness.js contra el código real, línea por línea) pero vende como "clínico/gravedad alta" algo cuyo único efecto demostrable es de redacción, y omite dos redes de seguridad independientes que ya existen en el propio script y que cierran el camino al daño clínico.

VERIFICACIÓN DEL HECHO BASE (correcto):
Con `node` contra `tests/harness.js`, `estadioRenalDelPaciente({edad:70, peso:15, creatininaCruda:'1.0', sexo:'FEMENINO'})` da `faltan:["peso_fuera_de_rango"]`, `entradas.peso:15`, y `_renderEstadioRenalHtml(r)` produce: "no se puede calcular — falta el peso." — sin mostrar 15 ni decir que es implausible. En cambio `creatinina_fuera_de_rango` sí recibe mensaje rico con el valor. Esto es real y no está cubierto por ningún test de HTML (solo `tests/suite_32_correccion_clinica_dom.js:242-244` prueba el array `faltan`, nunca el render).

POR QUÉ NO LLEGA A DAÑO CLÍNICO — el camino se corta en dos puntos distintos, verificados en el código:

1. La regla de oro del proyecto ("casilla vacía antes que dato inventado") se cumple en AMBOS casos (peso o creatinina fuera de rango): `r.estadio` queda `null`, no se calcula ni se muestra ningún eGFR/CrCl fabricado con el peso implausible. El médico no recibe ningún número clínico erróneo desde `_renderEstadioRenalHtml` — solo un mensaje ligeramente meno
… (recortado)

</details>

---

## 19. `openOrdenamientoModal` — ALTA · clinico

**El modal de Órdenes PyM no vuelve a consultar isOrdenesCreadasHoy/ordenesDetalleHoy (la marca local, ya escrita por markOrdenesCreadasHoy) antes de ofrecer 'Generar': si la consulta EN VIVO a Everest de órdenes vigentes falla o no refleja todavía la orden recién creada, reabrir el modal para el mismo paciente genera un duplicado real sin ningún aviso**

- **Línea:** `26140`
- **Cruce estado × acción:** paciente con un paquete ya ordenado hace un momento en esta MISMA visita (markOrdenesCreadasHoy ya corrió) x red: apiHcObtenerOrdenamientosVigentes devuelve null/[] (fallo real reconocido por el propio código, o simplemente el backend de Everest aún no indexó la orden que se acaba de crear) x el médico reabre 'Ordenar' para ese paciente (botón de la tarjeta, doble pestaña, o clic en Cancelar+reabrir mientras el primer lote sigue en vuelo) y pulsa 'Generar' otra vez
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El médico genera la orden de VIH de un paciente, y por cualquier motivo (cerrar y reabrir el modal, un refresco del dock que no alcanzó a repintar el botón, dos pestañas) vuelve a abrir 'Ordenar' para el MISMO paciente en la MISMA visita. Como el único filtro anti-duplicado que vive DENTRO del modal depende de una consulta de red en vivo a Everest (que el propio código documenta como 'un fallo de red aquí NO bloquea nada'), y el modal jamás consulta la marca local isOrdenesCreadasHoy que su propia hermana markOrdenesCreadasHoy ya dejó escrita segundos antes, el paciente termina con DOS órdenes reales de VIH en el sistema de Ordenamientos de Everest — sin ninguna advertencia, con un mensaje de éxito idéntico al de la primera vez. Para una mamografía o un PSA, esto es un examen repetido de verdad al paciente, no solo un renglón administrativo de más.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_ord_doble_chromium.js  (Chromium real vía Playwright, /opt/pw-browsers/chromium, DOM auténtico — no el arnés de bolsillo)
=== Abriendo el modal de Ordenar por PRIMERA vez (paciente 111111, VIH) ===
Estado tras abrir: {"modalExiste":true,"confirmTexto":"Generar 1 orden","confirmDisabled":false,"nChecks":1}

=== Clic en 'Generar' (dispara creación real de la orden vía red) ===
[PAGE] [VglFlightRecorder] [ORDEN] GuardarOrdenRequested {pacienteIdOrd: 555, dxId: 24300, countCups: 1}
[PAGE] [MOCK] GuardarOrdenamiento POST #1
[PAGE] [VglFlightRecorder] [ORDEN] GuardarOrdenResponse {error: false, agrupador: AGP-1}
Mientras la orden se está generando en 2do plano: {"confirmDisabled":true,"confirmTexto":"1 orden generada","cancelDisabled":false}

=== El médico hace clic en 'Cancelar' MIENTRAS la orden aún se genera ===
¿el modal se removió del DOM? true

=== El médico reabre el modal de Ordenar para el MISMO paciente, sin esperar a que la corrida anterior termine ===
Segunda instancia del modal: {"modalExiste":true,"confirmDisabled":false,"confirmTexto":"Generar 1 orden"}

=== El médico hace clic en 'Generar' en la SEGUNDA instancia ===
[PAGE] [VglFlightRecorder] [ORDEN] GuardarOrdenRequested {pacienteIdOrd: 555, dxId: 24300, countCups: 1}
[PAGE] [MOCK] GuardarOrdenamiento POST #2

=== RESULTADO ===
Total de llamadas REALES a GuardarOrdenamiento (POST que crea una orden clínica en Everest) para el MISMO paciente y el MISMO paquete (VIH), en una sola visita del médico: 2

(la simulación de red devuelve SIEMPRE [] en ObtenerOrdenamientoPorPacienteIdVigente — el mismo comportamiento 'fail-open' que el propio código produce ante un fallo real de esa consulta; script en /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/repro
… (recortado)
```

</details>

**Arreglo propuesto.** Al abrir el modal (y otra vez justo antes de disparar cada POST en el bucle de confirmBtn), consultar también isOrdenesCreadasHoy(apt.doc_id)/ordenesDetalleHoy(apt.doc_id) — la marca local, gratis, sin red — y si ya existe una orden de HOY para ese mismo cie10, mostrar un aviso explícito ('Ya se generó una orden de VIH para este paciente hace un momento; ¿de verdad quiere repetirla?') en vez de dejar 'Generar' disponible en silencio. Esto no reemplaza la consulta en vivo a Everest (que sigue siendo necesaria para órdenes de OTRAS sesiones/días), la complementa para el caso concreto en que Everest todavía no puede confirmar lo que el propio script acaba de crear.

---

## 20. `vglCarpetaGuardarInstantanea` — ALTA · clinico

**La poda de la cola por-paciente (>200 entradas) expulsa una clave con guardado EN CURSO y reintroduce la carrera que la cola existe para impedir: se pierde un resultado de laboratorio del historial local del paciente**

- **Línea:** `27739`
- **Cruce estado × acción:** estado: carpeta local de historias elegida + la Map en memoria _vglCarpetaCola ya tiene más de 200 pacientes distintos vistos en la sesión (día ocupado, o varios días sin recargar la pestaña de Everest) x acción: el MISMO paciente recibe un segundo guardado (p. ej. el médico reabre su Panel, o Laboratorios dispara otro mtrResumenDesdeModalLabs) mientras el primer guardado de ese paciente todavía está en vuelo x dato: dos instantáneas del mismo paciente con distinta información de laboratorios para la MISMA fecha.
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El archivo <cédula>.json es la única promesa que hace esta función: 'Historial completo, sin borrar nada' (comentario del propio código, línea ~28118 de Ajustes). Con más de 200 pacientes distintos vistos en la sesión, un segundo guardado del mismo paciente mientras el primero sigue en vuelo puede sobrescribir en silencio un resultado de laboratorio recién leído, sin ningún aviso al médico ni marca de error — el historial local que se supone íntegro queda con un hueco que nadie detecta.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_carpeta_cola.js
Orden real de leer/escribir para el paciente 111111:
control1:leer:inicio
control2:leer:inicio
control1:leer:fin
control1:escribir:inicio
control2:leer:fin
control2:escribir:inicio
control2:escribir:fin
control1:escribir:fin

¿control2 empezó a leer el archivo ANTES de que control1 terminara de escribir? true
(si es true: los dos guardados del MISMO paciente corrieron en paralelo — exactamente
 la condición de carrera que _vglCarpetaCola/v17.0.1 existe para impedir, reintroducida
 por la poda 'primero insertado' de vglCarpetaGuardarInstantanea al superar 200 entradas)

Contenido final que quedó escrito en 111111.json: [
 {
  "doc": "111111",
  "fecha": "2026-09-01",
  "laboratorios": {
   "creatinina": 1
  }
 }
]

control2 había leído 'creatinina:1, hba1c:7'; control1 (la lectura VIEJA, sin hba1c) escribió DE ÚLTIMO
y se comió el resultado de control2 -> el hba1c que control2 acababa de leer se PERDIÓ del archivo.

--- CONTROL NEGATIVO: mismo doble-guardado del mismo paciente pero SIN los 200 pacientes de relleno ---
$ node repro_carpeta_control_negativo.js
c1:leer:inicio
c1:leer:fin
c1:escribir:inicio
c1:escribir:fin
c2:leer:inicio
c2:leer:fin
c2:escribir:inicio
c2:escribir:fin

¿se solaparon (mala serialización) SIN el relleno de 200 pacientes? false (se espera false: la cola normal SÍ serializa bien)
laboratorios finales: {"creatinina":1,"hba1c":7}

(el control negativo confirma que la cola por-paciente SÍ funciona bien en el caso normal;
el fallo es específico de la poda de 200 entradas, no del diseño de la cola en general.)
```

</details>

**Arreglo propuesto.** No podar por 'la clave insertada hace más tiempo' a ciegas: podar solo entradas cuya corrida ya haya SETTLED (por ejemplo, que cada corrida borre su propia entrada del Map al terminar si sigue siendo la vigente, en vez de depender de un tope de tamaño que expulsa entradas potencialmente en curso).

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO por reproducción empírica directa contra el código real (no solo lectura).

Repliqué el escenario exacto que describe el hallazgo usando el arnés real (`tests/harness.js` -> `cargar({silencioso:true}).api`) y la función de producción `vglCarpetaGuardarInstantanea`, en dos variantes:

1. 200 pacientes de relleno distintos + paciente NUEVO 111111 con dos guardados rápidos (segundo mientras el primero está en vuelo).
2. Variante adversarial a favor del hallazgo: 111111 es el PRIMER paciente insertado en la sesión (la entrada más vieja de la Map, nunca vuelta a tocar) + 205 pacientes de relleno más (superando el umbral de poda con certeza) + revisita con dos guardados rápidos.

En AMBOS casos, con el código real, el orden observado fue: leer/leer-fin/escribir/escribir-fin del primer guardado, SEGUIDO por leer/escribir del segundo — sin solapamiento, y el archivo final conserva ambos resultados (incluido `hba1c`) sin pérdida. El hallazgo afirma lo contrario (solapamiento + pérdida de `hba1c`), pero esa evidencia no se reproduce contra HEAD.

La razón estructural por la que la carrera reintroducida es imposible: dentro de una sola llamada a `vglCarpetaGuardarInstantanea` (línea 27739-27752), NO hay ningún `await` antes de `_vglCarpetaCola.set(nombreCola, ...)` — el chequeo de poda (línea 27745-27747), la lectura de `previoEnCola` y el `.set()` corren de forma síncrona y atóm
… (recortado)

</details>

---

## 21. `_isoAMs (y, a través de ella, mtrLdlBasalDeSerie)` — ALTA · clinico

**_isoAMs acepta fechas de calendario que no existen (30-abr, 29-feb en año no bisiesto...) y las 'corrige' en silencio en vez de rechazarlas, a diferencia del validador que usa el resto del propio motor**

- **Línea:** `31660`
- **Cruce estado × acción:** DATO: fecha ISO con formato correcto pero calendario imposible (día que no existe para ese mes, p.ej. '2026-04-31') dentro de la serie histórica de LDL de un paciente × ACCIÓN: mtrLdlBasalDeSerie eligiendo cuál lectura previa es el 'basal' para calcular el % de reducción de LDL que ve el médico.
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** mtrLdlBasalDeSerie() es la función que decide, entre las lecturas de LDL del último año, cuál es el 'basal' (la más alta) contra el que se calcula el % de reducción que alimenta meta.ldlBasal / meta.ldlBasalFecha / meta.ldlBasalOrigen en el Panel del paciente (línea 38971 en mtrResumenClinico), y de ahí mtrEvaluarMetaLdl decide si el paciente está 'en meta' o en 'falla terapéutica'. mtrFechaDesdeIso (usada para TODO el resto de fechas del motor, incluida refLabIso dentro de MI MISMA partición en mtrAvisoVencimiento) hace un round-trip explícito (año/mes/día del Date construido deben coincidir con los del texto) precisamente para rechazar estas fechas imposibles — _isoAMs no lo hace: solo revisa el formato con una regexp de 3 grupos de dígitos y deja que `new Date(y, m-1, d)` haga el rollover silencioso de JS (30-abr pasa a ser 1-mayo). El resultado: una fecha que el calendario no tiene se usa como si fuera una lectura de laboratorio real, con su valor incluido en un cálculo clínico mostrado al médico, sin ningún aviso de dato inválido — justo lo que la regla del proyecto ('casilla vacía antes que dato inventado') prohíbe. La ruta de ingesta real (_parseFechaHoraLike, usada por mtrSeriesPorAnalito→c.seriesLdl) tampoco valida rango día-por-mes (solo exige día 1-31 y mes 1-12), así que una fecha corrupta con esta forma sí puede llegar hasta aquí desde un dato real de Athenea.

<details><summary>Evidencia de la reproducción</summary>

```
== mtrFechaDesdeIso('2026-04-31') (validador usado en el resto del motor) ==
null
== typeof a._isoAMs == function
_isoAMs('2026-04-31') (deberia ser null: 30-abr no tiene ese dia) -> 1777611600000 2026-05-01T05:00:00.000Z
== mtrLdlBasalDeSerie con fecha invalida 2026-04-31 (LDL=210) ==
{
  "valor": 210,
  "fecha": "2026-04-31",
  "nPrevios": 1
}

(script: /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/probe2.js — ejecutado con `node probe2.js`)
```

</details>

**Arreglo propuesto.** Hacer que _isoAMs delegue en mtrFechaDesdeIso (o repita su mismo round-trip: reconstruir la fecha y comparar year/month/day contra los dígitos originales) antes de devolver el timestamp, devolviendo null ante cualquier fecha que el calendario no tenga — igual que ya hace el resto del motor.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El bug de código es real (confirmado leyendo las líneas 31660-31665 y 30670-30680: `_isoAMs` solo valida formato con una regexp de 3 grupos y deja que `new Date(y,m-1,d)` haga rollover silencioso, mientras `mtrFechaDesdeIso` sí hace el round-trip y rechaza fechas de calendario imposibles), pero el hallazgo no traza un camino real de clic-a-daño porque falla en dos puntos:

1) TODA la evidencia es sintética. `probe2.js` construye a mano un array `[{fecha:"2026-04-31", valor:210}, ...]` y lo pasa DIRECTO a `mtrLdlBasalDeSerie`, saltándose por completo la única ruta de ingesta real de producción (`mtrSeriesPorAnalito(labs,...)` en línea 40557, que recibe `labs` del JSON en vivo de la API de Athenea → `_extractAtheneaFecha` → `_parseFechaHoraLike`, líneas 2967-2994 y 2882-2942). No hay ninguna captura real de Athenea, ni en el repo ni citada en el hallazgo, que muestre que ese backend alguna vez emitió una fecha de calendario inválida. Y estructuralmente es muy poco probable que lo haga: los campos de fecha conocidos (`Fecha`, `fechaResult`, `fechaOrden`, `fechaResultado`) en un backend ASP.NET/SQL Server se serializan desde un `DateTime` real, un tipo que NO PUEDE representar el 31 de abril — sencillamente no existe ese valor para construirlo. Las auditorías documentadas del propio proyecto sobre las fechas de Athenea (v12.3.30 en adelante) solo encontraron variación de 
… (recortado)

</details>

---

## 22. `mtrEvaluarInteracciones` — ALTA · clinico

**eGFR=null (función renal NUNCA medida) se evalúa como eGFR<30/eGFR<60 por coerción de JS: dispara HIPERKALEMIA_SINERGICA y METFORMINA_CONTRASTE falsas**

- **Línea:** `33137`
- **Cruce estado × acción:** dato: tfgCkdEpi = null (creatinina jamás tomada, no 'baja' sino DESCONOCIDA) × acción: mtrAvisosFarmacologicos()/mtrEvaluarInteraccionesAmpliadas() con IECA/ARA-II + espironolactona (o metformina + contraste yodado) × estado: desde v17.6.28 SIN_FUNCION_RENAL ya NO corta el cálculo de interacciones (solo corta avisos de dosis), así que egfr=null SÍ llega intacto a mtrEvaluarInteracciones.
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** En un paciente sin creatinina/peso/talla en la historia (eGFR real desconocido), el motor emite una alerta HIGH/CRITICAL de 'RIESGO DE HIPERKALEMIA SEVERA... K+ elevado/eGFR baja' o 'PRECAUCIÓN POR CONTRASTE: eGFR<60' AFIRMANDO una función renal deteriorada que nunca se midió — justo lo que la regla del proyecto prohíbe ('casilla vacía antes que dato inventado'). El médico puede suspender/ajustar medicación por un dato inventado, o —si detecta el error una vez— dejar de confiar en el resto de alertas reales del motor.

<details><summary>Evidencia de la reproducción</summary>

```
=== Caso A: egfr=null (creatinina nunca medida), potasio=null ===
Numero de alertas: 1
 - HIPERKALEMIA_SINERGICA | HIGH | RIESGO DE HIPERKALEMIA SEVERA: Combinación de ahorrador de potasio / IECA / ARA-II con suplementación de Potasio (o K+ elevado/eGFR baja). Desprescribir suplemento y monitorear electrolitos.

=== Caso B (control): egfr=45 (funcion renal normal-CONOCIDA), potasio=null ===
Numero de alertas: 0

=== Caso C (control): egfr=undefined, potasio=null ===
Numero de alertas: 0

[script separado, misma funcion, regla METFORMINA_CONTRASTE]
=== egfr=null (creatinina nunca medida) ===
 - METFORMINA_CONTRASTE | HIGH
total: 1
=== egfr=90 (funcion renal normal conocida) ===
total: 0

(node /tmp/.../repro_egfr_null_hiperkalemia.js y repro_egfr_null_metformina.js, contra tests/harness.js -> api.mtrEvaluarInteracciones)
```

</details>

**Arreglo propuesto.** Blindar `egfr < 30` (línea 33137) y `egfr < 60` (línea 33159) con el mismo patrón `egfr !== null && egfr !== undefined && egfr < X` que YA usa correctamente la capa ampliada 30 líneas más abajo (viaEspirono, línea 33369) para el mismo eje fisiológico — la propia función vecina ya tiene el fix, solo falta aplicarlo aquí.

---

## 23. `mtrAbrirPanelRedaccion (la caja roja «cifras sin respaldo», vía _respaldoDelMedico → mtrVerificarCifrasIA) y mtrTextoDeOtrasCasillas` — ALTA · clinico

**La caja roja de «cifras sin respaldo» nunca recibe lo que el médico ya escribió en las OTRAS casillas de texto libre, aunque eso SÍ viaja a Gemini**

- **Línea:** `39699`
- **Cruce estado × acción:** modo=analisis_plan (o cualquiera de los tres) + el médico YA escribió una cifra en OTRA casilla (p. ej. Recomendaciones: «TFG de 45 mL/min») + pulsa Generar: esa cifra SÍ entra al prompt de Gemini vía opts.contextoLibre (línea 39792, que concatena mtrTextoDeOtrasCasillas), pero _respaldoDelMedico (línea 39699-39703, lo que _pintarCifras usa como «conocido») solo junta alertasDosis + #vgl-ia-indicaciones + #vgl-ia-pregunta + libreAhora().combinado — mtrTextoDeOtrasCasillas NUNCA está en esa lista.
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Si Gemini cita fielmente una cifra que el propio médico ya dejó escrita en otra casilla de la historia (justo lo que el prompt le pide hacer), la caja roja igual la marca como «⚠ cifra sin respaldo — el modelo pudo inventarla». Es el aviso que el propio código llama «el más grave del módulo» (línea ~39715): un falso positivo repetido en el flujo normal de trabajo (escribir Recomendaciones antes que Análisis y plan, o viceversa) enseña al médico a ignorar la caja roja — y entonces deja de servir para cazar la cifra de verdad inventada, que es su único propósito.

<details><summary>Evidencia de la reproducción</summary>

```
node -e con api.mtrVerificarCifrasIA(borrador, hoja, extraConocido):
Hallazgos con el respaldo REAL (sin mtrTextoDeOtrasCasillas): [{"numero":"45","contexto":"considerando la TFG de 45 mL/min reportada"}]
Hallazgos si el respaldo SI incluyera esa casilla: []

(borrador = 'Se ajusta la dosis considerando la TFG de 45 mL/min reportada por el medico.'; hoja={} sin ese 45; _respaldoDelMedico simulado EXACTAMENTE como lo arma el modal real: ['', '', ''] — indicaciones, pregunta y libreAhora().combinado vacíos, que es lo único que _respaldoDelMedico junta hoy. El mismo 45 SÍ está en mtrTextoDeOtrasCasillas si el médico lo escribió en Recomendaciones, y ese texto SÍ se le manda a Gemini como contextoLibre — pero jamás llega a _respaldoDelMedico.)

Confirmado también por la propia suite del proyecto: tests/suite_57_ia_redaccion.js:337-349 ("v18.0.35: y el modal le pasa de verdad esas fuentes a la caja roja") verifica que _respaldoDelMedico incluya vgl-ia-indicaciones + vgl-ia-pregunta + libreAhora() — pero NO verifica mtrTextoDeOtrasCasillas, que se añadió una versión después (v18.0.36, comentario de la línea 38410) sin actualizar ni el fix de v18.0.35 ni su prueba.
```

</details>

**Arreglo propuesto.** Añadir mtrTextoDeOtrasCasillas(modo, document, resumen._nombrePaciente) a la lista que arma _respaldoDelMedico en _pintarCifras(), igual que ya se hace en la construcción de opts.contextoLibre del click de Generar.

---

## 24. `mtrHcEnganchar` — ALTA · clinico

**La respuesta de red (fetch/XHR) sobre la historia clinica se atribuye al paciente que este ABIERTO cuando la respuesta LLEGA, no al paciente para el que se hizo la peticion**

- **Línea:** `41313`
- **Cruce estado × acción:** paciente abierto: A al salir la peticion / B al llegar la respuesta (cambio A MITAD) x red: fetch/XHR asincrono que tarda x accion: llamada tras cambiar de paciente a mitad
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Con red lenta -realista en la IPS, el propio comentario del codigo lo reconoce ('Everest recarga la pagina de verdad al abrir un paciente')-, si el medico pasa al siguiente paciente antes de que llegue la respuesta de la historia (o de un guardado) del paciente anterior, esos antecedentes/examen fisico/motivo de consulta se archivan bajo el paciente NUEVO. Esa cosecha alimenta mtrHcTextoParaHoja y de ahi la hoja de hechos que lee la IA para redactar: el paciente B terminaria con antecedentes o hallazgos de A colandose en su nota clinica, exactamente el riesgo que el propio comentario de mtrHcEnganchar (linea ~41342) dice evitar -pero solo cubre 'sin cedula legible no se guarda', nunca 'la cedula leida ahora es la del paciente correcto para ESTA respuesta'.

<details><summary>Evidencia de la reproducción</summary>

```
Salida literal de node /tmp/.../repro_hcenganchar_race.js:

mtrHcEnganchar() devolvio: true
extractPacienteAbierto() ahora mismo: 111111111
longitud del cuerpo simulado: 365
medico cambio de paciente; extractPacienteAbierto() ahora: 222222222

--- RESULTADO ---
Se guardo algo bajo el paciente B (222222222), el que estaba abierto CUANDO LLEGO la respuesta:
{
  "secciones": {
    "antecedentePatologicos": { "hipertension": true, "diabetes": false, "dislipidemia": true },
    "examenFisico": { "peso": "70", "talla": "170", "perimetroAbdominal": "94" }
  },
  "textos": { "motivo": "Paciente en control de riesgo cardiovascular, refiere adherencia parcial al tratamiento, sin dolor toracico, sin disnea, signos vitales estables durante la valoracion de hoy en la consulta programada" },
  "medicamentos": [], "diagnosticos": [], "_campos": 7
}

Se guardo algo bajo el paciente A (111111111), el DUENO real de esos datos: null

*** CONFIRMADO: los hechos clinicos del paciente A quedaron guardados bajo el paciente B. ***
```

</details>

**Arreglo propuesto.** Capturar el id del paciente (extractPacienteAbierto()) en el momento en que SALE la peticion (junto al listener de send/fetch) y comparar contra el id leido cuando LLEGA la respuesta antes de guardar; si difieren, descartar la respuesta (igual que ya hace _vglCosecharDePantalla en la linea 5021: 'cambio de paciente a mitad: no se adivina').

---

## 25. `mtrDosisDeTexto` — ALTA · clinico

**En una formulacion combinada de dosis fija (amlodipino/atorvastatina), mtrDosisDeTexto lee la dosis del OTRO principio activo como si fuera la de la estatina**

- **Línea:** `41809`
- **Cruce estado × acción:** dato: dos numeros distintos en el mismo texto (dosis de dos principios en una sola linea) x accion: mtrInerciaEstatina evaluando un medicamento real de combo
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** mtrDosisDeTexto toma el PRIMER numero tras el nombre del principio buscado. En 'Amlodipino/Atorvastatina 5/40mg' -presentacion de combo de dosis fija real y comun en HTA+dislipidemia-, el numero que sigue inmediatamente a 'atorvastatina' es el 5 del amlodipino (que aparece antes en el texto), no el 40 propio. mtrEstatinaAltaIntensidad concluye entonces que el paciente NO tiene estatina de alta intensidad y mtrInerciaEstatina/mtrPlanFallas afirman 'LDL en falla sin estatina de alta intensidad: revise intensidad' -una afirmacion clinicamente FALSA para un paciente que ya esta en atorvastatina 40mg, el techo habitual de esa dosis fija-, empujando al medico a subir una dosis que ya esta bien, o a desconfiar de un dato que si es correcto.

<details><summary>Evidencia de la reproducción</summary>

```
Salida literal de node /tmp/.../repro_estatina_combo.js:

texto: Amlodipino/Atorvastatina 5/40mg tableta, 1 cada noche
  mtrDosisDeTexto(..., 'atorvastatina') = 5  (la dosis REAL es 40mg)
  mtrEstatinaAltaIntensidad([texto])     = null
  mtrInerciaEstatina(hayFallaLdl=true, [texto]) = {"inercia":true,"estatina":null,"mensaje":"LDL en falla sin estatina de alta intensidad (atorvastatina 40-80 o rosuvastatina 20-40): revise intensidad y adherencia antes de asumir que solo hace falta esperar."}

*** CONFIRMADO: con una formulacion combinada, mtrDosisDeTexto lee 5 mg de atorvastatina en vez de 40 mg (el numero real es el de OTRO principio, amlodipino). ***
*** Y mtrInerciaEstatina declara 'inercia:true' ... para un paciente que SI la tiene (atorvastatina 40mg) -- mensaje clinico FALSO al medico. ***
```

</details>

**Arreglo propuesto.** Anclar la busqueda del numero a que este INMEDIATAMENTE junto al nombre del principio (antes o despues, con separador tipico mg/ /) en vez de tomar el primer numero de todo el resto de la cadena; o, mas simple, si el texto contiene un patron de combo 'A/B N1/N2', mapear cada dosis a su principio por POSICION relativa al nombre, no al primer numero que aparezca.

---

## 26. `injectLabsIntoCronicos (escritura de la casilla de fecha) — causa raíz en _parseFechaHoraLike` — MEDIA · bug

**Una fecha de laboratorio con día de calendario imposible (31 de abril, 30 de febrero) se acepta como válida y se intenta escribir; el navegador la rechaza en silencio y, a diferencia del valor, nadie comprueba ni avisa que la fecha quedó vacía**

- **Línea:** `3647`
- **Cruce estado × acción:** dato = fecha con día fuera de rango para su mes ('31/04/2026', '30/02/2026') x acción = primera escritura en casilla de fecha VACÍA x _parseFechaHoraLike + injectLabsIntoCronicos
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** v16.7.0 (Auditoría #6, comentario en setNgValue línea 2718) blindó exactamente este patrón para el VALOR: 'el contador del robot ya no puede contar un rechazo del navegador como logro', y el código de la línea 3592-3593 SÍ comprueba el retorno de setNgValue para el resultado y avisa por consola si el navegador lo rechazó. Pero la escritura de FECHA en la línea 3647 (y su gemela en el reintento del uroanálisis, línea ~3764) llama a setNgValue(dateInput, resultDate) sin mirar el retorno: si Athenea manda una fecha con un día que no existe en ese mes (dato mal tecleado en el LIS, un caso real de entrada de datos), _parseFechaHoraLike la deja pasar como ISO válida (no valida día-por-mes, solo día 1-31 y mes 1-12), Everest la rechaza y la casilla de fecha queda vacía — pero el botón sigue diciendo '✓ N casillas escritas' en verde (el conteo es solo de valores) y NO aparece ningún aviso de que la fecha falló. Peor: _fechasYaUsadas.add(dateInput) se ejecuta igual aunque no se haya escrito nada, así que esa casilla de fecha queda 'reclamada' y ya no puede servir de respaldo a otro analito que la necesite (la misma guarda anti-reutilización de v16.2.8, pensada para proteger contra colisiones reales, aquí bloquea una casilla que en realidad sigue vacía). El médico ve un resultado numérico sin su fecha, sin ninguna pista de por qué, y tiene que investigarlo a mano en medio de la consulta.

<details><summary>Evidencia de la reproducción</summary>

```
node repro5_fecha_invalida.js:
=== _parseFechaHoraLike('31/04/2026') (abril tiene 30 dias, no existe el 31) ===
{"iso":"2026-04-31","hora":null}
=== _parseFechaLike('30/02/2026') (30 de febrero no existe) ===
2026-02-30

node repro6_chromium_fecha.js (Chromium real, /opt/pw-browsers/chromium, confirma que el navegador SI rechaza esas fechas en un <input type="date"> real):
Valor de la casilla <input type=date> tras asignar cada fecha:
{
  "trasAbril31": "",
  "trasFebrero30": "",
  "trasFechaValidaControl": "2026-08-30"
}

Grep sobre vigilante_agenda.user.js confirma que en injectLabsIntoCronicos el retorno de setNgValue SI se comprueba para el valor (línea 3592: 'if (setNgValue(inputEl, resultVal)) count++; else console.warn(...)') pero NO para la fecha (línea 3647: 'setNgValue(dateInput, resultDate);' sin if/else).
```

</details>

**Arreglo propuesto.** Añadir validación de día-por-mes en _parseFechaHoraLike (o un chequeo con new Date(...) que confirme que el día/mes/año no se 'desbordaron') para descartar fechas imposibles antes de que lleguen a resultDate; y, como red de seguridad adicional, comprobar el retorno de setNgValue también en la escritura de fecha (línea 3647 y su gemela ~3764) para avisar al médico igual que ya se hace con el valor.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Verifiqué el código y confirmé TODOS los hechos técnicos del hallazgo:

1. `_parseFechaHoraLike` (líneas 2882-2942) en efecto solo valida rango 1-31/1-12, sin validar días-por-mes. Con el arnés real (`tests/harness.js` → `cargar({silencioso:true}).api`) reproduje: `_parseFechaHoraLike('31/04/2026')` → `{"iso":"2026-04-31","hora":null}`. Confirmado también para la rama ISO (línea 2911-2915, mismo defecto).
2. Con Chromium real (`/opt/pw-browsers/chromium-1194`, vía Playwright ya presente en `node_modules/`) confirmé que un `<input type="date">` real rechaza esos valores: asignar `"2026-04-31"` o `"2026-02-30"` deja `el.value === ""`, mientras que una fecha válida sí se fija. Esto reproduce exactamente el repro6 citado.
3. En `injectLabsIntoCronicos`, línea 3592 SÍ comprueba el retorno de `setNgValue` para el VALOR (`if (setNgValue(...)) count++; else console.warn(...)`), pero la línea 3647 (`setNgValue(dateInput, resultDate);`) y su gemela en el reintento de uroanálisis (línea 3764) NO comprueban el retorno. Y la línea 3648 (`_fechasYaUsadas.add(dateInput)`) se ejecuta incondicionalmente. Esta asimetría es real y verificable.

Pero el hallazgo se cae en el paso decisivo: "traza el camino completo hasta el daño". El estado final visible para el médico —valor numérico escrito, casilla de fecha VACÍA, sin aviso especial— es EXACTAMENTE el mismo estado que el propio diseño del siste
… (recortado)

</details>

---

## 27. `_rageEtiqueta` — MEDIA · bug

**Un ícono SVG propio (dentro de un botón .vgl-*) se reporta como si fuera de Everest («host»), justo el error de atribución que este mismo bloque de código dice evitar**

- **Línea:** `10712`
- **Cruce estado × acción:** elemento objetivo de una interacción lenta (rum.self.inp.*) que es un <svg class="vgl-ico"> (los hay 45 en el script, varios dentro de botones .vgl-sb-btn/.vgl-fchip) en vez de un elemento HTML normal
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** No toca datos clínicos ni bloquea la consulta, pero corrompe en silencio el propio diagnóstico de lentitud que el comentario de v17.1.0 (#149) describe como la razón de ser de este código («un termómetro de la casa ajena, etiquetado con nuestro nombre... sin atribución no se puede afirmar que sea nuestro»): aquí pasa lo contrario — un ícono NUESTRO (el buscador, los chips de filtro, la pluma de IA, el botón de Ajustes, todos con <svg class="vgl-ico">) que resulta lento se etiqueta 'host' (=de Everest, sin decir cuál), así que si el médico reporta lentitud al tocar uno de esos íconos, la telemetría que debería decir «fue el ícono X nuestro» dice «fue algo de Everest» y el rastro se pierde. La causa: t.className en un <svg> es un objeto SVGAnimatedString, no un string — String(t.className) da "[object SVGAnimatedString]" en vez de la clase real — mientras que _rumNodoEsNuestro() (2 líneas más arriba en el mismo archivo) sí usa classList y por eso identifica bien al mismo elemento como 'nuestro'.

<details><summary>Evidencia de la reproducción</summary>

```
node t2_rageetiqueta_svg.js ->
== Caso 1: <svg class="vgl-ico"> (icono DENTRO de un boton nuestro) ==
_rumNodoEsNuestro(svgIcono) = true   (deberia ser true: SI es nuestro)
_rageEtiqueta(svgIcono)     = "host"   (se espera 'otro', salio 'host' si hay bug)

== Control: mismo elemento pero <button class="vgl-ico"> (className SI es string) ==
_rageEtiqueta(botonNormal)  = "otro"

== Ruta real de RUM: entries[i].target === svgIcono, mio = _rumNodoEsNuestro ==
clave que viajaria al tablero: rum.self.inp.detalle.host.poor
```

</details>

**Arreglo propuesto.** En _rageEtiqueta, leer la clase igual que ya hace _rumNodoEsNuestro: usar t.classList (className.split solo si t.className es string) o t.getAttribute('class'), que sí devuelve el string real tanto en HTML como en SVG.

---

## 28. `dismissSpToast / spToast` — MEDIA · bug

**dismissSpToast() programa un remove() del toast en un setTimeout SIN GUARDAR SU ID: si spToast() vuelve a mostrar un mensaje nuevo dentro de esos 260 ms, ese remove() diferido lo borra igual del DOM**

- **Línea:** `11722`
- **Cruce estado × acción:** acción 'cerrar' (clic en la X, clic en el toast, o el propio auto-descarte por duración) x segunda llamada a spToast() con un mensaje distinto en menos de 260 ms (ej.: el aviso de progreso 'Buscando el PyM de hoy…' vencido justo cuando llega el resultado final '✓ PyM de hoy capturado' o '⚠ Sin PyM de hoy').
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** spToast() SÍ cancela correctamente el temporizador de auto-descarte compartido ('if (spToastTimer) clearTimeout(spToastTimer);'), pero dismissSpToast() programa la eliminación física del nodo ('t.remove()') en un setTimeout local de 260 ms que no se guarda en ninguna variable y por tanto nadie puede cancelar. spToast() reutiliza el mismo elemento #vgl-sp si ya existe en el DOM (document.getElementById('vgl-sp')) — así que si un nuevo mensaje llega en esa ventana de 260 ms, lo reutiliza y lo vuelve a mostrar con su propia duración (p. ej. 6 s), pero el remove() diferido de la llamada anterior sigue en pie y borra el nodo igual, sin avisar. bootSharepointLite() (la única función que llama a spToast en este mismo lote) hace justo esa secuencia: un aviso de progreso ('Buscando el PyM de hoy…') seguido, segundos después, del resultado final ('✓ PyM de hoy capturado...' o '⚠ Sin PyM de hoy...'). Si el primer aviso se auto-descarta justo cuando llega el segundo, el médico o el staff que está mirando la pestaña de SharePoint puede quedarse sin ver el resultado de la captura — no sabe si funcionó o no, sin ningún indicio de fallo en pantalla.

<details><summary>Evidencia de la reproducción</summary>

```
node /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/test3_spToast_race.js

tras spToast#1: existe= true texto= 🛡️ Centinela PyM · mensaje1
tras spToast#2 (50ms despues del dismiss): existe= true texto= 🛡️ Centinela PyM · mensaje2 - IMPORTANTE
tras esperar 300ms mas (total ~350ms desde el dismiss): sigue existiendo= false
BUG CONFIRMADO: el toast recien mostrado ('mensaje2') fue borrado del DOM por el remove() diferido de la llamada ANTERIOR a dismissSpToast, aunque spToast() lo habia vuelto a mostrar con duracion de 6000ms.
```

</details>

**Arreglo propuesto.** Guardar el id del setTimeout de dismissSpToast() en una variable de módulo (igual que ya se hace con spToastTimer) y cancelarlo al inicio de spToast() antes de reutilizar/reconstruir el nodo.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El bug de código es real —lo confirmé leyendo el fuente (líneas 11714-11768): `dismissSpToast()` programa `setTimeout(()=>t.remove(),260)` sin guardar el id, así que si `spToast()` reutiliza el mismo nodo `#vgl-sp` dentro de esos 260 ms, el `remove()` diferido de la llamada anterior lo borra igual. El test del hallazgo reproduce esto correctamente forzando la secuencia a mano.

Pero no existe un camino real y verosímil de "clic real → daño clínico":

1. **No es la pestaña del médico.** `#vgl-sp`/`spToast` para el flujo de PyM solo corre dentro de `bootSharepointLite()`, que a su vez SOLO se invoca cuando `location.hostname` es `sharepoint.com` (línea 30575) — nunca en la pestaña de Everest donde el médico atiende. Es, por comentario propio del código, un captador "sin panel, sin observar, sin repetir rondas" que corre una vez al abrir esa pestaña (staff, no el médico en consulta).

2. **La captura de datos no depende del toast.** El `GM_setValue("vgl_pym", txt)` (línea 11689) ya se ejecutó ANTES del `spToast()` final (línea 11690). Aunque el aviso desaparezca antes de tiempo, el dato ya quedó guardado o no — el toast es puramente informativo, no gatea nada.

3. **Hay un indicador redundante y no afectado en Everest.** `loadPymFromCache()`/`#vgl-pym-banner`/`setSummary()` en la pestaña de Everest leen el mismo `GM_getValue("vgl_pym")` de forma independiente, con reinte
… (recortado)

</details>

---

## 29. `startFlash / stopFlash` — MEDIA · bug

**origTitle se captura UNA sola vez por sesión (a diferencia de origIcon, que sí se refresca en cada alerta): tras la primera alerta del día, reconocer cualquier alerta posterior restaura un título de pestaña obsoleto**

- **Línea:** `12356`
- **Cruce estado × acción:** S.parpadeo encendido x primera alerta del día YA reconocida x segunda alerta (de otro paciente, más tarde) x el título real de la pestaña cambió entre medias (Everest/Angular navega a otra sección)
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** startFlash reescribe document.title mientras parpadea y promete devolverlo a "lo que estaba antes" al reconocer (acknowledge -> stopFlash). origIcon SÍ se relee en cada llamada a startFlash (línea 12357, sin guarda), pero origTitle solo se captura si `origTitle === null` — y stopFlash nunca lo vuelve a poner en null, así que después de la primerísima alerta del día queda fijado para siempre. Si el título real de la pestaña cambia entre dos alertas (navegación normal dentro de Everest), reconocer la segunda alerta (o cualquiera posterior) no restaura el título actual sino el de la primera alerta del día — el médico puede terminar viendo en la pestaña un título de una sección/paciente que ya no es el que tiene en pantalla, justo el tipo de desajuste silencioso que le puede hacer confirmar o navegar sobre la historia equivocada creyendo que está en otra.

<details><summary>Evidencia de la reproducción</summary>

```
Tras 1a alerta, titulo restaurado: "Everest — Agenda del día"
Tras 2a alerta, titulo restaurado: "Everest — Agenda del día"
Esperado (lo que Everest tenia puesto justo antes de la 2a alerta): "Everest — Historia clínica"
```

</details>

**Arreglo propuesto.** Quitar la guarda `if (origTitle === null)` y capturar `origTitle = document.title` en cada llamada a startFlash, igual que ya se hace con origIcon.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Reproduje el bug con tests/harness.js y se confirma técnicamente: origTitle se captura una sola vez (guardia `if origTitle===null`) y stopFlash nunca la resetea, así que tras la primera alerta del día, startFlash pisa document.title con el título obsoleto incluso antes de que corra el intervalo, y stopFlash restaura ese mismo título obsoleto en cada reconocimiento posterior. El comentario del propio código (línea ~29493) confirma que en Everest real document.title suele llevar el nombre del paciente, así que la premisa del cruce es plausible. Sin embargo, el camino hasta el 'daño clínico' se rompe: document.title solo controla el texto de la pestaña/taskbar del navegador, no el DOM real de Everest — el banner de paciente y todo el contenido en pantalla que el médico realmente consulta para tomar decisiones clínicas permanece correcto y no se ve afectado. Un grep completo de document.title en el script muestra que ningún otro código lo lee para decidir nada (ni deduplicar alertas, ni llenar casillas, ni guardar datos); los únicos otros usos son de diagnóstico y omiten deliberadamente el contenido. El mecanismo de 'llamar la atención' (parpadeo + favicon) sigue funcionando sin problema. Para que hubiera daño clínico, el médico tendría que confirmar o navegar basándose en el texto truncado de una pestaña del navegador en vez del banner de paciente que Everest muestra en pantalla —
… (recortado)

</details>

---

## 30. `_ajustesIntentarCerrar` — MEDIA · bug

**_ajustesIntentarCerrar() no es la única puerta de salida que el propio código dice que es: Escape (y un clic en cualquier chip de filtro) llaman a closeSheet() directo y descartan en silencio los cambios sin guardar de Ajustes**

- **Línea:** `27980`
- **Cruce estado × acción:** estado: hoja de Ajustes abierta con el borrador sucio (_ajustesDraft con al menos un cambio, p. ej. tocar 'Modo rendimiento', escribir el nombre del consultorio, cambiar la meta de HbA1c) x acción: el médico pulsa Escape, en vez de usar el botón 'x' o 'Guardar/Descartar' x dato: cualquier campo de Ajustes que pase por el flujo de borrador (todos menos las credenciales de Athenea, que se guardan aparte).
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El propio código documenta la intención explícita ('Cierre de Ajustes respetando cambios sin guardar: una sola pregunta, dos salidas claras', v15.6.0) y afirma que el botón 'x' 'respeta los cambios sin guardar (no usa wireClose)' — dando a entender que es EL mecanismo de cierre. Pero el atajo global de Escape (vigilante_agenda.user.js:17979-17982) y el clic en un chip de filtro rápido (17922-17928) llaman a closeSheet() directamente, sin pasar por _ajustesIntentarCerrar(). El médico que ajusta algo (p. ej. la meta general de HbA1c, o el nombre del consultorio que alimenta el tablero de seguimiento) y sale con el reflejo normal de Escape pierde el cambio sin ningún aviso ni oportunidad de deshacerlo — justo lo que 'una sola pregunta, dos salidas claras' prometía evitar.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_ajustes_escape2.js
=== CASO A: cierre por Escape (closeSheet() directo, línea ~17979) ===
state.sheet inicial: null
tras abrir Ajustes -> state.sheet: ajustes
tras marcar 'Modo rendimiento' -> _ajustesSucio(): true
[ESCAPE] tras closeSheet() directo -> state.sheet: null
¿se le preguntó algo al médico? NO — no hubo ningún cartel ni llamada a _ajustesIntentarCerrar()
S.modoRendimiento sigue en: false (el cambio jamás se guardó, y tampoco se avisó que se perdió)

=== CASO B: mismo cambio, cierre por el botón 'x' (data-x="1", ligado a _ajustesIntentarCerrar) ===
tras abrir Ajustes -> state.sheet: ajustes
tras marcar 'Modo rendimiento' -> _ajustesSucio(): true
[BOTÓN x] tras pulsar 'x' -> state.sheet: ajustes (se queda abierto)
_ajustesSucio() tras pulsar 'x': true (sigue sucio: el cartel de confirmar está pendiente de que el médico elija)
```

</details>

**Arreglo propuesto.** Que closeSheet() mismo (fuera de mi partición, pero es el punto de unión natural) consulte _ajustesSucio() y, si hay hoja de Ajustes con borrador sucio, delegue en _ajustesIntentarCerrar() en vez de cerrar directo — así todo call-site queda protegido sin tener que acordarse uno por uno.

---

## 31. `refrescarCuentas / render` — MEDIA · bug

**El badge "⚠ N inasistencias previas" (S.adherencia) nunca se pinta mientras el paciente está En sala o Atendido — exactamente cuando el médico lo tiene enfrente para dialogar sobre eso**

- **Línea:** `28943`
- **Cruce estado × acción:** S.adherencia=true (interruptor real, apagado por defecto) x paciente con inasistencias previas reales en vgl_nosh_hist x transición de estado 'Sin presentarse'→'En sala'/'Atendido' (que cambia signatureOf() y dispara un repintado completo)
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El propio tooltip del interruptor dice que este badge sirve 'para priorizar el recordatorio o el diálogo' con el paciente. Pero: (1) render() arma el HTML de cada tarjeta en las líneas 28883-28905 y JAMÁS incluye el span .vgl-adh — solo refrescarCuentas() lo agrega, en una vuelta posterior con la MISMA signature; y (2) dentro de refrescarCuentas(), la línea `if (!p) { if (cd) cd.remove(); continue; }` hace 'continue' en cuanto countdownParts(a) da null — y countdownParts da null exactamente para 'En sala' y 'Atendido' — saltándose por completo el bloque que calcula y pinta adhN unas líneas más abajo. Como cualquier cambio de estado dispara un repintado completo (signatureOf incluye a.estado) que arma una tarjeta fresca sin el badge, y ese repintado completo es PRECISAMENTE el que ocurre al pasar a 'En sala'/'Atendido', el badge queda inalcanzable todo el tiempo que el paciente esté en esos dos estados — es decir, todo el tiempo que el médico lo tiene delante. El dato (_noShowPrevia) sigue siendo correcto en el historial; solo deja de mostrarse justo cuando serviría.

<details><summary>Evidencia de la reproducción</summary>

```
Script: /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/t7_adh_fix.js (tarjeta artesanal con querySelector de semántica real -- null cuando el elemento no existe -- para no depender del stub genérico del arnés, que fabrica un nodo con solo consultarlo). Historial sembrado: {"111":{"total":3,"ultima":"<ayer>"}}, S.adherencia=true. Salida LITERAL:

=== FASE 1: paciente 'Sin presentarse' (countdown activo, rest=4) ===
  .vgl-cd: true en 4:00
  .vgl-adh: true ⚠ 3

=== FASE 3: caso real -- render() reconstruye la tarjeta (signatureOf incluye a.estado) ===
  tarjeta fresca (equivale al card.innerHTML que arma render()): .vgl-adh ya existe? false
  tras un tick de refrescarCuentas con 'En sala' sobre la tarjeta fresca: .vgl-adh existe? false
  tras un tick con 'Atendido': .vgl-adh existe? false
  dato real en el historial (_noShowPrevia): 3 <- el dato SIGUE ahi, solo el badge nunca se pinta
```

</details>

**Arreglo propuesto.** Sacar el bloque de adhN/adhEl (líneas ~28964-28977) de DESPUÉS del `continue` de la línea 28943: calcularlo y aplicarlo ANTES del `if (!p) {...continue;}`, o en una sección separada del bucle que corra siempre, independiente de si countdownParts dio null. Además, para que el badge aparezca desde el primer pintado (no solo en la vuelta siguiente), agregar el mismo span .vgl-adh también en la plantilla HTML de render() (líneas 28883-28905) cuando S.adherencia && _noShowPreviaEn(...)>0, igual que ya se hace con countdown(a).

---

## 32. `_festivosAvisarSiVencida` — MEDIA · bug

**Si el kill-switch está activo justo al arrancar, el aviso diario de discrepancia en festivos se marca como 'ya mostrado hoy' aunque NUNCA se pintó, y no se repite el resto del día ni siquiera después de que el kill-switch se desactive**

- **Línea:** `30361`
- **Cruce estado × acción:** kill-switch ENCENDIDO en el instante del arranque (boot llama a _festivosAvisarSiVencida() en la línea 30388, ANTES de la comprobación del kill-switch en la línea ~30400, así que corre incluso cuando boot() va a abortar) x discrepancia real festivos-tabla-vs-cálculo x primera vez del día
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Un festivo mal calculado mueve una fecha real de toma de laboratorio ("Un festivo equivocado mueve una fecha de toma: confirme cuál es el correcto antes de agendar en esos días", según el propio texto del aviso). Si el kill-switch remoto coincidió con el primer arranque del día — exactamente la situación en la que el consultorio quiere máxima cautela — este aviso de seguridad queda consumido en silencio y el médico no lo ve NUNCA ese día, ni siquiera si el kill-switch se levanta minutos después y el asistente vuelve a funcionar con normalidad.

<details><summary>Evidencia de la reproducción</summary>

```
Salida LITERAL de node contra el arnés real (tests/harness.js), llamando a api.boot() de verdad (mismo camino que producción):
anio de prueba: 2026 (si es 2024 la prueba no aplica)
festivo sintetico agregado a FESTIVOS: 2026-07-13 ok= true
state.killed tras boot(): true
Existe #vgl-toasts tras el boot con kill-switch activo? false
Bandera 'vgl_festivos_aviso' tras el boot MATADO: 2026-09-01
Segunda llamada (mismo dia, ya sin kill-switch, con #vgl-toasts real) devuelve: true
Hijos dentro de #vgl-toasts despues de la 2a llamada: 0
BUG CONFIRMADO: el aviso de festivos quedo consumido por un arranque MATADO (nunca se pinto, #vgl-toasts no existia) y no se repite el resto del dia aunque el kill-switch se desactive despues y la infraestructura de toasts ya exista.

(boot() en la línea 30419 solo llama a buildOverlay() —que crea #vgl-toasts— DESPUÉS de superar el chequeo del kill-switch; pero _festivosAvisarSiVencida(), en la línea 30388, corre ANTES de ese chequeo, y ya deja escrito localStorage['vgl_festivos_aviso']=hoy antes de que showToast() tenga dónde pintarse)
```

</details>

**Arreglo propuesto.** Mover la llamada a _festivosAvisarSiVencida() en boot() a DESPUÉS de la comprobación del kill-switch (junto a las demás llamadas que ya están condicionadas a !killActivo), o hacer que la función verifique que #vgl-toasts existe (o que !state.killed) antes de escribir la bandera 'vgl_festivos_aviso' — el mismo patrón que ya corrigió L28646 (el aviso de ceguera de agenda) para no marcar 'visto' algo que nunca se mostró.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Verifiqué contra tests/harness.js (api real, sin modificar el repo) que: (1) _festivosAvisarSiVencida() corre antes del chequeo del kill-switch y escribe la bandera 'ya mostrado hoy' antes de que showToast() tenga #vgl-toasts donde pintar — eso es mecánicamente cierto; (2) pero probando contra la tabla FESTIVOS real de producción (sin la inyección sintética que usa la evidencia del hallazgo) para 2024-2028, _festivosAvisarSiVencida() devuelve false en todos los casos: no existe HOY ninguna discrepancia tabla-vs-cálculo que este aviso pudiera estar ocultando — comparé mtrFestivosCO(2025/2026/2027) contra la tabla a mano y coinciden exactamente; (3) aunque existiera la discrepancia, esFestivo() (usada en el cálculo real de fechas hábiles/toma, líneas 18244-18261, 18283, 18645-20708) lee FESTIVOS.has() directamente para 2024-2027, NO depende de que el toast se haya pintado — el aviso es puramente asesor ('confirme cuál es el correcto'), no hay código que bloquee o corrija una fecha a partir de él, así que perder el toast no mueve ninguna fecha real; (4) el escenario disparador (kill-switch activo al primer boot) ya produce un banner rojo fijo y permanente ('Pausa de seguridad remota activa') que le avisa al médico que TODO el asistente está apagado — no es un fallo silencioso sobre una sesión que parece sana; y (5) la recuperación 'automática en minutos' que sugiere el hallazgo no
… (recortado)

</details>

---

## 33. `mtrPedirMedicamentos` — MEDIA · bug

**CargarMedicamentosPaciente (POST) no reintenta ni cae a GM_xmlhttpRequest ante un fallo transitorio de red: le falta el `__idempotent:true` que su función hermana SÍ usa**

- **Línea:** `32890`
- **Cruce estado × acción:** acción: primera llamada de red al abrir el modal de laboratorios/panel de un paciente × estado: red transitoriamente caída (falla en el primer intento, se recupera si hubiera un segundo) × dato: el endpoint de medicamentos usa verbo POST (aunque es una consulta pura) SIN la bandera __idempotent que _pageFetchJsonCore exige para tratarlo como lectura reintentable.
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** _pageFetchJsonCore clasifica cualquier POST sin `__idempotent:true` como ESCRITURA: ante el primer fallo, NO reintenta con backoff (maxRetries=0) y NI SIQUIERA prueba la segunda vía (GM_xmlhttpRequest) — devuelve null de una vez. El endpoint hermano (histórico de frecuencias, GET) SÍ tiene las 3 reintentos + fallback y se recupera del mismo hipo de red. Resultado: un solo blip transitorio de wifi de consultorio apaga TODO el motor de seguridad farmacológica del paciente (avisos de dosis renal + las 20 interacciones), mientras que la frecuencia — un dato secundario — sobrevive el mismo blip. El médico ve 'no se pudo leer qué medicamentos toma' con más frecuencia de la que la red real lo justifica, y de forma inconsistente entre visitas del mismo paciente.

<details><summary>Evidencia de la reproducción</summary>

```
=== mtrPedirMedicamentos (POST, CargarMedicamentosPaciente) ===
resultado: null  | llamadas de red a este endpoint: []

=== mtrPedirHistoricoMedicamentos (GET, HistoricoMedicamentoHCM) ===
resultado: []  | llamadas de red a este endpoint: [ 2 ]

(mismo mock gmxhr para ambos: el primer intento SIEMPRE falla con onerror, el segundo responde 200. El GET hizo 2 llamadas y se recuperó; el POST hizo 0 llamadas a GM_xmlhttpRequest y devolvió null de inmediato -- confirma que _pageFetchJsonCore corta la vía de reintento/fallback para este POST por faltarle __idempotent.)
(node /tmp/.../repro_post_sin_reintento.js, con fetch forzado a fallar y gmxhr instrumentado por URL, contra tests/harness.js -> api.mtrPedirMedicamentos / api.mtrPedirHistoricoMedicamentos)
```

</details>

**Arreglo propuesto.** Agregar `__idempotent: true` a la llamada `pageFetchJson(MTR_RUTA_MEDICAMENTOS, {...})` en mtrPedirMedicamentos (línea ~32890-32894), exactamente como ya hace `apiAccesoBuscarCitasDisponibles` (líneas 18613 y 18628) para su propio POST de solo lectura.

---

## 34. `mtrEvaluarErc` — MEDIA · bug

**estadioParaDosis elige el estadio MEJOR (no el peor) cuando el Cockcroft-Gault administrativo es más grave que el CKD-EPI clínico — lo contrario de la regla 'las dosis siguen al peor' que declara el propio comentario de cabecera del bloque**

- **Línea:** `35456`
- **Cruce estado × acción:** DATO: peso muy bajo / sarcopenia (el escenario que el propio comentario del bloque cita como disparador real de la discrepancia CG vs CKD-EPI) -> Cockcroft-Gault sale en un estadio más grave que CKD-EPI
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El comentario de cabecera del bloque (junto a mtrPosEstadio, ~línea 35288) dice textualmente: 'Cuando discrepan, la discrepancia se DECLARA... y las dosis siguen al peor.' El código de estadioParaDosis solo cubre EXPLÍCITAMENTE el caso en que el clínico es peor (`posClinico > posAdmin`); en cualquier otro caso —incluido cuando el ADMINISTRATIVO es el peor, que es justo el caso de peso muy bajo/sarcopenia que el propio mensaje de discordancia menciona como ejemplo real— el `||` de repliegue devuelve estadioClinico (el MEJOR), no estadioAdmin (el PEOR). Verificado con el arnés: G4 administrativo + G3a clínico produce estadioParaDosis='G3a', el estadio MENOS grave. Hoy este campo no lo consume ningún otro sitio del script (grep completo del archivo: 'estadioParaDosis' solo aparece en su propia línea de cálculo y en la línea donde se agrega al objeto de retorno de mtrEvaluarErc, línea 38901 lo llama pero nadie lee después `.estadioParaDosis`), así que hoy no cambia ninguna decisión visible para el médico — pero es un campo con nombre y contrato ('el estadio para decidir la dosis') que ya miente sobre lo que calcula, listo para que una función futura (u otro agente) lo conecte confiando en su nombre y herede la inversión exactamente en la población que el propio código identifica como la de mayor riesgo de discrepancia.

<details><summary>Evidencia de la reproducción</summary>

```
crcl (administrativo, Cockcroft-Gault): 25.3 -> estadio G4
egfr (clinico, CKD-EPI): 51.4 -> estadio G3a
estadioParaDosis que usa el resto del motor para ajustar dosis: G3a

discordancia: {"diferenciaEstadios":2,"hayDiscrepancia":true,"esAlerta":true,"estadioCg":"G4","estadioCkd":"G3a","mensaje":"ALERTA CLÍNICA: Discrepancia significativa (2 estadios) entre Cockcroft-Gault (G4: 25.29 mL/min) y CKD-EPI (G3a: 51.43 mL/min/1.73m2). Suele pasar con peso muy alto o muy bajo: verifique el peso antes de decidir dosis."}
```

</details>

**Arreglo propuesto.** Comparar los DOS estadios por posición y quedarse siempre con el de mayor pos (peor), por ejemplo: `const peor = posAdmin >= posClinico ? estadioAdmin : estadioClinico` (con las guardas de null/−1 que ya usa el resto de la función), en vez del `||` de repliegue actual que solo funciona cuando el clínico es el peor.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El defecto de código es real y lo verifiqué en Chromium/Node con el arnés: en vigilante_agenda.user.js:35474, `estadioParaDosis = (posClinico > posAdmin && posClinico >= 0) ? estadioClinico : (estadioClinico || estadioAdmin)` efectivamente devuelve el estadio MEJOR (clínico) cuando el administrativo es peor. Lo reproduje con `mtrEvaluarErc({edad:60, sexo:'F', pesoKg:30, creatinina:1.2})` -> crcl G4 (23.6), egfr G3a (51.8), estadioParaDosis:'G3a' (el mejor), contradiciendo el comentario "las dosis siguen al peor" (línea 35306). Y confirmé el gap de test: `tests/suite_45_riesgo_cv.js:897-902` solo prueba el caso peso-alto (clínico peor o igual), nunca el caso peso-bajo/sarcopenia que el propio hallazgo cita.

Pero el camino de clic-a-daño no existe hoy. Hice `grep -n "estadioParaDosis" vigilante_agenda.user.js` sobre las 42269 líneas del archivo completo: la cadena aparece ÚNICAMENTE en las dos líneas donde se calcula (35474) y se agrega al objeto de retorno (35481). Ningún otro punto del script la lee — ni con notación de punto, ni por spread, ni por Object.keys. En particular:
- El HTML que el médico ve (líneas 39277-39283, panel de riesgo/ERC) pinta `erc.estadioAdministrativo` y `erc.estadioClinico` POR SEPARADO con etiquetas explícitas ("Administrativo (Cockcroft-Gault)" / "Clínico (CKD-EPI)"), más un aviso textual de discrepancia ("Las dos fórmulas difieren... veri
… (recortado)

</details>

---

## 35. `_vglVigilarTextoLibre / _vglNotarTextoLibre` — MEDIA · bug

**El guardián dataset.vglVigilado (por ELEMENTO del DOM, no por paciente) hace que la primera edición real de un paciente nuevo no invalide el resumen en caché, si Angular reutiliza el mismo <textarea>**

- **Línea:** `38381`
- **Cruce estado × acción:** paciente A abre la historia (tick de 'historia' registra el vigilante sobre la <textarea name=UltimaEnfermedad> y siembra _vglTextoPrevio['docA|enfermedad_actual']) → el médico cambia al paciente B EN LA MISMA SESIÓN sin recargar la pantalla (Angular reescribe .value del MISMO nodo) → el siguiente tick llama _vglVigilarTextoLibre('docB'), pero el guard 'el.dataset.vglVigilado==="1"' salta TODO el bloque (ni vuelve a sembrar la clave para docB, ni sabe que cambió de dueño) → el médico ESCRIBE algo nuevo y real en esa casilla (su primera edición para el paciente B) y sale (blur): _vglNotarTextoLibre('docB', 'enfermedad_actual', ...) encuentra 'antes===undefined' (nunca se sembró) y por diseño trata eso como 'primera vista', así que NO llama a mtrCacheResumenBorrar().
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El resumen clínico en caché (riesgo CV, discrepancias del reconciliador de 5 fuentes, lo que alimenta el Redactor IA vía mtrIaClickDelegado→mtrCacheResumenLeer) puede quedar sin refrescar justo tras el primer cambio real que el médico hace en la Enfermedad Actual/Análisis y Plan/Recomendaciones de un paciente nuevo — silenciosamente, sin ningún aviso. Solo una SEGUNDA edición de esa misma casilla vuelve a detectar cambios con normalidad.

<details><summary>Evidencia de la reproducción</summary>

```
node repro_vigilar5.js (usa el arnés real, extractPacienteAbierto() SIN mockear — lee el DOM simulado de verdad):
=== Paso 0 ===
extractPacienteAbierto() ahora mismo: 111111
=== Paso 1: PAC_A abre 'historia' ===
vglVigilado: 1 | listeners blur: 1
=== Paso 2: cambia a PAC_B (222222), Angular reutiliza <textarea> y .text-muted ===
extractPacienteAbierto() ahora mismo: 222222
vglVigilado sigue en: 1 (si sigue '1', NO se re-sembro para 222222)
listeners blur (deberia seguir siendo 1, no 2): 1
=== Paso 3: el medico EDITA la casilla de PAC_B (primer cambio REAL) ===
RESULTADO: la edicion real del medico sobre PAC_B invalido el resumen en cache? false

(Nota de honestidad: la reproducción prueba el mecanismo exacto del código con un DOM simulado que reutiliza el mismo nodo <textarea> entre pacientes. No pude verificar contra Everest real si Angular efectivamente reutiliza ese nodo al navegar entre historias distintas — el código no tiene ninguna guarda que lo descarte, y el propio archivo documenta [línea ~38487] que 'Angular conserva el estado' al cambiar de pestaña dentro de un mismo paciente, y varios hallazgos YA blindados en este proyecto —L22392, L23432— son justo la misma familia de bug: DOM/caché que sobrevive a un cambio de paciente sin que el código lo note.)
```

</details>

**Arreglo propuesto.** Guardar el vgl-doc del paciente en el propio dataset del elemento (p. ej. el.dataset.vglVigiladoDoc = docId) y comparar contra el docId actual en cada tick; si cambió, volver a sembrar _vglTextoPrevio para la clave nueva (sin re-añadir un segundo listener de blur).

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. Tracé el camino completo desde el guard roto hasta cada consumidor real del texto libre, y el "daño clínico" que el hallazgo describe no ocurre, aunque el defecto de bookkeeping (`dataset.vglVigilado` por elemento, nunca reseteado al cambiar de paciente) sí es real en el código.

**1) La premisa central no está probada y es dudosa.** El propio autor admite no haber verificado contra Everest real que Angular reutilice el MISMO nodo `<textarea>` entre dos pacientes DISTINTOS (rutas/expedientes distintos). Lo único que el archivo documenta es persistencia de estado al cambiar de PESTAÑA dentro de UN MISMO paciente (línea ~38487), un escenario muy distinto de "abrir la historia de otro paciente". Los dos hallazgos citados como "misma familia" (L22392, L23432) no son casos de reutilización de nodo DOM entre pacientes: L22392 es un bug de severidad en `mtrEstadoPuntoMedicamentos` (punto verde sobre avisos CRITICAL) y L23432 es el botón "✕/Escape" que no llamaba a `alContinuar`. Citarlos como precedente de la misma familia es un argumento de autoridad sin sustento real.

**2) Aun concediendo la premisa, seguí el dato hasta cada consumidor real y ninguno depende de la caché que el vigilante deja de invalidar:**
- El "Redactor IA" (botón «Generar», línea ~40098-40134) construye `contextoLibre` con `libreAhora().combinado` (closure que llama a `mtrLeerTextoLibreHistoria`, línea
… (recortado)

</details>

---

## 36. `_esUroComponenteAlterado` — MEDIA · clinico

**El hallazgo más grave posible de un componente del uroanálisis ("INCONTABLES"/"INNUMERABLES"/"CAMPO CUBIERTO") no se reconoce como alterado, así que ni la fila de la tabla general de Laboratorios ni el ítem del componente se resaltan en rojo**

- **Línea:** `1572`
- **Cruce estado × acción:** Leucocitos/Hematíes del uroanálisis con resultado textual 'INCONTABLES'/'INNUMERABLES'/'CAMPO CUBIERTO' (piuria/hematuria masiva -- el propio proyecto ya reconoce estos tres términos como severidad máxima en otra función del mismo archivo, mtrCantidadCruces ~L40507/40534) x el único componente alterado del grupo es justo ese
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Esta función decide DOS resaltados rojos que el médico usa para escanear la tabla de un vistazo: (1) `esAlerta` en el modal general de Laboratorios (línea ~21161-21163: `lab.__vglGrupoUroComponentes.some((c) => _esUroComponenteAlterado(c))`, SIN ningún respaldo del motor clínico más completo `mtrEvaluarUroanalisis`), y (2) la clase `.alert` de cada ítem individual dentro del acordeón (`renderUroItem`, línea 21184). Un resultado numérico como '6' (leucocitos >5) SÍ se detecta, pero el resultado cualitativo más grave que puede traer un parcial de orina -leucocitos o hematíes 'incontables'/'innumerables'/'campo cubierto', piuria o hematuria masiva- pasa como NORMAL para esta función: `parseFloat('incontables')` es NaN y ninguna de las palabras clave (`positivo/anormal/abundante/moderad/patologico/+`) la cubre. Si ese es el único hallazgo alterado del grupo, la fila entera del Uroanálisis en la tabla general de Laboratorios queda SIN el resaltado rojo que distingue lo normal de lo patológico.

<details><summary>Evidencia de la reproducción</summary>

```
_esUroComponenteAlterado por caso:
  nombre="Leucocitos" resultado="INCONTABLES" -> alterado=false
  nombre="Leucocitos" resultado="Incontables" -> alterado=false
  nombre="Hematies" resultado="INNUMERABLES" -> alterado=false
  nombre="Leucocitos" resultado="CAMPO CUBIERTO" -> alterado=false
  nombre="Leucocitos" resultado="6" -> alterado=true
  nombre="Leucocitos" resultado="3" -> alterado=false

¿Algun componente activa 'alterado' (lo que decide esAlerta de la fila en la tabla general)? false
-> Si es false, la fila del Uroanalisis en la tabla general de Laboratorios NO se resalta en rojo (.vgl-labs-alert)
   aunque el paciente tenga leucocitos INCONTABLES en la orina (piuria masiva).
```

</details>

**Arreglo propuesto.** Añadir el mismo léxico de severidad máxima que el proyecto ya usa en otra función del archivo (línea ~40507: `/^(INCONTABLES?|INNUMERABLES?|CAMPO CUBIERTO|MUY ABUNDANTES?)$/`) a la lista de palabras clave de `_esUroComponenteAlterado`, o mejor, reemplazar esa lista de palabras por una llamada a la función de severidad ya existente y probada (evita mantener dos catálogos de "qué es grave" que pueden divergir, como ya divergieron aquí).

---

## 37. `isPending` — MEDIA · clinico

**El descarte "barato" por longitud mide la cadena SIN recortar: una actividad pendiente con espacios de más queda invisible en el panel**

- **Línea:** `9083`
- **Cruce estado × acción:** dato: celda del Excel con relleno de espacios/tabs alrededor de un valor legítimo ("tamizar con ccu" con relleno) x guarda de rendimiento que compara `s.length` (sin trim) contra el límite de 32
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El comentario de la propia función dice la intención correcta ("primero los descartes baratos... y solo después se normaliza la cadena"), pero el descarte por longitud se aplica sobre la cadena CRUDA, no sobre la recortada: un valor real y pendiente ("Tamizar con CCU", 15 caracteres útiles) puede superar el límite de 32 solo por espacios o saltos de línea sobrantes en la celda —algo que ocurre con relleno manual, pegado desde otra celda o Alt+Enter repetidos en Excel— y la función lo descarta en silencio como si no existiera. La actividad de tamizaje nunca entra al índice de PyM: no aparece en el panel, no dispara el aviso al abrir la historia, y el médico no tiene ninguna pista de que existía.

<details><summary>Evidencia de la reproducción</summary>

```
valor (JSON): "   tamizar con ccu                    " longitud sin recortar: 38 longitud recortada: 15
isPending(conPadding) = false
isPending(conPadding.trim()) = true
```

</details>

**Arreglo propuesto.** Recortar `s` antes de medir la longitud (o subir el límite lo suficiente para absorber relleno razonable y recortar ANTES de comparar), para que el descarte rápido no dependa de espacios en blanco que no aportan información clínica.

---

## 38. `mtrHcTachar` — MEDIA · clinico

**Los digitos de telefono/celular/identificacion del paciente se tachan sin limite de digito: pueden corromper un numero clinico NO relacionado que los contenga como subcadena**

- **Línea:** `41144`
- **Cruce estado × acción:** dato: numero de telefono/cedula del paciente que coincide por subcadena con otro numero mas largo del texto libre (numero de orden, codigo de laboratorio) x accion: mtrHcTachar aplicado al texto libre antes de mandarlo a la IA
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** mtrHcTachaduras incluye 'celular'/'telefono'/'identificacion' (todo NUMERICO) en la lista de cadenas a tachar, con el mismo mecanismo de mtrHcTachar que v18.0.25 blindo para NOMBRES con limite de PALABRA usando MTR_LETRA_ES (letras). Pero MTR_LETRA_ES son letras, no digitos: un numero de telefono/cedula del paciente que aparezca como subcadena DENTRO de un numero mas largo (un numero de orden, un codigo de barras de laboratorio, una referencia) se tacha igual, partiendo ese numero en dos con '[CENSURADO]' en medio. Ese texto es justo el que se manda a la hoja de hechos que lee la IA (mtrHcTextoParaHoja / mtrHechosDesdeHcEverest) para redactar: un numero clinico legitimo (una orden, un resultado) puede llegar corrompido al grounding de la IA sin que nadie se entere.

<details><summary>Evidencia de la reproducción</summary>

```
Salida literal de node /tmp/.../repro_tachar_digitos.js:

tachaduras generadas: ["3001234567","PACIENTE"]

texto ORIGINAL: Se registra el numero de orden 930012345678 en el sistema de laboratorio para seguimiento.
texto TACHADO : Se registra el numero de orden 9[CENSURADO]8 en el sistema de laboratorio para seguimiento.

*** CONFIRMADO: un numero de orden clinico no relacionado con el paciente quedo corrompido con [CENSURADO] porque contenia el celular como subcadena. ***
```

</details>

**Arreglo propuesto.** Para las cadenas puramente numericas de la lista de tachaduras (celular/telefono/identificacion), usar limite de DIGITO en vez de limite de LETRA en la expresion regular de mtrHcTachar (o un patron distinto segun si `x` es numerico o alfabetico) -- lookaround `(?<!\d)...(?!\d)` para los numeros, dejando el actual `(?<![letras])...(?![letras])` solo para nombres.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

MECÁNICA CONFIRMADA, pero el "camino completo" no aguanta.

Confirmé con el arnés (mtrHcTachaduras + mtrHcTachar reales) que el regex de mtrHcTachar usa `(?<![MTR_LETRA_ES])...(?![MTR_LETRA_ES])` — un límite de PALABRA basado en letras españolas, que en efecto NO protege contra adyacencia de dígitos. El repro de la evidencia se reproduce tal cual: celular "3001234567" dentro de "930012345678" → "9[CENSURADO]8". Hasta ahí, el hallazgo no miente sobre el mecanismo.

Pero el propio historial del proyecto (INFORME_MUTACIONES.md, entradas v18.0.15 y v18.0.25) documenta que este límite de palabra se diseñó y decidió EXPRESAMENTE por el médico para NOMBRES ("Solo palabras completas, y mínimo 4 letras"), y declara por escrito: "Lo que tiene FORMA —cédula, celular, correo, fechas— lo sigue tachando scrubPII aparte" (línea 41412-41413 del código y línea 7195 del informe). Es decir: identificación/celular/teléfono en `mtrHcTachaduras` es una capa de defensa en profundidad SECUNDARIA; el mecanismo primario contra fuga de cédula/celular es `scrubPII` (por patrón), que corre DESPUÉS en `mtrHcValorLimpio` y no depende de este límite de palabra.

Trazando clic→daño con datos realistas (probé con el arnés: orden de laboratorio "452871", código de barras "7702001987654", dosis "500 mg cada 8 horas") — NINGUNO se corrompe. El único caso que dispara el bug es el de la evidencia, CONSTRUIDO A PROPÓ
… (recortado)

</details>

---

## 39. `safeReadJSON` — MEDIA · consulta

**Una clave de localStorage corrupta (p. ej. `vgl_cfg`) se pone en cuarentena en silencio y NUNCA se repara sola: los ajustes del médico vuelven a fábrica sin ningún aviso, sesión tras sesión**

- **Línea:** `8065`
- **Cruce estado × acción:** almacenamiento local corrupto/parcial (escritura cortada por cierre abrupto del navegador o disco lleno) + instalación YA establecida (todas las migraciones de una-sola-vez ya aplicadas, caso real de cualquier consultorio en producción) + primera carga del día y repeticiones siguientes
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Si `vgl_cfg` queda corrupto (JSON parcial), `safeReadJSON` lo detecta, hace una copia de respaldo en una clave `vgl_quarantine_...` y devuelve `{}` como si NUNCA hubiera existido configuración — sin console.warn, sin toast, sin ninguna señal visible. El objeto `S` se arma en el arranque del script con los valores de FÁBRICA (tamaño de letra, exclusión de PyM, plantillas de SMS, atheneaAutoLogin, etc.) y el `vgl_cfg` roto en localStorage NUNCA se reescribe con un valor sano — solo se cura si el médico abre Ajustes y guarda algo. En una instalación ya madura (todas las migraciones `vgl_v73`/`vgl_v142_notif`/`vgl_v154_notif`/`vgl_v1420_estreno` ya marcadas como aplicadas, que es el estado real de cualquier consultorio en producción) NINGUNA de ellas dispara una reescritura, así que el ajuste 'tamanoLetra: muygrande' de un médico con baja visión, o su lista de PyM excluidos, desaparece sin explicación y sin que nada en pantalla lo diga.

<details><summary>Evidencia de la reproducción</summary>

```
--- Carga 1 (arranque de la manana) ---
S.tamanoLetra: normal (el medico habia puesto 'muygrande' por baja vision)
claves de cuarentena tras carga 1: 1
vgl_cfg en localStorage sigue roto? SI, sigue el mismo string corrupto

(Reproducido con tests/harness.js: almacen = {vgl_cfg: '{"tamanoLetra":"muygrande",...' (JSON truncado), vgl_v73:'1', vgl_v142_notif:'1', vgl_v154_notif:'1', vgl_v1420_estreno:'1' — es decir, TODAS las migraciones de una-sola-vez ya aplicadas, el estado real de un consultorio en producción. `cargar()` real del userscript.)
```

</details>

**Arreglo propuesto.** Cuando `safeReadJSON` cae en el catch para una clave conocida como `vgl_cfg`/`SETTINGS_KEY`, además de poner en cuarentena el valor viejo, escribir explícitamente el default sano de vuelta a esa clave (autorreparación, igual que ya hace `getProcessedToday` con `PROC_KEY`) y avisar una vez con un toast AZUL/AMBAR ('Se reinició su configuración: el navegador tenía datos dañados') para que el médico sepa que debe revisar Ajustes, en vez de descubrirlo por accidente semanas después.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

La reproducción con tests/harness.js confirma el mecanismo técnico exacto (vgl_cfg corrupto queda en cuarentena silenciosa y S vuelve a DEFAULTS en cada carga, sin que ninguna migración ya aplicada lo repare, hasta que el médico guarde Ajustes manualmente). Pero el hallazgo falla el criterio de refutación por dos vías: (1) No hay clic real que dispare la corrupción — el disparador es un fallo externo de almacenamiento (cierre abrupto/disco lleno) que deja intacta el resto del almacén pero trunca solo vgl_cfg, un modo de fallo poco plausible para los backends atómicos de localStorage (LevelDB/SQLite) y sin ningún incidente real registrado en CHANGELOG.md — es un escenario sintético inyectado a mano en el arnés, no algo que un médico provoque con una acción. (2) Aun aceptando la corrupción, el daño mostrado en la propia evidencia es cosmético, no clínico: excluir vuelve al default ya prudente (oculta VDRL/sifilis/hepatitis, nunca VIH), smsPlantillaCita/correoCitaUrl vuelven a "" que es el fallback 'honesto' documentado explícitamente en el código (exactamente la regla 'casilla vacía antes que dato inventado' de CLAUDE.md funcionando como se pidió), atheneaAutoLogin vuelve a su propio valor de fábrica sin efecto sin credenciales, y el único efecto negativo verificado (tamanoLetra a 'normal') es una molestia de accesibilidad de la UI del propio asistente, no un error clínico sobre 
… (recortado)

</details>

---

## 40. `_vglAlternarAltoContraste` — MEDIA · consulta

**Alto Contraste (botón de un clic) fija el zoom del panel principal en 1.12 sin mirar la letra que el médico ya eligió en Ajustes: con 'letra muy grande' (1.28) activo, encender Alto Contraste ENCOGE el panel, mientras otras superficies del propio asistente (botón de Conducta, panel post-cita, modales) se quedan en 1.28 — dos tamaños de letra distintos a la vista en el mismo asistente**

- **Línea:** `27194`
- **Cruce estado × acción:** letra 'grande'/'muy grande' (S.tamanoLetra, elegida en Ajustes) x Alto Contraste activado con el botón de un clic de la cabecera (sin pasar por Ajustes) x elementos del script FUERA de #vgl-root (#vgl-cw-ordenar-btn, #vgl-postcita-panel, modales .vgl-agm-card, etc., que sí figuran en VGL_FZ_OBJETIVOS pero nunca en el bucle de _vglAlternarAltoContraste)
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El propio motivo por el que un médico activa 'letra muy grande' es ver mejor; si además necesita Alto Contraste (fatiga visual, luz de consultorio), el panel principal del asistente se le vuelve MÁS PEQUEÑO que el resto de sus propios botones y modales (Conducta, panel post-cita, modales de agendar/ordenar), en vez de mantenerse igual de grande — justo lo opuesto de lo que ambas opciones de accesibilidad prometen, y una inconsistencia visual notoria en medio de la consulta.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_zoom_hc.js
=== Paso 1: tamanoLetra = muygrande ===
¿incluye #vgl-root? true
¿incluye #vgl-cw-ordenar-btn? true
¿incluye #vgl-postcita-panel? true
zoom declarado en la hoja: 1.28

=== Paso 2: se activa Alto Contraste (sin pasar por Ajustes) ===
root.style.zoom (INLINE, gana a la hoja de estilo): "1.12"
root.classList tiene vgl-hc: true
La hoja vgl-fz-style (tamanoLetra) SIGUE diciendo zoom:1.28 para #vgl-cw-ordenar-btn y #vgl-postcita-panel:
 -> true
¿esos dos elementos tienen alguna vez la clase vgl-hc puesta? false false

=== CONCLUSION ===
Con tamanoLetra=muygrande + Alto Contraste activo en la MISMA sesion:
  #vgl-root (panel principal) queda en zoom 1.12 (mas PEQUEÑO que 1.28: RETROCESO de tamaño de letra)
  #vgl-cw-ordenar-btn / #vgl-postcita-panel (otras superficies del script) siguen en zoom 1.28 via la hoja de estilo,
  porque _vglAlternarAltoContraste() nunca las toca -- ni con estilo inline ni con la clase vgl-hc.
  Resultado: dos tamaños de letra distintos, a la vista, dentro del MISMO asistente, mientras Alto Contraste está activo.

(script en /tmp/claude-0/-home-user-vigilante-agenda-everest/33cae556-800d-5ea7-8480-6f35af5aa52c/scratchpad/repro_zoom_hc.js, cargado con tests/harness.js real; api.aplicarTamanoLetra() y api._vglAlternarAltoContraste() son funciones reales del script, sin mockear).
```

</details>

**Arreglo propuesto.** En vez de un '1.12' fijo, calcular el zoom de Alto Contraste como Math.max(1.12, _fzZoomDe(S.tamanoLetra) || 1) para que nunca reduzca lo que el médico ya eligió; y/o extender el bucle de _vglAlternarAltoContraste (hoy solo vgl-dock/vgl-acciones-dock/vgl-toasts/vgl-pym-banner) para que cubra los mismos selectores que VGL_FZ_OBJETIVOS, de modo que todas las superficies del script escalen juntas.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. Verifiqué el mecanismo leyendo el código real (no el repro aportado, que no existe en esta sesión) y el hallazgo es técnicamente correcto en su descripción del bug, pero el "daño al médico" que vende es cosmético, no clínico, y una de las dos pruebas que usa para "destaparlo" ni siquiera es visible para un médico real en consulta.

CAMINO REAL VERIFICADO (clic a clic):
1. Ajustes → tamaño de letra "muy grande" → `aplicarTamanoLetra()` (línea 8505) escribe una hoja `#vgl-fz-style` con `VGL_FZ_OBJETIVOS{zoom:1.28}` (línea 8489-8514), lista que sí incluye `#vgl-root`, `#vgl-postcita-panel` y `#vgl-cw-ordenar-btn`.
2. Clic en el botón "Alto Contraste" de la cabecera (`#vgl-tl-hc`, wireado sin confirmación en línea 17948) → `_vglAlternarAltoContraste()` (línea 27194).
3. Confirmado en el código: esa función solo hace dos cosas — (a) `raiz.style.zoom = "1.12"` INLINE, y solo sobre `#vgl-root` (nada más recibe zoom inline, ni siquiera vgl-dock/vgl-acciones-dock/vgl-toasts/vgl-pym-banner, cuya clase `.vgl-hc` en CSS —línea 15155— solo toca `background`/`backdrop-filter`, nunca `zoom`); (b) alterna la clase `.vgl-hc` (fondo sólido, sin blur) en esos 5 ids. `#vgl-postcita-panel` y `#vgl-cw-ordenar-btn` quedan, en efecto, en 1.28 vía la hoja de tamaño de letra. El mecanismo que describe el hallazgo es real.

POR QUÉ NO LLEGA A DAÑO CLÍNICO:
- El propio hallazgo detiene la cadena
… (recortado)

</details>

---

## 41. `injectLabsIntoCronicos / _casillasObligatoriasVacias` — MEDIA · muerto

**El aviso de 'casillas obligatorias vacías' (según la propia tabla oficial de Everest) se calcula en cada clic de Auto-Labs pero ningún llamador del archivo lo lee jamás**

- **Línea:** `3779`
- **Cruce estado × acción:** acción = clic en Auto-Labs (primera vez y repetición) x dato = tabla oficial con swRequerido:true y casilla vacía en el DOM — en TODOS los casos, el resultado se calcula bien pero nunca sale a pantalla
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** _casillasObligatoriasVacias (línea 4051, comentario v14.2.0 'T4: detecta casillas OBLIGATORIAS... que existen en el DOM pero están vacías') funciona correctamente — lo confirmé ejecutándola end-to-end. injectLabsIntoCronicos la llama en su línea 3779 y la incluye en el objeto que devuelve (r.obligatoriasVacias). Pero un grep de 'obligatoriasVacias' sobre todo el archivo (40 000+ líneas) muestra que SOLO aparece en la propia definición de injectLabsIntoCronicos (líneas 3296, 3299, 3310, 3313, 3779-3780) y en la función auxiliar (línea 4051): ningún llamador — ni el camino principal de Exámenes (línea 6761, 'const r = injectLabsIntoCronicos(...)') ni el de reintento tras auto-login (línea 6880, 'const r2 = ...') — lee jamás r.obligatoriasVacias ni r2.obligatoriasVacias. El médico pulsa Auto-Labs, Everest declara un examen como obligatorio (swRequerido) y la casilla queda vacía, el propio motor lo detecta con datos reales, y esa información se calcula y se tira a la basura en cada clic: la funcionalidad que el comentario T4 prometía ('detecta... que están vacías al momento de la consulta') nunca llegó a avisarle nada al médico.

<details><summary>Evidencia de la reproducción</summary>

```
node repro3_obligatoriasvacias.js (con una casilla resultadoHemoglobina vacía en el DOM y una fila oficial HEMOGLOBINA con swRequerido:true):
=== injectLabsIntoCronicos con Hemoglobina obligatoria y vacia en el DOM ===
r.obligatoriasVacias: [{"codigoExamen":"HEMOGLOBINA","key":"HEMOGLOBINA","nombre":"HEMOGLOBINA","resultId":"resultadoHemoglobina"}]

Grep 'obligatoriasVacias' sobre vigilante_agenda.user.js completo -> únicas 6 apariciones, TODAS dentro de la propia función injectLabsIntoCronicos/_casillasObligatoriasVacias (líneas 3296, 3299, 3310, 3313, 3779, 3780, 4051); ninguna en los dos sitios donde se llama a injectLabsIntoCronicos (líneas 6761 y 6880) ni en ningún otro lugar del archivo.
```

</details>

**Arreglo propuesto.** En los dos llamadores de injectLabsIntoCronicos (líneas ~6761 y ~6880), leer r.obligatoriasVacias / r2.obligatoriasVacias y, si trae elementos, mostrar un aviso ámbar (mismo patrón que ya existe para r.sinCasilla y r.implausibles) con los nombres de los exámenes que Everest exige y que siguen vacíos.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

La parte "código muerto" del hallazgo es verificable y CIERTA: leí los dos llamadores (líneas 6768-6867 y 6887-6910) y confirmé que leen r.count, r.respetadas, r.sinCasilla, r.implausibles, r.abortadoPorPaciente, r.abortadoPorKillSwitch y r.desactivadoRemoto, pero jamás r.obligatoriasVacias ni r2.obligatoriasVacias — el grep global de 6 apariciones (todas dentro de la propia función/su definición) es correcto. Eso está confirmado.

Pero el salto a "daño al médico" (que un examen obligatorio quede vacío sin que nadie se entere, con implicación clínica) no está trazado hasta un daño real, por dos razones que el hallazgo no aborda:

1. La propia fuente del dato (`swRequerido` viene del endpoint `GetValidacionExamenCronicos` de EVEREST, no de una regla inventada por el script — ver comentario línea 3849-3853: "Everest publica... una tabla de validación por examen"). Un endpoint que la propia Angular de Everest usa para VALIDAR el formulario de crónicos es, con altísima probabilidad, el mismo que su frontend nativo usa para marcar/exigir esos campos en pantalla (asterisco rojo, bloqueo al guardar) — patrón que el propio archivo documenta en otro campo obligatorio de Everest (línea 19136: "propio front: 'El número de celular es obligatorio...'"). El hallazgo no descarta que Everest, de forma nativa e independiente del userscript, ya le muestre al médico que esa casilla es obligatoria
… (recortado)

</details>

---

## 42. `fetchAtheneaLabs` — MEDIA · rendimiento

**fetchAtheneaLabs no pasa por el seguro anti-doble-disparo (_gmReq) que el propio comentario de v16.7.0 exige para "todas las llamadas a endpoint" vía GM, incluida Athenea por nombre -- dos flujos que piden el mismo laboratorio casi a la vez duplican tráfico real contra un portal que el propio código ya documenta como frágil bajo carga**

- **Línea:** `1845`
- **Cruce estado × acción:** getAtheneaLabsAuto() se llama desde 6 sitios distintos del script (prefetch al abrir la historia, botón Auto-Labs, modal de Laboratorios, panel PyM, etc.) x dos de esos flujos piden LA MISMA solicitud/año casi al mismo tiempo (primera vez del día que se abre la historia y el médico ya hace clic en algo que también dispara la lectura de labs)
- **Reproducido con el arnés:** sí
- **Refutación:** 3 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El propio comentario que precede a `_gmReq` (línea 1943-1948) dice literalmente: 'SEGURO ANTI-DOBLE-DISPARO (orden del médico: "todas las llamadas a endpoint deben tener ese seguro")... esta es la MISMA protección para la vía GM (Athenea, AppCita, SharePoint)'. Todas las demás llamadas GM a Athenea en este mismo archivo (`_atheneaToken`/búsqueda de paciente, líneas 2422-2545) sí pasan por `_gmReq` y sí deduplican. `fetchAtheneaLabs` -la función que trae los RESULTADOS de laboratorio, llamada desde 6 flujos distintos del script para el mismo paciente- llama a `GM_xmlhttpRequest` DIRECTAMENTE (línea 1845), sin ese seguro. Confirmado con el arnés: dos peticiones idénticas simultáneas para la misma solicitud/año generan DOS llamadas reales a Athenea en vez de una. El propio archivo documenta en otro comentario (línea ~2627) que Athenea 'contestó las tres primeras [solicitudes] y se cayó' bajo carga -- este hueco duplica exactamente el tipo de tráfico que ya se sabe que la hace fallar, justo cuando el médico más lo necesita (abriendo la historia).

<details><summary>Evidencia de la reproducción</summary>

```
fetchAtheneaLabs: llamadas REALES a GM_xmlhttpRequest para 2 peticiones IDENTICAS simultaneas = 2
(si estuviera protegida por _gmReq, esperariamos 1; sin proteccion, esperamos 2)
_gmReq: llamadas REALES a GM_xmlhttpRequest para 2 peticiones IDENTICAS simultaneas = 1
```

</details>

**Arreglo propuesto.** Envolver la llamada `GM_xmlhttpRequest` de `fetchAtheneaLabs` (línea 1845) con `_gmReq` igual que las demás llamadas a Athenea del archivo, o mover `_gmReq` (hoy declarada después, línea 1950) antes de `fetchAtheneaLabs` y usarla ahí directamente -- la clave de deduplicación (`method|url|data`) ya funciona para este payload (`{idSolicitud, ano, modulo}` es corto y estable).

---

## 43. `_vglChooserModal` — BAJA · bug

**El selector 'Exámenes'/'Examen normal' (_vglChooserModal) es el único modal del script que NO pasa por _activarAccesibilidadModal: Escape no lo cierra y no atrapa el foco con Tab**

- **Línea:** `6610`
- **Cruce estado × acción:** médico abre el selector de 'Exámenes' o 'Examen normal' -> pulsa Escape para cancelar (patrón establecido en TODOS los demás modales del script) -> no pasa nada, el modal sigue abierto
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** _activarAccesibilidadModal (línea 12375) es el patrón universal del proyecto: instala Escape-para-cerrar y un focus-trap de Tab, y se llama en 9 sitios distintos del script (líneas 12797, 12913, 20992, 22494, 22603, 23526, 25393, 26357, 39313) para cada modal que se crea. _vglChooserModal — usado por los botones de 'Exámenes'/Auto-Labs (línea 6732, que ESCRIBE resultados de laboratorio en la historia) y 'Examen normal' (línea 7760, que LLENA casillas de examen físico/revisión por sistemas) — nunca la llama, ni tampoco sus dos únicos invocadores. En consulta real: el médico que ya se acostumbró a que Escape cierra cualquier cuadro del Vigilante (así funcionan los otros ~9) pulsa Escape aquí y no pasa nada — tiene que encontrar la '✕' o hacer clic fuera; con teclado (Tab) el foco tampoco queda atrapado dentro del modal, así que Tab puede sacarlo hacia el DOM de Everest debajo mientras el selector sigue tapando la pantalla. Pequeño en cada clic, pero repetido muchas veces al día porque estos dos botones se usan en casi toda consulta.

<details><summary>Evidencia de la reproducción</summary>

```
== _vglChooserModal ==
modal.id: vgl-chooser-modal
listeners registrados en el modal: [ 'click' ]
¿tiene listener 'keydown' (Escape)? false
¿tiene focus-trap / listener 'Tab'? (se instalaria junto con keydown en _activarAccesibilidadModal) -> false

== Comparación: mtrReconciliarAhora / otros modales que SI usan _activarAccesibilidadModal ==
typeof _activarAccesibilidadModal: function
modal CON _activarAccesibilidadModal -> listeners: [ 'keydown' ]
(ese sí trae 'keydown', el del chooser NO)
```

</details>

**Arreglo propuesto.** Llamar `_activarAccesibilidadModal(modal, cerrar)` justo antes del `return modal;` en _vglChooserModal (guardando la función de cleanup si se necesita), igual que el resto de los modales del script.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Verifiqué el código y el harness: es CIERTO que _vglChooserModal (línea 6610) nunca llama a _activarAccesibilidadModal — con el arnés (tests/harness.js -> cargar({silencioso:true}).api) confirmé empíricamente que el modal construido solo registra listener 'click', cero 'keydown', y no hay ningún listener global de document que capture Escape para este modal (los tres document.addEventListener("keydown",...) que existen en el script son para Alt+V/Alt+R/Alt+A/Alt+M, para el "sheet" del panel principal, y para el modo programador Ctrl+Shift+D/V — ninguno toca #vgl-chooser-modal). Hasta aquí el hallazgo es técnicamente exacto.

Pero trazando el camino completo clic-a-daño con el CSS y el JS reales, el "daño" se desinfla:

1. El chooser modal SÍ tiene los otros dos canales de cierre estándar del proyecto: el botón '✕' (close.addEventListener) y "clic afuera cierra" (modal.addEventListener("click", e => { if (e.target===modal) cerrar(); })). Comprobé que ESE MISMO patrón de clic-afuera (bgClick con e.target===modal) es el que usan también #vgl-paquete-modal (línea ~20909) y #vgl-labs-modal (línea ~21087) — es decir, "clic afuera" es un hábito tan establecido en el proyecto como Escape, y en el chooser funciona perfecto. El médico que abrió el selector con el mouse (clicó "🧪 Exámenes" o "🩺 Examen normal") tiene la mano ya sobre el mouse; cancelar es un clic en cualquier punto del vel
… (recortado)

</details>

---

## 44. `friendly` — BAJA · bug

**La traducción a etiqueta clínica solo reconoce el encabezado EXACTO o TODO EN MAYÚSCULAS: una variante Título/mixta de "VIH" se muestra sin traducir**

- **Línea:** `9094`
- **Cruce estado × acción:** dato: encabezado de columna con capitalización mixta que no calza ni con la clave exacta del diccionario FRIENDLY ni con su versión toUpperCase()
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** Para las claves con guion bajo (CITA_PF, TAMIZACION_*) el segundo intento en mayúsculas cubre cualquier capitalización porque el diccionario ya las tiene en mayúsculas. Pero "Último VIH"/"Ultimo VIH" están guardadas en el diccionario con una capitalización MIXTA específica (inicial mayúscula + VIH en mayúsculas), así que el segundo intento (que compara contra la versión TODO-MAYÚSCULAS del encabezado) nunca puede calzar con esa clave —"ÚLTIMO VIH" (todo mayúsculas) no es igual a "Último VIH" (mixta)—. Cualquier variante de capitalización del encabezado que no sea exactamente una de esas dos formas guardadas cae al respaldo crudo y el médico ve el encabezado del Excel tal cual ("Último Vih", "Último vih") en vez de la etiqueta clínica limpia "VIH" — justo en la actividad que el propio código señala como la única de ETS que se conserva siempre visible.

<details><summary>Evidencia de la reproducción</summary>

```
friendly('Último VIH') = VIH
friendly('Último Vih') = Último Vih
friendly('ÚLTIMO VIH') = Último vih
friendly('CITA_PF') = Remisión a Planificación Familiar
friendly('Cita_PF') = Remisión a Planificación Familiar
friendly('cita_pf') = Remisión a Planificación Familiar
```

</details>

**Arreglo propuesto.** Comparar también contra una versión normalizada común (p. ej. stripAccents+toUpperCase aplicada TANTO al encabezado entrante COMO a las claves del diccionario al construir un índice auxiliar una sola vez), en vez de depender de que el Excel escriba el encabezado en una de dos formas exactas.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Verificado con el arnés (node + tests/harness.js cargar().api) que friendly('Último Vih')/friendly('ÚLTIMO VIH') efectivamente no calzan con las claves mixtas del diccionario y caen al header crudo — el hecho técnico es real. Pero el hallazgo falla en dos puntos: (1) no hay ningún clic del médico en la cadena causal — el header proviene de un archivo Excel de SharePoint cuya capitalización exacta ("Último VIH"/"Última SOMF") el propio código documenta como "confirmado con captura real" en v7.8.4, contradiciendo la premisa de que pueda llegar con otra capitalización; (2) aunque llegara con otra capitalización, isExcludedActivity() (línea 9147) decide si el chip de VIH se oculta comparando en minúsculas sin acentos, por lo que es inmune al bug de friendly() — el pendiente de VIH NUNCA deja de mostrarse. El peor efecto verificable es que el chip diga "Último Vih" en vez de "VIH", texto igualmente legible y reconocible. No hay ruta hacia cita mal agendada, orden no generada, dato perdido u ocultamiento — es puramente cosmético, no clínico.

</details>

---

## 45. `_acompMostrar` — BAJA · bug

**La burbuja de la guía paso a paso ('modo acompañado') no se reposiciona tras un scroll: se queda pegada a las coordenadas viejas y termina flotando sobre una parte cualquiera de la pantalla de Everest, exactamente lo que su propio comentario de v17.0.3 dice haber corregido para siempre**

- **Línea:** `30218`
- **Cruce estado × acción:** primer tick con el botón objetivo en una posición del viewport x tick posterior (cada 3 vueltas) con el MISMO hint.id pero el botón ya en OTRA posición (p. ej. tras hacer scroll dentro de la Historia Clínica, una acción normalísima a mitad de consulta)
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** El propio comentario de v17.0.3 (líneas 30220-30229) documenta que esta burbuja se rediseñó justamente para 'nunca flotar en el aire' tapando el formulario de Everest sin señalar nada — el defecto que reportó el médico en su momento. Como el hint típico (p. ej. 'Falta la cita de control') persiste sin cambiar durante minutos mientras el médico revisa la historia y hace scroll, la burbuja queda apuntando al vacío justo para el público al que está dirigida esta función: un médico nuevo, 'como un niño', que puede terminar más confundido por una burbuja que señala a nada que ayudado por ella.

<details><summary>Evidencia de la reproducción</summary>

```
Salida LITERAL de node contra el arnés (tests/harness.js), llamando a api._acompMostrar() dos veces con el mismo hint.id y un elemento objetivo cuyo getBoundingClientRect() cambia entre llamadas (simulando el reflow tras un scroll real):
Tras 1a llamada -> top=92px left=630px
Tras scroll, 2a llamada MISMO hint -> top=92px left=630px
Es el MISMO nodo DOM (no se recreo)? true
rect real del boton ahora: top=700
BUG CONFIRMADO: la burbuja no siguio al boton tras el scroll/reflow; se quedo en la posicion vieja.

(la burbuja es position:fixed —línea 15936 del CSS—, así que sus coordenadas SÍ dependen de dónde esté el botón EN EL VIEWPORT en cada instante; pero _acompMostrar, en la línea ~30234-30236, calcula 'r' de nuevo en cada llamada y LUEGO lo descarta sin usarlo si 'previa.dataset.vglHint === hint.id', devolviendo antes de tocar b.style.top/left)
```

</details>

**Arreglo propuesto.** En _acompMostrar, cuando 'previa && previa.dataset.vglHint === hint.id', no devolver de inmediato: actualizar igual previa.style.top/left con el 'r' recién medido (ya calculado unas líneas antes) antes de salir, para que la burbuja siga al botón en cada tick en vez de solo en el instante en que apareció.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO. El defecto de código existe tal cual se describe (líneas 30229-30236: se recalcula `r` en cada llamada pero se descarta sin usarlo si `previa.dataset.vglHint === hint.id`, devolviendo antes de tocar `b.style.top/left`), pero el CAMINO REAL que el hallazgo propone para llegar del clic del médico al daño clínico —"scroll dentro de la Historia Clínica, una acción normalísima a mitad de consulta"— es técnicamente imposible en este código, y la propia hoja de estilos del proyecto lo demuestra:

- Los CUATRO objetivos posibles de `hint.target` en `_acompSugerencia` (línea 30177-30208) son, sin excepción, elementos `position:fixed` anclados a coordenadas fijas del VIEWPORT, no del documento:
  - `#vgl-acciones-dock{position:fixed;top:200px;left:8px}` (línea 14946) — de aquí cuelgan `[data-accion="ficha"]`, `[data-accion="agendar"]` y `[data-accion="ordenar"]` (hints "leer", "agendar_labs", "agendar", "ordenar").
  - `.vgl-lab-inj,.vgl-exf-btn,.vgl-ia-inj{position:fixed;left:8px...}` con `.vgl-exf-btn-normalidad{bottom:116px}` (líneas 14876-14887) — de aquí cuelga `#vgl-examen-normalidad` (hint "normalidad").
- Por definición de CSS, un elemento `position:fixed` NO cambia su `getBoundingClientRect()` cuando el documento (o un contenedor interno) hace scroll — es exactamente el comportamiento que el propio v14.0.1/v15.6.0 documentó haber elegido A PROPÓSITO para que estos widg
… (recortado)

</details>

---

## 46. `highlight` — BAJA · estilo

**highlight() no usa la misma normalización de acentos que matchesSearch()/fuzzyMatch(): un paciente que SÍ aparece en la lista filtrada por una búsqueda sin tilde queda con su nombre sin resaltar**

- **Línea:** `28520`
- **Cruce estado × acción:** estado: buscador con texto escrito (state.busqueda, siempre en minúsculas por el listener de #vgl-q) x acción: escribir un nombre sin la tilde que sí tiene el paciente en Everest (muy común: 'jose' en vez de 'José', 'ivan' en vez de 'Iván') x dato: nombre con acento.
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** matchesSearch()/fuzzyMatch() ya son insensibles a acentos y mayúsculas (usan stripAccents+toLowerCase), así que el paciente correcto SÍ aparece en la lista filtrada. Pero highlight() hace txt.toLowerCase().indexOf(q) sin quitar acentos, así que nunca encuentra la coincidencia y no pinta el <mark>. En una lista filtrada por apellido común, el médico ve nombres sin ningún resaltado y no tiene forma visual de confirmar por qué ese paciente quedó en el resultado — un segundo de duda evitable en medio de la consulta.

<details><summary>Evidencia de la reproducción</summary>

```
$ node repro_highlight.js
--- Caso acentos: buscar 'jose' encuentra a 'José' pero no lo resalta ---
matchesSearch: true
highlight: José Ramirez
(sin ninguna etiqueta <mark>: el nombre se muestra plano, sin ninguna marca de por qué apareció en la lista filtrada)
```

</details>

**Arreglo propuesto.** Normalizar `q` en highlight() con el mismo stripAccents(...).toLowerCase() que ya usa fuzzyMatch, y buscar la posición sobre `txt` normalizado igual antes de recortar el fragmento a resaltar.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

REFUTADO — el bug de código es real (lo reproduje con el arnés real, `tests/harness.js` → `cargar({silencioso:true}).api`, sin copiar nada a mano), pero no hay un camino real hasta un daño en consulta.

Verificación empírica (líneas 28441-28524, y el listener real de `#vgl-q` en la línea 17920):
- `state.busqueda = el.q.value.trim().toLowerCase()` — nunca pasa por `stripAccents`.
- `matchesSearch` → `fuzzyMatch` sí hace `stripAccents` en ambos lados, así que "jose" encuentra a "José Ramirez": `matchesSearch: true`.
- `highlight("José Ramirez")` con q="jose" hace `txt.toLowerCase().indexOf(q)` SIN quitar tildes → no encuentra "jose" dentro de "josé ramirez" (la é no es e) → devuelve `José Ramirez` sin ningún `<mark>`. Confirmado byte a byte con el repro.

El camino desde el clic SÍ existe (escribir "jose" en el buscador es plausible y común). Donde el hallazgo se cae es en el "daño":

1. `highlight()` solo decide si se pinta un `<mark>`; el texto que se muestra sigue siendo `escapeHtml(a.nombre)` completo y correcto en los dos casos (con o sin match) — no hay truncado, no hay dato erróneo, no hay campo del médico tocado. Grep confirma que `<mark>` no se usa en ningún otro lugar del script: nada lee ni depende de su presencia, es puramente decorativo.
2. El propio hecho de que el paciente aparezca en la lista filtrada YA es la confirmación de por qué está ahí — no se necesita el 
… (recortado)

</details>

---

## 47. `mtrContarPotenciadores (única invocación real: mtrClasificarRiesgoCv)` — BAJA · muerto

**El potenciador 'diabetes sin otros factores de riesgo mayores' (añadido en v17.6.94) es código muerto: el piso por diabetes de v18.0.5 devuelve 'alto' ANTES de que el clasificador llegue a invocar mtrContarPotenciadores, así que NINGÚN diabético puede alcanzar esa rama**

- **Línea:** `34677`
- **Cruce estado × acción:** ESTADO: x.diabetes=true, conteoFr=0, sin daño de órgano/ECV/TFG≤30 (no dispara paso 1 ni paso 2) x ACCIÓN: mtrClasificarRiesgoCv(paciente)
- **Reproducido con el arnés:** sí
- **Refutación:** 2 de 3 refutadores no lograron tumbarlo

**Daño al médico.** No hay daño clínico hoy: el piso por diabetes (v18.0.5) devuelve 'alto', que es igual o más conservador que el 'moderado' que habría dado el potenciador muerto, así que ningún paciente sale subvalorado por esto. El daño es de mantenimiento: el comentario extenso que acompaña a esta línea (v17.6.94) explica con un caso concreto por qué existe y afirma 'los de <10 años puntúan igual que antes' — una garantía que ya no se cumple, porque esos pacientes ya no llegan nunca a esta rama, sino que quedan fijados en 'alto' por el piso de v18.0.5. Un futuro cambio que vuelva condicional el piso (como ya pasó una vez, entre v17.6.94 y v18.0.5) confiará en que este potenciador sigue vivo y cubre el hueco, cuando en realidad ya está muerto y nadie lo notaría sin ejecutarlo.

<details><summary>Evidencia de la reproducción</summary>

```
=== mtrClasificarRiesgoCv (diabetico, conteoFr=0, evolucion desconocida) ===
{
  "categoria": "alto",
  "paso": 2,
  "criterios": [
    "Diabetes mellitus sin tiempo de evolución registrado (piso provisional: riesgo ALTO como mínimo mientras falte ese dato)"
  ],
  ...
  "pisoPorDiabetes": true,
  "dmAniosRequerido": true
}

=== mtrContarPotenciadores llamada DIRECTAMENTE con el mismo paciente ===
conteoFr real: 0 []
{
  "conteo": 1,
  "lista": [
    "diabetes sin otros factores de riesgo mayores"
  ]
}

grep 'mtrContarPotenciadores(' en el archivo -> solo dos coincidencias: la declaración de la función (línea 34653) y su única llamada real, dentro de mtrClasificarRiesgoCv (línea 34828), llamada que queda DESPUÉS del bloque `if (x.diabetes) return ...` (línea ~34801) que intercepta a todo diabético antes de llegar ahí.
```

</details>

**Arreglo propuesto.** Elegir una de las dos cosas explícitamente: (a) borrar la rama `if (x.diabetes && conteoFr === 0) pot.push(...)` de mtrContarPotenciadores y su comentario, dejando claro que el piso incondicional de v18.0.5 es la única regla vigente para el diabético sin otros factores; o (b) si se quiere conservar la gradación moderado/alto por años de evolución, mover el piso por diabetes para que corra DESPUÉS de mtrContarPotenciadores (o condicionarlo igual que se hizo brevemente en v17.6.94), para que la rama vuelva a ser alcanzable.

<details><summary>Lo que dijo el refutador que no logró tumbarlo</summary>

Verifiqué el hallazgo leyendo el código fuente (líneas 34766-34850 y 34671-34698 de vigilante_agenda.user.js, HEAD actual v18.0.42) y reproduciéndolo con el arnés (tests/harness.js -> cargar({silencioso:true}).api):

- Confirmado técnicamente: `mtrClasificarRiesgoCv` tiene, en la línea 34819, un bloque `if (x.diabetes) { ... return ...}` totalmente incondicional (no depende de conteoFr, dmAnios, ni nada más) que corta la ejecución ANTES de la única línea que invoca `mtrContarPotenciadores` (línea 34846). `grep 'mtrContarPotenciadores('` da exactamente 2 coincidencias en todo el archivo: la declaración (34671) y esa única llamada real (34846), posterior al `return`. Además comprobé que ni siquiera hace falta llegar a ese `if`: si el diabético tiene `conteoFr>=1 y dmAnios>10`, ya lo intercepta antes el propio paso 2 (línea 34737, dentro de `mtrCriteriosPaso2`). Es decir, CUALQUIER paciente con `x.diabetes` truthy sale de la función antes de la línea 34846, por dos rutas distintas, nunca por una. Repliqué con el arnés el mismo caso que aporta el hallazgo (diabetes=true, conteoFr=0, sin daño de órgano/ECV/TFG≤30) y el resultado fue idéntico al reportado: `mtrClasificarRiesgoCv` devuelve `alto/paso2/pisoPorDiabetes:true` sin pasar por el potenciador, mientras que invocar `mtrContarPotenciadores` de forma aislada sí activa la rama "diabetes sin otros factores de riesgo mayores". El d
… (recortado)

</details>

---

## Descartados por refutación (19)

No se listan en detalle a propósito: un hallazgo que un refutador tumbó con un argumento verificado **no es trabajo pendiente**, y dejarlo en la lista solo haría ruido. Están en el diario del enjambre.

---

## Cierre adversarial (02-sep): los 47 arreglos, auditados de nuevo por un enjambre independiente

Cuando los 47 hallazgos quedaron aplicados (v18.0.95), se lanzó un **segundo enjambre** con una
sola pregunta: *¿los arreglos son de verdad?* Ocho auditores, uno por lote de 6-7 filas de la tabla
de «Ya aplicados», cada uno con la orden de (1) verificar que el arreglo está en HEAD, (2) verificar
que su prueba no es hueca (mutación inversa sobre una copia), (3) buscar el **sitio hermano** con
el mismo defecto, y (4) buscar **regresiones** introducidas por el propio arreglo. Más un auditor de
CSS (blindaje incremental sobre HTML real en Chromium) y tres auditores S+ de oportunidades.

Resultado de la fase de auditoría: **27 de las 50 filas se confirmaron sin brecha**; sobre las
demás se reportaron **23 brechas**. La fase de refutación (3 refutadores por brecha) se detuvo a
propósito: a concurrencia 2 habría tardado muchas horas, y había una evidencia más fuerte al
alcance — **reproducir cada brecha con el arnés contra HEAD, con el guion que cada auditor dejó**.
Las 23 reproducen. Ninguna se descartó.

### Cómo se cerraron

Todos los arreglos se hicieron en un *worktree* aparte (HEAD principal intacto mientras tanto),
cada uno con la disciplina de siempre: reproducción → arreglo → prueba nueva → **mutación
verificada en las dos direcciones** (fila en `tests/INFORME_MUTACIONES.md`) → banco completo.
El auditor de CSS coincidió en el único hallazgo pre-existente (`#vgl-complexity-pill`) que
v18.0.96 ya había cerrado midiendo sobre HTML real; y señaló dos herramientas desfasadas que
v18.0.96 también dejó al día.

| Fila | Versión auditada | Brecha | Tipo | Gravedad | Cerrada en | Mutación |
|---|---|---|---|---|---|---|
| 8 | v18.0.48 `mtrHcEnganchar` | la guarda de cruce se cortocircuitaba con cédula ILEGIBLE al pedir | arreglo incompleto | media | v18.0.97 | #233 |
| 9 | v18.0.49 `mtrDosisDeTexto` | combinaciones con «+» y «-» daban la dosis del OTRO principio | arreglo incompleto | media | v18.0.97 | #234 |
| 13a | v18.0.52 `mtrSanearTextoLibreAI` | apellidos de 2 letras que son palabras funcionales (Ha, Su, Lo…) destrozaban la nota | regresión | media | v18.0.97 | #235 |
| 13b | v18.0.52 `mtrHcTachar` | el canal del paquete de Everest no toleraba tildes | sitio hermano | media | v18.0.97 | #236 |
| 24 | v18.0.63 Agendar | confirmar → cerrar en vuelo → reabrir → confirmar = **2 citas reales** | sitio hermano | **alta** | v18.0.98 | #237, #238 |
| 23 | v18.0.62 `apptKey`/`colorAndAlert` | una misma llegada contada 2 veces (nombre ↔ cédula) | arreglo incompleto | **alta** | v18.0.98 | #239 |
| 6 | v18.0.47 fetch | 3 `fetch` directos sin tope (correo, enlace, SMS) | sitio hermano | media | v18.0.99 | #240 |
| 15a | v18.0.54 `mtrResumenDesdeModalLabs` | tensión mezclada de dos mediciones (130/85) | sitio hermano | media | v18.0.99 | #241 |
| 15b | v18.0.54 prueba | grep del fuente con justificación falsa | prueba hueca | media | v18.0.99 | #242 |
| 18 | v18.0.57 negadores | «No asiste a controles de diabetes» leído como negación | regresión | media | v18.0.99 | #243 |
| 20 | v18.0.59 Deshacer | sin cédula, dos pacientes se acumulaban en un lote | regresión | baja | v18.0.99 | #244 |
| 21 | v18.0.60 carpeta local | «0000111111.json» huérfano; dos archivos por paciente | sitio hermano | media | v18.0.99 | #245 |
| 22 | v18.0.61 `mtrEvaluarErc` | peso implausible anunciado como «falta algún dato» | sitio hermano | baja | v18.0.100 | #246 |
| 24b | v18.0.63 prueba | la contención «el médico manda» no ejercitaba `!_tocada` | prueba hueca | media | v18.0.100 | #247 |
| 27 | v18.0.71 `xlsViejoDeHoy` | sin la guarda fuera de la raíz: aviso falso de .xls antiguo | sitio hermano | baja | v18.0.100 | #248 |
| 30 | v18.0.74 prueba | la conductual pasaba con el defecto puesto de vuelta | prueba hueca | baja | v18.0.100 | #249 |
| 33a | v18.0.77 Ajustes | Alt+R / #vgl-rep / dock y Ctrl+Shift+D descartaban el borrador sucio | sitio hermano | media | v18.0.100 | #250, #251 |
| 33b | v18.0.77 `closeSheet`↔`_ajustesIntentarCerrar` | recursión mutua: sin barra, la pestaña se colgaba | regresión | baja→cuelgue | v18.0.100 | #252 |
| 34 | v18.0.79 `render` | historial de inasistencias leído 30 veces por pintado | regresión | baja | v18.0.100 | #253 |
| 39a | v18.0.84 `_esUroComponenteAlterado` | «INCONTABLES X CAMPO», «> 100 INCONTABLES» pasaban como NORMAL | arreglo incompleto | media | v18.0.101 | #254 |
| 39b | v18.0.84 ídem | PRESENTE / REGULARES / SE OBSERVAN sin resaltar | sitio hermano | baja | v18.0.101 | #254 |
| 41 | v18.0.86 `scrubPII` | el teléfono partía un número de orden («9[TEL_CENSURADO]8») | arreglo incompleto | media | v18.0.101 | #255 |
| 43 | v18.0.88 letra vs contraste | cambiar la letra con el contraste ya encendido no movía el panel | arreglo incompleto | baja | v18.0.101 | #256 |
| 44 | v18.0.89 avisos de Auto-Labs | el VERDE de éxito se tragaba el AMBAR «Everest exige…» | arreglo incompleto | media | v18.0.101 | #257 |
| 49 | v18.0.94 `highlight` | con acentos descompuestos (NFD) el `<mark>` partía un grafema | arreglo incompleto | baja | v18.0.101 | #258 |
| 50 | v18.0.95 spec | `MOTOR_RCV_V68_SPEC.md` describía dos reglas que el código ya no tiene | documentación | baja | v18.0.101 | (doc) |

Dos decisiones que quedan explícitas para el médico:

- **Fila 13b / v18.0.25.** El mínimo de 4 letras de `mtrHcTachaduras` (decisión del médico en
  v18.0.25) no se tocó en v18.0.97: el canal del paquete toleraba tildes, pero un apellido de 2-3
  letras seguía sin tacharse por ese canal. **Decidido el 02-sep («alinealo»)**: desde v18.0.102 los
  dos canales usan la misma regla de dos letras, en un solo sitio (`_mtrTokenDeNombreTachable`).
- **Fila 18.** Ni 20 ni 25 caracteres de ventana son la respuesta; lo que decide es si el «no»
  niega una *conducta* (asistir, tomar, controlarse) o el hecho. Si aparece una frase real que la
  lista de conductas no cubra, se agrega a `MTR_RE_NEGACION_DE_CONDUCTA` con su prueba.
