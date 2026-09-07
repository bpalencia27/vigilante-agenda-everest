# SUPER PROMPT — Enjambre de arranque: auditar y controlar el inicio de ejecución
## Vigilante de Agenda v18.3.6+ · «Nadie ejecuta sin decir "sí" a los términos; nadie ve lo restringido sin ser el médico del padrón; todo queda registrado»

> Documento de encargo. Lo ejecuta **un equipo de CUATRO subagentes** coordinados por
> un orquestador (Claude en sesión síncrona con la herramienta Task; máx. 4 delegaciones
> en paralelo; Jules/Gemini como satélites asíncronos, ver `jules.md`). **Una tarea por
> sesión y por subagente.**
> Misión: que el INICIO de ejecución del userscript médico sea un flujo secuencial
> auditado — términos → identidad → acceso — donde cada decisión deja rastro inmutable.
> Este documento hereda la disciplina de `SUPERPROMPT_AUDITORIA_ELITE.md` (la versión
> más reciente de este tipo de herramienta) y la especializa en la compuerta de arranque.

---

# 0. MODO DE EJECUCIÓN — cómo se corre esto

**Los subagentes no charlan entre sí: se comunican por artefactos.** Cada uno lee el
registro maestro (§6.1), añade SU sección con formato fijo, y el siguiente parte de ahí.

Cada tarea se lanza así:

> «Lee `SUPERPROMPT_ENJAMBRE_ARRANQUE.md` en la raíz del repo y ejecuta ÚNICAMENTE la
> tarea **AX** en tu rol de **SA-XXX**. Contrato de entrega: §2.X.»

### Reglas del entorno (valen para los cuatro subagentes, sin excepción)

- **Rama base: la PUNTA REAL del repositorio al F0**, verificada con `git branch -vv`
  y `origin/HEAD` — NO se asume de memoria (lección AE-001 del encargo élite: la rama
  del encargo viejo no era la punta). Hoy esa punta es `claude/v14-continuacion`
  (worktree `wt-barrera`, v18.3.6, commit `8aeff8f`). Cada PR se rebasa antes de
  abrirse (`git fetch` + `git rebase` + `node tests/runner.js` DESPUÉS del rebase).
- **El banco corre sin instalar nada:** `node tests/runner.js` (≥ 3.400 comprobaciones
  en 18.3.6). E2E real: `npm run test:e2e` (Playwright, devDependency — el producto
  sigue sin dependencias de runtime). No se añade ningún framework.
- **UN SOLO ARCHIVO.** `vigilante_agenda.user.js` es un IIFE único de ~51k líneas:
  nunca módulos ES, nunca bundler, nunca TypeScript, nunca dependencias nuevas de
  runtime. Tampermonkey instala un archivo; un `import` lo rompe.
- **PROHIBIDO REFORMATEAR.** Diff mínimo; lo demás va a «Hallazgos NO tocados».
- **Cero PHI** en código, pruebas, comentarios, commits, logs, cadena de auditoría ni
  capturas. La cadena de auditoría (§5) NO guarda cédulas ni nombres (ver AE-009).
- **Casilla vacía antes que dato inventado.** Ningún selector, endpoint, vigencia,
  festivo, artículo normativo o notificación regulatoria sin fuente citada. Lo que no
  se pueda citar queda «pendiente de fuente» — también la ley (lección AE-014).
- **Todo cambio de comportamiento = prueba nueva + mutación verificada** (romper a
  propósito, ver el rojo, restaurar, ver el verde), transcrita en
  `tests/INFORME_MUTACIONES.md` **al final de la tabla**, formato intacto. Cada
  mutación se restaura ANTES de pasar a la siguiente.
- **Comentarios en español** explicando el POR QUÉ. Código y variables en inglés.
- **Ninguna petición real** a Everest/Athenea/AppCita durante el encargo: todo con
  mocks del banco o del E2E.
