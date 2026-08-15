# Catálogo de Deuda Técnica y Marcadores — Vigilante de Agenda (v14)

**Fecha de generación:** 2026-08-14T23:17:04.186Z  
**Archivo analizado:** `vigilante_agenda.user.js`  
**Total de comentarios de deuda catalogados:** 74  

---

## 1. Resumen por Categoría de Impacto

| Categoría de Impacto | Total Hallazgos | Prioridad de Resolución |
|---|---|---|
| 🚨 **Crítico / Clínico** | **10** | Inmediata (M1 - M3) |
| ⚙️ **Arquitectura / Estado** | **1** | Media (M3 - M4) |
| 🧪 **Pruebas / Cobertura** | **1** | Alta (M4) |
| 📝 **Menor / Refactor** | **62** | Baja (M6) |
| **TOTAL** | **74** | — |

---

## 2. Inventario Detallado de Comentarios de Deuda

| # | Línea | Etiqueta | Categoría | Fragmento Verbatim |
|---|---|---|---|---|
| 1 | L1063 | `PARCHE` | **Menor / Refactor** | `también habría activado el parche. Y el replace va en try/catch porque este código se` |
| 2 | L1139 | `PENDIENTE` | **Menor / Refactor** | `para que el analito se avise como pendiente de escribir a mano, no para escribirlo.` |
| 3 | L1158 | `OJO` | **Menor / Refactor** | `OJO: estos códigos NO son los mismos que WHITELIST_13_LABS de arriba — esos son de` |
| 4 | L1649 | `TODO` | **Menor / Refactor** | `devolvía el PRIMER "Numero:" de TODO el texto que se le pasara — si ese texto abarcaba` |
| 5 | L1805 | `TODO` | **Menor / Refactor** | `Posición del formulario DENTRO de `ventana` (que arranca en `desde`): todo lo` |
| 6 | L1818 | `TODO` | **Menor / Refactor** | `escaneada SIN texto (ni un solo operador BT en todo el PDF, los 7 streams son` |
| 7 | L1876 | `ADVERTENCIA` | **Crítico / Clínico** | `ADVERTENCIA DE SEGURIDAD, sin adornos: el almacén de Tampermonkey` |
| 8 | L2099 | `TODO` | **Menor / Refactor** | `repetir "RELACION"/"RELACIÓN" a mano) y, sobre todo, sensible a la PUNTUACIÓN. El` |
| 9 | L2291 | `TODO` | **Crítico / Clínico** | `cuyo NOMBRE denote inequívocamente la fecha de la solicitud/toma/orden; todo lo demás` |
| 10 | L2379 | `PENDIENTE` | **Menor / Refactor** | `v11.0.1 — Un analito que aún NO tiene resultado ("PENDIENTE", o estado 1 en` |
| 11 | L2439 | `PENDIENTE` | **Menor / Refactor** | `(no vacío, no PENDIENTE) del parcial de orina — la misma condición que ya decide` |
| 12 | L2468 | `PENDIENTE` | **Menor / Refactor** | `aunque llegue vacío o PENDIENTE. Sin esto, un duplicado de hace meses del mismo` |
| 13 | L2768 | `TODO` | **Crítico / Clínico** | `Pedido explícito del médico (11-08-2026): a TODO paciente se le debe buscar el` |
| 14 | L2772 | `TODO` | **Crítico / Clínico** | `NUNCA entra en esta regla de vigencia (no todo paciente es diabético). PTH,` |
| 15 | L2806 | `TODO` | **Menor / Refactor** | `Un signo negativo se PIERDE al quitar todo lo que no sea dígito/coma/punto, así que` |
| 16 | L2821 | `TODO` | **Menor / Refactor** | `acortarse a 90. Se quita todo lo que no sea dígito/coma/punto antes de parsear.` |
| 17 | L3291 | `PENDIENTE` | **Menor / Refactor** | `sigue pendiente cuando ya se hizo. El contenedor #vgl-acciones-dock en sí NUNCA se` |
| 18 | L3645 | `TODO` | **Menor / Refactor** | `inútiles todo el día. El registro local (vglLog) ya cubre la depuración sin que` |
| 19 | L3656 | `TODO` | **Menor / Refactor** | `Todo trabajo pesado (leer el Excel, indexar, caché) pasa por aquí: cada` |
| 20 | L3664 | `PENDIENTE` | **Menor / Refactor** | `COLA (no ranura única): cada cesión pendiente guarda SU resolución y cada mensaje` |
| 21 | L3714 | `PENDIENTE` | **Menor / Refactor** | `recordatorio (calmado) de PyM pendiente al abrir la historia` |
| 22 | L3976 | `PENDIENTE` | **Menor / Refactor** | `debe quedar bloqueada para evitar un duplicado, y la que quedó pendiente debe seguir` |
| 23 | L4028 | `PENDIENTE` | **Menor / Refactor** | `puede mostrar SOLO lo que sigue pendiente (p. ej. las remisiones AV/OD, que no se` |
| 24 | L4029 | `TODO` | **Crítico / Clínico** | `ordenan desde el panel) en vez de callarse del todo.` |
| 25 | L4074 | `TODO` | **Menor / Refactor** | `6.0 minutos rígidos de gracia para todo el mundo` |
| 26 | L4215 | `PENDIENTE` | **Crítico / Clínico** | `en `window.state` el mapa completo de pacientes con PyM pendiente (cédulas y` |
| 27 | L4218 | `TODO` | **Menor / Refactor** | `v12.0.0 — RETIRADO todo lo demás que colgaba de la ventana real de la página. Arriba` |
| 28 | L4252 | `TODO` | **Menor / Refactor** | `terminaba siendo siempre una pestaña dormida: vigilancia muerta todo el día.` |
| 29 | L4365 | `TODO` | **Menor / Refactor** | `se respeta tal cual; solo se arregla el que viene TODO EN MAYÚSCULAS.` |
| 30 | L4383 | `TODO` | **Menor / Refactor** | `v12.4.0 — Pendientes que QUEDAN para el aviso de la historia: todo lo del índice PyM` |
| 31 | L4412 | `PENDIENTE` | **Menor / Refactor** | `panel "sin PyM pendiente" (está en la base, al día) de "no aparece en la base"` |
| 32 | L4428 | `PENDIENTE` | **Menor / Refactor** | `pendiente" más (su vocabulario es Si/No, no Susceptible/Tamizar), así que se rastrea` |
| 33 | L4451 | `PENDIENTE` | **Menor / Refactor** | `de Tamizacion_cervix (que normalmente es solo "Susceptible"/"Pendiente"` |
| 34 | L4471 | `PENDIENTE` | **Pruebas / Cobertura** | `Caso raro pero posible: Prueba_cervix trae un tipo de prueba pendiente pero` |
| 35 | L4472 | `PENDIENTE` | **Arquitectura / Estado** | `Tamizacion_cervix NO estaba pendiente en esa fila (p. ej. datos inconsistentes` |
| 36 | L4478 | `PENDIENTE` | **Crítico / Clínico** | `Solo se guardan los pacientes que SÍ tienen algo pendiente. Así el número que` |
| 37 | L5043 | `TODO` | **Menor / Refactor** | `UN ARCHIVO POR DÍA. Antes todo vivía en una sola clave y cada evento reescribía los` |
| 38 | L5070 | `TODO` | **Menor / Refactor** | `justifica todo esto: si el equipo se apaga o se cierra el navegador en esos dos` |
| 39 | L5228 | `TODO` | **Menor / Refactor** | `reconocían), navegador, sistema, tamaño de pantalla y zona horaria. Todo del entorno` |
| 40 | L5465 | `OJO` | **Menor / Refactor** | `OJO: esta guarda SOLO aplica a los tokens con mes en letras. A los numéricos NO:` |
| 41 | L5572 | `OJO` | **Menor / Refactor** | `OJO: se borra TAMBIÉN la marca "vgl_pym_dia"; si queda puesta, el captador de la` |
| 42 | L5731 | `TODO` | **Menor / Refactor** | `sustituye todo el mapa de PyM, no lo mezcla).` |
| 43 | L6046 | `PENDIENTE` | **Menor / Refactor** | `(p. ej. PyM pendiente + labs vencidos a la vez): cada check creaba su propio overlay` |
| 44 | L6066 | `TODO` | **Menor / Refactor** | `todo; ahora muestra SOLO lo que queda pendiente (típicamente las remisiones a` |
| 45 | L6136 | `PENDIENTE` | **Menor / Refactor** | `pendiente" cruzado contra la base vieja hasta el siguiente tick del intervalo de` |
| 46 | L6299 | `TODO` | **Menor / Refactor** | `de color que usa todo el CSS del recordatorio: hereda a chips, botón y borde.` |
| 47 | L6638 | `TODO` | **Menor / Refactor** | `tragarse en silencio todo lo avisado desde entonces — el mismo fallo, más tarde.` |
| 48 | L6716 | `TODO` | **Menor / Refactor** | `se vuelve solo al método de siempre. Nunca se queda sin vigilar.` |
| 49 | L6852 | `OJO` | **Menor / Refactor** | `Ojo: excluir al médico y a la especialidad, o el panel mostraría el nombre` |
| 50 | L7024 | `TODO` | **Menor / Refactor** | `v12.3.8 — Pedido explícito del médico: cadencia prudente casi todo el día y` |
| 51 | L9786 | `OJO` | **Menor / Refactor** | `OJO: pageFetchJson/_pageFetchJsonCore NUNCA lanzan — tragan cualquier fallo (4xx, 5xx` |
| 52 | L10081 | `TODO` | **Menor / Refactor** | `v11.0.1 — Sin valores fabricados: el "07:00:00" y sobre todo el agendaId` |
| 53 | L10094 | `TODO` | **Menor / Refactor** | `diferencia de `consultarCita()`, que sí baja todo a minúsculas para el` |
| 54 | L10306 | `PENDIENTE` | **Menor / Refactor** | `nombre contra la whitelist, descartar los PENDIENTE y quedarse con la fecha más nueva` |
| 55 | L10326 | `TODO` | **Menor / Refactor** | `más consecuencias de todo el script: de este estadio cuelga qué exámenes se piden.` |
| 56 | L10358 | `TODO` | **Crítico / Clínico** | `con todo lo que eso arrastra (remisión a nefrología, ajuste de dosis, suspensión de` |
| 57 | L10552 | `PENDIENTE` | **Menor / Refactor** | `sin vigencia confirmada: siempre pendiente (D4)` |
| 58 | L11124 | `TODO` | **Menor / Refactor** | `v12.0.0 — El color por defecto ya NO es verde. Pintar de verde todo lo que no` |
| 59 | L11138 | `TODO` | **Menor / Refactor** | `médico vea el documento oficial sin navegar todo el portal a mano.` |
| 60 | L12043 | `TODO` | **Menor / Refactor** | `hora/fecha mostradas en el mensaje de éxito. Todo lo que describe al turno se` |
| 61 | L12200 | `PENDIENTE` | **Menor / Refactor** | `toma de muestras quedó pendiente (turno agotado, fallo de red, etc. en el intento` |
| 62 | L12433 | `OJO` | **Menor / Refactor** | `OJO con el código: la microalbuminuria es 903026, NO 903028 como afirmaba la` |
| 63 | L12444 | `PENDIENTE` | **Crítico / Clínico** | `contra una orden guardada) y el propio documento los deja como "pendiente de` |
| 64 | L12838 | `TODO` | **Menor / Refactor** | `reemplaza TODO el innerHTML de una sola vez (igual que hacía el código original)` |
| 65 | L12927 | `TODO` | **Menor / Refactor** | `v12.3.22 — Contenido real, reemplazando TODO el innerHTML de una sola vez (igual` |
| 66 | L13189 | `PENDIENTE` | **Crítico / Clínico** | `contenido de Everest (no lo tapa) y NO se puede cerrar mientras algo siga pendiente —` |
| 67 | L13215 | `OJO` | **Menor / Refactor** | `Ojo con la distinción de v12.4.1: `undefined` = marca vieja sin detalle (no se puede` |
| 68 | L13905 | `PENDIENTE` | **Menor / Refactor** | `notar un seguimiento pendiente. Mismos otros dos sitios en abandonoPESAlert() y en` |
| 69 | L13972 | `TODO` | **Menor / Refactor** | `Saludo AZUL: UNA sola vez al día en todo el navegador (antes salía en cada pestaña/recarga).` |
| 70 | L14102 | `TODO` | **Menor / Refactor** | `v14.1.5 — ...pero SOLO la primera vez del día en TODO el navegador, no una vez` |
| 71 | L14506 | `PENDIENTE` | **Menor / Refactor** | `cola cada 10 min (sale de inmediato si no hay nada pendiente).` |
| 72 | L14509 | `PENDIENTE` | **Menor / Refactor** | `v12.5.0 — telemetría de uso del panel: la ventana pendiente de otro día sale al` |
| 73 | L14538 | `TODO` | **Menor / Refactor** | `y en cuanto el real aparece, loadPymDiario reemplaza TODO (applyPymIdx → panel` |
| 74 | L14546 | `TODO` | **Menor / Refactor** | `v7.8.1: si después de todo esto sigue sin haber NADA cargado (ni PyM de hoy ni` |
