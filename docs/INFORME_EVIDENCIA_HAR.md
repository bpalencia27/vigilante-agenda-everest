# Informe — Validación del flujo "Historias Clínicas" con evidencia real (evidencia.har)

Fecha: 2026-09-07 · Fuente: `E:\CENTINELA\vigilante-agenda-everest\evidencia.har`
(8,77 MB · 123 entradas · ventana 21:03:54Z–21:04:01Z ≈ 7,4 s · export de DEVTOOLS SIN
cuerpos de respuesta, SIN cookies y SIN bodies POST → **el archivo no contiene PHI**;
sí contiene identificadores reales en las URLs, por eso este informe los publica enmascarados).

Método: analizador propio (`neps_extract\analizar_har.js` → `neps_extract\_har_analisis.txt`)
que extrae método/ruta/query-keys/status/mime/tamaño y enmascara todo dígito largo.
Escenario capturado: médico autenticado, página "Citas del día", clic en el botón nativo
**"Historias Clínicas"** y apertura de la HC de un paciente.

---

## 1. Confirmación del flujo (valida la hipótesis v18.5.1-hc)

La captura confirma **en vivo** lo que el espejo estático solo insinuaba:

1. `ObtenerConsultas [especialidadId, profesionalId]` — la agenda (el endpoint que el
   userscript YA sondea con `apiLeerAgenda`; ahora con sus parámetros reales confirmados).
2. `ObtenerEstadoCita [TurnoId]` — el clic en la fila consulta el estado del turno.
3. `Morbilidad/ObtenerOrigenAgendaturnoId [AgendaTurno_Id, Paciente_Id]` — **la pareja
   cita↔paciente viaja aquí**: es el momento exacto en que Everest resuelve QUÉ paciente.
4. `Seguimiento/ObtenerOrigenSeguimiento [AgendaTurno_Id]`.
5. **`APIMedicoHealth/api/Medico/guardarHoraApertura [CitaId]`** — confirmado en vivo
   (era ×3 en el bundle): Everest marca la hora de apertura de la HC.
6. Cascada de ~95 llamadas: datos del paciente y de la HC + ~60 catálogos `Par*`.

**Consecuencia para v18.5.1-hc**: el botón NO navega con `token=`/`idPaciente=` en este
despliegue (0 llamadas con esos query en la captura); la resolución del paciente ocurre por
`ObtenerOrigenAgendaturnoId`/`CargarDatosPacienteByCitaId`. El hint por clic del módulo
VGL-HC sigue siendo correcto (captura la cédula de la fila antes de que la cadena arranque),
y además ahora hay DOS anclas de red alternativas para detectar "HC abierta":
`guardarHoraApertura` y `CargarAntecedentesByCita`.

---

## 2. ¿Fue posible descargar ARCHIVOS clínicos?

**Respuesta directa: en este flujo NO existen "archivos clínicos" descargables.** La
historia clínica no se sirve como PDF/binario: se sirve como **JSON estructurado** por
varios endpoints. La "descarga" quedó probada y medida por tamaño de respuesta:

