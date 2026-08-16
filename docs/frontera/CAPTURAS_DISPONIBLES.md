# Catálogo de Capturas Disponibles en el Repositorio

> **Propósito:** Evitar guiones de reconocimiento redundantes en consultorio.  
> **Regla de oro (§0):** Antes de proponer capturar nada nuevo, agotar lo que ya está en el repositorio.  
> **Seguridad:** Cero PHI. Todos los esquemas y fixtures contienen datos redactados o sintéticos.

---

## 1. Resumen Ejecutivo del Corpus de Capturas

El repositorio cuenta con **4 archivos de captura directa de consultorio** (formato JSON enriquecido del grabador del proyecto), **4 mapas DOM completos de Everest**, **23 esquemas estructurados de endpoints**, **1 catálogo oficial de validación de crónicos** y **1 fixture sintético de medicamentos**.

| Categoría | Cantidad | Archivos / Ubicación | Contenido Principal |
|---|---|---|---|
| **Capturas de Tráfico + Clics** | 4 | Raíz (`captura_*.json`) | Peticiones HTTP, parámetros, URLs y secuencia física de clics (`<li>`, `<button>`, `<span>`). |
| **Mapas DOM de Everest** | 4 | `grounding/mapas/` | Árbol completo de componentes, inputs, botones, tablas y almacenamiento de 15 pestañas de Everest. |
| **Esquemas de Endpoints** | 23 | `grounding/esquemas/` | Esquemas de solicitud y respuesta (tipos, campos observados, estados HTTP). |
| **Catálogos Clínicos Oficiales** | 1 | `grounding/catalogos/` | Tabla oficial de 28 reglas de rangos y unidades de laboratorio de la IPS. |
| **Fixtures Sintéticos de Red** | 1 | `tests/fixtures/` | Réplica sintética carácter a carácter de la respuesta de `CargarMedicamentosPaciente`. |

---

## 2. Inventario Detallado de Archivos de Captura

### 2.1. `captura_agendamiento_oficial_20260810.json` (37.6 KB)
- **Fecha de captura:** 10-ago-2026.
- **Vista de origen:** `/viva/Acceso/` (Módulo de Agenda y Citas).
- **Peticiones de red capturadas:** 10 llamadas HTTP.
- **Clics de interfaz registrados:** 25 eventos de usuario.
- **Endpoints presentes:**
  1. `GET /apiviva/APIAcceso/api/Paciente/BuscarPaciente` (200 OK) — Parámetros: `identificacion`, `TipoDocumento`, `epsId`, `UsuarioId`.
  2. `GET /apiviva/APIAcceso/api/ParametrizacionLista/GetLista` (200 OK) — Parámetros: `tipo=Par_Contrato`, `pacienteId`.
  3. `GET /apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado` (200 OK) — Parámetros: `idPaciente`.
  4. `GET /apiviva/APIAcceso/api/Acceso/ValidarPresupuestosPaciente` (200 OK) — Parámetros: `PacienteId`, `EspecialidadId`, `ProgramaId`.
  5. `POST /apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles` (200 OK) — Parámetros: `PacienteId`, `EspecialidadId`, `FechaDeseada`, `ProgramaId`, `PuntoAtencionId`, `PerfilCodigo`, `swParticular`, `presupuestoId`.
  6. `GET /apiviva/APIAcceso/api/Acceso/AgdValidarAgenda` (200 OK) — Parámetros: `agendaId`, `pacienteId`, `ordenMongo`, `cup`, `swParticular`.
  7. `GET /apiviva/APIAcceso/api/Acceso/ObtenerTurnos` (200 OK) — Parámetros: `agendaid`, `fecha`, `pacienteId`, `ordenMongo`, `cup`, `swParticular`.
  8. `POST /apiviva/APIAcceso/api/Acceso/AsignarTurno` (200 OK) — Parámetros: `OrdenMongoId`, `TurnoId`, `Marcacion`, `PacienteId`, `FechaDeseada`, `TipoConsulta`, `Ip`, `UsuarioId`, `CodigoCups`, `SwProgramaEspecial`, `swIsPac`, `swIsPyM`, `ObservacionCita`, `FechaMinimaConsultaOrden`, `ProgramaId`, `Tratamiento`, `Consulta`, `Emergencia`, `PresupuestoId`.
  9. `GET /apiviva/APIAcceso/api/SMS/EnviarSMS` (200 OK) — Parámetros: `Telefono`, `AgendaTurnoId`.
