# Refutación de «el cableado de CancelarCita es correcto»

Auditoría adversarial, SOLO LECTURA, sobre `vigilante_agenda.user.js` (cabeza `00d0465`, v18.0.116).
Objeto: panel «Recordatorio de la cita» → «🗑 Cancelar esta cita» → `_cancelarCitaConPregunta`
(L21584) → `_anularCitaAsignadaReal` (L21649) → `POST /apiviva/APIAcceso/api/Acceso/CancelarCita`.
Síntoma en vivo: «Everest NO confirmó la anulación».

Datos: todos sintéticos. Ningún archivo del repositorio fue modificado. Script de reproducción:
`scratchpad/cancelar/repro_cancelar.js` (arnés `tests/harness.js`, `fetch` interceptado).
Banco: `node tests/runner.js` → 72 suites en verde, cero `✗` (el árbol actual está sano; el
defecto no es una regresión que el banco vea, porque el banco solo comprueba lo que el código
*cree* que Everest espera).

---

## 0. Resumen de una frase

**No se puede afirmar que el cableado sea correcto, porque el único contrato real (la captura
del 19-ago) no existe en el repositorio ni en su historial; lo que existe es una transcripción
de memoria en código, y esa transcripción tiene tres desvíos verificables respecto de la única
escritura APIAcceso que sí funciona (AsignarTurno): tipos en el cuerpo, `Ip` vacío y un motivo
libre fuera del catálogo de Everest.** La transición `pageFetchJson` → `_apiPostConDetalle`
(v18.0.114) NO cambió la petición en el cable (solo añade `Accept`), así que no es la causa: el
fallo es anterior a ese commit (el propio reporte que lo motivó ya era «NO confirmó», dos veces).

---

## 1. Hechos verificados (con evidencia)

### 1.1 La petición que sale hoy (arnés, escenario 1)

```
POST https://neps.everestintelligent.com/apiviva/APIAcceso/api/Acceso/CancelarCita
     ?CitaId=7813686&PacienteId=55555&Observacion=Anulada%20desde%20el%20Vigilante
     &Ip=&UsuarioId=707&UsuarioNombreCompleto=MEDICO%20PRUEBA
headers: {"Content-Type":"application/json","Accept":"application/json"}   (sin `credentials`)
body:    {"citaId":"7813686","eps":"EPS PRUEBA","estado":"CAN","pacienteId":"55555",
          "usuarioId":707,"observacion":"Anulada desde el Vigilante",
          "usuarioNombreCompleto":"MEDICO PRUEBA","ip":""}
```

### 1.2 Las escrituras que SÍ funcionan en consulta (arnés, escenario 2)

```
POST .../api/Acceso/AsignarTurno?OrdenMongoId=null&TurnoId=7813686&Marcacion=Consulta
     &PacienteId=55555&FechaDeseada=2026-10-01&TipoConsulta=PRESENCIAL&Ip=127.0.0.1
     &UsuarioId=707&CodigoCups=null&SwProgramaEspecial=false&swIsPac=false&swIsPyM=false
     &ObservacionCita=...&FechaMinimaConsultaOrden=null&Tratamiento=false&Consulta=false
     &Emergencia=false&PresupuestoId=0
headers: {"Content-Type":"application/json","Accept":"application/json"}   body: "{}"
GET  .../api/SMS/EnviarSMS?Telefono=...&AgendaTurnoId=7813686   credentials:"include"
```

Diferencias objetivas CancelarCita vs AsignarTurno: (a) AsignarTurno manda TODO por query y un
cuerpo `{}`; CancelarCita manda query + cuerpo JSON con campos que NO están en la query (`eps`,
`estado`) y con tipos mezclados; (b) `Ip=127.0.0.1` vs `Ip=` (vacío); (c) `UsuarioNombreCompleto`
solo lo manda CancelarCita (sin precedente que funcione).

### 1.3 La captura del 19-ago NO está en el repositorio

- `git log --all -S"CancelarCita" --name-only`: solo `vigilante_agenda.user.js`,
  `tests/suite_15_interfaz_avanzada.js`, `tests/INFORME_MUTACIONES.md`, `CHANGELOG.md` y un
  `everest_telemetry_PRO_20260808_1247 (2).json` (commit `206458e`) cuyo único `CancelarCita`
  es el de **AppCita laboratorio** (`appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/
  CancelarCita?codigo=…`), otro servicio, sin relación.