- **Corridas desacopladas:** el host tiene una sesión paralela que mata procesos node
  de terminales compartidos (documentado en `AUDITORIA/REGISTRO_ELITE.md` §entorno).
  Toda corrida del banco/E2E se lanza con `Start-Process` + redirección a archivo, y
  NUNCA con `2>&1` en tubería (bloqueo documentado por N6).

### Qué hace fallar un PR aunque «las pruebas pasen»

1. El banco trae MENOS comprobaciones que la punta, o el E2E retrocede de 6/6.
2. Falta la transcripción de la mutación en la descripción del PR.
3. Un motivo/perfil/evento de auditoría fuera del vocabulario cerrado de §3/§5.
4. La cadena de auditoría (o su verificador) no existe, no encadena, o registra PHI.
5. El perfil GENERAL lee un solo dato de paciente (ver §1.3 — es la línea roja).
6. Se implementó la inversión de GATE-A sin el sello del dueño en el registro.

---

# 1. CONTEXTO INMUTABLE — lo que ningún subagente puede desconocer

Userscript de Tampermonkey que asiste a médicos de una IPS colombiana DENTRO del EHR
Everest (Athenea Soluciones). Corre EN VIVO durante consultas reales: un bug aquí
puede mostrar un dato clínico incorrecto o desplazar una cita real. Este encargo toca
la PUERTA de ese sistema: lo primero que ejecuta el script en cada máquina.

### 1.1 La compuerta que YA existe (v18.2-v18.3.6) — se parte de aquí, no de cero

Toda la barrera vive en `vigilante_agenda.user.js`; los nombres de FUNCIÓN citados son
estables, los números de línea NO (se re-verifican con grep en F0):

| Pieza | Función/clave | Comportamiento vigente |
|---|---|---|
| Versión de términos | `TERMINOS_VERSION` (="1.1") | Aceptación solo vale para la versión vigente |
| Constancia de aceptación | GM `vgl_terminos_acepta` | `{version, ts, id}` |
| Rechazo fresco | `mtrTerminosRechazoFresco()` | Denegación reciente → silencio temporal (cooldown) |
| Decisión pura | `mtrCompuertaDecision()` | Devuelve `{arrancar, pantalla, motivo}` SIN DOM ni red |
| Motivos (vocabulario cerrado) | — | `bloqueado` · `sin-identidad-aceptado` · `rechazo-fresco` · `sin-identidad` · `fuera-del-padron` · `aceptado` · `preguntar` |
| Perfiles | `mtrCompuertaPerfil()` | `COMPLETO` · `LABORATORIOS` · `PÚBLICO` · `BLOQUEADO` (capacidades vía `accesoCap()`) |
| Padrón | localStorage `vgl_acceso_lista` + refresco remoto | Lista oficial de médicos autorizados por uid |
| Diagnóstico | GM `vgl_compuerta_diagnostico` (v18.3.3) | Rastro del "no sale nada" SOLO en rutas de incidencia |
| Cap «centinela» | gate en `boot()` (v18.3.4) | Sin la capacidad no se monta `#vgl-root`; re-visa en cada `tick()` |
| Banco de la barrera | suites 78/80/82 + `tests/e2e/run_e2e.js` | Matriz motivo×estado, E2E real fail-closed 6/6 |

**Veredicto de cobertura actual contra los 5 requisitos del encargo (a confirmar en
F1, no asumir):** los requisitos 1, 2 y 5 están sustancialmente cubiertos por la
compuerta P11; el requisito 4 (cadena de auditoría inmutable de arranque) NO existe
como tal (solo el diagnóstico GM suelto); el requisito 3 está a MEDIAS: ya existe el
motivo `sin-identidad-aceptado` con `arrancar:true`, PERO el perfil resultante
(PÚBLICO) **no construye ninguna UI** — "acceso general" hoy es "acceso a nada".

### 1.2 Reglas sagradas heredadas (valen más que cualquier criterio de «calidad»)

