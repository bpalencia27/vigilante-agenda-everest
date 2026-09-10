# Auditoría — «BASE PILOTO DE CONSULTA  BELLO SEPTIEMBRE1.xlsx» y migración a fuente única

**Fecha:** 2026-09-07 · **Auditor:** Claude (Copiloto Everest) · **Médico solicitante:** Brand
**Archivos de evidencia:** `AUDITORIA_BASE_PILOTO_SEP.js`, `AUDITORIA_SIM_SELECCION_SEP.js`,
`AUDITORIA_SONDA_PROCEX_SEP.js` (scripts de análisis estructural SIN PHI — nunca imprimen
nombres, cédulas ni valores identificables; el .xlsx se manipuló solo en carpeta temporal,
fuera del repo).

---

## 0. Resumen ejecutivo

| Aspecto | Estado |
|---|---|
| Archivo descargable por GUID con sesión anónima del enlace | ✅ HTTP 200, 23.610.847 bytes, firma `PK` (XLSX real, sin cifrar) |
| Compatibilidad con el lector PyM ACTUAL **sin cambios** | ❌ **ROTAAAA** — la simulación empírica demuestra que el Vigilante de hoy indexaría **0 pacientes** (hallazgo H1, crítico) |
| Estructura apta para el lector con hoja FIJADA | ✅ «citas dia regional» indexa 1.228 pacientes · 336 con pendientes · 38 abandono PES |
| Refresco 2×/día (06:00 y 12:00 Bogotá) comparando `TimeLastModified` | ✅ vía `pilotoMeta()` (1 KB), sin bajar 22,5 MB |

La migración «solo cambiar el GUID» habría dejado el módulo PyM **muerto en silencio** en
la primera consulta. La auditoría se hizo con el archivo REAL descargado del enlace
anónimo que pasó el médico, no con suposiciones.

---

## 1. Identidad del archivo

| Campo | Valor |
|---|---|
| Nombre exacto | `BASE PILOTO DE CONSULTA  BELLO SEPTIEMBRE1.xlsx` — **doble espacio** antes de BELLO (igual que la base de MAYO vigente) |
| GUID (sourcedoc/GetFileById) | `6594b356-f608-4c56-bb6f-6a90f2125a3f` |
| Enlace anónimo de compartir | `:x:/g/.../IQBWs5RlCPZWTLtvapDyElo_ATLEGcxBWzdBAkAveJms0Gc?e=yfuO3X` — redirige a `Doc.aspx?sourcedoc={6594b356-...}` y **concede FedAuth sin login** (verificado con curl: HTTP 200) |
| Tamaño | 22,5 MB (**60 % más que la base de MAYO** ~14 MB que citan los comentarios del código) |
| Última modificación | 2026-09-07T22:08:05Z = **17:08 Bogotá de hoy** → el archivo SE EDITA ACTIVAMENTE; el refresco diario a las 06:00 es coherente |
| Cifrado/OLE | No. ZIP/XLSX estándar (método 8 deflate en hojas, stored en imágenes) |

## 2. Estructura del libro (12 hojas)

| # | Hoja | XML MB | Filas | Papel | ¿Indexable por el lector PyM actual? |
|---|---|---|---|---|---|
| 1 | ANEXO 5 JULIO | 20,9 | 20.248 | Metas RCV (CUMPLE_*, TFG, estadio nefroprotección, fechas de toma) | Doc col «Numero Documento» EXACTA ✔ pero **0 pendientes** (vocabulario «REMITIR») |
| 2 | PROCEXDTAGOSTO | 25,3 | 95.589 | Tamizaciones: CERVIX/MAMA/PSA/SOMF | Doc col «NRO IDENTIFICACION» (espacio) solo blanda ⚠ · pendientes en vocabulario **«Aplica Cobertura/Fenix VPH/CCU»** que `isPending` NO reconoce |
| 3 | CITASDIA AGOSTO | **97,6** | 85.566 | Histórico agenda agosto, 49 columnas | Doc col resuelta a **«TIPO_DOCUMENTO»** (¡el TIPO, no el número!) → 0 pacientes |
| 4 | **citas dia regional** | 0,5 | 1.269 | **Citas operativas** (Fecha_Cita 04–07 sep) | ✅ Doc col «Identificacion» EXACTA · 336 pendientes · 38 abandono |
| 5 | EKG 2025 | 1,8 | 17.516 | EKG hechos | sin encabezado en 15 filas |
| 6–9 | CONSULTA 1–4 | ~0 | 26 | Tablas de reglas («PRIORIZAR CONSULTA DE RCV», «En Control Activo Fuera de Metas», «Paciente en abandono…») | no tabulares (documentación de reglas) |
| 10 | COHORTE VIH | 0,2 | 266 | Cohorte VIH | doc blanda ⚠ · 0 pendientes |
| 11 | INDICADORES METAS TERAPEUTICAS | ~0 | 3 | metas mes 1/4/6/8/12 | no aplica |
| 12 | CUPS PARA ACTIVIDADES SUSCEPTIB | ~0 | 19 | Catálogo actividad→CUPS | no aplica |