- `grounding/API_EVEREST.md` (23 esquemas, generado de las capturas) **no lista CancelarCita**.
  `grounding/esquemas/` tampoco. `tests/fixtures/` tampoco. Cero coincidencias de
  `"Cancelado Correctamente"` fuera de los tests que lo asumen.
- CHANGELOG v15.5.0 (`git show 3ad93c1 -- CHANGELOG.md`, «gracias por el .json del consultorio»)
  confirma que el JSON existió **fuera** del repo. `.gitignore` excluye `*.har`, no `.json`, así
  que simplemente nunca se agregó.
- Consecuencia: la única codificación del contrato es el propio código (`3ad93c1`, 22-ago) y
  su test (`suite_15` L4340-4358 en `3ad93c1`), que **solo** afirma `CitaId=`, `PacienteId=`,
  `UsuarioId=` en la query y `estado:"CAN"` + `observacion` en el cuerpo. No fija tipos, ni
  `Ip`, ni `eps`, ni el método, ni el nombre exacto de los campos del cuerpo. El «mismos
  parámetros en la URL y en el cuerpo» del comentario ya es falso en el propio código: el
  cuerpo lleva `eps` y `estado` que la URL no lleva, y la URL no lleva nada que el cuerpo no
  lleve; nadie puede decir hoy cuál de los dos lados copió bien la captura.

### 1.4 Historia de la función (git log -p -S"CancelarCita")

| Commit | Fecha | Cambio en la petición |
|---|---|---|
| `3ad93c1` (v17.6.2, contiene la nota v15.5.0 del 19-ago) | 22-ago | Primera versión: `pageFetchJson(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({citaId:String, eps, estado:"CAN", pacienteId:String, usuarioId:num, observacion, usuarioNombreCompleto, ip:""})})`; query `CitaId&PacienteId&Observacion&Ip=&UsuarioId&UsuarioNombreCompleto`; veredicto `res.error === false`. Motivo elegido de un catálogo de 4 opciones en el modal Agendar (L18952 en ese commit). |
| `0bcaa4b`, `cb63c71` | 23/28-ago | Sin cambio en la petición (publicación / docs). |
| `1d2ff06` (v17.6.70) | 26-ago | `markCitaAgendadaHoy` fusiona en vez de reemplazar (el citaId ya no se borraba). |
| `05f52d9` (v18.0.114) | 02-sep | `pageFetchJson` → `_apiPostConDetalle`; veredicto → `_anulacionConfirmada`; motivo → `_anulacionMotivo`; bitácora `CancelarCitaOk/Fallo` con `status` y extracto. **URL, query y cuerpo idénticos byte a byte.** |

Diferencia real en el cable entre v18.0.113 y v18.0.114: `_pageFetchJsonCore` hacía
`Object.assign({headers:{CT,Accept}}, options, {signal})` (L19911-19913) y `options.headers`
**pisaba** el objeto entero → antes salía solo `Content-Type`; ahora salen `Content-Type` y
`Accept: application/json`. Ambas vías usan `FETCH0` (window.fetch atado a la página, L1180),
origen absoluto `location.origin + path`, sin `credentials` (mismo-origen → cookies van igual),
`AbortController` de 15 s. Ninguna reintenta (escritura). **Conclusión Q2b: `_apiPostConDetalle`
manda lo mismo que mandaba `pageFetchJson` salvo el `Accept` extra; no es la causa** (y el
reporte «NO confirmó» que motivó v18.0.114 ya ocurría con `pageFetchJson`).

### 1.5 CitaId = radicado = TurnoId = AgendaTurnoId (captura real del 10-ago)

`captura_agendamiento_oficial_20260810.json` (app oficial de Everest en `/viva/Acceso/`):
- `AsignarTurno?...&TurnoId=<7 dígitos>` → respuesta `data.radicado` = **el mismo número**.
- `EnviarSMS?...&AgendaTurnoId=<7 dígitos>` = **el mismo número**.
- `ImprimirRecordatorioCita?CitaId=<radicado>` (contrato capturado tras pulsar el «Imprimir»
  oficial, comentario L21774-21779).
