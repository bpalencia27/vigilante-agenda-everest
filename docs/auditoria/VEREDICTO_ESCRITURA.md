# Veredicto de Auditoría Adversarial de Escritura Clínica

> **Órgano Auditor:** Juez de Integridad y Blindaje Clínico  
> **Repositorio:** `vigilante-agenda-everest`  
> **Línea Base:** Commit `da4e747eb1824f5ddc65c9cff117c703d773d362`  
> **Userscript Hash:** `b7517b11db69bacf2a580fba074c37d995c8c0d6727474fb32133f2c9f5f0a72`  
> **Fecha:** 15-ago-2026

---

## 1. El Fallo del Juez (Evaluación de Reglas Estrictas)

```
1. ¿Algún hallazgo sobrevivió a los dos refutadores CON guion concreto y prueba roja que falla?
   → SÍ: DOS (2) HALLAZGOS CONFIRMADOS sobre omisión de Kill-Switch en vías de escritura externas:
     - Hallazgo Rojo 001: apiEnviarOrdenPorCorreo elude state.killed (tests/rojas/001-killswitch-correo-ordenes.js)
     - Hallazgo Rojo 002: apiLaboratorioAgendarAuto y SMS eluden state.killed (tests/rojas/002-killswitch-agendar-laboratorio-sms.js)
     - Medición S5: apiDigiturnoFinalizarTicket es código muerto que muta y no verifica kill-switch.

2. ¿Se tocó vigilante_agenda.user.js?
   → NO (CUMPLIDO). Diff contra la base sale estrictamente VACÍO.

3. ¿Algún entregable trae datos de pacientes (PHI)?
   → NO (CUMPLIDO). Cero datos reales; fixtures 100% sintéticos.

4. ¿Alguna prueba roja pasa sin tocar código?
   → NO (CUMPLIDO). Ambas pruebas rojas fallan con código de salida 1 en el código de producción actual.

5. ¿Auditoría exhaustiva sobre los 8 caminos?
   → SÍ (CUMPLIDO). Los 8 caminos fueron cartografiados, sometidos a guiones de ataque y refutados/confirmados con evidencia.
```

---

## 2. Demostración y Evidencia Verbatim de las Compuertas

### Compuerta 1: `vigilante_agenda.user.js` NO fue modificado
```bash
git diff --name-only da4e747eb1824f5ddc65c9cff117c703d773d362 HEAD -- vigilante_agenda.user.js
# SALIDA: [VACÍO]
```

### Compuerta 2: Ejecución de Pruebas Rojas (Ambas Fallan en Producción Actual)
```bash
node tests/rojas/001-killswitch-correo-ordenes.js
# Salida: FAIL: apiEnviarOrdenPorCorreo disparó petición HTTP con el Kill-Switch activo. (exit code 1)

node tests/rojas/002-killswitch-agendar-laboratorio-sms.js
# Salida: FAIL: apiLaboratorioAgendarAuto disparó petición (https://appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/AgendarCita?...) con el Kill-Switch activo. (exit code 1)
```

### Compuerta 3: La Suite Principal Permanece Intacta
```bash
node tests/runner.js
# Salida: 1401 comprobaciones pasan en verde (0 regresiones introducidas).
```

---

## 3. Resumen de Conclusiones Clínicas

1. **La guarda `_pacienteSigueAbierto` está donde debe estar:**
   - Protege exclusivamente a `injectLabsIntoCronicos` porque es la única función que sufre una ventana asíncrona de red (2–4s) escribiendo en casillas DOM anónimas sin ID de paciente.
   - Las APIs de agendamiento de citas (`apiAccesoAsignarTurno`) y ordenamiento de CUPS (`apiOrdenamientoGuardar`) son seguras frente a conmutaciones de paciente porque transportan el identificador `pacienteId` explícito e inmutable en el payload HTTP.
   - El inyector de examen físico (`createExamenFisicoInjectorUI`) es 100% síncrono (0 ms de ventana) y opera sobre la vista interactiva visible.

2. **Acciones Requeridas para el Tronco:**
   - **Prioridad 1:** Añadir `if (state.killed) return false;` al inicio de `apiEnviarOrdenPorCorreo` y `apiLaboratorioAgendarAuto`.
   - **Prioridad 2:** Retirar el código muerto `apiDigiturnoFinalizarTicket` y sus pruebas huérfanas en S2/Tronco según `docs/cambios-pendientes/001-medicion-digiturno-finalizar-ticket.md`.
