# Guiones Adversariales de Fallo en Caminos de Escritura Clínica

> **Marco Metodológico de Auditoría:**
> - **Atacante (High Thinking):** Formula el guion temporal concreto (gestos del médico + tiempos de red) para forzar un fallo clínico (escribir en paciente equivocado o ejecutar acción no deseada).
> - **Refutador 1 (High Thinking):** Asume que el atacante se equivocó y busca exhaustivamente la guarda en el código, arnés o arquitectura que bloquee el ataque.
> - **Refutador 2 (High Thinking):** Audita el contrato de red, tipos de datos y fronteras DOM/API de forma independiente.
> - **Veredicto:** Solo sobrevive un hallazgo si ambos refutadores fallan en tumbar la premisa del ataque con evidencia verificable del código.

---

## Familia A: Citas y SMS (`apiAccesoAsignarTurno`, `apiLaboratorioAgendarAuto`, SMS)

### Guion A1: Conmutación de Paciente mientras se Asigna Cita de Control Everest
- **Secuencia y Tiempos:**
  1. **T = 0s:** El médico tiene abierta la agenda del día y hace clic en "📅 Agendar Control" en la tarjeta del Paciente A (Cédula `1001`, `pacienteIdAcceso = 5001`). Se abre `#vgl-agendar-modal`.
  2. **T = 5s:** El médico selecciona fecha y hora (ej. 2026-09-15 08:00 AM).
  3. **T = 6s:** Antes de pulsar confirmar, el médico hace clic en la pestaña principal de Everest y abre la historia clínica del Paciente B (Cédula `2002`). El DOM de Everest ahora muestra a Paciente B.
  4. **T = 7s:** El médico regresa al modal `#vgl-agendar-modal` (que sigue flotando) y pulsa "✓ Confirmar y asignar cita".
  5. **T = 7.2s:** `apiAccesoObtenerTurnos` verifica disponibilidad.
  6. **T = 7.6s:** Se dispara `apiAccesoAsignarTurno`.
- **Alegato del Atacante:**
  "Dado que la historia clínica activa en Everest cambió al Paciente B, la cita de control se agendará para el Paciente B pero con los datos elegidos para el Paciente A, contaminando la agenda."
- **Refutación 1 (Líneas 11812–11950):**
  FALSO. Al invocar `openAgendamientoModal(apt)`, el objeto `apt` (Paciente A) queda atrapado en el closure del modal. `pacienteIdAcceso` se resuelve mediante `apiAccesoBuscarPaciente("1001")` y da `5001`. Al hacer clic en confirmar en T=7s, la función ejecuta:
  `apiAccesoAsignarTurno(turnoId, 5001, "2026-09-15", ...)`
  El backend de Everest (`APIAcceso/api/Acceso/AsignarTurno`) recibe `PacienteId=5001`. La cita se crea inequívocamente para el Paciente A.
- **Refutación 2 (Línea 11837):**
  El modal muestra de forma permanente e indeleble en su cabecera:
  `Documento: 1001 · Paciente: PACIENTE A`.
  El médico ve a quién está agendando. No hay confusión de identidad.
- **Resultado:** ❌ **REFUTADO (Seguro por diseño).** La parametrización explícita de `pacienteId` previene la contaminación cruzada.

---

### Guion A2: Duplicación de Cita por Doble Clic Rápido del Médico
- **Secuencia y Tiempos:**
  1. **T = 0 ms:** El médico pulsa "✓ Confirmar y asignar cita".
  2. **T = 50 ms:** Por nerviosismo o latencia percibida, el médico vuelve a hacer clic inmediatamente en el botón de confirmar.
- **Alegato del Atacante:**
  "Se dispararán dos llamadas concurrentes a `AsignarTurno`, reservando dos cupos de cita y enviando dos SMS."
- **Refutación 1 (Línea 12585):**
  FALSO. En la línea 12585, la primera instrucción síncrona dentro del event listener es:
  `confirmBtn.disabled = true; confirmBtn.textContent = "⏳ Asignando cita...";`
  El navegador descarta cualquier clic subsiguiente de forma inmediata a nivel de DOM antes del primer `await`.