- El `citaId` que Everest usa en HC (`GetValidacionExamenCronicos?citaId=<b64 de 7 dígitos>`,
  L20857; `FinalizarTicket&EverestId=<b64(citaId)>`, L20742) es de la misma magnitud.

Es decir, para Everest **una cita se identifica por el número del turno** y `radicado` es
ese número. `markCitaAgendadaHoy` guarda `citaId: d.radicado` y `turnoId: turnoId` (L27211,
L27219) — son el mismo valor. **Conclusión Q1: `CitaId=<radicado>` es la lectura coherente con
toda la evidencia; NO hay evidencia de un id de cita distinto.** El `citaId` de
`state.lastSnapshot.list` (L15423, de `/ObtenerConsultas`) es el id de la cita de HOY (la
consulta en curso), no el de la cita futura que se creó; usarlo sería cancelar la consulta
actual. No hay ningún `agendaTurnoId` distinto en el código ni en las capturas.

---

## 2. Hallazgos, por gravedad

### H1 — ALTA · El contrato no es verificable: la captura del 19-ago no está en el repo
- Evidencia: §1.3. La regla del proyecto («contrato REAL, no inventado», L21774) se cumple para
  ImprimirRecordatorioCita/EnviarSMS/AsignarTurno (hay esquema en `grounding/`) y **no** para
  CancelarCita.
- Efecto: cualquier discusión de «cableado» hoy es de memoria. Los hallazgos H3-H5 son
  exactamente los puntos donde el código pudo desviarse de la captura sin que nadie lo note.
- Corrección mínima (sin aplicar): pedirle al médico el `.json` del 19-ago (lo tiene: CHANGELOG
  v15.5.0), pasarlo por `tools/generar_grounding.js` (redacta valores) y añadir
  `grounding/esquemas/apiviva_APIAcceso_api_Acceso_CancelarCita.json` con `esquemaPeticion`
  (query + cuerpo + **tipos**). Luego un test golden que compare la petición del arnés
  (escenario 1) campo por campo y tipo por tipo contra ese esquema. Si el JSON ya no existe:
  volver a grabar UNA anulación desde la app oficial con `GRABADOR_1_INICIAR.js` (captura
  `reqBody` como cadena y `status/resBody`).

### H2 — ALTA · El diagnóstico ya está a mano y no se ha leído: status + extracto en la bitácora
- Desde v18.0.114 `vglLog("AGENDA", "CancelarCitaFallo", {status, red, extracto})` (L21682) queda
  en `localStorage["vgl_flight_recorder_logs"]` (L1044) y el toast/nota dicen el motivo
  (`_anulacionMotivo`, L21638). El reporte «NO confirmó» a secas es de v18.0.113 o anterior.
- Mapa motivo → hipótesis (para la próxima consulta, antes de tocar código):

| Lo que dirá el aviso / `status` en bitácora | Hipótesis más probable |
|---|---|
| «rechazó la petición (HTTP 400 …)» | H3 (tipos del cuerpo) o H4 (`Ip` vacío) o H5 (motivo fuera de catálogo) |
| HTTP 404 / 405 | ruta o método distintos de la captura (H1) |
| HTTP 415 | `Content-Type` distinto del de la app oficial (H1) |
| «sesión de Everest caducó (401/403)» | sesión; no es cableado |
| «respondió «…» sin confirmar» (200 con `error:true`) | Everest rechazó por regla de negocio: cita ya cancelada a mano (escenario real del reporte v17.6.70: el médico fue a la web original), cita ya atendida, motivo inválido (H5), usuario sin permiso de anular |
| «tope de 15 s» | red; verificar en la agenda antes de reintentar |
| «sin datos legibles (HTTP 200)» | Everest devolvió HTML/redirect de login o texto plano (`"Cancelado Correctamente"` a pelo también cae aquí, ver H6) |

- Corrección mínima: ninguna de código. Leer el texto del aviso (o exportar la bitácora) en el
  próximo intento. Todo lo demás en este informe es condicional a ese dato.

