# Auditoría de los Caminos de Escritura Clínica

> **Línea Base Verificada:**
> - **Commit HEAD:** `da4e747eb1824f5ddc65c9cff117c703d773d362`
> - **SHA256 (`vigilante_agenda.user.js`):** `b7517b11db69bacf2a580fba074c37d995c8c0d6727474fb32133f2c9f5f0a72`
> - **Fecha:** 15-ago-2026

---

## 0. Resumen Ejecutivo y Pregunta Central

### La Pregunta Central
> `_pacienteSigueAbierto` aparece exactamente 3 veces en el userscript (líneas ~2517, ~2784, ~2812), todas dentro de `injectLabsIntoCronicos`. ¿Por qué los demás caminos de escritura no la usan, y demuestran o no la necesidad de una guarda de identidad del paciente en el momento de la escritura?

### Conclusión Central
1. **Diferencia Estructural de Frontera (DOM vs. API Parametrizada):**
   - **`injectLabsIntoCronicos` (Camino 6):** Escribe buscando elementos en el DOM global (`document.getElementById`, `.input-group`). En el DOM de Angular de Everest, las casillas de texto no llevan el ID del paciente como atributo. Si durante la ventana de red contra Athenea (2-4 segundos) el médico abre la historia de otro paciente, el DOM cambia al nuevo paciente, pero los IDs de las casillas siguen siendo idénticos. Sin `_pacienteSigueAbierto`, los datos del paciente anterior se inyectaban en el paciente nuevo.
   - **`apiAccesoAsignarTurno` (Camino 1) y `apiOrdenamientoGuardar` (Camino 2):** Reciben `pacienteIdAcceso` y `pacienteIdOrd` como **parámetros enteros explícitos** en el payload HTTP (`PacienteId=${pacienteId}`, `paciente: { Id: pacienteId }`). Estos IDs son resueltos e inmutables, vinculados a la instancia del modal y a la cédula `apt.doc_id` del paciente seleccionado. Si el médico navega a otra historia en segundo plano, la petición HTTP se envía inequívocamente al registro del paciente seleccionado en el modal, nunca al paciente abierto en la pantalla de fondo.
   - **`createExamenFisicoInjectorUI` (Camino 7):** Es **100% síncrono** en el manejador del clic (0 ms de ventana de red, 0 temporizadores). Escribe de inmediato en las casillas vacías de la vista que el médico está observando y sobre la cual hizo clic.

2. **Hallazgos Críticos Confirmados:**
   - **Vulnerabilidad de Kill-Switch Incompleto:** Mientras que los Caminos 1, 2 y 6 verifican `state.killed` antes de escribir, los Caminos 3 (`apiEnviarOrdenPorCorreo`), 4B (`apiLaboratorioAgendarAuto` / SMS Lab), 5 (`apiDigiturnoFinalizarTicket`), 7 (`createExamenFisicoInjectorUI`) y 8 (`_conductaBuscarYAgregarExamen`) **omiten la verificación de `state.killed`**. Ante una pausa remota de emergencia, el asistente aún podría enviar correos, agendar citas de laboratorio externas o mutar el DOM.
   - **Medición de Código Muerto (`apiDigiturnoFinalizarTicket`):** La función (L10605) está 100% huérfana en el árbol de ejecución de producción, no verifica `state.killed` y envía una petición que mutaría el estado de la fila de Digiturno si fuera invocada.

---

## 1. Matriz General de los 8 Caminos de Escritura