- **Refutación 2 (Líneas 11175, 11191):**
  El envío de SMS en `apiAccesoAsignarTurno` se realiza con un fetch directo de un solo disparo (sin reintentos automáticos de `pageFetchJson`), evitando ráfagas de mensajes.
- **Resultado:** ❌ **REFUTADO (Idempotencia garantizada en UI).**

---

### Guion A3: Agendamiento de Laboratorio en AppCita con Kill-Switch Remoto Activo
- **Secuencia y Tiempos:**
  1. **T = 0s:** La red de seguridad remota activa el kill-switch global (`state.killed = true`) debido a un incidente de integridad.
  2. **T = 1s:** El médico tiene abierto el modal `#vgl-lab-modal` o `#vgl-agendar-modal` con la casilla de toma de muestras marcada.
  3. **T = 2s:** Se ejecuta `apiLaboratorioAgendarAuto(docId, fechaIso, hora, celular)`.
- **Alegato del Atacante:**
  "`apiLaboratorioAgendarAuto` no tiene guarda `if (state.killed)`. Realizará la reserva en AppCita (`AgendarCita`) y enviará un SMS real al paciente (`EnviarMensajeTextoLaboratorio`) a pesar de que el asistente fue apagado remotamente."
- **Refutación 1 (Búsqueda en L10484–10603):**
  Revisado el código de `apiLaboratorioAgendarAuto`: la función comienza directamente en L10484 con `try { const urlTurnos = ...; const resAg = await gmPostJson(...); }`. No existe ninguna comprobación de `state.killed`.
- **Refutación 2 (Búsqueda en transportes `gmPostJson` / `_gmReq`):**
  Revisadas las funciones `gmPostJson` y `_gmReq`: son utilidades genéricas de transporte HTTP y no verifican el estado del kill-switch.
- **Resultado:** 🟢 **HALLAZGO CONFIRMADO.** La función de agendamiento de laboratorio y su envío de SMS eluden el kill-switch.

---

## Familia B: Órdenes CUPS y Correo (`apiOrdenamientoGuardar`, `apiEnviarOrdenPorCorreo`)

### Guion B1: Órdenes Clínicas Generadas al Cambiar de Paciente en Historia
- **Secuencia y Tiempos:**
  1. **T = 0s:** Médico abre modal de órdenes PyM para Paciente A (Cédula `1001`).
  2. **T = 3s:** Se premarcan los paquetes sugeridos según el Excel (ej. HTA + DM2).
  3. **T = 4s:** El médico abre en Everest la historia del Paciente B (Cédula `2002`).
  4. **T = 5s:** El médico pulsa "✓ Generar órdenes seleccionadas (2)".
  5. **T = 5.2s:** Se resuelve `pacienteIdOrd = await apiOrdenamientoBuscarPaciente("1001")`.
  6. **T = 6s:** Se ejecutan los POSTs de `apiOrdenamientoGuardar`.
- **Alegato del Atacante:**
  "Las órdenes se asentarán en la historia clínica del Paciente B porque es la que está activa en el DOM."
- **Refutación 1 (Líneas 13191–13212):**
  FALSO. La API oficial de ordenamiento de Everest (`/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento`) es un endpoint HTTP independiente del DOM que recibe el payload:
  `{ DiagnosticoId: dxId, paciente: { Id: pacienteIdOrd }, ... }`
  El servidor de Everest asienta las órdenes en la cuenta del paciente cuyo ID viaja en el JSON (`pacienteIdOrd`, correspondiente a la Cédula `1001`).
- **Refutación 2 (Línea 13551):**
  `pacienteIdOrd` se obtiene explícitamente consultando la cédula `apt.doc_id` del modal, no del DOM de fondo. Si la búsqueda falla (`!pacienteIdOrd`), el flujo aborta en falla cerrada con `alert(...)`.
- **Resultado:** ❌ **REFUTADO (Seguro por diseño).**

---

### Guion B2: Envío de Orden por Correo con Kill-Switch Activo
- **Secuencia y Tiempos:**
  1. **T = 0s:** Las órdenes se generaron en pantalla.
  2. **T = 1s:** Se activa el kill-switch (`state.killed = true`).
  3. **T = 2s:** El médico escribe un correo en el campo `#vgl-ord-mail-input` y pulsa "Enviar".
  4. **T = 2.1s:** Se invoca `apiEnviarOrdenPorCorreo(agp, correo, pacienteIdOrd)`.