### H3 — MEDIA · Tipos incoherentes en el cuerpo JSON
- Evidencia: L21675-21677: `citaId: String(citaId)`, `pacienteId: String(pacienteId)` pero
  `usuarioId: med.id` (número). El `String()` explícito en dos campos y no en el tercero no
  tiene justificación en ningún comentario ni test; el test original solo mira `estado` y
  `observacion`. La respuesta de Everest es camelCase (`{error, mensaje, data, imprimir, valor,
  link}`), consistente con ASP.NET Core + System.Text.Json, que **rechaza con 400 un entero
  entre comillas** salvo configuración explícita. No hay precedente que funcione: AsignarTurno
  manda cuerpo `{}` (todo por query) y GuardarOrdenamiento es otro servicio
  (APIOrdenamientoHealth) con su propia serialización.
- Corrección mínima: replicar los tipos de la captura (H1). Sin captura, la opción de menor
  riesgo es mandar los tres ids con el **mismo** tipo (número cuando `/^\d+$/`), porque en el
  arnés se ve que `citaId`/`pacienteId` nacen como números (`d.radicado`, `pacienteIdAcceso`).

### H4 — MEDIA · `Ip` vacío, contra `Ip=127.0.0.1` que sí acepta AsignarTurno
- Evidencia: L21671 `"&Ip=" + encodeURIComponent("")` y L21677 `ip: ""`; AsignarTurno L21457
  `Ip=127.0.0.1` (funciona). En la captura oficial del 10-ago la app manda un valor real de 3
  dígitos (no `127.0.0.1`), así que Everest no valida el formato en AsignarTurno; **no se sabe**
  si CancelarCita lo exige (un `[Required] string Ip` daría 400).
- Corrección mínima: mandar `Ip=127.0.0.1` e `ip:"127.0.0.1"`, el único valor de `Ip` que se
  sabe aceptado por una escritura de APIAcceso desde este script.

### H5 — MEDIA · El panel manda un motivo libre; el modal Agendar manda el catálogo de Everest
- Evidencia: CHANGELOG v15.5.0: «se pide el motivo con los mismos motivos del formulario de
  Everest (Prefiere otra fecha / No puede asistir / Error de agendamiento / Otro)». Ese catálogo
  sigue vivo en el modal Agendar (L25601-25621 → `_anularCitaAsignada(apt, {observacion: motivo})`),
  pero el botón del panel de recordatorio (`onCancelar` L21576 → `_cancelarCitaConPregunta`
  L21591 → `_anularCitaAsignadaReal(apt)` **sin opciones**) cae al texto libre
  `"Anulada desde el Vigilante"` (L21667). Si Everest valida `Observacion` contra su catálogo de
  motivos de cancelación (es lo habitual en agendas hospitalarias y explica que v15.5.0 se
  molestara en copiar el catálogo), el camino que usa el médico (panel) falla y el del modal no.
- Corrección mínima: `_cancelarCitaConPregunta` ofrece el mismo `<select>` de motivos (o, como
  mínimo, usa por defecto un motivo del catálogo, p. ej. «Error de agendamiento») y lo pasa
  como `{observacion}`. Sin esto hay dos caminos con dos contratos distintos.

### H6 — MEDIA/BAJA · El veredicto acepta un rechazo y rechaza una confirmación plausible
- Arnés, escenario 6 (`_anulacionConfirmada`, L21630):
  - `{"error":false,"mensaje":"La cita no se puede cancelar"}` → **true** (se limpian marcas
    locales de una cita que Everest dice que sigue viva; contradice «solo si Everest confirmó»).
  - `"Cancelado Correctamente"` (cadena JSON) y `true` → **false** («forma que no reconozco»).
  - `{"data":{"error":false,...}}` (envoltorio) → **false**.
- No es la causa del «NO confirmó» si Everest responde como la captura, pero sí lo sería si
  Everest responde envuelto o como cadena. Corrección mínima: con `error/isError/Error === false`
  exigir además que `mensaje` no niegue (`/no se pudo|no fue posible|no se puede|error/i`);
  aceptar `data` envuelto y la cadena JSON `"cancelad…"`. Ajustar la prueba de `suite_15`.

