# Oportunidades S+ (02-sep-2026) — tres auditorías sobre v18.0.102

Tres auditores independientes, cada uno con una lente, recorrieron el script entero después del
cierre adversarial. No repiten nada de `docs/ENJAMBRE_FUNCIONES_20260901.md`. Cada oportunidad
trae evidencia (función:línea o reproducción con el arnés, datos sintéticos); los guiones viven en
el scratchpad de la sesión (`splus_flujo/`, `splus_estado_unico/`, `splus_robustez/`).

**Estado.** Lo marcado ✅ ya se cerró (v18.0.103–v18.0.104 y, a petición del médico, de v18.0.107 en adelante). Lo marcado ⚖️ toca una decisión
previa del médico y se presenta como opción, no como arreglo.

---

## A. «Un solo estado del paciente» (el dolor #1 del médico)

Diagnóstico del auditor: el script tiene **ocho almacenes por paciente con ocho relojes** y **tres
reglas de identidad** (cadena exacta / dígitos con ceros / cédula canónica), y cada módulo arma su
propia versión del paciente leyendo fuentes crudas con precedencias distintas. Doce desacuerdos
reproducidos:

| # | Desacuerdo | Módulos | Gravedad · esfuerzo |
|---|---|---|---|
| A1 | El programa rector que viene de Ruta Crónicos se pierde en la primera reconciliación del Panel: el modal de Laboratorios dice HTA (ftl 2026-09-16), el Panel dice «sin programa» y lo regraba en la caché que leen Agendar y Ordenar (`mtrLeerFactoresRcvDelDom` nunca lee `cosecha.programas` y aplana a booleano; `Object.assign(fPrev, fNue)` deja que un false pise un true) | Panel · caché · Agendar · Ordenar · Redactor | medio · medio |
| A2 | Tensión y peso invierten su precedencia: el modal de Laboratorios prefiere el registro histórico de la API (110/70, 90 kg), el Panel la casilla de hoy (165/102, 70 kg); la carpeta y la hoja de la IA heredan una u otra según qué módulo pasó último (CrCl 100 vs 77.8; franja de Agendar final_jornada vs primera_mitad) | Labs · Panel · IA · carpeta · Agendar | medio · medio |
| A3 | Medicamentos con dos llaves: el widget de Conducta manda la **cédula** como `pacienteId` al endpoint (la caché queda bajo la cédula; el Panel lista fármacos mientras la IA redacta «SIN_MEDICAMENTOS_ACTIVOS») | Conducta · Panel · IA · dosis renal | **alto** · pequeño |
| A4 | El aviso de entrada y el antiduplicado de PyM solo ven Athenea; el Panel, Agendar y el Redactor ven Athenea+Annar+Citi (creatinina «vencida» en el cartel, vigente en el Panel) | aviso · Ordenar · Panel | bajo · medio |
| A5 | Sexo sin canonicalizar: el motor lo usa en cualquier forma («MASCULINO»), la hoja de la IA exige «F»/«M» y lo deja en null; la carpeta archiva el crudo | motor · IA · carpeta | bajo · pequeño |
| A6 | Tres reglas de identidad para la misma cédula: caché de resumen, `_labsPrefetch`, `_mtrDatosExtra`, `_preconEstadoDe` comparan cadena exacta; cosecha y `vgl_proc_today` leen tolerante; `_pacienteIdCache` indexa con ceros; `_anularCitaMarcasLocales` borra solo la forma exacta | todos | bajo · pequeño |
| A7 | La historia cosechada del DOM no tiene fecha por campo, nunca se borra y se rotula «escrito en la historia de HOY» junto a la versión de red (la IA recibe «EDEMA GRADO II» de hace 5 días como de hoy y «SIN EDEMA» de red a la vez) | HC · IA | bajo · pequeño |
| A8 | La carpeta local solo recibe la foto del modal de Laboratorios (antes de reconciliar), nunca la del Panel; y ese control es el ancla de la próxima Enfermedad Actual | carpeta · Panel · IA | bajo · pequeño |
| A9 | Sin nombre en la agenda (`apt = { doc_id }`) el censor de PHI perdía su ancla → ✅ v18.0.103 (nombre del paquete en RAM) | dock · IA | — |
| A10 | Edad/sexo/EPS/celular/programas: tres lectores directos del mismo endpoint con cachés distintas (Ordenar y Agendar sin caché) | motor · Ordenar · Agendar | bajo · pequeño |
| A11 | Programas/diagnósticos: cinco fuentes con reglas distintas y sin cruce (radios, Ruta Crónicos, cabecera, `programasPaciente` de la API, PES) — Agendar puede decir «Diabetes» por etiqueta mientras el Panel clasifica como no diabético | Panel · Labs · reconciliador · Agendar · tarjeta | medio · medio |
| A12 | Vigencias: el aviso de entrada y PyM aplican la tabla de la norma solo si hay resumen en caché; sin caché, 180 días planos; la contradicción se fija el resto de la jornada | aviso · Ordenar · Panel | bajo · pequeño |
| A13 | Frescura sin procedencia por dato: «leídos hace N min» habla del cálculo, no del dato (el peso que rige Cockcroft-Gault puede ser de la visita anterior) | todos | bajo · medio |

