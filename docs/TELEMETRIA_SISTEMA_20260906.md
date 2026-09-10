# Sistema de telemetría v18.4 — arquitectura, guía del tablero e informe de pruebas

Cierre del encargo "telemetría robusta y escalable" (06-sep-2026). Este documento NO
rediseña el sistema: audita el que ya existía, cierra las brechas reales que dejó el
export del tablero del 1-sep ([TELEMETRIA_20260901.md](TELEMETRIA_20260901.md)) y
declara con nombre lo que NO se hizo y por qué.

## 0. Alcance decidido con el médico (decisiones)

| Pedido original | Decisión | Motivo |
|---|---|---|
| Reconstruir "estilo Google/Meta" | **No**: consolidar lo existente | El sistema ya cubre captura multidimensional, lotes, saneo, opt-out. Reconstruir rompería suites 23/70/83 en producción clínica |
| Almacén/lago 2 años < 10 s | **Fuera de alcance** | Un userscript + Apps Script no es un data lake; exige infra de nube, credenciales y presupuesto que la IPS no tiene en este repo |
| Modelos predictivos / RCA automático | **Sustituido por z-score** | Umbral dinámico estadístico sí; ML predictivo no tiene volumen (11 equipos) ni infra para entrenarse |
| Canal de errores muerto (v17.2.0) | **Ya arreglado en v18.0.66** | Verificado en código y suite_23; esta tarea añade la detección automática del próximo silencio |

## 1. Arquitectura del pipeline (estado v18.4)

    [navegador — vigilante_agenda.user.js, archivo único]
      captura        uxTrack (uso/RUM/embudos) · reportarError (stack+huella+migas)
                    · api.* (latencia .ok/.err/.total) · entorno/acceso (1/día)
      saneo          uxClaveLimpia / _sanearMensajeError: cero PHI, cero cédulas
      buffer         _uxBuf en memoria (tandas 2 s) → ventana 30 min en localStorage
      cola           repQ (GM_setValue, tope 80, orden de sacrificio ux→entorno→resto)
      transporte     repPost (GM_xmlhttpRequest, acuse real "ok/dup/no/err")
                    · repBeacon (sendBeacon/keepalive, solo reconstruible o último recurso)
      ↓ text/plain (sin preflight)
    [servidor — TABLERO/Codigo.gs, Apps Script]
      doPost         dedup por lote (CacheService 6 h) · re-saneo (el servidor no
                    confía en el emisor) · hojas: uso/uso_detalle/error/fraude/
                    entorno/acceso/acceso_uid/resumen/prueba + alertas (nueva)
      agregación     armarResumen (flota) · revisarAlertas (nueva, §3)
    [consumo]        la Hoja del tablero (dueño) · alertas automáticas diarias

### Cambios de esta versión (v18.4)

1. **Carril prioritario** (`reportar` + `repFlush`). La evidencia (`error`, `fraude`)
   sale PRIMERA en cada ciclo de la cola y no espera el backoff de 3 min: en el
   incidente del 27-ago su demora era el temporizador completo (10 min). Autolimitado:
   si el último intento del carril falló, se calla 60 s — no reintroduce la tormenta
   de red que el backoff de v17.6.14 cerró, y los 3 intentos antes de descartar
   siguen espaciados como se diseñó en v18.0.66.
2. **Muestreo por prioridad** (`uxEnviarVentana`). Al desbordar el presupuesto de
   3.800 caracteres de la fila `ux`, el sacrificio es por CLASE, no por orden de
   llegada: primero `rum.*`/`api.*` (volumen alto, agregable), después el uso
   funcional, y `error.*`/`rep.*` solo si no queda otra. Un día de 18.414 llamadas
   de API ya no desplaza del envío los conteos de fallo.
3. **Beacon de último recurso** (`repFlush`). Fila descartada tras 3 rechazos: un
   intento único por beacon (sin acuse, pero sin reintento — la objeción D4 de
   v17.49.0 era el reintento) + contadores `rep.descarte.beacon` /
   `rep.fila.descartada.*` para que la pérdida se VEA.
4. **Alertas del tablero** (Codigo.gs, §3): la mitad del porqué el canal mudo duró
   medio año es que nadie miraba; ahora la hoja se mira sola.