| # | Camino / Función | Endpoint / Destino | Tipo | Identidad del Paciente | Ventana Temporal | Falla Cerrada | Idempotente | Respeta Kill-Switch | Reversibilidad |
|---|---|---|---|---|---|---|---|---|---|
| **1** | `apiAccesoAsignarTurno` (L11147) | `/apiviva/APIAcceso/api/Acceso/AsignarTurno` | API POST | `pacienteIdAcceso` explícito (resuelto de `apt.doc_id`) | ~500–1000 ms (1 verificación de cupo) | SÍ | SÍ (Botón disabled) | SÍ (L11148) | Reversible en Everest |
| **2** | `apiOrdenamientoGuardar` (L13182) | `/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento` | API POST | `pacienteIdOrd` explícito (resuelto de `apt.doc_id`) | ~800–2500 ms (búsqueda Dx y CUPS) | SÍ | SÍ (Botón disabled, checks desmarcados) | SÍ (L13183) | Reversible en Everest |
| **3** | `apiEnviarOrdenPorCorreo` (L13307) | `/apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento` | API GET | `UsuarioId=pacienteIdOrd`, `Correo` manual, `Grupo=agrupador` | ~500 ms por orden | SÍ (Regex correo) | SÍ (Botón disabled) | **NO** (L13307) | **IRREVERSIBLE** (Externo) |
| **4A** | SMS Cita Everest (L11190) | `/apiviva/APIAcceso/api/SMS/EnviarSMS` | API GET | `Telefono=cel`, `AgendaTurnoId=turnoId` | Inmediato post-creación de cita | SÍ (`cel.length >= 7`) | SÍ (1 solo disparo fetch) | SÍ (Vía AsignarTurno) | **IRREVERSIBLE** (Externo) |
| **4B** | SMS Lab AppCita (L10588) | `appcita.viva1a.com.co:8051/API/EnviarMensajeTextoLaboratorio` | API GET | `Celular=telParam`, `codigoCita=radicado` | Inmediato post-reserva de lab | SÍ (`celular && radicado`) | SÍ (Flujo modal) | **NO** (L10484) | **IRREVERSIBLE** (Externo) |
| **5** | `apiDigiturnoFinalizarTicket` (L10605) | `/apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket` | API GET | `EverestId=b64(citaId)`, `UsuarioId=uId` | N/A (Código muerto huérfano) | SÍ (`!citaId -> return`) | NO | **NO** (L10605) | Cambia turno a "Finalizado" |
| **6** | `injectLabsIntoCronicos` (L2503) | DOM: Casillas `.input-group` / `input[type="date"]` | DOM Write | `docIdEsperado` + `_pacienteSigueAbierto` (3 comprobaciones) | 0 ms principal; 300 ms y 900 ms reintentos orina | SÍ (Estricta DOM check) | SÍ (Compara valor actual) | SÍ (L2504 + featureFlag) | Reversible (antes de guardar) |
| **7** | `createExamenFisicoInjectorUI` (L3813) | DOM: `input[id="alert_message"][type="text"]` | DOM Write | DOM actual visible en pantalla | 0 ms (100% síncrono en click) | SÍ (Solo casillas vacías) | SÍ (Casillas llenas se saltan) | **NO** (L3813) | Reversible (antes de guardar) |
| **8** | `_conductaBuscarYAgregarExamen` (L1239) | DOM: `li` catálogo + botón `AGREGAR` | DOM Click | Coincidencia EXACTA texto `li` en DOM | 700 ms (`setTimeout` botón) | SÍ (Exact match, no substring) | Depende de Everest | **NO** (L1239) | Reversible en Conducta |

---

## 2. Auditoría Detallada Camino por Camino (Las 7 Preguntas de §3)

### Camino 1: `apiAccesoAsignarTurno` (L11147)

1. **Identidad del destinatario:**
   - Destinatario: Paciente seleccionado en la agenda/tarjeta (`apt.doc_id`).
   - Resolución: Al abrir `openAgendamientoModal(apt)`, se resuelve `pacienteIdAcceso` mediante `apiAccesoBuscarPaciente(apt.doc_id)`.
   - Momento de fijación: Queda ligado por clausura léxica al modal. El modal muestra explícitamente en la cabecera:
     ```html
     <div class="vgl-agm-patient">${escapeHtml(patientName)}</div>
     <div class="vgl-agm-sub">Documento: <b>${escapeHtml(apt.doc_id)}</b> · Médico: <b>${escapeHtml(doctorName)}</b></div>
     ```