1. Cero PHI. 2. Casilla vacía antes que dato inventado. 3. El médico manda: el script
sugiere, nunca ordena/agenda/confirma solo. 4. Un solo archivo, sin dependencias de
runtime. 5. Clases `vgl-` no se renombran. 6. CSS colgado de `body` con `!important`
en color. 7. Nunca redefinir una clase CSS existente — grep primero.

### 1.3 ⚠️ CONFLICTO CONSTITUCIONAL — GATE-A obligatorio antes de F3

El requisito 3 del dueño (acceso general cuando la identidad NO se puede confirmar)
**invierte el principio fail-closed** que este proyecto construyó a propósito en
v18.2→v18.3.4 tras incidencias reales (la constitución del repo dice: ante la duda,
no montar nada). La instrucción explícita del dueño tiene prioridad — pero por su
propio protocolo (jerarquía §7.2: seguridad clínica primero, y el impacto debe estar
informado ANTES de decidir), la inversión se ejecuta solo tras **GATE-A**, donde el
dueño elige con el análisis de impacto delante:

- **Opción A — perfil GENERAL real (lo que pide el encargo):** términos aceptados +
  identidad no confirmable → UI limitada SIN ninguna función que lea datos de
  pacientes (sin lectura de agenda, sin PyM, sin disco, sin IA, sin Athenea). La
  línea roja: el perfil GENERAL puede mostrar términos, estado de identidad, versión
  y avisos normativos — **jamás** un dato de paciente. Rationale: quien ejecuta el
  script ya está dentro del EHR (acceso institucional), pero la barrera PHI del
  asistente no se relaja.
- **Opción B — mantener fail-closed:** identidad no confirmable → sin UI (status quo
  18.3.6). El requisito 3 queda documentado como «denegado por decisión del dueño».

Ningún subagente implementa la opción A por iniciativa propia. El sello de GATE-A
(opción, fecha, voz del dueño) se registra en §6.1 antes de abrir el primer PR de F3.

---

# 2. EL EQUIPO — cuatro subagentes, cuatro fichas de rol

Solo SA-ACC y SA-IDEN modifican `vigilante_agenda.user.js` (en tareas distintas —
nunca los dos sobre la misma función en la misma tanda). SA-TERM solo toca el corpus
documental de términos/normativa y su render. SA-AUD solo toca cadena, verificador y
registro. El orquestador reparte, vigila fronteras y consolida; **SA-AUD es el árbitro
de formato del registro maestro**: nada entra sin su sello de trazabilidad.

---

## 2.1 SA-TERM — Subagente de Términos y Condiciones

**Misión:** que NADIE ejecute nada sin haber visto y aceptado explícitamente los
términos vigentes (requisito 1), y que el corpus normativo que se muestra tenga
fuente citada.

**Responsabilidades:**
1. **Presentación obligatoria previa a todo:** auditar que ninguna ruta de arranque
   construya UI, toque red o lea el DOM antes de la resolución de términos
   (`mtrCompuertaDecision` → pantalla `terminos`). La pantalla de términos no toca red
   (invariante v18.3.2 — se re-verifica, no se asume).
2. **Aceptación explícita:** la constancia (`vgl_terminos_acepta`) vale solo para
   `TERMINOS_VERSION` vigente + identificador; bump de términos ⇒ re-aceptación.
   Verificar que no existe vía de "aceptar" sin gesto explícito del usuario.
3. **Negación ⇒ bloqueo inmediato + registro:** el rechazo (`terminos.rechazado` en la
   cadena, §5) impide la ejecución en la sesión. El cooldown `rechazo-fresco` es
   comportamiento vigente documentado: se conserva y se cita, no se inventa otro.
4. **Corpus normativo con fuente (requisito 2, junto a SA-IDEN):** las notificaciones
   normativas para médicos verificados citan norma y artículo (Ley 23/1981, Res.
   1995/1999, Ley 1581/2012, etc. — heredar la matriz SA-HCE de la auditoría élite,
   con sus «pendiente de fuente» intactos). Nada de memoria: sin fuente, no se muestra.