**Arquitectura propuesta (resumen).** Un `EstadoPaciente` por cédula canónica, en memoria de la
pestaña, del que TODOS los módulos leen y al que NINGÚN módulo escribe directo: escriben las fuentes
registradas a través de adaptadores que devuelven hechos con procedencia. Cada dato = `{valor,
fuente, fechaDelDato, tsLectura}`; programas/factores en **tri-estado** (`null` nunca se convierte
en `false` al fusionar); precedencia escrita UNA vez (antropometría: casilla de hoy > API con fecha
de hoy > API de otra fecha marcada > carpeta; programas: casilla de hoy > confirmación del médico >
cosecha > votos de Ruta Crónicos/cabecera/API que, si contradicen, disparan el reconciliador);
laboratorios consolidados (Athenea+Annar+Citi) con una sola función de vigencias; medicamentos por
id interno para todos; derivados (resumen/plan/tablero) calculados solo desde el estado.
**Migración en ocho pasos** detrás de banderas, empezando por un «estado de lectura» pasivo que
observa lo que hoy leen los demás y **detecta desacuerdos en producción** (modo programador), y por
la Ficha viva como primer consumidor de solo lectura. **Pruebas**: suite de conformidad (para un
paciente sintético con fuentes en conflicto, Panel, IA, tablero, Agendar, aviso, Ordenar y carpeta
devuelven el MISMO valor con la MISMA procedencia), invariante de identidad por grep, prueba de
tri-estado, prueba de fechas, prueba de identidad de red, y mutación por cada precedencia.

## B. Robustez y cero PHI

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| B1 | El nombre del paciente viajaba a Gemini cuando el paciente abierto no está en la agenda del día; el borrador aceptado se archivaba como «estilo» con el nombre y se reinyectaba en otros pacientes; `.map(mtrSanearTextoLibreAI)` pasaba el índice como nombre; «Paciente Everest» tachaba la palabra PACIENTE | **alta** | ✅ v18.0.103 |
| B2 | La hoja de hechos (bloque «escrito en la historia de HOY») llegaba al prompt sin el censor de nombres, incluso conociéndolo | **alta** | ✅ v18.0.103 |
| B3 | Si la escritura local del candado «ya ordenado/agendado hoy» falla (cuota), el candado se pierde en silencio: el dock vuelve a ofrecer Ordenar/Agendar y el panel post-cita pierde la anulación | media | pendiente (comprobar el retorno de `writeJSON`, copia en memoria, espejo GM de `vgl_proc_today`) |
| B4 | El espejo GM de la bitácora diaria (nombre+cédula) no se poda jamás | media | pendiente (`@grant GM_listValues/GM_deleteValue`, poda en `purgeEventDays`) |
| B5 | Ajustes promete «Todo se queda en su equipo» para la carpeta de `<cédula>.json` sin advertir sobre carpetas sincronizadas (OneDrive/Drive) | media | pendiente (texto + heurística de nombre + confirmación) |
| B6 | «Enviar órdenes al correo» da por enviado con solo `resp.ok` (un 200 con `error:true` se anuncia como enviado) | media | pendiente (sin captura del cuerpo real: leer `error/mensaje` con la cautela de v17.0.3) |
| B7 | Bitácora (flight recorder) pisada entre pestañas | baja | pendiente |
| B8 | `repBeacon` manda `_intentos` (el blindaje de v18.0.66 solo en `repPost`) | baja | pendiente (una línea) |
| B9 | Las notificaciones del SO llevan nombre + cédula (Centro de actividades de Windows en un PC compartido) | baja | pendiente |
| B10 | La consola de EnviarSMS imprime 500 caracteres del cuerpo crudo | baja | pendiente |
| B11 | Doble clic en «Exámenes»: sin deshabilitar ni guarda de vuelo; el segundo pisa el veredicto | baja | pendiente |
| B12 | Respaldo de identidad por equipo `S.medicoId/S.medicoNombre` en 7 llamadas, sin campo en Ajustes pese al mensaje que manda a buscarlo | baja | ⚖️ decidir (retirarlo o exponerlo atado al login) |

