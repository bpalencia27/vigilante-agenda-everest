# Inventario de Suposiciones No Verificadas (`SUPUESTO`)

> **Propósito:** Lista exhaustiva de las 20 suposiciones que el código hace sobre Everest y que no cuentan con una captura con cuerpo o confirmación en consultorio.  
> **Ordenadas por consecuencia clínica**, de mayor a menor impacto sobre el paciente y la consulta.  
> **Regla de verificación (§0):** Antes de proponer capturar en vivo, agotar lo que ya está en el repositorio.

---

## 1. Consecuencia Clínica ALTA: Fechas de Laboratorio y Cálculo de Función Renal

### 1.1. Casillas de Fecha de los 7 Analitos Cardiovasculares y Renales
- **IDs en Contrato:**
  * `dom-lab-fec-creatinina` (Creatinina Sérica)
  * `dom-lab-fec-rac` (Relación Albúmina/Creatinina)
  * `dom-lab-fec-col-ldl` (Colesterol LDL)
  * `dom-lab-fec-col-total` (Colesterol Total)
  * `dom-lab-fec-glicemia` (Glucosa / Glicemia)
  * `dom-lab-fec-trigliceridos` (Triglicéridos)
  * `dom-lab-fec-col-hdl` (Colesterol HDL)
  * `dom-lab-fec-hemoglobina` (Hemograma)
- **Suposición del código:** Que cada casilla de resultado tiene una casilla de fecha con ID construido por convención (`fechaResult` + NombreAnalito), o que vive como elemento `<input type="date">` hermano dentro del contenedor `.input-group`.
- **Consecuencia clínica:** En v12.3.30 ya se materializó este bug: los 4 nombres supuestos no existían y **ninguna fecha se escribió durante meses**. El resultado se inyecta pero la fecha queda vacía; el médico no sabe si el valor es de hoy o de hace 6 meses (riesgo de tomar decisiones terapéuticas sobre datos vencidos).
- **Qué hace falta para verificarlo:**
  1. Revisar `MAPA_EVEREST_20260814_1712.json` (que ya contiene los 64 campos de la Ruta Crónicos).
  2. Confirmar si los `<input type="date">` tienen ID propio (ej. `fechaResultadoCreatinina` vs `fechaResultCreatinina`) o si el selector dinámico `.input-group input[type="date"]` los resuelve todos en producción.
  3. Ejecutar `COSECHADOR_CASILLAS.js` en una sesión real para volcar los 64 IDs y names exactos de Crónicos.

---

### 1.2. Consulta de Peso e Histórico de Signos Vitales
- **ID en Contrato:** `api-ruta-hc-signos-vitales` (`GET /apiviva/APIHCHealth/api/Historicos/ObtenerHistoricoSignosVitales`)
- **Suposición del código:** Que este endpoint devuelve un arreglo con las tomas de peso corporal (`peso`, `fecha`) del paciente en Everest.
- **Consecuencia clínica:** El peso corporal es una variable multiplicadora indispensable en la ecuación de Cockcroft-Gault para estimar la Tasa de Filtración Glomerular (TFG/CrCl). Si el endpoint no responde o el esquema difiere, la función `_pesoDeSignosVitales()` devuelve `null` y el estadio renal no se puede calcular automáticamente.
- **Qué hace falta para verificarlo:**
  - Ejecutar `GRABADOR_1_INICIAR.js` en consultorio al abrir la pestaña de Signos Vitales / Historia Clínica de un paciente, y descargar la captura con `GRABADOR_2_DESCARGAR.js` para registrar el cuerpo JSON real de `ObtenerHistoricoSignosVitales`.

---

### 1.3. Consulta de Órdenes Vigentes de PyM
- **ID en Contrato:** `api-ruta-hc-ordenes-vigentes` (`GET /apiviva/APIHCHealth/api/Historicos/ObtenerOrdenamientoPorPacienteIdVigente`)
- **Suposición del código:** Que este endpoint devuelve las órdenes médicas activas emitidas en los últimos meses.
- **Consecuencia clínica:** Previene la duplicación innecesaria de exámenes de Promoción y Mantenimiento (ej. ordenar dos veces una mamografía o un PSA en el mismo semestre). Si no se puede leer, el script no sabe si ya fue ordenado y puede sugerir al médico una orden redundante.
- **Qué hace falta para verificarlo:**
  - Capturar una sesión de consulta donde el paciente tenga órdenes previas activas usando el grabador nativo.

---

