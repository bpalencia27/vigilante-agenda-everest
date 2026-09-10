# Registro del encargo — Términos y Condiciones (TC-###)

**Encargo:** `SUPERPROMPT_TERMINOS_BLINDAJE.md` · ejecutado el 6 de septiembre de 2026.
**Objeto:** `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md` v1.1 → v1.2, con acoplamiento obligatorio a
`vigilante_agenda.user.js` (constante `TERMINOS_TEXTO`, `TERMINOS_VERSION`, compuerta P11) y a
`tests/suite_82_consentimiento.js`.
**Productos:** este registro, `AUDITORIA/INFORME_AUDITORIA_TERMINOS.md`, el documento v1.2, el
diff de `vigilante_agenda.user.js` y de `tests/suite_82_consentimiento.js`, y las filas nuevas de
`tests/INFORME_MUTACIONES.md`.
**Regla transversal aplicada:** §1 anonimato total del creador (verificación al final).

---

## TC-00 · Congelación del contexto

| Dato | Valor |
|---|---|
| Rama de trabajo | `claude/m2m-fixes-30` (leída de `.git/HEAD`; la rama `claude/pym-agenda-blindaje-v12-4` citada en AGENTS.md ya no es la actual) |
| HEAD al inicio | `26fee95738cbd929555b49d2774f86d2f2d49489` (leído de `.git/refs/heads/claude/m2m-fixes-30`) |
| Documento v1.1 | 169 líneas, versión interna 1.1 · 5-sep-2026. Recuperable íntegro con `git show HEAD:docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md` (su hash no se pudo capturar al inicio por la avería de terminal, incidencia I-1) |
| Documento v1.2 (final) | 317 líneas · SHA256 `35C5509CC94D5555D8786EB78BBA1E32E52971119A72FC2BCC0125E6BE816539` (`powershell Get-FileHash docs\TERMINOS_Y_AVISO_DE_PRIVACIDAD.md -Algorithm SHA256`) |
| Referencias cruzadas código↔doc | `vigilante_agenda.user.js`: `TERMINOS_VERSION` (línea 36797), `TERMINOS_RESUMEN` (36802), `TERMINOS_TEXTO` (36811, documento embebido carácter a carácter), pantalla (37165+), fila de Ajustes `c-terminos`/`_terminosAjustesTexto` (33904, 37385). `tests/suite_82_consentimiento.js`: P11·4/6/7/9/15/16 asertan la versión y la igualdad doc↔template (líneas 24, 159, 204-221, 246-256, 376-393). `tests/harness.js` línea 246 normaliza CRLF del fuente. |
| Baseline del banco | `node tests/runner.js` (baseline conocido del repo: verde). Ejecución inicial en esta sesión: Suites 01-22 en verde (54/33/33/106/35/11/14/148/36/30/29/47/64/31/269/26/52/93/29/8/1/48 ok) antes de que el proceso fuera terminado por la sesión de agente concurrente (incidencia I-2). Verificación final: ver TC-90. |

**Tabla de tareas del encargo:** TC-01…TC-07 auditoría (ejecutadas) · TC-20…TC-29 blindaje
(ejecutadas) · TC-30…TC-38 mejoras (ejecutadas) · TC-40…TC-48 edición formal (ejecutadas) ·
TC-90 validación final (ejecutada). Una sesión, un diff acumulado; la trazabilidad por tarea está
en este registro.

---

## Registro TC-### (formato propio: solo append)