Otros elementos: `xl/sharedStrings.xml` (count 1.543.061 · unique 8.973 — parser actual lo
lee en streaming, tope 4 MB por trozo: OK), `xl/calcChain.xml` 20,7 MB (**el libro está
llenó de fórmulas** — irrelevante para el lector, que solo lee `<v>`), 10 imágenes PNG
(logos), 57 entradas ZIP.

**Vocabularios de la hoja operativa «citas dia regional» (1.268 filas de datos):**

| Columna | Valores (histograma) | Efecto en el lector actual |
|---|---|---|
| `Valoracion_integral` | No aplica ×618 · Realizada ×473 · **Susceptible ×176** | chip «Valoración integral de salud» ✔ |
| `Tamizacion_CMB` | No aplica ×706 · **Susceptible ×306** · Tamizado ×255 | chip «Tamización cardiometabólica» ✔ |
| `Abandonados_PES` | No ×1227 · **Si ×40** | set de abandono RCV ✔ (38–40 pacientes) |
| `Criterio_CAC` | No Aplica ×1060 · «Requiere glicemia» ×15 · «Requiere MAPA» ×6 · «Requiere creatinina» ×4 · «Requiere glicemia y MAPA» ×9 · «Calcular TFG y definir» ×3 | NO reconocido por `isPending` (no empieza por «tamizar») — hoy se ignora |
| `Anexo5` / `Cuenta_Alto_costo` / `Relacionado_Procex` | Si/No | se ignoran (no son actividad) |
| `Fecha_Cita` | serial 46269–46272 = **04–07 sep 2026** (muestra: 630 filas el 04-sep) | no consumida |

**Vocabulario de `PROCEXDTAGOSTO` (tamizaciones, 95.587 filas):**
`CERVIX`: No Aplica ×14.831 · Con Tamizacion vigente ×3.567 · **Aplica Cobertura VPH ×1.166 ·
Aplica Fenix VPH ×377 · Aplica Cobertura CCU ×39 · Aplica Fenix CCU ×20** — patrón análogo en
MAMA (1.781 «Aplica…»), PSA (918), SOMF (5.636). «Aplica …» = el paciente REQUIERE la
tamización: es el equivalente funcional del «Susceptible» del archivo diario, en otro idioma.

---

## 3. Hallazgos (criticidad · ubicación · corrección)

### H1 — [CRÍTICO] Con el código actual, el libro nuevo indexa 0 pacientes y el panel calla
**Ubicación:** `vigilante_agenda.user.js` — `scoreSheet` (L11835), `findDocIdx` (L11866),
`DOC_EXACT` (L10353), `makeIndexer` (L11488).
**Evidencia (simulación con el archivo real, réplica exacta de `_readPymWorkbookStreamCore`):**
```
★ CITASDIA AGOSTO   score 400 · pend400 390 · docCol «TIPO_DOCUMENTO» (col 2) · 97.6 MB
  citas dia regional score 244 · pend400 144 · docCol «IDENTIFICACION» (col 1) · 0.5 MB
HOJA ELEGIDA: «CITASDIA AGOSTO» → pacientes totales: 0 · con pendientes: 0 · abandono: 0
```
Cadena del fallo: (1) `scoreSheet` premia la hoja con más celdas «Susceptible» en 400 filas —
el histórico de agosto gana 400 vs 244; (2) en esa hoja la columna de identificación real se
llama `NRO_IDENTIFICACION` (con espacio), que **no está en `DOC_EXACT`** (que espera
`NUMERO_IDENTIFICACION`), así que el fallback blando toma la PRIMERA columna que contenga
"DOCUMENTO": `TIPO_DOCUMENTO` (valores «CC», «TI»…); (3) `normalizeKey("CC")` → vacío →
las 85.566 filas se descartan. Resultado en consultorio: todas las tarjetas en «Dato
faltante: sin registro en PyM», sin error visible.
**Corrección:** fijar la hoja fuente por nombre (ver H2) + guardián de índice vacío (H8).