2. **Ventana temporal:**
   - Desde el clic en `#vgl-agm-confirm` hasta la llamada POST `AsignarTurno`:
     - T0 (0 ms): `confirmBtn.disabled = true; confirmBtn.textContent = "⏳ Asignando cita...";`
     - T1 (~200–400 ms): `await apiAccesoObtenerTurnos(ctxElegido.agendaId, ctxElegido.fecha, pacienteIdAcceso);` (re-verificación en tiempo real para descartar cupo tomado por otro usuario).
     - T2 (~300–500 ms): `await apiAccesoAsignarTurno(turnoId, pacienteIdAcceso, ...);`
   - Total: ~500–1000 ms. No hay temporizadores diferidos (`setTimeout`) antes del POST.
3. **Comportamiento ante lo indeterminable:**
   - Falla cerrada:
     - `if (!apt || !apt.doc_id)` -> No abre el modal.
     - `if (!pacienteIdAcceso)` -> Slots bloqueados; botón de confirmación no dispara.
     - `if (!uId)` (médico) -> `return { error: true, mensaje: "No se pudo identificar al médico..." }`.
4. **Idempotencia:**
   - Inmediata: `confirmBtn.disabled = true;` en la primera línea síncrona del manejador de clic. Los botones de slots también se deshabilitan (`b.disabled = true`).
5. **Kill-switch:**
   - SÍ respeta: `if (state.killed) return { error: true, mensaje: "Pausa de seguridad remota activa..." };` (L11148).
6. **Cobertura del fallo:**
   - Cubierto en Suite 13 (`tests/suite_13_api_agenda.js`) y Suite 30 (`tests/suite_30_killswitch_canario.js`).
7. **Reversibilidad:**
   - Reversible en el sistema clínico: la cita puede cancelarse o reasignarse desde el módulo de agenda de Everest. El médico recibe confirmación con radicado oficial.

---

### Camino 2: `apiOrdenamientoGuardar` (L13182)

1. **Identidad del destinatario:**
   - Destinatario: Paciente del modal de órdenes (`apt.doc_id`).
   - Resolución: En el clic de confirmación, `pacienteIdOrd = await apiOrdenamientoBuscarPaciente(apt.doc_id);`.
   - Momento: Previo a la generación de cualquier orden en el bucle de paquetes seleccionados.
2. **Ventana temporal:**
   - Desde clic en `#vgl-ord-confirm` hasta la llamada POST `GuardarOrdenamiento`:
     - T0 (0 ms): `confirmBtn.disabled = true;`
     - T1 (~200 ms): `await apiOrdenamientoBuscarPaciente(apt.doc_id);`
     - Por cada paquete:
       - T2 (~150 ms): `await apiOrdenamientoObtenerDx(pkg.cie10);`
       - T3 (~150 ms por CUP): `await apiOrdenamientoObtenerCup(pacienteIdOrd, cInfo.codigo);`
       - T4 (~300–500 ms): `await apiOrdenamientoGuardar(pacienteIdOrd, dxId, cupsObjs);`
   - Total: ~800–2500 ms dependiendo del número de paquetes.
3. **Comportamiento ante lo indeterminable:**
   - Falla cerrada:
     - `if (!pacienteIdOrd)` -> Muestra `alert(...)` y cancela el flujo sin escribir.
     - `if (!dxId)` -> Salta el paquete y marca como fallido; no inventa diagnóstico.
     - `if (!cupsObjs.length)` -> Salta el paquete; no envía orden sin códigos CUPS.
     - `if (!uId)` (médico) -> `alert("No se pudo identificar al médico..."); return null;`.
4. **Idempotencia:**
   - `confirmBtn.disabled = true;` en T0. Los paquetes completados exitosamente se desmarcan y se deshabilitan (`c.checked = false; c.disabled = true;`).
5. **Kill-switch:**
   - SÍ respeta: `if (state.killed) { alert(...); return null; }` (L13183).
6. **Cobertura del fallo:**
   - Cubierto en Suite 05, Suite 19 y Suite 30.
7. **Reversibilidad:**
   - Reversible: las órdenes generadas pueden anularse en el módulo de órdenes de Everest. Se muestran en pantalla los agrupadores generados.

---

### Camino 3: `apiEnviarOrdenPorCorreo` (L13307)