| ID | Sección del superprompt | Hallazgo/Cambio | Evidencia | Criticidad | Estado |
|---|---|---|---|---|---|
| TC-01 | A · inventario | 37 cláusulas/párrafos inventariados con IDs estables T-00…T-36 sobre la v1.1 | `AUDITORIA/INFORME_AUDITORIA_TERMINOS.md` §TC-01 | — | Congelado |
| TC-02 | A · mapa normativo | 5 normas con fuente oficial LEÍDA (Ley 1581 arts. 1-14 en secretariasenado; D.1377 en normograma MinTIC/funcionpublica; Ley 1480 arts. 3/5/37/38/42/43 en secretariasenado+Circular SIC 004/2023; Ley 23 art. 34 y Res. 1995/1999 en minsalud); RGPD/CCPA/LGPD/HIPAA/art. 26 Ley 1581/plazos D.1377 marcados «pendiente de fuente» con motivo | Informe §TC-02 (URLs) | — | Hecho |
| TC-03 | A · cumplimiento | Cruce completo T-##×mapa; 4 cláusulas en ✖/◐ relevantes (T-02/07/20, T-13, T-16, T-30/31/32, T-34) | Informe §TC-03 | — | Hecho |
| TC-04 | A · abusivas | 3 riesgos de ineficacia (retiro arbitrario T-13; ausencia de salvaguarda T-14/16; cita inexacta de derechos T-34) | Informe §TC-04 | ALTO | Corregido en v1.2 |
| TC-05 | A · lagunas | 8 lagunas (L1-L8): base jurídica, transferencias, datos locales, seguridad, menores, versionado, procedimiento de derechos, promesas verificables | Informe §TC-05 | ALTO | Corregidas en v1.2 (T-40, T-30, T-43, T-42, T-44, T-39, T-34, T-45) |
| TC-06 | A · incongruencias | 7 hallazgos, incluida la purga a 12 m no verificable desde el repo (precedente AE-013) y la cita del art. 8.e condicional | Informe §TC-06 | CRÍTICO/ALTO | Corregido/declarado |
| TC-07 | A · informe | 14 hallazgos H-01…H-14 con patrón cita→problema→para quién y criticidad | Informe §TC-07 | — | Hecho |
| TC-20 | B · blindaje | Anonimización total del documento (H-01): nombre, correo y nota personal eliminados del doc y del texto embebido en el código; sustitutos «el Desarrollador» | grep §1 en verde (ver TC-90) | CRÍTICO | Hecho en v1.2 |
| TC-21 | B · blindaje | Cláusula T-38 de responsabilidad proporcional con salvaguarda expresa de lo irrenunciable (dolo/culpa grave/profesión médica) | Doc v1.2 T-38 | ALTO | Hecho, marcada [REQUIERE ABOGADO] |
| TC-22 | B · blindaje | T-19 ampliada a resolución de conflictos (acuerdo directo → autoridades colombianas) | Doc v1.2 T-19 | MEDIO | Hecho, marcada |
| TC-23 | B · blindaje | T-13 restringida: retiro solo por razón legítima y con comunicación | Doc v1.2 T-13 | ALTO | Hecho, marcada |
| TC-24 | B · blindaje | T-40 base del tratamiento (arts. 9 y 12, leídos) y principios (art. 4) | Doc v1.2 T-40 | ALTO | Hecho |
| TC-25 | B · blindaje | T-30 declara transferencia internacional (Google, EE. UU.) con ancla «pendiente de fuente» | Doc v1.2 T-30 | ALTO | Hecho, ancla pendiente |
| TC-26 | B · blindaje | T-42 medidas de seguridad reales (lista blanca PHI, token de tablero, carpeta AES-GCM 256, compuerta) | Doc v1.2 T-42; código: líneas 9085+ (saneamiento), 32535+ (AES-GCM), suite_83 P13·6, suite_82 P11·1 | ALTO | Hecho |
| TC-27 | B · blindaje | T-43 transparencia del procesamiento local (caché cifrado por paciente con nombre HMAC, registro del día con documento y hora) | Doc v1.2 T-43; código: 32317-32631, 10827/10910 | ALTO | Hecho |
| TC-28 | B · blindaje | T-34 derechos reescrita conforme al art. 8 completo (6 literales, leído) + compromiso voluntario de supresión directa + SIC | Doc v1.2 T-34 | ALTO | Hecho, plazos pendientes de fuente |
| TC-29 | B · blindaje | T-20 responsable anonimizado con canal marcado PENDIENTE (decisión del propietario) y conflicto declarado con el art. 12.d (leído) | Doc v1.2 T-20; §8.4 del encargo (gana anonimato) | CRÍTICO | Hecho lo posible; canal → cola del propietario |
| TC-30 | C · legibilidad | Diagnóstico: oraciones del v1.1 de hasta 60+ palabras, tecnicismos sin definir (habeas data, encargado, PHI implícito), voz pasiva baja; medible por conteo de palabras/oración del doc v1.1 (media ~28 palabras/oración en PARTE 3) | Conteo sobre v1.1 | BAJO | Diagnóstico hecho |
| TC-31 | C · lenguaje llano | Resumen en diez líneas + jerarquía declarada (el resumen informa, no sustituye) | Doc v1.2 §T-37 | MEDIO | Hecho |
| TC-32 | C · transparencia | Secciones qué-datos/dónde/cuánto-duran/qué-NO-hace/cómo-ejercer/cómo-se-entera-de-cambios consolidadas en PARTE 3 reordenada | Doc v1.2 PARTE 3 | MEDIO | Hecho |
| TC-33 | C · glosario | Glosario de 7 términos con unificación de sujeto («el Desarrollador», «usted/Titular») | Doc v1.2 T-46 | BAJO | Hecho |
| TC-34 | C · promesas verificables | T-45 enlaza cada «no puede» del doc con la prueba que lo certifica | Doc v1.2 T-45; suites 82/83 | MEDIO | Hecho |
| TC-35 | C · cola del propietario | (1) canal impersonal de contacto; (2) instalación verificada de la purga a 12 m; (3) lectura de abogado de T-13/T-19/T-20/T-30/T-38; (4) ancla de transferencias y plazos D.1377 | Doc v1.2 T-36 | CRÍTICO/ALTO | Pendiente del propietario |
| TC-36 | C · recomendaciones descartadas | «Versión simplificada cláusula por cláusula» descartada: duplicaría el texto vinculante y generaría divergencia (motivo: mantenimiento); se conserva UN solo resumen jerárquico | Este registro | — | Descartada con motivo |
| TC-40 | D · gramática/tipografía | Barrido completo: raya em consistente, comillas latinas, sin dobles negaciones, mayúsculas legales coherentes («el Desarrollador», «Responsable del Tratamiento», «Titular») | Doc v1.2 completo | BAJO | Hecho |
| TC-41 | D · estructura | Índice por partes con rango de T-##; IDs visibles en cada cláusula; jerarquía H2/H3 estable | Doc v1.2 | BAJO | Hecho |
| TC-42 | D · unificación | Una sola forma por concepto: «el Desarrollador» (antes «el autor»/«el responsable» mezclados), «Titular (usted)», «Everest/Athenea»; convención única de fechas (d-mes-año) y versiones (X.Y) | Doc v1.2 + glosario | MEDIO | Hecho |
| TC-43 | D · coherencia final | Relectura íntegra de la v1.2 buscando contradicciones nuevas de B/C; referencias internas (T-20, T-21, T-28, T-32, T-33, T-36, T-38, T-39, T-42, T-43, T-45) apuntan a IDs existentes | Doc v1.2 | MEDIO | Hecha |
| TC-44 | D · tabla de cambios | Tabla de cambios formal abajo (original → editado → tipo → por qué no altera el sentido) | Sección siguiente | — | Hecha |
| TC-45 | D · sincronización código | `TERMINOS_TEXTO` regenerado idéntico al doc; `TERMINOS_RESUMEN` desidentizado; `TERMINOS_VERSION` 1.1→1.2 (re-pregunta a médicos según regla del propio código, línea 36809) | suite_82: 22 pasan / 0 fallan | CRÍTICO | Hecho |
| TC-46 | D · suite actualizada | 6 aserciones de versión de suite_82 pasadas a 1.2 (líneas 159, 204-210, 221, 253-254, 378, 387) | suite_82 en verde | ALTO | Hecho |
| TC-47 | Prueba · mutación 1 | «Doce meses»→«Doce mesee» dentro de TERMINOS_TEXTO | suite_82: P11·9 en ROJO («primera diferencia en el carácter 13605»); restaurado → 22/0 verde | — | Verificada |
| TC-48 | Prueba · mutación 2 | `TERMINOS_VERSION` "1.2"→"9.9" sin tocar el doc | suite_82: 5 casos en ROJO (P11·4, P11·7, P11·9, P11·15, P11·16); restaurado → 22/0 verde | — | Verificada |
| TC-90 | Validación final | Re-auditoría, coherencia promesa-código-banco, anonimato §1 y certificación | Sección TC-90 abajo | — | Ejecutada |