### H2 — [ALTO] La selección de hoja por puntaje es una lotería con libros multi-hoja
**Ubicación:** `scoreSheet` (L11835) + `_readPymWorkbookStreamCore` (L11876-11897).
Con la base de MAYO (pocas hojas) el puntaje acertaba; con un libro de 12 hojas donde varias
tienen columna de documento, gana la que tenga más «Susceptible» por azar de muestreo (300 KB
≈ 400 filas). Cualquier reordenación del libro cambia la hoja elegida.
**Corrección:** en la migración, la hoja pasa a ser **configuración explícita**
(`CONFIG.SP.base.sheet: /^citas\s*dia/i` con coincidencia insensible a mayúsculas/acentos),
no una decisión del puntaje. `scoreSheet` se conserva como fallback si el nombre no existe
(manejadores de la base vieja y de CSV manual).

### H3 — [ALTO] `NRO_IDENTIFICACION` y variantes con espacio faltan en `DOC_EXACT`
**Ubicación:** `DOC_EXACT` (L10353) + fallback blando de `findDocIdx` (L11869).
El fallback elige por ORDEN de columna, no por especificidad: «TIPO_DOCUMENTO» le gana a
«NRO_IDENTIFICACION». Además el fallback no exige que la columna tenga valores numéricos.
**Corrección:** (a) añadir a `DOC_EXACT`: `NRO_IDENTIFICACION`, `NRO IDENTIFICACION`,
`NUMERO IDENTIFICACION`, `NUMERO DOCUMENTO`, `IDENTIFICACION PACIENTE`, `DOCUMENTO PACIENTE`
(comparando con espacios normalizados a `_`); (b) en el fallback blando, desempatar por
"la columna cuyos primeros valores son numéricos de 5-15 dígitos" antes que por orden.
Aplica también a lectura manual de CSV/XLSX del médico.

### H4 — [ALTO] 22,5 MB con margen de descarga pensado para 14 MB
**Ubicación:** `T_DESCARGA = 120000` (L13999, comentario «la base pesa ~14 MB»).
En el enlace del consultorio a 5,9 s/23,6 MB de hoy sobra margen, pero un mal día de red
(2 Mbps → ~90 s solo de descarga) más el inflado puede superar los 120 s y matar la carga
con «se agotó el tiempo».
**Corrección:** subir a 180.000 ms y corregir el comentario. (El chequeo diario usa
`pilotoMeta()`, 1 KB, así que el costo de red del refresco normal es ínfimo.)

### H5 — [MEDIO] Chips de tamización se pierden si solo se indexa la hoja regional
**Ubicación:** consumo vía `getActivities` (L11327) + `FRIENDLY` (L10324).
El archivo diario («Agenda Día») traía `TAMIZACION_CERVIX`, `TAMIZACION_MAMA`, `TAMIZACION_VIH`,
`AGUDEZA_VISUAL`… La hoja regional SOLO trae `Valoracion_integral` + `Tamizacion_CMB` +
`Abandonados_PES`. Sin acción, la migración **elimina silenciosamente** los chips de cérvix,
mama, PSA, SOMF del panel en vivo.
**Corrección (opción B, a confirmar con el médico):** indexar también `PROCEXDTAGOSTO`
mapeando `Aplica …` → pendiente: `CERVIX Aplica*VPH` → «Cáncer de cuello uterino — VPH»,
`Aplica*CCU` → «— citología cervicouterina» (reutiliza `detalleTipoCervix`), `MAMA` →
«Mamografía», `PSA` → «PSA (antígeno de próstata)», `SOMF` → «SOMF (sangre oculta en
materia fecal)». El diccionario `FRIENDLY` ya tiene todas las etiquetas.

