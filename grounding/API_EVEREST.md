# API de Everest — endpoints observados en consultorio

Generado por `tools/generar_grounding.js` a partir de las capturas reales del repositorio.
**No está escrito a mano y no debe editarse a mano**: si hay una captura nueva, se vuelve a correr.

De cada respuesta se publica el ESQUEMA (nombres de campo y tipos), nunca los valores de paciente.

| Método | Ruta | Parámetros | Estados | Visto en |
|---|---|---|---|---|
| `GET` | `/apiviva/APIAcceso/api/Acceso/AgdValidarAgenda` | `agendaId`, `pacienteId`, `ordenMongo`, `cup`, `swParticular` | 200 | 1 captura(s) |
| `POST` | `/apiviva/APIAcceso/api/Acceso/AsignarTurno` | `OrdenMongoId`, `TurnoId`, `Marcacion`, `PacienteId`, `FechaDeseada`, `TipoConsulta`, `Ip`, `UsuarioId`, `CodigoCups`, `SwProgramaEspecial`, `swIsPac`, `swIsPyM`, `ObservacionCita`, `FechaMinimaConsultaOrden`, `ProgramaId`, `Tratamiento`, `Consulta`, `Emergencia`, `PresupuestoId` | 200 | 1 captura(s) |
| `POST` | `/apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles` | `PacienteId`, `EspecialidadId`, `FechaDeseada`, `ProgramaId`, `PuntoAtencionId`, `PerfilCodigo`, `swParticular`, `presupuestoId` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIAcceso/api/Acceso/ObtenerTurnos` | `agendaid`, `fecha`, `pacienteId`, `ordenMongo`, `cup`, `swParticular` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIAcceso/api/Acceso/ValidarPresupuestosPaciente` | `PacienteId`, `EspecialidadId`, `ProgramaId` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIAcceso/api/Paciente/BuscarPaciente` | `identificacion`, `TipoDocumento`, `epsId`, `UsuarioId` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado` | `idPaciente` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIAcceso/api/ParametrizacionLista/GetLista` | `tipo`, `pacienteId` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIAcceso/api/SMS/EnviarSMS` | `Telefono`, `AgendaTurnoId` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos` | `citaId` | 200 | 1 captura(s) |
| `POST` | `/apiviva/APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente` | — | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIMedicoHealth/api/Medico/ObtenerEspecialidadMedico` | `login` | 200 | 1 captura(s) |
| `POST` | `/apiviva/APIOrdenamientoHealth/api/Certificado/CargarCertificadoPaciente` | — | 400 | 1 captura(s) |
| `GET` | `/apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoCupsPorPaciente` | `pacienteId`, `filter` | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoDiagnostico` | `filter` | 200 | 1 captura(s) |
| `GET` | `/apiviva/ApiOrdenamientoHealth/api/Combo/ObtenerPaqueteProgramasCupsByCitaId` | `citaID`, `paqueteProgramaId` | 200 | 1 captura(s) |
| `POST` | `/apiviva/APIOrdenamientoHealth/api/Incapacidad/CargarIncapacidadPaciente` | — | 400 | 1 captura(s) |
| `POST` | `/apiviva/APIOrdenamientoHealth/api/ordenamiento/ConsultarOrdenamientosPaciente` | — | 200 | 1 captura(s) |
| `POST` | `/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento` | — | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIOrdenamientoHealth/api/Paciente/BuscarPaciente` | `Identificacion`, `TipoDocumento`, `epsId` | 200 | 1 captura(s) |
| `POST` | `/apiviva/APIOrdenamientoHealth/api/solicitud/CargarSolicitudesExternasPaciente` | — | 400 | 1 captura(s) |
| `GET` | `/apiviva/APIParametrizacionHealth/apiparametrizacion/ParMedicamento/GetPresentacionMedicamentos` | — | 200 | 1 captura(s) |
| `GET` | `/apiviva/APIParametrizacionHealth/apiparametrizacion/ParMedicamento/GetViasAdministracionMedicamentos` | — | 200 | 1 captura(s) |

## Capturas de origen

| Archivo | Vista | Peticiones | Clics |
|---|---|---|---|
| `captura_agendamiento_oficial_20260810.json` | `/viva/Acceso/` | 10 | 25 |
| `captura_ordenamiento_nativo_20260810.json` | `/viva/EverHealth/OrdenamientoHealth` | 11 | 10 |
| `captura_ordenamiento_paquete_HTA_20260812.json` | `/viva/HCHealth/` | 3 | 20 |
| `captura_rutacronicos_borrado_rac_20260812.json` | `/viva/HCHealth/` | 1 | 13 |
