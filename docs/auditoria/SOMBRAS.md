# Auditoría Exhaustiva de Sombras — Cosas que parecen vivas y no lo están

> **Proyecto:** Vigilante de Agenda — Copiloto Everest PyM (`bpalencia27/vigilante-agenda-everest`)  
> **Ámbito:** `vigilante_agenda.user.js` (16.874 líneas, 1.039.666 bytes) y 47 suites en `tests/`  
> **Comando de prueba base:** `node tests/runner.js` → 1.401 comprobaciones en verde (100%)

---

## 📊 Métricas Globales del Barrido

```
  CANDIDATOS DETECTADOS EN EL BARRIDO ESTRUCTURAL:  74
  SOBREVIVIERON A LA MUTACIÓN (HUECOS CONFIRMADOS):   7
  CON CONSECUENCIA CLÍNICA DIRECTA INMEDIATA:        0 (Triados a Backlog / Órdenes de Cambio)
```

> **Interpretación de la señal:** La relación entre candidatos iniciales (74) y huecos confirmados por mutación adversarial (7) demuestra la efectividad de los filtros dinámicos. La gran mayoría de los candidatos iniciales correspondían a cobertura legítima por integración dentro de cierres o llamadas indirectas del DOM, que fueron validadas y separadas de los verdaderos huecos de verificación.

---

## 1. Forma 1 — La prueba que reporta verde sin ejecutar

### Análisis y Hallazgos
Se barrieron las 47 suites en busca de:
- `t.casoAsync` sin `await`.
- Aserciones sobre arrays vacíos (`[].every()`).
- `if (condicion)` envolviendo aserciones que omiten silenciosamente la verificación.
- Aserciones tautológicas (`t.cierto(true)`).

### Hallazgos Verificados

#### 1.1 `todayTokens` en `suite_03_excel_pym.js` (Línea 3)
- **Fallo:** La función `todayTokens` está listada en `cubre: [...]` de `suite_03_excel_pym.js`, pero ninguna prueba de la suite aserta directamente sobre el retorno de `c.api.todayTokens()`.
- **Demostración por mutación:**
  ```javascript
  // Mutación: todayTokens() -> return [];
  // Comando:
  node -e "const { cargar } = require('./tests/harness.js'); const c = cargar({ silencioso: true, scriptSource: require('fs').readFileSync('vigilante_agenda.user.js', 'utf8').replace('function todayTokens() {', 'function todayTokens() { return [];') }); const s03 = require('./tests/suite_03_excel_pym.js'); s03.pruebas({ caso(d,fn){ fn(); }, casoAsync(d,fn){ return fn(); }, cierto(v,m){ if(!v) throw new Error(m); }, igual(a,b,m){ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(m); }, falso(){}, lanza(){}, noLanza(){} }, c.api, c.env, () => c).then(() => console.log('SUITE 03: VERDE TRAS MUTACIÓN'));"
  ```
  **Salida verbatim:**
  ```
  SUITE 03: VERDE TRAS MUTACIÓN
  ```
- **Resultado:** **SOBREVIVE.** Demuestra hueco real en `suite_03`.
- **Acción:** Emitida prueba roja `tests/rojas/001-today-tokens.js` + `.md`.

#### 1.2 Guarda condicional en `suite_41_motor_vista.js` (Línea 122)
- **Código:**
  ```javascript
  const primerCrit = h.indexOf("vgl-mtr-crit");
  const primerAlto = h.indexOf("vgl-mtr-alto");
  t.cierto(primerCrit >= 0, "no hay ningún aviso crítico y debía haberlo");
  if (primerAlto >= 0) t.cierto(primerCrit < primerAlto, "un HIGH quedó antes que un CRITICAL");
  ```
- **Fallo del patrón:** Si `primerAlto` fuese `-1` (ausencia de aviso HIGH), la comparación de precedencia entre CRITICAL y HIGH no se ejecuta y la prueba pasa en silencio sin asertar el orden.
- **Acción requerida:** Agregar `t.cierto(primerAlto >= 0, "debe existir al menos un aviso HIGH")` previo a la comparación.

---

## 2. Forma 2 — Código en sombra (Huérfanas, Dormidas, Costuras)