### 1.4. Casillas de Analitos ERC Avanzada (PTH, Fósforo, Albúmina)
- **IDs en Contrato:**
  * `dom-lab-res-pth`, `dom-lab-fec-pth`
  * `dom-lab-res-fosforo`, `dom-lab-fec-fosforo`
  * `dom-lab-res-albumina`, `dom-lab-fec-albumina`
- **Suposición del código:** Que existen casillas `resultadoPTH`, `resultadoFosforo`, `resultadoAlbumina` en la Ruta de Crónicos.
- **Consecuencia clínica:** Pacientes en estadio renal 4 y 5 requieren control de metabolismo óseo-mineral (PTH, Fósforo) y estado nutricional (Albúmina). Si las casillas no existen en el formulario de Everest (como ya ocurrió con HbA1c), el analito se reporta como "Sin casilla en esta vista" y el médico debe verificar si Everest tiene otra pestaña para nefropatía avanzada.
- **Qué hace falta para verificarlo:**
  - Inspeccionar el archivo `MAPA_EVEREST_20260814_1712.json` en `grounding/mapas/` para buscar si existen inputs con subcadenas `pth`, `fosf`, `album` en sus atributos `id` o `name`.

---

## 2. Consecuencia Clínica MEDIA: Visores Históricos y Fecha de Agenda

### 2.1. Endpoints de Laboratorios Históricos Externos (Annar y Citi)
- **IDs en Contrato:**
  * `api-ruta-hc-labs-annar` (`GET /apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioAnnar`)
  * `api-ruta-hc-labs-citi` (`GET /apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioCiti`)
- **Suposición del código:** Que Everest expone endpoints históricos para consultar analitos procesados por laboratorios externos previos (Annar/Citi).
- **Consecuencia clínica:** Si fallan, el visor de históricos muestra una lista vacía. No afecta la inyección de la consulta actual (que viene por Athenea), pero el médico pierde la visualización de la tendencia histórica de años anteriores.
- **Qué hace falta para verificarlo:**
  - Probar en consulta si Everest hace llamadas a estos endpoints al abrir la pestaña de Históricos. Si nunca se invocan, evaluar marcarlos como código candidato a retiro.

---

### 2.2. Selector de Fecha en Agenda
- **ID en Contrato:** `dom-agenda-fecha` (`.fecha`)
- **Suposición del código:** Que la fecha seleccionada en la vista de agenda está contenida en un elemento con clase `.fecha`.
- **Consecuencia clínica:** Degradación menor. El script recurre a la fecha del sistema (`new Date()`), que coincide en el 99% de las consultas de la jornada.
- **Qué hace falta para verificarlo:**
  - Verificar en `captura_agendamiento_oficial_20260810.json` o en `MAPA_EVEREST_20260814_1643.json` qué selector contiene la fecha activa de la agenda.

---

## 3. Consecuencia Clínica BAJA / NULA: Código Muerto

### 3.1. Cierre de Ticket en Digiturno
- **ID en Contrato:** `api-ruta-digiturno-finalizar` (`POST /apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket`)
- **Suposición del código:** Que este endpoint cierra la llamada del paciente en la pantalla de sala de espera.
- **Consecuencia clínica:** **Cero consecuencia hoy**, porque ninguna función del userscript invoca `apiDigiturnoFinalizarTicket()`. Está catalogado como código muerto inerte.
- **Qué hace falta para verificarlo:**
  - No requiere verificación clínica. Requiere retiro o aislamiento formal mediante orden de cambio en `docs/cambios-pendientes/`.

---

## 4. Plan de Acción y Prioridad de Capturas en Consultorio

| Prioridad | Objetivo | Método | Tiempo Estimado |
|---|---|---|---|
| 🔴 **P1 (Crítica)** | Volcar los 64 IDs reales de Crónicos | Ejecutar `COSECHADOR_CASILLAS.js` en DevTools | 1 minuto |
| 🔴 **P2 (Alta)** | Capturar cuerpo de `ObtenerHistoricoSignosVitales` | `GRABADOR_1_INICIAR.js` al abrir historia clínica | 2 minutos |
| 🟡 **P3 (Media)** | Capturar cuerpo de `ObtenerOrdenamientoPorPacienteIdVigente` | `GRABADOR_1_INICIAR.js` al consultar órdenes | 2 minutos |
| 🟢 **P4 (Baja)** | Evaluar existencia de endpoints Annar/Citi | Monitoreo pasivo en pestaña de red | 5 minutos |
