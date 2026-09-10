# REGISTRO MAESTRO — Enjambre de arranque (auditar y controlar el inicio de ejecución)

> Dueño: SA-AUD. Solo append · ID único (AB-###) · vocabulario de estado cerrado
> (reportado/aceptado/en-cola/arreglado/descartado-con-motivo) · toda fila de otro
> subagente se conserva íntegra en conflictos. Encargo: `SUPERPROMPT_ENJAMBRE_ARRANQUE.md`.

## 0. BASELINE CONGELADA (FASE 0 — 2026-09-06)

| Dato | Valor | Evidencia (comando) |
|---|---|---|
| Commit auditado | `8aeff8f` (v18.3.6, publicado en gist) | `git log --oneline -1` en wt-barrera |
| Artefacto congelado | `AUDITORIA/baseline_1836_user.js` — blob canónico **LF**: 3.337.528 B, sha256 `379F9691675873EE90FDD2B1B546BC6E6338F53E2B461107247CDC6031300C5C` | `git show 8aeff8f:vigilante_agenda.user.js` (extraído byte a byte con node) |
| Forma CRLF (worktree/gist) | 3.388.806 B, sha256 `C332A89E43D64AB4D5969FBAA8F5E639F1B716F610E0C1FF1EAB96F81B43DBB5` | verificación del release 18.3.6 (gist raw ≡ local, 2 corridas) |
| Líneas | 51.287 | recuento de sesión de release |
| Banco 18.3.6 | **3.400/0** (protocolo suite-por-suite, corrida parcial 36 suites + 23/30/75/78/82 individuales) | `tests/INFORME_MUTACIONES.md` §v18.3.6 |
| E2E 18.3.6 | **6/6** (compuerta monta + fail-closed desconocido) | `npm run test:e2e` |

**Regla de F1:** todo el análisis cita líneas del ARTEFACTO CONGELADO
(`AUDITORIA/baseline_1836_user.js`), no de los worktrees vivos (ver AB-001).

### Anclas §1.1 verificadas contra el congelado (grep 2026-09-06)

| Pieza | Línea (congelado) |
|---|---|
| Carga padrón `vgl_acceso_lista` | 10594 · refresco 10602-10634 |
| `accesoPerfil()` / `accesoCap()` | 10668 / 10693 |
| Caché identidad `MTR_IDENTIDAD_MEDICO_KEY` | 21147 |
| `_vglRetirarMonitorPorPerfil()` (re-visa tick) | 35116 (uso: 35163) |
| Gate boot «centinela» | 36577 |
| `TERMINOS_VERSION` / `TERMINOS_GM_ACEPTA` | 36797 / 36798 |
| `mtrLoginDeSesion()` | 36991 |
| `mtrCompuertaPerfil()` | 37019 |
| `mtrConsentimientoAceptado()` / `mtrTerminosRechazoFresco()` | 37055 / 37058 |
| `mtrCompuertaSinIdentidad()` / `mtrCompuertaDecision()` | 37074 / 37085 |
| `mtrCompuertaDiagnostico()` (GM `vgl_compuerta_diagnostico`) | 37346 |

## 1. TABLA DE TAREAS

| Tarea | Subagente | Descripción | Estado | PR |
|---|---|---|---|---|
| F0 | SA-AUD (orquestador) | Baseline congelada + registro creado + anclas verificadas | cerrado | — |
| F1-identidad | SA-IDEN | Ciclo padrón/identidad + matriz de errores (¿error≠exclusión hoy?) | cerrado | — |
| F1-acceso | SA-ACC | Estados motivo→UI→ejecución + capacidades por perfil | cerrado | — |
| F1-rastro | SA-AUD | Inventario de rastros existentes + brechas vs cadena §5 | cerrado | — |
| F2-identidad/acceso | SA-ACC + SA-IDEN | Diseño clasificador 5 estados + perfil GENERAL + cierre AB-006 | cerrado | — |
| F2-cadena | SA-AUD | Diseño cadena §5 + verificador + export tablero | cerrado | — |
| F3/F4 | SA-ACC/SA-IDEN/SA-TERM/SA-AUD | Implementación (8 PRs ordenados, ver §5) | cerrado 2026-09-07 (PR-1..PR-8, §6) | — |
| F5/F6 | los 4 | Revisión cruzada + informe | F5 cerrado (§6bis, 1 hallazgo nuevo AB-019) · F6 emitido (§7, condicionado) | GATE-C (dueño): release |

## 2. HALLAZGOS

| ID | Fecha | Subagente | Severidad | Archivo:Línea | Hallazgo | Evidencia (comando/cita) | Estado | PR |
|---|---|---|---|---|---|---|---|---|
| AB-001 | 2026-09-06 | SA-AUD | S3 | wt-barrera (entorno) | Frente concurrente: la auditoría élite (encargo hermano) trabaja AHORA en `wt-barrera` sobre la rama nueva `claude/auditoria-elite-1836` con el archivo de producto MODIFICADO SIN COMMIT (+863 B, sha worktree `E76E2BF1…` ≠ baseline). Este enjambre congela `8aeff8f` y audita el artefacto congelado; F3 deberá rebasear sobre lo que esa rama deje en punta — jamás editar el worktree mientras esté sucio. | `git status`/`Get-FileHash` en wt-barrera 18:23 | reportado | — |
| AB-002 | 2026-09-06 | SA-AUD | S4 | repo principal | Repositorio principal sucio (35+ modificados sin commit, herencia AE-002 de la auditoría élite): el registro y artefactos de este encargo viven aquí SIN tocar ese árbol; nada se commitea sin orden del dueño. | `git status --porcelain` (repo principal) | reportado | — |
| AB-003 | 2026-09-06 | SA-AUD | S3 | e:\CENTINELA\vigilante-agenda-everest\AUDITORIA\baseline_1836_user.js | Extracción byte-fiel requiere node/execFileSync: el redirect de PowerShell 5.1 re-codifica UTF-8 con BOM (primer intento sha `48060662…`, descartado) y el redirect nativo re-codifica. El congelado vigente fue extraído con `execFileSync` (buffer puro). | `_f0_extract.js` (borrado tras uso) | descartado-con-motivo (incidente de proceso documentado; artefacto final verificado) | — |
| AB-004 | 2026-09-06 | SA-IDEN | S1 | baseline:37101 (37102 worktree) | Cajón de sastre: TODO perfil PÚBLICO con identidad conocida cae en `fuera-del-padron` sea cual sea la causa — red caída, timeout 12 s, respuesta corrupta, caché de padrón corrupta (L10696-10698), lista vacía "válida" (L10587) o excepción tragada (L37040). El vocabulario de motivos NO tiene estado "no confirmable" → requisito 5 roto: error de consulta = exclusión. | Informe F1-SA-IDEN §B filas (a)-(f) | reportado | — |
| AB-005 | 2026-09-06 | SA-IDEN | S1 | baseline:37096 | Sin login de sesión legible, `mtrCompuertaSinIdentidad() && mtrLoginDeSesion()` es falso → L37101 acusa exclusión a quien NO se pudo identificar; el propio diagnóstico registra la contradicción (`motivo:fuera-del-padron, login:no`). | Informe F1-SA-IDEN hallazgo 2 | reportado | — |
| AB-006 | 2026-09-06 | SA-ACC | S2 | baseline:36581, 37098, 35160-35166 | `sin-identidad-aceptado` monta el panel COMPLETO para un posible PÚBLICO: el gate de boot() (L36576) solo bloquea con identidad YA conocida; sin identidad, buildOverlay() corre entero y el retiro es diferido al tick que siga a la resolución — si `GetUsuarioPerfil` falla persistentemente, la UI completa queda indefinidamente (reintento cada 30 s L35526-35529). «PÚBLICO no construye UI» solo es verdad DESPUÉS de resolver. Es el hueco exacto del requisito 3 (hoy: o nada o TODO). | Informe F1-SA-ACC hallazgo 2 | reportado | — |
| AB-007 | 2026-09-06 | SA-AUD | S1 | TABLERO/Codigo.gs:185-193 (copia sin commit) | El receptor del tablero rechaza TODA la telemetría `obs.*`: `EVENTOS_VALIDOS` no incluye el prefijo `obs.` → doPost "no" → cliente descarta la fila a los 3 intentos. La observabilidad P13 completa se pierde en silencio si esta copia se despliega (misma clase que D4/v17.49.0). | Informe F1-SA-AUD hallazgo 1 | reportado | — |
| AB-008 | 2026-09-06 | SA-AUD | S2 | baseline:37258-37264 | El RECHAZO de términos solo deja `vgl_terminos_rechazo={ts}` — sin identidad, sin versión, sin remoto: "quién rechazó cuándo" es irreconstruible por diseño P11 deliberado. Conflicto directo con el requisito 4 tal como está redactado: resolver EXPLÍCITAMENTE (decisión del dueño), no de facto. | Informe F1-SA-AUD hallazgo 2 | reportado | — |
| AB-009 | 2026-09-06 | SA-AUD | S2 | baseline:37346-37359 | Diagnóstico de compuerta single-slot: cada incidencia PISA la anterior (sin historia), nunca lo lee el código, sin export — la evidencia de denegación muere en el equipo. | Informe F1-SA-AUD hallazgo 3 | reportado | — |
| AB-010 | 2026-09-06 | SA-AUD | S3 | baseline:12067; Codigo.gs:184,766-796 | Sin inmutabilidad detectable (GM pisable; la Hoja tiene menús que borran/reescriben filas; solo FNV-1a 32 bits no criptográfico, L51016-51021) y el token del tablero viaja en claro dentro del userscript distribuido → «accesible solo a personal autorizado» no se cumple en escritura. | Informe F1-SA-AUD hallazgos 4-5 | reportado | — |
| AB-011 | 2026-09-06 | SA-IDEN | S2 | baseline:10696-10698, 10682 | Caché de padrón corrupta (JSON.parse lanza → null) + identidad presente → exclusión del médico AUTORIZADO; la gracia de 12 h no lo respalda porque exige `!uid && !nombre` (D2). | Informe F1-SA-IDEN hallazgo 3 | reportado | — |
| AB-012 | 2026-09-06 | SA-IDEN | S2 | baseline:10586-10588 | Lista con arreglos VACÍOS pasa `accesoListaValida` (`every` de vacío = true) → si el tablero sirve una hoja vacía, exclusión global silenciosa. | Informe F1-SA-IDEN hallazgo 4 | reportado | — |
| AB-013 | 2026-09-06 | SA-IDEN | S3 | baseline:37366, 10608-10614 | El reintento de padrón tras `fuera-del-padron` es NO forzado: con sello ok <4 h ni reconsulta; la lista misma no tiene TTL → un médico recién añadido al tablero sigue excluido hasta 4 h o hasta refresco manual en Ajustes. | Informe F1-SA-IDEN hallazgo 5 | reportado | — |
| AB-014 | 2026-09-06 | SA-IDEN | S3 | baseline:37364 | El motivo `excepcion:*` es código muerto en la práctica: toda función de la decisión tiene catch interno hacia PÚBLICO/true, así que ninguna excepción llega a etiquetarse como tal. | Informe F1-SA-IDEN hallazgo 6 | reportado | — |
| AB-015 | 2026-09-06 | SA-ACC | S3 | baseline:37365-37368 | La ruta fuera-del-padron refresca el padrón por RED ANTES de cualquier consentimiento (fix deliberado del deadlock v18.3.1, L37325-37337, sin PHI). Contradice la lectura estricta de «nada sale antes del sí» (L37012-37015). Matiz del requisito 1, no regresión. | Informe F1-SA-ACC hallazgo 1 | reportado | — |
| AB-016 | 2026-09-06 | SA-IDEN/SA-ACC | S4 | baseline:31784,31834,1151,1161,35117,37023,37366+13500,10644-10651 | Menores agrupados: listeners pasivos pre-compuerta (inertes sin UI, no los retira el retiro por perfil); LEADER_KEY no limpiado al retirar (expira por TTL); reinterno de padrón puede demorar el arranque hasta 12 s; desviación documentada SharePoint→COMPLETO sin evaluar padrón; `vgl_acceso_ultimo_ok` guarda perfil sin uid; sin política de retención (aviso deja purga 12 m como pendiente). | Informes F1 §C/§D | reportado | — |
| AB-017 | 2026-09-06 | SA-ACC (dictamen) | S3 | — (ausencia) | Requisito 2: las «notificaciones personalizadas sobre normativas sanitarias» para el médico verificado NO EXISTEN en absoluto (no hay mecanismo, ni contenido, ni fuente citada). Gap de funcionalidad, no defecto. | Informe F1-SA-ACC §D | reportado | — |
| AB-018 | 2026-09-06 | SA-AUD (F2) | S3 | Codigo.gs doGet L180, L353 | Riesgo de LECTURA del padrón: `doGet ?accion=listaAcceso` responde la lista completa de médicos a cualquiera que extraiga el token (que viaja en claro en el userscript distribuido, AB-010). La mitigación de token→PropertiesService no cierra la lectura. Queda abierto a decisión del dueño (p. ej. lista por doPost firmado o denegación por defecto). | Diseño F2-SA-AUD §4 | reportado | — |
| AB-019 | 2026-09-07 | SA-TERM (F5.3) | S3 | vigilante_agenda.user.js TERMINOS_TEXTO (sección «El registro de arranque»); TABLERO/Codigo.gs v12.11.0 | El aviso 1.2 promete «La bitácora no sale del equipo», cierto HOY (no existe emisor), pero PR-8 ya preparó el tablero para recibirla (evento "arranque"). El PR futuro del emisor debe decidir: (a) la cadena NUNCA se envía automáticamente (solo export manual del médico), o (b) esa frase se reescribe con bump 1.2→1.3 y re-pregunta global. No puede decidirse de facto. | F5 §6bis.3 | reportado | — |
| AB-020 | 2026-09-07 | SA-AUD (pre-GATE-C) | **S2** | `claude/enjambre-arranque`@`9f9d2c3` vs `claude/sf-simulacion-flujos`@`5529981` | **Colisión de versión de términos**: DOS textos legales distintos reclaman `TERMINOS_VERSION "1.2"` en dos líneas vivas del mismo repo — el nuestro (GATE-B: registro de arranque + rechazo pseudonimizado) y el de SUPERPROMPT_TERMINOS_BLINDAJE (anonimización del creador, cláusulas T-38…T-42, commit 5529981 en el checkout principal, SESIÓN ACTIVA y árbol sucio). Al integrar, la segunda línea en fusionar romperá la constancia de TODOS los médicos (re-pregunta doble) o pisará el texto ajeno en silencio. La base propia (`claude/auditoria-elite-1836`@`6477423`) NO se movió: el rebase del enjambre contra su base declarada ya está al día; rebase contra la línea hermana NO ejecutado a propósito (árbol en movimiento + decisión semántica que es del dueño). | `git show 5529981` (TERMINOS_VERSION="1.2" con texto distinto); §7.2.5 | **decidido** — el dueño eligió «enjambre primero» (2026-09-07): el enjambre publica con su 1.2 (GATE-B sellado); la línea sf re-numera a 1.3 cuando integre | — |

## 3. MATRIZ DE BRECHAS F1 — requisito × estado real (consolidación del orquestador)

| Req. | Veredicto | Qué existe hoy | Brechas (hallazgos) |
|---|---|---|---|
| **1. Términos obligatorios antes de todo; negación ⇒ bloqueo + registro** | **CUBIERTO con matices** | Pantalla de términos sin red ni lectura de página (verificado L37134-37212); negación ⇒ `rechazo-fresco` (silencio + tarjeta informativa una vez); aceptación ligada a `TERMINOS_VERSION`+id | Matiz: refresco de padrón pre-consentimiento en la ruta fuera-del-padron (AB-015, deliberado). Registro de negación inexistente (AB-008) |
| **2. Médico verificado ⇒ interfaz completa + notificaciones normativas** | **PARCIAL** | `aceptado` → boot íntegro, panel COMPLETO/LABORATORIOS con 12 capacidades (matriz SA-ACC §B) | Las notificaciones normativas personalizadas NO EXISTEN (AB-017); falta contenido con fuente citada |
| **3. Identidad NO confirmable ⇒ acceso general sin funciones restringidas** | **NO CUMPLE — roto por AMBOS extremos** | Motivo `sin-identidad-aceptado` con `arrancar:true` existe | (a) Los ERRORES de consulta terminan como `fuera-del-padron` = exclusión TOTAL, no acceso general (AB-004/005/011/012). (b) `sin-identidad-aceptado` monta el panel COMPLETO — demasiado acceso (AB-006). No existe perfil GENERAL ni montaje parcial |
| **4. Auditoría inmutable de TODO (aceptar/negar, intentos, verificación, ejecución)** | **NO EXISTE** | `vgl_terminos_acepta` (quién aceptó, sin historia), `vgl_compuerta_diagnostico` single-slot, cola remota con agregados diarios (`acceso`, `acceso_deneg`) | Sin cadena hash-previa, sin verificador, single-slot pisable (AB-009), rechazo irreconstruible (AB-008), sin inmutabilidad detectable + token en claro (AB-010), tablero rechaza `obs.*` (AB-007) |
| **5. Error de consulta ⇒ flujo general automático + log del error** | **NO CUMPLE** | Único matiz: la identidad recién-instalada sí se distingue (L37096-37099) y hay reintento de padrón L37366 | Las 6 vías de fallo (NetErr, timeout 12 s, corrupto, lista vacía/caducada, login ilegible, excepción) terminan en `fuera-del-padron` (AB-004); `excepcion:*` es código muerto (AB-014); reintento no forzado (AB-013) |

## 4. DISEÑO F2 APROBADO (resumen ejecutivo — diseños completos en los informes de los subagentes, sesión 2026-09-06)

**Flujo (SA-ACC/SA-IDEN):** clasificador puro nuevo de 5 estados (`accesoClasificar`/`accesoPerfilMotivo`, ~L10658) que distingue EXCLUSIÓN real (`fuera-del-padron` SOLO con lista legible + identidad conocida + no miembro) de NO-CONFIRMABLE (`identidad.no-confirmable` + causa: sin-conexion/timeout/respuesta-corrupta/padron-no-disponible/sin-login/excepcion, propagada por `_sellar(ok, causa)` al sello y al diagnóstico GM). Perfil GENERAL = **0 de 13 capacidades** (ni `pym`/`psic_odonto`: ambas tocan datos de pacientes), UI nueva mínima `#vgl-general` (fuera de buildOverlay, cssText inline con `!important`, patrón de la pantalla de términos) con causa/identidad/versiones/botón-reintentar; ticker 30 s que promociona EN VIVO a COMPLETO al resolverse la identidad o se retira en silencio ante exclusión confirmada. **Cierre AB-006:** el motivo `sin-identidad-aceptado` SE RETIRA; `_terminosAlAceptar` (L37255) re-decide vía `mtrCompuertaArranque()` en vez de llamar `mtrArrancarTodo()` directo. Gracia 12 h extendida: identidad conocida + lista inservible → mantiene perfil (tablero caído no degrada a un médico confirmado).

**Cadena (SA-AUD):** eslabones `{i, ts, evento, motivo, perfil, sujeto, detalle, prev, hash}` con `hash=SHA-256(prev+canon)` vía `crypto.subtle` (nunca FNV-1a — AE-009); sujeto ∈ {`uid:N`, `psd:<16hex>` (HMAC con clave por equipo GM, patrón L32502-32518), `""`}; cola asíncrona con crudos persistidos en `vgl_auditoria_pendientes` (jamás bloquea el arranque); rotación 400 eslabones/200 KB con resúmenes de tramo; retención 3 tramos + resúmenes permanentes; verificador `tools/verificar_cadena_arranque.js` (node sin deps, implementación INDEPENDIENTE de WebCrypto) + botón en Resumen (verifica in-browser Y descarga JSON); export por lotes ≤60 eslabones por la cola `reportar` existente a hoja nueva `arranque` del tablero con re-saneo server-side; **orden de despliegue: tablero ANTES que userscript** (anti-AB-007), declaración `eventos:"arranque"` en doGet para que nada muera en silencio.

**Decisión operativa incluida en GATE-B:** resolver AB-008 (rechazo con pseudónimo `psd`) exige cambiar el texto de la pantalla de rechazo ⇒ **`TERMINOS_VERSION` 1.1→1.2 ⇒ re-pregunta global de términos a TODOS los médicos** en la próxima publicación. Es una sola bump que agrupa cadena + aviso de privacidad.

**Orden de implementación (8 PRs, cada uno verde y rebasado antes del siguiente; SOLO cuando el worktree vuelva a estar limpio — AB-001):**
PR-1 causa en diagnóstico (aditivo) · PR-2 clasificador 5 estados (sin enrutar GENERAL) · PR-3 perfil GENERAL + cierre AB-006 (mayor riesgo) · PR-4 reintento/UX del banner · PR-5 E2E estilos del banner · PR-6 cadena local + suite_85 · PR-7 verificador + botón · PR-8 tablero (Codigo.gs: hoja arranque, token→PropertiesService, doGet eventos) desplegado ANTES que el userscript emisor.

## 5. SELLOS DE GATES

| Gate | Fecha | Decisión | Voz |
|---|---|---|---|
| GATE-0 | 2026-09-06 | Arrancar enjambre: F0+F1 (matriz de brechas antes de cualquier diseño) | Dueño (sesión Trae, pregunta directa) |
| GATE-A | 2026-09-06 | **Opción A — perfil GENERAL**: error de consulta de identidad/padrón ⇒ motivo `identidad.no-confirmable` + perfil GENERAL con UI limitada (términos/identidad/versión) SIN lectura de agenda, PyM, disco ni IA. Cierra ambos extremos del requisito 3: ni exclusión injusta (AB-004/005) ni panel completo al no-confirmado (AB-006). Línea roja confirmada: GENERAL jamás lee datos de pacientes | Dueño (sesión Trae, pregunta directa) |
| GATE-B | 2026-09-06 | **Aprobada la implementación F3/F4 completa (8 PRs del §4) + bump `TERMINOS_VERSION` 1.1→1.2 con re-pregunta global** (aviso honesto de la cadena + rechazo pseudonimizado `psd`). Terreno: worktree propio aislado del enjambre élite (AB-001); cada PR verde+mutado+rebasado antes del siguiente | Dueño (sesión Trae, pregunta directa) |

## 6. AVANCE F3/F4 (implementación — se actualiza por PR)

Rama `claude/enjambre-arranque` (worktree `wt-arranque`), base `6477423` (18.3.7, banco 3.402/0).

| PR | Fecha | Commit | Contenido | Estado |
|---|---|---|---|---|
| PR-1 | 2026-09-06 | `e20e680` | `accesoListaEstado` + `_accesoCausaDeError` + `_sellar(ok, causa)` + diagnóstico hereda causa. Suite_78 35→38, mutación 593. Banco 3.405/0. | verde |
| PR-2 | 2026-09-06 | `1ff5ff3` | `accesoClasificar` puro de 5 estados (error ≠ exclusión; `fuera-del-padron` solo con padrón legible), guard GENERAL en `accesoCap` (0/13 capacidades), arranque y `repAccesoDiario` usan el mismo clasificador; `apiRecordar` guard B4 solo-BLOQUEADO (aprender URL ≠ leer pacientes). Suite_78 38→41, matriz suite_80 4×13→5×13, arrastre suites 19/20/34 resuelto, mutaciones 594/595. Banco 3.408/0. | verde |
| PR-3 | 2026-09-06 | `92e33e6` | Modo GENERAL real: retiro de `sin-identidad-aceptado` (AB-006); rama GENERAL en `mtrCompuertaDecision` con causa; `mtrArrancarGeneral`/`buildGeneral` (banner `#vgl-general`, sin boot()); ticker 30 s con promoción en vivo/retiro silencioso; `_terminosAlAceptar` re-decide; rescate extendido a no-confirmable con sesión; diagnóstico R5 sello-primero. Suite_82 actualizada, suite_78 caso sello→diagnóstico, suite NUEVA suite_85 (6 casos). Mutaciones 596/597. Banco 3.414/0. | verde |
| PR-4 | 2026-09-06 | `1badd6e` | «Reintentar ahora»: botón del banner que fuerza el padrón (ignora sello 4 h, salida manual del limbo AB-013) y re-decide al terminar; `_generalConsultar(forzado)` compartido; `_generalCausaPintar` repinta la causa si cambió. Suite_85 6→9. Mutaciones 598/599. Banco 3.417/0. | verde |
| PR-5 | 2026-09-06 | `4cfb735` | E2E escenario 5: banner GENERAL en Chromium real con `getComputedStyle` (color !important, fixed+centrado, z-index, botón, línea roja en el DOM, clic con red caída). Hallazgo: seed del E2E sembraba la identidad como STRING (roto desde 18.3.6, enmascarado por sin-identidad-aceptado) — corregido a objeto. E2E 17/0, mutación 600. | verde |
| PR-6 | 2026-09-06 | `b145647` | Cadena de auditoría local (§5): eslabones `{i,ts,evento,motivo,perfil,sujeto,detalle,prev,hash}` con `hash=SHA-256(prev+canon)` vía `crypto.subtle` (jamás FNV-1a sin sal — AE-009), sujeto `uid:N` o `psd:<16hex>` HMAC-SHA-256(login, clave del equipo) sin `_equipoId()` (hallazgo propio: emitía red antes del consentimiento — P11/AB-015), vocabulario de 13 eventos, cola asíncrona, rotación 400/200 KB con `hash_cierre` por tramo. `TERMINOS_VERSION` 1.2 con re-pregunta global (GATE-B): sección «El registro de arranque» + rechazo pseudonimizado (AB-008). Suite_86 nueva (7), 82/85 a 1.2. Mutaciones 601/602. Banco 3.424/0 (por lotes, protocolo suite-por-suite). | verde |
| PR-7 | 2026-09-06 | `673c30d` | Verificador de la cadena (§5.4 — cadena sin verificador = cadena decorativa): `tools/verificar_cadena_arranque.js` (node sin deps, SHA-256 independiente con `crypto` de node, valida tramos desde i=1 + ancla desde `hash_cierre` + numeración global, declara el PRIMER eslabón roto; acepta export del botón o volcado crudo TM) + `mtrAudVerificar()` en vivo (crypto.subtle, fail-closed, cadena vacía JAMÁS verde) + botón «Verificar» en hoja Resumen (`verificarCadenaArranqueUi`: veredicto en #vgl-sum, descarga JSON, sello `auditoria.export`, cero red — §5.5). Suite_87 nueva (6) con la mutación canónica del encargo (ts alterado → ROTA con el i exacto) como prueba permanente. Mutaciones 603/604. Banco 3.430/0 (por lotes). | verde |
| PR-8 | 2026-09-06 | `f715eee` | Tablero v12.11.0 — aprende a recibir la cadena ANTES de que exista emisor (anti-AB-007: emisor sin receptor = evidencia perdida en silencio). Evento "arranque" (lote de eslabones → hoja `arranque`, UNA fila por eslabón, setValues de un golpe, saneo `_celda`/`_sinDigitosLargos`, tope 500, dedupe por lote; registra TAL CUAL sin validar hashes — la Hoja es evidencia, el verificador es el juez) + GET `?accion=eventos&tipo=arranque` (últimas 1000 por NOMBRE de columna, auditoría autorizada — misma excepción mínima que listaAcceso) + TOKEN→PropertiesService con respaldo (mitigación parcial AB-010; AB-018 sigue abierto) + "arranque" en `limpiarDuplicados`/`repararVersionesCorruptas`. `simulacion_local.js` + bloque PR-8 (7 grupos). Mutaciones 605/606. **Pendiente: DESPLEGAR el tablero antes de publicar cualquier userscript emisor.** | verde (código) · pendiente despliegue |

## 6bis. F5 — REVISIÓN CRUZADA (nadie se certifica a sí mismo) — 2026-09-07

Cuatro re-auditorías sobre la punta `f715eee`, con evidencia citada (archivo:línea):

1. **SA-ACC re-audita a SA-AUD (¿la cadena cambia algún flujo de acceso?): SIN HALLAZGO.**
   Los 11 puntos de emisión (`mtrAudEncolar`, L37324/37371/37387/37446/37585/37716/37837-37840)
   son sentencias sueltas `try { … } catch (e) {}` sin valor de retorno; ningún `if`
   consulta a la cadena; la cola es asíncrona y `_audProcesar` traga todo. La cadena no
   puede frenar, acelerar ni alterar un arranque — es observabilidad pura.
2. **SA-AUD re-audita a SA-ACC/SA-IDEN (¿ruta sin evento? ¿PHI?): SIN HALLAZGO.**
   Los ganchos corren tras la decisión FINAL y antes de TODA bifurcación (L37834-37841):
   arranque→general (`acceso.general` L37585), arranque→todo (`acceso.concedido` +
   `script.ejecucion` L37446), pantalla términos (`terminos.presentado` L37324 al pintar,
   `aceptado`/`rechazado` en sus botones) y silencio (bloqueado/rechazo-fresco/excepción:
   `arranque.intento` ya selló el veredicto con motivo y causa). Cero PHI verificado por
   suite_86·5 (ni nombre, ni login, ni documento en toda la cadena) y por construcción
   (sujeto uid/psd).
3. **SA-TERM re-audita los textos prometidos (§5.6 inmutabilidad honesta): 1 HALLAZGO (AB-019).**
   El aviso 1.2 declara la garantía exacta: «borrar o editar una línea se puede detectar —
   no es imposible hacerlo… La garantía es de detección, no de imposibilidad» (TERMINOS_TEXTO,
   sección «El registro de arranque»), el rechazo pseudonimizado y la exportación por el
   propio médico — todo cumple. PERO la misma sección promete «La bitácora no sale del
   equipo»: CIERTO hoy (no existe emisor), y PR-8 ya preparó el tablero para recibirla.
   Cuando llegue el PR del emisor, o la cadena NO se envía nunca automáticamente, o esa
   frase hay que reescribirla con otro bump de TERMINOS_VERSION. Decisión del dueño, no de
   facto (ver AB-019).
4. **SA-IDEN re-audita que ningún error quedó como exclusión (§4): SIN HALLAZGO.**
   `accesoClasificar` (L10706): las tres ramas de fallo devuelven `{perfil: GENERAL,
   motivo: identidad.no-confirmable, causa}` — L10722 (padrón ilegible), L10726 (sin
   login), L10730 (excepción) — jamás `fuera-del-padron`, que exige padrón legible +
   identidad conocida. Matriz 5×13 de suite_80 verde en el banco 3.430/0.

## 7. F6 — INFORME FINAL (SA-AUD, 2026-09-07) — CERTIFICACIÓN **CONDICIONADA**

Nunca optimista: esto es lo que está hecho y verificado, y lo que NO lo está.

### 7.1 Estado verificado de la implementación

| Requisito del encargo | Estado | Evidencia |
|---|---|---|
| R1 · Términos obligatorios, bloqueo al rechazar | **Cumplido** (ya existía P11; ahora el rechazo queda sellado con seudónimo) | suite_82 (23/0), suite_86·6, TERMINOS_VERSION 1.2 + re-pregunta global |
| R2 · Verificación contra lista oficial | **Cumplido** (clasificador 5 estados contra el padrón del tablero; causa en diagnóstico) | PR-1/PR-2, suite_78 (41/0), suite_80 (matriz 5×13) |
| R3 · No confirmable ⇒ acceso GENERAL sin funciones médicas | **Cumplido — línea roja GATE-A respetada** (banner sin boot(), 0/13 capacidades, jamás lee pacientes; verificado en Chromium real) | PR-3/PR-4/PR-5, suite_85 (9/0), E2E 17/0 |
| R4 · Bitácora segura/inmutable (4 subagentes, registros) | **Cumplido en lo local** (SHA-256 encadenado, pseudónimos con sal, vocabulario cerrado, verificador independiente, export sellado) | PR-6/PR-7, suite_86 (7/0), suite_87 (6/0), herramientas 601-604 |
| R5 · Error de consulta ⇒ flujo general + registro del error | **Cumplido** (error ⇒ GENERAL con causa; identidad.no-confirmable sellado) | PR-2/PR-3, suite_80, suite_86·5 |

**Banco:** 3.430/0 (suite-por-suite, 91 suites) sobre `f715eee`+etiqueta E2E (`9f9d2c3`).
**E2E (Chromium real):** 17/0 sobre la MISMA punta (re-corrido para este informe).
**Mutaciones:** 593-606, todas cazadas (rojo), restauradas y verificadas (verde),
transcritas en `tests/INFORME_MUTACIONES.md`.

### 7.2 Condiciones pendientes — por qué es CONDICIONADA y no total

1. **El tablero NO está desplegado.** PR-8 vive solo en el repo. Regla del encargo:
   desplegar el tablero ANTES que cualquier userscript emisor (anti-AB-007). Pasos del
   dueño: script.google.com → proyecto existente → reemplazar Código.gs → Nueva versión
   → Implementar (misma URL /exec). Opcional: fijar propiedad de script `TABLERO_TOKEN`
   para rotar el token sin tocar código.
2. **No existe userscript emisor de la cadena** (deliberado: va en un PR propio tras el
   despliegue del tablero). Hoy la cadena sale del equipo SOLO por el export manual del
   médico — que es exactamente lo que el aviso 1.2 promete (ver AB-019 antes de escribir
   ese PR).
3. **GATE-C (release) no sellado:** nada se publica (commit de release/push/gist) sin la
   voz del dueño. La rama `claude/enjambre-arranque` quedó LISTA el 2026-09-07 en el
   commit de release **`5f4c721`** (18.3.8: bump cuádruple — el guard R5.1 cazó a
   `package.json` quedado atrás y `suite_75` dejó de usar un literal de versión —,
   `docs/CAMBIOS_enjambre-arranque.md`, banco 3.430/0 y E2E 17/0 re-verificados SOBRE
   esa punta). Publicar = push + pegar el archivo en el gist secreto.
4. **Decisiones abiertas del dueño:** AB-018 (lectura del padrón por doGet: mantener,
   firmar o denegar) y AB-019 (la cadena nunca se auto-envía, o bump 1.3 del aviso).
5. **AB-020 — colisión de `TERMINOS_VERSION` "1.2"** con la línea hermana
   `claude/sf-simulacion-flujos` (v18.4.2, checkout principal, en trabajo). Verificado
   pre-GATE-C (2026-09-07): la base propia no se movió (rebase al día contra
   `6477423`); rebase contra la hermana NO ejecutado a propósito. Antes de publicar:
   decidir el orden de publicación y quién re-numera a 1.3.

### 7.3 Veredicto

**CONDICIONADA.** Los cinco requisitos están implementados, probados (banco 3.430/0,
E2E 17/0), mutados (14/14 cazadas) y revisados en cruz (F5, 3 sin hallazgo + AB-019
documentado). La publicación queda supeditada a: despliegue manual del tablero (7.2.1)
y sello explícito de GATE-C. No se certifica lo que no se desplegó.