### H7 — BAJA (latente) · Tres lectores exactos frente a dos tolerantes para la misma cédula
- Evidencia: `citaDetalleHoy` L21555, `_anularCitaAsignadaReal` L21654 y
  `_anularCitaMarcasLocales` L21705 leen/borran `p.citasDetalle[String(docId)]` (exacto);
  `isCitaAgendadaHoy` L8915 y `citaAgendadaFechaHoy` L8940 usan `_vglListaTieneDoc`/
  `_vglBuscarPorDoc` (tolerantes, L4903-4929). Ya anotado como A6 en
  `docs/OPORTUNIDADES_SPLUS_20260902.md`.
- Arnés, escenario 3: marca guardada como `"0111222333"` y leída como `"111222333"` →
  `isCitaAgendadaHoy=true`, `citaAgendadaFechaHoy="2026-10-01"`, `citaDetalleHoy=null`. Efecto:
  el dock pinta «Agendado · abrir» en vez de «Recordatorio» y `_anularCitaAsignadaReal` cae en
  el aviso ÁMBAR «versión anterior», **sin enviar petición**. Es decir: **esta vía NO produce
  el aviso ROJO del médico**; queda descartada como causa del síntoma.
- Hoy todos los escritores canonicalizan (`apt.doc_id` sale de `_vglDocCanon`: L12956 DOM,
  L15417 API, L7553/L7575 dock, L13052 `extractPacienteAbierto`), así que el desvío solo
  aparecería con una marca escrita por una versión vieja o por un llamador nuevo. Corrección
  mínima: `_vglBuscarPorDoc` en los dos lectores y `_vglClaveDeDoc` en el borrado.

### H8 — BAJA · Doble llamada (v17.6.70) verificada; queda un caso de pisado real
- Arnés, escenario 4: tras `vglNotificarCompletado("cita_control", …)` el detalle conserva
  `citaId/pacienteId/eps` (la fusión de `1d2ff06` funciona; **no** es causa).
- Pero la fusión pisa `citaId` cuando el médico crea una **segunda** cita el mismo día para el
  mismo paciente (antidup «pulse otra vez», o «📅 Abrir Agendar de nuevo» de v18.0.114):
  `Object.assign(previo, extra)` deja solo el radicado nuevo; «Cancelar esta cita» anula la
  última y `_anularCitaMarcasLocales` borra la marca de las dos. Y si `d.radicado` viene vacío
  con motivo «Agendada Correctamente», se guarda `citaId:null` explícito → sin recordatorio
  (L27211). Corrección mínima: no sobrescribir un `citaId` distinto sin aviso (o guardar
  lista), y no escribir `citaId:null` (omitir la clave).

### H9 — BAJA · Identidad del médico (`UsuarioId`, `UsuarioNombreCompleto`)
- `med.id === 0` → aviso ÁMBAR y **no se envía** (L21663-21666; arnés escenario 5). No produce
  el ROJO. El id en la pantalla de historia viene de `identidadDesdeCliente` (localStorage
  `user`/`jwt`/cookie `UsuarioMedico`, L19674-19689) → `resolverMedicoPorPerfil` (GetUsuarioPerfil
  o caché por login de 12 h, L19629-19661) — el mismo id que usa AsignarTurno, que funciona.
- `med.name` puede ser el **login** (`PAGEWIN.UsuarioLogin`, L19506-19508) o vacío
  (`UsuarioNombreCompleto=`, arnés 5b). AsignarTurno no manda nombre, así que no hay
  precedente; si Everest cruza nombre con id podría rechazar. Corrección mínima: si `med.name`
  está vacío o es igual al login, resolver primero el perfil antes de anular.

### H10 — INFO · Otras causas de `error:true`/4xx que no son cableado
- Cita ya cancelada a mano en Everest (el escenario del reporte v17.6.70: el médico terminó en
  la web original) — la marca local sigue viva hasta mañana y el botón sigue ofreciendo anular.
- Cita de otro día: `getProcessedToday()` reinicia a medianoche → ÁMBAR, no ROJO.
- Cita cancelada desde otra pestaña: la marca se borra en `localStorage` compartido, el panel
  ya abierto sigue con el `citaId` viejo en memoria → segundo intento → `error:true`.
- `PacienteId`: es `pacienteIdAcceso` (APIAcceso/BuscarPaciente, L25742), el mismo que aceptó
  AsignarTurno; no es el id de HC. Coherente.