## C. El flujo real de la consulta (prioridad del auditor: 1 = máxima)

| # | Oportunidad | Prioridad | Estado |
|---|---|---|---|
| C1 | Con 4 avisos de Auto-Labs en un clic el médico solo veía «Alerta Múltiple (4)» sin analitos | 1 | ✅ v18.0.104 (agrupados por paciente con sus cuerpos) |
| C2 | El aviso «Pendientes de este paciente» llega 5-15 s después de abrir la historia y roba el foco mientras el médico escribe (Enter pulsa «Entendido» y no vuelve en la jornada) | 1 | ✅ v18.0.107 (no roba el foco si el activo es un campo editable de Everest fuera del cuadro) |
| C3 | Al salir de una casilla de texto libre se borra el resumen: el botón «Panel» desaparece, los widgets de Conducta se esconden hasta 30 s + red, Agendar vuelve a «Analizando…» | 1 | ✅ v18.0.107 (recalculado en el acto con lo de pantalla, marcado «desactualizado», cálculo completo en segundo plano; el dock dice «actualizando…») |
| C4 | Si la cita se crea pero la toma de muestras falla, todo lo visible dice éxito y el fallo sale por el HUD «Centinela PyM» | 1 | ✅ v18.0.107 (motivo real del fallo en el botón, aviso ámbar fijo y línea roja en el panel post-cita) |
| C5 | El resultado del SMS automático solo se conoce en la consola | 2 | pendiente |
| C6 | El panel post-cita se destruye y se recrea cuando AppCita confirma la toma | 2 | pendiente |
| C7 | Redactor: «Generando con…» fijo hasta 7 modelos × 25 s, sin cancelar ni «Generar todo» | 2 | pendiente |
| C8 | Ajuste «SMS de recordatorio» apagado: la casilla nace marcada, el SMS de la cita se suprime y el de laboratorio sale igual | 2 | pendiente |
| C9 | Terminología cruzada («Exámenes» nombra tres cosas; captions remiten a nombres que no están en el dock) | 2 | pendiente (diccionario único + prueba) |
| C10 | Uroanálisis: nadie pregunta si hay síntomas urinarios; el motor queda en «REQUIERE SÍNTOMAS» | 2 | pendiente (pregunta en la escalera del reconciliador) |
| C11 | El modal «Laboratorios» ignora la precarga y recalcula todo (3-6 s y red duplicada) | 2 | ⚖️ decidir (regla «el clic consulta en vivo», v12.3.35) |
| C12 | Con factores pendientes el botón «Panel» no existe y el ayudante «Faltan antecedentes» queda inalcanzable | 2 | ⚖️ decidir (botón atenuado «📝 Faltan antecedentes») |
| C13 | `alert()`/`confirm()` nativos siguen vivos en Ordenar y Redactor | 3 | pendiente |
| C14 | `persist` no hace nada en toasts VERDE/AZUL (la leyenda de colores se cierra sola) | 3 | pendiente |
| C15 | Salto de maquetación del recuadro renal en «Laboratorios» | 3 | pendiente |
| C16 | «SIN TERMINAR» se marca con solo abrir Agendar (la preselección ⭐ llama a `markAgendamientoPendiente`) | 3 | pendiente |
| C17 | Agendar exige 3-7 clics por cita | 3 | ⚖️ decidir (stepper de 3 pasos) |
| C18 | Éxitos anunciados dos veces (panel + toast) | 4 | pendiente |
| C19 | Red que compite consigo misma al abrir Agendar (sondeo ±7 días con 3 en vuelo + `cargarHoras` duplicado; `BuscarPacienteDetallado` repetido) | 4 | pendiente |
| C20 | «Exámenes» siempre dos clics (el chooser no recuerda ni admite teclado) | 4 | ⚖️ decidir |
| C21 | Cerrar con clic fuera solo en algunos modales | 5 | pendiente (regla única) |

Patrón común de C1–C4, en palabras del auditor: el asistente sí sabe lo que pasó, pero se lo
comunica al médico por el canal equivocado o en el momento equivocado.
