# Informe de Etiquetas y Perfil (Fase 0 - Agente A3)

## 1. Mapeo Etiqueta -> Perfil (Configurable)

El proyecto requiere clasificar pacientes en los siguientes perfiles (`HIPERTENSO`, `DIABETICO`, `NEFROPROTECCION`, `SIN_ETIQUETA`) basado en las etiquetas provenientes de Everest.

Como no tenemos confirmación de las cadenas exactas (sensibles a tildes, mayúsculas, espacios, etc.), la siguiente tabla se construirá en código normalizando las cadenas entrantes (pasándolas a minúscula y quitando tildes y espacios extra) para compararlas contra estas posibles variantes.

| Cadena Cruda (Posibles) | Cadena Normalizada Esperada | Perfil Asignado |
| :--- | :--- | :--- |
| `"Hipertensión"` | `"hipertension"` | `HIPERTENSO` |
| `"HTA + DM"`, `"HTA+DM"`, `"HTA / DM"` | `"hta+dm"`, `"htadm"` | `DIABETICO` (con HTA) |
| `"Diabetes"` | `"diabetes"` | `DIABETICO` |
| `"Nefroprotección"`, `"Nefroproteccion"` | `"nefroproteccion"` | `NEFROPROTECCION` |
| Faltante / Otra | *Cualquiera* | `SIN_ETIQUETA` |

*Nota: Una lista de etiquetas puede contener múltiples perfiles. Las reglas de los Ejes A y B (ver D3-bis) determinarán cómo se combinan. Por ejemplo, `nefroprotección` + `diabetes` otorgará recomendación de primera mitad de la jornada (por diabetes) pero sin horas adicionales.*

## 2. Capas de Fuentes Candidatas

| Capa | Fuente Candidata | Confianza Actual | ¿Qué aporta? |
| :--- | :--- | :--- | :--- |
| **Capa 1 (Gratis)** | `apiAccesoBuscarPacienteDetallado` -> `data.programasPaciente[].descripcion` | **Alta (Necesita captura)** | El código actual ya mapea esto en la línea 9094 y se pinta en `#vgl-agm-prog-sel`. Es casi seguro que aquí vienen los strings visuales de HTA, DM, etc. |
| Capa 2 (Diagnósticos) | `ParDiagnosticos/GetParDiagnosticoByCitaId` | **Descartada** | Los códigos CIE-10 (I10, E11, N18) son deducidos, y el mandato D3 especifica que se debe usar una etiqueta explícita del sistema, no inferir de laboratorios o diagnósticos. |
| Capa 3 (Programa PES) | `APIHCHealth/api/Historicos/ObtenerProgramaPes` | **Descartada** | Se requiere una petición extra por paciente. Solo se usará si la Capa 1 no contiene las etiquetas. |
| Capa 4 (Riesgo Renal) | `ObtenerHcDataPrevRenalByPacienteId` | **Descartada** | Mismo caso que la Capa 3. |

## 3. Lo que falta (Preguntas al Médico)

1. ¿Las etiquetas que usted ve en el módulo de citas (hipertensión, HTA+DM, diabetes, nefroprotección) coinciden con las cadenas que salen del script de diagnóstico de abajo?
2. Por favor, ejecute el script `DIAGNOSTICO_ETIQUETAS.js` (F12 -> Consola) cuando tenga seleccionado a un paciente que usted sepa que es HTA+DM, otro de Nefroprotección, y péguenos la salida exacta aquí.