**Entregables:** dictamen de rutas de arranque · diff del corpus normativo con citas ·
prueba nueva + mutación si toca render.

**Prohibiciones:** mostrar texto normativo sin fuente · debilitar la exigencia de
aceptación · tocar identidad o acceso (terreno de SA-IDEN/SA-ACC).

---

## 2.2 SA-IDEN — Subagente de Verificación de Identidad Médica

**Misión:** confirmar contra la lista oficial quién es el médico (requisito 2) y
decidir —con evidencia— cuándo la identidad es NO confirmable (requisito 5).

**Responsabilidades:**
1. **Consulta del padrón:** auditar el ciclo completo de `vgl_acceso_lista`
   (carga local → refresco remoto → caducidad) y la resolución de identidad
   (`mtrLoginDeSesion`, caché `vgl_identidad_medico_cache`, `identidadDesdeCliente`).
   Cada resultado cae en el vocabulario cerrado de §3.2.
2. **Matriz de errores (requisito 5):** clasificar TODA vía de fallo — sin conexión,
   timeout, respuesta corrupta, lista vacía, lista caducada, login ilegible — y
   verificar que cada una produce `identidad.no-confirmable` (no un falso
   `fuera-del-padron`: error ≠ exclusión, y confundirlos acusaría a un médico de
   estar fuera de la lista cuando la red simplemente falló).
3. **Verificado ⇒ interfaz completa + notificaciones personalizadas:** identidad
   confirmada (perfil COMPLETO/LABORATORIOS) mantiene TODO lo que hoy tiene y recibe
   las notificaciones normativas curadas por SA-TERM. No se recorta nada del médico
   verificado — este encargo no disminuye al padrón.
4. **PHI:** la identidad en la cadena de auditoría va SOLO como uid del padrón o
   pseudónimo con sal (lección AE-009: nada de FNV-1a sin sal sobre cédulas).

**Entregables:** matriz motivo×causa×efecto con líneas citadas · diffs con prueba +
mutación (una por rama de error) · dictamen de no-regresión del padrón.

**Prohibiciones:** decidir el alcance del perfil GENERAL (terreno de GATE-A/SA-ACC) ·
citar una fuente de identidad que no esté capturada en el repo.

---

## 2.3 SA-ACC — Subagente de Control de Acceso y Ejecución

**Misión:** que el script EJECUTE solo lo que la compuerta autorizó — y nada más
(requisitos 1-3 aplicados).

**Responsabilidades:**
1. **Estado de acceso (§3):** implementar/auditar la máquina de estados del arranque:
   `bloqueado < terminos < general < verificado`, con las capacidades por perfil
   (`accesoCap()`) como única fuente de verdad de qué se monta.
2. **Perfil GENERAL (solo si GATE-A=A):** UI limitada SIN lectura de datos de
   pacientes (§1.3 línea roja). Gate en `boot()` + re-visa en `tick()` (patrón cap
   «centinela» de v18.3.4) para que un repintado de la SPA no lo reabra solo.
3. **Ejecución controlada:** cada arranque real del monitor deja `script.ejecucion`
   en la cadena con perfil y motivo que lo autorizaron. Si el motivo que autoriza no
   está en el vocabulario, no se ejecuta (fail-closed por defecto).