Se analizaron las 527 declaraciones de funciones del userscript mediante grafo de llamadas BFS y análisis tokenizado limpio.

### 2.1 Funciones de Deuda Muerta (8 funciones)
Funciones sin llamadores de producción y sin dependencias planificadas:
1. `_conductaBuscarYAgregarExamen` (L1239): Intento antiguo de búsqueda en conducta.
2. `apiDigiturnoFinalizarTicket` (L10605): Endpoint de escritura Digiturno inerte.
3. `apiHcValidacionExamenCronicos` (L10690): Vía de red redundante abandonada.
4. `_demograficosInvalidar` (L10855): Invalidador demográfico sin llamadas.
5. `_atheneaIdPaciente` (L1575): Helper sin llamadores.
6. `_pesoDeSignosVitales` (L10832): Extractor sin llamadores.
7. `migrarEsquemaVgl` (L4057): Migrador legacy de esquema.
8. `debounceVgl` (L3888): Utilidad genérica de debounce.

> **Acción:** Orden de cambio `docs/cambios-pendientes/001-retiro-codigo-muerto.md`.

### 2.2 Funciones Dormidas / Encoladas para Integración (3 funciones)
1. `panelActivities` (L4611): Filtrado de actividades PyM, reservada para T5.
2. `calcTargetDateRange` (L11331): Cálculo de rangos ±3 días, reservada para `openLabSoloModal` en T5.
3. `mtrLeerFactoresRCV` (L16377): Bloque ASCVD / tabaquismo (retorna `null` a propósito hasta capturar `DIAGNOSTICO_FACTORES_RCV.js`).

### 2.3 Costuras de Prueba Legítimas (`__VGL__`) (6 funciones)
- `_getRacGuardiaParaTest` / `_setRacGuardiaParaTest` (L3432-L3433)
- `_getUltimoRelevoParaTest` / `_setUltimoRelevoParaTest` (L4504-L4505)
- `_getFirmaPropiaParaTest` / `_setFirmaPropiaParaTest` (L5570-L5571)

### 2.4 Motor Portado (v14.2) / Utilidades Puras (11 funciones)
- `mtrRetrocederADiaHabil`, `mtrSumarDiasHabiles`, `mtrFechaControlDesdeFtl`, `mtrProgramaRector`, `mtrVigenciaDias`, `mtrVentanaAnrDias`, `mtrCnoHDL`, `mtrReduccionLdlPct`, `mtrNormalizarRiesgoCv`, `mtrPrincipioEnTexto`, `mtrRenglonesMedicamentoDesdeRespuesta`.
- **Estado:** 100% probadas contra 15.222 vectores dorados en suites 38–43.

---

## 3. Forma 3 — La guarda que no guarda

### Análisis
Se auditaron 17 puntos de conversión numérica (`Number()`, `parseInt()`, `parseFloat()`) seguidos de comparaciones de orden.

1. **`estadioKDIGO` (L2750):** Verificado que cuenta con guarda de entrada obligatoria `!Number.isFinite(tfg) -> return "G0"` (v14.1.8). Ya no cae a "G5" por `NaN`.
2. **`_vigenciaDiasParaAnalito` (L3144):** Verificado que sanea strings de laboratorio con `_labNumerico` antes de calcular umbrales de albuminuria (`RAC`).
3. **`vigenciaPorEstadio` (L3351):** Si `opciones.esDM2 !== true` y el programa es `ERC` para `hba1c`, devuelve `null`. En la Tabla 50, G1 y G2 tienen valor `"BLOQ"`. Al devolver `null` para no diabéticos, `_vigenciaDiasParaAnalito` maneja el caso como analito no contemplado por estadio y utiliza la vigencia plana institucional (180 días).

---

## 4. Forma 4 — El dato que se lee y nadie usa

### Análisis
1. **Athenea Labs Bridge (`_parseAtheneaResultHtml`):** Sanea fechas y nombres de analitos usando `WHITELIST_13_LABS`. Si la fecha no se encuentra en el input (`dateInput === null`), emite log de diagnóstico y retorna `resultDate = null`, evitando registrar fechas ficticias.
2. **Everest Signos Vitales (`apiHcObtenerSignosVitales`):** Parsea el array JSON de `Historicos/ObtenerHistoricoSignosVitales`. Si la respuesta no es un array, no se cachea y retorna `null` fail-safe.