1. **Identidad del destinatario:**
   - Destinatario: Correo electrónico introducido por el médico (`mailInput.value`).
   - Parámetros HTTP: `Grupo=${agrupador}&Correo=${correo}&UsuarioId=${pacienteIdOrd}`.
   - Momento: Posterior a la creación exitosa de las órdenes en el modal.
2. **Ventana temporal:**
   - Desde clic en "Enviar" hasta `EnviarEmailOrdenamiento`:
     - T0 (0 ms): `mailBtn.disabled = true; mailBtn.textContent = "⏳ Enviando...";`
     - Por cada agrupador:
       - T1 (~200 ms): `await apiOrdenamientoGenerarLinks(pacienteIdOrd, agp);`
       - T2 (~300 ms): `await apiEnviarOrdenPorCorreo(agp, correo, uIdEnvio);`
   - Total: ~500 ms por agrupador.
3. **Comportamiento ante lo indeterminable:**
   - Falla cerrada: `if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))` aborta con aviso en pantalla.
4. **Idempotencia:**
   - `mailBtn.disabled = true;` durante el envío. Se reactiva al terminar para permitir reenvío o corrección si hubo error parcial.
5. **Kill-switch:**
   - **NO respeta `state.killed`:** La función `apiEnviarOrdenPorCorreo` (L13307) no verifica `state.killed`. Si la pausa de seguridad remota se activa tras la creación de órdenes, el correo aún puede dispararse.
6. **Cobertura del fallo:**
   - Suite 20 (`tests/suite_20_correo_ordenes.js`) cubre parámetros y contrato HTTP, pero carece de aserción sobre `state.killed`.
7. **Reversibilidad:**
   - **IRREVERSIBLE:** Una vez que el correo sale del servidor hacia la bandeja del destinatario, no puede ser retirado ni revocado.

---

### Camino 4: Envío de SMS (Recordatorios)

#### 4A. Cita Everest (`apiAccesoAsignarTurno` -> `APIAcceso/api/SMS/EnviarSMS`, L11190)
1. **Destinatario:** `celularSms` (visualmente verificado y corregible en el modal) y `AgendaTurnoId=turnoId`.
2. **Ventana temporal:** Se dispara síncronamente al recibir `creada === true` de `AsignarTurno`.
3. **Falla cerrada:** `if (creada && S.smsRecordatorio && cel.length >= 7)`. Si falta radicado o el teléfono tiene < 7 dígitos, no se envía.
4. **Idempotencia:** Disparo directo con `window.fetch` sin reintentos automáticos para evitar duplicados.
5. **Kill-switch:** Protegido indirectamente (la función padre `apiAccesoAsignarTurno` aborta si `state.killed`).
6. **Reversibilidad:** **IRREVERSIBLE.**

#### 4B. Laboratorio AppCita (`apiLaboratorioAgendarAuto` -> `EnviarMensajeTextoLaboratorio`, L10588)
1. **Destinatario:** `telParam` (`celular` del modal o "0") y `codigoCita=radicado`.
2. **Ventana temporal:** Se dispara tras confirmación HTTP 200 con `error:false` y `radicado` de `AgendarCita`.
3. **Falla cerrada:** `if (celular && radicado)` -> Si no hay celular, no envía SMS.
4. **Idempotencia:** Protegido por el flujo de reserva de cita única.
5. **Kill-switch:** **NO respeta `state.killed`:** `apiLaboratorioAgendarAuto` (L10484) no contiene guarda `if (state.killed)`.
6. **Reversibilidad:** **IRREVERSIBLE.**

---

### Camino 5: `apiDigiturnoFinalizarTicket` (L10605)

1. **Destinatario:** `citaId` codificado en base64 (`EverestId=${btoa(citaId)}`) y `UsuarioId=${uId}`.
2. **Ventana temporal:** N/A (Función huérfana en producción).
3. **Falla cerrada:** `if (!citaId) return;`.
4. **Idempotencia:** No garantizada si se llamara repetidamente.
5. **Kill-switch:** **NO respeta `state.killed`.**
6. **Reversibilidad:** Modificaría el estado del ticket en sala de espera a "Finalizado".
7. **Riesgo:** Código muerto que accede a endpoint de mutación. Medido en detalle en `docs/cambios-pendientes/001-medicion-digiturno-finalizar-ticket.md`.