### H6 — [MEDIO] Filas repetidas por paciente (multi-cita) con unión de buckets
**Ubicación:** `makeIndexer.push` (L11516-11566) — los buckets se acumulan por unión.
En la regional hay 39 documentos duplicados (citas de varios días). Un paciente atendido el
04-sep cuyo estado pasó a «Tamizado» conserva la fila vieja «Susceptible» si vuelve: **chip
obsoleto**. El archivo diario (foto de HOY) no tenía este problema.
**Corrección mínima:** documentar y aceptar (el operador refresca estados a diario); opción
futura: quedarse con la fila de `Fecha_Cita` MÁXIMA por documento. NO filtrar por
«Fecha_Cita == hoy» (rompería con hojas publicadas tarde → índice vacío).

### H7 — [MEDIO] El enlace anónimo otorga lectura sin login a TODO el que lo tenga
**Ubicación:** configuración, no código.
El enlace `:x:/g/…?e=yfuO3X` concede FedAuth anónima (verificado). Quien tenga el enlace lee
la base completa (PHI de ~96 mil afiliados). Es la política de compartición de la IPS, no un
defecto del script — pero conviene que el médico lo sepa y que el enlace NUNCA entre al
código fuente (el repo es privado pero el gist de distribución es público).
**Corrección:** guardar el enlace como valor de configuración ofuscado NO es suficiente —
la decisión correcta es NO incrustarlo en el userscript distribuido y usar solo las vías por
GUID con la sesión/cookie de carpeta que ya ceba `primeShareAccess`. Se deja el enlace fuera
del código y se documenta aquí.

### H8 — [MEDIO] Sin guardián de «índice vacío» en la vía de la base
**Ubicación:** `loadPymBase`/`loadPymBaseDescarga` (L14128/L14138) — `loadPymDiario` sí tiene
`mtrLibroNoParecePym`/`_pymRechazados` (anti-libro-equivocado); la vía del respaldo no.
Un libro correcto pero con hoja equivocada (H1) o fila de encabezados corrida produce un
índice vacío que se CACHÉA y calla.
**Corrección:** si tras indexar `todos.size === 0` → rechazar el libro (conservar caché
anterior, telemetría `error` con motivo, toast único). Idem si la hoja fijada no existe.

### H9 — [BAJO] Huella de caché usa nombre crudo con doble espacio
**Ubicación:** `pymFP` (huella `nombre|mtime`) y `CONFIG.SP.respaldo.name`.
El nombre real lleva **dos espacios** («CONSULTA  BELLO»). Cualquier comparación por cadena
exacta escrita a mano con un solo espacio fallaría en silencio. La huella debe construirse
desde el `Name` que devuelve `pilotoMeta()`, nunca desde una constante tipada a mano.

### H10 — [BAJO] Elementos ignorados correctamente (sin acción)
`calcChain.xml` (20,7 MB), imágenes PNG, `INDICADORES`, `CUPS`, hojas `CONSULTA`: el lector
solo abre `workbook.xml`, `rels`, `sharedStrings.xml` y las hojas elegidas — sin riesgo.
`Mes_tamizacion` dispara falsos «≥6 dígitos» en auditorías ingenuas (es YYYYMM): anotado
para no cazar fantasmas.

---

## 4. Plan de migración (mandato del médico: 100 % base nueva, 0 % Agenda Día, refrescos 06:00 y 12:00 UTC-5)

**Decisiones del médico (07-sep, en vivo):** opción **B** (regional + PROCEX con mapeo
«Aplica …») · indexar **todas las filas** de la hoja regional (sin filtro por fecha) ·
refresco **a las 06:00 y a las 12:00** Bogotá.