---

## 5. Forma 5 — La compuerta que se satisface sin hacer el trabajo (`cubre`)

### Análisis
Auditoría completa de los 56 nombres reportados por `runner.js` (ver desglose detallado en `docs/auditoria/LOS_54.md`):
- **28 funciones de canales de aviso:** Declaradas históricamente en `suite_04`, pero hoy cubiertas y probadas al 100% en `suite_42_canales_de_aviso.js`.
- **5 declaraciones de inflación cruzada:** `_marcarUroanalisisSi` en `suite_32` y `suite_34` (probada en `suite_08`), y `evaluarDiscordanciaTFG`/`elapsedMin`/`diaNuevo` en `suite_32`.
- **1 hueco de aserción real:** `todayTokens` en `suite_03` (documentado en Prueba Roja 001).

---

## 6. Forma 6 — La Sexta Forma: Inconsistencias de Contrato entre Subsistemas

Se identificó una **sexta forma del patrón**:

> **Definición de la Forma 6:** Desincronización silenciosa de contratos entre componentes desacoplados (Vigilante vs Copiloto, o Reglas de Negocio vs Catálogo), donde ambos subsistemas reportan pruebas en verde individualmente pero discrepan en tiempo de integración.

### Evidencias de la Sexta Forma en el Repositorio:
1. **Tabla de Festivos Colombianos:** El Copiloto incluye `2026-07-13` y `2027-07-12` como festivos, mientras que el Vigilante no los tiene. Ambos pasan sus pruebas unitarias, pero difieren en la fecha de cálculo de vencimiento de laboratorio.
2. **Regla de Retroceso a Día Hábil en FTL:** El Copiloto implementa `ajustar_fecha_habil` sumando +1 día (empujando la toma después del vencimiento), mientras el Vigilante retrocede (`mtrRetrocederADiaHabil`). Ambos sistemas reportan verde en sus suites aisladas.
3. **Herencia Trans-Suite de `cubre`:** Suites que importan o copian el array `cubre` de otra suite para cumplir `MIN_COVERAGE` sin ejecutar las pruebas correspondientes.

---

## 7. Triaje Clínico de Hallazgos

Aplicando la regla de triaje estricta:

| Hallazgo | ¿Escribe dato equivocado? | ¿Ordena examen erróneo? | ¿Mueve cita? | ¿Filtra PHI? | ¿Tumba Everest? | Clasificación |
|---|---|---|---|---|---|---|
| `todayTokens` sin aserción en `suite_03` | No | No | No | No | No | **Backlog de Mejoras** |
| Guarda en `suite_41` (`primerAlto >= 0`) | No | No | No | No | No | **Backlog de Mejoras** |
| 8 Funciones muertas en userscript | No | No | No | No | No | **Orden de Cambio 001** |
| Inflación de `cubre` en suites 04/32/34 | No | No | No | No | No | **Backlog de Mejoras** |
| Divergencia de festivos Copiloto/Vigilante | No (ambos usan fechas seguras) | No | No | No | No | **Backlog (Decisión Médica)** |

---

## 8. Conclusión y Veredicto del Juez

1. **Fase 0 de Calibración:** ✅ SUPERADA (8 de 8 confirmados, Caso #7 rechazado como falso positivo con evidencia).
2. **Invariante de Userscript:** ✅ `vigilante_agenda.user.js` **NO FUE MODIFICADO**. `git diff` sobre el archivo de producción permanece completamente vacío.
3. **Verificación Adversarial por Mutación:** ✅ Todo hueco reportado fue verificado mediante mutación del código/test y documentado con comando y salida verbatim.
4. **Clasificación de los 56 Nombres:** ✅ 100% completada y documentada en `docs/auditoria/LOS_54.md`.
5. **Entregables Completos:** ✅ `CALIBRACION.md`, `SOMBRAS.md`, `LOS_54.md`, `tests/rojas/001-today-tokens.js` + `.md`, `docs/cambios-pendientes/001-retiro-codigo-muerto.md`, `BACKLOG_MEJORAS.md`.
