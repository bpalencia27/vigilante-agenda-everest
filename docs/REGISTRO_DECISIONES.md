# REGISTRO DE DECISIONES — Vigilante de Agenda (Centinela)

Archivo creciente nacido del protocolo de entrevista `/grill-me` (§E.3).
Formato: **fecha · fase · pregunta corta · decisión · default aplicado si no hubo
respuesta · commit donde se materializó.** Las filas nunca se editan ni se borran;
una corrección es una fila nueva.

| Fecha | Fase | Pregunta corta | Decisión | Default aplicado | Commit |
|---|---|---|---|---|---|
| 2026-09-07 | Auditoría base SEPTIEMBRE1 | ¿Cómo alimentar el panel con la base nueva? | **Opción B**: hoja «citas dia regional» + PROCEX con traductor «Aplica Cobertura/Fenix VPH/CCU» → pendiente (recupera chips cérviz/mama/PSA/SOMF) | — (respondida en vivo) | pendiente (v18.6.0 sin commitear) |
| 2026-09-07 | Índice | ¿Filtrar filas de la regional por Fecha_Cita=hoy? | **Todas las filas** (tolerante a hojas publicadas tarde; riesgo aceptado: estado viejo puede mostrar un chip ya resuelto si el paciente vuelve ese mes) | Todas las filas (era la recomendada) | pendiente (v18.6.0) |
| 2026-09-07 | Refresco | ¿Frecuencia del refresco? | Primero pidió «6 am»; corrigió a **06:00 Y 12:00** (UTC-5 Bogotá) | — (corregida en vivo) | pendiente (v18.6.0) |
| 2026-09-07 | Mantenimiento | ¿Requisitos de fiabilidad? | Exigió: autosuficiencia (reintentos+recuperación sin humano), log detallado, integridad post-actualización, rollback automático, monitoreo con alerta temprana, limpieza de registros — implementados en v18.6.0 (`vgl_base_log`, guardas, aplicar→guardar, métricas al tablero, anillo FIFO) | — | pendiente (v18.6.0) |
| 2026-09-07 | Entrega | ¿Commitear/publicar gist? | **NO commitear aún** — el médico no lo ha ordenado; el árbol queda listo | No commitear | — |
| 2026-09-07 | Alcance | ¿Las 3 fallas preexistentes (suites 79/82/87)? | **No tocarlas**: probadas preexistentes con `git stash` (trabajo v18.5.2 en curso de la otra sesión); se documentan, no se corrigen aquí | No tocar | — |

## Supuestos activos (pendientes de confirmación del propietario)

- **Ninguno bloqueante** en v18.6.0: las tres preguntas de diseño fueron respondidas en vivo.
- Menor, documentado en la auditoría (H6): el riesgo de chip obsoleto por filas multi-día
  se aceptó con la decisión «todas las filas»; si en consultorio se ve un chip ya resuelto,
  la revisión es: ¿actualizaron la fila del paciente en el libro? ¿pedir filtro por
  `Fecha_Cita` máxima por documento?
| 2026-09-07 | Entrega | ¿Commitear/publicar v18.6.0? | **SÍ, ordenado y ejecutado**: commit `309f984` en `claude/sf-simulacion-flujos` (+push) y Gist `d231aab6f54de51a5c472b392aac1b91` (gistfile1.txt) verificado **byte a byte** — SHA-256 `b8cf6406acef5d63a51a27aaabbf72e39d580a30604b64e919b9640269203dfa` local ≡ remoto, `@version 18.6.0`. Banco 3542/3542 (97 suites). Corrige la fila anterior «no commitear» | — | `309f984` |
