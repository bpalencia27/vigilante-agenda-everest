# Viabilidad de unificar las órdenes PYM en una sola orden de Everest

Fecha: 2026-09-07 · Alcance: análisis técnico, sin cambios de código.
Fuente: código verificado de `vigilante_agenda.user.js` (rama `claude/pym-agenda-blindaje-v12-4`).
Regla de evidencia del proyecto: orden real guardada > captura de red > catálogo de otro repo. Aquí NO se inventa ningún contrato nuevo.

## 1. Cómo funciona hoy el módulo «Ordenar» (evidencia en código)

| Paso | Llamada real | Ubicación |
|---|---|---|
| Resolver paciente | `GET /apiviva/APIOrdenamientoHealth/api/Paciente/BuscarPaciente?Identificacion&TipoDocumento=CC&epsId=2` | L30706 |
| Resolver CIE-10 → `DiagnosticoId` | `GET /apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoDiagnostico?filter=<cie10>` | L30720 |
| Resolver CUPS → `{Id, Codigo, Descripcion, Nivel}` | `GET /apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoCupsPorPaciente?pacienteId&filter=<cup>` | L30740 |
| Crear la orden | `POST /apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento` | L30780 |
| Imprimir | `GET /apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos?PacienteId&Agrupador` → `GET /apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=&idPaciente=` | L30866, L30965 |
| Enviar por correo | `GET /apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento?Grupo=<agrupador>&Correo&UsuarioId` | L30913 |

El lote (L31432-31495) recorre **un paquete por CIE-10** (VIH, citología, colon…) y por cada uno llama una vez a `GuardarOrdenamiento`. Cada llamada devuelve su propio `agrupador` y un array `ordenAuth` con **un `numeroAutorizacion` por CUPS**:

```json
{"agrupador":"1226083892","ordenAuth":[{"numeroAutorizacion":"1226083892319"}]}
```

Conclusión observada: hoy salen **N órdenes (= N agrupadores = N PDFs) cuando se piden N paquetes**.

## 2. Lo que el contrato verificado YA permite y lo que NO

- **Varios CUPS en una orden: SÍ.** `ordenes: cupsList.map(...)` envía un array (L30789). Este es exactamente el agrupamiento que ya existe.
- **Varios CIE-10 en una orden: NO CONSTA.** El payload verificado byte a byte contra el módulo nativo (v12.3.0, captura del consultorio 10-ago-2026) lleva **UN solo campo `DiagnosticoId`** por llamada. No hay ninguna captura de una variante con array de diagnósticos.
- **Impresión/correo: por UN agrupador.** `GenerarOrdenHC?Agrupador=` y `EnviarEmailOrdenamiento?Grupo=` reciben un solo identificador. Aunque se lograra una sola orden, el PDF saldría de un único agrupador — coherente: una orden = un agrupador = un comprobante.
- **Existe OTRO contrato distinto documentado** (L30768-30770): el ordenamiento desde la *Ruta de Crónicos* usa otro cuerpo (camelCase, objeto completo del paciente, `citaId` real y `swHc:true`). Alinear `apiOrdenamientoGuardar` con aquel rompería lo que hoy funciona, pero **es la segunda pista** de que Everest tiene más de una forma de guardar ordenes — y ninguna de las dos está capturada con multi-diagnóstico.

## 3. Veredicto de viabilidad

| Escenario | Viabilidad | Condición |
|---|---|---|
| A. Un CUPS-variados → una orden (ya soportado) | ✅ Hecho | Es el comportamiento actual por paquete |
| B. N CIE-10 + sus CUPS → UNA orden (un agrupador) | ⚠️ No verificable hoy | Requiere captura nueva del gesto nativo |
| C. N órdenes → una sola IMPRESIÓN consolidada | ✅ Implementable hoy | Encadenar `GenerarOrdenHC` por agrupador en una pestaña/impresión |
| D. «Paraguas» CIE-10 genérico + todos los CUPS | ❌ Rechazado | Clínicamente incorrecto: la trazabilidad y las autorizaciones exigen el diagnóstico propio de cada actividad |

## 4. Requisitos y pasos para el escenario B (la unificación real)

1. **Captura en consultorio** (guía `CAPTURAR_MENSAJES.md`): en el módulo nativo de Everest (Nueva orden), agregar **dos o más CIE-10 a la misma orden** y grabar el `POST GuardarOrdenamiento` resultante. Dos desenlaces posibles:
   - El payload trae `DiagnosticoId` repetido o un array → se implementa tal cual (extender `apiOrdenamientoGuardar` o crear `apiOrdenamientoGuardarUnica` gemela, NUNCA pisar la que funciona).
   - La UI nativa no lo permite → la limitación es de la plataforma, no del script: se documenta y se cierra el caso.
2. **Antiduplicado**: `markOrdenesCreadasHoy` (L31485) está keyado por (paciente, agrupador, actividades, CIE-10). Con una sola orden hay un solo agrupador: hay que re-keyar la marca para que un lote parcialmente unificado no se proponga dos veces (regresión real ya ocurrida, v16.7.0 auditoría #10).
3. **Reintento parcial**: hoy un fallo intermedio deja creadas K de N. Con orden única el fallo es atómico (se crea o no) — más seguro, pero exige que el botón «Reintentar» no reenvíe todo el lote si ya hay agrupador.
4. **Impresión y correo**: con un solo agrupador, un solo botón y un solo PDF — simplificación neta (hoy hay un botón por paquete, rotulado desde v17.6.76).
5. **Pruebas**: casos hermanos en la suite de ordenar (patrón suite_15/62) + fila en `tests/INFORME_MUTACIONES.md` por cada aserción nueva, mutando el payload unificado.
6. **Despliegue gradual**: mantener el lote por paquetes como respaldo behind la telemetría (`uxTrack("orden.unica")` vs `orden.lote`) durante la primera semana en consultorio.

## 5. Limitaciones y riesgos

- **Sin captura no hay implementación**: inventar el campo `diagnosticos[]` viola la regla «casilla vacía antes que dato inventado» y ya costó un código CUPS equivocado en producción (caso documentado en AGENTS.md).
- **RIPS/facturación**: aunque Everest aceptara multi-diagnóstico, la IPS puede exigir un diagnóstico por actividad para autorización; el visto bueno del área de facturación es requisito previo.
- **La ventana de autorizaciones cambia**: `ordenAuth` devuelve una autorización por CUPS; en una orden única habría que verificar que Everest sigue devolviendo todas.

## 6. Recomendación

Implementar **ya** el escenario C (impresión consolidada de los agrupadores que el lote fue creando — cero riesgo clínico, elimina la fricción de N botones), y dejar el escenario B **bloqueado tras la captura** del punto 4.1. Si la captura confirma el contrato, el cambio de código es pequeño (una función gemela + re-key del antidup); el riesgo está todo en el payload, no en la plomería.
