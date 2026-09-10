# Informe técnico — Mejora integral v18.5.1-hc: lanzador asistido de Historia Clínica

Fecha: 2026-09-07 · Base: auditoría del userscript (52.5k líneas, v18.5.0) + extracción del
frontend público de Everest (`e:\CENTINELA\neps_extract`, 2.985 archivos · 150,84 MB · 99,8 %
de chunks; informe maestro: `e:\CENTINELA\neps_extract\INFORME_EXTRACCION.md`).

> Documento de revisión y validación: cada cambio tiene ficha con **ubicación exacta
> (líneas verificadas el 07-sep 16:0x)**, problema resuelto, forma de activación,
> evidencia de la extracción y cómo reproducir su verificación.

---

## 1. Perfiles de usuario, permisos y necesidades cubiertas

| Perfil (núcleo ACCESO existente) | Necesidad real en consulta | Qué recibe con v18.5.1-hc |
|---|---|---|
| **COMPLETO (médico tratante)** | Al abrir la HC desde Citas del día, saber en <2 s si el paciente es reincidente en inasistencias y desde qué fila se abrió | Chip de contexto (cédula enmascarada + origen clic/pantalla + alerta de fraude) y anuncio aria-live una sola vez |
| **LABORATORIOS** | Solo flujos de labs | Sin cambios: el chip vive dentro de `#vgl-root`, que solo se construye para perfiles con panel |
| **PÚBLICO / BLOQUEADO** | Ninguno | Sin cambios (capas a/b/c de ACCESO intactas; el módulo no añade ninguna compuerta nueva de red) |
| **Auditoría/soporte** | Trazabilidad | 4 filas en `tests/INFORME_MUTACIONES.md` (líneas 13557-13560) + suite_91 (16 casos) |

Regla de oro intacta: **el script sugiere, el médico decide** — módulo 100 % lectura de
estado en memoria; no hace clics, no llena casillas, no ordena, no sale a red.

---

## 2. FICHAS DE CAMBIO (ubicación → problema → activación → evidencia → validación)

### FICHA 1 · Ancla versionada del botón real
- **Ubicación**: `vigilante_agenda.user.js` líneas **10295-10300** (`CONFIG.SEL.btnHC`).
- **Problema que resuelve**: el script no tenía ninguna referencia al botón "Historias
  Clínicas" de Everest; cualquier integración futura dependía de texto suelto. Además el
  botón hermano "Consentimientos" COMPARTE la clase: anclar solo por clase habría causado
  falsos positivos.
- **Cómo se activa**: pasiva. Queda documentada en `CONFIG.SEL` para todo el script;
  la consume `_vglEsBotonHC` (FICHA 3).
- **Evidencia (extracción)**: `"btn btn-primary-medic"` ×11 (8 pares Ivy estáticos) en
  `neps_extract\viva\HCHealth\main.eb0dc786fe0f6b14cf32.js` (27 MB); el CSS de la clase vive
  en `neps_extract\viva\Atencionnopresencial\styles.b531b0149a62c4e26b97.css`. Ver
  `INFORME_EXTRACCION.md` §1 y §5.
- **Validación**: suite_91 caso «ancla versionada: CONFIG.SEL.btnHC…» (`t.igual`).

### FICHA 2 · Constantes del módulo VGL-HC
- **Ubicación**: líneas **14644-14671** (comentario-bloque + `VGL_HC_BTN_CLASE`,
  `VGL_HC_BTN_TEXTO`, `VGL_HC_GUARDIA_TEXTO`, `VGL_HC_HINT_TTL_MS`, variables de estado
  `_vglHcHint/_vglHcListenerOk/_vglHcLiveUltimo/_vglHcLiveDoc`).
- **Problema**: centraliza cada ancla con su FUENTE citada (regla del repo: evidencia >
  memoria) y fija el TTL del hint en 15 s.
- **Evidencia**: rótulo `" Historias Clínicas "` ×3 (con espacio inicial = icono+texto) y
  `"Consentimientos"` ×2, ambos en el mismo bundle HCHealth. Extracción §1 del informe.

