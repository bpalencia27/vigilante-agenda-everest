# INFORME DE ETIQUETAS DE PACIENTE (FASE 0 - A3)

## Análisis de Fuentes de Etiquetas

El objetivo de este informe es determinar de dónde provienen exactamente las etiquetas (como `hipertensión`, `HTA+DM`, `diabetes`, `nefroprotección`) que ve el médico en la plataforma Everest, y con qué cadenas de texto exactas llegan, para alimentar el motor de recomendación por perfil de paciente.

Tras analizar el código fuente (`vigilante_agenda.user.js`) y la captura de red real (`captura_agendamiento_oficial_20260810.json`), se determinó lo siguiente:

### Capa 1 (Capa Confirmada)

La fuente principal de etiquetas en la aplicación es el endpoint `BuscarPacienteDetallado`. En la respuesta JSON de este endpoint, las etiquetas viven dentro del arreglo `programasPaciente`, específicamente en el campo `descripcion`.

El código del script ya procesa estos datos en la línea ~9094 para construir el modal de agendamiento:
```javascript
const progs = ((det && det.data && det.data.programasPaciente) || []).filter((p) => p && p.swProgramaEspecial === true && p.id);
```

**Evidencia encontrada en captura_agendamiento_oficial_20260810.json:**
Al revisar la petición GET a `/apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado`, encontramos el siguiente arreglo `programasPaciente`:

```json
"programasPaciente": [
  {
    "id": 184216,
    "descripcion": "Nefroprotección",
    "swProgramaEspecial": true
  },
  {
    "id": 252080,
    "descripcion": "Salud Mental",
    "swProgramaEspecial": false
  },
  {
    "id": 401413,
    "descripcion": "Hipertensión",
    "swProgramaEspecial": true
  }
]
```
*(Se han omitido los campos irrelevantes para mayor claridad)*

Además, se buscó en la respuesta del endpoint `BuscarCitasDisponibles` por si el campo `etiqueta` de las agendas contenía esta información. El resultado fue negativo: el campo `etiqueta` se encontró vacío (`"etiqueta": ""`) en todos los 49 registros de la captura, confirmando que las agendas no traen el perfil del paciente pre-calculado, y la fuente debe ser el detalle del paciente.

### Capas de Refuerzo

- **Diagnósticos (CIE-10)**: Sin evidencia en las capturas actuales.
- **Programa PES**: Sin evidencia en las capturas actuales.
- **Riesgo renal**: Sin evidencia en las capturas actuales.
- **Athenea**: Confirmada su integración para laboratorios (como lo menciona el brief), pero para las etiquetas de programa usaremos primariamente `BuscarPacienteDetallado`.

## Mapeo Etiqueta-Perfil y Nivel de Confianza

A continuación se detalla la tabla de emparejamiento de cadenas exactas a perfiles. **Atención:** Para evitar errores de emparejamiento (como el incidente de laboratorios v12.6.8), el motor de clasificación deberá normalizar las cadenas ignorando mayúsculas/minúsculas y eliminando espacios intermedios (ej. `hta+dm` == `hta + dm`).

| Cadena Exacta de la API | Perfil Objetivo | Nivel de Confianza | Evidencia / Notas |
| :--- | :--- | :--- | :--- |
| `Nefroprotección` | `nefroprotección` | **Confirmada** | `captura_agendamiento_oficial_20260810.json` |
| `Hipertensión` | `hipertensión` | **Confirmada** | `captura_agendamiento_oficial_20260810.json` |
| `HTA+DM` | `HTA+DM` | **Necesita captura** | Mencionada en el requerimiento, pero **falta evidencia** en las capturas actuales. |
| `HTA + DM` | `HTA+DM` | **Necesita captura** | Variación posible. Falta evidencia de la cadena exacta. |
| `Diabetes` | `diabetes` | **Necesita captura** | Mencionada en el requerimiento, pero **falta evidencia** en las capturas actuales. |

### Escalera de Precedencia (D3-bis)

Como se indica en las decisiones de arquitectura (D3-bis), los perfiles **NO se excluyen entre sí en una escalera única**. Las recomendaciones operan en dos ejes independientes basados en la lista de etiquetas:

**Eje A (Franja Horaria):**
- Contiene `Diabetes` o `HTA+DM` -> **Primera mitad de jornada** (Repintada, preseleccionada)
- Sin perfil diabético -> **Horario normal**
- *Nota:* `nefroprotección` u `hipertensión` no afectan la preferencia de horario. Un paciente con `Nefroprotección` y `Diabetes` RECIBE la primera mitad.

**Eje B (Cupos Adicionales):**
- Contiene `hipertensión` Y NO contiene `diabetes` ni `HTA+DM` ni `nefroprotección` -> **Adicionales Recomendados**
- Contiene `diabetes`, `HTA+DM`, o `nefroprotección` -> **Adicionales NO Recomendados** (visibles pero no recomendados)

**Comportamiento por defecto (`SIN_ETIQUETA`):**
Si el paciente no tiene `programasPaciente` (o no coinciden con ninguna cadena conocida), se asume estado `SIN_ETIQUETA`. No se deducen condiciones clínicas a partir de silencios. Se mostrarán los horarios sin recomendaciones, permitiendo los cupos adicionales como información secundaria de ser necesario.

## Preguntas al Médico

1. **Cadenas exactas para diabetes y HTA+DM:** La captura actual confirma "Hipertensión" y "Nefroprotección", pero no contiene a un paciente diabético. Necesitamos que el médico ejecute el script `DIAGNOSTICO_ETIQUETAS.js` (incluido en esta entrega) en un paciente con diabetes, para que nos confirme textualmente cómo se ven esas cadenas (ej: ¿Es "Diabetes", "Diabetes Mellitus", "HTA + DM", "HTA/DM"?).