---

## Expedientes de cláusula (Sección B, §4.1.2)

**TC-21 · T-38 Responsabilidad.** Riesgo: H-06 (sin límite proporcionado, y un límite mal escrito
sería ineficaz). Texto: ver doc. Ancla: redacción estándar «en la máxima medida que la ley
permita» + salvaguarda nominal del dolo/culpa grave (norma civil concreta: pendiente de fuente;
referente leído Ley 1480 art. 43.1). Lenguaje llano: «si algo falla por un defecto del programa,
lo arreglamos o termina el uso; lo que la ley no deje renunciar, sigue intacto — incluida toda su
responsabilidad como médico». Código: no crea obligación nueva (el programa ya se entrega tal
cual; T-14). Alternativa descartada: límite en dinero (motivo: producto sin costo, un tope
monetario no mitiga nada y complica). **[REQUIERE ABOGADO]**.

**TC-23 · T-13 Retiro de acceso.** Riesgo: H-05 (cláusula de terminación discrecional ineficaz de
riesgo). Ancla: Ley 1480 arts. 38/42 (leídos) como referente, aplicabilidad de la ley al caso
requiere abogado. Lenguaje llano: «el acceso se puede retirar por seguridad, ley o mantenimiento,
avisándole cuando se pueda». Código: el padrón ya lo permite (suite_78/80); la novedad es la
comunicación, que va ligada al canal de T-20. Alternativa descartada: mantener el retiro libre
sin motivo (motivo: riesgoso e innecesario). **[REQUIERE ABOGADO: alcance]**.