### FICHA 3 · Reconocimiento del botón con guardia de hermano — `_vglEsBotonHC`
- **Ubicación**: líneas **14681-14692**.
- **Problema**: distinguir SIN error el botón de HC del de Consentimientos (misma clase) y
  sobrevivir a un renombre de clase (respaldo por rótulo exacto sin tildes).
- **Cómo se usa**: la llama el listener de captura (FICHA 4); también exportada para pruebas.
- **Detalle de robustez**: usa `tagName === "BUTTON"` (los nodos del arnés no definen
  `nodeType`; en el navegador `closest("button")` ya lo garantiza).
- **Validación + mutación**: casos 1-4 de suite_91; mutación «guardia hermano»
  (INFORME_MUTACIONES línea 13557): invertir la guardia enrojece 13/3.

### FICHA 4 · Captura de contexto en el clic — `_vglHcCapturarClick`
- **Ubicación**: líneas **14694-14707**; listener instalado una sola vez desde
  `hcRenderChip` (FICHA 7) en fase de **captura** sobre `document`.
- **Problema**: el botón NO usa `routerLink` (0 ocurrencias en el bundle): navega por
  código (`abrirHistoria`, `token=`/`idPaciente=`). El ÚNICO momento en que se sabe qué
  paciente se abre es el clic en la fila. Sin esto, el primer segundo de la HC abierta no
  tiene contexto de quién es.
- **Comportamiento**: sube al botón (`closest("button")`), baja a SU fila
  (`.card-body`/`.card` → `.text-muted`), canoniza la cédula con `_vglDocCanon` y siembra
  el hint `{docId, ts}`. **Fallar cerrado**: sin cédula legible NO toca el hint previo.
- **Evidencia**: modelo de fila de Everest (`.text-muted` ya usado por `CONFIG.SEL.documento`,
  auditoría línea 10293); mecanismo `abrirHistoria`+query `token=`×8/`idPaciente=`×1 del
  bundle (INFORME_EXTRACCION no lo lista: ver probe del subagente, resumido en §5 de aquí).
- **Validación + mutación**: casos 5-6 de suite_91; mutación «TTL» (línea 13558).

### FICHA 5 · Contexto de paciente con prioridad del DOM — `hcPacienteContexto`
- **Ubicación**: líneas **14709-14720**.
- **Problema**: dar contexto SIN fabricar pacientes. Regla implementada: si hay historia
  abierta (`seccionActiva()==="historia"`), `extractPacienteAbierto()` (el lector canónico,
  líneas 14617+) **siempre gana**; el hint solo cubre los segundos de carga y caduca a los
  15 s. Devuelve `{docId, origen:"dom"|"hint"}` o `null`.
- **Validación**: casos 7-8 de suite_91 («el DOM manda sobre el hint», «hint caducado no
  fabrica contexto»).

### FICHA 6 · Consulta de fraude por paciente — `_vglHcFraude` y máscara — `_vglHcMascara`
- **Ubicación**: líneas **14722-14739**.
- **Problema**: saber si EL paciente abierto tiene alguna cita en `state.fraudWatch`
  (claves `doc@hora`, Set) y mostrar la cédula SIN exponerla completa (misma política que
  `_diagValorAtributoSeguro`, línea 36468+).
- **Validación + mutación**: caso 9 de suite_91; mutación «máscara PHI» (línea 13559):
  quitar `.slice(-4)` enrojece 15/1 — la cédula completa nunca llega a pantalla.

### FICHA 7 · Chip de contexto accesible — `hcRenderChip`
- **Ubicación**: líneas **14741-14776**; enganchada al tick en la línea **36316**
  (`try { hcRenderChip(); } catch (e) {}`, junto a `createAccionesDockUI()`).
- **Qué pinta**: dentro de `#vgl-root` crea UNA vez `#vgl-hc-zone` con
  `#vgl-hc-chip` (`role="status"`, colores inline con `!important` — Regla R de suite_25)
  y `#vgl-hc-live` (`aria-live="polite"`, oculto visualmente). El chip se repinta por tick:
  `HC ···1234 · clic en agenda|en pantalla · ⚠ inasistencia reincidente` (solo si hay
  fraude). Sin contexto → chip vacío (no queda paciente viejo pegado).