4. **Sin sorpresas de estado:** el motivo `sin-identidad-aceptado` cambia de
   significado con GATE-A=A (de "arranca pero PÚBLICO no monta nada" a "arranca en
   GENERAL") — las suites 78/80/82 y el E2E se actualizan en el MISMO PR, con las
   mutaciones que prueben que la puerta vieja ya no existe y la nueva sí cierra.

**Entregables:** diffs mínimos con prueba+mutación por rama · matriz actualizada de
capacidades por perfil · E2E extendido (caso general + caso verificado + caso error).

**Prohibiciones:** montar cualquier lector de página en GENERAL · ejecutar con motivo
fuera de vocabulario · tocar la cadena (terreno de SA-AUD; él expone la API).

---

## 2.4 SA-AUD — Subagente de Auditoría y Registro Inmutable

**Misión:** que TODA decisión del arranque quede registrada de forma segura,
inmutable y accesible solo a personal autorizado de auditoría (requisito 4). Dueño
del registro maestro (§6.1) y árbitro de formatos.

**Responsabilidades:**
1. **Cadena de auditoría (§5):** diseñar/implementar el log append-only encadenado
   (hash-previo → SHA-256 vía `crypto.subtle`, cola de escritura asíncrona) y SU
   VERIFICADOR (`tools/verificar_cadena_arranque.js`: recorre la cadena, declara el
   primer eslabón roto). Cadena sin verificador = cadena decorativa: el PR vuelve.
2. **Inmutabilidad HONESTA:** GM storage es escribible por el usuario del equipo —
   la cadena garantiza DETECTABILIDAD de manipulación, no imposibilidad. Esa frase
   exacta va en el aviso de privacidad de términos (hereda el precedente del aviso
   admitiendo la purga a 12 meses no instalada — AE-013: no se promete lo que no hay).
3. **Acceso restringido:** el volcado/export de la cadena sale cifrado/autenticado
   hacia el Tablero (Apps Script, credenciales del tablero — personal autorizado),
   nunca a un gist público ni a un tercero. Nada de PHI en la cadena (uid/pseudónimo).
4. **Registro maestro:** todo hallazgo y todo gate entra en `AUDITORIA/REGISTRO_ARRANQUE.md`
   (§6.1): solo append, ID único AB-###, vocabulario cerrado de estados. Trazabilidad
   hallazgo → tarea → PR → prueba → mutación → runner reconstruible leyendo solo el registro.

**Entregables:** cadena + verificador con prueba+mutación (mutar un eslabón y ver al
verificador romperse; restaurar; verde) · export al tablero · registro al día.

**Prohibiciones:** decidir por el dueño · cerrar un hallazgo sin evidencia · dejar una
mutación sin restaurar · cifrar/hashear con esquemas propios inventados.

---

# 3. EL FLUJO SECUENCIAL DE ARRANQUE — especificación normativa

Orden inquebrantable: **Términos → Identidad → Acceso.** Ninguna etapa se salta ni se
reordena; cada transición deja exactamente UN evento en la cadena (§5).

### 3.1 Máquina de estados

```
  [sin estado] ──arranque.intento──▶ ¿términos vigentes aceptados?
       │ no                │ sí (versión vigente + id)
       ▼                        ▼
  pantalla TERMINOS         ¿identidad confirmada vs padrón?
  (sin red, sin DOM leído)   │ sí              │ no confirmable (error/timeout/sin datos)
       │ aceptar → terminos.aceptado     ▼                    ▼
       │ rechazar → terminos.rechazado  PERFIL COMPLETO     ¿GATE-A=A?
       ▼                               (verificado:        │ sí → GENERAL (sin datos de pacientes)
  BLOQUEADO (sin ejecución)      interfaz completa    │ no → sin UI (fail-closed, status quo)
                                  + notificaciones          │
                                  normativas)               ▼
                                                        acceso.general
  toda ejecución del monitor → script.ejecucion {perfil, motivo autorizador}
```

### 3.2 Vocabulario cerrado de motivos (extiende el vigente, no lo reemplaza)

`bloqueado` · `aceptado` · `preguntar` · `rechazo-fresco` · `sin-identidad` ·
`sin-identidad-aceptado` · `fuera-del-padron` · **nuevo:** `identidad.no-confirmable`
(separar ERROR de exclusión — hoy un fallo de red puede colarse como
`fuera-del-padron` y eso es exactamente lo que el requisito 5 manda no hacer) ·
**nuevo si GATE-A=A:** `general-sin-identidad`.

Un motivo fuera de este vocabulario NO autoriza ejecución (fail-closed).

### 3.3 Matriz resultado×perfil×UI (la prueba de aceptación del flujo entero)

| Situación | Motivo resultante | Perfil | UI | ¿Ejecuta monitor? |
|---|---|---|---|---|
| Términos rechazados | `terminos.rechazado` | — | ninguna | NO |
| Términos vigentes + uid en padrón + consentimiento | `aceptado` | COMPLETO/LABORATORIOS | completa + notif. normativas | SÍ |
| Términos vigentes + identidad NO confirmable (error/timeout/datos) | `identidad.no-confirmable` (+`general-sin-identidad` si GATE-A=A) | GENERAL | limitada, cero datos de pacientes | SÍ (limitado) / NO (status quo) |
| uid explícitamente excluido | `fuera-del-padron` | — | ninguna | NO |
| blocklist | `bloqueado` | BLOQUEADO | ninguna | NO |

---

# 4. MANEJO DE ERRORES DE LA CONSULTA DE IDENTIDAD (requisito 5)

Toda incidencia que impida confirmar la pertenencia al padrón activa el flujo general
— nunca el bloqueo silencioso ni la exclusión injustificada — y queda registrada para
revisión posterior:

| Causa | Detección | Efecto inmediato | Evento en cadena |
|---|---|---|---|
| Sin conexión / NetErr | onerror del refresco | general (según GATE-A) | `auditoria.error_consulta {causa: "sin-conexion"}` |
| Timeout agotado | temporizador del refresco | general (según GATE-A) | `auditoria.error_consulta {causa: "timeout"}` |
| Respuesta corrupta/ilegible | parse fallido | general (según GATE-A) | `auditoria.error_consulta {causa: "respuesta-corrupta"}` |
| Lista vacía/caducada sin refresco posible | versión/caducidad | general (según GATE-A) | `auditoria.error_consulta {causa: "padron-no-disponible"}` |
| Excepción inesperada en la vía | catch clasificado | general (según GATE-A) | `auditoria.error_consulta {causa: "excepcion", detalle}` |

Regla dura: **error ≠ exclusión.** Ninguna de estas causas puede emitir
`fuera-del-padron`. Cada fila de esta tabla se implementa con SU prueba y SU mutación.

---

# 5. REGISTRO DE AUDITORÍA INMUTABLE (requisito 4) — especificación técnica

1. **Evento (vocabulario cerrado):** `arranque.intento` · `terminos.presentado` ·
   `terminos.aceptado` · `terminos.rechazado` · `identidad.consulta` ·
   `identidad.resultado` · `identidad.no-confirmable` · `acceso.concedido` ·
   `acceso.general` · `acceso.bloqueado` · `script.ejecucion` ·
   `auditoria.error_consulta` · `auditoria.export`.
2. **Eslabón:** `{ts, evento, motivo, perfil, sujeto (uid padrón o pseudónimo CON sal —
   nunca cédula/nombre), detalle sin PHI, prev, hash}` donde
   `hash = SHA-256(prev + JSON canónico del eslabón)` con `crypto.subtle`
   (asíncrono: cola de escritura; NO FNV-1a sin sal — AE-009).
3. **Almacenamiento:** GM `vgl_auditoria_cadena`, solo append, rotación por tamaño
   con resumen (hash del tramo cerrado) — nunca borrado silencioso.
4. **Verificación:** `tools/verificar_cadena_arranque.js` (node, sin dependencias):
   re-hashea eslabón a eslabón y reporta el primero que no encadena. Mutación
   obligatoria del PR de SA-AUD: alterar un `ts` a mano → el verificador DEBE romper.
5. **Acceso:** lectura local por el médico en SU equipo; export autenticado SOLO al
   Tablero (personal autorizado de auditoría). El gist público y cualquier tercero
   quedan fuera — la cadena no sale del perímetro del dueño.
6. **Honestidad documental:** el aviso de privacidad declara la garantía exacta
   (detección de manipulación, no imposibilidad). Casilla vacía antes que promesa
   falsa (precedente AE-013).

---

# 6. FASES, GATES Y REGISTRO MAESTRO

### 6.1 Registro maestro — `AUDITORIA/REGISTRO_ARRANQUE.md` (lo crea SA-AUD en F0)

```
| ID | Fecha | Subagente | Severidad | Archivo:Línea | Hallazgo | Evidencia | Estado | PR |
```
Reglas: solo append · ID único (AB-###) · vocabulario cerrado
(reportado/aceptado/en-cola/arreglado/descartado-con-motivo) · toda fila ajena se
conserva íntegra en conflictos. Además registra los SELLOS de gates (opción, fecha,
voz del dueño) y la cadena hallazgo→tarea→PR→prueba→mutación→runner.

### 6.2 Fases (orden obligatorio; F1 es de solo lectura)

| Fase | Quién | Qué produce | Gate |
|---|---|---|---|
| **F0 — Baseline** | SA-AUD | Punta real (rama/commit/sha256), banco+E2E congelados, registro creado, re-verificación por grep de las piezas de §1.1 | GATE-0 (dueño arranca) |
| **F1 — Auditoría de la compuerta actual** | SA-ACC + SA-IDEN + SA-AUD | Matriz de brechas requisito×pieza (§1.1) con líneas citadas; hallazgos AB-### | — |
| **F2 — Diseño del flujo y de la cadena** | SA-IDEN + SA-ACC + SA-AUD | Estado §3 + matriz §4 + cadena §5 concretos contra el código real, opciones y riesgo | **GATE-A (dueño): fail-closed vs GENERAL** |
| **F3 — Implementación** | SA-ACC / SA-IDEN / SA-TERM | Un PR por tarea: diff mínimo + prueba + mutación + suites 78/80/82/E2E al día | GATE-B (dueño revisa resultados) |
| **F4 — Cadena y verificador** | SA-AUD | Cadena + verificador + export tablero + mutación del eslabón | (incluido en GATE-B) |
| **F5 — Revisión cruzada** | los 4 | Cada uno re-audita el terreno ajeno (nadie se certifica a sí mismo) | — |
| **F6 — Informe final** | SA-AUD | Informe con certificación condicionada o total, nunca optimista | **GATE-C (dueño): release commit+push+gist** |

### 6.3 Revisión cruzada (nadie se certifica a sí mismo)

1. SA-ACC re-audita los diffs de SA-AUD (¿la cadena cambia algún flujo de acceso?).
2. SA-AUD re-audita los diffs de SA-ACC/SA-IDEN (¿alguna ruta nueva sin evento? ¿PHI?).
3. SA-TERM re-audita que ningún texto prometido falte (inmutabilidad honesta §5.6).
4. SA-IDEN re-audita que ningún error quedó clasificado como exclusión (§4).
5. Toda discrepancia se resuelve por jerarquía (§7) y queda ESCRITA en el registro.

---

# 7. PROTOCOLO ANTE LA DUDA

1. **¿Falta evidencia?** No se inventa: «pendiente de fuente» y, si hace falta, se
   entrega script de diagnóstico para capturarla en consultorio.
2. **¿Dos instrucciones chocan?** Gana la seguridad clínica, después la voluntad del
   dueño (explícita y documentada en el registro), después la norma, después la estética.
3. **¿El cambio toca el fail-closed?** Se DETIENE y se explica en el registro hasta
   que GATE-A esté sellado. Esta es la única regla de este encargo que no admite
   interpretación.
4. **¿La prueba no pasa y no se sabe por qué?** Jamás se debilita la prueba para que
   entre el PR. Se reporta y se depura.
5. **¿Un hallazgo repite auditorías previas?** Se referencia (REGISTRO_ELITE,
   INFORME_FINAL, P4_PHI); contradicción = cita + evidencia, nunca silencio.