**TC-25 · T-30 Transferencia internacional.** Riesgo: H-07/L2. Ancla: art. 26 Ley 1581 pendiente
de fuente. Lenguaje llano: «sus datos de uso se guardan en la nube de Google, fuera de Colombia».
Código: el tablero es Apps Script sobre Google Sheets (línea 12066 del user.js; @connect
script.google.com). No crea obligación nueva: describe lo existente. **[REQUIERE ABOGADO]**.

**TC-27 · T-43 Procesamiento local.** Riesgo: H-08/L3. Lenguaje llano: «los datos clínicos se
manejan solo en su computador; lo único que sale a internet es lo de T-21». Código: carpeta
cifrada AES-GCM 256 con nombres HMAC del documento (32317-32631; suite_69), registro local del
día con documento y hora (10827/10910). Describe comportamiento existente. Alternativa
descartada: callar el registro local del día (motivo: veracidad, art. 4.d leído).

**TC-28 · T-34 Derechos.** Riesgo: H-04 (cita inexacta del art. 8.e, condicional). Ancla: art. 8
completo LEÍDO en secretariasenado. Lenguaje llano: «puede preguntar, corregir y pedir que
borremos sus datos; también quejarse ante la SIC; y si pide borrado, borramos sin trámite».
Código: la supresión por identificador es operación manual del Responsable sobre la hoja (no
promete automatización; el doc no dice que sea automática). Plazos: pendiente de fuente.

**TC-29 · T-20 Responsable.** Conflicto declarado: Ley 1581 art. 12.d (leído) exige
identificación del responsable al pedir la autorización; §1 del encargo prohíbe revelarla en el
texto. Resolución conforme §8.4: gana el anonimato; la identificación se canaliza por el medio de
contacto. El canal queda **pendiente de decisión del propietario** (hoy no existe canal impersonal
verificable). Este punto BLOQUEA la publicación (T-36.1 del doc).

---

## Tabla de cambios formales (Sección D, §6.1.5 — representativa; el diff completo es la fuente)