1. **CONFIG.SP.base única** — `{ id: 6594b356-…, name (del servidor, no a mano),
   sheet: "citas dia regional", sheetExtra: "PROCEXDT", horasRefresco: [6, 12] }`; el bloque
   `respaldo` de MAYO se retira (su caché `vgl_piloto` se purga sola al cambiar el `id`,
   v18.0.134) y el `shareId` viejo se elimina (apuntaba a la base de MAYO: habría podido
   entregar datos de un mes pasado por la tercera vía de descarga).
2. **Hojas fijadas** — «citas dia regional» por nombre + PROCEX indexada con
   `makeProcexIndexer` (H5/opción B: «Aplica Cobertura/Fenix VPH/CCU» → chips de cérvix
   VPH/CCU, mama, PSA, SOMF) y FUSIONADA al índice; `scoreSheet` queda como fallback de
   emergencia. Guardián H8 en la puerta (índice vacío → rechazo).
3. **Borrado del flujo diario** — `loadPymDiario`, `fetchSpFilesMultiFolder`, `pickTodaysFile`,
   `todayTokens`, `esNombreDeHoy`, `xlsViejoDeHoy`, `debeBuscarPymDiario`, captador
   (`vgl_pym_esfallback`), `bootSharepointLite`, `savePymCache`/`loadPymFromCache`
   (`vgl_pym`), consulta al respaldo (`respaldoDiceDe` y cía.) y recordatorio «Falta el PyM
   de hoy» (reescrito). Mensajes del panel y del modal reescritos (ya no hay «lista de hoy»
   vs «respaldo»). Limpieza de migración: las claves `vgl_pym*` se borran al arrancar.
4. **Refrescos 06:00 y 12:00** — `baseVentanaRefresco()` computa las ventanas en UTC-5 fijo
   (independiente del TZ del equipo); minutero que vigila la compuerta (sello por ventana,
   solo se sella si los metadatos respondieron → una falla de red reintenta al minuto);
   `pilotoMeta()` (1 KB) compara `TimeLastModified` antes de bajar 22,5 MB;
   `T_DESCARGA` → 180 s (H4).
5. **Mantenimiento (requisito del médico)** — log de actualizaciones `vgl_base_log` (anillo
   de 60 filas: fase/meta/descarga/índice, ms, MB, mtime, errores — SIN PHI); integridad
   post-descarga (firma PK + ZIP + hoja fijada + índice no vacío); rollback automático (la
   caché solo se reemplaza tras validar el índice nuevo; en fallo se sirve la última copia
   buena y se reintenta); métricas al tablero (`base.descarga.ms.*`, `base.indice.pacientes.*`)
   que alimentan las alertas de flota existentes.
6. **Pruebas** — suites 03/12/05/16 reescritas + suite 92 de staging (ventanas, rollback,
   integridad, recuperación, log). Mutaciones verificadas y registradas. Bump v18.6.0 +
   CHANGELOG.

### H11 — [ALTO, hallazgo bonus durante la migración] `FRIENDLY_NORM` no viajaba al Web Worker
**Ubicación:** template del worker en `readPymWorkbookStream` (~L11938) vs `friendly()` (L10908).
Desde v18.0.92, `friendly()` consulta `FRIENDLY_NORM`, pero el worker solo serializaba
`FRIENDLY` → `ReferenceError` al indexar la primera celda pendiente dentro del worker. No
explotó en producción porque el CSP de Everest manda el parseo al hilo principal (fallback
donde `FRIENDLY_NORM` sí existe). **Corregido en v18.6.0** construyendo el índice normalizado
dentro del worker tras serializar `stripAccents`.

---

## 6. Anclas ACTUALIZADAS para la sesión de integración (Anexo 5 / HAR / toggles)

La delegación v2 cita números de línea y nombres de API del archivo PRE-v18.6.0. Esta
migración los movió o los renombró — contra estas anclas se debe cablear, no contra las
del prompt (los números exactos se buscan por nombre con grep; el archivo tiene ~52,9 K líneas):

