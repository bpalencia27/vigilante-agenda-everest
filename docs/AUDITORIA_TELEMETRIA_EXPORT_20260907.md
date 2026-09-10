# Auditoría del sistema de telemetría — export `REPORTE-VIGILANTE (2).xlsx` (07-sep-2026)

Auditoría completa sobre el export real del tablero (rama `claude/v14-continuacion`),
18.489 filas de `uso`, 86.183 de `uso_detalle`, 12 hojas. Todo lo que sigue sale de
contar el archivo con deduplicación por `lote`; nada es suposición. **Cero PHI** en
el análisis (barrera verificada, §F).

## Veredicto por requisito

| Requisito | Estado | Evidencia clave |
|---|---|---|
| **Captura** | ✅ OPERATIVO | Flujos vivos hasta el 07-sep: uso/RUM/embudos/api/fraude/entorno/acceso. 87 equipos, 12 días de jornada (11-ago → 07-sep), versiones 12.5→18.3.6 |
| **Transmisión — latencia** | ✅ DENTRO DE UMBRAL (actual) | Ventana 04-07 sep: `perfilusuario` 214 ms ok · `buscarpaciente` 1.286 ms ok · `resultadoslabannar` 44 ms · **0 errores de API**. El histórico >15 s (ver §3) es de versiones sin timeout |
| **Transmisión — integridad de acuse** | ✅ | `rep.fila.descartada.*`=0 y `rep.descarte.beacon`=0: ninguna fila llegó al límite de 3 rechazos |
| **Almacenamiento** | ⚠️ 3 defectos HEREDADOS activos en el histórico | §1 duplicación, §2 desalineación, §4 versión-corrupta. Los tres tienen reparación en el repo, sin ejecutar en producción |
| **Procesamiento** | ⚠️ Inflado por duplicados | `armarResumen` suma `uso.n` por fila SIN dedup por lote → acumulados de flota inflados ~2,2× (§1) |
| **Pérdida de información** | ✅ Sin evidencia de pérdida | 0 descartes, 0 `_recortadas` (el presupuesto de 3.800 chars nunca se agotó en la flota real). El problema histórico fue DUPLICACIÓN, no pérdida |
| **Barrera PHI** | ✅ LIMPIO | 0 tiras de 6+ dígitos en 86.183 filas de `msg/donde/migas/hora/accion` |
| **Visualización / monitoreo** | ⚠️ Parcial | `resumen_flota` presente (164 filas); hoja `alertas` AUSENTE — el export es anterior al despliegue v18.4 |

**Estado global: OPERATIVO, con 2 incidencias heredadas sin reparar en la Hoja y 1
indeterminación vigilada (canal de errores post-fix).**

## 1. Duplicación masiva por reenvío (el hallazgo mayor)

18.489 filas de `uso` → solo **8.447 lotes únicos**: 10.042 copias extra (54 %).

    copias/lote: 1×=6.396 · 2×=2.038 · y 14 lotes extremos: 19, 34, 86, 101,
    600, 858, 918, 954, 1.151, 1.286 y …2.003 copias del MISMO lote

Un lote entregado **2.003 veces** no es una carrera: es una fila envenenada
reintentándose cada 10 min durante ~2 semanas contra un servidor que la escribía
y aun así respondía «err» (fallo post-escritura: cuota/contención al escribir
`uso_detalle`). Es exactamente la clase de defecto que el blindaje 2 de v18.0.66
(tope de 3 intentos → descartar) cierra, y las versiones afectadas son todas
< 18.0.66. El grueso (2.038 lotes ×2) es la clase documentada: respuesta perdida
+ `CacheService` (best-effort, evicta bajo carga) que olvidó el lote.

**Impacto**: todo conteo por-fila queda inflado ~2,2× — incluido el
«Acciones de uso (ux, acum.)» del tablero de flota.

**Recomendaciones**:
1. Ejecutar el menú «Limpiar filas duplicadas» (existe, conserva la primera).
2. `armarResumen` (TABLERO/Codigo.gs): deduplicar por `lote` antes de sumar — hoy
   confía en que el servidor nunca repite, y el export demuestra lo contrario.
3. La dedup de las alertas v18.4 (`_alertasAgregar`) YA deduplica por lote — no
   requiere cambio.

## 2. Canal de errores — el silencio del 27-ago, confirmado y fechado