- **Estado de cuerpos:** Parámetros y URLs completas con cabeceras y códigos de estado; cuerpo de respuesta tipificado en esquema (`grounding/esquemas/apiviva_APIAcceso_*`).

---

### 2.2. `captura_ordenamiento_nativo_20260810.json` (25.3 KB)
- **Fecha de captura:** 10-ago-2026.
- **Vista de origen:** `/viva/EverHealth/OrdenamientoHealth` (Módulo oficial de Órdenes y Farmacología).
- **Peticiones de red capturadas:** 11 llamadas HTTP.
- **Clics de interfaz registrados:** 10 eventos de usuario.
- **Endpoints presentes:**
  1. `GET /apiviva/APIOrdenamientoHealth/api/Paciente/BuscarPaciente` (200 OK) — Parámetros: `Identificacion`, `TipoDocumento`, `epsId`.
  2. `POST /apiviva/APIOrdenamientoHealth/api/ordenamiento/ConsultarOrdenamientosPaciente` (200 OK).
  3. `POST /apiviva/APIOrdenamientoHealth/api/solicitud/CargarSolicitudesExternasPaciente` (400 Bad Request — esperado por ausencia de órdenes externas).
  4. `POST /apiviva/APIOrdenamientoHealth/api/Certificado/CargarCertificadoPaciente` (400 Bad Request).
  5. `POST /apiviva/APIOrdenamientoHealth/api/Incapacidad/CargarIncapacidadPaciente` (400 Bad Request).
  6. `POST /apiviva/APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente` (200 OK) — **CUERPO COMPLETO DE RESPUESTA OBSERVADO**. Fuente del fixture sintético `tests/fixtures/everest_medicamentos.json`.
  7. `GET /apiviva/APIMedicoHealth/api/Medico/ObtenerEspecialidadMedico` (200 OK) — Parámetros: `login=bpalencia`.
  8. `GET /apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoDiagnostico` (200 OK) — Parámetros: `filter=Z113`.
  9. `GET /apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoCupsPorPaciente` (200 OK) — Parámetros: `pacienteId=636997`, `filter=906249`.
  10. `POST /apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento` (200 OK) — Parámetros de orden médica.

---

### 2.3. `captura_ordenamiento_paquete_HTA_20260812.json` (9.1 KB)
- **Fecha de captura:** 12-ago-2026.
- **Vista de origen:** `/viva/HCHealth/` (Historia Clínica, pestaña Conducta).
- **Peticiones de red capturadas:** 3 llamadas HTTP.
- **Clics de interfaz registrados:** 20 eventos de usuario.
- **Evidencia clave registrada:**
  - Clic en `a#conducta` (Pestaña Conducta).
  - Clic en `button` "Paquetes" → `button` "HTA".
  - Clics en `<li>` individuales con los textos literales exactos:
    * `li "HORMONA PARATIROIDEA MOLÉCULA INTACTA"`
    * `li "ALBUMINA EN SUERO U OTROS FLUIDOS"`
    * `li "FÓSFORO EN SUERO U OTROS FLUIDOS"`
    * `li "HEMOGLOBINA"`
    * `li "HEMOGLOBINA GLICOSILADA AUTOMATIZADA"`
  - Clics en `button` "Agregar" tras cada selección.
- **Endpoints presentes:**
  1. `GET /apiviva/APIParametrizacionHealth/apiparametrizacion/ParMedicamento/GetViasAdministracionMedicamentos` (200 OK).
  2. `GET /apiviva/APIParametrizacionHealth/apiparametrizacion/ParMedicamento/GetPresentacionMedicamentos` (200 OK).
  3. `GET /apiviva/ApiOrdenamientoHealth/api/Combo/ObtenerPaqueteProgramasCupsByCitaId` (200 OK) — Parámetros: `citaID=MTIyMTk3NA`, `paqueteProgramaId=1`.

---

### 2.4. `captura_rutacronicos_borrado_rac_20260812.json` (6.4 KB)
- **Fecha de captura:** 12-ago-2026.
- **Vista de origen:** `/viva/HCHealth/` (Historia Clínica, pestaña Ruta Crónicos PES).
- **Peticiones de red capturadas:** 1 llamada HTTP.
- **Clics de interfaz registrados:** 13 eventos de usuario.
- **Evidencia clave registrada:**
  - Clic en `a#pes` (Pestaña Ruta Crónicos).
  - Presencia del botón inyectado `button#vgl-lab-injector` ("🧬 Auto-Labs (Athenea)").
  - Interacción con la casilla `input#resultadoRelacionAlbuminaCreatinina`.
  - **CUERPO COMPLETO DE RESPUESTA OBSERVADO** en `GetValidacionExamenCronicos`: 28 reglas de rangos y unidades oficiales de laboratorio.