| El prompt dice | Realidad v18.6.0 |
|---|---|
| `CONFIG.SP.respaldo` (config en L10258) | **`CONFIG.SP.base`** (~L10260): `{ id: "6594b356-f608-4c56-bb6f-6a90f2125a3f"`, name (informativo — el real llega por `pilotoMeta()`), `sheet: "citas dia regional"`, `sheetExtra: "PROCEXDT"`, shareId:"", `horasRefresco: [6,12] }`. La hoja ANEXO 5 se agrega aquí (p. ej. `sheetAnexo5: "ANEXO"`). **Ojo typos del GUID: el correcto termina en `bb6f`** (dos auditorías ya tropezaron con `bbf`). |
| `makeProcexIndexer` (L11765) | Existe (~L11870); junto a `esAplicaPendiente` y dentro del worker serializado. `makeAnexo5Indexer` debe seguir ESTE patrón: función autocontenida (solo dependencias serializadas al worker: `findDocIdx/normalizeKey/stripAccents/…`) y añadirse a la lista `.toString()` del template del worker — regla nueva: comentarios de bloque `/* */` dentro de plantillas (Regla H, suite 72). |
| `_readPymWorkbookStreamCore` (L11809) | Firma nueva: `(arrayBuffer, opts)` con `opts = {main, extra}`; helper interno `streamSheet(path, hr, indexerFactory)` reutilizable para una TERCERA hoja; fusión por unión en `todos`/buckets; guardián `opts.main && !todos.size` → throw. Resultado: `{headers, map, todos, abandono, sheetName, sheetExtra, extraDocs, rowCount, sheets}`. |
| `packPym/unpackPym` (L12122/12144) | Sin cambio de firma; subir a **v4 aceptando v3 viejo sin el campo**. La meta viaja AL FINAL del paquete (truco de la cola `-800` para leer mtime/date sin desempaquetar — respetarlo al añadir campos). |
| `applyPymIdx` (L12170) | **4 argumentos** `(idx, fileName, mtime, nombreReal)` — el 5.º (`esDiarioRealDeHoy`) fue retirado. Devuelve bool; guardas mtr adentro. |
| `state.pymFallback` / `pymDia` / `pymResp*` | **ELIMINADOS**. El origen de la carga es `state.pymOrigen` (`""`/`"base"`/`"manual"`). El abandono PES ya vive en `state.pymAbandono` (de la regional) — la regla «6 meses sin control» del Anexo 5 lo COMPLEMENTA, no lo reemplaza. |
| caché `vgl_pym` / captador / `bootSharepointLite` | **Retirados y purgados al arrancar** (`_vglPurgarCacheDiariaLegacy`). La caché única es `vgl_piloto` (paquete v3, purga 30 días / cambio de id / mtr). |
| refresco del respaldo (franja am/pm) | Ahora `pilotoFreshCheck` con ventanas 06:00/12:00 Bogotá (`baseVentanaRefresco`), sello `vgl_piloto_chk` = `"YYYY-MM-DD|<idx>"` solo en desenlaces terminales; `baseSincronizarEntrePestanas` propaga el refresco entre pestañas por disco. `loadPymBaseDescarga` tiene guarda de en-vuelo y orden aplicar→guardar (rollback). |
| esquema ANEXO 5 | Ya extraído con el libro real: §2 de este informe + `_audit_base_sep_raw.txt` (38 columnas, typos del libro incluidos: `PISCOLOGIA`, `HEMOBLOBINA_GLICOSILADA`, `Fecha Ultimo Control (Médico)` serial Excel, base 1899-12-30; 46269 = 04-sep-2026). |
| pruebas | La suite de staging de la base es **`tests/suite_92_base_unica.js`** (ventanas, rollback, integridad, log) — los casos del Anexo 5 van ahí o en suite hermana; filas de mutación SOLO al final de `tests/INFORME_MUTACIONES.md`. Banco: 3539 pasan / 3 fallan preexistentes (suites 79/82/87, de la sesión v18.5.2 — verificadas con stash; no son de esta migración). |
| versión | 18.6.0 (cuádruple: `@version` L4 + `const VERSION` ~L1038 + `package.json` + pin `suite_75` ~L924). El prompt v2 asume base `e6d9aa3` (18.5.2): **la sesión de integración debe partir de un commit que incluya v18.6.0** — hoy está sin commitear a la espera de orden del propietario. |