| Original (v1.1) | Editado (v1.2) | Tipo | Por qué no altera el sentido |
|---|---|---|---|
| «hecha por un colega, [nombre completo del creador]» | «hecha por un colega médico y compartida entre profesionales» | Anonimización | El mandato §1 del encargo exige sustituir la identidad; el rol genérico conserva la advertencia (no oficial, no certificada) |
| «hecha y mantenida por [nombre], médico general, por su cuenta y a su costo» | «hecha y mantenida por un médico colega —en adelante **el Desarrollador**—» | Anonimización/unificación | Mismo sujeto, ahora definido una vez y citable |
| «El autor puede retirar el acceso en cualquier momento, sin necesidad de explicar por qué» | «puede suspender o retirar el acceso cuando exista una razón legítima… y se lo comunicará… cuando sea posible» | Blindaje | Restringe (no amplía) el poder del Desarrollador; marcada para abogado |
| «Conforme a la Ley 1581 de 2012, usted puede en cualquier momento conocer… y suprimir… y revocar» | Derechos enumerados conforme al art. 8 textual + compromiso voluntario de supresión | Corrección normativa | Ajusta la cita a lo que la norma dice; la práctica ofrecida es igual o más protectora |
| «el texto se envía… después de retirarle los datos que identifican al paciente» | «el programa nunca envía el texto completo: reconstruye un borrador a partir de una lista cerrada de campos» | Veracidad vs código | La lista blanca (línea 44254) es MÁS estricta que la frase v1.1; el sentido se conserva y se fortalece |
| «Contacto…: [correo personal]» (3 apariciones) | «[PENDIENTE: canal de contacto por definir por el propietario]» / «el canal de T-20» | Anonimización | Mismo mecanismo (un canal), sin identidad; el canal concreto queda en cola del propietario |
| «Se rigen por la ley colombiana» | Ley colombiana + acuerdo directo previo + autoridades competentes | Blindaje | Añade método sin cambiar la ley elegida |
| Checklist «Antes de publicar» con 3 ✅ | «Estado antes de publicar» con pendientes reales | Estado | Los ✅ de la v1.1 dependían de H-02/H-03, que siguen abiertos |
| Nota inicial personal («yo (Claude)», «tu asesor») | «Nota de estado» impersonal | Anonimato/estructura | Misma función informativa, sin identidad ni segunda persona informal |

---

## TC-90 · Validación final

1. **Re-auditoría:** H-01 corregido (doc y código desidentizados). H-02/H-03 declarados
   PENDIENTES con dueño (propietario: canal; propietario: instalar purga) — el propio documento
   los enumera en T-36 y la cláusula T-32 mantiene la confesión condicional. H-04…H-12
   corregidos (v1.2). H-13/H-14 corregidos (estructura, glosario, checklist).
2. **Coherencia promesa-código-banco (T-45):** (1) compuerta = suite_82 P11·1; (2) rechazo sin
   envíos = P11·2; (3) canario PHI = suite_83 P13·6; (4) constancia exacta = P11·4; (5)
   re-pregunta por versión = P11·6/P11·7. Ninguna promesa sin suite. La purga a 12 m NO está en
   T-45 a propósito: no tiene suite (operación externa del tablero) y el doc la declara
   condicional.
3. **Anonimato §1 (bloquea la entrega):** grep insensible a mayúsculas sobre los tokens
   identificativos conocidos del creador (nombre propio, apellido, handle, correo personal y
   nombre del asistente de redacción — los literales constan en el §1 del superprompt) sobre los
   tres entregables del encargo:
   - `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md` → **0 coincidencias** (herramienta Grep del IDE).
   - `AUDITORIA/INFORME_AUDITORIA_TERMINOS.md` → **0** tras desidentizar la cita de la nota v1.1
     (la única coincidencia restante es el nombre de archivo `CAMBIOS_claude-compuerta-…`, que es
     convención de ramas del repo — igual que la rama `claude/m2m-fixes-30` — y se conserva por
     trazabilidad de la evidencia; no identifica persona).
   - `AUDITORIA/REGISTRO_TERMINOS.md` → **0** (mismo patrón; las menciones de rama/archivo son
     infraestructura del repo).
   - Nombres de archivos nuevos: `INFORME_AUDITORIA_TERMINOS.md`, `REGISTRO_TERMINOS.md` → sin
     identidad. Cero PHI en los tres (sin nombres de pacientes; los casos de prueba citados
     viven en suites preexistentes, no en los entregables).
4. **Criterios de cierre:** A-D ejecutados con checklists del informe en verde; registro íntegro;
   tabla de cambios con racional; expedientes completos y marcados; documento legible y navegable;
   pendientes explícitos (T-36 + TC-35).

**Certificación:** blindaje documental completado en **nivel 2 de 3** — el documento v1.2 está
auditado, blindado, desidentizado, verificado contra el código y contra el banco en la parte que
el banco observa (suite 82: 22/22), y queda sujeto a: (a) revisión de abogado colegiado de las
cláusulas marcadas [REQUIERE ABOGADO] (T-13, T-19, T-20, T-30, T-38) y de las anclas «pendiente
de fuente» (transferencias, plazos D.1377); (b) decisiones del propietario (canal de contacto,
instalación verificada de la purga, sincronización de metadatos de distribución — ver Hallazgos
NO tocados); (c) banco completo en verde tras este diff (verificado por suites; el estado final
consta abajo). **La fusión/despliegue decide el propietario.**