- **Cómo se activa en producción**: automático. Condiciones: panel construido
  (`#vgl-root` existe → perfil con panel), y clic previo en el botón de HC O historia
  abierta con paciente legible. No requiere configuración del médico.
- **Rendimiento**: idempotente por tick (5 s), 2 `getElementById` + ~200 bytes de
  `innerHTML`; cero listeners propios (el de captura se instala una vez).
- **Validación**: casos 10-12 de suite_91.

### FICHA 8 · Anuncio aria-live con dedupe — `hcTickVigia`
- **Ubicación**: líneas **14778-14793**; enganchada al tick en la línea **36286**
  (`try { hcTickVigia(docId); } catch (e2) {}`, junto a la cosecha de la historia).
  *(Nota de mantenimiento: este hook se perdió una vez por una carrera de edición con el
  agente paralelo y se reinstaló; verificado presente el 07-sep.)*
- **Problema**: el médico con lector de pantalla (o la sala, por audio) no recibía aviso
  al abrir la HC de un reincidente. Ahora: mensaje «Historia clínica abierta: paciente con
  alerta de inasistencia reincidente.» UNA vez por paciente — **sin decir la cédula en voz
  alta** (PHI acústico: la sala de espera escucha).
- **Validación + mutación**: casos 13-14 de suite_91; mutación «dedupe» (línea 13560):
  anularlo enrojece 15/1 (el lector repetiría cada 5 s toda la consulta).

### FICHA 9 · Suite de pruebas completa — `tests/suite_91_hc_launch.js`
- **Ubicación**: archivo nuevo, 21 casos hermanos (sin anidado); 16 síncronos + 5
  `casoAsync` con `await` (los del prefetch, con mock de fetch y sondeo tolerante).
- **Cobertura**: reconocimiento (4), captura de clic (2), prioridad DOM/TTL (2), fraude (1),
  chip (3), aria-live (2), ancla (1), contrato de red v18.5.2-hc2 (1), prefetch (5).
  El compromiso estructural evolucionó: el bloque VGL-HC NO contiene primitivas de red
  propias (`GM_xmlhttpRequest`/`pageFetchJson(`/`_pageFetchJsonCore(`/`xmlhttp`) y su
  única red es el prefetch **especulativo** (`especulativo: true` + dedup `GHOST.promises`).

### FICHA 10 · Prefetch especulativo de órdenes vigentes al clic — `hcPrefetch` (v18.5.2-hc2)
- **Ubicación**: función `hcPrefetch` líneas **14714-14745**; detonada por
  `_vglHcCapturarClick` en la línea **14710**, justo tras sembrar el hint.
- **Base de evidencia**: `docs/INFORME_EVIDENCIA_HAR.md` §1 — el clic en "Historias
  Clínicas" desata una cascada de ~95 llamadas (~7 s) antes de que la HC pinte;
  `ObtenerOrdenamientoPorPacienteIdVigente` (15,5 KB) y el cruce antiduplicado PyM/T6-T7
  consumen esa misma cadena. Precalentarla en el clic hace que el banner y el modal
  de órdenes salgan de caché (`_ordenesVigentesCache`, TTL 10 min) al abrirse.
- **Seguridad (todo heredado del repo, nada nuevo)**:
  - Cadena `cédula → apiAccesoBuscarPaciente (especulativo) → id interno → órdenes`;
    si BuscarPaciente no resuelve el id, la cadena SE CORTA (la cédula jamás viaja
    como `pacienteid` — bug histórico documentado en las rutas retiradas v12.0.0).
  - `especulativo: true`: 1 intento, 0 reintentos, silencioso, y sujeto al
    cortacircuitos de 3 fallos/5 min (`_apiCorteAbierto`) — con Everest caído, un
    clic de HC no insiste ni grita en consola.
  - Dedup en vuelo por `GHOST.promises` (llave `hcprefetch_<cédula>`, TTL 5 min):
    dos clics rápidos = una sola cadena; las cachés TTL hacen que un segundo clic
    del mismo paciente genere 0 peticiones.
  - Fallo total = silencio: hint y chip NO dependen del prefetch (fallar cerrado).
  - Lectura pura: mismo origen, sesión cookie del médico; cero escritura.