- `eps`: nombre de EPS (`BuscarPacienteDetallado.data.eps.nombre`, L25781), igual que el `Eps=`
  de ImprimirRecordatorioCita (capturado). Sin evidencia de que CancelarCita lo valide.

### H11 — INFO · Cosas que se refutan (no son la causa)
- `_apiPostConDetalle` ≡ `pageFetchJson` en el cable salvo `Accept` (§1.4).
- Deduplicación GHOST, RUM (`CancelarCita` no está en `RUM_ENDPOINTS`, L20003 → etiqueta
  «otro»; solo telemetría), cortacircuitos: no afectan.
- El botón se deshabilita durante el `await` (L22211): no hay doble envío.

---

## 3. Respuestas directas a las cinco preguntas

1. **`CitaId`**: el `radicado` de AsignarTurno, que en la captura real es idéntico al `TurnoId`
   del cupo y al `AgendaTurnoId` de EnviarSMS, y que ImprimirRecordatorioCita (capturado) usa
   como `CitaId`. No hay ningún id alternativo en código ni capturas; el `citaId` de
   `state.apiCitas` es la consulta de hoy, no la cita creada.
2. **Forma**: POST, query + cuerpo JSON, `Content-Type: application/json` (+`Accept` desde
   v18.0.114), sin `credentials` explícito (igual que AsignarTurno), `Ip=`/`ip:""` vacíos frente
   a `127.0.0.1`, tipos mezclados en el cuerpo, `estado:"CAN"` y `eps` solo en el cuerpo. Entre
   la primera versión (`3ad93c1`) y la actual **no cambió nada de la petición** salvo `Accept`.
3. **Identidad**: sí puede guardarse con una forma y leerse con otra (H7, demostrado), pero ese
   camino termina en el aviso ÁMBAR sin petición, no en el ROJO. La doble llamada v17.6.70 ya no
   pisa (demostrado); sí pisa una segunda cita del mismo día (H8).
4. **Médico**: con id 0 no se envía (ÁMBAR). El id es el mismo de AsignarTurno; el nombre puede
   ir vacío o como login (H9, sin precedente que lo valide).
5. **Otras causas**: cita ya cancelada/atendida, motivo fuera de catálogo (H5), 400 por tipos
   o `Ip` (H3/H4), sesión caducada, tope de 15 s, respuesta envuelta o en cadena (H6). El dato
   que discrimina entre todas ya se registra desde v18.0.114 (H2) y aún no se ha leído.

---

## 4. Orden de acción propuesto (sin aplicar)

1. **Leer el motivo** del próximo intento (aviso / nota bajo el botón / bitácora
   `CancelarCitaFallo` con `status` y extracto). Sin ese dato, no tocar la petición.
2. **Recuperar la captura del 19-ago** y fijarla en `grounding/esquemas/` + test golden (H1).
3. Si es HTTP 400 y no hay captura: alinear con AsignarTurno (`Ip=127.0.0.1`, tipos numéricos
   uniformes) y pasar un motivo del catálogo desde el panel (H3, H4, H5) — un cambio por vez,
   verificado en consulta con una cita de prueba propia, nunca con la de un paciente.
4. Si es 200 con `error:true` «ya cancelada»: no es cableado; añadir a `_anularCitaMarcasLocales`
   la limpieza también en ese caso (la cita ya no existe) con aviso ÁMBAR, y consultar
   `ObtenerEstadoCita` antes de ofrecer «Cancelar» (ya está en `RUM_ENDPOINTS`, L20025).
5. Cerrar H6 (veredicto) y H7/H8 (identidad, segunda cita) como deuda de bajo riesgo, con
   mutación verificada y fila en `tests/INFORME_MUTACIONES.md`.

---

## 5. Reproducción (arnés)

`node scratchpad/cancelar/repro_cancelar.js` — escenarios: (1) petición actual; (2) AsignarTurno
+ EnviarSMS; (3a/3b/3c) cédula rellenada vs canónica; (4) doble llamada v17.6.70 y `citaId:null`;
(5/5b) médico sin id / sin nombre; (6) doce formas de respuesta contra `_anulacionConfirmada` y
`_anulacionMotivo`; (7) `{error:false, data:null}`; (8) `observacion` desde el modal. Salida
íntegra reproducida en §1.1, §1.2, H6, H7, H8, H9.
