# Blindaje de defectos — estado real

> **Arreglado no es lo mismo que blindado.** En este proyecto un defecto está *blindado*
> cuando existe una prueba que se pone **roja** si alguien deshace el arreglo, verificada
> rompiendo el código a propósito y anotada en `tests/INFORME_MUTACIONES.md`.
> Un arreglo sin esa prueba es un arreglo que el próximo cambio puede deshacer en silencio.

Este inventario existe porque los hallazgos vivían solo en los diarios de los enjambres
(`~/.claude/.../subagents/workflows/*/journal.jsonl`), que no se pueden auditar de un vistazo
ni sobreviven a la sesión.

**Fuente:** barrido exhaustivo de las 41.889 líneas, 97 subagentes (`wf_2215a093-231`).
83 hallazgos con evidencia; los «72» de los que se habla son los que sobrevivieron a la
refutación adversarial.

**Última actualización:** v18.0.40. Banco: 2.821 comprobaciones, 0 fallan.


## Gravedad ALTA — 27 hallazgos: **24 cerrados y blindados**, 3 abiertos

| Línea | Estado | Versión | Defecto |
|---|---|---|---|
| L946 | ✅ blindado | v18.0.29 | En la web de Athenea, guardar las credenciales SIEMPRE falla (TDZ de ATH_CRED_KEY) y la consola afirma que se guardaron |
| L1496 | ✅ blindado | v18.0.32 | El bloque agrupado de Uroanálisis pierde NombreParametroPadre, y un parcial sugestivo de infección se rotula «Sin hallazgos patológicos (Normal)» |
| L4468 | ✅ blindado | v18.0.20 | La marca «lectura incompleta de Athenea» se pierde al persistir la pre-consulta: una lectura a medias se presenta como hecho del paciente. |
| L4799 | ✅ blindado | v18.0.18 | La guarda de escritura v18.0.4 ignora `ts`, así que una confirmación con vigencia re-respondida con el MISMO valor nunca se persiste |
| L4926 | ✅ blindado | v18.0.18 | El sello de `pestanasVistas` se renueva en cada vuelta y anula la guarda de escritura de v18.0.4: el almacén entero (~1 MB) se reescribe cada 2–5 s |
| L5131 | ✅ blindado | v18.0.17 | mtrTextoOpinaSobre lee "no diabético" / "no fumador" / "sin diabetes" como AFIRMACIÓN, no como negación |
| L6614 | ✅ blindado | v18.0.30 | «Exámenes»: el mensaje de fallo se borra en la línea siguiente — el apagado del kill-switch queda completamente mudo |
| L7583 | ⬜ **abierto** | — | «Examen normal» → opción «Revisión por sistemas»: la comprobación de conteo que impide pegar en la casilla equivocada es inalcanzable |
| L11731 | ✅ blindado | v18.0.39 | El nombre genérico «Paciente Everest» se usa como identidad de cita, así que una marca de fraude contagia a otro paciente de la misma hora |
| L11797 | ✅ blindado | v18.0.21 | Una pestaña NO líder crea y comparte la marca alertedFraud, y con eso se pierden la fila FRAUDE_EXTEMPORANEO de la auditoría y el reporte de fraude al tablero |
| L11910 | ✅ blindado | v18.0.17 / 18.0.21 | La rectificación de inasistencia (v18.0.8) no está guardada por `state.leader`: con dos pestañas descuenta DOS veces del contador de auditoría y escribe dos filas RECTIFICACION_INASISTENCIA |
| L11910 | ✅ blindado | v18.0.17 / 18.0.21 | La rectificación retroactiva de INASISTENCIA corre en TODAS las pestañas, así que el contador del día se descuenta una vez por pestaña abierta |
| L15018 | ✅ blindado | v18.0.14 | #vgl-agm-vencaviso: el aviso «esta fecha deja vencer un examen» pierde su ámbar y su fondo ante cualquier !important de Everest |
| L15778 | ✅ blindado | v18.0.14 | En #vgl-pym-modal todo el texto quedó blindado en v12.10.5 menos los chips, que son justamente el dato clínico |
| L16357 | ✅ blindado | v18.0.14 | .vgl-agm-err — la caja de «no se pudo leer» declara su rojo sin !important y vive en cuatro modales colgados de document.body |
| L19487 | ⬜ **abierto** | — | Anular la cita de control borra también la marca local de la toma de laboratorio: el aviso «la TOMA DE MUESTRAS sigue agendada» es inalcanzable y el antiduplicados de labs queda apagado |
| L22392 | ✅ blindado | v18.0.33 | El Panel del paciente mete la tensión, el peso y la cintura del paciente que está EN PANTALLA dentro del resumen cacheado de OTRO paciente, y lo reclasifica con ellos |
| L23432 | ✅ blindado | v18.0.34 | El agendamiento escribe la tensión leída del DOM dentro del objeto VIVO de la caché del resumen, sin comprobar de quién es la historia abierta |
| L23853 | ✅ blindado | v18.0.37 | «Agendar también la Toma de Muestras» se vuelve a marcar sola después de que el médico la desmarca (listener con {once:true}) |
| L24897 | ✅ blindado | v18.0.37 | El modal «solo laboratorio» deja el primer cupo del día preseleccionado y el botón habilitado: un clic agenda una hora que el médico nunca eligió |
| L25747 | ✅ blindado | v18.0.38 | Un solo examen de Athenea (a veces uno ajeno) da por HECHO un paquete PyM completo, bloquea la casilla y afirma en pantalla un hecho falso |
| L28646 | ✅ blindado | v18.0.17 | El aviso de «Vigilante sin lectura de la agenda» se dispara en el PRIMER tick del arranque y, como solo sale una vez al día, deja mudo el aviso real de ceguera durante el resto de la jornada |
| L33460 | ✅ blindado | v18.0.40 | Sin función renal, basta UNA interacción para que desaparezca el aviso «no se pudo juzgar la dosis» y el pie afirme que sí se calculó con la función renal |
| L35453 | ⬜ **abierto** | — | El sufijo «· albuminuria: vigilancia estrecha» se pega al motivo de TODO examen vencido, no solo al RAC con albuminuria |
| L39755 | ✅ blindado | v18.0.32 | La esterasa leucocitaria reportada en cruces CON número ("3+", "2 +") se enruta como recuento de leucocitos y el uroanálisis sale «SIN HALLAZGOS» |
| L40145 | ✅ blindado | v18.0.25 | mtrHcTachar tacha por subcadena sin límite de palabra: un nombre de 3-4 letras (ANA, MAR, ROSA) destroza el grounding clínico que se le manda a Gemini |
| L40456 | ✅ blindado | v18.0.15 | La cosecha en vivo de la historia manda el texto libre de la pantalla a Gemini SIN pasar por scrubPII (fuga de PHI real). |