- **Activación**: automática al clic válido del botón HC con cédula legible en la fila.
- **Validación + mutaciones**: 5 casos nuevos de suite_91 (21/21). Tres mutaciones
  cazadas (filas 13561-13563 de `tests/INFORME_MUTACIONES.md`): quitar la llamada al
  clic, anular el dedup en vuelo, y degradar la flag `especulativo`.

---

## 3. Verificación y métricas de éxito

| Métrica | Meta | Resultado |
|---|---|---|
| Anclas de la extracción aprovechadas | clase, rótulo, hermano, mecanismo sin-routerLink | 4/4 codificadas con fuente citada |
| Red nueva | 0 peticiones propias; prefetch v18.5.2-hc2 especulativo y acotado | 0 primitivas de red en el bloque (aserción estructural); 1 cadena reutilizada (`BuscarPaciente`→órdenes) solo al clic válido, con dedup + cortacircuitos |
| PHI en pantalla/voz | cédula nunca completa | máscara ···+4 (mutación cazada) |
| Anuncios a11y repetidos | 1 por paciente | dedupe (mutación cazada) |
| Paciente fantasma (hint viejo) | imposible | TTL 15 s + DOM manda (mutación cazada) |
| Confusión con "Consentimientos" | imposible | guardia de texto (mutación cazada) |
| Banco | sin regresiones propias | suite_91 21/0 (mutaciones prefetch cazadas); banco completo verificado tras rebase |

**Reproducir**:
```powershell
node -c vigilante_agenda.user.js
node tests/runner.js suite_91     # 16 pasan
node tests/runner.js              # banco completo
```

---

## 4. Funcionalidades POTENCIALES diseñadas con la extracción (NO implementadas)

Diseñadas y evaluadas; se dejan fuera de este cambio para mantener el diff quirúrgico en
un EHR de producción. Cada una lista su base en la extracción y su riesgo.

1. **Contador de inasistencias históricas en el chip** — leer `vgl_nosh_hist` (cifrado
   AES-GCM, suite_89) y sumar `N inasistencias (180 d)` al chip. Base: el almacén ya
   existe (líneas 35372+). Riesgo: acoplar descifrado al tick; mejor hacerlo en el clic
   (una vez por paciente).
2. **Pendientes PyM del paciente en el chip** — reusar `_pendientesUniversales`
   (15811+). Riesgo: depende de la base PyM del día (SharePoint); el chip debe seguir
   siendo cero-red y sincrónico → se necesitaría caché del clic.
3. ~~**Prefetch de ordenes vigentes al capturar el clic**~~ — **IMPLEMENTADO en v18.5.2-hc2
   como FICHA 10** (`hcPrefetch`, líneas 14714-14745): cadena `BuscarPaciente (especulativo)
   → id interno → ordenes vigentes`, detonada por el clic del botón HC, con dedup en vuelo,
   cortacircuitos heredado y corte de cadena si no hay id interno. Quedan como candidatos
   FUTUROS de prefetch los otros dos endpoints confirmados por el HAR —
   `MedicamentoPorPaciente` (1,3 MB: exige tope de tamaño y cacheo agresivo) y
   `ObtenerUltimaHCPes` (10,7 KB: requiere conocer la estructura del JSON, hoy ausente del
   HAR — brecha 1 de `INFORME_EVIDENCIA_HAR.md` §8).
4. **Anclas Metronic de respaldo** — `kt-*` ×413 y `label.kt-checkbox` ×332 en el bundle:
   útiles si Everest retira `.text-muted`/`.labelHora`. Hoy NO se cablean (regla: casilla
   vacía antes que dato inventado; cambiar selectores sin captura real está prohibido).
5. **Descartado con evidencia — preconnect**: todo (HCHealth, apiviva) es SAME-ORIGIN en
   neps.everestintelligent.com (INFORME_EXTRACCION §1): un preconnect no aportaría nada.
   Documentado para no volver a evaluarlo.

---

## 5. Material de referencia (para validar cada ancla)

