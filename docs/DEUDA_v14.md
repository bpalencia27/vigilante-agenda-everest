# Catálogo de Deuda Técnica y Marcadores — Vigilante de Agenda (v14)

**Fecha de generación:** 2026-08-20T04:28:12.677Z  
**Archivo analizado:** `vigilante_agenda.user.js`  
**Total de comentarios de deuda catalogados:** 125  

---

## 1. Resumen por Categoría de Impacto

| Categoría de Impacto | Total Hallazgos | Prioridad de Resolución |
|---|---|---|
| 🚨 **Crítico / Clínico** | **16** | Inmediata (M1 - M3) |
| ⚙️ **Arquitectura / Estado** | **5** | Media (M3 - M4) |
| 🧪 **Pruebas / Cobertura** | **3** | Alta (M4) |
| 📝 **Menor / Refactor** | **101** | Baja (M6) |
| **TOTAL** | **125** | — |

---

## 2. Inventario Detallado de Comentarios de Deuda

| # | Línea | Etiqueta | Categoría | Fragmento Verbatim |
|---|---|---|---|---|
| 1 | L1127 | `PARCHE` | **Menor / Refactor** | `también habría activado el parche. Y el replace va en try/catch porque este código se` |
| 2 | L1212 | `PENDIENTE` | **Menor / Refactor** | `para que el analito se avise como pendiente de escribir a mano, no para escribirlo.` |
| 3 | L1231 | `OJO` | **Menor / Refactor** | `OJO: estos códigos NO son los mismos que WHITELIST_13_LABS de arriba — esos son de` |
| 4 | L1827 | `TODO` | **Menor / Refactor** | `devolvía el PRIMER "Numero:" de TODO el texto que se le pasara — si ese texto abarcaba` |
| 5 | L1999 | `TODO` | **Menor / Refactor** | `escaneada SIN texto (ni un solo operador BT en todo el PDF, los 7 streams son` |
| 6 | L2057 | `ADVERTENCIA` | **Crítico / Clínico** | `ADVERTENCIA DE SEGURIDAD, sin adornos: el almacén de Tampermonkey` |
| 7 | L2348 | `TODO` | **Menor / Refactor** | `repetir "RELACION"/"RELACIÓN" a mano) y, sobre todo, sensible a la PUNTUACIÓN. El` |
| 8 | L2540 | `TODO` | **Crítico / Clínico** | `cuyo NOMBRE denote inequívocamente la fecha de la solicitud/toma/orden; todo lo demás` |
| 9 | L2691 | `PENDIENTE` | **Menor / Refactor** | `v11.0.1 — Un analito que aún NO tiene resultado ("PENDIENTE", o estado 1 en` |
| 10 | L2694 | `PENDIENTE` | **Menor / Refactor** | `v14.2.6 — Un componente de orina PENDIENTE (viaComponente) NO suma aquí: en` |
| 11 | L2760 | `PENDIENTE` | **Crítico / Clínico** | `paciente y un número de verdad. Un "> 300" o un "PENDIENTE" no se juzgan (no hay` |
| 12 | L2844 | `PENDIENTE` | **Menor / Refactor** | `(no vacío, no PENDIENTE) del parcial de orina — la misma condición que ya decide` |
| 13 | L2876 | `PENDIENTE` | **Menor / Refactor** | `aunque llegue vacío o PENDIENTE. Sin esto, un duplicado de hace meses del mismo` |
| 14 | L3211 | `TODO` | **Crítico / Clínico** | `Pedido explícito del médico (11-08-2026): a TODO paciente se le debe buscar el` |
| 15 | L3215 | `TODO` | **Crítico / Clínico** | `NUNCA entra en esta regla de vigencia (no todo paciente es diabético). PTH,` |
| 16 | L3249 | `TODO` | **Menor / Refactor** | `Un signo negativo se PIERDE al quitar todo lo que no sea dígito/coma/punto, así que` |
| 17 | L3285 | `TODO` | **Menor / Refactor** | `LA REGLA QUE GOBIERNA TODO ESTO: ante la duda, la regla NO se aplica. Una fila cuyo` |
| 18 | L3296 | `TODO` | **Crítico / Clínico** | `descartaba en todo paciente cuya edad no se hubiera podido leer. Peor todavía: una` |
| 19 | L3510 | `TODO` | **Menor / Refactor** | `acortarse a 90. Se quita todo lo que no sea dígito/coma/punto antes de parsear.` |
| 20 | L3988 | `PENDIENTE` | **Menor / Refactor** | `sigue pendiente cuando ya se hizo. El contenedor #vgl-acciones-dock en sí NUNCA se` |
| 21 | L3998 | `OJO` | **Menor / Refactor** | `aquí y "🧪 Exámenes de Laboratorio" allá) para que el ojo empareje botón y destino` |
| 22 | L4046 | `TODO` | **Menor / Refactor** | `no cambió, no se toca el DOM. La firma cubre todo lo que decide el contenido del dock.` |
| 23 | L4167 | `TODO` | **Menor / Refactor** | `explicando por qué — desaparecerlo del todo haría creer que se perdió otra vez.` |
| 24 | L4220 | `TODO` | **Menor / Refactor** | `el botón pegaba bien todo lo demás y ESA casilla quedaba vacía, y por eso con la` |
| 25 | L4490 | `TODO` | **Menor / Refactor** | `candidatos — así que en cualquier pantalla que las traiga (la gran mayoría), TODO lo` |
| 26 | L4617 | `TODO` | **Menor / Refactor** | `inútiles todo el día. El registro local (vglLog) ya cubre la depuración sin que` |
| 27 | L4628 | `TODO` | **Menor / Refactor** | `Todo trabajo pesado (leer el Excel, indexar, caché) pasa por aquí: cada` |
| 28 | L4636 | `PENDIENTE` | **Menor / Refactor** | `COLA (no ranura única): cada cesión pendiente guarda SU resolución y cada mensaje` |
| 29 | L4685 | `PENDIENTE` | **Menor / Refactor** | `recordatorio (calmado) de PyM pendiente al abrir la historia` |
| 30 | L4693 | `PENDIENTE` | **Menor / Refactor** | `y no se podía cerrar mientras algo siguiera pendiente.` |
| 31 | L4807 | `TODO` | **Crítico / Clínico** | `de conteos anónimos SIN dato de paciente (misma barrera de PHI de todo el reporte).` |
| 32 | L4845 | `PENDIENTE` | **Menor / Refactor** | `debe quedar bloqueada para evitar un duplicado, y la que quedó pendiente debe seguir` |
| 33 | L4935 | `PENDIENTE` | **Menor / Refactor** | `v14.2.4 — COLA DE CONDUCTA PENDIENTE (a pedido explícito del médico: Conducta pasa a` |
| 34 | L4949 | `PENDIENTE` | **Menor / Refactor** | `puede mostrar SOLO lo que sigue pendiente (p. ej. las remisiones AV/OD, que no se` |
| 35 | L4950 | `TODO` | **Crítico / Clínico** | `ordenan desde el panel) en vez de callarse del todo.` |
| 36 | L4984 | `TODO` | **Menor / Refactor** | `6.0 minutos rígidos de gracia para todo el mundo` |
| 37 | L5010 | `TODO` | **Menor / Refactor** | `luz mala y presbicia. Se escala TODO el asistente de una vez con `zoom`` |
| 38 | L5138 | `TODO` | **Menor / Refactor** | `buscar esto por adelantado para todo el panel: eso exigiría llamadas de red por cada` |
| 39 | L5177 | `PENDIENTE` | **Crítico / Clínico** | `en `window.state` el mapa completo de pacientes con PyM pendiente (cédulas y` |
| 40 | L5180 | `TODO` | **Menor / Refactor** | `v12.0.0 — RETIRADO todo lo demás que colgaba de la ventana real de la página. Arriba` |
| 41 | L5215 | `TODO` | **Menor / Refactor** | `(CSP, entorno raro), TODO cae al setInterval de siempre sin perder nada.` |
| 42 | L5334 | `TODO` | **Menor / Refactor** | `terminaba siendo siempre una pestaña dormida: vigilancia muerta todo el día.` |
| 43 | L5459 | `TODO` | **Menor / Refactor** | `se respeta tal cual; solo se arregla el que viene TODO EN MAYÚSCULAS.` |
| 44 | L5477 | `TODO` | **Menor / Refactor** | `v12.4.0 — Pendientes que QUEDAN para el aviso de la historia: todo lo del índice PyM` |
| 45 | L5506 | `PENDIENTE` | **Menor / Refactor** | `panel "sin PyM pendiente" (está en la base, al día) de "no aparece en la base"` |
| 46 | L5522 | `PENDIENTE` | **Menor / Refactor** | `pendiente" más (su vocabulario es Si/No, no Susceptible/Tamizar), así que se rastrea` |
| 47 | L5545 | `PENDIENTE` | **Menor / Refactor** | `de Tamizacion_cervix (que normalmente es solo "Susceptible"/"Pendiente"` |
| 48 | L5565 | `PENDIENTE` | **Pruebas / Cobertura** | `Caso raro pero posible: Prueba_cervix trae un tipo de prueba pendiente pero` |
| 49 | L5566 | `PENDIENTE` | **Arquitectura / Estado** | `Tamizacion_cervix NO estaba pendiente en esa fila (p. ej. datos inconsistentes` |
| 50 | L5572 | `PENDIENTE` | **Crítico / Clínico** | `Solo se guardan los pacientes que SÍ tienen algo pendiente. Así el número que` |
| 51 | L6149 | `TODO` | **Menor / Refactor** | `UN ARCHIVO POR DÍA. Antes todo vivía en una sola clave y cada evento reescribía los` |
| 52 | L6176 | `TODO` | **Menor / Refactor** | `justifica todo esto: si el equipo se apaga o se cierra el navegador en esos dos` |
| 53 | L6406 | `TODO` | **Menor / Refactor** | `reconocían), navegador, sistema, tamaño de pantalla y zona horaria. Todo del entorno` |
| 54 | L6733 | `TODO` | **Menor / Refactor** | `La versión anterior era: quitar los tramos de 6+ dígitos, y DESPUÉS quitar todo lo que` |
| 55 | L6867 | `OJO` | **Menor / Refactor** | `OJO: esta guarda SOLO aplica a los tokens con mes en letras. A los numéricos NO:` |
| 56 | L6974 | `OJO` | **Menor / Refactor** | `OJO: se borra TAMBIÉN la marca "vgl_pym_dia"; si queda puesta, el captador de la` |
| 57 | L7133 | `TODO` | **Menor / Refactor** | `sustituye todo el mapa de PyM, no lo mezcla).` |
| 58 | L7440 | `PENDIENTE` | **Menor / Refactor** | `y pasarla a los 4 llamadores SÍNCRONOS, dejando fresca la vía diferida) queda pendiente.` |
| 59 | L7519 | `PENDIENTE` | **Menor / Refactor** | `pendiente" cruzado contra la base vieja hasta el siguiente tick del intervalo de` |
| 60 | L7815 | `PENDIENTE` | **Menor / Refactor** | `historia salían hasta tres modales en fila (PyM pendiente → abandono RCV → labs vencidos),` |
| 61 | L7901 | `PENDIENTE` | **Crítico / Clínico** | `El aviso principal ya salió. Único pendiente posible: salió SIN labs (Athenea lenta) y` |
| 62 | L8143 | `TODO` | **Menor / Refactor** | `"los sonidos, alertas visuales, etc., todo a la vez sobrecarga; una sola notificación` |
| 63 | L8160 | `TODO` | **Menor / Refactor** | `El silencio temporal (muteFor) y el interruptor S.sonido siguen mandando sobre todo` |
| 64 | L8244 | `TODO` | **Menor / Refactor** | `tragarse en silencio todo lo avisado desde entonces — el mismo fallo, más tarde.` |
| 65 | L8322 | `TODO` | **Menor / Refactor** | `se vuelve solo al método de siempre. Nunca se queda sin vigilar.` |
| 66 | L8460 | `OJO` | **Menor / Refactor** | `Ojo: excluir al médico y a la especialidad, o el panel mostraría el nombre` |
| 67 | L8634 | `TODO` | **Menor / Refactor** | `v12.3.8 — Pedido explícito del médico: cadencia prudente casi todo el día y` |
| 68 | L8651 | `PENDIENTE` | **Menor / Refactor** | `45 s (LEJANO) o cada 90 s si no había ninguna cita pendiente (SIN_PENDIENTES): un` |
| 69 | L11796 | `OJO` | **Menor / Refactor** | `OJO: pageFetchJson/_pageFetchJsonCore NUNCA lanzan — tragan cualquier fallo (4xx, 5xx` |
| 70 | L12182 | `TODO` | **Menor / Refactor** | `v11.0.1 — Sin valores fabricados: el "07:00:00" y sobre todo el agendaId` |
| 71 | L12195 | `TODO` | **Menor / Refactor** | `diferencia de `consultarCita()`, que sí baja todo a minúsculas para el` |
| 72 | L12395 | `TODO` | **Menor / Refactor** | `XHR — y aun así todo va dentro de try/catch;` |
| 73 | L12542 | `PENDIENTE` | **Menor / Refactor** | `nombre contra la whitelist, descartar los PENDIENTE y quedarse con la fecha más nueva` |
| 74 | L12562 | `TODO` | **Menor / Refactor** | `más consecuencias de todo el script: de este estadio cuelga qué exámenes se piden.` |
| 75 | L12757 | `PENDIENTE` | **Menor / Refactor** | `sin vigencia confirmada: siempre pendiente (D4)` |
| 76 | L12900 | `PENDIENTE` | **Menor / Refactor** | `La anulación de la cita de LABORATORIO queda pendiente: su portal solo abre en la red` |
| 77 | L15508 | `PENDIENTE` | **Menor / Refactor** | `toma de muestras quedó pendiente (turno agotado, fallo de red, etc. en el intento` |
| 78 | L15792 | `OJO` | **Menor / Refactor** | `OJO con el código: la microalbuminuria es 903026, NO 903028 como afirmaba la` |
| 79 | L15803 | `PENDIENTE` | **Crítico / Clínico** | `contra una orden guardada) y el propio documento los deja como "pendiente de` |
| 80 | L16734 | `TODO` | **Menor / Refactor** | `cambio queda en un BORRADOR; la barra fija ofrece Guardar (aplica y persiste TODO` |
| 81 | L16782 | `TODO` | **Pruebas / Cobertura** | `Todo lo técnico (reportes, pruebas, clave de la IA, diagnóstico) vive aquí y NO es` |
| 82 | L17121 | `TODO` | **Arquitectura / Estado** | `(ver perfilAdicionalCache, arriba) — nunca se sale a pedirlo por adelantado para todo el` |
| 83 | L17369 | `PENDIENTE` | **Menor / Refactor** | `notar un seguimiento pendiente. Mismos otros dos sitios en abandonoPESAlert() y en` |
| 84 | L17375 | `TODO` | **Menor / Refactor** | `cuando la cita queda agendada, y todo caduca al terminar el día.` |
| 85 | L17468 | `TODO` | **Menor / Refactor** | `Saludo AZUL: UNA sola vez al día en todo el navegador (antes salía en cada pestaña/recarga).` |
| 86 | L17584 | `TODO` | **Arquitectura / Estado** | `hiciera lanzar a colorAndAlert abortaba TODO el .map(): el catch de tick() (más` |
| 87 | L17595 | `TODO` | **Menor / Refactor** | `v14.1.5 — ...pero SOLO la primera vez del día en TODO el navegador, no una vez` |
| 88 | L17672 | `TODO` | **Menor / Refactor** | `v14.1.9 — La cabecera del informe descargable filtraba lo que todo el resto del` |
| 89 | L18147 | `TODO` | **Menor / Refactor** | `Esconde/muestra TODO lo visual del Vigilante sin apagar su trabajo de` |
| 90 | L18154 | `TODO` | **Menor / Refactor** | `como niños — todo bien masticado». Reglas de diseño, decididas en entrevista:` |
| 91 | L18401 | `TODO` | **Menor / Refactor** | `comportamiento cuando todo sale bien.` |
| 92 | L18428 | `PENDIENTE` | **Menor / Refactor** | `cola cada 10 min (sale de inmediato si no hay nada pendiente).` |
| 93 | L18445 | `PENDIENTE` | **Menor / Refactor** | `v12.5.0 — telemetría de uso del panel: la ventana pendiente de otro día sale al` |
| 94 | L18483 | `TODO` | **Menor / Refactor** | `y en cuanto el real aparece, loadPymDiario reemplaza TODO (applyPymIdx → panel` |
| 95 | L18491 | `TODO` | **Menor / Refactor** | `v7.8.1: si después de todo esto sigue sin haber NADA cargado (ni PyM de hoy ni` |
| 96 | L18670 | `OJO` | **Arquitectura / Estado** | `OJO — DIVERGENCIA ABIERTA (15-ago-2026). La tabla del Copiloto tiene dos` |
| 97 | L19465 | `OJO` | **Menor / Refactor** | `OJO con la normalización: el Copiloto usa `_normalizar` y NO `.lower()` a` |
| 98 | L19781 | `TODO` | **Menor / Refactor** | `una lista a medias, que se leeria como "esto es todo lo que toma".` |
| 99 | L19811 | `PENDIENTE` | **Menor / Refactor** | `pendiente de la captura real de los factores de riesgo` |
| 100 | L19815 | `TODO` | **Menor / Refactor** | ``motivo`, para que la ausencia de avisos nunca se lea como "todo bien".` |
| 101 | L19882 | `PENDIENTE` | **Menor / Refactor** | `captura real es "PENDIENTE"; "ANULADA" aparece en el fixture sintético` |
| 102 | L19908 | `PENDIENTE` | **Menor / Refactor** | `p.ej. ["PENDIENTE"]; null = todos` |
| 103 | L19956 | `TODO` | **Menor / Refactor** | `parcial, que se leería como "esto es todo lo que toma".` |
| 104 | L20399 | `TODO` | **Crítico / Clínico** | `Todo lo que el médico tiene que ver de este paciente, en un solo sitio y con` |
| 105 | L20451 | `TODO` | **Crítico / Clínico** | `1. TODO texto que venga de Everest pasa por `escapeHtml`. Los nombres de` |
| 106 | L20485 | `TODO` | **Menor / Refactor** | `Pinta un aviso. `escapeHtml` en TODO lo que venga de fuera.` |
| 107 | L20722 | `TODO` | **Menor / Refactor** | `que ya rige todo el bloque mtr*: una excepción a mitad de consulta es peor` |
| 108 | L20873 | `OJO` | **Menor / Refactor** | `--- Hábitos y gestión de riesgo (¡ojo con el espacio final!) ---` |
| 109 | L21057 | `TODO` | **Crítico / Clínico** | `Evaluación renal completa. Todo entra por parámetro: sin DOM, sin reloj.` |
| 110 | L21546 | `TODO` | **Menor / Refactor** | `PRÓXIMO de todo lo que hay que vigilar, y si ese día cae en domingo o` |
| 111 | L21643 | `TODO` | **Menor / Refactor** | `Todo lo que falta o venció + lo cosechado + los pasajeros que no estén` |
| 112 | L21683 | `PENDIENTE` | **Menor / Refactor** | `pendiente. Cumplía D4 (no desaparecer en silencio) a costa de estar` |
| 113 | L21722 | `TODO` | **Menor / Refactor** | `solo objeto. Todo entra por parámetro: es la misma función que usan las` |
| 114 | L21739 | `TODO` | **Arquitectura / Estado** | `REGLA DE LA CASA: todo-o-nada. Si falta un insumo (PAS, tabaquismo…) el` |
| 115 | L21825 | `TODO` | **Menor / Refactor** | `profundidad: todo lo que sea texto pasa igual por scrubPII.` |
| 116 | L22155 | `PENDIENTE` | **Menor / Refactor** | `cuál de las palabras en mayúsculas lo es. Queda pendiente de decisión del médico.` |
| 117 | L22247 | `TODO` | **Menor / Refactor** | `IA tenga en cuenta en ESTE borrador. Pasa por el mismo censor de nombres que todo.` |
| 118 | L22302 | `TODO` | **Menor / Refactor** | `del marcador; si no encuentra secciones, devuelve todo como análisis (nunca se pierde` |
| 119 | L22781 | `TODO` | **Menor / Refactor** | ``opts.ocultarCabeceraRiesgoEIA` deja fuera solo esas dos piezas; todo lo demás del` |
| 120 | L23325 | `TODO` | **Menor / Refactor** | `Todo PURO, sin DOM ni red, igual que el resto del bloque mtr*.` |
| 121 | L23428 | `PENDIENTE` | **Menor / Refactor** | `Paso 4 pendiente: primero hay que clasificar, todo lo demás espera.` |
| 122 | L23488 | `TODO` | **Menor / Refactor** | `parte del Copiloto que no está en los módulos sueltos). Todo PURO.` |
| 123 | L23810 | `TODO` | **Crítico / Clínico** | `CSS del bloque. Mismas convenciones que el recuadro renal: todo cuelga de` |
| 124 | L23847 | `TODO` | **Pruebas / Cobertura** | `#vgl-tip-pop cuelga de <body>, no de un modal (ver suite 06: "todo overlay` |
| 125 | L23851 | `TODO` | **Menor / Refactor** | `de reserva literal en cada var(...) por si acaso. Todo color lleva` |