- `error.entregado` = **0 en todo el export** (contador que nace en v18.0.66).
- Regla canal-mudo sobre datos reales (≥5 detectados, 0 entregados, 0 filas en
  `error`): **2 pares equipo|día, ambos el 2026-08-27**, versiones 18.0.4 —
  `eq-nx58dp25sx` (57 detectados, 1 huella) y `eq-656muc9xe2` (16 detectados,
  1 huella). Coincide al día con el incidente documentado en
  [TELEMETRIA_20260901.md](TELEMETRIA_20260901.md) §1. **La alerta `canal-mudo`
  de v18.4 lo habría delatado el mismo 27 de agosto.**
- Ventana 04-07 sep: ningún equipo detecta errores (det=0) y ninguno entrega —
  con versiones ≥18.0.66 presentes (18.0.106, 18.0.137, 18.3.2, 18.3.6). El canal
  post-fix queda **INDETERMINADO** por falta de señal, no por fallo: no ha habido
  un error JS desde que el fix está en la flota. Vigilancia automática activa.

## 3. Latencia del API — histórico vs. actual

Histórico (dedup, todo el export): `perfilusuario` **154 s** de media en error,
`buscarpaciente` 60 s, `pacientedetallado` 59 s, `citasdisponibles` 25 s — llamadas
colgadas minutos, de versiones sin timeout. Ventana 04-07 sep (flota parcialmente
actualizada): **todo < 2,2 s y 0 errores**. El fix del timeout (v18.0.47, 15 s con
`AbortController`) cumple su función donde está instalado; el resto es la flota
atrasada, no la telemetría.

Casos marcados: `api.resultadoslabciti` 100 % fallos (404 documentado, cortacircuitos
v17.1.0 #150 — en la ventana reciente 1 sola llamada: el cortacircuitos funciona) y
`api.resultadoslab` 50 % (148 llamadas — etiqueta casi sin uso, vigilar).
`api.otro` (2.489 llamadas): endpoint sin etiquetar por `_rumEndpointLabel` —
recomendación: etiquetar los endpoints que faltan para no perder atribución.

## 4. Integridad de columnas (heredado, sigue visible en el export)

- **Desalineación** (bug v12.10.13): 8.017 de 18.489 filas de `uso` (43 %) tienen
  `acciones` no-JSON — filas escritas antes del arreglo por-nombre. Irrecuperables
  como fuente de agregación; el agregado correcto de ese período vive en
  `uso_detalle`.
- **Versión corrupta como fecha** (bug v12.10.11): ~30 % de valores de `ver`
  («17.6.2001» = 17.6.1, «12.6.2009» = 12.6.9…). El menú
  «Reparar columna 'ver' corrupta en fecha» existe y no se ha corrido (o el export
  se hizo antes de correrlo).
- **Truncamiento del export**: `error`, `fraude`, `entorno`, `resumen`, `prueba` y
  `acceso_uid` salen con EXACTAMENTE 1.000 filas (la hoja `error` solo llega al
  21-ago: el export cortó por las más viejas). Conclusión: la ausencia de versiones
  nuevas en `error` NO es concluyente por sí sola — lo concluyente es §2.
  Recomendación: exportar sin tope (Archivo → Descargar → .xlsx completo).

## 5. Embudos de adopción (dedup)

- Agendar: 168 aperturas, 184 creaciones (prefijo `cita.creada.*` incluye reimprontados)
- Ordenar: 120 aperturas → 55 órdenes (**46 % de abandono** — consistente con el
  hallazgo #19 ya arreglado en v18.0.63; vigilar que baje con la flota actualizada)
- IA: 160 generaciones

## 6. Acciones recomendadas (en orden)

1. **En la Hoja (dueño)**: correr «Limpiar filas duplicadas» → «Reparar columna
   'ver' corrupta» → «Reparar encabezados de telemetría» → «Actualizar resumen de
   flota»; desplegar el Codigo.gs v18.4 e instalar «Revisión diaria de alertas».
2. **En código (próximo cambio)**: ~~dedup por `lote` en `armarResumen`~~
   (**HECHO v18.4.6**, verificado en simulador) ~~etiquetar los endpoints que caen
   en `api.otro`~~ (**HECHO v18.4.6**: 5 endpoints reales etiquetados, suite_87);
   considerar que `_alertasAgregar` lea también `uso_detalle` (las filas de `uso`
   desalineadas viejas no aportan, aunque para la ventana de alertas de 8 días es
   irrelevante).
3. **Flota**: el 27-ago fue todo v18.0.4 — el problema de distribución (Gist)
   documentado en §2 de TELEMETRIA_20260901.md sigue siendo el mayor riesgo.
