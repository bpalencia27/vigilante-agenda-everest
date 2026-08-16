# Orden de Cambio / Medición de Riesgo: Retiro de `apiDigiturnoFinalizarTicket`

> **Clasificación:** Vía C (Orden de cambio para retiro de código muerto en el Tronco)  
> **Ubicación en producción:** `vigilante_agenda.user.js` (L10604–10611)  
> **Estado:** Huérfana inerte (0 invocaciones en producción)  
> **Severidad de Riesgo:** Media-Baja (Inerte hoy, pero endpoint de mutación expuesto)

---

## 1. Análisis del Endpoint y Consecuencia de Dominio

### ¿Qué hace `FinalizarTicket` exactamente?
La función despacha una petición HTTP GET contra el backend de integración de Digiturno de Everest:
```
GET /apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket?tipoIntegracion=IntegracionDigiturno&TicketId=0&UsuarioId=${uId}&EverestId=${encodeURIComponent(b64Cita)}
```
- **Consecuencia en el sistema:** En la infraestructura de la IPS, el software Digiturno gestiona el llamado de pacientes a consultorios en salas de espera y pantallas de televisión. El endpoint `FinalizarTicket` marca la atención del turno como terminada, dando de baja el ticket en el llamado de Digiturno.
- **Riesgo Clínico/Administrativo si se dispara por error:**
  1. Si se invoca mientras el paciente aún está esperando atención, su ticket desaparecerá de la lista de espera del Digiturno y no será llamado por el médico o por enfermería.
  2. Si se invoca sobre una cita errónea, alterará las métricas de oportunidad y tiempos de espera de la IPS.

---

## 2. Medición de Proximidad a la Vida

- **¿Cuántas ediciones lo separan de estar vivo?**
  Exactamente **1 sola edición** (una línea en un hook de fin de consulta como `diaNuevo()` o al guardar la historia clínica).
- **¿Está expuesto a autocompletado o enganches por agentes?**
  **SÍ.** La función está declarada con nombre canónico `apiDigiturnoFinalizarTicket` dentro del bloque de interfaces API (`// Interfaz API: Finalizar Ticket Digiturno al terminar atención`). Cualquier agente de código que busque endpoints para "finalizar atención" o "cerrar cita" podría encontrarla en un grep/AST y enlazarla a un flujo activo creyendo que es una función oficial activa y testeada.
- **¿Respeta el Kill-Switch?**
  **NO.** La función carece por completo de la guarda `if (state.killed) return;`. Si un desarrollador o agente la enganchara, ignoraría la pausa de seguridad remota.

---

## 3. Pruebas Existentes que la Nombran

Actualmente está referenciada en:
1. `tests/suite_13_api_agenda.js` (L591–618)
2. `tests/suite_34_cobertura_alto_riesgo_mutantes.js` (L522–558)
3. `tools/inventario.js` (L46, L111)

Las pruebas verifican que:
- Codifica `citaId` en base64 como `EverestId`.
- No lanza excepción si falla la red (`try/catch`).
- Tolera `citaId` nulo o cero.

---

## 4. Diff Propuesto para el Tronco (No Aplicar en esta Rama)

```diff
--- a/vigilante_agenda.user.js
+++ b/vigilante_agenda.user.js
@@ -10604,8 +10604,0 @@
-  // Interfaz API: Finalizar Ticket Digiturno al terminar atención
-  async function apiDigiturnoFinalizarTicket(citaId) {
-    if (!citaId) return;
-    const uId = state.activeDoctor.id || S.medicoId || 0;
-    const b64Cita = btoa(String(citaId));
-    const path = `/apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket?tipoIntegracion=IntegracionDigiturno&TicketId=0&UsuarioId=${uId}&EverestId=${encodeURIComponent(b64Cita)}`;
-    try { await pageFetchJson(path); } catch (e) {}
-  }
```

*Nota para S2/Tronco:* Al retirar la función en el tronco, se deben retirar simultáneamente las pruebas asociadas en `suite_13_api_agenda.js` y `suite_34_cobertura_alto_riesgo_mutantes.js` para mantener el banco en verde.