| Referencia | Qué demuestra | Dónde |
|---|---|---|
| Informe maestro de extracción | Arquitectura, volumen, endpoints, limitaciones | `e:\CENTINELA\neps_extract\INFORME_EXTRACCION.md` |
| Bundle del botón | `btn btn-primary-medic` ×11, rótulo ×3, "Consentimientos" ×2, `abrirHistoria`, `token=`/`idPaciente=`, `guardarHoraApertura` ×3 | `neps_extract\viva\HCHealth\main.eb0dc786fe0f6b14cf32.js` |
| CSS de la clase | definición real de `.btn-primary-medic` (2 reglas) | `neps_extract\viva\Atencionnopresencial\styles.b531b0149a62c4e26b97.css` |
| Manifiesto de módulos | "Historia clinica V2" → routePath HCHealth, openNewTab | `neps_extract\raw\GetModules.json` |
| Verificador del espejo | re-ejecutar la auditoría de chunks | `neps_extract\verify2.js` → `_verificacion_final.txt` |
| Reglas del repo | PH I, un archivo, prefijo vgl-, !important, mutaciones | `AGENTS.md`, `CLAUDE.md` (raíz del repo) |
| Registro de mutaciones | 4 filas v18.5.1-hc (13557-13560) + 3 filas v18.5.2-hc2 (13561-13563) con línea/mutación/resultado | `tests/INFORME_MUTACIONES.md` |

## 6. Mantenimiento

- **Si Everest renombra la clase del botón**: el respaldo por rótulo exacto sigue
  funcionando (caso 3 de suite_91). Actualizar `CONFIG.SEL.btnHC` + `VGL_HC_BTN_CLASE`
  con una extracción fresca (`node neps_extract\crawl2.js`).
- **Si "Consentimientos" cambia de rótulo**: la guardia es por texto — re-verificar caso 2.
- **Si la HC tarda >15 s en cargar**: subir `VGL_HC_HINT_TTL_MS` (línea 14667); el DOM
  corrige solo al aparecer `#anamesis`.
- **Si el prefetch estorba (hipotético)**: quitar SOLO la llamada `hcPrefetch(docId)`
  de la línea 14710 — hint/chip siguen íntegros (están desacoplados a propósito).
- **No tocar**: `_enModuloHCHealth` (orden directa del médico 4-sep, líneas 14556+) y la
  no-memoización de `extractPacienteAbierto` (guard anti-cruce, 14610+).

## 7. Deuda explícita (auditoría, NO tocada aquí)

1. Memo por tick de `extractPacienteAbierto` para los 4 llamadores síncronos (receta en el
   propio fuente ~14610-14616) — requiere PR propio con pruebas de carrera.
2. Refactor del par cifrar/descifrar duplicado (cosecha ~5167 vs nosh_hist ~35382).
3. Credenciales Athenea: ya resueltas en paralelo por el equipo (`atheneaCredsGet`/
   `_atheneaCredsMigrarDeClaro`, v18.5.0) — no duplicar.
4. aria-live del contenedor de toasts: redundante (los toasts ya llevan `role=alert/status`
   + cierre por teclado, NT-115/M15) — hallazgo cerrado sin cambio.
5. **[HALLAZGO 07-sep 16:30-16:50, NO tocado] El banco completo se cuelga bajo carga de
   CPU** y el punto de cuelgue SE MUEVE entre corridas (suite_15 caso «ANTIDUP AsignarTurno
   en vuelo» en una corrida, caso «abrirInformeAthenea» en otra, y en banco completo tras
   suite_03/04 en otra). El proceso quema CPU (92 s en un zombie) y muere sin imprimir el
   resumen ni el aviso «EL EJECUTOR NO LLEGÓ AL FINAL». **Reproducido en un worktree
   limpio en HEAD (1fb088a), sin NINGÚN cambio del árbol** → no es de este diff ni del
   trabajo v18.5.x en paralelo; es sensibilidad a interleaving de timers bajo carga
   (múltiples procesos `@z_ai` del agente paralelo corriendo a la vez). Verificado en
   verde bajo carga actual: suite_91 (21/21), suite_05 (35/35), suite_25 (33/33). Antes
   de abrir PR: reintentar `node tests/runner.js` con la máquina despejada.