---

### Camino 6: `injectLabsIntoCronicos` (L2503)

1. **Identidad del destinatario:**
   - Destinatario: `docIdEsperado` pasado explícitamente desde el disparador de Auto-Labs.
   - Guarda de Identidad: `if (!_pacienteSigueAbierto(docIdEsperado))` en:
     1. Entrada principal de la función (L2517).
     2. Reintento de componentes de orina a 300 ms y 900 ms (L2784).
     3. Reintento de resultado de uroanálisis a 300 ms (L2812).
2. **Ventana temporal:**
   - Inyección principal: 0–5 ms síncrona sobre el DOM.
   - Reintentos diferidos: 300 ms y 900 ms tras marcar "SI" en Uroanálisis para dar tiempo al `*ngIf` de Angular.
3. **Comportamiento ante lo indeterminable:**
   - Falla cerrada absoluta: Si el `docId` en el DOM no coincide exactamente con `docIdEsperado` o no se puede leer del DOM, aborta de inmediato con aviso en consola sin tocar ninguna casilla.
   - Casilla sagrada del médico: Valores existentes distintos a los de Athenea no se sobrescriben (`respetadas++`).
   - Validación de rango oficial: Valores que violan los rangos biológicos plausibles de la IPS se descartan (`_objecionOficialAlValor`).
4. **Idempotencia:** Totalmente idempotente. No reescribe valores idénticos ni borra correcciones del médico tras agotar el cupo de guardia.
5. **Kill-switch:** SÍ respeta `state.killed` (L2504) y `state.disabledFeatures.has("autoLabs")` (L2507).
6. **Cobertura del fallo:** Extensamente probada en Suite 08, Suite 30, Suite 31, Suite 32 y Suite 34.
7. **Reversibilidad:** Reversible antes de que el médico guarde la historia en Everest.

---

### Camino 7: `createExamenFisicoInjectorUI` (L3813)

1. **Identidad del destinatario:**
   - Destinatario: Formulario de Examen Físico visible en pantalla.
   - Ejecución: 100% síncrona en el manejador `onclick` del botón `#vgl-examen-normalidad`.
2. **Ventana temporal:** 0 ms (sin `await`, sin `setTimeout`, sin peticiones de red).
3. **Comportamiento ante lo indeterminable:**
   - Falla cerrada: Solo escribe en casillas cuyo valor actual sea estrictamente vacío (`actual === ""`). No sobrescribe casillas con texto. Advierte si hay desajuste en el conteo total de casillas.
4. **Idempotencia:** Idempotente: un segundo clic detecta que todas las casillas están llenas y aborta con alerta sin modificar nada.
5. **Kill-switch:** **NO respeta `state.killed`** (L3822).
6. **Cobertura del fallo:** Cubierto en Suite 06 y Suite 15.
7. **Reversibilidad:** Reversible: el médico puede borrar o modificar cualquier texto antes de guardar.

---

### Camino 8: `_conductaBuscarYAgregarExamen` (L1239)

1. **Identidad del destinatario:** Pestaña de Conducta de Everest en el DOM.
2. **Ventana temporal:** 700 ms entre el clic en el `<li>` y el clic en el botón `AGREGAR` (`await new Promise((r) => setTimeout(r, 700))`).
3. **Comportamiento ante lo indeterminable:**
   - Falla cerrada: Coincidencia EXACTA de texto canonizado (`_canonTexto(el.textContent) === claveObjetivo`), nunca por substring. Si no encuentra el `<li>` o el botón `AGREGAR`, devuelve `false` sin lanzar excepciones.
4. **Idempotencia:** Dependiente del DOM de Everest.
5. **Kill-switch:** **NO respeta `state.killed`** (L1239).
6. **Estado de Producción:** Función huérfana (sin llamadores en el userscript; cubierta en tests).
7. **Reversibilidad:** Reversible eliminando el examen agregado en la tabla de Conducta.