- **Endpoints presentes:**
  1. `GET /apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos` (200 OK) — Parámetros: `citaId=MTIyMTk3NA`.

---

## 3. Mapas Estructurales del DOM (`grounding/mapas/`)

Generados automáticamente durante sesiones reales de consultorio:

1. **`MAPA_EVEREST_20260814_1611.json`:** 15 pestañas mapeadas, 420 campos de entrada (`<input>`), 119 botones (`<button>`), 121 tablas (`<table>`), 13 endpoints de red detectados.
2. **`MAPA_EVEREST_20260814_1643.json`:** Mapeo completo de la vista de agenda y selección de turnos.
3. **`MAPA_EVEREST_20260814_1706.json`:** Mapeo de la cabecera de historia clínica (`#anamesis`, `.text-muted`, `.nav-tabs`).
4. **`MAPA_EVEREST_20260814_1712.json`:** Mapeo exhaustivo de los 64 campos de entrada del formulario de Ruta de Crónicos (confirmación de IDs `resultadoColesterolTotal`, `resultadoCreatinina`, `resultadoRelacionAlbuminaCreatinina`, etc.).

---

## 4. Estado de los Cuerpos de Respuesta: Qué Tenemos y Qué Falta

| Endpoint | Estado de Cuerpo en Repo | Fixture / Esquema Disponible | Acción Requerida |
|---|---|---|---|
| `APIMedicamentoHealth/.../CargarMedicamentosPaciente` | **CUERPO COMPLETO** | `tests/fixtures/everest_medicamentos.json` | Ninguna. Cubierto. |
| `APIHCHealth/.../GetValidacionExamenCronicos` | **CUERPO COMPLETO** | `grounding/catalogos/tabla_validacion_examenes_cronicos.json` | Ninguna. Cubierto. |
| `APIAcceso/.../BuscarPaciente` | Esquema disponible | `grounding/esquemas/...BuscarPaciente.json` | Ninguna para tipos; cuerpo completo deseable. |
| `APIAcceso/.../BuscarCitasDisponibles` | Esquema disponible | `grounding/esquemas/...BuscarCitasDisponibles.json` | Captura con cuerpo recomendada. |
| `APIAcceso/.../ObtenerTurnos` | Esquema disponible | `grounding/esquemas/...ObtenerTurnos.json` | Ninguna. Cubierto. |
| `APIOrdenamientoHealth/.../ObtenerListadoDiagnostico` | Esquema disponible | `grounding/esquemas/...ObtenerListadoDiagnostico.json` | Ninguna. Cubierto. |
| `APIOrdenamientoHealth/.../ObtenerListadoCupsPorPaciente` | Esquema disponible | `grounding/esquemas/...ObtenerListadoCupsPorPaciente.json` | Ninguna. Cubierto. |
| `APIHCHealth/.../ObtenerHistoricoSignosVitales` | **SIN CUERPO** | `SUPUESTO` | Requiere captura en consulta real con GRABADOR_1. |
| `APIHCHealth/.../ObtenerOrdenamientoPorPacienteIdVigente`| **SIN CUERPO** | `SUPUESTO` | Requiere captura en consulta real con GRABADOR_1. |
| `APIHCHealth/.../ObtenerResultadosLaboratorioAnnar/Citi` | **SIN CUERPO** | `SUPUESTO` | Requiere captura en consulta real con GRABADOR_1. |
| `ObtenerDatosPuntajeFramingham` | **SIN CUERPO** | `SUPUESTO` | Mencionada en el HAR sin cuerpo; no implementada. |

---

## 5. Instrucciones para Capturar Endpoints Faltantes

Para los endpoints listados como `SIN CUERPO`:
1. **NO usar la exportación .HAR del navegador** (omite los cuerpos de peticiones XHR por configuración de seguridad de la red institucional).
2. **USAR el grabador nativo del proyecto:**
   - Ejecutar `GRABADOR_1_INICIAR.js` en la consola de DevTools al iniciar la consulta.
   - Navegar normalmente a la vista correspondiente (Signos Vitales, Históricos de Laboratorio).
   - Ejecutar `GRABADOR_2_DESCARGAR.js` al finalizar para exportar el archivo `captura_*.json` con cuerpos completos.