**Sobrecarga**: sin cambios en el camino caliente (uxTrack sigue siendo un contador
en memoria). Las piezas nuevas corren 1 vez por envío de ventana (30 min) o por
evento crítico acotado de nacimiento (40+20/día). Medición previa del proyecto:
36 ms de hilo principal por minuto (0,06 %) con el script completo y 21 tarjetas
(v17.1.0 #149) — muy por debajo del 3 % exigido.

**Privacidad**: sin cambios de superficie — sigue siendo regla de oro "ningún dato
de paciente sale del navegador" (REGLAS DE ORO n.º 3, probada por suites 23/31/44).
Las alertas solo leen conteos ya saneados (`error.js`, `error.entregado`,
`api.*.err`) e identificadores de equipo aleatorios. GDPR/HIPAA: el principio
operativo es minimización (cero PHI capturado), documentado en
TERMINOS_Y_AVISO_DE_PRIVACIDAD.md; no se añadió ningún dato nuevo al flujo.

## 2. Guía de uso — tablero y alertas (para el dueño de la Hoja)

Despliegue (UNA vez): reemplazar `Codigo.gs` → Implementar → Nueva versión.

Menú **Vigilante** (nuevo):
- **Revisar alertas ahora** — corre `revisarAlertas()`: recalcula y escribe en la
  hoja `alertas` lo que falte (dedup por día+equipo+tipo; repetirlo no duplica).
- **Instalar revisión diaria de alertas (23:30)** — crea el trigger temporal
  idempotente. **Quitar revisión diaria** lo elimina.

Hoja `alertas` — columnas: `recibido · dia · equipo · tipo · severidad · detalle`.

| tipo | severidad | significado | qué hacer |
|---|---|---|---|
| `canal-mudo` | alta | ≥5 errores detectados y 0 entregados ese día | actualizar ese equipo YA: su canal de errores está roto (fue el defecto v17.2.0) |
| `tormenta` | alta | ≥15 huellas de error distintas en un día | mirar la hoja `error` de ese equipo/día |
| `anomalia` | media | z ≥ 3 del día contra su media de 7 días | correlacionar con despliegues de ese día |
| `api-degradada` | media | endpoint con ≥20 fallos y ≥50 % de error | ¿Everest caído? ver `uso_detalle` `api.*.err.total` |

Umbrales (constantes `ALERTA_*` en Codigo.gs), calibrados contra los incidentes
reales del export: 5/15/3/20. Ajustarlos es editar la constante y volver a desplegar.

Lecturas que ya existían y siguen siendo la base diaria: «Actualizar resumen de
flota» (armarResumen), embudos por módulo en `uso_detalle`, RUM del API
(latencia/tasa por endpoint), versiones de la flota (§2 de TELEMETRIA_20260901.md).

## 3. Informe de pruebas

- **Suite nueva** `tests/suite_87_telemetria_v18_4.js` — 6 casos, todos verdes:
  orden del carril, salto de backoff, throttle tras fallo, muestreo por prioridad
  (90 claves api.* que desbordan el presupuesto), regresión de ventana chica,
  beacon de último recurso con espía de sendBeacon.
- **Simulador** `TABLERO/simulacion_local.js` (evalúa el Codigo.gs REAL):
  equipo enfermo dispara canal-mudo (33, no 66: dedup por lote), tormenta y
  api-degradada; equipo con historia tranquila + salto dispara SOLO z-score
  (z=17,3); equipo sano no dispara nada; re-ejecutar no duplica. Exit 0.
- **Mutaciones**: 8 aplicadas, 8 cazadas (ninguna sobrevivió), todas restauradas —
  tabla nueva al final de `tests/INFORME_MUTACIONES.md`.
- **Banco completo** `node tests/runner.js`: 3.412 comprobaciones. Al cierre de esta
  tarea quedan 3 fallos NINGUNO de este cambio (ver "Hallazgos NO tocados").
- **Tasa de pérdida**: diseño por capas — cola persistente (GM) sobrevive recargas
  y cortes; sacrificio por clases; descarte solo tras 3 rechazos con beacon final;
  todo descarte queda contado (`rep.fila.descartada.*`). El <0,1 % pedido no es
  medible con la flota actual (11 equipos); el diseño garantiza que la PÉRDIDA
  SIEMPRE ES VISIBLE (contador + alerta canal-mudo), que es la propiedad que
  importa en un sistema clínico.

## 4. Hallazgos NO tocados (de otros trabajos en curso en el repo)

1. `tests/suite_06` — «avisos tratan al médico de usted»: falla por textos de otra
   tarea en curso, no de telemetría.
2. `tests/suite_75` — «versión viva: esperaba 18.3.5 y obtuvo 18.4.1»: versión
   hardcodeada en la prueba, desactualizada por los bumps concurrentes.
3. `C:\WINDOWS\system32\git` — un ARCHIVO (no git.exe) sombrea el git real en PATH;
   hay que invocar `"C:\Program Files\Git\cmd\git.exe"` a mano. Debería borrarse.
4. Escrituras paralelas: durante esta tarea otro agente guardó el userscript desde
   instantáneas con mutaciones transitorias y las resucitó (documentado en
   INFORME_MUTACIONES.md). Recomendación: no correr mutaciones mientras otra tarea
   escribe el mismo archivo.