| Dato clínico | Endpoint (query-keys) | Status | Tamaño |
|---|---|---|---|
| Última HC de PES (la historia como tal) | `APIHCHealth/api/Historicos/ObtenerUltimaHCPes [PacienteId]` | 200 | **10,7 KB** |
| Antecedentes por cita | `APIHCHealth/api/Morbilidad/CargarAntecedentesByCita/{citaId-b64}` | 200 | 6,5 KB |
| Datos del paciente | `APIPacienteV2/api/Paciente/CargarDatosPacienteByCitaId/{citaId-b64}` | 200 | 2,4 KB |
| Órdenes vigentes (jerarquía #1 de evidencia del repo) | `Historicos/ObtenerOrdenamientoPorPacienteIdVigente [pacienteid]` | 200 | 15,5 KB |
| Medicamentos del paciente | `ParMedicamentos/MedicamentoPorPaciente [pacienteId]` | 200 | 1,3 MB |
| Consultas previas | `Historicos/ConsultasPorPacienteId [PacienteId]` | 200 | 547 B |
| PES renal previo / históricos PES / seguimiento | `ObtenerHcDataPrevRenalByPacienteId`, `ObtenerHistoricoPes`, `ObtenerProgramaPes`, `ObtenerHistoricoSeguimientoPrograma` | 200 | 0,9–1,5 KB |
| Framingham (gráficas) | `Historicos/ObtenerDatosPuntajeFramingham`, `Graficas/AIE3 [categoriaId]` | 200 | 45 KB |

Limitaciones de la captura: (a) el export **no incluyó los cuerpos** de respuesta, así que
la estructura interna del JSON de la HC no está en el HAR (solo sus tamaños); (b) los
únicos archivos binarios del flujo son 5 PNG de iconos de HCHealth y un HTML fallback de
`/viva/HCHealth/null` (bug menor de Everest: un `src="null"`); (c) no hay ningún POST:
abrir la HC es 100 % lectura (los `Morbilidad/Guardar*` del bundle NO se dispararon,
correcto).

---

## 3. ¿Era "la totalidad" de funcionalidades implementables? — NO

La lista anterior (5 potenciales) se basaba solo en el espejo estático. El HAR desbloquea
capacidades nuevas y confirma otras. Matriz consolidada:

### Ya implementadas (v18.5.1-hc) — revalidadas por el HAR
Anclas del botón, captura de clic, hint con TTL, chip, aria-live (FICHAS 1-9 del informe
integral). El HAR confirma el escenario exacto para el que se diseñaron.

### Confirmadas por el HAR y listas para implementar (priorizadas)
1. **Prefetch al clic** (candidato v18.5.2 — AHORA CON LA CADENA EXACTA): en el instante
   del clic ya se conoce la fila → disparar en paralelo
   `ObtenerOrdenamientoPorPacienteIdVigente` (15,5 KB) y `MedicamentoPorPaciente` para que
   el resumen del dock esté listo cuando la HC pinte. Requiere compuerta de perfil y tope
   propio (sería la 1.ª red propia del chip; hoy es cero por diseño).
2. **Chip con datos REALES de la última HC**: `ObtenerUltimaHCPes` (10,7 KB) permite
   mostrar "última HC: fecha/motivo" sin raspado de DOM.
3. **Detección de "HC abierta" por red** (alternativa a `#anamesis`):
   `guardarHoraApertura` + `CargarAntecedentesByCita` respondiendo = historia abierta.
   Más robusto que el marcador DOM si Everest refactoriza la vista.
4. **Identidad del médico sin sniffer**: `APIMedicoHealth/api/Medico/ObtenerDatosLoginByLogin [login]`.
5. **Estado de cita en tiempo real**: `ObtenerEstadoCita [TurnoId]` — respaldo del
   fraudWatch cuando el DOM se atasca.
6. **Labs por API del propio Everest**: `Historicos/ObtenerResultadosLaboratorioAnnar`
   (200) y `...Citi` (404 en este paciente) — el userscript hoy usa el puente Athenea;
   esta vía nativa es más barata cuando existe.
7. **Catálogos pesados cachables** (aceleraría al PROPIO Everest): `ParDiagnosticos`
   (2,6 MB) + `GetParDiagnosticoByCitaId` (2,4 MB) + `Combo/ObtenerListadoCupsByCitaIdComplete`
   (829 KB) + `ParCiudades` (303 KB) se bajan EN CADA apertura de HC — un cache de sesión
   en el userscript reduciría ~6 MB de tráfico por paciente.

### Diseñadas antes del HAR (sin cambio de estado)
Inasistencias históricas en chip (`vgl_nosh_hist`), PyM en chip, anclas Metronic.

### Sigue FUERA de alcance (honestidad del inventario)
Escritura de HC (`Morbilidad/GuardarJsonHC` — existe en el bundle, no se ejerció aquí y NO
debe automatizarse: la casilla es del médico), PDFs de HC (no existen en este flujo),
lógica de backend, despliegue Athenea (medicosviva1a, rutas distintas).

**Conclusión de totalidad**: ningún inventario puede declararse "total" — este cubre todo
lo observable con (a) espejo estático 2.985 archivos, (b) manifiesto de módulos y (c) traza
de red real del flujo HC. La frontera restante es solo backend y escritura.

---

## 4. Inventario de servicios y endpoints (123 entradas → 103 de API)

| Servicio (nuevo/conocido) | Endpoints observados | Notas |
|---|---|---|
| `APIMedicoHealth` **(nuevo — no aparecía en el bundle)** | `Medico/ObtenerConsultas`, `ObtenerConsultasAnteriores`, `ObtenerEstadoCita`, `guardarHoraApertura`, `ObtenerDatosLoginByLogin` | agenda + apertura de HC + login |
| `APIHCHealth/api/Historicos` | `ObtenerUltimaHCPes`, `ConsultasPorPacienteId`, `ObtenerOrdenamientoPorPacienteIdVigente`, `MedicamentoPorPaciente`*, `ObtenerHcDataPrevRenalByPacienteId`, `ObtenerHistoricoPes`, `ObtenerProgramaPes`, `ObtenerHistoricoSeguimientoPrograma`, `ObtenerDatosPuntajeFramingham`, `TipoPlanFeatureEnabled`, `ObtenerUltimaDiscapacidad`, `ObtenerResultadosLaboratorioAnnar/Citi` | *vía servicio Par | el corazón de la HC |
| `APIHCHealth/api/Morbilidad` | `CargarAntecedentesByCita/{id}`, `ObtenerOrigenAgendaturnoId`, `obtenerEspecialidadCita`, `ObtenerTipoDeFinalidades`, `ValidarAccesoProgramas`, `obtenerUltimaCitaOdontologia`, `ObtenerGestionDeRiesgoObligatoriedad`, `ObtenerEpsConfiguracionIntegraciones` (500) | coincide con el controlador del bundle |
| `APIHCHealth/api/Parametrizacion` y `Presupuesto`/`Seguimiento`/`Graficas` | `GetPestaniasByEspecialidadId`, `ObtenerCupsAlerta`, `ObtenerInfecciones(Sexuales)`, `ObtenerMotivosParcialidad`, …; `Presupuesto/ObtenerCupsAsignadosACita`; `Seguimiento/ObtenerOrigenSeguimiento`; `Graficas/AIE3` | pestañas y formularios |
| `APIPacienteV2` | `Paciente/CargarDatosPacienteByCitaId/{citaId-b64}` | demografía del paciente |
| `ApiOrdenamientoHealth` | `Combo/ObtenerListadoCupsByCitaIdComplete` (829 KB), `ordenamiento/ValidarSedeGeneraRadicacion` | catálogo CUPS por cita |
| `APIParametrizacionGeneralHealth` | ~60 catálogos `Par*` (diagnósticos, ciudades, anticoncepción, citología…) | parámetros de formulario |
| `ApiIntegracionEverestDigiturno` | `Digiturno/ConfirmarTicket` → **500 ×2** | ya lo usa el userscript |

Autenticación observada: sin `Authorization` en headers; la sesión viaja en cookies del
dominio (no registradas en este export). Los `token=` del bundle corresponden a la apertura
en pestaña nueva, no a estas llamadas same-tab.

## 5. Errores del propio Everest documentados por la traza

- `Digiturno/ConfirmarTicket` → **500 ×2** (integración de turnos caída).
- `Morbilidad/ObtenerEpsConfiguracionIntegraciones` → **500**.
- `Historicos/ObtenerResultadosLaboratorioCiti` → **404** (proveedor no disponible).
- `GET /viva/HCHealth/null` → 200 con HTML (asset roto `src="null"`).
- ~25 respuestas "200" con cuerpo de 2 B (`null`) — endpoints vivos sin datos.

## 6. Higiene y mantenimiento

- **`evidencia.har` NO debe commitearse**: aunque el export no trae cuerpos, las URLs
  contienen `citaId`/`PacienteId` reales (PHI-adyacente; regla del repo: cero PHI).
  Sugerencia: moverlo a `e:\CENTINELA\neps_extract\` (fuera del repo) o agregar
  `evidencia.har` a `.gitignore`.
- Analizadores reutilizables: `neps_extract\analizar_har.js` (agrupa/cronología),
  `sonda_har_bodies.js` (verifica si un export trae cuerpos).
- Para capturas futuras con cuerpos (estructura del JSON de la HC): exportar con
  "Allow large requests…" y guardar el archivo FUERA del repo; el analizador ya enmascara.

## 7. Cómo reproducir este análisis

```powershell
node e:\CENTINELA\neps_extract\analizar_har.js      # -> neps_extract\_har_analisis.txt
node e:\CENTINELA\neps_extract\sonda_har_bodies.js  # ¿el export trae cuerpos?
```

## 8. Brechas de captura y recetas manuales (fase 6)

### 8.1 Qué falta para una captura integral (y qué impide cada hueco)

| # | Brecha en lo recolectado | Qué impide implementar hoy | ¿Se puede suplir sin captura nueva? |
|---|---|---|---|
| 1 | **HAR sin cuerpos de respuesta** (123/123 entries `content` vacío) | No se conoce la estructura interna del JSON de `ObtenerUltimaHCPes`, `CargarAntecedentesByCita`, `CargarDatosPacienteByCitaId` → el chip "última HC" y el prefetch enriquecido solo pueden contar con nombres de campo filtrados del bundle minificado (frágil) | Parcial: bundles minificados tienen los nombres de campos, pero sin valores de ejemplo el mapeo puede equivocarse. Riesgo alto sin captura |
| 2 | **Sin cookies ni headers de autenticación** en el export | No se sabe el nombre exacto de la cookie de sesión (`.AspNetCore.*`, `JSESSIONID`, custom) → imposible validar expiración/re-login ni replicar fuera del navegador | NO: solo visible con un export "with content" o con el panel Application |
| 3 | **Cero POST** en la ventana capturada | No se conocen los bodies de escritura (guardar HC, confirmar turno) — **a propósito**: NO deben capturarse ni automatizarse (regla del repo) | No aplica (fuera de alcance por diseño) |
| 4 | **Flujo de login no capturado** | No se conoce el endpoint/mechanismo de autenticación ni renovación de sesión | Parcial: `ObtenerDatosLoginByLogin` sugiere sesión previa; el login está en otra ruta raíz |
| 5 | **Modal de Ordenamiento no capturado** (abrir "Ordenar" desde la HC) | Falta la cadena de `ApiOrdenamientoHealth` de creación de orden (solo se vio el combo CUPS de lectura) | NO: requiere captura del flujo |
| 6 | **Cierre/finalización de cita no capturado** | Falta qué llama Everest al marcar "Atendido" (respaldo de fraudWatch) | NO: requiere captura del flujo |
| 7 | **7 MFE con remoteEntry 404** en el espejo estático | Módulos que el shell carga bajo demanda no están en el espejo | Parcial: algunos se descubren por nombre en GetModules.json |
| 8 | **HAR de otros perfiles** (PÚBLICO/LABORATORIOS) | No se sabe qué endpoints devuelve 403/401 a perfiles sin permiso → las compuertas de perfil del prefetch son heurísticas | NO: requiere captura con otro usuario |

### 8.2 Acción manual requerida del usuario (receta DevTools)

**No hay comando, script ni código que yo pueda ejecutar** que supla las brechas 2, 5, 6 y
8: requieren una sesión de médico autenticado dentro de Everest, que solo el usuario
posee. La receta para cada captura faltante es idéntica en mecánica:

1. Abrir Everest en Chrome → F12 → pestaña **Network**.
2. Marcar **"Preserve log"** (conserva la traza entre navegaciones) y, en la rueda
   dentada → "Settings", activar **"Allow large requests and responses in HAR export"**.
3. Ejecutar SOLO el escenario objetivo (ver tabla 8.3).
4. Clic derecho sobre cualquier entrada → **"Save all as HAR with content"** (este menú
   SÍ incluye cuerpos de respuesta — el export anterior usó "Save all as HAR" a secas,
   por eso llegó sin bodies).
5. Guardar el archivo como `e:\CENTINELA\neps_extract\har\<escenario>.har`
   (fuera del repo, igual que `evidencia.har` — las URLs traen ids reales).
6. Avisarme; yo lo proceso con `analizar_har.js` (enmascara dígitos largos) y la sonda
   `sonda_har_bodies.js` verifica que ahora sí trae cuerpos.

Tabla 8.3 — escenarios a capturar (en orden de valor):

| Prioridad | Escenario a grabar | Desbloquea |
|---|---|---|
| Alta | Clic en "Historias Clínicas" (igual que la anterior) pero exportando **"with content"** | Brecha 1: estructura real del JSON de la HC → chip con fecha/motivo reales, prefetch enriquecido |
| Alta | Abrir el **modal de Ordenamiento** y navegarlo SIN guardar | Brecha 5: cadena completa de ApiOrdenamientoHealth |
| Media | **Finalizar una cita** ("Atendido") de un paciente de prueba | Brecha 6: respaldo de red para fraudWatch |
| Media | Dejar la sesión **abierta hasta que expire** y observar qué responde Everest | Brecha 2: patrón de 401/redirect para detectar sesión muerta |
| Baja | Repetir el clic HC con un usuario **PÚBLICO/LABORATORIOS** | Brecha 8: compuertas de perfil exactas |

### 8.3 Límites que NO se deben cruzar (explícito)

- **NO** capturar ni ejecutar flujos de escritura de HC (`Morbilidad/GuardarJsonHC`):
  aunque el usuario lo grabara, el userscript jamás los invocará (la casilla es del médico).
- **NO** intentar automatizar el login ni extraer la cookie de sesión para usarla fuera
  del navegador: todo fetch del userscript es same-origin con la sesión viva del médico.
- Los HAR quedan SIEMPRE fuera del repo (`neps_extract\`), y los análisis publicados
  enmascaran identificadores.

## 9. Segunda ronda de capturas (07-sep 17:04-17:07) — análisis con CUERPOS

El usuario ejecutó la receta §8.2 y entregó DOS HAR nuevos (movidos a
`e:\CENTINELA\neps_extract\har\` según la regla de higiene):

| Archivo | Tamaño | Entradas | Con cuerpos | POST | Ventana | Flujo capturado |
|---|---|---|---|---|---|---|
| `neps.everestintelligent.com.har` | 19,2 MB | 149 | **143** | 0 | 21:03:54Z–21:04:01Z (≈7 s) | Clic en "Historias Clínicas" → HC abierta (con cuerpos) |
| `neps.everestintelligent.com(2).har` | 46,6 MB | 510 | **510 (100 %)** | **7** | 22:05:51Z–22:06:45Z (≈54 s) | Modal de **Ordenamiento** completo, incluido un `GuardarOrdenamiento` real |

Análisis reproducible: `node neps_extract\analizar_har_neps.js <ruta.har>` (→ `_har_neps_analisis.txt`),
`probe_buscar.js` y `probe_ordenamiento.js` (→ `_har_probe.txt`, `_har_post.txt`). Toda la
salida publica SOLO claves JSON y URLs enmascaradas — cero PHI.

### 9.1 Estado de las brechas de §8.1 tras esta ronda

| Brecha | Estado | Evidencia |
|---|---|---|
| 1 · HAR sin cuerpos (estructura JSON de la HC) | **CERRADA** | 143+510 cuerpos; claves de todos los endpoints clave en §9.2 |
| 2 · Cookies/auth | ABIERTA | Export sigue sin cookies; único header relevante `:authority` (sesión por cookie no exportada) |
| 3 · POST | Superada para Ordenamiento (7 POST con bodies); el flujo HC sigue siendo 100 % lectura | §9.3 |
| 4 · Login | ABIERTA | Ninguna llamada de autenticación en las ventanas |
| 5 · Modal de Ordenamiento | **CERRADA** | Cadena completa en §9.3 |
| 6 · Cierre de cita | ABIERTA | Sin "Atendido" en las ventanas |
| 7 · MFEs 404 | **CONFIRMADA EN VIVO** | 7 `remoteEntry.js` → 404 (VistaHCIngresoUrgencia, VistaCreacionPaciente, VistaHCTriage, VistaAreaUrgencia, GestionProfesional, Ripsv2, turnero-admin) — coincide con el espejo estático |
| 8 · Otros perfiles | ABIERTA | Capturas con el mismo usuario |

### 9.2 Estructura REAL de la HC (claves observadas — HAR 1)

- `ObtenerConsultas` → **[21 citas]**: `horaMostrar, citaId, citaIdCode, pacienteId,
  identificacion, nombrePaciente, estadoCita, estado, estadoUltimaCita,
  tipoAgendaAcceso, programapyp, adicional, fechaUltimaConsulta, fecha_Nacimiento,
  edadAnios, tipoModalidad, sede, tipoPlan_Id…` — trae fecha de nacimiento, edad y
  flag PyM (`programapyp`) que hoy el userscript raspa del DOM.
- `CargarAntecedentesByCita` → antecedentes completos + **examen físico con signos
  vitales** (`presionSistolica…imc, saturacionOxigeno, sintomasGenerales…`) +
  129+ claves de patológicos (cada uno con su `obs…`).
- `ObtenerUltimaHCPes` → programas (`esDiabetes/diabetes, hipertension,
  nefroproteccion, sindromeMetabolico, epoc, hipotiroidismo`), `clasificacion,
  riesgoCardiovascular, comentariosFinales, datosReferenciaTFG, testMoriskGreen,
  escalaGlasglow, planDeCuidado…` + subobjetos de ingreso/diagnóstico.
- `ObtenerOrdenamientoPorPacienteIdVigente` → [9]: `cup, medicamento, dx, estado,
  fechaVencimiento, prestador, listCups[{codigo, descripcion, grupo, nota_Tecnica,
  resolucion_Id}], listMedicamentos` — **respalda con estructura real el cruce
  antiduplicado que el prefetch v18.5.2-hc2 calienta.**
- `CargarDatosPacienteByCitaId` → demografía completa (68+ claves).
- `ConsultasPorPacienteId` → [{consultaId, fecha, medico}] ×6.
- `ObtenerEstadoCita` → `{swEstadoPro, mensaje}` · `ObtenerOrigenAgendaturnoId` →
  `{swExamenFisico, examenFisico, isError, swSeguimientoNoPresencial}` ·
  `ObtenerDatosLoginByLogin` → `{id, documento, nombres, apellidos, perfiles}` ·
  `BuscarPaciente` (APIAcceso) → `{error, mensaje, data, imprimir, valor, link}`.

**Endpoints NUEVOS del flujo HC (no estaban en el inventario §4):**

| Endpoint | Tamaño | Contenido |
|---|---|---|
| `Historicos/HistoricoMedicamentoHCM` | 26,9 KB | **[66] medicamentos REALES del paciente** (`codigo, descripcion, dosificacion, concentracion, viaAdministracion, frecuenciaUnidad, cantidad, dias, profesional`) |
| `Historicos/ObtenerHistoricoSignosVitales` | 1,4 KB | [6] tomas (`fechaRegistro, presion…, imc`) |
| `Parametrizacion/GetValidacionExamenCronicos` | 7,8 KB | [28] reglas de rangos por sexo/edad (`codigoExamen, sexo, edadMin/Max, valorMinimo/Maximo, swRequerido, unidad`) |
| `Parametrizacion/ObtenerRetriccionesDiagnostico` | 891,7 KB | {success,data{reglas[1829]}} — restricciones dx por paciente |
| `Historicos/HistoricoImpresionDiagnosticaAnalisisPlan` | 2,5 KB | [6] `{analisisYplan, fechaCreacion, profesional}` |
| `Historicos/ObtenerHistoricoSeguimientoPrograma` | 1,5 KB | evolución de analitos (creatinina, TFG, PTH, LDL… inicial vs resultado) + signos |
| `ParametrizacionGeneral/PreguntasRiesgoDiabetes` | 3,5 KB | [6] preguntas con respuestas |
| `Morbilidad/ValidarAccesoProgramas` | 2,7 KB | [22] programas `{id, descripcion, advertencia, pacienteAplica}` |
| `ApiAlertaOrdenamiento/v1/AlertaOrdenamiento/verificar?cupsCode` | 2 B | alertas por CUPS (vacío aquí) |

**Corrección de un supuesto**: `MedicamentoPorPaciente` (1,3 MB, [2750]) NO trae los
medicamentos del paciente — es el **CATÁLOGO paramétrico completo** (con `vademecun`).
Los medicamentos reales del paciente están en `HistoricoMedicamentoHCM` (26,9 KB).
Cualquier futura función de medicamentos debe usar HCM; el catálogo solo interesa
como candidato de caché de sesión (idéntico en cada apertura).

### 9.3 Flujo REAL del modal de Ordenamiento (HAR 2 — claves de bodies POST)

1. `GetModules` + `menu/GetMenu?roleId&userId` (shell) → `Usuario/ObtenerUsuarioPerfil?loginId`.
2. Combos: `ObtenerTipoDeDocumento` [13], `ObtenerListadoNotaTecnica` [4],
   `ObtenerListadoEps` [2], `ObtenerListadoDiagnostico?filter=` (typeahead).
3. `APIOrdenamientoHealth/api/Paciente/BuscarPaciente?Identificacion&TipoDocumento&epsId`
   → ficha del paciente (`id, identificacion, eps, regimen, tipoPlan, edad,
   programaCompensar, desplazado…`) — respuesta DISTINTA de la de APIAcceso.
4. POST paralelos `{pacienteId, fechaInicial, fechaFinal[, estado][, codigoDx]}`:
   `ConsultarOrdenamientosPaciente` (400 la 1.ª vez, 200 tras guardar),
   `CargarSolicitudesExternasPaciente` (400), `CargarCertificadoPaciente` (400),
   `CargarIncapacidadPaciente` (200, [2] incapacidades con diagnóstico y médico),
   **`APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente`** (200, [3]
   `{tipo, agrupador, estado, fechaVencimiento, detalles, urls}` — servicio NUEVO).
5. `ObtenerEspecialidadMedico?login` → especialidad + CUPS de marcación.
6. Typeahead CUPS: `ObtenerListadoCupsPorPaciente?pacienteId&filter=` ×6 → [34]/[50]/[9]/[1].
7. `ApiAlertaOrdenamiento/verificar?cupsCode` → [0].
8. **`GuardarOrdenamiento`** → request `{DiagnosticoId, RemisorId, paciente, SwHc,
   perfil, CitaId, UsuarioId, ordenes[{Id}]}` → response `{agrupador, irFrente,
   ordenAuth[{numeroAutorizacion, cupsId}]}`; luego re-`ConsultarOrdenamientosPaciente`
   (200, `{facturaId, agrupador, numeroAutorizacion, estado, sede, fechaVencimiento,
   dx, finalidad, url…}`).

**Regla inviolable reconfirmada**: `GuardarOrdenamiento` queda documentado SOLO como
conocimiento del flujo. El userscript NO lo llamará jamás — ordenar es decisión del
médico (la escritura actual del userscript pasa por los flujos nativos que el médico
dispara). Igual para `Morbilidad/GuardarJsonHC`.

### 9.4 Hallazgos accionables para el userscript (NO aplicados en esta fase)

1. **Ruta 2 de `BuscarPaciente` (APIAcceso) devuelve 400 en producción** (3/3 en vivo:
   `?identificacion=&UsuarioId=` sin `TipoDocumento` → 400 ProblemDetails). La ruta 1
   (con `TipoDocumento=CC&epsId=2`) es la única viva → retirar la ruta 2 de la cascada
   de `apiAccesoBuscarPaciente` ahorraría 1 petición fallida por búsqueda (incluido el
   prefetch v18.5.2-hc2). Cambio de comportamiento → requiere tarea propia con mutación.
2. **Chip "última HC" YA implementable sin supuestos**: `ObtenerUltimaHCPes` + cuerpos
   reales (fecha de `fechaCreacion`, motivo vía `clasificacion/riesgoCardiovascular`).
3. **Medicamentos del paciente**: usar `HistoricoMedicamentoHCM` (66 items, 26,9 KB),
   nunca el catálogo de 1,3 MB.
4. **Cacheo de catálogos** (candidato §3.7): confirmado en vivo que `ParDiagnosticos`
   (2,6 MB), `GetParDiagnosticoByCitaId` (2,4 MB), `ObtenerRetriccionesDiagnostico`
   (891,7 KB), `ObtenerListadoCupsByCitaIdComplete` (849 KB), `ParCiudades` (310 KB) y
   `MedicamentoPorPaciente` (1,3 MB) se descargan EN CADA apertura → ~7,5 MB por HC.
5. **Errores de Everest re-confirmados**: `ConfirmarTicket` 500×2,
   `ObtenerEpsConfiguracionIntegraciones` 500, `ObtenerResultadosLaboratorioCiti` 404,
   `HistoricoActividadEducacion` 400×2, `api.ipify.org` bloqueada (status 0), el ya
   conocido `HCHealth/null` 200-HTML.

### 9.5 Veredicto de completitud para la sección Historias Clínicas

**La información crítica para mantener y mejorar la sección está COMPLETA y accesible**
en los dos HAR nuevos: cadena del clic (§1), estructura JSON de la HC y del paciente
(§9.2), flujo de ordenamiento de punta a punta (§9.3), errores del servidor (§9.4.5) y
los 404 de módulos (§9.1). Lo que sigue faltando (brechas 2, 4, 6, 8) NO bloquea
ninguna funcionalidad de lectura de la HC: solo afecta detección de sesión muerta,
respaldo de red para "Atendido" y compuertas por perfil — todas con receta de captura
en §8.2 para una tercera ronda.