- **Alegato del Atacante:**
  "`apiEnviarOrdenPorCorreo` no verifica `state.killed` y procederá a llamar a `/apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento`, despachando el correo al exterior."
- **Refutación 1 (Línea 13307):**
  Revisado el código de `apiEnviarOrdenPorCorreo`:
  ```javascript
  async function apiEnviarOrdenPorCorreo(agrupador, correo, usuarioId) {
    try {
      const f = FETCH0 || window.fetch;
      const url = location.origin + "/apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento"
        + "?Grupo=" + encodeURIComponent(agrupador) + "&Correo=" + encodeURIComponent(correo) + "&UsuarioId=" + encodeURIComponent(usuarioId);
      const resp = await f(url, { headers: { "Accept": "application/json" } });
  ```
  No existe comprobación de `state.killed`.
- **Refutación 2:**
  Aunque `apiOrdenamientoGuardar` sí verifica `state.killed`, la sección de envío de correo se ejecuta en un evento posterior independiente (`mailBtn.addEventListener("click", ...)`), por lo que un kill-switch activado durante la consulta no detiene el envío del correo.
- **Resultado:** 🟢 **HALLAZGO CONFIRMADO.** `apiEnviarOrdenPorCorreo` no respeta el kill-switch.

---

## Familia C: Caminos de DOM (`injectLabsIntoCronicos`, `createExamenFisicoInjectorUI`, `_conductaBuscarYAgregarExamen`)

### Guion C1: Inyección de Laboratorios cuando el Médico Cambia de Historia durante la Consulta a Athenea
- **Secuencia y Tiempos:**
  1. **T = 0s:** El robot de Athenea inicia consulta de laboratorios para el Paciente A (`docId = "1001"`).
  2. **T = 1.5s:** El médico cierra la historia del Paciente A y abre la del Paciente B (`docId = "2002"`).
  3. **T = 3.0s:** Athenea responde con los laboratorios del Paciente A (ej. Creatinina 4.5 mg/dL).
  4. **T = 3.1s:** Se invoca `injectLabsIntoCronicos(labs, "1001", opts)`.
- **Alegato del Atacante:**
  "Las casillas de la historia del Paciente B se rellenarán con la creatinina de 4.5 del Paciente A."
- **Refutación 1 (Líneas 2517–2520):**
  FALSO. En la entrada de `injectLabsIntoCronicos`:
  ```javascript
  if (!_pacienteSigueAbierto(docIdEsperado)) {
      console.warn("[Vigilante] Auto-Labs ABORTADO: el paciente abierto cambió mientras Athenea respondía. No se escribió ninguna casilla.");
      return { count: 0, ..., abortadoPorPaciente: true };
  }
  ```
  `_pacienteSigueAbierto("1001")` lee el DOM de Everest (`extractPacienteAbierto()`), detecta que el documento actual es `"2002"`, y aborta de inmediato sin modificar ninguna casilla.
- **Refutación 2 (Líneas 2784, 2812):**
  Los reintentos diferidos de uroanálisis a 300 ms y 900 ms vuelven a evaluar `_pacienteSigueAbierto(docIdEsperado)` antes de cualquier inyección en el DOM.
- **Resultado:** ❌ **REFUTADO (Guarda v14.1.5 verificada y funcional).**

---

### Guion C2: Inyección de Plantilla de Examen Físico en Paciente Equivocado
- **Secuencia y Tiempos:**
  1. **T = 0s:** El médico está en la pestaña "Examen Físico" de Everest.
  2. **T = 1s:** El médico hace clic en el botón "🩺 Normalidad fija" (`#vgl-examen-normalidad`).
- **Alegato del Atacante:**
  "`createExamenFisicoInjectorUI` no tiene la guarda `_pacienteSigueAbierto`, por lo que puede escribir en un paciente incorrecto."
- **Refutación 1 (Líneas 3822–3852):**
  FALSO. A diferencia de Auto-Labs (que sufre una latencia de red de 2 a 4 segundos contra un servidor externo), el botón de examen físico opera de forma **100% síncrona en el hilo principal de JavaScript**:
  `candidatos = _casillasExamenFisico(); porAplicar.forEach(({el, texto}) => setNgValue(el, texto));`
  No hay ningún `await`, `fetch` ni `setTimeout`. El médico escribe directamente sobre la vista que tiene frente a sus ojos en el instante exacto en que pulsa el botón.
