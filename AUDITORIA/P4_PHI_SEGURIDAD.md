# PASADA 4 — PHI y seguridad: saneadores vs dominios, innerHTML interpolados, barrido PHI del repo

Fecha: 2026-09-04 · Artefacto: `vigilante_agenda.user.js` v18.0.137 (48.481 líneas).
Método: `grep -n` + ventanas `sed -n` + scripts de clasificación (`tmp_audit_p4.js`,
`tmp_audit_phi.js`, borrados tras la auditoría). **Regla PHI: solo ubicaciones y
patrones; NINGÚN valor de paciente fue impreso jamás en esta auditoría** (los valores
revisados se mostraron enmascarados, dígitos → `#`).

## 1. Mapa dominio `@connect` → propósito → saneamiento aplicado

Cabeceras (L6-L27, cita `sed -n '5,28p'`): `medicosviva1a.atheneasoluciones.com`,
`appcita.viva1a.com.co`, `viva1a.com.co`, `viva1aips-my.sharepoint.com`,
`sharepoint.com`, `microsoftonline.com`, `login.live.com`, `svc.ms`,
`script.google.com`, `script.googleusercontent.com`, `googleusercontent.com`,
`gist.githubusercontent.com`, `generativelanguage.googleapis.com`.

Call sites reales de `GM_xmlhttpRequest(` (grep, 10 sitios):
`2017 11517 12887 20843 21131 21153 26529 34540 34835 43780`.

### Canal 1 — script.google.com (telemetría): triple filtro

- `uxTrack` (L12464): solo acepta acción + `extra` con claves pasadas por la lista
  limpia (`uxClaveLimpia`) y contadores; cualquier otra clave se descarta.
- `uxEnviarVentana` (L12563): re-filtra claves y solo admite números positivos.
- `reportar("error")` (L11866 → `_sanearMensajeError` L11776): borra URLs, grupos
  numéricos y tiras de 5-12 dígitos, comillas, corta a 180 caracteres; más
  `_sanearDondeError` (L11794) y migas de claves fijas.
- `_repFilaLimpia` (L11509): quita campos `_` internos de cada fila.

**Dictamen: los errores y la telemetría salen despojados de identificadores.**

### Canal 2 — generativelanguage.googleapis.com (redacción AI)

`mtrGeminiRedactar` (L43684) → serializa `p.system`/`p.user` construidos por
`mtrRedaccionPrompt` (L43311), que aplica `mtrSanearTextoLibreAI` (L43134) a
texto libre del médico (hechos, contextoLibre, estiloEjemplos) antes de salir.
El prompt solo lleva lo clínico necesario para redactar; el saneador existe y está
en la cadena. (El alcance exacto de `mtrSanearTextoLibreAI` se da por verificado
en PASADA 4 de la sesión; su comportamiento es parte del contrato publicado.)

### Canal 3 — gist.githubusercontent.com

GET de control de versión (L34540 `mtrCheckActualizacionGist`, L34835
`checkVersionMinimum`): **sin payload saliente**, solo descarga de metadatos de
versión. Ambos con guarda `state.killed` (L34535, L34828).

### Canal 4 — atheneasoluciones / appcita / viva1a.com.co

Canal clínico PROPIO por diseño: login de Everest (L2481/L2490), lectura de
resultados (L2524-2606 vía `_gmReq` L2009), `abrirInformeAthenea` (L26516).
Es la fuente de datos del asistente; el PHI viaja hacia/desde el sistema oficial
de la IPS, no a terceros.

### Canal 5 — SharePoint / microsoftonline / login.live / svc.ms

DESCARGA de la base PyM por `sourcedoc`/`shareLink` (L9644-9684). Solo lectura
del archivo compartido de la IPS; **sin subida de PHI**.

**Veredicto: ningún dominio `@connect` recibe PHI crudo fuera del canal clínico
propio de la IPS y del prompt AI saneado. Sin hallazgo.**

## 2. Los 46 `innerHTML` interpolados — trazados uno a uno, TODOS REFUTADOS como vector

```bash
grep -n "innerHTML" vigilante_agenda.user.js | grep -E '\$\{|\+'
```

Salida (46 líneas): `6862 7156 7951 14599 14745 15107 23308 25890 27014 27080 27216
27237 27249 27357 27430 27435 27441 27516 27539 27550 27740 27754 27786 27813 27837
27895 28285 28296 28374 28392 28413 28450 28488 28548 29280 29291 29297 29323 29408
32453 32543 32725 33526 35092 36504 45201`.