## Gravedad MEDIA — 36 hallazgos: **2 cerrados y blindados**, 34 abiertos

| Línea | Estado | Versión | Defecto |
|---|---|---|---|
| L3628 | ⬜ **abierto** | — | El reintento de las 7 casillas de componente del uroanálisis sigue condicionado a `uroanalisisMarcado`, la misma bandera que v17.1.0 (#71) quitó del reintento de la casilla de resultado |
| L4776 | ⬜ **abierto** | — | `_vglCosechaGuardar`/`_vglCosechaLeer` reinterpretan y reserializan el almacén COMPLETO en cada llamada: ~37 ms por vuelta del reloj aunque no cambie nada |
| L4923 | ⬜ **abierto** | — | `pestanasVistas` sella con Date.now() bajo una clave que la guarda no ignora: el almacén completo se reescribe en CADA vuelta del reloj |
| L6643 | ✅ blindado | v18.0.30 | Tras un llenado de 0 casillas, «↩ Deshacer» se ofrece igual y, al pulsarlo, borra el lote ANTERIOR (el examen físico que el médico ya aceptó). |
| L6709 | ⬜ **abierto** | — | En la rama del reintento tras auto-login falta la guarda del interruptor de emergencia: un llenado abortado se pinta «✓ 0 casillas escritas» en VERDE. |
| L6714 | ✅ blindado | v18.0.30 | En el reintento tras el auto-inicio de sesión, «no pude leer el portal» (null) se le presenta al médico como «Sin resultados en el laboratorio para este paciente». |
| L7403 | ⬜ **abierto** | — | El botón «↩ Deshacer» copia la clase del botón que lo generó y queda exactamente encima de él, tapando el resultado recién escrito |
| L11238 | ⬜ **abierto** | — | Si una de las tres carpetas de SharePoint falla pero otra responde, el fallo se traga y el médico lee «Aún no aparece la lista de prevención de hoy» como un hecho |
| L12541 | ⬜ **abierto** | — | El aviso de labs RCV que llegan tarde se marca como VISTO antes de pintarse: si el render falla, se pierde en toda la jornada |
| L13364 | ⬜ **abierto** | — | Con «Silenciar 15 min» activo y el médico dentro de la historia clínica, el cartel ROJO de confirmación extemporánea no se pinta NI se encola: se pierde para siempre |
| L15691 | ⬜ **abierto** | — | #vgl-toasts — el canal principal de avisos tiene el cuerpo del mensaje y la ✕ sin blindar (el título sí lo está, por accidente) |
| L15713 | ⬜ **abierto** | — | Los chips del aviso universal (.vgl-pym-chip / .vgl-labsv-chip) declaran color sin !important dentro de un modal que cuelga de document.body |
| L16214 | ⬜ **abierto** | — | Inventario: 34 reglas de color sin !important siguen alcanzando a paneles que cuelgan de document.body (aquí, los mensajes de «todavía no sé») |
| L16269 | ⬜ **abierto** | — | .vgl-agm-sbtn-sugerido: la insignia SUGERIDO del turno propuesto vuelve a ser vulnerable, esta vez a Everest |
| L16315 | ⬜ **abierto** | — | Las marcas «+ ADICIONAL» y «⚠ SOLO SI NO HAY OTRA CITA» del selector de turnos pierden su color ante Everest |
| L16339 | ⬜ **abierto** | — | Reglas de color con clase «pelada» y sin !important dentro de modales que cuelgan de document.body (bug #2 de CLAUDE.md, en el punto ciego que la Regla E de suite_25 declara no cubrir) |
| L16455 | ⬜ **abierto** | — | #vgl-postcita-panel: la ✕ de cerrar y el color base de la tarjeta quedaron fuera del blindaje que sí recibieron sus hermanos |
| L16710 | ⬜ **abierto** | — | El distintivo verde/ámbar del resumen de uroanálisis (#vgl-labs-modal) no lleva !important ni en color ni en fondo |
| L18567 | ⬜ **abierto** | — | apiLaboratorioAgendarAuto envía «AgendaId=undefined» a AppCita: el aborto que el comentario de v11.0.1 afirma que existe no está implementado |
| L21101 | ⬜ **abierto** | — | «Otros medicamentos: N» inventa fármacos inexistentes: resta dos listas deduplicadas con claves distintas |
| L21914 | ⬜ **abierto** | — | _vglMarcarRadio marca la casilla ANTES de comprobar que esté deshabilitada: queda escrita en la historia, no se cuenta y no entra en «Deshacer» |
| L22152 | ⬜ **abierto** | — | El punto de estado de la pestaña «Medicamentos» del Panel del paciente sale VERDE («Al día») aunque esa pestaña contenga avisos CRITICAL de seguridad farmacológica |
| L23296 | ⬜ **abierto** | — | _agendasPropias: un «de», un «la» o una inicial en el nombre del médico anula por completo el reconocimiento por tokens |
| L23922 | ⬜ **abierto** | — | El chip de SÁBADO que sí le toca al médico añade la clase `vgl-agm-pbtn-sabado-mio`, pero la hoja de estilos solo declara `.vgl-agm-pbtn-sabado-suyo`: el realce verde no se pinta nunca |
| L28281 | ⬜ **abierto** | — | `refrescarCuentas` lee y re-parsea el historial COMPLETO de inasistencias de localStorage una vez POR TARJETA y en CADA tick: O(tarjetas × pacientes archivados) de trabajo bloqueante |
| L30143 | ⬜ **abierto** | — | mtrSugerenciaPorPlazo pierde el grupo de sábado al calcular el control en modo «labs primero»: el mismo paciente sale con dos fechas de control distintas |
| L32205 | ⬜ **abierto** | — | El mapa de frecuencias supone un orden por fecha que nunca se aplica: puede mostrar la posología de una fórmula ANTIGUA al lado del medicamento |
| L32537 | ⬜ **abierto** | — | Dos concentraciones distintas del mismo principio se anuncian como «el mismo renglón repetido»: el mensaje afirma que un medicamento «aparece 2 veces» y nunca nombra la segunda dosis |
| L34078 | ⬜ **abierto** | — | Sin LDL basal, «no evaluable» se convierte en «FALLA PARCIAL»: un paciente en meta sale declarado en falla terapéutica |
| L36146 | ⬜ **abierto** | — | La hoja de hechos afirma que la creatinina «fija la fecha de la toma» siempre que el ANR está activo, aunque la fecha la fije otro examen |
| L36896 | ⬜ **abierto** | — | Los ejemplos de estilo viajan a Gemini con la defensa por tokens de nombre INERTE: `.map(mtrSanearTextoLibreAI)` le pasa el índice del array como `nombrePaciente`. |
| L37075 | ⬜ **abierto** | — | La «segunda capa» que limpia la Enfermedad Actual no cubre tres rótulos que la propia hoja de hechos emite, incluido «Colesterol no-HDL:» (laboratorio + meta terapéutica) |
| L37956 | ⬜ **abierto** | — | order_list_mtt.fusiones[].fecha emite la fecha NATURAL del recontrol, no la de la toma maestra a la que se fusionó: el JSON le da a la IA dos fechas contradictorias |
| L38191 | ⬜ **abierto** | — | El Framingham oficial recibe el sexo SIN normalizar: con «MASCULINO»/«FEMENINO» siempre responde «faltan sexo» aunque el sexo se conozca y se esté usando para la TFG |
| L38720 | ⬜ **abierto** | — | La caja roja de «cifras sin respaldo» valida el borrador contra la hoja de hechos CONGELADA al abrir el panel, no contra la que la IA usó de verdad |
| L40460 | ⬜ **abierto** | — | `mtrCosecharHcDelDom` vuelve a consultar el documento entero una o dos veces por CADA grupo de radios, teniendo ya los nodos agrupados en la mano |

## Gravedad BAJA — 20 hallazgos: **0 cerrados y blindados**, 20 abiertos

| Línea | Estado | Versión | Defecto |
|---|---|---|---|
| L8814 | ⬜ **abierto** | — | El relevo de liderazgo POR CEGUERA (v18.0.9) escribe en consola el motivo del relevo por VISIBILIDAD: afirma que la pestaña líder estaba oculta cuando no lo estaba |
| L11012 | ⬜ **abierto** | — | spFallbackUrls añade siempre el shareId del archivo de respaldo DE FÁBRICA, aunque se le pida otro archivo: en la pestaña de SharePoint puede bajar y cachear el libro equivocado |
| L11640 | ⬜ **abierto** | — | parseHoraMin busca el AM/PM en TODO el texto que sigue a la hora, así que una palabra suelta lo convierte en un error de 12 horas |
| L13906 | ⬜ **abierto** | — | Un ${...} escrito como texto explicativo dentro de un comentario CSS se evalúa de verdad: MTR_RCV_CSS se auto-referencia en su propia zona muerta y el texto se borra |
| L14693 | ⬜ **abierto** | — | El !important que v17.6.3 puso en #vgl-head no puede proteger a #vgl-title, que es el elemento que el propio comentario dice proteger |
| L14726 | ⬜ **abierto** | — | El botón «Ordenar pendientes» pierde su font-size: usa var(--t-micro) sin reserva y #vgl-cw-ordenar-btn no hereda los tokens |
| L16246 | ⬜ **abierto** | — | Colisión de cascada (Regla A) entre .vgl-agm-sbtn-sugerido y .vgl-agm-sbtn-adicional: el turno sugerido que además es cupo adicional pierde su borde ámbar |
| L16250 | ⬜ **abierto** | — | Las etiquetas «+ ADICIONAL» y «⚠ SOLO SI NO HAY OTRA CITA» del selector de turnos declaran color sin !important en un modal que cuelga de document.body |
| L16741 | ⬜ **abierto** | — | Regla muerta: `#vgl-labs-modal .vgl-labs-uro-i b` se redeclara entera más abajo y ninguna de sus tres propiedades llega a pantalla |
| L17354 | ⬜ **abierto** | — | #vgl-paquete-modal quedó fuera del blindaje tipográfico :where(...:not([class])) aunque pinta un <b> sin clase con la cédula del paciente |
| L20868 | ⬜ **abierto** | — | La columna «Fuente» de Laboratorios es una constante («Laboratorio»), pero el globo del rótulo promete que distingue lo automático de lo registrado a mano |
| L21065 | ⬜ **abierto** | — | La fila de función renal del Panel acusa la falta con la jerga interna del motor: «para Cockcroft-Gault falta edad_pediatrica / creatinina_fuera_de_rango» |
| L22550 | ⬜ **abierto** | — | El aviso «Se actualizó con lo que acaba de escribir en la historia» sigue enseñando claves internas del motor (dislipidemiaDocumentada, enfermedadRenalDocumentada…) |
| L22581 | ⬜ **abierto** | — | El cuadro «Las fuentes no coinciden» imprime una línea «A favor:» vacía en las preguntas de la escalera de adherencia |
| L24050 | ⬜ **abierto** | — | «Otra fecha para la toma…» ignora en silencio una fecha pasada y deja el calendario mostrando una fecha que el sistema no va a usar |
| L25766 | ⬜ **abierto** | — | El aviso pide «selecciónela manualmente» sobre una casilla que el mismo modal acaba de deshabilitar |
| L27877 | ⬜ **abierto** | — | La cuenta regresiva de la tarjeta imprime «1h60», una hora que no existe |
| L28237 | ⬜ **abierto** | — | refrescarCuentas toma el badge de inasistencias por la cuenta regresiva: la tarjeta acaba con dos cuentas y una se congela |
| L32550 | ⬜ **abierto** | — | El bloque de duplicidad terapéutica se pinta con color desprotegido fuera de #vgl-root: un <div> sin clase en #vgl-panel-modal y .vgl-tab-mini sin !important en #vgl-cw-farmaco |
| L32766 | ⬜ **abierto** | — | Los fármacos excluidos a propósito por vía no sistémica (cremas, colirios) se le reportan al médico como «no se pudo evaluar» |

---

## Hallazgos de los dos enjambres del 01-sep (aparte de los 83)

**`wf_63ac5249-098`** — Redactor IA, laboratorios y clínicos (37 agentes, 22 confirmados).
**`wf_72e6f041-417`** — rediseño completo de TRAE en 6 módulos (19 agentes).

| Estado | Defecto |
|---|---|
| ✅ v18.0.30 | Auto-Labs: «Deshacer» tras 0 casillas borraba el lote anterior; rama del apagado muda |
| ✅ v18.0.31 | Seis nombres del hemograma se llevaban la casilla de la hemoglobina sérica |
| ✅ v18.0.32 | Parcial de orina: ancla de panel perdida + esterasa en cruces contada como recuento |
| ✅ v18.0.33 | El Panel metía PA/peso/cintura del paciente EN PANTALLA en el resumen cacheado de OTRO |
| ✅ v18.0.34 | El agendamiento escribía la tensión en la caché VIVA sin comprobar de quién es la historia (+ un tercer sitio que apareció al escribir la regla) |
| ✅ v18.0.35 | El contexto pegado se recortaba en seco a 800 caracteres; la caja roja marcaba como inventadas las cifras del propio médico |
| ✅ v18.0.36 | Lo que el médico teclea no llegaba al prompt hasta guardar; la hoja de hechos se arrastraba de la foto |
| ⬜ **abierto** | `mtrSanearTextoLibreAI` destroza texto en Mayúscula Inicial: la regex de honoríficos se come hasta 4 palabras clínicas |
| ⬜ **abierto** | `scrubPII` censura cifras de laboratorio con separador de miles («PLAQUETAS 250.000» → `[CENSURADO]`) |
| ⬜ **abierto** | El aviso al abrir la historia se corta: con 10 actividades el botón «Entendido» queda 21,5 px FUERA |
| ⬜ **abierto** | `.vgl-uro-arrow` no tiene NINGUNA regla de color: 18,67:1 → 1,10:1 bajo el CSS de Everest (+8 iconos por `svg`) |
| ⬜ **abierto** | El titular y el icono de los avisos flotantes pierden su color ante Everest: 7,84:1 → 1,02:1 |
| ⬜ **abierto** | `#vgl-root{max-height:84vh}` + `zoom` (letra grande / alto contraste): el panel se sale de la pantalla |
| ⬜ **abierto** | Regla A de `suite_25` es ciega a colisiones de orden entre reglas del MISMO conjunto de clases |
| ⬜ **abierto** | Los prompts de la IA en el estilo que eligió el médico (híbrido, natural) — pendiente |

## Enjambre de funciones en curso (`wf_df8f59cb-aed`)

24 cazadores en Sonnet 5 cruzando estados × acciones sobre las 1.007 funciones, con
reproducción obligatoria en el arnés y tres escépticos por hallazgo. **Sin aplicar todavía:
esperan la refutación.** Entre lo reproducido hasta ahora:

- `normalizeKey`: una cédula en notación científica se «arregla» con solo 6 cifras
  significativas — dos pacientes distintos pueden colapsar en la misma clave.
- `parseCSV`: una coma entrecomillada en el `.csv` del PyM borra en silencio a un paciente.
- `_nuevoReemplazaCandidato`: un RAC = 0 de HOY (valor real de un paciente sano) pierde contra
  un RAC = 45 de hace meses, y se escribe el viejo.
- `_vglCosechaGuardar`: escribe bajo una clave nueva sin consultar `_vglClaveDeDoc`.

---

## Cómo se lee este documento

- **✅ blindado** — arreglado **y** con prueba que cae al deshacerlo, con su fila en
  `tests/INFORME_MUTACIONES.md`.
- **⬜ abierto** — ni arreglado ni vigilado. Si alguien lo toca sin querer, nada se pone rojo.