- **Refutación 2 (Líneas 3836–3837):**
  La función respeta estrictamente cualquier casilla que ya contenga texto (`actual === ""`), impidiendo la sobrescritura de hallazgos previamente redactados por el médico.
- **Resultado:** ❌ **REFUTADO (No requiere guarda asíncrona de paciente al ser síncrono).**

---

### Guion C3: Inyección de Examen Físico con Kill-Switch Activo
- **Secuencia y Tiempos:**
  1. **T = 0s:** Se activa `state.killed = true`.
  2. **T = 1s:** El médico pulsa "🩺 Normalidad fija".
- **Alegato del Atacante:**
  "El botón rellenará las 36 casillas del examen físico a pesar del kill-switch."
- **Refutación 1 (Línea 3822):**
  Revisado el manejador `btnNormalidad.onclick`: no verifica `state.killed`.
- **Refutación 2:**
  El kill-switch debe bloquear todas las mutaciones del userscript hacia el DOM o la API.
- **Resultado:** 🟢 **HALLAZGO CONFIRMADO (Menor gravedad clínica al ser acción interactiva síncrona, pero violación de la invariante del Kill-Switch).**

---

## Familia D: Código Muerto y Kill-Switch (`apiDigiturnoFinalizarTicket`)

### Guion D1: Ejecución Accidental de `apiDigiturnoFinalizarTicket`
- **Secuencia y Tiempos:**
  1. **T = 0s:** Un agente o script invoca `apiDigiturnoFinalizarTicket(12345)`.
- **Alegato del Atacante:**
  "El script enviará una petición a `ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket` que cerrará prematuramente el turno en la sala de espera sin verificar el kill-switch."
- **Refutación 1 (Línea 10605):**
  `apiDigiturnoFinalizarTicket` no comprueba `state.killed`.
- **Refutación 2 (Verificación de Huérfanas en codebase):**
  No existe ningún llamador en `vigilante_agenda.user.js` que invoque esta función. Está 100% inerte en producción. Sin embargo, su presencia en el archivo expone un riesgo innecesario de escritura clínica/administrativa.
- **Resultado:** 🟢 **HALLAZGO CONFIRMADO (Riesgo de código muerto con endpoint de escritura).**

---

## Tabla Resumen de Veredictos de Guiones

| Guion | Familia | Camino Afectado | Veredicto | Motivo Técnico / Guarda Hallada |
|---|---|---|---|---|
| **A1** | A (Citas) | `apiAccesoAsignarTurno` | ❌ REFUTADO | `pacienteIdAcceso` explícito en payload POST (L11165). |
| **A2** | A (Citas) | `apiAccesoAsignarTurno` | ❌ REFUTADO | `confirmBtn.disabled = true` síncrono previene duplicados (L12585). |
| **A3** | A (Lab/SMS) | `apiLaboratorioAgendarAuto` | 🟢 **CONFIRMADO** | Omite `state.killed` (L10484). |
| **B1** | B (Órdenes) | `apiOrdenamientoGuardar` | ❌ REFUTADO | `pacienteIdOrd` explícito en payload POST (L13195). |
| **B2** | B (Correo) | `apiEnviarOrdenPorCorreo` | 🟢 **CONFIRMADO** | Omite `state.killed` (L13307). |
| **C1** | C (DOM Labs) | `injectLabsIntoCronicos` | ❌ REFUTADO | `_pacienteSigueAbierto` activo en 3 puntos críticos (L2517, 2784, 2812). |
| **C2** | C (DOM ExFis) | `createExamenFisicoInjectorUI` | ❌ REFUTADO | Ejecución 100% síncrona (0 ms), no expuesta a carreras de red. |
| **C3** | C (DOM ExFis) | `createExamenFisicoInjectorUI` | 🟢 **CONFIRMADO** | Omite `state.killed` en manejador de clic (L3822). |
| **D1** | D (Digiturno) | `apiDigiturnoFinalizarTicket` | 🟢 **CONFIRMADO** | Código muerto con endpoint de mutación y sin kill-switch (L10605). |