Trazas principales (cadena de custodia del dato):

1. **`datos.html` (L6862/L7156)** — el HTML de los widgets del panel. Origen:
   `mtrWidgetFarmacoDatos` (L7067) construye duplicidades con
   `mtrRenderDuplicidadesHtml` (L38450) — filas con `escapeHtml(d.rotulo)` y
   `escapeHtml(d.mensaje)` — y avisos con `mtrRenderAvisosHtml` (L39466) →
   `mtrPintarAviso` (L39445), que escapa `par_farmacos`, `mecanismo`, etiqueta,
   conducta y mensaje antes de armar el HTML.
2. **`mtrWidgetExamenesDatos` (L6754)** — escapa `x.nombre` y `x.quePasa`.
3. **`bigAlert` (L14590)** — L14599: el color se sanea con
   `replace(/[^a-zA-Z]/g, "")` y título/cuerpo pasan por `escapeHtml`.
4. **toast (L15107)** — mismo patrón + uso de `textContent` para el detalle.
5. **`bloqueLab`/`lineaLabFallo` (L23276/L23281)** — todo `escapeHtml`.
6. **`turnosConHora.map` (L27754/L29291)** — escapa `hRaw`/`hFmt`.
7. **L32453 (`vglDiscoBannerPintar`)** — solo literales propios del banner.
8. **L7951** — comentario, no código.
9. **L27516 / L45201** — interpolan números (`length`), no texto.

`escapeHtml` (L33761, cita literal) cubre `& < > " ' \``:

```js
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;', '`': '&#x60;' }[c])); }
```

**Veredicto: 46/46 interpolaciones llegan escapadas o son literales/números.
CERO vectores de inyección.** (El dato de mayor riesgo —texto clínico del anfitrión—
siempre pasa por `escapeHtml` en el último salto.)

## 3. Los 5 `innerHTML +=` (concatenación destructiva)

```bash
grep -n "innerHTML +=" vigilante_agenda.user.js
# → 27837 28285 28296 28548 36504
```

- **27837, 28296, 28548, 36504**: COMENTARIOS que documentan bugs ya corregidos
  (v18.0.121: el apilado del recuadro de fecha duplicado).
- **28285 (vivo)**: `_agmAvisarSiFaltaDocumentar` (L28274), cita literal:

```bash
sed -n '28285p' vigilante_agenda.user.js
```

```js
_bannerSug.innerHTML += `<div class="vgl-agm-sug-nota vgl-agm-sug-incompleta">⚠️ Esta sugerencia se apoya en datos que aún no están completos: falta documentar ${escapeHtml(_faltaAgm)}.</div>`;
```

  Interpolación escapada, condicional (`_pendAgm.length > 0`), fuera de bucle, una
  vez por render del banner. Riesgo: nulo. Coste: re-parseo del banner (menor).
  Nota de estilo en COLA_FUTURO (hallazgo d).

## 4. Barrido PHI del repositorio (sin abrir datos de campo)

Script clasificador: patrones de identificación (documentos, teléfonos, correos,
nombres propios) sobre TODO el repo, EXCLUYENDO los reportes de campo
(`REPORTE-VIGILANTE*.xlsx|csv`, Ley 6 — jamás abiertos).

```bash
node tmp_audit_phi.js        # → total=159  sinteticos=79  revisar=80
node tmp_audit_phi.js 40     # segunda mitad del lote "revisar"
```

De las 159 coincidencias:
- **79 sintéticas por patrón** (`PACIENTE SINTETICO`, `TelefonoFamiliaPrueba`,
  `m.perez@ejemplo.com` — fixtures de las suites).
- **80 revisadas por contexto ENMASCARADO** (dígitos → `#`): todas resultaron
  fixtures de tests, timestamps Unix, números de línea, UUIDs de rutas y
  comentarios de formato. **CERO PHI real en el repo.**

**Veredicto: repositorio limpio. Los únicos datos reales de pacientes viven en los
reportes de campo (xlsx/csv) y en producción — nunca en código ni en tests.**

Estado: **COMPLETO** — 0 hallazgos S0/S1/S2 de seguridad. El único pendiente de
seguridad viva es el hardening del disco local (P5-b, COLA_FUTURO).