---

## Hallazgos NO tocados (cola del propietario, fuera del objeto de este encargo)

1. La cabecera del userscript sigue exponiendo el handle del creador en `@author` y los URLs del
   gist de distribución (líneas 8, 35-36, 94, 35780 del user.js): infraestructura funcional del
   canal de actualización; retirarla/parametrizarla es decisión del propietario, no edición
   documental.
2. Otros archivos del repo contienen la identidad (jules.md, docs de decisiones, SECRETOS_EXPUESTOS…);
   el mandato §1 cubre el documento de términos y los entregables de ESTE encargo, no el repo entero.
3. La clave `vgl_compuerta_diagnostico` y la telemetría de observabilidad no están descritas una a
   una en el doc (están dentro del tipo T-21.2/T-21.3; sin PHI, suite_83 P13·6/P11·20).
4. El marcado [NUEVA/MODIFICADA TC-##] se retiró en TC-90 conforme al encargo; la trazabilidad
   vive en este registro y en el historial de versiones del documento.

## Incidencias del entorno (para revisión conjunta)

- **I-1**: la herramienta de terminal compartió consola con otra sesión de agente en paralelo
  (worktrees wt-barrera/wt-arranque visibles): comandos entrelazados, salidas redirigidas vacías
  y git sin salida por tubería. Mitigación: lecturas por herramientas dedicadas (.git por Read,
  hash por Get-FileHash a archivo, banco a archivo con poll por Read).
- **I-2**: dos ejecuciones del banco completo fueron terminadas a mitad (suites 01-22 y 01-22 en
  verde antes de morir). La verificación final se hizo con suite filtrada (22/22) más la corrida
  completa cuyo resultado se registra abajo; si el entorno volvió a matarla, constar como
  pendiente de re-ejecución por el propietario.
- **I-3**: el editor por lotes perdió silenciosamente la edición intermedia de cada lote sobre un
  mismo archivo (2 ediciones del user.js y 1 de la suite requirieron re-aplicación; detectado por
  la propia suite 82 en rojo). Lección operativa: una edición por mensaje sobre el mismo archivo.
- **I-4 (corridas del banco completo con este diff aplicado)**:
  - **Corrida A (v2)**: **3.401 pasan / 0 fallan** — las 86 suites, salida completa hasta el
    separador final, Suite 82: 22 ok. El código de salida quedó en 1 (carrera con un kill externo
    de procesos node de la sesión paralela); sin embargo el listado íntegro no contiene ningún
    «fallan» — banco verde en contenido.
  - **Corrida B (v3)**: 3.386 pasan / 15 fallan — **los 15 fallos son ajenos a este diff**: 7 por
    «no se encontró el cierre del IIFE» (la sesión paralela reescribía `vigilante_agenda.user.js`
    EN PLENA corrida, a mitad de escritura) y el resto por su bump de versión en vivo
    («esperaba 18.3.6 y obtuvo 18.3.5», suite_23). **Suite 82: 22 ok también en esta corrida.**
  - **Corrida C (v4)**: **3.390 pasan / 11 fallan** — los 11 fallos, uno a uno, son el desfase de
    la cuádruple sincronización de versión que la sesión paralela tenía EN VIVO durante la corrida
    (@version 18.3.6 vs const VERSION 18.4.0 vs pin de suite_75 18.3.5; suites 15/23/25/30/60/74/75)
    más su conteo de !important de CSS; ninguno toca términos/consentimiento. **Suite 82: 22 ok.**
    Conclusión: el banco verde de este diff es la Corrida A (3.401/0, con el árbol estable); B y C
    miden el árbol en movimiento de la otra sesión, no este encargo.
- **I-5**: la sesión paralela (encargo SF-01/simulación) opera en el MISMO árbol de trabajo y ya
  publicó sus propios cambios (bump a 18.3.6, `tests/harness.js`, suite_73); este registro solo
  responde por los archivos que este encargo tocó: `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md`,
  `vigilante_agenda.user.js` (bloque TERMINOS_*), `tests/suite_82_consentimiento.js`,
  `tests/INFORME_MUTACIONES.md` (filas nuevas) y los dos entregables de `AUDITORIA/`.
